
/* ---------- tabs ---------- */
function lsGet(k){ try { return localStorage.getItem(k) || ""; } catch { return ""; } }
function lsSet(k, v){ try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch {} }
function allowedTabs(){
  if (!session) return ["register", "track", "routes", "login"];
  const t = ROLE_TABS[session.role] || ["track"];
  return session.role === "viewer" && relNow() && !canEval() ? t.filter(x => x !== "batches") : t;   // QC lives on Lab batches: evaluators only, among viewers
}
/* Where a person lands: the board for lab staff, their results for a section account, the submission form when signed out. */
const homeTab = () => !session ? "register" : allowedTabs().includes("board") ? "board" : allowedTabs().includes("results") ? "results" : "track";
/* Tabs that don't fit go in the More menu (layoutNav, app15-j.js). */
function tabCue(){ layoutNav(); }
addEventListener("resize", tabCue);
function updateChrome(){
  const tabs = allowedTabs();
  document.querySelectorAll("#tabs button[data-tab]").forEach(b => { b.hidden = !tabs.includes(b.dataset.tab); b.style.order = !session && b.dataset.tab === "register" ? -1 : ""; });
  $("#who").textContent = session ? `${session.name} · ${ROLES[session.role]}` : "Not signed in";
  $("#signBtn").hidden = !session;
  watchSectionResults(); resultsBadge(); watchStoreDue(); watchBlinds(); watchReq(); watchStaffResults(); watchConf();
  tabCue();
}
/* Prototype only: the browser keeps the username and a fingerprint of the account, so a password or role change signs the person out. Real sign-in belongs on a server. */
function hashStr(s){ let h = 0x811c9dc5; for (const c of s){ h ^= c.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); }
const sessionToken = a => `${a.u}:${hashStr(`${a.u}|${a.pw}|${a.role}${a.sec ? "|" + a.sec : ""}`)}`;
const sessionOf = a => ({ u: a.u, name: a.name, role: a.role, sec: a.role === "section" ? a.sec || "" : "" });
function resolveSession(){
  const tok = lsGet("session"), u = tok.split(":")[0];
  const acct = u && (cfg.users || []).find(x => x.u === u && sessionToken(x) === tok);
  session = acct ? sessionOf(acct) : null;
  if (!session && tok) lsSet("session", "");
  if (!allowedTabs().includes(tab)) tab = homeTab();
  updateChrome();
}
$("#signBtn").addEventListener("click", () => { session = null; lsSet("session", ""); updateChrome(); setTab("login"); toast("Signed out"); });
function setTab(t){
  if (!allowedTabs().includes(t)) t = homeTab();
  closeCert();
  tab = t;
  document.querySelectorAll("#tabs button[data-tab]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.tab === t)));
  document.querySelectorAll("section.view").forEach(v => v.hidden = v.id !== "view-" + t);
  if (t !== "track") pageTitle("");
  if (t === "ledger") ledgerWatch();
  renderTab();
  tabCue();
}
$("#tabs").addEventListener("click", e => { const b = e.target.closest("button[data-tab]"); if (b) setTab(b.dataset.tab); });
function renderTab(){
  ({ login: renderLogin, track: renderTrack, board: renderBoard, submit: renderSubmit, register: renderRegister, batches: renderBatches, storage: renderStorage, results: renderResultsTab, ledger: renderLedger, routes: renderRoutes, stages: renderStages })[tab]();
  updateCount();
}
const updateCount = () => { $("#cntActive").textContent = unitCount([...samples.values()]); };   // v24d: a batch counts once

/* ---------- sign in ---------- */
function renderLogin(){
  const v = $("#view-login");
  if ($("#loginForm", v) && v.contains(document.activeElement)) return; // don't wipe what someone is typing
  const keepU = $("#lgUser", v)?.value || "";
  v.innerHTML = `<div class="login-grid">
    <form class="panel stack" id="loginForm" autocomplete="off">
      <div><h2>Staff sign in</h2><p class="small muted" style="margin:4px 0 0">Lab technicians sign in to confirm receipt of samples, record each stage, run lab batches and enter results. Lab supervisors also review batch QC, release results with a certificate and approve corrections. Admins manage workflow routes, sections and accounts. A section account (for example Exploration) sees the certificates for its own section's samples.</p></div>
      <label class="f"><span>Username</span><input id="lgUser" autocomplete="username" autocapitalize="none" spellcheck="false"></label>
      <label class="f"><span>Password</span><input id="lgPass" type="password" autocomplete="current-password"></label>
      <div class="row"><button class="btn primary big" type="submit">Sign in</button><span class="small" id="lgErr" style="color:var(--bad)"></span></div>
      <p class="small muted" style="margin:0">No account is needed to register a sample or follow one: use <button type="button" class="btn ghost small" data-goto="register">Register at lab</button> or type an ID or site sample code in the box above.</p>
    </form>
    <div class="panel stack">
      <div class="mock"><b>Design prototype.</b><span>These demo accounts and passwords are stored in the page and visible to anyone who opens it. The real system needs proper sign-in on its own server.</span></div>
      <h3>Demo accounts</h3>
      <div class="demo-list">${(cfg.users || []).slice(0, 12).map(x => `<div class="demo">
        <div><div class="role-chip">${esc(ROLES[x.role] || x.role)}</div><div><b>${esc(x.name)}</b></div>
          <div class="r">Username <code>${esc(x.u)}</code> · Password <code>${esc(x.pw)}</code></div></div>
        <button class="btn" type="button" data-demo="${esc(x.u)}">Use</button></div>`).join("")}</div>
    </div></div>`;
  $("#lgUser").value = keepU;
  $("#loginForm").addEventListener("submit", e => { e.preventDefault(); signIn($("#lgUser").value, $("#lgPass").value); });
  v.querySelectorAll("[data-demo]").forEach(b => b.onclick = () => {
    const acct = (cfg.users || []).find(x => x.u === b.dataset.demo);
    if (acct){ $("#lgUser").value = acct.u; $("#lgPass").value = acct.pw; $("#lgPass").focus(); }
  });
}
function signIn(u, pw){
  u = String(u || "").trim().toLowerCase();
  const acct = (cfg.users || []).find(x => x.u.toLowerCase() === u && x.pw === pw);
  if (!acct){ $("#lgErr").textContent = "Username or password is wrong."; return; }
  session = sessionOf(acct);
  lsSet("session", sessionToken(acct));
  updateChrome();
  toast(`Signed in as ${acct.name}`);
  setTab(current ? "track" : homeTab());
}

/* ---------- lookup: by ID, site sample code (stored as tags), site reference or a scanned tracking link ---------- */
$("#lookupForm").addEventListener("submit", e => { e.preventDefault(); openSample($("#lookupInput").value); });
document.addEventListener("click", e => { const b = e.target.closest("[data-open]"); if (b){ e.preventDefault(); openSample(b.dataset.open); } });
/* Re-assay from the Ledger or Storage: the sample's record opens at its re-assay box. */
let reassayAsk = "";
document.addEventListener("click", e => { const b = e.target.closest("[data-reassay]"); if (b){ e.preventDefault(); reassayAsk = b.dataset.reassay; openSample(reassayAsk); } });
let openSeq = 0;
/* Tags are searched in the shared register itself, so a tag works from a link even for samples this view has not loaded. */
async function findByTag(text){
  const T = normTag(text), hits = new Set();
  if (!db || !T) return [];
  try { const s = await db.doc("tagidx/" + tagKey(T)).get(); if (s.exists && s.data()?.sid) hits.add(s.data().sid); } catch {}
  try { (await db.collection("samples").where("tags", "array-contains", T).limit(25).get()).docs.forEach(d => { const x = d.data(); if (x?.id) hits.add(x.id); }); } catch {}
  try { (await db.collection("samples").where("siteRefU", "==", T).limit(25).get()).docs.forEach(d => { const x = d.data(); if (x?.id) hits.add(x.id); }); } catch {}
  return [...hits].sort();
}
async function openSample(raw){
  closeCert();
  let text = String(raw || "").trim(); if (!text) return;
  const hp = text.indexOf("#"); if (/^https?:\/\//i.test(text) && hp >= 0){ try { text = decodeURIComponent(text.slice(hp + 1)).trim(); } catch { text = text.slice(hp + 1).trim(); } if (!text) return; }
  const id = idFromText(text), seq = ++openSeq;
  if (unsubCurrent){ unsubCurrent(); unsubCurrent = null; }
  if (id) return watchSample(id, text);
  $("#lookupInput").value = text;
  current = { id: text, body: null, loading: true, search: true };
  setTab("track");
  if (/^B-/i.test(text) && await watchBatchRef(text, seq)) return;
  if (seq !== openSeq) return;
  // v24d (20 Oct): a job's sample has the plant's code as its ID (MLNSCOF 20261018, or MLDSCBRG20261018-2 for a second analysis)
  if (db){ try { const d = await db.doc("samples/" + skey(normTag(text))).get(); if (seq !== openSeq) return; if (d.exists && d.data()?.id) return watchSample(d.data().id, ""); } catch {} }
  if (seq !== openSeq) return;
  const hits = await findByTag(text);
  if (seq !== openSeq) return;
  if (hits.length === 1) return watchSample(hits[0], "");
  current = hits.length ? { id: text, matches: hits } : { id: text, body: null, missing: true, search: true };
  renderTrack();
}
function watchSample(id, text){
  const seq = openSeq;
  $("#lookupInput").value = id;
  try { history.replaceState(null, "", "#" + encodeURIComponent(id)); } catch {}
  current = { id, body: samples.get(id) || null, missing: false, loading: !samples.has(id) };
  setTab("track");
  if (!db) return;
  let ref;
  try { ref = db.doc("samples/" + skey(id)); } catch { current = { id, body: null, missing: true }; renderTrack(); return; }
  let first = true;
  unsubCurrent = ref.onSnapshot(async snap => {
    if (!current || current.id !== id || seq !== openSeq) return;
    const body = snap.exists && snap.data()?.id ? snap.data() : null;
    if (!body && first && text){            // looked like an ID but isn't one: try it as a tag
      first = false;
      const hits = (await findByTag(text)).filter(x => x !== id);
      if (seq !== openSeq) return;
      if (hits.length === 1) return watchSample(hits[0], "");   // a hit is a sample's ID: open it as it is (never read as text again, which could go round)
      if (hits.length){ current = { id: text, matches: hits }; renderTrack(); return; }
    }
    first = false;
    current = { id, body, missing: !body, loading: false };
    if (tab === "track") renderTrack();
  }, () => {});
}
