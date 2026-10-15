// Two-user smoke test of the tracker against an in-memory shared store that mimics the db capability.
const { chromium } = require("playwright");
const path = require("path");
const FILE = "file://" + path.resolve(__dirname, "../met-lab-sample-tracker.html");
const OUT = __dirname;

const store = {}, leases = {};
const pages = [];
const errors = [];
function clone(o){ return o == null ? o : JSON.parse(JSON.stringify(o)); }
function merge(a, b){ const o = { ...a }; for (const k in b){ o[k] = (b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) && a[k] && typeof a[k] === "object") ? merge(a[k], b[k]) : b[k]; } return o; }
async function broadcast(p, d){ await Promise.all(pages.map(pg => pg.evaluate(([p, d]) => window.__dbPush(p, d), [p, d]).catch(() => {}))); }

const MOCK = ({ uid, name, canEdit, canWrite = true, names }) => {
  window.__mirror = window.__initialMirror || {};
  const listeners = new Set();
  window.__dbPush = (p, d) => { if (d === null) delete __mirror[p]; else __mirror[p] = d; listeners.forEach(l => l.fire()); };
  const md = { fromCache: false, hasPendingWrites: false };
  const dsnap = p => { const d = __mirror[p]; return { id: p.split("/").pop(), exists: !!d, data: () => d && JSON.parse(JSON.stringify(d)), metadata: md }; };
  const later = f => setTimeout(f, 5);
  function docRef(p){
    return { id: p.split("/").pop(), path: p,
      get: async () => dsnap(p),
      set: async d => { await window.__dbWrite("set", p, d); },
      update: async d => { if (!__mirror[p]) throw { code: "invalid_argument" }; await window.__dbWrite("update", p, d); },
      delete: async () => { await window.__dbWrite("delete", p, null); },
      acquire: async o => window.__dbAcquire(p, o.holder, o.ttlMs || 30000),
      onSnapshot(cb){ const l = { fire: () => later(() => cb(dsnap(p))) }; listeners.add(l); l.fire(); return () => listeners.delete(l); },
      collection: sub => colRef(p + "/" + sub) };
  }
  function colRef(p, q = {}){
    const n = p.split("/").length + 1;
    const run = () => {
      let docs = Object.keys(__mirror).filter(k => k.startsWith(p + "/") && k.split("/").length === n).sort().map(dsnap);
      if (q.ob){ const [f, dir] = q.ob; docs.sort((a, b) => ((a.data()[f] > b.data()[f]) - (a.data()[f] < b.data()[f])) * (dir === "desc" ? -1 : 1)); }
      if (q.lim) docs = docs.slice(0, q.lim);
      return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: md };
    };
    return { path: p, doc: id => docRef(p + "/" + (id || Math.random().toString(36).slice(2))),
      where: () => colRef(p, q), orderBy: (f, d) => colRef(p, { ...q, ob: [f, d || "asc"] }), limit: k => colRef(p, { ...q, lim: k }),
      get: async () => run(),
      onSnapshot(cb){ const l = { fire: () => later(() => cb(run())) }; listeners.add(l); l.fire(); return () => listeners.delete(l); } };
  }
  const db = { doc: docRef, collection: p => colRef(p) };
  const user = { me: async () => ({ id: uid, name, isOwner: canEdit, canEdit }), id: async () => uid, can: async () => canWrite, canEdit: async () => canEdit,
    isOwner: async () => canEdit, profiles: async ids => Object.fromEntries([].concat(ids).map(i => [i, { id: i, name: names[i] || "" }])) };
  window.claude = { use: async n => n === "db" ? db : n === "user" ? user : n === "downloads" ? { save: async o => { window.__downloaded = o; } } : null };
};

async function newUser(browser, opts, viewport = { width: 1280, height: 900 }, scheme = "light"){
  const ctx = await browser.newContext({ viewport, colorScheme: scheme });
  const page = await ctx.newPage();
  page.on("console", m => { if (m.type() === "error" && !/fonts\.g/.test(m.text())) errors.push(`[${opts.name}] ${m.text()}`); });
  page.on("pageerror", e => errors.push(`[${opts.name}] pageerror ${e.message}`));
  await page.exposeFunction("__dbWrite", async (op, p, d) => {
    await new Promise(r => setTimeout(r, 30 + Math.random() * 40)); // network latency
    if (op === "set") store[p] = clone(d); else if (op === "update") store[p] = merge(store[p], d); else delete store[p];
    await broadcast(p, op === "delete" ? null : store[p]);
  });
  await page.exposeFunction("__dbAcquire", async (p, holder, ttl) => {
    const now = Date.now(), l = leases[p];
    if (l && l.exp > now && l.holder !== holder) return { acquired: false, expiresAt: new Date(l.exp).toISOString() };
    leases[p] = { holder, exp: now + ttl }; return { acquired: true, holder };
  });
  await page.addInitScript(`window.__initialMirror = ${JSON.stringify(store)}; (${MOCK.toString()})(${JSON.stringify(opts)});`);
  await page.goto(FILE);
  pages.push(page);
  await page.waitForTimeout(300);
  return page;
}
const names = { u_z: "Zuriel" };
const log = (...a) => console.log("•", ...a);
const check = (cond, msg) => { console.log(cond ? "  PASS" : "  FAIL", msg); if (!cond) process.exitCode = 1; };
const stamp = ms => { const d = new Date(ms); return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`; };
const T = stamp(Date.now());
const visibleTabs = p => p.$$eval("#tabs button", bs => bs.filter(b => !b.hidden && !b.closest("[hidden]")).map(b => b.dataset.tab));
async function signIn(page, u){
  if (!(await page.$("#loginForm"))) await page.click('[data-tab="login"]');
  await page.waitForSelector("#loginForm");
  await page.click(`[data-demo="${u}"]`);
  await page.click('#loginForm button[type=submit]');
  await page.waitForTimeout(250);
}
async function fillForm(page, tabName, { section, type = "core", purpose = "exp", test = "", submitter = "J. Owusu", count = 1, tags = "", details = {} }){
  await page.click(`[data-tab="${tabName}"]`);
  if (await page.$("#rAgain")) { await page.click("#rAgain"); }
  await page.selectOption("#rSection", section);
  await page.selectOption("#rType", type);
  await page.selectOption("#rPurpose", purpose);
  if (test) await page.selectOption("#rTest", test);
  for (const [k, val] of Object.entries(details)) await page.fill("#rD_" + k, val);
  await page.fill("#rSubmitter", submitter);
  await page.fill("#rCount", String(count));
  if (tags) await page.fill("#rTag", tags);
  await page.click("#rSubmit");
}
const ids = async page => { await page.waitForSelector("#rResult code", { timeout: 15000 }); return page.$$eval("#rResult code", els => els.map(e => e.textContent)); };
const open = async (page, id) => { await page.fill("#lookupInput", id); await page.press("#lookupInput", "Enter"); await page.waitForSelector(".sid"); await page.waitForTimeout(250); };
const doc = id => store["samples/" + id];

const R = (tag, ok, msg) => console.log(ok ? "  OK  " : "  BUG ", tag, msg);
async function receipt(page, id, kind = "confirm", note = ""){ await open(page, id); if (note) await page.fill("#mvNote", note); await page.click(`[data-receipt="${kind}"]`); await page.waitForTimeout(400); }
async function moveTo(page, key, note = ""){ await page.selectOption("#mvKey", key); if (note) await page.fill("#mvNote", note); await page.click('#moveForm button[type=submit]'); await page.waitForTimeout(400); }
(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const P = await newUser(browser, { uid: "u_p", name: "Public", canEdit: true, names });
  const Tc = await newUser(browser, { uid: "u_t", name: "Tech", canEdit: true, names });
  await signIn(Tc, "tech1");

  // A: receipt time before submission
  await fillForm(P, "submit", { section: "EXP", tags: "T-500", submitter: "Esi" });
  const a = (await ids(P))[0];
  await open(Tc, a);
  const y = new Date(Date.now() - 2 * 86400e3); const loc = new Date(y - y.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  await Tc.fill("#rcAt", loc); await Tc.click('[data-receipt="confirm"]'); await Tc.waitForTimeout(400);
  R("A", !(doc(a).receivedAt < doc(a).createdAt), `receipt dated before submission accepted: received ${new Date(doc(a).receivedAt).toISOString()} < submitted ${new Date(doc(a).createdAt).toISOString()}`);

  // B: picked stage + note silently reset by another user's write
  await open(Tc, a);
  await Tc.selectOption("#mvKey", "pulv"); await Tc.fill("#mvNote", "moving to pulverising");
  await fillForm(P, "submit", { section: "GEO", submitter: "Other user" }); await ids(P); await Tc.waitForTimeout(500);
  const selNow = await Tc.$eval("#mvKey", e => e.value);
  await Tc.click('#moveForm button[type=submit]'); await Tc.waitForTimeout(500);
  R("B", doc(a).stageKey === "pulv", `stage dropdown after another user's write = ${selNow}; after Record, sample stage = ${doc(a).stageKey}, last history = ${JSON.stringify(doc(a).history.slice(-1)[0].key)} note "${doc(a).history.slice(-1)[0].note}"`);

  // C: corrections create duplicate ledger movements
  await open(Tc, a); await moveTo(Tc, "received", "correction");
  await moveTo(Tc, "disposed"); await moveTo(Tc, "storage", "mistake, undo"); await moveTo(Tc, "returned");
  await Tc.click('[data-tab="ledger"]'); await Tc.waitForTimeout(300);
  const rows = await Tc.$$eval("#view-ledger tbody tr", trs => trs.map(t => t.children[1].textContent + " " + t.children[2].textContent));
  const mine = rows.filter(r => r.includes(a));
  R("C", mine.length === 2, `ledger rows for ${a}: ${mine.join(" | ")}`);

  // D: reject at receipt, and reject after receipt
  await fillForm(P, "submit", { section: "EXP", submitter: "Esi" }); const d1 = (await ids(P))[0];
  await receipt(Tc, d1, "reject", "bag torn, sample spilt");
  await fillForm(P, "submit", { section: "EXP", submitter: "Esi" }); const d2 = (await ids(P))[0];
  await receipt(Tc, d2); await open(Tc, d2); await moveTo(Tc, "rejected", "wrong");
  await Tc.click('[data-tab="ledger"]'); await Tc.waitForTimeout(300);
  const rows2 = await Tc.$$eval("#view-ledger tbody tr", trs => trs.map(t => t.children[1].textContent + " " + t.children[2].textContent));
  R("D1", rows2.some(r => r.includes(d1)), `rejected-at-receipt ${d1} ledger rows: ${rows2.filter(r => r.includes(d1)).join(" | ") || "none"}`);
  R("D2", rows2.filter(r => r.includes(d2)).length !== 1, `received then rejected ${d2} ledger rows: ${rows2.filter(r => r.includes(d2)).join(" | ")}`);

  // E: skip straight to results released
  await fillForm(P, "submit", { section: "EXP", submitter: "Esi" }); const e1 = (await ids(P))[0];
  await receipt(Tc, e1); await open(Tc, e1); await moveTo(Tc, "released");
  R("E", doc(e1).stageKey !== "released", `received → released directly allowed: stage=${doc(e1).stageKey}, QA/QC never recorded`);

  // F: batch with single tag
  await fillForm(P, "submit", { section: "EXP", submitter: "Esi", count: 3, tags: "T-10421" }); const f = await ids(P);
  R("F", doc(f[1]).tagNo === "T-10422", `batch of 3 with tag T-10421 stored tags: ${f.map(i => doc(i).tagNo).join(", ")}`);

  // G: tracking link by tag
  const G = await browser.newContext(); const gp = await G.newPage();
  await gp.addInitScript(`window.__initialMirror = ${JSON.stringify(store)};`);
  // simplified: just check normId
  const n = await Tc.evaluate(() => { const v = "T-10421"; return v.trim().toUpperCase().replace(/\s+/g, "").replace(/^([A-Z]{1,6})-?(\d{4})-?(\d{1,5})$/, (m, a, b, c) => `${a}-${b}-${c.padStart(5, "0")}`); });
  R("G", n === "T-10421", `lookup normalises tag T-10421 to ${n} before searching (only rescued if the tag matches a loaded sample)`);

  // H: backdated receipt time reset by another user's write
  await fillForm(P, "submit", { section: "EXP", submitter: "Esi" }); const h1 = (await ids(P))[0];
  await open(Tc, h1); await Tc.fill("#rcAt", loc); await Tc.focus("#mvNote");
  await fillForm(P, "submit", { section: "GEO", submitter: "Other" }); await ids(P); await Tc.waitForTimeout(500);
  const rcNow = await Tc.$eval("#rcAt", e => e.value);
  R("H", rcNow === loc, `receipt time typed ${loc}, after another user's write shows ${rcNow}`);

  // I: admin settings focus lost on any write
  const Ad = await newUser(browser, { uid: "u_a", name: "Admin", canEdit: true, names }); await signIn(Ad, "admin");
  await Ad.click('[data-tab="stages"]'); await Ad.waitForTimeout(300);
  await Ad.click('[data-rf="desc"]'); await Ad.keyboard.type("half typed");
  await fillForm(P, "submit", { section: "GEO", submitter: "Other" }); await ids(P); await Ad.waitForTimeout(500);
  const foc = await Ad.evaluate(() => document.activeElement && (document.activeElement.dataset.rf || document.activeElement.tagName));
  R("I", foc === "desc", `admin typing in route description; after another user's submission focus is on: ${foc}`);

  // K: register at lab with a route that does not do the requested test
  await fillForm(Tc, "register", { section: "MET", type: "core", purpose: "exp", test: "sfa", submitter: "X" });
  // above submitted already with auto; do again with manual route
  await Tc.click("#rAgain"); await Tc.selectOption("#rSection", "MET"); await Tc.selectOption("#rType", "core"); await Tc.selectOption("#rPurpose", "exp");
  await Tc.selectOption("#rTest", "sfa"); await Tc.selectOption("#rRouteSel", "ICP"); await Tc.fill("#rSubmitter", "X"); await Tc.click("#rSubmit");
  const k = (await ids(Tc))[0];
  R("K", doc(k).test === "sfa", `requested screen fire assay, picked route ICP: stored test=${doc(k).test} (${doc(k).testName}), no warning`);

  // M: forged session
  const M = await newUser(browser, { uid: "u_m", name: "M", canEdit: true, names });
  await M.evaluate(() => localStorage.setItem("session", "admin")); await M.reload(); await M.waitForTimeout(400);
  const mt = await visibleTabs(M);
  R("M", !mt.includes("stages"), `setting one browser storage value without a password gives tabs: ${mt.join(",")}`);

  // R: concurrent submissions same section
  const P2 = await newUser(browser, { uid: "u_p2", name: "P2", canEdit: true, names });
  const t0 = Date.now();
  await Promise.all([fillForm(P, "submit", { section: "PLT", type: "plant_feed", purpose: "plant", submitter: "A" }), fillForm(P2, "submit", { section: "PLT", type: "plant_feed", purpose: "plant", submitter: "B" })]);
  const [r1, r2] = [(await ids(P))[0], (await ids(P2))[0]];
  R("R", r1 !== r2, `two simultaneous PLT submissions got ${r1} and ${r2} in ${Date.now() - t0} ms`);

  // J: phone layout
  const ph = await newUser(browser, { uid: "u_ph", name: "Ph", canEdit: true, names }, { width: 375, height: 760 });
  await signIn(ph, "admin");
  for (const t of ["board", "submit", "register", "ledger", "routes", "stages"]){
    await ph.click(`[data-tab="${t}"]`); await ph.waitForTimeout(300);
    const w = await ph.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    R("J-" + t, w[0] <= w[1], `phone width 375: page scrollWidth ${w[0]}`);
    await ph.screenshot({ path: OUT + `/phone-${t}.png`, fullPage: true });
  }
  await open(ph, a); { const w = await ph.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); R("J-track", w[0] <= w[1], `phone record scrollWidth ${w[0]}`); await ph.screenshot({ path: OUT + "/phone-track.png", fullPage: true }); }
  const tabsOverflow = await ph.$eval("#tabs", e => [e.scrollWidth, e.clientWidth]);
  console.log("  INFO tabs strip", tabsOverflow);
  console.log("ERRORS", errors);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
