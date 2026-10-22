process.env.V24 = "1";
const H = require("./harness");
const { newUser, launch, signIn, open, fillForm, ids } = H;
(async () => {
  const browser = await launch(), names = {};
  const Tc = await newUser(browser, { uid: "u_t", name: "Tech", canEdit: true, names }); await signIn(Tc, "tech1");
  await fillForm(Tc, "submit", { section: "GEO" }); const [a] = await ids(Tc);
  const out = {};
  for (const [dev, vp] of [["desk", { width: 1280, height: 900 }], ["phone", { width: 390, height: 844 }]]){
    const pg = await newUser(browser, { uid: "u_" + dev, name: "Admin", canEdit: true, names }, vp);
    await pg.context().unrouteAll(); await pg.reload(); await pg.waitForTimeout(300); await signIn(pg, "admin"); await pg.waitForTimeout(400);
    const fs = async (sels) => pg.evaluate(sels => Object.fromEntries(sels.map(s => { const e = document.querySelector(s); return [s, e ? parseFloat(getComputedStyle(e).fontSize).toFixed(1) : "-"]; })), sels);
    await H.tab(pg, "board"); await pg.waitForTimeout(400);
    Object.assign(out[dev] = {}, await fs(["body", "header.top h1", "header.top .who", "header.top .pill", "#signBtn", "header.top .lookup .btn.big", "header.top .lookup input", "#tabs>button[data-tab]", ".stat.tile .n", ".stat.tile .l", ".lane h4", ".lane h4 span", ".chip .cid", ".chip .cmeta", ".bd-view button", "#bdWall", "#view-board select"]));
    await open(pg, a); Object.assign(out[dev], await fs([".sid", ".eta .val", ".eta .lbl", "dl.facts dt", "dl.facts dd", ".st-meta", "h3", ".btn.small", ".pill"]));
    await H.tab(pg, "submit"); await pg.waitForTimeout(300); Object.assign(out[dev], await fs(["label.f", "#rType", ".seg span", "h2", "#rSubmit"]));
  }
  console.log(JSON.stringify(out));
  await browser.close();
})();
