// v24d (19 Oct, evening): a shift's samples as one job. Submit › Shift job lists the plant's samples from a template (Mill shift, Elution run,
// Carbon activity), with codes that follow the shift and date as on the plant's reports; the job is one batch, received as one, on one short
// workflow, and the lab's report for the job releases every sample on one certificate. Values here are made up; the lab's real reports are
// checked locally and kept out of GitHub.
// Run: NODE_PATH=$(npm root -g) timeout 590 node v26-tests.js
process.env.V24 = "1";
const H = require("./harness");
const { errors, newUser, launch, signIn, open, doc, waitFor } = H;
const names = {};
const log = (...a) => console.log("•", ...a);
const check = (cond, msg) => { console.log(cond ? "  PASS" : "  FAIL", msg); if (!cond) process.exitCode = 1; };
const text = async (page, sel) => ((await page.textContent(sel).catch(() => "")) || "").replace(/\s+/g, " ").trim();
const live = o => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v != null).map(([k, v]) => [k, v.raw]));

(async () => {
  const browser = await launch();
  const Tc = await newUser(browser, { uid: "u_t", name: "Tech", canEdit: true, names }); await signIn(Tc, "tech1");
  await Tc.waitForTimeout(600);

  log("CIL / CIP is CIL everywhere (v24d, 19:25)");
  const src = require("fs").readFileSync(H.FILE.replace("file://", ""), "utf8");
  check(!/CIL ?\/ ?CIP/.test(src) && /CIL tank survey/.test(src) && /CIL leach test with carbon/.test(src), "no CIL / CIP left in the page: the tank survey and the leach test read CIL");

  log("A sampling point fills in the analysis it usually gets (single sample)");
  await H.tab(Tc, "submit"); await Tc.check('input[name="rKind"][value="single"]');
  await Tc.selectOption("#rType", "plant_feed"); await Tc.waitForTimeout(150); await Tc.$eval("#rMore", d => { d.open = true; });
  const pts = await Tc.$$eval("#rD_point option", os => os.map(o => o.value).filter(Boolean));
  check(["CIL feed", "Special CIL feed", "CIL tank", "CIL tails", "CIL tails launder", "COF (cyclone overflow)", "CUF (cyclone underflow)", "Tails grab"].every(p => pts.includes(p)), "Mill sample's points are the plant's: " + pts.join(", "));
  await Tc.selectOption("#rD_point", "CIL tank"); await Tc.waitForTimeout(150);
  check(await Tc.inputValue("#rTest") === "aufx_ausx_cn", "CIL tank: AuFx, AuSx & cyanide (with pH) is filled in");
  await Tc.selectOption("#rD_point", "CIL tails launder"); await Tc.waitForTimeout(150);
  check(await Tc.inputValue("#rTest") === "ausx", "CIL tails launder: AuSx");
  await Tc.selectOption("#rTest", "aufx"); await Tc.selectOption("#rD_point", "CIL tank"); await Tc.waitForTimeout(150);
  check(await Tc.inputValue("#rTest") === "aufx", "an analysis chosen by hand is kept");

  log("Shift job: the Mill shift template");
  await H.tab(Tc, "submit"); await Tc.check('input[name="rKind"][value="job"]'); await Tc.waitForTimeout(250);
  check(await Tc.isVisible("#rJob") && !(await Tc.isVisible("#rType")) && await Tc.inputValue("#rPurpose") === "plant" && await Tc.inputValue("#rSection") === "PLT", "Shift job replaces the sample type and analysis with the shift's list; process control from PLT");
  await Tc.selectOption("#jTpl", "mill"); await Tc.selectOption("#jShift", "N"); await Tc.fill("#jDate", "2026-10-18"); await Tc.dispatchEvent("#jDate", "change");
  await Tc.fill("#jN_n1", "31"); await Tc.fill("#jN_n2", "32"); await Tc.waitForTimeout(200);
  const codes = () => Tc.$$eval("#jRows .j-code", es => es.map(e => e.value));
  let cs = await codes();
  check(cs.length === 39 && cs.includes("MLNSCOF 20261018") && cs.includes("MLNSCUF 20261018") && cs.includes("MLNSRECA20261018") && cs.includes("TSFNSPGB20261018") && cs.includes("MLNSCBST20261018#31") && cs.includes("MLNSCBLD20261018#32") && cs.includes("MLNSCL1020261018"),
    "39 samples listed (carbon from all 11 CIL tanks) with the plant's codes: ML + NS + point + date (" + cs.slice(30, 34).join(", ") + ")");
  check(/38 of 39 samples ticked/.test(await text(Tc, "#jInfo")) && /Submit 38 samples/.test(await text(Tc, "#rSubmit")) && !(await Tc.isChecked(`[data-jon="${cs.indexOf("MLNSCBRG20261018")}"]`)), "38 of 39 ticked (the regenerated carbon is the day shift's), Submit 38 samples");
  const rowOf = c => cs.indexOf(c);
  const sel = async c => Tc.$eval(`#jRows .j-test[data-j="${rowOf(c)}"]`, e => e.value);
  check(await sel("MLNSCOF 20261018") === "aufx_ausx" && await sel("MLNSTK1120261018") === "aufx_ausx" && await sel("MLNSCUF 20261018") === "aufx" && await sel("MLNSRECA20261018") === "ausx_cn" && await sel("MLNSCL0620261018") === "c_load" && await sel("MLNSTLSA20261018") === "cn_only",
    "each row comes with the analysis the reports give it (COF AuFx & AuSx with grind, CUF AuFx with grind, tank 11 AuFx & AuSx, CCD overflow AuSx & cyanide, carbon loading, tails grab cyanide)");
  await Tc.fill(`#jRows .j-code[data-j="${rowOf("MLNSCLF220261018")}"]`, "MLNSCLF2X20261018");
  await Tc.selectOption("#jShift", "D"); await Tc.waitForTimeout(200); cs = await codes();
  check(cs.includes("MLDSCOF 20261018") && cs.includes("MLNSCLF2X20261018") && /Day shift/.test(await Tc.inputValue(`#jRows .j-desc[data-j="0"]`)), "the day shift: codes and descriptions follow (DS, day times); a code typed over stays");
  await Tc.selectOption("#jShift", "N"); await Tc.waitForTimeout(200); cs = await codes();
  await Tc.uncheck(`[data-jon="${cs.indexOf("MLNSTLSD20261018")}"]`); await Tc.uncheck(`[data-jon="${cs.indexOf("MLNSCT0520261018")}"]`); await Tc.waitForTimeout(100);
  await Tc.selectOption("#jAdd", "plant_feed|CIL tank"); await Tc.waitForTimeout(150);
  const last = (await codes()).length - 1;
  await Tc.fill(`#jRows .j-code[data-j="${last}"]`, "MLNSTK0920261018"); await Tc.fill(`#jRows .j-desc[data-j="${last}"]`, "Night shift tank 9 sample");
  check(await Tc.$eval(`#jRows .j-test[data-j="${last}"]`, e => e.value) === "aufx_ausx_cn" && /37 of 40 samples ticked/.test(await text(Tc, "#jInfo")), "two unticked, one CIL tank sample added with its analysis: 37 of 40");
  await Tc.fill("#rSubmitter", "Shift metallurgist");
  await Tc.fill(`#jRows .j-code[data-j="1"]`, "MLNSRECA20261018"); await Tc.click("#rSubmit"); await Tc.waitForTimeout(300);
  check(/same code appears twice/i.test(await H.toastText(Tc)) && !(await Tc.$("#rResult code")), "the same code twice is refused");
  await Tc.fill(`#jRows .j-code[data-j="1"]`, "MLNSRECB20261018");
  await Tc.click("#rSubmit"); await Tc.waitForSelector("#rResult code", { timeout: 30000 });
  const res = await Tc.$$eval("#rResult code", els => els.map(e => e.textContent.split(" · ")));
  const ids = res.map(x => x[0]), tags = res.map(x => x[1] || x[0]), ref = doc(ids[0]).batchId;
  const by = c => doc(ids[tags.indexOf(c)]);
  check(ids.length === 37 && ids.every(id => doc(id).batchId === ref && doc(id).batchSize === 37 && doc(id).route === "JOB" && doc(id).job === "mill") && /Mill shift, night shift/.test(doc(ids[0]).batchName),
    "one job of 37 samples on the shift job route: " + doc(ids[0]).batchName);
  const cof = by("MLNSCOF 20261018"), tank = by("MLNSCL0620261018"), sp = by("TSFNSPGA20261018");
  check(cof.typeKey === "plant_feed" && cof.test === "aufx_ausx" && cof.details["Sampling point"] === "COF (cyclone overflow)" && cof.baseRoute === "AUFX-AUSX" && cof.retention.some(r => r.item === "Pulp") && /cyclone overflow/.test(cof.source),
    "each sample keeps its own type, point, analysis, description and its own route's retention (COF: pulp and filtrate)");
  check(tank.typeKey === "carbon" && tank.details["Carbon type"] === "CIL tank carbon" && tank.test === "c_load" && sp.typeKey === "tsf" && sp.test === "cn_only", "carbon from tank 6 and the TSF spigot keep theirs");
  check(cof.plan.map(p => p.name).join(" > ") === "Submitted, awaiting receipt > Received & logged at lab > In analysis > Results released > Retained in storage", "one short workflow for the job: " + cof.plan.map(p => p.name).join(" > "));

  log("The job is one item: one card, one receipt");
  await H.tab(Tc, "board"); await Tc.waitForTimeout(600);
  check(/^1\s*Awaiting receipt/.test(await text(Tc, '.stats.tiles [data-bpick="await"]')) && /Batch of 37 samples/.test(await text(Tc, `.chip.bchip[data-open="${ref}"]`)) && /4 sample types/.test(await text(Tc, `.chip.bchip[data-open="${ref}"]`)),
    "Awaiting receipt: 1, one card (4 sample types, the job's name)");
  await open(Tc, ref); await Tc.waitForSelector("#bvRecv", { timeout: 6000 }).catch(() => {});
  check(/Confirm receipt of 37/.test(await text(Tc, "#bvRecvBtn")) && !!(await Tc.$("#bvTemp")), "one receipt for the 37 (the TSF bottles bring the cooler temperature)");
  await Tc.fill("#bvTemp", "5"); await Tc.check("#bvOk"); await Tc.click("#bvRecvBtn"); await waitFor(() => ids.every(id => doc(id).stageKey === "received"), 20000);
  await open(Tc, ref); await Tc.waitForTimeout(300);
  check(ids.every(id => doc(id).stageKey === "received") && /Move 37 samples to: In analysis/.test(await text(Tc, "#bwNext")) && !!(await Tc.$(`#bwAct [data-attach="sub:${ref}"]`)), "received; the job can move on, and its report can be attached at any step");
  check(/CCD sample, Mill sample, TSF sample, Carbon · 7 analyses/.test(await text(Tc, "#view-track .panel .small.muted")) && /COF \(cyclone overflow\)/.test(await text(Tc, "#view-track table.cardy")), "the batch page names the types and analyses, and each sample's point");

  log("The lab's report for the job releases every sample on one certificate");
  // a report laid out like the lab's: method, repeat and unit rows above the names; made-up values; one sample missing from it
  const row = (c, d, v) => [c, d, ...v].join(",");
  const lines = [",,AAS84T,,,,ARS12D,FAA505,ISE06T,NACN,PERCENT_SOLIDS,SCR32,,SOL81X,SOL81X-AG,SOL85W",
    ",,1,1,1,1,1,1,1,1,1,1,1,1,1,1", ",,mg/L,mg/L,mg/L,mg/L,ppm,ppm,-,mg/L,%,%,%,mg/L,mg/L,mg/L",
    "Sample,Description,Cu,Fe,Ni,Zn,Au,AuFA,pH,NaCN,%SOLIDS,+75,-75,AuSX,AgSX,CNWAD",
    row("MLNSCOF 20261018", "COF", ["", "", "", "", "", "1.11", "", "", "40.0", "30.0", "70.0", "0.111", "", ""]),
    row("MLNSCUF 20261018", "CUF", ["", "", "", "", "", "9.99", "", "", "", "80.0", "20.0", "", "", ""]),
    row("MLNSCLTL20261018", "CIL tails", ["", "", "", "", "", "0.22", "10.8", "70", "35.0", "", "", "0.007", "0.010", ""]),
    row("MLNSCL0620261018", "tank 6 carbon", ["", "", "", "", "222.22", "", "", "", "", "", "", "", "", ""]),
    row("MLNSRECA20261018", "CCD overflow A", ["", "", "", "", "", "", "", "", "", "", "", "0.004", "", "30.00"]),
    row("MLNSTLSA20261018", "tails grab A", ["5.00", "1.00", "2.00", "0.10", "", "", "10.5", "55", "", "", "", "", "", "29.00"]),
    row("MLNSTK0920261018", "tank 9", ["", "", "", "", "", "0.30", "10.9", "60", "36.0", "", "", "0.009", "", "20.00"])];
  const dlg = await H.attachFile(Tc, `sub:${ref}`, "night-shift-report.csv", Buffer.from(lines.join("\n") + "\n"));
  check(new RegExp(`Released together with this file: batch ${ref}`).test(dlg) && /37 samples, on one batch certificate/.test(dlg) && /Moved on to analysis when saved/.test(dlg), "the dialog: all 36 released together, moved on to analysis first");
  await H.saveAttach(Tc); await waitFor(() => ids.every(id => (doc(id).certs || []).length), 30000);
  const cs0 = ids.map(id => doc(id).certs.at(-1));
  check(cs0.every(c => c.no === `${ref}-R1` && c.code === cs0[0].code) && ids.every(id => doc(id).stageKey === "released"), "released together: one certificate " + cs0[0].no);
  check(live(by("MLNSCOF 20261018").results.rows).Au === "1.11" && /\+75 30\.0 · -75 70\.0/.test(live(by("MLNSCOF 20261018").results.rows).scr || "") && live(by("MLNSCL0620261018").results.rows).Au_c === "222.22" && live(by("MLNSRECA20261018").results.rows).wad === "30.00" && live(by("MLNSTK0920261018").results.rows).wad === "20.00",
    "each sample's values read by its code (COF with its screen, carbon loading, CCD WAD, the added tank 9)");
  await open(Tc, ref); await Tc.click("[data-bcert]"); await Tc.waitForSelector("#certBox .cert", { timeout: 5000 }).catch(() => {});
  const heads = await Tc.$$eval("#certBox h4.cert-sec", hs => hs.map(h => h.textContent.trim()));
  check(heads.length === 7 && heads.some(h => /^Carbon: Au loading \(13 samples\)$/.test(h)) && heads.some(h => /^Slurry: AuFx & AuSx \(\d+ samples\)$/.test(h)), "the certificate reads one table per analysis: " + heads.join(" | "));
  const carbonCols = await Tc.$$eval("#certBox h4.cert-sec", hs => { const h = hs.find(x => /^Carbon/.test(x.textContent)); return [...h.nextElementSibling.querySelectorAll("thead th")].map(t => t.textContent.trim()); });
  check(carbonCols.join("|") === "Sample|Au loading (g/t)", "a section has only its own columns (the sample's ID, code and description in one): " + carbonCols.join(", "));
  await Tc.click("#certClose");

  log("The job's material: kept by item, put away for all at once");
  await open(Tc, ref); await Tc.waitForTimeout(300);
  const items = await Tc.$$eval("#bmBox tbody > tr:not(.mat-ctl) td:first-child b", bs => bs.map(b => b.textContent.trim()));
  check(["Pulp", "Filtrate", "Solution", "Carbon sample"].every(i => items.includes(i)), "each sample's own materials, item by item: " + items.join(", "));
  const pulpN = ids.filter(id => doc(id).materials.some(m => m.item === "Pulp")).length;
  const pk = (() => { const m = by("MLNSCOF 20261018").materials.find(x => x.item === "Pulp"); return m.k + "-pulp"; })();
  await Tc.selectOption(`#bmx_${pk}`, "store"); await Tc.fill(`#bmr_${pk}`, "Pulp room R2"); await Tc.click(`[data-bmat="${pk}"]`);
  await waitFor(() => ids.filter(id => doc(id).materials.some(m => m.item === "Pulp" && m.loc === "Pulp room R2")).length === pulpN, 15000);
  check(ids.filter(id => doc(id).materials.some(m => m.item === "Pulp" && m.loc === "Pulp room R2")).length === pulpN && ids.every(id => !doc(id).materials.some(m => m.item !== "Pulp" && m.loc)), `the pulp of the ${pulpN} samples that keep one put away together; nothing else touched`);

  log("Elution run and carbon activity templates");
  await H.tab(Tc, "submit"); await Tc.click("#rAgain").catch(() => {}); await Tc.waitForTimeout(200);
  if (!(await Tc.isChecked('input[name="rKind"][value="job"]'))) await Tc.check('input[name="rKind"][value="job"]');
  await Tc.selectOption("#jTpl", "elution"); await Tc.fill("#jDate", "2026-10-19"); await Tc.dispatchEvent("#jDate", "change"); await Tc.waitForTimeout(200);
  cs = await codes();
  check(cs.length === 36 && !(await Tc.isVisible("#jShift")) && cs.includes("MLSPE06020261019") && cs.includes("MLSPH00020261019") && cs.includes("MLSPP36020261019") && cs.includes("MLSPLNAF20261019") && cs.includes("MLSPTRTD20261019"),
    "Elution run: 36 solutions (electrowinning tails and head, pregnant solution over time, lean eluate, treated water), no shift");
  await Tc.selectOption("#jTpl", "cact"); await Tc.selectOption("#jShift", "D"); await Tc.fill("#jDate", "2026-10-18"); await Tc.dispatchEvent("#jDate", "change"); await Tc.fill("#jN_n1", "31"); await Tc.waitForTimeout(200);
  cs = await codes();
  check(cs.join("|") === "MLDSCBRG20261018|MLSCBST20261018#31|MLSCBLD20261017#31|" && await Tc.$eval('#jRows .j-code[data-j="3"]', e => e.classList.contains("dup")), "Carbon activity: regenerated, stripped and loaded carbon coded (the loaded carbon the day before, as on the lab's report); the virgin carbon's code is left to type (marked)");
  await Tc.fill('#jRows .j-code[data-j="3"]', "Supplier virgin carbon"); await Tc.fill("#rSubmitter", "Elution operator");
  await Tc.click("#rSubmit"); await Tc.waitForSelector("#rResult code", { timeout: 20000 });
  const ca = (await Tc.$$eval("#rResult code", els => els.map(e => e.textContent.split(" · ")))), cids = ca.map(x => x[0]), cref = doc(cids[0]).batchId;
  check(cids.length === 4 && cids.every(id => doc(id).test === "c_act" && doc(id).typeKey === "carbon"), "4 carbon samples for the activity test");
  await open(Tc, cref); await Tc.check("#bvOk"); await Tc.click("#bvRecvBtn"); await waitFor(() => cids.every(id => doc(id).stageKey === "received"), 10000); await open(Tc, cref);
  const ca0 = [",,SOLCA-0000,SOLCA-0015,SOLCA-0030,SOLCA-0045,SOLCA-0060,SOLCA-0120", ",,1,1,1,1,1,1", ",,mg/L,mg/L,mg/L,mg/L,mg/L,mg/L", "Sample,Description,Au CA-00,Au CA-15,Au CA-30,Au CA-45,Au CA-60,Au CA-120",
    "MLDSCBRG20261018,regen,10.00,9.00,8.00,7.50,7.00,6.00", "MLSCBST20261018#31,stripped,10.00,9.10,8.60,8.40,7.80,6.50", "MLSCBLD20261017#31,loaded,10.00,9.30,9.00,8.70,8.20,7.70", "Supplier virgin carbon,virgin,10.00,8.40,7.80,7.10,6.30,5.20"].join("\n") + "\n";
  await H.attachFile(Tc, `sub:${cref}`, "activity.csv", Buffer.from(ca0)); await H.saveAttach(Tc); await waitFor(() => cids.every(id => (doc(id).certs || []).length), 15000);
  const rg = live(doc(cids[0]).results.rows);
  check(rg.ca0 === "10.00" && rg.ca120 === "6.00" && live(doc(cids[3]).results.rows).ca60 === "6.30", "the activity readings at 0 to 120 min read by their column names (Au CA-00 … Au CA-120)");

  console.log("\nConsole errors:", JSON.stringify(errors));
  if (errors.length) process.exitCode = 1;
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
