// GET /api/me: the signed-in Microsoft account and the role the lab manager gave it in Settings.
const { getCore } = require("../lib/instance");
const { principalOf } = require("../lib/core");
module.exports = async function (context, req){
  const json = (status, body) => { context.res = { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body }; };
  try { const r = await getCore((...a) => context.log.error(...a)).handleMe(principalOf(req.headers)); json(r.status, r.body); }
  catch (e){
    context.log.error("api/me", e && (e.stack || e.message || e));
    json(500, { error: { code: "server", message: e && /COSMOS_CONNECTION_STRING/.test(e.message) ? e.message : "Server error" } });
  }
};
