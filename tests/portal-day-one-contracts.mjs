import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const paths = {
  shell: "assets/js/portal-shell.js",
  schedulerPage: "portal/admin.html",
  scheduler: "assets/js/admin.js",
  teamPage: "portal/team.html",
  team: "assets/js/team.js",
  teamForm: "portal/team-new.html",
  teamFormScript: "assets/js/team-new.js",
  attendance: "portal/teacher-attendance.html",
  enquiries: "portal/enquiries.html",
  styles: "assets/css/portal.css",
};
const files = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, path]) => [
  key, await readFile(resolve(root, path), "utf8"),
])));
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

expect(files.shell.includes("portal-duplicate-title"), "Shared shell does not suppress duplicate page headings.");
expect(!files.schedulerPage.includes("Ctrl") && !files.schedulerPage.includes("Cmd"), "Scheduler still requires keyboard-modifier multi-selection.");
expect(files.schedulerPage.includes('id="programChoices"'), "Scheduler program choices are missing.");
expect(files.scheduler.includes('#programChoices input:checked'), "Scheduler does not read touch-friendly program choices.");
expect(files.teamPage.includes('value="needs_attention"'), "Team readiness filter is missing.");
expect(files.team.includes("function readiness"), "Team profile completeness checks are missing.");
expect(files.team.includes("program assignment"), "Missing program assignments are not surfaced.");
expect(files.teamForm.includes('id="programChoices"'), "Teacher form still lacks touch-friendly program choices.");
expect(files.teamFormScript.includes('programChoices.addEventListener("change"'), "Teacher program choices do not sync to form data.");
expect(files.attendance.includes('window.confirm("Mark every listed teacher as Present?'), "Bulk attendance action lacks confirmation.");
expect(files.attendance.includes('beforeunload'), "Attendance page does not warn about unsaved changes.");
expect(files.attendance.includes("Discard unsaved attendance changes"), "Changing attendance dates can discard unsaved work without confirmation.");
expect(!files.enquiries.includes('id="btnLogout"'), "Legacy Enquiries logout card is still visible.");
expect(files.styles.includes(".portal-workspace,.portal-content"), "Portal overflow containment is missing.");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Portal Day One contracts passed.");
}
