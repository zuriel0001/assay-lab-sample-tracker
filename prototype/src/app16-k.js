/* ---------- v16: reference materials fully editable, with a change history ---------- */
/* Every field of a reference material can be changed by the lab manager. A renamed material keeps its earlier IDs (was), so batch
   records and control charts that used them still count; each saved change goes in the register's change history. */
const CRM_LOG_MAX = 300;
const CRM_F = [["id", "ID"], ["name", "Description"], ["an", "Analyte"], ["val", "Certified value"], ["sd", "SD"], ["use", "Batch types"]];
const crmTxt = (c, f) => f === "an" ? `${c.an} ${c.u || ""}`.trim() : f === "val" || f === "sd" ? (c[f] == null || c[f] === "" ? "" : fmtNum(+c[f])) : String(c[f] ?? "");
const crmAka = id => [...new Set([id, ...(cfg.crms || []).filter(c => c.id === id).flatMap(c => c.was || [])])];
/* A stable key per row, so a saved change can be matched to the row it was made on even when its ID or analyte changed. */
function crmKeys(list){ (list || []).forEach(c => { if (!c.rk) c.rk = `${c.id}|${c.an}|${c.u || ""}`; }); return list; }
const crmNewKey = () => "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
/* Open lab batches that use this row (its ID, for its analyte and unit). */
const crmInUse = c => [...openBatches.values()].filter(x => (x.pos || []).some(y => y.crm === c.id) && bAns(x).some(ch => crmMatch(c, ch))).map(x => x.id);
const crmIdInUse = id => [...openBatches.values()].filter(x => (x.pos || []).some(y => y.crm === id)).map(x => x.id);
function crmChanges(before, after){
  crmKeys(before); crmKeys(after);
  const at = Date.now(), by = session?.name || session?.u || "", out = [], old = new Map((before || []).map(c => [c.rk, c]));
  for (const c of after || []){
    const o = old.get(c.rk); old.delete(c.rk);
    if (!o){ out.push({ at, by, id: c.id, what: `Added ${crmTxt(c, "an")}, certified ${crmTxt(c, "val")}${c.sd ? ` ± ${crmTxt(c, "sd")}` : ""}` }); continue; }
    const ch = CRM_F.filter(([f]) => crmTxt(o, f) !== crmTxt(c, f)).map(([f, l]) => `${l} ${crmTxt(o, f) || "—"} → ${crmTxt(c, f) || "—"}`);
    if (ch.length) out.push({ at, by, id: c.id, what: ch.join("; ") });
  }
  for (const o of old.values()) out.push({ at, by, id: o.id, what: `Removed ${crmTxt(o, "an")}, certified ${crmTxt(o, "val")}` });
  return out;
}
function crmLogHtml(){
  const log = Array.isArray(cfg.crmLog) ? cfg.crmLog : [];
  if (!log.length) return "";
  return `<details class="crm-log"><summary>Change history (${log.length})</summary>
    <div class="tbl-wrap"><table><thead><tr><th>When</th><th>By</th><th>ID</th><th>Change</th></tr></thead><tbody>${log.slice(0, 100).map(x =>
      `<tr><td style="white-space:nowrap">${esc(fmt(x.at))}</td><td>${esc(x.by || "")}</td><td class="mono">${esc(x.id || "")}</td><td>${esc(x.what || "")}</td></tr>`).join("")}</tbody></table></div></details>`;
}

/* ---------- v16: board lanes scroll once they hold more than five cards ---------- */
const LANE_CARDS = 5;
/* Where each lane was scrolled to, so a live update of the board does not jump back to the top. */
const laneScroll = () => new Map([...document.querySelectorAll("#view-board .lane")].map(l => [l.className, l.querySelector(".cards")?.scrollTop || 0]));
function fitLanes(scrolled){
  document.querySelectorAll("#view-board .lane").forEach(l => {
    const c = l.querySelector(".cards"); if (!c) return;
    const k = c.children, last = k[LANE_CARDS - 1];
    c.style.maxHeight = k.length > LANE_CARDS && last && last.offsetHeight ? `${last.offsetTop + last.offsetHeight + 28}px` : "";
    c.classList.toggle("scrolls", k.length > LANE_CARDS);
    if (scrolled?.get(l.className)) c.scrollTop = scrolled.get(l.className);
    const end = () => c.classList.toggle("at-end", c.scrollTop + c.clientHeight >= c.scrollHeight - 2);
    c.onscroll = end; end();
  });
}
let fitTimer = 0;
addEventListener("resize", () => { clearTimeout(fitTimer); fitTimer = setTimeout(() => { if (tab === "board") fitLanes(); }, 150); });
