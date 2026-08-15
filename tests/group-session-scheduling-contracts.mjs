import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const scheduler = await readFile(resolve(root, "assets/js/admin.js"), "utf8");
const editor = await readFile(resolve(root, "assets/js/admin-session-edit.js"), "utf8");
const page = await readFile(resolve(root, "portal/admin.html"), "utf8");

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

for (const [name, source] of [["scheduler", scheduler], ["session editor", editor]]) {
  expect(source.includes('"group therapy"') && source.includes('"sports activity"'), `${name} does not recognize both group-capable programs.`);
  expect(source.includes("trim().toLowerCase()"), `${name} does not normalize program names.`);
  expect(source.includes("session_programs(programs(name))"), `${name} does not inspect programs on overlapping sessions.`);
  expect(source.includes("isGroupSessionProgramIds") && source.includes("isGroupSessionConflict"), `${name} does not require both sessions to be group-capable.`);
}

expect(scheduler.includes("conflict.student_id === studentId"), "Scheduler does not block an overlapping duplicate for the same student.");
expect(editor.includes("session.student_id === studentId"), "Session editor does not block an overlapping duplicate for the same student.");
expect(page.includes("may be scheduled for multiple students"), "Scheduler does not explain group-session behavior to admins.");

console.log("Group-session scheduling contracts passed.");
