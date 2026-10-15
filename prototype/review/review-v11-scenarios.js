// Second independent review (v11): scenario tests for results, batches and certificates.
// Run from this folder: NODE_PATH=$(npm root -g) timeout 400 node review-v11-scenarios.js
// "BUG" lines show behaviour the review flags; "OK" lines show it holds.
const H = require("./harness");
const { store, errors, newUser, launch, signIn, fillForm, ids, open, doc, toastText, batchDoc, waitFor, createBatch, fillBatch, saveBatch } = H;
const names = {};
const R = (tag, ok, msg) => console.log(ok ? "  OK  " : "  BUG ", tag, msg);
async function receipt(page, id){ await open(page, id); await page.click('[data-receipt="confirm"]'); await waitFor(() => doc(id).stageKey === "received"); await page.waitForTimeout(400); }
const showBatch = async (page, id) => { await page.click('#tabs button[data-tab="batches"]'); await page.waitForSelector(`[data-bsel="${id}"]`, { timeout: 5000 }); await page.click(`[data-bsel="${id}"]`); await page.waitForSelector("#batchBox", { timeout: 5000 }); await page.waitForTimeout(200); };
async function groupMove(page, sids, toKey){
  for (let g = 0; g < 15; g++){ const k = doc(sids[0]).stageKey; if (k === toKey) return true; await page.click(`[data-bmove="${k}"]`); await waitFor(() => sids.every(id => doc(id).stageKey !== k), 6000); await page.waitForTimeout(300); }
  return doc(sids[0]).stageKey === toKey;
}
const posOf = (b, sid, t = "s") => batchDoc(b).pos.find(x => x.t === t && (t === "s" ? x.sid === sid : x.of === sid));
async function faBatch(Tc, sids, valueOf){ const b = await createBatch(Tc, "fa50", sids); await groupMove(Tc, sids, "weigh"); await showBatch(Tc, b); await fillBatch(Tc, b, valueOf); return b; }

(async () => {
  const browser = await launch();
  const P = await newUser(browser, { uid: "u_p", name: "Public", canEdit: true, names });
  const Tc = await newUser(browser, { uid: "u_t", name: "Tech", canEdit: true, names }); await signIn(Tc, "tech1");
  const Sv = await newUser(browser, { uid: "u_s", name: "Super", canEdit: true, names }); await signIn(Sv, "super");
  await P.waitForTimeout(1500);

  // 1. Thousands separator read as a decimal point
  await fillForm(P, "submit", { section: "EXP", submitter: "Esi", count: 2 }); const a = await ids(P);
  for (const id of a) await receipt(Tc, id);
  const b1 = await faBatch(Tc, a, sid => sid === a[0] ? "1,500" : "0.80");
  await saveBatch(Tc, b1);
  const r0 = doc(a[0]).results?.rows?.Au;
  R("1-comma", !(r0 && r0.v === 1.5), `batch entry "1,500" g/t saved as ${r0 && r0.v} (flag: "${r0 && r0.f}"); 1,500 g/t should be over range, not 1.5 g/t; QC ${batchDoc(b1).qc.status}`);

  // 2. Paste: the same sample ID twice (original then its duplicate reading)
  await fillForm(P, "submit", { section: "EXP", submitter: "Esi", count: 3 }); const c = await ids(P);
  for (const id of c) await receipt(Tc, id);
  const b2 = await createBatch(Tc, "fa50", c); await groupMove(Tc, c, "weigh"); await showBatch(Tc, b2);
  const dup = batchDoc(b2).pos.find(x => x.t === "pd"); const orig = batchDoc(b2).pos.find(x => x.t === "s" && x.sid === dup.of);
  await Tc.click("#bPaste summary"); await Tc.fill("#bPasteText", `${dup.of}\t1.10\n${dup.of}\t1.30`); await Tc.click("#bPasteBtn"); await Tc.waitForTimeout(200);
  const ov = await Tc.$eval("#bp_" + orig.p, e => e.value), dv = await Tc.$eval("#bp_" + dup.p, e => e.value);
  R("2-paste", ov === "1.10" && dv === "1.30", `pasting ${dup.of} twice: original position #${orig.p} = "${ov}", its duplicate #${dup.p} = "${dv}"`);

  // 3. Supervisor runs the whole chain alone: enters batch results, accepts own warning, releases
  await fillForm(P, "submit", { section: "EXP", submitter: "Esi", count: 2 }); const d = await ids(P);
  for (const id of d) await receipt(Sv, id);
  const b3 = await createBatch(Sv, "fa50", d); await groupMove(Sv, d, "weigh"); await showBatch(Sv, b3);
  const crm = batchDoc(b3).pos.find(x => x.t === "crm");
  const exp = await Sv.$eval("#bp_" + crm.p, e => e.closest("tr").children[3].textContent); const [ev, esd] = exp.split("±").map(parseFloat);
  await fillBatch(Sv, b3, () => "0.90", { [crm.p]: (ev + 2.5 * esd).toFixed(3) }); const q3 = await saveBatch(Sv, b3);
  await showBatch(Sv, b3); await groupMove(Sv, d, "qc"); await showBatch(Sv, b3);
  await Sv.fill("#bWhy", "ok"); await Sv.click('[data-bdec="accept"]'); await waitFor(() => d.every(id => doc(id).labQc === "accepted")); await Sv.waitForTimeout(400);
  await Sv.click("#bRelease"); await waitFor(() => d.every(id => (doc(id).certs || []).length), 8000);
  const cert = doc(d[0]).certs?.[0];
  R("3-four-eyes", !(cert && cert.by === "super" && batchDoc(b3).qc.by === "super" && batchDoc(b3).qc.accepted?.by === "super"), `QC ${q3.status}; the same supervisor entered the results, accepted the warning and released ${cert ? cert.no : "nothing"}`);

  // 4. Amended certificate skips the range and checks
  await open(Sv, d[0]); await Sv.click("#amBox summary"); await Sv.fill("#am_Au", "25"); await Sv.fill("#amWhy", "typo"); await Sv.click("#amBtn");
  await waitFor(() => (doc(d[0]).certs || []).length === 2, 5000);
  const c2 = doc(d[0]).certs?.[1];
  R("4-amend-range", !(c2 && c2.rows.Au && c2.rows.Au.v === 25), `amended certificate ${c2 ? c2.no : "-"} issued with Au ${c2 && c2.rows.Au.raw} g/t (fire assay AAS range ends at 10 g/t; flag "${c2 && c2.rows.Au.f}")`);

  // 5. Correcting a batch after one of its samples was released
  await fillForm(P, "submit", { section: "EXP", submitter: "Esi", count: 2 }); const e = await ids(P);
  for (const id of e) await receipt(Tc, id);
  const b5 = await faBatch(Tc, e, () => "0.70"); await saveBatch(Tc, b5);
  await showBatch(Tc, b5); await groupMove(Tc, e, "qc");
  await open(Sv, e[0]); await Sv.click('[data-step="next"]'); await waitFor(() => (doc(e[0]).certs || []).length === 1, 5000); await Sv.waitForTimeout(400);
  await showBatch(Sv, b5); const decs = await Sv.$$eval("[data-bdec]", bs => bs.map(b => b.dataset.bdec));
  if (decs.includes("reopen")){
    await Sv.fill("#bWhy", "wrong column"); await Sv.click('[data-bdec="reopen"]'); await waitFor(() => !batchDoc(b5).qc); await Sv.waitForTimeout(400);
    await showBatch(Tc, b5); await fillBatch(Tc, b5, () => "0.95"); await Tc.click("#bSave"); await Tc.waitForTimeout(800); const tt = await toastText(Tc);
    const s = doc(e[0]);
    R("5-reopen-released", false, `after ${s.certs[0].no} was issued with Au ${s.certs[0].rows.Au.raw}, the batch could be reopened (${decs.join(",")}); the sample now holds unreleased results Au ${s.results?.rows?.Au?.raw} at stage "${s.stageKey}", certificate unchanged, labQc ${s.labQc}; saving the corrected batch: "${tt}"; batch QC now ${JSON.stringify(batchDoc(b5).qc && batchDoc(b5).qc.status)}; other sample ${e[1]} labQc ${doc(e[1]).labQc}`);
  } else R("5-reopen-released", true, "batch can't be reopened once a sample is released: " + decs.join(","));

  console.log("ERRORS", errors);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
