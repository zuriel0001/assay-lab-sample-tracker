// v37 screenshots for the owner (real web fonts): the receipt with Reject open, a rejected record, a step with its button on top, the
// batch page's Reject samples, and a phone receipt. Not a suite. Run: OUT=<dir> NODE_PATH=$(npm root -g) node shots37.js
process.env.V24 = "1";
const H = require("./harness");
const { newUser, launch, signIn, open, fillForm, ids, doc, waitFor } = H;
const names = {}, OUT = process.env.OUT || __dirname;
const fonts = async p => { await p.context().unrouteAll(); await p.reload(); await p.waitForTimeout(1500); };
const clip = async (p, sel, file, pad = 8) => { const b = await p.$eval(sel, e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y + scrollY, width: r.width, height: r.height }; }); await p.screenshot({ path: OUT + "/" + file, fullPage: true, clip: { x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad), width: b.width + 2 * pad, height: Math.min(b.height + 2 * pad, 1400) } }); };
(async () => {
  const browser = await launch();
  const T = await newUser(browser, { uid: "u_t", name: "Tech", canEdit: true, names }); await fonts(T); await signIn(T, "tech1");
  const made = []; for (let i = 0; i < 3; i++){ await fillForm(T, "submit", { section: "EXP", submitter: "Geologist", tags: "DD-1" + i }); made.push(...await ids(T)); }
  await open(T, made[0]); await clip(T, "#view-track .grid2 > .panel", "v37-1-receipt.png");
  await T.click("#rejOpen"); await T.check("#rcWhyPick input[value='Seal broken or missing']"); await T.fill("#rcWhy", "Seal tag missing, bag split at the top");
  await clip(T, "#view-track .grid2 > .panel", "v37-2-reject-panel.png");
  await T.click('[data-receipt="reject"]'); await waitFor(() => doc(made[0]).stageKey === "rejected", 6000); await T.waitForTimeout(600);
  await clip(T, "#view-track > .stack > .panel:first-child", "v37-3a-rejected-head.png"); await clip(T, "#rejNote", "v37-3-rejected.png");
  await open(T, made[1]); await T.click('[data-receipt="confirm"]'); await waitFor(() => doc(made[1]).stageKey === "received", 6000); await T.waitForTimeout(600);
  await clip(T, "#view-track .grid2 > .panel", "v37-4-step-on-top.png");
  await fillForm(T, "submit", { section: "PLT", type: "plant_feed", purpose: "plant", submitter: "Shift A", count: 4, tags: "MS-1", together: true }); const bt = await ids(T);
  await open(T, doc(bt[0]).batchId); await T.click("#bvRejOpen"); await T.check(`#bvrIds input[value="${bt[1]}"]`); await T.fill("#bvrWhy", "Bottle leaking");
  await clip(T, "#bvRecv", "v37-5-batch-reject.png");
  const P = await newUser(browser, { uid: "u_p", name: "Tech", canEdit: true, names }, { width: 390, height: 844 }); await fonts(P); await signIn(P, "tech1");
  await open(P, made[2]); await P.evaluate(() => scrollTo(0, 0)); await P.waitForTimeout(300); await P.waitForSelector("#toast", { state: "hidden", timeout: 8000 }).catch(() => {}); await P.screenshot({ path: OUT + "/v37-6-phone-receipt.png" });
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
