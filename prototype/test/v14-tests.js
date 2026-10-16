// v14: Settings in tabs, lab working hours (due times count only shift time, except round-the-clock steps), trimmed step
// allowances, and printable bag labels with a QR code of the tracking link.
// Run: NODE_PATH=$(npm root -g) timeout 590 node v14-tests.js
const path = require("path");
const H = require("./harness");
const { store, errors, newUser, launch, signIn, fillForm, ids, open, doc, toastText, waitFor, cfgTab, localStr } = H;
let jsQR = null; try { jsQR = require(path.resolve(__dirname, "../deps/node_modules/jsqr")); } catch { try { jsQR = require("jsqr"); } catch {} }
const OUT = __dirname;
const names = { u_z: "Zuriel" };
const log = (...a) => console.log("•", ...a);
const check = (cond, msg) => { console.log(cond ? "  PASS" : "  FAIL", msg); if (!cond) process.exitCode = 1; };
const SHARE = "https://claude.ai/artifact/5JgoyE2wokT67u8TCtYDop";
const shown = (page, sel) => page.$eval(sel, e => !!e.offsetParent).catch(() => false);
const pill = page => page.$eval(".card-head .pill", e => e.textContent).catch(() => "");
/* Reads a QR code drawn as an SVG path of 1×1 squares and decodes it. */
async function readQr(page, sel){
  const { box, d } = await page.$eval(sel, s => ({ box: s.viewBox.baseVal.width, d: s.querySelector("path").getAttribute("d") }));
  if (!jsQR) return null;
  const sc = 4, W = box * sc, px = new Uint8ClampedArray(W * W * 4).fill(255);
  for (const m of d.matchAll(/M(\d+) (\d+)h1v1h-1z/g)){
    const x = +m[1], y = +m[2];
    for (let dy = 0; dy < sc; dy++) for (let dx = 0; dx < sc; dx++){ const i = ((y * sc + dy) * W + x * sc + dx) * 4; px[i] = px[i + 1] = px[i + 2] = 0; }
  }
  return jsQR(px, W, W)?.data || "";
}
const hm = ms => new Date(ms).toISOString().slice(11, 16);

(async () => {
  const browser = await launch();
  const P = await newUser(browser, { uid: "u_p", name: "Public", canEdit: true, names });
  const Tc = await newUser(browser, { uid: "u_t", name: "Tech", canEdit: true, names }); await signIn(Tc, "tech1");
  const Ad = await newUser(browser, { uid: "u_a", name: "Admin", canEdit: true, names }); await signIn(Ad, "admin");
  await P.waitForTimeout(1200);

  log("Settings in tabs");
  await Ad.click('[data-tab="stages"]'); await Ad.waitForSelector(".subtabs");
  const tabs = await Ad.$$eval("[data-cfgtab]", bs => bs.map(b => b.textContent));
  check(tabs.join("|") === "Accounts|Sections and site time|Reference materials|Limits|Results files|Workflow routes", "Settings has six tabs (Results files since v18): " + tabs.join(", "));
  check(await shown(Ad, "#userAdd") && await shown(Ad, "#cfgResPub") && !(await shown(Ad, "#secAdd")) && !(await shown(Ad, "#rtPick")) && await shown(Ad, "#cfgSave"), "Accounts opens first, with who can see results; other groups are hidden; Save stays");
  await cfgTab(Ad, "limits");
  check(await shown(Ad, "#limAdd") && !(await shown(Ad, "#userAdd")) && await Ad.$eval('[data-cfgtab="limits"]', b => b.getAttribute("aria-selected")) === "true", "the Limits tab shows only the limits");
  await cfgTab(Ad, "sections");
  check(await shown(Ad, "#secAdd") && await shown(Ad, "#cfgTz") && await shown(Ad, "#wkMode") && await Ad.$eval("#wkMode", s => s.value) === "", "Sections and site time holds sections, time zone and lab working hours (round the clock by default)");
  const secName = '[data-si="1"][data-sf="name"]';
  await Ad.fill(secName, "Exploration geology"); await Ad.press(secName, "Tab"); await Ad.waitForTimeout(150);
  await cfgTab(Ad, "routes");
  check(/Unsaved changes/.test(await Ad.textContent("#view-stages")) && await shown(Ad, "#rtPick"), "an edit on one tab is kept, and marked unsaved, while another tab is open");
  await Ad.click("#cfgSave"); await waitFor(() => store["settings/stages"]?.sections?.[1]?.name === "Exploration geology"); await Ad.waitForTimeout(400);
  if (process.env.DBG) console.log(JSON.stringify({ s: store["settings/stages"]?.sections?.[1], w: store["settings/stages"]?.work, u: /Unsaved changes/.test(await Ad.textContent("#view-stages")) }));
  check(store["settings/stages"]?.sections?.[1]?.name === "Exploration geology" && store["settings/stages"].work === null && !/Unsaved changes/.test(await Ad.textContent("#view-stages")), "one Save stores every tab (working hours saved as round the clock)");
  const rows = await Ad.$$eval('[data-rk="clock"]', es => es.map(e => [e.closest("tr").querySelector('[data-rk="name"]').value, e.checked]));
  check(rows.find(r => /^Drying at 105/.test(r[0]))?.[1] === true && rows.find(r => /^Fusion/.test(r[0]))?.[1] === false, "route steps show Round the clock: drying ticked, fusion not");
  check(await Ad.$eval('[data-ri="1"][data-rk="hours"]', e => e.value) === "8" && await Ad.$eval('[data-ri="2"][data-rk="hours"]', e => e.value) === "2", "trimmed defaults: EXP-FA drying 8 h, crushing 2 h");

  log("Lab working hours");
  await cfgTab(Ad, "sections");
  await Ad.selectOption("#wkMode", "1"); await Ad.waitForTimeout(150);
  for (const d of [1, 2, 3, 4, 5, 6]) await Ad.uncheck(`[data-wday="${d}"]`);
  await Ad.waitForTimeout(150); await Ad.uncheck('[data-wday="0"]').catch(() => {});
  await cfgTab(Ad, "accounts"); await Ad.click("#cfgSave"); await Ad.waitForTimeout(250);
  check(/at least one working day/.test(await toastText(Ad)) && await Ad.$eval('[data-cfgtab="sections"]', b => b.getAttribute("aria-selected")) === "true", "Save refuses a calendar with no working day and opens the tab that needs fixing");
  // One shift that starts in the coming hour, every day: nothing of the last three hours is working time.
  const now = Date.now(), h = new Date(now).getUTCHours(), from = String((h + 1) % 24).padStart(2, "0") + ":00", to = String((h + 2) % 24).padStart(2, "0") + ":00";
  for (const d of [0, 1, 2, 3, 4, 5, 6]) await Ad.check(`[data-wday="${d}"]`);
  await Ad.fill('[data-wsi="0"][data-wsf="from"]', from); await Ad.press('[data-wsi="0"][data-wsf="from"]', "Tab"); await Ad.waitForTimeout(100);
  await Ad.fill('[data-wsi="0"][data-wsf="to"]', to); await Ad.press('[data-wsi="0"][data-wsf="to"]', "Tab"); await Ad.waitForTimeout(100);
  await Ad.fill("#wkOffNew", "2026-12-25"); await Ad.click("#wkOffAdd"); await Ad.waitForTimeout(100);
  check(/7 working hours a week/.test(await Ad.textContent("#view-stages")), "the tab adds up the working week (7 days × 1 h)");
  await Ad.click("#cfgSave"); await waitFor(() => store["settings/stages"]?.work);
  const w = store["settings/stages"].work;
  check(w && w.days.join() === "0,1,2,3,4,5,6" && w.shifts.length === 1 && w.shifts[0].from === from && w.shifts[0].to === to && w.off.join() === "2026-12-25", `working days, shift ${from}–${to} and a closed day are saved`);
  await Ad.screenshot({ path: OUT + "/v14-settings-hours.png", fullPage: true });

  await fillForm(Tc, "register", { section: "GEO", submitter: "Walk-in", type: "core", purpose: "exp", recvAt: localStr(now - 3 * 3600e3) });
  const wk = (await ids(Tc))[0];
  await open(Tc, wk); await Tc.waitForTimeout(300);
  const due = Date.parse(new Date(now).toISOString().slice(0, 11) + to + "Z") + (h + 2 >= 24 ? 86400e3 : 0);
  check(/In progress/.test(await pill(Tc)) && !/Overdue/.test(await pill(Tc)), "received 3 h ago with 1 h allowed, but no working time has passed: not overdue (" + await pill(Tc) + ")");
  const tl = await Tc.textContent(".timeline").catch(async () => await Tc.textContent("#view-track"));
  const h12 = String((new Date(due).getUTCHours() + 11) % 12 + 1).padStart(2, "0") + hm(due).slice(2);
  check(new RegExp(`due [^·]*(${hm(due)}|${h12})`).test(tl), `the receipt step is due at the end of the next shift, ${hm(due)}`);
  await Ad.selectOption("#wkMode", ""); await Ad.waitForTimeout(150); await Ad.click("#cfgSave"); await waitFor(() => store["settings/stages"]?.work === null);
  await Tc.waitForTimeout(500); await open(Tc, wk); await Tc.waitForTimeout(300);
  check(/Overdue/.test(await pill(Tc)), "back to round the clock, the same sample is overdue (" + await pill(Tc) + ")");

  log("Bag labels with a QR code");
  await fillForm(P, "submit", { section: "EXP", submitter: "Ama", count: 2, tags: "T-501, T-502" }); const ex = await ids(P);
  check(await P.$eval("#rLabels", b => b.textContent) === "Print 2 labels", "the confirmation offers Print labels (v20: with the count)");
  await P.click("#rLabels"); await P.waitForSelector("#labelBox .bag-label");
  const labels = await P.$$eval("#labelBox .bag-label", ls => ls.map(l => l.textContent.replace(/\s+/g, " ")));
  check(labels.length === 2 && labels[0].includes(ex[0]) && labels[0].includes("T-501") && labels[1].includes(ex[1]) && labels[1].includes("T-502") && /Section ?EXP/.test(labels[0]) && /Submitted/.test(labels[0]) && /Type/.test(labels[0]), "one label per sample with its ID, tag, type, section and date");
  const q0 = await readQr(P, "#labelBox .bag-label:nth-child(1) svg.qr"), q1 = await readQr(P, "#labelBox .bag-label:nth-child(2) svg.qr");
  check(jsQR ? q0 === SHARE + "#" + ex[0] && q1 === SHARE + "#" + ex[1] : false, `each QR code scans to its tracking link (${q0})`);
  const size = await P.$eval("#labelBox .bag-label", l => [l.getBoundingClientRect().width, l.getBoundingClientRect().height].map(Math.round));
  check(Math.abs(size[0] - 378) <= 2 && Math.abs(size[1] - 189) <= 2, `labels are 100 × 50 mm (${size.join(" × ")} px)`);
  await P.screenshot({ path: OUT + "/v14-labels.png" });
  await P.selectOption("#lbPaper", "roll");
  check(await P.$eval("#labelBox .label-sheet", e => e.className) === "label-sheet roll", "paper can be switched to a label printer roll");
  await P.click("#lbDl"); await P.waitForTimeout(200);
  const dl = await P.evaluate(() => window.__downloaded);
  check(dl?.filename === `labels-${ex[0]}-2.html` && (dl.data.match(/class="bag-label"/g) || []).length === 2 && /@page\{size:100mm 50mm/.test(dl.data), "Download gives a standalone page of the labels for the chosen paper");
  await P.keyboard.press("Escape");
  check(await P.$eval("#labelBox", b => b.hidden), "Escape closes the labels");
  await open(P, ex[0]);
  await P.click(`[data-label="${ex[0]}"]`); await P.waitForSelector("#labelBox .bag-label");
  check((await P.$$("#labelBox .bag-label")).length === 1 && (await P.textContent("#labelBox")).includes(ex[0]), "Print label on the sample's page shows its label");
  await P.click("#lbClose");

  log("Scanning a label");
  await Tc.evaluate(id => { location.hash = "#" + id; }, ex[1]);
  await Tc.waitForFunction(id => document.querySelector(".sid")?.textContent === id, ex[1], { timeout: 6000 }).catch(() => {});
  check(await Tc.$eval(".sid", e => e.textContent).catch(() => "") === ex[1] && !!(await Tc.$('[data-receipt="confirm"]')), "a scanned tracking link opens the sample for a signed-in technician, ready to confirm receipt");
  const T2 = await newUser(browser, { uid: "u_t2", name: "Tech two", canEdit: true, names }); await signIn(T2, "tech2");
  await T2.goto(H.FILE + "#" + ex[0]); await T2.waitForSelector(".sid", { timeout: 8000 }); await T2.waitForTimeout(600);
  check(await T2.$eval(".sid", e => e.textContent) === ex[0] && !!(await T2.$('[data-receipt="confirm"]')), "opening the tracking link in a new tab also lands on the sample with receipt actions");
  await P.goto(H.FILE + "#" + ex[0]); await P.waitForSelector(".sid", { timeout: 8000 }); await P.waitForTimeout(400);
  check(await P.$eval(".sid", e => e.textContent) === ex[0] && !(await P.$('[data-receipt="confirm"]')), "for anyone else the link is the public tracking page");

  log("Phone");
  const M = await newUser(browser, { uid: "u_m", name: "Phone", canEdit: true, names }, { width: 375, height: 760 });
  await signIn(M, "admin"); await H.tab(M, "stages"); await M.waitForSelector(".subtabs");
  for (const k of ["accounts", "sections", "crms", "limits", "routes"]){ await cfgTab(M, k); const sw = await M.evaluate(() => document.documentElement.scrollWidth); if (sw > 376) check(false, `phone: Settings ${k} scrolls sideways (${sw})`); }
  await open(M, ex[0]); await M.click(`[data-label="${ex[0]}"]`); await M.waitForSelector("#labelBox .bag-label");
  check(await M.evaluate(() => document.documentElement.scrollWidth) <= 376, "on a phone, Settings tabs and the label preview fit the screen");
  await M.screenshot({ path: OUT + "/v14-phone-label.png" });

  check(errors.length === 0, "no console errors " + errors.join(" | "));
  console.log("\nConsole errors:", errors.length ? errors : "none");
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
