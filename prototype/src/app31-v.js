
/* ---------- v31 (21 Oct): "We need some flexibility and efficiency in the site. it cannot be too strict."
   1. A first code and the date make the codes: MLABPPS01 on 21 Oct gives MLABPPS0120261021, and the count goes on for the rest of the
      samples (MLABPPS0220261021 …). ID groups: several series in one submission (the MET Lab's QA/QC set: PPS, CB and SL), each with its own
      first code and number of samples, on Batch, Shift end and MET Lab job alike; a template remembers its groups.
   2. Several analyses on one sample: the main one (it picks the route) plus ticks of the type's other analyses and any analysis typed by
      name ("Other analysis"). A typed analysis gets an analysis step of its own and a result to fill in before release.
   3. Other testwork: a job of whatever comes up, named by the submitter, beside the routine templates. ---------- */

/* The count at the end of a first code goes on, keeping its width (01 → 02 … 99 → 100, 001 → 002). A code without one counts from 01;
   a group of one sample takes the code as typed (a space typed before the date stays: MLNSCOF 20261018). */
function seriesCode(f, j, n = 2){
  const t = String(f || ""), m = t.match(/^(.*?)(\d+)(\s*)$/);
  if (m) return m[1] + String(+m[2] + j).padStart(m[2].length, "0") + m[3];
  if (n === 1) return t;
  const w = t.match(/^(.*?)(\s*)$/);
  return w[1] + pad2(j + 1) + w[2];
}
/* A first code typed with its date (MLABPPS0120261021) keeps MLABPPS01; the date goes to the date box. */
const DATED = /^(.*[A-Za-z].*?)(20\d\d(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01]))$/;
const splitDated = f => { const m = String(f || "").trim().match(DATED); return m ? { f: m[1], d: `${m[2].slice(0, 4)}-${m[2].slice(4, 6)}-${m[2].slice(6)}` } : null; };
const groupCode = (g, j, date) => normTag(seriesCode(g.f, j, +g.n || 1) + dayCode(date));
const hasFirst = g => !!String(g?.f || "").trim();
const IDG_MAX = 10;
/* v32 (21 Oct): "the 'ID groups' tab should come before the list of groups ... give the ID formation section some light colors and borders,
   let it be visible and look sectioned ... the site shouldn't look bulky". The number of groups (and a batch's date) on a filled strip
   first, then one small box per group: its name and the codes it makes on one line, then its first code, how many samples (a batch of one
   group counts its rows instead) and anything else the form asks (a job: type, analysis, More). o.zero: a template of fixed rows, where
   no group means the template's own codes. */
function idgBlock(p, gs, o = {}){
  const many = gs.length > 1, ns = [...(o.zero ? [0] : []), ...Array.from({ length: IDG_MAX }, (_, k) => k + 1)];
  return `<div class="idg${gs.length ? "" : " none"}" id="${p}Idg"><div class="idg-head">
      <label class="g-cf"><span>ID groups</span><select class="inp" id="${p}Gn" aria-label="Number of ID groups">${ns.map(k => `<option value="${k}" ${k === gs.length ? "selected" : ""}>${k || "None: template codes"}</option>`).join("")}</select></label>
      ${o.date != null ? `<label class="g-df"><span>Date on the codes</span><input class="inp" id="${p}GDate" type="date" value="${esc(o.date)}"></label>` : ""}</div>
    ${gs.map((g, i) => `<div class="idg-row" data-g="${i}">
      <div class="g-hd">${many || g.l ? `<b>${g.l ? esc(g.l) : `Group ${i + 1}`}</b>` : ""}<span class="g-ex mono" data-g="${i}"></span></div>
      <label class="f g-ff"><span>First code</span><input class="inp g-first" data-g="${i}" value="${esc(g.f || "")}" placeholder="e.g. MLABPPS01" maxlength="50" autocomplete="off" spellcheck="false" aria-label="First code${many ? `, group ${i + 1}` : ""}"></label>
      ${o.count || many ? `<label class="f g-nf"><span>Samples</span><input class="inp g-n" data-g="${i}" type="number" min="1" max="99" step="1" inputmode="numeric" value="${esc(g.n)}" aria-label="Samples${many ? `, group ${i + 1}` : ""}"></label>` : ""}
      ${o.extra ? o.extra(g, i) : ""}</div>`).join("")}</div>`;
}
/* The codes a group makes, first … last, under its first code. */
function idgPreview(root, gs, date){
  root?.querySelectorAll(".g-ex").forEach(el => { const g = gs[+el.dataset.g]; if (!g) return; const n = Math.max(0, +g.n || 0);
    el.textContent = hasFirst(g) && n ? `${groupCode(g, 0, date)}${n > 1 ? ` … ${groupCode(g, n - 1, date)}` : ""}` : ""; });
}
/* More or fewer groups: a new group starts empty with one sample (a job: the last group's type and analysis). min 0: a template of fixed rows. */
function resizeGroups(gs, n, blank, min = 1){
  n = Math.max(min, Math.min(IDG_MAX, n | 0));
  while (gs.length < n) gs.push(blank(gs[gs.length - 1]));
  gs.length = n;
  return gs;
}
/* Where codes made from a first code are taken already: each group that has one starts after the last of them, further on while any of
   its codes from there is taken too (taken(code, group) says). Returns the new first codes. */
async function nextFree(gs, used, date, taken){
  const by = new Map(); used.forEach(([gi, j]) => by.set(gi, Math.max(by.get(gi) ?? -1, j)));
  for (const [gi, j] of by){
    const g = gs[gi]; if (!g) continue;
    const n = Math.max(1, +g.n || 1), w = Math.max(2, n), at = k => groupCode({ ...g, n: w }, k, date);
    let s = j + 1;
    for (let tries = 0; tries < 40; tries++){
      const hit = (await Promise.all(Array.from({ length: n }, (_, k) => Promise.resolve(taken(at(s + k), gi)).catch(() => false)))).findIndex(Boolean);
      if (hit < 0) break; s += hit + 1;
    }
    g.f = seriesCode(g.f, s, w);
  }
  return [...by.keys()].map(gi => gs[gi]?.f).filter(Boolean);
}

/* ---------- a batch's ID groups ---------- */
let bGroups = [{ f: "", n: 2 }], bDate = "";
const bTotal = () => bGroups.reduce((a, g) => a + Math.max(1, +g.n || 1), 0);
/* The codes the groups make, one per row (a batch of one group: every row), or null while no group has a first code. */
function bGroupTags(n){
  if (!bGroups.some(hasFirst)) return null;
  const out = [];
  bGroups.forEach((g, gi) => { const k = bGroups.length > 1 ? Math.max(1, +g.n || 1) : n; for (let j = 0; j < k; j++) out.push(hasFirst(g) ? [groupCode({ ...g, n: k }, j, bDate)] : []); });
  return out.slice(0, n);
}
/* Row i's group and its place in it (for Next free numbers and for removing a row). */
function bRowGroup(i){
  if (bGroups.length === 1) return [0, i];
  let at = 0;
  for (let gi = 0; gi < bGroups.length; gi++){ const k = Math.max(1, +bGroups[gi].n || 1); if (i < at + k) return [gi, i - at]; at += k; }
  return [bGroups.length - 1, 0];
}
function renderBGroups(){
  const box = $("#rIdgBox"); if (!box) return;
  if (!bDate) bDate = localInput(Date.now()).slice(0, 10);
  box.innerHTML = idgBlock("rB", bGroups, { date: bDate });
  const c = $("#rCount"); if (c){ c.readOnly = bGroups.length > 1; c.title = bGroups.length > 1 ? "The groups' samples added up" : ""; }
  idgPreview(box, bGroups.length > 1 ? bGroups : [{ ...bGroups[0], n: bRows.length }], bDate);
}
const bPreview = () => idgPreview($("#rIdgBox"), bGroups.length > 1 ? bGroups : [{ ...bGroups[0], n: bRows.length }], bDate);
/* The row count follows the groups when there are several; with one group the group follows the rows. */
function bFit(){
  if (bGroups.length === 1){ bGroups[0].n = bRows.length; return; }
  const d = bRows.length - bTotal(); if (!d) return;
  const g = bGroups[bGroups.length - 1]; g.n = Math.max(1, (+g.n || 1) + d);
}
function bindBGroups(v){
  bGroups = [{ f: "", n: bRows.length }]; bDate = localInput(Date.now()).slice(0, 10);
  const box = $("#rIdgBox", v); if (!box) return;
  renderBGroups();
  box.addEventListener("input", e => {
    const el = e.target, g = bGroups[+el.dataset.g];
    if (el.classList.contains("g-first") && g){ g.f = el.value; rowHints(); bPreview(); }
    else if (el.classList.contains("g-n") && g){ const n = Math.floor(+el.value); if (!(n >= 1 && n <= 99)) return;
      if (bTotal() - (+g.n || 1) + n > 100){ el.value = g.n; return toast("Up to 100 samples in one batch."); }
      bGroupResize(+el.dataset.g, n); }
    else if (el.id === "rBGDate"){ bDate = el.value; rowHints(); bPreview(); }
  });
  box.addEventListener("change", e => {
    const el = e.target;
    if (el.classList.contains("g-first")){ const g = bGroups[+el.dataset.g], d = splitDated(el.value); if (g && d){ g.f = d.f; el.value = d.f; bDate = d.d; const di = $("#rBGDate"); if (di) di.value = d.d; rowHints(); bPreview(); } }
    else if (el.classList.contains("g-n")){ const g = bGroups[+el.dataset.g]; if (g) el.value = g.n; }
    else if (el.id === "rBGn"){
      const was = bGroups.length; if (was === 1) bGroups[0].n = bRows.length;
      resizeGroups(bGroups, +el.value, () => ({ f: "", n: 1 }));
      if (bGroups.length === 1) bGroups[0].n = Math.max(2, bGroups[0].n);
      if (bTotal() > 100){ toast("Up to 100 samples in one batch."); }
      setRowCount(Math.min(100, bTotal())); $("#rCount").value = bRows.length; bFit(); renderBGroups(); rowHints();
      if (bGroups.length > was) box.querySelector(`.g-first[data-g="${bGroups.length - 1}"]`)?.focus();
    }
  });
}

/* v32: one group of a batch grows or shrinks at its own end (the rows of the groups after it keep what was typed on them). */
function bGroupResize(gi, n){
  const g = bGroups[gi]; if (!g) return;
  if (bGroups.length === 1){ g.n = n; return setRowCount(n); }
  const start = bGroups.slice(0, gi).reduce((a, x) => a + Math.max(1, +x.n || 1), 0), k = Math.max(1, +g.n || 1);
  if (n > k) bRows.splice(start + k, 0, ...Array.from({ length: n - k }, () => ({ code: "", src: "" }))); else bRows.splice(start + n, k - n);
  g.n = n; $("#rCount").value = bRows.length; renderRows(); bPreview();
}
/* A batch whose codes from a first code are on open samples already: those rows are marked, and the groups can start after the last of them. */
function offerFree(took){
  document.querySelectorAll("#rRows .r-code").forEach(el => el.classList.toggle("taken", took.some(([i]) => i === +el.dataset.i)));
  toast(`${took[0][1]}${took.length > 1 ? ` and ${took.length - 1} more` : ""}: already on open samples for this analysis.`);
  const info = $("#rRowInfo"); if (!info) return;
  rowHints.took = took.map(([i, t]) => [i, t]);   // v32: the offer stays while those codes do
  info.classList.remove("bad-t");
  info.innerHTML = `<span class="bad-t">${took.length} taken</span> <button type="button" class="btn small" id="rFree">Next free numbers</button>`;
  $("#rFree").onclick = async e => { e.target.disabled = true; e.target.textContent = "Checking…"; const te = $("#rTest")?.value || "";
    const fs = await nextFree(bGroups, took.map(([i]) => bRowGroup(i)), bDate, async c => !!(await tagOwner(c, te))); renderBGroups(); renderRows(); toast(`Now from ${fs.join(", ")}`); };
}

/* ---------- several analyses on one sample ---------- */
/* Typed analyses: up to 8 names, each up to 40 characters. */
const splitAn = t => { const seen = new Set(); return String(t || "").split(/[,;\n]+/).map(x => x.trim().replace(/\s+/g, " ").slice(0, 40)).filter(x => x && !seen.has(x.toLowerCase()) && seen.add(x.toLowerCase())).slice(0, 8); };
/* A typed analysis is a result read as written (a number with its unit, or words), required before release. Its code comes from its
   name, so the same analysis on two samples shares a column on the certificate. */
const xKey = (n, taken) => { let k = "x_" + (n.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 24) || "an"), b = k, i = 2; while (taken.has(k)) k = `${b}_${i++}`; taken.add(k); return k; };
function xAns(xa, have = []){ const taken = new Set(have.map(a => a.k)); return (xa || []).map(n => ({ k: xKey(n, taken), n, u: "", dp: 0, t: "text", x: true })); }
/* The analyses a sample is sent for, as one name: the main one and the others (AuFx & AuSx + Cyanide: NaCN, WAD & pH + Cu). */
const anNames = (main, t2, xa) => [...(main && main !== "x" ? [testOf(main)?.name || main] : []), ...(t2 || []).map(k => testOf(k)?.name || k), ...(xa || [])].join(" + ");
const anShortName = k => (testOf(k)?.name || k).replace(/^[^:]*:\s*/, "");
/* Ticks of the type's other analyses and a box for any other, folded under the main analysis. A sample sent only for a typed analysis
   ("Other (type it)") opens it. */
const anKeys = (typeKey, main, t2 = []) => { const t = typeOf(typeKey); return !t ? [] : (t.key === "other" ? TESTS.map(x => x.key) : typeTests(t)).filter(k => k !== main && (testOn(k) || t2.includes(k))); };
const anLabel = (typeKey, main, t2 = [], xa = []) => { const on = t2.filter(k => anKeys(typeKey, main, t2).includes(k)), n = [...on.map(anShortName), ...xa]; return n.length ? `+ ${n.join(", ")}` : ""; };
function anMoreBody(typeKey, main, t2 = [], xa = []){
  const keys = anKeys(typeKey, main, t2);
  return `${keys.length ? `<div class="checks">${keys.map(k => `<label><input type="checkbox" value="${esc(k)}" ${t2.includes(k) ? "checked" : ""}> ${esc(testOf(k)?.name || k)}</label>`).join("")}</div>` : ""}
    <label class="f an-xf"><span>Other analysis${main === "x" ? ` <span class="req">*</span>` : ""}</span><input class="inp an-x" maxlength="200" value="${esc(xa.join(", "))}" placeholder="Type it, e.g. Cu, moisture" autocomplete="off"></label>`;
}
function anMore(id, typeKey, main, t2 = [], xa = []){
  const sum = anLabel(typeKey, main, t2, xa);
  return `<details class="an-more" id="${id}"${sum || main === "x" ? " open" : ""}><summary>${esc(sum || "+ More analyses")}</summary>${anMoreBody(typeKey, main, t2, xa)}</details>`;
}
function anRead(box){ if (!box) return { tests2: [], xan: [] }; return { tests2: [...box.querySelectorAll('.checks input[type="checkbox"]:checked')].map(x => x.value), xan: splitAn(box.querySelector(".an-x")?.value) }; }
function anSum(box){ const s = box?.querySelector("summary"); if (!s) return; const a = anRead(box), n = [...a.tests2.map(anShortName), ...a.xan]; s.textContent = n.length ? `+ ${n.join(", ")}` : box.classList.contains("mini") ? "+ More" : "+ More analyses"; }
/* The single sample's and the batch's: rebuilt when the type or the main analysis changes, keeping what is still offered. */
function renderAnBox(keep){
  const box = $("#rAnBox"); if (!box) return;
  const ty = $("#rType")?.value || "", te = $("#rTest")?.value || "", was = keep || anRead(box.querySelector(".an-more"));
  box.innerHTML = ty ? anMore("rAnMore", ty, te, was.tests2, was.xan) : "";
}
const xOpt = (ty, sel) => ty ? `<option value="x" ${sel === "x" ? "selected" : ""}>Other (type it)</option>` : "";
/* The steps the other analyses add to the main route's: each ticked analysis's own preparation and analysis steps that the plan does not
   have yet (after the last step of the same kind), and one step for the typed ones, all before Results released. */
const PH_RANK = { await: 0, intake: 1, prep: 2, test: 3, qc: 4, report: 5, store: 6 };
const xanStep = xa => ("Analysis: " + xa.join(", ")).slice(0, 80);
function extraSteps(plan, t2, xa, typeKey, purposeKey){
  const p = plan.map(x => ({ ...x })), rel = () => { const i = p.findIndex(x => x.target); return i < 0 ? p.length : i; };
  const put = x => { const r = rel(); let at = 0; p.forEach((y, i) => { if (i < r && (PH_RANK[y.phase] ?? 3) <= (PH_RANK[x.phase] ?? 3)) at = i; }); p.splice(at + 1, 0, x); };
  for (const k of t2 || []){
    const r = routeFor(typeKey, k, purposeKey); if (!r) continue;
    for (const x0 of buildPlan(r).slice(2, -2)){
      const { redo, ...x } = x0, same = p.find(y => y.key === x.key);
      if (same && same.name === x.name) continue;
      if (same) x.key = `${String(r.code).toLowerCase().replace(/[^a-z0-9]/g, "")}_${x.key}`;
      if (!p.some(y => y.key === x.key)) put(x);
    }
  }
  if ((xa || []).length){ const s = p.find(x => x.key === "xan"); if (s) s.name = xanStep(xa); else put({ key: "xan", name: xanStep(xa), hours: 4, phase: "test" }); }
  return p;
}
/* What a submission stores for its other analyses (nothing when there are none). */
const anFields = (main, t2, xa) => { t2 = (t2 || []).filter(k => k && k !== main); return t2.length || (xa || []).length ? { tests2: t2, xan: xa || [], testName: anNames(main, t2, xa) } : {}; };

/* ---------- a select of a fixed list takes a typed value too ---------- */
/* The details on a sample's form (sampling point, shift…): "Other…" at the end of a list opens a box to type it. */
const OTHER_V = "__other";
const detailVal = k => { const el = $("#rD_" + k); if (!el) return ""; return (el.value === OTHER_V ? $("#rD_" + k + "_x")?.value.trim() || "Other" : el.value || "").trim().slice(0, 80); };
document.addEventListener("change", e => {
  const el = e.target; if (!el.matches || !el.matches('#rDetails select[id^="rD_"]')) return;
  const x = $("#" + el.id + "_x"); if (!x) return;
  x.hidden = el.value !== OTHER_V; if (!x.hidden) x.focus();
});

/* v32: Enter in an ID group, a job's rows or numbers, or the batch box goes to the next box; it never sends the form (one Enter after
   editing a code sent a whole shift). The batch rows move down a row themselves. */
document.addEventListener("keydown", e => {
  const el = e.target; if (e.key !== "Enter" || e.isComposing || !el.matches || !el.matches("input:not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button])")) return;
  if (!el.closest("#rIdgBox,#jIdg,#jRows,#jNums,#rBatch,#rJob") || el.closest("#rRows")) return;
  e.preventDefault();
  const all = [...(el.form || document).querySelectorAll("input:not([type=hidden]):not([disabled]),select:not([disabled]),textarea:not([disabled])")].filter(x => x.offsetParent), i = all.indexOf(el);
  (all[i + 1] || el).focus();
});
