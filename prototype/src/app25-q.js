/* ---------- v24c: scan a bag label, receive several at once, the monthly ledger sign-off, a witness for disposal, turnaround ---------- */

/* ----- Scan: the camera reads the label's QR code (its tracking link) or a barcode; a handheld scanner types into the box. ----- */
const JSQR_SRC = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";   // only fetched where the browser can't read codes itself
let jsqrP = null;
const loadJsQR = () => jsqrP || (jsqrP = new Promise((ok, no) => {
  if (window.jsQR) return ok(window.jsQR);
  const sc = document.createElement("script"); sc.src = JSQR_SRC; sc.async = true;
  sc.onload = () => window.jsQR ? ok(window.jsQR) : no(new Error("no reader"));
  sc.onerror = () => { jsqrP = null; no(new Error("not loaded")); };
  document.head.appendChild(sc);
}));
/* What a scanned code points at: a tracking link (…#ID), or the code itself (a sample ID, batch reference or site sample code). */
function scanTarget(text){
  let t = String(text || "").trim(); if (!t) return "";
  if (/^https?:\/\//i.test(t)){
    const h = t.indexOf("#");
    if (h >= 0) t = t.slice(h + 1);
    else { try { const u = new URL(t); t = u.searchParams.get("id") || u.searchParams.get("s") || ""; } catch { t = ""; } }
  }
  try { t = decodeURIComponent(t); } catch {}
  return t.trim().slice(0, 80);
}
let scanState = null;
/* The scanner window. onCode(code) is called once per code read (the same code is ignored for 2.5 s); with multi it stays open and
   lists what each code did ({ ok, msg }), otherwise it closes on the first code. */
function openScanner({ title, hint = "", onCode, multi = false, onClose = null }){
  closeScanner();
  const box = document.createElement("div");
  box.className = "modal"; box.id = "scanBox"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-label", title);
  box.innerHTML = `<div class="modal-card stack scan-card">
    <div class="row"><h3 style="margin:0">${esc(title)}</h3><span class="grow"></span><button type="button" class="btn${multi ? " primary" : " ghost"} small" id="scanClose">${multi ? "Done" : "Close"}</button></div>
    <div class="scan-view"><video id="scanVideo" playsinline muted></video><div class="scan-frame" aria-hidden="true"></div></div>
    <div class="small muted" id="scanStatus">Starting the camera (allow it if the browser asks)…</div>
    <form class="row" id="scanForm" autocomplete="off" style="gap:8px"><input class="inp" id="scanInput" placeholder="Or type the ID, or scan with a handheld scanner" style="flex:1 1 220px;width:auto" aria-label="Sample ID or label code"><button class="btn" type="submit">${multi ? "Add" : "Open"}</button></form>
    ${multi ? `<ul class="scan-log" id="scanLog" aria-live="polite"></ul>` : ""}
    ${hint ? `<div class="small muted">${esc(hint)}</div>` : ""}
  </div>`;
  document.body.appendChild(box);
  const st = scanState = { box, stream: null, timer: 0, last: "", lastAt: 0, multi, alive: true, onClose };
  const status = t => { const e = $("#scanStatus", box); if (e) e.textContent = t; };
  const hit = raw => {
    const id = scanTarget(raw); if (!id || !st.alive) return;
    const now = Date.now(); if (id === st.last && now - st.lastAt < 2500) return;
    st.last = id; st.lastAt = now;
    const r = onCode(id) || {};
    if (!multi){ closeScanner(); return; }
    const li = document.createElement("li"); li.className = r.ok ? "ok" : "warn"; li.textContent = r.msg || id;
    $("#scanLog", box)?.prepend(li);
    try { navigator.vibrate?.(r.ok ? 60 : [40, 60, 40]); } catch {}
  };
  $("#scanClose", box).onclick = closeScanner;
  box.addEventListener("click", e => { if (e.target === box) closeScanner(); });
  $("#scanForm", box).onsubmit = e => { e.preventDefault(); const i = $("#scanInput", box); st.last = ""; hit(i.value); if (scanState === st){ i.value = ""; i.focus(); } };
  $("#scanInput", box).focus();
  startCamera(st, status, hit);
  return st;
}
async function startCamera(st, status, hit){
  const noCam = msg => { status(msg); $(".scan-view", st.box)?.remove(); };
  if (!navigator.mediaDevices?.getUserMedia) return noCam("No camera here: type the ID, or use a handheld scanner.");
  try { st.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false }); }
  catch { return noCam("The camera is not available (none, or not allowed). Type the ID, or use a handheld scanner."); }
  if (!st.alive){ st.stream.getTracks().forEach(t => t.stop()); return; }
  const v = $("#scanVideo", st.box); v.srcObject = st.stream;
  try { await v.play(); } catch {}
  let detect = null;
  if ("BarcodeDetector" in window){
    try { const bd = new BarcodeDetector({ formats: ["qr_code", "code_128", "code_39", "data_matrix"] }); await bd.detect(v); detect = async () => (await bd.detect(v))[0]?.rawValue || ""; } catch { detect = null; }
  }
  if (!detect){
    try {
      const jsQR = await loadJsQR(), c = document.createElement("canvas"), g = c.getContext("2d", { willReadFrequently: true });
      detect = async () => {
        const w = v.videoWidth, h = v.videoHeight; if (!w || !h) return "";
        const k = Math.min(1, 720 / Math.max(w, h)); c.width = Math.round(w * k); c.height = Math.round(h * k);
        g.drawImage(v, 0, 0, c.width, c.height);
        return jsQR(g.getImageData(0, 0, c.width, c.height).data, c.width, c.height, { inversionAttempts: "attemptBoth" })?.data || "";
      };
    } catch { status("The camera is on, but this browser can't read the code. Type the ID instead."); return; }
  }
  if (!st.alive) return;
  status(st.multi ? "Hold each bag's label in the frame." : "Hold the bag's label in the frame.");
  const tick = async () => { if (!st.alive) return; try { const t = await detect(); if (t) hit(t); } catch {} if (st.alive) st.timer = setTimeout(tick, 200); };
  tick();
}
function closeScanner(){
  const st = scanState; if (!st) return;
  st.alive = false; clearTimeout(st.timer); st.stream?.getTracks().forEach(t => t.stop()); st.box.remove(); scanState = null;
  if (st.onClose) st.onClose();
}
document.addEventListener("keydown", e => { if (e.key === "Escape" && scanState) closeScanner(); });
/* The Scan button beside Track sample: opens what the label points at; a sample waiting for receipt opens at its receipt form. */
function scanToOpen(){
  openScanner({ title: "Scan a bag label", hint: "The label's QR code holds the sample's tracking link.", onCode: id => {
    openSample(id);
    const t0 = Date.now(), want = id.toUpperCase();
    const poll = () => {
      const s = current?.body;
      if (s && (s.id === want || s.id === id) && tab === "track"){
        if (grouped(s) && awaiting(s) && canEdit()){ openSample(s.batchId); return; }   // v24d: a bag of a batch: the batch is received as one
        const f = $("#moveForm"); if (f && awaiting(s) && canEdit()){ f.scrollIntoView({ block: "start", behavior: "smooth" }); setTimeout(() => $("#rcMass")?.focus({ preventScroll: true }), 300); }
        return;
      }
      if (Date.now() - t0 < 4000) setTimeout(poll, 150);
    };
    poll();
    return { ok: true };
  } });
}
(() => {
  const f = $("#lookupForm"); if (!f || $("#scanBtn")) return;
  const b = document.createElement("button");
  b.type = "button"; b.className = "btn big scan-btn"; b.id = "scanBtn"; b.title = "Scan a bag label"; b.setAttribute("aria-label", "Scan a bag label");
  b.innerHTML = `<span class="lk-t">Scan</span>`;
  f.insertBefore(b, f.querySelector('button[type="submit"]'));
  b.addEventListener("click", scanToOpen);
})();

/* ----- Receive several at once: the same write as a batch receipt (no cooler check, no mass), for the samples ticked. ----- */
async function receiveMany(sids, at, wit, noteFor, temp = ""){
  return pool(sids, 5, sid => sampleWrite(sid, s => {
    if (!awaiting(s)) return null;
    const t = typeOf(s.typeKey), w = twoPerson(s) ? wit : "", when = Math.max(at, (s.createdAt || 0) + 1000), warn = [];
    if (t?.cool != null && temp === "") return null;   // a cooler sample needs its temperature (v24d: one reading for a batch's cooler)
    const tp = t?.cool != null ? String(temp) : "";
    if (tp !== "" && +tp > t.cool) warn.push(`cooler at ${tp} °C, above the ${t.cool} °C limit`);
    let holdH = null;
    if (t?.hold && s.collectedAt){ holdH = Math.max(0, (when - s.collectedAt) / HOUR); if (holdH > t.hold) warn.push(`holding time for ${t.holdWhat} exceeded: received ${hoursLabel(holdH)} after collection, limit ${hoursLabel(t.hold)}`); }
    const recv = { bags: s.containers || 1, mass: null, unit: massUnit(s), seal: s.seal ? "ok" : "none", cond: "Good", temp: tp, holdH, warn, ...(w ? { wit: w } : {}) };
    const note = noteFor(s) + (warn.length ? ". Receipt checks: " + warn.join("; ") : "");
    return { upd: { stageKey: "received", stageAt: when, receivedBy: session.name, receivedAt: when, recvAt: when, recv, onHand: true, flag: "", inMid: `${s.id}~in`,
        history: [...(s.history || []), { key: "received", sn: HEAD[1].name, at: when, by: session.u, tech: session.name, ref: "", note, ...(w ? { wit: w } : {}) }] },
      moves: [inMove(s, when, recv, note, w)] };
  }));
}
const rmSel = new Set();
let rmList = [], rmAt = "", rmWit = "", rmOk = false, rmBusy = false;
const coolOf = s => typeOf(s.typeKey)?.cool != null;
/* The Awaiting receipt list on the board, with ticks and one receipt for the ticked samples (lab staff). */
/* v24d: a batch processed as one is one row and one tick (all its bags); one with a cooler sample is received on the batch page (one
   cooler temperature for the batch). */
const rmUnits = list => { const out = [], seen = new Map(); for (const s of list){ if (!grouped(s)){ out.push({ s, ms: [s] }); continue; } const g = seen.get(s.batchId); if (g) g.ms.push(s); else { const u = { s, ref: s.batchId, ms: [s] }; seen.set(s.batchId, u); out.push(u); } } return out; };
const rmCool = u => u.ms.some(coolOf);
function recvManyPanel(cur){
  rmList = cur.pick || [];
  const units = rmUnits(rmList), ids = new Set(units.filter(u => !rmCool(u)).flatMap(u => u.ms.map(s => s.id)));
  [...rmSel].forEach(id => { if (!ids.has(id)) rmSel.delete(id); });
  const tickedU = units.filter(u => !rmCool(u) && u.ms.every(s => rmSel.has(s.id))), two = tickedU.some(u => u.ms.some(twoPerson)), n = tickedU.length;
  const row = u => { const s = u.s;
    return `<tr><td>${rmCool(u) ? (u.ref ? `<button type="button" class="linkish small" data-open="${esc(u.ref)}" title="Cooler temperature: one reading for the batch">on the batch page</button>` : `<span class="small muted" title="Cooler temperature: receive it on its own record">one by one</span>`) : `<input type="checkbox" ${u.ref ? `data-rmb="${esc(u.ref)}"` : `data-rm="${esc(s.id)}"`} ${u.ms.every(x => rmSel.has(x.id)) ? "checked" : ""} aria-label="Tick ${esc(u.ref || s.id)}">`}</td>
    <td>${u.ref ? `<button type="button" class="linkish mono" data-open="${esc(u.ref)}">${esc(u.ref)}</button><div class="small"><b>Batch of ${nS(u.ms.length)}</b>${s.batchName ? ` · ${esc(s.batchName)}` : ""}</div>` : `<button type="button" class="linkish mono" data-open="${esc(s.id)}">${esc(s.id)}</button>${ownCode(s) ? `<div class="small muted mono">${esc(ownCode(s))}</div>` : ""}`}</td>
    <td>${esc(s.type || "")}${twoPerson(s) ? ` <span class="haz two" title="Two-person custody">2P</span>` : ""}</td><td>${esc([testOf(s.test)?.name, s.route].filter(Boolean).join(" · "))}</td>
    <td>${esc(fmt(s.createdAt))}${s.handedTo ? `<div class="small muted">Handed to ${esc(s.handedTo)}</div>` : ""}</td></tr>`; };
  return `<div class="panel pick-list stack" id="bdPick">
    <div class="pick-note"><span>Showing <b>${esc(cur.l)}</b>: ${cur.n}</span><span class="grow"></span><button type="button" class="btn ghost small" data-bpick="${cur.k}">Close</button></div>
    <div class="tbl-wrap"><table class="cardy"><thead><tr><th><input type="checkbox" id="rmAll" aria-label="Tick all" ${ids.size && n === ids.size ? "checked" : ""}></th><th>Sample</th><th>Type</th><th>Analysis · route</th><th>Submitted</th></tr></thead><tbody>${units.slice(0, 100).map(row).join("")}</tbody></table></div>
    <div class="recv-many stack" id="rmBox">
      <div class="form">${meBox("Received by")}
        <label class="f"><span>Date &amp; time received</span><input id="rmAt" type="datetime-local" value="${esc(rmAt || localInput(Date.now()))}"></label>
        ${two ? witnessField("rmWit") : ""}
        <label class="recv-toggle full"><input type="checkbox" id="rmOk" ${rmOk ? "checked" : ""}> The ticked bags match their submissions, seals intact, good condition</label></div>
      <div class="row" style="gap:8px"><button type="button" class="btn primary" id="rmBtn" ${n && !rmBusy ? "" : "disabled"}>${rmBusy ? "Receiving…" : `Receive ${n} ticked`}</button><button type="button" class="btn" id="rmScan">Scan bags</button><span class="small muted">Tick the bags in front of you, or scan their labels. A bag with a problem: open it and flag it.</span></div>
    </div>
    <div class="small muted">The lanes below show only these samples.</div></div>`;
}
function bindRecvMany(v){
  const box = $("#bdPick", v); if (!box || !$("#rmBox", box)) return;
  box.querySelectorAll("[data-rm]").forEach(c => c.onchange = () => { c.checked ? rmSel.add(c.dataset.rm) : rmSel.delete(c.dataset.rm); renderBoard(); });
  box.querySelectorAll("[data-rmb]").forEach(c => c.onchange = () => { rmList.filter(s => grouped(s) && s.batchId === c.dataset.rmb).forEach(s => c.checked ? rmSel.add(s.id) : rmSel.delete(s.id)); renderBoard(); });
  $("#rmAll", box).onchange = e => { rmUnits(rmList).filter(u => !rmCool(u)).flatMap(u => u.ms).forEach(s => e.target.checked ? rmSel.add(s.id) : rmSel.delete(s.id)); renderBoard(); };
  $("#rmAt", box).onchange = e => { rmAt = e.target.value; };
  $("#rmOk", box).onchange = e => { rmOk = e.target.checked; };
  const w = $("#rmWit", box); if (w){ if (rmWit) w.value = rmWit; w.onchange = () => { rmWit = w.value; }; }
  $("#rmBtn", box).onclick = receiveTicked;
  $("#rmScan", box).onclick = () => openScanner({ title: "Scan the bags", multi: true, hint: "Each bag scanned is ticked on the Awaiting receipt list. Press Done, then receive them.", onClose: () => renderBoard(),
    onCode: code => {
      const c = code.toUpperCase(), found = rmList.filter(s => s.id === c || s.batchId === c || (s.tags || []).some(t => String(t).toUpperCase() === c));
      if (!found.length) return { ok: false, msg: `${code}: not waiting for receipt (or hidden by the board's filters)` };
      // a bag of a batch processed as one ticks its batch (v24d)
      const us = rmUnits(rmList).filter(u => u.ms.some(s => found.includes(s))), cool = us.filter(rmCool), ok = us.filter(u => !rmCool(u));
      ok.forEach(u => u.ms.forEach(s => rmSel.add(s.id)));
      return ok.length ? { ok: true, msg: ok.map(u => u.ref ? `batch ${u.ref} (${nS(u.ms.length)}) ticked` : `${u.s.id} ticked`).join("; ") } : { ok: false, msg: cool[0].ref ? `${cool[0].ref}: needs its cooler temperature, receive the batch on its page` : `${cool[0].s.id}: needs its cooler temperature, receive it on its own record` };
    } });
}
async function receiveTicked(){
  if (!canEdit() || rmBusy) return;
  const ids = rmList.filter(s => rmSel.has(s.id) && !coolOf(s)).map(s => s.id); if (!ids.length) return;
  const at = fromInput($("#rmAt")?.value || "") || Date.now(), docs = rmList.filter(s => ids.includes(s.id));
  if (!$("#rmOk")?.checked){ toast("Tick that the bags match, seals are intact and in good condition, or receive a bag with a problem on its own record."); $("#rmOk")?.focus(); return; }
  const err = docs.map(s => receiptTimeError(s, at)).find(Boolean); if (err){ toast(err); $("#rmAt")?.focus(); return; }
  const wit = $("#rmWit") ? val("#rmWit") : "";
  if ($("#rmWit") && !wit){ toast("Two-person custody: choose the witness first."); $("#rmWit")?.focus(); return; }
  rmBusy = true; renderBoard();
  const ok = await receiveMany(ids, at, wit, s => grouped(s) ? `Received with batch ${s.batchId}` : "Received with others from the board");
  rmBusy = false; rmSel.clear(); rmOk = false; rmAt = ""; rmWit = "";
  toast(`${ok} of ${ids.length} received`);
  renderBoard();
}

/* ----- Disposal needs a second person (v24c): a witness who is not the person recording it. ----- */
function disposalWitness(id){
  const w = val(id);
  if (!w){ toast("Disposal needs a second person: choose the witness first."); $(id)?.focus(); return null; }
  if (w === session?.name){ toast("The witness must be someone other than you."); $(id)?.focus(); return null; }
  return w;
}

/* ----- Monthly ledger sign-off (v24c): signoff/<YYYY-MM> keeps each sign-off with the month's numbers at that moment. ----- */
let signSub = null, signMonth = "", signDoc = null, signNote = "";
function watchSignoff(m){
  if (!db || signMonth === m) return;
  if (signSub) signSub();
  signMonth = m; signDoc = null;
  signSub = db.doc("signoff/" + m).onSnapshot(d => { if (m !== signMonth) return; signDoc = d.exists ? d.data() : null; if (tab === "ledger") renderLedger(); }, () => {});
}
const lastSign = () => (signDoc?.signs || []).at(-1) || null;
const signNums = rc => ({ opening: rc.opening, ins: rc.ins, outs: rc.outs, closing: rc.closing });
const sameNums = (a, b) => ["opening", "ins", "outs", "closing"].every(k => a[k] === b[k]);
function signoffHtml(rc, revN){
  if (!rc) return "";
  const s = lastSign(), m = rc.m, future = m > monthKey(Date.now()), cur = m === monthKey(Date.now());
  const changed = s && !sameNums(s, signNums(rc)), approve = canApprove() && !future;
  return `<div class="signoff ${s ? (changed ? "changed" : "done") : ""}" id="lgSign">
    ${s ? `<div><b>Signed off</b> by ${esc(s.tech)} on ${esc(fmt(s.at))}: ${s.opening} + ${s.ins} − ${s.outs} = <b>${s.closing}</b> on hand${s.note ? ` · ${esc(s.note)}` : ""}.${changed ? ` <span class="pill warn">The month changed after sign-off</span>` : ""}</div>` : `<div><b>Not signed off</b>${cur ? " (the month is not over yet)" : ""}.</div>`}
    <div class="row" style="gap:8px">
      <button type="button" class="btn small" id="lgSummary">Month summary</button>
      ${approve && (!s || changed) ? `<input class="inp" id="lgSignNote" placeholder="Note (optional)" value="${esc(signNote)}" style="flex:1 1 180px;width:auto"><button type="button" class="btn primary small" id="lgSignBtn">${s ? "Sign off again" : `Sign off ${esc(m)}`}</button>` : ""}
    </div></div>`;
}
async function signOffMonth(rc, revN){
  if (!canApprove() || !rc) return;
  const m = rc.m, e = { at: Date.now(), by: session.u, tech: session.name, role: session.role, ...signNums(rc), rev: revN, note: val("#lgSignNote").slice(0, 200) };
  const ref = db.doc("signoff/" + m);
  try {
    const cur = await ref.get();
    if (cur.exists) await ref.update({ signs: [...(cur.data().signs || []), e] });
    else await ref.set({ id: m, month: m, signs: [e] });
    signNote = ""; toast(`${m} signed off`);
  } catch (err){ toast("Not saved: " + (err?.message || "try again")); }
}
/* One page for the month, to print or keep: the numbers, the sign-offs, and every movement. */
function showMonthSummary(rc, rows, revN){
  const box = $("#certBox"); if (!box || !rc) return;
  const signs = signDoc?.signs || [], act = rows.filter(r => !r.reversed && r.dir !== "rev");
  const byType = {}; act.forEach(r => { const k = r.type || "—"; byType[k] = byType[k] || { in: 0, out: 0 }; byType[k][r.dir === "in" ? "in" : "out"]++; });
  box.innerHTML = `<div class="cert-wrap"><div class="cert-bar"><b>Ledger ${esc(rc.m)}</b><span style="flex:1"></span><button type="button" class="btn" id="certPrint">Print</button><button type="button" class="btn" id="certClose">Close</button></div>
    <div class="cert month-sum">
      <div class="cert-head"><div><div class="cert-org">ZIJIN · Assay Laboratory</div><h2>In / out ledger: ${esc(rc.m)}</h2></div><div class="cert-no">Monthly summary${TZ() ? `<br><span class="small">times in ${esc(TZ())}</span>` : ""}</div></div>
      <table class="cert-facts"><tbody>
        <tr><th>On hand at the start</th><td>${rc.opening}</td></tr><tr><th>Received</th><td>${rc.ins}</td></tr><tr><th>Fully out (returned, disposed, sent on, archived)</th><td>${rc.outs}</td></tr>
        <tr><th>On hand at the end</th><td><b>${rc.closing}</b>${rc.now != null ? ` (${rc.now} on hand now${rc.now === rc.closing ? ", matches" : ": check for missing movements"})` : ""}</td></tr>
        <tr><th>Movements</th><td>${act.filter(r => r.dir === "in").length} in, ${act.filter(r => r.dir === "out").length} out${revN ? `, ${revN} reversed` : ""}</td></tr></tbody></table>
      ${Object.keys(byType).length ? `<h4>By sample type</h4><table class="cert-tbl"><thead><tr><th>Sample type</th><th>In</th><th>Out</th></tr></thead><tbody>${Object.entries(byType).sort().map(([k, x]) => `<tr><td>${esc(k)}</td><td>${x.in}</td><td>${x.out}</td></tr>`).join("")}</tbody></table>` : ""}
      <h4>Sign-off</h4>
      ${signs.length ? signs.map(s => `<div class="cert-sign"><div>Signed off by <b>${esc(s.tech)}</b>, ${esc(ROLE_SIGN[s.role] || "lab supervisor")}: ${s.opening} + ${s.ins} − ${s.outs} = ${s.closing}${s.note ? ` · ${esc(s.note)}` : ""}</div><div>${esc(fmtFull(s.at))}</div></div>`).join("") : `<div class="cert-note">Not signed off yet.</div>`}
      <h4>Movements</h4>
      <table class="cert-tbl"><thead><tr><th>Date &amp; time</th><th>Dir.</th><th>Sample</th><th>Material</th><th>From / to</th><th>By</th></tr></thead><tbody>${rows.slice().reverse().map(r => `<tr${r.reversed ? ' class="reversed"' : ""}><td>${esc(fmtFull(r.at))}</td><td>${r.dir === "in" ? "IN" : r.dir === "rev" ? "REV" : "OUT"}</td><td class="mono">${esc(r.sid)}</td><td>${esc(r.item || "")}</td><td>${esc(r.dir === "in" ? (r.from || "") : r.dir === "rev" ? "Reversal" : (DISPO[r.kind] || r.kind || ""))}</td><td>${esc(r.tech || "")}${r.wit ? ` · witness ${esc(r.wit)}` : ""}</td></tr>`).join("") || `<tr><td colspan="6">No movements.</td></tr>`}</tbody></table>
      <div class="cert-foot">Printed ${esc(fmtFull(Date.now()))}. The ledger is never edited: a mistake is reversed with a visible entry.</div>
    </div></div>`;
  box.hidden = false;
  $("#certClose").onclick = closeCert;
  box.onclick = e => { if (e.target === box) closeCert(); };
  $("#certPrint").onclick = () => { document.body.classList.add("print-cert"); try { window.print(); } catch { toast("Printing is blocked in this view."); } };
  $("#certClose").focus();
}

/* ----- Turnaround (v24c): released on time or late against the route's promise from receipt, by section and by analysis. ----- */
function promisedAt(s){
  try {
    const p = planOf(s), r = p.findIndex(x => x.key === "received"), t = targetIdx(s), recv = s.recvAt || s.receivedAt;
    if (r < 0 || !recv || t <= r) return null;
    let clock = dueFrom(recv, p[r]);
    for (let j = r + 1; j <= t; j++){ const at = p[j].clock ? clock : workStart(clock); if (j === t) return at; clock = dueFrom(at, p[j]); }
    return clock;
  } catch { return null; }
}
const median = xs => { if (!xs.length) return null; const a = xs.slice().sort((x, y) => x - y), i = a.length >> 1; return a.length % 2 ? a[i] : (a[i - 1] + a[i]) / 2; };
function tatRows(list, keyOf, nameOf){
  const g = new Map();
  for (const s of list){
    const rel = s.relAt || lastCert(s)?.at, recv = s.recvAt || s.receivedAt, due = promisedAt(s); if (!rel || !recv) continue;
    const k = keyOf(s) || "—", x = g.get(k) || { k, name: nameOf(s) || k, n: 0, late: 0, tat: [] };
    x.n++; if (due && rel > due + 60000) x.late++; x.tat.push(rel - recv); g.set(k, x);
  }
  return [...g.values()].sort((a, b) => b.n - a.n || (a.name < b.name ? -1 : 1));
}
function turnaroundPanel(list){
  const all = tatRows(list, () => "all", () => "All"), tot = all[0];
  if (!tot) return "";
  const pct = x => x.n ? Math.round((x.n - x.late) / x.n * 100) : 0;
  const tbl = (head, rows) => `<div class="tbl-wrap"><table class="cardy tat-tbl"><thead><tr><th>${head}</th><th>Released</th><th>On time</th><th>Late</th><th>On time %</th><th>Median turnaround</th></tr></thead><tbody>${rows.map(x =>
    `<tr${x.late ? ' class="late"' : ""}><td>${esc(x.name)}</td><td>${x.n}</td><td>${x.n - x.late}</td><td>${x.late ? `<b style="color:var(--bad)">${x.late}</b>` : 0}</td><td><span class="pill ${pct(x) >= 90 ? "ok" : pct(x) >= 75 ? "warn" : "bad"}">${pct(x)}%</span></td><td>${esc(dur(median(x.tat) || 0))}</td></tr>`).join("")}</tbody></table></div>`;
  return `<details class="panel more-panel tat" id="tatBox"><summary><h3 style="display:inline">Turnaround</h3><span class="pill ${pct(tot) >= 90 ? "ok" : pct(tot) >= 75 ? "warn" : "bad"}">${tot.n - tot.late} of ${tot.n} on time (${pct(tot)}%)</span><span class="small muted">median ${esc(dur(median(tot.tat) || 0))} from receipt to release</span></summary>
    <div class="stack" style="gap:10px;margin-top:10px">
      ${tbl("Section", tatRows(list, s => s.section, s => s.section ? `${s.section} · ${sectionName(s.section) || ""}`.replace(/ · $/, "") : "—"))}
      ${tbl("Analysis", tatRows(list, s => s.test || s.route, s => testOf(s.test)?.name || s.testName || s.route))}
      <div class="small muted">On time: released by the time the route promised from receipt (lab working hours count; a re-assay counts against it).</div>
    </div></details>`;
}
