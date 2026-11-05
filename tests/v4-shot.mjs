// v4 visual check: boots offline single-player on a phone-landscape viewport and screenshots gameplay.
// Run: node tests/v4-shot.mjs [out.png] [championIndex]  (needs playwright + chromium)
// Env: GFX=high|low forces the graphics tier, WALK="KeyD:7000,Space:2000" holds keys, CLOSE=0.6 dollies in, WAIT=ms.
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const OUT = process.argv[2] ?? '/workspace/test-artifacts/starlane-scuffle/v4/stage-a-gameplay.png';
const PICK = Number(process.argv[3] ?? 0);
mkdirSync(dirname(OUT), { recursive: true });

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
await page.locator('[data-testid="champion-card-lumen"]').click({ force: true }); await page.locator('[data-testid="ban-btn"]').click({ force: true }); // v6 draft: ban first (lumen), then pick
await new Promise((r) => setTimeout(r, 300));
await sleep(400);
const cards = page.locator('[data-testid^="champion-card-"]');
await cards.nth(PICK).click({ force: true });
await sleep(300);
await tap('go-btn');
await page.waitForFunction(() => window.__starlane.state === 'match', null, { timeout: 20000 });
if (process.env.CLOSE) await page.evaluate((k) => { // dolly toward the focus for a model close-up (debug only)
  const r = window.__starlane.match.rig, orig = r.update.bind(r);
  r.update = (dt, a) => { orig(dt, a); r.camera.position.lerp(r.look, k); };
}, Number(process.env.CLOSE));
// Walk up the mid lane toward the first minion clash, then fight for a bit (screen-relative WASD).
for (const [key, ms] of (process.env.WALK ?? '').split(',').filter(Boolean).map((w) => w.split(':'))) {
  await page.keyboard.down(key); await sleep(Number(ms)); await page.keyboard.up(key);
}
await sleep(Number(process.env.WAIT ?? 9000));
const lost = await page.evaluate(() => { const c = document.querySelector('canvas'); const gl = c.getContext('webgl2') || c.getContext('webgl'); return gl?.isContextLost?.(); });
if (lost) errors.push('WebGL context lost');
await page.screenshot({ path: OUT });
const fps = await page.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => (++n < 60 ? requestAnimationFrame(f) : r(60000 / (performance.now() - t0))); requestAnimationFrame(f); }));
console.log(`shot ${OUT}  fps~${fps.toFixed(1)} (software GL)`);
if (errors.length) console.log(errors.join('\n'));
await browser.close();
server.close();
