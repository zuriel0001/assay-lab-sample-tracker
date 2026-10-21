// v24d (21 Oct): "change the name Shift Job to Shift End"; under Shift end or MET Lab job "the Section … should display only the applicable
// sections … MET jobs comes from the Met department. Shift end comes from PP"; and a results file whose codes are this batch's with another
// date in them (a report of the 19th on a batch whose codes were made with the 20th) is said so, and read as this batch's only when the
// technician chooses. A file naming none of a batch's samples is no longer called unreadable; it is released with only when the technician
// says so. A report's letterhead row (the lab's name, phone, dates) is not taken for its first reading. Values here are made up.
// Run: NODE_PATH=$(npm root -g) timeout 590 node v29-tests.js
process.env.V24 = "1";
const H = require("./harness");
const { errors, newUser, launch, signIn, open, doc, waitFor } = H;
const names = {};
const log = (...a) => console.log("•", ...a);
const check = (cond, msg) => { console.log(cond ? "  PASS" : "  FAIL", msg); if (!cond) process.exitCode = 1; };
const text = async (page, sel) => ((await page.textContent(sel).catch(() => "")) || "").replace(/\s+/g, " ").trim();
const live = o => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v != null).map(([k, v]) => [k, v.raw]));
const opts = (P, sel) => P.$$eval(sel + " option", os => os.map(o => o.value).filter(Boolean));
const kinds = P => P.$$eval('input[name="rKind"]', rs => rs.map(r => r.value));
const today = () => { const d = new Date(Date.now()); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

async function jobForm(P, kind, tpl, date){
  await H.tab(P, "submit"); if (await P.$("#rAgain")) await P.click("#rAgain");
  await P.check(`input[name="rKind"][value="${kind}"]`); await P.waitForTimeout(200);
  await P.selectOption("#jTpl", tpl); await P.waitForTimeout(150);
  if (date){ await P.fill("#jDate", date); await P.dispatchEvent("#jDate", "change"); await P.waitForTimeout(150); }
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
/* A report laid out as the lab's LIMS prints it, with its letterhead on the first row. */
const report = (rows, day) => Buffer.from([
  `Test Report,Example Laboratory Ltd,Phone: 000 000 0000,${day},Total Samples:,${rows.length},Page 1 of 1`,
  "",
  ",,,FAA505,SOL81X,ISE06T",
  ",,,ppm,mg/L,-",
  ",,,AuFA,AuSX,pH",
  ...rows.map((r, i) => `${2300000 + i},${r[0]},${r[1]},${r[2]},${r[3]},11.4`)].join("\n") + "\n");

(async () => {
  const browser = await launch();
  const Tc = await newUser(browser, { uid: "u_t", name: "Tech", canEdit: true, names }); await signIn(Tc, "tech1");
  await Tc.waitForTimeout(600);

  log("Submit › Shift end (was Shift job) and MET Lab job, each from its own section");
  await H.tab(Tc, "submit"); await Tc.check('input[name="rKind"][value="single"]'); await Tc.waitForTimeout(200);
  const labels = await Tc.$$eval("#regForm .seg label span", ss => ss.map(s => s.textContent.trim()).join(", "));
  check(labels === "Single sample, Batch, Shift end, MET Lab job", "the four ways to submit: " + labels);
  const allSec = await opts(Tc, "#rSection");
  await Tc.selectOption("#rType", "rc"); await Tc.waitForTimeout(150);   // a sample type chosen first does not narrow a job's purposes
  await Tc.check('input[name="rKind"][value="job"]'); await Tc.waitForTimeout(250);
  check((await opts(Tc, "#rSection")).join(",") === "PLT" && await Tc.inputValue("#rSection") === "PLT" && /Shift end samples/.test(await text(Tc, "#rJob .sub-t")), "Shift end: Section lists only the process plant, chosen: " + (await opts(Tc, "#rSection")).join(","));
  check(await Tc.inputValue("#rPurpose") === "plant", "Shift end: process control filled in, whatever sample type was chosen before");
  await Tc.check('input[name="rKind"][value="met"]'); await Tc.waitForTimeout(250);
  check((await opts(Tc, "#rSection")).join(",") === "MET" && await Tc.inputValue("#rSection") === "MET", "MET Lab job: Section lists only the MET Lab");
  await Tc.selectOption("#jTpl", "qaqc"); await Tc.waitForTimeout(150);
  check(await Tc.inputValue("#rPurpose") === "qc" && await Tc.inputValue("#jDate") === today(), "the QA/QC set: quality control, its codes dated today (a job without a shift)");
  await Tc.selectOption("#jTpl", "tank"); await Tc.waitForTimeout(150);
  check(await Tc.inputValue("#rPurpose") === "plant" && await Tc.inputValue("#jDate") === today(), "the tank profile: process control, dated today");
  await Tc.check('input[name="rKind"][value="single"]'); await Tc.waitForTimeout(250);
  check((await opts(Tc, "#rSection")).length > 3 && (await opts(Tc, "#rSection")).join() === (await Tc.$$eval("#rSection option", os => os.map(o => o.value).filter(Boolean))).join(), "back to a single sample: the sample type's sections again (" + (await opts(Tc, "#rSection")).length + ")");
  check(allSec.length >= (await opts(Tc, "#rSection")).length, "the type's sections are no more than all of them");

  log("A section account sees the kinds its section sends");
  const Pp = await newUser(browser, { uid: "u_p", name: "Plant", canEdit: true, names }); await signIn(Pp, "plant"); await H.tab(Pp, "submit"); await Pp.waitForTimeout(300);
  check((await kinds(Pp)).join(",") === "single,batch,job", "the process plant: Single sample, Batch, Shift end (no MET Lab job): " + (await kinds(Pp)).join(","));
  const Ex = await newUser(browser, { uid: "u_x", name: "Exp", canEdit: true, names }); await signIn(Ex, "exp"); await H.tab(Ex, "submit"); await Ex.waitForTimeout(300);
  check((await kinds(Ex)).join(",") === "single,batch", "exploration: Single sample and Batch only");

  log("A report whose codes carry another date");
  await jobForm(Tc, "met", "tank", "2026-10-23");
  await Tc.uncheck('[data-jon="11"]');   // tank 11 not in use
  const tk = await submit(Tc);
  check(tk.ids.length === 12 && tk.ids[1] === "MLSPTK0120261023" && /^B-MET-/.test(tk.ref), "12 samples dated the 23rd in " + tk.ref);
  await receive(Tc, tk);
  const rows = [["MLSPPLFD20261022", "Pre Leach", "1.10", "0.210"], ...Array.from({ length: 10 }, (_, i) => [`MLSPTK${String(i + 1).padStart(2, "0")}20261022`, `Tank ${i + 1}`, (0.4 - i * 0.025).toFixed(2), (0.8 / (i + 1)).toFixed(3)]), ["PROCWATE20261022", "Process water", "", "0.002"]];
  let dlg = await H.attachFile(Tc, `sub:${tk.ref}`, "Tank profile 22 Oct.csv", report(rows, "2026-10-23"));
  check(!/doesn't name its samples/.test(dlg) && /None of this batch's samples is in this file as its codes stand/.test(dlg) && /It names 12 samples/.test(dlg), "not called unreadable: none of the batch's samples is in it as the codes stand, it names 12 (the letterhead row is not a reading)");
  check(/Oct 22, 2026 in the file, Oct 23, 2026 here \(12 of 12 samples\)/.test(dlg) && await Tc.$eval("#upSave", b => b.disabled), "the dates said (22nd in the file, 23rd here); Save waits for a choice");
  await Tc.click("#upAlias"); await Tc.waitForTimeout(300);
  check(/Read with the file's codes dated Oct 22, 2026 for 12 samples dated Oct 23, 2026/.test(await text(Tc, "#upBox")) && !(await Tc.$eval("#upSave", b => b.disabled)), "read as this batch's: said, Save open");
  await Tc.click("#upSave"); await Tc.waitForSelector("#upBox", { state: "detached", timeout: 60000 }); await waitFor(() => tk.ids.every(id => (doc(id).certs || []).length), 30000);
  const t1 = doc("MLSPTK0120261023");
  check(live(t1.results?.rows).Au === "0.40" && live(t1.results?.rows).Au_s === "0.800" && tk.ids.every(id => Object.keys(live(doc(id).results?.rows)).length), "every sample has its values: tank 1 AuFx 0.40, AuSx 0.800");
  check((t1.history || []).some(h => /the file names it MLSPTK0120261022, its code dated Oct 22, 2026/.test(h.note || "")), "the record says which code of the file was read as it");
  await open(Tc, tk.ref); await Tc.waitForTimeout(600);
  check(/Leach efficiency/.test(await text(Tc, "#vzTank")) && /MET Lab final samples \(one report\)/i.test(await text(Tc, "#bwBox h3")), "the tank profile is drawn; the workflow says MET Lab final samples (one report)");
  check(!/Plant shift job/.test(await text(Tc, "#view-track")), "nothing says Plant shift job");

  log("A file naming none of the batch's samples");
  await jobForm(Tc, "met", "preg", "2026-10-23"); await Tc.fill("#jC_n", "2"); await Tc.waitForTimeout(200);
  const pg = await submit(Tc); await receive(Tc, pg);
  dlg = await H.attachFile(Tc, `sub:${pg.ref}`, "other.csv", report([["BOTTLE-17", "Other job", "", "0.500"], ["BOTTLE-18", "Other job", "", "0.600"]], "2026-10-23"));
  check(/None of this batch's samples is in this file\./.test(dlg) && /Check that it is the right file/.test(dlg) && !(await Tc.$("#upAlias")) && await Tc.$eval("#upSave", b => b.disabled), "said plainly, no date offered, Save waits");
  await Tc.check("#upAnyway"); await Tc.waitForTimeout(200);
  check(!(await Tc.$eval("#upSave", b => b.disabled)), "kept as the results anyway once ticked");
  await Tc.click("#upSave"); await Tc.waitForSelector("#upBox", { state: "detached", timeout: 60000 }); await waitFor(() => pg.ids.every(id => (doc(id).certs || []).length), 30000);
  check(pg.ids.every(id => !Object.keys(live(doc(id).results?.rows)).length && doc(id).results?.file), "released with the file, without values");

  log("Shift end on the workflow, the record and the routes");
  await jobForm(Tc, "job", "elution", "2026-10-23");
  const el = await submit(Tc);
  await open(Tc, el.ref); await Tc.waitForTimeout(500);
  check(/Shift end \(one report\)/i.test(await text(Tc, "#bwBox h3")), "an elution run's batch: Shift end (one report)");
  await open(Tc, el.ids[0]); await Tc.waitForTimeout(500);
  check(await text(Tc, "#view-track .sid") === "MLSPE06020261023" && await Tc.inputValue("#lookupInput") === "MLSPE06020261023", "an elution run's code (letters and eleven digits) opens its sample, not rewritten as a site ID");
  check(/Shift end \(one report\)/.test(await text(Tc, "#view-track")) && !/Plant shift job/.test(await text(Tc, "#view-track")), "its record: Shift end (one report)");
  await H.tab(Tc, "routes"); await Tc.waitForTimeout(400);
  check(/Shift end or MET Lab job \(one report\)/.test(await text(Tc, "#view-routes")), "Routes: Shift end or MET Lab job (one report)");

  await open(Tc, el.ref); await Tc.waitForTimeout(500);
  await Tc.click('#view-track [data-open="MLSPH12020261023"]', { timeout: 8000 }); await Tc.waitForTimeout(800);
  check(await text(Tc, "#view-track .sid") === "MLSPH12020261023", "and a click on one in its batch's list opens it");
  await Tc.fill("#lookupInput", "plt202610210001"); await Tc.press("#lookupInput", "Enter"); await Tc.waitForTimeout(400);
  check(await Tc.inputValue("#lookupInput") === "PLT-20261021-0001", "a site ID typed without its dashes is still read as one");

  log("Phone");
  await Tc.setViewportSize({ width: 390, height: 844 });
  await jobForm(Tc, "met", "tank", "2026-10-24");
  check(await Tc.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1) && (await opts(Tc, "#rSection")).join(",") === "MET", "the MET Lab job on a phone: no sideways scroll, MET only");
  await Tc.setViewportSize({ width: 1280, height: 900 });

  console.log("Console errors:", JSON.stringify(errors));
  check(!errors.length, "no console errors");
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
