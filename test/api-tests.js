// Permission and data tests for the API core (no browser). node test/api-tests.js
const path = require("path");
const { createCore, redactSample } = require("../api/lib/core");
const { createMemoryStore } = require("../api/lib/store-memory");
const { DEV_USERS } = require("../dev/server");
let pass = 0, fail = 0;
const check = (ok, msg) => { if (ok){ pass++; console.log("PASS", msg); } else { fail++; console.log("FAIL", msg); } };
const P = who => who ? { identityProvider: "aad", userId: "id-" + who, userDetails: who, userRoles: ["authenticated"] } : null;

(async () => {
  const mem = createMemoryStore();
  const core = createCore({ store: mem, adminEmails: ["boss@site.com"] });
  const db = async (who, ...ops) => (await core.handleDb(P(who), { ops })).body.results;
  const one = async (who, op) => (await db(who, op))[0];
  const now = Date.now(), day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const sub = (id, extra = {}) => ({ id, v: 13, section: id.split("-")[0], stageKey: "submitted", open: true, onHand: false, lab: true, createdBy: "public", createdAt: now, recvAt: null, receivedAt: null, recv: null,
    tags: ["T-1"], history: [{ key: "submitted", at: now, by: "public", name: "J" }], ...extra });

  // Bootstrap: before Settings are saved, only ADMIN_EMAILS can sign in, as admin.
  check((await core.account(P("boss@site.com"))).role === "admin", "ADMIN_EMAILS account is admin before settings exist");
  check((await core.account(P("someone@site.com"))).role === null, "any other Microsoft account has no role");
  check((await core.account(null)).signedIn === false, "anonymous is not signed in");

  // Public submission.
  const id = `EXP-${day}-0001`;
  check((await one(null, { op: "acquire", path: "samples/" + id, holder: "tabA", ttl: 4000 })).acquired, "public may lease a new sample ID");
  check((await one(null, { op: "set", path: "samples/" + id, data: sub(id) })).ok, "public may submit a new sample");
  check(!(await one(null, { op: "set", path: "samples/" + id, data: sub(id) })).ok, "public can't overwrite an existing sample");
  check(!(await one(null, { op: "acquire", path: "samples/" + id, holder: "x", ttl: 4000 })).acquired, "public can't lease an existing sample");
  check((await one(null, { op: "acquire", path: "samples/" + id, holder: "tabA", ttl: 1000 })).acquired, "the submitter's page shortens its own lease after writing");
  check(!(await one(null, { op: "update", path: "samples/" + id, data: { stageKey: "released" } })).ok, "public can't update a sample");
  check(!(await one(null, { op: "set", path: `EXP-${day}-0002`.replace(/^/, "samples/"), data: sub(`EXP-${day}-0002`, { stageKey: "received", recvAt: now }) })).ok, "public can't submit an already received sample");
  check(!(await one(null, { op: "set", path: "samples/EXP-1", data: sub("EXP-1") })).ok, "public can't use a malformed ID");
  check(!(await one(null, { op: "set", path: `samples/EXP-${day}-0003`, data: sub(`EXP-${day}-0003`, { results: { rows: {} } }) })).ok, "public can't submit results");
  check(!(await one(null, { op: "set", path: `samples/EXP-${day}-0004`, data: sub(`EXP-${day}-0004`, { createdAt: now - 3600e3 }) })).ok, "public can't backdate a submission");
  check((await one(null, { op: "set", path: "tagidx/T-1", data: { sid: id, tag: "T-1", at: now } })).ok, "public may index the tag of its new sample");
  check(!(await one(null, { op: "set", path: "tagidx/T-2", data: { sid: id, tag: "T-2", at: now } })).ok, "public can't index a tag the sample doesn't carry");
  check((await one(null, { op: "set", path: `meta/counter-EXP-${day}`, data: { last: 1, day, section: "EXP" } })).ok, "public may advance the ID counter hint");
  check(!(await one(null, { op: "set", path: "meta/schema", data: { v: 99 } })).ok, "public can't write other meta records");
  check(!(await one(null, { op: "set", path: "ledger/2026-10-14_EXP", data: { m: {} } })).ok, "public can't write the ledger");
  check(!(await one(null, { op: "delete", path: "samples/" + id })).ok, "public can't delete");

  // Reads.
  await mem.update("samples/" + id, { results: { rows: { Au: { v: 1.2 } } }, certs: [{ no: id + "-R1", v: 1, at: now, code: "ABC", rows: { Au: { v: 1.2 } } }], amend: { x: 1 } });
  const pub = (await one(null, { op: "get", path: "samples/" + id })).data;
  check(pub && !pub.results && !pub.amend && pub.certs[0].no === id + "-R1" && pub.certs[0].code === "ABC" && !pub.certs[0].rows, "public lookup hides results but shows certificate number and check code");
  check((await one(null, { op: "query", coll: "samples", where: [["open", "==", true]] })).docs.length === 0, "public can't list open samples");
  const byTag = (await one(null, { op: "query", coll: "samples", where: [["tags", "array-contains", "T-1"]], limit: 100 })).docs;
  check(byTag.length === 1 && !byTag[0].data.results, "public tag lookup finds the sample, without results");
  check(!(await one(null, { op: "get", path: "ledger/2026-10-14_EXP" })).ok, "public can't read the ledger");
  check(!(await one(null, { op: "get", path: "batches/B1" })).ok, "public can't read lab batches");

  // Settings: admin only, emails hidden from non-admins.
  const users = [{ u: "mgr", name: "Manager", role: "admin", em: "boss@site.com" }, { u: "t1", name: "Tech One", role: "tech", em: "T1@Site.com" },
    { u: "v", name: "Viewer", role: "viewer", em: "v@site.com" }, { u: "exp", name: "EXP results", role: "section", sec: "EXP", em: "exp@site.com" },
    { u: "s1", name: "Super One", role: "super", em: "s1@site.com" }];
  check(!(await one("t1@site.com", { op: "set", path: "settings/stages", data: { users } })).ok, "a non-admin can't save settings");
  check((await one("boss@site.com", { op: "set", path: "settings/stages", data: { schema: 12, users, resultsPublic: false } })).ok, "the bootstrap admin saves settings");
  await new Promise(r => setTimeout(r, 3100));   // settings cache
  const t1 = await core.account(P("t1@site.com"));
  check(t1.role === "tech" && t1.u === "t1" && t1.name === "Tech One", "accounts are matched by Microsoft email, case-insensitively");
  check((await core.account(P("t1"))).role === null, "on Azure, a username is not a sign-in (dev only)");
  const asTech = (await one("t1@site.com", { op: "get", path: "settings/stages" })).data;
  check(asTech.users.length === 5 && asTech.users.every(x => !x.em), "staff see names and roles but not sign-in emails");
  check((await one(null, { op: "get", path: "settings/stages" })).data.users.length === 0, "the public sees no accounts");
  check((await one("boss@site.com", { op: "get", path: "settings/stages" })).data.users[1].em === "T1@Site.com", "admin sees the emails to edit them");
  { const m2 = createMemoryStore(); await m2.set("settings/stages", { users }); const c2 = createCore({ store: m2, adminEmails: [] });
    const r = (await c2.handleDb(P("boss@site.com"), { ops: [{ op: "set", path: "settings/stages", data: { users: users.filter(x => x.role !== "admin") } }] })).body.results[0];
    check(!r.ok, "without ADMIN_EMAILS, settings can't be saved with no admin left"); }

  // Staff and section accounts.
  check((await one("t1@site.com", { op: "update", path: "samples/" + id, data: { stageKey: "received", recvAt: now, history: [...sub(id).history, { key: "received", at: now, by: "t1", tech: "Tech One" }] } })).ok, "a technician updates a sample");
  check((await one("t1@site.com", { op: "set", path: "ledger/2026-10-14_EXP", data: { m: {} } })).ok, "a technician writes the ledger");
  check(!(await one("v@site.com", { op: "update", path: "samples/" + id, data: { flag: "x" } })).ok, "a viewer can't change a sample");
  check((await one("v@site.com", { op: "get", path: "ledger/2026-10-14_EXP" })).ok, "a viewer reads the ledger");
  check((await one("v@site.com", { op: "get", path: "samples/" + id })).data.results, "a viewer sees results");
  check((await one("exp@site.com", { op: "get", path: "samples/" + id })).data.results, "a section account sees its own section's results");
  const own = (await one("exp@site.com", { op: "query", coll: "samples", where: [["section", "==", "EXP"]] })).docs;
  check(own.length === 1, "a section account lists its own section");
  check((await one("exp@site.com", { op: "query", coll: "samples", where: [["section", "==", "PLT"]] })).docs.length === 0, "a section account can't list another section");
  const pid = `PLT-${day}-0001`; await mem.set("samples/" + pid, { ...sub(pid), results: { rows: { Au: 1 } } });
  check(!(await one("exp@site.com", { op: "get", path: "samples/" + pid })).data.results, "a section account doesn't see another section's results");

  // Live changes: staff get everything; the public only what it watches.
  const t0 = Date.now() - 1;
  await mem.update("samples/" + pid, { flag: "late" });
  const chStaff = (await one("t1@site.com", { op: "changes", since: t0 })).changes;
  const chPub = (await one(null, { op: "changes", since: t0, watch: [] })).changes;
  const chPubW = (await one(null, { op: "changes", since: t0, watch: ["samples/" + pid] })).changes;
  check(chStaff.some(c => c.path === "samples/" + pid), "staff receive changes to any sample");
  check(!chPub.length, "the public receives no changes it didn't ask for");
  check(chPubW.length === 1 && !chPubW[0].data.results, "the public receives changes to a sample it is looking at, without results");
  const u1 = chStaff.find(c => c.path === "samples/" + pid).u;
  check(!(await one("t1@site.com", { op: "changes", since: t0, seen: [["samples/" + pid, u1]] })).changes.some(c => c.path === "samples/" + pid), "a change the page already has is not sent again");

  // Record-keeping rules the server keeps whatever a page sends.
  const T1 = { by: "t1", tech: "Tech One" }, S1 = { by: "s1", tech: "Super One" }, MG = { by: "mgr", tech: "Manager" };
  const rid = `EXP-${day}-0009`, rp = "samples/" + rid, h1 = { key: "received", at: now, ...T1 }, h2 = { key: "prep", at: now + 1, ...T1 };
  check((await one("t1@site.com", { op: "set", path: rp, data: { id: rid, section: "EXP", history: [h1] } })).ok, "a technician registers a sample under their own name");
  check(!(await one("t1@site.com", { op: "set", path: `samples/EXP-${day}-0010`, data: { id: `EXP-${day}-0010`, history: [{ ...h1, ...S1 }] } })).ok, "a technician can't register a sample in someone else's name");
  check((await one("t1@site.com", { op: "update", path: rp, data: { history: [h1, h2] } })).ok, "a history line is added under the signed-in name");
  check(!(await one("t1@site.com", { op: "update", path: rp, data: { history: [h1, h2, { key: "x", at: now + 2, ...S1 }] } })).ok, "a history line naming someone else is refused");
  check(!(await one("boss@site.com", { op: "update", path: rp, data: { history: [{ ...h1, note: "edited" }, h2] } })).ok, "an earlier history line can't be edited, even by the admin");
  check(!(await one("boss@site.com", { op: "update", path: rp, data: { history: [h1] } })).ok, "history lines can't be removed");
  check(!(await one("boss@site.com", { op: "delete", path: rp })).ok, "samples are never deleted, even by the admin");
  check(!(await one("t1@site.com", { op: "update", path: rp, data: { stageKey: "qc" } })).ok, "a sample can't change step without a history line");
  check((await one("t1@site.com", { op: "update", path: rp, data: { results: { by: "t1", rows: { Au: { v: 1.2, raw: "1.2", by: "t1" } } } } })).ok, "a technician enters results under their own name");
  check(!(await one("s1@site.com", { op: "update", path: rp, data: { results: { rows: { Au: { v: 9, raw: "9", by: "t1" } } } } })).ok, "results can't be typed in someone else's name");
  const cert = (who, role, x = {}) => ({ no: rid + "-R1", v: 1, at: now, ...who, role, ...x });
  check(!(await one("t1@site.com", { op: "update", path: rp, data: { certs: [cert(T1, "tech")] } })).ok, "a technician can't release results");
  check(!(await one("s1@site.com", { op: "update", path: rp, data: { certs: [cert(T1, "super")] } })).ok, "a certificate must name the person releasing it");
  check((await one("s1@site.com", { op: "update", path: rp, data: { certs: [cert(S1, "super")] } })).ok, "a supervisor releases results someone else entered");
  check(!(await one("s1@site.com", { op: "update", path: rp, data: { certs: [cert(S1, "super", { at: 1 })] } })).ok, "an issued certificate can't be changed");
  const r2 = `EXP-${day}-0011`, p2 = "samples/" + r2;
  await mem.set(p2, { id: r2, section: "EXP", history: [], results: { by: "s1", rows: { Au: { v: 2, raw: "2", by: "s1" } } } });
  check(!(await one("s1@site.com", { op: "update", path: p2, data: { certs: [{ ...cert(S1, "super"), no: r2 + "-R1" }] } })).ok, "four eyes: a supervisor can't release results they entered");
  await mem.update(p2, { results: { by: "mgr", rows: { Au: { v: 3, raw: "3", by: "mgr" } } } });
  check(!(await one("boss@site.com", { op: "update", path: p2, data: { certs: [{ ...cert(MG, "admin"), no: r2 + "-R1" }] } })).ok, "the lab manager can't release their own results without a reason");
  check((await one("boss@site.com", { op: "update", path: p2, data: { certs: [{ ...cert(MG, "admin", { self: "Only analyst on site" }), no: r2 + "-R1" }] } })).ok, "the lab manager may, giving the recorded reason");
  await mem.update(p2, { amend: { of: 1, rows: { Au: { v: 4, raw: "4", by: "s1" } }, why: "typo", ...S1, at: now } });
  check(!(await one("s1@site.com", { op: "update", path: p2, data: { results: { rows: { Au: { v: 4, raw: "4", by: "s1" } } }, amend: null, certs: [{ ...cert(MG, "admin", { self: "x" }), no: r2 + "-R1" }, { ...cert(S1, "super", { amendBy: { by: "s1" } }), no: r2 + "-R2", v: 2 }] } })).ok, "an amendment is approved by someone other than its proposer");

  const bp = "batches/FA-1";
  check((await one("t1@site.com", { op: "set", path: bp, data: { id: "FA-1", qc: { status: "warn", ...T1 } } })).ok, "batch results are saved under the technician's name");
  check(!(await one("t1@site.com", { op: "update", path: bp, data: { qc: { accepted: { ...T1, why: "x" } } } })).ok, "a technician can't accept batch QC");
  check(!(await one("s1@site.com", { op: "update", path: bp, data: { qc: { status: "pass" } } })).ok, "batch results can't be changed in someone else's name");
  check((await one("s1@site.com", { op: "update", path: bp, data: { qc: { accepted: { ...S1, why: "ok" } } } })).ok, "a supervisor accepts another person's batch QC warnings");

  const lp = "ledger/2026-10-14_EXP", mv = { dir: "in", sid: rid, ...T1 };
  check((await one("t1@site.com", { op: "update", path: lp, data: { m: { a: mv } } })).ok, "a ledger movement is recorded");
  check((await one("s1@site.com", { op: "update", path: lp, data: { m: { a: mv } } })).ok, "writing the same movement again (a retry) is fine");
  check(!(await one("boss@site.com", { op: "update", path: lp, data: { m: { a: { ...mv, dir: "out" } } } })).ok, "a recorded ledger movement can't be changed");
  check(!(await one("boss@site.com", { op: "update", path: lp, data: { m: { a: null } } })).ok, "a recorded ledger movement can't be removed");
  check(!(await one("boss@site.com", { op: "set", path: lp, data: { day: "2026-10-14", m: {} } })).ok, "a ledger day can't be wiped by writing it again");
  check(!(await one("boss@site.com", { op: "delete", path: lp })).ok, "ledger days are never deleted");
  const ex1 = await one("boss@site.com", { op: "export", coll: "samples", limit: 2 }), ex2 = await one("boss@site.com", { op: "export", coll: "samples", after: ex1.next, limit: 500 });
  check(ex1.docs.length === 2 && ex1.next === ex1.docs[1].path && ex2.next === null && ex2.docs.length >= 2 && ex2.docs[0].path > ex1.next, "the lab manager exports every record, page by page (backup)");
  check(!(await one("s1@site.com", { op: "export", coll: "samples" })).ok && !(await one(null, { op: "export", coll: "settings" })).ok, "nobody else can export");
  check(!(await one(null, { op: "set", path: "samples/EXP-20200101-0001", data: sub("EXP-20200101-0001") })).ok, "public can't submit under another day's ID");
  check(!(await one(null, { op: "set", path: `samples/EXP-${day}-0012`, data: sub(`EXP-${day}-0012`, { notes: "x".repeat(30000) }) })).ok, "public submissions have a size limit");
  check(!(await one(null, { op: "set", path: `samples/EXP-${day}-0013`, data: sub(`EXP-${day}-0013`, { lab: false }) })).ok, "a public submission can't keep itself off the workflow board");

  // Stock records (v13): one per received sample, for the Storage tab and the ledger's month check. Staff only.
  const sp = "stock/" + rid, stk = { id: rid, sec: "EXP", type: "Pulp", route: "EXP-FA", tag: "T-9", recvAt: now, gone: 9e15, st: "store", due: now + 86400e3, two: false, m: [{ k: "m1", item: "Pulp", loc: "Rack 4", dueAt: now + 86400e3, then: "Disposed" }] };
  check((await one("t1@site.com", { op: "set", path: sp, data: stk })).ok, "a technician writes a stock record");
  check(!(await one(null, { op: "set", path: "stock/" + id, data: { ...stk, id } })).ok && !(await one("v@site.com", { op: "set", path: sp, data: stk })).ok, "the public and viewers can't write stock records");
  check(!(await one(null, { op: "get", path: sp })).ok && !(await one("exp@site.com", { op: "get", path: sp })).ok, "stock records (sample, tag, shelf) are hidden from the public and section accounts");
  check(!(await one(null, { op: "query", coll: "stock", where: [["st", "==", "store"]] })).docs.length && !(await one("exp@site.com", { op: "query", coll: "stock", where: [["sec", "==", "EXP"]] })).docs.length, "nor can they list them");
  check((await one("v@site.com", { op: "query", coll: "stock", where: [["st", "==", "store"], ["due", "<", now + 2 * 86400e3]] })).docs.length === 1, "staff list stored material due soon");
  check((await one("v@site.com", { op: "query", coll: "stock", where: [["recvAt", "<", now + 1], ["gone", ">=", now - 1]] })).docs.length === 1, "the month check finds samples on hand in a month");
  check(!(await one("boss@site.com", { op: "delete", path: sp })).ok, "stock records are never deleted");
  check((await one("boss@site.com", { op: "export", coll: "stock" })).docs.length === 1, "stock records are in the backup");
  check(!(await one("t1@site.com", { op: "query", coll: "nope", where: [] })).ok, "an unknown collection is refused");
  await mem.update(rp, { relAt: now - 5 }); await mem.update(p2, { relAt: now });
  const rel = (await one("exp@site.com", { op: "query", coll: "samples", where: [["section", "==", "EXP"], ["relAt", ">", 0]], orderBy: ["relAt", "desc"], limit: 1 })).docs;
  check(rel.length === 1 && rel[0].path === p2, "a section account lists its newest released samples, newest first");

  // resultsPublic: everyone sees results.
  await mem.update("settings/stages", { resultsPublic: true }); await new Promise(r => setTimeout(r, 3100));
  check((await one(null, { op: "get", path: "samples/" + pid })).data.results, "with 'anyone can see results' set, the public sees them");

  // Leases.
  check((await one("t1@site.com", { op: "acquire", path: "samples/" + id, holder: "a", ttl: 3000 })).acquired, "staff lease a sample");
  check(!(await one("boss@site.com", { op: "acquire", path: "samples/" + id, holder: "b", ttl: 3000 })).acquired, "another holder waits for the lease");
  check((await one("t1@site.com", { op: "acquire", path: "samples/" + id, holder: "a", ttl: 3000 })).acquired, "the holder renews its lease");

  // Bad requests.
  check(!(await one("t1@site.com", { op: "get", path: "../x" })).ok, "bad paths are refused");
  check(!(await one("t1@site.com", { op: "query", coll: "samples", where: [["a b", "==", 1]] })).ok, "bad field names are refused");
  check(!(await one("t1@site.com", { op: "get", path: "secrets/x" })).ok, "unknown collections are refused");
  check(JSON.stringify(redactSample({ id: "x", results: 1 })) === '{"id":"x"}', "redact helper");

  // The Azure Functions entry points, with the in-memory store.
  process.env.STORE = "memory"; process.env.ADMIN_EMAILS = "boss@site.com";
  const fn = require("../api/db/index.js"), me = require("../api/me/index.js");
  const ctx = () => ({ log: Object.assign(() => {}, { error: () => {} }), res: null });
  const hdr = who => ({ "x-ms-client-principal": Buffer.from(JSON.stringify(P(who))).toString("base64") });
  let c = ctx(); await me(c, { headers: hdr("boss@site.com") });
  check(c.res.status === 200 && c.res.body.role === "admin", "Functions entry /api/me reads the Static Web Apps principal header");
  const JS = { "content-type": "application/json" };
  c = ctx(); await fn(c, { headers: JS, body: { ops: [{ op: "get", path: "settings/stages" }] } });
  check(c.res.status === 200 && c.res.body.results[0].ok, "Functions entry /api/db answers");
  c = ctx(); await fn(c, { headers: JS, body: "{\"ops\":[{\"op\":\"get\",\"path\":\"meta/schema\"}]}" });
  check(c.res.status === 200 && c.res.body.results[0].ok, "Functions entry accepts a string body");
  c = ctx(); await fn(c, { headers: { "content-type": "text/plain" }, body: "{\"ops\":[{\"op\":\"get\",\"path\":\"meta/schema\"}]}" });
  check(c.res.status === 403, "a plain-text post (what another website's form can send) is refused");
  c = ctx(); await fn(c, { headers: { ...JS, "sec-fetch-site": "cross-site" }, body: { ops: [{ op: "get", path: "meta/schema" }] } });
  check(c.res.status === 403, "a request another website's page makes is refused");

  console.log(`\n${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
