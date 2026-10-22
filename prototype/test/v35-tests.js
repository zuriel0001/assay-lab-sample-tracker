// v35 (22 Oct, "remove that tab... and clean the scripts"): the Lab batches tab is gone. Attach results file sits on the Results tab, which
// technicians now have; the lab's own QC rows in a file are counted, not used; no reference material register, control chart or lab batch
// setting; records and certificates from before keep their lab batch; blind QA/QC duplicates are judged by the original's route.
// Values here are made up.
// Run: NODE_PATH=$(npm root -g) timeout 590 node v35-tests.js
process.env.V24 = "1";
const H = require("./harness");
const fs = require("fs"), path = require("path"), vm = require("vm");
const { errors, newUser, launch, signIn, open, doc, waitFor, store, broadcast, fillForm, ids, visibleTabs, attachFile, saveAttach } = H;
const names = {};
const log = (...a) => console.log("•", ...a);
const check = (cond, msg) => { console.log(cond ? "  PASS" : "  FAIL", msg); if (!cond) process.exitCode = 1; };
const text = async (page, sel) => ((await page.textContent(sel).catch(() => "")) || "").replace(/\s+/g, " ").trim();
const OUT = __dirname;
/* Walks one sample on its record until it reaches the step. */
async function walkTo(page, id, key){
  await open(page, id);
  for (let g = 0; g < 16 && doc(id).stageKey !== key; g++){ const k = doc(id).stageKey; await page.click('[data-step="next"]'); await waitFor(() => doc(id).stageKey !== k, 4000); await page.waitForTimeout(250); }
  return doc(id).stageKey === key;
}

(async () => {
  const browser = await launch();
  const Tc = await newUser(browser, { uid: "u_t", name: "Tech", canEdit: true, names }); await signIn(Tc, "tech1");
  const Sv = await newUser(browser, { uid: "u_s", name: "Super", canEdit: true, names }); await signIn(Sv, "super");
  const Ad = await newUser(browser, { uid: "u_a", name: "Admin", canEdit: true, names }); await signIn(Ad, "admin");
  const Vw = await newUser(browser, { uid: "u_v", name: "Viewer", canEdit: false, names }); await signIn(Vw, "viewer");
  const Ex = await newUser(browser, { uid: "u_x", name: "Exploration", canEdit: false, names }); await signIn(Ex, "exp");
  await Tc.waitForTimeout(800);

  log("No Batches tab; Results carries Attach results file for lab staff");
  const tabs = {}; for (const [k, p] of Object.entries({ Tc, Sv, Ad, Vw, Ex })) tabs[k] = await visibleTabs(p);
  check(Object.values(tabs).every(t => !t.includes("batches")) && !(await Ad.$('#tabs [data-tab="batches"]')), "no role has a Batches tab, and the page has none: " + JSON.stringify(tabs));
  check(JSON.stringify(tabs.Tc) === JSON.stringify(["board", "track", "submit", "results", "storage", "ledger", "routes"]) && JSON.stringify(tabs.Ad) === JSON.stringify(["board", "track", "submit", "results", "storage", "ledger", "routes", "stages"]), "technicians now have Results, after Submit");
  const attachOn = async p => { await H.tab(p, "results"); await p.waitForSelector("#view-results h2", { timeout: 5000 }).catch(() => {}); await p.waitForTimeout(300); return !!(await p.$('#view-results [data-attach="all"]')); };
  check(await attachOn(Tc) && await attachOn(Sv) && await attachOn(Ad), "technician, supervisor and lab manager see Attach results file on the Results tab");
  check(!(await attachOn(Vw)) && !(await Ex.$('[data-attach]')), "a viewer and a section account don't");
  check(await Tc.$eval('#view-results [data-attach="all"]', b => b.closest(".row").getBoundingClientRect().height) < 60, "the button sits on the Results heading row (no extra block)");
  await Tc.screenshot({ path: OUT + "/v35-results-tech.png" });

  log("A results file: samples' values saved, the lab's QC rows counted, not used");
  await fillForm(Tc, "register", { section: "EXP", submitter: "Ama Mensah", count: 2, tags: "DH-901" }); const ex = await ids(Tc);
  await H.tab(Tc, "results"); await Tc.waitForSelector('#view-results [data-attach="all"]');
  const up = await attachFile(Tc, "all", "run.csv", `Sample ID,Au (g/t)\n${ex[0]},1.10\n${ex[0]}-DUP,1.12\n${ex[1]},0.42\nBLANK,<0.005\nSTD-AU-LOW,0.51\nOREAS 2Pd,0.88\n`);
  check(/Lab QC rows \(repeats, blanks, standards\): 4/.test(up) && !/Reference material|lab batch/i.test(up), "the repeat, blank and two standards are counted as the lab's QC rows: " + (up.match(/Lab QC rows[^:]*: \d+/) || ["none"])[0]);
  check(/Results on 2 sample records/.test(up) || new RegExp(`Moved on to analysis when saved: ${ex[0]}, ${ex[1]}`).test(up), "both samples are named for saving");
  await saveAttach(Tc); await waitFor(() => ex.every(id => doc(id).results), 8000);
  check(doc(ex[0]).results?.rows.Au.v === 1.1 && doc(ex[1]).results?.rows.Au.v === 0.42 && ex.every(id => !doc(id).labs && !doc(id).labBatch && !doc(id).qcg), "each sample takes its own row (not the repeat); no lab batch fields are written");

  log("Settings and the board: nothing of lab batches left");
  await H.tab(Ad, "stages"); await Ad.waitForSelector("[data-cfgtab]");
  const panes = await Ad.$$eval("[data-cfgtab]", bs => bs.map(b => b.dataset.cfgtab));
  check(!panes.includes("crms") && !(await Ad.$("#cfgBatchReq")) && !/Reference materials|Lab batch/.test(await text(Ad, "#view-stages")), "Settings: no Reference materials pane and no lab batch setting: " + panes.join(","));
  await H.cfgTab(Ad, "routes");
  const rtIdx = await Ad.$$eval("#rtPick option", os => os.findIndex(o => /^AUFX/.test(o.textContent)));
  if (rtIdx >= 0){ await Ad.selectOption("#rtPick", String(rtIdx)); await Ad.waitForSelector('[data-rf="qc"]'); }
  check(rtIdx >= 0 && !(await Ad.$("#rtQcp")) && !/Lab batch type|batch type/i.test(await text(Ad, "#view-stages")), "the route editor has no batch type");
  await Ad.click("#cfgCancel").catch(() => {});
  await H.tab(Sv, "board"); await Sv.waitForTimeout(500);
  check(!(await Sv.$('[data-bpick="nobatch"]')) && !(await Sv.$('[data-bpick="trends"]')) && !(await Sv.$("#bdTrends")) && !/lab batch|Batch FA-/i.test(await text(Sv, "#view-board")), "the board has no lab batch tiles, trend notice or batch line on cards");

  log("Saved settings from before: reference materials, the batch rule and route batch types are dropped");
  const st = store["settings/stages"] || {};
  const oldRoute = { code: "EXP-OLD", name: "Saved with a batch type", tests: ["fa_aas"], types: ["core"], purposes: [], stages: [{ key: "pulv", name: "Pulverising", hours: 2, phase: "prep", note: "" }, { key: "fin", name: "AuFx: AAS finish", hours: 2, phase: "test", note: "" }], retention: [], qcp: "fa50", qcg: [{ p: "fa50", k: ["Au"] }] };
  store["settings/stages"] = { ...st, schema: 12, batchReq: true, crms: [{ id: "STD-X-1", name: "Made-up standard", an: "Au", u: "g/t", val: 1, sd: 0.05, use: "FA" }], crmLog: [{ at: Date.now(), by: "Lab Manager", id: "STD-X-1", what: "Added" }], routes: [...(st.routes || []), oldRoute] };
  await broadcast("settings/stages", store["settings/stages"]); await Ad.waitForTimeout(600);
  await H.tab(Ad, "board"); await H.tab(Ad, "stages"); await H.cfgTab(Ad, "accounts"); await Ad.waitForSelector("#cfgResPub", { state: "visible" });
  await Ad.selectOption("#cfgResPub", "1"); await Ad.click("#cfgSave"); await waitFor(() => store["settings/stages"]?.resultsPublic === true, 5000);
  const sv = store["settings/stages"];
  check(sv.resultsPublic === true && !("crms" in sv) && !("crmLog" in sv) && !("batchReq" in sv) && (sv.routes || []).every(r => !("qcp" in r) && !("qcg" in r)), "saved again, they are gone from the stored settings");
  await Ad.selectOption("#cfgResPub", "0"); await Ad.click("#cfgSave"); await waitFor(() => store["settings/stages"]?.resultsPublic === false, 5000);

  log("A record and certificate from before keep their lab batch");
  const [ol] = ex; await waitFor(() => (doc(ol).certs || []).length, 6000);
  if (!(doc(ol).certs || []).length){ await walkTo(Sv, ol, "released"); }
  const c0 = (doc(ol).certs || [])[0];
  check(!!c0 && !c0.batch && !c0.qc && Object.values(c0.cov || {}).every(c => !c || c === "calc"), "a certificate made now names no lab batch: " + JSON.stringify(c0 && { batch: c0.batch, qc: c0.qc, cov: c0.cov }));
  await open(Sv, ol); await Sv.click(`[data-cert="${c0.v}"]`); await Sv.waitForSelector("#certBox:not([hidden]) .cert");
  check(!/Lab batch|QC passed|Not in a lab batch/.test(await text(Sv, "#certBox .cert")), "and prints no lab batch column");
  await Sv.click("#certClose");
  const old = { ...doc(ol), labs: { fa50: { b: "FA-20260901-01", q: "pass", n: "" } }, lbs: ["FA-20260901-01"], qcp: "fa50", qcg: [{ p: "fa50", k: ["Au"] }],
    certs: [{ ...c0, cov: { Au: "FA-20260901-01" }, batch: "FA-20260901-01", qc: "pass" }] };
  store["samples/" + ol] = old; await broadcast("samples/" + ol, old); await Sv.waitForTimeout(500);
  await open(Sv, ol);
  check(/Lab batch FA-20260901-01/.test(await text(Sv, "#resPanel")) && !(await Sv.$("#resPanel [data-bsel]")), "the record shows its lab batch, read only");
  await Sv.click(`[data-cert="${c0.v}"]`); await Sv.waitForSelector("#certBox:not([hidden]) .cert");
  const oc = await text(Sv, "#certBox .cert");
  check(/Lab batch ?FA-20260901-01 · QC passed/.test(oc) && /Lab batch FA-20260901-01/.test(await text(Sv, "#certBox table.cert-res")), "its certificate still prints the batch, its QC result and the batch beside each result: " + (oc.match(/Lab batch[^.]{0,60}/) || [""])[0]);
  await Sv.click("#certClose");

  log("Blind QA/QC duplicates are judged by the original's route");
  // The page's own code (the Azure suite runner sets AZ_ROOT to its build), run in Node.
  const src = fs.readFileSync(process.env.AZ_ROOT ? path.join(process.env.AZ_ROOT, "app/index.html") : H.FILE.replace("file://", ""), "utf8");
  const a0 = src.indexOf("const DUP_TOL = (() => {"), b0 = src.indexOf("\n", src.indexOf("const dupRule =", a0));
  const dupRule = vm.runInNewContext(src.slice(a0, b0) + "\ndupRule;", {});
  const rules = { elu: dupRule("ELU-AUSX", "Au_s"), cnWad: dupRule("AUFX-AUSX-CN", "wad"), cnAu: dupRule("AUFX-AUSX-CN", "Au"), sfa: dupRule("SFA", "Au"), moist: dupRule("MOIST", "m"), other: dupRule("EXP-FA", "Au"), tail: dupRule("PLT-TAIL", "Au") };
  check(src.includes("const p = dupRule(DUP_TOL[o.route] ? o.route : o.baseRoute, a.k);"), "the page judges a blind duplicate with dupRule, by the original's route");
  check(rules.elu.pd === 2 && rules.cnWad.pd === 10 && rules.cnAu.pd === 20 && rules.sfa.pd === 20 && rules.sfa.min === 0 && rules.moist.abs === 0.5 && rules.other.pd === 20 && rules.other.min === 10 && rules.tail.pd === 20 && rules.tail.min === 5,
    "eluate 2%, WAD cyanide 10%, the rest of a CN route 20%, screen fire assay 20%, moisture ±0.5, any other route 20% above 10× detection: " + JSON.stringify(rules));

  log("Phone");
  const ph = await newUser(browser, { uid: "u_ph", name: "Ph", canEdit: true, names }, { width: 375, height: 760 }, "dark"); await signIn(ph, "tech1");
  await H.tab(ph, "results"); await ph.waitForSelector('#view-results [data-attach="all"]');
  check(await ph.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "the Results tab with Attach results file fits a 375 px phone");
  await ph.screenshot({ path: OUT + "/v35-results-phone-dark.png", fullPage: true });

  console.log("Console errors:", JSON.stringify(errors));
  if (errors.length) process.exitCode = 1;
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
