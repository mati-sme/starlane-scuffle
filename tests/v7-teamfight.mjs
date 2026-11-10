// v7 stage C: 5v5 teamfight at mid with every skill off cooldown; screenshots the VFX read (projectiles, swings, impacts)
// and a HUD close-up with the player's portrait. Run: node tests/v7-teamfight.mjs [outDir] [gfx]  (needs playwright + chromium)
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const OUT = process.argv[2] ?? '/workspace/test-artifacts/starlane-scuffle/v7';
const GFX = process.argv[3] ?? 'high';
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
await ctx.addInitScript(() => { try { localStorage.setItem("starlane.unlockAll", "true"); } catch {} }); // v8: every champion open for tests
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(`console: ${m.text().slice(0, 300)}`); });
const tap = (id) => page.locator(`[data-testid="${id}"]`).click({ force: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const HERO = process.env.HERO ?? 'cinder';

await page.goto(BASE + `?gfx=${GFX}`, { waitUntil: 'load', timeout: 90000 });
await tap('play-btn'); await page.locator('[data-testid="setup-next"]').click({ force: true, timeout: 4000 }).catch(() => {}); await sleep(400);
await page.locator('[data-testid="champion-card-lumen"]').click({ force: true }); await tap('ban-btn'); await sleep(400); // v6 draft: ban first
await page.locator(`[data-testid="champion-card-${HERO}"]`).click({ force: true }); await sleep(200);
await tap('go-btn');
await page.waitForFunction(() => window.__starlane.state === 'match', null, { timeout: 30000 });
// Two lines of five facing off at mid; everyone maxed, cooldowns refreshed so the bots keep casting.
await page.evaluate(() => {
  const m = window.__starlane.match;
  m.heroes.forEach((h, i) => {
    h.ranks = [4, 4, 3]; h.recalc(true);
    h.x = (i < 5 ? -1 : 1) * 2.6 + (i % 2) * 0.6; h.z = (i % 5 - 2) * 1.8;
  });
  const p = m.hero; p.x = -2.6; p.z = 0; // player at the middle of the allied line so the camera frames the clash
  window.__calls = 0;
  new MutationObserver((ms) => { for (const r of ms) if (r.target.classList?.contains('callout') && r.target.classList.contains('go')) window.__calls++; })
    .observe(document.getElementById('bars'), { subtree: true, attributes: true, attributeFilter: ['class'] });
  window.__t = setInterval(() => { for (const h of m.heroes) { h.cds = [0, 0, 0]; h.hp = Math.max(h.hp, h.maxHp * 0.6); } }, 700);
  window.__p = setInterval(() => { const h = m.hero, foe = m.heroes.find((e) => e.team !== h.team && e.alive); if (foe) { const i = Math.floor(Math.random() * 3); h.cds[i] = 0; h._begin(i, m); } }, 650);
});
const shots = (process.env.SHOTS ?? '2600').split(',').map(Number);
let last = 0;
for (const [k, t] of shots.entries()) {
  await sleep(t - last); last = t;
  await page.screenshot({ path: join(OUT, k ? `teamfight-vfx-${k}.png` : 'teamfight-vfx.png'), timeout: 120000 });
}
await page.screenshot({ path: join(OUT, 'hud-portrait.png'), clip: { x: 0, y: 0, width: 400, height: 140 }, timeout: 120000 });
const fps = await page.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => (++n, performance.now() - t0 < 1000 ? requestAnimationFrame(f) : r(n)); requestAnimationFrame(f); }));
const face = await page.evaluate(() => document.querySelector('.portrait .face img')?.getAttribute('src'));
const calls = await page.evaluate(() => window.__calls);
console.log(`skill callouts shown: ${calls}`);
if (!calls) errors.push('no skill callouts');
await page.evaluate(() => { clearInterval(window.__t); clearInterval(window.__p); });
console.log(`hud face: ${face}  fps(swiftshader): ${fps}`);
if (!face?.includes(`portraits/${HERO}.png`)) errors.push('HUD portrait missing');
if (errors.length) { console.log('ERRORS\n' + errors.join('\n')); process.exitCode = 1; } else console.log('ok: teamfight shots + HUD portrait');
await browser.close();
server.close();
