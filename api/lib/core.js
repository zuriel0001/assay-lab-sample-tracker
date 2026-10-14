// The API behind the page: who is signed in, and what each person may read and write.
// The page keeps the prototype's workflow rules; this server decides who sees what and who may change what.
const { validWhere, clone } = require("./docutil");

const COLLS = ["samples", "ledger", "batches", "tagidx", "meta", "settings"];
const WRITERS = ["tech", "super", "admin"], STAFF = [...WRITERS, "viewer"];
const SEG = /^[^\u0000-\u001f/\\?#]{1,200}$/;
const MAX_DOC = 1500000;   // Cosmos DB items are limited to 2 MB

function parsePath(p){
  if (typeof p !== "string") return null;
  const s = p.split("/");
  if (s.length !== 2 || !COLLS.includes(s[0]) || !SEG.test(s[1])) return null;
  return { coll: s[0], id: s[1] };
}
function principalOf(headers){
  const h = headers && (headers["x-ms-client-principal"] || headers["X-MS-CLIENT-PRINCIPAL"]);
  if (!h) return null;
  try { const p = JSON.parse(Buffer.from(h, "base64").toString("utf8")); return p && p.userId && p.userDetails ? p : null; } catch { return null; }
}
const fail = (code, msg) => ({ code, message: msg || code });
/* Results and certificate contents are hidden from people who may not see them; the certificate number and check code stay visible. */
function redactSample(d){
  if (!d) return d;
  const o = { ...d };
  for (const k of ["results", "resHist", "resAcc", "amend", "acks", "dil"]) delete o[k];
  if (Array.isArray(o.certs)) o.certs = o.certs.map(c => ({ no: c.no, v: c.v, at: c.at, code: c.code, ...(c.amends ? { amends: c.amends } : {}) }));
  return o;
}

function createCore({ store, adminEmails = [], devUsers = null, log = () => {} }){
  const admins = adminEmails.map(x => String(x).trim().toLowerCase()).filter(Boolean);
  let cache = null;
  async function settings(){
    if (cache && Date.now() - cache.at < 3000) return cache.d;
    const d = await store.get("settings/stages");
    cache = { at: Date.now(), d };
    return d;
  }
  async function account(principal){
    if (!principal) return { signedIn: false, role: null };
    const email = String(principal.userDetails || "").trim().toLowerCase();
    const s = await settings();
    const saved = s && Array.isArray(s.users) && s.users.length ? s.users : null;
    const users = saved || devUsers || [];
    let a = users.find(x => x && x.em && String(x.em).trim().toLowerCase() === email);
    if (!a && devUsers) a = users.find(x => x && x.u === email) || devUsers.find(x => x.u === email);   // local testing only: sign in by username
    if (a && a.role) return { signedIn: true, email, u: a.u, name: a.name || a.u, role: a.role, sec: a.role === "section" ? a.sec || "" : "" };
    if (admins.includes(email)) return { signedIn: true, email, u: email, name: email, role: "admin", sec: "", bootstrap: true };
    return { signedIn: true, email, role: null };
  }
  const isStaff = a => STAFF.includes(a.role), isWriter = a => WRITERS.includes(a.role);

  async function visible(a, path, d){
    const { coll } = parsePath(path) || {};
    if (!isStaff(a) && !["settings", "samples", "tagidx", "meta"].includes(coll)) return undefined;   // ledger and lab batches: staff only
    if (d == null) return d;
    if (coll === "settings"){
      if (a.role === "admin") return d;
      return { ...d, users: isStaff(a) ? (d.users || []).map(x => ({ u: x.u, name: x.name, role: x.role, ...(x.sec ? { sec: x.sec } : {}) })) : [] };
    }
    if (isStaff(a)) return d;
    if (coll === "samples"){
      if (a.role === "section" && d.section === a.sec) return d;
      const s = await settings();
      return s && s.resultsPublic ? d : redactSample(d);
    }
    if (coll === "tagidx" || coll === "meta") return d;
    return undefined;   // not readable
  }
  /* People who are not lab staff may look a sample up by its tag or site reference, and a section account may list its own section. */
  function queryAllowed(a, coll, where){
    if (isStaff(a)) return true;
    if (coll !== "samples") return false;
    if (where.some(([f, op]) => (f === "tags" && op === "array-contains") || (f === "siteRefU" && op === "=="))) return true;
    return a.role === "section" && where.some(([f, op, v]) => f === "section" && op === "==" && v === a.sec);
  }

  /* What a person without lab staff rights may write: a new sample through the public form, its ID counter hint and its tag index entries. */
  function checkSubmission(id, d){
    const now = Date.now();
    if (!d || typeof d !== "object") return "empty";
    if (d.id !== id || !/^[A-Z0-9]{1,8}-\d{8}-\d{4}$/.test(id)) return "id";
    if (d.createdBy !== "public" || d.stageKey !== "submitted" || d.open !== true || d.onHand) return "state";
    if (d.recvAt || d.receivedAt || d.recv || d.inMid) return "received";
    for (const k of ["results", "certs", "labs", "lbs", "labBatch", "materials", "ledgerPending", "amend", "acks", "relAt", "closedAt"]) if (d[k] != null && !(Array.isArray(d[k]) && !d[k].length)) return k;
    if (!Array.isArray(d.history) || d.history.length !== 1 || d.history[0].by !== "public") return "history";
    if (!(Math.abs((+d.createdAt || 0) - now) < 15 * 60000)) return "time";
    return "";
  }

  async function run(a, op){
    const t = op && op.op;
    if (t === "changes"){
      const since = Math.max(0, +op.since || 0);
      const watch = new Set(Array.isArray(op.watch) ? op.watch.slice(0, 500) : []);
      const rows = await store.changes(since), out = [];
      for (const r of rows){
        const pp = parsePath(r.path); if (!pp) continue;
        const may = isStaff(a) || watch.has(r.path) || r.path === "settings/stages" ||
          (a.role === "section" && pp.coll === "samples" && r.data && r.data.section === a.sec);
        if (!may) continue;
        const d = await visible(a, r.path, r.data);
        if (d === undefined) continue;
        out.push({ path: r.path, data: d, u: r.u });
      }
      return { changes: out };
    }
    if (t === "query"){
      const coll = op.coll, where = op.where || [];
      if (!COLLS.includes(coll) || !validWhere(where)) throw fail("bad_request");
      const orderBy = Array.isArray(op.orderBy) && /^[A-Za-z_]\w{0,63}$/.test(op.orderBy[0]) ? [op.orderBy[0], op.orderBy[1] === "desc" ? "desc" : "asc"] : null;
      let limit = op.limit ? Math.max(1, Math.min(5000, op.limit | 0)) : 0;
      if (!queryAllowed(a, coll, where)) return { docs: [] };
      if (!isStaff(a) && a.role !== "section") limit = Math.min(limit || 25, 25);
      const rows = await store.query(coll, where, { orderBy, limit });
      const docs = [];
      for (const r of rows){ const d = await visible(a, r.path, r.data); if (d !== undefined) docs.push({ path: r.path, data: d }); }
      return { docs };
    }
    const pp = parsePath(op.path);
    if (!pp) throw fail("bad_request", "bad path");
    if (t === "get"){
      const d = await visible(a, op.path, await store.get(op.path));
      if (d === undefined) throw fail("permission_denied");
      return { data: d };
    }
    if (t === "acquire"){
      const ttl = Math.min(600000, Math.max(1000, +op.ttl || 30000)), holder = String(op.holder || "").slice(0, 100);
      if (!holder) throw fail("bad_request");
      const who = a.u ? a.u + ":" + holder : holder;
      if (!isWriter(a)){
        // The public form leases a new ID before it writes it, then shortens its own lease; it may not lease an existing record.
        const no = { acquired: false, expiresAt: new Date(Date.now() + 1000).toISOString() };
        if (pp.coll !== "samples" || ttl > 5000) return no;
        if (await store.get(op.path)){ const l = await store.peekLease(op.path); if (!l || l.holder !== who) return no; }
      }
      return await store.acquire(op.path, who, ttl);
    }
    if (!["set", "update", "delete"].includes(t)) throw fail("bad_request");
    if (t !== "delete"){
      if (!op.data || typeof op.data !== "object" || Array.isArray(op.data)) throw fail("bad_request");
      if (JSON.stringify(op.data).length > MAX_DOC) throw fail("quota_exceeded");
    }
    if (pp.coll === "settings"){
      if (a.role !== "admin") throw fail("permission_denied", "Only the lab manager (admin) can change settings.");
      if (t === "set"){
        const users = Array.isArray(op.data.users) ? op.data.users : [];
        if (!users.some(x => x && x.role === "admin") && !admins.length) throw fail("bad_request", "Keep at least one admin account.");
      }
      if (t === "delete") throw fail("permission_denied");
      if (t === "set") await store.set(op.path, op.data); else await store.update(op.path, op.data);
      cache = null;
      return { ok: true };
    }
    if (isWriter(a)){
      if (t === "set") await store.set(op.path, op.data);
      else if (t === "update") await store.update(op.path, op.data);
      else await store.remove(op.path);
      return { ok: true };
    }
    // Everyone else: public submissions only.
    if (t !== "set") throw fail("permission_denied", "Only lab staff can change records.");
    if (pp.coll === "samples"){
      const why = checkSubmission(pp.id, op.data);
      if (why) throw fail("permission_denied", "Not a valid new submission (" + why + ").");
      await store.set(op.path, op.data, { create: true });
      return { ok: true };
    }
    if (pp.coll === "meta" && /^counter-[A-Z0-9]{1,8}-\d{8}$/.test(pp.id)){
      const d = op.data;
      if (!(Number.isInteger(d.last) && d.last > 0 && d.last < 10000) || Object.keys(d).some(k => !["last", "day", "section"].includes(k))) throw fail("bad_request");
      const cur = await store.get(op.path);
      if (cur && +cur.last >= d.last) return { ok: true };
      await store.set(op.path, d);
      return { ok: true };
    }
    if (pp.coll === "tagidx"){
      const d = op.data, s = d && typeof d.sid === "string" && parsePath("samples/" + d.sid) ? await store.get("samples/" + d.sid) : null;
      if (!s || s.createdBy !== "public" || !(Date.now() - (+s.createdAt || 0) < 15 * 60000) || !(s.tags || []).includes(d.tag) || Object.keys(d).some(k => !["sid", "tag", "at"].includes(k))) throw fail("permission_denied");
      await store.set(op.path, d);
      return { ok: true };
    }
    throw fail("permission_denied", "Only lab staff can change records.");
  }

  async function handleDb(principal, body){
    const a = await account(principal);
    const ops = body && Array.isArray(body.ops) ? body.ops.slice(0, 50) : null;
    if (!ops) return { status: 400, body: { error: fail("bad_request") } };
    const results = [];
    for (const op of ops){
      try { results.push({ ok: true, ...(await run(a, op)) }); }
      catch (e){
        const known = e && typeof e.code === "string" && !e.stack;
        if (!known) log("db op failed", op && op.op, op && (op.path || op.coll), e && (e.stack || e.message || e));
        const code = known ? e.code : "server";
        results.push({ ok: false, error: { code, message: known ? e.message || code : "Server error" } });
      }
    }
    return { status: 200, body: { now: Date.now(), results } };
  }
  async function handleMe(principal){ return { status: 200, body: await account(principal) }; }
  return { handleDb, handleMe, account, _run: run };
}
module.exports = { createCore, principalOf, redactSample };
