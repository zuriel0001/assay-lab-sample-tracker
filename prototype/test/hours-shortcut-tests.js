// Admin "Edit steps and hours" button on the Workflow routes tab opens Settings on that route.
// Run: NODE_PATH=$(npm root -g) timeout 300 node hours-shortcut-tests.js
const H = require("./harness");
const { errors, newUser, launch, signIn } = H;
const check = (c, m) => { console.log(c ? "  PASS" : "  FAIL", m); if (!c) process.exitCode = 1; };
(async () => {
  const browser = await launch();
  require("./harness").useOldRoutes();   // v23: this suite is written around the routes in use before version 23
  const Ad = await newUser(browser, { uid: "u_a", name: "Admin", canEdit: true, names: {} }); await signIn(Ad, "admin");
  const Tc = await newUser(browser, { uid: "u_t", name: "Tech", canEdit: true, names: {} }); await signIn(Tc, "tech1");
  await Tc.click('#tabs button[data-tab="routes"]'); await Tc.waitForSelector("details.route");
  check((await Tc.$$("[data-edit-route]")).length === 0, "non-admin sees no edit button");
  await Ad.click('#tabs button[data-tab="routes"]'); await Ad.waitForSelector("details.route");
  const n = (await Ad.$$("[data-edit-route]")).length;
  check(n > 30, `admin sees an edit button on each route (${n})`);
  const code = await Ad.$$eval("details.route", ds => ds[5].dataset.code);
  await Ad.evaluate(c => document.getElementById("route-" + c).open = true, code);
  await Ad.click(`[data-edit-route="${code}"]`);
  await Ad.waitForSelector("#rtPick");
  const sel = await Ad.$eval("#rtPick", s => s.options[s.selectedIndex].textContent);
  check(sel.startsWith(code + " "), `Settings opens on route ${code} (${sel})`);
  const top = await Ad.$eval("#rtEdit", e => e.getBoundingClientRect().top);
  check(top >= -2 && top < 200, `page scrolled to Workflow routes (top ${Math.round(top)})`);
  check((await Ad.$$('[aria-label="Hours allowed"]')).length > 0, "hours inputs are shown");
  await Ad.fill('[aria-label="Hours allowed"]', "3"); await Ad.click("#rtPick"); await Ad.keyboard.press("Escape");
  const sel2 = await Ad.$eval("#rtPick", s => s.options[s.selectedIndex].textContent);
  check(sel2.startsWith(code + " "), "editing keeps the same route selected");
  check(errors.length === 0, "no console errors " + errors.join(" | "));
  await browser.close();
})();
