// End-to-end test of the tracker: several users on one shared in-memory store (see harness.js).
const H = require("./harness");
const { store, errors, broadcast, newUser, launch, T, visibleTabs, signIn, fillForm, ids, open, doc, ledger, toastText, localStr } = H;
const OUT = __dirname;
const names = { u_z: "Zuriel" };
const log = (...a) => console.log("•", ...a);
const check = (cond, msg) => { console.log(cond ? "  PASS" : "  FAIL", msg); if (!cond) process.exitCode = 1; };
const DAY = 86400e3, now0 = Date.now();
const noScroll = p => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const moves = id => ledger().filter(m => m.sid === id);

(async () => {
  // Records written by earlier versions, to check the one-off upgrade.
  store["samples/MET-2026-00001"] = { id: "MET-2026-00001", type: "Mill feed", purpose: "Grade control", submitter: "Zuriel", section: "MET", tagNo: "OLD-7", createdAt: now0 - 3600e3, createdBy: "u_z", stageKey: "drying", stageAt: now0 - 1800e3,
    history: [{ key: "received", at: now0 - 3600e3, by: "u_z", note: "Registered" }, { key: "drying", at: now0 - 1800e3, by: "u_z" }, { key: "drying", at: now0 - 1700e3, by: "u_z", note: "note at drying" }] };
  store["samples/EXP-20261001-0001"] = { id: "EXP-20261001-0001", type: "Diamond drill core", purpose: "Exploration", submitter: "Old", section: "EXP", createdAt: now0 - 30 * DAY, stageKey: "storage", stageAt: now0 - 9 * DAY, location: "Shelf A1",
    retention: [{ item: "Pulp", days: 365, then: "Returned to geology" }, { item: "Coarse reject", days: 5, then: "Disposed" }],
    history: [{ key: "received", at: now0 - 29 * DAY, tech: "Old tech" }, { key: "released", at: now0 - 10 * DAY, tech: "Old manager" }, { key: "storage", at: now0 - 9 * DAY, tech: "Old tech", ref: "Shelf A1" }] };
  store["samples/EXP-20261001-0002"] = { id: "EXP-20261001-0002", type: "RC chips", purpose: "Exploration", submitter: "Old", section: "EXP", createdAt: now0 - 30 * DAY, stageKey: "disposed", stageAt: now0 - 2 * DAY,
    history: [{ key: "received", at: now0 - 29 * DAY, tech: "Old tech" }, { key: "received", at: now0 - 28 * DAY, tech: "Old tech", note: "correction" }, { key: "released", at: now0 - 20 * DAY }, { key: "storage", at: now0 - 19 * DAY }, { key: "disposed", at: now0 - 2 * DAY, tech: "Old tech" }] };
  const browser = await launch();
  require("./harness").useOldRoutes();   // v23: this suite is written around the routes in use before version 23
  const P = await newUser(browser, { uid: "u_z", name: "Zuriel", canEdit: true, names });
  await P.waitForTimeout(2200);   // one-off upgrade runs 1.5 s after load
  await H.useQcStep(browser);   // v22: this suite is written around the QA/QC review step, which Settings now turn on (after the upgrade)

  log("Upgrade of earlier records");
  const L1 = doc("MET-2026-00001"), L2 = doc("EXP-20261001-0001"), L3 = doc("EXP-20261001-0002");
  check(store["meta/schema"]?.v === 13, "upgrade ran once and recorded schema 13");
  const st2 = store["stock/EXP-20261001-0001"], st3 = store["stock/EXP-20261001-0002"];
  check(L1.lab === true && L2.lab === false && L3.lab === false && st2?.st === "store" && st2.m.length === 2 && st3?.st === "out" && st3.gone < 9e15 && !L2.sx && !L3.sx,
    "upgrade marks what is still in the lab and writes a stock record per received sample (stored, closed)");
  check(L1.qcp === "" && doc("EXP-20261001-0001").qcp === "", "legacy samples without a lab batch get their results on the record (no batch type)");
  check(L1.open === true && L1.onHand === true && L1.tags[0] === "OLD-7" && moves("MET-2026-00001").filter(m => m.dir === "in").length === 1, "legacy in-progress sample: open, on hand, tag list, exactly one IN movement (not one per note)");
  check(L2.open === true && L2.materials.length === 2 && L2.materials[1].dueAt < Date.now() && L2.materials[0].loc === "Shelf A1", "legacy stored sample gets one line per retained material, each with its own due date");
  check(L3.open === false && moves("EXP-20261001-0002").filter(m => m.dir === "in").length === 1 && moves("EXP-20261001-0002").filter(m => m.dir === "out").length === 1, "legacy disposed sample: closed, one IN and one OUT despite a duplicate receipt entry");

  log("Public submission picks a route from type + purpose + test");
  // v16: people who are not signed in register walk-in samples at the lab; Submit a sample needs a sign-in.
  check(JSON.stringify(await visibleTabs(P)) === JSON.stringify(["track", "register", "routes", "login"]), "public tabs: " + (await visibleTabs(P)).join(","));
  await P.click('[data-tab="register"]');
  await P.selectOption("#rType", "core"); await P.selectOption("#rPurpose", "exp");
  check(await P.$eval("#rTest", e => e.value) === "fa_aas" && /EXP-FA/.test(await P.textContent("#rRoute")), "core + exploration defaults to fire assay, route EXP-FA shown");
  await P.selectOption("#rPurpose", "met");
  check(await P.$eval("#rTest", e => e.value) === "bottle" && /BRT/.test(await P.textContent("#rRoute")), "purpose testwork switches core to bottle roll (BRT)");
  await P.selectOption("#rType", "ccd");
  check(await P.$eval("#rHz_cn", e => e.checked), "CCD sample pre-ticks the cyanide hazard");
  await P.click("#rAgain").catch(() => {});
  await fillForm(P, "submit", { section: "EXP", tags: "T-500", submitter: "Esi Geologist", details: { hole: "KDD-0231", from: "12.5", to: "13.5" } });
  const s1 = (await ids(P))[0];
  check(s1 === `EXP-${T}-0001`, "public gets ID " + s1);
  const d1 = doc(s1);
  check(d1.stageKey === "submitted" && d1.open === true && d1.route === "EXP-FA" && d1.test === "fa_aas" && d1.tags.join() === "T-500" && d1.qc && /50-position/.test(d1.qc), "stored open, with route EXP-FA, tag list and a copy of the route's QC rule");
  const combos = [["gc_bh", "gc", "GC-FA"], ["plant_feed", "plant", "PLT-HEAD"], ["plant_tails", "plant", "PLT-TAIL"], ["cil_slurry", "plant", "CIL-SVY"], ["carbon", "plant", "CARBON"], ["solution", "plant", "SOLN"], ["conc", "bullion", "CONC"], ["bullion", "bullion", "BULLION"], ["tsf", "env", "TSF-CHAR"], ["env_water", "env", "ENV-W"], ["env_soil", "env", "ENV-S"], ["met_comp", "met", "BRT"], ["rc", "gc", "GC-FA"], ["ccd", "plant", "CCD-SVY"], ["elution", "plant", "ELUATE"]];
  await P.click("#rAgain");
  const got = [];
  for (const [ty, pu, want] of combos){ await P.selectOption("#rType", ty); await P.selectOption("#rPurpose", pu); const t = await P.textContent("#rRoute .code"); got.push(`${ty}/${pu}→${t}`); if (t !== want) check(false, `${ty} + ${pu} expected ${want}, got ${t}`); }
  check(true, "auto routes: " + got.join(", "));
  await P.selectOption("#rType", "plant_feed"); await P.selectOption("#rPurpose", "plant");
  check(/7\.25 h/.test(await P.textContent("#rRoute")) && /within the next shift/.test(await P.textContent("#rRoute")), "Mill sample fast track promises the next shift and totals 7.25 h");
  const nOpt = await P.$$eval("#rTest option", os => new Set(os.filter(o => o.value).map(o => o.value)).size);
  check(nOpt === 41, "all 41 tests selectable from the form (" + nOpt + ")");
  await P.evaluate(() => { delete document.querySelector("#rTest").dataset.touched; });

  log("Validation: dates, tags, batches");
  await fillForm(P, "submit", { section: "EXP", submitter: "Esi", collected: localStr(Date.now() + 3 * 3600e3) });
  await P.waitForTimeout(300);
  check(/can't be in the future/.test(await toastText(P)) && !(await P.$("#rResult code")), "collection time in the future is refused");
  await fillForm(P, "submit", { section: "EXP", submitter: "Esi", tags: "t-500" });
  await P.waitForTimeout(500);
  { const tt = await toastText(P); check(/already on open sample/.test(tt) && !(await P.$("#rResult code")), "a tag already on an open sample is refused (case-insensitive) [" + tt + "] msg=" + await P.textContent("#rMsg")); }
  await fillForm(P, "submit", { section: "EXP", submitter: "Esi", count: 3, tags: "T-010421" });
  const batch = await ids(P);
  check(batch.map(i => doc(i).tags[0]).join() === "T-010421,T-010422,T-010423", "a batch counts the tag up, keeping zero padding: " + batch.map(i => doc(i).tags[0]).join(", "));
  await P.waitForTimeout(300);
  check(store["tagidx/T-010422"]?.sid === batch[1], "tag index points at the right sample");

  log("Lookup by tag, link and site reference");
  const G = await newUser(browser, { uid: "u_g", name: "Guest", canEdit: true, names, hash: "T-010422" });
  await G.waitForSelector(".sid", { timeout: 5000 });
  check(await G.textContent(".sid") === batch[1], "tracking link with a tag number opens the sample from the register itself");
  await open(G, "t-500");
  check(await G.textContent(".sid") === s1, "typing a tag in lower case finds it; it is not turned into an ID");
  await open(G, `https://claude.ai/artifact/x#${batch[2].toLowerCase()}`);
  check(await G.textContent(".sid") === batch[2], "a scanned tracking link (full URL) opens the sample");

  log("Receipt: checks, test and route, times");
  const A = await newUser(browser, { uid: "u_a", name: "Tech", canEdit: true, names });
  await signIn(A, "tech1");
  check(JSON.stringify(await visibleTabs(A)) === JSON.stringify(["board", "track", "submit", "batches", "storage", "ledger", "routes"]), "technician tabs (v17: Register is folded into Submit when signed in)");
  await open(A, s1);
  const rcRoutes = await A.$$eval("#rcRoute option", os => os.map(o => o.value));
  check(rcRoutes.length && rcRoutes.every(c => ["EXP-FA", "GC-FA", "PLT-HEAD"].includes(c)) && rcRoutes[0] === "EXP-FA", "receipt offers only routes that perform fire assay, the exploration route first: " + rcRoutes.join(","));
  await A.fill("#rcAt", localStr(d1.createdAt - 2 * DAY)); await A.click('[data-receipt="confirm"]'); await A.waitForTimeout(400);
  check(/before the submission/.test(await toastText(A)) && doc(s1).stageKey === "submitted", "receipt dated before the submission is refused");
  await A.fill("#rcAt", localStr(Date.now()));
  await A.selectOption("#rcTest", "sfa"); await A.waitForTimeout(100);
  check(await A.$eval("#rcRoute", e => e.value) === "SFA" && /Test changes/.test(await A.textContent("#rcInfo")), "changing the test lists its routes and says the test changes");
  await A.click('[data-receipt="confirm"]'); await A.waitForTimeout(400);
  check(/reason for changing the test/.test(await toastText(A)) && doc(s1).stageKey === "submitted", "a test change needs a reason");
  await A.fill("#rcMass", "3.2"); await A.fill("#mvNote", "Visible gold noted on the bag label"); await A.click('[data-receipt="confirm"]'); await A.waitForTimeout(1200);
  const r1 = doc(s1);
  check(r1.stageKey === "received" && r1.test === "sfa" && r1.route === "SFA" && r1.history.at(-1).testFrom === "fa_aas" && r1.recv.mass === 3.2 && r1.recvAt >= r1.createdAt, "received with the test change logged and the mass received recorded" + (process.env.DBG ? JSON.stringify({ st: r1.stageKey, t: r1.test, r: r1.route, h: r1.history.at(-1), recv: r1.recv, ra: r1.recvAt, ca: r1.createdAt }) : ""));
  check(moves(s1).filter(m => m.dir === "in").length === 1 && /3.2 kg/.test(moves(s1)[0].qty) && !doc(s1).lp, "one IN movement, with the received mass, flushed from the sample");

  log("Typed input survives other people's saves");
  await A.fill("#mvNote", "moving on"); await A.fill("#mvLoc", "Tray rack 4");
  await fillForm(P, "submit", { section: "GEO", submitter: "Other user" }); await ids(P); await A.waitForTimeout(500);
  check(await A.$eval("#mvNote", e => e.value) === "moving on" && await A.$eval("#mvLoc", e => e.value) === "Tray rack 4", "note and location kept after another user submits");
  await A.click('[data-step="next"]'); await A.waitForTimeout(1100);
  check(doc(s1).stageKey === "sort" && doc(s1).history.at(-1).note === "moving on" && doc(s1).location === "Tray rack 4", "next step recorded with the note and the location (no keyword needed)");
  const other = (await ids(P))[0];
  await open(A, other);
  await A.fill("#rcAt", localStr(Date.now() - 3600e3 + 60000 < doc(other).createdAt ? Date.now() : Date.now() - 60000));
  const typedAt = await A.$eval("#rcAt", e => e.value);
  await A.focus("#mvNote");
  await fillForm(P, "submit", { section: "GEO", submitter: "Third" }); await ids(P); await A.waitForTimeout(500);
  check(await A.$eval("#rcAt", e => e.value) === typedAt, "a backdated receipt time stays as typed after another user's save");

  log("Stage order is enforced");
  await open(A, s1);
  const opts = await A.$$eval("#mvKey option", os => os.map(o => [o.value, o.disabled]));
  check(opts.length && opts.filter(o => !o[1]).every(o => o[0] === "received") && !opts.some(o => ["qc", "released", "storage", "rejected", "disposed"].includes(o[0])), "technician can only correct back; skipping is supervisor-only; QA/QC, release and closing states are not offered" + (process.env.DBG ? JSON.stringify(opts) : ""));
  const S = await newUser(browser, { uid: "u_s", name: "Super", canEdit: true, names });
  await signIn(S, "super");
  await open(S, s1);
  const sOpts = await S.$$eval("#mvKey option", os => os.filter(o => !o.disabled).map(o => o.value));
  check(sOpts.includes("pulv") && !sOpts.includes("qc") && !sOpts.includes("released"), "supervisor may skip ahead, but never past QA/QC" + (process.env.DBG ? JSON.stringify(sOpts) : ""));
  await S.click("#corrBox summary"); await S.selectOption("#mvKey", "pulv");
  await fillForm(P, "submit", { section: "GEO", submitter: "Fourth" }); await ids(P); await S.waitForTimeout(500);
  check(await S.$eval("#mvKey", e => e.value) === "pulv" && await S.$eval("#corrBox", d => d.open), "chosen stage and open section survive another user's save");
  await S.click("#corrBtn"); await S.waitForTimeout(300);
  check(/reason/.test(await toastText(S)) && doc(s1).stageKey === "sort", "a skip needs a reason");
  await S.fill("#corrWhy", "Pre-crushed in the field"); await S.click("#corrBtn"); await S.waitForTimeout(1100);
  check(doc(s1).stageKey === "pulv" && doc(s1).history.at(-1).skipped.length >= 2, "skip recorded with the skipped steps");
  check((await S.$$eval(".rail li.skipped", ls => ls.length)) >= 2 && !(await S.$$eval(".rail li.done .st-name", ls => ls.map(l => l.textContent))).some(t => /Drying/.test(t)), "skipped steps show as skipped, not ticked");
  const sNext = async (page, n) => { for (let i = 0; i < n; i++){ await page.click('[data-step="next"]'); await page.waitForTimeout(450); } };
  await open(A, s1);
  await A.click("#corrBox summary"); await A.selectOption("#mvKey", "received"); await A.fill("#corrWhy", "Recorded on the wrong sample"); await A.click("#corrBtn"); await A.waitForTimeout(1100);
  check(doc(s1).stageKey === "received" && doc(s1).history.at(-1).corr && moves(s1).filter(m => m.dir === "in").length === 1, "a correction back to Received adds no ledger movement" + (process.env.DBG ? JSON.stringify({ st: doc(s1).stageKey, h: doc(s1).history.at(-1), m: moves(s1), toast: "" }) : ""));
  await A.fill("#mvNote", "Bag re-weighed"); await A.click('[data-step="note"]'); await A.waitForTimeout(600);
  check(moves(s1).length === 1, "a note at Received adds no ledger movement");
  const plan1 = doc(s1).plan, qcI = plan1.findIndex(x => x.key === "qc");
  await sNext(A, qcI - 2);
  { const h = (await A.textContent("#holdNote")).replace(/\s+/g, " ");   // v21: lab batches optional by default, so it asks for the results only
    check(await A.$eval('[data-step="next"]', b => b.disabled) && /results/i.test(h) && !/lab batch/i.test(h), "QA/QC review is held until the sample has results (no lab batch needed): " + h); }
  const fb1 = await H.runBatch(A, "sfa", [s1], () => "3.41");
  check(doc(s1).labBatch === fb1 && doc(s1).labQc === "pass" && doc(s1).results.rows.Au_f.v === 3.41 && !doc(s1).results.rows.Au, "screen fire assay batch passes QC and writes the fine-fraction gold to the sample (the total waits for the other fractions)");
  await open(A, s1);
  check(await A.$eval('[data-step="next"]', b => b.disabled) && /Missing: Gold in \+75/.test(await A.textContent("#holdNote")), "still held until the fraction results are typed");
  if (!(await A.$eval("#resBox", d => d.open))) await A.click("#resBox summary");
  check(!(await A.$("#rs_Au_f")) && !(await A.$("input#rs_Au")) && /worked out from/.test(await A.textContent("#rs_Au")), "the batch result is not typed again, and the total is shown as calculated");
  for (const [k, v] of [["Au_c", "12.5"], ["Au_f2", "3.35"], ["m_c", "4.1"], ["loss", "0.8"]]) await A.fill("#rs_" + k, v);
  await A.click("#rsSave"); await A.waitForTimeout(1100);
  const sfaRows = doc(s1).results.rows;
  check(sfaRows.Au_c.v === 12.5 && sfaRows.Au_f.v === 3.41 && sfaRows.Au.calc && Math.abs(sfaRows.Au.v - 3.7539) < 0.0005, "fraction results saved without touching the batch result; the total is calculated from them: " + sfaRows.Au?.v);
  await sNext(A, 1);
  check(doc(s1).stageKey === "qc", "technician walks the route to QA/QC");
  check(!(await A.$('[data-step="next"]')) && /supervisor releases/.test(await A.textContent("#actBox")), "technician cannot release results");
  const etaBefore = await A.textContent(".eta .val");
  await A.click("#redoBox summary"); await A.selectOption("#redoWhy", { index: 0 }); await A.fill("#mvNote", "Fine fraction duplicates 14% apart"); await A.click("#redoBtn"); await A.waitForTimeout(1100);
  check(doc(s1).stageKey === "fuse" && doc(s1).reassays === 1 && doc(s1).history.at(-1).redo, "re-assay sends it back to fusion");
  check((await A.textContent(".eta .val")) !== etaBefore && /re-assayed ×1/.test(await A.textContent(".rail")), "ETA recalculated and rail marks the re-assay");
  await A.click("#rrBox summary");
  const rrList = await A.$$eval("#rrCode option", os => os.map(o => o.value));
  check(rrList.join() === "SFA", "change-route lists only routes for the current test: " + rrList.join());
  await A.selectOption("#rrTest", "fa_grav"); await A.waitForTimeout(100);
  await A.click("#rerouteBtn"); await A.waitForTimeout(300);
  check(/reason/.test(await toastText(A)) && doc(s1).route === "SFA", "changing the test mid-route needs a reason");
  await A.fill("#mvNote", "Over-range: high-grade repeat"); await A.click("#rerouteBtn"); await A.waitForTimeout(1100);
  check(doc(s1).route === "FA-GRAV" && doc(s1).test === "fa_grav" && doc(s1).stageKey === "fuse" && doc(s1).history.at(-1).testTo === "fa_grav", "route and test changed together and logged; sample stays at fusion");
  await open(S, s1);
  const qcJ = doc(s1).plan.findIndex(x => x.key === "qc"), fuseJ = doc(s1).plan.findIndex(x => x.key === "fuse");
  check(!doc(s1).results && !doc(s1).labBatch && doc(s1).resHist.length >= 1, "the re-assay moved the earlier results to the history and took the sample out of its finished batch");
  await sNext(S, qcJ - fuseJ - 1);
  const gb1 = await H.runBatch(A, "grav", [s1], () => "15.6");
  check(doc(s1).labBatch === gb1 && doc(s1).labQc === "pass", "gravimetric batch for the new route");
  await open(S, s1);
  await sNext(S, 1); await H.waitFor(() => doc(s1).stageKey === "qc", 3000);
  check(doc(s1).stageKey === "qc", "back at QA/QC");
  await S.click('[data-step="next"]'); await S.waitForTimeout(1100);
  const rel = doc(s1);
  check(rel.stageKey === "released" && rel.relAt && rel.materials.length === 2 && Math.abs(rel.materials[0].dueAt - (rel.relAt + 365 * DAY)) < 2000 && rel.relDay, "supervisor releases; each retained material gets its own clock from release");
  check(rel.certs?.length === 1 && rel.certs[0].no === s1 + "-R1" && rel.certs[0].rows.Au.v === 15.6 && rel.certs[0].batch === gb1, "release issues certificate R1 with the batch result");
  await A.screenshot({ path: OUT + "/record-route.png", fullPage: true });

  log("Retained material, ledger movements and reversals");
  await open(A, s1);
  await A.selectOption("#mx_m1", "store"); await A.fill("#mr_m1", "B3"); await A.click('[data-mat="m1"]'); await A.waitForTimeout(1100);
  check(doc(s1).stageKey === "released" && doc(s1).lab === true && doc(s1).materials[0].loc === "B3" && /Pulp: B3/.test(doc(s1).location) && /still to put away/.test(await toastText(A)), "pulp put away at B3; the sample stays on the board while the coarse reject has no place" + (process.env.DBG ? JSON.stringify({ st: doc(s1).stageKey, m: doc(s1).materials, loc: doc(s1).location }) : ""));
  await A.selectOption("#mx_m2", "disposed"); await A.click('[data-mat="m2"]'); await A.waitForTimeout(1100);
  check(doc(s1).materials[1].status === "disposed" && doc(s1).open === true && moves(s1).filter(m => m.dir === "out").length === 1, "coarse reject disposed on its own: one OUT movement, sample still open for the pulp");
  check(doc(s1).stageKey === "storage" && doc(s1).lab === false && store["stock/" + s1]?.st === "store" && store["stock/" + s1].m.length === 1 && store["stock/" + s1].m[0].loc === "B3" && !doc(s1).sx,
    "with every kept material shelved the sample moves into storage, off the board, and its stock record lists the pulp at B3");
  await open(S, s1);
  await S.click("#mu_box_m2 summary"); await S.click('[data-undo="m2"]'); await S.waitForTimeout(300);
  check(/reason/.test(await toastText(S)), "a reversal needs a reason");
  await S.fill("#mu_m2", "Wrong bag disposed in the system; reject still on the shelf"); await S.click('[data-undo="m2"]'); await S.waitForTimeout(1100);
  check(doc(s1).materials[1].status === "kept" && moves(s1).filter(m => m.dir === "rev").length === 1, "reversal writes a visible REV movement; nothing is deleted");
  await open(A, s1);
  await A.selectOption("#mx_m2", "disposed"); await A.click('[data-mat="m2"]'); await A.waitForTimeout(1100);
  await A.selectOption("#mx_m1", "returned"); await A.fill("#mr_m1", "Geology store, slip 118"); await A.click('[data-mat="m1"]'); await A.waitForTimeout(1200);
  const fin = doc(s1);
  check(fin.open === false && fin.stageKey === "closed" && fin.closedAt, "sample closes when the last material leaves (mixed: closed)");
  const ms1 = moves(s1), rev1 = new Set(ms1.filter(m => m.dir === "rev").map(m => m.rev));
  check(ms1.filter(m => m.dir === "in").length === 1 && ms1.filter(m => m.dir === "out" && !rev1.has(m.mid)).length === 2 && ms1.filter(m => m.dir === "out" && rev1.has(m.mid)).length === 1, "ledger for the sample: 1 IN, 2 live OUT (one per material), 1 reversed OUT");

  log("Reject and cancel at receipt");
  await fillForm(P, "submit", { section: "EXP", submitter: "Esi" }); const rj = (await ids(P))[0];
  await open(A, rj); await A.fill("#mvNote", "Bag torn, sample spilt"); await A.click("#rejBox summary"); await A.selectOption("#rcDisp", "returned"); await A.click('[data-receipt="reject"]'); await A.waitForTimeout(1200);
  check(doc(rj).stageKey === "rejected" && doc(rj).open === false && moves(rj).map(m => m.dir).sort().join() === "in,out", "rejected after a physical check: IN then OUT (returned)");
  await fillForm(P, "submit", { section: "EXP", submitter: "Esi" }); const cx = (await ids(P))[0];
  await open(A, cx); await A.fill("#mvNote", "Submitted twice by mistake"); await A.click("#rejBox summary"); await A.selectOption("#rcDisp", "cancel"); await A.click('[data-receipt="reject"]'); await A.waitForTimeout(1300);
  check(doc(cx).stageKey === "cancelled" && moves(cx).length === 0, "cancelled submission (nothing arrived) writes no ledger movement");

  log("Stop testing after receipt");
  await fillForm(P, "submit", { section: "EXP", submitter: "Esi" }); const st = (await ids(P))[0];
  await open(A, st); await A.click('[data-receipt="confirm"]'); await A.waitForTimeout(1100);
  check(!(await A.$$eval("#mvKey option", os => os.map(o => o.value))).includes("rejected"), "Rejected is not offered once the sample is received");
  await A.click("#cxBox summary"); await A.selectOption("#cxDisp", "disposed"); await A.fill("#cxWhy", "Submitter withdrew the request"); await A.click("#cxBtn"); await A.waitForTimeout(1100);
  check(doc(st).stageKey === "disposed" && doc(st).open === false && moves(st).map(m => m.dir).sort().join() === "in,out", "testing stopped: closed with an OUT movement");

  log("Two-person custody, holding time and cooler checks");
  await fillForm(P, "submit", { section: "GR", type: "bullion", purpose: "bullion", submitter: "Gold room", details: { bar: "D-0917", gross: "12034.5" } }); const bb = (await ids(P))[0];
  await open(A, bb); await A.click('[data-receipt="confirm"]'); await A.waitForTimeout(400);
  check(/witness/.test(await toastText(A)) && doc(bb).stageKey === "submitted", "bullion receipt needs a witness");
  check(/\(g\)/.test(await A.textContent('label:has(#rcMass)')), "bullion mass is recorded in grams");
  await A.selectOption("#rcWit", { label: "Lab Supervisor" }); await A.click('[data-receipt="confirm"]'); await A.waitForTimeout(1100);
  check(doc(bb).stageKey === "received" && doc(bb).recv.wit === "Lab Supervisor" && moves(bb)[0].wit === "Lab Supervisor", "witness stored on the record and the ledger");
  await fillForm(P, "submit", { section: "ENV", type: "env_water", purpose: "env", submitter: "Env officer", collected: localStr(Date.now() - 20 * DAY) }); const ew = (await ids(P))[0];
  await open(A, ew);
  await A.click('[data-receipt="confirm"]'); await A.waitForTimeout(300);
  check(/cooler temperature/.test(await toastText(A)), "environmental water needs the cooler temperature");
  await A.fill("#rcTemp", "9"); await A.waitForTimeout(100);
  const warn = await A.textContent("#rcInfo");
  check(/holding time for cyanide/.test(warn) && /above the 6 °C limit/.test(warn), "holding time and cooler limit are checked and shown");
  await A.click('[data-receipt="confirm"]'); await A.waitForTimeout(300);
  check(/receipt check failed/.test(await toastText(A)) && doc(ew).stageKey === "submitted", "a failed check needs a note before confirming");
  await A.fill("#mvNote", "Client told; results flagged"); await A.click('[data-receipt="confirm"]'); await A.waitForTimeout(1100);
  check(doc(ew).recv.warn.length === 2 && /holding time/.test(doc(ew).history.at(-1).note), "warnings stored with the receipt");

  log("Register at lab");
  await H.tab(A, "register"); if (await A.$("#rAgain")) await A.click("#rAgain");
  await A.selectOption("#rType", "plant_feed"); await A.selectOption("#rPurpose", "plant");
  const labRoutes = await A.$$eval("#rRouteSel option", os => os.map(o => o.value).filter(Boolean));
  check(/Automatic: PLT-HEAD/.test(await A.textContent("#rRouteSel")) && labRoutes.join() === "PLT-HEAD", "lab route list only has routes for the chosen test");
  await fillForm(A, "register", { section: "PLT", type: "plant_feed", purpose: "plant", test: "psd", submitter: "Shift met", collected: localStr(Date.now() - 3600e3), recvAt: localStr(Date.now() - 4 * 3600e3) });
  await A.waitForTimeout(300);
  check(/before the collection/.test(await toastText(A)), "received before collected is refused");
  await A.fill("#rRecvAt", localStr(Date.now())); await A.click("#rSubmit");
  const w = (await ids(A))[0];
  await A.waitForTimeout(600);
  check(w === `PLT-${T}-0001` && doc(w).stageKey === "received" && doc(w).route === "PSD" && moves(w).filter(m => m.dir === "in").length === 1, "walk-in registered on PSD and written to the inbound ledger");

  log("IDs: simultaneous submissions and site time");
  const P2 = await newUser(browser, { uid: "u_p2", name: "P2", canEdit: true, names });
  const t0 = Date.now();
  await Promise.all([fillForm(P, "submit", { section: "PLT", type: "plant_feed", purpose: "plant", submitter: "A" }), fillForm(P2, "submit", { section: "PLT", type: "plant_feed", purpose: "plant", submitter: "B" })]);
  const [c1, c2] = [(await ids(P))[0], (await ids(P2))[0]], took = Date.now() - t0;
  check(c1 !== c2 && took < 4000, `two people submitting to PLT at once got ${c1} and ${c2} in ${took} ms`);
  const K = await newUser(browser, { uid: "u_k", name: "Kiribati", canEdit: true, names }, undefined, "light", { timezoneId: "Pacific/Kiritimati" });
  await fillForm(K, "submit", { section: "OTH", type: "other", purpose: "other", why: "Time zone check", submitter: "Far away" });
  const kId = (await ids(K))[0];
  check(kId === `OTH-${T}-0001`, `a device on UTC+14 still gets the site date in the ID: ${kId}`);

  log("Board: every sample in the lab, retention flags; Storage tab");
  await A.click('[data-tab="board"]'); await A.waitForTimeout(300);
  const statsTxt = await A.textContent(".stats");
  check(/Materials past retention/.test(statsTxt) && /1\s*Materials past retention/.test(statsTxt.replace(/\s+/g, " ")), "legacy coarse reject past its own retention is flagged");
  check(!(await A.textContent(".lanes")).includes(s1) && !(await A.textContent(".lanes")).includes("EXP-20261001-0001") && !(await A.textContent(".lanes")).includes("In storage"), "closed and stored samples are not on the board (no storage lane)");
  check(await A.evaluate(() => document.querySelectorAll("#view-board p.small.muted").length) === 0, "no explanatory paragraph under the lanes");
  await A.click('[data-tab="storage"]'); await A.waitForTimeout(400);
  const stTxt = (await A.textContent("#view-storage")).replace(/\s+/g, " ");
  check(stTxt.includes("EXP-20261001-0001") && /Coarse reject.*Past retention/.test(stTxt) && /\b1 ?Samples in storage/.test(stTxt) && /\b2 ?Materials kept/.test(stTxt) && /\b1 ?Past retention/.test(stTxt), "Storage lists the stored sample's materials, oldest due first, with the coarse reject past retention: " + stTxt.slice(0, 160));
  await A.selectOption("#stShow", "past"); await A.waitForTimeout(150);
  check((await A.$$eval("#view-storage tbody tr", r => r.length)) === 1 && /Coarse reject/.test(await A.textContent("#view-storage tbody")), "Storage filter: past retention only");
  await A.selectOption("#stShow", "all"); await A.fill("#stQ", "shelf a1"); await A.waitForTimeout(400);
  check((await A.$$eval("#view-storage tbody tr", r => r.length)) === 2 && await A.evaluate(() => document.activeElement?.id) === "stQ", "Storage search by location keeps focus");
  await A.fill("#stQ", ""); await A.click("#stCsv"); await A.waitForTimeout(300);
  const stCsv = await A.evaluate(() => window.__downloaded || {});
  check(/^storage-\d{4}-\d{2}-\d{2}\.csv$/.test(stCsv.filename || "") && /Keep until/.test(stCsv.data) && stCsv.data.split("\n").length === 3, "Storage CSV export: " + (stCsv.filename || ""));
  await A.screenshot({ path: OUT + "/storage.png", fullPage: true });
  await A.click('[data-tab="board"]'); await A.waitForTimeout(300);
  check((await A.$$eval(".chip .haz", hs => hs.map(h => h.textContent))).includes("2P"), "two-person samples are marked on the board");
  store["samples/" + bb] = { ...doc(bb), stageKey: "released", stageAt: Date.now() - 30 * 3600e3, relAt: Date.now() - 30 * 3600e3, materials: [{ k: "m1", item: "Doré bar", days: 0, then: "Returned", dispo: "returned", status: "kept", dueAt: Date.now() - 30 * 3600e3, loc: "", outs: 0 }] };
  await broadcast("samples/" + bb, store["samples/" + bb]); await A.waitForTimeout(400);
  check(/1\s*Released, not yet put in storage/.test((await A.textContent(".stats")).replace(/\s+/g, " ")), "released but not put away for more than 24 h is flagged");
  await A.screenshot({ path: OUT + "/board-phases.png", fullPage: true });

  log("Ledger and month check");
  await A.click('[data-tab="ledger"]'); await A.waitForTimeout(600);
  const lg = await A.textContent("#view-ledger");
  check(lg.includes(s1) && lg.includes("REV") && /Reversed/.test(lg) && lg.includes(rj) && !lg.includes(cx), "ledger shows movements, the reversal and the rejected sample; not the cancelled one");
  check(/matches the \d+ on hand now/.test(lg), "month check balances: " + ((lg.match(/Month check:[^.]*\./) || [""])[0]));
  await A.fill("#lgQ", "EXP-");
  await fillForm(P, "submit", { section: "GEO", submitter: "Fifth" }); await ids(P); await A.waitForTimeout(500);
  check(await A.evaluate(() => document.activeElement?.id) === "lgQ" && await A.$eval("#lgQ", e => e.value) === "EXP-", "ledger search keeps focus while data changes");
  await A.fill("#lgQ", "");
  await A.click("#lgCsv"); await A.waitForTimeout(300);
  const csv = await A.evaluate(() => window.__downloaded?.data || "");
  check(/Movement ID/.test(csv) && csv.split("\n").length > 5, "CSV export of the month");
  await A.screenshot({ path: OUT + "/ledger.png", fullPage: true });

  log("Routes tab for everyone");
  await open(P, w);
  await P.click("[data-route]"); await P.waitForTimeout(250);
  check(await P.$eval("#view-routes", e => !e.hidden) && await P.$eval("#route-PSD", d => d.open), "public 'See route' opens the routes tab at that route");
  check((await P.$$("details.route")).length === 42, "42 routes listed");
  const chips = await P.$$eval(".tchip", bs => bs.map(b => b.textContent));
  check(chips.length === 41, "catalogue shows all 41 tests");
  await P.selectOption("#rtType", "bullion"); await P.waitForTimeout(100);
  check((await P.$$eval("details.route", ds => ds.map(d => d.dataset.code))).join() === "BULLION" && /Two-person custody/.test(await P.textContent("#route-BULLION")), "bullion route marked two-person");
  await P.selectOption("#rtType", "");

  log("Viewer and forged session");
  const B = await newUser(browser, { uid: "u_b", name: "Viewer", canEdit: true, names });
  await signIn(B, "viewer");
  check(JSON.stringify(await visibleTabs(B)) === JSON.stringify(["board", "track", "submit", "results", "batches", "storage", "ledger", "routes"]), "viewer tabs (v24: Results for staff)");
  await open(B, "EXP-20261001-0001");
  check(!(await B.$("#moveForm")) && !(await B.$("[data-mat]")) && /Retained material/.test(await B.textContent("#view-track")), "viewer sees retained material but has no controls");
  const F = await newUser(browser, { uid: "u_f", name: "Forger", canEdit: true, names, session: "admin" });
  check(!(await visibleTabs(F)).includes("stages") && !(await visibleTabs(F)).includes("board"), "setting the browser value 'admin' no longer signs anyone in");

  log("Admin settings");
  const C = await newUser(browser, { uid: "u_c", name: "Admin", canEdit: true, names });
  await signIn(C, "admin");
  await C.click('[data-tab="stages"]'); await C.waitForTimeout(200); await H.cfgTab(C, "routes");
  await C.click('[data-rf="desc"]'); await C.keyboard.type(" half typed");
  await fillForm(P, "submit", { section: "GEO", submitter: "Sixth" }); await ids(P); await C.waitForTimeout(500);
  check(await C.evaluate(() => document.activeElement?.dataset.rf) === "desc" && /half typed/.test(await C.$eval('[data-rf="desc"]', e => e.value)), "admin keeps typing while others submit");
  await C.selectOption("#rtPick", { label: "EXP-FA · Exploration fire assay (50 g, AAS finish)" });
  check(await C.$eval('[data-rf="code"]', e => e.disabled), "route code locked while open samples use it");
  await C.selectOption("#rtPick", { label: "GC-FA · Grade control fast track (30 g fire assay)" });
  await C.fill('[data-ri="1"][data-rk="hours"]', "5"); await C.press('[data-ri="1"][data-rk="hours"]', "Tab"); await C.waitForTimeout(100);
  await H.cfgTab(C, "sections");
  await C.fill("#cfgTz", "Mars/Olympus"); await C.press("#cfgTz", "Tab"); await C.waitForTimeout(150);
  check(/not a time zone/.test(await toastText(C)), "a bad time zone name is refused");
  await C.click("#cfgSave"); await C.waitForTimeout(500);
  const saved = store["settings/stages"];
  check(saved && saved.schema === 12 && saved.crms?.length === 49 && saved.limits?.length === 50 && saved.resultsPublic === false && saved.tz === "Africa/Accra" && saved.routes.length === 2 && saved.routes.some(r => r.code === "GC-FA" && r.stages[1].hours === 5), "only edited routes are saved (" + (saved?.routes || []).map(r => r.code).join(",") + "); the rest follow the library");   // v23: 50 limits (10 plant limits added)
  await fillForm(P, "submit", { section: "GC", type: "gc_bh", purpose: "gc", submitter: "GC geologist" });
  const gcs = (await ids(P))[0];
  check(doc(gcs).plan.find(x => x.key === "dry").hours === 5, "new submissions use the edited route" + (process.env.DBG ? JSON.stringify({ r: doc(gcs).route, p: doc(gcs).plan.map(x => x.key + ":" + x.hours).join(" "), d: (await P.$$("details.route")).length }) : ""));
  await C.screenshot({ path: OUT + "/settings-admin.png", fullPage: true });

  log("Phone");
  const M = await newUser(browser, { uid: "u_m", name: "Phone", canEdit: true, names }, { width: 375, height: 760 }, "dark");
  await signIn(M, "admin");
  check(await M.evaluate(() => { const n = document.querySelector("#tabs"), r = n.getBoundingClientRect(); return getComputedStyle(n).position === "fixed" && Math.abs(r.bottom - innerHeight) < 2 && !document.querySelector("#tabMoreWrap").hidden && n.querySelectorAll(":scope > button[data-tab]:not([hidden])").length === 4; }), "phone: four tabs in a bottom bar, the rest under More");
  for (const t of ["board", "submit", "register", "ledger", "routes", "stages"]){ await H.tab(M, t); await M.waitForTimeout(250); if (!(await noScroll(M))) check(false, "horizontal scroll on phone: " + t); }
  await open(M, "EXP-20261001-0001");
  check(await noScroll(M), "no horizontal scroll on phone on any tab or the record");
  await M.screenshot({ path: OUT + "/record-phone-dark.png", fullPage: true });

  console.log("\nConsole errors:", errors.length ? errors : "none");
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
