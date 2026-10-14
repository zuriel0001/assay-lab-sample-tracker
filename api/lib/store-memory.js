// In-memory document store with the same behaviour as the Cosmos DB store. Used by the local dev server and the tests.
// `docs` maps "collection/id" to the stored record, so tests can read and seed it directly (call touch() after a direct change).
const { merge, matches, clone, sortAndLimit } = require("./docutil");

function createMemoryStore(){
  const docs = {}, meta = {}, leases = {};
  let last = 0;
  const stamp = () => { last = Math.max(last + 1, Date.now()); return last; };
  const touch = p => { meta[p] = { u: stamp(), del: !(p in docs) }; };
  return {
    kind: "memory", docs, leases, touch,
    async get(p){ return p in docs ? clone(docs[p]) : null; },
    async query(coll, where, opts = {}){
      const n = coll.split("/").length + 1;
      let rows = Object.keys(docs).filter(k => k.startsWith(coll + "/") && k.split("/").length === n).sort()
        .filter(k => matches(docs[k], where)).map(k => ({ path: k, data: clone(docs[k]) }));
      return sortAndLimit(rows, opts);
    },
    async set(p, data, { create } = {}){
      if (create && p in docs) throw { code: "exists" };
      docs[p] = clone(data); touch(p);
    },
    async update(p, patch){
      if (!(p in docs)) throw { code: "not_found" };
      docs[p] = merge(docs[p], clone(patch)); touch(p);
      return clone(docs[p]);
    },
    async remove(p){ delete docs[p]; touch(p); },
    async changes(since){
      return Object.entries(meta).filter(([, m]) => m.u > since).map(([p, m]) => ({ path: p, data: m.del || !(p in docs) ? null : clone(docs[p]), u: m.u }));
    },
    async peekLease(p){ const l = leases[p]; return l && l.exp > Date.now() ? { holder: l.holder, exp: l.exp } : null; },
    async acquire(p, holder, ttl){
      const now = Date.now(), l = leases[p];
      if (l && l.exp > now && l.holder !== holder) return { acquired: false, expiresAt: new Date(l.exp).toISOString() };
      leases[p] = { holder, exp: now + ttl };
      return { acquired: true, holder, expiresAt: new Date(now + ttl).toISOString() };
    }
  };
}
module.exports = { createMemoryStore };
