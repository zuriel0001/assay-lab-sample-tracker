// v11: assay results and certificates of analysis. v35: lab batches are gone; results are typed or attached on each sample's record,
// or attached from the Results tab. Several users on one shared in-memory store (see harness.js).
const H = require("./harness");
const { store, errors, newUser, launch, signIn, fillForm, ids, open, doc, toastText, waitFor, visibleTabs } = H;
const OUT = __dirname;
const names = { u_z: "Zuriel" };
const log = (...a) => console.log("•", ...a);
const check = (cond, msg) => { console.log(cond ? "  PASS" : "  FAIL", msg); if (!cond) process.exitCode = 1; };
const DBG = (o) => process.env.DBG ? " " + JSON.stringify(o) : "";

async function receipt(page, id){ await open(page, id); await page.click('[data-receipt="confirm"]'); await waitFor(() => doc(id).stageKey === "received"); await page.waitForTimeout(400); }
const next = async (page, n = 1) => { for (let i = 0; i < n; i++){ const id = (await page.textContent(".sid")).trim(), k = doc(id).stageKey; await page.click('[data-step="next"]'); await waitFor(() => doc(id).stageKey !== k, 4000); await page.waitForTimeout(350); } };
const rec = open;
/* Walks one sample on its record until it reaches the step. */
async function walkTo(page, id, key){
  await open(page, id);
  for (let g = 0; g < 16 && doc(id).stageKey !== key; g++){ const k = doc(id).stageKey; await page.click('[data-step="next"]'); await waitFor(() => doc(id).stageKey !== k, 4000); await page.waitForTimeout(300); }
  return doc(id).stageKey === key;
}
/* Types results on the sample's record and saves them. */
async function typeRes(page, id, vals, inst){
  await open(page, id);
  if (!(await page.$eval("#resBox", d => d.open))) await page.click("#resBox summary");
  for (const [k, v] of Object.entries(vals)) await page.fill("#rs_" + k, v);
  if (inst) await page.fill("#rsInst", inst);
  const v0 = doc(id).results?.v || 0;
  await page.click("#rsSave"); await waitFor(() => (doc(id).results?.v || 0) > v0, 4000); await page.waitForTimeout(300);
}

(async () => {
  const browser = await launch();
  require("./harness").useOldRoutes();   // v23: this suite is written around the routes in use before version 23
  await H.useQcStep(browser);   // v22: this suite is written around the QA/QC review step, which Settings now turn on
  const P = await newUser(browser, { uid: "u_p", name: "Public", canEdit: true, names });
  const Tc = await newUser(browser, { uid: "u_t", name: "Tech", canEdit: true, names }); await signIn(Tc, "tech1");
  const Sv = await newUser(browser, { uid: "u_s", name: "Super", canEdit: true, names }); await signIn(Sv, "super");
  const Ad = await newUser(browser, { uid: "u_a", name: "Admin", canEdit: true, names }); await signIn(Ad, "admin");
  await P.waitForTimeout(1800);

  log("Results need the samples at analysis; a results file from the Results tab");
  await fillForm(P, "submit", { section: "EXP", submitter: "Esi", count: 3 }); const ex = await ids(P);
  for (const id of ex) await receipt(Tc, id);
  check(ex.every(id => doc(id).route === "EXP-FA" && !doc(id).labBatch && !doc(id).labs), "fire assay samples go on their route; no lab batch is made");
  await rec(Tc, ex[0]);
  check(!(await Tc.$("#rsSave")), "results can't be typed while the sample is still in preparation");
  for (const id of ex) await walkTo(Tc, id, "weigh");
  check(ex.every(id => doc(id).stageKey === "weigh"), "each sample walks to weighing on its own record");
  await H.tab(Tc, "results"); await Tc.waitForSelector('#view-results [data-attach="all"]');
  const up = await H.attachFile(Tc, "all", "aas-run.csv", `Sample ID,Au (g/t)\nBLANK,<0.005\n${ex[1]},2.50\nSTD-AU-LOW,9.99\nnot a line,1.0\n`);
  check(/Results on 1 sample record/.test(up) && /Lab QC rows \(repeats, blanks, standards\): 2/.test(up) && /Not in the lab[^:]*: not a line/.test(up), "a file attached on the Results tab fills the sample it names; the lab's blank and standard rows are counted, not used: " + up.slice(0, 200));
  await H.saveAttach(Tc);
  check(doc(ex[1]).results?.rows.Au.v === 2.5 && doc(ex[1]).results.rows.Au.src === "file" && doc(ex[1]).results.file?.name === "aas-run.csv", "the result is saved on the sample, marked as from the file");
  await rec(Tc, ex[0]); await Tc.click("#resBox summary"); await Tc.fill("#rs_Au", "abc"); await Tc.click("#rsSave"); await Tc.waitForTimeout(300);
  check(/not a number/.test(await toastText(Tc)) && !doc(ex[0]).results, "a value that is not a number is refused");
  await typeRes(Tc, ex[0], { Au: "1.20" }, "AAS run 14-10-01"); await typeRes(Tc, ex[2], { Au: "0.80" }, "AAS run 14-10-01");
  check(doc(ex[0]).results.rows.Au.v === 1.2 && !doc(ex[0]).results.rows.Au.src && doc(ex[0]).results.inst === "AAS run 14-10-01", "typed results are saved with the instrument file");

  log("Release from the record");
  for (const id of ex) await walkTo(Tc, id, "qc");
  for (const id of ex){ await rec(Sv, id); await next(Sv, 1); }
  const c0 = doc(ex[0]).certs?.[0];
  check(ex.every(id => doc(id).stageKey === "released" && doc(id).certs.length === 1 && doc(id).certs[0].no === id + "-R1"), "each sample released with its own certificate R1");
  check(c0 && !c0.batch && !c0.qc && c0.rows.Au.v === 1.2 && c0.an[0].u === "g/t" && c0.inst === "AAS run 14-10-01" && c0.tech === "Lab Supervisor", "certificate keeps the result, unit, instrument file and who released it, with no lab batch");

  log("Certificate of analysis");
  await rec(Sv, ex[0]);
  check(/Certificate .*-R1/.test(await Sv.textContent("#resPanel")) && /1\.200/.test(await Sv.textContent("#resPanel")), "record shows the released result and certificate number");
  await Sv.click("[data-cert]"); await Sv.waitForSelector("#certBox:not([hidden]) .cert");
  const certText = await Sv.textContent("#certBox");
  check(/Certificate of analysis/.test(certText) && certText.includes(ex[0] + "-R1") && /1\.200/.test(certText) && !/Lab batch/.test(certText) && /not an official laboratory certificate/.test(certText), "certificate shows the number, result and the prototype disclaimer, with no lab batch column");
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

  log("Over-range result repeated by gravimetric finish");
  await fillForm(P, "submit", { section: "EXP", submitter: "Yaw" }); const [hg] = await ids(P);
  await receipt(Tc, hg); await walkTo(Tc, hg, "finish");
  await typeRes(Tc, hg, { Au: "14.2" });
  check(doc(hg).results.rows.Au.f === "over", "14.2 g/t is above the 10 g/t AAS range and flagged");
  await rec(Tc, hg);
  check(/Over the method's range/.test(await Tc.textContent("#resPanel")), "record flags the over-range result");
  await next(Tc, 1); await rec(Sv, hg);
  check(await Sv.$eval('[data-step="next"]', b => b.disabled) && /over the method's range/.test(await Sv.textContent("#holdNote")), "an over-range result can't be released");
  await rec(Tc, hg); await Tc.click("#overBtn"); await waitFor(() => doc(hg).grav === "Au"); await Tc.waitForTimeout(300);
  check(doc(hg).stageKey === "fuse" && doc(hg).grav === "Au" && !doc(hg).results && doc(hg).reassays === 1, "sent back to fusion for a gravimetric finish");
  await walkTo(Tc, hg, "finish"); await typeRes(Tc, hg, { Au: "14.35" });
  await rec(Tc, hg); await next(Tc, 1); await rec(Sv, hg); await next(Sv, 1);
  const gc = doc(hg).certs?.[0];
  check(doc(hg).stageKey === "released" && gc.rows.Au.v === 14.35 && /gravimetric finish/.test(gc.an[0].n) && !gc.batch, "released with the gravimetric result and method on the certificate" + DBG({ st: doc(hg).stageKey, gc }));

  log("Testwork: checks on each sample's results");
  await fillForm(P, "submit", { section: "MET", type: "met_comp", purpose: "met", submitter: "Plant met" }); const [br] = await ids(P);
  await receipt(Tc, br);
  check(doc(br).route === "BRT" && !doc(br).qcp, "bottle roll: its checks run on its own results");
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

  log("Routes and roles");
  await Tc.click('[data-tab="routes"]'); await Tc.waitForSelector("#rtList");
  await Tc.click('#route-EXP-FA summary');
  const rt = await Tc.textContent("#route-EXP-FA");
  check(/Results reported:\s*AuFx \(g\/t\)/.test(rt) && !/Lab batch/.test(rt), "routes tab shows what each route reports (v24c: fire assay reports AuFx), with no lab batch");
  await Ad.click('[data-tab="stages"]'); await H.cfgTab(Ad, "routes");
  const rtIdx = await Ad.$$eval("#rtPick option", os => os.findIndex(o => o.textContent.startsWith("EXP-FA")));
  await Ad.selectOption("#rtPick", String(rtIdx)); await Ad.waitForSelector('[data-rf="qc"]');
  check(!(await Ad.$("#rtQcp")), "the route editor has no batch type");
  await Ad.click("#cfgCancel");
  check(!(await visibleTabs(Tc)).includes("batches") && (await visibleTabs(Tc)).includes("results"), "a technician has the Results tab and no Batches tab: " + (await visibleTabs(Tc)).join(","));
  const Vw = await newUser(browser, { uid: "u_v", name: "Viewer", canEdit: false, names }); await signIn(Vw, "viewer");
  await H.tab(Vw, "results"); await Vw.waitForTimeout(300);
  check(!(await visibleTabs(Vw)).includes("batches") && !(await Vw.$("[data-attach]")), "a viewer has no Batches tab and can't attach a results file");

  log("Phone layout");
  const ph = await newUser(browser, { uid: "u_ph", name: "Ph", canEdit: true, names }, { width: 375, height: 760 }, "dark");
  await signIn(ph, "super");
  await H.tab(ph, "results"); await ph.waitForSelector('#view-results [data-attach="all"]');
  check(await ph.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "the Results tab with its Attach results file button fits a 375 px phone");
  await ph.screenshot({ path: OUT + "/results-phone-dark.png", fullPage: true });
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
