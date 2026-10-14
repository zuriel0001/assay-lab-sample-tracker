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
  const sub = (id, extra = {}) => ({ id, v: 12, section: id.split("-")[0], stageKey: "submitted", open: true, onHand: false, createdBy: "public", createdAt: now, recvAt: null, receivedAt: null, recv: null,
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
    { u: "v", name: "Viewer", role: "viewer", em: "v@site.com" }, { u: "exp", name: "EXP results", role: "section", sec: "EXP", em: "exp@site.com" }];
  check(!(await one("t1@site.com", { op: "set", path: "settings/stages", data: { users } })).ok, "a non-admin can't save settings");
  check((await one("boss@site.com", { op: "set", path: "settings/stages", data: { schema: 12, users, resultsPublic: false } })).ok, "the bootstrap admin saves settings");
  await new Promise(r => setTimeout(r, 3100));   // settings cache
  const t1 = await core.account(P("t1@site.com"));
  check(t1.role === "tech" && t1.u === "t1" && t1.name === "Tech One", "accounts are matched by Microsoft email, case-insensitively");
  check((await core.account(P("t1"))).role === null, "on Azure, a username is not a sign-in (dev only)");
  const asTech = (await one("t1@site.com", { op: "get", path: "settings/stages" })).data;
  check(asTech.users.length === 4 && asTech.users.every(x => !x.em), "staff see names and roles but not sign-in emails");
  check((await one(null, { op: "get", path: "settings/stages" })).data.users.length === 0, "the public sees no accounts");
  check((await one("boss@site.com", { op: "get", path: "settings/stages" })).data.users[1].em === "T1@Site.com", "admin sees the emails to edit them");
  { const m2 = createMemoryStore(); await m2.set("settings/stages", { users }); const c2 = createCore({ store: m2, adminEmails: [] });
    const r = (await c2.handleDb(P("boss@site.com"), { ops: [{ op: "set", path: "settings/stages", data: { users: users.filter(x => x.role !== "admin") } }] })).body.results[0];
    check(!r.ok, "without ADMIN_EMAILS, settings can't be saved with no admin left"); }

  // Staff and section accounts.
  check((await one("t1@site.com", { op: "update", path: "samples/" + id, data: { stageKey: "received", recvAt: now } })).ok, "a technician updates a sample");
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
  c = ctx(); await fn(c, { headers: {}, body: { ops: [{ op: "get", path: "settings/stages" }] } });
  check(c.res.status === 200 && c.res.body.results[0].ok, "Functions entry /api/db answers");
  c = ctx(); await fn(c, { headers: {}, body: "{\"ops\":[{\"op\":\"get\",\"path\":\"meta/schema\"}]}" });
  check(c.res.status === 200 && c.res.body.results[0].ok, "Functions entry accepts a string body");

  console.log(`\n${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
