# Assay Lab Sample Tracker: source and tests

> **In the GitHub repository** this folder is `prototype/`. Left out: the old version folders (`v9/`, `v10/` and so on; git history keeps versions from now on), and `test/v18-tests.js` and `test/shot18.js`, which read the lab's two real reports and quote their sample codes and values. Those two run only in the project folder, with the private reports present.

This folder holds the **v24** source of the prototype (Version 26; the Azure site is built from it)
(https://claude.ai/artifact/5JgoyE2wokT67u8TCtYDop). The build thread owns all edits; reviewers should read and run, not change these
files. Earlier versions are in git history.

| File | What it is |
|---|---|
| `assay-lab-sample-tracker.html` | The whole page (HTML, CSS, JS in one file), exactly as published (called `met-lab-sample-tracker.html` before the rename). Uses the Artifact runtime `window.claude` db, user and downloads capabilities. |
| `routes-data.js` | Tests, sample types, the 50 workflow routes (13 in use since v23; `RETIRED_ROUTES` lists the others), `RESULTS` (what each test reports, including picked and calculated results), `QC_PROFILES` (lab batch rules), `ROUTE_QC` and `ROUTE_GROUPS` (the batches each route's samples join, one per analytical method), `qcRuleText` / `routeQcText` (write each route's QA/QC text from the same numbers the batches enforce). |
| `src/` | The page is built from these: `app10-a.js` … `app10-f.js`, `app12-g.js` (results, limits, four eyes, amendments, certificates, lab batches, section results), `app13-h.js` (stock records, Storage tab, the selected batch's samples), `app14-i.js` (lab working hours, Settings tabs, QR codes and bag labels), `app15-j.js` (navigation, theme, logo, wall screen, time left), `app16-k.js` (reference material change history and renames, board lanes that scroll), `app18-l.js` (reads a results file in the page: old Excel .xls, .xlsx, CSV and text; SHA-256; base64), `app18-m.js` (recognises a lab report, matches it to samples, batches and QC, the preview, saving and the kept file), `app19-n.js` (blind QA/QC re-assay, a batch or a single sample on the form, the batch page and its receipt, the custody scroll), `app20-o.js` (search suggestions, recently opened, the same details again, tables as cards on a phone, the tab title), `app24-p.js` (departments, evaluation of released results, re-assay requests, the Results tab for staff, the title leading home), `app25-q.js` (scan a bag label, receive several at once, the disposal witness, the monthly ledger sign-off and its summary, turnaround), `css10.css`, `css11.css`, `css12.css`, `css14.css`, `css15.css` (design refresh; its icon block is written by `tools/icons.py`), `css16.css`, `css18.css`, `css19.css`, `css20.css`, `css24.css` (a size larger, colour, the v24 pieces), `base.html` (markup, base CSS and the start of the script). `cd src && python3 build24.py` writes the page into `src/`; copy it up a folder. |
| `tools/icons.py` | Prints the icon definitions at the top of `css15.css` (24 px stroke icons drawn as CSS masks). |
| `test/harness.js` | Shared mock of the db capability: several browser pages on one store, with `where` filters (including `array-contains`), `orderBy`, `limit`, recursive `update` merge, update-requires-existence, leases, frozen snapshots and deletes. Batch helpers (`createBatch`, `fillBatch` for one or many results per position, `saveBatch`). |
| `test/v26-tests.js` | New: shift jobs. The Mill shift, Elution run and Carbon activity templates and their codes (shift, date, elution numbers), unticking and typing over a row, one job received as one, a made-up report releasing every sample on one certificate laid out by analysis, materials by item, a sampling point filling in its analysis, CIL / CIP shown as CIL. Last run: **31 PASS**, no console errors. |
| `test/v25-tests.js` | New (v24c, third round): submissions wait under Awaiting receipt; the board's Awaiting receipt list receives the ticked samples with one set of checks (condition box, a witness for bullion, lab staff only as witnesses, cooler samples one by one, IN movements and custody lines); Scan bags ticks by site sample code and says when a code isn't waiting; Scan beside Track sample opens a tracking link at the receipt form; the camera reads a label this site printed (a fake camera fed the label's QR code, read with jsQR) and opens the sample; disposing of retained material and rejecting to dispose need a witness (custody line and ledger); a technician can't sign off the ledger, the lab manager can, a movement after it shows and the month is signed off again with the first kept; the month summary; turnaround on the Results tab with a sample received three days ago counted late by section and analysis; a results file never holds the release; released results ticked on the workflow with storage the open step, the closing step ticked (✕ when rejected), the disposal witness asked on the row being disposed; from the last lab step the sample waits on Results released and saving the results releases it, two-person custody with a witness; Retained in storage ticked and the workflow complete once the material is on the shelf; on a critical sample the witness confirms the storage and a disposal from their own account (board tile, send back, withdraw); a batch processed as one (one board card, one workflow on the batch page, one results file, one release on one batch certificate, one put-away and disposal, a sample taken out of its batch, typed results releasing the rest, a critical batch's witness confirming once; a batch waiting for receipt counted once and received as one, from the board or the batch page, a cooler batch with one temperature). Last run: **116 PASS**, no console errors. |
| `test/v24-tests.js` | New: release at once (complete results released by the technician who saves them, typed or from a file; QC, limits and checks never hold them; a failed blank doesn't either); departments in Settings with Metallurgy evaluating; tabs by role and department; the Results tab (flags, to evaluate, results in short names) and the Evaluation box (Accepted, Query, Re-assay requested with a reason); the lab's board and record show a re-assay request and re-assaying clears it; a viewer outside an evaluating department sees results only; the three-step Submit form, Belt cut sample on BELT, purpose and section filled in; testwork as purpose (bottle roll solution sent as a mill sample, on AUSX); v24c sample types, AuFx names and the plain analysis list; empty board tiles marked; Storage and Ledger cards; concise Routes with the analytical routes back; 16 px text; sign-off still selectable. |
| `test/v23-tests.js` | The routes the lab runs (route counts brought up to v24's 27 in use). The Workflow routes tab lists 13 routes and only the tests and sample types they take; Submit picks the analysis, purpose and route from the sample type (mill sample AUFX-AUSX, CCD and TSF AUFX-AUSX-CN, carbon C-LOAD, elution ELU-AUSX, RC EXP-FA) and hides the route list when there is one route; a chosen purpose stays; sampling points are lists; a mill sample moves weigh, filter, AuSx, dry, pulverise, fusion, AuFx and needs "AuFx, AuSx"; the sampling point given at submission is the results' point and drives the limits; a CCD slurry reads cyanide straight after filtering and needs AuFx, AuSx and CNWAD; a results file with AuFA, AuSX, NaCN, CNWAD and pH fills it; carbon loading and its limit; elution needs AuSx; the board filter; In use in Settings brings CCD-SVY back and stores only the change, a sample on it keeps its steps after it is turned off; limits on routes not in use are drawn when opened; saved limits get the 10 plant limits once. A shift report laid out like the lab's (method, repeat and unit rows), attached on Lab batches, puts AuFA in the plant batch and AuSX in the solution batch with no clash. Last run: **53 PASS**, no console errors. |
| `test/v22-tests.js` | No QA/QC review step by default. Settings shows QA/QC review step: Not used and Lab batch before release; the route preview and the record have no QA/QC review; a CCD sample moves through every step to Wash efficiency unstopped; the technician sees "A lab supervisor releases the results."; the note asks only for solution and solids gold (not the sampling point); typed results lift it; the board's Ready for release tile and lane hold the sample; a supervisor releases it from Wash efficiency with no QA/QC review in its history; solution gold over the Final underflow limit with no sampling point holds the release, Thickener feed lifts it, Final underflow keeps it; a fire assay lab batch releases its samples from their last step; Before release brings the step back for unreleased samples only (entering it needs the results, not the sampling point; the board lane is QA/QC review again); turned off again, a sample already at QA/QC review is released from there. Last run: **29 PASS**, no console errors. |
| `test/v21-tests.js` | New: the polish pass. One sample, one ID on the button; Same details again after a submission and Same as last on a fresh form (staff batch and walk-in single; codes never copied); the site sample code on board cards; the receipt check without “tag none given”; 1 bag, not 1 bag(s); the browser tab named after the open sample or batch; the ledger search says site code; suggestions under the header search (site code, ID, batch reference, submitter; marked match; arrow keys, Enter, Escape, click; a whole ID with Enter still just opens it; / jumps to the search; signed out only your own recent samples); recently opened on the Sample tab (newest first, live status, one click, Clear, each person their own list, a walk-in's registered samples); the Sample tab pressed again goes back to its start page; the batch page's progress, expected finish and no empty Source column; on a phone the ledger and the batch page read as cards with no sideways scroll, IDs on one line; on a computer the ledger is still a table. Lab batches optional: Not required by default; an exploration fire assay sample goes through its steps, has its gold typed on the record, enters QA/QC review and is released with no batch; a results file attached on a record in no batch saves onto the record and makes no batch; Required brings back the batch rule. Last run: **60 PASS**, no console errors. |
| `test/v20-tests.js` | Blind QA/QC re-assay (technicians can't pick; a supervisor picks from Storage and the Ledger, issues blind QC IDs, prints blind labels; the blind record holds nothing of the original; technicians see no link; receipt, batch and results of the blind samples; the comparison on both records, recorded in the link; admins see it; release; sign-out drops the link), the custody scroll (five entries, full in print and on the public lookup), a batch or a single sample (walk-in batch with paste from a spreadsheet, Enter, remove, duplicate codes; batch reference, IDs in row order; the batch page, Receive the whole batch, batch tracking link; a single sample; staff batch received at once), phone widths. Last run: **71 PASS**, no console errors. |
| `test/v18-tests.js` | New: results files with the lab's two real SGS reports (old Excel): reading, matching by site sample code, moving samples on, new batches from the report with their repeats and the foot-table CRMs, QC, the kept file and its download, attaching twice, the uploader as result entrant, a draft completed by typing, Settings › Results files; batch steps and Next step; re-assay from Storage and the Ledger; the shorter form. The two reports hold real assay data, so they are not in this folder (it goes to GitHub): they are in `/mnt/project-files/sample-tracking-private/lab-reports/` (or set `LAB_REPORTS`); without them the parts that need them print SKIP. Since v19 also: Site sample code and the submitter's badge, No QC in this run (the elution report, a CSV with no QC rows, release and certificate), the screen line, values typed over file values. Last run: **71 PASS**, no console errors. |
| `test/v17-tests.js` | One entry tab per sign-in state, Received now at the lab for staff, the hand-over name and badge (required on walk-ins, the Azure server rule run against them, record, custody log, receipt, board, both names after receipt). Last run: **25 PASS**, no console errors. |
| `test/v16-tests.js` | Walk-in registration for everyone (and the Azure server's public-submission rule run against it), Submit after sign-in, the Other reason, the receiver on the workflow line, 80% grind (also for routes saved with 85%), reference materials renamed and edited with a change history and the control chart following a renamed material, the board tiles and scrolling lanes, ZIJIN. Last run: **42 PASS** (one check moved to v17, the job form also has no explanatory paragraph), no console errors. |
| `test/v15-tests.js` | The design refresh (navigation and More menu at computer, tablet and phone widths, header, theme, board summary and filters (tiles and grid lanes since v16), time left, wall screen, record progress, Today strip, company logo, touch sizes, sticky bars, zebra tables, print). Last run: **46 PASS**, no console errors. |
| `test/run-all.sh` | Runs every browser suite one at a time and prints one line per suite. |
| `test/run.js` | End-to-end tests of the workflow. Last run: **107 PASS**, no console errors. |
| `test/v14-tests.js` | New: Settings tabs, lab working hours (due times, overdue, round-the-clock steps), the trimmed defaults, bag labels (QR decoded with jsQR), tracking-link scans. Needs `jsqr` (`npm i jsqr@1.4.0`; set `NODE_PATH` to include it). Last run: **27 PASS**, no console errors. |
| `test/work-hours-unit.js` | New: the working-time arithmetic, run in Node on the built page's own code (weekends, closed days, night shifts, overlapping shifts, site time zone, a 1,763-hour route). Last run: **14 PASS**. |
| `test/results-tests.js` | Results, certificates and lab batches (the paste check is a results file since v18; an approved amendment of a file value drops its file mark; a batch saved again after Correct an entry keeps the mark only on values left as the file gave them). Last run: **93 PASS**, no console errors. |
| `test/v12-tests.js` | New: every v12 change (numbers, batches per method, multi-element QC, limits, four eyes, amendments, paste, trends, prep blanks, plant routing, check codes, section accounts, upgrade of v11 records and settings; since v18 an amended file value is saved as typed). Last run: **71 PASS**, no console errors. |
| `test/v13-tests.js` | New: stock records through a sample's life, a lab batch whose released sample is already in storage, repair of an unwritten stock record, Settings counts, the month check, and a register with 3,000 stored samples (board load, Storage paging and search, phone width). Last run: **26 PASS**, no console errors. |
| `test/review-tests-v11.js` | The first reviewer's scenarios A–R plus bugs 8, 9, 14–17; scenario 8 adapted for v13 (see below). Last run: **41 OK, 0 BUG**. |
| `test/review-v11-scenarios.js` | The second reviewer's five scenarios, adapted only where v12 now refuses the step (see its header). Last run: **5 OK, 0 BUG**. |
| `test/hours-shortcut-tests.js` | The admin-only "Edit steps and hours" button on the Workflow routes tab (see below). Last run: **7 PASS**, no console errors. |

## Running

```sh
sh test/run-all.sh            # every browser suite, one line each
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
NODE_PATH=$(npm root -g) timeout 590 node v20-tests.js
NODE_PATH=$(npm root -g) timeout 590 node v21-tests.js
NODE_PATH=$(npm root -g) timeout 590 node v22-tests.js
NODE_PATH=$(npm root -g) timeout 590 node v23-tests.js
node work-hours-unit.js
NODE_PATH=$(npm root -g):/path/to/jsqr/node_modules timeout 400 node v14-tests.js
```

The tests write screenshots next to themselves. The Chromium path is in `harness.js`. Run the suites one
at a time: scenario R in `review-tests-v11.js` times ID claims, and the batch tests wait on several writes per
step, so they can miss their time budgets when several browsers share the CPU.

## What v24 changes: release at once, departments and evaluation, analysis-based routes, a cleaner site (2026-10-18)

Zuriel, 2026-10-18 14:53Z, after a walk through the live site: board tiles at 0 are not clickable (by design: now greyed); Submit is
cumbersome and plain; Batches makes no sense; Storage and Ledger need colour; add Belt cut sample; "The QA/QC rule is something the Lab
Technician doesn't have to worry about and this shouldn't hold results from being released … A Metallurgist will do whatever evaluation";
departments on staff accounts, some evaluate, some only see the assay; some retired routes matter, the write-ups are too long; the font is
small. Answers: Belt cut sample is AuFx + moisture; results go out **at once** (no second person); **Metallurgy** evaluates; the lab only
assays, so routes are analyses and testwork (bottle roll…) is what the samples are for.

- **Release at once** (Settings › Release of results: *At once, when the results are complete*, the default; `relMode` absent or `"now"`).
  When saved results (typed on the record, from a lab batch, or from a results file) complete a sample at an analysis step, the analysis
  steps left are recorded as done ("Done: results saved") and the results are released in the same write, under the name of whoever saved
  them (`withRelease()` in `app12-g.js`, used by `act()` and `sampleWrite()`). Only missing results hold a release; QC (batch fail, warning,
  incomplete), action limits, checks and over-range results never do. Technicians can press *Release results* themselves (two-person custody
  samples still release with a witness). A batch closes when its samples are released. Certificates say "Released by NAME, lab technician".
  *After a lab supervisor signs off* (`relMode: "signoff"`) brings back the v23 rules (supervisor, four eyes, holds) and with it the QA/QC
  review step and the lab batch rule, which are offered only then. Amendments to an issued certificate still need a second person.
- **Departments.** Each account has a department (Settings › Accounts); a Departments table lists them with *Evaluates results* (default:
  Assay Lab, Metallurgy (evaluates), Process Plant, Geology / Exploration, Mining / Grade Control, Environment, Management; `cfg.depts`
  `[{ n, ev }]`, user `dept`). The lab manager and lab supervisors always evaluate. Lab roles without a department count as Assay Lab.
- **Evaluation.** Evaluators see, on each released sample, an *Evaluation* box: the flags (limits crossed with their action, checks not met,
  results over range, lab batch QC failed or warned), the evaluations so far, and *Accepted / Query / Re-assay requested* with a comment
  (needed for the last two). Stored as `evals: [{ at, by, tech, dept, v, note }]`, a history line (`ev: true`), and `rq: true` for a
  re-assay request. The lab sees open requests on the board (a tile and a list) and on the record, where *Re-assay* opens with the reason
  "Requested on evaluation"; sending it back clears `rq`. Technicians and non-evaluating viewers see no flags, alerts or QC verdicts.
- **Results tab for staff** (lab manager, supervisors, viewers; not technicians): results released in the last 7/30/90 days, newest first,
  with type, purpose and the results in short names; search, section filter. Evaluators also get Flags and Evaluation columns, *To evaluate
  only*, and the tab shows "Results (N flagged)". Viewers outside an evaluating department lose the Batches tab (it is about QC).
- **Belt cut sample** (`belt`, conveyor list, shift, cut time) on the new route **BELT** "Belt cut: AuFx & moisture" (weigh wet, dry,
  weigh dry, crush, split, pulverise, fire assay, AuFx), test `aufx_m` (moisture %, AuFx g/t), in the plant shift batch.
- **Analysis-based routes.** Back in use: ICP, LECO, MOIST, PSD, DENSITY, AR-AU, CN-SOL, CN-SPEC, ENV-W, ENV-S, DELET, CONC, CHECK (27 in
  use). Testwork routes (BRT, CIL-T, GRG, DIAG, PRI, REAGENT, COLUMN, ILR, FLOT…) stay retired: *What it is for* now lists the testwork
  (Bottle roll test, CIL / CIP leach test, Gravity (GRG) test, …, grouped), and new sample types carry its products to the assay routes:
  Testwork slurry, Testwork solution, Testwork residue, Testwork carbon (the composite is "Testwork head / composite"). A sub-purpose picks
  routes as its base purpose does (`purpBase`). Test groups were tidied so each appears once.
- **Submit** in three coloured steps (Sample · What it is for · Who sent it), Single/Batch in the header, the badge beside the name, the time
  received a one-line "Received now · change", the section filled in from the purpose until changed, the type's group as a coloured chip,
  everything optional under *More details*.
- **Board** tiles with nothing in them are greyed (dashed); the lab's board drops QC and limit tiles while release is at once; "Analysis"
  lane. **Batches** says what a batch is, leads with *Attach results file*, folds away *Make a batch by hand*, the QC chart (evaluators
  only) and closed batches. **Storage** and **Ledger** have a heading and coloured summary cards that filter; storage rows are tinted by
  state; the ledger's IN/OUT are pills and it fits in nine columns. **Routes** show one line of results and the steps as a coloured row
  (batches and limits for evaluators only). **Text** is 16 px, small text 14 px. Role names are shorter (Lab
  supervisor, Section account).

**Later the same day (Zuriel, 16:30Z): "when result is attached, just accept any file … no conditions"; "the Submit/Register page has
too much colour … manage the colours well".**
- **Any file is accepted** while results are released at once (sign-off keeps the v23 checks). Any type (PDF, picture, Word, a report laid
  out another way), up to 5 MB. Values the site can read are filled in as before (samples still in preparation move on to analysis first;
  a lab batch's values are saved even when some are missing, never kept as a draft). Every sample the file is for is then released with
  the file as its results: the samples the file names, else the sample or batch it was attached on, else the ones the technician ticks
  ("Which samples are these results for?"). The sample's results carry `file` and `att: true`; `missingRes` counts nothing missing; the
  certificate (`file`, `att`) says "Results file: NAME. The results are in this file." (or "Results not shown below are in this file") and
  the record links to it. *Attach results file* shows on a record at any step after receipt. Samples list their files in `fids`.
- **Colour.** Surfaces are neutral; the accent (gold) marks what to press, where you are and the Submit step numbers; green, amber and red
  appear only when they mean something and there is something to count. The Submit steps, Batches, Storage and Ledger cards, the
  evaluation box, the Results heading, route steps and the type chip lost their own colours; zero counts are plain.

**Evening (Zuriel): "You see how colors are used in the 'sample' tab, this is better. plain white and grey is not good. the board page
used to be nicer"; fire assay is for AuFx and the Analysis should show it; "Plant & goldroom" becomes "Processing" (Primary Crusher →
Process Plant → TSF); Environment can submit from anywhere; testwork types are duplicates; carbon and elution are process plant samples,
the gold room sends only bullion; the Gold assay subsection is not needed.** (v24c)
- **Sample types**, one of each: *Ore (mine & exploration)*: RC chips, diamond core, grade control blast holes, channel / grab / trench,
  ROM / stockpile, soil / stream sediment. *Processing (crusher to TSF)*: belt cut, mill sample, CCD sample, carbon, elution sample,
  gravity concentrate, TSF sample. *Gold room*: bullion. *Environment*: water, soil / sediment. *Quality control*: assay pulp. *Other*.
  Waste rock, plant tails, CIL slurry, process solution and the five testwork types are `off: true`: no route in use names them any more
  (they were taken out of the routes' type lists), so they leave the form, and records already on them keep them; an admin who puts back
  a route that names one brings it back.
- **Analysis** is one plain list, no sections, of the analyses that apply to the sample type and nothing else (see below). Type *Other*
  lists every analysis in use.
- **AuFx named**: fire assay analyses read *AuFx: fire assay, AAS finish*, *AuFx: fire assay, gravimetric finish (high grade)*,
  *AuFx: screen fire assay (coarse gold)*, *AuFx: check / umpire assay*; their results and the concentrate's report **AuFx** (key `Au`
  unchanged, so old results and files still match); the routes (EXP-FA, GC-FA, FA-GRAV, SFA, CHECK) and their finish steps say AuFx.
  Bullion: Au & Ag fineness; Gravity concentrate: AuFx, Hg & As.
- **Catalogue groups**: Ore grade (AuFx) · Processing (with carbon loading and elution solution) · Gold room (bullion) · Environment ·
  Physical & chemistry (· Metallurgical testwork, not in use). Purposes: Mine & geology first, then Processing (process control
  "crusher, plant, TSF", reconciliation), Gold room (bullion), testwork, Environment ("Environmental compliance (any site)"; on a TSF
  sample it picks water quality, which ENV-W runs for TSF samples), QC, Other.
- **Colour, the Sample tab's way**: panels stay white; meaning is a soft tint, a coloured pill or a coloured edge. Board tiles are white with
  a coloured top edge (blue awaiting receipt, gold in the lab, red late or re-assay requested, amber re-assaying or not stored, green ready
  or released) and take their tint when they count something; empty ones keep the edge and a quiet number (no more grey dashed tiles).
  Storage and Ledger cards the same; ledger IN / OUT green and amber pills; storage rows edged by state. Submit: solid gold step numbers,
  the type chip in its group's colour (ore brown, processing blue, gold room gold, environment green, QC violet), the route line gold-soft.
  Routes: the test catalogue tinted by group, the steps as soft chips by phase. Batches' header and the evaluation box are soft blue,
  flags amber and red.

**Later (Zuriel, 20:57): "'Analysis' should be based on 'Sample' type selected. Analysis that do not apply should not pop-up"; "Some
tabs under Board don't open when clicked … so far as there is a number, when clicked, it should open the list"; "the page font looks too
small".** (v24c, second pass)
- **Analysis = the type's own list.** `typeTests(t)` is the type's `tests`, plus an analysis only when an admin's own route, or a route put
  back in use or with its sample types changed, names the type. The routes in use by default name only types whose list has their analysis
  (ENV-W no longer names TSF, DENSITY not RC or concentrate, AR-AU not environmental soil, AUFX-AUSX not TSF), so by default the list is
  exactly the type's. A testwork purpose adds nothing (a bottle roll solution comes in as, say, a mill sample). Lists trimmed to what
  applies: RC chips (AuFx AAS, gravimetric, screen; cyanide-soluble gold; ICP; LECO), grade control (AuFx AAS, gravimetric), channel
  (AuFx ×3, ICP), ROM (AuFx ×2, moisture, PSD, density), mill sample (AuFx & AuSx, AuFx, AuSx, cyanide, PSD).
- **Every Board tile with a number opens its list**: Results released today, Re-assay requested, Materials past retention and Reference
  material trends now do too (they had no list). The list sits under the tiles: sample ID (opens the record), type, analysis and route,
  where it is (step, release time, who asked for the re-assay and why, which material is past retention); Open Storage / Open Lab batches
  where it helps; Close. Lab samples among them also narrow the lanes. A tile at zero is not a button. On the Sample tab the Today tiles
  open the same lists (Results released today included); a zero one is disabled.
- **Type larger again** (then 18 px in the third pass): body 17 px, labels 16 px, secondary text 15 px, table cells 16 px, pills and table headings 14 px, tabs 17 px,
  form fields 16 px, board cards 16 / 15 px, route steps 15 px. Card cells on a phone wrap, so a date and its pill fit.

**21:48–21:53 (Zuriel): "'What it is for' should match up with the sample type"; "the 'section' under 'what it is for' should match with the
purpose/sample type. eg: mill sample cannot come from GEO or EXP or MIN. only applicable sections must pop-up"; the font again.** (v24c, third pass)
- **What it is for** lists only `TYPE_PURPOSES[type]` and Other (routes-data.js): ore types exploration / grade control / the ore testwork
  (bottle roll, CIL, GRG, diagnostic, preg-robbing, reagent, column, flotation, other) / environmental compliance; grade control blast holes
  grade control, reconciliation, environmental; belt cut and mill sample process control, reconciliation, the plant-feed testwork, environmental;
  CCD process control, reconciliation, reagent and detox tests; carbon process control, carbon strip and CIL tests; elution process control and
  carbon strip; gravity concentrate process control, reconciliation, bullion, intensive leach and GRG; TSF process control, reconciliation,
  detox and bottle roll; bullion only Bullion; environmental types environmental and health & safety; assay pulp QC. A chosen purpose stays
  when the new type takes it, otherwise the type's usual one is filled in. Types not listed (Other, the retired ones) take any purpose.
- **Section** lists only `TYPE_SECTIONS[type]`: e.g. mill sample MET · PLT · ENV; belt cut and CCD the same; carbon, elution and concentrate
  add GR; TSF adds TSF; bullion GR; ore types EXP / GEO / GC / MET / ENV / QC / EXT (grade control and ROM add MIN, ROM PLT); environmental
  ENV / HSE; assay pulp QC / EXP / GEO / GC / MET / EXT. OTH only for sample type Other; a code the list doesn't know (an admin's own section)
  is always offered; a section account keeps its own section and sees only the types its section sends. The section is filled in from the
  purpose and follows it (bottle roll → MET) until the submitter picks one; a lone choice is taken.
- **Type**: 18 px body, labels and fields 17 px, secondary text 16 px, table cells 17 px, pills and headings 15 px, tabs 18 px, the page 1240 px
  wide; on a phone 17 / 16 / 15 px.

**22:43 (Zuriel): "New Sample submit are not adding to the count in 'Awaiting receipt'"; the title or logo should lead home (the board);
the ledger's heading like Lab batches; "if there is anything to improve on the website, do it".** (v24c, fourth pass)
- **Awaiting receipt**: nothing was lost. Lab staff's *Received now at the lab, by me* was ticked by default, so their submissions were
  received on the spot and went to Received & logged. It now starts unticked: every submission waits for receipt (and its receipt checks)
  under Awaiting receipt; tick it when the sample is in hand. The message after submitting says where the sample went.
- **Home**: the header title and logo lead to the home tab (`homeTab()`: the board for lab staff), closing an open sample when home is the
  Sample tab; keyboard reachable.
- **Page heads**: Zuriel meant *remove* them (23:23: "they were not initially there… or not these long"). Ledger and Storage start with their
  cards, no title or explanation; Lab batches keeps only its counts (waiting for results, open, closed this month) and *Attach results
  file*; Results and Workflow routes are as before. The ledger keeps one short line: the month's movements.
- Smaller fixes: board cards drop the route code under the sample ID instead of cutting it off; table headings wrap; the board keeps its
  tiles when no sample is in the lab (today's releases and past-retention material can still be opened); an empty card is not shown
  pressed; *Same details again* keeps *Received now* as it was.

**19 October, 01:13 (Zuriel): "i still see 'Release on hold: Results missing: Head grade.' nothing should prevent the result from being
released as far as there is an attachment".** A file attached before "any file" was accepted (or through a lab batch) was kept as the
sample's results (`results.file`) without the `att` mark, so a value the file didn't hold still counted as missing. Now `hasResFile(s)`
(`results.att` or `results.file`) means nothing is missing (`missingRes`), in either release mode, so with release at once nothing holds
it; with a supervisor's sign-off (chosen in Settings) the lab batch QC still does. The release-at-once write takes it too. On the server, a
disposal brought forward by the one-off upgrade of old records ("Brought forward from the earlier ledger", dated before 19 October 2026) is
history and needs no witness. Samples already waiting like this offer *Release results and issue
certificate* when opened. `v25-tests.js` reproduces it (the hold read "Results missing: AuSx" before the fix): **31 PASS**.

**19 October, 02:05 (Zuriel): "after the result is released, that section of the workflow still stays unchecked. fix it. and fix any other
thing you might spot".** The sample stays at *Results released* until its material is on the shelf, and the rail drew the step it was at
as open ("Started … due …"). Now released results are ticked, with when and who, and the open step is *Retained in storage*, naming the
material still to put away and when it is due (`relDone` in `buildTrack`). A closed sample's closing step is ticked too (disposed,
returned …), and a rejected or cancelled one is marked ✕ in red, instead of being left open. Also: the panel under the rail says what is
left (material still to put away, or all on the shelf and the next retention date); the disposal witness is asked for only when *Dispose*
is chosen, on that material's row (two-person custody still asks above the table for every movement); on the shelf, *Move to another
location* is the default until the retention period is over, so nothing that can't be undone is chosen for you; a disposed material
shows its witness; the material controls sit on one line; the certificate's check code no longer breaks across lines. `v25-tests.js`
checks it all: **41 PASS**. Two test steps that raced a save on a busy machine now wait for it: the harness's `useQcStep` lets its
signed-in page finish the upgrade of old records and their ledger movements before closing it (on the Azure build only a staff page runs
the upgrade, so `run.js` there could check before it was done), and `review-tests-v11.js` 9b waits for the pulp's save before disposing
of the coarse reject.

**19 October, 11:08 (Zuriel): "the 'Result released' is still not checked though the result was released".** The screenshot was the
page as it was before 03:41 (the witness box still above the table): the fix was live, but a page left open keeps running the version
it loaded. The Azure build now notices a new version and moves onto it by itself (`app/azure-shim.js`, `app/version.json`, see the
Azure README); pages opened before this change need one reload by hand.

**19 October, 11:29 (Zuriel): "At a stage before it, it gives you 'Release on hold: Results missing: AuFx, Mercury, Arsenic' even though I
am not even at the result release stage … the brown circle should be on the result release whiles waiting for result file upload or type
in. When the upload is done and saved, then it checks green and the brown circle will now be on 'Retained in storage'".** The last lab
step led straight to the release, so with no results yet it showed a release on hold. Now, with no results (or values still to come), the
last lab step offers *Move to: Results released*: the step is ticked (a custody line, with the witness for two-person custody) and the
sample waits on *Results released*, the open step, with a note naming the results it waits for and the status *Waiting for results*
(`rw` on the sample: the step it was on and when; `waitingRes`, `resMissing`). A correction can put it back on that step. Saving the
results file or typed results releases it (release at once) and the rail ticks *Results released* and opens *Retained in storage*; in the
sign-off mode a lab supervisor releases it from there. Two-person custody samples were never released when their results were saved (the
release needed a witness): the results file dialog now asks for the witness to the release, and typed results take the witness chosen on
the record, and the release carries it. The file dialog's message says which samples were released and which only kept the file.
`v25-tests.js`: **54 PASS**; `v22`, `v23` and `v24` check the waiting note where they checked the hold.

**19 October, 12:43–12:54 (Zuriel): "everything stopped at 'Retained in storage' still in brown ring … there has to be a witness to retain
in storage … the first person confirms and select the 2nd person and triggers the witness confirmation. The witness from his end will just
have to enter the sample id and confirm" — then "not for every sample and not for every disposal. only critical ones".** *Retained in
storage* now ticks green once the material is on the shelf, and the record says **Workflow complete** (status *Complete: in storage*); each
material is still kept for its own period, and its return or disposal shows as the closing step when the last one leaves. On a critical
sample (two-person custody: bullion, gravity concentrate, the gold room, or marked so) the storage and any disposal are confirmed by the
witness from their own account (`app26-r.js`): the first person puts the material away (no witness picked per material) and presses *Ask to
confirm storage*, choosing the witness by account; the sample waits on *Retained in storage* ("Waiting for Lab Manager to confirm the
storage") and nothing else is recorded on the material meanwhile. The witness signs in, opens the sample (its ID, a scan, or the board tile
**Waiting for your confirmation**, with a note when a request arrives) and presses *Confirm storage*, or *Send back* with a reason. A
disposal works the same way: the material leaves (and the ledger's OUT, by the first person, witnessed by the second) only when the witness
confirms. The person who asked, or a lab supervisor, can withdraw a request. Ordinary samples ask for none of this; their disposals keep
the witness named on the record (v24c). On the server (`witnessProblem` in `api/lib/core.js`) a request is made in the name of the person
signed in and names someone else, only the witness named confirms or sends it back, one request at a time, and a critical sample goes into
storage or has material disposed of only with the witness's confirmation. `v25-tests.js`: **68 PASS**; `api-tests.js`: **263**.

**19 October, 14:39 (Zuriel): "Run through the whole site, let's see if there is an anomaly".** A walk-through on the Azure build (the real
page and API): a register built through the page as the lab would (a walk-in, RC chips, mill, CCD, carbon, environmental water, two gravity
concentrates and a bullion bar, through receipt, analysis, waiting for results, release, storage, the witness's confirmation and a
disposal), then every tab as technician, supervisor, lab manager (and each Settings page), viewer, metallurgist, section account and
signed out, at computer width and on a phone in light and dark, with automatic checks for console errors, server refusals, sideways
scrolling and text such as "undefined" or "NaN" (none found). Fixed from what the screenshots showed: the Results tab's table pushed its
Evaluation column out of view on a computer (the Results column now wraps); the board's *Released, not yet put in storage* counted only
those over a day (it now counts all, and says how many are over a day); a board card for a sample waiting for its results named its last
step (now *Waiting for results*), and one waiting for a witness says so; material kept only until release (the gravity concentrate
remainder) showed "Retention ended … 0m past" in red the moment results were released and offered *Put away* (it now says *Due now*, offers
the route's return, and the sample's status says it is due at release); a critical sample waiting for its witness showed that retention
note instead of *Waiting for … to confirm the storage*; the material action list was cut off ("Move to another locatio").

**19 October, 14:52 (Zuriel): "I submitted a sample in batch and a lot of sample ids has been generated. Is there a way we can make samples
submitted in batch be processed as 1 with the batch number? … individual samples within the batch can have their unique sample id, just
they don't have to be processed individually"** — every batch, with one batch certificate. A batch (several samples submitted together,
one `B-…` reference) is now processed as one (`app27-s.js`). Each sample keeps its own ID, label, record, results and custody lines; the
workflow is the batch's:
- **Board**: one card per batch in each lane (*Batch of 12 samples*, its step, time left, drawn as a small stack), opening the batch page;
  the lane counts stay sample counts. A batch's witness request is one row under *Waiting for your confirmation*.
- **Batch page**: under receipt, *Workflow for the batch*: the route's rail for the batch (the earliest step among its received samples)
  and one set of actions: *Move 12 samples to: …* (one press writes each sample's step and custody line, with the witness for a critical
  batch), *Move 12 samples to: Results released*, *Results in: k of 12* with *Attach results file for the batch* (each sample's values read
  from it by ID or site sample code; a file the site can't read is kept as the results of them all), *Release results and issue the batch
  certificate*, then *Retained material of the batch* (one put-away, later one return or disposal per material, with its witness) and, for a
  critical batch, one *Ask to confirm storage* that the witness confirms (or sends back) for all the samples at once.
- **Release**: in release-at-once the batch is released when its results are saved (the batch file, or the last sample's typed results);
  nothing is released while a sample still has no results. Every sample gets the same certificate number (`B-…-R1`), time and check code
  (over all the samples' results), and keeps its own results on it; *View certificate*, on the batch or on any of its samples, opens the
  batch certificate: every sample with its site sample code and results, detection limits, notes per sample. In the sign-off mode a lab
  supervisor releases the batch, the same holds applying to each sample.
- **A sample's record** says it is processed with its batch, with *Open the batch* and *Take it out of the batch*; its steps and materials
  are recorded on the batch page. A sample taken out (by hand, by a re-assay, by a change of route) carries on by itself with its own
  certificate; a sample rejected at receipt or stopped has left the batch's workflow anyway. The server needs no new rule (each sample's write is checked as before); a batch certificate keeps its batch reference where
  results are hidden.
**17:57 (Zuriel): "It didn't work. I submitted a batch of 9 samples and it came as 9 samples waiting and could be processed individually
… it should show 1 awaiting receipt … there's only one workflow and it should be for the batch."** Receipt was still per sample, and
the board's numbers counted samples. Now the batch is one item from submission on: *Awaiting receipt* (and every other tile, each lane's
count, the Today strip and the Board tab) counts a batch once, its list has one row and one tick for the batch (*Batch of 9 samples*),
and a scanned bag of it ticks the batch. A sample of the batch has no receipt of its own: its record opens with *processed with batch
…, received, moved through its steps, released and stored with the whole batch* and *Receive the batch*; scanning its label opens the
batch. The batch page receives all its samples with one press, a batch of cooler samples with one cooler temperature (on each sample's
receipt). The submission message says the batch is processed as one. A bag with a problem is taken out of the batch and received or
rejected on its own.
The suites written before this process a batch's samples one by one: `harness.js` `ids()` takes them out of their batch unless `fillForm`
is given `together: true`. Also fixed: the results file dialog listed a column it had read by its exact name (*AuFx*) under *Columns not
read* as well (it now lists only the columns nothing was read from). `v25-tests.js`: **116 PASS**; `api-tests.js`: **264**.

**19 October, 19:25–20:06 (Zuriel): "Lets change 'CIL / CIP tank slurry' to 'CIL tank slurry' … add 'COF Sample' and 'CUF Sample', 'CIL
Tails', 'CIL Leach Feed' … All these samples are submitted together at end of shift … these samples can actually go in individually when
required … All results go together as one in excel sheet"**, with the shift's reports (mill night shift, elution run, carbon activity) to
build from. (`app28-t.js`)
- **Shift job** on Submit (beside Single sample and Batch): a template lists the samples as the plant's reports do: *Mill shift* (37:
  CCD #1 overflow at four times, tails grab at four times, TSF spigot A/B, stripped and loaded carbon for the elution circuit, carbon from
  CIL tanks 1–10, CIL tails launder at six hours, decant pond, CIL feed 1 and 2, CIL tails, COF, CUF, CCD tails, tank 11, special CIL feed),
  *Elution run* (36: electrowinning tails and head and pregnant solution over time, lean eluate before and after the strip, treated water) and
  *Carbon activity* (regenerated, stripped, loaded and virgin carbon). Codes follow the shift and the date as on the reports (ML + NS/DS +
  point + date, the elution numbers after #); each row has its point, description and usual analysis. Untick what was not sampled, type
  over a code, add a sample from the list. The rows are submitted as one batch (one receipt, one card).
- **One short workflow for the job** (route **JOB**, not chosen for a sample on its own): Received & logged, In analysis, Results released,
  Retained in storage. Each sample keeps its own analysis and results, its own route's retention (pulp, filtrate, solution, carbon) and its
  own route's limits (`baseRoute`). The report can be attached at any step: the job is moved on and released with it.
- **The report releases the job**: every row read by its code (the method, repeat and unit rows above the names; screen fractions; carbon
  loading; elution solutions with NaOH, NaCN and metals; carbon activity columns *Au CA-00 … Au CA-120*), and every sample released on one
  certificate that reads one table per analysis with only its own columns. A report whose title rows held a stray element symbol ("V") was
  read from the wrong row: column names that are exactly a result's name now count when finding the names row.
- **Batch page**: the job's types and analyses, each sample's point and analysis; retained material by item (pulp, filtrate, solution,
  carbon sample), each put away or disposed of for all the samples that keep it.
- **Points from the reports**: Mill sample offers CIL feed, Special CIL feed, CIL tank, CIL tails, CIL tails launder, COF (cyclone
  overflow), CUF (cyclone underflow), Tails grab; Elution sample adds Treated water; Carbon gets the activity test (route **C-ACT**). On a
  single sample, choosing the point fills in its usual analysis (CIL tank: AuFx, AuSx & cyanide with pH; COF and CUF: AuFx & AuSx with grind;
  CCD overflow: AuSx & cyanide; tails grab and TSF spigot: cyanide). **CIL / CIP is CIL** everywhere (the tank survey, the leach test, routes
  saved under the old names).
Tests: new `v26-tests.js` (**31 PASS**, made-up values); the lab's three reports were read locally (37, 36 and 4 samples, every value in its
place) and stay out of GitHub. `v23-tests.js` counts 29 routes; `v24-tests.js` reads *CIL leach test* and the carbon analyses (loading,
activity, moisture); `v25-tests.js` finds a material on the batch page by its slot and name; `run.js` counts 44 routes and 42 analyses;
`v16-tests.js` finds no explanatory paragraph on the job form. Every prototype suite passes (run.js 107, results-tests 93, v12 71, v13 26,
v14 27, v15 46, v16 42, v17 25, v20 71, v21 61, v22 29, v23 53, v24 89, v25 116, v26 31, review 41 + 5, hours 7, work hours 14).

**19 October, clean-up (Zuriel: "are there any redundant script to be removed …?").** The page itself had almost nothing to remove:
no function is declared twice, no CSS rule repeats a selector's property, and one helper (`dayStart`) was unused (removed). The repository
lost what the build and the site never use: `src/v9-backup.html` (184 KB, of which the build read only the first 248 lines) became
`src/base.html` (those lines, 17 KB; the built page is byte-for-byte the same); `build14.py` and `build20.py` (replaced by `build24.py`);
the first reviewers' original scripts in `review/` (their adapted versions are `test/review-tests-v11.js` and
`test/review-v11-scenarios.js`); `test/live-dryrun13.js`, `test/shot16.js`, `test/shot17.js` (one-off runs for v13, v16, v17);
`checkroutes.js`, `genmd.js` and `workflow-routes.md` (written for the old project folder and the pre-v23 routes; the Workflow routes tab
is the route library, and `v23-tests.js` / `v24-tests.js` check the route data). Test outputs and screenshots are git-ignored.

**19 October (Zuriel): "Lets do 1, 2, 4, 5 & 6"** of the suggested improvements. (v24c, fifth pass; `app25-q.js`)
- **Scan to receive.** *Scan* beside *Track sample* opens the camera and reads the bag label's QR code (its tracking link) or a barcode
  (`BarcodeDetector` where the browser has it, otherwise jsQR, fetched only then: from jsDelivr in the prototype, from this site on Azure);
  a handheld scanner or typing works in the same box. A sample waiting for receipt opens at its receipt form. With no camera, or the
  camera not allowed, it says so and the box still works.
- **Receive several at once.** On the board, *Awaiting receipt* lists its samples with ticks (lab staff); *Scan bags* ticks each bag scanned
  (ID, site sample code or batch reference). One receipt for the ticked ones: received by me, date and time, a witness when a bullion or
  other two-person sample is ticked, and "the ticked bags match their submissions, seals intact, good condition". The same write as
  receiving a batch (`receiveMany`, which the batch page now uses); a sample with a cooler check is received on its own record.
- **Monthly ledger sign-off.** Under the ledger's month check: *Not signed off* / *Signed off by … on …: opening + in − out = on hand*.
  A lab supervisor or the lab manager signs off (note optional); `signoff/<YYYY-MM>` keeps each sign-off (name, role, the four numbers,
  reversals, note) and is only added to. A movement after it shows *The month changed after sign-off* and *Sign off again*. *Month
  summary* opens a one-page summary in the certificate window to print: the numbers, by sample type, every sign-off, every movement.
- **Disposal needs a second person.** Disposing of retained material, rejecting a sample to be disposed of and stopping testing to dispose
  need a witness who is not the person recording it (custody line and ledger `wit`). Witness lists are lab staff only (section accounts
  were listed before, for bullion too).
- **Turnaround.** The Results tab opens with *Turnaround: n of m on time (p%) · median … from receipt to release*, and by section and by
  analysis: released, on time, late, on-time %, median. On time = released by the time the route promised from receipt (the same
  projection as the record's "Results expected", lab working hours counted; a re-assay counts against it).

For the Azure build:
- Source: `build24.py` replaces `build20.py` (adds `app24-p.js` before `app10-f.js`, and `css24.css`). `build.py`: eight example accounts
  (the metallurgist), the Department column in the account table, one paragraph no longer there.
- **Server** (`api/lib/core.js`): release follows `relMode` (absent or `"now"`: any lab writer issues a certificate for results they entered;
  `"signoff"`: as before; an amended certificate always by someone other than its proposer). `/api/me` and the staff's view of Settings give
  each account's `dept`. A viewer in a department that evaluates (Settings `depts`, Metallurgy by default until saved) may update a sample
  only by adding one evaluation (its `evals` entry and history line under their own name) and setting `rq: true`; nothing else, never
  removing one; only the lab clears `rq`. New `evals` entries from anyone must name the person signed in. Results files up to 5 MB
  (40 pieces); a section account may open a file listed in `fids` on one of its own section's samples.
- On the live site: results already waiting for a supervisor are released by any technician; set each metallurgist's department to
  Metallurgy in Settings and save.

Tests: new `v24-tests.js`. The suites written before v24 test the sign-off release: `harness.js` seeds `relMode: "signoff"` unless
`V24=1` (`useSignoff()`), `useQcStep()` chooses sign-off first, `createBatch()` opens *Make a batch by hand*, `fillForm()` opens the
received time before typing it, and Google Fonts are answered locally. `v23-tests.js` counts 27 routes in use. Fifth pass: new `v25-tests.js`; `run.js`, `v13-tests.js` and `review-tests-v11.js` choose a witness before disposing; `v15-tests.js`
counts a sample received 3 hours ago as yesterday's just after midnight. v24c: `v24-tests.js` checks the type groups (gold room bullion only, carbon and elution under
Processing, no testwork or duplicate types), the plain AuFx-first analysis list, Environment on a TSF sample, and a bottle roll solution
sent as a mill sample; `v23-tests.js` expects the Processing group and a plain list. Second pass: every type's list equals
its own analyses exactly, a testwork purpose adds nothing, every board tile with a number is a button whose list opens (released today,
re-assay requested, each other tile), 17 px text; `run.js` and `results-tests.js` expect the AuFx route names and the plain list.
Third pass: every type offers exactly its purposes (and Other) and its sections, a mill sample MET / PLT / ENV with PLT filled in and MET for
a bottle roll, bullion GR only, a chosen section kept or replaced with the type; 18 px text. `azure-extra.js` registers its visitor batch as
grade control blast holes from MIN. Fourth pass: `v17-tests.js` and `v21-tests.js` expect *Received now* unticked at first, and Same details again keeps it as it
was; `review-tests-v11.js` check 8 waits for the 1,169-sample board to settle instead of a fixed time.

## What v23 changes: the routes the lab runs, in its own words, and a cleaner Submit form (2026-10-17)

Zuriel, 22:16Z: "the routes/workflow is very wrong in most cases. proces plant samples are either slurry or solution and whats
check is AuFx/AuSx Gold in solid/Gold in solution, CCD and tsf SAMPLES AIM FOR cyanide alongside AuFx/AuSx. exploration and
geology brings in ore samples and you know the work flow. for carbons, the analysis is loadings. [...] revise the workflow.
[...] also, simplify thins in the page to make more clean but even more efficient".

- **Eight new routes**, named as the lab's reports name the results:
  - `AUFX-AUSX` Slurry: AuFx & AuSx (weigh and % solids, filter, AuSx by AAS, dry the washed cake, pulverise, fire assay, AuFx).
  - `AUFX` Solids: AuFx, and `AUSX` Solution: AuSx (filter 0.45 µm, AAS).
  - `AUFX-AUSX-CN` Slurry: AuFx, AuSx & cyanide, for CCD and TSF: the filtrate is read straight away for NaCN, WAD and pH,
    then AuSx, then the solids. `AUSX-CN` Solution: AuSx & cyanide (CCD overflow, decant pond, return water). `CN` Cyanide:
    NaCN, WAD & pH (tails grab, TSF spigot).
  - `C-LOAD` Carbon: Au loading (wash and screen, dry, split, ash, aqua regia digest and AAS).
  - `ELU-AUSX` Elution solution: AuSx, AgSx & Cu, with NaOH, NaCN and pH.
  - Ore keeps `EXP-FA`, `GC-FA`, `FA-GRAV` and `SFA` (sort with QC inserts, dry, crush, split, pulverise, fire assay); the gold room
    keeps `BULLION`.
- **The other 37 routes are not in use**: not offered on Submit, at receipt or on a re-route, and not listed on the Workflow routes
  tab. They stay in the data, so samples already on them keep their steps (the board filter, the record and the receipt still
  show their route). Settings › Workflow routes splits the route list into In use and Not in use and has an **In use** box per
  route; only changes from the default are saved (`routeUse`, a map of route code to true or false). The sample types and tests
  offered follow the routes in use (an admin turning AR-AU back on brings back soil samples and the aqua regia test).
- **Results** are named AuFx (gold in solids, g/t), AuSx (gold in solution, mg/L, detection limit 0.001), AgSx, NaCN, CNWAD,
  pH, % solids and the screen analysis; hold notes and limit alerts use those short names ("Results missing: AuFx, AuSx.").
  NaCN, pH, % solids, screen and metals are optional; CNWAD is required on the cyanide routes.
- **Sampling points are lists** per sample type (mill: CIL feed, cyclone overflow and underflow, CIL tank, CIL tails, tails
  grab; CCD: feed, overflow, underflow, tails; TSF: spigot, decant pond, return water, seepage; carbon: CIL tank, loaded,
  eluted, regenerated, fresh; elution: pregnant solution, electrowinning head and tails, lean eluate). The point given at
  submission fills the results' point, so the "only when" limits apply without retyping it.
- **Ten example plant limits** (P01–P10: AuSx and AuFx in CIL tails, AuSx in CCD tails, WAD over 50 mg/L at the TSF spigot and
  decant pond, eluted carbon over 100 g/t, electrowinning tails over 5 mg/L). They join limits saved before v23 once
  (`limitsV: 23` is stored with the next save, so a removed one does not come back).
- **Results files**: a method code after the symbol now tells solids from solution (AuFA fire assay, AuSX solvent extraction),
  so a solution batch never takes the fire assay column. The lab's daily mill report reads into the new routes: AuFA as AuFx,
  AuSX as AuSx (Rep 2 as repeats), NaCN, CNWAD, pH, % solids, metals and the screen line; carbon tanks as Au loading.
- **Submit is shorter**: sample type and analysis first, then purpose and section on one row; the purpose follows the sample type
  until the submitter changes it; the route list shows only when there is more than one route for the analysis (the route
  preview always shows); the read-only "Received by" box is gone ("Received now at the lab, by me" already says it). The
  analysis list starts with the sample type's own tests.
- **Settings is about twice as fast to draw**: the limits on routes not in use sit in a closed group drawn when opened, a limit's
  route list offers the routes in use, and a burst of storage changes redraws Settings once instead of once per change.

For the Azure build:
- Source: still `build20.py`, no new chunk. Changed: `routes-data.js` (tests, types, point lists, the eight routes, results,
  `ROUTE_QC`, `ROUTE_GROUPS`, `RETIRED_ROUTES`), `app10-a.js` (`routeUse`, P limits, `useOf`, `routeOn`, `liveRoutes`, `testOn`,
  `typeOn`, `routesForTest`, `defaultTest`), `app10-c.js` (analysis list, receipt routes), `app10-d.js` (Submit form, board
  filter), `app10-e.js` (Workflow routes tab, Settings In use and limits), `app10-f.js` (loading `routeUse` and `limitsV`),
  `app12-g.js` (short names, sampling point from the submission), `app13-h.js` (Settings redraw), `app18-m.js` (solids and
  solution columns). The current `build.py` applied to this page with no misses.
- **No server change.** `routeUse` and `limitsV` are two more Settings fields saved by an admin like the others; the server never
  checked routes or limits.
- On the live site, samples already on retired routes (for example PLT-HEAD or CCD-SVY) keep their steps and can be finished.

Tests: new `v23-tests.js`. `harness.js` has `useOldRoutes()`, which seeds `routeUse` with the routes in use before v23; the
older suites are written around those routes and call it first. `fillForm` picks list details. `v16`/`v17` check for the route
area instead of the route list (hidden on a fresh form); `v12` and `run.js` count 10 more limits. A private check of the lab's daily mill report on
the new routes (it names the report's sample codes) is kept in `sample-tracking-private/`, not here.

## What v22 changes: no QA/QC review step unless Settings use it (2026-10-16)

Zuriel, 04:29Z, on a CCD sample held at "Wash efficiency" with "Before QA/QC review: Enter the results before QA/QC review.
Missing: Sampling point, Solution gold, Solids gold": "the flow get stacked here, it shouldnt. 'QA/QC review Expected' should be
taken off".

- **The QA/QC review step is off on every route** (Settings › Accounts, under Results and certificates: "QA/QC review step",
  Not used by default, or Before release). QA/QC is judged on the QA/QC sample sets and on lab batches. The release follows
  the last analysis step: a technician moves the sample through its steps without being stopped, and a lab supervisor releases
  it from the last one. Results are needed only for the release (and the certificate); four eyes, range checks, failed checks,
  limit alerts and batch QC still hold the release as before. Batches release their samples from the last step ("Release
  results for 2 samples").
- Samples keep their route's steps as stored, so the switch can go back: `planOf()` leaves the QA/QC review step out while it
  is not used, unless the sample is at it or has been through it. With the step used again, samples not yet past it get it
  back; a sample released without it does not. Route previews, the Workflow routes tab and the turnaround estimates leave the
  step out the same way. The route editor in Settings still shows it.
- **The board** turns the QA/QC review lane into **Ready for release** (samples whose next step is the release, with nothing
  holding it but who releases), and the "Waiting for a lab batch" tile becomes "Ready for release" while lab batches are
  optional. With the step used, both are as before.
- **The sampling point was counted as a missing result** because the CCD survey, CIL survey, eluate, solution and carbon results
  list it as a picked result with no "optional" mark, and a results file never holds it. Picked results now never count as
  missing; the technician can still choose one with the results. Action limits that apply to one sampling point (for example
  solution gold above 0.05 mg/L in the final underflow) now apply when no sampling point is chosen, so leaving it out cannot hide
  an alert; choosing another point lifts it.
- The lab batch switch is now labelled "Lab batch before release" (same setting, `batchReq`).

For the Azure build:
- Source: still `build20.py`, no new chunk. Changed: `app10-a.js` (`qcStep: false`, `planOf`, `qcStepOn`, `stepsUsed`, route
  preview), `app10-c.js` (the technician's release line), `app10-d.js` (board), `app10-e.js` (the switch, the routes table),
  `app10-f.js` (loading `qcStep`), `app12-g.js` (`missingRes`, `limitHits`, `readyRel`, the batch release button), `app14-i.js`
  (`routeSpan`). None of the strings `build.py` patches or takes out changed: the current `build.py` applied to this page with
  no misses and its output parses.
- **No server change.** `qcStep` is one more Settings field (true or false, absent = not used) saved by an admin like the others;
  the server never checked the QA/QC review step.

Tests: new `v22-tests.js`. `harness.js` has `useQcStep(browser)`, which turns the step on through Settings as a lab manager
would. `run.js`, `results-tests.js`, `v13-tests.js`, `v18-tests.js`, `v20-tests.js`, `review-tests-v11.js` and
`review-v11-scenarios.js` are written around the step and call it first, so they also cover the switch turned on; `v12-tests.js`
and `v18-tests.js` also put `qcStep: true` in the settings they seed. `v21-tests.js` turns it on for its lab batch checks.
`v14`–`v17` and the hours tests run with the default; `v15-tests.js` now counts 11 steps on its record. `run.js` waits for
the move into QA/QC review instead of a fixed pause.

## What v21 changes: a polish pass over the whole site, and lab batches optional (2026-10-16)

**Lab batches are optional (Zuriel, 2026-10-16 03:25Z: "taken off any workflow for now").** A sample no longer needs a lab
batch to enter QA/QC review or to be released. A sample in no batch has all its results typed or attached on its own record
(they are still needed before QA/QC review, and for the certificate); a sample that is in a batch still takes its batch's
results and QC (failed, warning or incomplete QC still holds the release). A results file attached on the record of a
sample in no batch saves onto that record; attached on Lab batches, a report still becomes a lab batch with its own QC
readings, as before. Settings › Accounts, under Results and
certificates: "Lab batch before QA/QC review", Not required (the default) or Required, which brings back the old rule. Four
eyes, missing results, range checks and limit alerts are unchanged.

Zuriel asked for a site people enjoy using and come back to. Every tab was walked as each role (signed out, viewer,
technician, supervisor, admin, section account) at computer and phone widths, on the page as the live site shows it (help
text taken out), and these came out of it:

- **Suggestions under the header search.** Staff see matching samples as they type: site sample code, ID, batch reference,
  site reference or submitter, the matching part marked, with status, type and code. Arrow keys and Enter, or a click, open
  one; Escape closes the list. A whole ID with Enter opens it as before. `/` jumps to the search from anywhere. Signed out,
  the register is not searched as you type; only that person's own recent samples are listed.
- **Recently opened** on the Sample tab: the last 8 samples and batches this person opened, submitted or registered on this
  computer, newest first, with the status (live when the page holds the sample), one click to open, Clear. Each person
  signed in on a shared computer has their own list, so a supervisor's blind and original never sit side by side for a
  technician. The Sample tab pressed again while a sample is open goes back to this start page.
- **The same details again.** After a submission, "Same details again" opens a new form with the type, purpose, test, route,
  section, submitter and badges, hand-over, priority, bags, hazards, add-ons, and Single or Batch with the same count; the
  site sample codes stay empty and the cursor waits in the first one (a test that is the usual one for its type is not
  held when the type is changed). A fresh form shows "Same as last: Mill sample · MET"
  when this person has submitted on this computer before.
- **Phone tables read as cards** (ledger, Storage, open and closed lab batches, a batch's samples, blind QA/QC checks, a
  section's results): each value carries its column name, empty values are left out, nothing scrolls sideways. On a
  computer they stay tables. Sample IDs and site codes in tables no longer break across lines.
- **The batch page** shows "N of M results released" with a bar and when all are expected; the Source column shows only
  when a sample has a source.
- **Board cards** show the site sample code next to the sample type.
- **Wording:** one sample says ID on the button ("Register and issue ID", "Register and get sample ID", "Submit and get
  sample ID"); "1 bag" / "3 bags" instead of "bag(s)"; the receipt check names the site sample code, or leaves it out
  instead of "tag none given"; search boxes say site code, not tag; the section results table says Site code.
- **The browser tab** is named after the open sample or batch ("MET-20261016-0001 · …"), and goes back to the site name on
  other tabs.

For the Azure build:
- Source: `build20.py` replaces `build19.py` (adds `app20-o.js` before `app10-f.js`, and `css20.css`). Changed: `app10-a.js`
  (`bagsText`, `batchReq: false`), `app10-b.js` (one line in `setTab`, after the lines `build.py` patches), `app10-c.js`,
  `app10-d.js`, `app10-e.js` and `app10-f.js` (the `batchReq` setting), `app12-g.js` (`batchesRequired`), `app13-h.js`,
  `app18-m.js` (a file on a record in no batch), `app19-n.js`. None of the strings `build.py` patches or takes out changed: the current `build.py` applied to
  this page with no misses and its output passes `node --check`.
- **No server change.** Recently opened and the last details are kept in the browser's own storage, per person
  (`recent:<user>`, `lastForm:<user>`); suggestions use only the samples the page has already loaded for a staff member;
  nothing new is written to the database. The lab batch switch is one more Settings field, `batchReq` (true or false,
  absent = not required), saved by the admin like the others; the server does not check lab batches, so nothing there changes.

Tests: new `v21-tests.js`; `v16-tests.js` and `v17-tests.js` expect the button to say ID for one sample; `run.js` expects
QA/QC review to wait for the results, not a lab batch.

## What v20 changes: blind QA/QC re-assay, and a batch or a single sample on Submit / Register (2026-10-15)

Zuriel, 22:24Z: "one may submit samples for QAQC analysis … take these samples from storage or ledger for reassay … they must
have a different type of sample ID, the lab tech shouldn't know which old sample has re assayed." 22:42Z: samples come in
batches (a CIL mill run of about 13, CCD, elution, any section) or one at a time, so Submit and Register should let you choose,
and be quick to fill in.

**Blind QA/QC re-assay** (`app19-n.js`, first part)
- **Picking.** Supervisors and admins see a **Blind QA/QC** tick box on each stored sample in Storage (once per sample, not
  per material) and in the Ledger (a stored sample, or a released one still in the lab with material kept). The picks are the
  same on both tabs; a bar shows how many and **Issue blind IDs** / Clear. Up to 50 in one go. Technicians see neither.
- **Issuing.** The box lists each pick with its type, test and where its material is kept, marked Ready or why not (no
  released results, no material kept, itself a blind sample, not found), and "Checked before" when it already has a blind
  check. An optional note. **Issue N blind IDs** shuffles the picks and claims one new sample each in the **QC section**
  (`QC-YYYYMMDD-0001`, the same running numbers as any QC-section sample), then writes the link. The result table shows each
  blind ID beside its original and the material to take; **Print labels** prints the blind labels only.
- **The blind sample** is written as a QA/QC section submission, the same document as Submit: `createdBy: "public"`,
  submitter "QA/QC", purpose Quality control / check assay, awaiting receipt, no site sample code, site reference, details,
  mass or notes, the original's hazards, type **Assay pulp** when the original's test is one the pulp type takes (fire assay,
  gravimetric, ICP, check) and the original's type otherwise. Route and test are the original's (its route as it is now when
  it still performs the test, else the original's own copy), with the preparation steps dropped: after receipt it goes
  straight to the first analysis step (weighing, for EXP-FA). A batch of blind samples shares a `batchKey`. Nothing is
  written on the original or its stock record.
- **The link** is `blind/<blind ID>`: `{ id, of, set, at, by, tech, test, note?, mats: [{ item, loc }], cmps: [] }`. The page
  subscribes to `blind` only while a supervisor or admin is signed in (`watchBlinds()`, from `updateChrome()`), and drops it
  on sign-out. Technicians receive, batch, assay and release the blind sample like any other; nothing they can open names
  the original.
- **Comparison.** On both records (the blind sample and its original), supervisors and admins see a **Blind QA/QC check**
  panel: the original's released results beside the blind sample's (its certificate, or saved results marked not yet
  released), with the difference and the relative difference (|b − a| ÷ mean), judged like a pulp duplicate in the
  original's lab batch (the batch type's duplicate tolerance, absolute for bullion and moisture, "near detection limit" below
  the batch type's minimum). **Record comparison** (optional note) appends `{ at, by, tech, state, rows, note? }` to the
  link's `cmps`; recorded lines show on both records. Nothing is written on either sample record, because technicians and the
  public lookup can read those.
- Storage lists the blind checks for supervisors and admins (newest 20, Show all): blind ID, original, issued, where the
  blind sample is, comparison recorded (red when a result is outside its tolerance). The supervisors' Ledger and Storage mark a
  blind ID "Blind of <original>".

**A batch or a single sample** (`app19-n.js`, second part; the form and `register()` in `app10-d.js`)
- The form starts with **Single sample | Batch** (remembered on the device). Single: one Site sample code box. Batch:
  Number of samples, an optional **Batch name**, and one row per sample (Site sample code, Source location) instead of the
  code box. Everything else on the form is shared by the whole batch.
- Quick filling: a column (or two, code and source) copied from a spreadsheet and pasted into a row fills the rows from there
  down, adding rows (up to 100); Enter moves down a row and adds one at the end; ✕ removes a row; one code on the first row
  counts up for the rest (shown greyed in the empty rows, kept on submit); a code typed twice is marked on both rows and the
  batch is not sent. The button says how many: "Register 13 samples".
- Every sample gets its own ID, label and tracking link, in row order. The batch reference is **B-** and the first ID
  (`batchId: "B-MET-20261015-0004"`, also `batchName`, `batchIndex`, `batchSize`), so the first sample is claimed on its own
  and the rest carry the reference (`claimIds` takes a starting number so the IDs follow the rows). A row's source location
  is that sample's `source`.
- Typing the batch reference in the search box (or opening its tracking link) shows **the batch**: its name, type, test,
  section, submitter, a count per status, every sample with its code, source and status, **Print N labels**, Copy IDs and Copy
  batch link. Lab staff get **Receive the batch**: time received, witness when needed, a tick "All N bags match, seals intact,
  good condition", **Confirm receipt of N**, written as each record's receipt would be ("Received with batch B-…", the IN line,
  the stock record). Types that need a cooler temperature are listed to receive one by one. Each sample record names its
  batch ("B-… (2 of 4) · name"), a link to the batch, and its receipt form has **Receive the whole batch (N)**.

**Chain of custody scrolls** (Zuriel, 23:06Z: "should be scrolled showing around 5 at a time"). On a sample record the custody
log (newest first) shows about five entries and scrolls, like the board lanes (`fitHist()` in `app19-n.js`, called after each
draw of the record, keeping the scroll position on live updates; the heading shows the count when there are more than five).
Every entry is still in the page, so the public lookup has the whole log; printed, the list is shown in full. The certificate
does not carry the custody log, so it is unchanged.

Also: two values from the lab's real reports were in the page (the site sample code placeholder and a code comment quoting
screen fractions); both are made-up examples now. This README's v18 section quoted the real reports' names and values; those
lines are kept out of GitHub.

For the Azure build:
- Source: `build19.py` replaces `build18.py` (adds `app19-n.js` before `app10-f.js`, and `css19.css`); changed `app10-b/c/d.js`,
  `app13-h.js`, `app18-m.js` (a comment). The custody scroll is page-only (`css19.css`, `fitHist()`), no server part. Check `build.py`'s patches against the changed form (the code box, Number of samples,
  the submit button text).
- **New collection `blind`** (`COLLS`). Read and query: **supervisors and admins only**, and never in a reply, a query or the
  changes feed to anyone else (technicians, viewers, section accounts, signed out). Create (`set` of a new document): by a
  supervisor or admin, `by` / `tech` the person signed in, `id` the document id, `of` an existing sample with released
  results, `cmps` empty. Update: only `cmps`, append-only (earlier entries unchanged), the new entry's `by` / `tech` the person
  signed in. No delete. Include it in Download backup (admin).
- Samples: a blind sample is created by a supervisor exactly like a signed-in Submit (`createdBy: "public"`, history `by:
  "public"`, `name: "QA/QC"`, stage submitted, `section: "QC"`, note "Submitted for a QA/QC check"); `checkSubmission` must
  accept it from a supervisor. Nothing else about the blind check is on any sample.
- Batch submissions: new fields `batchId` (`B-` + the batch's first ID), `batchName` (up to 80 characters) and a per-sample
  `source`, on public, walk-in and staff submissions alike (no field list, so nothing to add). Allow the lookup
  `samples where batchId == "B-…"` (limit 100) for everyone, signed out included, returning what the ID lookup returns. The
  batch receipt writes the same receipt as a record does.

Tests: new `v20-tests.js`; `harness.js` `fillForm()` chooses Batch for `count > 1` (rows: one per code, or one code that
counts up) and Single otherwise; `v18-tests.js` checks the Batch choice where it checked Number of samples; `v14-tests.js`
expects "Print 2 labels" (the button now says how many).

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
  (made-up example: `+40 0.5 · +70 2.1 · … · -325 71.0`), in a new optional text result **Screen analysis, % retained** on plant samples.
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
17:15Z: two real SGS reports, a daily mill assay report (night shift) and an elution strip batch report, both old Excel (.xls).
They hold the lab's real data, so their names and values are kept out of this folder (it goes to GitHub); see "Tests" below.

- **Attach results file.** On Lab batches (a whole report), on a batch (its Results step) and on a sample record. The page
  reads the file itself, with no library (`app18-l.js`): Excel 97-2003 `.xls` (the compound file SGS LIMS exports, BIFF8
  records), `.xlsx` and CSV / tab / semicolon text, up to 1 MB. Number formats are kept as the lab printed them (`0.900`),
  dates come out as YYYY-MM-DD.
- **Recognising a report** (`parseReport` in `app18-m.js`), with no setup for these layouts:
  - the sample column is the one whose cells match tracker IDs, tag numbers or site references (spaces and case ignored, so
    a report's `MILL A 001` finds `MILLA001`); unknown codes are listed as not used;
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
    coarser**, read only when the fractions add up to 100 (since v19 kept as the report states it, not worked out);
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
