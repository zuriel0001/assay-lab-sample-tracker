// Screenshots of v16 (board, walk-in registration, Other reason, workflow line, CRM history). Run: NODE_PATH=$(npm root -g) node shot16.js
const H = require("./harness");
const OUT = __dirname + "/shots16"; require("fs").mkdirSync(OUT, { recursive: true });
const HOUR = 3600e3;
(async () => {
  const browser = await H.launch();
  const P = await H.newUser(browser, { uid: "u_p", name: "Public", canEdit: true, names: {} });
  const A = await H.newUser(browser, { uid: "u_a", name: "Admin", canEdit: true, names: {} }); await H.signIn(A, "admin");
  await P.waitForTimeout(600);
  await P.screenshot({ path: OUT + "/public-register.png", fullPage: true });
  await H.fillForm(P, "register", { section: "PLT", type: "carbon", purpose: "plant", submitter: "Kojo", count: 7 }); const c = await H.ids(P);
  await H.fillForm(P, "register", { section: "EXP", type: "core", purpose: "exp", submitter: "Ama", count: 3 }); const ex = await H.ids(P);
  await H.fillForm(A, "register", { section: "GC", type: "rc", purpose: "gc", submitter: "Kofi", recvAt: H.localStr(Date.now() - 3 * HOUR) }); await H.ids(A);
  for (const id of ex){ await H.open(A, id); await A.click('[data-receipt="confirm"]'); await A.waitForTimeout(400); }
  await A.click('[data-step="next"]'); await A.waitForTimeout(600);
  await A.screenshot({ path: OUT + "/record-received-by.png", fullPage: true });
  await A.click('[data-tab="board"]'); await A.waitForTimeout(500);
  await A.screenshot({ path: OUT + "/board-desktop.png", fullPage: true });
  await H.tab(P, "register"); await P.click("#rAgain").catch(() => {}); await P.selectOption("#rPurpose", "other"); await P.waitForTimeout(100);
  await (await P.$("#rWhyBox")).scrollIntoViewIfNeeded(); await P.screenshot({ path: OUT + "/purpose-other.png" });
  const M = await H.newUser(browser, { uid: "u_m", name: "Phone", canEdit: true, names: {} }, { width: 390, height: 844 }); await H.signIn(M, "tech1");
  await H.tab(M, "board"); await M.waitForTimeout(400); await M.screenshot({ path: OUT + "/phone-board.png", fullPage: true });
  const Q = await H.newUser(browser, { uid: "u_q", name: "Pub", canEdit: true, names: {} }, { width: 390, height: 844 });
  await Q.waitForTimeout(300); await Q.screenshot({ path: OUT + "/phone-public-register.png" });
  await A.click('[data-tab="stages"]'); await H.cfgTab(A, "crms"); await A.waitForSelector("[data-cf]");
  const i = await A.$$eval('[data-cf="id"]', es => es.findIndex(e => e.value === "STD-AU-LOW"));
  await A.fill(`[data-ci="${i}"][data-cf="val"]`, "0.515"); await A.press(`[data-ci="${i}"][data-cf="val"]`, "Tab"); await A.waitForTimeout(150);
  await A.fill(`[data-ci="${i}"][data-cf="id"]`, "OREAS-LOW"); await A.press(`[data-ci="${i}"][data-cf="id"]`, "Tab"); await A.waitForTimeout(150);
  await A.click("#cfgSave"); await A.waitForTimeout(700);
  await A.click("details.crm-log summary"); await A.waitForTimeout(150);
  await (await A.$("details.crm-log")).scrollIntoViewIfNeeded(); await A.screenshot({ path: OUT + "/crm-history.png" });
  console.log(H.errors.length ? H.errors : "no errors");
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
