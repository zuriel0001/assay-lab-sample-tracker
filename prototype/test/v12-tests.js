// v12: the fixes from the second independent review. Number reading, one lab batch per method with QC on every result it checks,
// action and permit limits, four eyes, checked amendments, paste, calculated results, CRM trend rules, prep blanks, plant routing,
// certificate check codes, section accounts and the upgrade of version 11 records. Several users on one shared store (see harness.js).
// Run: NODE_PATH=$(npm root -g) timeout 590 node v12-tests.js
const H = require("./harness");
const { store, errors, newUser, launch, signIn, fillForm, ids, open, doc, toastText, batchDoc, waitFor, createBatch, fillBatch, saveBatch, visibleTabs, broadcast, clone } = H;
const OUT = __dirname;
const names = { u_z: "Zuriel" };
const log = (...a) => console.log("•", ...a);
const check = (cond, msg) => { console.log(cond ? "  PASS" : "  FAIL", msg); if (!cond) process.exitCode = 1; };

async function receipt(page, id){ await open(page, id); await page.click('[data-receipt="confirm"]'); await waitFor(() => doc(id).stageKey === "received"); await page.waitForTimeout(400); }
const next = async (page, n = 1) => { for (let i = 0; i < n; i++){ const id = (await page.textContent(".sid")).trim(), k = doc(id).stageKey; await page.click('[data-step="next"]'); await waitFor(() => doc(id).stageKey !== k, 4000); await page.waitForTimeout(350); } };
/* Walks one sample on its record until it reaches the step. */
async function walkTo(page, id, key){
  await open(page, id);
  for (let g = 0; g < 16 && doc(id).stageKey !== key; g++){ const k = doc(id).stageKey; await page.click('[data-step="next"]'); await waitFor(() => doc(id).stageKey !== k, 4000); await page.waitForTimeout(300); }
  return doc(id).stageKey === key;
}
const showBatch = async (page, id) => { await page.click('#tabs button[data-tab="batches"]'); await page.waitForSelector(`[data-bsel="${id}"]`, { timeout: 5000 }); await page.click(`[data-bsel="${id}"]`); await page.waitForSelector("#batchBox", { timeout: 5000 }); await page.waitForTimeout(200); };
async function groupMove(page, sids, toKey){
  for (let g = 0; g < 15; g++){ const k = doc(sids[0]).stageKey; if (k === toKey) return true; await page.click(`[data-bmove="${k}"]`); await waitFor(() => sids.every(id => doc(id).stageKey !== k), 6000); await page.waitForTimeout(300); }
  return doc(sids[0]).stageKey === toKey;
}
const posOf = (b, pred) => batchDoc(b).pos.find(pred);
const labOf = (id, p) => (doc(id).labs || {})[p] || null;
/* What a number box says it will read: a scratch box with the same attributes as a result box. */
const hint = (page, v, ul) => page.evaluate(([v, ul]) => {
  let el = document.getElementById("__num");
  if (!el){ const w = document.createElement("label"); w.innerHTML = '<input id="__num" data-num data-dl="0.005">'; document.body.append(w); el = document.getElementById("__num"); }
  if (ul) el.dataset.ul = ul; else delete el.dataset.ul;
  el.value = v; el.dispatchEvent(new Event("input", { bubbles: true }));
  const h = el.parentElement.querySelector(".numhint"); return { t: h.textContent, bad: h.classList.contains("bad") };
}, [v, ul || ""]);
/* The certificate check code, worked out here the same way, so a copy can be verified against its content. */
function certCode(sid, c){
  const body = JSON.stringify([sid, c.no, c.at, c.by, (c.an || []).map(a => [a.k, a.u]), Object.keys(c.rows || {}).sort().map(k => [k, c.rows[k].raw])]);
  const h = seed => { let x = seed; for (const ch of body){ x ^= ch.codePointAt(0); x = Math.imul(x, 0x01000193) >>> 0; } return x.toString(16).padStart(8, "0"); };
  return (h(0x811c9dc5) + h(0x2f6b1a3d)).toUpperCase().match(/.{4}/g).join("-");
}

(async () => {
  // Settings saved by version 11: two reference material rows (one edited), no limits, no section accounts.
  // v22: qcStep added, since this suite is written around the QA/QC review step.
  store["settings/stages"] = { qcStep: true, schema: 11, tz: "Africa/Accra", resultsPublic: false, routes: [], removed: [],
    sections: [{ code: "MET", name: "Metallurgy" }, { code: "EXP", name: "Exploration" }, { code: "GEO", name: "Geology" }, { code: "PLT", name: "Process plant" }],
    users: [{ u: "admin", name: "Lab Manager", role: "admin", pw: "admin123" }, { u: "super", name: "Lab Supervisor", role: "super", pw: "super123" }, { u: "tech1", name: "Lab Technician A", role: "tech", pw: "tech123" }, { u: "tech2", name: "Lab Technician B", role: "tech", pw: "tech123" }, { u: "viewer", name: "Site Viewer", role: "viewer", pw: "view123" }],
    crms: [{ id: "STD-AU-LOW", name: "Low-grade gold ore", an: "Au", u: "g/t", val: 0.52, sd: 0.025, use: "FA, GC, PT, SF" }, { id: "CN-WAD-10", name: "WAD cyanide check standard", an: "wad", u: "mg/L", val: 10, sd: 0, use: "CY" }] };
  const browser = await launch();
  require("./harness").useOldRoutes();   // v23: this suite is written around the routes in use before version 23
  const P = await newUser(browser, { uid: "u_p", name: "Public", canEdit: true, names });
  const Tc = await newUser(browser, { uid: "u_t", name: "Tech", canEdit: true, names }); await signIn(Tc, "tech1");
  const Sv = await newUser(browser, { uid: "u_s", name: "Super", canEdit: true, names }); await signIn(Sv, "super");
  const Ad = await newUser(browser, { uid: "u_a", name: "Admin", canEdit: true, names }); await signIn(Ad, "admin");
  await P.waitForTimeout(1500);

  log("Settings saved by version 11");
  await Ad.click('[data-tab="stages"]'); await H.cfgTab(Ad, "crms"); await Ad.waitForSelector("[data-cf]");
  const crmIds = await Ad.$$eval('[data-cf="id"]', es => es.map(e => e.value));
  const useOf = await Ad.$$eval('[data-cf="use"]', es => es.map(e => e.value));
  check(crmIds.length === 49 && crmIds.filter(x => x === "STD-ICP-LOW").length === 8 && useOf[crmIds.indexOf("CN-WAD-10")] === "CY, EW", "reference materials keep the saved rows and gain the multi-element rows; a saved row takes the batch types now listed for it");
  check(await Ad.$$eval("[data-lf=act]", e => e.length) === 40 && /Example values/.test(await Ad.textContent("#view-stages")), "the action and permit limits table lists the 40 default limits, marked as example values");
  check(await Ad.$$eval('[data-uf="sec"]', e => e.length) === 2, "the two section accounts are added, each with its section");

  log("Numbers: the dot is the decimal mark, a comma is read only where it means one thing");
  const hs = {};
  for (const v of ["0,85", "12,5", "1,500.5", "2,000,000", "1.234,5", "1,500", "1.5", "abc", "<0.005", "12.4"]) hs[v] = await hint(Tc, v, v === "12.4" ? "10" : "");
  check(hs["0,85"].t === "reads as 0.85" && hs["12,5"].t === "reads as 12.5" && hs["1,500.5"].t === "reads as 1500.5" && hs["2,000,000"].t === "reads as 2000000" && hs["1.234,5"].t === "reads as 1234.5", "a decimal comma or thousands separators that can mean one thing are read, and the box says how: " + JSON.stringify([hs["0,85"].t, hs["1,500.5"].t, hs["1.234,5"].t]));
  check(hs["1,500"].bad && /1500 or 1\.5/.test(hs["1,500"].t), "1,500 could be 1500 or 1.5: flagged for the technician to retype: " + hs["1,500"].t);
  check(hs["1.5"].t === "" && hs["abc"].bad && hs["<0.005"].t === "below detection" && hs["12.4"].bad && /over the range/.test(hs["12.4"].t), "plain numbers say nothing; text, below detection and over range are shown");

  log("Fire assay batch: ambiguous commas, prep blank, results file with a unit column");
  await fillForm(P, "submit", { section: "EXP", submitter: "Esi", count: 3 }); const ex = await ids(P);
  for (const id of ex) await receipt(Tc, id);
  const b1 = await createBatch(Tc, "fa50", ex); await groupMove(Tc, ex, "weigh"); await showBatch(Tc, b1);
  check(/preparation blank is below 10× and the analytical blank below 5× the detection limit \(0\.05 g\/t and 0\.025 g\/t Au\)/.test(await Tc.textContent("#batchBox")), "the QC rule gives the preparation blank its own, wider limit");
  const pb = posOf(b1, x => x.t === "pb"), bl = posOf(b1, x => x.t === "bl");
  await fillBatch(Tc, b1, sid => sid === ex[0] ? "1,500" : "0,80");
  await Tc.click("#bSave"); await Tc.waitForTimeout(500);
  check(/could be 1500 or 1\.5\. Retype it without the comma/.test(await toastText(Tc)) && !batchDoc(b1).qc, "a batch with 1,500 typed is not saved; the message says why");
  check(await Tc.$eval("#bp_" + posOf(b1, x => x.t === "s" && x.sid === ex[0]).p, e => e.parentElement.querySelector(".numhint")?.classList.contains("bad")), "the box itself shows the ambiguity");
  await H.attachFile(Tc, `batch:${b1}`, "fa-export.csv", `Sample ID,Au (g/t),Unit\n${ex[0]},0.81,g/t\n${ex[0]},0.83,g/t\n`); await H.saveAttach(Tc);
  const o0 = posOf(b1, x => x.t === "s" && x.sid === ex[0]).p, d0 = posOf(b1, x => (x.t === "pd" || x.t === "cd") && x.of === ex[0]);
  const pv = await Tc.$eval("#bp_" + o0, e => e.value), dv = d0 ? await Tc.$eval("#bp_" + d0.p, e => e.value) : "0.83";
  check(pv === "0.81" && dv === "0.83", `an export with a header row and a unit column fills the sample, then its duplicate (${pv}, ${dv})`);
  await Tc.fill("#bp_" + pb.p, "0.04"); await Tc.fill("#bp_" + bl.p, "<DL");
  await Tc.fill("#bp_" + o0, "0.81"); if (d0) await Tc.fill("#bp_" + d0.p, "0.81");
  const q1 = await saveBatch(Tc, b1);
  const pbc = q1.checks.find(c => c.p === pb.p);
  check(q1.status === "pass" && pbc.verdict === "pass" && pbc.lim === 0.05, "prep blank at 8× the detection limit passes (its limit is 10×)");
  check(doc(ex[1]).results.rows.Au.v === 0.8 && doc(ex[1]).results.rows.Au.raw === "0,80" && doc(ex[1]).results.rows.Au.by === "tech1", "a decimal comma is saved as 0.8, keeping what was typed and who entered it");
  check(ex.every(id => labOf(id, "fa50")?.b === b1 && labOf(id, "fa50").q === "pass" && doc(id).lbs.join() === b1), "each sample records its batch by batch type");

  log("Four eyes");
  await groupMove(Tc, ex, "qc");
  await open(Sv, ex[0]); await next(Sv, 1);
  check(doc(ex[0]).stageKey === "released" && doc(ex[0]).certs[0].role === "super" && doc(ex[0]).certs[0].ents.join() === "tech1", "a supervisor who did not enter the results releases them");
  // The supervisor enters a batch themselves: the record holds the release.
  await fillForm(P, "submit", { section: "EXP", submitter: "Self", count: 1 }); const [sx] = await ids(P);
  await receipt(Sv, sx);
  const b2 = await createBatch(Sv, "fa50", [sx]); await groupMove(Sv, [sx], "weigh"); await showBatch(Sv, b2);
  await fillBatch(Sv, b2, () => "1.10"); await saveBatch(Sv, b2); await showBatch(Sv, b2); await groupMove(Sv, [sx], "qc");
  await showBatch(Sv, b2);
  check(/1 with results you entered wait for another supervisor/.test(await Sv.textContent("#batchBox")) && await Sv.$eval("#bRelease", b => b.disabled), "on the batch, the supervisor can't release results they entered");
  await open(Sv, sx);
  check(await Sv.$eval('[data-step="next"]', b => b.disabled) && /You entered results on this sample/.test(await Sv.textContent("#holdNote")), "on the record, the release is held with the reason");
  await open(Ad, sx); await Ad.click('[data-step="next"]'); await waitFor(() => (doc(sx).certs || []).length);
  check(doc(sx).stageKey === "released" && !doc(sx).certs[0].self && doc(sx).certs[0].ents.join() === "super", "the lab manager, who did not enter them, releases them without being asked for a reason");
  // The admin enters and releases their own: a recorded reason is required.
  await fillForm(P, "submit", { section: "EXP", submitter: "Own", count: 1 }); const [ax] = await ids(P);
  await receipt(Ad, ax);
  const b3 = await createBatch(Ad, "fa50", [ax]); await groupMove(Ad, [ax], "weigh"); await showBatch(Ad, b3);
  await fillBatch(Ad, b3, () => "2.20"); await saveBatch(Ad, b3); await showBatch(Ad, b3); await groupMove(Ad, [ax], "qc");
  await open(Ad, ax); await Ad.click('[data-step="next"]'); await Ad.waitForTimeout(400);
  check(doc(ax).stageKey === "qc" && /reason for releasing them yourself/.test(await toastText(Ad)), "the lab manager releasing results they entered is asked for the reason");
  await Ad.fill("#selfWhy", "Night shift, no second supervisor on site"); await Ad.click('[data-step="next"]'); await waitFor(() => (doc(ax).certs || []).length);
  const ac = doc(ax).certs[0];
  check(ac.self === "Night shift, no second supervisor on site" && ac.role === "admin" && /Released by the person who entered the results/.test(doc(ax).history.at(-1).note), "the reason is on the certificate and in the chain of custody");

  log("Certificate: releaser's role and check code");
  await open(Ad, ax); await Ad.click(`[data-cert="${ac.v}"]`); await Ad.waitForSelector("#certBox:not([hidden]) .cert");
  const ct = await Ad.textContent("#certBox .cert");
  check(/Lab Manager, lab manager/.test(ct) && ct.includes(ac.code) && /Released by a person who also entered results: Night shift/.test(ct), "the certificate names the lab manager's real role, prints the check code and the four-eyes exception");
  await Ad.click("#certClose");
  check(ac.code === certCode(ax, ac) && certCode(ax, { ...ac, rows: { Au: { ...ac.rows.Au, raw: "2.30" } } }) !== ac.code, "the check code is worked out from the certificate's content: changing a result changes it");
  await open(P, ax);
  check((await P.textContent("#resPanel")).includes(ac.code) && !/2\.200/.test(await P.textContent("#resPanel")), "without signing in, the record shows the certificate number and check code but no values");

  log("Amendments go through the same checks and a second person");
  const am = ex[0];
  await open(Tc, am); await Tc.click("#amBox summary");
  await Tc.fill("#am_Au", ""); await Tc.fill("#amWhy", "typo"); await Tc.click("#amBtn"); await Tc.waitForTimeout(300);
  check(/can't be left empty/.test(await toastText(Tc)) && !doc(am).amend, "clearing a reported result is refused");
  await Tc.fill("#am_Au", "25"); await Tc.click("#amBtn"); await Tc.waitForTimeout(300);
  check(/over the method's range/.test(await toastText(Tc)) && !doc(am).amend, "an amended value over the method's range is refused (re-assay instead)");
  await Tc.fill("#am_Au", "1,500"); await Tc.click("#amBtn"); await Tc.waitForTimeout(300);
  check(/could be 1500 or 1\.5/.test(await toastText(Tc)) && !doc(am).amend, "an ambiguous comma is refused here too");
  await Tc.fill("#am_Au", "0.86"); await Tc.click("#amBtn"); await waitFor(() => doc(am).amend);
  check(doc(am).certs.length === 1 && doc(am).amend.by === "tech1" && doc(am).amend.rows.Au.v === 0.86, "a technician proposes the amendment; the certificate is not replaced yet");
  await open(Tc, am);
  check(!(await Tc.$("#amApprove")) && /Amendment proposed/.test(await Tc.textContent("#amPend")), "the technician can't approve it");
  const fromFile = doc(am).results.rows.Au.src;
  await open(Sv, am); await Sv.click("#amApprove"); await waitFor(() => doc(am).certs.length === 2);
  const r2 = doc(am).certs[1];
  check(fromFile === "file" && doc(am).results.rows.Au.v === 0.86 && doc(am).results.rows.Au.by === "tech1" && !doc(am).results.rows.Au.src, "v18: the approved value, read from a file before, is saved as typed by the technician who proposed it");
  check(r2.amends === am + "-R1" && r2.amendBy.by === "tech1" && r2.by === "super" && r2.rows.Au.v === 0.86 && r2.code !== doc(am).certs[0].code && !doc(am).amend, "a supervisor approves: R2 records who proposed and who approved, with a new check code");
  // The lab manager approving their own proposal gives a reason.
  await open(Ad, ax); await Ad.click("#amBox summary"); await Ad.fill("#am_Au", "2.25"); await Ad.fill("#amWhy", "Weighing transcription"); await Ad.click("#amBtn"); await waitFor(() => doc(ax).amend);
  await open(Ad, ax); await Ad.click("#amApprove"); await Ad.waitForTimeout(300);
  check(/reason for approving it yourself/.test(await toastText(Ad)) && doc(ax).certs.length === 1, "the lab manager approving their own amendment is asked for the reason");
  await Ad.fill("#amSelfWhy", "Only approver on site"); await Ad.click("#amApprove"); await waitFor(() => doc(ax).certs.length === 2);
  check(doc(ax).certs[1].self === "Only approver on site", "and the reason is printed on the amended certificate");

  log("CIL survey: two batches (solution and carbon), action limit, coverage on the certificate");
  await fillForm(P, "submit", { section: "PLT", type: "cil_slurry", purpose: "plant", submitter: "Shift met" }); const [cs] = await ids(P);
  await receipt(Tc, cs);
  check(doc(cs).route === "CIL-SVY" && JSON.stringify(doc(cs).qcg) === JSON.stringify([{ p: "soln", k: ["Au_s"] }, { p: "carbon", k: ["Au_c"] }]), "a CIL survey joins a solution run for solution gold and a carbon batch for carbon gold");
  await Tc.click('[data-tab="batches"]'); await Tc.waitForSelector("#nbProf");
  const opts = await Tc.$$eval("#nbProf option", os => os.map(o => o.value + ":" + o.disabled));
  check(opts.includes("soln:false") && opts.includes("carbon:false"), "it is offered for both batch types");
  const bs = await createBatch(Tc, "soln", [cs]); await groupMove(Tc, [cs], "field"); await showBatch(Tc, bs);
  await fillBatch(Tc, bs, () => "0.030"); await saveBatch(Tc, bs);
  check(labOf(cs, "soln")?.q === "pass" && doc(cs).results.rows.Au_s.v === 0.03 && !labOf(cs, "carbon"), "solution run passes and writes the solution gold");
  await walkTo(Tc, cs, "calc");
  await open(Tc, cs);
  const hold1 = await Tc.textContent("#holdNote").catch(() => "");
  check(/carbon assay batch for gold on carbon/i.test(hold1) || /carbon/i.test(hold1), "QA/QC review waits for the carbon batch: " + hold1.trim());
  const bc = await createBatch(Tc, "carbon", [cs]); await showBatch(Tc, bc);
  await fillBatch(Tc, bc, () => "850"); await saveBatch(Tc, bc);
  check(labOf(cs, "carbon")?.q === "pass" && doc(cs).results.rows.Au_c.v === 850 && doc(cs).results.rows.Au_s.v === 0.03 && doc(cs).labQc === "pass", "carbon batch passes; both results are on the sample");
  await open(Tc, cs);
  if (!(await Tc.$eval("#resBox", d => d.open))) await Tc.click("#resBox summary");
  check(!(await Tc.$("#rs_Au_s")) && !(await Tc.$("#rs_Au_c")) && await Tc.$("select#rs_pt"), "results from batches are not typed again; the sampling point is chosen from a list");
  await Tc.selectOption("#rs_pt", "Last tank");
  for (const [k, v] of [["cc", "0.6"], ["cn", "180"], ["pH", "10.4"], ["sol", "45"]]) await Tc.fill("#rs_" + k, v);
  await Tc.click("#rsSave"); await waitFor(() => doc(cs).results.rows.pt); await Tc.waitForTimeout(400);
  await open(Tc, cs);
  { const t = await Tc.textContent("#alertBox").catch(() => ""); check(/Solution gold 0\.030 mg\/L is above the action limit of 0\.02 mg\/L \(Last tank\)/.test(t), "solution gold in the last tank above 0.02 mg/L raises the action limit alert: " + t.trim().slice(0, 160)); }
  await Tc.click('[data-tab="board"]'); await Tc.waitForTimeout(400);
  check((await Tc.textContent("#bdAlerts")).includes(cs), "the board lists the sample under results past a limit");
  await walkTo(Tc, cs, "qc");
  await open(Sv, cs);
  check(await Sv.$eval('[data-step="next"]', b => b.disabled) && /Record what was done/.test(await Sv.textContent("#holdNote")), "the release waits until someone records what was done");
  await open(Tc, cs); await Tc.fill("#ackNote", "Re-assayed 0.029 mg/L; plant metallurgist told by radio 14:20"); await Tc.click("#ackBtn"); await waitFor(() => (doc(cs).acks || []).length);
  await open(Sv, cs); await next(Sv, 1);
  const cc = doc(cs).certs?.[0];
  check(cc && cc.cov.Au_s === bs && cc.cov.Au_c === bc && cc.cov.cn === "" && cc.batch === `${bs}, ${bc}` && /plant metallurgist told/.test(cc.alerts[0].ack.note), "certificate: each result names its batch (or none), and the alert with what was done");
  await open(Sv, cs); await Sv.click(`[data-cert="${cc.v}"]`); await Sv.waitForSelector("#certBox:not([hidden]) .cert");
  const cct = await Sv.textContent("#certBox .cert");
  check(/Lab batches/.test(cct) && /Not in a lab batch/.test(cct) && /action limit/.test(cct), "the certificate shows the quality control behind each result");
  await Sv.click("#certClose");

  log("ICP: one batch checks all eight elements");
  await fillForm(P, "submit", { section: "EXP", type: "core", purpose: "exp", test: "icp", submitter: "Geo", count: 2 }); const ic = await ids(P);
  for (const id of ic) await receipt(Tc, id);
  check(doc(ic[0]).route === "ICP" && doc(ic[0]).qcg[0].k.length === 8, "an ICP sample checks Cu, Ag, As, Sb, Zn, Pb, Fe and S in its batch");
  const bi = await createBatch(Tc, "icp", ic); await groupMove(Tc, ic, "weigh"); await showBatch(Tc, bi);
  const crmsI = batchDoc(bi).pos.filter(x => x.t === "crm").map(x => x.crm);
  check(batchDoc(bi).ans.length === 8 && crmsI.includes("STD-ICP-LOW") && crmsI.includes("STD-ICP-HIGH"), "the batch carries all eight results and reference materials certified for them: " + crmsI.join(", "));
  check(await Tc.$$eval("#batchBox thead th", ths => ths.map(t => t.textContent).join("|")) .then(t => /Cu \(ppm\).*S \(%\)/.test(t)), "one column per element");
  const vals = { Cu: "520", Ag: "1.8", As: "140", Sb: "12", Zn: "90", Pb: "33", Fe: "4.6", S: "0.92" };
  const crmI = posOf(bi, x => x.t === "crm");
  const asExp = +(await Tc.$eval(`#bp_${crmI.p}_As`, e => e.dataset.exp));
  await fillBatch(Tc, bi, (sid, k) => vals[k], { [crmI.p]: { As: String(+(asExp * 1.15).toFixed(2)) } });
  const qi = await saveBatch(Tc, bi);
  const asc = qi.checks.find(c => c.p === crmI.p && c.k === "As");
  check(qi.status === "fail" && asc.verdict === "fail" && qi.checks.filter(c => c.p === crmI.p && c.verdict === "pass").length === 7, "a reference material 15% off for arsenic fails the batch on arsenic alone");
  check(/Failed: .*\(As\)/.test(await Tc.textContent("#batchBox")), "the batch says which element failed");
  check(ic.every(id => labOf(id, "icp")?.q === "fail" && Object.keys(doc(id).results.rows).length === 8), "the samples hold all eight results with the batch's verdict");
  await showBatch(Sv, bi); await Sv.fill("#bWhy", "As high on the CRM: re-digest"); await Sv.click('[data-bdec="rerun"]');
  const bi2 = await waitFor(() => batchDoc(bi).rerunBy);
  await showBatch(Tc, bi2); await groupMove(Tc, ic, "weigh").catch(() => {}); await showBatch(Tc, bi2);
  await fillBatch(Tc, bi2, (sid, k) => sid === ic[0] && k === "Cu" ? "12000" : vals[k]);
  const qi2 = await saveBatch(Tc, bi2);
  check(qi2.status === "pass" && doc(ic[0]).results.rows.Cu.f === "over", "the re-run passes; copper at 12000 ppm is over the ICP range");
  await walkTo(Tc, ic[0], "read"); await open(Tc, ic[0]);
  await Tc.click("#overBtn"); await waitFor(() => (doc(ic[0]).dil || []).includes("Cu"));
  check(doc(ic[0]).stageKey === "digest" && !labOf(ic[0], "icp") && !doc(ic[0]).results.rows.Cu && doc(ic[0]).results.rows.As, "over range: back to digestion for a diluted re-run, out of the batch, keeping the other results");
  await Tc.click('[data-tab="batches"]'); await Tc.waitForSelector("#nbProf"); await Tc.selectOption("#nbProf", "icp"); await Tc.waitForSelector("#nbCreate");
  check((await Tc.$$eval("#nbList input[type=checkbox]", es => es.map(e => e.value))).includes(ic[0]), "it waits for a new ICP batch");
  const bi3 = await createBatch(Tc, "icp", [ic[0]]); await showBatch(Tc, bi3);
  const sp = posOf(bi3, x => x.t === "s").p;
  check(await Tc.$eval(`#bp_${sp}_Ag`, e => e.dataset.ul === "100") && !(await Tc.$eval("#bp_" + sp, e => e.dataset.ul)), "in the new batch, diluted copper has no upper limit; the other elements keep theirs");

  log("Trend rules on reference materials");
  const seedAt = Date.now() - 9000;   // after this run's earlier batches: these 8 are the CRM's latest results
  for (let i = 0; i < 8; i++){
    const id = `FA-20260901-${String(i + 1).padStart(2, "0")}`, v = i === 7 ? 0.52 + 2.4 * 0.025 : 0.52 + 0.5 * 0.025;
    store["batches/" + id] = { id, qcp: "fa50", ans: [{ k: "Au", n: "Gold", u: "g/t", dl: 0.005, dp: 3, ul: 10 }], at: seedAt + i * 1000, month: "2026-09", open: false, status: "done", sids: [], pos: [], crms: ["STD-AU-LOW"],
      qc: { status: i === 7 ? "warn" : "pass", at: seedAt + i * 1000, checks: [{ p: 9, t: "crm", crm: "STD-AU-LOW", k: "Au", exp: 0.52, sd: 0.025, val: +v.toFixed(4), verdict: i === 7 ? "warn" : "pass" }] } };
    await broadcast("batches/" + id, store["batches/" + id]);
  }
  await fillForm(P, "submit", { section: "EXP", submitter: "Trend", count: 1 }); const [tx] = await ids(P);
  await receipt(Tc, tx);
  const bt = await createBatch(Tc, "fa50", [tx]); await groupMove(Tc, [tx], "weigh"); await showBatch(Tc, bt);
  const lowPos = posOf(bt, x => x.t === "crm" && x.crm === "STD-AU-LOW");
  await fillBatch(Tc, bt, () => "0.70", { [lowPos.p]: (0.52 + 2.5 * 0.025).toFixed(4) });
  const qt = await saveBatch(Tc, bt);
  const rules = (qt.trend || []).map(t => t.rule);
  check(rules.includes("2of2s") && rules.includes("9side") && qt.status === "warn", "a second result beyond +2 SD in a row, and nine above the certified value, are flagged: " + rules.join(", "));
  check(qt.checks.find(c => c.p === lowPos.p).exp === 0.52 && qt.checks.find(c => c.p === lowPos.p).sd === 0.025, "each result keeps the certified value and SD it was judged on");
  await Tc.click('[data-tab="batches"]'); await Tc.waitForTimeout(300);
  check(/Reference material trends:.*STD-AU-LOW/.test(await Tc.textContent("#view-batches")), "the Lab batches tab flags the reference material");
  await Tc.selectOption("#chCrm", "STD-AU-LOW|Au|g/t"); await Tc.waitForSelector("#chBox svg");
  check(/Trend:/.test(await Tc.textContent("#chBox")) && (await Tc.$$eval("#chBox circle[r='8']", c => c.length)) >= 2, "the control chart rings the two results beyond 2 SD and names the trend");
  await Tc.click('[data-tab="board"]'); await Tc.waitForTimeout(300);
  check((await Tc.textContent("#bdTrends")).includes("STD-AU-LOW"), "the board flags it too");

  log("Plant routing and section accounts");
  await fillForm(P, "submit", { section: "PLT", type: "plant_feed", purpose: "plant", test: "fa_aas", submitter: "Shift" }); const [mx] = await ids(P);
  check(doc(mx).route === "PLT-HEAD" && doc(mx).qcg[0].p === "plant", "a Mill sample sent for fire assay for plant control goes on the plant shift route, not exploration");
  const X = await newUser(browser, { uid: "u_x", name: "Exploration", canEdit: true, names }); await signIn(X, "exp");
  check(JSON.stringify((await visibleTabs(X)).sort()) === JSON.stringify(["results", "routes", "submit", "track"]) && (await X.$eval('#tabs [data-tab="results"]', b => b.getAttribute("aria-selected"))) === "true", "a section account sees Track, Submit, Results and Routes, and lands on Results: " + (await visibleTabs(X)).join(","));
  await X.waitForSelector("#view-results table", { timeout: 5000 });
  const rtab = await X.textContent("#view-results");
  check(rtab.includes(ex[0]) && rtab.includes(ax) && !rtab.includes(cs) && /new since you last/.test(rtab), "its Results tab lists its own section's certificates, newest first, with the new ones marked");
  check(/Results \(\d+ new\)/.test(await X.textContent('#tabs [data-tab="results"]')), "the tab shows how many are new");
  await X.click("#secSeen"); await X.waitForTimeout(200);
  check((await X.textContent('#tabs [data-tab="results"]')) === "Results", "marking them as seen clears the notice");
  await X.click(`#view-results [data-open="${ex[0]}"]`); await X.waitForSelector(".sid");
  check(/0\.860/.test(await X.textContent("#resPanel")), "it can read the results of its own samples");
  await open(X, cs);
  check(!/0\.030/.test(await X.textContent("#resPanel")) && /check code/.test(await X.textContent("#resPanel")), "but not another section's");
  await open(Ad, ex[2]); await walkTo(Ad, ex[2], "qc"); await next(Ad, 1);
  await X.waitForTimeout(600);
  check(/Results \(1 new\)/.test(await X.textContent('#tabs [data-tab="results"]')), "a newly released result shows up for the section at once");
  await X.screenshot({ path: OUT + "/section-results.png", fullPage: true });

  log("Settings: limits and certified results");
  await Ad.click('[data-tab="stages"]'); await H.cfgTab(Ad, "limits"); await Ad.waitForSelector("[data-lf]");
  const l1 = await Ad.$$eval('[data-lf="act"]', es => es.find(e => /residue assay/.test(e.value)).dataset.li);
  await Ad.fill(`[data-li="${l1}"][data-lf="val"]`, "0.25"); await Ad.press(`[data-li="${l1}"][data-lf="val"]`, "Tab"); await Ad.waitForTimeout(150);
  await Ad.click("#limAdd"); await Ad.waitForTimeout(150);
  await Ad.click("#cfgSave"); await Ad.waitForTimeout(300);
  check(/choose a route/.test(await toastText(Ad)), "a limit without a route and result is refused");
  const nl = await Ad.$$eval('[data-lf="route"]', e => e.at(-1).dataset.li);   // v23: rows carry their place in the list (limits on routes not in use are drawn when opened)
  await Ad.selectOption(`[data-li="${nl}"][data-lf="route"]`, "ENV-W"); await Ad.waitForTimeout(150);
  await Ad.selectOption(`[data-li="${nl}"][data-lf="k"]`, "Fe"); await Ad.fill(`[data-li="${nl}"][data-lf="val"]`, "1"); await Ad.press(`[data-li="${nl}"][data-lf="val"]`, "Tab"); await Ad.waitForTimeout(150);
  await Ad.fill(`[data-li="${nl}"][data-lf="act"]`, "Notify Environment"); await Ad.press(`[data-li="${nl}"][data-lf="act"]`, "Tab"); await Ad.waitForTimeout(150);
  await Ad.click("#cfgSave"); await waitFor(() => store["settings/stages"].schema === 12);
  const sv = store["settings/stages"];
  check(sv.schema === 12 && sv.limits.length === 51 && sv.limits.find(l => l.id === "L01").val === 0.25 && sv.limits.at(-1).k === "Fe" && sv.crms.length === 49, "limits are saved with the settings (schema 12)");   // v23: 40 + 10 plant limits + the new one
  await Ad.click('[data-tab="routes"]'); await Ad.waitForSelector("#rtList"); await Ad.click("#route-PLT-TAIL summary");
  const ptl = await Ad.textContent("#route-PLT-TAIL");
  check(/Lab batches:\s*Plant tails batch for Au.*Solution AAS run for solution tails gold/.test(ptl) && /Action limits:.*above 0\.25 g\/t/.test(ptl), "the routes tab shows each batch a route joins and its action limits");

  log("Upgrade of version 11 records");
  const v11a = clone(doc(tx)), v11b = clone(doc(ic[1]));
  const ida = "EXP-20261001-0901", idb = "EXP-20261001-0902";
  for (const x of [v11a, v11b]){ delete x.qcg; delete x.labs; delete x.lbs; delete x.dil; x.v = 11; }
  Object.assign(v11a, { id: ida, qcp: "fa50", labBatch: bt, labQc: "warn", labQcNote: "" });
  Object.assign(v11b, { id: idb, qcp: "icp", labBatch: "", labQc: "", labQcNote: "", stageKey: "received", results: null });
  store["samples/" + ida] = v11a; store["samples/" + idb] = v11b; store["meta/schema"] = { v: 11 };
  for (const p of ["samples/" + ida, "samples/" + idb, "meta/schema"]) await broadcast(p, store[p]);
  const U = await newUser(browser, { uid: "u_u", name: "Later", canEdit: true, names });
  await waitFor(() => store["meta/schema"].v === 13, 8000);
  const ua = doc(ida), ub = doc(idb); if (process.env.DBG) console.log(JSON.stringify({ schema: store["meta/schema"], ua: { v: ua.v, qcg: ua.qcg, labs: ua.labs, lab: ua.lab, sx: ua.sx }, ub: { v: ub.v, qcg: ub.qcg, lab: ub.lab, sx: ub.sx }, sa: store["stock/" + ida], sb: store["stock/" + idb] }));
  check(ua.v === 13 && JSON.stringify(ua.qcg) === JSON.stringify([{ p: "fa50", k: ["Au"] }]) && ua.labs.fa50.b === bt && ua.labs.fa50.q === "warn" && ua.lbs.join() === bt, "a sample already in a batch keeps that batch, now recorded by batch type");
  check(ub.v === 13 && ub.qcg[0].p === "icp" && ub.qcg[0].k.length === 8 && JSON.stringify(ub.labs) === "{}", "a sample not yet in a batch takes its route's batches (all eight ICP elements)");
  check(ua.lab === true && ub.lab === true && store["stock/" + ida]?.st === "lab" && store["stock/" + idb]?.gone === 9e15 && !ua.sx && !ub.sx, "and both are marked in the lab, each with a stock record");
  await U.close();

  console.log("Console errors:", errors.length ? errors.join("\n") : "none");
  if (errors.length) process.exitCode = 1;
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
