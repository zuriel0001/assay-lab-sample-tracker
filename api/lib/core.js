// The API behind the page: who is signed in, and what each person may read and write.
// The page keeps the prototype's workflow rules; this server decides who sees what and who may change what.
const { validWhere, clone, same } = require("./docutil");
const { createAuth, requestKey, clientIp } = require("./auth");

const COLLS = ["samples", "ledger", "batches", "stock", "tagidx", "meta", "settings", "access"];
const WRITERS = ["tech", "super", "admin"], STAFF = [...WRITERS, "viewer"], APPROVERS = ["super", "admin"];
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
/* A short, safe description of an unexpected error (a database status and its first line, without addresses), so the page
   can say what went wrong instead of only "Server error". */
function errorDetail(e){
  if (!e) return "";
  const st = [e.statusCode || (typeof e.code === "number" ? e.code : ""), e.substatus ? "/" + e.substatus : "", e.body && typeof e.body.code === "string" ? " " + e.body.code : typeof e.code === "string" ? " " + e.code : ""].join("").trim();
  let m = String((e.body && e.body.message) || e.message || (typeof e === "string" ? e : "") || "");
  const inner = m.match(/"Errors":\s*\["((?:[^"\\]|\\.)*)"/);
  m = (inner ? inner[1] : m.split(/\r?\n/)[0]).replace(/^Message:\s*/, "").replace(/https?:\/\/\S+/g, "").replace(/ActivityId:.*$/i, "").replace(/[{}"]/g, "").trim();
  return [st, m].filter(Boolean).join(": ").slice(0, 140);
}
/* The API answers this site's own page: a JSON POST from the same origin. That keeps another website from making a signed-in
   person's browser send changes (a form post can't carry JSON, and browsers mark where a request came from). */
function requestProblem(headers){
  const h = k => (headers && (headers[k] || headers[k.toUpperCase()])) || "";
  if (!/^application\/json\b/i.test(String(h("content-type")))) return "The API takes JSON.";
  const site = String(h("sec-fetch-site"));
  if (site && site !== "same-origin") return "Requests must come from this site.";
  return "";
}
/* The company logo in Settings (shown in everyone's header): empty, or a small PNG, JPEG or WebP picture as a data URL, as the
   page makes it. Anything else (another type, a link, a large file) is refused. */
const LOGO_MAX = 90000;
const validLogo = v => v === "" || (typeof v === "string" && v.length <= LOGO_MAX && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(v));
/* Results and certificate contents are hidden from people who may not see them; the certificate number and check code stay visible. */
function redactSample(d){
  if (!d) return d;
  const o = { ...d };
  for (const k of ["results", "resHist", "resAcc", "amend", "acks", "dil"]) delete o[k];
  if (Array.isArray(o.certs)) o.certs = o.certs.map(c => ({ no: c.no, v: c.v, at: c.at, code: c.code, ...(c.amends ? { amends: c.amends } : {}) }));
  return o;
}

/* ---------- Record-keeping rules kept by the server, whatever a page sends ----------
   The page applies the full workflow (step order, QC gates, limits). These rules make sure that even a page someone has
   tampered with can't rewrite the record: history, certificates and ledger movements are only ever added to, every new
   entry names the person actually signed in, and results are released by someone other than the person who entered them. */
const filled = x => typeof x === "string" && x.trim() !== "";
const signedBy = a => e => !!e && e.by === a.u && e.tech === a.name;
const extends_ = (old, now) => Array.isArray(now) && now.length >= old.length && old.every((e, i) => same(e, now[i]));
/* The people who entered the results now on a sample (as the page counts them). */
const entrantsOf = s => {
  const rows = (s && s.results && s.results.rows) || {};
  return [...new Set(Object.values(rows).filter(r => r && !r.calc).map(r => r.by || s.results.by).filter(Boolean))];
};
function sampleRule(a, cur, next){
  const who = signedBy(a);
  const h0 = (cur && cur.history) || [], h1 = next.history;
  if (!extends_(h0, h1)) return "A sample's history can only be added to, never changed.";
  const publicForm = !cur && next.createdBy === "public" && h1.length === 1 && h1[0] && h1[0].by === "public";
  if (!publicForm && h1.slice(h0.length).some(e => !who(e))) return "Each new line in a sample's history must name the person signed in.";
  if (cur && next.stageKey !== cur.stageKey && h1.length === h0.length) return "A sample changes step only with a new line in its history.";

  const c0 = (cur && cur.certs) || [], c1 = next.certs || [];
  if (!extends_(c0, c1)) return "An issued certificate can't be changed or removed.";
  const issued = c1.slice(c0.length);
  for (const c of issued){
    if (!APPROVERS.includes(a.role)) return "Only a lab supervisor or the lab manager can release results.";
    if (!who(c) || c.role !== a.role) return "A certificate must name the person signed in.";
    if (c.amendBy && !(cur && cur.amend && cur.amend.by === c.amendBy.by)) return "An amended certificate needs the amendment that was proposed.";
    const own = c.amendBy ? cur.amend.by === a.u : entrantsOf(cur).includes(a.u);
    if (own && !(a.role === "admin" && filled(c.self))) return "Results are released by someone other than the person who entered them.";
  }

  const r0 = (cur && cur.results && cur.results.rows) || {}, r1 = (next.results && next.results.rows) || {};
  const proposed = issued.some(c => c.amendBy) ? cur.amend.rows || {} : null;
  for (const k of Object.keys(r1)){
    const r = r1[k];
    if (r == null || r.calc || same(r, r0[k]) || (proposed && same(r, proposed[k]))) continue;
    if (r.by !== a.u) return "A result must be entered under the name of the person signed in.";
  }
  if (next.resAcc && !same(next.resAcc, cur && cur.resAcc)){
    if (!APPROVERS.includes(a.role) || !who(next.resAcc)) return "Only a lab supervisor or the lab manager accepts results outside a check, under their own name.";
    if (entrantsOf(cur).includes(a.u) && a.role !== "admin") return "Results outside a check are accepted by someone other than the person who entered them.";
  }
  if (next.amend && !same(next.amend, cur && cur.amend) && !who(next.amend)) return "An amendment must be proposed under the name of the person signed in.";
  const k0 = (cur && cur.acks) || [];
  if ((next.acks || []).some(x => !k0.some(y => same(x, y)) && !who(x))) return "A limit action must be recorded under the name of the person signed in.";
  return "";
}
function batchRule(a, cur, next){
  const who = signedBy(a), q0 = cur && cur.qc, q1 = next.qc;
  const bare = q => q ? { ...q, accepted: null } : null;
  if (q1 && !same(bare(q1), bare(q0)) && !who(q1)) return "Batch results must be saved under the name of the person signed in.";
  const x = q1 && q1.accepted;
  if (x && !same(x, q0 && q0.accepted)){
    if (!APPROVERS.includes(a.role) || !who(x)) return "Only a lab supervisor or the lab manager accepts batch QC, under their own name.";
    if (x.exception && a.role !== "admin") return "Only the lab manager accepts failed QC as an exception.";
    if (q1.by === a.u && a.role !== "admin") return "Batch QC is accepted by someone other than the person who saved its results.";
  }
  return "";
}
/* One ledger document per site day and section; its movements are written once. A mistake is reversed by a new movement. */
function ledgerRule(a, cur, next){
  if (!cur) return "";
  for (const k of ["day", "month", "sec"]) if (cur[k] != null && !same(cur[k], next[k])) return "A ledger day can't be moved.";
  const m0 = cur.m || {}, m1 = next.m || {};
  for (const id of Object.keys(m0)) if (m0[id] != null && !same(m0[id], m1[id])) return "A ledger movement can't be changed or removed once recorded. Reverse it with a new entry.";
  return "";
}
const RULES = { samples: sampleRule, batches: batchRule, ledger: ledgerRule };

function createCore({ store, adminEmails = [], devUsers = null, log = () => {} }){
  const admins = adminEmails.map(x => String(x).trim().toLowerCase()).filter(Boolean);
  let cache = null;
  async function settings(){
    if (cache && Date.now() - cache.at < 3000) return cache.d;
    const d = await store.get("settings/stages");
    cache = { at: Date.now(), d };
    return d;
  }
  const auth = createAuth({ store });
  /* Who sends a request: a Microsoft account (Static Web Apps adds its header), or else this site's own email sign-in. */
  async function principal(headers){
    const p = principalOf(headers);
    return p ? { ...p, via: "microsoft" } : await auth.principal(headers);
  }
  async function account(principal){
    if (!principal) return { signedIn: false, role: null };
    // A personal Microsoft account can arrive as "live.com#name@outlook.com"; the account list holds the plain address.
    const email = String(principal.userDetails || "").trim().toLowerCase().replace(/^live\.com#/, "");
    const via = principal.via === "email" ? "email" : "microsoft";
    if (via === "email" && principal.mustChange) return { signedIn: true, email, via, role: null, mustChange: true };
    const s = await settings();
    const saved = s && Array.isArray(s.users) && s.users.length ? s.users : null;
    const users = saved || devUsers || [];
    // An account is for one way of signing in: an email login (whose address nobody has checked) never takes the role of a
    // Microsoft account with the same address, nor the other way round.
    let a = users.find(x => x && x.em && String(x.em).trim().toLowerCase() === email && (x.via === "email" ? "email" : "microsoft") === via);
    if (!a && devUsers && via === "microsoft") a = users.find(x => x && x.u === email) || devUsers.find(x => x.u === email);   // local testing only: sign in by username
    if (a && a.role) return { signedIn: true, email, via, u: a.u, name: a.name || a.u, role: a.role, sec: a.role === "section" ? a.sec || "" : "" };
    // ADMIN_EMAILS: the first admin. With an email login only until an admin is on the account list.
    if (admins.includes(email) && (via === "microsoft" || !users.some(x => x && x.role === "admin" && x.em)))
      return { signedIn: true, email, via, u: email, name: email, role: "admin", sec: "", bootstrap: true };
    return { signedIn: true, email, via, role: null };
  }
  const isStaff = a => STAFF.includes(a.role), isWriter = a => WRITERS.includes(a.role);

  async function visible(a, path, d){
    const { coll, id } = parsePath(path) || {};
    if (coll === "access") return a.role === "admin" || (a.signedIn && id === requestKey(a.email, a.via)) ? d : undefined;   // the lab manager, and the person asking
    if (!isStaff(a) && !["settings", "samples", "tagidx", "meta"].includes(coll)) return undefined;   // ledger, lab batches, stock records: staff only
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
    if (coll === "access") return a.role === "admin";
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
    if (d.createdBy !== "public" || d.stageKey !== "submitted" || d.open !== true || d.onHand || d.lab !== true || d.sx != null) return "state";
    if (d.recvAt || d.receivedAt || d.recv || d.inMid) return "received";
    for (const k of ["results", "certs", "labs", "lbs", "labBatch", "materials", "ledgerPending", "amend", "acks", "relAt", "closedAt"]) if (d[k] != null && !(Array.isArray(d[k]) && !d[k].length)) return k;
    if (!Array.isArray(d.history) || d.history.length !== 1 || d.history[0].by !== "public") return "history";
    if (!(Math.abs((+d.createdAt || 0) - now) < 15 * 60000)) return "time";
    const ds = id.split("-")[1], day = Date.UTC(+ds.slice(0, 4), +ds.slice(4, 6) - 1, +ds.slice(6, 8)) + 12 * 3600000;
    if (!(Math.abs(day - now) < 36 * 3600000)) return "date";   // the ID carries today's date (in the site's time zone)
    if (JSON.stringify(d).length > 20000) return "size";
    return "";
  }

  async function run(a, op){
    const t = op && op.op;
    if (t === "changes"){
      const since = Math.max(0, +op.since || 0);
      const watch = new Set(Array.isArray(op.watch) ? op.watch.slice(0, 500) : []);
      const seen = new Map((Array.isArray(op.seen) ? op.seen.slice(0, 500) : []).filter(x => Array.isArray(x) && typeof x[0] === "string").map(x => [x[0], +x[1]]));
      const rows = await store.changes(since), out = [];
      for (const r of rows){
        if (seen.get(r.path) === r.u) continue;   // the page already has this change
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
    if (t === "export"){   // the lab manager's backup download: every record, a page at a time
      if (a.role !== "admin") throw fail("permission_denied", "Only the lab manager downloads backups.");
      if (!COLLS.includes(op.coll)) throw fail("bad_request");
      const n = Math.max(1, Math.min(500, op.limit | 0 || 200));
      const docs = await store.page(op.coll, typeof op.after === "string" ? op.after : "", n);
      return { docs, next: docs.length === n ? docs[docs.length - 1].path : null };
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
    if (pp.coll === "access"){
      // The lab manager answers requests. Anyone else signed in without a role may only ask, for their own email; a request
      // gives nothing by itself: roles come only from the staff list in Settings.
      if (a.role === "admin"){
        if (t === "delete") await store.remove(op.path); else if (t === "set") await store.set(op.path, op.data); else await store.update(op.path, op.data);
        return { ok: true };
      }
      if (!a.signedIn || a.role || a.mustChange || t !== "set" || pp.id !== requestKey(a.email, a.via)) throw fail("permission_denied", "Only the lab manager answers access requests.");
      const d = op.data;
      if (Object.keys(d).some(k => !["em", "name", "note", "at", "status", "via"].includes(k)) || d.em !== a.email || d.status !== "pending" ||
          (a.via === "email" ? d.via !== "email" : d.via != null) ||
          typeof d.name !== "string" || !d.name.trim() || d.name.length > 80 || (d.note != null && (typeof d.note !== "string" || d.note.length > 200)) ||
          !(Math.abs((+d.at || 0) - Date.now()) < 15 * 60000)) throw fail("bad_request", "Not a valid access request.");
      await store.set(op.path, d, { check: cur => cur && cur.status === "pending" ? "This request is already with the lab manager." : "" });
      return { ok: true };
    }
    if (pp.coll === "settings"){
      if (a.role !== "admin") throw fail("permission_denied", "Only the lab manager (admin) can change settings.");
      if (t === "set"){
        const users = Array.isArray(op.data.users) ? op.data.users : [];
        if (!users.some(x => x && x.role === "admin") && !admins.length) throw fail("bad_request", "Keep at least one admin account.");
      }
      if (t === "delete") throw fail("permission_denied");
      if (op.data.logo != null && !validLogo(op.data.logo)) throw fail("bad_request", "The company logo must be a PNG, JPEG or WebP picture under 90 KB.");
      if (t === "set") await store.set(op.path, op.data); else await store.update(op.path, op.data);
      cache = null;
      return { ok: true };
    }
    if (isWriter(a)){
      if (t === "delete"){
        if (["samples", "ledger", "stock"].includes(pp.coll)) throw fail("permission_denied", "Samples, their stock records and ledger entries are never deleted.");
        await store.remove(op.path);
        return { ok: true };
      }
      const rule = RULES[pp.coll], check = rule ? (cur, next) => rule(a, cur, next) : null;
      if (t === "set") await store.set(op.path, op.data, { check });
      else await store.update(op.path, op.data, { check });
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
        results.push({ ok: false, error: { code, message: known ? e.message || code : "Server error" + (errorDetail(e) ? " (" + errorDetail(e) + ")" : "") } });
      }
    }
    return { status: 200, body: { now: Date.now(), results } };
  }
  async function handleMe(principal){ return { status: 200, body: await account(principal), cookie: await auth.renewal(principal) }; }
  /* POST /api/auth: sign up, sign in and out, and passwords for email logins (auth.js). */
  async function handleAuth(headers, body){
    return auth.handle(await principal(headers), body || {}, { accountOf: account, ip: clientIp(headers) });
  }
  /* GET /api/health: runs the database steps a public submission takes and says which work. It reads nothing private and
     answers from memory for 30 seconds, so calling it often costs the database nothing. */
  let lastHealth = null;
  async function handleHealth(){
    if (lastHealth && Date.now() - lastHealth.at < 30000) return lastHealth.r;
    const checks = {};
    const step = async (k, fn) => { try { const r = await fn(); checks[k] = r || "ok"; } catch (e){ checks[k] = "failed: " + (errorDetail(e) || "error"); } };
    await step("read", async () => { await store.get("settings/stages"); });
    await step("query", async () => { await store.query("samples", [["tags", "array-contains", "HEALTH CHECK"]], { limit: 1 }); });
    await step("changes", async () => { await store.changes(Date.now() + 3600e3); });
    await step("lease", async () => { const l = await store.acquire("samples/HEALTH-00000000-0000", "health:" + Date.now(), 1000); return l.acquired ? "" : "not acquired"; });
    if (store.probeIds) await step("ids", async () => Object.entries(await store.probeIds()).map(([k, v]) => k + " " + (typeof v === "number" ? v : "failed: " + (errorDetail(v) || "error"))).join(", "));
    const r = { status: 200, body: { store: store.kind, at: new Date().toISOString(), checks } };
    lastHealth = { at: Date.now(), r };
    return r;
  }
  return { handleDb, handleMe, handleAuth, handleHealth, principal, account, _run: run, _auth: auth };
}
/* The session cookie as Azure Functions sets it, and as a Set-Cookie header (local server). */
const sessionCookies = c => [{ name: c.name, value: c.value, path: "/", secure: true, httpOnly: true, sameSite: "Strict", maxAge: c.maxAge, ...(c.maxAge ? {} : { expires: new Date(0) }) }];
const setCookieHeader = c => `${c.name}=${c.value}; Path=/; Max-Age=${c.maxAge}; HttpOnly; Secure; SameSite=Strict`;
module.exports = { createCore, principalOf, redactSample, requestProblem, sessionCookies, setCookieHeader, errorDetail };
