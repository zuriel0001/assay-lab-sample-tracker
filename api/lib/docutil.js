// Shared document helpers: the update merge, where-filters, ordering and limits.
// They follow the db capability the prototype was written for, so the page behaves the same on Azure.

const clone = o => o == null ? o : JSON.parse(JSON.stringify(o));
const isMap = x => x && typeof x === "object" && !Array.isArray(x);
/* An update merges maps recursively; arrays and plain values replace; null is stored as null (the page reads it as absent). */
function merge(a, b){
  const o = { ...a };
  for (const k in b) o[k] = isMap(b[k]) && isMap(a[k]) ? merge(a[k], b[k]) : b[k];
  return o;
}
const OPS = ["==", "!=", "<", "<=", ">", ">=", "in", "not-in", "array-contains"];
const FIELD = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
function validWhere(where){
  if (!Array.isArray(where) || where.length > 6) return false;
  return where.every(c => Array.isArray(c) && c.length === 3 && FIELD.test(c[0]) && OPS.includes(c[1]) &&
    (!["in", "not-in"].includes(c[1]) || (Array.isArray(c[2]) && c[2].length <= 30)));
}
function ok(d, [f, op, v]){
  const x = d ? d[f] : undefined; if (x === undefined) return false;
  switch (op){
    case "==": return x === v; case "!=": return x !== v; case "<": return x < v; case "<=": return x <= v; case ">": return x > v; case ">=": return x >= v;
    case "in": return v.includes(x); case "not-in": return !v.includes(x); case "array-contains": return Array.isArray(x) && x.includes(v);
  }
  return false;
}
const matches = (d, where) => (where || []).every(c => ok(d, c));
/* rows are { path, data }, already sorted by path. */
function sortAndLimit(rows, { orderBy, limit } = {}){
  if (orderBy){ const [f, dir] = orderBy; rows.sort((a, b) => ((a.data[f] > b.data[f]) - (a.data[f] < b.data[f])) * (dir === "desc" ? -1 : 1)); }
  if (limit) rows = rows.slice(0, limit);
  return rows;
}
/* Deep equality of stored values; a key holding null counts as absent, as the page reads it. */
function same(x, y){
  if (x === y) return true;
  if (x == null || y == null) return x == null && y == null;
  if (typeof x !== "object" || typeof y !== "object" || Array.isArray(x) !== Array.isArray(y)) return false;
  if (Array.isArray(x)) return x.length === y.length && x.every((v, i) => same(v, y[i]));
  const kx = Object.keys(x).filter(k => x[k] != null), ky = Object.keys(y).filter(k => y[k] != null);
  return kx.length === ky.length && kx.every(k => same(x[k], y[k]));
}
/* Runs a store write's check(current, next) and refuses the write when it gives a reason. */
function refuse(check, cur, next){
  const why = check ? check(cur, next) : "";
  if (why) throw { code: "permission_denied", message: why };
}
module.exports = { clone, merge, matches, validWhere, sortAndLimit, FIELD, same, refuse };
