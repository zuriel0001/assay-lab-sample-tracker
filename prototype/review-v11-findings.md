# MET Lab Sample Tracker v11: second independent review

Reviewed 2026-10-14. The review covered the v11 source in this folder, which is the same page as the published Artifact. Nothing in the source was edited.

## Verdict

v11 is a big step forward. Every bug from the first review stays fixed: all 41 of my original scenarios pass. The build thread's own suites pass too, 100 of 100 and 84 of 84, with no console errors. Results, lab batches, CRMs and certificates are well designed:
- The 50-position fire assay layout is correct.
- The QC wording is generated from the same numbers the system enforces.
- Two technicians can't put the same sample into two batches at once.

The new results and QC layer still has gaps that matter for a real lab. **Four of them are bugs that can put a wrong number on a certificate or leave a batch stuck.** I reproduced each one with `review/review-v11-scenarios.js`. To run it, copy it into `test/` next to `harness.js`, then run `NODE_PATH=$(npm root -g) timeout 500 node review-v11-scenarios.js`.

---

## P1: fix before results are used for real decisions

| # | Finding | Evidence | Fix |
|---|---|---|---|
| 1 | **A comma is read as a decimal point.** A result typed or pasted as `1,500` is saved as **1.5**, with no warning. The batch passes QC, and the value would be released at a thousandth of its real size. A true 1,500 g/t should have been flagged as over range. Instrument and Excel exports often use thousands separators, and so do pregnant eluate results (up to 2,000 mg/L). | Scenario 1. `parseRes` in `app11-g.js` replaces `,` with `.`. | Refuse any value that contains a comma, or follow one site setting that decides whether a comma is a decimal mark or a thousands separator. Show the parsed number next to the input before saving. |
| 2 | **Reopening a batch after any of its samples was released leaves it stuck.** The supervisor can still press "Correct an entry". After that, saving the batch is refused because the released sample "has not reached analysis yet". Every other sample in the batch stays at "waiting for batch results" with no way forward except a re-run. The released sample shows QC "pending" next to a certificate that says QC passed. | Scenario 5 | Once any sample in a batch is released, block "Correct an entry". Corrections then go through amended certificates, or the reopen skips released samples and never resets them to pending. |
| 3 | **An amended certificate skips every check.** Amending Au to 25 g/t on a fire assay (AAS range ends at 10 g/t) issued an R2 with no over-range block. Sample checks and action limits are not re-run either. Clearing a field silently drops that analyte from the new certificate. | Scenario 4. `makeCert` copies analytes without `ul`, so `parseRes` can't flag them. | Run the same checks as a first release: range, sample checks, action limits and required analytes. Keep `ul` and `lim` on the certificate's analyte list. |
| 4 | **Batch QC covers only one analyte, but the certificate says "QC passed" for all of them.** Each sample is judged on one analyte. Everything else it reports goes out with no QC behind it:<br>• **ICP:** only Cu has QC. As, Sb, Zn, Pb, Fe and S have none.<br>• **ENV-W:** only WAD CN has QC. As, Hg and Cu, which are permit metals, have none.<br>• **CIL-SVY:** only solution Au has QC. Carbon loading and solids are unchecked.<br>• **CCD-SVY, TSF-CHAR and PLT-TAIL:** the solids fire assay has no QC.<br>• **CONC:** Hg and As have no QC.<br>CCD-SVY's own rule says "Solids gold runs with a fire assay batch", but a sample can only be in one batch. | `qcAnalyte` and `ROUTE_QC`, plus the analyte table I printed from `RESULTS` | Give multi-element tests one CRM check per reported analyte. For mixed routes (solution plus solids), let a sample join one batch per analytical method. At minimum, the certificate should say which analytes the QC covered. |
| 5 | **Most re-assay triggers and action limits are still only text.** Only TSF and DETOX WAD (50 mg/L) carry an action limit. Nothing flags these, although the routes say they should:<br>• an ENV-W permit exceedance ("notify Environment the same day")<br>• tails over 0.20 g/t<br>• barren solution over 0.02 mg/L<br>• eluted carbon over 100 g/t<br>• end-of-strip eluate over 5 mg/L<br>• ICP or LECO over range, which the ICP route text describes as an ore-grade re-run<br>When an action limit is hit, nothing alerts anyone. | `RESULTS` has `lim` on 2 analytes and `ul` on 6 | Encode the limits from each route's triggers as data, including site permit limits as an admin-editable table. Raise an alert (board tile, plus email or SMS in production) when one is crossed. |
| 6 | **One supervisor can enter, approve and release their own results.** In the test, the same supervisor account saved the batch results, accepted its CRM warning and released the certificate. A normal lab requires a second person to review and release. | Scenario 3 | Don't let the person who entered or last changed a result accept its warnings or release it. Admin can override with a reason. |

## P2: should fix

| # | Finding | Fix |
|---|---|---|
| 7 | Paste import puts a second reading of the same sample ID (its duplicate) over the original. The duplicate position stays empty. CRMs already handle this; samples do not (scenario 2). Paste also only takes the last field on each line, so a typical AAS export of "ID, result, unit" or extra columns is not matched. | Fill duplicates in order, as CRMs are. Let the user map columns, or accept CSV and instrument exports with a header row. |
| 8 | Calculated results are typed by hand: recovery %, NNP = NP − AP, screen fire assay total from its fractions, calculated head, and wash efficiency. Only some have a check (pair or sum), so a typed NNP that is not NP − AP is released. | Calculate these from their inputs and lock the field. |
| 9 | Control charts only colour each point by its own verdict. Real QC also looks for trends: 2 in a row beyond 2 SD, or 9 in a row on one side, which shows bias. If a CRM's certified value is edited later, the chart redraws the lines but keeps the old verdict colours. | Add the standard multi-point rules and flag the CRM on the board. Store the certified value with each batch result. |
| 10 | Blank limits use the same multiple for the preparation blank (barren quartz through the crusher) and the analytical blank. Labs usually allow the prep blank more, because it measures carry-over. | Add a separate `pbBlank` multiple to each batch type. |
| 11 | A Mill sample sent with the plain fire assay test and the plant purpose is routed to EXP-FA (35.5 h, exploration). It should go to the plant shift route. | Make PLT-HEAD also perform `fa_aas` for `plant_feed`. Alternatively, rank by purpose before the test, as other combinations already do. |
| 12 | The certificate is only an HTML download. It shows "lab supervisor (QA/QC)" even when the admin released it. Nothing proves it hasn't been edited. | Use the releaser's real role. In production, issue a PDF with a verification QR or link that opens the certificate on the server. |
| 13 | The submitter can't get results without a staff login, and nothing tells them results are ready. | Results-ready notice to the submitter's section, plus section-level viewer accounts. |

## Lab practice notes

- **Batch sizes and insertion rates are sound:**
  - Fire assay: 43 samples and 7 QC positions = 50.
  - Grade control: 22 samples and 3 QC positions = 25.
  - Bullion in duplicate with proof gold at ±0.5‰.
  - The plant batch has no warning band (fail at 2 SD). Make sure the lab agrees with that, since it will cause frequent re-runs.
- The fixed number of QC positions per batch is conservative for small batches, which is fine. Write down that QC is per batch, not per 20 samples, so auditors can follow it.
- `<DL` counts as 0 in balances. That is common, but say so on the certificate for sums and recoveries.
- Before go-live, the lab must load its real CRM certificates (already known) and the site's permit limits (see item 5).

## What I checked and found working

- Received → batch → results → QA/QC → release with certificate.
- CRM warning and fail, reopen, re-run as a new batch, and admin exception.
- Over-range → gravimetric finish.
- Amendment versions are kept.
- Results hidden from the public by default.
- Batch ID claiming and double-booking protection.
- The first-review fixes: ledger, retention per material, forward-only stages, time checks, tag index.
