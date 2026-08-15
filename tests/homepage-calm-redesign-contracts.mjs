import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const [page, styles, script] = await Promise.all([
  readFile(resolve(root, "index.html"), "utf8"),
  readFile(resolve(root, "assets/css/style.css"), "utf8"),
  readFile(resolve(root, "assets/js/main.js"), "utf8"),
]);

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

expect(page.includes('class="home-calm"'), "Homepage does not activate the calm design theme.");
expect((page.match(/<section\b/g) || []).length <= 9, "Homepage has returned to an overly long section count.");
for (const component of ["calm-hero", "calm-program-bento", "calm-story-grid", "calm-journey", "calm-gallery", "calm-voices", "calm-enquiry-shell"]) {
  expect(page.includes(component), `Homepage is missing ${component}.`);
}
expect(page.includes('data-enquiry-form') && page.includes('name="consent"'), "Homepage enquiry form contract is incomplete.");
expect(page.includes("supabaseClient.js"), "Homepage enquiry form does not initialize its public Supabase client.");
expect(styles.includes("@media(prefers-reduced-motion:reduce)"), "Homepage animation does not respect reduced motion.");
expect(styles.includes("calmBreathe") && styles.includes("calmDriftOne"), "Calm ambient animation is missing.");
expect(script.includes(".calm-reveal"), "Homepage sections are not connected to scroll reveal behavior.");
expect(!page.includes("Quick answers for parents"), "Detailed FAQ should remain off the simplified homepage.");

console.log("Calm homepage redesign contracts passed.");
