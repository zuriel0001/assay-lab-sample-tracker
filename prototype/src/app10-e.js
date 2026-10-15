/* ---------- workflow routes (read-only for everyone) ---------- */
let routesFocus = "", routesType = "", routesQ = "";
const openRoutes = new Set();
document.addEventListener("click", e => { const b = e.target.closest("[data-route]"); if (b){ routesFocus = b.dataset.route; setTab("routes"); } });
let routeEditGo = "";
document.addEventListener("click", e => { const b = e.target.closest("[data-edit-route]"); if (b){ routeEditGo = b.dataset.editRoute; setTab("stages"); } });
function renderRoutes(){
  const v = $("#view-routes");
  if (routesFocus){ openRoutes.add(routesFocus); routesType = ""; routesQ = ""; }
  v.innerHTML = `<div class="stack">
    <div class="panel stack" style="gap:8px">
      <h2>Workflow routes</h2>
      <p class="small muted" style="margin:0">Each sample follows the route for its sample type and the test requested. The route is picked automatically at submission and the lab technician confirms or changes it at receipt; only routes that perform the requested test can be chosen. Every route starts with <b>Submitted</b> and <b>Received &amp; logged</b>, and ends with <b>Results released</b> and retention in storage. Each retained material is then returned, sent out or disposed on its own date. Expected finish times add up the hours below and are estimates: queues can add to them.${isAdmin() ? " Admins edit routes on the Settings tab." : ""}</p>
      <div class="row" style="gap:6px"><span class="ph-tag ph-intake">Intake</span><span class="ph-tag ph-prep">Preparation</span><span class="ph-tag ph-test">Analysis / test</span><span class="ph-tag ph-qc">QA/QC</span></div>
    </div>
    <div class="panel stack" style="gap:10px"><h3>All ${TESTS.length} tests</h3>
      ${TEST_CATS.map(c => `<div class="cat-row"><div class="cat-name">${esc(c)}</div><div class="cat-tests">${TESTS.filter(t => t.cat === c).map(t => { const r = routeFor("", t.key, ""); return r ? `<button type="button" class="tchip" data-route="${esc(r.code)}">${esc(t.name)}</button>` : ""; }).join("")}</div></div>`).join("")}
    </div>
    <div class="row">
      <select class="inp" id="rtType" style="width:auto;max-width:100%"><option value="">All sample types</option>${TYPES.map(t => `<option value="${esc(t.key)}" ${routesType === t.key ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</select>
      <input class="inp" id="rtQ" placeholder="Search route, test or step" style="flex:1 1 200px;width:auto" value="${esc(routesQ)}">
      <button class="btn ghost" id="rtAll" type="button">Expand all</button>
    </div>
    <div class="stack" id="rtList" style="gap:8px"></div></div>`;
  $("#rtType").onchange = e => { routesType = e.target.value; renderRouteList(); };
  $("#rtQ").oninput = e => { routesQ = e.target.value; clearTimeout(renderRoutes.t); renderRoutes.t = setTimeout(renderRouteList, 200); };
  $("#rtAll").onclick = () => { const ds = [...v.querySelectorAll("details.route")], openAll = ds.some(d => !d.open); ds.forEach(d => d.open = openAll); };
  renderRouteList();
  if (routesFocus){ document.getElementById("route-" + routesFocus)?.scrollIntoView({ block: "start" }); routesFocus = ""; }
}
function routeResultsLine(r){
  const res = RESULTS[(r.tests || [])[0]], gs = Array.isArray(r.qcg) ? r.qcg : routeGroups(r), calc = res ? res.an.filter(a => a.calc) : [];
  const lims = (cfg.limits || []).filter(l => l.route === r.code), anN = k => (res?.an.find(a => a.k === k) || { n: k }).n, anU = k => res?.an.find(a => a.k === k)?.u || "";
  return `<div class="small"><b>Results reported:</b> ${res ? esc(res.an.filter(a => !a.opt).map(a => a.n + (a.u ? ` (${a.u})` : "")).join(", ")) : "—"}${res && res.an.some(a => a.opt) ? `; optional: ${esc(res.an.filter(a => a.opt).map(a => a.n).join(", "))}` : ""}<br>
    ${calc.length ? `<b>Calculated, not typed:</b> ${esc(calc.map(a => `${a.n} from ${listAnd((a.from || []).map(anN).map(lcName))}`).join("; "))}<br>` : ""}
    <b>Lab batch${gs.length > 1 ? "es" : ""}:</b> ${gs.length ? `${gs.map(g => { const qp = QC_PROFILES[g.p]; return qp ? `${esc(qp.name)} for ${esc(listAnd(groupAns(g, res).map(a => /^[A-Z][a-z]?$/.test(a.k) ? a.k : lcName(a.n))))} (up to ${qp.size} ${esc(qp.item || "sample")}s)` : ""; }).filter(Boolean).join("; ")}. Standards, blanks and duplicates are placed automatically and every result a batch checks must pass before release${res && res.an.some(a => !a.calc && !a.t && !gs.some(g => g.k.includes(a.k))) ? `. ${esc(listAnd(res.an.filter(a => !a.calc && !a.t && !gs.some(g => g.k.includes(a.k))).map((a, i) => i ? lcName(a.n) : a.n)))}: measured outside a lab batch, and shown as such on the certificate` : ""}` : "none; the checks run on each sample's own results"}
    ${lims.length ? `<br><b>Action limits:</b> ${esc(lims.map(l => `${anN(l.k)} ${l.op === "<" ? "below" : "above"} ${fmtNum(l.val)}${anU(l.k) ? " " + anU(l.k) : ""}${l.when ? ` (${l.when})` : ""}${l.permit ? " (permit)" : ""}: ${l.act}`).join("; "))}` : ""}</div>`;
}
function routeRows(r){
  const rows = [
    { name: HEAD[0].name, phase: "await", hours: transitOf(r), note: "Submitted online; time allowed for the sample to reach the lab." },
    { name: HEAD[1].name, phase: "intake", hours: HEAD[1].hours, note: "Bag, seal, mass and condition checked against the submission by a lab technician; written to the inbound ledger." },
    ...r.stages,
    { name: "Results released", phase: "report", hours: 24, note: "Released by a lab supervisor once QA/QC passes; material put into storage within 24 h." },
    { name: "Retained in storage", phase: "store", hours: Math.max(1, keepDays(r)) * 24, note: "Each material on its own clock, then returned, sent to an external lab or disposed (outbound ledger)." }
  ];
  return rows.map((x, i) => `<tr><td class="mono">${i + 1}</td><td>${esc(x.name)}</td><td><span class="ph-tag ph-${esc(x.phase)}">${esc(PHASE_LABEL[x.phase] || x.phase)}</span></td><td style="white-space:nowrap">${hoursLabel(x.hours)}</td>
    <td class="note">${esc(x.note || "")}${x.redo ? `${x.note ? " " : ""}<b style="color:var(--warn)">Re-assays restart here.</b>` : ""}</td></tr>`).join("");
}
function renderRouteList(){
  const box = $("#rtList"); if (!box) return;
  const q = routesQ.trim().toLowerCase(), t = typeOf(routesType);
  const list = (cfg.routes || []).filter(r => (!t || (r.types || []).includes(t.key) || (t.tests || []).some(k => (r.tests || []).includes(k)))
    && (!q || [r.code, r.name, r.desc, ...(r.stages || []).map(x => x.name), ...(r.tests || []).map(k => testOf(k)?.name)].join(" ").toLowerCase().includes(q)));
  list.sort((a, b) => testRank(a) - testRank(b));
  let lastCat = "";
  box.innerHTML = list.length ? list.map(r => {
    const cat = routeCat(r), headHtml = cat !== lastCat ? `<h3 style="margin-top:${lastCat ? 10 : 0}px">${esc(cat)}</h3>` : "";
    lastCat = cat;
    const types = (r.types || []).filter(k => k !== "*").map(k => typeOf(k)?.name).filter(Boolean);
    const purp = (r.purposes || []).map(k => purposeOf(k)?.name).filter(Boolean);
    return `${headHtml}<details class="route" id="route-${esc(r.code)}" data-code="${esc(r.code)}" ${openRoutes.has(r.code) ? "open" : ""}>
      <summary><span class="code">${esc(r.code)}</span><b>${esc(r.name)}</b><span class="subtle" style="margin-left:auto">results about ${hoursLabel(routeTat(r))} after receipt</span></summary>
      <div class="body">
        ${r.desc ? `<p class="small" style="margin:0">${esc(r.desc)}</p>` : ""}
        ${r.two ? `<div class="small"><span class="pill warn">Two-person custody</span> A witness is recorded at receipt and at every step.</div>` : ""}
        <div class="small"><b>Test:</b> ${(r.tests || []).map(k => esc(testOf(k)?.name || k)).join(", ")}<br>
          <b>Sample types:</b> ${types.length ? esc(types.join(", ")) : ""}${(r.types || []).includes("*") ? (types.length ? ", and any other type" : "Any type") : ""}${purp.length ? `<br><b>Chosen first when the purpose is:</b> ${esc(purp.join(", "))}` : ""}</div>
        ${routeResultsLine(r)}
        <div class="tbl-wrap"><table><thead><tr><th>#</th><th>Step</th><th>Phase</th><th>Time allowed</th><th>Method and checks</th></tr></thead><tbody>${routeRows(r)}</tbody></table></div>
        ${isAdmin() ? `<div class="row"><button class="btn" type="button" data-edit-route="${esc(r.code)}">Edit steps and hours</button></div>` : ""}
        ${r.qc ? `<div class="small"><b>QA/QC:</b> ${esc(r.qc)}</div>` : ""}
        ${(r.triggers || []).length ? `<div class="small"><b>Re-assay triggers</b><ul class="tight">${r.triggers.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
        ${(r.retention || []).length ? `<div class="small"><b>Retention and disposal</b><ul class="tight">${r.retention.map(x => `<li>${esc(retentionLine(x))}</li>`).join("")}</ul></div>` : ""}
      </div></details>`;
  }).join("") : `<div class="panel empty"><strong>No routes match</strong>Clear the search or choose All sample types.</div>`;
  box.querySelectorAll("details.route").forEach(d => d.addEventListener("toggle", () => { d.open ? openRoutes.add(d.dataset.code) : openRoutes.delete(d.dataset.code); }));
}

/* ---------- settings (admin) ---------- */
let draft = null, draftDirty = false, routeIdx = 0;
const newKey = () => "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
function renderStages(){
  const v = $("#view-stages");
  // Commit a pending edit first: blurring fires its change handler, which re-renders with the new value.
  if (v.contains(document.activeElement)) document.activeElement.blur();
  if (!v.dataset.bound){ v.dataset.bound = "1"; v.addEventListener("input", () => { if (draft) draftDirty = true; }); }
  if (!draft) { crmKeys(cfg.crms); draft = clone(cfg); draftDirty = false; }
  draft.tz = draft.tz || DEFAULT_CONFIG.tz;
  draft.crms = Array.isArray(draft.crms) ? draft.crms : clone(DEFAULT_CONFIG.crms);
  draft.resultsPublic = !!draft.resultsPublic;
  draft.limits = Array.isArray(draft.limits) ? draft.limits : clone(DEFAULT_CONFIG.limits);
  draft.users = draft.users || [];
  draft.routes = draft.routes && draft.routes.length ? draft.routes : clone(DEFAULT_ROUTES);
  const editable = isAdmin();
  if (!editable){ v.innerHTML = `<div class="notice warn">Only admins can change these settings.</div>`; return; }
  const userRows = draft.users.map((x, i) => `<tr>
    <td><input class="inp mono" style="width:130px" data-ui="${i}" data-uf="u" value="${esc(x.u)}" aria-label="Username"></td>
    <td><input class="inp" data-ui="${i}" data-uf="name" value="${esc(x.name)}" aria-label="Full name"></td>
    <td><select class="inp" style="width:auto" data-ui="${i}" data-uf="role" aria-label="Role">${Object.entries(ROLES).map(([k, l]) => `<option value="${k}" ${x.role === k ? "selected" : ""}>${l}</option>`).join("")}</select></td>
    <td>${x.role === "section" ? `<select class="inp" style="width:auto" data-ui="${i}" data-uf="sec" aria-label="Section">${draft.sections.map(c => `<option value="${esc(c.code)}" ${x.sec === c.code ? "selected" : ""}>${esc(c.code)}</option>`).join("")}${draft.sections.some(c => c.code === x.sec) ? "" : `<option selected value="${esc(x.sec || "")}">${esc(x.sec || "—")}</option>`}</select>` : `<span class="muted">—</span>`}</td>
    <td><input class="inp mono" style="width:130px" data-ui="${i}" data-uf="pw" value="${esc(x.pw)}" aria-label="Password"></td>
    <td><button class="btn ghost danger" data-urm="${i}" aria-label="Remove account" ${x.u === session?.u ? "disabled title='You cannot remove your own account'" : ""}>✕</button></td></tr>`).join("");
  watchStore();
  const secCount = code => openOn(x => x.section === code);
  const secRows = draft.sections.map((x, i) => `<tr>
    <td><input class="inp mono" style="width:90px;text-transform:uppercase" maxlength="5" data-si="${i}" data-sf="code" value="${esc(x.code)}"></td>
    <td><input class="inp" data-si="${i}" data-sf="name" value="${esc(x.name)}"></td>
    <td class="mono">${secCount(x.code)}</td>
    <td><button class="btn ghost danger" data-srm="${i}" aria-label="Remove section">✕</button></td></tr>`).join("");
  const goEdit = routeEditGo; routeEditGo = "";
  if (goEdit){ const j = draft.routes.findIndex(r => r.code === goEdit); if (j >= 0) routeIdx = j; cfgTab = "routes"; }
  if (routeIdx >= draft.routes.length) routeIdx = 0;
  const R = draft.routes[routeIdx];
  R.stages = R.stages || []; R.tests = R.tests || []; R.types = R.types || []; R.purposes = R.purposes || []; R.triggers = R.triggers || []; R.retention = R.retention || [];
  const inUse = openOn(s => s.route === R.code);
  const checks = (group, items, have) => items.map(([k, l]) => `<label><input type="checkbox" data-rl="${group}" value="${esc(k)}" ${have.includes(k) ? "checked" : ""}> ${esc(l)}</label>`).join("");
  const stRows = R.stages.map((x, i) => `<tr>
    <td class="mono">${i + 3}</td>
    <td><input class="inp" style="min-width:200px" data-ri="${i}" data-rk="name" value="${esc(x.name)}" aria-label="Step name"></td>
    <td><input class="inp" style="width:90px" type="number" min="0" step="0.25" data-ri="${i}" data-rk="hours" value="${esc(x.hours)}" aria-label="Hours allowed"></td>
    <td style="text-align:center"><input type="checkbox" data-ri="${i}" data-rk="clock" ${x.clock ? "checked" : ""} aria-label="Round the clock"></td>
    <td><select class="inp" style="width:auto" data-ri="${i}" data-rk="phase" aria-label="Phase">${["intake", "prep", "test", "qc"].map(p => `<option value="${p}" ${x.phase === p ? "selected" : ""}>${PHASE_LABEL[p]}</option>`).join("")}</select></td>
    <td style="text-align:center"><input type="radio" name="redo" data-ri="${i}" data-rk="redo" ${x.redo ? "checked" : ""} aria-label="Re-assays restart here"></td>
    <td><input class="inp" style="min-width:240px" data-ri="${i}" data-rk="note" value="${esc(x.note || "")}" aria-label="Method and checks"></td>
    <td style="white-space:nowrap"><button class="btn ghost" data-rmv="${i}" data-d="-1" aria-label="Move up" ${i ? "" : "disabled"}>↑</button><button class="btn ghost" data-rmv="${i}" data-d="1" aria-label="Move down" ${i < R.stages.length - 1 ? "" : "disabled"}>↓</button><button class="btn ghost danger" data-rrm="${i}" aria-label="Remove step">✕</button></td></tr>`).join("");
  const savedCrm = new Set((cfg.crms || []).map(c => c.id)), anOpts = crmAnalytes();
  const crmRows = draft.crms.map((c, i) => `<tr>
    <td><input class="inp mono" style="width:130px;text-transform:uppercase" data-ci="${i}" data-cf="id" value="${esc(c.id)}" aria-label="CRM ID">${(c.was || []).length ? `<div class="small muted">was ${esc(c.was.join(", "))}</div>` : ""}</td>
    <td><input class="inp" style="min-width:180px" data-ci="${i}" data-cf="name" value="${esc(c.name)}" aria-label="Description"></td>
    <td><select class="inp" style="width:auto" data-ci="${i}" data-cf="an" aria-label="Analyte and unit">${[...anOpts].map(([k, l]) => `<option value="${esc(k)}" ${k === `${c.an}|${c.u || ""}` ? "selected" : ""}>${esc(l)}</option>`).join("")}${anOpts.has(`${c.an}|${c.u || ""}`) ? "" : `<option selected value="${esc(`${c.an}|${c.u || ""}`)}">${esc(c.an)} ${esc(c.u || "")}</option>`}</select></td>
    <td><input class="inp mono" style="width:100px" type="number" min="0" step="any" data-ci="${i}" data-cf="val" value="${esc(c.val)}" aria-label="Certified value"></td>
    <td><input class="inp mono" style="width:90px" type="number" min="0" step="any" data-ci="${i}" data-cf="sd" value="${esc(c.sd)}" aria-label="Standard deviation"></td>
    <td><input class="inp mono" style="width:130px;text-transform:uppercase" data-ci="${i}" data-cf="use" value="${esc(c.use || "")}" aria-label="Batch types" placeholder="all"></td>
    <td><button class="btn ghost danger" data-crm-rm="${i}" aria-label="Remove reference material">✕</button></td></tr>`).join("");
  const keepRows = R.retention.map((x, i) => `<tr>
    <td><input class="inp" data-ti="${i}" data-tf="item" value="${esc(x.item)}" aria-label="Material"></td>
    <td><input class="inp" style="width:100px" type="number" min="0" step="1" data-ti="${i}" data-tf="days" value="${esc(x.days)}" aria-label="Days kept"><div class="small muted">${+x.days ? daysLabel(x.days) : "returned at release"}</div></td>
    <td><input class="inp" data-ti="${i}" data-tf="then" value="${esc(x.then)}" aria-label="Then"></td>
    <td><button class="btn ghost danger" data-trm="${i}" aria-label="Remove">✕</button></td></tr>`).join("");
  draft.cols = draft.cols || [];
  const asList = readAsList();
  const colRows = draft.cols.map((x, i) => `<tr><td><input class="inp mono" data-ki="${i}" data-kf="n" value="${esc(x.n)}" aria-label="Column name" placeholder="e.g. AuCN"></td>
    <td><select class="inp" data-ki="${i}" data-kf="c" aria-label="Read as"><option value="">Not read</option>${asList.map(([c, l]) => `<option value="${esc(c)}" ${c === x.c ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></td>
    <td><button class="btn ghost danger" data-krm="${i}" aria-label="Remove">✕</button></td></tr>`).join("") || `<tr><td colspan="3" class="small muted">None added</td></tr>`;
  v.innerHTML = `<div class="stack">
    <div class="notice">Edit accounts, sections, the site time zone and workflow routes, then press Save settings. Changes apply for everyone.</div>

    <h2>Staff accounts</h2>
    <p class="small muted" style="margin:0">Anyone can register a sample at the lab without an account. Lab technicians confirm receipt, register walk-in samples and record stages; their name is filled in automatically as "Received by" and on every stage update. Lab supervisors also release results, approve skipped steps and reverse ledger movements recorded by mistake. Viewers can see the board and ledger but change nothing. A section account sees only the released results of its own section's samples, with a notice when new ones are ready. Anyone can look up a sample by ID without an account.</p>
    <div class="mock"><b>Design prototype.</b><span>Passwords here are visible to anyone who opens the page. The real system should store hashed passwords on a server or use the company's existing staff sign-in.</span></div>
    <div class="tbl-wrap"><table><thead><tr><th>Username</th><th>Full name</th><th>Role</th><th>Section</th><th>Password</th><th></th></tr></thead><tbody>${userRows}</tbody></table></div>
    <div class="row"><button class="btn" id="userAdd">Add account</button></div>

    <h2 style="margin-top:12px">Submitting sections</h2>
    <p class="small muted" style="margin:0">Sample IDs are the section code, the submission date and a running number, for example <span class="mono">${esc(exampleId((draft.sections[1] || draft.sections[0] || {code:"EXP"}).code))}</span>. Each section's number restarts at 0001 every day. Codes are 2 to 5 capital letters; changing a code only affects new samples.</p>
    <div class="tbl-wrap"><table><thead><tr><th>Code</th><th>Section name</th><th>Open samples</th><th></th></tr></thead><tbody>${secRows}</tbody></table></div>
    <div class="row"><button class="btn" id="secAdd">Add section</button></div>

    <h2 style="margin-top:12px">Site time</h2>
    <p class="small muted" style="margin:0">Sample ID dates, ledger months and every time on screen use the site's time zone, whatever each phone or PC is set to. Use a name from the IANA list, such as Africa/Accra or Africa/Johannesburg.</p>
    <div class="row"><input class="inp mono" id="cfgTz" style="width:260px" value="${esc(draft.tz)}" aria-label="Site time zone"><span class="small muted">Now at site: ${esc(fmtFull(Date.now()))}</span></div>
    ${workHtml()}
    ${logoHtml()}

    <h2 style="margin-top:12px">Results and certificates</h2>
    <p class="small muted" style="margin:0">A lab supervisor releases results with a numbered certificate of analysis. Corrections issue an amended certificate; earlier versions stay on record.</p>
    <label class="f" style="max-width:520px"><span>Who can see results on a sample record</span><select class="inp" id="cfgResPub"><option value="0" ${draft.resultsPublic ? "" : "selected"}>Signed-in staff only (recommended)</option><option value="1" ${draft.resultsPublic ? "selected" : ""}>Anyone with the sample ID or tag</option></select></label>

    <h2 style="margin-top:12px">Reference materials (CRMs and check standards)</h2>
    <div class="mock"><b>Example values.</b><span>The certified values and standard deviations below are placeholders for the prototype. Replace them with the values on your own CRM certificates before relying on the QC checks.</span></div>
    <p class="small muted" style="margin:0">A material certified for several results has one row per result under the same ID (type an existing ID in a new row). Lab batches pick reference materials for their analyte and unit, preferring those whose batch types list the batch's prefix (FA fire assay, GC grade control, FG gravimetric, SF screen fire assay, PL plant, PT tails, CC concentrate, BU bullion, SL solutions, EL eluate, CB carbon, CY and CS cyanide, EW water, IC ICP, ME multi-element, LE LECO, AR aqua regia, LW cyanide-soluble gold, SO soil, AB ARD, DN density). Leave batch types empty to allow any. A standard deviation is needed wherever the rule is in SD.</p>
    <div class="tbl-wrap"><table><thead><tr><th>ID</th><th>Description</th><th>Analyte</th><th>Certified value</th><th>SD</th><th>Batch types</th><th></th></tr></thead><tbody>${crmRows}</tbody></table></div>
    <div class="row"><button class="btn" id="crmAdd">Add reference material</button></div>
    ${crmLogHtml()}

    <h2 style="margin-top:12px">Action and permit limits</h2>
    <div class="mock"><b>Example values.</b><span>The permit and guideline limits (marked Permit) are placeholders. Replace them with the limits in the site's environmental permit before go-live.</span></div>
    <p class="small muted" style="margin:0">A result past a limit raises an alert on the sample and on the board. The release waits until someone records what was done and who was told; the record is printed on the certificate. "Only when" limits a row to one sampling point.</p>
    <div class="tbl-wrap"><table><thead><tr><th>Route</th><th>Result</th><th></th><th>Limit</th><th>Only when</th><th>Permit</th><th>Action</th><th></th></tr></thead><tbody>${limitRows()}</tbody></table></div>
    <div class="row"><button class="btn" id="limAdd">Add limit</button></div>

    <h2 style="margin-top:12px">Results files</h2>
    <div class="tbl-wrap"><table><thead><tr><th>Column name in the report</th><th>Read as</th><th></th></tr></thead><tbody>${colRows}</tbody></table></div>
    <div class="row"><button class="btn" id="colAdd">Add column name</button></div>
    <div class="small muted">Built in: element symbols (Au, Ag, Cu…), symbols with a method code (AuFA, AuSX, AgSX), pH, NaCN (free cyanide), CNWAD, CNTOT, NaOH, %Solids, Moisture. Samples are found by tracker ID, tag number or site reference.</div>

    <h2 style="margin-top:12px" id="rtEdit">Workflow routes</h2>
    <p class="small muted" style="margin:0">A sample's route is chosen from its sample type, test and purpose when it is submitted. Changes apply to samples submitted after you save; samples already in the lab keep the steps they started with. Steps 1 and 2 (Submitted, Received &amp; logged) and the closing steps (Results released, storage, return or disposal) are shared by every route.</p>
    <div class="row"><select class="inp" id="rtPick" style="width:auto;max-width:100%" aria-label="Route to edit">${draft.routes.map((r, i) => `<option value="${i}" ${i === routeIdx ? "selected" : ""}>${esc(r.code)} · ${esc(r.name)}</option>`).join("")}</select>
      <button class="btn" id="rtCopy">Copy as new route</button><button class="btn ghost danger" id="rtDel">Remove route</button></div>
    <div class="panel stack">
      <div class="form">
        <label class="f">Route code<input class="mono" style="text-transform:uppercase" maxlength="10" data-rf="code" value="${esc(R.code)}" ${inUse ? "disabled" : ""}>${inUse ? `<span class="small muted" style="font-weight:400">Locked while ${inUse} open sample(s) use it</span>` : ""}</label>
        <label class="f">Route name<input data-rf="name" value="${esc(R.name)}"></label>
        <label class="f full">Description<input data-rf="desc" value="${esc(R.desc || "")}"></label>
        <label class="f">Transit allowance (hours from submission to receipt)<input type="number" min="0" step="0.5" data-rf="transit" value="${esc(transitOf(R))}"></label>
        <label class="f" style="flex-direction:row;align-items:center;gap:8px;padding-top:22px"><input type="checkbox" data-rf="two" ${R.two ? "checked" : ""}> Two-person custody (a witness at every step)</label>
      </div>
      ${inUse ? `<p class="small muted" style="margin:0">${inUse} open sample(s) are on this route. They keep the steps, QA/QC rule and retention they started with.</p>` : ""}
      <fieldset><div class="legend">Tests this route performs</div><div class="checks">${checks("tests", TESTS.map(t => [t.key, t.name]), R.tests)}</div></fieldset>
      <fieldset><div class="legend">Sample types it is meant for</div><div class="checks">${checks("types", [["*", "Any type"], ...TYPES.map(t => [t.key, t.name])], R.types)}</div></fieldset>
      <fieldset><div class="legend">Purposes it is chosen first for</div><div class="checks">${checks("purposes", PURPOSES.map(p => [p.key, p.name]), R.purposes)}</div></fieldset>
      <div class="tbl-wrap"><table><thead><tr><th>#</th><th>Lab step</th><th>Hours</th><th>Round the clock</th><th>Phase</th><th>Re-assay restarts here</th><th>Method and checks</th><th></th></tr></thead><tbody>${stRows}</tbody></table></div>
      <div class="row"><button class="btn" id="rsAdd">Add step</button><span class="small muted">Results about <b>${hoursLabel(routeTat(R))}</b> after receipt.</span></div>
      <label class="f" style="max-width:520px"><span>Lab batch and QC</span><select class="inp" id="rtQcp"><option value="">None: checks run on each sample's own results</option>${Object.entries(QC_PROFILES).map(([k, p]) => `<option value="${k}" ${R.qcp === k ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>
      ${(R.qcg || []).length > 1 ? `<p class="small muted" style="margin:0">Samples on this route join ${esc(listAnd(R.qcg.map(g => `${aAn(lcName(QC_PROFILES[g.p]?.name || g.p))} for ${listAnd(groupAns(g, RESULTS[(R.tests || [])[0]]).map(a => /^[A-Z][a-z]?$/.test(a.k) ? a.k : lcName(a.n)))}`)))}.</p>` : ""}
      <label class="f full">QA/QC rule<textarea data-rf="qc">${esc(R.qc || "")}</textarea><span class="small muted" style="font-weight:400">${R.qcp ? "Written from the batch type, so it says what the batch enforces. Choosing another batch type or test rewrites it; you can add notes after it." : "Describe the checks. Only the checks built into the test's results are enforced."}</span></label>
      <label class="f full">Re-assay triggers (one per line)<textarea data-rf="triggers">${esc(R.triggers.join("\n"))}</textarea></label>
      <div class="legend" style="margin:0">Retention and disposal</div>
      <div class="tbl-wrap"><table><thead><tr><th>Material</th><th>Days kept after results</th><th>Then</th><th></th></tr></thead><tbody>${keepRows}</tbody></table></div>
      <div class="row"><button class="btn" id="rkAdd">Add material</button></div>
    </div>
    <div class="row sticky-bar"><span style="flex:1"></span><button class="btn ghost" id="cfgReset">Restore default sections and routes</button><button class="btn ghost" id="cfgCancel">Discard changes</button><button class="btn primary big" id="cfgSave">Save settings</button></div>
  </div>`;
  splitSettings(v);
  if (goEdit) $("#rtEdit").scrollIntoView({ block: "start" });
  const dirty = () => { draftDirty = true; renderStages(); };
  $("#cfgResPub").addEventListener("change", e => { draft.resultsPublic = e.target.value === "1"; dirty(); });
  $("#rtQcp").addEventListener("change", e => { R.qcp = e.target.value; regenQc(R); dirty(); });
  v.querySelectorAll("[data-cf]").forEach(el => el.addEventListener("change", () => {
    const i = +el.dataset.ci, f = el.dataset.cf, c = draft.crms[i];
    if (f === "id"){
      const id = el.value.toUpperCase().replace(/[^A-Z0-9._-]/g, "").slice(0, 20);
      if (!id){ toast("Use letters, digits, dots or dashes for the ID."); renderStages(); return; }
      const old = c.id;
      if (id === old){ renderStages(); return; }
      if (savedCrm.has(old) || (c.was || []).some(w => savedCrm.has(w))){
        // A saved material is renamed with all its rows; the old ID is kept so its batch records and control chart still count.
        if (draft.crms.some(y => y.id === id)){ toast(`${id} is already another reference material.`); renderStages(); return; }
        const busy = crmIdInUse(old);
        if (busy.length){ toast(`${old} is in open batch ${busy[0]}. Rename it once the batch is closed.`); renderStages(); return; }
        draft.crms.forEach(y => { if (y.id === old){ y.id = id; y.was = [...new Set([...(y.was || []), old])].filter(x => x !== id); } });
        dirty(); return;
      }
      if (draft.crms.some((y, j) => y.id === id && y.an === c.an && (y.u || "") === (c.u || "") && j !== i)){ toast(`${id} already has a row for ${c.an}. Choose another analyte for this row first.`); renderStages(); return; }
      const twin = draft.crms.find((y, j) => y.id === id && j !== i);
      c.id = id; if (twin){ c.name = twin.name; c.use = twin.use; }
    } else if (f === "an"){ const [a, u] = el.value.split("|"), busy = crmInUse(c); if (busy.length){ toast(`${c.id} ${c.an} is in open batch ${busy[0]}. Change the analyte once the batch is closed.`); renderStages(); return; } if (draft.crms.some((y, j) => y.id === c.id && y.an === a && (y.u || "") === (u || "") && j !== i)){ toast(`${c.id} already has a row for ${a}.`); renderStages(); return; } c.an = a; c.u = u || ""; }
    else if (f === "val" || f === "sd"){ const n = Number(el.value); if (el.value.trim() === "" || !isFinite(n) || n < 0){ toast("Type a number of 0 or more."); renderStages(); return; } c[f] = n; }
    else if (f === "use") c.use = el.value.toUpperCase().split(/[^A-Z]+/).filter(Boolean).join(", ");
    else c[f] = el.value.trim();
    dirty();
  }));
  v.querySelectorAll("[data-crm-rm]").forEach(b => b.onclick = () => {
    const c = draft.crms[+b.dataset.crmRm], inUse = crmInUse(c);
    if (inUse.length){ toast(`${c.id} is in open batch ${inUse[0]}. Remove it once the batch is closed.`); return; }
    draft.crms.splice(+b.dataset.crmRm, 1); dirty();
  });
  $("#crmAdd").onclick = () => {
    let n = 1, id; do { id = "CRM-" + n++; } while (draft.crms.some(x => x.id === id));
    draft.crms.push({ id, name: "New reference material", an: "Au", u: "g/t", val: 1, sd: 0.05, use: "", rk: crmNewKey() }); dirty();
  };
  v.querySelectorAll("[data-ki]").forEach(el => el.addEventListener("change", () => {
    const x = draft.cols[+el.dataset.ki];
    if (el.dataset.kf === "n"){ const n = el.value.trim().slice(0, 40); if (n && draft.cols.some((y, j) => normCol(y.n) === normCol(n) && j !== +el.dataset.ki)){ toast(`${n} is already on the list.`); renderStages(); return; } x.n = n; }
    else x.c = el.value;
    dirty();
  }));
  v.querySelectorAll("[data-krm]").forEach(b => b.onclick = () => { draft.cols.splice(+b.dataset.krm, 1); dirty(); });
  $("#colAdd").onclick = () => { draft.cols.push({ n: "", c: "" }); dirty(); };
  bindLimits(v, dirty);
  bindWork(v, dirty);
  bindLogo(v, dirty);
  $("#cfgTz").addEventListener("change", e => { const z = e.target.value.trim(); if (!tzOk(z)){ toast(`${z || "That"} is not a time zone name. Try Africa/Accra.`); renderStages(); return; } draft.tz = z; dirty(); });
  v.querySelectorAll("[data-sf]").forEach(el => el.addEventListener("change", () => {
    const x = draft.sections[+el.dataset.si];
    if (el.dataset.sf === "code"){
      const c = el.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5);
      if (c.length < 2){ toast("Use 2 to 5 letters for a section code."); renderStages(); return; }
      if (draft.sections.some((y, j) => y.code === c && j !== +el.dataset.si)){ toast(`${c} is already used by another section.`); renderStages(); return; }
      x.code = c;
    } else x.name = el.value.trim() || x.code;
    dirty();
  }));
  v.querySelectorAll("[data-srm]").forEach(b => b.onclick = () => {
    if (draft.sections.length <= 1){ toast("Keep at least one section."); return; }
    draft.sections.splice(+b.dataset.srm, 1); dirty();
    toast("Section removed. Samples already registered under it keep their IDs.");
  });
  $("#secAdd").onclick = () => {
    let n = 1, c; do { c = "NEW" + (n > 1 ? n : ""); n++; } while (draft.sections.some(x => x.code === c));
    draft.sections.push({ code: c.slice(0, 5), name: "New section" }); dirty();
  };
  // Routes
  $("#rtPick").onchange = e => { routeIdx = +e.target.value; renderStages(); };
  v.querySelectorAll("[data-rf]").forEach(el => el.addEventListener("change", () => {
    const f = el.dataset.rf;
    if (f === "code"){
      const c = el.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 10);
      if (c.length < 2){ toast("Use 2 to 10 letters, digits or dashes for a route code."); renderStages(); return; }
      if (draft.routes.some((y, j) => y.code === c && j !== routeIdx)){ toast(`${c} is already used by another route.`); renderStages(); return; }
      if (DEFAULT_ROUTES.some(d => d.code === R.code)) draft.removed = [...new Set([...(draft.removed || []), R.code])];
      R.code = c;
    } else if (f === "triggers") R.triggers = el.value.split("\n").map(x => x.trim()).filter(Boolean);
    else if (f === "two") R.two = el.checked;
    else if (f === "transit") R.transit = Math.max(0, +el.value || 0);
    else R[f] = el.value.trim();
    dirty();
  }));
  v.querySelectorAll("[data-rl]").forEach(el => el.addEventListener("change", () => {
    const before = (R.tests || [])[0];
    R[el.dataset.rl] = [...v.querySelectorAll(`[data-rl="${el.dataset.rl}"]:checked`)].map(x => x.value);
    if (el.dataset.rl === "tests" && (R.tests || [])[0] !== before) regenQc(R);
    dirty();
  }));
  v.querySelectorAll("[data-rk]").forEach(el => el.addEventListener("change", () => {
    const x = R.stages[+el.dataset.ri], f = el.dataset.rk;
    if (f === "redo"){ R.stages.forEach(y => delete y.redo); x.redo = true; }
    else if (f === "hours") x.hours = Math.max(0, +el.value || 0);
    else if (f === "clock"){ if (el.checked) x.clock = true; else delete x.clock; }
    else x[f] = f === "name" ? (el.value.trim() || "Unnamed step") : el.value.trim();
    dirty();
  }));
  v.querySelectorAll("[data-rmv]").forEach(b => b.onclick = () => { const i = +b.dataset.rmv, j = i + +b.dataset.d; [R.stages[i], R.stages[j]] = [R.stages[j], R.stages[i]]; dirty(); });
  v.querySelectorAll("[data-rrm]").forEach(b => b.onclick = () => { if (R.stages.length <= 1){ toast("A route needs at least one lab step."); return; } R.stages.splice(+b.dataset.rrm, 1); dirty(); });
  $("#rsAdd").onclick = () => { const qi = R.stages.findIndex(x => x.phase === "qc"); R.stages.splice(qi < 0 ? R.stages.length : qi, 0, { key: newKey(), name: "New step", hours: 2, phase: "test", note: "" }); dirty(); };
  v.querySelectorAll("[data-tf]").forEach(el => el.addEventListener("change", () => {
    const x = R.retention[+el.dataset.ti], f = el.dataset.tf;
    x[f] = f === "days" ? Math.max(0, Math.round(+el.value || 0)) : el.value.trim();
    dirty();
  }));
  v.querySelectorAll("[data-trm]").forEach(b => b.onclick = () => { R.retention.splice(+b.dataset.trm, 1); dirty(); });
  $("#rkAdd").onclick = () => { R.retention.push({ item: "Pulp", days: 90, then: "Disposed" }); dirty(); };
  $("#rtCopy").onclick = () => {
    let n = 2, c; do { c = `${R.code.slice(0, 7)}-${n++}`; } while (draft.routes.some(x => x.code === c));
    const copy = clone(R); copy.code = c; copy.name = "Copy of " + R.name; copy.stages.forEach(x => x.key = RESERVED.includes(x.key) ? newKey() : x.key);
    draft.routes.push(copy); routeIdx = draft.routes.length - 1; dirty();
  };
  $("#rtDel").onclick = () => {
    if (draft.routes.length <= 1){ toast("Keep at least one route."); return; }
    if (!storeReady){ toast("Still loading the samples in storage. Try again in a moment."); return; }
    if (inUse){ toast(`${inUse} open sample(s) use ${R.code}. Remove it once they are finished.`); return; }
    if (DEFAULT_ROUTES.some(d => d.code === R.code)) draft.removed = [...new Set([...(draft.removed || []), R.code])];
    draft.routes.splice(routeIdx, 1); routeIdx = 0; dirty();
    toast("Route removed. Samples already on it keep their steps.");
  };
  $("#cfgReset").onclick = () => {
    const locked = new Set([...[...samples.values()].map(s => s.route), ...[...stored.values()].map(x => x.route)]);
    draft.sections = clone(DEFAULT_CONFIG.sections);
    draft.routes = [...clone(DEFAULT_ROUTES), ...draft.routes.filter(r => locked.has(r.code) && !DEFAULT_ROUTES.some(d => d.code === r.code))];
    draft.removed = []; routeIdx = 0; dirty(); toast("Default sections and routes restored (routes still used by open samples are kept). Save to apply.");
  };
  $("#cfgCancel").onclick = () => { draft = clone(cfg); draftDirty = false; renderStages(); };
  v.querySelectorAll("[data-uf]").forEach(el => el.addEventListener("change", () => {
    const i = +el.dataset.ui, f = el.dataset.uf, x = draft.users[i];
    let val = el.value.trim();
    if (f === "u"){
      val = val.toLowerCase().replace(/[^a-z0-9._-]/g, "");
      if (!val){ toast("Usernames need letters or numbers."); renderStages(); return; }
      if (draft.users.some((y, j) => y.u === val && j !== i)){ toast(`${val} is already taken.`); renderStages(); return; }
      if (x.u === session.u){ toast("You cannot rename the account you are signed in with."); renderStages(); return; }
    }
    if (f === "role" && x.u === session.u && val !== "admin"){ toast("You cannot remove admin rights from your own account."); renderStages(); return; }
    if (f === "pw" && !val){ toast("A password cannot be empty."); renderStages(); return; }
    x[f] = f === "name" ? (val || x.u) : val;
    if (f === "role"){ if (val === "section") x.sec = x.sec || draft.sections[0]?.code || ""; else delete x.sec; }
    dirty();
  }));
  v.querySelectorAll("[data-urm]").forEach(b => b.onclick = () => { draft.users.splice(+b.dataset.urm, 1); dirty(); });
  $("#userAdd").onclick = () => {
    let n = 1, u; do { u = "tech" + n++; } while (draft.users.some(x => x.u === u));
    draft.users.push({ u, name: "New lab technician", role: "tech", pw: "tech123" }); dirty();
  };
  $("#cfgSave").onclick = async () => {
    const fail = (pane, m) => { cfgTab = pane; renderStages(); toast(m); };
    if (!draft.users.some(x => x.role === "admin")) return fail("accounts", "Keep at least one admin account.");
    if (workProblem(draft.work)) return fail("sections", workProblem(draft.work));
    const sdPre = Object.values(QC_PROFILES).filter(p => p.crm?.mode === "sd").map(p => p.prefix);
    for (const c of draft.crms){
      if (!(c.val > 0)) return fail("crms", `${c.id}: the certified value must be above 0.`);
      const use = useList(c);
      if (!(c.sd > 0) && (use.length ? use.some(x => sdPre.includes(x)) : true)) return fail("crms", `${c.id}: give the standard deviation; batches of type ${(use.length ? use.filter(x => sdPre.includes(x)) : sdPre).slice(0, 4).join(", ")} judge it in SD.`);
    }
    for (const [i, r] of draft.routes.entries()){
      const bad = msg => { routeIdx = i; fail("routes", `${r.code}: ${msg}`); };
      if (!r.tests.length) return bad("tick at least one test.");
      if (!r.stages.length) return bad("add at least one lab step.");
      const keys = r.stages.map(x => x.key);
      if (new Set(keys).size !== keys.length || keys.some(k => RESERVED.includes(k))) r.stages.forEach((x, j) => { if (RESERVED.includes(x.key) || keys.indexOf(x.key) !== j) x.key = newKey(); });
    }
    for (const l of draft.limits){
      const r = draft.routes.find(x => x.code === l.route), a = r && (RESULTS[(r.tests || [])[0]]?.an || []).find(x => x.k === l.k);
      if (!r || !a) return fail("limits", `Limit ${l.id}: choose a route and one of its results.`);
      if (!(isFinite(+l.val) && String(l.val).trim() !== "")) return fail("limits", `Limit ${l.id}: type the limit as a number.`);
      if (!String(l.act || "").trim()) return fail("limits", `Limit ${l.id}: say what is done when it is crossed.`);
    }
    const uncovered = TESTS.filter(t => !draft.routes.some(r => r.tests.includes(t.key))).map(t => t.name);
    const mine = draft, crmLog = [...crmChanges(clone(cfg.crms || []), draft.crms), ...(cfg.crmLog || [])].slice(0, CRM_LOG_MAX);
    draftDirty = false;                      // our own save coming back is not "someone else's"
    try {
      await db.doc("settings/stages").set({ schema: 12, tz: draft.tz, sections: clone(draft.sections), users: clone(draft.users), crms: clone(draft.crms), crmLog, limits: clone(draft.limits), cols: (draft.cols || []).filter(x => x.n).map(x => ({ n: x.n, c: x.c || "" })), resultsPublic: !!draft.resultsPublic, work: workOf(draft.work), logo: logoOf(draft.logo), routes: clone(editedRoutes(draft.routes)), removed: (draft.removed || []).filter(c => !draft.routes.some(r => r.code === c)), updatedAt: Date.now(), updatedBy: session.u });
      draftDirty = false; draft = null; renderStages();
      toast(uncovered.length ? `Saved. No route performs: ${uncovered.slice(0, 3).join(", ")}${uncovered.length > 3 ? "…" : ""}` : "Settings saved for everyone.");
    }
    catch (e) {
      draft = mine; draftDirty = true; renderStages();
      e?.code === "invalid_argument" ? toast("This copy of the prototype is view-only for your claude.ai account, so settings can't be saved.") : toast("Could not save settings.");
    }
  };
}

function refreshRegisterOptions(){
  const sel = $("#rSection"); if (!sel) return;
  const keep = sel.value;
  sel.innerHTML = `<option value="">Choose…</option>` + (cfg.sections || []).map(x => `<option value="${esc(x.code)}">${esc(x.code)} · ${esc(x.name)}</option>`).join("");
  sel.value = keep;
}
function setSync(state){
  const el = $("#sync"); if (!el) return;
  const map = { live: ["ok", "Live, in sync"], saving: ["gold", "Saving…"], stale: ["warn", "Reconnecting…"], off: ["bad", "Not connected"] };
  const [cls, txt] = map[state] || map.off;
  el.className = "pill " + cls; el.textContent = txt;
}

/* Analytes a reference material can certify: the QC analyte of every batch type that uses one. */
function crmAnalytes(){
  const m = new Map();
  for (const r of [...DEFAULT_ROUTES, ...(draft?.routes || [])]){
    const res = RESULTS[(r.tests || [])[0]];
    for (const g of Array.isArray(r.qcg) ? r.qcg : routeGroups(r)){
      if (!QC_PROFILES[g.p]?.ins?.crm) continue;
      for (const a of groupAns(g, res)){
        const sym = a.exact ? a.k : a.k.split("_")[0], key = `${sym}|${a.u || ""}`, el = /^[A-Z][a-z]?$/.test(sym);
        if (!m.has(key)) m.set(key, `${sym === "Au" ? "Gold" : el ? sym : a.n.replace(/ \(.*$/, "")} (${a.u || "no unit"})`);
      }
    }
  }
  const g = qcAnalyte(RESULTS.fa_grav); if (!m.has(`Au|${g.u}`)) m.set(`Au|${g.u}`, `Gold (${g.u})`);
  return new Map([...m].sort((a, b) => a[1].localeCompare(b[1])));
}
/* The QA/QC text of a route with a batch type is written from that batch type, so the words and the enforced checks agree. */
function regenQc(R){
  R.qcg = routeGroups(R);
  if (!QC_PROFILES[R.qcp]) return;
  R.qc = routeQcText(R, R.qcg);
}
/* Limits table in Settings. */
function limitRows(){
  const routes = draft.routes.slice().sort((a, b) => a.code.localeCompare(b.code));
  return draft.limits.map((l, i) => {
    const r = draft.routes.find(x => x.code === l.route), res = r ? RESULTS[(r.tests || [])[0]] : null, ans = (res?.an || []).filter(a => !a.t), pt = (res?.an || []).find(a => a.t === "pick");
    return `<tr>
      <td><select class="inp mono" style="width:auto" data-li="${i}" data-lf="route" aria-label="Route">${r ? "" : `<option value="" selected>Choose…</option>`}${routes.map(x => `<option value="${esc(x.code)}" ${x.code === l.route ? "selected" : ""}>${esc(x.code)}</option>`).join("")}</select></td>
      <td><select class="inp" style="width:auto;max-width:220px" data-li="${i}" data-lf="k" aria-label="Result">${ans.some(a => a.k === l.k) ? "" : `<option value="" selected>Choose…</option>`}${ans.map(a => `<option value="${esc(a.k)}" ${a.k === l.k ? "selected" : ""}>${esc(a.n)}${a.u ? ` (${esc(a.u)})` : ""}</option>`).join("")}</select></td>
      <td><select class="inp" style="width:auto" data-li="${i}" data-lf="op" aria-label="Above or below"><option value=">" ${l.op !== "<" ? "selected" : ""}>above</option><option value="<" ${l.op === "<" ? "selected" : ""}>below</option></select></td>
      <td><input class="inp mono" style="width:100px" type="number" step="any" data-li="${i}" data-lf="val" value="${esc(l.val)}" aria-label="Limit"></td>
      <td>${pt ? `<select class="inp" style="width:auto" data-li="${i}" data-lf="when" aria-label="Only when"><option value="">Any ${esc(pt.n.toLowerCase())}</option>${pt.opts.map(o => `<option ${o === l.when ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>` : `<span class="muted">—</span>`}</td>
      <td style="text-align:center"><input type="checkbox" data-li="${i}" data-lf="permit" ${l.permit ? "checked" : ""} aria-label="Permit or guideline limit"></td>
      <td><input class="inp" style="min-width:220px" data-li="${i}" data-lf="act" value="${esc(l.act || "")}" aria-label="Action"></td>
      <td><button class="btn ghost danger" data-lrm="${i}" aria-label="Remove limit">✕</button></td></tr>`;
  }).join("");
}
function bindLimits(v, dirty){
  v.querySelectorAll("[data-lf]").forEach(el => el.addEventListener("change", () => {
    const l = draft.limits[+el.dataset.li], f = el.dataset.lf;
    if (f === "permit") l.permit = el.checked || undefined;
    else if (f === "val"){ const n = Number(el.value); if (el.value.trim() === "" || !isFinite(n)){ toast("Type the limit as a number."); renderStages(); return; } l.val = n; }
    else if (f === "route"){ l.route = el.value; const r = draft.routes.find(x => x.code === l.route), ans = RESULTS[(r?.tests || [])[0]]?.an || []; if (!ans.some(a => a.k === l.k)) l.k = (ans.find(a => !a.t && !a.opt) || {}).k || ""; delete l.when; }
    else if (f === "when"){ if (el.value) l.when = el.value; else delete l.when; }
    else l[f] = el.value.trim();
    if (!l.permit) delete l.permit;
    dirty();
  }));
  v.querySelectorAll("[data-lrm]").forEach(b => b.onclick = () => { draft.limits.splice(+b.dataset.lrm, 1); dirty(); });
  $("#limAdd").onclick = () => { let n = draft.limits.length + 1, id; do { id = "L" + String(n++).padStart(2, "0"); } while (draft.limits.some(x => x.id === id)); draft.limits.push({ id, route: "", k: "", op: ">", val: 0, act: "" }); dirty(); };
}
