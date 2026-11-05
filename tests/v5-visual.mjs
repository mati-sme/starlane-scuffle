// v5 stage C visual check: mid-map skirmish by the river (after.png) and a skill wind-up close-up (cast.png).
// Run: node tests/v5-visual.mjs [outDir] [championIndex]  (needs playwright + chromium)
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const OUT = process.argv[2] ?? '/workspace/test-artifacts/starlane-scuffle/v5';
const PICK = Number(process.argv[3] ?? 0);
mkdirSync(OUT, { recursive: true });

const require = createRequire(import.meta.url);
let pw;
for (const p of [undefined, process.env.PLAYWRIGHT_DIR, '/tmp/pw/node_modules']) {
  try { pw = require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); break; } catch {}
}
if (!pw) throw new Error('playwright not found; set PLAYWRIGHT_DIR to a node_modules containing it');
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

const browser = await chromium.launch(process.env.DEFAULT_GL ? {} : { args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ ...devices['iPhone 12 landscape'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/favicon/.test(m.text())) errors.push(`console ${m.type()}: ${m.text().slice(0, 400)}`); });
const tap = (id) => page.locator(`[data-testid="${id}"]`).click({ force: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await page.goto(BASE + (process.env.GFX ? `?gfx=${process.env.GFX}` : ''), { waitUntil: 'load', timeout: 90000 });
await tap('play-btn');
await sleep(400);
const cards = page.locator('[data-testid^="champion-card-"]');
await cards.nth(PICK).click({ force: true });
await sleep(300);
await tap('go-btn');
await page.waitForFunction(() => window.__starlane.state === 'match', null, { timeout: 20000 });
const S = (fn, arg) => page.evaluate(fn, arg);
// Stage a skirmish at the river crossing: player + allies on the west bank, enemies across the water, everyone ranked up.
await S(() => {
  const m = window.__starlane.match;
  m.heroes.forEach((h, i) => {
    const ally = h.team === 0, k = ally ? m.heroes.filter((q) => q.team === 0).indexOf(h) : m.heroes.filter((q) => q.team === 1).indexOf(h);
    h.x = h.px = (ally ? -7 : 2.5) + (k % 2) * (ally ? -2 : 2); h.z = h.pz = 7 + k * 2.2 - 4;
    h.ranks = [2, 2, 1]; h.recalc(true);
    h.face = ally ? Math.PI / 2 : -Math.PI / 2;
  });
  m.minions.spawnWave?.(0, 0, ['blobling', 'blobling', 'zapper']);
});
await sleep(2500);
for (const k of ['KeyE', 'KeyQ', 'KeyR']) { await page.keyboard.press(k); await sleep(350); }
await page.screenshot({ path: join(OUT, 'after.png') });
// Close-up of a held wind-up: dolly in, freeze the charge so the raised arms + charge orb are visible.
await S(() => {
  const m = window.__starlane.match, r = m.rig, orig = r.update.bind(r);
  r.update = (dt, a) => { orig(dt, a); r.camera.position.lerp(r.look, 0.55); };
  m.hero.cds.fill(0);
});
await page.keyboard.press('KeyE');
await S(() => { window.__starlane.match.hero.windup = 4; });
await sleep(1500);
await page.screenshot({ path: join(OUT, 'skill-cast.png') });
console.log('shots in', OUT);
if (errors.length) console.log(errors.join('\n'));
await browser.close();
server.close();
