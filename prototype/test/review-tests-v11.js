// The independent reviewer's scenarios (review/review-tests.js, written against v9), re-run against v11.
// v11: samples now need their lab batch results before QA/QC review, so scenario E runs a fire assay batch first.
// Same steps and the same OK/BUG verdicts, adapted to the v10 screens: forward moves use "Move to: next",
// corrections and skips use the "Correct the stage" box, and the shared mock now honours where() filters
// and limits (harness.js), so bug 8 can be tested for real.
const H = require("./harness");
const { store, errors, broadcast, newUser, launch, T, visibleTabs, signIn, fillForm, ids, open, doc, ledger, toastText, localStr } = H;
const OUT = __dirname;
const names = { u_z: "Zuriel" };
const DAY = 86400e3;
let bugs = 0;
const R = (tag, ok, msg) => { console.log(ok ? "  OK  " : "  BUG ", tag, msg); if (!ok) { bugs++; process.exitCode = 1; } };
const moves = id => ledger().filter(m => m.sid === id);
const ledgerRows = async (page, id) => { await page.click('[data-tab="ledger"]'); await page.waitForTimeout(400);
  return page.$$eval("#view-ledger tbody tr", (trs, id) => trs.filter(t => t.children[2].textContent.includes(id)).map(t => t.children[1].textContent.trim().replace(/\s+/g, " ") + " " + t.children[2].textContent.trim()), id); };
async function receipt(page, id, kind = "confirm", note = "", disp = ""){
  await open(page, id); if (note) await page.fill("#mvNote", note);
  if (kind === "reject"){ await page.click("#rejBox summary"); await page.selectOption("#rcDisp", disp || "returned"); }
  await page.click(`[data-receipt="${kind}"]`); await page.waitForTimeout(1200);
}
const next = async (page, n = 1) => { for (let i = 0; i < n; i++){ await page.click('[data-step="next"]'); await page.waitForTimeout(500); } };

(async () => {
  const browser = await launch();
  require("./harness").useOldRoutes();   // v23: this suite is written around the routes in use before version 23
  await H.useQcStep(browser);   // v22: this suite is written around the QA/QC review step, which Settings now turn on
  const P = await newUser(browser, { uid: "u_p", name: "Public", canEdit: true, names });
  const Tc = await newUser(browser, { uid: "u_t", name: "Tech", canEdit: true, names });
  await signIn(Tc, "tech1");
  const Sv = await newUser(browser, { uid: "u_s", name: "Super", canEdit: true, names });
  await signIn(Sv, "super");

  // A (bug 5): receipt time before submission; collection in the future
  await fillForm(P, "submit", { section: "EXP", tags: "T-500", submitter: "Esi" });
  const a = (await ids(P))[0];
  await open(Tc, a);
  const twoDaysAgo = localStr(Date.now() - 2 * DAY);
  await Tc.fill("#rcAt", twoDaysAgo); await Tc.click('[data-receipt="confirm"]'); await Tc.waitForTimeout(500);
  R("A1", doc(a).stageKey === "submitted" && /before the submission/.test(await toastText(Tc)), `receipt dated 2 days before submission: stage ${doc(a).stageKey}, message "${await toastText(Tc)}"`);
  await Tc.fill("#rcAt", localStr(Date.now())); await Tc.click('[data-receipt="confirm"]'); await Tc.waitForTimeout(1200);
  R("A2", doc(a).stageKey === "received" && doc(a).recvAt >= doc(a).createdAt, `valid receipt: received ${new Date(doc(a).recvAt).toISOString()} ≥ submitted ${new Date(doc(a).createdAt).toISOString()}`);
  await fillForm(P, "submit", { section: "EXP", submitter: "Esi", collected: localStr(Date.now() + 5 * 3600e3) }); await P.waitForTimeout(300);
  R("A3", /can't be in the future/.test(await toastText(P)) && !(await P.$("#rResult code")), `collection time 5 h in the future: "${await toastText(P)}"`);
  await P.$eval("#rMore", d => { d.open = true; }).catch(() => {});
  await P.fill("#rCollected", "");

  // B (bug 1): chosen stage + note survive another user's write, and Record does what was chosen
  await open(Tc, a);
  await next(Tc, 2);                                     // received → sort → dry
  await Tc.click("#corrBox summary"); await Tc.selectOption("#mvKey", "sort"); await Tc.fill("#corrWhy", "Logged drying on the wrong tray");
  await fillForm(P, "submit", { section: "GEO", submitter: "Other user" }); await ids(P); await Tc.waitForTimeout(500);
  const selNow = await Tc.$eval("#mvKey", e => e.value), whyNow = await Tc.$eval("#corrWhy", e => e.value);
  await Tc.click("#corrBtn"); await Tc.waitForTimeout(1100);
  R("B1", selNow === "sort" && whyNow && doc(a).stageKey === "sort", `after another user's write the box shows ${selNow} / "${whyNow}"; after Record the stage is ${doc(a).stageKey}`);
  await Tc.fill("#mvNote", "moving on to drying");
  await fillForm(P, "submit", { section: "GEO", submitter: "Other user" }); await ids(P); await Tc.waitForTimeout(500);
  await next(Tc); await Tc.waitForTimeout(600);
  R("B2", doc(a).stageKey === "dry" && doc(a).history.at(-1).note === "moving on to drying", `note typed before another user's write saved with the move: stage ${doc(a).stageKey}, note "${doc(a).history.at(-1).note}"`);

  // C (bug 2): notes and corrections add no ledger lines
  await Tc.click("#corrBox summary"); await Tc.selectOption("#mvKey", "received"); await Tc.fill("#corrWhy", "correction"); await Tc.click("#corrBtn"); await Tc.waitForTimeout(1100);
  await Tc.fill("#mvNote", "note at received"); await Tc.click('[data-step="note"]'); await Tc.waitForTimeout(800);
  await Tc.fill("#mvNote", "another note"); await Tc.click('[data-step="note"]'); await Tc.waitForTimeout(800);
  const cRows = await ledgerRows(Tc, a);
  R("C", cRows.length === 1 && /^IN/.test(cRows[0]), `ledger rows for ${a} after a correction and two notes: ${cRows.join(" | ")}`);

  // D (bug 3): rejected samples are in the ledger; "Rejected" only at receipt
  await fillForm(P, "submit", { section: "EXP", submitter: "Esi" }); const d1 = (await ids(P))[0];
  await receipt(Tc, d1, "reject", "bag torn, sample spilt", "returned");
  const d1Rows = await ledgerRows(Tc, d1);
  R("D1", d1Rows.length === 2 && d1Rows.some(r => /^IN/.test(r)) && d1Rows.some(r => /^OUT/.test(r)), `rejected at receipt ${d1}: ledger rows ${d1Rows.join(" | ") || "none"}`);
  await fillForm(P, "submit", { section: "EXP", submitter: "Esi" }); const d2 = (await ids(P))[0];
  await receipt(Tc, d2); await open(Tc, d2);
  const optsD2 = await Tc.$$eval("#mvKey option", os => os.map(o => o.value));
  await Tc.click("#cxBox summary"); await Tc.selectOption("#cxDisp", "returned"); await Tc.fill("#cxWhy", "wrong sample sent"); await Tc.click("#cxBtn"); await Tc.waitForTimeout(1200);
  const d2Rows = await ledgerRows(Tc, d2);
  R("D2", !optsD2.includes("rejected") && d2Rows.length === 2, `received ${d2}: "Rejected" offered = ${optsD2.includes("rejected")}; stopped and returned, ledger rows ${d2Rows.join(" | ")}`);

  // E (bug 4): no jump from Received to Results released
  await fillForm(P, "submit", { section: "EXP", submitter: "Esi" }); const e1 = (await ids(P))[0];
  await receipt(Tc, e1); await open(Tc, e1);
  const techOpts = await Tc.$$eval("#mvKey option", os => os.map(o => o.value));
  await open(Sv, e1);
  const supOpts = await Sv.$$eval("#mvKey option", os => os.map(o => o.value));
  R("E1", !techOpts.length && !supOpts.includes("released") && !supOpts.includes("qc") && doc(e1).stageKey === "received", `technician skip options: [${techOpts}] · supervisor skip options: [${supOpts}]`);
  const qcAt = doc(e1).plan.findIndex(x => x.key === "qc"), cur = doc(e1).plan.findIndex(x => x.key === "received");
  await next(Tc, qcAt - cur - 1);
  await H.runBatch(Tc, "fa50", [e1], () => "1.234"); await open(Tc, e1);
  await next(Tc, 1);
  const techRelease = !!(await Tc.$('[data-step="next"]'));
  R("E2", doc(e1).stageKey === "qc" && !techRelease, `technician walked to ${doc(e1).stageKey}; a release button is ${techRelease ? "shown" : "not shown"} to the technician`);
  await open(Sv, e1); await Sv.waitForTimeout(200); await next(Sv); await Sv.waitForTimeout(600);
  R("E3", doc(e1).stageKey === "released" && doc(e1).history.at(-1).tech === "Lab Supervisor", `supervisor released after QA/QC: stage ${doc(e1).stageKey}, by ${doc(e1).history.at(-1).tech}`);
  await open(Sv, e1);
  R("E4", (await Sv.$$eval(".rail li.skipped", l => l.length)) === 0, "no steps shown as skipped when none were skipped");

  // F (bug 11): batch with a single tag counts up; tags stored as a list; duplicates refused
  await fillForm(P, "submit", { section: "EXP", submitter: "Esi", count: 3, tags: "T-10421" }); const f = await ids(P);
  R("F1", f.map(i => doc(i).tags.join()).join(", ") === "T-10421, T-10422, T-10423", `batch of 3 with tag T-10421 stored tags: ${f.map(i => doc(i).tags.join()).join(", ")}`);
  await fillForm(P, "submit", { section: "EXP", submitter: "Esi", tags: "t-10422" }); await P.waitForTimeout(600);
  R("F2", /already on open sample/.test(await toastText(P)), `re-using tag T-10422: "${await toastText(P)}"`);

  // G (bug 12): lookup by tag works from a link, without turning the tag into an ID
  const G = await newUser(browser, { uid: "u_g", name: "Guest", canEdit: true, names, hash: "T-10421" });
  await G.waitForSelector(".sid", { timeout: 6000 }).catch(() => {});
  const gId = await G.$eval(".sid", e => e.textContent).catch(() => "nothing");
  R("G", gId === f[0], `tracking link #T-10421 opens ${gId}`);

  // H (bug 6): a backdated receipt time survives another user's save
  await fillForm(P, "submit", { section: "EXP", submitter: "Esi" }); const h1 = (await ids(P))[0];
  await open(Tc, h1); const back = localStr(Date.now() - 20 * 60000); await Tc.fill("#rcAt", back); await Tc.focus("#mvNote");
  await fillForm(P, "submit", { section: "GEO", submitter: "Other" }); await ids(P); await Tc.waitForTimeout(500);
  const rcNow = await Tc.$eval("#rcAt", e => e.value);
  R("H", rcNow === back, `receipt time typed ${back}, after another user's write shows ${rcNow}`);

  // I (bug 10): admin keeps focus in Settings; ledger search keeps focus
  const Ad = await newUser(browser, { uid: "u_a", name: "Admin", canEdit: true, names }); await signIn(Ad, "admin");
  await Ad.click('[data-tab="stages"]'); await Ad.waitForTimeout(300); await H.cfgTab(Ad, "routes");
  await Ad.click('[data-rf="desc"]'); await Ad.keyboard.type(" half typed");
  await fillForm(P, "submit", { section: "GEO", submitter: "Other" }); await ids(P); await Ad.waitForTimeout(500);
  const foc = await Ad.evaluate(() => document.activeElement && (document.activeElement.dataset.rf || document.activeElement.tagName));
  R("I1", foc === "desc", `admin typing in a route description; after another user's submission focus is on: ${foc}`);
  await Tc.click('[data-tab="ledger"]'); await Tc.click("#lgQ"); await Tc.keyboard.type("EXP");
  await fillForm(P, "submit", { section: "GEO", submitter: "Other" }); await ids(P); await Tc.waitForTimeout(500);
  R("I2", await Tc.evaluate(() => document.activeElement?.id) === "lgQ" && await Tc.$eval("#lgQ", e => e.value) === "EXP", "ledger search keeps focus and text while others save");

  // K (bug 7): a route that doesn't do the requested test can't be picked silently
  await fillForm(Tc, "register", { section: "MET", type: "core", purpose: "exp", test: "sfa", submitter: "X" }).catch(() => {});
  await Tc.click("#rAgain").catch(() => {});
  await Tc.selectOption("#rSection", "MET"); await Tc.selectOption("#rType", "core"); await Tc.selectOption("#rPurpose", "exp"); await Tc.selectOption("#rTest", "sfa");
  const regRoutes = await Tc.$$eval("#rRouteSel option", os => os.map(o => o.value).filter(Boolean));
  R("K1", !regRoutes.includes("ICP") && regRoutes.every(c => c === "SFA"), `register at lab, test screen fire assay: routes offered [${regRoutes}]`);
  await fillForm(P, "submit", { section: "EXP", submitter: "Esi" }); const k2 = (await ids(P))[0];
  await open(Tc, k2); await Tc.selectOption("#rcTest", "icp").catch(() => {}); await Tc.waitForTimeout(100);
  await Tc.click('[data-receipt="confirm"]'); await Tc.waitForTimeout(600);
  R("K2", doc(k2).stageKey === "submitted" && /reason for changing the test/.test(await toastText(Tc)), `receipt with a different test and no reason: stage ${doc(k2).stageKey}, "${await toastText(Tc)}"`);
  await Tc.fill("#mvNote", "Geologist asked for multi-element"); await Tc.click('[data-receipt="confirm"]'); await Tc.waitForTimeout(1200);
  const kh = doc(k2).history.at(-1);
  R("K3", doc(k2).stageKey === "received" && kh.testFrom === "fa_aas" && kh.testTo === doc(k2).test, `with a reason: test ${kh.testFrom} → ${kh.testTo} logged on the custody entry`);

  // M (bug 19): forged session values give nothing
  const M = await newUser(browser, { uid: "u_m", name: "M", canEdit: true, names, session: "admin" });
  const mt = await visibleTabs(M);
  const M2 = await newUser(browser, { uid: "u_m2", name: "M2", canEdit: true, names, session: "admin:12345678" });
  const mt2 = await visibleTabs(M2);
  R("M", !mt.includes("stages") && !mt2.includes("stages"), `forged "admin" gives tabs ${mt.join(",")}; forged "admin:12345678" gives ${mt2.join(",")}`);

  // R (bug 13): two people submitting to one section at once, no waiting on a lock
  const P2 = await newUser(browser, { uid: "u_p2", name: "P2", canEdit: true, names });
  let t0 = Date.now();
  await Promise.all([fillForm(P, "submit", { section: "PLT", type: "plant_feed", purpose: "plant", submitter: "A" }), fillForm(P2, "submit", { section: "PLT", type: "plant_feed", purpose: "plant", submitter: "B" })]);
  const [r1, r2] = [(await ids(P))[0], (await ids(P2))[0]];
  const tookR = Date.now() - t0;
  t0 = Date.now(); await fillForm(P2, "submit", { section: "PLT", type: "plant_feed", purpose: "plant", submitter: "C" }); const r3 = (await ids(P2))[0]; const tookR2 = Date.now() - t0;
  R("R", r1 !== r2 && r3 !== r1 && r3 !== r2 && tookR < 4000 && tookR2 < 3000, `simultaneous PLT submissions got ${r1} and ${r2} in ${tookR} ms; the next one right after got ${r3} in ${tookR2} ms`);

  // 8: more than 1,000 samples. The board sees every sample still in the lab, retention flags and the month ledger see all of them.
  // Adapted for v13 (README): stored samples are listed on the Storage tab instead of the board, and the records are written as v10 records
  // as already upgraded except the old open one, which sorts after all of them: the one-off upgrade has to page past 1,000 records to find it.
  const now = Date.now(), month = new Date(now).toISOString().slice(0, 7);
  const bulk = {};
  for (let i = 1; i <= 1150; i++){
    const id = `GC-20260701-${String(i).padStart(4, "0")}`, at = now - 40 * DAY + i * 1000;
    bulk["samples/" + id] = { id, v: 13, lab: false, section: "GC", type: "RC chips", typeKey: "rc", route: "GC-FA", stageKey: "disposed", stageAt: at, open: false, onHand: false, createdAt: at, history: [], tags: [], plan: doc(a).plan };
  }
  // one old open sample, created before all 1,150 closed ones, with a coarse reject past its own retention
  bulk["samples/GC-20260801-0001"] = { id: "GC-20260801-0001", v: 10, section: "GC", type: "RC chips", typeKey: "rc", route: "GC-FA", stageKey: "storage", stageAt: now - 60 * DAY, open: true, onHand: true, createdAt: now - 70 * DAY, recvAt: now - 70 * DAY,
    relAt: now - 61 * DAY, tags: [], plan: doc(a).plan, history: [{ key: "received", at: now - 70 * DAY }],
    materials: [{ k: "m1", item: "Pulp", days: 365, then: "Returned", dispo: "returned", status: "kept", dueAt: now + 300 * DAY, loc: "A1", outs: 0 }, { k: "m2", item: "Coarse reject", days: 30, then: "Disposed", dispo: "disposed", status: "kept", dueAt: now - 31 * DAY, loc: "Yard", outs: 0 }] };
  // this month's ledger: 1,200 movements over 30 day documents
  for (let d = 0; d < 30; d++){
    const m = {};
    for (let j = 0; j < 40; j++){ const sid = `GC-BULK-${d}-${j}`; m[`${sid}~in`] = { mid: `${sid}~in`, dir: "in", at: Date.parse(month + "-01T00:00:00Z") + d * 3600e3 + j, sid, sec: "GC", type: "RC chips", item: "Sample", qty: "1 bag(s)", from: "Grade control", tech: "Bulk" }; }
    bulk[`ledger/${month}-01_GC${d}`] = { day: `${month}-01`, month, sec: "GC" + d, m };
  }
  Object.assign(store, bulk); store["meta/schema"] = { v: 12 };
  const B = await newUser(browser, { uid: "u_b", name: "Bulk", canEdit: true, names });
  await signIn(B, "tech1");
  for (let i = 0; i < 300 && store["meta/schema"].v !== 13; i++) await B.waitForTimeout(200);
  await B.click('[data-tab="board"]'); await B.waitForTimeout(600);
  const recs = Object.values(store).filter(x => x && x.id && store["samples/" + x.id] === x), labN = recs.filter(x => x.lab === true).length;
  // v24c: wait for the board to settle rather than a fixed time (1,169 samples render slower under a full run)
  for (let i = 0; i < 40 && !(+(await B.textContent("#cntActive")) === labN && /past retention, on \d+ sample/.test(await B.textContent("#view-board"))); i++) await B.waitForTimeout(250);
  const boardTxt = (await B.textContent("#view-board")).replace(/\s+/g, " ");
  await B.click('[data-tab="storage"]'); await B.waitForTimeout(500);
  for (let i = 0; i < 40 && !(await B.textContent("#view-storage")).includes("GC-20260801-0001"); i++) await B.waitForTimeout(250);
  const stTxt = (await B.textContent("#view-storage")).replace(/\s+/g, " ");
  if (process.env.DBG) console.log("DBG8", JSON.stringify({ schema: store["meta/schema"], notV13: recs.filter(x => x.v !== 13).length, cnt: await B.textContent("#cntActive"), labN, old: store["samples/GC-20260801-0001"]?.lab, oldStock: store["stock/GC-20260801-0001"], st: stTxt.slice(-400), board: (boardTxt.match(/\d+ ?Materials past retention[^0-9]*/) || [""])[0] }));
  R("8a", store["meta/schema"].v === 13 && recs.every(x => x.v === 13) && +(await B.textContent("#cntActive")) === labN && !(await B.textContent("#view-board")).includes("GC-20260801-0001") && stTxt.includes("GC-20260801-0001"),
    `with ${recs.length} samples on record (all upgraded), the board shows the ${labN} in the lab and the oldest stored sample is on the Storage tab`);
  R("8b", /past retention, on \d+ sample/.test(boardTxt) && /Coarse reject ?Yard.*Past retention/.test(stTxt), "the oldest sample's coarse reject is flagged past retention (board count and Storage list)");
  await B.click('[data-tab="board"]');
  await B.click('[data-tab="ledger"]'); await B.waitForTimeout(800);
  const lgTxt = (await B.textContent("#view-ledger")).replace(/\s+/g, " ");
  const inMonth = ledger().filter(m => new Date(m.at).toISOString().slice(0, 7) === month && m.dir === "in").length;
  const shownIn = +(lgTxt.match(/(\d+) inbound/) || [])[1];
  R("8c", shownIn === inMonth && inMonth > 1000, `month ${month}: ${inMonth} inbound movements on record, the ledger shows ${shownIn}`);
  await B.click("#lgCsv"); await B.waitForTimeout(500);
  const csv = await B.evaluate(() => window.__downloaded?.data || "");
  R("8d", csv.split("\n").length - 1 === (await B.$$eval("#view-ledger tbody tr", t => t.length)), `CSV has ${csv.split("\n").length - 1} rows, the same as the table`);

  // 9: retention per material, from release
  const rel = doc(e1);
  R("9a", rel.materials.length >= 2 && rel.materials.every(m => Math.abs(m.dueAt - (rel.relAt + m.days * DAY)) < 2000) && new Set(rel.materials.map(m => m.days)).size > 1, `released ${e1}: ${rel.materials.map(m => `${m.item} ${m.days} d`).join(", ")}, each from the release time`);
  await open(Tc, e1);
  await Tc.selectOption("#mx_m1", "store"); await Tc.fill("#mr_m1", "B3"); await Tc.click('[data-mat="m1"]'); await Tc.waitForTimeout(1100);
  await H.waitFor(() => doc(e1).materials[0].loc === "B3", 6000); await Tc.waitForFunction(() => !document.querySelector('[data-mat="m2"]')?.disabled, null, { timeout: 8000 }).catch(() => {});   // the pulp's save has finished (it clears the witness box when it does)
  await Tc.selectOption("#mx_m2", "disposed"); await Tc.selectOption("#mtWit", { index: 1 }); await Tc.click('[data-mat="m2"]'); await Tc.waitForTimeout(1100);   // v24c: disposal needs a witness
  if (doc(e1).materials[1].status === "kept"){ await Tc.selectOption("#mx_m2", "disposed"); await Tc.selectOption("#mtWit", { index: 1 }); await Tc.click('[data-mat="m2"]'); await Tc.waitForTimeout(1100); }   // once more if a re-render from another page's write took the click
  await H.waitFor(() => moves(e1).some(m => m.dir === "out"), 6000);   // the ledger write follows the sample update
  const e1d = doc(e1);
  R("9b", e1d.materials[0].loc === "B3" && e1d.materials[1].status === "disposed" && e1d.open === true && moves(e1).filter(m => m.dir === "out").length === 1, `pulp stored at "B3" (bug 17) and coarse reject disposed separately; sample still open for the pulp; OUT movements: ${moves(e1).filter(m => m.dir === "out").length}`);

  // 14: site time zone, not the device's
  const K = await newUser(browser, { uid: "u_k", name: "Far", canEdit: true, names }, undefined, "light", { timezoneId: "Pacific/Kiritimati" });
  await fillForm(K, "submit", { section: "OTH", type: "other", purpose: "other", why: "Time zone check", submitter: "Far away" });
  const kId = (await ids(K))[0];
  R("14", kId.startsWith(`OTH-${T}-`), `a device on UTC+14 gets ${kId}; the site date is ${T}`);

  // 15: two-person custody for bullion
  await fillForm(P, "submit", { section: "GR", type: "bullion", purpose: "bullion", submitter: "Gold room" }); const g1 = (await ids(P))[0];
  await open(Tc, g1); await Tc.click('[data-receipt="confirm"]'); await Tc.waitForTimeout(500);
  const noWit = doc(g1).stageKey;
  await Tc.selectOption("#rcWit", { index: 1 }); await Tc.click('[data-receipt="confirm"]'); await Tc.waitForTimeout(1200);
  R("15", noWit === "submitted" && doc(g1).stageKey === "received" && !!doc(g1).recv.wit, `bullion receipt without a witness: ${noWit}; with a witness: ${doc(g1).stageKey}, witness ${doc(g1).recv.wit}`);

  // 16: a route code in use is locked in Settings
  await Ad.click('[data-tab="stages"]'); await Ad.waitForTimeout(300); await H.cfgTab(Ad, "routes");
  await Ad.selectOption("#rtPick", { label: "EXP-FA · AuFx: fire assay (50 g, AAS finish)" }).catch(() => {});
  R("16", await Ad.$eval('[data-rf="code"]', e => e.disabled).catch(() => false), "route code EXP-FA is locked while open samples use it");

  // J (bug 18): phone layout
  const ph = await newUser(browser, { uid: "u_ph", name: "Ph", canEdit: true, names }, { width: 375, height: 760 });
  await signIn(ph, "admin");
  for (const t of ["board", "submit", "register", "batches", "ledger", "routes", "stages"]){
    await H.tab(ph, t); await ph.waitForTimeout(300);
    const w = await ph.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    R("J-" + t, w[0] <= w[1], `phone width 375: page scrollWidth ${w[0]}`);
  }
  await open(ph, a); { const w = await ph.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); R("J-track", w[0] <= w[1], `phone record scrollWidth ${w[0]}`); }
  await ph.$eval("#tabs", e => e.scrollLeft = 0); await ph.waitForTimeout(200);
  const cue = await ph.$eval("#tabs", e => [e.scrollWidth > e.clientWidth, e.className]);
  R("J-cue", !cue[0] || /more-r/.test(cue[1]), `tab strip overflows: ${cue[0]}; cue classes "${cue[1]}"`);

  console.log(`\n${bugs ? bugs + " BUG(S)" : "No bugs reproduced"}. Console errors: ${errors.length ? errors.join("\n") : "none"}`);
  if (errors.length) process.exitCode = 1;
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
