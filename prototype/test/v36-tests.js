// v36 (22 Oct, "revising the page font size" ... "the text look okay but it seems small. i think we can enhance the page UI/UX"): one type
// scale a step larger, with a Small / Normal / Large text size kept on each device (Small is the size before v36); buttons one size; lane
// counts as badges; the certificate keeps its fixed print sizes. Values here are made up.
// Run: NODE_PATH=$(npm root -g) timeout 590 node v36-tests.js
process.env.V24 = "1";
const H = require("./harness");
const { errors, newUser, launch, signIn, open, fillForm, ids } = H;
const names = {};
const log = (...a) => console.log("•", ...a);
const check = (cond, msg) => { console.log(cond ? "  PASS" : "  FAIL", msg); if (!cond) process.exitCode = 1; };
const OUT = __dirname;
const px = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); return e ? parseFloat(getComputedStyle(e).fontSize) : 0; }, sel);
const near = (a, b) => Math.abs(a - b) < 0.35;
/* The smallest text on screen: every visible element with its own text, leaving out the certificate, bag labels, charts and the phone's tab bar. */
const smallest = page => page.evaluate(() => {
  let min = 99, at = "";
  for (const e of document.querySelectorAll("body *")){
    if (e.closest(".cert,.cert-overlay,svg,#tabs,[hidden],.toast") || ![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const r = e.getBoundingClientRect(); if (!r.width || !r.height || getComputedStyle(e).visibility === "hidden") continue;
    const f = parseFloat(getComputedStyle(e).fontSize); if (f < min){ min = f; at = (e.className || e.tagName) + ": " + e.textContent.trim().slice(0, 30); }
  }
  return { min, at };
});
const noSideScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
const kind = async (page, k) => { await page.check(`input[name="rKind"][value="${k}"]`); await page.waitForTimeout(350); };

(async () => {
  const browser = await launch();
  const Tc = await newUser(browser, { uid: "u_t", name: "Tech", canEdit: true, names }); await signIn(Tc, "tech1");
  const made = [];
  for (const section of ["GEO", "EXP"]){ await fillForm(Tc, "submit", { section }); made.push(...await ids(Tc)); }
  await fillForm(Tc, "submit", { section: "EXP", count: 3 }); made.push(...await ids(Tc));
  const Ad = await newUser(browser, { uid: "u_a", name: "Admin", canEdit: true, names }); await signIn(Ad, "admin");
  await Ad.waitForTimeout(500);

  log("One type scale, a step larger (Normal)");
  check(near(await px(Ad, "body"), 19.95) && near(await px(Ad, "label.f") || 18.9, 18.9) && near(await px(Ad, "header.top .who"), 17.85), "body text about 20 px, labels 19 px, secondary text 18 px");
  check(await px(Ad, "header.top .lookup .btn.big") === await px(Ad, "#signBtn"), "Track sample and Sign out are the same size");
  check(await px(Ad, '#tabs>button[data-tab="board"]') >= 18.5, "the tabs are 19 px (16 px before)");
  const screens = {};
  await H.tab(Ad, "board"); await Ad.waitForTimeout(400); screens.board = await smallest(Ad);
  check(await Ad.$eval(".lane h4 span", e => parseFloat(getComputedStyle(e).borderTopLeftRadius) > 5 && parseFloat(getComputedStyle(e).fontSize) >= 15), "a lane's count is a badge of at least 15 px (12 px before)");
  const bh = await Ad.$eval(".bd-view", e => e.getBoundingClientRect().height), wh = await Ad.$eval("#bdWall", e => e.getBoundingClientRect().height);
  check(Math.abs(bh - wh) <= 2, `Lanes | List is as tall as Wall screen beside it (${bh} / ${wh})`);
  await open(Ad, made[0]); screens.record = await smallest(Ad);
  await H.tab(Ad, "submit"); await Ad.waitForTimeout(300); screens.submit = await smallest(Ad);
  await kind(Ad, "batch"); screens.batch = await smallest(Ad);
  await kind(Ad, "job"); screens.shiftEnd = await smallest(Ad);
  await kind(Ad, "met"); screens.metJob = await smallest(Ad);
  await kind(Ad, "single");
  for (const t of ["results", "storage", "ledger", "routes", "stages"]){ await H.tab(Ad, t); await Ad.waitForTimeout(400); screens[t] = await smallest(Ad); }
  const low = Object.entries(screens).filter(([, v]) => v.min < 14.5);
  check(!low.length, "no text under 14.5 px on Board, Sample, Submit (all four kinds), Results, Storage, Ledger, Routes, Settings: " + JSON.stringify(low.length ? low : Object.fromEntries(Object.entries(screens).map(([k, v]) => [k, v.min]))));

  log("Text size: Aa in the header, Small / Normal / Large, kept on this device");
  await H.tab(Ad, "board"); await Ad.waitForTimeout(300);
  check(await Ad.isVisible("#textBtn") && await Ad.isHidden("#textMenu"), "Aa sits in the header; its menu is closed");
  await Ad.click("#textBtn");
  check(await Ad.isVisible("#textMenu") && await Ad.getAttribute("#textBtn", "aria-expanded") === "true" && await Ad.getAttribute('#textMenu [data-text=""]', "aria-pressed") === "true", "Aa opens Small / Normal / Large with Normal chosen");
  await Ad.screenshot({ path: OUT + "/v36-text-menu.png", clip: { x: 640, y: 0, width: 640, height: 200 } });
  await Ad.click('#textMenu [data-text="large"]'); await Ad.waitForTimeout(200);
  check(await Ad.evaluate(() => document.documentElement.dataset.text) === "large" && near(await px(Ad, "body"), 22.04) && await Ad.getAttribute('#textMenu [data-text="large"]', "aria-pressed") === "true", "Large makes the text about 22 px");
  await Ad.screenshot({ path: OUT + "/v36-board-large.png" });
  await Ad.click("main, .wrap", { position: { x: 5, y: 600 } }).catch(() => {}); await Ad.waitForTimeout(100);
  check(await Ad.isHidden("#textMenu") && await Ad.getAttribute("#textBtn", "aria-expanded") === "false", "a click elsewhere closes the menu");
  const certTd = () => Ad.evaluate(() => { const d = document.createElement("div"); d.className = "cert"; d.innerHTML = "<table><tr><th>a</th><td>b</td></tr></table><p class='small'>c</p>"; document.body.append(d); const f = s => parseFloat(getComputedStyle(d.querySelector(s)).fontSize); const r = [f("td"), f("th"), f(".small")].join("/"); d.remove(); return r; });
  const certLarge = await certTd();
  await Ad.reload(); await Ad.waitForTimeout(500);
  check(await Ad.evaluate(() => document.documentElement.dataset.text) === "large" && near(await px(Ad, "body"), 22.04), "the choice stays after a reload (kept on this device)");
  await Ad.click("#textBtn"); await Ad.click('#textMenu [data-text="small"]'); await Ad.waitForTimeout(200);
  check(near(await px(Ad, "body"), 18.05) && near(await px(Ad, "label.f") || 17.1, 17.1), "Small is the size before v36 (body 18 px)");
  check(await certTd() === certLarge && certLarge === "17/15/16", "the certificate keeps its print sizes whatever the choice: " + certLarge);
  await Ad.keyboard.press("Escape"); await Ad.waitForTimeout(100);
  check(await Ad.isHidden("#textMenu") && await Ad.evaluate(() => document.activeElement?.id) === "textBtn", "Escape closes the menu and returns to Aa");
  await Ad.click("#textBtn"); await Ad.click('#textMenu [data-text=""]'); await Ad.waitForTimeout(150);
  check(await Ad.evaluate(() => !document.documentElement.dataset.text && !localStorage.getItem("textSize")) && near(await px(Ad, "body"), 19.95), "Normal clears the choice");
  const other = await newUser(browser, { uid: "u_a2", name: "Admin", canEdit: true, names }); await signIn(other, "admin");
  check(near(await px(other, "body"), 19.95), "another device keeps its own size (Normal)");

  log("Phone, Large text");
  const Ph = await newUser(browser, { uid: "u_p", name: "Admin", canEdit: true, names }, { width: 390, height: 844 }, "dark");
  await Ph.evaluate(() => localStorage.setItem("textSize", "large")); await Ph.reload(); await Ph.waitForTimeout(400); await signIn(Ph, "admin"); await Ph.waitForTimeout(400);
  check(near(await px(Ph, "body"), 20.94), "a phone's text is a step smaller than a computer's (Large: about 21 px)");
  const r = await Ph.$eval("#textBtn", b => { const r = b.getBoundingClientRect(); return [r.left, r.right, r.width]; });
  await Ph.click("#textBtn"); const m = await Ph.$eval("#textMenu", e => { const r = e.getBoundingClientRect(); return [r.left, r.right]; });
  check(r[2] >= 36 && m[0] >= 0 && m[1] <= 390, `Aa is in the phone header and its menu stays on screen (${m.map(Math.round)})`);
  await Ph.screenshot({ path: OUT + "/v36-phone-menu-dark.png" });
  await Ph.keyboard.press("Escape");
  const wide = [];
  for (const t of ["board", "submit", "results", "ledger"]){ await H.tab(Ph, t); await Ph.waitForTimeout(400); if (!(await noSideScroll(Ph))) wide.push(t); }
  await kind(Ph, "batch").catch(() => {}); await H.tab(Ph, "submit"); await Ph.waitForTimeout(300); if (!(await noSideScroll(Ph))) wide.push("batch");
  await open(Ph, made[0]); if (!(await noSideScroll(Ph))) wide.push("record");
  check(!wide.length, "nothing runs off the side of a phone at Large: " + wide.join(", "));
  check(await Ph.$$eval("#tabs>button[data-tab],#tabMore", bs => bs.filter(b => b.offsetParent).every(b => b.scrollWidth <= b.clientWidth + 1)), "the phone's tab labels fit their buttons at Large");
  await H.tab(Ph, "board"); await Ph.waitForTimeout(300); await Ph.screenshot({ path: OUT + "/v36-phone-board-large-dark.png" });

  console.log("Console errors:", JSON.stringify(errors));
  if (errors.length) process.exitCode = 1;
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
