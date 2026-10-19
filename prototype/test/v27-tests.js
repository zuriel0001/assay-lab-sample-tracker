// v24d (19 Oct, night): the day shift's report, the strip profile of an elution run and the carbon activity calculation.
// The day shift sends its regenerated carbon where the night shift sends stripped and loaded carbon; one carbon can go for its loading with the
// mill shift and for its activity on its own under one code; carbon activity is worked out from the 0 to 120 min readings (and the lab's
// activity sheet's masses and volumes) and compared with fresh carbon; an elution run's batch page and certificate draw its strip profile.
// Values here are made up; the lab's real reports are checked locally and kept out of GitHub.
// Run: NODE_PATH=$(npm root -g) timeout 590 node v27-tests.js
process.env.V24 = "1";
const H = require("./harness");
const { errors, newUser, launch, signIn, open, doc, waitFor } = H;
const names = {};
const log = (...a) => console.log("•", ...a);
const check = (cond, msg) => { console.log(cond ? "  PASS" : "  FAIL", msg); if (!cond) process.exitCode = 1; };
const text = async (page, sel) => ((await page.textContent(sel).catch(() => "")) || "").replace(/\s+/g, " ").trim();
const live = o => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v != null).map(([k, v]) => [k, v.raw]));
// the activity calculation written out again, to check the page's: an aliquot at every reading, 0 min too
function caK(c, m = 1, V = 1000, a = 5, n = 4){ let out = 0; for (let i = 0; i < n; i++) out += c[i] * a / 1000; const put = c[0] * V / 1000, mg = put - c[n] * (V - n * a) / 1000 - out; return { pct: mg / put * 100, gt: mg / m * 1000, k: mg / m * 1000 / c[n] }; }

async function jobForm(P, tpl, shift, date){
  await H.tab(P, "submit"); if (await P.$("#rAgain")) await P.click("#rAgain");
  await P.check('input[name="rKind"][value="job"]'); await P.waitForTimeout(200);
  await P.selectOption("#jTpl", tpl); await P.waitForTimeout(150);
  if (shift && await P.isVisible("#jShift")) await P.selectOption("#jShift", shift);
  await P.fill("#jDate", date); await P.dispatchEvent("#jDate", "change"); await P.waitForTimeout(150);
}
const codes = P => P.$$eval("#jRows .j-code", es => es.map(e => e.value));
async function submit(P){
  await P.fill("#rSubmitter", "Shift metallurgist"); await P.click("#rSubmit");
  await P.waitForSelector("#rResult code", { timeout: 30000 });
  const res = await P.$$eval("#rResult code", els => els.map(e => e.textContent.split(" · ")));
  return { ids: res.map(x => x[0]), tags: res.map(x => x[1]), ref: doc(res[0][0]).batchId };
}
async function receive(P, j){
  await open(P, j.ref); await P.waitForSelector("#bvRecv", { timeout: 8000 }).catch(() => {});
  if (await P.$("#bvTemp")) await P.fill("#bvTemp", "5");
  await P.check("#bvOk"); await P.click("#bvRecvBtn"); await waitFor(() => j.ids.every(id => doc(id).stageKey === "received"), 20000);
  await open(P, j.ref); await P.waitForTimeout(400);
}
async function release(P, j, name, lines){
  const dlg = await H.attachFile(P, `sub:${j.ref}`, name, Buffer.from(lines.join("\n") + "\n"));
  await H.saveAttach(P); await waitFor(() => j.ids.every(id => (doc(id).certs || []).length), 30000);
  return dlg;
}

(async () => {
  const browser = await launch();
  const Tc = await newUser(browser, { uid: "u_t", name: "Tech", canEdit: true, names }); await signIn(Tc, "tech1");
  await Tc.waitForTimeout(600);

  log("The day shift's Mill shift: regenerated carbon, CIL tank 11, spigot samples without a time");
  await jobForm(Tc, "mill", "D", "2026-10-20");
  let cs = await codes(Tc); const on = async c => Tc.isChecked(`[data-jon="${cs.indexOf(c)}"]`);
  check(cs.length === 38 && /^36 of 38 samples ticked/.test(await text(Tc, "#jInfo")) && await on("MLDSCBRG20261020") && !(await on("MLDSCBST20261020")) && !(await on("MLDSCBLD20261020")),
    "38 listed, 36 ticked: the regenerated carbon in, the stripped and loaded carbon (the night shift's) out");
  check(!(await Tc.isVisible("#jN_n1")) && !(await Tc.isVisible("#jN_n2")), "no elution number asked while no ticked sample's code carries one");
  const desc = async c => Tc.inputValue(`#jRows .j-desc[data-j="${cs.indexOf(c)}"]`);
  check(/CIL tank 11 0700 hours/.test(await desc("MLDSCT0720261020")) && /spigot sample A$/.test(await desc("TSFDSPGA20261020")) && cs.indexOf("MLDSCL0620261020") < cs.indexOf("MLDSCL0120261020"),
    "described as the day report does: CIL tank 11 hourly samples, spigot samples without a time; tanks 6 to 10 before 1 to 5");
  const sel = async c => Tc.$eval(`#jRows .j-test[data-j="${cs.indexOf(c)}"]`, e => e.value);
  check(await sel("MLDSCUF 20261020") === "aufx" && await sel("MLDSTK1120261020") === "aufx_ausx" && await sel("MLDSCBRG20261020") === "c_load", "the analyses the reports give: CUF AuFx with grind, tank 11 AuFx & AuSx, regenerated carbon its loading");
  await Tc.uncheck(`[data-jon="${cs.indexOf("MLDSCT1720261020")}"]`); await Tc.waitForTimeout(100);
  await Tc.selectOption("#jShift", "N"); await Tc.waitForTimeout(200); cs = await codes(Tc);
  check(!(await on("MLNSCBRG20261020")) && await on("MLNSCBST20261020") && await on("MLNSCBLD20261020") && await Tc.isVisible("#jN_n1") && /^36 of 38/.test(await text(Tc, "#jInfo")) && !(await on("MLNSCT2320261020")),
    "the night shift: stripped and loaded carbon ticked with their elution numbers, regenerated out; a row unticked by hand stays unticked");
  await Tc.selectOption("#jShift", "D"); await Tc.waitForTimeout(200); cs = await codes(Tc);
  const mill = await submit(Tc);
  check(mill.ids.length === 35 && mill.tags.includes("MLDSCBRG20261020") && !mill.tags.some(t => /CBST|CBLD|CT17/.test(t)) && /Mill shift, day shift/.test(doc(mill.ids[0]).batchName), "35 day-shift samples submitted as one job");

  log("One code, two analyses: the regenerated carbon for its activity as well");
  await jobForm(Tc, "cact", "D", "2026-10-20"); await Tc.fill("#jN_n1", "40"); await Tc.waitForTimeout(100);
  cs = await codes(Tc);
  check(cs[0] === "MLDSCBRG20261020" && cs[1] === "MLSCBST20261020#40" && cs[2] === "MLSCBLD20261019#40" && cs[3] === "" && await Tc.getAttribute(`#jRows .j-code[data-j="3"]`, "placeholder") === "Type its code, e.g. the supplier's name" && await Tc.inputValue(`#jRows .j-desc[data-j="3"]`) === "Virgin carbon",
    "the loaded carbon takes the day before (sampled before its strip); the virgin carbon's code is typed, the hint its box's placeholder, its description just Virgin carbon");
  await Tc.fill(`#jRows .j-code[data-j="3"]`, "ACME VIRGIN");
  const ca = await submit(Tc);
  const regenLoad = mill.ids[mill.tags.indexOf("MLDSCBRG20261020")], regenAct = ca.ids[0];
  check(ca.ids.length === 4 && doc(regenAct).tags[0] === "MLDSCBRG20261020" && doc(regenAct).test === "c_act" && doc(regenLoad).test === "c_load", "accepted: the same code on the mill shift's carbon loading and on its activity");
  await jobForm(Tc, "mill", "D", "2026-10-20"); await Tc.fill("#rSubmitter", "Shift metallurgist"); await Tc.click("#rSubmit"); await Tc.waitForTimeout(800);
  check(/already on open sample .* for the same analysis/.test(await H.toastText(Tc)) && !(await Tc.$("#rResult code")), "the same code for the same analysis is still refused: " + await H.toastText(Tc));

  log("Carbon activity, worked out on each record from the lab's report");
  await receive(Tc, ca);
  const C = { regen: [10.00, 8.80, 8.30, 7.70, 7.30, 6.00], strip: [10.00, 9.00, 8.70, 8.50, 7.90, 6.60], load: [10.00, 9.40, 9.10, 8.80, 8.30, 7.80], fresh: [10.00, 8.40, 7.80, 7.10, 6.30, 5.20] };
  const caLines = [",,SOLCA-0000,SOLCA-0015,SOLCA-0030,SOLCA-0045,SOLCA-0060,SOLCA-0120", ",,1,1,1,1,1,1", ",,mg/L,mg/L,mg/L,mg/L,mg/L,mg/L", "Sample,Description,Au CA-00,Au CA-15,Au CA-30,Au CA-45,Au CA-60,Au CA-120",
    ["MLDSCBRG20261020", "regen", ...C.regen.map(x => x.toFixed(2))].join(","), ["MLSCBST20261020#40", "stripped", ...C.strip.map(x => x.toFixed(2))].join(","),
    ["MLSCBLD20261019#40", "loaded", ...C.load.map(x => x.toFixed(2))].join(","), ["ACME VIRGIN", "ACME", ...C.fresh.map(x => x.toFixed(2))].join(",")];
  const cdlg = await release(Tc, ca, "carbon-activity.csv", caLines);
  check(/4 samples, on one batch certificate/.test(cdlg) || ca.ids.every(id => (doc(id).certs || []).length), "the report releases the four together");
  const K = Object.fromEntries(Object.entries(C).map(([k, v]) => [k, caK(v)])), r = id => doc(id).results?.rows || {};
  check(Math.abs(+r(regenAct).k60.raw - K.regen.k) < 0.5 && Math.abs(+r(regenAct).ads60.raw - K.regen.pct) < 0.05 && Math.abs(+r(regenAct).load60.raw - K.regen.gt) < 0.5 && Math.abs(+r(regenAct).ads120.raw - caK(C.regen, 1, 1000, 5, 5).pct) < 0.05 && r(regenAct).k60.calc,
    `worked out (calculated, never typed): taken up ${(+r(regenAct).ads60.raw).toFixed(1)}% in 60 min, ${Math.round(+r(regenAct).load60.raw)} g/t on the carbon, k ${Math.round(+r(regenAct).k60.raw)} h⁻¹`);
  check(!Object.keys(live(r(regenLoad))).some(k => /^ca/.test(k)), "the readings went to the activity sample, not to the mill shift's carbon with the same code");
  await open(Tc, regenAct); await Tc.waitForTimeout(400);
  check(/Activity constant k/.test(await text(Tc, "#resPanel")) && /calculated/.test(await text(Tc, "#resPanel")), "the record shows k and the shares taken up, marked calculated");
  await open(Tc, ca.ref); await Tc.waitForSelector("#vzCa", { timeout: 8000 }).catch(() => {}); await Tc.waitForTimeout(400);
  const cv = await text(Tc, "#vzCa"), rel = k => Math.round(K[k].k / K.fresh.k * 100);
  check(new RegExp(`Regenerated carbon\\s*MLDSCBRG20261020.*${Math.round(K.regen.k)}\\s*${rel("regen")}%`).test(cv) && new RegExp(`${Math.round(K.load.k)}\\s*${rel("load")}%`).test(cv) && /Fresh carbon\s*ACME VIRGIN.*100%\s*reference/.test(cv),
    `the batch page compares each carbon with the fresh carbon: regenerated ${rel("regen")}%, stripped ${rel("strip")}%, loaded ${rel("load")}%`);
  check(/No carbon mass, volume and aliquot in the results: the standard 1 g, 1000 mL and 5 mL were used/.test(cv), "and says the standard mass and volumes were used");
  const caPts = await Tc.$$eval("#vzCaC .vz-ser", gs => gs.map(g => g.querySelectorAll("circle").length + (g.classList.contains("ref") ? "r" : "")));
  check(caPts.join(",") === "6,6,6,6r" && (await Tc.$$("#vzCa .vz-legend > span")).length === 4, "a line per carbon, fresh carbon the grey reference: " + caPts.join(","));
  await Tc.click("[data-bcert]"); await Tc.waitForSelector("#certBox .cert"); await Tc.waitForTimeout(300);
  const heads = await Tc.$$eval("#certBox table.cert-t thead th", ts => ts.map(t => t.textContent.trim()));
  const rowsT = await Tc.$$eval("#certBox table.cert-t tbody th", ts => ts.map(t => t.textContent.trim()));
  check(heads.join("|") === "Carbon|Regenerated carbon|Eluted carbon|Loaded carbon (to elution)|Fresh carbon" && rowsT.includes("Au at 0 min (mg/L)") && rowsT.includes("Activity vs fresh carbon") && rowsT.filter(t => /taken up in 60/.test(t)).length === 1,
    "the certificate reads down the page like the activity sheet: a column per carbon, each worked-out row once");
  check(!!(await Tc.$("#certBox .cert-fig svg .vz-ser")) && /standard 1 g, 1000 mL and 5 mL/.test(await text(Tc, "#certBox .cert-fig")), "with the chart and the note");
  await Tc.click("#certClose");

  log("The lab's activity sheet: carbon mass, volume and aliquot");
  await jobForm(Tc, "cact", "D", "2026-10-21"); await Tc.fill("#jN_n1", "41");
  check(await Tc.inputValue(`#jRows .j-code[data-j="3"]`) === "ACME VIRGIN", "the virgin carbon's code from last time is filled in");
  await Tc.fill(`#jRows .j-code[data-j="3"]`, "ACME VIRGIN 2");
  const ca2 = await submit(Tc); await receive(Tc, ca2);
  const M = [1.000, 1.004, 1.008, 1.001], cd = ca2.tags;
  const sheet = ["SAMPLE NAME,Mass of Carbon/g,Initial volume/ml,Amount aliquot/ml,0 mins,15 mins,30 mins,45 mins,60 mins,120 mins,DESCRIPTION",
    ...[C.regen, C.strip, C.load, C.fresh].map((v, i) => [cd[i], M[i].toFixed(3), "1000", "5", ...v.map(x => x.toFixed(2)), i === 3 ? "ACME" : "Mill special carbon"].join(","))];
  const sdlg = await release(Tc, ca2, "activity_profile.csv", sheet);
  check(!/Columns not read/.test(sdlg), "the sheet's description column is not listed as a column not read");
  check(ca2.ids.every((id, i) => +r(id).cmass?.raw === M[i] && Math.abs(+r(id).k60.raw - caK([C.regen, C.strip, C.load, C.fresh][i], M[i]).k) < 0.5), "its masses are read and used: k " + ca2.ids.map(id => Math.round(+r(id).k60.raw)).join(", "));
  await open(Tc, ca2.ref); await Tc.waitForSelector("#vzCa"); await Tc.waitForTimeout(300);
  check(!/standard 1 g/.test(await text(Tc, "#vzCa")), "no standard values named when the sheet gives them");

  log("An elution run: the strip profile");
  await jobForm(Tc, "elution", "", "2026-10-20"); await Tc.fill("#jN_n1", "40");
  cs = await codes(Tc);
  await Tc.uncheck("#jAll"); await Tc.waitForTimeout(100);
  const keep = ["MLSPE06020261020", "MLSPE12020261020", "MLSPE18020261020", "MLSPH00020261020", "MLSPH06020261020", "MLSPH12020261020", "MLSPH18020261020",
    "MLSPP03020261020", "MLSPP06020261020", "MLSPP09020261020", "MLSPP12020261020", "MLSPLNAF20261020", "MLSPLNBF20261020", "MLSPTRTD20261020"];
  for (const c of keep) await Tc.check(`[data-jon="${cs.indexOf(c)}"]`);
  const el = await submit(Tc); await receive(Tc, el);
  const E = { MLSPE060: [1.0, 0.27], MLSPE120: [1.2, 0.33], MLSPE180: [1.5, 0.41], MLSPH000: [100, 27], MLSPH060: [80, 21.6], MLSPH120: [60, 16.2], MLSPH180: [45, 12.2],
    MLSPP030: [200, 54], MLSPP060: [110, 29.7], MLSPP090: [90, 24.3], MLSPP120: [70, 18.9], MLSPLNAF: [300, 81], MLSPLNBF: [50, 13.5], MLSPTRTD: [0.4, 0.11] };
  const eluLines = [",,,AAS84T,,,CLA50B,ISE06T,NACN,SOL81X,SOL81X-AG", ",,,1,1,1,1,1,1,1,1", ",,,mg/L,mg/L,mg/L,%,-,mg/L,mg/L,mg/L", "Sample,Description,Cu,Fe,Ni,Zn,NaOH,pH,NaCN,AuSX,AgSX",
    ...Object.entries(E).map(([c, [au, ag]]) => [c + "20261020", "solution", "", "", "", "", "", "10.9", "", au.toFixed(3), ag.toFixed(3)].join(","))];
  await release(Tc, el, "elution-run.csv", eluLines);
  await open(Tc, el.ref); await Tc.waitForSelector("#vzElu", { timeout: 8000 }).catch(() => {}); await Tc.waitForTimeout(600);
  const ev = await text(Tc, "#vzElu");
  check(/Pregnant solution, peak\s*200\.0 mg\/L\s*at 30 min/.test(ev) && /Cell efficiency, average\s*97\.8%/.test(ev) && /lowest 96\.7% at 180 min/.test(ev) && /100\.0 → 45\.0 mg\/L/.test(ev) && /50\.0 → 300\.0 mg\/L/.test(ev) && /Treated water\s*0\.400 mg\/L/.test(ev),
    "the strip profile's figures: pregnant peak, cell efficiency (head to tails), electrowinning head, lean eluate before and after, treated water");
  const ePts = await Tc.$$eval("#vzEluC .vz-ser", gs => gs.map(g => g.querySelectorAll("circle").length));
  check(ePts.join(",") === "4,4,3" && (await Tc.$$("#vzElu .vz-legend > span")).length === 3, "three lines (pregnant 4, head 4, tails 3 points) with a legend");
  const svg = await Tc.$("#vzEluC svg"); await svg.scrollIntoViewIfNeeded(); const bb = await svg.boundingBox();
  const x60 = await Tc.evaluate(() => { const c = [...document.querySelectorAll("#vzEluC .vz-ser")][1].querySelectorAll("circle")[1]; return +c.getAttribute("cx"); });
  await Tc.mouse.move(bb.x + x60 + 3, bb.y + bb.height / 2); await Tc.waitForTimeout(150);
  const tip = await text(Tc, "#vzEluC .vz-tip");
  check(/^60 min/.test(tip) && /110\.0 mg\/L\s*Pregnant solution/.test(tip) && /80\.0 mg\/L\s*Electrowinning head/.test(tip) && /1\.00 mg\/L\s*Electrowinning tails/.test(tip), "the crosshair reads every line at the nearest time: " + tip);
  await Tc.mouse.move(bb.x - 40, bb.y - 40); await Tc.focus("#vzEluC"); await Tc.keyboard.press("ArrowRight"); await Tc.waitForTimeout(100);
  check(/^30 min/.test(await text(Tc, "#vzEluC .vz-tip")), "and the arrow keys step through the times");
  await Tc.click("#vzEluTbl summary"); await Tc.waitForTimeout(100);
  check((await Tc.$$("#vzEluTbl tbody tr")).length === 6 && /98\.8%/.test(await text(Tc, "#vzEluTbl")), "the values as a table, with the cell efficiency at each time");
  await Tc.click('[data-vzmetal="Ag_s"]'); await Tc.waitForTimeout(400);
  check(/Silver in solution/.test(await text(Tc, "#vzElu")) && /peak\s*54\.0 mg\/L/.test(await text(Tc, "#vzElu")) && await Tc.getAttribute('[data-vzmetal="Ag_s"]', "aria-pressed") === "true", "Silver redraws it for silver");
  await Tc.click('[data-vzmetal="Au_s"]'); await Tc.waitForTimeout(300);
  await Tc.click("[data-bcert]"); await Tc.waitForSelector("#certBox .cert"); await Tc.waitForTimeout(300);
  check(!!(await Tc.$("#certBox .cert-fig svg")) && /Strip profile: gold in solution/.test(await text(Tc, "#certBox")) && /200\.0 mg\/L/.test(await text(Tc, "#certBox .cert-fig")), "the certificate carries the strip profile and its figures");
  await Tc.click("#certClose");
  await Tc.setViewportSize({ width: 390, height: 844 }); await open(Tc, el.ref); await Tc.waitForTimeout(700);
  const sw = await Tc.evaluate(() => document.documentElement.scrollWidth), cw = await Tc.evaluate(() => { const c = document.querySelector("#vzEluC"); return [c.clientWidth, c.querySelector("svg").getBoundingClientRect().width]; });
  check(sw <= 392 && cw[1] <= cw[0] + 1, `on a phone the chart fits its panel (${Math.round(cw[1])} of ${cw[0]} px), no sideways scroll`);
  await Tc.setViewportSize({ width: 1280, height: 900 });

  log("A batch certificate fits the page: one Sample column, no column nothing has");
  await receive(Tc, mill);
  const millLines = [",,FAA505,PERCENT_SOLIDS,SCR32,,SOL81X,ARS12D", ",,1,1,1,1,1,1", ",,ppm,%,%,%,mg/L,ppm", "Sample,Description,AuFA,%SOLIDS,+75,-75,AuSX,Au",
    "MLDSCUF 20261020,CUF,9.50,,82.0,18.0,,", "MLDSCLF220261020,feed 2,1.40,,,,,", "MLDSCOF 20261020,COF,1.30,38.0,28.0,72.0,0.200,", "MLDSCBRG20261020,regen,,,,,,40.00"];
  await release(Tc, mill, "day-shift.csv", millLines);
  await open(Tc, mill.ref); await Tc.waitForTimeout(300); await Tc.click("[data-bcert]"); await Tc.waitForSelector("#certBox .cert"); await Tc.waitForTimeout(300);
  const sec = async re => Tc.$$eval("#certBox h4.cert-sec", (hs, src) => { const h = hs.find(x => new RegExp(src).test(x.textContent)); return h ? [...h.nextElementSibling.querySelectorAll("thead th")].map(t => t.textContent.trim()) : []; }, re);
  const solids = await sec("^Solids: AuFx"), carbon = await sec("^Carbon: Au loading");
  check(solids.join("|") === "Sample|AuFx (g/t)|Screen analysis, % retained" && carbon.join("|") === "Sample|Au loading (g/t)", "each section: the Sample column, then only the results some sample has (no empty % solids): " + solids.join(", "));
  const who = await text(Tc, "#certBox td.cell-who");
  check(new RegExp(`${mill.ids[0]}\\s*MLDSRECA20261020\\s*Day shift 07:00 CCD #1 overflow sample`).test(who), "the Sample column holds the ID, the site sample code and the description");
  await Tc.click("#certClose");

  console.log("\nConsole errors:", JSON.stringify(errors));
  await browser.close();
})().catch(e => { console.error(e); console.log("Console errors:", JSON.stringify(H.errors)); process.exit(1); });
