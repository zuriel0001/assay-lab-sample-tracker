// v17: one entry tab (Register at lab signed out, Submit a sample signed in, where lab staff can receive on the spot), and the
// technician a sample was handed to, with a badge number: required on a walk-in, optional on Submit, shown on the record, the custody
// log, the receipt and the board; the technician who confirms receipt is still recorded.
// Run: NODE_PATH=$(npm root -g) timeout 590 node v17-tests.js
const fs = require("fs");
const H = require("./harness");
const { store, errors, newUser, launch, signIn, fillForm, ids, open, doc, waitFor, toastText } = H;
const names = {};
const log = (...a) => console.log("•", ...a);
const check = (cond, msg) => { console.log(cond ? "  PASS" : "  FAIL", msg); if (!cond) process.exitCode = 1; };
const visible = page => page.$$eval("#tabs button[data-tab]", bs => bs.filter(b => !b.hidden).map(b => b.dataset.tab));
const fact = (page, label) => page.$$eval("dl.facts dt", (dts, l) => { const t = dts.find(d => d.textContent === l); return t ? t.nextElementSibling.textContent.trim() : null; }, label);
const shown = (page, sel) => page.isVisible(sel).catch(() => false);

const CORE = "/mnt/project-files/sample-tracking-azure/api/lib/core.js";
let checkSubmission = null;
if (fs.existsSync(CORE)){
  const m = fs.readFileSync(CORE, "utf8").match(/  function checkSubmission\(id, d\)\{[\s\S]*?\n    return "";\n  \}/);
  if (m) checkSubmission = eval("(" + m[0].trim() + ")");
}

(async () => {
  const browser = await launch();
  require("./harness").useOldRoutes();   // v23: this suite is written around the routes in use before version 23
  const P = await newUser(browser, { uid: "u_p", name: "Public", canEdit: true, names });
  const T = await newUser(browser, { uid: "u_t", name: "Tech", canEdit: true, names }); await signIn(T, "tech1");
  const A = await newUser(browser, { uid: "u_a", name: "Admin", canEdit: true, names }); await signIn(A, "admin");
  await P.waitForTimeout(900);

  log("One entry tab");
  check(!(await visible(P)).includes("submit") && (await visible(P)).includes("register"), "signed out: Register only");
  for (const [u, pg] of [["tech1", T], ["admin", A]]) check((await visible(pg)).includes("submit") && !(await visible(pg)).includes("register"), `${u}: Submit only`);
  const V = await newUser(browser, { uid: "u_v", name: "Viewer", canEdit: true, names }); await signIn(V, "viewer");
  const E = await newUser(browser, { uid: "u_e", name: "Exp", canEdit: true, names }); await signIn(E, "exp");
  check(!(await visible(V)).includes("register") && !(await visible(E)).includes("register") && (await visible(E)).includes("submit"), "viewer and section accounts: Submit only");
  await A.evaluate(() => { const b = document.createElement("button"); b.dataset.goto = "register"; b.id = "gotoReg"; document.body.appendChild(b); });
  await A.click("#gotoReg"); await A.waitForTimeout(200);
  check(await A.$eval("#view-submit", v => !v.hidden), "a Register at lab button opens Submit when signed in");
  await P.evaluate(() => { const b = document.createElement("button"); b.dataset.goto = "submit"; b.id = "gotoSub"; document.body.appendChild(b); });
  await P.click("#gotoSub"); await P.waitForTimeout(200);
  check(await P.$eval("#view-register", v => !v.hidden), "a Submit button opens Register when signed out");

  log("Walk-in: handed to, with badge number");
  await H.tab(P, "register"); await P.waitForSelector("#rHandTo");
  check(/Handed to \(lab technician\)\s*\*/.test(await P.textContent('label:has(#rHandTo)')) && /badge number\s*\*/.test(await P.textContent('label:has(#rHandBadge)')), "both fields are on the walk-in form, marked required");
  check(await P.$$eval("#rTechList option", os => os.map(o => o.value).includes("Lab Technician A")), "the name box suggests the lab staff names it knows");
  await fillForm(P, "register", { section: "GC", type: "rc", purpose: "gc", submitter: "Yaw Boateng", handed: "", badge: "" }); await P.waitForTimeout(300);
  check(/name of the technician you handed it to/.test(await toastText(P)) && !(await P.$("#rResult code")), "the name is required");
  await P.fill("#rHandTo", "Kwesi Mensah"); await P.click("#rSubmit"); await P.waitForTimeout(300);
  check(/badge number/.test(await toastText(P)) && !(await P.$("#rResult code")), "the badge number is required");
  await P.fill("#rHandBadge", "LT-0457"); await P.click("#rSubmit"); const [w] = await ids(P);
  const d = doc(w);
  check(d.handedTo === "Kwesi Mensah" && d.handedBadge === "LT-0457" && d.history[0].hand === "Kwesi Mensah" && d.history[0].badge === "LT-0457" && !d.receivedBy && d.stageKey === "submitted", "saved on the sample and its first custody entry; nobody is the receiver yet");
  if (checkSubmission) check(checkSubmission(w, { ...d, createdAt: Date.now() }) === "", "the Azure server's public-submission rule accepts the new fields unchanged");
  else console.log("  (Azure core.js not found: server rule check skipped)");
  await open(P, w);
  check((await fact(P, "Handed to")) === "Kwesi Mensah · badge LT-0457", "the record shows who it was handed to");
  check(/Handed to Kwesi Mensah, badge LT-0457/.test((await P.textContent("#view-track")).replace(/\s+/g, " ")), "the custody log shows the hand-over");
  await H.tab(P, "track"); await P.evaluate(() => { location.hash = ""; });

  log("Board and receipt");
  await H.tab(T, "board"); await T.waitForTimeout(400);
  check(/Handed to Kwesi Mensah/.test(await T.$eval(`.chip[data-open="${w}"]`, c => c.textContent)), "the awaiting card says who has it");
  await open(T, w);
  check(/Handed to: Kwesi Mensah, badge LT-0457/.test(await T.textContent("#actBox")), "the receipt panel shows the hand-over");
  await T.click('[data-receipt="confirm"]'); await waitFor(() => doc(w).stageKey === "received"); await T.waitForTimeout(400);
  check(doc(w).receivedBy === "Lab Technician A" && doc(w).handedTo === "Kwesi Mensah", "confirming receipt records the receiving technician; the hand-over stays");
  check((await fact(T, "Handed to")) === "Kwesi Mensah · badge LT-0457" && /^Lab Technician A/.test(await fact(T, "Received by") || ""), "the record shows both names");

  log("Submit when signed in");
  await H.tab(T, "submit"); await T.waitForSelector("#rRecvNow");
  check(await T.$eval("#rRecvNow", c => c.checked) && !!(await T.$("#rRoute")) && await shown(T, "#rRecvAt") && !(await shown(T, "#rHandTo")) && (await T.textContent("#rSubmit")) === "Register and issue ID", "lab staff: Received now at the lab, by me is ticked; route and time received show");   // v23: the route list shows only when there is a choice
  await T.setChecked("#rRecvNow", false); await T.waitForTimeout(100);
  check(!(await shown(T, "#rRouteSel")) && !(await shown(T, "#rRecvAt")) && await shown(T, "#rHandTo") && (await T.textContent("#rSubmit")) === "Submit and get sample ID" && !/\*/.test(await T.textContent('label:has(#rHandTo)')), "cleared: a submission for later, with optional hand-over fields");
  await fillForm(T, "submit", { section: "EXP", type: "core", purpose: "exp", submitter: "Ama" }); const [s1] = await ids(T);
  check(doc(s1).createdBy === "public" && doc(s1).stageKey === "submitted" && !doc(s1).handedTo && !doc(s1).receivedBy, "submitted without a hand-over: waits for receipt");
  await fillForm(T, "submit", { section: "EXP", type: "core", purpose: "exp", submitter: "Ama", handed: "Esi Owusu", badge: "LT-0102" }); const [s2] = await ids(T);
  check(doc(s2).handedTo === "Esi Owusu" && doc(s2).handedBadge === "LT-0102", "a hand-over typed on Submit is saved");
  await fillForm(T, "register", { section: "GEO", type: "core", purpose: "exp", submitter: "Walk-in" }); const [s3] = await ids(T);
  check(doc(s3).stageKey === "received" && doc(s3).receivedBy === "Lab Technician A" && !doc(s3).handedTo && doc(s3).createdBy === "tech1", "ticked: received on the spot by the technician, no hand-over needed");
  await H.tab(V, "submit"); await V.waitForSelector("#regForm");
  check(!(await V.$("#rRecvNow")) && await shown(V, "#rHandTo") && (await V.inputValue("#rSubmitter")) === "Site Viewer", "a viewer's Submit: no receive box, optional hand-over, name filled in");

  log("Console errors: " + JSON.stringify(errors));
  check(!errors.length, "no console errors");
  await browser.close();
})().catch(e => { console.error("Error", e); process.exit(1); });
