// v16: Register at lab is open to everyone (walk-ins wait for receipt), Submit a sample needs a sign-in; pulverising to 80% passing
// 75 µm; every field of the reference material register editable, with a change history; a reason box for purpose "Other"; the
// receiver on the workflow line; the earlier board look (tiles with zeros, lanes in a grid) with lanes that scroll after five cards; ZIJIN.
// Run: NODE_PATH=$(npm root -g) timeout 590 node v16-tests.js
const fs = require("fs");
const H = require("./harness");
const { store, errors, newUser, launch, signIn, fillForm, ids, open, doc, waitFor, cfgTab, toastText, localStr } = H;
const names = {};
const log = (...a) => console.log("•", ...a);
const check = (cond, msg) => { console.log(cond ? "  PASS" : "  FAIL", msg); if (!cond) process.exitCode = 1; };
const HOUR = 3600e3;
const visible = page => page.$$eval("#tabs button[data-tab]", bs => bs.filter(b => !b.hidden).sort((a, b) => (+getComputedStyle(a).order) - (+getComputedStyle(b).order)).map(b => b.dataset.tab));
const railMeta = (page, name) => page.$$eval(".rail li", (ls, n) => { const l = ls.find(x => x.querySelector(".st-name")?.textContent.startsWith(n)); return l ? l.querySelector(".st-meta").textContent : null; }, name);
const fact = (page, label) => page.$$eval("dl.facts dt", (dts, l) => { const t = dts.find(d => d.textContent === l); return t ? t.nextElementSibling.textContent.trim() : null; }, label);

// The Azure server's rule for what someone who is not lab staff may create (api/lib/core.js), when that folder is present.
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

  log("Register at lab for everyone");
  check((await visible(P)).join() === "register,track,routes,login", "signed out: Register, Sample, Routes, Sign in (no Submit)");
  check(await P.$eval("#view-register", v => !v.hidden) && /Register at lab/.test(await P.textContent("#view-register h2")), "the page opens on Register at lab");
  check(!(await P.$("#rRouteSel")) && !(await P.$("#rRecvAt")) && /Waits for receipt/.test(await P.textContent("#view-register .form-h")) && (await P.textContent("#rSubmit")) === "Register and get sample ID", "walk-in form: no route choice or receipt fields, marked as waiting for receipt");
  check(!(await P.$$eval("#view-register p", ps => ps.length)), "no explanatory paragraph on the form");
  await fillForm(P, "register", { section: "GC", type: "rc", purpose: "gc", submitter: "Yaw Boateng", count: 2 }); const wk = await ids(P);
  const w0 = doc(wk[0]);
  check(w0.createdBy === "public" && w0.stageKey === "submitted" && w0.via === "walkin" && !w0.receivedBy && !w0.recvAt && w0.history.length === 1 && w0.history[0].by === "public" && w0.history[0].note === "Registered at the lab (walk-in)", "a walk-in registration waits as a submission: nobody is recorded as receiver yet");
  if (checkSubmission){
    const now = Date.now(), fresh = { ...w0, createdAt: now };
    check(checkSubmission(wk[0], fresh) === "" || checkSubmission(wk[0], fresh) === "date", "the Azure server's public-submission rule accepts it unchanged (" + (checkSubmission(wk[0], fresh) || "ok") + ")");
  } else console.log("  (Azure core.js not found: server rule check skipped)");
  await open(P, wk[0]);
  check(/Awaiting receipt/.test(await P.textContent(".card-head")) && /at the lab, waiting for receipt/.test(await fact(P, "Registered") || ""), "its record says Registered at the lab, awaiting receipt");
  await H.tab(P, "track"); await P.evaluate(() => { location.hash = ""; });

  log("Receiver on the workflow line");
  await open(T, wk[0]); await T.click('[data-receipt="confirm"]'); await waitFor(() => doc(wk[0]).stageKey === "received"); await T.waitForTimeout(400);
  const by = doc(wk[0]).receivedBy;
  check(/at the lab \(walk-in\)$/.test(await fact(T, "Registered") || ""), "after receipt the record says Registered at the lab (walk-in)");
  check(by === "Lab Technician A" && (await railMeta(T, "Received & logged") || "").startsWith(`Received by ${by},`), "Received & logged shows who received it: " + await railMeta(T, "Received & logged"));
  check(/Yaw Boateng \(submitter\)/.test(await railMeta(T, "Submitted") || ""), "Submitted shows the submitter");
  await T.click('[data-step="next"]'); await waitFor(() => doc(wk[0]).stageKey !== "received"); await T.waitForTimeout(500);
  const doneRecv = await railMeta(T, "Received & logged"), nextName = doc(wk[0]).history.at(-1).sn;
  await T.click('[data-step="next"]'); await waitFor(() => doc(wk[0]).history.length >= 4); await T.waitForTimeout(500);
  check(doneRecv.startsWith(`Received by ${by},`) && (await railMeta(T, nextName) || "").endsWith(" · Lab Technician A"), `done steps keep the names: "${doneRecv}" / "${await railMeta(T, nextName)}"`);

  log("Submit a sample after sign-in");
  const V = await newUser(browser, { uid: "u_v", name: "Viewer", canEdit: true, names }); await signIn(V, "viewer");
  // v17: signed in there is one entry tab, Submit (see v17-tests.js).
  check(!(await visible(V)).includes("register") && (await visible(V)).includes("submit"), "a viewer has Submit");
  await H.tab(V, "submit"); await V.waitForSelector("#regForm");
  check((await V.inputValue("#rSubmitter")) === "Site Viewer" && /Submit a sample/.test(await V.textContent("#view-submit h2")), "Submit fills in the signed-in name");
  const E = await newUser(browser, { uid: "u_e", name: "Exp", canEdit: true, names }); await signIn(E, "exp");
  await H.tab(E, "submit"); await E.waitForSelector("#regForm");
  check((await E.inputValue("#rSection")) === "EXP", "a section account's form starts on its own section");
  await H.tab(T, "register"); await T.waitForSelector("#regForm");
  check(!!(await T.$("#rRoute")) && await T.isVisible("#rRecvAt") && !(await T.$("#regForm .form-h .pill")), "lab staff still register straight in, as the receiver");   // v23: the route list shows only when there is a choice

  log("Assay purpose Other");
  await H.tab(P, "register"); await P.waitForSelector("#regForm"); if (await P.$("#rAgain")) await P.click("#rAgain");
  check(await P.$eval("#rWhyBox", b => b.hidden), "no reason box until Other is chosen");
  await P.selectOption("#rPurpose", "other");
  check(await P.$eval("#rWhyBox", b => !b.hidden), "choosing Other shows the reason box");
  await P.selectOption("#rSection", "EXP"); await P.selectOption("#rType", "core"); await P.fill("#rSubmitter", "Akua"); await P.click("#rSubmit"); await P.waitForTimeout(300);
  check(/why the sample is being tested/.test(await toastText(P)) && !(await P.$("#rResult code")), "the reason is required");
  await P.fill("#rWhy", "Check of an old stockpile"); await P.fill("#rHandTo", "Lab Technician A"); await P.fill("#rHandBadge", "B-101"); await P.click("#rSubmit"); const [ot] = await ids(P);
  check(doc(ot).purpose === "Other: Check of an old stockpile" && doc(ot).purposeKey === "other" && doc(ot).purposeWhy === "Check of an old stockpile", "the reason is saved with the sample");
  await open(P, ot);
  check((await fact(P, "Assay purpose")) === "Other: Check of an old stockpile", "and shown on its record");
  await H.tab(P, "track"); await P.evaluate(() => { location.hash = ""; });

  log("Pulverising to 80% passing 75 µm");
  await H.tab(A, "routes"); await A.waitForTimeout(300);
  const rt = await A.textContent("#view-routes");
  check(!/85% passing/.test(rt) && (rt.match(/80% passing 75 µm/g) || []).length >= 7, "routes pulverise to 80% passing 75 µm");
  const st = store["settings/stages"] || {};
  const oldRoute = { code: "EXP-FA-OLD", name: "Saved before v16", tests: ["fa_aas"], types: ["core"], purposes: [], stages: [{ key: "pulv", name: "Pulverising to 85% passing 75 µm", hours: 2, phase: "prep", note: "Single stage to 85% passing 75 µm" }], retention: [], qcp: "fa50", qcg: [] };
  store["settings/stages"] = { ...st, schema: 12, routes: [...(st.routes || []), oldRoute] }; await H.broadcast("settings/stages", store["settings/stages"]); await A.waitForTimeout(500);
  await H.tab(A, "board"); await H.tab(A, "routes"); await A.waitForTimeout(300);
  check(!/85% passing/.test(await A.textContent("#view-routes")), "a route saved with the 85% wording is shown with 80%");
  store["settings/stages"] = { ...st }; if (!Object.keys(st).length) delete store["settings/stages"]; await H.broadcast("settings/stages", store["settings/stages"] || null); await A.waitForTimeout(400);

  log("Reference materials: every field editable, with a change history");
  const crmsNow = () => store["settings/stages"]?.crms || [];
  // A closed batch that used STD-AU-LOW, and an open one using STD-AU-MED.
  const at = Date.now() - 2 * HOUR, an = { k: "Au", n: "Gold", u: "g/t", dl: 0.005, dp: 3, ul: 10 };
  store[`batches/FA-${H.T}-71`] = { id: `FA-${H.T}-71`, qcp: "fa50", an, at, day: "", month: "", by: "tech1", tech: "Lab Technician A", open: false, status: "closed", sids: [], pos: [{ p: 1, t: "crm", crm: "STD-AU-LOW" }], crms: ["STD-AU-LOW"], qc: { at, status: "pass", checks: [{ p: 1, t: "crm", k: "Au", crm: "STD-AU-LOW", exp: 0.52, sd: 0.025, val: 0.53, verdict: "pass" }] }, log: [] };
  store[`batches/FA-${H.T}-72`] = { id: `FA-${H.T}-72`, qcp: "fa50", an, at, day: "", month: "", by: "tech1", tech: "Lab Technician A", open: true, status: "prep", sids: [], pos: [{ p: 1, t: "crm", crm: "STD-AU-MED" }], crms: ["STD-AU-MED"], qc: null, log: [] };
  await H.broadcast(`batches/FA-${H.T}-71`, store[`batches/FA-${H.T}-71`]); await H.broadcast(`batches/FA-${H.T}-72`, store[`batches/FA-${H.T}-72`]); await A.waitForTimeout(400);
  await H.tab(A, "stages"); await cfgTab(A, "crms"); await A.waitForSelector("[data-cf]");
  check(await A.$$eval('[data-cf="id"]', es => es.every(e => !e.disabled)), "every ID can be changed");
  const rowOf = id => A.$$eval('[data-cf="id"]', (es, id) => es.findIndex(e => e.value === id), id);
  const setCell = async (i, f, val) => { await A.fill(`[data-ci="${i}"][data-cf="${f}"]`, String(val)); await A.press(`[data-ci="${i}"][data-cf="${f}"]`, "Tab"); await A.waitForTimeout(150); };
  await setCell(await rowOf("STD-AU-MED"), "id", "OREAS-MED");
  check(/open batch FA-/.test(await toastText(A)) && (await rowOf("STD-AU-MED")) >= 0, "a material in an open batch can't be renamed until the batch closes");
  await setCell(await rowOf("STD-AU-LOW"), "id", "oreas-low");
  const lowRows = await A.$$eval('[data-cf="id"]', es => es.filter(e => e.value === "OREAS-LOW").map(e => e.parentElement.textContent));
  check(lowRows.length >= 1 && lowRows.every(t => /was STD-AU-LOW/.test(t)) && (await rowOf("STD-AU-LOW")) < 0, "a saved ID can be renamed; the row shows its earlier ID");
  const lo = await rowOf("OREAS-LOW");
  await setCell(lo, "name", "OREAS 2Pd low-grade ore"); await setCell(lo, "val", "0.515"); await setCell(lo, "sd", "0.021"); await setCell(lo, "use", "fa gc");
  await A.selectOption(`[data-ci="${await rowOf("STD-AU-HIGH")}"][data-cf="an"]`, { index: 1 }); await A.waitForTimeout(150);
  await A.click("#cfgSave"); await waitFor(() => crmsNow().some(c => c.id === "OREAS-LOW"));
  const saved = crmsNow().find(c => c.id === "OREAS-LOW"), logRows = store["settings/stages"]?.crmLog || [];
  check(saved && saved.name === "OREAS 2Pd low-grade ore" && saved.val === 0.515 && saved.sd === 0.021 && saved.use === "FA, GC" && saved.was?.includes("STD-AU-LOW"), "ID, description, value, SD and batch types are all saved");
  const lg = logRows.find(x => x.id === "OREAS-LOW")?.what || "";
  check(/ID STD-AU-LOW → OREAS-LOW/.test(lg) && /Certified value 0\.52 → 0\.515/.test(lg) && /SD 0\.025 → 0\.021/.test(lg) && logRows.every(x => x.by === "Lab Manager" && x.at > 0) && logRows.some(x => x.id === "STD-AU-HIGH" && /Analyte/.test(x.what)), "the change history records who changed what: " + logRows.map(x => `${x.id}: ${x.what}`).join(" | "));
  await A.waitForSelector("details.crm-log");
  check(/Change history \(\d+\)/.test(await A.textContent("details.crm-log summary")), "Settings shows the change history");
  await A.click("details.crm-log summary"); await A.waitForTimeout(100);
  check(/OREAS-LOW/.test(await A.textContent("details.crm-log table")) && /Lab Manager/.test(await A.textContent("details.crm-log table")), "with when, who, which material and the change");
  const rmRow = await rowOf("SOL-AU-0.2"); await A.click(`[data-crm-rm="${rmRow}"]`); await A.waitForTimeout(150);
  await A.click("#cfgSave"); await waitFor(() => (store["settings/stages"]?.crmLog || []).some(x => /Removed/.test(x.what)));
  check((store["settings/stages"]?.crmLog || [])[0]?.id === "SOL-AU-0.2" && /^Removed/.test(store["settings/stages"].crmLog[0].what) && store["settings/stages"].crmLog.length === logRows.length + 1, "a removal is added to the top of the history; earlier entries stay");
  await H.tab(T, "batches"); await T.waitForSelector("#chCrm");
  await T.selectOption("#chCrm", "OREAS-LOW|Au|g/t"); await T.waitForSelector("#chBox svg", { timeout: 4000 }).catch(() => {});
  check(await T.$$eval("#chBox circle", c => c.length) >= 1, "the control chart of the renamed material still has the results recorded under its old ID");

  log("Board: the earlier look, lanes scroll after five cards");
  await fillForm(P, "register", { section: "PLT", type: "carbon", purpose: "plant", submitter: "Kojo", count: 8 }); await ids(P);
  await H.tab(A, "board"); await A.waitForTimeout(500);
  const tiles = await A.$$eval(".stats.tiles > .stat", ts => ts.map(t => [t.tagName, t.querySelector(".n").textContent, t.querySelector(".l").textContent]));
  check(tiles.length === 11 && tiles.some(t => t[1] === "0" && t[0] === "DIV") && tiles.filter(t => t[1] !== "0" && t[0] === "BUTTON").length >= 2 && await A.$eval(".stats.tiles", s => getComputedStyle(s).display === "grid"), "11 tiles in a grid, zeros included; tiles with samples are buttons: " + tiles.map(t => t[1] + " " + t[2]).join(" | "));
  const aw = await A.$eval(".lane.ph-await .cards", c => ({ n: c.children.length, scrolls: c.classList.contains("scrolls"), ch: c.clientHeight, sh: c.scrollHeight, fifth: c.children[4].offsetTop + c.children[4].offsetHeight <= c.clientHeight + 1, sixth: c.children[5].offsetTop < c.clientHeight, seventh: c.children[6].offsetTop >= c.clientHeight }));
  check(aw.n >= 9 && aw.scrolls && aw.sh > aw.ch && aw.fifth && aw.sixth && aw.seventh, `a lane with ${aw.n} cards shows about five and scrolls (${aw.ch}px of ${aw.sh}px)`);
  check(await A.$$eval(".lane", ls => ls.every(l => !l.classList.contains("empty")) && ls.some(l => !l.querySelector(".chip"))), "empty lanes stay full size");
  await A.$eval(".lane.ph-await .cards", c => { c.scrollTop = c.scrollHeight; c.dispatchEvent(new Event("scroll")); }); await A.waitForTimeout(100);
  check(await A.$eval(".lane.ph-await .cards", c => c.classList.contains("at-end")), "the fade at the bottom goes when the lane is scrolled to its end");
  await fillForm(P, "register", { section: "PLT", type: "carbon", purpose: "plant", submitter: "Kojo 2" }); await ids(P); await A.waitForTimeout(700);
  check(await A.$eval(".lane.ph-await .cards", c => c.scrollTop > 0), "a live update of the board keeps the lane where it was scrolled");
  await A.click('[data-bpick="lab"]'); await A.waitForTimeout(200);
  check(/Showing/.test(await A.textContent(".pick-note")) && await A.$eval('[data-bpick="lab"]', b => b.getAttribute("aria-pressed")) === "true" && (await A.$$eval(".lanes .chip", cs => cs.map(c => c.dataset.open))).join() === wk[0], "clicking a tile opens its list");
  const late = await A.$$eval(".lane .chip .left", ls => ls.map(l => l.textContent));
  check(late.length > 0 && late.every(t => /(late|left)$/.test(t)) && await A.$eval(".lane .chip .left", l => l === l.parentElement.lastElementChild), "time left or late is on the card's last line, as on the earlier cards");
  await A.click('.pick-note [data-bpick="lab"]'); await A.waitForTimeout(150);
  const Ph = await newUser(browser, { uid: "u_ph", name: "Phone", canEdit: true, names }, { width: 375, height: 760 }); await signIn(Ph, "tech1");
  await H.tab(Ph, "board"); await Ph.waitForTimeout(500);
  check(await Ph.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1) && await Ph.$eval(".stats.tiles", s => getComputedStyle(s).gridTemplateColumns.split(" ").length === 3), "phone: three tiles a row, no sideways scrolling");
  await A.click("#bdWall"); await A.waitForTimeout(250);
  check(await A.evaluate(() => document.body.classList.contains("wall")) && await A.$eval(".lane.ph-await .cards", c => c.classList.contains("scrolls")), "wall screen keeps the tiles and scrolling lanes");
  await A.click("[data-wall-exit]"); await A.waitForTimeout(200);

  log("ZIJIN");
  check((await A.textContent(".brand-t small")).trim() === "ZIJIN", "the header says ZIJIN");
  const src = fs.readFileSync(H.FILE.replace("file://", ""), "utf8");
  check(!/Mine site →/.test(src) && src.includes("ZIJIN · Assay Laboratory"), "no “Mine site → Assay laboratory” left; certificates say ZIJIN · Assay Laboratory");

  log("Console errors: " + JSON.stringify(errors));
  check(!errors.length, "no console errors");
  await browser.close();
})().catch(e => { console.error("Error", e); process.exit(1); });
