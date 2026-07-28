import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const files = Object.fromEntries(await Promise.all([
  "invite", "directory", "newPage", "auth", "scheduler", "attendance", "history", "migration", "config",
].map(async (name, index) => {
  const paths = [
    "supabase/functions/invite-teacher/index.ts", "assets/js/team.js", "assets/js/team-new.js",
    "assets/js/auth.js", "assets/js/admin.js", "portal/teacher-attendance.html",
    "portal/teacher-attendance-history.html", "supabase/migrations/20260728210417_teacher_onboarding.sql",
    "supabase/config.toml",
  ];
  return [name, await readFile(resolve(root, paths[index]), "utf8")];
})));
const failures = [];
const requireText = (file, text, message) => { if (!files[file].includes(text)) failures.push(message); };

requireText("invite", "inviteUserByEmail", "Teacher invitations do not use Supabase Auth email invitations.");
requireText("invite", 'caller?.role !== "admin"', "Invitation function does not verify the caller is an admin.");
requireText("config", "[functions.invite-teacher]", "Invitation function JWT configuration is missing.");
requireText("config", "verify_jwt = true", "Invitation function must require a user JWT.");
requireText("migration", "alter table public.teacher_profiles enable row level security", "Teacher details table lacks RLS.");
requireText("migration", "'teacher-photos'", "Private teacher photo storage is missing.");
requireText("migration", "aadhaar_last4", "Aadhaar must be stored only as a last-four reference.");
if (!files.auth.includes("profile.is_active === false") && !files.auth.includes("access.account_is_active === false")) {
  failures.push("Inactive staff are not blocked from portal access.");
}
for (const file of ["scheduler", "attendance", "history"]) {
  requireText(file, '.eq("is_active", true)', `${file} does not filter inactive teachers.`);
}
requireText("newPage", 'rpc("replace_teacher_programs"', "Editing program assignments is not transactional.");
requireText("directory", 'data-action="toggle"', "Team Directory cannot deactivate/reactivate teachers.");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Teacher onboarding contracts passed.");
}
