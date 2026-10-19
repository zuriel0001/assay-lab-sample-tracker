/* ---------- blind QA/QC re-assay (v20) ---------- */
/* Supervisors and admins pick samples already assayed, from Storage or the Ledger, for a blind check. Each pick becomes a new sample in the
   QC section with its own ID (QC-YYYYMMDD-0001) and nothing on it that points back to the original. The link is kept only in blind/<blind ID>,
   which this page reads for supervisors and admins only; the real server must refuse it to everyone else. Technicians receive, assay and
   release the blind sample like any other. Supervisors see its results beside the original's, on both records, and record the comparison in
   the same blind/ document, so nothing on either sample record (which technicians and the public lookup can read) gives the pair away. */
const blinds = new Map(), blindOf = new Map();   // blind ID -> link; original ID -> [blind IDs]
const qaPicks = new Set(), qaDocs = new Map();
let blindSub = null, qaState = null, qaListOpen = false, qaListAll = false;
function watchBlinds(){
  const on = !!db && canApprove();
  if (on === !!blindSub) return;
  if (blindSub){ blindSub(); blindSub = null; }
  blinds.clear(); blindOf.clear(); qaPicks.clear(); qaDocs.clear(); closeQaBox(); qaSlots();
  if (!on) return;
  blindSub = db.collection("blind").onSnapshot(snap => {
    blinds.clear(); blindOf.clear();
    snap.docs.forEach(d => { const x = d.data(); if (x && x.id && x.of){ blinds.set(x.id, x); blindOf.set(x.of, [...(blindOf.get(x.of) || []), x.id]); } });
    qaSoon();
  }, () => {});
}
function qaSoon(){
  clearTimeout(qaSoon.t);
  qaSoon.t = setTimeout(() => {
    if (tab === "storage") renderStorage();
    else if (tab === "ledger") renderLedger();
    else if (tab === "track" && current?.body) renderTrack();
  }, 60);
}
/* The other record of a pair: the record open now, from the board when it is still in the lab, otherwise read and kept for 15 seconds. */
function qaDoc(id){
  if (current?.body?.id === id) return current.body;
  if (samples.has(id)) return samples.get(id);
  const c = qaDocs.get(id);
  if (db && !c?.busy && (!c || Date.now() - c.t > 15000)){
    qaDocs.set(id, { d: c?.d || null, t: c?.t || 0, busy: true });
    db.doc("samples/" + id).get().then(snap => {
      const d = snap.exists && snap.data()?.id ? snap.data() : null, was = JSON.stringify(c?.d || null);
      qaDocs.set(id, { d, t: Date.now() });
      if (JSON.stringify(d) !== was) qaSoon();
    }).catch(() => qaDocs.set(id, { d: c?.d || null, t: Date.now() }));
  }
  return c?.d || null;
}

/* ---------- picking ---------- */
function qaPickable(id){
  if (!canApprove() || blinds.has(id)) return false;
  if (stored.has(id)) return true;
  const s = samples.get(id);
  return !!s && (s.certs || []).length > 0 && keptMaterials(s).length > 0;
}
const qaPickBox = id => qaPickable(id) ? `<label class="qa-pick"><input type="checkbox" data-qapick="${esc(id)}" ${qaPicks.has(id) ? "checked" : ""}> Blind QA/QC</label>` : "";
const qaOfNote = id => canApprove() && blinds.has(id) ? `<div class="small qa-of">Blind of <button type="button" class="linkish mono" data-open="${esc(blinds.get(id).of)}">${esc(blinds.get(id).of)}</button></div>` : "";
function qaBar(){
  if (!canApprove() || !qaPicks.size) return "";
  return `<div class="qa-bar"><b>${qaPicks.size} picked for a blind QA/QC check</b><span style="flex:1"></span><button type="button" class="btn primary small" data-qa="make">Issue blind IDs</button><button type="button" class="btn ghost small" data-qa="clear">Clear</button></div>`;
}
const qaSlot = () => `<div class="qa-slot">${qaBar()}</div>`;
/* Every open view shows the same picks. */
function qaSlots(){
  document.querySelectorAll(".qa-slot").forEach(x => { x.innerHTML = qaBar(); });
  document.querySelectorAll("[data-qapick]").forEach(c => { c.checked = qaPicks.has(c.dataset.qapick); });
}
function bindQa(v){
  $("#qaList", v)?.addEventListener("toggle", e => { qaListOpen = e.target.open; });
  $("#qaAll", v)?.addEventListener("click", () => { qaListAll = true; renderStorage(); });
}
document.addEventListener("change", e => {
  const c = e.target.closest?.("[data-qapick]"); if (!c) return;
  if (c.checked && qaPicks.size >= 50 && !qaPicks.has(c.dataset.qapick)){ c.checked = false; toast("Up to 50 samples in one blind check."); return; }
  c.checked ? qaPicks.add(c.dataset.qapick) : qaPicks.delete(c.dataset.qapick);
  qaSlots();
});
document.addEventListener("click", e => {
  const b = e.target.closest?.("[data-qa]");
  if (b){ if (b.dataset.qa === "clear"){ qaPicks.clear(); qaSlots(); } else openQaBox(); return; }
  const r = e.target.closest?.("[data-qarec]");
  if (r) qaRecord(r.dataset.qarec);
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && qaState && !qaState.busy) closeQaBox(); });

/* ---------- issuing blind IDs ---------- */
async function qaLoad(id){
  if (samples.has(id)) return samples.get(id);
  try { const d = await db.doc("samples/" + id).get(); return d.exists && d.data()?.id ? d.data() : null; } catch { return null; }
}
function qaWhyNot(o, id){
  if (!o) return "not found";
  if (blinds.has(id)) return "is itself a blind sample";
  if (!(o.certs || []).length) return "no released results";
  if (!keptMaterials(o).length) return "no material kept";
  return "";
}
/* The original's route and test. The pulp is already prepared, so the blind sample goes from receipt straight to the first analysis step. */
function blindFields(o){
  const r = routeByCode(o.route);
  const rf = r && (r.tests || []).includes(o.test) ? routeFields(r, o.test)
    : { route: o.route || "", routeName: o.routeName || "", test: o.test || "", testName: o.testName || testOf(o.test)?.name || "", plan: clone(planOf(o)), retention: clone(o.retention || []),
        qc: o.qc || "", qcp: o.qcp || "", qcg: clone(groupsOf(o)), triggers: clone(o.triggers || []), two: !!o.two, grav: "", dil: [] };
  const p = rf.plan, first = p.findIndex((x, i) => i > 1 && x.phase !== "intake" && x.phase !== "prep");
  if (first > 2) rf.plan = [{ ...p[0], hours: 1 }, p[1], ...p.slice(first)];
  return rf;
}
/* A solid's re-assay is done on its pulp, logged as an assay pulp, which also keeps the original's sample type off the blind record.
   The record is written as a QA/QC section submission (the same document as Submit); who issued it is kept in the link only. */
const blindType = o => (typeOf("pulp")?.tests || []).includes(o.test) ? typeOf("pulp") : typeOf(o.typeKey) || { key: o.typeKey || "", name: o.type || "" };
function blindBody(o, id, at, i, n, batchKey){
  const rf = blindFields(o), t = blindType(o);
  return { v: 13, id, type: t.name, typeKey: t.key, purpose: purposeOf("qc")?.name || "Quality control", purposeKey: "qc", ...rf, details: {}, reassays: 0,
    submitter: "QA/QC", section: "QC", receivedBy: "", receivedAt: null, recvAt: null, recv: null, source: "", collectedAt: null, containers: 1, massKg: null, seal: "", priority: "Routine",
    hazards: (o.hazards || []).slice(), analyses: [], notes: "", createdAt: at, createdBy: "public", createdByName: "QA/QC", updatedAt: at,
    stageKey: "submitted", stageAt: at, location: "", flag: "", open: true, onHand: false, lab: true, batchKey, batchSize: n, batchIndex: i + 1,
    tags: [], tagNo: "", siteRef: "", siteRefU: "",
    history: [{ key: "submitted", sn: rf.plan[0].name, at, by: "public", name: "QA/QC", note: "Submitted for a QA/QC check", ref: "" }] };
}
const shuffled = xs => { const a = xs.slice(); for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
async function openQaBox(){
  if (!canApprove() || !qaPicks.size || !db) return;
  qaState = { items: [...qaPicks].sort().map(id => ({ id, o: null, why: "" })), loading: true, done: null, busy: false, pending: [] };
  renderQaBox();
  const q = qaState;
  for (const it of q.items){ it.o = await qaLoad(it.id); it.why = qaWhyNot(it.o, it.id); }
  if (qaState !== q) return;
  q.loading = false; renderQaBox();
}
function closeQaBox(){ qaState = null; $("#qaBox")?.remove(); if (!$("#upBox")) document.body.classList.remove("modal-open"); }
const matText = ms => ms.map(m => `${m.item}${m.loc ? " · " + m.loc : ""}`).join("; ");
function renderQaBox(){
  const q = qaState; if (!q) return;
  let box = $("#qaBox");
  if (!box){ box = document.createElement("div"); box.id = "qaBox"; box.className = "modal"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-labelledby", "qaTitle"); document.body.appendChild(box); document.body.classList.add("modal-open"); }
  const ok = q.items.filter(x => x.o && !x.why);
  let body;
  if (q.done) body = `<div class="notice ok"><b>${q.done.length} blind sample${q.done.length === 1 ? "" : "s"} issued.</b> Waiting for receipt in the lab.</div>
    ${q.pending.length ? `<div class="notice bad"><b>Link to the original not saved:</b> ${q.pending.map(x => `<span class="mono">${esc(x.id)}</span>`).join(", ")} <button type="button" class="btn small" id="qaRetry">Retry</button></div>` : ""}
    <div class="tbl-wrap"><table><thead><tr><th>Blind ID</th><th>Original</th><th>Take from</th></tr></thead><tbody>
      ${q.done.map(x => `<tr><td class="mono"><b>${esc(x.id)}</b></td><td class="mono">${esc(x.of)}</td><td>${esc(matText(x.mats)) || "—"}</td></tr>`).join("")}</tbody></table></div>
    <div class="row"><button type="button" class="btn primary" id="qaLabels">Print labels</button><button type="button" class="btn" id="qaDone">Close</button></div>`;
  else body = `${q.loading ? `<div class="small muted">Loading…</div>` : ""}
    <div class="tbl-wrap"><table><thead><tr><th>Sample</th><th>Type</th><th>Test</th><th>Material kept</th><th></th><th></th></tr></thead><tbody>
      ${q.items.map(x => { const o = x.o, before = blindOf.get(x.id) || [];
        return `<tr><td class="mono">${esc(x.id)}</td><td>${o ? esc(o.type || "") : ""}</td><td>${o ? esc(o.testName || testOf(o.test)?.name || "") : ""}</td><td>${o ? esc(matText(keptMaterials(o))) || "—" : ""}</td>
          <td>${q.loading && !o ? "" : x.why ? `<span class="pill warn">${esc(x.why)}</span>` : `<span class="pill ok">Ready</span>`}${before.length ? `<div class="small muted">Checked before: ${before.map(esc).join(", ")}</div>` : ""}</td>
          <td><button type="button" class="btn ghost small" data-qadrop="${esc(x.id)}" aria-label="Remove ${esc(x.id)}">✕</button></td></tr>`; }).join("")}</tbody></table></div>
    <label class="f"><span>Note (optional)</span><input class="inp" id="qaNote" maxlength="200"></label>
    <div class="row"><button type="button" class="btn primary" id="qaGo" ${q.loading || q.busy || !ok.length ? "disabled" : ""}>${q.busy ? "Issuing…" : `Issue ${ok.length} blind ID${ok.length === 1 ? "" : "s"}`}</button><button type="button" class="btn" id="qaCancel" ${q.busy ? "disabled" : ""}>Cancel</button></div>`;
  const note = $("#qaNote", box)?.value || "";
  box.innerHTML = `<div class="modal-card stack" style="gap:12px">
    <div class="row" style="gap:8px"><h3 id="qaTitle" style="margin:0">Blind QA/QC check</h3><span class="pill info">Supervisors only</span><span style="flex:1"></span><button type="button" class="btn ghost small" id="qaClose" aria-label="Close" ${q.busy ? "disabled" : ""}>✕</button></div>
    ${body}</div>`;
  if ($("#qaNote", box)) $("#qaNote", box).value = note;
  box.onclick = e => { if (e.target === box && !q.busy) closeQaBox(); };
  $("#qaClose", box).onclick = closeQaBox;
  $("#qaCancel", box)?.addEventListener("click", closeQaBox);
  $("#qaDone", box)?.addEventListener("click", closeQaBox);
  $("#qaGo", box)?.addEventListener("click", qaGo);
  $("#qaRetry", box)?.addEventListener("click", qaRetry);
  $("#qaLabels", box)?.addEventListener("click", () => showLabels(q.labels));
  box.querySelectorAll("[data-qadrop]").forEach(b => b.onclick = () => {
    q.items = q.items.filter(x => x.id !== b.dataset.qadrop); qaPicks.delete(b.dataset.qadrop); qaSlots();
    if (!q.items.length) closeQaBox(); else renderQaBox();
  });
  if (!box.contains(document.activeElement)) ($("#qaGo", box) || $("#qaDone", box) || $("#qaClose", box))?.focus();
}
async function qaGo(){
  const q = qaState; if (!q || q.busy || q.done || !canApprove()) return;
  const list = q.items.filter(x => x.o && !x.why); if (!list.length) return;
  const note = val("#qaNote").slice(0, 200);
  q.busy = true; renderQaBox();
  const at = Date.now(), order = shuffled(list), n = order.length, stamp = dayStamp(at), set = `QA-${stamp}-${at.toString(36).slice(-5)}`;
  const batchKey = n > 1 ? `QC-${at.toString(36)}-${tabId.slice(0, 4)}` : "", bodies = {};
  try {
    const ids = await claimIds("QC", stamp, n, (id, i) => (bodies[id] = blindBody(order[i].o, id, at, i, n, batchKey)));
    const links = ids.map((id, i) => { const o = order[i].o; return { id, of: o.id, set, at, by: session.u, tech: session.name, test: o.test || "", ...(note ? { note } : {}), mats: keptMaterials(o).map(m => ({ item: m.item || "", loc: m.loc || "" })), cmps: [] }; });
    q.pending = await qaLink(links);
    q.done = links.map(x => ({ id: x.id, of: x.of, mats: x.mats })).sort((a, b) => a.id < b.id ? -1 : 1);
    q.labels = q.done.map(x => labelOf(bodies[x.id]));
    qaPicks.clear(); qaSlots();
  } catch (e){
    if (e && e.code === "busy") toast("Could not issue an ID. Try again in a moment."); else writeFailed(e);
  }
  q.busy = false;
  if (qaState === q) renderQaBox();
  qaSoon();
}
/* Writes the links; returns those that could not be saved, for a retry. */
async function qaLink(links){
  const left = [];
  for (const x of links){
    let ok = false;
    for (let t = 0; t < 3 && !ok; t++){ try { await db.doc("blind/" + x.id).set(x); ok = true; } catch { await sleep(300 * (t + 1)); } }
    if (!ok) left.push(x);
  }
  return left;
}
async function qaRetry(){ const q = qaState; if (!q || q.busy) return; q.busy = true; renderQaBox(); q.pending = await qaLink(q.pending); q.busy = false; renderQaBox(); }

/* ---------- comparison ---------- */
/* The original's released results beside the blind sample's: its latest certificate, or results saved but not yet released. */
function qaCompare(o, b){
  const oc = (o.certs || []).at(-1), bc = (b.certs || []).at(-1), draft = !!b.results && (!bc || b.results.at > bc.at);
  const orows = oc?.rows || {}, brows = draft ? b.results.rows || {} : bc?.rows || {};
  const an = [...(oc?.an || anOf(o))];
  for (const a of (bc?.an || anOf(b))) if (!an.some(x => x.k === a.k)) an.push(a);
  const rows = [];
  for (const a of an){
    if (a.t || a.calc) continue;
    const x = orows[a.k], y = brows[a.k]; if (!x && !y) continue;
    const va = resNum(x), vb = resNum(y), both = va != null && vb != null;
    const d = both ? vb - va : null, m = both ? (va + vb) / 2 : 0, r = both ? (m ? Math.abs(d) / m * 100 : 0) : null;
    rows.push({ k: a.k, n: a.n, u: a.u || "", dp: a.dp, a: x ? resText(x, a) : "—", b: y ? resText(y, a) : "—", d, r, v: both ? qaJudge(o, a, va, vb) : null });
  }
  return { rows, state: draft ? "draft" : bc ? "released" : "none" };
}
/* Judged like a pulp duplicate in the original's lab batch: the same tolerance, and values near the detection limit only reported. */
function qaJudge(o, a, va, vb){
  const g = groupsOf(o).find(x => x.k.includes(a.k)), p = QC_PROFILES[g?.p] || profOf(o) || {};
  const diff = Math.abs(vb - va), m = (va + vb) / 2;
  if (p.dupAbs) return diff <= p.dupAbs + 1e-9 ? { c: "ok", t: `within ${fmtNum(p.dupAbs)} ${a.u}` } : { c: "bad", t: `outside ${fmtNum(p.dupAbs)} ${a.u}` };
  if (p.dupMin && a.dl && m < p.dupMin * a.dl) return { c: "info", t: "near detection limit" };
  const tol = p.pd || 20, rel = m ? diff / m * 100 : 0;
  return rel <= tol + 1e-9 ? { c: "ok", t: `within ${tol}%` } : { c: "bad", t: `outside ${tol}%` };
}
const signed = (d, dp) => `${d >= 0 ? "+" : "−"}${dp != null ? Math.abs(d).toFixed(dp) : fmtNum(+Math.abs(d).toFixed(4))}`;
function qaTable(rows){
  return `<div class="tbl-wrap"><table class="res qa-tbl"><thead><tr><th>Analyte</th><th>Original</th><th>Blind</th><th>Diff.</th><th>Rel. diff.</th><th></th></tr></thead><tbody>
    ${rows.map(r => `<tr><td>${esc(r.n)}${r.u ? `<div class="small muted">${esc(r.u)}</div>` : ""}</td><td class="mono">${esc(r.a)}</td><td class="mono">${esc(r.b)}</td>
      <td class="mono">${r.d == null ? "—" : esc(signed(r.d, r.dp))}</td><td class="mono">${r.r == null ? "—" : esc(r.r.toFixed(1) + "%")}</td><td>${r.v ? `<span class="pill ${r.v.c}">${esc(r.v.t)}</span>` : ""}</td></tr>`).join("")}</tbody></table></div>`;
}
const QA_STATE = { none: ["warn", "Blind results not in yet"], draft: ["gold", "Blind results not yet released"], released: ["ok", "Blind results released"] };
function qaCheck(x, o, b, onBlind){
  const head = onBlind ? `Blind re-assay of <button type="button" class="linkish mono" data-open="${esc(x.of)}">${esc(x.of)}</button>`
    : `Re-assayed blind as <button type="button" class="linkish mono" data-open="${esc(x.id)}">${esc(x.id)}</button>`;
  const meta = `<div class="small muted">Issued ${fmt(x.at)} by ${esc(x.tech || "")}${x.note ? ` · ${esc(x.note)}` : ""}${!onBlind && b ? ` · ${esc(stage(b, b.stageKey)?.name || "")}` : ""}</div>`;
  if (!o || !b) return `<div class="qa-check stack" style="gap:6px"><div><b>${head}</b></div>${meta}<div class="small muted">Loading…</div></div>`;
  const cmp = qaCompare(o, b), st = QA_STATE[cmp.state], can = cmp.rows.some(r => r.d != null);
  const recs = (x.cmps || []).map(c => `<li>${fmt(c.at)} · ${esc(c.tech || "")}${c.state === "draft" ? " · before release" : ""}: ${(c.rows || []).map(r => `${esc(r.n)} ${esc(r.a)} / ${esc(r.b)}${r.u ? " " + esc(r.u) : ""}, ${esc(Number(r.r).toFixed(1))}%${r.v ? ` (${esc(r.v)})` : ""}`).join("; ")}${c.note ? ` · ${esc(c.note)}` : ""}</li>`).join("");
  return `<div class="qa-check stack" style="gap:6px">
    <div class="row" style="gap:8px"><b>${head}</b><span class="pill ${st[0]}">${st[1]}</span></div>${meta}
    ${cmp.rows.length ? qaTable(cmp.rows) : ""}
    ${recs ? `<div class="small"><b>Recorded</b><ul class="tight">${recs}</ul></div>` : ""}
    ${can ? `<div class="row"><input class="inp" id="qaNote-${esc(x.id)}" data-clear maxlength="200" placeholder="Note (optional)" style="flex:1 1 200px;width:auto"><button type="button" class="btn small" data-qarec="${esc(x.id)}">Record comparison</button></div>` : ""}
  </div>`;
}
/* On a record: shown to supervisors and admins only, on the blind sample and on its original. */
function qaPanel(s){
  if (!canApprove() || !s) return "";
  const mine = blinds.get(s.id), theirs = (blindOf.get(s.id) || []).map(id => blinds.get(id)).filter(Boolean).sort((a, b) => b.at - a.at);
  if (!mine && !theirs.length) return "";
  const parts = [];
  if (mine) parts.push(qaCheck(mine, qaDoc(mine.of), s, true));
  theirs.forEach(x => parts.push(qaCheck(x, s, qaDoc(x.id), false)));
  return `<div class="panel stack" id="qaPanel"><div class="row" style="gap:8px"><h3 style="margin:0">Blind QA/QC check</h3><span class="pill info">Supervisors only</span></div>${parts.join("")}</div>`;
}
async function qaRecord(id){
  const x = blinds.get(id); if (!x || !canApprove() || !db) return;
  const o = qaDoc(x.of), b = qaDoc(x.id);
  if (!o || !b){ toast("Still loading the results. Try again in a moment."); return; }
  const cmp = qaCompare(o, b), rows = cmp.rows.filter(r => r.d != null);
  if (!rows.length){ toast("No result to compare yet."); return; }
  const el = document.getElementById("qaNote-" + id), note = (el?.value || "").trim().slice(0, 200);
  const rec = { at: Date.now(), by: session.u, tech: session.name, state: cmp.state, rows: rows.map(r => ({ k: r.k, n: r.n, u: r.u, a: r.a, b: r.b, d: +r.d.toFixed(6), r: +r.r.toFixed(2), v: r.v?.t || "" })), ...(note ? { note } : {}) };
  const btn = document.querySelector(`[data-qarec="${CSS.escape(id)}"]`); if (btn) btn.disabled = true;
  try {
    const ref = db.doc("blind/" + id), snap = await ref.get(), cur = snap.exists ? snap.data() : x;
    await ref.update({ cmps: [...(cur.cmps || []), rec] });
    if (el){ el.value = ""; delete el.dataset.typed; }
    toast(`Comparison recorded for ${x.of} and ${id}`);
  } catch (e){ writeFailed(e); }
  if (btn) btn.disabled = false;
}

/* ---------- Storage: the blind checks issued (supervisors and admins) ---------- */
function qaListPanel(){
  if (!canApprove() || !blinds.size) return "";
  const all = [...blinds.values()].sort((a, b) => b.at - a.at || (a.id < b.id ? 1 : -1)), list = qaListAll ? all : all.slice(0, 20);
  const row = x => { const b = qaOpen(x.id), last = (x.cmps || []).at(-1), worst = last && (last.rows || []).some(r => /^outside/.test(r.v)) ? "bad" : "ok";
    return `<tr><td><button type="button" class="linkish mono" data-open="${esc(x.id)}">${esc(x.id)}</button></td><td><button type="button" class="linkish mono" data-open="${esc(x.of)}">${esc(x.of)}</button></td>
      <td style="white-space:nowrap">${fmtDate(x.at)}<div class="small muted">${esc(x.tech || "")}</div></td><td>${b ? esc(stage(b, b.stageKey)?.name || "") : "—"}</td>
      <td>${last ? `<span class="pill ${worst}">Recorded ${esc(fmtDate(last.at))}</span>` : `<span class="muted">Not recorded</span>`}</td></tr>`; };
  return `<details class="more panel" id="qaList" ${qaListOpen ? "open" : ""}><summary>Blind QA/QC checks <span class="pill">${blinds.size}</span></summary>
    <div class="tbl-wrap" style="margin-top:8px"><table class="cardy"><thead><tr><th>Blind ID</th><th>Original</th><th>Issued</th><th>Blind sample</th><th>Comparison</th></tr></thead><tbody>${list.map(row).join("")}</tbody></table></div>
    ${all.length > list.length ? `<div class="row" style="margin-top:8px"><span class="small muted">${list.length} of ${all.length}</span><button type="button" class="btn ghost small" id="qaAll">Show all</button></div>` : ""}</details>`;
}
/* The blind sample's record for the list, read only while the list is open. */
const qaOpen = id => samples.get(id) || (qaListOpen ? qaDoc(id) : qaDocs.get(id)?.d) || null;

/* ---------- Submit / Register: one sample or a batch (v20) ---------- */
/* A batch shares its details once and lists its samples, one row each (site sample code, source location). Every sample gets its own ID,
   label and tracking link; batchId (B- and the batch's first ID) ties them together and opens the whole batch from the search box. */
let bRows = [{ code: "", src: "" }, { code: "", src: "" }];
const formKind = () => document.querySelector('input[name="rKind"]:checked')?.value || "single";
function kindPicker(){
  const k = lsGet("regKind") === "batch" ? "batch" : "single";
  return `<div class="seg" role="radiogroup" aria-label="Samples"><label><input type="radio" name="rKind" value="single" ${k === "single" ? "checked" : ""}><span>Single sample</span></label><label><input type="radio" name="rKind" value="batch" ${k === "batch" ? "checked" : ""}><span>Batch</span></label></div>`;
}
function batchBlock(){
  return `<div class="full batch-box" id="rBatch" hidden>
    <div class="form">
      <label class="f"><span>Number of samples <span class="req">*</span></span><input id="rCount" type="number" min="2" max="100" step="1" value="${bRows.length}" inputmode="numeric"></label>
      <label class="f"><span>Batch name</span><input id="rBatchName" maxlength="80" placeholder="e.g. Night shift CIL survey" autocomplete="off"></label>
    </div>
    <div class="tbl-wrap"><table class="brows"><thead><tr><th>#</th><th>Site sample code</th><th>Source location</th><th></th></tr></thead><tbody id="rRows"></tbody></table></div>
    <div class="row"><button type="button" class="btn small" id="rAddRow">+ Add sample</button><span class="small" id="rRowInfo"></span></div>
  </div>`;
}
/* One code on the first row only counts up for the rest, keeping its zero padding (T-0101, T-0102, …): shown greyed in the empty rows. */
const rowCodes = () => bRows.map(r => splitTags(r.code).map(normTag));
function rowTags(){
  const c = rowCodes(), firstOnly = c[0].length === 1 && c.slice(1).every(x => !x.length);
  return firstOnly && c.length > 1 ? batchTags(c[0], c.length) : c;
}
function renderRows(){
  const body = $("#rRows"); if (!body) return;
  body.innerHTML = bRows.map((r, i) => `<tr><td class="mono muted">${i + 1}</td>
    <td><input class="inp r-code" data-i="${i}" value="${esc(r.code)}" aria-label="Site sample code, sample ${i + 1}" autocomplete="off" spellcheck="false"></td>
    <td><input class="inp r-src" data-i="${i}" value="${esc(r.src)}" aria-label="Source location, sample ${i + 1}" autocomplete="off"${i === 0 ? ' placeholder="Source location (optional)"' : ""}></td>
    <td><button type="button" class="btn ghost small" data-rdel="${i}" aria-label="Remove sample ${i + 1}" ${bRows.length <= 2 ? "disabled" : ""}>✕</button></td></tr>`).join("");
  rowHints();
}
function rowHints(){
  const tags = rowTags(), c = rowCodes(), seen = new Map(), dup = new Set();
  tags.forEach((t, i) => t.forEach(x => { if (seen.has(x)){ dup.add(i); dup.add(seen.get(x)); } else seen.set(x, i); }));
  document.querySelectorAll("#rRows .r-code").forEach(el => {
    const i = +el.dataset.i;
    el.placeholder = !c[i].length && tags[i]?.length ? tags[i].join(", ") : i === 0 ? "e.g. MILL-A-001" : "";
    el.classList.toggle("dup", dup.has(i));
  });
  const info = $("#rRowInfo");
  if (info){ const filled = tags.filter(t => t.length).length; info.textContent = dup.size ? "Same code twice" : `${bRows.length} samples${filled ? ` · ${filled} with a code` : ""}`; info.classList.toggle("bad-t", dup.size > 0); }
  submitLabel();
}
function setRowCount(n){
  n = Math.max(2, Math.min(100, Math.floor(n) || 2));
  const c = $("#rCount"); if (c && +c.value !== n && document.activeElement !== c) c.value = n;
  if (n === bRows.length && $("#rRows .r-code")) return;   // re-drawing would drop the box someone is typing in
  while (bRows.length < n) bRows.push({ code: "", src: "" });
  bRows.length = n;
  renderRows();
}
function submitLabel(){
  const b = $("#rSubmit"), f = $("#regForm"); if (!b || !f) return;
  const walk = f.dataset.mode === "register", lab = !!$("#rRecvNow")?.checked, n = formKind() === "batch" ? bRows.length : 1;
  b.textContent = lab ? (n > 1 ? `Register ${n} samples and issue IDs` : "Register and issue ID") : walk ? (n > 1 ? `Register ${n} samples` : "Register and get sample ID") : (n > 1 ? `Submit ${n} samples` : "Submit and get sample ID");
}
function showKind(v){
  const batch = formKind() === "batch";
  $("#rBatch", v).hidden = !batch;
  v.querySelectorAll("[data-single]").forEach(x => { x.hidden = batch; });
  if (batch && !$("#rRows .r-code", v)) renderRows();
  submitLabel();
}
function bindKind(v){
  bRows = [{ code: "", src: "" }, { code: "", src: "" }];
  v.querySelectorAll('input[name="rKind"]').forEach(r => r.addEventListener("change", () => { lsSet("regKind", formKind() === "batch" ? "batch" : ""); showKind(v); if (formKind() === "batch") $("#rRows .r-code", v)?.focus(); }));
  $("#rCount", v).addEventListener("input", e => { const n = +e.target.value; if (n >= 2 && n <= 100) setRowCount(n); });
  $("#rCount", v).addEventListener("change", e => { const n = Math.floor(+e.target.value); if (n > 100) toast("Up to 100 samples in one batch."); if (n >= 2) setRowCount(n); e.target.value = bRows.length; });
  $("#rAddRow", v).addEventListener("click", () => { if (bRows.length >= 100) return toast("Up to 100 samples in one batch."); setRowCount(bRows.length + 1); $("#rCount", v).value = bRows.length; $(`#rRows .r-code[data-i="${bRows.length - 1}"]`, v)?.focus(); });
  const rows = $("#rRows", v);
  rows.addEventListener("input", e => { const el = e.target, i = +el.dataset.i; if (!bRows[i]) return; bRows[i][el.classList.contains("r-code") ? "code" : "src"] = el.value; rowHints(); });
  rows.addEventListener("click", e => { const d = e.target.closest("[data-rdel]"); if (!d || bRows.length <= 2) return; bRows.splice(+d.dataset.rdel, 1); $("#rCount", v).value = bRows.length; renderRows(); });
  /* Enter moves down a row (a new row at the end) instead of sending the form. */
  rows.addEventListener("keydown", e => {
    const el = e.target; if (e.key !== "Enter" || !el.matches(".r-code,.r-src")) return;
    e.preventDefault();
    const i = +el.dataset.i, col = el.classList.contains("r-code") ? ".r-code" : ".r-src";
    if (i === bRows.length - 1){ if (bRows.length >= 100) return; setRowCount(bRows.length + 1); $("#rCount", v).value = bRows.length; }
    $(`#rRows ${col}[data-i="${i + 1}"]`, v)?.focus();
  });
  /* A column copied from a spreadsheet fills the rows from here down: code, then source location when two columns are pasted. */
  rows.addEventListener("paste", e => {
    const el = e.target; if (!el.matches(".r-code,.r-src")) return;
    const t = (e.clipboardData || window.clipboardData)?.getData("text") || "";
    if (!/[\n\t]/.test(t.trim())) return;
    e.preventDefault();
    const lines = t.replace(/\r/g, "").split("\n").filter((x, k, a) => x.trim() || k < a.length - 1).map(x => x.split("\t"));
    const start = +el.dataset.i, code = el.classList.contains("r-code");
    if (start + lines.length > 100) toast("Up to 100 samples in one batch; the rest were left out.");
    const take = lines.slice(0, 100 - start);
    if (start + take.length > bRows.length) setRowCount(start + take.length);
    take.forEach((cells, k) => { const r = bRows[start + k]; if (code){ r.code = (cells[0] || "").trim(); if (cells.length > 1) r.src = (cells[1] || "").trim(); } else r.src = (cells[0] || "").trim(); });
    $("#rCount", v).value = bRows.length; renderRows();
    $(`#rRows ${code ? ".r-code" : ".r-src"}[data-i="${start + take.length - 1}"]`, v)?.focus();
  });
  showKind(v);
}

/* ---------- a batch: every sample of one submission, from its batch reference ---------- */
async function watchBatchRef(text, seq){
  const T = normTag(text), q = db?.collection("samples").where("batchId", "==", T).limit(100);
  if (!q) return false;
  let first;
  try { first = await q.get(); } catch { return false; }
  if (seq !== openSeq || !first.docs.length) return false;
  const put = docs => { current = { id: T, batch: T, docs: docs.map(d => d.data()).filter(x => x && x.id).sort((a, b) => (a.batchIndex || 0) - (b.batchIndex || 0) || (a.id < b.id ? -1 : 1)) }; };
  put(first.docs); $("#lookupInput").value = T;
  try { history.replaceState(null, "", "#" + T.replace(/[^A-Za-z0-9._~-]/g, "")); } catch {}
  renderTrack();
  unsubCurrent = q.onSnapshot(snap => { if (seq !== openSeq || current?.batch !== T) return; put(snap.docs); if (tab === "track" && !typingIn("#view-track")) renderTrack(); }, () => {});
  return true;
}
let batchRecvBusy = false;
function renderBatchView(v){
  const c = current, docs = c.docs, s0 = docs[0] || {}, waiting = docs.filter(awaiting);
  const bst = batchState(docs), ctx = `${c.batch}|${bst.bi}.${bst.waiting ? 1 : 0}.${bst.at.some(wqOf) ? 1 : 0}`;   // v24d: what is typed stays while the batch is at the same step
  const cool = waiting.filter(s => typeOf(s.typeKey)?.cool != null), quick = waiting.filter(s => typeOf(s.typeKey)?.cool == null), two = quick.some(twoPerson);
  const tally = {}; docs.forEach(s => { const st = status(s); tally[st.label] = (tally[st.label] || 0) + 1; });
  const done = docs.filter(s => curIdx(s) >= targetIdx(s)).length, etas = docs.filter(s => curIdx(s) < targetIdx(s) && !status(s).closed).map(s => projection(s).eta).filter(Boolean);
  const eta = etas.length ? Math.max(...etas) : 0, srcCol = docs.some(s => s.source);
  noteRecentBatch(c.batch, docs); pageTitle(c.batch);
  const row = s => { const st = status(s), last = (s.certs || []).at(-1);
    return `<tr><td class="mono muted">${esc(s.batchIndex || "")}</td><td><button type="button" class="linkish mono" data-open="${esc(s.id)}">${esc(s.id)}</button></td><td class="mono">${esc(tagText(s)) || "—"}</td>${srcCol ? `<td>${esc(s.source || "")}</td>` : ""}
      <td><span class="pill ${st.cls}">${esc(st.label)}</span></td><td class="small">${last ? `Released ${esc(fmtDate(last.at))}` : ""}</td></tr>`; };
  const keepAt = $("#bvAt", v)?.value, keepWit = $("#bvWit", v)?.value, keepOk = $("#bvOk", v)?.checked;
  keepUi(v, ctx, () => {
  v.innerHTML = `<div class="stack">
    <div class="panel stack">
      <div class="row" style="gap:10px"><div class="sid">${esc(c.batch)}</div><span class="pill info">${docs.length} samples</span><button type="button" class="btn ghost small" data-link="${esc(c.batch)}">Copy batch link</button></div>
      ${s0.batchName ? `<div><b>${esc(s0.batchName)}</b></div>` : ""}
      <div class="small muted">${esc(s0.type || "")} · ${esc(s0.testName || s0.purpose || "")} · <span class="mono">${esc(s0.section || "")}</span> · ${esc(s0.submitter || "")} · ${fmt(s0.createdAt)}</div>
      <div class="bv-prog"><div class="bv-bar"><i style="width:${docs.length ? Math.round(done / docs.length * 100) : 0}%"></i></div><span class="small"><b>${done} of ${docs.length}</b> results released${eta ? ` · all expected by <b>${esc(fmt(eta))}</b>` : ""}</span></div>
      <div class="row" style="gap:6px">${Object.entries(tally).map(([l, n]) => `<span class="pill">${n} ${esc(l)}</span>`).join("")}</div>
      <div class="row"><button type="button" class="btn primary" id="bvLabels">Print ${docs.length} labels</button><button type="button" class="btn" id="bvCopy">Copy IDs</button></div>
    </div>
    ${canEdit() && quick.length ? `<div class="panel stack" id="bvRecv"><h3>Receive the batch</h3>
      <div class="form">${meBox("Received by")}
        <label class="f"><span>Date &amp; time received</span><input id="bvAt" type="datetime-local" value="${esc(keepAt || localInput(Date.now()))}"></label>
        ${two ? witnessField("bvWit") : ""}
        <label class="recv-toggle full"><input type="checkbox" id="bvOk" ${keepOk ? "checked" : ""}> All ${quick.length} bags match, seals intact, good condition</label></div>
      <div class="row"><button type="button" class="btn primary" id="bvRecvBtn" ${batchRecvBusy ? "disabled" : ""}>Confirm receipt of ${quick.length}</button>${cool.length ? `<span class="small">One by one (cooler temperature): ${cool.map(s => `<button type="button" class="linkish mono" data-open="${esc(s.id)}">${esc(s.id)}</button>`).join(", ")}</span>` : ""}</div>
    </div>` : ""}
    ${bwPanel(c)}
    <div class="panel"><div class="tbl-wrap"><table class="cardy"><thead><tr><th>#</th><th>Sample ID</th><th>Site sample code</th>${srcCol ? "<th>Source</th>" : ""}<th>Status</th><th></th></tr></thead><tbody>${docs.map(row).join("")}</tbody></table></div></div>
  </div>`;
  if (keepWit && $("#bvWit", v)) $("#bvWit", v).value = keepWit;
  fillNames(v);
  $("#bvLabels", v).onclick = () => showLabels(docs.map(labelOf));
  $("#bvCopy", v).onclick = () => navigator.clipboard.writeText(docs.map(s => s.id).join("\n")).then(() => toast("IDs copied"), () => toast("Copy blocked here. Select the IDs and copy them."));
  $("#bvRecvBtn", v)?.addEventListener("click", () => receiveBatch(quick.map(s => s.id)));
  bindBw(v);
  });
}
/* Receipt of every sample of the batch that needs no cooler check, as each record's receipt would write it. */
async function receiveBatch(sids){
  if (!canEdit() || batchRecvBusy || !current?.batch) return;
  const ref = current.batch, at = fromInput($("#bvAt")?.value), wit = $("#bvWit") ? val("#bvWit") : "";
  if (!$("#bvOk")?.checked){ toast("Tick that the bags match, seals are intact and in good condition, or receive them one by one."); $("#bvOk")?.focus(); return; }
  const docs = current.docs.filter(s => sids.includes(s.id)), err = docs.map(s => receiptTimeError(s, at)).find(Boolean);
  if (err){ toast(err); $("#bvAt")?.focus(); return; }
  if ($("#bvWit") && !wit){ toast("Two-person custody: choose the witness first."); $("#bvWit")?.focus(); return; }
  batchRecvBusy = true; $("#bvRecvBtn").disabled = true; $("#bvRecvBtn").textContent = "Receiving…";
  const ok = await receiveMany(sids, at, wit, () => `Received with batch ${ref}`);
  batchRecvBusy = false;
  toast(`${ok} of ${sids.length} received`);
  if (current?.batch === ref) renderTrack();
}

/* ---------- chain of custody: about five entries, newest first, then it scrolls like a board lane (v20) ---------- */
const HIST_ROWS = 5;
function fitHist(v, top){
  const h = $(".hist", v); if (!h) return;
  const k = h.children, last = k[HIST_ROWS - 1], many = k.length > HIST_ROWS && !!last?.offsetHeight;
  h.style.maxHeight = many ? `${last.offsetTop + last.offsetHeight + 24}px` : "";
  h.classList.toggle("scrolls", many);
  if (many && top) h.scrollTop = top;
  const end = () => h.classList.toggle("at-end", h.scrollTop + h.clientHeight >= h.scrollHeight - 2);
  h.onscroll = end; end();
}
addEventListener("resize", () => { clearTimeout(fitHist.t); fitHist.t = setTimeout(() => { if (tab === "track") fitHist($("#view-track"), $("#view-track .hist")?.scrollTop || 0); }, 150); });
