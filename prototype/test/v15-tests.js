// v15: design refresh. Navigation with icons, a More menu and a phone bottom bar; brand header with search, theme switch and
// company logo; board summary chips that filter, cards with time left, folded empty lanes, wall screen; record progress and
// countdown with empty details folded away; a Today strip for staff; touch sizes, sticky save bars, zebra tables.
// Run: NODE_PATH=$(npm root -g) timeout 590 node v15-tests.js
const H = require("./harness");
const { store, errors, newUser, launch, signIn, fillForm, ids, open, waitFor, cfgTab, localStr } = H;
const names = {};
const log = (...a) => console.log("•", ...a);
const check = (cond, msg) => { console.log(cond ? "  PASS" : "  FAIL", msg); if (!cond) process.exitCode = 1; };
const HOUR = 3600e3;
const shown = (page, sel) => page.$eval(sel, e => !!e.offsetParent || getComputedStyle(e).position === "fixed").catch(() => false);
const barTabs = page => page.$$eval("#tabs > button[data-tab]", bs => bs.filter(b => !b.hidden).map(b => b.dataset.tab));
const menuTabs = page => page.$$eval("#tabMenu button[data-tab]", bs => bs.filter(b => !b.hidden).map(b => b.dataset.tab));
const noScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

(async () => {
  const browser = await launch();
  require("./harness").useOldRoutes();   // v23: this suite is written around the routes in use before version 23
  const P = await newUser(browser, { uid: "u_p", name: "Public", canEdit: true, names });
  const A = await newUser(browser, { uid: "u_a", name: "Admin", canEdit: true, names }); await signIn(A, "admin");
  await P.waitForTimeout(800);

  log("Navigation");
  check((await barTabs(A)).join() === "board,track,submit,results,batches,storage,ledger,routes,stages" && await A.$eval("#tabMoreWrap", w => w.hidden), "computer: all nine admin tabs fit in the row, no More menu (v17: no separate Register when signed in; v24: Results for staff)");
  check(await A.$$eval("#tabs > button[data-tab]:not([hidden])", bs => bs.every(b => getComputedStyle(b, "::before").maskImage.startsWith("url(") || getComputedStyle(b, "::before").webkitMaskImage.startsWith("url("))), "every tab has an icon");
  const Tb = await newUser(browser, { uid: "u_tb", name: "Tablet", canEdit: true, names }, { width: 820, height: 1000 }); await signIn(Tb, "admin");
  const tbMenu = await menuTabs(Tb);
  check(!(await Tb.$eval("#tabMoreWrap", w => w.hidden)) && tbMenu.length > 0 && tbMenu[tbMenu.length - 1] === "stages" && (await barTabs(Tb))[0] === "board", `tablet: tabs that don't fit go under More (${tbMenu.join(", ")})`);
  await Tb.click("#tabMore"); await Tb.waitForTimeout(100);
  check(await shown(Tb, '#tabMenu [data-tab="stages"]') && await Tb.$eval("#tabMore", b => b.getAttribute("aria-expanded")) === "true", "More opens a menu");
  await Tb.click('#tabMenu [data-tab="stages"]'); await Tb.waitForSelector(".subtabs");
  check(await Tb.$eval("#tabMenu", m => m.hidden) && await Tb.$eval("#tabMore", b => b.classList.contains("on")), "choosing Settings from the menu opens it, closes the menu and underlines More");
  await Tb.evaluate(() => { document.querySelector('#tabs [data-tab="stages"]').textContent = "Settings (1)"; }); await Tb.waitForTimeout(100);
  check(await Tb.$eval("#tabMore", b => b.classList.contains("dot")), "a count on a tab inside More puts a dot on More");
  await Tb.evaluate(() => { document.querySelector('#tabs [data-tab="stages"]').textContent = "Settings"; });
  await Tb.click("#tabMore"); await Tb.keyboard.press("Escape"); await Tb.waitForTimeout(80);
  const escClosed = await Tb.$eval("#tabMenu", m => m.hidden);
  await Tb.click("#tabMore"); await Tb.mouse.click(400, 900); await Tb.waitForTimeout(80);
  check(escClosed && await Tb.$eval("#tabMenu", m => m.hidden), "Escape or a click elsewhere closes the menu");

  const M = await newUser(browser, { uid: "u_m", name: "Phone", canEdit: true, names }, { width: 390, height: 844 }); await signIn(M, "tech1");
  const bar = await M.evaluate(() => { const n = document.querySelector("#tabs"), r = n.getBoundingClientRect(); return { fixed: getComputedStyle(n).position === "fixed", bottom: Math.round(innerHeight - r.bottom), h: Math.round(r.height) }; });
  check(bar.fixed && bar.bottom === 0 && bar.h >= 60 && (await barTabs(M)).join() === "board,track,submit,batches" && (await menuTabs(M)).join() === "storage,ledger,routes", "phone: bottom bar with Board, Sample, Submit, Batches; the rest under More");
  check(await M.$$eval("#tabs > button[data-tab]:not([hidden]), #tabMore", bs => bs.every(b => b.getBoundingClientRect().height >= 48)), "phone bar buttons are at least 48 px tall");
  await H.tab(M, "ledger"); await M.waitForTimeout(250);
  check(await M.$eval("#view-ledger", v => !v.hidden) && await noScroll(M), "a tab under More opens on the phone, with no sideways scroll");
  const Pm = await newUser(browser, { uid: "u_pm", name: "Public phone", canEdit: true, names }, { width: 390, height: 844 });
  check((await Pm.$$eval("#tabs > button[data-tab]", bs => bs.filter(b => !b.hidden).sort((a, b) => (+getComputedStyle(a).order) - (+getComputedStyle(b).order)).map(b => b.dataset.tab))).join() === "register,track,routes,login" && await Pm.$eval("#tabMoreWrap", w => w.hidden), "phone, signed out (v16): Register, Sample, Routes, Sign in and no More");

  log("Header");
  check(await A.$eval("header.top", h => !!h.querySelector("#lookupForm") && !!h.querySelector("#brandLogo") && !!h.querySelector("#themeBtn")), "the search box, logo slot and theme switch are in the brand bar");
  check(await A.$eval("header.top", h => getComputedStyle(h).backgroundColor) !== await A.$eval("body", b => getComputedStyle(b).backgroundColor), "the brand bar is darker than the page");
  check(await A.$eval("#lookupInput", i => getComputedStyle(i).color) !== await A.$eval("#lookupInput", i => getComputedStyle(i).backgroundColor), "typed text in the search box is readable");
  const mh = await Pm.evaluate(() => { const i = document.querySelector("#lookupInput").getBoundingClientRect(), b = document.querySelector("#lookupForm button").getBoundingClientRect(); return { inside: b.left >= i.left && b.right <= i.right + 1 && b.top >= i.top - 1 && b.bottom <= i.bottom + 1 }; });
  check(mh.inside, "phone: the Track button sits inside the search box");
  await A.click("#themeBtn"); await A.waitForTimeout(80);
  const dark1 = await A.evaluate(() => [document.documentElement.dataset.theme, localStorage.getItem("theme"), document.querySelector("#themeBtn").getAttribute("aria-pressed")]);
  check(dark1.join() === "dark,dark,true" && await A.$eval("body", b => getComputedStyle(b).backgroundColor) === "rgb(20, 24, 22)", "the theme switch turns on the dark theme and remembers it");
  await A.click("#themeBtn"); await A.waitForTimeout(80);
  check(await A.evaluate(() => !document.documentElement.dataset.theme && !localStorage.getItem("theme")), "switching back follows the device again");

  log("Board");
  await fillForm(P, "submit", { section: "EXP", type: "core", purpose: "exp", submitter: "Ama", count: 2 }); const ex = await ids(P);
  await fillForm(A, "register", { section: "GC", type: "rc", purpose: "gc", submitter: "Kofi", recvAt: localStr(Date.now() - 3 * HOUR) }); const [late] = await ids(A);
  await open(A, ex[0]); await A.click('[data-receipt="confirm"]'); await A.waitForTimeout(400);
  await H.tab(A, "board"); await A.waitForTimeout(400);
  // v16: the tiles of the earlier board, zeros included; a tile with samples is a button that filters the board.
  const sums = await A.$$eval(".stats .stat", bs => bs.map(b => [b.querySelector(".l").textContent, b.querySelector(".n").textContent, b.className, b.tagName, b.dataset.bpick || ""]));
  check(sums.length >= 11 && sums.some(s => s[1] === "0") && sums.filter(s => s[1] === "0").every(s => s[3] === "DIV") && sums.some(s => /Running late/.test(s[0]) && s[1] === "1" && /\bbad\b/.test(s[2]) && s[3] === "BUTTON" && s[4] === "late") && sums.some(s => /Awaiting receipt/.test(s[0]) && s[1] === "1"), "summary tiles show every count, zeros too; Running late is red and clickable: " + sums.map(s => s[1] + " " + s[0]).join(" | "));
  const card = id => A.$eval(`.chip[data-open="${id}"]`, c => ({ cls: c.className, left: c.querySelector(".left")?.textContent || "" })).catch(() => null);
  const cl = await card(late), co = await card(ex[0]);
  check(cl && /\bt-late\b/.test(cl.cls) && /late$/.test(cl.left) && co && /\bt-(ok|soon)\b/.test(co.cls) && /left$/.test(co.left), `cards show time left or late with a coloured edge (${cl?.left}; ${co?.left})`);
  const lanes = await A.$$eval(".lane", ls => ls.map(l => [l.classList.contains("empty"), Math.round(l.getBoundingClientRect().width), l.querySelectorAll(".chip").length, getComputedStyle(l.parentElement).display]));
  check(lanes.every(l => !l[0] && l[3] === "grid" && l[1] >= 200 && Math.abs(l[1] - lanes[0][1]) <= 1) && lanes.some(l => l[2] === 0), "lanes sit in a grid, all the same width, empty ones too (v16)");
  await A.click('[data-bpick="late"]'); await A.waitForTimeout(150);
  check((await A.$$eval(".lanes .chip", cs => cs.map(c => c.dataset.open))).join() === late && /Showing/.test(await A.textContent("#view-board")), "the Running late chip shows only late samples");
  await A.click('.pick-note [data-bpick="late"]'); await A.waitForTimeout(150);
  check((await A.$$eval(".lanes .chip", cs => cs.length)) === 3, "Show all brings every sample back");
  await A.click("#bdWall"); await A.waitForTimeout(200);
  check(await A.evaluate(() => document.body.classList.contains("wall")) && !(await shown(A, "header.top")) && !(await shown(A, "#tabs")) && await shown(A, ".wall-head") && /^\d\d:\d\d$/.test(await A.textContent("#wallClock")), "Wall screen shows the board alone with a clock");
  await A.click("[data-wall-exit]"); await A.waitForTimeout(200);
  check(!(await A.evaluate(() => document.body.classList.contains("wall"))) && await shown(A, "header.top") && (await barTabs(A)).length === 9, "Exit brings the page back");

  log("Sample record");
  await open(A, ex[0]);
  const prog = await A.$eval(".prog", p => ({ t: p.textContent.replace(/\s+/g, " "), v: +p.querySelector("[role=progressbar]").getAttribute("aria-valuenow") }));
  // v22: 11 steps, the QA/QC review step not used
  check(/Step 2 of 11/.test(prog.t) && prog.v > 0 && prog.v < 20 && /left on this step/.test(prog.t), `progress bar: ${prog.t.trim()} (${prog.v}%)`);
  check(/^\d+[dhm]/.test((await A.textContent(".eta .cd")).trim()) && /Results expected in/.test(await A.textContent(".eta")), "the results card counts down");
  const facts = await A.evaluate(() => ({ main: [...document.querySelectorAll(".panel > dl.facts dd")].map(d => d.textContent.trim()), more: [...document.querySelectorAll("details.facts-more dt")].map(d => d.textContent), open: document.querySelector("details.facts-more")?.open }));
  check(!facts.main.includes("—") && facts.more.includes("Site reference") && facts.more.includes("Notes") && facts.open === false, "empty details are folded under Show all details");
  const tone = await A.$eval(".card-head .pill", p => p.className), edge = co.cls.match(/t-(ok|soon)/)[1];
  check(tone.includes(edge === "ok" ? "ok" : "warn"), "the status pill uses the board card's colour");
  await open(A, late);
  check(await A.$eval(".prog", p => p.classList.contains("late")) && await A.$eval(".eta", e => e.classList.contains("late")) && /\bbad\b/.test(await A.$eval(".card-head .pill", p => p.className)), "a late sample's progress, countdown and pill are red");

  log("Start page");
  const S = await newUser(browser, { uid: "u_s", name: "Start", canEdit: true, names }); await signIn(S, "tech1");
  await H.tab(S, "track"); await S.waitForSelector(".hero");
  const today = await S.$$eval(".today button", bs => bs.map(b => [b.dataset.today, b.querySelector(".n").textContent]));
  // The late sample was received 3 hours ago: just after midnight that is yesterday (the counts are by site day).
  const recvN = String(1 + (new Date(Date.now() - 3 * HOUR).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10) ? 1 : 0));
  check(today.map(t => t[0]).join() === "recvToday,dueToday,late,rel" && today[0][1] === recvN && today[2][1] === "1", "staff see Today: received, due, late, released (" + today.map(t => t.join(" ")).join(", ") + ")");
  check(!(await S.$$eval("#view-track p", ps => ps.length)), "no explanatory paragraph on the start page");
  await S.click('[data-today="recvToday"]'); await S.waitForTimeout(250);
  check(await S.$eval("#view-board", v => !v.hidden) && (await S.$$eval(".lanes .chip", cs => cs.length)) === +recvN && /received today/i.test(await S.textContent(".pick-note")), "a Today number opens the board filtered to it");
  await H.tab(S, "track"); await S.fill("#heroInput", ex[1].toLowerCase()); await S.press("#heroInput", "Enter"); await S.waitForSelector(".sid");
  check((await S.textContent(".sid")) === ex[1], "the big search box opens a sample");
  await H.tab(P, "track").catch(() => {}); await P.evaluate(() => { location.hash = ""; });
  const P2 = await newUser(browser, { uid: "u_p2", name: "Public 2", canEdit: true, names }); await H.tab(P2, "track"); await P2.waitForSelector(".hero");
  check(!(await P2.$(".today")), "people who are not signed in get the search box without the Today strip");

  log("Company logo");
  await H.tab(A, "stages"); await cfgTab(A, "sections");
  const png = await A.evaluate(() => { const c = document.createElement("canvas"); c.width = 900; c.height = 300; const g = c.getContext("2d"); g.fillStyle = "#1b5e20"; g.fillRect(0, 0, 900, 300); g.fillStyle = "#ffd54f"; g.font = "bold 160px sans-serif"; g.fillText("AGM", 60, 210); return c.toDataURL("image/png").split(",")[1]; });
  await A.setInputFiles("#logoFile", { name: "logo.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") }); await A.waitForSelector("#logoPrev img");
  await A.click("#cfgSave"); await waitFor(() => store["settings/stages"]?.logo); await A.waitForTimeout(400);
  const lg = store["settings/stages"]?.logo || "";
  check(/^data:image\/(png|webp);base64,/.test(lg) && lg.length < 90000, `the logo is scaled and saved with Settings (${Math.round(lg.length / 1024)} KB)`);
  const size = await P2.$eval("#brandLogo img", i => [i.naturalWidth, i.naturalHeight]).catch(() => null);
  check(size && size[0] <= 480 && size[1] <= 140 && await P2.$eval("#brandLogo", l => l.classList.contains("has-img")), `everyone sees it in the header (${size})`);
  await H.tab(A, "stages"); await cfgTab(A, "sections"); await A.click("#logoDel"); await A.click("#cfgSave"); await waitFor(() => store["settings/stages"]?.logo === ""); await P2.waitForTimeout(300);
  check(!(await P2.$("#brandLogo img")), "Remove puts the default mark back");
  await A.evaluate(() => window.__dbPush("settings/stages", { ...window.__mirror["settings/stages"], logo: "javascript:alert(1)" })); await A.waitForTimeout(200);
  check(!(await A.$("#brandLogo img")), "anything but a PNG, JPEG or WebP picture is ignored");

  log("Touch, bars, tables");
  await H.tab(A, "board"); await A.waitForTimeout(200);
  const small = await A.$$eval(".btn:not(.small)", bs => bs.filter(b => b.offsetParent).map(b => [b.textContent.trim(), Math.round(b.getBoundingClientRect().height)]).filter(x => x[1] < 44));
  check(!small.length, "buttons are at least 44 px tall " + JSON.stringify(small));
  await H.tab(A, "stages");
  check(await A.$eval("#cfgSave", b => getComputedStyle(b.parentElement).position) === "sticky", "the Save settings bar stays in view");
  await H.tab(A, "submit");
  check(await A.$eval("#rSubmit", b => getComputedStyle(b.parentElement).position) === "sticky" && await A.$eval("#rSubmit", b => b.parentElement.lastElementChild === b), "the Submit bar stays in view, primary button on the right");
  await H.tab(A, "ledger"); await A.waitForTimeout(400);
  const zebra = await A.$$eval(".tbl-wrap tbody tr", rs => rs.slice(0, 2).map(r => getComputedStyle(r.cells[0]).backgroundColor));
  check(zebra.length === 2 && zebra[0] !== zebra[1] && await A.$eval(".tbl-wrap thead th", th => getComputedStyle(th).position) === "sticky", "tables have zebra rows and a header that stays in view");

  log("Phone pages");
  for (const t of ["board", "track", "submit", "storage"]){ await H.tab(M, t); await M.waitForTimeout(200); if (!(await noScroll(M))) check(false, "sideways scroll on phone: " + t); }
  await open(M, late);
  check(await noScroll(M), "no sideways scroll on the phone board, start page, forms or record");
  const covered = await M.evaluate(() => { const b = document.querySelector("#tabs").getBoundingClientRect(); return parseFloat(getComputedStyle(document.querySelector(".wrap")).paddingBottom) >= b.height; });
  check(covered, "the page leaves room for the bottom bar");

  log("Print");
  await A.emulateMedia({ media: "print" });
  check(!(await A.$eval("header.top", h => getComputedStyle(h).display !== "none")) && !(await A.$eval("#tabs", h => getComputedStyle(h).display !== "none")), "printing leaves out the brand bar and tabs");
  await A.emulateMedia({ media: "screen" });

  check(errors.length === 0, "no console errors " + errors.join(" | "));
  console.log("\nConsole errors:", errors.length ? errors : "none");
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
