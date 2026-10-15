# MET Lab Sample Tracker: independent review

Reviewed 2026-10-13 against the published v9 prototype (https://claude.ai/artifact/5JgoyE2wokT67u8TCtYDop), `routes-data.js` and `workflow-routes.md`. This was a read-and-run review. The Artifact was not edited.

## Verdict

The design is sound and well thought through. The route library is consistent, phone layout works, and the ID scheme holds up when two people submit at once. **It is not ready for live use at the site yet.** I found 9 bugs that let the custody record or the ledger show something that did not happen. Those need fixing before any trial, and the platform gaps listed in section 4 come before production.

How it was checked:
- Read all 2,223 lines of the page.
- Ran the route data through a consistency check.
- Rebuilt `workflow-routes.md` from the source. It matched exactly.
- Drove the page in Chromium with several users on a shared mock database: public, tech, admin, a 375 px phone, and two people submitting at the same time.
- Every bug marked "reproduced" below was shown by `review/review-tests.js` (in this folder). Run it the same way as `test/run.js`.

---

## 1. Bugs, in priority order

### P1: data integrity (fix before any trial)

| # | Bug | Reproduced | What goes wrong at the site | Fix |
|---|---|---|---|---|
| 1 | **A chosen stage is silently lost when anyone else saves anything.** A tech picks a stage in "Or move to a specific stage" and types a note. If another user submits or updates any sample before the tech presses Record, the page re-renders and the dropdown resets to the current stage. Record then saves the note against the *current* stage and the sample does not move. | Yes. Picked "Pulverising", got a note at "Received" and the stage did not change. | Wrong stage and a misleading custody entry. At a busy lab this will happen many times a day. | Keep `mvKey` (and every field in the form) across re-renders. Better still, don't re-render the record while the form has unsaved input. |
| 2 | **The ledger counts every history entry at a ledger stage as a new movement.** A note added at "Received", a correction back to "Received", or any note at Returned/Disposed adds another IN or OUT line. No reversal is written. | Yes. One sample showed 3 IN and 2 OUT. | The 19.2 ledger is wrong, so in and out counts no longer balance. | Write ledger movements as their own records, only on a real transition. A correction should write a visible reversal and never a second movement. |
| 3 | **Rejected samples never appear in the ledger.** Rejecting at receipt writes nothing. Moving a received sample to "Rejected" (allowed from the dropdown) leaves an IN line with no OUT. | Yes, both cases. | Material that physically reached the lab has no record, which breaks 19.4. | Rejection after a physical check should write IN, then OUT as returned or disposed. Only allow "Rejected" at receipt. |
| 4 | **Any stage can be jumped to, including "Results released" straight from "Received".** The skipped steps then show as green ticks marked "Skipped". | Yes | Results can be released with no QA/QC step recorded. | Enforce the route order. Allow skipping only with a reason, and only by a supervisor or admin. Show skipped steps as grey, not ticked. |
| 5 | **Receipt time can be earlier than submission.** A receipt dated 2 days before the submission was accepted. Collection time can also be in the future or after submission. | Yes | Impossible timelines in the custody record, and a misleading turnaround. | Validate collected ≤ submitted ≤ received ≤ now. |
| 6 | **A backdated receipt time is reset to "now" when anyone else saves.** | Yes | The wrong receipt time is recorded without the tech noticing. | Same fix as #1: preserve `rcAt`. |
| 7 | **Picking a route that does not perform the requested test silently changes the test.** This happens at Register at lab, at receipt and at re-route. | Yes. Requested screen fire assay, chose route ICP, and the stored test became ICP with no warning. | The submitter's request is overwritten, and the custody note only says "route changed". | Only list routes that perform the requested test, or ask the tech to confirm the test change and log it. |
| 8 | **Board, ledger, CSV, retention flags and tag lookup only see the newest 1,000 samples.** | From the code (`limit(1000)`) | At grade-control volumes that is a few days. A monthly ledger or CSV will be **silently incomplete**, and samples kept 90 to 365 days drop out of the "due for disposal" count. | Query by date range or state on a server. Never build the ledger from a recent-items window. |
| 9 | **Retention is tracked per sample, not per material.** Routes keep pulp 365 days and coarse reject 90 days, but the sample has one storage clock (the longest). That clock starts when someone moves the sample to Storage, not when results are released. A sample left at "Results released" is never flagged. | From the code | Coarse rejects are never prompted for disposal. Returning the pulp and disposing of the reject can't both be recorded. Dates on the record and on the board disagree. This breaks 19.3. | Track each retained material (pulp, reject, solution, carbon, and so on) as its own line with its own due date and disposal entry. Start the clock at release. Flag samples left at "Results released". |

### P2: should fix

| # | Bug | Reproduced | Fix |
|---|---|---|---|
| 10 | On Settings, any sample change anywhere re-renders the page and takes the admin's cursor out of the field they are typing in. The ledger search box does the same. | Yes | Don't re-render while the user is editing. |
| 11 | A batch of 3 with tag "T-10421" stores T-10421-1, -2, -3. The placeholder suggests T-10421, T-10422… There is no check for duplicate tag numbers. Several tags on a single sample are stored as one string, so lookup by one tag fails. | Yes | Increment the trailing number, check that tags are unique, and store tags as a list. |
| 12 | Lookup turns tags that look like old IDs into an ID (T-10421 becomes T-1042-00001). It only matches a tag if the sample is among the loaded 1,000, so tracking by tag from a link fails. | Yes | Search tags on the server. Only normalise text that matches a real ID format. |
| 13 | The ID counter lock is never released. A second person submitting to the same section waits about 8 s (9.2 s measured). IDs are reserved before the samples are saved, so a failed save leaves gaps. Batches of 100 save one by one. | Yes | Release the lock straight away and use one server transaction per batch. Gaps are acceptable if they are logged. |
| 14 | Dates in IDs and in the ledger month filter come from each device's clock and timezone. | From the code | Stamp IDs and times on the server in site time. |
| 15 | Bullion and concentrate routes require two people, but only one technician is recorded. | From the code | Add a witness field that is required for GR/CONC/BULLION steps. |
| 16 | Re-assaying after results were released has no "amended result" record. Renaming a route code in Settings leaves open samples without their QC rules. | From the code | Keep a result version history. Lock route codes once they are in use. |
| 17 | Storage location is only saved when the reference contains words such as shelf, bin or rack. "B3" alone is ignored. | From the code | Add a separate location field. |
| 18 | Phone (375 px): no sideways overflow on any tab, and the record is readable. The tab strip scrolls sideways with no visual cue, though, and Sample record / Workflow board can sit off-screen. | Yes, screenshots | Add a fade or arrow cue, or a menu, on narrow screens. |
| 19 | Security is in the page only. Setting one browser-storage value with no password gives full admin. Demo passwords are readable. | Yes | Known prototype scope. Recorded so the production spec covers it: server-side auth and permissions. |

---

## 2. Alignment checks

**What agrees:**
- The page, `routes-data.js` and `workflow-routes.md` are identical.
- All 41 tests have a route.
- Every stage key is unique and none uses a reserved name.
- Each route has exactly one re-assay restart point and ends with a QA/QC step.
- The ID format SECTION-YYYYMMDD-0001 uses the submission date, the per-section daily counter works, and simultaneous submissions get unique IDs.
- ETA = receipt time + 1 h + the route's step hours. That matches the route table and the submit preview.
- Roles: public = submit, lookup and routes. Viewer = read-only. Tech = receipt and stages. Admin = Settings. This matches the stated rules in the UI.

**What disagrees:**
- **EXP-FA QC frequency.** The insertion step says CRM, blank and replicate "1 in 20". The QA/QC rule says "per batch of 50: 2 CRMs, 1 blank, 2 replicates", which is 1 in 25 for CRMs and 1 in 50 for blanks. Pick one.
- **PLT-HEAD (Mill sample)** promises "results before the next shift change", but the route totals 16.5 h after receipt, plus 6 h allowed for transit. A 12 h shift can't be met.
- **Ledger quantity** is what the submitter typed. Nothing records the mass or bag count actually received.
- **The ETA ignores lab hours, batching and queues.** It will be optimistic whenever the lab is busy, and it moves later every time a stage overruns. Label it as an estimate, or base it on actual throughput.
- **Retention text vs behaviour:** see bug 9.

---

## 3. Lab practice (gold mine assay and met lab)

**What is right:**
- 50 g lead-collection fire assay with AAS finish, gravimetric finish over 10 g/t, and screen fire assay for coarse gold.
- Preparation to 85% passing 75 µm and drying at 80 °C or below for leach testwork.
- Bottle roll at 40% solids, NaCN 500 ppm and pH 10.5.
- Bullion by cupellation with proof gold (ISO 11426), with a top/bottom homogeneity check.
- 50 mg/L WAD cyanide trigger for the TSF.
- Cyanide samples preserved with NaOH (14-day holding time), metals filtered then acidified, and coolers at 6 °C or below.
- CRM ±2/±3 SD rules.

The route library is a credible base for a site met lab.

**What needs changing:**
1. **No results are captured.** "Results released" is only a stage name. A real lab needs:
   - result values with units and detection limits
   - an over-range flag
   - a released, versioned certificate the submitter can see by ID
   - ideally import from the AAS, ICP or LECO instrument files

   This is the biggest gap.
2. **QC is written down but not enforced.** Fire assay QC is per lab batch (furnace load or worksheet), but the system has no lab batch. It needs a batch or worksheet with:
   - the CRM IDs and expected values
   - the blank and duplicate positions
   - an automatic pass or fail against the route's rule, which blocks release on a fail
   - QC control charts
3. **Add the standard insertions:**
   - a coarse (preparation) blank of barren quartz before crushing
   - a crusher (coarse) duplicate
   - a pulp duplicate
   - space for the geologists' own blind field duplicates and CRMs, kept separate from lab QC
4. **Plant turnaround.** Mill, CCD and Elution samples drive shift decisions. Give PLT-HEAD a fast-track option (forced-air or microwave drying, 30 g charge) that can meet the next shift change, and lower the 6 h transit allowance for plant samples.
5. **PLT-HEAD trigger wording.** "10% off the mine call factor" is not a per-shift check, because the mine call factor is a reconciliation ratio. Compare against the rolling plant average or the expected feed grade instead.
6. **Environmental holding times and cooler temperature** are typed in, but nothing checks them. At receipt the system should calculate holding time from the collection time (for example 14 days for cyanide) and the cooler limit, and warn the tech.
7. **Chain of custody at receipt** should record:
   - the seal number checked (matches or does not)
   - the mass received
   - the condition
   - two-person sign-off for bullion and concentrate
8. **Hazard flags** (cyanide, mercury, arsenic, radioactivity) should show on the board card and the bag label, not only in the notes.

---

## 4. Missing before real site use

1. A real server, database and nightly backups, hosted where the mine's IT can support it.
2. Company sign-in (SSO or AD), role checks on the server, and an audit log that can't be edited.
3. Barcode or QR labels printed at submission or receipt, and scanning at each stage. Typing IDs causes errors.
4. Results entry or instrument import, certificates, and amendment history (section 3, item 1).
5. Lab batches or worksheets with QC pass/fail and control charts (section 3, item 2).
6. Retention per material, a disposal register, and periodic disposal lists (bug 9).
7. Notifications by email, SMS or WhatsApp: received, flagged, results ready, and overdue.
8. Offline or poor-network tolerance for the pit and plant, with a queue that syncs later.
9. Turnaround dashboards by section and route, plus month-end ledger reconciliation (count in = count out + count on hand).
10. Timezone and clock from the server, and archiving beyond the active window.
11. User acceptance testing with lab techs on real bags, written SOPs that match the routes, and training. Then a parallel run alongside the paper system before cut-over.

---

## Suggested order of work

1. Fix bugs 1 to 7 in the prototype. They are all page logic.
2. Redesign the ledger and retention (bugs 2, 3 and 9) as separate movement and material records. The production database should use the same model.
3. Write the production spec covering bugs 8 and 13 to 19 and sections 3 and 4.
4. Run a pilot at one section, then go site-wide.
