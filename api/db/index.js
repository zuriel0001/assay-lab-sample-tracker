// POST /api/db  { ops: [ { op: "get" | "query" | "set" | "update" | "delete" | "acquire" | "changes", ... } ] }
const { getCore } = require("../lib/instance");
const { requestProblem, errorDetail } = require("../lib/core");
module.exports = async function (context, req){
  const json = (status, body) => { context.res = { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body }; };
  const bad = requestProblem(req.headers);
  if (bad) return json(403, { error: { code: "permission_denied", message: bad } });
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const core = getCore((...a) => context.log.error(...a));
    const r = await core.handleDb(await core.principal(req.headers), body);
    json(r.status, r.body);
  } catch (e){
    context.log.error("api/db", e && (e.stack || e.message || e));
    json(500, { error: { code: "server", message: e && /COSMOS_CONNECTION_STRING/.test(e.message) ? e.message : "Server error" + (errorDetail(e) ? " (" + errorDetail(e) + ")" : "") } });
  }
};
