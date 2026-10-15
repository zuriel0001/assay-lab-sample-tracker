// Lab working hours: the time arithmetic behind due times and expected finish, run outside the browser on the built page's own code.
// Run: node work-hours-unit.js
const fs = require("fs"), path = require("path");
const page = fs.readFileSync(path.resolve(__dirname, "../assay-lab-sample-tracker.html"), "utf8");
const cut = (from, to) => { const a = page.indexOf(from), b = page.indexOf(to, a); if (a < 0 || b < 0) throw new Error("not found: " + from); return page.slice(a, b); };
const check = (cond, msg) => { console.log(cond ? "  PASS" : "  FAIL", msg); if (!cond) process.exitCode = 1; };
const HOUR = 3600e3, tzOk = () => true, HEAD = [{ hours: 6 }, { hours: 1 }];
const cfg = { tz: "Africa/Accra", work: null };
const fns = {};
(() => eval(cut("const TZ = () =>", "function hoursLabel") + cut("const WEEKDAYS", "/* Settings: lab working hours") +
  "Object.assign(fns, { addWork, workStart, workBetween, workOf, dueFrom, overBy, weekHours, fromInput });"))();
const { addWork, workStart, workBetween, workOf, dueFrom, overBy, weekHours } = fns;
const U = s => Date.parse(s + "Z");           // Accra is UTC all year
const iso = t => new Date(t).toISOString().slice(0, 16);
const H = h => h * HOUR;

check(addWork(U("2026-10-16T14:00"), 5) === U("2026-10-16T19:00") && workBetween(U("2026-10-16T14:00"), U("2026-10-17T02:00")) === H(12), "round the clock: hours are clock hours");

cfg.work = workOf({ days: [1, 2, 3, 4, 5], shifts: [{ from: "07:00", to: "15:00" }], off: [] });
check(weekHours(cfg.work) === 40, "Monday to Friday, 07:00 to 15:00, is 40 working hours a week");
check(iso(addWork(U("2026-10-16T14:00"), 3)) === "2026-10-19T09:00", "Friday 14:00 plus 3 working hours is Monday 09:00");
check(iso(workStart(U("2026-10-17T10:00"))) === "2026-10-19T07:00" && iso(addWork(U("2026-10-17T10:00"), 1)) === "2026-10-19T08:00", "a step started on Saturday begins counting at Monday's shift start");
check(workBetween(U("2026-10-16T14:00"), U("2026-10-19T09:00")) === H(3), "working time from Friday 14:00 to Monday 09:00 is 3 hours");
check(addWork(U("2026-10-16T09:00"), 0) === U("2026-10-16T09:00"), "a step of 0 hours is due when it starts");
check(dueFrom(U("2026-10-16T14:00"), { hours: 8, clock: true }) === U("2026-10-16T22:00") && dueFrom(U("2026-10-16T14:00"), { hours: 8 }) === U("2026-10-19T14:00"), "a round-the-clock step (oven, leach) runs overnight; a hands-on step waits for the next shift");
check(overBy(U("2026-10-16T15:00"), U("2026-10-19T08:00"), {}) === H(1) && overBy(U("2026-10-16T15:00"), U("2026-10-19T08:00"), { clock: true }) === H(65), "how far past due counts working time, or clock time for a round-the-clock step");

cfg.work = workOf({ days: [1, 2, 3, 4, 5], shifts: [{ from: "07:00", to: "15:00" }], off: ["2026-10-19"] });
check(iso(addWork(U("2026-10-16T14:00"), 3)) === "2026-10-20T09:00", "a closed day (holiday) is skipped");

cfg.work = workOf({ days: [0, 1, 2, 3, 4, 5, 6], shifts: [{ from: "18:00", to: "06:00" }], off: [] });
check(iso(addWork(U("2026-10-16T05:00"), 2)) === "2026-10-16T19:00" && weekHours(cfg.work) === 84, "a night shift (18:00 to 06:00) runs past midnight");

cfg.work = workOf({ days: [0, 1, 2, 3, 4, 5, 6], shifts: [{ from: "06:00", to: "14:00" }, { from: "10:00", to: "18:00" }], off: [] });
check(iso(addWork(U("2026-10-16T06:00"), 12)) === "2026-10-16T18:00", "overlapping shifts are not counted twice");

cfg.tz = "Africa/Johannesburg";   // UTC+2
cfg.work = workOf({ days: [1, 2, 3, 4, 5], shifts: [{ from: "07:00", to: "15:00" }], off: [] });
check(iso(workStart(U("2026-10-16T02:00"))) === "2026-10-16T05:00" && iso(addWork(U("2026-10-16T12:00"), 2)) === "2026-10-19T06:00", "shift times are site times (Johannesburg, UTC+2)");
cfg.tz = "Africa/Accra";

const t0 = U("2026-10-16T07:00"), end = addWork(t0, 1763);
check(workBetween(t0, end) === H(1763) && end - t0 < 400 * 86400e3, `a 1,763-hour route ends after exactly 1,763 working hours (${iso(end)})`);
check(workOf({ days: [], shifts: [{ from: "07:00", to: "15:00" }] }) === null && workOf({ days: [1], shifts: [{ from: "07:00", to: "07:00" }] }) === null && workOf({ days: [1], shifts: [{ from: "7am", to: "15:00" }] }) === null, "a calendar with no working day or no valid shift falls back to round the clock");
