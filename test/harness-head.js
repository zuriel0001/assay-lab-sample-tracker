// Test harness for the Azure build: the same helpers the prototype's tests use, but every page is the real app/index.html
// served by dev/server.js, talking to the real API core over HTTP, with a local imitation of the Microsoft sign-in.
// run-suites.js joins this file with the helper half of ../sample-tracking/test/harness.js (from `const launch` on).
const { chromium } = require("playwright");
const path = require("path");
const { createMemoryStore } = require(path.join(process.env.AZ_ROOT, "api/lib/store-memory"));
const { start } = require(path.join(process.env.AZ_ROOT, "dev/server"));
const mem = createMemoryStore();
const store = mem.docs, leases = mem.leases, pages = [], errors = [], toasts = [];
const stats = { writes: 0 };
for (const k of ["set", "update", "remove"]){ const f = mem[k]; mem[k] = async (...a) => { stats.writes++; return f(...a); }; }
function clone(o){ return o == null ? o : JSON.parse(JSON.stringify(o)); }
/* A test changed `store` directly: mark the record changed so open pages pick it up on their next poll. */
async function broadcast(p, d){ if (d === null) delete store[p]; else if (d !== undefined) store[p] = d; mem.touch(p); await Promise.all(pages.map(pg => pg.evaluate(() => window.__pollNow && window.__pollNow()).catch(() => {}))); await new Promise(r => setTimeout(r, 300)); }
if (process.env.DUMP_STORE) process.on("exit", () => require("fs").writeFileSync(process.env.DUMP_STORE, JSON.stringify(store)));   // for measuring record sizes
let srv = null;
// unref: the suites end by closing the browser, and the local server must not keep the test process alive after that.
const server = async () => srv || (srv = await start({ port: 0, store: mem, adminEmails: ["boss@site.test"], quiet: true }), srv.server.unref(), srv);
const FILE = "(served by dev/server.js)";
let BASE = "";

async function newUser(browser, opts, viewport = { width: 1280, height: 900 }, scheme = "light", extra = {}){
  const s = await server(); BASE = `http://localhost:${s.port}`;
  const ctx = await browser.newContext({ viewport, colorScheme: scheme, ...extra });
  const page = await ctx.newPage();
  page.on("console", m => { if (m.type() === "error" && !/fonts\.g/.test(m.text())) errors.push(`[${opts.name}] ${m.text()}`); });
  page.on("pageerror", e => errors.push(`[${opts.name}] pageerror ${e.message} ${(e.stack || "").split("\n").slice(1, 4).join(" < ")}`));
  page.on("console", m => { if (m.type() === "log" && m.text().startsWith("TOAST:")) { toasts.push(`[${opts.name}] ${m.text().slice(6)}`); if (process.env.DBG) console.log("    toast", `[${opts.name}]`, m.text().slice(6)); } });
  await page.addInitScript(() => { document.addEventListener("DOMContentLoaded", () => { const t = document.getElementById("toast"); if (t) new MutationObserver(() => { if (!t.hidden && t.textContent) console.log("TOAST:" + t.textContent); }).observe(t, { childList: true, characterData: true, subtree: true, attributes: true }); }); });
  // A prototype session token in localStorage means nothing here; signing in is the Microsoft cookie (see signIn).
  if (opts.session) await page.addInitScript(`try { localStorage.setItem("session", ${JSON.stringify(opts.session)}); } catch {}`);
  await page.addInitScript("window.__POLL_MS = 120;");   // near-instant updates between pages, as the prototype's in-memory test store had
  page.__ctx = ctx;
  await page.goto(BASE + "/" + (opts.hash ? "#" + opts.hash : ""));
  pages.push(page);
  await page.waitForSelector("#sync.ok", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(350);
  return page;
}
/* Signs the page in as an example account (by username, which the local server allows) without reloading it. */
async function signIn(page, u){
  await page.__ctx.addCookies([{ name: "devauth", value: u, url: BASE }]);
  await page.evaluate(() => window.__refreshMe());
  await page.waitForTimeout(250);
}
