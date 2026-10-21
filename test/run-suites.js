// Runs the prototype's own end-to-end test suites against the Azure build (app/index.html + API core + local sign-in).
// The suites are copied from ../sample-tracking/test (prototype/test in the GitHub repository) into a scratch folder next to an Azure harness (unchanged, except
// the ADJUST list below);
// azure-extra.js (this folder) checks what is new in the Azure build.
//   node test/run-suites.js run.js results-tests.js     (default: all seventeen, then azure-extra.js)
const fs = require("fs"), path = require("path"), os = require("os"), { spawnSync } = require("child_process");
const AZ = path.resolve(__dirname, "..");
const PROTO = [path.join(AZ, "prototype", "test"), path.resolve(AZ, "..", "sample-tracking", "test")].find(d => fs.existsSync(d));   // GitHub repository, or project folder
const work = process.env.WORK_DIR || fs.mkdtempSync(path.join(os.tmpdir(), "az-suites-"));
const orig = fs.readFileSync(path.join(PROTO, "harness.js"), "utf8");
let tail = orig.slice(orig.indexOf("const launch = "));
const a = tail.indexOf("async function signIn("), b = tail.indexOf("async function fillForm(");
if (a < 0 || b < 0) throw new Error("harness layout changed");
tail = tail.slice(0, a) + tail.slice(b);
fs.writeFileSync(path.join(work, "harness.js"), fs.readFileSync(path.join(__dirname, "harness-head.js"), "utf8") + "\n" + tail);
const suites = process.argv.slice(2).length ? process.argv.slice(2) : ["run.js", "results-tests.js", "v12-tests.js", "v13-tests.js", "review-tests-v11.js", "review-v11-scenarios.js", "hours-shortcut-tests.js", "v14-tests.js", "work-hours-unit.js", "v15-tests.js", "v16-tests.js", "v17-tests.js", "v18-tests.js", "v20-tests.js", "v21-tests.js", "v22-tests.js", "v23-tests.js", "v24-tests.js", "v25-tests.js", "v26-tests.js", "v27-tests.js", "v28-tests.js", "v29-tests.js", "azure-extra.js"];
/* Checks the prototype's suites make differently here. Since v13 no suite reads a sentence build.py section 10 takes out.
   v14-tests.js: tracking links and bag-label QR codes carry this site's own address, not the Claude artifact's, and the suite
   opens them there; where no QR decoder is installed, a label's QR code is compared with the page's own encoder run in Node on the text it
   should hold (the prototype's suite proves that encoder with a decoder). */
const ADJUST = {
  "v14-tests.js": [
    ['const SHARE = "https://claude.ai/artifact/5JgoyE2wokT67u8TCtYDop";', `let SHARE = "";
const qrOf = (() => { const page = require("fs").readFileSync(path.join(process.env.AZ_ROOT, "app/index.html"), "utf8"); const a = page.indexOf("/* ---------- QR codes"), b = page.indexOf("/* ---------- bag labels"); if (a < 0 || b < a) throw new Error("QR code not found in the page"); const f = {}; eval(page.slice(a, b) + "\\nf.qrSvg = qrSvg;"); return f.qrSvg; })();`],
    ["  if (!jsQR) return null;", `  if (!jsQR){ const t = await page.$eval(sel, s => s.closest(".bag-label").textContent); const want = SHARE + "#" + ((t.match(/[A-Z0-9]{1,8}-\\d{8}-\\d{4}/) || [""])[0]); return qrOf(want).includes(\`d="\${d}"\`) ? want : "(a different code)"; }`],
    ["  const q0 = await readQr(P,", "  SHARE = new URL(P.url()).origin + \"/\"; const q0 = await readQr(P,"],
    ["check(jsQR ? q0 === SHARE + \"#\" + ex[0] && q1 === SHARE + \"#\" + ex[1] : false,", "check(q0 === SHARE + \"#\" + ex[0] && q1 === SHARE + \"#\" + ex[1],"],
    ['await T2.goto(H.FILE + "#" + ex[0]);', 'await T2.goto(SHARE + "#" + ex[0]);'],
    ['await P.goto(H.FILE + "#" + ex[0]);', 'await P.goto(SHARE + "#" + ex[0]);']
  ],
  "work-hours-unit.js": [['path.resolve(__dirname, "../assay-lab-sample-tracker.html")', 'path.join(process.env.AZ_ROOT, "app/index.html")']],   // this build's page
  // A logo the server would refuse (api-tests.js) is put straight into the database, to show the page ignores it too.
  "v15-tests.js": [['await A.evaluate(() => window.__dbPush("settings/stages", { ...window.__mirror["settings/stages"], logo: "javascript:alert(1)" })); await A.waitForTimeout(200);',
    'await H.broadcast("settings/stages", { ...store["settings/stages"], logo: "javascript:alert(1)" }); await A.waitForTimeout(400);']],
  "v16-tests.js": [['const src = fs.readFileSync(H.FILE.replace("file://", ""), "utf8");', 'const src = fs.readFileSync(require("path").join(process.env.AZ_ROOT, "app/index.html"), "utf8");']],   // this build's page
  "v26-tests.js": [['const src = require("fs").readFileSync(H.FILE.replace("file://", ""), "utf8");', 'const src = require("fs").readFileSync(require("path").join(process.env.AZ_ROOT, "app/index.html"), "utf8");']]   // this build's page
};
let bad = 0;
for (const s of suites){
  const file = [path.join(PROTO, s), path.join(__dirname, s)].find(f => fs.existsSync(f));   // the prototype's suites, or this folder's own
  if (!file){ console.log(`\n===== ${s} ===== skipped: not in this copy (v18-tests.js needs the lab's private reports and is kept out of GitHub)`); continue; }
  let code = fs.readFileSync(file, "utf8");
  for (const [from, to] of ADJUST[s] || []){
    if (code.split(from).length !== 2) throw new Error(`${s}: check to adjust not found exactly once: ${from.slice(0, 60)}`);
    code = code.replace(from, () => to);
  }
  fs.writeFileSync(path.join(work, s), code);
  console.log(`\n===== ${s} =====`);
  const r = spawnSync(process.execPath, [path.join(work, s)], { cwd: work, stdio: "inherit", timeout: 900000, env: { ...process.env, AZ_ROOT: AZ, NODE_PATH: [process.env.NODE_PATH, spawnSync("npm", ["root", "-g"]).stdout.toString().trim()].filter(Boolean).join(path.delimiter) } });
  if (r.status !== 0) bad++;
}
console.log(`\nWork folder: ${work}`);
process.exit(bad ? 1 : 0);
