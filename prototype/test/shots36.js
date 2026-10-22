// v36 (22 Oct, "revising the page font size"): screenshots of the main screens on a desktop and a phone, to compare type sizes before and
// after. Values here are made up.
// Run: NODE_PATH=$(npm root -g) OUT=<dir> TAG=after node shots36.js   (PAGE=<other page> for the before shots; TEXT=small|large for the choice)
process.env.V24 = "1";
const H = require("./harness");
const { newUser, launch, signIn, open, fillForm, ids } = H;
const OUT = process.env.OUT || __dirname, TAG = process.env.TAG || "after";
(async () => {
  const browser = await launch(), names = {};
  const Tc = await newUser(browser, { uid: "u_t", name: "Tech", canEdit: true, names }); await signIn(Tc, "tech1");
  const made = [];
  for (const section of ["GEO", "EXP", "GEO"]){ await fillForm(Tc, "submit", { section }); made.push(...await ids(Tc)); }
  await fillForm(Tc, "submit", { section: "EXP", count: 3 }); made.push(...await ids(Tc));
  for (const [dev, vp, scheme] of [["desk", { width: 1280, height: 900 }, "light"], ["phone", { width: 390, height: 844 }, "dark"]]){
    const pg = await newUser(browser, { uid: "u_a_" + dev, name: "Admin", canEdit: true, names }, vp, scheme);
    await pg.context().unrouteAll();   // the real web fonts, so the shots show the type people see
    if (process.env.TEXT) await pg.evaluate(t => { try { localStorage.setItem("textSize", t); } catch {} }, process.env.TEXT);
    await pg.reload(); await pg.waitForTimeout(400); await pg.evaluate(() => document.fonts.ready);
    await signIn(pg, "admin"); await pg.waitForTimeout(500);
    const shot = async n => { await pg.waitForTimeout(500); await pg.evaluate(() => { const t = document.getElementById("toast"); if (t) t.hidden = true; }); await pg.screenshot({ path: `${OUT}/${TAG}-${dev}-${n}.png` }); };
    await H.tab(pg, "board"); await shot("board");
    await open(pg, made[0]); await shot("record");
    await H.tab(pg, "submit"); await shot("submit");
    await H.tab(pg, "results"); await shot("results");
    await H.tab(pg, "ledger"); await shot("ledger");
    await H.tab(pg, "stages"); await shot("settings");
  }
  console.log("made", made.join(" "), "errors", JSON.stringify(H.errors));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
