
/* ---------- v24d: a witness confirms from their own account (critical samples) ----------
   On a two-person custody sample (bullion, gravity concentrate, anything from the gold room or marked so) putting the retained material
   away and disposing of material are confirmed by the witness from their own account, the way a document is signed at two levels: the
   first person records it and names the witness (wq on the sample: what, who asked, who is asked, and wqU, the witness's username, to
   find it by); the witness opens the sample (its ID, a scan, or "Waiting for your confirmation" on the board) and confirms it, or sends
   it back with a reason. Until then the step stays open. The server accepts the confirmation only from the witness named, never from the
   person who asked. Other samples are not asked for this: their storage is complete once the material is on the shelf. */
const wqOf = s => s && s.wq && s.wq.id ? s.wq : null;
const shelvedAll = s => keptMaterials(s).length > 0 && keptMaterials(s).every(m => m.loc);
const myConf = s => !!wqOf(s) && !!session && s.wq.witU === session.u;
const userByName = n => (cfg.users || []).find(x => x.name === n) || null;
function wqText(s, q = wqOf(s)){
  if (!q) return "";
  if (q.kind === "store") return keptMaterials(s).map(m => `${m.item} at ${m.loc}`).join("; ");
  const m = (s.materials || []).find(x => x.k === q.k);
  return `${m ? m.item : "Material"} to be ${(DISPO[q.what] || q.what).toLowerCase()}${q.ref ? ` (${q.ref})` : ""}`;
}
/* The second person, by account (the confirmation is theirs to make): lab staff other than the person signed in. */
function witPick(id, label){
  const others = (cfg.users || []).filter(x => x.u !== session?.u && ["tech", "super", "admin"].includes(x.role));
  return `<label class="f"><span>${label} <span class="req">*</span></span><select id="${id}"><option value="">Choose the second person…</option>${others.map(x => `<option value="${esc(x.u)}">${esc(x.name)}</option>`).join("")}</select></label>`;
}
/* On the record, under the workflow: what is waiting for whom, and the buttons for the person who can act on it. */
function wqPanel(s){
  const q = wqOf(s), edit = canEdit();
  if (q){
    const what = q.kind === "store" ? `the storage: ${esc(wqText(s, q))}` : esc(wqText(s, q));
    if (myConf(s)) return `<div class="notice wq-me stack" id="wqBox" style="gap:8px">
      <div><b>Your confirmation is asked.</b> ${esc(q.tech)} asks you to witness ${what}. Asked ${fmt(q.at)}.</div>
      <div class="row" style="gap:8px"><button type="button" class="btn primary" id="wqOk">Confirm${q.kind === "store" ? " storage" : ""}</button>
        <input class="inp grow" id="wqWhy" data-clear placeholder="Reason, to send it back (e.g. wrong shelf)" style="flex:1 1 200px;width:auto">
        <button type="button" class="btn" id="wqBack">Send back</button></div></div>`;
    return `<div class="notice stack" id="wqBox" style="gap:8px"><div><b>Waiting for ${esc(q.wit)} to confirm</b> ${what} (asked by ${esc(q.tech)}, ${fmt(q.at)}). ${esc(q.wit)} opens this sample from their own account to confirm it.</div>
      ${edit && (session.u === q.by || canApprove()) ? `<div class="row"><button type="button" class="btn ghost small" id="wqDrop">Withdraw the request</button></div>` : ""}</div>`;
  }
  if (edit && twoPerson(s) && s.stageKey === "released" && shelvedAll(s)) return `<div class="notice stack" id="wqBox" style="gap:8px">
    <div><b>All material is on the shelf.</b> Two-person custody: a second person confirms the storage from their own account.</div>
    <div class="form">${witPick("wqWit", "Witness to confirm the storage")}</div>
    <div class="row"><button type="button" class="btn primary" id="wqAsk">Ask to confirm storage</button></div></div>`;
  return "";
}
function bindWq(v){
  $("#wqAsk", v)?.addEventListener("click", doAskStore);
  $("#wqOk", v)?.addEventListener("click", doConfirm);
  $("#wqBack", v)?.addEventListener("click", doSendBack);
  $("#wqDrop", v)?.addEventListener("click", doWithdraw);
}
const wqId = at => "W" + at.toString(36).toUpperCase();
/* Each change below is built for one sample: { upd, moves, msg } to write, or null when it no longer applies. The sample page writes it to the
   sample open; a batch (v24d, processed as one) writes it to each of its samples, with one request id for them all and the batch named. */
const inB = bref => bref ? `With batch ${bref}. ` : "";
function askStoreUpd(s, w, id, bref){
  if (wqOf(s) || !twoPerson(s) || s.stageKey !== "released" || !shelvedAll(s)) return null;
  const at = nowAfter(s), q = { id: id || wqId(at), kind: "store", at, by: session.u, tech: session.name, wit: w.name, witU: w.u, ...(bref ? { batch: bref } : {}) };
  return { upd: { wq: q, wqU: w.u, history: [...(s.history || []), { key: s.stageKey, sn: stage(s, s.stageKey)?.name, at, by: session.u, tech: session.name, wreq: q.id,
    note: `${inB(bref)}Put away: ${wqText(s, q)}. Asked ${w.name} to confirm` }] }, msg: `Asked ${w.name} to confirm the storage of ${s.id}` };
}
function askOutUpd(s, k, what, ref, w, id, bref){
  const m = (s.materials || []).find(x => x.k === k);
  if (wqOf(s) || !m || m.status !== "kept") return null;
  const at = nowAfter(s), q = { id: id || wqId(at), kind: "out", k, what, ref: ref || "", at, by: session.u, tech: session.name, wit: w.name, witU: w.u, ...(bref ? { batch: bref } : {}) };
  return { upd: { wq: q, wqU: w.u, history: [...(s.history || []), { key: s.stageKey, sn: stage(s, s.stageKey)?.name, at, by: session.u, tech: session.name, wreq: q.id, mat: k,
    note: `${inB(bref)}${wqText(s, q)}. Asked ${w.name} to confirm` }] }, msg: `Asked ${w.name} to confirm: ${m.item} to be ${(DISPO[what] || what).toLowerCase()}` };
}
function confirmUpd(s, say = () => {}){
  const q = wqOf(s); if (!q || q.witU !== session.u){ say("This confirmation is no longer waiting for you."); return null; }
  const at = nowAfter(s), h = s.history || [], bref = q.batch || "";
  if (q.kind === "store"){
    const upd = { wq: null, wqU: null, history: [...h, { key: "storage", sn: stage(s, "storage")?.name || "Retained in storage", at, by: session.u, tech: session.name, wcf: q.id, put: q.tech,
      note: `${inB(bref)}Storage confirmed: ${wqText(s, q)}. Put away by ${q.tech}` }] };
    if (s.stageKey === "released"){ upd.stageKey = "storage"; upd.stageAt = at; }
    return { upd, msg: `${s.id}: storage confirmed. The workflow is complete` };
  }
  const mats = clone(s.materials || []), m = mats.find(x => x.k === q.k);
  if (!m || m.status !== "kept"){ say("This material was already recorded."); return null; }
  m.outs = (m.outs || 0) + 1;
  Object.assign(m, { status: q.what, outAt: at, outBy: q.by, outTech: q.tech, outRef: q.ref || "", outMid: `${s.id}~out~${q.k}~${m.outs}` });
  const mv = { ...outMove(s, at, q.what, m.item, q.ref || "", "Confirmed by the witness", m.outMid, session.name), by: q.by, tech: q.tech };
  const upd = { materials: mats, wq: null, wqU: null };
  if (!mats.some(x => x.status === "kept")){
    const ds = new Set(mats.map(x => x.status)), fin = ds.size === 1 ? [...ds][0] : "closed";
    Object.assign(upd, { stageKey: fin, stageAt: at, open: false, onHand: false, closedAt: at });
  }
  upd.location = mats.filter(x => x.status === "kept" && x.loc).map(x => `${x.item}: ${x.loc}`).join("; ");
  const key = upd.stageKey || s.stageKey;
  upd.history = [...h, { key, sn: stage(s, key)?.name || key, at, by: session.u, tech: session.name, wcf: q.id, mat: q.k, put: q.tech, ref: q.ref || "",
    note: `${inB(bref)}${m.item}: ${(DISPO[q.what] || q.what).toLowerCase()} by ${q.tech}, confirmed by the witness` }];
  return { upd, moves: [mv], msg: upd.open === false ? `${s.id} closed: all material has left the lab` : `${m.item}: ${(DISPO[q.what] || q.what).toLowerCase()}, confirmed` };
}
function sendBackUpd(s, why){
  const q = wqOf(s); if (!q || q.witU !== session.u) return null;
  const at = nowAfter(s);
  return { upd: { wq: null, wqU: null, history: [...(s.history || []), { key: s.stageKey, sn: stage(s, s.stageKey)?.name, at, by: session.u, tech: session.name, wsb: q.id, ...(q.k ? { mat: q.k } : {}),
    note: `${inB(q.batch)}Not confirmed (${q.kind === "store" ? "storage: " : ""}${wqText(s, q)}): ${why}. Sent back to ${q.tech}` }] }, msg: `Sent back to ${q.tech}` };
}
function withdrawUpd(s){
  const q = wqOf(s); if (!q || !(session?.u === q.by || canApprove())) return null;
  const at = nowAfter(s);
  return { upd: { wq: null, wqU: null, history: [...(s.history || []), { key: s.stageKey, sn: stage(s, s.stageKey)?.name, at, by: session.u, tech: session.name, wwd: q.id,
    note: `${inB(q.batch)}Request to ${q.wit} withdrawn` }] }, msg: "Request withdrawn" };
}
async function doAskStore(){
  const s0 = current?.body; if (!s0) return;
  const w = (cfg.users || []).find(x => x.u === val("#wqWit"));
  if (!w){ toast("Choose the witness who confirms the storage."); $("#wqWit")?.focus(); return; }
  await act(s => askStoreUpd(s, w), { anyStage: true, clear: ["wqWit"] });
}
/* A disposal on a critical sample: recorded as a request; the material leaves when the witness confirms. */
async function askOut(k, what, ref, wn){
  const w = userByName(wn);
  if (!w){ toast("Two-person custody: choose the witness who confirms the disposal."); $("#mtWit")?.focus(); return; }
  if (w.u === session.u){ toast("The witness must be someone other than you."); return; }
  await act(s => askOutUpd(s, k, what, ref, w), { anyStage: true, clear: ["mx_" + k, "mr_" + k, "mtWit"] });
}
async function doConfirm(){
  const s0 = current?.body; if (!s0 || !myConf(s0)) return;
  await act(s => confirmUpd(s, toast), { anyStage: true });
}
async function doSendBack(){
  const s0 = current?.body; if (!s0 || !myConf(s0)) return;
  const why = val("#wqWhy"); if (!why){ toast("Give the reason for sending it back."); $("#wqWhy")?.focus(); return; }
  await act(s => sendBackUpd(s, why), { anyStage: true, clear: ["wqWhy"] });
}
async function doWithdraw(){
  const s0 = current?.body, q0 = wqOf(s0); if (!q0 || !(session?.u === q0.by || canApprove())) return;
  await act(withdrawUpd, { anyStage: true });
}
/* The samples waiting for the person signed in to confirm, for the board (and a note when a new one arrives). */
const confs = new Map();
let confSub = null, confU = "", confSeen = null;
function watchConf(){
  const u = db && session && canEdit() ? session.u : "";
  if (u === confU) return;
  if (confSub){ confSub(); confSub = null; }
  confU = u; confs.clear(); confSeen = null;
  if (!u) return;
  confSub = db.collection("samples").where("wqU", "==", u).limit(100).onSnapshot(snap => {
    confs.clear(); snap.docs.forEach(d => { const x = d.data(); if (x && x.id && x.wq && x.wq.witU === u) confs.set(x.id, x); });
    const ids = [...confs.values()].map(x => x.wq.id);
    if (confSeen){ const fresh = [...confs.values()].filter(x => !confSeen.has(x.wq.id)); if (fresh.length){ const q = fresh[0].wq, n = new Set(fresh.map(x => x.wq.batch ? x.wq.batch + "|" + x.wq.id : x.id)).size;
      toast(`${q.tech} asks you to confirm ${q.batch ? `batch ${q.batch} (${fresh.filter(x => x.wq.id === q.id).length} samples)` : fresh[0].id}${n > 1 ? ` and ${n - 1} more` : ""}. It is on the board under Waiting for your confirmation.`); } }
    confSeen = new Set(ids);
    if (tab === "board") rerenderSoon();
  }, () => {});
}
