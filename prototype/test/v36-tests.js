// v36 (22 Oct, "revising the page font size" ... "the text look okay but it seems small. i think we can enhance the page UI/UX"): one type
// scale; buttons one size; lane counts as badges; the certificate keeps its fixed print sizes. 22 Oct, 23:01: "I think the small font is
// better. and l want that tab to select font fully removed": the scale is Small for everyone and the Aa chooser is gone (these checks
// follow). Values here are made up.
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

  log("One type scale, Small for everyone");
  check(near(await px(Ad, "body"), 18.05) && near(await px(Ad, "label.f") || 17.1, 17.1) && near(await px(Ad, "header.top .who"), 16.15), "body text about 18 px, labels 17 px, secondary text 16 px");
  check(await px(Ad, "header.top .lookup .btn.big") === await px(Ad, "#signBtn"), "Track sample and Sign out are the same size");
  check(await px(Ad, '#tabs>button[data-tab="board"]') >= 16.5, "the tabs are 17 px or more");
  const screens = {};
  await H.tab(Ad, "board"); await Ad.waitForTimeout(400); screens.board = await smallest(Ad);
  check(await Ad.$eval(".lane h4 span", e => parseFloat(getComputedStyle(e).borderTopLeftRadius) > 5 && parseFloat(getComputedStyle(e).fontSize) >= 14), "a lane's count is a badge of at least 14 px (12 px before v36)");
  const bh = await Ad.$eval(".bd-view", e => e.getBoundingClientRect().height), wh = await Ad.$eval("#bdWall", e => e.getBoundingClientRect().height);
  check(Math.abs(bh - wh) <= 2, `Lanes | List is as tall as Wall screen beside it (${bh} / ${wh})`);
  await open(Ad, made[0]); screens.record = await smallest(Ad);
  await H.tab(Ad, "submit"); await Ad.waitForTimeout(300); screens.submit = await smallest(Ad);
  await kind(Ad, "batch"); screens.batch = await smallest(Ad);
  await kind(Ad, "job"); screens.shiftEnd = await smallest(Ad);
  await kind(Ad, "met"); screens.metJob = await smallest(Ad);
  await kind(Ad, "single");
  for (const t of ["results", "storage", "ledger", "routes", "stages"]){ await H.tab(Ad, t); await Ad.waitForTimeout(400); screens[t] = await smallest(Ad); }
  const low = Object.entries(screens).filter(([, v]) => v.min < 13);
  check(!low.length, "no text under 13 px on Board, Sample, Submit (all four kinds), Results, Storage, Ledger, Routes, Settings: " + JSON.stringify(low.length ? low : Object.fromEntries(Object.entries(screens).map(([k, v]) => [k, v.min]))));

  log("No text size chooser: Small is the one size");
  await H.tab(Ad, "board"); await Ad.waitForTimeout(300);
  check(!(await Ad.$("#textBtn,#textMenu,.txt-wrap")) && !(await Ad.evaluate(() => document.documentElement.dataset.text)), "no Aa in the header, no menu");
  await Ad.screenshot({ path: OUT + "/v36-header-small.png", clip: { x: 640, y: 0, width: 640, height: 200 } });
  const certTd = () => Ad.evaluate(() => { const d = document.createElement("div"); d.className = "cert"; d.innerHTML = "<table><tr><th>a</th><td>b</td></tr></table><p class='small'>c</p>"; document.body.append(d); const f = s => parseFloat(getComputedStyle(d.querySelector(s)).fontSize); const r = [f("td"), f("th"), f(".small")].join("/"); d.remove(); return r; });
  check(await certTd() === "17/15/16", "the certificate keeps its print sizes");
  await Ad.evaluate(() => localStorage.setItem("textSize", "large")); await Ad.reload(); await Ad.waitForTimeout(500);
  check(near(await px(Ad, "body"), 18.05) && await Ad.evaluate(() => !localStorage.getItem("textSize")), "a device that had chosen Large before gets Small, and its old choice is cleared");

  log("Phone");
  const Ph = await newUser(browser, { uid: "u_p", name: "Admin", canEdit: true, names }, { width: 390, height: 844 }, "dark");
  await Ph.evaluate(() => localStorage.setItem("textSize", "large")); await Ph.reload(); await Ph.waitForTimeout(400); await signIn(Ph, "admin"); await Ph.waitForTimeout(400);
  check(near(await px(Ph, "body"), 17.15), "a phone's text is a step smaller than a computer's (about 17 px), whatever was chosen before");
  const tb = await Ph.$eval("#themeBtn", b => { const r = b.getBoundingClientRect(); return [r.left, r.right]; });
  check(tb[0] >= 0 && tb[1] <= 390 && !(await Ph.$("#textBtn")), `the theme button is on screen in the phone header, no Aa (${tb.map(Math.round)})`);
  await Ph.screenshot({ path: OUT + "/v36-phone-header-dark.png", clip: { x: 0, y: 0, width: 390, height: 220 } });
  const wide = [];
  for (const t of ["board", "submit", "results", "ledger"]){ await H.tab(Ph, t); await Ph.waitForTimeout(400); if (!(await noSideScroll(Ph))) wide.push(t); }
  await kind(Ph, "batch").catch(() => {}); await H.tab(Ph, "submit"); await Ph.waitForTimeout(300); if (!(await noSideScroll(Ph))) wide.push("batch");
  await open(Ph, made[0]); if (!(await noSideScroll(Ph))) wide.push("record");
  check(!wide.length, "nothing runs off the side of a phone: " + wide.join(", "));
  check(await Ph.$$eval("#tabs>button[data-tab],#tabMore", bs => bs.filter(b => b.offsetParent).every(b => b.scrollWidth <= b.clientWidth + 1)), "the phone's tab labels fit their buttons");
  await H.tab(Ph, "board"); await Ph.waitForTimeout(300); await Ph.screenshot({ path: OUT + "/v36-phone-board-dark.png" });

  console.log("Console errors:", JSON.stringify(errors));
  if (errors.length) process.exitCode = 1;
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
