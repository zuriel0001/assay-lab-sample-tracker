
/* ---------- v24d: the plant's pictures of a job: the strip profile of an elution run and the activity of carbon ----------
   On the batch page (live, with a crosshair and a table of the values) and on the batch certificate (static). Both read the same results:
   items are { s: the sample, rows: its results (the certificate's own copy on a certificate), test }. Series colours are categorical slots in a
   fixed order (--vz-1 …), set for the light and the dark theme and kept light on a certificate; text never wears a series colour. */
const ELU_SER = ["Pregnant solution", "Electrowinning head", "Electrowinning tails"];
const ELU_METAL = { Au_s: "Gold", Ag_s: "Silver" };
let vzMetal = "Au_s";
const vzStore = new Map();   // chart id → what to draw, so a redraw (resize, metal) needs nothing else
/* Minutes from the start, from the sample's "Time or bed volume" (60 min, 60, 02:30); a bed volume is not a time. */
function minsOf(s){
  const t = String((s?.details || {})["Time or bed volume"] || "").trim(); let m = t.match(/^(\d+(?:\.\d+)?)\s*(min|mins|minutes)?\.?$/i);
  if (m) return +m[1];
  m = t.match(/^(\d{1,2}):(\d{2})$/); return m ? +m[1] * 60 + +m[2] : null;
}
const vzNum = v => v == null || !isFinite(v) ? "—" : Math.abs(v) >= 100 ? v.toFixed(1) : Math.abs(v) >= 10 ? v.toFixed(1) : Math.abs(v) >= 1 ? v.toFixed(2) : v.toFixed(3);
const vzPct = v => v == null || !isFinite(v) ? "—" : v.toFixed(1) + "%";
const vzItems = docs => docs.filter(s => canSeeResults(s) && s.results?.rows).map(s => ({ s, rows: s.results.rows, test: s.test }));
/* ---- elution: the strip profile ---- */
function eluProfile(items, an){
  const ser = ELU_SER.map((pt, i) => ({ label: pt, slot: i + 1, pts: items.filter(x => x.test === "elu_sol" && ptOf(x.s) === pt)
    .map(x => ({ t: minsOf(x.s), v: resNum(x.rows?.[an]), id: x.s.id })).filter(p => p.t != null && p.v != null).sort((a, b) => a.t - b.t) })).filter(x => x.pts.length);
  const at = (label, t) => ser.find(x => x.label === label)?.pts.find(p => p.t === t)?.v;
  const head = ser.find(x => x.label === "Electrowinning head"), eff = (head?.pts || []).map(p => { const tl = at("Electrowinning tails", p.t); return tl != null && p.v > 0 ? { t: p.t, e: (p.v - tl) / p.v * 100 } : null; }).filter(Boolean);
  const one = re => items.find(x => x.test === "elu_sol" && ptOf(x.s) === "Lean eluate" && re.test(x.s.source || ""));
  const lean = [one(/before/i), one(/after/i)].map(x => x ? resNum(x.rows?.[an]) : null);
  const tw = items.find(x => x.test === "elu_sol" && ptOf(x.s) === "Treated water");
  return { ser, eff, lean, tw: tw ? resNum(tw.rows?.[an]) : null, n: ser.reduce((a, x) => a + x.pts.length, 0) };
}
const eluShows = items => { const p = eluProfile(items, "Au_s"); return p.n >= 3 && p.ser.some(x => x.pts.length >= 2); };
function eluTiles(p, an){
  const u = "mg/L", preg = p.ser.find(x => x.label === "Pregnant solution"), head = p.ser.find(x => x.label === "Electrowinning head"), tiles = [];
  if (preg){ const top = preg.pts.reduce((a, b) => b.v > a.v ? b : a); tiles.push(["Pregnant solution, peak", `${vzNum(top.v)} ${u}`, `at ${top.t} min`]); }
  if (p.eff.length){ const avg = p.eff.reduce((a, b) => a + b.e, 0) / p.eff.length, lo = p.eff.reduce((a, b) => b.e < a.e ? b : a);
    tiles.push(["Cell efficiency, average", vzPct(avg), `head to tails, ${p.eff.length} reading${p.eff.length === 1 ? "" : "s"}${p.eff.length > 1 ? `; lowest ${vzPct(lo.e)} at ${lo.t} min` : ""}`]); }
  if (head && head.pts.length > 1) tiles.push(["Electrowinning head", `${vzNum(head.pts[0].v)} → ${vzNum(head.pts.at(-1).v)} ${u}`, `${head.pts[0].t} to ${head.pts.at(-1).t} min`]);
  if (p.lean.some(v => v != null)) tiles.push(["Lean eluate", `${vzNum(p.lean[0])} → ${vzNum(p.lean[1])} ${u}`, "before → after the strip"]);
  if (p.tw != null) tiles.push(["Treated water", `${vzNum(p.tw)} ${u}`, ELU_METAL[an].toLowerCase() + " in solution"]);
  return tiles;
}
const vzTilesHtml = tiles => `<div class="vz-tiles">${tiles.map(([l, v, sub]) => `<div class="vz-tile"><div class="vz-l">${esc(l)}</div><div class="vz-v">${esc(v)}</div>${sub ? `<div class="vz-s">${esc(sub)}</div>` : ""}</div>`).join("")}</div>`;
function eluSeries(p){ return p.ser.map(x => ({ label: x.label, color: `var(--vz-${x.slot})`, pts: x.pts })); }
function eluTable(p, an){
  const ts = [...new Set(p.ser.flatMap(x => x.pts.map(q => q.t)))].sort((a, b) => a - b), cell = (x, t) => { const q = x.pts.find(y => y.t === t); return q ? vzNum(q.v) : "—"; };
  return `<table class="vz-t"><thead><tr><th>Time (min)</th>${p.ser.map(x => `<th>${esc(x.label)} (mg/L)</th>`).join("")}${p.eff.length ? "<th>Cell efficiency</th>" : ""}</tr></thead><tbody>
    ${ts.map(t => `<tr><td class="mono">${t}</td>${p.ser.map(x => `<td class="mono">${cell(x, t)}</td>`).join("")}${p.eff.length ? `<td class="mono">${vzPct(p.eff.find(e => e.t === t)?.e)}</td>` : ""}</tr>`).join("")}</tbody></table>`;
}
/* ---- carbon activity ---- */
function caRows(items){
  const out = items.filter(x => x.test === "c_act").map(x => {
    const v = {}; [...CA_T.map(m => "ca" + m), ...CA_OPT].forEach(k => { const n = resNum(x.rows?.[k]); if (n != null) v[k] = n; });
    const u60 = caUp(v, 60), u120 = caUp(v, 120);
    return { s: x.s, pt: ptOf(x.s) || "Carbon", code: tagText(x.s) || x.s.id, v, u60, u120, k: u60 && u60.c > 0 ? u60.gt / u60.c : null, std: CA_OPT.filter(k => v[k] == null) };
  }).filter(x => CA_T.filter(m => x.v["ca" + m] != null).length >= 2);
  const ref = out.find(x => x.pt === "Fresh carbon" && x.k > 0);
  out.forEach(x => { x.rel = ref && x.k != null ? x.k / ref.k * 100 : null; x.ref = x === ref; });
  const same = pt => out.filter(y => y.pt === pt).length > 1;
  let slot = 0; out.forEach(x => { x.label = same(x.pt) ? `${x.pt} · ${x.code}` : x.pt; x.color = x.ref ? "var(--vz-ref)" : `var(--vz-${Math.min(8, ++slot)})`; });
  return out;
}
const caSeries = rows => rows.map(x => ({ label: x.label, color: x.color, ref: x.ref, pts: CA_T.filter(m => x.v["ca" + m] != null).map(m => ({ t: m, v: x.v["ca" + m] })) }));
function caTable(rows, cert){
  const any = rows.some(x => x.rel != null);
  return `<table class="${cert ? "cert-res vz-ct" : "vz-t"}"><thead><tr><th>Carbon</th><th>Code</th><th>Gold taken up, 60 min</th><th>Gold taken up, 120 min</th><th>Au on carbon, 60 min (g/t)</th><th>k (h⁻¹)</th>${any ? "<th>vs fresh carbon</th>" : ""}</tr></thead><tbody>
    ${rows.map(x => `<tr><td><span class="vz-key" style="--c:${x.color}"></span>${esc(x.pt)}</td><td class="mono">${esc(x.code)}</td><td class="mono">${vzPct(x.u60?.pct)}</td><td class="mono">${vzPct(x.u120?.pct)}</td><td class="mono">${x.u60 ? Math.round(x.u60.gt) : "—"}</td><td class="mono"><b>${x.k != null ? Math.round(x.k) : "—"}</b></td>
      ${any ? `<td>${x.rel != null ? `<span class="vz-meter" aria-hidden="true"><i style="width:${Math.max(0, Math.min(100, x.rel))}%"></i></span> <b class="mono">${x.ref ? "100%" : Math.round(x.rel) + "%"}</b>${x.ref ? ' <span class="small muted">reference</span>' : ""}` : "—"}</td>` : ""}</tr>`).join("")}</tbody></table>`;
}
function caNote(rows){
  const std = rows.filter(x => x.std.length), ref = rows.some(x => x.ref), ks = [...new Set(std.flatMap(x => x.std))];
  const NM = { cmass: "carbon mass", vol0: "volume", aliq: "aliquot" }, SV = { cmass: "1 g", vol0: "1000 mL", aliq: "5 mL" };
  return `Gold taken up allows for the gold removed with an aliquot at every reading. k = gold on the carbon (g/t) ÷ gold left in solution (mg/L) after one hour.${ref ? " vs fresh carbon: k as a share of the fresh carbon's k." : " Add a fresh (virgin) carbon to the job to compare against it."}${ks.length ? ` No ${listAnd(ks.map(k => NM[k]))} in the results${std.length < rows.length ? ` for ${std.map(x => x.code).join(", ")}` : ""}: the standard ${listAnd(ks.map(k => SV[k]))} ${ks.length > 1 ? "were" : "was"} used.` : ""}`;
}
/* ---- the line chart: hairline grid, 2px lines, 8px dots with a ring of the surface; px-true so text stays its size on a phone ---- */
function niceStep(span, n){ const raw = span / Math.max(1, n), mag = 10 ** Math.floor(Math.log10(raw || 1)); return [1, 2, 2.5, 5, 10].map(f => f * mag).find(s => span / s <= n) || 10 * mag; }
function vzSvg(o, w, h){
  const L = 46, R = 14, T = 24, B = 30, pw = w - L - R, ph = h - T - B;
  const vs = o.series.flatMap(x => x.pts.map(p => p.v)), xs = o.series.flatMap(x => x.pts.map(p => p.t));
  let y0 = o.zero ? 0 : Math.min(...vs), y1 = Math.max(...vs); if (y1 === y0){ y1 += 1; y0 = Math.max(0, y0 - 1); }
  const ys = niceStep(y1 - y0, ph < 140 ? 3 : 5); y0 = Math.floor(y0 / ys) * ys; y1 = Math.ceil(y1 / ys) * ys;
  const x0 = 0, x1 = Math.max(...xs, 1), xt = o.xticks ? o.xticks.filter(t => t <= x1) : (() => { const st = niceStep(x1, Math.max(2, Math.floor(pw / 56))); const a = []; for (let t = 0; t <= x1 + 1e-9; t += st) a.push(+t.toFixed(6)); return a; })();
  const X = t => L + (t - x0) / (x1 - x0) * pw, Y = v => T + (y1 - v) / (y1 - y0) * ph;
  const yt = []; for (let v = y0; v <= y1 + ys / 1e6; v += ys) yt.push(+v.toFixed(6));
  const fy = v => Math.abs(v) >= 1000 ? (v / 1000).toFixed(v % 1000 ? 1 : 0) + "K" : String(+v.toFixed(3));
  const lines = o.series.map((x, i) => `<g class="vz-ser${x.ref ? " ref" : ""}" data-i="${i}" style="--c:${x.color}"><polyline points="${x.pts.map(p => `${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ")}"/>${x.pts.map(p => `<circle cx="${X(p.t).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="4"/>`).join("")}</g>`).join("");
  return { html: `<svg class="vz-svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(o.title)}">
    ${yt.map(v => `<line class="vz-grid" x1="${L}" x2="${w - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text class="vz-tick" x="${L - 6}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${fy(v)}</text>`).join("")}
    <line class="vz-axis" x1="${L}" x2="${w - R}" y1="${T + ph}" y2="${T + ph}"/>
    ${xt.map(t => `<text class="vz-tick" x="${X(t).toFixed(1)}" y="${T + ph + 16}" text-anchor="middle">${t}</text>`).join("")}
    <text class="vz-unit" x="${L - 6}" y="11" text-anchor="end">${esc(o.yunit)}</text><text class="vz-unit" x="${w - R}" y="${h - 2}" text-anchor="end">${esc(o.xunit)}</text>
    ${lines}
    ${o.live ? `<line class="vz-cross" x1="0" x2="0" y1="${T}" y2="${T + ph}" visibility="hidden"/><g class="vz-hl"></g><rect class="vz-hit" x="${L - 8}" y="0" width="${pw + 16}" height="${h}" fill="transparent"/>` : ""}
  </svg>`, X, Y, T, ph };
}
const vzLegend = series => series.length > 1 ? `<div class="vz-legend">${series.map(x => `<span><i class="vz-key" style="--c:${x.color}"></i>${esc(x.label)}${x.ref ? ' <span class="muted">(reference)</span>' : ""}</span>`).join("")}</div>` : "";
/* A chart's place on the batch page: drawn once the width is known, redrawn when it changes. */
function vzSlot(id, o){ vzStore.set(id, o); return `${vzLegend(o.series)}<div class="vz-chart" id="${id}" tabindex="0" aria-label="${esc(o.title)}. Use the arrow keys to read the values."><div class="vz-tip" hidden></div></div>`; }
function vzDraw(el){
  const o = vzStore.get(el.id); if (!o) return;
  const w = Math.max(260, Math.floor(el.clientWidth || 600)), h = w < 480 ? 220 : 280;
  if (el.dataset.w === String(w) && el.dataset.k === o.key) return;
  el.dataset.w = String(w); el.dataset.k = o.key;
  const g = vzSvg({ ...o, live: true }, w, h), tip = el.querySelector(".vz-tip");
  el.querySelector("svg")?.remove(); el.insertAdjacentHTML("afterbegin", g.html);
  const svg = el.querySelector("svg"), cross = svg.querySelector(".vz-cross"), hl = svg.querySelector(".vz-hl"), ts = [...new Set(o.series.flatMap(x => x.pts.map(p => p.t)))].sort((a, b) => a - b);
  let cur = -1;
  const show = i => {
    if (i < 0 || i >= ts.length){ cross.setAttribute("visibility", "hidden"); hl.innerHTML = ""; tip.hidden = true; cur = -1; return; }
    cur = i; const t = ts[i], x = g.X(t); cross.setAttribute("x1", x); cross.setAttribute("x2", x); cross.setAttribute("visibility", "visible");
    const at = o.series.map(s => [s, s.pts.find(p => p.t === t)]).filter(([, p]) => p);
    hl.innerHTML = at.map(([s, p]) => `<circle cx="${x}" cy="${g.Y(p.v)}" r="6" style="fill:${s.color}"/>`).join("");
    tip.textContent = ""; const hd = document.createElement("div"); hd.className = "vz-tt"; hd.textContent = `${t} ${o.xunit}`; tip.appendChild(hd);
    at.forEach(([s, p]) => { const r = document.createElement("div"); r.className = "vz-tr"; const k = document.createElement("i"); k.className = "vz-key"; k.style.setProperty("--c", s.color);
      const b = document.createElement("b"); b.textContent = `${vzNum(p.v)} ${o.yunit}`; const l = document.createElement("span"); l.textContent = s.label; r.append(k, b, l); tip.appendChild(r); });
    tip.hidden = false; const tw = tip.offsetWidth, left = x + 12 + tw > el.clientWidth ? x - 12 - tw : x + 12; tip.style.left = Math.max(0, left) + "px"; tip.style.top = (g.T + 4) + "px";
  };
  const near = cx => { let b = 0, d = Infinity; ts.forEach((t, i) => { const dd = Math.abs(g.X(t) - cx); if (dd < d){ d = dd; b = i; } }); return b; };
  svg.querySelector(".vz-hit").addEventListener("pointermove", e => { const r = svg.getBoundingClientRect(); show(near(e.clientX - r.left)); });
  svg.querySelector(".vz-hit").addEventListener("pointerleave", () => show(-1));
  el.onkeydown = e => { if (e.key === "ArrowRight" || e.key === "ArrowLeft"){ e.preventDefault(); show(Math.max(0, Math.min(ts.length - 1, (cur < 0 ? 0 : cur + (e.key === "ArrowRight" ? 1 : -1))))); } else if (e.key === "Escape") show(-1); };
  el.onfocus = () => { if (cur < 0) show(0); }; el.onblur = () => show(-1);
}
let vzRo = null;
function bindViz(v){
  const els = [...v.querySelectorAll(".vz-chart")]; if (!els.length) return;
  if (!vzRo && window.ResizeObserver) vzRo = new ResizeObserver(es => es.forEach(e => vzDraw(e.target)));
  els.forEach(el => { vzDraw(el); vzRo?.observe(el); });
  v.querySelectorAll("[data-vzmetal]").forEach(b => b.onclick = () => { vzMetal = b.dataset.vzmetal; if (current?.batch) renderTrack(); });
}
/* ---- the panels ---- */
function plantViews(docs){
  const items = vzItems(docs); let out = "";
  if (eluShows(items)){
    const an = vzMetal, p = eluProfile(items, an), o = { key: an + p.n, title: `Strip profile: ${ELU_METAL[an].toLowerCase()} in solution over the elution`, yunit: "mg/L", xunit: "min", zero: true, series: eluSeries(p) };
    out += `<div class="panel stack vz" id="vzElu"><div class="row" style="gap:10px;justify-content:space-between"><div><h3 style="margin:0">Strip profile</h3><div class="small muted">${esc(ELU_METAL[an])} in solution over the elution, mg/L</div></div>
      <div class="seg" role="group" aria-label="Metal">${Object.entries(ELU_METAL).map(([k, l]) => `<button type="button" class="btn small${k === an ? " on" : ""}" data-vzmetal="${k}" aria-pressed="${k === an}">${l}</button>`).join("")}</div></div>
      ${p.ser.length ? `${vzTilesHtml(eluTiles(p, an))}${vzSlot("vzEluC", o)}<details class="vz-more" id="vzEluTbl"><summary>Values</summary><div class="tbl-wrap">${eluTable(p, an)}</div></details>` : `<p class="small muted" style="margin:0">No ${ELU_METAL[an].toLowerCase()} results yet.</p>`}</div>`;
  }
  const ca = caRows(items);
  if (ca.length){
    const o = { key: "ca" + ca.map(x => x.k).join(","), title: "Carbon activity: gold left in solution with each carbon", yunit: "mg/L", xunit: "min", xticks: CA_T, series: caSeries(ca) };
    out += `<div class="panel stack vz" id="vzCa"><div><h3 style="margin:0">Carbon activity</h3><div class="small muted">Gold left in the standard solution with each carbon, mg/L, 0 to 120 min</div></div>
      ${vzSlot("vzCaC", o)}<div class="tbl-wrap">${caTable(ca)}</div><div class="small muted">${esc(caNote(ca))}</div></div>`;
  }
  return out;
}
/* On the batch certificate: the same pictures, static, sized for the page and printed in the light theme. */
function plantCert(mem){
  const items = mem.map(([s, x]) => ({ s, rows: x.rows || {}, test: x.test })); let out = "";
  if (eluShows(items)){
    const p = eluProfile(items, "Au_s"), o = { title: "Strip profile: gold in solution over the elution", yunit: "mg/L", xunit: "min", zero: true, series: eluSeries(p) };
    out += `<div class="cert-fig vz"><h4 class="cert-sec">Strip profile: gold in solution (mg/L)</h4>${vzLegend(o.series)}${vzSvg(o, 680, 240).html}${vzTilesHtml(eluTiles(p, "Au_s"))}</div>`;
  }
  const ca = caRows(items);
  if (ca.length){
    const o = { title: "Carbon activity: gold left in solution with each carbon", yunit: "mg/L", xunit: "min", xticks: CA_T, series: caSeries(ca) };
    out += `<div class="cert-fig vz"><h4 class="cert-sec">Carbon activity: gold left in solution (mg/L)</h4>${vzLegend(o.series)}${vzSvg(o, 680, 220).html}<div class="cert-note">${esc(caNote(ca))}</div></div>`;
  }
  return out;
}
