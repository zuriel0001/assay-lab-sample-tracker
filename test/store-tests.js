// The same checks on both document stores: in-memory (local/tests) and Cosmos DB (Azure).
// Cosmos runs against @vercel/cosmosdb-server, a local Cosmos DB imitation, when it can be found (NODE_PATH or COSMOS_SERVER_MODULE);
// or against a real account when COSMOS_CONNECTION_STRING is set (it creates and uses database "tracker-test").
//   node test/store-tests.js
const path = require("path");
const { createMemoryStore } = require("../api/lib/store-memory");
let pass = 0, fail = 0;
const check = (ok, msg) => { if (ok){ pass++; console.log("  PASS", msg); } else { fail++; console.log("  FAIL", msg); } };

async function suite(name, s){
  console.log("• " + name);
  await s.set("samples/A-1", { id: "A-1", open: true, n: 3, tags: ["T1", "T2"], sec: "EXP", m: { x: { a: 1 }, y: 2 } });
  await s.set("samples/A-2", { id: "A-2", open: false, n: 1, tags: ["T3"], sec: "PLT" });
  await s.set("samples/A-3", { id: "A-3", open: true, n: 2, tags: [], sec: "EXP" });
  await s.set("tagidx/T~2f~1", { sid: "A-1" });
  check((await s.get("samples/A-1")).m.x.a === 1, "set and get");
  check((await s.get("tagidx/T~2f~1")).sid === "A-1", "ids with unusual characters");
  check(await s.get("samples/none") === null, "missing record reads as null");
  let e = null; try { await s.set("samples/A-1", { id: "x" }, { create: true }); } catch (x){ e = x; }
  check(e && e.code === "exists", "create refuses an existing record");
  const u = await s.update("samples/A-1", { m: { x: { b: 2 }, y: null }, n: 4 });
  const g = await s.get("samples/A-1");
  check(g.m.x.a === 1 && g.m.x.b === 2 && g.m.y === null && g.n === 4 && u.n === 4, "update merges maps and keeps nulls");
  e = null; try { await s.update("samples/none", { a: 1 }); } catch (x){ e = x; }
  check(e && e.code === "not_found", "update needs an existing record");
  const q = async (w, o) => (await s.query("samples", w, o)).map(r => r.path.split("/")[1]).join(",");
  check(await q([["open", "==", true]]) === "A-1,A-3", "== filter");
  check(await q([["sec", "!=", "EXP"]]) === "A-2", "!= filter");
  check(await q([["n", ">=", 2], ["n", "<", 4]]) === "A-3", "range filters");
  check(await q([["sec", "in", ["PLT", "GEO"]]]) === "A-2", "in filter");
  check(await q([["sec", "not-in", ["PLT"]]]) === "A-1,A-3", "not-in filter");
  check(await q([["tags", "array-contains", "T2"]]) === "A-1", "array-contains filter");
  check(await q([["missing", "==", null]]) === "", "a missing field matches nothing");
  check(await q([], { orderBy: ["n", "desc"], limit: 2 }) === "A-1,A-3", "order and limit");
  check((await q([["open", "==", true]], { limit: 1 })).split(",").length === 1, "limit without order");
  check(await q([["open", "==", true], ["n", ">", 0]], { orderBy: ["n", "desc"], limit: 1 }) === "A-1", "filters, order and limit together (newest first)");
  check(await q([["tags", "array-contains", "T2"]], { orderBy: ["n", "asc"], limit: 5 }) === "A-1", "array-contains with order");
  await new Promise(r => setTimeout(r, 30));     // change stamps can run a few ms ahead of the clock when writes share a millisecond
  const t0 = Date.now();
  await new Promise(r => setTimeout(r, 5));
  await s.update("samples/A-3", { n: 5 });
  await s.remove("samples/A-2");
  await s.set("files/RF-0123456789ABCDEF~1", { id: "RF-0123456789ABCDEF~1", data: "QUJD" });
  const ch = await s.changes(t0);
  check(ch.some(c => c.path === "samples/A-3" && c.data.n === 5) && ch.some(c => c.path === "samples/A-2" && c.data === null) && !ch.some(c => c.path === "samples/A-1"), "changes since a time, including deletes");
  check(!ch.some(c => c.path.startsWith("files/")) && (await s.get("files/RF-0123456789ABCDEF~1")).data === "QUJD", "results files are kept and read by ID, but left out of changes");
  check(await s.get("samples/A-2") === null && await q([["sec", "==", "PLT"]]) === "", "a deleted record is gone from reads and queries");
  await s.set("samples/A-2", { id: "A-2", sec: "PLT" }, { create: true });
  check((await s.get("samples/A-2")).sec === "PLT", "a deleted record can be created again");
  const l1 = await s.acquire("samples/A-1", "h1", 1000), l2 = await s.acquire("samples/A-1", "h2", 1000), l3 = await s.acquire("samples/A-1", "h1", 1000);
  check(l1.acquired && !l2.acquired && l2.expiresAt && l3.acquired, "leases: one holder at a time, renewable");
  check((await s.peekLease("samples/A-1")).holder === "h1" && await s.peekLease("samples/A-9") === null, "a lease can be looked at");
  await new Promise(r => setTimeout(r, 1100));
  check((await s.acquire("samples/A-1", "h2", 1000)).acquired, "an expired lease can be taken");
  // Two writers merging into one record at once (the ledger pattern): nothing is lost.
  await s.set("ledger/D", { day: "D", m: {} });
  await Promise.all(Array.from({ length: 8 }, (_, i) => s.update("ledger/D", { m: { ["k" + i]: { i } } })));
  check(Object.keys((await s.get("ledger/D")).m).length === 8, "concurrent updates to one record all land");
  // A write check sees the record as it is and the result of the write, and can refuse it.
  let seen = null, err = null;
  await s.update("ledger/D", { m: { k9: { i: 9 } } }, { check: (cur, next) => { seen = [Object.keys(cur.m).length, Object.keys(next.m).length]; return ""; } });
  try { await s.update("ledger/D", { m: { k0: null } }, { check: (cur, next) => next.m.k0 == null ? "no removing" : "" }); } catch (e){ err = e; }
  check(seen && seen[0] === 9 - 1 && seen[1] === 9 && err && err.code === "permission_denied" && err.message === "no removing" && (await s.get("ledger/D")).m.k0.i === 0, "a write check sees before and after, and its refusal leaves the record as it was");
  err = null; try { await s.set("ledger/D", { day: "D", m: {} }, { check: cur => cur && Object.keys(cur.m).length ? "keep" : "" }); } catch (e){ err = e; }
  check(err && err.code === "permission_denied" && Object.keys((await s.get("ledger/D")).m).length === 9, "a write check also guards a full rewrite");
  // Pages of a collection in path order (the backup download).
  const p1 = await s.page("samples", "", 2), p2 = await s.page("samples", p1[p1.length - 1].path, 2);
  check(p1.map(x => x.path).join() === "samples/A-1,samples/A-2" && p2.map(x => x.path).join() === "samples/A-3" && p1.every(x => x.data && typeof x.data === "object"), "a collection reads page by page, in order");
  // 21 Oct: a job's sample has the plant's code as its ID, which can hold a space or a "+" (MLNSCOF 20261018). Its record works like any other.
  const J1 = "samples/MLNSCOF 20261018", J2 = "samples/MLNSBR+425 20261018", t1 = Date.now() - 1;
  await s.set(J1, { id: "MLNSCOF 20261018", sec: "JOB", n: 1 });
  await s.set(J2, { id: "MLNSBR+425 20261018", sec: "JOB", n: 2 }, { create: true });
  await s.update(J1, { n: 3 });
  await s.set("stock/MLNSCOF 20261018", { shelf: "A1" });
  check((await s.get(J1)).n === 3 && (await s.get(J2)).id === "MLNSBR+425 20261018" && (await s.get("stock/MLNSCOF 20261018")).shelf === "A1" &&
    (await s.query("samples", [["sec", "==", "JOB"]])).map(r => r.path).join() === [J1, J2].sort().join(), "a job sample whose ID holds a space or a + is written, read, updated and found");
  check((await s.changes(t1)).some(c => c.path === J1 && c.data.n === 3) && (await s.page("samples", "", 50)).some(x => x.path === J2), "its changes and the backup's pages carry its own path");
  const lj = await s.acquire(J1, "h1", 1000);
  await s.remove(J2);
  check(lj.acquired && await s.get(J2) === null && !(await s.page("samples", "", 50)).some(x => x.path === J2), "it can be leased and removed");
}

(async () => {
  await suite("in-memory store", createMemoryStore());
  const { createCosmosStore, docId } = require("../api/lib/store-cosmos");
  console.log("• Cosmos DB record ids");
  const plain = ["MET-20261015-0001", "B-MET-20261020-0001", "RF-0123456789ABCDEF~1", "T~2f~1", "login-boss~40~site.test", "email!a~40~b.c", "2026-10-21_MET", "x(1)!*'"];
  check(plain.every(k => docId(k) === k && encodeURIComponent(k) === k), "a key that was its own id (encodeURIComponent left it as it is) keeps that id");
  const odd = ["MLNSCOF 20261018", "MLNSBR+425 20261018", "A&B", "Ü", "a%b", "~u~41", "~u~h" + "0".repeat(64), "X".repeat(150) + " " + "Y".repeat(49)];
  const ids = [...plain, ...odd].map(docId);
  check(ids.every(i => /^[A-Za-z0-9\-_.!~*'()]+$/.test(i) && i.length <= 250) && new Set(ids).size === ids.length, "no id holds a % (or a space or a +), none is longer than 250, and different keys never share one: " + odd.slice(0, 3).map(docId).join(", "));
  if (process.env.COSMOS_CONNECTION_STRING){
    process.env.COSMOS_DATABASE = "tracker-test";
    await suite("Cosmos DB (" + process.env.COSMOS_CONNECTION_STRING.split(";")[0] + ")", createCosmosStore(process.env.COSMOS_CONNECTION_STRING));
  } else {
    let mod = null; try { mod = require(process.env.COSMOS_SERVER_MODULE || "@vercel/cosmosdb-server"); } catch {}
    if (!mod) console.log("• Cosmos DB: skipped (install @vercel/cosmosdb-server or set COSMOS_CONNECTION_STRING)");
    else {
      const server = mod.createHttpServer();
      // The real service refuses a "%" in an item's id (401 on a read, as an id written by encodeURIComponent was); so does the imitation.
      const handler = server.listeners("request")[0];
      server.removeAllListeners("request");
      server.on("request", (req, res) => {
        if (/\/docs\/[^/?]*%25/.test(req.url)){ res.writeHead(401, { "Content-Type": "application/json" }); res.end(JSON.stringify({ code: "Unauthorized", message: "The input authorization token can't serve the request." })); return; }
        handler(req, res);
      });
      await new Promise(r => server.listen(0, r));
      const port = server.address().port;
      const cs = createCosmosStore(`AccountEndpoint=http://localhost:${port}/;AccountKey=${Buffer.from("dummy").toString("base64")};`);
      await suite("Cosmos DB store on a local Cosmos imitation", cs);
      const pr = await cs.probeIds();
      check(pr.plain === 404 && pr.space === 404 && pr.percent && pr.percent.code === 401, `the imitation refuses a "%" in an id as the service does, and reads this store's ids (${JSON.stringify({ plain: pr.plain, space: pr.space, percent: pr.percent && pr.percent.code })})`);
      server.close();
    }
  }
  console.log(`\n${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
