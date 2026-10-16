
/* ---------- results ---------- */
const resOf = s => RESULTS[s?.test] || RESULTS.fa_aas;
/* The lab batches a sample joins, [{ p: batch type, k: [results the batch checks] }], copied from its route. An over-range result repeated by
   gravimetric finish leaves its batch for a gravimetric one. */
function groupsOf(s){
  if (!s) return [];
  let base = Array.isArray(s.qcg) ? s.qcg : null;
  if (!base){ const p = s.qcp != null ? s.qcp : routeByCode(s.route)?.qcp || ""; base = p && QC_PROFILES[p] ? [{ p, k: [qcAnalyte(resOf(s)).k] }] : []; }
  if (!s.grav) return base;
  const out = [];
  for (const g of base){ if (!g.k.includes(s.grav)){ out.push(g); continue; } const rest = g.k.filter(k => k !== s.grav); if (rest.length) out.push({ p: g.p, k: rest }); }
  if (!out.some(g => g.p === "grav")) out.push({ p: "grav", k: [s.grav] });
  return out;
}
const qcpOf = s => groupsOf(s)[0]?.p || "";
const profOf = s => QC_PROFILES[qcpOf(s)] || null;
/* Lab batches are optional unless Settings require them: a sample in no batch then has all its results typed or attached on its record. */
const batchesRequired = () => !!cfg.batchReq;
const batchKeys = s => { const labs = labsOf(s); return new Set(groupsOf(s).filter(g => batchesRequired() || labs[g.p]).flatMap(g => g.k)); };
/* The results this sample reports. One repeated by gravimetric finish takes that method's limits; one repeated by dilution has no upper limit. */
function anOf(s){
  const res = resOf(s), g = RESULTS.fa_grav.an[0], dil = s?.dil || [];
  if (!s?.grav && !dil.length) return res.an;
  return res.an.map(a => a.k === s.grav ? { ...a, n: a.n + " (gravimetric finish)", dl: g.dl, dp: g.dp, ul: null } : dil.includes(a.k) ? { ...a, n: a.n + " (diluted re-run)", ul: null } : a);
}
const aAn = t => (/^[aeiou]/i.test(t) ? "an " : "a ") + t;
const anShort = a => /^[A-Z][a-z]?$/.test(a.k) ? a.k : a.n;
/* The database merges an update into the stored record, map by map, so a result, a batch membership or a field of one that goes away is
   written as null (patch: each new value replaces the old one whole, so a value typed over one read from a file loses src) and read as
   absent (live). */
const live = o => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v != null));
const isMap = o => !!o && typeof o === "object" && !Array.isArray(o);
const patch = (old, now) => ({ ...Object.fromEntries(Object.keys(old || {}).map(k => [k, null])), ...Object.fromEntries(Object.entries(now).map(([k, v]) => [k, isMap(v) && isMap(old?.[k]) ? patch(old[k], v) : v])) });
const rowsOf = s => live(s?.results?.rows);
/* Lab batch membership by batch type: { [p]: { b: batch ID, q: QC status, n: note } }. Records from version 11 kept one batch in labBatch. */
function labsOf(s){
  if (!s) return {};
  if (s.labs) return live(s.labs);
  return s.labBatch ? { [qcpOf(s)]: { b: s.labBatch, q: s.labQc || "", n: s.labQcNote || "" } } : {};
}
const QC_RANK = { fail: 0, warn: 1, "": 2, pending: 3, none: 4, accepted: 4, pass: 5 };
/* The new membership, kept to the batch types the sample still needs, with the summary the board and lists read: the first batch, every batch
   (lbs, for lookups), the weakest QC state and the notes. */
function labsUpd(s, labs, extra = {}){
  const gs = groupsOf({ ...s, ...extra }), keep = Object.fromEntries(gs.filter(g => labs[g.p]).map(g => [g.p, labs[g.p]]));
  const ent = gs.map(g => keep[g.p]).filter(Boolean);
  let q = "";
  if (ent.length){ q = gs.map(g => keep[g.p]?.q || "").reduce((a, b) => QC_RANK[b] < QC_RANK[a] ? b : a, "pass"); if (q === "") q = "pending"; }
  return { ...extra, labs: patch(s.labs, keep), lbs: ent.map(e => e.b), labBatch: ent[0]?.b || "", labQc: q, labQcNote: ent.map(e => e.n).filter(Boolean).join(" ") };
}
const labIn = (s, id) => Object.entries(labsOf(s)).find(([, l]) => l.b === id) || null;
const inBatch = (s, id) => !!labIn(s, id);
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
  return a.dp != null ? (+r.v).toFixed(a.dp) : fmtNum(r.v);
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
const missingRes = (s, rows = s.results?.rows || {}) => anOf(s).filter(a => !a.opt && !a.calc && a.t !== "pick" && !rows[a.k]);
const overRes = (s, rows = s.results?.rows || {}) => anOf(s).filter(a => rows[a.k]?.f === "over");
/* Results worked out from others are never typed: they are set, or cleared, from their inputs whenever results are saved ("<DL" counts as 0). */
function withCalc(s, rows){
  const out = { ...rows };
  for (let pass = 0; pass < 3; pass++) for (const a of anOf(s)){
    if (!a.calc) continue;
    const v = {}; let ok = true;
    for (const k of a.from || []){ const x = resNum(out[k]); if (x == null){ ok = false; break; } v[k] = x; }
    const n = ok ? a.calc(v) : null;
    if (n == null || !isFinite(n)){ delete out[a.k]; continue; }
    const x = +n.toFixed((a.dp ?? 4) + 2);
    out[a.k] = { raw: String(x), v: x, f: a.ul != null && x > a.ul ? "over" : "", calc: true, ...((a.from || []).some(k => out[k]?.f === "ldl") ? { dl0: true } : {}) };
  }
  return out;
}
/* The people who entered the results now on the sample, typed on the record or saved from a lab batch. */
function entrants(s, rows = s?.results?.rows || {}){
  return [...new Set(Object.values(rows).filter(r => r && !r.calc).map(r => r.by || s.results?.by).filter(Boolean))];
}
/* Four eyes: whoever entered a result can't accept its failed checks or release it. The lab manager may, giving a reason that is recorded. */
const selfCheck = (s, rows) => session && entrants(s, rows).includes(session.u) ? (isAdmin() ? "admin" : "blocked") : "";
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
function limitHits(s, rows = effRows(s)){
  const out = [];
  for (const l of cfg.limits || []){
    if (l.route !== s.route || !rows[l.k]) continue;
    if (l.when && rows.pt?.raw && rows.pt.raw !== l.when) continue;   // no sampling point chosen: the limit applies
    const x = resNum(rows[l.k]); if (x == null) continue;
    if (l.op === "<" ? x < +l.val : x > +l.val) out.push({ ...l, raw: rows[l.k].raw, v: x, key: `${l.id}|${l.k}|${rows[l.k].raw}` });
  }
  return out;
}
const ackOf = (s, h) => (s.acks || []).find(a => a.key === h.key) || null;
const openAlerts = (s, rows) => limitHits(s, rows).filter(h => !ackOf(s, h));
function alertLine(s, h){
  const a = anOf(s).find(x => x.k === h.k) || { k: h.k, n: h.k, u: "" };
  return `${a.n} ${resText({ v: h.v, raw: h.raw, f: "" }, a)}${a.u ? " " + a.u : ""} is ${h.op === "<" ? "below" : "above"} the ${h.permit ? "permit limit" : "action limit"} of ${fmtNum(h.val)}${a.u ? " " + a.u : ""}${h.when ? ` (${h.when})` : ""}`;
}
/* What still stops a sample entering QA/QC review. */
function qcEntryBlock(s){
  const gs = groupsOf(s), labs = labsOf(s);
  for (const g of gs){
    const l = labs[g.p];
    if (!l && !batchesRequired()) continue;
    if (!l) return gs.length > 1 ? `Put ${s.id} in ${aAn(lcName(QC_PROFILES[g.p].name))} for ${listAnd(groupAns(g, { an: anOf(s) }).map(a => lcName(a.n)))} and enter its results first (Lab batches tab).` : `Put ${s.id} in a lab batch and enter the batch results first (Lab batches tab).`;
    if (!l.q || l.q === "pending") return `Enter the results for lab batch ${l.b} first.`;
  }
  const miss = missingRes(s);
  if (miss.length) return `Enter the results before QA/QC review. Missing: ${miss.map(a => a.n).join(", ")}.`;
  return "";
}
/* Next step the release, and nothing in the way of it but who releases. */
const readyRel = s => { const i = curIdx(s); return i >= 1 && !!planOf(s)[i + 1]?.target && !awaiting(s) && !releaseBlock(s); };
/* What still stops a supervisor releasing the results (who may release is checked separately: selfCheck). */
function releaseBlock(s){
  const miss = missingRes(s);
  if (miss.length) return `Results missing: ${miss.map(a => a.n).join(", ")}.`;
  const over = overRes(s);
  if (over.length) return `${over.map(a => a.n).join(", ")} is over the method's range. Re-assay it first.`;
  const bad = resultChecks(s).filter(c => !c.ok && !c.soft);
  if (bad.length && !s.resAcc) return `Results fail a check: ${bad.map(c => c.msg).join("; ")}. Re-assay, or a supervisor accepts it with a reason.`;
  const labs = labsOf(s);
  for (const g of groupsOf(s)){
    const l = labs[g.p];
    if (!l && !batchesRequired()) continue;
    if (!l) return "Results must come from a lab batch with its QC.";
    if (l.q === "fail") return `Lab batch ${l.b} failed QC. Re-run the batch.`;
    if (l.q === "warn") return `Lab batch ${l.b} has QC warnings. A supervisor accepts them on the batch first.`;
    if (!["pass", "accepted", "none"].includes(l.q)) return `Lab batch ${l.b} QC is not complete.`;
  }
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
const ROLE_SIGN = { admin: "lab manager", super: "lab supervisor (QA/QC)" };
/* A certificate keeps its own copy of the results, their units and what stands behind each one (its lab batch, a calculation, or neither),
   so it reads the same however the method library changes later. */
function makeCert(s, at, why, x = {}){
  const certs = s.certs || [], prev = certs.at(-1), ans = anOf(s), rows = s.results?.rows || {}, gs = groupsOf(s), labs = labsOf(s);
  const cov = {};
  for (const a of ans){ if (!rows[a.k]) continue; const g = gs.find(y => y.k.includes(a.k)); cov[a.k] = rows[a.k].calc ? "calc" : g && labs[g.p] ? labs[g.p].b : ""; }
  const c = { no: `${s.id}-R${certs.length + 1}`, v: certs.length + 1, at, by: session.u, tech: session.name, role: session.role,
    test: s.test || "", testName: s.testName || testOf(s.test)?.name || "", route: s.route || "", routeName: s.routeName || "",
    batch: gs.map(g => labs[g.p]?.b).filter(Boolean).join(", "), qc: s.labQc || "", qcNote: s.labQcNote || "", inst: s.results?.inst || "",
    an: ans.filter(a => rows[a.k]).map(a => ({ k: a.k, n: a.n, u: a.u, ...(a.dl != null ? { dl: a.dl } : {}), dp: a.dp, ...(a.t ? { t: a.t } : {}), ...(a.ul != null ? { ul: a.ul } : {}) })),
    rows: clone(live(rows)), cov, ents: entrants(s), acc: s.resAcc ? clone(s.resAcc) : null, soft: resultChecks(s).filter(c => !c.ok).map(c => c.msg),
    alerts: limitHits(s, rows).map(h => ({ line: alertLine(s, h), act: h.act, ack: ackOf(s, h) })),
    ...(x.self ? { self: x.self } : {}), ...(x.amendBy ? { amendBy: x.amendBy } : {}),
    ...(prev ? { amends: prev.no, why: why || s.lastRedo || "Results amended" } : {}) };
  c.code = certCode(s.id, c);
  return c;
}
/* Release: the results are frozen on a new certificate and each retained material starts its clock (kept from an earlier release). */
function releaseUpdate(s, at, note, wit, ref, selfWhy){
  const cert = makeCert(s, at, "", selfWhy ? { self: selfWhy } : {}), mats = (s.materials || []).length ? s.materials : materialsAt(s, at);
  const stored = (s.materials || []).length && keptMaterials(s).length && keptMaterials(s).every(m => m.loc);
  const key = stored ? "storage" : "released";
  return { stageKey: key, stageAt: at, relAt: at, relDay: dayKey(at), materials: mats, certs: [...(s.certs || []), cert],
    history: [...(s.history || []), { key: "released", sn: "Results released", at, by: session.u, tech: session.name, ref: [ref, cert.no].filter(Boolean).join(" · "), ...(wit ? { wit } : {}),
      note: (note ? note + ". " : "") + `Certificate ${cert.no} issued${cert.amends ? `, amending ${cert.amends}: ${cert.why}` : ""}${selfWhy ? `. Released by the person who entered the results: ${selfWhy}` : ""}` }] };
}
/* A re-assay: the results so far move to the results history. The sample leaves lab batches that already have results (it joins new ones),
   but stays in batches still being prepared. */
function redoReset(s, at){
  const labs = { ...labsOf(s) };
  for (const [p, l] of Object.entries(labs)){ const ob = openBatches.get(l.b); if (!(ob && !ob.qc)) delete labs[p]; }
  return { results: null, resHist: [...(s.resHist || []), ...(s.results ? [s.results] : [])].slice(-30), resAcc: null, amend: null, ...labsUpd(s, labs) };
}
/* A new test clears the results; a new test or other lab batches take the sample out of its batches. */
function rerouteReset(s, r, test, at){
  const out = {}, testChanged = test !== s.test, ng = groupsFor(r, test);
  if (testChanged && s.results) Object.assign(out, { results: null, resHist: [...(s.resHist || []), s.results].slice(-30), resAcc: null, amend: null });
  if (testChanged || JSON.stringify(ng) !== JSON.stringify(groupsOf(s))) Object.assign(out, { labs: patch(s.labs, {}), lbs: [], labBatch: "", labQc: "", labQcNote: "" });
  return out;
}
/* Staff see every result; a section account sees its own section's; anyone else only when an admin has opened results to everyone. */
const canSeeResults = s => isStaff() || (session?.role === "section" && !!s && s.section === session.sec) || !!cfg.resultsPublic;
function resTable(ans, rows, cov){
  const list = ans.filter(a => rows[a.k] || !a.opt);
  return `<div class="tbl-wrap"><table class="res"><thead><tr><th>Analyte</th><th>Result</th><th>Unit</th><th>Detection limit</th>${cov ? "<th>Quality control</th>" : ""}</tr></thead><tbody>
    ${list.map(a => `<tr><td>${esc(a.n)}</td><td class="mono">${resCell(rows[a.k], a)}</td><td>${esc(a.u || "")}</td><td class="mono">${a.dl != null ? esc(fmtNum(a.dl)) : "—"}</td>${cov ? `<td class="small">${covText(cov[a.k])}</td>` : ""}</tr>`).join("")}</tbody></table></div>`;
}
const covText = c => c === "calc" ? "Calculated" : c ? `Lab batch <span class="mono">${esc(c)}</span>` : "Not in a lab batch";
/* none: results from a file with no QC readings in it; QC is judged on the lab's QA/QC sample set, so release is not held. */
const qcLabel = q => ({ pass: "QC passed", warn: "QC warnings to accept", fail: "QC failed", accepted: "QC accepted by supervisor", none: "No QC in this run", pending: "waiting for batch results" })[q] || "";
const qcCls = q => ({ pass: "ok", accepted: "ok", none: "info", warn: "warn", fail: "bad", pending: "info" })[q] || "";
const qcClear = q => q === "pass" || q === "none";
const certLine = c => `<button type="button" class="linkish" data-cert="${c.v}">${esc(c.no)}</button> (${fmtDate(c.at)}${c.code ? `, check code <span class="mono">${esc(c.code)}</span>` : ""})`;
function resultsPanel(s){
  const ci = curIdx(s), ti = targetIdx(s), ph = stage(s, s.stageKey)?.phase, certs = s.certs || [], last = certs.at(-1);
  const entering = canEdit() && ci >= 0 && ci < ti && (ph === "test" || ph === "qc");
  if (!s.results && !certs.length && !entering && !Object.keys(labsOf(s)).length) return "";
  if (!canSeeResults(s)) return certs.length ? `<div class="panel stack" id="resPanel"><h3>Results</h3><p class="small muted" style="margin:0">Results were released on ${fmtDate(last.at)} on certificate <b class="mono">${esc(last.no)}</b>${last.code ? `, check code <span class="mono">${esc(last.code)}</span>` : ""}. The lab sends them to the submitting section; ask the Assay Lab for the certificate. A copy you hold is genuine if its number and check code match these.</p></div>` : "";
  const rows = s.results?.rows || {}, ans = anOf(s), draft = s.results && (!last || s.results.at > last.at);
  const checks = draft ? resultChecks(s) : [], bad = checks.filter(c => !c.ok);
  const over = draft ? overRes(s) : [];
  const parts = [];
  if (last) parts.push(`<div class="stack" style="gap:6px">
      <div class="row" style="gap:8px"><span class="pill ok">Released</span><b>Certificate ${esc(last.no)}</b><span class="small muted">${fmtFull(last.at)} by ${esc(last.tech)}${last.code ? ` · check code <span class="mono">${esc(last.code)}</span>` : ""}</span>
        <button type="button" class="btn small" data-cert="${last.v}">View certificate</button></div>
      ${last.amends ? `<div class="small"><span class="pill warn">Amended</span> Replaces ${esc(last.amends)}: ${esc(last.why || "")}</div>` : ""}
      ${last.qcNote ? `<div class="small muted">${esc(last.qcNote)}</div>` : ""}${last.acc ? `<div class="small muted">Accepted outside a check by ${esc(last.acc.tech)}: ${esc(last.acc.why)}</div>` : ""}
      ${resTable(last.an, last.rows, last.cov)}
      ${certs.length > 1 ? `<div class="small muted">Earlier versions: ${certs.slice(0, -1).reverse().map(certLine).join(", ")}. They stay on record.</div>` : ""}
    </div>`);
  if (draft) parts.push(`<div class="stack" style="gap:6px">
      <div class="row" style="gap:8px"><span class="pill gold">${last ? "Re-assay results, not yet released" : "Not yet released"}</span><span class="small muted">Saved ${fmt(s.results.at)} by ${esc(s.results.tech || "")}${s.results.inst ? ` · ${esc(s.results.inst)}` : ""}</span>${s.results.file && isStaff() ? `<button type="button" class="linkish mono small" data-rfile="${esc(s.results.file.id)}">${esc(s.results.file.name)}</button>` : ""}</div>
      ${resTable(ans, rows)}
      ${over.length ? `<div class="notice bad"><b>Over the method's range:</b> ${over.map(a => `${esc(a.n)} above ${esc(fmtNum(a.ul))} ${esc(a.u)}`).join(", ")}. ${resOf(s).over ? `Repeat by ${esc(testOf(resOf(s).over)?.name || "")}.` : "Dilute and re-assay."}
        ${canEdit() && ci < ti ? `<div class="row" style="margin-top:6px"><button type="button" class="btn" id="overBtn">${resOf(s).over ? "Send for gravimetric finish" : "Send back for a diluted re-run"}</button></div>` : ""}</div>` : ""}
      ${bad.length ? `<div class="notice ${bad.some(c => !c.soft) && !s.resAcc ? "bad" : "warn"}"><b>Check${bad.length > 1 ? "s" : ""} not met:</b> ${bad.map(c => esc(c.msg) + (c.soft ? " (reported, does not hold the release)" : "")).join("; ")}.
        ${s.resAcc ? `<div class="small">Accepted by ${esc(s.resAcc.tech)}, ${fmt(s.resAcc.at)}: ${esc(s.resAcc.why)}</div>` : bad.some(c => !c.soft) ? `<div class="small">The release is held until the sample is re-assayed or a lab supervisor who did not enter the results accepts it with a reason.</div>` : ""}
        ${!s.resAcc && bad.some(c => !c.soft) && canApprove() && selfCheck(s) !== "blocked" ? `<div class="row" style="margin-top:6px"><input class="inp" id="accWhy" data-clear placeholder="${selfCheck(s) === "admin" ? "You entered these results: reason for accepting them yourself" : "Reason for accepting (printed on the certificate)"}" style="flex:1 1 220px;width:auto"><button type="button" class="btn" id="accBtn">Accept with this reason</button></div>` : ""}</div>` : checks.length ? `<div class="small" style="color:var(--ok)">All checks met: ${checks.map(c => esc(c.msg.replace(/^the /, "").replace(/ (differ|is|differs|are|add).*$/, ""))).join("; ")}.</div>` : ""}
    </div>`);
  if (s.amend) parts.push(amendPending(s, last));
  parts.push(alertsBox(s));
  const gs = groupsOf(s), labs = labsOf(s);
  if (gs.length && (batchesRequired() || Object.keys(labs).length)) parts.push(`<div class="small stack" style="gap:2px">${gs.map(g => { const l = labs[g.p], what = gs.length > 1 ? ` (${esc(listAnd(groupAns(g, { an: ans }).map(a => lcName(a.n))))})` : "";
    return `<div>Lab batch${what}: ${l ? `<button type="button" class="linkish mono" data-batch="${esc(l.b)}">${esc(l.b)}</button> <span class="pill ${qcCls(l.q)}">${esc(qcLabel(l.q) || "no results yet")}</span>${l.n ? `<div class="small muted">${esc(l.n)}</div>` : ""}` : `<span class="muted">not in ${esc(aAn(lcName(QC_PROFILES[g.p]?.name || "batch")))} yet. ${canEdit() ? `Add it on the <button type="button" class="linkish" data-goto="batches">Lab batches</button> tab.` : ""}</span>`}</div>`; }).join("")}</div>`);
  if (entering) parts.push(resultsForm(s));
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
  const ans = anOf(s), rows = s.results?.rows || {}, bk = batchKeys(s);
  const others = ans.filter(a => !bk.has(a.k));
  if (!others.some(a => !a.calc)) return "";
  const fromBatch = ans.filter(a => bk.has(a.k));
  return `<div class="row"><button type="button" class="btn" data-attach="sample:${esc(s.id)}">Attach results file</button></div>
    <details class="more" id="resBox"><summary>${s.results ? "Correct results" : "Type results instead"}</summary>
    <div class="stack" style="gap:8px;margin-top:8px">
      <p class="small muted" style="margin:0">${fromBatch.length ? `${esc(listAnd(fromBatch.map((a, i) => i ? lcName(a.n) : a.n)))} ${fromBatch.length > 1 ? "come" : "comes"} from lab batches with their QC. Enter the other results here.` : "Type each result."} Use <b>&lt;DL</b> when a result is below the detection limit. The dot is the decimal mark; a number such as 1,500 is refused because it could mean 1500 or 1.5.</p>
      <div class="form">${others.map(a => `<label class="f${a.t === "text" ? " full" : ""}"><span>${esc(a.n)}${a.u ? ` (${esc(a.u)})` : ""}${a.opt ? ` <span class="muted" style="font-weight:400">optional</span>` : ""}</span>${resInput("rs_" + a.k, a, rows[a.k]?.raw, rows)}</label>`).join("")}
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
  const mine = a.by === session?.u, hold = openAlerts(s, a.rows);
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
  const bk = batchKeys(s0), rows = readRows("rs_", anOf(s0).filter(a => !bk.has(a.k)), s0.results?.rows), inst = val("#rsInst");
  if (!rows) return;
  if (!Object.keys(rows).length){ toast("Type at least one result."); return; }
  await act(s => {
    const ph = stage(s, s.stageKey)?.phase;
    if (!(curIdx(s) < targetIdx(s) && (ph === "test" || ph === "qc"))){ toast("Results are entered while the sample is in analysis or QA/QC review."); return null; }
    const keep = Object.fromEntries(Object.entries(rowsOf(s)).filter(([k]) => batchKeys(s).has(k)));
    const at = nowAfter(s), all = withCalc(s, { ...keep, ...rows });
    const next = { v: (s.results?.v || 0) + 1, at, by: session.u, tech: session.name, rows: patch(s.results?.rows, all), batch: s.results?.batch || "", inst };
    return { upd: { results: next, resHist: [...(s.resHist || []), ...(s.results ? [s.results] : [])].slice(-30), resAcc: null,
      history: [...(s.history || []), { key: s.stageKey, sn: stage(s, s.stageKey)?.name, at, by: session.u, tech: session.name, ref: inst, res: true, note: `Results ${s.results ? "updated" : "entered"}: ${resSummary(anOf(s), all)}` }] },
      msg: `Results saved on ${s.id}` };
  }, { anyStage: true, clear: ["resBox"] });
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
/* Over range: back to the re-assay step. A fire assay result is repeated by gravimetric finish in a gravimetric batch; anything else by a
   diluted re-run in a new batch of its kind, which has no upper limit. */
async function doOverRange(){
  await act(s => {
    const over = overRes(s); if (!over.length || curIdx(s) >= targetIdx(s)) return null;
    const p = planOf(s), back = p[redoIdx(s)], at = nowAfter(s), grav = resOf(s).over === "fa_grav" ? over[0].k : "";
    const keys = over.map(a => a.k), extra = grav ? { grav } : { dil: [...new Set([...(s.dil || []), ...keys])] };
    const rows = rowsOf(s); keys.forEach(k => delete rows[k]);
    const labs = { ...labsOf(s) }; groupsOf(s).filter(g => g.k.some(k => keys.includes(k))).forEach(g => delete labs[g.p]);
    const left = withCalc({ ...s, ...extra }, rows), what = over.map(a => `${a.n} ${resText(s.results.rows[a.k], a)} ${a.u}`).join(", ");
    return { upd: { stageKey: back.key, stageAt: at, reassays: (s.reassays || 0) + 1, lastRedo: `${over[0].n} over range${grav ? ": repeated by gravimetric finish" : ": diluted re-run"}`,
      results: Object.keys(left).length ? { ...s.results, rows: patch(s.results.rows, left), v: s.results.v + 1, at } : null, resHist: [...(s.resHist || []), s.results].slice(-30), resAcc: null, ...labsUpd(s, labs, extra),
      history: [...(s.history || []), { key: back.key, sn: back.name, at, by: session.u, tech: session.name, redo: true, note: `Re-assay: ${what} is over the ${fmtNum(over[0].ul)} ${over[0].u} range${grav ? "; repeat by gravimetric finish in a gravimetric batch" : "; diluted re-run in a new batch"}` }] },
      msg: `${s.id} sent back to ${back.name}` };
  }, { anyStage: true });
}
/* The checks an amendment must pass, as for a first release. Returns { rows } or { err }. */
function amendRows(s, typed, prev){
  const rows = withCalc(s, typed), defs = anOf(s);
  const miss = defs.filter(a => !a.opt && !a.calc && !rows[a.k]);
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
    const hold = openAlerts(s, c.rows); if (hold.length){ toast(`${hold.map(h => alertLine(s, h)).join("; ")}. Record what was done and who was told first.`); return null; }
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
      ${fact("Test", esc(c.testName || ""))}${fact("Method", `${c.route ? `<span class="mono">${esc(c.route)}</span> ` : ""}${esc(c.routeName || "")}`)}
      ${c.batch ? fact(c.batch.includes(",") ? "Lab batches" : "Lab batch", `<span class="mono">${esc(c.batch)}</span> · ${esc(qcLabel(c.qc) || "")}`) : ""}
    </table>
    <table class="cert-res"><thead><tr><th>Analyte</th><th>Result</th><th>Unit</th><th>Detection limit</th>${c.cov ? "<th>Quality control</th>" : ""}</tr></thead><tbody>
      ${c.an.map(a => `<tr><td>${esc(a.n)}</td><td class="mono"><b>${esc(resText(c.rows[a.k], a))}</b></td><td>${esc(a.u || "")}</td><td class="mono">${a.dl != null ? esc(fmtNum(a.dl)) : "—"}</td>${c.cov ? `<td>${covText(c.cov[a.k])}</td>` : ""}</tr>`).join("")}</tbody></table>
    ${exc.length ? `<div class="cert-note">${exc.join("<br>")}</div>` : ""}
    <div class="cert-sign"><div>Released by <b>${esc(c.tech)}</b>, ${esc(ROLE_SIGN[c.role] || "lab supervisor (QA/QC)")}</div><div>${esc(fmtFull(c.at))}${TZ() ? ` (${esc(TZ())})` : ""}</div></div>
    <div class="cert-foot">Results relate only to the sample as received. Values below the detection limit are shown as &lt;DL${calc ? "; calculated results and balance checks count them as 0" : ""}. A result marked "Not in a lab batch" is a field, physical or worksheet measurement that is not run with reference materials. ${c.code ? `Check this copy by looking up the sample ID in the Assay Lab tracker: the certificate number and check code must match. ` : ""}Design prototype: not an official laboratory certificate.</div>
  </div>`;
}
function showCert(v){
  const s = current?.body; if (!s || !canSeeResults(s)) return;
  const c = (s.certs || []).find(x => x.v === +v) || (s.certs || []).at(-1); if (!c) return;
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

/* ---------- lab batches ---------- */
const openBatches = new Map();
let monthBatches = [], batchSel = "", batchLive = null, batchUnsub = null, batchNewProf = "", chartCrm = "", batchBusy = false;
document.addEventListener("click", e => { const b = e.target.closest("[data-batch]"); if (b){ e.preventDefault(); selectBatch(b.dataset.batch); setTab("batches"); } });
function selectBatch(id){
  if (batchUnsub){ batchUnsub(); batchUnsub = null; }
  batchSel = id || ""; batchLive = openBatches.get(id) || monthBatches.find(b => b.id === id) || null;
  watchBatchSamples(batchSel);
  if (!db || !id) return;
  batchUnsub = db.doc("batches/" + id).onSnapshot(snap => { if (batchSel !== id) return; batchLive = snap.exists ? snap.data() : null; if (tab === "batches") renderBatches(); }, () => {});
}
/* The results a batch checks (batches from version 11 checked one, in `an`), and one position's results by result code. */
const bAns = b => b?.ans || (b?.an ? [b.an] : []);
const posRs = (b, x) => x.rs || (x.r ? { [bAns(b)[0]?.k]: x.r } : {});
const pickAn = ({ k, n, u, dl, dp, ul, exact }) => ({ k, n, u, ...(dl != null ? { dl } : {}), dp, ...(ul != null ? { ul } : {}), ...(exact ? { exact } : {}) });
/* The results a sample brings to a batch of this kind. */
function batchAns(key, s){
  const g = groupsOf(s).find(x => x.p === key); if (!g) return [];
  const ans = anOf(s);
  return g.k.map(k => ans.find(a => a.k === k)).filter(Boolean).map(pickAn);
}
/* Samples share a batch only when they bring the same results (same element and unit, in the same order). */
const sigOf = ans => ans.map(a => `${a.exact ? a.k : a.k.split("_")[0]}|${a.u || ""}`).join(",");
const useList = c => String(c.use || "").split(/[,\s]+/).map(x => x.trim().toUpperCase()).filter(Boolean);
const crmById = id => (cfg.crms || []).find(c => c.id === id) || null;
/* A reference material row certifies a result of the same unit, and of the same element unless the result needs its exact code. */
const crmMatch = (c, ch) => (c.u || "") === (ch.u || "") && (c.an === ch.k || (!ch.exact && c.an === ch.k.split("_")[0]));
const crmRow = (id, ch) => (cfg.crms || []).find(c => c.id === id && crmMatch(c, ch)) || null;
/* Reference materials for a batch: those certified for its results, preferring ones listed for the batch's prefix, ordered so that the first
   few between them cover every result. */
function crmsFor(ans, prefix){
  const ids = [...new Set((cfg.crms || []).filter(c => ans.some(ch => crmMatch(c, ch))).map(c => c.id))];
  const rows = id => (cfg.crms || []).filter(c => c.id === id);
  let pool = ids.filter(id => rows(id).some(c => useList(c).includes(prefix)));
  if (!pool.length) pool = ids.filter(id => rows(id).every(c => !useList(c).length));
  const cover = id => ans.filter(ch => crmRow(id, ch)).map(ch => ch.k);
  const order = [], need = new Set(ans.map(ch => ch.k));
  while (need.size){
    const best = pool.filter(id => !order.includes(id)).map(id => [id, cover(id).filter(k => need.has(k)).length]).reduce((a, b) => b[1] > a[1] ? b : a, ["", 0]);
    if (!best[1]) break;
    order.push(best[0]); cover(best[0]).forEach(k => need.delete(k));
  }
  return [...order, ...pool.filter(id => !order.includes(id))];
}
/* Samples that can go into a new batch of this kind: received, not yet at QA/QC, not already in a batch of this kind. */
function eligibleFor(key){
  return [...samples.values()].filter(s => {
    if (!groupsOf(s).some(g => g.p === key) || awaiting(s) || stage(s, s.stageKey)?.final) return false;
    const l = labsOf(s)[key]; if (l && (openBatches.has(l.b) || l.q)) return false;
    const ci = curIdx(s), p = planOf(s), qi = p.findIndex(x => x.phase === "qc");
    return ci >= 1 && ci < (qi < 0 ? targetIdx(s) : qi);
  }).sort((a, b) => (b.priority === "Urgent") - (a.priority === "Urgent") || (a.recvAt || a.createdAt) - (b.recvAt || b.createdAt));
}
/* Positions: preparation blank first (it goes through preparation with the samples), duplicates straight after their originals,
   reference materials and blanks spread through the batch. */
function layoutBatch(p, sids, ans){
  const ins = p.ins || {}, n = sids.length, pos = [];
  const spread = (k, off) => { const m = new Map(); for (let i = 0; i < k; i++){ const at = Math.min(n - 1, Math.max(0, Math.floor((i + off) * n / k))); m.set(at, (m.get(at) || 0) + 1); } return m; };
  const pdAt = spread(ins.pd || 0, 0.6), cdAt = spread(ins.cd || 0, 0.35), crmAt = spread(ins.crm || 0, 0.5), blAt = spread(ins.bl || 0, 0.8);
  const list = crmsFor(ans, p.prefix); let ci = 0;
  const push = (t, x = {}) => pos.push({ p: pos.length + 1, t, ...x });
  if (ins.pb) for (let i = 0; i < ins.pb; i++) push("pb");
  sids.forEach((sid, i) => {
    push("s", { sid });
    for (let j = 0; j < (p.all || 0); j++) push("pd", { of: sid });
    for (let j = 0; j < (cdAt.get(i) || 0); j++) push("cd", { of: sid });
    for (let j = 0; j < (pdAt.get(i) || 0); j++) push("pd", { of: sid });
    for (let j = 0; j < (crmAt.get(i) || 0); j++) push("crm", { crm: list.length ? list[ci++ % list.length] : "" });
    for (let j = 0; j < (blAt.get(i) || 0); j++) push("bl");
  });
  return pos;
}
const posLabel = (p, x) => x.t === "s" ? "Sample" : x.t === "crm" ? cap(qcName(p, "crm")) : x.t === "pd" ? (p.all ? "Repeat" : cap(qcName(p, "pd"))) : x.t === "cd" ? cap(qcName(p, "cd")) : x.t === "pb" ? cap(qcName(p, "pb")) : cap(qcName(p, "bl"));
const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
/* The QC verdict for a batch, from the same numbers as the rule text: every QC position is judged on each result the batch checks. */
/* file: the results came from a lab file. QC positions the file has no reading for are not judged and the batch need not hold a certified
   reference material: the lab submits its QA/QC as a sample set of its own. A file with no QC readings at all is "none". */
function evalBatch(b, p, file){
  const ans = bAns(b), one = ans.length === 1, checks = [];
  const orig = sid => b.pos.find(y => y.t === "s" && y.sid === sid);
  for (const x of b.pos){
    if (x.t === "s") continue;
    const label = posLabel(p, x), rs = posRs(b, x);
    if (file && !ans.some(ch => rs[ch.k])){ checks.push({ p: x.p, t: x.t, label, verdict: "info", msg: "not in the file" }); continue; }
    if (x.t === "crm" && !crmById(x.crm)){ checks.push({ p: x.p, t: x.t, label, verdict: "fail", msg: "no reference material chosen" }); continue; }
    for (const ch of ans){
      const r = rs[ch.k], v = resNum(r), base = { p: x.p, t: x.t, label, k: ch.k, ...(one ? {} : { kn: anShort(ch) }) };
      if (x.t === "crm"){
        const c = crmRow(x.crm, ch);
        if (!c){ checks.push({ ...base, crm: x.crm, verdict: "info", msg: `${x.crm} is not certified for ${anShort(ch)}` }); continue; }
        if (v == null && r?.f !== "ldl"){ checks.push({ ...base, crm: c.id, verdict: "fail", msg: "no result" }); continue; }
        const rule = p.crm || { mode: "sd", warn: 2, fail: 3 };
        let verdict = "pass", stat = "";
        if (rule.mode === "sd" && !(c.sd > 0)){ checks.push({ ...base, crm: c.id, val: v, verdict: "fail", msg: `${c.id} has no SD for ${anShort(ch)} in the CRM register` }); continue; }
        if (rule.mode === "sd"){ const z = (v - c.val) / c.sd; stat = `${z >= 0 ? "+" : ""}${z.toFixed(1)} SD`; verdict = Math.abs(z) <= rule.warn + 1e-9 ? "pass" : Math.abs(z) <= rule.fail + 1e-9 && rule.fail > rule.warn ? "warn" : "fail"; }
        else if (rule.mode === "pct"){ const d = (v - c.val) / c.val * 100; stat = `${d >= 0 ? "+" : ""}${d.toFixed(1)}%`; verdict = Math.abs(d) <= rule.tol + 1e-9 ? "pass" : "fail"; }
        else if (rule.mode === "rec"){ const q = v / c.val * 100; stat = `${q.toFixed(1)}% recovery`; verdict = q >= rule.lo - 1e-9 && q <= rule.hi + 1e-9 ? "pass" : "fail"; }
        else { const d = v - c.val; stat = `${d >= 0 ? "+" : ""}${fmtNum(+d.toFixed(4))} ${ch.u}`; verdict = Math.abs(d) <= rule.tol + 1e-9 ? "pass" : "fail"; }
        checks.push({ ...base, crm: c.id, exp: c.val, sd: c.sd || null, val: v, stat, verdict });
        continue;
      }
      if (x.t === "pd" || x.t === "cd"){ const o = orig(x.of); if (o?.gone && v == null && r?.f !== "ldl"){ checks.push({ ...base, of: x.of, verdict: "info", msg: "original left the batch" }); continue; } }
      if (v == null && r?.f !== "ldl"){ checks.push({ ...base, verdict: "fail", msg: "no result" }); continue; }
      if (x.t === "bl" || x.t === "pb"){
        const m = x.t === "pb" ? (p.pbBlank || p.blank || 5) : (p.blank || 5);
        if (ch.dl == null){ checks.push({ ...base, val: v, verdict: "info", msg: "no detection limit to judge against" }); continue; }
        const lim = m * ch.dl;
        checks.push({ ...base, val: v, lim, stat: `limit ${fmtNum(lim)} ${ch.u}`, verdict: v <= lim + 1e-12 ? "pass" : "fail" });
      } else {
        const o = orig(x.of), a = resNum(o && posRs(b, o)[ch.k]), d = v;
        if (a == null){ checks.push({ ...base, of: x.of, verdict: o?.gone ? "info" : "fail", msg: o?.gone ? "original left the batch" : "original has no result" }); continue; }
        if (p.dupAbs){ const diff = Math.abs(a - d); checks.push({ ...base, of: x.of, val: d, ref: a, stat: `${fmtNum(+diff.toFixed(4))} ${ch.u} apart`, verdict: diff <= p.dupAbs + 1e-9 ? "pass" : "fail" }); continue; }
        const m = (a + d) / 2, tol = x.t === "cd" ? p.cd : p.pd, dl = ch.dl || 0;
        if (p.dupMin && m < p.dupMin * dl){ checks.push({ ...base, of: x.of, val: d, ref: a, stat: `below ${p.dupMin}× detection limit`, verdict: "info" }); continue; }
        const rpd = m ? Math.abs(a - d) / m * 100 : 0;
        checks.push({ ...base, of: x.of, val: d, ref: a, stat: `${rpd.toFixed(1)}% apart`, verdict: rpd <= (tol || 20) + 1e-9 ? "pass" : "fail" });
      }
    }
  }
  if ((p.ins || {}).crm && !file) for (const ch of ans) if (!b.pos.some(x => x.t === "crm" && crmRow(x.crm, ch)))
    checks.push({ p: 0, t: "crm", label: "Reference materials", k: ch.k, ...(one ? {} : { kn: anShort(ch) }), verdict: "fail", msg: `no reference material in this batch is certified for ${anShort(ch)}` });
  const status = checks.some(c => c.verdict === "fail") ? "fail" : checks.some(c => c.verdict === "warn") ? "warn" : file && checks.every(c => c.verdict === "info") ? "none" : "pass";
  return { status, checks };
}
/* Trends across batches for each reference material judged in SD: two results in a row beyond 2 SD on the same side is a warning on this batch
   (like the Westgard 2-2s rule); nine in a row on one side of the certified value shows a bias and is flagged. */
function crmSeries(batches, crm, k, skip){
  const pts = [];
  const ids = new Set(crmAka(crm));
  for (const b of batches){ if (!b?.qc || b.id === skip) continue; for (const c of b.qc.checks || []) if (ids.has(c.crm) && (c.k == null || c.k === k) && c.exp != null && c.val != null) pts.push({ at: b.qc.at || b.at, b: b.id, p: c.p, v: c.val, exp: c.exp, sd: c.sd, verdict: c.verdict }); }
  return pts.sort((a, b) => a.at - b.at || a.p - b.p);
}
function trendRules(pts){
  const out = [], n = pts.length, z = q => q.sd > 0 ? (q.v - q.exp) / q.sd : null;
  if (n >= 2){ const a = z(pts[n - 2]), b = z(pts[n - 1]); if (a != null && b != null && ((a > 2 && b > 2) || (a < -2 && b < -2))) out.push({ rule: "2of2s", msg: `two results in a row beyond ${a > 0 ? "+" : "−"}2 SD (${pts[n - 2].b} and ${pts[n - 1].b})` }); }
  if (n >= 9){ const last = pts.slice(-9), side = q => Math.sign(q.v - q.exp); if (side(last[0]) && last.every(q => side(q) === side(last[0]))) out.push({ rule: "9side", msg: `the last 9 results are all ${side(last[0]) > 0 ? "above" : "below"} the certified value (bias)` }); }
  return out;
}
/* The batches that used a reference material, newest first: enough for the trend rules and the control chart's last 60 points. */
async function crmHistory(id){
  const got = new Map();
  for (const k of crmAka(id)) (await db.collection("batches").where("crms", "array-contains", k).orderBy("at", "desc").limit(60).get()).docs.forEach(d => { const b = d.data(); if (b && b.id) got.set(b.id, b); });
  return [...got.values()].sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 60);
}
async function batchTrends(b, qc, p){
  const out = [];
  if (p.crm?.mode !== "sd") return out;
  const ids = [...new Set(qc.checks.filter(c => c.t === "crm" && c.exp != null).map(c => c.crm))];
  for (const id of ids){
    let hist = [];
    try { hist = await crmHistory(id); } catch {}
    for (const k of [...new Set(qc.checks.filter(c => c.crm === id && c.exp != null).map(c => c.k))]){
      const pts = [...crmSeries(hist, id, k, b.id), ...crmSeries([{ ...b, qc: { ...qc, at: Date.now() + 1 } }], id, k, "")];
      trendRules(pts).forEach(t => out.push({ crm: id, k, ...t }));
    }
  }
  return out;
}
/* Writes one sample under its lease from anywhere (batch actions). fn(s) returns the update, { upd, moves }, or null to skip. */
async function sampleWrite(id, fn){
  const ref = db.doc("samples/" + id);
  try {
    const s = await leased(ref, true); if (!s) return false;
    const res = fn(s); if (!res) return false;
    const upd = res.upd || res, moves = res.moves || [];
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
async function pool(items, n, fn){ let i = 0, ok = 0; await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length){ const x = items[i++]; if (await fn(x)) ok++; } })); return ok; }
async function claimBatchId(prefix, body){
  const stamp = dayStamp(Date.now()), hint = db.doc(`meta/bcounter-${prefix}-${stamp}`);
  let n = 1; try { const h = await hint.get(); n = ((h.exists && +h.data().last) || 0) + 1; } catch {}
  for (let tries = 0; tries < 200; tries++, n++){
    const id = `${prefix}-${stamp}-${String(n).padStart(2, "0")}`, ref = db.doc("batches/" + id);
    const lease = await ref.acquire({ holder: tabId, ttlMs: 4000 }); if (!lease.acquired) continue;
    const snap = await ref.get(); if (snap.exists && snap.data()?.id) continue;
    await ref.set({ ...body, id });
    ref.acquire({ holder: tabId, ttlMs: 1000 }).catch(() => {});
    hint.set({ last: n, day: stamp, prefix }).catch(() => {});
    return id;
  }
  throw { code: "busy" };
}
function setBatchBusy(b, msg){ batchBusy = b; document.querySelectorAll("#view-batches button").forEach(x => x.disabled = b || x.hasAttribute("data-hold")); const m = $("#bMsg"); if (m) m.textContent = b ? (msg || "Saving…") : ""; }
const batchLog = (b, note) => [...(b.log || []), { at: Date.now(), by: session.u, tech: session.name, note }].slice(-60);
async function doBatchCreate(){
  const key = val("#nbProf"), p = QC_PROFILES[key]; if (!p || !canEdit() || batchBusy) return;
  const sids = [...document.querySelectorAll("#nbList input[type=checkbox]:checked")].map(x => x.value);
  if (!sids.length){ toast("Tick the samples for this batch."); return; }
  if (sids.length > p.size){ toast(`${cap(aAn(lcName(p.name)))} takes up to ${p.size} samples.`); return; }
  const first = bs(sids[0]); if (!first) return;
  const ans = batchAns(key, first), sig = sigOf(ans), at = Date.now();
  setBatchBusy(true, "Creating the batch…");
  try {
    const id = await claimBatchId(p.prefix, { qcp: key, ans, at, day: dayKey(at), month: monthKey(at), by: session.u, tech: session.name, open: true, status: "creating", sids: [], pos: [], crms: [], qc: null, log: [] });
    $("#bMsg") && ($("#bMsg").textContent = `Adding ${sids.length} sample(s) to ${id}…`);
    const added = [], other = [];
    await pool(sids, 5, sid => sampleWrite(sid, s => {
      if (!groupsOf(s).some(g => g.p === key)) return null;
      const l = labsOf(s)[key]; if (l && l.b && l.b !== id) return null;
      if (sigOf(batchAns(key, s)) !== sig){ other.push(sid); return null; }
      added.push(sid);
      const t = nowAfter(s);
      return { ...labsUpd(s, { ...labsOf(s), [key]: { b: id, q: "pending", n: "" } }), history: [...(s.history || []), { key: s.stageKey, sn: stage(s, s.stageKey)?.name, at: t, by: session.u, tech: session.name, ref: id, note: `Added to lab batch ${id}` }] };
    }));
    const order = sids.filter(x => added.includes(x));
    if (!order.length){ await db.doc("batches/" + id).delete(); toast(other.length ? "Those samples report different results and can't share a batch. Nothing was created." : "Those samples were just put in another batch. Nothing was created."); return; }
    const pos = layoutBatch(p, order, ans);
    await db.doc("batches/" + id).update({ status: "prep", sids: order, pos, crms: [...new Set(pos.filter(x => x.crm).map(x => x.crm))], log: [{ at: Date.now(), by: session.u, tech: session.name, note: `Batch created with ${order.length} samples and ${pos.length - order.length} QC positions` }] });
    toast(order.length === sids.length ? `Batch ${id} created: ${order.length} samples, ${pos.length - order.length} QC positions`
      : `Batch ${id} created with ${order.length} of ${sids.length} samples (${other.length ? `${other.length} report other results and need their own batch` : "the others were taken by another batch"})`);
    batchNewProf = ""; selectBatch(id);
  } catch (e) { e?.code === "busy" ? toast("Could not number the batch. Try again.") : writeFailed(e); }
  finally { setBatchBusy(false); renderBatches(); }
}
/* Every sample in the group at one step moves to its own next step. Entering QA/QC needs every batch's results; the release is done separately. */
async function doBatchMove(fromKey){
  const b = batchLive; if (!b || !canEdit() || batchBusy) return;
  const anyTwo = b.sids.some(id => twoPerson(bs(id)));
  const wit = anyTwo ? val("#bWit") : ""; if (anyTwo && !wit){ toast("Two-person custody: choose the witness first."); $("#bWit")?.focus(); return; }
  setBatchBusy(true, "Moving samples…");
  let blocked = [];
  const ok = await pool(b.sids, 5, sid => sampleWrite(sid, s => {
    if (s.stageKey !== fromKey || !inBatch(s, b.id)) return null;
    const p = planOf(s), ci = curIdx(s), nx = p[ci + 1]; if (!nx || nx.target) return null;
    if (nx.phase === "qc" && p[ci].phase !== "qc"){ const why = qcEntryBlock(s); if (why){ blocked.push(s.id); return null; } }
    const at = nowAfter(s);
    return { stageKey: nx.key, stageAt: at, history: [...(s.history || []), { key: nx.key, sn: nx.name, at, by: session.u, tech: session.name, ref: b.id, ...(wit ? { wit } : {}), note: `Moved with lab batch ${b.id}` }] };
  }));
  setBatchBusy(false);
  toast(`${ok} sample(s) moved on${blocked.length ? `; ${blocked.length} need results first` : ""}.`);
  renderBatches();
}
const goneFrom = (b, x) => x.t === "s" && (!inBatch(bs(x.sid), b.id) || released(bs(x.sid)));
const posInput = (x, i, ch) => i === 0 ? "bp_" + x.p : `bp_${x.p}_${ch.k}`;
/* The results file a batch's values come from: its draft's or, opened again for correction, the last one attached when saved values came from it. */
const batchFile = b => b.draft?.file || (b.files?.length && (b.pos || []).some(x => Object.values(x.rs || {}).some(r => r?.src === "file")) ? b.files.at(-1) : null);
function readBatchInputs(b){
  const ans = bAns(b), vals = {}, crms = {}, left = new Set(b.pos.filter(x => goneFrom(b, x)).map(x => x.sid)), fromFile = !!batchFile(b);
  for (const x of b.pos){
    if (x.t === "crm"){ crms[x.p] = $("#bc_" + x.p)?.value || b.draft?.crms?.[x.p] || x.crm || ""; if (!crms[x.p]){ toast(`Position ${x.p}: choose the reference material.`); $("#bc_" + x.p)?.focus(); return null; } }
    const rs = {};
    for (const [i, ch] of ans.entries()){
      const el = $("#" + posInput(x, i, ch)), r = parseRes(el?.value, ch), where = `Position ${x.p}${ans.length > 1 ? ` ${anShort(ch)}` : ""}`;
      const optional = left.has(x.sid) || (x.t === "pd" || x.t === "cd") && left.has(x.of) || x.t === "crm" && !crmRow(crms[x.p], ch) || fromFile && x.t !== "s";
      if (!r){ if (optional) continue; toast(`${where}: enter a result (type <DL if below detection).`); el?.focus(); return null; }
      if (r.bad || r.amb){ toast(resWrong(r, ch, where)); el?.focus(); return null; }
      // From the file: the draft's value, or (results opened again for correction) the saved one that came from the file, left as it was.
      const dv = b.draft?.vals?.[x.p]?.[ch.k], pr = x.rs?.[ch.k];
      rs[ch.k] = { ...r, by: session.u, ...((dv != null ? dv === r.raw : pr?.src === "file" && pr.raw === r.raw) ? { src: "file" } : {}) };
    }
    if (Object.keys(rs).length) vals[x.p] = rs;
  }
  return { vals, crms };
}
async function doBatchSave(){
  const b = batchLive; if (!b || !canEdit() || batchBusy || b.qc) return;
  const got = readBatchInputs(b); if (!got) return;
  const notYet = b.sids.filter(id => { const s = bs(id); if (!s || !inBatch(s, b.id) || released(s)) return false; const ph = stage(s, s.stageKey)?.phase; return !(curIdx(s) < targetIdx(s) && (ph === "test" || ph === "qc")); });
  if (notYet.length){ toast(`${notYet.length} sample(s) have not reached analysis yet (${notYet.slice(0, 3).join(", ")}${notYet.length > 3 ? "…" : ""}). Move them on first.`); return; }
  const all = Object.values(got.vals).flatMap(o => Object.values(o)), typed = all.filter(r => r.src !== "file").length;
  const file = batchFile(b);
  await storeBatchResults(b, got, val("#bInst") || b.draft?.file?.name || "", file, file ? typed : 0);
}
/* Saves a batch's results (typed, or read from a results file), checks its QC and writes each sample's results. Returns the QC status. */
async function storeBatchResults(b, got, inst, file, typed){
  const p = QC_PROFILES[b.qcp], ans = bAns(b), pos = b.pos.map(x => { const { r, ...y } = x; return { ...y, ...(x.t === "crm" ? { crm: got.crms[x.p] } : {}), rs: got.vals[x.p] || null, ...(goneFrom(b, x) ? { gone: true } : {}) }; });
  const qc = { ...evalBatch({ ...b, pos }, p, !!file), at: Date.now(), by: session.u, tech: session.name, ...(file ? { file: { id: file.id, name: file.name } } : {}) };
  setBatchBusy(true, "Saving results and checking QC…");
  try {
    const trend = await batchTrends({ ...b, pos }, qc, p);
    if (trend.length){ qc.trend = trend; trend.filter(t => t.rule === "2of2s").forEach(t => qc.checks.push({ p: 0, t: "crm", label: "Trend", k: t.k, crm: t.crm, verdict: "warn", stat: `${t.crm}: ${t.msg}` })); if (qc.status === "pass" && trend.some(t => t.rule === "2of2s")) qc.status = "warn"; }
    const ref = db.doc("batches/" + b.id), fresh = await leased(ref, true);
    if (!fresh){ toast("Someone else is saving this batch. Try again in a moment."); return false; }
    if (fresh.qc){ toast("Results for this batch were already saved by " + (fresh.qc.tech || "someone else") + "."); return false; }
    const how = file ? `Results from file ${file.name}${typed ? `; ${typed} value${typed === 1 ? "" : "s"} typed` : ""}` : `Results entered${inst ? ` (${inst})` : ""}`;
    await ref.update({ pos, ans, crms: [...new Set(pos.filter(x => x.crm).map(x => x.crm))], qc, inst, status: "qc", draft: null, ...(b.files ? { files: b.files } : {}), log: batchLog(fresh, `${how}; QC ${qc.status}`) });
    ref.acquire({ holder: tabId, ttlMs: 1000 }).catch(() => {});
    const ok = await pool(pos.filter(x => x.t === "s" && x.rs), 5, x => sampleWrite(x.sid, s => {
      const l = labsOf(s)[b.qcp]; if (!l || l.b !== b.id || released(s)) return null;
      const g = groupsOf(s).find(y => y.p === b.qcp), defs = anOf(s), at = nowAfter(s), rows = rowsOf(s), got = [];
      ans.forEach((ch, i) => { const k = g?.k[i], a = defs.find(y => y.k === k), r0 = x.rs[ch.k]; if (!a || !r0) return; const r = parseRes(r0.raw, a); rows[k] = r && !r.bad && !r.amb ? { ...r, by: session.u, ...(r0.src ? { src: r0.src } : {}) } : r0; got.push(a); });
      const all = withCalc(s, rows);
      const results = { v: (s.results?.v || 0) + 1, at, by: session.u, tech: session.name, rows: patch(s.results?.rows, all), batch: b.id, inst: inst || s.results?.inst || "", ...(file ? { file: { id: file.id, name: file.name } } : s.results?.file ? { file: s.results.file } : {}) };
      return { results, resHist: [...(s.resHist || []), ...(s.results ? [s.results] : [])].slice(-30), resAcc: null, ...labsUpd(s, { ...labsOf(s), [b.qcp]: { b: b.id, q: qc.status, n: "" } }),
        history: [...(s.history || []), { key: s.stageKey, sn: stage(s, s.stageKey)?.name, at, by: session.u, tech: session.name, ref: b.id, res: true, note: `Result${got.length > 1 ? "s" : ""} from lab batch ${b.id}${file ? ` (file ${file.name})` : ""}: ${got.map(a => `${a.n} ${resText(all[a.k], a)} ${a.u}${all[a.k]?.f === "over" ? " (over the method's range)" : ""}`).join("; ")}. ${qcLabel(qc.status)}` }] };
    }));
    toast(`${qcLabel(qc.status)}. Results saved on ${ok} sample(s).`);
    return qc.status;
  } catch (e) { writeFailed(e); return false; }
  finally { setBatchBusy(false); renderBatches(); }
}
/* Supervisor decisions on a batch: accept warnings, re-run, open again to correct an entry; the lab manager may accept a failure as a documented
   exception. Samples already released are never touched: their results are corrected by an amended certificate. */
async function setSamplesQc(b, q, note, qcNote = ""){
  return pool(b.sids, 5, sid => sampleWrite(sid, s => {
    const l = labsOf(s)[b.qcp]; if (!l || l.b !== b.id || released(s)) return null;
    const at = nowAfter(s);
    return { ...labsUpd(s, { ...labsOf(s), [b.qcp]: { ...l, q, n: qcNote } }), history: [...(s.history || []), { key: s.stageKey, sn: stage(s, s.stageKey)?.name, at, by: session.u, tech: session.name, ref: b.id, res: true, note }] };
  }));
}
/* Samples of a batch that already have their results released. */
const releasedFrom = b => (b.sids || []).map(id => bs(id)).filter(s => s && inBatch(s, b.id) && released(s));
async function doBatchDecide(kind){
  const b = batchLive; if (!b || !b.qc || batchBusy) return;
  const why = val("#bWhy");
  if (!why){ toast("Give the reason first."); $("#bWhy")?.focus(); return; }
  if (kind === "override" ? !isAdmin() : !canApprove()) return;
  if ((kind === "accept" || kind === "override") && b.qc.by === session.u && !isAdmin()){ toast("You saved this batch's results. Another lab supervisor or the lab manager accepts its warnings."); return; }
  if (kind === "reopen"){ const rel = releasedFrom(b); if (rel.length){ toast(`${rel[0].id} was already released from this batch. Correct a released result with an amended certificate; re-run the batch for the others.`); return; } }
  setBatchBusy(true);
  try {
    const ref = db.doc("batches/" + b.id), fresh = await leased(ref, true); if (!fresh || !fresh.qc){ toast("The batch changed. Check it again."); return; }
    if (kind === "accept" || kind === "override"){
      if (kind === "accept" && fresh.qc.status !== "warn") return;
      if (kind === "override" && fresh.qc.status !== "fail") return;
      const self = fresh.qc.by === session.u;
      await ref.update({ qc: { ...fresh.qc, accepted: { by: session.u, tech: session.name, at: Date.now(), why, exception: kind === "override", ...(self ? { self: true } : {}) } }, log: batchLog(fresh, `${kind === "override" ? "Failed QC accepted as an exception" : "QC warnings accepted"}${self ? " by the person who entered the results" : ""}: ${why}`) });
      const qn = `${kind === "override" ? `Lab batch ${fresh.id} failed QC; accepted as an exception` : `Lab batch ${fresh.id} QC warnings accepted`} by ${session.name}${self ? " (who entered the results)" : ""}: ${why}`;
      await setSamplesQc(fresh, "accepted", qn, qn);
      toast(kind === "override" ? "Exception recorded. Samples can be released; the reason is on each certificate's batch record." : "Warnings accepted. Samples can be released.");
    } else if (kind === "reopen"){
      const rel = (await Promise.all(fresh.sids.map(sid => db.doc("samples/" + sid).get().then(x => x.data())))).filter(s => s && inBatch(s, fresh.id) && released(s));
      if (rel.length){ toast(`${rel[0].id} was already released from this batch. Correct a released result with an amended certificate; re-run the batch for the others.`); return; }
      await ref.update({ qc: null, status: "results", log: batchLog(fresh, `Results opened again for correction: ${why}`) });
      await setSamplesQc(fresh, "pending", `Lab batch ${b.id} results opened again for correction: ${why}`);
      toast("Results can be corrected and saved again.");
    } else if (kind === "rerun"){
      const p = QC_PROFILES[fresh.qcp], live = fresh.sids.filter(id => { const s = bs(id); return s && inBatch(s, fresh.id) && !released(s); });
      if (!live.length){ toast("No samples of this batch are waiting for results."); return; }
      const ans = bAns(fresh), pos = layoutBatch(p, live, ans), now = Date.now();
      const id = await claimBatchId(p.prefix, { qcp: fresh.qcp, ans, at: now, day: dayKey(now), month: monthKey(now), by: session.u, tech: session.name, open: true, status: "prep",
        sids: live, pos, crms: [...new Set(pos.filter(x => x.crm).map(x => x.crm))], qc: null, rerunOf: fresh.id, log: [{ at: now, by: session.u, tech: session.name, note: `Re-run of ${fresh.id} with ${live.length} samples: ${why}` }] });
      await ref.update({ open: false, status: "rerun", rerunBy: id, log: batchLog(fresh, `Re-run as ${id}: ${why}`) });
      await pool(live, 5, sid => sampleWrite(sid, s => {
        const l = labsOf(s)[fresh.qcp]; if (!l || l.b !== fresh.id || released(s)) return null;
        const pl = planOf(s), ri = redoIdx(s), ci = curIdx(s), at = nowAfter(s), back = ri >= 0 && ci > ri ? pl[ri] : null;
        const drop = new Set(groupsOf(s).find(g => g.p === fresh.qcp)?.k || []), left = withCalc(s, Object.fromEntries(Object.entries(rowsOf(s)).filter(([k]) => !drop.has(k))));
        return { ...(back ? { stageKey: back.key, stageAt: at } : {}), reassays: (s.reassays || 0) + 1, lastRedo: `Lab batch ${fresh.id} re-run: ${why}`,
          results: Object.keys(left).some(k => !left[k].calc) ? { ...s.results, rows: patch(s.results.rows, left), v: s.results.v + 1, at } : null,
          resHist: [...(s.resHist || []), ...(s.results ? [s.results] : [])].slice(-30), resAcc: null, ...labsUpd(s, { ...labsOf(s), [fresh.qcp]: { b: id, q: "pending", n: "" } }),
          history: [...(s.history || []), { key: back ? back.key : s.stageKey, sn: back ? back.name : stage(s, s.stageKey)?.name, at, by: session.u, tech: session.name, ref: id, redo: true, note: `Re-assay: lab batch ${fresh.id} ${fresh.qc.status === "fail" ? "failed QC" : "re-run"} (${why}); now in batch ${id}` }] };
      }));
      toast(`Batch re-run as ${id}; samples sent back for re-assay.`);
      selectBatch(id);
    }
  } catch (e) { writeFailed(e); }
  finally { setBatchBusy(false); renderBatches(); }
}
async function doBatchRelease(){
  const b = batchLive; if (!b || !canApprove() || batchBusy) return;
  const anyTwo = b.sids.some(id => twoPerson(bs(id)));
  const wit = anyTwo ? val("#bWit") : ""; if (anyTwo && !wit){ toast("Two-person custody: choose the witness first."); $("#bWit")?.focus(); return; }
  const selfWhy = val("#bSelfWhy");
  if ($("#bSelfWhy") && !selfWhy){ toast("Some of these results were entered by you: give the reason for releasing them yourself."); $("#bSelfWhy").focus(); return; }
  setBatchBusy(true, "Releasing results…");
  const held = [];
  const ok = await pool(b.sids, 5, sid => sampleWrite(sid, s => {
    if (!inBatch(s, b.id) || curIdx(s) !== targetIdx(s) - 1) return null;
    const why = releaseBlock(s); if (why){ held.push(`${s.id}: ${why}`); return null; }
    const self = selfCheck(s); if (self === "blocked"){ held.push(`${s.id}: you entered its results`); return null; }
    return releaseUpdate(s, nowAfter(s), `Released with lab batch ${b.id}`, wit, "", self === "admin" ? selfWhy : "");
  }));
  setBatchBusy(false);
  toast(`${ok} sample(s) released with certificates${held.length ? `; ${held.length} held (${held[0]})` : ""}.`);
  await closeBatchIfDone(b.id);
  renderBatches();
}
/* A batch left half-created (the creating device lost its connection) is finished from the samples that joined it, or removed when none did. */
async function repairBatches(){
  const snap = await db.collection("batches").where("status", "==", "creating").get();
  for (const d of snap.docs){
    const b = d.data(); if (!b || !b.id || Date.now() - (b.at || 0) < 120000) continue;
    const ref = db.doc("batches/" + b.id), lease = await ref.acquire({ holder: tabId, ttlMs: 20000 }); if (!lease.acquired) continue;
    const fresh = (await ref.get()).data(); if (!fresh || fresh.status !== "creating") continue;
    const found = new Map();
    for (const q of [db.collection("samples").where("lbs", "array-contains", b.id), db.collection("samples").where("labBatch", "==", b.id)])
      (await q.get()).docs.map(x => x.data()).filter(x => x && x.id && inBatch(x, b.id)).forEach(x => found.set(x.id, x));
    const sids = [...found.keys()].sort();
    if (!sids.length){ await ref.delete(); continue; }
    const pos = layoutBatch(QC_PROFILES[b.qcp], sids, bAns(b));
    await ref.update({ status: "prep", sids, pos, crms: [...new Set(pos.filter(x => x.crm).map(x => x.crm))], log: [{ at: Date.now(), by: "", tech: "System", note: `Creation was interrupted; finished with the ${sids.length} sample(s) that had joined it` }] });
    ref.acquire({ holder: tabId, ttlMs: 1000 }).catch(() => {});
  }
}
/* A batch closes when every sample in it has its results released (or has left the lab or the batch). */
async function closeBatchIfDone(id){
  try {
    const ref = db.doc("batches/" + id), b = (await ref.get()).data(); if (!b || !b.open) return;
    const docs = await Promise.all(b.sids.map(sid => db.doc("samples/" + sid).get().then(x => x.data())));
    if (docs.every(s => !s || !inBatch(s, id) || released(s) || stage(s, s.stageKey)?.final)) await ref.update({ open: false, status: "done", log: batchLog(b, "All results released; batch closed") });
  } catch {}
}
function renderBatches(){
  const v = $("#view-batches"); if (!v) return;
  const b = batchLive;
  keepUi(v, `batch-${batchSel}|${b ? `${b.status}-${b.qc ? b.qc.status + (b.qc.accepted ? "a" : "") : "none"}-${b.open}-${(b.sids || []).length}` : "none"}`, () => buildBatches(v));
  if (batchBusy) setBatchBusy(true);
  if (chartCrm) drawChart(chartCrm);
}
/* What a batch waits for, and from whom, for the list. */
function batchNext(b){
  if (b.status === "rerun" || b.status === "done" || !b.open) return "";
  if (b.status === "creating") return "Being created";
  if (!b.qc) return b.draft ? "Complete the results (technician)" : "Attach results (technician)";
  if (!(qcClear(b.qc.status) || b.qc.accepted)) return "QC decision (supervisor)";
  return "Release (supervisor)";
}
function batchStatus(b){
  if (b.status === "rerun") return ["warn", `Re-run as ${b.rerunBy}`];
  if (b.status === "done") return ["", "Closed: all results released"];
  if (b.status === "creating") return ["info", "Being created"];
  if (!b.qc) return ["gold", b.draft ? "Results file attached: values to complete" : "Waiting for results"];
  if (b.qc.accepted) return ["ok", b.qc.accepted.exception ? "QC failure accepted (exception)" : "QC warnings accepted"];
  return [qcCls(b.qc.status), qcLabel(b.qc.status)];
}
/* Reference materials whose latest batch shows a trend (two beyond 2 SD in a row, or a bias). */
function crmTrendFlags(){
  const latest = new Map();
  for (const b of [...monthBatches, ...openBatches.values()]) if (b?.qc) for (const id of b.crms || []){ const cur = latest.get(id); if (!cur || (b.qc.at || 0) > (cur.qc.at || 0)) latest.set(id, b); }
  return [...latest.entries()].flatMap(([id, b]) => (b.qc.trend || []).filter(t => t.crm === id).map(t => ({ ...t, b: b.id })));
}
function buildBatches(v){
  const edit = canEdit(), profs = Object.entries(QC_PROFILES).map(([k, p]) => [k, p, eligibleFor(k)]);
  const ready = profs.filter(x => x[2].length);
  if (batchNewProf && !QC_PROFILES[batchNewProf]) batchNewProf = "";
  const np = batchNewProf ? QC_PROFILES[batchNewProf] : null, el = batchNewProf ? eligibleFor(batchNewProf) : [];
  const sigs = new Set(el.map(s => sigOf(batchAns(batchNewProf, s))));
  const open = [...openBatches.values()].sort((a, b) => b.at - a.at);
  const closed = monthBatches.filter(x => !x.open).sort((a, b) => b.at - a.at).slice(0, 30);
  const trends = crmTrendFlags();
  const row = x => { const [cls, txt] = batchStatus(x), p = QC_PROFILES[x.qcp] || { name: x.qcp };
    return `<tr class="${x.id === batchSel ? "sel" : ""}"><td><button type="button" class="linkish mono" data-bsel="${esc(x.id)}">${esc(x.id)}</button></td><td>${esc(p.name)}</td><td class="mono">${(x.sids || []).length}</td><td><span class="pill ${cls}">${esc(txt)}</span></td><td>${esc(batchNext(x))}</td><td style="white-space:nowrap">${fmt(x.at)}</td><td>${esc(x.tech || "")}</td></tr>`; };
  const seen = new Set(), crmOpts = (cfg.crms || []).filter(c => { const k = `${c.id}|${c.an}|${c.u}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .map(c => { const k = `${c.id}|${c.an}|${c.u || ""}`; return `<option value="${esc(k)}" ${k === chartCrm ? "selected" : ""}>${esc(c.id)} · ${esc(c.an)}${c.u ? " " + esc(c.u) : ""} · ${esc(c.name)}</option>`; }).join("");
  v.innerHTML = `<div class="stack">
    <div class="panel row" style="gap:10px">
      <h2 style="margin:0">Lab batches</h2><span style="flex:1"></span>
      ${edit ? `<button type="button" class="btn primary" data-attach="all">Attach results file</button>` : ""}
    </div>
    ${trends.length ? `<div class="notice warn"><b>Reference material trends:</b> ${trends.map(t => `${esc(t.crm)}${t.k ? ` ${esc(t.k)}` : ""}: ${esc(t.msg)}`).join("; ")}. Check the control chart before the next batch.</div>` : ""}
    ${edit ? `<div class="panel stack" style="gap:10px"><h3>New batch</h3>
      ${ready.length ? `<label class="f" style="max-width:520px"><span>Batch type</span><select class="inp" id="nbProf"><option value="">Choose…</option>${profs.map(([k, p, l]) => `<option value="${k}" ${k === batchNewProf ? "selected" : ""} ${l.length ? "" : "disabled"}>${esc(p.name)} · ${l.length} sample${l.length === 1 ? "" : "s"} ready</option>`).join("")}</select></label>`
        : `<p class="small muted" style="margin:0">No samples are waiting for a batch. Samples join a batch after receipt and before QA/QC review.</p>`}
      ${np ? `<p class="small" style="margin:0"><b>QC rule:</b> ${esc(qcRuleText(np, el[0] ? batchAns(batchNewProf, el[0]) : null))}</p>
        ${sigs.size > 1 ? `<p class="small muted" style="margin:0">These samples report different results, so they go in separate batches: tick samples that check the same results.</p>` : ""}
        <div class="tbl-wrap" id="nbList"><table><thead><tr><th></th><th>Sample</th><th>Route</th>${sigs.size > 1 ? "<th>Results checked</th>" : ""}<th>Step now</th><th>Received</th></tr></thead><tbody>
        ${el.map((s, i) => `<tr><td><input type="checkbox" id="nb_${esc(s.id)}" value="${esc(s.id)}" ${i < np.size && sigOf(batchAns(batchNewProf, s)) === sigOf(batchAns(batchNewProf, el[0])) ? "checked" : ""}></td><td class="mono">${esc(s.id)}${s.priority === "Urgent" ? ` <span class="pill gold">Urgent</span>` : ""}</td><td class="mono">${esc(s.route || "")}</td>${sigs.size > 1 ? `<td>${esc(batchAns(batchNewProf, s).map(anShort).join(", "))}</td>` : ""}<td>${esc(stage(s, s.stageKey)?.name || "")}</td><td style="white-space:nowrap">${fmt(s.recvAt)}</td></tr>`).join("")}</tbody></table></div>
        <div class="row"><button type="button" class="btn primary" id="nbCreate">Create batch</button><span class="small muted">Up to ${np.size} samples. QC positions are added automatically.</span></div>` : ""}
    </div>` : ""}
    <div class="panel stack" style="gap:8px"><h3>Open batches</h3>
      ${open.length ? `<div class="tbl-wrap"><table class="cardy"><thead><tr><th>Batch</th><th>Type</th><th>Samples</th><th>Status</th><th>Next step</th><th>Created</th><th>By</th></tr></thead><tbody>${open.map(row).join("")}</tbody></table></div>` : `<p class="small muted" style="margin:0">No open batches.</p>`}
    </div>
    ${batchLive ? batchDetail(batchLive) : batchSel ? `<div class="panel empty"><strong>Loading ${esc(batchSel)}…</strong></div>` : ""}
    <div class="panel stack" style="gap:8px"><h3>QC control chart</h3>
      <div class="row"><select class="inp" id="chCrm" style="width:auto;max-width:100%"><option value="">Choose a reference material…</option>${crmOpts}</select></div>
      <div id="chBox"></div></div>
    ${closed.length ? `<div class="panel stack" style="gap:8px"><h3>Closed this month</h3><div class="tbl-wrap"><table class="cardy"><thead><tr><th>Batch</th><th>Type</th><th>Samples</th><th>Status</th><th>Next step</th><th>Created</th><th>By</th></tr></thead><tbody>${closed.map(row).join("")}</tbody></table></div></div>` : ""}
    <div class="small muted" id="bMsg"></div>
  </div>`;
  $("#nbProf", v)?.addEventListener("change", e => { batchNewProf = e.target.value; renderBatches(); });
  $("#nbCreate", v)?.addEventListener("click", doBatchCreate);
  v.querySelectorAll("[data-bsel]").forEach(x => x.addEventListener("click", () => { selectBatch(x.dataset.bsel); renderBatches(); }));
  $("#chCrm", v)?.addEventListener("change", e => { chartCrm = e.target.value; drawChart(chartCrm); });
  bindBatchDetail(v);
}
function batchDetail(b){
  const p = QC_PROFILES[b.qcp] || { name: b.qcp, ins: {} }, ans = bAns(b), one = ans.length <= 1, an = ans[0] || {}, edit = canEdit() && b.open && !b.qc && b.status !== "creating";
  const ss = (b.sids || []).map(id => bs(id)).filter(Boolean), [cls, txt] = batchStatus(b);
  const groups = {}; ss.filter(s => inBatch(s, b.id)).forEach(s => { (groups[s.stageKey] = groups[s.stageKey] || []).push(s); });
  const chk = {}; (b.qc?.checks || []).forEach(c => { (chk[c.p] = chk[c.p] || []).push(c); });
  const vcls = { pass: "ok", warn: "warn", fail: "bad", info: "" }, worst = cs => cs.find(c => c.verdict === "fail") || cs.find(c => c.verdict === "warn") || cs.find(c => c.verdict === "pass") || cs[0];
  const crmList = crmsFor(ans, p.prefix);
  const expOf = (x, ch) => { const c = x.t === "crm" ? crmRow(x.crm, ch) : null; return c ? { v: c.val, t: `${fmtNum(c.val)}${c.sd && p.crm?.mode === "sd" ? ` ± ${fmtNum(c.sd)}` : ""}` } : (x.t === "bl" || x.t === "pb") && ch.dl ? { t: `< ${fmtNum((x.t === "pb" ? p.pbBlank || p.blank || 5 : p.blank || 5) * ch.dl)}` } : null; };
  const posRows = (b.pos || []).map(x => {
    const cs = chk[x.p] || [], rs = posRs(b, x);
    const what = x.t === "s" ? `<button type="button" class="linkish mono" data-open="${esc(x.sid)}">${esc(x.sid)}</button>${goneFrom(b, x) && b.open ? ` <span class="small muted">left the batch (re-assay, route change or released); its result is optional</span>` : ""}` : x.t === "pd" || x.t === "cd" ? `of <span class="mono">${esc(x.of)}</span>`
      : x.t === "crm" ? (edit ? `<select class="inp" id="bc_${x.p}" data-live style="width:auto;max-width:100%"><option value="">Choose…</option>${[...new Set([...crmList, ...(b.draft?.crms?.[x.p] ? [b.draft.crms[x.p]] : [])])].map(id => `<option value="${esc(id)}" ${id === (b.draft?.crms?.[x.p] || x.crm) ? "selected" : ""}>${esc(id)}</option>`).join("")}</select>` : `<span class="mono">${esc(x.crm || "—")}</span>`) : x.t === "pb" ? "Barren quartz, prepared first" : "";
    const cell = (ch, i) => { const e = expOf(x, ch), r = rs[ch.k], c = cs.find(y => y.k === ch.k);
      const dv = b.draft?.vals?.[x.p]?.[ch.k];
      return edit ? `<input class="inp mono" id="${posInput(x, i, ch)}" data-live data-num ${ch.dl != null ? `data-dl="${ch.dl}"` : ""} ${ch.ul != null ? `data-ul="${ch.ul}"` : ""} ${e?.v != null ? `data-exp="${e.v}"` : ""} inputmode="decimal" autocomplete="off" style="width:110px" value="${esc(r?.raw || dv || "")}" aria-label="${esc(`Result at position ${x.p}${one ? "" : ` for ${anShort(ch)}`}`)}">${!one && e ? `<div class="small muted">${esc(e.t)}</div>` : ""}`
        : `<span class="mono">${r ? esc(resText(r, ch)) : "—"}</span>${!one && c && c.verdict !== "pass" ? `<div class="small" style="color:var(--${{ fail: "bad", warn: "warn" }[c.verdict] || "muted"})">${esc(c.stat || c.msg || "")}</div>` : !one && e ? `<div class="small muted">${esc(e.t)}</div>` : ""}`; };
    const w = worst(cs), e0 = one && ans[0] ? expOf(x, ans[0]) : null;
    const lead = one ? `<td class="mono">${x.p}</td><td>${esc(posLabel(p, x))}</td><td>${what}</td><td class="mono">${e0 ? esc(e0.t) : ""}</td>`
      : `<td class="pos-cell"><div class="small"><b class="mono">${x.p}</b> · ${esc(posLabel(p, x))}</div><div>${what}</div></td>`;
    return `<tr class="${x.t === "s" ? "" : "qcrow"}">${lead}${ans.map((ch, i) => `<td>${cell(ch, i)}</td>`).join("")}<td>${w ? `<span class="pill ${vcls[w.verdict]}">${esc(w.verdict === "info" ? "not judged" : w.verdict)}</span> <span class="small muted">${esc(one ? (w.stat || w.msg || "") : cs.filter(c => c.verdict === w.verdict && w.verdict !== "pass").map(c => `${c.kn || ""} ${c.stat || c.msg || ""}`.trim()).join("; "))}</span>` : ""}</td></tr>`;
  }).join("");
  const anyTwo = ss.some(twoPerson);
  const ready = ss.filter(s => inBatch(s, b.id) && curIdx(s) === targetIdx(s) - 1 && !releaseBlock(s));
  const releasable = ready.filter(s => selfCheck(s) !== "blocked").length, mineHeld = ready.length - releasable, adminSelf = ready.some(s => selfCheck(s) === "admin");
  const fails = (b.qc?.checks || []).filter(c => c.verdict === "fail"), warns = (b.qc?.checks || []).filter(c => c.verdict === "warn");
  const relDone = releasedFrom(b).length;
  const lab = c => `${esc(c.label)}${c.p ? ` at #${c.p}` : ""}${c.kn ? ` (${esc(c.kn)})` : ""}`;
  const inB = ss.filter(s => inBatch(s, b.id)), atAn = inB.filter(s => readyForResults(s) || released(s)).length;
  const qcOk = !!b.qc && (qcClear(b.qc.status) || !!b.qc.accepted);
  const st = [true, !!b.qc || (inB.length > 0 && atAn === inB.length), !!b.qc, qcOk, b.status === "done"].map(Boolean), nowAt = st.indexOf(false);
  const qcCount = ["crm", "bl", "pb", "pd", "cd"].map(t => [t, (b.pos || []).filter(x => x.t === t).length]).filter(x => x[1]).map(([t, n]) => `${n} ${qcName(p, t, n)}`);
  const step = (i, title, who, body) => `<li class="bstep ${st[i] ? "done" : i === nowAt ? "now" : "todo"}"><span class="dot">${st[i] ? "✓" : i + 1}</span><div class="stack" style="gap:6px;min-width:0">
      <div class="row" style="gap:8px"><b>${title}</b>${i === nowAt && b.open ? `<span class="pill gold">Next</span>` : ""}<span class="small muted">${who}</span></div>${body || ""}</div></li>`;
  const files = (b.files || []).length ? `<div class="small">File${b.files.length > 1 ? "s" : ""}: ${b.files.map(f => `<button type="button" class="linkish mono" data-rfile="${esc(f.id)}">${esc(f.name)}</button>`).join(", ")}</div>` : "";
  const draftMiss = b.draft ? (b.pos || []).filter(x => x.t === "s" && !goneFrom(b, x)).reduce((n, x) => n + ans.filter(ch => !b.draft.vals?.[x.p]?.[ch.k]).length, 0) : 0;   // QC positions a file leaves empty are not judged
  const table = `<div class="tbl-wrap"><table class="bpos${one ? "" : " multi"}"><thead><tr>${one ? "<th>#</th><th>Position</th><th>Sample or material</th><th>Expected</th>" : "<th>Position</th>"}${ans.map(ch => `<th>${one ? "Result" : esc(anShort(ch))} (${esc(ch.u || "")})</th>`).join("")}<th>Check</th></tr></thead><tbody>${posRows}</tbody></table></div>`;
  const moves = Object.keys(groups).length && b.open ? `<div class="stack" style="gap:6px">${Object.entries(groups).map(([k, list]) => { const s0 = list[0], pl = planOf(s0), ci = curIdx(s0), nx = pl[ci + 1];
      return `<div class="row" style="gap:8px"><span><b>${list.length}</b> at ${esc(stage(s0, k)?.name || k)}</span>${canEdit() && b.open ? (nx && !nx.target ? `<button type="button" class="btn small" data-bmove="${esc(k)}">Move ${list.length === 1 ? "it" : "all " + list.length} to: ${esc(nx.name)}</button>` : "") : ""}</div>`; }).join("")}</div>` : "";
  const s2 = b.qc ? "" : moves;
  const s3 = b.qc ? `<div class="small">Saved ${fmt(b.qc.at)} by ${esc(b.qc.tech || "")}${b.inst ? ` · ${esc(b.inst)}` : ""}</div>${files}`
    : `${files}${b.draft ? `<div class="notice warn" id="bDraft"><b>From ${esc(b.draft.file?.name || "a results file")}:</b> ${draftMiss ? `${draftMiss} value${draftMiss === 1 ? "" : "s"} to enter` : "check and save"}</div>` : ""}
      ${edit ? `<div class="row"><button type="button" class="btn primary" data-attach="batch:${esc(b.id)}">Attach results file</button></div>
      <details class="more" id="bType" ${b.draft ? "open" : ""}><summary>${b.draft ? "Complete and save" : "Type results instead"}</summary><div class="stack" style="gap:8px;margin-top:8px">${table}
        <div class="row"><label class="f" style="flex:1 1 220px"><span>Instrument file or worksheet</span><input id="bInst" autocomplete="off" placeholder="e.g. AAS run 13-10-02" value="${esc(b.draft?.file?.name || "")}"></label></div>
        <div class="row"><button type="button" class="btn primary" id="bSave">Save results and check QC</button></div></div></details>` : ""}`;
  const s4 = b.qc ? `<div class="notice ${b.qc.accepted ? "" : qcCls(b.qc.status)}"><b>${esc(qcLabel(b.qc.status))}</b> (checked ${fmt(b.qc.at)}). ${fails.length ? `Failed: ${fails.map(c => `${lab(c)}${c.stat ? ` (${esc(c.stat)})` : c.msg ? ` (${esc(c.msg)})` : ""}`).join("; ")}.` : ""} ${warns.length ? `Warnings: ${warns.map(c => `${lab(c)} (${esc(c.stat || c.msg || "")})`).join("; ")}.` : ""}
        ${(b.qc.trend || []).some(t => t.rule === "9side") ? `<div class="small">Bias: ${esc(b.qc.trend.filter(t => t.rule === "9side").map(t => `${t.crm}${t.k ? " " + t.k : ""}, ${t.msg}`).join("; "))}.</div>` : ""}
        ${b.qc.accepted ? `<div class="small">${b.qc.accepted.exception ? "Accepted as an exception" : "Accepted"} by ${esc(b.qc.accepted.tech)}, ${fmt(b.qc.accepted.at)}: ${esc(b.qc.accepted.why)}</div>` : ""}</div>
    ${b.open && canApprove() && !b.qc.accepted ? `<div class="stack" style="gap:8px"><label class="f"><span>Reason (required for any decision below)</span><input id="bWhy" data-clear placeholder="${b.qc.status === "fail" ? "e.g. CRM STD-AU-MED at +3.4 SD: re-fuse the batch" : "e.g. CRM at +2.3 SD, other checks in control"}"></label>
        ${b.qc.by === session?.u && !qcClear(b.qc.status) ? `<p class="small muted" style="margin:0">You saved these results, so ${isAdmin() ? "accepting them yourself is recorded as such" : "another lab supervisor or the lab manager accepts their warnings"}.</p>` : ""}
        <div class="row">${b.qc.status === "warn" && (b.qc.by !== session?.u || isAdmin()) ? `<button type="button" class="btn primary" data-bdec="accept">Accept the warnings</button>` : ""}
          <button type="button" class="btn${b.qc.status === "fail" ? " primary" : ""}" data-bdec="rerun">Re-run the batch</button>${relDone ? "" : `<button type="button" class="btn ghost" data-bdec="reopen">Correct an entry</button>`}
          ${b.qc.status === "fail" && isAdmin() ? `<button type="button" class="btn ghost danger" data-bdec="override">Accept the failure as an exception</button>` : ""}</div>
        ${relDone ? `<p class="small muted" style="margin:0">${relDone} sample${relDone === 1 ? " was" : "s were"} already released from this batch, so its entries can't be opened again: correct a released result with an amended certificate.</p>` : ""}</div>` : ""}` : "";
  const s5 = b.status === "done" ? `<div class="small">All results released.</div>` : `${b.qc ? moves : ""}${b.open && canApprove() && b.qc ? `<div class="stack" style="gap:6px">${adminSelf ? `<label class="f"><span>Some of these results were entered by you: reason for releasing them yourself (recorded on the certificates)</span><input id="bSelfWhy" data-clear></label>` : ""}
      <div class="row"><button type="button" class="btn ${releasable ? "primary" : ""}" id="bRelease" ${releasable ? "" : "disabled data-hold"}>Release results for ${releasable} sample${releasable === 1 ? "" : "s"}${qcStepOn() ? " at QA/QC review" : ""}</button><span class="small muted">Each gets its own certificate.${mineHeld ? ` ${mineHeld} with results you entered wait for another supervisor.` : ""}</span></div></div>` : relDone ? `<div class="small">${relDone} released.</div>` : ""}`;
  return `<div class="panel stack" id="batchBox" style="gap:12px">
    <div class="row" style="gap:10px"><h3 style="margin:0" class="mono">${esc(b.id)}</h3><span class="pill ${cls}">${esc(txt)}</span><span class="small muted">${esc(p.name)} · ${one ? (an.n ? `${esc(an.n)} in ${esc(an.u)}` : "") : `checks ${esc(listAnd(ans.map(anShort)))}`}${b.rerunOf ? ` · re-run of <button type="button" class="linkish mono" data-batch="${esc(b.rerunOf)}">${esc(b.rerunOf)}</button>` : ""}</span></div>
    ${canEdit() && b.open && anyTwo ? `<div class="form">${witnessField("bWit")}</div>` : ""}
    <ol class="bsteps">
      ${step(0, "Samples and QC", `${fmt(b.at)} · ${esc(b.tech || "")}`, `<div class="small">${inB.length} sample${inB.length === 1 ? "" : "s"}${qcCount.length ? ` · ${esc(qcCount.join(" · "))}` : ""}${b.fromFile ? ` · from <button type="button" class="linkish mono" data-rfile="${esc(b.fromFile.id)}">${esc(b.fromFile.name)}</button>` : ""}</div><div class="small muted">${esc(qcRuleText(p, ans))}</div>`)}
      ${step(1, "Preparation and analysis", "Lab technician", s2)}
      ${step(2, "Results", "Lab technician", s3)}
      ${step(3, "QC check", "Automatic · decisions by a lab supervisor", s4)}
      ${step(4, "Release", "Lab supervisor who did not enter the results", s5)}
    </ol>
    ${edit ? "" : `<details class="more" id="bPos" open><summary>Positions and results</summary>${table}</details>`}
    ${(b.log || []).length ? `<details class="more"><summary>Batch history</summary><ul class="hist">${b.log.slice().reverse().map(l => `<li><time>${fmt(l.at)} · ${esc(l.tech || "")}</time><div>${esc(l.note)}</div></li>`).join("")}</ul></details>` : ""}
  </div>`;
}
function bindBatchDetail(v){
  v.querySelectorAll("[data-bmove]").forEach(x => x.addEventListener("click", () => doBatchMove(x.dataset.bmove)));
  $("#bSave", v)?.addEventListener("click", doBatchSave);
  $("#bRelease", v)?.addEventListener("click", doBatchRelease);
  v.querySelectorAll("[data-bdec]").forEach(x => x.addEventListener("click", () => doBatchDecide(x.dataset.bdec)));
}
/* Control chart: every result for one reference material and result, from all batches that used it, as SD from the certified value each batch
   was judged on (or % from it where the rule is not in SD). */
async function drawChart(key){
  const box = $("#chBox"); if (!box) return;
  const [id, an, u = ""] = String(key).split("|"), c = (cfg.crms || []).find(x => x.id === id && x.an === an && (x.u || "") === u);
  if (!c || !db){ box.innerHTML = ""; return; }
  let pts = [];
  try {
    const hist = await crmHistory(id);
    const keys = new Set(hist.flatMap(b => bAns(b).filter(ch => crmMatch(c, ch)).map(ch => ch.k)));
    for (const k of keys) pts.push(...crmSeries(hist.filter(b => bAns(b).some(ch => ch.k === k && crmMatch(c, ch))), id, k, ""));
  } catch { box.innerHTML = `<p class="small muted">Could not load the results.</p>`; return; }
  if (chartCrm !== key) return;
  pts.sort((a, b) => a.at - b.at || a.p - b.p); pts = pts.slice(-60);
  if (!pts.length){ box.innerHTML = `<p class="small muted" style="margin:0">No results for ${esc(c.id)} ${esc(c.an)} yet.</p>`; return; }
  const sdMode = pts.every(q => q.sd > 0), sc = q => sdMode ? (q.v - q.exp) / q.sd : (q.v - q.exp) / q.exp * 100;
  const lines = sdMode ? [[0, "Certified"], [2, "+2 SD"], [-2, "−2 SD"], [3, "+3 SD"], [-3, "−3 SD"]] : [[0, "Certified"], [10, "+10%"], [-10, "−10%"]];
  const flags = [], seq = [];
  pts.forEach(q => { seq.push(q); trendRules(seq).forEach(t => { if (!flags.some(f => f.rule === t.rule && f.i === seq.length - 1)) flags.push({ ...t, i: seq.length - 1 }); }); });
  const ys = [...pts.map(sc), ...lines.map(l => l[0])], lo = Math.min(...ys), hi = Math.max(...ys), pad = (hi - lo) * 0.08 || 1;
  const W = 640, Hh = 220, L = 64, R = 12, T = 12, B = 28, x = i => L + (pts.length === 1 ? (W - L - R) / 2 : i * (W - L - R) / (pts.length - 1)), y = v => T + (hi + pad - v) / (hi - lo + 2 * pad) * (Hh - T - B);
  const col = { pass: "var(--ok)", warn: "var(--warn)", fail: "var(--bad)" }, ring = new Set(flags.filter(f => f.rule === "2of2s").flatMap(f => [f.i - 1, f.i]));
  const recalc = pts.some(q => q.exp !== c.val || (q.sd || 0) !== (c.sd || 0));
  box.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Control chart for ${esc(c.id)} ${esc(c.an)}">
    ${lines.map(([v, l], i) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="${i === 0 ? "cl-c" : i < 3 ? "cl-w" : "cl-f"}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${esc(l)}</text>`).join("")}
    <polyline fill="none" class="cl-line" points="${pts.map((q, i) => `${x(i)},${y(sc(q))}`).join(" ")}"/>
    ${pts.map((q, i) => `${ring.has(i) ? `<circle cx="${x(i)}" cy="${y(sc(q))}" r="8" fill="none" style="stroke:var(--warn);stroke-width:2"/>` : ""}<circle cx="${x(i)}" cy="${y(sc(q))}" r="4" style="fill:${col[q.verdict] || "var(--ink)"}"><title>${esc(q.b)}: ${esc(fmtNum(q.v))} ${esc(c.u)} against ${esc(fmtNum(q.exp))}${q.sd ? ` ± ${esc(fmtNum(q.sd))}` : ""} (${esc(q.verdict)})</title></circle>`).join("")}
    <text x="${L}" y="${Hh - 8}">${esc(fmtDate(pts[0].at))}</text><text x="${W - R}" y="${Hh - 8}" text-anchor="end">${esc(fmtDate(pts.at(-1).at))}</text></svg>
    <p class="small muted" style="margin:0">${pts.length} result${pts.length === 1 ? "" : "s"} for ${esc(c.id)} ${esc(c.an)} (certified now ${esc(fmtNum(c.val))} ± ${esc(fmtNum(c.sd || 0))} ${esc(c.u)}). ${sdMode ? "Plotted in SD from the certified value each batch used" : "Plotted as % from the certified value each batch used"}${recalc ? "; the register value has changed since some of these batches, and each point keeps the value it was judged on" : ""}. Green passed, amber warning, red failed; a ring marks two in a row beyond 2 SD. ${pts.filter(q => q.verdict === "fail").length} failed.</p>
    ${flags.length ? `<div class="notice warn"><b>Trend:</b> ${esc([...new Map(flags.map(f => [f.rule, f.msg])).values()].join("; "))}.</div>` : ""}`;
}

/* ---------- results for a section account ---------- */
let secRes = [], secResSub = null, secResKey = "";
const seenKey = () => "seen-" + (session?.u || "");
function watchSectionResults(){
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
function resultsBadge(){ const t = $('#tabs [data-tab="results"]'); if (t) t.textContent = newResults().length ? `Results (${newResults().length} new)` : "Results"; }
function renderResultsTab(){
  const v = $("#view-results"); if (!v) return;
  if (session?.role !== "section"){ v.innerHTML = ""; return; }
  const seen = +lsGet(seenKey()) || 0, list = secRes.slice().sort((a, b) => b.certs.at(-1).at - a.certs.at(-1).at).slice(0, 200), fresh = newResults().length;
  v.innerHTML = `<div class="stack"><div class="panel stack" style="gap:8px"><h2>Results for ${esc(session.sec)} · ${esc(sectionName(session.sec))}</h2>
      <p class="small muted" style="margin:0">Certificates of analysis for samples your section submitted, newest first. ${fresh ? `<b>${fresh} new since you last marked them as seen.</b>` : "Nothing new since you last looked."} In the production system this notice also goes to the section by email.</p>
      ${fresh ? `<div class="row"><button type="button" class="btn" id="secSeen">Mark all as seen</button></div>` : ""}</div>
    ${list.length ? `<div class="panel"><div class="tbl-wrap"><table class="cardy"><thead><tr><th>Sample</th><th>Type</th><th>Site code</th><th>Test</th><th>Certificate</th><th>Released</th></tr></thead><tbody>
      ${list.map(s => { const c = s.certs.at(-1); return `<tr><td><button type="button" class="linkish mono" data-open="${esc(s.id)}">${esc(s.id)}</button>${c.at > seen ? ` <span class="pill gold">New</span>` : ""}</td><td>${esc(s.type || "")}</td><td>${esc(tagText(s))}</td><td>${esc(c.testName || "")}</td><td class="mono">${esc(c.no)}${c.amends ? ` <span class="pill warn">Amended</span>` : ""}</td><td style="white-space:nowrap">${fmt(c.at)}</td></tr>`; }).join("")}</tbody></table></div></div>`
      : `<div class="panel empty"><strong>No released results yet</strong>Certificates for ${esc(session.sec)} samples appear here as soon as the lab releases them.</div>`}</div>`;
  $("#secSeen", v)?.addEventListener("click", () => { lsSet(seenKey(), String(Date.now())); resultsBadge(); renderResultsTab(); });
}
