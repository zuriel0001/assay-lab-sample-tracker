/* ---------- v37 (22 Oct): Accept or Reject at receipt ----------
   Zuriel: "the Technician should be able to Accept or Reject the sample ... when he/she is to rejects a sample, s/he has to put there a
   justification for it". Reject sits next to Accept on the record, on a batch member's record and on the batch page. Any number of the
   usual reasons can be ticked (or none); the justification is always typed. A rejected sample leaves the queue, shows why to everyone who
   looks it up, and goes in the ledger as received, then returned or disposed. */
const REJ_WHY = ["Bag or label damaged", "Code doesn't match", "Seal broken or missing", "Not enough sample", "Wrong type or container", "Leaking or contaminated", "Too warm or held too long", "Details missing"];
let rejShown = "";   // the record or batch whose reject panel is open: it stays open when the page is drawn again
/* The panel. p prefixes the ids (rc on a record: rcWhy, rcDisp, rcDispWit). opts.ids lists samples to tick (the batch page). */
function rejectPanel(p, opts = {}){
  const ids = opts.ids || [], key = opts.key || current?.body?.id || "";
  return `<div class="rej-box stack" id="${p}Box" ${rejShown === key ? "" : "hidden"}>
    <h4>Reject ${esc(opts.what || "the sample")}</h4>
    ${ids.length ? `<div class="f rej-f"><span>Samples <span class="req">*</span></span><div class="checks rej-ids" id="${p}Ids">${ids.length > 1 ? `<label class="rej-all"><input type="checkbox" id="${p}IAll" data-all> All ${ids.length}</label>` : ""}${ids.map((id, i) => `<label><input type="checkbox" id="${p}I${i}" value="${esc(id)}"> <span class="mono">${esc(id)}</span></label>`).join("")}</div></div>` : ""}
    <div class="f rej-f"><span>Reason</span><div class="checks rej-why" id="${p}WhyPick">${REJ_WHY.map((w, i) => `<label><input type="checkbox" id="${p}W${i}" value="${esc(w)}"> ${esc(w)}</label>`).join("")}</div></div>
    <div class="form">
      <label class="f full"><span>Justification <span class="req">*</span></span><input id="${p}Why" data-clear placeholder="What you found, e.g. bag split, about half the sample lost"></label>
      <label class="f full"><span>What happens to it</span><select id="${p}Disp"><option value="returned">Returned to the submitter</option><option value="disposed">Disposed at the lab</option>${opts.cancel ? `<option value="cancel">Nothing arrived: cancel the submission</option>` : ""}</select></label>
      <div class="full" id="${p}WitBox" hidden>${witnessField(p + "DispWit", "Witness to the disposal")}</div>
    </div>
    <div class="row"><button type="button" class="btn danger-fill" ${opts.go || `id="${p}Go"`}>${ids.length ? "Reject ticked" : "Reject sample"}</button><button type="button" class="btn ghost" data-rej-cancel>Cancel</button></div>
  </div>`;
}
function bindReject(v, p, open, fields, key = current?.body?.id || ""){
  const box = $(`#${p}Box`, v); if (!box || !open) return;
  const show = on => {
    rejShown = on ? key : ""; box.hidden = !on; open.setAttribute("aria-expanded", on ? "true" : "false"); open.classList.toggle("on", on);
    if (fields) fields.hidden = on;
    if (on){ box.scrollIntoView({ block: "nearest" }); ($(`#${p}Ids input`, box) || $(`#${p}Why`, box))?.focus({ preventScroll: true }); }
  };
  open.addEventListener("click", () => show(box.hidden));
  box.querySelector("[data-rej-cancel]").addEventListener("click", () => { show(false); open.focus(); });
  const d = $(`#${p}Disp`, box), wb = $(`#${p}WitBox`, box), go = box.querySelector(".btn.danger-fill"), ids = $(`#${p}Ids`, box);
  const sync = () => {
    wb.hidden = d.value !== "disposed";
    if (fields) fields.hidden = !box.hidden;
    open.setAttribute("aria-expanded", box.hidden ? "false" : "true"); open.classList.toggle("on", !box.hidden);
    if (ids){ const all = [...ids.querySelectorAll("input:not([data-all])")], n = all.filter(x => x.checked).length, a = ids.querySelector("[data-all]"); if (a) a.checked = n === all.length; go.textContent = n ? `Reject ${nS(n)}` : "Reject ticked"; }
  };
  d.addEventListener("change", sync);
  if (ids) ids.addEventListener("change", e => { if (e.target.dataset.all != null) ids.querySelectorAll("input:not([data-all])").forEach(x => { x.checked = e.target.checked; }); sync(); });
  syncers.push(sync); sync();
}
/* What was ticked and typed, or null (with the reason said) when something is missing. */
function rejectRead(p){
  const why = val(`#${p}Why`), picks = [...document.querySelectorAll(`#${p}WhyPick input:checked`)].map(x => x.value), disp = val(`#${p}Disp`) || "returned";
  if (!why){ toast("Type the justification for rejecting."); $(`#${p}Why`)?.focus(); return null; }
  const wit = disp === "disposed" ? disposalWitness(`#${p}DispWit`) : ""; if (wit === null) return null;
  return { why, picks, disp, wit, note: (picks.length ? picks.join("; ") + ": " : "") + why };
}
/* The update for one rejected (or, nothing having arrived, cancelled) sample: as each record's receipt would write it. */
function rejectUpd(s, rj, now = nowAfter(s)){
  const base = { by: session.u, tech: session.name, ref: "" }, h = s.history || [];
  const rej = { by: session.name, why: rj.why, ...(rj.picks.length ? { picks: rj.picks } : {}), disp: rj.disp, ...(rj.wit ? { wit: rj.wit } : {}) };
  if (rj.disp === "cancel") return { upd: { stageKey: "cancelled", stageAt: now, flag: "", open: false, onHand: false, closedAt: now, rej: { ...rej, at: now },
    history: [...h, { ...base, key: "cancelled", sn: "Submission cancelled", at: now, note: "Cancelled, nothing received: " + rj.note }] }, msg: `${s.id} cancelled` };
  const outAt = now + 1000;
  return { upd: { stageKey: "rejected", stageAt: outAt, flag: "", open: false, onHand: false, closedAt: outAt, recvAt: now, receivedBy: session.name, receivedAt: now, inMid: `${s.id}~in`, rej: { ...rej, at: outAt },
      history: [...h, { ...base, key: "received", sn: HEAD[1].name, at: now, note: "Received for inspection" }, { ...base, key: "rejected", sn: "Rejected at receipt", at: outAt, ...(rj.wit ? { wit: rj.wit } : {}), note: `Rejected and ${DISPO[rj.disp].toLowerCase()}: ${rj.note}` }] },
    moves: [inMove(s, now, null, "Received for inspection", ""), outMove(s, outAt, rj.disp, "Whole sample (rejected)", "", rj.note, `${s.id}~out~all~1`, rj.wit)], msg: `${s.id} rejected` };
}
/* On the record, for everyone who looks it up (the submitter too): rejected or cancelled, why, by whom and when. Older records have it in
   their custody line only. */
function rejNotice(s){
  if (!["rejected", "cancelled"].includes(s.stageKey)) return "";
  const r = s.rej, e = (s.history || []).filter(h => h.key === s.stageKey).at(-1); if (!r && !e) return "";
  const why = r ? (r.picks?.length ? r.picks.join("; ") + ": " : "") + r.why : String(e.note || "").replace(/^(Rejected and [^:]*|Cancelled, nothing received): /, "");
  const then = r ? (r.disp === "returned" ? "Returned to the submitter" : r.disp === "disposed" ? `Disposed at the lab${r.wit ? `, witness ${r.wit}` : ""}` : "") : "";
  return `<div class="notice bad rej-note" id="rejNote"><b>${s.stageKey === "cancelled" ? "Submission cancelled" : "Rejected at receipt"}</b> <span class="small">${esc(fmtFull(r?.at || e.at))} · ${esc(r?.by || e.tech || "")}</span>
    <div>${esc(why)}</div>${then ? `<div class="small">${esc(then)}</div>` : ""}</div>`;
}
/* The batch page: tick the samples to reject; the others are received as usual. */
async function rejectBatch(){
  if (!canEdit() || batchRecvBusy || !current?.batch) return;
  const ids = [...document.querySelectorAll("#bvrIds input:not([data-all]):checked")].map(x => x.value);
  if (!ids.length){ toast("Tick the samples to reject."); $("#bvrIds input")?.focus(); return; }
  const rj = rejectRead("bvr"); if (!rj) return;
  const ref = current.batch;
  batchRecvBusy = true; document.querySelectorAll("#bvRecv button").forEach(b => { b.disabled = true; });
  const ok = await pool(ids, 5, sid => sampleWrite(sid, s => awaiting(s) ? rejectUpd(s, rj) : null));
  batchRecvBusy = false; rejShown = "";
  toast(`${ok} of ${nS(ids.length)} ${rj.disp === "cancel" ? "cancelled" : "rejected"}`);
  if (current?.batch === ref) renderTrack();
}
/* v37 review: the header's search box selects what it holds when you go back to it, so the last ID typed is replaced, not added to */
document.addEventListener("focusin", e => { if (e.target.id === "lookupInput") setTimeout(() => { if (document.activeElement === e.target) e.target.select(); }, 0); });
