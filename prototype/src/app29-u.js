
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
const vzG = v => v == null || !isFinite(v) ? "—" : v.toFixed(2);   // gold in solids (g/t), two decimals as the lab reports it
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
  return `<table class="${cert ? "cert-res vz-ct" : "vz-t cardy vz-ca"}"><thead><tr><th>Carbon</th><th>Code</th><th>Gold taken up, 60 min</th><th>Gold taken up, 120 min</th><th>Au on carbon, 60 min (g/t)</th><th>k (h⁻¹)</th>${any ? "<th>vs fresh carbon</th>" : ""}</tr></thead><tbody>
    ${rows.map(x => `<tr><td><span class="vz-key" style="--c:${x.color}"></span>${esc(x.pt)}</td><td class="mono">${esc(x.code)}</td><td class="mono">${vzPct(x.u60?.pct)}</td><td class="mono">${vzPct(x.u120?.pct)}</td><td class="mono">${x.u60 ? Math.round(x.u60.gt) : "—"}</td><td class="mono"><b>${x.k != null ? Math.round(x.k) : "—"}</b></td>
      ${any ? `<td>${x.rel != null ? `<span class="nw"><span class="vz-meter" aria-hidden="true"><i style="width:${Math.max(0, Math.min(100, x.rel))}%"></i></span> <b class="mono">${x.ref ? "100%" : Math.round(x.rel) + "%"}</b>${x.ref ? ' <span class="small muted">reference</span>' : ""}</span>` : "—"}</td>` : ""}</tr>`).join("")}</tbody></table>`;
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
  const x0 = o.x0 ?? 0, x1 = Math.max(...xs, x0 + 1), xt = o.xticks ? o.xticks.filter(t => t <= x1) : (() => { const st = niceStep(x1, Math.max(2, Math.floor(pw / 56))); const a = []; for (let t = 0; t <= x1 + 1e-9; t += st) a.push(+t.toFixed(6)); return a; })();
  const X = t => L + (t - x0) / (x1 - x0) * pw, Y = v => T + (y1 - v) / (y1 - y0) * ph;
  const yt = []; for (let v = y0; v <= y1 + ys / 1e6; v += ys) yt.push(+v.toFixed(6));
  const fy = v => Math.abs(v) >= 1000 ? (v / 1000).toFixed(v % 1000 ? 1 : 0) + "K" : String(+v.toFixed(3));
  const lines = o.series.map((x, i) => `<g class="vz-ser${x.ref ? " ref" : ""}" data-i="${i}" style="--c:${x.color}"><polyline points="${x.pts.map(p => `${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ")}"/>${x.pts.map(p => `<circle cx="${X(p.t).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="4"/>`).join("")}</g>`).join("");
  return { html: `<svg class="vz-svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(o.title)}">
    ${yt.map(v => `<line class="vz-grid" x1="${L}" x2="${w - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text class="vz-tick" x="${L - 6}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${fy(v)}</text>`).join("")}
    <line class="vz-axis" x1="${L}" x2="${w - R}" y1="${T + ph}" y2="${T + ph}"/>
    ${xt.map(t => `<text class="vz-tick" x="${X(t).toFixed(1)}" y="${T + ph + 16}" text-anchor="middle">${esc(o.xfmt ? o.xfmt(t) : String(t))}</text>`).join("")}
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
  if (o.bars){ const w = Math.max(240, Math.floor(el.clientWidth || 600)); if (el.dataset.w === String(w) && el.dataset.k === o.key) return; el.dataset.w = String(w); el.dataset.k = o.key; el.innerHTML = vzBars(o.bars, w, o); return; }
  const w = Math.max(240, Math.floor(el.clientWidth || 600)), h = o.h || (w < 480 ? 220 : 280);
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
    tip.textContent = ""; const hd = document.createElement("div"); hd.className = "vz-tt"; hd.textContent = o.xname ? o.xname(t) : `${t} ${o.xunit}`; tip.appendChild(hd);
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
  $("#brtSave", v)?.addEventListener("click", brtSaveMasses);
}
/* ---- v24d (20 Oct): tanks, bottle roll and preg-robbing ---- */
/* A sample's place down the CIL: 0 the pre-leach feed, 1 to 11 the tanks (its job's details), or null. */
const tankOf = s => { const t = (s?.details || {})["CIL tank"]; return t == null ? null : t === "Pre-leach" ? 0 : isFinite(+t) ? +t : null; };
const tankName = t => t === 0 ? "Pre-leach feed" : `Tank ${t}`, tankTick = t => t === 0 ? "Feed" : "T" + t;
const SLURRY = new Set(["aufx_ausx", "aufx_ausx_cn", "aufx"]);
function tankProfile(items){
  const pts = items.filter(x => SLURRY.has(x.test) && tankOf(x.s) != null).map(x => ({ t: tankOf(x.s), fx: resNum(x.rows?.Au), sx: resNum(x.rows?.Au_s), pH: resNum(x.rows?.pH), sol: resNum(x.rows?.sol), id: x.s.id })).sort((a, b) => a.t - b.t);
  const fx = pts.filter(p => p.fx != null), sx = pts.filter(p => p.sx != null), pw = items.find(x => ptOf(x.s) === "Process water");
  const out = { pts, fx, sx, pw: pw ? { au: resNum(pw.rows?.Au_s), wad: resNum(pw.rows?.wad), cn: resNum(pw.rows?.cn) } : null };
  const feed = fx.find(p => p.t === 0), lastF = fx.filter(p => p.t > 0).at(-1);
  out.leach = feed && lastF && feed.fx > 0 ? { pct: (feed.fx - lastF.fx) / feed.fx * 100, feed, last: lastF } : null;
  const top = sx.filter(p => p.t > 0).reduce((a, b) => !a || b.sx > a.sx ? b : a, null), lastS = sx.filter(p => p.t > 0).at(-1);
  out.ads = top && lastS && top.sx > 0 && lastS !== top ? { pct: (top.sx - lastS.sx) / top.sx * 100, top, last: lastS } : null;
  return out;
}
const tankShows = items => tankProfile(items).pts.filter(p => p.fx != null || p.sx != null).length >= 3;
function tankTiles(p){
  const t = [];
  if (p.leach) t.push(["Leach efficiency", vzPct(p.leach.pct), `AuFx ${vzG(p.leach.feed.fx)} g/t in the feed → ${vzG(p.leach.last.fx)} g/t in ${tankName(p.leach.last.t).toLowerCase()}`]);
  if (p.ads) t.push(["Adsorption efficiency", vzPct(p.ads.pct), `AuSx ${vzNum(p.ads.top.sx)} mg/L in ${tankName(p.ads.top.t).toLowerCase()} → ${vzNum(p.ads.last.sx)} mg/L in ${tankName(p.ads.last.t).toLowerCase()}`]);
  const ls = p.sx.filter(x => x.t > 0).at(-1); if (ls) t.push(["Gold in solution, last tank", `${vzNum(ls.sx)} mg/L`, tankName(ls.t)]);
  if (p.pw && (p.pw.au != null || p.pw.wad != null)) t.push(["Process water", p.pw.au != null ? `${vzNum(p.pw.au)} mg/L` : "—", [p.pw.wad != null ? `WAD ${vzNum(p.pw.wad)} mg/L` : "", p.pw.cn != null ? `NaCN ${p.pw.cn} mg/L` : ""].filter(Boolean).join(" · ") || "gold in solution"]);
  return t;
}
const tankTable = p => `<table class="vz-t"><thead><tr><th>Where</th><th>AuFx (g/t)</th><th>AuSx (mg/L)</th><th>pH</th><th>Solids (%)</th></tr></thead><tbody>${p.pts.map(x => `<tr><td>${esc(tankName(x.t))}</td><td class="mono">${vzG(x.fx)}</td><td class="mono">${vzNum(x.sx)}</td><td class="mono">${x.pH != null ? x.pH.toFixed(1) : "—"}</td><td class="mono">${x.sol != null ? x.sol.toFixed(1) : "—"}</td></tr>`).join("")}</tbody></table>`;
const tankCharts = p => [
  p.fx.length >= 2 ? { key: "tfx" + p.fx.map(x => x.fx).join(","), title: "Gold in solids down the tanks, AuFx (g/t)", yunit: "g/t", xunit: "", zero: true, h: 220, xticks: p.fx.map(x => x.t), xfmt: tankTick, xname: tankName, series: [{ label: "AuFx", color: "var(--vz-1)", pts: p.fx.map(x => ({ t: x.t, v: x.fx })) }] } : null,
  p.sx.length >= 2 ? { key: "tsx" + p.sx.map(x => x.sx).join(","), title: "Gold in solution down the tanks, AuSx (mg/L)", yunit: "mg/L", xunit: "", zero: true, h: 220, xticks: p.sx.map(x => x.t), xfmt: tankTick, xname: tankName, series: [{ label: "AuSx", color: "var(--vz-2)", pts: p.sx.map(x => ({ t: x.t, v: x.sx })) }] } : null
].filter(Boolean);
/* Carbon in the CIL tanks (the Mill shift): gold loading tank by tank. */
const carbonByTank = items => items.filter(x => x.test === "c_load" && tankOf(x.s) > 0).map(x => ({ t: tankOf(x.s), v: resNum(x.rows?.Au_c) })).filter(p => p.v != null).sort((a, b) => a.t - b.t);
/* Bottle roll: feed and tails by size; recovery by size from each fraction's grades, and with the masses the calculated head and tails. */
function brtCalc(items){
  const one = (f, side) => items.find(x => (x.s.details || {})["Size fraction"] === f && (x.s.details || {}).BRT === side);
  const mass = x => { const m = +String((x?.s.details || {})["Mass (g)"] || "").replace(",", "."); return m > 0 ? m : null; };
  const fr = BRT_FR.map(([f, l]) => { const a = one(f, "Feed"), b = one(f, "Tails"); const F = a ? resNum(a.rows?.Au) : null, T = b ? resNum(b.rows?.Au) : null;
    return { f, l, a, b, F, T, mF: mass(a), mT: mass(b), rec: F > 0 && T != null ? (F - T) / F * 100 : null }; }).filter(x => x.a || x.b);
  const withF = fr.filter(x => x.F != null), withT = fr.filter(x => x.T != null);
  const head = withF.length && withF.every(x => x.mF) ? withF.reduce((a, x) => a + x.mF * x.F, 0) / withF.reduce((a, x) => a + x.mF, 0) : null;
  const tails = withT.length && withT.every(x => x.mT) ? withT.reduce((a, x) => a + x.mT * x.T, 0) / withT.reduce((a, x) => a + x.mT, 0) : null;
  const units = head != null ? withF.reduce((a, x) => a + x.mF * x.F, 0) : 0; fr.forEach(x => { x.dist = head != null && x.F != null ? x.mF * x.F / units * 100 : null; });
  const fil = items.find(x => ptOf(x.s) === "BRT filtrate");
  return { fr, head, tails, rec: head > 0 && tails != null ? (head - tails) / head * 100 : null, fil: fil ? resNum(fil.rows?.Au_s) : null, filId: fil?.s.id, needM: fr.some(x => (x.a && !x.mF) || (x.b && !x.mT)) };
}
const brtShows = items => brtCalc(items).fr.filter(x => x.F != null || x.T != null).length >= 2;
function brtTiles(b){
  return [["Calculated head", b.head != null ? `${vzG(b.head)} g/t` : "—", b.head != null ? "feed fractions, weighted by mass" : "needs the feed masses"],
    ["Calculated tails", b.tails != null ? `${vzG(b.tails)} g/t` : "—", b.tails != null ? "tails fractions, weighted by mass" : "needs the tails masses"],
    ["Overall recovery", b.rec != null ? vzPct(b.rec) : "—", b.rec != null ? "from the calculated head and tails" : "needs every fraction's mass"],
    ...(b.fil != null ? [["Filtrate", `${vzNum(b.fil)} mg/L`, "gold in solution after the roll"]] : [])];
}
/* Horizontal bars for a share (recovery by size, preg-robbing index): 16 px bars from zero, the value at the tip. */
function vzBars(rows, w, o = {}){
  const L = o.L || 120, R = 56, rh = 28, T = 6, h = T + rows.length * rh + 22, max = Math.max(100, ...rows.map(r => r.v || 0)), X = v => L + Math.max(0, Math.min(v, max)) / max * (w - L - R);
  return `<svg class="vz-svg vz-bars" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(o.title || "")}">
    ${[0, 25, 50, 75, 100].map(v => `<line class="vz-grid" x1="${X(v).toFixed(1)}" x2="${X(v).toFixed(1)}" y1="${T}" y2="${T + rows.length * rh}"/><text class="vz-tick" x="${X(v).toFixed(1)}" y="${T + rows.length * rh + 16}" text-anchor="middle">${v}%</text>`).join("")}
    ${rows.map((r, i) => { const y = T + i * rh + 6, x1 = X(r.v || 0), bw = Math.max(0, x1 - L);
      return `<g><title>${esc(r.label)}: ${esc(r.v == null ? "—" : vzPct(r.v))}</title><text class="vz-tick vz-lab" x="${L - 8}" y="${y + 12}" text-anchor="end">${esc(r.label)}</text>
        ${r.v != null && bw > 0 ? `<path class="vz-bar" d="M${L},${y} h${Math.max(0, bw - 4).toFixed(1)} a4,4 0 0 1 4,4 v8 a4,4 0 0 1 -4,4 h-${Math.max(0, bw - 4).toFixed(1)} z"/>` : ""}
        <text class="vz-val" x="${(r.v != null && bw > 0 ? x1 : L) + 6}" y="${y + 12}">${esc(r.v == null ? "—" : vzPct(r.v))}</text></g>`; }).join("")}
  </svg>`;
}
function brtTable(b, edit){
  const mIn = (x, side) => { const s = side === "Feed" ? x.a : x.b, m = side === "Feed" ? x.mF : x.mT; return !s ? "—" : edit ? `<input class="inp vz-mass" data-brtm="${esc(s.s.id)}" value="${m ?? ""}" inputmode="decimal" placeholder="g" aria-label="${esc(side)} ${esc(x.l)} mass in grams">` : m != null ? String(m) : "—"; };
  return `<table class="vz-t"><thead><tr><th>Fraction</th><th>Feed mass (g)</th><th>Feed AuFx (g/t)</th><th>Tails mass (g)</th><th>Tails AuFx (g/t)</th><th>Recovery</th><th>Gold in the feed</th></tr></thead><tbody>
    ${b.fr.map(x => `<tr><td>${esc(x.l)}</td><td class="mono">${mIn(x, "Feed")}</td><td class="mono">${vzG(x.F)}</td><td class="mono">${mIn(x, "Tails")}</td><td class="mono">${vzG(x.T)}</td><td class="mono"><b>${vzPct(x.rec)}</b></td><td class="mono">${vzPct(x.dist)}</td></tr>`).join("")}
    ${b.head != null || b.tails != null ? `<tr class="vz-tot"><td><b>Calculated</b></td><td class="mono">${b.head != null ? Math.round(b.fr.reduce((a, x) => a + (x.mF || 0), 0)) : "—"}</td><td class="mono"><b>${vzG(b.head)}</b></td><td class="mono">${b.tails != null ? Math.round(b.fr.reduce((a, x) => a + (x.mT || 0), 0)) : "—"}</td><td class="mono"><b>${vzG(b.tails)}</b></td><td class="mono"><b>${vzPct(b.rec)}</b></td><td class="mono">${b.head != null ? "100.0%" : "—"}</td></tr>` : ""}</tbody></table>`;
}
async function brtSaveMasses(){
  if (!canEdit() || !current?.batch) return;
  const els = [...document.querySelectorAll("[data-brtm]")], want = new Map();
  for (const el of els){ const raw = el.value.trim().replace(",", "."); if (raw && !(+raw > 0)){ toast("A mass is a number of grams above 0."); el.focus(); return; } want.set(el.dataset.brtm, raw ? String(+raw) : ""); }
  const ids = [...want.keys()].filter(id => { const s = current.docs.find(d => d.id === id); return s && ((s.details || {})["Mass (g)"] || "") !== want.get(id); });
  if (!ids.length){ toast("No mass changed."); return; }
  const ok = await pool(ids, 4, id => sampleWrite(id, s => { const d = { ...(s.details || {}) }; if (want.get(id)) d["Mass (g)"] = want.get(id); else delete d["Mass (g)"]; return { details: d }; }));
  toast(ok === ids.length ? `Masses saved: ${nS(ok)}` : `${ok} of ${ids.length} saved. Try the others again.`);
  if (current?.batch) renderTrack();
}
/* Preg-robbing: each test (ore with the spiked solution) against its control; index = gold the ore took out of solution, as a share of the control's. */
function pregCalc(items){
  const by = new Map();
  items.forEach(x => { const d = x.s.details || {}, k = d["Preg-rob pair"]; if (!k || !d["Preg-rob"]) return; const e = by.get(k) || { k }; e[d["Preg-rob"] === "Control" ? "c" : "t"] = x; by.set(k, e); });
  const rows = [...by.values()].sort((a, b) => a.k.localeCompare(b.k)).map(e => { const T = e.t ? resNum(e.t.rows?.Au_s) : null, C = e.c ? resNum(e.c.rows?.Au_s) : null;
    return { k: e.k, tCode: e.t ? tagText(e.t.s) || e.t.s.id : "—", cCode: e.c ? tagText(e.c.s) || e.c.s.id : "—", T, C, pri: C > 0 && T != null ? (C - T) / C * 100 : null }; });
  const spike = items.map(x => (x.s.details || {})["Spike (mg/L)"]).find(Boolean) || "";
  return { rows, spike, done: rows.filter(r => r.pri != null) };
}
const pregShows = items => pregCalc(items).done.length >= 1;
function pregTiles(p){
  const d = p.done, avg = d.reduce((a, r) => a + r.pri, 0) / (d.length || 1), hi = d.reduce((a, r) => r.pri > a.pri ? r : a, d[0]), lo = d.reduce((a, r) => r.pri < a.pri ? r : a, d[0]);
  return [["Preg-robbing index, average", vzPct(avg), `${d.length} sample${d.length === 1 ? "" : "s"}`], ["Highest", vzPct(hi.pri), `sample ${hi.k}`], ["Lowest", vzPct(lo.pri), `sample ${lo.k}`], ...(p.spike ? [["Spike", `${p.spike} mg/L`, "gold added to the solution"]] : [])];
}
const pregTable = (p, cls = "vz-t") => `<table class="${cls}"><thead><tr><th>Sample</th><th>Test</th><th>AuSx (mg/L)</th><th>Control</th><th>AuSx (mg/L)</th><th>Preg-robbing index</th></tr></thead><tbody>
  ${p.rows.map(r => `<tr><td class="mono">${esc(r.k)}</td><td class="mono">${esc(r.tCode)}</td><td class="mono">${vzNum(r.T)}</td><td class="mono">${esc(r.cCode)}</td><td class="mono">${vzNum(r.C)}</td><td class="mono"><b>${vzPct(r.pri)}</b></td></tr>`).join("")}</tbody></table>`;
const PREG_NOTE = "Preg-robbing index = (control − test) ÷ control: the share of the spiked gold the ore took out of solution.";
const BRT_NOTE = "Recovery by size = (feed − tails) ÷ feed for each fraction. The calculated head and tails weight each fraction's grade by its mass; overall recovery = (head − tails) ÷ head. −53A from wet sizing, −53B from dry sizing.";
/* A bar chart's place on the batch page: drawn at the panel's width. */
function vzBarSlot(id, rows, o){ vzStore.set(id, { bars: rows, ...o }); return `<div class="vz-chart vz-barbox" id="${id}" aria-label="${esc(o.title)}"></div>`; }

/* ---- the panels ---- */
/* 21 Oct: worked out here for the MET Lab from the reported values; the certificate reports the assays only. */
const MET_OWN = `<div class="small vz-own">The MET Lab's working, from the results: on this page only, not on the certificate.</div>`;
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
  if (tankShows(items)){
    const p = tankProfile(items), cs = tankCharts(p);
    out += `<div class="panel stack vz" id="vzTank"><div><h3 style="margin:0">Tank profile</h3><div class="small muted">Gold in the solids and in solution from the pre-leach feed down the CIL tanks</div>${MET_OWN}</div>
      ${vzTilesHtml(tankTiles(p))}<div class="vz-pair">${cs.map((o, i) => `<div><div class="vz-ct-t">${esc(o.title)}</div>${vzSlot("vzTankC" + i, o)}</div>`).join("")}</div>
      <details class="vz-more" id="vzTankTbl"><summary>Values</summary><div class="tbl-wrap">${tankTable(p)}</div></details></div>`;
  }
  const cb = carbonByTank(items);
  if (cb.length >= 3){
    const o = { key: "cb" + cb.map(x => x.v).join(","), title: "Gold on carbon tank by tank (g/t)", yunit: "g/t", xunit: "", zero: true, h: 220, xticks: cb.map(x => x.t), xfmt: t => "T" + t, xname: t => `Tank ${t}`, series: [{ label: "Au loading", color: "var(--vz-1)", pts: cb }] };
    out += `<div class="panel stack vz" id="vzCarb"><div><h3 style="margin:0">Carbon in the CIL tanks</h3><div class="small muted">Gold on carbon, g/t, tank 1 to 11</div></div>${vzSlot("vzCarbC", o)}
      <details class="vz-more" id="vzCarbTbl"><summary>Values</summary><div class="tbl-wrap"><table class="vz-t"><thead><tr><th>Tank</th><th>Au loading (g/t)</th></tr></thead><tbody>${cb.map(x => `<tr><td>Tank ${x.t}</td><td class="mono">${vzNum(x.v)}</td></tr>`).join("")}</tbody></table></div></details></div>`;
  }
  if (brtShows(items)){
    const b = brtCalc(items), edit = canEdit(), rows = b.fr.map(x => ({ label: x.l, v: x.rec }));
    out += `<div class="panel stack vz" id="vzBrt"><div><h3 style="margin:0">Bottle roll</h3><div class="small muted">Recovery by size from the feed and tails fractions${b.needM ? ". Type the fraction masses for the calculated head, tails and overall recovery." : ""}</div>${MET_OWN}</div>
      ${vzTilesHtml(brtTiles(b))}<div><div class="vz-ct-t">Recovery by size</div>${vzBarSlot("vzBrtC", rows, { key: "brt" + rows.map(r => r.v).join(","), title: "Recovery by size fraction", L: 136 })}</div>
      <div class="tbl-wrap">${brtTable(b, edit)}</div>${edit ? `<div class="row"><button type="button" class="btn" id="brtSave">Save masses</button></div>` : ""}<div class="small muted">${esc(BRT_NOTE)}</div></div>`;
  }
  if (pregShows(items)){
    const p = pregCalc(items), rows = p.rows.map(r => ({ label: `${r.k}`, v: r.pri }));
    out += `<div class="panel stack vz" id="vzPreg"><div><h3 style="margin:0">Preg-robbing</h3><div class="small muted">Each test against its control</div>${MET_OWN}</div>
      ${vzTilesHtml(pregTiles(p))}<div><div class="vz-ct-t">Preg-robbing index by sample</div>${vzBarSlot("vzPregC", rows, { key: "preg" + rows.map(r => r.v).join(","), title: "Preg-robbing index by sample", L: 44 })}</div>
      <details class="vz-more" id="vzPregTbl"><summary>Values</summary><div class="tbl-wrap">${pregTable(p)}</div></details><div class="small muted">${esc(PREG_NOTE)}</div></div>`;
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
  const cb = carbonByTank(items);
  if (cb.length >= 3){
    const o = { title: "Gold on carbon tank by tank (g/t)", yunit: "g/t", xunit: "", zero: true, xticks: cb.map(x => x.t), xfmt: t => "T" + t, series: [{ label: "Au loading", color: "var(--vz-1)", pts: cb }] };
    out += `<div class="cert-fig vz"><h4 class="cert-sec">Carbon in the CIL tanks: gold on carbon (g/t)</h4>${vzSvg(o, 680, 200).html}</div>`;
  }
  // 21 Oct: the MET Lab's own working (tank profile, bottle roll recovery, preg-robbing index) is on the batch page only; the certificate
  // reports the assays (Zuriel: "MET Lab jobs are done in the MET Lab, only final samples are submitted to the assay lab")
  return out;
}
