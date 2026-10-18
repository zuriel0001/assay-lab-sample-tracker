/* ROUTES-BEGIN: sample types, tests, purposes and the default workflow routes. Admins edit routes on the Settings tab. */
const S = (key, name, hours, phase, note = "", redo = false) => ({ key, name, hours, phase, note, ...(redo ? { redo: true } : {}) });
/* What the analysis is for (v24: grouped; the lab only assays, so a testwork programme such as a bottle roll is what the samples are for,
   not a route). A sub-purpose (sub) chooses routes as its base purpose does. */
const PURPOSES = [
  { key: "exp",       g: "Mine & geology", name: "Exploration / resource definition" },
  { key: "gc",        g: "Mine & geology", name: "Grade control (ore / waste)" },
  { key: "plant",     g: "Processing", name: "Process control (crusher, plant, TSF)" },
  { key: "recon",     g: "Processing", name: "Mine-to-mill reconciliation" },
  { key: "bullion",   g: "Gold room", name: "Bullion (gold pour)" },
  { key: "met_br",    g: "Metallurgical testwork", name: "Bottle roll test", sub: "met" },
  { key: "met_cil",   g: "Metallurgical testwork", name: "CIL / CIP leach test", sub: "met" },
  { key: "met_grg",   g: "Metallurgical testwork", name: "Gravity (GRG) test", sub: "met" },
  { key: "met_diag",  g: "Metallurgical testwork", name: "Diagnostic leach", sub: "met" },
  { key: "met_pri",   g: "Metallurgical testwork", name: "Preg-robbing test", sub: "met" },
  { key: "met_reag",  g: "Metallurgical testwork", name: "Reagent consumption test", sub: "met" },
  { key: "met_col",   g: "Metallurgical testwork", name: "Column / heap leach", sub: "met" },
  { key: "met_ilr",   g: "Metallurgical testwork", name: "Intensive leach (ILR)", sub: "met" },
  { key: "met_flot",  g: "Metallurgical testwork", name: "Flotation test", sub: "met" },
  { key: "met_strip", g: "Metallurgical testwork", name: "Carbon strip / elution test", sub: "met" },
  { key: "met_detox", g: "Metallurgical testwork", name: "Cyanide detox test", sub: "met" },
  { key: "met",       g: "Metallurgical testwork", name: "Other metallurgical testwork" },
  { key: "env",       g: "Environment & safety", name: "Environmental compliance (any site)" },
  { key: "hse",       g: "Environment & safety", name: "Health & safety / occupational hygiene" },
  { key: "qc",        g: "Quality control", name: "Quality control / check assay" },
  { key: "other",     g: "Other", name: "Other" }
];
const purpBase = k => PURPOSES.find(p => p.key === k)?.sub || k;
/* Test catalogue, grouped the way a mine assay lab groups its work. */
/* v24c: ore and exploration samples end in AuFx (gold in the solids, by fire assay); processing runs from the primary crusher through the plant
   to the TSF, carbon and elution included; the gold room sends bullion only. Testwork is no longer a test of its own (the lab assays its samples). */
const TEST_CATS = ["Ore grade (AuFx)", "Processing", "Gold room", "Environment", "Physical & chemistry", "Metallurgical testwork"];
const TESTS = [
  { key: "fa_aas",       cat: "Ore grade (AuFx)", name: "AuFx: fire assay, AAS finish" },
  { key: "fa_grav",      cat: "Ore grade (AuFx)", name: "AuFx: fire assay, gravimetric finish (high grade)" },
  { key: "sfa",          cat: "Ore grade (AuFx)", name: "AuFx: screen fire assay (coarse gold)" },
  { key: "ar_au",        cat: "Ore grade (AuFx)", name: "Soil gold: aqua regia / BLEG (low level)" },
  { key: "check",        cat: "Ore grade (AuFx)", name: "AuFx: check / umpire assay (external lab)" },
  /* The processing tests in the lab's own words (v23). AuFx: gold in the solids (fire assay); AuSx: gold in the solution. */
  { key: "aufx_ausx",    cat: "Processing", name: "Slurry: AuFx & AuSx" },
  { key: "aufx",         cat: "Processing", name: "Solids: AuFx" },
  { key: "aufx_m",       cat: "Processing", name: "Belt cut: AuFx & moisture" },
  { key: "ausx",         cat: "Processing", name: "Solution: AuSx" },
  { key: "aufx_ausx_cn", cat: "Processing", name: "Slurry: AuFx, AuSx & cyanide" },
  { key: "ausx_cn",      cat: "Processing", name: "Solution: AuSx & cyanide" },
  { key: "cn_only",      cat: "Processing", name: "Cyanide: NaCN, WAD & pH" },
  { key: "c_load",       cat: "Processing", name: "Carbon: Au loading" },
  { key: "elu_sol",      cat: "Processing", name: "Elution solution: AuSx, AgSx & Cu" },
  { key: "cn_sol",       cat: "Ore grade (AuFx)", name: "Cyanide-soluble gold (LeachWELL)" },
  { key: "bottle",       cat: "Metallurgical testwork", name: "Bottle roll cyanidation test" },
  { key: "cil_test",     cat: "Metallurgical testwork", name: "CIL / CIP leach test with carbon" },
  { key: "pri",          cat: "Metallurgical testwork", name: "Preg-robbing test (gold-rob test, PRI)" },
  { key: "diag",         cat: "Metallurgical testwork", name: "Diagnostic leach (gold deportment)" },
  { key: "reagent",      cat: "Metallurgical testwork", name: "Cyanide & lime consumption (reagent optimisation)" },
  { key: "o2",           cat: "Metallurgical testwork", name: "Oxygen uptake rate test" },
  { key: "column",       cat: "Metallurgical testwork", name: "Column / heap leach with agglomeration" },
  { key: "ilr",          cat: "Metallurgical testwork", name: "Intensive leach test (gravity concentrate)" },
  { key: "grg",          cat: "Metallurgical testwork", name: "Gravity recoverable gold (GRG)" },
  { key: "flot",         cat: "Metallurgical testwork", name: "Flotation test (rougher / cleaner kinetics)" },
  { key: "commin",       cat: "Physical & chemistry", name: "Comminution & abrasion (SMC, BWi, RWi, Ai)" },
  { key: "density",      cat: "Physical & chemistry", name: "Specific gravity & bulk density" },
  { key: "psd",          cat: "Physical & chemistry", name: "Particle size distribution" },
  { key: "moisture",     cat: "Physical & chemistry", name: "Moisture content" },
  { key: "settle",       cat: "Physical & chemistry", name: "Settling & rheology (thickener, flocculant)" },
  { key: "icp",          cat: "Physical & chemistry", name: "Multi-element ICP" },
  { key: "delet",        cat: "Physical & chemistry", name: "Deleterious & cyanicide elements (Cu, As, Sb, Hg…)" },
  { key: "leco",         cat: "Physical & chemistry", name: "Sulphur & carbon (LECO): total / sulphide S, organic C" },
  { key: "mineral",      cat: "Physical & chemistry", name: "Mineralogy (XRD, QEMSCAN / MLA, gold deportment)" },
  { key: "plant_solids", cat: "Processing", name: "Mill sample assay (head grade, grind, moisture)" },
  { key: "ccd",          cat: "Processing", name: "CCD survey (solution gold, wash efficiency)" },
  { key: "residue",      cat: "Processing", name: "Tails / residue gold loss (solid & solution)" },
  { key: "cil_survey",   cat: "Processing", name: "CIL / CIP tank survey" },
  { key: "carbon",       cat: "Processing", name: "Carbon loading & activity" },
  { key: "eluate",       cat: "Processing", name: "Elution solution assay (eluate, strip & electrowinning solutions)" },
  { key: "elution",      cat: "Processing", name: "Carbon strip test (lab elution of loaded carbon)" },
  { key: "solution",     cat: "Processing", name: "Process solution assay (Au, Ag, Cu, cyanide)" },
  { key: "conc",         cat: "Processing", name: "Gravity concentrate: AuFx, Hg & As" },
  { key: "bullion",      cat: "Gold room", name: "Bullion: Au & Ag fineness" },
  { key: "tsf",          cat: "Processing", name: "TSF sample characterisation (Au, CN, S, metals)" },
  { key: "cn_spec",      cat: "Environment", name: "Cyanide speciation (free, WAD, total, SCN)" },
  { key: "detox",        cat: "Environment", name: "Cyanide destruction (detox) test" },
  { key: "aba",          cat: "Environment", name: "Acid-base accounting & NAG (acid rock drainage)" },
  { key: "water",        cat: "Environment", name: "Water quality (CN, metals, pH, solids)" },
  { key: "soil",         cat: "Environment", name: "Soil / sediment (metals, Hg, As, CN)" }
];
const SHIFT = { k: "shift", l: "Shift", o: ["Day", "Night"] };
/* Sampling points, the same at submission (sample details) and on the results, so a limit for one point follows what the submitter chose. */
const MILL_PTS = ["CIL feed", "Cyclone overflow", "Cyclone underflow", "CIL tank", "CIL tails", "Tails grab", "Other"];
const CCD_PTS = ["CCD feed", "CCD overflow", "CCD underflow", "CCD tails", "Other"];
const TSF_PTS = ["TSF spigot", "Decant pond", "Return water", "Seepage / underdrain", "Other"];
const PLANT_PTS = [...new Set([...MILL_PTS, ...CCD_PTS, ...TSF_PTS].filter(x => x !== "Other")), "Other"];
const CARBON_PTS = ["CIL tank carbon", "Loaded carbon (to elution)", "Eluted carbon", "Regenerated carbon", "Fresh carbon"];
const ELU_PTS = ["Pregnant solution", "Electrowinning head", "Electrowinning tails", "Lean eluate", "Other"];
const BELT_PTS = ["Mill feed conveyor", "Crusher product conveyor", "Stockpile reclaim conveyor", "Other"];
/* What each sample type can be sent for (v24c): "What it is for" lists only these purposes, and Other. Environment can send a sample from
   any site (env); a testwork purpose is offered only on the samples that test is run on (bottle roll on ore and mill feed, carbon strip on
   carbon, intensive leach on gravity concentrate …; met is "Other metallurgical testwork"). Types not listed (Other, the retired ones) take any. */
const ORE_MET = ["met_br", "met_cil", "met_grg", "met_diag", "met_pri", "met_reag", "met_col", "met_flot", "met"];
const TYPE_PURPOSES = {
  rc: ["exp", "gc", ...ORE_MET, "env"], core: ["exp", "gc", ...ORE_MET, "env"], gc_bh: ["gc", "recon", "env"], channel: ["exp", "gc", "env"],
  rom: ["recon", "gc", ...ORE_MET, "env"], soil_geo: ["exp", "env"],
  belt: ["plant", "recon", "met_br", "met_cil", "met_grg", "met_diag", "met_pri", "met_reag", "met_flot", "met", "env"],
  plant_feed: ["plant", "recon", "met_br", "met_cil", "met_grg", "met_diag", "met_pri", "met_reag", "met_flot", "met", "env"],
  ccd: ["plant", "recon", "met_reag", "met_detox", "met", "env"], carbon: ["plant", "met_strip", "met_cil", "met", "env"], elution: ["plant", "met_strip", "met", "env"],
  conc: ["plant", "recon", "bullion", "met_ilr", "met_grg", "met", "env"], tsf: ["plant", "recon", "met_detox", "met_br", "met", "env"],
  bullion: ["bullion"], env_water: ["env", "hse"], env_soil: ["env", "hse"], pulp: ["qc"]
};
/* The sections a sample type can come from (v24c): Section lists only these. A mill sample comes from the plant, Metallurgy or Environment,
   never from geology, exploration or mining. A section code not named here (one an admin added) is always offered; Other takes any. */
const TYPE_SECTIONS = {
  rc: ["EXP", "GEO", "GC", "MET", "ENV", "QC", "EXT"], core: ["EXP", "GEO", "GC", "MET", "ENV", "QC", "EXT"], gc_bh: ["GC", "GEO", "MIN", "ENV", "QC"],
  channel: ["EXP", "GEO", "GC", "ENV", "EXT"], rom: ["GC", "GEO", "MIN", "PLT", "MET", "ENV"], soil_geo: ["EXP", "GEO", "ENV", "EXT"],
  belt: ["PLT", "MET", "ENV"], plant_feed: ["PLT", "MET", "ENV"], ccd: ["PLT", "MET", "ENV"], carbon: ["PLT", "GR", "MET", "ENV"],
  elution: ["PLT", "GR", "MET", "ENV"], conc: ["PLT", "GR", "MET", "ENV"], tsf: ["TSF", "PLT", "MET", "ENV"],
  bullion: ["GR"], env_water: ["ENV", "HSE"], env_soil: ["ENV", "HSE"], pulp: ["QC", "EXP", "GEO", "GC", "MET", "EXT"]
};
/* tests: recommended tests for the type, first = default (the first one a route in use performs). pur: the usual purpose. fields: extra details
   asked at submission. check: what the technician checks at receipt. */
const TYPES = [
  { key: "rc", group: "Ore (mine & exploration)", pur: "exp", name: "RC chips (reverse circulation)", tests: ["fa_aas", "fa_grav", "sfa", "cn_sol", "icp", "leco"],
    fields: [{ k: "hole", l: "Hole ID", ph: "e.g. KRC-0412" }, { k: "from", l: "From (m)", t: "number" }, { k: "to", l: "To (m)", t: "number" }, { k: "cond", l: "Sample condition", o: ["Dry", "Moist", "Wet"] }],
    check: "Bag count and numbers match the sheet; wet or split bags noted." },
  { key: "core", group: "Ore (mine & exploration)", pur: "exp", name: "Diamond drill core", tests: ["fa_aas", "fa_grav", "sfa", "cn_sol", "icp", "leco", "moisture", "density", "delet"],
    fields: [{ k: "hole", l: "Hole ID", ph: "e.g. KDD-0231" }, { k: "from", l: "From (m)", t: "number" }, { k: "to", l: "To (m)", t: "number" }, { k: "size", l: "Core size", o: ["PQ", "HQ", "NQ", "BQ"] }, { k: "cut", l: "Core portion", o: ["Half core", "Quarter core", "Whole core"] }],
    check: "Bags or trays match the cut sheet; intervals continuous, no gaps or overlaps." },
  { key: "gc_bh", group: "Ore (mine & exploration)", pur: "gc", name: "Grade control blast-hole cuttings", tests: ["fa_aas", "fa_grav"],
    fields: [{ k: "pit", l: "Pit" }, { k: "bench", l: "Bench / RL" }, { k: "pattern", l: "Blast pattern", ph: "e.g. P2-1140-07" }, { k: "holeno", l: "Hole number(s)" }],
    check: "Pattern and hole numbers match the sheet; samples arrive before the dig plan deadline." },
  { key: "channel", group: "Ore (mine & exploration)", pur: "exp", name: "Channel / grab / trench sample", tests: ["fa_aas", "fa_grav", "sfa", "icp"],
    fields: [{ k: "loc", l: "Face / trench location" }, { k: "len", l: "Sample length (m)", t: "number" }],
    check: "Labels legible; sample length recorded." },
  { key: "rom", group: "Ore (mine & exploration)", pur: "recon", name: "ROM ore / stockpile", tests: ["fa_aas", "fa_grav", "moisture", "psd", "density"],
    fields: [{ k: "pile", l: "Stockpile / truck reference" }, SHIFT],
    check: "Stockpile or truck reference recorded." },
  { key: "soil_geo", group: "Ore (mine & exploration)", pur: "exp", name: "Soil / stream sediment (geochemistry)", tests: ["ar_au", "fa_aas", "icp"],
    fields: [{ k: "station", l: "Grid / line / station" }, { k: "depth", l: "Depth (cm)", t: "number" }, { k: "hor", l: "Horizon", o: ["B horizon", "C horizon", "Laterite", "Stream sediment"] }],
    check: "Station numbers match the sheet; samples dry and not mixed." },
  { key: "belt", group: "Processing (crusher to TSF)", pur: "plant", name: "Belt cut sample (crusher / conveyor)", tests: ["aufx_m", "aufx", "moisture", "psd"],
    fields: [{ k: "point", l: "Conveyor", o: BELT_PTS }, SHIFT, { k: "time", l: "Cut time", ph: "e.g. 14:30" }],
    check: "Full cut in a sealed bag, conveyor and time labelled; weighed wet on arrival." },
  { key: "plant_feed", group: "Processing (crusher to TSF)", pur: "plant", name: "Mill sample", tests: ["aufx_ausx", "aufx", "ausx", "cn_only", "psd"],
    fields: [{ k: "point", l: "Sampling point", o: MILL_PTS }, SHIFT, { k: "period", l: "Composite period", ph: "e.g. 06:00–18:00" }],
    check: "Shift and sampling point labelled; bucket sealed with no spillage." },
  { key: "ccd", group: "Processing (crusher to TSF)", pur: "plant", name: "CCD sample", hold: 24, holdWhat: "solution gold (solution not separated)", haz: ["cn"], tests: ["aufx_ausx_cn", "ausx_cn", "cn_only", "aufx_ausx", "ausx", "aufx"],
    fields: [{ k: "point", l: "Sampling point", o: CCD_PTS }, { k: "stage", l: "CCD thickener", ph: "e.g. CCD 1" }, SHIFT, { k: "period", l: "Composite period", ph: "e.g. 06:00–18:00" }],
    check: "One container per thickener and stream, labelled; solution not separated in transit; delivered promptly." },
  { key: "carbon", group: "Processing (crusher to TSF)", pur: "plant", name: "Carbon", haz: ["cn"], tests: ["c_load", "moisture"],
    fields: [{ k: "ctype", l: "Carbon type", o: CARBON_PTS }, { k: "batch", l: "Tank / elution batch no." }],
    check: "Seal intact; gold-room custody form signed." },
  { key: "elution", group: "Processing (crusher to TSF)", pur: "plant", name: "Elution sample", hold: 168, holdWhat: "solution gold", haz: ["cn", "acid"], tests: ["elu_sol"],
    fields: [{ k: "sol", l: "Solution", o: ELU_PTS }, { k: "batch", l: "Elution batch / strip no." }, { k: "bv", l: "Time or bed volume", ph: "e.g. 02:30 or BV 4" }],
    check: "Sealed bottle; elution batch and bed volume labelled; gold-room custody form signed." },
  { key: "conc", group: "Processing (crusher to TSF)", pur: "plant", name: "Gravity concentrate", unit: "g", haz: ["hg", "as"], tests: ["conc", "icp", "moisture"],
    fields: [{ k: "csrc", l: "Concentrate", o: ["Gravity (Knelson / table)", "Flotation", "Intensive leach (ILR) residue"] }, { k: "batch", l: "Batch / campaign no." }, { k: "mass", l: "Dispatch mass (g)", t: "number" }],
    check: "Seal numbers and mass match the dispatch note; two people present." },
  { key: "tsf", group: "Processing (crusher to TSF)", pur: "plant", name: "TSF sample", hold: 336, holdWhat: "cyanide (NaOH-preserved)", cool: 6, haz: ["cn"], tests: ["aufx_ausx_cn", "ausx_cn", "cn_only", "aufx", "ausx", "cn_spec"],
    fields: [{ k: "point", l: "Sampling point", o: TSF_PTS }, { k: "cell", l: "TSF cell / location" }],
    check: "Cyanide bottles preserved; cooler temperature recorded." },
  { key: "bullion", group: "Gold room", pur: "bullion", name: "Bullion", unit: "g", tests: ["bullion"],
    fields: [{ k: "bar", l: "Pour / bar number" }, { k: "gross", l: "Gross bar mass (g)", t: "number" }, { k: "escort", l: "Escort / witness" }],
    check: "Bar number, gross mass and seal match the gold-room dispatch; two people present at all times." },
  { key: "env_water", group: "Environment", pur: "env", name: "Environmental water (surface, ground, discharge)", hold: 336, holdWhat: "cyanide (free cyanide within 24 h)", cool: 6, tests: ["water", "cn_spec"],
    fields: [{ k: "point", l: "Monitoring point ID" }, { k: "ph", l: "Field pH", t: "number" }, { k: "ec", l: "Field EC (µS/cm)", t: "number" }, { k: "temp", l: "Water temperature (°C)", t: "number" }, { k: "pres", l: "Preservation", o: ["NaOH (cyanide) and HNO₃ (metals)", "NaOH only", "HNO₃ only", "None"] }, { k: "cool", l: "Cooler temperature at dispatch (°C)", t: "number" }],
    check: "Cooler at 6 °C or below, preservation correct, within holding time, chain-of-custody signed." },
  { key: "env_soil", group: "Environment", pur: "env", name: "Environmental soil / sediment", hold: 336, holdWhat: "cyanide and mercury", cool: 6, tests: ["soil", "icp"],
    fields: [{ k: "point", l: "Monitoring point / grid ref" }, { k: "depth", l: "Depth (cm)", t: "number" }, { k: "use", l: "Setting", ph: "e.g. downstream of TSF, farmland" }],
    check: "Samples in sealed bags; monitoring point and depth labelled." },
  { key: "pulp", group: "Quality control", pur: "qc", name: "Assay pulp (check / umpire / re-assay)", tests: ["check", "fa_aas", "fa_grav", "icp"],
    fields: [{ k: "orig", l: "Original sample ID" }, { k: "job", l: "Original lab batch / job no." }],
    check: "Pulp envelopes match the list; original IDs not written on blind samples." },
  { key: "other", group: "Other", name: "Other", tests: ["fa_aas", "icp", "moisture"], fields: [], check: "Sample matches the description on the submission." },
  /* off: not offered since v24c (duplicates of the types above, or testwork, whose products come in as the types above). No route in use names
     them, so they stay off the form unless an admin puts back a route that does; samples already on them keep them. */
  { key: "waste", off: true, group: "Ore (mine & exploration)", pur: "env", name: "Waste rock / overburden (acid rock drainage)", tests: ["aba", "leco", "icp", "density"],
    fields: [{ k: "dump", l: "Dump / pit location" }, { k: "lith", l: "Lithology" }],
    check: "Location and lithology labelled; bags sealed." },
  { key: "plant_tails", off: true, group: "Processing (crusher to TSF)", pur: "plant", name: "Plant tails / CIL residue", haz: ["cn"], tests: ["residue", "cn_sol", "psd", "diag", "leco", "settle", "detox", "cn_spec", "flot"],
    fields: [{ k: "point", l: "Sampling point", o: ["Final tails", "Last CIL tank", "Thickener underflow", "Detox discharge"] }, SHIFT, { k: "period", l: "Composite period", ph: "e.g. 06:00–18:00" }],
    check: "Shift and sampling point labelled; solution not separated in transit." },
  { key: "cil_slurry", off: true, group: "Processing (crusher to TSF)", pur: "plant", name: "CIL / CIP tank slurry", hold: 24, holdWhat: "free cyanide and solution gold", haz: ["cn"], tests: ["cil_survey", "solution", "cn_spec", "o2", "settle"],
    fields: [{ k: "tanks", l: "Tank number(s)", ph: "e.g. Tanks 1–8" }, { k: "time", l: "Survey time", ph: "e.g. 08:00" }],
    check: "One container per tank, labelled; delivered promptly (cyanide degrades)." },
  { key: "solution", off: true, group: "Processing (crusher to TSF)", pur: "plant", name: "Process solution (leach, barren, process water)", hold: 336, holdWhat: "cyanide (NaOH-preserved)", haz: ["cn"], tests: ["solution", "cn_spec", "detox"],
    fields: [{ k: "sol", l: "Solution", o: ["Leach tank", "Barren solution", "Process water", "Detox discharge", "Other"] }, { k: "time", l: "Sampling time" }, { k: "pres", l: "Preserved with NaOH (pH > 11)", o: ["Yes", "No"] }],
    check: "Bottle sealed and labelled; preserved if cyanide is to be measured." },
  { key: "met_comp", off: true, group: "Metallurgical testwork", pur: "met", name: "Testwork head / composite", tests: ["fa_aas", "sfa", "fa_grav", "cn_sol", "icp", "leco", "delet", "moisture", "psd", "density", "bottle", "cil_test", "pri", "diag", "reagent", "grg", "o2", "column", "flot", "ilr", "commin", "mineral", "settle"],
    fields: [{ k: "prog", l: "Testwork programme" }, { k: "comp", l: "Composite ID / lithology" }],
    check: "Composite sheet attached." },
  { key: "tw_slurry", off: true, group: "Metallurgical testwork", pur: "met_br", name: "Testwork slurry", haz: ["cn"], tests: ["aufx_ausx", "aufx_ausx_cn"],
    fields: [{ k: "prog", l: "Test number", ph: "e.g. BR-014" }, { k: "tp", l: "Time point", ph: "e.g. 24 h" }],
    check: "Test number and time point labelled." },
  { key: "tw_sol", off: true, group: "Metallurgical testwork", pur: "met_br", name: "Testwork solution (leach liquor)", haz: ["cn"], tests: ["ausx", "ausx_cn", "cn_only", "elu_sol"],
    fields: [{ k: "prog", l: "Test number", ph: "e.g. BR-014" }, { k: "tp", l: "Time point", ph: "e.g. 24 h" }],
    check: "Bottle sealed; test number and time point labelled." },
  { key: "tw_res", off: true, group: "Metallurgical testwork", pur: "met_br", name: "Testwork residue (solids)", tests: ["aufx", "moisture", "psd"],
    fields: [{ k: "prog", l: "Test number", ph: "e.g. BR-014" }],
    check: "Residue washed and labelled with the test number." },
  { key: "tw_carbon", off: true, group: "Metallurgical testwork", pur: "met_cil", name: "Testwork carbon", haz: ["cn"], tests: ["c_load"],
    fields: [{ k: "prog", l: "Test number", ph: "e.g. CIL-006" }],
    check: "Carbon washed and labelled with the test number." }
];
const DEFAULT_ROUTES = [
  { code: "EXP-FA", name: "AuFx: fire assay (50 g, AAS finish)", tests: ["fa_aas"], types: ["rc", "core", "channel", "rom", "*"], purposes: ["exp", "recon", "qc", "other"],
    desc: "Standard route for drill and surface samples: full preparation to a 50 g pulp, lead-collection fire assay, AAS finish. Range 0.005 to 10 g/t Au.",
    stages: [
      S("sort", "Sorting & lab QC insertion", 0.5, "intake", "Sort into sequence and reconcile with the submission sheet. Lab QC is placed per 50-position furnace batch as in the QA/QC rule; client blind QC stays as submitted."),
      S("dry", "Drying at 105 °C", 8, "prep", "Stainless trays to constant mass; wet and dry mass recorded."),
      S("crush", "Jaw crushing to 90% passing 2 mm", 2, "prep", "Preparation blank (barren quartz) crushed first; barren flush between samples; crusher duplicate split once per batch; sieve check 1 in 20."),
      S("split", "Riffle / rotary split to 1 kg", 1, "prep", "Coarse reject bagged and kept."),
      S("pulv", "Pulverising to 80% passing 75 µm", 2, "prep", "Quartz wash between samples; wet-sieve check 1 in 20."),
      S("weigh", "Weighing 50 g charge & flux", 1, "test", "Balance checked with a certified weight each batch."),
      S("fuse", "Fusion & cupellation", 3, "test", "Lead-collection fusion at 1,050 °C, then cupellation to a precious-metal bead.", true),
      S("finish", "AuFx: bead digest & AAS finish", 2, "test", "Aqua regia digest; Au read by AAS against matrix-matched standards."),
      S("qc", "QA/QC review", 1, "qc", "Batch checked against the pass rules before release.")
    ],
    qc: "Per 50-position furnace batch: 1 preparation blank, 1 crusher duplicate, 2 pulp duplicates, 2 CRMs and 1 analytical blank. Passes when CRMs are within ±2 SD (2 to 3 SD is a warning, outside ±3 SD fails), blanks are below 5× the detection limit (0.025 g/t Au), pulp duplicates agree within 20% and crusher duplicates within 30% (relative difference, above 10× detection limit). Client blind QC is reported unchanged.",
    triggers: ["Au of 10 g/t or more: repeat by gravimetric finish (FA-GRAV)", "Replicates differ by more than 20%, or visible gold logged: screen fire assay (SFA)", "CRM outside ±3 SD or blank above 5× detection limit: re-assay the batch from fusion"],
    retention: [{ item: "Pulp", days: 365, then: "Returned to geology" }, { item: "Coarse reject", days: 90, then: "Disposed" }] },
  { code: "GC-FA", name: "AuFx: grade control fast track (30 g)", tests: ["fa_aas"], types: ["gc_bh"], purposes: ["gc"],
    desc: "Quick turnaround so ore and waste boundaries can be marked before digging. Whole sample pulverised; 30 g charge.",
    stages: [
      S("sort", "Sorting & QC insertion", 0.5, "intake", "Sorted by pattern and hole; CRM and blank inserted 1 in 25."),
      S("dry", "Fast drying at 105 °C", 4, "prep", "Forced-air oven; samples over 3 kg split before drying."),
      S("pulv", "Crush & pulverise whole sample (LM5)", 3, "prep", "Single stage to 80% passing 75 µm; sieve check 1 in 25."),
      S("weigh", "Weighing 30 g charge", 0.5, "test"),
      S("fuse", "Fusion & cupellation", 2, "test", "Lead-collection fire assay, 30 g charge.", true),
      S("finish", "AuFx: AAS finish", 1, "test", "Results posted to mine geology by blast pattern."),
      S("qc", "QA/QC review", 1, "qc", "CRMs, blanks and duplicates near the cut-off grade checked.")
    ],
    qc: "1 CRM and 1 blank per 25 samples; pulp duplicate on any result within ±20% of the ore / waste cut-off grade.",
    triggers: ["Au of 10 g/t or more: repeat by gravimetric finish", "Duplicate near cut-off differs by more than 20%: repeat fusion", "CRM or blank fails: re-assay the whole pattern"],
    retention: [{ item: "Pulp", days: 90, then: "Disposed" }, { item: "Coarse reject", days: 30, then: "Disposed" }] },
  { code: "FA-GRAV", name: "AuFx: high grade (gravimetric finish)", tests: ["fa_grav"], types: ["*"], purposes: [],
    desc: "For expected high-grade ore and for over-range repeats (10 g/t or more by AAS). The gold prill is parted and weighed on a microbalance.",
    stages: [
      S("sort", "Sorting & QC insertion", 0.5, "intake", "High-grade CRM and blank inserted per batch."),
      S("dry", "Drying at 105 °C", 8, "prep"),
      S("crush", "Crushing to 90% passing 2 mm", 2, "prep"),
      S("split", "Riffle split to 1 kg", 1, "prep"),
      S("pulv", "Pulverising to 80% passing 75 µm", 2, "prep", "Barren wash after every high-grade sample to stop carry-over."),
      S("weigh", "Weighing 50 g charge", 1, "test"),
      S("fuse", "Fusion & cupellation", 3, "test", "", true),
      S("part", "AuFx: parting & prill weighing", 2, "test", "Silver parted with nitric acid; gold annealed and weighed on a 1 µg microbalance."),
      S("qc", "QA/QC review", 1, "qc")
    ],
    qc: "1 high-grade CRM and 1 blank per batch; every sample in duplicate, agreeing within 10%.",
    triggers: ["Duplicates differ by more than 10%: screen fire assay", "Prill too small to weigh (under 0.1 mg): report the AAS result", "Blank after a high-grade sample above 5× detection limit: re-pulverise and repeat"],
    retention: [{ item: "Pulp", days: 365, then: "Returned to geology" }, { item: "Coarse reject", days: 90, then: "Disposed" }] },
  { code: "SFA", name: "AuFx: screen fire assay (coarse gold)", tests: ["sfa"], types: ["*"], purposes: [],
    desc: "Separates coarse free gold so it is assayed in full instead of being sub-sampled. Used where visible gold or poor duplicate repeatability is seen.",
    stages: [
      S("sort", "Sorting & QC insertion", 0.5, "intake"),
      S("dry", "Drying at 105 °C", 8, "prep"),
      S("crush", "Crushing to 90% passing 2 mm", 2, "prep"),
      S("split", "Split 1 kg (or whole sample)", 1, "prep"),
      S("pulv", "Pulverising the whole 1 kg split", 2, "prep", "Gold flakes are not over-ground into the bowl."),
      S("screen", "Screening at 75 µm & weighing fractions", 3, "prep", "Plus and minus fraction masses recorded; loss under 2%."),
      S("fuse", "Fire assay: all of +75 µm, 2 × 50 g of −75 µm", 8, "test", "Coarse fraction fused in full; fine fraction in duplicate.", true),
      S("finish", "Gravimetric / AAS finish", 4, "test"),
      S("calc", "AuFx: weighted total (coarse + fine)", 1, "test", "Total Au from mass-weighted coarse and fine grades; coarse gold % reported."),
      S("qc", "QA/QC review", 1, "qc")
    ],
    qc: "Screen mass balance loss under 2%; the two −75 µm assays agree within 10%; CRM and blank pass as for fire assay.",
    triggers: ["Screen loss above 2%: re-screen from the pulp", "Fine-fraction duplicates differ by more than 10%: repeat fine-fraction fusion"],
    retention: [{ item: "Coarse and fine pulps", days: 365, then: "Returned to geology" }, { item: "Coarse reject", days: 90, then: "Disposed" }] },
  { code: "CN-SOL", name: "Cyanide-soluble gold (LeachWELL)", tests: ["cn_sol"], types: ["*"], purposes: [],
    desc: "Accelerated cyanide leach of a large charge. Compared with fire assay it shows how much of the gold cyanide can recover.",
    stages: [
      S("sort", "Sorting & QC insertion", 0.5, "intake"),
      S("dry", "Drying at 105 °C", 8, "prep"),
      S("crush", "Crushing to 2 mm", 2, "prep"),
      S("pulv", "Pulverising to 80% passing 75 µm", 2, "prep", "200 g kept for a fire assay head grade."),
      S("weigh", "Weighing 500 g or 1 kg charge", 1, "test"),
      S("leach", "Accelerated cyanide leach on rolls (12–24 h)", 24, "test", "LeachWELL tablet and NaCN at pH 10.5 to 11.", true),
      S("finish", "Settle, filter & AAS on solution", 3, "test", "DIBK extraction for low levels."),
      S("tails", "Residue fire assay", 6, "test", "Closes the gold balance."),
      S("qc", "QA/QC review", 1, "qc")
    ],
    qc: "CRM with a certified cyanide-soluble value each batch, reagent blank, duplicate 1 in 20.",
    triggers: ["Cyanide-soluble Au below 50% of fire assay: flag as refractory and offer diagnostic leach", "Solution plus residue gold differs from head by more than 15%: repeat"],
    retention: [{ item: "Leach solution", days: 30, then: "Cyanide destroyed, disposed" }, { item: "Pulp", days: 365, then: "Disposed" }, { item: "Residue", days: 90, then: "Disposed" }] },
  { code: "BRT", name: "Bottle roll cyanidation test (48 h)", tests: ["bottle"], types: ["met_comp", "core", "rc", "rom", "plant_feed", "*"], purposes: ["met"],
    desc: "Metallurgical leach test: grind to target size, leach with cyanide and follow gold dissolution over time to get recovery and reagent use.",
    stages: [
      S("log", "Composite log & head split", 2, "intake", "Weighed, photographed and split into head, test charges and reserve."),
      S("dry", "Drying at 80 °C or below", 12, "prep", "Low temperature so sulphides do not oxidise."),
      S("crush", "Stage crushing to 100% passing 2 mm", 4, "prep"),
      S("split", "Rotary split 1 kg test charges", 2, "prep"),
      S("grind", "Grind calibration & grind to P80 75 µm", 6, "prep", "Rod mill grind-time curve; P80 confirmed by wet screen."),
      S("head", "Head assays (Au duplicate, Ag, S, C, Cu)", 12, "test", "Fire assay in duplicate; LECO S and C; ICP for cyanicides (Cu, As, Sb)."),
      S("setup", "Pulp set-up: 40% solids, lime to pH 10.5, NaCN 500 ppm", 2, "test"),
      S("leach", "Bottle roll leach, samples at 2, 4, 8, 24, 48 h", 48, "test", "Cyanide and lime topped up at each sample; DO recorded.", true),
      S("solns", "Kinetic solution assays & reagent titrations", 6, "test", "Au by AAS; free cyanide by AgNO₃ titration; lime consumption."),
      S("residue", "Filter, wash & dry residue", 8, "prep"),
      S("resfa", "Residue fire assay in duplicate", 6, "test"),
      S("balance", "Metallurgical balance & recovery", 4, "test", "Calculated vs assayed head; extraction curve; NaCN and lime in kg/t."),
      S("qc", "Metallurgist review", 4, "qc")
    ],
    qc: "Calculated head within ±10% of the assayed head; residue duplicates within 10%; a reference ore leached each campaign.",
    triggers: ["Calculated and assayed head more than 10% apart: repeat residue assay, then the leach", "Extraction below 80%: diagnostic leach recommended", "Organic carbon above 0.2% (preg-robbing): repeat as a CIL test"],
    retention: [{ item: "Head reserve", days: 365, then: "Returned to MET" }, { item: "Leach residue", days: 180, then: "Disposed" }, { item: "Solutions", days: 30, then: "Cyanide destroyed, disposed" }] },
  { code: "CIL-T", name: "CIL / CIP leach test with carbon", tests: ["cil_test"], types: ["met_comp", "core", "plant_feed", "*"], purposes: ["met"],
    desc: "Leach with activated carbon present, as in the plant. Used for preg-robbing ores and to size the carbon inventory.",
    stages: [
      S("log", "Composite log & head split", 2, "intake"),
      S("dry", "Drying at 80 °C or below", 12, "prep"),
      S("crush", "Stage crushing to 2 mm", 4, "prep"),
      S("split", "Rotary split test charges", 2, "prep"),
      S("grind", "Grind to target P80", 6, "prep"),
      S("head", "Head assays (Au, Ag, S, organic C)", 12, "test"),
      S("carbon", "Carbon preparation (attritioned, −2.36 +1.18 mm)", 4, "prep", "Plant or fresh carbon at 20 g/L."),
      S("leach", "CIL leach 24 h with kinetic samples", 24, "test", "Solution sampled at 2, 4, 8 and 24 h; pH 10.5, NaCN 500 ppm.", true),
      S("assay", "Solution, carbon & residue assays", 12, "test", "Solution by AAS; carbon ashed then AAS; residue fire assay in duplicate."),
      S("balance", "Gold balance & carbon loading", 4, "test", "Recovery to carbon, loading in g/t, preg-robbing compared with bottle roll."),
      S("qc", "Metallurgist review", 4, "qc")
    ],
    qc: "Gold balance (solution + carbon + residue) within ±10% of head; residue duplicates within 10%.",
    triggers: ["Gold balance outside ±10%: repeat carbon and residue assays", "Carbon loading does not match solution loss: repeat the leach"],
    retention: [{ item: "Loaded carbon", days: 90, then: "Returned to gold room" }, { item: "Residue", days: 180, then: "Disposed" }, { item: "Head reserve", days: 365, then: "Returned to MET" }] },
  { code: "GRG", name: "Gravity recoverable gold (3-stage Knelson)", tests: ["grg"], types: ["met_comp", "core", "rom", "plant_feed"], purposes: ["met"],
    desc: "Three stages of grinding and centrifugal concentration show how much gold a gravity circuit could recover. Needs 90 kg or more.",
    stages: [
      S("log", "Sample log, mass check (90 kg+) & split", 2, "intake"),
      S("dry", "Drying", 24, "prep"),
      S("crush", "Crushing to 100% passing 850 µm", 8, "prep"),
      S("k1", "Stage 1 Knelson pass at 850 µm", 4, "test", "Concentrate collected; tails sub-sampled."),
      S("k2", "Grind to P50 about 250 µm & stage 2 Knelson", 6, "test"),
      S("k3", "Grind to P80 75 µm & stage 3 Knelson", 6, "test"),
      S("clean", "Concentrate cleaning (panning / Mozley table)", 6, "test", "Concentrates sealed between steps under gold-room custody."),
      S("assay", "Concentrate & tails assays", 24, "test", "Concentrates fire assayed to extinction; tails screened and assayed size by size.", true),
      S("calc", "GRG calculation & gold by size", 6, "test"),
      S("qc", "Metallurgist review", 4, "qc")
    ],
    qc: "Calculated head within ±15% of the assayed head; concentrates handled under gold-room custody.",
    triggers: ["Calculated and assayed head more than 15% apart: repeat tails assays", "GRG above 30%: report recommends a gravity circuit study"],
    retention: [{ item: "Gravity concentrates", days: 180, then: "Returned to gold room" }, { item: "Tails", days: 180, then: "Disposed" }] },
  { code: "DIAG", name: "Diagnostic (sequential) leach", tests: ["diag"], types: ["met_comp", "core", "plant_tails", "*"], purposes: ["met", "plant"],
    desc: "Strips gold step by step to show where it is locked: free-milling, in carbonates, in sulphides, in carbonaceous matter or in silicates.",
    stages: [
      S("log", "Sample log & head split", 2, "intake"),
      S("dry", "Drying at 80 °C or below", 12, "prep"),
      S("pulv", "Pulverise to P80 75 µm", 3, "prep"),
      S("head", "Head assay (duplicate fire assay, S, C)", 12, "test"),
      S("s1", "Stage 1: direct cyanidation (free gold)", 24, "test", "", true),
      S("s2", "Stage 2: HCl digest + cyanidation (carbonates, pyrrhotite)", 24, "test"),
      S("s3", "Stage 3: H₂SO₄ digest + cyanidation (base-metal sulphides)", 24, "test"),
      S("s4", "Stage 4: HNO₃ digest + cyanidation (pyrite, arsenopyrite)", 24, "test"),
      S("s5", "Stage 5: roast or acetonitrile + cyanidation (carbonaceous)", 24, "test"),
      S("res", "Final residue fire assay (silicate-locked gold)", 6, "test"),
      S("calc", "Gold deportment calculation", 4, "test"),
      S("qc", "Metallurgist review", 4, "qc")
    ],
    qc: "Sum of all stages within ±10% of the head grade.",
    triggers: ["Stage sum outside ±10% of head: repeat from stage 1", "More than 30% of gold locked in sulphides: recommend flotation, fine grinding or oxidation testwork"],
    retention: [{ item: "Head reserve", days: 365, then: "Returned to MET" }, { item: "Stage residues", days: 90, then: "Disposed" }, { item: "Solutions", days: 30, then: "Cyanide destroyed, disposed" }] },
  { code: "COMMIN", name: "Comminution & abrasion tests", tests: ["commin"], types: ["core", "met_comp", "rom"], purposes: ["met"],
    desc: "Hardness and abrasiveness for mill design and liner wear: SMC drop-weight, Bond rod and ball mill work indices, Bond abrasion index.",
    stages: [
      S("log", "Core log, photographs & mass check", 2, "intake", "Whole core preferred; lengths and lithology checked against the request."),
      S("dry", "Air drying at 40 °C or below (no oven)", 24, "prep", "Oven drying weakens rock and biases hardness."),
      S("smcsel", "Select & cut SMC pieces (−31.5 +26.5 mm)", 4, "prep"),
      S("smc", "SMC drop-weight test (Axb, DWi)", 8, "test", "", true),
      S("crush", "Crush & split for Bond tests", 4, "prep"),
      S("ai", "Bond abrasion index (Ai)", 6, "test", "−19 +12.5 mm feed."),
      S("rwi", "Bond rod mill work index (RWi)", 12, "test", "Closing screen 1.18 mm."),
      S("bwi", "Bond ball mill work index (BWi)", 16, "test", "Closing screen 106 µm; run until 3 cycles are stable."),
      S("sg", "Specific gravity", 2, "test"),
      S("calc", "Report Axb, DWi, RWi, BWi, Ai & SG", 4, "test"),
      S("qc", "Metallurgist review", 4, "qc")
    ],
    qc: "Reference ore run through the Bond mill each campaign; BWi accepted only after 3 cycles at equilibrium (±3%).",
    triggers: ["BWi not stable after 3 cycles: repeat", "Not enough competent pieces for SMC: request more core"],
    retention: [{ item: "Test products & rejects", days: 365, then: "Disposed" }, { item: "Unused core", days: 30, then: "Returned to core shed" }] },
  { code: "ICP", name: "Multi-element ICP (four-acid / aqua regia)", tests: ["icp"], types: ["*"], purposes: [],
    desc: "48-element package for geochemistry, cyanicides (Cu, As, Sb, Bi, Te) and deleterious elements.",
    stages: [
      S("sort", "Sorting & QC insertion", 0.5, "intake"),
      S("dry", "Drying at 105 °C", 8, "prep", "60 °C or below if mercury or arsenic matter."),
      S("crush", "Crushing to 2 mm", 2, "prep"),
      S("split", "Riffle split", 1, "prep"),
      S("pulv", "Pulverising to 80% passing 75 µm", 2, "prep", "Chrome-steel bowls add Cr and Fe; noted on the report."),
      S("weigh", "Weighing 0.25 g", 1, "test"),
      S("digest", "Four-acid digestion (HF-HNO₃-HClO₄-HCl)", 8, "test", "Aqua regia on request for a partial digest.", true),
      S("read", "ICP-OES / ICP-MS reading", 6, "test"),
      S("qc", "QA/QC review", 1, "qc")
    ],
    qc: "2 CRMs, 1 blank and 1 replicate per 40; key elements on CRMs within ±10%.",
    triggers: ["Cu, As, Zn or S above the upper limit: ore-grade dilution re-run", "CRM outside limits for key elements: repeat the batch"],
    retention: [{ item: "Pulp", days: 365, then: "Returned to geology" }, { item: "Coarse reject", days: 90, then: "Disposed" }] },
  { code: "LECO", name: "Sulphur & carbon (LECO): total / sulphide S, organic C", tests: ["leco"], types: ["*"], purposes: [],
    desc: "Sulphur and carbon speciation to judge refractory and preg-robbing behaviour, and for acid-rock-drainage screening.",
    stages: [
      S("sort", "Sorting & QC insertion", 0.5, "intake"),
      S("dry", "Drying at 80 °C or below", 12, "prep"),
      S("pulv", "Crush & pulverise to 80% passing 75 µm", 4, "prep"),
      S("weigh", "Weighing 0.1–0.2 g", 1, "test"),
      S("total", "Total S & C by combustion infrared", 3, "test", "", true),
      S("spec", "Sulphide S and organic C (acid-washed residue)", 6, "test", "HCl wash removes carbonate carbon; residue burnt again for organic carbon."),
      S("qc", "QA/QC review", 1, "qc")
    ],
    qc: "LECO CRM every 20; duplicate every 20 within 5% relative.",
    triggers: ["Organic carbon above 0.2%: flag preg-robbing and offer a CIL test", "S above the calibration range: smaller weight and repeat"],
    retention: [{ item: "Pulp", days: 365, then: "Disposed" }] },
  { code: "MOIST", name: "Moisture content", tests: ["moisture"], types: ["*"], purposes: [],
    desc: "Wet and dry mass to give % moisture for tonnage, reconciliation and shipping.",
    stages: [
      S("wet", "Wet weighing in tared tray", 0.5, "test", "Weighed as soon as the sealed bag is opened.", true),
      S("dry", "Oven drying at 105 °C to constant mass", 12, "test"),
      S("dryw", "Dry weighing & moisture calculation", 0.5, "test"),
      S("qc", "QA/QC check", 1, "qc")
    ],
    qc: "Duplicate 1 in 10 within 0.5% moisture (absolute); balance verified daily.",
    triggers: ["Bag not sealed or dried out in transit: reported as indicative only", "Duplicate differs by more than 0.5%: repeat"],
    retention: [{ item: "Dried sample", days: 30, then: "Disposed" }] },
  { code: "PSD", name: "Particle size distribution (sieve analysis)", tests: ["psd"], types: ["*"], purposes: [],
    desc: "Grind control and testwork sizing: % passing 75 µm and P80 from a √2 sieve series.",
    stages: [
      S("wet", "Wet mass & % solids", 1, "test"),
      S("dry", "Drying at 105 °C", 8, "prep"),
      S("split", "Split a representative 500 g", 1, "prep"),
      S("deslime", "Wet screening at 38 µm (desliming)", 3, "test", "", true),
      S("sieve", "Dry sieving, 2 mm to 38 µm", 3, "test", "15 minutes on the shaker; each fraction weighed."),
      S("calc", "P80 & % passing calculation", 1, "test"),
      S("qc", "Mass balance check", 1, "qc")
    ],
    qc: "Sieve loss under 1% of feed mass; sieves inspected for damage monthly.",
    triggers: ["Sieve loss above 1%: repeat", "Gold by size requested: each fraction fire assayed (adds assay time)"],
    retention: [{ item: "Size fractions", days: 30, then: "Disposed" }] },
  { code: "PLT-HEAD", transit: 2, name: "Mill sample: shift head grade & grind (fast track)", tests: ["plant_solids", "fa_aas"], types: ["plant_feed", "rom"], purposes: ["plant", "recon"],
    desc: "Mill samples (mill feed, cyclone overflow, leach feed) for daily metallurgical accounting. Fast track with forced-air drying and a 30 g charge, so results reach the plant within the next shift: about 7 hours after the lab receives the sample.",
    stages: [
      S("wet", "Wet weight for moisture", 0.25, "test", "Weighed on arrival; moisture by difference after drying."),
      S("size", "Grind check: % passing 75 µm", 1, "test", "Wet screen on a split taken before drying."),
      S("dry", "Fast drying (forced-air oven, 105 °C)", 1.5, "prep", "Thin layer on trays; microwave drying where available."),
      S("pulv", "Pulverise to 80% passing 75 µm", 0.75, "prep", "Single-stage pulverising of the dried split."),
      S("fuse", "Fire assay, 30 g charge", 1.75, "test", "Lead-collection fusion and cupellation in the plant priority furnace slot.", true),
      S("finish", "AAS finish", 0.5, "test"),
      S("qc", "QA/QC review", 0.5, "qc", "Plant CRM and a duplicate each shift.")
    ],
    qc: "Plant CRM, a blank and one duplicate every shift; duplicate within 10%, CRM within ±2 SD.",
    triggers: ["Head grade more than 15% away from the rolling 7-day plant average or the expected feed grade: repeat the assay", "CRM fails: repeat the shift set"],
    retention: [{ item: "Pulp", days: 90, then: "Disposed" }, { item: "Reject", days: 7, then: "Disposed" }] },
  { code: "PLT-TAIL", transit: 2, name: "Plant tails / CIL residue (solid & solution loss)", tests: ["residue"], types: ["plant_tails"], purposes: ["plant", "recon"],
    desc: "Measures gold lost to final tails: undissolved gold in the solids and dissolved gold in the solution.",
    stages: [
      S("filter", "Pressure filter: solution separated from solids", 1, "prep"),
      S("soln", "Solution Au by AAS (DIBK extraction)", 2, "test", "Detection 0.005 mg/L."),
      S("dry", "Wash & dry residue", 4, "prep"),
      S("pulv", "Pulverise", 2, "prep"),
      S("fuse", "Residue fire assay, 50 g in duplicate", 4, "test", "Low-level method, detection 0.01 g/t.", true),
      S("finish", "AAS finish", 1, "test"),
      S("calc", "Soluble & insoluble loss, plant recovery", 1, "test"),
      S("qc", "QA/QC review", 1, "qc")
    ],
    qc: "Low-grade CRM and blank per batch; residue duplicates within 20% at low levels.",
    triggers: ["Residue above 0.20 g/t or solution above 0.02 mg/L: alert the plant metallurgist and repeat", "Duplicates differ by more than 20%: repeat fusion"],
    retention: [{ item: "Residue pulp", days: 90, then: "Disposed" }, { item: "Solution", days: 7, then: "Cyanide destroyed, disposed" }] },
  { code: "CCD-SVY", transit: 2, name: "CCD sample survey (solution gold & wash efficiency)", tests: ["ccd"], types: ["ccd"], purposes: ["plant", "recon"],
    desc: "Counter-current decantation thickener samples: density, dissolved gold in each stage and gold in the final underflow solids, to show how much soluble gold the washing circuit loses.",
    stages: [
      S("field", "Pulp density & % solids per thickener", 1, "test", "Marcy scale, done on arrival."),
      S("filter", "Filter: separate solution from solids", 1, "prep"),
      S("soln", "Solution Au by AAS for each stage", 2, "test", "DIBK extraction for low levels.", true),
      S("cn", "Free cyanide & pH", 1, "test"),
      S("dry", "Wash & dry underflow solids", 4, "prep"),
      S("pulv", "Pulverise", 2, "prep"),
      S("fa", "Underflow solids Au fire assay", 4, "test"),
      S("calc", "Wash efficiency & soluble gold loss per stage", 1, "test", "Soluble loss = solution Au × solution tonnes in the final underflow."),
      S("qc", "QA/QC review", 1, "qc")
    ],
    qc: "Solution standard every 10 readings; solids CRM and blank per batch; duplicates within 10%.",
    triggers: ["Final underflow solution above 0.05 mg/L Au: alert the plant metallurgist (soluble loss)", "Wash efficiency below 98%: check wash ratio and flocculant, repeat the survey", "Underflow density more than 5% off target: notify the plant"],
    retention: [{ item: "Solutions", days: 7, then: "Cyanide destroyed, disposed" }, { item: "Solids", days: 30, then: "Disposed" }] },
  { code: "ELUATE", transit: 2, name: "Elution sample (eluate, strip & electrowinning solutions)", tests: ["eluate"], types: ["elution"], purposes: ["plant", "bullion"],
    desc: "Gold solutions from the elution circuit: pregnant eluate, end-of-strip eluate and electrowinning cell feed and discharge. High-value, so handled under gold-room custody.",
    stages: [
      S("custody", "Custody check & log", 0.5, "intake", "Sealed bottle; elution batch and bed volume recorded."),
      S("filter", "Filter 0.45 µm", 0.5, "prep", "Removes carbon fines that would add gold."),
      S("dilute", "Dilution by weight (pregnant eluate)", 0.5, "prep", "Pregnant eluate can be hundreds of mg/L; diluted into the AAS range."),
      S("aas", "Au, Ag, Cu by AAS with high-grade standards", 2, "test", "Standards matched to the caustic-cyanide eluate.", true),
      S("chem", "Caustic (NaOH) & free cyanide titration", 1, "test", "Checks eluant strength."),
      S("calc", "Strip profile / electrowinning efficiency", 0.5, "test", "Gold stripped per bed volume, or cell feed vs. discharge."),
      S("qc", "QA/QC review", 0.5, "qc")
    ],
    qc: "High-grade solution standard and blank each run; duplicate dilutions within 2%.",
    triggers: ["End-of-strip eluate above 5 mg/L Au: notify the elution operator (incomplete strip)", "Electrowinning cell discharge above 5 mg/L Au: check cells and current", "Duplicate dilutions differ by more than 2%: repeat"],
    retention: [{ item: "Eluate", days: 30, then: "Returned to the elution circuit / gold room" }] },
  { code: "CIL-SVY", transit: 2, name: "CIL / CIP tank survey", tests: ["cil_survey"], types: ["cil_slurry"], purposes: ["plant"],
    desc: "Tank-by-tank profile of solution gold, carbon loading, cyanide and pH to check adsorption efficiency.",
    stages: [
      S("field", "Pulp density, pH & dissolved oxygen", 0.5, "test", "Marcy scale % solids, done on arrival."),
      S("cn", "Free cyanide titration (AgNO₃)", 0.5, "test"),
      S("split", "Separate solution, carbon & solids", 1, "prep", "Carbon screened out at 600 µm; solution filtered."),
      S("soln", "Solution Au by AAS", 2, "test", "", true),
      S("carbon", "Carbon Au loading (ash, aqua regia, AAS)", 6, "test"),
      S("solids", "Solids Au fire assay", 6, "test"),
      S("calc", "Tank profile & adsorption efficiency", 1, "test"),
      S("qc", "QA/QC review", 1, "qc")
    ],
    qc: "Solution standard every 10 readings; carbon CRM per batch.",
    triggers: ["Carbon loading more than 20% off the last survey: repeat", "Last tank solution above 0.02 mg/L Au: alert the plant"],
    retention: [{ item: "Solutions", days: 7, then: "Cyanide destroyed, disposed" }, { item: "Carbon", days: 7, then: "Returned to plant" }, { item: "Solids", days: 30, then: "Disposed" }] },
  { code: "CARBON", transit: 2, name: "Carbon assay & activity", tests: ["carbon"], types: ["carbon"], purposes: ["plant"],
    desc: "Gold and silver loading on loaded, eluted or regenerated carbon, and activity to decide on regeneration.",
    stages: [
      S("wash", "Wash & screen (fines and grit removed)", 1, "prep", "Sealed bag opened under gold-room custody."),
      S("dry", "Drying at 105 °C", 6, "prep"),
      S("split", "Riffle split", 1, "prep"),
      S("load", "Au & Ag loading (ashed at 700 °C, aqua regia, AAS)", 8, "test", "", true),
      S("act", "Carbon activity (rate test against fresh carbon)", 6, "test"),
      S("qc", "QA/QC review", 1, "qc")
    ],
    qc: "Carbon CRM and duplicate each batch; duplicate within 10%.",
    triggers: ["Eluted carbon above 100 g/t Au: repeat and notify the elution operator", "Activity below 50% of fresh carbon: recommend regeneration"],
    retention: [{ item: "Carbon sample", days: 30, then: "Returned to gold room" }] },
  { code: "SOLN", transit: 2, name: "Process solution assay", tests: ["solution"], types: ["solution", "cil_slurry"], purposes: [],
    desc: "Leach tank, barren and process-water solutions: gold, silver, copper and cyanide. Elution samples have their own route (ELUATE).",
    stages: [
      S("filter", "Filter 0.45 µm", 0.5, "prep"),
      S("cn", "Free cyanide (AgNO₃ titration) & pH", 1, "test"),
      S("aas", "Au, Ag, Cu by AAS", 3, "test", "DIBK extraction for barren solutions below 0.05 mg/L.", true),
      S("wad", "WAD cyanide (on request)", 3, "test"),
      S("qc", "QA/QC review", 1, "qc", "Standards, spikes and duplicates.")
    ],
    qc: "Calibration check every 10 readings; spike recovery 90–110%; duplicate within 10%.",
    triggers: ["Barren above 0.02 mg/L Au: alert elution / plant", "Spike recovery outside 90–110%: repeat"],
    retention: [{ item: "Solution", days: 30, then: "Cyanide destroyed, disposed" }] },
  { code: "CONC", two: true, transit: 2, name: "Gravity concentrate: AuFx, Hg & As", tests: ["conc"], types: ["conc"], purposes: [],
    desc: "High-grade concentrates handled under gold-room security and assayed in triplicate by gravimetric fire assay.",
    stages: [
      S("wet", "Witnessed wet weight & moisture", 0.5, "test", "Seal numbers recorded."),
      S("dry", "Drying at 105 °C", 8, "prep"),
      S("split", "Homogenise & split under custody", 2, "prep"),
      S("pulv", "Pulverise (screen first if coarse gold)", 2, "prep"),
      S("fuse", "Reduced-charge fire assay in triplicate", 6, "test", "", true),
      S("grav", "Gravimetric finish", 3, "test"),
      S("icp", "Ag, S, As, Cu (ICP / LECO)", 6, "test", "Payable and penalty elements."),
      S("qc", "QA/QC review", 1, "qc")
    ],
    qc: "Triplicates within 5% relative; high-grade CRM per batch; two-person custody for all handling.",
    triggers: ["Triplicates differ by more than 5%: screen fire assay of the whole concentrate", "Mass at receipt differs from dispatch: hold and report to security"],
    retention: [{ item: "Concentrate remainder", days: 0, then: "Returned to gold room when results are released" }, { item: "Pulp", days: 365, then: "Kept in secure store" }] },
  { code: "BULLION", two: true, transit: 2, name: "Bullion: Au & Ag fineness", tests: ["bullion"], types: ["bullion"], purposes: ["bullion"],
    desc: "Fineness of doré bars for export and settlement by fire assay with proof gold. The bar stays under escort throughout.",
    stages: [
      S("weigh", "Witnessed bar weighing, serial & photo", 0.5, "intake", "Two-person rule; bar number and gross mass recorded."),
      S("drill", "Drill or chip samples top & bottom", 1, "prep", "Or the dip sample taken at the pour."),
      S("clean", "Clean, roll & weigh assay portions", 1, "prep"),
      S("fuse", "Cupellation with proof gold, in duplicate", 6, "test", "ISO 11426; proof gold corrects for losses.", true),
      S("part", "Parting & cornet weighing", 2, "test"),
      S("imp", "Silver and impurities (Cu, Fe, Pb) by ICP-OES", 4, "test"),
      S("qc", "QA/QC review", 1, "qc"),
      S("cert", "Fineness certificate signed", 1, "qc", "Signed by the lab manager.")
    ],
    qc: "Duplicates within 0.5 parts per thousand; proof gold recovery checked each run; top and bottom within 2 parts per thousand.",
    triggers: ["Duplicates differ by more than 0.5‰: repeat", "Top and bottom differ by more than 2‰: bar not homogeneous, re-melt and re-sample"],
    retention: [{ item: "Doré bar", days: 0, then: "Returned to the gold room vault the same day" }, { item: "Cornets & drillings", days: 365, then: "Kept in secure store" }] },
  { code: "TSF-CHAR", name: "TSF sample (tailings characterisation)", tests: ["tsf"], types: ["tsf", "plant_tails"], purposes: ["env", "plant", "recon"],
    desc: "Spigot, beach, pond and seepage samples: residual gold, cyanide for Cyanide Code compliance, sulphur and metals.",
    stages: [
      S("wet", "Wet mass, density & % solids", 1, "test"),
      S("filter", "Decant / filter solution", 1, "prep", "Cyanide aliquot preserved with NaOH to pH above 12 straight away."),
      S("soln", "Solution: WAD & free CN, pH, EC, Au", 4, "test", "", true),
      S("dry", "Drying at 105 °C", 8, "prep"),
      S("pulv", "Pulverise", 2, "prep"),
      S("fa", "Solids Au fire assay", 6, "test"),
      S("chem", "Total S & C (LECO) and ICP metals (As, Cu)", 8, "test"),
      S("qc", "QA/QC review", 1, "qc")
    ],
    qc: "Cyanide check standard every batch; duplicates within 10%; field blank where supplied.",
    triggers: ["WAD cyanide above 50 mg/L at discharge or in the pond: alert Environment immediately", "Solids Au more than 20% above plant tails grade: repeat"],
    retention: [{ item: "Solids", days: 90, then: "Disposed" }, { item: "Solutions", days: 30, then: "Cyanide destroyed, disposed" }] },
  { code: "ENV-W", name: "Environmental water quality", tests: ["water"], types: ["env_water"], purposes: ["env", "hse"],
    desc: "Surface, ground and discharge water against permit limits: cyanide, metals, pH, solids and anions.",
    stages: [
      S("chk", "Preservation & holding-time check", 0.5, "intake", "Cooler at 6 °C or below; CN bottle at pH above 12 (NaOH); metals bottle HNO₃ to pH below 2."),
      S("field", "pH, EC, TDS & turbidity", 1, "test"),
      S("cn", "Free & WAD cyanide (distillation, colorimetric)", 6, "test", "Holding time 14 days.", true),
      S("met", "Dissolved metals by ICP-MS (As, Hg, Pb, Cd, Cu, Zn, Fe, Mn)", 8, "test", "Filtered 0.45 µm before acidifying."),
      S("anion", "Sulphate, chloride, nitrate, ammonia", 6, "test"),
      S("tss", "Total suspended solids", 6, "test"),
      S("qc", "QA/QC review", 2, "qc", "Field and trip blanks, duplicate, spike."),
      S("permit", "Comparison with permit limits", 1, "qc", "Exceedances flagged on the report.")
    ],
    qc: "Field blank, trip blank and a field duplicate per sampling round; spike recovery 85–115%.",
    triggers: ["Any result above the permit limit: re-analyse and notify Environment the same day", "Holding time exceeded: reported as indicative; re-sampling requested", "Spike recovery outside 85–115%: repeat"],
    retention: [{ item: "Water samples", days: 30, then: "Neutralised and disposed" }] },
  { code: "ENV-S", name: "Environmental soil / sediment", tests: ["soil"], types: ["env_soil"], purposes: ["env", "hse"],
    desc: "Soil and stream sediment for contamination monitoring and closure: metals, mercury, arsenic, cyanide and pH.",
    stages: [
      S("airdry", "Air drying at 40 °C or below", 48, "prep", "No oven, so mercury stays in the sample."),
      S("sieve", "Disaggregate & sieve to −2 mm (and −180 µm)", 4, "prep"),
      S("split", "Split", 2, "prep"),
      S("ph", "pH & EC (1:2.5 in water)", 2, "test"),
      S("met", "Aqua regia digest + ICP-MS (As, Hg, Pb, Cd, Cu, Zn, Cr)", 12, "test", "", true),
      S("cn", "Total cyanide (near plant / TSF)", 6, "test"),
      S("qc", "QA/QC review", 2, "qc")
    ],
    qc: "Soil CRM and duplicate per 20; blank per batch.",
    triggers: ["Above the guideline value: re-analyse and notify Environment", "CRM outside limits: repeat the batch"],
    retention: [{ item: "Sieved sample", days: 180, then: "Disposed" }] },
  { code: "PRI", name: "Preg-robbing test (gold-rob test)", tests: ["pri"], types: ["met_comp", "core", "rc", "plant_feed", "plant_tails", "*"], purposes: ["met"],
    desc: "Measures how much dissolved gold the ore itself takes back out of cyanide solution (carbonaceous matter, graphite, some clays). Decides between plain leach, CIL, blinding agents or roasting.",
    stages: [
      S("log", "Sample log & head split", 1, "intake"),
      S("dry", "Drying at 80 °C or below", 12, "prep", "Low temperature so carbonaceous matter is not altered."),
      S("pulv", "Pulverise to 80% passing 75 µm", 2, "prep"),
      S("head", "Head assays: Au (fire assay), total & organic carbon (LECO)", 12, "test", "Organic carbon is the main preg-robbing indicator."),
      S("spike", "Spiked-solution test: sample + gold-cyanide solution (2 mg/L Au)", 6, "test", "Pulp at 40% solids, NaCN 0.1%, pH 10.5, bottle rolled; a sample-free blank of the same solution runs alongside.", true),
      S("aas", "Filter & solution Au by AAS", 2, "test", "Spiked solution, blank and sample read together."),
      S("pair", "Paired leach: cyanide alone vs cyanide with carbon (24 h)", 24, "test", "Extra gold recovered with carbon present shows how much a plain leach loses to preg-robbing."),
      S("resfa", "Residue fire assays", 6, "test"),
      S("calc", "Preg-robbing index & classification", 2, "test", "PRI = % of the spiked gold taken out of solution by the ore."),
      S("qc", "Metallurgist review", 4, "qc")
    ],
    qc: "Blank solution recovers 95–105% of the spike; duplicate spike tests within 10%; organic carbon CRM each batch.",
    triggers: ["Blank recovery outside 95–105%: remake the spike solution and repeat", "Gold removed from solution above 10% (moderate) or 50% (severe): recommend CIL, a blinding agent (kerosene / diesel) or roasting tests", "Duplicate PRI differs by more than 10%: repeat"],
    retention: [{ item: "Pulp", days: 365, then: "Returned to MET" }, { item: "Solutions", days: 30, then: "Cyanide destroyed, disposed" }] },
  { code: "REAGENT", name: "Cyanide & lime consumption (reagent optimisation)", tests: ["reagent"], types: ["met_comp", "core", "rom", "plant_feed", "*"], purposes: ["met", "plant"],
    desc: "Finds the cyanide dose and pH that give the best recovery for the least reagent, and the kg/t of NaCN and lime the plant should budget.",
    stages: [
      S("log", "Sample log & split", 2, "intake"),
      S("dry", "Drying at 80 °C or below", 12, "prep"),
      S("crush", "Crushing to 2 mm", 2, "prep"),
      S("split", "Rotary split: four or more 1 kg charges", 2, "prep"),
      S("grind", "Grind to plant P80", 6, "prep"),
      S("lime", "Lime demand curve (pH 10.0, 10.5, 11.0)", 4, "test", "Lime added in steps to reach each pH; kg/t CaO recorded."),
      S("set", "Leach series at 250, 500 and 1,000 ppm NaCN", 2, "test"),
      S("leach", "Parallel bottle rolls, 24 h, with cyanide & lime top-ups", 24, "test", "Free cyanide and pH checked at 2, 4, 8 and 24 h and topped up; every addition logged.", true),
      S("tit", "Titrations & solution Au", 6, "test", "Free cyanide by AgNO₃ titration; Au by AAS on each sample."),
      S("resfa", "Residue fire assays", 6, "test"),
      S("calc", "Consumption (kg/t NaCN, CaO) vs recovery; optimum dose", 4, "test"),
      S("qc", "Metallurgist review", 4, "qc")
    ],
    qc: "Calculated heads within ±10% of the assayed head across the series; titration standard checked daily.",
    triggers: ["Cyanide consumption above 1.5 kg/t: run the deleterious elements test for cyanicides (Cu, sulphides)", "Recovery still rising at the highest dose: extend the leach and repeat the best dose"],
    retention: [{ item: "Residues", days: 180, then: "Disposed" }, { item: "Solutions", days: 30, then: "Cyanide destroyed, disposed" }, { item: "Head reserve", days: 365, then: "Returned to MET" }] },
  { code: "O2-UPT", name: "Oxygen uptake rate test", tests: ["o2"], types: ["met_comp", "plant_feed", "cil_slurry", "core", "*"], purposes: ["met", "plant"],
    desc: "How fast the slurry consumes dissolved oxygen (sulphides, pyrrhotite). Used to size pre-aeration and oxygen or peroxide addition so the leach is not oxygen-starved.",
    stages: [
      S("slurry", "Grind & make slurry at plant density", 6, "prep", "Fresh or plant slurry preferred; kept sealed so it does not oxidise in transit."),
      S("sat", "Aerate to dissolved-oxygen saturation", 1, "test"),
      S("decay", "Air off: log DO decay every 30 s down to 2 mg/L", 2, "test", "Uptake rate in mg/L/min from the slope.", true),
      S("repeat", "Repeat after 1, 2, 4, 8 and 24 h of aeration", 24, "test", "Shows how quickly demand falls with pre-aeration."),
      S("add", "Optional: repeat with lead nitrate or peroxide", 8, "test", "Tests whether additives lower oxygen demand."),
      S("calc", "Oxygen demand & aeration / O₂ addition sizing", 2, "test"),
      S("qc", "Metallurgist review", 4, "qc")
    ],
    qc: "DO probe calibrated before each test (air saturation and zero); temperature recorded with each reading.",
    triggers: ["Uptake above 0.1 mg/L/min after 8 h: recommend pre-aeration or oxygen / peroxide addition", "Probe drift above 5%: recalibrate and repeat"],
    retention: [{ item: "Slurry", days: 30, then: "Disposed" }] },
  { code: "COLUMN", name: "Column leach (heap leach) with agglomeration", tests: ["column"], types: ["rom", "met_comp", "core", "*"], purposes: ["met"],
    desc: "Simulates a heap: crushed ore is agglomerated with cement or lime, loaded in a column and irrigated with cyanide for weeks. Gives heap recovery, leach time and reagent and binder use.",
    stages: [
      S("log", "Sample log, photos & mass check (100 kg or more)", 2, "intake"),
      S("crush", "Crush to column size (e.g. 100% passing 25 mm)", 8, "prep"),
      S("head", "Head & size-by-size assays, moisture", 48, "test", "Fire assay by size fraction shows where the gold sits."),
      S("agg", "Agglomeration with cement / lime & curing (72 h)", 80, "prep", "Binder dose in kg/t recorded; agglomerate strength checked."),
      S("perc", "Percolation & slump test", 24, "test", "Confirms solution flows through without ponding or collapse."),
      S("load", "Load column", 4, "prep"),
      S("leach", "Cyanide irrigation & daily pregnant-solution assays (60 days)", 1440, "test", "About 10 L/h/m² irrigation; daily Au, free CN, pH and volume.", true),
      S("rinse", "Rinse & drain", 72, "test"),
      S("unload", "Unload, dry & split residue", 24, "prep"),
      S("resfa", "Residue size-by-size assays", 48, "test"),
      S("bal", "Metallurgical balance, recovery curve, reagent & binder use", 8, "test"),
      S("qc", "Metallurgist review", 4, "qc")
    ],
    qc: "Calculated head within ±10% of the assayed head; solution balance (in, out, evaporation) closes within 5%.",
    triggers: ["Percolation fails or the column slumps more than 10%: increase binder and repeat agglomeration", "Recovery still rising at day 60: extend the leach", "Head balance outside ±10%: repeat residue assays"],
    retention: [{ item: "Residue", days: 180, then: "Disposed" }, { item: "Head reserve", days: 365, then: "Returned to MET" }, { item: "Solutions", days: 30, then: "Cyanide destroyed, disposed" }] },
  { code: "ILR", two: true, name: "Intensive leach test (gravity concentrate)", tests: ["ilr"], types: ["conc", "met_comp"], purposes: ["met", "plant"],
    desc: "High-strength cyanide leach of gravity concentrate, as in the plant's intensive leach reactor, to confirm recovery and leach time.",
    stages: [
      S("wet", "Witnessed weighing & split under custody", 1, "intake", "Two-person rule; seal numbers recorded."),
      S("dry", "Drying", 6, "prep"),
      S("head", "Head assay of concentrate (fire assay to extinction)", 8, "test"),
      S("leach", "Intensive cyanide leach (1–2% NaCN, leach aid, 24 h)", 24, "test", "Oxidant (LeachAid / peroxide) as in the plant; samples at 2, 4, 8, 16 and 24 h.", true),
      S("aas", "Solution Au & Ag by AAS (diluted)", 4, "test"),
      S("res", "Residue fire assay", 6, "test"),
      S("calc", "Recovery & kinetics", 2, "test"),
      S("qc", "QA/QC review", 1, "qc")
    ],
    qc: "Gold balance within ±5% of head; two-person custody throughout.",
    triggers: ["Recovery below 95%: check for coarse gold, repeat with longer time or finer grind", "Balance outside ±5%: repeat residue assay"],
    retention: [{ item: "Leach residue", days: 90, then: "Returned to gold room" }, { item: "Solutions", days: 30, then: "Returned to gold room" }] },
  { code: "C-STRIP", transit: 2, name: "Carbon strip test (lab elution of loaded carbon)", tests: ["elution"], types: ["carbon"], purposes: ["plant", "met"],
    desc: "Strips gold from plant loaded carbon under plant conditions (AARL or Zadra) to check elution efficiency and troubleshoot high barren carbon.",
    stages: [
      S("wash", "Screen & wash loaded carbon", 1, "prep", "Opened under gold-room custody."),
      S("head", "Loaded carbon assay (Au, Ag, Cu)", 8, "test"),
      S("acid", "Acid wash (3% HCl) & rinse", 3, "test"),
      S("elute", "Pressure elution at 110–120 °C, eluate sampled each bed volume", 8, "test", "NaOH and NaCN strength matched to the plant.", true),
      S("aas", "Eluate Au, Ag, Cu by AAS", 4, "test"),
      S("barren", "Eluted (barren) carbon assay", 8, "test"),
      S("calc", "Elution efficiency & strip profile", 2, "test"),
      S("qc", "QA/QC review", 1, "qc")
    ],
    qc: "Gold balance (eluate + barren carbon) within ±10% of the loaded carbon.",
    triggers: ["Barren carbon above 100 g/t Au: check temperature and caustic strength, repeat", "Balance outside ±10%: repeat carbon assays"],
    retention: [{ item: "Carbon", days: 30, then: "Returned to gold room" }, { item: "Eluate", days: 30, then: "Returned to gold room" }] },
  { code: "FLOT", name: "Flotation test (rougher & cleaner kinetics)", tests: ["flot"], types: ["met_comp", "core", "plant_feed", "plant_tails"], purposes: ["met"],
    desc: "Recovers gold-bearing sulphides to a concentrate. Used for refractory or sulphide ores and to test re-treating tails.",
    stages: [
      S("log", "Sample log & split", 2, "intake"),
      S("dry", "Drying at 80 °C or below", 12, "prep"),
      S("crush", "Crushing to 2 mm", 2, "prep"),
      S("split", "Rotary split 1 kg charges", 2, "prep"),
      S("grind", "Grind to target P80 in a lab rod mill", 4, "prep"),
      S("cond", "Conditioning: pH, activator (CuSO₄), collector (PAX), frother", 1, "test"),
      S("rough", "Rougher flotation, concentrates at 1, 3, 7 and 15 min", 2, "test", "Mass pull recorded for each concentrate.", true),
      S("clean", "Cleaner flotation (on request)", 2, "test"),
      S("dry2", "Filter & dry products", 12, "prep"),
      S("assay", "Concentrate & tails assays: Au (FA), S (LECO), As", 24, "test"),
      S("calc", "Recovery, grade and mass-pull curves", 4, "test"),
      S("qc", "Metallurgist review", 4, "qc")
    ],
    qc: "Calculated head within ±10% of the assayed head; product masses within 2% of feed.",
    triggers: ["Mass loss above 2%: repeat", "Gold recovery below 80% with sulphide left in tails: repeat at a finer grind or with a different collector"],
    retention: [{ item: "Flotation products", days: 180, then: "Disposed" }, { item: "Head reserve", days: 365, then: "Returned to MET" }] },
  { code: "DENSITY", name: "Specific gravity & bulk density", tests: ["density"], types: ["core", "rom", "*"], purposes: ["exp", "met", "recon"],
    desc: "Bulk density of core for tonnage in the resource model (water immersion, wax-coated if porous) and pulp SG by pycnometer for metallurgical calculations.",
    stages: [
      S("log", "Log core pieces & weigh", 1, "intake", "Competent pieces 10–20 cm long."),
      S("dry", "Drying at 105 °C", 8, "prep"),
      S("wax", "Wax coating of porous pieces", 2, "prep"),
      S("immerse", "Weigh in air & in water (Archimedes)", 2, "test", "Bulk density = mass in air ÷ (mass in air − mass in water), corrected for wax.", true),
      S("pyc", "Pulp SG by gas or water pycnometer", 4, "test", "On a pulverised split."),
      S("qc", "QA/QC review", 1, "qc")
    ],
    qc: "Reference density block every 20; duplicate 1 in 20 within 2%; water temperature recorded.",
    triggers: ["Duplicate differs by more than 2%: repeat", "Bulk density above pulp SG: check the wax correction and repeat"],
    retention: [{ item: "Core pieces", days: 30, then: "Returned to core shed" }, { item: "Pulp", days: 90, then: "Disposed" }] },
  { code: "SETTLE", name: "Settling & rheology (thickener, flocculant)", tests: ["settle"], types: ["plant_feed", "plant_tails", "tsf", "met_comp", "cil_slurry"], purposes: ["met", "plant"],
    desc: "Flocculant choice and dose, settling rate and underflow density for thickeners, and slurry yield stress and viscosity for pumping and tailings deposition.",
    stages: [
      S("log", "Slurry log, % solids & pH", 1, "intake"),
      S("floc", "Flocculant screening (type and dose)", 4, "test", "Several flocculants at 10–40 g/t in 1 L cylinders."),
      S("settle", "Cylinder settling: rate, underflow density, supernatant clarity", 8, "test", "", true),
      S("dyn", "Dynamic (bench thickener) test", 8, "test", "On request; gives thickener area and underflow density."),
      S("rheo", "Rheology: yield stress (vane) & viscosity vs % solids", 8, "test"),
      S("calc", "Thickener sizing & flocculant consumption", 2, "test"),
      S("qc", "Metallurgist review", 4, "qc")
    ],
    qc: "Viscometer checked with a standard oil; repeat cylinder at the chosen dose agrees within 10%.",
    triggers: ["Supernatant cloudy at every dose: repeat with a coagulant", "Yield stress rises sharply near the target density: test lower densities"],
    retention: [{ item: "Slurry", days: 30, then: "Disposed" }] },
  { code: "DELET", name: "Deleterious & cyanicide elements (Cu, As, Sb, Hg…)", tests: ["delet"], types: ["*"], purposes: ["met", "plant"],
    desc: "Elements that consume cyanide, lock up gold or need special handling: copper (especially cyanide-soluble), arsenic, antimony, bismuth, tellurium, mercury.",
    stages: [
      S("sort", "Sorting & QC insertion", 0.5, "intake"),
      S("dry", "Drying at 60 °C or below", 12, "prep", "Low temperature so mercury is not lost."),
      S("pulv", "Crush & pulverise to 80% passing 75 µm", 4, "prep"),
      S("weigh", "Weighing", 1, "test"),
      S("digest", "Aqua regia digest & ICP-OES: Cu, As, Sb, Bi, Te, Pb, Zn, Ni", 8, "test", "", true),
      S("hg", "Mercury by cold-vapour AAS", 6, "test", "Separate low-temperature digest."),
      S("cncu", "Cyanide-soluble copper", 8, "test", "The copper that will consume cyanide in the leach."),
      S("qc", "QA/QC review", 1, "qc")
    ],
    qc: "CRMs for Cu, As and Hg each batch; blank; duplicate 1 in 20.",
    triggers: ["Cyanide-soluble Cu above 200 ppm: flag high cyanide consumption to the plant", "As above 1% or Sb above 0.1%: flag possible refractory ore and offer diagnostic leach", "Hg above 10 ppm: flag for gold-room mercury controls"],
    retention: [{ item: "Pulp", days: 365, then: "Returned to MET" }, { item: "Coarse reject", days: 90, then: "Disposed" }] },
  { code: "MINERAL", name: "Mineralogy (XRD, QEMSCAN / MLA, gold deportment)", tests: ["mineral"], types: ["met_comp", "core", "conc", "plant_tails", "*"], purposes: ["met", "exp"],
    desc: "What the ore is made of and how the gold occurs: grain size, what it is locked in, how much is exposed. Often done by a specialist lab; record the dispatch with \"Sent to external lab\" if so.",
    stages: [
      S("log", "Sample log & sub-sample selection", 2, "intake"),
      S("prep", "Polished sections, resin blocks & XRD pulps", 24, "prep"),
      S("xrd", "XRD bulk mineralogy", 24, "test"),
      S("qem", "QEMSCAN / MLA modal mineralogy & liberation", 72, "test", "", true),
      S("au", "Gold deportment search (grain size, associations, exposure)", 72, "test", "Bright-phase search for gold grains; free, locked and attached gold."),
      S("opt", "Optical microscopy / SEM check", 16, "test"),
      S("report", "Mineralogy report", 8, "test"),
      S("qc", "Mineralogist review", 4, "qc")
    ],
    qc: "XRD standard each run; assays calculated from mineralogy reconcile with chemical assays within 10%.",
    triggers: ["Calculated assays more than 10% off chemical assays: re-check the sections", "Too few gold grains for a reliable result: prepare more sections"],
    retention: [{ item: "Polished sections & blocks", days: 365, then: "Archived in the mineralogy library" }, { item: "Pulp", days: 365, then: "Returned to MET" }] },
  { code: "CN-SPEC", name: "Cyanide speciation (free, WAD, total, SCN)", tests: ["cn_spec"], types: ["tsf", "env_water"], purposes: ["env", "plant", "hse"],
    desc: "All the cyanide forms that matter for the plant and for Cyanide Code compliance: free, weak-acid dissociable (WAD), total, thiocyanate and cyanate, plus the metals that carry them.",
    stages: [
      S("chk", "Preservation & holding-time check", 0.5, "intake", "NaOH to pH above 12, cool and dark; free CN within 24 h, others within 14 days."),
      S("filter", "Filter 0.45 µm", 0.5, "prep"),
      S("free", "Free cyanide (AgNO₃ titration or ion-selective electrode)", 1, "test", "", true),
      S("wad", "WAD cyanide (pH 4.5 distillation or flow injection)", 4, "test", "The form the Cyanide Code limits to 50 mg/L at TSF discharge."),
      S("total", "Total cyanide (strong-acid distillation)", 4, "test", "Includes iron cyanide complexes."),
      S("scn", "Thiocyanate & cyanate", 4, "test"),
      S("metals", "Cu, Fe, Zn in solution (AAS / ICP)", 3, "test", "Metal-cyanide complexes that carry WAD cyanide."),
      S("qc", "QA/QC review", 1, "qc", "Standards, spikes and duplicates.")
    ],
    qc: "Spike recovery 85–115% for each form; duplicates within 10%; free ≤ WAD ≤ total checked on every sample.",
    triggers: ["WAD cyanide above 50 mg/L at TSF discharge: alert Environment and the plant immediately", "Free above WAD or WAD above total: repeat", "Holding time exceeded: report as indicative"],
    retention: [{ item: "Solution", days: 30, then: "Cyanide destroyed, disposed" }] },
  { code: "DETOX", name: "Cyanide destruction (detox) test", tests: ["detox"], types: ["plant_tails", "tsf", "cil_slurry", "solution"], purposes: ["env", "plant"],
    desc: "SO₂/air or peroxide treatment of tails slurry at several doses to find the reagent use that brings WAD cyanide below the discharge target.",
    stages: [
      S("log", "Slurry log: WAD CN, Cu & pH baseline", 3, "intake"),
      S("setup", "Reactor set-up at plant density & temperature", 1, "prep"),
      S("run", "SO₂/air (or peroxide) runs at several reagent doses", 8, "test", "Copper sulphate catalyst; pH 8–9 held with lime; samples every 15–30 min.", true),
      S("cn", "WAD & free cyanide on each sample", 6, "test"),
      S("calc", "Reagent dose for the WAD target (below 50 mg/L)", 2, "test"),
      S("qc", "Metallurgist review", 2, "qc")
    ],
    qc: "WAD cyanide standard each run; the chosen dose repeated to confirm.",
    triggers: ["Target not reached at the highest dose: increase copper catalyst or residence time and repeat"],
    retention: [{ item: "Treated slurry", days: 7, then: "Disposed" }] },
  { code: "ABA", name: "Acid-base accounting & NAG (acid rock drainage)", tests: ["aba"], types: ["waste", "tsf", "core", "rc", "env_soil", "*"], purposes: ["env"],
    desc: "Predicts whether waste rock or tailings will generate acid: sulphide sulphur, neutralising capacity and net acid generation.",
    stages: [
      S("sort", "Sorting & QC insertion", 0.5, "intake"),
      S("dry", "Drying at 40 °C or below", 12, "prep"),
      S("pulv", "Crush & pulverise", 4, "prep"),
      S("paste", "Paste pH & EC", 2, "test"),
      S("s", "Total & sulphide sulphur (LECO)", 6, "test", "Maximum potential acidity from sulphide sulphur."),
      S("anc", "Acid neutralising capacity (Sobek titration)", 8, "test", "", true),
      S("nag", "Net acid generation test (NAG pH)", 24, "test", "Peroxide oxidation, then titration."),
      S("calc", "NAPP & classification (PAF / NAF / uncertain)", 2, "test"),
      S("qc", "QA/QC review", 1, "qc")
    ],
    qc: "ARD reference material each batch; duplicate 1 in 20.",
    triggers: ["NAPP and NAG disagree (uncertain): run kinetic column testing", "Potentially acid-forming: notify Environment for waste-dump placement"],
    retention: [{ item: "Pulp", days: 365, then: "Disposed" }] },
  { code: "AR-AU", name: "Soil gold: aqua regia / BLEG (low level)", tests: ["ar_au"], types: ["soil_geo"], purposes: ["exp"],
    desc: "Parts-per-billion gold for soil and stream-sediment geochemistry, from a large aqua regia digest or bulk cyanide leach (BLEG).",
    stages: [
      S("sort", "Sorting & QC insertion", 0.5, "intake"),
      S("dry", "Drying at 60 °C or below", 12, "prep"),
      S("sieve", "Sieve to −180 µm (−80 mesh)", 4, "prep"),
      S("weigh", "Weighing 25–50 g", 1, "test"),
      S("digest", "Aqua regia digest (or BLEG cyanide leach)", 8, "test", "", true),
      S("read", "Au by ICP-MS or solvent-extraction AAS", 4, "test", "Detection about 1 ppb Au."),
      S("qc", "QA/QC review", 1, "qc")
    ],
    qc: "Low-level CRM and blank every 20; field duplicates as supplied.",
    triggers: ["Au above 1 g/t: repeat by fire assay", "Duplicates differ by more than 30% at low levels: repeat"],
    retention: [{ item: "Sieved fraction", days: 365, then: "Returned to exploration" }, { item: "Oversize", days: 30, then: "Disposed" }] },
  { code: "CHECK", name: "AuFx: check / umpire assay (external lab)", tests: ["check"], types: ["pulp", "*"], purposes: ["qc"],
    desc: "A share of pulps re-assayed blind at an independent lab to prove the site lab has no bias, as resource reporting codes expect.",
    stages: [
      S("select", "Select pulps (5% of batch, all high grades) & renumber blind", 2, "intake", "Original IDs replaced with blind numbers; CRMs inserted."),
      S("dispatch", "Dispatch to umpire lab with chain of custody", 2, "prep", "Waybill number recorded as the reference."),
      S("ext", "Umpire lab analysis", 240, "test", "Usually 5–10 days at the external lab.", true),
      S("compare", "Compare with original results (RPD, HARD plot, bias)", 2, "test"),
      S("qc", "QA/QC manager review", 2, "qc")
    ],
    qc: "90% of pairs within ±10% (half absolute relative difference); CRMs in the umpire batch pass.",
    triggers: ["Bias above 5% between labs: review the original batch and repeat", "Umpire CRMs fail: ask the umpire lab to repeat"],
    retention: [{ item: "Pulp", days: 365, then: "Kept in secure store" }] },
  /* ---- Version 23: the routes the lab runs, in its own words. Plant samples are a slurry or a solution: a slurry is filtered, the
     solution read for AuSx and the solids dried, pulverised and fire assayed for AuFx; CCD and TSF samples add cyanide (NaCN and WAD). ---- */
  { code: "AUFX-AUSX", transit: 2, name: "Slurry: AuFx & AuSx", tests: ["aufx_ausx"], types: ["plant_feed", "ccd"], purposes: ["plant", "recon", "met"],
    desc: "Plant slurry: filtered, the solution read for AuSx, the solids dried, pulverised and fire assayed for AuFx.",
    stages: [
      S("wet", "Weigh slurry & % solids", 0.25, "test", "pH and NaCN read now when asked: cyanide does not keep."),
      S("filter", "Filter: solution from solids", 0.5, "prep", "Pressure or vacuum filter; the filtrate is kept for AuSx."),
      S("ausx", "AuSx: solution gold by AAS", 1, "test", "Solvent extraction (DIBK) for low levels."),
      S("dry", "Drying the solids at 105 °C", 1.5, "prep", "Cake washed first so solution gold does not report to the solids."),
      S("pulv", "Pulverising to 80% passing 75 µm", 0.75, "prep"),
      S("fuse", "Fire assay: fusion & cupellation", 1.75, "test", "Lead collection, 50 g charge.", true),
      S("aufx", "AuFx: AAS finish", 0.5, "test", "Solids gold in g/t."),
      S("qc", "QA/QC review", 0.5, "qc")
    ],
    triggers: ["AuFx or AuSx far off the shift trend: repeat from the kept pulp or filtrate", "Plant CRM outside ±2 SD: repeat the shift set"],
    retention: [{ item: "Pulp", days: 30, then: "Disposed" }, { item: "Filtrate", days: 7, then: "Cyanide destroyed, disposed" }] },
  { code: "AUFX", transit: 2, name: "Solids: AuFx", tests: ["aufx"], types: ["plant_feed", "ccd", "tsf", "belt"], purposes: ["plant", "recon", "met"],
    desc: "Head grade of a plant slurry or solids sample: dried, pulverised and fire assayed for AuFx.",
    stages: [
      S("wet", "Weigh & % solids", 0.25, "test"),
      S("dry", "Drying at 105 °C", 1.5, "prep", "Slurry filtered and the cake washed first."),
      S("pulv", "Pulverising to 80% passing 75 µm", 0.75, "prep"),
      S("fuse", "Fire assay: fusion & cupellation", 1.75, "test", "Lead collection, 50 g charge.", true),
      S("aufx", "AuFx: AAS finish", 0.5, "test", "Solids gold in g/t."),
      S("qc", "QA/QC review", 0.5, "qc")
    ],
    triggers: ["AuFx far off the shift trend: repeat from the kept pulp", "Plant CRM outside ±2 SD: repeat the shift set"],
    retention: [{ item: "Pulp", days: 30, then: "Disposed" }] },
  { code: "BELT", transit: 2, name: "Belt cut: AuFx & moisture", tests: ["aufx_m"], types: ["belt"], purposes: ["plant", "recon"],
    desc: "Belt cut of the mill feed: weighed wet and dry for moisture, crushed, pulverised and fire assayed for AuFx.",
    stages: [
      S("wet", "Weigh wet", 0.25, "test", "Weighed as soon as the bag is opened."),
      S("dry", "Drying at 105 °C", 6, "prep"),
      S("dryw", "Weigh dry: moisture", 0.25, "test"),
      S("crush", "Crush to 2 mm", 0.5, "prep"),
      S("split", "Split", 0.25, "prep", "Coarse reject bagged and kept."),
      S("pulv", "Pulverising to 80% passing 75 µm", 0.75, "prep"),
      S("fuse", "Fire assay: fusion & cupellation", 1.75, "test", "Lead collection, 50 g charge.", true),
      S("aufx", "AuFx: AAS finish", 0.5, "test", "Solids gold in g/t."),
      S("qc", "QA/QC review", 0.5, "qc")
    ],
    triggers: ["AuFx far off the shift trend: repeat from the kept pulp"],
    retention: [{ item: "Pulp", days: 30, then: "Disposed" }, { item: "Coarse reject", days: 7, then: "Disposed" }] },
  { code: "AUSX", transit: 2, name: "Solution: AuSx", tests: ["ausx"], types: ["plant_feed", "ccd", "tsf"], purposes: ["plant", "recon", "met"],
    desc: "Plant solution: filtered and read for AuSx.",
    stages: [
      S("filter", "Filter 0.45 µm", 0.25, "prep", "Carbon fines and solids removed so they add no gold."),
      S("ausx", "AuSx: solution gold by AAS", 1, "test", "Solvent extraction (DIBK) for low levels.", true),
      S("qc", "QA/QC review", 0.5, "qc")
    ],
    triggers: ["AuSx far off the shift trend: repeat from the kept solution"],
    retention: [{ item: "Solution", days: 7, then: "Cyanide destroyed, disposed" }] },
  { code: "AUFX-AUSX-CN", transit: 2, name: "Slurry: AuFx, AuSx & cyanide", tests: ["aufx_ausx_cn"], types: ["ccd", "tsf"], purposes: ["plant", "env", "recon", "met"],
    desc: "CCD or TSF slurry: filtered, the solution read at once for cyanide (NaCN, WAD) and AuSx, the solids fire assayed for AuFx.",
    stages: [
      S("wet", "Weigh slurry & % solids", 0.25, "test"),
      S("filter", "Filter: solution from solids", 0.5, "prep", "Filtrate split at once: one part for cyanide, one for AuSx."),
      S("cn", "Cyanide: NaCN, WAD & pH", 1.5, "test", "Free cyanide (NaCN) by AgNO₃ titration straight away; WAD by distillation or flow injection."),
      S("ausx", "AuSx: solution gold by AAS", 1, "test", "Solvent extraction (DIBK)."),
      S("dry", "Drying the solids at 105 °C", 1.5, "prep", "Cake washed first so solution gold does not report to the solids."),
      S("pulv", "Pulverising to 80% passing 75 µm", 0.75, "prep"),
      S("fuse", "Fire assay: fusion & cupellation", 1.75, "test", "Lead collection, 50 g charge.", true),
      S("aufx", "AuFx: AAS finish", 0.5, "test", "Solids gold in g/t."),
      S("qc", "QA/QC review", 0.5, "qc")
    ],
    triggers: ["WAD cyanide over 50 mg/L at the TSF: alert Environment and the plant at once", "AuSx or AuFx far off the shift trend: repeat from the kept filtrate or pulp"],
    retention: [{ item: "Pulp", days: 30, then: "Disposed" }, { item: "Filtrate", days: 7, then: "Cyanide destroyed, disposed" }] },
  { code: "AUSX-CN", transit: 2, name: "Solution: AuSx & cyanide", tests: ["ausx_cn"], types: ["ccd", "tsf"], purposes: ["plant", "env", "recon", "met"],
    desc: "CCD overflow, decant pond or return water: cyanide (NaCN, WAD) read at once, then AuSx.",
    stages: [
      S("filter", "Filter 0.45 µm", 0.25, "prep"),
      S("cn", "Cyanide: NaCN, WAD & pH", 1.5, "test", "Free cyanide (NaCN) by AgNO₃ titration straight away; WAD by distillation or flow injection.", true),
      S("ausx", "AuSx: solution gold by AAS", 1, "test", "Solvent extraction (DIBK)."),
      S("qc", "QA/QC review", 0.5, "qc")
    ],
    triggers: ["WAD cyanide over 50 mg/L in the decant pond: alert Environment and the plant at once"],
    retention: [{ item: "Solution", days: 7, then: "Cyanide destroyed, disposed" }] },
  { code: "CN", transit: 2, name: "Cyanide: NaCN, WAD & pH", tests: ["cn_only"], types: ["plant_feed", "ccd", "tsf"], purposes: ["plant", "env", "met"],
    desc: "Cyanide control on a tails grab, TSF spigot or pond: free cyanide (NaCN), WAD cyanide and pH.",
    stages: [
      S("filter", "Filter 0.45 µm", 0.25, "prep"),
      S("cn", "Cyanide: NaCN, WAD & pH", 1.5, "test", "Free cyanide (NaCN) by AgNO₃ titration straight away; WAD by distillation or flow injection.", true),
      S("qc", "QA/QC review", 0.5, "qc")
    ],
    triggers: ["WAD cyanide over 50 mg/L at the TSF: alert Environment and the plant at once"],
    retention: [{ item: "Solution", days: 7, then: "Cyanide destroyed, disposed" }] },
  { code: "C-LOAD", transit: 2, name: "Carbon: Au loading", tests: ["c_load"], types: ["carbon"], purposes: ["plant", "recon", "met"],
    desc: "Gold loading on CIL tank, loaded, eluted or regenerated carbon: ashed, digested and read by AAS.",
    stages: [
      S("wash", "Wash & screen carbon", 0.5, "prep", "Fines and grit removed; the bag opened under gold-room custody."),
      S("dry", "Drying at 105 °C", 3, "prep"),
      S("split", "Riffle split & weigh", 0.5, "prep"),
      S("ash", "Ashing at 700 °C", 3, "test"),
      S("load", "Au loading: aqua regia digest & AAS", 2, "test", "Carbon CRM with each run.", true),
      S("qc", "QA/QC review", 0.5, "qc")
    ],
    triggers: ["Eluted carbon above 100 g/t Au: repeat and notify the elution operator", "Repeat differs by more than 10%: repeat the loading"],
    retention: [{ item: "Carbon sample", days: 30, then: "Returned to gold room" }] },
  { code: "ELU-AUSX", transit: 2, name: "Elution solution: AuSx, AgSx & Cu", tests: ["elu_sol"], types: ["elution"], purposes: ["plant", "recon", "met"],
    desc: "Pregnant solution, electrowinning head and tails and eluate: AuSx, AgSx and copper, with NaOH, NaCN and pH.",
    stages: [
      S("custody", "Custody check & log", 0.25, "intake", "Sealed bottle; strip number and time recorded."),
      S("filter", "Filter 0.45 µm", 0.25, "prep", "Carbon fines removed."),
      S("dilute", "Dilution by weight (high-grade solutions)", 0.25, "prep"),
      S("aas", "AuSx, AgSx & Cu by AAS", 1.5, "test", "Standards matched to the caustic-cyanide solution.", true),
      S("chem", "NaOH, NaCN & pH", 0.5, "test", "Eluant strength."),
      S("qc", "QA/QC review", 0.5, "qc")
    ],
    triggers: ["Electrowinning tails above 5 mg/L AuSx: check the cells and current", "Duplicate dilutions differ by more than 2%: repeat"],
    retention: [{ item: "Solution", days: 30, then: "Returned to the gold room" }] }
];
/* Results each test reports. k: analyte code, n: name, u: unit, dl: detection limit (lower values report as "<DL"), ul: upper limit of the
   method (higher values are over-range and need the re-assay route in `over`, else a dilution and re-assay), dp: decimals, t: "text" for a
   written result or "pick" for one of `opts`, opt: optional, calc: worked out from the results in `from` (never typed; "<DL" counts as 0),
   exact: a reference material must be certified for this exact result (not just the element). chk: acceptance checks on one sample's results;
   a failed check holds the release until the sample is re-assayed or a supervisor accepts it with a reason. qc: the analyte a lab batch checks
   when the route names no other (default the first). Action and permit limits are settings (Settings tab), not part of the method. */
const A = (k, n, u, dl, dp, x = {}) => ({ k, n, u, ...(dl != null ? { dl } : {}), dp, ...x });
/* The plant results, as the lab's reports name them (s: the short name). Detection limits are low enough for the report's smallest values. */
const AUFX = (x = {}) => A("Au", "AuFx, gold in solids", "g/t", 0.01, 2, { s: "AuFx", ...x });
const AUSX = (x = {}) => A("Au_s", "AuSx, gold in solution", "mg/L", 0.001, 3, { s: "AuSx", ...x });
const AGSX = (x = {}) => A("Ag_s", "AgSx, silver in solution", "mg/L", 0.001, 3, { s: "AgSx", opt: true, ...x });
const NACN = (x = {}) => A("cn", "NaCN, free cyanide", "mg/L", null, 0, { s: "NaCN", ...x });
const CNWAD = (x = {}) => A("wad", "WAD cyanide", "mg/L", 0.01, 2, { s: "CNWAD", ...x });
const PH = () => A("pH", "pH", "", null, 1, { opt: true });
const SOLIDS = () => A("sol", "Solids", "%", null, 2, { s: "% solids", opt: true });
const SCREEN = () => A("scr", "Screen analysis, % retained", "", null, 0, { t: "text", opt: true });
const METALS = () => [["Cu", "Copper"], ["Fe", "Iron"], ["Ni", "Nickel"], ["Zn", "Zinc"]].map(([k, n]) => A(k, n, "mg/L", 0.01, 2, { opt: true }));
const PICK = (n, opts) => A("pt", n, "", null, 0, { t: "pick", opts });
const RESULTS = {
  fa_aas:   { an: [A("Au", "AuFx, gold in solids", "g/t", 0.005, 3, { s: "AuFx", ul: 10 })], over: "fa_grav" },
  fa_grav:  { an: [A("Au", "AuFx, gold in solids", "g/t", 0.05, 2, { s: "AuFx" })] },
  sfa:      { an: [A("Au", "AuFx, total (weighted)", "g/t", 0.01, 2, { s: "AuFx", calc: v => (v.m_c * v.Au_c + (100 - v.m_c) * (v.Au_f + v.Au_f2) / 2) / 100, from: ["m_c", "Au_c", "Au_f", "Au_f2"] }), A("Au_c", "Gold in +75 µm fraction", "g/t", 0.05, 2), A("Au_f", "Gold in −75 µm, assay 1", "g/t", 0.01, 2),
                   A("Au_f2", "Gold in −75 µm, assay 2", "g/t", 0.01, 2), A("m_c", "+75 µm fraction", "% of mass", null, 1), A("loss", "Screen mass loss", "%", null, 2)],
              chk: [{ t: "max", k: "loss", max: 2, msg: "screen mass loss over 2%" }, { t: "pair", a: "Au_f", b: "Au_f2", tol: 10, msg: "the two −75 µm assays differ by more than 10%" }], qc: "Au_f" },
  ar_au:    { an: [A("Au", "Gold", "ppb", 1, 0, { ul: 10000 })] },
  check:    { an: [A("Au", "AuFx, external lab", "g/t", 0.005, 3, { s: "AuFx" }), A("Au_o", "AuFx, original result", "g/t", 0.005, 3)],
              chk: [{ t: "pair", a: "Au", b: "Au_o", tol: 20, soft: true, msg: "the check assay differs from the original by more than ±10% (half absolute relative difference); the rule is that 90% of pairs agree" }] },
  cn_sol:   { an: [A("Au", "Cyanide-soluble gold", "g/t", 0.01, 2), A("Au_r", "Gold in residue", "g/t", 0.01, 2), A("rec", "Cyanide-soluble share", "%", null, 1, { calc: v => v.Au + v.Au_r > 0 ? v.Au / (v.Au + v.Au_r) * 100 : null, from: ["Au", "Au_r"] })] },
  bottle:   { an: [A("head", "Head grade (assayed)", "g/t", 0.01, 2), A("chead", "Head grade (calculated)", "g/t", 0.01, 2), A("res", "Residue grade", "g/t", 0.01, 2),
                   A("rec", "Gold recovery", "%", null, 1, { calc: v => v.chead > 0 ? (v.chead - v.res) / v.chead * 100 : null, from: ["chead", "res"] }), A("nacn", "NaCN consumption", "kg/t", null, 2), A("lime", "Lime consumption", "kg/t", null, 2)],
              chk: [{ t: "pair", a: "chead", b: "head", tol: 10, msg: "calculated head is more than 10% from the assayed head" }] },
  cil_test: { an: [A("head", "Head grade (assayed)", "g/t", 0.01, 2), A("chead", "Head grade (calculated: solution + carbon + residue)", "g/t", 0.01, 2), A("res", "Residue grade", "g/t", 0.01, 2),
                   A("carb", "Loaded carbon", "g/t", 1, 0), A("rec", "Gold recovery", "%", null, 1, { calc: v => v.chead > 0 ? (v.chead - v.res) / v.chead * 100 : null, from: ["chead", "res"] }), A("nacn", "NaCN consumption", "kg/t", null, 2)],
              chk: [{ t: "pair", a: "chead", b: "head", tol: 10, msg: "gold balance is more than 10% from the head grade" }] },
  pri:      { an: [A("pri", "Preg-robbing index", "%", null, 1), A("spk", "Blank spike recovery", "%", null, 1), A("head", "Head grade", "g/t", 0.01, 2)],
              chk: [{ t: "range", k: "spk", lo: 95, hi: 105, msg: "blank spike recovery outside 95–105%" }] },
  diag:     { an: [A("head", "Head grade", "g/t", 0.01, 2), A("s1", "Free / cyanidable gold", "g/t", 0.01, 2), A("s2", "Gold in carbonates (HCl)", "g/t", 0.01, 2),
                   A("s3", "Gold in sulphides (HNO₃)", "g/t", 0.01, 2), A("s4", "Gold with carbonaceous matter", "g/t", 0.01, 2), A("s5", "Gold locked in silicates", "g/t", 0.01, 2)],
              chk: [{ t: "sum", ks: ["s1", "s2", "s3", "s4", "s5"], k: "head", tol: 10, msg: "the stages add up to more than 10% away from the head grade" }] },
  reagent:  { an: [A("nacn", "NaCN consumption", "kg/t", null, 2), A("lime", "Lime consumption", "kg/t", null, 2), A("rec", "Gold recovery", "%", null, 1),
                   A("head", "Head grade (assayed)", "g/t", 0.01, 2), A("chead", "Head grade (calculated)", "g/t", 0.01, 2)],
              chk: [{ t: "pair", a: "chead", b: "head", tol: 10, msg: "calculated head is more than 10% from the assayed head" }] },
  o2:       { an: [A("our", "Oxygen uptake rate", "mg/L/min", null, 3), A("sat", "Dissolved oxygen at saturation", "mg/L", null, 1), A("temp", "Slurry temperature", "°C", null, 1)] },
  column:   { an: [A("head", "Head grade (assayed)", "g/t", 0.01, 2), A("chead", "Head grade (calculated)", "g/t", 0.01, 2), A("rec", "Gold recovery", "%", null, 1),
                   A("nacn", "NaCN consumption", "kg/t", null, 2), A("cem", "Cement for agglomeration", "kg/t", null, 1), A("days", "Leach time", "days", null, 0)],
              chk: [{ t: "pair", a: "chead", b: "head", tol: 10, msg: "calculated head is more than 10% from the assayed head" }] },
  ilr:      { an: [A("head", "Concentrate grade", "g/t", 0.1, 1), A("chead", "Calculated head (solution + residue)", "g/t", 0.1, 1), A("rec", "Intensive leach recovery", "%", null, 1, { calc: v => v.chead > 0 ? (v.chead - v.res) / v.chead * 100 : null, from: ["chead", "res"] }), A("res", "Residue grade", "g/t", 0.1, 1)],
              chk: [{ t: "pair", a: "chead", b: "head", tol: 5, msg: "gold balance is more than 5% from the head grade" }] },
  grg:      { an: [A("grg", "Gravity recoverable gold", "%", null, 1), A("head", "Head grade (assayed)", "g/t", 0.01, 2), A("chead", "Head grade (calculated)", "g/t", 0.01, 2)],
              chk: [{ t: "pair", a: "chead", b: "head", tol: 15, msg: "calculated head is more than 15% from the assayed head" }] },
  flot:     { an: [A("rec", "Gold recovery to concentrate", "%", null, 1, { calc: v => v.chead > 0 ? v.mass * v.conc / v.chead : null, from: ["mass", "conc", "chead"] }), A("conc", "Concentrate grade", "g/t", 0.05, 1), A("mass", "Mass pull", "%", null, 1),
                   A("tail", "Tails grade", "g/t", 0.01, 2), A("head", "Head grade (assayed)", "g/t", 0.01, 2), A("chead", "Head grade (calculated: concentrate + tails)", "g/t", 0.01, 2, { calc: v => (v.mass * v.conc + (100 - v.mass) * v.tail) / 100, from: ["mass", "conc", "tail"] })],
              chk: [{ t: "pair", a: "chead", b: "head", tol: 10, msg: "calculated head is more than 10% from the assayed head" }] },
  commin:   { an: [A("bwi", "Bond ball mill work index", "kWh/t", null, 1), A("rwi", "Bond rod mill work index", "kWh/t", null, 1, { opt: true }), A("ai", "Abrasion index", "g", null, 3), A("axb", "SMC A×b", "", null, 1, { opt: true })] },
  density:  { an: [A("sg", "Specific gravity", "", null, 2), A("bd", "Dry bulk density", "t/m³", null, 2, { opt: true })] },
  psd:      { an: [A("p80", "P80", "µm", null, 0), A("p75", "Passing 75 µm", "%", null, 1), A("loss", "Sieve loss", "% of feed", null, 2)],
              chk: [{ t: "max", k: "loss", max: 1, msg: "sieve loss over 1% of the feed mass" }] },
  moisture: { an: [A("h2o", "Moisture", "%", null, 2)] },
  settle:   { an: [A("rate", "Settling rate", "m/h", null, 2), A("ufd", "Underflow density", "% solids", null, 1), A("floc", "Flocculant dose", "g/t", null, 0), A("ys", "Yield stress", "Pa", null, 0, { opt: true }),
                   A("rate2", "Settling rate, repeat cylinder", "m/h", null, 2)],
              chk: [{ t: "pair", a: "rate", b: "rate2", tol: 10, msg: "the repeat cylinder differs by more than 10%" }] },
  icp:      { an: [A("Cu", "Copper", "ppm", 1, 0, { ul: 10000 }), A("Ag", "Silver", "ppm", 0.5, 1, { ul: 100 }), A("As", "Arsenic", "ppm", 5, 0, { ul: 10000 }), A("Sb", "Antimony", "ppm", 5, 0, { ul: 10000 }), A("Zn", "Zinc", "ppm", 1, 0, { ul: 10000 }),
                   A("Pb", "Lead", "ppm", 2, 0, { ul: 10000 }), A("Fe", "Iron", "%", 0.01, 2, { ul: 50 }), A("S", "Sulphur", "%", 0.01, 2, { ul: 10 })] },
  delet:    { an: [A("Cu", "Copper", "ppm", 1, 0), A("Cu_cn", "Cyanide-soluble copper", "ppm", 1, 0, { exact: true }), A("As", "Arsenic", "ppm", 5, 0), A("Sb", "Antimony", "ppm", 5, 0), A("Hg", "Mercury", "ppm", 0.01, 2)],
              chk: [{ t: "le", a: "Cu_cn", b: "Cu", msg: "cyanide-soluble copper is higher than total copper" }] },
  leco:     { an: [A("S", "Total sulphur", "%", 0.01, 2, { ul: 20 }), A("S2", "Sulphide sulphur", "%", 0.01, 2, { ul: 20 }), A("C", "Total carbon", "%", 0.01, 2), A("Corg", "Organic carbon", "%", 0.01, 2)],
              chk: [{ t: "le", a: "S2", b: "S", msg: "sulphide sulphur is higher than total sulphur" }, { t: "le", a: "Corg", b: "C", msg: "organic carbon is higher than total carbon" }] },
  mineral:  { an: [A("sum", "Mineralogy summary", "", null, 0, { t: "text" }), A("Au_free", "Free and liberated gold", "% of gold", null, 0, { opt: true }), A("Au_calc", "Gold calculated from mineralogy", "g/t", 0.01, 2, { opt: true }),
                   A("Au_chem", "Gold by chemical assay", "g/t", 0.01, 2, { opt: true })],
              chk: [{ t: "pair", a: "Au_calc", b: "Au_chem", tol: 10, msg: "gold from mineralogy and chemical assay differ by more than 10%" }] },
  plant_solids: { an: [A("Au", "Head grade", "g/t", 0.01, 2, { ul: 50 }), A("p75", "Grind, passing 75 µm", "%", null, 1, { opt: true }), A("scr", "Screen analysis, % retained", "", null, 0, { t: "text", opt: true }), A("h2o", "Moisture", "%", null, 1, { opt: true })], over: "fa_grav" },
  ccd:      { an: [A("pt", "Sampling point", "", null, 0, { t: "pick", opts: ["Thickener feed", "Intermediate thickener", "Final underflow"] }), A("Au_s", "Solution gold", "mg/L", 0.005, 3), A("Au", "Solids gold", "g/t", 0.01, 2),
                   A("cn", "Free cyanide", "mg/L", null, 0, { opt: true }), A("wash", "Wash efficiency (from the survey sheet)", "%", null, 1, { opt: true })], qc: "Au_s" },
  residue:  { an: [A("Au", "Solid tails gold", "g/t", 0.01, 3), A("Au_s", "Solution tails gold", "mg/L", 0.005, 3)] },
  cil_survey: { an: [A("pt", "Sampling point", "", null, 0, { t: "pick", opts: ["Leach tank", "Adsorption tank", "Last tank"] }), A("Au_s", "Solution gold", "mg/L", 0.005, 3), A("Au_c", "Carbon gold", "g/t", 1, 0), A("cc", "Carbon concentration", "g/L", null, 1), A("cn", "Free cyanide", "mg/L", null, 0),
                   A("pH", "pH", "", null, 1), A("sol", "Slurry density", "% solids", null, 1)] },
  carbon:   { an: [A("pt", "Carbon from", "", null, 0, { t: "pick", opts: ["Loaded carbon", "Eluted carbon", "Regenerated carbon", "Fresh carbon", "Tank carbon"] }), A("Au_c", "Gold loading", "g/t", 1, 0), A("act", "Activity (relative to fresh carbon)", "%", null, 0), A("fines", "Fines", "%", null, 1, { opt: true })] },
  eluate:   { an: [A("pt", "Sampling point", "", null, 0, { t: "pick", opts: ["Pregnant eluate", "End of strip", "Electrowinning feed", "Electrowinning discharge"] }), A("Au", "Gold", "mg/L", 0.01, 2, { ul: 2000 }), A("Ag", "Silver", "mg/L", 0.01, 2), A("Cu", "Copper", "mg/L", 0.1, 1, { opt: true }), A("nacn", "NaCN", "g/L", null, 1, { opt: true }), A("naoh", "NaOH", "g/L", null, 1, { opt: true })] },
  elution:  { an: [A("load", "Loaded carbon gold", "g/t", 1, 0), A("barren", "Barren carbon gold", "g/t", 1, 0), A("eff", "Strip efficiency", "%", null, 1, { calc: v => v.load > 0 ? (v.load - v.barren) / v.load * 100 : null, from: ["load", "barren"] }), A("cload", "Calculated loaded carbon (eluate + barren)", "g/t", 1, 0)],
              chk: [{ t: "pair", a: "cload", b: "load", tol: 10, msg: "gold balance (eluate + barren carbon) is more than 10% from the loaded carbon" }] },
  solution: { an: [A("pt", "Sampling point", "", null, 0, { t: "pick", opts: ["Pregnant solution", "Barren solution", "Process water", "Other"] }), A("Au", "Gold", "mg/L", 0.005, 3), A("Ag", "Silver", "mg/L", 0.01, 2, { opt: true }), A("Cu", "Copper", "mg/L", 0.1, 1, { opt: true }), A("cn", "Free cyanide", "mg/L", null, 0),
                   A("wad", "WAD cyanide", "mg/L", null, 0, { opt: true }), A("pH", "pH", "", null, 1)] },
  conc:     { an: [A("Au", "AuFx, gold in concentrate", "g/t", 0.05, 1, { s: "AuFx" }), A("Ag", "Silver", "g/t", 0.5, 1, { opt: true }), A("Hg", "Mercury", "ppm", 0.1, 1), A("As", "Arsenic", "%", 0.01, 2), A("S", "Sulphur", "%", 0.01, 2, { opt: true })] },
  bullion:  { an: [A("Au", "Gold fineness", "‰", null, 1), A("Ag", "Silver", "‰", null, 1), A("base", "Base metals and other", "‰", null, 1), A("mass", "Bar mass", "g", null, 2), A("tb", "Top and bottom difference", "‰", null, 1)],
              chk: [{ t: "max", k: "tb", max: 2, msg: "top and bottom differ by more than 2 parts per thousand" }] },
  tsf:      { an: [A("wad", "WAD cyanide", "mg/L", 0.01, 1), A("Au_s", "Solution gold", "mg/L", 0.005, 3), A("Au", "Solids gold", "g/t", 0.01, 2), A("pH", "pH", "", null, 1), A("S", "Total sulphur", "%", 0.01, 2, { opt: true })], qc: "wad" },
  cn_spec:  { an: [A("free", "Free cyanide", "mg/L", 0.01, 2), A("wad", "WAD cyanide", "mg/L", 0.01, 2), A("total", "Total cyanide", "mg/L", 0.01, 2), A("scn", "Thiocyanate", "mg/L", 0.1, 1), A("cno", "Cyanate", "mg/L", 0.5, 1, { opt: true })],
              chk: [{ t: "le", a: "free", b: "wad", msg: "free cyanide is higher than WAD cyanide" }, { t: "le", a: "wad", b: "total", msg: "WAD cyanide is higher than total cyanide" }], qc: "wad" },
  detox:    { an: [A("wad_in", "WAD cyanide before", "mg/L", 0.01, 1), A("wad", "WAD cyanide after", "mg/L", 0.01, 2), A("wad_rep", "WAD cyanide after, repeat at the chosen dose", "mg/L", 0.01, 2),
                   A("dose", "Reagent dose", "g per g WAD CN", null, 1), A("Cu", "Copper (catalyst)", "mg/L", null, 1, { opt: true })],
              chk: [{ t: "pair", a: "wad", b: "wad_rep", tol: 20, msg: "the repeat at the chosen dose differs by more than 20%" }] },
  aba:      { an: [A("np", "Neutralisation potential", "kg CaCO₃/t", null, 1), A("ap", "Acid potential", "kg CaCO₃/t", null, 1), A("nnp", "Net neutralisation potential (NP − AP)", "kg CaCO₃/t", null, 1, { calc: v => v.np - v.ap, from: ["np", "ap"] }), A("nag", "NAG pH", "", null, 1)] },
  water:    { an: [A("pH", "pH", "", null, 1), A("ec", "Conductivity", "µS/cm", null, 0), A("tss", "Suspended solids", "mg/L", 1, 0), A("wad", "WAD cyanide", "mg/L", 0.005, 3), A("free", "Free cyanide", "mg/L", 0.005, 3, { opt: true }),
                   A("As", "Arsenic", "mg/L", 0.001, 3), A("Hg", "Mercury", "mg/L", 0.0001, 4), A("Cu", "Copper", "mg/L", 0.001, 3), A("Fe", "Iron", "mg/L", 0.01, 2, { opt: true })], qc: "wad" },
  soil:     { an: [A("As", "Arsenic", "mg/kg", 1, 0), A("Hg", "Mercury", "mg/kg", 0.01, 2), A("Pb", "Lead", "mg/kg", 1, 0), A("Cu", "Copper", "mg/kg", 1, 0), A("cn", "Total cyanide", "mg/kg", 0.5, 1), A("pH", "pH", "", null, 1)] },
  aufx_ausx:    { an: [PICK("Sampling point", PLANT_PTS), AUFX(), AUSX(), AGSX(), PH(), NACN({ opt: true }), SOLIDS(), SCREEN()], qc: "Au" },
  aufx:         { an: [PICK("Sampling point", PLANT_PTS), AUFX(), SOLIDS(), SCREEN()], qc: "Au" },
  aufx_m:       { an: [PICK("Conveyor", BELT_PTS), A("h2o", "Moisture", "%", null, 2, { s: "Moisture" }), AUFX()], qc: "Au" },
  ausx:         { an: [PICK("Sampling point", PLANT_PTS), AUSX(), AGSX(), PH(), NACN({ opt: true })], qc: "Au_s" },
  aufx_ausx_cn: { an: [PICK("Sampling point", PLANT_PTS), AUFX(), AUSX(), CNWAD(), NACN({ opt: true }), PH(), SOLIDS(), ...METALS()], qc: "Au" },
  ausx_cn:      { an: [PICK("Sampling point", PLANT_PTS), AUSX(), CNWAD(), NACN({ opt: true }), PH(), ...METALS()], qc: "Au_s" },
  cn_only:      { an: [PICK("Sampling point", PLANT_PTS), CNWAD(), NACN({ opt: true }), PH(), ...METALS()], qc: "wad" },
  c_load:       { an: [PICK("Carbon type", CARBON_PTS), A("Au_c", "Au loading", "g/t", 1, 2, { s: "Au loading" })], qc: "Au_c" },
  elu_sol:      { an: [PICK("Solution", ELU_PTS), AUSX({ ul: 2000 }), AGSX(), ...METALS(), A("naoh", "NaOH", "%", null, 2, { opt: true }), NACN({ opt: true }), PH()], qc: "Au_s" }
};
/* Lab QC batch profiles. size: routine samples per batch; ins: QC positions per batch (pb preparation blank, cd crusher duplicate,
   pd pulp duplicate, crm reference material, bl blank); all: every sample run again `all` times. crm rule: sd (±SD bands), pct (±% of the
   certified value), rec (recovery %), abs (± absolute). blank: multiple of the detection limit. pbBlank: the same for the preparation blank, which also
   measures carry-over in the crusher and pulveriser, so it is allowed more. pd / cd: duplicate tolerance, relative % above `dupMin`× the
   detection limit; dupAbs: absolute tolerance instead. A batch that checks several analytes judges every QC position on each of them. */
const QC_PROFILES = {
  fa50:   { name: "Fire assay, 50-position furnace batch", prefix: "FA", batch: "50-position furnace batch", size: 43, ins: { pb: 1, cd: 1, pd: 2, crm: 2, bl: 1 }, crm: { mode: "sd", warn: 2, fail: 3 }, blank: 5, pbBlank: 10, pd: 20, cd: 30, dupMin: 10, names: { bl: "analytical blank" } },
  gc25:   { name: "Grade control fire assay, 25-position batch", prefix: "GC", batch: "25-position batch", size: 22, ins: { crm: 1, bl: 1, pd: 1 }, crm: { mode: "sd", warn: 2, fail: 3 }, blank: 5, pd: 20, dupMin: 10 },
  grav:   { name: "Gravimetric fire assay batch", prefix: "FG", batch: "batch of up to 12 samples", size: 12, ins: { crm: 1, bl: 1 }, all: 1, crm: { mode: "sd", warn: 2, fail: 3 }, blank: 5, pd: 10, dupMin: 10, names: { crm: "high-grade CRM" } },
  sfa:    { name: "Screen fire assay batch", prefix: "SF", batch: "batch of up to 20 samples", size: 20, ins: { crm: 1, bl: 1 }, crm: { mode: "sd", warn: 2, fail: 3 }, blank: 5 },
  plant:  { name: "Plant shift batch (Mill samples)", prefix: "PL", batch: "shift batch", size: 30, ins: { crm: 1, bl: 1, pd: 1 }, crm: { mode: "sd", warn: 2, fail: 2 }, blank: 5, pd: 10, dupMin: 10, names: { crm: "plant CRM", pd: "duplicate" } },
  tail:   { name: "Plant tails batch", prefix: "PT", batch: "batch of up to 30 samples", size: 30, ins: { crm: 1, bl: 1, pd: 1 }, crm: { mode: "sd", warn: 2, fail: 3 }, blank: 5, pd: 20, dupMin: 5, names: { crm: "low-grade CRM", pd: "residue duplicate" } },
  conc:   { name: "Concentrate batch (triplicates)", prefix: "CC", batch: "batch of up to 10 samples", size: 10, ins: { crm: 1 }, all: 2, crm: { mode: "sd", warn: 2, fail: 3 }, pd: 5, dupMin: 10, names: { crm: "high-grade CRM" } },
  bull:   { name: "Bullion fire assay batch", prefix: "BU", item: "bar", batch: "batch of up to 6 bars", size: 6, ins: { crm: 1 }, all: 1, crm: { mode: "abs", tol: 0.5 }, dupAbs: 0.5, names: { crm: "proof gold" } },
  soln:   { name: "Solution AAS run", prefix: "SL", batch: "run of up to 20 readings", size: 20, ins: { crm: 2, bl: 1, pd: 2 }, crm: { mode: "rec", lo: 90, hi: 110 }, blank: 5, pd: 10, dupMin: 10, names: { crm: "calibration check standard", pd: "duplicate" } },
  eluate: { name: "Eluate AAS run", prefix: "EL", batch: "run of up to 20 readings", size: 20, ins: { crm: 1, bl: 1, pd: 1 }, crm: { mode: "rec", lo: 95, hi: 105 }, blank: 5, pd: 2, dupMin: 10, names: { crm: "high-grade solution standard", pd: "duplicate dilution" } },
  carbon: { name: "Carbon assay batch", prefix: "CB", batch: "batch of up to 20 samples", size: 20, ins: { crm: 1, pd: 1 }, crm: { mode: "sd", warn: 2, fail: 3 }, pd: 10, dupMin: 10, names: { crm: "carbon CRM", pd: "duplicate" } },
  cyan:   { name: "Cyanide batch", prefix: "CY", batch: "batch of up to 20 samples", size: 20, ins: { crm: 1, pd: 2 }, crm: { mode: "rec", lo: 90, hi: 110 }, pd: 10, dupMin: 10, names: { crm: "cyanide check standard", pd: "duplicate" } },
  cnspec: { name: "Cyanide speciation batch", prefix: "CS", batch: "batch of up to 20 samples", size: 20, ins: { crm: 1, pd: 2 }, crm: { mode: "rec", lo: 85, hi: 115 }, pd: 10, dupMin: 10, names: { crm: "spike", pd: "duplicate" } },
  envw:   { name: "Environmental water batch", prefix: "EW", batch: "batch of up to 20 samples", size: 20, ins: { crm: 2, bl: 1, pd: 1 }, crm: { mode: "rec", lo: 85, hi: 115 }, blank: 5, pd: 20, dupMin: 5, names: { crm: "spike or check standard", bl: "method blank", pd: "laboratory duplicate" } },
  icp:    { name: "ICP batch", prefix: "IC", batch: "40-position batch", size: 36, ins: { crm: 2, bl: 1, pd: 1 }, crm: { mode: "pct", tol: 10 }, blank: 5, pd: 20, dupMin: 10, names: { pd: "replicate" } },
  multi:  { name: "Multi-element batch", prefix: "ME", batch: "batch of up to 20 samples", size: 20, ins: { crm: 2, bl: 1, pd: 1 }, crm: { mode: "pct", tol: 10 }, blank: 5, pd: 20, dupMin: 10, names: { pd: "duplicate" } },
  leco:   { name: "LECO batch", prefix: "LE", batch: "batch of up to 20 samples", size: 20, ins: { crm: 1, pd: 1 }, crm: { mode: "sd", warn: 2, fail: 3 }, pd: 5, dupMin: 10, names: { crm: "LECO CRM", pd: "duplicate" } },
  arau:   { name: "Aqua regia gold batch", prefix: "AR", batch: "batch of up to 20 samples", size: 20, ins: { crm: 1, bl: 1 }, crm: { mode: "sd", warn: 2, fail: 3 }, blank: 5, names: { crm: "low-level CRM" } },
  cnsol:  { name: "Cyanide-soluble gold batch", prefix: "LW", batch: "batch of up to 20 samples", size: 20, ins: { crm: 1, bl: 1, pd: 1 }, crm: { mode: "sd", warn: 2, fail: 3 }, blank: 5, pd: 20, dupMin: 10, names: { bl: "reagent blank", crm: "CRM with a certified cyanide-soluble value" } },
  soil:   { name: "Soil batch", prefix: "SO", batch: "batch of up to 20 samples", size: 20, ins: { crm: 1, bl: 1, pd: 1 }, crm: { mode: "pct", tol: 15 }, blank: 5, pd: 20, dupMin: 10, names: { crm: "soil CRM", pd: "duplicate" } },
  aba:    { name: "ARD batch", prefix: "AB", batch: "batch of up to 20 samples", size: 20, ins: { crm: 1, pd: 1 }, crm: { mode: "pct", tol: 10 }, pd: 10, dupMin: 10, names: { crm: "ARD reference material", pd: "duplicate" } },
  dens:   { name: "Density batch", prefix: "DN", batch: "batch of up to 20 samples", size: 20, ins: { crm: 1, pd: 1 }, crm: { mode: "pct", tol: 1 }, pd: 2, dupMin: 0, names: { crm: "reference density block", pd: "duplicate" } },
  moist:  { name: "Moisture batch", prefix: "MO", batch: "batch of up to 10 samples", size: 10, ins: { pd: 1 }, dupAbs: 0.5, names: { pd: "duplicate" } }
};
/* Which routes run in lab batches, and anything the route adds to the batch rule. Testwork routes check balances on each sample's results instead. */
const ROUTE_QC = {
  "EXP-FA": ["fa50", "Client blind QC is reported unchanged."], "GC-FA": ["gc25", "An extra pulp duplicate is run on any result within ±20% of the ore / waste cut-off grade."],
  "FA-GRAV": ["grav"], "SFA": ["sfa", "Screen mass balance loss under 2% and the two −75 µm assays within 10% are checked on each sample's results."],
  "CN-SOL": ["cnsol"], "ICP": ["icp"], "LECO": ["leco"], "MOIST": ["moist"], "PLT-HEAD": ["plant"], "PLT-TAIL": ["tail"],
  "CCD-SVY": ["soln"], "ELUATE": ["eluate"], "CIL-SVY": ["soln"],
  "CARBON": ["carbon"], "SOLN": ["soln"], "CONC": ["conc", "Two-person custody for all handling."], "BULLION": ["bull", "Top and bottom within 2 parts per thousand is checked on each bar's results."],
  "TSF-CHAR": ["cyan", "Field blanks are reported as supplied."],
  "AUFX-AUSX": ["plant"], "AUFX": ["plant"], "BELT": ["plant"], "AUSX": ["soln"], "AUFX-AUSX-CN": ["tail"], "AUSX-CN": ["soln"], "CN": ["cyan"], "C-LOAD": ["carbon"], "ELU-AUSX": ["eluate"], "ENV-W": ["envw", "Field blank, trip blank and field duplicate per sampling round, reported as supplied."],
  "ENV-S": ["soil"], "DELET": ["multi"], "CN-SPEC": ["cnspec", "Free ≤ WAD ≤ total is checked on every sample's results."], "ABA": ["aba"], "DENSITY": ["dens"], "AR-AU": ["arau", "Field duplicates are reported as supplied."]
};
const QC_NAMES = { pb: ["preparation blank", "preparation blanks"], cd: ["crusher duplicate", "crusher duplicates"], pd: ["pulp duplicate", "pulp duplicates"], crm: ["CRM", "CRMs"], bl: ["blank", "blanks"] };
const plural = s => / with /.test(s) ? s.replace(/^(.*?)( with .*)$/, (m, a, z) => a + "s" + z) : s + "s";
const qcName = (p, t, n = 1) => { const b = (p.names || {})[t]; return b ? (n === 1 ? b : plural(b)) : QC_NAMES[t][n === 1 ? 0 : 1]; };
const fmtNum = x => String(+(+x).toPrecision(6));
const listAnd = xs => xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs.at(-1);
/* The analyte a lab batch checks for a test when the route names no other: never a written, picked or calculated result. */
const qcAnalyte = res => (res && (res.an.find(a => a.k === res.qc) || res.an.find(a => !a.t && !a.calc))) || { k: "Au", n: "Gold", u: "g/t", dl: 0.005, dp: 3 };
/* Lab batches a route's samples join, one per analytical method, with the results each batch checks against its reference materials, blanks
   and duplicates. A route not listed joins the batch type in ROUTE_QC, checking the test's `qc` analyte. A sample is in at most one batch of
   each kind at a time. Results outside every batch (field readings, physical tests, calculations) are named on the certificate as such. */
const ROUTE_GROUPS = {
  "ICP": [["icp", ["Cu", "Ag", "As", "Sb", "Zn", "Pb", "Fe", "S"]]],
  "LECO": [["leco", ["S", "S2", "C", "Corg"]]],
  "DELET": [["multi", ["Cu", "Cu_cn", "As", "Sb", "Hg"]]],
  "CN-SPEC": [["cnspec", ["free", "wad", "total", "scn"]]],
  "ENV-W": [["envw", ["wad", "As", "Hg", "Cu"]]],
  "ENV-S": [["soil", ["As", "Hg", "Pb", "Cu"]]],
  "CONC": [["conc", ["Au"]], ["multi", ["Hg", "As"]]],
  "PLT-TAIL": [["tail", ["Au"]], ["soln", ["Au_s"]]],
  "CCD-SVY": [["soln", ["Au_s"]], ["tail", ["Au"]]],
  "CIL-SVY": [["soln", ["Au_s"]], ["carbon", ["Au_c"]]],
  "TSF-CHAR": [["cyan", ["wad"]], ["soln", ["Au_s"]], ["tail", ["Au"]]],
  "AUFX-AUSX": [["plant", ["Au"]], ["soln", ["Au_s"]]],
  "AUFX-AUSX-CN": [["tail", ["Au"]], ["soln", ["Au_s"]], ["cyan", ["wad"]]],
  "AUSX-CN": [["soln", ["Au_s"]], ["cyan", ["wad"]]]
};
/* The batches a route's samples join: [{ p: batch type, k: [results it checks] }]. A route keeps its listed batches while it performs its
   original test; another batch type chosen for it in Settings replaces the first one. */
function routeGroups(r){
  const test = ((r && r.tests) || [])[0], res = RESULTS[test];
  if (!r || !r.qcp || !QC_PROFILES[r.qcp] || !res) return [];
  const ok = k => res.an.some(a => a.k === k && !a.t && !a.calc && !a.opt);
  const d = DEFAULT_ROUTES.find(x => x.code === r.code), std = d && (d.tests || [])[0] === test ? ROUTE_GROUPS[r.code] : null;
  const first = std ? std[0][1].filter(ok) : [];
  const out = [{ p: r.qcp, k: first.length ? first : [qcAnalyte(res).k] }];
  for (const [p, ks] of (std || []).slice(1)){ const k = ks.filter(ok); if (k.length && !out.some(g => g.p === p)) out.push({ p, k }); }
  return out;
}
const groupAns = (g, res) => (g.k || []).map(k => ((res && res.an) || []).find(a => a.k === k)).filter(Boolean);
const anSym = a => { const sym = a.k.split("_")[0]; return /^[A-Z][a-z]?$/.test(sym) ? sym : a.n; };
/* The QC rule of one batch type in words, made from the same numbers the lab batch enforces. ans: the results the batch checks. */
function qcRuleText(p, ans){
  if (!p) return "";
  ans = ans && ans.length ? ans : [qcAnalyte(null)];
  const an = ans[0], one = ans.length === 1, ins = p.ins || {};
  const qty = x => `${fmtNum(x)}${an.u === "%" ? "%" : an.u ? " " + an.u : ""}`;
  const what = ["pb", "cd", "pd", "crm", "bl"].filter(t => ins[t]).map(t => `${ins[t]} ${qcName(p, t, ins[t])}`);
  if (p.all) what.unshift(`every ${p.item || "sample"} in ${p.all === 1 ? "duplicate" : "triplicate"}`);
  const rules = [], v = (n, a, b) => n === 1 ? a : b;
  if (ins.crm && p.crm){
    const c = p.crm, n = ins.crm, sub = n === 1 ? `the ${qcName(p, "crm", 1)}` : qcName(p, "crm", n);
    if (c.mode === "sd") rules.push(`${sub} ${v(n, "is", "are")} within ±${c.warn} SD${c.fail > c.warn ? ` (${c.warn} to ${c.fail} SD is a warning, outside ±${c.fail} SD fails)` : ""}`);
    else if (c.mode === "pct") rules.push(`${sub} ${v(n, "is", "are")} within ±${c.tol}% of the certified value`);
    else if (c.mode === "rec") rules.push(`${sub} ${v(n, "recovers", "recover")} ${c.lo}–${c.hi}%`);
    else rules.push(`${sub} ${v(n, "is", "are")} within ${qty(c.tol)} of the certified value`);
  }
  const dlAt = m => one && an.dl ? qty(m * an.dl) : "";
  if (ins.pb && ins.bl && p.pbBlank && p.blank && p.pbBlank !== p.blank)
    rules.push(`the ${qcName(p, "pb", 1)} is below ${p.pbBlank}× and the ${qcName(p, "bl", 1)} below ${p.blank}× the detection limit${dlAt(1) ? ` (${dlAt(p.pbBlank)} and ${dlAt(p.blank)} ${anSym(an)})` : ""}`);
  else {
    const nb = (ins.bl || 0) + (ins.pb || 0), m = ins.bl ? p.blank : p.pbBlank || p.blank;
    if (nb && m) rules.push(`${nb === 1 ? "the blank is" : "blanks are"} below ${m}× the detection limit${dlAt(m) ? ` (${dlAt(m)} ${anSym(an)})` : ""}`);
  }
  const rel = p.dupMin ? ` (relative difference, above ${p.dupMin}× detection limit)` : " (relative difference)";
  const nd = p.all ? 2 : (ins.pd || 0);
  if (p.dupAbs && nd) rules.push(`${v(nd, `the ${qcName(p, "pd", 1)} agrees`, `${p.all ? (p.all === 1 ? "duplicates" : "triplicates") : qcName(p, "pd", nd)} agree`)} within ${qty(p.dupAbs)} (absolute)`);
  else if (nd && p.pd){
    const sub = p.all ? (p.all === 1 ? "duplicates agree" : "triplicates agree") : v(nd, `the ${qcName(p, "pd", 1)} agrees`, `${qcName(p, "pd", nd)} agree`);
    rules.push(`${sub} within ${p.pd}%${ins.cd && p.cd ? "" : rel}`);
  }
  if (ins.cd && p.cd) rules.push(`${v(ins.cd, `the ${qcName(p, "cd", 1)}`, qcName(p, "cd", ins.cd))} within ${p.cd}%${rel}`);
  return `Per ${p.batch}${one ? "" : `, checking ${listAnd(ans.map(a => /^[A-Z][a-z]?$/.test(a.k) ? a.k : lcName(a.n)))}`}: ${listAnd(what)}. Passes when ${listAnd(rules)}${one ? "" : ", for each of them"}.`;
}
const lcName = t => /^[A-Z][a-z]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t;
/* A route's QA/QC text: the rule of each batch it joins, then anything the route adds. */
function routeQcText(r, groups = routeGroups(r)){
  const res = RESULTS[((r && r.tests) || [])[0]], x = ROUTE_QC[r.code];
  const parts = groups.map(g => { const ans = groupAns(g, res);
    return (groups.length > 1 ? `${ans.map((a, i) => i ? lcName(a.n) : a.n).join(ans.length > 2 ? ", " : " and ")}: ` : "") + qcRuleText(QC_PROFILES[g.p], ans); });
  return parts.join(" ") + (x && x[0] === r.qcp && x[1] ? " " + x[1] : "");
}
DEFAULT_ROUTES.forEach(r => { const x = ROUTE_QC[r.code]; if (!x) return; r.qcp = x[0]; r.qcg = routeGroups(r); r.qc = routeQcText(r, r.qcg); });
/* Steps that run unattended (ovens, leaches, curing, an outside lab) keep running outside the lab's working hours. */
const CLOCK_STEP = /^(Drying|Fast drying|Oven drying|Air drying|Bottle roll leach|CIL leach|Accelerated cyanide leach|Intensive cyanide leach|Paired leach|Parallel bottle rolls|Stage [1-5]:|Cyanide irrigation|Rinse & drain|Agglomeration|Percolation|Net acid generation|Repeat after|Umpire lab analysis|Polished sections|Filter & dry products|Unload, dry|Spiked-solution test|Ashing)/;
DEFAULT_ROUTES.forEach(r => r.stages.forEach(x => { if (CLOCK_STEP.test(x.name)) x.clock = true; }));
/* Routes kept for samples already on them but not in use since version 23: not offered at submission and not listed, until the lab manager
   turns one back on under Settings › Workflow routes. */
/* v24: the lab only assays, so the analytical routes are back in use (ICP, LECO, moisture, sieve, density, aqua regia gold, cyanide-soluble gold,
   cyanide speciation, water, soil, deleterious elements, concentrate, check assay). Testwork (bottle roll, CIL test, GRG…) is what samples are for
   (a purpose), not a route; its products come in as testwork samples on the assay routes. */
const RETIRED_ROUTES = ["BRT", "CIL-T", "GRG", "DIAG", "COMMIN", "PLT-HEAD", "PLT-TAIL", "CCD-SVY", "ELUATE", "CIL-SVY",
  "CARBON", "SOLN", "TSF-CHAR", "PRI", "REAGENT", "O2-UPT", "COLUMN", "ILR", "C-STRIP", "FLOT", "SETTLE", "MINERAL", "DETOX", "ABA"];
/* ROUTES-END */
