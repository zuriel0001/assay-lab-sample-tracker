// Azure Cosmos DB (NoSQL API) document store. One container, partitioned by collection.
// Record: { id, pk: collection path, p: full path, d: the document, u: change stamp (ms), del: true once deleted }.
// Leases live in the same container under pk "_lease". Every read-modify-write uses the record's ETag.
const { CosmosClient } = require("@azure/cosmos");
const { merge, matches, clone, sortAndLimit, FIELD, refuse } = require("./docutil");

const DB = process.env.COSMOS_DATABASE || "tracker", CONTAINER = process.env.COSMOS_CONTAINER || "docs";
const enc = s => encodeURIComponent(s);     // Cosmos ids can't hold / \ ? #
const split = p => { const i = p.lastIndexOf("/"); return { pk: p.slice(0, i), id: enc(p.slice(i + 1)) }; };
let last = 0;
const stamp = () => { last = Math.max(last + 1, Date.now()); return last; };
const status = e => e && (e.code || e.statusCode);

function createCosmosStore(connectionString){
  const client = new CosmosClient(connectionString);
  let ready = null;
  /* Creates the database and its one container (1000 RU/s: the whole Cosmos DB free tier) on first use. The throughput sits on
     the container, not shared across the database, so a point-in-time restore brings the container back like any other. */
  const box = () => ready || (ready = (async () => {
    const { database } = await client.databases.createIfNotExists({ id: DB });
    const { container } = await database.containers.createIfNotExists({ id: CONTAINER, partitionKey: { paths: ["/pk"] }, throughput: +(process.env.COSMOS_THROUGHPUT || 1000) });
    return container;
  })().catch(e => { ready = null; throw e; }));

  async function readRec(p){
    const c = await box(), { pk, id } = split(p);
    try { const r = await c.item(id, pk).read(); return r.resource ? { rec: r.resource, etag: r.etag || r.resource._etag } : null; }
    catch (e){ if (status(e) === 404) return null; throw e; }
  }
  async function write(p, prev, next){            // prev: { rec, etag } or null; throws { code: "conflict" } if someone else wrote first
    const c = await box(), { pk, id } = split(p);
    const body = { id, pk, p, ...next, u: stamp() };
    try {
      if (prev) await c.item(id, pk).replace(body, { accessCondition: { type: "IfMatch", condition: prev.etag } });
      else await c.items.create(body);
    } catch (e){ if (status(e) === 412 || status(e) === 409) throw { code: "conflict" }; throw e; }
  }
  async function retry(fn){
    for (let i = 0; ; i++){
      try { return await fn(); }
      catch (e){ if (!(e && e.code === "conflict") || i >= 8) throw e; await new Promise(r => setTimeout(r, 20 + Math.random() * 60 * (i + 1))); }
    }
  }
  const cond = (f, op, i) => {
    const x = `c.d["${f}"]`, v = "@v" + i;
    return { "==": `${x} = ${v}`, "!=": `(IS_DEFINED(${x}) AND ${x} != ${v})`, "<": `${x} < ${v}`, "<=": `${x} <= ${v}`, ">": `${x} > ${v}`, ">=": `${x} >= ${v}`,
      "in": `ARRAY_CONTAINS(${v}, ${x})`, "not-in": `(IS_DEFINED(${x}) AND NOT ARRAY_CONTAINS(${v}, ${x}))`, "array-contains": `ARRAY_CONTAINS(${x}, ${v})` }[op];
  };

  return {
    kind: "cosmos",
    async get(p){ const r = await readRec(p); return r && !r.rec.del ? r.rec.d : null; },
    async query(coll, where, opts = {}){
      const c = await box();
      where.forEach(([f]) => { if (!FIELD.test(f)) throw { code: "bad_request" }; });
      // Sorting and the limit run in the database, so a list of the newest 200 reads 200 records, not the whole collection.
      const ob = opts.orderBy && FIELD.test(opts.orderBy[0]) ? ` ORDER BY c.d["${opts.orderBy[0]}"] ${opts.orderBy[1] === "desc" ? "DESC" : "ASC"}` : "";
      const top = opts.limit ? `TOP ${Math.max(1, Math.min(5000, opts.limit | 0))} ` : "";
      const q = `SELECT ${top}c.p, c.d FROM c WHERE c.pk = @pk AND NOT IS_DEFINED(c.del)` + where.map(([f, op], i) => " AND " + cond(f, op, i)).join("") + ob;
      const parameters = [{ name: "@pk", value: coll }, ...where.map(([, , v], i) => ({ name: "@v" + i, value: v }))];
      const { resources } = await c.items.query({ query: q, parameters }, { partitionKey: coll }).fetchAll();
      const rows = resources.filter(r => r.d && matches(r.d, where)).map(r => ({ path: r.p, data: r.d })).sort((a, b) => a.path < b.path ? -1 : 1);
      return sortAndLimit(rows, opts);
    },
    /* check(current, next): see store-memory.js. It runs inside the ETag-guarded read-modify-write, so it judges what is replaced. */
    async set(p, data, { create, check } = {}){
      await retry(async () => {
        const prev = await readRec(p), live = prev && !prev.rec.del;
        if (create && live) throw { code: "exists" };
        refuse(check, live ? clone(prev.rec.d) : null, clone(data));
        await write(p, prev, { d: clone(data) });
      });
    },
    async update(p, patch, { check } = {}){
      return retry(async () => {
        const prev = await readRec(p);
        if (!prev || prev.rec.del) throw { code: "not_found" };
        const d = merge(prev.rec.d, clone(patch));
        refuse(check, clone(prev.rec.d), clone(d));
        await write(p, prev, { d });
        return d;
      });
    },
    async page(coll, after, n){
      const c = await box();
      const { resources } = await c.items.query({ query: `SELECT TOP ${Math.max(1, Math.min(1000, n | 0))} c.p, c.d FROM c WHERE c.pk = @pk AND NOT IS_DEFINED(c.del) AND c.p > @a ORDER BY c.p`,
        parameters: [{ name: "@pk", value: coll }, { name: "@a", value: after || "" }] }, { partitionKey: coll }).fetchAll();
      return resources.map(r => ({ path: r.p, data: r.d }));
    },
    async remove(p){
      await retry(async () => { const prev = await readRec(p); if (!prev || prev.rec.del) return; await write(p, prev, { d: null, del: true }); });
    },
    async changes(since){
      const c = await box();
      const { resources } = await c.items.query({ query: 'SELECT c.p, c.d, c.u, c.del FROM c WHERE c.u > @s AND c.pk != "_lease"', parameters: [{ name: "@s", value: since }] }).fetchAll();
      return resources.map(r => ({ path: r.p, data: r.del ? null : r.d, u: r.u }));
    },
    async peekLease(p){
      const c = await box();
      try { const r = await c.item(enc(p), "_lease").read(); const l = r.resource; return l && l.exp > Date.now() ? { holder: l.holder, exp: l.exp } : null; }
      catch (e){ if (status(e) === 404) return null; throw e; }
    },
    async acquire(p, holder, ttl){
      const c = await box(), id = enc(p);
      for (let i = 0; i < 6; i++){
        let cur = null;
        try { const r = await c.item(id, "_lease").read(); if (r.resource) cur = { rec: r.resource, etag: r.etag || r.resource._etag }; }
        catch (e){ if (status(e) !== 404) throw e; }
        const now = Date.now();
        if (cur && cur.rec.exp > now && cur.rec.holder !== holder) return { acquired: false, expiresAt: new Date(cur.rec.exp).toISOString() };
        const body = { id, pk: "_lease", holder, exp: now + ttl, ttlHint: ttl };
        try {
          if (cur) await c.item(id, "_lease").replace(body, { accessCondition: { type: "IfMatch", condition: cur.etag } });
          else await c.items.create(body);
          return { acquired: true, holder, expiresAt: new Date(now + ttl).toISOString() };
        } catch (e){ if (status(e) !== 412 && status(e) !== 409) throw e; }
      }
      return { acquired: false, expiresAt: new Date(Date.now() + 500).toISOString() };
    }
  };
}
module.exports = { createCosmosStore };
