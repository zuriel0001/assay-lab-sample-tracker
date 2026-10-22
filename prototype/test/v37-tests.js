// v37 (22 Oct, "the Technician should be able to Accept or Reject the sample ... s/he has to put there a justification for it. also the
// button/tab that move the workflow from one step to another should be at the top and not the bottom"): Accept / Reject at the top of the
// receipt, Reject with ticked reasons and a typed justification, on a record, a batch member and the batch page; the step's action above the
// steps everywhere. Values here are made up.
// Run: NODE_PATH=$(npm root -g) timeout 590 node v37-tests.js
process.env.V24 = "1";
const H = require("./harness");
const { errors, newUser, launch, signIn, open, fillForm, ids, doc, ledger, waitFor } = H;
const names = {};
const log = (...a) => console.log("•", ...a);
const check = (cond, msg) => { console.log(cond ? "  PASS" : "  FAIL", msg); if (!cond) process.exitCode = 1; };
const OUT = __dirname;
const text = (page, sel) => page.$eval(sel, e => e.textContent.replace(/\s+/g, " ").trim()).catch(() => "");
const above = (page, a, b) => page.evaluate(([a, b]) => { const x = document.querySelector(a), y = document.querySelector(b); return !!x && !!y && x.getBoundingClientRect().bottom <= y.getBoundingClientRect().top + 1; }, [a, b]);
const noSideScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
async function toLast(page, id){
  for (let g = 0; g < 25; g++){
    await open(page, id); await page.waitForTimeout(150);
    const st = await page.$eval('[data-step="next"]', b => ({ t: b.textContent.trim(), d: b.disabled })).catch(() => null);
    if (!st || !/^Move to:/.test(st.t) || st.d) return st ? st.t : "";
    const k = doc(id).stageKey; await page.click('[data-step="next"]', { timeout: 5000 }).catch(() => {}); await waitFor(() => doc(id).stageKey !== k, 5000); await page.waitForTimeout(250);
  }
  return "";
}

(async () => {
  const browser = await launch();
  const Tc = await newUser(browser, { uid: "u_t", name: "Tech", canEdit: true, names }); await signIn(Tc, "tech1");
  const made = [];
  for (let i = 0; i < 4; i++){ await fillForm(Tc, "submit", { section: "EXP", submitter: "Geo " + i }); made.push(...await ids(Tc)); }
  const [s1, s2, s3, s4] = made;

  log("Receipt: Accept and Reject at the top");
  await open(Tc, s1);
  check(await text(Tc, '#actBox [data-receipt="confirm"]') === "Accept" && await text(Tc, "#rejOpen") === "Reject" && await Tc.isVisible('[data-receipt="flag"]'), "the receipt offers Accept, Reject and Flag a problem");
  check(await above(Tc, "#actBox", ".panel .rail") && await above(Tc, "#rcActs", "#rcAt"), "the buttons sit at the top of the Workflow panel, above the receipt fields and the steps");
  check(await Tc.isHidden("#rcBox") && await Tc.getAttribute("#rejOpen", "aria-expanded") === "false", "the reject panel is closed until Reject is pressed");
  await Tc.screenshot({ path: OUT + "/v37-receipt.png" });
  await Tc.click("#rejOpen");
  check(await Tc.isVisible("#rcBox") && await Tc.isHidden("#rcFields") && await Tc.getAttribute("#rejOpen", "aria-expanded") === "true", "Reject opens its panel; the receipt fields step aside");
  check(await Tc.$$eval("#rcWhyPick input", xs => xs.length) === 8 && await Tc.$$eval("#rcDisp option", os => os.map(o => o.value).join()) === "returned,disposed,cancel", "eight usual reasons to tick, and what happens to the sample");
  await Tc.click('[data-receipt="reject"]'); await Tc.waitForTimeout(300);
  check(/justification/.test(await H.toastText(Tc)) && doc(s1).stageKey === "submitted", "no reject without a typed justification, even with nothing ticked");
  await Tc.check("#rcWhyPick input[value='Seal broken or missing']"); await Tc.check("#rcWhyPick input[value='Not enough sample']");
  await Tc.click('[data-receipt="reject"]'); await Tc.waitForTimeout(300);
  check(/justification/.test(await H.toastText(Tc)) && doc(s1).stageKey === "submitted", "ticked reasons alone are not enough");
  await Tc.fill("#rcWhy", "Seal tag missing, bag half empty");
  await Tc.screenshot({ path: OUT + "/v37-reject-panel.png" });
  // someone else writes to the sample meanwhile: the open panel and what was typed stay
  const T2 = await newUser(browser, { uid: "u_t2", name: "Tech Two", canEdit: true, names }); await signIn(T2, "tech2");
  await open(T2, s1); await T2.fill("#mvNote", "Second bag still in the truck"); await T2.click('[data-receipt="flag"]'); await waitFor(() => !!doc(s1).flag, 5000); await Tc.waitForTimeout(600);
  check(await Tc.isVisible("#rcBox") && await Tc.inputValue("#rcWhy") === "Seal tag missing, bag half empty" && await Tc.isChecked("#rcWhyPick input[value='Not enough sample']"), "the panel stays open with its ticks and text when the record is drawn again");
  await Tc.click('[data-receipt="reject"]'); await waitFor(() => doc(s1).stageKey === "rejected", 6000);
  const d1 = doc(s1);
  check(d1.stageKey === "rejected" && d1.open === false && d1.rej?.why === "Seal tag missing, bag half empty" && d1.rej.picks.join() === "Seal broken or missing,Not enough sample" && d1.rej.by === d1.history.at(-1).tech && d1.rej.disp === "returned",
    "rejected: the reasons, the justification, who and what happens are kept on the sample");
  check(d1.history.at(-1).note === "Rejected and returned: Seal broken or missing; Not enough sample: Seal tag missing, bag half empty", "the custody line says it in full: " + d1.history.at(-1).note);
  await waitFor(() => ledger().filter(m => m.sid === s1).length === 2, 5000);
  check(ledger().filter(m => m.sid === s1).map(m => m.dir).sort().join() === "in,out" && ledger().find(m => m.sid === s1 && m.dir === "out")?.kind === "returned", "the ledger has it received, then returned to the submitter");
  await Tc.waitForTimeout(400);
  check(/Rejected at receipt/.test(await text(Tc, "#rejNote")) && /Seal tag missing, bag half empty/.test(await text(Tc, "#rejNote")) && /Tech/.test(await text(Tc, "#rejNote")) && /Returned to the submitter/.test(await text(Tc, "#rejNote")), "the record says Rejected at receipt, why, by whom and when: " + await text(Tc, "#rejNote"));
  await Tc.screenshot({ path: OUT + "/v37-rejected.png" });
  const P = await newUser(browser, { uid: "u_pub", name: "Public", canEdit: true, names });
  await open(P, s1);
  check(/Rejected at receipt/.test(await text(P, "#rejNote")) && /Seal tag missing/.test(await text(P, "#rejNote")) && !(await P.$("#rejOpen")), "anyone looking it up (signed out) sees that it was rejected and why");
  await H.tab(Tc, "board"); await Tc.waitForTimeout(300);
  await Tc.click('[data-bpick="await"]').catch(() => {}); await Tc.waitForTimeout(300);
  check(!(await Tc.$(`#bdPick [data-open="${s1}"]`)) && !!(await Tc.$(`#bdPick [data-open="${s2}"]`)), "it has left the Awaiting receipt list");

  log("Cancel closes the panel; disposed needs the witness; Accept still works");
  await open(Tc, s2); await Tc.click("#rejOpen"); await Tc.click("#rcBox [data-rej-cancel]");
  check(await Tc.isHidden("#rcBox") && await Tc.isVisible("#rcFields"), "Cancel closes the panel and brings the receipt fields back");
  await Tc.click("#rejOpen"); check(await Tc.isHidden("#rcWitBox"), "the witness is asked only for a disposal");
  await Tc.selectOption("#rcDisp", "disposed"); check(await Tc.isVisible("#rcWitBox"), "choosing Disposed asks for the witness");
  await Tc.fill("#rcWhy", "Leaking"); await Tc.click('[data-receipt="reject"]'); await Tc.waitForTimeout(300);
  check(/second person/.test(await H.toastText(Tc)) && doc(s2).stageKey === "submitted", "disposed without a witness is refused");
  await Tc.click("#rcBox [data-rej-cancel]");
  await Tc.click('[data-receipt="confirm"]'); await waitFor(() => doc(s2).stageKey === "received", 6000);
  check(doc(s2).stageKey === "received", "Accept receives it as before");

  log("Every step: the button that moves the sample is at the top");
  await Tc.waitForTimeout(400);
  check(await above(Tc, "#actBox", ".panel .rail") && await above(Tc, '[data-step="next"]', "#mvLoc") && /^Move to: /.test(await text(Tc, '[data-step="next"]')), "Move to: … is above the step's fields and the steps: " + await text(Tc, '[data-step="next"]'));
  await Tc.screenshot({ path: OUT + "/v37-step.png" });
  await Tc.click('[data-step="next"]'); await Tc.waitForTimeout(700);
  check(await above(Tc, '[data-step="next"],[data-step="wait"]', "#mvLoc"), "and again at the next step");

  log("A batch: reject one bag on its own record, more on the batch page, receive the rest");
  await fillForm(Tc, "submit", { section: "PLT", type: "plant_feed", purpose: "plant", submitter: "Shift A", count: 5, tags: "RJB-1", together: true }); const bt = await ids(Tc);
  const ref = doc(bt[0]).batchId;
  await open(Tc, bt[0]);
  check(await text(Tc, "#inBatch .btn.primary") === "Receive the batch" && await text(Tc, "#rejOpen") === "Reject this sample", "a batch member's record: Receive the batch, or Reject this sample");
  await Tc.click("#rejOpen"); await Tc.check("#rcWhyPick input[value='Bag or label damaged']"); await Tc.fill("#rcWhy", "Label washed off");
  await Tc.click('[data-receipt="reject"]'); await waitFor(() => doc(bt[0]).stageKey === "rejected", 6000);
  check(doc(bt[0]).stageKey === "rejected" && bt.slice(1).every(id => doc(id).stageKey === "submitted"), "that one sample is rejected; the other four still wait");
  await open(Tc, ref); await Tc.waitForTimeout(300);
  check(/Confirm receipt of 4/.test(await text(Tc, "#bvRecvBtn")) && await text(Tc, "#bvRejOpen") === "Reject samples" && await above(Tc, "#bvRecvBtn", "#bvAt"), "the batch page: Confirm receipt of 4 and Reject samples, above the receipt fields");
  await Tc.click("#bvRejOpen");
  check(await Tc.isVisible("#bvrBox") && await Tc.$$eval("#bvrIds input:not([data-all])", xs => xs.length) === 4 && await Tc.isHidden("#bvFields"), "Reject samples lists the four waiting samples to tick");
  await Tc.check(`#bvrIds input[value="${bt[1]}"]`); await Tc.check(`#bvrIds input[value="${bt[2]}"]`);
  check(await text(Tc, "#bvrGo") === "Reject 2 samples", "the button counts the ticked samples");
  await Tc.click("#bvrGo"); await Tc.waitForTimeout(300);
  check(/justification/.test(await H.toastText(Tc)) && doc(bt[1]).stageKey === "submitted", "the batch page needs the justification too");
  await Tc.fill("#bvrWhy", "Wrong bottles sent");
  await Tc.screenshot({ path: OUT + "/v37-batch-reject.png", fullPage: true });
  await Tc.click("#bvrGo"); await waitFor(() => doc(bt[2]).stageKey === "rejected", 8000); await Tc.waitForTimeout(600);
  check([bt[1], bt[2]].every(id => doc(id).stageKey === "rejected" && doc(id).rej.why === "Wrong bottles sent") && [bt[3], bt[4]].every(id => doc(id).stageKey === "submitted"), "the two ticked are rejected; the other two still wait");
  check(/Confirm receipt of 2/.test(await text(Tc, "#bvRecvBtn")), "the batch page now receives the other two");
  await Tc.check("#bvOk"); await Tc.click("#bvRecvBtn"); await waitFor(() => doc(bt[4]).stageKey === "received", 8000); await Tc.waitForTimeout(700);
  check(/Left the workflow \(rejected, stopped or closed\)/.test(await text(Tc, "#bwBox")) && await above(Tc, "#bwAct", "#bwBox .rail") && /^Move 2 samples to: /.test(await text(Tc, "#bwNext")) && await above(Tc, "#bwNext", "#bwLoc"),
    "the batch's workflow: its button on top, above the steps; the three rejected are listed as left the workflow");
  await Tc.screenshot({ path: OUT + "/v37-batch-step.png", fullPage: true });

  log("Review fixes: waiting for results, the Board, NaCN, wall screen, search box, Limits");
  await fillForm(Tc, "register", { section: "PLT", type: "plant_feed", purpose: "plant", submitter: "Shift B", tags: "NA-1" }); const [m1] = await ids(Tc);
  await toLast(Tc, m1); await Tc.click('[data-step="wait"]'); await waitFor(() => doc(m1).rw, 5000); await open(Tc, m1);
  check(await Tc.isVisible(`#actBox [data-attach="sample:${m1}"]`) && await text(Tc, "#resJump") === "Type results" && /^Waiting for the results: AuFx, AuSx\./.test(await text(Tc, "#waitNote")), "waiting for results: Attach results file and Type results are the step's buttons: " + await text(Tc, "#waitNote"));
  await Tc.click("#resJump"); await Tc.waitForTimeout(500);
  check(await Tc.$eval("#resBox", d => d.open) && await Tc.evaluate(() => document.activeElement?.id?.startsWith("rs_")), "Type results opens the result boxes and puts the cursor in the first");
  await H.tab(Tc, "board"); await Tc.waitForTimeout(400);
  if (await Tc.$(".pk-x")){ await Tc.click(".pk-x"); await Tc.waitForTimeout(300); }   // the Awaiting receipt list chosen earlier
  check(/^\d+\s*Waiting for results/.test(await text(Tc, '[data-bpick="relready"]')) && /^Waiting for results \d+$/.test(await text(Tc, ".lane.ph-qc h4")) && await Tc.$$eval(".lane.ph-qc [data-open]", bs => bs.map(b => b.dataset.open)).then(x => x.includes(m1)), "releasing at once, the empty Ready for release tile and lane are now Waiting for results, holding the sample: " + await text(Tc, '[data-bpick="relready"]') + " / " + await text(Tc, ".lane.ph-qc h4"));
  await open(Tc, m1); await Tc.$eval("#resBox", d => { d.open = true; });
  if (await Tc.$("select#rs_pt")) await Tc.selectOption("#rs_pt", { index: 1 });
  await Tc.fill("#rs_Au", "1.25"); await Tc.fill("#rs_Au_s", "0.02"); await Tc.fill("#rs_cn", "0.45"); await Tc.click("#rsSave"); await waitFor(() => doc(m1).certs?.length, 6000); await Tc.waitForTimeout(500);
  check(/NaCN[^\n]*0\.45/.test(await Tc.$eval("#resPanel", e => e.innerText)), "a NaCN of 0.45 mg/L is shown as 0.45 (it read 0)");
  await H.tab(Tc, "board"); await Tc.waitForTimeout(300);
  const tile = await Tc.$('.stat.tile[data-bpick]:not(.zero)'); if (tile) await tile.click(); await Tc.waitForTimeout(300);
  await Tc.click("#bdWall"); await Tc.waitForTimeout(400);
  check(!(await Tc.$(".pick-chip")), "the wall screen shows the whole board, not the last tile clicked");
  await Tc.keyboard.press("Escape"); await Tc.waitForTimeout(300);
  await open(Tc, m1); await Tc.$eval("#lookupInput", e => e.blur()); await Tc.focus("#lookupInput"); await Tc.waitForTimeout(100);
  check(await Tc.$eval("#lookupInput", e => e.selectionStart === 0 && e.selectionEnd === e.value.length && e.value.length > 0), "going back to the search box selects the last ID, so typing replaces it");
  const Ad = await newUser(browser, { uid: "u_a", name: "Admin", canEdit: true, names }); await signIn(Ad, "admin");
  await H.tab(Ad, "stages"); await Ad.waitForTimeout(400); await H.cfgTab(Ad, "limits").catch(() => {}); await Ad.waitForTimeout(300);
  const lim = await Ad.evaluate(() => { const w = [...document.querySelectorAll(".tbl-wrap")].find(x => x.querySelector('[data-lf="act"]')); return w ? [w.scrollWidth, w.clientWidth] : null; });
  check(lim && lim[0] <= lim[1] + 1, "Settings › Limits: the table fits a 1280 px screen, its remove buttons in sight: " + JSON.stringify(lim));

  log("Phone");
  const Ph = await newUser(browser, { uid: "u_p", name: "Tech", canEdit: true, names }, { width: 390, height: 844 }, "dark"); await signIn(Ph, "tech1");
  await open(Ph, s3); await Ph.evaluate(() => scrollTo(0, 0)); await Ph.waitForTimeout(200);
  const top = await Ph.$eval('[data-receipt="confirm"]', b => b.getBoundingClientRect().top);
  check(top < 844, `on a phone Accept is on the first screen of the record (${Math.round(top)} px down)`);
  await Ph.click("#rejOpen"); await Ph.waitForTimeout(200);
  check(await noSideScroll(Ph), "the reject panel fits a phone");
  await Ph.screenshot({ path: OUT + "/v37-phone-reject-dark.png", fullPage: true });
  await H.tab(Ph, "board"); await Ph.waitForTimeout(300);
  check(await Ph.$$eval(".stat.tile.zero", ts => ts.every(t => !t.offsetParent)) && await Ph.$$eval(".stat.tile:not(.zero)", ts => ts.some(t => !!t.offsetParent)), "on a phone the Board's empty tiles step aside; tiles with a number stay");
  const Pp = await newUser(browser, { uid: "u_pp", name: "Public", canEdit: true, names }, { width: 390, height: 844 }, "dark");
  const hd = await Pp.evaluate(() => { const a = document.getElementById("textBtn").getBoundingClientRect(), b = document.getElementById("themeBtn").getBoundingClientRect(); return Math.abs(a.top - b.top); });
  check(hd < 4, "signed out on a phone, Aa and the theme button share one row (" + hd + ")");

  console.log("Console errors:", JSON.stringify(errors));
  if (errors.length) process.exitCode = 1;
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
