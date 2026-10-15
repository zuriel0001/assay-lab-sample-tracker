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

- **Gold assay:** Gold by fire assay, AAS finish; Gold by fire assay, gravimetric finish (high grade); Screen fire assay (coarse / nuggety gold); Low-level gold by aqua regia / BLEG (soils, sediments); Check / umpire assay (external lab)
- **Leach & recovery testwork:** Cyanide-soluble gold (LeachWELL); Bottle roll cyanidation test; CIL / CIP leach test with carbon; Preg-robbing test (gold-rob test, PRI); Diagnostic leach (gold deportment); Cyanide & lime consumption (reagent optimisation); Oxygen uptake rate test; Column / heap leach with agglomeration; Intensive leach test (gravity concentrate)
- **Gravity & flotation:** Gravity recoverable gold (GRG); Flotation test (rougher / cleaner kinetics)
- **Physical & comminution:** Comminution & abrasion (SMC, BWi, RWi, Ai); Specific gravity & bulk density; Particle size distribution; Moisture content; Settling & rheology (thickener, flocculant)
- **Chemistry & mineralogy:** Multi-element ICP; Deleterious & cyanicide elements (Cu, As, Sb, Hg…); Sulphur & carbon speciation (total / sulphide S, organic C); Mineralogy (XRD, QEMSCAN / MLA, gold deportment)
- **Plant & gold room:** Mill sample assay (head grade, grind, moisture); CCD survey (solution gold, wash efficiency); Tails / residue gold loss (solid & solution); CIL / CIP tank survey; Carbon loading & activity; Elution solution assay (eluate, strip & electrowinning solutions); Carbon strip test (lab elution of loaded carbon); Process solution assay (Au, Ag, Cu, cyanide); Concentrate assay; Bullion fineness (doré)
- **Environment & cyanide:** TSF sample characterisation (Au, CN, S, metals); Cyanide speciation (free, WAD, total, SCN); Cyanide destruction (detox) test; Acid-base accounting & NAG (acid rock drainage); Water quality (CN, metals, pH, solids); Soil / sediment (metals, Hg, As, CN)

## Summary

| Category | Route | Name | Lab steps | Results after receipt |
|---|---|---|---|---|
| Gold assay | EXP-FA | Exploration fire assay (50 g, AAS finish) | 9 | 21.5 h |
| Gold assay | GC-FA | Grade control fast track (30 g fire assay) | 7 | 13 h |
| Gold assay | FA-GRAV | High-grade fire assay (gravimetric finish) | 9 | 21.5 h |
| Gold assay | SFA | Screen fire assay (coarse / nuggety gold) | 10 | 31.5 h |
| Gold assay | AR-AU | Low-level gold by aqua regia / BLEG (soils, sediments) | 7 | 31.5 h |
| Gold assay | CHECK | Check / umpire assay (external lab) | 5 | 10.4 days |
| Leach & recovery testwork | CN-SOL | Cyanide-soluble gold (LeachWELL) | 9 | 2 days |
| Leach & recovery testwork | BRT | Bottle roll cyanidation test (48 h) | 13 | 4.9 days |
| Leach & recovery testwork | CIL-T | CIL / CIP leach test with carbon | 11 | 3.6 days |
| Leach & recovery testwork | PRI | Preg-robbing test (gold-rob test) | 10 | 3 days |
| Leach & recovery testwork | DIAG | Diagnostic (sequential) leach | 12 | 6.8 days |
| Leach & recovery testwork | REAGENT | Cyanide & lime consumption (reagent optimisation) | 12 | 3.1 days |
| Leach & recovery testwork | O2-UPT | Oxygen uptake rate test | 7 | 2 days |
| Leach & recovery testwork | COLUMN | Column leach (heap leach) with agglomeration | 12 | 73.5 days |
| Leach & recovery testwork | ILR | Intensive leach test (gravity concentrate) | 8 | 2.2 days |
| Gravity & flotation | GRG | Gravity recoverable gold (3-stage Knelson) | 10 | 3.8 days |
| Gravity & flotation | FLOT | Flotation test (rougher & cleaner kinetics) | 12 | 3 days |
| Physical & comminution | COMMIN | Comminution & abrasion tests | 11 | 3.6 days |
| Physical & comminution | DENSITY | Specific gravity & bulk density | 6 | 19 h |
| Physical & comminution | PSD | Particle size distribution (sieve analysis) | 7 | 19 h |
| Physical & comminution | MOIST | Moisture content | 4 | 15 h |
| Physical & comminution | SETTLE | Settling & rheology (thickener, flocculant) | 7 | 36 h |
| Chemistry & mineralogy | ICP | Multi-element ICP (four-acid / aqua regia) | 9 | 30.5 h |
| Chemistry & mineralogy | DELET | Deleterious & cyanicide elements (Cu, As, Sb, Hg…) | 8 | 41.5 h |
| Chemistry & mineralogy | LECO | Sulphur & carbon (LECO), sulphide S, organic C | 7 | 28.5 h |
| Chemistry & mineralogy | MINERAL | Mineralogy (XRD, QEMSCAN / MLA, gold deportment) | 8 | 9.3 days |
| Plant & gold room | PLT-HEAD | Mill sample: shift head grade & grind (fast track) | 7 | 7.25 h |
| Plant & gold room | CCD-SVY | CCD sample survey (solution gold & wash efficiency) | 9 | 18 h |
| Plant & gold room | PLT-TAIL | Plant tails / CIL residue (solid & solution loss) | 8 | 17 h |
| Plant & gold room | CIL-SVY | CIL / CIP tank survey | 8 | 19 h |
| Plant & gold room | CARBON | Carbon assay & activity | 6 | 24 h |
| Plant & gold room | ELUATE | Elution sample (eluate, strip & electrowinning solutions) | 7 | 6.5 h |
| Plant & gold room | C-STRIP | Carbon strip test (lab elution of loaded carbon) | 8 | 36 h |
| Plant & gold room | SOLN | Process solution assay | 5 | 9.5 h |
| Plant & gold room | CONC | Concentrate assay (gravity / flotation) | 8 | 29.5 h |
| Plant & gold room | BULLION | Bullion / doré fineness | 8 | 17.5 h |
| Environment & cyanide | TSF-CHAR | TSF sample (tailings characterisation) | 8 | 32 h |
| Environment & cyanide | CN-SPEC | Cyanide speciation (free, WAD, total, SCN) | 8 | 19 h |
| Environment & cyanide | DETOX | Cyanide destruction (detox) test | 6 | 23 h |
| Environment & cyanide | ABA | Acid-base accounting & NAG (acid rock drainage) | 9 | 2.5 days |
| Environment & cyanide | ENV-W | Environmental water quality | 8 | 31.5 h |
| Environment & cyanide | ENV-S | Environmental soil / sediment | 7 | 3.2 days |

## Sample types, recommended tests and receipt checks

| Sample type | Recommended tests (first is the default) | Details asked at submission | Checked at receipt |
|---|---|---|---|
| RC chips (reverse circulation) | Gold by fire assay, AAS finish; Screen fire assay (coarse / nuggety gold); Gold by fire assay, gravimetric finish (high grade); Multi-element ICP; Cyanide-soluble gold (LeachWELL); Sulphur & carbon speciation (total / sulphide S, organic C); Bottle roll cyanidation test; Specific gravity & bulk density; Deleterious & cyanicide elements (Cu, As, Sb, Hg…); Acid-base accounting & NAG (acid rock drainage) | Hole ID, From (m), To (m), Sample condition | Bag count and numbers match the sheet; wet or split bags noted. |
| Diamond drill core | Gold by fire assay, AAS finish; Screen fire assay (coarse / nuggety gold); Gold by fire assay, gravimetric finish (high grade); Multi-element ICP; Sulphur & carbon speciation (total / sulphide S, organic C); Specific gravity & bulk density; Bottle roll cyanidation test; Preg-robbing test (gold-rob test, PRI); Diagnostic leach (gold deportment); Comminution & abrasion (SMC, BWi, RWi, Ai); Cyanide-soluble gold (LeachWELL); Mineralogy (XRD, QEMSCAN / MLA, gold deportment); Deleterious & cyanicide elements (Cu, As, Sb, Hg…); Acid-base accounting & NAG (acid rock drainage) | Hole ID, From (m), To (m), Core size, Core portion | Bags or trays match the cut sheet; intervals continuous, no gaps or overlaps. |
| Grade control blast-hole cuttings | Gold by fire assay, AAS finish; Gold by fire assay, gravimetric finish (high grade); Cyanide-soluble gold (LeachWELL); Moisture content | Pit, Bench / RL, Blast pattern, Hole number(s) | Pattern and hole numbers match the sheet; samples arrive before the dig plan deadline. |
| Channel / grab / trench sample | Gold by fire assay, AAS finish; Screen fire assay (coarse / nuggety gold); Multi-element ICP; Specific gravity & bulk density | Face / trench location, Sample length (m) | Labels legible; sample length recorded. |
| ROM ore / stockpile | Gold by fire assay, AAS finish; Moisture content; Particle size distribution; Cyanide-soluble gold (LeachWELL); Comminution & abrasion (SMC, BWi, RWi, Ai); Column / heap leach with agglomeration; Specific gravity & bulk density | Stockpile / truck reference, Shift | Stockpile or truck reference recorded. |
| Waste rock / overburden (acid rock drainage) | Acid-base accounting & NAG (acid rock drainage); Sulphur & carbon speciation (total / sulphide S, organic C); Multi-element ICP; Specific gravity & bulk density | Dump / pit location, Lithology | Location and lithology labelled; bags sealed. |
| Soil / stream sediment (geochemistry) | Low-level gold by aqua regia / BLEG (soils, sediments); Multi-element ICP; Gold by fire assay, AAS finish | Grid / line / station, Depth (cm), Horizon | Station numbers match the sheet; samples dry and not mixed. |
| Mill sample | Mill sample assay (head grade, grind, moisture); Particle size distribution; Moisture content; Cyanide-soluble gold (LeachWELL); Gold by fire assay, AAS finish; Oxygen uptake rate test; Settling & rheology (thickener, flocculant); Cyanide & lime consumption (reagent optimisation); Preg-robbing test (gold-rob test, PRI) | Sampling point, Shift, Composite period | Shift and sampling point labelled; bucket sealed with no spillage. |
| CCD sample | CCD survey (solution gold, wash efficiency); Settling & rheology (thickener, flocculant); Process solution assay (Au, Ag, Cu, cyanide); Cyanide speciation (free, WAD, total, SCN); Tails / residue gold loss (solid & solution) | CCD thickener / stage, Stream, Shift, Composite period | One container per thickener and stream, labelled; solution not separated in transit; delivered promptly. |
| TSF sample | TSF sample characterisation (Au, CN, S, metals); Cyanide speciation (free, WAD, total, SCN); Settling & rheology (thickener, flocculant); Acid-base accounting & NAG (acid rock drainage); Particle size distribution; Sulphur & carbon speciation (total / sulphide S, organic C); Multi-element ICP | TSF cell / location, Sample | Cyanide bottles preserved; cooler temperature recorded. |
| Bullion | Bullion fineness (doré) | Pour / bar number, Gross bar mass (g), Escort / witness | Bar number, gross mass and seal match the gold-room dispatch; two people present at all times. |
| Carbon | Carbon loading & activity; Carbon strip test (lab elution of loaded carbon); Moisture content | Carbon type, Tank / elution batch no. | Seal intact; gold-room custody form signed. |
| Elution sample | Elution solution assay (eluate, strip & electrowinning solutions); Process solution assay (Au, Ag, Cu, cyanide); Cyanide speciation (free, WAD, total, SCN) | Elution batch / strip no., Solution, Bed volume or time | Sealed bottle; elution batch and bed volume labelled; gold-room custody form signed. |
| Plant tails / CIL residue | Tails / residue gold loss (solid & solution); Cyanide-soluble gold (LeachWELL); Particle size distribution; Diagnostic leach (gold deportment); Sulphur & carbon speciation (total / sulphide S, organic C); Settling & rheology (thickener, flocculant); Cyanide destruction (detox) test; Cyanide speciation (free, WAD, total, SCN); Flotation test (rougher / cleaner kinetics) | Sampling point, Shift, Composite period | Shift and sampling point labelled; solution not separated in transit. |
| CIL / CIP tank slurry | CIL / CIP tank survey; Process solution assay (Au, Ag, Cu, cyanide); Cyanide speciation (free, WAD, total, SCN); Oxygen uptake rate test; Settling & rheology (thickener, flocculant) | Tank number(s), Survey time | One container per tank, labelled; delivered promptly (cyanide degrades). |
| Process solution (leach, barren, process water) | Process solution assay (Au, Ag, Cu, cyanide); Cyanide speciation (free, WAD, total, SCN); Cyanide destruction (detox) test | Solution, Sampling time, Preserved with NaOH (pH > 11) | Bottle sealed and labelled; preserved if cyanide is to be measured. |
| Gravity / flotation concentrate | Concentrate assay; Intensive leach test (gravity concentrate); Multi-element ICP; Sulphur & carbon speciation (total / sulphide S, organic C); Moisture content; Mineralogy (XRD, QEMSCAN / MLA, gold deportment) | Concentrate, Batch / campaign no., Dispatch mass (g) | Seal numbers and mass match the dispatch note; two people present. |
| Environmental water (surface, ground, discharge) | Water quality (CN, metals, pH, solids); Cyanide speciation (free, WAD, total, SCN) | Monitoring point ID, Field pH, Field EC (µS/cm), Water temperature (°C), Preservation, Cooler temperature at dispatch (°C) | Cooler at 6 °C or below, preservation correct, within holding time, chain-of-custody signed. |
| Environmental soil / sediment | Soil / sediment (metals, Hg, As, CN); Multi-element ICP; Acid-base accounting & NAG (acid rock drainage) | Monitoring point / grid ref, Depth (cm), Setting | Samples in sealed bags; monitoring point and depth labelled. |
| Metallurgical testwork composite | Bottle roll cyanidation test; CIL / CIP leach test with carbon; Preg-robbing test (gold-rob test, PRI); Diagnostic leach (gold deportment); Cyanide & lime consumption (reagent optimisation); Gravity recoverable gold (GRG); Oxygen uptake rate test; Column / heap leach with agglomeration; Flotation test (rougher / cleaner kinetics); Intensive leach test (gravity concentrate); Comminution & abrasion (SMC, BWi, RWi, Ai); Mineralogy (XRD, QEMSCAN / MLA, gold deportment); Settling & rheology (thickener, flocculant); Cyanide-soluble gold (LeachWELL); Sulphur & carbon speciation (total / sulphide S, organic C); Deleterious & cyanicide elements (Cu, As, Sb, Hg…); Multi-element ICP; Particle size distribution; Specific gravity & bulk density | Testwork programme, Composite ID / lithology, Target grind P80 (µm), Mass supplied (kg) | Mass is enough for the tests requested (GRG needs 90 kg or more); composite sheet attached. |
| Assay pulp (check / umpire / re-assay) | Check / umpire assay (external lab); Gold by fire assay, AAS finish; Gold by fire assay, gravimetric finish (high grade); Multi-element ICP | Original sample ID, Original lab batch / job no. | Pulp envelopes match the list; original IDs not written on blind samples. |
| Other | Gold by fire assay, AAS finish; Multi-element ICP; Moisture content | — | Sample matches the description on the submission. |

Purposes: Exploration / resource definition; Grade control (ore / waste); Plant process control; Mine-to-mill reconciliation; Metallurgical testwork / process design; Bullion / export settlement; Environmental compliance; Health & safety / occupational hygiene; Quality control / check assay; Other.

## Routes

## Gold assay

### EXP-FA: Exploration fire assay (50 g, AAS finish)

Standard route for drill and surface samples: full preparation to a 50 g pulp, lead-collection fire assay, AAS finish. Range 0.005 to 10 g/t Au.

- **Test:** Gold by fire assay, AAS finish
- **Sample types:** RC chips (reverse circulation), Diamond drill core, Channel / grab / trench sample, ROM ore / stockpile, and any other type
- **Chosen first when the purpose is:** Exploration / resource definition, Mine-to-mill reconciliation, Quality control / check assay, Other
- **Results:** about 21.5 h after receipt
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
| 11 | QA/QC review | QA/QC | 1 h | Batch checked against the pass rules before release. |

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
- **Results:** about 13 h after receipt
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
| 9 | QA/QC review | QA/QC | 1 h | CRMs, blanks and duplicates near the cut-off grade checked. |

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
- **Results:** about 21.5 h after receipt
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
| 11 | QA/QC review | QA/QC | 1 h |  |

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
- **Results:** about 31.5 h after receipt
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
| 12 | QA/QC review | QA/QC | 1 h |  |

**QA/QC:** Per batch of up to 20 samples: 1 CRM and 1 blank. Passes when the CRM is within ±2 SD (2 to 3 SD is a warning, outside ±3 SD fails) and the blank is below 5× the detection limit (0.05 g/t Au). Screen mass balance loss under 2% and the two −75 µm assays within 10% are checked on each sample's results.

**Re-assay triggers**

- Screen loss above 2%: re-screen from the pulp
- Fine-fraction duplicates differ by more than 10%: repeat fine-fraction fusion

**Retention and disposal**

- Coarse and fine pulps: kept 12 months after results, then returned to geology
- Coarse reject: kept 3 months after results, then disposed

### AR-AU: Low-level gold by aqua regia / BLEG (soils, sediments)

Parts-per-billion gold for soil and stream-sediment geochemistry, from a large aqua regia digest or bulk cyanide leach (BLEG).

- **Test:** Low-level gold by aqua regia / BLEG (soils, sediments)
- **Sample types:** Soil / stream sediment (geochemistry), Environmental soil / sediment
- **Chosen first when the purpose is:** Exploration / resource definition
- **Results:** about 31.5 h after receipt
- **Reports:** Gold (ppb), DL 1, range to 10000
- **Lab batch:** Aqua regia gold batch for Au
- **Action limits:** Gold above 1000 ppb: repeat by fire assay

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Sorting & QC insertion | Intake | 0.5 h |  |
| 4 | Drying at 60 °C or below | Preparation | 12 h, round the clock |  |
| 5 | Sieve to −180 µm (−80 mesh) | Preparation | 4 h |  |
| 6 | Weighing 25–50 g | Analysis / test | 1 h |  |
| 7 | Aqua regia digest (or BLEG cyanide leach) | Analysis / test | 8 h | **Re-assays restart here.** |
| 8 | Au by ICP-MS or solvent-extraction AAS | Analysis / test | 4 h | Detection about 1 ppb Au. |
| 9 | QA/QC review | QA/QC | 1 h |  |

**QA/QC:** Per batch of up to 20 samples: 1 low-level CRM and 1 blank. Passes when the low-level CRM is within ±2 SD (2 to 3 SD is a warning, outside ±3 SD fails) and the blank is below 5× the detection limit (5 ppb Au). Field duplicates are reported as supplied.

**Re-assay triggers**

- Au above 1 g/t: repeat by fire assay
- Duplicates differ by more than 30% at low levels: repeat

**Retention and disposal**

- Sieved fraction: kept 12 months after results, then returned to exploration
- Oversize: kept 1 month after results, then disposed

### CHECK: Check / umpire assay (external lab)

A share of pulps re-assayed blind at an independent lab to prove the site lab has no bias, as resource reporting codes expect.

- **Test:** Check / umpire assay (external lab)
- **Sample types:** Assay pulp (check / umpire / re-assay), and any other type
- **Chosen first when the purpose is:** Quality control / check assay
- **Results:** about 10.4 days after receipt
- **Reports:** Gold, external lab (g/t), DL 0.005; Gold, original result (g/t), DL 0.005
- **Checks on each sample's results:** check assay differs from the original by more than ±10% (half absolute relative difference); the rule is that 90% of pairs agree hold the release (except those marked as reported only) until re-assayed or accepted by a lab supervisor with a reason
- **Lab batch:** none; checks run on each sample's own results

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Select pulps (5% of batch, all high grades) & renumber blind | Intake | 2 h | Original IDs replaced with blind numbers; CRMs inserted. |
| 4 | Dispatch to umpire lab with chain of custody | Preparation | 2 h | Waybill number recorded as the reference. |
| 5 | Umpire lab analysis | Analysis / test | 10 days, round the clock | Usually 5–10 days at the external lab. **Re-assays restart here.** |
| 6 | Compare with original results (RPD, HARD plot, bias) | Analysis / test | 2 h |  |
| 7 | QA/QC manager review | QA/QC | 2 h |  |

**QA/QC:** 90% of pairs within ±10% (half absolute relative difference); CRMs in the umpire batch pass.

**Re-assay triggers**

- Bias above 5% between labs: review the original batch and repeat
- Umpire CRMs fail: ask the umpire lab to repeat

**Retention and disposal**

- Pulp: kept 12 months after results, then kept in secure store

## Leach & recovery testwork

### CN-SOL: Cyanide-soluble gold (LeachWELL)

Accelerated cyanide leach of a large charge. Compared with fire assay it shows how much of the gold cyanide can recover.

- **Test:** Cyanide-soluble gold (LeachWELL)
- **Sample types:** Any type
- **Results:** about 2 days after receipt
- **Reports:** Cyanide-soluble gold (g/t), DL 0.01; Gold in residue (g/t), DL 0.01; Cyanide-soluble share (%), calculated from cyanide-soluble gold, gold in residue
- **Lab batch:** Cyanide-soluble gold batch for Au
- **Action limits:** Cyanide-soluble share below 50 %: flag as refractory; offer a diagnostic leach

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Sorting & QC insertion | Intake | 0.5 h |  |
| 4 | Drying at 105 °C | Preparation | 8 h, round the clock |  |
| 5 | Crushing to 2 mm | Preparation | 2 h |  |
| 6 | Pulverising to 80% passing 75 µm | Preparation | 2 h | 200 g kept for a fire assay head grade. |
| 7 | Weighing 500 g or 1 kg charge | Analysis / test | 1 h |  |
| 8 | Accelerated cyanide leach on rolls (12–24 h) | Analysis / test | 24 h, round the clock | LeachWELL tablet and NaCN at pH 10.5 to 11. **Re-assays restart here.** |
| 9 | Settle, filter & AAS on solution | Analysis / test | 3 h | DIBK extraction for low levels. |
| 10 | Residue fire assay | Analysis / test | 6 h | Closes the gold balance. |
| 11 | QA/QC review | QA/QC | 1 h |  |

**QA/QC:** Per batch of up to 20 samples: 1 pulp duplicate, 1 CRM with a certified cyanide-soluble value and 1 reagent blank. Passes when the CRM with a certified cyanide-soluble value is within ±2 SD (2 to 3 SD is a warning, outside ±3 SD fails), the blank is below 5× the detection limit (0.05 g/t Au) and the pulp duplicate agrees within 20% (relative difference, above 10× detection limit).

**Re-assay triggers**

- Cyanide-soluble Au below 50% of fire assay: flag as refractory and offer diagnostic leach
- Solution plus residue gold differs from head by more than 15%: repeat

**Retention and disposal**

- Leach solution: kept 1 month after results, then cyanide destroyed, disposed
- Pulp: kept 12 months after results, then disposed
- Residue: kept 3 months after results, then disposed

### BRT: Bottle roll cyanidation test (48 h)

Metallurgical leach test: grind to target size, leach with cyanide and follow gold dissolution over time to get recovery and reagent use.

- **Test:** Bottle roll cyanidation test
- **Sample types:** Metallurgical testwork composite, Diamond drill core, RC chips (reverse circulation), ROM ore / stockpile, Mill sample, and any other type
- **Chosen first when the purpose is:** Metallurgical testwork / process design
- **Results:** about 4.9 days after receipt
- **Reports:** Head grade (assayed) (g/t), DL 0.01; Head grade (calculated) (g/t), DL 0.01; Residue grade (g/t), DL 0.01; Gold recovery (%), calculated from head grade (calculated), residue grade; NaCN consumption (kg/t); Lime consumption (kg/t)
- **Checks on each sample's results:** calculated head is more than 10% from the assayed head hold the release until re-assayed or accepted by a lab supervisor with a reason
- **Lab batch:** none; checks run on each sample's own results
- **Action limits:** Gold recovery below 80 %: diagnostic leach recommended

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Composite log & head split | Intake | 2 h | Weighed, photographed and split into head, test charges and reserve. |
| 4 | Drying at 80 °C or below | Preparation | 12 h, round the clock | Low temperature so sulphides do not oxidise. |
| 5 | Stage crushing to 100% passing 2 mm | Preparation | 4 h |  |
| 6 | Rotary split 1 kg test charges | Preparation | 2 h |  |
| 7 | Grind calibration & grind to P80 75 µm | Preparation | 6 h | Rod mill grind-time curve; P80 confirmed by wet screen. |
| 8 | Head assays (Au duplicate, Ag, S, C, Cu) | Analysis / test | 12 h | Fire assay in duplicate; LECO S and C; ICP for cyanicides (Cu, As, Sb). |
| 9 | Pulp set-up: 40% solids, lime to pH 10.5, NaCN 500 ppm | Analysis / test | 2 h |  |
| 10 | Bottle roll leach, samples at 2, 4, 8, 24, 48 h | Analysis / test | 2 days, round the clock | Cyanide and lime topped up at each sample; DO recorded. **Re-assays restart here.** |
| 11 | Kinetic solution assays & reagent titrations | Analysis / test | 6 h | Au by AAS; free cyanide by AgNO₃ titration; lime consumption. |
| 12 | Filter, wash & dry residue | Preparation | 8 h |  |
| 13 | Residue fire assay in duplicate | Analysis / test | 6 h |  |
| 14 | Metallurgical balance & recovery | Analysis / test | 4 h | Calculated vs assayed head; extraction curve; NaCN and lime in kg/t. |
| 15 | Metallurgist review | QA/QC | 4 h |  |

**QA/QC:** Calculated head within ±10% of the assayed head; residue duplicates within 10%; a reference ore leached each campaign.

**Re-assay triggers**

- Calculated and assayed head more than 10% apart: repeat residue assay, then the leach
- Extraction below 80%: diagnostic leach recommended
- Organic carbon above 0.2% (preg-robbing): repeat as a CIL test

**Retention and disposal**

- Head reserve: kept 12 months after results, then returned to MET
- Leach residue: kept 6 months after results, then disposed
- Solutions: kept 1 month after results, then cyanide destroyed, disposed

### CIL-T: CIL / CIP leach test with carbon

Leach with activated carbon present, as in the plant. Used for preg-robbing ores and to size the carbon inventory.

- **Test:** CIL / CIP leach test with carbon
- **Sample types:** Metallurgical testwork composite, Diamond drill core, Mill sample, and any other type
- **Chosen first when the purpose is:** Metallurgical testwork / process design
- **Results:** about 3.6 days after receipt
- **Reports:** Head grade (assayed) (g/t), DL 0.01; Head grade (calculated: solution + carbon + residue) (g/t), DL 0.01; Residue grade (g/t), DL 0.01; Loaded carbon (g/t), DL 1; Gold recovery (%), calculated from head grade (calculated: solution + carbon + residue), residue grade; NaCN consumption (kg/t)
- **Checks on each sample's results:** gold balance is more than 10% from the head grade hold the release until re-assayed or accepted by a lab supervisor with a reason
- **Lab batch:** none; checks run on each sample's own results

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Composite log & head split | Intake | 2 h |  |
| 4 | Drying at 80 °C or below | Preparation | 12 h, round the clock |  |
| 5 | Stage crushing to 2 mm | Preparation | 4 h |  |
| 6 | Rotary split test charges | Preparation | 2 h |  |
| 7 | Grind to target P80 | Preparation | 6 h |  |
| 8 | Head assays (Au, Ag, S, organic C) | Analysis / test | 12 h |  |
| 9 | Carbon preparation (attritioned, −2.36 +1.18 mm) | Preparation | 4 h | Plant or fresh carbon at 20 g/L. |
| 10 | CIL leach 24 h with kinetic samples | Analysis / test | 24 h, round the clock | Solution sampled at 2, 4, 8 and 24 h; pH 10.5, NaCN 500 ppm. **Re-assays restart here.** |
| 11 | Solution, carbon & residue assays | Analysis / test | 12 h | Solution by AAS; carbon ashed then AAS; residue fire assay in duplicate. |
| 12 | Gold balance & carbon loading | Analysis / test | 4 h | Recovery to carbon, loading in g/t, preg-robbing compared with bottle roll. |
| 13 | Metallurgist review | QA/QC | 4 h |  |

**QA/QC:** Gold balance (solution + carbon + residue) within ±10% of head; residue duplicates within 10%.

**Re-assay triggers**

- Gold balance outside ±10%: repeat carbon and residue assays
- Carbon loading does not match solution loss: repeat the leach

**Retention and disposal**

- Loaded carbon: kept 3 months after results, then returned to gold room
- Residue: kept 6 months after results, then disposed
- Head reserve: kept 12 months after results, then returned to MET

### PRI: Preg-robbing test (gold-rob test)

Measures how much dissolved gold the ore itself takes back out of cyanide solution (carbonaceous matter, graphite, some clays). Decides between plain leach, CIL, blinding agents or roasting.

- **Test:** Preg-robbing test (gold-rob test, PRI)
- **Sample types:** Metallurgical testwork composite, Diamond drill core, RC chips (reverse circulation), Mill sample, Plant tails / CIL residue, and any other type
- **Chosen first when the purpose is:** Metallurgical testwork / process design
- **Results:** about 3 days after receipt
- **Reports:** Preg-robbing index (%); Blank spike recovery (%); Head grade (g/t), DL 0.01
- **Checks on each sample's results:** blank spike recovery outside 95–105% hold the release until re-assayed or accepted by a lab supervisor with a reason
- **Lab batch:** none; checks run on each sample's own results
- **Action limits:** Preg-robbing index above 10 %: moderate preg-robbing: recommend CIL or a blinding agent; Preg-robbing index above 50 %: severe preg-robbing: recommend roasting tests

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Sample log & head split | Intake | 1 h |  |
| 4 | Drying at 80 °C or below | Preparation | 12 h, round the clock | Low temperature so carbonaceous matter is not altered. |
| 5 | Pulverise to 80% passing 75 µm | Preparation | 2 h |  |
| 6 | Head assays: Au (fire assay), total & organic carbon (LECO) | Analysis / test | 12 h | Organic carbon is the main preg-robbing indicator. |
| 7 | Spiked-solution test: sample + gold-cyanide solution (2 mg/L Au) | Analysis / test | 6 h, round the clock | Pulp at 40% solids, NaCN 0.1%, pH 10.5, bottle rolled; a sample-free blank of the same solution runs alongside. **Re-assays restart here.** |
| 8 | Filter & solution Au by AAS | Analysis / test | 2 h | Spiked solution, blank and sample read together. |
| 9 | Paired leach: cyanide alone vs cyanide with carbon (24 h) | Analysis / test | 24 h, round the clock | Extra gold recovered with carbon present shows how much a plain leach loses to preg-robbing. |
| 10 | Residue fire assays | Analysis / test | 6 h |  |
| 11 | Preg-robbing index & classification | Analysis / test | 2 h | PRI = % of the spiked gold taken out of solution by the ore. |
| 12 | Metallurgist review | QA/QC | 4 h |  |

**QA/QC:** Blank solution recovers 95–105% of the spike; duplicate spike tests within 10%; organic carbon CRM each batch.

**Re-assay triggers**

- Blank recovery outside 95–105%: remake the spike solution and repeat
- Gold removed from solution above 10% (moderate) or 50% (severe): recommend CIL, a blinding agent (kerosene / diesel) or roasting tests
- Duplicate PRI differs by more than 10%: repeat

**Retention and disposal**

- Pulp: kept 12 months after results, then returned to MET
- Solutions: kept 1 month after results, then cyanide destroyed, disposed

### DIAG: Diagnostic (sequential) leach

Strips gold step by step to show where it is locked: free-milling, in carbonates, in sulphides, in carbonaceous matter or in silicates.

- **Test:** Diagnostic leach (gold deportment)
- **Sample types:** Metallurgical testwork composite, Diamond drill core, Plant tails / CIL residue, and any other type
- **Chosen first when the purpose is:** Metallurgical testwork / process design, Plant process control
- **Results:** about 6.8 days after receipt
- **Reports:** Head grade (g/t), DL 0.01; Free / cyanidable gold (g/t), DL 0.01; Gold in carbonates (HCl) (g/t), DL 0.01; Gold in sulphides (HNO₃) (g/t), DL 0.01; Gold with carbonaceous matter (g/t), DL 0.01; Gold locked in silicates (g/t), DL 0.01
- **Checks on each sample's results:** stages add up to more than 10% away from the head grade hold the release until re-assayed or accepted by a lab supervisor with a reason
- **Lab batch:** none; checks run on each sample's own results

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Sample log & head split | Intake | 2 h |  |
| 4 | Drying at 80 °C or below | Preparation | 12 h, round the clock |  |
| 5 | Pulverise to P80 75 µm | Preparation | 3 h |  |
| 6 | Head assay (duplicate fire assay, S, C) | Analysis / test | 12 h |  |
| 7 | Stage 1: direct cyanidation (free gold) | Analysis / test | 24 h, round the clock | **Re-assays restart here.** |
| 8 | Stage 2: HCl digest + cyanidation (carbonates, pyrrhotite) | Analysis / test | 24 h, round the clock |  |
| 9 | Stage 3: H₂SO₄ digest + cyanidation (base-metal sulphides) | Analysis / test | 24 h, round the clock |  |
| 10 | Stage 4: HNO₃ digest + cyanidation (pyrite, arsenopyrite) | Analysis / test | 24 h, round the clock |  |
| 11 | Stage 5: roast or acetonitrile + cyanidation (carbonaceous) | Analysis / test | 24 h, round the clock |  |
| 12 | Final residue fire assay (silicate-locked gold) | Analysis / test | 6 h |  |
| 13 | Gold deportment calculation | Analysis / test | 4 h |  |
| 14 | Metallurgist review | QA/QC | 4 h |  |

**QA/QC:** Sum of all stages within ±10% of the head grade.

**Re-assay triggers**

- Stage sum outside ±10% of head: repeat from stage 1
- More than 30% of gold locked in sulphides: recommend flotation, fine grinding or oxidation testwork

**Retention and disposal**

- Head reserve: kept 12 months after results, then returned to MET
- Stage residues: kept 3 months after results, then disposed
- Solutions: kept 1 month after results, then cyanide destroyed, disposed

### REAGENT: Cyanide & lime consumption (reagent optimisation)

Finds the cyanide dose and pH that give the best recovery for the least reagent, and the kg/t of NaCN and lime the plant should budget.

- **Test:** Cyanide & lime consumption (reagent optimisation)
- **Sample types:** Metallurgical testwork composite, Diamond drill core, ROM ore / stockpile, Mill sample, and any other type
- **Chosen first when the purpose is:** Metallurgical testwork / process design, Plant process control
- **Results:** about 3.1 days after receipt
- **Reports:** NaCN consumption (kg/t); Lime consumption (kg/t); Gold recovery (%); Head grade (assayed) (g/t), DL 0.01; Head grade (calculated) (g/t), DL 0.01
- **Checks on each sample's results:** calculated head is more than 10% from the assayed head hold the release until re-assayed or accepted by a lab supervisor with a reason
- **Lab batch:** none; checks run on each sample's own results
- **Action limits:** NaCN consumption above 1.5 kg/t: run the deleterious elements test for cyanicides

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Sample log & split | Intake | 2 h |  |
| 4 | Drying at 80 °C or below | Preparation | 12 h, round the clock |  |
| 5 | Crushing to 2 mm | Preparation | 2 h |  |
| 6 | Rotary split: four or more 1 kg charges | Preparation | 2 h |  |
| 7 | Grind to plant P80 | Preparation | 6 h |  |
| 8 | Lime demand curve (pH 10.0, 10.5, 11.0) | Analysis / test | 4 h | Lime added in steps to reach each pH; kg/t CaO recorded. |
| 9 | Leach series at 250, 500 and 1,000 ppm NaCN | Analysis / test | 2 h |  |
| 10 | Parallel bottle rolls, 24 h, with cyanide & lime top-ups | Analysis / test | 24 h, round the clock | Free cyanide and pH checked at 2, 4, 8 and 24 h and topped up; every addition logged. **Re-assays restart here.** |
| 11 | Titrations & solution Au | Analysis / test | 6 h | Free cyanide by AgNO₃ titration; Au by AAS on each sample. |
| 12 | Residue fire assays | Analysis / test | 6 h |  |
| 13 | Consumption (kg/t NaCN, CaO) vs recovery; optimum dose | Analysis / test | 4 h |  |
| 14 | Metallurgist review | QA/QC | 4 h |  |

**QA/QC:** Calculated heads within ±10% of the assayed head across the series; titration standard checked daily.

**Re-assay triggers**

- Cyanide consumption above 1.5 kg/t: run the deleterious elements test for cyanicides (Cu, sulphides)
- Recovery still rising at the highest dose: extend the leach and repeat the best dose

**Retention and disposal**

- Residues: kept 6 months after results, then disposed
- Solutions: kept 1 month after results, then cyanide destroyed, disposed
- Head reserve: kept 12 months after results, then returned to MET

### O2-UPT: Oxygen uptake rate test

How fast the slurry consumes dissolved oxygen (sulphides, pyrrhotite). Used to size pre-aeration and oxygen or peroxide addition so the leach is not oxygen-starved.

- **Test:** Oxygen uptake rate test
- **Sample types:** Metallurgical testwork composite, Mill sample, CIL / CIP tank slurry, Diamond drill core, and any other type
- **Chosen first when the purpose is:** Metallurgical testwork / process design, Plant process control
- **Results:** about 2 days after receipt
- **Reports:** Oxygen uptake rate (mg/L/min); Dissolved oxygen at saturation (mg/L); Slurry temperature (°C)
- **Lab batch:** none; checks run on each sample's own results
- **Action limits:** Oxygen uptake rate above 0.1 mg/L/min: recommend pre-aeration or oxygen / peroxide addition

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Grind & make slurry at plant density | Preparation | 6 h | Fresh or plant slurry preferred; kept sealed so it does not oxidise in transit. |
| 4 | Aerate to dissolved-oxygen saturation | Analysis / test | 1 h |  |
| 5 | Air off: log DO decay every 30 s down to 2 mg/L | Analysis / test | 2 h | Uptake rate in mg/L/min from the slope. **Re-assays restart here.** |
| 6 | Repeat after 1, 2, 4, 8 and 24 h of aeration | Analysis / test | 24 h, round the clock | Shows how quickly demand falls with pre-aeration. |
| 7 | Optional: repeat with lead nitrate or peroxide | Analysis / test | 8 h | Tests whether additives lower oxygen demand. |
| 8 | Oxygen demand & aeration / O₂ addition sizing | Analysis / test | 2 h |  |
| 9 | Metallurgist review | QA/QC | 4 h |  |

**QA/QC:** DO probe calibrated before each test (air saturation and zero); temperature recorded with each reading.

**Re-assay triggers**

- Uptake above 0.1 mg/L/min after 8 h: recommend pre-aeration or oxygen / peroxide addition
- Probe drift above 5%: recalibrate and repeat

**Retention and disposal**

- Slurry: kept 1 month after results, then disposed

### COLUMN: Column leach (heap leach) with agglomeration

Simulates a heap: crushed ore is agglomerated with cement or lime, loaded in a column and irrigated with cyanide for weeks. Gives heap recovery, leach time and reagent and binder use.

- **Test:** Column / heap leach with agglomeration
- **Sample types:** ROM ore / stockpile, Metallurgical testwork composite, Diamond drill core, and any other type
- **Chosen first when the purpose is:** Metallurgical testwork / process design
- **Results:** about 73.5 days after receipt
- **Reports:** Head grade (assayed) (g/t), DL 0.01; Head grade (calculated) (g/t), DL 0.01; Gold recovery (%); NaCN consumption (kg/t); Cement for agglomeration (kg/t); Leach time (days)
- **Checks on each sample's results:** calculated head is more than 10% from the assayed head hold the release until re-assayed or accepted by a lab supervisor with a reason
- **Lab batch:** none; checks run on each sample's own results

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Sample log, photos & mass check (100 kg or more) | Intake | 2 h |  |
| 4 | Crush to column size (e.g. 100% passing 25 mm) | Preparation | 8 h |  |
| 5 | Head & size-by-size assays, moisture | Analysis / test | 2 days | Fire assay by size fraction shows where the gold sits. |
| 6 | Agglomeration with cement / lime & curing (72 h) | Preparation | 3.3 days, round the clock | Binder dose in kg/t recorded; agglomerate strength checked. |
| 7 | Percolation & slump test | Analysis / test | 24 h, round the clock | Confirms solution flows through without ponding or collapse. |
| 8 | Load column | Preparation | 4 h |  |
| 9 | Cyanide irrigation & daily pregnant-solution assays (60 days) | Analysis / test | 60 days, round the clock | About 10 L/h/m² irrigation; daily Au, free CN, pH and volume. **Re-assays restart here.** |
| 10 | Rinse & drain | Analysis / test | 3 days, round the clock |  |
| 11 | Unload, dry & split residue | Preparation | 24 h, round the clock |  |
| 12 | Residue size-by-size assays | Analysis / test | 2 days |  |
| 13 | Metallurgical balance, recovery curve, reagent & binder use | Analysis / test | 8 h |  |
| 14 | Metallurgist review | QA/QC | 4 h |  |

**QA/QC:** Calculated head within ±10% of the assayed head; solution balance (in, out, evaporation) closes within 5%.

**Re-assay triggers**

- Percolation fails or the column slumps more than 10%: increase binder and repeat agglomeration
- Recovery still rising at day 60: extend the leach
- Head balance outside ±10%: repeat residue assays

**Retention and disposal**

- Residue: kept 6 months after results, then disposed
- Head reserve: kept 12 months after results, then returned to MET
- Solutions: kept 1 month after results, then cyanide destroyed, disposed

### ILR: Intensive leach test (gravity concentrate)

High-strength cyanide leach of gravity concentrate, as in the plant's intensive leach reactor, to confirm recovery and leach time.

- **Test:** Intensive leach test (gravity concentrate)
- **Sample types:** Gravity / flotation concentrate, Metallurgical testwork composite
- **Chosen first when the purpose is:** Metallurgical testwork / process design, Plant process control
- **Results:** about 2.2 days after receipt
- **Reports:** Concentrate grade (g/t), DL 0.1; Calculated head (solution + residue) (g/t), DL 0.1; Intensive leach recovery (%), calculated from calculated head (solution + residue), residue grade; Residue grade (g/t), DL 0.1
- **Checks on each sample's results:** gold balance is more than 5% from the head grade hold the release until re-assayed or accepted by a lab supervisor with a reason
- **Lab batch:** none; checks run on each sample's own results
- **Action limits:** Intensive leach recovery below 95 %: check for coarse gold; repeat with a longer time or finer grind

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Witnessed weighing & split under custody | Intake | 1 h | Two-person rule; seal numbers recorded. |
| 4 | Drying | Preparation | 6 h, round the clock |  |
| 5 | Head assay of concentrate (fire assay to extinction) | Analysis / test | 8 h |  |
| 6 | Intensive cyanide leach (1–2% NaCN, leach aid, 24 h) | Analysis / test | 24 h, round the clock | Oxidant (LeachAid / peroxide) as in the plant; samples at 2, 4, 8, 16 and 24 h. **Re-assays restart here.** |
| 7 | Solution Au & Ag by AAS (diluted) | Analysis / test | 4 h |  |
| 8 | Residue fire assay | Analysis / test | 6 h |  |
| 9 | Recovery & kinetics | Analysis / test | 2 h |  |
| 10 | QA/QC review | QA/QC | 1 h |  |

**QA/QC:** Gold balance within ±5% of head; two-person custody throughout.

**Re-assay triggers**

- Recovery below 95%: check for coarse gold, repeat with longer time or finer grind
- Balance outside ±5%: repeat residue assay

**Retention and disposal**

- Leach residue: kept 3 months after results, then returned to gold room
- Solutions: kept 1 month after results, then returned to gold room

## Gravity & flotation

### GRG: Gravity recoverable gold (3-stage Knelson)

Three stages of grinding and centrifugal concentration show how much gold a gravity circuit could recover. Needs 90 kg or more.

- **Test:** Gravity recoverable gold (GRG)
- **Sample types:** Metallurgical testwork composite, Diamond drill core, ROM ore / stockpile, Mill sample
- **Chosen first when the purpose is:** Metallurgical testwork / process design
- **Results:** about 3.8 days after receipt
- **Reports:** Gravity recoverable gold (%); Head grade (assayed) (g/t), DL 0.01; Head grade (calculated) (g/t), DL 0.01
- **Checks on each sample's results:** calculated head is more than 15% from the assayed head hold the release until re-assayed or accepted by a lab supervisor with a reason
- **Lab batch:** none; checks run on each sample's own results
- **Action limits:** Gravity recoverable gold above 30 %: report recommends a gravity circuit study

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Sample log, mass check (90 kg+) & split | Intake | 2 h |  |
| 4 | Drying | Preparation | 24 h, round the clock |  |
| 5 | Crushing to 100% passing 850 µm | Preparation | 8 h |  |
| 6 | Stage 1 Knelson pass at 850 µm | Analysis / test | 4 h | Concentrate collected; tails sub-sampled. |
| 7 | Grind to P50 about 250 µm & stage 2 Knelson | Analysis / test | 6 h |  |
| 8 | Grind to P80 75 µm & stage 3 Knelson | Analysis / test | 6 h |  |
| 9 | Concentrate cleaning (panning / Mozley table) | Analysis / test | 6 h | Concentrates sealed between steps under gold-room custody. |
| 10 | Concentrate & tails assays | Analysis / test | 24 h | Concentrates fire assayed to extinction; tails screened and assayed size by size. **Re-assays restart here.** |
| 11 | GRG calculation & gold by size | Analysis / test | 6 h |  |
| 12 | Metallurgist review | QA/QC | 4 h |  |

**QA/QC:** Calculated head within ±15% of the assayed head; concentrates handled under gold-room custody.

**Re-assay triggers**

- Calculated and assayed head more than 15% apart: repeat tails assays
- GRG above 30%: report recommends a gravity circuit study

**Retention and disposal**

- Gravity concentrates: kept 6 months after results, then returned to gold room
- Tails: kept 6 months after results, then disposed

### FLOT: Flotation test (rougher & cleaner kinetics)

Recovers gold-bearing sulphides to a concentrate. Used for refractory or sulphide ores and to test re-treating tails.

- **Test:** Flotation test (rougher / cleaner kinetics)
- **Sample types:** Metallurgical testwork composite, Diamond drill core, Mill sample, Plant tails / CIL residue
- **Chosen first when the purpose is:** Metallurgical testwork / process design
- **Results:** about 3 days after receipt
- **Reports:** Gold recovery to concentrate (%), calculated from mass pull, concentrate grade, head grade (calculated: concentrate + tails); Concentrate grade (g/t), DL 0.05; Mass pull (%); Tails grade (g/t), DL 0.01; Head grade (assayed) (g/t), DL 0.01; Head grade (calculated: concentrate + tails) (g/t), DL 0.01, calculated from mass pull, concentrate grade, tails grade
- **Checks on each sample's results:** calculated head is more than 10% from the assayed head hold the release until re-assayed or accepted by a lab supervisor with a reason
- **Lab batch:** none; checks run on each sample's own results
- **Action limits:** Gold recovery to concentrate below 80 %: repeat at a finer grind or with a different collector

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Sample log & split | Intake | 2 h |  |
| 4 | Drying at 80 °C or below | Preparation | 12 h, round the clock |  |
| 5 | Crushing to 2 mm | Preparation | 2 h |  |
| 6 | Rotary split 1 kg charges | Preparation | 2 h |  |
| 7 | Grind to target P80 in a lab rod mill | Preparation | 4 h |  |
| 8 | Conditioning: pH, activator (CuSO₄), collector (PAX), frother | Analysis / test | 1 h |  |
| 9 | Rougher flotation, concentrates at 1, 3, 7 and 15 min | Analysis / test | 2 h | Mass pull recorded for each concentrate. **Re-assays restart here.** |
| 10 | Cleaner flotation (on request) | Analysis / test | 2 h |  |
| 11 | Filter & dry products | Preparation | 12 h, round the clock |  |
| 12 | Concentrate & tails assays: Au (FA), S (LECO), As | Analysis / test | 24 h |  |
| 13 | Recovery, grade and mass-pull curves | Analysis / test | 4 h |  |
| 14 | Metallurgist review | QA/QC | 4 h |  |

**QA/QC:** Calculated head within ±10% of the assayed head; product masses within 2% of feed.

**Re-assay triggers**

- Mass loss above 2%: repeat
- Gold recovery below 80% with sulphide left in tails: repeat at a finer grind or with a different collector

**Retention and disposal**

- Flotation products: kept 6 months after results, then disposed
- Head reserve: kept 12 months after results, then returned to MET

## Physical & comminution

### COMMIN: Comminution & abrasion tests

Hardness and abrasiveness for mill design and liner wear: SMC drop-weight, Bond rod and ball mill work indices, Bond abrasion index.

- **Test:** Comminution & abrasion (SMC, BWi, RWi, Ai)
- **Sample types:** Diamond drill core, Metallurgical testwork composite, ROM ore / stockpile
- **Chosen first when the purpose is:** Metallurgical testwork / process design
- **Results:** about 3.6 days after receipt
- **Reports:** Bond ball mill work index (kWh/t); Bond rod mill work index (kWh/t), optional; Abrasion index (g); SMC A×b, optional
- **Lab batch:** none; checks run on each sample's own results

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Core log, photographs & mass check | Intake | 2 h | Whole core preferred; lengths and lithology checked against the request. |
| 4 | Air drying at 40 °C or below (no oven) | Preparation | 24 h, round the clock | Oven drying weakens rock and biases hardness. |
| 5 | Select & cut SMC pieces (−31.5 +26.5 mm) | Preparation | 4 h |  |
| 6 | SMC drop-weight test (Axb, DWi) | Analysis / test | 8 h | **Re-assays restart here.** |
| 7 | Crush & split for Bond tests | Preparation | 4 h |  |
| 8 | Bond abrasion index (Ai) | Analysis / test | 6 h | −19 +12.5 mm feed. |
| 9 | Bond rod mill work index (RWi) | Analysis / test | 12 h | Closing screen 1.18 mm. |
| 10 | Bond ball mill work index (BWi) | Analysis / test | 16 h | Closing screen 106 µm; run until 3 cycles are stable. |
| 11 | Specific gravity | Analysis / test | 2 h |  |
| 12 | Report Axb, DWi, RWi, BWi, Ai & SG | Analysis / test | 4 h |  |
| 13 | Metallurgist review | QA/QC | 4 h |  |

**QA/QC:** Reference ore run through the Bond mill each campaign; BWi accepted only after 3 cycles at equilibrium (±3%).

**Re-assay triggers**

- BWi not stable after 3 cycles: repeat
- Not enough competent pieces for SMC: request more core

**Retention and disposal**

- Test products & rejects: kept 12 months after results, then disposed
- Unused core: kept 1 month after results, then returned to core shed

### DENSITY: Specific gravity & bulk density

Bulk density of core for tonnage in the resource model (water immersion, wax-coated if porous) and pulp SG by pycnometer for metallurgical calculations.

- **Test:** Specific gravity & bulk density
- **Sample types:** Diamond drill core, ROM ore / stockpile, Metallurgical testwork composite, RC chips (reverse circulation), Gravity / flotation concentrate, and any other type
- **Chosen first when the purpose is:** Exploration / resource definition, Metallurgical testwork / process design, Mine-to-mill reconciliation
- **Results:** about 19 h after receipt
- **Reports:** Specific gravity; Dry bulk density (t/m³), optional
- **Lab batch:** Density batch for specific gravity

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Log core pieces & weigh | Intake | 1 h | Competent pieces 10–20 cm long. |
| 4 | Drying at 105 °C | Preparation | 8 h, round the clock |  |
| 5 | Wax coating of porous pieces | Preparation | 2 h |  |
| 6 | Weigh in air & in water (Archimedes) | Analysis / test | 2 h | Bulk density = mass in air ÷ (mass in air − mass in water), corrected for wax. **Re-assays restart here.** |
| 7 | Pulp SG by gas or water pycnometer | Analysis / test | 4 h | On a pulverised split. |
| 8 | QA/QC review | QA/QC | 1 h |  |

**QA/QC:** Per batch of up to 20 samples: 1 duplicate and 1 reference density block. Passes when the reference density block is within ±1% of the certified value and the duplicate agrees within 2% (relative difference).

**Re-assay triggers**

- Duplicate differs by more than 2%: repeat
- Bulk density above pulp SG: check the wax correction and repeat

**Retention and disposal**

- Core pieces: kept 1 month after results, then returned to core shed
- Pulp: kept 3 months after results, then disposed

### PSD: Particle size distribution (sieve analysis)

Grind control and testwork sizing: % passing 75 µm and P80 from a √2 sieve series.

- **Test:** Particle size distribution
- **Sample types:** Any type
- **Results:** about 19 h after receipt
- **Reports:** P80 (µm); Passing 75 µm (%); Sieve loss (% of feed)
- **Checks on each sample's results:** sieve loss over 1% of the feed mass hold the release until re-assayed or accepted by a lab supervisor with a reason
- **Lab batch:** none; checks run on each sample's own results

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Wet mass & % solids | Analysis / test | 1 h |  |
| 4 | Drying at 105 °C | Preparation | 8 h, round the clock |  |
| 5 | Split a representative 500 g | Preparation | 1 h |  |
| 6 | Wet screening at 38 µm (desliming) | Analysis / test | 3 h | **Re-assays restart here.** |
| 7 | Dry sieving, 2 mm to 38 µm | Analysis / test | 3 h | 15 minutes on the shaker; each fraction weighed. |
| 8 | P80 & % passing calculation | Analysis / test | 1 h |  |
| 9 | Mass balance check | QA/QC | 1 h |  |

**QA/QC:** Sieve loss under 1% of feed mass; sieves inspected for damage monthly.

**Re-assay triggers**

- Sieve loss above 1%: repeat
- Gold by size requested: each fraction fire assayed (adds assay time)

**Retention and disposal**

- Size fractions: kept 1 month after results, then disposed

### MOIST: Moisture content

Wet and dry mass to give % moisture for tonnage, reconciliation and shipping.

- **Test:** Moisture content
- **Sample types:** Any type
- **Results:** about 15 h after receipt
- **Reports:** Moisture (%)
- **Lab batch:** Moisture batch for moisture

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Wet weighing in tared tray | Analysis / test | 0.5 h | Weighed as soon as the sealed bag is opened. **Re-assays restart here.** |
| 4 | Oven drying at 105 °C to constant mass | Analysis / test | 12 h, round the clock |  |
| 5 | Dry weighing & moisture calculation | Analysis / test | 0.5 h |  |
| 6 | QA/QC check | QA/QC | 1 h |  |

**QA/QC:** Per batch of up to 10 samples: 1 duplicate. Passes when the duplicate agrees within 0.5% (absolute).

**Re-assay triggers**

- Bag not sealed or dried out in transit: reported as indicative only
- Duplicate differs by more than 0.5%: repeat

**Retention and disposal**

- Dried sample: kept 1 month after results, then disposed

### SETTLE: Settling & rheology (thickener, flocculant)

Flocculant choice and dose, settling rate and underflow density for thickeners, and slurry yield stress and viscosity for pumping and tailings deposition.

- **Test:** Settling & rheology (thickener, flocculant)
- **Sample types:** Mill sample, Plant tails / CIL residue, TSF sample, Metallurgical testwork composite, CIL / CIP tank slurry
- **Chosen first when the purpose is:** Metallurgical testwork / process design, Plant process control
- **Results:** about 36 h after receipt
- **Reports:** Settling rate (m/h); Underflow density (% solids); Flocculant dose (g/t); Yield stress (Pa), optional; Settling rate, repeat cylinder (m/h)
- **Checks on each sample's results:** repeat cylinder differs by more than 10% hold the release until re-assayed or accepted by a lab supervisor with a reason
- **Lab batch:** none; checks run on each sample's own results

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Slurry log, % solids & pH | Intake | 1 h |  |
| 4 | Flocculant screening (type and dose) | Analysis / test | 4 h | Several flocculants at 10–40 g/t in 1 L cylinders. |
| 5 | Cylinder settling: rate, underflow density, supernatant clarity | Analysis / test | 8 h | **Re-assays restart here.** |
| 6 | Dynamic (bench thickener) test | Analysis / test | 8 h | On request; gives thickener area and underflow density. |
| 7 | Rheology: yield stress (vane) & viscosity vs % solids | Analysis / test | 8 h |  |
| 8 | Thickener sizing & flocculant consumption | Analysis / test | 2 h |  |
| 9 | Metallurgist review | QA/QC | 4 h |  |

**QA/QC:** Viscometer checked with a standard oil; repeat cylinder at the chosen dose agrees within 10%.

**Re-assay triggers**

- Supernatant cloudy at every dose: repeat with a coagulant
- Yield stress rises sharply near the target density: test lower densities

**Retention and disposal**

- Slurry: kept 1 month after results, then disposed

## Chemistry & mineralogy

### ICP: Multi-element ICP (four-acid / aqua regia)

48-element package for geochemistry, cyanicides (Cu, As, Sb, Bi, Te) and deleterious elements.

- **Test:** Multi-element ICP
- **Sample types:** Any type
- **Results:** about 30.5 h after receipt
- **Reports:** Copper (ppm), DL 1, range to 10000; Silver (ppm), DL 0.5, range to 100; Arsenic (ppm), DL 5, range to 10000; Antimony (ppm), DL 5, range to 10000; Zinc (ppm), DL 1, range to 10000; Lead (ppm), DL 2, range to 10000; Iron (%), DL 0.01, range to 50; Sulphur (%), DL 0.01, range to 10
- **Lab batch:** ICP batch for Cu, Ag, As, Sb, Zn, Pb, Fe, S

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Sorting & QC insertion | Intake | 0.5 h |  |
| 4 | Drying at 105 °C | Preparation | 8 h, round the clock | 60 °C or below if mercury or arsenic matter. |
| 5 | Crushing to 2 mm | Preparation | 2 h |  |
| 6 | Riffle split | Preparation | 1 h |  |
| 7 | Pulverising to 80% passing 75 µm | Preparation | 2 h | Chrome-steel bowls add Cr and Fe; noted on the report. |
| 8 | Weighing 0.25 g | Analysis / test | 1 h |  |
| 9 | Four-acid digestion (HF-HNO₃-HClO₄-HCl) | Analysis / test | 8 h | Aqua regia on request for a partial digest. **Re-assays restart here.** |
| 10 | ICP-OES / ICP-MS reading | Analysis / test | 6 h |  |
| 11 | QA/QC review | QA/QC | 1 h |  |

**QA/QC:** Per 40-position batch, checking Cu, Ag, As, Sb, Zn, Pb, Fe and S: 1 replicate, 2 CRMs and 1 blank. Passes when CRMs are within ±10% of the certified value, the blank is below 5× the detection limit and the replicate agrees within 20% (relative difference, above 10× detection limit), for each of them.

**Re-assay triggers**

- Cu, As, Zn or S above the upper limit: ore-grade dilution re-run
- CRM outside limits for key elements: repeat the batch

**Retention and disposal**

- Pulp: kept 12 months after results, then returned to geology
- Coarse reject: kept 3 months after results, then disposed

### DELET: Deleterious & cyanicide elements (Cu, As, Sb, Hg…)

Elements that consume cyanide, lock up gold or need special handling: copper (especially cyanide-soluble), arsenic, antimony, bismuth, tellurium, mercury.

- **Test:** Deleterious & cyanicide elements (Cu, As, Sb, Hg…)
- **Sample types:** Any type
- **Chosen first when the purpose is:** Metallurgical testwork / process design, Plant process control
- **Results:** about 41.5 h after receipt
- **Reports:** Copper (ppm), DL 1; Cyanide-soluble copper (ppm), DL 1; Arsenic (ppm), DL 5; Antimony (ppm), DL 5; Mercury (ppm), DL 0.01
- **Checks on each sample's results:** cyanide-soluble copper is higher than total copper hold the release until re-assayed or accepted by a lab supervisor with a reason
- **Lab batch:** Multi-element batch for Cu, cyanide-soluble copper, As, Sb, Hg
- **Action limits:** Cyanide-soluble copper above 200 ppm: flag high cyanide consumption to the plant; Arsenic above 10000 ppm: flag possible refractory ore; offer a diagnostic leach; Antimony above 1000 ppm: flag possible refractory ore; offer a diagnostic leach; Mercury above 10 ppm: flag for gold-room mercury controls

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Sorting & QC insertion | Intake | 0.5 h |  |
| 4 | Drying at 60 °C or below | Preparation | 12 h, round the clock | Low temperature so mercury is not lost. |
| 5 | Crush & pulverise to 80% passing 75 µm | Preparation | 4 h |  |
| 6 | Weighing | Analysis / test | 1 h |  |
| 7 | Aqua regia digest & ICP-OES: Cu, As, Sb, Bi, Te, Pb, Zn, Ni | Analysis / test | 8 h | **Re-assays restart here.** |
| 8 | Mercury by cold-vapour AAS | Analysis / test | 6 h | Separate low-temperature digest. |
| 9 | Cyanide-soluble copper | Analysis / test | 8 h | The copper that will consume cyanide in the leach. |
| 10 | QA/QC review | QA/QC | 1 h |  |

**QA/QC:** Per batch of up to 20 samples, checking Cu, cyanide-soluble copper, As, Sb and Hg: 1 duplicate, 2 CRMs and 1 blank. Passes when CRMs are within ±10% of the certified value, the blank is below 5× the detection limit and the duplicate agrees within 20% (relative difference, above 10× detection limit), for each of them.

**Re-assay triggers**

- Cyanide-soluble Cu above 200 ppm: flag high cyanide consumption to the plant
- As above 1% or Sb above 0.1%: flag possible refractory ore and offer diagnostic leach
- Hg above 10 ppm: flag for gold-room mercury controls

**Retention and disposal**

- Pulp: kept 12 months after results, then returned to MET
- Coarse reject: kept 3 months after results, then disposed

### LECO: Sulphur & carbon (LECO), sulphide S, organic C

Sulphur and carbon speciation to judge refractory and preg-robbing behaviour, and for acid-rock-drainage screening.

- **Test:** Sulphur & carbon speciation (total / sulphide S, organic C)
- **Sample types:** Any type
- **Results:** about 28.5 h after receipt
- **Reports:** Total sulphur (%), DL 0.01, range to 20; Sulphide sulphur (%), DL 0.01, range to 20; Total carbon (%), DL 0.01; Organic carbon (%), DL 0.01
- **Checks on each sample's results:** sulphide sulphur is higher than total sulphur; organic carbon is higher than total carbon hold the release until re-assayed or accepted by a lab supervisor with a reason
- **Lab batch:** LECO batch for S, sulphide sulphur, C, organic carbon
- **Action limits:** Organic carbon above 0.2 %: flag preg-robbing; offer a CIL test

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Sorting & QC insertion | Intake | 0.5 h |  |
| 4 | Drying at 80 °C or below | Preparation | 12 h, round the clock |  |
| 5 | Crush & pulverise to 80% passing 75 µm | Preparation | 4 h |  |
| 6 | Weighing 0.1–0.2 g | Analysis / test | 1 h |  |
| 7 | Total S & C by combustion infrared | Analysis / test | 3 h | **Re-assays restart here.** |
| 8 | Sulphide S and organic C (acid-washed residue) | Analysis / test | 6 h | HCl wash removes carbonate carbon; residue burnt again for organic carbon. |
| 9 | QA/QC review | QA/QC | 1 h |  |

**QA/QC:** Per batch of up to 20 samples, checking S, sulphide sulphur, C and organic carbon: 1 duplicate and 1 LECO CRM. Passes when the LECO CRM is within ±2 SD (2 to 3 SD is a warning, outside ±3 SD fails) and the duplicate agrees within 5% (relative difference, above 10× detection limit), for each of them.

**Re-assay triggers**

- Organic carbon above 0.2%: flag preg-robbing and offer a CIL test
- S above the calibration range: smaller weight and repeat

**Retention and disposal**

- Pulp: kept 12 months after results, then disposed

### MINERAL: Mineralogy (XRD, QEMSCAN / MLA, gold deportment)

What the ore is made of and how the gold occurs: grain size, what it is locked in, how much is exposed. Often done by a specialist lab; record the dispatch with "Sent to external lab" if so.

- **Test:** Mineralogy (XRD, QEMSCAN / MLA, gold deportment)
- **Sample types:** Metallurgical testwork composite, Diamond drill core, Gravity / flotation concentrate, Plant tails / CIL residue, and any other type
- **Chosen first when the purpose is:** Metallurgical testwork / process design, Exploration / resource definition
- **Results:** about 9.3 days after receipt
- **Reports:** Mineralogy summary; Free and liberated gold (% of gold), optional; Gold calculated from mineralogy (g/t), DL 0.01, optional; Gold by chemical assay (g/t), DL 0.01, optional
- **Checks on each sample's results:** gold from mineralogy and chemical assay differ by more than 10% hold the release until re-assayed or accepted by a lab supervisor with a reason
- **Lab batch:** none; checks run on each sample's own results

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Sample log & sub-sample selection | Intake | 2 h |  |
| 4 | Polished sections, resin blocks & XRD pulps | Preparation | 24 h, round the clock |  |
| 5 | XRD bulk mineralogy | Analysis / test | 24 h |  |
| 6 | QEMSCAN / MLA modal mineralogy & liberation | Analysis / test | 3 days | **Re-assays restart here.** |
| 7 | Gold deportment search (grain size, associations, exposure) | Analysis / test | 3 days | Bright-phase search for gold grains; free, locked and attached gold. |
| 8 | Optical microscopy / SEM check | Analysis / test | 16 h |  |
| 9 | Mineralogy report | Analysis / test | 8 h |  |
| 10 | Mineralogist review | QA/QC | 4 h |  |

**QA/QC:** XRD standard each run; assays calculated from mineralogy reconcile with chemical assays within 10%.

**Re-assay triggers**

- Calculated assays more than 10% off chemical assays: re-check the sections
- Too few gold grains for a reliable result: prepare more sections

**Retention and disposal**

- Polished sections & blocks: kept 12 months after results, then archived in the mineralogy library
- Pulp: kept 12 months after results, then returned to MET

## Plant & gold room

### PLT-HEAD: Mill sample: shift head grade & grind (fast track)

Mill samples (mill feed, cyclone overflow, leach feed) for daily metallurgical accounting. Fast track with forced-air drying and a 30 g charge, so results reach the plant within the next shift: about 7 hours after the lab receives the sample.

- **Test:** Mill sample assay (head grade, grind, moisture), Gold by fire assay, AAS finish
- **Sample types:** Mill sample, ROM ore / stockpile
- **Chosen first when the purpose is:** Plant process control, Mine-to-mill reconciliation
- **Results:** about 7.25 h after receipt
- **Reports:** Head grade (g/t), DL 0.01, range to 50; Grind, passing 75 µm (%), optional; Screen analysis, % retained, optional; Moisture (%), optional
- **Lab batch:** Plant shift batch (Mill samples) for Au

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Wet weight for moisture | Analysis / test | 0.25 h | Weighed on arrival; moisture by difference after drying. |
| 4 | Grind check: % passing 75 µm | Analysis / test | 1 h | Wet screen on a split taken before drying. |
| 5 | Fast drying (forced-air oven, 105 °C) | Preparation | 1.5 h, round the clock | Thin layer on trays; microwave drying where available. |
| 6 | Pulverise to 80% passing 75 µm | Preparation | 0.75 h | Single-stage pulverising of the dried split. |
| 7 | Fire assay, 30 g charge | Analysis / test | 1.75 h | Lead-collection fusion and cupellation in the plant priority furnace slot. **Re-assays restart here.** |
| 8 | AAS finish | Analysis / test | 0.5 h |  |
| 9 | QA/QC review | QA/QC | 0.5 h | Plant CRM and a duplicate each shift. |

**QA/QC:** Per shift batch: 1 duplicate, 1 plant CRM and 1 blank. Passes when the plant CRM is within ±2 SD, the blank is below 5× the detection limit (0.05 g/t Au) and the duplicate agrees within 10% (relative difference, above 10× detection limit).

**Re-assay triggers**

- Head grade more than 15% away from the rolling 7-day plant average or the expected feed grade: repeat the assay
- CRM fails: repeat the shift set

**Retention and disposal**

- Pulp: kept 3 months after results, then disposed
- Reject: kept 1 week after results, then disposed

### CCD-SVY: CCD sample survey (solution gold & wash efficiency)

Counter-current decantation thickener samples: density, dissolved gold in each stage and gold in the final underflow solids, to show how much soluble gold the washing circuit loses.

- **Test:** CCD survey (solution gold, wash efficiency)
- **Sample types:** CCD sample
- **Chosen first when the purpose is:** Plant process control, Mine-to-mill reconciliation
- **Results:** about 18 h after receipt
- **Reports:** Sampling point: one of Thickener feed, Intermediate thickener, Final underflow; Solution gold (mg/L), DL 0.005; Solids gold (g/t), DL 0.01; Free cyanide (mg/L), optional; Wash efficiency (from the survey sheet) (%), optional
- **Lab batches:** Solution AAS run for solution gold; Plant tails batch for Au
- **Action limits:** Solution gold above 0.05 mg/L (Final underflow): alert the plant metallurgist (soluble loss); Wash efficiency (from the survey sheet) below 98 %: check the wash ratio and flocculant; repeat the survey

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Pulp density & % solids per thickener | Analysis / test | 1 h | Marcy scale, done on arrival. |
| 4 | Filter: separate solution from solids | Preparation | 1 h |  |
| 5 | Solution Au by AAS for each stage | Analysis / test | 2 h | DIBK extraction for low levels. **Re-assays restart here.** |
| 6 | Free cyanide & pH | Analysis / test | 1 h |  |
| 7 | Wash & dry underflow solids | Preparation | 4 h |  |
| 8 | Pulverise | Preparation | 2 h |  |
| 9 | Underflow solids Au fire assay | Analysis / test | 4 h |  |
| 10 | Wash efficiency & soluble gold loss per stage | Analysis / test | 1 h | Soluble loss = solution Au × solution tonnes in the final underflow. |
| 11 | QA/QC review | QA/QC | 1 h |  |

**QA/QC:** Solution gold: Per run of up to 20 readings: 2 duplicates, 2 calibration check standards and 1 blank. Passes when calibration check standards recover 90–110%, the blank is below 5× the detection limit (0.025 mg/L Au) and duplicates agree within 10% (relative difference, above 10× detection limit). Solids gold: Per batch of up to 30 samples: 1 residue duplicate, 1 low-grade CRM and 1 blank. Passes when the low-grade CRM is within ±2 SD (2 to 3 SD is a warning, outside ±3 SD fails), the blank is below 5× the detection limit (0.05 g/t Au) and the residue duplicate agrees within 20% (relative difference, above 5× detection limit).

**Re-assay triggers**

- Final underflow solution above 0.05 mg/L Au: alert the plant metallurgist (soluble loss)
- Wash efficiency below 98%: check wash ratio and flocculant, repeat the survey
- Underflow density more than 5% off target: notify the plant

**Retention and disposal**

- Solutions: kept 1 week after results, then cyanide destroyed, disposed
- Solids: kept 1 month after results, then disposed

### PLT-TAIL: Plant tails / CIL residue (solid & solution loss)

Measures gold lost to final tails: undissolved gold in the solids and dissolved gold in the solution.

- **Test:** Tails / residue gold loss (solid & solution)
- **Sample types:** Plant tails / CIL residue
- **Chosen first when the purpose is:** Plant process control, Mine-to-mill reconciliation
- **Results:** about 17 h after receipt
- **Reports:** Solid tails gold (g/t), DL 0.01; Solution tails gold (mg/L), DL 0.005
- **Lab batches:** Plant tails batch for Au; Solution AAS run for solution tails gold
- **Action limits:** Solid tails gold above 0.2 g/t: alert the plant metallurgist and repeat the residue assay; Solution tails gold above 0.02 mg/L: alert the plant metallurgist and repeat

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Pressure filter: solution separated from solids | Preparation | 1 h |  |
| 4 | Solution Au by AAS (DIBK extraction) | Analysis / test | 2 h | Detection 0.005 mg/L. |
| 5 | Wash & dry residue | Preparation | 4 h |  |
| 6 | Pulverise | Preparation | 2 h |  |
| 7 | Residue fire assay, 50 g in duplicate | Analysis / test | 4 h | Low-level method, detection 0.01 g/t. **Re-assays restart here.** |
| 8 | AAS finish | Analysis / test | 1 h |  |
| 9 | Soluble & insoluble loss, plant recovery | Analysis / test | 1 h |  |
| 10 | QA/QC review | QA/QC | 1 h |  |

**QA/QC:** Solid tails gold: Per batch of up to 30 samples: 1 residue duplicate, 1 low-grade CRM and 1 blank. Passes when the low-grade CRM is within ±2 SD (2 to 3 SD is a warning, outside ±3 SD fails), the blank is below 5× the detection limit (0.05 g/t Au) and the residue duplicate agrees within 20% (relative difference, above 5× detection limit). Solution tails gold: Per run of up to 20 readings: 2 duplicates, 2 calibration check standards and 1 blank. Passes when calibration check standards recover 90–110%, the blank is below 5× the detection limit (0.025 mg/L Au) and duplicates agree within 10% (relative difference, above 10× detection limit).

**Re-assay triggers**

- Residue above 0.20 g/t or solution above 0.02 mg/L: alert the plant metallurgist and repeat
- Duplicates differ by more than 20%: repeat fusion

**Retention and disposal**

- Residue pulp: kept 3 months after results, then disposed
- Solution: kept 1 week after results, then cyanide destroyed, disposed

### CIL-SVY: CIL / CIP tank survey

Tank-by-tank profile of solution gold, carbon loading, cyanide and pH to check adsorption efficiency.

- **Test:** CIL / CIP tank survey
- **Sample types:** CIL / CIP tank slurry
- **Chosen first when the purpose is:** Plant process control
- **Results:** about 19 h after receipt
- **Reports:** Sampling point: one of Leach tank, Adsorption tank, Last tank; Solution gold (mg/L), DL 0.005; Carbon gold (g/t), DL 1; Carbon concentration (g/L); Free cyanide (mg/L); pH; Slurry density (% solids)
- **Lab batches:** Solution AAS run for solution gold; Carbon assay batch for carbon gold
- **Action limits:** Solution gold above 0.02 mg/L (Last tank): alert the plant

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Pulp density, pH & dissolved oxygen | Analysis / test | 0.5 h | Marcy scale % solids, done on arrival. |
| 4 | Free cyanide titration (AgNO₃) | Analysis / test | 0.5 h |  |
| 5 | Separate solution, carbon & solids | Preparation | 1 h | Carbon screened out at 600 µm; solution filtered. |
| 6 | Solution Au by AAS | Analysis / test | 2 h | **Re-assays restart here.** |
| 7 | Carbon Au loading (ash, aqua regia, AAS) | Analysis / test | 6 h |  |
| 8 | Solids Au fire assay | Analysis / test | 6 h |  |
| 9 | Tank profile & adsorption efficiency | Analysis / test | 1 h |  |
| 10 | QA/QC review | QA/QC | 1 h |  |

**QA/QC:** Solution gold: Per run of up to 20 readings: 2 duplicates, 2 calibration check standards and 1 blank. Passes when calibration check standards recover 90–110%, the blank is below 5× the detection limit (0.025 mg/L Au) and duplicates agree within 10% (relative difference, above 10× detection limit). Carbon gold: Per batch of up to 20 samples: 1 duplicate and 1 carbon CRM. Passes when the carbon CRM is within ±2 SD (2 to 3 SD is a warning, outside ±3 SD fails) and the duplicate agrees within 10% (relative difference, above 10× detection limit).

**Re-assay triggers**

- Carbon loading more than 20% off the last survey: repeat
- Last tank solution above 0.02 mg/L Au: alert the plant

**Retention and disposal**

- Solutions: kept 1 week after results, then cyanide destroyed, disposed
- Carbon: kept 1 week after results, then returned to plant
- Solids: kept 1 month after results, then disposed

### CARBON: Carbon assay & activity

Gold and silver loading on loaded, eluted or regenerated carbon, and activity to decide on regeneration.

- **Test:** Carbon loading & activity
- **Sample types:** Carbon
- **Chosen first when the purpose is:** Plant process control
- **Results:** about 24 h after receipt
- **Reports:** Carbon from: one of Loaded carbon, Eluted carbon, Regenerated carbon, Fresh carbon, Tank carbon; Gold loading (g/t), DL 1; Activity (relative to fresh carbon) (%); Fines (%), optional
- **Lab batch:** Carbon assay batch for gold loading
- **Action limits:** Gold loading above 100 g/t (Eluted carbon): repeat and notify the elution operator; Activity (relative to fresh carbon) below 50 %: recommend carbon regeneration

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Wash & screen (fines and grit removed) | Preparation | 1 h | Sealed bag opened under gold-room custody. |
| 4 | Drying at 105 °C | Preparation | 6 h, round the clock |  |
| 5 | Riffle split | Preparation | 1 h |  |
| 6 | Au & Ag loading (ashed at 700 °C, aqua regia, AAS) | Analysis / test | 8 h | **Re-assays restart here.** |
| 7 | Carbon activity (rate test against fresh carbon) | Analysis / test | 6 h |  |
| 8 | QA/QC review | QA/QC | 1 h |  |

**QA/QC:** Per batch of up to 20 samples: 1 duplicate and 1 carbon CRM. Passes when the carbon CRM is within ±2 SD (2 to 3 SD is a warning, outside ±3 SD fails) and the duplicate agrees within 10% (relative difference, above 10× detection limit).

**Re-assay triggers**

- Eluted carbon above 100 g/t Au: repeat and notify the elution operator
- Activity below 50% of fresh carbon: recommend regeneration

**Retention and disposal**

- Carbon sample: kept 1 month after results, then returned to gold room

### ELUATE: Elution sample (eluate, strip & electrowinning solutions)

Gold solutions from the elution circuit: pregnant eluate, end-of-strip eluate and electrowinning cell feed and discharge. High-value, so handled under gold-room custody.

- **Test:** Elution solution assay (eluate, strip & electrowinning solutions)
- **Sample types:** Elution sample
- **Chosen first when the purpose is:** Plant process control, Bullion / export settlement
- **Results:** about 6.5 h after receipt
- **Reports:** Sampling point: one of Pregnant eluate, End of strip, Electrowinning feed, Electrowinning discharge; Gold (mg/L), DL 0.01, range to 2000; Silver (mg/L), DL 0.01; Copper (mg/L), DL 0.1, optional; NaCN (g/L), optional; NaOH (g/L), optional
- **Lab batch:** Eluate AAS run for Au
- **Action limits:** Gold above 5 mg/L (End of strip): notify the elution operator (incomplete strip); Gold above 5 mg/L (Electrowinning discharge): check the electrowinning cells and current

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Custody check & log | Intake | 0.5 h | Sealed bottle; elution batch and bed volume recorded. |
| 4 | Filter 0.45 µm | Preparation | 0.5 h | Removes carbon fines that would add gold. |
| 5 | Dilution by weight (pregnant eluate) | Preparation | 0.5 h | Pregnant eluate can be hundreds of mg/L; diluted into the AAS range. |
| 6 | Au, Ag, Cu by AAS with high-grade standards | Analysis / test | 2 h | Standards matched to the caustic-cyanide eluate. **Re-assays restart here.** |
| 7 | Caustic (NaOH) & free cyanide titration | Analysis / test | 1 h | Checks eluant strength. |
| 8 | Strip profile / electrowinning efficiency | Analysis / test | 0.5 h | Gold stripped per bed volume, or cell feed vs. discharge. |
| 9 | QA/QC review | QA/QC | 0.5 h |  |

**QA/QC:** Per run of up to 20 readings: 1 duplicate dilution, 1 high-grade solution standard and 1 blank. Passes when the high-grade solution standard recovers 95–105%, the blank is below 5× the detection limit (0.05 mg/L Au) and the duplicate dilution agrees within 2% (relative difference, above 10× detection limit).

**Re-assay triggers**

- End-of-strip eluate above 5 mg/L Au: notify the elution operator (incomplete strip)
- Electrowinning cell discharge above 5 mg/L Au: check cells and current
- Duplicate dilutions differ by more than 2%: repeat

**Retention and disposal**

- Eluate: kept 1 month after results, then returned to the elution circuit / gold room

### C-STRIP: Carbon strip test (lab elution of loaded carbon)

Strips gold from plant loaded carbon under plant conditions (AARL or Zadra) to check elution efficiency and troubleshoot high barren carbon.

- **Test:** Carbon strip test (lab elution of loaded carbon)
- **Sample types:** Carbon
- **Chosen first when the purpose is:** Plant process control, Metallurgical testwork / process design
- **Results:** about 36 h after receipt
- **Reports:** Loaded carbon gold (g/t), DL 1; Barren carbon gold (g/t), DL 1; Strip efficiency (%), calculated from loaded carbon gold, barren carbon gold; Calculated loaded carbon (eluate + barren) (g/t), DL 1
- **Checks on each sample's results:** gold balance (eluate + barren carbon) is more than 10% from the loaded carbon hold the release until re-assayed or accepted by a lab supervisor with a reason
- **Lab batch:** none; checks run on each sample's own results
- **Action limits:** Barren carbon gold above 100 g/t: check temperature and caustic strength; repeat

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Screen & wash loaded carbon | Preparation | 1 h | Opened under gold-room custody. |
| 4 | Loaded carbon assay (Au, Ag, Cu) | Analysis / test | 8 h |  |
| 5 | Acid wash (3% HCl) & rinse | Analysis / test | 3 h |  |
| 6 | Pressure elution at 110–120 °C, eluate sampled each bed volume | Analysis / test | 8 h | NaOH and NaCN strength matched to the plant. **Re-assays restart here.** |
| 7 | Eluate Au, Ag, Cu by AAS | Analysis / test | 4 h |  |
| 8 | Eluted (barren) carbon assay | Analysis / test | 8 h |  |
| 9 | Elution efficiency & strip profile | Analysis / test | 2 h |  |
| 10 | QA/QC review | QA/QC | 1 h |  |

**QA/QC:** Gold balance (eluate + barren carbon) within ±10% of the loaded carbon.

**Re-assay triggers**

- Barren carbon above 100 g/t Au: check temperature and caustic strength, repeat
- Balance outside ±10%: repeat carbon assays

**Retention and disposal**

- Carbon: kept 1 month after results, then returned to gold room
- Eluate: kept 1 month after results, then returned to gold room

### SOLN: Process solution assay

Leach tank, barren and process-water solutions: gold, silver, copper and cyanide. Elution samples have their own route (ELUATE).

- **Test:** Process solution assay (Au, Ag, Cu, cyanide)
- **Sample types:** Process solution (leach, barren, process water), CIL / CIP tank slurry
- **Results:** about 9.5 h after receipt
- **Reports:** Sampling point: one of Pregnant solution, Barren solution, Process water, Other; Gold (mg/L), DL 0.005; Silver (mg/L), DL 0.01, optional; Copper (mg/L), DL 0.1, optional; Free cyanide (mg/L); WAD cyanide (mg/L), optional; pH
- **Lab batch:** Solution AAS run for Au
- **Action limits:** Gold above 0.02 mg/L (Barren solution): alert elution and the plant

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Filter 0.45 µm | Preparation | 0.5 h |  |
| 4 | Free cyanide (AgNO₃ titration) & pH | Analysis / test | 1 h |  |
| 5 | Au, Ag, Cu by AAS | Analysis / test | 3 h | DIBK extraction for barren solutions below 0.05 mg/L. **Re-assays restart here.** |
| 6 | WAD cyanide (on request) | Analysis / test | 3 h |  |
| 7 | QA/QC review | QA/QC | 1 h | Standards, spikes and duplicates. |

**QA/QC:** Per run of up to 20 readings: 2 duplicates, 2 calibration check standards and 1 blank. Passes when calibration check standards recover 90–110%, the blank is below 5× the detection limit (0.025 mg/L Au) and duplicates agree within 10% (relative difference, above 10× detection limit).

**Re-assay triggers**

- Barren above 0.02 mg/L Au: alert elution / plant
- Spike recovery outside 90–110%: repeat

**Retention and disposal**

- Solution: kept 1 month after results, then cyanide destroyed, disposed

### CONC: Concentrate assay (gravity / flotation)

High-grade concentrates handled under gold-room security and assayed in triplicate by gravimetric fire assay.

- **Test:** Concentrate assay
- **Sample types:** Gravity / flotation concentrate
- **Results:** about 29.5 h after receipt
- **Reports:** Gold (g/t), DL 0.05; Silver (g/t), DL 0.5, optional; Mercury (ppm), DL 0.1; Arsenic (%), DL 0.01; Sulphur (%), DL 0.01, optional
- **Lab batches:** Concentrate batch (triplicates) for Au; Multi-element batch for Hg, As

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Witnessed wet weight & moisture | Analysis / test | 0.5 h | Seal numbers recorded. |
| 4 | Drying at 105 °C | Preparation | 8 h, round the clock |  |
| 5 | Homogenise & split under custody | Preparation | 2 h |  |
| 6 | Pulverise (screen first if coarse gold) | Preparation | 2 h |  |
| 7 | Reduced-charge fire assay in triplicate | Analysis / test | 6 h | **Re-assays restart here.** |
| 8 | Gravimetric finish | Analysis / test | 3 h |  |
| 9 | Ag, S, As, Cu (ICP / LECO) | Analysis / test | 6 h | Payable and penalty elements. |
| 10 | QA/QC review | QA/QC | 1 h |  |

**QA/QC:** Gold: Per batch of up to 10 samples: every sample in triplicate and 1 high-grade CRM. Passes when the high-grade CRM is within ±2 SD (2 to 3 SD is a warning, outside ±3 SD fails) and triplicates agree within 5% (relative difference, above 10× detection limit). Mercury and arsenic: Per batch of up to 20 samples, checking Hg and As: 1 duplicate, 2 CRMs and 1 blank. Passes when CRMs are within ±10% of the certified value, the blank is below 5× the detection limit and the duplicate agrees within 20% (relative difference, above 10× detection limit), for each of them. Two-person custody for all handling.

**Re-assay triggers**

- Triplicates differ by more than 5%: screen fire assay of the whole concentrate
- Mass at receipt differs from dispatch: hold and report to security

**Retention and disposal**

- Concentrate remainder: returned to gold room when results are released
- Pulp: kept 12 months after results, then kept in secure store

### BULLION: Bullion / doré fineness

Fineness of doré bars for export and settlement by fire assay with proof gold. The bar stays under escort throughout.

- **Test:** Bullion fineness (doré)
- **Sample types:** Bullion
- **Chosen first when the purpose is:** Bullion / export settlement
- **Results:** about 17.5 h after receipt
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
| 9 | QA/QC review | QA/QC | 1 h |  |
| 10 | Fineness certificate signed | QA/QC | 1 h | Signed by the lab manager. |

**QA/QC:** Per batch of up to 6 bars: every bar in duplicate and 1 proof gold. Passes when the proof gold is within 0.5 ‰ of the certified value and duplicates agree within 0.5 ‰ (absolute). Top and bottom within 2 parts per thousand is checked on each bar's results.

**Re-assay triggers**

- Duplicates differ by more than 0.5‰: repeat
- Top and bottom differ by more than 2‰: bar not homogeneous, re-melt and re-sample

**Retention and disposal**

- Doré bar: returned to the gold room vault the same day
- Cornets & drillings: kept 12 months after results, then kept in secure store

## Environment & cyanide

### TSF-CHAR: TSF sample (tailings characterisation)

Spigot, beach, pond and seepage samples: residual gold, cyanide for Cyanide Code compliance, sulphur and metals.

- **Test:** TSF sample characterisation (Au, CN, S, metals)
- **Sample types:** TSF sample, Plant tails / CIL residue
- **Chosen first when the purpose is:** Environmental compliance, Plant process control, Mine-to-mill reconciliation
- **Results:** about 32 h after receipt
- **Reports:** WAD cyanide (mg/L), DL 0.01; Solution gold (mg/L), DL 0.005; Solids gold (g/t), DL 0.01; pH; Total sulphur (%), DL 0.01, optional
- **Lab batches:** Cyanide batch for WAD cyanide; Solution AAS run for solution gold; Plant tails batch for Au
- **Action limits:** WAD cyanide above 50 mg/L: alert Environment immediately

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Wet mass, density & % solids | Analysis / test | 1 h |  |
| 4 | Decant / filter solution | Preparation | 1 h | Cyanide aliquot preserved with NaOH to pH above 12 straight away. |
| 5 | Solution: WAD & free CN, pH, EC, Au | Analysis / test | 4 h | **Re-assays restart here.** |
| 6 | Drying at 105 °C | Preparation | 8 h, round the clock |  |
| 7 | Pulverise | Preparation | 2 h |  |
| 8 | Solids Au fire assay | Analysis / test | 6 h |  |
| 9 | Total S & C (LECO) and ICP metals (As, Cu) | Analysis / test | 8 h |  |
| 10 | QA/QC review | QA/QC | 1 h |  |

**QA/QC:** WAD cyanide: Per batch of up to 20 samples: 2 duplicates and 1 cyanide check standard. Passes when the cyanide check standard recovers 90–110% and duplicates agree within 10% (relative difference, above 10× detection limit). Solution gold: Per run of up to 20 readings: 2 duplicates, 2 calibration check standards and 1 blank. Passes when calibration check standards recover 90–110%, the blank is below 5× the detection limit (0.025 mg/L Au) and duplicates agree within 10% (relative difference, above 10× detection limit). Solids gold: Per batch of up to 30 samples: 1 residue duplicate, 1 low-grade CRM and 1 blank. Passes when the low-grade CRM is within ±2 SD (2 to 3 SD is a warning, outside ±3 SD fails), the blank is below 5× the detection limit (0.05 g/t Au) and the residue duplicate agrees within 20% (relative difference, above 5× detection limit). Field blanks are reported as supplied.

**Re-assay triggers**

- WAD cyanide above 50 mg/L at discharge or in the pond: alert Environment immediately
- Solids Au more than 20% above plant tails grade: repeat

**Retention and disposal**

- Solids: kept 3 months after results, then disposed
- Solutions: kept 1 month after results, then cyanide destroyed, disposed

### CN-SPEC: Cyanide speciation (free, WAD, total, SCN)

All the cyanide forms that matter for the plant and for Cyanide Code compliance: free, weak-acid dissociable (WAD), total, thiocyanate and cyanate, plus the metals that carry them.

- **Test:** Cyanide speciation (free, WAD, total, SCN)
- **Sample types:** Process solution (leach, barren, process water), TSF sample, Environmental water (surface, ground, discharge), Plant tails / CIL residue, CIL / CIP tank slurry
- **Chosen first when the purpose is:** Environmental compliance, Plant process control, Health & safety / occupational hygiene
- **Results:** about 19 h after receipt
- **Reports:** Free cyanide (mg/L), DL 0.01; WAD cyanide (mg/L), DL 0.01; Total cyanide (mg/L), DL 0.01; Thiocyanate (mg/L), DL 0.1; Cyanate (mg/L), DL 0.5, optional
- **Checks on each sample's results:** free cyanide is higher than WAD cyanide; WAD cyanide is higher than total cyanide hold the release until re-assayed or accepted by a lab supervisor with a reason
- **Lab batch:** Cyanide speciation batch for free cyanide, WAD cyanide, total cyanide, thiocyanate
- **Action limits:** WAD cyanide above 50 mg/L: alert Environment and the plant immediately

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Preservation & holding-time check | Intake | 0.5 h | NaOH to pH above 12, cool and dark; free CN within 24 h, others within 14 days. |
| 4 | Filter 0.45 µm | Preparation | 0.5 h |  |
| 5 | Free cyanide (AgNO₃ titration or ion-selective electrode) | Analysis / test | 1 h | **Re-assays restart here.** |
| 6 | WAD cyanide (pH 4.5 distillation or flow injection) | Analysis / test | 4 h | The form the Cyanide Code limits to 50 mg/L at TSF discharge. |
| 7 | Total cyanide (strong-acid distillation) | Analysis / test | 4 h | Includes iron cyanide complexes. |
| 8 | Thiocyanate & cyanate | Analysis / test | 4 h |  |
| 9 | Cu, Fe, Zn in solution (AAS / ICP) | Analysis / test | 3 h | Metal-cyanide complexes that carry WAD cyanide. |
| 10 | QA/QC review | QA/QC | 1 h | Standards, spikes and duplicates. |

**QA/QC:** Per batch of up to 20 samples, checking free cyanide, WAD cyanide, total cyanide and thiocyanate: 2 duplicates and 1 spike. Passes when the spike recovers 85–115% and duplicates agree within 10% (relative difference, above 10× detection limit), for each of them. Free ≤ WAD ≤ total is checked on every sample's results.

**Re-assay triggers**

- WAD cyanide above 50 mg/L at TSF discharge: alert Environment and the plant immediately
- Free above WAD or WAD above total: repeat
- Holding time exceeded: report as indicative

**Retention and disposal**

- Solution: kept 1 month after results, then cyanide destroyed, disposed

### DETOX: Cyanide destruction (detox) test

SO₂/air or peroxide treatment of tails slurry at several doses to find the reagent use that brings WAD cyanide below the discharge target.

- **Test:** Cyanide destruction (detox) test
- **Sample types:** Plant tails / CIL residue, TSF sample, CIL / CIP tank slurry, Process solution (leach, barren, process water)
- **Chosen first when the purpose is:** Environmental compliance, Plant process control
- **Results:** about 23 h after receipt
- **Reports:** WAD cyanide before (mg/L), DL 0.01; WAD cyanide after (mg/L), DL 0.01; WAD cyanide after, repeat at the chosen dose (mg/L), DL 0.01; Reagent dose (g per g WAD CN); Copper (catalyst) (mg/L), optional
- **Checks on each sample's results:** repeat at the chosen dose differs by more than 20% hold the release until re-assayed or accepted by a lab supervisor with a reason
- **Lab batch:** none; checks run on each sample's own results

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Slurry log: WAD CN, Cu & pH baseline | Intake | 3 h |  |
| 4 | Reactor set-up at plant density & temperature | Preparation | 1 h |  |
| 5 | SO₂/air (or peroxide) runs at several reagent doses | Analysis / test | 8 h | Copper sulphate catalyst; pH 8–9 held with lime; samples every 15–30 min. **Re-assays restart here.** |
| 6 | WAD & free cyanide on each sample | Analysis / test | 6 h |  |
| 7 | Reagent dose for the WAD target (below 50 mg/L) | Analysis / test | 2 h |  |
| 8 | Metallurgist review | QA/QC | 2 h |  |

**QA/QC:** WAD cyanide standard each run; the chosen dose repeated to confirm.

**Re-assay triggers**

- Target not reached at the highest dose: increase copper catalyst or residence time and repeat

**Retention and disposal**

- Treated slurry: kept 1 week after results, then disposed

### ABA: Acid-base accounting & NAG (acid rock drainage)

Predicts whether waste rock or tailings will generate acid: sulphide sulphur, neutralising capacity and net acid generation.

- **Test:** Acid-base accounting & NAG (acid rock drainage)
- **Sample types:** Waste rock / overburden (acid rock drainage), TSF sample, Diamond drill core, RC chips (reverse circulation), Environmental soil / sediment, and any other type
- **Chosen first when the purpose is:** Environmental compliance
- **Results:** about 2.5 days after receipt
- **Reports:** Neutralisation potential (kg CaCO₃/t); Acid potential (kg CaCO₃/t); Net neutralisation potential (NP − AP) (kg CaCO₃/t), calculated from neutralisation potential, acid potential; NAG pH
- **Lab batch:** ARD batch for neutralisation potential
- **Action limits:** NAG pH below 4.5: potentially acid-forming: notify Environment for waste-dump placement

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Sorting & QC insertion | Intake | 0.5 h |  |
| 4 | Drying at 40 °C or below | Preparation | 12 h, round the clock |  |
| 5 | Crush & pulverise | Preparation | 4 h |  |
| 6 | Paste pH & EC | Analysis / test | 2 h |  |
| 7 | Total & sulphide sulphur (LECO) | Analysis / test | 6 h | Maximum potential acidity from sulphide sulphur. |
| 8 | Acid neutralising capacity (Sobek titration) | Analysis / test | 8 h | **Re-assays restart here.** |
| 9 | Net acid generation test (NAG pH) | Analysis / test | 24 h, round the clock | Peroxide oxidation, then titration. |
| 10 | NAPP & classification (PAF / NAF / uncertain) | Analysis / test | 2 h |  |
| 11 | QA/QC review | QA/QC | 1 h |  |

**QA/QC:** Per batch of up to 20 samples: 1 duplicate and 1 ARD reference material. Passes when the ARD reference material is within ±10% of the certified value and the duplicate agrees within 10% (relative difference, above 10× detection limit).

**Re-assay triggers**

- NAPP and NAG disagree (uncertain): run kinetic column testing
- Potentially acid-forming: notify Environment for waste-dump placement

**Retention and disposal**

- Pulp: kept 12 months after results, then disposed

### ENV-W: Environmental water quality

Surface, ground and discharge water against permit limits: cyanide, metals, pH, solids and anions.

- **Test:** Water quality (CN, metals, pH, solids)
- **Sample types:** Environmental water (surface, ground, discharge), Process solution (leach, barren, process water), TSF sample
- **Chosen first when the purpose is:** Environmental compliance, Health & safety / occupational hygiene
- **Results:** about 31.5 h after receipt
- **Reports:** pH; Conductivity (µS/cm); Suspended solids (mg/L), DL 1; WAD cyanide (mg/L), DL 0.005; Free cyanide (mg/L), DL 0.005, optional; Arsenic (mg/L), DL 0.001; Mercury (mg/L), DL 0.0001; Copper (mg/L), DL 0.001; Iron (mg/L), DL 0.01, optional
- **Lab batch:** Environmental water batch for WAD cyanide, As, Hg, Cu
- **Action limits (permit values are examples):** WAD cyanide above 0.5 mg/L (permit): re-analyse and notify Environment the same day; Arsenic above 0.1 mg/L (permit): re-analyse and notify Environment the same day; Mercury above 0.002 mg/L (permit): re-analyse and notify Environment the same day; Copper above 0.3 mg/L (permit): re-analyse and notify Environment the same day; pH below 6 (permit): re-analyse and notify Environment the same day; pH above 9 (permit): re-analyse and notify Environment the same day; Suspended solids above 50 mg/L (permit): re-analyse and notify Environment the same day

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Preservation & holding-time check | Intake | 0.5 h | Cooler at 6 °C or below; CN bottle at pH above 12 (NaOH); metals bottle HNO₃ to pH below 2. |
| 4 | pH, EC, TDS & turbidity | Analysis / test | 1 h |  |
| 5 | Free & WAD cyanide (distillation, colorimetric) | Analysis / test | 6 h | Holding time 14 days. **Re-assays restart here.** |
| 6 | Dissolved metals by ICP-MS (As, Hg, Pb, Cd, Cu, Zn, Fe, Mn) | Analysis / test | 8 h | Filtered 0.45 µm before acidifying. |
| 7 | Sulphate, chloride, nitrate, ammonia | Analysis / test | 6 h |  |
| 8 | Total suspended solids | Analysis / test | 6 h |  |
| 9 | QA/QC review | QA/QC | 2 h | Field and trip blanks, duplicate, spike. |
| 10 | Comparison with permit limits | QA/QC | 1 h | Exceedances flagged on the report. |

**QA/QC:** Per batch of up to 20 samples, checking WAD cyanide, As, Hg and Cu: 1 laboratory duplicate, 2 spike or check standards and 1 method blank. Passes when spike or check standards recover 85–115%, the blank is below 5× the detection limit and the laboratory duplicate agrees within 20% (relative difference, above 5× detection limit), for each of them. Field blank, trip blank and field duplicate per sampling round, reported as supplied.

**Re-assay triggers**

- Any result above the permit limit: re-analyse and notify Environment the same day
- Holding time exceeded: reported as indicative; re-sampling requested
- Spike recovery outside 85–115%: repeat

**Retention and disposal**

- Water samples: kept 1 month after results, then neutralised and disposed

### ENV-S: Environmental soil / sediment

Soil and stream sediment for contamination monitoring and closure: metals, mercury, arsenic, cyanide and pH.

- **Test:** Soil / sediment (metals, Hg, As, CN)
- **Sample types:** Environmental soil / sediment
- **Chosen first when the purpose is:** Environmental compliance, Health & safety / occupational hygiene
- **Results:** about 3.2 days after receipt
- **Reports:** Arsenic (mg/kg), DL 1; Mercury (mg/kg), DL 0.01; Lead (mg/kg), DL 1; Copper (mg/kg), DL 1; Total cyanide (mg/kg), DL 0.5; pH
- **Lab batch:** Soil batch for As, Hg, Pb, Cu
- **Action limits (permit values are examples):** Arsenic above 20 mg/kg (permit): re-analyse and notify Environment; Mercury above 1 mg/kg (permit): re-analyse and notify Environment; Lead above 400 mg/kg (permit): re-analyse and notify Environment; Copper above 100 mg/kg (permit): re-analyse and notify Environment

| # | Step | Phase | Time allowed | Method and checks |
|---|---|---|---|---|
| 3 | Air drying at 40 °C or below | Preparation | 2 days, round the clock | No oven, so mercury stays in the sample. |
| 4 | Disaggregate & sieve to −2 mm (and −180 µm) | Preparation | 4 h |  |
| 5 | Split | Preparation | 2 h |  |
| 6 | pH & EC (1:2.5 in water) | Analysis / test | 2 h |  |
| 7 | Aqua regia digest + ICP-MS (As, Hg, Pb, Cd, Cu, Zn, Cr) | Analysis / test | 12 h | **Re-assays restart here.** |
| 8 | Total cyanide (near plant / TSF) | Analysis / test | 6 h |  |
| 9 | QA/QC review | QA/QC | 2 h |  |

**QA/QC:** Per batch of up to 20 samples, checking As, Hg, Pb and Cu: 1 duplicate, 1 soil CRM and 1 blank. Passes when the soil CRM is within ±15% of the certified value, the blank is below 5× the detection limit and the duplicate agrees within 20% (relative difference, above 10× detection limit), for each of them.

**Re-assay triggers**

- Above the guideline value: re-analyse and notify Environment
- CRM outside limits: repeat the batch

**Retention and disposal**

- Sieved sample: kept 6 months after results, then disposed
