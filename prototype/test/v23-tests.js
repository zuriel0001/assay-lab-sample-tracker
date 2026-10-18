// v23: the routes the lab runs. Plant samples (mill, CCD, TSF) are a slurry or a solution read for AuFx and AuSx, CCD and TSF add cyanide,
// carbon gets its gold loading and elution solutions AuSx; ore keeps fire assay. The other routes are kept but not in use: old samples keep
// their steps and an admin turns a route back on in Settings > Workflow routes. New default limits join saved settings once.
// Run: NODE_PATH=$(npm root -g) timeout 590 node v23-tests.js
const H = require("./harness");
const { store, errors, newUser, launch, signIn, fillForm, ids, open, doc, waitFor } = H;
const names = {};
const log = (...a) => console.log("•", ...a);
const check = (cond, msg) => { console.log(cond ? "  PASS" : "  FAIL", msg); if (!cond) process.exitCode = 1; };
const text = async (page, sel) => ((await page.textContent(sel).catch(() => "")) || "").replace(/\s+/g, " ").trim();
const IN_USE = ["EXP-FA", "GC-FA", "FA-GRAV", "SFA", "BULLION", ...H.NEW_ROUTES];
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
/* What Submit picks for a sample type: analysis, purpose, route shown, and whether the route list is offered. */
async function picks(page, type){
  await page.selectOption("#rType", type); await page.waitForTimeout(200);
  return page.evaluate(() => ({ test: document.querySelector("#rTest").value, purpose: document.querySelector("#rPurpose").value,
    route: (document.querySelector("#rRoute .code") || {}).textContent || "", choose: !document.querySelector("#rRouteSel")?.closest("label")?.hidden,
    tests: [...document.querySelectorAll("#rTest option")].map(o => o.value), first: document.querySelector("#rTest optgroup")?.label || "" }));
}
const rv = (id, k) => doc(id).results?.rows?.[k]?.v;

(async () => {
  const browser = await launch();
  const Tc = await newUser(browser, { uid: "u_t", name: "Tech", canEdit: true, names }); await signIn(Tc, "tech1");
  const Sv = await newUser(browser, { uid: "u_s", name: "Super", canEdit: true, names }); await signIn(Sv, "super");
  const Ad = await newUser(browser, { uid: "u_a", name: "Admin", canEdit: true, names }); await signIn(Ad, "admin");
  await Tc.waitForTimeout(1000);

  log("Routes tab: only the routes the lab runs");
  await H.tab(Tc, "routes"); await Tc.waitForSelector("#rtList details.route");
  const codes = await Tc.$$eval("#rtList details.route", ds => ds.map(d => d.dataset.code));
  check(codes.length === 27 && IN_USE.every(c => codes.includes(c)) && !codes.includes("BRT"), "27 routes listed (v24: the analytical routes are back): " + codes.join(", "));
  check(!codes.includes("CCD-SVY") && !codes.includes("PLT-HEAD") && !codes.includes("CARBON"), "the old CCD survey, mill head and carbon routes are not listed");
  const head = await text(Tc, "#view-routes .panel h3");
  const cats = await Tc.$$eval("#view-routes .cat-name", xs => xs.map(x => x.textContent.trim()));
  check(/^All \d+ tests$/.test(head) && +head.match(/\d+/)[0] <= 26, "the test list is the analyses in use: " + head + " (" + cats.join(", ") + ")");
  check(cats.includes("Process plant") && cats.includes("Gold room"), "tests sit under Process plant and Gold room");
  const types = await Tc.$$eval("#rtType option", os => os.map(o => o.value).filter(Boolean));
  check(["plant_feed", "ccd", "tsf", "carbon", "elution", "bullion", "rc", "core"].every(k => types.includes(k)) && types.includes("belt") && types.includes("tw_sol"), "sample types: those a route in use takes, Belt cut and testwork included (" + types.length + ")");

  log("Submit picks the analysis, purpose and route from the sample type");
  await H.tab(Tc, "register"); await Tc.waitForSelector("#rSubmit");
  let p = await picks(Tc, "plant_feed");
  check(p.test === "aufx_ausx" && p.purpose === "plant" && p.route === "AUFX-AUSX" && !p.choose, "Mill sample: Slurry AuFx & AuSx, purpose Process plant, route AUFX-AUSX with no route list: " + JSON.stringify([p.test, p.purpose, p.route, p.choose]));
  check(p.first === "Mill sample" && ["aufx_ausx", "aufx", "ausx", "cn_only"].every(k => p.tests.includes(k)) && !p.tests.includes("plant_solids") && !p.tests.includes("o2"), "the analysis list starts with the mill sample's own and leaves out retired tests: " + p.tests.join(","));
  p = await picks(Tc, "ccd");
  check(p.test === "aufx_ausx_cn" && p.route === "AUFX-AUSX-CN", "CCD sample: AuFx, AuSx & cyanide: " + p.route);
  p = await picks(Tc, "tsf");
  check(p.test === "aufx_ausx_cn" && p.route === "AUFX-AUSX-CN", "TSF sample: AuFx, AuSx & cyanide: " + p.route);
  p = await picks(Tc, "carbon");
  check(p.test === "c_load" && p.route === "C-LOAD", "Carbon: Au loading: " + p.route);
  p = await picks(Tc, "elution");
  check(p.test === "elu_sol" && p.route === "ELU-AUSX", "Elution sample: AuSx, AgSx & Cu: " + p.route);
  p = await picks(Tc, "rc");
  check(p.purpose === "exp" && p.route === "EXP-FA", "RC chips: exploration fire assay: " + p.purpose + " " + p.route);
  await Tc.selectOption("#rPurpose", "gc"); p = await picks(Tc, "core");
  check(p.purpose === "gc", "a purpose the submitter chose stays when the type changes");
  await Tc.selectOption("#rType", "ccd"); await Tc.selectOption("#rTest", "ausx_cn"); await Tc.waitForTimeout(200);
  check(await text(Tc, "#rRoute .code") === "AUSX-CN", "choosing Solution: AuSx & cyanide shows route AUSX-CN");
  const pts = await Tc.$$eval("#rD_point option", os => os.map(o => o.textContent));
  check(["CCD overflow", "CCD underflow", "CCD tails"].every(x => pts.includes(x)), "a CCD sampling point is chosen from a list: " + pts.join(", "));

  log("A mill sample: filtered, AuSx, then solids to fire assay; the sampling point given at submission is the results' point");
  await fillForm(Tc, "register", { section: "PLT", type: "plant_feed", purpose: "plant", test: "aufx_ausx", submitter: "Shift metallurgist", count: 2, tags: "CILT-1, CILT-2", details: { point: "CIL tails" } });
  const [m1, m2] = await ids(Tc);
  check(doc(m1).route === "AUFX-AUSX" && doc(m1).details?.["Sampling point"] === "CIL tails", "on route AUFX-AUSX with sampling point CIL tails");
  const keys = doc(m1).plan.map(x => x.key);
  check(["wet", "filter", "ausx", "dry", "pulv", "fuse", "aufx"].every((k, i, a) => keys.indexOf(k) >= 0 && (i === 0 || keys.indexOf(a[i - 1]) < keys.indexOf(k))), "steps in order: weigh, filter, AuSx, dry, pulverise, fusion, AuFx: " + keys.join(","));
  const end = await toLast(Tc, m1);
  check(/A lab supervisor releases the results\./.test(end) && doc(m1).stageKey === "aufx", "it moves through every step to AuFx without being stopped (at " + doc(m1).stageKey + ")");
  check(await text(Tc, "#holdNote") === "Release on hold: Results missing: AuFx, AuSx.", "the hold note names the results as the lab does: " + await text(Tc, "#holdNote"));
  await open(Tc, m1); await Tc.$eval("#resBox", d => { d.open = true; });
  check(await Tc.$eval("#rs_pt", e => e.value) === "CIL tails", "the results' sampling point is already CIL tails");
  const lbl = await Tc.$$eval("#resBox label", ls => ls.map(l => l.textContent.replace(/\s+/g, " ").trim()).join(" | "));
  check(/AuFx/.test(lbl) && /AuSx/.test(lbl) && /NaCN/.test(lbl), "the results form asks for AuFx and AuSx, with NaCN optional");
  await typeResults(Tc, m1, { Au: "0.15", Au_s: "0.035" });
  await open(Sv, m1);
  const h1 = await text(Sv, "#holdNote");
  check(/^Release on hold: AuSx 0\.035 mg\/L is above the action limit of 0\.02 mg\/L \(CIL tails\)/.test(h1), "AuSx 0.035 at CIL tails is past the 0.02 action limit: " + h1);
  await toLast(Tc, m2); await typeResults(Tc, m2, { Au: "0.12", Au_s: "0.008" });
  await open(Sv, m2);
  check(!(await text(Sv, "#holdNote")) && !(await Sv.$eval('[data-step="next"]', b => b.disabled)), "AuFx 0.12 and AuSx 0.008 at CIL tails: nothing holds the release");
  await Sv.click('[data-step="next"]'); await waitFor(() => doc(m2).released || doc(m2).cert || /release|report|store/.test(stageOf(doc(m2))), 5000);
  check(!!(doc(m2).cert || doc(m2).released || /release|store/.test(stageOf(doc(m2)))), "the supervisor releases it");

  log("A CCD slurry: cyanide read with the AuSx, then AuFx; a results file fills it");
  await fillForm(Tc, "register", { section: "PLT", type: "ccd", purpose: "plant", test: "aufx_ausx_cn", submitter: "Plant metallurgist", count: 1, tags: "CCD-UF-7", details: { point: "CCD tails" } });
  const [c1] = await ids(Tc);
  const ck = doc(c1).plan.map(x => x.key);
  check(doc(c1).route === "AUFX-AUSX-CN" && ck.indexOf("cn") > ck.indexOf("filter") && ck.indexOf("cn") < ck.indexOf("ausx") && ck.indexOf("ausx") < ck.indexOf("fuse"), "AUFX-AUSX-CN: filter, cyanide straight away, AuSx, then the solids: " + ck.join(","));
  await toLast(Tc, c1);
  check(await text(Tc, "#holdNote") === "Release on hold: Results missing: AuFx, AuSx, CNWAD.", "it needs AuFx, AuSx and CNWAD (NaCN and pH optional): " + await text(Tc, "#holdNote"));
  await open(Tc, c1);
  const up = await H.attachFile(Tc, `sample:${c1}`, "mill-assays.csv", `Sample ID,AuFA (ppm),AuSX (ppm),NaCN (ppm),CNWAD (ppm),pH\n${c1},0.18,0.042,85,12.5,10.4\n`);
  check(/Results on 1 sample record/.test(up), "the file is read for this record: " + up.slice(0, 160));
  await H.saveAttach(Tc); await waitFor(() => doc(c1).results, 5000);
  check(rv(c1, "Au") === 0.18 && rv(c1, "Au_s") === 0.042 && rv(c1, "cn") === 85 && rv(c1, "wad") === 12.5 && rv(c1, "pH") === 10.4, "AuFA read as AuFx, AuSX as AuSx, NaCN, CNWAD and pH: " + JSON.stringify(Object.fromEntries(Object.entries(doc(c1).results?.rows || {}).map(([k, r]) => [k, r.v]))));
  await open(Sv, c1);
  check(!(await text(Sv, "#holdNote")), "with the file's results nothing holds the release (AuSx 0.042 is under the CCD tails limit for this route)");

  log("Carbon and elution");
  await fillForm(Tc, "register", { section: "PLT", type: "carbon", purpose: "plant", test: "c_load", submitter: "Gold room", count: 1, tags: "EC-12", details: { ctype: "Eluted carbon" } });
  const [k1] = await ids(Tc);
  check(doc(k1).route === "C-LOAD" && doc(k1).plan.some(x => x.key === "ash") && doc(k1).plan.some(x => x.key === "load"), "carbon: wash, dry, split, ash, Au loading");
  await toLast(Tc, k1); await open(Tc, k1); await Tc.$eval("#resBox", d => { d.open = true; });
  check(await Tc.$eval("#rs_pt", e => e.value) === "Eluted carbon", "the carbon type given at submission is the results' carbon type");
  await typeResults(Tc, k1, { Au_c: "140" });
  await open(Sv, k1);
  check(/100/.test(await text(Sv, "#holdNote")), "eluted carbon at 140 g/t is past the 100 g/t limit: " + await text(Sv, "#holdNote"));
  await fillForm(Tc, "register", { section: "PLT", type: "elution", purpose: "plant", test: "elu_sol", submitter: "Gold room", count: 1, tags: "EW-T-3", details: { sol: "Electrowinning tails" } });
  const [e1] = await ids(Tc);
  check(doc(e1).route === "ELU-AUSX", "elution solution on ELU-AUSX");
  await toLast(Tc, e1);
  check(await text(Tc, "#holdNote") === "Release on hold: Results missing: AuSx.", "it needs AuSx (silver, copper, NaOH, NaCN and pH optional): " + await text(Tc, "#holdNote"));

  log("Board: the route filter lists the routes in use");
  await H.tab(Sv, "board"); await Sv.waitForSelector("#bdRoute");
  const br = await Sv.$$eval("#bdRoute option", os => os.map(o => o.value).filter(Boolean));
  check(br.includes("AUFX-AUSX") && br.includes("C-LOAD") && br.includes("BELT") && !br.includes("CCD-SVY"), "board filter: routes in use only (" + br.length + ")");

  log("Settings: a route not in use comes back with In use");
  await H.tab(Ad, "stages"); await Ad.waitForSelector("#cfgSave"); await H.cfgTab(Ad, "routes").catch(() => {});
  const grp = await Ad.$$eval("#rtPick optgroup", gs => gs.map(g => [g.label, g.children.length]));
  check(JSON.stringify(grp) === JSON.stringify([["In use", 27], ["Not in use", 24]]), "the route list is split In use (27) and Not in use (24): " + JSON.stringify(grp));
  const idx = await Ad.$eval("#rtPick", s => [...s.options].find(o => /^CCD-SVY /.test(o.textContent)).value);
  await Ad.selectOption("#rtPick", idx); await Ad.waitForTimeout(150);
  check(!(await Ad.$eval("#rtUse", e => e.checked)), "CCD-SVY is not in use");
  await Ad.setChecked("#rtUse", true); await Ad.waitForTimeout(150); await Ad.click("#cfgSave");
  await waitFor(() => store["settings/stages"]?.routeUse?.["CCD-SVY"] === true, 5000);
  check(store["settings/stages"]?.routeUse?.["CCD-SVY"] === true && Object.keys(store["settings/stages"].routeUse).length === 1, "saved: only the change is stored " + JSON.stringify(store["settings/stages"]?.routeUse));
  await Tc.waitForTimeout(500);
  await H.tab(Tc, "routes"); await Tc.waitForSelector("#rtList details.route");
  check((await Tc.$$eval("#rtList details.route", ds => ds.map(d => d.dataset.code))).includes("CCD-SVY"), "the Routes tab lists CCD-SVY again");
  await fillForm(Tc, "register", { section: "MET", type: "ccd", purpose: "plant", test: "ccd", submitter: "Plant metallurgist", count: 1, tags: "SVY-1" });
  const [o1] = await ids(Tc);
  check(doc(o1).route === "CCD-SVY", "a CCD survey can be submitted again");
  await Ad.waitForTimeout(300); await H.cfgTab(Ad, "routes").catch(() => {});
  await Ad.selectOption("#rtPick", await Ad.$eval("#rtPick", s => [...s.options].find(o => /^CCD-SVY /.test(o.textContent)).value)); await Ad.waitForTimeout(150);
  await Ad.setChecked("#rtUse", false); await Ad.waitForTimeout(150); await Ad.click("#cfgSave");
  await waitFor(() => !store["settings/stages"]?.routeUse?.["CCD-SVY"], 5000);
  check(JSON.stringify(store["settings/stages"]?.routeUse) === "{}", "turned off again, nothing is stored (the default)");
  await Tc.waitForTimeout(500);
  await open(Tc, o1);
  const rail = await Tc.$$eval(".rail li", ls => ls.map(l => l.textContent.replace(/\s+/g, " ").trim()));
  check(rail.some(x => /Wash efficiency/.test(x)), "the sample already on CCD-SVY keeps its steps");
  await H.tab(Sv, "board"); await Sv.waitForSelector("#bdRoute");
  check((await Sv.$$eval("#bdRoute option", os => os.map(o => o.value))).includes("CCD-SVY"), "and the board filter still offers CCD-SVY while that sample is in the lab");
  await H.tab(Tc, "routes"); await Tc.waitForSelector("#rtList details.route");
  check(!(await Tc.$$eval("#rtList details.route", ds => ds.map(d => d.dataset.code))).includes("CCD-SVY"), "the Routes tab no longer lists it");

  log("Settings: limits on routes in use first, the others drawn when opened");
  await H.cfgTab(Ad, "limits").catch(() => {});
  const lim = await Ad.$$eval("#view-stages [data-lf='route']", ss => ss.map(s => s.value));
  check(["AUFX-AUSX", "AUFX-AUSX-CN", "AUSX-CN", "CN", "C-LOAD", "ELU-AUSX"].every(c => lim.includes(c)), "the plant, carbon and elution limits are in the table: " + [...new Set(lim)].join(","));
  const off = await text(Ad, "#limOff summary");
  check(/^Limits on routes not in use \(\d+\)$/.test(off) && !(await Ad.$("#limOffBox [data-lf]")), "the limits on routes not in use wait behind " + off);
  const opts = await Ad.$$eval("#view-stages [data-lf='route']", ss => ss[0] ? [...ss[0].options].map(o => o.value) : []);
  check(opts.length <= 28, "a limit's route is chosen from the routes in use (" + opts.length + ")");
  await Ad.click("#limOff summary"); await Ad.waitForTimeout(250);
  check(await Ad.$$eval("#limOffBox [data-lf='route']", ss => ss.length) > 0, "opening the group draws them");

  log("Saved settings from before v23 get the new limits once");
  const saved = H.clone(store["settings/stages"]);
  store["settings/stages"] = { ...saved, limits: [{ id: "L01", route: "EXP-FA", k: "Au", op: ">", val: 50, act: "Check" }], limitsV: undefined };
  delete store["settings/stages"].limitsV;
  const Ad2 = await newUser(browser, { uid: "u_a2", name: "Admin 2", canEdit: true, names }); await signIn(Ad2, "admin");
  await H.tab(Ad2, "stages"); await Ad2.waitForSelector("#cfgSave"); await H.cfgTab(Ad2, "limits").catch(() => {});
  let ls = await Ad2.$$eval("#view-stages [data-lf='route']", ss => ss.map(s => s.value));
  check(ls.length === 11 && ls[0] === "EXP-FA" && ls.includes("AUFX-AUSX"), "the saved limit stays and the 10 plant limits join it: " + ls.join(","));
  await Ad2.click('[data-lrm="1"]'); await Ad2.waitForTimeout(150); await Ad2.click("#cfgSave");
  await waitFor(() => store["settings/stages"]?.limitsV === 23, 5000);
  check(store["settings/stages"].limitsV === 23 && store["settings/stages"].limits.length === 10, "removing one and saving stores the list and the version");
  const Ad3 = await newUser(browser, { uid: "u_a3", name: "Admin 3", canEdit: true, names }); await signIn(Ad3, "admin");
  await H.tab(Ad3, "stages"); await Ad3.waitForSelector("#cfgSave"); await H.cfgTab(Ad3, "limits").catch(() => {});
  ls = await Ad3.$$eval("#view-stages [data-lf='route']", ss => ss.map(s => s.value));
  check(ls.length === 10, "a removed default limit does not come back (" + ls.length + ")");

  log("A shift report laid out like the lab's (method, repeat and unit rows above the names), attached on Lab batches");
  await fillForm(Tc, "register", { section: "PLT", type: "plant_feed", purpose: "plant", test: "aufx_ausx", submitter: "Shift metallurgist", count: 2, tags: "SYN-FEED, SYN-TAIL", details: { point: "CIL feed" } });
  const sy = await ids(Tc);
  const rep = [",,,FAA505,FAA505,SOL81X,SOL81X", ",,,1,2,1,2", ",,,ppm,ppm,mg/L,mg/L", "Lab no,Sample,Description,AuFA,AuFA,AuSX,AuSX",
    "1,SYN-FEED,CIL feed,1.20,1.22,0.150,0.152", "2,SYN-TAIL,CIL tails,0.14,0.15,0.010,0.011"].join("\n") + "\n";
  await H.tab(Sv, "batches"); await Sv.waitForSelector('[data-attach="all"]');
  let ub = await H.attachFile(Sv, "all", "shift-report.csv", rep);
  if (await Sv.$("#upMove")){ await Sv.click("#upMove"); await waitFor(() => sy.every(id => doc(id).stageKey !== "received"), 8000); await Sv.waitForTimeout(600); ub = (await Sv.textContent("#upBox")).replace(/\s+/g, " "); }
  check(!/Two columns for one result/.test(ub) && /plant shift batch/i.test(ub) && /solution AAS run/i.test(ub), "AuFA goes to the plant batch and AuSX to the solution batch, with no clash: " + (ub.match(/Saves.*?(Check|Not used|Values read)/) || [""])[0].slice(0, 220));
  await H.saveAttach(Sv); await waitFor(() => sy.every(id => doc(id).results), 8000);
  check(rv(sy[0], "Au") === 1.2 && rv(sy[0], "Au_s") === 0.15 && rv(sy[1], "Au") === 0.14 && rv(sy[1], "Au_s") === 0.01, "each record has its AuFx and AuSx from the report");

  console.log("Console errors:", JSON.stringify(errors));
  await browser.close();
})();
function stageOf(s){ return s?.stageKey || ""; }
