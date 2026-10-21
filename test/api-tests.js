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

  // v24d (20 Oct): a job's samples have their codes as IDs (the key writes / \ ? # as ~ and their code); the job's batch a site number.
  const jb = `B-MET-${day}-0009`, jsub = (code, extra = {}) => sub(code, { section: "MET", job: "preg", tags: [code], batchId: jb, batchSize: 2, ...extra });
  check((await one(null, { op: "set", path: "samples/MLABPREG0120261013", data: jsub("MLABPREG0120261013") })).ok, "public may submit a job's sample with its code as its ID, in a batch holding a site number");
  check((await one(null, { op: "set", path: "samples/MLNSCBLD20261018~23~32", data: jsub("MLNSCBLD20261018#32", { job: "mill" }) })).ok === false, "a second job's sample can't join a batch another job's form started");
  check((await one(null, { op: "set", path: "samples/MLABPREG0220261013", data: jsub("MLABPREG0220261013") })).ok, "the rest of the job join its batch");
  check((await one(null, { op: "set", path: "samples/MLNSCBLD20261018~23~32", data: jsub("MLNSCBLD20261018#32", { job: "mill", batchId: `B-PLT-${day}-0009`, section: "PLT" }) })).ok, "a code with # is kept as the ID; its key writes # as ~23~");
  check(!(await one(null, { op: "set", path: "samples/MLNSCBLD20261018#32", data: jsub("MLNSCBLD20261018#32", { job: "mill" }) })).ok, "a key with # in it is refused");
  check(!(await one(null, { op: "set", path: "samples/MLABOTHER20261013", data: jsub("MLABOTHER20261013", { tags: ["MLABPREG0320261013"] }) })).ok, "a code ID must be the sample's own code");
  check((await one(null, { op: "set", path: "samples/MLABPREG0120261013-2", data: jsub("MLABPREG0120261013-2", { tags: ["MLABPREG0120261013"] }) })).ok, "or its code with -2 when the code is already a sample's ID");
  check(!(await one(null, { op: "set", path: "samples/MLABPREG0520261013", data: sub("MLABPREG0520261013", { tags: ["MLABPREG0520261013"] }) })).ok, "only a job's sample has a code as its ID");
  check(!(await one(null, { op: "set", path: "samples/MLABPREG0620261013", data: jsub("MLABPREG0620261013", { batchId: "B-" + id }) })).ok, "a job's sample can't join another submission's batch");
  // v31 (21 Oct): a first code and the date make a job's codes (MLABPPS01 + date, counted on), in several ID groups, with ticked and typed analyses.
  const jb31 = `B-MET-${day}-0031`, j31 = (code, extra = {}) => sub(code, { section: "MET", job: "custom", tags: [code], batchId: jb31, batchSize: 5, test: "aufx", tests2: ["ausx"], xan: ["Sulphide S"], route: "OTHER", ...extra });
  const codes31 = ["MLABPPS0120261021", "MLABPPS0220261021", "MLABCB0120261021", "MLABSL0120261021", "MLNSCOF 20261021"];
  let ok31 = true; for (const c of codes31) ok31 = (await one(null, { op: "set", path: "samples/" + c, data: j31(c) })).ok && ok31;
  check(ok31 && (await Promise.all(codes31.map(c => mem.get("samples/" + c)))).every(d => d && d.job === "custom" && d.xan[0] === "Sulphide S" && d.tests2[0] === "ausx" && d.route === "OTHER"),
    "public may submit an Other testwork job in three ID groups (and a code with a space), with ticked and typed analyses (v31)");
  check(!(await one(null, { op: "set", path: "samples/mlabpps0320261021", data: j31("mlabpps0320261021") })).ok, "a job code in lower case is refused (the page writes codes in upper case)");

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
  check((await one("boss@site.com", { op: "set", path: "settings/stages", data: { schema: 12, users, resultsPublic: false, relMode: "signoff" } })).ok, "the bootstrap admin saves settings");   // v24: the checks below are of the sign-off release
  await new Promise(r => setTimeout(r, 3100));   // settings cache
  // v32 (21 Oct): nothing that carries a result's value leaves the server for readers who may not see results: the notes of history lines
  // about results, evaluations and re-assays, the evaluations, the last re-assay's reason and the lab batch QC notes.
  const red32 = `PLT-${day}-0032`;
  await mem.set("samples/" + red32, { ...sub(red32, { createdBy: "t1", stageKey: "released" }), results: { rows: { Au: { v: 14.2 } } }, lastRedo: "Au 14.2 over range",
    evals: [{ at: now, by: "m", tech: "Met", dept: "Metallurgy", v: "query", note: "Au 14.2 looks high" }], rq: true, labQcNote: "CRM 0.512 low", labs: { fa: { b: "FA-1", q: "fail", n: "CRM 0.512 low" } },
    history: [{ key: "submitted", at: now, by: "public", name: "J", note: "Handed in at the gate" }, { key: "fa", at: now, by: "t1", tech: "Tech One", res: true, note: "Results entered: Au 14.2 g/t" },
      { key: "fa", at: now, by: "t1", tech: "Tech One", redo: true, note: "Re-assay: Au 14.2 g/t is over the 10 g/t range" }, { key: "rel", at: now, by: "m", tech: "Met", ev: true, note: "Query: Au 14.2 looks high" }] });
  const seenBy = async who => (await one(who, { op: "get", path: "samples/" + red32 })).data;
  for (const [who, label] of [[null, "signed out"], ["exp@site.com", "another section's account"]]){
    const r = await seenBy(who), h = r && r.history || [];
    check(r && h.length === 4 && h[0].note === "Handed in at the gate" && h.slice(1).every(x => x.note === undefined && x.by && x.at) && !r.evals && !r.lastRedo && !r.labQcNote &&
      r.labs.fa.b === "FA-1" && r.labs.fa.q === "fail" && r.labs.fa.n === undefined && r.rq === true && !JSON.stringify(r).includes("14.2") && !JSON.stringify(r).includes("0.512"),
      `${label}: no result value in history notes, evaluations, re-assay reason or QC notes; the lines themselves stay (v32)`);
  }
  const full = await seenBy("t1@site.com");
  check(full.history[1].note === "Results entered: Au 14.2 g/t" && full.evals.length === 1 && full.lastRedo && full.labs.fa.n, "lab staff still get all of it");
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
  // v24c: disposal needs a second person, on the server too
  const dmv = { dir: "out", kind: "disposed", sid: rid, item: "Pulp", ...T1 };
  check(!(await one("t1@site.com", { op: "update", path: lp, data: { m: { d1: dmv } } })).ok, "a disposal with no witness is refused");
  check(!(await one("t1@site.com", { op: "update", path: lp, data: { m: { d1: { ...dmv, wit: "Tech One" } } } })).ok, "a disposal witnessed by the person recording it is refused");
  check(!(await one("t1@site.com", { op: "set", path: "ledger/2026-10-15_EXP", data: { day: "2026-10-15", m: { d2: dmv } } })).ok, "a new ledger day with an unwitnessed disposal is refused");
  check((await one("t1@site.com", { op: "update", path: lp, data: { m: { d1: { ...dmv, wit: "Super One" } } } })).ok, "a disposal witnessed by a second person is recorded");
  check((await one("t1@site.com", { op: "update", path: lp, data: { m: { r1: { dir: "out", kind: "returned", sid: rid, item: "Pulp", ...T1 } } } })).ok, "a return needs no witness");
  const bf = { dir: "out", kind: "disposed", sid: rid, item: "Whole sample", by: "", tech: "", note: "Brought forward from the earlier ledger" };
  check((await one("t1@site.com", { op: "update", path: lp, data: { m: { h1: { ...bf, at: Date.UTC(2026, 8, 3) } } } })).ok, "an old disposal brought forward by the upgrade of old records is history: no witness needed");
  check(!(await one("t1@site.com", { op: "update", path: lp, data: { m: { h2: { ...bf, at: Date.now() } } } })).ok, "but a new disposal can't pass as one");
  // v24d: a critical (two-person custody) sample: storage and disposal are confirmed by the witness from their own account
  { const gid = `GR-${day}-0901`, gp = "samples/" + gid, t0 = Date.now();
    const gget = async () => (await one("t1@site.com", { op: "get", path: gp })).data;
    const add = async (who, e, extra = {}) => { const g = await gget(); return one(who, { op: "update", path: gp, data: { history: [...g.history, { key: g.stageKey, at: Date.now(), ...e }], ...extra } }); };
    check((await one("t1@site.com", { op: "set", path: gp, data: { id: gid, v: 13, section: "GR", typeKey: "bullion", type: "Bullion", stageKey: "released", stageAt: t0, open: true, onHand: true, recvAt: t0,
      history: [{ key: "received", at: t0 - 2, ...T1 }, { key: "released", at: t0 - 1, ...T1 }], materials: [{ k: "m1", item: "Bar", status: "kept", loc: "Vault 1" }, { k: "m2", item: "Drillings", status: "kept", loc: "Vault 2" }] } })).ok, "a released gold room sample, its material in the vault");
    check(!(await add("t1@site.com", { ...T1 }, { stageKey: "storage", stageAt: Date.now() })).ok, "it can't go into storage without the witness's confirmation");
    const q = { id: "W1", kind: "store", at: Date.now(), ...T1, wit: "Tech One", witU: "t1" };
    check(!(await add("t1@site.com", { ...T1, wreq: "W1" }, { wq: q, wqU: "t1" })).ok, "a request can't name the person making it");
    const qs = { ...q, wit: "Super One", witU: "s1" };
    check(!(await add("s1@site.com", { ...S1, wreq: "W1" }, { wq: qs, wqU: "s1" })).ok, "a request is made in the name of the person signed in");
    check((await add("t1@site.com", { ...T1, wreq: "W1" }, { wq: qs, wqU: "s1" })).ok, "the technician asks the supervisor to confirm the storage");
    check(!(await add("t1@site.com", { ...T1, wcf: "W1" }, { wq: null, wqU: null, stageKey: "storage", stageAt: Date.now() })).ok, "the person who asked can't confirm it");
    check(!(await add("boss@site.com", { ...MG, wcf: "W1" }, { wq: null, wqU: null, stageKey: "storage", stageAt: Date.now() })).ok, "nor can anyone else but the witness asked (the lab manager)");
    check(!(await one("t1@site.com", { op: "update", path: gp, data: { wq: null, wqU: null } })).ok, "the request can't just be dropped");
    check((await add("s1@site.com", { key: "storage", ...S1, wcf: "W1" }, { wq: null, wqU: null, stageKey: "storage", stageAt: Date.now() })).ok, "the witness confirms from their own account; the sample goes into storage");
    const g1 = await gget();
    check(!(await one("t1@site.com", { op: "update", path: gp, data: { materials: [{ ...g1.materials[0], status: "disposed" }, g1.materials[1]], history: [...g1.history, { key: g1.stageKey, at: Date.now(), ...T1, mat: "m1" }] } })).ok, "its material can't be disposed of without the witness's confirmation");
    const qo = { id: "W2", kind: "out", k: "m1", what: "disposed", ref: "", at: Date.now(), ...T1, wit: "Super One", witU: "s1" };
    check((await add("t1@site.com", { ...T1, wreq: "W2", mat: "m1" }, { wq: qo, wqU: "s1" })).ok, "the technician asks the supervisor to confirm a disposal");
    check(!(await add("s1@site.com", { ...S1, wreq: "W3" }, { wq: { ...qo, id: "W3" }, wqU: "s1" })).ok, "one request at a time");
    check((await add("boss@site.com", { ...MG, wwd: "W2" }, { wq: null, wqU: null })).ok, "a lab supervisor or the lab manager may withdraw a request");
    check((await add("t1@site.com", { ...T1, wreq: "W4", mat: "m1" }, { wq: { ...qo, id: "W4" }, wqU: "s1" })).ok, "asked again");
    const g2 = await gget();
    check((await one("s1@site.com", { op: "update", path: gp, data: { wq: null, wqU: null, materials: [{ ...g2.materials[0], status: "disposed" }, g2.materials[1]], history: [...g2.history, { key: g2.stageKey, at: Date.now(), ...S1, wcf: "W4", mat: "m1" }] } })).ok, "the witness confirms the disposal");
    check((await add("t1@site.com", { ...T1, wreq: "W5" }, { wq: { ...qs, id: "W5" }, wqU: "s1" })).ok && (await add("s1@site.com", { ...S1, wsb: "W5" }, { wq: null, wqU: null })).ok, "a witness may send a request back");
  }
  // v24c: monthly ledger sign-off: supervisors and the lab manager, in their own name, only added to
  const so = "signoff/2026-10", sg = (who, x = {}) => ({ at: Date.now(), ...who, role: "super", opening: 3, ins: 10, outs: 4, closing: 9, rev: 0, note: "", ...x });
  check(!(await one("t1@site.com", { op: "set", path: so, data: { id: "2026-10", month: "2026-10", signs: [sg(T1)] } })).ok, "a technician can't sign off the ledger");
  check(!(await one("s1@site.com", { op: "set", path: so, data: { id: "2026-10", month: "2026-10", signs: [sg(T1)] } })).ok, "a sign-off is made in the name of the person signed in");
  check(!(await one("s1@site.com", { op: "set", path: so, data: { id: "2026-10", month: "2026-10", signs: [sg(S1, { closing: -1 })] } })).ok, "a sign-off carries whole counts");
  check(!(await one("s1@site.com", { op: "set", path: "signoff/2026-13", data: { id: "2026-13", month: "2026-13", signs: [sg(S1)] } })).ok, "a sign-off is for a real month");
  check((await one("s1@site.com", { op: "set", path: so, data: { id: "2026-10", month: "2026-10", signs: [sg(S1)] } })).ok, "a supervisor signs off a month");
  const so1 = (await one("v@site.com", { op: "get", path: so })).data;
  check(so1 && so1.signs.length === 1 && so1.signs[0].tech === "Super One", "staff read the sign-off");
  check(!(await one(null, { op: "get", path: so })).ok && !(await one("exp@site.com", { op: "get", path: so })).ok, "the public and section accounts don't");
  check(!(await one("boss@site.com", { op: "update", path: so, data: { signs: [sg(MG, { role: "admin" })] } })).ok, "an earlier sign-off can't be replaced");
  check((await one("boss@site.com", { op: "update", path: so, data: { signs: [...so1.signs, sg(MG, { role: "admin", closing: 10, ins: 11 })] } })).ok, "the lab manager signs off again after a change, added after the first");
  check(!(await one("boss@site.com", { op: "delete", path: so })).ok, "a sign-off is never deleted");
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
  { const r = redactSample({ id: "x", certs: [{ no: "B-PLT-20261019-0001-R1", v: 1, at: 5, code: "C", bref: "B-PLT-20261019-0001", bv: 1, rows: { Au: { raw: "1" } } }] }).certs[0];
    check(r.bref === "B-PLT-20261019-0001" && r.bv === 1 && !r.rows, "a batch certificate keeps its batch (not its results) where results are hidden (v24d)"); }

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
    const rec = { id: fid, name: "mill-run.xls", kind: "xls", size: 2048, sha, labRef: "AK1", parts: 2, at: now, by: "t1", tech: "Tech One" };
    check((await one("t1@site.com", { op: "set", path: `files/${fid}~1`, data: piece(1) })).ok && (await one("t1@site.com", { op: "set", path: `files/${fid}~2`, data: piece(2) })).ok &&
      (await one("t1@site.com", { op: "set", path: "files/" + fid, data: rec })).ok, "a technician keeps a results file: its pieces, then its record under their name");
    check((await one("t1@site.com", { op: "set", path: `files/${fid}~1`, data: piece(1) })).ok, "saving the same piece again (a retry) is allowed");
    check(!(await one("t1@site.com", { op: "set", path: `files/${fid}~1`, data: { ...piece(1), data: "QUJD" } })).ok, "a kept file can't be overwritten");
    check(!(await one("t1@site.com", { op: "update", path: "files/" + fid, data: { name: "other.xls" } })).ok, "a kept file's record can't be changed");
    check(!(await one("boss@site.com", { op: "delete", path: "files/" + fid })).ok && (await one("v@site.com", { op: "get", path: "files/" + fid })).data.name === "mill-run.xls", "a kept file is never deleted, even by the lab manager");
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
  { const nid = `PLT-${day}-0007`, np = "samples/" + nid, S = { by: "s1", tech: "Super One" }, MG = { by: "mgr", tech: "Manager" };   // v19 No QC in this run, badge, screen line
    await mem.set(np, { id: nid, section: "PLT", stageKey: "qc", history: [{ key: "qc", at: now, ...S }], labs: { PL: { b: "PL-B1", q: "none" } }, labQc: "none",
      results: { by: "s1", tech: "Super One", file: { id: "RF-ABCDEF0123456789", name: "run.csv" }, rows: { Au: { v: 1.2, raw: "1.2", by: "s1", src: "file" }, scr: { raw: "+40 0.1 · -325 70", t: "+40 0.1 · -325 70", by: "s1", src: "file" } } } });
    const c1 = x => ({ no: nid + "-R1", v: 1, at: now, qc: "none", ...x });
    check(!(await one("s1@site.com", { op: "update", path: np, data: { certs: [c1({ ...S, role: "super" })] } })).ok, "No QC in this run doesn't skip four eyes: the supervisor who attached the file can't release it");
    check(!(await one("t1@site.com", { op: "update", path: np, data: { certs: [c1({ by: "t1", tech: "Tech One", role: "tech" })] } })).ok && (await one("boss@site.com", { op: "update", path: np, data: { certs: [c1({ ...MG, role: "admin" })] } })).ok, "a technician can't release it; the lab manager, who didn't attach it, can");
    const bid = `GC-${day}-0008`;
    check((await one(null, { op: "set", path: "samples/" + bid, data: sub(bid, { subBadge: "B-2231", tags: ["MS-0042"] }) })).ok && (await one(null, { op: "get", path: "samples/" + bid })).data.subBadge === "B-2231", "a submission carries the submitter's badge number and its site sample code");
    check((await one("t1@site.com", { op: "update", path: np, data: { results: { rows: { scr: { raw: "+40 0.2", t: "+40 0.2", by: "t1" } } } } })).ok, "a technician corrects the screen analysis line under their own name"); }
  { // v20 blind QA/QC re-assay: the link to the original is for supervisors and the lab manager only, and the blind sample is a
    // QA/QC submission with nothing on it that points back.
    const qid = `QC-${day}-0001`, qp = "samples/" + qid, bp = "blind/" + qid, t0 = Date.now() - 1, S = { by: "s1", tech: "Super One" };
    const blindSample = sub(qid, { tags: [], type: "Assay pulp", typeKey: "pulp", submitter: "QA/QC", createdByName: "QA/QC", purposeKey: "qc", source: "", notes: "", siteRef: "",
      history: [{ key: "submitted", at: now, by: "public", name: "QA/QC", note: "Submitted for a QA/QC check", ref: "" }] });
    const link = { id: qid, of: id, set: "QA-x1", at: now, ...S, test: "EXP-FA", mats: [{ item: "Pulp", loc: "Shelf 3" }], cmps: [] };
    check(!(await one(null, { op: "set", path: qp, data: blindSample })).ok, "a signed-out visitor can't send a sample presented as a blind QA/QC sample");
    check(!(await one(null, { op: "set", path: `samples/QC-${day}-0002`, data: sub(`QC-${day}-0002`, { submitter: "qa / qc" }) })).ok &&
      !(await one(null, { op: "set", path: `samples/QC-${day}-0002`, data: sub(`QC-${day}-0002`, { history: [{ key: "submitted", at: now, by: "public", name: "J", note: "Submitted for a QA/QC check" }] }) })).ok,
      "nor one with QA/QC as the submitter, or with the blind sample's note");
    check(!(await one("t1@site.com", { op: "set", path: qp, data: blindSample })).ok, "a technician can't issue a blind QA/QC sample");
    check((await one("s1@site.com", { op: "set", path: qp, data: blindSample })).ok, "a supervisor issues the blind sample, written as a QA/QC submission");
    check(!(await one("t1@site.com", { op: "set", path: bp, data: { ...link, by: "t1", tech: "Tech One" } })).ok && !(await one("v@site.com", { op: "set", path: bp, data: link })).ok &&
      !(await one(null, { op: "set", path: bp, data: link })).ok, "technicians, viewers and visitors can't write a blind link");
    check(!(await one("s1@site.com", { op: "set", path: bp, data: { ...link, by: "mgr", tech: "Manager" } })).ok, "a blind link is issued in the supervisor's own name");
    check(!(await one("s1@site.com", { op: "set", path: bp, data: { ...link, of: `GC-${day}-0008` } })).ok, "only a sample with released results is checked blind");
    check(!(await one("s1@site.com", { op: "set", path: `blind/QC-${day}-0009`, data: { ...link, id: `QC-${day}-0009` } })).ok, "a link is written after its blind sample");
    check(!(await one("s1@site.com", { op: "set", path: bp, data: { ...link, cmps: [{ at: now, ...S }] } })).ok && !(await one("s1@site.com", { op: "set", path: bp, data: { ...link, extra: 1 } })).ok,
      "a link starts with no comparison and holds only its own fields");
    check((await one("s1@site.com", { op: "set", path: bp, data: link })).ok && (await one("s1@site.com", { op: "set", path: bp, data: link })).ok, "the supervisor issues the link (a retry of the same link is allowed)");
    check(!(await one("s1@site.com", { op: "set", path: bp, data: { ...link, of: `PLT-${day}-0007` } })).ok && !(await one("boss@site.com", { op: "update", path: bp, data: { of: `PLT-${day}-0007` } })).ok,
      "a link can't be pointed at another sample");
    check(!(await one("t1@site.com", { op: "get", path: bp })).ok && !(await one("v@site.com", { op: "get", path: bp })).ok && !(await one("exp@site.com", { op: "get", path: bp })).ok && !(await one(null, { op: "get", path: bp })).ok,
      "technicians, viewers, section accounts and visitors can't read a blind link");
    check(!(await one("t1@site.com", { op: "get", path: `blind/QC-${day}-0009` })).ok, "a technician gets the same refusal whether a link exists or not");
    let leak = 0;
    for (const who of ["t1@site.com", "v@site.com", "exp@site.com", null]){
      leak += (await one(who, { op: "query", coll: "blind", where: [] })).docs.length + (await one(who, { op: "query", coll: "blind", where: [["of", "==", id]] })).docs.length;
      leak += (await one(who, { op: "changes", since: t0, watch: [bp] })).changes.filter(c => c.path.startsWith("blind/")).length;
    }
    check(leak === 0, "nor list blind links, or receive them as live changes");
    check(!(await one("t1@site.com", { op: "acquire", path: bp, holder: "x", ttl: 4000 })).ok, "a technician can't lease a blind link");
    check((await one("s1@site.com", { op: "get", path: bp })).data.of === id && (await one("boss@site.com", { op: "query", coll: "blind", where: [["of", "==", id]] })).docs.length === 1 &&
      (await one("s1@site.com", { op: "changes", since: t0 })).changes.some(c => c.path === bp), "supervisors and the lab manager read, list and receive the link");
    const tview = JSON.stringify([(await one("t1@site.com", { op: "get", path: qp })).data, (await one("t1@site.com", { op: "changes", since: t0 })).changes.filter(c => c.path === qp || !c.path.startsWith("samples/")), (await one("t1@site.com", { op: "query", coll: "samples", where: [["section", "==", "QC"]] })).docs]);
    check(tview.includes(qid) && !tview.includes(id) && !tview.includes("Super One") && !tview.includes('"s1"') && !tview.includes("QA-x1") && !tview.includes("Shelf 3"),
      "what a technician can read of the blind sample names neither the original, who issued it, the set nor where its material came from");
    const cmp = { at: now, ...S, state: "ok", rows: [{ k: "Au", a: 1.2, b: 1.21 }] };
    check((await one("s1@site.com", { op: "update", path: bp, data: { cmps: [cmp] } })).ok, "a supervisor records a comparison on the link");
    check(!(await one("t1@site.com", { op: "update", path: bp, data: { cmps: [cmp, { ...cmp, by: "t1", tech: "Tech One" }] } })).ok, "a technician can't record one");
    check(!(await one("boss@site.com", { op: "update", path: bp, data: { cmps: [cmp, { ...cmp, by: "s1", tech: "Super One" }] } })).ok, "a comparison is recorded in the name of the person signed in");
    check(!(await one("boss@site.com", { op: "update", path: bp, data: { cmps: [] } })).ok && !(await one("boss@site.com", { op: "update", path: bp, data: { cmps: [{ ...cmp, state: "bad" }] } })).ok,
      "a recorded comparison can't be removed or changed");
    check((await one("boss@site.com", { op: "update", path: bp, data: { cmps: [cmp, { ...cmp, by: "mgr", tech: "Manager" }] } })).ok && mem.docs[bp].cmps.length === 2, "comparisons are added to");
    check(!(await one("boss@site.com", { op: "delete", path: bp })).ok && !(await one("boss@site.com", { op: "update", path: `blind/QC-${day}-0009`, data: { cmps: [cmp] } })).ok, "a link is never deleted, and can't be made by an update");
    check(!JSON.stringify(mem.docs["samples/" + id]).includes(qid), "nothing is written on the original sample");
    const ex = await one("boss@site.com", { op: "export", coll: "blind", after: "" });
    check(ex.docs.length === 1 && ex.docs[0].data.of === id && !(await one("s1@site.com", { op: "export", coll: "blind", after: "" })).ok, "the lab manager's backup includes the blind links"); }
  { // v20 a batch on Submit / Register: each sample has its own ID and carries B- and the batch's first ID, a batch name and its own source.
    const T1 = `TSF-${day}-0001`, T2 = `TSF-${day}-0002`, ref = "B-" + T1, bt = (sid, x = {}) => sub(sid, { tags: [], batchId: ref, batchName: "Night shift TSF", batchSize: 2, ...x });
    check((await one(null, { op: "set", path: "samples/" + T1, data: bt(T1, { batchIndex: 1, source: "Spigot 1" }) })).ok &&
      (await one(null, { op: "set", path: "samples/" + T2, data: bt(T2, { batchIndex: 2, source: "Spigot 2" }) })).ok, "a visitor registers a batch: the first sample, then the rest carrying its reference");
    check(!(await one(null, { op: "set", path: `samples/TSF-${day}-0003`, data: bt(`TSF-${day}-0003`, { batchId: `B-TSF-${day}-0099` }) })).ok, "a sample can't join a batch that doesn't exist");
    check(!(await one(null, { op: "set", path: `samples/MIN-${day}-0001`, data: bt(`MIN-${day}-0001`) })).ok, "nor another section's batch");
    await mem.set(`samples/TSF-${day}-0050`, { ...bt(`TSF-${day}-0050`, { batchId: `B-TSF-${day}-0050` }), createdAt: now - 3600e3 });
    check(!(await one(null, { op: "set", path: `samples/TSF-${day}-0004`, data: bt(`TSF-${day}-0004`, { batchId: `B-TSF-${day}-0050` }) })).ok, "nor a batch sent earlier");
    check(!(await one(null, { op: "set", path: `samples/TSF-${day}-0005`, data: bt(`TSF-${day}-0005`, { batchId: "B-TSF-0001", batchName: undefined }) })).ok &&
      !(await one(null, { op: "set", path: `samples/TSF-${day}-0006`, data: bt(`TSF-${day}-0006`, { batchId: "B-" + `TSF-${day}-0006`, batchName: "x".repeat(81) }) })).ok, "a malformed batch reference or a batch name over 80 characters is refused");
    const got = (await one(null, { op: "query", coll: "samples", where: [["batchId", "==", ref]], limit: 100 })).docs;
    check(got.length === 2 && got.every(x => x.data.batchName === "Night shift TSF" && !x.data.results) && got.some(x => x.data.source === "Spigot 2"), "anyone opens the batch by its reference, without results");
    for (let i = 0; i < 30; i++){ const k = `GEO-${day}-${String(100 + i).padStart(4, "0")}`; await mem.set("samples/" + k, { ...sub(k, { tags: [] }), batchId: `B-GEO-${day}-0100` }); }
    check((await one(null, { op: "query", coll: "samples", where: [["batchId", "==", `B-GEO-${day}-0100`]], limit: 100 })).docs.length === 30 &&
      (await one(null, { op: "query", coll: "samples", where: [["tags", "array-contains", "T-1"]], limit: 100 })).docs.length <= 25, "a batch lookup lists up to 100 samples (other lookups stay at 25)");
    check(!(await one(null, { op: "query", coll: "samples", where: [["batchId", "!=", "x"]] })).docs.length && !(await one(null, { op: "query", coll: "samples", where: [["batchId", "==", "TSF"]] })).docs.length,
      "only a batch reference opens a batch");
    const recv = { stageKey: "received", recvAt: now, history: [...mem.docs["samples/" + T1].history, { key: "received", at: now, by: "t1", tech: "Tech One", note: "Received with batch " + ref }] };
    check((await one("t1@site.com", { op: "update", path: "samples/" + T1, data: recv })).ok, "a technician receives a batch sample under their own name"); }
  { // v21 lab batches optional: a sample in no lab batch takes its results on its own record (typed, or from an attached
    // file kept under the uploader's name), goes to QA/QC review and is released by someone else, with nothing about batches checked.
    const nid = `MIN-${day}-0040`, np = "samples/" + nid, T = { by: "t1", tech: "Tech One" }, S = { by: "s1", tech: "Super One" };
    await mem.set(np, { id: nid, section: "MIN", stageKey: "weigh", open: true, lab: true, onHand: true, history: [{ key: "received", at: now, ...T }] });
    const fid = "RF-0123456789ABCDEF";
    check((await one("t1@site.com", { op: "set", path: `files/${fid}~1`, data: { id: `${fid}~1`, of: fid, n: 1, data: "QUJD" } })).ok &&
      (await one("t1@site.com", { op: "set", path: "files/" + fid, data: { id: fid, name: "run.csv", kind: "csv", size: 3, parts: 1, at: now, ...T } })).ok &&
      (await one("t1@site.com", { op: "update", path: np, data: { results: { by: "t1", tech: "Tech One", at: now, file: { id: fid, name: "run.csv" }, rows: { Au: { v: 1.4, raw: "1.4", by: "t1", src: "file" } } } } })).ok,
      "a results file attached on the record of a sample in no lab batch saves onto that record");
    check((await one("t1@site.com", { op: "update", path: np, data: { stageKey: "qc", history: [...mem.docs[np].history, { key: "qc", at: now, ...T }] } })).ok, "it goes to QA/QC review with no lab batch");
    check(!(await one("t1@site.com", { op: "update", path: np, data: { certs: [{ no: nid + "-R1", v: 1, at: now, ...T, role: "tech" }] } })).ok &&
      (await one("s1@site.com", { op: "update", path: np, data: { stageKey: "released", certs: [{ no: nid + "-R1", v: 1, at: now, ...S, role: "super" }], history: [...mem.docs[np].history, { key: "released", at: now, ...S }] } })).ok,
      "and is released by a supervisor (four eyes as before), no lab batch needed");
    check((await one("boss@site.com", { op: "update", path: "settings/stages", data: { batchReq: true } })).ok && mem.docs["settings/stages"].batchReq === true &&
      !(await one("s1@site.com", { op: "update", path: "settings/stages", data: { batchReq: false } })).ok, "only the lab manager changes the lab batch setting"); }
  { // v22 no QA/QC review step unless Settings use it: a sample is released straight from its last analysis step, still by
    // someone other than the person who entered its results; only the lab manager changes the setting.
    const nid = `MIN-${day}-0041`, np = "samples/" + nid, T = { by: "t1", tech: "Tech One" }, S = { by: "s1", tech: "Super One" };
    await mem.set(np, { id: nid, section: "MIN", stageKey: "finish", open: true, lab: true, onHand: true, history: [{ key: "received", at: now, ...T }, { key: "finish", at: now, ...T }],
      results: { by: "t1", tech: "Tech One", at: now, rows: { Au: { v: 0.8, raw: "0.8", by: "t1" } } } });
    const rel = who => ({ stageKey: "released", certs: [{ no: nid + "-R1", v: 1, at: now, ...who, role: who.by === "t1" ? "tech" : "super" }], history: [...mem.docs[np].history, { key: "released", at: now, ...who }] });
    check(!(await one("t1@site.com", { op: "update", path: np, data: rel(T) })).ok, "the technician who entered the results can't release from the last analysis step");
    check((await one("s1@site.com", { op: "update", path: np, data: rel(S) })).ok && mem.docs[np].stageKey === "released" && !mem.docs[np].history.some(e => e.key === "qc"),
      "a supervisor releases straight from the last analysis step, with no QA/QC review stage");
    check((await one("boss@site.com", { op: "update", path: "settings/stages", data: { qcStep: true } })).ok && mem.docs["settings/stages"].qcStep === true &&
      !(await one("s1@site.com", { op: "update", path: "settings/stages", data: { qcStep: false } })).ok && !(await one("t1@site.com", { op: "update", path: "settings/stages", data: { qcStep: false } })).ok,
      "only the lab manager turns the QA/QC review step on or off"); }
  { // v24: release at once (the default) and departments that evaluate.
    const st0 = mem.docs["settings/stages"];
    await mem.update("settings/stages", { relMode: null, depts: [{ n: "Assay Lab", ev: false }, { n: "Metallurgy", ev: true }, { n: "Mining", ev: false }],
      users: [...st0.users, { u: "met", name: "Metallurgist", role: "viewer", dept: "Metallurgy", em: "met@site.com" }, { u: "mv", name: "Mine Viewer", role: "viewer", dept: "Mining", em: "mv@site.com" }] });
    await new Promise(r => setTimeout(r, 3100));   // settings cache
    const T = { by: "t1", tech: "Tech One" }, S = { by: "s1", tech: "Super One" }, MET = { by: "met", tech: "Metallurgist" }, MV = { by: "mv", tech: "Mine Viewer" };
    const nid = `PLT-${day}-0901`, np = "samples/" + nid;
    await mem.set(np, { id: nid, v: 13, section: "PLT", stageKey: "aufx", open: true, lab: true, createdBy: "t1", createdAt: now, history: [{ key: "received", at: now, ...T }],
      results: { v: 1, at: now, by: "t1", tech: "Tech One", rows: { Au: { v: 1.2, raw: "1.2", by: "t1" } } } });
    const h = () => mem.docs[np].history, at = () => Math.max(...h().map(e => e.at)) + 1000;
    check(!(await one("t1@site.com", { op: "update", path: np, data: { certs: [{ no: nid + "-R1", v: 1, at: now, ...S, role: "super" }] } })).ok, "release at once: a certificate still names the person releasing it");
    check((await one("t1@site.com", { op: "update", path: np, data: { stageKey: "released", relAt: now, certs: [{ no: nid + "-R1", v: 1, at: now, ...T, role: "tech" }], history: [...h(), { key: "released", at: at(), ...T }] } })).ok,
      "release at once: the technician releases the results they saved, with no second person");
    check(!(await one("v@site.com", { op: "update", path: np, data: { certs: [...mem.docs[np].certs, { no: nid + "-R2", v: 2, at: now, by: "v", tech: "Viewer", role: "viewer" }] } })).ok, "a viewer can't release");
    const me = await core.account(P("met@site.com"));
    check(me.role === "viewer" && me.dept === "Metallurgy", "/api/me gives the account's department");
    check((await one("t1@site.com", { op: "get", path: "settings/stages" })).data.users.find(x => x.u === "met")?.dept === "Metallurgy", "staff see each account's department");
    const ev = (who, extra = {}) => ({ evals: [...(mem.docs[np].evals || []), { at: at(), ...who, dept: "Metallurgy", v: "redo", note: "Repeat" }], rq: true,
      history: [...h(), { key: "released", at: at(), ...who, ev: true, note: "Evaluation (Metallurgy): Re-assay requested. Repeat" }], updatedAt: Date.now(), ...extra });
    check(!(await one("mv@site.com", { op: "update", path: np, data: ev(MV) })).ok, "a viewer in a department that does not evaluate can't record an evaluation");
    check(!(await one("met@site.com", { op: "update", path: np, data: ev(MET, { stageKey: "aufx" }) })).ok, "an evaluation changes nothing else on the sample");
    check(!(await one("met@site.com", { op: "update", path: np, data: ev(MV) })).ok, "an evaluation is recorded under the name of the person signed in");
    check((await one("met@site.com", { op: "update", path: np, data: ev(MET) })).ok && mem.docs[np].rq === true && mem.docs[np].evals.length === 1 && h().at(-1).ev,
      "a metallurgist (an evaluating department) records an evaluation and asks for a re-assay");
    check(!(await one("met@site.com", { op: "update", path: np, data: { evals: [], history: [...h(), { key: "released", at: at(), ...MET, ev: true }] } })).ok, "an evaluation can't be removed");
    check(!(await one("met@site.com", { op: "update", path: np, data: { ...ev(MET), rq: null } })).ok, "only the lab clears a re-assay request");
    check(!(await one("met@site.com", { op: "update", path: np, data: { stageKey: "fuse" } })).ok && !(await one("met@site.com", { op: "set", path: np, data: mem.docs[np] })).ok, "an evaluator writes nothing else");
    check((await one("t1@site.com", { op: "update", path: np, data: { rq: null, stageKey: "fuse", history: [...h(), { key: "fuse", at: at(), ...T, redo: true }] } })).ok && mem.docs[np].rq === null,
      "the lab clears the request when it sends the sample back for re-assay");
    check((await one("s1@site.com", { op: "update", path: np, data: { evals: [...mem.docs[np].evals, { at: at(), ...S, v: "ok" }], history: [...h(), { key: "fuse", at: at(), ...S, ev: true }] } })).ok &&
      !(await one("s1@site.com", { op: "update", path: np, data: { evals: [...mem.docs[np].evals, { at: at(), ...T, v: "ok" }] } })).ok, "a lab supervisor evaluates too, under their own name");
    // An amended certificate still needs a second person.
    await mem.update(np, { stageKey: "released", amend: { by: "t1", tech: "Tech One", at: now, why: "Typo", rows: { Au: { v: 1.3, raw: "1.3", by: "t1" } } } });
    const amended = who => ({ results: { ...mem.docs[np].results, rows: { Au: { v: 1.3, raw: "1.3", by: "t1" } } }, amend: null,
      certs: [...mem.docs[np].certs, { no: nid + "-R2", v: 2, at: at(), ...who, role: who.by === "t1" ? "tech" : "super", amendBy: { by: "t1", tech: "Tech One", at: now } }], history: [...h(), { key: "released", at: at(), ...who }] });
    check(!(await one("t1@site.com", { op: "update", path: np, data: amended(T) })).ok && (await one("s1@site.com", { op: "update", path: np, data: amended(S) })).ok,
      "an amended certificate is still approved by someone other than the person who proposed it");
    // Any results file up to 5 MB is kept; a section account opens one attached to its own section's sample, and no other.
    const fid = "RF-00000000000F11E5", meta = { id: fid, name: "report.pdf", kind: "pdf", size: 4800000, sha: "", labRef: "", parts: 27, at: now, by: "t1", tech: "Tech One" };
    check((await one("t1@site.com", { op: "set", path: "files/" + fid, data: meta })).ok && (await one("t1@site.com", { op: "set", path: `files/${fid}~27`, data: { id: `${fid}~27`, of: fid, n: 27, data: "QUJD" } })).ok,
      "a 4.8 MB file of 27 pieces is kept");
    check(!(await one("exp@site.com", { op: "get", path: "files/" + fid })).ok, "a section account can't open a file before it is on one of its samples");
    await mem.update(np, { fids: [fid] });
    check(!(await one("exp@site.com", { op: "get", path: "files/" + fid })).ok, "nor one on another section's sample");
    const xid = `EXP-${day}-0903`; await mem.set("samples/" + xid, { id: xid, section: "EXP", fids: [fid], history: [] });
    check((await one("exp@site.com", { op: "get", path: "files/" + fid })).ok && (await one("exp@site.com", { op: "get", path: `files/${fid}~27` })).ok && !(await one("exp@site.com", { op: "get", path: "ledger/x" })).ok,
      "a section account opens a results file attached to its own section's sample (and its pieces), nothing else");
    // Sign-off brings back the supervisor's release and four eyes.
    await mem.update("settings/stages", { relMode: "signoff" }); await new Promise(r => setTimeout(r, 3100));
    const sid2 = `PLT-${day}-0902`, sp2 = "samples/" + sid2;
    await mem.set(sp2, { id: sid2, v: 13, section: "PLT", stageKey: "aufx", open: true, lab: true, createdBy: "t1", createdAt: now, history: [{ key: "received", at: now, ...T }], results: { v: 1, at: now, by: "t1", tech: "Tech One", rows: { Au: { v: 2, raw: "2", by: "t1" } } } });
    check(!(await one("t1@site.com", { op: "update", path: sp2, data: { certs: [{ no: sid2 + "-R1", v: 1, at: now, ...T, role: "tech" }], history: [...mem.docs[sp2].history, { key: "released", at: now + 1000, ...T }] } })).ok,
      "with Release: After a lab supervisor signs off, a technician can't release"); }
  { // Restore: a backup loads into a copy with no samples, by its lab manager only, and comes back as it was.
    const backup = {};
    for (const coll of ["settings", "access", "meta", "tagidx", "samples", "blind", "batches", "stock", "ledger", "files"])
      for (let after = ""; after != null; ){ const r = await one("boss@site.com", { op: "export", coll, after }); r.docs.forEach(x => { backup[x.path] = x.data; }); after = r.next; }
    const mem2 = createMemoryStore(), core2 = createCore({ store: mem2, adminEmails: ["new@lab.org"] });
    const one2 = async (who, op) => (await core2.handleDb(P(who), { ops: [op] })).body.results[0];
    const docs = Object.entries(backup).map(([path, data]) => ({ path, data }));
    check(!(await one("boss@site.com", { op: "restore", docs: docs.slice(0, 2) })).ok, "a copy that has samples won't take a backup");
    check((await one2("new@lab.org", { op: "restore", check: true })).empty && !(await one2("someone@lab.org", { op: "restore", docs: docs.slice(0, 2) })).ok, "the new copy is empty; only its lab manager restores");
    check(!(await one2("new@lab.org", { op: "restore", docs: [{ path: "auth/secret", data: { k: "x" } }] })).ok && !(await one2("new@lab.org", { op: "restore", docs: [{ path: "samples/X", data: [1] }] })).ok, "only records of a backup are taken");
    check(!(await one2("new@lab.org", { op: "restore", docs: Array.from({ length: 501 }, (_, i) => ({ path: "meta/n" + i, data: {} })) })).ok, "a backup is sent in parts");
    const settingsFirst = [...docs].sort((x, y) => (y.path === "settings/stages") - (x.path === "settings/stages"));
    let sent = 0;
    for (let i = 0; i < settingsFirst.length; i += 40) sent += (await one2("new@lab.org", { op: "restore", docs: settingsFirst.slice(i, i + 40) })).written || 0;
    check(sent === docs.length && (await one2("new@lab.org", { op: "restore", done: true, records: sent })).done, `all ${docs.length} records are loaded, Settings first`);
    const same2 = docs.filter(x => x.path !== "settings/stages").every(x => JSON.stringify(mem2.docs[x.path]) === JSON.stringify(x.data));
    check(same2 && docs.some(x => x.path.startsWith("blind/")), "every record comes back exactly as it was saved, results files and blind links included");
    const st2 = mem2.docs["settings/stages"];
    check(st2.users.some(x => x.em === "new@lab.org" && x.role === "admin") && st2.users.some(x => x.em === "boss@site.com" && x.role === "admin") && JSON.stringify({ ...st2, users: null }) === JSON.stringify({ ...backup["settings/stages"], users: null }),
      "Settings come back with the person restoring kept as lab manager");
    check((await core2.account(P("new@lab.org"))).role === "admin" && (await core2.account(P("t1@site.com"))).role === "tech", "after the restore the restorer is lab manager and the staff keep their roles");
    check(!(await one2("new@lab.org", { op: "restore", check: true })).empty && !(await one2("new@lab.org", { op: "restore", docs: docs.slice(0, 1) })).ok, "once loaded, the copy takes no second backup");
    check(!(await one2(null, { op: "get", path: "_restore/state" })).ok && !Object.keys(backup).some(k => k.startsWith("_restore")), "the restore's own note is not readable or in a backup");
    check((await one2(null, { op: "get", path: "samples/" + id })).data.id === id, "a restored sample is looked up by ID as before"); }

  console.log(`\n${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
