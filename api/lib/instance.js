// One store and one API core per Functions instance, configured from the app settings.
const { createCore } = require("./core");
let core = null;
function getCore(log){
  if (core) return core;
  const conn = process.env.COSMOS_CONNECTION_STRING;
  let store;
  if (conn) store = require("./store-cosmos").createCosmosStore(conn);
  else if (process.env.STORE === "memory") store = require("./store-memory").createMemoryStore();
  else throw new Error("COSMOS_CONNECTION_STRING is not set. Add it under Settings > Environment variables of the Static Web App.");
  core = createCore({ store, adminEmails: String(process.env.ADMIN_EMAILS || "").split(/[,;\s]+/), log });
  return core;
}
module.exports = { getCore };
