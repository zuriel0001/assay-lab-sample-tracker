// Shared test harness: several browser pages on one in-memory store that behaves like the Artifact db capability
// (where filters, orderBy, limit, recursive update merge, update-requires-existence, cooperative leases, live snapshots).
const { chromium } = require("playwright");
const path = require("path");
const FILE = "file://" + path.resolve(__dirname, process.env.PAGE || "../assay-lab-sample-tracker.html");
const store = {}, leases = {}, pages = [], errors = [], toasts = [];
const stats = { writes: 0 };
function clone(o){ return o == null ? o : JSON.parse(JSON.stringify(o)); }
function merge(a, b){ const o = { ...a }; for (const k in b){ o[k] = (b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) && a[k] && typeof a[k] === "object" && !Array.isArray(a[k])) ? merge(a[k], b[k]) : b[k]; } return o; }
async function broadcast(p, d){ await Promise.all(pages.map(pg => pg.evaluate(([p, d]) => window.__dbPush && window.__dbPush(p, d), [p, d]).catch(() => {}))); }

const MOCK = ({ uid, name, canEdit, canWrite = true, names }) => {
  window.__mirror = window.__initialMirror || {};
  const listeners = new Set();
  window.__dbPush = (p, d) => { if (d === null) delete __mirror[p]; else __mirror[p] = d; listeners.forEach(l => l.fire()); };
  const md = { fromCache: false, hasPendingWrites: false };
  // Like the platform, delivered snapshots are frozen: a page that mutates one fails loudly here.
  const deepFreeze = o => { if (o && typeof o === "object"){ Object.values(o).forEach(deepFreeze); Object.freeze(o); } return o; };
  const dsnap = p => { const d = __mirror[p]; return { id: p.split("/").pop(), exists: !!d, data: () => d && deepFreeze(JSON.parse(JSON.stringify(d))), metadata: md }; };
  const later = f => setTimeout(f, 5);
  const ok = (d, [f, op, v]) => {
    const x = d[f]; if (x === undefined) return false;
    switch (op){
      case "==": return x === v; case "!=": return x !== v; case "<": return x < v; case "<=": return x <= v; case ">": return x > v; case ">=": return x >= v;
      case "in": return v.includes(x); case "not-in": return !v.includes(x); case "array-contains": return Array.isArray(x) && x.includes(v);
    }
    throw new Error("unsupported op " + op);
  };
  function docRef(p){
    return { id: p.split("/").pop(), path: p,
      get: async () => dsnap(p),
      set: async d => { if (!canWrite) throw { code: "invalid_argument" }; await window.__dbWrite("set", p, d); },
      update: async d => { if (!canWrite || !__mirror[p]) throw { code: "invalid_argument" }; await window.__dbWrite("update", p, d); },
      delete: async () => { await window.__dbWrite("delete", p, null); },
      acquire: async o => window.__dbAcquire(p, o.holder, Math.min(600000, Math.max(1000, o.ttlMs || 30000))),
      onSnapshot(cb){ const l = { fire: () => later(() => cb(dsnap(p))) }; listeners.add(l); l.fire(); return () => listeners.delete(l); },
      collection: sub => colRef(p + "/" + sub) };
  }
  function colRef(p, q = { w: [] }){
    const n = p.split("/").length + 1;
    const run = () => {
      let docs = Object.keys(__mirror).filter(k => k.startsWith(p + "/") && k.split("/").length === n).sort().filter(k => q.w.every(c => ok(__mirror[k], c))).map(dsnap);
      if (q.ob){ const [f, dir] = q.ob; docs.sort((a, b) => ((a.data()[f] > b.data()[f]) - (a.data()[f] < b.data()[f])) * (dir === "desc" ? -1 : 1)); }
      if (q.lim) docs = docs.slice(0, q.lim);
      return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: md };
    };
    return { path: p, doc: id => docRef(p + "/" + (id || Math.random().toString(36).slice(2))),
      where: (f, op, v) => colRef(p, { ...q, w: [...q.w, [f, op, v]] }), orderBy: (f, d) => colRef(p, { ...q, ob: [f, d || "asc"] }), limit: k => colRef(p, { ...q, lim: k }),
      get: async () => run(),
      onSnapshot(cb){ const l = { fire: () => later(() => cb(run())) }; listeners.add(l); l.fire(); return () => listeners.delete(l); } };
  }
  const db = { doc: docRef, collection: p => colRef(p) };
  const user = { me: async () => ({ id: uid, name, isOwner: canEdit, canEdit }), id: async () => uid, can: async () => canWrite, canEdit: async () => canEdit,
    isOwner: async () => canEdit, profiles: async ids => Object.fromEntries([].concat(ids).map(i => [i, { id: i, name: names[i] || "" }])) };
  window.claude = { use: async n => n === "db" ? db : n === "user" ? user : n === "downloads" ? { save: async o => { window.__downloaded = o; } } : null };
};

async function newUser(browser, opts, viewport = { width: 1280, height: 900 }, scheme = "light", extra = {}){
  const ctx = await browser.newContext({ viewport, colorScheme: scheme, ...extra });
  const page = await ctx.newPage();
  page.on("console", m => { if (m.type() === "error" && !/fonts\.g/.test(m.text())) errors.push(`[${opts.name}] ${m.text()}`); });
  page.on("pageerror", e => errors.push(`[${opts.name}] pageerror ${e.message}`));
  page.on("console", m => { if (m.type() === "log" && m.text().startsWith("TOAST:")) { toasts.push(`[${opts.name}] ${m.text().slice(6)}`); if (process.env.DBG) console.log("    toast", `[${opts.name}]`, m.text().slice(6)); } });
  await page.addInitScript(() => { document.addEventListener("DOMContentLoaded", () => { const t = document.getElementById("toast"); if (t) new MutationObserver(() => { if (!t.hidden && t.textContent) console.log("TOAST:" + t.textContent); }).observe(t, { childList: true, characterData: true, subtree: true, attributes: true }); }); });
  await page.exposeFunction("__dbWrite", async (op, p, d) => {
    await new Promise(r => setTimeout(r, 30 + Math.random() * 40)); // network latency
    stats.writes++;
    if (op === "set") store[p] = clone(d); else if (op === "update") store[p] = merge(store[p], d); else delete store[p];
    await broadcast(p, op === "delete" ? null : store[p]);
  });
  await page.exposeFunction("__dbAcquire", async (p, holder, ttl) => {
    const now = Date.now(), l = leases[p];
    if (l && l.exp > now && l.holder !== holder) return { acquired: false, expiresAt: new Date(l.exp).toISOString() };
    leases[p] = { holder, exp: now + ttl }; return { acquired: true, holder, expiresAt: new Date(now + ttl).toISOString() };
  });
  if (opts.session) await page.addInitScript(`try { localStorage.setItem("session", ${JSON.stringify(opts.session)}); } catch {}`);
  await page.addInitScript(`window.__initialMirror = ${JSON.stringify(store)}; (${MOCK.toString()})(${JSON.stringify(opts)});`);
  await page.goto(FILE + (opts.hash ? "#" + opts.hash : ""));
  pages.push(page);
  await page.waitForTimeout(350);
  return page;
}
const launch = () => chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const T = new Date().toISOString().slice(0, 10).replace(/-/g, "");   // site time zone in the tests is Africa/Accra (UTC)
/* The tabs a person can open, in menu order, whether they sit in the bar or in the More menu. */
const visibleTabs = p => p.$$eval("#tabs button[data-tab]", bs => bs.filter(b => !b.hidden).map(b => b.dataset.tab).sort((a, b) => ["board", "track", "submit", "register", "batches", "storage", "results", "ledger", "routes", "stages", "login"].indexOf(a) - ["board", "track", "submit", "register", "batches", "storage", "results", "ledger", "routes", "stages", "login"].indexOf(b)));
async function signIn(page, u){
  if (!(await page.$("#loginForm"))) await tab(page, "login");
  await page.waitForSelector("#loginForm");
  await page.click(`[data-demo="${u}"]`);
  await page.click('#loginForm button[type=submit]');
  await page.waitForTimeout(250);
}
async function fillForm(page, tabName, { section, type = "core", purpose = "exp", test = "", route = "", submitter = "J. Owusu", count = 1, tags = "", details = {}, collected = "", recvAt = "", wit = "", why = "", handed, badge, subBadge = "" }){
  // v16: Submit a sample needs a sign-in; people who are not signed in register walk-in samples at the lab, which wait for receipt the same way.
  // v17: signed in, there is only Submit; lab staff receive on it ("Received now at the lab, by me"), so "register" means that box ticked
  // and "submit" means it cleared (a submission received later, the same document as a public one).
  const hidden = k => page.$eval(`#tabs [data-tab="${k}"]`, b => b.hidden);
  let recvNow = null;
  if (tabName === "submit" && await hidden("submit")) tabName = "register";
  else if (tabName === "register" && await hidden("register")){ tabName = "submit"; recvNow = true; }
  else if (tabName === "submit") recvNow = false;
  await tab(page, tabName);
  if (await page.$("#rAgain")) { await page.click("#rAgain"); }
  if (recvNow !== null && await page.$("#rRecvNow")) await page.setChecked("#rRecvNow", recvNow);
  await page.$eval("#rMore", d => { d.open = true; }).catch(() => {});   // v18: the optional fields sit under More details
  if (await page.isVisible("#rHandTo")){
    const walk = tabName === "register";
    await page.fill("#rHandTo", handed ?? (walk ? "Lab Technician A" : ""));
    await page.fill("#rHandBadge", badge ?? (walk ? "B-101" : ""));
  }
  if (subBadge) await page.fill("#rSubBadge", subBadge);   // v18: the submitter's badge number (the old "tag number" is the site sample code)
  await page.selectOption("#rSection", section);
  await page.selectOption("#rType", type);
  await page.selectOption("#rPurpose", purpose);
  if (why) await page.fill("#rWhy", why);
  if (test) await page.selectOption("#rTest", test);
  if (route) await page.selectOption("#rRouteSel", route);
  for (const [k, val] of Object.entries(details)) await page.fill("#rD_" + k, val);
  await page.fill("#rSubmitter", submitter);
  // v20: Single sample or Batch. A batch lists its samples one row each; one code on the first row counts up for the rest.
  if (count > 1){
    await page.check('input[name="rKind"][value="batch"]');
    await page.fill("#rCount", String(count)); await page.dispatchEvent("#rCount", "change");
    const tg = String(tags || "").split(/[,;\n]+/).map(x => x.trim()).filter(Boolean);
    if (tg.length === count) for (const [i, t] of tg.entries()) await page.fill(`#rRows .r-code[data-i="${i}"]`, t);
    else if (tg.length) await page.fill('#rRows .r-code[data-i="0"]', tg.join(", "));
  } else {
    await page.check('input[name="rKind"][value="single"]');
    await page.fill("#rTag", tags);
  }
  await page.fill("#rCollected", collected);   // a refused value stays in the form, so always set it
  if (recvAt) await page.fill("#rRecvAt", recvAt);
  if (wit) await page.selectOption("#rWit", { label: wit });
  await page.click("#rSubmit");
}
const ids = async page => { await page.waitForSelector("#rResult code", { timeout: 15000 }); return page.$$eval("#rResult code", els => els.map(e => e.textContent.split(" · ")[0])); };
const open = async (page, id) => { await page.fill("#lookupInput", id); await page.press("#lookupInput", "Enter"); await page.waitForSelector(".sid", { timeout: 8000 }); await page.waitForTimeout(250); };
const doc = id => store["samples/" + id];
const ledger = () => Object.entries(store).filter(([k]) => k.startsWith("ledger/")).flatMap(([, d]) => Object.values(d.m || {}));
const toastText = page => page.$eval("#toast", t => t.hidden ? "" : t.textContent);
const localStr = ms => new Date(ms).toISOString().slice(0, 16);   // datetime-local value in site time (UTC)
const batchDoc = id => store["batches/" + id];
/* Settings shows one group at a time: Accounts, Sections and site time, Reference materials, Limits, Workflow routes. */
/* A phone shows four tabs and a More menu; this opens a tab wherever it is. */
/* v17: one entry tab. Signed in, "register" opens Submit with "Received now at the lab, by me" ticked (lab staff); signed out, "submit" opens Register. */
const tab = async (page, k) => {
  const hid = t => page.$eval(`#tabs [data-tab="${t}"]`, b => b.hidden);
  let recv = false;
  if (k === "register" && await hid("register") && !(await hid("submit"))){ k = "submit"; recv = true; }
  else if (k === "submit" && await hid("submit") && !(await hid("register"))) k = "register";
  const sel = `#tabs [data-tab="${k}"]`; if (!(await page.isVisible(sel))){ await page.click("#tabMore"); await page.waitForSelector(sel, { state: "visible" }); } await page.click(sel);
  if (recv && await page.$("#rRecvNow")) await page.setChecked("#rRecvNow", true);
};
const cfgTab = async (page, k) => { await page.click(`[data-cfgtab="${k}"]`); await page.waitForTimeout(120); };
const waitFor = async (fn, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms){ const v = fn(); if (v) return v; await new Promise(r => setTimeout(r, 60)); } return null; };
/* Creates a lab batch on the Lab batches tab with exactly these samples; returns its id. */
async function createBatch(page, prof, sids){
  await page.click('#tabs button[data-tab="batches"]');
  await page.waitForSelector("#nbProf", { timeout: 5000 });
  await page.selectOption("#nbProf", prof); await page.waitForSelector("#nbCreate", { timeout: 5000 });
  await page.$$eval("#nbList input[type=checkbox]", (els, ids) => els.forEach(e => { e.checked = ids.includes(e.value); }), sids);
  const before = new Set(Object.keys(store).filter(k => k.startsWith("batches/")));
  await page.click("#nbCreate");
  const key = await waitFor(() => Object.keys(store).find(k => k.startsWith("batches/") && !before.has(k) && store[k].status === "prep"));
  if (!key) throw new Error("batch not created: " + await toastText(page) + " " + JSON.stringify(sids.map(id => [id, store["samples/" + id]?.stageKey, store["samples/" + id]?.lab, store["samples/" + id]?.qcg])) + " list=" + JSON.stringify(await page.$$eval("#nbList input[type=checkbox]", els => els.map(e => e.value))));
  await page.waitForSelector("#bSave", { state: "attached", timeout: 5000 });
  await page.waitForTimeout(150); await openTyping(page);
  return key.slice(8);
}
/* v18: results come from an attached file; typing them sits under "Type results instead" on the batch. */
async function openTyping(page){ await page.$eval("#bType", d => { d.open = true; }).catch(() => {}); }
/* Types a value at every position and for every result the batch checks: samples from valueOf(sid, key), duplicates equal to their original,
   blanks <DL, reference materials at their certified value (left empty where the material is not certified for that result).
   over[p] replaces one position: a string for the first result, or { key: value }. */
async function fillBatch(page, id, valueOf = () => "1.00", over = {}){
  const b = batchDoc(id), ans = b.ans || [b.an];
  await openTyping(page);
  for (const x of b.pos){
    for (const [i, ch] of ans.entries()){
      const sel = "#" + (i === 0 ? "bp_" + x.p : `bp_${x.p}_${ch.k}`);
      let v = over[x.p]; if (v && typeof v === "object") v = v[ch.k]; else if (i > 0) v = null;
      if (v == null){
        if (x.t === "s") v = String(valueOf(x.sid, ch.k, i));
        else if (x.t === "pd" || x.t === "cd") v = String(valueOf(x.of, ch.k, i));
        else if (x.t === "bl" || x.t === "pb") v = "<DL";
        else { const e = await page.$eval(sel, e => e.dataset.exp || ""); if (e === "") continue; v = String(parseFloat(e)); }
      }
      await page.fill(sel, v);
    }
  }
}
async function saveBatch(page, id){
  await openTyping(page); await page.click("#bSave");
  const inB = s => s && (Object.values(s.labs || {}).find(l => l && l.b === id) || (!s.labs && s.labBatch === id ? { q: s.labQc } : null));
  await waitFor(() => batchDoc(id)?.qc && (batchDoc(id).sids || []).every(sid => { const l = inB(store["samples/" + sid]); return !l || l.q !== "pending"; }));
  await page.waitForTimeout(400);
  return batchDoc(id).qc;
}
async function runBatch(page, prof, sids, valueOf, over){ const id = await createBatch(page, prof, sids); await fillBatch(page, id, valueOf, over); await saveBatch(page, id); return id; }
/* v18: attaches a results file the way a technician does (the button opens the file picker); returns the preview's text. */
async function attachFile(page, scope, name, data){
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const [fc] = await Promise.all([page.waitForEvent("filechooser", { timeout: 5000 }), page.click(`[data-attach="${scope}"]`)]);
  await fc.setFiles({ name, mimeType: /\.xlsx?$/.test(name) ? "application/vnd.ms-excel" : "text/csv", buffer });
  await page.waitForSelector("#upBox .modal-card", { timeout: 5000 }); await page.waitForTimeout(300);
  return (await page.textContent("#upBox")).replace(/\s+/g, " ");
}
async function saveAttach(page){ await page.click("#upSave"); await page.waitForSelector("#upBox", { state: "detached", timeout: 15000 }); await page.waitForTimeout(600); }
module.exports = { attachFile, saveAttach, openTyping, tab, cfgTab, batchDoc, waitFor, createBatch, fillBatch, saveBatch, runBatch, toasts, FILE, store, leases, pages, errors, stats, clone, broadcast, newUser, launch, T, visibleTabs, signIn, fillForm, ids, open, doc, ledger, toastText, localStr };
