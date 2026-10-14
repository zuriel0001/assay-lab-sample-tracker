// POST /api/db  { ops: [ { op: "get" | "query" | "set" | "update" | "delete" | "acquire" | "changes", ... } ] }
const { getCore } = require("../lib/instance");
const { principalOf } = require("../lib/core");
module.exports = async function (context, req){
  const json = (status, body) => { context.res = { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body }; };
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const r = await getCore((...a) => context.log.error(...a)).handleDb(principalOf(req.headers), body);
    json(r.status, r.body);
  } catch (e){
    context.log.error("api/db", e && (e.stack || e.message || e));
    json(500, { error: { code: "server", message: e && /COSMOS_CONNECTION_STRING/.test(e.message) ? e.message : "Server error" } });
  }
};
