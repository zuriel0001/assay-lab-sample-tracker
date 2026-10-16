// Polish pass: builds a realistic register through the page, then photographs every tab as each role, at computer and phone widths.
// Run: NODE_PATH=$(npm root -g) node walk.js [output folder] [only]
const fs = require("fs");
const H = require("./harness");
const { store, newUser, launch, signIn, fillForm, ids, open, doc, waitFor, createBatch, fillBatch, saveBatch } = H;
const OUT = process.argv[2] || __dirname + "/walk"; fs.mkdirSync(OUT, { recursive: true });
const ONLY = process.argv[3] || "";
const names = {};
const log = (...a) => console.log("•", ...a);
async function receipt(page, id){ await open(page, id); await page.click('[data-receipt="confirm"]'); await waitFor(() => doc(id).stageKey === "received"); await page.waitForTimeout(300); }
async function release(page, id){ await open(page, id); await page.click('[data-step="next"]'); await waitFor(() => doc(id).stageKey === "released", 5000); await page.waitForTimeout(300); }
async function groupMove(page, sids, toKey){
  for (let g = 0; g < 15; g++){ const k = doc(sids[0]).stageKey; if (k === toKey) return true; await page.click(`[data-bmove="${k}"]`); await waitFor(() => sids.every(id => doc(id).stageKey !== k), 6000); await page.waitForTimeout(250); }
  return doc(sids[0]).stageKey === toKey;
}
async function material(page, id, k, what, ref){
  await open(page, id); const before = JSON.stringify(doc(id).materials);
  await page.selectOption("#mx_" + k, what); if (ref != null) await page.fill("#mr_" + k, ref);
  await page.click(`[data-mat="${k}"]`); await waitFor(() => JSON.stringify(doc(id).materials) !== before && !doc(id).sx, 5000); await page.waitForTimeout(250);
}
const showBatch = async (page, id) => { await H.tab(page, "batches"); await page.waitForSelector(`[data-bsel="${id}"]`, { timeout: 5000 }); await page.click(`[data-bsel="${id}"]`); await page.waitForSelector("#batchBox", { timeout: 5000 }); await page.waitForTimeout(250); };
let n = 0;
async function shot(page, name, full = true){ n++; const f = `${OUT}/${String(n).padStart(3, "0")}-${name}.png`; await page.waitForTimeout(500); await page.screenshot({ path: f, fullPage: full }); }
async function allTabs(page, who){
  const tabs = await H.visibleTabs(page);
  for (const t of tabs){
    if (t === "login") continue;
    await H.tab(page, t); await page.waitForTimeout(700);
    if (t === "stages"){
      const cfg = await page.$$eval("[data-cfgtab]", bs => bs.map(b => b.dataset.cfgtab));
      for (const c of cfg){ await H.cfgTab(page, c); await shot(page, `${who}-settings-${c}`); }
    } else await shot(page, `${who}-${t}`);
  }
}

(async () => {
  const browser = await launch();
  if (!ONLY || ONLY === "empty"){
    log("Empty register");
    const E = await newUser(browser, { uid: "u_e", name: "Admin", canEdit: true, names }); await signIn(E, "admin"); await E.waitForTimeout(800);
    await allTabs(E, "empty-admin");
    const Ep = await newUser(browser, { uid: "u_ep", name: "Public", canEdit: true, names }, { width: 390, height: 844 });
    await shot(Ep, "empty-public-phone-board"); await H.tab(Ep, "register"); await shot(Ep, "empty-public-phone-register");
    await E.context().close(); await Ep.context().close();
    for (const k of Object.keys(store)) delete store[k];
    H.pages.length = 0;
  }
  if (ONLY === "empty"){ await browser.close(); return; }

  log("Building a register");
  const P = await newUser(browser, { uid: "u_p", name: "Public", canEdit: true, names });
  const Tc = await newUser(browser, { uid: "u_t", name: "Tech", canEdit: true, names }); await signIn(Tc, "tech1");
  const Sv = await newUser(browser, { uid: "u_s", name: "Super", canEdit: true, names }); await signIn(Sv, "super");
  await P.waitForTimeout(1200);
  await fillForm(P, "submit", { section: "EXP", submitter: "Ama Mensah", count: 3, tags: "DH-101" }); const ex = await ids(P);
  for (const id of ex) await receipt(Tc, id);
  const b0 = await createBatch(Tc, "fa50", ex);
  await groupMove(Tc, ex, "weigh");
  const AU = { [ex[0]]: "1.20", [ex[1]]: "2.50", [ex[2]]: "0.80" };
  await showBatch(Tc, b0); await fillBatch(Tc, b0, sid => AU[sid] || "1.00"); await saveBatch(Tc, b0);
  await groupMove(Tc, ex, "qc");
  for (const id of ex) await release(Sv, id);
  for (const id of ex) for (const [i, m] of doc(id).materials.entries()) await material(Tc, id, m.k, "store", `Rack 3-${i + 1}`);
  log("stored", ex.join(" "));
  await fillForm(Tc, "register", { section: "MET", type: "plant_feed", purpose: "plant", test: "plant_solids", submitter: "Mill shift B", count: 5, tags: "MILL-A-001" }); const mill = await ids(Tc);
  await fillForm(P, "submit", { section: "MET", type: "plant_feed", purpose: "plant", test: "plant_solids", submitter: "Plant operator", tags: "CCD-07" }); const waiting = await ids(P);
  await fillForm(Tc, "register", { section: "GEO", type: "core", purpose: "exp", submitter: "K. Boateng", count: 2, tags: "GC-55" }); const geo = await ids(Tc);
  log("mill", mill.join(" "), "waiting", waiting, "geo", geo.join(" "));
  // a blind QA/QC check of one stored sample
  await H.tab(Sv, "storage"); await Sv.waitForTimeout(600);
  await Sv.check(`#view-storage [data-qapick="${ex[1]}"]`).catch(e => log("pick failed", e.message));
  await Sv.click('#view-storage [data-qa="make"]').catch(() => {}); await Sv.waitForSelector("#qaGo", { timeout: 4000 }).catch(() => {});
  await Sv.click("#qaGo").catch(() => {}); await waitFor(() => Object.keys(store).some(k => k.startsWith("blind/")), 6000);
  await Sv.click("#qaDone").catch(() => {}); await Sv.keyboard.press("Escape").catch(() => {});
  const blind = (Object.keys(store).find(k => k.startsWith("blind/")) || "").slice(6);
  log("blind", blind);
  fs.writeFileSync(OUT + "/store.json", JSON.stringify({ store, ex, mill, waiting, geo, blind }));
  for (const p of [P, Tc, Sv]) await p.context().close();
  H.pages.length = 0;

  const roles = [["public", null], ["viewer", "viewer"], ["tech", "tech1"], ["super", "super"], ["admin", "admin"], ["plant", "plant"]];
  for (const [who, u] of roles){
    if (ONLY && ONLY !== who && ONLY !== "desk") continue;
    log("Desktop", who);
    const pg = await newUser(browser, { uid: "u_" + who, name: who, canEdit: true, names }); if (u) await signIn(pg, u); await pg.waitForTimeout(800);
    await allTabs(pg, who);
    if (who === "tech" || who === "super" || who === "public"){
      await open(pg, mill[0]); await shot(pg, `${who}-record-mill`);
      await open(pg, ex[0]); await shot(pg, `${who}-record-stored`);
      if (blind){ await open(pg, blind); await shot(pg, `${who}-record-blind`); }
      await open(pg, waiting[0]); await shot(pg, `${who}-record-waiting`);
      await pg.fill("#lookupInput", doc(mill[0]).batchId); await pg.press("#lookupInput", "Enter"); await pg.waitForTimeout(1200); await shot(pg, `${who}-batchpage`);
    }
    await pg.context().close(); H.pages.length = 0;
  }
  for (const [who, u, scheme] of [["public", null, "light"], ["tech", "tech1", "dark"], ["super", "super", "light"]]){
    if (ONLY && ONLY !== who + "-phone" && ONLY !== "phone") continue;
    log("Phone", who);
    const pg = await newUser(browser, { uid: "u_m" + who, name: who, canEdit: true, names }, { width: 390, height: 844 }, scheme); if (u) await signIn(pg, u); await pg.waitForTimeout(800);
    await allTabs(pg, who + "-phone");
    await open(pg, mill[0]); await shot(pg, `${who}-phone-record-mill`);
    await open(pg, ex[0]); await shot(pg, `${who}-phone-record-stored`);
    await pg.context().close(); H.pages.length = 0;
  }
  console.log(H.errors.length ? H.errors : "no errors");
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
