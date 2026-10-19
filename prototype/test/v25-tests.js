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
  check(!!mk && /Witness, to dispose/.test(await text(Tc, "label:has(#mtWit)")), "released: the retained material carries a witness field for disposal");
  await Tc.selectOption(`#mx_${mk}`, "disposed"); await Tc.click(`[data-mat="${mk}"]`); await Tc.waitForTimeout(300);
  check(/second person/.test(await H.toastText(Tc)) && doc(m1).materials.find(m => m.k === mk).status === "kept", "disposing with no witness is refused");
  await Tc.selectOption("#mtWit", { label: "Lab Supervisor" }); await Tc.selectOption(`#mx_${mk}`, "disposed"); await Tc.click(`[data-mat="${mk}"]`);
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

  console.log("\nConsole errors:", JSON.stringify(errors));
  if (errors.length) process.exitCode = 1;
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
