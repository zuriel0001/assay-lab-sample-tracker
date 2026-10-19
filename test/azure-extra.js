// Browser checks for what is new in the Azure build: Microsoft sign-in flow, the first admin, accounts by email,
// upgrades and repairs when staff sign in, and what the public sees. Run through run-suites.js (it provides harness.js):
//   node test/run-suites.js ../../sample-tracking-azure/test/azure-extra.js   (or copy next to harness.js)
const H = require("./harness");
const { store, newUser, signIn, launch, fillForm, ids, open, doc, errors, waitFor, toastText } = H;
let pass = 0, fail = 0;
const check = (ok, msg) => { if (ok){ pass++; console.log("  PASS", msg); } else { fail++; console.log("  FAIL", msg); } };
const log = t => console.log("• " + t);

(async () => {
  const now0 = Date.now(), DAY = 864e5;
  // A sample written by an earlier version, before anyone signs in.
  store["samples/EXP-20261001-0009"] = { id: "EXP-20261001-0009", type: "RC chips", purpose: "Exploration", submitter: "Old", section: "EXP", createdAt: now0 - 3 * DAY, stageKey: "received", stageAt: now0 - 2 * DAY,
    tagNo: "OLD-9", history: [{ key: "received", at: now0 - 2 * DAY, tech: "Old tech" }] };
  const browser = await launch();

  log("Public page");
  const P = await newUser(browser, { uid: "p", name: "Public" });
  await P.waitForTimeout(2000);
  check(!store["meta/schema"], "a page nobody is signed in to does not run the upgrade");
  check(await P.$eval("#who", e => e.textContent) === "Not signed in" && await P.$eval("#signBtn", e => e.hidden), "header: not signed in, no sign-out button");
  await P.click('[data-tab="login"]');
  const href = await P.$eval("#msSignIn", a => a.getAttribute("href"));
  check(/^\/\.auth\/login\/aad\?post_login_redirect_uri=/.test(href) && await P.textContent("#msSignIn") === "Sign in with Microsoft" && await P.textContent("#emSignIn") === "Sign in with email", "Sign in offers Microsoft (its sign-in page) or email");
  await P.click('[data-lm="up"]');
  check(/^\/\.auth\/login\/aad\?/.test(await P.$eval("#msSignUp", a => a.getAttribute("href"))) && await P.textContent("#emSignUp") === "Sign up with email", "Sign up offers Microsoft or email");
  check(!(await P.$("#lgPass")) && !/admin123/.test(await P.content()), "no password box and no demo passwords on the page");

  log("Staff sign-in and upgrade");
  const T = await newUser(browser, { uid: "t", name: "Tech" });
  await signIn(T, "tech1");
  check(await T.$eval("#who", e => e.textContent) === "Lab Technician A · Lab technician", "signed in as the technician account");
  check(!!(await waitFor(() => store["meta/schema"]?.v === 13, 6000)), "the upgrade runs when lab staff sign in");
  check(doc("EXP-20261001-0009").v === 13 && (doc("EXP-20261001-0009").tags || []).includes("OLD-9"), "the earlier record is upgraded");
  check(!!(await waitFor(() => doc("EXP-20261001-0009").lab === true && store["stock/EXP-20261001-0009"]?.st === "lab" && !doc("EXP-20261001-0009").sx, 6000)), "it is marked in the lab, with its stock record written");

  log("Public submission and lookup");
  await fillForm(P, "submit", { section: "EXP", submitter: "Ama", tags: "AZ-1" }); const [sid] = await ids(P);
  check(/^EXP-\d{8}-0001$/.test(sid) && doc(sid).createdBy === "public", `public submission gets ${sid}`);
  const link = await P.evaluate(() => document.querySelector("[data-link]")?.dataset.link);
  check(link === sid, "tracking link offered");
  store["samples/" + sid] = { ...doc(sid), results: { rows: { Au: { v: 2.5 } }, at: Date.now() }, certs: [{ no: sid + "-R1", v: 1, at: Date.now(), code: "K7Q2", rows: { Au: { v: 2.5 } } }] };
  await H.broadcast("samples/" + sid, store["samples/" + sid]);
  await open(P, sid);
  const pubText = await P.textContent("#view-track");
  check(pubText.includes(sid + "-R1") && pubText.includes("K7Q2") && !/2\.5/.test(await P.$eval("#resPanel", e => e.textContent).catch(() => "")), "public sees the certificate number and check code, not the values");
  const api = await P.evaluate(async id => (await (await fetch("/api/db", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ops: [{ op: "get", path: "samples/" + id }, { op: "query", coll: "samples", where: [["open", "==", true]] }, { op: "update", path: "samples/" + id, data: { stageKey: "released" } }] }) })).json()).results, sid);
  check(!api[0].data.results && api[1].docs.length === 0 && !api[2].ok, "the API itself hides results, lists nothing and refuses changes from the public");

  log("Accounts by Microsoft email");
  const A = await newUser(browser, { uid: "a", name: "Admin" });
  await signIn(A, "admin");
  await A.click('[data-tab="stages"]'); await A.waitForSelector('[data-uf="em"]');
  check((await A.$$('[data-uf="pw"]')).length === 0 && (await A.$$('[data-uf="em"]')).length >= 7, "Settings shows a Microsoft sign-in email per account, no passwords");
  const row = await A.$$eval('[data-uf="u"]', els => els.findIndex(e => e.value === "tech2"));
  await A.fill(`[data-ui="${row}"][data-uf="em"]`, "not an email"); await A.press(`[data-ui="${row}"][data-uf="em"]`, "Tab"); await A.waitForTimeout(150);
  check(/full email address/.test(await toastText(A)), "an invalid email is refused");
  await A.fill(`[data-ui="${row}"][data-uf="em"]`, "Kofi.Mensah@Example.com"); await A.press(`[data-ui="${row}"][data-uf="em"]`, "Tab"); await A.waitForTimeout(150);
  await A.click("#cfgSave"); await A.waitForTimeout(600);
  check((store["settings/stages"]?.users || []).find(x => x.u === "tech2")?.em === "kofi.mensah@example.com", "the email is saved, in lower case");
  await signIn(T, "Kofi.Mensah@example.com");
  check(await T.$eval("#who", e => e.textContent).then(t => t.startsWith("Lab Technician B")), "signing in with that Microsoft email gives that account");
  await signIn(T, "stranger@example.com");
  await T.waitForTimeout(300);
  const tw = await T.$eval("#who", e => e.textContent);
  check(/stranger@example\.com · no access yet/.test(tw) && !(await T.$eval("#signBtn", e => e.hidden)), "an unknown Microsoft account is signed in without access and can sign out");
  const techSees = await T.evaluate(async () => (await (await fetch("/api/db", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ops: [{ op: "get", path: "settings/stages" }] }) })).json()).results[0].data.users.length);
  check(techSees === 0, "an account without access sees no staff list");

  log("Request access");
  await T.click('[data-tab="login"]').catch(() => {});
  await T.waitForSelector("#arSend", { timeout: 5000 }).catch(() => {});
  check(/no access yet/.test(await T.textContent("#view-login")) && !!(await T.$("#arSend")), "it is offered Request access");
  await T.click("#arSend"); await T.waitForTimeout(200);
  check(/full name/i.test(await toastText(T)) && !store["access/stranger~40~example.com"], "a request needs the person's name");
  await T.fill("#arName", "Ama Stranger"); await T.fill("#arNote", "MET lab, sample prep");
  await T.click("#arSend");
  const rq = await waitFor(() => store["access/stranger~40~example.com"], 5000);
  check(rq?.status === "pending" && rq.em === "stranger@example.com" && rq.name === "Ama Stranger" && !rq.role, "the request is recorded, without a role");
  await T.waitForTimeout(300);
  check(/Access requested/.test(await T.textContent("#view-login")) && !(await T.$("#arSend")), "the page shows it was sent");
  check(!!(await A.waitForFunction(() => /^Settings \(1\)$/.test(document.querySelector('#tabs [data-tab="stages"]')?.textContent || ""), null, { timeout: 8000 }).catch(() => null)), "the lab manager sees the request on the Settings tab");
  await A.click('[data-tab="stages"]'); await A.waitForSelector('[data-acc-ok="0"]', { timeout: 5000 }).catch(() => {});
  check(/Ama Stranger/.test(await A.textContent("#view-stages")) && /MET lab, sample prep/.test(await A.textContent("#view-stages")), "Settings lists who asked and why");
  await A.selectOption('[data-acc-role="0"]', "tech");
  await A.click('[data-acc-ok="0"]');
  check(!!(await waitFor(() => (store["settings/stages"]?.users || []).some(x => x.em === "stranger@example.com" && x.role === "tech" && x.name === "Ama Stranger"), 5000)), "approving adds the account with the chosen role");
  check(!!(await waitFor(() => { const r = store["access/stranger~40~example.com"]; return r && r.status === "approved" && r.role === "tech" && r.by === "admin" && r.dt; }, 5000)), "the request is marked approved, with who approved it");
  check(!!(await T.waitForFunction(() => document.querySelector("#who")?.textContent === "Ama Stranger · Lab technician", null, { timeout: 10000 }).catch(() => null)), "the person is let in without signing in again");
  check(!!(await A.waitForFunction(() => document.querySelector('#tabs [data-tab="stages"]')?.textContent === "Settings" && !document.querySelector("[data-acc-ok]"), null, { timeout: 5000 }).catch(() => null)), "the request leaves the lab manager's list");
  await H.broadcast("access/x~40~example.com", { em: "x@example.com", name: "X Person", at: Date.now(), status: "pending" });
  await A.waitForSelector('[data-acc-no="0"]', { timeout: 5000 }).catch(() => {});
  await A.click('[data-acc-no="0"]').catch(() => {});
  check(!!(await waitFor(() => store["access/x~40~example.com"]?.status === "declined" && store["access/x~40~example.com"].by === "admin", 5000)) && !(store["settings/stages"].users || []).some(x => x.em === "x@example.com"), "declining records it and adds no account");

  log("Email sign-up and sign-in (no Microsoft account)");
  const E = await newUser(browser, { uid: "e", name: "Email" });
  const ek = "efua.owusu~40~gmail.com";
  await E.click('[data-tab="login"]'); await E.click('[data-lm="up"]'); await E.click("#emSignUp");
  await E.fill("#suName", "Efua Owusu"); await E.fill("#suEmail", "Efua.Owusu@gmail.com"); await E.fill("#suPw", "short"); await E.fill("#suPw2", "short"); await E.fill("#suNote", "Plant");
  await E.click("#emGo"); await E.waitForTimeout(250);
  check(/10 characters/.test(await toastText(E)) && !store["auth/login-" + ek], "a short password is refused");
  await E.fill("#suPw", "efua password 1"); await E.fill("#suPw2", "efua password 1");
  await E.click("#emGo");
  check(!!(await waitFor(() => store["access/email!" + ek]?.status === "pending" && store["auth/login-" + ek], 5000)), "a Gmail address signs up: a login and an access request");
  await E.waitForFunction(() => /^efua\.owusu@gmail\.com · no access yet$/.test(document.querySelector("#who")?.textContent || ""), null, { timeout: 5000 }).catch(() => {});
  await E.waitForTimeout(300);
  check(/Access requested/.test(await E.textContent("#view-login")), "the page is signed in, with the request sent");
  const ck = (await E.__ctx.cookies()).find(c => c.name === "__Host-trk");
  check(!!ck && ck.httpOnly && ck.secure && ck.sameSite === "Strict" && !(await E.evaluate(() => document.cookie)).includes("trk"), "the session is an HttpOnly, Secure, SameSite=Strict cookie that page scripts can't read");
  await A.click('[data-tab="stages"]'); await A.waitForSelector('[data-acc-ok="0"]', { timeout: 8000 }).catch(() => {});
  check(/Efua Owusu\s*efua\.owusu@gmail\.com\s*Email/.test(await A.textContent("#view-stages")), "the lab manager sees it, marked as an email login");
  await A.selectOption('[data-acc-role="0"]', "viewer"); await A.click('[data-acc-ok="0"]');
  check(!!(await waitFor(() => (store["settings/stages"]?.users || []).some(x => x.em === "efua.owusu@gmail.com" && x.via === "email" && x.role === "viewer"), 5000)), "approving adds an account that signs in by email");
  check(!!(await E.waitForFunction(() => document.querySelector("#who")?.textContent === "Efua Owusu · Viewer", null, { timeout: 10000 }).catch(() => null)), "the person is let in");
  check(!(await E.$eval("#pwBtn", b => b.hidden)) && await A.$eval("#pwBtn", b => b.hidden), "an email login has a Password button; a Microsoft account doesn't");
  await E.click("#pwBtn"); await E.fill("#pwDlg #pwCur", "efua password 1"); await E.fill("#pwDlg #pwNew", "efua password 2"); await E.fill("#pwDlg #pwNew2", "efua password 2");
  await E.click("#pwDlg #pwSave");
  await E.waitForFunction(() => !document.querySelector("#pwDlg").open, null, { timeout: 5000 }).catch(() => {});
  check(/Password changed/.test(await toastText(E)) && !(await E.$eval("#pwDlg", d => d.open)), "the person changes their own password");
  await E.click("#signBtn"); await E.waitForTimeout(800);
  check(await E.$eval("#who", e => e.textContent) === "Not signed in" && !(await E.__ctx.cookies()).some(c => c.name === "__Host-trk" && c.value), "sign-out ends the email session");
  await E.click('[data-tab="login"]'); await E.click("#emSignIn");
  const before401 = errors.length;
  await E.fill("#siEmail", "efua.owusu@gmail.com"); await E.fill("#siPw", "efua password 1"); await E.click("#emGo"); await E.waitForTimeout(400);
  check(/Email or password is wrong/.test(await toastText(E)) && await E.$eval("#who", e => e.textContent) === "Not signed in", "the old password no longer works");
  for (let i = errors.length - 1; i >= before401; i--) if (/status of 401/.test(errors[i])) errors.splice(i, 1);   // the browser logs the refusal this check expects
  await E.fill("#siPw", "efua password 2"); await E.click("#emGo");
  check(!!(await E.waitForFunction(() => document.querySelector("#who")?.textContent === "Efua Owusu · Viewer", null, { timeout: 5000 }).catch(() => null)), "sign in with email and password");
  await E.waitForTimeout(400);
  check(!(await E.isVisible("#siEmail")) && !(await E.isVisible("#view-login")), "once signed in, the sign-in form gives way to the page (Settings already saved)");
  await A.click('[data-tab="board"]').catch(() => {}); await A.click('[data-tab="stages"]'); await A.waitForSelector("[data-pwreset]", { timeout: 5000 }).catch(() => {});
  const ri = await A.$$eval('[data-uf="em"]', els => els.findIndex(e => e.value === "efua.owusu@gmail.com"));
  check(ri >= 0 && !!(await A.$(`[data-pwreset="${ri}"]`)) && await A.$eval(`[data-ui="${ri}"][data-uf="via"]`, e => e.value) === "email", "Settings shows the account signs in by email, with Reset password");
  await A.click(`[data-pwreset="${ri}"]`);
  await A.waitForSelector("#tmpDlg[open]", { timeout: 5000 }).catch(() => {});
  const temp = (await A.textContent("#tmpDlg .mono").catch(() => "")).trim();
  check(/^[a-z2-9]{12}$/.test(temp), "the lab manager gets a temporary password to pass on");
  await A.click("#tmpClose");
  await E.evaluate(() => window.__refreshMe());
  check(await E.$eval("#who", e => e.textContent) === "Not signed in", "the reset signs the person out");
  await E.click('[data-tab="login"]'); await E.click("#emSignIn");
  await E.fill("#siEmail", "efua.owusu@gmail.com"); await E.fill("#siPw", temp); await E.click("#emGo");
  await E.waitForSelector("#pwSave", { timeout: 5000 }).catch(() => {});
  check(/Choose a new password/.test(await E.textContent("#view-login")) && /no access yet/.test(await E.$eval("#who", e => e.textContent)), "with the temporary password they must choose a new one first");
  await E.fill("#pwCur", temp); await E.fill("#pwNew", "efua password 3"); await E.fill("#pwNew2", "efua password 3"); await E.click("#pwSave");
  check(!!(await E.waitForFunction(() => document.querySelector("#who")?.textContent === "Efua Owusu · Viewer", null, { timeout: 5000 }).catch(() => null)), "then they are back in");
  const fake = await E.evaluate(async () => { document.cookie = "__Host-trk=eyJlIjoiYm9zc0BzaXRlLnRlc3QiLCJzIjoxLCJ4Ijo5OTk5OTk5OTk5OTk5fQ.AAAA; path=/; secure"; return (await (await fetch("/api/me")).json()); });
  check(fake.email === "efua.owusu@gmail.com", "a session made up in the page is ignored");

  log("First admin (ADMIN_EMAILS)");
  const B = await newUser(browser, { uid: "b", name: "Boss" });
  await signIn(B, "boss@site.test");
  check(/· Admin/.test(await B.$eval("#who", e => e.textContent)), "an ADMIN_EMAILS account signs in as admin");
  await B.click('[data-tab="stages"]'); await B.waitForSelector('[data-uf="em"]');
  check(await B.$eval('[data-ui="0"][data-uf="em"]', e => e.value) === "boss@site.test" && await B.$eval('[data-ui="0"][data-uf="role"]', e => e.value) === "admin", "Settings puts the first admin on the account list");
  await B.click("#cfgSave"); await B.waitForTimeout(600);
  check((store["settings/stages"].users || []).some(x => x.em === "boss@site.test" && x.role === "admin"), "saving keeps the first admin as an account");

  log("Backup, and the server's record-keeping rules");
  await B.click("#cfgBackup");
  await B.waitForFunction(() => window.__downloaded && /^assay-lab-backup-/.test(window.__downloaded.filename), null, { timeout: 8000 }).catch(() => {});
  const bk = await B.evaluate(() => { try { return JSON.parse(window.__downloaded.data); } catch { return null; } });
  check(!!(bk && bk.collections.samples[sid] && bk.collections.settings.stages && bk.records > 3), "the lab manager downloads a backup of every record");

  log("Restore the backup into a new copy of the site");
  const path = require("path");
  const { start } = require(path.join(process.env.AZ_ROOT, "dev/server"));
  const mem2 = require(path.join(process.env.AZ_ROOT, "api/lib/store-memory")).createMemoryStore();
  const s2 = await start({ port: 0, store: mem2, adminEmails: ["new@lab.test"], quiet: true }); s2.server.unref();
  const base2 = `http://localhost:${s2.port}`, ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx2.addCookies([{ name: "devauth", value: "new@lab.test", url: base2 }]);
  await ctx2.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: "text/css", body: "" }));   // as harness-head.js
  const N = await ctx2.newPage();
  N.on("pageerror", e => errors.push(`[New copy] pageerror ${e.message}`));
  N.on("console", m => { if (m.type() === "error" && !/fonts\.g/.test(m.text())) errors.push(`[New copy] ${m.text()}`); });
  await N.goto(base2 + "/"); await N.waitForSelector("#sync.ok", { timeout: 8000 }).catch(() => {});
  await N.click('[data-tab="stages"]'); await N.waitForSelector("#cfgRestore:not([hidden])", { timeout: 5000 }).catch(() => {});
  check(await N.isVisible("#cfgRestore") && !(await B.isVisible("#cfgRestore")), "Restore backup shows on the new, empty copy, not on the site that has samples");
  await N.setInputFiles("#cfgRestoreFile", { name: "assay-lab-backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(bk)) });
  await N.waitForSelector("#cfgRestoreBox", { timeout: 5000 }).catch(() => {});
  const counts = await N.textContent("#cfgRestoreCounts").catch(() => "");
  check(new RegExp(`Samples ${Object.keys(bk.collections.samples).length}\\b`).test(counts) && /Settings 1\b/.test(counts) && !Object.keys(mem2.docs).some(k => k.startsWith("samples/")), "the file's counts show first; nothing is loaded until Load is pressed: " + counts);
  await N.click("#cfgRestoreGo");
  await N.waitForFunction(() => /records loaded/.test(document.getElementById("cfgRestoreMsg")?.textContent || ""), null, { timeout: 20000 }).catch(() => {});
  await N.waitForTimeout(1500); await N.waitForSelector("#sync.ok", { timeout: 8000 }).catch(() => {});
  const back = Object.entries(bk.collections).every(([c, docs]) => Object.entries(docs).every(([k, d]) => c === "settings" || JSON.stringify(mem2.docs[c + "/" + k]) === JSON.stringify(d)));
  check(back && Object.keys(mem2.docs).filter(k => k.startsWith("samples/")).length === Object.keys(bk.collections.samples).length, "every record of the backup is in the new copy, as it was");
  check(mem2.docs["settings/stages"].users.some(x => x.em === "new@lab.test" && x.role === "admin") && mem2.docs["settings/stages"].users.some(x => x.em === "boss@site.test" && x.role === "admin") && /· Admin/.test(await N.$eval("#who", e => e.textContent)),
    "the person who restored it is still lab manager, and the staff list came across");
  await N.click('[data-tab="stages"]'); await N.waitForTimeout(400);
  check(!(await N.isVisible("#cfgRestore")), "once loaded, Restore backup is gone");
  await N.goto(base2 + "/#" + sid); await N.waitForTimeout(800);
  check(await N.evaluate(id => document.body.innerText.includes(id), sid), "the new copy finds the sample by its ID");
  await ctx2.close();
  const post = (pg, ops) => pg.evaluate(async ops => (await (await fetch("/api/db", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ops }) })).json()).results, ops);
  await signIn(T, "tech1");
  const forged = await post(T, [{ op: "update", path: "samples/" + sid, data: { history: [] } }, { op: "delete", path: "samples/" + sid }, { op: "export", coll: "samples" }]);
  check(!forged[0].ok && !forged[1].ok && !forged[2].ok, "a technician's page can't erase a sample's history, delete a sample or download a backup");
  const before = errors.length;
  const plain = await T.evaluate(async () => (await fetch("/api/db", { method: "POST", body: JSON.stringify({ ops: [{ op: "get", path: "meta/schema" }] }) })).status);
  await T.waitForTimeout(200);
  for (let i = errors.length - 1; i >= before; i--) if (/status of 403/.test(errors[i])) errors.splice(i, 1);   // the browser logs the refusal this check expects
  check(plain === 403, "the API only takes JSON from this site's own page");

  log("A batch registered by a visitor");
  const W = await newUser(browser, { uid: "w2", name: "Walk-in" });
  await fillForm(W, "register", { section: "MIN", type: "gc_bh", purpose: "gc", submitter: "Kojo", count: 3, tags: "MNB-1" });   // v24c: drill core does not come from Mining
  const bids = await ids(W), bref = doc(bids[0])?.batchId;
  check(bids.length === 3 && bref === "B-" + bids[0] && bids.every(x => doc(x)?.batchId === bref && doc(x).createdBy === "public"), "a signed-out visitor registers a batch of 3; each sample carries the batch reference");
  await open(W, bref);
  check((await W.$$("#view-track tbody tr")).length === 3, "the visitor opens the batch by its reference");
  await open(T, bref); await T.setChecked("#bvOk", true); await T.click("#bvRecvBtn");
  check(!!(await waitFor(() => bids.every(x => doc(x).stageKey === "received"), 8000)), "a technician receives the whole batch");
  await W.waitForFunction(n => document.querySelectorAll("#view-track tbody tr .pill").length === n && ![...document.querySelectorAll("#view-track tbody tr .pill")].some(p => /awaiting/i.test(p.textContent)), 3, { timeout: 10000 }).catch(() => {});
  check(!/awaiting/i.test(await W.$eval("#view-track tbody", e => e.textContent).catch(() => "awaiting")), "the visitor's open batch page shows the receipt without reloading");

  log("A sample on a route no longer in use");
  const st0 = store["settings/stages"];
  store["settings/stages"] = { ...st0, routeUse: { ...(st0.routeUse || {}), "CCD-SVY": true } }; await H.broadcast("settings/stages", store["settings/stages"]); await T.waitForTimeout(800);
  await fillForm(T, "register", { section: "MET", type: "ccd", purpose: "plant", test: "ccd", submitter: "Plant metallurgist", count: 1, tags: "SVY-A1" });
  const [svy] = await ids(T);
  store["settings/stages"] = { ...store["settings/stages"], routeUse: st0.routeUse || {} }; await H.broadcast("settings/stages", store["settings/stages"]); await T.waitForTimeout(800);
  check(doc(svy)?.route === "CCD-SVY" && doc(svy).stageKey === "received", "a CCD survey sample received while its old route was in use");
  await open(T, svy);
  const k0 = doc(svy).stageKey, rail0 = await T.$$eval(".rail li", ls => ls.map(l => l.textContent));
  await T.click('[data-step="next"]').catch(() => {});
  check(!!(await waitFor(() => doc(svy).stageKey !== k0, 6000)) && rail0.some(x => /Wash efficiency/.test(x)), `with the route no longer in use, it keeps its steps and moves on (${k0} → ${doc(svy).stageKey})`);

  log("A page left open picks up a new version of the site (v24d)");
  const build = await T.$eval('meta[name="build"]', m => m.content).catch(() => "");
  const served = await T.evaluate(() => fetch("version.json", { cache: "no-store" }).then(r => r.json()).then(j => j.build).catch(() => ""));
  check(/^[a-f0-9]{12}$/.test(build) && served === build && !(await T.evaluate(() => window.__checkBuild())) && !(await T.$("#newVersion")), "the page carries its build id, version.json matches it, and nothing is offered");
  await T.route(/version\.json/, r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ build: "0123456789ab" }) }));
  await open(T, svy); await T.fill("#mvNote", "Half-written note");
  await T.evaluate(() => { window.__stillHere = 1; });
  check(await T.evaluate(() => window.__checkBuild()) === "0123456789ab" && /new version of the tracker/.test(await T.textContent("#newVersion").catch(() => "")) && !!(await T.$("#newVersionGo")), "a newer version shows a bar with Reload now");
  const hide = () => T.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); });
  await hide(); await T.waitForTimeout(600);
  check(await T.evaluate(() => window.__stillHere === 1).catch(() => false), "with a note typed and not saved, it does not reload, even in the background");
  // Still in the background: once the note is cleared it reloads (at once when hidden again, or on its own next check), so listen first.
  const reloaded = T.waitForNavigation({ timeout: 20000 }).then(() => true, () => false);
  await T.fill("#mvNote", ""); await T.waitForTimeout(3100);
  await hide().catch(() => {});
  check(await reloaded, "with nothing unsaved it reloads itself once the page is in the background" + (await T.evaluate(() => window.__unsavedWhy && window.__unsavedWhy()).then(w => w ? " (held: " + w + ")" : "", () => "")));
  await T.unroute(/version\.json/);
  await T.waitForSelector(".sid", { timeout: 8000 }).catch(() => {});
  check(await T.evaluate(() => window.__stillHere).catch(() => 1) === undefined && await T.textContent(".sid").catch(() => "") === svy && !(await T.$("#newVersion")), "after the reload the same sample is open again, on the new version");

  log("Page errors");
  check(!errors.length, "no console errors" + (errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""));
  console.log(`\n${pass} PASS, ${fail} FAIL`);
  await browser.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
