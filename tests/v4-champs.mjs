// v4 stage B: champion-select screenshot (all 24) + per-champion ability smoke test + one abilities-firing shot.
// Run: node tests/v4-champs.mjs [outDir]  (needs playwright + chromium)
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const OUT = process.argv[2] ?? '/workspace/test-artifacts/starlane-scuffle/v4';
mkdirSync(OUT, { recursive: true });
const require = createRequire(import.meta.url);
let pw;
for (const p of [undefined, process.env.PLAYWRIGHT_DIR, '/tmp/pw/node_modules']) {
  try { pw = require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); break; } catch {}
}
if (!pw) throw new Error('playwright not found; set PLAYWRIGHT_DIR');
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
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(`console: ${m.text().slice(0, 300)}`); });
const tap = (id) => page.locator(`[data-testid="${id}"]`).click({ force: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await page.goto(BASE + '?gfx=low', { waitUntil: 'load', timeout: 90000 });
await tap('play-btn');
await sleep(500);
const ids = await page.$$eval('[data-testid^="champion-card-"]', (els) => els.map((e) => e.dataset.id));
console.log(`cards: ${ids.length}`);
if (ids.length !== 24) errors.push(`expected 24 cards, got ${ids.length}`);
await page.screenshot({ path: join(OUT, 'champ-select.png') });

// Fire every skill of the picked champion (maxed) next to an enemy hero; report thrown errors / dead casts.
async function fire(id, shot) {
  await page.goto(BASE + `?gfx=low&hero=${id}`, { waitUntil: 'load', timeout: 90000 });
  await tap('play-btn'); await sleep(300);
  await page.locator(`[data-testid="champion-card-${id}"]`).click({ force: true }); await sleep(200);
  await tap('go-btn');
  await page.waitForFunction(() => window.__starlane.state === 'match', null, { timeout: 20000 });
  await page.evaluate(() => {
    const m = window.__starlane.match, h = m.hero, foe = m.heroes.find((e) => e.team !== h.team);
    h.ranks = [4, 4, 3]; h.recalc(true);
    foe.x = h.x + 4; foe.z = h.z + 1;
    window.__t = setInterval(() => { foe.hp = foe.maxHp; foe.x = h.x + 4; foe.z = h.z + 1; foe.stun = 0; }, 100);
  });
  for (let i = 0; i < 3; i++) {
    await page.evaluate((i) => { const m = window.__starlane.match, h = m.hero; h.cds[i] = 0; h._begin(i, m); }, i);
    await sleep(shot && i === 1 ? 450 : 700);
    if (shot && i === 1) await page.screenshot({ path: join(OUT, 'abilities-firing.png') });
  }
  await page.evaluate(() => clearInterval(window.__t));
}
for (const id of ids) await fire(id, id === process.env.SHOT_HERO || (!process.env.SHOT_HERO && id === 'rime'));
if (errors.length) { console.log('ERRORS\n' + errors.join('\n')); process.exitCode = 1; } else console.log('ok: all 24 champions fired Q/E/R without errors');
await browser.close();
server.close();
