// v24: results are released at once when they are complete (QC, limits and checks never hold them); departments, with Metallurgy
// evaluating released results (flags, Accepted / Query / Re-assay requested) on a Results tab and the record; the lab sees re-assay
// requests on its board; Belt cut sample (AuFx & moisture); analytical routes back in use and testwork as what samples are for; a
// shorter, coloured Submit form; Batches, Storage, Ledger and Routes reworked; a larger font.
// Run: NODE_PATH=$(npm root -g) timeout 590 node v24-tests.js
process.env.V24 = "1";   // the defaults: no sign-off seeded by the harness
const H = require("./harness");
const { store, errors, newUser, launch, signIn, fillForm, ids, open, doc, waitFor } = H;
const names = {};
const log = (...a) => console.log("•", ...a);
const check = (cond, msg) => { console.log(cond ? "  PASS" : "  FAIL", msg); if (!cond) process.exitCode = 1; };
const text = async (page, sel) => ((await page.textContent(sel).catch(() => "")) || "").replace(/\s+/g, " ").trim();
const rv = (id, k) => doc(id).results?.rows?.[k]?.v;
/* Clicks "Move to" until the next step is the release (or there is nothing to move to). */
async function toLast(page, id){
  for (let g = 0; g < 25; g++){
    await open(page, id); await page.waitForTimeout(150);
    const st = await page.$eval('[data-step="next"]', b => ({ t: b.textContent.trim(), d: b.disabled })).catch(() => null);
    if (!st || !/^Move to:/.test(st.t) || st.d) return st ? st.t : "";
    const k = doc(id).stageKey; await page.click('[data-step="next"]', { timeout: 5000 }).catch(() => {}); await waitFor(() => doc(id).stageKey !== k, 5000); await page.waitForTimeout(250);
  }
  return "";
}
async function typeResults(page, id, vals){
  await open(page, id); await page.$eval("#resBox", d => { d.open = true; });
  for (const [k, v] of Object.entries(vals)){ const sel = "#rs_" + k; if (await page.$eval(sel, e => e.tagName) === "SELECT") await page.selectOption(sel, v); else await page.fill(sel, v); }
  const n = (doc(id).results?.v || 0); await page.click("#rsSave"); await waitFor(() => (doc(id).results?.v || 0) > n, 5000); await page.waitForTimeout(500);
}

(async () => {
  const browser = await launch();
  const Tc = await newUser(browser, { uid: "u_t", name: "Tech", canEdit: true, names }); await signIn(Tc, "tech1");
  const Mt = await newUser(browser, { uid: "u_m", name: "Met", canEdit: false, names }); await signIn(Mt, "met");
  const Vw = await newUser(browser, { uid: "u_v", name: "Viewer", canEdit: false, names }); await signIn(Vw, "viewer");
  const Ad = await newUser(browser, { uid: "u_a", name: "Admin", canEdit: true, names }); await signIn(Ad, "admin");
  await Tc.waitForTimeout(800);

  log("Settings: release at once by default, departments with Metallurgy evaluating");
  await H.tab(Ad, "stages"); await Ad.waitForSelector("#cfgRel");
  check(await Ad.$eval("#cfgRel", e => e.value) === "now" && !(await Ad.$("#cfgQcStep")) && !(await Ad.$("#cfgBatchReq")), "Release of results: At once; the QA/QC step and lab batch rule are not offered");
  const depts = await Ad.$$eval("[data-di]", xs => xs.map(x => x.value)), evs = await Ad.$$eval("[data-dev]", xs => xs.map(x => x.checked));
  check(depts.includes("Metallurgy") && depts.includes("Assay Lab") && evs[depts.indexOf("Metallurgy")] && !evs[depts.indexOf("Assay Lab")], "Departments: Metallurgy evaluates, the Assay Lab does not: " + depts.join(", "));
  check(await Ad.$eval('[data-ui="0"][data-uf="dept"]', e => e.value) === "Assay Lab", "the lab manager's account is in the Assay Lab");

  log("Tabs follow the role and department");
  const tabsOf = p => p.$$eval("#tabs button[data-tab]", bs => bs.filter(b => !b.hidden).map(b => b.dataset.tab));
  const tT = await tabsOf(Tc), tM = await tabsOf(Mt), tV = await tabsOf(Vw);
  check(!tT.includes("results") && tT.includes("batches"), "a technician has Batches and no Results tab: " + tT.join(","));
  check(tM.includes("results") && tM.includes("batches"), "a metallurgist has Results and Batches: " + tM.join(","));
  check(tV.includes("results") && !tV.includes("batches"), "a viewer outside an evaluating department has Results but not Batches (QC): " + tV.join(","));

  log("Submit: three short steps; a Belt cut sample fills in its analysis, purpose and section");
  await H.tab(Tc, "submit"); await Tc.waitForSelector("#rType");
  check(await Tc.$$eval("#regForm .sub-step", ss => ss.filter(x => !x.hidden).length) === 3 && await Tc.$eval("#rRecvAtBox", d => !d.open) && /Received now/.test(await text(Tc, "#rRecvAtBox summary")), "the form has three steps and the time received just says now");
  check(await Tc.$eval("#rSubBadge", e => e.closest(".pair") !== null) && await Tc.$eval("#rMore", d => !d.open), "the badge sits beside the name; the rest is under More details");
  await Tc.selectOption("#rType", "belt"); await Tc.waitForTimeout(250);
  check(await Tc.$eval("#rTest", e => e.value) === "aufx_m" && await Tc.$eval("#rPurpose", e => e.value) === "plant" && await Tc.$eval("#rSection", e => e.value) === "PLT",
    "Belt cut sample: Belt cut: AuFx & moisture, process control, section PLT");
  check(/BELT/.test(await text(Tc, "#rRoute")) && await text(Tc, "#rTypeChip") === "Processing" && await Tc.$eval("#rTypeChip", e => e.classList.contains("t-plant")), "the route BELT is shown and the type carries its group (Processing) and colour");

  log("v24c: sample types streamlined, AuFx named, one plain analysis list");
  const tg = await Tc.$$eval("#rType optgroup", gs => gs.map(g => [g.label, [...g.querySelectorAll("option")].map(o => o.value)]));
  const tgl = tg.map(g => g[0]), allT = tg.flatMap(g => g[1]);
  check(tgl.join("|") === "Ore (mine & exploration)|Processing (crusher to TSF)|Gold room|Environment|Quality control|Other", "type groups: Ore, Processing, Gold room, Environment, QC, Other: " + tgl.join(", "));
  check(JSON.stringify(tg.find(g => g[0] === "Gold room")[1]) === '["bullion"]', "the gold room sends bullion only");
  check(["belt", "plant_feed", "ccd", "carbon", "elution", "tsf"].every(k => tg.find(g => g[0].startsWith("Processing"))[1].includes(k)), "carbon and elution are processing samples, with belt cut, mill, CCD and TSF");
  check(!["met_comp", "tw_slurry", "tw_sol", "tw_res", "tw_carbon", "plant_tails", "cil_slurry", "solution", "waste"].some(k => allT.includes(k)) && new Set(allT).size === allT.length, "no testwork or duplicate types: " + allT.length + " types");
  await Tc.selectOption("#rType", "rc"); await Tc.waitForTimeout(200);
  const rcT = await Tc.$$eval("#rTest option", os => os.map(o => o.textContent));
  check(!(await Tc.$("#rTest optgroup")) && rcT[0] === "AuFx: fire assay, AAS finish" && rcT.slice(0, 3).every(x => /^AuFx: /.test(x)) && !rcT.some(x => /Carbon|Bullion|Slurry|Moisture|Specific gravity/.test(x)), "ore: one plain list, fire assay named AuFx first, nothing that does not apply to RC chips: " + rcT.join(" | "));
  await Tc.selectOption("#rType", "carbon"); await Tc.waitForTimeout(200);
  check((await Tc.$$eval("#rTest option", os => os.map(o => o.value).filter(v => v !== "x"))).join() === "c_load,c_act,moisture", "carbon: Au loading, carbon activity (v24d) and moisture only");
  await Tc.selectOption("#rType", "tsf"); await Tc.selectOption("#rPurpose", "env"); await Tc.waitForTimeout(200);
  check((await Tc.$$eval("#rPurpose option", os => os.map(o => o.textContent))).includes("Environmental compliance (any site)") && await Tc.$eval("#rTest", e => e.value) === "cn_spec" && /CN-SPEC/.test(await text(Tc, "#rRoute")), "Environment sends a sample from any site; on a TSF sample it gets cyanide speciation first");
  const pageSrc = await Tc.evaluate(() => [...document.scripts].map(x => x.textContent).find(t => t.includes("/* ROUTES-BEGIN")) || "");   // the page's own data, on any build
  const RD = new Function(pageSrc.slice(pageSrc.indexOf("/* ROUTES-BEGIN"), pageSrc.indexOf("/* ROUTES-END */")) + ";return { TYPES, DEFAULT_ROUTES, RETIRED_ROUTES };")();
  const liveR = RD.DEFAULT_ROUTES.filter(r => !RD.RETIRED_ROUTES.includes(r.code)), want = Object.fromEntries(RD.TYPES.map(t => [t.key, t.tests.filter(k => liveR.some(r => r.tests.includes(k))).join()]));
  const mism = await Tc.evaluate(want => { const out = [], ty = document.querySelector("#rType"); let n = 0;
    for (const o of [...ty.options].filter(o => o.value && o.value !== "other")){ ty.value = o.value; ty.dispatchEvent(new Event("change")); n++;
      const got = [...document.querySelectorAll("#rTest option")].map(x => x.value).filter(v => v !== "x").join(); if (got !== want[o.value]) out.push(o.value + ": " + got + " / " + want[o.value]); }
    return out.length ? out : n; }, want);
  check(typeof mism === "number" && mism === 17, "v24c: every sample type lists exactly its own analyses and nothing else: " + JSON.stringify(mism));
  await Tc.selectOption("#rType", "plant_feed"); await Tc.selectOption("#rPurpose", "met_br"); await Tc.waitForTimeout(200);
  check((await Tc.$$eval("#rTest option", os => os.map(o => o.value).filter(v => v !== "x"))).join() === want.plant_feed, "a testwork purpose adds no analyses: a mill sample for a bottle roll offers the mill sample's own");
  log("v24c: What it is for matches the sample type");
  const TP = new Function(pageSrc.slice(pageSrc.indexOf("/* ROUTES-BEGIN"), pageSrc.indexOf("/* ROUTES-END */")) + ";return TYPE_PURPOSES;")();
  const pmis = await Tc.evaluate(TP => { const out = [], ty = document.querySelector("#rType"); let n = 0;
    for (const o of [...ty.options].filter(o => o.value && o.value !== "other")){ ty.value = o.value; ty.dispatchEvent(new Event("change")); n++;
      const got = [...document.querySelectorAll("#rPurpose option")].map(x => x.value).filter(Boolean).sort().join(), exp = [...TP[o.value], "other"].sort().join(); if (got !== exp) out.push(o.value + ": " + got + " / " + exp); }
    return out.length ? out : n; }, TP);
  check(pmis === 17, "every sample type offers only the purposes it can be sent for, and Other: " + JSON.stringify(pmis));
  await Tc.selectOption("#rType", "bullion"); await Tc.waitForTimeout(150);
  check((await Tc.$$eval("#rPurpose option", os => os.map(o => o.value).filter(Boolean))).join() === "bullion,other" && await Tc.$eval("#rPurpose", e => e.value) === "bullion", "bullion: Bullion (gold pour), or Other");
  await Tc.selectOption("#rType", "carbon"); await Tc.waitForTimeout(150);
  const cp = await Tc.$$eval("#rPurpose option", os => os.map(o => o.textContent));
  check(cp.includes("Carbon strip / elution test") && !cp.includes("Bottle roll test") && !cp.includes("Exploration / resource definition"), "carbon: carbon strip test, no bottle roll and no exploration");
  await Tc.selectOption("#rType", "rc"); await Tc.selectOption("#rPurpose", "gc"); await Tc.selectOption("#rType", "core"); await Tc.waitForTimeout(150);
  check(await Tc.$eval("#rPurpose", e => e.value) === "gc", "a chosen purpose the new type also takes stays");
  await Tc.selectOption("#rType", "bullion"); await Tc.waitForTimeout(150);
  check(await Tc.$eval("#rPurpose", e => e.value) === "bullion", "one the new type does not take gives way to the type's usual purpose");
  await Tc.selectOption("#rType", "core"); await Tc.waitForTimeout(200);
  check(!(await Tc.$$eval("#rTest option", os => os.map(o => o.value))).some(k => /ausx|aufx|cn_only|c_load|bullion|water/.test(k)), "drill core offers no plant, gold room or environment analyses");
  log("v24c: Section matches the sample type");
  const TS = new Function(pageSrc.slice(pageSrc.indexOf("/* ROUTES-BEGIN"), pageSrc.indexOf("/* ROUTES-END */")) + ";return TYPE_SECTIONS;")();
  const smis = await Tc.evaluate(TS => { const out = [], ty = document.querySelector("#rType"); let n = 0;
    ty.value = ""; ty.dispatchEvent(new Event("change")); const all = [...document.querySelectorAll("#rSection option")].map(o => o.value).filter(Boolean);
    for (const o of [...ty.options].filter(o => o.value && o.value !== "other")){ ty.value = o.value; ty.dispatchEvent(new Event("change")); n++;
      const got = [...document.querySelectorAll("#rSection option")].map(x => x.value).filter(Boolean).join(), exp = all.filter(c => TS[o.value].includes(c)).join(); if (got !== exp) out.push(o.value + ": " + got + " / " + exp); }
    return out.length ? out : n; }, TS);
  check(smis === 17, "every sample type offers only the sections it comes from: " + JSON.stringify(smis));
  await Tc.selectOption("#rType", "plant_feed"); await Tc.waitForTimeout(150);
  const ms = await Tc.$$eval("#rSection option", os => os.map(o => o.value).filter(Boolean));
  check(ms.join() === "MET,PLT,ENV" && await Tc.$eval("#rSection", e => e.value) === "PLT", "a mill sample comes from MET, PLT or ENV (not GEO, EXP or MIN), PLT filled in: " + ms.join() + " / " + await Tc.$eval("#rSection", e => e.value));
  await Tc.selectOption("#rPurpose", "met_br"); await Tc.waitForTimeout(150);
  check(await Tc.$eval("#rSection", e => e.value) === "MET", "choosing a testwork purpose moves the section it filled in to MET");
  await Tc.selectOption("#rType", "bullion"); await Tc.waitForTimeout(150);
  check((await Tc.$$eval("#rSection option", os => os.map(o => o.value).filter(Boolean))).join() === "GR" && await Tc.$eval("#rSection", e => e.value) === "GR", "bullion comes from the gold room only");
  await Tc.selectOption("#rType", "rc"); await Tc.selectOption("#rSection", "GEO"); await Tc.selectOption("#rType", "core"); await Tc.waitForTimeout(150);
  check(await Tc.$eval("#rSection", e => e.value) === "GEO", "a section the submitter chose stays when the new type also comes from it");
  await Tc.selectOption("#rType", "belt"); await Tc.waitForTimeout(250);
  check(await Tc.$eval("#rSection", e => e.value) === "PLT", "and gives way when it does not (GEO → PLT for a belt cut)");
  const groups = await Tc.$$eval("#rPurpose optgroup", gs => gs.map(g => g.label)), pur = await Tc.$$eval("#rPurpose option", os => os.map(o => o.textContent));
  check(groups.includes("Metallurgical testwork") && pur.includes("Bottle roll test") && pur.includes("CIL leach test"), "What it is for lists the testwork, grouped: " + groups.join(", "));
  await fillForm(Tc, "register", { section: "PLT", type: "belt", purpose: "plant", test: "aufx_m", submitter: "Shift boss", count: 1, tags: "BC-0601", details: { point: "Mill feed conveyor" } });
  const [b1] = await ids(Tc);
  const steps = doc(b1).plan.map(x => x.key).filter(k => !["submitted", "received", "released", "storage"].includes(k));
  check(doc(b1).route === "BELT" && steps.join(",") === "wet,dry,dryw,crush,split,pulv,fuse,aufx,qc", "BELT: weigh wet, dry, weigh dry, crush, split, pulverise, fire assay, AuFx: " + steps.join(","));

  log("Release at once: complete results go out when they are saved, by the technician");
  const last = await toLast(Tc, b1);
  check(!last && /^Move to: Results released$/.test(await text(Tc, '[data-step="wait"]')) && !(await Tc.$("#holdNote")), "with no results yet the technician moves it on to Results released, nothing on hold (v24d)");
  await Tc.click('[data-step="wait"]'); await waitFor(() => doc(b1).rw, 5000);
  await typeResults(Tc, b1, { h2o: "6.4" });
  check(!doc(b1).certs?.length && doc(b1).stageKey === "aufx", "moisture alone: AuFx is still missing, nothing is released");
  check(/^Waiting for the results: AuFx\./.test(await text(Tc, "#waitNote")) && /released when you save them/.test(await text(Tc, "#waitNote")), "the record says what it waits for: " + await text(Tc, "#waitNote"));
  await typeResults(Tc, b1, { h2o: "6.4", Au: "1.23" });
  await waitFor(() => doc(b1).certs?.length, 5000);
  const c = (doc(b1).certs || [])[0] || {};
  check(c.by === "tech1" && c.role === "tech" && ["released", "storage"].includes(doc(b1).stageKey), "AuFx saved: released at once under the technician's name, certificate " + c.no);
  check(rv(b1, "h2o") === 6.4 && rv(b1, "Au") === 1.23 && /Released when the results were saved/.test(JSON.stringify(doc(b1).history)), "moisture 6.4 % and AuFx 1.23 g/t on the certificate; the history says how it was released");
  await Tc.click("[data-cert]"); await Tc.waitForSelector("#certBox:not([hidden])");
  check(/lab technician/.test(await text(Tc, "#certBox")), "the certificate names the lab technician who released it");
  await Tc.keyboard.press("Escape").catch(() => {}); await Tc.evaluate(() => { const b = document.querySelector("#certBox"); if (b) b.hidden = true; });

  log("Limits and checks never hold the release, and the technician isn't shown them");
  await fillForm(Tc, "register", { section: "PLT", type: "plant_feed", purpose: "plant", test: "ausx", submitter: "Shift boss", count: 1, tags: "TAIL-0601", details: { point: "CIL tails" } });
  const [t1] = await ids(Tc);
  await toLast(Tc, t1);
  await typeResults(Tc, t1, { Au_s: "0.25" });
  await waitFor(() => doc(t1).certs?.length, 5000);
  check((doc(t1).certs || []).length === 1, "AuSx 0.25 mg/L in CIL tails is past a limit, and is released anyway");
  await open(Tc, t1);
  check(!(await Tc.$("#evalBox")) && !(await Tc.$("#alertBox")) && !/past a limit/i.test(await text(Tc, "#resPanel")), "the technician sees no limit alert or evaluation box");

  log("A results file for a lab batch: complete samples are released, a failed check does not hold them");
  await fillForm(Tc, "register", { section: "PLT", type: "plant_feed", purpose: "plant", test: "ausx", submitter: "Shift boss", count: 2, tags: "SOL-A1, SOL-A2", details: { point: "CIL feed" } });
  const sol = await ids(Tc);
  for (const id of sol) await toLast(Tc, id);
  await H.tab(Tc, "batches"); await Tc.waitForSelector('[data-attach="all"]');
  check(!(await Tc.$(".batch-hero")) && !/one run of samples/.test(await text(Tc, "#view-batches")) && !!(await Tc.$('#view-batches [data-attach="all"]')) && /\d+ waiting for results/.test(await text(Tc, ".batch-bar")) && /\d+ closed this month/.test(await text(Tc, ".batch-bar")) && await Tc.$eval("#nbBox", d => !d.open) && !(await Tc.$("#chPanel")), "Batches: no heading text, the counts (waiting, open, closed this month) and Attach results file (v24c); making one by hand is folded away; no QC chart for a technician");
  let ub = await H.attachFile(Tc, "all", "aas-run.csv", `Sample ID,AuSX (mg/L)\n${sol[0]},0.150\n${sol[1]},0.152\nBLANK,0.090\n`);
  await H.saveAttach(Tc); await waitFor(() => sol.every(id => doc(id).certs?.length), 8000);
  check(sol.every(id => (doc(id).certs || []).length === 1 && doc(id).certs[0].by === "tech1"), "both samples are released from the file at once: " + sol.map(id => doc(id).stageKey).join(","));

  log("The metallurgist evaluates on the Results tab and the record");
  await H.tab(Mt, "results"); await Mt.waitForSelector("table.restbl", { timeout: 8000 }).catch(() => {});
  const rt = await text(Mt, "#view-results");
  check(rt.includes(b1) && rt.includes(t1) && /AuFx 1\.23 g\/t/.test(rt) && /Moisture 6\.40 %/.test(rt), "Results lists the released samples with their results in short names");
  check(/flagged/.test(rt) && /to evaluate/.test(rt) && await Mt.$$eval("table.restbl tr.due", t => t.length) >= 1, "flags and the count to evaluate are shown: " + (rt.match(/\d+ flagged \d+ to evaluate/) || [""])[0]);
  check(/^Results \d+$/.test(await text(Mt, '#tabs [data-tab="results"]')) && !!(await Mt.$('#tabs [data-tab="results"] .count.flag')), "the tab counts the flagged results waiting: " + await text(Mt, '#tabs [data-tab="results"]'));
  await open(Mt, t1); await Mt.waitForSelector("#evalBox");
  check(/above the action limit/.test(await text(Mt, "#evalBox")) && /To evaluate/.test(await text(Mt, "#evalBox")), "the record's Evaluation lists the limit crossed: " + (await text(Mt, "#evalBox")).slice(0, 140));
  await Mt.check('input[name="evV"][value="redo"]'); await Mt.click("#evBtn"); await Mt.waitForTimeout(300);
  check(!(doc(t1).evals || []).length, "a re-assay request needs a reason");
  await Mt.fill("#evNote", "CIL tails AuSx high; repeat from the kept solution"); await Mt.click("#evBtn");
  await waitFor(() => (doc(t1).evals || []).length === 1, 5000);
  const e = (doc(t1).evals || [])[0] || {};
  check(e.v === "redo" && e.by === "met" && e.dept === "Metallurgy" && doc(t1).rq === true && doc(t1).history.at(-1).ev, "the evaluation is recorded under the metallurgist's name and department, with a re-assay request");
  await open(Mt, b1); await Mt.check('input[name="evV"][value="ok"]'); await Mt.click("#evBtn"); await waitFor(() => (doc(b1).evals || []).length === 1, 5000);
  check(doc(b1).evals?.[0]?.v === "ok" && !doc(b1).rq, "Accepted needs no comment and asks nothing of the lab");
  await H.tab(Mt, "results"); await Mt.waitForTimeout(600);
  check(/Re-assay requested/.test(await text(Mt, "#view-results")) && /Accepted/.test(await text(Mt, "#view-results")), "the Results tab shows each evaluation");

  log("The lab sees the request; re-assaying clears it");
  await H.tab(Tc, "board"); await Tc.waitForSelector("#bdReq", { timeout: 8000 }).catch(() => {});
  check((await text(Tc, "#bdReq")).includes(t1) && /repeat from the kept solution/.test(await text(Tc, "#bdReq")), "the board lists the re-assay request: " + await text(Tc, "#bdReq"));
  await Tc.click('[data-bpick="req"]'); await Tc.waitForSelector("#bdPick", { timeout: 5000 }).catch(() => {});
  check((await text(Tc, "#bdPick")).includes(t1) && /Requested by Plant Metallurgist/.test(await text(Tc, "#bdPick")) && !!(await Tc.$(`#bdPick [data-open="${t1}"]`)), "v24c: the Re-assay requested tile opens its list, each sample a link: " + (await text(Tc, "#bdPick")).slice(0, 160));
  await Tc.click('#bdPick [data-bpick="req"]'); await Tc.waitForTimeout(200);
  check(!(await Tc.$("#bdPick")), "Close puts the board back");
  await open(Tc, t1);
  check(/Re-assay requested by Plant Metallurgist \(Metallurgy\)/.test(await text(Tc, "#reqNote")) && await Tc.$eval("#redoBox", d => d.open) && await Tc.$eval("#redoWhy", s => s.value) === "Requested on evaluation",
    "the record shows the request and opens Re-assay with its reason");
  await Tc.click("#redoBtn"); await waitFor(() => !doc(t1).rq, 5000);
  check(!doc(t1).rq && doc(t1).reassays === 1, "sending it back for re-assay clears the request");

  log("A viewer outside an evaluating department sees results only");
  await H.tab(Vw, "results"); await Vw.waitForSelector("table.restbl", { timeout: 8000 }).catch(() => {});
  const vr = await text(Vw, "#view-results");
  check(vr.includes(b1) && !/flagged/.test(vr) && !/Evaluation/.test(await text(Vw, "table.restbl thead")), "the Results tab lists results without flags or evaluations");
  await open(Vw, t1);
  check(!(await Vw.$("#evalBox")) && /AuSx/.test(await text(Vw, "#resPanel")), "the record shows the results and no evaluation box");

  log("Board, Storage, Ledger, Routes");
  await H.tab(Tc, "board"); await Tc.waitForTimeout(400);
  const zeros = await Tc.$$eval("div.stat.tile", ts => ts.map(t => [t.classList.contains("zero"), +t.querySelector(".n").textContent]));
  check(zeros.length && zeros.every(([z, n]) => z && n === 0), "only tiles with nothing in them are not buttons, and they are marked empty");
  const btns = await Tc.$$eval("button.stat.tile", ts => ts.map(t => [t.dataset.bpick || "", +t.querySelector(".n").textContent]));
  check(btns.length && btns.every(([k, n]) => k && n > 0), "every tile with a number is a button that opens its list: " + btns.map(b => b.join("=")).join(", "));
  const relT = btns.find(b => b[0] === "rel");
  check(relT && relT[1] > 0, "Results released today counts today's releases: " + JSON.stringify(relT));
  await Tc.click('[data-bpick="rel"]'); await Tc.waitForSelector("#bdPick", { timeout: 5000 }).catch(() => {});
  const pk = await Tc.$$eval("#bdPick tbody tr", rs => rs.length);
  check(pk === relT[1] && /Released /.test(await text(Tc, "#bdPick")) && (await text(Tc, "#bdPick")).includes(b1), "clicking it lists every sample released today, with the time (" + pk + ")");
  await Tc.click(`#bdPick [data-open="${b1}"]`); await Tc.waitForTimeout(400);
  check(/Sample ID|Workflow/i.test(await text(Tc, "#view-track")) && (await text(Tc, "#view-track")).includes(b1), "a sample in the list opens its record");
  await H.tab(Tc, "board"); await Tc.waitForTimeout(300);
  for (const b of btns.filter(b => b[0] !== "rel")){ await Tc.click(`[data-bpick="${b[0]}"]`); await Tc.waitForTimeout(200); const n = await Tc.$$eval("#bdPick tbody tr, #bdPick .todo-row", rs => rs.length).catch(() => 0) || await Tc.$$eval(".lanes .chip", cs => cs.length).catch(() => 0); check(n > 0, `the ${b[0]} tile opens a list of ${n} (v33: or narrows the lanes to them; v34: the lab's to-do for storage and retention)`); await Tc.click(`#bdPick [data-bpick="${b[0]}"]`).catch(() => {}); await Tc.waitForTimeout(150); }
  check(!(await Tc.$('[data-bpick="qc"]')) && !/QC to act on/.test(await text(Tc, "#view-board")), "the lab's board has no QC-to-act-on tile");
  await H.tab(Tc, "storage"); await Tc.waitForTimeout(400);
  check(!/Retained material, oldest due first/.test(await text(Tc, "#view-storage")) && !(await Tc.$("#view-storage h2")), "v24c: Storage starts with its cards, no heading text");
  check((await Tc.$$("#view-storage .cstats .stat")).length === 5 && await Tc.$$eval("#view-storage [data-stshow]", b => b.length) === 5, "Storage: five coloured summary cards that filter");
  await Tc.click('#view-storage [data-stshow="past"]'); await Tc.waitForTimeout(300);
  check(await Tc.$eval("#stShow", e => e.value) === "past", "Past retention filters the list");
  await H.tab(Tc, "ledger"); await Tc.waitForTimeout(500);
  check(!/Every sample received and every material/.test(await text(Tc, "#view-ledger")) && !(await Tc.$("#view-ledger h2")), "v24c: the Ledger starts with its cards, no heading text");
  check(/Received in/.test(await text(Tc, "#view-ledger .cstats")) && (await Tc.$$("#view-ledger .dirp.dir-in")).length >= 4, "Ledger: received and sent-out cards, IN shown as a pill");
  check(await Tc.$$eval("#view-ledger thead th", t => t.length) === 9, "the ledger fits in nine columns");
  await H.tab(Tc, "routes"); await Tc.waitForSelector("#rtList details.route");
  const codes = await Tc.$$eval("#rtList details.route", ds => ds.map(d => d.dataset.code));
  check(["BELT", "ICP", "LECO", "MOIST", "PSD", "DENSITY", "CN-SOL", "CN-SPEC", "ENV-W", "CONC", "CHECK"].every(x => codes.includes(x)) && !codes.includes("BRT") && !codes.includes("CIL-T"),
    "analytical routes are in use, testwork routes are not: " + codes.length + " routes");
  await Tc.click("#route-BELT summary");
  const br = await text(Tc, "#route-BELT");
  check((await Tc.$$("#route-BELT ol.flow li")).length === 10 && /Results reported: Moisture \(%\), AuFx \(g\/t\)/.test(br) && !(await Tc.$("#route-BELT table")), "a route reads as a row of steps and one line of results, no table: " + br.slice(0, 120));
  check(!/Lab batch/.test(br), "a technician's route view leaves out batches and limits");
  const hd = await Tc.$$eval("#rtList > h3", hs => hs.map(h => h.textContent));
  check(new Set(hd).size === hd.length, "each route group appears once: " + hd.join(", "));

  log("Testwork: the products of a bottle roll come in as a sample type the lab has, marked by what they are for");
  await fillForm(Tc, "register", { section: "MET", type: "plant_feed", purpose: "met_br", test: "ausx", submitter: "Met lab", count: 1, tags: "BR-014-24H", details: { point: "CIL feed" } });
  const [w1] = await ids(Tc);
  check(doc(w1).route === "AUSX" && doc(w1).purpose === "Bottle roll test" && doc(w1).purposeKey === "met_br" && doc(w1).typeKey === "plant_feed", "a bottle roll solution on mill feed goes on the AuSx route, its purpose Bottle roll test");

  log("Font: larger again (v24c)");
  check(await Tc.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize)) === 18 && await Tc.evaluate(() => parseFloat(getComputedStyle(document.querySelector(".small") || document.body).fontSize)) >= 16
    && await Tc.evaluate(() => parseFloat(getComputedStyle(document.querySelector("label.f") || document.body).fontSize)) >= 17, "v24c: body text 18 px, labels 17 px, small text 16 px");

  log("Any file is accepted: a PDF on a sample still in preparation, a CSV that names no samples");
  await fillForm(Tc, "register", { section: "PLT", type: "belt", purpose: "plant", test: "aufx_m", submitter: "Shift boss", count: 1, tags: "BC-0700", details: { point: "Mill feed conveyor" } });
  const [p1] = await ids(Tc);
  await open(Tc, p1);
  check(doc(p1).stageKey === "received" && !!(await Tc.$(`[data-attach="sample:${p1}"]`)), "a received sample offers Attach results file at once, before any analysis step");
  let up = await H.attachFile(Tc, `sample:${p1}`, "SGS-report.pdf", Buffer.from("%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer\n%%EOF"));
  check(/PDF/.test(up) && /can't be read here/.test(up) && new RegExp(p1).test(up) && /Save and release \(1\)/.test(up) && !/No column of sample IDs/.test(up), "a PDF is accepted: it will be kept as the sample's results and the sample released: " + up.slice(0, 200));
  await H.saveAttach(Tc); await waitFor(() => doc(p1).certs?.length, 8000);
  const pc = (doc(p1).certs || [])[0] || {};
  check(pc.att && pc.file?.name === "SGS-report.pdf" && pc.by === "tech1" && doc(p1).results?.att && (doc(p1).fids || []).includes(pc.file.id) && store["files/" + pc.file.id]?.name === "SGS-report.pdf",
    "released at once with the PDF as its results; the file is kept and listed on the sample");
  check(doc(p1).history.filter(e => /Done: results saved/.test(e.note || "")).length >= 8, "the steps it skipped are recorded as done with the results");
  await open(Tc, p1);
  check(/Results file: SGS-report\.pdf/.test(await text(Tc, "#resPanel")) && /the results are in this file/.test(await text(Tc, "#resPanel")), "the record names the file the results are in");
  await Tc.click("[data-cert]"); await Tc.waitForSelector("#certBox:not([hidden])");
  check(/Results file: SGS-report\.pdf\. The results are in this file\./.test(await text(Tc, "#certBox")) && !(await Tc.$("#certBox table.cert-res")), "the certificate names the file and shows no empty results table");
  await Tc.evaluate(() => { const b = document.querySelector("#certBox"); if (b){ b.hidden = true; b.innerHTML = ""; } });
  await fillForm(Tc, "register", { section: "PLT", type: "plant_feed", purpose: "plant", test: "ausx", submitter: "Shift boss", count: 2, tags: "NOID-1, NOID-2", details: { point: "CIL feed" } });
  const nid = await ids(Tc);
  await H.tab(Tc, "batches"); await Tc.waitForSelector('[data-attach="all"]');
  up = await H.attachFile(Tc, "all", "run-sheet.csv", "Lab no,AuSX (mg/L)\n1,0.150\n2,0.152\n");
  check(/Which samples are these results for/.test(up) && await Tc.$eval("#upSave", b => b.disabled), "a file that names no sample asks which samples it is for; nothing is saved until one is ticked");
  for (const id of nid) await Tc.check(`[data-uppick="${id}"]`);
  check(/Save and release \(2\)/.test(await Tc.textContent("#upSave")), "ticking the two samples offers to release both");
  await H.saveAttach(Tc); await waitFor(() => nid.every(id => doc(id).certs?.length), 8000);
  check(nid.every(id => doc(id).certs?.[0]?.file?.name === "run-sheet.csv" && doc(id).certs[0].att), "both are released with the file as their results");

  log("Sign-off can still be chosen");
  await H.tab(Ad, "stages"); await Ad.waitForSelector("#cfgRel"); await H.cfgTab(Ad, "accounts").catch(() => {});
  await Ad.selectOption("#cfgRel", "signoff"); await Ad.waitForSelector("#cfgQcStep"); await Ad.click("#cfgSave");
  await waitFor(() => store["settings/stages"]?.relMode === "signoff", 5000); await Tc.waitForTimeout(600);
  await fillForm(Tc, "register", { section: "PLT", type: "belt", purpose: "plant", test: "aufx_m", submitter: "Shift boss", count: 1, tags: "BC-0602", details: { point: "Mill feed conveyor" } });
  const [b2] = await ids(Tc);
  await toLast(Tc, b2); await typeResults(Tc, b2, { h2o: "5", Au: "0.9" });
  await open(Tc, b2);
  check(!doc(b2).certs?.length && /A lab supervisor releases the results/.test(await text(Tc, "#moveForm")), "with sign-off, saving results releases nothing and a supervisor releases them");

  console.log("Console errors:", JSON.stringify(errors));
  await browser.close();
})();
