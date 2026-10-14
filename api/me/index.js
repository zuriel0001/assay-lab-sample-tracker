// GET /api/me: the signed-in person (Microsoft account or email login) and the role the lab manager gave it in Settings.
const { getCore } = require("../lib/instance");
const { sessionCookies } = require("../lib/core");
module.exports = async function (context, req){
  const json = (status, body, cookie) => { context.res = { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body, ...(cookie ? { cookies: sessionCookies(cookie) } : {}) }; };
  try { const core = getCore((...a) => context.log.error(...a)); const r = await core.handleMe(await core.principal(req.headers)); json(r.status, r.body, r.cookie); }
  catch (e){
    context.log.error("api/me", e && (e.stack || e.message || e));
    json(500, { error: { code: "server", message: e && /COSMOS_CONNECTION_STRING/.test(e.message) ? e.message : "Server error" } });
  }
};
