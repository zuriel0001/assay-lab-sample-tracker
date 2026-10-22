
/* ---------- v24d: a batch is processed as one ----------
   Samples submitted together (one batch reference, B-…) keep their own IDs, labels and records, but go through the workflow as one: one
   card on the board, one workflow on the batch page, one press moves them all on a step (each sample's custody line is written), one
   results file for the batch, one release with one batch certificate (one number and check code, listing every sample with its results),
   one put-away and, for a critical batch, one witness confirmation; later, one return or disposal of each material. A sample that needs
   something different is taken out of the batch (solo) and carries on by itself: by hand ("Take it out of the batch"), by a re-assay or a
   change of route. A sample rejected at receipt, stopped or closed has left the batch's workflow anyway. */
const batchOf = s => s && s.batchId && (s.batchSize || 0) > 1 && !s.solo ? s.batchId : "";
const grouped = s => !!batchOf(s) && s.open !== false && !stage(s, s.stageKey)?.final;
const nS = n => `${n} sample${n === 1 ? "" : "s"}`;
const resIn = s => !resMissing(s);
/* A sample's point (sampling point, carbon type, solution) as given at submission. */
const ptOf = s => { const f = (typeOf(s?.typeKey)?.fields || [])[0]; return f && f.o ? (s.details || {})[f.l] || "" : ""; };
const certOfBatch = (s, ref) => (s?.certs || []).filter(c => c.bref === ref).at(-1) || null;
/* The members that move together and the step they are at: the earliest step among the received ones (any ahead wait there for it). */
function batchState(docs){
  const mem = docs.filter(grouped), inLab = mem.filter(s => !awaiting(s));
  if (!inLab.length) return { mem, inLab, at: [], lead: null, bi: -1, unrecv: mem };
  const bi = Math.min(...inLab.map(curIdx)), at = inLab.filter(s => curIdx(s) === bi), lead = at[0], ti = targetIdx(lead);
  const waiting = bi === ti - 1 && at.every(waitingRes);
  return { mem, inLab, at, lead, bi, ti, plan: planOf(lead), waiting, cur: waiting ? ti : bi === ti ? ti + 1 : bi, ahead: inLab.filter(s => curIdx(s) !== bi), unrecv: mem.filter(awaiting) };
}
/* The rail of the batch: the lead sample's route up to storage; done steps with when and who, the open one with what it waits for. */
function bwRail(st, ref){
  const { plan, bi, ti, lead, at, cur } = st, now = Date.now(), cert = certOfBatch(lead, ref), q = at.map(wqOf).find(Boolean);
  return railOl(plan.slice(0, ti + 2).map((x, i) => {
    const done = i < cur || bi > ti;
    let meta = "";
    if (done){
      const e = i === ti + 1 ? (lead.history || []).filter(h => h.key === x.key).at(-1) : lastEntry(lead, x.key);
      meta = e ? `${fmt(e.at)}${e.wcf ? ` · confirmed by ${esc(e.tech)}${e.put ? `, put away by ${esc(e.put)}` : ""}` : e.tech ? ` · ${esc(e.tech)}` : ""}` : "";
      if (i === ti && cert) meta += ` · batch certificate <b class="mono">${esc(cert.no)}</b>`;
      if (i === ti + 1) meta += ` · ${nS(at.length)} kept`;
    } else if (i === cur){
      if (i === 0) meta = `Waiting for receipt: ${nS(at.length)}`;
      else if (i === ti){ const n = at.filter(resIn).length; meta = n < at.length ? `Waiting for the results: ${n} of ${at.length} in` : relNow() ? "All results in: release them below" : "All results in: waiting for a lab supervisor to release them"; }
      else if (i === ti + 1){
        const left = at.filter(s => keptMaterials(s).some(m => !m.loc)).length;
        meta = q && q.kind === "store" ? `Waiting for <b>${esc(q.wit)}</b> to confirm the storage (put away by ${esc(q.tech)})` : left ? `To put away: ${nS(left)}` : at.some(twoPerson) ? "On the shelf: a second person confirms the storage" : "";
      } else {
        const dues = at.map(stageDue).filter(Boolean), due = dues.length ? Math.min(...dues) : 0;
        meta = `${nS(at.length)} here · started ${fmt(Math.min(...at.map(s => +s.stageAt || now)))}${due ? (now > due ? ` · <b style="color:var(--bad)">over the time allowed</b>` : ` · due ${fmt(due)}`) : ""}`;
      }
    } else meta = x.phase === "store" ? (allBack(lead) ? "What is left goes back with the results" : "Each material kept for its own period after results") : `${hoursLabel(x.hours)} allowed`;
    const late = i === cur && i < ti && at.some(s => status(s).late);
    return `<li class="${done ? "done" : i === cur ? "current" + (late ? " late" : "") : "upcoming"}"><span class="dot">${done ? "✓" : ""}</span><div><div class="st-name">${esc(x.name)}</div><div class="st-meta">${meta}</div></div></li>`;
  }));
}
/* The materials of the batch, item by item over all its samples at the step: one put-away, one return or disposal for them all. A job's
   samples keep different materials (pulp, filtrate, solution, carbon), so an item is its slot and its name. */
const matKey = m => m.k + "-" + String(m.item || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
function bwMats(st){
  const items = new Map(), now = Date.now(), two = st.at.some(twoPerson), q = st.at.map(wqOf).find(Boolean);
  st.at.forEach(s => keptMaterials(s).forEach(m => {
    const key = matKey(m), x = items.get(key) || items.set(key, { k: key, item: m.item, then: m.then, dispo: m.dispo, days: m.days, n: 0, noLoc: 0, locs: new Set(), due: Infinity }).get(key);
    x.n++; if (m.loc) x.locs.add(m.loc); else x.noLoc++; if (m.dueAt) x.due = Math.min(x.due, m.dueAt);
  }));
  if (!items.size) return "";
  const edit = canEdit() && !q;
  const rows = [...items.values()].map(x => {
    const od = isFinite(x.due) && now > x.due, def = (!x.noLoc && od) || (x.noLoc && !x.days) ? x.dispo : "store";
    const where = x.noLoc ? `<span style="color:var(--warn)">Not yet put away${x.noLoc < x.n ? ` (${x.noLoc} of ${x.n})` : ""}</span>${x.locs.size ? `<div class="small">${esc([...x.locs].join("; "))}</div>` : ""}` : `Kept at <b>${esc([...x.locs].join("; "))}</b>`;
    const ctl = edit ? `<div class="row mat-row" style="gap:6px;margin-top:6px;flex-wrap:wrap">
        <select class="inp" id="bmx_${x.k}" style="flex:1 1 250px;min-width:0;width:auto">${[["store", x.noLoc ? "Put away in storage" : "Move to another location"], ["returned", "Return"], ["disposed", "Dispose"], ["external", "Send to external lab"], ["archived", "Move to long-term archive"]].map(([k, l]) => `<option value="${k}" ${k === def ? "selected" : ""}>${l}${k === x.dispo ? " (route says)" : ""}</option>`).join("")}</select>
        <input class="inp" id="bmr_${x.k}" data-clear style="flex:1 1 110px;min-width:0;width:auto" placeholder="Location or ref.">
        <button type="button" class="btn" data-bmat="${x.k}">Record for ${nS(x.n)}</button></div>` : "";
    return `<tr><td><b>${esc(x.item)}</b><div class="small muted">Then: ${esc(lcFirst(x.then))}</div></td>
      <td style="white-space:nowrap">${x.days ? fmtDate(x.due) : "At release"}${od ? (x.days ? `<div class="small" style="color:var(--bad);font-weight:600">${dur(now - x.due)} past</div>` : `<div class="small" style="color:var(--warn);font-weight:600">Due now</div>`) : ""}</td>
      <td>${where}<div class="small muted">${nS(x.n)}</div></td></tr>${ctl ? `<tr class="mat-ctl"><td colspan="3" style="border-top:0;padding-top:0">${ctl}</td></tr>` : ""}`;
  }).join("");
  return `<div class="stack" id="bmBox" style="gap:8px"><b>Retained material of the batch</b>
    ${q ? `<div class="notice small" style="margin:0">Waiting for <b>${esc(q.wit)}</b> to confirm ${q.kind === "store" ? "the storage" : "a movement"}. Nothing else is recorded on the material until then.</div>` : ""}
    ${edit && two ? `<div class="form"><div class="full">${witnessField("bmWit", "Witness (two-person custody: confirms a disposal from their own account)")}</div></div>` : ""}
    <div class="tbl-wrap"><table><thead><tr><th>Material</th><th>Kept until</th><th>Where it is</th></tr></thead><tbody>${rows}</tbody></table></div>
    ${edit && !two ? `<div id="bmWitBox" class="mat-wit" hidden>${witnessField("bmWit", "Witness to the disposal (a second person)")}</div>` : ""}</div>`;
}
/* The witness request of the batch (storage, or a disposal on a critical batch): the witness confirms it for all the samples at once. */
function bwWq(st){
  const q = st.at.map(wqOf).find(Boolean);
  if (q){
    const on = st.at.filter(s => wqOf(s)?.id === q.id), n = on.length;
    const what = q.kind === "store" ? `the storage of ${nS(n)}: ${esc(bwShelf(on))}` : `${esc(wqText(on[0], q))}, for ${nS(n)}`;
    if (session && q.witU === session.u) return `<div class="notice wq-me stack" id="bwConfBox" style="gap:8px"><div><b>Your confirmation is asked.</b> ${esc(q.tech)} asks you to witness ${what}. Asked ${fmt(q.at)}.</div>
      <div class="row" style="gap:8px"><button type="button" class="btn primary" id="bwOk">Confirm for ${nS(n)}</button><input class="inp" id="bwWhy" data-clear placeholder="Reason, to send it back (e.g. wrong shelf)" style="flex:1 1 200px;width:auto"><button type="button" class="btn" id="bwBack">Send back</button></div></div>`;
    return `<div class="notice stack" id="bwConfBox" style="gap:8px"><div><b>Waiting for ${esc(q.wit)} to confirm</b> ${what} (asked by ${esc(q.tech)}, ${fmt(q.at)}). ${esc(q.wit)} opens this batch, or any of its samples, from their own account to confirm it.</div>
      ${canEdit() && (session.u === q.by || canApprove()) ? `<div class="row"><button type="button" class="btn ghost small" id="bwDrop">Withdraw the request</button></div>` : ""}</div>`;
  }
  const crit = st.at.filter(twoPerson);
  if (canEdit() && st.bi === st.ti && crit.length && crit.every(shelvedAll)) return `<div class="notice stack" id="bwAskBox" style="gap:8px">
    <div><b>All material is on the shelf.</b> Two-person custody: a second person confirms the storage of the batch from their own account.</div>
    <div class="form">${witPick("bwWq", "Witness to confirm the storage")}</div>
    <div class="row"><button type="button" class="btn primary" id="bwAsk">Ask to confirm storage</button></div></div>`;
  return "";
}
const bwShelf = docs => [...new Set(docs.flatMap(s => keptMaterials(s).filter(m => m.loc).map(m => `${m.item} at ${m.loc}`)))].join("; ");
const idLinks = xs => xs.map(s => `<button type="button" class="linkish mono" data-open="${esc(s.id)}">${esc(s.id)}</button>`).join(", ");
/* The batch's workflow panel on the batch page. */
function bwPanel(c){
  const ref = c.batch, st = batchState(c.docs), edit = canEdit();
  const anyCert = c.docs.map(s => certOfBatch(s, ref)).filter(Boolean).sort((a, b) => (b.bv || 0) - (a.bv || 0))[0];
  const certLine = anyCert ? `<div class="row" style="gap:8px"><span class="pill ok">Released</span><b>Batch certificate ${esc(anyCert.no)}</b><span class="small muted">${fmtFull(anyCert.at)} by ${esc(anyCert.tech)}${anyCert.code ? ` · check code <span class="mono nw">${esc(anyCert.code)}</span>` : ""}</span><button type="button" class="btn small" data-bcert="${esc(ref)}">View certificate</button></div>` : "";
  // 21 Oct: released and gone (the MET Lab's remainder back with the results, or every material returned or disposed): complete, not "left"
  const gone = s => !s.solo && !grouped(s) && !!s.relAt && s.open === false && ["returned", "disposed", "closed", "external", "archived"].includes(s.stageKey);
  const solo = c.docs.filter(s => s.solo), done = c.docs.filter(gone), out = c.docs.filter(s => !s.solo && !grouped(s) && !gone(s));
  const asides = [st.lead && st.unrecv.length ? `Not received yet: ${idLinks(st.unrecv)}. They join the batch at its step once received.` : "",
    st.ahead?.length ? `Already further on, waiting for the batch: ${idLinks(st.ahead)}` : "",
    solo.length ? `Taken out of the batch, processed on their own: ${idLinks(solo)}` : "",
    out.length ? `Left the workflow (rejected, stopped or closed): ${idLinks(out)}` : ""].filter(Boolean);
  const L = st.lead || st.mem?.[0] || done[0];   // before receipt the route is the first sample's; once all are gone, a released one's
  const head = n => `<h3>Workflow for the batch${L?.routeName ? `: ${esc(routeLabel(L))}` : ""} <span class="pill">${nS(n)} together</span></h3>`;
  if (!st.lead){
    if (st.mem.length){ const lead = st.mem[0];
      return `<div class="panel stack" id="bwBox">${head(st.mem.length)}${bwRail({ plan: planOf(lead), bi: 0, ti: targetIdx(lead), lead, at: st.mem, cur: 0 }, ref)}
        <p class="small muted" style="margin:0">${canEdit() ? `Receive the batch above: one receipt for all ${nS(st.mem.length)}. ` : ""}Then they go through the workflow together: one card on the board, every step recorded here for all of them at once.</p></div>`; }
    const outs = [...new Set(done.flatMap(s => (s.materials || []).filter(m => m.status !== "kept").map(m => `${lcFirst(m.item)}: ${lcFirst(m.then || DISPO[m.status] || m.status)}`)))];
    const doneLine = done.length ? `<div class="row" style="gap:8px"><span class="pill ok">Workflow complete</span><span class="small muted">${nS(done.length)} released${outs.length ? `; ${esc(outs.join("; "))}` : ""}</span></div>` : "";
    return `<div class="panel stack" id="bwBox">${head(done.length || c.docs.length).replace(/ <span class="pill">.*?<\/span>/, "")}${certLine}${doneLine || `<p class="small muted" style="margin:0">No sample of this batch is in the lab's workflow any more.</p>`}${asides.length ? `<div class="small muted">${asides.join("<br>")}</div>` : ""}</div>`;
  }
  const { plan, bi, ti, at, waiting } = st, two = at.some(twoPerson), next = plan[bi + 1], n = at.length;
  let act = "";
  if (!edit) act = `${certLine}<p class="small muted" style="margin:0">${session ? "You can view this batch. Only lab staff can update it." : "Only lab staff update samples."}</p>`;
  else if (bi >= 1 && bi < ti){
    const missing = at.filter(s => !resIn(s)), toRel = !!next?.target, holds = [];
    const form = `<div class="form">${meBox("Recorded by")}${two ? witnessField("bwWit") : ""}
        <label class="f">Where the samples are now<input id="bwLoc" data-clear placeholder="e.g. Oven 2, Shelf B3"></label>
        <label class="f">Reference<input id="bwRef" data-clear placeholder="e.g. drying trays 12–18"></label>
        <label class="f full">Note<input id="bwNote" data-clear placeholder="Optional"></label></div>`;
    if (!toRel){
      if (next?.phase === "qc" && plan[bi].phase !== "qc") at.forEach(s => { const h = qcEntryBlock(s); if (h) holds.push(`${s.id}: ${h}`); });
      act = `${holds.length ? `<div class="notice warn" id="bwHold"><b>Before ${esc(next?.name || "the next step")}:</b> ${esc(holds.slice(0, 4).join(" "))}${holds.length > 4 ? ` +${holds.length - 4} more` : ""}</div>` : ""}
        <div class="row step-row"><button type="button" class="btn primary" id="bwNext" ${holds.length ? "disabled data-hold" : ""}>Move ${nS(n)} to: ${esc(next?.name || "")}</button></div>${form}
        ${relNow() ? `<div class="row" style="gap:8px"><span class="pill" id="bwCount">Results in: ${n - missing.length} of ${n}</span><button type="button" class="btn" data-attach="sub:${esc(ref)}">Attach results file for the batch</button>${bwGridBtn(at, ref)}</div>` : ""}`;
    } else if (missing.length && !waiting){
      act = `<div class="row step-row"><button type="button" class="btn primary" id="bwWaitBtn">Move ${nS(n)} to: Results released</button></div>${form}`;
    } else {
      if (!missing.length && !relNow()) at.forEach(s => { const h = releaseBlock(s) || (relSelf(s) ? SELF_MSG : ""); if (h) holds.push(`${s.id}: ${h}`); });
      /* v37: the release (or, still waiting, attaching the file) first */
      const count = `<div class="row step-row"><span class="pill ${missing.length ? "" : "ok"}" id="bwCount">Results in: ${n - missing.length} of ${n}</span><button type="button" class="btn${missing.length ? " primary" : ""}" data-attach="sub:${esc(ref)}">Attach results file for the batch</button>${missing.length ? bwGridBtn(at, ref) : ""}</div>`;
      act = missing.length ? `${count}<div class="notice" id="bwWait"><b>Waiting for the results of ${nS(missing.length)}${missing.length < n ? ` (${missing.slice(0, 6).map(s => s.id).join(", ")}${missing.length > 6 ? "…" : ""})` : ""}.</b> Values are read from the file by ID or site sample code; results typed on a sample's own record count too.${relNow() ? " The batch is released with one certificate when you save it." : ""}</div>`
        : `${holds.length ? `<div class="notice warn" id="bwHold"><b>Release on hold:</b> ${esc(holds.slice(0, 4).join(" "))}${holds.length > 4 ? ` +${holds.length - 4} more` : ""}</div>` : ""}
        ${canRelease() ? `<div class="row step-row"><button type="button" class="btn primary" id="bwRelease" ${holds.length ? "disabled data-hold" : ""}>Release results and issue the batch certificate</button></div>${two ? `<div class="form">${witnessField("bwRelWit", "Witness to the release (two-person custody)")}</div>` : ""}`
          : `<span class="small muted">A lab supervisor releases the results${qcStepOn() ? " after the QA/QC review" : ""}.</span>`}${count}`;
    }
  } else if (bi >= ti){
    act = `${certLine}${bi > ti ? `<div class="row" style="gap:8px"><span class="pill ok">Workflow complete</span><span class="small muted">All ${nS(n)} on the shelf. Each material is returned or disposed of below when its retention period ends.</span></div>` : ""}${bwWq(st)}${bwMats(st)}`;
  }
  return `<div class="panel stack" id="bwBox">${head(st.mem.length)}
    <div class="actions stack" id="bwAct" style="gap:10px">${act}${edit && bi >= 1 && bi < ti ? bwGrid(at, ref) : ""}</div>
    ${bwRail(st, ref)}
    ${asides.length ? `<div class="small muted">${asides.join("<br>")}</div>` : ""}</div>`;   // v37: the step's action on top, then the steps
}
let bwBusy = false;
function bindBw(v){
  $("#bwNext", v)?.addEventListener("click", () => bwMove("next"));
  $("#bwWaitBtn", v)?.addEventListener("click", () => bwMove("wait"));
  $("#bwRelease", v)?.addEventListener("click", bwRelease);
  $("#bwAsk", v)?.addEventListener("click", bwAsk);
  $("#bwOk", v)?.addEventListener("click", () => bwAnswer("ok"));
  $("#bwBack", v)?.addEventListener("click", () => bwAnswer("back"));
  $("#bwDrop", v)?.addEventListener("click", () => bwAnswer("drop"));
  v.querySelectorAll("[data-bmat]").forEach(b => b.addEventListener("click", () => bwMat(b.dataset.bmat)));
  v.querySelectorAll("[data-bcert]").forEach(b => b.addEventListener("click", () => showBatchCert(b.dataset.bcert)));
  bindBwGrid(v);
  if (bwBusy) document.querySelectorAll("#bwBox button").forEach(b => b.disabled = true);
  const wb = $("#bmWitBox", v);   // the witness to a disposal, asked for on the material being disposed
  if (wb){
    const sels = [...v.querySelectorAll('#bmBox select[id^="bmx_"]')];
    const sync = () => { const d = sels.find(x => x.value === "disposed"), td = d?.closest("td"); if (td && wb.parentNode !== td) td.appendChild(wb); wb.hidden = !td; };
    sels.forEach(x => x.addEventListener("change", sync)); syncers.push(sync); sync();
  }
}
/* One change written to each sample of the batch, each under its own lease. fn(s) builds it from the sample as it is now (null: skip). */
async function bwEach(label, ids, fn, clear){
  if (bwBusy || !canEdit() || !ids.length) return 0;
  bwBusy = true; document.querySelectorAll("#bwBox button").forEach(b => b.disabled = true);
  try {
    const ok = await pool(ids, 4, id => sampleWrite(id, fn));
    toast(ok === ids.length ? `${label}: ${nS(ok)}` : ok ? `${label}: ${ok} of ${ids.length}. The others changed meanwhile; check them below.` : `Nothing was recorded: the samples changed meanwhile. Check the batch and try again.`);
    if (ok && clear) clearForm(clear);
    return ok;
  } finally { bwBusy = false; if (current?.batch) renderTrack(); }
}
async function bwMove(kind){
  const st = batchState(current?.docs || []); if (!st.lead) return;
  const { plan, bi, at, lead } = st, next = plan[bi + 1], bref = current.batch, key = plan[bi].key;
  const wit = needWitness(at.find(twoPerson) || lead, "#bwWit"); if (wit === null) return;
  const loc = val("#bwLoc"), ref = val("#bwRef"), note = val("#bwNote");
  if (kind === "next" && (!next || next.target)) return;
  await bwEach(kind === "wait" ? "Moved to Results released" : `Moved to ${next.name}`, at.map(s => s.id), s => {
    if (!grouped(s) || s.stageKey !== key || awaiting(s)) return null;
    const t = nowAfter(s), w = twoPerson(s) ? wit : "", line = { by: session.u, tech: session.name, ref, ...(loc ? { loc } : {}), ...(w ? { wit: w } : {}) };
    if (kind === "wait"){
      if (waitingRes(s) || !resMissing(s)) return null;
      return { rw: { key: s.stageKey, at: t }, ...(loc ? { location: loc } : {}), history: [...(s.history || []), { key: s.stageKey, sn: stage(s, s.stageKey)?.name, at: t, ...line, rw: true, note: `With batch ${bref}: waiting for the results${note ? ". " + note : ""}` }] };
    }
    const to = stage(s, next.key); if (!to || (to.phase === "qc" && stage(s, s.stageKey)?.phase !== "qc" && qcEntryBlock(s))) return null;
    return { stageKey: next.key, stageAt: t, ...(loc ? { location: loc } : {}), history: [...(s.history || []), { key: next.key, sn: to.name, at: t, ...line, note: `With batch ${bref}${note ? ". " + note : ""}` }] };
  }, ["bwNote", "bwRef", "bwLoc"]);
}
/* The release of the batch: the steps each sample has left are recorded as done; every sample gets the same certificate number, time and
   check code (over all the samples' results), each keeping its own results on its record. */
function walkToRelease(s, from, wit){
  const p = planOf(s), ci = curIdx(s), ti = targetIdx(s), hist = [...(s.history || [])];
  let t = Math.max(from, ...hist.map(e => (+e.at || 0) + 1000));
  for (let i = ci + 1; i < ti; i++){ hist.push({ key: p[i].key, sn: p[i].name, at: t, by: session.u, tech: session.name, note: "Done: results saved", ...(wit && twoPerson(s) ? { wit } : {}) }); t += 1000; }
  return { history: hist, t };
}
function batchCode(ref, no, at, certs){
  const body = JSON.stringify([ref, no, at, session?.u || "", certs.map(([id, c]) => [id, (c.an || []).map(a => [a.k, a.u]), Object.keys(c.rows || {}).sort().map(k => [k, c.rows[k].raw]), c.file ? c.file.name : ""])]);
  const h = seed => { let x = seed; for (const ch of body){ x ^= ch.codePointAt(0); x = Math.imul(x, 0x01000193) >>> 0; } return x.toString(16).padStart(8, "0"); };
  return (h(0x811c9dc5) + h(0x2f6b1a3d)).toUpperCase().match(/.{4}/g).join("-");
}
async function releaseGroup(ref, wit, quiet, step){
  const none = { n: 0, no: "", why: "" }, say = why => { if (!quiet) toast(why); return { ...none, why }; };
  if (!canRelease()) return say(relNow() ? "Only lab staff release results." : "Only a lab supervisor can release results.");
  let docs;
  try { docs = (await db.collection("samples").where("batchId", "==", ref).limit(100).get()).docs.map(d => d.data()).filter(s => s && s.id); } catch { return say("Could not read the batch. Try again."); }
  const ready = docs.filter(s => grouped(s) && !awaiting(s) && curIdx(s) >= 1 && curIdx(s) < targetIdx(s));
  if (!ready.length) return none;
  const missing = ready.filter(s => !resIn(s));
  if (missing.length) return say(`Results still to come for ${nS(missing.length)}: ${missing.slice(0, 4).map(s => s.id).join(", ")}${missing.length > 4 ? "…" : ""}. Attach them, or take a sample out of the batch to release the others.`);
  if (!relNow()){ const hold = ready.map(s => [s, releaseBlock(s) || (relSelf(s) ? SELF_MSG : "")]).find(x => x[1]); if (hold) return say(`${hold[0].id}: ${hold[1]}`); }
  if (ready.some(twoPerson) && !wit) return say("Two-person custody: choose the witness to the release.");
  const v = 1 + Math.max(0, ...docs.flatMap(s => (s.certs || []).filter(c => c.bref === ref).map(c => c.bv || 0)));
  const no = `${ref}-R${v}`, from = Date.now(), at = Math.max(...ready.map(s => walkToRelease(s, from, wit).t));
  const certs = ready.map(s => [s.id, { ...makeCert(s, at, ""), no, bref: ref, bv: v, bn: ready.length }]), code = batchCode(ref, no, at, certs);
  certs.forEach(([, c]) => { c.code = code; });
  const byId = new Map(ready.map(s => [s.id, s])), cert = new Map(certs);
  const n = await pool(ready.map(s => s.id), 8, id => sampleWrite(id, s => {
    const s0 = byId.get(id);
    if (!grouped(s) || (s.results?.v || 0) !== (s0.results?.v || 0) || s.stageKey !== s0.stageKey) return null;   // changed meanwhile: not released with the others
    const w = walkToRelease(s, from, wit); if (w.t > at) return null;
    return releaseUpdate({ ...s, history: w.history }, at, `Released with batch ${ref}`, twoPerson(s) ? wit : "", "", "", cert.get(id));
  }), step);
  if (n && n < ready.length && !quiet) toast(`${n} of ${ready.length} released on ${no}; the others changed meanwhile. Open them to check.`);
  return { n, no, why: n ? "" : "the samples changed meanwhile" };
}
async function bwRelease(){
  const ref = current?.batch; if (!ref || bwBusy) return;
  const st = batchState(current.docs), wit = st.at.some(twoPerson) ? val("#bwRelWit") : "";
  if (st.at.some(twoPerson) && !wit){ toast("Two-person custody: choose the witness to the release."); $("#bwRelWit")?.focus(); return; }
  bwBusy = true; document.querySelectorAll("#bwBox button").forEach(b => b.disabled = true);
  try { const r = await releaseGroup(ref, wit); if (r.n) toast(`Released ${nS(r.n)}: batch certificate ${r.no}`); }
  finally { bwBusy = false; renderTrack(); }
}
async function bwMat(k){
  const st = batchState(current?.docs || []); if (!st.lead) return;
  const what = val("#bmx_" + k), ref = val("#bmr_" + k), bref = current.batch, ids = st.at.filter(s => keptMaterials(s).some(m => matKey(m) === k)).map(s => s.id), two = st.at.some(twoPerson);
  const slot = s => keptMaterials(s).find(m => matKey(m) === k)?.k;   // the material's own slot on each sample
  if (st.at.some(wqOf)){ toast("Waiting for the witness to confirm. Withdraw that request first."); return; }
  if (what === "store" && !ref){ toast("Type the storage location first."); $("#bmr_" + k)?.focus(); return; }
  if (what === "external" && !ref){ toast("Type the external lab and waybill number first."); $("#bmr_" + k)?.focus(); return; }
  const clear = ["bmx_" + k, "bmr_" + k, "bmWit"];
  if (two && what === "disposed"){   // a critical batch: the witness confirms the disposal from their own account
    const w = userByName(val("#bmWit"));
    if (!w){ toast("Two-person custody: choose the witness who confirms the disposal."); $("#bmWit")?.focus(); return; }
    if (w.u === session.u){ toast("The witness must be someone other than you."); return; }
    const id = wqId(Date.now());
    await bwEach(`Asked ${w.name} to confirm`, ids, s => grouped(s) && slot(s) ? askOutUpd(s, slot(s), what, ref, w, id, bref) : null, clear);
    return;
  }
  const firstPut = two && what === "store" && st.lead.stageKey === "released";
  const wit = what === "disposed" ? disposalWitness("#bmWit") : firstPut || !two ? "" : needWitness(st.lead, "#bmWit"); if (wit === null) return;
  await bwEach(what === "store" ? "Put away" : DISPO[what], ids, s => grouped(s) && !wqOf(s) && slot(s) ? matUpd(s, slot(s), what, ref, wit, bref) : null, clear);
}
async function bwAsk(){
  const st = batchState(current?.docs || []); if (!st.lead) return;
  const w = (cfg.users || []).find(x => x.u === val("#bwWq"));
  if (!w){ toast("Choose the witness who confirms the storage."); $("#bwWq")?.focus(); return; }
  const id = wqId(Date.now()), bref = current.batch;
  await bwEach(`Asked ${w.name} to confirm`, st.at.filter(twoPerson).map(s => s.id), s => grouped(s) ? askStoreUpd(s, w, id, bref) : null, ["bwWq"]);
}
async function bwAnswer(kind){
  const st = batchState(current?.docs || []); if (!st.lead) return;
  const q = st.at.map(wqOf).find(Boolean); if (!q) return;
  const why = kind === "back" ? val("#bwWhy") : "";
  if (kind === "back" && !why){ toast("Give the reason for sending it back."); $("#bwWhy")?.focus(); return; }
  const ids = st.at.filter(s => wqOf(s)?.id === q.id).map(s => s.id);
  await bwEach(kind === "ok" ? "Confirmed" : kind === "back" ? `Sent back to ${q.tech}` : "Request withdrawn", ids, s => {
    if (wqOf(s)?.id !== q.id) return null;
    return kind === "ok" ? confirmUpd(s) : kind === "back" ? sendBackUpd(s, why) : withdrawUpd(s);
  }, ["bwWhy"]);
}
/* On a member's own record: it moves with its batch; it can be taken out to go its own way. */
function batchNote(s){
  const ref = s.batchId, q = wqOf(s), rej = awaiting(s) && canEdit() && !q;
  return `<div class="notice stack" id="inBatch" style="gap:8px"><div>${esc(s.id)} is processed with batch <button type="button" class="linkish mono" data-open="${esc(ref)}">${esc(ref)}</button> (${esc(s.batchSize)} samples): it is received, moved through its steps, released and stored with the whole batch, on the batch page.${q ? ` <b>Waiting for ${esc(q.wit)} to confirm ${q.kind === "store" ? "the storage" : esc(wqText(s, q))}</b>${myConf(s) ? ": confirm it on the batch page" : ""}.` : ""}</div>
    <div class="row" style="gap:8px"><button type="button" class="btn primary" data-open="${esc(ref)}">${awaiting(s) && canEdit() ? "Receive the batch" : "Open the batch"}</button>${rej ? `<button type="button" class="btn danger" id="rejOpen" aria-expanded="false" aria-controls="rcBox">Reject this sample</button>` : ""}${canEdit() && !q ? `<button type="button" class="btn ghost" id="soloBtn">Take it out of the batch</button>` : ""}</div></div>
    ${rej ? rejectPanel("rc", { go: 'data-receipt="reject"', what: "this sample (it leaves the batch)" }) : ""}`;   // v37: one bag of a batch can be rejected at receipt
}
async function doSolo(){
  const s0 = current?.body; if (!s0 || !batchOf(s0)) return;
  if (wqOf(s0)){ toast(`Waiting for ${s0.wq.wit} to confirm. Withdraw that request on the batch page first.`); return; }
  await act(s => {
    if (!batchOf(s) || wqOf(s)) return null;
    const at = nowAfter(s);
    return { upd: { solo: true, history: [...(s.history || []), { key: s.stageKey, sn: stage(s, s.stageKey)?.name, at, by: session.u, tech: session.name, note: `Taken out of batch ${s.batchId}: processed on its own from here` }] }, msg: `${s.id} is now processed on its own` };
  }, { anyStage: true });
}
/* A sample that goes its own way (a re-assay, another route) leaves its batch: the fields, and the words for its custody line. */
const soloUpd = s => batchOf(s) ? { solo: true } : {};
const soloNote = s => batchOf(s) ? `. Taken out of batch ${s.batchId}: processed on its own from here` : "";

/* ---------- the batch certificate: one number and check code; every sample with its own results ---------- */
function certBatchHtml(ref, mem){
  const [s0, c] = mem[0], ans = [];
  const sOf = (test, a) => (RESULTS[test]?.an || []).find(y => y.k === a.k)?.s || "";   // the short name (AuFx), which a certificate does not copy
  // v24d: carbon activity's worked-out values are in its own table below (plantCert), with the comparison against fresh carbon
  const ansOf = list => { const out = []; list.forEach(([, x]) => (x.an || []).forEach(a => { if (a.t !== "pick" && !(x.test === "c_act" && CA_CALC.has(a.k)) && !out.some(y => y.k === a.k)) out.push({ ...a, s: a.s || sOf(x.test, a) }); })); return out; };
  ans.push(...ansOf(mem));   // the point is a column of its own
  const fact = (k, v) => `<tr><th>${k}</th><td>${v}</td></tr>`, uniq = f => [...new Set(mem.map(f).filter(Boolean))];
  const recv = mem.map(([s]) => s.recvAt || s.receivedAt).filter(Boolean), types = uniq(([s]) => s.type), labs = uniq(([, x]) => x.batch).join(", ");
  const dsc = mem.some(([s]) => s.source), pts = mem.some(([s]) => ptOf(s));
  // v24d: a job of several analyses reads one table per analysis (only its own columns), like the lab's report with its sections
  const tests = [...new Set(mem.map(([, x]) => x.testName || ""))], groups = tests.length > 1 ? tests.map(t => [`${t} (${nS(mem.filter(([, x]) => (x.testName || "") === t).length)})`, mem.filter(([, x]) => (x.testName || "") === t)]) : [["", mem]];
  const exc = mem.flatMap(([s, x]) => [x.amends ? `${s.id}: replaces ${x.amends}. ${x.why || ""}` : "", x.qcNote ? `${s.id}: ${x.qcNote}` : "", x.acc ? `${s.id}: accepted outside a check by ${x.acc.tech}: ${x.acc.why}` : "",
    ...(x.soft || []).map(m => `${s.id}: note: ${m}`), ...(x.alerts || []).map(a => `${s.id}: ${a.line}. ${a.act}.${a.ack ? ` Recorded by ${a.ack.tech}: ${a.ack.note}` : ""}`)].filter(Boolean));
  return `<div class="cert">
    <div class="cert-head"><div><div class="cert-org">ZIJIN · Assay Laboratory</div><h2>Certificate of analysis</h2><div class="small">Batch of ${nS(mem.length)}</div></div>
      <div class="cert-no"><div class="mono">${esc(c.no)}</div><div>Version ${esc(c.bv || 1)} · ${esc(fmtFull(c.at))}</div>${c.code ? `<div>Check code <span class="mono">${esc(c.code)}</span></div>` : ""}</div></div>
    <table class="cert-facts">
      ${fact("Batch", `<b class="mono">${esc(ref)}</b>${s0.batchName ? ` · ${esc(s0.batchName)}` : ""}`)}${fact("Samples", `${mem.length}${s0.batchSize > mem.length ? ` of the ${esc(s0.batchSize)} submitted` : ""}`)}${fact("Sample type", esc(types.join(", ")))}
      ${fact("Submitted by", `${esc(s0.submitter)}${s0.section ? ` · ${esc(s0.section)} ${esc(sectionName(s0.section))}` : ""}`)}
      ${recv.length ? fact("Received", esc(fmtFull(Math.min(...recv))) + (Math.max(...recv) - Math.min(...recv) > 60000 ? ` to ${esc(fmtFull(Math.max(...recv)))}` : "")) : ""}
      ${uniq(([, x]) => x.testName).length > 1 ? fact("Analyses", `${uniq(([, x]) => x.testName).length}, as listed for each sample`) : fact("Test", esc(c.testName || ""))}${fact("Method", `${c.route ? `<span class="mono">${esc(c.route)}</span> ` : ""}${esc(routeLabel(s0, c.routeName || ""))}`)}
      ${labs ? fact(labs.includes(",") ? "Lab batches" : "Lab batch", `<span class="mono">${esc(labs)}</span>`) : ""}
    </table>
    ${c.file ? `<div class="cert-file">Results file: <b>${esc(c.file.name)}</b>${c.att ? (ans.length ? ". Results not shown below are in this file." : ". The results are in this file.") : ""}</div>` : ""}
    ${ans.length ? groups.map(([title, list]) => { const ga = ansOf(list).filter(a => !a.opt || list.some(([, x]) => x.rows && x.rows[a.k]));
      return list.every(([, x]) => x.test === "c_act") ? certTableT(title, list, ga) : certTable(title, list, ga, dsc, pts); }).join("")
      : `<table class="cert-res"><thead><tr><th>Sample ID</th><th>Site sample code</th></tr></thead><tbody>${mem.map(([s]) => `<tr><td class="mono">${esc(s.id)}</td><td class="mono">${esc(tagText(s)) || "—"}</td></tr>`).join("")}</tbody></table>`}
    ${plantCert(mem)}
    ${exc.length ? `<div class="cert-note">${exc.map(esc).join("<br>")}</div>` : ""}
    <div class="cert-sign"><div>Released by <b>${esc(c.tech)}</b>, ${esc(ROLE_SIGN[c.role] || "lab supervisor (QA/QC)")}</div><div>${esc(fmtFull(c.at))}${TZ() ? ` (${esc(TZ())})` : ""}</div></div>
    <div class="cert-foot">Results relate only to the samples as received. Values below the detection limit are shown as &lt;DL. Check this copy by looking up the batch reference or any of its sample IDs in the Assay Lab tracker: the certificate number and check code must match. Design prototype: not an official laboratory certificate.</div>
  </div>`;
}
/* v24d: one column names the sample (ID, site sample code, description or point), so a section of several results fits the page. */
const certWho = s => { const d = s.source || ptOf(s); return `<div class="mono">${esc(s.id)}</div>${ownCode(s) ? `<div class="mono cw-code">${esc(ownCode(s))}</div>` : tagText(s) ? "" : `<div class="mono cw-code">—</div>`}${d ? `<div class="cw-desc">${esc(d)}</div>` : ""}`; };
function certTable(title, list, ans, dsc, pts){
  const sv = a => (a.t === "text" ? "cell-text" : "mono");
  return `${title ? `<h4 class="cert-sec">${esc(title)}</h4>` : ""}<div class="tbl-wrap"><table class="cert-res${ans.length > 6 ? " dense" : ""}"><thead><tr><th>Sample</th>${ans.map(a => `<th>${esc(anShort(a))}${a.u ? ` (${esc(a.u)})` : ""}</th>`).join("")}</tr></thead><tbody>
    ${list.map(([s, x]) => `<tr><td class="cell-who">${certWho(s)}</td>${ans.map(a => `<td class="${sv(a)}">${x.rows && x.rows[a.k] ? `<b>${esc(resText(x.rows[a.k], a))}</b>` : "—"}</td>`).join("")}</tr>`).join("")}
    ${ans.some(a => a.dl != null) ? `<tr class="muted"><td>Detection limit</td>${ans.map(a => `<td class="mono">${a.dl != null ? esc(fmtNum(a.dl)) : "—"}</td>`).join("")}</tr>` : ""}</tbody></table></div>`;
}
/* Carbon activity reads down the page like the lab's activity sheet: a column per carbon, a row per reading, then what is worked out. */
function certTableT(title, list, ans){
  const ca = caRows(list.map(([s, x]) => ({ s, rows: x.rows || {}, test: x.test }))), of = s => ca.find(c => c.s.id === s.id);
  const row = (label, f, cls = "mono") => `<tr><th>${label}</th>${list.map(([s, x]) => `<td class="${cls}">${f(s, x)}</td>`).join("")}</tr>`;
  const val = (x, a) => x.rows && x.rows[a.k] ? `<b>${esc(resText(x.rows[a.k], a))}</b>` : "—";
  return `${title ? `<h4 class="cert-sec">${esc(title)}</h4>` : ""}<div class="tbl-wrap"><table class="cert-res cert-t"><thead><tr><th>Carbon</th>${list.map(([s]) => `<th><span class="vz-key" style="--c:${of(s)?.color || "transparent"}"></span>${esc(ptOf(s) || "Carbon")}</th>`).join("")}</tr></thead><tbody>
    ${row("Sample", s => certWho(s), "cell-who")}
    ${ans.filter(a => !CA_CALC.has(a.k)).map(a => row(`${esc(/^ca\d+$/.test(a.k) ? `Au at ${a.k.slice(2)} min` : a.n)}${a.u ? ` (${esc(a.u)})` : ""}`, (s, x) => val(x, a))).join("")}
    ${row("Gold taken up in 60 min", s => vzPct(of(s)?.u60?.pct))}${row("Gold taken up in 120 min", s => vzPct(of(s)?.u120?.pct))}
    ${row("Gold on carbon after 60 min (g/t)", s => of(s)?.u60 ? String(Math.round(of(s).u60.gt)) : "—")}${row("Activity constant k (h⁻¹)", s => of(s)?.k != null ? `<b>${Math.round(of(s).k)}</b>` : "—")}
    ${ca.some(c => c.rel != null) ? row("Activity vs fresh carbon", s => of(s)?.rel != null ? `<b>${Math.round(of(s).rel)}%</b>${of(s).ref ? " (reference)" : ""}` : "—") : ""}</tbody></table></div>`;
}
async function showBatchCert(ref, no){
  let docs = current?.batch === ref ? current.docs : null;
  if (!docs){ try { docs = (await db.collection("samples").where("batchId", "==", ref).limit(100).get()).docs.map(d => d.data()).filter(s => s && s.id); } catch { docs = []; } }
  const all = docs.flatMap(s => (s.certs || []).filter(c => c.bref === ref).map(c => [s, c]));
  if (!all.length){ toast("No batch certificate yet."); return; }
  const pickNo = no || all.map(x => x[1]).sort((a, b) => (b.bv || 0) - (a.bv || 0))[0].no;
  const mem = all.filter(x => x[1].no === pickNo).sort((a, b) => (a[0].batchIndex || 0) - (b[0].batchIndex || 0));
  if (!mem.length || !mem.every(([s]) => canSeeResults(s))){ toast(`Batch certificate ${pickNo}: ask the Assay Lab for a copy.`); return; }
  const c = mem[0][1], html = certBatchHtml(ref, mem), box = $("#certBox");
  const others = [...new Set(all.map(x => x[1].no))].filter(x => x !== pickNo);
  box.innerHTML = `<div class="cert-wrap"><div class="cert-bar"><b>${esc(c.no)}</b>${others.length ? `<span class="small muted">Also: ${others.map(x => `<button type="button" class="linkish mono" data-bcno="${esc(x)}">${esc(x)}</button>`).join(", ")}</span>` : ""}<span style="flex:1"></span><button type="button" class="btn" id="certPrint">Print</button><button type="button" class="btn" id="certDl">Download</button><button type="button" class="btn primary" id="certClose">Close</button></div>${html}</div>`;
  box.hidden = false;
  $("#certClose").onclick = closeCert; box.onclick = e => { if (e.target === box) closeCert(); };
  box.querySelectorAll("[data-bcno]").forEach(b => b.onclick = e => { e.stopPropagation(); showBatchCert(ref, b.dataset.bcno); });
  $("#certPrint").onclick = () => { document.body.classList.add("print-cert"); try { window.print(); } catch { toast("Printing is blocked in this view. Use Download instead."); } };
  $("#certDl").onclick = async () => {
    const dl = window.claude?.use ? await claude.use("downloads") : null;
    if (!dl){ toast("Downloads are not available in this view."); return; }
    const css = [...document.querySelectorAll("style")].map(x => x.textContent).join("\n");
    try { await dl.save({ filename: `${c.no}.html`, data: `<!doctype html><html><head><meta charset="utf-8"><title>${esc(c.no)}</title><style>${css}</style></head><body class="cert-only">${html}</body></html>` }); }
    catch { toast("Download was not saved."); }
  };
  $("#certClose").focus();
}

/* ---------- the board: one card for the samples of a batch in a lane ---------- */
function laneCards(items){
  const out = [], seen = new Map();
  for (const s of items){
    const ref = batchOf(s);
    if (!ref || !grouped(s)){ out.push({ s }); continue; }
    const g = seen.get(ref); if (g){ g.docs.push(s); continue; }
    const x = { ref, docs: [s] }; seen.set(ref, x); out.push(x);
  }
  return out;
}
function batchChip(x, lane){
  const docs = x.docs, s = docs[0], late = docs.some(d => status(d).late), urgent = docs.some(d => d.priority === "Urgent");
  const tms = docs.map(cardTime), cls = ["t-late", "t-soon", "t-ok", "t-wait"].find(c => tms.some(t => t.cls === c)) || tms[0].cls || "";
  const names = [...new Set(docs.map(d => waitingRes(d) ? "Waiting for results" : awaiting(d) ? "Awaiting receipt" : stage(d, d.stageKey)?.name || ""))];
  const q = docs.map(wqOf).find(Boolean), left = tms.find(t => t.left)?.left || "";
  return `<button class="chip bchip ${cls}${late ? " late" : ""}${urgent ? " urgent" : ""}" data-open="${esc(x.ref)}" title="Batch ${esc(x.ref)}: ${docs.length} of ${esc(s.batchSize)} samples here">
    <div class="ctop"><span class="cid"><span class="cref">${esc(x.ref)}</span>${s.route ? ` <span class="rc">${esc(s.route)}</span>` : ""}</span></div>
    <div class="cmeta"><span class="bn">${docs.length === s.batchSize ? `Batch of ${nS(docs.length)}` : `${docs.length} of ${esc(s.batchSize)} samples`}</span></div>
    <div class="cmeta"><b style="color:var(--ink)">${esc(names.slice(0, 2).join(", "))}${names.length > 2 ? "…" : ""}</b>${docs.some(d => d.reassays) ? ` · <b style="color:var(--warn)">re-assay</b>` : ""}</div>
    ${q ? `<div class="cmeta"><b style="color:var(--info)">Waiting for ${esc(q.wit)} to confirm</b></div>` : ""}
    <div class="cmeta">${new Set(docs.map(d => d.typeKey)).size > 1 ? `${new Set(docs.map(d => d.typeKey)).size} sample types` : esc(s.type)}${s.batchName ? ` · ${esc(s.batchName)}` : ""}${urgent ? ` · <span class="urg">Urgent</span>` : ""}${docs.some(d => d.flag && awaiting(d)) ? ` · <b style="color:var(--warn)">Flagged</b>` : ""}</div>
    ${hazTags(s).length || twoPerson(s) ? `<div class="cmeta">${hazPills(s)}${twoPerson(s) ? `<span class="haz two" title="Two-person custody">2P</span>` : ""}</div>` : ""}
    ${lane === "report" && late ? `<div class="cmeta"><b style="color:var(--warn)">Not yet put in storage</b></div>` : ""}
    ${left && lane !== "report" ? `<div class="cmeta left">${esc(left)}</div>` : ""}</button>`;
}
/* The confirmations asked of the person signed in, one row per request (a batch's request is one row). */
function confRows(list, sRow){
  const out = [], seen = new Set();
  for (const x of list){
    const q = x.wq;
    if (q.batch){
      const key = q.batch + "|" + q.id; if (seen.has(key)) continue; seen.add(key);
      const n = list.filter(y => y.wq.batch === q.batch && y.wq.id === q.id).length;
      out.push({ id: q.batch, type: x.type || "", what: `Batch of ${nS(n)}`, where: `${q.kind === "store" ? "Storage" : DISPO[q.what] || q.what} · asked by ${q.tech}` });
      continue;
    }
    out.push(sRow(x, `${q.kind === "store" ? "Storage: " : ""}${wqText(x)} · asked by ${q.tech}`));
  }
  return out;
}

/* ---------- counting work, not bags: a batch is one item on the board, its tiles, the Today strip and the Board tab ---------- */
const unitKey = s => grouped(s) ? "B:" + s.batchId : s.id;
const unitCount = list => new Set(list.map(unitKey)).size;
/* Rows for a board list: a sample on its own, or one row for a batch (its reference, "Batch of n samples", where its samples are). */
function unitRows(list, rowOf){
  const out = [], seen = new Map();
  for (const s of list){
    if (!grouped(s)){ out.push(rowOf(s)); continue; }
    const g = seen.get(s.batchId); if (g){ g.n++; g.where.add(rowOf(s).where); continue; }
    const r = rowOf(s), x = { ...r, id: s.batchId, n: 1, where: new Set([r.where]) }; seen.set(s.batchId, x); out.push(x);
  }
  return out.map(r => r.n ? { id: r.id, type: r.type, what: `Batch of ${nS(r.n)}${r.what ? " · " + r.what : ""}`, where: [...r.where].filter(Boolean).join(", ") } : r);
}
