// v31 (21 Oct): "We need some flexibility and efficiency in the site. it cannot be too strict." A first code and the date make the codes,
// with the count continued for the rest of the samples (MLABPPS01 on 22 Oct: MLABPPS0120261022, MLABPPS0220261022 …); ID groups on Batch,
// Shift end and MET Lab job (QA/QC: 3); the analysis ticks the type's others and takes any typed one; Other testwork; Shift end and MET Lab
// job from any section that sends plant samples, P.P (MET) filled in; "Other…" in fixed lists. Values here are made up.
// Run: NODE_PATH=$(npm root -g) timeout 590 node v31-tests.js
process.env.V24 = "1";
const H = require("./harness");
const { errors, newUser, launch, signIn, open, doc, waitFor, store } = H;
const names = {};
const log = (...a) => console.log("•", ...a);
const check = (cond, msg) => { console.log(cond ? "  PASS" : "  FAIL", msg); if (!cond) process.exitCode = 1; };
const text = async (page, sel) => ((await page.textContent(sel).catch(() => "")) || "").replace(/\s+/g, " ").trim();
const opts = (P, sel) => P.$$eval(`${sel} option`, os => os.map(o => o.value).filter(Boolean));
const rowPh = P => P.$$eval("#rRows .r-code", es => es.map(e => e.value || e.placeholder));
// v32: an ID group's rows fold under one line; open them all before reading the codes
const openGroups = async P => { for (let k = 0; k < 12; k++){ const b = await P.$('#jRows .j-gt[aria-expanded="false"]'); if (!b) break; await b.click(); } };
const codes = async P => { await openGroups(P); return P.$$eval("#jRows .j-code", es => es.map(e => e.value)); };
const samplesOf = () => Object.entries(store).filter(([k, v]) => k.startsWith("samples/") && v && v.id).map(([, v]) => v);
const withTag = t => samplesOf().filter(s => (s.tags || []).includes(t));

async function batchForm(P, type, test, n){
  await H.tab(P, "submit"); if (await P.$("#rAgain")) await P.click("#rAgain");
  await P.check('input[name="rKind"][value="batch"]'); await P.waitForTimeout(150);
  await P.selectOption("#rType", type); await P.waitForTimeout(100); if (test) await P.selectOption("#rTest", test);
  await P.selectOption("#rPurpose", "plant"); await P.selectOption("#rSection", "PLT");
  if (n){ await P.fill("#rCount", String(n)); await P.dispatchEvent("#rCount", "change"); }
  await P.fill("#rSubmitter", "Plant metallurgist"); await P.waitForTimeout(100);
}
async function idsOut(P){ await P.waitForSelector("#rResult code", { timeout: 30000 }); return P.$$eval("#rResult code", els => els.map(e => e.textContent.split(" · ")[0])); }
async function jobForm(P, kind, tpl, date, shift){
  await H.tab(P, "submit"); if (await P.$("#rAgain")) await P.click("#rAgain");
  await P.check(`input[name="rKind"][value="${kind}"]`); await P.waitForTimeout(200);
  await P.selectOption("#jTpl", tpl); await P.waitForTimeout(150);
  if (shift && await P.isVisible("#jShift")) await P.selectOption("#jShift", shift);
  await P.fill("#jDate", date); await P.dispatchEvent("#jDate", "change"); await P.waitForTimeout(150);
}
async function toLast(page, id){
  for (let g = 0; g < 25; g++){
    await open(page, id); await page.waitForTimeout(200);
    const st = await page.$eval('[data-step="next"]', b => ({ t: b.textContent.trim(), d: b.disabled })).catch(() => null);
    if (!st || !/^Move to:/.test(st.t) || st.d) return st ? st.t : "";
    const k = doc(id).stageKey; await page.click('[data-step="next"]', { timeout: 5000 }).catch(() => {}); await waitFor(() => doc(id).stageKey !== k, 5000); await page.waitForTimeout(250);
  }
  return "";
}

(async () => {
  const browser = await launch();
  const Tc = await newUser(browser, { uid: "u_t", name: "Tech", canEdit: true, names }); await signIn(Tc, "tech1");
  await Tc.waitForTimeout(600);

  log("Batch: the first code and the date make every row's code, the count continued");
  await batchForm(Tc, "plant_feed", "aufx", 3);
  check(await Tc.isVisible("#rIdgBox .g-first") && await Tc.isVisible("#rBGDate") && (await opts(Tc, "#rBGn")).join() === "1,2,3,4,5,6,7,8,9,10" && await Tc.inputValue("#rBGn") === "1", "a batch has a first code, the date on the codes and ID groups (1 to 10, 1 at first)");
  await Tc.fill("#rBGDate", "2026-10-22"); await Tc.dispatchEvent("#rBGDate", "input");
  await Tc.fill('#rIdgBox .g-first[data-g="0"]', "mlabpps01"); await Tc.waitForTimeout(150);
  check((await rowPh(Tc)).join() === "MLABPPS0120261022,MLABPPS0220261022,MLABPPS0320261022", "MLABPPS01 on 22 Oct: " + (await rowPh(Tc)).join());
  check(/MLABPPS0120261022 … MLABPPS0320261022/.test(await text(Tc, "#rIdgBox .g-ex")), "the codes it makes, first to last, under the first code");
  await Tc.fill("#rCount", "12"); await Tc.dispatchEvent("#rCount", "change"); await Tc.waitForTimeout(150);
  const ph12 = await rowPh(Tc);
  check(ph12.length === 12 && ph12[9] === "MLABPPS1020261022" && ph12[11] === "MLABPPS1220261022", "12 samples: the count goes on to 12, keeping two digits");
  await Tc.fill('#rIdgBox .g-first[data-g="0"]', "MLABPPS0120261023"); await Tc.dispatchEvent('#rIdgBox .g-first[data-g="0"]', "change"); await Tc.waitForTimeout(150);
  check(await Tc.inputValue('#rIdgBox .g-first[data-g="0"]') === "MLABPPS01" && await Tc.inputValue("#rBGDate") === "2026-10-23" && (await rowPh(Tc))[0] === "MLABPPS0120261023", "a whole code typed: the first code keeps MLABPPS01 and the date box takes 23 Oct");
  await Tc.fill('#rRows .r-code[data-i="1"]', "MLABPPS-SPECIAL"); await Tc.waitForTimeout(100);
  check((await rowPh(Tc)).slice(0, 3).join() === "MLABPPS0120261023,MLABPPS-SPECIAL,MLABPPS0320261023", "a row typed over keeps its own code; the others stay in the series");
  await Tc.fill('#rRows .r-code[data-i="1"]', ""); await Tc.fill("#rCount", "3"); await Tc.dispatchEvent("#rCount", "change"); await Tc.waitForTimeout(100);
  await Tc.click("#rSubmit"); const b1 = await idsOut(Tc);
  check(b1.length === 3 && doc(b1[0]).tags[0] === "MLABPPS0120261023" && doc(b1[2]).tags[0] === "MLABPPS0320261023" && /^PLT-\d{8}-\d{4}$/.test(b1[0]), "submitted: each sample has its own ID and its code: " + b1.map(id => doc(id).tags[0]).join(", "));

  log("Batch ID groups: each with its own first code and number");
  await batchForm(Tc, "plant_feed", "aufx");
  await Tc.fill("#rBGDate", "2026-10-22"); await Tc.dispatchEvent("#rBGDate", "input");
  await Tc.selectOption("#rBGn", "2"); await Tc.waitForTimeout(150);
  check(await Tc.$$eval("#rIdgBox .idg-row", r => r.length) === 2 && await Tc.isVisible('#rIdgBox .g-n[data-g="0"]') && await Tc.$eval("#rCount", e => e.readOnly), "two groups: each has a number of samples; Number of samples adds them up");
  await Tc.fill('#rIdgBox .g-first[data-g="0"]', "MLABCB01"); await Tc.fill('#rIdgBox .g-n[data-g="0"]', "2");
  await Tc.fill('#rIdgBox .g-first[data-g="1"]', "MLABSL001"); await Tc.fill('#rIdgBox .g-n[data-g="1"]', "3"); await Tc.waitForTimeout(150);
  check((await rowPh(Tc)).join() === "MLABCB0120261022,MLABCB0220261022,MLABSL00120261022,MLABSL00220261022,MLABSL00320261022" && await Tc.inputValue("#rCount") === "5", "2 CB and 3 SL (001 keeps three digits): " + (await rowPh(Tc)).join());
  await Tc.click('#rRows [data-rdel="0"]'); await Tc.waitForTimeout(150);
  check((await rowPh(Tc)).join() === "MLABCB0120261022,MLABSL00120261022,MLABSL00220261022,MLABSL00320261022" && await Tc.inputValue('#rIdgBox .g-n[data-g="0"]') === "1", "✕ on a row takes one from its group");
  await Tc.fill('#rIdgBox .g-n[data-g="0"]', "2"); await Tc.waitForTimeout(150);
  await Tc.click("#rSubmit"); const b2 = await idsOut(Tc);
  check(b2.length === 5 && b2.map(id => doc(id).tags[0]).join() === "MLABCB0120261022,MLABCB0220261022,MLABSL00120261022,MLABSL00220261022,MLABSL00320261022", "five samples, one batch");

  log("Codes already on open samples: shown, with the next free numbers offered");
  await batchForm(Tc, "plant_feed", "aufx");
  await Tc.fill("#rBGDate", "2026-10-22"); await Tc.dispatchEvent("#rBGDate", "input");
  await Tc.selectOption("#rBGn", "2"); await Tc.waitForTimeout(150);
  await Tc.fill('#rIdgBox .g-first[data-g="0"]', "MLABCB01"); await Tc.fill('#rIdgBox .g-n[data-g="0"]', "2");
  await Tc.fill('#rIdgBox .g-first[data-g="1"]', "MLABSL001"); await Tc.fill('#rIdgBox .g-n[data-g="1"]', "2"); await Tc.waitForTimeout(150);
  await Tc.click("#rSubmit"); await Tc.waitForSelector("#rFree", { timeout: 15000 }).catch(() => {});
  check(await Tc.isVisible("#rFree") && /4 taken/.test(await text(Tc, "#rRowInfo")) && await Tc.$$eval("#rRows .r-code.taken", e => e.length) === 4 && !(await Tc.$("#rResult code")), "nothing is submitted: the four taken codes are marked, Next free numbers offered");
  await Tc.click("#rFree"); await Tc.waitForTimeout(150);
  check(await Tc.inputValue('#rIdgBox .g-first[data-g="0"]') === "MLABCB03" && await Tc.inputValue('#rIdgBox .g-first[data-g="1"]') === "MLABSL004" && (await rowPh(Tc)).join() === "MLABCB0320261022,MLABCB0420261022,MLABSL00420261022,MLABSL00520261022", "each group goes on after its last taken code: " + (await rowPh(Tc)).join());
  await Tc.click("#rSubmit"); const b3 = await idsOut(Tc);
  check(b3.length === 4 && doc(b3[0]).tags[0] === "MLABCB0320261022", "then it goes through");

  log("Analysis: the main one, ticks of the type's others, and any typed");
  await H.tab(Tc, "submit"); if (await Tc.$("#rAgain")) await Tc.click("#rAgain");
  await Tc.check('input[name="rKind"][value="single"]'); await Tc.waitForTimeout(150);
  await Tc.selectOption("#rType", "plant_feed"); await Tc.waitForTimeout(150);
  check(await Tc.isVisible("#rAnMore summary") && await text(Tc, "#rAnMore summary") === "+ More analyses" && !(await Tc.$("#rAn0")), "under Analysis: + More analyses (the old add-on ticks are gone)");
  await Tc.selectOption("#rTest", "aufx_ausx"); await Tc.waitForTimeout(100);
  await Tc.$eval("#rAnMore", d => { d.open = true; });
  const ticks = await Tc.$$eval("#rAnMore .checks input", es => es.map(e => e.value));
  check(!ticks.includes("aufx_ausx") && ticks.includes("cn_only") && ticks.includes("ausx"), "the ticks are the mill sample's other analyses: " + ticks.join(","));
  await Tc.check('#rAnMore .checks input[value="cn_only"]'); await Tc.fill("#rAnMore .an-x", "Sulphide S, moisture"); await Tc.waitForTimeout(100);
  check(await text(Tc, "#rAnMore summary") === "+ NaCN, WAD & pH, Sulphide S, moisture", "the summary names what is ticked and typed: " + await text(Tc, "#rAnMore summary"));
  await Tc.selectOption("#rPurpose", "plant"); await Tc.selectOption("#rSection", "PLT"); await Tc.fill("#rSubmitter", "Plant metallurgist"); await Tc.fill("#rTag", "MLX-AN-1");
  await Tc.setChecked("#rRecvNow", true); await Tc.waitForTimeout(100);
  await Tc.click("#rSubmit"); const [a1] = await idsOut(Tc), s1 = doc(a1);
  check(s1.test === "aufx_ausx" && s1.route === "AUFX-AUSX" && JSON.stringify(s1.tests2) === '["cn_only"]' && JSON.stringify(s1.xan) === '["Sulphide S","moisture"]', "stored: the main analysis and its route, the ticked one, the typed ones");
  check(s1.testName === "Slurry: AuFx & AuSx + Cyanide: NaCN, WAD & pH + Sulphide S + moisture", "its name lists them all: " + s1.testName);
  const pk = s1.plan.map(x => x.key), rel = pk.indexOf("released");
  check(pk.includes("xan") && pk.indexOf("xan") < rel && s1.plan.find(x => x.key === "xan").name === "Analysis: Sulphide S, moisture" && s1.plan.some((x, i) => i < rel && /cyanide|NaCN|WAD/i.test(x.name) && !/AuSx/.test(x.name)), "its steps: the route's, the cyanide's, and one for the typed ones, all before the release: " + s1.plan.map(x => x.name).join(" › "));
  await open(Tc, a1);
  check(/Slurry: AuFx & AuSx \+ Cyanide: NaCN, WAD & pH \+ Sulphide S \+ moisture/.test(await text(Tc, "#view-track")), "the record names every analysis");
  await toLast(Tc, a1); await open(Tc, a1); await Tc.$eval("#resBox", d => { d.open = true; }).catch(() => {});
  const ids = await Tc.$$eval("#resBox [id^=rs_]", es => es.map(e => e.id));
  check(ids.includes("rs_x_sulphide_s") && ids.includes("rs_x_moisture") && ids.includes("rs_wad") && ids.includes("rs_Au_s"), "the record asks for every result, Cu and moisture too: " + ids.join(","));
  for (const [k, v] of [["Au", "0.21"], ["Au_s", "0.033"], ["cn", "90"], ["wad", "11.0"], ["pH", "10.2"]]) if (ids.includes("rs_" + k)) await Tc.fill("#rs_" + k, v);
  await Tc.click("#rsSave"); await waitFor(() => doc(a1).results, 5000); await Tc.waitForTimeout(400);
  check(!(doc(a1).certs || []).length && doc(a1).results.rows.wad?.v === 11 && doc(a1).results.rows.Au?.v === 0.21, "not released: sulphide S and moisture are still to come");
  await open(Tc, a1);
  const up2 = await H.attachFile(Tc, `sample:${a1}`, "extra.csv", `Sample ID,Sulphide S,Moisture (%)\n${a1},0.012,8.4\n`);
  await H.saveAttach(Tc); await waitFor(() => (doc(a1).certs || []).length, 8000);
  const r1 = doc(a1).results.rows;
  check(r1.x_sulphide_s?.raw === "0.012" && r1.x_moisture?.raw === "8.4 %" && (doc(a1).certs || []).length === 1, "a file's Cu and Moisture columns fill the typed analyses (the unit kept with the value); then released at once: " + JSON.stringify({ su: r1.x_sulphide_s?.raw, m: r1.x_moisture?.raw, up2: up2.slice(0, 80) }));
  await open(Tc, a1); await Tc.click("[data-cert]").catch(() => {}); await Tc.waitForSelector("#certBox .cert", { timeout: 5000 }).catch(() => {});
  const ct = await text(Tc, "#certBox .cert");
  check(/Sulphide S/.test(ct) && /moisture/i.test(ct) && /8\.4 %/.test(ct) && /NaCN|CN/.test(ct), "the certificate lists every result");
  await Tc.click("#certClose").catch(() => {});

  log("Other (type it): a sample sent only for an analysis not on the list");
  await H.tab(Tc, "submit"); if (await Tc.$("#rAgain")) await Tc.click("#rAgain");
  await Tc.selectOption("#rType", "carbon"); await Tc.waitForTimeout(100);
  check((await opts(Tc, "#rTest")).at(-1) === "x" && /Other \(type it\)/.test(await text(Tc, '#rTest option[value="x"]')), "the analysis list ends with Other (type it)");
  await Tc.selectOption("#rTest", "x"); await Tc.waitForTimeout(150);
  check(await Tc.$eval("#rAnMore", d => d.open) && /OTHER/.test(await text(Tc, "#rRoute")), "it opens Other analysis; the route is OTHER");
  await Tc.selectOption("#rPurpose", "plant"); await Tc.selectOption("#rSection", "PLT"); await Tc.fill("#rSubmitter", "Gold room"); await Tc.fill("#rTag", "");
  await Tc.click("#rSubmit"); await Tc.waitForTimeout(300);
  check(/Type the analysis/.test(await H.toastText(Tc)) && !(await Tc.$("#rResult code")), "nothing typed: it asks for the analysis");
  await Tc.fill("#rAnMore .an-x", "Ash content"); await Tc.click("#rSubmit"); const [x1] = await idsOut(Tc), sx = doc(x1);
  check(sx.test === "x" && sx.route === "OTHER" && sx.testName === "Ash content" && sx.plan.find(x => x.key === "xan")?.name === "Analysis: Ash content" && JSON.stringify(sx.xan) === '["Ash content"]', "stored on OTHER, named Ash content, with an analysis step of that name");
  await open(Tc, x1); await Tc.waitForSelector("#rcTest", { timeout: 5000 }).catch(() => {});
  check(await Tc.$eval("#rcRoute", e => e.value).catch(() => "") === "OTHER", "at receipt its own route is offered");
  if (await Tc.$("#rcTemp")) await Tc.fill("#rcTemp", "5");
  await Tc.click('[data-receipt="confirm"]').catch(() => {}); await waitFor(() => doc(x1).stageKey === "received", 5000);
  check(doc(x1).stageKey === "received" && doc(x1).route === "OTHER", "and it is received on it");

  log("Details: a fixed list takes a typed value");
  await H.tab(Tc, "submit"); if (await Tc.$("#rAgain")) await Tc.click("#rAgain");
  await Tc.selectOption("#rType", "plant_feed"); await Tc.waitForTimeout(100); await Tc.$eval("#rMore", d => { d.open = true; });
  const pts = await opts(Tc, "#rD_point");
  check(pts.at(-1) === "__other" && !(await Tc.isVisible("#rD_point_x")), "the sampling points end with Other…");
  await Tc.selectOption("#rD_point", "__other"); await Tc.waitForTimeout(100);
  check(await Tc.isVisible("#rD_point_x"), "choosing it opens a box to type it");
  await Tc.fill("#rD_point_x", "Trash screen underflow");
  await Tc.selectOption("#rPurpose", "plant"); await Tc.selectOption("#rSection", "PLT"); await Tc.fill("#rSubmitter", "Plant"); await Tc.fill("#rTag", "");
  await Tc.click("#rSubmit"); const [d1] = await idsOut(Tc);
  check(Object.values(doc(d1).details || {}).includes("Trash screen underflow"), "stored as typed: " + JSON.stringify(doc(d1).details));

  log("Shift end: P.P filled in, MET and other plant sections can be chosen");
  await H.tab(Tc, "submit"); if (await Tc.$("#rAgain")) await Tc.click("#rAgain");
  await Tc.check('input[name="rKind"][value="job"]'); await Tc.waitForTimeout(250);
  const js = await opts(Tc, "#rSection");
  check(js.includes("PLT") && js.includes("MET") && js.includes("ENV") && !js.includes("EXP") && !js.includes("GEO") && await Tc.inputValue("#rSection") === "PLT", "Shift end: " + js.join(",") + ", PLT chosen");
  await Tc.selectOption("#rSection", "MET"); await Tc.waitForTimeout(100);
  check(await Tc.inputValue("#rSection") === "MET", "MET can send a shift end");
  await Tc.check('input[name="rKind"][value="met"]'); await Tc.waitForTimeout(250);
  check((await opts(Tc, "#rSection")).includes("PLT") && await Tc.inputValue("#rSection") === "MET", "MET Lab job: MET chosen, others allowed");
  check((await opts(Tc, "#jTpl")).join() === "cact,tank,brt,preg,qaqc,custom" && /Other testwork/.test(await text(Tc, '#jTpl option[value="custom"]')), "MET Lab templates: the five routine ones and Other testwork");
  await Tc.check('input[name="rKind"][value="job"]'); await Tc.waitForTimeout(250);
  check((await opts(Tc, "#jTpl")).join() === "mill,elution,cact,custom" && /Other samples/.test(await text(Tc, '#jTpl option[value="custom"]')), "Shift end templates end with Other samples");

  log("QA/QC set: three ID groups by default, each its own first code and number");
  await jobForm(Tc, "met", "qaqc", "2026-10-22");
  check(await Tc.$$eval("#jRows tr.j-gh", r => r.length) === 3 && await Tc.$$eval("#jRows .j-code", r => r.length) === 0, "each group's rows folded under one line");
  check(await Tc.$$eval("#jIdg .idg-row", r => r.length) === 3 && await Tc.inputValue("#jGn") === "3" && (await codes(Tc)).length === 86, "PPS, CB, SL: 45 + 26 + 15");
  check(await Tc.inputValue('#jIdg .g-first[data-g="0"]') === "MLABPPS01" && await Tc.inputValue('#jIdg .g-first[data-g="1"]') === "MLABCB01" && /Process plant \(PPS\)/.test(await text(Tc, '#jIdg .idg-row[data-g="0"] .g-hd')) && /First code/.test(await text(Tc, '#jIdg .idg-row[data-g="0"]')), "each group's first code, under its name");
  check(await Tc.$eval("#jIdg", b => { const h = b.querySelector(".idg-head"), r = b.querySelector(".idg-row"); return !!h && !!r && h.compareDocumentPosition(r) & Node.DOCUMENT_POSITION_FOLLOWING && getComputedStyle(h).backgroundColor !== "rgba(0, 0, 0, 0)" && getComputedStyle(r).borderTopStyle === "solid"; }), "v32: ID groups comes first, on a filled strip; each group in its own box");
  await Tc.fill('#jIdg .g-n[data-g="0"]', "2"); await Tc.fill('#jIdg .g-n[data-g="1"]', "1"); await Tc.fill('#jIdg .g-n[data-g="2"]', "1"); await Tc.waitForTimeout(150);
  await Tc.selectOption("#jGn", "4"); await Tc.waitForTimeout(150);
  await Tc.fill('#jIdg .g-first[data-g="3"]', "MLABSTD1"); await Tc.fill('#jIdg .g-n[data-g="3"]', "2"); await Tc.selectOption('#jIdg .g-test[data-g="3"]', "aufx"); await Tc.waitForTimeout(150);
  await Tc.$eval('#jIdg .idg-row[data-g="3"] .g-more', d => { d.open = true; }); await Tc.fill('#jIdg .g-l[data-g="3"]', "Standards"); await Tc.waitForTimeout(150);
  let cs = await codes(Tc);
  check(cs.join() === "MLABPPS0120261022,MLABPPS0220261022,MLABCB0120261022,MLABSL0120261022,MLABSTD120261022,MLABSTD220261022", "a fourth group (standards, MLABSTD1 counting 1, 2): " + cs.join());
  const descs = await Tc.$$eval("#jRows .j-desc", es => es.map(e => e.value));
  check(descs[4] === "Standards 01" && descs[0] === "MET QA/QC process plant sample 01", "descriptions follow the group's label: " + descs[4]);
  await Tc.fill("#rSubmitter", "MET technician"); await Tc.click("#rSubmit"); const q1 = await idsOut(Tc);
  check(q1.length === 6 && doc("MLABSTD120261022")?.test === "aufx" && doc("MLABCB0120261022")?.test === "c_load" && doc("MLABPPS0120261022")?.purposeKey === "qc", "submitted as one job: " + q1.join(", "));
  await jobForm(Tc, "met", "qaqc", "2026-10-23");
  check(await Tc.$$eval("#jIdg .idg-row", r => r.length) === 4 && await Tc.inputValue('#jIdg .g-n[data-g="0"]') === "2" && await Tc.inputValue('#jIdg .g-first[data-g="3"]') === "MLABSTD1", "the template remembers its groups, first codes and numbers");

  log("A job's codes already used: the next free numbers");
  await jobForm(Tc, "met", "qaqc", "2026-10-22");
  await Tc.fill("#rSubmitter", "MET technician"); await Tc.click("#rSubmit"); await Tc.waitForSelector("#jFree", { timeout: 15000 }).catch(() => {});
  check(await Tc.isVisible("#jFree") && /6 already used/.test(await text(Tc, "#jInfo")) && !(await Tc.$("#rResult code")), "the same day again: nothing submitted, the codes marked, Next free numbers offered: " + JSON.stringify({ toast: await H.toastText(Tc), info: await text(Tc, "#jInfo"), codes: await codes(Tc), res: await text(Tc, "#rResult") }));
  await Tc.click("#jFree"); await Tc.waitForTimeout(150);
  cs = await codes(Tc);
  check(cs.join() === "MLABPPS0320261022,MLABPPS0420261022,MLABCB0220261022,MLABSL0220261022,MLABSTD320261022,MLABSTD420261022", "each group goes on: " + cs.join());
  await Tc.click("#rSubmit"); const q2 = await idsOut(Tc);
  check(q2[0] === "MLABPPS0320261022" && q2.length === 6, "then it goes through");

  log("Other testwork: named, its samples from a first code");
  await jobForm(Tc, "met", "custom", "2026-10-22");
  check(await Tc.isVisible("#jTw") && await Tc.inputValue("#rPurpose") === "met" && (await codes(Tc)).length === 0, "Testwork name, testwork as the purpose, no samples until a first code is typed");
  await Tc.fill("#rSubmitter", "MET technician"); await Tc.click("#rSubmit"); await Tc.waitForTimeout(300);
  check(/Type the first code/.test(await H.toastText(Tc)), "without one it asks for the first code");
  await Tc.fill("#jTw", "Leach kinetics"); await Tc.fill('#jIdg .g-first[data-g="0"]', "MLABLK1"); await Tc.fill('#jIdg .g-n[data-g="0"]', "3");
  await Tc.selectOption('#jIdg .g-test[data-g="0"]', "x"); await Tc.waitForTimeout(150);
  await Tc.fill("#jGA0 .an-x", "Cu, Ag"); await Tc.waitForTimeout(150);
  cs = await codes(Tc);
  check(cs.join() === "MLABLK120261022,MLABLK220261022,MLABLK320261022", "MLABLK1 counts 1, 2, 3: " + cs.join());
  await Tc.click("#rSubmit"); const lk = await idsOut(Tc), l1 = doc(lk[0]);
  check(l1.route === "MET-JOB" && l1.test === "x" && JSON.stringify(l1.xan) === '["Cu","Ag"]' && l1.testName === "Cu + Ag" && l1.details?.Testwork === "Leach kinetics" && /^Leach kinetics, /.test(l1.batchName || "") && l1.job === "custom",
    "on the MET Lab's route, for Cu and Ag, under its own name: " + JSON.stringify({ r: l1.route, t: l1.testName, b: l1.batchName }));

  log("v32: a template of fixed rows (bottle roll): ID groups replace its own codes");
  await jobForm(Tc, "met", "brt", "2026-10-22");
  const brt0 = await codes(Tc);
  check(await Tc.inputValue("#jGn") === "0" && /None: template codes/.test(await text(Tc, '#jGn option[value="0"]')) && !(await Tc.$("#jIdg .idg-row")) && brt0.length === 17 && brt0[0] === "MLABPF+42520261022", "no groups: the bottle roll's own 17 codes, nothing else in the way");
  await Tc.selectOption("#jGn", "2"); await Tc.waitForTimeout(150);
  check((await codes(Tc)).length === 0 && await Tc.$$eval("#jIdg .idg-row", r => r.length) === 2 && !(await Tc.isVisible("#jN_n1")), "two groups: the template's codes go (and its filtrate number), no default code left");
  await Tc.fill('#jIdg .g-first[data-g="0"]', "MLABBRT01"); await Tc.fill('#jIdg .g-n[data-g="0"]', "3"); await Tc.fill('#jIdg .g-first[data-g="1"]', "MLABBSL01"); await Tc.waitForTimeout(150);
  check((await codes(Tc)).join() === "MLABBRT0120261022,MLABBRT0220261022,MLABBRT0320261022,MLABBSL0120261022", "the rows are the groups' codes only: " + (await codes(Tc)).join());
  await Tc.selectOption("#jGn", "0"); await Tc.waitForTimeout(150);
  check((await codes(Tc)).length === 17 && await Tc.isVisible("#jN_n1"), "None brings the template's codes back");

  log("Shift end: no ID groups by default, a row's code completed with the date, a row with other analyses");
  await jobForm(Tc, "job", "mill", "2026-10-24", "N");
  check(await Tc.inputValue("#jGn") === "0" && !(await Tc.$("#jIdg .idg-row")) && (await codes(Tc)).length > 30, "the mill shift: its own codes, ID groups None");
  await Tc.selectOption("#jAdd", "plant_feed|"); await Tc.waitForTimeout(150);
  const last = (await codes(Tc)).length - 1;
  check(await Tc.isVisible(`#jRows .j-pt[data-j="${last}"]`), "Other point… adds a row whose point is typed");
  await Tc.fill(`#jRows .j-pt[data-j="${last}"]`, "Trash screen");
  await Tc.fill(`#jRows .j-code[data-j="${last}"]`, "mlnstrsh"); await Tc.dispatchEvent(`#jRows .j-code[data-j="${last}"]`, "change"); await Tc.waitForTimeout(100);
  check(await Tc.inputValue(`#jRows .j-code[data-j="${last}"]`) === "mlnstrsh20261024", "initials typed in a row: the date completes the code");
  await Tc.click(`#jRows .an-more[data-j="${last}"] summary`); await Tc.waitForTimeout(100);
  await Tc.check(`#jRows .an-more[data-j="${last}"] input[value="cn_only"]`); await Tc.fill(`#jRows .an-more[data-j="${last}"] .an-x`, "Pb"); await Tc.waitForTimeout(100);
  await Tc.fill("#jN_n1", "60"); await Tc.fill("#jN_n2", "61");
  await Tc.fill("#rSubmitter", "Mill shift"); await Tc.click("#rSubmit"); const ms = await idsOut(Tc), t1 = doc("MLNSTRSH20261024");
  check(!!t1 && t1.details["Sampling point"] === "Trash screen" && JSON.stringify(t1.tests2) === '["cn_only"]' && JSON.stringify(t1.xan) === '["Pb"]' && t1.route === "JOB" && /\+ Cyanide: NaCN, WAD & pH \+ Pb$/.test(t1.testName), "stored with its point, its other analyses and the job's route: " + JSON.stringify(t1 && { d: t1.details, n: t1.testName }));
  check(ms.length > 30, "with the rest of the shift: " + ms.length);

  const errs = errors.filter(e => !/favicon|ERR_|net::/.test(e));
  check(!errs.length, "no console errors: " + JSON.stringify(errs.slice(0, 5)));
  await browser.close();
})().catch(e => { console.log("  FAIL", e.stack || e); process.exitCode = 1; process.exit(1); });
