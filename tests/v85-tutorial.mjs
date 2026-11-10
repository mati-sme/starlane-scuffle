// v8.5: tutorial. Pure step logic + browser flow (auto on first launch w/ ?tutorial=1, skip, replay, finish -> badge). Run: node tests/v85-tutorial.mjs
import assert from 'node:assert/strict';
import { advance, STEPS } from '../js/ui/tutorial.js';
assert.equal(advance(0, { moved: 1 }), 0); assert.equal(advance(0, { moved: 9 }), 1);
assert.equal(advance(1, { attacked: true }), 2); assert.equal(advance(2, { cast: false }), 2); assert.equal(advance(2, { cast: true }), 3); assert.equal(advance(3, { moved: 99, attacked: true, cast: true }), 3);
assert.equal(STEPS.length, 4);
console.log('PASS pure tutorial steps');

import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const require = createRequire(import.meta.url);
let pw;
for (const p of [undefined, process.env.PLAYWRIGHT_DIR, '/tmp/pw/node_modules']) { try { pw = require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); break; } catch {} }
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = join(ROOT, path);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;
const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
const tid = (id) => page.locator(`[data-testid="${id}"]`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const check = (n, ok, x = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'} ${n} ${x}`); };
const step = () => page.evaluate(() => document.getElementById('tutorial')?.dataset.step ?? null);

await page.goto(BASE + '?gfx=low&tutorial=1', { waitUntil: 'load', timeout: 90000 });
await tid('tutorial-root').waitFor({ timeout: 10000 });
check('tutorial starts by itself on first launch (match is live)', await page.evaluate(() => window.__starlane.state) === 'match');
check('skip button visible', await tid('tutorial-skip').isVisible());
check('1v1 practice (2 heroes)', await page.evaluate(() => window.__starlane.match.heroes.length) === 2);
await tid('tutorial-skip').click();
await tid('play-btn').waitFor({ timeout: 5000 });
check('skip returns to title and is remembered', await page.evaluate(() => localStorage.getItem('starlane.tutorialSeen')) === 'true');
await page.reload({ waitUntil: 'load' });
await sleep(1500);
check('does not auto-start again', (await tid('tutorial-root').count()) === 0);
await tid('tutorial-start').click();
await tid('tutorial-root').waitFor({ timeout: 5000 });
check('replay from title works', (await step()) === 'move');
const to = (st) => page.waitForFunction((x) => document.getElementById('tutorial')?.dataset.step === x, st, { timeout: 25000 }).catch(() => {});
await page.keyboard.down('d'); await to('attack'); await page.keyboard.up('d');
check('moving advances to attack step', (await step()) === 'attack', String(await step()));
await page.keyboard.down('Space'); await to('skill'); await page.keyboard.up('Space');
check('attacking advances to skill step', (await step()) === 'skill', String(await step()));
await page.keyboard.press('1'); await sleep(300); await page.keyboard.press('q'); await to('goal');
check('using a skill reaches the goal step', (await step()) === 'goal', String(await step()));
await tid('tutorial-finish').click();
await tid('play-btn').waitFor({ timeout: 5000 });
await tid('profile-btn').click(); await tid('profile-root').waitFor();
check('finish earns the Graduate badge', (await tid('badge-tutorial').getAttribute('data-earned')) === 'true');
check('no page errors', errors.length === 0, errors.join('; '));
await browser.close(); server.close();
console.log(failed ? `${failed} FAILED` : 'ALL PASS'); process.exit(failed ? 1 : 0);
