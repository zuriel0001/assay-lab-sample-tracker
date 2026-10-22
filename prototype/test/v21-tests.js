// v21: the polish pass. Suggestions under the header search, recently opened samples, the same details again on Submit / Register,
// tables as cards on a phone, the site sample code on board cards, wording (site code, 1 bag / 2 bags, one ID), the batch page's
// progress, the browser tab named after the open sample.
// Run: NODE_PATH=$(npm root -g) timeout 590 node v21-tests.js
const H = require("./harness");
const { store, errors, newUser, launch, signIn, fillForm, ids, open, doc, waitFor } = H;
const names = {}, OUT = __dirname;
const log = (...a) => console.log("•", ...a);
const check = (cond, msg) => { console.log(cond ? "  PASS" : "  FAIL", msg); if (!cond) process.exitCode = 1; };
const text = async (page, sel) => ((await page.textContent(sel).catch(() => "")) || "").replace(/\s+/g, " ");
const sugIds = page => page.$$eval("#sugBox:not([hidden]) [data-sug]", bs => bs.map(b => b.dataset.sug));
async function typeSearch(page, q){ await page.click("#lookupInput"); await page.fill("#lookupInput", ""); await page.type("#lookupInput", q, { delay: 20 }); await page.waitForTimeout(250); }

(async () => {
  const browser = await launch();
  require("./harness").useOldRoutes();   // v23: this suite is written around the routes in use before version 23
  const P = await newUser(browser, { uid: "u_p", name: "Public", canEdit: true, names });
  const Tc = await newUser(browser, { uid: "u_t", name: "Tech", canEdit: true, names }); await signIn(Tc, "tech1");
  const Sv = await newUser(browser, { uid: "u_s", name: "Super", canEdit: true, names }); await signIn(Sv, "super");
  await P.waitForTimeout(1200);

  log("Wording: one sample, one ID");
  await H.tab(Tc, "submit"); await Tc.waitForSelector("#rSubmit");
  check(await Tc.textContent("#rSubmit") === "Submit and get sample ID" && !(await Tc.$eval("#rRecvNow", c => c.checked)), "staff Single, not yet received (v24c: Received now starts unticked): Submit and get sample ID");
  await Tc.setChecked("#rRecvNow", true); await Tc.waitForTimeout(100);
  check(await Tc.textContent("#rSubmit") === "Register and issue ID", "staff Single, received now: Register and issue ID");
  await Tc.check('input[name="rKind"][value="batch"]'); await Tc.fill("#rCount", "3"); await Tc.dispatchEvent("#rCount", "change"); await Tc.waitForTimeout(150);
  check(await Tc.textContent("#rSubmit") === "Register 3 samples and issue IDs", "staff Batch of 3: Register 3 samples and issue IDs");
  await Tc.check('input[name="rKind"][value="single"]');
  await H.tab(P, "register"); await P.waitForSelector("#rSubmit");
  check(await P.textContent("#rSubmit") === "Register and get sample ID", "walk-in Single: Register and get sample ID");
  check(!(await P.$("#rLast")), "no Same as last on a device that has never submitted");

  log("Samples to work with");
  await fillForm(Tc, "register", { section: "MET", type: "plant_feed", purpose: "plant", test: "plant_solids", submitter: "Mill shift B", count: 5, tags: "MILL-A-001" }); const mill = await ids(Tc);
  const ref = doc(mill[0]).batchId;
  check(await Tc.$eval("#rSame", b => b.textContent) === "Same details again", "the result offers Same details again");
  await Tc.click("#rSame"); await Tc.waitForTimeout(400);
  const f1 = await Tc.evaluate(() => ({ type: rType.value, purpose: rPurpose.value, test: rTest.value, section: rSection.value, sub: rSubmitter.value, kind: document.querySelector('input[name="rKind"]:checked').value, n: document.querySelectorAll("#rRows .r-code").length, codes: [...document.querySelectorAll("#rRows .r-code")].map(i => i.value).join(""), focus: document.activeElement?.classList.contains("r-code") }));
  check(f1.type === "plant_feed" && f1.purpose === "plant" && f1.test === "plant_solids" && f1.section === "MET" && f1.sub === "Mill shift B", "Same details again refills type, purpose, test, section and submitter: " + JSON.stringify(f1));
  check(f1.kind === "batch" && f1.n === 5 && f1.codes === "" && f1.focus, "…as a batch of 5 with empty code rows, the cursor in the first code");
  await Tc.fill('#rRows .r-code[data-i="0"]', "MILL-B-001"); await Tc.click("#rSubmit"); await Tc.waitForTimeout(300);
  const mill2 = await ids(Tc);
  check(mill2.length === 5 && mill2.every(id => doc(id).typeKey === "plant_feed" && doc(id).submitter === "Mill shift B") && doc(mill2[0]).tags[0] === "MILL-B-001" && doc(mill2[4]).tags[0] === "MILL-B-005", "the second batch is saved with the same details and its own codes");
  await Tc.click("#rAgain"); await Tc.waitForSelector("#rLast");
  check(/Same as last: Mill sample · MET/.test(await Tc.textContent("#rLast")), "a fresh form offers Same as last: Mill sample · MET");
  await Tc.check('input[name="rKind"][value="single"]'); await Tc.click("#rLast"); await Tc.waitForTimeout(300);
  check(await Tc.$eval("#rType", e => e.value) === "plant_feed" && await Tc.$eval('input[name="rKind"]:checked', e => e.value) === "batch" && !(await Tc.$("#rLast")), "clicking it fills the form (batch again) and the button goes");
  await Tc.check('input[name="rKind"][value="single"]');

  await fillForm(P, "submit", { section: "MET", type: "plant_feed", purpose: "plant", test: "plant_solids", submitter: "Plant operator", tags: "CCD-07" }); const wA = (await ids(P))[0];
  await P.click("#rAgain"); await P.waitForSelector("#rLast");
  await P.click("#rLast"); await P.waitForTimeout(300);
  check(await P.$eval("#rSubmitter", e => e.value) === "Plant operator" && await P.$eval("#rHandTo", e => e.value) === "Lab Technician A" && await P.$eval("#rTag", e => e.value) === "", "a walk-in's Same as last fills the submitter and hand-over, not the code");
  await P.fill("#rHandBadge", "B-101"); await P.$eval("#rCollected", e => { e.value = ""; }); await P.click("#rSubmit"); const wB = (await ids(P))[0];
  check(doc(wB).submitter === "Plant operator" && !doc(wB).tags.length, "and it saves");

  log("Board cards and the receipt check");
  await H.tab(Tc, "board"); await Tc.waitForTimeout(500);
  check(/MILL-A-001/.test(await text(Tc, `#view-board [data-open="${mill[0]}"]`)), "a board card shows the site sample code");
  await open(Tc, wA);
  check(/Check the bag against the submission: site sample code CCD-07, Mill sample, 1 bag\./.test(await text(Tc, "#moveForm")), "receipt check: site sample code CCD-07, Mill sample, 1 bag");
  await open(Tc, wB);
  check(/Check the bag against the submission: Mill sample, 1 bag\./.test(await text(Tc, "#moveForm")), "no code: the check leaves it out (no “tag none given”)");
  await open(Tc, mill[0]);
  check(/Received\s*1 bag(?!\(s\))/.test(await text(Tc, "#view-track")) && !/bag\(s\)/.test(await text(Tc, "#view-track")), "the record says 1 bag, not 1 bag(s)" + (process.env.DBG ? " " + (await text(Tc, "#view-track")).match(/.{60}bag.{30}/g) : ""));
  check(await Tc.evaluate(() => document.title.startsWith(document.querySelector(".sid").textContent + " · ")), "the browser tab is named after the open sample: " + await Tc.title());
  await H.tab(Tc, "board");
  check(!/MET-/.test(await Tc.title()), "and loses the ID on another tab");
  await H.tab(Tc, "ledger"); await Tc.waitForSelector("#lgQ");
  check((await Tc.$eval("#lgQ", e => e.placeholder)).includes("site code") && !(await Tc.$eval("#lgQ", e => e.placeholder)).includes("tag"), "ledger search says site code");

  log("Search suggestions");
  await typeSearch(Tc, "mill-a");
  let sg = await sugIds(Tc);
  check(sg.length === 5 && sg.every(id => mill.includes(id)), "typing mill-a suggests the five MILL-A samples: " + sg.join(" "));
  check(await Tc.$$eval("#sugBox mark", m => m.length) >= 5 && /MILL-A/i.test(await Tc.textContent("#sugBox mark")), "the matching part is marked");
  await Tc.screenshot({ path: OUT + "/v21-suggest.png" });
  await Tc.keyboard.press("ArrowDown"); await Tc.keyboard.press("ArrowDown");
  check(await Tc.$eval("#sugBox", b => b.querySelectorAll('[aria-selected="true"]').length === 1 && b.querySelector('[aria-selected="true"]').id === "sug-1"), "arrow keys move the choice");
  const pick = sg[1];
  await Tc.keyboard.press("Enter"); await Tc.waitForSelector(".sid"); await Tc.waitForTimeout(300);
  check(await Tc.textContent(".sid") === pick && await Tc.$eval("#sugBox", b => b.hidden), "Enter opens the chosen sample and closes the list");
  await typeSearch(Tc, ref.slice(0, 6));
  sg = await sugIds(Tc);
  check(sg.includes(ref) && /Batch of 5/.test(await text(Tc, `#sugBox [data-sug="${ref}"]`)), "typing the start of a batch reference suggests the batch: " + sg.join(" "));
  await Tc.keyboard.press("Escape");
  check(await Tc.$eval("#sugBox", b => b.hidden), "Escape closes the list");
  await typeSearch(Tc, "plant oper");
  check((await sugIds(Tc)).includes(wA), "a submitter's name finds their samples");
  await Tc.click(`#sugBox [data-sug="${wA}"]`); await Tc.waitForTimeout(500);
  check(await Tc.textContent(".sid") === wA, "clicking a suggestion opens it");
  await Tc.fill("#lookupInput", mill2[0]); await Tc.press("#lookupInput", "Enter"); await Tc.waitForSelector(`.sid`); await Tc.waitForTimeout(400);
  check(await Tc.textContent(".sid") === mill2[0] && await Tc.$eval("#sugBox", b => b.hidden), "typing a whole ID and pressing Enter still just opens it; the list stays closed");
  await Tc.click("#view-track .sid"); await Tc.keyboard.press("/"); await Tc.waitForTimeout(150);
  check(await Tc.evaluate(() => document.activeElement?.id === "lookupInput"), "/ jumps to the search");
  await Tc.keyboard.press("Escape"); await Tc.click("#view-track .sid");
  await typeSearch(P, "mill-a");
  check((await sugIds(P)).length === 0, "signed out, the register is not searched as you type (only your own recent samples)");
  await P.fill("#lookupInput", ""); await P.waitForTimeout(250);
  sg = await sugIds(P);
  check(sg[0] === wB && sg.includes(wA), "…and an empty search box lists what this device registered: " + sg.join(" "));

  log("Recently opened");
  const home = async page => { await H.tab(page, "track"); if (await page.$(".sid")) await H.tab(page, "track"); await page.waitForTimeout(300); };
  await home(Tc); await Tc.waitForSelector("#recent");
  check(!(await Tc.$(".sid")) && await Tc.$eval("#lookupInput", i => i.value) === "", "pressing the Sample tab again goes back to its start page");
  const rec = await Tc.$$eval("#recent .rec", bs => bs.map(b => b.dataset.open));
  check(rec[0] === mill2[0] && rec.includes(wA) && rec.includes(pick) && rec.includes(ref), "the Sample tab lists what this person opened or issued, newest first: " + rec.join(" "));
  check(/Received & logged/.test(await text(Tc, `#recent [data-open="${mill2[0]}"]`)) && /MILL-B-001/.test(await text(Tc, `#recent [data-open="${mill2[0]}"]`)), "each shows its status, type and site code");
  await Tc.screenshot({ path: OUT + "/v21-recent.png" });
  await Tc.click(`#recent [data-open="${wA}"]`); await Tc.waitForSelector(".sid"); await Tc.waitForTimeout(300);
  check(await Tc.textContent(".sid") === wA, "one click opens it");
  await home(Tc); await Tc.waitForSelector("#recent");
  await Tc.click("#recentClear"); await Tc.waitForTimeout(200);
  check(!(await Tc.$("#recent")), "Clear empties the list");
  await open(Sv, mill[2]); await home(Sv); await Sv.waitForSelector("#recent");
  await Sv.click("#signBtn"); await Sv.waitForTimeout(400);
  await signIn(Sv, "admin"); await Sv.waitForTimeout(300); await H.tab(Sv, "track"); await Sv.waitForTimeout(300);
  check(!(await Sv.$("#recent")), "another person signing in on the same computer does not see the first person's list");
  await H.tab(P, "track"); await P.waitForSelector("#recent");
  const prec = await P.$$eval("#recent .rec", bs => bs.map(b => b.dataset.open));
  check(prec[0] === wB && prec.includes(wA), "a walk-in finds the samples they registered on the Sample tab");

  log("Batch page");
  await open(Tc, mill[0]); await Tc.click(`[data-open="${ref}"]`); await Tc.waitForSelector(".bv-prog"); await Tc.waitForTimeout(300);
  const bv = await text(Tc, "#view-track");
  check(/0 of 5 results released · all expected by/.test(bv), "the batch page shows 0 of 5 released and when all are expected: " + (bv.match(/\d+ of 5[^·]*·[^A-Z]*by [^A-Z]*/) || [""])[0]);
  check(!(await Tc.$$eval("#view-track table.cardy th", t => t.map(x => x.textContent))).includes("Source"), "no Source column when no sample has a source");
  check(await Tc.title() === ref + " · " + await Tc.evaluate(() => document.title.split(" · ").slice(1).join(" · ")), "the browser tab is named after the batch");

  log("Phone: tables read as cards");
  const M = await newUser(browser, { uid: "u_m", name: "Phone", canEdit: true, names }, { width: 390, height: 844 }, "dark"); await signIn(M, "tech2");
  await H.tab(M, "ledger"); await M.waitForSelector("#view-ledger table.cardy tbody tr"); await M.waitForTimeout(400);
  const lg = await M.$eval("#view-ledger table.cardy", t => ({ thead: getComputedStyle(t.querySelector("thead")).display, tr: getComputedStyle(t.querySelector("tbody tr")).display,
    labels: [...t.querySelector("tbody tr").children].map(td => td.dataset.label || ""), nil: t.querySelectorAll("td.nil").length, wide: document.documentElement.scrollWidth - innerWidth,
    idw: (() => { const b = t.querySelector("tbody tr button.linkish[data-open]"); return b ? b.getClientRects().length : -1; })() }));
  check(lg.thead === "none" && ["block", "grid"].includes(lg.tr) && lg.labels.includes("Sample ID") && lg.labels.includes("Lab"), "the ledger's rows are cards with each column named (v38: a short grid card): " + lg.labels.join("|"));
  check(lg.wide <= 0, `the page does not scroll sideways (${lg.wide}; ${lg.nil} empty cells left out; v24 merged the ledger's mostly empty columns)`);
  check(lg.idw === 1, "a sample ID stays on one line");
  await M.screenshot({ path: OUT + "/v21-ledger-phone.png" });
  await M.fill("#lookupInput", ref); await M.press("#lookupInput", "Enter"); await M.waitForSelector(".bv-prog"); await M.waitForTimeout(500);
  const bp = await M.$eval("#view-track table.cardy", t => ({ tr: getComputedStyle(t.querySelector("tbody tr")).display, wide: document.documentElement.scrollWidth - innerWidth }));
  check(bp.tr === "block" && bp.wide <= 0, "the batch page's samples are cards too");
  await M.screenshot({ path: OUT + "/v21-batch-phone.png", fullPage: true });
  await H.tab(Tc, "ledger"); await Tc.waitForSelector("#view-ledger table.cardy tbody tr");
  check(await Tc.$eval("#view-ledger table.cardy", t => getComputedStyle(t).display === "table" && getComputedStyle(t.querySelector("thead")).display !== "none"), "on a computer the ledger is still a table");

  log("No lab batches (v35): results are typed or attached on the record");
  const Ad = await newUser(browser, { uid: "u_a", name: "Admin", canEdit: true, names }); await signIn(Ad, "admin");
  await H.tab(Ad, "stages"); await Ad.waitForSelector("[data-cfgtab]");
  check(!(await Ad.$("#cfgBatchReq")), "Settings has no lab batch setting");
  // v22: these checks are about the QA/QC review step, which is now off by default (v22-tests covers that), so use it here.
  await H.cfgTab(Ad, "accounts").catch(() => {}); await Ad.selectOption("#cfgQcStep", "1"); await Ad.click("#cfgSave");
  await waitFor(() => store["settings/stages"]?.qcStep === true, 5000); await Tc.waitForTimeout(500);
  await fillForm(Tc, "register", { section: "EXP", submitter: "Ama Mensah", count: 2, tags: "DH-201" }); const nb = await ids(Tc);
  const toBeforeQc = async (page, id) => { for (let g = 0; g < 20; g++){ await open(page, id); const p = doc(id).plan, i = p.findIndex(x => x.key === doc(id).stageKey); if (p[i + 1]?.phase === "qc") return true; await page.click('[data-step="next"]'); await waitFor(() => doc(id).stageKey !== p[i].key, 5000); } return false; };
  check(await toBeforeQc(Tc, nb[0]), "an exploration fire assay sample moves through its steps without a lab batch");
  await open(Tc, nb[0]);
  const hold1 = await text(Tc, "#holdNote");
  check(!/lab batch/i.test(hold1) && /Enter the results before QA\/QC review/.test(hold1) && await Tc.$eval('[data-step="next"]', b => b.disabled), "before QA/QC review it asks only for the results, not a lab batch: " + hold1);
  check(!/not in a .* batch yet/.test(await text(Tc, "#resPanel")), "the record does not nag about a lab batch");
  await Tc.$eval("#resBox", d => { d.open = true; });
  const boxes = await Tc.$$eval("#resBox input[id^=rs_], #resBox select[id^=rs_]", els => els.map(e => e.id));
  check(boxes.length >= 1, "the gold result can be typed on the record: " + boxes.join(" "));
  await Tc.fill("#" + boxes[0], "1.23"); await Tc.click("#rsSave"); await waitFor(() => doc(nb[0]).results, 5000); await Tc.waitForTimeout(400);
  await Tc.click('[data-step="next"]'); await waitFor(() => doc(nb[0]).plan.find(x => x.key === doc(nb[0]).stageKey)?.phase === "qc", 5000);
  check(doc(nb[0]).plan.find(x => x.key === doc(nb[0]).stageKey)?.phase === "qc", "with its result typed it moves into QA/QC review");
  await open(Sv, nb[0]); await Sv.waitForTimeout(300);
  const relHold = await text(Sv, "#holdNote");
  check(!/lab batch/i.test(relHold), "the release is not held for a lab batch" + (relHold ? ": " + relHold : ""));
  await Sv.click('[data-step="next"]'); await waitFor(() => doc(nb[0]).stageKey === "released", 6000);
  check(doc(nb[0]).stageKey === "released" && (doc(nb[0]).certs || []).length === 1, "a supervisor releases it and the certificate is issued");
  check(await toBeforeQc(Tc, nb[1]), "the second sample reaches the step before QA/QC review");
  await open(Tc, nb[1]);
  const upR = await H.attachFile(Tc, `sample:${nb[1]}`, "fa-run.csv", `Sample ID,Au (g/t)\n${nb[1]},4.56\n`);
  check(!/Saved with the lab batch/.test(upR) && /Results on 1 sample record/.test(upR) && !/New lab batch/.test(upR), "a results file attached on a record saves onto the record: " + upR.slice(upR.indexOf("Saves"), upR.indexOf("Saves") + 120));
  await H.saveAttach(Tc); await waitFor(() => doc(nb[1]).results, 5000);
  check(Object.values(doc(nb[1]).results?.rows || {}).some(r => r.v === 4.56 && r.src === "file") && !Object.keys(store).some(k => k.startsWith("batches/") && JSON.stringify(store[k].pos || []).includes(nb[1])), "the gold 4.56 is on the record from the file, and no lab batch was made");
  await open(Tc, nb[1]);
  check(!(await Tc.$eval('[data-step="next"]', b => b.disabled)), "and it can go on to QA/QC review");
  await Ad.selectOption("#cfgQcStep", "0"); await Ad.click("#cfgSave");
  await waitFor(() => store["settings/stages"]?.qcStep === false, 5000);

  console.log("Console errors:", JSON.stringify(errors));
  if (errors.length) process.exitCode = 1;
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
