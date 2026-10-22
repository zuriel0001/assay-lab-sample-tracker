/* ---------- v15 design: navigation, theme, logo, wall screen, time left ---------- */
/* Tabs that do not fit go in a More menu: on a computer when the row is full, on a phone after the first four of the bottom bar. */
const NAV_ORDER = ["board", "track", "submit", "register", "results", "storage", "ledger", "routes", "stages", "login"];
const PHONE = matchMedia("(max-width: 760px)");
function closeNavMenu(){ const m = $("#tabMenu"); if (m && !m.hidden){ m.hidden = true; $("#tabMore").setAttribute("aria-expanded", "false"); } }
function layoutNav(){
  const nav = $("#tabs"), wrap = $("#tabMoreWrap"), menu = $("#tabMenu");
  if (!nav || !wrap || !menu || document.body.classList.contains("wall")) return;
  const all = [...nav.querySelectorAll("button[data-tab]")].sort((a, b) => NAV_ORDER.indexOf(a.dataset.tab) - NAV_ORDER.indexOf(b.dataset.tab));
  all.forEach(b => nav.insertBefore(b, wrap));
  const shown = all.filter(b => !b.hidden).sort((a, b) => (+a.style.order || 0) - (+b.style.order || 0));
  let extra = [];
  wrap.hidden = true;
  if (PHONE.matches) extra = shown.length > 5 ? shown.slice(4) : [];
  else {
    const over = () => Math.max(...[...nav.children].filter(e => !e.hidden).map(e => e.getBoundingClientRect().right)) > nav.getBoundingClientRect().right + 1;
    if (over()){
      wrap.hidden = false;
      for (let i = shown.length - 1; i > 0 && over(); i--){ extra.unshift(shown[i]); menu.prepend(shown[i]); }
    }
  }
  extra.forEach(b => menu.appendChild(b));
  wrap.hidden = !extra.length;
  if (!extra.length) closeNavMenu();
  navMarks();
}
/* The More button is underlined when the open tab is inside it, and carries a dot when a tab inside has a count waiting. */
function navMarks(){
  const more = $("#tabMore"), menu = $("#tabMenu"); if (!more || !menu) return;
  const inMenu = [...menu.querySelectorAll("button[data-tab]")];
  more.classList.toggle("on", inMenu.some(b => b.getAttribute("aria-selected") === "true"));
  more.classList.toggle("dot", inMenu.some(b => /\(\d/.test(b.textContent)));
}
$("#tabMore").addEventListener("click", e => {
  e.stopPropagation();
  const m = $("#tabMenu"); m.hidden = !m.hidden;
  e.currentTarget.setAttribute("aria-expanded", String(!m.hidden));
  if (!m.hidden) m.querySelector('[aria-selected="true"]')?.focus() || m.querySelector("button")?.focus();
});
$("#tabMenu").addEventListener("click", e => { if (e.target.closest("button[data-tab]")) closeNavMenu(); });
document.addEventListener("click", e => { if (!e.target.closest(".tab-more")) closeNavMenu(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#tabMenu").hidden){ closeNavMenu(); $("#tabMore").focus(); } });
new MutationObserver(navMarks).observe($("#tabMenu"), { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["aria-selected"] });
PHONE.addEventListener?.("change", layoutNav);

/* Theme: follows the device until someone picks the other one on this device. */
const DARK = matchMedia("(prefers-color-scheme: dark)");
const isDark = () => (document.documentElement.dataset.theme || (DARK.matches ? "dark" : "light")) === "dark";
function applyTheme(){
  const t = lsGet("theme"), root = document.documentElement;
  if (t === "dark" || t === "light") root.dataset.theme = t; else delete root.dataset.theme;
  const b = $("#themeBtn"), dark = isDark();
  b.setAttribute("aria-pressed", String(dark));
  b.setAttribute("aria-label", dark ? "Light theme" : "Dark theme"); b.title = dark ? "Light theme" : "Dark theme";
}
$("#themeBtn").addEventListener("click", () => { const dark = !isDark(); lsSet("theme", dark === DARK.matches ? "" : dark ? "dark" : "light"); applyTheme(); });
DARK.addEventListener?.("change", applyTheme);
applyTheme();

/* Company logo: a small picture kept in Settings, shown in the header (and on nothing that prints). */
const LOGO_MAX = 90000;
const logoOf = v => typeof v === "string" && v.length <= LOGO_MAX && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(v) ? v : "";
function showLogo(){
  const el = $("#brandLogo"), src = logoOf(cfg.logo);
  el.classList.toggle("has-img", !!src);
  el.textContent = "";
  if (src){ const img = new Image(); img.alt = ""; img.src = src; el.appendChild(img); }
}
/* Reads an image file, scales it to at most 480 × 140 px and keeps it as PNG or WebP, whichever is smaller. */
async function readLogo(file){
  if (!file || !/^image\//.test(file.type)) throw new Error("Choose a PNG, JPEG or WebP picture.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("That file could not be read as a picture.")); i.src = url; });
    for (const box of [[480, 140], [360, 104], [240, 70]]){
      const k = Math.min(1, box[0] / img.naturalWidth, box[1] / img.naturalHeight);
      const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      const best = [c.toDataURL("image/png"), c.toDataURL("image/webp", .9)].filter(logoOf).sort((a, b) => a.length - b.length)[0];
      if (best) return best;
    }
    throw new Error("That picture is too detailed. Use a simpler logo file.");
  } finally { URL.revokeObjectURL(url); }
}
function logoHtml(){
  const src = logoOf(draft.logo);
  return `<h2 style="margin-top:12px">Company logo</h2>
    <div class="logo-row"><div class="logo-prev" id="logoPrev">${src ? `<img alt="Company logo" src="${src}">` : `<span class="small muted">No logo</span>`}</div>
      <label class="btn" style="cursor:pointer">Choose picture<input type="file" id="logoFile" accept="image/png,image/jpeg,image/webp" hidden></label>
      ${src ? `<button type="button" class="btn ghost danger" id="logoDel">Remove</button>` : ""}</div>`;
}
function bindLogo(v, dirty){
  const f = $("#logoFile", v), del = $("#logoDel", v);
  if (f) f.onchange = async () => { try { draft.logo = await readLogo(f.files[0]); dirty(); } catch (e){ toast(e.message); f.value = ""; } };
  if (del) del.onclick = () => { draft.logo = ""; dirty(); };
}

/* Time left on a step: working time for hands-on steps when the lab has shifts, clock time otherwise. */
const leftBy = (due, now, x) => x?.clock || !cfg.work ? due - now : workBetween(now, due);
const SOON = 2 * HOUR;
function cardTime(s){
  const stp = stage(s, s.stageKey), due = stageDue(s), now = Date.now(), st = status(s);
  if (awaiting(s)) return { cls: st.late || s.flag ? "t-soon" : "t-wait", left: st.late && due ? `${dur(overBy(due, now, stp || {}))} late` : "" };
  if (!due || !stp || stp.final) return { cls: "", left: "" };
  if (now > due) return { cls: "t-late", left: `${dur(overBy(due, now, stp))} late` };
  const left = leftBy(due, now, stp);
  return { cls: left <= SOON ? "t-soon" : "t-ok", left: `${dur(Math.max(left, 60000))} left` };
}

/* Wall screen: the board alone, large and kept fresh, for a screen in the lab. */
let wallTimer = 0;
function wallClock(){ const c = $("#wallClock"); if (c) c.textContent = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ() || undefined }).format(new Date()); }
function setWall(on){
  document.body.classList.toggle("wall", on);
  clearInterval(wallTimer);
  if (on){
    document.documentElement.requestFullscreen?.().catch(() => {});
    wallTimer = setInterval(() => { if (tab === "board") renderBoard(); else setWall(false); }, 30000);
  } else {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    layoutNav();
  }
  if (tab === "board") renderBoard();
}
document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement && document.body.classList.contains("wall")) setWall(false); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && document.body.classList.contains("wall")) setWall(false); });
setInterval(wallClock, 15000);
