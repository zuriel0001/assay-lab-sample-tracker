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
  check((await one(null, { op: "query", coll: "samples", where: [["lab", "==", true]] })).docs.length === 0, "public can't list the samples in the lab (the board and wall screen)");
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
  check((await core.account(P("live.com#T1@site.com"))).u === "t1", "a personal Microsoft account's address is matched without its live.com# prefix");
  const asTech = (await one("t1@site.com", { op: "get", path: "settings/stages" })).data;
  check(asTech.users.length === 5 && asTech.users.every(x => !x.em), "staff see names and roles but not sign-in emails");
  check((await one(null, { op: "get", path: "settings/stages" })).data.users.length === 0, "the public sees no accounts");
  check((await one("boss@site.com", { op: "get", path: "settings/stages" })).data.users[1].em === "T1@Site.com", "admin sees the emails to edit them");
  { const work = { days: [1, 2, 3, 4, 5], shifts: [{ from: "07:00", to: "15:00" }], off: ["2026-12-25"] };   // v14 lab working hours
    check((await one("boss@site.com", { op: "update", path: "settings/stages", data: { work } })).ok && JSON.stringify((await one(null, { op: "get", path: "settings/stages" })).data.work) === JSON.stringify(work), "the lab manager saves lab working hours, and the public page reads them for expected finish times");
    check(!(await one("t1@site.com", { op: "update", path: "settings/stages", data: { work: null } })).ok && (await one(null, { op: "get", path: "settings/stages" })).data.work.days.length === 5, "a technician can't change the working hours"); }
  { const logo = "data:image/png;base64," + Buffer.from("a small picture").toString("base64");   // v15 company logo
    check((await one("boss@site.com", { op: "update", path: "settings/stages", data: { logo } })).ok && (await one(null, { op: "get", path: "settings/stages" })).data.logo === logo, "the lab manager saves a company logo, and everyone's page reads it");
    check(!(await one("t1@site.com", { op: "update", path: "settings/stages", data: { logo: "" } })).ok, "a technician can't change the logo");
    const bad = [["a large picture", "data:image/png;base64," + "A".repeat(90000)], ["an SVG", "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="], ["a link", "https://example.com/logo.png"], ["not text", { src: logo }]];
    for (const [what, v] of bad) check(!(await one("boss@site.com", { op: "update", path: "settings/stages", data: { logo: v } })).ok, `the server refuses ${what} as the logo`);
    check((await one(null, { op: "get", path: "settings/stages" })).data.logo === logo && (await one("boss@site.com", { op: "update", path: "settings/stages", data: { logo: "" } })).ok, "a refused logo leaves the saved one; removing it is allowed"); }
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

  // Access requests: a signed-in Microsoft account without a role may ask for itself; only the lab manager answers, and only Settings give a role.
  const ak = "access/new~40~site.com", req = (x = {}) => ({ em: "new@site.com", name: "New Person", note: "MET lab", at: Date.now(), status: "pending", ...x });
  check(!(await one(null, { op: "set", path: ak, data: req() })).ok, "the public can't ask for access");
  check(!(await one("new@site.com", { op: "set", path: "access/other~40~site.com", data: req({ em: "other@site.com" }) })).ok && !(await one("new@site.com", { op: "set", path: ak, data: req({ em: "other@site.com" }) })).ok, "a request is only ever for one's own email");
  check(!(await one("new@site.com", { op: "set", path: ak, data: req({ status: "approved" }) })).ok && !(await one("new@site.com", { op: "set", path: ak, data: req({ role: "admin" }) })).ok, "a request can't approve itself or carry a role");
  check(!(await one("new@site.com", { op: "set", path: ak, data: req({ name: " " }) })).ok && !(await one("new@site.com", { op: "set", path: ak, data: req({ at: now - 3600e3 }) })).ok, "a request needs a name and the current time");
  check(!(await one("t1@site.com", { op: "set", path: "access/t1~40~site.com", data: req({ em: "t1@site.com" }) })).ok, "staff don't send requests");
  check((await one("new@site.com", { op: "set", path: ak, data: req() })).ok, "a signed-in account without access asks for access");
  check(!(await one("new@site.com", { op: "set", path: ak, data: req({ name: "Again" }) })).ok && !(await one("new@site.com", { op: "update", path: ak, data: { status: "approved" } })).ok && !(await one("new@site.com", { op: "delete", path: ak })).ok, "the person asking can't send it again, change it or remove it");
  check((await core.account(P("new@site.com"))).role === null, "asking gives no access by itself");
  check((await one("new@site.com", { op: "get", path: ak })).data.status === "pending", "the person asking sees their own request");
  check(!(await one("t1@site.com", { op: "get", path: ak })).ok && !(await one("other@site.com", { op: "get", path: ak })).ok && !(await one(null, { op: "get", path: ak })).ok, "nobody else but the lab manager reads it");
  check(!(await one("t1@site.com", { op: "query", coll: "access", where: [["status", "==", "pending"]] })).docs.length && !(await one("new@site.com", { op: "query", coll: "access", where: [] })).docs.length, "nor lists requests");
  const ch0 = now - 1;
  check(!(await one("t1@site.com", { op: "changes", since: ch0 })).changes.some(c => c.path === ak) && (await one("new@site.com", { op: "changes", since: ch0, watch: [ak] })).changes.some(c => c.path === ak), "live changes to a request go only to the person asking (and the lab manager)");
  check(!(await one("s1@site.com", { op: "update", path: ak, data: { status: "declined" } })).ok, "a supervisor can't answer a request");
  const pend = (await one("boss@site.com", { op: "query", coll: "access", where: [["status", "==", "pending"]] })).docs;
  check(pend.length === 1 && pend[0].data.em === "new@site.com", "the lab manager lists pending requests");
  check((await one("boss@site.com", { op: "update", path: ak, data: { status: "declined", by: "mgr", byName: "Manager", dt: Date.now() } })).ok && mem.docs[ak].by === "mgr", "the lab manager declines a request, and who declined it is recorded");
  check((await one("new@site.com", { op: "set", path: ak, data: req({ note: "second try" }) })).ok, "after a decline the person may ask again");
  check((await one("boss@site.com", { op: "update", path: "settings/stages", data: { users: [...users, { u: "new", name: "New Person", role: "tech", em: "new@site.com" }] } })).ok &&
    (await one("boss@site.com", { op: "update", path: ak, data: { status: "approved", role: "tech", by: "mgr", byName: "Manager", dt: Date.now() } })).ok, "the lab manager approves it by adding the account in Settings");
  check((await core.account(P("new@site.com"))).role === "tech", "the account then signs in with the role given");
  check((await one("boss@site.com", { op: "export", coll: "access" })).docs.length === 1, "access requests are in the backup");

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

  { const wid = `GC-${day}-0001`, vid = `GC-${day}-0002`, sid = `GR-${day}-0001`;   // v16 walk-ins, Submit after sign-in, reference material edits
    check((await one(null, { op: "set", path: "samples/" + wid, data: sub(wid, { via: "walkin", purpose: "Other: dispute check", purposeKey: "other", purposeWhy: "dispute check",
      history: [{ key: "submitted", at: now, by: "public", name: "J", note: "Registered at the lab (walk-in)" }] }) })).ok, "someone signed out registers a walk-in sample, with its reason for Other");
    check((await one("v@site.com", { op: "set", path: "samples/" + vid, data: sub(vid, { createdByName: "Viewer" }) })).ok, "a viewer submits a sample after signing in; it waits for receipt like any submission");
    check((await one("exp@site.com", { op: "set", path: "samples/" + sid, data: sub(sid, { createdByName: "EXP results" }) })).ok, "a section account submits a sample");
    check(!(await one("v@site.com", { op: "set", path: `samples/GC-${day}-0003`, data: sub(`GC-${day}-0003`, { via: "walkin", stageKey: "received", receivedBy: "Viewer" }) })).ok, "a walk-in can't arrive already received");
    const crms = [{ id: "OREAS-LOW", rk: "k1", was: ["STD-AU-LOW"], an: "Au g/t", val: 0.515, sd: 0.021, bt: ["FA", "GC"] }];
    const crmLog = [{ at: now, by: "Manager", id: "OREAS-LOW", what: "ID STD-AU-LOW → OREAS-LOW; Certified value 0.52 → 0.515" }];
    check((await one("boss@site.com", { op: "update", path: "settings/stages", data: { crms, crmLog } })).ok, "the lab manager edits a reference material, with its earlier ID and the change history");
    const seen = (await one(null, { op: "get", path: "settings/stages" })).data;
    check(JSON.stringify(seen.crms) === JSON.stringify(crms) && JSON.stringify(seen.crmLog) === JSON.stringify(crmLog), "every page reads the edited register and its history");
    check(!(await one("t1@site.com", { op: "update", path: "settings/stages", data: { crmLog: [] } })).ok && !(await one("s1@site.com", { op: "update", path: "settings/stages", data: { crms: [] } })).ok, "only the lab manager changes the register or its history"); }
  { const hid = `GC-${day}-0005`, lid = `GR-${day}-0002`, hand = { handedTo: "Kofi Mensah", handedBadge: "B-1042" };   // v17 hand-over, one entry tab
    check((await one(null, { op: "set", path: "samples/" + hid, data: sub(hid, { via: "walkin", ...hand,
      history: [{ key: "submitted", at: now, by: "public", name: "J", note: "Registered at the lab (walk-in)", hand: "Kofi Mensah", badge: "B-1042" }] }) })).ok, "a walk-in names the technician it was handed to and their badge number");
    check((await one("t1@site.com", { op: "set", path: "samples/" + lid, data: sub(lid, { ...hand, createdByName: "J",
      history: [{ key: "submitted", at: now, by: "public", name: "J", note: "Submitted through the submission form", hand: "Kofi Mensah", badge: "B-1042" }] }) })).ok, "a technician's Submit with Received now cleared waits for receipt like any submission"); }
  { const sha = "ab".repeat(32), fid = "RF-" + sha.slice(0, 16).toUpperCase(), t0 = Date.now() - 1;   // v18 results files
    const piece = n => ({ id: `${fid}~${n}`, of: fid, n, data: Buffer.from("csv line " + n).toString("base64") });
    const rec = { id: fid, name: "ak041110.xls", kind: "xls", size: 2048, sha, labRef: "AK1", parts: 2, at: now, by: "t1", tech: "Tech One" };
    check((await one("t1@site.com", { op: "set", path: `files/${fid}~1`, data: piece(1) })).ok && (await one("t1@site.com", { op: "set", path: `files/${fid}~2`, data: piece(2) })).ok &&
      (await one("t1@site.com", { op: "set", path: "files/" + fid, data: rec })).ok, "a technician keeps a results file: its pieces, then its record under their name");
    check((await one("t1@site.com", { op: "set", path: `files/${fid}~1`, data: piece(1) })).ok, "saving the same piece again (a retry) is allowed");
    check(!(await one("t1@site.com", { op: "set", path: `files/${fid}~1`, data: { ...piece(1), data: "QUJD" } })).ok, "a kept file can't be overwritten");
    check(!(await one("t1@site.com", { op: "update", path: "files/" + fid, data: { name: "other.xls" } })).ok, "a kept file's record can't be changed");
    check(!(await one("boss@site.com", { op: "delete", path: "files/" + fid })).ok && (await one("v@site.com", { op: "get", path: "files/" + fid })).data.name === "ak041110.xls", "a kept file is never deleted, even by the lab manager");
    check(!(await one("t1@site.com", { op: "set", path: "files/RF-1111111111111111", data: { ...rec, id: "RF-1111111111111111", by: "s1", tech: "Super One" } })).ok, "a file can't be kept in someone else's name");
    check(!(await one("v@site.com", { op: "set", path: "files/RF-2222222222222222~1", data: { id: "RF-2222222222222222~1", of: "RF-2222222222222222", n: 1, data: "QUJD" } })).ok, "a viewer can't keep files");
    check(!(await one("t1@site.com", { op: "set", path: "files/RF-3333333333333333~1", data: { id: "RF-3333333333333333~1", of: "RF-3333333333333333", n: 1, data: "A".repeat(180004) } })).ok &&
      !(await one("t1@site.com", { op: "set", path: "files/anything", data: { id: "anything" } })).ok, "an oversized piece or a stray record is refused");
    check(!(await one(null, { op: "get", path: "files/" + fid })).ok && !(await one("exp@site.com", { op: "get", path: `files/${fid}~1` })).ok, "the public and section accounts can't read results files");
    const found = (await one("t1@site.com", { op: "query", coll: "files", where: [["sha", "==", sha]], limit: 5 })).docs;
    check(found.length === 1 && found[0].data.parts === 2, "staff find a file attached before by its fingerprint");
    check(!(await one("s1@site.com", { op: "changes", since: t0 })).changes.some(c => c.path.startsWith("files/")), "file pieces are not sent to every page as live changes");
    const ex = (await one("boss@site.com", { op: "export", coll: "files", after: "", limit: 200 }));
    check(ex.docs.length === 3 && ex.next === null, "the backup includes results files, a few pieces at a time");
    const bp = "batches/FA-B1", draft = { at: now, by: "t1", tech: "Tech One", file: { id: fid, name: rec.name }, vals: {}, crms: {} };
    check((await one("t1@site.com", { op: "set", path: bp, data: { id: "FA-B1", status: "results", draft, files: [{ id: fid, name: rec.name, at: now, tech: "Tech One" }] } })).ok, "a batch keeps a results draft under the uploader's name");
    check(!(await one("t1@site.com", { op: "update", path: bp, data: { draft: { ...draft, by: "s1", tech: "Super One" } } })).ok && (await one("t1@site.com", { op: "update", path: bp, data: { draft: null } })).ok, "a draft can't be saved in someone else's name; saving the results clears it"); }

  console.log(`\n${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
