# Assay Lab workflow routes

Default route library in the Assay Lab Sample Tracker prototype (https://claude.ai/artifact/5JgoyE2wokT67u8TCtYDop). Admins can change any of it on the Settings tab; samples already in the lab keep the steps they started with.

## How a route is chosen

1. The submitter picks the **sample type**, the **assay purpose** (why it is tested) and the **test requested**. The test list puts the tests recommended for that sample type first, and the purpose can change the default (for example drill core for metallurgical testwork defaults to a bottle roll).
2. The page picks the route that performs that test. When several do, a route made for the purpose wins first, then one made for the sample type (for example fire assay of RC chips for grade control goes to the grade control fast track, GC-FA).
3. At receipt the lab technician confirms the route or changes it. Later, a technician can change the route mid-way (for example an over-range result moving to FA-GRAV) or send the sample back for re-assay.

Every route starts with **1. Submitted, awaiting receipt** (6 h allowed) and **2. Received & logged at lab** (1 h; bag checked against the submission, written to the inbound ledger). Every route ends with **Results released**, **Retained in storage** for the route's retention period, then **Returned**, **Sent to external lab** or **Disposed** (outbound ledger). "Results after receipt" below adds up the hours from receipt to results.

Hours are clock hours while the lab runs round the clock (the default). When an admin enters lab working days and shifts on the Settings tab, hands-on steps count only working time and wait for the next shift; steps marked **round the clock** (drying ovens, leaches, curing, the umpire lab) keep running overnight and at weekends.

## Results and lab batches

Each test reports a fixed set of results (below, per route). Routes with a **lab batch** assay their samples in batches with reference materials (CRMs or check standards), blanks and duplicates placed automatically. A sample joins one batch for each analytical method its route uses (for example a solution AAS run for solution gold and a fire assay batch for solids), and a multi-element batch judges every element it reports on every QC position. The number of QC positions is fixed per batch, whatever its size. The batch QC is checked when its results are saved, and a sample's results can't go to QA/QC review without batch results or be released until the batch passes (or a lab supervisor accepts its warnings, or the lab manager accepts a failure as a documented exception). Routes without a batch check each sample's own results (balances, repeats, limits). A lab supervisor who did not enter the results releases them with a numbered certificate of analysis (ID-R1) carrying a check code; the lab manager may release their own with a recorded reason. A correction is proposed by one person and approved by a second, goes through the same range, check and limit tests as a first release, and issues an amended certificate (R2); earlier versions stay on record. Results worked out from others (recoveries, totals, calculated heads, NNP) are calculated, never typed; values below the detection limit count as 0 in them.

Reference materials judged in SD are also watched across batches: two results in a row beyond 2 SD on the same side make the batch a warning, and nine in a row on one side of the certified value are flagged as a bias. Each result keeps the certified value it was judged on. A result past an **action or permit limit** (listed per route below; admins edit them on the Settings tab) raises an alert on the sample and the board, and the release waits until someone records what was done and who was told.

| Batch type | Prefix | Size | QC positions | CRM rule | Blank | Duplicates |
|---|---|---|---|---|---|---|
| Fire assay, 50-position furnace batch | FA | 43 | 1 prep blank, 1 crusher dup, 2 pulp dup, 2 CRM, 1 blank | ±2 SD pass, 2–3 SD warning | < 5× DL; prep blank < 10× DL | 20% (crusher 30%), above 10× DL |
| Grade control fire assay, 25-position batch | GC | 22 | 1 pulp dup, 1 CRM, 1 blank | ±2 SD pass, 2–3 SD warning | < 5× DL | 20%, above 10× DL |
| Gravimetric fire assay batch | FG | 12 | 1 CRM, 1 blank, every sample in duplicate | ±2 SD pass, 2–3 SD warning | < 5× DL | 10%, above 10× DL |
| Screen fire assay batch | SF | 20 | 1 CRM, 1 blank | ±2 SD pass, 2–3 SD warning | < 5× DL | — |
| Plant shift batch (Mill samples) | PL | 30 | 1 pulp dup, 1 CRM, 1 blank | ±2 SD | < 5× DL | 10%, above 10× DL |
| Plant tails batch | PT | 30 | 1 pulp dup, 1 CRM, 1 blank | ±2 SD pass, 2–3 SD warning | < 5× DL | 20%, above 5× DL |
| Concentrate batch (triplicates) | CC | 10 | 1 CRM, every sample in triplicate | ±2 SD pass, 2–3 SD warning | — | 5%, above 10× DL |
| Bullion fire assay batch | BU | 6 | 1 CRM, every sample in duplicate | ±0.5 (absolute) | — | within 0.5 absolute |
| Solution AAS run | SL | 20 | 2 pulp dup, 2 CRM, 1 blank | 90–110% recovery | < 5× DL | 10%, above 10× DL |
| Eluate AAS run | EL | 20 | 1 pulp dup, 1 CRM, 1 blank | 95–105% recovery | < 5× DL | 2%, above 10× DL |
| Carbon assay batch | CB | 20 | 1 pulp dup, 1 CRM | ±2 SD pass, 2–3 SD warning | — | 10%, above 10× DL |
| Cyanide batch | CY | 20 | 2 pulp dup, 1 CRM | 90–110% recovery | — | 10%, above 10× DL |
| Cyanide speciation batch | CS | 20 | 2 pulp dup, 1 CRM | 85–115% recovery | — | 10%, above 10× DL |
| Environmental water batch | EW | 20 | 1 pulp dup, 2 CRM, 1 blank | 85–115% recovery | < 5× DL | 20%, above 5× DL |
| ICP batch | IC | 36 | 1 pulp dup, 2 CRM, 1 blank | ±10% | < 5× DL | 20%, above 10× DL |
| Multi-element batch | ME | 20 | 1 pulp dup, 2 CRM, 1 blank | ±10% | < 5× DL | 20%, above 10× DL |
| LECO batch | LE | 20 | 1 pulp dup, 1 CRM | ±2 SD pass, 2–3 SD warning | — | 5%, above 10× DL |
| Aqua regia gold batch | AR | 20 | 1 CRM, 1 blank | ±2 SD pass, 2–3 SD warning | < 5× DL | — |
| Cyanide-soluble gold batch | LW | 20 | 1 pulp dup, 1 CRM, 1 blank | ±2 SD pass, 2–3 SD warning | < 5× DL | 20%, above 10× DL |
| Soil batch | SO | 20 | 1 pulp dup, 1 CRM, 1 blank | ±15% | < 5× DL | 20%, above 10× DL |
| ARD batch | AB | 20 | 1 pulp dup, 1 CRM | ±10% | — | 10%, above 10× DL |
| Density batch | DN | 20 | 1 pulp dup, 1 CRM | ±1% | — | 2% |
| Moisture batch | MO | 10 | 1 pulp dup | — | — | within 0.5 absolute |

The reference materials and their certified values are kept on the Settings tab. The prototype ships with example values that must be replaced with the lab's own certificates.

## Test catalogue

- **Gold assay:** Gold by fire assay, AAS finish; Gold by fire assay, gravimetric finish (high grade); Screen fire assay (coarse / nuggety gold)
- **Process plant:** Slurry: AuFx & AuSx; Solids: AuFx; Solution: AuSx; Slurry: AuFx, AuSx & cyanide; Solution: AuSx & cyanide; Cyanide: NaCN, WAD & pH
- **Gold room:** Carbon: Au loading; Elution solution: AuSx, AgSx & Cu; Bullion fineness (doré)

## Summary

| Category | Route | Name | Lab steps | Results after receipt |
|---|---|---|---|---|
| Gold assay | EXP-FA | Exploration fire assay (50 g, AAS finish) | 8 | 20.5 h |
| Gold assay | GC-FA | Grade control fast track (30 g fire assay) | 6 | 12 h |
| Gold assay | FA-GRAV | High-grade fire assay (gravimetric finish) | 8 | 20.5 h |
| Gold assay | SFA | Screen fire assay (coarse / nuggety gold) | 9 | 30.5 h |
| Process plant | AUFX-AUSX | Slurry: AuFx & AuSx | 7 | 7.25 h |
| Process plant | AUFX | Solids: AuFx | 5 | 5.75 h |
| Process plant | AUSX | Solution: AuSx | 2 | 2.25 h |
| Process plant | AUFX-AUSX-CN | Slurry: AuFx, AuSx & cyanide | 8 | 8.75 h |
| Process plant | AUSX-CN | Solution: AuSx & cyanide | 3 | 3.75 h |
| Process plant | CN | Cyanide: NaCN, WAD & pH | 2 | 2.75 h |
| Gold room | C-LOAD | Carbon: Au loading | 5 | 10 h |
| Gold room | ELU-AUSX | Elution solution: AuSx, AgSx & Cu | 5 | 3.75 h |
| Gold room | BULLION | Bullion / doré fineness | 6 | 15.5 h |

## Sample types, recommended tests and receipt checks

| Sample type | Recommended tests (first is the default) | Details asked at submission | Checked at receipt |
|---|---|---|---|
| RC chips (reverse circulation) | Gold by fire assay, AAS finish; Screen fire assay (coarse / nuggety gold); Gold by fire assay, gravimetric finish (high grade) | Hole ID, From (m), To (m), Sample condition | Bag count and numbers match the sheet; wet or split bags noted. |
| Diamond drill core | Gold by fire assay, AAS finish; Screen fire assay (coarse / nuggety gold); Gold by fire assay, gravimetric finish (high grade) | Hole ID, From (m), To (m), Core size, Core portion | Bags or trays match the cut sheet; intervals continuous, no gaps or overlaps. |
| Grade control blast-hole cuttings | Gold by fire assay, AAS finish; Gold by fire assay, gravimetric finish (high grade) | Pit, Bench / RL, Blast pattern, Hole number(s) | Pattern and hole numbers match the sheet; samples arrive before the dig plan deadline. |
| Channel / grab / trench sample | Gold by fire assay, AAS finish; Screen fire assay (coarse / nuggety gold) | Face / trench location, Sample length (m) | Labels legible; sample length recorded. |
| ROM ore / stockpile | Gold by fire assay, AAS finish | Stockpile / truck reference, Shift | Stockpile or truck reference recorded. |
| Mill sample | Slurry: AuFx & AuSx; Solids: AuFx; Solution: AuSx; Cyanide: NaCN, WAD & pH; Gold by fire assay, AAS finish | Sampling point, Shift, Composite period | Shift and sampling point labelled; bucket sealed with no spillage. |
| CCD sample | Slurry: AuFx, AuSx & cyanide; Solution: AuSx & cyanide; Cyanide: NaCN, WAD & pH; Slurry: AuFx & AuSx; Solution: AuSx | Sampling point, CCD thickener, Shift, Composite period | One container per thickener and stream, labelled; solution not separated in transit; delivered promptly. |
| TSF sample | Slurry: AuFx, AuSx & cyanide; Solution: AuSx & cyanide; Cyanide: NaCN, WAD & pH; Slurry: AuFx & AuSx; Solution: AuSx | Sampling point, TSF cell / location | Cyanide bottles preserved; cooler temperature recorded. |
| Bullion | Bullion fineness (doré) | Pour / bar number, Gross bar mass (g), Escort / witness | Bar number, gross mass and seal match the gold-room dispatch; two people present at all times. |
| Carbon | Carbon: Au loading | Carbon type, Tank / elution batch no. | Seal intact; gold-room custody form signed. |
| Elution sample | Elution solution: AuSx, AgSx & Cu | Solution, Elution batch / strip no., Time or bed volume | Sealed bottle; elution batch and bed volume labelled; gold-room custody form signed. |
| Other | Gold by fire assay, AAS finish | — | Sample matches the description on the submission. |

Purposes: Exploration / resource definition; Grade control (ore / waste); Plant process control; Mine-to-mill reconciliation; Metallurgical testwork / process design; Bullion / export settlement; Environmental compliance; Health & safety / occupational hygiene; Quality control / check assay; Other.

## Routes

## Gold assay

### EXP-FA: Exploration fire assay (50 g, AAS finish)

Standard route for drill and surface samples: full preparation to a 50 g pulp, lead-collection fire assay, AAS finish. Range 0.005 to 10 g/t Au.

- **Test:** Gold by fire assay, AAS finish
- **Sample types:** RC chips (reverse circulation), Diamond drill core, Channel / grab / trench sample, ROM ore / stockpile, and any other type
- **Chosen first when the purpose is:** Exploration / resource definition, Mine-to-mill reconciliation, Quality control / check assay, Other
- **Results:** about 20.5 h after receipt
- **Reports:** Gold (g/t), DL 0.005, range to 10
- **Lab batch:** Fire assay, 50-position furnace batch for Au

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Sorting & lab QC insertion | Intake | 0.5 h | Sort into sequence and reconcile with the submission sheet. Lab QC is placed per 50-position furnace batch as in the QA/QC rule; client blind QC stays as submitted. |
| 4 | Drying at 105 °C | Preparation | 8 h, round the clock | Stainless trays to constant mass; wet and dry mass recorded. |
| 5 | Jaw crushing to 90% passing 2 mm | Preparation | 2 h | Preparation blank (barren quartz) crushed first; barren flush between samples; crusher duplicate split once per batch; sieve check 1 in 20. |
| 6 | Riffle / rotary split to 1 kg | Preparation | 1 h | Coarse reject bagged and kept. |
| 7 | Pulverising to 80% passing 75 µm | Preparation | 2 h | Quartz wash between samples; wet-sieve check 1 in 20. |
| 8 | Weighing 50 g charge & flux | Analysis / test | 1 h | Balance checked with a certified weight each batch. |
| 9 | Fusion & cupellation | Analysis / test | 3 h | Lead-collection fusion at 1,050 °C, then cupellation to a precious-metal bead. **Re-assays restart here.** |
| 10 | Bead digest & AAS finish | Analysis / test | 2 h | Aqua regia digest; Au read by AAS against matrix-matched standards. |

**QA/QC:** Per 50-position furnace batch: 1 preparation blank, 1 crusher duplicate, 2 pulp duplicates, 2 CRMs and 1 analytical blank. Passes when CRMs are within ±2 SD (2 to 3 SD is a warning, outside ±3 SD fails), the preparation blank is below 10× and the analytical blank below 5× the detection limit (0.05 g/t and 0.025 g/t Au), pulp duplicates agree within 20% and the crusher duplicate within 30% (relative difference, above 10× detection limit). Client blind QC is reported unchanged.

**Re-assay triggers**

- Au of 10 g/t or more: repeat by gravimetric finish (FA-GRAV)
- Replicates differ by more than 20%, or visible gold logged: screen fire assay (SFA)
- CRM outside ±3 SD or blank above 5× detection limit: re-assay the batch from fusion

**Retention and disposal**

- Pulp: kept 12 months after results, then returned to geology
- Coarse reject: kept 3 months after results, then disposed

### GC-FA: Grade control fast track (30 g fire assay)

Quick turnaround so ore and waste boundaries can be marked before digging. Whole sample pulverised; 30 g charge.

- **Test:** Gold by fire assay, AAS finish
- **Sample types:** Grade control blast-hole cuttings
- **Chosen first when the purpose is:** Grade control (ore / waste)
- **Results:** about 12 h after receipt
- **Reports:** Gold (g/t), DL 0.005, range to 10
- **Lab batch:** Grade control fire assay, 25-position batch for Au

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Sorting & QC insertion | Intake | 0.5 h | Sorted by pattern and hole; CRM and blank inserted 1 in 25. |
| 4 | Fast drying at 105 °C | Preparation | 4 h, round the clock | Forced-air oven; samples over 3 kg split before drying. |
| 5 | Crush & pulverise whole sample (LM5) | Preparation | 3 h | Single stage to 80% passing 75 µm; sieve check 1 in 25. |
| 6 | Weighing 30 g charge | Analysis / test | 0.5 h |  |
| 7 | Fusion & cupellation | Analysis / test | 2 h | Lead-collection fire assay, 30 g charge. **Re-assays restart here.** |
| 8 | AAS finish | Analysis / test | 1 h | Results posted to mine geology by blast pattern. |

**QA/QC:** Per 25-position batch: 1 pulp duplicate, 1 CRM and 1 blank. Passes when the CRM is within ±2 SD (2 to 3 SD is a warning, outside ±3 SD fails), the blank is below 5× the detection limit (0.025 g/t Au) and the pulp duplicate agrees within 20% (relative difference, above 10× detection limit). An extra pulp duplicate is run on any result within ±20% of the ore / waste cut-off grade.

**Re-assay triggers**

- Au of 10 g/t or more: repeat by gravimetric finish
- Duplicate near cut-off differs by more than 20%: repeat fusion
- CRM or blank fails: re-assay the whole pattern

**Retention and disposal**

- Pulp: kept 3 months after results, then disposed
- Coarse reject: kept 1 month after results, then disposed

### FA-GRAV: High-grade fire assay (gravimetric finish)

For expected high-grade ore and for over-range repeats (10 g/t or more by AAS). The gold prill is parted and weighed on a microbalance.

- **Test:** Gold by fire assay, gravimetric finish (high grade)
- **Sample types:** Any type
- **Results:** about 20.5 h after receipt
- **Reports:** Gold (g/t), DL 0.05
- **Lab batch:** Gravimetric fire assay batch for Au

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Sorting & QC insertion | Intake | 0.5 h | High-grade CRM and blank inserted per batch. |
| 4 | Drying at 105 °C | Preparation | 8 h, round the clock |  |
| 5 | Crushing to 90% passing 2 mm | Preparation | 2 h |  |
| 6 | Riffle split to 1 kg | Preparation | 1 h |  |
| 7 | Pulverising to 80% passing 75 µm | Preparation | 2 h | Barren wash after every high-grade sample to stop carry-over. |
| 8 | Weighing 50 g charge | Analysis / test | 1 h |  |
| 9 | Fusion & cupellation | Analysis / test | 3 h | **Re-assays restart here.** |
| 10 | Parting & prill weighing | Analysis / test | 2 h | Silver parted with nitric acid; gold annealed and weighed on a 1 µg microbalance. |

**QA/QC:** Per batch of up to 12 samples: every sample in duplicate, 1 high-grade CRM and 1 blank. Passes when the high-grade CRM is within ±2 SD (2 to 3 SD is a warning, outside ±3 SD fails), the blank is below 5× the detection limit (0.25 g/t Au) and duplicates agree within 10% (relative difference, above 10× detection limit).

**Re-assay triggers**

- Duplicates differ by more than 10%: screen fire assay
- Prill too small to weigh (under 0.1 mg): report the AAS result
- Blank after a high-grade sample above 5× detection limit: re-pulverise and repeat

**Retention and disposal**

- Pulp: kept 12 months after results, then returned to geology
- Coarse reject: kept 3 months after results, then disposed

### SFA: Screen fire assay (coarse / nuggety gold)

Separates coarse free gold so it is assayed in full instead of being sub-sampled. Used where visible gold or poor duplicate repeatability is seen.

- **Test:** Screen fire assay (coarse / nuggety gold)
- **Sample types:** Any type
- **Results:** about 30.5 h after receipt
- **Reports:** Gold, total (weighted) (g/t), DL 0.01, calculated from +75 µm fraction, gold in +75 µm fraction, gold in −75 µm, assay 1, gold in −75 µm, assay 2; Gold in +75 µm fraction (g/t), DL 0.05; Gold in −75 µm, assay 1 (g/t), DL 0.01; Gold in −75 µm, assay 2 (g/t), DL 0.01; +75 µm fraction (% of mass); Screen mass loss (%)
- **Checks on each sample's results:** screen mass loss over 2%; two −75 µm assays differ by more than 10% hold the release until re-assayed or accepted by a lab supervisor with a reason
- **Lab batch:** Screen fire assay batch for gold in −75 µm, assay 1

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Sorting & QC insertion | Intake | 0.5 h |  |
| 4 | Drying at 105 °C | Preparation | 8 h, round the clock |  |
| 5 | Crushing to 90% passing 2 mm | Preparation | 2 h |  |
| 6 | Split 1 kg (or whole sample) | Preparation | 1 h |  |
| 7 | Pulverising the whole 1 kg split | Preparation | 2 h | Gold flakes are not over-ground into the bowl. |
| 8 | Screening at 75 µm & weighing fractions | Preparation | 3 h | Plus and minus fraction masses recorded; loss under 2%. |
| 9 | Fire assay: all of +75 µm, 2 × 50 g of −75 µm | Analysis / test | 8 h | Coarse fraction fused in full; fine fraction in duplicate. **Re-assays restart here.** |
| 10 | Gravimetric / AAS finish | Analysis / test | 4 h |  |
| 11 | Weighted total gold calculation | Analysis / test | 1 h | Total Au from mass-weighted coarse and fine grades; coarse gold % reported. |

**QA/QC:** Per batch of up to 20 samples: 1 CRM and 1 blank. Passes when the CRM is within ±2 SD (2 to 3 SD is a warning, outside ±3 SD fails) and the blank is below 5× the detection limit (0.05 g/t Au). Screen mass balance loss under 2% and the two −75 µm assays within 10% are checked on each sample's results.

**Re-assay triggers**

- Screen loss above 2%: re-screen from the pulp
- Fine-fraction duplicates differ by more than 10%: repeat fine-fraction fusion

**Retention and disposal**

- Coarse and fine pulps: kept 12 months after results, then returned to geology
- Coarse reject: kept 3 months after results, then disposed

## Process plant

### AUFX-AUSX: Slurry: AuFx & AuSx

Plant slurry: filtered, the solution read for AuSx, the solids dried, pulverised and fire assayed for AuFx.

- **Test:** Slurry: AuFx & AuSx
- **Sample types:** Mill sample, CCD sample, TSF sample
- **Chosen first when the purpose is:** Plant process control, Mine-to-mill reconciliation
- **Results:** about 7.25 h after receipt
- **Reports:** Sampling point: one of CIL feed, Cyclone overflow, Cyclone underflow, CIL tank, CIL tails, Tails grab, CCD feed, CCD overflow, CCD underflow, CCD tails, TSF spigot, Decant pond, Return water, Seepage / underdrain, Other; AuFx, gold in solids (g/t), DL 0.01; AuSx, gold in solution (mg/L), DL 0.001; AgSx, silver in solution (mg/L), DL 0.001, optional; pH, optional; NaCN, free cyanide (mg/L), optional; Solids (%), optional; Screen analysis, % retained, optional
- **Lab batches:** Plant shift batch (Mill samples) for Au; Solution AAS run for auSx, gold in solution
- **Action limits:** AuSx, gold in solution above 0.02 mg/L (CIL tails): soluble gold loss: alert the plant metallurgist and repeat; AuFx, gold in solids above 0.2 g/t (CIL tails): gold loss in the tails solids: alert the plant metallurgist and repeat; AuSx, gold in solution above 0.05 mg/L (CCD tails): soluble gold loss in the CCD tails: alert the plant metallurgist

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Weigh slurry & % solids | Analysis / test | 0.25 h | pH and NaCN read now when asked: cyanide does not keep. |
| 4 | Filter: solution from solids | Preparation | 0.5 h | Pressure or vacuum filter; the filtrate is kept for AuSx. |
| 5 | AuSx: solution gold by AAS | Analysis / test | 1 h | Solvent extraction (DIBK) for low levels. |
| 6 | Drying the solids at 105 °C | Preparation | 1.5 h, round the clock | Cake washed first so solution gold does not report to the solids. |
| 7 | Pulverising to 80% passing 75 µm | Preparation | 0.75 h |  |
| 8 | Fire assay: fusion & cupellation | Analysis / test | 1.75 h | Lead collection, 50 g charge. **Re-assays restart here.** |
| 9 | AuFx: AAS finish | Analysis / test | 0.5 h | Solids gold in g/t. |

**QA/QC:** AuFx, gold in solids: Per shift batch: 1 duplicate, 1 plant CRM and 1 blank. Passes when the plant CRM is within ±2 SD, the blank is below 5× the detection limit (0.05 g/t Au) and the duplicate agrees within 10% (relative difference, above 10× detection limit). AuSx, gold in solution: Per run of up to 20 readings: 2 duplicates, 2 calibration check standards and 1 blank. Passes when calibration check standards recover 90–110%, the blank is below 5× the detection limit (0.005 mg/L Au) and duplicates agree within 10% (relative difference, above 10× detection limit).

**Re-assay triggers**

- AuFx or AuSx far off the shift trend: repeat from the kept pulp or filtrate
- Plant CRM outside ±2 SD: repeat the shift set

**Retention and disposal**

- Pulp: kept 1 month after results, then disposed
- Filtrate: kept 1 week after results, then cyanide destroyed, disposed

### AUFX: Solids: AuFx

Head grade of a plant slurry or solids sample: dried, pulverised and fire assayed for AuFx.

- **Test:** Solids: AuFx
- **Sample types:** Mill sample, CCD sample, TSF sample
- **Chosen first when the purpose is:** Plant process control, Mine-to-mill reconciliation
- **Results:** about 5.75 h after receipt
- **Reports:** Sampling point: one of CIL feed, Cyclone overflow, Cyclone underflow, CIL tank, CIL tails, Tails grab, CCD feed, CCD overflow, CCD underflow, CCD tails, TSF spigot, Decant pond, Return water, Seepage / underdrain, Other; AuFx, gold in solids (g/t), DL 0.01; Solids (%), optional; Screen analysis, % retained, optional
- **Lab batch:** Plant shift batch (Mill samples) for Au

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Weigh & % solids | Analysis / test | 0.25 h |  |
| 4 | Drying at 105 °C | Preparation | 1.5 h, round the clock | Slurry filtered and the cake washed first. |
| 5 | Pulverising to 80% passing 75 µm | Preparation | 0.75 h |  |
| 6 | Fire assay: fusion & cupellation | Analysis / test | 1.75 h | Lead collection, 50 g charge. **Re-assays restart here.** |
| 7 | AuFx: AAS finish | Analysis / test | 0.5 h | Solids gold in g/t. |

**QA/QC:** Per shift batch: 1 duplicate, 1 plant CRM and 1 blank. Passes when the plant CRM is within ±2 SD, the blank is below 5× the detection limit (0.05 g/t Au) and the duplicate agrees within 10% (relative difference, above 10× detection limit).

**Re-assay triggers**

- AuFx far off the shift trend: repeat from the kept pulp
- Plant CRM outside ±2 SD: repeat the shift set

**Retention and disposal**

- Pulp: kept 1 month after results, then disposed

### AUSX: Solution: AuSx

Plant solution: filtered and read for AuSx.

- **Test:** Solution: AuSx
- **Sample types:** Mill sample, CCD sample, TSF sample
- **Chosen first when the purpose is:** Plant process control, Mine-to-mill reconciliation
- **Results:** about 2.25 h after receipt
- **Reports:** Sampling point: one of CIL feed, Cyclone overflow, Cyclone underflow, CIL tank, CIL tails, Tails grab, CCD feed, CCD overflow, CCD underflow, CCD tails, TSF spigot, Decant pond, Return water, Seepage / underdrain, Other; AuSx, gold in solution (mg/L), DL 0.001; AgSx, silver in solution (mg/L), DL 0.001, optional; pH, optional; NaCN, free cyanide (mg/L), optional
- **Lab batch:** Solution AAS run for auSx, gold in solution
- **Action limits:** AuSx, gold in solution above 0.02 mg/L (CIL tails): soluble gold loss: alert the plant metallurgist and repeat

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Filter 0.45 µm | Preparation | 0.25 h | Carbon fines and solids removed so they add no gold. |
| 4 | AuSx: solution gold by AAS | Analysis / test | 1 h | Solvent extraction (DIBK) for low levels. **Re-assays restart here.** |

**QA/QC:** Per run of up to 20 readings: 2 duplicates, 2 calibration check standards and 1 blank. Passes when calibration check standards recover 90–110%, the blank is below 5× the detection limit (0.005 mg/L Au) and duplicates agree within 10% (relative difference, above 10× detection limit).

**Re-assay triggers**

- AuSx far off the shift trend: repeat from the kept solution

**Retention and disposal**

- Solution: kept 1 week after results, then cyanide destroyed, disposed

### AUFX-AUSX-CN: Slurry: AuFx, AuSx & cyanide

CCD or TSF slurry: filtered, the solution read at once for cyanide (NaCN, WAD) and AuSx, the solids fire assayed for AuFx.

- **Test:** Slurry: AuFx, AuSx & cyanide
- **Sample types:** CCD sample, TSF sample
- **Chosen first when the purpose is:** Plant process control, Environmental compliance, Mine-to-mill reconciliation
- **Results:** about 8.75 h after receipt
- **Reports:** Sampling point: one of CIL feed, Cyclone overflow, Cyclone underflow, CIL tank, CIL tails, Tails grab, CCD feed, CCD overflow, CCD underflow, CCD tails, TSF spigot, Decant pond, Return water, Seepage / underdrain, Other; AuFx, gold in solids (g/t), DL 0.01; AuSx, gold in solution (mg/L), DL 0.001; WAD cyanide (mg/L), DL 0.01; NaCN, free cyanide (mg/L), optional; pH, optional; Solids (%), optional; Copper (mg/L), DL 0.01, optional; Iron (mg/L), DL 0.01, optional; Nickel (mg/L), DL 0.01, optional; Zinc (mg/L), DL 0.01, optional
- **Lab batches:** Plant tails batch for Au; Solution AAS run for auSx, gold in solution; Cyanide batch for WAD cyanide
- **Action limits:** AuSx, gold in solution above 0.05 mg/L (CCD tails): soluble gold loss in the CCD tails: alert the plant metallurgist; WAD cyanide above 50 mg/L (TSF spigot): wAD cyanide over 50 mg/L at the TSF: alert Environment and the plant at once

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Weigh slurry & % solids | Analysis / test | 0.25 h |  |
| 4 | Filter: solution from solids | Preparation | 0.5 h | Filtrate split at once: one part for cyanide, one for AuSx. |
| 5 | Cyanide: NaCN, WAD & pH | Analysis / test | 1.5 h | Free cyanide (NaCN) by AgNO₃ titration straight away; WAD by distillation or flow injection. |
| 6 | AuSx: solution gold by AAS | Analysis / test | 1 h | Solvent extraction (DIBK). |
| 7 | Drying the solids at 105 °C | Preparation | 1.5 h, round the clock | Cake washed first so solution gold does not report to the solids. |
| 8 | Pulverising to 80% passing 75 µm | Preparation | 0.75 h |  |
| 9 | Fire assay: fusion & cupellation | Analysis / test | 1.75 h | Lead collection, 50 g charge. **Re-assays restart here.** |
| 10 | AuFx: AAS finish | Analysis / test | 0.5 h | Solids gold in g/t. |

**QA/QC:** AuFx, gold in solids: Per batch of up to 30 samples: 1 residue duplicate, 1 low-grade CRM and 1 blank. Passes when the low-grade CRM is within ±2 SD (2 to 3 SD is a warning, outside ±3 SD fails), the blank is below 5× the detection limit (0.05 g/t Au) and the residue duplicate agrees within 20% (relative difference, above 5× detection limit). AuSx, gold in solution: Per run of up to 20 readings: 2 duplicates, 2 calibration check standards and 1 blank. Passes when calibration check standards recover 90–110%, the blank is below 5× the detection limit (0.005 mg/L Au) and duplicates agree within 10% (relative difference, above 10× detection limit). WAD cyanide: Per batch of up to 20 samples: 2 duplicates and 1 cyanide check standard. Passes when the cyanide check standard recovers 90–110% and duplicates agree within 10% (relative difference, above 10× detection limit).

**Re-assay triggers**

- WAD cyanide over 50 mg/L at the TSF: alert Environment and the plant at once
- AuSx or AuFx far off the shift trend: repeat from the kept filtrate or pulp

**Retention and disposal**

- Pulp: kept 1 month after results, then disposed
- Filtrate: kept 1 week after results, then cyanide destroyed, disposed

### AUSX-CN: Solution: AuSx & cyanide

CCD overflow, decant pond or return water: cyanide (NaCN, WAD) read at once, then AuSx.

- **Test:** Solution: AuSx & cyanide
- **Sample types:** CCD sample, TSF sample
- **Chosen first when the purpose is:** Plant process control, Environmental compliance, Mine-to-mill reconciliation
- **Results:** about 3.75 h after receipt
- **Reports:** Sampling point: one of CIL feed, Cyclone overflow, Cyclone underflow, CIL tank, CIL tails, Tails grab, CCD feed, CCD overflow, CCD underflow, CCD tails, TSF spigot, Decant pond, Return water, Seepage / underdrain, Other; AuSx, gold in solution (mg/L), DL 0.001; WAD cyanide (mg/L), DL 0.01; NaCN, free cyanide (mg/L), optional; pH, optional; Copper (mg/L), DL 0.01, optional; Iron (mg/L), DL 0.01, optional; Nickel (mg/L), DL 0.01, optional; Zinc (mg/L), DL 0.01, optional
- **Lab batches:** Solution AAS run for auSx, gold in solution; Cyanide batch for WAD cyanide
- **Action limits:** WAD cyanide above 50 mg/L (Decant pond): wAD cyanide over 50 mg/L in the decant pond: alert Environment and the plant at once

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Filter 0.45 µm | Preparation | 0.25 h |  |
| 4 | Cyanide: NaCN, WAD & pH | Analysis / test | 1.5 h | Free cyanide (NaCN) by AgNO₃ titration straight away; WAD by distillation or flow injection. **Re-assays restart here.** |
| 5 | AuSx: solution gold by AAS | Analysis / test | 1 h | Solvent extraction (DIBK). |

**QA/QC:** AuSx, gold in solution: Per run of up to 20 readings: 2 duplicates, 2 calibration check standards and 1 blank. Passes when calibration check standards recover 90–110%, the blank is below 5× the detection limit (0.005 mg/L Au) and duplicates agree within 10% (relative difference, above 10× detection limit). WAD cyanide: Per batch of up to 20 samples: 2 duplicates and 1 cyanide check standard. Passes when the cyanide check standard recovers 90–110% and duplicates agree within 10% (relative difference, above 10× detection limit).

**Re-assay triggers**

- WAD cyanide over 50 mg/L in the decant pond: alert Environment and the plant at once

**Retention and disposal**

- Solution: kept 1 week after results, then cyanide destroyed, disposed

### CN: Cyanide: NaCN, WAD & pH

Cyanide control on a tails grab, TSF spigot or pond: free cyanide (NaCN), WAD cyanide and pH.

- **Test:** Cyanide: NaCN, WAD & pH
- **Sample types:** Mill sample, CCD sample, TSF sample
- **Chosen first when the purpose is:** Plant process control, Environmental compliance
- **Results:** about 2.75 h after receipt
- **Reports:** Sampling point: one of CIL feed, Cyclone overflow, Cyclone underflow, CIL tank, CIL tails, Tails grab, CCD feed, CCD overflow, CCD underflow, CCD tails, TSF spigot, Decant pond, Return water, Seepage / underdrain, Other; WAD cyanide (mg/L), DL 0.01; NaCN, free cyanide (mg/L), optional; pH, optional; Copper (mg/L), DL 0.01, optional; Iron (mg/L), DL 0.01, optional; Nickel (mg/L), DL 0.01, optional; Zinc (mg/L), DL 0.01, optional
- **Lab batch:** Cyanide batch for WAD cyanide
- **Action limits:** WAD cyanide above 50 mg/L (TSF spigot): wAD cyanide over 50 mg/L at the TSF: alert Environment and the plant at once

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Filter 0.45 µm | Preparation | 0.25 h |  |
| 4 | Cyanide: NaCN, WAD & pH | Analysis / test | 1.5 h | Free cyanide (NaCN) by AgNO₃ titration straight away; WAD by distillation or flow injection. **Re-assays restart here.** |

**QA/QC:** Per batch of up to 20 samples: 2 duplicates and 1 cyanide check standard. Passes when the cyanide check standard recovers 90–110% and duplicates agree within 10% (relative difference, above 10× detection limit).

**Re-assay triggers**

- WAD cyanide over 50 mg/L at the TSF: alert Environment and the plant at once

**Retention and disposal**

- Solution: kept 1 week after results, then cyanide destroyed, disposed

## Gold room

### C-LOAD: Carbon: Au loading

Gold loading on CIL tank, loaded, eluted or regenerated carbon: ashed, digested and read by AAS.

- **Test:** Carbon: Au loading
- **Sample types:** Carbon
- **Chosen first when the purpose is:** Plant process control, Bullion / export settlement
- **Results:** about 10 h after receipt
- **Reports:** Carbon type: one of CIL tank carbon, Loaded carbon (to elution), Eluted carbon, Regenerated carbon, Fresh carbon; Au loading (g/t), DL 1
- **Lab batch:** Carbon assay batch for au loading
- **Action limits:** Au loading above 100 g/t (Eluted carbon): repeat and notify the elution operator

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Wash & screen carbon | Preparation | 0.5 h | Fines and grit removed; the bag opened under gold-room custody. |
| 4 | Drying at 105 °C | Preparation | 3 h, round the clock |  |
| 5 | Riffle split & weigh | Preparation | 0.5 h |  |
| 6 | Ashing at 700 °C | Analysis / test | 3 h, round the clock |  |
| 7 | Au loading: aqua regia digest & AAS | Analysis / test | 2 h | Carbon CRM with each run. **Re-assays restart here.** |

**QA/QC:** Per batch of up to 20 samples: 1 duplicate and 1 carbon CRM. Passes when the carbon CRM is within ±2 SD (2 to 3 SD is a warning, outside ±3 SD fails) and the duplicate agrees within 10% (relative difference, above 10× detection limit).

**Re-assay triggers**

- Eluted carbon above 100 g/t Au: repeat and notify the elution operator
- Repeat differs by more than 10%: repeat the loading

**Retention and disposal**

- Carbon sample: kept 1 month after results, then returned to gold room

### ELU-AUSX: Elution solution: AuSx, AgSx & Cu

Pregnant solution, electrowinning head and tails and eluate: AuSx, AgSx and copper, with NaOH, NaCN and pH.

- **Test:** Elution solution: AuSx, AgSx & Cu
- **Sample types:** Elution sample
- **Chosen first when the purpose is:** Plant process control, Bullion / export settlement
- **Results:** about 3.75 h after receipt
- **Reports:** Solution: one of Pregnant solution, Electrowinning head, Electrowinning tails, Lean eluate, Other; AuSx, gold in solution (mg/L), DL 0.001, range to 2000; AgSx, silver in solution (mg/L), DL 0.001, optional; Copper (mg/L), DL 0.01, optional; Iron (mg/L), DL 0.01, optional; Nickel (mg/L), DL 0.01, optional; Zinc (mg/L), DL 0.01, optional; NaOH (%), optional; NaCN, free cyanide (mg/L), optional; pH, optional
- **Lab batch:** Eluate AAS run for auSx, gold in solution
- **Action limits:** AuSx, gold in solution above 5 mg/L (Electrowinning tails): check the electrowinning cells and current

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Custody check & log | Intake | 0.25 h | Sealed bottle; strip number and time recorded. |
| 4 | Filter 0.45 µm | Preparation | 0.25 h | Carbon fines removed. |
| 5 | Dilution by weight (high-grade solutions) | Preparation | 0.25 h |  |
| 6 | AuSx, AgSx & Cu by AAS | Analysis / test | 1.5 h | Standards matched to the caustic-cyanide solution. **Re-assays restart here.** |
| 7 | NaOH, NaCN & pH | Analysis / test | 0.5 h | Eluant strength. |

**QA/QC:** Per run of up to 20 readings: 1 duplicate dilution, 1 high-grade solution standard and 1 blank. Passes when the high-grade solution standard recovers 95–105%, the blank is below 5× the detection limit (0.005 mg/L Au) and the duplicate dilution agrees within 2% (relative difference, above 10× detection limit).

**Re-assay triggers**

- Electrowinning tails above 5 mg/L AuSx: check the cells and current
- Duplicate dilutions differ by more than 2%: repeat

**Retention and disposal**

- Solution: kept 1 month after results, then returned to the gold room

### BULLION: Bullion / doré fineness

Fineness of doré bars for export and settlement by fire assay with proof gold. The bar stays under escort throughout.

- **Test:** Bullion fineness (doré)
- **Sample types:** Bullion
- **Chosen first when the purpose is:** Bullion / export settlement
- **Results:** about 15.5 h after receipt
- **Reports:** Gold fineness (‰); Silver (‰); Base metals and other (‰); Bar mass (g); Top and bottom difference (‰)
- **Checks on each sample's results:** top and bottom differ by more than 2 parts per thousand hold the release until re-assayed or accepted by a lab supervisor with a reason
- **Lab batch:** Bullion fire assay batch for Au

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Witnessed bar weighing, serial & photo | Intake | 0.5 h | Two-person rule; bar number and gross mass recorded. |
| 4 | Drill or chip samples top & bottom | Preparation | 1 h | Or the dip sample taken at the pour. |
| 5 | Clean, roll & weigh assay portions | Preparation | 1 h |  |
| 6 | Cupellation with proof gold, in duplicate | Analysis / test | 6 h | ISO 11426; proof gold corrects for losses. **Re-assays restart here.** |
| 7 | Parting & cornet weighing | Analysis / test | 2 h |  |
| 8 | Silver and impurities (Cu, Fe, Pb) by ICP-OES | Analysis / test | 4 h |  |

**QA/QC:** Per batch of up to 6 bars: every bar in duplicate and 1 proof gold. Passes when the proof gold is within 0.5 ‰ of the certified value and duplicates agree within 0.5 ‰ (absolute). Top and bottom within 2 parts per thousand is checked on each bar's results.

**Re-assay triggers**

- Duplicates differ by more than 0.5‰: repeat
- Top and bottom differ by more than 2‰: bar not homogeneous, re-melt and re-sample

**Retention and disposal**

- Doré bar: returned to the gold room vault the same day
- Cornets & drillings: kept 12 months after results, then kept in secure store

## Routes not in use

Kept so samples already on them keep their steps; not offered on Submit or listed on the Workflow routes tab. An admin turns one back on with **In use** in Settings › Workflow routes.

| Route | Name | Lab steps | Results after receipt |
|---|---|---|---|
| AR-AU | Low-level gold by aqua regia / BLEG (soils, sediments) | 6 | 30.5 h |
| CHECK | Check / umpire assay (external lab) | 4 | 10.3 days |
| CN-SOL | Cyanide-soluble gold (LeachWELL) | 8 | 47.5 h |
| BRT | Bottle roll cyanidation test (48 h) | 12 | 4.7 days |
| CIL-T | CIL / CIP leach test with carbon | 10 | 3.5 days |
| PRI | Preg-robbing test (gold-rob test) | 9 | 2.8 days |
| DIAG | Diagnostic (sequential) leach | 11 | 6.7 days |
| REAGENT | Cyanide & lime consumption (reagent optimisation) | 11 | 3 days |
| O2-UPT | Oxygen uptake rate test | 6 | 44 h |
| COLUMN | Column leach (heap leach) with agglomeration | 11 | 73.3 days |
| ILR | Intensive leach test (gravity concentrate) | 7 | 2.2 days |
| GRG | Gravity recoverable gold (3-stage Knelson) | 9 | 3.6 days |
| FLOT | Flotation test (rougher & cleaner kinetics) | 11 | 2.8 days |
| COMMIN | Comminution & abrasion tests | 10 | 3.5 days |
| DENSITY | Specific gravity & bulk density | 5 | 18 h |
| PSD | Particle size distribution (sieve analysis) | 6 | 18 h |
| MOIST | Moisture content | 3 | 14 h |
| SETTLE | Settling & rheology (thickener, flocculant) | 6 | 32 h |
| ICP | Multi-element ICP (four-acid / aqua regia) | 8 | 29.5 h |
| DELET | Deleterious & cyanicide elements (Cu, As, Sb, Hg…) | 7 | 40.5 h |
| LECO | Sulphur & carbon (LECO), sulphide S, organic C | 6 | 27.5 h |
| MINERAL | Mineralogy (XRD, QEMSCAN / MLA, gold deportment) | 7 | 9.1 days |
| PLT-HEAD | Mill sample: shift head grade & grind (fast track) | 6 | 6.75 h |
| CCD-SVY | CCD sample survey (solution gold & wash efficiency) | 8 | 17 h |
| PLT-TAIL | Plant tails / CIL residue (solid & solution loss) | 7 | 16 h |
| CIL-SVY | CIL / CIP tank survey | 7 | 18 h |
| CARBON | Carbon assay & activity | 5 | 23 h |
| ELUATE | Elution sample (eluate, strip & electrowinning solutions) | 6 | 6 h |
| C-STRIP | Carbon strip test (lab elution of loaded carbon) | 7 | 35 h |
| SOLN | Process solution assay | 4 | 8.5 h |
| CONC | Concentrate assay (gravity / flotation) | 7 | 28.5 h |
| TSF-CHAR | TSF sample (tailings characterisation) | 7 | 31 h |
| CN-SPEC | Cyanide speciation (free, WAD, total, SCN) | 7 | 18 h |
| DETOX | Cyanide destruction (detox) test | 5 | 21 h |
| ABA | Acid-base accounting & NAG (acid rock drainage) | 8 | 2.5 days |
| ENV-W | Environmental water quality | 6 | 28.5 h |
| ENV-S | Environmental soil / sediment | 6 | 3.1 days |
