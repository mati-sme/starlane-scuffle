// Shared Playwright harness for the v9 tests: static server + Chromium (software GL) + tiny helpers.
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const require = createRequire(import.meta.url);
let pw;
for (const p of [undefined, process.env.PLAYWRIGHT_DIR, '/tmp/pw/node_modules']) { try { pw = require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); break; } catch {} }
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
export const SHOTS = '/workspace/test-artifacts/starlane-scuffle/v9/';
export async function launch({ landscape = true, seed = {}, query = '?gfx=low', size } = {}) {
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
  const ctx = await browser.newContext(size ? { viewport: size, hasTouch: true } : { ...pw.devices['iPhone 12 landscape'] });
  await ctx.addInitScript((s) => { localStorage.setItem('starlane.tutorialSeen', 'true'); for (const [k, v] of Object.entries(s)) localStorage.setItem('starlane.' + k, JSON.stringify(v)); }, seed);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const tid = (id) => page.locator(`[data-testid="${id}"]`);
  let failed = 0;
  const check = (n, ok, x = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'} ${n} ${x}`); };
  await page.goto(BASE + query, { waitUntil: 'load', timeout: 90000 });
  const done = async () => { await browser.close(); server.close(); console.log(failed ? `${failed} FAILED` : 'ALL PASS'); process.exit(failed ? 1 : 0); };
  return { page, tid, check, errors, done, sleep: (ms) => new Promise((r) => setTimeout(r, ms)), BASE };
}
