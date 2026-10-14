// POST /api/auth  { op: "signup" | "signin" | "signout" | "password" | "reset", ... }: this site's own email sign-in (lib/auth.js).
const { getCore } = require("../lib/instance");
const { requestProblem, sessionCookies } = require("../lib/core");
module.exports = async function (context, req){
  const json = (status, body, cookie) => { context.res = { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body, ...(cookie ? { cookies: sessionCookies(cookie) } : {}) }; };
  const bad = requestProblem(req.headers);
  if (bad) return json(403, { error: { code: "permission_denied", message: bad } });
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const r = await getCore((...a) => context.log.error(...a)).handleAuth(req.headers, body);
    json(r.status, r.body, r.cookie);
  } catch (e){
    context.log.error("api/auth", e && (e.stack || e.message || e));
    json(500, { error: { code: "server", message: e && /COSMOS_CONNECTION_STRING/.test(e.message) ? e.message : "Server error" } });
  }
};
