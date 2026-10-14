/* Connects the MET Lab Sample Tracker page to its Azure API.
   The page was written for a small shared-database interface (collections, documents, where-filters, live snapshots, short leases).
   This file provides that interface over /api/db, and live updates by asking the server for changes every few seconds.
   It also provides the signed-in person (/api/me, from the Microsoft sign-in) and file downloads. */
(() => {
"use strict";
const POLL_MS = window.__POLL_MS || 2500, POLL_HIDDEN_MS = window.__POLL_MS || 15000, OVERLAP_MS = 15000;   // tests set __POLL_MS lower
const clone = o => o == null ? o : JSON.parse(JSON.stringify(o));
const freeze = o => { if (o && typeof o === "object"){ Object.values(o).forEach(freeze); Object.freeze(o); } return o; };
const isMap = x => x && typeof x === "object" && !Array.isArray(x);
const merge = (a, b) => { const o = { ...a }; for (const k in b) o[k] = isMap(b[k]) && isMap(a[k]) ? merge(a[k], b[k]) : b[k]; return o; };
const ok = (d, [f, op, v]) => {
  const x = d ? d[f] : undefined; if (x === undefined) return false;
  switch (op){
    case "==": return x === v; case "!=": return x !== v; case "<": return x < v; case "<=": return x <= v; case ">": return x > v; case ">=": return x >= v;
    case "in": return v.includes(x); case "not-in": return !v.includes(x); case "array-contains": return Array.isArray(x) && x.includes(v);
  }
  return false;
};
const report = e => { try { console.error(e); } catch {} };

/* ---------- requests: operations issued together go to the server in one request ---------- */
let queue = [], flushT = null;
function call(op){
  return new Promise((resolve, reject) => {
    queue.push({ op, resolve, reject });
    if (queue.length >= 40) flush(); else if (!flushT) flushT = setTimeout(flush, 0);
  });
}
async function flush(){
  clearTimeout(flushT); flushT = null;
  const batch = queue; queue = [];
  if (!batch.length) return;
  try {
    const r = await fetch("/api/db", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ops: batch.map(b => b.op) }) });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || !Array.isArray(j.results)) throw { code: r.status === 401 || r.status === 403 ? "permission_denied" : "unavailable", message: j && j.error && j.error.message };
    noteNow(j.now);
    batch.forEach((b, i) => { const x = j.results[i]; if (x && x.ok) b.resolve(x); else b.reject(x ? x.error : { code: "unavailable" }); });
  } catch (e){
    const err = e && e.code ? e : { code: "unavailable" };
    batch.forEach(b => b.reject(err));
  }
}
let serverNow = 0;
const noteNow = n => { if (n > serverNow) serverNow = n; };

/* ---------- live snapshots ---------- */
const cache = new Map();          // path -> last data this page was given (null = absent)
const docSubs = new Set(), querySubs = new Set();
let fromCache = false;
const md = () => ({ fromCache, hasPendingWrites: false });
const docSnap = (path, d) => ({ id: path.split("/").pop(), ref: docRef(path), exists: d != null, data: () => d == null ? undefined : freeze(clone(d)), metadata: md() });
function querySnap(sub){
  let rows = [...sub.docs.entries()].sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  if (sub.q.ob){ const [f, dir] = sub.q.ob; rows.sort((a, b) => ((a[1][f] > b[1][f]) - (a[1][f] < b[1][f])) * (dir === "desc" ? -1 : 1)); }
  if (sub.q.lim) rows = rows.slice(0, sub.q.lim);
  const docs = rows.map(([p, d]) => docSnap(p, d));
  return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: md() };
}
const fire = (sub, snap) => { if (sub.live) try { sub.cb(snap); } catch (e){ report(e); } };
/* A document changed (from the server or from this page's own write): tell every listener it concerns. */
async function apply(path, d){
  const before = cache.has(path) ? JSON.stringify(cache.get(path)) : undefined, after = JSON.stringify(d == null ? null : d);
  if (before === after) return;
  const prev = before !== undefined ? JSON.parse(before) : undefined;
  cache.set(path, d == null ? null : d);
  if (path === "settings/stages" && before !== undefined){
    await refreshMe();
    // Results opened to (or closed from) the public: read the records again before the page renders with the new setting.
    if (!!(prev && prev.resultsPublic) !== !!(d && d.resultsPublic)) await rereadAll();
  }
  const coll = path.slice(0, path.lastIndexOf("/"));
  for (const s of docSubs) if (s.path === path && s.ready) fire(s, docSnap(path, d));
  for (const s of querySubs){
    if (s.coll !== coll || !s.ready) continue;
    const had = s.docs.has(path), hit = d != null && s.q.w.every(c => ok(d, c));
    if (!had && !hit) continue;
    if (s.q.lim && !hit && had){ s.docs.delete(path); requery(s); continue; }   // something else may now fall inside the limit
    if (hit) s.docs.set(path, d); else s.docs.delete(path);
    fire(s, querySnap(s));
  }
}
function requery(s){
  clearTimeout(s.rq);
  s.rq = setTimeout(async () => {
    try { const r = await call({ op: "query", coll: s.coll, where: s.q.w, orderBy: s.q.ob, limit: s.q.lim }); s.docs = new Map(r.docs.map(x => [x.path, x.data])); r.docs.forEach(x => cache.set(x.path, x.data)); fire(s, querySnap(s)); }
    catch {}
  }, 120);
}
/* Reads every open list and record again, for when what this person may see has changed. */
async function rereadAll(){
  await Promise.all([
    ...[...querySubs].filter(s => s.ready).map(s => call({ op: "query", coll: s.coll, where: s.q.w, orderBy: s.q.ob, limit: s.q.lim }).then(r => {
      s.docs = new Map(r.docs.map(x => [x.path, x.data])); r.docs.forEach(x => cache.set(x.path, x.data)); fire(s, querySnap(s));
    }, () => {})),
    ...[...new Set([...docSubs].filter(s => s.ready).map(s => s.path))].map(p => call({ op: "get", path: p }).then(r => apply(p, r.data), () => {}))
  ]);
}
let since = null, polling = false, pollT = null;
const recent = new Map();   // path -> change stamp already received inside the overlap window, so the server sends each change once
async function poll(){
  if (polling) return;
  polling = true; clearTimeout(pollT);
  try {
    const watch = [...new Set([...docSubs].map(s => s.path))];
    const from = Math.max(0, since != null ? since : serverNow ? serverNow - OVERLAP_MS : Date.now() - 60000);
    const seen = [...recent].filter(([, u]) => u > from).slice(-400);
    const r = await call({ op: "changes", since: from, watch, seen });
    since = Math.max(0, serverNow - OVERLAP_MS);
    for (const c of r.changes.sort((a, b) => a.u - b.u)){ recent.set(c.path, c.u); await apply(c.path, c.data); }
    for (const [p, u] of recent) if (u <= since) recent.delete(p);
    if (fromCache){ fromCache = false; for (const s of querySubs) if (s.ready) fire(s, querySnap(s)); }
  } catch {
    if (!fromCache){ fromCache = true; for (const s of querySubs) if (s.ready) fire(s, querySnap(s)); }
  } finally {
    polling = false;
    pollT = setTimeout(poll, document.hidden ? POLL_HIDDEN_MS : POLL_MS);
  }
}
const pollSoon = () => { clearTimeout(pollT); pollT = setTimeout(poll, 150); };
window.__pollNow = pollSoon;
document.addEventListener("visibilitychange", () => { if (!document.hidden) pollSoon(); });
/* Now and then the open lists are read again in full, as a safety net. Changes are not missed while offline (polling resumes
   from the last change it saw), so this is rare: a full read of the board is the largest download the page makes.
   It happens every 4 hours on a page left open, or when a page comes back after an hour or more in the background. */
let lastFull = Date.now(), hiddenAt = 0;
const readListsAgain = () => { lastFull = Date.now(); querySubs.forEach(s => s.ready && requery(s)); };
setInterval(() => { if (!document.hidden && Date.now() - lastFull > 4 * 3600000) readListsAgain(); }, 5 * 60000);
document.addEventListener("visibilitychange", () => {
  if (document.hidden){ hiddenAt = Date.now(); return; }
  if (hiddenAt && Date.now() - hiddenAt > 3600000) readListsAgain();
});

/* ---------- documents and collections ---------- */
function docRef(path){
  const ref = {
    id: path.split("/").pop(), path,
    async get(){ const r = await call({ op: "get", path }); cache.set(path, r.data == null ? null : r.data); return docSnap(path, r.data); },
    async set(d){ await call({ op: "set", path, data: d }); await apply(path, clone(d)); pollSoon(); },
    async update(d){
      await call({ op: "update", path, data: d });
      const cur = cache.get(path); if (cur) await apply(path, merge(cur, clone(d)));
      pollSoon();
    },
    async delete(){ await call({ op: "delete", path }); await apply(path, null); pollSoon(); },
    async acquire(o){
      const r = await call({ op: "acquire", path, holder: o && o.holder, ttl: o && o.ttlMs });
      return { acquired: !!r.acquired, holder: r.holder, expiresAt: r.expiresAt };
    },
    onSnapshot(cb, onErr){
      const s = { path, cb, live: true, ready: false };
      docSubs.add(s);
      ref.get().then(snap => { s.ready = true; fire(s, snap); }, e => { if (s.live && onErr) try { onErr(e); } catch {} });
      pollSoon();
      return () => { s.live = false; docSubs.delete(s); };
    },
    collection(){ throw new Error("Sub-collections are not used by this app"); }
  };
  return ref;
}
function colRef(coll, q = { w: [] }){
  return {
    path: coll,
    doc: id => docRef(coll + "/" + (id || Math.random().toString(36).slice(2) + Date.now().toString(36))),
    where: (f, op, v) => colRef(coll, { ...q, w: [...q.w, [f, op, v]] }),
    orderBy: (f, d) => colRef(coll, { ...q, ob: [f, d || "asc"] }),
    limit: k => colRef(coll, { ...q, lim: k }),
    async get(){
      const r = await call({ op: "query", coll, where: q.w, orderBy: q.ob, limit: q.lim });
      r.docs.forEach(x => cache.set(x.path, x.data));
      const sub = { q, docs: new Map(r.docs.map(x => [x.path, x.data])) };
      return querySnap(sub);
    },
    onSnapshot(cb, onErr){
      const s = { coll, q, cb, live: true, ready: false, docs: new Map() };
      querySubs.add(s);
      call({ op: "query", coll, where: q.w, orderBy: q.ob, limit: q.lim }).then(r => {
        s.docs = new Map(r.docs.map(x => [x.path, x.data])); r.docs.forEach(x => cache.set(x.path, x.data));
        s.ready = true; fire(s, querySnap(s));
      }, e => { if (s.live && onErr) try { onErr(e); } catch {} });
      pollSoon();
      return () => { s.live = false; querySubs.delete(s); clearTimeout(s.rq); };
    }
  };
}
const db = { doc: docRef, collection: p => colRef(p) };

/* ---------- the signed-in person ---------- */
async function fetchMe(){
  try { const r = await fetch("/api/me", { credentials: "same-origin", cache: "no-store" }); if (r.ok) return await r.json(); } catch {}
  return window.__me || { signedIn: false, role: null };
}
async function refreshMe(){
  const m = await fetchMe(), changed = JSON.stringify(m) !== JSON.stringify(window.__me);
  const roleChanged = changed && (m.role !== window.__me?.role || m.sec !== window.__me?.sec);
  window.__me = m;
  if (roleChanged) await rereadAll();   // what this person may read has changed
  if (changed && window.__resession) try { window.__resession(); } catch (e){ report(e); }
  return m;
}
window.__refreshMe = refreshMe;
setInterval(refreshMe, 2 * 60000);   // a sign-in that has expired is noticed within two minutes
const nameOf = id => { const s = cache.get("settings/stages"); const u = s && (s.users || []).find(x => x.u === id); return u ? u.name : ""; };
const user = {
  me: async () => ({ id: window.__me?.u || "", name: window.__me?.name || "" }),
  id: async () => window.__me?.u || "",
  can: async () => true,            // the server decides what each person may change
  canEdit: async () => false, isOwner: async () => false,
  profiles: async ids => Object.fromEntries([].concat(ids).map(i => [i, { id: i, name: nameOf(i) }]))
};

/* ---------- downloads ---------- */
const downloads = {
  async save(o){
    window.__downloaded = o;
    const blob = o.data instanceof Blob ? o.data : new Blob([o.data], { type: o.mimeType || o.type || (/\.csv$/i.test(o.filename) ? "text/csv" : /\.html?$/i.test(o.filename) ? "text/html" : "application/octet-stream") });
    const a = document.createElement("a"), url = URL.createObjectURL(blob);
    a.href = url; a.download = o.filename || "download"; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
};

window.claude = { use: async n => n === "db" ? db : n === "user" ? user : n === "downloads" ? downloads : null };

/* The lab manager's backup: every record of every collection, as one JSON file. Returns how many records it holds. */
window.__backup = async () => {
  const out = {}; let n = 0;
  for (const coll of ["settings", "samples", "batches", "ledger", "tagidx", "meta"]){
    out[coll] = {};
    for (let after = ""; after != null; ){
      const r = await call({ op: "export", coll, after, limit: 200 });
      r.docs.forEach(x => { out[coll][x.path.slice(coll.length + 1)] = x.data; n++; });
      after = r.next;
    }
  }
  const at = new Date();
  await downloads.save({ filename: `met-lab-backup-${at.toISOString().slice(0, 10)}.json`, mimeType: "application/json",
    data: JSON.stringify({ app: "MET Lab Sample Tracker", site: location.host, exportedAt: at.toISOString(), records: n, collections: out }) });
  return n;
};

/* The page starts once the signed-in person is known, so it opens on the right tab. */
const meReady = fetchMe().then(m => { window.__me = m; });
const domReady = document.readyState === "loading" ? new Promise(r => document.addEventListener("DOMContentLoaded", r, { once: true })) : Promise.resolve();
Promise.all([meReady, domReady]).then(() => { if (window.__startApp) window.__startApp(); poll(); });
})();
