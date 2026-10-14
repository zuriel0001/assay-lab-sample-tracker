// Email sign-in run by this site, for people without a Microsoft account: a login is an email and a password.
// Logins, the signing key and the counters that slow down password guessing are kept in the same database under auth/…
// records, which /api/db never reads or writes (core.js only knows its own collections).
const crypto = require("crypto");

const COOKIE = "__Host-trk";
const SESSION_MS = 12 * 3600e3, RENEW_MS = 6 * 3600e3;   // a session lasts 12 hours and is renewed while the page is in use
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, KEYLEN = 32;
const MIN_PW = 10, MAX_PW = 200;
const LIMIT = { email: 5, ip: 50 }, WINDOW = 15 * 60e3;   // failed tries per email and per address, per 15 minutes
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* Records keyed by an email use the same key the page uses for access requests. */
const accessKey = em => [...String(em || "").toLowerCase()].map(c => /[a-z0-9._-]/.test(c) ? c : "~" + c.codePointAt(0).toString(16) + "~").join("").slice(0, 190);
/* An access request from an email login is kept apart from one made with a Microsoft account of the same address. */
const requestKey = (em, via) => (via === "email" ? "email!" : "") + accessKey(em);
const header = (headers, k) => (headers && (headers[k] || headers[k.toLowerCase()] || headers[k.toUpperCase()])) || "";
const b64u = buf => Buffer.from(buf).toString("base64url");
const fail = (status, code, message) => ({ status, body: { error: { code, message } } });

function scrypt(pw, salt, len, opts){
  return new Promise((resolve, reject) => crypto.scrypt(String(pw).normalize("NFKC"), salt, len, opts, (e, k) => e ? reject(e) : resolve(k)));
}
async function hashPassword(pw){
  const salt = crypto.randomBytes(16), k = await scrypt(pw, salt, KEYLEN, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${b64u(salt)}$${b64u(k)}`;
}
async function checkPassword(pw, h){
  const [alg, N, r, p, s, k] = String(h || "").split("$");
  if (alg !== "scrypt" || !s || !k) return false;
  const want = Buffer.from(k, "base64url");
  const got = await scrypt(pw, Buffer.from(s, "base64url"), want.length, { N: +N, r: +r, p: +p, maxmem: SCRYPT.maxmem });
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}
/* A temporary password the lab manager reads out to the person: no look-alike characters. */
function tempPassword(){
  const abc = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(crypto.randomBytes(12), b => abc[b % abc.length]).join("");
}
function cookieOf(headers){
  for (const c of String(header(headers, "cookie")).split(/;\s*/)){ const i = c.indexOf("="); if (i > 0 && c.slice(0, i) === COOKIE) return c.slice(i + 1); }
  return "";
}
/* The address a request came from (Static Web Apps passes it on), for slowing down guessing from one place. */
function clientIp(headers){
  let v = String(header(headers, "x-azure-clientip") || header(headers, "x-client-ip") || String(header(headers, "x-forwarded-for")).split(",")[0] || "").trim();
  const m = v.match(/^\[([^\]]+)\](?::\d+)?$/);
  v = m ? m[1] : /^[\d.]+:\d+$/.test(v) ? v.replace(/:\d+$/, "") : v;   // drop the port
  return v.slice(0, 64);   // "" when unknown: then only the per-email count applies
}
const sessionCookie = (token, ms) => ({ name: COOKIE, value: token, maxAge: Math.floor(ms / 1000) });

function createAuth({ store, secret = process.env.AUTH_SECRET || "" }){
  let key = secret ? Buffer.from(secret) : null;
  /* The signing key is made once and kept in the database, so the lab manager has nothing to set up. */
  async function signingKey(){
    if (key) return key;
    let d = await store.get("auth/secret");
    if (!d){
      try { await store.set("auth/secret", { k: b64u(crypto.randomBytes(32)), at: Date.now() }, { create: true }); }
      catch (e){ if (!(e && e.code === "exists")) throw e; }
      d = await store.get("auth/secret");
    }
    key = Buffer.from(d.k, "base64url");
    return key;
  }
  const mac = async body => b64u(crypto.createHmac("sha256", await signingKey()).update(body).digest());
  async function issue(login){
    const body = b64u(JSON.stringify({ e: login.em, s: login.sv, x: Date.now() + SESSION_MS }));
    return body + "." + await mac(body);
  }
  async function verify(token){
    const [body, sig] = String(token || "").split(".");
    if (!body || !sig) return null;
    const want = Buffer.from(await mac(body)), got = Buffer.from(sig);
    if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
    let p; try { p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); } catch { return null; }
    return p && typeof p.e === "string" && p.x > Date.now() ? p : null;
  }
  const loginPath = em => "auth/login-" + accessKey(em);
  const cache = new Map();
  async function login(em, fresh){
    const c = cache.get(em);
    if (!fresh && c && Date.now() - c.at < 3000) return c.d;
    const d = await store.get(loginPath(em));
    cache.set(em, { at: Date.now(), d });
    if (cache.size > 500) cache.delete(cache.keys().next().value);
    return d;
  }
  async function save(em, d, opts){ await store.set(loginPath(em), d, opts); cache.delete(em); }

  /* The person signed in with an email login, if the request carries a valid session for a login that still exists. */
  async function principal(headers){
    const p = await verify(cookieOf(headers));
    if (!p) return null;
    const l = await login(p.e);
    if (!l || l.sv !== p.s) return null;   // a password change or reset ends the older sessions
    return { identityProvider: "email", userId: "email:" + l.em, userDetails: l.em, via: "email", mustChange: !!l.mc, renew: p.x - Date.now() < RENEW_MS };
  }
  async function renewal(pr){
    if (!pr || pr.via !== "email" || !pr.renew) return null;
    const l = await login(pr.userDetails);
    return l ? sessionCookie(await issue(l), SESSION_MS) : null;
  }

  /* Failed tries are counted per email (whether or not it has a login, so the answer gives nothing away) and per address. */
  const tryPath = (kind, v) => `auth/try-${kind}-${kind === "e" ? accessKey(v) : accessKey(v).slice(0, 80)}`;
  async function blocked(em, ip){
    const now = Date.now();
    for (const [p, max] of [em ? [tryPath("e", em), LIMIT.email] : null, ip ? [tryPath("ip", ip), LIMIT.ip] : null].filter(Boolean)){
      const t = await store.get(p);
      if (t && now - t.since < WINDOW && t.n >= max) return true;
    }
    return false;
  }
  async function count(em, ip){
    const now = Date.now();
    for (const p of [em ? tryPath("e", em) : null, ip ? tryPath("ip", ip) : null].filter(Boolean)){
      const t = await store.get(p);
      await store.set(p, t && now - t.since < WINDOW ? { n: t.n + 1, since: t.since } : { n: 1, since: now });
    }
  }
  const clear = async em => { await store.remove(tryPath("e", em)); };

  const tooMany = () => fail(429, "too_many", "Too many tries. Wait 15 minutes and try again.");
  const wrong = () => fail(401, "wrong", "Email or password is wrong.");
  const pwProblem = pw => typeof pw !== "string" || pw.length < MIN_PW ? `Use at least ${MIN_PW} characters for the password.` : pw.length > MAX_PW ? "That password is too long." : "";
  let dummy = null;
  const burn = async pw => { dummy = dummy || await hashPassword("not a password at all"); await checkPassword(pw || "", dummy); };   // same time whether or not the login exists

  /* POST /api/auth { op: "signup" | "signin" | "signout" | "password" | "reset", ... }. pr is who sends it (Microsoft or email
     sign-in, see core.js); accountOf maps a principal to its role. */
  async function handle(pr0, body, { accountOf, ip }){
    const op = body && body.op, em = String((body && body.email) || "").trim().toLowerCase();
    if (op === "signout") return { status: 200, body: { ok: true }, cookie: sessionCookie("", 0) };
    if (op === "signup"){
      if (Object.keys(body).some(k => !["op", "email", "password", "name", "note"].includes(k))) return fail(400, "bad_request", "Not a valid sign-up.");
      const name = String(body.name || "").trim(), note = String(body.note || "").trim();
      if (!EMAIL.test(em) || em.length > 190) return fail(400, "bad_request", "Type your full email address.");
      if (!name || name.length > 80) return fail(400, "bad_request", "Type your full name.");
      if (note.length > 200) return fail(400, "bad_request", "Section or job is too long.");
      const why = pwProblem(body.password); if (why) return fail(400, "weak", why);
      if (await blocked("", ip)) return tooMany();
      await count("", ip);   // sign-ups count against the address too, so one place can't make logins without end
      const l = { em, name, h: await hashPassword(body.password), sv: 1, at: Date.now() };
      try { await save(em, l, { create: true }); }
      catch (e){ if (e && e.code === "exists") return fail(409, "exists", "This email already has a login. Sign in instead."); throw e; }
      await store.set("access/" + requestKey(em, "email"), { em, name, note, at: Date.now(), status: "pending", via: "email" });
      const pr = { identityProvider: "email", userId: "email:" + em, userDetails: em, via: "email" };
      return { status: 200, body: { ok: true, me: await accountOf(pr) }, cookie: sessionCookie(await issue(l), SESSION_MS) };
    }
    if (op === "signin"){
      if (!EMAIL.test(em) || typeof body.password !== "string" || body.password.length > MAX_PW) return wrong();
      if (await blocked(em, ip)) return tooMany();
      const l = await login(em, true);
      if (!l){ await burn(body.password); await count(em, ip); return wrong(); }
      if (!await checkPassword(body.password, l.h)){ await count(em, ip); return wrong(); }
      await clear(em);
      const pr = { identityProvider: "email", userId: "email:" + em, userDetails: em, via: "email", mustChange: !!l.mc };
      return { status: 200, body: { ok: true, me: await accountOf(pr) }, cookie: sessionCookie(await issue(l), SESSION_MS) };
    }
    if (op === "password"){   // the signed-in person changes their own password
      const pr = pr0 && pr0.via === "email" ? pr0 : null;
      if (!pr) return fail(401, "signed_out", "Sign in again to change your password.");
      const why = pwProblem(body.next); if (why) return fail(400, "weak", why);
      if (await blocked(pr.userDetails, ip)) return tooMany();
      const l = await login(pr.userDetails, true);
      if (!l || typeof body.current !== "string" || !await checkPassword(body.current, l.h)){ await count(pr.userDetails, ip); return fail(401, "wrong", "The current password is wrong."); }
      if (body.next === body.current) return fail(400, "weak", "Choose a new password.");
      const n = { ...l, h: await hashPassword(body.next), sv: (l.sv || 0) + 1, mc: false };
      await save(l.em, n);
      return { status: 200, body: { ok: true, me: await accountOf({ ...pr, mustChange: false }) }, cookie: sessionCookie(await issue(n), SESSION_MS) };
    }
    if (op === "reset"){      // the lab manager gives a person a temporary password, to be changed at their next sign-in
      const me = await accountOf(pr0);
      if (me.role !== "admin") return fail(403, "permission_denied", "Only the lab manager resets passwords.");
      const l = await login(em, true);
      if (!l) return fail(404, "not_found", "No email login for " + em + ".");
      const temp = tempPassword();
      await save(em, { ...l, h: await hashPassword(temp), sv: (l.sv || 0) + 1, mc: true });
      await clear(em);
      return { status: 200, body: { ok: true, temp } };
    }
    return fail(400, "bad_request", "Unknown request.");
  }
  return { principal, renewal, handle, _issue: issue, _login: login };
}
module.exports = { createAuth, accessKey, requestKey, cookieOf, clientIp, COOKIE, hashPassword, checkPassword };
