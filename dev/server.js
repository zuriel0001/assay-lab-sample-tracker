// Local stand-in for Azure Static Web Apps, for trying the app and running the tests without Azure.
// Serves app/, imitates the /.auth sign-in (type any email, or an example username such as tech1), and runs the same API core.
//   node dev/server.js            -> http://localhost:4280 with an in-memory database (lost when stopped)
//   COSMOS_CONNECTION_STRING=... node dev/server.js   -> uses a real Cosmos DB account instead
const http = require("http"), fs = require("fs"), path = require("path");
const { createCore, requestProblem } = require("../api/lib/core");
const { createMemoryStore } = require("../api/lib/store-memory");

const APP = path.join(__dirname, "..", "app");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };
/* The page's example accounts. Locally they sign in by username; on Azure they need a Microsoft email on Settings. */
const DEV_USERS = [
  { u: "admin", name: "Lab Manager", role: "admin" }, { u: "super", name: "Lab Supervisor", role: "super" },
  { u: "tech1", name: "Lab Technician A", role: "tech" }, { u: "tech2", name: "Lab Technician B", role: "tech" },
  { u: "viewer", name: "Site Viewer", role: "viewer" },
  { u: "exp", name: "Exploration (results)", role: "section", sec: "EXP" }, { u: "plant", name: "Process plant (results)", role: "section", sec: "PLT" }
];
const cookies = req => Object.fromEntries((req.headers.cookie || "").split(/;\s*/).filter(Boolean).map(c => { const i = c.indexOf("="); return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))]; }));
const principalFor = who => ({ identityProvider: "aad", userId: "dev-" + Buffer.from(who).toString("hex").slice(0, 24), userDetails: who, userRoles: ["anonymous", "authenticated"] });

function start({ port = 4280, store = null, adminEmails = (process.env.ADMIN_EMAILS || "").split(/[,;\s]+/), devUsers = DEV_USERS, quiet = false } = {}){
  if (!store) store = process.env.COSMOS_CONNECTION_STRING ? require("../api/lib/store-cosmos").createCosmosStore(process.env.COSMOS_CONNECTION_STRING) : createMemoryStore();
  const core = createCore({ store, adminEmails, devUsers, log: (...a) => console.error(...a) });
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    const send = (status, body, headers = {}) => { res.writeHead(status, { "Cache-Control": "no-store", ...headers }); res.end(body); };
    const json = (status, obj) => send(status, JSON.stringify(obj), { "Content-Type": "application/json" });
    const who = cookies(req).devauth || "";
    const principal = who ? principalFor(who) : null;
    try {
      if (url.pathname === "/.auth/login/aad"){
        const back = url.searchParams.get("post_login_redirect_uri") || "/";
        return send(200, `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Sign in (local)</title>
          <body style="font:16px system-ui;max-width:420px;margin:40px auto;padding:0 16px"><h2>Local sign-in</h2>
          <p>On Azure this is the Microsoft sign-in page. Here, type an email (or an example username such as <code>tech1</code>).</p>
          <form method="post" action="/.auth/dev-login"><input name="who" autofocus required style="font-size:16px;padding:8px;width:100%">
          <input type="hidden" name="back" value="${back.replace(/"/g, "&quot;")}"><p><button style="font-size:16px;padding:8px 16px">Sign in</button></p></form></body>`, { "Content-Type": "text/html; charset=utf-8" });
      }
      if (url.pathname === "/.auth/dev-login" && req.method === "POST"){
        const body = new URLSearchParams(await readBody(req));
        const w = String(body.get("who") || "").trim().toLowerCase(), back = body.get("back") || "/";
        return send(302, "", { "Set-Cookie": `devauth=${encodeURIComponent(w)}; Path=/; HttpOnly; SameSite=Lax`, Location: back.startsWith("/") ? back : "/" });
      }
      if (url.pathname === "/.auth/logout"){
        const back = url.searchParams.get("post_logout_redirect_uri") || "/";
        return send(302, "", { "Set-Cookie": "devauth=; Path=/; Max-Age=0", Location: back.startsWith("/") ? back : "/" });
      }
      if (url.pathname === "/.auth/me") return json(200, { clientPrincipal: principal });
      if (url.pathname === "/api/me"){ const r = await core.handleMe(principal); return json(r.status, r.body); }
      if (url.pathname === "/api/db" && req.method === "POST"){
        const bad = requestProblem(req.headers); if (bad) return json(403, { error: { code: "permission_denied", message: bad } });
        let body; try { body = JSON.parse(await readBody(req)); } catch { return json(400, { error: { code: "bad_request" } }); }
        const r = await core.handleDb(principal, body); return json(r.status, r.body);
      }
      if (url.pathname.startsWith("/api/")) return json(404, { error: { code: "not_found" } });
      let file = path.normalize(path.join(APP, decodeURIComponent(url.pathname)));
      if (!file.startsWith(APP)) return send(403, "");
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(APP, "index.html");
      return send(200, fs.readFileSync(file), { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    } catch (e){ console.error(e); return json(500, { error: { code: "server" } }); }
  });
  return new Promise(resolve => server.listen(port, () => {
    const p = server.address().port;
    if (!quiet) console.log(`MET Lab Sample Tracker (local) on http://localhost:${p}  database: ${store.kind}`);
    resolve({ port: p, store, server, close: () => new Promise(r => server.close(r)) });
  }));
}
function readBody(req){
  return new Promise((resolve, reject) => { let n = 0; const parts = []; req.on("data", c => { n += c.length; if (n > 30e6) { reject(new Error("too large")); req.destroy(); } else parts.push(c); }); req.on("end", () => resolve(Buffer.concat(parts).toString("utf8"))); req.on("error", reject); });
}
module.exports = { start, DEV_USERS, principalFor };
if (require.main === module) start({ port: +process.env.PORT || 4280 });
