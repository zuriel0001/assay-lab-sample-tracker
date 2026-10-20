const ADDONS = ["Ag", "Cu", "As", "Total sulphur", "Hg", "Moisture", "Particle size", "Specific gravity"];
/* Hazards show on the record, the board card and the bag label. Each sample type pre-ticks its usual ones. */
const HAZARDS = [
  { k: "cn",    l: "Cyanide",               tag: "CN" },
  { k: "hg",    l: "Mercury",               tag: "Hg" },
  { k: "as",    l: "Arsenic",               tag: "As" },
  { k: "rad",   l: "Radioactive (NORM)",    tag: "RAD" },
  { k: "acid",  l: "Acid or caustic",       tag: "pH" },
  { k: "heavy", l: "Heavy (over 20 kg)",    tag: "20kg+" }
];
const CONDITIONS = ["Good", "Bag or container damaged", "Leaking or spilt", "Wet", "Labels unclear or wrong", "Other (see note)"];
/* Every route starts with these two steps, then its own lab steps, then Results released and storage. */
const HEAD = [
  { key: "submitted", name: "Submitted, awaiting receipt", hours: 6, phase: "await" },
  { key: "received",  name: "Received & logged at lab",    hours: 1, phase: "intake", ledger: "in" }
];
/* Closing states. A sample closes when all its retained material has left the lab, or when it is rejected at receipt. */
const FINALS = [
  { key: "returned",  name: "Returned to site / submitter",              hours: 0, final: true, phase: "closed" },
  { key: "external",  name: "Sent to external lab",                      hours: 0, final: true, phase: "closed" },
  { key: "disposed",  name: "Disposed",                                  hours: 0, final: true, phase: "closed" },
  { key: "archived",  name: "Moved to long-term archive",                hours: 0, final: true, phase: "closed" },
  { key: "closed",    name: "Closed: all material returned or disposed", hours: 0, final: true, phase: "closed" },
  { key: "rejected",  name: "Rejected at receipt",                       hours: 0, final: true, phase: "closed" },
  { key: "cancelled", name: "Submission cancelled (never arrived)",      hours: 0, final: true, phase: "closed" }
];
/* What can happen to each retained material. */
const DISPO = { returned: "Returned", disposed: "Disposed", external: "Sent to external lab", archived: "Moved to long-term archive" };
const dispoOf = then => /return/i.test(then || "") ? "returned" : /archiv|kept|secure|library/i.test(then || "") ? "archived" : /external|umpire/i.test(then || "") ? "external" : "disposed";
const RESERVED = ["submitted", "received", "released", "storage", ...FINALS.map(x => x.key)];
/* Samples registered before routes existed keep the original single workflow. */
const LEGACY_PLAN = [
  ...HEAD,
  { key: "drying",    name: "Drying",                 hours: 12,   phase: "prep" },
  { key: "crushing",  name: "Crushing & pulverising", hours: 8,    phase: "prep" },
  { key: "splitting", name: "Splitting & weighing",   hours: 2,    phase: "prep" },
  { key: "analysis",  name: "Assay / analysis",       hours: 24,   phase: "test", redo: true },
  { key: "qaqc",      name: "QA/QC review",           hours: 8,    phase: "qc" },
  { key: "released",  name: "Results released",       hours: 24,   phase: "report", target: true },
  { key: "storage",   name: "Retained in storage",    hours: 2160, phase: "store" }
];
const PHASES = [
  { key: "await",  name: "Awaiting receipt" },
  { key: "intake", name: "Received & logged" },
  { key: "prep",   name: "Sample preparation" },
  { key: "test",   name: "Analysis" },
  { key: "qc",     name: "QA/QC review" },
  { key: "report", name: "Results released" },
  { key: "store",  name: "In storage" }
];
const PHASE_LABEL = { await: "Waiting", intake: "Intake", prep: "Preparation", test: "Analysis / test", qc: "QA/QC", report: "Report", store: "Storage" };
const DEFAULT_CONFIG = {
  /* Demo accounts for the prototype. Admin changes them on the Settings tab. NOT real security: anyone with the page can read them. */
  users: [
    { u: "admin",  name: "Lab Manager",      role: "admin",  dept: "Assay Lab", pw: "admin123" },
    { u: "super",  name: "Lab Supervisor",   role: "super",  dept: "Assay Lab", pw: "super123" },
    { u: "tech1",  name: "Lab Technician A", role: "tech",   dept: "Assay Lab", pw: "tech123" },
    { u: "tech2",  name: "Lab Technician B", role: "tech",   dept: "Assay Lab", pw: "tech123" },
    { u: "viewer", name: "Site Viewer",      role: "viewer", pw: "view123" },
    { u: "met",    name: "Plant Metallurgist", role: "viewer", dept: "Metallurgy", pw: "met123" },
    /* Section accounts see the results and certificates of their own section's samples, and a list of newly released ones. */
    { u: "exp",    name: "Exploration (results)",    role: "section", sec: "EXP", pw: "exp123" },
    { u: "plant",  name: "Process plant (results)",  role: "section", sec: "PLT", pw: "plant123" }
  ],
  /* Departments (v24). Every staff account belongs to one. A department that evaluates sees QC, limit alerts and checks on released results
     and records its evaluation; everyone else sees the results only. The lab manager and lab supervisors always evaluate. */
  depts: [
    { n: "Assay Lab", ev: false }, { n: "Metallurgy", ev: true }, { n: "Process Plant", ev: false }, { n: "Geology / Exploration", ev: false },
    { n: "Mining / Grade Control", ev: false }, { n: "Environment", ev: false }, { n: "Management", ev: false }
  ],
  /* Submitting sections. Sample IDs are SECTION-YYYYMMDD-0001 (submission date, site time); each section has its own counter per day. */
  sections: [
    { code: "MET", name: "Metallurgy (MET Lab)" },
    { code: "EXP", name: "Exploration" },
    { code: "GEO", name: "Mine geology" },
    { code: "GC",  name: "Grade control" },
    { code: "MIN", name: "Mining operations" },
    { code: "PLT", name: "Process plant" },
    { code: "GR",  name: "Gold room / bullion" },
    { code: "TSF", name: "Tailings (TSF)" },
    { code: "ENV", name: "Environment" },
    { code: "HSE", name: "Health & safety / occupational hygiene" },
    { code: "QC",  name: "Quality control (CRMs, blanks, duplicates)" },
    { code: "EXT", name: "External client / contractor" },
    { code: "OTH", name: "Other" }
  ],
  /* Site time zone: sample ID dates, ledger months and every time shown use it, whatever the device is set to. */
  tz: "Africa/Accra",
  /* Reference materials for lab batches. EXAMPLE values only: replace them with the lab's own certified values and SDs on the Settings tab.
     an = analyte symbol, u = unit, val = certified value, sd = certified standard deviation, use = batch prefixes it is run in. */
  crms: [
    { id: "STD-AU-LOW",  name: "Low-grade gold ore",        an: "Au",  u: "g/t", val: 0.52, sd: 0.025, use: "FA, GC, PT, SF" },
    { id: "STD-AU-MED",  name: "Medium-grade gold ore",     an: "Au",  u: "g/t", val: 2.08, sd: 0.07,  use: "FA, GC, PL, SF" },
    { id: "STD-AU-HIGH", name: "High-grade gold ore",       an: "Au",  u: "g/t", val: 9.85, sd: 0.26,  use: "FA, PL, FG" },
    { id: "STD-AU-CONC", name: "Gold concentrate",          an: "Au",  u: "g/t", val: 98.6, sd: 2.4,   use: "FG, CC" },
    { id: "STD-AU-CNS",  name: "Ore with certified cyanide-soluble gold", an: "Au", u: "g/t", val: 1.62, sd: 0.09, use: "LW" },
    { id: "STD-CARBON",  name: "Loaded carbon",             an: "Au",  u: "g/t", val: 1520, sd: 45,    use: "CB" },
    { id: "PROOF-AU",    name: "Proof gold",                an: "Au",  u: "‰",   val: 999.9, sd: 0,    use: "BU" },
    { id: "SOL-AU-0.2",  name: "Gold solution standard 0.2 mg/L", an: "Au", u: "mg/L", val: 0.2, sd: 0, use: "SL" },
    { id: "SOL-AU-1",    name: "Gold solution standard 1 mg/L",   an: "Au", u: "mg/L", val: 1,   sd: 0, use: "SL" },
    { id: "SOL-AU-50",   name: "Gold solution standard 50 mg/L",  an: "Au", u: "mg/L", val: 50,  sd: 0, use: "EL" },
    { id: "CN-WAD-10",   name: "WAD cyanide check standard",      an: "wad", u: "mg/L", val: 10, sd: 0, use: "CY, EW" },
    /* A reference material certified for several results has one row per result, under the same ID. */
    { id: "CN-SPK",      name: "Cyanide speciation spike",  an: "free",  u: "mg/L", val: 5,  sd: 0, use: "CS" },
    { id: "CN-SPK",      name: "Cyanide speciation spike",  an: "wad",   u: "mg/L", val: 10, sd: 0, use: "CS" },
    { id: "CN-SPK",      name: "Cyanide speciation spike",  an: "total", u: "mg/L", val: 12, sd: 0, use: "CS" },
    { id: "CN-SPK",      name: "Cyanide speciation spike",  an: "scn",   u: "mg/L", val: 20, sd: 0, use: "CS" },
    { id: "SPK-W-MET",   name: "Water metals spike",        an: "As",  u: "mg/L", val: 0.05,  sd: 0, use: "EW" },
    { id: "SPK-W-MET",   name: "Water metals spike",        an: "Hg",  u: "mg/L", val: 0.002, sd: 0, use: "EW" },
    { id: "SPK-W-MET",   name: "Water metals spike",        an: "Cu",  u: "mg/L", val: 0.5,   sd: 0, use: "EW" },
    ...[["Cu", "ppm", 450, 18], ["Ag", "ppm", 2.1, 0.15], ["As", "ppm", 120, 8], ["Sb", "ppm", 15, 1.5], ["Zn", "ppm", 85, 5], ["Pb", "ppm", 40, 3], ["Fe", "%", 4.2, 0.15], ["S", "%", 0.85, 0.04]]
      .map(([an, u, val, sd]) => ({ id: "STD-ICP-LOW", name: "Low copper ore, multi-element", an, u, val, sd, use: "IC, ME" })),
    ...[["Cu", "ppm", 2500, 80], ["Ag", "ppm", 12.5, 0.6], ["As", "ppm", 1850, 70], ["Sb", "ppm", 95, 6], ["Zn", "ppm", 620, 25], ["Pb", "ppm", 310, 14], ["Fe", "%", 7.8, 0.25], ["S", "%", 3.6, 0.12], ["Hg", "ppm", 2.4, 0.2]]
      .map(([an, u, val, sd]) => ({ id: "STD-ICP-HIGH", name: "Copper-gold ore, multi-element", an, u, val, sd, use: "IC, ME" })),
    { id: "STD-CU-CN",   name: "Ore with certified cyanide-soluble copper", an: "Cu_cn", u: "ppm", val: 320, sd: 15, use: "ME" },
    { id: "STD-CONC-ME", name: "Gold concentrate, mercury and arsenic", an: "Hg", u: "ppm", val: 12,   sd: 0.8,  use: "ME" },
    { id: "STD-CONC-ME", name: "Gold concentrate, mercury and arsenic", an: "As", u: "%",   val: 1.85, sd: 0.07, use: "ME" },
    ...[["S", 2.45, 0.06], ["S2", 2.1, 0.06], ["C", 1.2, 0.04], ["Corg", 0.35, 0.03]].map(([an, val, sd]) => ({ id: "STD-LECO", name: "Sulphide ore for LECO", an, u: "%", val, sd, use: "LE" })),
    { id: "STD-AU-PPB",  name: "Low-level gold soil",       an: "Au",  u: "ppb", val: 48,   sd: 3,     use: "AR" },
    ...[["As", 85, 6], ["Hg", 0.9, 0.08], ["Pb", 120, 7], ["Cu", 64, 4]].map(([an, val, sd]) => ({ id: "SOIL-ME", name: "Soil, multi-element", an, u: "mg/kg", val, sd, use: "SO" })),
    { id: "ARD-NP",      name: "ARD reference material",    an: "np",  u: "kg CaCO₃/t", val: 120, sd: 6, use: "AB" },
    { id: "DEN-BLOCK",   name: "Reference density block",   an: "sg",  u: "",    val: 2.70, sd: 0.01,  use: "DN" }
  ],
  /* Action limits from the routes' re-assay triggers, and the site's permit or guideline limits (EXAMPLE values: replace them with the
     site's environmental permit). A result past a limit raises an alert on the board; the release waits until someone records what was
     done and who was told. when: only for samples whose sampling point is this. */
  limits: [
    { id: "L01", route: "PLT-TAIL", k: "Au",   op: ">", val: 0.2,   act: "Alert the plant metallurgist and repeat the residue assay" },
    { id: "L02", route: "PLT-TAIL", k: "Au_s", op: ">", val: 0.02,  act: "Alert the plant metallurgist and repeat" },
    { id: "L03", route: "CCD-SVY",  k: "Au_s", op: ">", val: 0.05,  when: "Final underflow", act: "Alert the plant metallurgist (soluble loss)" },
    { id: "L04", route: "CCD-SVY",  k: "wash", op: "<", val: 98,    act: "Check the wash ratio and flocculant; repeat the survey" },
    { id: "L05", route: "ELUATE",   k: "Au",   op: ">", val: 5,     when: "End of strip", act: "Notify the elution operator (incomplete strip)" },
    { id: "L06", route: "ELUATE",   k: "Au",   op: ">", val: 5,     when: "Electrowinning discharge", act: "Check the electrowinning cells and current" },
    { id: "L07", route: "CIL-SVY",  k: "Au_s", op: ">", val: 0.02,  when: "Last tank", act: "Alert the plant" },
    { id: "L08", route: "CARBON",   k: "Au_c", op: ">", val: 100,   when: "Eluted carbon", act: "Repeat and notify the elution operator" },
    { id: "L09", route: "CARBON",   k: "act",  op: "<", val: 50,    act: "Recommend carbon regeneration" },
    { id: "L10", route: "SOLN",     k: "Au",   op: ">", val: 0.02,  when: "Barren solution", act: "Alert elution and the plant" },
    { id: "L11", route: "TSF-CHAR", k: "wad",  op: ">", val: 50,    act: "Alert Environment immediately" },
    { id: "L12", route: "CN-SPEC",  k: "wad",  op: ">", val: 50,    act: "Alert Environment and the plant immediately" },
    { id: "L13", route: "ENV-W",    k: "wad",  op: ">", val: 0.5,   permit: true, act: "Re-analyse and notify Environment the same day" },
    { id: "L14", route: "ENV-W",    k: "As",   op: ">", val: 0.1,   permit: true, act: "Re-analyse and notify Environment the same day" },
    { id: "L15", route: "ENV-W",    k: "Hg",   op: ">", val: 0.002, permit: true, act: "Re-analyse and notify Environment the same day" },
    { id: "L16", route: "ENV-W",    k: "Cu",   op: ">", val: 0.3,   permit: true, act: "Re-analyse and notify Environment the same day" },
    { id: "L17", route: "ENV-W",    k: "pH",   op: "<", val: 6,     permit: true, act: "Re-analyse and notify Environment the same day" },
    { id: "L18", route: "ENV-W",    k: "pH",   op: ">", val: 9,     permit: true, act: "Re-analyse and notify Environment the same day" },
    { id: "L19", route: "ENV-W",    k: "tss",  op: ">", val: 50,    permit: true, act: "Re-analyse and notify Environment the same day" },
    { id: "L20", route: "ENV-S",    k: "As",   op: ">", val: 20,    permit: true, act: "Re-analyse and notify Environment" },
    { id: "L21", route: "ENV-S",    k: "Hg",   op: ">", val: 1,     permit: true, act: "Re-analyse and notify Environment" },
    { id: "L22", route: "ENV-S",    k: "Pb",   op: ">", val: 400,   permit: true, act: "Re-analyse and notify Environment" },
    { id: "L23", route: "ENV-S",    k: "Cu",   op: ">", val: 100,   permit: true, act: "Re-analyse and notify Environment" },
    { id: "L24", route: "DELET",    k: "Cu_cn", op: ">", val: 200,  act: "Flag high cyanide consumption to the plant" },
    { id: "L25", route: "DELET",    k: "As",   op: ">", val: 10000, act: "Flag possible refractory ore; offer a diagnostic leach" },
    { id: "L26", route: "DELET",    k: "Sb",   op: ">", val: 1000,  act: "Flag possible refractory ore; offer a diagnostic leach" },
    { id: "L27", route: "DELET",    k: "Hg",   op: ">", val: 10,    act: "Flag for gold-room mercury controls" },
    { id: "L28", route: "LECO",     k: "Corg", op: ">", val: 0.2,   act: "Flag preg-robbing; offer a CIL test" },
    { id: "L29", route: "AR-AU",    k: "Au",   op: ">", val: 1000,  act: "Repeat by fire assay" },
    { id: "L30", route: "CN-SOL",   k: "rec",  op: "<", val: 50,    act: "Flag as refractory; offer a diagnostic leach" },
    { id: "L31", route: "BRT",      k: "rec",  op: "<", val: 80,    act: "Diagnostic leach recommended" },
    { id: "L32", route: "ILR",      k: "rec",  op: "<", val: 95,    act: "Check for coarse gold; repeat with a longer time or finer grind" },
    { id: "L33", route: "GRG",      k: "grg",  op: ">", val: 30,    act: "Report recommends a gravity circuit study" },
    { id: "L34", route: "REAGENT",  k: "nacn", op: ">", val: 1.5,   act: "Run the deleterious elements test for cyanicides" },
    { id: "L35", route: "O2-UPT",   k: "our",  op: ">", val: 0.1,   act: "Recommend pre-aeration or oxygen / peroxide addition" },
    { id: "L36", route: "C-STRIP",  k: "barren", op: ">", val: 100, act: "Check temperature and caustic strength; repeat" },
    { id: "L37", route: "PRI",      k: "pri",  op: ">", val: 10,    act: "Moderate preg-robbing: recommend CIL or a blinding agent" },
    { id: "L38", route: "PRI",      k: "pri",  op: ">", val: 50,    act: "Severe preg-robbing: recommend roasting tests" },
    { id: "L39", route: "FLOT",     k: "rec",  op: "<", val: 80,    act: "Repeat at a finer grind or with a different collector" },
    { id: "L40", route: "ABA",      k: "nag",  op: "<", val: 4.5,   act: "Potentially acid-forming: notify Environment for waste-dump placement" },
    /* Version 23: the plant routes (EXAMPLE values: the lab sets its own). */
    { id: "P01", route: "AUFX-AUSX",    k: "Au_s", op: ">", val: 0.02, when: "CIL tails", act: "Soluble gold loss: alert the plant metallurgist and repeat" },
    { id: "P02", route: "AUFX-AUSX",    k: "Au",   op: ">", val: 0.2,  when: "CIL tails", act: "Gold loss in the tails solids: alert the plant metallurgist and repeat" },
    { id: "P03", route: "AUSX",         k: "Au_s", op: ">", val: 0.02, when: "CIL tails", act: "Soluble gold loss: alert the plant metallurgist and repeat" },
    { id: "P04", route: "AUFX-AUSX",    k: "Au_s", op: ">", val: 0.05, when: "CCD tails", act: "Soluble gold loss in the CCD tails: alert the plant metallurgist" },
    { id: "P05", route: "AUFX-AUSX-CN", k: "Au_s", op: ">", val: 0.05, when: "CCD tails", act: "Soluble gold loss in the CCD tails: alert the plant metallurgist" },
    { id: "P06", route: "AUFX-AUSX-CN", k: "wad",  op: ">", val: 50,   when: "TSF spigot", act: "WAD cyanide over 50 mg/L at the TSF: alert Environment and the plant at once" },
    { id: "P07", route: "AUSX-CN",      k: "wad",  op: ">", val: 50,   when: "Decant pond", act: "WAD cyanide over 50 mg/L in the decant pond: alert Environment and the plant at once" },
    { id: "P08", route: "CN",           k: "wad",  op: ">", val: 50,   when: "TSF spigot", act: "WAD cyanide over 50 mg/L at the TSF: alert Environment and the plant at once" },
    { id: "P09", route: "C-LOAD",       k: "Au_c", op: ">", val: 100,  when: "Eluted carbon", act: "Repeat and notify the elution operator" },
    { id: "P10", route: "ELU-AUSX",     k: "Au_s", op: ">", val: 5,    when: "Electrowinning tails", act: "Check the electrowinning cells and current" }
  ],
  /* Results are shown to signed-in staff only, unless an admin opens them to anyone with the sample ID. */
  resultsPublic: false,
  /* A sample needs a lab batch with its QC before QA/QC review and release (off: results may be typed or attached on the record). */
  batchReq: false,
  /* Routes' QA/QC review step (off: the release follows the last analysis step; QA/QC is judged on the QA/QC sample sets and lab batches). */
  qcStep: false,
  /* Routes the lab manager turned on or off (code: true / false); any other route is in use unless it is in RETIRED_ROUTES. */
  routeUse: {},
  routes: DEFAULT_ROUTES
};

let cfg = clone(DEFAULT_CONFIG);
let db = null, user = null, canWrite = null;
const ROLES = { admin: "Admin (lab manager)", super: "Lab supervisor", tech: "Lab technician", viewer: "Viewer", section: "Section account" };
const ROLE_TABS = {
  admin:  ["track", "board", "submit", "results", "batches", "storage", "ledger", "routes", "stages"],
  super:  ["track", "board", "submit", "results", "batches", "storage", "ledger", "routes"],
  tech:   ["track", "board", "submit", "batches", "storage", "ledger", "routes"],
  viewer: ["track", "board", "submit", "results", "batches", "storage", "ledger", "routes"],
  section: ["track", "results", "submit", "routes"]
};
let session = null;   // { u, name, role, sec } of the signed-in demo account; null = public lookup only
const LAB_ROLES = ["tech", "super", "admin"];
const canEdit = () => !!session && LAB_ROLES.includes(session.role);
/* Supervisors and admins release results, approve skipped steps and reverse ledger movements. */
const canApprove = () => !!session && (session.role === "super" || session.role === "admin");
const isAdmin = () => session?.role === "admin";
/* v24: results go out as soon as they are complete, released by whoever saves them (Settings › Release: At once). Sign-off brings back the
   lab supervisor's release, four eyes, and QC, limits and checks holding it. */
const relNow = () => cfg.relMode !== "signoff";
const canRelease = () => relNow() ? canEdit() : canApprove();
/* Lab staff, who see every result; a section account sees its own section's. */
const isStaff = () => !!session && ["tech", "super", "admin", "viewer"].includes(session.role);
const samples = new Map();   // id -> body for every open sample: awaiting receipt, in the lab, or with material still in storage
const releasedToday = new Map();
let current = null;          // { id, body|null, missing, loading, matches }
let unsubCurrent = null;
let tab = "track";
const tabId = Math.random().toString(36).slice(2);

const $ = (s, el = document) => el.querySelector(s);
const val = s => ($(s)?.value || "").trim();
function clone(o){ return JSON.parse(JSON.stringify(o)); }
function esc(s){ return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function toast(msg){ const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 3600); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- site time ---------- */
function tzOk(z){ try { new Intl.DateTimeFormat("en", { timeZone: z }); return true; } catch { return false; } }
const TZ = () => cfg.tz && tzOk(cfg.tz) ? cfg.tz : undefined;
function siteParts(ms){
  const p = {};
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ(), year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date(ms)).forEach(x => p[x.type] = x.value);
  p.hour = String(+p.hour % 24).padStart(2, "0");
  return p;
}
const dayStamp = ms => { const p = siteParts(ms); return p.year + p.month + p.day; };
const dayKey = ms => { const p = siteParts(ms); return `${p.year}-${p.month}-${p.day}`; };
const monthKey = ms => { const p = siteParts(ms); return `${p.year}-${p.month}`; };
function localInput(ms){ const p = siteParts(ms); return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`; }
/* A datetime-local value typed in site time, as epoch ms. */
function fromInput(v){
  const m = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/); if (!m) return NaN;
  const wall = Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5]);
  const off = t => { const p = siteParts(t); return Date.UTC(+p.year, p.month - 1, +p.day, +p.hour, +p.minute) - Math.floor(t / 60000) * 60000; };
  const first = wall - off(wall);
  return wall - off(first);
}
/* Midnight at the start of a site day or month, as epoch ms. */
const monthStart = key => fromInput(key + "-01T00:00");
const fmtOpts = o => ({ timeZone: TZ(), ...o });
function fmt(ms){ if (!ms) return "—"; return new Date(ms).toLocaleString(undefined, fmtOpts({ weekday:"short", day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" })); }
function fmtDate(ms){ return ms ? new Date(ms).toLocaleDateString(undefined, fmtOpts({ day:"numeric", month:"short", year:"numeric" })) : "—"; }
function fmtFull(ms){ return ms ? new Date(ms).toLocaleString(undefined, fmtOpts({ day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })) : "—"; }
function dur(ms){
  const neg = ms < 0; ms = Math.abs(ms);
  const d = Math.floor(ms / 86400e3), h = Math.floor(ms % 86400e3 / HOUR), m = Math.floor(ms % HOUR / 60000);
  const s = d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
  return neg ? `${s} ago` : s;
}
function hoursLabel(h){ h = +h || 0; if (h >= 48) return `${+(h/24).toFixed(1)} days`; return `${+h.toFixed(2)} h`; }

/* ---------- IDs, tags ---------- */
/* Only text that really is a sample ID is turned into one; anything else is searched as a tag or site reference. A scanned tracking link works too. */
function idFromText(raw){
  let v = String(raw || "").trim();
  const h = v.indexOf("#");
  if (/^https?:\/\//i.test(v) && h >= 0) { try { v = decodeURIComponent(v.slice(h + 1)); } catch { v = v.slice(h + 1); } }
  v = v.toUpperCase().replace(/\s+/g, "");
  let m = v.match(/^([A-Z]{2,5})-?(\d{8})-?(\d{1,4})$/);          // EXP-20261013-0001
  if (m) return `${m[1]}-${m[2]}-${m[3].padStart(4, "0")}`;
  m = v.match(/^([A-Z]{2,6})-(\d{4})-(\d{5})$/);                  // early format MET-2026-00001
  return m ? v : "";
}
function splitTags(t){ return String(t || "").split(/[,;\n]+/).map(x => x.trim()).filter(Boolean); }
const normTag = t => String(t || "").trim().toUpperCase().replace(/\s+/g, " ");
/* v24d (20 Oct): a sample's ID as its document key. A job's samples take the code from the plant's file as their ID (MLNSCOF 20261018,
   MLNSCBLD20261018#32, MLABPF+42520260930); the four characters a key can't hold (/ \ ? #) are written as ~ and their code. A site ID
   (PLT-20261019-0001) is its own key, and so is a key already written this way. */
const skey = id => String(id || "").replace(/[\/\\?#]/g, c => "~" + c.charCodeAt(0).toString(16) + "~");
/* The site sample code where it is not the ID itself (v24d: a job's sample has its code as its ID). */
const ownCode = s => { const t = tagText(s); return t && t !== s.id ? t : ""; };
/* A tag as a document id: letters, digits, - and _ stay; every other character is written as ~ and its code, so different tags never collide. */
const tagKey = t => [...normTag(t)].map(c => /[A-Z0-9_-]/.test(c) ? c : "~" + c.codePointAt(0).toString(16) + "~").join("").slice(0, 190) || "~";
/* Tags for a batch: one starting tag counts up, keeping its zero padding (T-10421, T-10422, …). */
function batchTags(tags, n){
  if (!tags.length) return Array(n).fill([]);
  if (n === 1) return [tags];
  if (tags.length === n) return tags.map(t => [t]);
  const m = tags[0].match(/^(.*?)(\d+)$/);
  return Array.from({ length: n }, (_, i) => [m ? m[1] + String(+m[2] + i).padStart(m[2].length, "0") : `${tags[0]}-${i + 1}`]);
}
const tagText = s => (s.tags && s.tags.length ? s.tags.join(", ") : s.tagNo) || "";
const sectionName = code => (cfg.sections || []).find(x => x.code === code)?.name || code || "";
const exampleId = (code) => `${code || (cfg.sections && cfg.sections[0]?.code) || "MET"}-${dayStamp(Date.now())}-0001`;

/* ---------- workflow maths: each sample carries its own plan, built from its route ---------- */
const typeOf = k => TYPES.find(t => t.key === k) || null;
const testOf = k => TESTS.find(t => t.key === k) || null;
const purposeOf = k => PURPOSES.find(p => p.key === k) || null;
const routeByCode = c => (cfg.routes || []).find(r => r.code === c) || null;
/* Routes in use: all but those retired in version 23, as the lab manager turned them on or off. Samples keep any route they are on. */
const useOf = (r, use) => { const u = (use || {})[r.code]; return u != null ? !!u : !RETIRED_ROUTES.includes(r.code); };
const routeOn = r => useOf(r, cfg.routeUse);
const liveRoutes = () => (cfg.routes || []).filter(routeOn);
const testOn = k => liveRoutes().some(r => (r.tests || []).includes(k));
const typeOn = k => k === "other" || liveRoutes().some(r => (r.types || []).includes(k));
/* Routes in use that perform a test, and `keep` (a sample's own route) even when it is no longer in use. */
const routesForTest = (test, keep = "") => (cfg.routes || []).filter(r => (r.tests || []).includes(test) && ((routeOn(r) && !r.job) || r.code === keep));   // v24d: the shift job route is only for a shift's samples
/* Saved routes plus any default route the admin has not removed, so routes added in later versions still appear. */
/* Settings store only routes an admin added or edited; every untouched default follows the latest version of the route library. */
function mergeRoutes(saved, removed){
  const list = Array.isArray(saved) ? saved : [];
  const have = new Set(list.map(r => r.code)), gone = new Set(removed || []);
  return [...clone(list).map(grind80).map(cilOnly).map(withQcp), ...clone(DEFAULT_ROUTES.filter(r => !have.has(r.code) && !gone.has(r.code)))];
}
/* The lab pulverises to 80% passing 75 µm (version 16): routes saved with the earlier 85% wording are brought into line. */
function grind80(r){
  (r.stages || []).forEach(x => ["name", "note"].forEach(k => { if (typeof x[k] === "string") x[k] = x[k].replace(/\b85% passing 75 µm/g, "80% passing 75 µm"); }));
  return r;
}
/* v24d: the plant runs CIL only: routes saved under the old combined CIL and CIP names read "CIL". */
function cilOnly(r){
  const fix = t => typeof t === "string" ? t.replace(/\bCIL ?\/ ?CIP\b/g, "CIL") : t;
  r.name = fix(r.name); r.desc = fix(r.desc); (r.stages || []).forEach(x => { x.name = fix(x.name); x.note = fix(x.note); });
  return r;
}
/* Routes saved before lab batches existed get the batch type of the default route (or of a default route for the same test), and QA/QC text that matches it. */
function withQcp(r){
  if (r.qcp != null){ if (!Array.isArray(r.qcg)) r.qcg = routeGroups(r); return r; }
  const d = DEFAULT_ROUTES.find(x => x.code === r.code) || DEFAULT_ROUTES.find(x => x.qcp && (x.tests || [])[0] === (r.tests || [])[0]);
  r.qcp = d?.qcp || "";
  r.qcg = routeGroups(r);
  if (d && d.code === r.code) r.qc = d.qc;
  else if (r.qcp) r.qc = routeQcText(r, r.qcg);
  return r;
}
const editedRoutes = routes => routes.filter(r => { const d = DEFAULT_ROUTES.find(x => x.code === r.code); return !d || JSON.stringify(d) !== JSON.stringify(r); });
const testRank = r => { const i = TESTS.findIndex(t => t.key === (r.tests || [])[0]); return i < 0 ? 999 : i; };
const routeCat = r => testOf((r.tests || [])[0])?.cat || "Other";
/* Recommended test for a sample type; the purpose can steer it (testwork, environmental, plant). */
/* The analyses that apply to a sample type: its own list, plus any analysis an admin's own route (or a route put back in use) names the type for.
   The routes in use by default name only types whose list already has their analysis, so by default this is exactly the type's list (v24c). */
function typeTests(t){
  const std = new Set(DEFAULT_ROUTES.filter(d => !RETIRED_ROUTES.includes(d.code)).map(d => d.code));
  const named = liveRoutes().filter(r => (r.types || []).includes(t.key) && (!std.has(r.code) || JSON.stringify(r.types) !== JSON.stringify(DEFAULT_ROUTES.find(d => d.code === r.code)?.types))).flatMap(r => r.tests || []);
  return [...new Set([...(t.tests || []), ...TESTS.map(x => x.key).filter(k => named.includes(k))])];
}
function defaultTest(typeKey, purposeKey){
  const t = typeOf(typeKey), own = t?.tests || ["fa_aas"], list = (t ? typeTests(t) : own).filter(testOn);
  /* Environment may send a sample from any site (v24c). The older tests here only count when an admin has put their routes back in use. */
  const pref = { met: ["bottle", "cil_test", "pri", "grg", "diag", "commin", "cn_sol"], env: ["tsf", "water", "soil", "aba", "cn_spec"], hse: ["water", "soil"], qc: ["check"],
    plant: ["plant_solids", "ccd", "eluate", "residue", "cil_survey", "carbon", "solution"], bullion: ["bullion"] }[purposeKey] || [];
  return pref.find(x => list.includes(x)) || list[0] || own[0];
}
/* The route must perform the test; among those, a purpose match counts most, then a sample-type match. Null when no route performs it. */
function routeFor(typeKey, testKey, purposeKey){
  let best = null, score = -1;
  for (const r of routesForTest(testKey)){
    const ty = r.types || [];
    const s = ((r.purposes || []).includes(purpBase(purposeKey)) ? 3 : 0) + (ty.includes(typeKey) ? 2 : ty.includes("*") || !ty.length ? 1 : 0);
    if (s > score){ best = r; score = s; }
  }
  return best;
}
const keepDays = r => Math.max(0, ...((r && r.retention) || []).map(x => +x.days || 0));
const transitOf = r => r && r.transit != null && r.transit !== "" ? +r.transit : HEAD[0].hours;
function buildPlan(r){
  return [{ ...HEAD[0], hours: transitOf(r) }, { ...HEAD[1] },
    ...((r && r.stages) || []).map(x => ({ key: x.key, name: x.name, hours: +x.hours || 0, phase: x.phase || "test", ...(x.redo ? { redo: true } : {}), ...(x.clock ? { clock: true } : {}) })),
    { key: "released", name: "Results released", hours: 24, phase: "report", target: true },
    { key: "storage", name: "Retained in storage", hours: Math.max(1, keepDays(r)) * 24, phase: "store", clock: true }];
}
/* Hours from receipt to results for a route (elapsed time when the lab works in shifts). */
const routeTat = r => routeSpan(r);
/* What a sample copies from its route, so later edits to the route never change samples already in the lab. */
function routeFields(r, test){
  return { route: r.code, routeName: r.name, test, testName: testOf(test)?.name || "", plan: buildPlan(r), retention: clone(r.retention || []),
    qc: r.qc || "", qcp: r.qcp || "", qcg: groupsFor(r, test), triggers: clone(r.triggers || []), two: !!r.two, grav: "", dil: [] };
}
/* The lab batches a route's samples join for one of its tests: the route's own for its first test; for another test, those whose results
   the test reports (its main result at least). */
function groupsFor(r, test){
  const gs = clone(Array.isArray(r.qcg) ? r.qcg : routeGroups(r)), res = RESULTS[test];
  if (!res || !test || test === (r.tests || [])[0]) return gs;
  const ok = k => res.an.some(a => a.k === k && !a.t && !a.calc);
  const out = gs.map(g => ({ p: g.p, k: g.k.filter(ok) })).filter(g => g.k.length);
  if (r.qcp && QC_PROFILES[r.qcp] && !out.some(g => g.p === r.qcp)) out.unshift({ p: r.qcp, k: [qcAnalyte(res).k] });
  return out;
}
/* A QA/QC review step counts only while Settings use it. A sample keeps one it is at or has been through, and one it passed while the
   step was not used stays out when it is used again. Samples keep their stored steps, so the setting can be changed back. */
const qcStepOn = () => !!cfg.qcStep && cfg.relMode === "signoff";   // v24: the QA/QC review step and the lab batch rule belong to the sign-off release
const stepsUsed = stages => qcStepOn() ? stages : stages.filter(x => x.phase !== "qc");
const planMemo = new WeakMap();
const planOf = s => {
  const p = (s && Array.isArray(s.plan) && s.plan.length) ? s.plan : LEGACY_PLAN;
  if (!p.some(x => x.phase === "qc")) return p;
  const on = qcStepOn(), h = s?.history || [], m = s && typeof s === "object" ? planMemo.get(s) : null;
  if (m && m.on === on && m.p === p && m.k === s.stageKey && m.n === h.length) return m.out;
  const ci = p.findIndex(x => x.key === s?.stageKey), seen = new Set(h.map(x => x.key));
  const out = p.filter((x, i) => x.phase !== "qc" || x.key === s?.stageKey || seen.has(x.key) || (on && (ci < 0 || ci < i)));
  if (s && typeof s === "object") planMemo.set(s, { on, p, k: s.stageKey, n: h.length, out });
  return out;
};
const allOf = s => [...planOf(s), ...FINALS];
const stage = (s, key) => allOf(s).find(x => x.key === key) || null;
const stageIdx = (s, key) => allOf(s).findIndex(x => x.key === key);
const curIdx = s => planOf(s).findIndex(x => x.key === s.stageKey);
const targetIdx = s => { const p = planOf(s), i = p.findIndex(x => x.target); return i < 0 ? p.length - 1 : i; };
/* Where a re-assay sends the sample back to: the step marked in the route, else its first analysis step. */
const redoIdx = s => { const p = planOf(s); const i = p.findIndex(x => x.redo); return i >= 0 ? i : p.findIndex(x => x.phase === "test"); };
/* A forward jump may not land on or pass over a QA/QC step or the release of results. Returns the step in the way, if any. */
function blockedBy(s, toIdx){
  const p = planOf(s);
  for (let j = curIdx(s) + 1; j <= toIdx && j < p.length; j++) if (p[j].phase === "qc" || p[j].target) return p[j];
  return null;
}
const stageName = (s, h) => stage(s, h.key)?.name || h.sn || h.key;
const routeStageNote = (s, key) => routeByCode(s.route)?.stages?.find(x => x.key === key)?.note || "";
function lastEntry(s, key){ const h = s.history || []; for (let i = h.length - 1; i >= 0; i--) if (h[i].key === key) return h[i]; return null; }
/* v24d: the last lab step is done and the sample waits for its results on the Results released step (rw: the step it was on and when).
   A stale mark (the sample has moved since, or came back to that step later) means nothing. */
const waitingRes = s => !!s?.rw && s.rw.key === s.stageKey && +s.rw.at >= +s.stageAt && curIdx(s) === targetIdx(s) - 1 && !stage(s, s.stageKey)?.final;
/* Skipped steps since the sample last entered them, with the reason. */
function skipInfo(s, key){
  const h = s.history || [];
  for (let i = h.length - 1; i >= 0; i--){ if (h[i].key === key && !h[i].skipped) return null; if ((h[i].skipped || []).includes(key)) return h[i]; }
  return null;
}
function stageDue(s){ const st = stage(s, s.stageKey); return st && !st.final ? dueFrom(s.stageAt, st) : null; }
const awaiting = s => s.stageKey === "submitted";
const twoPerson = s => !!(s && (s.two || ["bullion", "conc"].includes(s.typeKey) || s.section === "GR"));
const massUnit = s => typeOf(s?.typeKey)?.unit || "kg";
const keptMaterials = s => (s.materials || []).filter(m => m.status === "kept");
const overdueMaterials = (s, now = Date.now()) => keptMaterials(s).filter(m => m.dueAt && now > m.dueAt);
/* Still in the lab: awaiting receipt or anywhere before storage. These are the samples the board loads; samples whose material is only
   being kept are listed from their stock records instead, so the board stays small however long material is retained. */
const labOf = s => !!s && s.open !== false && !stage(s, s.stageKey)?.final && stage(s, s.stageKey)?.phase !== "store";
/* A stock record per received sample (stock/<ID>, a few hundred bytes): where it is (lab, store or out), when it came in and left, and the
   material kept. The Storage tab, the ledger's month check and Settings read these instead of whole samples. Derived from the sample only. */
const OPEN_T = 9e15;   // `gone` while the sample is on hand: a number later than any date, so range filters work on every store
function stockOf(s){
  if (!s || !s.id || !s.recvAt) return null;
  const on = s.onHand !== false && s.open !== false && !stage(s, s.stageKey)?.final, kept = on ? keptMaterials(s) : [];
  return { id: s.id, sec: s.section || "", type: s.type || "", route: s.route || "", tag: (s.tags || []).join(", "), recvAt: s.recvAt,
    gone: on ? OPEN_T : s.closedAt || s.stageAt || s.recvAt, st: !on ? "out" : stage(s, s.stageKey)?.phase === "store" ? "store" : "lab",
    due: kept.length ? Math.min(...kept.map(m => m.dueAt || OPEN_T)) : OPEN_T, two: twoPerson(s),
    m: kept.map(m => ({ k: m.k, item: m.item, loc: m.loc || "", dueAt: m.dueAt || 0, then: m.then || "" })) };
}
/* Retained materials are created when results are released; each keeps its own clock from that moment. */
function materialsAt(s, relAt){
  const ret = s.retention && s.retention.length ? s.retention : [{ item: "Sample remainder", days: 30, then: "Disposed" }];
  return ret.map((x, i) => ({ k: "m" + (i + 1), item: x.item, days: +x.days || 0, then: x.then || "Disposed", dispo: dispoOf(x.then), status: "kept",
    dueAt: relAt + (+x.days || 0) * 86400e3, loc: "", outs: 0 }));
}
function status(s){
  const st = stage(s, s.stageKey), i = stageIdx(s, s.stageKey), t = targetIdx(s), now = Date.now();
  if (!st) return { label: "Unknown stage", cls: "", closed: false, late: false };
  if (st.final) return { label: st.name, cls: ["rejected", "cancelled"].includes(s.stageKey) ? "bad" : "", closed: true, late: false };
  const due = stageDue(s), late = !!(due && now > due);
  if (awaiting(s)) return { label: s.flag ? "Flagged at receipt" : late ? "Not yet received (overdue)" : "Awaiting receipt at lab", cls: s.flag || late ? "warn" : "info", closed: false, late };
  if (i >= t){
    const od = overdueMaterials(s, now), notStored = i === t && late;
    // v24d: a witness asked to confirm is what the sample waits for; material kept "until release" (days 0) is due then, not overdue
    if (i === t && s.wq && s.wq.kind === "store") return { label: `Waiting for ${s.wq.wit} to confirm the storage`, cls: notStored ? "warn" : "info", closed: false, late: notStored, post: true };
    const verb = xs => xs.every(m => m.dispo === "returned") ? "return" : "disposal or return";
    if (od.length && od.every(m => !m.days)) return { label: `${od.map(m => m.item).join(", ")} due for ${verb(od)} at release`, cls: "warn", closed: false, late: notStored, post: true };
    if (od.length) return { label: `Retention ended: ${od.map(m => m.item).join(", ")} due for ${verb(od)}`, cls: "warn", closed: false, late: true, post: true };
    if (notStored) return { label: "Results released; material not yet put in storage", cls: "warn", closed: false, late: true, post: true };
    return i === t ? { label: "Results released", cls: "ok", closed: false, late: false, post: true } : { label: "Complete: in storage", cls: "ok", closed: false, late: false, post: true };
  }
  if (waitingRes(s)) return { label: late ? "Waiting for results (overdue)" : "Waiting for results", cls: late ? "warn" : "info", closed: false, late };
  return { label: late ? `Overdue at ${st.name}` : `In progress: ${st.name}`, cls: late ? "bad" : "gold", closed: false, late };
}
/* Projected start time of every stage up to and including results released. */
function projection(s){
  const p = planOf(s), i = p.findIndex(x => x.key === s.stageKey), t = targetIdx(s), out = {};
  if (i < 0 || i >= t) return { out, eta: null };
  let clock = Math.max(dueFrom(s.stageAt, p[i]), Date.now());
  for (let j = i + 1; j <= t; j++){ const at = p[j].clock ? clock : workStart(clock); out[p[j].key] = at; clock = dueFrom(at, p[j]); }
  return { out, eta: out[p[t].key] };
}
function daysLabel(d){
  d = +d || 0;
  if (d === 365) return "12 months";
  if (d >= 30 && d % 30 === 0) return `${d / 30} month${d === 30 ? "" : "s"}`;
  if (d >= 7 && d % 7 === 0) return `${d / 7} week${d === 7 ? "" : "s"}`;
  return `${d} day${d === 1 ? "" : "s"}`;
}
const lcFirst = t => String(t || "").charAt(0).toLowerCase() + String(t || "").slice(1);
const retentionLine = x => +x.days ? `${x.item}: kept ${daysLabel(x.days)} after results, then ${lcFirst(x.then)}` : `${x.item}: ${lcFirst(x.then)}`;
const routeOptions = (sel, list = cfg.routes || []) => list.map(r => `<option value="${esc(r.code)}" ${r.code === sel ? "selected" : ""}>${esc(r.code)} · ${esc(r.name)}</option>`).join("");
const routeLine = r => r ? `${r.stages.length} lab steps; results about ${hoursLabel(routeTat(r))} after receipt.` : "";
function routePreview(r){
  return `<div class="route-box">
    <div class="row" style="gap:8px"><span class="code">${esc(r.code)}</span><b>${esc(r.name)}</b>${r.two ? `<span class="pill warn">Two-person custody</span>` : ""}</div>
    ${r.desc ? `<div class="small muted">${esc(r.desc)}</div>` : ""}
    <ol class="steps">${[HEAD[1], ...stepsUsed(r.stages)].map(x => `<li class="ph-${esc(x.phase)}">${esc(x.name)}<span>${hoursLabel(x.hours)}</span></li>`).join("")}<li class="ph-report">Results released</li></ol>
    <div class="small">Results about <b>${hoursLabel(routeTat(r))}</b> after the lab receives the sample (an estimate from the step times). ${(r.retention || []).length ? `Retention: ${esc(r.retention.map(retentionLine).join("; "))}.` : ""}</div></div>`;
}
const hazTags = s => (s.hazards || []).map(k => HAZARDS.find(h => h.k === k)).filter(Boolean);
const hazPills = s => hazTags(s).map(h => `<span class="haz" title="${esc(h.l)}">${esc(h.tag)}</span>`).join("");
const bagsText = n => `${n} bag${+n === 1 ? "" : "s"}`;
const qtyText = (bags, mass, unit) => [bags ? bagsText(bags) : "", mass ? `${mass} ${unit}` : ""].filter(Boolean).join(", ");

/* ---------- names (store ids only, resolve at render) ---------- */
function who(id){ return id ? `<span data-uid="${esc(id)}">a team member</span>` : "an unsigned user"; }
async function fillNames(root){
  if (!user) return;
  const els = [...root.querySelectorAll("[data-uid]")]; if (!els.length) return;
  const ps = await user.profiles([...new Set(els.map(e => e.dataset.uid))]);
  els.forEach(e => { const p = ps[e.dataset.uid]; e.textContent = (p && p.name) || "a team member"; });
}
