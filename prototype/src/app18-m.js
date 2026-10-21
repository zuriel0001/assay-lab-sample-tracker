/* ---------- results files: what a lab report says, and where each result goes ---------- */
const normKey = t => String(t || "").toUpperCase().replace(/\s+/g, "");
const normCol = t => String(t || "").toLowerCase().replace(/[\s_()\[\]]/g, "");
const ELEMENTS = new Set("H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Nd Sm Eu Gd Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Th U".split(" "));
/* What a result measures, so a report column can be matched to it: the element for an assay (Au, Au_s and Au_c are all gold), else its code. */
const AN_CONCEPT = { cn: "free", wad_in: "wad", wad_rep: "wad", total: "cntot", sol: "solids", ufd: "solids" };
const conceptOf = a => { const sym = a.k.split("_")[0]; return ELEMENTS.has(sym) ? sym : AN_CONCEPT[a.k] || a.k; };
/* Column names lab reports use besides element symbols (Au) and symbols with a method code after them (AuFA, AuSX, AgSX). The lab manager
   adds others under Settings › Results files. NaCN is read as free cyanide, as the plant reports it. */
const COL_NAMES = { nacn: "free", cnfree: "free", freecn: "free", "cn-free": "free", freecyanide: "free", cnwad: "wad", wadcn: "wad", wad: "wad", "cn-wad": "wad", wadcyanide: "wad",
  cntot: "cntot", cntotal: "cntot", totalcn: "cntot", tcn: "cntot", ph: "pH", naoh: "naoh", "%solids": "solids", solids: "solids", "%sol": "solids", "%h2o": "h2o", h2o: "h2o", moisture: "h2o",
  "%moisture": "h2o", scn: "scn", sg: "sg", p80: "p80", ec: "ec", conductivity: "ec", tss: "tss" };
const UNIT_GROUPS = [["g/t", "ppm", "mg/kg"], ["mg/l"], ["ppb", "ug/kg", "mg/t"], ["g/l"], ["kg/t"]];
const unitNorm = u => String(u || "").toLowerCase().replace(/\s+/g, "").replace(/^-+$/, "").replace(/µ/g, "u");
/* How well a report column's unit fits a result's unit: 3 the same, 2 the same quantity (ppm and g/t), 1 not stated or ppm for mg/L, 0 not. */
function unitScore(fu, au){
  const f = unitNorm(fu), a = unitNorm(au);
  if (!f) return 1;
  if (f === a) return 3;
  if (f.startsWith("%") && a.startsWith("%")) return 2;
  const g = u => UNIT_GROUPS.findIndex(x => x.includes(u)), gf = g(f);
  if (gf >= 0 && gf === g(a)) return 2;
  return (f === "ppm" && a === "mg/l") || (f === "mg/l" && a === "ppm") ? 1 : 0;
}
function colConcept(name){
  const n = normCol(name); if (!n) return "";
  const own = (cfg.cols || []).find(c => normCol(c.n) === n); if (own) return own.c || "";
  if (COL_NAMES[n]) return COL_NAMES[n];
  const t = String(name).trim();
  if (ELEMENTS.has(t)) return t;
  // A two-letter symbol may run into its method code (AuFA, AgSX); a one-letter one needs a separator (S_LECO), so NACN is not nitrogen.
  const m = t.match(/^([A-Z][a-z])[-_ ]?([A-Z]{1,6}\d{0,3}|[a-z]{2,5})$/) || t.match(/^([A-Z])[-_ ]([A-Z]{1,6}\d{0,3}|[a-z]{2,5})$/);
  return m && ELEMENTS.has(m[1]) ? m[1] : "";
}
/* A method code after the symbol says solids or solution: AuFA is fire assay (solids), AuSX solvent extraction (solution). */
const colPhase = name => { const m = String(name || "").trim().match(/^[A-Z][a-z]?[-_ ]?([A-Za-z]{2,6})\d{0,3}$/); return !m ? "" : /^(sx|sol)/i.test(m[1]) ? "sol" : /^(fa|faa|grav|gr)$/i.test(m[1]) ? "solid" : ""; };
const anPhase = a => { const u = unitNorm(a.u); return /_s$/.test(a.k) || u === "mg/l" ? "sol" : UNIT_GROUPS[0].includes(u) || u === "ppb" ? "solid" : ""; };
const phaseFits = (name, a) => { const c = colPhase(name), p = anPhase(a); return !c || !p || c === p; };
const nameIs = (col, a) => { const n = normCol(col); return !!n && (n === normCol(a.k) || n === normCol(anShort(a)) || n === normCol(a.n) || (a.alt || []).some(x => normCol(x) === n)); };
/* Everything a result can be read as, for Settings: one entry per element or measurement, named after the first result that reports it. */
function readAsList(){
  const m = new Map();
  for (const r of Object.values(RESULTS)) for (const a of r.an){ if (a.calc || a.t) continue; const c = conceptOf(a); if (!m.has(c)) m.set(c, ELEMENTS.has(c) ? `${a.k === c ? a.n.replace(/,.*$/, "") : c} (${c})` : a.n.replace(/,.*$/, "")); }
  return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
}
const UNIT_RE = /^(g\/t|ppm|ppb|mg\/l|mg\/kg|g\/l|%|-|ug\/l|µg\/l|kg\/t|wt%|%solids|um|µm|ppt|mg\/t|s\.g\.)$/i;
const isRead = t => /^[<>]=?\s*[\d.]/.test(t) || /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t) || /^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t) || /^\d+,\d+$/.test(t) || /^(nd|n\.d\.?|bdl|lnr|is|ns|nss)$/i.test(t);
function splitHead(h){
  let m = h.match(/^(.*?)\s*[(\[]\s*([^)\]]*?)\s*[)\]]\s*$/); if (m && m[1]) return { name: m[1].trim(), unit: m[2] };
  m = h.match(/^(\S+)\s+(g\/t|ppm|ppb|mg\/l|mg\/kg|g\/l|%)$/i); if (m) return { name: m[1], unit: m[2] };
  m = h.match(/^([A-Z][a-z]?)_(ppm|ppb|gpt|pct)$/); if (m) return { name: m[1], unit: { gpt: "g/t", pct: "%" }[m[2]] || m[2] };
  return { name: h.trim(), unit: "" };
}
/* The register's current ID for a reference material named in a report (an old ID still counts). */
const crmFromFile = id => { const k = normKey(id); const c = (cfg.crms || []).find(x => normKey(x.id) === k || (x.was || []).some(w => normKey(w) === k)); return c ? c.id : ""; };
/* Known samples by every name a report may use: the tracker ID, each site sample code (tags) and the site reference. */
/* v24d: a file attached to a sample or a batch reads a code as that sample's, or that batch's, first (one code can be on two open samples,
   for two analyses). */
function sampleIndex(scope){
  const idx = new Map(), add = s => { if (!s || !s.id) return; [s.id, ...(s.tags || []), s.siteRef].filter(Boolean).forEach(k => { const n = normKey(k); if (n && !idx.has(n)) idx.set(n, s.id); }); };
  const own = s => !!s && !!scope && ((scope.sample && s.id === scope.sample) || (scope.sub && s.batchId === scope.sub));
  if (scope && (scope.sample || scope.sub)) [...samples.values(), ...batchSamps.values(), ...(current?.docs || []), current?.body].forEach(s => { if (own(s)) add(s); });
  samples.forEach(add); batchSamps.forEach(add); if (current?.body) add(current.body);
  return idx;
}
const rightFill = row => { const out = []; let carry = ""; for (let j = row.length - 1; j >= 0; j--){ if (row[j]) carry = row[j]; out[j] = carry; } return out; };
/* Reads a report laid out as a table: a sample column, one column per result (with units and method codes in rows above it, as the lab's
   LIMS prints them, or in the heading as "Au (g/t)"), repeat readings in a second column of the same result (Rep 2), and reference material
   readings in a table of expected and reported values at the foot, or as rows named after the material. */
let knownMemo = null;
const knownNames = () => knownMemo || (knownMemo = new Set(Object.values(RESULTS).flatMap(r => r.an).filter(a => !a.t && !a.calc).flatMap(a => [a.s, ...(a.alt || [])]).filter(Boolean).map(normCol)));
function parseReport(grid, idx){
  const nc = Math.max(0, ...grid.map(r => r.length)), cell = (i, j) => (grid[i] || [])[j] || "";
  const crmIds = new Map((cfg.crms || []).flatMap(c => [c.id, ...(c.was || [])].map(x => [normKey(x), c.id])));
  const rowHasRead = (i, skip) => (grid[i] || []).some((t, j) => j !== skip && t && isRead(t));
  let idCol = -1, best = 0;
  for (let j = 0; j < nc; j++){ let n = 0; for (let i = 0; i < grid.length; i++) if (idx.has(normKey(cell(i, j)))) n++; if (n > best){ best = n; idCol = j; } }
  const codeLike = t => /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9][A-Za-z0-9 ._\/#+-]{3,60}$/.test(t) && t.split(" ").length <= 2;
  if (idCol < 0){   // nothing known: the column of sample-like codes (letters and digits) on rows that carry readings
    for (let j = 0; j < nc; j++){ let n = 0; for (let i = 0; i < grid.length; i++){ const t = cell(i, j); if (codeLike(t) && rowHasRead(i, j)) n++; } if (n > best){ best = n; idCol = j; } }
  }
  if (idCol < 0) return { error: "No column of sample IDs was found in this file." };
  const kindOf = t => {
    const k = normKey(t); if (!k) return null;
    if (idx.has(k)) return { kind: "s", sid: idx.get(k) };
    const d = k.match(/^(.*?)[-_]?(DUP|DUPLICATE|REP|D|R)$/); if (d && idx.has(d[1])) return { kind: "d", sid: idx.get(d[1]) };
    if (/^(BLANK|BLK|BL|METHODBLANK|REAGENTBLANK|PREPBLANK)\d*$/.test(k)) return { kind: "bl" };
    if (crmIds.has(k)) return { kind: "crm", crm: crmIds.get(k) };
    return { kind: "x" };
  };
  let first = -1;
  for (let i = 0; i < grid.length && first < 0; i++){ const t = cell(i, idCol); if (t && rowHasRead(i, idCol) && kindOf(t)?.kind !== "x") first = i; }
  // v24d (21 Oct): none known: the first row whose cell looks like a sample code (not a letterhead with the lab's name and phone numbers)
  if (first < 0) for (let i = 0; i < grid.length && first < 0; i++) if (codeLike(cell(i, idCol)) && rowHasRead(i, idCol)) first = i;
  if (first < 0) for (let i = 0; i < grid.length && first < 0; i++) if (cell(i, idCol) && rowHasRead(i, idCol)) first = i;
  if (first < 0) return { error: "No sample readings were found in this file." };
  /* The heading row: above the first known sample, the row naming the most results (a row of mostly numbers is data, or repeat numbers).
     Units, repeat numbers and method codes sit in rows above it. */
  const isData = r => { const f = r.filter((t, j) => j !== idCol && t); return f.length > 0 && f.filter(isRead).length * 2 > f.length; };
  let head = -1, hs = 0;
  // v24d: a column named exactly as a result (Au CA-00 for carbon activity) counts too, so a title row with a stray symbol never wins
  const known = knownNames();
  for (let i = first - 1; i >= 0; i--){ const r = grid[i] || []; if (isData(r)) continue; const n = r.filter((t, j) => j !== idCol && t && (colConcept(splitHead(t).name) || known.has(normCol(splitHead(t).name)))).length; if (n > hs){ hs = n; head = i; } }
  if (head < 0) for (let i = first - 1; i >= Math.max(0, first - 3); i--){ const r = grid[i] || []; if (!isData(r) && r.filter(Boolean).length >= 2){ head = i; break; } }
  if (head < 0) return { error: "The file has no row of column names above the readings." };
  let units = null, reps = null, methods = null;
  for (let i = head - 1; i >= Math.max(0, head - 5); i--){
    const r = (grid[i] || []).map((t, j) => j === idCol ? "" : t), f = r.filter(Boolean); if (!f.length) continue;
    if (!units && f.every(t => UNIT_RE.test(t))) units = rightFill(r);
    else if (!reps && f.every(t => /^[1-9]$/.test(t))) reps = r;
    else if (!methods && f.filter(t => /^[A-Z][A-Z0-9_-]{2,}$/.test(t)).length >= Math.max(1, f.length * .7)) methods = rightFill(r);
  }
  const cols = [], seen = {};
  for (let j = 0; j < nc; j++){
    const h = cell(head, j); if (j === idCol || !h) continue;
    const sp = splitHead(h), unit = sp.unit || (units ? units[j] || "" : ""), key = normCol(sp.name) + "|" + unitNorm(unit);
    seen[key] = (seen[key] || 0) + 1;
    cols.push({ i: j, name: sp.name, unit: unit === "-" ? "" : unit, method: methods ? methods[j] || "" : "", rep: reps && /^[1-9]$/.test(reps[j] || "") ? +reps[j] : seen[key], concept: colConcept(sp.name) });
  }
  /* A screen analysis in mesh fractions (+40 … +200 … −325, % retained) is kept as the report states it, as one line ("+40 0.5 · +70 2.1 ·
     …"): the site does not work out a grind from it. */
  const mesh = cols.filter(c => /^[+-]\d{2,3}$/.test(c.name) && (!c.unit || c.unit === "%"));
  if (mesh.length >= 2){
    mesh.forEach(c => { c.used = true; });
    cols.push({ i: -1, name: "Screen analysis (% retained)", unit: "", method: mesh[0].method, rep: 1, concept: "scr", text: true,
      calc: cells => mesh.map(c => [c.name, (cells[c.i] || "").trim()]).filter(x => x[1]).map(x => x.join(" ")).join(" · ") });
  }
  const rows = [];
  let end = grid.length;
  for (let i = head + 1; i < grid.length; i++){
    const t = cell(i, idCol);
    if (!t || !cols.some(c => isRead(cell(i, c.i)))) continue;
    rows.push({ line: i + 1, key: t, cells: grid[i], ...kindOf(t) });
    end = i;
  }
  /* A foot table of reference materials: "Expected Value" and "Reported Value" columns, one material per row, "… for METHOD" in its name. */
  const crms = [];
  for (let i = end + 1; i < grid.length; i++){
    const r = grid[i] || [], ec = r.findIndex(t => /^expected/i.test(t)), rc = r.findIndex(t => /^(reported|found|measured|result)/i.test(t));
    if (ec < 0 || rc < 0) continue;
    for (let k = i + 1; k < grid.length; k++){
      const q = grid[k] || [], rep = q[rc] || ""; if (!isRead(rep)) continue;
      const label = q.slice(0, Math.min(ec, rc)).find(t => /[A-Za-z]/.test(t)) || ""; if (!label) continue;
      crms.push({ line: k + 1, id: (label.match(/^[A-Za-z0-9][A-Za-z0-9._\/-]*/) || [""])[0], label, method: (label.match(/\bfor\s+([A-Za-z0-9_-]+)/i) || [])[1] || "", expected: q[ec] || "", reported: rep });
    }
    break;
  }
  const after = (re) => { for (const r of grid.slice(0, head)) { const j = r.findIndex(t => re.test(t)); if (j >= 0){ const v = r.slice(j + 1).find(Boolean); if (v && !/:$/.test(v)) return v; } } return ""; };
  const meta = { ref: after(/^lab ref:?$/i), project: after(/^project:?$/i), received: after(/^received:?$/i), lab: /SGS/i.test((grid[0] || []).join(" ")) ? "SGS" : "" };
  return { idCol, head, cols, rows, crms, meta };
}
/* The values one report row gives for a list of results: each column goes to the one result it fits best (an exact name first, then the
   measurement and unit). r: 1 for the reading, 2 and up for repeat readings of the same sample. */
function rowValues(rep, cells, defs, r = 1, clash){
  const got = {};
  for (const c of rep.cols){
    if ((c.rep || 1) !== r) continue;
    const raw = c.calc ? c.calc(cells) : (cells[c.i] || "").trim(); if (!raw) continue;
    const ok = defs.filter(a => !a.calc && (c.text ? a.t === "text" : !a.t));
    const exact = ok.filter(a => nameIs(c.name, a) && unitScore(c.unit, a.u) > 0);
    let pick = exact.length === 1 ? exact[0] : null;
    if (!pick && c.concept){
      const sc = ok.filter(a => conceptOf(a) === c.concept && phaseFits(c.name, a)).map(a => [a, unitScore(c.unit, a.u)]).filter(x => x[1] > 0), top = Math.max(0, ...sc.map(x => x[1])), b = sc.filter(x => x[1] === top);
      if (b.length === 1) pick = b[0][0];
    }
    if (!pick) continue;
    if (got[pick.k]){ if (got[pick.k].raw !== raw && clash) clash.push(`${anShort(pick)}: ${got[pick.k].col.name} ${got[pick.k].raw} and ${c.name} ${raw}`); continue; }
    got[pick.k] = { raw, col: c }; c.used = true;   // read: not listed under Columns not read
  }
  return got;
}

/* ---------- the plan: which lab batches and sample records the file fills, and what it can't ---------- */
const readyForResults = s => { const ph = stage(s, s.stageKey)?.phase; return curIdx(s) < targetIdx(s) && (ph === "test" || ph === "qc"); };
function planUpload(rep, scope){
  const P = { batches: [], fresh: [], samples: [], notFound: [], notReady: [], awaiting: [], done: [], already: [], unknownCrm: [], bad: [], clash: [], unread: [], viaBatch: [], n: 0 };
  const bySid = new Map(), extra = new Map(), blanks = [], crmRows = [];
  for (const r of rep.rows){
    if (r.kind === "s"){ if (!bySid.has(r.sid)) bySid.set(r.sid, r); else (extra.get(r.sid) || extra.set(r.sid, []).get(r.sid)).push(r); }
    else if (r.kind === "d") (extra.get(r.sid) || extra.set(r.sid, []).get(r.sid)).push(r);
    else if (r.kind === "bl") blanks.push(r);
    else if (r.kind === "crm") crmRows.push(r);
    else P.notFound.push(r.key);
  }
  const fileCrms = [...rep.crms.map(f => ({ ...f, reg: crmFromFile(f.id) })), ...crmRows.map(r => ({ id: r.key, reg: r.crm, row: r }))];
  P.unknownCrm = [...new Set(fileCrms.filter(f => !f.reg).map(f => f.id))];
  /* The lab methods a batch's sample readings came from (AuFA under FAA505, carbon Au under ARS12D). */
  const methodsOf = (sids, ans) => { const m = new Set(); for (const sid of sids){ const row = bySid.get(sid); if (row) Object.values(rowValues(rep, row.cells, ans, 1)).forEach(v => { if (v.col.method) m.add(normCol(v.col.method)); }); } return m; };
  /* Reference material readings that fit a batch's results: the foot table by its method's columns (only a method the batch's samples were
     read by), rows by their own columns. */
  const crmReads = (ans, methods) => fileCrms.filter(f => f.reg).map(f => {
    if (f.row) return { id: f.reg, got: rowValues(rep, f.row.cells, ans, 1), line: f.row.line };
    if (f.method && methods && methods.size && !methods.has(normCol(f.method))) return null;
    const cs = f.method ? rep.cols.filter(c => normCol(c.method) === normCol(f.method)) : rep.cols;
    const fits = ans.filter(a => cs.some(c => c.concept === conceptOf(a) && unitScore(c.unit, a.u) > 0));
    return fits.length === 1 ? { id: f.reg, got: { [fits[0].k]: { raw: f.reported, col: { name: f.method || "reference material", i: -1 } } }, line: f.line } : null;
  }).filter(x => x && Object.keys(x.got).length && Object.keys(x.got).some(k => crmRow(x.id, ans.find(a => a.k === k))));
  /* Repeat readings of a sample: its Rep 2, Rep 3… columns, then further rows with its ID (or its ID and DUP). */
  const dupSources = (sid, ans) => {
    const row = bySid.get(sid), out = [];
    for (let k = 2; row && k < 6; k++){ const g = rowValues(rep, row.cells, ans, k); if (Object.keys(g).length) out.push(g); }
    for (const r of extra.get(sid) || []){ const g = rowValues(rep, r.cells, ans, 1); if (Object.keys(g).length) out.push(g); }
    return out;
  };
  const fill = (b, isNew) => {
    const ans = bAns(b), vals = {}, crms = {}, miss = [], used = new Set(), dupN = new Map(), reads = crmReads(ans, methodsOf(b.pos.filter(x => x.t === "s").map(x => x.sid), ans)), p = QC_PROFILES[b.qcp] || { names: {} };
    let bl = 0, n = 0;
    const left = new Set((b.pos || []).filter(x => !isNew && goneFrom(b, x)).map(x => x.sid));
    for (const x of b.pos){
      let got = {};
      if (x.t === "s"){ const row = bySid.get(x.sid); if (row) got = rowValues(rep, row.cells, ans, 1, P.clash); }
      else if (x.t === "pd" || x.t === "cd"){ const k = dupN.get(x.of) || 0; dupN.set(x.of, k + 1); got = dupSources(x.of, ans)[k] || {}; } else if (x.t === "bl" || x.t === "pb"){ const r = blanks[bl++]; if (r) got = rowValues(rep, r.cells, ans, 1); }
      else if (x.t === "crm"){
        const pick = reads.find(c => !used.has(c) && crmAka(c.id).includes(x.crm)) || reads.find(c => !used.has(c));
        if (pick){ used.add(pick); crms[x.p] = pick.id; got = pick.got; }
      }
      vals[x.p] = {};
      for (const ch of ans){
        // QC positions the file has no reading for are not judged (the lab's QA/QC is a sample set of its own), so they are never missing.
        const v = got[ch.k], optional = x.t !== "s" || left.has(x.sid);
        if (v){
          const r = parseRes(v.raw, ch);
          if (r && !r.bad && !r.amb){ vals[x.p][ch.k] = v.raw; n++; continue; }
          P.bad.push(`${x.t === "s" ? x.sid : posLabel(p, x) + " #" + x.p}: ${v.col.name} “${v.raw}”`);
        }
        if (!optional) miss.push(`${posLabel(p, x)} #${x.p}${x.t === "s" ? ` ${x.sid}` : x.of ? ` of ${x.of}` : ""}${ans.length > 1 ? ` ${anShort(ch)}` : ""}`);
      }
    }
    P.n += n;
    return { vals, crms, miss, n };
  };
  const want = s => (!scope.sample || s.id === scope.sample) && (!scope.sub || s.batchId === scope.sub);
  const touched = new Map(), fresh = new Map();
  for (const [sid, row] of bySid){
    const s = bs(sid); if (!s || !want(s)) continue;
    if (released(s) || stage(s, s.stageKey)?.final || s.open === false){ P.done.push(sid); continue; }
    if (awaiting(s)){ P.awaiting.push(sid); continue; }
    const ready = readyForResults(s);
    let needs = false;
    const viaB = new Set();   // readings going into a new lab batch made from this file, so not onto the record as well
    for (const g of groupsOf(s)){
      const ans = batchAns(g.p, s); if (!ans.length || !Object.keys(rowValues(rep, row.cells, ans, 1)).length) continue;
      const l = labsOf(s)[g.p], ob = l ? openBatches.get(l.b) || (batchLive && batchLive.id === l.b ? batchLive : null) : null;
      if (scope.batch && (!l || l.b !== scope.batch)) continue;
      if (scope.sample){ if (l || batchesRequired()) ans.forEach(a => { if (!P.viaBatch.includes(anShort(a))) P.viaBatch.push(anShort(a)); }); continue; }
      if (ob && !ob.qc && ob.status !== "creating"){ touched.set(ob.id, ob); if (!ready) needs = true; }
      else if (l) P.already.push(`${sid} (${l.b})`);
      else if (!ready) needs = true;
      else { const key = g.p + "|" + sigOf(ans); (fresh.get(key) || fresh.set(key, { p: g.p, ans, sids: [] }).get(key)).sids.push(sid); g.k.forEach(k => viaB.add(k)); }
    }
    if (!scope.batch){
      const bk = batchKeys(s), others = anOf(s).filter(a => !bk.has(a.k) && !viaB.has(a.k) && !a.calc && a.t !== "pick");
      const got = rowValues(rep, row.cells, others, 1, P.clash);
      if (Object.keys(got).length){
        if (!ready) needs = true;
        else {
          const rows = {}, bad = [], have = rowsOf(s); let same = 0;
          for (const [k, v] of Object.entries(got)){
            if (have[k]?.raw === v.raw){ same++; continue; }   // already on the record
            const a = others.find(x => x.k === k), r = parseRes(v.raw, a); if (r && !r.bad && !r.amb) rows[k] = v; else bad.push(`${sid}: ${v.col.name} “${v.raw}”`);
          }
          P.bad.push(...bad);
          if (Object.keys(rows).length){ P.samples.push({ sid, rows }); P.n += Object.keys(rows).length; }
          else if (same && !bad.length) P.already.push(`${sid} (record)`);
        }
      }
    }
    if (needs) P.notReady.push(sid);
  }
  if (scope.batch && !touched.has(scope.batch) && batchLive && batchLive.id === scope.batch && !batchLive.qc) touched.set(scope.batch, batchLive);
  for (const b of touched.values()){ const t = { b, ...fill(b, false) }; if (t.n) P.batches.push(t); }
  /* Samples in no batch of the kind yet: the report becomes the batch, its repeats and reference material readings becoming the QC positions. */
  for (const g of fresh.values()){
    const p = QC_PROFILES[g.p]; if (!p) continue;
    for (let i = 0; i < g.sids.length; i += p.size){
      const sids = g.sids.slice(i, i + p.size), pos = [], push = (t, x) => pos.push({ p: pos.length + 1, t, ...x });
      for (const sid of sids){
        push("s", { sid });
        dupSources(sid, g.ans).forEach(() => push("pd", { of: sid }));
      }
      for (const c of crmReads(g.ans, methodsOf(sids, g.ans))) push("crm", { crm: c.id });
      for (const r of blanks) if (Object.keys(rowValues(rep, r.cells, g.ans, 1)).length) push("bl");
      const b = { id: "", qcp: g.p, ans: g.ans, pos, sids };
      P.fresh.push({ b, ...fill(b, true) });
    }
  }
  P.notFound = [...new Set(P.notFound)];
  // Columns the plan read nothing from (after the plan: a column read by its exact name has no measurement of its own to go by)
  P.unread = rep.cols.filter(c => !c.concept && !c.used && rep.rows.some(r => isRead((r.cells[c.i] || "").trim()))).map(c => c.name + (c.unit ? ` (${c.unit})` : ""));   // v24d: a column of words (a description) is not a result
  return P;
}

/* ---------- attaching a file: read it, show what it fills, save on confirm ---------- */
let upState = null, upScope = null;
function attachInput(){
  let el = $("#upFile");
  if (!el){
    el = document.createElement("input"); el.type = "file"; el.id = "upFile"; el.hidden = true;   // v24: any file; the ones the site can read fill in the values
    el.addEventListener("change", () => { const f = el.files && el.files[0]; el.value = ""; if (f) openUpload(f, upScope || {}); });
    document.body.appendChild(el);
  }
  return el;
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-attach]"); if (!b || !canEdit()) return;
  const [k, id] = b.dataset.attach.split(":");
  upScope = k === "batch" ? { batch: id } : k === "sample" ? { sample: id } : k === "sub" ? { sub: id } : {};   // sub: a submission batch, processed as one (v24d)
  attachInput().click();
});
/* v24d (21 Oct): the samples a file is attached to (a sample, a batch processed as one, a lab batch). */
function scopeSamples(sc){
  if (!sc) return [];
  if (sc.sample) return [bs(sc.sample)].filter(Boolean);
  if (sc.sub) return ((current?.batch === sc.sub ? current.docs : null) || [...samples.values()].filter(s => s.batchId === sc.sub)).filter(Boolean);
  if (sc.batch){ const b = openBatches.get(sc.batch) || (batchLive && batchLive.id === sc.batch ? batchLive : null); return (b?.sids || []).map(bs).filter(Boolean); }
  return [];
}
/* A report whose codes are this batch's codes with another date in them (MLSPTK0120261019 in the file, MLSPTK0120261020 here): the date on
   the codes was chosen wrongly at submission, or the report is another day's. Offered, never done on its own: file code → sample. */
const DATE8 = /(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])/;
const date8Of = k => (normKey(k).match(DATE8) || [""])[0];
const date8Text = d => { const m = String(d || "").match(/^(\d{4})(\d{2})(\d{2})$/); return m ? fmtDate(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)) : String(d || ""); };
function dateAlias(rep, sc){
  const own = scopeSamples(sc); if (!rep || rep.error || !rep.rows || !own.length) return null;
  const strip = k => normKey(k).replace(DATE8, "#"), mine = new Map();
  for (const s of own) for (const k of new Set([s.id, ...(s.tags || [])].map(normKey))){ if (!DATE8.test(k)) continue; const st = strip(k); (mine.get(st) || mine.set(st, new Map()).get(st)).set(s.id, k); }
  const hit = new Set(rep.rows.filter(r => r.sid).map(r => r.sid)), map = new Map(), took = new Map();
  for (const r of rep.rows){
    if (r.kind !== "x") continue;
    const k = normKey(r.key); if (!DATE8.test(k)) continue;
    const m = mine.get(strip(k)); if (!m || m.size !== 1) continue;
    const [sid, code] = [...m][0]; if (hit.has(sid) || date8Of(code) === date8Of(k)) continue;
    if (took.has(sid)){ map.delete(took.get(sid)); took.set(sid, ""); continue; }   // two of the file's codes for one sample: neither is read
    took.set(sid, k); map.set(k, { sid, code, file: r.key });
  }
  if (!map.size) return null;
  const v = [...map.values()];
  return { map, n: v.length, of: own.length, from: [...new Set(v.map(x => date8Of(x.file)))], to: [...new Set(v.map(x => date8Of(x.code)))], bySid: new Map(v.map(x => [x.sid, x])) };
}
/* The report read again with the file's codes standing for this batch's samples. */
function reread(u){
  const idx = sampleIndex(u.scope); if (u.useAlias && u.alias) u.alias.map.forEach((x, k) => idx.set(k, x.sid));
  u.rep = parseReport(u.grid, idx); u.plan = u.rep.error ? null : planUpload(u.rep, u.scope);
}
function useAlias(u, on){ u.useAlias = !!on && !!u.alias; reread(u); renderUpload(); }
const kb = n => n < 1024 ? `${n} bytes` : n < 1048576 ? `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB` : `${(n / 1048576).toFixed(1)} MB`;
const KIND = { xls: "Excel 97-2003", xlsx: "Excel", csv: "Text (CSV)", pdf: "PDF", doc: "Word", docx: "Word", png: "Picture", jpg: "Picture", jpeg: "Picture" };
const extOf = n => (String(n).match(/\.([A-Za-z0-9]{1,8})$/) || ["", "file"])[1].toLowerCase();
async function openUpload(file, scope){
  if (file.size > FILE_MAX){ toast(`${file.name} is ${kb(file.size)}. Files up to ${kb(FILE_MAX)} can be attached.`); return; }
  let got;
  try { got = await readGrid(file); }
  catch (e){
    // v24, release at once: a file the site can't read is still attached; its samples are released with it.
    if (!relNow()){ toast(`${file.name} could not be read: ${e?.message || "not a report this site reads"}. Save it as Excel or CSV and try again.`); return; }
    got = { kind: extOf(file.name), grid: null, bytes: new Uint8Array(await file.arrayBuffer()) };
  }
  if (got.kind === "csv" && !["csv", "txt", "tsv"].includes(extOf(file.name)) && relNow()) got = { ...got, kind: extOf(file.name), grid: null };   // a PDF, a picture…: kept, not read
  const rep = got.grid ? parseReport(got.grid, sampleIndex(scope)) : { error: "This file's values can't be read here.", rows: [], cols: [], crms: [] };
  const sha = await sha256(got.bytes);
  upState = { file: { name: file.name.slice(0, 120), size: file.size, kind: got.kind, sha }, bytes: got.bytes, grid: got.grid, rep, scope, plan: rep.error ? null : planUpload(rep, scope), prior: [], pick: new Set(), q: "", alias: dateAlias(rep, scope), useAlias: false, anyway: false };
  renderUpload();
  if (db && sha) try { upState.prior = (await db.collection("files").where("sha", "==", sha).limit(5).get()).docs.map(d => d.data()).filter(Boolean); renderUpload(); } catch {}
}
function closeUpload(){ upState = null; $("#upBox")?.remove(); document.body.classList.remove("modal-open"); }
function renderUpload(){
  const u = upState; if (!u) return;
  let box = $("#upBox");
  if (!box){ box = document.createElement("div"); box.id = "upBox"; box.className = "modal"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-labelledby", "upTitle"); document.body.appendChild(box); document.body.classList.add("modal-open"); }
  const r = u.rep, P = u.plan, m = r.meta || {};
  const li = (cls, html) => `<li class="${cls}">${html}</li>`;
  const ids = (xs, n = 6) => `${xs.slice(0, n).map(x => `<span class="mono">${esc(x)}</span>`).join(", ")}${xs.length > n ? ` +${xs.length - n} more` : ""}`;
  const save = [], check = [], unused = [];
  if (P){
    for (const t of P.batches) save.push(li(t.miss.length ? "warn" : "ok", `Lab batch <b class="mono">${esc(t.b.id)}</b>: ${t.n} value${t.n === 1 ? "" : "s"}${t.miss.length ? ` · <b>${t.miss.length} missing</b> (${esc(t.miss.slice(0, 3).join("; "))}${t.miss.length > 3 ? "…" : ""}): saved as a draft` : " · QC checked on save"}`));
    for (const t of P.fresh) save.push(li(t.miss.length ? "warn" : "ok", `New lab batch, ${esc(lcName(QC_PROFILES[t.b.qcp]?.name || t.b.qcp))}: ${t.b.sids.length} sample${t.b.sids.length === 1 ? "" : "s"}${t.b.pos.length > t.b.sids.length ? `, ${t.b.pos.length - t.b.sids.length} QC` : ""}${t.miss.length ? ` · <b>${t.miss.length} missing</b> (${esc(t.miss.slice(0, 3).join("; "))}${t.miss.length > 3 ? "…" : ""}): saved as a draft` : " · QC checked on save"}`));
    if (P.samples.length) save.push(li("ok", `Results on ${P.samples.length} sample record${P.samples.length === 1 ? "" : "s"}: ${esc(listAnd([...new Set(P.samples.flatMap(x => Object.values(x.rows).map(v => v.col.name)))].slice(0, 8)))}`));
    if (P.viaBatch.length) check.push(li("warn", `Saved with the lab batch: ${esc(listAnd(P.viaBatch))} <button type="button" class="btn small" id="upBatches">Lab batches</button>`));
    if (P.notReady.length) check.push(relNow() ? li("", `Moved on to analysis when saved: ${ids(P.notReady)}`) : li("warn", `Not at analysis yet: ${ids(P.notReady)} <button type="button" class="btn small" id="upMove">Move ${P.notReady.length === 1 ? "it" : "them"} to analysis</button>`));
    if (P.awaiting.length) check.push(li("warn", `Waiting for receipt: ${ids(P.awaiting)}`));
    if (P.done.length) check.push(li("warn", `Results already released: ${ids(P.done)}`));
    if (P.already.length) check.push(li("warn", `Batch results already saved: ${ids(P.already, 4)}`));
    if (P.bad.length) check.push(li("bad", `Not a result: ${esc(P.bad.slice(0, 4).join("; "))}${P.bad.length > 4 ? ` +${P.bad.length - 4} more` : ""}`));
    if (P.clash.length) check.push(li("bad", `Two columns for one result: ${esc(P.clash.slice(0, 3).join("; "))}`));
    if (P.notFound.length) unused.push(li("", `Not in the lab (no sample with this ID, site sample code or site reference): ${ids(P.notFound)}`));
    if (P.unread.length) unused.push(li("", `Columns not read: ${esc(P.unread.slice(0, 10).join(", "))}${P.unread.length > 10 ? "…" : ""}${isAdmin() ? ` <button type="button" class="btn ghost small" id="upCols">Settings › Results files</button>` : ""}`));
    if (P.unknownCrm.length) unused.push(li("", `Reference materials not in the register: ${ids(P.unknownCrm)}${isAdmin() ? ` <button type="button" class="btn ghost small" id="upCrms">Settings › Reference materials</button>` : ""}`));
  }
  const rowsRead = P ? [
    ...P.batches.concat(P.fresh).flatMap(t => t.b.pos.filter(x => Object.keys(t.vals[x.p] || {}).length).map(x => [x.t === "s" ? x.sid : x.t === "crm" ? t.crms[x.p] || x.crm : `${posLabel(QC_PROFILES[t.b.qcp] || {}, x)}${x.of ? " of " + x.of : ""}`, t.b.id || "New batch", Object.entries(t.vals[x.p]).map(([k, v]) => `${anShort(bAns(t.b).find(a => a.k === k) || { k, n: k })} ${v}`).join(", ")])),
    ...P.samples.map(x => [x.sid, "Sample record", Object.entries(x.rows).map(([k, v]) => `${anShort(anOf(bs(x.sid)).find(a => a.k === k) || { k, n: k })} ${v.raw}`).join(", ")])] : [];
  const loose = relNow(), tg = loose ? uploadTargets(u) : [], none = readsNone(u);
  // a file naming none of these samples, or some of them under another date, is saved (and the samples released) only once the technician chooses
  const hold = loose && (none || !!u.alias) && !u.useAlias && !u.anyway;
  const any = (loose ? tg.length > 0 : P && (P.batches.length || P.fresh.length || P.samples.length)) && (!none || u.anyway || loose === false) && !hold;
  box.innerHTML = `<div class="modal-card stack" style="gap:12px">
    <div class="row" style="gap:8px"><h3 id="upTitle" style="margin:0">Results file</h3><span class="pill">${esc(KIND[u.file.kind] || u.file.kind)}</span><span style="flex:1"></span><button type="button" class="btn ghost small" id="upClose" aria-label="Close">✕</button></div>
    <div class="small"><b class="mono">${esc(u.file.name)}</b> · ${kb(u.file.size)}${m.ref ? ` · Lab ref <b class="mono">${esc(m.ref)}</b>` : ""}${m.project ? ` · ${esc(m.project)}` : ""}${r.rows ? ` · ${r.rows.length} row${r.rows.length === 1 ? "" : "s"} read` : ""}</div>
    ${u.prior.length ? `<div class="notice warn"><b>Attached before</b> ${u.prior.map(f => `${fmt(f.at)} by ${esc(f.tech || "")}`).join("; ")}</div>` : ""}
    ${u.useAlias ? aliasOnNote(u) : none || u.alias ? noneNote(u, loose, none) : ""}
    ${r.error && !loose ? `<div class="notice bad">${esc(r.error)}</div>` : ""}
    ${save.length ? `<div class="up-sec"><h4>Saves</h4><ul class="up-list">${save.join("")}</ul></div>` : P && !any && !P.notReady.length && !loose ? `<div class="notice warn"><b>Nothing to save from this file.</b></div>` : ""}
    ${loose ? uploadTargetsHtml(u, tg) : ""}
    ${loose && tg.some(id => twoPerson(bs(id))) ? `<div class="form" id="upWitBox"><div class="full">${witnessField("upWit", `Witness to the release (two-person custody: ${esc(listAnd(tg.filter(id => twoPerson(bs(id)))))})`)}</div></div>` : ""}
    ${check.length ? `<div class="up-sec"><h4>Check</h4><ul class="up-list">${check.join("")}</ul></div>` : ""}
    ${unused.length ? `<div class="up-sec"><h4>Not used</h4><ul class="up-list">${unused.join("")}</ul></div>` : ""}
    ${rowsRead.length ? `<details class="more" id="upRead"><summary>Values read (${rowsRead.length})</summary><div class="tbl-wrap"><table><thead><tr><th>Sample or QC</th><th>Goes to</th><th>Results</th></tr></thead><tbody>${rowsRead.slice(0, 400).map(x => `<tr><td class="mono">${esc(x[0])}</td><td class="mono">${esc(x[1])}</td><td>${esc(x[2])}</td></tr>`).join("")}</tbody></table></div></details>` : ""}
    <div class="row"><button type="button" class="btn primary" id="upSave" ${any ? "" : "disabled data-hold"}>${loose ? `Save and release${tg.length ? ` (${tg.length})` : ""}` : "Save results"}</button><button type="button" class="btn ghost" id="upCancel">Cancel</button><span class="small muted" id="upMsg"></span></div>
  </div>`;
  $("#upClose", box).onclick = closeUpload; $("#upCancel", box).onclick = closeUpload;
  $("#upSave", box).onclick = saveUpload;
  const uw = $("#upWit", box); if (uw){ uw.value = u.wit || ""; uw.onchange = () => { u.wit = uw.value; }; }   // kept when the dialog is drawn again
  $("#upMove", box)?.addEventListener("click", moveToAnalysis);
  $("#upAlias", box)?.addEventListener("click", () => useAlias(u, true));
  $("#upAliasOff", box)?.addEventListener("click", () => useAlias(u, false));
  const an = $("#upAnyway", box); if (an) an.onchange = () => { u.anyway = an.checked; renderUpload(); };
  bindUploadTargets(box);
  $("#upBatches", box)?.addEventListener("click", () => { closeUpload(); setTab("batches"); });
  $("#upCols", box)?.addEventListener("click", () => { closeUpload(); cfgTab = "files"; setTab("stages"); });
  $("#upCrms", box)?.addEventListener("click", () => { closeUpload(); cfgTab = "crms"; setTab("stages"); });
  box.onclick = e => { if (e.target === box) closeUpload(); };
}
/* v24d (21 Oct): a file attached to a sample or batch that names samples, none of them this one's: said plainly (a wrong file, or the
   codes' date), and released with it only when the technician says so. */
function readsNone(u){
  const sc = u.scope || {}; if (!(sc.sub || sc.sample || sc.batch) || !u.rep || u.rep.error || !(u.rep.rows || []).length) return false;
  const own = new Set(scopeSamples(sc).map(s => s.id));
  return own.size > 0 && !u.rep.rows.some(r => r.sid && own.has(r.sid));
}
function noneNote(u, loose, none){
  const sc = u.scope || {}, what = sc.sample ? "sample" : sc.batch ? "lab batch" : "batch", a = u.alias, codes = [...new Set(u.rep.rows.map(r => r.key))];
  const list = xs => `${xs.slice(0, 4).map(x => `<span class="mono">${esc(x)}</span>`).join(", ")}${xs.length > 4 ? ` +${xs.length - 4} more` : ""}`;
  const mine = sc.sample ? "this sample's code" : `this ${what}'s codes`, dates = a ? `<b>${esc(a.from.map(date8Text).join(", "))}</b> in the file, <b>${esc(a.to.map(date8Text).join(", "))}</b> here` : "";
  const why = "The date on the codes may have been chosen wrongly at submission, or the report is another day's.";
  return `<div class="notice warn stack" id="upNone" style="gap:8px">
    ${none ? `<div><b>None of this ${what}'s samples is in this file${a ? " as its codes stand" : ""}.</b> It names ${codes.length} sample${codes.length === 1 ? "" : "s"}: ${list(codes)}.</div>
      ${a ? `<div>They are ${mine} with another date: ${dates} (${a.n} of ${a.of} sample${a.of === 1 ? "" : "s"}). ${why}</div>` : `<div>Check that it is the right file.</div>`}`
      : `<div><b>${a.n} of the file's codes ${a.n === 1 ? "is" : "are"} ${mine} with another date</b> (${dates}): ${list([...a.map.values()].map(x => x.file))}. ${why}</div>`}
    ${a ? `<div class="row"><button type="button" class="btn primary small" id="upAlias">Read the file's codes as ${sc.sample ? "this sample's" : `this ${what}'s`}</button></div>` : ""}
    ${loose ? `<label class="row" style="gap:8px;font-weight:400"><input type="checkbox" id="upAnyway" ${u.anyway ? "checked" : ""}> <span>${none ? `Keep it as the results anyway and release ${sc.sample ? "the sample" : "them"} without values` : `Save without reading ${a.n === 1 ? "that one" : `those ${a.n}`}: released with the file, without values`}</span></label>` : ""}</div>`;
}
const aliasOnNote = u => `<div class="notice ok row" style="gap:8px"><span class="grow">Read with the file's codes dated <b>${esc(u.alias.from.map(date8Text).join(", "))}</b> for ${nS(u.alias.n)} dated <b>${esc(u.alias.to.map(date8Text).join(", "))}</b>. Each sample's record notes the file's code.</span><button type="button" class="btn ghost small" id="upAliasOff">Undo</button></div>`;
/* v24, release at once: every file attached is accepted. The samples it is for are released with it: those the file names (their values
   filled in), else the sample or batch it was attached on, else the ones the technician ticks. A file the site can't read (a PDF, a
   picture, a report laid out another way) is kept as their results; the certificate points to it. */
const canTakeFile = s => !!s && !awaiting(s) && s.open !== false && curIdx(s) >= 1 && curIdx(s) < targetIdx(s);
function uploadTargets(u){
  const sc = u.scope || {}, P = u.plan;
  if (sc.sample) return canTakeFile(bs(sc.sample)) ? [sc.sample] : [];
  if (sc.sub) return (current?.batch === sc.sub ? current.docs : [...samples.values()].filter(s => s.batchId === sc.sub)).filter(s => grouped(s) && canTakeFile(s)).map(s => s.id);
  if (sc.batch){ const b = openBatches.get(sc.batch) || (batchLive && batchLive.id === sc.batch ? batchLive : null); return (b?.sids || []).filter(id => { const s = bs(id); return canTakeFile(s) && inBatch(s, sc.batch); }); }
  const named = P ? [...new Set([...P.batches.flatMap(t => t.b.pos.filter(x => x.t === "s" && Object.keys(t.vals[x.p] || {}).length).map(x => x.sid)), ...P.fresh.flatMap(t => t.b.sids), ...P.samples.map(x => x.sid), ...P.notReady])] : [];
  return named.length ? named : [...u.pick].filter(id => canTakeFile(bs(id)));
}
const unreadNote = u => u.rep.error ? `<div class="notice">${u.grid ? "This file doesn't name its samples in a way the site can read." : "This file's values can't be read here."} It is kept as the results of the samples below, and they are released with it.</div>` : "";
function uploadTargetsHtml(u, tg){
  const sc = u.scope || {}, P = u.plan, named = P && !sc.sample && !sc.batch && !sc.sub && (P.batches.length || P.fresh.length || P.samples.length || P.notReady.length);
  if (sc.sub) return `${unreadNote(u)}<div class="up-sec"><h4>Released together with this file: batch <span class="mono">${esc(sc.sub)}</span></h4><div class="small">${tg.length ? `${nS(tg.length)}, on one batch certificate${relNow() ? "" : " (a lab supervisor releases it)"}: ${tg.map(id => `<span class="mono">${esc(id)}</span>`).join(", ")}` : "No sample of the batch can take results (not received yet, or already released)."}</div></div>`;
  const unread = unreadNote(u);
  if (sc.sample || sc.batch || named) return `${unread}<div class="up-sec"><h4>Released with this file</h4><div class="small">${tg.length ? tg.map(id => `<span class="mono">${esc(id)}</span>`).join(", ") : "No sample here can take results (not received yet, or already released)."}</div></div>`;
  const q = u.q.trim().toUpperCase().replace(/\s+/g, "");
  const list = [...samples.values()].filter(canTakeFile).filter(s => !q || [s.id, tagText(s)].some(x => String(x).toUpperCase().replace(/\s+/g, "").includes(q))).sort((a, b) => a.id < b.id ? 1 : -1).slice(0, 150);
  return `${unread}<div class="up-sec"><h4>Which samples are these results for?</h4>
    <input class="inp" id="upQ" placeholder="Search ID or site code" value="${esc(u.q)}" style="margin-bottom:6px">
    <div class="up-pick">${list.length ? list.map(s => `<label><input type="checkbox" data-uppick="${esc(s.id)}" ${u.pick.has(s.id) ? "checked" : ""}> <span class="mono">${esc(s.id)}</span> <span class="small muted">${esc([ownCode(s), s.type || "", stage(s, s.stageKey)?.name || ""].filter(Boolean).join(" · "))}</span></label>`).join("") : `<div class="small muted">No samples in the lab are waiting for results.</div>`}</div></div>`;
}
function bindUploadTargets(box){
  box.querySelectorAll("[data-uppick]").forEach(c => c.onchange = () => { const u = upState; if (!u) return; c.checked ? u.pick.add(c.dataset.uppick) : u.pick.delete(c.dataset.uppick); renderUpload(); });
  const q = $("#upQ", box); if (q){ q.oninput = () => { if (upState){ upState.q = q.value; renderUpload(); const n = $("#upQ"); if (n){ n.focus(); n.setSelectionRange(n.value.length, n.value.length); } } }; }
}
/* The file as a sample's results: what was read stays, the file is named as where the rest are. */
function fileResults(s, f, inst, wit = ""){
  const at = nowAfter(s);
  return { results: { ...(s.results || {}), v: (s.results?.v || 0) + 1, at, by: session.u, tech: session.name, rows: s.results?.rows || {}, inst: inst || s.results?.inst || "", file: fileTag(f), att: true },
    resHist: [...(s.resHist || []), ...(s.results ? [s.results] : [])].slice(-30), fids: [...new Set([...(s.fids || []), f.id])],
    history: [...(s.history || []), { key: s.stageKey, sn: stage(s, s.stageKey)?.name, at, by: session.u, tech: session.name, ref: inst, res: true, ...(wit && twoPerson(s) ? { wit } : {}), note: `Results file ${f.name} attached` }] };
}
/* Waits (up to 4 s) until the samples just moved show here at analysis, so the file's plan is made again on what was written. */
async function movedIn(ids){ const t0 = Date.now(); await sleep(150); while (Date.now() - t0 < 4000 && ids.some(id => { const s = bs(id); return s && !readyForResults(s) && curIdx(s) >= 1; })) await sleep(100); }
/* Samples still in preparation when their results arrive move to their first analysis step, one step at a time, each step recorded. */
async function moveToAnalysis(){
  const u = upState; if (!u?.plan || u.busy) return;
  u.busy = true; $("#upMsg").textContent = "Moving samples…";
  const ok = await pool(u.plan.notReady, 4, sid => sampleWrite(sid, s => {
    const p = planOf(s), ci = curIdx(s), to = p.findIndex((x, i) => i > ci && (x.phase === "test" || x.phase === "qc"));
    if (ci < 1 || to < 0 || to >= targetIdx(s) || readyForResults(s)) return null;
    let at = nowAfter(s); const hist = [...(s.history || [])];
    for (let i = ci + 1; i <= to; i++){ hist.push({ key: p[i].key, sn: p[i].name, at, by: session.u, tech: session.name, ref: u.file.name, note: `Moved on with results file ${u.file.name}` }); at += 1000; }
    return { stageKey: p[to].key, stageAt: at - 1000, history: hist };
  }));
  u.busy = false;
  toast(`${ok} sample(s) moved to analysis.`);
  await movedIn(u.plan.notReady);
  if (upState === u){ reread(u); renderUpload(); }
}
/* The original file, kept once however many batches it fills: files/<ID> describes it, files/<ID>~1, ~2… hold it. */
async function keepFile(u){
  const id = "RF-" + (u.file.sha ? u.file.sha.slice(0, 16).toUpperCase() : dayStamp(Date.now()) + "-" + Math.random().toString(36).slice(2, 8).toUpperCase());
  const ref = db.doc("files/" + id), have = await ref.get().catch(() => null);
  const meta = { id, name: u.file.name, kind: u.file.kind, size: u.file.size, sha: u.file.sha, labRef: u.rep.meta?.ref || "" };
  if (have && have.exists && have.data()?.id) return meta;
  const data = b64(u.bytes), parts = Math.ceil(data.length / FILE_PIECE) || 1;
  for (let i = 0; i < parts; i++) await db.doc(`files/${id}~${i + 1}`).set({ id: `${id}~${i + 1}`, of: id, n: i + 1, data: data.slice(i * FILE_PIECE, (i + 1) * FILE_PIECE) });
  await ref.set({ ...meta, parts, at: Date.now(), by: session.u, tech: session.name });
  return meta;
}
async function downloadFile(id){
  try {
    const m = (await db.doc("files/" + id).get()).data(); if (!m) { toast("The file is not available."); return; }
    let data = ""; for (let i = 1; i <= (m.parts || 1); i++) data += (await db.doc(`files/${id}~${i}`).get()).data()?.data || "";
    const dl = window.claude?.use ? await claude.use("downloads") : null;
    if (!dl){ toast("Downloads are not available in this view."); return; }
    await dl.save({ filename: m.name, data: unb64(data) });
  } catch { toast("The file was not downloaded."); }
}
document.addEventListener("click", e => { const b = e.target.closest("[data-rfile]"); if (b){ e.preventDefault(); downloadFile(b.dataset.rfile); } });
const fileTag = f => f ? { id: f.id, name: f.name } : null;
async function saveUpload(){
  const u = upState; if (!u || u.busy || !canEdit() || (!u.plan && !relNow())) return;
  const loose = relNow(), targets = loose ? uploadTargets(u) : [];
  const two = targets.filter(id => twoPerson(bs(id))), wit = val("#upWit");
  if (two.length && !wit){ toast(`Two-person custody: choose the witness to the release of ${listAnd(two)}.`); $("#upWit")?.focus(); return; }
  u.busy = true; document.querySelectorAll("#upBox button").forEach(b => b.disabled = true);
  const msg = t => { const m = $("#upMsg"); if (m) m.textContent = t; };
  // Release at once: samples the file names that are still in preparation move on to analysis first, each step recorded.
  if (loose && u.plan?.notReady.length){
    msg("Moving samples to analysis…");
    await pool(u.plan.notReady, 4, sid => sampleWrite(sid, s => {
      const p = planOf(s), ci = curIdx(s), to = p.findIndex((x, i) => i > ci && (x.phase === "test" || x.phase === "qc"));
      if (ci < 1 || to < 0 || to >= targetIdx(s) || readyForResults(s)) return null;
      let at = nowAfter(s); const hist = [...(s.history || [])];
      for (let i = ci + 1; i <= to; i++){ hist.push({ key: p[i].key, sn: p[i].name, at, by: session.u, tech: session.name, ref: u.file.name, note: `Moved on with results file ${u.file.name}` }); at += 1000; }
      return { stageKey: p[to].key, stageAt: at - 1000, history: hist };
    }));
    await movedIn(u.plan.notReady);
    reread(u);
  }
  const P = u.plan || { batches: [], fresh: [], samples: [] };
  const done = [];
  // The file's values replace what was typed, unsaved, in the same boxes of the batch on screen.
  const shown = P.batches.find(t => t.b.id === batchSel);
  if (shown){
    const ans = bAns(shown.b), clear = id => { const el = document.getElementById(id); if (el) delete el.dataset.typed; };
    shown.b.pos.forEach(x => { if (shown.crms[x.p]) clear("bc_" + x.p); ans.forEach((ch, i) => { if (shown.vals[x.p]?.[ch.k] != null) clear(posInput(x, i, ch)); }); });
  }
  try {
    msg("Keeping the file…");
    const f = await keepFile(u), inst = f.labRef || f.name;
    for (const t of P.batches){
      msg(`Saving ${t.b.id}…`);
      const fresh = (await db.doc("batches/" + t.b.id).get()).data(); if (!fresh || fresh.qc){ done.push(`${t.b.id} already had results`); continue; }
      done.push(await fileIntoBatch(fresh, t, f, inst));
    }
    for (const t of P.fresh){
      msg("Creating a lab batch…");
      const b = await batchFromFile(t, f); if (!b){ done.push("a batch could not be created"); continue; }
      done.push(await fileIntoBatch(b.doc, b.t, f, inst));
    }
    if (P.samples.length){
      msg("Saving sample results…");
      const al = sid => { const a = u.useAlias && u.alias?.bySid.get(sid); return a ? ` (the file names it ${a.file}, its code dated ${date8Text(date8Of(a.file))})` : ""; };
      const n = await pool(P.samples, 8, x => sampleWrite(x.sid, s => {
        if (!readyForResults(s)) return null;
        const bk = batchKeys(s), defs = anOf(s), rows = { ...rowsOf(s) };
        for (const [k, v] of Object.entries(x.rows)){ const a = defs.find(y => y.k === k); if (!a || bk.has(k)) continue; const r = parseRes(v.raw, a); if (r && !r.bad && !r.amb) rows[k] = { ...r, by: session.u, src: "file" }; }
        const all = withCalc(s, rows), at = nowAfter(s);
        return { results: { v: (s.results?.v || 0) + 1, at, by: session.u, tech: session.name, rows: patch(s.results?.rows, all), batch: s.results?.batch || "", inst, file: fileTag(f) }, fids: [...new Set([...(s.fids || []), f.id])],
          resHist: [...(s.resHist || []), ...(s.results ? [s.results] : [])].slice(-30), resAcc: null,
          history: [...(s.history || []), { key: s.stageKey, sn: stage(s, s.stageKey)?.name, at, by: session.u, tech: session.name, ref: inst, res: true, note: `Results from file ${f.name}${al(x.sid)}: ${resSummary(defs, all)}` }] };
      }), (d, t) => msg(`Saving sample results… ${d} of ${t}`));
      done.push(`results on ${n} sample record${n === 1 ? "" : "s"}`);
    }
    if (loose && targets.length){
      // Every sample the file is for and not released yet: the file is its results, and it is released (withRelease).
      msg("Releasing…");
      const inst = f.labRef || f.name;
      const relIds = [], keptIds = [], subs = new Set(), inSub = new Set();   // v24d: say what happened to each: released, or results kept but not released
      await pool(targets, 8, sid => sampleWrite(sid, s => { if (!canTakeFile(s)) return null; if (grouped(s)){ subs.add(s.batchId); inSub.add(sid); } return fileResults(s, f, inst, wit); },
        upd => upd.relAt ? relIds.push(sid) : inSub.has(sid) ? 0 : keptIds.push(sid)), (d, t) => msg(`Keeping the file with the samples… ${d} of ${t}`));
      if (relIds.length) done.push(`${relIds.length} released with the file`);
      if (keptIds.length) done.push(`results kept on ${listAnd(keptIds)}, not released yet`);
      for (const ref of subs){   // a batch processed as one: released together, on one batch certificate, once all its results are in
        msg(`Releasing batch ${ref}…`);
        const r = await releaseGroup(ref, wit, true, (d, t) => msg(`Releasing batch ${ref}… ${d} of ${t}`));
        done.push(r.n ? `batch ${ref}: ${nS(r.n)} released on certificate ${r.no}` : `batch ${ref}: results kept, not released yet${r.why ? ` (${r.why.replace(/\.$/, "")})` : ""}`);
      }
      for (const b of new Set(targets.flatMap(id => Object.values(labsOf(bs(id) || {})).map(l => l.b)))) await closeBatchIfDone(b);
    }
    toast(`Saved: ${done.join("; ") || "the file is kept"}.`);
    closeUpload();
  } catch (e) { writeFailed(e); u.busy = false; renderUpload(); return; }
  if (tab === "batches") renderBatches(); else if (tab === "track") renderTrack();
}
/* A complete set of values is saved and the QC checked at once; an incomplete one waits on the batch as a draft for the missing values. */
async function fileIntoBatch(b, t, f, inst){
  const notYet = b.sids.filter(id => { const s = bs(id); return s && inBatch(s, b.id) && !released(s) && !readyForResults(s); });
  const files = [...(b.files || []).filter(x => x.id !== f.id), { id: f.id, name: f.name, at: Date.now(), tech: session.name }];
  if (!relNow() && (t.miss.length || notYet.length)){   // release at once: what the file holds is saved; the rest of each sample's results is the file
    const ref = db.doc("batches/" + b.id);
    await ref.update({ draft: { at: Date.now(), by: session.u, tech: session.name, file: fileTag(f), vals: t.vals, crms: t.crms }, files, status: "results",
      log: batchLog(b, `Results file ${f.name} attached; ${t.miss.length ? `${t.miss.length} value(s) still to enter` : `${notYet.length} sample(s) not at analysis yet`}`) });
    return `${b.id} draft (${t.miss.length ? `${t.miss.length} missing` : "samples not at analysis"})`;
  }
  const ans = bAns(b), vals = {};
  for (const [p, o] of Object.entries(t.vals)){ const rs = {}; for (const [k, raw] of Object.entries(o)){ const ch = ans.find(a => a.k === k), r = ch && parseRes(raw, ch); if (r && !r.bad && !r.amb) rs[k] = { ...r, by: session.u, src: "file" }; } if (Object.keys(rs).length) vals[p] = rs; }
  const crms = {}; for (const x of b.pos) if (x.t === "crm") crms[x.p] = t.crms[x.p] || x.crm || "";
  const ok = await storeBatchResults({ ...b, files }, { vals, crms }, inst, f, 0);
  return ok ? `${b.id} ${qcLabel(ok).toLowerCase()}` : `${b.id} not saved`;
}
/* A lab batch made from the report for samples in no batch of its kind yet. */
async function batchFromFile(t, f){
  const p = QC_PROFILES[t.b.qcp], at = Date.now();
  const id = await claimBatchId(p.prefix, { qcp: t.b.qcp, ans: t.b.ans, at, day: dayKey(at), month: monthKey(at), by: session.u, tech: session.name, open: true, status: "creating", sids: [], pos: [], crms: [], qc: null, log: [], fromFile: fileTag(f) });
  const joined = [];
  await pool(t.b.sids, 5, sid => sampleWrite(sid, s => {
    const l = labsOf(s)[t.b.qcp]; if (l && l.b && l.b !== id) return null;
    if (sigOf(batchAns(t.b.qcp, s)) !== sigOf(t.b.ans)) return null;
    joined.push(sid);
    const tt = nowAfter(s);
    return { ...labsUpd(s, { ...labsOf(s), [t.b.qcp]: { b: id, q: "pending", n: "" } }), history: [...(s.history || []), { key: s.stageKey, sn: stage(s, s.stageKey)?.name, at: tt, by: session.u, tech: session.name, ref: id, note: `Added to lab batch ${id} from results file ${f.name}` }] };
  }));
  if (!joined.length){ await db.doc("batches/" + id).delete(); return null; }
  // Positions of samples that could not join are dropped; the others keep their values under their new numbers.
  const keep = t.b.pos.filter(x => x.t === "s" ? joined.includes(x.sid) : x.of ? joined.includes(x.of) : true), vals = {}, crms = {};
  const pos = keep.map((x, i) => { const y = { ...x, p: i + 1 }; vals[y.p] = t.vals[x.p] || {}; if (t.crms[x.p]) crms[y.p] = t.crms[x.p]; return y; });
  const order = t.b.sids.filter(x => joined.includes(x));
  await db.doc("batches/" + id).update({ status: "prep", sids: order, pos, crms: [...new Set(pos.filter(x => x.crm).map(x => x.crm))], log: [{ at: Date.now(), by: session.u, tech: session.name, note: `Batch made from results file ${f.name} with ${order.length} samples and ${pos.length - order.length} QC positions` }] });
  const doc = (await db.doc("batches/" + id).get()).data();
  return { doc, t: { ...t, vals, crms, b: { ...t.b, id, pos } } };
}
