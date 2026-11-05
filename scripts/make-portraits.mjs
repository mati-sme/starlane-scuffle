// Renders a 256px bust portrait of every champion's in-game model into assets/portraits/{id}.png (select screen art).
// Output is quantized to a 256-color palette (~30 KB each) via Python Pillow when available.
// Run: node scripts/make-portraits.mjs [onlyId...]  (needs playwright + chromium; set PLAYWRIGHT_DIR if not installed locally)
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const OUT = join(ROOT, 'assets/portraits');
mkdirSync(OUT, { recursive: true });
const require = createRequire(import.meta.url);
let pw;
for (const p of [undefined, process.env.PLAYWRIGHT_DIR, '/tmp/pw/node_modules']) {
  try { pw = require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); break; } catch {}
}
if (!pw) throw new Error('playwright not found; set PLAYWRIGHT_DIR');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  const file = join(ROOT, path);
  if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('pageerror:', e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/scripts/portrait.html?gfx=high`);
await page.waitForFunction(() => window.ready, null, { timeout: 60000 });
const only = process.argv.slice(2);
const ids = only.length ? only : await page.evaluate(() => window.portraitIds);
for (const id of ids) {
  const url = await page.evaluate((i) => window.portrait(i), id);
  const buf = Buffer.from(url.split(',')[1], 'base64');
  writeFileSync(join(OUT, `${id}.png`), buf);
  console.log(`${id}.png ${(buf.length / 1024).toFixed(0)} KB`);
}
await browser.close();
server.close();
const QUANT = 'import sys\nfrom PIL import Image\nfor p in sys.argv[1:]: Image.open(p).convert("RGB").quantize(256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG).save(p, optimize=True)';
const q = spawnSync('python3', ['-c', QUANT, ...ids.map((id) => join(OUT, `${id}.png`))], { stdio: 'inherit' });
console.log(q.status === 0 ? 'quantized' : 'Pillow not available: left as truecolor PNG');
