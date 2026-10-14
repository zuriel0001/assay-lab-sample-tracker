// In-memory document store with the same behaviour as the Cosmos DB store. Used by the local dev server and the tests.
// `docs` maps "collection/id" to the stored record, so tests can read and seed it directly (call touch() after a direct change).
const { merge, matches, clone, sortAndLimit, refuse } = require("./docutil");

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
    /* check(current, next) returns why a write is refused, or "" (see core.js); it sees the record as it is at the moment of writing. */
    async set(p, data, { create, check } = {}){
      if (create && p in docs) throw { code: "exists" };
      refuse(check, p in docs ? clone(docs[p]) : null, clone(data));
      docs[p] = clone(data); touch(p);
    },
    async update(p, patch, { check } = {}){
      if (!(p in docs)) throw { code: "not_found" };
      const next = merge(docs[p], clone(patch));
      refuse(check, clone(docs[p]), clone(next));
      docs[p] = next; touch(p);
      return clone(docs[p]);
    },
    async remove(p){ delete docs[p]; touch(p); },
    /* One page of a collection in path order, after the given path (for backups). */
    async page(coll, after, n){
      return Object.keys(docs).filter(k => k.startsWith(coll + "/") && k.split("/").length === 2 && k > after).sort().slice(0, n).map(k => ({ path: k, data: clone(docs[k]) }));
    },
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
