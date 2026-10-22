// v34 (22 Oct, "implement 2 and 3"): the month's audit pack (Excel workbook and PDF) on the Ledger for the lab supervisor and manager, and
// the daily storage to-do on the Board for lab staff: released samples to put away and materials past retention, each one tap, the
// witness rules kept. The workbook and PDF are opened with openpyxl and pypdf when they are installed. Values here are made up.
// Run: NODE_PATH=$(npm root -g) timeout 590 node v34-tests.js
process.env.V24 = "1";
const H = require("./harness");
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const { errors, newUser, launch, signIn, open, doc, waitFor, store, broadcast, fillForm, ids, tab, ledger, toastText } = H;
const names = {};
const log = (...a) => console.log("•", ...a);
const check = (cond, msg) => { console.log(cond ? "  PASS" : "  FAIL", msg); if (!cond) process.exitCode = 1; };
const text = async (page, sel) => ((await page.textContent(sel).catch(() => "")) || "").replace(/\s+/g, " ").trim();
const DAY = 86400e3, OPEN_T = 9e15, OUT = __dirname;
const py = (code, file) => { try { return JSON.parse(execFileSync("python3", ["-I", "-c", code, file], { encoding: "utf8" })); } catch (e) { return { err: String(e.stderr || e.message).split("\n").filter(Boolean).slice(-2).join(" ") }; } };
const hasPy = mod => { try { execFileSync("python3", ["-I", "-c", `import ${mod}`], { stdio: "ignore" }); return true; } catch { return false; } };
async function saved(page, kind){
  await page.evaluate(() => { window.__downloaded = null; });
  await page.click(`[data-audit="${kind}"]`);
  for (let i = 0; i < 100; i++){ const n = await page.evaluate(() => window.__downloaded && window.__downloaded.filename); if (n) break; await page.waitForTimeout(100); }
  return page.evaluate(() => { const o = window.__downloaded || {}; return { filename: o.filename, bin: o.data instanceof Uint8Array ? Array.from(o.data, b => String.fromCharCode(b)).join("") : "" }; });
}

(async () => {
  const browser = await launch();
  const Tc = await newUser(browser, { uid: "u_t", name: "Tech", canEdit: true, names }); await signIn(Tc, "tech1");
  await fillForm(Tc, "submit", { section: "GEO" }); const [a] = await ids(Tc);
  const now = Date.now(), A = doc(a);
  const base = (id, extra) => ({ id, v: 13, lab: true, open: true, onHand: true, section: "GEO", type: A.type, typeKey: A.typeKey, route: A.route, test: A.test, plan: A.plan, createdAt: now - 5 * DAY, recvAt: now - 4 * DAY, tags: [],
    history: [{ key: "received", sn: "Received", at: now - 4 * DAY, by: "tech1", tech: "Lab Technician A" }], ...extra });
  const mat = (k, item, then, dueAt, loc = "") => ({ k, item, days: 30, then, dispo: { Disposed: "disposed", Returned: "returned", "Sent to external lab": "external" }[then] || "archived", status: "kept", dueAt, loc, outs: 0 });
  const rel = { stageKey: "released", stageAt: now - 2 * DAY, relAt: now - 2 * DAY };
  const stored = (id, two, m) => [base(id, { lab: false, stageKey: "storage", stageAt: now - 40 * DAY, relAt: now - 41 * DAY, two, materials: [m] }),
    { id, sec: "GEO", type: A.type, route: A.route, tag: "", recvAt: now - 4 * DAY, gone: OPEN_T, st: "store", due: m.dueAt, two, m: [{ k: m.k, item: m.item, loc: m.loc, dueAt: m.dueAt, then: m.then }] }];
  const seeds = {
    "GEO-T-0001": base("GEO-T-0001", { ...rel, materials: [mat("m1", "Pulp", "Returned", now + 300 * DAY), mat("m2", "Coarse reject", "Disposed", now + 20 * DAY)] }),
    "GEO-T-0002": base("GEO-T-0002", { ...rel, batchId: "B-GEO-T-0002", batchSize: 2, materials: [mat("m1", "Pulp", "Disposed", now + 30 * DAY)] }),
    "GEO-T-0003": base("GEO-T-0003", { ...rel, batchId: "B-GEO-T-0002", batchSize: 2, materials: [mat("m1", "Pulp", "Disposed", now + 30 * DAY)] }),
    "GEO-T-0004": base("GEO-T-0004", { ...rel, two: true, materials: [mat("m1", "Retained bar", "Returned", now + 30 * DAY)] })
  };
  const st = { "GEO-T-0005": stored("GEO-T-0005", false, mat("m1", "Coarse reject", "Disposed", now - 3 * DAY, "Yard 1")),
    "GEO-T-0006": stored("GEO-T-0006", true, mat("m1", "Coarse reject", "Disposed", now - 2 * DAY, "Vault 1")),
    "GEO-T-0007": stored("GEO-T-0007", false, mat("m1", "Pulp", "Returned", now - 1.5 * DAY, "Rack 7")),
    "GEO-T-0008": stored("GEO-T-0008", false, mat("m1", "Pulp", "Sent to external lab", now - 1.2 * DAY, "Rack 8")) };
  for (const [id, s] of Object.entries(seeds)){ store["samples/" + id] = s; await broadcast("samples/" + id, s); }
  for (const [id, [s, k]] of Object.entries(st)){ store["samples/" + id] = s; store["stock/" + id] = k; await broadcast("samples/" + id, s); await broadcast("stock/" + id, k); }
  await tab(Tc, "board"); await Tc.waitForTimeout(500);

  log("The reminder at the top of the Board, once a day");
  const note = await text(Tc, "#tdNote");
  check(/To do today/.test(note) && /3 to put away/.test(note) && /4 past retention/.test(note), "lab staff see one line: " + note);
  check(await Tc.$eval("#tdNote", e => e.getBoundingClientRect().height) < 60, "the reminder is one compact line");
  await Tc.click("[data-tdopen]"); await Tc.waitForTimeout(250);
  check(await Tc.isVisible("#bdPick.todo") && !(await Tc.$("#tdNote")) && !(await Tc.$(".lanes")), "Open shows the to-do in place of the lanes, and the reminder goes");
  check(await Tc.$$eval("#tdStore .todo-row", r => r.length) === 3 && await Tc.$$eval("#tdDue .todo-row", r => r.length) === 4, "3 to put away (the batch is one row) and 4 past retention");
  check(/B-GEO-T-0002 2 samples/.test(await text(Tc, '[data-tdrow="B:B-GEO-T-0002"]')), "a batch processed as one is one row: " + await text(Tc, '[data-tdrow="B:B-GEO-T-0002"] .td-what'));
  check((await Tc.$$eval("#tdDue [data-tddue]", bs => bs.map(b => b.textContent))).join() === "Dispose,Dispose,Return,Send out", "each material's button is what its retention says, oldest first");
  check(await Tc.isVisible("#tdWit"), "one Witness box for the rows that need a second person");

  log("Store: one tap at the location typed");
  await Tc.click('[data-tdstore="GEO-T-0001"]'); await Tc.waitForTimeout(200);
  check(/Type the storage location/.test(await toastText(Tc)) && doc("GEO-T-0001").stageKey === "released", "no location: nothing stored");
  await Tc.fill('[data-tdloc="GEO-T-0001"]', "Shelf T1"); await Tc.click('[data-tdstore="GEO-T-0001"]');
  await waitFor(() => doc("GEO-T-0001").stageKey === "storage");
  const s1 = doc("GEO-T-0001");
  check(s1.stageKey === "storage" && s1.materials.every(m => m.loc === "Shelf T1") && s1.history.filter(h => / put away$/.test(h.note || "")).length === 2, "both materials on the shelf, the sample's workflow complete, each put-away on the record");
  await Tc.waitForTimeout(400);
  check(await Tc.inputValue('[data-tdloc="B:B-GEO-T-0002"]') === "Shelf T1", "the next row has the last location filled in");
  await Tc.click('[data-tdstore="B:B-GEO-T-0002"]');
  await waitFor(() => doc("GEO-T-0002").stageKey === "storage" && doc("GEO-T-0003").stageKey === "storage");
  check(["GEO-T-0002", "GEO-T-0003"].every(id => doc(id).stageKey === "storage" && doc(id).materials[0].loc === "Shelf T1" && /^With batch B-GEO-T-0002/.test(doc(id).history.at(-1).note)), "one tap stores the whole batch, each record noting the batch");
  await Tc.waitForTimeout(400);

  log("A critical sample: the witness confirms the storage from their own account");
  await Tc.fill('[data-tdloc="GEO-T-0004"]', "Vault 2"); await Tc.click('[data-tdstore="GEO-T-0004"]'); await Tc.waitForTimeout(200);
  check(/choose the witness who confirms the storage/.test(await toastText(Tc)) && !doc("GEO-T-0004").materials[0].loc, "no witness chosen: nothing stored");
  await Tc.selectOption("#tdWit", "Lab Technician B"); await Tc.click('[data-tdstore="GEO-T-0004"]');
  await waitFor(() => doc("GEO-T-0004").wq);
  const s4 = doc("GEO-T-0004");
  check(s4.materials[0].loc === "Vault 2" && s4.wq && s4.wq.kind === "store" && s4.wq.witU === "tech2" && s4.stageKey === "released", "put away and Lab Technician B asked to confirm; the step stays open");
  await Tc.waitForTimeout(400);
  check(/Waiting for Lab Technician B to confirm/.test(await text(Tc, '[data-tdrow="GEO-T-0004"]')) && !(await Tc.$('[data-tdstore="GEO-T-0004"]')), "the row then says who it waits for, with no button");

  log("Past retention: dispose, return, send out");
  await Tc.selectOption("#tdWit", ""); await Tc.click('[data-tddue="GEO-T-0005|m1-coarsereject"]'); await Tc.waitForTimeout(200);
  check(/Disposal needs a second person/.test(await toastText(Tc)) && doc("GEO-T-0005").materials[0].status === "kept", "a disposal without a witness is refused");
  await Tc.selectOption("#tdWit", "Lab Technician B"); await Tc.click('[data-tddue="GEO-T-0005|m1-coarsereject"]');
  await waitFor(() => doc("GEO-T-0005").materials[0].status === "disposed");
  await waitFor(() => ledger().some(m => m.sid === "GEO-T-0005" && m.dir === "out"));
  const mv5 = ledger().find(m => m.sid === "GEO-T-0005" && m.dir === "out");
  check(doc("GEO-T-0005").stageKey === "disposed" && mv5 && mv5.kind === "disposed" && mv5.wit === "Lab Technician B" && mv5.tech === "Lab Technician A", "disposed with the witness on the ledger; the sample closes");
  await Tc.waitForTimeout(400);
  await Tc.click('[data-tddue="GEO-T-0006|m1-coarsereject"]');
  await waitFor(() => doc("GEO-T-0006").wq);
  check(doc("GEO-T-0006").wq.kind === "out" && doc("GEO-T-0006").wq.what === "disposed" && doc("GEO-T-0006").materials[0].status === "kept" && !ledger().some(m => m.sid === "GEO-T-0006"), "a critical sample's disposal waits for the witness to confirm it");
  await Tc.waitForTimeout(400);
  await Tc.click('[data-tddue="GEO-T-0007|m1-pulp"]');
  await waitFor(() => doc("GEO-T-0007").materials[0].status === "returned");
  check(doc("GEO-T-0007").stageKey === "returned", "Return: one tap, no witness needed");
  await Tc.waitForTimeout(400);
  await Tc.click('[data-tddue="GEO-T-0008|m1-pulp"]'); await Tc.waitForTimeout(200);
  check(/external lab and waybill/.test(await toastText(Tc)) && doc("GEO-T-0008").materials[0].status === "kept", "Send out needs the external lab and waybill");
  await Tc.fill('[data-tdref="GEO-T-0008|m1-pulp"]', "Umpire lab WB-104"); await Tc.press('[data-tdref="GEO-T-0008|m1-pulp"]', "Enter");
  await waitFor(() => doc("GEO-T-0008").materials[0].status === "external");
  check(doc("GEO-T-0008").materials[0].outRef === "Umpire lab WB-104", "Enter in the box sends it out with the reference");
  await Tc.waitForTimeout(500);
  check(await Tc.$$eval("#tdStore .todo-row", r => r.length) === 1 && await Tc.$$eval("#tdDue .todo-row", r => r.length) === 1, "done rows leave the list; the two waiting on the witness stay");

  log("The tiles open the to-do; the reminder stays closed today");
  await Tc.click("#bdPick .pk-x"); await Tc.waitForTimeout(250);
  check(!(await Tc.$("#tdNote")) && await Tc.isVisible(".lanes"), "closed: the lanes are back and no reminder (opened today)");
  await Tc.click('[data-bpick="unstored"]'); await Tc.waitForTimeout(250);
  check(await Tc.isVisible("#tdStore") && !(await Tc.$("#tdDue")), "Released, not yet put in storage opens the To put away list");
  await Tc.click('[data-bpick="unstored"]'); await Tc.waitForTimeout(200);

  log("Viewers: no to-do, the tile lists as before");
  const V = await newUser(browser, { uid: "u_v", name: "Viewer", canEdit: false, names }); await signIn(V, "viewer");
  await tab(V, "board"); await V.waitForTimeout(500);
  check(!(await V.$("#tdNote")), "no reminder for a viewer");
  await V.click('[data-bpick="retention"]'); await V.waitForTimeout(250);
  check(!(await V.$("#bdPick.todo")) && !(await V.$("[data-tddue]")), "a viewer's tile shows the list without actions");

  log("The witness confirms both from their own account");
  const T2 = await newUser(browser, { uid: "u_t2", name: "Tech B", canEdit: true, names }); await signIn(T2, "tech2");
  for (const id of ["GEO-T-0004", "GEO-T-0006"]){ await open(T2, id); await T2.waitForSelector("#wqOk"); await T2.click("#wqOk"); await waitFor(() => !doc(id).wq); }
  check(doc("GEO-T-0004").stageKey === "storage" && doc("GEO-T-0006").materials[0].status === "disposed", "storage confirmed and disposal confirmed");

  log("Phone and desktop views");
  const P = await newUser(browser, { uid: "u_p", name: "Phone", canEdit: true, names }, { width: 390, height: 844 }); await signIn(P, "super");
  store["samples/GEO-T-0009"] = base("GEO-T-0009", { ...rel, materials: [mat("m1", "Pulp", "Returned", now + 30 * DAY), mat("m2", "Coarse reject", "Disposed", now - DAY, "")] }); await broadcast("samples/GEO-T-0009", store["samples/GEO-T-0009"]);
  await tab(P, "board"); await P.waitForTimeout(500);
  check(/1 to put away/.test(await text(P, "#tdNote")) && /1 past retention/.test(await text(P, "#tdNote")), "the supervisor's reminder: " + await text(P, "#tdNote"));
  await P.screenshot({ path: OUT + "/v34-todo-note-phone.png" });
  await P.click("[data-tdopen]"); await P.waitForTimeout(300);
  check(await P.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "no sideways scroll on a phone");
  await P.$eval("#bdPick", e => e.scrollIntoView()); await P.screenshot({ path: OUT + "/v34-todo-phone.png" });
  const D = await newUser(browser, { uid: "u_d", name: "Desk", canEdit: true, names }); await signIn(D, "admin");
  await tab(D, "board"); await D.waitForTimeout(400); await D.click("[data-tdopen]"); await D.waitForTimeout(300);
  await D.$eval("#bdPick", e => e.scrollIntoView()); await D.screenshot({ path: OUT + "/v34-todo.png" });

  log("Audit pack: Excel and PDF for the month, for the supervisor and manager only");
  await tab(Tc, "ledger"); await Tc.waitForTimeout(600);
  check(!(await Tc.$(".aud-pk")), "a technician has no audit pack");
  await tab(D, "ledger"); await D.waitForSelector(".aud-pk", { timeout: 8000 });
  check(/Audit pack\s*Excel\s*PDF/.test(await text(D, ".aud-pk")), "a small Audit pack: Excel | PDF beside Month summary");
  const month = await D.inputValue("#lgMonth");
  const xl = await saved(D, "xlsx");
  check(xl.filename === `audit-pack-${month}.xlsx` && xl.bin.startsWith("PK\x03\x04"), "Excel: " + xl.filename);
  const xf = path.join(OUT, "out-audit-pack.xlsx"); fs.writeFileSync(xf, Buffer.from(xl.bin, "latin1"));
  if (hasPy("openpyxl")){
    const r = py(`import sys, json, openpyxl
wb = openpyxl.load_workbook(sys.argv[1])
out = {"sheets": wb.sheetnames}
for n in wb.sheetnames: out[n] = [[("" if c is None else c) for c in row] for row in wb[n].iter_rows(values_only=True)]
print(json.dumps(out, default=str))`, xf);
    check(!r.err && r.sheets.join("|") === "Summary|Ledger|Disposals|Witness confirmations|Sign-offs", "the workbook opens in openpyxl with its sheets: " + (r.err || r.sheets.join(", ")));
    if (!r.err){
      const L = r.Ledger, Dp = r.Disposals, C = r["Witness confirmations"], S = r.Summary;
      check(L[0][0] === "Date time (site)" && L[0][16] === "Movement ID" && L.length - 1 === ledger().length, `Ledger: every movement of the month (${L.length - 1}), the CSV's columns`);
      const d5 = Dp.find(x => x[1] === "GEO-T-0005"), d6 = Dp.find(x => x[1] === "GEO-T-0006");
      check(Dp.length === 3 && d5 && d5[7] === "Lab Technician B" && d5[8] === "" && d6 && d6[7] === "Lab Technician B" && d6[8] === "Yes", "Disposals: both, with their witness; the critical one confirmed in the witness's own account");
      const c4 = C.find(x => x[1] === "GEO-T-0004"), c6 = C.find(x => x[1] === "GEO-T-0006");
      check(C.length === 3 && c4 && c4[5] === "Storage" && c4[6] === "Lab Technician A" && c4[7] === "Lab Technician B" && c4[8] === "Confirmed" && c6 && c6[5] === "Coarse reject: Disposed" && /^W/.test(c6[10]), "Witness confirmations: the storage and the disposal, who asked and who confirmed");
      check(S.some(x => x[0] === "Sign-off" && x[1] === "Not signed off") && S.some(x => x[0] === "Received" && typeof x[1] === "number"), "Summary: the month check as numbers and the sign-off");
      check(r["Sign-offs"].length === 1, "Sign-offs: none yet, the header only");
    }
  } else console.log("  OK openpyxl is not installed: the workbook was not opened");
  await D.waitForSelector("#lgSignBtn"); await D.fill("#lgSignNote", "Checked against the paper book"); await D.click("#lgSignBtn"); await D.waitForTimeout(600);
  const pd = await saved(D, "pdf");
  check(pd.filename === `audit-pack-${month}.pdf` && pd.bin.startsWith("%PDF-1.4") && /%%EOF\n$/.test(pd.bin), "PDF: " + pd.filename);
  const pf = path.join(OUT, "out-audit-pack.pdf"); fs.writeFileSync(pf, Buffer.from(pd.bin, "latin1"));
  if (hasPy("pypdf")){
    const r = py(`import sys, json
from pypdf import PdfReader
rd = PdfReader(sys.argv[1], strict=True)
print(json.dumps({"n": len(rd.pages), "t": "\\n".join(p.extract_text() for p in rd.pages), "title": rd.metadata.title}))`, pf);
    const t = (r.t || "").replace(/\s+/g, " ");
    check(!r.err && r.n >= 1 && /Audit pack: /.test(r.title || ""), `the PDF opens in pypdf (strict), ${r.n} page(s): ${r.err || r.title}`);
    check(/ZIJIN · Assay Laboratory/.test(t) && /Sign-offs/.test(t) && /Lab Manager/.test(t) && /Checked against the paper book/.test(t), "it has the sign-off with its note");
    check(/Disposals and witnesses/.test(t) && /GEO-T-0005/.test(t) && /Witness confirmations on critical samples/.test(t) && /Storage/.test(t) && /In \/ out ledger/.test(t) && /Page 1 of/.test(t), "and the disposals, the confirmations, the ledger and page numbers");
  } else console.log("  OK pypdf is not installed: the PDF was not opened");
  await D.screenshot({ path: OUT + "/v34-ledger-audit.png" });
  const vt = await newUser(browser, { uid: "u_vt", name: "Viewer2", canEdit: false, names }); await signIn(vt, "viewer"); await tab(vt, "ledger"); await vt.waitForTimeout(500);
  check(!(await vt.$(".aud-pk")), "a viewer has no audit pack");

  check(!errors.length, "no page errors" + (errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""));
  console.log("Console errors:", JSON.stringify(errors.slice(0, 5)));
  await browser.close();
})().catch(e => { console.error("Error", e); process.exit(1); });
