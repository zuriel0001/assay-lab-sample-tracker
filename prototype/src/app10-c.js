
/* ---------- sample record ---------- */
/* Re-draw a view without losing what someone is typing: typed values, focus, caret and open sections come back.
   Returns true when the sample moved to another stage while the person had typed something. */
let syncers = [];
function keepUi(v, ctx, build){
  const prev = v.dataset.ctx || "", [pid, pst] = prev.split("|"), [nid, nst] = ctx.split("|");
  const st = [], open = [];
  const a = document.activeElement, fid = a && v.contains(a) && a.id ? a.id : "";
  const caret = fid && typeof a.selectionStart === "number" ? [a.selectionStart, a.selectionEnd] : null;
  if (pid === nid){
    v.querySelectorAll("input[id],select[id],textarea[id]").forEach(el => { if (el.type !== "hidden") st.push([el.id, el.type === "checkbox" || el.type === "radio" ? el.checked : el.value, !!el.dataset.typed]); });
    v.querySelectorAll("details[id]").forEach(d => { if (d.open) open.push(d.id); });
  }
  const typed = st.some(x => x[2]), same = pid === nid && pst === nst;
  syncers = [];
  build();
  v.dataset.ctx = ctx;
  const restore = () => st.forEach(([id, x, t]) => {
    const el = document.getElementById(id); if (!el || !v.contains(el)) return;
    if (el.hasAttribute("data-live") ? !t : !same && (!t || el.tagName === "SELECT")) return;   // the stage changed: untouched fields and choices start again; fields showing saved values always show the latest
    if (typeof x === "boolean") el.checked = x;
    else if (el.tagName !== "SELECT" || [...el.options].some(o => o.value === x)) el.value = x;
    if (t) el.dataset.typed = "1";
  });
  restore(); syncers.forEach(f => f()); restore();
  open.forEach(id => { const d = document.getElementById(id); if (d && v.contains(d)) d.open = true; });
  if (fid){ const el = document.getElementById(fid); if (el && v.contains(el)){ el.focus({ preventScroll: true }); if (caret) try { el.setSelectionRange(...caret); } catch {} } }
  return pid === nid && !same && typed;
}
document.addEventListener("input", e => { if (e.target.id) e.target.dataset.typed = "1"; });
document.addEventListener("change", e => { if (e.target.id && e.target.tagName === "SELECT") e.target.dataset.typed = "1"; });
/* After a saved change, empty only the fields that change used (the action box, or one material row), so other typing stays. */
function clearForm(ids){
  const v = $("#view-track");
  const els = ids ? ids.map(id => document.getElementById(id)).filter(el => el && v.contains(el)) : [$("#actBox", v)].filter(Boolean);
  els.forEach(root => {
    [root, ...root.querySelectorAll("input,select,textarea,details")].forEach(el => {
      if (el.tagName === "DETAILS"){ el.open = false; return; }
      if (!/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) return;
      if (el.hasAttribute("data-clear")) el.value = "";
      delete el.dataset.typed;
    });
  });
}
function renderTrack(){
  const v = $("#view-track");
  if (!current){
    v.dataset.ctx = "";
    const staff = isStaff() && allowedTabs().includes("board"), list = [...samples.values()];
    const today = staff ? [
      ["in", "recvToday", list.filter(s => isToday(recvOf(s))).length, "Received today"],
      ["due", "dueToday", list.filter(dueToday).length, "Results due today"],
      ["late", "late", list.filter(s => { const i = curIdx(s); return i > 0 && i < targetIdx(s) && status(s).late; }).length, "Running late"],
      ["rel", "rel", releasedToday.size, "Results released today"]
    ] : [];
    v.innerHTML = `<div class="stack">
      <div class="panel hero"><h2>Find a sample</h2>
        <form id="heroForm" autocomplete="off" role="search"><input id="heroInput" placeholder="Sample ID or site code" aria-label="Sample ID or site sample code"><button class="btn primary big" type="submit">Track</button></form>
        <div class="row">
          ${!session ? `<button class="btn" data-goto="login">Staff sign in</button>` : allowedTabs().includes("board") ? `<button class="btn" data-goto="board">Open workflow board</button>` : allowedTabs().includes("results") ? `<button class="btn" data-goto="results">See your section's results</button>` : ""}
          ${session ? `<button class="btn" data-goto="submit">Submit a sample</button>` : `<button class="btn" data-goto="register">Register at lab</button>`}
        </div></div>
      ${staff ? `<div class="today-h"><h3>Today</h3><span class="small muted">${esc(fmtDate(Date.now()))}</span></div>
        <div class="today">${today.map(([c, k, n, l]) => `<button type="button" class="t-${c}" data-today="${k}"><span class="n">${n}</span><span class="l">${l}</span></button>`).join("")}</div>` : ""}
      ${recentPanel()}
    </div>`;
    $("#heroForm", v).onsubmit = e => { e.preventDefault(); openSample($("#heroInput", v).value); };
    v.querySelectorAll("[data-today]").forEach(b => b.onclick = () => { boardPick = b.dataset.today === "rel" ? "" : b.dataset.today; setTab("board"); });
    bindRecent(v); pageTitle("");
    return;
  }
  if (current.batch) return renderBatchView(v);
  if (current.matches){
    v.dataset.ctx = "";
    v.innerHTML = `<div class="panel stack"><h2>${current.matches.length} samples match “${esc(current.id)}”</h2><p class="small muted" style="margin:0">The site sample code or site reference is on more than one sample. Pick the one you want.</p>
      <div class="row">${current.matches.map(id => `<button class="btn" data-open="${esc(id)}"><span class="mono">${esc(id)}</span></button>`).join("")}</div></div>`;
    return;
  }
  if (current.loading && !current.body){ v.dataset.ctx = ""; v.innerHTML = `<div class="panel empty"><strong>Looking up ${esc(current.id)}…</strong></div>`; return; }
  if (!current.body){
    v.dataset.ctx = "";
    v.innerHTML = `<div class="panel empty"><strong>No sample found for ${esc(current.id)}</strong>
      Check the ID on the bag or submission form. IDs look like <span class="mono">${esc(exampleId())}</span>: section code, submission date, running number. Site sample codes and site references are searched too.
      ${db ? "" : "<br>The shared register is not connected in this view, so lookups cannot run."}</div>`;
    return;
  }
  const s = current.body;
  const histTop = (v.dataset.ctx || "").split("|")[0] === s.id ? $(".hist", v)?.scrollTop || 0 : 0;
  const moved = keepUi(v, `${s.id}|${s.stageKey}`, () => buildTrack(v, s));
  fitHist(v, histTop);
  noteRecent(s); pageTitle(s.id);
  if (reassayAsk && reassayAsk === s.id){
    reassayAsk = "";
    const box = $("#redoBox", v);
    if (box){ box.open = true; box.classList.add("flash"); box.scrollIntoView({ block: "center" }); $("#redoWhy", v)?.focus({ preventScroll: true }); }
    else toast(canEdit() ? `${s.id} can't be re-assayed at ${stage(s, s.stageKey)?.name || "this step"}.` : "Only lab staff send samples for re-assay.");
  }
  if (moved && !moving){
    const last = (s.history || []).slice(-1)[0];
    $("#actBox", v)?.insertAdjacentHTML("afterbegin", `<div class="notice warn" style="margin-bottom:10px">While you were filling this in, ${esc(last?.tech || "someone")} moved the sample to <b>${esc(stage(s, s.stageKey)?.name || s.stageKey)}</b>. What you typed is kept; check the step before you record.</div>`);
  }
}
function buildTrack(v, s){
  const st = status(s), proj = projection(s), now = Date.now(), plan = planOf(s), r = routeByCode(s.route);
  const tIdx = targetIdx(s), released = lastEntry(s, plan[tIdx].key), curI = stageIdx(s, s.stageKey), final = !!stage(s, s.stageKey)?.final;
  let etaHtml;
  if (st.closed) etaHtml = `<div class="lbl">Closed</div><div class="val">${esc(stage(s, s.stageKey)?.name || "")}</div><div class="small muted">${fmt(s.closedAt || s.stageAt)}</div>`;
  else if (proj.eta) etaHtml = `<div class="lbl">Results expected in</div><div class="cd">${dur(Math.max(proj.eta - now, 60000))}</div><div class="val">${fmt(proj.eta)}</div><div class="small muted">${st.late ? "Current step running late" : "Estimate"}</div>`;
  else etaHtml = `<div class="lbl">Results released</div><div class="val">${fmt(s.relAt || (released ? released.at : s.stageAt))}</div><div class="small muted">Turnaround ${dur((s.relAt || (released ? released.at : s.stageAt)) - (s.recvAt || lastEntry(s, "received")?.at || s.createdAt))}</div>`;

  // Stage rail: this sample's own route, plus the closing state if it reached one.
  const histI = (s.history || []).map(h => stageIdx(s, h.key)).filter(i => i >= 0 && i < plan.length);
  const firstI = Math.min(...histI, curI >= 0 && curI < plan.length ? curI : plan.length - 1);
  const lastI = final ? Math.max(...histI, firstI) : plan.length - 1;
  const railStages = [...plan.filter((x, i) => i >= firstI && i <= lastI), ...FINALS.filter(x => x.key === s.stageKey)];
  // Who did each step: the receiver on "Received & logged", the technician on the others, the submitter on "Submitted".
  const byOf = (x, e) => x.key === "received" ? s.receivedBy || e?.tech || "" : e?.tech || (e?.name ? `${e.name} (submitter)` : "");
  const rail = railStages.map(x => {
    const i = stageIdx(s, x.key), e = lastEntry(s, x.key), by = byOf(x, e);
    let cls = "upcoming", meta = "", note = "", mark = "";
    if (x.key === s.stageKey){
      cls = "current" + (st.late ? " late" : "");
      const due = stageDue(s);
      if (x.phase === "store"){
        const kept = keptMaterials(s), od = overdueMaterials(s), nextDue = Math.min(...kept.map(m => m.dueAt || Infinity));
        meta = `${kept.length} material${kept.length === 1 ? "" : "s"} kept` + (od.length ? ` · <b style="color:var(--bad)">${esc(od.map(m => m.item).join(", "))} past retention</b>` : isFinite(nextDue) ? ` · next due ${fmtDate(nextDue)}` : "");
      } else meta = (x.key === "received" && by ? `Received by <b>${esc(by)}</b>, ${fmt(s.receivedAt || s.stageAt)}` : `Started ${fmt(s.stageAt)}`) + (due && !x.final ? (now > due ? ` · <b style="color:var(--bad)">${dur(overBy(due, now, x))} over the ${hoursLabel(x.hours)} allowed</b>` : ` · due ${fmt(due)}`) : "");
      note = routeStageNote(s, x.key);
    } else if (i < curI){
      const sk = skipInfo(s, x.key);
      if (sk){ cls = "skipped"; mark = "–"; meta = `Skipped by ${esc(sk.tech || "a supervisor")}, ${fmt(sk.at)}: ${esc(sk.why || "")}`; }
      else if (e){ cls = "done"; mark = "✓"; meta = x.key === "received" && by ? `Received by <b>${esc(by)}</b>, ${fmt(s.receivedAt || e.at)}` : `${fmt(e.at)}${by ? ` · ${esc(by)}` : ""}`; }
      else { cls = "skipped"; mark = "–"; meta = "Not recorded"; }
    } else {
      meta = proj.out[x.key] ? `Expected ${fmt(proj.out[x.key])}` : x.phase === "store" ? `Each material kept for its own period after results` : `${hoursLabel(x.hours)} allowed`;
    }
    return `<li class="${cls}"><span class="dot">${mark}</span><div><div class="st-name">${esc(x.name)}${x.redo && s.reassays ? ` <span class="pill warn">re-assayed ×${s.reassays}</span>` : ""}</div><div class="st-meta">${meta}</div>${note ? `<div class="st-note">${esc(note)}</div>` : ""}</div></li>`;
  }).join("");

  const hist = (s.history || []).slice().reverse().map(h => `<li>
      <div>${h.redo ? `<span class="pill warn">Re-assay</span> ` : h.reroute ? `<span class="pill info">${h.testTo ? "Test changed" : "Route changed"}</span> ` : h.corr ? `<span class="pill warn">Correction</span> ` : h.skipped ? `<span class="pill warn">Skipped steps</span> ` : ""}<b>${esc(stageName(s, h))}</b>${h.ref ? ` · <span>${esc(h.ref)}</span>` : ""}${h.loc ? ` · <span>${esc(h.loc)}</span>` : ""}</div>
      <time>${fmt(h.at)} · by ${h.tech ? esc(h.tech) : h.name ? `${esc(h.name)} (submitter)` : who(h.by)}${h.wit ? `, witnessed by ${esc(h.wit)}` : ""}</time>
      ${h.note ? `<div>${esc(h.note)}</div>` : ""}${h.hand || h.badge ? `<div>Handed to <b>${esc(h.hand || "—")}</b>${h.badge ? `, badge <span class="mono">${esc(h.badge)}</span>` : ""}</div>` : ""}</li>`).join("");

  const det = s.details ? Object.entries(s.details).map(([k, val]) => `${esc(k)}: <b>${esc(val)}</b>`).join(" · ") : "";
  const rv = s.recv || null;
  const factList = [
    ["Sample type", esc(s.type)],
    ...(det ? [["Type details", det]] : []),
    ["Site sample code", tagText(s) ? `<span class="mono">${esc(tagText(s))}</span>` : "—"],
    ["Site reference", s.siteRef ? `<span class="mono">${esc(s.siteRef)}</span>` : "—"],
    ["Section", s.section ? `<span class="mono">${esc(s.section)}</span> ${esc(sectionName(s.section))}` : esc(s.department) || "—"],
    ["Submitted by", `${esc(s.submitter)}${s.subBadge ? ` · badge <span class="mono">${esc(s.subBadge)}</span>` : ""}`],
    ...(s.handedTo || s.handedBadge ? [["Handed to", `${esc(s.handedTo || "—")}${s.handedBadge ? ` · badge <span class="mono">${esc(s.handedBadge)}</span>` : ""}`]] : []),
    ["Collected", fmt(s.collectedAt)],
    [s.createdBy === "public" && s.via !== "walkin" ? "Submitted" : "Registered", `${fmt(s.createdAt)}${s.via === "walkin" ? (awaiting(s) ? " at the lab, waiting for receipt by a technician" : " at the lab (walk-in)") : s.createdBy === "public" ? " through the submission form" : ` by ${s.createdByName ? esc(s.createdByName) : who(s.createdBy)}`}`],
    ["Received by", s.receivedBy ? `${esc(s.receivedBy)} <span class="muted">(lab technician)</span>, ${fmt(s.receivedAt)}${rv?.wit ? `; witness ${esc(rv.wit)}` : ""}` : "—"],
    ...(rv ? [["Received", esc(qtyText(rv.bags, rv.mass, rv.unit) || "—") + (rv.temp !== "" && rv.temp != null ? ` · cooler ${esc(rv.temp)} °C` : "") + (rv.holdH != null ? ` · ${hoursLabel(rv.holdH)} after collection` : "")],
      ["Receipt checks", rv.warn && rv.warn.length ? `<span style="color:var(--warn)">${rv.warn.map(esc).join("; ")}</span>` : `Seal ${rv.seal === "none" ? "not used" : "intact"}, condition ${esc(lcFirst(rv.cond || "good"))}`]] : []),
    ["Assay purpose", esc(s.purpose)],
    ["Test requested", esc(s.testName || testOf(s.test)?.name || "") || "—"],
    ["Workflow route", s.route ? `<span class="code">${esc(s.route)}</span> ${esc(s.routeName || r?.name || "")} <button class="btn ghost small" data-route="${esc(s.route)}">See route</button>` : "Standard workflow (registered before routes were added)"],
    ["Add-on analyses", (s.analyses || []).map(esc).join(", ") || "—"],
    ["Hazards", hazTags(s).length ? hazTags(s).map(h => esc(h.l)).join(", ") : "None declared"],
    ...(twoPerson(s) ? [["Custody", "Two-person custody: every step needs a witness"]] : []),
    ...(s.reassays ? [["Re-assays", `${s.reassays}${s.lastRedo ? `, last: ${esc(s.lastRedo)}` : ""}`]] : []),
    ["Source location", esc(s.source) || "—"],
    ["Quantity submitted", esc(qtyText(s.containers, s.massKg, "kg")) || "—"],
    ["Seal / custody no.", s.seal ? `<span class="mono">${esc(s.seal)}</span>` : "—"],
    ["Priority", s.priority === "Urgent" ? `<span class="pill gold">Urgent</span>` : "Routine"],
    ["Location", esc(s.location) || "—"],
    ["Batch", s.batchId ? `<button type="button" class="linkish mono" data-open="${esc(s.batchId)}">${esc(s.batchId)}</button>${s.batchSize > 1 ? ` (${s.batchIndex} of ${s.batchSize})` : ""}${s.batchName ? ` · ${esc(s.batchName)}` : ""}` : "—"],
    ["Notes", esc(s.notes) || "—"]
  ];
  const blank = ([, val]) => val === "—" || val === "", row = ([k, val]) => `<dt>${k}</dt><dd>${val}</dd>`;
  const facts = factList.filter(f => !blank(f)).map(row).join(""), factsMore = factList.filter(blank).map(row).join("");
  // Progress along the route up to the release of results, in the same colours as the board.
  const tone = !st.closed && !st.post ? { "t-ok": "ok", "t-soon": "warn", "t-late": "bad", "t-wait": "info" }[cardTime(s).cls] || st.cls : st.cls;
  const stepNo = Math.min(Math.max(curI, 0), tIdx) + 1, pct = curI >= tIdx ? 100 : Math.round(Math.max(curI, 0) / tIdx * 100);
  const prog = st.closed ? "" : `<div class="prog${st.late && !st.post ? " late" : awaiting(s) ? " wait" : ""}"><div class="prog-t"><span>${curI >= tIdx ? "<b>Results released</b>" : `Step <b>${stepNo}</b> of ${tIdx + 1}`}</span><span>${curI < tIdx && cardTime(s).left ? esc(cardTime(s).left) + " on this step" : ""}</span></div><div class="prog-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div></div>`;

  const ret = s.retention || r?.retention || [], qcText = s.qc || r?.qc || "", trig = s.triggers || r?.triggers || [];
  const qcBlock = qcText || trig.length || ret.length ? `<details class="more" id="qcBox"><summary>Quality control, re-assay triggers and retention</summary><div class="stack" style="gap:8px;margin-top:8px">
      ${qcText ? `<div class="small"><b>QA/QC:</b> ${esc(qcText)}</div>` : ""}
      ${trig.length ? `<div class="small"><b>Re-assay when</b><ul class="tight">${trig.map(t => `<li>${esc(t)}</li>`).join("")}</ul></div>` : ""}
      ${ret.length ? `<div class="small"><b>Retention and disposal</b>${s.relAt ? "" : " (each period starts when results are released)"}<ul class="tight">${ret.map(x => `<li>${esc(retentionLine(x))}</li>`).join("")}</ul></div>` : ""}
    </div></details>` : "";

  const ci = curIdx(s);
  let actions;
  if (!canEdit()) actions = `<p class="small muted" style="margin:0">${session ? "You can view this sample. Only lab staff can update it." : "Only lab staff update samples. <button class='btn ghost small' data-goto='login'>Staff sign in</button>"}</p>`;
  else if (awaiting(s)) actions = receiptForm(s);
  else if (st.closed) actions = `<p class="small muted" style="margin:0">This sample is closed${s.closedAt ? ` (${fmtFull(s.closedAt)})` : ""}.${(s.materials || []).length ? " A lab supervisor can reverse a material movement recorded by mistake, under Retained material." : ""}</p>`;
  else if (ci >= 0 && ci < tIdx) actions = moveForm(s);
  else actions = releasedForm(s);

  v.innerHTML = `<div class="stack">
    <div class="panel">
      <div class="card-head">
        <div class="stack" style="gap:8px;flex:1 1 300px;min-width:0">
          <div class="row"><div class="sid">${esc(s.id)}</div><button class="btn ghost small" data-link="${esc(s.id)}">Copy tracking link</button><button class="btn ghost small" data-label="${esc(s.id)}">Print label</button></div>
          <div class="row"><span class="pill ${tone}">${esc(st.label)}</span>${s.priority === "Urgent" ? `<span class="pill gold">Urgent</span>` : ""}${s.route ? `<span class="code">${esc(s.route)}</span>` : ""}${hazPills(s)}${twoPerson(s) ? `<span class="pill warn">Two-person custody</span>` : ""}<span class="muted small">${esc(s.type)} · ${esc(s.testName || s.purpose)}</span></div>
          ${prog}
        </div>
        <div class="eta${st.late && !st.post && !st.closed ? " late" : !proj.eta && !st.closed ? " done" : ""}">${etaHtml}</div>
      </div>
    </div>
    ${s.flag && awaiting(s) ? `<div class="notice warn"><b>Flagged at receipt:</b> ${esc(s.flag)}</div>` : ""}
    ${(s.ledgerPending || []).length ? `<div class="notice warn">A ledger entry for this sample is still being saved. It is retried automatically.</div>` : ""}
    <div class="grid2">
      <div class="panel stack"><h3>Workflow${s.routeName ? `: ${esc(s.routeName)}` : ""}</h3><ol class="rail">${rail}</ol>
        ${qcBlock}
        <div class="actions" id="actBox">${actions}</div></div>
      <div class="stack">
        ${resultsPanel(s)}
        ${qaPanel(s)}
        ${(s.materials || []).length ? materialsPanel(s) : ""}
        <div class="panel stack"><h3>Sample details</h3><dl class="facts">${facts}</dl>${factsMore ? `<details class="facts-more"><summary>Show all details</summary><dl class="facts">${factsMore}</dl></details>` : ""}</div>
        <div class="panel stack"><h3>Chain of custody${(s.history || []).length > 5 ? ` <span class="pill">${(s.history || []).length}</span>` : ""}</h3><ul class="hist">${hist || "<li class='muted'>No movements recorded.</li>"}</ul></div>
      </div>
    </div></div>`;
  fillNames(v);
  bindTrack(v, s);
}
function witnessField(id){
  const others = (cfg.users || []).filter(x => x.u !== session?.u && x.role !== "viewer");
  return `<label class="f"><span>Witness (two-person custody) <span class="req">*</span></span><select id="${id}"><option value="">Choose the second person…</option>${others.map(x => `<option value="${esc(x.name)}">${esc(x.name)}</option>`).join("")}</select></label>`;
}
const meBox = label => `<label class="f"><span>${label}</span><div class="me-box">${esc(session.name)} <span class="muted small" style="font-weight:400">(you)</span></div></label>`;
function testOptions(typeKey, sel = ""){
  const t = typeOf(typeKey), rec = (t?.tests || []).map(testOf).filter(Boolean);
  const opt = x => `<option value="${esc(x.key)}" ${x.key === sel ? "selected" : ""}>${esc(x.name)}</option>`;
  const head = rec.length ? `<optgroup label="Recommended for ${esc(t.name)}">${rec.map(opt).join("")}</optgroup>` : `<option value="">Choose the sample type first…</option>`;
  return head + TEST_CATS.map(c => { const xs = TESTS.filter(x => x.cat === c && !rec.includes(x)); return xs.length ? `<optgroup label="${esc(c)}">${xs.map(opt).join("")}</optgroup>` : ""; }).join("");
}
/* Route choices always follow the test: only routes that perform it are offered. */
function syncRoutes(testSel, routeSel, s, infoEl){
  const test = testSel.value, list = routesForTest(test), keep = routeSel.value;
  const pick = list.some(r => r.code === keep) ? keep : list.some(r => r.code === s.route) ? s.route : routeFor(s.typeKey, test, s.purposeKey)?.code || "";
  routeSel.innerHTML = list.length ? routeOptions(pick, list) : `<option value="">No route performs this test</option>`;
  if (infoEl){
    const r = routeByCode(routeSel.value);
    infoEl.textContent = (test !== s.test ? `Test changes from “${s.testName || testOf(s.test)?.name || s.test}” to “${testOf(test)?.name || test}”: give the reason in the note. ` : "") + routeLine(r);
  }
}
function receiptForm(s){
  const t = typeOf(s.typeKey), unit = massUnit(s);
  return `<div class="stack" id="moveForm" style="gap:10px">
    <p class="small" style="margin:0">Check the bag against the submission: ${tagText(s) ? `site sample code <b class="mono">${esc(tagText(s))}</b>, ` : ""}${esc(s.type)}, ${esc(bagsText(s.containers || 1))}${s.massKg ? `, ${esc(s.massKg)} kg` : ""}${s.seal ? `, seal <span class="mono">${esc(s.seal)}</span>` : ""}.</p>
    ${t?.check ? `<p class="small" style="margin:0"><b>Also check:</b> ${esc(t.check)}</p>` : ""}
    ${s.handedTo || s.handedBadge ? `<div class="small"><b>Handed to:</b> ${esc(s.handedTo || "—")}${s.handedBadge ? `, badge <span class="mono">${esc(s.handedBadge)}</span>` : ""}</div>` : ""}
    ${hazTags(s).length ? `<p class="small" style="margin:0"><b>Hazards declared:</b> ${hazTags(s).map(h => esc(h.l)).join(", ")}. Handle with the matching PPE.</p>` : ""}
    <div class="form">
      ${meBox("Received by")}
      <label class="f"><span>Date &amp; time received</span><input id="rcAt" type="datetime-local" value="${localInput(Date.now())}"></label>
      <label class="f"><span>Bags / containers received</span><input id="rcBags" type="number" min="0" step="1" value="${esc(s.containers || 1)}"></label>
      <label class="f"><span>Mass received (${unit})</span><input id="rcMass" type="number" min="0" step="any" placeholder="Weigh on arrival"></label>
      <label class="f"><span>Seal check</span><select id="rcSeal">${s.seal ? `<option value="ok">Seal intact, number matches</option><option value="bad">Seal number does not match</option><option value="broken">Seal broken or missing</option>` : `<option value="none">No seal on the submission</option><option value="ok">Sealed (note the number)</option><option value="broken">Seal broken</option>`}</select></label>
      <label class="f"><span>Condition</span><select id="rcCond">${CONDITIONS.map(c => `<option>${esc(c)}</option>`).join("")}</select></label>
      ${t?.cool != null ? `<label class="f"><span>Cooler temperature on arrival (°C) <span class="req">*</span></span><input id="rcTemp" type="number" step="0.1" placeholder="Limit ${t.cool} °C"></label>` : ""}
      ${twoPerson(s) ? witnessField("rcWit") : ""}
      <label class="f"><span>Test requested</span><select id="rcTest">${testOptions(s.typeKey, s.test)}</select></label>
      <label class="f"><span>Workflow route</span><select id="rcRoute"></select></label>
      <div class="full small" id="rcInfo"></div>
      <label class="f full"><span>Note <span style="font-weight:400">(needed to flag or reject, when the test changes, or when a receipt check fails)</span></span><input id="mvNote" data-clear placeholder="e.g. Bag code reads T-10422, not T-10421; bag torn"></label>
    </div>
    <div class="row">
      <button type="button" class="btn primary" data-receipt="confirm">Confirm receipt</button>
      <button type="button" class="btn" data-receipt="flag">Flag a problem</button>
      ${s.batchId && s.batchSize > 1 ? `<button type="button" class="btn ghost" data-open="${esc(s.batchId)}">Receive the whole batch (${esc(s.batchSize)})</button>` : ""}
    </div>
    <details class="more" id="rejBox"><summary>Reject the sample</summary>
      <div class="stack" style="gap:8px;margin-top:8px">
        <label class="f">What happens to it<select class="inp" id="rcDisp"><option value="returned">Returned to the submitter</option><option value="disposed">Disposed at the lab</option><option value="cancel">Nothing arrived: cancel the submission</option></select></label>
        <p class="small muted" style="margin:0">Returned or disposed material goes in the ledger as received, then sent out, so the counts balance. Put the reason in the note above.</p>
        <div class="row"><button type="button" class="btn danger" data-receipt="reject">Reject sample</button></div></div></details>
  </div>`;
}
function receiptChecks(s){
  const t = typeOf(s.typeKey), at = fromInput($("#rcAt")?.value), warn = [];
  const bags = +($("#rcBags")?.value || 0), mass = $("#rcMass")?.value || "", seal = val("#rcSeal"), cond = val("#rcCond") || "Good", temp = $("#rcTemp") ? $("#rcTemp").value : "";
  if (s.containers && $("#rcBags")?.value !== "" && bags !== +s.containers) warn.push(`${bagsText(bags)} received, ${s.containers} submitted`);
  if (seal === "bad") warn.push("seal number does not match the submission");
  if (seal === "broken") warn.push("seal broken or missing");
  if (cond !== "Good") warn.push(`condition: ${lcFirst(cond)}`);
  if (t?.cool != null && temp !== "" && +temp > t.cool) warn.push(`cooler at ${temp} °C, above the ${t.cool} °C limit`);
  let holdH = null;
  if (t?.hold && s.collectedAt && at > 0){ holdH = Math.max(0, (at - s.collectedAt) / HOUR); if (holdH > t.hold) warn.push(`holding time for ${t.holdWhat} exceeded: received ${hoursLabel(holdH)} after collection, limit ${hoursLabel(t.hold)}`); }
  return { at, bags, mass: mass === "" ? null : +mass, unit: massUnit(s), seal, cond, temp, holdH, warn };
}
function receiptTimeError(s, at){
  if (!(at > 0)) return "Enter the date and time received.";
  if (at > Date.now() + 5 * 60000) return "The time received can't be in the future.";
  if (s.createdAt && at < s.createdAt - 60000) return `The time received can't be before the submission (${fmtFull(s.createdAt)}).`;
  if (s.collectedAt && at < s.collectedAt) return `The time received can't be before the collection time (${fmtFull(s.collectedAt)}).`;
  return "";
}
/* A sample can go back for re-assay once it has been assayed: in analysis or QA/QC, once released, and from storage while material is kept. */
const redoOk = s => { if (!s || awaiting(s) || s.open === false || stage(s, s.stageKey)?.final) return false; const ri = redoIdx(s), ci = curIdx(s), ti = targetIdx(s); return ri >= 0 && ci > ri && (ci <= ti || keptMaterials(s).length > 0); };
function redoBox(s){
  const p = planOf(s), ri = redoIdx(s), r = routeByCode(s.route);
  const reasons = [...new Set([...(s.triggers || r?.triggers || []), "CRM outside limits", "Blank above limit", "Duplicate or replicate out of tolerance", "Client query on the result", "Other (see note)"])];
  return `<details class="more" id="redoBox"><summary>QC failed or a result needs repeating?</summary>
      <div class="stack" style="gap:8px;margin-top:8px">
        <p class="small muted" style="margin:0">Sends the sample back to <b>${esc(p[ri].name)}</b> and moves the expected finish out. The note is saved with it.${curIdx(s) >= targetIdx(s) ? " Results already released stay on record; the repeat is reported as an amendment." : ""}</p>
        <label class="f">Reason<select class="inp" id="redoWhy">${reasons.map(x => `<option>${esc(x)}</option>`).join("")}</select></label>
        <div class="row"><button type="button" class="btn" id="redoBtn">Send back for re-assay</button></div></div></details>`;
}
function moveForm(s){
  const p = planOf(s), ci = curIdx(s), ti = targetIdx(s), ri = redoIdx(s), next = p[ci + 1] || null;
  const canRedo = ri >= 0 && ci > ri && ci <= ti;
  const back = p.map((x, j) => [x, j]).filter(([, j]) => j >= 1 && j < ci);
  const ahead = canApprove() ? p.map((x, j) => [x, j]).filter(([, j]) => j > ci + 1 && j < ti && !blockedBy(s, j)) : [];
  const release = next && next.target;
  const self = release && canApprove() ? selfCheck(s) : "";
  const hold = release ? releaseBlock(s) || (self === "blocked" ? SELF_MSG : "") : next && next.phase === "qc" && p[ci].phase !== "qc" ? qcEntryBlock(s) : "";
  return `<div id="moveForm" class="stack" style="gap:10px">
    ${hold ? `<div class="notice warn" id="holdNote"><b>${release ? "Release on hold" : "Before QA/QC review"}:</b> ${esc(hold)}</div>` : ""}
    <div class="form">
      ${meBox("Recorded by")}
      ${twoPerson(s) ? witnessField("mvWit") : ""}
      <label class="f">Where the sample is now<input id="mvLoc" data-clear placeholder="e.g. Oven 2, Shelf B3"></label>
      <label class="f">Reference<input id="mvRef" data-clear placeholder="e.g. drying tray 12"></label>
      <label class="f full">Note<input id="mvNote" data-clear placeholder="Optional"></label>
      ${self === "admin" && !hold ? `<label class="f full"><span>You entered results on this sample: reason for releasing them yourself (printed on the certificate) <span class="req">*</span></span><input id="selfWhy" data-clear></label>` : ""}
    </div>
    <div class="row">
      ${release ? (canApprove() ? `<button type="button" class="btn primary" data-step="next" ${hold ? "disabled data-hold" : ""}>Release results and issue certificate</button>` : `<span class="small muted">A lab supervisor releases the results${qcStepOn() ? " after the QA/QC review" : ""}.</span>`)
        : next ? `<button type="button" class="btn primary" data-step="next" ${hold ? "disabled data-hold" : ""}>Move to: ${esc(next.name)}</button>` : ""}
      <button type="button" class="btn" data-step="note">Save note only</button>
    </div>
    ${back.length || ahead.length ? `<details class="more" id="corrBox"><summary>Correct the stage or skip a step</summary>
      <div class="stack" style="gap:8px;margin-top:8px">
        <label class="f">Move to<select class="inp" id="mvKey">${back.map(([x]) => `<option value="${esc(x.key)}">Back to ${esc(x.name)} (correction)</option>`).join("")}${ahead.map(([x]) => `<option value="${esc(x.key)}">Skip ahead to ${esc(x.name)}</option>`).join("")}</select></label>
        <label class="f">Reason (required)<input id="corrWhy" data-clear placeholder="e.g. Recorded against the wrong sample"></label>
        <p class="small muted" style="margin:0">A correction never adds a ledger movement. ${canApprove() ? "Skipped steps stay on the record as skipped, with the reason. A skip can't reach or pass QA/QC or the release of results." : "Only a lab supervisor can skip steps."}</p>
        <div class="row"><button type="button" class="btn" id="corrBtn">Record correction</button></div></div></details>` : ""}
    ${canRedo ? redoBox(s) : ""}
    ${ci >= 1 ? `<details class="more" id="rrBox"><summary>Change the test or workflow route</summary>
      <div class="stack" style="gap:8px;margin-top:8px">
        <div class="form"><label class="f">Test<select class="inp" id="rrTest">${testOptions(s.typeKey, s.test)}</select></label><label class="f">Route<select class="inp" id="rrCode"></select></label></div>
        <p class="small muted" id="rrInfo" style="margin:0"></p>
        <p class="small muted" style="margin:0">Only routes that perform the chosen test are listed. Steps already done stay in the chain of custody; the sample carries on from the same step in the new route if it has one.</p>
        <div class="row"><button type="button" class="btn" id="rerouteBtn">Change route</button></div></div></details>
    <details class="more" id="cxBox"><summary>Stop testing and send the sample out</summary>
      <div class="stack" style="gap:8px;margin-top:8px">
        <label class="f">What happens to the sample<select class="inp" id="cxDisp"><option value="returned">Returned to the submitter</option><option value="disposed">Disposed at the lab</option><option value="external">Sent to an external lab</option></select></label>
        <label class="f">Reason (required)<input id="cxWhy" data-clear placeholder="e.g. Submitter withdrew the request"></label>
        <p class="small muted" style="margin:0">Writes an outbound ledger movement and closes the sample.</p>
        <div class="row"><button type="button" class="btn danger" id="cxBtn">Stop testing</button></div></div></details>` : ""}
  </div>`;
}
function releasedForm(s){
  return `<div id="moveForm" class="stack" style="gap:10px">
    <p class="small" style="margin:0">Results released ${fmt(s.relAt || lastEntry(s, "released")?.at)}. Put the retained material away and record returns or disposal under <b>Retained material</b>; each material has its own retention date.</p>
    <div class="form">${meBox("Recorded by")}${twoPerson(s) ? witnessField("mvWit") : ""}<label class="f full">Note<input id="mvNote" data-clear placeholder="e.g. Client asked for a copy of the certificate"></label></div>
    <div class="row"><button type="button" class="btn" data-step="note">Save note only</button></div>
    ${redoOk(s) ? redoBox(s) : ""}
  </div>`;
}
function materialsPanel(s){
  const edit = canEdit(), closed = !!stage(s, s.stageKey)?.final, now = Date.now();
  const rows = (s.materials || []).map(m => {
    const od = m.status === "kept" && m.dueAt && now > m.dueAt;
    const state = m.status === "kept" ? `${m.loc ? `Kept at <b>${esc(m.loc)}</b>` : `<span style="color:var(--warn)">Not yet put away</span>`}`
      : `${esc(DISPO[m.status] || m.status)} ${fmtDate(m.outAt)}${m.outTech ? ` by ${esc(m.outTech)}` : ""}${m.outRef ? ` · ${esc(m.outRef)}` : ""}`;
    let ctl = "";
    if (edit && m.status === "kept"){
      const def = m.loc && od ? m.dispo : m.loc ? m.dispo : "store";
      ctl = `<div class="row" style="gap:6px;margin-top:6px;flex-wrap:wrap">
        <select class="inp" id="mx_${m.k}" style="width:auto;max-width:100%">${[["store", m.loc ? "Move to another location" : "Put away in storage"], ["returned", "Return"], ["disposed", "Dispose"], ["external", "Send to external lab"], ["archived", "Move to long-term archive"]].map(([k, l]) => `<option value="${k}" ${k === def ? "selected" : ""}>${l}${k === m.dispo ? " (route says)" : ""}</option>`).join("")}</select>
        <input class="inp" id="mr_${m.k}" data-clear style="flex:1 1 140px;width:auto" placeholder="Location or reference">
        <button type="button" class="btn" data-mat="${m.k}">Record</button></div>`;
    } else if (m.status !== "kept" && canApprove()){
      ctl = `<details class="more" id="mu_box_${m.k}" style="margin-top:6px"><summary class="small">Reverse this (recorded by mistake)</summary><div class="row" style="gap:6px;margin-top:6px"><input class="inp" id="mu_${m.k}" data-clear style="flex:1 1 160px;width:auto" placeholder="Reason (required)"><button type="button" class="btn" data-undo="${m.k}">Reverse</button></div></details>`;
    }
    return `<tr><td><b>${esc(m.item)}</b><div class="small muted">Then: ${esc(lcFirst(m.then))}</div></td>
      <td style="white-space:nowrap">${m.days ? fmtDate(m.dueAt) : "At release"}${od ? `<div class="small" style="color:var(--bad);font-weight:600">${dur(now - m.dueAt)} past</div>` : ""}</td>
      <td>${state}${ctl}</td></tr>`;
  }).join("");
  return `<div class="panel stack" id="matBox"><h3>Retained material</h3>
    <p class="small muted" style="margin:0">Each material is kept for its own period from the release of results, then returned or disposed. Every return, disposal or send-out is written to the ledger.</p>
    ${edit && !closed && twoPerson(s) ? `<div class="form">${witnessField("mtWit")}</div>` : ""}
    <div class="tbl-wrap"><table><thead><tr><th>Material</th><th>Kept until</th><th>Where it is</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}
function bindTrack(v, s){
  const rt = $("#rcTest", v), rr = $("#rcRoute", v);
  if (rt && rr){
    const info = () => {
      syncRoutes(rt, rr, s, null);
      const c = receiptChecks(s), r = routeByCode(rr.value), lines = [];
      if (rt.value !== s.test) lines.push(`Test changes from “${s.testName || testOf(s.test)?.name || s.test}”: give the reason in the note.`);
      if (r) lines.push(routeLine(r));
      if (c.holdH != null && !c.warn.some(w => w.startsWith("holding"))) lines.push(`Received ${hoursLabel(c.holdH)} after collection; holding time for ${typeOf(s.typeKey).holdWhat} is ${hoursLabel(typeOf(s.typeKey).hold)}.`);
      $("#rcInfo", v).innerHTML = lines.map(esc).join(" ") + (c.warn.length ? `<div class="notice warn" style="margin-top:6px"><b>Check before confirming:</b> ${c.warn.map(esc).join("; ")}. Describe it in the note; it is printed on the record.</div>` : "");
    };
    syncers.push(info);
    ["#rcTest", "#rcRoute", "#rcAt", "#rcBags", "#rcSeal", "#rcCond", "#rcTemp"].forEach(id => { const el = $(id, v); if (el){ el.addEventListener("change", info); el.addEventListener("input", info); } });
    info();
  }
  const xt = $("#rrTest", v), xr = $("#rrCode", v);
  if (xt && xr){ const info = () => syncRoutes(xt, xr, s, $("#rrInfo", v)); syncers.push(info); xt.addEventListener("change", info); xr.addEventListener("change", info); info(); }
  if (moving) setMoveBusy(true);
  v.querySelectorAll("[data-step]").forEach(b => b.addEventListener("click", () => doStep(b.dataset.step)));
  v.querySelectorAll("[data-receipt]").forEach(b => b.addEventListener("click", () => doReceipt(b.dataset.receipt)));
  v.querySelectorAll("[data-mat]").forEach(b => b.addEventListener("click", () => doMaterial(b.dataset.mat)));
  v.querySelectorAll("[data-undo]").forEach(b => b.addEventListener("click", () => doUndo(b.dataset.undo)));
  $("#corrBtn", v)?.addEventListener("click", doCorrection);
  $("#redoBtn", v)?.addEventListener("click", doRedo);
  $("#rerouteBtn", v)?.addEventListener("click", doReroute);
  $("#cxBtn", v)?.addEventListener("click", doCancel);
  $("#rsSave", v)?.addEventListener("click", doSaveResults);
  $("#accBtn", v)?.addEventListener("click", doAcceptChecks);
  $("#overBtn", v)?.addEventListener("click", doOverRange);
  $("#amBtn", v)?.addEventListener("click", doAmend);
  $("#ackBtn", v)?.addEventListener("click", doAckAlerts);
  $("#amApprove", v)?.addEventListener("click", doApproveAmend);
  $("#amDrop", v)?.addEventListener("click", doDropAmend);
  v.querySelectorAll("[data-cert]").forEach(b => b.addEventListener("click", () => showCert(b.dataset.cert)));
}

/* ---------- writing to a sample ---------- */
async function leased(docRef, quiet){
  let lease = null;
  for (let i = 0; i < 14 && !(lease && lease.acquired); i++){
    lease = await docRef.acquire({ holder: tabId, ttlMs: 3000 });
    if (!lease.acquired){ const left = Date.parse(lease.expiresAt || "") - Date.now(); await sleep(Math.min(1500, Math.max(120, (left || 300) + 40)) + Math.random() * 120); }
  }
  if (!lease.acquired){ if (!quiet) toast("Someone else is updating this sample. Try again in a moment."); return null; }
  const snap = await docRef.get();
  if (!snap.exists || !snap.data()?.id){ if (!quiet) toast("This sample no longer exists."); return null; }
  return snap.data();
}
/* Times only move forward on a record, even when two devices' clocks disagree. */
const nowAfter = s => Math.max(Date.now(), ...((s.history || []).map(h => (h.at || 0) + 1000)));
const lastTech = s => (s.history || []).slice(-1)[0]?.tech || "someone else";
let moving = false;
/* Runs one change to the sample under a short lease, on the freshest copy. fn(s) returns { upd, moves, msg } or null to stop. */
async function act(fn, opts = {}){
  if (!db || !current?.body || moving || !canEdit()) return false;
  const seen = current.body;
  moving = true; setMoveBusy(true);
  const docRef = db.doc("samples/" + seen.id);
  try {
    const s = await leased(docRef); if (!s) return false;
    if (!opts.anyStage && s.stageKey !== seen.stageKey){ toast(`${s.id} was just moved to ${stage(s, s.stageKey)?.name || s.stageKey} by ${lastTech(s)}. Check it and try again.`); return false; }
    const res = fn(s); if (!res) return false;
    const { upd, moves = [], msg } = res;
    upd.updatedAt = Date.now();
    if (moves.length){ upd.ledgerPending = [...(s.ledgerPending || []), ...moves]; upd.lp = true; }
    const sync = derive(s, upd);
    await docRef.update(upd);
    if (sync) await writeStock(docRef, { ...s, ...upd }).catch(() => {});   // still under the lease, so stock records are written in order
    docRef.acquire({ holder: tabId, ttlMs: 1000 }).catch(() => {});   // let go early: the next person need not wait out the lease
    if (moves.length) flushLedger(s.id);
    clearForm(opts.clear);
    toast(msg);
    return true;
  } catch (e) { writeFailed(e); return false; }
  finally { moving = false; setMoveBusy(false); }
}
function needWitness(s, id){
  if (!twoPerson(s)) return "";
  const w = val(id);
  if (!w){ toast("Two-person custody: choose the witness first."); $(id)?.focus(); return null; }
  return w;
}
async function doReceipt(kind){
  const s0 = current?.body; if (!s0 || !canEdit()) return;
  const note = val("#mvNote");
  if (kind !== "confirm" && !note){ toast(kind === "flag" ? "Describe the problem in the note first." : "Give the reason for rejecting in the note first."); $("#mvNote")?.focus(); return; }
  let c = null, test = s0.test, r = null, wit = "";
  if (kind === "confirm"){
    c = receiptChecks(s0);
    const err = receiptTimeError(s0, c.at); if (err){ toast(err); $("#rcAt")?.focus(); return; }
    if ((wit = needWitness(s0, "#rcWit")) === null) return;
    if (typeOf(s0.typeKey)?.cool != null && c.temp === ""){ toast("Record the cooler temperature on arrival."); $("#rcTemp")?.focus(); return; }
    test = val("#rcTest"); r = routeByCode(val("#rcRoute"));
    if (!r || !(r.tests || []).includes(test)){ toast("Choose a route that performs the test."); return; }
    if (test !== s0.test && !note){ toast("Give the reason for changing the test in the note."); $("#mvNote")?.focus(); return; }
    if (c.warn.length && !note){ toast("A receipt check failed. Describe it in the note, then confirm."); $("#mvNote")?.focus(); return; }
  }
  const disp = kind === "reject" ? val("#rcDisp") : "";
  await act(s => {
    if (!awaiting(s)){ toast(`${s.id} was already handled by ${lastTech(s)}.`); return null; }
    const base = { by: session.u, tech: session.name, ref: "" }, h = s.history || [];
    if (kind === "confirm"){
      const at = Math.max(c.at, (s.createdAt || 0) + 1000), changed = r.code !== s.route || test !== s.test;
      const recv = { bags: c.bags || null, mass: c.mass, unit: c.unit, seal: c.seal, cond: c.cond, temp: c.temp, holdH: c.holdH, warn: c.warn, ...(wit ? { wit } : {}) };
      const upd = { stageKey: "received", stageAt: at, receivedBy: session.name, receivedAt: at, recvAt: at, recv, onHand: true, flag: "", inMid: `${s.id}~in` };
      if (changed) Object.assign(upd, routeFields(r, test));
      const parts = [note || "Receipt confirmed; sample matches the submission"];
      if (test !== s.test) parts.push(`Test changed from ${s.testName || testOf(s.test)?.name || s.test} to ${testOf(test)?.name || test}`);
      if (r.code !== s.route) parts.push(`Route changed from ${s.route || "the standard workflow"} to ${r.code}`);
      if (c.warn.length) parts.push("Receipt checks: " + c.warn.join("; "));
      upd.history = [...h, { ...base, key: "received", sn: HEAD[1].name, at, note: parts.join(". "), ...(wit ? { wit } : {}), ...(changed ? { reroute: true } : {}), ...(test !== s.test ? { testFrom: s.test, testTo: test } : {}) }];
      return { upd, moves: [inMove(s, at, recv, note, wit)], msg: `${s.id} received` };
    }
    const now = nowAfter(s);
    if (kind === "flag") return { upd: { flag: note, history: [...h, { ...base, key: s.stageKey, sn: stage(s, s.stageKey)?.name, at: now, note: "Flagged: " + note }] }, msg: `${s.id} flagged` };
    if (disp === "cancel") return { upd: { stageKey: "cancelled", stageAt: now, flag: "", open: false, onHand: false, closedAt: now, history: [...h, { ...base, key: "cancelled", sn: "Submission cancelled", at: now, note: "Cancelled, nothing received: " + note }] }, msg: `${s.id} cancelled` };
    const outAt = now + 1000;
    return { upd: { stageKey: "rejected", stageAt: outAt, flag: "", open: false, onHand: false, closedAt: outAt, recvAt: now, receivedBy: session.name, receivedAt: now, inMid: `${s.id}~in`,
        history: [...h, { ...base, key: "received", sn: HEAD[1].name, at: now, note: "Received for inspection" }, { ...base, key: "rejected", sn: "Rejected at receipt", at: outAt, note: `Rejected and ${DISPO[disp].toLowerCase()}: ${note}` }] },
      moves: [inMove(s, now, null, "Received for inspection", ""), outMove(s, outAt, disp, "Whole sample (rejected)", "", note, `${s.id}~out~all~1`, "")], msg: `${s.id} rejected` };
  });
}
async function doStep(kind){
  const s0 = current?.body; if (!s0) return;
  const p = planOf(s0), ci = curIdx(s0), note = val("#mvNote"), ref = val("#mvRef"), loc = val("#mvLoc");
  let key = s0.stageKey, wit = "";
  if (kind === "next"){
    const nx = p[ci + 1]; if (!nx) return;
    if (nx.target && !canApprove()){ toast("Only a lab supervisor can release results."); return; }
    if (nx.target && selfCheck(s0) === "blocked"){ toast(SELF_MSG); return; }
    if (nx.target && selfCheck(s0) === "admin" && !val("#selfWhy")){ toast("You entered results on this sample: give the reason for releasing them yourself."); $("#selfWhy")?.focus(); return; }
    key = nx.key;
    if ((wit = needWitness(s0, "#mvWit")) === null) return;
  } else {
    if (!note && !ref && !loc){ toast("Type a note, reference or location first."); $("#mvNote")?.focus(); return; }
    wit = val("#mvWit");
  }
  await act(s => {
    const at = nowAfter(s), to = stage(s, key), h = s.history || [];
    if (key !== s.stageKey && to?.phase === "qc" && stage(s, s.stageKey)?.phase !== "qc"){ const why = qcEntryBlock(s); if (why){ toast(why); return null; } }
    if (to?.target){
      if (!canApprove()) return null;
      const why = releaseBlock(s); if (why){ toast(why); return null; }
      const self = selfCheck(s), selfWhy = val("#selfWhy");
      if (self === "blocked"){ toast(SELF_MSG); return null; }
      if (self === "admin" && !selfWhy){ toast("You entered results on this sample: give the reason for releasing them yourself."); return null; }
      const upd = releaseUpdate(s, at, note, wit, ref, self === "admin" ? selfWhy : "");
      if (loc) upd.location = loc;
      return { upd, msg: `${s.id}: results released, certificate ${upd.certs.at(-1).no} issued` };
    }
    const entry = { key, sn: to?.name || key, at, by: session.u, tech: session.name, note, ref, ...(loc ? { loc } : {}), ...(wit ? { wit } : {}) };
    const upd = { history: [...h, entry] };
    if (key !== s.stageKey){ upd.stageKey = key; upd.stageAt = at; }
    if (loc) upd.location = loc;
    return { upd, msg: key === s.stageKey ? `Note saved on ${s.id}` : `${s.id} moved to ${to?.name || key}` };
  });
}
async function doCorrection(){
  const s0 = current?.body; if (!s0) return;
  const key = val("#mvKey"), why = val("#corrWhy");
  if (!key) return;
  if (!why){ toast("Give the reason for the correction."); $("#corrWhy")?.focus(); return; }
  const p0 = planOf(s0), j0 = p0.findIndex(x => x.key === key);
  if (j0 > curIdx(s0) + 1 && !canApprove()){ toast("Only a lab supervisor can skip steps."); return; }
  const wit = needWitness(s0, "#mvWit"); if (wit === null) return;
  await act(s => {
    const p = planOf(s), ci = curIdx(s), j = p.findIndex(x => x.key === key);
    if (j < 1 || j === ci || ci >= targetIdx(s)) return null;
    if (j > ci){ const b = blockedBy(s, j); if (b){ toast(`${b.name} can only be reached step by step.`); return null; } }
    const at = nowAfter(s), skipped = j > ci + 1 ? p.slice(ci + 1, j).map(x => x.key) : null;
    const entry = { key, sn: p[j].name, at, by: session.u, tech: session.name, ref: val("#mvRef"), why, ...(wit ? { wit } : {}),
      ...(j < ci ? { corr: true, note: "Correction: " + why } : { skipped, note: `Skipped ${p.slice(ci + 1, j).map(x => x.name).join(", ")}: ${why}` }) };
    return { upd: { stageKey: key, stageAt: at, history: [...(s.history || []), entry] }, msg: j < ci ? `${s.id} corrected to ${p[j].name}` : `${s.id} moved to ${p[j].name}; skipped steps recorded` };
  });
}
/* QC failed or a result needs repeating: back to the route's re-assay step. */
async function doRedo(){
  const s0 = current?.body; if (!s0) return;
  const why = val("#redoWhy") || "Re-assay", note = val("#mvNote"), ref = val("#mvRef");
  const wit = needWitness(s0, "#mvWit"); if (wit === null) return;
  await act(s => {
    if (!redoOk(s)) return null;
    const p = planOf(s), back = p[redoIdx(s)], at = nowAfter(s), kept = keptMaterials(s), fromStore = curIdx(s) > targetIdx(s) || stage(s, s.stageKey)?.phase === "store";
    const out = fromStore ? `. Taken from storage${kept.some(m => m.loc) ? ` (${kept.filter(m => m.loc).map(m => `${m.item}: ${m.loc}`).join("; ")})` : ""}` : "";
    return { upd: { stageKey: back.key, stageAt: at, reassays: (s.reassays || 0) + 1, lastRedo: why, ...redoReset(s, at),
      history: [...(s.history || []), { key: back.key, sn: back.name, at, by: session.u, tech: session.name, ref, redo: true, ...(wit ? { wit } : {}), note: `Re-assay: ${why}${note ? ". " + note : ""}${out}` }] },
      msg: `${s.id} sent back to ${back.name}` };
  });
}
async function doReroute(){
  const s0 = current?.body; if (!s0) return;
  const test = val("#rrTest"), r = routeByCode(val("#rrCode")), note = val("#mvNote"), ref = val("#mvRef");
  if (!r || !(r.tests || []).includes(test)){ toast("Choose a route that performs the test."); return; }
  if (r.code === s0.route && test === s0.test){ toast("That is the sample's current test and route."); return; }
  if (test !== s0.test && !note){ toast("Give the reason for changing the test in the note."); $("#mvNote")?.focus(); return; }
  const wit = needWitness(s0, "#mvWit"); if (wit === null) return;
  await act(s => {
    const plan = buildPlan(r), cur = stage(s, s.stageKey);
    const to = plan.find(x => x.key === s.stageKey) || plan.find((x, i) => i >= 2 && x.phase === cur?.phase) || plan[2] || plan[1];
    const at = nowAfter(s), parts = [];
    if (test !== s.test) parts.push(`Test changed from ${s.testName || testOf(s.test)?.name || s.test} to ${testOf(test)?.name || test}`);
    if (r.code !== s.route) parts.push(`Route changed from ${s.route || "the standard workflow"} to ${r.code}`);
    if (note) parts.push(note);
    const upd = { ...routeFields(r, test), ...rerouteReset(s, r, test, at),
      history: [...(s.history || []), { key: to.key, sn: to.name, at, by: session.u, tech: session.name, ref, reroute: true, ...(wit ? { wit } : {}), ...(test !== s.test ? { testFrom: s.test, testTo: test } : {}), note: parts.join(". ") }] };
    if (to.key !== s.stageKey){ upd.stageKey = to.key; upd.stageAt = at; }
    return { upd, msg: `${s.id} is now on ${r.code}, at ${to.name}` };
  });
}
async function doCancel(){
  const s0 = current?.body; if (!s0) return;
  const disp = val("#cxDisp"), why = val("#cxWhy"), ref = val("#mvRef");
  if (!why){ toast("Give the reason for stopping the testing."); $("#cxWhy")?.focus(); return; }
  if (disp === "external" && !ref){ toast("Put the external lab and waybill in the Reference box."); $("#mvRef")?.focus(); return; }
  const wit = needWitness(s0, "#mvWit"); if (wit === null) return;
  await act(s => {
    const ci = curIdx(s); if (ci < 1 || ci >= targetIdx(s)) return null;
    const at = nowAfter(s), mid = `${s.id}~out~all~1`;
    return { upd: { stageKey: disp, stageAt: at, open: false, onHand: false, closedAt: at,
        history: [...(s.history || []), { key: disp, sn: stage(s, disp).name, at, by: session.u, tech: session.name, ref, ...(wit ? { wit } : {}), note: `Testing stopped: ${why}` }] },
      moves: [outMove(s, at, disp, "Whole sample (testing stopped)", ref, why, mid, wit)], msg: `${s.id} closed: ${stage(s, disp).name.toLowerCase()}` };
  });
}
async function doMaterial(k){
  const s0 = current?.body; if (!s0) return;
  const what = val("#mx_" + k), ref = val("#mr_" + k);
  if (what === "store" && !ref){ toast("Type the storage location first."); $("#mr_" + k)?.focus(); return; }
  if (what === "external" && !ref){ toast("Type the external lab and waybill number first."); $("#mr_" + k)?.focus(); return; }
  const wit = needWitness(s0, "#mtWit"); if (wit === null) return;
  await act(s => {
    const mats = clone(s.materials || []), m = mats.find(x => x.k === k);
    if (!m || m.status !== "kept"){ toast("This material was already recorded by someone else."); return null; }
    const at = nowAfter(s), upd = { materials: mats }, moves = [], h = s.history || [];
    // The sample goes into storage (and off the board) once every material still kept has a place on the shelf.
    const shelved = () => { if (s.stageKey === "released" && mats.every(x => x.status !== "kept" || x.loc)){ upd.stageKey = "storage"; upd.stageAt = at; } };
    if (what === "store"){
      m.loc = ref; shelved();
      upd.location = mats.filter(x => x.status === "kept" && x.loc).map(x => `${x.item}: ${x.loc}`).join("; ");
      const key = upd.stageKey || s.stageKey;
      upd.history = [...h, { key, sn: stage(s, key)?.name || key, at, by: session.u, tech: session.name, ref: "", loc: ref, mat: k, ...(wit ? { wit } : {}), note: `${m.item} put away` }];
      return { upd, msg: `${m.item} stored at ${ref}${upd.stageKey ? "" : `; ${mats.filter(x => x.status === "kept" && !x.loc).map(x => x.item).join(", ")} still to put away`}` };
    }
    m.outs = (m.outs || 0) + 1;
    Object.assign(m, { status: what, outAt: at, outBy: session.u, outTech: session.name, outRef: ref, outMid: `${s.id}~out~${k}~${m.outs}` });
    moves.push(outMove(s, at, what, m.item, ref, "", m.outMid, wit));
    if (!mats.some(x => x.status === "kept")){
      const ds = new Set(mats.map(x => x.status)), fin = ds.size === 1 ? [...ds][0] : "closed";
      Object.assign(upd, { stageKey: fin, stageAt: at, open: false, onHand: false, closedAt: at });
    } else shelved();
    upd.location = mats.filter(x => x.status === "kept" && x.loc).map(x => `${x.item}: ${x.loc}`).join("; ");
    const key = upd.stageKey || s.stageKey;
    upd.history = [...h, { key, sn: stage(s, key)?.name || key, at, by: session.u, tech: session.name, ref, mat: k, ...(wit ? { wit } : {}), note: `${m.item}: ${DISPO[what].toLowerCase()}` }];
    return { upd, moves, msg: upd.open === false ? `${s.id} closed: all material has left the lab` : `${m.item}: ${DISPO[what].toLowerCase()}` };
  }, { anyStage: true, clear: ["mx_" + k, "mr_" + k, "mtWit"] });
}
async function doUndo(k){
  const s0 = current?.body; if (!s0 || !canApprove()) return;
  const why = val("#mu_" + k);
  if (!why){ toast("Give the reason for the reversal."); $("#mu_" + k)?.focus(); return; }
  await act(s => {
    const mats = clone(s.materials || []), m = mats.find(x => x.k === k);
    if (!m || m.status === "kept") return null;
    const at = nowAfter(s), was = m.status, moves = m.outMid ? [revMove(s, at, m.outMid, m.item, why)] : [];
    Object.assign(m, { status: "kept", outAt: null, outBy: "", outTech: "", outRef: "", outMid: "" });
    const upd = { materials: mats, location: mats.filter(x => x.status === "kept" && x.loc).map(x => `${x.item}: ${x.loc}`).join("; ") };
    if (stage(s, s.stageKey)?.final) Object.assign(upd, { stageKey: mats.every(x => x.status !== "kept" || x.loc) ? "storage" : "released", stageAt: at, open: true, onHand: true, closedAt: null });
    const key = upd.stageKey || s.stageKey;
    upd.history = [...(s.history || []), { key, sn: stage(s, key)?.name || key, at, by: session.u, tech: session.name, corr: true, mat: k, why, note: `Correction: ${m.item} ${DISPO[was].toLowerCase()} reversed. ${why}` }];
    return { upd, moves, msg: `${m.item}: movement reversed` };
  }, { anyStage: true, clear: ["mu_box_" + k] });
}
function setMoveBusy(b){ document.querySelectorAll("#actBox button, #matBox button, #resPanel button").forEach(x => x.disabled = b || x.hasAttribute("data-hold")); }
function writeFailed(e){
  if (e && e.code === "invalid_argument"){ canWrite = false; toast("This copy of the prototype is view-only for your claude.ai account, so changes can't be saved."); }
  else if (e && e.code === "quota_exceeded") toast("The register is full. Archive or delete old samples before adding more.");
  else toast("Could not save. Check your connection and try again.");
}
/* One way in for new samples: Register at lab for people who are not signed in, Submit a sample for everyone signed in. */
const entryTab = t => t === "register" && session ? "submit" : t === "submit" && !session ? "register" : t;
document.addEventListener("click", e => { const g = e.target.closest("[data-goto]"); if (g) setTab(entryTab(g.dataset.goto)); });

/* ---------- ledger movements: written once, on a real transition; a mistake is reversed, never deleted ---------- */
function baseMove(s, at, dir, mid, extra){
  return { mid, dir, at, sid: s.id, sec: s.section || "", type: s.type || "", route: s.route || "", tag: tagText(s), sub: s.submitter || "", by: session?.u || "", tech: session?.name || "", ...extra };
}
const inMove = (s, at, recv, note, wit) => baseMove(s, at, "in", `${s.id}~in`, { item: "Sample", qty: recv ? qtyText(recv.bags, recv.mass, recv.unit) : qtyText(s.containers, s.massKg, "kg"), from: s.source || sectionName(s.section) || "Mine site", note: note || "", wit: wit || "" });
const outMove = (s, at, dispo, item, ref, note, mid, wit) => baseMove(s, at, "out", mid, { kind: dispo, item, ref: ref || "", note: note || "", wit: wit || "" });
const revMove = (s, at, mid, item, note) => baseMove(s, at, "rev", mid + "~rev", { rev: mid, item, note: note || "" });
/* One ledger document per site day and section; each movement is a key inside it, so two people writing at once never overwrite each other. */
const ledgerDoc = m => `${dayKey(m.at)}_${String(m.sec || "NA").replace(/[^A-Za-z0-9]/g, "") || "NA"}`;
async function writeMoves(moves){
  const groups = {};
  for (const m of moves) (groups[ledgerDoc(m)] = groups[ledgerDoc(m)] || {})[m.mid] = m;
  for (const [id, ms] of Object.entries(groups)){
    const ref = db.doc("ledger/" + id);
    let snap = await ref.get();
    for (let i = 0; i < 20 && !(snap.exists && snap.data()?.day); i++){
      const lease = await ref.acquire({ holder: tabId, ttlMs: 3000 });
      snap = await ref.get();
      if (snap.exists && snap.data()?.day) break;
      if (lease.acquired){
        const head = { day: id.slice(0, 10), month: id.slice(0, 7), sec: id.slice(11) };
        if (snap.exists) await ref.update(head); else await ref.set({ ...head, m: {} });
        break;
      }
      await sleep(250 + Math.random() * 250);
    }
    await ref.update({ m: ms });
  }
}
const flushing = new Set();
async function flushLedger(sid){
  if (!db || flushing.has(sid)) return; flushing.add(sid);
  try {
    for (let attempt = 0; attempt < 3; attempt++){
      try {
        const ref = db.doc("samples/" + sid), snap = await ref.get();
        const pend = (snap.exists && snap.data().ledgerPending) || [];
        if (!pend.length) return;
        await writeMoves(pend);
        const s = await leased(ref, true); if (!s) throw new Error("busy");
        const done = new Set(pend.map(m => m.mid)), left = (s.ledgerPending || []).filter(m => !done.has(m.mid));
        await ref.update({ ledgerPending: left, lp: left.length > 0 });
        ref.acquire({ holder: tabId, ttlMs: 1000 }).catch(() => {});
        return;
      } catch { await sleep(700 * (attempt + 1)); }
    }
    toast("A ledger entry could not be saved yet. It will be retried automatically.");
  } finally { flushing.delete(sid); }
}
