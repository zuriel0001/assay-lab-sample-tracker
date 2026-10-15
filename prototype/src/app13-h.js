/* ---------- stock records: the board holds only samples in the lab; stored material is listed from small stock records ---------- */
/* Every sample write keeps two derived fields in step: `lab` (the board loads lab == true) and `sx`, set while the sample's stock record
   still has to be written. Returns true when it does; the writer then calls writeStock under the same lease. */
function derive(s, upd){
  const next = { ...s, ...upd }, lab = labOf(next);
  if (lab !== s.lab) upd.lab = lab;
  const need = !!s.sx || JSON.stringify(stockOf(s)) !== JSON.stringify(stockOf(next));
  if (need) upd.sx = 1;
  return need;
}
async function writeStock(ref, s){
  const st = stockOf(s);
  if (st) await db.doc("stock/" + s.id).set(st);
  await ref.update({ sx: null });
}
/* Finishes a stock record left unwritten (a new registration, or a device that lost its connection mid-save). */
async function syncStock(id){
  try {
    const ref = db.doc("samples/" + id), s = await leased(ref, true);
    if (s && s.sx) await writeStock(ref, s);
    ref.acquire({ holder: tabId, ttlMs: 1000 }).catch(() => {});
  } catch {}
}
async function fixStock(){
  const snap = await db.collection("samples").where("sx", "==", 1).limit(100).get();
  for (const d of snap.docs) await syncStock(d.id);
}

/* Stored samples with material due by the end of today, for the board's retention count. */
const storeDue = new Map();
let storeDueSub = null, storeDueDay = "";
function watchStoreDue(){
  const day = db && isStaff() ? dayKey(Date.now()) : "";
  if (day === storeDueDay) return;
  if (storeDueSub){ storeDueSub(); storeDueSub = null; }
  storeDueDay = day; storeDue.clear();
  if (!day) return;
  const end = Date.now() + 86400e3;
  storeDueSub = db.collection("stock").where("st", "==", "store").where("due", "<", end).onSnapshot(snap => {
    storeDue.clear(); snap.docs.forEach(d => { const x = d.data(); if (x && x.id) storeDue.set(x.id, x); });
    if (tab === "board") rerenderSoon();
  }, () => {});
}
/* Every stored sample's stock record, loaded when the Storage or Settings tab is first opened. */
const stored = new Map();
let storeSub = null, storeReady = false;
function watchStore(){
  if (storeSub || !db || !isStaff()) return;
  storeSub = db.collection("stock").where("st", "==", "store").onSnapshot(snap => {
    stored.clear(); snap.docs.forEach(d => { const x = d.data(); if (x && x.id) stored.set(x.id, x); });
    storeReady = true;
    if (tab === "storage") renderStorage();
    else if (tab === "ledger") renderLedger();
    else if (tab === "stages" && !$("#view-stages").contains(document.activeElement)) renderStages();
  }, () => { storeReady = true; });
}
/* Samples still open (in the lab or in storage) on a route or from a section, for Settings. */
const openOn = f => [...samples.values()].filter(f).length + [...stored.values()].filter(x => !samples.has(x.id) && f({ route: x.route, section: x.sec })).length;

let storeQ = "", storeSec = "", storeShow = "all", storeMore = 0;
function storageRows(){
  const rows = [];
  for (const x of stored.values()) for (const m of x.m || []) rows.push({ ...m, id: x.id, sec: x.sec, type: x.type, route: x.route, tag: x.tag });
  return rows;
}
function renderStorage(){
  const v = $("#view-storage"); if (!v) return;
  if (!isStaff()){ v.innerHTML = ""; return; }
  watchStore();
  const now = Date.now(), soon = now + 30 * 86400e3, all = storageRows();
  const isPast = r => r.dueAt && now > r.dueAt, isSoon = r => r.dueAt && !isPast(r) && r.dueAt <= soon;
  let list = all.filter(r => (!storeSec || r.sec === storeSec) && (storeShow === "all" || storeShow === "past" && isPast(r) || storeShow === "soon" && (isPast(r) || isSoon(r)) || storeShow === "noloc" && !r.loc));
  if (storeQ){ const q = storeQ.toLowerCase(); list = list.filter(r => [r.id, r.tag, r.loc, r.item, r.type].join(" ").toLowerCase().includes(q)); }
  list.sort((a, b) => (a.dueAt || OPEN_T) - (b.dueAt || OPEN_T) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const shown = list.slice(0, 200 + storeMore), past = all.filter(isPast).length, due = all.filter(isSoon).length, noLoc = all.filter(r => !r.loc).length;
  const edit = canEdit(), first = new Set();
  const row = r => `<tr><td style="white-space:nowrap"><button type="button" class="linkish mono" data-open="${esc(r.id)}">${esc(r.id)}</button>${r.tag ? `<div class="small mono muted">${esc(r.tag)}</div>` : ""}${edit && !first.has(r.id) && first.add(r.id) ? `<div><button type="button" class="btn ghost small reassay-btn" data-reassay="${esc(r.id)}">Re-assay</button></div>` : ""}</td>
    <td>${esc(r.item)}</td><td>${r.loc ? esc(r.loc) : `<span class="pill warn">No location</span>`}</td>
    <td style="white-space:nowrap">${fmtDate(r.dueAt)}${isPast(r) ? ` <span class="pill bad">Past retention</span>` : r.dueAt && r.dueAt - now < 7 * 86400e3 ? ` <span class="pill warn">Due</span>` : ""}</td>
    <td>${esc(r.then)}</td><td class="mono">${esc(r.sec)}</td><td>${esc(r.type)}${r.route ? `<div class="small mono" style="color:var(--accent)">${esc(r.route)}</div>` : ""}</td></tr>`;
  keepUiSimple(v, () => {
    v.innerHTML = `<div class="stack">
      <div class="stats">
        <div class="stat"><div class="n">${stored.size}</div><div class="l">Samples in storage</div></div>
        <div class="stat"><div class="n">${all.length}</div><div class="l">Materials kept</div></div>
        <div class="stat"><div class="n" style="color:${past ? "var(--bad)" : "inherit"}">${past}</div><div class="l">Past retention</div></div>
        <div class="stat"><div class="n" style="color:${due ? "var(--warn)" : "inherit"}">${due}</div><div class="l">Due within 30 days</div></div>
        ${noLoc ? `<div class="stat"><div class="n" style="color:var(--warn)">${noLoc}</div><div class="l">No location</div></div>` : ""}
      </div>
      <div class="row">
        <input class="inp" id="stQ" placeholder="Search ID, tag, location or material" style="flex:1 1 220px;width:auto" value="${esc(storeQ)}">
        <select class="inp" id="stSec" style="width:auto;max-width:100%" aria-label="Section"><option value="">All sections</option>${(cfg.sections || []).map(x => `<option value="${esc(x.code)}" ${storeSec === x.code ? "selected" : ""}>${esc(x.code)} · ${esc(x.name)}</option>`).join("")}</select>
        <select class="inp" id="stShow" style="width:auto" aria-label="Show"><option value="all">All material</option><option value="past">Past retention</option><option value="soon">Due within 30 days</option><option value="noloc">No location</option></select>
        <button class="btn" id="stCsv">Export CSV</button>
      </div>
      ${!storeReady ? `<div class="panel empty"><strong>Loading storage…</strong></div>`
        : shown.length ? `<div class="panel"><div class="tbl-wrap"><table><thead><tr><th>Sample</th><th>Material</th><th>Location</th><th>Keep until</th><th>Then</th><th>Section</th><th>Type</th></tr></thead><tbody>${shown.map(row).join("")}</tbody></table></div>
          ${list.length > shown.length ? `<div class="row" style="margin-top:10px"><span class="small muted">${shown.length} of ${list.length}</span><button type="button" class="btn ghost small" id="stMore">Show more</button></div>` : ""}</div>`
        : `<div class="panel empty"><strong>${all.length ? "No stored material matches these filters" : "Nothing in storage"}</strong></div>`}
    </div>`;
  });
  $("#stShow").value = storeShow;
  $("#stQ").oninput = e => { storeQ = e.target.value; storeMore = 0; clearTimeout(renderStorage.t); renderStorage.t = setTimeout(renderStorage, 250); };
  $("#stSec").onchange = e => { storeSec = e.target.value; storeMore = 0; renderStorage(); };
  $("#stShow").onchange = e => { storeShow = e.target.value; storeMore = 0; renderStorage(); };
  $("#stMore", v)?.addEventListener("click", () => { storeMore += 200; renderStorage(); });
  $("#stCsv").onclick = () => exportStorageCsv(list);
}
async function exportStorageCsv(rows){
  const dl = window.claude?.use ? await claude.use("downloads") : null;
  if (!dl){ toast("Downloads are not available in this view."); return; }
  const q = x => `"${String(x ?? "").replace(/"/g, '""')}"`, now = Date.now();
  const head = ["Sample ID", "Site sample code", "Section", "Type", "Route", "Material", "Location", "Keep until", "Then", "Past retention"];
  const lines = rows.map(r => [r.id, r.tag, r.sec, r.type, r.route, r.item, r.loc, fmtDate(r.dueAt), r.then, r.dueAt && now > r.dueAt ? "yes" : ""].map(q).join(","));
  try { await dl.save({ filename: `storage-${dayKey(now)}.csv`, data: [head.map(q).join(","), ...lines].join("\n") }); }
  catch { toast("Download was not saved."); }
}

/* The selected lab batch's samples, wherever they are now: a released sample may already be in storage, off the board. */
const batchSamps = new Map();
let batchSampSub = null, batchSampFor = "";
function watchBatchSamples(id){
  if (id === batchSampFor) return;
  if (batchSampSub){ batchSampSub(); batchSampSub = null; }
  batchSampFor = id || ""; batchSamps.clear();
  if (!db || !id) return;
  batchSampSub = db.collection("samples").where("lbs", "array-contains", id).onSnapshot(snap => {
    if (batchSampFor !== id) return;
    batchSamps.clear(); snap.docs.forEach(d => { const x = d.data(); if (x && x.id) batchSamps.set(x.id, x); });
    if (tab === "batches" && batchSel === id) rerenderSoon();
  }, () => {});
}
const bs = id => samples.get(id) || batchSamps.get(id);

/* Version 13: the in-lab flag and a stock record for every received sample. */
function upgrade13(s){ return { v: 13, lab: labOf(s), ...(stockOf(s) ? { sx: 1 } : {}) }; }
