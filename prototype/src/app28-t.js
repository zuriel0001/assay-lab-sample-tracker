
/* ---------- v24d: a shift's samples as one job (Submit › Shift job) ----------
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
/* The analysis a point usually gets (the shift reports); a point not listed takes its type's first. */
const POINT_TEST = {
  "CIL feed": "aufx_ausx", "Special CIL feed": "aufx_ausx", "CIL tails": "aufx_ausx", "COF (cyclone overflow)": "aufx_ausx", "CUF (cyclone underflow)": "aufx_ausx",
  "CIL tank": "aufx_ausx_cn", "CIL tails launder": "ausx", "Tails grab": "cn_only",
  "CCD overflow": "ausx_cn", "CCD feed": "aufx_ausx", "CCD underflow": "aufx_ausx", "CCD tails": "aufx_ausx",
  "TSF spigot": "cn_only", "Decant pond": "ausx_cn", "Return water": "ausx_cn", "Seepage / underdrain": "ausx_cn"
};
const JOB_TYPES = ["plant_feed", "ccd", "tsf", "carbon", "elution"];
const ptField = t => (typeOf(t)?.fields || [])[0] || { k: "point", l: "Sampling point", o: [] };
const pointTest = (t, pt) => { const k = POINT_TEST[pt]; return k && typeTests(typeOf(t)).includes(k) ? k : t === "carbon" ? "c_load" : t === "elution" ? "elu_sol" : typeOf(t)?.tests?.[0] || ""; };
/* Codes and descriptions: {S} NS/DS, {SN} Night shift / Day shift, {D} the date as yyyymmdd ({D-1} the day before), {#1} {#2} "#" and an
   elution number (blank: nothing). */
const R = (t, pt, test, code, desc, det) => ({ t, pt, test, code, desc, ...(det ? { det } : {}) });
const OFF = (r, ...shifts) => ({ ...r, off: shifts });   // listed, but not ticked at first on these shifts
const JOB_TPL = [
  { key: "mill", name: "Mill shift", shift: true, n: [["n1", "Stripped carbon: elution no."], ["n2", "Loaded carbon: elution no."]], rows: S => [
    ...ABCD.map((x, i) => R("ccd", "CCD overflow", "ausx_cn", `ML{S}REC${x}{D}`, `{SN} ${S.t[i]} CCD #1 overflow sample`)),
    ...ABCD.map((x, i) => R("plant_feed", "Tails grab", "cn_only", `ML{S}TLS${x}{D}`, `{SN} ${S.t[i]} tails grab sample`)),
    ...["A", "B"].map((x, i) => R("tsf", "TSF spigot", "cn_only", `TSF{S}PG${x}{D}`, `{SN} tails dam spigot sample ${x}${S.p ? ` ${S.p[i]}HRS` : ""}`)),
    OFF(R("carbon", "Eluted carbon", "c_load", "ML{S}CBST{D}{#1}", "Mill {sn} stripped carbon for the elution circuit{#1}"), "D"),
    OFF(R("carbon", "Regenerated carbon", "c_load", "ML{S}CBRG{D}", "Mill {sn} regen carbon from the elution circuit"), "N"),
    ...[6, 7, 8, 9, 10].map(i => R("carbon", "CIL tank carbon", "c_load", `ML{S}CL${String(i).padStart(2, "0")}{D}`, `Mill {sn} carbon from CIL tank ${i}`)),
    OFF(R("carbon", "Loaded carbon (to elution)", "c_load", "ML{S}CBLD{D}{#2}", "Mill {sn} loaded carbon for the elution circuit{#2}"), "D"),
    ...[1, 2, 3, 4, 5].map(i => R("carbon", "CIL tank carbon", "c_load", `ML{S}CL${String(i).padStart(2, "0")}{D}`, `Mill {sn} carbon from CIL tank ${i}`)),
    ...S.h.map(h => R("plant_feed", "CIL tails launder", "ausx", `ML{S}CT${h}{D}`, `Mill {sn} ${S.ct} ${h}00 hours special sample`)),
    R("tsf", "Decant pond", "ausx_cn", "ML{S}POND{D}", "Decant pond solution"),
    R("plant_feed", "CIL feed", "aufx_ausx", "ML{S}CLF1{D}", "Mill {sn} CIL feed 1"),
    R("plant_feed", "CIL feed", "aufx", "ML{S}CLF2{D}", "Mill {sn} CIL feed 2"),
    R("plant_feed", "CIL tails", "aufx_ausx", "ML{S}CLTL{D}", "Mill {sn} CIL tails"),
    R("plant_feed", "COF (cyclone overflow)", "aufx_ausx", "ML{S}COF {D}", "Mill {sn} cyclone overflow"),
    R("plant_feed", "CUF (cyclone underflow)", "aufx", "ML{S}CUF {D}", "Mill {sn} cyclone underflow"),
    R("ccd", "CCD tails", "aufx_ausx", "ML{S}TDDS{D}", "{SN} CCD tails sample"),
    R("plant_feed", "CIL tank", "aufx_ausx", "ML{S}TK11{D}", "{SN} tank 11 sample"),
    R("plant_feed", "Special CIL feed", "aufx_ausx", "ML{S}SPFD{D}", "Mill {sn} special CIL feed")
  ] },
  { key: "elution", name: "Elution run", shift: false, n: [["n1", "Strip no."]], rows: () => [
    ...Array.from({ length: 10 }, (_, i) => (i + 1) * 60).map(m => R("elution", "Electrowinning tails", "elu_sol", `MLSPE${String(m).padStart(3, "0")}{D}`, `Electrowinning tails solution ${m} mins`, { bv: `${m} min` })),
    ...Array.from({ length: 11 }, (_, i) => i * 60).map(m => R("elution", "Electrowinning head", "elu_sol", `MLSPH${String(m).padStart(3, "0")}{D}`, `Electrowinning head solution ${m} mins`, { bv: `${m} min` })),
    ...Array.from({ length: 12 }, (_, i) => (i + 1) * 30).map(m => R("elution", "Pregnant solution", "elu_sol", `MLSPP${String(m).padStart(3, "0")}{D}`, `Pregnant solution ${String(m).padStart(3, "0")} mins`, { bv: `${m} min` })),
    R("elution", "Lean eluate", "elu_sol", "MLSPLNAF{D}", "Lean eluate solution after strip"),
    R("elution", "Lean eluate", "elu_sol", "MLSPLNBF{D}", "Lean eluate solution before strip"),
    R("elution", "Treated water", "elu_sol", "MLSPTRTD{D}", "Mill special treated water")
  ] },
  { key: "cact", name: "Carbon activity", shift: true, n: [["n1", "Elution no."]], rows: () => [
    R("carbon", "Regenerated carbon", "c_act", "ML{S}CBRG{D}", "Mill {sn} regen carbon from the elution circuit"),
    R("carbon", "Eluted carbon", "c_act", "MLSCBST{D}{#1}", "Mill special stripped carbon for the elution circuit{#1}"),
    R("carbon", "Loaded carbon (to elution)", "c_act", "MLSCBLD{D-1}{#1}", "Mill special loaded carbon for the elution circuit{#1}"),   // sampled the day before its strip (the lab's report)
    { ...R("carbon", "Fresh carbon", "c_act", "", "Virgin carbon"), ph: "Type its code, e.g. the supplier's name" }
  ] }
];
const jobTpl = k => JOB_TPL.find(x => x.key === k) || JOB_TPL[0];
const dayCode = v => String(v || "").replace(/-/g, "");   // a date input's yyyy-mm-dd as yyyymmdd
let job = null;   // { tpl, shift, date, n: {n1, n2}, rows: [{ on, t, pt, test, code, desc, det, ec, ed }] } (ec / ed: code / description typed over)
function jobFill(x, ctx){
  const S = JOB_SHIFT[ctx.shift] || JOB_SHIFT.N, num = k => ctx.n[k] ? "#" + String(ctx.n[k]).replace(/^#/, "") : "";
  const t0 = Date.parse(String(ctx.date || "") + "T12:00:00Z"), before = isFinite(t0) ? dayCode(new Date(t0 - 86400e3).toISOString().slice(0, 10)) : "";
  return String(x).replace(/\{S\}/g, S.code).replace(/\{SN\}/g, S.name).replace(/\{sn\}/g, S.name.toLowerCase()).replace(/\{D-1\}/g, before).replace(/\{D\}/g, dayCode(ctx.date)).replace(/\{#1\}/g, num("n1")).replace(/\{#2\}/g, num("n2"));
}
/* The rows for the template, shift, date and numbers: generated codes and descriptions follow them, what was typed over stays. */
function jobRows(keep){
  const T = jobTpl(job.tpl), S = JOB_SHIFT[job.shift] || JOB_SHIFT.N, base = T.rows(S);
  const old = keep && keep.length === base.length ? keep : null;
  job.rows = [...base.map((r, i) => {
    const o = old && old[i];
    const on0 = !(r.off || []).includes(job.shift), fresh = r.ph && !o?.ec ? lsGet("jobFresh") || "" : "";
    return { on: o?.ut ? o.on : on0, ut: !!o?.ut, ph: r.ph || "", t: r.t, pt: r.pt, test: o?.test || r.test, code: o?.ec ? o.code : fresh || jobFill(r.code, job), desc: o?.ed ? o.desc : jobFill(r.desc, job), det: r.det || null, ec: !!o?.ec || !!fresh, ed: !!o?.ed, gen: [r.code, r.desc] }; }),
    ...(keep || []).filter(r => r.extra)];
}
function jobBlock(){
  return `<div class="sub-step s1 job-step" id="rJob" hidden><div class="sub-t"><span class="num">1</span>Shift samples</div>
    <div class="form">
      <label class="f"><span>Template</span><select id="jTpl">${JOB_TPL.map(x => `<option value="${x.key}">${esc(x.name)}</option>`).join("")}</select></label>
      <label class="f" id="jShiftBox"><span>Shift</span><select id="jShift"><option value="N">Night shift (NS)</option><option value="D">Day shift (DS)</option></select></label>
      <label class="f"><span>Date on the codes</span><input id="jDate" type="date"></label>
      <div class="f" id="jNums"></div>
    </div>
    <div class="tbl-wrap"><table class="jrows"><thead><tr><th><input type="checkbox" id="jAll" aria-label="Tick all" checked></th><th>Sample</th><th>Code</th><th>Description</th><th>Analysis</th></tr></thead><tbody id="jRows"></tbody></table></div>
    <div class="row" style="gap:8px"><select class="inp" id="jAdd" style="width:auto;max-width:100%" aria-label="Add a sample"><option value="">+ Add a sample…</option>${JOB_TYPES.map(t => `<optgroup label="${esc(typeOf(t)?.name || t)}">${(ptField(t).o || []).map(p => `<option value="${esc(t + "|" + p)}">${esc(p)}</option>`).join("")}</optgroup>`).join("")}</select>
      <span class="small" id="jInfo"></span></div>
  </div>`;
}
const jobTestOpts = (t, sel) => typeTests(typeOf(t)).filter(k => testOn(k) || k === sel).map(k => `<option value="${esc(k)}" ${k === sel ? "selected" : ""}>${esc(testOf(k)?.name || k)}</option>`).join("");
function renderJob(){
  const body = $("#jRows"); if (!body || !job) return;
  const T = jobTpl(job.tpl);
  $("#jShiftBox").hidden = !T.shift;
  const nb = $("#jNums"); if (nb && nb.dataset.tpl !== T.key){ nb.dataset.tpl = T.key; nb.innerHTML = `<div class="form">${T.n.map(([k, l]) => `<label class="f"><span>${esc(l)}</span><input id="jN_${k}" inputmode="numeric" maxlength="8" placeholder="e.g. 31" value="${esc(job.n[k] || "")}"></label>`).join("")}</div>`; }
  body.innerHTML = job.rows.map((r, i) => `<tr class="${r.on ? "" : "off"}"><td><input type="checkbox" data-jon="${i}" ${r.on ? "checked" : ""} aria-label="Include ${esc(r.code)}"></td>
    <td><span class="small muted">${esc(typeOf(r.t)?.name || r.t)}</span><div><b>${esc(r.pt)}</b></div></td>
    <td><input class="inp j-code" data-j="${i}" value="${esc(r.code)}" aria-label="Code, row ${i + 1}" placeholder="${esc(r.ph || "")}" autocomplete="off" spellcheck="false"></td>
    <td><input class="inp j-desc" data-j="${i}" value="${esc(r.desc)}" aria-label="Description, row ${i + 1}" autocomplete="off"></td>
    <td><select class="inp j-test" data-j="${i}" aria-label="Analysis, row ${i + 1}">${jobTestOpts(r.t, r.test)}</select></td></tr>`).join("");
  jobHints();
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
  const inCode = (r, k) => String(r.gen?.[0] || "").includes(`{#${k.slice(1)}}`);
  jobTpl(job.tpl).n.forEach(([k]) => { const el = $("#jN_" + k)?.closest("label"); if (el) el.hidden = job.rows.some(r => inCode(r, k)) && !on.some(r => inCode(r, k)); });
  submitLabel();
}
function bindJob(v){
  const tp = $("#jTpl", v); if (!tp) return;
  /* In the morning the night shift's samples come in (the shift began the day before); in the evening the day shift's. */
  const hr = +localInput(Date.now()).slice(11, 13), night = hr >= 6 && hr < 18, back = night || hr < 6 ? 1 : 0;
  job = { tpl: lsGet("jobTpl") || "mill", shift: night ? "N" : "D", date: localInput(Date.now() - back * 86400e3).slice(0, 10), n: {}, rows: [] };
  if (!JOB_TPL.some(x => x.key === job.tpl)) job.tpl = "mill";
  tp.value = job.tpl; $("#jShift", v).value = job.shift; $("#jDate", v).value = job.date;
  jobRows(); renderJob();
  const again = () => { jobRows(job.rows); renderJob(); };
  tp.onchange = () => { job.tpl = tp.value; lsSet("jobTpl", tp.value); job.n = {}; jobRows(); renderJob(); };
  $("#jShift", v).onchange = e => { job.shift = e.target.value; again(); };
  $("#jDate", v).onchange = e => { job.date = e.target.value; again(); };
  $("#jNums", v).addEventListener("input", e => { const m = e.target.id.match(/^jN_(n\d)$/); if (!m) return; job.n[m[1]] = e.target.value.trim(); job.rows.forEach(r => { if (!r.extra){ if (!r.ec) r.code = jobFill(r.gen[0], job); if (!r.ed) r.desc = jobFill(r.gen[1], job); } });
    document.querySelectorAll("#jRows .j-code").forEach(el => { el.value = job.rows[+el.dataset.j].code; }); document.querySelectorAll("#jRows .j-desc").forEach(el => { el.value = job.rows[+el.dataset.j].desc; }); jobHints(); });
  const rows = $("#jRows", v);
  rows.addEventListener("input", e => { const el = e.target, r = job.rows[+el.dataset.j]; if (!r) return;
    if (el.classList.contains("j-code")){ r.code = el.value; r.ec = true; } else if (el.classList.contains("j-desc")){ r.desc = el.value; r.ed = true; } jobHints(); });
  rows.addEventListener("change", e => { const el = e.target;
    if (el.dataset.jon != null){ Object.assign(job.rows[+el.dataset.jon], { on: el.checked, ut: true }); el.closest("tr").classList.toggle("off", !el.checked); jobHints(); }
    else if (el.classList.contains("j-test")) job.rows[+el.dataset.j].test = el.value; });
  $("#jAll", v).onchange = e => { job.rows.forEach(r => { r.on = e.target.checked; r.ut = true; }); renderJob(); };
  $("#jAdd", v).onchange = e => {
    const [t, pt] = e.target.value.split("|"); e.target.value = ""; if (!t) return;
    if (job.rows.length >= 100) return toast("Up to 100 samples in one job.");
    job.rows.push({ on: true, extra: true, t, pt, test: pointTest(t, pt), code: "", desc: "", det: null, ec: true, ed: true, gen: ["", ""] });
    renderJob(); $(`#jRows .j-code[data-j="${job.rows.length - 1}"]`)?.focus();
  };
}
/* The submission: one batch of the ticked rows, each sample on the job route with its own analysis (its own route's retention and limits). */
async function registerJob(){
  const mode = $("#regForm")?.dataset.mode || "register", walk = mode === "register", lab = !walk && canEdit() && !!$("#rRecvNow")?.checked;
  if (!db){ toast("The shared register is not connected in this view."); return; }
  const btn = $("#rSubmit"), msg = $("#rMsg");
  const fail = (m, focus) => { toast(m); const el = focus && $(focus); if (el){ const d = el.closest("details"); if (d) d.open = true; el.focus(); } };
  const rows = (job?.rows || []).filter(r => r.on), n = rows.length;
  if (!n) return fail("Tick at least one sample.", "#jAll");
  if (n > 100) return fail("Up to 100 samples in one job.");
  const blank = rows.findIndex(r => !r.code.trim()); if (blank >= 0) return fail("Every ticked sample needs its code.", `#jRows .j-code[data-j="${job.rows.indexOf(rows[blank])}"]`);
  const tags = rows.map(r => normTag(r.code)); if (new Set(tags.map(normKey)).size !== n) return fail("The same code appears twice in this job.", "#jRows .j-code.dup");
  const noTest = rows.find(r => !r.test); if (noTest) return fail(`Choose the analysis for ${noTest.code}.`);
  const code = val("#rSection"), puK = val("#rPurpose") || "plant", submitter = val("#rSubmitter");
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
    if (rows.some(r => twoPerson({ typeKey: r.t, section: code }))){ $("#rWitBox").hidden = false; if (!(wit = val("#rWit"))) return fail("Two-person custody: choose the witness.", "#rWit"); }
  }
  const JR = routeByCode("JOB"), T = jobTpl(job.tpl), S = JOB_SHIFT[job.shift] || JOB_SHIFT.N;
  const when = job.date ? fmtDate(fromInput(job.date + "T12:00")) : fmtDate(now);
  const batchName = `${T.name}${T.shift ? `, ${S.name.toLowerCase()}` : ""}, ${when}`;
  btn.disabled = true; msg.textContent = "Checking the codes…";
  try {
    const owners = new Array(n); await pool(tags.map((t, i) => [t, i]), 6, async ([t, i]) => { owners[i] = await tagOwner(t, rows[i].test); return true; });
    const used = owners.findIndex(Boolean); if (used >= 0) throw { code: "tagused", tag: tags[used], id: owners[used] };
    msg.textContent = "Issuing IDs…";
    const start = lab ? "received" : "submitted", priority = $("#rPriority").value, notes = val("#rNotes");
    const per = rows.map(r => {
      const t = typeOf(r.t), nat = routeFor(r.t, r.test, puK), route = JR || nat;
      if (!route) throw { code: "noroute", test: r.test };
      const rf = routeFields(route, r.test);
      if (JR) Object.assign(rf, { retention: clone(nat?.retention || rf.retention), triggers: clone(nat?.triggers || []), qcg: [], qcp: "", qc: "", baseRoute: nat?.code || "" });
      return { r, t, rf };
    });
    const startName = per[0].rf.plan.find(x => x.key === start)?.name || "Submitted";
    const recvOf = t => lab ? { bags: 1, mass: null, unit: "kg", seal: "none", cond: "Good", temp: "", holdH: null, warn: [], ...(wit && twoPerson({ typeKey: t, section: code }) ? { wit } : {}) } : null;
    const base = { v: 13, purpose: purposeOf(puK)?.name || puK, purposeKey: puK, submitter, ...(subBadge ? { subBadge } : {}), ...(handTo ? { handedTo: handTo } : {}), ...(handBadge ? { handedBadge: handBadge } : {}),
      section: code, receivedBy: lab ? session.name : "", receivedAt: recvAt, recvAt, reassays: 0, collectedAt: null, containers: 1, massKg: null, seal: "", priority, analyses: [], notes,
      createdAt: now, createdBy: lab ? session.u : "public", createdByName: lab ? session.name : submitter, updatedAt: now, stageKey: start, stageAt: lab ? recvAt : now, location: "", flag: "",
      open: true, onHand: lab, lab: true, ...(lab ? { sx: 1 } : {}), ...(walk ? { via: "walkin" } : {}), batchKey: `${code}-${now.toString(36)}-${tabId.slice(0, 4)}`, batchSize: n, batchName, job: T.key };
    const make = (id, i, batchId) => {
      const { r, t, rf } = per[i], recv = recvOf(r.t), w = recv?.wit || "";
      const details = { [ptField(r.t).l]: r.pt, ...(T.shift && (t?.fields || []).some(f => f.k === "shift") ? { Shift: S.name.replace(/ shift$/, "") } : {}), ...(r.det?.bv ? { "Time or bed volume": r.det.bv } : {}), ...(r.t === "elution" && job.n.n1 ? { "Elution batch / strip no.": job.n.n1 } : {}) };
      const body = { ...base, ...rf, id, type: t?.name || r.t, typeKey: r.t, details, hazards: [...(t?.haz || [])], recv, batchIndex: i + 1, ...(batchId && n > 1 ? { batchId } : {}),
        tags: [tags[i]], tagNo: tags[i], source: r.desc.trim().slice(0, 120), siteRef: "", siteRefU: "",
        history: [lab ? { key: start, sn: startName, at: recvAt, by: session.u, tech: session.name, note: `Received and registered at the lab with ${batchName}`, ref: "", ...(w ? { wit: w } : {}) }
                      : { key: start, sn: startName, at: now, by: "public", name: submitter, note: `Submitted with ${batchName}${walk ? " (walk-in)" : ""}`, ref: "", ...(handTo ? { hand: handTo } : {}), ...(handBadge ? { badge: handBadge } : {}) }] };
      if (n === 1){ delete body.batchKey; body.batchSize = 1; }
      if (lab){ body.inMid = `${id}~in`; body.ledgerPending = [inMove(body, recvAt, recv, "Registered at the lab", w)]; body.lp = true; }
      return body;
    };
    const stamp = dayStamp(lab ? recvAt : now);
    const [first] = await claimIds(code, stamp, 1, id => make(id, 0, n > 1 ? "B-" + id : ""));
    const ref = n > 1 ? "B-" + first : "";
    msg.textContent = n > 1 ? `Saved 1 of ${n}…` : "";
    const ids = n > 1 ? [first, ...await claimIds(code, stamp, n - 1, (id, i) => make(id, i + 1, ref), d => msg.textContent = `Saved ${d + 1} of ${n}…`, +first.split("-").pop() + 1)] : [first];
    ids.forEach((id, i) => db.doc("tagidx/" + tagKey(tags[i])).set({ sid: id, tag: tags[i], at: now }).catch(() => {}));
    const fr = rows.find(r => r.ph && r.code.trim()); if (fr) lsSet("jobFresh", fr.code.trim().slice(0, 40));
    if (lab) ids.forEach(id => { flushLedger(id); syncStock(id); });
    msg.textContent = "";
    $("#rResult").innerHTML = `<div class="notice"><b>${n === 1 ? "Sample" : `${n} samples`} ${walk ? "registered" : "submitted"}: ${esc(batchName)}.</b>${ref ? ` Batch <b class="mono">${esc(ref)}</b>: processed as one, with one receipt, one workflow and one certificate when the lab's report is attached.` : ""} Write the IDs on the bags, or print the labels:
      <div class="label-strip" style="margin-top:8px">${ids.map((id, i) => `<code>${esc(id)} · ${esc(tags[i])}</code>`).join("")}</div>
      <div class="row" style="margin-top:10px"><button type="button" class="btn primary" id="rLabels">Print ${n === 1 ? "label" : n + " labels"}</button><button type="button" class="btn" id="rCopy">Copy IDs</button>${ref ? `<button type="button" class="btn" data-open="${esc(ref)}">Open the batch</button><button type="button" class="btn" data-link="${esc(ref)}">Copy batch link</button>` : `<button type="button" class="btn" data-open="${esc(ids[0])}">Track ${esc(ids[0])}</button>`}<button type="button" class="btn ghost" id="rAgain">${walk ? "Register more" : "Submit another"}</button></div></div>`;
    noteIssued(ids, ref, { ...base, type: batchName }, tags.map(t => [t]));
    const labels = ids.map((id, i) => labelOf({ ...base, id, type: per[i].t?.name || per[i].r.t, tags: [tags[i]] }));
    $("#rLabels").onclick = () => showLabels(labels);
    $("#rCopy").onclick = () => navigator.clipboard.writeText(ids.map((id, i) => `${id}\t${tags[i]}`).join("\n")).then(() => toast("IDs copied"), () => toast("Copy blocked here. Select the IDs and copy them."));
    $("#rAgain").onclick = () => { $(walk ? "#view-register" : "#view-submit").innerHTML = ""; renderSampleForm(mode); };
    btn.disabled = true;
  } catch (e) {
    btn.disabled = false; msg.textContent = "";
    if (e && e.code === "tagused") toast(`Code ${e.tag} is already on open sample ${e.id} for the same analysis. Change it, or untick it.`);
    else if (e && e.code === "noroute") toast(`No workflow route performs ${testOf(e.test)?.name || e.test}. Ask the lab manager.`);
    else if (e && e.code === "busy") toast("Could not issue an ID. Try again in a moment.");
    else writeFailed(e);
  }
}
/* On a single sample's form: choosing the sampling point fills in the analysis it usually gets, until the analysis is chosen by hand. */
document.addEventListener("change", e => {
  const el = e.target; if (!el.matches || !el.matches('#rDetails select[id^="rD_"]')) return;
  const ty = $("#rType")?.value, te = $("#rTest"); if (!ty || !te || te.dataset.touched || ptField(ty).k !== el.id.slice(3)) return;
  const k = pointTest(ty, el.value); if (k && [...te.options].some(o => o.value === k)){ te.value = k; refreshFormRoute(); }
});
