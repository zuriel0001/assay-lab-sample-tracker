# Assay Lab Sample Tracker: source and tests

> **In the GitHub repository** this folder is `prototype/`. Left out: the old version folders (`v9/`, `v10/` and so on; git history keeps versions from now on), and `test/v18-tests.js` and `test/shot18.js`, which read the lab's two real reports and quote their sample codes and values. Those two run only in the project folder, with the private reports present.

This folder holds the **v19** source of the published prototype (Version 21 of the artifact)
(https://claude.ai/artifact/5JgoyE2wokT67u8TCtYDop). The build thread owns all edits;
reviewers should read and run, not change these files. Earlier versions: `v18/` (Version 20, before Zuriel's answers on QC,
grind and the site sample code, and the `patch()` fix; to rebuild it, copy `src/v9-backup.html` next to `v18/src/build18.py`), `v17/` (Version 19, before results files, batch
steps, re-assay from the lists and the shorter form; to rebuild it, copy `src/v9-backup.html` next to `v17/src/build17.py`), `v16/` (Version 18, before the single entry tab and
the hand-over fields; to rebuild it, copy `src/v9-backup.html` next to `v16/src/build16.py`), `v15/` (Version 17, the design refresh, before
walk-in registration and the earlier board look; to rebuild it, copy `src/v9-backup.html` next to `v15/src/build15.py`), `v14/` (Version 16, before the design refresh; to
rebuild it, copy `src/v9-backup.html` next to `v14/src/build14.py`), `v13/` (Version 15 of the artifact, before the
Settings tabs, working hours and labels; to rebuild it, copy `src/v9-backup.html` next to `v13/src/build13.py`), `v12/` (second review fixes; to rebuild it, copy
`src/v9-backup.html` next to `v12/src/build12.py`), `v11/` (results, certificates
and lab batches, the version the second review was done against; to rebuild it, copy `src/v9-backup.html` next to
`v11/src/build11.py`), `v10/` (first review fixes) and `v9/`.

| File | What it is |
|---|---|
| `assay-lab-sample-tracker.html` | The whole page (HTML, CSS, JS in one file), exactly as published (called `met-lab-sample-tracker.html` before the rename). Uses the Artifact runtime `window.claude` db, user and downloads capabilities. |
| `routes-data.js` | Tests, sample types, the 42 workflow routes, `RESULTS` (what each test reports, including picked and calculated results), `QC_PROFILES` (lab batch rules), `ROUTE_QC` and `ROUTE_GROUPS` (the batches each route's samples join, one per analytical method), `qcRuleText` / `routeQcText` (write each route's QA/QC text from the same numbers the batches enforce). |
| `src/` | The page is built from these: `app10-a.js` … `app10-f.js`, `app12-g.js` (results, limits, four eyes, amendments, certificates, lab batches, section results), `app13-h.js` (stock records, Storage tab, the selected batch's samples), `app14-i.js` (lab working hours, Settings tabs, QR codes and bag labels), `app15-j.js` (navigation, theme, logo, wall screen, time left), `app16-k.js` (reference material change history and renames, board lanes that scroll), `app18-l.js` (reads a results file in the page: old Excel .xls, .xlsx, CSV and text; SHA-256; base64), `app18-m.js` (recognises a lab report, matches it to samples, batches and QC, the preview, saving and the kept file), `css10.css`, `css11.css`, `css12.css`, `css14.css`, `css15.css` (design refresh; its icon block is written by `tools/icons.py`), `css16.css`, `css18.css`, `v9-backup.html` (markup and base CSS). `cd src && python3 build18.py` writes the page into `src/`; it is byte for byte the published one. |
| `tools/icons.py` | Prints the icon definitions at the top of `css15.css` (24 px stroke icons drawn as CSS masks). |
| `checkroutes.js` | Validates the route data and prints turnaround per route. |
| `genmd.js` | Regenerates `workflow-routes.md`: what each route reports (picked and calculated results marked), the batches it joins and its action limits. Run it from `src/`'s parent with `src/app10-a.js` present. |
| `test/harness.js` | Shared mock of the db capability: several browser pages on one store, with `where` filters (including `array-contains`), `orderBy`, `limit`, recursive `update` merge, update-requires-existence, leases, frozen snapshots and deletes. Batch helpers (`createBatch`, `fillBatch` for one or many results per position, `saveBatch`). |
| `test/v18-tests.js` | New: results files with the lab's two real SGS reports (old Excel): reading, matching by site sample code, moving samples on, new batches from the report with their repeats and the foot-table CRMs, QC, the kept file and its download, attaching twice, the uploader as result entrant, a draft completed by typing, Settings › Results files; batch steps and Next step; re-assay from Storage and the Ledger; the shorter form. The two reports hold real assay data, so they are not in this folder (it goes to GitHub): they are in `/mnt/project-files/sample-tracking-private/lab-reports/` (or set `LAB_REPORTS`); without them the parts that need them print SKIP. Since v19 also: Site sample code and the submitter's badge, No QC in this run (the elution report, a CSV with no QC rows, release and certificate), the screen line, values typed over file values. Last run: **71 PASS**, no console errors. |
| `test/v17-tests.js` | One entry tab per sign-in state, Received now at the lab for staff, the hand-over name and badge (required on walk-ins, the Azure server rule run against them, record, custody log, receipt, board, both names after receipt). Last run: **25 PASS**, no console errors. |
| `test/v16-tests.js` | Walk-in registration for everyone (and the Azure server's public-submission rule run against it), Submit after sign-in, the Other reason, the receiver on the workflow line, 80% grind (also for routes saved with 85%), reference materials renamed and edited with a change history and the control chart following a renamed material, the board tiles and scrolling lanes, ZIJIN. Last run: **43 PASS** (one check moved to v17), no console errors. |
| `test/v15-tests.js` | The design refresh (navigation and More menu at computer, tablet and phone widths, header, theme, board summary and filters (tiles and grid lanes since v16), time left, wall screen, record progress, Today strip, company logo, touch sizes, sticky bars, zebra tables, print). Last run: **46 PASS**, no console errors. |
| `test/run-all.sh` | Runs every browser suite one at a time and prints one line per suite. |
| `test/run.js` | End-to-end tests of the workflow. Last run: **107 PASS**, no console errors. |
| `test/v14-tests.js` | New: Settings tabs, lab working hours (due times, overdue, round-the-clock steps), the trimmed defaults, bag labels (QR decoded with jsQR), tracking-link scans. Needs `jsqr` (`npm i jsqr@1.4.0`; set `NODE_PATH` to include it). Last run: **27 PASS**, no console errors. |
| `test/work-hours-unit.js` | New: the working-time arithmetic, run in Node on the built page's own code (weekends, closed days, night shifts, overlapping shifts, site time zone, a 1,763-hour route). Last run: **14 PASS**. |
| `test/results-tests.js` | Results, certificates and lab batches (the paste check is a results file since v18; an approved amendment of a file value drops its file mark; a batch saved again after Correct an entry keeps the mark only on values left as the file gave them). Last run: **93 PASS**, no console errors. |
| `test/v12-tests.js` | New: every v12 change (numbers, batches per method, multi-element QC, limits, four eyes, amendments, paste, trends, prep blanks, plant routing, check codes, section accounts, upgrade of v11 records and settings; since v18 an amended file value is saved as typed). Last run: **71 PASS**, no console errors. |
| `test/v13-tests.js` | New: stock records through a sample's life, a lab batch whose released sample is already in storage, repair of an unwritten stock record, Settings counts, the month check, and a register with 3,000 stored samples (board load, Storage paging and search, phone width). Last run: **26 PASS**, no console errors. |
| `test/review-tests-v11.js` | The first reviewer's scenarios A–R plus bugs 8, 9, 14–17; scenario 8 adapted for v13 (see below). Last run: **41 OK, 0 BUG**. |
| `test/review-v11-scenarios.js` | The second reviewer's five scenarios (`review/review-v11-scenarios.js`), adapted only where v12 now refuses the step (see its header). Last run: **5 OK, 0 BUG**. |
| `test/hours-shortcut-tests.js` | The admin-only "Edit steps and hours" button on the Workflow routes tab (see below). Last run: **7 PASS**, no console errors. |
| `test/live-dryrun13.js` | Dry run of the v13 upgrade on a copy of the live register (`live6/` is not kept here: fetch samples, meta and ledger read-only first). |
| `workflow-routes.md` | Generated route table. |

## Running

```sh
node checkroutes.js
sed -n '/<script>/,/<\/script>/p' assay-lab-sample-tracker.html | sed '1d;$d' > /tmp/check.js && node --check /tmp/check.js
cd test
NODE_PATH=$(npm root -g) timeout 590 node run.js > out.txt 2>&1; grep -E "FAIL|Console errors" out.txt; grep -c PASS out.txt
NODE_PATH=$(npm root -g) timeout 590 node results-tests.js
NODE_PATH=$(npm root -g) timeout 590 node v12-tests.js
NODE_PATH=$(npm root -g) timeout 590 node v13-tests.js
NODE_PATH=$(npm root -g) timeout 590 node review-tests-v11.js
NODE_PATH=$(npm root -g) timeout 400 node review-v11-scenarios.js
NODE_PATH=$(npm root -g) timeout 300 node hours-shortcut-tests.js
NODE_PATH=$(npm root -g) timeout 400 node v15-tests.js
NODE_PATH=$(npm root -g) timeout 400 node v16-tests.js
NODE_PATH=$(npm root -g) timeout 400 node v17-tests.js
NODE_PATH=$(npm root -g) timeout 590 node v18-tests.js
node work-hours-unit.js
NODE_PATH=$(npm root -g):/path/to/jsqr/node_modules timeout 400 node v14-tests.js
```

The tests write screenshots next to themselves. The Chromium path is in `harness.js`. Run the suites one
at a time: scenario R in `review-tests-v11.js` times ID claims, and the batch tests wait on several writes per
step, so they can miss their time budgets when several browsers share the CPU.

## What v19 changes: Zuriel's answers on QC, grind and sample codes, and a fix (2026-10-15)

Zuriel, 19:33Z, on the five questions from v18: will enter the real CRM SDs; solution runs with no QC rows are allowed; grind
is not measured on the site; QA/QC is a sample set of its own, so a results file need not do the QC; the codes on the reports
are the site's sample codes, and the "tag number" is the submitter's badge number.

- **No QC in this run.** Results from a file are judged only on the QC readings the file holds: a QC position it has no
  reading for is "not in the file" (not judged), and the batch need not hold a certified reference material. A file with no
  QC readings at all gives the new QC status `none`, shown as **No QC in this run** on the batch, the samples, the board and
  the certificate. It does not hold release (still four eyes). A file that fills every sample but no QC position is complete
  and saved at once; a draft counts only missing sample values; completing a file draft by typing leaves QC boxes optional.
  Typed batches (no file) are unchanged: every QC position needs a value.
- **Grind as reported.** The screen fractions (+40 … −325 mesh, % retained) are kept as one line, as the report states them
  (`+40 … · +70 … · … · -325 …`), in a new optional text result **Screen analysis, % retained** on plant samples.
  The site no longer works out % passing 75 µm; "Grind, passing 75 µm" is optional (read when a report states it).
- **Site sample code and badge.** "Tag number" is now **Site sample code** everywhere (form, record, certificate, ledger,
  storage, labels, lookup, CSV exports, upload messages). It is still stored in `tags` (one per sample, unique among open
  samples, indexed in `tagidx/`, looked up without sign-in, matched in results files), so **existing tag values carry over
  as site sample codes**: that is what people typed there (Zuriel: "yes"). New field **Submitter's badge number**
  (`subBadge`, optional, up to 20 characters, one per submission) next to "Submitted by"; the record and certificate show
  it. Old records have none.
- **CRM SDs.** Already editable inline under Settings › Reference materials; an upload naming reference materials that are
  not in the register now has a button there for the lab manager.
- **Fix (found by the Azure build).** `patch()`, which every results write goes through, nulled the results that went but
  wrote each remaining row as an update, and an update merges maps. So a value typed over one read from a file (an approved
  amendment, Correct results, a lab batch typed over an earlier row) kept `src: "file"`, and on Azure the server refused to
  approve an amendment of a file value. `patch()` now replaces each row whole (old fields not in the new row are written as
  null, map by map). A batch saved again after **Correct an entry** keeps the file mark on values left as the file gave them
  and names the batch's last attached file in its log and QC.

For the Azure build:
- `build.py` (`../sample-tracking-handoffs/v19-azure/build.py.diff`, patched copy beside it): delete section 13 (its `patch()`
  replacement; the prototype's `patch()` now does the same, recursively), and two help-text strips now name the site sample
  code instead of the tag number. With that, `build.py` builds this page with every patch found and the script passes
  `node --check`.
- Server: no new collection or rule. New values the server stores as they come: sample `subBadge` (also on public and
  walk-in submissions; `checkSubmission` has no field list, so nothing to add), QC status `none` (in `batches.qc.status`,
  the sample's `labs.*.q` / `labQc` and `certs[].qc`; `batchRule` and `sampleRule` do not look at it), QC checks with
  verdict `info` and message "not in the file", and the text result `scr` (up to a few hundred characters) on plant samples.
- Source: same chunks and `build18.py`; changed `app10-b/c/d/e.js`, `app12-g.js`, `app13-h.js`, `app14-i.js`, `app18-m.js`,
  `routes-data.js` (plant_solids), `workflow-routes.md`.

Tests: `v18-tests.js` (now 71): the form's Site sample code and badge, the record; the elution report saved as No QC in this
run with release next; a CSV with no QC rows saved at once, released by a supervisor, the certificate printing No QC in this
run; the screen line on the mill samples; Correct results and a lab batch typed over file values. `results-tests.js` (93) and
`v12-tests.js` (71): amendments of file values and the corrected batch. `harness.js`: `fillForm()` takes `subBadge`.

## What v18 changes: results by file, batches as steps, re-assay from the lists, a shorter form (2026-10-15)

Zuriel, 17:10Z after a site assessment: re-assay should be callable from the Ledger and Storage; the Register / Submit page
looks clumsy; the lab technician does not type results but attaches the lab's CSV or Excel file; Batches are not clear.
17:15Z: two real SGS reports (a daily mill assay report and an elution strip batch), both old Excel (.xls).

- **Attach results file.** On Lab batches (a whole report), on a batch (its Results step) and on a sample record. The page
  reads the file itself, with no library (`app18-l.js`): Excel 97-2003 `.xls` (the compound file SGS LIMS exports, BIFF8
  records), `.xlsx` and CSV / tab / semicolon text, up to 1 MB. Number formats are kept as the lab printed them (`0.900`),
  dates come out as YYYY-MM-DD.
- **Recognising a report** (`parseReport` in `app18-m.js`), with no setup for these layouts:
  - the sample column is the one whose cells match tracker IDs, tag numbers or site references (spaces and case ignored, so
    a report's `ABC 20261014` finds tag `ABC20261014`); unknown codes are listed as not used;
  - the heading row is the row above the first known sample that names the most results; method codes, Rep numbers and
    units sit in the rows above it (merged groups are carried across: AAS84T covers Cu, Fe, Ni and Zn);
  - each column goes to one result: an exact name first, else the measurement (element symbol, symbol plus method code as in
    AuFA, AuSX, AgSX; NaCN is free cyanide, CNWAD is WAD cyanide, %SOLIDS is solids, pH…) with a unit that fits (ppm = g/t;
    mg/L is not g/L; % is not g/L, so the eluate report's NaCN in mg/L and NaOH in % are not read into the g/L results);
  - Rep 2 columns and repeat rows (or ID-DUP) are duplicates, BLANK rows are blanks, rows named after a register CRM are CRM
    readings, and a foot table of "Expected Value / Reported Value" with "… for METHOD" gives CRM readings for the batch whose
    samples were read by that method (the fire assay method's CRMs go to the plant batch, the carbon method's
    CRMs to the carbon batch);
  - screen fractions (+40 … +200 … −325, % retained) give **% passing 75 µm = 100 less everything retained on 200 mesh and
    coarser**, read only when the fractions add up to 100;
  - a column name the site does not know is set once under **Settings › Results files** (admin): name in the report, read as.
- **Preview, then save.** Saves (each batch filled or made, sample records), Check (not at analysis yet, with **Move them to
  analysis**, which records each step "Moved on with results file NAME"; waiting for receipt; released; already saved; not a
  result; two columns for one result; batch results when attached from a record), Not used (rows with no sample here,
  columns not read, CRMs not in the register), Values read, and **Attached before** when the same file (SHA-256) was kept
  already. Nothing is written until Save results.
- **What Save does.** The original file is kept once, in `files/RF-<first 16 of its SHA-256>` with its pieces in
  `files/RF-…~1…n` (180,000 base64 characters each), downloadable from the batch and the record. An open batch is filled;
  samples in no batch of that kind get a **new batch made from the report** (`fromFile`), its repeats and CRM readings being
  the QC positions. A complete set is saved and its QC checked at once, by the same code as typed results
  (`storeBatchResults`); an incomplete one is kept on the batch as a **draft** ("Results file attached: values to
  complete"), and the batch opens Complete and save with the file's values filled in. Results no batch checks go to the
  sample record. Every value from a file is `src: "file"` and entered under the uploader's name, so **the uploader is the
  result entrant** for four eyes; `results.file` and `qc.file` name the file, and the batch log says "Results from file NAME;
  N values typed".
- **Typing stays for corrections**: on a batch under "Type results instead" (or "Complete and save"), on a record under
  "Type results instead" / "Correct results". The paste box is gone.
- **Batches as five steps**: Samples and QC · Preparation and analysis (Move all) · Results (Attach results file, the file,
  the draft) · QC check (verdict and decisions) · Release (move to QA/QC review, release). Each says who does it and the
  current one is marked Next; both batch lists have a **Next step** column. The page's two help paragraphs went.
- **Re-assay from the Ledger and Storage**: a Re-assay button on each sample (lab staff) opens the record with the re-assay
  box open. A stored sample can be re-assayed while material is kept (`redoOk`); its history says "Taken from storage
  (item: location)".
- **Register / Submit, shorter.** On top: type, purpose (and reason), test, route (staff), submitted by, section, handed to
  and badge (walk-ins), tag number, number of samples, receipt (staff). Under **More details**: the type's details, site
  reference, source location, collection time, priority, containers, mass, seal, hazards (still ticked from the type),
  add-ons and notes. The route is one line (code, name, results about…) that opens to its steps; the sentence under the test
  list went. A refused field inside More details opens it.

For the Azure build:
- `build18.py` replaces `build17.py` (adds `css18.css`, `app18-l.js`, `app18-m.js`; changed: `app10-b/c/d/e/f.js`,
  `app12-g.js`, `app13-h.js`, `app14-i.js`).
- `build.py`: v18 removed five pieces of text that `build.py` removed, so those five patches now find nothing; delete them
  (`../sample-tracking-handoffs/v18-azure/build.py.diff`, patched copy beside it). With that, `build.py` builds v18 with no
  failed patch and the output passes `node --check`.
- Server (`api/lib/core.js`):
  - **New collection `files`**: add it to `COLLS`. Ids `RF-` + 16 hex characters (the file's record) and `RF-…~N` (its
    pieces). Read: staff only (it holds results). Write: writers, `set` of a new document only: no update, overwrite or
    delete (add it to the never-deleted list). The record names the person signed in (`by`, `tech`) and holds `id, name,
    kind, size, sha, labRef, parts, at`; a piece holds `id, of, n, data`, with `data` at most 180,000 characters. Staff may
    query `where("sha", "==", …)` (limit 5).
  - settings: new `cols: [{ n, c }]` (column name up to 40 characters, and the result it is read as).
  - batches: new `draft` ({ at, by, tech, file, vals, crms }, cleared to null on save), `files` ([{ id, name, at, tech }]),
    `fromFile` ({ id, name }) and `qc.file` ({ id, name }); status `results` was already used. `batchRule` needs no change
    (QC is still saved under the signed-in name); optionally also require `draft.by` / `draft.tech` to be the person signed in
    when the draft changes.
  - samples: `results.file` ({ id, name }) and `src: "file"` on result rows. `sampleRule` needs no change: rows are entered
    under the uploader's name and every new history line names them.
  - A batch made from a report is deleted again if no sample could join it, as the existing Create batch does.
- Shim: the kept file is downloaded with `downloads.save({ filename, data: Uint8Array })`, which the shim already accepts.
  SHA-256 uses `crypto.subtle` (https); without it a file is still kept, under a date and random id.

Test changes: `harness.js` opens More details in `fillForm()` and "Type results instead" in the batch helpers, and has
`attachFile()` / `saveAttach()` (the file picker, as a technician uses it). The paste checks in `results-tests.js`,
`v12-tests.js` and `review-v11-scenarios.js` attach the same lines as a CSV file instead; `results-tests.js` opens the
record's typing box. New `v18-tests.js`.

## What v17 changes: one entry tab, and who the sample was handed to (2026-10-15)

Zuriel, 13:20Z: signed in, Submit and Register duplicated each other; and the person bringing a sample should type the name
and badge number of the technician they handed it to, while that technician still receives it in the system.

- **One entry tab.** Signed out: **Register** (a walk-in, as in v16). Signed in (every role): **Submit** only; Register is
  gone from `ROLE_TABS`. A button or link that asks for the other one opens the right one (`entryTab()` in the `data-goto`
  handler). Admin tabs: Board, Sample, Submit, Batches, Storage, Ledger, Routes, Settings; the phone bar is Board, Sample,
  Submit, Batches.
- **Lab staff lose nothing.** Their Submit form has **Received now at the lab, by me**, ticked by default: it is the old
  Register at lab (route choice, received by them, time received, witness, inbound ledger at once). Cleared, it is a
  submission received later (the shape of a public submission) with the optional hand-over fields. Viewers and section
  accounts get the submission form with their name filled in.
- **Handed to (lab technician)** and **Technician's badge number**: required on the walk-in Register form, optional on
  Submit, not asked when staff receive on the spot. The name box suggests the lab staff names the page knows (none for
  signed-out visitors on the Azure site, which hides the staff list from them). Saved as `handedTo` and `handedBadge` on the
  sample and as `hand` and `badge` on its first custody entry. Shown on the record ("Handed to: NAME · badge NO."), in the
  chain of custody ("Handed to NAME, badge NO."), on the receipt panel and on the awaiting card on the board. Confirm receipt
  still records the technician who confirms it as "Received by", so when that is someone else both names stay on the record.

For the Azure build:
- `build17.py` replaces `build16.py` (same chunks; `app10-a/c/d.js` and `css16.css` changed).
- `build.py` as it now stands (with the v16 diff applied) builds this page with **no failed patch**, and the output passes
  `node --check`. No new text to drop: the new form fields are labels only.
- **Server rules: no change needed.** `checkSubmission` in `api/lib/core.js` refuses only receipt, result and batch fields,
  so `handedTo`, `handedBadge` and the custody entry's `hand` and `badge` pass; `v17-tests.js` runs that function against a
  walk-in with them and it passes. If the server ever moves to a list of allowed fields, add these four (strings; name up to
  60 characters, badge up to 20).
- `window.__resession` clears `#view-register` when the sign-in changes; the Submit form redraws itself when the account or
  its lab rights change (`dataset.who`), so nothing else is needed there.

Test changes: `harness.js` `tab()` and `fillForm()` map "register" to Submit with the box ticked for signed-in pages (and
"submit" with it cleared), and fill a hand-over on walk-ins. Tab lists in `run.js`, `v12-tests.js` and `v15-tests.js` no
longer have Register for signed-in roles; `v13-tests.js` and `run.js` open Register through `tab()`. New `v17-tests.js`.

## What v16 changes: walk-in registration, 80% grind, CRM edits, earlier board look (2026-10-15)

Zuriel's requests of 2026-10-15 12:10Z, with the defaults the coordinator relayed.

- **Register at lab is open to everyone.** People walk in with samples, so the Register tab works without a sign-in and is
  the first tab and the start page for anyone signed out (tabs: Register, Sample, Routes, Sign in). Viewers and section
  accounts have it too. Someone who is not lab staff registers a walk-in the same way as a public submission: the sample
  waits as **Awaiting receipt** until a lab technician confirms receipt, so the receiver's name is still recorded. The form
  has no route choice and no receipt fields; a pill says it waits for receipt. Lab staff still register straight in, as the
  receiver, with the route choice and time received. The record says "Registered … at the lab, waiting for receipt by a
  technician" until then, and "at the lab (walk-in)" after; the first history line is "Registered at the lab (walk-in)". The sample
  carries `via: "walkin"`; everything else is the shape of a public submission (`createdBy: "public"`, `stageKey:
  "submitted"`, one history entry `by: "public"`, no receiver).
- **Submit a sample needs a sign-in.** It fills in the signed-in name as "Submitted by", and a section account's section.
  "Submit a sample" buttons shown to signed-out people now say "Register at lab". Both form headings lost their help
  paragraphs.
- **80% passing 75 µm.** The nine pulverising steps that said 85% now say 80% (EXP-FA, GC-FA, FA-GRAV, CN-SOL, ICP, LECO,
  DELET, PRI and the Mill sample route PLT-HEAD). Routes an admin saved with the 85% wording are shown and saved with 80%
  (`grind80()` in `mergeRoutes`). Samples already in the lab keep the steps they started with. `workflow-routes.md` is
  regenerated.
- **Every field of the reference material register is editable** (Settings > Reference materials), including the ID of a
  saved material. Renaming a saved ID renames all its rows and keeps the old ID in `was`, so control charts and trend rules
  still find the batches recorded under it (`crmAka`, `crmHistory`, `crmSeries`). A material in an open lab batch can't be
  renamed, and a row in an open batch can't change analyte or be removed, until the batch closes. Each save adds what
  changed to a **Change history** under the table (when, who, which material, "Certified value 0.52 → 0.515"; additions and
  removals too), kept in `settings/stages` as `crmLog` (newest first, at most 300 entries). Rows get a stable key `rk` so a
  change can be matched to its row even after its ID or analyte changed. Batch records keep the values they were judged on,
  as before.
- **Assay purpose "Other"** shows a required box, "Why it is being tested" (up to 200 characters). The sample is saved with
  `purpose: "Other: <reason>"` and `purposeWhy`, so the record, labels and exports show the reason.
- **Who received it.** On the workflow line, Received & logged says "Received by NAME, time", while current and once done.
  Other done steps show the technician ("time · NAME"); Submitted shows the submitter.
- **Board: the earlier look, the new behaviour.** Summary tiles in a grid as before v15, every count shown including zeros
  (three a row on phones). A tile with samples is a button: it filters the board ("Showing …", Show all), and Reference
  material trends and Materials past retention open their tabs. Lanes are a grid again, empty lanes full size with "None".
  A lane with more than five cards shows about five and scrolls (`fitLanes()`, with a fade at the bottom until the end);
  a live update keeps each lane where it was scrolled. Cards keep the coloured edge and put "3h 20m left" or "2h late" on
  their last line, as the earlier cards did. Wall screen keeps all of this, larger.
- **ZIJIN.** The header line "Mine site → Assay laboratory" is now "ZIJIN"; certificates say "ZIJIN · Assay Laboratory".

For the Azure build:
- New chunk `app16-k.js` (before `app10-f.js`) and `css16.css`; `build16.py` replaces `build15.py`.
- **Server rules: no change needed.** A walk-in registered by someone signed out (or a viewer or section account) is a
  public submission to `checkSubmission` in `api/lib/core.js`; the extra `via` field is allowed. `v16-tests.js` runs that
  function from the Azure folder against a walk-in document and it passes. Its tag index entries and ID counter hints go
  through the existing public rules. Lab staff registrations are unchanged.
- Five `build.py` patches no longer match:
  - Delete the `put()` for `<strong>View-only access</strong>Only lab staff register samples at the lab. Anyone can use
    Submit a sample.</div>` (the message is gone: everyone can register).
  - Delete the two `put()`s that empty the form paragraphs ("For samples brought straight to the lab…" and "No sign-in
    needed. Fill this in…"): the prototype no longer has them.
  - The result line changed. Replace the old text of that `put()` with
    `` Write ${n === 1 ? "this ID" : "these IDs"} on the sample bag${n === 1 ? "" : "s"}, or print the label${n === 1 ? "" : "s"}${lab ? "" : walk ? ". It shows “Awaiting receipt” until a lab technician confirms it" : ", then bring or send the sample to the Assay Lab. Its status shows “Awaiting receipt” until a lab technician confirms it has arrived"}: ``
    (the replacement stays as it is).
  - The Settings accounts paragraph that `drop()` removes now begins "Anyone can register a sample at the lab without an
    account." Update the `drop()` text: in it, "Anyone can submit a sample without an account." becomes "Anyone can register
    a sample at the lab without an account."
  These five edits as a diff against `build.py` of 2026-10-15 12:38Z: `../sample-tracking-handoffs/v16-azure/build-py-v16.diff`;
  with them the real `build.py` builds this page with no failed patch and the output passes `node --check`. Every other
  patch applies unchanged. `else tab = lsGet("session") ? "board" :
  "submit";` is unchanged on purpose: `setTab` sends signed-out people from "submit" to Register.
- New settings field `crmLog` (array of `{at, by, id, what}`, at most 300) and new CRM row fields `rk` (string) and `was`
  (array of earlier IDs), saved by the lab manager with Save settings and read by everyone with the settings document.
  About 30 KB at most; the server passes settings through.
- New sample fields `via` ("walkin") and `purposeWhy` (string, Other only).
- The login window that stays open after a successful email login is an Azure-only issue (the prototype has no email login);
  nothing here touches it.

Test changes: `harness.js` `fillForm(page, "submit", …)` on a page that is not signed in uses Register (the same
document), and takes `why` for the Other reason. `v15-tests.js` expects Register first when signed out, the tile grid
(zeros included) and grid lanes. New `v16-tests.js`.

## What v15 changes: design refresh (2026-10-15)

Zuriel asked for a better page design ("can we improve the page design, the frontend"). Brief and screenshots of the old
pages: `../sample-tracking-handoffs/design-refresh/`. Data, rules and workflow are unchanged; only the look and the
navigation changed.

- **Navigation.** Tabs have icons and short names (Board, Sample, Submit, Register, Batches, Storage, Results, Ledger,
  Routes, Settings, Sign in), Board first. On a computer every tab fits in one row; when the row is too narrow (tablets)
  the last tabs move under **More**. On a phone (760 px or narrower) the tabs are a bottom bar: the first four, then More.
  A count on a tab under More (for example "Settings (1)") shows as a dot on More.
- **Header.** A dark brand bar with the logo, the search box (on phones the Track button sits inside the box), the sync
  badge, the account and a theme switch. The theme follows the device; a choice is kept on that device (`localStorage`
  key `theme`).
- **Company logo.** Settings > Sections and site time > Company logo. The picture is scaled to at most 480 × 140 px and
  kept in `settings/stages` as `logo` (a PNG or WebP data URL under 90 KB). Everyone sees it in the header. Anything that
  is not a PNG, JPEG or WebP picture is ignored. Certificates and labels are unchanged.
- **Board.** One row of summary chips with counts above zero only ("In the lab" always shows): red for running late and
  limit alerts, amber for QC to act on, re-assays, flagged samples and retention. A chip with samples filters the board
  ("Showing …", Show all); Reference material trends opens Lab batches, Materials past retention opens Storage. Cards
  have a coloured edge (green on time, amber due within 2 h, red late, blue awaiting receipt) and say "3h 20m left" or
  "2h late" (working time when the lab has shifts; the due time shows on hover). Empty lanes fold to a thin column.
  **Wall screen** (staff, not on phones): the board alone, larger, with a clock, refreshed every 30 seconds and full
  screen where the browser allows; Esc or Exit leaves it.
- **Sample record.** A progress bar ("Step 2 of 12", time left on this step); the results card counts down ("Results
  expected in 21h 29m") and turns red when the step is late; the status pill uses the board's colours; empty detail rows
  are folded under "Show all details".
- **Start page** (Sample tab with no sample open): a big search box and, for staff, a **Today** strip (received today,
  results due today, running late, results released today); each number opens the board filtered to it.
- **Touch and readability.** Buttons and inputs are at least 44 px tall (phone bar 56 px); the Save settings and Submit
  bars stay in view at the bottom of long forms with the main button on the right; tables have zebra rows, and on a
  computer long tables (ledger, storage, batches) keep their header in view; one corner radius throughout.

For the Azure build:
- New chunk `app15-j.js` (before `app10-f.js`) and `css15.css`; `build15.py` replaces `build14.py` and rewrites the header
  and tab row markup. The anchors `build.py` uses there are unchanged (`<span class="pill" title="Design prototype">Prototype</span>`,
  the Sign out button, the `#who` line, `resolveSession`); the Password button lands next to Sign out and takes the bar's
  button style. `accBadge()` still works: icons are CSS, so changing the Settings tab text keeps them.
- Three `build.py` patches no longer match because the prototype dropped that text, so delete them: the two `drop()` lines
  for the Sample record start page ("Every sample gets an ID like…" and "Type it above to see…") and the `put()` for
  `""}. Based on the route's step times; queues can add to it.</div>`. Every other patch applies (checked against a copy of
  `build.py`).
- New settings field `logo` (string, may be ""), read by everyone with the settings document and saved by the lab manager
  with Save settings. The server already passes settings through, and 90 KB is well inside the 1.5 MB document limit.
- The shell's `:root{color-scheme:light}` needs no change: the page's dark theme rules are more specific.
- Tests that click a tab at 1280 px still work (every tab fits). At phone width a tab may be under More: the harness
  `tab(page, key)` helper opens More first.

Test changes: `harness.js` has `tab()`, and `signIn` and `fillForm` use it; `visibleTabs` lists tabs in menu order.
`run.js` expects Board first and checks the phone bar instead of the old scroll fade. The phone steps in
`results-tests.js`, `review-tests-v11.js` (J), `v13-tests.js` and `v14-tests.js` open tabs through `tab()`.

## What v14 changes (2026-10-15)

Zuriel asked for four things after finding the step hours too long ("Proceed with all that have to be done").

**Settings tabs.** Settings is split into tabs: **Accounts** (staff accounts, results visibility), **Sections and site
time** (submitting sections, site time zone, lab working hours), **Reference materials**, **Limits** and **Workflow
routes**. One **Save settings** bar stays at the bottom of every tab and shows **Unsaved changes** while anything is
edited. A save that is refused opens the tab with the problem. "Edit steps and hours" on the Workflow routes tab opens
the Workflow routes tab of Settings on that route. The markup is unchanged: `splitSettings()` groups the children of
`.stack` by their `h2` heading after rendering (`paneOf()`), so any section added by name lands on its tab.

**Lab working hours.** Sections and site time has **Lab working hours**: *Round the clock (24/7)* (the default, how
every earlier version counted) or *Working days and shifts* (tick days, add shifts, list closed days such as public
holidays; shifts that end before they start run past midnight, overlapping shifts count once; the page shows the
working hours per week). With shifts set, time allowed for a hands-on step counts only working time, so a step started
at the end of Friday's shift is due on Monday, and "N h over" counts working hours late. Steps that run unattended are
marked **Round the clock** (new column in the route editor) and keep counting overnight and at weekends: drying ovens,
leaches, curing, percolation, the umpire lab and similar (`CLOCK_STEP` at the end of `routes-data.js` marks the
defaults). Expected finish times and the route totals on the Workflow routes tab follow the same rule. Stored in
`settings/stages` as `work: null` or `{days:[0-6], shifts:[{from,to}], off:["YYYY-MM-DD"]}`, in site time.

**Shorter default step hours.** 86 step allowances that were generous were cut (all are still editable in Settings,
and saved routes keep their own hours; samples already in the lab keep the steps they started with). Method times
(fusion, leach and roll times, digests) that set how long the chemistry takes were not changed except where noted.

| Step | Was | Now | Routes |
|---|---|---|---|
| Drying at 105 °C | 12 h | 8 h | EXP-FA, FA-GRAV, SFA, CN-SOL, ICP, PSD, CONC, TSF-CHAR, DENSITY |
| Fast drying at 105 °C | 6 h | 4 h | GC-FA |
| Sorting & QC insertion | 1 h | 0.5 h | EXP-FA, FA-GRAV, SFA, CN-SOL, ICP, LECO, DELET, ABA, AR-AU |
| Crushing to 2 mm (jaw, 90% passing) | 4 h | 2 h | EXP-FA, FA-GRAV, SFA, CN-SOL, ICP, REAGENT, FLOT |
| Crush & pulverise to 75 µm | 6 h | 4 h | LECO, DELET |
| Pulverising to 75 µm | 4 h | 2 h | EXP-FA, FA-GRAV, CN-SOL, ICP, SFA, PRI |
| Pulverise to P80 75 µm | 6 h | 3 h | DIAG |
| Riffle / rotary split | 1.5 h | 1 h | EXP-FA, FA-GRAV, ICP, SFA |
| Fusion & cupellation | 5 h / 3 h | 3 h / 2 h | EXP-FA, FA-GRAV / GC-FA |
| Bead digest & AAS finish / AAS finish | 3 h / 1.5 h | 2 h / 1 h | EXP-FA / GC-FA |
| Parting & prill weighing | 4 h | 2 h | FA-GRAV |
| Head assays | 24 h | 12 h | BRT, CIL-T, DIAG |
| Residue fire assays | 8 h | 6 h | BRT, PRI, REAGENT, DIAG |
| Filter, wash & dry residue | 12 h / 8 h | 8 h / 4 h | BRT / PLT-TAIL, CCD-SVY |
| Concentrate & tails assays | 36 h | 24 h | GRG |
| Mineralogist review / report | 8 h / 16 h | 4 h / 8 h | MINERAL |
| Dispatch, compare, QA/QC manager review | 4 h each | 2 h each | CHECK |
| QA/QC review | 2–3 h (4 h environmental) | 1 h (2 h environmental) | 16 assay routes, ENV-W, ENV-S |
| Metallurgist review | 8 h | 4 h | BRT, CIL-T, GRG, DIAG, COMMIN, COLUMN, FLOT |

Results after receipt, before and after: EXP-FA 35.5 h → 21.5 h, GC-FA 16.5 → 13, FA-GRAV 36.5 → 21.5, SFA 42.5 →
31.5, ICP 41.5 → 30.5, BRT 5.8 → 4.9 days, CIL-T 4.3 → 3.6 days. `workflow-routes.md` has every route; `trim14.py` in the
build thread's scratchpad made the change.

**Bag labels with a QR code.** **Print labels** on the submission confirmation (one label per sample ID) and **Print
label** on each sample record open a label sheet: sample ID, tag number, type, section, submitted date, urgent / hazard
/ two-person flags, and a QR code of the sample's tracking link (`SHARE_URL#ID`). Paper: A4 sheet, or a 100 × 50 mm label
printer (one label per page). **Download** saves the labels as an HTML file to print elsewhere. The QR code is made in the
page (byte mode, level M, no network). Scanning it opens the page on that sample: for a sample awaiting receipt, a signed-in lab technician gets
**Confirm receipt** straight away, anyone else sees the public tracking view. A tracking link opened in a page that is
already open (`hashchange`) also jumps to the sample.

For the Azure build:
- New settings field `work` in `settings/stages` (read by everyone, written by admin with the rest of Settings; no server
  rule change needed, the server passes the settings document through).
- New chunk `app14-i.js` (before `app10-f.js`), new `css14.css`, `build14.py` replaces `build13.py`, new overlay
  `<div id="labelBox">` after `certBox`. New buttons: Print labels (`#rLabels`), Print label (`[data-label]`), label
  sheet Print / Download / Close, Settings tab buttons (`[data-cfgtab]`), Add shift, Add closed day.
- Step editor table has a new "Round the clock" column (`data-rk="clock"`). Route stages may carry `clock: true`.
- Where the Azure-only Settings sections go: **Staff accounts "Sign in with" column** and **Reset password** are in the
  Staff accounts table, on the Accounts tab. **Access requests** (an `h2` placed above Staff accounts) is grouped on the
  Accounts tab automatically, which is also the tab Settings opens on. **Download backup** sits in the Save settings bar,
  which shows on every tab. No anchor `build.py` patches was changed.

## "Edit steps and hours" button (2026-10-15)

Zuriel looked for the step hours on the **Workflow routes** tab, which only shows routes; the editor is far down the
Settings tab. Admins now see an **Edit steps and hours** button inside each route on the Workflow routes tab. It opens
Settings (Workflow routes tab since v14) with that route picked in the route editor and scrolls to it. Nobody else sees the button, and Settings works
as before (new hours apply to samples submitted after Save settings). Change: `src/app10-e.js` only, written by the
"Step hours editor missing" thread (`../sample-tracking-handoffs/edit-hours-button/`).

For the Azure build: one new button label ("Edit steps and hours"), and the Settings heading "Workflow routes" now has
`id="rtEdit"`. No new data, queries or rules.

## Renamed to Assay Lab (2026-10-14)

Zuriel renamed the product from "MET Lab Sample Tracker" to "Assay Lab Sample Tracker". Only visible text and the page's
file name changed; no data key, stored value or behaviour did.

| Where | Before | Now |
|---|---|---|
| Page title and header | MET Lab Sample Tracker | Assay Lab Sample Tracker |
| Header line | Mine site → Metallurgical laboratory | Mine site → Assay laboratory |
| Certificate of analysis heading | Metallurgical Laboratory · Mine site | Assay Laboratory · Mine site |
| Certificate footer | …the sample ID in the MET Lab tracker… | …the sample ID in the Assay Lab tracker… |
| Submit form intro | …when you send samples to the MET Lab. | …when you send samples to the Assay Lab. |
| After submitting | …bring or send the sample to the MET Lab. | …bring or send the sample to the Assay Lab. |
| Results panel (results not shown) | …ask the MET Lab for the certificate. | …ask the Assay Lab for the certificate. |
| Page file | `met-lab-sample-tracker.html` | `assay-lab-sample-tracker.html` |
| `workflow-routes.md` heading | MET Lab workflow routes | Assay Lab workflow routes |

Left as they were: the MET section (code `MET`, default name "Metallurgy (MET Lab)", a submitting section kept in
Settings), retention steps "Returned to MET" (they return material to that section), and the "Metallurgical testwork"
test group and "Metallurgist review" steps (the work, not the lab's name). The title and header are set in `build13.py` (now `build14.py`).

## What v13 changes (board load, and a fresh pass over the design)

The Azure review found that the workflow board downloaded every open sample, and a sample stays open while any
of its material is kept (up to a year for pulps). At 50 samples a day that is thousands of samples of about 8 KB
each, every time the board opens. A fresh pass found the same pattern in four other places. Each now reads a
bounded set.

| What | Before | v13 |
|---|---|---|
| Workflow board | Every open sample (`open == true`), including all stored ones; a storage lane | Samples still in the lab only (`lab == true`: awaiting receipt up to results released). No storage lane. In the v13 test with 3,000 stored samples the board loads 14 KB instead of 21.6 MB. The "Materials past retention" count comes from a small query of stock records due by the end of today. |
| Stored material | Cards in the storage lane | New **Storage** tab (staff, read-only for viewers): samples and materials kept, past retention, due within 30 days, no location; one row per material, oldest due first, 200 at a time; search by ID, tag, location or material; section filter; CSV export (a stock-take sheet). Built from stock records (about 250 bytes each: 3,000 stored samples = 756 KB). Actions stay on the sample record. |
| When a sample goes into storage | When its first material was put away | When every material still kept has a location (or has left). Until then it stays on the board under Results released, flagged after 24 h, and the save message names what is still to put away. |
| Ledger month check | Every open sample, plus every sample closed since the start of the month shown (a year back: everything since) | Stock records of samples on hand at some time in that month (`recvAt < end` and `gone >= start`), however old the month. Re-draws only when the counts change. |
| Section results tab | Every sample the section ever submitted | Its 200 most recent released samples (`relAt > 0`, newest first). |
| Reference material history (trend rules, control chart) | Every batch that ever used the material | Its 60 newest batches (the chart shows the last 60 points; the trend rules need 9). |
| Lab batch view | Read its samples from the board's list | Reads its own samples (`lbs array-contains` the batch), so a released sample already in storage still blocks "Correct an entry" and is still listed. |
| Settings: samples per section, route in use | Open samples on the board's list | Board list plus stored stock records; removing a route waits until stored samples are loaded. |
| One-off upgrade | First 1,000 samples only | Every sample: the first 1,000 by ID, then 200 at a time by version until none is left, six at a time. The upgrade lease is released when done. |

**Stock records** (`stock/<sample ID>`): `{ id, sec, type, route, tag, recvAt, gone, st, due, two, m: [{ k, item, loc, dueAt,
then }] }`, written for every received sample from its own record. `st` is `lab`, `store` or `out`; `gone` is the time it
left the lab, or 9e15 while it is on hand (a number, so range filters work everywhere); `due` is the earliest retention end
of what is kept; `m` is the material kept. A sample write that changes any of this sets `sx: 1` on the sample, writes the
stock record while it still holds the sample's lease, then clears `sx`. If a device drops out in between, maintenance
(every 5 minutes on any staff page) finds `sx == 1` and rewrites the record from the sample.

**For the Azure build** (`../sample-tracking-azure/build.py`):
- New collection `stock`: staff read and write; never public or section accounts (it names samples, tags and locations).
  Queries: `st == "store"`; `st == "store"` and `due < t`; `recvAt < t1` and `gone >= t2`.
- New sample fields `lab` (true/false) and `sx` (1 or null). The board subscribes to `lab == true`; maintenance queries `sx == 1`.
- New queries: samples `lbs array-contains <batch>`; samples `section == S`, `relAt > 0`, ordered by `relAt` desc, limit 200;
  batches `crms array-contains <id>`, ordered by `at` desc, limit 60; samples `v < 13`, limit 200 (upgrade).
- New tab `storage` (in `ROLE_TABS` for admin, supervisor, technician and viewer) with its view `#view-storage`; new chunk `app13-h.js`.
- Changed text the build patches: the board's footer paragraph is gone; the board's empty states now read "No samples in the
  lab" and "No samples in the lab match these filters", with no sentence under them.
- The month check no longer reads `samples` by `closedAt`.
- Rename: the page file is now `assay-lab-sample-tracker.html`, and four sentences the build patches say "Assay Lab" where they said
  "MET Lab" (see "Renamed to Assay Lab" above).

**Tests adapted.** `run.js`: the put-away step (the sample stays on the board until the coarse reject is placed or gone),
tabs, schema 13, and the board checks (stored samples are on the Storage tab, not the board). `review-tests-v11.js`
scenario 8: the board shows every sample in the lab and the old stored sample is on the Storage tab with its coarse reject
past retention; its 1,150 closed records are written as already upgraded and the old open one sorts after them, so the
upgrade has to page past 1,000 records to find it. `v12-tests.js`: the v11 upgrade now ends at schema 13 with stock records.

**Upgrade.** v12 records get `lab` and a stock record once (`meta/schema` = 13). Dry run on a copy of the live register
(4 samples at v12, 3 ledger days): the two samples at a lab step stay on the board, the two in storage move to the Storage
tab, and the month check balances (4 received, 4 on hand), with no console errors.

## What v12 changed (second review, `review-v11-findings.md`)

| # | Finding | What v12 does |
|---|---|---|
| P1-1 | A comma was read as a decimal point (`1,500` saved as 1.5) | The dot is the decimal mark. A comma is read only where it can mean one thing: `0,85` and `12,5` (decimal comma), `1,500.5`, `2,000,000` and `1.234,5` (thousands). `1,500` could be 1500 or 1.5, so it is refused with that message for the technician to retype, on the record, in a batch, in paste and in an amendment. Every number box shows how it reads while typing ("reads as 1500.5", "1500 or 1.5? Retype without the comma", "over the range (10)"). What was typed is kept as `raw`. |
| P1-2 | Reopening a batch after a release left it stuck | "Correct an entry" is not offered once any sample of the batch is released, and is refused if tried (checked again on the server copy). Released samples are never touched by batch decisions (accept, re-run, reopen); a released result is corrected by an amended certificate. |
| P1-3 | An amended certificate skipped every check | An amendment goes through the release checks: required results can't be cleared, over-range values are refused (re-assay instead), ambiguous commas are refused, sample checks must pass (or have been accepted on the earlier certificate) and action limits must be recorded. It is two-step: anyone with edit rights proposes it; another lab supervisor or the lab manager approves it. The lab manager may approve their own with a recorded reason. R2 records who proposed and who approved. The certificate keeps `ul` on its analyte list. |
| P1-4 | Batch QC covered one analyte | A sample joins one batch per analytical method (`qcg`): CIL survey (solution gold run + carbon batch), CCD survey and plant tails (solution run + tails batch), TSF characterisation (cyanide + solution + tails), concentrate (triplicate fire assay + multi-element for Hg and As). A multi-element batch judges every element it reports on every QC position: ICP (Cu, Ag, As, Sb, Zn, Pb, Fe, S), LECO, deleterious elements, cyanide speciation, environmental water and soil. Reference materials certify several results under one ID (one row per result); the batch picks materials that between them cover every result, and a result no material in the batch covers fails the batch. Samples share a batch only when they bring the same results. The certificate has a Quality control column: the batch behind each result, "Calculated", or "Not in a lab batch". |
| P1-5 | Action limits were only text | 40 limits from the routes' triggers and the site permit (`cfg.limits`, editable on Settings: route, result, above/below, value, sampling point, permit flag, action). A result past one raises an alert on the sample and a tile and list on the board; the release (and an amendment's approval) waits until someone records what was done and who was told. The record is printed on the certificate. Sampling-point lists (`pt`) on CCD, CIL, carbon, eluate and solution samples let a limit apply to, for example, end-of-strip eluate only. Permit values (L13–L23) are **example values**. Over-range ICP and LECO results go back for a diluted re-run, which then has no upper limit. |
| P1-6 | One supervisor could enter, approve and release | Whoever entered a result (stamped on each result as `by`) can't accept its batch warnings, accept its failed checks or release it; another supervisor or the lab manager does. The lab manager may do it with a reason, which is recorded in the chain of custody and printed on the certificate. |
| P2-7 | Paste put a duplicate over its original; no header rows | A sample ID given twice fills the sample, then its duplicate. A first line of column names picks the ID and result columns by name (`Sample ID`, `Au (g/t)`, `Cu ppm` …); a unit after a value is ignored; tabs, semicolons, quoted CSV or spaces. |
| P2-8 | Calculated results were typed | Screen fire assay total, recoveries (cyanide solubility, bottle roll, CIL test, intensive leach, flotation), calculated heads, elution efficiency and NNP are worked out from their inputs on every save and shown read-only. `<DL` counts as 0 and the certificate says so. Wash efficiency comes from the survey sheet and stays optional. |
| P2-9 | No trend rules; charts kept old values | Two results in a row beyond 2 SD on the same side make the batch a warning; nine in a row on one side of the certified value are flagged as a bias. Both show on the batch, the Lab batches tab, the board and the control chart (rings on the points). Each result keeps the certified value and SD it was judged on, and the chart plots against those. |
| P2-10 | One blank multiple for prep and analytical blanks | `pbBlank` per batch type (fire assay: prep blank < 10× DL, analytical blank < 5× DL), in the rule text too. |
| P2-11 | Mill sample + fire assay + plant purpose went to EXP-FA | PLT-HEAD also performs fire assay, so it is chosen for plant samples. |
| P2-12 | Certificate showed the wrong role; no tamper check | The certificate names the releaser's real role (lab manager or lab supervisor) and prints a check code worked out from its content; the sample record shows the number and code to anyone, so a copy can be checked. Production: sign it on the server and issue a PDF with a verification QR or link. |
| P2-13 | Submitters couldn't get results | Section accounts (demo `exp`/`exp123`, `plant`/`plant123`) see their own section's certificates on a Results tab, with a count of new ones since they last looked. Production: the same notice by email. |

**Data model notes for the production build.** Sample: `qcg` (batches it joins), `labs` (membership by
batch type: batch, QC state, note), `lbs` (batch IDs, for lookups), summary `labBatch`/`labQc`/`labQcNote`,
`dil`, `acks`, `amend`, and `by` on each result. Batch: `ans` (results it checks) and `rs` per position.
The db merges updates into the stored record, so a result or membership that goes away is written as
`null` and read as absent; a real database would replace the map.

**Upgrade (v12).** Records written by v11 are upgraded once (`meta/schema` = 12): a sample already in a batch
keeps that one batch (recorded under `labs`); the rest take their route's batches. Settings saved by v11
keep their reference material values and gain the new rows and batch types; the limits table and the two
section accounts are added. A dry run on a copy of the three live samples (at v11) gave no batches for
the two stored samples and a solution run plus a tails batch for the CCD sample, with no console errors.

## What v11 added

Results on every sample (`RESULTS`, with units, detection limits and ranges, and checks such as balances
and repeats). 23 batch types with standards, blanks and duplicates placed automatically, QC checked on
save (pass, warning, fail), re-runs and documented exceptions. QA/QC review needs batch results and the
release needs a passing batch. Over-range fire assay goes to a gravimetric finish. Numbered certificates
of analysis (`ID-R1`) that print and download, amended certificates (`R2`) with earlier versions kept.
Results visible to staff only by default. A reference material register (example values) and control
charts. Batch IDs claimed under a lease; two technicians can't batch the same sample twice; a half-created
batch is finished or removed by the next device.

## What v10 changed (first review)

See `v10/` and `review-findings.md`: kept typing across saves (`keepUi`), ledger movements as their own
records, receipt-only rejection with a disposition, forward-only stages with supervisor skips that never
pass QA/QC, time checks, routes filtered by test, state-based board queries, per-material retention, tag
lists and index, per-ID leases, site time zone, two-person custody, copied QC rules, separate location
field, tab-strip cue, fingerprinted mock session.

## Before go-live

- Replace the example reference material values (49 certified results) with the lab's own certificates.
- Replace the example permit and guideline limits (L13–L23) with the site's environmental permit.
- Confirm the plant shift batch rule (fail at 2 SD with no warning band) with the lab; it causes frequent re-runs.

## Known scope

The sign-in screen is a design mock with demo accounts in the settings document. It is not real security;
the production system will be hosted outside Claude with its own auth, and four eyes, check codes and
limits belong on its server. The certificate says it is a design prototype, not an official laboratory
certificate. The db capability scans collections without indexes; the production database needs real
indexes, transactions and server-side time, and instrument results would come in through a LIMS or
instrument interface rather than paste. In Claude the database holds at most 25,000 documents, and each received sample
now has a stock record beside it, so a pilot there holds about 12,000 samples. Alerts and results-ready notices go to the board and the Results
tab only; email or SMS needs the production server.
