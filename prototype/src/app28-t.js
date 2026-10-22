
/* ---------- v24d: a shift's samples as one job (Submit › Shift end; "Shift job" until 21 Oct) ----------
   At the end of a shift the plant sends the same samples every time (mill, CCD, TSF, carbon), the elution run its solutions, and now and
   then carbon for an activity test. A template lists them as the plant's reports do: point, code, description and analysis. The submitter
   picks the template, the shift and the date (codes follow: ML + NS/DS + point + date, as on the reports), unticks what was not sampled,
   adds anything extra, and submits: one batch, received, analysed and released together with the lab's report for the job (route JOB).
   Each sample keeps its own ID, label, analysis, results, limits and retention. */
/* v24d, from the day shift's report (19 Oct): the day shift samples at 07:00, 10:00, 13:00 and 16:00, names its spigot samples without a
   time and its hourly samples (CT, the same code) "CIL tank 11"; its carbon for the elution circuit is the regenerated carbon, where the night
   shift sends the stripped and the loaded carbon. */
const JOB_SHIFT = {
  N: { code: "NS", name: "Night shift", t: ["19:00", "22:00", "01:00", "04:00"], h: ["01", "03", "05", "19", "21", "23"], p: ["2200", "0400"], ct: "CIL tails launder" },
  D: { code: "DS", name: "Day shift", t: ["07:00", "10:00", "13:00", "16:00"], h: ["07", "09", "11", "13", "15", "17"], p: null, ct: "CIL tank 11" }
};
const ABCD = ["A", "B", "C", "D"];
const pad2 = n => String(n).padStart(2, "0");
/* v24d (20 Oct): the plant has 11 CIL tanks; a tank out of use is unticked, not left out. */
const TANKS = Array.from({ length: 11 }, (_, i) => i + 1);
/* The bottle roll's size fractions (µm), the same every time: −53A from wet sizing, −53B from dry sizing. */
const BRT_FR = [["+425", "+425 µm"], ["+212", "+212 µm"], ["+150", "+150 µm"], ["+106", "+106 µm"], ["+75", "+75 µm"], ["+53", "+53 µm"], ["-53A", "−53 µm, wet sizing"], ["-53B", "−53 µm, dry sizing"]];
/* The analysis a point usually gets (the shift reports); a point not listed takes its type's first. */
const POINT_TEST = {
  "CIL feed": "aufx_ausx", "Special CIL feed": "aufx_ausx", "CIL tails": "aufx_ausx", "COF (cyclone overflow)": "aufx_ausx", "CUF (cyclone underflow)": "aufx_ausx",
  "CIL tank": "aufx_ausx_cn", "CIL tails launder": "ausx", "Tails grab": "cn_only",
  "CCD overflow": "ausx_cn", "CCD feed": "aufx_ausx", "CCD underflow": "aufx_ausx", "CCD tails": "aufx_ausx",
  "TSF spigot": "cn_only", "Decant pond": "ausx_cn", "Return water": "ausx_cn", "Seepage / underdrain": "ausx_cn", "Pre-leach feed": "aufx_ausx", "Process water": "ausx_cn"
};
const JOB_TYPES = ["plant_feed", "ccd", "tsf", "carbon", "elution"];
const ptField = t => (typeOf(t)?.fields || [])[0] || { k: "point", l: "Sampling point", o: [] };
const pointTest = (t, pt) => { const k = POINT_TEST[pt]; return k && typeTests(typeOf(t)).includes(k) ? k : t === "carbon" ? "c_load" : t === "elution" ? "elu_sol" : typeOf(t)?.tests?.[0] || ""; };
/* Codes and descriptions: {S} NS/DS, {SN} Night shift / Day shift, {D} the date as yyyymmdd ({D-1} the day before), {#1} {#2} "#" and an
   elution number (blank: nothing), {n1} a number as two digits (01). det: what the sample is within its job, kept in its details: tank (0 the
   pre-leach feed), frac and side (a bottle roll's fraction, feed or tails), pair and role (a preg-robbing test and its control), bv (time). */
const R = (t, pt, test, code, desc, det) => ({ t, pt, test, code, desc, ...(det ? { det } : {}) });
const OFF = (r, ...shifts) => ({ ...r, off: shifts });   // listed, but not ticked at first on these shifts
const JOB_TPL = [
  { key: "mill", name: "Mill shift", group: "Plant", pur: "plant", sec: "PLT", shift: true, n: [["n1", "Stripped carbon: elution no."], ["n2", "Loaded carbon: elution no."]], rows: S => [
    ...ABCD.map((x, i) => R("ccd", "CCD overflow", "ausx_cn", `ML{S}REC${x}{D}`, `{SN} ${S.t[i]} CCD #1 overflow sample`)),
    ...ABCD.map((x, i) => R("plant_feed", "Tails grab", "cn_only", `ML{S}TLS${x}{D}`, `{SN} ${S.t[i]} tails grab sample`)),
    ...["A", "B"].map((x, i) => R("tsf", "TSF spigot", "cn_only", `TSF{S}PG${x}{D}`, `{SN} tails dam spigot sample ${x}${S.p ? ` ${S.p[i]}HRS` : ""}`)),
    OFF(R("carbon", "Eluted carbon", "c_load", "ML{S}CBST{D}{#1}", "Mill {sn} stripped carbon for the elution circuit{#1}"), "D"),
    OFF(R("carbon", "Regenerated carbon", "c_load", "ML{S}CBRG{D}", "Mill {sn} regen carbon from the elution circuit"), "N"),
    ...TANKS.filter(i => i >= 6).map(i => R("carbon", "CIL tank carbon", "c_load", `ML{S}CL${pad2(i)}{D}`, `Mill {sn} carbon from CIL tank ${i}`, { tank: i })),
    OFF(R("carbon", "Loaded carbon (to elution)", "c_load", "ML{S}CBLD{D}{#2}", "Mill {sn} loaded carbon for the elution circuit{#2}"), "D"),
    ...TANKS.filter(i => i < 6).map(i => R("carbon", "CIL tank carbon", "c_load", `ML{S}CL${pad2(i)}{D}`, `Mill {sn} carbon from CIL tank ${i}`, { tank: i })),
    ...S.h.map(h => R("plant_feed", "CIL tails launder", "ausx", `ML{S}CT${h}{D}`, `Mill {sn} ${S.ct} ${h}00 hours special sample`)),
    R("tsf", "Decant pond", "ausx_cn", "ML{S}POND{D}", "Decant pond solution"),
    R("plant_feed", "CIL feed", "aufx_ausx", "ML{S}CLF1{D}", "Mill {sn} CIL feed 1"),
    R("plant_feed", "CIL feed", "aufx", "ML{S}CLF2{D}", "Mill {sn} CIL feed 2"),
    R("plant_feed", "CIL tails", "aufx_ausx", "ML{S}CLTL{D}", "Mill {sn} CIL tails"),
    R("plant_feed", "COF (cyclone overflow)", "aufx_ausx", "ML{S}COF {D}", "Mill {sn} cyclone overflow"),
    R("plant_feed", "CUF (cyclone underflow)", "aufx", "ML{S}CUF {D}", "Mill {sn} cyclone underflow"),
    R("ccd", "CCD tails", "aufx_ausx", "ML{S}TDDS{D}", "{SN} CCD tails sample"),
    R("plant_feed", "CIL tank", "aufx_ausx", "ML{S}TK11{D}", "{SN} tank 11 sample", { tank: 11 }),
    R("plant_feed", "Special CIL feed", "aufx_ausx", "ML{S}SPFD{D}", "Mill {sn} special CIL feed")
  ] },
  { key: "elution", name: "Elution run", group: "Plant", pur: "plant", sec: "PLT", shift: false, n: [["n1", "Strip no."]], rows: () => [
    ...Array.from({ length: 10 }, (_, i) => (i + 1) * 60).map(m => R("elution", "Electrowinning tails", "elu_sol", `MLSPE${String(m).padStart(3, "0")}{D}`, `Electrowinning tails solution ${m} mins`, { bv: `${m} min` })),
    ...Array.from({ length: 11 }, (_, i) => i * 60).map(m => R("elution", "Electrowinning head", "elu_sol", `MLSPH${String(m).padStart(3, "0")}{D}`, `Electrowinning head solution ${m} mins`, { bv: `${m} min` })),
    ...Array.from({ length: 12 }, (_, i) => (i + 1) * 30).map(m => R("elution", "Pregnant solution", "elu_sol", `MLSPP${String(m).padStart(3, "0")}{D}`, `Pregnant solution ${String(m).padStart(3, "0")} mins`, { bv: `${m} min` })),
    R("elution", "Lean eluate", "elu_sol", "MLSPLNAF{D}", "Lean eluate solution after strip"),
    R("elution", "Lean eluate", "elu_sol", "MLSPLNBF{D}", "Lean eluate solution before strip"),
    R("elution", "Treated water", "elu_sol", "MLSPTRTD{D}", "Mill special treated water")
  ] },
  { key: "cact", name: "Carbon activity", group: "Plant", also: ["MET Lab"], pur: "plant", sec: "PLT", shift: true, n: [["n1", "Elution no."]], rows: () => [
    R("carbon", "Regenerated carbon", "c_act", "ML{S}CBRG{D}", "Mill {sn} regen carbon from the elution circuit"),
    R("carbon", "Eluted carbon", "c_act", "MLSCBST{D}{#1}", "Mill special stripped carbon for the elution circuit{#1}"),
    R("carbon", "Loaded carbon (to elution)", "c_act", "MLSCBLD{D-1}{#1}", "Mill special loaded carbon for the elution circuit{#1}"),   // sampled the day before its strip (the lab's report)
    { ...R("carbon", "Fresh carbon", "c_act", "", "Virgin carbon"), ph: "The supplier's code" }
  ] },
  /* v24d (20 Oct): the MET Lab's routine jobs, from its reports. Codes: MLSP (mill special) for the tank profile, MLAB for the MET Lab's own. */
  { key: "tank", name: "Tank profile", group: "MET Lab", pur: "plant", sec: "MET", shift: false, n: [], rows: () => [
    R("plant_feed", "Pre-leach feed", "aufx_ausx", "MLSPPLFD{D}", "Pre-leach feed", { tank: 0 }),
    ...TANKS.map(i => R("plant_feed", "CIL tank", "aufx_ausx", `MLSPTK${pad2(i)}{D}`, `Mill special tank ${pad2(i)} slurry sample`, { tank: i })),
    R("plant_feed", "Process water", "ausx_cn", "PROCWATE{D}", "Mill special process water sample")
  ] },
  { key: "brt", name: "Bottle roll (BRT)", group: "MET Lab", pur: "met_br", sec: "MET", shift: false, mass: true, n: [["n1", "Filtrate no.", "01"]], rows: () => [
    ...BRT_FR.map(([f, l]) => R("plant_feed", "BRT feed", "aufx", `MLABPF${f}{D}`, `BRT feed ${l}`, { frac: f, side: "Feed" })),
    ...BRT_FR.map(([f, l]) => R("plant_feed", "BRT tails", "aufx", `MLABPT${f}{D}`, `BRT tails ${l}`, { frac: f, side: "Tails" })),
    R("plant_feed", "BRT filtrate", "ausx", "MLABSL{n1}{D}", "BRT filtrate solution")
  ] },
  { key: "preg", name: "Preg-robbing test", group: "MET Lab", pur: "met_pri", sec: "MET", shift: false, cnt: [["n", "Samples tested", 15]], n: [["sp", "Spike (mg/L Au)", "", "Spike (mg/L)"]], rows: (S, C) => [
    ...Array.from({ length: C.n }, (_, i) => R("plant_feed", "Preg-rob test", "ausx", `MLABPREG${pad2(i + 1)}{D}`, `Preg-rob test ${pad2(i + 1)}: ore with the spiked solution`, { pair: i + 1, role: "Test" })),
    ...Array.from({ length: C.n }, (_, i) => R("plant_feed", "Preg-rob control", "ausx", `MLABPREG${pad2(C.n + i + 1)}{D}`, `Preg-rob control for ${pad2(i + 1)}`, { pair: i + 1, role: "Control" }))
  ] },
  /* v31 (21 Oct): the QA/QC set's three series are its ID groups, each with its own first code and number of samples (more can be added). */
  { key: "qaqc", name: "QA/QC set", group: "MET Lab", pur: "qc", sec: "MET", shift: false, n: [], rows: () => [], grp: [
    { l: "Process plant (PPS)", f: "MLABPPS01", n: 45, t: "plant_feed", test: "aufx", pt: "Process plant sample", d: "MET QA/QC process plant sample" },
    { l: "Carbon (CB)", f: "MLABCB01", n: 26, t: "carbon", test: "c_load", pt: "Carbon sample", d: "MET QA/QC carbon sample" },
    { l: "Filtrate solution (SL)", f: "MLABSL01", n: 15, t: "plant_feed", test: "ausx", pt: "BRT filtrate", d: "MET QA/QC filtrate solution" }] },
  /* v31: "leave room to type in a testwork aside the 5 routine ones, you know anything can come up": named by the submitter, its samples
     from ID groups (first code, number, type, analysis); on Shift end it is "Other samples". */
  { key: "custom", name: "Other testwork", names: { Plant: "Other samples" }, group: "Plant", also: ["MET Lab"], pur: "plant", purG: { "MET Lab": "met" }, sec: "PLT", shift: false, tw: true, n: [], rows: () => [],
    grp: [{ f: "", n: 1, t: "plant_feed", test: "aufx_ausx" }] }
];
/* v31: a template's ID groups: what it was last submitted with on this device, else its own. v32: a template of fixed rows has none (its own
   codes) until groups are chosen, and then they replace its rows ("if you choose 2 or more ID groups, the default ID is still showing"). */
const tplName = (T, g = jobKindGroup()) => (T.names || {})[g] || T.name;
const tplPur = T => (T.purG || {})[jobKindGroup()] || T.pur;
const grpKey = () => "jobGrp_" + job.tpl + (jobTpl(job.tpl).tw ? "_" + jobKindGroup() : "");
const blankGrp = last => ({ f: "", n: 1, t: last?.t || "plant_feed", test: last?.test || pointTest(last?.t || "plant_feed", ""), t2: [], xa: [] });
function jobGroupsFor(T){
  const ok = g => g && typeof g === "object" && typeof g.f === "string" && g.f.length <= 50 && Number.isInteger(g.n) && g.n >= 0 && g.n <= 99 && typeOf(g.t) && typeof g.test === "string";
  try { const s = JSON.parse(lsGet(grpKey()) || "null"); if (Array.isArray(s) && s.length >= (T.grp ? 1 : 0) && s.length <= IDG_MAX && s.every(ok))
    return s.map(g => ({ f: g.f, n: g.n, t: g.t, test: g.test, t2: Array.isArray(g.t2) ? g.t2.filter(k => typeof k === "string").slice(0, 12) : [], xa: Array.isArray(g.xa) ? splitAn(g.xa.join(",")) : [], l: String(g.l || "").slice(0, 60), pt: typeof g.pt === "string" ? g.pt.slice(0, 60) : undefined, d: typeof g.d === "string" ? g.d.slice(0, 80) : undefined })); } catch {}
  return clone(T.grp || []).map(g => ({ t2: [], xa: [], ...g }));
}
/* The rows an ID group makes: its first code counted on (and the date), its label numbered; what was typed over on a row stays. */
function groupRows(keep){
  const prev = new Map((keep || []).filter(r => r.grp != null).map(r => [r.grp + ":" + r.gj, r])), out = [];
  (job.g || []).forEach((g, gi) => {
    if (!hasFirst(g)) return;
    const n = Math.max(0, Math.min(99, +g.n || 0)), lab = g.d || g.l || "";
    for (let j = 0; j < n; j++){
      const o = prev.get(gi + ":" + j), gen = [seriesCode(g.f, j, n) + "{D}", lab ? `${lab} ${pad2(j + 1)}` : ""];
      out.push({ on: o?.ut ? o.on : true, ut: !!o?.ut, ph: "", t: g.t, pt: g.pt ?? g.l ?? "", test: o?.tt ? o.test : g.test, t2: o?.tt ? o.t2 : [...(g.t2 || [])], xa: o?.tt ? o.xa : [...(g.xa || [])], tt: !!o?.tt,
        code: o?.ec ? o.code : jobFill(gen[0], job), desc: o?.ed ? o.desc : jobFill(gen[1], job), det: null, mass: o?.mass || "", ec: !!o?.ec, ed: !!o?.ed, gen, grp: gi, gj: j });
    }
  });
  return out;
}
/* Counts for a template's numbered sets (what was typed, or its usual number), up to 99 each. */
const jobCounts = T => Object.fromEntries((T.cnt || []).map(([k, , d]) => { const v = job?.c?.[k]; return [k, Math.max(0, Math.min(99, v == null || v === "" ? d : +v || 0))]; }));
const jobNum = (T, k) => { const e = (T.n || []).find(x => x[0] === k); return job?.n?.[k] != null && job.n[k] !== "" ? job.n[k] : e?.[2] || ""; };
const jobTpl = k => JOB_TPL.find(x => x.key === k) || JOB_TPL[0];
const dayCode = v => String(v || "").replace(/-/g, "");   // a date input's yyyy-mm-dd as yyyymmdd
let job = null;   // { tpl, shift, date, n: {n1, n2}, rows: [{ on, t, pt, test, code, desc, det, ec, ed }] } (ec / ed: code / description typed over)
function jobFill(x, ctx){
  const S = JOB_SHIFT[ctx.shift] || JOB_SHIFT.N, num = k => ctx.n[k] ? "#" + String(ctx.n[k]).replace(/^#/, "") : "";
  const t0 = Date.parse(String(ctx.date || "") + "T12:00:00Z"), before = isFinite(t0) ? dayCode(new Date(t0 - 86400e3).toISOString().slice(0, 10)) : "";
  const n1 = String(jobNum(jobTpl(ctx.tpl), "n1")).replace(/\D/g, ""), two = n1 ? pad2(+n1) : "";
  return String(x).replace(/\{S\}/g, S.code).replace(/\{SN\}/g, S.name).replace(/\{sn\}/g, S.name.toLowerCase()).replace(/\{D-1\}/g, before).replace(/\{D\}/g, dayCode(ctx.date)).replace(/\{#1\}/g, num("n1")).replace(/\{#2\}/g, num("n2")).replace(/\{n1\}/g, two);
}
/* The rows for the template, shift, date and numbers: generated codes and descriptions follow them, what was typed over stays. */
function jobRows(keep){
  const T = jobTpl(job.tpl), S = JOB_SHIFT[job.shift] || JOB_SHIFT.N, base = job.g.length && !T.grp ? [] : T.rows(S, jobCounts(T));
  const own = (keep || []).filter(r => !r.extra && r.grp == null), old = keep && own.length === base.length ? own : null;
  job.rows = [...base.map((r, i) => {
    const o = old && old[i];
    const on0 = !(r.off || []).includes(job.shift), fresh = r.ph && !o?.ec ? lsGet("jobFresh") || "" : "";
    return { on: o?.ut ? o.on : on0, ut: !!o?.ut, ph: r.ph || "", t: r.t, pt: r.pt, test: o?.test || r.test, t2: o?.t2 || [], xa: o?.xa || [], tt: !!o?.tt, dc: !!o?.dc, code: o?.ec ? o.code : fresh || jobFill(r.code, job), desc: o?.ed ? o.desc : jobFill(r.desc, job), det: r.det || null, mass: o?.mass || "", ec: !!o?.ec || !!fresh, ed: !!o?.ed, gen: [r.code, r.desc] }; }),
    ...groupRows(keep), ...(keep || []).filter(r => r.extra)];
}
function jobBlock(){
  return `<div class="sub-step s1 job-step" id="rJob" hidden><div class="sub-t"><span class="num">1</span>Shift end samples</div>
    <div class="form">
      <label class="f"><span>Template</span><select id="jTpl" data-g="Plant">${JOB_TPL.filter(x => x.group === "Plant").map(x => `<option value="${x.key}">${esc(x.name)}</option>`).join("")}</select></label>
      <label class="f" id="jShiftBox"><span>Shift</span><select id="jShift"><option value="N">Night shift (NS)</option><option value="D">Day shift (DS)</option></select></label>
      <label class="f"><span>Date on the codes</span><input id="jDate" type="date"></label>
      <div class="f" id="jNums"></div>
    </div>
    <div id="jIdg"></div>
    <div class="tbl-wrap"><table class="jrows"><thead><tr><th><input type="checkbox" id="jAll" aria-label="Tick all" checked></th><th>Sample</th><th>Code</th><th>Description</th><th>Analysis</th><th id="jMassH" hidden>Mass (g)</th></tr></thead><tbody id="jRows"></tbody></table></div>
    <div class="row" style="gap:8px"><select class="inp" id="jAdd" style="width:auto;max-width:100%" aria-label="Add a sample"><option value="">+ Add a sample…</option>${JOB_TYPES.map(t => `<optgroup label="${esc(typeOf(t)?.name || t)}">${(ptField(t).o || []).filter(p => !/^other$/i.test(p)).map(p => `<option value="${esc(t + "|" + p)}">${esc(p)}</option>`).join("")}<option value="${esc(t)}|">Other point…</option></optgroup>`).join("")}<optgroup label="Other sample types">${TYPES.filter(t => !JOB_TYPES.includes(t.key)).map(t => `<option value="${esc(t.key)}|">${esc(t.name)}</option>`).join("")}</optgroup></select>
      <span class="small" id="jInfo"></span></div>
  </div>`;
}
const jobTestOpts = (t, sel) => (t === "other" ? TESTS.map(x => x.key) : typeTests(typeOf(t) || { tests: [] })).filter(k => testOn(k) || k === sel).map(k => `<option value="${esc(k)}" ${k === sel ? "selected" : ""}>${esc(testOf(k)?.name || k)}</option>`).join("") + xOpt(t, sel);
const jobTypeOpts = sel => `${JOB_TYPES.map(t => `<option value="${t}" ${t === sel ? "selected" : ""}>${esc(typeOf(t)?.name || t)}</option>`).join("")}<optgroup label="Other sample types">${TYPES.filter(t => !JOB_TYPES.includes(t.key)).map(t => `<option value="${t.key}" ${t.key === sel ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</optgroup>`;
/* An ID group of a job: its type and analysis beside its first code and number; its label and other analyses under More. */
const jobGrpExtra = (g, i) => `<label class="f g-tf"><span>Sample type</span><select class="inp g-t" data-g="${i}">${jobTypeOpts(g.t)}</select></label>
  <label class="f g-af"><span>Analysis</span><select class="inp g-test" data-g="${i}">${jobTestOpts(g.t, g.test)}</select></label>
  <details class="g-more"${(g.t2 || []).length || (g.xa || []).length || g.test === "x" ? " open" : ""}><summary>More</summary><label class="f"><span>Label</span><input class="inp g-l" data-g="${i}" value="${esc(g.l || "")}" maxlength="60" placeholder="e.g. Standards" autocomplete="off"></label>${anMore("jGA" + i, g.t, g.test, g.t2 || [], g.xa || [])}</details>`;
function renderJobGroups(){
  const box = $("#jIdg"); if (!box || !job) return;
  box.innerHTML = idgBlock("j", job.g, { count: true, extra: jobGrpExtra, zero: !jobTpl(job.tpl).grp });
  idgPreview(box, job.g, job.date);
}
/* A row's other analyses fold under its analysis, filled in when opened. */
const rowAn = (r, i) => { const l = anLabel(r.t, r.test, r.t2 || [], r.xa || []), open = !!l || r.test === "x";
  return `<details class="an-more mini" data-j="${i}"${open ? " open" : ""}${open ? ' data-f="1"' : ""}><summary title="More analyses">${esc(l || "+ More")}</summary>${open ? anMoreBody(r.t, r.test, r.t2 || [], r.xa || []) : ""}</details>`; };
function renderJob(){
  const body = $("#jRows"); if (!body || !job) return;
  const T = jobTpl(job.tpl);
  $("#jShiftBox").hidden = !T.shift;
  const nb = $("#jNums"); if (nb && nb.dataset.tpl !== T.key + jobKindGroup()){ nb.dataset.tpl = T.key + jobKindGroup(); renderJobGroups(); nb.innerHTML = `<div class="form">${T.tw ? `<label class="f"><span>Testwork</span><input id="jTw" maxlength="60" placeholder="e.g. Leach kinetics" value="${esc(job.tw || "")}" autocomplete="off"></label>` : ""}${(T.cnt || []).map(([k, l, d]) => `<label class="f"><span>${esc(l)}</span><input id="jC_${k}" type="number" min="0" max="99" step="1" inputmode="numeric" value="${esc(job.c?.[k] ?? d)}"></label>`).join("")}${T.n.map(([k, l, d, dl]) => `<label class="f"><span>${esc(l)}</span><input id="jN_${k}" ${dl ? 'inputmode="decimal"' : 'inputmode="numeric"'} maxlength="8" placeholder="${esc(d || (dl ? "e.g. 2.5" : "e.g. 31"))}" value="${esc(job.n[k] || "")}"></label>`).join("")}</div>`; }
  $("#jMassH").hidden = !T.mass;
  const rowHtml = (r, i) => `<tr class="${r.on ? "" : "off"}"><td><input type="checkbox" data-jon="${i}" ${r.on ? "checked" : ""} aria-label="Include ${esc(r.code)}"></td>
    <td><span class="small muted">${esc(typeOf(r.t)?.name || r.t)}</span><div>${r.ptx ? `<input class="inp j-pt" data-j="${i}" value="${esc(r.pt)}" maxlength="60" placeholder="Point or what it is" aria-label="Sampling point, row ${i + 1}" autocomplete="off">` : `<b>${esc(r.pt)}</b>`}</div></td>
    <td><input class="inp j-code" data-j="${i}" value="${esc(r.code)}" aria-label="Code, row ${i + 1}" placeholder="${esc(r.ph || "")}" autocomplete="off" spellcheck="false"></td>
    <td><input class="inp j-desc" data-j="${i}" value="${esc(r.desc)}" aria-label="Description, row ${i + 1}" placeholder="Description" autocomplete="off"></td>
    <td><select class="inp j-test" data-j="${i}" aria-label="Analysis, row ${i + 1}">${jobTestOpts(r.t, r.test)}</select>${rowAn(r, i)}</td>${T.mass ? `<td>${r.det?.frac ? `<input class="inp j-mass" data-j="${i}" inputmode="decimal" value="${esc(r.mass || "")}" aria-label="Mass in grams, ${esc(r.code)}" placeholder="g">` : ""}</td>` : ""}</tr>`;
  /* v32: an ID group's rows fold under one line (its codes first … last, how many ticked), opened with a tap; a small group, or one with a
     code missing or twice, shows its rows. */
  const bad = jobBad(), byG = new Map(), done = new Set(), cols = T.mass ? 5 : 4;
  job.rows.forEach((r, i) => { if (r.grp != null) (byG.get(r.grp) || byG.set(r.grp, []).get(r.grp)).push(i); });
  body.innerHTML = job.rows.map((r, i) => {
    if (r.grp == null) return rowHtml(r, i);
    if (done.has(r.grp)) return "";
    done.add(r.grp);
    const ix = byG.get(r.grp), rs = ix.map(j => job.rows[j]), g = job.g[r.grp] || {}, on = rs.filter(x => x.on).length;
    const open = job.open?.has(r.grp) ? job.open.get(r.grp) : ix.length <= 3 || ix.some(j => bad.has(j));
    return `<tr class="j-gh${on ? "" : " off"}"><td><input type="checkbox" data-jgon="${r.grp}" ${on === rs.length ? "checked" : ""} aria-label="Tick ${esc(g.l || `group ${r.grp + 1}`)}"></td><td colspan="${cols}"><button type="button" class="j-gt" data-gt="${r.grp}" aria-expanded="${open}"><span class="j-gc" aria-hidden="true">${open ? "▾" : "▸"}</span><b>${esc(g.l || (job.g.length > 1 ? `Group ${r.grp + 1}` : "ID group"))}</b><span>${on === rs.length ? nS(rs.length) : `${on} of ${nS(rs.length)}`}</span><span class="mono small muted">${esc(rs[0].code)}${rs.length > 1 ? ` … ${esc(rs.at(-1).code)}` : ""}</span></button></td></tr>`
      + (open ? ix.map(j => rowHtml(job.rows[j], j)).join("") : "");
  }).join("");
  jobHints(); idgPreview($("#jIdg"), job.g, job.date); coolBox();
}
/* The rows with a problem: ticked without a code, or a code twice. */
function jobBad(){
  const out = new Set(), seen = new Map();
  (job?.rows || []).forEach((r, i) => { if (!r.on) return; const k = normKey(r.code); if (!k){ out.add(i); return; } if (seen.has(k)){ out.add(i); out.add(seen.get(k)); } else seen.set(k, i); });
  return out;
}
function jobHints(){
  if (!job) return;
  const on = job.rows.filter(r => r.on), seen = new Map(), dup = new Set();
  job.rows.forEach((r, i) => { if (!r.on) return; const k = normKey(r.code); if (!k) return; if (seen.has(k)){ dup.add(i); dup.add(seen.get(k)); } else seen.set(k, i); });
  document.querySelectorAll("#jRows .j-code").forEach(el => el.classList.toggle("dup", dup.has(+el.dataset.j) || (job.rows[+el.dataset.j].on && !el.value.trim())));
  const info = $("#jInfo");
  if (info){ info.textContent = dup.size ? "Same code twice" : `${on.length} of ${job.rows.length} samples ticked · untick what was not sampled`; info.classList.toggle("bad-t", dup.size > 0); }
  const all = $("#jAll"); if (all) all.checked = on.length === job.rows.length;
  // a number that goes into codes (elution no. after #) is asked for while a ticked sample's code carries it; one that does not (strip no.) always
  const inCode = (r, k) => String(r.gen?.[0] || "").includes(`{#${k.slice(1)}}`) || String(r.gen?.[0] || "").includes(`{${k}}`);
  const T = jobTpl(job.tpl), swapped = !T.grp && job.g.length > 0;
  T.n.forEach(([k, , , dl]) => { const el = $("#jN_" + k)?.closest("label"); if (el) el.hidden = swapped ? !dl : job.rows.some(r => inCode(r, k)) && !on.some(r => inCode(r, k)); });
  (T.cnt || []).forEach(([k]) => { const el = $("#jC_" + k)?.closest("label"); if (el) el.hidden = swapped; });
  submitLabel();
}
function bindJob(v){
  const tp = $("#jTpl", v); if (!tp) return;
  /* In the morning the night shift's samples come in (the shift began the day before); in the evening the day shift's. */
  const hr = +localInput(Date.now()).slice(11, 13), night = hr >= 6 && hr < 18, back = night || hr < 6 ? 1 : 0;
  job = { tpl: lsGet("jobTpl_Plant") || lsGet("jobTpl") || "mill", shift: night ? "N" : "D", date: localInput(Date.now() - back * 86400e3).slice(0, 10), n: {}, c: {}, g: [], tw: "", rows: [] };
  if (!JOB_TPL.some(x => x.key === job.tpl)) job.tpl = "mill";
  jobKept.clear();   // v33: a new form keeps nothing from the last one
  job.g = jobGroupsFor(jobTpl(job.tpl));
  job.date = jobDate(jobTpl(job.tpl));   // 21 Oct: a template without a shift (an elution run, the MET Lab's jobs) takes today's date
  tp.value = job.tpl; $("#jShift", v).value = job.shift; $("#jDate", v).value = job.date;
  jobRows(); renderJob(); if (isJobKind(formKind())){ jobGroup(v); jobSections(v); jobPurposes(v); jobDefaults(v); }
  const again = () => { jobRows(job.rows); renderJob(); };
  tp.onchange = () => { const g = jobKindGroup(); jobKeep(jobKey(job.tpl, g)); job.tpl = tp.value; lsSet("jobTpl_" + g, tp.value); if (!jobBack(jobKey(job.tpl, g))) jobFresh();   // v33: each template's entries come back with it
    renderJob(); jobDateFor(v); jobPurposes(v); jobDefaults(v); };
  $("#jShift", v).onchange = e => { job.shift = e.target.value; again(); };
  $("#jDate", v).onchange = e => { const was = dayCode(job.date); job.date = e.target.value; job.dateSet = true;
    job.rows.forEach(r => { if (r.dc && was && r.code.endsWith(was)) r.code = r.code.slice(0, -8) + dayCode(job.date); });   // v32: a code the date completed follows it
    again(); idgPreview($("#jIdg", v), job.g, job.date); };
  $("#jNums", v).addEventListener("input", e => { if (e.target.id === "jTw"){ job.tw = e.target.value.trim().slice(0, 60); return; }
    const c = e.target.id.match(/^jC_(\w+)$/); if (c){ job.c[c[1]] = e.target.value; jobRows(job.rows); renderJob(); return; }   // a count: the numbered rows follow
    const m = e.target.id.match(/^jN_(\w+)$/); if (!m) return; job.n[m[1]] = e.target.value.trim(); job.rows.forEach(r => { if (!r.extra){ if (!r.ec) r.code = jobFill(r.gen[0], job); if (!r.ed) r.desc = jobFill(r.gen[1], job); } });
    document.querySelectorAll("#jRows .j-code").forEach(el => { el.value = job.rows[+el.dataset.j].code; }); document.querySelectorAll("#jRows .j-desc").forEach(el => { el.value = job.rows[+el.dataset.j].desc; }); jobHints(); });
  /* v31: ID groups. The rows follow every change; a first code typed with its date gives the date to the date box. */
  const ig = $("#jIdg", v), regen = () => { jobRows(job.rows); renderJob(); idgPreview(ig, job.g, job.date); };
  ig.addEventListener("input", e => { const el = e.target, g = job.g[+el.dataset.g];
    if (el.classList.contains("g-first") && g){ g.f = el.value; regen(); }
    else if (el.classList.contains("g-n") && g){ const k = Math.floor(+el.value); if (k >= 0 && k <= 99 && el.value !== ""){
      if (hasFirst(g) && job.rows.filter(r => r.grp !== +el.dataset.g).length + k > 100) return toast("Up to 100 samples in one job.");   // v32: said as it is typed
      g.n = k; regen(); } }
    else if (el.classList.contains("g-l") && g){ g.l = el.value.slice(0, 60); regen(); }
    else if (el.classList.contains("an-x")){ const d = el.closest(".an-more"), gr = job.g[+d.id.slice(3)]; if (gr){ gr.xa = anRead(d).xan; anSum(d); regen(); } } });
  ig.addEventListener("change", e => { const el = e.target, gi = +el.dataset.g, g = job.g[gi];
    if (el.classList.contains("g-first") && g){ const d = splitDated(el.value); if (d){ g.f = d.f; el.value = d.f; job.date = d.d; job.dateSet = true; $("#jDate", v).value = d.d; regen(); } }
    else if (el.classList.contains("g-n") && g) el.value = g.n;
    else if (el.classList.contains("g-t") && g){ g.t = el.value; g.test = pointTest(g.t, ""); g.t2 = []; renderJobGroups(); regen(); }
    else if (el.classList.contains("g-test") && g){ g.test = el.value; g.t2 = (g.t2 || []).filter(k => k !== g.test); renderJobGroups(); regen(); if (g.test === "x") ig.querySelector(`#jGA${gi} .an-x`)?.focus(); }
    else if (el.id === "jGn"){ const was = job.g.length, T = jobTpl(job.tpl); resizeGroups(job.g, +el.value, blankGrp, T.grp ? 1 : 0); renderJobGroups();
      jobRows(job.rows); renderJob(); if (job.g.length > was) ig.querySelector(`.g-first[data-g="${was}"]`)?.focus(); }   // a template of fixed rows: its own rows go, or come back, whole
    else if (el.type === "checkbox" && el.closest(".an-more")){ const d = el.closest(".an-more"), gr = job.g[+d.id.slice(3)]; if (gr){ gr.t2 = anRead(d).tests2; anSum(d); regen(); } } });
  const rows = $("#jRows", v);
  rows.addEventListener("input", e => { const el = e.target, r = job.rows[+el.closest("[data-j]")?.dataset.j]; if (!r) return;
    if (el.classList.contains("an-x")){ const d = el.closest(".an-more"); Object.assign(r, { xa: anRead(d).xan, tt: true }); anSum(d); return; }
    if (el.classList.contains("j-code")){ r.code = el.value; r.ec = true; } else if (el.classList.contains("j-desc")){ r.desc = el.value; r.ed = true; } else if (el.classList.contains("j-mass")){ r.mass = el.value.trim(); return; } else if (el.classList.contains("j-pt")){ r.pt = el.value.trim(); return; } jobHints(); });
  rows.addEventListener("change", e => { const el = e.target;
    if (el.dataset.jgon != null){ const gi = +el.dataset.jgon; job.rows.forEach(r => { if (r.grp === gi) Object.assign(r, { on: el.checked, ut: true }); }); renderJob(); }
    else if (el.dataset.jon != null){ Object.assign(job.rows[+el.dataset.jon], { on: el.checked, ut: true }); el.closest("tr").classList.toggle("off", !el.checked); jobHints(); }
    else if (el.classList.contains("j-test")){ const r = job.rows[+el.dataset.j]; Object.assign(r, { test: el.value, t2: (r.t2 || []).filter(k => k !== el.value), tt: true });
      const d = el.parentElement.querySelector(".an-more"); if (d){ d.outerHTML = rowAn(r, +el.dataset.j); } if (r.test === "x") el.parentElement.querySelector(".an-x")?.focus(); }
    else if (el.type === "checkbox" && el.closest(".an-more")){ const d = el.closest(".an-more"), r = job.rows[+d.dataset.j]; if (r){ Object.assign(r, { t2: anRead(d).tests2, tt: true }); anSum(d); } }
    else if (el.classList.contains("j-code")){   // v31: initials typed without a date take the job's date ("the date will complete the ID name")
      const r = job.rows[+el.dataset.j]; if (!r || r.ph || r.dc || !r.code.trim() || /\d{8}/.test(r.code) || !job.date) return;
      r.code = r.code.replace(/^\s+/, "") + dayCode(job.date); r.dc = true; el.value = r.code; jobHints(); } });
  rows.addEventListener("click", e => { const gt = e.target.closest(".j-gt"); if (gt){ (job.open ||= new Map()).set(+gt.dataset.gt, gt.getAttribute("aria-expanded") !== "true"); renderJob(); return; }
    const s = e.target.closest(".an-more.mini > summary"); if (!s) return; const d = s.parentElement, r = job.rows[+d.dataset.j];
    if (r && !d.dataset.f){ d.dataset.f = "1"; d.insertAdjacentHTML("beforeend", anMoreBody(r.t, r.test, r.t2 || [], r.xa || [])); } });
  $("#jAll", v).onchange = e => { job.rows.forEach(r => { r.on = e.target.checked; r.ut = true; }); renderJob(); };
  $("#jAdd", v).onchange = e => {
    const [t, pt] = e.target.value.split("|"); e.target.value = ""; if (!t) return;
    if (job.rows.length >= 100) return toast("Up to 100 samples in one job.");
    job.rows.push({ on: true, extra: true, t, pt: pt || "", ptx: !pt, test: pointTest(t, pt), t2: [], xa: [], code: "", desc: "", det: null, ec: true, ed: true, gen: ["", ""] });
    renderJob(); $(`#jRows ${pt ? ".j-code" : ".j-pt"}[data-j="${job.rows.length - 1}"]`)?.focus();
  };
}
/* Shift job lists the plant's templates, MET Lab job the MET Lab's (20 Oct: "MET Lab … should be independent", and "Met Jobs should also
   have 'carbon activity'"); each kind remembers its last. */
const jobKindGroup = () => formKind() === "met" ? "MET Lab" : "Plant";
/* 21 Oct: "MET jobs come from the Met department. Shift end comes from PP": that section is filled in (the process plant, PLT or PP; the
   MET Lab, MET). v31 (21 Oct): "that is too strict, I think MET or some other relevant sections should come. but P.P can come by default":
   Section lists every section that sends plant samples (those the job's sample types come from, and any an admin added). */
const JOB_SEC = [...new Set(JOB_TYPES.flatMap(t => TYPE_SECTIONS[t] || []))];
const isPP = x => ["PLT", "PP"].includes(x.code) || /process plant|^p\.?\s?p\.?$/i.test(x.name || "");
const isMET = x => x.code === "MET" || /\bmet(allurgy| ?lab)\b/i.test(x.name || "");
const jobSecs = g => { const all = cfg.sections || [], l = all.filter(x => JOB_SEC.includes(x.code) || !knownSec(x.code) || isPP(x) || isMET(x)); return l.length ? l : all; };
const jobSec0 = g => ((cfg.sections || []).find(g === "MET Lab" ? isMET : isPP) || {}).code || "";
const kindFor = (k, sec) => !sec || !knownSec(sec) || (k === "met" ? isMET((cfg.sections || []).find(x => x.code === sec) || { code: sec }) : jobSecs("Plant").some(x => x.code === sec));   // a section account sees the kinds it sends: MET Lab job from the MET Lab, Shift end from any plant section (v31)
function jobSections(v){
  const sc = $("#rSection", v || document); if (!sc || !job) return;
  const list = jobSecs(jobKindGroup()), keep = sc.value;
  sc.innerHTML = (list.length === 1 ? "" : `<option value="">Choose…</option>`) + list.map(x => `<option value="${esc(x.code)}">${esc(x.code)} · ${esc(x.name)}</option>`).join("");
  sc.value = list.some(x => x.code === keep) ? keep : list.length === 1 ? list[0].code : "";
  sc.dataset.job = jobKindGroup();
}
/* What a job's samples can be sent for: what its sample types take, and the template's usual purpose (QA/QC for the MET Lab's set). */
function jobPurposes(v){
  const pu = $("#rPurpose", v || document); if (!pu || !job) return;
  const T = jobTpl(job.tpl), keys = new Set([tplPur(T), "other", ...[...new Set(job.rows.map(r => r.t))].flatMap(t => TYPE_PURPOSES[t] || [])]), keep = pu.value;
  pu.innerHTML = `<option value="">Choose…</option>${purposeOptions("", keys)}`;
  if (keep && keys.has(keep)) pu.value = keep;
  pu.dataset.job = "1";
}
/* The date on the codes: a shift's start (the night shift began the day before), else today. Kept once the submitter sets it. */
const jobDate = T => { const hr = +localInput(Date.now()).slice(11, 13), back = T && T.shift && (hr < 18) ? 1 : 0; return localInput(Date.now() - back * 86400e3).slice(0, 10); };
function jobDateFor(v){
  if (!job || job.dateSet) return;
  const d = jobDate(jobTpl(job.tpl)); if (d === job.date) return;
  job.date = d; const el = $("#jDate", v || document); if (el) el.value = d;
  jobRows(job.rows); renderJob();
}
const inGroup = (x, g) => x.group === g || (x.also || []).includes(g);
/* A MET Lab job runs on the job route too; its workflow and certificate say so (a carbon activity sent by MET counts as MET's). */
function isMetJob(s){ if (s && s.route === "MET-JOB") return true; const T = s && s.job ? JOB_TPL.find(x => x.key === s.job) : null; return !!T && (T.group === "MET Lab" || (s.section === "MET" && inGroup(T, "MET Lab"))); }
function routeLabel(s, name){ const n = name ?? s?.routeName ?? ""; return s && s.route === "JOB" && s.job ? (isMetJob(s) ? "MET Lab job (one report)" : "Shift end (one report)") : n; }
/* v33 (22 Oct, "keep what's typed when you switch between Single, Batch, Shift end and MET Lab job" — "yes, add it"): each template keeps
   what was typed on it (rows ticked, codes and descriptions typed over, analyses, masses, numbers, counts, ID groups, the testwork name)
   while another kind or template is on screen, and gets it back. A template in both kinds (Carbon activity) is one; Other testwork is
   one for each kind. */
const jobKept = new Map(), jobKey = (tpl, g) => tpl + (jobTpl(tpl).tw ? "|" + g : "");
function jobKeep(k){ if (job) jobKept.set(k, clone({ n: job.n, c: job.c, g: job.g, tw: job.tw, rows: job.rows, open: [...(job.open || new Map())] })); }
function jobBack(k){ const s = jobKept.get(k); if (!s) return false; Object.assign(job, { n: s.n, c: s.c, g: s.g, tw: s.tw, open: new Map(s.open) }); jobRows(s.rows); return true; }
function jobFresh(){ job.n = {}; job.c = {}; job.tw = ""; job.open = new Map(); job.g = jobGroupsFor(jobTpl(job.tpl)); jobRows(); }
function jobGroup(v){
  const g = jobKindGroup(), tp = $("#jTpl", v || document); if (!tp || !job) return;
  const list = JOB_TPL.filter(x => inGroup(x, g));
  if (tp.dataset.g !== g){ tp.dataset.g = g; tp.innerHTML = list.map(x => `<option value="${x.key}">${esc(tplName(x, g))}</option>`).join(""); }
  const last = lsGet("jobTpl_" + g), tpl = list.some(x => x.key === job.tpl) ? job.tpl : list.some(x => x.key === last) ? last : list[0].key;
  const was = job.kg ? jobKey(job.tpl, job.kg) : "";
  if (!job.kg && tpl === job.tpl){ if (jobTpl(tpl).tw){ job.g = jobGroupsFor(jobTpl(tpl)); jobRows(job.rows); } }   // first shown: as built (Other testwork: this kind's groups)
  else if (jobKey(tpl, g) !== was){ if (was) jobKeep(was); job.tpl = tpl; if (!jobBack(jobKey(tpl, g))) jobFresh(); }
  job.kg = g;
  tp.value = job.tpl; renderJob(); jobDateFor(v);
  const t = $("#rJob .sub-t", v || document); if (t) t.innerHTML = `<span class="num">1</span>${g === "MET Lab" ? "MET Lab samples" : "Shift end samples"}`;
}
/* The template's purpose and section (a MET Lab job from MET), filled in until the submitter picks their own. */
function jobDefaults(v){
  const T0 = jobTpl(job.tpl), T = { ...T0, pur: tplPur(T0), sec: jobSecs(jobKindGroup()).length === 1 ? jobSecs(jobKindGroup())[0].code : jobSec0(jobKindGroup()) || (jobKindGroup() === "MET Lab" ? "MET" : T0.sec) }, pu = $("#rPurpose", v || document), sc = $("#rSection", v || document); if (!pu || !sc) return;
  if (!pu.value || pu.value === job.pu0 || !pu.dataset.touched){ if ([...pu.options].some(o => o.value === T.pur)){ pu.value = T.pur; job.pu0 = T.pur; } }
  if (!sc.value || sc.value === job.sc0 || (sc.dataset.auto && !sc.dataset.touched)){ if ([...sc.options].some(o => o.value === T.sec)){ sc.value = T.sec; sc.dataset.auto = "1"; job.sc0 = T.sec; } }
}
/* The submission: one batch of the ticked rows, each sample on the job route with its own analysis (its own route's retention and limits). */
async function registerJob(){
  const mode = $("#regForm")?.dataset.mode || "register", walk = mode === "register", lab = !walk && canEdit() && !!$("#rRecvNow")?.checked;
  if (!db){ toast("The shared register is not connected in this view."); return; }
  const btn = $("#rSubmit"), msg = $("#rMsg");
  const fail = (m, focus) => { toast(m); const el = focus && $(focus); if (el){ const d = el.closest("details"); if (d) d.open = true; el.focus(); } };
  const rows = (job?.rows || []).filter(r => r.on), n = rows.length;
  if (jobBad().size) renderJob();   // v32: a folded group with a problem opens before the checks point at it
  if (!job.date) return fail("Choose the date on the codes.", "#jDate");
  if (!n){ const T = jobTpl(job.tpl), byG = job.g.length > 0 || !!T.grp, firstless = job.g.findIndex(g => !hasFirst(g));
    if (job.rows.length) return fail("Tick at least one sample.", "#jAll");
    if (byG && firstless >= 0) return fail("Type the first code.", `#jIdg .g-first[data-g="${firstless}"]`);
    return fail("Set the number of samples.", byG ? "#jIdg .g-n" : (T.cnt || []).length ? `#jC_${T.cnt[0][0]}` : "#jAdd"); };
  if (n > 100) return fail("Up to 100 samples in one job.");
  const blank = rows.findIndex(r => !r.code.trim()); if (blank >= 0) return fail("Every ticked sample needs its code.", `#jRows .j-code[data-j="${job.rows.indexOf(rows[blank])}"]`);
  const tags = rows.map(r => normTag(r.code)); if (new Set(tags.map(normKey)).size !== n) return fail("The same code appears twice in this job.", "#jRows .j-code.dup");
  // v24d (20 Oct): the code is the sample's ID: up to 60 characters, and never ~ (kept for writing the characters a key can't hold)
  const badC = rows.findIndex(r => /[~\u0000-\u001f]/.test(r.code) || normTag(r.code).length > 60);
  if (badC >= 0) return fail(`${rows[badC].code.slice(0, 40)}: a code is the sample's ID, up to 60 characters and without ~.`, `#jRows .j-code[data-j="${job.rows.indexOf(rows[badC])}"]`);
  const noTest = rows.find(r => !r.test); if (noTest) return fail(`Choose the analysis for ${noTest.code}.`);
  const noX = rows.find(r => r.test === "x" && !(r.xa || []).length);
  if (noX){ const d = noX.grp == null && $(`#jRows .an-more[data-j="${job.rows.indexOf(noX)}"]`); if (d && !d.dataset.f){ d.dataset.f = "1"; d.insertAdjacentHTML("beforeend", anMoreBody(noX.t, noX.test, noX.t2 || [], noX.xa || [])); }
    return fail(`Type the analysis for ${noX.code}.`, noX.grp != null ? `#jGA${noX.grp} .an-x` : `#jRows .an-more[data-j="${job.rows.indexOf(noX)}"] .an-x`); }
  const code = val("#rSection"), puK = val("#rPurpose"), submitter = val("#rSubmitter");
  if (!puK) return fail("Choose the purpose.", "#rPurpose");
  if (!submitter) return fail("Type the name of the person submitting.", "#rSubmitter");
  if (!code) return fail("Choose the submitting section.", "#rSection");
  const handTo = lab ? "" : val("#rHandTo").slice(0, 60), handBadge = lab ? "" : val("#rHandBadge").slice(0, 20), subBadge = val("#rSubBadge").slice(0, 20);
  if (walk && !handTo) return fail("Type the name of the technician you handed it to.", "#rHandTo");
  if (walk && !handBadge) return fail("Type the technician's badge number.", "#rHandBadge");
  const now = Date.now();
  let recvAt = null, wit = "";
  if (lab){
    recvAt = fromInput($("#rRecvAt").value);
    if (!(recvAt > 0)) return fail("Enter the date and time received.", "#rRecvAt");
    if (recvAt > now + 5 * 60000) return fail("The time received can't be in the future.", "#rRecvAt");
    if (coolT() != null && coolTemp() == null){ coolBox(); return fail("Type the cooler temperature (°C).", "#rTemp"); }
    if (rows.some(r => twoPerson({ typeKey: r.t, section: code }))){ $("#rWitBox").hidden = false; if (!(wit = val("#rWit"))) return fail("Two-person custody: choose the witness.", "#rWit"); }
  }
  // 21 Oct: a MET Lab job sends its final samples, analysed as they come; what is left goes back to the MET Lab (route MET-JOB)
  const MR = jobKindGroup() === "MET Lab" ? routeByCode("MET-JOB") : null, JR = MR || routeByCode("JOB"), T = jobTpl(job.tpl), S = JOB_SHIFT[job.shift] || JOB_SHIFT.N;
  const when = job.date ? fmtDate(fromInput(job.date + "T12:00")) : fmtDate(now);
  const batchName = `${T.tw && job.tw ? job.tw : tplName(T)}${T.shift ? `, ${S.name.toLowerCase()}` : ""}, ${when}`;
  btn.disabled = true; msg.textContent = "Checking the codes…";
  try {
    const owners = new Array(n); await pool(tags.map((t, i) => [t, i]), 6, async ([t, i]) => { owners[i] = await tagOwner(t, rows[i].test); return true; });
    /* v31: a code made from a first code that is a sample's ID already, or on an open sample for the same analysis, stops the job with the
       next free numbers offered (a code typed by hand keeps the rule: on an open sample, change it; a sample's ID, -2 after it). */
    const made = rows.map((r, i) => [r, i]).filter(([r]) => r.grp != null && !r.ec), have = new Array(n);
    await pool(made, 6, async ([, i]) => { try { const d = await db.doc("samples/" + skey(tags[i])).get(); have[i] = d.exists && d.data()?.id ? d.data().id : ""; } catch { have[i] = ""; } return true; });
    const took = made.filter(([, i]) => owners[i] || have[i]);
    if (took.length) throw { code: "taken", took: took.map(([r, i]) => [r.grp, r.gj, tags[i]]) };
    const used = owners.findIndex(Boolean); if (used >= 0) throw { code: "tagused", tag: tags[used], id: owners[used] };
    msg.textContent = "Issuing IDs…";
    const start = lab ? "received" : "submitted", priority = $("#rPriority").value, notes = val("#rNotes");
    const per = rows.map(r => {
      const t = typeOf(r.t), nat = routeFor(r.t, r.test, puK), route = JR || nat || (r.test === "x" ? OTHER_ROUTE : null);
      if (!route) throw { code: "noroute", test: r.test };
      const rf = routeFields(route, r.test);
      if (JR) Object.assign(rf, { retention: MR ? clone(rf.retention) : clone(nat?.retention || rf.retention), triggers: clone(nat?.triggers || []), qc: "", baseRoute: nat?.code || "" });
      Object.assign(rf, anFields(r.test, r.t2, r.xa));   // v31: its other analyses (the job's one step covers them)
      return { r, t, rf };
    });
    const startName = per[0].rf.plan.find(x => x.key === start)?.name || "Submitted";
    const ct = typ => typeOf(typ)?.cool, recvOf = t => lab ? { bags: 1, mass: null, unit: "kg", seal: "none", cond: "Good", temp: ct(t) != null ? String(coolTemp()) : "", holdH: null, warn: ct(t) != null && coolTemp() > ct(t) ? [`cooler at ${coolTemp()} °C, above the ${ct(t)} °C limit`] : [], ...(wit && twoPerson({ typeKey: t, section: code }) ? { wit } : {}) } : null;
    const base = { v: 13, purpose: purposeOf(puK)?.name || puK, purposeKey: puK, submitter, ...(subBadge ? { subBadge } : {}), ...(handTo ? { handedTo: handTo } : {}), ...(handBadge ? { handedBadge: handBadge } : {}),
      section: code, receivedBy: lab ? session.name : "", receivedAt: recvAt, recvAt, reassays: 0, collectedAt: null, containers: 1, massKg: null, seal: "", priority, analyses: [], notes,
      createdAt: now, createdBy: lab ? session.u : "public", createdByName: lab ? session.name : submitter, updatedAt: now, stageKey: start, stageAt: lab ? recvAt : now, location: "", flag: "",
      open: true, onHand: lab, lab: true, ...(lab ? { sx: 1 } : {}), ...(walk ? { via: "walkin" } : {}), batchKey: `${code}-${now.toString(36)}-${tabId.slice(0, 4)}`, batchSize: n, batchName, job: T.key };
    const make = (id, i, batchId) => {
      const { r, t, rf } = per[i], recv = recvOf(r.t), w = recv?.wit || "";
      const d = r.det || {}, mass = String(r.mass || "").replace(",", ".").trim();
      const details = { ...(r.pt ? { [ptField(r.t).l]: r.pt } : {}), ...(T.tw && job.tw ? { Testwork: job.tw } : {}), ...(T.shift && (t?.fields || []).some(f => f.k === "shift") ? { Shift: S.name.replace(/ shift$/, "") } : {}), ...(d.bv ? { "Time or bed volume": d.bv } : {}), ...(r.t === "elution" && job.n.n1 ? { "Elution batch / strip no.": job.n.n1 } : {}),
        ...(d.tank != null ? { "CIL tank": d.tank === 0 ? "Pre-leach" : String(d.tank) } : {}), ...(d.frac ? { "Size fraction": d.frac, BRT: d.side } : {}), ...(d.frac && mass && isFinite(+mass) && +mass > 0 ? { "Mass (g)": String(+mass) } : {}),
        ...(d.pair ? { "Preg-rob pair": pad2(d.pair), "Preg-rob": d.role } : {}), ...Object.fromEntries((T.n || []).filter(x => x[3] && job.n[x[0]]).map(x => [x[3], job.n[x[0]]])) };
      const body = { ...base, ...rf, id, type: t?.name || r.t, typeKey: r.t, details, hazards: [...(t?.haz || [])], recv, batchIndex: i + 1, ...(batchId && n > 1 ? { batchId } : {}),
        tags: [tags[i]], tagNo: tags[i], source: r.desc.trim().slice(0, 120), siteRef: "", siteRefU: "",
        history: [lab ? { key: start, sn: startName, at: recvAt, by: session.u, tech: session.name, note: `Received and registered at the lab with ${batchName}`, ref: "", ...(w ? { wit: w } : {}) }
                      : { key: start, sn: startName, at: now, by: "public", name: submitter, note: `Submitted with ${batchName}${walk ? " (walk-in)" : ""}`, ref: "", ...(handTo ? { hand: handTo } : {}), ...(handBadge ? { badge: handBadge } : {}) }] };
      if (n === 1){ delete body.batchKey; body.batchSize = 1; }
      if (lab){ body.inMid = `${id}~in`; body.ledgerPending = [inMove(body, recvAt, recv, "Registered at the lab", w)]; body.lp = true; }
      return body;
    };
    /* v24d (20 Oct): each sample's ID is its code from the plant's file (what the bag and the lab's report say). A code that is already a
       sample's ID (the same carbon sent for another analysis, or a sample sent again) takes -2, -3 …; the batch has a site number. */
    const claimCode = async (i, batchOf) => {
      for (let k = 1; k <= 30; k++){
        const id = k === 1 ? tags[i] : `${tags[i]}-${k}`, ref = db.doc("samples/" + skey(id));
        const lease = await ref.acquire({ holder: tabId, ttlMs: 4000 }); if (!lease.acquired) continue;
        const snap = await ref.get(); if (snap.exists && snap.data()?.id) continue;
        await ref.set(make(id, i, batchOf(id))); return id;
      }
      throw { code: "busy" };
    };
    /* 20 Oct: the job's batch has a site number like any batch (B-MET-20261020-0001, "to ensure uniformity"): the section's next one,
       held while its first sample is written (no sample takes a number a batch holds). */
    let ref = "", held = null;
    if (n > 1){
      const stamp = dayStamp(lab ? recvAt : now), hint = db.doc(`meta/counter-${code}-${stamp}`);
      let next = 1; try { const h = await hint.get(); next = ((h.exists && +h.data().last) || 0) + 1; } catch {}
      for (let tries = 0; tries < 400 && !ref; tries++){
        const num = next++, bid = `${code}-${stamp}-${String(num).padStart(4, "0")}`, sref = db.doc("samples/" + skey(bid));
        const lease = await sref.acquire({ holder: tabId, ttlMs: 5000 }); if (!lease.acquired) continue;   // 5 s: the most a walk-in's page may hold
        const snap = await sref.get(); if (snap.exists && snap.data()?.id) continue;
        if (await batchHolds("B-" + bid)) continue;
        ref = "B-" + bid; held = { sref, hint, num, stamp };
      }
      if (!ref) throw { code: "busy" };
    }
    const first = await claimCode(0, () => ref);
    if (held){ held.sref.acquire({ holder: tabId, ttlMs: 1000 }).catch(() => {});
      held.hint.get().then(h => { if (!(h.exists && +h.data().last >= held.num)) return held.hint.set({ last: held.num, day: held.stamp, section: code }); }).catch(() => {}); }
    msg.textContent = n > 1 ? `Saved 1 of ${n}…` : "";
    const ids = [first, ...new Array(n - 1)];
    let saved = 1;
    await pool(Array.from({ length: n - 1 }, (_, i) => i + 1), 6, async i => { ids[i] = await claimCode(i, () => ref); msg.textContent = `Saved ${++saved} of ${n}…`; return true; });
    ids.forEach((id, i) => db.doc("tagidx/" + tagKey(tags[i])).set({ sid: id, tag: tags[i], at: now }).catch(() => {}));
    const fr = rows.find(r => r.ph && r.code.trim()); if (fr) lsSet("jobFresh", fr.code.trim().slice(0, 40));
    lsSet(grpKey(), JSON.stringify(job.g.map(g => ({ f: g.f, n: +g.n || 0, t: g.t, test: g.test, t2: g.t2 || [], xa: g.xa || [], l: g.l || "", ...(g.pt != null ? { pt: g.pt } : {}), ...(g.d ? { d: g.d } : {}) }))));   // v31: the template remembers its groups
    if (lab) ids.forEach(id => { flushLedger(id); syncStock(id); });
    msg.textContent = "";
    const own = ids.every((id, i) => id === tags[i]);
    $("#rResult").innerHTML = `<div class="notice"><b>${n === 1 ? "Sample" : `${n} samples`} ${walk ? "registered" : "submitted"}: ${esc(batchName)}.</b>${ref ? ` Batch <b class="mono">${esc(ref)}</b>: processed as one, with one receipt, one workflow and one certificate when the lab's report is attached.` : ""} ${own ? "The codes on the bags are the sample IDs; print labels if you want them:" : "Each sample's ID is its code; a code already used for another analysis has -2 after it. Print the labels:"}
      <div class="label-strip" style="margin-top:8px">${ids.map((id, i) => `<code>${esc(id)}${id !== tags[i] ? ` · ${esc(tags[i])}` : ""}</code>`).join("")}</div>
      <div class="row" style="margin-top:10px"><button type="button" class="btn primary" id="rLabels">Print ${n === 1 ? "label" : n + " labels"}</button><button type="button" class="btn" id="rCopy">Copy IDs</button>${ref ? `<button type="button" class="btn" data-open="${esc(ref)}">Open the batch</button><button type="button" class="btn" data-link="${esc(ref)}">Copy batch link</button>` : `<button type="button" class="btn" data-open="${esc(ids[0])}">Track ${esc(ids[0])}</button>`}<button type="button" class="btn ghost" id="rAgain">${walk ? "Register more" : "Submit another"}</button></div></div>`;
    showResult();
    noteIssued(ids, ref, { ...base, type: batchName }, tags.map(t => [t]));
    const labels = ids.map((id, i) => labelOf({ ...base, id, type: per[i].t?.name || per[i].r.t, tags: [tags[i]] }));
    $("#rLabels").onclick = () => showLabels(labels);
    $("#rCopy").onclick = () => navigator.clipboard.writeText(ids.map((id, i) => id === tags[i] ? id : `${id}\t${tags[i]}`).join("\n")).then(() => toast("IDs copied"), () => toast("Copy blocked here. Select the IDs and copy them."));
    $("#rAgain").onclick = () => { $(walk ? "#view-register" : "#view-submit").innerHTML = ""; renderSampleForm(mode); };
    btn.disabled = true;
  } catch (e) {
    btn.disabled = false; msg.textContent = "";
    if (e && e.code === "tagused") toast(`Code ${e.tag} is already on open sample ${e.id} for the same analysis. Change it, or untick it.`);
    else if (e && e.code === "noroute") toast(`No workflow route performs ${testOf(e.test)?.name || e.test}. Ask the lab manager.`);
    else if (e && e.code === "busy") toast("Could not issue an ID. Try again in a moment.");
    else if (e && e.code === "taken") offerJobFree(e.took);
    else writeFailed(e);
  }
}
/* v31: codes from a first code that are taken: marked, with the groups' next free numbers a tap away. */
function offerJobFree(took){
  const on = new Set(took.map(([gi, j]) => gi + ":" + j));
  took.forEach(([gi]) => (job.open ||= new Map()).set(gi, true)); renderJob();
  document.querySelectorAll("#jRows .j-code").forEach(el => { const r = job.rows[+el.dataset.j]; el.classList.toggle("taken", !!r && on.has(r.grp + ":" + r.gj)); });
  toast(`${took[0][2]}${took.length > 1 ? ` and ${took.length - 1} more` : ""}: already used.`);
  const info = $("#jInfo"); if (!info) return;
  info.classList.remove("bad-t");
  info.innerHTML = `<span class="bad-t">${took.length} already used</span> <button type="button" class="btn small" id="jFree">Next free numbers</button>`;
  $("#jFree").onclick = async e => { e.target.disabled = true; e.target.textContent = "Checking…";
    const taken = async (c, gi) => { if (await tagOwner(c, job.g[gi]?.test)) return true; try { const d = await db.doc("samples/" + skey(c)).get(); return d.exists && !!d.data()?.id; } catch { return false; } };
    const fs = await nextFree(job.g, took.map(([gi, j]) => [gi, j]), job.date, taken); renderJobGroups(); jobRows(job.rows); renderJob(); toast(`Now from ${fs.join(", ")}`); };
}
/* On a single sample's form: choosing the sampling point fills in the analysis it usually gets, until the analysis is chosen by hand. */
document.addEventListener("change", e => {
  const el = e.target; if (!el.matches || !el.matches('#rDetails select[id^="rD_"]')) return;
  const ty = $("#rType")?.value, te = $("#rTest"); if (!ty || !te || te.dataset.touched || ptField(ty).k !== el.id.slice(3) || el.value === OTHER_V) return;
  const k = pointTest(ty, el.value); if (k && [...te.options].some(o => o.value === k)){ te.value = k; refreshFormRoute(); }
});
