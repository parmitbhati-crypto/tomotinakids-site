import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const [shell, auth, page, script, migration] = await Promise.all([
  "assets/js/portal-shell.js",
  "assets/js/auth.js",
  "portal/my-profile.html",
  "assets/js/my-profile.js",
  "supabase/migrations/20260728214853_teacher_self_service_profile.sql",
].map((path) => readFile(resolve(root, path), "utf8")));
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

expect(!shell.includes("/portal/week.html"), "Teacher navigation still exposes the Week page.");
expect(shell.includes('class="portal-profile-link" href="/portal/my-profile.html"'), "Teacher account dropdown is missing My Profile.");
expect(!shell.includes("['My Profile', '/portal/my-profile.html'"), "My Profile should not remain in the teacher sidebar.");
expect(auth.includes('"/portal/my-profile.html"'), "My Profile is not protected as a teacher page.");
expect(page.includes('id="photoInput"') && page.includes('accept="image/jpeg,image/png,image/webp"'), "Photo upload field is missing or accepts unsafe formats.");
expect(page.includes('id="editPhoto"') && page.includes('id="photoDialog"'), "Social-style photo editor modal is missing.");
expect(script.includes("file.size > 5 * 1024 * 1024"), "Client-side 5 MB photo limit is missing.");
expect(script.includes('.update({ photo_path: newPath })'), "Photo upload does not update the shared teacher profile.");
expect(script.includes(".remove([oldPath])"), "Replaced photos are not cleaned up.");
expect(migration.includes("guard_teacher_profile_self_update"), "Database field-level update guard is missing.");
expect(migration.includes("teacher_photos_teacher_insert_own"), "Teacher photo upload policy is missing.");
expect(migration.includes("teacher_photos_teacher_delete_own"), "Teacher photo cleanup policy is missing.");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Teacher profile contracts passed.");
}
