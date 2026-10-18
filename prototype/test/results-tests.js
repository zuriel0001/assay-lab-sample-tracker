// v11: assay results, certificates of analysis and lab batches with standards, blanks and duplicates.
// Several users on one shared in-memory store (see harness.js).
const H = require("./harness");
const { store, errors, newUser, launch, signIn, fillForm, ids, open, doc, toastText, batchDoc, waitFor, createBatch, fillBatch, saveBatch, runBatch } = H;
const OUT = __dirname;
const names = { u_z: "Zuriel" };
const log = (...a) => console.log("•", ...a);
const check = (cond, msg) => { console.log(cond ? "  PASS" : "  FAIL", msg); if (!cond) process.exitCode = 1; };
const DBG = (o) => process.env.DBG ? " " + JSON.stringify(o) : "";

async function receipt(page, id){ await open(page, id); await page.click('[data-receipt="confirm"]'); await waitFor(() => doc(id).stageKey === "received"); await page.waitForTimeout(400); }
const next = async (page, n = 1) => { for (let i = 0; i < n; i++){ const id = (await page.textContent(".sid")).trim(), k = doc(id).stageKey; await page.click('[data-step="next"]'); await waitFor(() => doc(id).stageKey !== k, 4000); await page.waitForTimeout(350); } };
const rec = open;
const showBatch = async (page, id) => { await page.click('#tabs button[data-tab="batches"]'); await page.waitForSelector(`[data-bsel="${id}"]`, { timeout: 5000 }); await page.click(`[data-bsel="${id}"]`); await page.waitForSelector("#batchBox", { timeout: 5000 }); await page.waitForTimeout(200); };
async function groupMove(page, sids, toKey){
  for (let guard = 0; guard < 15; guard++){
    const k = doc(sids[0]).stageKey; if (k === toKey) return true;
    await page.click(`[data-bmove="${k}"]`);
    await waitFor(() => sids.every(id => doc(id).stageKey !== k), 6000);
    await page.waitForTimeout(300);
  }
  return doc(sids[0]).stageKey === toKey;
}
const expected = async (page, p) => { const t = await page.$eval("#bp_" + p, e => e.closest("tr").children[3].textContent); const [v, sd] = t.split("±").map(x => parseFloat(x)); return { v, sd }; };
const posOf = (b, sid) => batchDoc(b).pos.find(x => x.t === "s" && x.sid === sid).p;

(async () => {
  const browser = await launch();
  require("./harness").useOldRoutes();   // v23: this suite is written around the routes in use before version 23
  await H.useQcStep(browser);   // v22: this suite is written around the QA/QC review step, which Settings now turn on
  const P = await newUser(browser, { uid: "u_p", name: "Public", canEdit: true, names });
  const Tc = await newUser(browser, { uid: "u_t", name: "Tech", canEdit: true, names }); await signIn(Tc, "tech1");
  const Sv = await newUser(browser, { uid: "u_s", name: "Super", canEdit: true, names }); await signIn(Sv, "super");
  const Ad = await newUser(browser, { uid: "u_a", name: "Admin", canEdit: true, names }); await signIn(Ad, "admin");
  await P.waitForTimeout(1800);

  log("Batch creation and layout");
  await fillForm(P, "submit", { section: "EXP", submitter: "Esi", count: 3 }); const ex = await ids(P);
  for (const id of ex) await receipt(Tc, id);
  await Tc.click('[data-tab="batches"]'); await Tc.waitForSelector("#nbProf");
  const opt = await Tc.$eval('#nbProf option[value="fa50"]', o => [o.textContent, o.disabled]);
  check(/3 samples ready/.test(opt[0]) && !opt[1], "fire assay batch type lists the 3 received samples: " + opt[0]);
  check(await Tc.$eval('#nbProf option[value="eluate"]', o => o.disabled), "batch types with no samples waiting can't be chosen");
  const b1 = await createBatch(Tc, "fa50", ex), B1 = batchDoc(b1);
  const kinds = t => B1.pos.filter(x => x.t === t).length;
  check(/^FA-\d{8}-01$/.test(b1) && B1.sids.join() === ex.join() && B1.pos.length === 10, `batch ${b1}: 3 samples and 7 QC positions (${B1.pos.map(x => x.t).join(" ")})`);
  check(B1.pos[0].t === "pb" && kinds("crm") === 2 && kinds("pd") === 2 && kinds("cd") === 1 && kinds("bl") === 1, "prep blank first, 1 crusher duplicate, 2 pulp duplicates, 2 CRMs, 1 analytical blank, as the rule says");
  check(B1.pos.filter(x => x.t === "pd" || x.t === "cd").every(d => B1.pos.find(y => y.t === "s" && y.sid === d.of)?.p < d.p), "each duplicate sits after its original");
  check(B1.pos.filter(x => x.t === "crm").every(x => /^STD-AU-/.test(x.crm)) && B1.crms.length === 2, "CRMs picked from the register for fire assay: " + B1.crms.join(", "));
  check(ex.every(id => doc(id).labBatch === b1 && doc(id).labQc === "pending" && doc(id).history.at(-1).note === `Added to lab batch ${b1}`), "samples carry the batch and log it");
  check(/50-position furnace batch/.test(await Tc.textContent("#batchBox")) && /within ±2 SD/.test(await Tc.textContent("#batchBox")), "batch shows the QC rule it enforces");
  await Tc.click('[data-tab="batches"]'); await Tc.waitForTimeout(200);
  check(!(await Tc.$('#nbProf option[value="fa50"]:not([disabled])')), "samples in an open batch are not offered for another batch");
  await rec(Tc, ex[0]);
  check(new RegExp(`Lab batch: ${b1}`).test(await Tc.textContent("#resPanel")), "sample record links its lab batch");

  log("Results need the samples at analysis; paste import");
  await showBatch(Tc, b1);
  await fillBatch(Tc, b1, () => "1.20");
  await Tc.click("#bSave"); await Tc.waitForTimeout(400);
  check(/not reached analysis/.test(await toastText(Tc)) && !batchDoc(b1).qc, "results can't be saved while samples are still in preparation");
  check(await groupMove(Tc, ex, "weigh") && ex.every(id => doc(id).history.at(-1).note === `Moved with lab batch ${b1}`), "the whole batch moves step by step to weighing, logged on each sample");
  check(await Tc.$eval("#bp_" + posOf(b1, ex[1]), e => e.value) === "1.20", "typed results survive the batch moves");
  const crmA = B1.pos.filter(x => x.t === "crm")[0], crmB = B1.pos.filter(x => x.t === "crm")[1];
  const up = await H.attachFile(Tc, `batch:${b1}`, "aas-run.csv", `Sample ID,Au (g/t)\nBLANK,<0.005\n${ex[1]},2.50\n${crmA.crm},9.99\nnot a line,1.0\n`);
  check(new RegExp(`Lab batch ${b1}: 3 values · \\d+ missing`).test(up) && /saved as a draft/.test(up) && /Not in the lab[^:]*: not a line/.test(up), "an attached file fills the batch by sample ID, CRM ID and blank; the rest is listed as missing: " + up.slice(0, 160));
  await H.saveAttach(Tc);
  const dr = batchDoc(b1).draft;
  check(dr && dr.vals[1].Au === "<0.005" && dr.vals[posOf(b1, ex[1])].Au === "2.50" && dr.vals[crmA.p].Au === "9.99" && batchDoc(b1).status === "results" && !batchDoc(b1).qc, "an incomplete file is kept on the batch as a draft");
  check(await Tc.$eval("#bp_1", e => e.value) === "<0.005" && await Tc.$eval("#bp_" + posOf(b1, ex[1]), e => e.value) === "2.50" && await Tc.$eval("#bp_" + crmA.p, e => e.value) === "9.99" && await Tc.$eval("#bp_" + posOf(b1, ex[0]), e => e.value) === "1.20", "the file's values replace what was typed in those boxes; other typed values stay");
  await Tc.fill("#bp_" + posOf(b1, ex[0]), "abc"); await Tc.click("#bSave"); await Tc.waitForTimeout(300);
  check(/not a number/.test(await toastText(Tc)) && !batchDoc(b1).qc, "a value that is not a number is refused");

  log("QC fails: CRM outside 3 SD, duplicate out of tolerance, blank too high");
  const eA = await expected(Tc, crmA.p), vals = { [ex[0]]: "1.20", [ex[1]]: "2.50", [ex[2]]: "0.80" };
  const pd1 = B1.pos.find(x => x.t === "pd"), bl1 = B1.pos.find(x => x.t === "bl");
  await fillBatch(Tc, b1, sid => vals[sid], { [crmA.p]: (eA.v + 3.5 * eA.sd).toFixed(3), [pd1.p]: (+vals[pd1.of] * 1.3).toFixed(2), [bl1.p]: "0.040" });
  await Tc.fill("#bInst", "AAS run 14-10-01");
  const q1 = await saveBatch(Tc, b1);
  const v = p => q1.checks.find(c => c.p === p)?.verdict;
  check(q1.status === "fail" && v(crmA.p) === "fail" && v(pd1.p) === "fail" && v(bl1.p) === "fail" && v(crmB.p) === "pass", "QC verdicts: CRM +3.5 SD fails, duplicate 26% apart fails, blank 0.040 fails, other CRM passes" + DBG(q1.checks));
  check(ex.every(id => doc(id).labQc === "fail" && doc(id).results.rows.Au.v === +vals[id] && doc(id).results.batch === b1 && doc(id).results.inst === "AAS run 14-10-01"), "each sample gets its batch result, instrument file and the QC verdict");
  check(/QC failed/.test(await Tc.textContent("#batchBox")) && !(await Tc.$("[data-bdec]")), "technician sees the failure but cannot decide on it");
  await showBatch(Sv, b1);
  const svDec = await Sv.$$eval("[data-bdec]", bs => bs.map(b => b.dataset.bdec));
  check(svDec.join() === "rerun,reopen", "supervisor can re-run the batch or correct an entry; a failure can't simply be accepted: " + svDec.join());
  await showBatch(Ad, b1);
  check((await Ad.$$eval("[data-bdec]", bs => bs.map(b => b.dataset.bdec))).includes("override"), "the lab manager (admin) alone can accept a failure as a documented exception");
  await Sv.click('[data-bdec="reopen"]'); await Sv.waitForTimeout(300);
  check(/reason/.test(await toastText(Sv)) && batchDoc(b1).qc, "every batch decision needs a reason");
  await Sv.fill("#bWhy", "Blank and duplicate typed from the wrong worksheet column"); await Sv.click('[data-bdec="reopen"]');
  await waitFor(() => !batchDoc(b1).qc && ex.every(id => doc(id).labQc === "pending")); await Sv.waitForTimeout(300);
  check(!batchDoc(b1).qc && batchDoc(b1).status === "results" && /opened again/.test(batchDoc(b1).log.at(-1).note), "results opened again for correction, logged on the batch");

  log("QC warning, supervisor acceptance and batch release");
  await showBatch(Tc, b1);
  check(await Tc.$eval("#bp_" + posOf(b1, ex[2]), e => e.value) === "0.80", "the earlier entries come back for correction");
  await fillBatch(Tc, b1, sid => vals[sid], { [crmA.p]: (eA.v + 2.4 * eA.sd).toFixed(3) });
  const q2 = await saveBatch(Tc, b1);
  check(q2.status === "warn" && q2.checks.find(c => c.p === crmA.p).verdict === "warn" && ex.every(id => doc(id).labQc === "warn"), "a CRM at +2.4 SD is a warning");
  check(doc(ex[1]).results.rows.Au.src === "file" && !doc(ex[0]).results.rows.Au.src && batchDoc(b1).log.some(l => /^Results from file aas-run\.csv; \d+ values typed; QC warn/.test(l.note)) && batchDoc(b1).qc.file?.name === "aas-run.csv",
    "v18: saved again after the correction, the value left as the file gave it is still from the file, the typed ones are not, and the batch log says so" + DBG({ r1: doc(ex[1]).results.rows.Au, log: batchDoc(b1).log.map(l => l.note) }));
  await showBatch(Tc, b1);
  check(await groupMove(Tc, ex, "qc"), "samples with batch results move on to QA/QC review");
  await showBatch(Sv, b1);
  check(await Sv.$eval("#bRelease", b => b.disabled) && /for 0 samples/.test(await Sv.textContent("#bRelease")), "release is held while the warnings are not accepted");
  await rec(Sv, ex[0]);
  check(await Sv.$eval('[data-step="next"]', b => b.disabled) && /QC warnings/.test(await Sv.textContent("#holdNote")), "the sample record says why the release is held");
  await showBatch(Sv, b1);
  await Sv.fill("#bWhy", "CRM at +2.4 SD, the other CRM, duplicates and blanks in control"); await Sv.click('[data-bdec="accept"]');
  await waitFor(() => ex.every(id => doc(id).labQc === "accepted")); await Sv.waitForTimeout(400);
  check(batchDoc(b1).qc.accepted?.why && !batchDoc(b1).qc.accepted.exception && ex.every(id => /warnings accepted/.test(doc(id).labQcNote)), "warnings accepted on the batch and noted on each sample");
  check(!(await Sv.$eval("#bRelease", b => b.disabled)) && /for 3 samples/.test(await Sv.textContent("#bRelease")), "release now offered for the 3 samples");
  await Sv.click("#bRelease");
  await waitFor(() => ex.every(id => doc(id).stageKey === "released") && batchDoc(b1).open === false, 8000);
  const c0 = doc(ex[0]).certs?.[0];
  check(ex.every(id => doc(id).stageKey === "released" && doc(id).certs.length === 1 && doc(id).certs[0].no === id + "-R1"), "each sample released with its own certificate R1");
  check(c0 && c0.batch === b1 && c0.qc === "accepted" && /warnings accepted/.test(c0.qcNote) && c0.rows.Au.v === 1.2 && c0.an[0].u === "g/t" && c0.inst === "AAS run 14-10-01" && c0.tech === "Lab Supervisor", "certificate keeps the result, unit, batch, QC acceptance, instrument file and who released it");
  check(batchDoc(b1).status === "done" && batchDoc(b1).open === false, "batch closes when all its results are released");

  log("Certificate of analysis");
  await rec(Sv, ex[0]);
  check(/Certificate .*-R1/.test(await Sv.textContent("#resPanel")) && /1\.200/.test(await Sv.textContent("#resPanel")), "record shows the released result and certificate number");
  await Sv.click("[data-cert]"); await Sv.waitForSelector("#certBox:not([hidden]) .cert");
  const certText = await Sv.textContent("#certBox");
  check(/Certificate of analysis/.test(certText) && certText.includes(ex[0] + "-R1") && /1\.200/.test(certText) && /warnings accepted/.test(certText) && /not an official laboratory certificate/.test(certText), "certificate shows the number, result, QC note and the prototype disclaimer");
  await Sv.screenshot({ path: OUT + "/certificate.png", fullPage: false });
  await Sv.click("#certDl"); await Sv.waitForTimeout(300);
  const dl = await Sv.evaluate(() => window.__downloaded);
  check(dl?.filename === ex[0] + "-R1.html" && /Certificate of analysis/.test(dl.data) && /<style>/.test(dl.data), "certificate downloads as a standalone HTML file");
  await Sv.keyboard.press("Escape"); await Sv.waitForTimeout(150);
  check(await Sv.$eval("#certBox", b => b.hidden), "Escape closes the certificate");

  log("Amended certificate");
  await rec(Sv, ex[1]);
  await Sv.click("#amBox summary"); await Sv.fill("#am_Au", "2.05"); await Sv.click("#amBtn"); await Sv.waitForTimeout(300);
  check(/reason/.test(await toastText(Sv)) && doc(ex[1]).certs.length === 1, "an amendment needs a reason");
  await Sv.fill("#amWhy", "Dilution factor applied twice in the worksheet"); await Sv.click("#amBtn");
  await waitFor(() => doc(ex[1]).amend); await Sv.waitForTimeout(400);
  check(doc(ex[1]).certs.length === 1 && doc(ex[1]).amend.rows.Au.v === 2.05 && !(await Sv.$("#amApprove")) && /Another lab supervisor or the lab manager approves/.test(await Sv.textContent("#amPend")), "the amendment is proposed; the person who proposed it can't approve it");
  const fromFile = doc(ex[1]).results.rows.Au.src;
  await rec(Ad, ex[1]); await Ad.click("#amApprove");
  await waitFor(() => doc(ex[1]).certs.length === 2); await Sv.waitForTimeout(400);
  check(doc(ex[1]).certs[1].amendBy?.tech && doc(ex[1]).certs[1].by === "admin" && !doc(ex[1]).amend, "a second person (the lab manager) approves it and R2 records both");
  check(fromFile === "file" && doc(ex[1]).results.rows.Au.v === 2.05 && !doc(ex[1]).results.rows.Au.src, "v18: the amended value replaces the one read from the file whole: it is no longer marked as from the file" + DBG({ fromFile, row: doc(ex[1]).results.rows.Au }));
  const am = doc(ex[1]).certs;
  check(am[1].no === ex[1] + "-R2" && am[1].amends === ex[1] + "-R1" && /Dilution/.test(am[1].why) && am[1].rows.Au.v === 2.05 && am[0].rows.Au.v === 2.5, "R2 amends R1 with the reason; R1 stays unchanged on record");
  check(/Amended/.test(await Sv.textContent("#resPanel")) && /Earlier versions/.test(await Sv.textContent("#resPanel")), "record marks the amendment and lists the earlier version");
  await Sv.click('button.linkish[data-cert="1"]'); await Sv.waitForSelector("#certBox:not([hidden]) .cert");
  check(/2\.500/.test(await Sv.textContent("#certBox")) && !/Amended certificate/.test(await Sv.textContent("#certBox .cert")), "the original R1 can still be opened");
  await Sv.click("#certClose");

  log("Who can see results");
  const G = await newUser(browser, { uid: "u_g", name: "Guest", canEdit: false, names });
  await open(G, ex[1]);
  const gTxt = await G.textContent("#resPanel");
  check(/released/.test(gTxt) && !/2\.050/.test(gTxt) && !(await G.$("[data-cert]")), "without signing in, the record says results are released but shows no values");
  await Ad.click('[data-tab="stages"]'); await Ad.waitForSelector("#cfgResPub");
  await Ad.selectOption("#cfgResPub", "1"); await Ad.click("#cfgSave"); await waitFor(() => store["settings/stages"]?.resultsPublic === true); await G.waitForTimeout(600);
  await open(G, ex[1]);
  check(/2\.050/.test(await G.textContent("#resPanel")), "when the admin opens results to anyone with the ID, the values show");
  await Ad.selectOption("#cfgResPub", "0"); await Ad.click("#cfgSave"); await waitFor(() => store["settings/stages"]?.resultsPublic === false);

  log("Failed batch re-run");
  await fillForm(P, "submit", { section: "EXP", submitter: "Kofi", count: 2 }); const rr = await ids(P);
  for (const id of rr) await receipt(Tc, id);
  const b2 = await createBatch(Tc, "fa50", rr);
  check(/^FA-\d{8}-02$/.test(b2), "next batch number of the day: " + b2);
  await groupMove(Tc, rr, "finish");
  const crm2 = batchDoc(b2).pos.find(x => x.t === "crm"), e2 = await expected(Tc, crm2.p);
  await fillBatch(Tc, b2, () => "0.95", { [crm2.p]: (e2.v - 3.6 * e2.sd).toFixed(3) });
  const q3 = await saveBatch(Tc, b2);
  check(q3.status === "fail", "CRM at −3.6 SD fails the batch");
  await showBatch(Sv, b2); await Sv.fill("#bWhy", "CRM low: re-fuse the batch"); await Sv.click('[data-bdec="rerun"]');
  const b2r = await waitFor(() => batchDoc(b2).rerunBy);
  await waitFor(() => rr.every(id => doc(id).labBatch === b2r)); await Sv.waitForTimeout(400);
  check(b2r && batchDoc(b2).open === false && batchDoc(b2).status === "rerun" && batchDoc(b2r).rerunOf === b2 && batchDoc(b2r).sids.join() === rr.join(), `re-run as ${b2r}; the failed batch is closed and kept`);
  check(rr.every(id => doc(id).stageKey === "fuse" && doc(id).reassays === 1 && doc(id).labQc === "pending" && !doc(id).results && doc(id).resHist.length === 1), "samples go back to fusion as a re-assay; earlier results moved to the history");
  await showBatch(Tc, b2r);
  await fillBatch(Tc, b2r, () => "0.97");
  const q4 = await saveBatch(Tc, b2r);
  check(q4.status === "pass" && rr.every(id => doc(id).labQc === "pass" && doc(id).results.rows.Au.v === 0.97), "re-run passes");
  await rec(Tc, rr[0]); await next(Tc, 2);
  check(doc(rr[0]).stageKey === "qc", "sample walks on to QA/QC review on its own");
  await rec(Sv, rr[0]); await next(Sv, 1);
  check(doc(rr[0]).stageKey === "released" && doc(rr[0]).certs[0].batch === b2r && doc(rr[0]).certs[0].rows.Au.v === 0.97, "released from the record with the re-run result on the certificate");

  log("Failure accepted as an exception (lab manager)");
  await fillForm(P, "submit", { section: "EXP", submitter: "Ama" }); const [xo] = await ids(P);
  await receipt(Tc, xo);
  const b3 = await createBatch(Tc, "fa50", [xo]); await groupMove(Tc, [xo], "finish");
  await fillBatch(Tc, b3, () => "4.40", { [batchDoc(b3).pos.find(x => x.t === "bl").p]: "0.09" });
  check((await saveBatch(Tc, b3)).status === "fail", "blank 0.09 g/t fails the batch");
  await showBatch(Sv, b3);
  check(!(await Sv.$('[data-bdec="override"]')), "a supervisor is not offered the exception");
  await showBatch(Ad, b3); await Ad.fill("#bWhy", "Blank contaminated by the previous high-grade crucible; sample is a 4 g/t ore and the client needs it today"); await Ad.click('[data-bdec="override"]');
  await waitFor(() => doc(xo).labQc === "accepted"); await Ad.waitForTimeout(300);
  check(batchDoc(b3).qc.accepted.exception === true && /exception/.test(doc(xo).labQcNote), "exception recorded on the batch and on the sample");
  await rec(Tc, xo); await next(Tc, 1); await rec(Sv, xo); await next(Sv, 1);
  check(doc(xo).stageKey === "released" && /exception/.test(doc(xo).certs[0].qcNote), "the certificate carries the exception and its reason");

  log("Over-range result repeated by gravimetric finish");
  await fillForm(P, "submit", { section: "EXP", submitter: "Yaw" }); const [hg] = await ids(P);
  await receipt(Tc, hg);
  const b4 = await createBatch(Tc, "fa50", [hg]); await groupMove(Tc, [hg], "finish");
  await fillBatch(Tc, b4, () => "14.2");
  check((await saveBatch(Tc, b4)).status === "pass" && doc(hg).results.rows.Au.f === "over", "14.2 g/t is above the 10 g/t AAS range and flagged");
  await rec(Tc, hg);
  check(/Over the method's range/.test(await Tc.textContent("#resPanel")), "record flags the over-range result");
  await next(Tc, 1); await rec(Sv, hg);
  check(await Sv.$eval('[data-step="next"]', b => b.disabled) && /over the method's range/.test(await Sv.textContent("#holdNote")), "an over-range result can't be released");
  await rec(Tc, hg); await Tc.click("#overBtn"); await waitFor(() => doc(hg).grav === "Au"); await Tc.waitForTimeout(300);
  check(doc(hg).stageKey === "fuse" && doc(hg).grav === "Au" && !doc(hg).labBatch && !doc(hg).results && doc(hg).reassays === 1, "sent back to fusion for a gravimetric finish, out of its AAS batch");
  await Tc.click('[data-tab="batches"]'); await Tc.waitForSelector("#nbProf");
  check(/1 sample ready/.test(await Tc.$eval('#nbProf option[value="grav"]', o => o.textContent)), "it now waits for a gravimetric batch");
  const b5 = await runBatch(Tc, "grav", [hg], () => "14.35");
  check(batchDoc(b5).pos.filter(x => x.t === "pd").length === 1 && batchDoc(b5).crms.every(c => ["STD-AU-HIGH", "STD-AU-CONC"].includes(c)) && doc(hg).labQc === "pass", "gravimetric batch repeats every sample and uses a high-grade CRM");
  await rec(Tc, hg); await next(Tc, 2); await rec(Sv, hg); await next(Sv, 1);
  const gc = doc(hg).certs?.[0];
  check(doc(hg).stageKey === "released" && gc.rows.Au.v === 14.35 && /gravimetric finish/.test(gc.an[0].n) && gc.batch === b5, "released with the gravimetric result and method on the certificate");

  log("Testwork: checks on each sample's results");
  await fillForm(P, "submit", { section: "MET", type: "met_comp", purpose: "met", submitter: "Plant met" }); const [br] = await ids(P);
  await receipt(Tc, br);
  check(doc(br).route === "BRT" && doc(br).qcp === "", "bottle roll has no lab batch; its checks run on its own results");
  const qi = doc(br).plan.findIndex(x => x.phase === "qc"), ci = doc(br).plan.findIndex(x => x.key === "received");
  await rec(Tc, br); await next(Tc, qi - ci - 1);
  { const dis = await Tc.$eval('[data-step="next"]', b => b.disabled).catch(() => "none"), hn = await Tc.textContent("#holdNote").catch(() => "none");
    check(dis === true && /Missing: Head grade \(assayed\)/.test(hn), "QA/QC review needs the results first" + DBG({ dis, hn, st: doc(br).stageKey })); }
  check(await Tc.isVisible('[data-attach="sample:' + br + '"]') && !(await Tc.$eval("#resBox", d => d.open)), "v18: the record offers Attach results file; typing sits under Type results instead");
  await Tc.click("#resBox summary");
  await Tc.fill("#rs_head", "1.5x"); await Tc.click("#rsSave"); await Tc.waitForTimeout(300);
  check(/not a number/.test(await toastText(Tc)) && !doc(br).results, "a mistyped result is refused");
  check(!(await Tc.$("input#rs_rec")), "recovery is not typed: it is worked out from the calculated head and the residue");
  for (const [k, x] of [["head", "1.50"], ["chead", "2.00"], ["res", "0.20"], ["nacn", "0.55"], ["lime", "1.2"]]) await Tc.fill("#rs_" + k, x);
  await Tc.click("#rsSave"); await waitFor(() => doc(br).results); await Tc.waitForTimeout(400);
  check(doc(br).results.rows.rec?.calc && doc(br).results.rows.rec.v === 90, "recovery calculated as 90.0%: " + doc(br).results.rows.rec?.v);
  check(/calculated head is more than 10%/.test(await Tc.textContent("#resPanel")), "the head-grade balance check fails and is shown");
  await next(Tc, 1);
  check(doc(br).stageKey === "qc", "results entered: on to QA/QC review");
  await rec(Sv, br);
  check(await Sv.$eval('[data-step="next"]', b => b.disabled) && /fail a check/.test(await Sv.textContent("#holdNote")), "release held by the failed check");
  await Sv.fill("#accWhy", "Coarse gold in the head: assayed head under-reports; calculated head accepted"); await Sv.click("#accBtn");
  await waitFor(() => doc(br).resAcc); await Sv.waitForTimeout(400);
  await next(Sv, 1);
  check(doc(br).stageKey === "released" && /Coarse gold/.test(doc(br).certs[0].acc.why), "supervisor accepts it with a reason, which is printed on the certificate");

  log("Two technicians batch the same samples at once");
  await fillForm(P, "submit", { section: "EXP", submitter: "Race", count: 2 }); const rc = await ids(P);
  for (const id of rc) await receipt(Tc, id);
  const T2 = await newUser(browser, { uid: "u_t2", name: "Tech2", canEdit: true, names }); await signIn(T2, "tech2");
  const before = new Set(Object.keys(store).filter(k => k.startsWith("batches/")));
  for (const pg of [Tc, T2]){ await pg.click('[data-tab="batches"]'); await pg.waitForSelector("#nbProf"); await pg.selectOption("#nbProf", "fa50"); await pg.waitForSelector("#nbCreate"); await pg.$$eval("#nbList input[type=checkbox]", (els, ids) => els.forEach(e => { e.checked = ids.includes(e.value); }), rc); }
  await Promise.all([Tc.click("#nbCreate"), T2.click("#nbCreate")]);
  await waitFor(() => rc.every(id => doc(id).labBatch), 8000); await Tc.waitForTimeout(1500);
  const made = Object.keys(store).filter(k => k.startsWith("batches/") && !before.has(k)).map(k => store[k]);
  const holders = rc.map(id => made.filter(b => (b.sids || []).includes(id)).length);
  check(holders.every(n => n === 1) && rc.every(id => made.find(b => b.id === doc(id).labBatch)?.sids.includes(id)), `each sample is in exactly one batch (${made.map(b => `${b.id}: ${b.sids.length}`).join(", ")})`);
  await waitFor(() => !Object.values(store).some(b => b && b.status === "creating"), 20000);
  check(!Object.values(store).some(b => b && Array.isArray(b.pos) && b.status === "creating") && !Object.values(store).some(b => b && Array.isArray(b.pos) && b.open && !(b.sids || []).length), "the losing batch is removed, not left empty");
  // A device that lost its connection while creating a batch: the batch is finished from the samples that joined it.
  await fillForm(P, "submit", { section: "EXP", submitter: "Crash" }); const [cr] = await ids(P); await receipt(Tc, cr);
  const crId = `FA-${H.T}-90`;
  store["batches/" + crId] = { id: crId, qcp: "fa50", an: { k: "Au", n: "Gold", u: "g/t", dl: 0.005, dp: 3, ul: 10 }, at: Date.now() - 180000, day: "", month: "", by: "tech1", tech: "Lab Technician A", open: true, status: "creating", sids: [], pos: [], crms: [], qc: null, log: [] };
  store["samples/" + cr] = { ...doc(cr), labBatch: crId, labQc: "pending" }; await H.broadcast("samples/" + cr, store["samples/" + cr]); await H.broadcast("batches/" + crId, store["batches/" + crId]);
  const R2 = await newUser(browser, { uid: "u_r", name: "Late", canEdit: true, names });
  await waitFor(() => batchDoc(crId)?.status === "prep", 8000);
  check(batchDoc(crId)?.status === "prep" && batchDoc(crId).sids.join() === cr && batchDoc(crId).pos.length === 8, "an interrupted batch is finished from the sample that had joined it");
  await R2.close();

  log("Control chart, CRM register, routes and roles");
  await Tc.click('[data-tab="batches"]'); await Tc.waitForSelector("#chCrm");
  await Tc.selectOption("#chCrm", `${crmA.crm}|Au|g/t`);
  await Tc.waitForSelector("#chBox svg", { timeout: 4000 }).catch(() => {});
  const nPts = Object.values(store).filter(b => b && b.qc && Array.isArray(b.pos)).reduce((n, b) => n + b.pos.filter(x => x.t === "crm" && x.crm === crmA.crm && (x.rs || x.r)).length, 0);
  check(await Tc.$$eval("#chBox circle", c => c.length) === nPts && nPts >= 2, `control chart plots every result for ${crmA.crm} (${nPts})`);
  await Tc.screenshot({ path: OUT + "/batches.png", fullPage: true });
  await Ad.click('[data-tab="stages"]'); await H.cfgTab(Ad, "crms"); await Ad.waitForSelector("[data-cf]");
  check(await Ad.$$eval('[data-cf="id"]', e => e.length) === 49 && /Example values/.test(await Ad.textContent("#view-stages")), "settings list the example reference materials (49 certified results), marked as placeholders");
  const medRow = await Ad.$$eval('[data-cf="id"]', es => es.findIndex(e => e.value === "STD-AU-MED"));
  await Ad.fill(`[data-ci="${medRow}"][data-cf="val"]`, "2.11"); await Ad.press(`[data-ci="${medRow}"][data-cf="val"]`, "Tab");
  const lowRow = await Ad.$$eval('[data-cf="id"]', es => es.findIndex(e => e.value === "STD-AU-LOW"));
  await Ad.fill(`[data-ci="${lowRow}"][data-cf="sd"]`, "0"); await Ad.press(`[data-ci="${lowRow}"][data-cf="sd"]`, "Tab");
  await Ad.click("#cfgSave"); await Ad.waitForTimeout(300);
  check(/standard deviation/.test(await toastText(Ad)) && store["settings/stages"].crms.find(c => c.id === "STD-AU-MED").val === 2.08, "a CRM used in SD-judged batches needs its SD before settings save");
  await Ad.fill(`[data-ci="${lowRow}"][data-cf="sd"]`, "0.025"); await Ad.press(`[data-ci="${lowRow}"][data-cf="sd"]`, "Tab");
  await Ad.click("#cfgSave"); await waitFor(() => store["settings/stages"].crms.find(c => c.id === "STD-AU-MED").val === 2.11);
  check(store["settings/stages"].crms.find(c => c.id === "STD-AU-MED").val === 2.11, "certified value updated in the register");
  // The batch that lost the race above is deleted; pick from the batches still in the store (the race can go either way).
  const liveMade = () => made.map(b => store["batches/" + b.id]).filter(b => b && (b.sids || []).length);
  const openCrm = liveMade().find(b => b.open)?.pos.find(x => x.crm)?.crm;
  await Ad.waitForTimeout(400);
  const rmRow = await Ad.$$eval('[data-cf="id"]', (es, id) => es.findIndex(e => e.value === id), openCrm);
  await Ad.click(`[data-crm-rm="${rmRow}"]`); await Ad.waitForTimeout(200);
  check(openCrm && /open batch/.test(await toastText(Ad)), `${openCrm} can't be removed while an open batch uses it`);
  await H.cfgTab(Ad, "routes");
  const rtIdx = await Ad.$$eval("#rtPick option", os => os.findIndex(o => o.textContent.startsWith("EXP-FA")));
  await Ad.selectOption("#rtPick", String(rtIdx)); await Ad.waitForSelector("#rtQcp");
  check(await Ad.$eval("#rtQcp", s => s.value) === "fa50", "route editor shows the route's batch type");
  await Ad.selectOption("#rtQcp", "gc25"); await Ad.waitForTimeout(200);
  check(/^Per 25-position batch/.test(await Ad.$eval('[data-rf="qc"]', t => t.value)), "choosing another batch type rewrites the QA/QC rule to match it");
  await Ad.click("#cfgCancel");
  await Tc.click('[data-tab="routes"]'); await Tc.waitForSelector("#rtList");
  await Tc.click('#route-EXP-FA summary');
  const rt = await Tc.textContent("#route-EXP-FA");
  check(/Results reported:\s*Gold \(g\/t\)/.test(rt) && /Lab batch:\s*Fire assay, 50-position furnace batch/.test(rt), "routes tab shows what each route reports and its batch");
  const Vw = await newUser(browser, { uid: "u_v", name: "Viewer", canEdit: false, names }); await signIn(Vw, "viewer");
  await Vw.click('[data-tab="batches"]'); await Vw.waitForTimeout(400);
  check(!(await Vw.$("#nbProf")) && (await Vw.$$("[data-bsel]")).length >= 1, "viewer sees batches but can't create one");
  const ob = liveMade().find(b => b.open);
  await Vw.click(`[data-bsel="${ob.id}"]`); await Vw.waitForSelector("#batchBox");
  check(!(await Vw.$("#bSave")) && !(await Vw.$("[data-bmove]")) && !(await Vw.$("input[id^=bp_]")), "viewer can't enter results or move samples");
  await Tc.click('[data-tab="board"]'); await Tc.waitForTimeout(300);
  // v15: summary chips show counts above zero only, so the chip appears exactly when an in-lab card has no batch.
  const nb = await Tc.evaluate(() => { const c = document.querySelector('[data-bpick="nobatch"] .n'); return { chip: c ? +c.textContent : 0, cards: [...document.querySelectorAll(".lane.ph-intake .chip, .lane.ph-prep .chip, .lane.ph-test .chip, .lane.ph-qc .chip")].filter(x => !/Batch /.test(x.textContent)).length }; });
  check(new RegExp(`Batch ${ob.id}`).test(await Tc.textContent("#view-board")) && nb.chip === nb.cards, `board cards show the batch; the summary counts samples waiting for one (${nb.chip})`);

  log("Phone layout");
  const ph = await newUser(browser, { uid: "u_ph", name: "Ph", canEdit: true, names }, { width: 375, height: 760 }, "dark");
  await signIn(ph, "super");
  await H.tab(ph, "batches"); await ph.waitForTimeout(300);
  await ph.click(`[data-bsel="${ob.id}"]`); await ph.waitForSelector("#batchBox");
  check(await ph.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "batches tab fits a 375 px phone");
  await ph.screenshot({ path: OUT + "/batches-phone-dark.png", fullPage: true });
  await open(ph, ex[0]); await ph.click("[data-cert]"); await ph.waitForSelector("#certBox:not([hidden]) .cert");
  check(await ph.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "certificate fits a phone");
  await ph.screenshot({ path: OUT + "/certificate-phone-dark.png" });
  await open(ph, br);
  check(await ph.$eval("#certBox", b => b.hidden), "opening another sample closes the certificate");
  await ph.screenshot({ path: OUT + "/record-results-phone-dark.png", fullPage: true });

  console.log(errors.length ? "Console errors:\n" + errors.join("\n") : "Console errors: none");
  if (errors.length) process.exitCode = 1;
  await browser.close();
})().catch(e => { console.error(e); process.exitCode = 1; process.exit(1); });
