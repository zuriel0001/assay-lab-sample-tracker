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
  check(/^\/\.auth\/login\/aad\?post_login_redirect_uri=/.test(href) && await P.textContent("#msSignIn") === "Sign in with email", "Sign in with email goes to the Microsoft sign-in");
  check(await P.$eval("#msSignUp", a => a.href === "https://signup.live.com/" && a.target === "_blank" && a.textContent === "Sign up"), "Sign up opens Microsoft's create-account page in a new tab");
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
  await B.waitForFunction(() => window.__downloaded && /^met-lab-backup-/.test(window.__downloaded.filename), null, { timeout: 8000 }).catch(() => {});
  const bk = await B.evaluate(() => { try { return JSON.parse(window.__downloaded.data); } catch { return null; } });
  check(!!(bk && bk.collections.samples[sid] && bk.collections.settings.stages && bk.records > 3), "the lab manager downloads a backup of every record");
  const post = (pg, ops) => pg.evaluate(async ops => (await (await fetch("/api/db", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ops }) })).json()).results, ops);
  await signIn(T, "tech1");
  const forged = await post(T, [{ op: "update", path: "samples/" + sid, data: { history: [] } }, { op: "delete", path: "samples/" + sid }, { op: "export", coll: "samples" }]);
  check(!forged[0].ok && !forged[1].ok && !forged[2].ok, "a technician's page can't erase a sample's history, delete a sample or download a backup");
  const before = errors.length;
  const plain = await T.evaluate(async () => (await fetch("/api/db", { method: "POST", body: JSON.stringify({ ops: [{ op: "get", path: "meta/schema" }] }) })).status);
  await T.waitForTimeout(200);
  for (let i = errors.length - 1; i >= before; i--) if (/status of 403/.test(errors[i])) errors.splice(i, 1);   // the browser logs the refusal this check expects
  check(plain === 403, "the API only takes JSON from this site's own page");

  log("Page errors");
  check(!errors.length, "no console errors" + (errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""));
  console.log(`\n${pass} PASS, ${fail} FAIL`);
  await browser.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
