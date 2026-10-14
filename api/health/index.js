// GET /api/health: whether the database steps behind a sample submission work on this site (see core.js handleHealth).
const { getCore } = require("../lib/instance");
const { errorDetail } = require("../lib/core");
module.exports = async function (context){
  const json = (status, body) => { context.res = { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body }; };
  try {
    const r = await getCore((...a) => context.log.error(...a)).handleHealth();
    json(r.status, r.body);
  } catch (e){
    json(500, { error: { code: "server", message: e && /COSMOS_CONNECTION_STRING/.test(e.message) ? e.message : "Server error (" + (errorDetail(e) || "error") + ")" } });
  }
};
