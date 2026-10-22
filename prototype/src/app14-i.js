/* ---------- lab working hours ---------- */
/* cfg.work is null (round the clock) or { days: [0-6, Sunday = 0], shifts: [{ from: "06:00", to: "18:00" }], off: ["YYYY-MM-DD"] }.
   Step allowances count only time inside a shift on a working day, except steps marked `clock` (ovens, leaches, curing, an outside
   lab), which keep running overnight. A shift that ends before it starts runs past midnight and belongs to the day it starts. */
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const hhmm = v => /^([01]\d|2[0-3]):[0-5]\d$/.test(v || "");
function workOf(w){
  if (!w || typeof w !== "object") return null;
  const days = [...new Set((w.days || []).map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
  const shifts = (w.shifts || []).filter(x => x && hhmm(x.from) && hhmm(x.to) && x.from !== x.to).map(x => ({ from: x.from, to: x.to }));
  const off = [...new Set((w.off || []).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort();
  return days.length && shifts.length ? { days, shifts, off } : null;
}
const keyAdd = (k, n) => { const [y, m, d] = k.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const keyDow = k => { const [y, m, d] = k.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
let workSig = "", workCache = new Map();
/* Working spans [start, end] of the shifts that start on site day k, in epoch ms. */
function workSpans(k){
  const w = cfg.work, sig = JSON.stringify([w, TZ()]);
  if (sig !== workSig){ workSig = sig; workCache = new Map(); }
  let v = workCache.get(k); if (v) return v;
  v = [];
  if (w.days.includes(keyDow(k)) && !w.off.includes(k)) for (const x of w.shifts){
    const a = fromInput(`${k}T${x.from}`), b = fromInput(`${x.to > x.from ? k : keyAdd(k, 1)}T${x.to}`);
    if (b > a) v.push([a, b]);
  }
  v.sort((p, q) => p[0] - q[0]);
  workCache.set(k, v); return v;
}
/* The moment `hours` of working time have passed after t. */
function addWork(t, hours){
  const ms = (+hours || 0) * HOUR;
  if (!cfg.work || !(ms > 0)) return t + Math.max(0, ms);
  let left = ms, cur = t, k = keyAdd(dayKey(t), -1);
  for (let i = 0; i < 1500; i++, k = keyAdd(k, 1)) for (const [a, b] of workSpans(k)){
    const s = Math.max(a, cur); if (b <= s) continue;
    if (b - s >= left) return s + left;
    left -= b - s; cur = b;
  }
  return cur + left;
}
/* The first working moment at or after t. */
function workStart(t){
  if (!cfg.work) return t;
  let k = keyAdd(dayKey(t), -1);
  for (let i = 0; i < 1500; i++, k = keyAdd(k, 1)) for (const [a, b] of workSpans(k)) if (b > t) return Math.max(a, t);
  return t;
}
/* Working time between a and b, in ms. */
function workBetween(a, b){
  if (!(b > a)) return 0;
  if (!cfg.work) return b - a;
  let sum = 0, cur = a, k = keyAdd(dayKey(a), -1);
  const end = dayKey(b);
  for (let i = 0; i < 1500 && k <= end; i++, k = keyAdd(k, 1)) for (const [x, y] of workSpans(k)){
    const s = Math.max(x, cur), e = Math.min(y, b);
    if (e > s){ sum += e - s; cur = e; }
  }
  return sum;
}
/* When a step that starts at t is due, and how far past due it is at `now`. */
const dueFrom = (t, x) => x.clock || !cfg.work ? t + (+x.hours || 0) * HOUR : addWork(t, x.hours);
const overBy = (due, now, x) => x.clock || !cfg.work ? now - due : workBetween(due, now);
/* Hours a route takes from receipt to results: the sum of its steps round the clock, or the elapsed time from the next shift start. */
function routeSpan(r){
  const steps = [HEAD[1], ...stepsUsed((r && r.stages) || [])];
  if (!cfg.work) return steps.reduce((t, x) => t + (+x.hours || 0), 0);
  const t0 = workStart(Date.now());
  let t = t0;
  for (const x of steps) t = dueFrom(x.clock ? t : workStart(t), x);
  return (t - t0) / HOUR;
}
const weekHours = w => {
  if (!w) return 168;
  const len = x => { const [a, b] = [x.from, x.to].map(v => +v.slice(0, 2) * 60 + +v.slice(3)); return ((b - a + 1440) % 1440) / 60; };
  return w.days.length * w.shifts.reduce((t, x) => t + len(x), 0);
};

/* Settings: lab working hours (on the Sections and site time tab). */
function workHtml(){
  const w = draft.work;
  const days = w ? [1, 2, 3, 4, 5, 6, 0].map(d => `<label><input type="checkbox" data-wday="${d}" ${w.days.includes(d) ? "checked" : ""}> ${WEEKDAYS[d]}</label>`).join("") : "";
  const shifts = w ? w.shifts.map((x, i) => `<tr><td>Shift ${i + 1}</td>
    <td><input class="inp mono" type="time" style="width:auto" data-wsi="${i}" data-wsf="from" value="${esc(x.from)}" aria-label="Shift ${i + 1} starts"></td>
    <td><input class="inp mono" type="time" style="width:auto" data-wsi="${i}" data-wsf="to" value="${esc(x.to)}" aria-label="Shift ${i + 1} ends"></td>
    <td><button class="btn ghost danger" data-wsrm="${i}" aria-label="Remove shift ${i + 1}" ${w.shifts.length > 1 ? "" : "disabled"}>✕</button></td></tr>`).join("") : "";
  const off = w ? w.off.map((d, i) => `<span class="daychip">${esc(fmtDate(fromInput(d + "T12:00")))}<button type="button" class="linkish" data-woffrm="${i}" aria-label="Remove ${esc(d)}">✕</button></span>`).join("") : "";
  const ok = workOf(w);
  return `<h2 style="margin-top:12px">Lab working hours</h2>
    <div class="row"><select class="inp" id="wkMode" style="width:auto" aria-label="Lab working hours">
      <option value="" ${w ? "" : "selected"}>Round the clock (24/7)</option><option value="1" ${w ? "selected" : ""}>Working days and shifts</option></select>
      <span class="small muted">${ok ? `${+weekHours(ok).toFixed(2)} working hours a week` : w ? "" : "168 hours a week"}</span></div>
    ${w ? `<fieldset><div class="legend">Working days</div><div class="checks" id="wkDays">${days}</div></fieldset>
    <div class="tbl-wrap" style="max-width:440px"><table><thead><tr><th></th><th>Starts</th><th>Ends</th><th></th></tr></thead><tbody>${shifts}</tbody></table></div>
    <div class="row"><button class="btn" id="wkAdd">Add shift</button></div>
    <fieldset><div class="legend">Closed days</div>${off ? `<div class="row" style="gap:6px;margin-bottom:8px">${off}</div>` : ""}<div class="row"><input class="inp mono" type="date" id="wkOffNew" style="width:auto" aria-label="Closed day"><button class="btn" id="wkOffAdd">Add closed day</button></div></fieldset>` : ""}`;
}
function bindWork(v, dirty){
  const w = draft.work;
  $("#wkMode", v).addEventListener("change", e => { draft.work = e.target.value ? (draft.workWas || { days: [1, 2, 3, 4, 5, 6], shifts: [{ from: "06:00", to: "18:00" }], off: [] }) : null; if (!draft.work) draft.workWas = w; dirty(); });
  if (!w) return;
  v.querySelectorAll("[data-wday]").forEach(el => el.addEventListener("change", () => { w.days = [...v.querySelectorAll("[data-wday]:checked")].map(x => +x.dataset.wday).sort(); dirty(); }));
  v.querySelectorAll("[data-wsf]").forEach(el => el.addEventListener("change", () => {
    if (!hhmm(el.value)){ toast("Type the time as hours and minutes, like 06:00."); renderStages(); return; }
    w.shifts[+el.dataset.wsi][el.dataset.wsf] = el.value; dirty();
  }));
  v.querySelectorAll("[data-wsrm]").forEach(b => b.onclick = () => { w.shifts.splice(+b.dataset.wsrm, 1); dirty(); });
  $("#wkAdd", v).onclick = () => { const last = w.shifts[w.shifts.length - 1]; w.shifts.push({ from: last ? last.to : "06:00", to: last ? last.from : "18:00" }); dirty(); };
  v.querySelectorAll("[data-woffrm]").forEach(b => b.onclick = () => { w.off.splice(+b.dataset.woffrm, 1); dirty(); });
  $("#wkOffAdd", v).onclick = () => {
    const d = $("#wkOffNew", v).value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)){ toast("Pick the date first."); return; }
    w.off = [...new Set([...w.off, d])].sort(); dirty();
  };
}
/* Why a draft calendar can't be saved, or "". */
function workProblem(w){
  if (!w) return "";
  if (!w.days.length) return "Tick at least one working day, or choose Round the clock.";
  const bad = w.shifts.find(x => !hhmm(x.from) || !hhmm(x.to) || x.from === x.to);
  return bad ? "Each shift needs a start and an end time that differ." : "";
}

/* ---------- Settings tabs ---------- */
/* Settings draws every section on one page; the tabs show one group at a time, keyed by each section's heading, and keep the single Save. */
const CFG_TABS = [["accounts", "Accounts"], ["sections", "Sections and site time"], ["limits", "Limits"], ["files", "Results files"], ["routes", "Workflow routes"]];
let cfgTab = "accounts";
const paneOf = h => /^(Staff accounts|Access requests|Results and certificates)/.test(h) ? "accounts"
  : /^(Submitting sections|Site time|Lab working hours|Company logo)/.test(h) ? "sections"
  : /^Action and permit limits/.test(h) ? "limits" : /^Results files/.test(h) ? "files" : /^Workflow routes/.test(h) ? "routes" : "";
function splitSettings(v){
  const stack = v.firstElementChild; if (!stack) return;
  const kids = [...stack.children], bar = kids[kids.length - 1];
  let pane = "";
  for (const el of kids){
    if (el === bar) break;
    if (el.tagName === "H2") pane = paneOf(el.textContent.trim()) || pane;
    if (pane){ el.dataset.pane = pane; el.hidden = pane !== cfgTab; }
  }
  if (draftDirty) bar.insertAdjacentHTML("afterbegin", `<span class="pill warn">Unsaved changes</span>`);
  stack.insertAdjacentHTML("afterbegin", `<div class="subtabs" role="tablist" aria-label="Settings">${CFG_TABS.map(([k, l]) => `<button type="button" role="tab" data-cfgtab="${k}" aria-selected="${k === cfgTab}">${l}</button>`).join("")}</div>`);
  stack.querySelectorAll("[data-cfgtab]").forEach(b => b.onclick = () => { cfgTab = b.dataset.cfgtab; renderStages(); });
}

/* ---------- QR codes, drawn in the page (byte mode, error correction level M) ---------- */
const QR_ECC = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28];
const QR_BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49];
function qrRaw(v){ let r = (16 * v + 128) * v + 64; if (v >= 2){ const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; } return r; }
function qrMul(x, y){ let z = 0; for (let i = 7; i >= 0; i--){ z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z; }
function qrDivisor(deg){
  const r = new Array(deg).fill(0); r[deg - 1] = 1;
  let root = 1;
  for (let i = 0; i < deg; i++){ for (let j = 0; j < deg; j++){ r[j] = qrMul(r[j], root); if (j + 1 < deg) r[j] ^= r[j + 1]; } root = qrMul(root, 2); }
  return r;
}
function qrRem(data, div){ const r = div.map(() => 0); for (const b of data){ const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => r[i] ^= qrMul(c, f)); } return r; }
function qrPenalty(m, n){
  let p = 0, dark = 0;
  const line = get => {
    let s = 0, run = 1, seq = get(0) ? "1" : "0";
    for (let i = 1; i < n; i++){ const c = get(i); seq += c ? "1" : "0"; if (c === get(i - 1)) run++; else { if (run >= 5) s += run - 2; run = 1; } }
    if (run >= 5) s += run - 2;
    for (const pat of ["10111010000", "00001011101"]) for (let i = seq.indexOf(pat); i >= 0; i = seq.indexOf(pat, i + 1)) s += 40;
    return s;
  };
  for (let k = 0; k < n; k++) p += line(i => m[k][i]) + line(i => m[i][k]);
  for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++){ const c = m[y][x]; if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3; }
  for (const r of m) for (const c of r) if (c) dark++;
  return p + Math.floor(Math.abs(dark * 20 - n * n * 10) / (n * n)) * 10;
}
/* The modules of a QR code for `text` (true = dark), smallest version that fits. */
function qrMatrix(text){
  const bytes = [...new TextEncoder().encode(text)];
  const capOf = v => Math.floor(qrRaw(v) / 8) - QR_ECC[v] * QR_BLOCKS[v];
  let v = 1;
  while (v <= 40 && 4 + (v < 10 ? 8 : 16) + bytes.length * 8 > capOf(v) * 8) v++;
  if (v > 40) throw new Error("Text too long for a QR code");
  const cap = capOf(v), bits = [];
  const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(4, 4); put(bytes.length, v < 10 ? 8 : 16); bytes.forEach(b => put(b, 8));
  put(0, Math.min(4, cap * 8 - bits.length)); put(0, (8 - bits.length % 8) % 8);
  for (let pad = 0xEC; bits.length < cap * 8; pad ^= 0xEC ^ 0x11) put(pad, 8);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => a * 2 + b, 0));
  // Error correction per block, then interleaved.
  const nb = QR_BLOCKS[v], el = QR_ECC[v], raw = Math.floor(qrRaw(v) / 8), short = nb - raw % nb, slen = Math.floor(raw / nb), div = qrDivisor(el), blocks = [];
  for (let i = 0, k = 0; i < nb; i++){
    const d = data.slice(k, k + slen - el + (i < short ? 0 : 1)); k += d.length;
    const e = qrRem(d, div); if (i < short) d.push(0);
    blocks.push(d.concat(e));
  }
  const cw = [];
  for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== slen - el || j >= short) cw.push(b[i]); });
  // Finder, timing and alignment patterns, format and version information.
  const n = v * 4 + 17, m = [...Array(n)].map(() => Array(n).fill(false)), fn = [...Array(n)].map(() => Array(n).fill(false));
  const set = (x, y, d) => { m[y][x] = d; fn[y][x] = true; };
  for (let i = 0; i < n; i++){ set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [n - 4, 3], [3, n - 4]]) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++){
    const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy));
    if (x >= 0 && x < n && y >= 0 && y < n) set(x, y, d !== 2 && d !== 4);
  }
  if (v > 1){
    const na = Math.floor(v / 7) + 2, step = Math.floor((v * 8 + na * 3 + 5) / (na * 4 - 4)) * 2, pos = [6];
    for (let p = n - 7; pos.length < na; p -= step) pos.splice(1, 0, p);
    pos.forEach((a, i) => pos.forEach((b, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(a + dx, b + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }));
  }
  const format = mask => {
    let r = mask; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const b = ((mask << 10) | r) ^ 0x5412, g = i => ((b >>> i) & 1) === 1;   // level M = 00
    for (let i = 0; i <= 5; i++) set(8, i, g(i));
    set(8, 7, g(6)); set(8, 8, g(7)); set(7, 8, g(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, g(i));
    for (let i = 0; i < 8; i++) set(n - 1 - i, 8, g(i));
    for (let i = 8; i < 15; i++) set(8, n - 15 + i, g(i));
    set(8, n - 8, true);
  };
  format(0);
  if (v >= 7){
    let r = v; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25);
    const b = (v << 12) | r;
    for (let i = 0; i < 18; i++){ const d = ((b >>> i) & 1) === 1, a = n - 11 + i % 3, c = Math.floor(i / 3); set(a, c, d); set(c, a, d); }
  }
  // Data in the zigzag order.
  let bi = 0;
  for (let right = n - 1; right >= 1; right -= 2){
    if (right === 6) right = 5;
    for (let vert = 0; vert < n; vert++) for (let j = 0; j < 2; j++){
      const x = right - j, y = ((right + 1) & 2) === 0 ? n - 1 - vert : vert;
      if (!fn[y][x] && bi < cw.length * 8){ m[y][x] = ((cw[bi >>> 3] >>> (7 - (bi & 7))) & 1) === 1; bi++; }
    }
  }
  // The mask with the lowest penalty.
  const masks = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, x => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => x * y % 2 + x * y % 3 === 0,
    (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0];
  const flip = k => { for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!fn[y][x] && masks[k](x, y)) m[y][x] = !m[y][x]; };
  let best = 0, low = Infinity;
  for (let k = 0; k < 8; k++){ flip(k); format(k); const p = qrPenalty(m, n); if (p < low){ low = p; best = k; } flip(k); }
  flip(best); format(best);
  return m;
}
function qrSvg(text){
  const m = qrMatrix(text), n = m.length, q = 4;
  let d = "";
  m.forEach((r, y) => r.forEach((c, x) => { if (c) d += `M${x + q} ${y + q}h1v1h-1z`; }));
  return `<svg class="qr" viewBox="0 0 ${n + 2 * q} ${n + 2 * q}" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

/* ---------- bag labels ---------- */
const trackUrl = id => SHARE_URL + "#" + encodeURIComponent(id);   // v24d: a code ID keeps its spaces, + and #
const labelOf = s => ({ id: s.id, tag: ownCode(s), type: s.type || "", sec: s.section || "", at: s.createdAt || s.recvAt || 0,
  haz: hazTags(s).map(h => h.tag), two: twoPerson(s), urgent: s.priority === "Urgent" });
function labelHtml(x){
  return `<div class="bag-label">
    <div class="bl-qr">${qrSvg(trackUrl(x.id))}</div>
    <div class="bl-main">
      <div class="bl-org">Assay Lab</div>
      <div class="bl-id">${esc(x.id)}</div>
      ${x.tag ? `<div class="bl-line"><span>Code</span><b>${esc(x.tag)}</b></div>` : ""}
      <div class="bl-line"><span>Type</span><b>${esc(x.type)}</b></div>
      <div class="bl-line"><span>Section</span><b>${esc(x.sec)}</b></div>
      <div class="bl-line"><span>Submitted</span><b>${esc(fmtDate(x.at))}</b></div>
      ${x.haz.length || x.two || x.urgent ? `<div class="bl-flags">${x.urgent ? "<b>URGENT</b>" : ""}${x.haz.map(t => `<b>${esc(t)}</b>`).join("")}${x.two ? "<b>2-PERSON</b>" : ""}</div>` : ""}
    </div></div>`;
}
let labelItems = [], labelPaper = "a4";
const labelPage = () => labelPaper === "roll" ? "@page{size:100mm 50mm;margin:0}" : "@page{size:A4;margin:8mm}";
function showLabels(items){
  labelItems = items.filter(x => x && x.id);
  if (!labelItems.length) return;
  const box = $("#labelBox"), n = labelItems.length;
  box.innerHTML = `<div class="cert-wrap"><div class="cert-bar"><b>${n === 1 ? esc(labelItems[0].id) : `${n} labels`}</b><span style="flex:1"></span>
    <select class="inp" id="lbPaper" style="width:auto" aria-label="Paper"><option value="a4">A4 sheet</option><option value="roll">Label printer, 100 × 50 mm</option></select>
    <button type="button" class="btn" id="lbPrint">Print</button><button type="button" class="btn" id="lbDl">Download</button><button type="button" class="btn primary" id="lbClose">Close</button></div>
    <div class="label-sheet ${labelPaper}">${labelItems.map(labelHtml).join("")}</div></div>`;
  box.hidden = false;
  $("#lbPaper").value = labelPaper;
  $("#lbPaper").onchange = e => { labelPaper = e.target.value; $(".label-sheet", box).className = "label-sheet " + labelPaper; };
  $("#lbClose").onclick = closeLabels;
  box.onclick = e => { if (e.target === box) closeLabels(); };
  $("#lbPrint").onclick = () => {
    let st = $("#labelPageCss"); if (!st){ st = document.createElement("style"); st.id = "labelPageCss"; document.head.appendChild(st); }
    st.textContent = `@media print{${labelPage()}}`;
    document.body.classList.add("print-label");
    try { window.print(); } catch { toast("Printing is blocked in this view. Use Download instead."); }
  };
  $("#lbDl").onclick = async () => {
    const dl = window.claude?.use ? await claude.use("downloads") : null;
    if (!dl){ toast("Downloads are not available in this view."); return; }
    const css = [...document.querySelectorAll("style")].filter(x => x.id !== "labelPageCss").map(x => x.textContent).join("\n");
    const name = n === 1 ? `label-${labelItems[0].id}.html` : `labels-${labelItems[0].id}-${n}.html`;
    try { await dl.save({ filename: name, data: `<!doctype html><html><head><meta charset="utf-8"><title>${esc(name)}</title><style>${css}\n${labelPage()}</style></head><body class="labels-only"><div class="label-sheet ${labelPaper}">${labelItems.map(labelHtml).join("")}</div></body></html>` }); }
    catch { toast("Download was not saved."); }
  };
  $("#lbClose").focus();
}
function closeLabels(){
  const box = $("#labelBox"); if (!box || box.hidden) return;
  box.hidden = true; box.innerHTML = ""; document.body.classList.remove("print-label");
}
document.addEventListener("keydown", e => { if (e.key === "Escape") closeLabels(); });
addEventListener("afterprint", () => document.body.classList.remove("print-label"));
document.addEventListener("click", e => {
  const b = e.target.closest("[data-label]"); if (!b) return;
  const s = current?.body && current.body.id === b.dataset.label ? current.body : samples.get(b.dataset.label);
  if (s) showLabels([labelOf(s)]);
});
/* A scanned label opened in a tab that already has the tracker: show that sample. */
addEventListener("hashchange", () => {
  let h = ""; try { h = decodeURIComponent((location.hash || "").slice(1)); } catch {}
  if (h && (idFromText(h) || h) !== current?.id) openSample(h);
});
