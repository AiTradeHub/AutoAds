import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('index.html');
const publicHtml = read('public/index.html');
const projectScript = read('project-library.js');
const workerSource = read('worker.js');
const sw = read('sw.js');
const manifest = JSON.parse(read('manifest.webmanifest'));
const workerConfig = JSON.parse(read('wrangler.jsonc'));
const privacy = read('privacy.html');

assert.match(html, /<html lang="ro">/, 'App should declare Romanian as its language');
assert.match(html, /name="viewport"/, 'App should include a responsive viewport');
assert.ok(html.includes('id="projectLibraryCard"'), 'Saved projects UI should exist');
assert.ok(html.includes('id="saveProject"'), 'Save project control should exist');
assert.ok(html.includes('id="newProject"'), 'New project control should exist');
assert.ok(html.includes('id="scheduleCard"'), 'Local publication calendar should exist');
assert.ok(html.includes('id="addSchedule"'), 'Calendar add control should exist');
assert.ok(html.includes("fetch('/api/generate'"), 'UI should call the AI endpoint');
assert.match(html, /async function exportVideo\(file\)/, 'Video export should be implemented');
assert.doesNotMatch(html, /exportul video cu text imprimat permanent nu este implementat/i, 'UI must not claim video export is missing');
assert.match(projectScript, /indexedDB\.open\(DB_NAME/, 'Projects should persist using IndexedDB');
assert.match(projectScript, /media: files/, 'Project records should preserve selected media files');
assert.match(projectScript, /function loadProject/, 'Project restore behavior should exist');
assert.match(projectScript, /function deleteProject/, 'Project deletion behavior should exist');
assert.match(projectScript, /createObjectStore\('schedules'/, 'Calendar entries should persist in IndexedDB');
assert.match(projectScript, /function addSchedule/, 'Calendar scheduling behavior should exist');
assert.match(projectScript, /scheduledDate\.getTime\(\) <= Date\.now\(\)/, 'Past schedule times should be rejected');
assert.match(sw, /'\.\/project-library\.js'/, 'Offline shell should cache the project library script');
assert.ok(manifest.name && manifest.start_url, 'PWA manifest should include name and start URL');
assert.equal(workerConfig.main, 'worker.js', 'Cloudflare should deploy the API Worker');
assert.equal(workerConfig.assets.directory, './public', 'Only public assets should be deployed');
assert.equal(workerConfig.assets.binding, 'ASSETS', 'Static assets binding should exist');
assert.equal(workerConfig.ai.binding, 'AI', 'Workers AI binding should exist');
assert.match(workerSource, /env\.AI\.run/, 'Worker should call Cloudflare Workers AI');
assert.match(privacy, /Cloudflare Workers AI/, 'Privacy notice should disclose AI text processing');
assert.equal(publicHtml, html, 'Published index.html should match the tested source');
for (const file of ['index.html','project-library.js','sw.js','manifest.webmanifest','terms.html','privacy.html','icon-192.svg','icon-512.svg','tiktokWS5IdaJohJmjmm7oCQaX78Y5GO68RoYT.txt','tiktokgKaoRK3nbOcvNpsMsIx9ixQO9uP6xR4t.txt']) {
  assert.equal(read('public/' + file), read(file), 'Public copy must match source: ' + file);
}

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
assert.deepEqual(duplicates, [], 'HTML IDs must be unique');
const idSet = new Set(ids);
const missingIds = [];
for (const match of html.matchAll(/\$\('([^']+)'\)/g)) if (!idSet.has(match[1])) missingIds.push(match[1]);
for (const match of projectScript.matchAll(/\$\('([^']+)'\)/g)) if (!idSet.has(match[1])) missingIds.push(match[1]);
assert.deepEqual([...new Set(missingIds)], [], 'JavaScript must only reference IDs present in the HTML');

const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map((match) => match[1]).filter((script) => script.trim());
for (const [index, script] of inlineScripts.entries()) new vm.Script(script, { filename: 'index.inline-' + index + '.js' });
new vm.Script(projectScript, { filename: 'project-library.js' });
new vm.Script(sw, { filename: 'sw.js' });
new vm.Script(workerSource.replace(/^export default\s*/, 'const worker = '), { filename: 'worker.js' });

for (const source of [html, publicHtml]) {
  for (const match of source.matchAll(/<(?:script|link|img)\b[^>]*(?:src|href)="([^"]+)"/gi)) {
    const url = match[1];
    if (/^(?:https?:|data:|mailto:|#|javascript:)/i.test(url)) continue;
    const localPath = url.split(/[?#]/)[0].replace(/^\/+/, '');
    if (!localPath) continue;
    assert.ok(fs.existsSync(path.join(root, 'public', localPath)) || fs.existsSync(path.join(root, localPath)), 'Referenced local asset must exist: ' + url);
  }
}
for (const file of ['terms.html','privacy.html','project-library.js','sw.js','worker.js','public/index.html','public/terms.html','public/privacy.html','public/terms/index.html','public/privacy/index.html']) {
  if (file.includes('/terms/index') || file.includes('/privacy/index')) continue;
  assert.ok(fs.existsSync(path.join(root, file)), 'Required app file must exist: ' + file);
}

const { default: worker } = await import(pathToFileURL(path.join(root, 'worker.js')).href);
const health = await worker.fetch(new Request('https://autoads.test/api/health'), {});
assert.equal(health.status, 200, 'Health endpoint should respond');
assert.equal((await health.json()).ok, true, 'Health endpoint should report ok');
const wrongMethod = await worker.fetch(new Request('https://autoads.test/api/generate'), { AI: { run: async () => ({ response: '{}' }) } });
assert.equal(wrongMethod.status, 405, 'Generate endpoint should reject GET');
const badJson = await worker.fetch(new Request('https://autoads.test/api/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' }), { AI: { run: async () => ({ response: '{}' }) } });
assert.equal(badJson.status, 400, 'Generate endpoint should reject invalid JSON');
const missingFields = await worker.fetch(new Request('https://autoads.test/api/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ business: '', product: '' }) }), { AI: { run: async () => ({ response: '{}' }) } });
assert.equal(missingFields.status, 400, 'Generate endpoint should require business and product');
const aiMock = { run: async (model, args) => ({ response: JSON.stringify({ title: 'Reclamă de test', caption: 'Text de test pentru o afacere locală. #Test' }) }) };
const generated = await worker.fetch(new Request('https://autoads.test/api/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ business: 'Atelier', product: 'Lumânări', details: 'Ceară naturală', tone: 'friendly', goal: 'messages' }) }), { AI: aiMock });
assert.equal(generated.status, 200, 'Generate endpoint should return AI copy');
const generatedBody = await generated.json();
assert.equal(generatedBody.title, 'Reclamă de test', 'AI title should be returned');
assert.equal(generatedBody.source, 'cloudflare-ai', 'Response should identify AI source');
const staticResponse = await worker.fetch(new Request('https://autoads.test/'), { ASSETS: { fetch: async () => new Response('static asset') } });
assert.equal(await staticResponse.text(), 'static asset', 'Non-API requests should be served from ASSETS');

console.log('AutoAds tests passed: source syntax, HTML IDs, asset isolation/mirrors, PWA config, AI endpoint validation, mock AI response, and static asset routing.');
