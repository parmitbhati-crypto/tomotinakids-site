import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFile(resolve(root, path), "utf8");
const [auth, login, client, shell, system, headers, config, migration, rollout, setupPage, challengePage, setupScript, challengeScript, passwordScript] = await Promise.all([
  "assets/js/auth.js", "assets/js/login.js", "assets/js/supabaseClient.js",
  "assets/js/portal-shell.js", "assets/js/system.js", "_headers",
  "supabase/config.toml", "supabase/migrations/20260728224440_enforce_active_accounts_and_admin_mfa.sql",
  "supabase/rollouts/enable_admin_mfa_after_enrollment.sql", "portal/mfa-setup.html",
  "portal/mfa-challenge.html", "assets/js/mfa-setup.js", "assets/js/mfa-challenge.js",
  "assets/js/set-password.js",
].map(read));
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

expect(config.includes("enable_signup = false"), "Public Supabase signup is not disabled in configuration.");
expect(config.includes("minimum_password_length = 10"), "Supabase password minimum is not 10 characters.");
expect(config.includes('password_requirements = "lower_upper_letters_digits_symbols"'), "Strong password character requirements are missing.");
expect(headers.includes("/portal/*") && headers.includes("X-Robots-Tag: noindex, nofollow"), "Portal crawler headers are missing.");
expect(headers.includes("X-Frame-Options: DENY") && headers.includes("X-Content-Type-Options: nosniff"), "Portal browser security headers are incomplete.");
expect(migration.includes("get_portal_access_state"), "Safe pre-MFA access-state function is missing.");
expect(migration.includes("active_portal_accounts_only") && migration.includes("as restrictive"), "Restrictive active-account RLS is missing.");
expect(migration.includes("'student-photos', 'teacher-photos'"), "Private storage is not protected by active-account enforcement.");
expect(rollout.includes("auth.jwt()->>'aal'") && rollout.includes("'aal2'"), "Post-enrollment AAL2 database enforcement is missing.");
expect(auth.includes("getAuthenticatorAssuranceLevel") && auth.includes("/portal/mfa-challenge.html"), "Portal guard does not enforce administrator MFA.");
expect(auth.includes('role === "admin" && isTeacherPage'), "Administrators are not redirected away from teacher-only pages.");
expect(login.includes("routeAdminAfterPassword") && login.includes("captchaToken"), "Login is missing MFA routing or CAPTCHA token support.");
expect(client.includes("mfa-setup|mfa-challenge"), "Standalone MFA pages are not excluded from the authenticated shell.");
expect(shell.includes("access?.portal_role || profile?.role || inferredRole"), "Portal shell does not prefer the authoritative portal role.");
expect(system.includes("const user = await requireAuth()") && !system.includes("profile?.role !== 'admin'"), "System Health still redirects profile-read failures to the teacher portal.");
expect(setupPage.includes('name="robots" content="noindex,nofollow,noarchive"'), "MFA setup page is indexable.");
expect(challengePage.includes('name="robots" content="noindex,nofollow,noarchive"'), "MFA challenge page is indexable.");
for (const [name, script] of [["setup", setupScript], ["challenge", challengeScript]]) {
  expect(script.includes("auth.mfa.challenge") && script.includes("auth.mfa.verify"), `MFA ${name} flow is incomplete.`);
  expect(!script.includes("auth.refreshSession"), `MFA ${name} must preserve the AAL2 session returned by verification.`);
}
expect(passwordScript.includes("/[a-z]/") && passwordScript.includes("/[A-Z]/") && passwordScript.includes("/[^A-Za-z0-9]/"), "Client password strength validation is incomplete.");

const portalFiles = (await readdir(resolve(root, "portal"))).filter((name) => name.endsWith(".html"));
expect(portalFiles.length >= 20, "Portal page inventory unexpectedly changed; review crawler coverage.");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Portal security contracts passed.");
}
