/* ---------- v16: board lanes scroll once they hold more than five cards ---------- */
const LANE_CARDS = 5;
/* Where each lane was scrolled to, so a live update of the board does not jump back to the top. */
const laneScroll = () => new Map([...document.querySelectorAll("#view-board .lane")].map(l => [l.className, l.querySelector(".cards")?.scrollTop || 0]));
function fitLanes(scrolled){
  document.querySelectorAll("#view-board .lane").forEach(l => {
    const c = l.querySelector(".cards"); if (!c) return;
    const k = c.children, last = k[LANE_CARDS - 1];
    c.style.maxHeight = k.length > LANE_CARDS && last && last.offsetHeight ? `${last.offsetTop + last.offsetHeight + 28}px` : "";
    c.classList.toggle("scrolls", k.length > LANE_CARDS);
    if (scrolled?.get(l.className)) c.scrollTop = scrolled.get(l.className);
    const end = () => c.classList.toggle("at-end", c.scrollTop + c.clientHeight >= c.scrollHeight - 2);
    c.onscroll = end; end();
  });
}
let fitTimer = 0;
addEventListener("resize", () => { clearTimeout(fitTimer); fitTimer = setTimeout(() => { if (tab === "board") fitLanes(); }, 150); });
