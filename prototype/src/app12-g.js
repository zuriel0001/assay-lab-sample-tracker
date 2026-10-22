
/* ---------- results ---------- */
/* v31: a sample sent for other analyses too reports theirs after its own: the ticked analyses' results (each once) and one per analysis
   typed by name. */
const resMemo = new WeakMap();
function resOf(s){
  const b = RESULTS[s?.test] || RESULTS.fa_aas, t2 = s?.tests2 || [], xa = s?.xan || [];
  if (!t2.length && !xa.length) return b;
  const m = resMemo.get(s); if (m && m.t2 === t2 && m.xa === xa) return m.out;
  const an = [...b.an];
  for (const k of t2) for (const a of RESULTS[k]?.an || []) if (!an.some(x => x.k === a.k)) an.push(a);
  // a typed analysis the sample already reports (Cu among a cyanide test's metals) is that result, asked for; any other gets its own
  const rest = xa.filter(n => { const i = an.findIndex(a => [a.k, a.s, a.n].some(x => x && normCol(x) === normCol(n))); if (i >= 0) an[i] = { ...an[i], opt: false }; return i < 0; });
  an.push(...xAns(rest, an));
  const out = { ...b, an };
  resMemo.set(s, { t2, xa, out });
  return out;
}
/* The results this sample reports. One repeated by gravimetric finish takes that method's limits; one repeated by dilution has no upper limit. */
function anOf(s){
  const res = resOf(s), g = RESULTS.fa_grav.an[0], dil = s?.dil || [];
  if (!s?.grav && !dil.length) return res.an;
  return res.an.map(a => a.k === s.grav ? { ...a, n: a.n + " (gravimetric finish)", dl: g.dl, dp: g.dp, ul: null } : dil.includes(a.k) ? { ...a, n: a.n + " (diluted re-run)", ul: null } : a);
}
const aAn = t => (/^[aeiou]/i.test(t) ? "an " : "a ") + t;
const anShort = a => a.s || (/^[A-Z][a-z]?$/.test(a.k) ? a.k : a.n);
/* The database merges an update into the stored record, map by map, so a result, a batch membership or a field of one that goes away is
   written as null (patch: each new value replaces the old one whole, so a value typed over one read from a file loses src) and read as
   absent (live). */
const live = o => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v != null));
const isMap = o => !!o && typeof o === "object" && !Array.isArray(o);
const patch = (old, now) => ({ ...Object.fromEntries(Object.keys(old || {}).map(k => [k, null])), ...Object.fromEntries(Object.entries(now).map(([k, v]) => [k, isMap(v) && isMap(old?.[k]) ? patch(old[k], v) : v])) });
const rowsOf = s => live(s?.results?.rows);
/* v35: lab batches are gone. A record from before keeps its batches, read only: { [batch type]: { b: batch ID, q: QC status, n: note } }
   (version 11 kept one in labBatch). labFor names the batch behind one result; noLabs clears them when the results start again. */
function labsOf(s){
  if (!s) return {};
  if (s.labs) return live(s.labs);
  return s.labBatch ? { [s.qcp || "lab"]: { b: s.labBatch, q: s.labQc || "", n: s.labQcNote || "" } } : {};
}
const labText = s => Object.values(labsOf(s)).map(l => l.b).join(", ");
function labFor(s, k){
  const labs = labsOf(s); if (s.grav === k && labs.grav) return labs.grav.b;
  const g = (Array.isArray(s.qcg) ? s.qcg : []).find(x => (x.k || []).includes(k)) || (s.labBatch && !s.labs ? { p: s.qcp || "lab" } : null);
  return g && labs[g.p] ? labs[g.p].b : "";
}
const noLabs = s => Object.keys(labsOf(s)).length ? { labs: patch(s.labs, {}), lbs: [], labBatch: "", labQc: "", labQcNote: "" } : {};
const released = s => curIdx(s) >= targetIdx(s);
/* How a typed number reads. The dot is the decimal mark. A comma is read only where it can mean one thing: 0,85 and 12,5 (decimal comma),
   1,500.5 and 2,000,000 (thousands). 1,500 could be either, so it is refused for the technician to retype: nothing is guessed. */
function readNum(t){
  t = String(t).trim();
  if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) return { v: Number(t) };
  if (!t.includes(",")) return { bad: true };
  if (/^[+-]?\d{1,3}(,\d{3})+\.\d+$/.test(t) || /^[+-]?\d{1,3}(,\d{3}){2,}$/.test(t)) return { v: Number(t.replace(/,/g, "")) };
  if (/^[+-]?\d{1,3}(\.\d{3})+,\d+$/.test(t)) return { v: Number(t.replace(/\./g, "").replace(",", ".")) };
  if (/^[+-]?0,\d+$/.test(t)) return { v: Number(t.replace(",", ".")) };
  if (/^[+-]?\d{1,3},\d{3}$/.test(t)) return { amb: [Number(t.replace(",", "")), Number(t.replace(",", "."))] };
  if (/^[+-]?\d+,\d+$/.test(t)) return { v: Number(t.replace(",", ".")) };
  return { bad: true };
}
/* A typed result: a number, "<DL" (or "<0.005", "ND") below detection, ">x" over range; a listed choice for a picked result. */
function parseRes(raw, an){
  const t = String(raw ?? "").trim();
  if (!t) return null;
  if (an.t === "text") return { raw: t, v: null, f: "" };
  if (an.t === "pick") return (an.opts || []).includes(t) ? { raw: t, v: null, f: "" } : { bad: true, raw: t };
  if (/^(<|bdl$|nd$|n\.d\.?$)/i.test(t)) return { raw: t, v: null, f: "ldl" };
  const gt = /^>/.test(t), body = t.replace(/^>=?\s*/, ""), n = body ? readNum(body) : { bad: true };
  if (n.amb) return { amb: n.amb, raw: t };
  if (n.bad || !isFinite(n.v)) return { bad: true, raw: t };
  if (an.dl != null && n.v < an.dl) return { raw: t, v: null, f: "ldl" };
  return { raw: t, v: n.v, f: an.ul != null && (gt || n.v > an.ul) ? "over" : "" };
}
const resWrong = (r, a, where = a.n) => r.amb ? `${where}: “${r.raw}” could be ${fmtNum(r.amb[0])} or ${fmtNum(r.amb[1])}. Retype it without the comma.`
  : a.t === "pick" ? `${where}: choose one of the listed values.` : `${where}: “${r.raw}” is not a number. Type a number, or <DL when below detection.`;
/* What a number box will be read as, shown under it while typing. */
function numHint(el){
  const a = { dl: el.dataset.dl ? +el.dataset.dl : null, ul: el.dataset.ul ? +el.dataset.ul : null }, r = parseRes(el.value, a);
  let box = el.parentElement.querySelector(".numhint");
  if (!box){ box = document.createElement("span"); box.className = "numhint small"; el.insertAdjacentElement("afterend", box); }
  const t = !r ? "" : r.amb ? `${fmtNum(r.amb[0])} or ${fmtNum(r.amb[1])}? Retype without the comma` : r.bad ? "not a number" : r.f === "ldl" ? "below detection" : r.f === "over" ? `over the range (${fmtNum(a.ul)})` : /,/.test(r.raw) ? `reads as ${fmtNum(r.v)}` : "";
  box.textContent = t; box.classList.toggle("bad", !!r && (r.bad || !!r.amb || r.f === "over"));
}
document.addEventListener("input", e => { const el = e.target.closest?.("[data-num]"); if (el) numHint(el); });
const resNum = r => !r ? null : r.f === "ldl" ? 0 : r.v;
function resText(r, a){
  if (!r) return "—";
  if (a.t === "text" || a.t === "pick") return r.raw;
  if (r.f === "ldl") return "<" + (a.dl != null ? fmtNum(a.dl) : "DL");
  if (a.dp == null) return fmtNum(r.v);
  const t = (+r.v).toFixed(a.dp);
  return +t === 0 && +r.v !== 0 ? fmtNum(r.v) : t;   // v37: a result is never printed as 0 when it is not (NaCN 0.45 read "0")
}
function resCell(r, a){
  const t = esc(resText(r, a));
  if (!r) return t;
  if (r.f === "over") return `${t} <span class="pill bad">over range</span>`;
  if (r.f === "lim" && a.lim != null) return `${t} <span class="pill warn">above ${esc(fmtNum(a.lim))}</span>`;
  if (r.f === "ldl") return `${t} <span class="small muted">below detection</span>`;
  if (r.calc) return `${t} <span class="small muted">calculated</span>`;
  return t;
}
const resSummary = (ans, rows) => ans.filter(a => rows[a.k]).slice(0, 4).map(a => `${anShort(a)} ${resText(rows[a.k], a)}${a.u ? " " + a.u : ""}`).join("; ") + (ans.filter(a => rows[a.k]).length > 4 ? "; …" : "");
/* A pick (such as the sampling point) describes the sample; it is never a missing result. */
/* v24: results attached as a file the site can't read (att) are complete as they stand: the file is the results. */
/* v24c: a results file on the sample (attached on the record or a batch, or from before "any file" was accepted) is its results:
   nothing is missing, in either release mode. */
const hasResFile = s => !!(s?.results?.att || s?.results?.file);
const missingRes = (s, rows = s.results?.rows || {}) => hasResFile(s) ? [] : anOf(s).filter(a => !a.opt && !a.calc && a.t !== "pick" && !rows[a.k]);
/* v24d: no results yet to release (no file, or values still to come). The step before release then offers "Move to: Results released",
   where the sample waits for them, instead of a release on hold. */
const resMissing = s => !s.results || missingRes(s).length > 0;
const overRes = (s, rows = s.results?.rows || {}) => anOf(s).filter(a => rows[a.k]?.f === "over");
/* Results worked out from others are never typed: they are set, or cleared, from their inputs whenever results are saved ("<DL" counts as 0). */
function withCalc(s, rows){
  const out = { ...rows };
  for (let pass = 0; pass < 3; pass++) for (const a of anOf(s)){
    if (!a.calc) continue;
    const v = {}; let ok = true;
    for (const k of a.from || []){ const x = resNum(out[k]); if (x == null){ ok = false; break; } v[k] = x; }
    for (const k of a.fromOpt || []){ const x = resNum(out[k]); if (x != null) v[k] = x; }   // v24d: inputs the calculation can do without (carbon mass: the standard 1 g)
    const n = ok ? a.calc(v) : null;
    if (n == null || !isFinite(n)){ delete out[a.k]; continue; }
    const x = +n.toFixed((a.dp ?? 4) + 2);
    out[a.k] = { raw: String(x), v: x, f: a.ul != null && x > a.ul ? "over" : "", calc: true, ...((a.from || []).some(k => out[k]?.f === "ldl") ? { dl0: true } : {}) };
  }
  return out;
}
/* The people who entered the results now on the sample, typed on the record or saved from a file. */
function entrants(s, rows = s?.results?.rows || {}){
  return [...new Set(Object.values(rows).filter(r => r && !r.calc).map(r => r.by || s.results?.by).filter(Boolean))];
}
/* Four eyes: whoever entered a result can't accept its failed checks or release it. The lab manager may, giving a reason that is recorded. */
const selfCheck = (s, rows) => session && entrants(s, rows).includes(session.u) ? (isAdmin() ? "admin" : "blocked") : "";
const relSelf = (s, rows) => relNow() ? "" : selfCheck(s, rows);
const SELF_MSG = "You entered results on this sample. Another lab supervisor or the lab manager reviews and releases them.";
/* Acceptance checks on one sample's results (balances, repeats, limits). */
function resultChecks(s, rows = s.results?.rows || {}){
  const out = [], num = k => resNum(rows[k]);
  for (const c of resOf(s).chk || []){
    let ok = null;
    if (c.t === "max"){ const x = num(c.k); if (x != null) ok = x <= c.max; }
    else if (c.t === "range"){ const x = num(c.k); if (x != null) ok = x >= c.lo && x <= c.hi; }
    else if (c.t === "pair"){ const a = rows[c.a], b = rows[c.b]; if (a && b && a.v != null && b.v != null){ const m = (a.v + b.v) / 2; ok = m === 0 || Math.abs(a.v - b.v) / m * 100 <= c.tol + 1e-9; } }
    else if (c.t === "sum"){ const xs = c.ks.map(num), h = num(c.k); if (h != null && xs.every(x => x != null)){ const t = xs.reduce((p, q) => p + q, 0); ok = h === 0 ? t === 0 : Math.abs(t - h) / h * 100 <= c.tol + 1e-9; } }
    else if (c.t === "le"){ const a = num(c.a), b = num(c.b); if (a != null && b != null) ok = a <= b * 1.0001; }
    if (ok !== null) out.push({ ...c, ok });
  }
  return out;
}
/* ---------- action and permit limits ---------- */
/* The results being worked on: a proposed amendment, else the results on the record. */
const effRows = s => s?.amend?.rows || s?.results?.rows || {};
/* The sampling point (or carbon type, or solution) given at submission, when the results list it: the results start from it and the limits
   for one point follow it until the results say otherwise. */
function ptGiven(s){ const a = anOf(s).find(x => x.t === "pick"), v = a && (s.details || {})[a.n]; return v && (a.opts || []).includes(v) ? v : ""; }
function limitHits(s, rows = effRows(s)){
  const out = [], pt = rows.pt?.raw || ptGiven(s);
  for (const l of cfg.limits || []){
    if ((l.route !== s.route && l.route !== s.baseRoute) || !rows[l.k]) continue;   // v24d: a sample of a shift job keeps its own route's limits
    if (l.when && pt && pt !== l.when) continue;   // no sampling point given: the limit applies
    const x = resNum(rows[l.k]); if (x == null) continue;
    if (l.op === "<" ? x < +l.val : x > +l.val) out.push({ ...l, raw: rows[l.k].raw, v: x, key: `${l.id}|${l.k}|${rows[l.k].raw}` });
  }
  return out;
}
const ackOf = (s, h) => (s.acks || []).find(a => a.key === h.key) || null;
const openAlerts = (s, rows) => limitHits(s, rows).filter(h => !ackOf(s, h));
function alertLine(s, h){
  const a = anOf(s).find(x => x.k === h.k) || { k: h.k, n: h.k, u: "" };
  return `${a.s || a.n} ${resText({ v: h.v, raw: h.raw, f: "" }, a)}${a.u ? " " + a.u : ""} is ${h.op === "<" ? "below" : "above"} the ${h.permit ? "permit limit" : "action limit"} of ${fmtNum(h.val)}${a.u ? " " + a.u : ""}${h.when ? ` (${h.when})` : ""}`;
}
/* What still stops a sample entering QA/QC review. */
function qcEntryBlock(s){
  const miss = missingRes(s);
  if (miss.length) return `Enter the results before QA/QC review. Missing: ${miss.map(a => a.s || a.n).join(", ")}.`;
  return "";
}
/* Next step the release, and nothing in the way of it but who releases. */
const readyRel = s => { const i = curIdx(s); return i >= 1 && !!planOf(s)[i + 1]?.target && !awaiting(s) && !releaseBlock(s); };
/* What still stops a supervisor releasing the results (who may release is checked separately: selfCheck). */
function releaseBlock(s){
  const miss = missingRes(s);
  if (miss.length) return `Results missing: ${miss.map(a => a.s || a.n).join(", ")}.`;
  if (relNow()) return "";   // QC, limits, range and checks are for the people who evaluate the results: they never hold them back
  const over = overRes(s);
  if (over.length) return `${over.map(a => a.s || a.n).join(", ")} is over the method's range. Re-assay it first.`;
  const bad = resultChecks(s).filter(c => !c.ok && !c.soft);
  if (bad.length && !s.resAcc) return `Results fail a check: ${bad.map(c => c.msg).join("; ")}. Re-assay, or a supervisor accepts it with a reason.`;
  const al = openAlerts(s);
  if (al.length) return `${al.map(h => alertLine(s, h)).join("; ")}. Record what was done and who was told first.`;
  return "";
}
/* A check code over the certificate's content, printed on it and shown on the sample record, so a copy can be checked against the register.
   Prototype only: the production system signs certificates on its server. */
function certCode(sid, c){
  const body = JSON.stringify([sid, c.no, c.at, c.by, (c.an || []).map(a => [a.k, a.u]), Object.keys(c.rows || {}).sort().map(k => [k, c.rows[k].raw])]);
  const h = seed => { let x = seed; for (const ch of body){ x ^= ch.codePointAt(0); x = Math.imul(x, 0x01000193) >>> 0; } return x.toString(16).padStart(8, "0"); };
  return (h(0x811c9dc5) + h(0x2f6b1a3d)).toUpperCase().match(/.{4}/g).join("-");
}
const ROLE_SIGN = { admin: "lab manager", super: "lab supervisor", tech: "lab technician" };
/* A certificate keeps its own copy of the results, their units and what stands behind each one (its lab batch, a calculation, or neither),
   so it reads the same however the method library changes later. */
function makeCert(s, at, why, x = {}){
  const certs = s.certs || [], prev = certs.at(-1), ans = anOf(s), rows = s.results?.rows || {};
  const cov = {};
  for (const a of ans){ if (!rows[a.k]) continue; cov[a.k] = rows[a.k].calc ? "calc" : labFor(s, a.k); }
  const c = { no: `${s.id}-R${certs.length + 1}`, v: certs.length + 1, at, by: session.u, tech: session.name, role: session.role,
    test: s.test || "", testName: s.testName || testOf(s.test)?.name || "", route: s.route || "", routeName: s.routeName || "",
    batch: labText(s), qc: s.labQc || "", qcNote: s.labQcNote || "", inst: s.results?.inst || "",
    an: ans.filter(a => rows[a.k]).map(a => ({ k: a.k, n: a.n, u: a.u, ...(a.dl != null ? { dl: a.dl } : {}), dp: a.dp, ...(a.t ? { t: a.t } : {}), ...(a.ul != null ? { ul: a.ul } : {}) })),
    rows: clone(live(rows)), cov, ents: entrants(s), acc: s.resAcc ? clone(s.resAcc) : null, soft: resultChecks(s).filter(c => !c.ok).map(c => c.msg),
    alerts: limitHits(s, rows).map(h => ({ line: alertLine(s, h), act: h.act, ack: ackOf(s, h) })),
    ...(x.self ? { self: x.self } : {}), ...(x.amendBy ? { amendBy: x.amendBy } : {}),
    ...(s.results?.file ? { file: clone(s.results.file) } : {}), ...(s.results?.att ? { att: true } : {}),
    ...(prev ? { amends: prev.no, why: why || s.lastRedo || "Results amended" } : {}) };
  c.code = certCode(s.id, c);
  return c;
}
/* Release: the results are frozen on a new certificate and each retained material starts its clock (kept from an earlier release). */
function releaseUpdate(s, at, note, wit, ref, selfWhy, certIn){
  const cert = certIn || makeCert(s, at, "", selfWhy ? { self: selfWhy } : {}), mats = (s.materials || []).length ? s.materials : materialsAt(s, at);
  const stored = (s.materials || []).length && keptMaterials(s).length && keptMaterials(s).every(m => m.loc);
  const key = stored ? "storage" : "released";
  return { stageKey: key, stageAt: at, relAt: at, relDay: dayKey(at), materials: mats, certs: [...(s.certs || []), cert],
    history: [...(s.history || []), { key: "released", sn: "Results released", at, by: session.u, tech: session.name, ref: [ref, cert.no].filter(Boolean).join(" · "), ...(wit ? { wit } : {}),
      note: (note ? note + ". " : "") + `Certificate ${cert.no} issued${cert.amends ? `, amending ${cert.amends}: ${cert.why}` : ""}${selfWhy ? `. Released by the person who entered the results: ${selfWhy}` : ""}` }] };
}
/* v24, release at once: when saved results complete a sample in analysis, the analysis steps left are recorded as done and the results are
   released in the same write, under the name of the person who saved them. A two-person custody sample is released so only when the
   results were saved with a witness (v24d: the results file dialog and the results form ask for one); that witness signs the release. */
function withRelease(s, res){
  if (!res || !relNow() || !canRelease()) return res;
  const upd = res.upd || res, h = upd.history, last = h && h.at(-1);
  if (!upd.results || !last || !last.res || last.redo || h.length <= (s.history || []).length) return res;
  const m = { ...s, ...upd }, p = planOf(m), ci = curIdx(m), ti = targetIdx(m), ph = stage(m, m.stageKey)?.phase;
  if (grouped(m)) return res;   // v24d: a sample in a batch is released with its batch, on the batch certificate (releaseGroup)
  const wit = twoPerson(m) ? last.wit || "" : "";
  if (awaiting(m) || (twoPerson(m) && !wit) || !(ci >= 1 && ci < ti && (ph === "test" || ph === "qc" || hasResFile(upd))) || releaseBlock(m)) return res;
  let at = Math.max(...h.map(e => +e.at || 0)) + 1000;
  const hist = [...h];
  for (let i = ci + 1; i < ti; i++){ hist.push({ key: p[i].key, sn: p[i].name, at, by: session.u, tech: session.name, note: "Done: results saved", ...(wit ? { wit } : {}) }); at += 1000; }
  const rel = releaseUpdate({ ...m, history: hist }, at, "Released when the results were saved", wit, "", "");
  Object.assign(upd, rel);
  if (res.upd && res.msg) res.msg += `. Released: certificate ${rel.certs.at(-1).no}`;
  return res;
}
/* A re-assay: the results so far move to the results history (a record from before v35 leaves its lab batches). */
function redoReset(s, at){
  return { results: null, resHist: [...(s.resHist || []), ...(s.results ? [s.results] : [])].slice(-30), resAcc: null, amend: null, ...noLabs(s) };
}
/* A new test clears the results (and a record's lab batches from before v35). */
function rerouteReset(s, r, test, at){
  const out = {};
  if (test === s.test) return out;
  if (s.results) Object.assign(out, { results: null, resHist: [...(s.resHist || []), s.results].slice(-30), resAcc: null, amend: null });
  return Object.assign(out, noLabs(s));
}
/* Staff see every result; a section account sees its own section's; anyone else only when an admin has opened results to everyone. */
const canSeeResults = s => isStaff() || (session?.role === "section" && !!s && s.section === session.sec) || !!cfg.resultsPublic;
function resTable(ans, rows, cov){
  const list = ans.filter(a => rows[a.k] || !a.opt);
  return `<div class="tbl-wrap"><table class="res"><thead><tr><th>Analyte</th><th>Result</th><th>Unit</th><th>Detection limit</th>${hasCov(cov) ? "<th>Quality control</th>" : ""}</tr></thead><tbody>
    ${list.map(a => `<tr><td>${esc(a.n)}</td><td class="mono">${resCell(rows[a.k], a)}</td><td>${esc(a.u || "")}</td><td class="mono">${a.dl != null ? esc(fmtNum(a.dl)) : "—"}</td>${hasCov(cov) ? `<td class="small">${covText(cov[a.k])}</td>` : ""}</tr>`).join("")}</tbody></table></div>`;
}
/* Certificates from before v35 name the lab batch behind each result; a column of calculations alone is not shown. */
const hasCov = cov => !!cov && Object.values(cov).some(c => c && c !== "calc");
const covText = c => c === "calc" ? "Calculated" : c ? `Lab batch <span class="mono">${esc(c)}</span>` : "Not in a lab batch";
const qcLabel = q => ({ pass: "QC passed", warn: "QC warnings", fail: "QC failed", accepted: "QC accepted by supervisor", none: "No QC in this run" })[q] || "";
const certLine = c => `<button type="button" class="linkish" data-cert="${c.v}">${esc(c.no)}</button> (${fmtDate(c.at)}${c.code ? `, check code <span class="mono nw">${esc(c.code)}</span>` : ""})`;
function resultsPanel(s){
  const ci = curIdx(s), ti = targetIdx(s), ph = stage(s, s.stageKey)?.phase, certs = s.certs || [], last = certs.at(-1);
  const entering = canEdit() && ci >= 0 && ci < ti && (ph === "test" || ph === "qc");
  const attachable = relNow() && canEdit() && !entering && canTakeFile(s);   // v24: a results file is taken at any step after receipt
  if (!s.results && !certs.length && !entering && !attachable && !Object.keys(labsOf(s)).length) return "";
  if (!canSeeResults(s)) return certs.length ? `<div class="panel stack" id="resPanel"><h3>Results</h3><p class="small muted" style="margin:0">Results were released on ${fmtDate(last.at)} on certificate <b class="mono">${esc(last.no)}</b>${last.code ? `, check code <span class="mono nw">${esc(last.code)}</span>` : ""}. The lab sends them to the submitting section; ask the Assay Lab for the certificate. A copy you hold is genuine if its number and check code match these.</p></div>` : "";
  const rows = s.results?.rows || {}, ans = anOf(s), draft = s.results && (!last || s.results.at > last.at);
  const checks = draft ? resultChecks(s) : [], bad = checks.filter(c => !c.ok);
  const over = draft ? overRes(s) : [];
  const parts = [reqNote(s)];
  if (last) parts.push(`<div class="stack" style="gap:6px">
      <div class="row" style="gap:8px"><span class="pill ok">Released</span><b>Certificate ${esc(last.no)}</b><span class="small muted">${fmtFull(last.at)} by ${esc(last.tech)}${last.code ? ` · check code <span class="mono nw">${esc(last.code)}</span>` : ""}</span>
        <button type="button" class="btn small" data-cert="${last.v}">View certificate</button></div>
      ${last.amends ? `<div class="small"><span class="pill warn">Amended</span> Replaces ${esc(last.amends)}: ${esc(last.why || "")}</div>` : ""}
      ${last.qcNote ? `<div class="small muted">${esc(last.qcNote)}</div>` : ""}${last.acc ? `<div class="small muted">Accepted outside a check by ${esc(last.acc.tech)}: ${esc(last.acc.why)}</div>` : ""}
      ${last.file ? `<div class="small">Results file: <button type="button" class="linkish mono" data-rfile="${esc(last.file.id)}">${esc(last.file.name)}</button>${last.att ? (last.an.length ? " · results not listed here are in the file" : " · the results are in this file") : ""}</div>` : ""}
      ${last.an.length ? resTable(last.an, last.rows, last.cov) : ""}
      ${certs.length > 1 ? `<div class="small muted">Earlier versions: ${certs.slice(0, -1).reverse().map(certLine).join(", ")}. They stay on record.</div>` : ""}
    </div>`);
  if (draft) parts.push(`<div class="stack" style="gap:6px">
      <div class="row" style="gap:8px"><span class="pill gold">${last ? "Re-assay results, not yet released" : "Not yet released"}</span><span class="small muted">Saved ${fmt(s.results.at)} by ${esc(s.results.tech || "")}${s.results.inst ? ` · ${esc(s.results.inst)}` : ""}</span>${s.results.file && isStaff() ? `<button type="button" class="linkish mono small" data-rfile="${esc(s.results.file.id)}">${esc(s.results.file.name)}</button>` : ""}</div>
      ${resTable(ans, rows)}
      ${over.length ? `<div class="notice bad"><b>Over the method's range:</b> ${over.map(a => `${esc(a.n)} above ${esc(fmtNum(a.ul))} ${esc(a.u)}`).join(", ")}. ${resOf(s).over ? `Repeat by ${esc(testOf(resOf(s).over)?.name || "")}.` : "Dilute and re-assay."}
        ${canEdit() && ci < ti ? `<div class="row" style="margin-top:6px"><button type="button" class="btn" id="overBtn">${resOf(s).over ? "Send for gravimetric finish" : "Send back for a diluted re-run"}</button></div>` : ""}</div>` : ""}
      ${relNow() ? "" : bad.length ? `<div class="notice ${bad.some(c => !c.soft) && !s.resAcc ? "bad" : "warn"}"><b>Check${bad.length > 1 ? "s" : ""} not met:</b> ${bad.map(c => esc(c.msg) + (c.soft ? " (reported, does not hold the release)" : "")).join("; ")}.
        ${s.resAcc ? `<div class="small">Accepted by ${esc(s.resAcc.tech)}, ${fmt(s.resAcc.at)}: ${esc(s.resAcc.why)}</div>` : bad.some(c => !c.soft) ? `<div class="small">The release is held until the sample is re-assayed or a lab supervisor who did not enter the results accepts it with a reason.</div>` : ""}
        ${!s.resAcc && bad.some(c => !c.soft) && canApprove() && selfCheck(s) !== "blocked" ? `<div class="row" style="margin-top:6px"><input class="inp" id="accWhy" data-clear placeholder="${selfCheck(s) === "admin" ? "You entered these results: reason for accepting them yourself" : "Reason for accepting (printed on the certificate)"}" style="flex:1 1 220px;width:auto"><button type="button" class="btn" id="accBtn">Accept with this reason</button></div>` : ""}</div>` : checks.length ? `<div class="small" style="color:var(--ok)">All checks met: ${checks.map(c => esc(c.msg.replace(/^the /, "").replace(/ (differ|is|differs|are|add).*$/, ""))).join("; ")}.</div>` : ""}
    </div>`);
  if (s.amend) parts.push(amendPending(s, last));
  parts.push(relNow() ? evalBox(s) : alertsBox(s));
  const lt = labText(s);   // a record from before v35
  if (lt) parts.push(`<div class="small">Lab batch${lt.includes(",") ? "es" : ""} <span class="mono">${esc(lt)}</span>${s.labQc && (!relNow() || canEval()) ? ` · ${esc(qcLabel(s.labQc))}` : ""}</div>`);
  if (entering) parts.push(resultsForm(s));
  else if (attachable) parts.push(`<div class="row"><button type="button" class="btn" data-attach="sample:${esc(s.id)}">Attach results file</button></div>`);
  if (last && canEdit() && !draft && !entering && !s.amend) parts.push(amendForm(s, last));
  return `<div class="panel stack" id="resPanel"><h3>Results</h3>${parts.join("")}</div>`;
}
/* A box for one result: a list for a picked result, read-only for a calculated one, a number box that shows how it reads otherwise. */
function resInput(id, a, raw, rows){
  if (a.calc) return `<div class="me-box mono" id="${id}">${rows && rows[a.k] ? esc(resText(rows[a.k], a)) : "—"} <span class="muted small" style="font-weight:400">worked out from ${esc(listAnd((a.from || []).map(k => (anOf(current?.body).find(x => x.k === k) || { n: k }).n)))}</span></div>`;
  if (a.t === "pick") return `<select class="inp" id="${id}" data-live><option value="">Choose…</option>${(a.opts || []).map(o => `<option ${o === raw ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
  if (a.t === "text") return `<textarea id="${id}" data-live>${esc(raw || "")}</textarea>`;
  return `<input id="${id}" data-live data-num ${a.dl != null ? `data-dl="${a.dl}"` : ""} ${a.ul != null ? `data-ul="${a.ul}"` : ""} inputmode="decimal" autocomplete="off" value="${esc(raw || "")}" placeholder="${a.dl != null ? `DL ${esc(fmtNum(a.dl))}` : ""}${a.ul != null ? ` · range to ${esc(fmtNum(a.ul))}` : ""}">`;
}
function resultsForm(s){
  const ans = anOf(s), rows = s.results?.rows || {};
  if (!ans.some(a => !a.calc)) return "";
  return `<div class="row"><button type="button" class="btn" data-attach="sample:${esc(s.id)}">Attach results file</button></div>
    <details class="more" id="resBox"><summary>${s.results ? "Correct results" : "Type results instead"}</summary>
    <div class="stack" style="gap:8px;margin-top:8px">
      <p class="small muted" style="margin:0">Type each result. Use <b>&lt;DL</b> when a result is below the detection limit. The dot is the decimal mark; a number such as 1,500 is refused because it could mean 1500 or 1.5.</p>
      <div class="form">${ans.map(a => `<label class="f${a.t === "text" ? " full" : ""}"><span>${esc(a.n)}${a.u ? ` (${esc(a.u)})` : ""}${a.opt ? ` <span class="muted" style="font-weight:400">optional</span>` : ""}</span>${resInput("rs_" + a.k, a, rows[a.k]?.raw || (a.t === "pick" ? ptGiven(s) : ""), rows)}</label>`).join("")}
        <label class="f"><span>Instrument file or worksheet</span><input id="rsInst" data-live autocomplete="off" value="${esc(s.results?.inst || "")}" placeholder="e.g. AAS run 13-10-02"></label>
      </div>
      <div class="row"><button type="button" class="btn primary" id="rsSave">Save results</button></div></div></details>`;
}
function alertsBox(s){
  const hits = limitHits(s); if (!hits.length) return "";
  const open = hits.filter(h => !ackOf(s, h));
  return `<div class="notice ${open.length ? "bad" : "warn"}" id="alertBox"><b>${hits.length === 1 ? "A result is" : `${hits.length} results are`} past a limit</b>
    <ul class="tight">${hits.map(h => { const ack = ackOf(s, h); return `<li>${esc(alertLine(s, h))}. <b>${esc(h.act)}.</b> ${ack ? `<span class="small">Recorded by ${esc(ack.tech)}, ${fmt(ack.at)}: ${esc(ack.note)}</span>` : `<span class="small">Not yet recorded; the release waits for it.</span>`}</li>`; }).join("")}</ul>
    ${open.length && canEdit() ? `<div class="row"><input class="inp" id="ackNote" data-clear placeholder="What was done and who was told, e.g. Re-analysed: 0.61 mg/L; Environment (A. Mensah) told by phone 14:20" style="flex:1 1 260px;width:auto"><button type="button" class="btn" id="ackBtn">Record</button></div>` : ""}</div>`;
}
function amendForm(s, last){
  const defs = anOf(s), list = [...last.an.map(a => defs.find(d => d.k === a.k) || a), ...defs.filter(d => !d.opt && !last.an.some(a => a.k === d.k))];
  return `<details class="more" id="amBox"><summary>Correct a reported result (amended certificate, approved by a second person)</summary>
    <div class="stack" style="gap:8px;margin-top:8px">
      <p class="small muted" style="margin:0">For a transcription or calculation error only. A result that needs re-testing goes back for re-assay instead. The corrected results go through the same range, check and limit tests as a first release, and another lab supervisor or the lab manager approves them before ${esc(last.no)} is replaced. ${esc(last.no)} stays on record.</p>
      <div class="form">${list.map(a => `<label class="f${a.t === "text" ? " full" : ""}"><span>${esc(a.n)}${a.u ? ` (${esc(a.u)})` : ""}</span>${resInput("am_" + a.k, a, last.rows[a.k]?.raw, last.rows)}</label>`).join("")}
        <label class="f full"><span>Reason (printed on the certificate) <span class="req">*</span></span><input id="amWhy" data-clear placeholder="e.g. Dilution factor applied twice in the worksheet"></label></div>
      <div class="row"><button type="button" class="btn" id="amBtn">Propose the amended certificate</button></div></div></details>`;
}
function amendPending(s, last){
  const a = s.amend, defs = anOf(s), keys = [...new Set([...Object.keys(last?.rows || {}), ...Object.keys(a.rows)])];
  const changed = keys.filter(k => (last?.rows[k]?.raw || "") !== (a.rows[k]?.raw || "")).map(k => { const d = defs.find(x => x.k === k) || (last?.an || []).find(x => x.k === k) || { k, n: k, u: "" };
    return `${esc(d.n)}: ${esc(last?.rows[k] ? resText(last.rows[k], d) : "—")} → <b>${esc(a.rows[k] ? resText(a.rows[k], d) : "—")}</b>${d.u ? " " + esc(d.u) : ""}`; });
  const mine = a.by === session?.u, hold = relNow() ? [] : openAlerts(s, a.rows);
  return `<div class="notice warn stack" id="amPend" style="gap:6px"><div><b>Amendment proposed</b> by ${esc(a.tech)}, ${fmt(a.at)}: ${esc(a.why)}</div>
    <div class="small">${changed.join("<br>") || "No change"}</div>
    ${hold.length ? `<div class="small"><b>Approval waits:</b> ${esc(hold.map(h => alertLine(s, h)).join("; "))}. Record what was done below first.</div>` : ""}
    ${canApprove() && (!mine || isAdmin()) ? `<div class="row">${mine ? `<input class="inp" id="amSelfWhy" data-clear placeholder="You proposed it: reason for approving it yourself" style="flex:1 1 220px;width:auto">` : ""}<button type="button" class="btn primary" id="amApprove" ${hold.length ? "disabled data-hold" : ""}>Approve and issue the amended certificate</button><button type="button" class="btn ghost" id="amDrop">Withdraw</button></div>`
      : mine || canApprove() ? `<div class="row"><span class="small muted">${mine ? "Another lab supervisor or the lab manager approves it." : ""}</span><button type="button" class="btn ghost" id="amDrop">Withdraw</button></div>` : `<div class="small muted">Waiting for a lab supervisor to approve it.</div>`}</div>`;
}
/* Rows typed into a form: a row whose value is unchanged keeps who entered it; a new or changed one is stamped with this person. */
function readRows(prefix, defs, prev){
  const rows = {};
  for (const a of defs){
    if (a.calc) continue;
    const el = $(`#${prefix}${a.k}`); if (!el) continue;
    const r = parseRes(el.value, a);
    if (r && (r.bad || r.amb)){ toast(resWrong(r, a)); el.focus(); return null; }
    if (r) rows[a.k] = prev?.[a.k] && prev[a.k].raw === r.raw && prev[a.k].by ? prev[a.k] : { ...r, by: session.u };
  }
  return rows;
}
async function doSaveResults(){
  const s0 = current?.body; if (!s0) return;
  const rows = readRows("rs_", anOf(s0), s0.results?.rows), inst = val("#rsInst");
  if (!rows) return;
  if (!Object.keys(rows).length){ toast("Type at least one result."); return; }
  const ok = await act(s => {
    const ph = stage(s, s.stageKey)?.phase;
    if (!(curIdx(s) < targetIdx(s) && (ph === "test" || ph === "qc"))){ toast("Results are entered while the sample is in analysis or QA/QC review."); return null; }
    const at = nowAfter(s), all = withCalc(s, rows);
    const next = { v: (s.results?.v || 0) + 1, at, by: session.u, tech: session.name, rows: patch(s.results?.rows, all), batch: s.results?.batch || "", inst };
    const wit = twoPerson(s) ? val("#mvWit") : "";   // v24d: two-person custody: the witness chosen on the record signs the release
    return { upd: { results: next, resHist: [...(s.resHist || []), ...(s.results ? [s.results] : [])].slice(-30), resAcc: null,
      history: [...(s.history || []), { key: s.stageKey, sn: stage(s, s.stageKey)?.name, at, by: session.u, tech: session.name, ref: inst, res: true, ...(wit ? { wit } : {}), note: `Results ${s.results ? "updated" : "entered"}: ${resSummary(anOf(s), all)}` }] },
      msg: `Results saved on ${s.id}${grouped(s) ? `. Released with batch ${s.batchId} once all its results are in` : twoPerson(s) && !wit && relNow() ? ". Two-person custody: choose the witness and press Release results" : ""}` };
  }, { anyStage: true, clear: ["resBox"] });
  // v24d: the last results of a batch in: the batch is released with one certificate (a critical batch: on the batch page, with its witness)
  if (ok && grouped(s0) && relNow() && !twoPerson(s0)){ const r = await releaseGroup(s0.batchId, "", true); if (r.n) toast(`All results in: ${nS(r.n)} released on batch certificate ${r.no}`); }
}
async function doAcceptChecks(){
  const why = val("#accWhy"); if (!why){ toast("Give the reason for accepting."); $("#accWhy")?.focus(); return; }
  if (!canApprove()) return;
  await act(s => {
    const bad = resultChecks(s).filter(c => !c.ok && !c.soft); if (!bad.length) return null;
    const self = selfCheck(s); if (self === "blocked"){ toast(SELF_MSG); return null; }
    const at = nowAfter(s);
    return { upd: { resAcc: { by: session.u, tech: session.name, at, why, msgs: bad.map(c => c.msg), ...(self ? { self: true } : {}) },
      history: [...(s.history || []), { key: s.stageKey, sn: stage(s, s.stageKey)?.name, at, by: session.u, tech: session.name, res: true, note: `Accepted results that fail a check (${bad.map(c => c.msg).join("; ")})${self ? " (accepted by the person who entered them)" : ""}: ${why}` }] }, msg: "Accepted; the reason will be printed on the certificate" };
  }, { anyStage: true, clear: ["accWhy"] });
}
async function doAckAlerts(){
  const note = val("#ackNote"); if (!note){ toast("Write what was done and who was told."); $("#ackNote")?.focus(); return; }
  await act(s => {
    const open = openAlerts(s); if (!open.length) return null;
    const at = nowAfter(s);
    return { upd: { acks: [...(s.acks || []), ...open.map(h => ({ key: h.key, id: h.id, k: h.k, raw: h.raw, by: session.u, tech: session.name, at, note }))],
      history: [...(s.history || []), { key: s.stageKey, sn: stage(s, s.stageKey)?.name, at, by: session.u, tech: session.name, res: true, note: `Limit recorded (${open.map(h => alertLine(s, h)).join("; ")}): ${note}` }] }, msg: "Recorded on the sample" };
  }, { anyStage: true, clear: ["ackNote"] });
}
/* Over range: back to the re-assay step. A fire assay result is repeated by gravimetric finish; anything else by a diluted re-run, which
   has no upper limit. */
async function doOverRange(){
  await act(s => {
    const over = overRes(s); if (!over.length || curIdx(s) >= targetIdx(s)) return null;
    const p = planOf(s), back = p[redoIdx(s)], at = nowAfter(s), grav = resOf(s).over === "fa_grav" ? over[0].k : "";
    const keys = over.map(a => a.k), extra = grav ? { grav } : { dil: [...new Set([...(s.dil || []), ...keys])] };
    const rows = rowsOf(s); keys.forEach(k => delete rows[k]);
    const left = withCalc({ ...s, ...extra }, rows), what = over.map(a => `${a.n} ${resText(s.results.rows[a.k], a)} ${a.u}`).join(", ");
    return { upd: { stageKey: back.key, stageAt: at, reassays: (s.reassays || 0) + 1, lastRedo: `${over[0].n} over range${grav ? ": repeated by gravimetric finish" : ": diluted re-run"}`, ...soloUpd(s),
      results: Object.keys(left).length ? { ...s.results, rows: patch(s.results.rows, left), v: s.results.v + 1, at } : null, resHist: [...(s.resHist || []), s.results].slice(-30), resAcc: null, ...extra, ...noLabs(s),
      history: [...(s.history || []), { key: back.key, sn: back.name, at, by: session.u, tech: session.name, redo: true, note: `Re-assay: ${what} is over the ${fmtNum(over[0].ul)} ${over[0].u} range${grav ? "; repeat by gravimetric finish" : "; diluted re-run"}${soloNote(s)}` }] },
      msg: `${s.id} sent back to ${back.name}` };
  }, { anyStage: true });
}
/* The checks an amendment must pass, as for a first release. Returns { rows } or { err }. */
function amendRows(s, typed, prev){
  const rows = withCalc(s, typed), defs = anOf(s);
  const miss = defs.filter(a => !a.opt && !a.calc && a.t !== "pick" && !rows[a.k]);
  if (miss.length) return { err: `${miss.map(a => a.n).join(", ")} can't be left empty: ${miss.length > 1 ? "they are" : "it is"} reported on every certificate.` };
  const over = overRes(s, rows);
  if (over.length) return { err: `${over.map(a => `${a.n} ${resText(rows[a.k], a)} ${a.u}`).join(", ")} is over the method's range (${over.map(a => fmtNum(a.ul)).join(", ")}). Send the sample for re-assay instead of amending.` };
  const ok = new Set(prev?.acc?.msgs || []), bad = resultChecks(s, rows).filter(c => !c.ok && !c.soft && !ok.has(c.msg));
  if (bad.length) return { err: `The corrected results fail a check: ${bad.map(c => c.msg).join("; ")}. Send the sample for re-assay instead.` };
  return { rows };
}
async function doAmend(){
  const s0 = current?.body, last = (s0?.certs || []).at(-1); if (!last || !canEdit()) return;
  const why = val("#amWhy"); if (!why){ toast("Give the reason for the amendment."); $("#amWhy")?.focus(); return; }
  const defs = anOf(s0), list = [...last.an.map(a => defs.find(d => d.k === a.k) || a), ...defs.filter(d => !d.opt && !last.an.some(a => a.k === d.k))];
  const typed = readRows("am_", list, last.rows); if (!typed) return;
  const raws = o => JSON.stringify(Object.keys(o).filter(k => !o[k].calc).sort().map(k => [k, o[k].raw]));
  if (raws(typed) === raws(last.rows)){ toast("Nothing was changed."); return; }
  const chk = amendRows(s0, typed, last); if (chk.err){ toast(chk.err); return; }
  await act(s => {
    const prev = (s.certs || []).at(-1); if (!prev || prev.v !== last.v){ toast("A newer certificate was issued meanwhile. Check it first."); return null; }
    if (s.amend){ toast(`An amendment proposed by ${s.amend.tech} is waiting. Approve or withdraw it first.`); return null; }
    const at = nowAfter(s), c = amendRows(s, typed, prev); if (c.err){ toast(c.err); return null; }
    return { upd: { amend: { of: prev.v, rows: c.rows, why, by: session.u, tech: session.name, at },
      history: [...(s.history || []), { key: s.stageKey, sn: stage(s, s.stageKey)?.name, at, by: session.u, tech: session.name, res: true, note: `Amendment of ${prev.no} proposed: ${why}` }] },
      msg: "Amendment proposed. Another lab supervisor or the lab manager approves it." };
  }, { anyStage: true, clear: ["amBox"] });
}
async function doApproveAmend(){
  const s0 = current?.body; if (!s0?.amend || !canApprove()) return;
  const mine = s0.amend.by === session.u, selfWhy = mine ? val("#amSelfWhy") : "";
  if (mine && !isAdmin()){ toast("You proposed this amendment. Another lab supervisor or the lab manager approves it."); return; }
  if (mine && !selfWhy){ toast("You proposed this amendment: give the reason for approving it yourself."); $("#amSelfWhy")?.focus(); return; }
  await act(s => {
    const a = s.amend, prev = (s.certs || []).at(-1);
    if (!a || !prev || prev.v !== a.of){ toast("The certificate changed since the amendment was proposed. Propose it again."); return null; }
    const c = amendRows(s, a.rows, prev); if (c.err){ toast(c.err); return null; }
    const hold = relNow() ? [] : openAlerts(s, c.rows); if (hold.length){ toast(`${hold.map(h => alertLine(s, h)).join("; ")}. Record what was done and who was told first.`); return null; }
    const at = nowAfter(s), results = { v: (s.results?.v || 0) + 1, at, by: a.by, tech: a.tech, rows: patch(s.results?.rows, c.rows), batch: s.results?.batch || prev.batch || "", inst: s.results?.inst || prev.inst || "" };
    const cert = makeCert({ ...s, results: { ...results, rows: c.rows }, resAcc: s.resAcc || prev.acc }, at, a.why, { amendBy: { by: a.by, tech: a.tech, at: a.at }, ...(mine ? { self: selfWhy } : {}) });
    return { upd: { results, resHist: [...(s.resHist || []), ...(s.results ? [s.results] : [])].slice(-30), certs: [...(s.certs || []), cert], amend: null,
      history: [...(s.history || []), { key: s.stageKey, sn: stage(s, s.stageKey)?.name, at, by: session.u, tech: session.name, ref: cert.no, res: true, note: `Amended certificate ${cert.no} replaces ${prev.no} (proposed by ${a.tech}, approved by ${session.name}${mine ? `, who proposed it: ${selfWhy}` : ""}): ${a.why}` }] },
      msg: `Amended certificate ${cert.no} issued` };
  }, { anyStage: true, clear: ["amSelfWhy"] });
}
async function doDropAmend(){
  await act(s => {
    if (!s.amend || !(s.amend.by === session.u || canApprove())) return null;
    const at = nowAfter(s);
    return { upd: { amend: null, history: [...(s.history || []), { key: s.stageKey, sn: stage(s, s.stageKey)?.name, at, by: session.u, tech: session.name, res: true, note: `Proposed amendment withdrawn (it was proposed by ${s.amend.tech})` }] }, msg: "Amendment withdrawn" };
  }, { anyStage: true });
}

/* ---------- certificate of analysis ---------- */
function certHtml(s, c){
  const rv = s.recv || {};
  const fact = (k, v) => `<tr><th>${k}</th><td>${v}</td></tr>`;
  const calc = (c.an || []).some(a => c.rows[a.k]?.calc) || (RESULTS[c.test]?.chk || []).length;
  const exc = [c.qcNote ? esc(c.qcNote) : "", c.acc ? `Accepted outside a check by ${esc(c.acc.tech)}: ${esc(c.acc.why)}` : "", ...(c.soft || []).map(m => "Note: " + esc(m)),
    ...(c.alerts || []).map(a => `${esc(a.line)}. ${esc(a.act)}.${a.ack ? ` Recorded by ${esc(a.ack.tech)}: ${esc(a.ack.note)}` : ""}`),
    c.amendBy ? `Amendment proposed by ${esc(c.amendBy.tech)} and approved by ${esc(c.tech)}.` : "", c.self ? `Released by a person who also entered results: ${esc(c.self)}` : ""].filter(Boolean);
  return `<div class="cert">
    <div class="cert-head"><div><div class="cert-org">ZIJIN · Assay Laboratory</div><h2>Certificate of analysis</h2></div>
      <div class="cert-no"><div class="mono">${esc(c.no)}</div><div>Version ${c.v} · ${esc(fmtFull(c.at))}</div>${c.code ? `<div>Check code <span class="mono">${esc(c.code)}</span></div>` : ""}</div></div>
    ${c.amends ? `<div class="cert-amend">Amended certificate. Replaces ${esc(c.amends)}. Reason: ${esc(c.why || "")}</div>` : ""}
    <table class="cert-facts">
      ${fact("Sample ID", `<b class="mono">${esc(s.id)}</b>`)}${fact("Site sample code", esc(tagText(s)) || "—")}${fact("Sample type", esc(s.type))}
      ${fact("Submitted by", `${esc(s.submitter)}${s.subBadge ? ` (badge ${esc(s.subBadge)})` : ""}${s.section ? ` · ${esc(s.section)} ${esc(sectionName(s.section))}` : ""}`)}
      ${fact("Collected", fmtFull(s.collectedAt))}${fact("Received", `${fmtFull(s.recvAt || s.receivedAt)}${rv.mass ? ` · ${esc(rv.mass)} ${esc(rv.unit || "kg")}` : ""}`)}
      ${fact("Test", esc(c.testName || ""))}${fact("Method", `${c.route ? `<span class="mono">${esc(c.route)}</span> ` : ""}${esc(routeLabel(s, c.routeName || ""))}`)}
      ${c.batch ? fact(c.batch.includes(",") ? "Lab batches" : "Lab batch", `<span class="mono">${esc(c.batch)}</span> · ${esc(qcLabel(c.qc) || "")}`) : ""}
    </table>
    ${c.file ? `<div class="cert-file">Results file: <b>${esc(c.file.name)}</b>${c.att ? (c.an.length ? ". Results not shown below are in this file." : ". The results are in this file.") : ""}</div>` : ""}
    ${c.an.length ? `<div class="tbl-wrap"><table class="cert-res"><thead><tr><th>Analyte</th><th>Result</th><th>Unit</th><th>Detection limit</th>${hasCov(c.cov) ? "<th>Quality control</th>" : ""}</tr></thead><tbody>
      ${c.an.map(a => `<tr><td>${esc(a.n)}</td><td class="mono"><b>${esc(resText(c.rows[a.k], a))}</b></td><td>${esc(a.u || "")}</td><td class="mono">${a.dl != null ? esc(fmtNum(a.dl)) : "—"}</td>${hasCov(c.cov) ? `<td>${covText(c.cov[a.k])}</td>` : ""}</tr>`).join("")}</tbody></table></div>` : ""}
    ${exc.length ? `<div class="cert-note">${exc.join("<br>")}</div>` : ""}
    <div class="cert-sign"><div>Released by <b>${esc(c.tech)}</b>, ${esc(ROLE_SIGN[c.role] || "lab supervisor (QA/QC)")}</div><div>${esc(fmtFull(c.at))}${TZ() ? ` (${esc(TZ())})` : ""}</div></div>
    <div class="cert-foot">Results relate only to the sample as received. Values below the detection limit are shown as &lt;DL${calc ? "; calculated results and balance checks count them as 0" : ""}.${hasCov(c.cov) && Object.values(c.cov).some(v => !v) ? ` A result marked "Not in a lab batch" is a field, physical or worksheet measurement that is not run with reference materials.` : ""} ${c.code ? `Check this copy by looking up the sample ID in the Assay Lab tracker: the certificate number and check code must match. ` : ""}Design prototype: not an official laboratory certificate.</div>
  </div>`;
}
function showCert(v){
  const s = current?.body; if (!s || !canSeeResults(s)) return;
  const c = (s.certs || []).find(x => x.v === +v) || (s.certs || []).at(-1); if (!c) return;
  if (c.bref) return showBatchCert(c.bref, c.no);   // v24d: released with its batch: the batch certificate
  const box = $("#certBox");
  box.innerHTML = `<div class="cert-wrap"><div class="cert-bar"><b>${esc(c.no)}</b><span style="flex:1"></span><button type="button" class="btn" id="certPrint">Print</button><button type="button" class="btn" id="certDl">Download</button><button type="button" class="btn primary" id="certClose">Close</button></div>${certHtml(s, c)}</div>`;
  box.hidden = false;
  const close = closeCert;
  $("#certClose").onclick = close;
  box.onclick = e => { if (e.target === box) close(); };
  $("#certPrint").onclick = () => { document.body.classList.add("print-cert"); try { window.print(); } catch { toast("Printing is blocked in this view. Use Download instead."); } };
  $("#certDl").onclick = async () => {
    const dl = window.claude?.use ? await claude.use("downloads") : null;
    if (!dl){ toast("Downloads are not available in this view."); return; }
    const css = [...document.querySelectorAll("style")].map(x => x.textContent).join("\n");
    try { await dl.save({ filename: `${c.no}.html`, data: `<!doctype html><html><head><meta charset="utf-8"><title>${esc(c.no)}</title><style>${css}</style></head><body class="cert-only">${certHtml(s, c)}</body></html>` }); }
    catch { toast("Download was not saved."); }
  };
  $("#certClose").focus();
}
function closeCert(){ const box = $("#certBox"); if (!box || box.hidden) return; box.hidden = true; box.innerHTML = ""; document.body.classList.remove("print-cert"); }
document.addEventListener("keydown", e => { if (e.key === "Escape") closeCert(); });
addEventListener("afterprint", () => document.body.classList.remove("print-cert"));

/* ---------- writing one sample from anywhere (a results file, a batch processed as one, the board's to-do) ---------- */
/* 21 Oct: what a route sends back with the results (the MET Lab's remainder: auto) is recorded as returned in the same write as the release,
   with its ledger movement; with nothing else kept the sample has left the lab and its workflow is complete. */
function releaseReturns(s, res){
  if (!res) return res;
  const upd = res.upd || res;
  if (!upd || !upd.relAt || upd.relAt === s.relAt || !Array.isArray(upd.materials) || !upd.materials.some(m => m && m.status === "kept" && m.auto)) return res;
  const mats = clone(upd.materials), moves = [...(res.moves || [])], m0 = { ...s, ...upd }, at = upd.relAt + 1000, back = [];
  for (const m of mats){
    if (!m || m.status !== "kept" || !m.auto) continue;
    m.outs = (m.outs || 0) + 1;
    Object.assign(m, { status: m.dispo || "returned", outAt: at, outBy: session.u, outTech: session.name, outRef: "", outMid: `${s.id}~out~${m.k}~${m.outs}` });
    moves.push(outMove(m0, at, m.status, m.item, "", m.then || "", m.outMid, "")); back.push(m);
  }
  const out = { ...upd, materials: mats };
  if (!mats.some(x => x.status === "kept")){ const ds = new Set(mats.map(x => x.status)); Object.assign(out, { stageKey: ds.size === 1 ? [...ds][0] : "closed", stageAt: at, open: false, onHand: false, closedAt: at, location: "" }); }
  const key = out.stageKey;
  out.history = [...(upd.history || s.history || []), { key, sn: stage(m0, key)?.name || key, at, by: session.u, tech: session.name, ref: "", note: `${back.map(m => `${m.item}: ${lcFirst(m.then || DISPO[m.status] || "returned")}`).join("; ")}` }];
  return res.upd ? { ...res, upd: out, moves } : { upd: out, moves };
}
/* Writes one sample under its lease. fn(s) returns the update, { upd, moves }, or null to skip. */
async function sampleWrite(id, fn, after){
  const ref = db.doc("samples/" + skey(id));
  try {
    const s = await leased(ref, true); if (!s) return false;
    const res = releaseReturns(s, withRelease(s, fn(s))); if (!res) return false;
    const upd = res.upd || res, moves = res.moves || [];
    if (after) after(upd);   // v24d: lets the caller see what was written (was it released?)
    upd.updatedAt = Date.now();
    if (moves.length){ upd.ledgerPending = [...(s.ledgerPending || []), ...moves]; upd.lp = true; }
    const sync = derive(s, upd);
    await ref.update(upd);
    if (sync) await writeStock(ref, { ...s, ...upd }).catch(() => {});
    ref.acquire({ holder: tabId, ttlMs: 1000 }).catch(() => {});
    if (moves.length) flushLedger(id);
    return true;
  } catch { return false; }
}
/* Runs fn on the items, n at a time; step(done, total) after each (v24d: a job of 80 samples says how far it has got). */
async function pool(items, n, fn, step){ let i = 0, ok = 0, done = 0; await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length){ const x = items[i++]; if (await fn(x)) ok++; done++; if (step) step(done, items.length); } })); return ok; }

/* ---------- results for a section account ---------- */
let secRes = [], secResSub = null, secResKey = "";
const seenKey = () => "seen-" + (session?.u || "");
function watchSectionResults(){
  watchSectionLab();   // v38: and the section's samples in the lab (My samples)
  const key = session?.role === "section" && db ? session.sec : "";
  if (key === secResKey) return;
  if (secResSub){ secResSub(); secResSub = null; }
  secResKey = key; secRes = [];
  if (!key) return;
  secResSub = db.collection("samples").where("section", "==", key).where("relAt", ">", 0).orderBy("relAt", "desc").limit(200).onSnapshot(snap => {
    secRes = snap.docs.map(d => d.data()).filter(x => x && x.id && (x.certs || []).length);
    resultsBadge(); if (tab === "results") renderResultsTab();
  }, () => {});
}
const newResults = () => { const seen = +lsGet(seenKey()) || 0; return secRes.filter(s => (s.certs.at(-1).at || 0) > seen); };
function resultsBadge(){ if (session && session.role !== "section") return staffResBadge(); const t = $('#tabs [data-tab="results"]'); if (t) t.textContent = newResults().length ? `Results (${newResults().length} new)` : "Results"; }
function renderResultsTab(){
  const v = $("#view-results"); if (!v) return;
  if (session?.role !== "section"){ if (session) renderStaffResults(v); else v.innerHTML = ""; return; }
  return renderSectionResults(v);   // v38: My samples (in the lab and released, with values and an export)
}
