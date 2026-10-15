// Screenshots of v17 (walk-in form with hand-over fields, staff Submit with Received now, record). Run: NODE_PATH=$(npm root -g) node shot17.js
const H = require("./harness");
const OUT = __dirname + "/shots17"; require("fs").mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await H.launch();
  const P = await H.newUser(browser, { uid: "u_p", name: "Public", canEdit: true, names: {} });
  const T = await H.newUser(browser, { uid: "u_t", name: "Tech", canEdit: true, names: {} }); await H.signIn(T, "tech1");
  await P.waitForTimeout(600);
  await P.fill("#rSubmitter", "Yaw Boateng"); await P.fill("#rHandTo", "Kwesi Mensah"); await P.fill("#rHandBadge", "LT-0457");
  await (await P.$("#rSubmitter")).scrollIntoViewIfNeeded(); await P.screenshot({ path: OUT + "/walkin-handover.png" });
  await H.fillForm(P, "register", { section: "GC", type: "rc", purpose: "gc", submitter: "Yaw Boateng", handed: "Kwesi Mensah", badge: "LT-0457" }); const [w] = await H.ids(P);
  await H.tab(T, "submit"); await T.waitForSelector("#rRecvNow"); await T.screenshot({ path: OUT + "/staff-submit-recvnow.png" });
  await T.setChecked("#rRecvNow", false); await T.waitForTimeout(100); await (await T.$("#rSubmitter")).scrollIntoViewIfNeeded(); await T.screenshot({ path: OUT + "/staff-submit-later.png" });
  await H.open(T, w); await T.click('[data-receipt="confirm"]'); await T.waitForTimeout(800);
  await T.screenshot({ path: OUT + "/record-handed-received.png", fullPage: true });
  console.log(H.errors.length ? H.errors : "no errors");
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
