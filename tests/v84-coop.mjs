// v8.4: 2v2 co-op starts from the title: size [2,2], 4 heroes, unique picks, bots (incl. the lone ally) move. Run: node tests/v84-coop.mjs
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const require = createRequire(import.meta.url);
let pw;
for (const p of [undefined, process.env.PLAYWRIGHT_DIR, '/tmp/pw/node_modules']) { try { pw = require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); break; } catch {} }
const { chromium, devices } = pw;
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
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ ...devices['iPhone 12 landscape'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const tid = (id) => page.locator(`[data-testid="${id}"]`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const check = (n, ok, x = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'} ${n} ${x}`); };
await page.goto(BASE + '?gfx=low', { waitUntil: 'load', timeout: 90000 });
if (process.env.TSHOT) await page.screenshot({ path: process.env.TSHOT });
await tid('coop-btn').click({ force: true });
await tid('setup-next').waitFor({ timeout: 5000 });
check('setup shows 2 v 2', (await tid('setup-summary').textContent()).includes('2 v 2'));
check('size counts are 2 and 2', (await tid('size-count-0').textContent()) === '2' && (await tid('size-count-1').textContent()) === '2');
check('2v2 preset button is on', (await tid('preset-2v2').getAttribute('aria-pressed')) === 'true');
await tid('preset-hard').click({ force: true }); // difficulty still applies
check('difficulty preset still works', (await tid('preset-hard').getAttribute('aria-pressed')) === 'true');
await tid('setup-next').click({ force: true });
await tid('champion-card-lumen').click({ force: true }); await tid('ban-btn').click({ force: true }); await sleep(400);
await tid('champion-card-bulwark').click({ force: true }); await tid('go-btn').click({ force: true });
await page.waitForFunction(() => window.__starlane.state === 'match', null, { timeout: 20000 });
await sleep(500);
const before = await page.evaluate(() => window.__starlane.match.heroes.map((h) => ({ id: h.id, team: h.team, bot: !!h.brain, x: h.x, z: h.z })));
check('4 heroes, 2 per side', before.length === 4 && before.filter((h) => h.team === 0).length === 2, JSON.stringify(before.map((h) => h.id + h.team)));
check('unique champions', new Set(before.map((h) => h.id)).size === 4);
check('3 bots + me, banned lumen absent', before.filter((h) => h.bot).length === 3 && !before.some((h) => h.id === 'lumen'));
await sleep(9000);
const after = await page.evaluate(() => window.__starlane.match.heroes.map((h) => ({ x: h.x, z: h.z })));
const moved = before.map((h, i) => Math.hypot(h.x - after[i].x, h.z - after[i].z));
check('every bot (incl. lone ally) moves', before.every((h, i) => !h.bot || moved[i] > 1.5), moved.map((m) => m.toFixed(1)).join(','));
await page.evaluate(() => { const m = window.__starlane.match; m._end(m.myTeam === 0, 'core'); });
await tid('rewards').waitFor({ timeout: 6000 });
check('2v2 win badge earned', (await tid('badge-new').allTextContents()).some((t) => t.includes('Buddy')));
check('no page errors', errors.length === 0, errors.join('; '));
await browser.close(); server.close();
console.log(failed ? `${failed} FAILED` : 'ALL PASS'); process.exit(failed ? 1 : 0);
