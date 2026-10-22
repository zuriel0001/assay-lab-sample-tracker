// Second independent review (v11): scenario tests for results, batches and certificates.
// Run from this folder: NODE_PATH=$(npm root -g) timeout 400 node review-v11-scenarios.js
// "BUG" lines show behaviour the review flags; "OK" lines show it holds.
// Adapted for v12 by the build thread, without changing what each scenario checks:
//  - scenario 1: the batch is no longer saved when "1,500" is refused, so its QC is read with ?. (it is null);
//  - scenario 3: the supervisor who entered the results is no longer offered "Accept the warnings", so the lab manager (admin) accepts and
//    releases; the verdict line is the reviewer's own.
// Adapted for v35 (lab batches removed): each scenario runs on the sample's record. 2: a file naming a sample twice uses the first row and
// says so; 3: the supervisor enters and tries to release alone; 5: once released, a sample takes no new results except by amendment.
const H = require("./harness");
const { store, errors, newUser, launch, signIn, fillForm, ids, open, doc, toastText, waitFor } = H;
const names = {};
const R = (tag, ok, msg) => { console.log(ok ? "  OK  " : "  BUG ", tag, msg); if (!ok) process.exitCode = 1; };
async function receipt(page, id){ await open(page, id); await page.click('[data-receipt="confirm"]'); await waitFor(() => doc(id).stageKey === "received"); await page.waitForTimeout(400); }
async function walkTo(page, id, key){
  await open(page, id);
  for (let g = 0; g < 16 && doc(id).stageKey !== key; g++){ const k = doc(id).stageKey; await page.click('[data-step="next"]'); await waitFor(() => doc(id).stageKey !== k, 4000); await page.waitForTimeout(300); }
  return doc(id).stageKey === key;
}
/* Types a gold result on the record and presses Save (it may be refused). */
async function typeAu(page, id, v){
  await open(page, id); if (!(await page.$eval("#resBox", d => d.open))) await page.click("#resBox summary");
  await page.fill("#rs_Au", v); const v0 = doc(id).results?.v || 0; await page.click("#rsSave"); await waitFor(() => (doc(id).results?.v || 0) > v0, 3000); await page.waitForTimeout(300);
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

  // 1. Thousands separator read as a decimal point
  await fillForm(P, "submit", { section: "EXP", submitter: "Esi", count: 2 }); const a = await ids(P);
  for (const id of a){ await receipt(Tc, id); await walkTo(Tc, id, "weigh"); }
  await typeAu(Tc, a[0], "1,500");
  const r0 = doc(a[0]).results?.rows?.Au;
  R("1-comma", !(r0 && r0.v === 1.5), `record entry "1,500" g/t saved as ${r0 && r0.v} (flag: "${r0 && r0.f}"); 1,500 g/t should be over range, not 1.5 g/t; message: "${await toastText(Tc)}"`);

  // 2. A results file with the same sample ID twice (original then a repeat reading)
  await fillForm(P, "submit", { section: "EXP", submitter: "Esi", count: 3 }); const c = await ids(P);
  for (const id of c){ await receipt(Tc, id); await walkTo(Tc, id, "weigh"); }
  await open(Tc, c[0]); const up = await H.attachFile(Tc, `sample:${c[0]}`, "run.csv", `Sample ID,Au\n${c[0]},1.10\n${c[0]},1.30\n`); await H.saveAttach(Tc);
  const ov = doc(c[0]).results?.rows?.Au?.raw;
  R("2-paste", ov === "1.10" && /On two rows: .*first row used/.test(up), `a results file with ${c[0]} twice: the record holds "${ov}"; the preview says: ${(up.match(/On two rows[^·]*· first row used/) || ["nothing"])[0]}`);

  // 3. Supervisor runs the whole chain alone: enters results, releases
  await fillForm(P, "submit", { section: "EXP", submitter: "Esi", count: 2 }); const d = await ids(P);
  for (const id of d){ await receipt(Sv, id); await walkTo(Sv, id, "weigh"); await typeAu(Sv, id, "0.90"); await walkTo(Sv, id, "qc"); }
  await open(Sv, d[0]); const svCan = !(await Sv.$eval('[data-step="next"]', b => b.disabled));
  for (const id of d){ const pg = svCan ? Sv : Ad; await open(pg, id); await pg.click('[data-step="next"]'); await waitFor(() => (doc(id).certs || []).length, 5000); }
  const cert = doc(d[0]).certs?.[0];
  R("3-four-eyes", !(cert && cert.by === "super" && doc(d[0]).results.rows.Au.by === "super"), `the same supervisor entered the results and released ${cert ? cert.no : "nothing"} (released by ${cert && cert.by})`);

  // 4. Amended certificate skips the range and checks
  await open(Sv, d[0]); await Sv.click("#amBox summary"); await Sv.fill("#am_Au", "25"); await Sv.fill("#amWhy", "typo"); await Sv.click("#amBtn");
  await waitFor(() => (doc(d[0]).certs || []).length === 2, 5000);
  const c2 = doc(d[0]).certs?.[1];
  R("4-amend-range", !(c2 && c2.rows.Au && c2.rows.Au.v === 25), `amended certificate ${c2 ? c2.no : "-"} issued with Au ${c2 && c2.rows.Au.raw} g/t (fire assay AAS range ends at 10 g/t; flag "${c2 && c2.rows.Au.f}")`);

  // 5. New results on a sample already released
  await fillForm(P, "submit", { section: "EXP", submitter: "Esi", count: 2 }); const e = await ids(P);
  for (const id of e){ await receipt(Tc, id); await walkTo(Tc, id, "weigh"); await typeAu(Tc, id, "0.70"); await walkTo(Tc, id, "qc"); }
  await open(Sv, e[0]); await Sv.click('[data-step="next"]'); await waitFor(() => (doc(e[0]).certs || []).length === 1, 5000); await Sv.waitForTimeout(400);
  await open(Tc, e[0]);
  const canType = !!(await Tc.$("#rsSave")), canAttach = !!(await Tc.$(`[data-attach="sample:${e[0]}"]`));
  R("5-reopen-released", !canType && !canAttach, `after ${doc(e[0]).certs[0].no} was issued, the record ${canType || canAttach ? "still takes" : "no longer takes"} new results (typing ${canType}, file ${canAttach}); corrections go through an amendment`);

  console.log("ERRORS", errors);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
