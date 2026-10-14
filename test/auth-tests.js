// The site's own email sign-in (api/lib/auth.js through the API core), including tampering and password guessing. node test/auth-tests.js
const { createCore } = require("../api/lib/core");
const { createMemoryStore } = require("../api/lib/store-memory");
const { checkPassword } = require("../api/lib/auth");
let pass = 0, fail = 0;
const check = (ok, msg) => { if (ok){ pass++; console.log("PASS", msg); } else { fail++; console.log("FAIL", msg); } };
const ms = who => Buffer.from(JSON.stringify({ identityProvider: "aad", userId: "id-" + who, userDetails: who, userRoles: ["authenticated"] })).toString("base64");

(async () => {
  const mem = createMemoryStore();
  await mem.set("settings/stages", { users: [{ u: "mgr", name: "Manager", role: "admin", em: "boss@site.com" }, { u: "t1", name: "Tech One", role: "tech", em: "t1@site.com" }] });
  const core = createCore({ store: mem, adminEmails: ["boss@site.com"] });
  // Headers as the Functions host passes them: the session cookie, a Microsoft principal, the client's address.
  const H = ({ cookie, msUser, ip = "10.0.0.1" } = {}) => ({ "content-type": "application/json", "x-forwarded-for": ip + ":5555", ...(cookie ? { cookie: "other=1; __Host-trk=" + cookie } : {}), ...(msUser ? { "x-ms-client-principal": ms(msUser) } : {}) });
  const auth = (body, h = {}) => core.handleAuth(H(h), body);
  const me = async h => (await core.handleMe(await core.principal(H(h)))).body;
  const db = async (h, ...ops) => (await core.handleDb(await core.principal(H(h)), { ops })).body.results;
  const PW = "correct horse 42", now = Date.now();

  // Sign-up.
  check((await auth({ op: "signup", email: "ana@gmail.com", password: PW, name: "Ana", role: "admin" })).status === 400, "a sign-up can't carry a role");
  check((await auth({ op: "signup", email: "ana@gmail.com", password: PW, name: "Ana", via: "microsoft" })).status === 400, "nor any other field");
  check((await auth({ op: "signup", email: "ana@gmail.com", password: "short pw", name: "Ana" })).body.error.code === "weak", "a password under 10 characters is refused");
  check((await auth({ op: "signup", email: "not-an-email", password: PW, name: "Ana" })).status === 400 && (await auth({ op: "signup", email: "ana@gmail.com", password: PW, name: " " })).status === 400, "a sign-up needs a real email and a name");
  const su = await auth({ op: "signup", email: "Ana@Gmail.com", password: PW, name: "Ana Mensah", note: "MET lab" });
  const ana = su.cookie && su.cookie.value;
  check(su.status === 200 && su.cookie.name === "__Host-trk" && su.cookie.maxAge === 12 * 3600 && su.body.me.signedIn && su.body.me.role === null && su.body.me.via === "email" && su.body.me.email === "ana@gmail.com", "Gmail sign-up: signed in at once, with no role, as the lower-case address");
  const login = mem.docs["auth/login-ana~40~gmail.com"];
  check(/^scrypt\$16384\$8\$1\$/.test(login.h) && !JSON.stringify(mem.docs).includes(PW) && await checkPassword(PW, login.h), "the password is kept only as a salted scrypt hash");
  const rq = mem.docs["access/email!ana~40~gmail.com"];
  check(rq && rq.status === "pending" && rq.via === "email" && rq.name === "Ana Mensah" && rq.note === "MET lab" && !rq.role, "sign-up sends the access request in the same step");
  check((await auth({ op: "signup", email: "ana@gmail.com", password: PW + "x", name: "Other" })).status === 409, "an email can only have one login");
  await auth({ op: "signup", email: "ben@yahoo.com", password: PW, name: "Ben" });
  check(mem.docs["auth/login-ben~40~yahoo.com"].h !== login.h, "the same password gives a different hash for each login");
  const m1 = await me({ cookie: ana });
  check(m1.signedIn && m1.email === "ana@gmail.com" && m1.via === "email" && m1.role === null, "the session cookie signs the page in");

  // Tampering with the session.
  const [body, sig] = ana.split(".");
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url")), e: "boss@site.com" })).toString("base64url") + "." + sig;
  check(!(await me({ cookie: forged })).signedIn, "a session edited to another email is refused");
  check(!(await me({ cookie: body + ".AAAA" })).signedIn && !(await me({ cookie: "garbage" })).signedIn, "a session with a made-up signature is refused");
  const other = createCore({ store: createMemoryStore(), adminEmails: [] });
  const elsewhere = (await other.handleAuth(H(), { op: "signup", email: "boss@site.com", password: PW, name: "X" })).cookie.value;
  check(!(await me({ cookie: elsewhere })).signedIn, "a session signed with another key is refused");
  const realNow = Date.now; Date.now = () => realNow() - 13 * 3600e3;
  const old = await core._auth._issue(await core._auth._login("ana@gmail.com", true)); Date.now = realNow;
  check(!(await me({ cookie: old })).signedIn, "an expired session is refused");
  check((await core.handleMe(await core.principal(H({ cookie: ana })))).cookie === null, "a fresh session isn't renewed on every call");
  Date.now = () => realNow() - 7 * 3600e3; const aging = await core._auth._issue(await core._auth._login("ana@gmail.com", true)); Date.now = realNow;
  const rn = await core.handleMe(await core.principal(H({ cookie: aging })));
  check(rn.body.signedIn && rn.cookie && rn.cookie.value !== aging && (await me({ cookie: rn.cookie.value })).signedIn, "a session past half its life is renewed while the page is in use");
  check((await me({ cookie: ana, msUser: "t1@site.com" })).email === "t1@site.com", "a Microsoft sign-in comes first when both are present");

  // An email login never takes the role of a Microsoft account with the same address.
  const imp = (await auth({ op: "signup", email: "t1@site.com", password: PW, name: "Fake Tech" })).cookie.value;
  check((await me({ cookie: imp })).role === null && !(await db({ cookie: imp }, { op: "update", path: "samples/X-20260101-0001", data: { a: 1 } }))[0].ok, "signing up with a staff member's Microsoft address gives none of their access");
  const fakeBoss = (await auth({ op: "signup", email: "boss@site.com", password: PW, name: "Fake Boss" })).cookie.value;
  check((await me({ cookie: fakeBoss })).role === null, "ADMIN_EMAILS doesn't make an email login admin once an admin is on the account list");
  { const m2 = createMemoryStore(), c2 = createCore({ store: m2, adminEmails: ["first@gmail.com"] });
    const r = await c2.handleAuth(H(), { op: "signup", email: "first@gmail.com", password: PW, name: "First" });
    check(r.body.me.role === "admin" && r.body.me.bootstrap, "before any admin is on the list, an ADMIN_EMAILS email login is the first admin");
    await m2.set("settings/stages", { users: [{ u: "first", name: "First", role: "admin", em: "first@gmail.com", via: "email" }] });
    await new Promise(r => setTimeout(r, 3100));
    check((await c2.account(await c2.principal(H({ cookie: r.cookie.value })))).u === "first", "and keeps admin once saved on the list as an email login"); }

  // Approval, through the lab manager's Settings.
  check(!(await db({ cookie: ana }, { op: "set", path: "access/ana~40~gmail.com", data: { em: "ana@gmail.com", name: "Ana", at: Date.now(), status: "pending" } }))[0].ok, "an email login can't write the request of a Microsoft account of the same address");
  check(!(await db({ msUser: "ana@gmail.com" }, { op: "set", path: "access/email!ana~40~gmail.com", data: { em: "ana@gmail.com", name: "Ana", at: Date.now(), status: "pending" } }))[0].ok, "nor the other way round");
  check((await db({ cookie: ana }, { op: "get", path: "access/email!ana~40~gmail.com" }))[0].data.status === "pending", "the email login sees its own request");
  const pend = (await db({ msUser: "boss@site.com" }, { op: "query", coll: "access", where: [["status", "==", "pending"]] }))[0].docs;
  check(pend.some(d => d.data.em === "ana@gmail.com" && d.data.via === "email"), "the lab manager sees it, marked as an email login");
  const users = [...mem.docs["settings/stages"].users, { u: "ana", name: "Ana Mensah", role: "tech", em: "ana@gmail.com", via: "email" }];
  check((await db({ msUser: "boss@site.com" }, { op: "set", path: "settings/stages", data: { users } }))[0].ok, "the lab manager approves by adding the account (as an email login) in Settings");
  const m3 = await me({ cookie: ana });
  check(m3.role === "tech" && m3.u === "ana" && m3.name === "Ana Mensah", "the email login now signs in as a lab technician");
  check((await me({ msUser: "ana@gmail.com" })).role === null, "a Microsoft account with that address still has no role");
  check((await db({ cookie: ana }, { op: "get", path: "ledger/2026-10-14_EXP" }))[0].ok, "and the email login reads what staff read");

  // Password guessing.
  check((await auth({ op: "signin", email: "ana@gmail.com", password: "wrong password" })).body.error.message === "Email or password is wrong." &&
    (await auth({ op: "signin", email: "nobody@gmail.com", password: "wrong password" })).body.error.message === "Email or password is wrong.", "a wrong password and an unknown email get the same answer");
  for (let i = 0; i < 5; i++) await auth({ op: "signin", email: "ben@yahoo.com", password: "guess " + i }, { ip: "10.0.0." + (20 + i) });
  check((await auth({ op: "signin", email: "ben@yahoo.com", password: PW }, { ip: "10.0.0.99" })).status === 429, "after 5 wrong passwords the email is held for 15 minutes, even with the right password, from anywhere");
  for (let i = 0; i < 5; i++) await auth({ op: "signin", email: "ghost@gmail.com", password: "guess " + i }, { ip: "10.0.1." + i });
  check((await auth({ op: "signin", email: "ghost@gmail.com", password: PW }, { ip: "10.0.1.99" })).status === 429, "an email without a login is held the same way (nothing to tell them apart)");
  for (let i = 0; i < 50; i++) await auth({ op: "signin", email: `x${i}@gmail.com`, password: "guess" }, { ip: "192.0.2.7" });
  check((await auth({ op: "signin", email: "ana@gmail.com", password: PW }, { ip: "192.0.2.7" })).status === 429 && (await auth({ op: "signin", email: "ana@gmail.com", password: PW }, { ip: "192.0.2.8" })).status === 200, "50 wrong tries from one address hold that address, not others");
  check((await auth({ op: "signup", email: "new@gmail.com", password: PW, name: "New" }, { ip: "192.0.2.7" })).status === 429, "and it can't make new logins meanwhile");
  const si = await auth({ op: "signin", email: "ana@gmail.com", password: PW });
  check(si.status === 200 && si.body.me.role === "tech" && si.cookie.value, "the right password signs in");

  // Passwords: the lab manager's reset, and changing one's own.
  check((await auth({ op: "reset", email: "ben@yahoo.com" }, { cookie: ana })).status === 403 && (await auth({ op: "reset", email: "ben@yahoo.com" }, { msUser: "t1@site.com" })).status === 403, "only the lab manager resets passwords");
  const rs = await auth({ op: "reset", email: "ana@gmail.com" }, { msUser: "boss@site.com" });
  check(rs.status === 200 && /^[a-z2-9]{12}$/.test(rs.body.temp), "the lab manager gets a temporary password, once");
  check(!(await me({ cookie: si.cookie.value })).signedIn, "a reset ends the person's open sessions");
  const t = await auth({ op: "signin", email: "ana@gmail.com", password: rs.body.temp });
  const tc = t.cookie.value, mt = await me({ cookie: tc });
  check(t.status === 200 && mt.mustChange && mt.role === null && !(await db({ cookie: tc }, { op: "get", path: "ledger/2026-10-14_EXP" }))[0].ok, "with the temporary password the person has no access until they choose a new one");
  check((await auth({ op: "password", current: "wrong one!!", next: "a brand new one" }, { cookie: tc })).status === 401, "changing it needs the current password");
  check((await auth({ op: "password", current: rs.body.temp, next: "short" }, { cookie: tc })).body.error.code === "weak", "and a new one of at least 10 characters");
  const ch = await auth({ op: "password", current: rs.body.temp, next: "a brand new one" }, { cookie: tc });
  check(ch.status === 200 && ch.body.me.role === "tech" && !ch.body.me.mustChange && (await me({ cookie: ch.cookie.value })).role === "tech", "after changing it the person is back in");
  check(!(await me({ cookie: tc })).signedIn, "the session from before the change ends");
  check((await auth({ op: "signin", email: "ben@yahoo.com", password: PW }, { ip: "10.0.0.98" })).status === 429 && (await auth({ op: "reset", email: "ben@yahoo.com" }, { msUser: "boss@site.com" })).status === 200, "a reset also lifts a hold");
  check((await auth({ op: "password", current: PW, next: "something else 1" }, { msUser: "t1@site.com" })).status === 401, "a Microsoft account has no password here to change");
  const so = await auth({ op: "signout" }, { cookie: ch.cookie.value });
  check(so.status === 200 && so.cookie.maxAge === 0 && so.cookie.value === "", "sign-out clears the session cookie");

  // The page's API never reaches logins.
  const adm = { msUser: "boss@site.com" };
  const r1 = await db(adm, { op: "get", path: "auth/secret" }, { op: "get", path: "auth/login-ana~40~gmail.com" }, { op: "query", coll: "auth", where: [] }, { op: "export", coll: "auth" }, { op: "set", path: "auth/login-ana~40~gmail.com", data: { h: "x" } });
  check(r1.every(r => !r.ok), "the database API can't read, list, export or write logins, even for the lab manager");
  const ch2 = (await db(adm, { op: "changes", since: now - 1 }))[0].changes;
  check(ch2.length > 0 && !ch2.some(c => c.path.startsWith("auth/")), "live changes never carry logins");

  // The Azure Functions entry point.
  process.env.STORE = "memory"; process.env.ADMIN_EMAILS = "";
  const fn = require("../api/auth/index.js");
  const ctx = () => ({ log: Object.assign(() => {}, { error: () => {} }), res: null });
  let c = ctx(); await fn(c, { headers: { "content-type": "application/json" }, body: { op: "signup", email: "fn@gmail.com", password: PW, name: "Fn" } });
  const ck = c.res.cookies && c.res.cookies[0];
  check(c.res.status === 200 && ck && ck.name === "__Host-trk" && ck.httpOnly && ck.secure && ck.sameSite === "Strict" && ck.path === "/", "Functions entry /api/auth sets an HttpOnly, Secure, SameSite=Strict cookie");
  c = ctx(); await fn(c, { headers: { "content-type": "text/plain" }, body: JSON.stringify({ op: "signin", email: "fn@gmail.com", password: PW }) });
  check(c.res.status === 403, "another website's form can't post to it");
  c = ctx(); await fn(c, { headers: { "content-type": "application/json" }, body: { op: "signout" } });
  check(c.res.cookies[0].maxAge === 0 && c.res.cookies[0].expires.getTime() === 0, "sign-out from the Functions entry expires the cookie");

  console.log(`\n${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
