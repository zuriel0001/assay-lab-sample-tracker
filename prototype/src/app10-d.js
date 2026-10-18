
/* ---------- board: every sample still in the lab, queried by state (lab == true) rather than a recent-items window ---------- */
let boardSec = "", boardRoute = "", boardPick = "";
const isToday = t => !!t && dayKey(t) === dayKey(Date.now());
const recvOf = s => s.receivedAt || s.recvAt || 0;
const dueToday = s => { const i = curIdx(s); if (i < 0 || i >= targetIdx(s) || awaiting(s)) return false; const p = projection(s); return isToday(p.eta || stageDue(s)); };
function renderBoard(){
  const v = $("#view-board"), wall = document.body.classList.contains("wall");
  const pass = s => (!boardSec || s.section === boardSec) && (!boardRoute || (s.route || "") === boardRoute);
  const list = [...samples.values()].filter(pass);
  const waiting = list.filter(awaiting);
  const inProc = list.filter(s => { const i = curIdx(s); return i > 0 && i < targetIdx(s); });
  const late = inProc.filter(s => status(s).late);
  const redo = inProc.filter(s => s.reassays > 0);
  const noBatch = inProc.filter(s => { const labs = labsOf(s); return groupsOf(s).some(g => !labs[g.p]); });
  const relReady = qcStepOn() ? [] : inProc.filter(readyRel);
  const qcAct = inProc.filter(s => Object.values(labsOf(s)).some(l => l.q === "fail" || l.q === "warn"));
  const alerts = isStaff() ? list.filter(s => (s.results || s.amend) && openAlerts(s).length) : [], trends = isStaff() ? crmTrendFlags() : [];
  const relN = [...releasedToday.values()].filter(pass).length;
  const unstored = list.filter(s => s.stageKey === "released" && stageDue(s) && Date.now() > stageDue(s)), notStored = unstored.length;
  const dueNow = Date.now(), dueL = [...list.filter(s => overdueMaterials(s).length).map(s => ({ sec: s.section, route: s.route || "", n: overdueMaterials(s).length })),
    ...[...storeDue.values()].filter(x => !samples.has(x.id)).map(x => ({ sec: x.sec, route: x.route, n: x.m.filter(m => m.dueAt && dueNow > m.dueAt).length }))]
    .filter(x => x.n && (!boardSec || x.sec === boardSec) && (!boardRoute || x.route === boardRoute));
  const dueS = dueL, dueM = dueL.reduce((n, x) => n + x.n, 0);
  const flagged = waiting.filter(s => s.flag).length;
  // Summary tiles, zeros included: a tile with samples filters the board to them, a tile with a tab opens it.
  const sums = [
    { k: "await", n: waiting.length, l: `Awaiting receipt${flagged ? `, ${flagged} flagged` : ""}`, tone: flagged ? "warn" : "info", pick: waiting },
    { k: "lab", n: inProc.length, l: "In the lab, before results", tone: "", pick: inProc },
    { k: "late", n: late.length, l: "Running late", tone: "bad", pick: late },
    { k: "redo", n: redo.length, l: "Being re-assayed", tone: "warn", pick: redo },
    ...(canEdit() ? [batchesRequired() ? { k: "nobatch", n: noBatch.length, l: "Waiting for a lab batch", tone: "", pick: noBatch } : { k: "relready", n: relReady.length, l: "Ready for release", tone: relReady.length ? "info" : "", pick: relReady },
      { k: "qc", n: qcAct.length, l: "In a batch with QC to act on", tone: "warn", pick: qcAct }] : []),
    ...(isStaff() ? [{ k: "alerts", n: alerts.length, l: "Results past an action or permit limit, not yet recorded", tone: "bad", pick: alerts },
      { k: "trends", n: trends.length, l: "Reference material trends", tone: "warn", go: "batches" }] : []),
    { k: "rel", n: relN, l: "Results released today", tone: "ok" },
    { k: "unstored", n: notStored, l: "Released, not yet put in storage", tone: "warn", pick: unstored },
    { k: "retention", n: dueM, l: `Materials past retention${dueS.length ? `, on ${dueS.length} sample(s)` : ""}`, tone: "warn", go: allowedTabs().includes("storage") ? "storage" : "" },
    { k: "recvToday", n: list.filter(s => isToday(recvOf(s))).length, l: "Received today", tone: "", pick: list.filter(s => isToday(recvOf(s))), hide: true },
    { k: "dueToday", n: list.filter(dueToday).length, l: "Results due today", tone: "", pick: list.filter(dueToday), hide: true }
  ];
  const cur = sums.find(x => x.k === boardPick && x.pick);
  if (boardPick && !cur) boardPick = "";
  const shown = cur ? new Set(cur.pick) : null;
  const sumHtml = sums.filter(x => !x.hide).map(x => {
    const act = !x.n ? "" : x.pick ? `data-bpick="${x.k}" aria-pressed="${boardPick === x.k}"` : x.go ? `data-goto="${x.go}"` : "", inner = `<span class="n">${x.n}</span><span class="l">${esc(x.l)}</span>`;
    return act ? `<button type="button" class="stat tile ${x.tone}" ${act}>${inner}</button>` : `<div class="stat tile${x.n ? " " + x.tone : ""}">${inner}</div>`;
  }).join("");
  const filters = `<div class="bd-top bd-tools">
    <select class="inp" id="bdSec" style="width:auto;max-width:100%" aria-label="Section"><option value="">All sections</option>${(cfg.sections || []).map(x => `<option value="${esc(x.code)}" ${boardSec === x.code ? "selected" : ""}>${esc(x.code)} · ${esc(x.name)}</option>`).join("")}</select>
    <select class="inp" id="bdRoute" style="width:auto;max-width:100%" aria-label="Test or route"><option value="">All tests and routes</option>${routeOptions(boardRoute, boardRoutes())}</select>
    <span class="grow"></span>${isStaff() ? `<button type="button" class="btn ghost" id="bdWall">${wall ? "Exit wall screen" : "Wall screen"}</button>` : ""}</div>`;
  const wallHead = `<div class="wall-head"><h2>Assay Lab · Workflow board</h2><span class="clock" id="wallClock"></span><button type="button" class="btn" data-wall-exit>Exit</button></div>`;
  const bind = () => {
    const a = $("#bdSec"), b = $("#bdRoute");
    if (a) a.onchange = e => { boardSec = e.target.value; renderBoard(); };
    if (b) b.onchange = e => { boardRoute = e.target.value; renderBoard(); };
    v.querySelectorAll("[data-bpick]").forEach(x => x.onclick = () => { boardPick = boardPick === x.dataset.bpick ? "" : x.dataset.bpick; renderBoard(); });
    const w = $("#bdWall"); if (w) w.onclick = () => setWall(!wall);
    v.querySelectorAll("[data-wall-exit]").forEach(x => x.onclick = () => setWall(false));
    wallClock();
  };
  if (!list.length && (boardSec || boardRoute)){ v.innerHTML = `<div class="stack">${wallHead}${filters}<div class="panel empty"><strong>No samples in the lab match these filters</strong></div></div>`; bind(); return; }
  if (!list.length){
    v.innerHTML = `${wallHead}<div class="panel empty"><strong>No samples in the lab</strong>
      <div class="row" style="justify-content:center;margin-top:14px"><button class="btn primary" data-goto="submit">Submit a sample</button>${allowedTabs().includes("storage") ? `<button class="btn" data-goto="storage">Storage</button>` : ""}</div></div>`;
    bind(); return;
  }
  // With no QA/QC review step, its lane holds the samples ready for release (and any still at a QA/QC review step).
  const laneDefs = PHASES.filter(x => x.key !== "store").map(x => x.key === "qc" && !qcStepOn() ? { ...x, name: "Ready for release" } : x);
  const relSet = new Set(relReady);
  if (list.some(s => !stage(s, s.stageKey))) laneDefs.push({ key: "__unknown", name: "Stage removed (move these)" });
  const showStep = { intake: 1, prep: 1, test: 1, qc: 1 };
  const lanes = laneDefs.map(x => {
    const items = list.filter(s => { const st = stage(s, s.stageKey); return (!shown || shown.has(s)) && (x.key === "__unknown" ? !st : relSet.has(s) ? x.key === "qc" : st && st.phase === x.key); })
      .sort((a, b) => (status(b).late - status(a).late) || (b.priority === "Urgent") - (a.priority === "Urgent") || a.stageAt - b.stageAt);
    return `<div class="lane ph-${x.key}"><h4>${esc(x.name)} <span>${items.length}</span></h4>
      <div class="cards">${items.slice(0, 40).map(s => { const stt = status(s), stp = stage(s, s.stageKey), od = overdueMaterials(s), tm = cardTime(s);
        return `<button class="chip ${tm.cls}${stt.late ? " late" : ""}${s.priority === "Urgent" ? " urgent" : ""}" data-open="${esc(s.id)}"${stageDue(s) && !stp?.final ? ` title="Due ${esc(fmt(stageDue(s)))}"` : ""}>
          <div class="ctop"><span class="cid">${esc(s.id)}${s.route ? ` <span class="rc">${esc(s.route)}</span>` : ""}</span></div>
          ${showStep[x.key] && stp ? `<div class="cmeta"><b style="color:var(--ink)">${esc(stp.name)}</b>${s.reassays ? ` · <b style="color:var(--warn)">re-assay</b>` : ""}</div>` : ""}
          ${curIdx(s) < targetIdx(s) ? Object.values(labsOf(s)).map(l => `<div class="cmeta">Batch <span class="mono">${esc(l.b)}</span>${l.q && l.q !== "pending" ? ` · <b style="color:var(--${{ ok: "ok", bad: "bad" }[qcCls(l.q)] || "warn"})">${esc(qcLabel(l.q))}</b>` : ""}</div>`).join("") : ""}
          ${alerts.includes(s) ? `<div class="cmeta"><b style="color:var(--bad)">Result past a limit</b></div>` : ""}
          ${awaiting(s) && s.handedTo ? `<div class="cmeta">Handed to ${esc(s.handedTo)}</div>` : ""}
          <div class="cmeta">${esc(s.type)}${tagText(s) ? ` · <span class="mono">${esc(tagText(s))}</span>` : ""}${s.priority === "Urgent" ? ` · <span class="urg">Urgent</span>` : ""}${s.flag && awaiting(s) ? ` · <b style="color:var(--warn)">Flagged</b>` : ""}</div>
          ${hazTags(s).length || twoPerson(s) ? `<div class="cmeta">${hazPills(s)}${twoPerson(s) ? `<span class="haz two" title="Two-person custody">2P</span>` : ""}</div>` : ""}
          ${od.length ? `<div class="cmeta"><b style="color:var(--bad)">${esc(od.map(m => m.item).join(", "))} past retention</b></div>` : x.key === "report" && stt.late ? `<div class="cmeta"><b style="color:var(--warn)">Not yet put in storage</b></div>` : ""}
          ${tm.left && !od.length && x.key !== "report" ? `<div class="cmeta left">${esc(tm.left)}</div>` : ""}</button>`; }).join("")}</div>
      ${items.length > 40 ? `<div class="small muted" style="margin-top:6px">+${items.length - 40} more: use the filters or look a sample up by ID</div>` : ""}
      ${!items.length ? `<div class="small muted">None</div>` : ""}</div>`;
  }).join("");
  const scrolled = laneScroll();
  v.innerHTML = `<div class="stack">
    ${wallHead}
    ${filters}
    <div class="stats tiles">${sumHtml}</div>
    ${cur ? `<div class="pick-note"><span>Showing <b>${esc(cur.l.toLowerCase())}</b>: ${cur.n}</span><button type="button" class="btn ghost small" data-bpick="${cur.k}">Show all</button></div>` : ""}
    ${alerts.length ? `<div class="notice bad" id="bdAlerts"><b>Past a limit:</b> ${alerts.slice(0, 12).map(s => `<button type="button" class="linkish mono" data-open="${esc(s.id)}">${esc(s.id)}</button> <span class="small">${esc(openAlerts(s).map(h => alertLine(s, h)).join("; "))}</span>`).join("<br>")}${alerts.length > 12 ? `<br>+${alerts.length - 12} more` : ""}<div class="small">Open each sample, act as the limit says and record what was done and who was told. In the production system these also go out by email or SMS.</div></div>` : ""}
    ${trends.length ? `<div class="notice warn" id="bdTrends"><b>Reference material trends:</b> ${esc(trends.map(t => `${t.crm}${t.k ? " " + t.k : ""}: ${t.msg}`).join("; "))}. See the control chart on the <button type="button" class="linkish" data-goto="batches">Lab batches</button> tab.</div>` : ""}
    <div class="lanes">${lanes}</div></div>`;
  bind();
  fitLanes(scrolled);
}

/* The board's route filter: routes in use, and any other route a sample in the lab is on. */
function boardRoutes(){ const on = new Set([...samples.values()].map(s => s.route)); return (cfg.routes || []).filter(r => routeOn(r) || on.has(r.code) || r.code === boardRoute); }
/* ---------- submit and register ---------- */
function renderSubmit(){ renderSampleForm("submit"); }
function renderRegister(){ renderSampleForm("register"); }
/* Sample types a route in use is meant for. */
function typeOptions(){
  const list = TYPES.filter(t => typeOn(t.key)), groups = [...new Set(list.map(t => t.group))];
  return groups.map(g => `<optgroup label="${esc(g)}">${list.filter(t => t.group === g).map(t => `<option value="${esc(t.key)}">${esc(t.name)}</option>`).join("")}</optgroup>`).join("");
}
function renderDetails(typeKey){
  const box = $("#rDetails"); if (!box) return;
  const was = {}; box.querySelectorAll("[id^='rD_']").forEach(el => { if (el.value) was[el.id] = el.value; });
  const t = typeOf(typeKey), fs = t?.fields || [];
  box.innerHTML = fs.length ? `<fieldset><div class="legend">${esc(t.name)}: details</div><div class="form">${fs.map(f => `<label class="f">${esc(f.l)}${f.o
    ? `<select id="rD_${f.k}"><option value="">—</option>${f.o.map(o => `<option>${esc(o)}</option>`).join("")}</select>`
    : `<input id="rD_${f.k}" ${f.t === "number" ? `type="number" step="any"` : ""} placeholder="${esc(f.ph || "")}">`}</label>`).join("")}</div></fieldset>` : "";
  Object.entries(was).forEach(([id, val]) => { const el = document.getElementById(id); if (el && (el.tagName !== "SELECT" || [...el.options].some(o => o.value === val))) el.value = val; });
}
function autoRoute(){ const ty = $("#rType")?.value, te = $("#rTest")?.value; return ty && te ? routeFor(ty, te, $("#rPurpose")?.value) : null; }
function formRoute(){ const pick = routeByCode($("#rRouteSel")?.value), te = $("#rTest")?.value; return pick && (pick.tests || []).includes(te) ? pick : autoRoute(); }
function refreshFormRoute(){
  const box = $("#rRoute"); if (!box) return;
  const auto = autoRoute(), sel = $("#rRouteSel"), te = $("#rTest")?.value;
  if (sel){
    const keep = sel.value, list = te ? routesForTest(te) : [];
    sel.innerHTML = `<option value="">${auto ? `Automatic: ${esc(auto.code)} · ${esc(auto.name)}` : "Automatic (choose the type and test first)"}</option>` + routeOptions(keep, list);
    sel.value = list.some(r => r.code === keep) ? keep : "";
    sel.closest("label").hidden = list.length < 2;   // one route performs the test: nothing to choose
  }
  const r = formRoute();
  box.innerHTML = r ? `<details class="route-mini"><summary><span class="code">${esc(r.code)}</span> ${esc(r.name)} · results about <b>${hoursLabel(routeTat(r))}</b>${r.two ? ` <span class="pill warn">Two-person custody</span>` : ""}</summary>${routePreview(r)}</details>`
    : te && $("#rType")?.value ? `<div class="route-box"><div class="small" style="color:var(--bad)">No workflow route performs this test yet. Ask the lab manager to add one in Settings.</div></div>` : "";
  const w = $("#rWitBox");
  if (w){ const two = (r && r.two) || ["bullion", "conc"].includes($("#rType")?.value) || $("#rSection")?.value === "GR"; w.hidden = !two; }
}
function renderSampleForm(mode){
  const v = $(mode === "submit" ? "#view-submit" : "#view-register");
  const me = (session?.u || "public") + (canEdit() ? "+lab" : "");
  if ($("#regForm", v) && v.dataset.who === me) return; // keep what the user is typing
  $(mode === "submit" ? "#view-register" : "#view-submit").innerHTML = "";  // one form in the page at a time (shared field ids)
  v.dataset.who = me;
  // Signed out: Register at lab (a walk-in, received later by a technician). Signed in: Submit a sample; lab staff can receive it on the spot.
  const now = Date.now(), walk = mode === "register", staff = !walk && canEdit(), req = ` <span class="req">*</span>`;
  const techs = (cfg.users || []).filter(x => ["tech", "super", "admin"].includes(x.role)).map(x => x.name).filter(Boolean);
  v.innerHTML = `<form class="panel stack${staff ? " recv-now" : ""}" id="regForm" data-mode="${mode}" autocomplete="off" novalidate>
    <div class="form-h"><h2>${walk ? "Register at lab" : "Submit a sample"}</h2>${walk ? `<span class="pill info">Waits for receipt by a lab technician</span>` : ""}
      ${staff ? `<label class="recv-toggle"><input type="checkbox" id="rRecvNow" checked> Received now at the lab, by me</label>` : ""}</div>
    ${kindPicker()}
    <div class="form">
      <label class="f"><span>Sample type <span class="req">*</span></span><select id="rType" required><option value="">Choose…</option>${typeOptions()}</select></label>
      <label class="f"><span>Analysis <span class="req">*</span></span><select id="rTest" required>${testOptions("")}</select></label>
      <label class="f"><span>Purpose <span class="req">*</span></span><select id="rPurpose" required><option value="">Choose…</option>${PURPOSES.map(p => `<option value="${esc(p.key)}">${esc(p.name)}</option>`).join("")}</select></label>
      <label class="f"><span>Submitting section <span class="req">*</span></span><select id="rSection" required><option value="">Choose…</option>${(cfg.sections || []).map(x => `<option value="${esc(x.code)}">${esc(x.code)} · ${esc(x.name)}</option>`).join("")}</select></label>
      <label class="f full" id="rWhyBox" hidden><span>Why it is being tested <span class="req">*</span></span><input id="rWhy" maxlength="200" placeholder="e.g. customer check sample, survey of old stockpile"></label>
      ${staff ? `<label class="f full" data-lab><span>Workflow route (only routes that perform the test)</span><select id="rRouteSel"><option value="">Automatic</option></select></label>` : ""}
      <div class="full" id="rRoute"></div>
      <label class="f"><span>Submitted by (name) <span class="req">*</span></span><input id="rSubmitter" required placeholder="Person who sent the sample"></label>
      <label class="f"><span>Submitter's badge number</span><input id="rSubBadge" maxlength="20" autocomplete="off"></label>
      <label class="f" data-single>Site sample code<input id="rTag" placeholder="e.g. MILL-A-001" autocomplete="off" spellcheck="false"></label>
      <label class="f" data-hand><span>Handed to (lab technician)${walk ? req : ""}</span><input id="rHandTo" maxlength="60" list="rTechList" autocomplete="off"></label>
      <label class="f" data-hand><span>Technician's badge number${walk ? req : ""}</span><input id="rHandBadge" maxlength="20" autocomplete="off"></label>
      <datalist id="rTechList">${techs.map(n => `<option value="${esc(n)}">`).join("")}</datalist>
      ${staff ? `<label class="f" data-lab><span>Date &amp; time received <span class="req">*</span></span><input id="rRecvAt" type="datetime-local" required value="${localInput(now)}"></label>
      <div id="rWitBox" data-lab hidden>${witnessField("rWit")}</div>` : ""}
      ${batchBlock()}
      <details class="form-more" id="rMore"><summary>More details</summary><div class="form">
        <div class="full" id="rDetails"></div>
        <label class="f">Site reference<input id="rSiteRef" placeholder="e.g. GC-PIT2-B340-017"></label>
        <label class="f">Source location<input id="rSource" placeholder="Pit / bench / hole / sampling point"></label>
        <label class="f">Date &amp; time collected<input id="rCollected" type="datetime-local" value="${localInput(now)}"></label>
        <label class="f">Priority<select id="rPriority"><option>Routine</option><option>Urgent</option></select></label>
        <label class="f">Containers / bags per sample<input id="rContainers" type="number" min="1" step="1" value="1"></label>
        <label class="f">Mass per sample (kg)<input id="rMass" type="number" min="0" step="0.01"></label>
        <label class="f">Seal / chain-of-custody no.<input id="rSeal"></label>
        <fieldset class="full" id="rHaz"><div class="legend">Hazards</div><div class="checks">${HAZARDS.map(h => `<label><input type="checkbox" id="rHz_${h.k}" value="${h.k}"> ${esc(h.l)}</label>`).join("")}</div></fieldset>
        <fieldset class="full"><div class="legend">Add-on analyses</div><div class="checks">${ADDONS.map((a, i) => `<label><input type="checkbox" id="rAn${i}" value="${a}"> ${a}</label>`).join("")}</div></fieldset>
        <label class="f full">Notes<textarea id="rNotes"></textarea></label>
      </div></details>
    </div>
    <div class="row sticky-bar bar"><span class="small muted" id="rMsg"></span><button class="btn primary big" type="submit" id="rSubmit">${staff ? "Register and issue ID" : walk ? "Register and get sample ID" : "Submit and get sample ID"}</button></div>
    <div id="rResult"></div>
  </form>`;
  const ty = $("#rType", v), pu = $("#rPurpose", v), te = $("#rTest", v), hz = $("#rHaz", v);
  ty.onchange = () => {
    const pur = typeOf(ty.value)?.pur;   // the usual purpose for the type, until the submitter picks one
    if (pur && !pu.dataset.touched){ pu.value = pur; $("#rWhyBox", v).hidden = pu.value !== "other"; }
    const keep = te.dataset.touched ? te.value : "";
    te.innerHTML = testOptions(ty.value);
    te.value = keep || defaultTest(ty.value, pu.value);
    if (!te.value) te.value = defaultTest(ty.value, pu.value);
    if (!hz.dataset.touched) HAZARDS.forEach(h => { $("#rHz_" + h.k, v).checked = (typeOf(ty.value)?.haz || []).includes(h.k); });
    renderDetails(ty.value); refreshFormRoute();
  };
  pu.onchange = () => { pu.dataset.touched = "1"; $("#rWhyBox", v).hidden = pu.value !== "other"; if (!te.dataset.touched && ty.value) te.value = defaultTest(ty.value, pu.value); refreshFormRoute(); };
  te.onchange = () => { te.dataset.touched = "1"; refreshFormRoute(); };
  hz.addEventListener("change", () => hz.dataset.touched = "1");
  $("#rRouteSel", v)?.addEventListener("change", refreshFormRoute);
  $("#rSection", v).addEventListener("change", refreshFormRoute);
  if (session && !walk && !staff){ $("#rSubmitter", v).value = session.name || ""; if (session.role === "section" && session.sec) $("#rSection", v).value = session.sec; }
  const rn = $("#rRecvNow", v);
  if (rn) rn.onchange = () => {
    $("#regForm", v).classList.toggle("recv-now", rn.checked);
    if (!rn.checked) $("#rRouteSel", v).value = "";
    submitLabel();
    refreshFormRoute();
  };
  bindKind(v);
  refreshFormRoute();
  lastChip(v);
  $("#regForm", v).addEventListener("submit", e => { e.preventDefault(); register(); });
}
/* A tag belongs to one open sample at a time. Returns the open sample already using it, if any. */
async function tagOwner(t){
  const ids = new Set();
  try { const s = await db.doc("tagidx/" + tagKey(t)).get(); if (s.exists && s.data()?.sid) ids.add(s.data().sid); } catch {}
  try { (await db.collection("samples").where("tags", "array-contains", normTag(t)).limit(10).get()).docs.forEach(d => ids.add(d.id)); } catch {}
  for (const id of ids){ const d = samples.get(id) || (await db.doc("samples/" + id).get()).data(); if (d && d.open !== false && !stage(d, d.stageKey)?.final) return id; }
  return "";
}
/* Each ID is claimed on its own document under a short lease, so two people submitting at once never wait on each other or get the same number. */
async function claimIds(code, stamp, n, makeBody, progress, from = 1){
  const hint = db.doc(`meta/counter-${code}-${stamp}`);
  let next = from;
  try { const h = await hint.get(); next = Math.max(from, ((h.exists && +h.data().last) || 0) + 1); } catch {}
  const ids = new Array(n); let k = 0, done = 0;
  const worker = async () => {
    while (k < n){
      const i = k++;
      for (let tries = 0; tries < 400 && !ids[i]; tries++){
        const num = next++, id = `${code}-${stamp}-${String(num).padStart(4, "0")}`, ref = db.doc("samples/" + id);
        const lease = await ref.acquire({ holder: tabId, ttlMs: 4000 });
        if (!lease.acquired) continue;
        const snap = await ref.get();
        if (snap.exists && snap.data()?.id) continue;
        await ref.set(makeBody(id, i));
        ref.acquire({ holder: tabId, ttlMs: 1000 }).catch(() => {});   // let the claim lapse quickly so the lab can receive it at once
        ids[i] = id; progress?.(++done);
      }
      if (!ids[i]) throw { code: "busy" };
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, n) }, worker));
  const top = Math.max(...ids.map(x => +x.split("-").pop()));
  hint.get().then(h => { if (!(h.exists && +h.data().last >= top)) return hint.set({ last: top, day: stamp, section: code }); }).catch(() => {});
  return ids;
}
async function register(){
  const mode = $("#regForm")?.dataset.mode || "register", walk = mode === "register", lab = !walk && canEdit() && !!$("#rRecvNow")?.checked;
  if (!db){ toast("The shared register is not connected in this view."); return; }
  const btn = $("#rSubmit"), msg = $("#rMsg");
  const fail = (m, focus) => { toast(m); const el = focus && $(focus); if (el){ const d = el.closest("details"); if (d) d.open = true; el.focus(); } };
  const batch = formKind() === "batch", n = batch ? bRows.length : 1;
  if (batch && !(n >= 2 && n <= 100)) return fail("A batch has 2 to 100 samples. For one sample choose Single sample.", "#rCount");
  const code = val("#rSection"), tyK = val("#rType"), puK = val("#rPurpose"), teK = val("#rTest"), submitter = val("#rSubmitter");
  if (!tyK) return fail("Choose the sample type.", "#rType");
  if (!puK) return fail("Choose the assay purpose.", "#rPurpose");
  const why = puK === "other" ? val("#rWhy").slice(0, 200) : "";
  if (puK === "other" && !why) return fail("Type why the sample is being tested.", "#rWhy");
  if (!teK) return fail("Choose the test requested.", "#rTest");
  if (!submitter) return fail("Type the name of the person submitting.", "#rSubmitter");
  if (!code) return fail("Choose the submitting section.", "#rSection");
  const handTo = lab ? "" : val("#rHandTo").slice(0, 60), handBadge = lab ? "" : val("#rHandBadge").slice(0, 20), subBadge = val("#rSubBadge").slice(0, 20);
  if (walk && !handTo) return fail("Type the name of the technician you handed it to.", "#rHandTo");
  if (walk && !handBadge) return fail("Type the technician's badge number.", "#rHandBadge");
  const r = formRoute();
  if (!r || !(r.tests || []).includes(teK)) return fail("No workflow route performs this test. Ask the lab manager to add one.");
  const now = Date.now();
  const collected = $("#rCollected").value ? fromInput($("#rCollected").value) : null;
  if (collected !== null && !(collected > 0)) return fail("Check the date and time collected.", "#rCollected");
  if (collected > now + 5 * 60000) return fail("The collection time can't be in the future.", "#rCollected");
  let recvAt = null, wit = "";
  if (lab){
    recvAt = fromInput($("#rRecvAt").value);
    if (!(recvAt > 0)) return fail("Enter the date and time received.", "#rRecvAt");
    if (recvAt > now + 5 * 60000) return fail("The time received can't be in the future.", "#rRecvAt");
    if (collected && recvAt < collected) return fail("The time received can't be before the collection time.", "#rRecvAt");
    if (!$("#rWitBox").hidden && !(wit = val("#rWit"))) return fail("Two-person custody: choose the witness.", "#rWit");
  }
  const tagSets = batch ? rowTags() : [splitTags($("#rTag").value).map(normTag)], allTags = tagSets.flat(), srcs = batch ? bRows.map(r => r.src.trim().slice(0, 120)) : [];
  if (new Set(allTags).size !== allTags.length) return fail("The same site sample code appears twice in this batch.", batch ? "#rRows .r-code.dup" : "#rTag");
  const batchName = batch ? val("#rBatchName").slice(0, 80) : "";
  btn.disabled = true; msg.textContent = allTags.length ? "Checking site sample codes…" : "Issuing IDs…";
  try {
    for (const t of allTags){ const used = await tagOwner(t); if (used) throw { code: "tagused", tag: t, id: used }; }
    msg.textContent = "Issuing IDs…";
    const details = {};
    (typeOf(tyK)?.fields || []).forEach(f => { const x = ($("#rD_" + f.k)?.value || "").trim(); if (x) details[f.l] = x; });
    const rf = routeFields(r, teK), start = lab ? "received" : "submitted", startName = rf.plan.find(x => x.key === start).name;
    const containers = +$("#rContainers").value || null, massKg = +$("#rMass").value || null, seal = val("#rSeal"), siteRef = val("#rSiteRef");
    const t = typeOf(tyK), holdH = t?.hold && collected && lab ? Math.max(0, (recvAt - collected) / HOUR) : null;
    const recv = lab ? { bags: containers, mass: massKg, unit: "kg", seal: seal ? "ok" : "none", cond: "Good", temp: "", holdH, warn: holdH != null && holdH > t.hold ? [`holding time for ${t.holdWhat} exceeded: received ${hoursLabel(holdH)} after collection, limit ${hoursLabel(t.hold)}`] : [], ...(wit ? { wit } : {}) } : null;
    const base = {
      v: 13, type: t?.name || tyK, typeKey: tyK, purpose: why ? `Other: ${why}` : purposeOf(puK)?.name || puK, purposeKey: puK, ...(why ? { purposeWhy: why } : {}), ...(handTo ? { handedTo: handTo } : {}), ...(handBadge ? { handedBadge: handBadge } : {}), ...rf, details, reassays: 0,
      submitter, ...(subBadge ? { subBadge } : {}), section: code, receivedBy: lab ? session.name : "", receivedAt: recvAt, recvAt, recv,
      source: val("#rSource"), collectedAt: collected, containers, massKg, seal, priority: $("#rPriority").value,
      hazards: HAZARDS.filter(h => $("#rHz_" + h.k)?.checked).map(h => h.k),
      analyses: ADDONS.filter((_, i) => $("#rAn" + i)?.checked), notes: val("#rNotes"),
      createdAt: now, createdBy: lab ? session.u : "public", createdByName: lab ? session.name : submitter, updatedAt: now, stageKey: start, stageAt: lab ? recvAt : now, location: "", flag: "",
      open: true, onHand: lab, lab: true, ...(lab ? { sx: 1 } : {}), ...(walk ? { via: "walkin" } : {}), batchKey: n > 1 ? `${code}-${now.toString(36)}-${tabId.slice(0, 4)}` : "", batchSize: n, ...(batchName ? { batchName } : {})
    };
    const stamp = dayStamp(lab ? recvAt : now);
    const make = (id, i, batchId) => {
      const body = { ...base, id, batchIndex: i + 1, tags: tagSets[i], tagNo: tagSets[i].join(", "), ...(batchId ? { batchId } : {}), ...(srcs[i] ? { source: srcs[i] } : {}),
        siteRef: n > 1 && siteRef ? `${siteRef}-${i + 1}` : siteRef, siteRefU: normTag(n > 1 && siteRef ? `${siteRef}-${i + 1}` : siteRef),
        history: [lab ? { key: start, sn: startName, at: recvAt, by: session.u, tech: session.name, note: `Received and registered at the lab; route ${r.code}`, ref: "", ...(wit ? { wit } : {}) }
                      : { key: start, sn: startName, at: now, by: "public", name: submitter, note: walk ? "Registered at the lab (walk-in)" : "Submitted through the submission form", ref: "", ...(handTo ? { hand: handTo } : {}), ...(handBadge ? { badge: handBadge } : {}) }] };
      if (lab){ body.inMid = `${id}~in`; body.ledgerPending = [inMove(body, recvAt, recv, "Registered at the lab", wit)]; body.lp = true; }
      return body;
    };
    // A batch's reference is B- and its first ID, so the first sample is claimed on its own, then the rest carry the reference.
    const [first] = await claimIds(code, stamp, 1, id => make(id, 0, n > 1 ? "B-" + id : ""));
    const ref = n > 1 ? "B-" + first : "";
    msg.textContent = n > 1 ? `Saved 1 of ${n}…` : "";
    const ids = n > 1 ? [first, ...await claimIds(code, stamp, n - 1, (id, i) => make(id, i + 1, ref), d => msg.textContent = `Saved ${d + 1} of ${n}…`, +first.split("-").pop() + 1)] : [first];
    ids.forEach((id, i) => tagSets[i].forEach(tg => db.doc("tagidx/" + tagKey(tg)).set({ sid: id, tag: tg, at: now }).catch(() => {})));
    if (lab) ids.forEach(id => { flushLedger(id); syncStock(id); });
    msg.textContent = "";
    $("#rResult").innerHTML = `<div class="notice"><b>${n === 1 ? (mode === "register" ? "Sample registered." : "Sample submitted.") : `${n} samples ${mode === "register" ? "registered" : "submitted"}.`}</b>${ref ? ` Batch <b class="mono">${esc(ref)}</b>${batchName ? ` · ${esc(batchName)}` : ""}.` : ""} Write ${n === 1 ? "this ID" : "these IDs"} on the sample bag${n === 1 ? "" : "s"}, or print the label${n === 1 ? "" : "s"}${lab ? "" : walk ? ". It shows “Awaiting receipt” until a lab technician confirms it" : ", then bring or send the sample to the Assay Lab. Its status shows “Awaiting receipt” until a lab technician confirms it has arrived"}:
      <div class="label-strip" style="margin-top:8px">${ids.map((id, i) => `<code>${esc(id)}${tagSets[i].length ? ` · ${esc(tagSets[i].join(", "))}` : ""}</code>`).join("")}</div>
      <div class="small" style="margin-top:8px">Workflow: <span class="code">${esc(r.code)}</span> ${esc(r.name)}. Results about ${hoursLabel(routeTat(r))} after the lab receives ${n === 1 ? "it" : "them"} (an estimate).</div>
      <div class="row" style="margin-top:10px"><button type="button" class="btn primary" id="rLabels">Print ${n === 1 ? "label" : n + " labels"}</button><button type="button" class="btn" id="rCopy">Copy IDs</button>${n === 1 ? `<button type="button" class="btn" data-link="${esc(ids[0])}">Copy tracking link</button><button type="button" class="btn" data-open="${esc(ids[0])}">Track ${esc(ids[0])}</button>` : `<button type="button" class="btn" data-open="${esc(ref)}">Open the batch</button><button type="button" class="btn" data-link="${esc(ref)}">Copy batch link</button>`}<button type="button" class="btn" id="rSame">Same details again</button><button type="button" class="btn ghost" id="rAgain">${mode === "register" ? "Register more" : "Submit another"}</button></div></div>`;
    const same = formSnap();
    noteIssued(ids, ref, base, tagSets);
    const labels = ids.map((id, i) => labelOf({ ...base, id, tags: tagSets[i] }));
    if (batch){ bRows = bRows.map(() => ({ code: "", src: "" })); }
    $("#rLabels").onclick = () => showLabels(labels);
    $("#rCopy").onclick = () => navigator.clipboard.writeText(ids.join("\n")).then(() => toast("IDs copied"), () => toast("Copy blocked here. Select the IDs and copy them."));
    $("#rAgain").onclick = () => { $(mode === "register" ? "#view-register" : "#view-submit").innerHTML = ""; renderSampleForm(mode); };
    $("#rSame").onclick = () => { $(mode === "register" ? "#view-register" : "#view-submit").innerHTML = ""; renderSampleForm(mode); applySnap(same); };
    btn.disabled = true;
  } catch (e) {
    btn.disabled = false; msg.textContent = "";
    if (e && e.code === "tagused") toast(`Site sample code ${e.tag} is already on open sample ${e.id}. Use another code, or leave it blank.`);
    else if (e && e.code === "busy") toast("Could not issue an ID. Try again in a moment.");
    else writeFailed(e);
  }
}

/* ---------- ledger (19.2): one subscription per month, built from movement records ---------- */
let ledgerFilter = { dir: "all", month: "", q: "", sec: "" };
let ledgerSub = null, reconSub = null, ledgerSubMonth = "", ledgerDocs = [], ledgerReady = false, recon = null, reconStock = null;
const monthEnd = m => { const [y, mo] = m.split("-").map(Number); return monthStart(`${mo === 12 ? y + 1 : y}-${String(mo === 12 ? 1 : mo + 1).padStart(2, "0")}`); };
function ledgerWatch(){
  if (!ledgerFilter.month) ledgerFilter.month = monthKey(Date.now());
  if (!db || ledgerSubMonth === ledgerFilter.month) return;
  if (ledgerSub) ledgerSub();
  if (reconSub) reconSub();
  ledgerSubMonth = ledgerFilter.month; ledgerDocs = []; ledgerReady = false; recon = null; reconStock = null;
  const m = ledgerSubMonth;
  ledgerSub = db.collection("ledger").where("month", "==", m).onSnapshot(snap => {
    if (m !== ledgerSubMonth) return;
    ledgerDocs = snap.docs.map(d => d.data()); ledgerReady = true;
    computeRecon(m);
    if (tab === "ledger") renderLedger();
  }, () => { ledgerReady = true; if (tab === "ledger") renderLedger(); });
  // Stock records of samples on hand at some time in the month: those on hand at its start plus those received in it.
  reconSub = db.collection("stock").where("recvAt", "<", monthEnd(m)).where("gone", ">=", monthStart(m)).onSnapshot(snap => {
    if (m !== ledgerSubMonth) return;
    reconStock = snap.docs.map(d => d.data()).filter(x => x && x.id);
    const was = JSON.stringify(recon);
    computeRecon(m);
    if (tab === "ledger" && JSON.stringify(recon) !== was) renderLedger();   // stock records change often; the view only when the counts do
  }, () => {});
}
function ledgerRows(){
  const rows = [];
  for (const d of ledgerDocs) for (const m of Object.values(d.m || {})) rows.push({ ...m });   // snapshots are frozen: work on copies
  const reversed = new Set(rows.filter(r => r.dir === "rev").map(r => r.rev));
  const byMid = Object.fromEntries(rows.map(r => [r.mid, r]));
  rows.forEach(r => { r.reversed = reversed.has(r.mid); r.base = r.dir === "rev" ? (byMid[r.rev]?.dir || "out") : r.dir; });
  return rows.sort((a, b) => b.at - a.at || (a.mid < b.mid ? 1 : -1));
}
/* Month reconciliation: on hand at the start + received − fully out = on hand at the end, from the samples' stock records; the receipts
   are counted from the ledger itself, so a missing movement shows as a difference. */
function computeRecon(m){
  if (!reconStock || !ledgerReady){ recon = null; return; }
  const start = monthStart(m), end = monthEnd(m);
  const opening = reconStock.filter(x => x.recvAt < start).length;
  const ins = new Set(ledgerRows().filter(r => r.dir === "in" && !r.reversed).map(r => r.sid)).size;
  const outs = reconStock.filter(x => x.gone < end).length;
  recon = { m, opening, ins, outs, closing: opening + ins - outs, now: m === monthKey(Date.now()) ? reconStock.filter(x => x.gone === OPEN_T).length : null };
}
function renderLedger(){
  const v = $("#view-ledger");
  ledgerWatch(); watchStore();
  const redoFor = sid => canEdit() && (samples.has(sid) ? redoOk(samples.get(sid)) : stored.has(sid));
  const shownRedo = new Set(), shownQa = new Set();
  const f = ledgerFilter;
  let rows = ledgerRows();
  if (f.dir !== "all") rows = rows.filter(r => r.base === f.dir);
  if (f.sec) rows = rows.filter(r => r.sec === f.sec);
  if (f.q){ const q = f.q.toLowerCase(); rows = rows.filter(r => [r.sid, r.type, r.sub, r.tag, r.tech, r.wit, r.ref, r.note, r.item, r.route].join(" ").toLowerCase().includes(q)); }
  const body = rows.map(r => `<tr class="${r.reversed ? "reversed" : ""}">
    <td style="white-space:nowrap">${fmtFull(r.at)}</td>
    <td class="${r.dir === "in" ? "dir-in" : r.dir === "rev" ? "dir-rev" : "dir-out"}">${r.dir === "in" ? "IN" : r.dir === "rev" ? "REV" : "OUT"}${r.reversed ? `<div><span class="pill warn">Reversed</span></div>` : ""}</td>
    <td><button class="linkish" data-open="${esc(r.sid)}">${esc(r.sid)}</button>${!shownQa.has(r.sid) && shownQa.add(r.sid) ? qaOfNote(r.sid) + qaPickBox(r.sid) : ""}${!shownRedo.has(r.sid) && redoFor(r.sid) && shownRedo.add(r.sid) ? `<div><button type="button" class="btn ghost small reassay-btn" data-reassay="${esc(r.sid)}">Re-assay</button></div>` : ""}</td>
    <td class="mono">${esc(r.tag) || "—"}</td>
    <td>${esc(r.type)}${r.route ? `<div class="small mono" style="color:var(--accent)">${esc(r.route)}</div>` : ""}</td>
    <td>${esc(r.item || "")}${r.qty ? `<div class="small muted">${esc(r.qty)}</div>` : ""}</td>
    <td class="mono">${esc(r.sec || "")}</td>
    <td>${r.dir === "in" ? esc(r.from || "Mine site") : r.dir === "rev" ? "Reversal of an earlier movement" : esc(DISPO[r.kind] || r.kind || "")}</td>
    <td>${esc(r.ref) || "—"}</td>
    <td>${r.dir === "in" ? esc(r.sub) : "—"}</td>
    <td>${esc(r.tech) || who(r.by)}${r.wit ? `<div class="small muted">Witness: ${esc(r.wit)}</div>` : ""}</td>
    <td>${esc(r.note) || ""}</td></tr>`).join("");
  const act = rows.filter(r => !r.reversed && r.dir !== "rev"), inN = act.filter(r => r.dir === "in").length, outN = act.filter(r => r.dir === "out").length, revN = rows.filter(r => r.dir === "rev").length;
  const rc = recon && recon.m === f.month ? recon : null;
  keepUiSimple(v, () => {
    v.innerHTML = `<div class="stack">
      ${qaSlot()}
      <div class="row">
        <input class="inp" id="lgMonth" type="month" style="width:auto" value="${esc(f.month)}" aria-label="Month">
        <select class="inp" id="lgDir" style="width:auto"><option value="all">In and out</option><option value="in">Inbound only</option><option value="out">Outbound only</option></select>
        <select class="inp" id="lgSec" style="width:auto"><option value="">All sections</option>${(cfg.sections || []).map(x => `<option value="${esc(x.code)}" ${f.sec === x.code ? "selected" : ""}>${esc(x.code)} · ${esc(x.name)}</option>`).join("")}</select>
        <input class="inp" id="lgQ" placeholder="Search ID, site code, type, submitter, technician" style="flex:1 1 220px;width:auto" value="${esc(f.q)}">
        <button class="btn" id="lgCsv">Export CSV</button>
      </div>
      ${rc ? `<div class="recon"><b>Month check:</b> ${rc.opening} on hand at the start + ${rc.ins} received − ${rc.outs} fully out = <b>${rc.closing}</b> on hand at the end${rc.now != null ? (rc.now === rc.closing ? ` <span class="pill ok">matches the ${rc.now} on hand now</span>` : ` <span class="pill bad">${rc.now} on hand now: check for missing movements</span>`) : ""}.</div>` : ""}
      <p class="small muted" style="margin:0">${inN} inbound and ${outN} outbound movement${outN === 1 ? "" : "s"}${revN ? `, ${revN} reversal${revN === 1 ? "" : "s"}` : ""} in ${esc(f.month)}. A sample is written in once, when the lab receives it. Each retained material is written out when it is returned, disposed, sent to another lab or archived. Mistakes are reversed with a visible entry, never deleted. Times are ${esc(TZ() || "this device's")} time.</p>
      ${!ledgerReady && db ? `<div class="panel empty"><strong>Loading ${esc(f.month)}…</strong></div>` : rows.length ? `<div class="tbl-wrap"><table class="cardy"><thead><tr><th>Date &amp; time</th><th>Dir.</th><th>Sample ID</th><th>Site code</th><th>Type</th><th>Material</th><th>Section</th><th>From / to</th><th>Reference</th><th>Submitted by</th><th>Lab staff</th><th>Note</th></tr></thead><tbody>${body}</tbody></table></div>`
        : `<div class="panel empty"><strong>No ledger entries${f.dir !== "all" || f.q || f.sec ? " match these filters" : ` in ${esc(f.month)}`}</strong>Entries appear when samples are received at the lab or leave it.</div>`}
    </div>`;
  });
  $("#lgDir").value = f.dir;
  $("#lgDir").onchange = e => { f.dir = e.target.value; renderLedger(); };
  $("#lgSec").onchange = e => { f.sec = e.target.value; renderLedger(); };
  $("#lgMonth").onchange = e => { if (/^\d{4}-\d{2}$/.test(e.target.value)){ f.month = e.target.value; ledgerWatch(); renderLedger(); } };
  $("#lgQ").oninput = e => { f.q = e.target.value; clearTimeout(renderLedger.t); renderLedger.t = setTimeout(renderLedger, 250); };
  $("#lgCsv").onclick = () => exportCsv(rows);
  fillNames(v);
}
/* Keeps focus and caret in place when a list view re-draws (the ledger search box, for example). */
function keepUiSimple(v, build){
  const a = document.activeElement, fid = a && v.contains(a) && a.id ? a.id : "", caret = fid && typeof a.selectionStart === "number" ? [a.selectionStart, a.selectionEnd] : null;
  build();
  if (fid){ const el = document.getElementById(fid); if (el){ el.focus({ preventScroll: true }); if (caret) try { el.setSelectionRange(...caret); } catch {} } }
}
async function exportCsv(rows){
  const dl = window.claude?.use ? await claude.use("downloads") : null;
  if (!dl){ toast("Downloads are not available in this view."); return; }
  const q = x => `"${String(x ?? "").replace(/"/g, '""')}"`;
  const head = ["Date time (site)", "Direction", "Reversed", "Sample ID", "Site sample code", "Section", "Type", "Route", "Material", "Quantity", "From / to", "Reference", "Submitted by", "Lab staff", "Witness", "Note", "Movement ID"];
  const lines = rows.map(r => [fmtFull(r.at), r.dir.toUpperCase(), r.reversed ? "yes" : "", r.sid, r.tag, r.sec, r.type, r.route, r.item, r.qty,
    r.dir === "in" ? r.from : r.dir === "rev" ? "Reversal" : DISPO[r.kind] || r.kind, r.ref, r.dir === "in" ? r.sub : "", r.tech, r.wit, r.note, r.mid].map(q).join(","));
  try { await dl.save({ filename: `sample-ledger-${ledgerFilter.month}.csv`, data: [head.map(q).join(","), ...lines].join("\n") }); }
  catch { toast("Download was not saved."); }
}
