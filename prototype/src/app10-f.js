
/* ---------- upgrade of records written by earlier versions (runs once, under a lease) ---------- */
function upgradeSample(s){
  const upd = { v: 10 }, moves = [], fin = !!stage(s, s.stageKey)?.final;
  if (!Array.isArray(s.tags)) upd.tags = splitTags(s.tagNo).map(normTag);
  if (s.siteRefU == null) upd.siteRefU = normTag(s.siteRef);
  const rec = (s.history || []).find(h => h.key === "received");
  const recvAt = s.recvAt || s.receivedAt || rec?.at || null;
  const mv = (dir, at, mid, extra) => ({ mid, dir, at, sid: s.id, sec: s.section || "", type: s.type || "", route: s.route || "", tag: (upd.tags || s.tags || []).join(", ") || s.tagNo || "", sub: s.submitter || "", by: "", tech: "", ...extra });
  if (recvAt && !awaiting(s) && s.stageKey !== "rejected" && s.stageKey !== "cancelled"){
    upd.recvAt = recvAt; upd.inMid = `${s.id}~in`;
    moves.push(mv("in", recvAt, `${s.id}~in`, { item: "Sample", qty: qtyText(s.containers, s.massKg, "kg"), from: s.source || sectionName(s.section) || "Mine site", tech: rec?.tech || s.receivedBy || "", by: rec?.by || "", note: "Brought forward from the earlier ledger" }));
  }
  const rel = lastEntry(s, "released"), ci = curIdx(s), ti = targetIdx(s);
  if (rel){ upd.relAt = rel.at; upd.relDay = dayKey(rel.at); }
  if (fin){
    Object.assign(upd, { open: false, onHand: false, closedAt: s.stageAt });
    const last = lastEntry(s, s.stageKey);
    if (["returned", "external", "disposed"].includes(s.stageKey) && upd.recvAt)
      moves.push(mv("out", s.stageAt, `${s.id}~out~all~1`, { kind: s.stageKey, item: "Whole sample", ref: last?.ref || "", tech: last?.tech || "", by: last?.by || "", note: "Brought forward from the earlier ledger" }));
  } else {
    Object.assign(upd, { open: true, onHand: !!upd.recvAt });
    if (!(s.materials || []).length && rel && ci >= ti) upd.materials = materialsAt(s, rel.at).map(m => ({ ...m, loc: ci > ti ? (s.location || "Storage (location not recorded)") : "" }));
  }
  if (moves.length){ upd.ledgerPending = moves; upd.lp = true; }
  return upd;
}
/* Versions 11 and 12 tracked lab batches on each sample; v35 removed them, so those versions only move the record on. */
const SCHEMA = 13;
async function migrate(){
  const ref = db.doc("meta/schema");
  const cur = await ref.get(); if (cur.exists && +cur.data().v >= SCHEMA) return;
  const lease = await ref.acquire({ holder: tabId, ttlMs: 120000 }); if (!lease.acquired) return;
  const release = () => ref.acquire({ holder: tabId, ttlMs: 1000 }).catch(() => {});
  const again = await ref.get(); if (again.exists && +again.data().v >= SCHEMA) return release();
  const done = new Set();
  const up = async s => {
    if (!s || !s.id || done.has(s.id) || +s.v >= SCHEMA) return;
    done.add(s.id);
    const upd = +s.v >= 10 ? {} : upgradeSample(s);
    Object.assign(upd, upgrade13({ ...s, ...upd }));
    const sref = db.doc("samples/" + skey(s.id));
    try { await sref.update(upd); if (upd.sx) await writeStock(sref, { ...s, ...upd }); } catch {}
    (upd.tags || []).forEach(t => { if (upd.open !== false) db.doc("tagidx/" + tagKey(t)).set({ sid: s.id, tag: t, at: Date.now() }).catch(() => {}); });
  };
  // Records from before version 10 may carry no version; later ones are found by version, a page at a time, however many there are.
  await pool((await db.collection("samples").limit(1000).get()).docs.map(d => d.data()), 6, up);
  for (let pass = 0; pass < 500; pass++){
    const more = (await db.collection("samples").where("v", "<", SCHEMA).limit(200).get()).docs.map(d => d.data()).filter(s => s && s.id && !done.has(s.id));
    if (!more.length) break;
    await pool(more, 6, up);
  }
  await ref.set({ v: SCHEMA, at: Date.now() });
  release();
}
/* Ledger movements that were saved on the sample but not yet in the ledger (a dropped connection) are written again; each has a fixed id, so nothing doubles. */
async function maintenance(){
  if (!db || canWrite === false) return;
  try { await migrate(); } catch {}
  try { await fixStock(); } catch {}
  try { (await db.collection("samples").where("lp", "==", true).get()).docs.forEach(d => { const x = d.data(); if (x?.id) flushLedger(x.id); }); } catch {}
}

/* ---------- boot ---------- */
const typingIn = sel => { const a = document.activeElement; return !!(a && a.closest?.(sel) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); };
function rerenderSoon(){ clearTimeout(rerenderSoon.t); rerenderSoon.t = setTimeout(() => { if (tab === "board"){ if (typingIn("#bdPick.todo")) return void setTimeout(rerenderSoon, 1200); renderBoard(); } else if (tab === "ledger") renderLedger(); else if (tab === "results"){ if (typingIn("#rgBox")) return void setTimeout(rerenderSoon, 1200); renderResultsTab(); } else if (tab === "storage") renderStorage(); else if (tab === "track" && !current && !typingIn("#view-track")) renderTrack(); updateCount(); }, 80); }
/* Default limits added in version 23 (P01 on, for the new routes) join limits saved before them; once settings are saved again, a limit the
   lab manager removed stays removed. */
const LIMITS_V = 23;
const newLimits = (saved, v) => [...clone(saved), ...(v >= LIMITS_V ? [] : clone(DEFAULT_CONFIG.limits.filter(l => /^P\d/.test(l.id) && !saved.some(x => x.id === l.id))))];
let relSub = null, relDayWatched = "";
function watchReleasedToday(){
  if (!db) return;
  if (relSub) relSub();
  relDayWatched = dayKey(Date.now());
  relSub = db.collection("samples").where("relDay", "==", relDayWatched).onSnapshot(snap => {
    releasedToday.clear(); snap.docs.forEach(d => { const x = d.data(); if (x?.id) releasedToday.set(x.id, x); });
    if (tab === "board") renderBoard();
  }, () => {});
}
const hash = decodeURIComponent((location.hash || "").slice(1));
if (hash) { $("#lookupInput").value = hash; current = { id: hash, body: null, loading: true }; tab = "track"; }
else tab = lsGet("session") ? "board" : "submit";
resolveSession();
setTab(tab);

(async () => {
  if (!window.claude?.use){ setSync("off"); if (current) current = { id: current.id, body: null, missing: true }; renderTab(); return; }
  [db, user] = await Promise.all([claude.use("db"), claude.use("user")]);
  if (user) canWrite = await user.can("data.write");
  if (!db){ setSync("off"); if (current) current = { id: current.id, body: null, missing: true }; renderTab(); return; }
  db.doc("settings/stages").onSnapshot(snap => {
    if (snap.exists){
      const d = snap.data();
      const users = Array.isArray(d.users) && d.users.length ? clone(d.users) : clone(DEFAULT_CONFIG.users);
      // The supervisor role arrived in version 10: settings saved earlier get the demo supervisor account.
      if (!(d.schema >= 10) && !users.some(x => x.role === "super")) users.splice(1, 0, clone(DEFAULT_CONFIG.users.find(x => x.role === "super")));
      // Section accounts arrived in version 12.
      if (!(d.schema >= 12)) DEFAULT_CONFIG.users.filter(x => x.role === "section" && !users.some(y => y.u === x.u)).forEach(x => users.push(clone(x)));
      cfg = {
        routes: mergeRoutes(d.routes, d.removed), removed: Array.isArray(d.removed) ? d.removed.slice() : [],
        sections: Array.isArray(d.sections) && d.sections.length ? clone(d.sections) : clone(DEFAULT_CONFIG.sections),
        users, tz: d.tz && tzOk(d.tz) ? d.tz : DEFAULT_CONFIG.tz,
        limits: Array.isArray(d.limits) ? newLimits(d.limits, d.limitsV) : clone(DEFAULT_CONFIG.limits), routeUse: isMap(d.routeUse) ? clone(d.routeUse) : {}, depts: Array.isArray(d.depts) && d.depts.length ? clone(d.depts) : clone(DEFAULT_CONFIG.depts), resultsPublic: !!d.resultsPublic, relMode: d.relMode === "signoff" ? "signoff" : "now", qcStep: !!d.qcStep, work: workOf(d.work), logo: logoOf(d.logo),
        cols: Array.isArray(d.cols) ? clone(d.cols) : []
      };
    }
    if (!draftDirty) draft = null;          // someone else's save shows up unless you have unsaved edits
    else if (tab === "stages") toast("Someone else just saved settings. Discard your changes to see theirs.");
    refreshRegisterOptions();
    showLogo();
    if (session) updateChrome();
    const before = session && JSON.stringify(session);
    resolveSession();                       // an admin may have changed this account's role, password or removed it
    if (before && before !== JSON.stringify(session)){ $("#view-register").innerHTML = ""; if (!session) toast("Your account was changed by an admin. Please sign in again."); setTab(tab); }
    refreshFormRoute();
    if (tab === "routes" && !$("#view-routes").contains(document.activeElement)) renderRoutes();
    if (tab === "stages" && !draftDirty && !$("#view-stages").contains(document.activeElement) && !document.getElementById("cfgRestoreBox")) renderStages();
    if (tab === "track") renderTrack();
    if (tab === "login") renderLogin();
    rerenderSoon();
  }, () => {});
  db.collection("samples").where("lab", "==", true).onSnapshot(snap => {
    samples.clear(); snap.docs.forEach(d => { const x = d.data(); if (x && x.id) samples.set(x.id, x); });
    setSync(snap.metadata.hasPendingWrites ? "saving" : snap.metadata.fromCache ? "stale" : "live");
    rerenderSoon();
  }, () => { setSync("off"); toast("Lost connection to the register. Reload the page."); });
  watchReleasedToday();
  watchSectionResults(); resultsBadge(); watchStoreDue();
  watchReq(); watchStaffResults(); watchConf();
  if (current) openSample(current.id); else renderTab();
  if (!session && (tab === "login" || tab === "register")) renderTab();
  setTimeout(maintenance, 1500);
  setInterval(maintenance, 5 * 60000);
  setInterval(() => {
    if (dayKey(Date.now()) !== relDayWatched) watchReleasedToday();
    watchStoreDue();
    if (tab === "board") renderBoard();
    else if (tab === "track" && !typingIn("#view-track")) renderTrack();
  }, 60000);
})();
