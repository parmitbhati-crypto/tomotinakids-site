import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const [calendar, styles] = await Promise.all([
  readFile(resolve(root, "assets/js/calendar.js"), "utf8"),
  readFile(resolve(root, "assets/css/portal.css"), "utf8"),
]);

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

expect(calendar.includes("ends_at, location, status"), "Calendar does not fetch session status.");
expect(calendar.includes('status === "completed"'), "Completed sessions are not classified.");
expect(calendar.includes('status === "cancelled"'), "Cancelled sessions are not classified.");
expect(calendar.includes("new Date(session.ends_at) < now"), "Overdue sessions are not classified by end time.");
for (const state of ["completed", "needs-update", "upcoming", "cancelled"]) {
  expect(styles.includes(`.cal-item.session-${state}`), `Calendar tile styling is missing for ${state}.`);
  expect(styles.includes(`.calendar-session-card.session-${state}`), `Day-detail styling is missing for ${state}.`);
}
expect(calendar.includes('label: "Completed"') && calendar.includes('label: "Update required"'), "Calendar status labels are missing.");
expect(calendar.includes('class="sr-only"'), "Calendar tiles do not provide a non-color status cue for assistive technology.");

console.log("Calendar session-status contracts passed.");
