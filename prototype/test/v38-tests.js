// v38 (22 Oct, the bigger ideas from the v37 walk-through, picked by Claude: Zuriel 18:06Z "complete everything ... without asking me any
// questions"): the results grid (many samples' results typed in one table), and the smaller ideas after it. Values here are made up.
// Run: NODE_PATH=$(npm root -g) timeout 590 node v38-tests.js
process.env.V24 = "1";
const H = require("./harness");
const { errors, newUser, launch, signIn, open, fillForm, ids, doc, ledger, waitFor } = H;
const names = {};
const log = (...a) => console.log("•", ...a);
const check = (cond, msg) => { console.log(cond ? "  PASS" : "  FAIL", msg); if (!cond) process.exitCode = 1; };
const OUT = __dirname;
const text = (page, sel) => page.$eval(sel, e => e.textContent.replace(/\s+/g, " ").trim()).catch(() => "");
const noSideScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
const gridable = async (page, id) => { await open(page, id); await page.waitForTimeout(150); return !!(await page.$("#resBox")); };   // the record takes typed results
/* A single sample moved on until its results can be typed. */
async function toResults(page, id){
  for (let g = 0; g < 25; g++){
    if (await gridable(page, id)) return true;
    const b = await page.$('[data-step="next"]'); if (!b) return false;
    if (await page.$("#mvWit")) await page.selectOption("#mvWit", { index: 1 }).catch(() => {});
    const k = doc(id).stageKey; await b.click({ timeout: 5000 }).catch(() => {}); await waitFor(() => doc(id).stageKey !== k, 5000); await page.waitForTimeout(200);
  }
  return false;
}
const mates = ref => Object.values(H.store).filter(x => x && x.id && x.batchId === ref).sort((a, b) => a.batchIndex - b.batchIndex);
async function batchToResults(page, ref){
  for (let g = 0; g < 25; g++){
    if (await gridable(page, mates(ref)[0].id)) return true;
    await open(page, ref); await page.waitForTimeout(200);
    if (!(await page.$("#bwNext"))) return false;
    if (await page.$("#bwWit")) await page.selectOption("#bwWit", { index: 1 });
    const ks = mates(ref).map(x => x.stageKey).join(); await page.click("#bwNext"); await waitFor(() => mates(ref).map(x => x.stageKey).join() !== ks, 6000);
  }
  return false;
}

(async () => {
  const browser = await launch();
  const Tc = await newUser(browser, { uid: "u_t", name: "Tech", canEdit: true, names }); await signIn(Tc, "tech1");

  log("Results grid on the Results tab");
  const singles = [];
  for (let i = 0; i < 3; i++){ await fillForm(Tc, "register", { section: "PLT", type: "plant_feed", purpose: "plant", submitter: "Shift " + i, tags: "GR-" + i }); singles.push(...await ids(Tc)); }
  for (const id of singles) check(await toResults(Tc, id), `${id} moved on to its analysis`);
  await H.tab(Tc, "results"); await Tc.waitForTimeout(400);
  check(await Tc.isVisible("#rgWait") && /Waiting for results/.test(await text(Tc, "#rgWait h3")) && Number(await text(Tc, "#rgWait .pill")) >= 3 || /3 samples/.test(await text(Tc, "#rgWait .pill")), "the Results tab says how many samples wait for results: " + await text(Tc, "#rgWait .pill"));
  check(!(await Tc.$("#rgBox")), "the grid opens only on request");
  await Tc.click("#rgOpenRes"); await Tc.waitForSelector("#rgBox", { timeout: 4000 }).catch(() => {});
  const cols = await Tc.$$eval("#rgBox .rg-t thead th", ths => ths.map(t => t.textContent.trim()));
  const rows = await Tc.$$eval("#rgBox tr[data-rgs]", trs => trs.map(t => t.dataset.rgs));
  check(singles.every(id => rows.includes(id)) && cols[0] === "Sample" && cols.length >= 2, `one row per sample (${rows.length}), one column per result: ${cols.join(" | ")}`);
  check(await Tc.evaluate(() => document.activeElement?.closest?.("#rgBox") != null), "the first box has the cursor");
  check(!cols.some(c => /opt\./.test(c)) && /Optional results \(\d+\)/.test(await text(Tc, "#rgAll")), "optional results stay out of the way until asked for: " + await text(Tc, "#rgAll"));
  const k1 = await Tc.$eval("#rgBox tr[data-rgs] input[data-rgk]", e => e.dataset.rgk.split("|")[1]);
  const box = (id, k) => `#rgBox tr[data-rgs="${id}"] [data-rgk="${id}|${k}"]`;
  await Tc.click(box(singles[0], k1)); await Tc.fill(box(singles[0], k1), "1.25"); await Tc.keyboard.press("Enter");
  check(await Tc.evaluate(([id, k]) => document.activeElement?.dataset?.rgk === id + "|" + k, [singles[1], k1]), "Enter goes down to the same result of the next sample");
  await Tc.keyboard.type("1,500");
  await Tc.click("#rgSave"); await Tc.waitForTimeout(400);
  check(/comma/.test(await H.toastText(Tc)) && !doc(singles[0]).results, "an ambiguous comma is refused and nothing is saved");
  await Tc.fill(box(singles[1], k1), "0.84");
  // someone else's change redraws the tab: what was typed stays
  const T2 = await newUser(browser, { uid: "u_t2", name: "Tech Two", canEdit: true, names }); await signIn(T2, "tech2");
  await fillForm(T2, "submit", { section: "EXP", submitter: "Geo X" }); await Tc.waitForTimeout(700);
  check(await Tc.inputValue(box(singles[0], k1)) === "1.25" && await Tc.inputValue(box(singles[1], k1)) === "0.84", "typed values stay when the page is drawn again");
  await Tc.screenshot({ path: OUT + "/v38-grid.png", fullPage: false });
  await Tc.click("#rgAll"); await Tc.waitForTimeout(200);
  check((await Tc.$$eval("#rgBox .rg-t thead th", ths => ths.length)) > cols.length && await Tc.inputValue(box(singles[0], k1)) === "1.25", "Optional results adds their columns, keeping what was typed");
  await Tc.click("#rgAll"); await Tc.waitForTimeout(200);
  const allK = await Tc.$$eval(`#rgBox tr[data-rgs="${singles[2]}"] [data-rgk]`, es => es.map(e => [e.dataset.rgk.split("|")[1], e.tagName]));
  for (const [k, tag] of allK){ if (tag === "SELECT") await Tc.selectOption(box(singles[2], k), { index: 1 }); else await Tc.fill(box(singles[2], k), "0.5"); }
  await Tc.click("#rgSave");
  await waitFor(() => !!doc(singles[0]).results && !!doc(singles[1]).results && !!doc(singles[2]).results, 6000); await Tc.waitForTimeout(500);
  const d0 = doc(singles[0]), d2 = doc(singles[2]);
  check(d0.results.rows[k1]?.v === 1.25 && doc(singles[1]).results.rows[k1]?.v === 0.84, "the values are saved on each sample");
  check(/results grid/.test(d0.history.at(-1).note) && d0.history.at(-1).by === "tech1", "each sample's custody line says the results were entered, by whom: " + d0.history.at(-1).note);
  check(!!d2.relAt && !d0.relAt, "a sample with every result is released at once; one still missing a result waits");
  check(/Results saved on 3 samples; 1 released/.test(await H.toastText(Tc)), "the toast counts the saved and released: " + await H.toastText(Tc));
  check(!(await Tc.$(`#rgBox tr[data-rgs="${singles[2]}"]`)) && !!(await Tc.$(`#rgBox tr[data-rgs="${singles[0]}"]`)), "the released sample leaves the grid; the others stay with their values");
  await Tc.click("#rgClose"); await Tc.waitForTimeout(200);
  check(!(await Tc.$("#rgBox")) && await Tc.isVisible("#rgOpenRes"), "Close folds the grid away");

  log("Results grid on the batch page: the batch is released with its certificate");
  await fillForm(Tc, "register", { section: "PLT", type: "plant_feed", purpose: "plant", submitter: "Shift B", count: 3, tags: "BG-1", together: true }); const bt = await ids(Tc);
  const ref = doc(bt[0]).batchId;
  check(await batchToResults(Tc, ref), "the batch moved on to its analysis: " + doc(bt[0]).stageKey);
  await open(Tc, ref); await Tc.waitForTimeout(200);
  check(await Tc.isVisible("#bwAct #bwGridBtn"), "the batch's step box offers Type results beside the results file");
  await Tc.click("#bwGridBtn"); await Tc.waitForSelector("#bwAct #rgBox", { timeout: 4000 }).catch(() => {});
  check(await Tc.$$eval("#rgBox tr[data-rgs]", trs => trs.length) === 3, "the grid has the batch's three samples");
  for (const id of bt){
    const ks = await Tc.$$eval(`#rgBox tr[data-rgs="${id}"] [data-rgk]`, es => es.map(e => [e.dataset.rgk.split("|")[1], e.tagName]));
    for (const [k, tag] of ks){ if (tag === "SELECT") await Tc.selectOption(box(id, k), { index: 1 }); else await Tc.fill(box(id, k), "2.1"); }
  }
  await Tc.screenshot({ path: OUT + "/v38-grid-batch.png" });
  await Tc.click("#rgSave");
  await waitFor(() => bt.every(id => !!doc(id).relAt), 8000);
  check(bt.every(id => !!doc(id).relAt && (doc(id).certs || []).at(-1)?.bref === ref), "all three released together on one batch certificate: " + (doc(bt[0]).certs || []).at(-1)?.no);
  await Tc.waitForTimeout(400);
  check(/3 released/.test(await H.toastText(Tc)), "the toast says so: " + await H.toastText(Tc));

  log("A shorter record: the steps fold to before, now and next");
  await open(Tc, singles[0]); await Tc.waitForTimeout(200);
  const vis = page => page.$$eval(".panel .rail li", ls => ls.filter(l => getComputedStyle(l).display !== "none").length);
  const allLi = await Tc.$$eval(".panel .rail li", ls => ls.length);
  check(await vis(Tc) === 3 && allLi > 5 && /^\d+ more steps?$/.test(await text(Tc, ".rail-sum:not(.done)")), `${allLi} steps show as 3 (before, now, next) and "${await text(Tc, ".rail-sum:not(.done)")}"`);
  check(await Tc.$eval(".panel .rail li.current", l => getComputedStyle(l).display !== "none"), "the step now is always shown");
  await open(Tc, singles[2]); await Tc.waitForTimeout(200);
  check(await vis(Tc) <= 3 && /\d+ steps done$/.test(await text(Tc, ".rail-sum.done")), `a released sample: "${await text(Tc, ".rail-sum.done")}", then the last steps`);
  await Tc.screenshot({ path: OUT + "/v38-record-folded.png" });
  await Tc.click(".rail-sum.done"); await Tc.waitForTimeout(200);
  check(await vis(Tc) === allLi && await Tc.isVisible(".rail-less"), "pressing it shows every step, with Fewer steps");
  await open(Tc, singles[1]); await Tc.waitForTimeout(200);
  check(await vis(Tc) === await Tc.$$eval(".panel .rail li", ls => ls.length), "the choice is remembered on the next record");
  await Tc.click(".rail-less"); await Tc.waitForTimeout(200);
  check(await vis(Tc) === 3, "Fewer steps folds them again");
  await open(Tc, ref); await Tc.waitForTimeout(200);
  check(await Tc.isVisible("#bwBox .rail-sum"), "the batch page's steps fold the same way");
  // 22 Oct review: Put all away on the batch page too, one location for every material of the batch
  const bPut = new Set(bt.flatMap(id => (doc(id).materials || []).filter(m => m.status === "kept" && !m.loc).map(m => m.item))).size;
  check(bPut >= 2 && await text(Tc, "#bmAll") === `Put all ${bPut} away`, `the batch's retained material offers: ${await text(Tc, "#bmAll")}`);
  await Tc.click("#bmAll"); await Tc.waitForTimeout(300);
  check(/location/.test(await H.toastText(Tc)) && bt.every(id => (doc(id).materials || []).every(m => !m.loc)), "the batch: a location is needed first");
  await Tc.fill("#bmAllLoc", "Rack C1"); await Tc.click("#bmAll");
  await waitFor(() => bt.every(id => doc(id).stageKey === "storage"), 8000);
  check(bt.every(id => { const d = doc(id), k = d.materials.filter(m => m.status === "kept"); return d.stageKey === "storage" && k.length >= 2 && k.every(m => m.loc === "Rack C1") && d.history.filter(h => /put away$/.test(h.note || "")).length === k.length; }), "every sample's materials on the shelf at Rack C1, each with its own custody line; the batch in storage");
  await open(Tc, ref); await Tc.waitForTimeout(300);
  check(!(await Tc.$("#bmAll")) && /Kept at Rack C1/.test(await text(Tc, "#bmBox")), "nothing left to put away: the button goes, the table says where");
  const Pl = await newUser(browser, { uid: "u_pl", name: "Plant", canEdit: false, names }, { width: 390, height: 844 }); await signIn(Pl, "plant");
  await open(Pl, singles[2]); await Pl.waitForTimeout(300);
  check(await Pl.evaluate(() => { const r = document.querySelector("#resPanel"), w = document.querySelector(".panel .rail"); return !!r && !!w && r.getBoundingClientRect().top < w.getBoundingClientRect().top; }), "a section account on a phone sees the released results before the steps");
  await Pl.screenshot({ path: OUT + "/v38-section-phone.png" });

  log("Put every material away at once");
  await open(Tc, singles[2]); await Tc.waitForTimeout(200);
  const nPut = (doc(singles[2]).materials || []).filter(m => m.status === "kept" && !m.loc).length;
  check(nPut >= 2 && await text(Tc, "#mxAll") === `Put all ${nPut} away`, `Retained material offers: ${await text(Tc, "#mxAll")}`);
  await Tc.click("#mxAll"); await Tc.waitForTimeout(300);
  check(/location/.test(await H.toastText(Tc)) && (doc(singles[2]).materials || []).every(m => !m.loc), "a location is needed first");
  await Tc.fill("#mxAllLoc", "Shelf B3"); await Tc.click("#mxAll");
  await waitFor(() => (doc(singles[2]).materials || []).every(m => m.status !== "kept" || m.loc === "Shelf B3"), 6000);
  const d2b = doc(singles[2]);
  check(d2b.materials.every(m => m.status !== "kept" || m.loc === "Shelf B3") && d2b.stageKey === "storage" && d2b.history.filter(h => /put away$/.test(h.note || "")).length === nPut, `all ${nPut} on the shelf, each with its own custody line; the workflow is complete`);

  log("Several samples one step on from the board's List");
  const mv = [];
  for (let i = 0; i < 2; i++){ await fillForm(Tc, "register", { section: "EXP", submitter: "Geo M" + i }); mv.push(...await ids(Tc)); }
  await H.tab(Tc, "board"); await Tc.waitForTimeout(300);
  if (await Tc.$(".pk-x")) await Tc.click(".pk-x");
  await Tc.click('[data-bview="list"]'); await Tc.waitForTimeout(300);
  check(mv.every(async id => true) && (await Tc.$$eval("#bdList [data-mv]", bs => bs.map(b => b.dataset.mv))).filter(x => mv.includes(x)).length === 2 && await Tc.$eval("#bdMove", b => b.disabled), "the List has a tick box per sample that can move, and the button waits for a tick");
  const k0 = mv.map(id => doc(id).stageKey);
  for (const id of mv) await Tc.check(`#bdList [data-mv="${id}"]`);
  check(await text(Tc, "#bdMove") === "Move 2 samples one step", "the button counts the ticked: " + await text(Tc, "#bdMove"));
  await Tc.screenshot({ path: OUT + "/v38-board-move.png" });
  await Tc.click("#bdMove");
  await waitFor(() => mv.every((id, i) => doc(id).stageKey !== k0[i]), 6000);
  check(mv.every((id, i) => doc(id).stageKey !== k0[i] && doc(id).history.at(-1).note === "Moved from the board list" && doc(id).history.at(-1).by === "tech1"), "each moved to its own next step, with a custody line: " + mv.map(id => doc(id).stageKey).join(", "));
  await Tc.waitForTimeout(300);
  check(/Moved 2 samples one step/.test(await H.toastText(Tc)), "the toast says so");
  await Tc.click('[data-bview="lanes"]'); await Tc.waitForTimeout(200);

  log("Receipt condition: several at once, and a typed one");
  await fillForm(Tc, "submit", { section: "EXP", submitter: "Geo C" }); const [cn] = await ids(Tc);
  await open(Tc, cn); await Tc.waitForTimeout(200);
  check(await Tc.$$eval("#rcCondPick input[type=checkbox]", xs => xs.length) === 4 && await Tc.isVisible("#rcCondOther") && !(await Tc.$("#rcCond")), "the condition is four ticks and a box to type another");
  await Tc.check("#rcCondPick input[value='Wet']"); await Tc.check("#rcCondPick input[value='Labels unclear or wrong']"); await Tc.fill("#rcCondOther", "Torn corner"); await Tc.waitForTimeout(200);
  check(/condition: wet; Labels unclear or wrong; Torn corner/.test(await text(Tc, "#rcInfo")), "the check names every one: " + await text(Tc, "#rcInfo"));
  await Tc.fill("#mvNote", "Bag wet, label smudged, corner torn"); await Tc.click('[data-receipt="confirm"]');
  await waitFor(() => doc(cn).stageKey === "received", 6000);
  check(doc(cn).recv?.cond === "Wet; Labels unclear or wrong; Torn corner", "kept on the receipt: " + doc(cn).recv?.cond);
  await fillForm(Tc, "submit", { section: "EXP", submitter: "Geo D" }); const [cg] = await ids(Tc);
  await open(Tc, cg); await Tc.click('[data-receipt="confirm"]'); await waitFor(() => doc(cg).stageKey === "received", 6000);
  check(doc(cg).recv?.cond === "Good", "nothing ticked is Good, and needs no note");

  log("A tidier Ledger");
  await H.tab(Tc, "ledger"); await Tc.waitForTimeout(400);
  check(await Tc.evaluate(() => Math.abs(document.querySelector("#lgCsv").getBoundingClientRect().top - document.querySelector("#lgMonth").getBoundingClientRect().top) < 8), "the filters and Export CSV sit on one row");
  check(/Month check/.test(await text(Tc, ".lg-month")) && await Tc.$("#lgSummary").then(b => b && b.evaluate(e => !!e.closest(".lg-month"))), "the month check and the sign-off share one box");
  await Tc.screenshot({ path: OUT + "/v38-ledger.png" });

  log("Section account: My samples");
  const Pd = await newUser(browser, { uid: "u_pd", name: "Plant", canEdit: false, names }); await signIn(Pd, "plant");
  await H.tab(Pd, "results"); await Pd.waitForTimeout(400);
  check(/In the lab/.test(await text(Pd, "#secLab h3")) && !!(await Pd.$(`#secLab [data-open="${singles[0]}"]`)) && !(await Pd.$(`#secLab [data-open="${mv[0]}"]`)), "In the lab lists the section's own samples still in the lab, not another section's");
  check(/AuFx 0\.50/.test(await text(Pd, "#view-results")) && await Pd.isVisible("#secCsv"), "released results show their values, with Export CSV");
  await Pd.fill("#secQ", "GR-0"); await Pd.waitForTimeout(300);
  check(!!(await Pd.$(`[data-open="${singles[0]}"]`)) && !(await Pd.$(`[data-open="${singles[2]}"]`)), "the search narrows both lists");
  await Pd.fill("#secQ", ""); await Pd.waitForTimeout(200);
  await Pd.screenshot({ path: OUT + "/v38-section.png", fullPage: true });

  log("Viewer: no grid");
  const V = await newUser(browser, { uid: "u_v", name: "Viewer", canEdit: false, names }); await signIn(V, "viewer");
  await H.tab(V, "results").catch(() => {}); await V.waitForTimeout(300);
  check(!(await V.$("#rgWait")), "a viewer sees no results grid");

  log("Phone width");
  const Ph = await newUser(browser, { uid: "u_p", name: "Tech", canEdit: true, names }, { width: 390, height: 844 }); await signIn(Ph, "tech1");
  await H.tab(Ph, "results"); await Ph.waitForTimeout(300);
  if (await Ph.$("#rgOpenRes")){ await Ph.click("#rgOpenRes"); await Ph.waitForTimeout(300); }
  check(await noSideScroll(Ph), "no sideways page scroll on a phone (the grid scrolls in its own box)");
  await Ph.screenshot({ path: OUT + "/v38-grid-phone.png" });
  await H.tab(Ph, "ledger"); await Ph.waitForTimeout(400);
  const lh = await Ph.$$eval("table.lg-t tbody tr", trs => trs.slice(0, 3).map(r => r.getBoundingClientRect().height));
  check(lh.length > 0 && lh.every(h => h < 300) && Math.min(...lh) < 200 && await noSideScroll(Ph), "Ledger on a phone: a short card per movement: " + lh.map(Math.round).join(", ") + " px");
  await Ph.screenshot({ path: OUT + "/v38-ledger-phone.png", fullPage: true });
  await H.tab(Ph, "submit"); if (await Ph.$("#rAgain")) await Ph.click("#rAgain");
  await Ph.check('input[name="rKind"][value="job"]'); await Ph.waitForTimeout(200); await Ph.selectOption("#jTpl", "mill"); await Ph.waitForTimeout(300);
  const jh = await Ph.$$eval("#jRows tr:not(.j-gh)", trs => trs.slice(0, 4).map(r => r.getBoundingClientRect().height));
  check(jh.length && jh.every(h => h < 120) && await Ph.isHidden("#jRows tr:not(.j-gh) .j-desc"), "Shift end on a phone: name and code per row, description and analysis folded: " + jh.map(Math.round).join(", ") + " px");
  await Ph.click("#jRows tr:not(.j-gh) .j-x");
  check(await Ph.isVisible("#jRows tr.jx .j-desc") && await Ph.isVisible("#jRows tr.jx .j-test"), "⋯ opens a row's description and analysis");
  check(await noSideScroll(Ph), "no sideways scroll on the Shift end form");
  await Ph.screenshot({ path: OUT + "/v38-shift-phone.png" });

  console.log("Console errors:", JSON.stringify(errors));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
