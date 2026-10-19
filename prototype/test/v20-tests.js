// v20: blind QA/QC re-assay. A supervisor picks samples already assayed (Storage or Ledger) and issues blind QC IDs; the link to the original
// is kept in blind/<ID>, read by supervisors and admins only; technicians receive and assay the blind samples like any other; supervisors see
// the blind results beside the original's on both records and record the comparison.
// Run: NODE_PATH=$(npm root -g) timeout 590 node v20-tests.js
const H = require("./harness");
const { store, errors, newUser, launch, signIn, fillForm, ids, open, doc, waitFor, toastText, createBatch, fillBatch, saveBatch } = H;
const names = {}, OUT = __dirname;
const log = (...a) => console.log("•", ...a);
const check = (cond, msg) => { console.log(cond ? "  PASS" : "  FAIL", msg); if (!cond) process.exitCode = 1; };
const stock = id => store["stock/" + id];
const link = id => store["blind/" + id];
const text = async (page, sel) => ((await page.textContent(sel).catch(() => "")) || "").replace(/\s+/g, " ");
const showBatch = async (page, id) => { await H.tab(page, "batches"); await page.waitForSelector(`[data-bsel="${id}"]`, { timeout: 5000 }); await page.click(`[data-bsel="${id}"]`); await page.waitForSelector("#batchBox", { timeout: 5000 }); await page.waitForTimeout(250); };
async function groupMove(page, sids, toKey){
  for (let g = 0; g < 15; g++){ const k = doc(sids[0]).stageKey; if (k === toKey) return true; await page.click(`[data-bmove="${k}"]`); await waitFor(() => sids.every(id => doc(id).stageKey !== k), 6000); await page.waitForTimeout(300); }
  return doc(sids[0]).stageKey === toKey;
}
async function receipt(page, id){ await open(page, id); await page.click('[data-receipt="confirm"]'); await waitFor(() => doc(id).stageKey === "received"); await page.waitForTimeout(400); }
async function release(page, id){ await open(page, id); await page.click('[data-step="next"]'); await waitFor(() => doc(id).stageKey === "released", 5000); await page.waitForTimeout(300); }
async function material(page, id, k, what, ref){
  await open(page, id);
  const before = JSON.stringify(doc(id).materials);
  await page.selectOption("#mx_" + k, what); if (ref != null) await page.fill("#mr_" + k, ref);
  await page.click(`[data-mat="${k}"]`);
  await waitFor(() => JSON.stringify(doc(id).materials) !== before && !doc(id).sx, 5000); await page.waitForTimeout(300);
}

(async () => {
  const browser = await launch();
  require("./harness").useOldRoutes();   // v23: this suite is written around the routes in use before version 23
  await H.useQcStep(browser);   // v22: this suite is written around the QA/QC review step, which Settings now turn on
  const P = await newUser(browser, { uid: "u_p", name: "Public", canEdit: true, names });
  const Tc = await newUser(browser, { uid: "u_t", name: "Tech", canEdit: true, names }); await signIn(Tc, "tech1");
  const Sv = await newUser(browser, { uid: "u_s", name: "Super", canEdit: true, names }); await signIn(Sv, "super");
  const Ad = await newUser(browser, { uid: "u_a", name: "Admin", canEdit: true, names }); await signIn(Ad, "admin");
  await P.waitForTimeout(1500);

  log("Three exploration samples assayed, released and stored");
  await fillForm(P, "submit", { section: "EXP", submitter: "Ama", count: 3, tags: "DH-101" }); const ex = await ids(P);
  for (const id of ex) await receipt(Tc, id);
  const b0 = await createBatch(Tc, "fa50", ex);
  check(await groupMove(Tc, ex, "weigh"), "batch at weighing");
  const AU = { [ex[0]]: "1.20", [ex[1]]: "2.50", [ex[2]]: "0.80" };
  await showBatch(Tc, b0); await fillBatch(Tc, b0, sid => AU[sid] || "1.00"); const q0 = await saveBatch(Tc, b0);
  check(q0.status === "pass", "batch QC passed: " + q0.status);
  check(await groupMove(Tc, ex, "qc"), "samples at QA/QC");
  for (const id of ex) await release(Sv, id);
  for (const id of ex) for (const [i, m] of doc(id).materials.entries()) await material(Tc, id, m.k, "store", `Rack 3-${i + 1}`);
  check(ex.every(id => doc(id).stageKey === "storage" && stock(id)?.st === "store"), "all three in storage");
  const before = Object.fromEntries(ex.map(id => [id, JSON.stringify(doc(id))])), stockBefore = Object.fromEntries(ex.map(id => [id, JSON.stringify(stock(id))]));

  log("Chain of custody scrolls after about five entries");
  await open(Tc, ex[0]);
  const hi = await Tc.$eval(".hist", h => ({ n: h.children.length, ch: h.clientHeight, sh: h.scrollHeight, cls: h.className, fifth: h.children[4].offsetTop + h.children[4].offsetHeight, sixth: h.children[5].offsetTop + h.children[5].offsetHeight }));
  check(hi.n === doc(ex[0]).history.length && hi.n > 5 && /scrolls/.test(hi.cls) && hi.sh > hi.ch && hi.ch >= hi.fifth && hi.ch < hi.sixth, `all ${hi.n} entries are in the list; it shows about five (${hi.ch}px of ${hi.sh}px) and scrolls`);
  await Tc.emulateMedia({ media: "print" });
  check(await Tc.$eval(".hist", h => h.clientHeight >= h.scrollHeight - 1), "printed, the whole log shows");
  await Tc.emulateMedia({ media: "screen" });
  const Pub = await newUser(browser, { uid: "u_q", name: "Public 2", canEdit: true, names, hash: ex[0] }); await Pub.waitForSelector(".sid", { timeout: 8000 }); await Pub.waitForTimeout(400);
  check(await Pub.$eval(".hist", h => h.children.length) === doc(ex[0]).history.length, "the public lookup has the full log too (scrolling)");
  await Pub.close();

  log("Technicians can't pick samples for a blind check");
  await H.tab(Tc, "storage"); await Tc.waitForTimeout(500);
  check(!(await Tc.$("[data-qapick]")) && !(await Tc.$("#qaList")), "a technician's Storage has no Blind QA/QC picks and no list of blind checks");
  await H.tab(Tc, "ledger"); await Tc.waitForTimeout(500);
  check(!(await Tc.$("[data-qapick]")), "nor does a technician's Ledger");

  log("A supervisor picks two stored samples and issues blind IDs");
  await H.tab(Sv, "storage"); await Sv.waitForSelector(`[data-qapick="${ex[0]}"]`, { timeout: 5000 });
  check((await Sv.$$("[data-qapick]")).length === 3, "Storage offers one Blind QA/QC pick per stored sample (not one per material)");
  await Sv.check(`[data-qapick="${ex[0]}"]`); await Sv.check(`[data-qapick="${ex[2]}"]`);
  check(/2 picked for a blind QA\/QC check/.test(await text(Sv, "#view-storage .qa-bar")), "the bar counts the picks");
  await H.tab(Sv, "ledger"); await Sv.waitForTimeout(500);
  check(await Sv.isChecked(`[data-qapick="${ex[0]}"]`) && !(await Sv.isChecked(`[data-qapick="${ex[1]}"]`)) && /2 picked/.test(await text(Sv, "#view-ledger .qa-bar")), "the Ledger shows the same picks (pick from either tab)");
  await Sv.click('#view-ledger [data-qa="make"]'); await Sv.waitForSelector("#qaBox .modal-card"); await Sv.waitForSelector("#qaGo:not([disabled])", { timeout: 5000 }); await Sv.waitForTimeout(300);
  let box = await text(Sv, "#qaBox");
  check(/Ready.*Ready/.test(box) && box.includes("Rack 3-1") && /Issue 2 blind IDs/.test(box), "the box lists both picks as ready, with where their material is kept");
  await Sv.screenshot({ path: OUT + "/v20-pick-box.png" });
  await Sv.fill("#qaNote", "Monthly blind check");
  const nBefore = Object.keys(store).filter(k => k.startsWith("samples/QC-")).length;
  await Sv.click("#qaGo");
  await Sv.waitForSelector("#qaLabels", { timeout: 10000 }); await Sv.waitForTimeout(400);
  const qc = Object.keys(store).filter(k => k.startsWith("blind/")).map(k => k.slice(6)).sort();
  check(qc.length === 2 && qc.every(id => new RegExp(`^QC-${H.T}-\\d{4}$`).test(id)) && Object.keys(store).filter(k => k.startsWith("samples/QC-")).length === nBefore + 2, `two blind samples issued with QC IDs: ${qc.join(", ")}`);
  const of = Object.fromEntries(qc.map(id => [id, link(id).of])), blindFor = Object.fromEntries(qc.map(id => [link(id).of, id]));
  check(new Set(Object.values(of)).size === 2 && Object.values(of).every(o => o === ex[0] || o === ex[2]), "each blind ID is linked to one of the picked originals");
  check(qc.every(id => link(id).by === "super" && link(id).note === "Monthly blind check" && link(id).mats.length && Array.isArray(link(id).cmps)), "the link records who issued it, the note and where the material is kept");
  box = await text(Sv, "#qaBox");
  check(qc.every(id => box.includes(id) && box.includes(of[id])), "the box shows each blind ID beside its original");
  const B = id => doc(id);
  check(qc.every(id => B(id).section === "QC" && B(id).purposeKey === "qc" && B(id).submitter === "QA/QC" && B(id).stageKey === "submitted" && B(id).lab === true && !(B(id).tags || []).length && B(id).typeKey === "pulp" && B(id).route === "EXP-FA"),
    "blind samples: QC section, QA/QC purpose, awaiting receipt, no site sample code, logged as assay pulp on the original's route");
  check(qc.every(id => !JSON.stringify(B(id)).includes(of[id]) && !JSON.stringify(B(id)).includes("DH-10") && !JSON.stringify(B(id)).includes("Ama")), "nothing on a blind sample record points back to its original (ID, site sample code, submitter)");
  check(qc.every(id => B(id).createdBy === "public" && B(id).history[0].by === "public" && !JSON.stringify(B(id)).includes("Supervisor") && !JSON.stringify(B(id)).includes('"super"')), "the blind record is a QA/QC submission: who issued it is only in the link");
  check(qc.every(id => { const p = B(id).plan.map(x => x.key); return p[1] === "received" && p[2] === "weigh" && !p.some(k => ["sort", "dry", "crush", "split", "pulv"].includes(k)); }), "the pulp is already prepared: after receipt the blind sample goes straight to weighing");
  check(ex.every(id => JSON.stringify(doc(id)) === before[id] && JSON.stringify(stock(id)) === stockBefore[id]), "nothing was written on the originals or their stock records");
  await Sv.click("#qaLabels"); await Sv.waitForSelector("#labelBox:not([hidden]) .bag-label");
  const lb = await text(Sv, "#labelBox");
  check((await Sv.$$("#labelBox .bag-label")).length === 2 && qc.every(id => lb.includes(id)) && !ex.some(id => lb.includes(id)), "Print labels gives two blind labels that don't show the originals");
  await Sv.click("#lbClose"); await Sv.screenshot({ path: OUT + "/v20-issued.png" }); await Sv.click("#qaDone"); await Sv.waitForTimeout(300);
  check(!(await Sv.$("#qaBox")) && !(await Sv.$(".qa-bar")), "closing clears the picks");

  log("Technicians see only the blind ID");
  await open(Tc, qc[0]);
  let t = await text(Tc, "#view-track");
  check(!(await Tc.$("#qaPanel")) && !ex.some(id => t.includes(id)) && /Awaiting receipt/i.test(t), "a technician's blind sample record has no link panel and no original ID");
  await open(Tc, ex[0]); t = await text(Tc, "#view-track");
  check(!(await Tc.$("#qaPanel")) && !qc.some(id => t.includes(id)), "and the original's record shows no blind ID");
  await H.tab(Tc, "storage"); await Tc.waitForTimeout(400);
  check(!(await Tc.$(".qa-of")), "Storage shows no Blind of note to a technician");

  log("The technician receives, batches and assays the blind samples");
  for (const id of qc) await receipt(Tc, id);
  check(qc.every(id => doc(id).stageKey === "received" && doc(id).route === "EXP-FA" && stock(id)?.st === "lab"), "blind samples received on their route, with stock records");
  const inRows = H.ledger().filter(r => qc.includes(r.sid) && r.dir === "in");
  check(inRows.length === 2 && inRows.every(r => !ex.some(id => JSON.stringify(r).includes(id))), "the Ledger has an IN line for each blind ID, with nothing of the original in it");
  const b1 = await createBatch(Tc, "fa50", qc);
  check(await groupMove(Tc, qc, "weigh"), "blind batch at weighing");
  const BV = { [blindFor[ex[0]]]: "1.26", [blindFor[ex[2]]]: "1.30" };
  await showBatch(Tc, b1); await fillBatch(Tc, b1, sid => BV[sid] || "1.00"); const q1 = await saveBatch(Tc, b1);
  check(q1.status === "pass" && qc.every(id => doc(id).results?.rows?.Au), "blind batch QC passed and the results are on the blind samples");

  log("The supervisor compares blind with original");
  const bA = blindFor[ex[0]], bC = blindFor[ex[2]];
  await open(Sv, bA); await Sv.waitForSelector("#qaPanel"); await Sv.waitForTimeout(500);
  let qp = await text(Sv, "#qaPanel");
  check(qp.includes(`Blind re-assay of ${ex[0]}`) && /1\.20.*1\.26.*\+0\.06.*4\.9%.*within 20%/.test(qp) && /not yet released/.test(qp), "the blind record shows the original 1.20 beside the blind 1.26: +0.06 g/t, 4.9%, within 20% (not yet released)");
  await Sv.$eval("#qaPanel", e => e.scrollIntoView()); await Sv.screenshot({ path: OUT + "/v20-compare.png" });
  await Sv.fill(`[id="qaNote-${bA}"]`, "Agrees");
  await Sv.click(`[data-qarec="${bA}"]`);
  await waitFor(() => (link(bA).cmps || []).length === 1, 5000); await Sv.waitForTimeout(400);
  const c0 = link(bA).cmps[0];
  check(c0.by === "super" && c0.state === "draft" && c0.note === "Agrees" && c0.rows[0].k === "Au" && Math.abs(c0.rows[0].r - 4.88) < 0.01 && c0.rows[0].v === "within 20%", "the comparison is recorded in the link: who, values, relative difference, verdict, note");
  check(!JSON.stringify(doc(bA)).includes(ex[0]) && JSON.stringify(doc(ex[0])) === before[ex[0]], "recording writes nothing on either sample record");
  await open(Sv, ex[2]); await Sv.waitForSelector("#qaPanel"); await Sv.waitForTimeout(500);
  qp = await text(Sv, "#qaPanel");
  check(qp.includes(`Re-assayed blind as ${bC}`) && /0\.80.*1\.30.*\+0\.5.*47\.6%.*outside 20%/.test(qp), "the original's record shows its blind re-assay: 0.80 against 1.30, 47.6%, outside 20%");
  await Sv.click(`[data-qarec="${bC}"]`); await waitFor(() => (link(bC).cmps || []).length === 1, 5000);
  check(link(bC).cmps[0].rows[0].v === "outside 20%", "recorded from the original's record too");

  log("Admins see it; technicians still don't");
  await open(Ad, ex[0]); await Ad.waitForSelector("#qaPanel"); await Ad.waitForTimeout(500);
  qp = await text(Ad, "#qaPanel");
  check(qp.includes(bA) && /Recorded.*Super.*Agrees/.test(qp), "the admin sees the blind check and the recorded comparison on the original");
  await H.tab(Ad, "storage"); await Ad.waitForSelector("#qaList"); await Ad.click("#qaList summary"); await Ad.waitForTimeout(800);
  const ql = await text(Ad, "#qaList");
  await Ad.$eval("#qaList", e => e.scrollIntoView()); await Ad.screenshot({ path: OUT + "/v20-storage-list.png" });
  check(qc.every(id => ql.includes(id) && ql.includes(of[id])) && (ql.match(/Recorded/g) || []).length >= 2, "Storage lists the blind checks for admins, with the comparison recorded");
  await open(Tc, bA); t = await text(Tc, "#view-track");
  check(!(await Tc.$("#qaPanel")) && !t.includes(ex[0]), "after the comparison the technician's blind record still shows nothing of the original");
  await H.tab(Sv, "ledger"); await Sv.waitForTimeout(500);
  const lgS = await text(Sv, "#view-ledger");
  check(lgS.includes(`Blind of ${of[qc[0]]}`) && !(await Sv.$(`[data-qapick="${qc[0]}"]`)), "the supervisor's Ledger marks blind IDs with their original; a blind sample can't be picked again");
  await H.tab(Tc, "ledger"); await Tc.waitForTimeout(500);
  check(!(await text(Tc, "#view-ledger")).includes("Blind of"), "the technician's Ledger does not");

  log("Release of the blind results");
  await showBatch(Tc, b1);
  check(await groupMove(Tc, qc, "qc"), "blind samples at QA/QC");
  await release(Sv, bA);
  await open(Sv, bA); await Sv.waitForSelector("#qaPanel"); await Sv.waitForTimeout(400);
  check(/Blind results released/.test(await text(Sv, "#qaPanel")), "once released the comparison uses the blind certificate");

  log("Signing out drops the link");
  await Sv.click("#signBtn"); await Sv.waitForTimeout(300); await signIn(Sv, "tech2"); await Sv.waitForTimeout(400);
  await open(Sv, ex[0]); t = await text(Sv, "#view-track");
  check(!(await Sv.$("#qaPanel")) && !t.includes(bA), "the same browser signed in as a technician no longer shows the link");

  log("Register a batch at the lab (walk-in)");
  const W = await newUser(browser, { uid: "u_w", name: "Walk-in", canEdit: true, names }); await W.waitForTimeout(800);
  await H.tab(W, "register"); await W.waitForSelector("#rType");
  check(await W.isChecked('input[name="rKind"][value="single"]') && await W.isVisible("#rTag") && !(await W.isVisible("#rBatch")), "the form starts on Single sample: one site sample code box, no sample list");
  await W.check('input[name="rKind"][value="batch"]');
  check(await W.isVisible("#rBatch") && !(await W.isVisible("#rTag")) && (await W.$$("#rRows tr")).length === 2 && /Register 2 samples/.test(await W.textContent("#rSubmit")), "Batch shows the sample list (two rows to start) instead of the single code box");
  await W.selectOption("#rSection", "MET"); await W.selectOption("#rType", "plant_feed"); await W.selectOption("#rPurpose", "plant"); await W.selectOption("#rTest", "plant_solids");
  await W.fill("#rSubmitter", "Mill shift"); await W.fill("#rSubBadge", "B-77"); await W.fill("#rHandTo", "Lab Technician A"); await W.fill("#rHandBadge", "T-9");
  const paste = (sel, t) => W.$eval(sel, (el, t) => { const dt = new DataTransfer(); dt.setData("text/plain", t); el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true })); }, t);
  await paste('#rRows .r-code[data-i="0"]', "CIL-A-01\tTank 1\nCIL-A-02\tTank 2\nCIL-A-03\tTank 3\nCIL-A-04\tTank 4\n");
  const rv = () => W.$$eval("#rRows tr", trs => trs.map(tr => [tr.querySelector(".r-code").value, tr.querySelector(".r-src").value]));
  check(JSON.stringify(await rv()) === JSON.stringify([["CIL-A-01", "Tank 1"], ["CIL-A-02", "Tank 2"], ["CIL-A-03", "Tank 3"], ["CIL-A-04", "Tank 4"]]) && await W.inputValue("#rCount") === "4", "pasting two columns from a spreadsheet fills codes and source locations, adding rows (count 4)");
  await W.focus('#rRows .r-code[data-i="3"]'); await W.keyboard.press("Enter"); await W.waitForTimeout(150);
  check((await W.$$("#rRows tr")).length === 5 && await W.$eval('#rRows .r-code[data-i="4"]', e => e === document.activeElement) && !Object.keys(store).some(k => store[k]?.submitter === "Mill shift"), "Enter on the last row adds a row and moves to it (the form is not sent)");
  await W.click('[data-rdel="4"]'); await W.waitForTimeout(100);
  check((await W.$$("#rRows tr")).length === 4 && await W.inputValue("#rCount") === "4", "✕ removes a row");
  await W.fill('#rRows .r-code[data-i="2"]', "cil-a-01"); await W.waitForTimeout(100);
  check(await W.$eval('#rRows .r-code[data-i="0"]', e => e.classList.contains("dup")) && await W.$eval('#rRows .r-code[data-i="2"]', e => e.classList.contains("dup")) && /Same code twice/.test(await W.textContent("#rRowInfo")), "a code typed twice is marked on both rows");
  await W.click("#rSubmit"); await W.waitForTimeout(400);
  check(/appears twice/.test(await toastText(W)) && !(await W.$("#rResult code")), "and the batch is not sent");
  await W.fill('#rRows .r-code[data-i="2"]', "CIL-A-03");
  await W.fill("#rBatchName", "Night shift CIL survey");
  await W.screenshot({ path: OUT + "/v20-batch-form.png", fullPage: true });
  await W.click("#rSubmit");
  const bat = await ids(W);
  const ref = doc(bat[0]).batchId;
  check(bat.length === 4 && /^B-MET-\d{8}-\d{4}$/.test(ref) && ref === "B-" + bat[0] && bat.every((id, i) => doc(id).batchId === ref && doc(id).batchIndex === i + 1 && doc(id).batchSize === 4 && doc(id).batchName === "Night shift CIL survey"), `four samples, each with its own ID, tied by batch ${ref}`);
  check(bat.every((id, i) => doc(id).tags.join() === `CIL-A-0${i + 1}` && doc(id).source === `Tank ${i + 1}` && doc(id).handedTo === "Lab Technician A" && doc(id).subBadge === "B-77" && doc(id).stageKey === "submitted"), "each keeps its own site sample code and source; the shared details are on all four; all wait for receipt");
  check(bat.every((id, i) => +id.split("-").pop() === +bat[0].split("-").pop() + i), "IDs follow the row order");
  check((await text(W, "#rResult")).includes(ref) && /Print 4 labels/.test(await text(W, "#rResult")), "the result names the batch and prints all four labels");
  await W.click("#rAgain"); await W.waitForSelector("#rType");
  check(await W.isChecked('input[name="rKind"][value="batch"]'), "the next form remembers Batch");

  log("The batch page and receiving the whole batch");
  await W.fill("#lookupInput", ref); await W.press("#lookupInput", "Enter"); await W.waitForSelector("#view-track .sid"); await W.waitForTimeout(400);
  let bv = await text(W, "#view-track");
  check((await W.textContent(".sid")) === ref && bat.every(id => bv.includes(id)) && bv.includes("Night shift CIL survey") && bv.includes("CIL-A-04") && !(await W.$("#bvRecv")), "searching the batch reference lists its four samples (signed out: no receipt)");
  await open(Tc, bat[1]);
  check((await text(Tc, "#view-track")).includes(`${ref} (2 of 4)`), "each sample record names its batch");
  // v24d: a batch is received as one: its samples have no receipt form of their own, their record sends you to the batch
  check(await Tc.isVisible(`#inBatch .btn[data-open="${ref}"]`) && /^Receive the batch$/.test(await text(Tc, `#inBatch .btn[data-open="${ref}"]`)) && /\(4 samples\)/.test(await text(Tc, "#inBatch")) && !(await Tc.$('[data-receipt="confirm"]')), "its record sends you to Receive the batch (no receipt of its own)");
  await Tc.click(`#inBatch .btn[data-open="${ref}"]`); await Tc.waitForSelector("#bvRecv"); await Tc.waitForTimeout(300);
  check((await Tc.textContent(".sid")) === ref && /Confirm receipt of 4/.test(await text(Tc, "#bvRecv")), "the batch link opens the batch page; a technician can receive all four");
  await Tc.click("#bvRecvBtn"); await Tc.waitForTimeout(300);
  check(/Tick that the bags match/.test(await toastText(Tc)) && bat.every(id => doc(id).stageKey === "submitted"), "receipt waits for the bags-match tick");
  await Tc.check("#bvOk"); await Tc.click("#bvRecvBtn");
  await waitFor(() => bat.every(id => doc(id).stageKey === "received" && stock(id)?.st === "lab"), 10000); await Tc.waitForTimeout(600);
  check(bat.every(id => doc(id).stageKey === "received" && doc(id).receivedBy === "Lab Technician A" && /Received with batch/.test(doc(id).history.at(-1).note)), "all four received in one go, in the technician's name");
  await waitFor(() => H.ledger().filter(r => bat.includes(r.sid) && r.dir === "in").length === 4, 8000);   // the ledger is written just after the receipt
  check(H.ledger().filter(r => bat.includes(r.sid) && r.dir === "in").length === 4, "each has its IN line in the Ledger (" + H.ledger().filter(r => bat.includes(r.sid) && r.dir === "in").length + ")");
  bv = await text(Tc, "#view-track");
  check(!(await Tc.$("#bvRecv")) && /4 In progress: Received/.test(bv), "the batch page shows them received");
  const L = await newUser(browser, { uid: "u_l", name: "Link", canEdit: true, names, hash: ref }); await L.waitForSelector("#view-track .sid", { timeout: 8000 }); await L.waitForTimeout(300);
  check((await L.textContent(".sid")) === ref && (await L.$$("#view-track tbody tr")).length === 4, "a batch tracking link opens the batch");
  await L.close();

  log("Single sample, and a batch received on the spot by lab staff");
  await fillForm(W, "register", { section: "MET", submitter: "Ama", count: 1, tags: "SOLO-1" }); const solo = await ids(W);
  check(solo.length === 1 && !doc(solo[0]).batchId && doc(solo[0]).tags.join() === "SOLO-1", "Single sample: one ID, no batch reference");
  await fillForm(Tc, "register", { section: "MET", type: "plant_feed", purpose: "plant", test: "plant_solids", submitter: "Mill shift", count: 2, tags: "CIL-B-01, CIL-B-02" }); const lab2 = await ids(Tc);
  check(lab2.length === 2 && lab2.every(id => doc(id).stageKey === "received" && doc(id).batchId === "B-" + lab2[0]), "lab staff register a batch received at once, with its batch reference");

  log("Phone width");
  const M = await newUser(browser, { uid: "u_m", name: "Phone", canEdit: true, names }, { width: 375, height: 760 }); await signIn(M, "super");
  await open(M, ex[2]); await M.waitForSelector("#qaPanel"); await M.waitForTimeout(400);
  check(await M.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "the comparison fits a phone without sideways scroll");
  await M.$eval("#qaPanel", e => e.scrollIntoView()); await M.screenshot({ path: OUT + "/v20-compare-phone.png" });
  await H.tab(M, "storage"); await M.waitForTimeout(800);
  check(await M.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "Storage with picks fits a phone");
  await H.tab(M, "register"); await M.waitForSelector("#rType"); await M.check('input[name="rKind"][value="batch"]'); await M.fill("#rCount", "6"); await M.waitForTimeout(200);
  check(await M.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "the batch form fits a phone");
  await M.screenshot({ path: OUT + "/v20-batch-phone.png", fullPage: true });
  await M.fill("#lookupInput", ref); await M.press("#lookupInput", "Enter"); await M.waitForSelector("#view-track .sid"); await M.waitForTimeout(300);
  check(await M.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "the batch page fits a phone");

  console.log("Console errors:", errors.length ? errors.join("\n") : "[]");
  if (errors.length) process.exitCode = 1;
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
