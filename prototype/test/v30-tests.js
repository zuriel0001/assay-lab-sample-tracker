// v24d (21 Oct): "MET Lab jobs are done in the MET Lab, only final samples are submitted to the assay lab for analysis … rework the
// workflow"; then, asked: the assay lab receives, analyses and releases (no preparation); what is left goes back to the MET Lab when the
// results are released; the MET Lab's own working (tank efficiencies, bottle roll recovery, preg-robbing index) shows on the batch page only,
// not on the certificate; the assay lab still runs the carbon activity test. Shift end is unchanged. Values here are made up.
// Run: NODE_PATH=$(npm root -g) timeout 590 node v30-tests.js
process.env.V24 = "1";
const H = require("./harness");
const { errors, newUser, launch, signIn, open, doc, waitFor, ledger, store } = H;
const names = {};
const log = (...a) => console.log("•", ...a);
const check = (cond, msg) => { console.log(cond ? "  PASS" : "  FAIL", msg); if (!cond) process.exitCode = 1; };
const text = async (page, sel) => ((await page.textContent(sel).catch(() => "")) || "").replace(/\s+/g, " ").trim();
const live = o => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v != null).map(([k, v]) => [k, v.raw]));

async function jobForm(P, kind, tpl, date, shift){
  await H.tab(P, "submit"); if (await P.$("#rAgain")) await P.click("#rAgain");
  await P.check(`input[name="rKind"][value="${kind}"]`); await P.waitForTimeout(200);
  await P.selectOption("#jTpl", tpl); await P.waitForTimeout(150);
  if (shift && await P.isVisible("#jShift")) await P.selectOption("#jShift", shift);
  await P.fill("#jDate", date); await P.dispatchEvent("#jDate", "change"); await P.waitForTimeout(150);
}
async function submit(P){
  await P.fill("#rSubmitter", "MET technician"); await P.click("#rSubmit");
  await P.waitForSelector("#rResult code", { timeout: 30000 });
  const ids = await P.$$eval("#rResult code", els => els.map(e => e.textContent.split(" · ")[0]));
  return { ids, ref: doc(ids[0]).batchId };
}
async function receive(P, j){
  await open(P, j.ref); await P.waitForSelector("#bvRecv", { timeout: 8000 }).catch(() => {});
  if (await P.$("#bvTemp")) await P.fill("#bvTemp", "5");
  await P.check("#bvOk"); await P.click("#bvRecvBtn"); await waitFor(() => j.ids.every(id => doc(id).stageKey === "received"), 30000);
  await open(P, j.ref); await P.waitForTimeout(400);
}
async function release(P, j, name, lines){
  await H.attachFile(P, `sub:${j.ref}`, name, Buffer.from(lines.join("\n") + "\n"));
  await P.click("#upSave"); await P.waitForSelector("#upBox", { state: "detached", timeout: 60000 }); await waitFor(() => j.ids.every(id => (doc(id).certs || []).length), 30000);
  await open(P, j.ref); await P.waitForTimeout(700);
}
async function certText(P){ await P.click("[data-bcert]"); await P.waitForSelector("#certBox .cert"); const t = await text(P, "#certBox .cert"); await P.click("#certClose"); return t; }

(async () => {
  const browser = await launch();
  const Tc = await newUser(browser, { uid: "u_t", name: "Tech", canEdit: true, names }); await signIn(Tc, "tech1");
  await Tc.waitForTimeout(600);

  log("A MET Lab job: its final samples on a route of their own");
  await jobForm(Tc, "met", "tank", "2026-10-25"); await Tc.uncheck('[data-jon="11"]');
  const tk = await submit(Tc), t1 = doc("MLSPTK0120261025");
  check(t1.route === "MET-JOB" && t1.routeName === "MET Lab final samples (one report)" && t1.retention.length === 1 && t1.retention[0].auto && /Returned to the MET Lab/.test(t1.retention[0].then), "route MET-JOB: MET Lab final samples (one report); what is left goes back to the MET Lab");
  check(t1.plan.map(x => x.name).join(" › ") === "Submitted, awaiting receipt › Received & logged at lab › In analysis › Results released › Returned to the MET Lab", "receive, analyse, release, return: " + t1.plan.map(x => x.name).join(" › "));
  await open(Tc, tk.ref); await Tc.waitForTimeout(400);
  const bw0 = await text(Tc, "#bwBox");
  check(/MET Lab final samples \(one report\)/i.test(bw0) && /Returned to the MET Lab\s*What is left goes back with the results/.test(bw0), "the batch's workflow names the route and ends on the return");

  log("Released: what is left goes back to the MET Lab with the results");
  await receive(Tc, tk);
  const rows = ["MLSPPLFD20261025,Pre-leach feed,1.20,0.220", ...Array.from({ length: 10 }, (_, i) => `MLSPTK${String(i + 1).padStart(2, "0")}20261025,Tank ${i + 1},${(0.42 - i * 0.03).toFixed(2)},${(0.9 / (i + 1)).toFixed(3)}`), "PROCWATE20261025,Process water,,0.002"];
  await release(Tc, tk, "tank.csv", ["Sample,Description,AuFA,AuSX", ",,ppm,mg/L", ...rows]);
  const after = tk.ids.map(doc);
  check(after.every(s => s.stageKey === "returned" && s.open === false && s.onHand === false && s.materials.every(m => m.status === "returned")), "every sample closed: returned, nothing kept");
  check(after.every(s => ledger().filter(m => m.sid === s.id && m.dir === "out" && m.kind === "returned").length === 1), "one OUT movement each in the ledger: returned");
  check(after.every(s => store["stock/" + s.id]?.st === "out"), "each stock record: out of the lab");
  check(after.every(s => (s.history || []).some(h => /Sample remainder: returned to the MET Lab with the results/.test(h.note || ""))), "each record says so");
  const bw1 = await text(Tc, "#bwBox");
  check(/Workflow complete/.test(bw1) && /12 samples released; sample remainder: returned to the MET Lab with the results/.test(bw1) && !/Left the workflow/.test(bw1), "the batch page: workflow complete, the remainder back with the MET Lab (not 'left the workflow')");
  check(/The MET Lab's working, from the results: on this page only, not on the certificate/.test(await text(Tc, "#vzTank")) && /Leach efficiency/.test(await text(Tc, "#vzTank")), "the tank profile's working stays on the batch page, marked as the MET Lab's");
  const ct = await certText(Tc);
  check(/MLSPTK0120261025/.test(ct) && /0\.42/.test(ct) && !/Leach efficiency|Adsorption efficiency|down the tanks/.test(ct), "the certificate reports the assays, without the tank profile's working");
  await H.tab(Tc, "board"); await Tc.waitForTimeout(500);
  check(!(await text(Tc, "#view-board")).includes(tk.ref), "the batch has left the board");

  log("Bottle roll and preg-robbing: the working on the batch page only");
  await jobForm(Tc, "met", "brt", "2026-10-25");
  const br = await submit(Tc); await receive(Tc, br);
  const fr = ["+425", "+212", "+150", "+106", "+75", "+53", "-53A", "-53B"];
  await release(Tc, br, "brt.csv", ["Sample,Description,AuFA,AuSX", ",,ppm,mg/L", ...fr.map((f, i) => `MLABPF${f}20261025,feed,${(9 - i).toFixed(2)},`), ...fr.map((f, i) => `MLABPT${f}20261025,tails,${(1 + i * 0.1).toFixed(2)},`), "MLABSL0120261025,filtrate,,0.420"]);
  check(/Recovery by size/.test(await text(Tc, "#vzBrt")) && /The MET Lab's working/.test(await text(Tc, "#vzBrt")), "the bottle roll's recovery on the batch page, marked as the MET Lab's");
  const cb = await certText(Tc);
  check(/MLABPF\+42520261025/.test(cb) && !/Bottle roll: recovery by size|Recovery by size/.test(cb), "the certificate: the assays, no recovery");
  check(br.ids.every(id => doc(id).stageKey === "returned"), "the bottle roll's samples back with the MET Lab too");
  await jobForm(Tc, "met", "preg", "2026-10-25"); await Tc.fill("#jC_n", "2"); await Tc.waitForTimeout(200);
  const pg = await submit(Tc); await receive(Tc, pg);
  await release(Tc, pg, "preg.csv", ["Sample,Description,AuSX", ",,mg/L", "MLABPREG0120261025,t,0.5", "MLABPREG0220261025,t,0.6", "MLABPREG0320261025,c,2.0", "MLABPREG0420261025,c,2.2"]);
  check(/Preg-robbing index/.test(await text(Tc, "#vzPreg")) && !/Preg-robbing index|\(spike/.test(await certText(Tc)), "the preg-robbing index on the batch page, not on the certificate");

  log("Carbon activity from the MET Lab: still tested here, its results on the certificate");
  await jobForm(Tc, "met", "cact", "2026-10-25", "D"); await Tc.fill("#jN_n1", "40"); await Tc.fill('#jRows .j-code[data-j="3"]', "VIRGIN-X"); await Tc.waitForTimeout(150);
  const ca = await submit(Tc); await receive(Tc, ca);
  await release(Tc, ca, "act.csv", ["Sample,Description,Au CA-00,Au CA-15,Au CA-30,Au CA-45,Au CA-60,Au CA-120", ",,mg/L,mg/L,mg/L,mg/L,mg/L,mg/L",
    "MLDSCBRG20261025,r,10,9,8,7.5,7,6", "MLSCBST20261025#40,s,10,9.1,8.6,8.4,7.8,6.5", "MLSCBLD20261024#40,l,10,9.3,9,8.7,8.2,7.7", "VIRGIN-X,v,10,8.4,7.8,7.1,6.3,5.2"]);
  check(/Carbon activity/.test(await certText(Tc)) && ca.ids.every(id => doc(id).route === "MET-JOB" && doc(id).stageKey === "returned"), "the activity readings and k on the certificate; the carbon back with the MET Lab");

  log("Shift end is unchanged: kept for its own period, the strip profile on the certificate");
  await jobForm(Tc, "job", "elution", "2026-10-25"); await Tc.fill("#jN_n1", "40");
  const el = await submit(Tc);
  check(doc(el.ids[0]).route === "JOB" && !doc(el.ids[0]).retention.some(x => x.auto), "an elution run stays on the job route, its material kept by its own rule");
  await receive(Tc, el);
  const mins = [60, 120, 180, 240, 300, 360, 420, 480, 540, 600];
  await release(Tc, el, "elu.csv", ["Sample,Description,AuSX,AgSX", ",,mg/L,mg/L", ...mins.map(m => `MLSPE${String(m).padStart(3, "0")}20261025,t,0.5,0.1`), ...[0, ...mins].map(m => `MLSPH${String(m).padStart(3, "0")}20261025,h,${(100 - m / 10).toFixed(1)},2`), ...Array.from({ length: 12 }, (_, i) => `MLSPP${String((i + 1) * 30).padStart(3, "0")}20261025,p,${(200 - i * 10).toFixed(1)},5`), "MLSPLNAF20261025,a,50,1", "MLSPLNBF20261025,b,300,1", "MLSPTRTD20261025,w,0.1,0"]);
  check(el.ids.every(id => doc(id).stageKey === "released" && doc(id).materials.some(m => m.status === "kept")), "released, its material kept to put away");
  check(/Strip profile/.test(await certText(Tc)), "the strip profile still on its certificate");

  log("Routes");
  await H.tab(Tc, "routes"); await Tc.waitForTimeout(400);
  check(/MET Lab final samples \(one report\)/.test(await text(Tc, "#view-routes")), "Routes: MET Lab final samples (one report)");

  console.log("Console errors:", JSON.stringify(errors));
  check(!errors.length, "no console errors");
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
