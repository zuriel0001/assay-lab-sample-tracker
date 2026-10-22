// v13: the board loads only samples still in the lab; stored material is listed from small stock records (Storage tab), which the ledger's
// month check and Settings also read. Covers the stock record through a sample's life, a released sample that has gone into
// storage, the repair of an unwritten stock record, and a register with thousands of stored samples.
// Run: NODE_PATH=$(npm root -g) timeout 590 node v13-tests.js
const H = require("./harness");
const { store, errors, newUser, launch, signIn, fillForm, ids, open, doc, toastText, waitFor, broadcast, clone } = H;
const OUT = __dirname;
const names = { u_z: "Zuriel" };
const log = (...a) => console.log("•", ...a);
const check = (cond, msg) => { console.log(cond ? "  PASS" : "  FAIL", msg); if (!cond) process.exitCode = 1; };
const DAY = 86400e3, OPEN_T = 9e15;
const stock = id => store["stock/" + id];

async function receipt(page, id){ await open(page, id); await page.click('[data-receipt="confirm"]'); await waitFor(() => doc(id).stageKey === "received"); await page.waitForTimeout(400); }
/* Walks one sample on its record until it reaches the step. */
async function walkTo(page, id, key){
  await open(page, id);
  for (let g = 0; g < 16 && doc(id).stageKey !== key; g++){ const k = doc(id).stageKey; await page.click('[data-step="next"]'); await waitFor(() => doc(id).stageKey !== k, 4000); await page.waitForTimeout(300); }
  return doc(id).stageKey === key;
}
/* Types results on the sample's record and saves them. */
async function typeRes(page, id, vals){
  await open(page, id);
  if (!(await page.$eval("#resBox", d => d.open))) await page.click("#resBox summary");
  for (const [k, v] of Object.entries(vals)) await page.fill("#rs_" + k, v);
  const v0 = doc(id).results?.v || 0;
  await page.click("#rsSave"); await waitFor(() => (doc(id).results?.v || 0) > v0, 4000); await page.waitForTimeout(300);
}
async function material(page, id, k, what, ref){
  await open(page, id);
  const before = JSON.stringify(doc(id).materials);
  await page.selectOption("#mx_" + k, what); if (ref != null) await page.fill("#mr_" + k, ref);
  if (what === "disposed") await page.selectOption("#mtWit", { index: 1 });   // v24c: disposal needs a witness
  await page.click(`[data-mat="${k}"]`);
  await waitFor(() => JSON.stringify(doc(id).materials) !== before && !doc(id).sx, 5000); await page.waitForTimeout(300);
}
const lanes = page => page.textContent(".lanes").catch(() => "");

(async () => {
  const browser = await launch();
  require("./harness").useOldRoutes();   // v23: this suite is written around the routes in use before version 23
  await H.useQcStep(browser);   // v22: this suite is written around the QA/QC review step, which Settings now turn on
  const P = await newUser(browser, { uid: "u_p", name: "Public", canEdit: true, names });
  const Tc = await newUser(browser, { uid: "u_t", name: "Tech", canEdit: true, names }); await signIn(Tc, "tech1");
  const Sv = await newUser(browser, { uid: "u_s", name: "Super", canEdit: true, names }); await signIn(Sv, "super");
  const Ad = await newUser(browser, { uid: "u_a", name: "Admin", canEdit: true, names }); await signIn(Ad, "admin");
  await P.waitForTimeout(1500);

  log("Stock records follow the sample");
  await fillForm(P, "submit", { section: "EXP", submitter: "Ama", count: 3 }); const ex = await ids(P);
  check(ex.every(id => doc(id).lab === true && doc(id).v === 13 && !stock(id) && !doc(id).sx), "a submitted sample is on the board (lab) and has no stock record until it is received");
  for (const id of ex) await receipt(Tc, id);
  check(ex.every(id => stock(id)?.st === "lab" && stock(id).gone === OPEN_T && stock(id).recvAt === doc(id).recvAt && stock(id).sec === "EXP" && !doc(id).sx), "receipt writes the stock record (in the lab, on hand) and clears the pending mark");
  await H.tab(Tc, "register"); await Tc.waitForSelector("#rType");
  await fillForm(Tc, "register", { section: "GEO", submitter: "Walk-in", type: "core", purpose: "exp" }); const wk = (await ids(Tc))[0];
  await waitFor(() => stock(wk) && !doc(wk).sx, 4000);
  check(stock(wk)?.st === "lab" && doc(wk).lab === true && !doc(wk).sx, "a sample registered at the lab gets its stock record at once");

  log("A released sample goes into storage");
  for (const id of ex){ await walkTo(Tc, id, "weigh"); await typeRes(Tc, id, { Au: "1.20" }); }
  check(ex.every(id => doc(id).results?.rows.Au.v === 1.2), "results typed on each record at weighing");
  for (const id of ex) await walkTo(Tc, id, "qc");
  check(ex.every(id => doc(id).stageKey === "qc"), "samples moved to QA/QC");
  const a = ex[0];
  await open(Sv, a); await Sv.click('[data-step="next"]'); await waitFor(() => doc(a).stageKey === "released", 5000); await Sv.waitForTimeout(400);
  check(doc(a).stageKey === "released" && doc(a).lab === true && (doc(a).certs || []).length === 1, "supervisor releases one sample; it stays on the board until its material is shelved");
  const mats = doc(a).materials.map(m => m.k);
  for (const [i, k] of mats.entries()) await material(Tc, a, k, "store", `Rack 7-${i + 1}`);
  check(doc(a).stageKey === "storage" && doc(a).lab === false && stock(a)?.st === "store" && stock(a).m.length === mats.length && stock(a).m.every(m => /^Rack 7-/.test(m.loc)), `all ${mats.length} material(s) shelved: the sample is in storage, off the board, and its stock record says where`);
  await Sv.click('[data-tab="board"]'); await Sv.waitForTimeout(400);
  check(!(await lanes(Sv)).includes(a) && (await lanes(Sv)).includes(ex[1]), "the stored sample has left the board; the others are still on it");

  log("Storage tab, material out, close and reversal");
  await Tc.click('[data-tab="storage"]'); await Tc.waitForTimeout(400);
  let st = (await Tc.textContent("#view-storage")).replace(/\s+/g, " ");
  check(st.includes(a) && st.includes("Rack 7-1") && (await Tc.$$eval("#view-storage tbody tr", r => r.length)) === mats.length, "Storage lists each kept material with its location");
  await material(Tc, a, mats[0], "disposed");
  if (mats.length > 1){
    check(stock(a)?.st === "store" && stock(a).m.length === mats.length - 1, "one material disposed: the stock record lists what is still kept");
    for (const k of mats.slice(1)) await material(Tc, a, k, "returned", "Geology, slip 9");
  }
  check(doc(a).open === false && stock(a)?.st === "out" && stock(a).gone === doc(a).closedAt && stock(a).m.length === 0, "the last material out closes the sample and its stock record (gone = closed time)");
  await Tc.click('[data-tab="storage"]'); await Tc.waitForTimeout(400);
  check(!(await Tc.textContent("#view-storage")).includes(a), "a closed sample is no longer in Storage");
  const lastK = mats.at(-1);
  await open(Sv, a); await Sv.click(`#mu_box_${lastK} summary`); await Sv.fill("#mu_" + lastK, "Still on the shelf"); await Sv.click(`[data-undo="${lastK}"]`);
  await waitFor(() => doc(a).open === true && !doc(a).sx, 5000); await Sv.waitForTimeout(300);
  check(doc(a).stageKey === "storage" && stock(a)?.st === "store" && stock(a).gone === OPEN_T && stock(a).m.length === 1, "reversing the last movement puts the sample back in storage, on hand again");

  log("Settings counts samples in the lab and in storage");
  await Ad.click('[data-tab="stages"]'); await H.cfgTab(Ad, "sections"); await Ad.waitForSelector("[data-si]"); await Ad.waitForTimeout(500);
  const expRow = await Ad.$$eval('[data-sf="code"]', es => { const r = es.find(e => e.value === "EXP")?.closest("tr"); return r ? r.querySelector("td.mono").textContent : ""; });
  const expOpen = Object.values(store).filter(x => x && x.id && store["samples/" + x.id] === x && x.section === "EXP" && x.open !== false).length;
  check(+expRow === expOpen && expOpen >= 3, `EXP open samples in Settings: ${expRow} (in the lab and in storage: ${expOpen})`);

  log("An unwritten stock record is finished by the next device");
  const c = ex[2];
  store["stock/" + c] = { ...stock(c), st: "out", gone: 1 }; store["samples/" + c] = { ...doc(c), sx: 1 };
  await broadcast("stock/" + c, store["stock/" + c]); await broadcast("samples/" + c, store["samples/" + c]);
  const N = await newUser(browser, { uid: "u_n", name: "Next", canEdit: true, names }); await signIn(N, "tech2");
  await waitFor(() => !doc(c).sx && stock(c)?.st === "lab", 8000);
  check(!doc(c).sx && stock(c)?.st === "lab" && stock(c).gone === OPEN_T, "maintenance rewrites the stock record from the sample and clears the mark");
  await N.close();

  log("Month check from stock records");
  await Tc.click('[data-tab="ledger"]'); await Tc.waitForTimeout(800);
  const lg = (await Tc.textContent("#view-ledger")).replace(/\s+/g, " ");
  const onHand = Object.values(store).filter(x => x && x.id && store["samples/" + x.id] === x && x.recvAt && x.onHand !== false && x.open !== false).length;
  check(new RegExp(`matches the ${onHand} on hand now`).test(lg), `month check balances against the ${onHand} samples on hand: ` + ((lg.match(/Month check:[^.]*\./) || [""])[0]));

  log("A register with thousands of stored samples");
  const now = Date.now(), big = 3000, pad = "x".repeat(7000);   // a released sample is about 8 KB
  for (let i = 1; i <= big; i++){
    const id = `GC-20250${1 + (i % 9)}01-${String(i).padStart(4, "0")}`, due = now + ((i % 400) - 20.5) * DAY;
    store["samples/" + id] = { id, v: 13, lab: false, open: true, onHand: true, section: "GC", type: "RC chips", typeKey: "rc", route: "GC-FA", stageKey: "storage", stageAt: now - 30 * DAY, recvAt: now - 40 * DAY, createdAt: now - 41 * DAY, history: [], tags: [], notes: pad,
      materials: [{ k: "m1", item: "Pulp", status: "kept", dueAt: due, loc: "Rack " + (i % 50), then: "Disposed" }] };
    store["stock/" + id] = { id, sec: "GC", type: "RC chips", route: "GC-FA", tag: "", recvAt: now - 40 * DAY, gone: OPEN_T, st: "store", due, two: false, m: [{ k: "m1", item: "Pulp", loc: "Rack " + (i % 50), dueAt: due, then: "Disposed" }] };
  }
  const recs = Object.values(store).filter(x => x && x.id && x.v && store["samples/" + x.id] === x);
  const kb = list => Math.round(list.reduce((n, x) => n + JSON.stringify(x).length, 0) / 1024);
  const labDocs = recs.filter(x => x.lab === true), openDocs = recs.filter(x => x.open !== false), stockDocs = Object.entries(store).filter(([k, x]) => k.startsWith("stock/") && x.st === "store").map(([, x]) => x);
  const L = await newUser(browser, { uid: "u_l", name: "Large", canEdit: true, names }); await signIn(L, "tech1");
  await L.click('[data-tab="board"]'); await L.waitForTimeout(800);
  check(+(await L.textContent("#cntActive")) === labDocs.length && !(await lanes(L)).includes("GC-2025"), `the board loads the ${labDocs.length} samples in the lab (${kb(labDocs)} KB), not all ${openDocs.length} open ones (${kb(openDocs)} KB)`);
  const pastN = stockDocs.filter(x => x.due < now).length;
  check(new RegExp(`${pastN} ?Materials past retention`).test((await L.textContent(".stats")).replace(/\s+/g, " ")), `the board still counts the ${pastN} stored materials past retention, from a small query`);
  await L.click('[data-tab="storage"]'); await L.waitForTimeout(1500);
  st = (await L.textContent("#view-storage")).replace(/\s+/g, " ");
  check(new RegExp(`${stockDocs.length} ?Samples in storage`).test(st) && (await L.$$eval("#view-storage tbody tr", r => r.length)) === 200 && /200 of \d+/.test(st), `Storage reads ${stockDocs.length} stock records (${kb(stockDocs)} KB) and shows the first 200, oldest due first`);
  const firstDue = await L.$eval("#view-storage tbody tr td:nth-child(4)", e => e.textContent);
  check(/Past retention/.test(firstDue), "the first rows are past retention");
  await L.click("#stMore"); await L.waitForTimeout(400);
  check((await L.$$eval("#view-storage tbody tr", r => r.length)) === 400, "Show more adds 200 rows");
  await L.fill("#stQ", "rack 49"); await L.waitForTimeout(500);
  const rk = await L.$$eval("#view-storage tbody tr td:nth-child(3)", es => es.map(e => e.textContent));
  check(rk.length === 60 && rk.every(x => x === "Rack 49"), `search by location: ${rk.length} rows at Rack 49`);
  await L.screenshot({ path: OUT + "/v13-storage.png", fullPage: false });
  const M = await newUser(browser, { uid: "u_m", name: "Phone", canEdit: true, names }, { width: 375, height: 760 }); await signIn(M, "tech1");
  await H.tab(M, "storage"); await M.waitForTimeout(1500);
  const wide = await M.evaluate(() => [...document.querySelectorAll("body *")].filter(e => e.offsetParent && e.getBoundingClientRect().right > window.innerWidth + 1 && ![...e.querySelectorAll("*")].some(c => c.getBoundingClientRect().right > window.innerWidth + 1)).slice(0, 6).map(e => e.tagName + "." + [...e.classList].join(".") + " " + Math.round(e.getBoundingClientRect().right) + " " + (e.textContent || "").trim().slice(0, 30)));
  check(await M.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "Storage has no sideways page scroll on a phone" + (wide.length ? ": " + wide.join(" | ") : ""));
  await M.screenshot({ path: OUT + "/v13-storage-phone.png", fullPage: false });

  console.log("Console errors:", errors.length ? errors.join("\n") : "none");
  if (errors.length) process.exitCode = 1;
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
