"""Builds app/index.html, the Azure version of the Assay Lab Sample Tracker, from the published prototype page.

It reads ../sample-tracking/assay-lab-sample-tracker.html (owned by the build thread; never edited here) and applies a short list
of patches: the page talks to /api through app/azure-shim.js, staff sign in with Microsoft, and accounts are matched by their
Microsoft sign-in email instead of demo passwords. Each patch must match exactly once, so a change in the prototype that
breaks one stops the build instead of producing a half-patched page.

    python3 build.py            # uses ../sample-tracking/assay-lab-sample-tracker.html
    python3 build.py SOURCE.html
"""
import os, re, sys, json, hashlib

HERE = os.path.dirname(os.path.abspath(__file__))
# The prototype: ../sample-tracking in the project folder, or prototype/ in the GitHub repository.
PROTO = next((d for d in (os.path.join(HERE, "prototype"), os.path.join(HERE, "..", "sample-tracking")) if os.path.isdir(d)), os.path.join(HERE, "..", "sample-tracking"))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(PROTO, "assay-lab-sample-tracker.html")
page = open(SRC, encoding="utf-8").read()
src_hash = hashlib.sha256(page.encode()).hexdigest()[:12]

def put(old, new, count=1):
    global page
    n = page.count(old)
    assert n == count, f"expected {count} match(es), found {n}: {old[:90]!r}"
    page = page.replace(old, new)

def put_re(pattern, new, flags=re.S):
    global page
    found = re.findall(pattern, page, flags)
    assert len(found) == 1, f"expected 1 match, found {len(found)}: {pattern[:90]!r}"
    page = re.sub(pattern, lambda m: new, page, count=1, flags=flags)

# 1. Start the app after the shim knows who is signed in.
put('<script>\n(() => {\n"use strict";\nconst SHARE_URL = "https://claude.ai/artifact/5JgoyE2wokT67u8TCtYDop";',
    '<script src="azure-shim.js"></script>\n<script>\nwindow.__startApp = () => {\n"use strict";\n/* Tracking links point at this site. */\nconst SHARE_URL = location.origin + "/";')
assert page.endswith("})();\n})();\n</script>\n"), "unexpected end of page script"
page = page[: -len("})();\n</script>\n")] + "};\n</script>\n"

put('''function setTab(t){
  if (!allowedTabs().includes(t)) t = homeTab();
  closeCert();
  tab = t;''', '''function setTab(t){
  if (!allowedTabs().includes(t)) t = homeTab();
  closeCert();
  tab = t; shownFor = JSON.stringify(session);''')

# 2. Header: this is the test system, and a Microsoft account without a role can still sign out.
put('<span class="pill" title="Design prototype">Prototype</span>', '<span class="pill" title="Test deployment on Azure: not yet the validated production system">Test system</span>')
put('$("#who").textContent = session ? `${session.name} · ${ROLES[session.role]}` : "Not signed in";',
    '$("#who").textContent = session ? `${session.name} · ${ROLES[session.role]}` : window.__me?.signedIn ? `${window.__me.email} · no access yet` : "Not signed in";')
put('$("#signBtn").hidden = !session;', '$("#signBtn").hidden = !session && !window.__me?.signedIn;\n  $("#pwBtn").hidden = !(session && window.__me?.via === "email");')
put('<button class="btn" id="signBtn" type="button" hidden>Sign out</button>', '<button class="btn" id="pwBtn" type="button" hidden>Password</button><button class="btn" id="signBtn" type="button" hidden>Sign out</button>')

# 3. Accounts: no passwords. Each account has a Microsoft sign-in email (em); the server matches the signed-in person to it.
put_re(r'  /\* Demo accounts for the prototype\. Admin changes them on the Settings tab\. NOT real security: anyone with the page can read them\. \*/\n',
       '  /* Example accounts. Until the lab manager saves Settings with real Microsoft sign-in emails, only the emails in the ADMIN_EMAILS app setting can sign in (as admin). */\n')
page, n = re.subn(r'(\n    \{ u: "[a-z0-9]+",[^\n]*?),\s+pw: "[a-z0-9]+" \}', r'\1 }', page)
assert n == 8, f"expected 8 example accounts, found {n}"

# 4. Session: from the Microsoft sign-in (window.__me, filled by the shim from /api/me), not from a stored password token.
put_re(r'function resolveSession\(\)\{\n.*?\n\}\n\$\("#signBtn"\)\.addEventListener\("click", \(\) => \{[^\n]*\n',
'''function resolveSession(){
  const m = window.__me;
  session = m && m.role ? { u: m.u, name: m.name, role: m.role, sec: m.role === "section" ? m.sec || "" : "" } : null;
  if (!allowedTabs().includes(tab)) tab = homeTab();
  updateChrome();
}
/* Called by the shim when the sign-in or the account's role changes (for example an admin edits it, or the sign-in expires).
   It compares with the account the open view was drawn for (setTab keeps it), not with `session`: the Settings listener may
   already have picked up the new sign-in while the sign-in form is still on screen. */
var shownFor = "null";
window.__resession = () => {
  const before = shownFor;
  resolveSession();
  if (before === JSON.stringify(session)) return;
  $("#view-register").innerHTML = "";
  if (canEdit()) setTimeout(maintenance, 500);   // upgrades and ledger repairs need a lab staff account
  if (session && before === "null"){ toast(`Signed in as ${session.name}`); setTab(current ? "track" : homeTab()); return; }
  if (!session) toast(window.__me?.signedIn ? "Your account no longer has access. Ask the lab manager." : "You have been signed out. Sign in again to continue.");
  setTab(tab);
};
$("#signBtn").addEventListener("click", () => signOut());
$("#pwBtn").addEventListener("click", () => pwDialog());
''')
put_re(r'/\* ---------- sign in ---------- \*/\nfunction renderLogin\(\)\{\n.*?\n\}\nfunction signIn\(u, pw\)\{\n.*?\n\}\n',
'''/* ---------- sign in: a Microsoft account (Azure Static Web Apps authentication) or this site's own email login (/api/auth) ---------- */
let loginMode = "in", loginEmail = false;
async function authCall(body){
  let r, j = {};
  try { r = await fetch("/api/auth", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); j = await r.json(); }
  catch { throw new Error("Could not reach the server. Try again."); }
  if (!r.ok || j.error) throw new Error(j.error?.message || "Could not reach the server. Try again.");
  return j;
}
async function signOut(){
  if (window.__me?.via === "email"){ try { await authCall({ op: "signout" }); } catch {} location.href = "/"; }
  else location.href = "/.auth/logout?post_logout_redirect_uri=" + encodeURIComponent("/");
}
/* After an email sign-in, sign-up or password change: the page takes the new sign-in from /api/me. */
async function afterAuth(){ await window.__refreshMe(); if (!session && tab === "login") renderLogin(); }
const pwFields = cur => `${cur ? `<label class="f"><span>${cur}</span><input type="password" id="pwCur" autocomplete="current-password"></label>` : ""}
  <label class="f"><span>New password <span class="req">*</span></span><input type="password" id="pwNew" minlength="10" maxlength="200" autocomplete="new-password"></label>
  <label class="f"><span>Confirm new password <span class="req">*</span></span><input type="password" id="pwNew2" maxlength="200" autocomplete="new-password"></label>`;
function bindPwForm(root, done){
  $("#pwSave", root).onclick = async () => {
    const cur = $("#pwCur", root).value, next = $("#pwNew", root).value;
    if (next.length < 10){ toast("Use at least 10 characters for the password."); return; }
    if (next !== $("#pwNew2", root).value){ toast("The new passwords don't match."); return; }
    $("#pwSave", root).disabled = true;
    try { await authCall({ op: "password", current: cur, next }); toast("Password changed."); if (done) done(); await afterAuth(); }
    catch (e){ toast(e.message); $("#pwSave", root).disabled = false; }
  };
}
function pwDialog(){
  let d = $("#pwDlg");
  if (!d){ d = document.createElement("dialog"); d.id = "pwDlg"; d.className = "panel"; d.style.cssText = "max-width:440px;width:calc(100% - 32px);color:var(--ink)"; document.body.appendChild(d); }
  d.innerHTML = `<div class="stack"><h2>Change password</h2>${pwFields("Current password")}
    <div class="row"><button class="btn primary" type="button" id="pwSave">Save password</button><button class="btn ghost" type="button" id="pwClose">Cancel</button></div></div>`;
  $("#pwClose", d).onclick = () => d.close();
  bindPwForm(d, () => d.close());
  d.showModal();
}
function renderLogin(){
  const v = $("#view-login"), m = window.__me || {};
  const back = encodeURIComponent(location.pathname + location.hash), ms = `/.auth/login/aad?post_login_redirect_uri=${back}`;
  if (m.signedIn && m.mustChange){   // signed in with a temporary password from the lab manager
    v.innerHTML = `<div class="panel stack" style="max-width:520px"><h2>Choose a new password</h2>
      <div class="notice warn">Signed in as <b>${esc(m.email)}</b> with a temporary password.</div>${pwFields("Temporary password")}
      <div class="row"><button class="btn primary" type="button" id="pwSave">Save password</button><button class="btn ghost" type="button" id="pwOut">Sign out</button></div></div>`;
    bindPwForm(v); $("#pwOut").onclick = () => signOut();
    return;
  }
  if (m.signedIn && !session){
    v.innerHTML = `<div class="panel stack" id="loginForm" style="max-width:520px"><h2>Staff sign in</h2>
      <div class="notice warn">Signed in as <b>${esc(m.email)}</b>: no access yet. <button type="button" class="linkish" id="otherAcct">Use a different account</button></div><div id="accReq"></div></div>`;
    $("#otherAcct").onclick = e => { e.preventDefault(); signOut(); };
    renderAccessRequest();
    return;
  }
  const up = loginMode === "up", word = up ? "Sign up" : "Sign in";
  v.innerHTML = `<div class="panel stack" id="loginForm" style="max-width:520px">
      <nav class="tabs" role="tablist" style="margin-top:0"><button role="tab" type="button" data-lm="in" aria-selected="${!up}">Sign in</button><button role="tab" type="button" data-lm="up" aria-selected="${up}">Sign up</button></nav>
      <div class="row"><a class="btn ${loginEmail ? "" : "primary"} big" id="${up ? "msSignUp" : "msSignIn"}" ${loginEmail ? 'style="color:inherit"' : ""} href="${ms}">${word} with Microsoft</a>
        <button class="btn ${loginEmail ? "primary" : ""} big" type="button" id="${up ? "emSignUp" : "emSignIn"}">${word} with email</button></div>
      ${!loginEmail ? "" : up ? `<form class="stack" id="emForm" autocomplete="on" novalidate>
          <label class="f"><span>Full name <span class="req">*</span></span><input id="suName" maxlength="80" autocomplete="name" required></label>
          <label class="f"><span>Email <span class="req">*</span></span><input id="suEmail" type="email" maxlength="190" autocomplete="email" required></label>
          <label class="f"><span>Password <span class="req">*</span></span><input id="suPw" type="password" minlength="10" maxlength="200" autocomplete="new-password" required></label>
          <label class="f"><span>Confirm password <span class="req">*</span></span><input id="suPw2" type="password" maxlength="200" autocomplete="new-password" required></label>
          <label class="f"><span>Section or job</span><input id="suNote" maxlength="200"></label>
          <div class="row"><button class="btn primary" id="emGo">Sign up</button></div></form>`
        : `<form class="stack" id="emForm" autocomplete="on" novalidate>
          <label class="f"><span>Email</span><input id="siEmail" type="email" maxlength="190" autocomplete="username" required></label>
          <label class="f"><span>Password</span><input id="siPw" type="password" maxlength="200" autocomplete="current-password" required></label>
          <div class="row"><button class="btn primary" id="emGo">Sign in</button></div></form>`}
    </div>`;
  v.querySelectorAll("[data-lm]").forEach(b => b.onclick = () => { loginMode = b.dataset.lm; renderLogin(); });
  $(up ? "#emSignUp" : "#emSignIn").onclick = () => { loginEmail = true; renderLogin(); $(up ? "#suName" : "#siEmail")?.focus(); };
  const f = $("#emForm"); if (!f) return;
  f.onsubmit = async e => {
    e.preventDefault();
    let body;
    if (up){
      body = { op: "signup", name: $("#suName").value.trim(), email: $("#suEmail").value.trim(), password: $("#suPw").value, note: $("#suNote").value.trim() };
      if (!body.name){ toast("Type your full name."); return; }
      if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(body.email)){ toast("Type your full email address."); return; }
      if (body.password.length < 10){ toast("Use at least 10 characters for the password."); return; }
      if (body.password !== $("#suPw2").value){ toast("The passwords don't match."); return; }
    } else {
      body = { op: "signin", email: $("#siEmail").value.trim(), password: $("#siPw").value };
      if (!body.email || !body.password){ toast("Type your email and password."); return; }
    }
    $("#emGo").disabled = true;
    try { await authCall(body); loginEmail = false; await afterAuth(); }
    catch (err){ toast(err.message); const b = $("#emGo"); if (b) b.disabled = false; }
  };
}
/* ---------- access requests (access/<key of the email>): a Microsoft account without access asks the lab manager ---------- */
const accessKey = em => [...String(em || "").toLowerCase()].map(c => /[a-z0-9._-]/.test(c) ? c : "~" + c.codePointAt(0).toString(16) + "~").join("").slice(0, 190);
const reqKey = (em, via) => (via === "email" ? "email!" : "") + accessKey(em);
const sameReq = (a, b) => a.em === b.em && (a.via === "email") === (b.via === "email");
let myReq, myReqSub = null, myReqFor = "";
function renderAccessRequest(){
  const m = window.__me || {}, box = $("#accReq");
  if (!box || !db || !m.signedIn || session) return;
  if (myReqFor !== reqKey(m.email, m.via)){
    if (myReqSub) myReqSub();
    myReqFor = reqKey(m.email, m.via); myReq = undefined;
    myReqSub = db.doc("access/" + myReqFor).onSnapshot(snap => { myReq = snap.exists ? snap.data() : null; renderAccessRequest(); }, () => { myReq = null; renderAccessRequest(); });
  }
  if (myReq === undefined) return;
  if (myReq && myReq.status === "pending"){ box.innerHTML = `<div class="notice">Access requested ${esc(fmt(myReq.at))}</div>`; return; }
  if ($("#arSend", box)) return;   // keep what is being typed
  box.innerHTML = `<div class="stack">${myReq && myReq.status === "declined" ? `<div class="notice bad">Request declined ${esc(fmt(myReq.dt))}</div>` : ""}
      <label class="f"><span>Full name <span class="req">*</span></span><input id="arName" maxlength="80" autocomplete="name"></label>
      <label class="f"><span>Section or job</span><input id="arNote" maxlength="200"></label>
      <div class="row"><button class="btn primary" id="arSend">Request access</button></div></div>`;
  $("#arSend").onclick = async () => {
    const name = $("#arName").value.trim();
    if (!name){ toast("Type your full name."); return; }
    $("#arSend").disabled = true;
    try {
      await db.doc("access/" + reqKey(m.email, m.via)).set({ em: m.email, name, note: $("#arNote").value.trim(), at: Date.now(), status: "pending", ...(m.via === "email" ? { via: "email" } : {}) });
      box.innerHTML = ""; myReq = { status: "pending", at: Date.now() }; renderAccessRequest();
    }
    catch (e){ $("#arSend").disabled = false; writeFailed(e); }
  };
}
/* The lab manager's list of pending requests (Settings), with a count on the Settings tab. */
let accReqs = [], accShown = [], accSub = null;
function watchAccess(){
  if (!(db && session?.role === "admin")){ if (accSub){ accSub(); accSub = null; } accReqs = []; accBadge(); return; }
  if (accSub) return;
  accSub = db.collection("access").where("status", "==", "pending").onSnapshot(snap => {
    accReqs = snap.docs.map(d => d.data()).filter(r => r && r.em).sort((a, b) => (a.at || 0) - (b.at || 0));
    accBadge();
    const ae = document.activeElement;   // don't re-render under someone typing
    if (tab === "stages" && !($("#view-stages").contains(ae) && /^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName))) renderStages();
  }, () => {});
}
function accBadge(){ const t = $('#tabs [data-tab="stages"]'); if (t) t.textContent = accReqs.length ? `Settings (${accReqs.length})` : "Settings"; }
function accRows(){
  accShown = accReqs.slice();   // the rows as drawn, so a button always answers the request on its own row
  if (!accReqs.length) return "";
  return `<h2>Access requests</h2>
    <div class="tbl-wrap"><table><thead><tr><th>Full name</th><th>Sign-in email</th><th>Sign in with</th><th>Section or job</th><th>Requested</th><th>Role</th><th></th></tr></thead><tbody>${accReqs.map((r, i) => `<tr>
      <td>${esc(r.name)}</td><td class="mono">${esc(r.em)}</td><td>${r.via === "email" ? "Email" : "Microsoft"}</td><td>${esc(r.note || "")}</td><td style="white-space:nowrap">${esc(fmt(r.at))}</td>
      <td><select class="inp" style="width:auto" data-acc-role="${i}" aria-label="Role">${Object.entries(ROLES).map(([k, l]) => `<option value="${k}" ${k === "viewer" ? "selected" : ""}>${l}</option>`).join("")}</select></td>
      <td style="white-space:nowrap"><button class="btn primary" data-acc-ok="${i}">Approve</button> <button class="btn ghost danger" data-acc-no="${i}">Decline</button></td></tr>`).join("")}</tbody></table></div>`;
}
/* After Settings are saved: requests whose email is now on the staff list are marked approved, with the role given. */
function markAccessGiven(users){
  for (const r of accReqs){
    const x = users.find(y => (y.em || "").toLowerCase() === r.em.toLowerCase() && (y.via === "email") === (r.via === "email"));
    if (x) db.doc("access/" + reqKey(r.em, r.via)).update({ status: "approved", role: x.role, by: session.u, byName: session.name, dt: Date.now() }).catch(() => {});
  }
}
''')

# 5. Write errors: the server refuses changes a person's role does not allow.
put('''  if (e && e.code === "invalid_argument"){ canWrite = false; toast("This copy of the prototype is view-only for your claude.ai account, so changes can't be saved."); }''',
    '''  if (e && (e.code === "permission_denied" || e.code === "invalid_argument")) toast(e.message && e.message !== e.code ? e.message : "Your account can't make this change. Ask the lab manager if you need access.");''')
# Any other failure says what went wrong: the server's message or code, or the page's own error, so a report carries the cause.
put('''  else toast("Could not save. Check your connection and try again.");
}''', '''  else if (!e || (e.code === "unavailable" && !e.message)) toast("Could not save: no answer from the server. Check your connection and try again.");
  else toast(`Could not save (${String(e.message && e.message !== e.code ? e.message : e.code || e).slice(0, 160)}). Try again, or tell the lab manager.`);
}''')
put('''e?.code === "invalid_argument" ? toast("This copy of the prototype is view-only for your claude.ai account, so settings can't be saved.") : toast("Could not save settings.");''',
    '''e?.code === "permission_denied" ? toast(e.message && e.message !== e.code ? e.message : "Only an admin can save settings.") : toast("Could not save settings.");''')

# 6. Settings > Staff accounts: a Microsoft sign-in email column instead of passwords.
put('''    <td><input class="inp mono" style="width:130px" data-ui="${i}" data-uf="pw" value="${esc(x.pw)}" aria-label="Password"></td>''',
    '''    <td><input class="inp mono" style="min-width:220px" type="email" data-ui="${i}" data-uf="em" value="${esc(x.em || "")}" placeholder="name@company.com" aria-label="Sign-in email"></td>
    <td style="white-space:nowrap"><select class="inp" style="width:auto" data-ui="${i}" data-uf="via" aria-label="Sign in with"><option value="" ${x.via === "email" ? "" : "selected"}>Microsoft</option><option value="email" ${x.via === "email" ? "selected" : ""}>Email</option></select>${x.via === "email" && x.em ? ` <button class="btn ghost" type="button" data-pwreset="${i}">Reset password</button>` : ""}</td>''')
put('''\n    <div class="mock"><b>Design prototype.</b><span>Passwords here are visible to anyone who opens the page. The real system should store hashed passwords on a server or use the company's existing staff sign-in.</span></div>''',
    '')
put('<th>Username</th><th>Full name</th><th>Role</th><th>Department</th><th>Section</th><th>Password</th><th></th>',
    '<th>Username</th><th>Full name</th><th>Role</th><th>Department</th><th>Section</th><th>Sign-in email</th><th>Sign in with</th><th></th>')
put('''    if (f === "pw" && !val){ toast("A password cannot be empty."); renderStages(); return; }''',
    '''    if (f === "em"){
      val = val.toLowerCase();
      if (val && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(val)){ toast("Type the full email address the person signs in with."); renderStages(); return; }
    }
    if (f === "em" || f === "via"){
      const em = f === "em" ? val : (x.em || "").toLowerCase(), email = (f === "via" ? val : x.via) === "email";
      if (em && draft.users.some((y, j) => (y.em || "").toLowerCase() === em && (y.via === "email") === email && j !== i)){ toast(`${em} is already on another account.`); renderStages(); return; }
    }
    if (f === "via" && val !== "email"){ delete x.via; dirty(); return; }''')
put('''draft.users.push({ u, name: "New lab technician", role: "tech", pw: "tech123" }); dirty();''',
    '''draft.users.push({ u, name: "New lab technician", role: "tech", em: "" }); dirty();''')
# The first admin signs in through ADMIN_EMAILS and is not on the list yet: put them on it so saving keeps their access.
put('''  draft.users = draft.users || [];\n''',
    '''  draft.users = draft.users || [];
  const viaMe = window.__me?.via === "email";
  if (session?.role === "admin" && window.__me?.bootstrap && !draft.users.some(x => (x.em || "").toLowerCase() === window.__me.email && (x.via === "email") === viaMe)){
    let u = window.__me.email.split("@")[0].toLowerCase().replace(/[^a-z0-9._-]/g, "") || "admin"; while (draft.users.some(x => x.u === u)) u += "1";
    draft.users.unshift({ u, name: "Lab Manager", role: "admin", em: window.__me.email, ...(viaMe ? { via: "email" } : {}) }); draftDirty = true;
  }
''')

# 7. Results the server withheld (certificate number and check code only) are shown as withheld, even for a moment
#    while a changed "who can see results" setting is still reaching this page.
put('const canSeeResults = s => isStaff() || (session?.role === "section" && !!s && s.section === session.sec) || !!cfg.resultsPublic;',
    'const canSeeResults = s => !(s?.certs || []).some(c => !c.an) && (isStaff() || (session?.role === "section" && !!s && s.section === session.sec) || !!cfg.resultsPublic);')

# 8. Boot: the first tab follows the Microsoft sign-in.
put('else tab = lsGet("session") ? "board" : "submit";', 'else tab = window.__me?.role ? "board" : "submit";')

# 10. A working site, not a demonstration: the prototype's explanatory paragraphs (what each tab is for, how IDs are
#     made, how QC and routes work) are taken out. Labels, warnings, required-action notes, status lines, the receipt
#     checks, the example-value warnings (shortened) and each route's own description (the lab edits it in Settings) stay.
def drop(s):
    """Remove one piece of text; when it sits alone on its line, the line goes too."""
    global page
    pat = r'\n[ \t]*' + re.escape(s) + r'(?=\n)'
    n = len(re.findall(pat, page))
    if n == 1: page = re.sub(pat, lambda m: '', page)
    else: put(s, "")

# Sample record
drop('''<p class="small muted" style="margin:0">The site sample code or site reference is on more than one sample. Pick the one you want.</p>''')
put('''${session ? "You can view this sample. Only lab staff can update it." : "Only lab staff update samples. <button class='btn ghost small' data-goto='login'>Staff sign in</button>"}''',
    '''${session ? "View only." : "<button class='btn ghost small' data-goto='login'>Staff sign in</button>"}''')
put('''.${(s.materials || []).length ? " A lab supervisor can reverse a material movement recorded by mistake, under Retained material." : ""}</p>''', '''.</p>''')
drop('''<p class="small muted" style="margin:0">Returned or disposed material goes in the ledger as received, then sent out, so the counts balance. Put the reason in the note above.</p>''')
put('''Sends the sample back to <b>${esc(p[ri].name)}</b> and moves the expected finish out. The note is saved with it.${curIdx(s) >= targetIdx(s) ? " Results already released stay on record; the repeat is reported as an amendment." : ""}''',
    '''Back to <b>${esc(p[ri].name)}</b>.${curIdx(s) >= targetIdx(s) ? " The repeat is reported as an amendment." : ""}''')
drop('''<p class="small muted" style="margin:0">A correction never adds a ledger movement. ${canApprove() ? "Skipped steps stay on the record as skipped, with the reason. A skip can't reach or pass QA/QC or the release of results." : "Only a lab supervisor can skip steps."}</p>''')
drop('''<p class="small muted" style="margin:0">Only routes that perform the chosen test are listed. Steps already done stay in the chain of custody; the sample carries on from the same step in the new route if it has one.</p>''')
drop('''<p class="small muted" style="margin:0">Writes an outbound ledger movement and closes the sample.</p>''')
drop('''<p class="small muted" style="margin:0">Each material is kept for its own period from the release of results, then returned or disposed. Every return, disposal or send-out is written to the ledger.</p>''')
put('''Describe it in the note; it is printed on the record.</div>''', '''Describe it in the note.</div>''')
put('''. The lab sends them to the submitting section; ask the Assay Lab for the certificate. A copy you hold is genuine if its number and check code match these.</p>''', '''.</p>''')
put('''.join(", ")}. They stay on record.</div>''', '''.join(", ")}.</div>''')
put(''' : "Type each result."} Use <b>&lt;DL</b> when a result is below the detection limit. The dot is the decimal mark; a number such as 1,500 is refused because it could mean 1500 or 1.5.</p>''',
    ''' : ""} Use <b>&lt;DL</b> below the detection limit; the dot is the decimal mark.</p>''')
put('''For a transcription or calculation error only. A result that needs re-testing goes back for re-assay instead. The corrected results go through the same range, check and limit tests as a first release, and another lab supervisor or the lab manager approves them before ${esc(last.no)} is replaced. ${esc(last.no)} stays on record.''',
    '''For transcription or calculation errors only.''')

# Empty screens: the heading says it; the sentence under it went.
put('''
      Check the ID on the bag or submission form. IDs look like <span class="mono">${esc(exampleId())}</span>: section code, submission date, running number. Site sample codes and site references are searched too.''', '''
      Check the ID on the bag.''')
put('''</strong>Entries appear when samples are received at the lab or leave it.</div>''', '''</strong></div>''')
put('''<strong>No released results yet</strong>Certificates for ${esc(session.sec)} samples appear here as soon as the lab releases them.</div>''', '''<strong>No released results yet</strong></div>''')

# With its placeholder text gone, the route preview takes no space until there is a route to show.
put('@media (max-width:760px){.login-grid{grid-template-columns:minmax(0,1fr)}}',
    '@media (max-width:760px){.login-grid{grid-template-columns:minmax(0,1fr)}}\n#rRoute:empty{display:none}\na.btn{text-decoration:none}')

# Workflow board
put('''<div class="small">Open each sample, act as the limit says and record what was done and who was told. In the production system these also go out by email or SMS.</div>''', '')
put('''+${items.length - 40} more: use the filters or look a sample up by ID</div>''', '''+${items.length - 40} more</div>''')

# Submit a sample / Register at lab
put('''after the lab receives the sample (an estimate from the step times). ${(r.retention''', '''after receipt. ${(r.retention''')
put(''' Write ${n === 1 ? "this ID" : "these IDs"} on the sample bag${n === 1 ? "" : "s"}, or print the label${n === 1 ? "" : "s"}${lab ? ". Received now: on the Board under “Received & logged”" : walk ? ". It shows “Awaiting receipt” on the Board until a lab technician confirms it" : ", then bring or send the sample to the Assay Lab. It shows “Awaiting receipt” on the Board until a lab technician confirms it has arrived"}:''',
    ''' Write ${n === 1 ? "this ID" : "these IDs"} on the bag${n === 1 ? "" : "s"} or print the label${n === 1 ? "" : "s"}${lab ? " (received: on the Board under Received & logged)" : " (on the Board under Awaiting receipt until the lab receives it)"}:''')
put('''after the lab receives ${n === 1 ? "it" : "them"} (an estimate).</div>''', '''after receipt.</div>''')

# In / out ledger, Workflow routes
put('''in ${esc(f.month)}. Times are ${esc(TZ() || "this device's")} time.</p>''', '''in ${esc(f.month)}.</p>''')   # v24c: what the ledger is for now sits in its heading
drop('''<p class="small muted" style="margin:0">Each sample follows the route for its sample type and the test requested. The route is picked automatically at submission and the lab technician confirms or changes it at receipt; only routes that perform the requested test can be chosen. Every route starts with <b>Submitted</b> and <b>Received &amp; logged</b>, and ends with <b>Results released</b> and retention in storage. Each retained material is then returned, sent out or disposed on its own date. Expected finish times add up the hours below and are estimates: queues can add to them.${isAdmin() ? " Admins edit routes on the Settings tab." : ""}</p>''')

# Settings
drop('''<div class="notice">Edit accounts, sections, the site time zone and workflow routes, then press Save settings. Changes apply for everyone.</div>''')
drop('''<p class="small muted" style="margin:0">Anyone can register a sample at the lab without an account. Lab technicians confirm receipt, register walk-in samples and record stages; their name is filled in automatically as "Received by" and on every stage update. Lab supervisors also release results, approve skipped steps and reverse ledger movements recorded by mistake. Viewers can see the board and ledger but change nothing. A section account sees only the released results of its own section's samples, with a notice when new ones are ready. Anyone can look up a sample by ID without an account.</p>''')
drop('''<p class="small muted" style="margin:0">Sample IDs are the section code, the submission date and a running number, for example <span class="mono">${esc(exampleId((draft.sections[1] || draft.sections[0] || {code:"EXP"}).code))}</span>. Each section's number restarts at 0001 every day. Codes are 2 to 5 capital letters; changing a code only affects new samples.</p>''')
drop('''<p class="small muted" style="margin:0">Sample ID dates, ledger months and every time on screen use the site's time zone, whatever each phone or PC is set to. Use a name from the IANA list, such as Africa/Accra or Africa/Johannesburg.</p>''')
put('''<span>The certified values and standard deviations below are placeholders for the prototype. Replace them with the values on your own CRM certificates before relying on the QC checks.</span>''',
    '''<span>Replace them with the values on your CRM certificates.</span>''')
drop('''<p class="small muted" style="margin:0">A material certified for several results has one row per result under the same ID (type an existing ID in a new row). Lab batches pick reference materials for their analyte and unit, preferring those whose batch types list the batch's prefix (FA fire assay, GC grade control, FG gravimetric, SF screen fire assay, PL plant, PT tails, CC concentrate, BU bullion, SL solutions, EL eluate, CB carbon, CY and CS cyanide, EW water, IC ICP, ME multi-element, LE LECO, AR aqua regia, LW cyanide-soluble gold, SO soil, AB ARD, DN density). Leave batch types empty to allow any. A standard deviation is needed wherever the rule is in SD.</p>''')
put('''<span>The permit and guideline limits (marked Permit) are placeholders. Replace them with the limits in the site's environmental permit before go-live.</span>''',
    '''<span>Replace them with the limits in the site's permit.</span>''')
drop('''<p class="small muted" style="margin:0">A result past a limit raises an alert on the sample and on the board. The release waits until someone records what was done and who was told; the record is printed on the certificate. "Only when" limits a row to one sampling point.</p>''')
drop('''<p class="small muted" style="margin:0">A sample's route is chosen from its sample type, test and purpose when it is submitted. Changes apply to samples submitted after you save; samples already in the lab keep the steps they started with. Steps 1 and 2 (Submitted, Received &amp; logged) and the closing steps (Results released, storage, return or disposal) are shared by every route.</p>''')
drop('''${inUse ? `<p class="small muted" style="margin:0">${inUse} open sample(s) are on this route. They keep the steps, QA/QC rule and retention they started with.</p>` : ""}''')
put('''<span class="small muted" style="font-weight:400">${R.qcp ? "Written from the batch type, so it says what the batch enforces. Choosing another batch type or test rewrites it; you can add notes after it." : "Describe the checks. Only the checks built into the test's results are enforced."}</span>''', '')

# Lab batches, Results
put('''No samples are waiting for a batch. Samples join a batch after receipt and before QA/QC review.</p>''', '''No samples are waiting for a batch.</p>''')
put('''Up to ${np.size} samples. QC positions are added automatically.</span>''', '''Up to ${np.size} samples.</span>''')
put('''<span class="small muted">Each gets its own certificate.${mineHeld ? ` ${mineHeld} with results''', '''<span class="small muted">${mineHeld ? `${mineHeld} with results''')
put('''Certificates of analysis for samples your section submitted, newest first. ${fresh ?''', '''${fresh ?''')
put(''' : "Nothing new since you last looked."} In the production system this notice also goes to the section by email.</p>''', ''' : "Nothing new since you last looked."}</p>''')

# On Azure "quota_exceeded" means one record grew past what Cosmos DB holds (samples are never deleted).
put('toast("The register is full. Archive or delete old samples before adding more.");', 'toast("This record is too large to save. Tell the lab manager.");')

# 11. Settings: the lab manager can download a backup of every record (one JSON file), next to Save settings, and on a copy
#     of the site that has no samples yet, load one (Restore backup: the file's counts first, then the records).
put('<span style="flex:1"></span><button class="btn ghost" id="cfgReset">',
    '<button class="btn ghost" id="cfgBackup">Download backup</button><button class="btn ghost" id="cfgRestore" hidden>Restore backup</button><input type="file" id="cfgRestoreFile" accept=".json,application/json" hidden><span style="flex:1"></span><button class="btn ghost" id="cfgReset">')
put('''  const dirty = () => { draftDirty = true; renderStages(); };''',
    '''  const dirty = () => { draftDirty = true; renderStages(); };
  $("#cfgBackup").addEventListener("click", async e => {
    const b = e.currentTarget; b.disabled = true; b.textContent = "Preparing backup…";
    try { toast(`Backup downloaded: ${await window.__backup()} records`); }
    catch (err){ toast(err && err.code === "permission_denied" ? err.message || "Only the lab manager downloads backups." : "The backup could not be made. Try again."); }
    finally { b.disabled = false; b.textContent = "Download backup"; }
  });
  const rb = $("#cfgRestore"), rf = $("#cfgRestoreFile");
  window.__restoreState().then(r => { if (r && (r.empty || r.mine)) rb.hidden = false; });
  rb.addEventListener("click", () => rf.click());
  rf.addEventListener("change", async () => {
    const f = rf.files[0]; rf.value = ""; if (!f) return;
    let bk = null; try { bk = JSON.parse(await f.text()); } catch {}
    if (!bk || bk.app !== "Assay Lab Sample Tracker" || !bk.collections || typeof bk.collections !== "object"){ toast("That is not a backup file from this site."); return; }
    const n = c => Object.keys(bk.collections[c] || {}).length, total = Object.values(bk.collections).reduce((t, c) => t + Object.keys(c || {}).length, 0);
    const parts = [["samples", "Samples"], ["batches", "Lab batches"], ["ledger", "Ledger days"], ["stock", "Stock records"], ["files", "Results files"], ["blind", "Blind QA/QC checks"], ["access", "Access requests"], ["settings", "Settings"]];
    $("#cfgRestoreBox")?.remove();
    rb.parentElement.insertAdjacentHTML("afterend", `<div class="notice" id="cfgRestoreBox"><b>${esc(f.name)}</b>${bk.site ? ` · ${esc(bk.site)}` : ""}${Date.parse(bk.exportedAt) ? ` · ${esc(fmt(Date.parse(bk.exportedAt)))}` : ""}
      <div class="small" style="margin:6px 0" id="cfgRestoreCounts">${parts.map(([c, l]) => `${l} ${n(c).toLocaleString()}`).join(" · ")}</div>
      <div class="row"><button type="button" class="btn primary" id="cfgRestoreGo">Load ${total.toLocaleString()} records</button><button type="button" class="btn ghost" id="cfgRestoreNo">Cancel</button><span class="small muted" id="cfgRestoreMsg"></span></div></div>`);
    $("#cfgRestoreNo").onclick = () => $("#cfgRestoreBox")?.remove();
    $("#cfgRestoreGo").onclick = async e => {
      const go = e.currentTarget, msg = $("#cfgRestoreMsg"); go.disabled = true; $("#cfgRestoreNo").disabled = true;
      try {
        const k = await window.__restore(bk, (d, all) => { msg.textContent = `${d.toLocaleString()} of ${all.toLocaleString()}`; });
        msg.textContent = `${k.toLocaleString()} records loaded`; toast(`Backup restored: ${k.toLocaleString()} records`);
        setTimeout(() => location.reload(), 900);
      } catch (err){ go.disabled = false; $("#cfgRestoreNo").disabled = false; msg.textContent = ""; toast(err && err.message ? `Not restored: ${err.message}` : "The backup could not be loaded. Try again."); }
    };
  });''')

# 12. Access requests: the lab manager sees pending requests on Settings (count on the tab) and approves each with a role
#     (the account is added to the staff list and Settings are saved) or declines it. The server keeps the rules.
put('''  watchSectionResults(); resultsBadge(); watchStoreDue();''', '''  watchSectionResults(); resultsBadge(); watchStoreDue(); watchAccess();''', count=2)
put('''  v.innerHTML = `<div class="stack">

    <h2>Staff accounts</h2>''', '''  v.innerHTML = `<div class="stack">
    ${accRows()}
    <h2>Staff accounts</h2>''')
put('''  $("#userAdd").onclick = () => {''', '''  v.querySelectorAll("[data-acc-ok]").forEach(b => b.onclick = () => {
    const i = b.dataset.accOk, r = accShown[+i], role = v.querySelector(`[data-acc-role="${i}"]`).value;
    if (!r || !accReqs.some(x => sameReq(x, r))){ renderStages(); return; }
    const em = r.em.toLowerCase(), email = r.via === "email";
    if (!draft.users.some(x => (x.em || "").toLowerCase() === em && (x.via === "email") === email)){
      const base = em.split("@")[0].replace(/[^a-z0-9._-]/g, "") || "user"; let u = base, n = 1;
      while (draft.users.some(x => x.u === u)) u = base + n++;
      draft.users.push({ u, name: r.name, role, ...(role === "section" ? { sec: draft.sections[0]?.code || "" } : {}), em, ...(email ? { via: "email" } : {}) });
    }
    draftDirty = true;
    $("#cfgSave").click();
  });
  v.querySelectorAll("[data-acc-no]").forEach(b => b.onclick = async () => {
    const r = accShown[+b.dataset.accNo];
    if (!r || !accReqs.some(x => sameReq(x, r))){ renderStages(); return; }
    try { await db.doc("access/" + reqKey(r.em, r.via)).update({ status: "declined", by: session.u, byName: session.name, dt: Date.now() }); }
    catch (e){ writeFailed(e); }
  });
  v.querySelectorAll("[data-pwreset]").forEach(b => b.onclick = async () => {
    const x = draft.users[+b.dataset.pwreset]; if (!x || !x.em) return;
    try {
      const r = await authCall({ op: "reset", email: x.em });
      let d = $("#tmpDlg");
      if (!d){ d = document.createElement("dialog"); d.id = "tmpDlg"; d.className = "panel"; d.style.cssText = "max-width:440px;width:calc(100% - 32px);color:var(--ink)"; document.body.appendChild(d); }
      d.innerHTML = `<div class="stack"><h2>Temporary password</h2><div>${esc(x.em)}</div><div class="mono" style="font-size:22px;letter-spacing:1px">${esc(r.temp)}</div>
        <div class="row"><button class="btn primary" type="button" id="tmpClose">Done</button></div></div>`;
      $("#tmpClose", d).onclick = () => d.close();
      d.showModal();
    } catch (e){ toast(e.message); }
  });
  $("#userAdd").onclick = () => {''')
put('''      draftDirty = false; draft = null; renderStages();''', '''      draftDirty = false; draft = null; renderStages(); markAccessGiven(mine.users);''')
# v24c: the QR reader for browsers that can't read codes themselves is served from this site (app/jsqr.js), not a CDN.
put('''const JSQR_SRC = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";''', '''const JSQR_SRC = "jsqr.js";''')

out = os.path.join(HERE, "app", "index.html")
# 9. The document shell. On Claude the platform wraps the page in this shell (doctype, UTF-8, phone viewport, safe-area
#    padding, base styles); outside Claude the page must carry it itself, or phones show the desktop layout zoomed out and
#    the browser falls back to quirks mode. This is the same shell, plus a page icon.
assert page.startswith("<title>"), "unexpected start of page"
SHELL_HEAD = (
    '<!doctype html><html lang="en"><head><meta charset="utf-8">'
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
    '<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 32 32%27%3E%3Crect width=%2732%27 height=%2732%27 rx=%276%27 fill=%27%239a6b12%27/%3E%3Cpath d=%27M12 6h8v2h-1v6l6 10a2 2 0 0 1-2 3H9a2 2 0 0 1-2-3l6-10V8h-1z%27 fill=%27%23fff%27/%3E%3C/svg%3E">'
    '<style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}'
    'html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000}'
    'img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>\n'
)
page = SHELL_HEAD.replace('<meta charset="utf-8">', f'<meta charset="utf-8"><!-- Built by sample-tracking-azure/build.py from {os.path.basename(SRC)} (sha256 {src_hash}) -->', 1) + page + "</body></html>\n"
open(out, "w", encoding="utf-8").write(page)
print(f"{out}: {len(page)} bytes from {os.path.basename(SRC)} ({src_hash})")
