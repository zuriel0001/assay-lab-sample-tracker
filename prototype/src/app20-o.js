/* v21 (polish): samples recently opened on this device, suggestions under the header search, the same details again on
   Submit / Register, tables that read as cards on a phone, and the browser tab named after the open sample. */
const RECENT_MAX = 8, BASE_TITLE = document.title || "Assay Lab Sample Tracker";
/* Each person on a shared computer has their own list (a blind sample and its original never show side by side for someone else). */
const recentKey = () => "recent:" + (session?.u || "public");
function recentList(){
  try { const a = JSON.parse(lsGet(recentKey()) || "[]"); return Array.isArray(a) ? a.filter(x => x && typeof x.id === "string" && x.id).slice(0, RECENT_MAX) : []; } catch { return []; }
}
function recentPut(e){
  const a = recentList(), old = a[0];
  if (old && old.id === e.id && ["t", "c", "l", "k", "n"].every(k => (old[k] ?? "") === (e[k] ?? ""))) return;   // unchanged: no write
  lsSet(recentKey(), JSON.stringify([{ ...e, at: Date.now() }, ...a.filter(x => x.id !== e.id)].slice(0, RECENT_MAX)));
}
function noteRecent(s){
  if (!s?.id) return;
  let st = {}; try { st = status(s); } catch {}
  recentPut({ id: s.id, t: s.type || "", c: tagText(s) || "", l: st.label || "", k: st.cls || "" });
}
function noteRecentBatch(ref, docs){
  if (!ref || !docs?.length) return;
  const done = docs.filter(s => curIdx(s) >= targetIdx(s)).length;
  recentPut({ id: ref, b: 1, n: docs.length, t: docs[0].type || "", c: "", l: `${done} of ${docs.length} released`, k: done === docs.length ? "ok" : "" });
}
/* What was just issued goes on the list too, so the person who registered it finds it again on the Sample tab. */
function noteIssued(ids, ref, base, tagSets){
  if (ref) return recentPut({ id: ref, b: 1, n: ids.length, t: base.type || "", c: "", l: `0 of ${ids.length} released`, k: "" });
  let st = {}; try { st = status({ ...base, id: ids[0], tags: tagSets[0] }); } catch {}
  recentPut({ id: ids[0], t: base.type || "", c: (tagSets[0] || []).join(", "), l: st.label || "", k: st.cls || "" });
}
function agoText(t){
  const m = Math.round((Date.now() - t) / 60000);
  if (!(m >= 1)) return "just now";
  if (m < 60) return m + " min ago";
  if (m < 24 * 60) return Math.round(m / 60) + " h ago";
  return fmtDate(t);
}
/* The live status when this page holds the sample, else the status when it was last opened here. */
function recentLive(x){
  const s = !x.b && samples.get(x.id);
  if (!s) return { l: x.l, k: x.k };
  try { const st = status(s); return { l: st.label, k: st.cls }; } catch { return { l: x.l, k: x.k }; }
}
function recentPanel(){
  const a = recentList(); if (!a.length) return "";
  return `<div class="panel recent" id="recent"><div class="recent-h"><h3>Recently opened</h3><button type="button" class="btn ghost small" id="recentClear">Clear</button></div>
    <div class="recent-list">${a.map(x => { const lv = recentLive(x);
      return `<button type="button" class="rec" data-open="${esc(x.id)}"><span class="rec-id mono">${esc(x.id)}</span>${lv.l ? `<span class="pill ${esc(lv.k || "")}">${esc(lv.l)}</span>` : ""}
        <span class="rec-m small muted">${esc([x.b ? `Batch of ${x.n}` : "", x.t, x.c].filter(Boolean).join(" · "))}</span><span class="rec-at small muted">${esc(agoText(x.at))}</span></button>`; }).join("")}</div></div>`;
}
function bindRecent(v){ $("#recentClear", v)?.addEventListener("click", () => { lsSet(recentKey(), ""); renderTrack(); }); }
function pageTitle(x){ const t = x ? `${x} · ${BASE_TITLE}` : BASE_TITLE; if (document.title !== t) document.title = t; }

/* Suggestions under the header search: staff see matching samples in the register as they type (ID, site sample code,
   site reference, batch, submitter); everyone sees what they opened recently. Arrow keys and Enter pick one. */
const sug = { box: null, items: [], on: -1, quiet: false, t: 0 };
function sugHl(text, Q){
  const t = String(text || ""), i = Q ? t.toUpperCase().indexOf(Q) : -1;
  return i < 0 ? esc(t) : esc(t.slice(0, i)) + "<mark>" + esc(t.slice(i, i + Q.length)) + "</mark>" + esc(t.slice(i + Q.length));
}
function sugFind(q){
  const Q = q.trim().toUpperCase(), out = [], seen = new Set();
  const add = (id, html) => { if (out.length < 8 && !seen.has(id)){ seen.add(id); out.push({ id, html }); } };
  const recRow = x => { const lv = recentLive(x);
    return `<span class="sug-id mono">${sugHl(x.id, Q)}</span>${lv.l ? `<span class="pill ${esc(lv.k || "")}">${esc(lv.l)}</span>` : ""}<span class="sug-m small muted">${sugHl([x.b ? `Batch of ${x.n}` : "", x.t, x.c].filter(Boolean).join(" · "), Q)}</span>`; };
  if (!Q){ recentList().forEach(x => add(x.id, recRow(x))); return out; }
  if (Q.length >= 2 && isStaff()){
    const hits = [], batches = new Map();
    for (const s of samples.values()){
      if (!s?.id) continue;
      const id = s.id.toUpperCase(), codes = (s.tags || []).map(t => String(t).toUpperCase());
      const sc = id === Q ? 0 : codes.includes(Q) ? 0.5 : id.startsWith(Q) ? 1 : codes.some(c => c.startsWith(Q)) ? 2 : id.includes(Q) ? 3 : codes.some(c => c.includes(Q)) ? 4
        : String(s.siteRef || "").toUpperCase().includes(Q) ? 5 : String(s.submitter || "").toUpperCase().includes(Q) ? 6 : -1;
      if (sc >= 0) hits.push([sc, s]);
      if (s.batchId && s.batchId.toUpperCase().includes(Q)) (batches.get(s.batchId) || batches.set(s.batchId, []).get(s.batchId)).push(s);
    }
    [...batches].slice(0, 3).forEach(([b, list]) => add(b, `<span class="sug-id mono">${sugHl(b, Q)}</span><span class="pill info">Batch of ${list[0].batchSize || list.length}</span><span class="sug-m small muted">${esc(list[0].type || "")}</span>`));
    hits.sort((a, b) => a[0] - b[0] || (b[1].stageAt || 0) - (a[1].stageAt || 0));
    for (const [, s] of hits){
      let st = {}; try { st = status(s); } catch {}
      add(s.id, `<span class="sug-id mono">${sugHl(s.id, Q)}</span>${st.label ? `<span class="pill ${esc(st.cls || "")}">${esc(st.label)}</span>` : ""}<span class="sug-m small muted">${sugHl([s.type, ownCode(s), s.submitter].filter(Boolean).join(" · "), Q)}</span>`);
    }
  }
  recentList().filter(x => (x.id + " " + (x.c || "")).toUpperCase().includes(Q)).forEach(x => add(x.id, recRow(x)));
  return out;
}
function sugShow(){
  const inp = $("#lookupInput"); if (!sug.box || !inp || sug.quiet || document.activeElement !== inp) return sugHide();
  sug.items = sugFind(inp.value); sug.on = -1;
  if (!sug.items.length) return sugHide();
  sug.box.innerHTML = (inp.value.trim() ? "" : `<div class="sug-h">Recently opened</div>`) + sug.items.map((x, i) => `<button type="button" class="sug-i" role="option" id="sug-${i}" data-sug="${esc(x.id)}" aria-selected="false">${x.html}</button>`).join("");
  sug.box.hidden = false; sugPlace(); inp.setAttribute("aria-expanded", "true");
}
/* The header clips what hangs below it, so the list lives on the page body, placed under the search box. */
function sugPlace(){
  if (!sug.box || sug.box.hidden) return;
  const r = $("#lookupForm").getBoundingClientRect();
  Object.assign(sug.box.style, { left: Math.round(r.left) + "px", top: Math.round(r.bottom + 6) + "px", width: Math.round(r.width) + "px" });
}
function sugHide(){ if (!sug.box) return; sug.box.hidden = true; sug.on = -1; $("#lookupInput")?.setAttribute("aria-expanded", "false"); }
function sugMove(d){
  if (sug.box.hidden || !sug.items.length) return false;
  const n = sug.items.length;
  sug.on += d; if (sug.on >= n) sug.on = -1; else if (sug.on < -1) sug.on = n - 1;
  sug.box.querySelectorAll(".sug-i").forEach((b, i) => b.setAttribute("aria-selected", String(i === sug.on)));
  const a = sug.box.querySelector(`#sug-${sug.on}`); a?.scrollIntoView({ block: "nearest" });
  $("#lookupInput").setAttribute("aria-activedescendant", sug.on >= 0 ? "sug-" + sug.on : "");
  return true;
}
function sugPick(id){ sugQuiet(); $("#lookupInput").blur(); openSample(id); }
/* After a search is sent, suggestions stay away until the person types again. */
function sugQuiet(){ sug.quiet = true; clearTimeout(sug.t); sugHide(); }
(function sugInit(){
  const f = $("#lookupForm"), inp = $("#lookupInput"); if (!f || !inp) return;
  sug.box = document.createElement("div"); sug.box.id = "sugBox"; sug.box.className = "sug"; sug.box.hidden = true; sug.box.setAttribute("role", "listbox");
  document.body.append(sug.box);
  addEventListener("resize", sugPlace); addEventListener("scroll", sugPlace, { passive: true });
  inp.setAttribute("role", "combobox"); inp.setAttribute("aria-controls", "sugBox"); inp.setAttribute("aria-expanded", "false"); inp.setAttribute("aria-autocomplete", "list");
  inp.addEventListener("input", () => { sug.quiet = false; clearTimeout(sug.t); sug.t = setTimeout(sugShow, 60); });
  inp.addEventListener("focus", () => { sug.quiet = false; sugShow(); });
  inp.addEventListener("blur", () => setTimeout(sugHide, 150));
  inp.addEventListener("keydown", e => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp"){ if (sug.box.hidden) sugShow(); if (sugMove(e.key === "ArrowDown" ? 1 : -1)) e.preventDefault(); }
    else if (e.key === "Enter" && !sug.box.hidden && sug.on >= 0){ e.preventDefault(); e.stopPropagation(); sugPick(sug.items[sug.on].id); }
    else if (e.key === "Escape" && !sug.box.hidden){ e.preventDefault(); sugHide(); }
  });
  sug.box.addEventListener("mousedown", e => e.preventDefault());   // keep the focus in the search while a suggestion is clicked
  sug.box.addEventListener("click", e => { const b = e.target.closest("[data-sug]"); if (b) sugPick(b.dataset.sug); });
  f.addEventListener("submit", sugQuiet, true);
  // "/" jumps to the search from anywhere that isn't a text box
  document.addEventListener("keydown", e => {
    if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
    const a = document.activeElement;
    if (a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)) return;
    if (document.querySelector(".modal:not([hidden])")) return;
    e.preventDefault(); inp.focus(); inp.select();
  });
})();

/* The same details again: what was submitted last on this device by this person, refilled in one click (not the codes). */
const SNAP_IDS = ["rType", "rPurpose", "rWhy", "rTest", "rRouteSel", "rSubmitter", "rSubBadge", "rSection", "rHandTo", "rHandBadge", "rPriority", "rContainers"];
const lastKey = () => "lastForm:" + (session?.u || "public");
function formSnap(){
  const o = { kind: formKind() };
  SNAP_IDS.forEach(k => { const e = $("#" + k); if (e && e.value !== "") o[k] = e.value; });
  o.hz = HAZARDS.filter(h => $("#rHz_" + h.k)?.checked).map(h => h.k);
  o.an = ADDONS.map((_, i) => i).filter(i => $("#rAn" + i)?.checked);
  if (o.kind === "batch") o.n = bRows.length;
  if ($("#rRecvNow")) o.recv = $("#rRecvNow").checked;   // v24c: Same details again keeps "Received now" as it was
  lsSet(lastKey(), JSON.stringify(o));
  return o;
}
function lastSnap(){ try { const o = JSON.parse(lsGet(lastKey()) || "null"); return o && typeof o === "object" && o.rType ? o : null; } catch { return null; } }
function applySnap(o){
  const v = $("#regForm"); if (!o || !v) return;
  const set = (k, ev) => { const e = $("#" + k, v); if (!e || o[k] == null) return; e.value = o[k]; if (e.value === String(o[k]) && ev) e.dispatchEvent(new Event(ev, { bubbles: true })); };
  set("rType", "change"); set("rPurpose", "change"); set("rWhy");
  const te = $("#rTest", v);
  if (o.rTest && te){ te.value = o.rTest; if (te.value === o.rTest) te.dispatchEvent(new Event("change", { bubbles: true })); }
  if (te && te.value === defaultTest(o.rType, o.rPurpose)) delete te.dataset.touched;   // the usual test for that type: a new type picks its own
  const rn = $("#rRecvNow", v); if (rn && typeof o.recv === "boolean" && rn.checked !== o.recv){ rn.checked = o.recv; rn.dispatchEvent(new Event("change", { bubbles: true })); }
  set("rRouteSel", "change"); set("rSubmitter"); set("rSubBadge"); set("rSection", "change"); set("rHandTo"); set("rHandBadge"); set("rPriority"); set("rContainers");
  if (Array.isArray(o.hz)){ HAZARDS.forEach(h => { const c = $("#rHz_" + h.k, v); if (c) c.checked = o.hz.includes(h.k); }); if ($("#rHaz", v)) $("#rHaz", v).dataset.touched = "1"; }
  if (Array.isArray(o.an)) ADDONS.forEach((_, i) => { const c = $("#rAn" + i, v); if (c) c.checked = o.an.includes(i); });
  const kind = $(`input[name="rKind"][value="${o.kind === "batch" ? "batch" : "single"}"]`, v);
  if (kind && !kind.checked){ kind.checked = true; kind.dispatchEvent(new Event("change", { bubbles: true })); }
  if (o.kind === "batch" && o.n >= 2 && $("#rCount", v)){ $("#rCount", v).value = o.n; $("#rCount", v).dispatchEvent(new Event("change", { bubbles: true })); }
  $("#rLast", v)?.remove();
  refreshFormRoute(); submitLabel();
  (o.kind === "batch" ? $("#rRows .r-code", v) : $("#rTag", v))?.focus();
  toast("Same details as last time");
}
function lastChip(v){
  const o = lastSnap(), h = $(".form-h", v); if (!o || !h) return;
  const what = [typeOf(o.rType)?.name, o.rSection].filter(Boolean).join(" · ");
  h.insertAdjacentHTML("beforeend", `<button type="button" class="btn ghost small last-chip" id="rLast" title="${esc(what)}">Same as last${what ? `: ${esc(what)}` : ""}</button>`);
  $("#rLast", v).onclick = () => applySnap(o);
}

/* On a phone, wide tables (ledger, storage, batches, a batch's samples, blind checks, section results) read as cards: each
   cell carries its column name, and empty cells are left out. The markup stays a table everywhere else. */
function cardify(){
  document.querySelectorAll("table.cardy").forEach(t => {
    const rows = t.querySelectorAll("tbody tr:not([data-l])"); if (!rows.length) return;
    const hs = [...t.querySelectorAll("thead th")].map(th => th.textContent.trim());
    rows.forEach(tr => { tr.dataset.l = "1"; [...tr.children].forEach((td, i) => {
      if (hs[i]) td.dataset.label = hs[i];
      const x = td.textContent.trim();
      if ((!x || x === "—") && !td.querySelector("input,button,select,img,svg,a")) td.classList.add("nil");
    }); });
    t.closest(".tbl-wrap")?.classList.add("has-cards");
  });
}
new MutationObserver(cardify).observe(document.body, { childList: true, subtree: true });
/* The Sample tab pressed again while a sample is open goes back to its start page (search, recently opened, today). */
document.addEventListener("click", e => {
  const b = e.target.closest('#tabs button[data-tab="track"]');
  if (!b || tab !== "track" || !current) return;
  if (unsubCurrent){ unsubCurrent(); unsubCurrent = null; }
  openSeq++; current = null; $("#lookupInput").value = "";
  try { history.replaceState(null, "", location.pathname + location.search); } catch {}
}, true);
