// Dry run of the version 13 upgrade on a copy of the live register (nothing is written to the real one). Fetch it read-only into ../live6 first.
const H = require("./harness"), fs = require("fs"), path = require("path");
const base = path.resolve(__dirname, "../live6");
for (const c of ["samples", "meta", "ledger"]) for (const f of fs.readdirSync(path.join(base, c))){ const d = JSON.parse(fs.readFileSync(path.join(base, c, f), "utf8")); H.store[`${c}/${f.replace(/\.json$/, "")}`] = d.data || d; }
(async () => {
  const b = await H.launch();
  const p = await H.newUser(b, { uid: "u_z", name: "Zuriel", canEdit: true, names: {} });
  await H.waitFor(() => H.store["meta/schema"].v === 13, 8000);
  await p.waitForTimeout(800);
  for (const [k, d] of Object.entries(H.store).filter(([k]) => k.startsWith("samples/"))){
    const s = H.store["stock/" + d.id];
    console.log(k, JSON.stringify({ v: d.v, stage: d.stageKey, lab: d.lab, sx: d.sx, stock: s && { st: s.st, gone: s.gone, m: s.m.map(m => `${m.item}@${m.loc || "-"}`) } }));
  }
  console.log("schema", JSON.stringify(H.store["meta/schema"]));
  await H.signIn(p, "tech1"); await p.click('[data-tab="board"]'); await p.waitForTimeout(500);
  console.log("board count:", await p.textContent("#cntActive"), "| lanes:", (await p.textContent(".lanes").catch(() => "")).match(/[A-Z]{2,5}-\d{4,8}-\d{4,5}/g));
  await p.click('[data-tab="storage"]'); await p.waitForTimeout(600);
  console.log("storage:", (await p.textContent("#view-storage")).replace(/\s+/g, " ").replace(/All sections.*Export CSV/, "…").slice(0, 600));
  await p.click('[data-tab="ledger"]'); await p.waitForTimeout(800);
  console.log("month check:", ((await p.textContent("#view-ledger")).match(/Month check:[^.]*\./) || ["(none)"])[0]);
  console.log("errors", H.errors);
  await b.close();
})();
