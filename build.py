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
  v.innerHTML = `<div class="panel stack" id="loginForm" style="max-width:520px">
      <h2>Staff sign in</h2>
      ${m.signedIn && !session ? `<div class="notice warn">Signed in as <b>${esc(m.email)}</b>: no access yet. Ask the lab manager to add this email on the Settings tab. <a href="/.auth/logout?post_logout_redirect_uri=%2F">Use a different account</a></div>` : ""}
      <div class="row"><a class="btn primary big" id="msSignIn" href="/.auth/login/aad?post_login_redirect_uri=${back}">Sign in with Microsoft</a></div>
    </div>`;
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
put('''\n    <div class="mock"><b>Design prototype.</b><span>Passwords here are visible to anyone who opens the page. The real system should store hashed passwords on a server or use the company's existing staff sign-in.</span></div>''',
    '')
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
drop('''      Every sample gets an ID like <span class="mono">${esc(exampleId())}</span> when it is submitted: the section that sent it, the submission date, then a running number. You can also type the sample's tag number or scan its label.''')
drop('''      Type it above to see the sample type, who submitted it, the test and its workflow route, the current stage and when results are expected.''')
drop('''<p class="small muted" style="margin:0">The tag number or site reference is on more than one sample. Pick the one you want.</p>''')
put('''""}. Based on the route's step times; queues can add to it.</div>''', '''""}</div>''')
put('''${session ? "You can view this sample. Only lab staff can update it." : "Only lab staff update samples. <button class='btn ghost small' data-goto='login'>Staff sign in</button>"}''',
    '''${session ? "View only." : "<button class='btn ghost small' data-goto='login'>Staff sign in</button>"}''')
put('''.${(s.materials || []).length ? " A lab supervisor can reverse a material movement recorded by mistake, under Retained material." : ""}</p>''', '''.</p>''')
drop('''<p class="small muted" style="margin:0">Returned or disposed material goes in the ledger as received, then sent out, so the counts balance. Put the reason in the note above.</p>''')
put('''Sends the sample back to <b>${esc(p[ri].name)}</b> and moves the expected finish out. The note is saved with it.${curIdx(s) >= targetIdx(s) ? " Results already released stay on record; the repeat is reported as an amendment." : ""}''',
    '''Back to <b>${esc(p[ri].name)}</b>.${curIdx(s) >= targetIdx(s) ? " The repeat is reported as an amendment." : ""}''')
drop('''<p class="small muted" style="margin:0">A correction never adds a ledger movement. ${canApprove() ? "Skipped steps stay on the record as skipped, with the reason. A skip can't reach or pass QA/QC or the release of results." : "Only a lab supervisor can skip steps."}</p>''')
drop('''<p class="small muted" style="margin:0">Only routes that perform the chosen test are listed. Steps already done stay in the chain of custody; the sample carries on from the same step in the new route if it has one.</p>''')
drop('''<p class="small muted" style="margin:0">Writes an outbound ledger movement and closes the sample.</p>''')
put('''. Put the retained material away and record returns or disposal under <b>Retained material</b>; each material has its own retention date.</p>''', '''.</p>''')
drop('''<p class="small muted" style="margin:0">Each material is kept for its own period from the release of results, then returned or disposed. Every return, disposal or send-out is written to the ledger.</p>''')
put('''Describe it in the note; it is printed on the record.</div>''', '''Describe it in the note.</div>''')
put('''. The lab sends them to the submitting section; ask the MET Lab for the certificate. A copy you hold is genuine if its number and check code match these.</p>''', '''.</p>''')
put('''.join(", ")}. They stay on record.</div>''', '''.join(", ")}.</div>''')
put(''' : "Type each result."} Use <b>&lt;DL</b> when a result is below the detection limit. The dot is the decimal mark; a number such as 1,500 is refused because it could mean 1500 or 1.5.</p>''',
    ''' : ""} Use <b>&lt;DL</b> below the detection limit; the dot is the decimal mark.</p>''')
put('''For a transcription or calculation error only. A result that needs re-testing goes back for re-assay instead. The corrected results go through the same range, check and limit tests as a first release, and another lab supervisor or the lab manager approves them before ${esc(last.no)} is replaced. ${esc(last.no)} stays on record.''',
    '''For transcription or calculation errors only.''')

# Empty screens: the heading says it; the sentence under it went.
put('''
      Check the ID on the bag or submission form. IDs look like <span class="mono">${esc(exampleId())}</span>: section code, submission date, running number. Tag numbers and site references are searched too.''', '''
      Check the ID on the bag.''')
put('''<strong>No open samples</strong>Submitted samples appear here until all their material has left the lab, grouped by where they are, with late ones flagged.''', '''<strong>No open samples</strong>''')
put('''<strong>View-only access</strong>Only lab staff register samples at the lab. Anyone can use Submit a sample.</div>''', '''<strong>View-only access</strong></div>''')
put('''</strong>Entries appear when samples are received at the lab or leave it.</div>''', '''</strong></div>''')
put('''<strong>No released results yet</strong>Certificates for ${esc(session.sec)} samples appear here as soon as the lab releases them.</div>''', '''<strong>No released results yet</strong></div>''')

# With its placeholder text gone, the route preview takes no space until there is a route to show.
put('@media (max-width:760px){.login-grid{grid-template-columns:minmax(0,1fr)}}',
    '@media (max-width:760px){.login-grid{grid-template-columns:minmax(0,1fr)}}\n#rRoute:empty{display:none}\na.btn{text-decoration:none}')

# Workflow board
put('''<div class="small">Open each sample, act as the limit says and record what was done and who was told. In the production system these also go out by email or SMS.</div>''', '')
put('''\n    <p class="small muted">Lanes group samples by where they are in their own route; each card shows the current step. Showing all ${samples.size} open samples: awaiting receipt, in the lab, or with material still in storage. Closed samples open by ID or tag. Times are ${esc(TZ() || "this device's")} time.</p>''', '')
put('''+${items.length - 40} more: use the filters or look a sample up by ID</div>''', '''+${items.length - 40} more</div>''')

# Submit a sample / Register at lab
put('''<p class="muted small" style="margin:4px 0 0">For samples brought straight to the lab without an online submission. The sample is recorded as received by you and written to the inbound ledger. Each sample gets an ID made of the section code, the date and a running number, like <span class="mono">${esc(exampleId("EXP"))}</span>, and follows the workflow route for its type and test.</p>''', '')
put('''<p class="muted small" style="margin:4px 0 0">No sign-in needed. Fill this in when you send samples to the MET Lab. You get the sample ID straight away: write it on the bag, or print the label, and use it to track progress. Each ID is the section code, the submission date and a running number, like <span class="mono">${esc(exampleId("EXP"))}</span>. The sample type and test decide its workflow and expected finish; a lab technician confirms receipt when it arrives.</p>''', '')
put('''<span class="small muted" style="font-weight:400">All ${TESTS.length} tests are in this list: the ones recommended for the sample type first, then every other test by category. <button type="button" class="btn ghost small" data-goto="routes">See all tests</button></span>''', '')
put('''\n    : `<div class="route-box"><div class="small muted">Choose the sample type, purpose and test to see the workflow this sample will follow and when results can be expected.</div></div>`;''', '''\n    : "";''')
put('''after the lab receives the sample (an estimate from the step times). ${(r.retention''', '''after receipt. ${(r.retention''')
put(''' Write ${n === 1 ? "this ID" : "these IDs"} on the sample bag${n === 1 ? "" : "s"}, or print the label${n === 1 ? "" : "s"}${lab ? "" : ", then bring or send the sample to the MET Lab. Its status shows “Awaiting receipt” until a lab technician confirms it has arrived"}:''',
    ''' Write ${n === 1 ? "this ID" : "these IDs"} on the bag${n === 1 ? "" : "s"} or print the label${n === 1 ? "" : "s"}:''')
put('''after the lab receives ${n === 1 ? "it" : "them"} (an estimate).</div>''', '''after receipt.</div>''')

# In / out ledger, Workflow routes
put('''in ${esc(f.month)}. A sample is written in once, when the lab receives it. Each retained material is written out when it is returned, disposed, sent to another lab or archived. Mistakes are reversed with a visible entry, never deleted. Times are ${esc(TZ() || "this device's")} time.</p>''', '''in ${esc(f.month)}.</p>''')
drop('''<p class="small muted" style="margin:0">Each sample follows the route for its sample type and the test requested. The route is picked automatically at submission and the lab technician confirms or changes it at receipt; only routes that perform the requested test can be chosen. Every route starts with <b>Submitted</b> and <b>Received &amp; logged</b>, and ends with <b>Results released</b> and retention in storage. Each retained material is then returned, sent out or disposed on its own date. Expected finish times add up the hours below and are estimates: queues can add to them.${isAdmin() ? " Admins edit routes on the Settings tab." : ""}</p>''')

# Settings
drop('''<div class="notice">Edit accounts, sections, the site time zone and workflow routes, then press Save settings. Changes apply for everyone.</div>''')
drop('''<p class="small muted" style="margin:0">Anyone can submit a sample without an account. Lab technicians confirm receipt, register walk-in samples and record stages; their name is filled in automatically as "Received by" and on every stage update. Lab supervisors also release results, approve skipped steps and reverse ledger movements recorded by mistake. Viewers can see the board and ledger but change nothing. A section account sees only the released results of its own section's samples, with a notice when new ones are ready. Anyone can look up a sample by ID without an account.</p>''')
drop('''<p class="small muted" style="margin:0">Sample IDs are the section code, the submission date and a running number, for example <span class="mono">${esc(exampleId((draft.sections[1] || draft.sections[0] || {code:"EXP"}).code))}</span>. Each section's number restarts at 0001 every day. Codes are 2 to 5 capital letters; changing a code only affects new samples.</p>''')
drop('''<p class="small muted" style="margin:0">Sample ID dates, ledger months and every time on screen use the site's time zone, whatever each phone or PC is set to. Use a name from the IANA list, such as Africa/Accra or Africa/Johannesburg.</p>''')
drop('''<p class="small muted" style="margin:0">A lab supervisor releases results with a numbered certificate of analysis. Corrections issue an amended certificate; earlier versions stay on record.</p>''')
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
drop('''<p class="small muted" style="margin:0">Samples are assayed in batches with reference materials (CRMs), blanks and duplicates placed by the route's QC rule. A sample joins one batch for each method its route uses (for example solution gold and solids gold), and every result a batch checks is judged on each QC position. The number of QC positions is fixed per batch, whatever its size (not per 20 samples). The QC is checked automatically when the results are saved, and a sample's results can't be released until each of its batches passes. Testwork and physical tests have their checks on each sample's results instead.</p>''')
put('''No samples are waiting for a batch. Samples join a batch after receipt and before QA/QC review.</p>''', '''No samples are waiting for a batch.</p>''')
put('''Up to ${np.size} samples. QC positions are added automatically.</span>''', '''Up to ${np.size} samples.</span>''')
drop('''<p class="small muted" style="margin:0">Every result for one reference material, oldest first, against the certified value each batch was judged on. Two results in a row beyond 2 SD on the same side make a batch a warning; nine in a row on one side of the certified value are flagged as a bias.</p>''')
put(''' in that order`} (separated by tabs, semicolons, commas or spaces; a unit after a value is ignored). A sample ID given twice fills the sample, then its duplicate. A first line of column names (for example <span class="mono">Sample, ${esc(ans.map(anShort).join(", "))}</span>) picks the columns by name. Use tabs or semicolons when values contain commas. Lines that match nothing are listed.</p>''',
    ''' in that order`}.</p>''')
put('''<span class="small muted">Each gets its own certificate.${mineHeld ? ` ${mineHeld} with results''', '''<span class="small muted">${mineHeld ? `${mineHeld} with results''')
put('''Certificates of analysis for samples your section submitted, newest first. ${fresh ?''', '''${fresh ?''')
put(''' : "Nothing new since you last looked."} In the production system this notice also goes to the section by email.</p>''', ''' : "Nothing new since you last looked."}</p>''')

# On Azure "quota_exceeded" means one record grew past what Cosmos DB holds (samples are never deleted).
put('toast("The register is full. Archive or delete old samples before adding more.");', 'toast("This record is too large to save. Tell the lab manager.");')

# 11. Settings: the lab manager can download a backup of every record (one JSON file), next to Save settings.
put('<span style="flex:1"></span><button class="btn ghost" id="cfgReset">',
    '<button class="btn ghost" id="cfgBackup">Download backup</button><span style="flex:1"></span><button class="btn ghost" id="cfgReset">')
put('''  const dirty = () => { draftDirty = true; renderStages(); };''',
    '''  const dirty = () => { draftDirty = true; renderStages(); };
  $("#cfgBackup").addEventListener("click", async e => {
    const b = e.currentTarget; b.disabled = true; b.textContent = "Preparing backup…";
    try { toast(`Backup downloaded: ${await window.__backup()} records`); }
    catch (err){ toast(err && err.code === "permission_denied" ? err.message || "Only the lab manager downloads backups." : "The backup could not be made. Try again."); }
    finally { b.disabled = false; b.textContent = "Download backup"; }
  });''')

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
page = SHELL_HEAD.replace('<meta charset="utf-8">', f'<meta charset="utf-8"><!-- Built by sample-tracking-azure/build.py from met-lab-sample-tracker.html (sha256 {src_hash}) -->', 1) + page + "</body></html>\n"
open(out, "w", encoding="utf-8").write(page)
print(f"{out}: {len(page)} bytes from {os.path.basename(SRC)} ({src_hash})")
