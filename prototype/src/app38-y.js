/* ---------- v38 (22 Oct, idea 1): a results grid ----------
   Zuriel 18:06Z: "complete everything ... without asking me any questions". Type the results of many samples in one table: one table per
   analysis (its own columns), one row per sample. Tab moves along a row, Enter down a column. Save writes each row that has a value the way
   the record's Save does: complete results are released at once (a batch with its batch certificate); four eyes, "results before release"
   and two-person custody (released from the record, with the witness) are unchanged. On the batch page and under Results. */
const rgVals = {};   // what is typed, by sample and result: it survives the page being drawn again
let rgOpen = "", rgBusy = false, rgAll = false;   // rgAll: the optional results get columns too
const canGrid = s => { const ph = stage(s, s.stageKey)?.phase; return canEdit() && !!s && !awaiting(s) && s.open !== false && curIdx(s) >= 1 && curIdx(s) < targetIdx(s) && (ph === "test" || ph === "qc"); };
const gridAns = s => anOf(s).filter(a => !a.calc);
const gridKey = s => (s.test === "x" ? "x:" + (s.testName || "") : s.test) + "|" + gridAns(s).map(a => a.k).join(",");
/* Samples whose results are still to come and can be typed now. */
const waitingGrid = list => list.filter(s => canGrid(s) && resMissing(s));
function gridCell(s, a, i){
  const id = `rg${i}_${a.k}`, k = s.id + "|" + a.k, raw = rgVals[k] ?? s.results?.rows?.[a.k]?.raw ?? (a.t === "pick" ? ptGiven(s) : "");
  const lbl = `${esc(s.id)} ${esc(a.n)}`;
  if (a.t === "pick") return `<select class="inp" id="${id}" data-rgk="${esc(k)}" aria-label="${lbl}"><option value="">—</option>${(a.opts || []).map(o => `<option ${o === raw ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
  return `<input class="inp${a.t === "text" ? "" : " mono"}" id="${id}" data-rgk="${esc(k)}" ${a.t === "text" ? "" : `data-num inputmode="decimal"`} autocomplete="off" value="${esc(raw)}" aria-label="${lbl}" placeholder="${a.dl != null ? `<${esc(fmtNum(a.dl))}` : ""}">`;
}
/* The grid for a list of samples; rows are numbered across the tables so every box has its own id. */
function resultsGrid(list, key){
  const groups = new Map(); list.slice(0, 200).forEach(s => { const g = gridKey(s); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(s); });
  let i = 0;
  let hidden = 0;
  const tables = [...groups.values()].map(ss => { const all = gridAns(ss[0]), name = ss[0].testName || testOf(ss[0].test)?.name || "";
    const ans = rgAll ? all : all.filter(a => !a.opt || ss.some(s => s.results?.rows?.[a.k] || rgVals[s.id + "|" + a.k]));   // optional results only when asked for (or already given)
    hidden = Math.max(hidden, all.length - ans.length);
    return `<div class="rg-g"><h4>${esc(name)} <span class="pill">${nS(ss.length)}</span></h4><div class="tbl-wrap"><table class="rg-t"><thead><tr><th>Sample</th>${ans.map(a => `<th>${esc(anShort(a))}${a.u ? ` <span class="muted">${esc(a.u)}</span>` : ""}${a.opt ? ` <span class="muted">opt.</span>` : ""}</th>`).join("")}</tr></thead>
      <tbody>${ss.map(s => { const r = i++; return `<tr data-rgs="${esc(s.id)}" data-rgi="${r}"><td><button type="button" class="linkish mono" data-open="${esc(s.id)}">${esc(s.id)}</button>${ownCode(s) || tagText(s) ? `<div class="small muted mono">${esc(ownCode(s) || tagText(s))}</div>` : ""}${twoPerson(s) ? ` <span class="haz two" title="Two-person custody: released from its record, with the witness">2P</span>` : ""}</td>${ans.map(a => `<td>${gridCell(s, a, r)}</td>`).join("")}</tr>`; }).join("")}</tbody></table></div></div>`; }).join("");
  return `<div class="rg stack" id="rgBox" data-rgkey="${esc(key)}">${tables}
    <div class="row step-row"><button type="button" class="btn primary" id="rgSave" ${rgBusy ? "disabled" : ""}>${rgBusy ? "Saving…" : "Save results"}</button>${hidden || rgAll ? `<button type="button" class="btn ghost" id="rgAll" aria-pressed="${rgAll}">${rgAll ? "Fewer columns" : `Optional results (${hidden})`}</button>` : ""}<button type="button" class="btn ghost" id="rgClose">Close</button><span class="small muted">Enter: next sample · &lt;DL: below detection</span></div></div>`;
}
function bindGrid(v, list, after){
  const box = $("#rgBox", v); if (!box) return;
  box.addEventListener("input", e => { const k = e.target.dataset?.rgk; if (k) rgVals[k] = e.target.value; });
  box.addEventListener("change", e => { const k = e.target.dataset?.rgk; if (k) rgVals[k] = e.target.value; });
  box.addEventListener("keydown", e => {   // Enter: the same result on the next sample
    if (e.key !== "Enter" || !e.target.dataset?.rgk) return;
    e.preventDefault();
    const td = e.target.closest("td"), tr = td.parentElement, col = [...tr.children].indexOf(td), nx = (e.shiftKey ? tr.previousElementSibling : tr.nextElementSibling)?.children[col]?.querySelector("input,select");
    (nx || $("#rgSave", box)).focus(); nx?.select?.();
  });
  $("#rgClose", box).onclick = () => { rgOpen = ""; after(); };
  $("#rgAll", box)?.addEventListener("click", () => { rgAll = !rgAll; after(); $("#rgAll")?.focus(); });
  $("#rgSave", box).onclick = () => saveGrid(list, after);
}
async function saveGrid(list, after){
  if (rgBusy || !canEdit()) return;
  const jobs = [];
  for (const tr of document.querySelectorAll("#rgBox tr[data-rgs]")){
    const s = list.find(x => x.id === tr.dataset.rgs); if (!s) continue;
    const rows = readRows(`rg${tr.dataset.rgi}_`, anOf(s), s.results?.rows); if (!rows) return;   // a value that can't be read: said, and nothing saved
    const typed = Object.keys(rows).filter(k => rgVals[s.id + "|" + k] != null && rows[k].raw !== s.results?.rows?.[k]?.raw);   // only what was typed here (a filled-in sampling point alone saves nothing)
    if (typed.length) jobs.push([s, rows]);
  }
  if (!jobs.length){ toast("Type at least one result."); return; }
  rgBusy = true; $("#rgSave") && ($("#rgSave").disabled = true, $("#rgSave").textContent = "Saving…");
  let rel = 0; const batches = new Set();
  const ok = await pool(jobs, 5, ([s0, rows]) => sampleWrite(s0.id, s => {
    if (!canGrid(s)) return null;
    const at = nowAfter(s), all = withCalc(s, rows);
    const next = { v: (s.results?.v || 0) + 1, at, by: session.u, tech: session.name, rows: patch(s.results?.rows, all), batch: s.results?.batch || "", inst: s.results?.inst || "" };
    if (grouped(s)) batches.add(s.batchId);
    return { upd: { results: next, resHist: [...(s.resHist || []), ...(s.results ? [s.results] : [])].slice(-30), resAcc: null,
      history: [...(s.history || []), { key: s.stageKey, sn: stage(s, s.stageKey)?.name, at, by: session.u, tech: session.name, ref: "", res: true, note: `Results ${s.results ? "updated" : "entered"} (results grid): ${resSummary(anOf(s), all)}` }] } };
  }, upd => { if (upd.relAt) rel++; }));
  for (const [s] of jobs) gridAns(s).forEach(a => delete rgVals[s.id + "|" + a.k]);
  let bRel = 0;
  if (relNow()) for (const ref of batches){ const r = await releaseGroup(ref, "", true); bRel += r.n || 0; }
  rgBusy = false;
  toast(`Results saved on ${nS(ok)}${rel + bRel ? `; ${rel + bRel} released` : ""}${ok < jobs.length ? `; ${jobs.length - ok} could not be saved (moved on meanwhile?)` : ""}`);
  after();
}
/* The Results tab (lab staff): the samples waiting for results, with the grid a tap away. */
function resultsWaitPanel(){
  if (!canEdit()) return "";
  const list = waitingGrid([...samples.values()]); if (!list.length && rgOpen !== "res") return "";
  return `<div class="panel stack" id="rgWait" style="gap:10px"><div class="row" style="gap:10px"><h3 style="margin:0">Waiting for results</h3><span class="pill gold">${nS(list.length)}</span><span class="grow"></span>${rgOpen === "res" ? "" : `<button type="button" class="btn primary" id="rgOpenRes" ${list.length ? "" : "disabled"}>Type results</button>`}</div>
    ${rgOpen === "res" && list.length ? resultsGrid(list, "res") : ""}</div>`;
}
function bindResultsWait(v){
  const list = waitingGrid([...samples.values()]);
  $("#rgOpenRes", v)?.addEventListener("click", () => { rgOpen = "res"; renderResultsTab(); $("#rgBox input,#rgBox select")?.focus(); });
  bindGrid(v, list, () => renderResultsTab());
}
/* The batch page: "Type results" beside the batch's results file; the grid opens in the step's box. */
const bwGridBtn = (at, ref) => at.some(canGrid) && rgOpen !== "bw:" + ref ? `<button type="button" class="btn" id="bwGridBtn">Type results</button>` : "";
const bwGrid = (at, ref) => rgOpen === "bw:" + ref && at.some(canGrid) ? resultsGrid(at.filter(canGrid), "bw:" + ref) : "";
function bindBwGrid(v){
  const ref = current?.batch; if (!ref) return;
  $("#bwGridBtn", v)?.addEventListener("click", () => { rgOpen = "bw:" + ref; renderTrack(); $("#rgBox input,#rgBox select")?.focus(); });
  if ($("#rgBox", v)) bindGrid(v, (batchState(current.docs || []).at || []).filter(canGrid), () => { if (current?.batch) renderTrack(); });
}

/* ---------- v38 (idea 2): a shorter record ----------
   The steps fold to the one before, the one now and the one after; "4 steps done" and "3 more steps" open them all (remembered on this
   device), "Fewer steps" folds them again. Every step stays in the page, only hidden. Records and the batch page alike. */
let railAll = lsGet("railAll") === "1";
function railOl(items){
  const n = items.length, cls = items.map(h => (/^\s*<li class="([^"]*)"/.exec(h) || [])[1] || "");
  let f = cls.findIndex(c => /\bcurrent\b/.test(c));
  if (f < 0) f = Math.max(0, cls.map(c => /\b(done|skipped)\b/.test(c)).lastIndexOf(true));
  const a = f - 1 >= 2 ? f - 1 : 0, b = n - 1 - (f + 1) >= 2 ? f + 2 : n;   // hide only two or more in a row
  if (n <= 5 || (!a && b === n)) return `<ol class="rail">${items.join("")}</ol>`;
  if (railAll) return `<ol class="rail">${items.join("")}</ol><button type="button" class="btn ghost small rail-less" data-rail-all="0">Fewer steps</button>`;
  const skip = cls.slice(0, a).some(c => /skipped/.test(c));
  return `${a ? `<button type="button" class="rail-sum done" data-rail-all="1"><span class="dot">✓</span><span>${a} ${skip ? "earlier steps" : "steps done"}</span></button>` : ""}<ol class="rail">${items.map((h, i) => i < a || i >= b ? h.replace(/^(\s*<li class=")/, "$1rl-fold ") : h).join("")}</ol>${b < n ? `<button type="button" class="rail-sum" data-rail-all="1"><span class="dot"></span><span>${n - b} more step${n - b === 1 ? "" : "s"}</span></button>` : ""}`;
}
document.addEventListener("click", e => {
  const b = e.target.closest?.("[data-rail-all]"); if (!b) return;
  railAll = b.dataset.railAll === "1"; lsSet("railAll", railAll ? "1" : "");
  renderTrack();
});

/* ---------- v38 (idea 7): the condition at receipt, several at once plus a typed one ----------
   Nothing ticked and nothing typed is "Good"; what is ticked or typed is kept as one line ("Wet; Labels unclear or wrong; torn corner"). */
const COND_PICK = CONDITIONS.filter(c => c !== "Good" && !/^Other/.test(c));
const condPick = p => `<div class="f full cond-f"><span>Condition</span><div class="checks chips" id="${p}CondPick">${COND_PICK.map((c, i) => `<label><input type="checkbox" id="${p}C${i}" value="${esc(c)}"> ${esc(c)}</label>`).join("")}<input class="inp" id="${p}CondOther" autocomplete="off" placeholder="Other" aria-label="Other condition"></div></div>`;
const condRead = p => [...document.querySelectorAll(`#${p}CondPick input[type=checkbox]:checked`)].map(x => x.value).concat(val(`#${p}CondOther`) || []).join("; ") || "Good";

/* ---------- v38 (idea 8): put every material away at once ----------
   Two or more materials still to put away: one location for them all, one press; each gets its own custody line, as one by one. */
const toPut = s => (s.materials || []).filter(m => m.status === "kept" && !m.loc);
const storeAllRow = s => toPut(s).length < 2 ? "" : `<div class="row step-row mat-all"><input class="inp" id="mxAllLoc" data-clear autocomplete="off" placeholder="Location for all" aria-label="Location for all" style="flex:1 1 180px;min-width:0;width:auto"><button type="button" class="btn primary" id="mxAll">Put all ${toPut(s).length} away</button></div>`;
async function doStoreAll(){
  const s0 = current?.body; if (!s0) return;
  const loc = val("#mxAllLoc");
  if (wqOf(s0)){ toast(`Waiting for ${s0.wq.wit} to confirm. Withdraw that request first.`); return; }
  if (!loc){ toast("Type the storage location first."); $("#mxAllLoc")?.focus(); return; }
  const wit = twoPerson(s0) && s0.stageKey === "released" ? "" : needWitness(s0, "#mtWit"); if (wit === null) return;
  await act(s => {
    let cur = s, upd = {}, n = 0, msg = "";
    for (const m of toPut(s)){ const r = matUpd(cur, m.k, "store", loc, wit); if (!r) continue; upd = { ...upd, ...r.upd }; cur = { ...cur, ...r.upd }; msg = r.msg; n++; }
    if (!n){ toast("Nothing left to put away."); return null; }
    return { upd, msg: `${n} materials stored at ${loc}${/workflow is complete|ask a witness/.test(msg) ? msg.replace(/^[^.]*/, "") : ""}` };
  }, { anyStage: true, clear: ["mxAllLoc", "mtWit"] });
}

/* ---------- v38 (idea 3): several samples one step on, from the board's List ----------
   Tick the samples (each goes to its own next step); a sample at its last lab step goes on to wait for its results. Not offered for a
   batch processed as one (its page moves it), a two-person sample (its witness signs each step), a release, or a step a rule holds. */
const bdTicks = new Set();
function canStepOn(s){
  if (!canEdit() || !s || grouped(s) || awaiting(s) || twoPerson(s) || s.open === false || wqOf(s) || waitingRes(s)) return false;
  const ci = curIdx(s), nx = planOf(s)[ci + 1]; if (ci < 1 || !nx) return false;
  if (nx.target) return ci === targetIdx(s) - 1 && resMissing(s);
  const to = stage(s, nx.key); return !!to && !(to.phase === "qc" && stage(s, s.stageKey)?.phase !== "qc" && qcEntryBlock(s));
}
const mvTicked = () => [...bdTicks].filter(id => canStepOn(samples.get(id)));
const moveBar = () => { const n = mvTicked().length; return `<div class="row step-row" id="bdMoveBar"><button type="button" class="btn primary" id="bdMove" ${n ? "" : "disabled"}>${n ? `Move ${nS(n)} one step` : "Move one step"}</button></div>`; };
function bindMoveList(v){
  const bar = $("#bdMove", v); if (!bar) return;
  const sync = () => { const n = mvTicked().length; bar.disabled = !n; bar.textContent = n ? `Move ${nS(n)} one step` : "Move one step"; const all = $("#bdMvAll", v), bs = [...v.querySelectorAll("[data-mv]")]; if (all) all.checked = bs.length > 0 && bs.every(b => b.checked); };
  v.querySelectorAll("[data-mv]").forEach(b => b.addEventListener("change", () => { b.checked ? bdTicks.add(b.dataset.mv) : bdTicks.delete(b.dataset.mv); sync(); }));
  $("#bdMvAll", v)?.addEventListener("change", e => { v.querySelectorAll("[data-mv]").forEach(b => { b.checked = e.target.checked; b.checked ? bdTicks.add(b.dataset.mv) : bdTicks.delete(b.dataset.mv); }); sync(); });
  bar.addEventListener("click", doMoveMany); sync();
}
function stepOnUpd(s){
  if (!canStepOn(s)) return null;
  const ci = curIdx(s), nx = planOf(s)[ci + 1], at = nowAfter(s), line = { at, by: session.u, tech: session.name, ref: "" };
  if (nx.target) return { rw: { key: s.stageKey, at }, history: [...(s.history || []), { key: s.stageKey, sn: stage(s, s.stageKey)?.name || s.stageKey, ...line, rw: true, note: "Done: waiting for the results (moved from the board list)" }] };
  return { stageKey: nx.key, stageAt: at, history: [...(s.history || []), { key: nx.key, sn: stage(s, nx.key)?.name || nx.key, ...line, note: "Moved from the board list" }] };
}
async function doMoveMany(){
  const ids = mvTicked(); if (!ids.length) return;
  const b = $("#bdMove"); if (b){ b.disabled = true; b.textContent = "Moving…"; }
  const ok = await pool(ids, 4, id => sampleWrite(id, stepOnUpd));
  ids.forEach(id => bdTicks.delete(id));
  toast(ok === ids.length ? `Moved ${nS(ok)} one step` : `Moved ${ok} of ${ids.length}; the others changed meanwhile`);
  renderBoard();
}

/* ---------- v38 (idea 4): My samples, for a section account ----------
   What the section has in the lab now (step, results expected), then its released results with the values, an Export CSV of them, and a
   search. The values are the section's own (the server sends them to that section only). */
let secQ = "", secLab = [], secLabSub = null, secLabKey = "";
/* The section's samples in the lab: its own query (the Azure server lets a section account list its own section only). */
function watchSectionLab(){
  const key = session?.role === "section" && db ? session.sec : "";
  if (key === secLabKey) return;
  if (secLabSub){ secLabSub(); secLabSub = null; }
  secLabKey = key; secLab = [];
  if (!key) return;
  secLabSub = db.collection("samples").where("section", "==", key).where("lab", "==", true).limit(200).onSnapshot(snap => {
    secLab = snap.docs.map(d => d.data()).filter(x => x && x.id);
    if (tab === "results") renderResultsTab();
  }, () => {});
}
function renderSectionResults(v){
  const seen = +lsGet(seenKey()) || 0, fresh = newResults().length, q = secQ.trim().toUpperCase().replace(/\s+/g, "");
  const hit = s => !q || [s.id, tagText(s), ownCode(s) || "", s.type || "", s.testName || ""].some(x => String(x).toUpperCase().replace(/\s+/g, "").includes(q));
  const list = secRes.slice().sort((a, b) => b.certs.at(-1).at - a.certs.at(-1).at).slice(0, 200).filter(hit);
  watchSectionLab();
  const lab = secLab.filter(s => s.section === session.sec && s.open !== false && curIdx(s) < targetIdx(s) && hit(s)).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const keepFocus = document.activeElement?.id === "secQ";
  v.innerHTML = `<div class="stack"><div class="panel stack res-head" style="gap:10px">
      <div class="row" style="gap:10px"><h2 style="margin:0">Results for ${esc(session.sec)} · ${esc(sectionName(session.sec))}</h2><span class="grow"></span>${fresh ? `<span class="pill gold">${fresh} new since you last looked</span><button type="button" class="btn" id="secSeen">Mark all as seen</button>` : ""}<button type="button" class="btn" id="secCsv" ${secRes.length ? "" : "disabled"}>Export CSV</button></div>
      <div class="row bd-tools"><input class="inp" id="secQ" placeholder="Search ID, site code, type" value="${esc(secQ)}" style="flex:1 1 220px;width:auto"></div></div>
    ${lab.length ? `<div class="panel stack" id="secLab" style="gap:8px"><h3 style="margin:0">In the lab <span class="pill">${nS(lab.length)}</span></h3><div class="tbl-wrap"><table class="cardy"><thead><tr><th>Sample</th><th>Type · test</th><th>Now</th><th>Results expected</th></tr></thead><tbody>
      ${lab.slice(0, 100).map(s => { const st = status(s), eta = projection(s).eta; return `<tr><td data-l="Sample"><button type="button" class="linkish mono" data-open="${esc(s.id)}">${esc(s.id)}</button>${ownCode(s) || tagText(s) ? `<div class="small muted mono">${esc(ownCode(s) || tagText(s))}</div>` : ""}</td><td data-l="Type · test">${esc(s.type || "")}<div class="small muted">${esc(s.testName || "")}</div></td><td data-l="Now"><span class="pill ${st.cls}">${esc(waitingRes(s) ? "Waiting for results" : st.label)}</span></td><td data-l="Results expected" style="white-space:nowrap">${eta ? esc(fmt(eta)) : "—"}</td></tr>`; }).join("")}</tbody></table></div></div>` : ""}
    ${list.length ? `<div class="panel stack" style="gap:8px"><h3 style="margin:0">Released</h3><div class="tbl-wrap"><table class="cardy"><thead><tr><th>Sample</th><th>Type · test</th><th>Results</th><th>Certificate</th><th>Released</th></tr></thead><tbody>
      ${list.map(s => { const c = s.certs.at(-1); return `<tr><td data-l="Sample"><button type="button" class="linkish mono" data-open="${esc(s.id)}">${esc(s.id)}</button>${c.at > seen ? ` <span class="pill gold">New</span>` : ""}${ownCode(s) ? `<div class="small muted mono">${esc(ownCode(s))}</div>` : ""}</td><td data-l="Type · test">${esc(s.type || "")}<div class="small muted">${esc(c.testName || "")}</div></td><td data-l="Results" class="mono small">${esc(certSummary(c, s))}</td><td data-l="Certificate" class="mono">${esc(c.no)}${c.amends ? ` <span class="pill warn">Amended</span>` : ""}</td><td data-l="Released" style="white-space:nowrap">${fmt(c.at)}</td></tr>`; }).join("")}</tbody></table></div></div>`
      : `<div class="panel empty"><strong>${q ? "Nothing matches the search" : "No released results yet"}</strong></div>`}</div>`;
  const qi = $("#secQ", v);
  qi.addEventListener("input", () => { secQ = qi.value; renderResultsTab(); });
  if (keepFocus){ qi.focus(); qi.setSelectionRange(qi.value.length, qi.value.length); }
  $("#secSeen", v)?.addEventListener("click", () => { lsSet(seenKey(), String(Date.now())); resultsBadge(); renderResultsTab(); });
  $("#secCsv", v)?.addEventListener("click", () => sectionCsv(list));
}
async function sectionCsv(list){
  const dl = window.claude?.use ? await claude.use("downloads") : null;
  if (!dl){ toast("Downloads are not available in this view."); return; }
  const q = x => `"${String(x ?? "").replace(/"/g, '""')}"`, head = ["Sample ID", "Site sample code", "Type", "Test", "Certificate", "Released (site)", "Results", "Amended"];
  const lines = list.map(s => { const c = s.certs.at(-1); return [s.id, ownCode(s) || tagText(s), s.type, c.testName, c.no, fmtFull(c.at), certSummary(c, s), c.amends ? "yes" : ""].map(q).join(","); });
  try { await dl.save({ filename: `results-${session.sec}-${dayKey(Date.now())}.csv`, data: [head.map(q).join(","), ...lines].join("\n") }); }
  catch { toast("Download was not saved."); }
}

/* ---------- v38 (idea 5): Shift end and MET Lab job rows on a phone, one line each ----------
   Tick, name and code on one line; the description and analysis (filled in from the template) open with ⋯ on the row. A row with a typed
   analysis or extra analyses shows them. Computers are unchanged. */
const jxOpen = new Set();
const jxOn = (r, i) => jxOpen.has(i) || r.test === "x" || (r.t2 || []).length > 0 || (r.xa || []).length > 0;
document.addEventListener("click", e => {
  const b = e.target.closest?.("[data-jx]"); if (!b) return;
  const i = +b.dataset.jx, tr = b.closest("tr"), on = !tr.classList.contains("jx");
  on ? jxOpen.add(i) : jxOpen.delete(i); tr.classList.toggle("jx", on); b.setAttribute("aria-expanded", String(on));
});
