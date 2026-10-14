"""Builds app/index.html, the Azure version of the MET Lab Sample Tracker, from the published prototype page.

It reads ../sample-tracking/met-lab-sample-tracker.html (owned by the build thread; never edited here) and applies a short list
of patches: the page talks to /api through app/azure-shim.js, staff sign in with Microsoft, and accounts are matched by their
Microsoft sign-in email instead of demo passwords. Each patch must match exactly once, so a change in the prototype that
breaks one stops the build instead of producing a half-patched page.

    python3 build.py            # uses ../sample-tracking/met-lab-sample-tracker.html
    python3 build.py SOURCE.html
"""
import os, re, sys, json, hashlib

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", "sample-tracking", "met-lab-sample-tracker.html")
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

# 2. Header: this is the test system, and a Microsoft account without a role can still sign out.
put('<span class="pill" title="Design prototype">Prototype</span>', '<span class="pill" title="Test deployment on Azure: not yet the validated production system">Test system</span>')
put('$("#who").textContent = session ? `${session.name} · ${ROLES[session.role]}` : "Not signed in";',
    '$("#who").textContent = session ? `${session.name} · ${ROLES[session.role]}` : window.__me?.signedIn ? `${window.__me.email} · no access yet` : "Not signed in";')
put('$("#signBtn").hidden = !session;', '$("#signBtn").hidden = !session && !window.__me?.signedIn;')

# 3. Accounts: no passwords. Each account has a Microsoft sign-in email (em); the server matches the signed-in person to it.
put_re(r'  /\* Demo accounts for the prototype\. Admin changes them on the Settings tab\. NOT real security: anyone with the page can read them\. \*/\n',
       '  /* Example accounts. Until the lab manager saves Settings with real Microsoft sign-in emails, only the emails in the ADMIN_EMAILS app setting can sign in (as admin). */\n')
page, n = re.subn(r'(\n    \{ u: "[a-z0-9]+",[^\n]*?),\s+pw: "[a-z0-9]+" \}', r'\1 }', page)
assert n == 7, f"expected 7 example accounts, found {n}"

# 4. Session: from the Microsoft sign-in (window.__me, filled by the shim from /api/me), not from a stored password token.
put_re(r'function resolveSession\(\)\{\n.*?\n\}\n\$\("#signBtn"\)\.addEventListener\("click", \(\) => \{[^\n]*\n',
'''function resolveSession(){
  const m = window.__me;
  session = m && m.role ? { u: m.u, name: m.name, role: m.role, sec: m.role === "section" ? m.sec || "" : "" } : null;
  if (!allowedTabs().includes(tab)) tab = homeTab();
  updateChrome();
}
/* Called by the shim when the sign-in or the account's role changes (for example an admin edits it, or the sign-in expires). */
window.__resession = () => {
  const before = JSON.stringify(session);
  resolveSession();
  if (before === JSON.stringify(session)) return;
  $("#view-register").innerHTML = "";
  if (canEdit()) setTimeout(maintenance, 500);   // upgrades and ledger repairs need a lab staff account
  if (session && before === "null"){ toast(`Signed in as ${session.name}`); setTab(current ? "track" : homeTab()); return; }
  if (!session) toast(window.__me?.signedIn ? "Your account no longer has access. Ask the lab manager." : "You have been signed out. Sign in again to continue.");
  setTab(tab);
};
$("#signBtn").addEventListener("click", () => { location.href = "/.auth/logout?post_logout_redirect_uri=" + encodeURIComponent("/"); });
''')
put_re(r'/\* ---------- sign in ---------- \*/\nfunction renderLogin\(\)\{\n.*?\n\}\nfunction signIn\(u, pw\)\{\n.*?\n\}\n',
'''/* ---------- sign in: Microsoft account (Azure Static Web Apps authentication) ---------- */
function renderLogin(){
  const v = $("#view-login"), m = window.__me || {};
  const back = encodeURIComponent(location.pathname + location.hash);
  v.innerHTML = `<div class="login-grid">
    <div class="panel stack" id="loginForm">
      <div><h2>Staff sign in</h2><p class="small muted" style="margin:4px 0 0">Lab technicians sign in to confirm receipt of samples, record each stage, run lab batches and enter results. Lab supervisors also review batch QC, release results with a certificate and approve corrections. Admins manage workflow routes, sections and accounts. A section account (for example Exploration) sees the certificates for its own section's samples.</p></div>
      ${m.signedIn && !session ? `<div class="notice warn">You are signed in to Microsoft as <b>${esc(m.email)}</b>, but this account has not been given access yet. Ask the lab manager to add it on the Settings tab, then reload this page. <a href="/.auth/logout?post_logout_redirect_uri=%2F">Use a different account</a></div>` : ""}
      <div class="row"><a class="btn primary big" id="msSignIn" href="/.auth/login/aad?post_login_redirect_uri=${back}">Sign in with Microsoft</a></div>
      <p class="small muted" style="margin:0">No account is needed to submit a sample or follow one: use <button type="button" class="btn ghost small" data-goto="submit">Submit a sample</button> or type an ID or tag number in the box above.</p>
    </div>
    <div class="panel stack">
      <div class="mock"><b>Test system.</b><span>Staff sign in with their Microsoft account (work or personal). The lab manager gives each account its role on the Settings tab, using the email the person signs in with.</span></div>
    </div></div>`;
}
''')

# 5. Write errors: the server refuses changes a person's role does not allow.
put('''  if (e && e.code === "invalid_argument"){ canWrite = false; toast("This copy of the prototype is view-only for your claude.ai account, so changes can't be saved."); }''',
    '''  if (e && (e.code === "permission_denied" || e.code === "invalid_argument")) toast(e.message && e.message !== e.code ? e.message : "Your account can't make this change. Ask the lab manager if you need access.");''')
put('''e?.code === "invalid_argument" ? toast("This copy of the prototype is view-only for your claude.ai account, so settings can't be saved.") : toast("Could not save settings.");''',
    '''e?.code === "permission_denied" ? toast(e.message && e.message !== e.code ? e.message : "Only an admin can save settings.") : toast("Could not save settings.");''')

# 6. Settings > Staff accounts: a Microsoft sign-in email column instead of passwords.
put('''    <td><input class="inp mono" style="width:130px" data-ui="${i}" data-uf="pw" value="${esc(x.pw)}" aria-label="Password"></td>''',
    '''    <td><input class="inp mono" style="min-width:220px" type="email" data-ui="${i}" data-uf="em" value="${esc(x.em || "")}" placeholder="name@company.com" aria-label="Microsoft sign-in email"></td>''')
put('''<div class="mock"><b>Design prototype.</b><span>Passwords here are visible to anyone who opens the page. The real system should store hashed passwords on a server or use the company's existing staff sign-in.</span></div>''',
    '''<div class="mock"><b>Microsoft sign-in.</b><span>Each person signs in with the Microsoft account whose email is on their row (work, school or personal). An account without an email can't sign in. Only admins see these emails.</span></div>''')
put('<th>Username</th><th>Full name</th><th>Role</th><th>Section</th><th>Password</th><th></th>',
    '<th>Username</th><th>Full name</th><th>Role</th><th>Section</th><th>Microsoft sign-in email</th><th></th>')
put('''    if (f === "pw" && !val){ toast("A password cannot be empty."); renderStages(); return; }''',
    '''    if (f === "em"){
      val = val.toLowerCase();
      if (val && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(val)){ toast("Type the full email address the person signs in to Microsoft with."); renderStages(); return; }
      if (val && draft.users.some((y, j) => (y.em || "").toLowerCase() === val && j !== i)){ toast(`${val} is already on another account.`); renderStages(); return; }
    }''')
put('''draft.users.push({ u, name: "New lab technician", role: "tech", pw: "tech123" }); dirty();''',
    '''draft.users.push({ u, name: "New lab technician", role: "tech", em: "" }); dirty();''')
# The first admin signs in through ADMIN_EMAILS and is not on the list yet: put them on it so saving keeps their access.
put('''  draft.users = draft.users || [];\n''',
    '''  draft.users = draft.users || [];
  if (session?.role === "admin" && window.__me?.bootstrap && !draft.users.some(x => (x.em || "").toLowerCase() === window.__me.email)){
    let u = window.__me.email.split("@")[0].toLowerCase().replace(/[^a-z0-9._-]/g, "") || "admin"; while (draft.users.some(x => x.u === u)) u += "1";
    draft.users.unshift({ u, name: "Lab Manager", role: "admin", em: window.__me.email }); draftDirty = true;
  }
''')

# 7. Results the server withheld (certificate number and check code only) are shown as withheld, even for a moment
#    while a changed "who can see results" setting is still reaching this page.
put('const canSeeResults = s => isStaff() || (session?.role === "section" && !!s && s.section === session.sec) || !!cfg.resultsPublic;',
    'const canSeeResults = s => !(s?.certs || []).some(c => !c.an) && (isStaff() || (session?.role === "section" && !!s && s.section === session.sec) || !!cfg.resultsPublic);')

# 8. Boot: the first tab follows the Microsoft sign-in.
put('else tab = lsGet("session") ? "board" : "submit";', 'else tab = window.__me?.role ? "board" : "submit";')

out = os.path.join(HERE, "app", "index.html")
page = page.replace("<head>", f"<head>\n<!-- Built by sample-tracking-azure/build.py from met-lab-sample-tracker.html (sha256 {src_hash}) -->", 1)
open(out, "w", encoding="utf-8").write(page)
print(f"{out}: {len(page)} bytes from {os.path.basename(SRC)} ({src_hash})")
