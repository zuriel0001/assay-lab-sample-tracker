// v24d (20 Oct): the MET Lab's jobs and the 11 CIL tanks. Submit › MET Lab job (its own choice, beside Shift job) lists the MET Lab's
// routine jobs from its reports: Tank profile, Bottle roll (BRT), Preg-robbing test and QA/QC set, from section MET. The tank profile draws
// gold in solids and in solution down the tanks; the bottle roll works out recovery by size and, with the fractions' masses, the calculated
// head, tails and overall recovery; the preg-robbing test each sample's index against its control; the QA/QC set is reported as it is.
// The Mill shift lists carbon from all 11 tanks and draws it tank by tank. Values here are made up; the lab's real reports are checked
// locally and kept out of GitHub.
// Run: NODE_PATH=$(npm root -g) timeout 590 node v28-tests.js
process.env.V24 = "1";
const H = require("./harness");
const { errors, newUser, launch, signIn, open, doc, waitFor } = H;
const names = {};
const log = (...a) => console.log("•", ...a);
const check = (cond, msg) => { console.log(cond ? "  PASS" : "  FAIL", msg); if (!cond) process.exitCode = 1; };
const text = async (page, sel) => ((await page.textContent(sel).catch(() => "")) || "").replace(/\s+/g, " ").trim();
const live = o => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v != null).map(([k, v]) => [k, v.raw]));
const pct = v => v.toFixed(1) + "%";

async function jobForm(P, kind, tpl, date, shift){
  await H.tab(P, "submit"); if (await P.$("#rAgain")) await P.click("#rAgain");
  await P.check(`input[name="rKind"][value="${kind}"]`); await P.waitForTimeout(200);
  await P.selectOption("#jTpl", tpl); await P.waitForTimeout(150);
  if (shift && await P.isVisible("#jShift")) await P.selectOption("#jShift", shift);
  await P.fill("#jDate", date); await P.dispatchEvent("#jDate", "change"); await P.waitForTimeout(150);
}
const codes = P => P.$$eval("#jRows .j-code", es => es.map(e => e.value));
const opts = (P, sel) => P.$$eval(sel + " option", os => os.map(o => o.value));
async function submit(P){
  await P.fill("#rSubmitter", "MET technician"); await P.click("#rSubmit");
  await P.waitForSelector("#rResult code", { timeout: 30000 });
  const res = await P.$$eval("#rResult code", els => els.map(e => e.textContent.split(" · ")));
  return { ids: res.map(x => x[0]), tags: res.map(x => x[1] || x[0]), ref: doc(res[0][0]).batchId };
}
async function receive(P, j){
  await open(P, j.ref); await P.waitForSelector("#bvRecv", { timeout: 8000 }).catch(() => {});
  if (await P.$("#bvTemp")) await P.fill("#bvTemp", "5");
  await P.check("#bvOk"); await P.click("#bvRecvBtn"); await waitFor(() => j.ids.every(id => doc(id).stageKey === "received"), 30000);
  await open(P, j.ref); await P.waitForTimeout(400);
}
async function release(P, j, name, lines){
  const dlg = await H.attachFile(P, `sub:${j.ref}`, name, Buffer.from(lines.join("\n") + "\n"));
  await P.click("#upSave"); await P.waitForSelector("#upBox", { state: "detached", timeout: 60000 }); await waitFor(() => j.ids.every(id => (doc(id).certs || []).length), 30000);
  await open(P, j.ref); await P.waitForTimeout(600);
  return dlg;
}
const by = (j, c) => doc(j.ids[j.tags.indexOf(c)]);

(async () => {
  const browser = await launch();
  const Tc = await newUser(browser, { uid: "u_t", name: "Tech", canEdit: true, names }); await signIn(Tc, "tech1");
  await Tc.waitForTimeout(600);

  log("Submit: MET Lab job is a choice of its own");
  await H.tab(Tc, "submit");
  check((await Tc.$$eval('input[name="rKind"]', rs => rs.map(r => r.value))).join(",") === "single,batch,job,met" && /MET Lab job/.test(await text(Tc, "#regForm .seg")), "Single sample, Batch, Shift end, MET Lab job");
  await Tc.check('input[name="rKind"][value="job"]'); await Tc.waitForTimeout(200);
  check((await opts(Tc, "#jTpl")).join(",") === "mill,elution,cact" && /Shift end samples/.test(await text(Tc, "#rJob .sub-t")) && await Tc.inputValue("#rPurpose") === "plant" && await Tc.inputValue("#rSection") === "PLT", "Shift end: the plant's templates, process control from PLT");
  await Tc.check('input[name="rKind"][value="met"]'); await Tc.waitForTimeout(200);
  check((await opts(Tc, "#jTpl")).join(",") === "cact,tank,brt,preg,qaqc" && /MET Lab samples/.test(await text(Tc, "#rJob .sub-t")) && await Tc.inputValue("#rSection") === "MET", "MET Lab job: Carbon activity, Tank profile, Bottle roll, Preg-robbing test, QA/QC set, from MET");
  const pur = {};
  for (const t of ["tank", "brt", "preg", "qaqc"]){ await Tc.selectOption("#jTpl", t); await Tc.waitForTimeout(120); pur[t] = await Tc.inputValue("#rPurpose") + "/" + await Tc.inputValue("#rSection"); }
  check(pur.tank === "plant/MET" && pur.brt === "met_br/MET" && pur.preg === "met_pri/MET" && pur.qaqc === "qc/MET", "each template's purpose: " + JSON.stringify(pur));
  await Tc.check('input[name="rKind"][value="job"]'); await Tc.waitForTimeout(200);
  check(await Tc.inputValue("#jTpl") === "mill" && await Tc.inputValue("#rPurpose") === "plant" && await Tc.inputValue("#rSection") === "PLT", "back to Shift end: the Mill shift again, from PLT");

  log("The 11 CIL tanks: carbon from each on the Mill shift, drawn tank by tank");
  await jobForm(Tc, "job", "mill", "2026-10-22", "N"); await Tc.fill("#jN_n1", "50"); await Tc.fill("#jN_n2", "51"); await Tc.waitForTimeout(100);
  let cs = await codes(Tc);
  check(cs.length === 39 && cs.includes("MLNSCL1120261022") && await Tc.isChecked(`[data-jon="${cs.indexOf("MLNSCL1120261022")}"]`) && /^38 of 39/.test(await text(Tc, "#jInfo")), "39 listed, carbon from tank 11 ticked with the rest");
  const mill = await submit(Tc);
  log("A job's samples have their codes as IDs; the job's batch a site number (20 Oct)");
  check(mill.ids.every((id, i) => id === mill.tags[i]) && mill.ids.includes("MLNSCOF 20261022") && mill.ids.includes("MLNSCBST20261022#50") && !!doc("MLNSCBST20261022#50") && /^B-PLT-\d{8}-\d{4}$/.test(mill.ref) && !doc(mill.ref.slice(2)),
    "each sample's ID is its code (MLNSCOF 20261022, MLNSCBST20261022#50); the batch is " + mill.ref + ", a number no sample has");
  check(/The codes on the bags are the sample IDs/.test(await text(Tc, "#rResult")) && !/ · /.test(await text(Tc, "#rResult .label-strip")), "the submission says the codes are the IDs, each once");
  await Tc.fill("#lookupInput", "mlnscbst20261022#50"); await Tc.click("#lookupForm button[type=submit]"); await Tc.waitForTimeout(600);
  check(await text(Tc, "#view-track .sid") === "MLNSCBST20261022#50", "typed (any case) into the search box, a code with # opens its sample");
  await Tc.goto(Tc.url().split("#")[0] + "#" + encodeURIComponent("MLNSCOF 20261022")); await Tc.waitForTimeout(800);
  check(await text(Tc, "#view-track .sid") === "MLNSCOF 20261022" && decodeURIComponent(new URL(Tc.url()).hash.slice(1)) === "MLNSCOF 20261022", "a tracking link carries the code with its space, and opens it");
  await open(Tc, mill.ref); await Tc.waitForTimeout(300);
  check(!(await Tc.$$eval("#view-track table.cardy thead th", ts => ts.map(t => t.textContent))).includes("Site sample code"), "the batch page lists each ID once (no second column of the same codes)");
  await Tc.click("#bvLabels"); await Tc.waitForSelector("#labelBox .bag-label");
  const lab = await Tc.$eval("#labelBox .bag-label", l => l.textContent.replace(/\s+/g, " "));
  check(/MLNSRECA20261022/.test(lab) && !/Code/.test(lab), "a label prints the code once, as the ID"); await Tc.click("#labelClose").catch(() => Tc.keyboard.press("Escape"));
  check(by(mill, "MLNSCL1120261022").details["CIL tank"] === "11" && by(mill, "MLNSCL0320261022").details["CIL tank"] === "3", "each tank's carbon knows its tank");
  await receive(Tc, mill);
  const load = [1300, 1100, 760, 500, 390, 270, 150, 88, 68, 53, 40];
  await release(Tc, mill, "night-carbon.csv", [",,ARS12D", ",,1", ",,ppm", "Sample,Description,Au", ...load.map((v, i) => `MLNSCL${String(i + 1).padStart(2, "0")}20261022,tank ${i + 1},${v.toFixed(2)}`)]);
  await Tc.waitForSelector("#vzCarb", { timeout: 8000 }).catch(() => {});
  const cpts = await Tc.$$eval("#vzCarbC .vz-ser circle", cs => cs.length);
  check(cpts === 11 && /Carbon in the CIL tanks/.test(await text(Tc, "#vzCarb")), "the batch page draws gold on carbon for tanks 1 to 11: " + cpts + " points");
  await Tc.click("[data-bcert]"); await Tc.waitForSelector("#certBox .cert"); await Tc.waitForTimeout(200);
  check(/Carbon in the CIL tanks: gold on carbon/.test(await text(Tc, "#certBox")), "and so does the certificate"); await Tc.click("#certClose");

  log("Tank profile");
  await jobForm(Tc, "met", "tank", "2026-10-22");
  cs = await codes(Tc);
  check(cs.length === 13 && cs[0] === "MLSPPLFD20261022" && cs[1] === "MLSPTK0120261022" && cs[11] === "MLSPTK1120261022" && cs[12] === "PROCWATE20261022" && !(await Tc.isVisible("#jShift")),
    "pre-leach feed, tanks 01 to 11 and process water, codes as on the MET report; no shift");
  const tk = await submit(Tc);
  check(tk.ids.length === 13 && /Tank profile, Oct 22, 2026/.test(doc(tk.ids[0]).batchName) && doc(tk.ids[0]).section === "MET" && by(tk, "MLSPPLFD20261022").details["CIL tank"] === "Pre-leach", "one job of 13 from MET: " + doc(tk.ids[0]).batchName);
  await receive(Tc, tk);
  const FX = [1.20, 0.40, 0.30, 0.28, 0.25, 0.22, 0.20, 0.18, 0.17, 0.16, 0.15, 0.14], SX = [0.200, 0.800, 0.600, 0.450, 0.330, 0.200, 0.110, 0.070, 0.040, 0.025, 0.015, 0.008];
  const tl = [",,AAS84T,,FAA505,ISE06T,NACN,PERCENT_SOLIDS,SOL81X,SOL85W", ",,1,1,1,1,1,1,1,1", ",,mg/L,mg/L,ppm,-,mg/L,%,mg/L,mg/L", "Sample,Description,Cu,Ni,AuFA,pH,NaCN,%SOLIDS,AuSX,CNWAD",
    ...FX.map((f, i) => [i ? `MLSPTK${String(i).padStart(2, "0")}20261022` : "MLSPPLFD20261022", "slurry", i < 2 ? "6.00" : "", i < 2 ? "5.00" : "", f.toFixed(2), "11.4", "", "49.0", SX[i].toFixed(3), ""].join(",")),
    "PROCWATE20261022,process water,,,,,12,,0.002,6.00"];
  await release(Tc, tk, "tank-profile.csv", tl);
  check(by(tk, "MLSPPLFD20261022").results.rows.Cu?.raw === "6.00" && by(tk, "MLSPTK1120261022").results.rows.Au_s?.raw === "0.008" && by(tk, "PROCWATE20261022").results.rows.wad?.raw === "6.00", "every value in place, the copper on the pre-leach feed too");
  await Tc.waitForSelector("#vzTank", { timeout: 8000 }).catch(() => {});
  const tv = await text(Tc, "#vzTank");
  check(new RegExp(`Leach efficiency\\s*${pct((1.2 - 0.14) / 1.2 * 100)}`).test(tv) && /AuFx 1\.20 g\/t in the feed → 0\.14 g\/t in tank 11/.test(tv) && new RegExp(`Adsorption efficiency\\s*${pct((0.8 - 0.008) / 0.8 * 100)}`).test(tv) && /Process water\s*0\.002 mg\/L\s*WAD 6\.00 mg\/L · NaCN 12 mg\/L/.test(tv),
    `leach efficiency ${pct((1.2 - 0.14) / 1.2 * 100)} (feed to tank 11), adsorption ${pct((0.8 - 0.008) / 0.8 * 100)} (tank 1 to tank 11), process water`);
  const tp = await Tc.$$eval("#vzTank .vz-chart", cs => cs.map(c => c.querySelectorAll(".vz-ser circle").length + ":" + [...c.querySelectorAll(".vz-tick")].filter(t => /^(Feed|T\d+)$/.test(t.textContent)).length));
  check(tp.join(",") === "12:12,12:12", "two charts side by side, feed and T1 to T11: " + tp.join(","));
  await Tc.click("[data-bcert]"); await Tc.waitForSelector("#certBox .cert"); await Tc.waitForTimeout(200);
  check((await Tc.$$("#certBox .cert-fig .vz-pair svg")).length === 2 && /Leach efficiency/.test(await text(Tc, "#certBox .cert-fig")), "the certificate carries the tank profile"); await Tc.click("#certClose");

  log("Bottle roll: recovery by size, and with the masses the calculated head, tails and overall recovery");
  await jobForm(Tc, "met", "brt", "2026-10-22");
  cs = await codes(Tc);
  check(cs.length === 17 && cs[0] === "MLABPF+42520261022" && cs[6] === "MLABPF-53A20261022" && cs[7] === "MLABPF-53B20261022" && cs[8] === "MLABPT+42520261022" && cs[16] === "MLABSL0120261022" && await Tc.isVisible("#jMassH"),
    "feed and tails at +425 … −53A (wet) and −53B (dry), the filtrate MLABSL01; a mass column");
  check(/−53 µm, wet sizing/.test(await Tc.inputValue('#jRows .j-desc[data-j="6"]')) && /−53 µm, dry sizing/.test(await Tc.inputValue('#jRows .j-desc[data-j="7"]')), "−53A is the wet sizing, −53B the dry");
  await Tc.fill("#jN_n1", "7"); await Tc.waitForTimeout(100);
  check(await Tc.inputValue('#jRows .j-code[data-j="16"]') === "MLABSL0720261022", "the filtrate's number goes into its code as two digits");
  const mF = [100, 80, 60, 50, 40, 30, 120, 20], mT = [98, 79, 61, 50, 41, 29, 121, 21];
  for (let i = 0; i < 8; i++) await Tc.fill(`#jRows .j-mass[data-j="${i}"]`, String(mF[i]));
  const br = await submit(Tc);
  check(by(br, "MLABPF+42520261022").details["Mass (g)"] === "100" && by(br, "MLABPF+42520261022").details["Size fraction"] === "+425" && by(br, "MLABPT-53B20261022").details.BRT === "Tails", "the feed masses typed on the form are kept with each fraction");
  await receive(Tc, br);
  const F = [9.60, 0.40, 0.36, 0.66, 0.78, 0.66, 0.56, 6.24], T = [1.36, 0.19, 0.16, 0.30, 0.44, 0.45, 0.07, 0.45], FR = ["+425", "+212", "+150", "+106", "+75", "+53", "-53A", "-53B"];
  await release(Tc, br, "brt.csv", [",,FAA505,SOL81X", ",,1,1", ",,ppm,mg/L", "Sample,Description,AuFA,AuSX", ...FR.map((f, i) => `MLABPF${f}20261022,feed,${F[i].toFixed(2)},`), ...FR.map((f, i) => `MLABPT${f}20261022,tails,${T[i].toFixed(2)},`), "MLABSL0720261022,filtrate,,0.420"]);
  await Tc.waitForSelector("#vzBrt", { timeout: 8000 }).catch(() => {});
  let bv = await text(Tc, "#vzBrt"); if (process.env.DBG) console.log(bv.slice(0, 900));
  check(new RegExp(`\\+425 µm\\s*9\\.60\\s*1\\.36\\s*${pct((9.6 - 1.36) / 9.6 * 100)}`).test(bv) && await Tc.inputValue(`[data-brtm="${by(br, "MLABPF+42520261022").id}"]`) === "100" && /Calculated head\s*\d/.test(bv) && /Calculated tails\s*—\s*needs the tails masses/.test(bv) && /Filtrate\s*0\.420 mg\/L/.test(bv),
    "recovery by size from each fraction's grades; the head from the feed masses; the tails wait for their masses");
  const head = mF.reduce((a, m, i) => a + m * F[i], 0) / mF.reduce((a, m) => a + m, 0), tails = mT.reduce((a, m, i) => a + m * T[i], 0) / mT.reduce((a, m) => a + m, 0), rec = (head - tails) / head * 100;
  for (let i = 0; i < 8; i++) await Tc.fill(`[data-brtm="${by(br, `MLABPT${FR[i]}20261022`).id}"]`, String(mT[i]));
  await Tc.click("#brtSave"); await waitFor(() => by(br, "MLABPT+42520261022").details["Mass (g)"] === "98", 15000); await Tc.waitForTimeout(600);
  bv = await text(Tc, "#vzBrt");
  check(new RegExp(`Calculated head\\s*${head.toFixed(2)} g/t`).test(bv) && new RegExp(`Calculated tails\\s*${tails.toFixed(2)} g/t`).test(bv) && new RegExp(`Overall recovery\\s*${pct(rec)}`).test(bv) && /Masses saved: 8 samples/.test(await H.toastText(Tc)),
    `the tails masses typed on the batch page: head ${head.toFixed(2)} g/t, tails ${tails.toFixed(2)} g/t, overall recovery ${pct(rec)}`);
  check(new RegExp(`-53 µm, dry sizing.*${pct(20 * 6.24 / mF.reduce((a, m, i) => a + m * F[i], 0) * 100)}`.replace("-53", "−53")).test(bv), "and where the gold sits in the feed, fraction by fraction");
  check((await Tc.$$eval("#vzBrtC .vz-bar", b => b.length)) === 8, "recovery by size as bars");
  await Tc.click("[data-bcert]"); await Tc.waitForSelector("#certBox .cert"); await Tc.waitForTimeout(200);
  const bc = await text(Tc, "#certBox .cert-fig");
  check(/Bottle roll: recovery by size/.test(bc) && new RegExp(`\\+425 µm\\s*9\\.60\\s*1\\.36\\s*${pct((9.6 - 1.36) / 9.6 * 100)}`).test(bc) && !/Calculated head/.test(bc), "the certificate keeps to the lab's results: recovery by size from the grades (the masses are MET's)");
  await Tc.click("#certClose");

  log("Preg-robbing test: each sample against its control");
  await jobForm(Tc, "met", "preg", "2026-10-22");
  check((await codes(Tc)).length === 30, "15 samples by default: 30 solutions");
  await Tc.fill("#jC_n", "3"); await Tc.waitForTimeout(200); cs = await codes(Tc);
  check(cs.join(",") === "MLABPREG0120261022,MLABPREG0220261022,MLABPREG0320261022,MLABPREG0420261022,MLABPREG0520261022,MLABPREG0620261022" && /control for 01/.test(await Tc.inputValue('#jRows .j-desc[data-j="3"]')), "3 samples: tests 01–03, their controls 04–06");
  await Tc.fill("#jN_sp", "2.5");
  const pg = await submit(Tc);
  check(by(pg, "MLABPREG0420261022").details["Preg-rob"] === "Control" && by(pg, "MLABPREG0420261022").details["Preg-rob pair"] === "01" && by(pg, "MLABPREG0120261022").details["Spike (mg/L)"] === "2.5" && doc(pg.ids[0]).purposeKey === "met_pri", "each test and its control paired; the spike kept");
  await receive(Tc, pg);
  const tt = [0.50, 0.30, 0.10], cc = [2.40, 2.50, 2.60], pri = tt.map((t, i) => (cc[i] - t) / cc[i] * 100);
  await release(Tc, pg, "preg.csv", [",,SOL81X", ",,1", ",,mg/L", "Sample,Description,AuSX", ...[...tt, ...cc].map((v, i) => `MLABPREG${String(i + 1).padStart(2, "0")}20261022,MLABPREG${String(i + 1).padStart(2, "0")},${v.toFixed(3)}`)]);
  await Tc.waitForSelector("#vzPreg", { timeout: 8000 }).catch(() => {});
  const pv = await text(Tc, "#vzPreg");
  check(new RegExp(`average\\s*${pct(pri.reduce((a, b) => a + b) / 3)}`).test(pv) && new RegExp(`Highest\\s*${pct(pri[2])}\\s*sample 03`).test(pv) && /Spike\s*2\.5 mg\/L/.test(pv) && (await Tc.$$eval("#vzPregC .vz-bar", b => b.length)) === 3,
    `index ${pri.map(pct).join(", ")}: average, highest, the spike, bars`);
  await Tc.click("#vzPregTbl summary");
  check(new RegExp(`01\\s*MLABPREG0120261022\\s*0\\.500\\s*MLABPREG0420261022\\s*2\\.40\\s*${pct(pri[0])}`).test(await text(Tc, "#vzPregTbl")), "sample 01: its test, its control, its index");
  await Tc.click("[data-bcert]"); await Tc.waitForSelector("#certBox .cert"); await Tc.waitForTimeout(200);
  check(/Preg-robbing \(spike 2\.5 mg\/L\)/.test(await text(Tc, "#certBox")) && new RegExp(pct(pri[1])).test(await text(Tc, "#certBox .cert-fig")), "the certificate gives each index"); await Tc.click("#certClose");

  log("QA/QC set: reported as it is");
  await jobForm(Tc, "met", "qaqc", "2026-10-22");
  check((await codes(Tc)).length === 86, "45 PPS, 26 CB and 15 SL by default");
  await Tc.fill("#jC_pps", "3"); await Tc.waitForTimeout(150); await Tc.fill("#jC_cb", "2"); await Tc.waitForTimeout(150); await Tc.fill("#jC_sl", "2"); await Tc.waitForTimeout(200);
  cs = await codes(Tc);
  check(cs.join(",") === "MLABPPS0120261022,MLABPPS0220261022,MLABPPS0320261022,MLABCB0120261022,MLABCB0220261022,MLABSL0120261022,MLABSL0220261022", "3 PPS, 2 CB, 2 SL: " + cs.length);
  const qc = await submit(Tc);
  check(by(qc, "MLABCB0120261022").typeKey === "carbon" && by(qc, "MLABCB0120261022").test === "c_load" && by(qc, "MLABPPS0120261022").test === "aufx" && by(qc, "MLABSL0120261022").test === "ausx" && doc(qc.ids[0]).purposeKey === "qc", "process plant samples by fire assay, carbon by its loading, filtrates by AuSx; quality control");
  await receive(Tc, qc);
  await release(Tc, qc, "qaqc.csv", [",,ARS12D,,FAA505,,SOL81X", ",,1,2,1,2,1", ",,ppm,ppm,ppm,ppm,mg/L", "Sample,Description,Au,Au,AuFA,AuFA,AuSX",
    "MLABPPS0120261022,MLABPPS01,,,0.15,0.14,", "MLABPPS0220261022,MLABPPS02,,,0.95,0.98,", "MLABPPS0320261022,MLABPPS03,,,1.20,1.17,", "MLABCB0120261022,MLABCB01,50.80,53.57,,,", "MLABCB0220261022,MLABCB02,0.00,0.00,,,",
    "MLABSL0120261022,MLABSL01,,,,,<0.001", "MLABSL0220261022,MLABSL02,,,,,0.127"]);
  check(qc.ids.every(id => (doc(id).certs || []).length) && by(qc, "MLABPPS0220261022").results.rows.Au?.raw === "0.95" && by(qc, "MLABCB0120261022").results.rows.Au_c?.raw === "50.80" && by(qc, "MLABSL0120261022").results.rows.Au_s?.f === "ldl",
    "all 7 released on one certificate, each value as the lab reports it (below detection kept as such)");
  check(!(await Tc.$("#vzBrt")) && !(await Tc.$("#vzPreg")) && !(await Tc.$("#vzTank")), "nothing worked out: MET judges its standards");

  log("One code, two analyses: the second sample's ID takes -2");
  await jobForm(Tc, "met", "cact", "2026-10-22", "N"); await Tc.fill("#jN_n1", "50"); await Tc.waitForTimeout(100);
  check(await Tc.inputValue("#rSection") === "MET", "Carbon activity from MET under MET Lab job");
  await Tc.uncheck('[data-jon="0"]'); await Tc.uncheck('[data-jon="2"]'); await Tc.fill('#jRows .j-code[data-j="1"]', "MLNSCBST20261022#50"); await Tc.fill('#jRows .j-code[data-j="3"]', "ACME VIRGIN");
  const ca = await submit(Tc);
  check(ca.ids[0] === "MLNSCBST20261022#50-2" && doc("MLNSCBST20261022#50-2").tags[0] === "MLNSCBST20261022#50" && doc("MLNSCBST20261022#50").test === "c_load" && doc("MLNSCBST20261022#50-2").test === "c_act" && /^B-MET-\d{8}-\d{4}$/.test(ca.ref),
    "the stripped carbon already on the mill shift (loading) is sent for its activity: " + ca.ids.join(", ") + " in " + ca.ref);
  check(/ · MLNSCBST20261022#50/.test(await text(Tc, "#rResult .label-strip")), "the submission shows that one's code beside its ID");

  log("A walk-in MET Lab job (signed out)");
  const Pub = await newUser(browser, { uid: "u_pub", name: "MET runner", canEdit: false, names }); await Pub.waitForTimeout(600);
  await H.tab(Pub, "register"); await Pub.check('input[name="rKind"][value="met"]'); await Pub.waitForTimeout(200);
  await Pub.selectOption("#jTpl", "preg"); await Pub.fill("#jDate", "2026-10-23"); await Pub.dispatchEvent("#jDate", "change"); await Pub.fill("#jC_n", "2"); await Pub.waitForTimeout(200);
  await Pub.fill("#rSubmitter", "MET runner"); await Pub.fill("#rHandTo", "Lab Technician A"); await Pub.fill("#rHandBadge", "B-101");
  await Pub.click("#rSubmit"); await Pub.waitForSelector("#rResult code", { timeout: 30000 }).catch(() => {});
  const pub = await Pub.$$eval("#rResult code", els => els.map(e => e.textContent));
  check(pub.join(",") === "MLABPREG0120261023,MLABPREG0220261023,MLABPREG0320261023,MLABPREG0420261023" && /^B-MET-\d{8}-\d{4}$/.test(doc("MLABPREG0120261023")?.batchId || "") && doc("MLABPREG0420261023")?.createdBy === "public",
    "registered at the lab without signing in: 4 samples with their codes as IDs, in " + (doc("MLABPREG0120261023")?.batchId || "no batch") + (pub.length ? "" : " (" + await H.toastText(Pub) + ")"));

  log("Phone");
  await Tc.setViewportSize({ width: 390, height: 844 }); await H.tab(Tc, "submit"); await Tc.check('input[name="rKind"][value="met"]'); await Tc.waitForTimeout(300);
  const sw1 = await Tc.evaluate(() => document.documentElement.scrollWidth);
  await open(Tc, br.ref); await Tc.waitForTimeout(700);
  const sw2 = await Tc.evaluate(() => document.documentElement.scrollWidth);
  await open(Tc, tk.ref); await Tc.waitForTimeout(700);
  const sw3 = await Tc.evaluate(() => document.documentElement.scrollWidth);
  check(sw1 <= 392 && sw2 <= 392 && sw3 <= 392, `no sideways scroll: Submit ${sw1}, bottle roll ${sw2}, tank profile ${sw3}`);
  await Tc.setViewportSize({ width: 1280, height: 900 });

  console.log("\nConsole errors:", JSON.stringify(errors));
  await browser.close();
})().catch(e => { console.error(e); console.log("Console errors:", JSON.stringify(H.errors)); process.exit(1); });
