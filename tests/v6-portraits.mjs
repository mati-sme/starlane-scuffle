// v6 stage B: champion select shows rendered portraits on every card + the detail panel; screenshots phone + desktop.
// Run: node tests/v6-portraits.mjs [outDir]  (needs playwright + chromium)
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const OUT = process.argv[2] ?? '/workspace/test-artifacts/starlane-scuffle/v6';
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



// All 24 card images + the detail portrait decoded from assets/portraits/.
const imgs = () => page.evaluate(() => [...document.querySelectorAll('.hcard .pic img, .dport img')].map((i) => ({ src: i.getAttribute('src'), w: i.naturalWidth })));
await page.goto(BASE + '?gfx=low', { waitUntil: 'load', timeout: 90000 });
await tap('play-btn'); await tap('mode-ranked'); await page.locator('[data-testid="setup-next"]').click({ force: true, timeout: 4000 }).catch(() => {});
await page.locator('[data-testid="champion-card-lumen"]').click({ force: true }); await page.locator('[data-testid="ban-btn"]').click({ force: true }); // v6 draft: ban first (lumen), then pick
await new Promise((r) => setTimeout(r, 300));
await page.waitForFunction(() => [...document.querySelectorAll('.hcard .pic img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 20000 }).catch(() => {});
await page.locator('[data-testid="champion-card-nyx"]').click({ force: true }); await sleep(600);
const list = await imgs();
await page.screenshot({ path: join(OUT, 'champ-select-portraits.png') });
const desk = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await desk.addInitScript(() => { try { localStorage.setItem("starlane.unlockAll", "true"); } catch {} }); // v8: every champion open for tests
const dp = await desk.newPage();
await dp.goto(BASE + '?gfx=low', { waitUntil: 'load', timeout: 90000 });
await dp.locator('[data-testid="play-btn"]').click({ force: true }); await dp.locator('[data-testid="mode-ranked"]').click({ force: true }); await dp.locator('[data-testid="setup-next"]').click({ force: true, timeout: 4000 }).catch(() => {});
await dp.waitForFunction(() => [...document.querySelectorAll('.hcard .pic img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 20000 });
await sleep(400);
await dp.screenshot({ path: join(OUT, 'champ-select-portraits-desktop.png') });

const bad = list.filter((i) => !i.w);
const ok = list.length === 25 && !bad.length && !errors.length;
console.log(JSON.stringify({ ok, images: list.length, bad, errors }, null, 1));
await browser.close();
server.close();
process.exit(ok ? 0 : 1);
