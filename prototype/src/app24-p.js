/* ---------- v24: departments, evaluation of released results, re-assay requests, the Results tab for staff ----------
   The lab assays and releases. Whoever evaluates (a department marked so in Settings, Metallurgy by default, and the lab manager and lab
   supervisors) sees the flags on each released result (limits, checks, QC, range) and records an evaluation: accepted, a query, or a request
   to re-assay, which the lab sees on the board and on the record. Everyone else sees the results only. */
const deptList = () => Array.isArray(cfg.depts) && cfg.depts.length ? cfg.depts : DEFAULT_CONFIG.depts;
const deptOf = u => { const x = (cfg.users || []).find(y => y.u === u); return x ? x.dept || (LAB_ROLES.includes(x.role) ? "Assay Lab" : "") : ""; };
const myDept = () => session ? deptOf(session.u) : "";
const deptEvaluates = d => !!d && deptList().some(x => x.n === d && x.ev);
const canEval = () => !!session && (session.role === "admin" || session.role === "super" || (isStaff() && deptEvaluates(myDept())));
const EV = { ok: "Accepted", query: "Query", redo: "Re-assay requested" };
const EV_CLS = { ok: "ok", query: "warn", redo: "bad" };
const lastCert = s => (s && s.certs || []).at(-1) || null;
const lastEval = s => (s && s.evals || []).at(-1) || null;
/* Evaluated: an evaluation recorded after the latest certificate. */
const evaluated = s => { const c = lastCert(s), e = lastEval(s); return !!(c && e && e.at >= c.at); };
/* What an evaluator should look at on the latest results: limits crossed, checks not met, results over the method's range, lab batch QC. */
function evalFlags(s){
  const c = lastCert(s), rows = c ? c.rows || {} : s.results?.rows || {}, out = [];
  try {
    limitHits(s, rows).forEach(h => out.push({ cls: "bad", t: alertLine(s, h) + (h.act ? `: ${h.act}` : "") }));
    resultChecks(s, rows).filter(x => !x.ok).forEach(x => out.push({ cls: "warn", t: x.msg.charAt(0).toUpperCase() + x.msg.slice(1) }));
    overRes(s, rows).forEach(a => out.push({ cls: "warn", t: `${a.s || a.n} over the method's range` }));
    Object.values(labsOf(s)).filter(l => l && l.q && ["fail", "warn"].includes(l.q)).forEach(l => out.push({ cls: qcCls(l.q), t: `Lab batch ${l.b}: ${qcLabel(l.q)}` }));
  } catch {}
  return out;
}
const flagPills = fl => fl.length ? `<span class="pill ${fl.some(f => f.cls === "bad") ? "bad" : "warn"}">${fl.length} flag${fl.length === 1 ? "" : "s"}</span>` : `<span class="pill">No flags</span>`;
function evalBox(s){
  if (!canEval() || (!lastCert(s) && !s.results)) return "";
  const fl = evalFlags(s), ev = s.evals || [], c = lastCert(s), due = c && !evaluated(s);
  return `<div class="evalbox stack" id="evalBox">
    <div class="row" style="gap:8px"><b>Evaluation</b>${flagPills(fl)}${due ? `<span class="pill gold">To evaluate</span>` : ""}</div>
    ${fl.length ? `<ul class="flags">${fl.map(f => `<li class="${f.cls}">${esc(f.t)}</li>`).join("")}</ul>` : ""}
    ${ev.length ? `<ul class="evlist">${ev.slice().reverse().slice(0, 6).map(e => `<li><span class="pill ${EV_CLS[e.v] || ""}">${esc(EV[e.v] || e.v)}</span> <b>${esc(e.tech)}</b>${e.dept ? ` · ${esc(e.dept)}` : ""} <span class="muted small">${fmt(e.at)}</span>${e.note ? `<div class="small">${esc(e.note)}</div>` : ""}</li>`).join("")}</ul>` : ""}
    ${c ? `<div class="evform">
      <div class="seg" role="radiogroup" aria-label="Evaluation">${Object.entries(EV).map(([k, l], i) => `<label class="seg-o ev-${k}"><input type="radio" name="evV" value="${k}" ${i ? "" : "checked"}><span>${esc(l)}</span></label>`).join("")}</div>
      <div class="row"><input class="inp" id="evNote" data-clear placeholder="Comment (needed for a query or re-assay)" style="flex:1 1 240px;width:auto"><button type="button" class="btn primary" id="evBtn">Record</button></div></div>`
      : `<div class="small muted">Evaluated once the results are released.</div>`}
  </div>`;
}
/* The lab's view of a request to re-assay. */
function reqNote(s){
  if (!s.rq || !isStaff()) return "";
  const e = (s.evals || []).filter(x => x.v === "redo").at(-1);
  return `<div class="notice bad" id="reqNote"><b>Re-assay requested</b>${e ? ` by ${esc(e.tech)}${e.dept ? ` (${esc(e.dept)})` : ""}, ${fmt(e.at)}${e.note ? `: ${esc(e.note)}` : ""}` : ""}.${canEdit() && redoOk(s) ? ` Use <b>Send back for re-assay</b> below.` : ""}</div>`;
}
async function doEvaluate(){
  const s0 = current?.body; if (!s0 || !canEval() || !db) return;
  const v = document.querySelector('input[name="evV"]:checked')?.value || "ok", note = val("#evNote").slice(0, 300);
  if (v !== "ok" && !note){ toast(v === "redo" ? "Say why it needs re-assaying." : "Write the query."); $("#evNote")?.focus(); return; }
  const mk = s => {
    const at = nowAfter(s), e = { at, by: session.u, tech: session.name, ...(myDept() ? { dept: myDept() } : {}), v, ...(note ? { note } : {}) };
    return { evals: [...(s.evals || []), e], ...(v === "redo" ? { rq: true } : {}),
      history: [...(s.history || []), { key: s.stageKey, sn: stage(s, s.stageKey)?.name || "", at, by: session.u, tech: session.name, ev: true, note: `Evaluation${e.dept ? ` (${e.dept})` : ""}: ${EV[v]}${note ? ". " + note : ""}` }] };
  };
  const msg = v === "redo" ? "Re-assay requested; the lab sees it on the board" : "Evaluation recorded";
  if (canEdit()){ await act(s => ({ upd: mk(s), msg }), { anyStage: true, clear: ["evNote"] }); return; }
  // Evaluators outside the lab: no lease; the server takes only an added evaluation, and a record changed meanwhile is read again once.
  const ref = db.doc("samples/" + s0.id);
  for (let i = 0; i < 2; i++){
    try { const s = (await ref.get()).data(); if (!s) return; const upd = mk(s); upd.updatedAt = Date.now(); await ref.update(upd); clearForm(["evNote"]); toast(msg); return; }
    catch (e){ if (i) writeFailed(e); else await sleep(400); }
  }
}
/* Samples with a re-assay request still open, for the lab's board. */
const reqs = new Map();
let reqSub = null;
function watchReq(){
  if (reqSub || !db || !isStaff()) return;
  reqSub = db.collection("samples").where("rq", "==", true).limit(100).onSnapshot(snap => {
    reqs.clear(); snap.docs.forEach(d => { const x = d.data(); if (x && x.id && x.rq) reqs.set(x.id, x); });
    if (tab === "board") rerenderSoon();
  }, () => {});
}
function boardReqNote(){
  if (!reqs.size || !isStaff()) return "";
  const list = [...reqs.values()].sort((a, b) => (lastEval(b)?.at || 0) - (lastEval(a)?.at || 0));
  return `<div class="notice bad" id="bdReq"><b>Re-assay requested (${list.length}):</b> ${list.slice(0, 10).map(s => { const e = (s.evals || []).filter(x => x.v === "redo").at(-1);
    return `<button type="button" class="linkish mono" data-open="${esc(s.id)}">${esc(s.id)}</button>${e ? ` <span class="small">${esc(e.tech)}${e.note ? `: ${esc(e.note)}` : ""}</span>` : ""}`; }).join("<br>")}${list.length > 10 ? `<br>+${list.length - 10} more` : ""}</div>`;
}

/* ---------- Results tab for staff: released results, newest first ---------- */
let staffRes = [], staffResKey = "", staffResSub = null, resDays = 30, resSec = "", resQ = "", resDue = false;
function watchStaffResults(){
  const key = db && session && session.role !== "section" && allowedTabs().includes("results") && (canEval() || tab === "results") ? String(resDays) : "";
  if (key === staffResKey) return;
  if (staffResSub){ staffResSub(); staffResSub = null; }
  staffResKey = key; staffRes = [];
  if (!key) return;
  staffResSub = db.collection("samples").where("relAt", ">", Date.now() - resDays * 86400e3).orderBy("relAt", "desc").limit(400).onSnapshot(snap => {
    staffRes = snap.docs.map(d => d.data()).filter(x => x && x.id && (x.certs || []).length);
    staffResBadge(); if (tab === "results") renderResultsTab();
  }, () => {});
}
const toEvaluate = () => canEval() ? staffRes.filter(s => !evaluated(s)) : [];
function staffResBadge(){
  if (session?.role === "section") return;
  const t = $('#tabs [data-tab="results"]'); if (!t) return;
  const n = toEvaluate().filter(s => evalFlags(s).length).length;
  t.innerHTML = n ? `Results <span class="count flag" title="${n} flagged result${n === 1 ? "" : "s"} to evaluate">${n}</span>` : "Results";
}
/* One line per result on the latest certificate, short names first: "AuFx 0.12 g/t · AuSx 0.004 mg/L". */
function certSummary(c, s){
  const defs = (() => { try { return anOf(s); } catch { return []; } })(), short = a => a.s || defs.find(x => x.k === a.k)?.s || a.n;
  const vals = (c.an || []).filter(a => c.rows?.[a.k] && a.t !== "pick" && a.t !== "text").slice(0, 5).map(a => `${short(a)} ${resText(c.rows[a.k], a)}${a.u ? " " + a.u : ""}`);
  if (c.att && c.file) vals.push(`${vals.length ? "rest in" : "In"} file ${c.file.name}`);
  return vals.join(" · ");
}
function renderStaffResults(v){
  watchStaffResults();
  const ev = canEval(), q = resQ.trim().toUpperCase().replace(/\s+/g, "");
  const list = staffRes.filter(s => (!resSec || s.section === resSec) && (!resDue || !evaluated(s)) &&
    (!q || [s.id, tagText(s), s.siteRef || "", s.purpose || "", s.type || ""].some(x => String(x).toUpperCase().replace(/\s+/g, "").includes(q))));
  const due = toEvaluate().length, flagged = toEvaluate().filter(s => evalFlags(s).length).length;
  const keepFocus = document.activeElement?.id === "resQ";
  v.innerHTML = `<div class="stack">
    <div class="panel stack res-head" style="gap:10px">
      <div class="row" style="gap:10px"><h2 style="margin:0">Results</h2><span class="small muted">Released in the last ${resDays} days</span>${ev ? `<span class="grow"></span><span class="pill${flagged ? " bad" : ""}">${flagged} flagged</span><span class="pill${due ? " gold" : ""}">${due} to evaluate</span>` : ""}</div>
      <div class="row bd-tools" style="gap:8px">
        <input class="inp" id="resQ" placeholder="Search ID, site code, purpose" value="${esc(resQ)}" style="flex:1 1 220px;width:auto">
        <select class="inp" id="resSec" style="width:auto" aria-label="Section"><option value="">All sections</option>${(cfg.sections || []).map(x => `<option value="${esc(x.code)}" ${resSec === x.code ? "selected" : ""}>${esc(x.code)} · ${esc(x.name)}</option>`).join("")}</select>
        <select class="inp" id="resDays" style="width:auto" aria-label="Period">${[7, 30, 90].map(d => `<option value="${d}" ${resDays === d ? "selected" : ""}>${d} days</option>`).join("")}</select>
        ${ev ? `<label class="row" style="gap:6px"><input type="checkbox" id="resDue" ${resDue ? "checked" : ""}> To evaluate only</label>` : ""}
      </div></div>
    ${list.length ? `<div class="panel"><div class="tbl-wrap"><table class="cardy restbl"><thead><tr><th>Sample</th><th>Type · for</th><th>Results</th><th>Released</th>${ev ? "<th>Flags</th><th>Evaluation</th>" : ""}</tr></thead><tbody>
      ${list.slice(0, 300).map(s => { const c = lastCert(s), fl = ev ? evalFlags(s) : [], e = lastEval(s);
        return `<tr${ev && !evaluated(s) && fl.length ? ' class="due"' : ""}><td data-l="Sample"><button type="button" class="linkish mono" data-open="${esc(s.id)}">${esc(s.id)}</button>${tagText(s) ? `<div class="small muted mono">${esc(tagText(s))}</div>` : ""}</td>
          <td data-l="Type · for">${esc(s.type || "")}<div class="small muted">${esc(s.purpose || "")}</div></td>
          <td data-l="Results" class="mono small">${esc(certSummary(c, s))}${c.amends ? ` <span class="pill warn">Amended</span>` : ""}</td>
          <td data-l="Released" style="white-space:nowrap">${fmt(c.at)}</td>
          ${ev ? `<td data-l="Flags">${fl.length ? `<span class="pill ${fl.some(f => f.cls === "bad") ? "bad" : "warn"}" title="${esc(fl.map(f => f.t).join("; "))}">${fl.length} flag${fl.length === 1 ? "" : "s"}</span>` : `<span class="muted small">—</span>`}</td>
            <td data-l="Evaluation">${evaluated(s) ? `<span class="pill ${EV_CLS[e.v] || ""}">${esc(EV[e.v] || e.v)}</span> <span class="small muted">${esc(e.tech)}</span>` : `<button type="button" class="btn small" data-open="${esc(s.id)}">Evaluate</button>`}</td>` : ""}</tr>`; }).join("")}</tbody></table></div>
      ${list.length > 300 ? `<div class="small muted" style="margin-top:6px">+${list.length - 300} more: narrow the search</div>` : ""}</div>`
      : `<div class="panel empty"><strong>${staffResKey ? "No released results" : "Loading results…"}</strong></div>`}</div>`;
  const qi = $("#resQ", v);
  qi.addEventListener("input", () => { resQ = qi.value; renderResultsTab(); });
  if (keepFocus){ qi.focus(); qi.setSelectionRange(qi.value.length, qi.value.length); }
  $("#resSec", v).onchange = e => { resSec = e.target.value; renderResultsTab(); };
  $("#resDays", v).onchange = e => { resDays = +e.target.value; watchStaffResults(); renderResultsTab(); };
  $("#resDue", v)?.addEventListener("change", e => { resDue = e.target.checked; renderResultsTab(); });
}
