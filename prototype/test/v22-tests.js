// v22: no QA/QC review step unless Settings use it. The release follows the last analysis step, results are needed only to release,
// the sampling point is never a missing result, a limit tied to a sampling point applies when none is chosen, the board shows the samples
// ready for release, and the old step comes back with Settings > QA/QC review step: Before release.
// Run: NODE_PATH=$(npm root -g) timeout 590 node v22-tests.js
const H = require("./harness");
const { store, errors, newUser, launch, signIn, fillForm, ids, open, doc, waitFor } = H;
const names = {};
const log = (...a) => console.log("•", ...a);
const check = (cond, msg) => { console.log(cond ? "  PASS" : "  FAIL", msg); if (!cond) process.exitCode = 1; };
const text = async (page, sel) => ((await page.textContent(sel).catch(() => "")) || "").replace(/\s+/g, " ").trim();
const showBatch = async (page, id) => { await H.tab(page, "batches"); await page.waitForSelector(`[data-bsel="${id}"]`, { timeout: 5000 }); await page.click(`[data-bsel="${id}"]`); await page.waitForSelector("#batchBox", { timeout: 5000 }); await page.waitForTimeout(250); };
/* Clicks "Move to" until the next step is the release (or a held step). */
async function toLast(page, id){
  for (let g = 0; g < 25; g++){
    await open(page, id); await page.waitForTimeout(200);
    const st = await page.$eval('[data-step="next"]', b => ({ t: b.textContent.trim(), d: b.disabled })).catch(() => null);
    if (!st) return text(page, "#moveForm .row > span.small.muted");
    if (!/^Move to:/.test(st.t) || st.d) return st.t;
    const k = doc(id).stageKey; await page.click('[data-step="next"]', { timeout: 5000 }).catch(() => {}); await waitFor(() => doc(id).stageKey !== k, 5000); await page.waitForTimeout(300);
  }
  return "";
}
async function typeResults(page, id, vals){
  await open(page, id); await page.$eval("#resBox", d => { d.open = true; });
  for (const [k, v] of Object.entries(vals)){ const sel = "#rs_" + k; if (await page.$eval(sel, e => e.tagName) === "SELECT") await page.selectOption(sel, v); else await page.fill(sel, v); }
  const n = (doc(id).results?.v || 0); await page.click("#rsSave"); await waitFor(() => (doc(id).results?.v || 0) > n, 5000); await page.waitForTimeout(400);
}
const rail = page => page.$$eval(".rail li", ls => ls.map(l => l.textContent.replace(/\s+/g, " ").trim()));
async function setQcStep(Ad, on){
  await H.tab(Ad, "stages"); await Ad.waitForSelector("#cfgQcStep"); await H.cfgTab(Ad, "accounts").catch(() => {});
  await Ad.selectOption("#cfgQcStep", on ? "1" : "0"); await Ad.click("#cfgSave");
  await waitFor(() => store["settings/stages"]?.qcStep === on, 5000); await Ad.waitForTimeout(600);
}

(async () => {
  const browser = await launch();
  const Tc = await newUser(browser, { uid: "u_t", name: "Tech", canEdit: true, names }); await signIn(Tc, "tech1");
  const Sv = await newUser(browser, { uid: "u_s", name: "Super", canEdit: true, names }); await signIn(Sv, "super");
  const Ad = await newUser(browser, { uid: "u_a", name: "Admin", canEdit: true, names }); await signIn(Ad, "admin");
  await Tc.waitForTimeout(1000);

  log("Settings: the QA/QC review step is not used by default");
  await H.tab(Ad, "stages"); await Ad.waitForSelector("#cfgQcStep");
  check(await Ad.$eval("#cfgQcStep", e => e.value) === "0" && await Ad.$eval("#cfgQcStep", e => e.selectedOptions[0].textContent) === "Not used", "Settings: QA/QC review step is Not used");
  check(/Lab batch before release/.test(await text(Ad, "#view-stages")), "the lab batch switch reads Lab batch before release");

  log("A CCD sample goes from its last analysis step to the release");
  await H.tab(Tc, "submit"); await Tc.waitForSelector("#rSubmit");
  await Tc.selectOption("#rSection", "MET"); await Tc.selectOption("#rType", "ccd"); await Tc.selectOption("#rPurpose", "plant"); await Tc.selectOption("#rTest", "ccd"); await Tc.waitForTimeout(300);
  await Tc.$eval("#rRoute details", d => { d.open = true; }).catch(() => {});
  const prev = await text(Tc, "#rRoute");
  check(/CCD-SVY/.test(prev) && /Wash efficiency/.test(prev) && /Results released/.test(prev) && !/QA\/QC review/.test(prev), "the route preview on Submit has no QA/QC review step");
  await fillForm(Tc, "register", { section: "MET", type: "ccd", purpose: "plant", test: "ccd", submitter: "Plant metallurgist", count: 3, tags: "CCD-1, CCD-2, CCD-3" });
  const [c1, c2, c3] = await ids(Tc);
  check(doc(c1).route === "CCD-SVY" && doc(c1).plan.some(x => x.key === "qc"), "the sample keeps its route's steps as stored (so the step can come back)");
  await open(Tc, c1);
  let r = await rail(Tc);
  check(!r.some(x => /QA\/QC review/.test(x)) && r.some(x => /Wash efficiency/.test(x)) && r.some(x => /Results released/.test(x)), "the record shows no QA/QC review step: " + r.map(x => x.slice(0, 24)).join(" | "));
  const end = await toLast(Tc, c1);
  check(doc(c1).stageKey === "calc", "it moves through every step to Wash efficiency without being stopped (at " + doc(c1).stageKey + ")");
  check(/A lab supervisor releases the results\.$/.test(end) && !/QA\/QC/.test(end), "the technician sees: A lab supervisor releases the results. (" + end + ")");
  const hold = await text(Tc, "#holdNote");
  check(/^Release on hold: Results missing: Solution gold, Solids gold\.$/.test(hold), "the note asks only for the results the release needs, not the sampling point: " + hold);

  log("Results typed on the record, then a supervisor releases");
  await typeResults(Tc, c1, { Au_s: "0.012", Au: "0.35" });
  check(!(await Tc.$("#holdNote")), "with the results in, nothing is on hold");
  check(await Tc.$eval("#rs_pt", e => e.tagName === "SELECT" && [...e.options].some(o => o.textContent === "Final underflow")).catch(() => false), "the sampling point can still be chosen with the results");
  await H.tab(Sv, "board"); await Sv.waitForTimeout(500);
  const tile = await Sv.$('[data-bpick="relready"]');
  check(!!tile && /^1\s*Ready for release/.test((await tile.textContent()).replace(/\s+/g, " ").trim()), "the board has a Ready for release tile with 1");
  check(!(await Sv.$('[data-bpick="nobatch"]')), "and no Waiting for a lab batch tile while batches are optional");
  const lane = await Sv.$eval(".lane.ph-qc", l => ({ h: l.querySelector("h4").textContent.replace(/\s+/g, " ").trim(), ids: [...l.querySelectorAll("[data-open]")].map(b => b.dataset.open) }));
  check(/^Ready for release 1$/.test(lane.h) && lane.ids.join() === c1, "the QA/QC lane is now Ready for release, holding the sample: " + JSON.stringify(lane));
  check(!(await Sv.$eval(".lane.ph-test", l => [...l.querySelectorAll("[data-open]")].map(b => b.dataset.open))).includes(c1), "it is no longer in the analysis lane");
  await open(Sv, c1);
  check(/Release results and issue certificate/.test(await text(Sv, '[data-step="next"]')) && !(await Sv.$eval('[data-step="next"]', b => b.disabled)), "the supervisor can release it straight from Wash efficiency");
  await Sv.click('[data-step="next"]'); await waitFor(() => doc(c1).stageKey === "released", 6000);
  check(doc(c1).stageKey === "released" && (doc(c1).certs || []).length === 1 && !doc(c1).history.some(h => h.key === "qc"), "released with a certificate, and no QA/QC review in its history");

  log("A limit tied to a sampling point applies when none is chosen");
  await toLast(Tc, c2);
  await typeResults(Tc, c2, { Au_s: "0.080", Au: "0.40" });
  await open(Sv, c2);
  let h2 = await text(Sv, "#holdNote");
  check(/action limit of 0\.05/.test(h2) && /Final underflow/.test(h2), "solution gold 0.080 with no sampling point holds the release for the Final underflow limit: " + h2);
  await typeResults(Tc, c2, { pt: "Thickener feed" });
  await open(Sv, c2); h2 = await text(Sv, "#holdNote");
  check(!h2 && !(await Sv.$eval('[data-step="next"]', b => b.disabled)), "choosing Thickener feed lifts it (the limit is for the final underflow)" + (h2 ? ": " + h2 : ""));
  await typeResults(Tc, c2, { pt: "Final underflow" });
  await open(Sv, c2);
  check(/action limit/.test(await text(Sv, "#holdNote")), "choosing Final underflow keeps it");

  log("A lab batch releases its samples from their last step");
  await fillForm(Tc, "register", { section: "EXP", submitter: "Ama Mensah", count: 2, tags: "DH-301" }); const ex = await ids(Tc);
  const b1 = await H.createBatch(Tc, "fa50", ex); await showBatch(Tc, b1);
  for (let g = 0; g < 15; g++){
    const k = doc(ex[0]).stageKey, btn = await Tc.$(`[data-bmove="${k}"]`); if (!btn) break;
    if (doc(ex[0]).plan.find(x => x.key === k)?.phase === "test" && !H.batchDoc(b1).qc){ await H.fillBatch(Tc, b1, () => "1.50"); await H.saveBatch(Tc, b1); await showBatch(Tc, b1); continue; }
    await btn.click(); await waitFor(() => ex.every(id => doc(id).stageKey !== k), 6000); await showBatch(Tc, b1);
  }
  if (!H.batchDoc(b1).qc){ await H.fillBatch(Tc, b1, () => "1.50"); await H.saveBatch(Tc, b1); }
  await showBatch(Sv, b1);
  const rel = await text(Sv, "#bRelease");
  check(rel === "Release results for 2 samples" && !(await Sv.$eval("#bRelease", b => b.disabled)), "the batch offers: Release results for 2 samples (" + rel + "; at " + ex.map(id => doc(id).stageKey).join(", ") + ")");
  await Sv.click("#bRelease"); await waitFor(() => ex.every(id => doc(id).stageKey === "released"), 8000);
  check(ex.every(id => doc(id).stageKey === "released" && (doc(id).certs || []).length === 1), "both released with a certificate each");

  log("Settings can bring the QA/QC review step back");
  await toLast(Tc, c3);
  await setQcStep(Ad, true);
  check(store["settings/stages"].qcStep === true, "the lab manager sets QA/QC review step: Before release");
  await open(Tc, c1); r = await rail(Tc);
  check(!r.some(x => /QA\/QC review/.test(x)), "a sample released without the step does not get it back");
  await open(Tc, c3); r = await rail(Tc);
  check(r.some(x => /QA\/QC review/.test(x)), "a sample not yet released has the step again");
  check(/^Before QA\/QC review: Enter the results before QA\/QC review\. Missing: Solution gold, Solids gold\.$/.test(await text(Tc, "#holdNote")) && await Tc.$eval('[data-step="next"]', b => b.disabled), "entering it needs the results (still not the sampling point)");
  await typeResults(Tc, c3, { Au_s: "0.010", Au: "0.30" });
  await open(Tc, c3);
  await Tc.click('[data-step="next"]'); await waitFor(() => doc(c3).stageKey === "qc", 5000);
  check(doc(c3).stageKey === "qc", "with its results it moves into QA/QC review");
  await H.tab(Sv, "board"); await Sv.waitForTimeout(400);
  check(/^QA\/QC review 1$/.test(await text(Sv, ".lane.ph-qc h4")) && !(await Sv.$('[data-bpick="relready"]')), "the board lane is QA/QC review again");
  await setQcStep(Ad, false);
  await open(Sv, c3); r = await rail(Sv);
  check(r.some(x => /QA\/QC review/.test(x)) && !(await Sv.$eval('[data-step="next"]', b => b.disabled)), "turned off again, a sample already at QA/QC review stays there and can be released");
  await Sv.click('[data-step="next"]'); await waitFor(() => doc(c3).stageKey === "released", 6000);
  check(doc(c3).stageKey === "released", "and it is released");

  console.log("Console errors:", JSON.stringify(errors));
  if (errors.length) process.exitCode = 1;
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
