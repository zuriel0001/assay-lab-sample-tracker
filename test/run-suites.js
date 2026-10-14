// Runs the prototype's own end-to-end test suites against the Azure build (app/index.html + API core + local sign-in).
// The suites are copied unchanged from ../sample-tracking/test into a scratch folder next to an Azure harness;
// azure-extra.js (this folder) checks what is new in the Azure build.
//   node test/run-suites.js run.js results-tests.js     (default: all five)
const fs = require("fs"), path = require("path"), os = require("os"), { spawnSync } = require("child_process");
const AZ = path.resolve(__dirname, ".."), PROTO = path.resolve(AZ, "..", "sample-tracking", "test");
const work = process.env.WORK_DIR || fs.mkdtempSync(path.join(os.tmpdir(), "az-suites-"));
const orig = fs.readFileSync(path.join(PROTO, "harness.js"), "utf8");
let tail = orig.slice(orig.indexOf("const launch = "));
const a = tail.indexOf("async function signIn("), b = tail.indexOf("async function fillForm(");
if (a < 0 || b < 0) throw new Error("harness layout changed");
tail = tail.slice(0, a) + tail.slice(b);
fs.writeFileSync(path.join(work, "harness.js"), fs.readFileSync(path.join(__dirname, "harness-head.js"), "utf8") + "\n" + tail);
const suites = process.argv.slice(2).length ? process.argv.slice(2) : ["run.js", "results-tests.js", "v12-tests.js", "review-tests-v11.js", "review-v11-scenarios.js", "azure-extra.js"];
let bad = 0;
for (const s of suites){
  fs.copyFileSync(fs.existsSync(path.join(PROTO, s)) ? path.join(PROTO, s) : path.join(__dirname, s), path.join(work, s));   // the prototype's suites, or this folder's own
  console.log(`\n===== ${s} =====`);
  const r = spawnSync(process.execPath, [path.join(work, s)], { cwd: work, stdio: "inherit", timeout: 900000, env: { ...process.env, AZ_ROOT: AZ, NODE_PATH: [process.env.NODE_PATH, spawnSync("npm", ["root", "-g"]).stdout.toString().trim()].filter(Boolean).join(path.delimiter) } });
  if (r.status !== 0) bad++;
}
console.log(`\nWork folder: ${work}`);
process.exit(bad ? 1 : 0);
