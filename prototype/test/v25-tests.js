// v24c, third round: scan a bag label (camera or handheld scanner), receive several samples at once from the board, a second person
// for every disposal, the monthly ledger sign-off with a printable summary, and turnaround on the Results tab.
// Run: NODE_PATH=$(npm root -g) timeout 590 node v25-tests.js
process.env.V24 = "1";   // the defaults: no sign-off seeded by the harness
const fs = require("fs"), path = require("path"), os = require("os"), { execSync } = require("child_process");
const { chromium } = require("playwright");
const H = require("./harness");
const { store, errors, newUser, launch, signIn, fillForm, ids, open, doc, waitFor, ledger } = H;
const names = {};
const log = (...a) => console.log("•", ...a);
const check = (cond, msg) => { console.log(cond ? "  PASS" : "  FAIL", msg); if (!cond) process.exitCode = 1; };
const text = async (page, sel) => ((await page.textContent(sel).catch(() => "")) || "").replace(/\s+/g, " ").trim();
const DAY = 86400e3;
const waitText = async (page, sel, re, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms){ if (re.test(await text(page, sel))) return true; await page.waitForTimeout(100); } return false; };
const PDF = Buffer.from("%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer\n%%EOF");
const JSQR = [path.join(__dirname, "..", "..", "app", "jsqr.js"), process.env.AZ_ROOT ? path.join(process.env.AZ_ROOT, "app", "jsqr.js") : ""].find(f => f && fs.existsSync(f));

(async () => {
  const browser = await launch();
  const Tc = await newUser(browser, { uid: "u_t", name: "Tech", canEdit: true, names }); await signIn(Tc, "tech1");
  const Ad = await newUser(browser, { uid: "u_a", name: "Admin", canEdit: true, names }); await signIn(Ad, "admin");
  await Tc.waitForTimeout(800);

  log("Submissions wait under Awaiting receipt");
  await fillForm(Tc, "submit", { section: "PLT", type: "plant_feed", purpose: "plant", submitter: "Shift A", count: 1, tags: "MA-1" }); const [m1] = await ids(Tc);
  await fillForm(Tc, "submit", { section: "PLT", type: "carbon", purpose: "plant", submitter: "Shift A", count: 1, tags: "CA-1" }); const [c1] = await ids(Tc);
  await fillForm(Tc, "submit", { section: "GR", type: "bullion", purpose: "bullion", submitter: "Gold room", count: 1, tags: "BU-1", details: { bar: "D-0917", gross: "1200" } }); const [g1] = await ids(Tc);
  await fillForm(Tc, "submit", { section: "ENV", type: "env_water", purpose: "env", submitter: "Env officer", count: 1, tags: "EW-1" }); const [w1] = await ids(Tc);
  check([m1, c1, g1, w1].every(id => doc(id).stageKey === "submitted"), "four submissions wait for receipt");

  log("Receive several at once from the board");
  await H.tab(Tc, "board"); await Tc.waitForTimeout(500);
  await Tc.click('.stats.tiles [data-bpick="await"]'); await Tc.waitForSelector("#rmBox", { timeout: 5000 }).catch(() => {});
  const boxes = await Tc.$$eval("#bdPick [data-rm]", x => x.map(c => c.dataset.rm));
  check([m1, c1, g1].every(id => boxes.includes(id)) && !boxes.includes(w1) && /one by one/.test(await text(Tc, "#bdPick")), "the Awaiting receipt list has a tick per sample; a cooler sample (environmental water) is received on its own record");
  check(await Tc.$eval("#rmBtn", b => b.disabled), "with nothing ticked the button waits");
  await Tc.check(`[data-rm="${m1}"]`); await Tc.waitForTimeout(150); await Tc.check(`[data-rm="${g1}"]`); await Tc.waitForTimeout(150);
  check(/Receive 2 ticked/.test(await text(Tc, "#rmBtn")) && !!(await Tc.$("#rmWit")), "two ticked; bullion brings in the witness");
  await Tc.click("#rmBtn"); await Tc.waitForTimeout(200);
  check(/Tick that the bags match/.test(await H.toastText(Tc)) && doc(m1).stageKey === "submitted", "the condition box must be ticked first");
  await Tc.check("#rmOk"); await Tc.click("#rmBtn"); await Tc.waitForTimeout(200);
  check(/witness/.test(await H.toastText(Tc)) && doc(g1).stageKey === "submitted", "and a witness chosen for two-person custody");
  check(!(await Tc.$$eval("#rmWit option", os => os.map(o => o.textContent))).some(t => /results/.test(t)), "witnesses are lab staff only (no section accounts)");
  await Tc.selectOption("#rmWit", { label: "Lab Supervisor" }); await Tc.click("#rmBtn");
  await waitFor(() => doc(m1).stageKey === "received" && doc(g1).stageKey === "received", 8000);
  check(doc(m1).stageKey === "received" && doc(g1).stageKey === "received" && doc(c1).stageKey === "submitted" && doc(g1).recv?.wit === "Lab Supervisor" && doc(m1).receivedBy === "Lab Technician A",
    "the two ticked are received by the technician, the bullion with its witness; the carbon still waits");
  await waitFor(() => ledger().filter(m => [m1, g1].includes(m.sid) && m.dir === "in").length === 2, 5000);
  check(ledger().filter(m => [m1, g1].includes(m.sid) && m.dir === "in").length === 2 && /Received with others from the board/.test(doc(m1).history.at(-1).note), "each gets its IN movement and a custody line");

  log("Scan the bags: a handheld scanner (or the camera) ticks them");
  if (!(await Tc.$("#rmScan"))) await Tc.click('.stats.tiles [data-bpick="await"]');
  await Tc.click("#rmScan"); await Tc.waitForSelector("#scanBox");
  await Tc.waitForFunction(() => /camera|handheld/i.test(document.querySelector("#scanStatus")?.textContent || ""), null, { timeout: 5000 }).catch(() => {});
  check(/camera/i.test(await text(Tc, "#scanStatus")) && !!(await Tc.$("#scanInput")), "the scanner says what the camera is doing and takes a typed or handheld-scanned code: " + await text(Tc, "#scanStatus"));
  for (const code of ["ca-1", "NOT-A-SAMPLE"]){ await Tc.fill("#scanInput", code); await Tc.press("#scanInput", "Enter"); await Tc.waitForTimeout(150); }
  const lg = await Tc.$$eval("#scanLog li", l => l.map(x => x.className + ":" + x.textContent));
  check(lg.some(x => x.startsWith("ok:") && x.includes(c1)) && lg.some(x => x.startsWith("warn:") && /not waiting/.test(x)), "a site sample code ticks its sample; an unknown code says so: " + lg.join(" | "));
  await Tc.click("#scanClose"); await Tc.waitForTimeout(300);
  check(await Tc.$eval(`[data-rm="${c1}"]`, c => c.checked).catch(() => false), "the scanned bag is ticked on the list");
  await Tc.check("#rmOk"); await Tc.click("#rmBtn"); await waitFor(() => doc(c1).stageKey === "received", 8000);
  check(doc(c1).stageKey === "received", "and received with one press");

  log("Scan to open: the label's tracking link opens the sample at its receipt");
  check(!!(await Tc.$("#scanBtn")) && /Scan/.test(await text(Tc, "#scanBtn")), "a Scan button sits beside Track sample");
  await Tc.click("#scanBtn"); await Tc.waitForSelector("#scanBox");
  await Tc.fill("#scanInput", "https://lab.example/#" + w1); await Tc.press("#scanInput", "Enter");
  await Tc.waitForFunction(id => document.querySelector(".sid")?.textContent === id, w1, { timeout: 8000 }).catch(() => {});
  check(await text(Tc, ".sid") === w1 && !(await Tc.$("#scanBox")) && !!(await Tc.$("#moveForm #rcTemp")), "the tracking link opens the environmental water sample at its receipt form (cooler temperature asked)");

  log("Scan with the camera: the label this site prints is read from the camera");
  let ff = ""; try { ff = execSync("command -v ffmpeg", { shell: "/bin/sh" }).toString().trim(); } catch {}
  if (!ff || !JSQR && !process.env.AZ_ROOT) console.log("  (skipped: needs ffmpeg and the QR reader file)");
  else {
    await fillForm(Tc, "submit", { section: "EXP", type: "rc", purpose: "exp", submitter: "Geo", count: 1, tags: "CAM-1" }); const [k1] = await ids(Tc);
    await open(Tc, k1); await Tc.click(`[data-label="${k1}"]`); await Tc.waitForSelector("#labelBox .bl-qr svg");
    const png = path.join(os.tmpdir(), `v25-qr-${process.pid}.png`), y4m = png.replace(".png", ".y4m");
    await (await Tc.$("#labelBox .bl-qr")).screenshot({ path: png }); await Tc.click("#lbClose");
    execSync(`ffmpeg -y -loglevel error -loop 1 -i ${png} -t 3 -r 10 -vf "scale=360:360:flags=neighbor,pad=640:480:140:60:white,format=yuv420p" ${y4m}`);
    const cam = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", `--use-file-for-fake-video-capture=${y4m}`] });
    const P = await newUser(cam, { uid: "u_c", name: "Camera", canEdit: true, names });
    await P.context().grantPermissions(["camera"]).catch(() => {});
    if (JSQR) await P.context().route(/cdn\.jsdelivr\.net\/npm\/jsqr/, r => r.fulfill({ status: 200, contentType: "text/javascript", body: fs.readFileSync(JSQR) }));
    await signIn(P, "tech1"); await P.waitForTimeout(600);
    await P.click("#scanBtn");
    const seen = await P.waitForFunction(id => document.querySelector(".sid")?.textContent === id, k1, { timeout: 15000 }).then(() => true, () => false);
    check(seen && !!(await P.$("#moveForm")) && !(await P.$("#scanBox")), "the camera reads the printed label's QR code and opens the sample at its receipt" + (seen ? "" : ": " + await text(P, "#scanStatus")));
    await cam.close(); try { fs.unlinkSync(png); fs.unlinkSync(y4m); } catch {}
  }

  log("Disposal needs a second person");
  await open(Tc, m1); await H.attachFile(Tc, `sample:${m1}`, "report.pdf", PDF); await H.saveAttach(Tc); await waitFor(() => (doc(m1).materials || []).length, 8000);
  await open(Tc, m1); await Tc.waitForTimeout(300);
  const mk = (doc(m1).materials || []).find(m => m.status === "kept")?.k;
  check(!!mk && await Tc.$eval("#mtWitBox", b => b.hidden).catch(() => false), "released: no witness is asked for while nothing is being disposed");
  await Tc.selectOption(`#mx_${mk}`, "disposed"); await Tc.waitForTimeout(100);
  check(/Witness to the disposal/.test(await text(Tc, "label:has(#mtWit)")) && await Tc.$eval("#mtWitBox", (b, k) => !b.hidden && !!b.closest("tr.mat-ctl")?.querySelector("#mx_" + k), mk).catch(() => false), "choosing Dispose asks for the witness, on that material's row");
  await Tc.click(`[data-mat="${mk}"]`); await Tc.waitForTimeout(300);
  check(/second person/.test(await H.toastText(Tc)) && doc(m1).materials.find(m => m.k === mk).status === "kept", "disposing with no witness is refused");
  await Tc.selectOption(`#mx_${mk}`, "disposed"); await Tc.selectOption("#mtWit", { label: "Lab Supervisor" }); await Tc.click(`[data-mat="${mk}"]`);
  await waitFor(() => doc(m1).materials.find(m => m.k === mk).status === "disposed", 6000);
  await waitFor(() => ledger().some(m => m.sid === m1 && m.dir === "out"), 5000);
  const dm = ledger().find(m => m.sid === m1 && m.dir === "out");
  check(doc(m1).materials.find(m => m.k === mk).status === "disposed" && doc(m1).history.at(-1).wit === "Lab Supervisor" && dm?.kind === "disposed" && dm?.wit === "Lab Supervisor", "with a witness it is disposed; the witness is on the custody line and the ledger");
  await fillForm(Tc, "submit", { section: "EXP", type: "rc", purpose: "exp", submitter: "Geo", count: 1, tags: "RJ-1" }); const [r1] = await ids(Tc);
  await open(Tc, r1); await Tc.fill("#mvNote", "Bag torn, sample spilt"); await Tc.click("#rejBox summary"); await Tc.selectOption("#rcDisp", "disposed"); await Tc.click('[data-receipt="reject"]'); await Tc.waitForTimeout(300);
  check(/second person/.test(await H.toastText(Tc)) && doc(r1).stageKey === "submitted", "rejecting a sample to be disposed of needs the witness too");
  await Tc.selectOption("#rcDispWit", { label: "Lab Supervisor" }); await Tc.click('[data-receipt="reject"]'); await waitFor(() => doc(r1).stageKey === "rejected", 6000);
  await waitFor(() => ledger().some(m => m.sid === r1 && m.dir === "out"), 5000);
  check(doc(r1).stageKey === "rejected" && ledger().find(m => m.sid === r1 && m.dir === "out")?.wit === "Lab Supervisor", "with it the sample is rejected and disposed, witnessed");

  log("Monthly ledger sign-off");
  const month = new Date().toISOString().slice(0, 7);
  await H.tab(Tc, "ledger"); await Tc.waitForSelector("#lgSign", { timeout: 8000 }).catch(() => {});
  check(/Not signed off/.test(await text(Tc, "#lgSign")) && !(await Tc.$("#lgSignBtn")) && !!(await Tc.$("#lgSummary")), "a technician sees the month is not signed off and can open the summary, but not sign it off");
  await H.tab(Ad, "ledger"); await Ad.waitForSelector("#lgSignBtn", { timeout: 8000 }).catch(() => {});
  await Ad.fill("#lgSignNote", "Shelf count agrees"); await Ad.click("#lgSignBtn");
  await waitFor(() => store["signoff/" + month]?.signs?.length === 1, 6000);
  const sg1 = store["signoff/" + month]?.signs?.[0];
  check(sg1 && sg1.tech === "Lab Manager" && Number.isInteger(sg1.closing) && sg1.closing === sg1.opening + sg1.ins - sg1.outs && sg1.note === "Shelf count agrees", "the lab manager signs off the month; the numbers are kept with the name and note: " + JSON.stringify(sg1));
  await waitText(Ad, "#lgSign", /Signed off by Lab Manager/, 5000);
  check(/Signed off by Lab Manager/.test(await text(Ad, "#lgSign")) && !(await Ad.$("#lgSignBtn")), "the ledger says who signed it off and when");
  await open(Tc, w1); await Tc.fill("#rcTemp", "4"); await Tc.click('[data-receipt="confirm"]'); await waitFor(() => doc(w1).stageKey === "received", 6000);
  await H.tab(Ad, "ledger");
  await waitText(Ad, "#lgSign", /changed after sign-off/, 8000);
  check(/The month changed after sign-off/.test(await text(Ad, "#lgSign")) && /Sign off again/.test(await text(Ad, "#lgSignBtn")), "a movement after the sign-off shows, and the month can be signed off again");
  await Ad.click("#lgSignBtn"); await waitFor(() => store["signoff/" + month]?.signs?.length === 2, 6000);
  const sgs = store["signoff/" + month]?.signs || [];
  check(sgs.length === 2 && JSON.stringify(sgs[0]) === JSON.stringify(sg1) && sgs[1].ins === sg1.ins + 1, "signed off again; the first sign-off stays as it was");
  await Ad.click("#lgSummary"); await Ad.waitForSelector("#certBox:not([hidden])", { timeout: 5000 }).catch(() => {});
  const ms = await text(Ad, "#certBox");
  check(/In \/ out ledger/.test(ms) && (ms.match(/Signed off by/g) || []).length === 2 && ms.includes(w1) && /Print/.test(await text(Ad, "#certPrint")), "the month summary: the numbers, both sign-offs and every movement, ready to print");
  await Ad.click("#certClose");

  log("A results file on a sample never holds its release (v24c, 01:13: 'nothing should prevent the result from being released as far as there is an attachment')");
  await fillForm(Tc, "register", { section: "PLT", type: "plant_feed", purpose: "plant", submitter: "Shift C", count: 1, tags: "MA-OLD" }); const [o1] = await ids(Tc);
  for (let g = 0; g < 20; g++){
    await open(Tc, o1); await Tc.waitForTimeout(120);
    const st = await Tc.$eval('[data-step="next"]', b => b.textContent.trim()).catch(() => "");
    if (!/^Move to:/.test(st) || /Results released/.test(st)) break;
    const k = doc(o1).stageKey; await Tc.click('[data-step="next"]').catch(() => {}); await waitFor(() => doc(o1).stageKey !== k, 4000);
  }
  // As a file attached before "any file" was accepted left it: the file kept as the results, one value read, AuSx missing, no att mark.
  const od = { ...doc(o1), results: { v: 1, at: Date.now(), by: "tech1", tech: "Lab Technician A", rows: { Au: { v: 1.21, raw: "1.21", by: "tech1", src: "file" } }, inst: "old-run.csv", file: { id: "RF-20261018-OLD1", name: "old-run.csv" } } };
  store["samples/" + o1] = od; await H.broadcast("samples/" + o1, od); await Tc.waitForTimeout(400);
  await open(Tc, o1); await Tc.waitForTimeout(300);
  const nx = await Tc.$eval('[data-step="next"]', b => b.textContent.trim()).catch(() => "");
  check(!(await Tc.$("#holdNote")) && /Release|Results released/.test(nx), "a sample whose results are a file, with a value missing, shows no hold and offers the release: " + nx + (await Tc.$("#holdNote") ? " / " + await text(Tc, "#holdNote") : ""));
  await Tc.click('[data-step="next"]').catch(() => {}); await waitFor(() => (doc(o1).certs || []).length, 6000);
  check((doc(o1).certs || []).length === 1 && doc(o1).certs[0].file?.name === "old-run.csv", "released, the certificate naming the file");

  log("Turnaround on the Results tab");
  const back = H.localStr ? H.localStr(Date.now() - 3 * DAY) : "";
  await fillForm(Tc, "register", { section: "PLT", type: "plant_feed", purpose: "plant", submitter: "Shift B", count: 1, tags: "MA-LATE", recvAt: back }); const [l1] = await ids(Tc);
  await open(Tc, l1); await H.attachFile(Tc, `sample:${l1}`, "late.pdf", PDF); await H.saveAttach(Tc); await waitFor(() => (doc(l1).certs || []).length, 8000);
  await open(Tc, c1); await H.attachFile(Tc, `sample:${c1}`, "carbon.pdf", PDF); await H.saveAttach(Tc); await waitFor(() => (doc(c1).certs || []).length, 8000);
  await H.tab(Ad, "results"); await Ad.waitForSelector("#tatBox", { timeout: 8000 }).catch(() => {});
  const sum = await text(Ad, "#tatBox summary");
  const mm = sum.match(/(\d+) of (\d+) on time/);
  check(!!mm && +mm[2] >= 3 && +mm[1] < +mm[2], "the Results tab shows turnaround, with the sample received three days ago late: " + sum);
  await Ad.click("#tatBox summary"); await Ad.waitForTimeout(200);
  const heads = await Ad.$$eval("#tatBox table.tat-tbl thead th:first-child", ts => ts.map(t => t.textContent.trim()));
  const plt = await Ad.$$eval("#tatBox table.tat-tbl tbody tr", rs => rs.map(r => [...r.children].map(c => c.textContent.trim())));
  check(heads.join() === "Section,Analysis" && plt.some(r => /^PLT/.test(r[0]) && +r[3] >= 1) && plt.some(r => /Slurry: AuFx & AuSx/.test(r[0]) && +r[3] >= 1), "by section and by analysis, the late one counted against PLT and its analysis: " + JSON.stringify(plt));

  log("The workflow ticks Results released once they are (v24d, 02:05: 'after the result is released, that section of the workflow still stays unchecked')");
  const rail = page => page.$$eval(".rail li", ls => ls.map(l => ({ n: l.querySelector(".st-name")?.textContent.trim(), c: l.className, m: l.querySelector(".dot")?.textContent, t: l.querySelector(".st-meta")?.textContent.replace(/\s+/g, " ").trim() })));
  const li = (r, n) => r.find(x => x.n?.startsWith(n)) || {};
  await fillForm(Tc, "register", { section: "PLT", type: "ccd", purpose: "plant", submitter: "Shift D", count: 1, tags: "CCD-RAIL" }); const [q1] = await ids(Tc);
  await open(Tc, q1); await H.attachFile(Tc, `sample:${q1}`, "ccd.csv", Buffer.from("Sample,AuFx\nX,1.2\n")); await H.saveAttach(Tc); await waitFor(() => (doc(q1).certs || []).length, 8000);
  await open(Tc, q1); await Tc.waitForTimeout(300);
  let rr = await rail(Tc), rl = li(rr, "Results released"), sto = li(rr, "Retained in storage");
  const items = doc(q1).materials.map(m => m.item);
  check(doc(q1).stageKey === "released" && /done/.test(rl.c) && rl.m === "✓" && / · Lab Technician A$/.test(rl.t) && !/Started|due/.test(rl.t), "released: Results released is ticked, with when and who: " + JSON.stringify(rl));
  check(/current/.test(sto.c) && sto.t.startsWith("To put away: " + items.join(", ")) && / · due /.test(sto.t), "the storage step is the open one, naming the material to put away and when it is due: " + sto.t);
  check(new RegExp("Still to put away: " + items.join(", ")).test(await text(Tc, "#moveForm")), "and the action panel says what is still to put away");
  check(/^\w{4}-\w{4}-\w{4}-\w{4}$/.test(await Tc.$eval("#resPanel .mono.nw", e => e.textContent).catch(() => "")) && await Tc.$eval("#resPanel .mono.nw", e => getComputedStyle(e).whiteSpace).catch(() => "") === "nowrap", "the certificate's check code stays on one line");
  for (const m of doc(q1).materials){ await open(Tc, q1); await Tc.selectOption(`#mx_${m.k}`, "store"); await Tc.fill(`#mr_${m.k}`, "Rack " + m.k); await Tc.click(`[data-mat="${m.k}"]`); await waitFor(() => doc(q1).materials.find(x => x.k === m.k).loc, 6000); }
  await open(Tc, q1); await Tc.waitForTimeout(300); rr = await rail(Tc);
  check(doc(q1).stageKey === "storage" && /done/.test(li(rr, "Results released").c) && /current/.test(li(rr, "Retained in storage").c) && /materials? kept/.test(li(rr, "Retained in storage").t) && /All material is on the shelf/.test(await text(Tc, "#moveForm")), "all on the shelf: storage is the open step and the panel says so");
  check((await Tc.$$eval('#matBox select[id^="mx_"]', ss => ss.map(x => x.value))).every(v => v === "store") && await Tc.$eval("#mtWitBox", b => b.hidden), "before the retention date nothing irreversible is chosen for you (no disposal, no witness asked)");
  for (const m of doc(q1).materials){ await open(Tc, q1); await Tc.selectOption(`#mx_${m.k}`, "disposed"); await Tc.selectOption("#mtWit", { label: "Lab Supervisor" }); await Tc.click(`[data-mat="${m.k}"]`); await waitFor(() => doc(q1).materials.find(x => x.k === m.k).status === "disposed", 6000); }
  await open(Tc, q1); await Tc.waitForTimeout(300); rr = await rail(Tc);
  const last = rr.at(-1);
  check(doc(q1).open === false && rr.every(x => /done|skipped/.test(x.c)) && last.m === "✓" && / · Lab Technician A$/.test(last.t), "closed: every step is ticked, the closing step too: " + JSON.stringify(last));
  check((await text(Tc, "#matBox tbody")).includes("witness Lab Supervisor"), "the witness to each disposal shows on the material");
  await open(Tc, r1); await Tc.waitForTimeout(200); rr = await rail(Tc);
  check(/done stop/.test(rr.at(-1).c) && rr.at(-1).m === "✕" && /^Rejected/.test(rr.at(-1).n), "a rejected sample's last step is marked as stopped (✕), not left open");

  log("From the last lab step the sample waits on Results released; saving the results releases it (v24d, 11:29: 'the brown circle should be on the result release whiles waiting for result file upload or type in')");
  const walk = async (page, id) => { for (let g = 0; g < 25; g++){ await open(page, id); await page.waitForTimeout(120); const t = await page.$eval('#moveForm [data-step="next"]', b => b.textContent.trim()).catch(() => ""); if (!/^Move to:/.test(t)) return; if (await page.$("#mvWit")) await page.selectOption("#mvWit", { index: 1 }); const k = doc(id).stageKey; await page.click('#moveForm [data-step="next"]'); await waitFor(() => doc(id).stageKey !== k, 5000); } };
  const railOf = async page => (await rail(page)).map(x => ({ ...x, c: x.c.trim() }));
  await fillForm(Tc, "register", { section: "PLT", type: "plant_feed", purpose: "plant", submitter: "Shift E", count: 1, tags: "MA-WAIT" }); const [w2] = await ids(Tc);
  await walk(Tc, w2); await open(Tc, w2);
  let rw = await railOf(Tc);
  const lastName = rw[rw.findIndex(x => x.n === "Results released") - 1]?.n || "?";   // the step before the release, as the record shows it
  check(!(await Tc.$("#holdNote")) && /^Move to: Results released$/.test(await text(Tc, '#moveForm [data-step="wait"]')) && !(await Tc.$('#moveForm [data-step="next"]')) && /current/.test(li(rw, lastName).c),
    "at the last lab step with no results: no 'release on hold', the step offers Move to: Results released (" + lastName + " is the open step)");
  await Tc.click('[data-step="wait"]'); await waitFor(() => doc(w2).rw, 5000); await open(Tc, w2); await Tc.waitForTimeout(200); rw = await railOf(Tc);
  check(li(rw, lastName).m === "✓" && /current/.test(li(rw, "Results released").c) && /^Waiting for the results/.test(li(rw, "Results released").t) && /^\s*$/.test(li(rw, "Retained in storage").m || ""),
    "moved on: " + lastName + " is ticked and Results released is the open step, waiting for the results: " + li(rw, "Results released").t);
  check(/Waiting for results/.test(await text(Tc, ".card-head .pill")) && /Step (\d+) of \1: waiting for the results/.test(await text(Tc, ".prog-t")) && /^Waiting for the results: .*released when you save them/.test(await text(Tc, "#waitNote")),
    "the record says it is waiting for results (status, progress and a note naming them): " + await text(Tc, "#waitNote"));
  check(doc(w2).history.at(-1).rw === true && doc(w2).history.at(-1).key === doc(w2).stageKey && doc(w2).history.at(-1).sn === lastName, "the custody line records " + lastName + " done; the sample's step itself is unchanged");
  await Tc.click("#corrBox summary"); await Tc.selectOption("#mvKey", doc(w2).stageKey); await Tc.fill("#corrWhy", "Pressed too early"); await Tc.click("#corrBtn");
  await waitFor(() => doc(w2).rw === null, 5000); await open(Tc, w2); rw = await railOf(Tc);
  check(doc(w2).rw === null && /current/.test(li(rw, lastName).c) && !!(await Tc.$('[data-step="wait"]')), "pressed too early: a correction puts it back on " + lastName + ", not done yet");
  await Tc.click('[data-step="wait"]'); await waitFor(() => doc(w2).rw, 5000);
  await open(Tc, w2); await H.attachFile(Tc, `sample:${w2}`, "mill.csv", Buffer.from("Sample,AuFx\nX,1.2\n")); await H.saveAttach(Tc); await waitFor(() => (doc(w2).certs || []).length, 8000);
  await open(Tc, w2); await Tc.waitForTimeout(200); rw = await railOf(Tc);
  check(doc(w2).stageKey === "released" && li(rw, "Results released").m === "✓" && /current/.test(li(rw, "Retained in storage").c), "the file saved: released, Results released ticked green and Retained in storage is the open step");

  log("Two-person custody: the witness signs the release with the file or the typed results");
  await fillForm(Tc, "register", { section: "PLT", type: "conc", purpose: "recon", submitter: "Gold room", count: 2, tags: "GC-W", wit: "Lab Supervisor" }); const [g2, g3] = await ids(Tc);
  check(doc(g2).route === "CONC" && !!(await (async () => { await open(Tc, g2); return Tc.$("#mvWit"); })()), "gravity concentrates on CONC, two-person custody (a witness for every step): " + doc(g2).route + " " + JSON.stringify(doc(g2).haz));
  await walk(Tc, g2); await open(Tc, g2);
  await Tc.click('[data-step="wait"]'); await Tc.waitForTimeout(250);
  check(/witness/.test(await H.toastText(Tc)) && !doc(g2).rw, "moving it on needs the witness too");
  await Tc.selectOption("#mvWit", { index: 1 }); await Tc.click('[data-step="wait"]'); await waitFor(() => doc(g2).rw, 5000);
  check(!!doc(g2).history.at(-1).wit && doc(g2).history.at(-1).rw, "with the witness it waits for the results, the witness on the custody line");
  await open(Tc, g2); await H.attachFile(Tc, `sample:${g2}`, "conc.pdf", PDF); await Tc.waitForSelector("#upWit", { timeout: 5000 }).catch(() => {});
  check(/Witness to the release \(two-person custody: /.test(await text(Tc, "label:has(#upWit)")), "the results file dialog asks for the witness to the release");
  await Tc.click("#upSave"); await Tc.waitForTimeout(300);
  check(/choose the witness/.test(await H.toastText(Tc)) && !(doc(g2).certs || []).length, "without it nothing is saved or released");
  await Tc.selectOption("#upWit", { label: "Lab Supervisor" }); await H.saveAttach(Tc); await waitFor(() => (doc(g2).certs || []).length, 8000);
  const relE = doc(g2).history.find(h => h.key === "released");
  check((doc(g2).certs || []).length === 1 && relE?.wit === "Lab Supervisor" && /1 released with the file/.test(H.toasts.slice(-3).join(" ")), "with it the file releases the sample, the witness on the release: " + JSON.stringify(relE));
  await walk(Tc, g3); await open(Tc, g3); await Tc.selectOption("#mvWit", { index: 1 }); await Tc.click('[data-step="wait"]'); await waitFor(() => doc(g3).rw, 5000);
  await open(Tc, g3); await Tc.$eval("#resBox", d => { d.open = true; });
  for (const el of await Tc.$$("#resBox input[id^=rs_]")) await el.fill("1.5");
  await Tc.selectOption("#mvWit", { label: "Lab Supervisor" }); await Tc.click("#rsSave"); await waitFor(() => (doc(g3).certs || []).length, 6000);
  check((doc(g3).certs || []).length === 1 && doc(g3).history.find(h => h.key === "released")?.wit === "Lab Supervisor", "typed results with the witness chosen on the record release it too, witnessed");

  console.log("\nConsole errors:", JSON.stringify(errors));
  if (errors.length) process.exitCode = 1;
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
