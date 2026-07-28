import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const failures = [];

const mainJs = await readFile(join(root, 'assets/js/main.js'), 'utf8');
const securityMigration = await readFile(
  join(root, 'supabase/migrations/20260728191912_harden_portal_access.sql'),
  'utf8'
);

const source = mainJs.match(/source:\s*'([^']+)'/)?.[1];
const allowedSource = securityMigration.match(/and source = '([^']+)'/)?.[1];
if (!source || source !== allowedSource) {
  failures.push(`Enquiry source mismatch: browser=${source || 'missing'}, RLS=${allowedSource || 'missing'}`);
}

const htmlFiles = [
  ...(await readdir(root)).filter((name) => name.endsWith('.html')).map((name) => join(root, name)),
  ...(await readdir(join(root, 'portal'))).filter((name) => name.endsWith('.html')).map((name) => join(root, 'portal', name))
];

for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  const references = [...html.matchAll(/\b(?:href|src)=["']([^"'#]+)(?:#[^"']*)?["']/gi)].map((match) => match[1]);
  for (const reference of references) {
    if (/^(?:https?:|mailto:|tel:|data:|javascript:)/i.test(reference)) continue;
    const clean = reference.split('?')[0];
    if (!clean) continue;
    const target = clean.startsWith('/') ? join(root, clean) : resolve(dirname(file), clean);
    const candidates = extname(target) ? [target] : [target, `${target}.html`, join(target, 'index.html')];
    let exists = false;
    for (const candidate of candidates) {
      try {
        await stat(candidate);
        exists = true;
        break;
      } catch {
        // Try the next static-route candidate.
      }
    }
    if (!exists) failures.push(`Broken local reference in ${file.slice(root.length + 1)}: ${reference}`);
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Production contracts passed (${htmlFiles.length} HTML pages checked).`);
}
