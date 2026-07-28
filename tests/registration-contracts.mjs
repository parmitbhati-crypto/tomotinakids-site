import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const registrationNew = await readFile(resolve(root, 'portal/registration-new.html'), 'utf8');
const registrationDetails = await readFile(resolve(root, 'portal/registration-details.html'), 'utf8');
const registrations = await readFile(resolve(root, 'portal/registrations.html'), 'utf8');
const scheduler = await readFile(resolve(root, 'assets/js/admin.js'), 'utf8');
const failures = [];

if (!registrationNew.includes('"Age": parsedAge(age)')) {
  failures.push('New registration does not persist age to students.Age.');
}
if (!registrationDetails.includes('"Age": parsedAge(normalized.child_profile.age)')) {
  failures.push('Registration edits do not synchronize students.Age.');
}
if (!registrationDetails.includes('.remove([previousPhotoUrl])')) {
  failures.push('Photo replacement does not remove the previous Storage object.');
}
if (!registrationDetails.includes('new Date(year, month - 1, day).toLocaleDateString()')) {
  failures.push('Registration details do not format date-only values in local time.');
}
if (!registrations.includes('new Date(year, month - 1, day).toLocaleDateString()')) {
  failures.push('Registration list does not format date-only values in local time.');
}
if (!scheduler.match(/from\(["']students["']\)[\s\S]*?\.eq\(["']is_active["'], true\)[\s\S]*?\.order\(["']full_name["']\)/)) {
  failures.push('Scheduler student picklist is not restricted to active registrations.');
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Registration contracts passed.');
}
