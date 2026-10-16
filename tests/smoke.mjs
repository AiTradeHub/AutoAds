import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('index.html');
const projectScript = read('project-library.js');
const sw = read('sw.js');
const manifest = JSON.parse(read('manifest.webmanifest'));

assert.match(html, /<html lang="ro">/, 'App should declare Romanian as its language');
assert.match(html, /name="viewport"/, 'App should include a responsive viewport');
assert.ok(html.includes('id="projectLibraryCard"'), 'Saved projects UI should exist');
assert.ok(html.includes('id="saveProject"'), 'Save project control should exist');
assert.ok(html.includes('id="newProject"'), 'New project control should exist');
assert.ok(html.includes('id="scheduleCard"'), 'Local publication calendar should exist');
assert.ok(html.includes('id="addSchedule"'), 'Calendar add control should exist');
assert.match(projectScript, /indexedDB\.open\(DB_NAME/, 'Projects should persist using IndexedDB');
assert.match(projectScript, /media: files/, 'Project records should preserve selected media files');
assert.match(projectScript, /function loadProject/, 'Project restore behavior should exist');
assert.match(projectScript, /function deleteProject/, 'Project deletion behavior should exist');
assert.match(projectScript, /createObjectStore\('schedules'/, 'Calendar entries should persist in IndexedDB');
assert.match(projectScript, /function addSchedule/, 'Calendar scheduling behavior should exist');
assert.match(projectScript, /scheduledDate\.getTime\(\) <= Date\.now\(\)/, 'Past schedule times should be rejected');
assert.match(sw, /'\.\/project-library\.js'/, 'Offline shell should cache the project library script');
assert.ok(manifest.name && manifest.start_url, 'PWA manifest should include name and start URL');

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
assert.deepEqual(duplicates, [], 'HTML IDs must be unique');
const idSet = new Set(ids);
const missingIds = [];
for (const match of html.matchAll(/\$\('([^']+)'\)/g)) {
  if (!idSet.has(match[1])) missingIds.push(match[1]);
}
for (const match of projectScript.matchAll(/\$\('([^']+)'\)/g)) {
  if (!idSet.has(match[1])) missingIds.push(match[1]);
}
assert.deepEqual([...new Set(missingIds)], [], 'JavaScript must only reference IDs present in the HTML');

const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map((match) => match[1])
  .filter((script) => script.trim());
for (const [index, script] of inlineScripts.entries()) {
  new vm.Script(script, { filename: 'index.inline-' + index + '.js' });
}
new vm.Script(projectScript, { filename: 'project-library.js' });
new vm.Script(sw, { filename: 'sw.js' });

for (const match of html.matchAll(/<(?:script|link|img)\b[^>]*(?:src|href)="([^"]+)"/gi)) {
  const url = match[1];
  if (/^(?:https?:|data:|mailto:|#|javascript:)/i.test(url)) continue;
  const localPath = url.split(/[?#]/)[0].replace(/^\/+/, '');
  if (!localPath) continue;
  assert.ok(fs.existsSync(path.join(root, localPath)), 'Referenced local asset must exist: ' + url);
}
for (const file of ['terms.html', 'privacy.html', 'project-library.js', 'sw.js']) {
  assert.ok(fs.existsSync(path.join(root, file)), 'Required app file must exist: ' + file);
}

console.log('AutoAds smoke checks passed: markup, unique IDs, local references, PWA manifest, service worker, and JavaScript syntax.');
