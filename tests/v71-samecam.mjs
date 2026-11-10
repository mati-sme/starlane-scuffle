// v7.1 same-camera shot: loads an offline match, pins the camera to a fixed overview of the Sunny base (Nexus, guardians,
// mid inhibitor / inner / outer towers and the top lane), waits a few frames, screenshots, and logs frame times + renderer info.
// Run: node tests/v71-samecam.mjs <out.png> [gfx=high|low] [gameplay.png]  (needs playwright + chromium)
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const OUT = process.argv[2] ?? '/workspace/test-artifacts/starlane-scuffle/v7.1/shot.png';
const GFX = process.argv[3] ?? 'high';
const PLAY = process.argv[4];
mkdirSync(dirname(OUT), { recursive: true });

const require = createRequire(import.meta.url);
let pw;
for (const p of [undefined, process.env.PLAYWRIGHT_DIR, '/tmp/pw/node_modules']) {
  try { pw = require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); break; } catch {}
}
if (!pw) throw new Error('playwright not found; set PLAYWRIGHT_DIR to a node_modules containing it');
const { chromium } = pw;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' };
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
const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tap = (page, id) => page.locator(`[data-testid="${id}"]`).click({ force: true });

const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });

await ctx.addInitScript(() => { try { localStorage.setItem("starlane.unlockAll", "true"); } catch {} }); // v8: every champion open for tests
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|WebSocket|ERR_/.test(m.text())) errors.push(`console: ${m.text().slice(0, 300)}`); });

await page.goto(BASE + `?gfx=${GFX}`, { waitUntil: 'load', timeout: 90000 });
await tap(page, 'play-btn'); await tap(page, 'mode-ranked'); await page.locator('[data-testid="setup-next"]').click({ force: true, timeout: 4000 }).catch(() => {});
await page.locator('[data-testid="draft-title"]').waitFor();
const ids = await page.evaluate(() => [...document.querySelectorAll('[data-testid^="champion-card-"]')].map((e) => e.dataset.id));
await page.locator(`[data-testid="champion-card-${ids[0]}"]`).click({ force: true });
await tap(page, 'ban-btn');
await page.locator('[data-testid="spell-pick"]').waitFor();
await page.evaluate((id) => document.querySelector(`[data-testid="champion-card-${id}"]:not(:disabled)`)?.click(), ids[1]);
await tap(page, 'go-btn');
await page.waitForFunction(() => window.__starlane.state === 'match', null, { timeout: 20000 });
// Software GL runs at ~1 fps: freeze the adaptive scaler so the shot shows the tier's full pipeline (shadows, post) at 1x.
await page.evaluate(() => { window.__starlane.gfx.adapt = () => {}; });
await sleep(1500);

// Gameplay shot first (normal follow camera, champion near the base), then pin the overview camera.
if (PLAY) {
  await sleep(4000);
  await page.screenshot({ path: PLAY, timeout: 120000 });
}

// Fixed overview: look at the mid lane between the Sunny inhibitor and outer tower, from the game's own camera direction.
await page.evaluate(() => {
  const { gfx } = window.__starlane, cam = gfx.camera, render = gfx.render;
  const focus = { x: -50, y: 0, z: -4 };
  gfx.renderer.info.autoReset = false; // the post chain renders several passes: count the whole frame
  gfx.render = () => {
    gfx.renderer.info.reset();
    cam.position.set(focus.x - 7 * 2.6, 20 * 2.6, focus.z + 15 * 2.6);
    cam.lookAt(focus.x, focus.y, focus.z);
    cam.updateMatrixWorld();
    render(focus);
  };
  for (const e of document.body.children) if (e !== gfx.renderer.domElement && !e.contains(gfx.renderer.domElement)) e.style.visibility = 'hidden';
});

// Frame timing over ~3 s (software GL in CI: absolute numbers are only comparable run to run on the same box).
const perf = await page.evaluate(() => new Promise((done) => {
  const dts = [];
  let last = performance.now();
  const end = last + 3000;
  const tick = (now) => {
    dts.push(now - last); last = now;
    if (now < end) requestAnimationFrame(tick);
    else {
      const info = window.__starlane.gfx.renderer.info.render;
      dts.shift();
      const avg = dts.reduce((a, b) => a + b, 0) / dts.length;
      done({ frames: dts.length, avgMs: +avg.toFixed(1), fps: +(1000 / avg).toFixed(1), calls: info.calls, triangles: info.triangles });
    }
  };
  requestAnimationFrame(tick);
}));
await page.screenshot({ path: OUT, timeout: 120000 });
console.log(JSON.stringify({ out: OUT, gfx: GFX, ...perf }));
if (errors.length) console.log('ERRORS\n' + errors.join('\n'));

await browser.close();
server.close();
process.exit(errors.length ? 1 : 0);
