// v7.2.4: iPad (WebKit / Chromium fallback) — touch UI appears without a manual body.touch, a finger drives the stick
// even when labelled 'mouse', and the skill '+' ranks when only pointerdown / pointercancel arrive (no click).
// Run: node tests/v72-ipad.mjs
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
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


const kinds = [];
for (const [name, lib, uaMode] of [['webkit iPad Pro (mobile UA)', pw.webkit, 'mobile'], ['webkit iPad Pro (desktop-site Mac UA)', pw.webkit, 'desktop'], ['chromium iPad Pro', chromium, 'mobile'], ['chromium iPad desktop-site', chromium, 'desktop']]) kinds.push({ name, lib, uaMode });
const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const { name, lib, uaMode } of kinds) {
  let browser;
  try { browser = await lib.launch(lib === chromium && !process.env.DEFAULT_GL ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] } : {}); }
  catch (e) { console.log(`SKIP ${name}: ${String(e.message).split('\n')[0]}`); continue; }
  const dev = devices['iPad Pro 11 landscape'];
  const opts = { ...dev };
  if (uaMode === 'desktop') opts.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript(() => { try { localStorage.setItem("starlane.unlockAll", "true"); } catch {} }); // v8: every champion open for tests
  if (uaMode === 'desktop') await ctx.addInitScript(() => { Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' }); Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 }); });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  // Simulate the desktop-site iPad: no (pointer: coarse), no touchstart. The stub must run before the game reads matchMedia.
  if (uaMode === 'desktop') await ctx.addInitScript(() => {
    const mm = window.matchMedia.bind(window);
    window.matchMedia = (q) => (/pointer:\s*coarse/.test(q) ? { matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : mm(q));
  });
  const tap = (id) => page.locator(`[data-testid="${id}"]`).tap({ force: true }); // touch only: a mouse click would (rightly) mark a real mouse as present
  await page.goto(BASE + '?gfx=low', { waitUntil: 'load', timeout: 90000 });
  const env = await page.evaluate(() => ({ platform: navigator.platform, mtp: navigator.maxTouchPoints, coarse: matchMedia('(pointer: coarse)').matches, touchClass: document.body.classList.contains('touch') }));
  console.log(`-- ${name}`, JSON.stringify(env));
  await tap('play-btn');
  await page.locator('[data-testid="setup-next"]').tap({ force: true, timeout: 4000 }).catch(() => {});
  await page.locator('[data-testid="champion-card-lumen"]').tap({ force: true });
  await page.locator('[data-testid="ban-btn"]').tap({ force: true });
  await sleep(400);
  await page.locator('[data-testid^="champion-card-"]:not([disabled])').nth(0).tap({ force: true });
  await sleep(800);
  await tap('go-btn');
  await page.waitForFunction(() => window.__starlane.state === 'match', null, { timeout: 20000 }).catch(async (e) => { console.log('STATE', await page.evaluate(() => window.__starlane.state), await page.evaluate(() => document.body.innerText.slice(0, 200))); throw e; });
  await sleep(1200);

  await page.evaluate(() => { const h = window.__starlane.match.hero; h.maxHp = h.hp = 99999; h.x = h.px = 0; h.z = h.pz = 0; h.level = 9; h.points = 3; h.ranks = [0, 0, 0]; });
  await sleep(200);
  check(`${name}: touch UI appears by itself (body.touch)`, await page.evaluate(() => document.body.classList.contains('touch')));
  check(`${name}: #touch visible`, await page.evaluate(() => getComputedStyle(document.getElementById('touch')).display !== 'none'));

  // A touch-type pointer on the move pad drives the stick; so does one labelled 'mouse' (iPadOS quirk).
  const zone = await page.locator('#stick-zone').boundingBox();
  const sx = zone.x + zone.width * 0.45, sy = zone.y + zone.height * 0.65;
  for (const pointerType of ['touch', 'mouse']) {
    const stick = await page.evaluate(async ([pt, x, y]) => {
      const { input } = await import('/js/core/input.js');
      const z = document.getElementById('stick-zone');
      const mk = (type, px) => z.dispatchEvent(new PointerEvent(type, { pointerId: 77, pointerType: pt, isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: px, clientY: y, bubbles: true, cancelable: true }));
      mk('pointerdown', x); mk('pointermove', x + 70);
      const r = Math.hypot(input.stick.x, input.stick.y);
      mk('pointerup', x + 70);
      return r;
    }, [pointerType, sx, sy]);
    check(`${name}: '${pointerType}' pointer on move pad gives stick input`, stick > 0.2, `stick=${stick.toFixed(2)}`);
  }

  // '+' with only pointerdown then pointercancel (clientX/Y = 0, no click) must still rank, once.
  for (const mode of ['cancel@0,0', 'down-only-then-up-elsewhere', 'plain-click']) {
    await sleep(700); // outside the click de-dupe window
    await page.evaluate(() => { const h = window.__starlane.match.hero; h.points = 3; h.ranks = [0, 0, 0]; });
    await page.waitForSelector('[data-testid="skill-up-q"]:not([hidden])', { timeout: 8000 });
    await page.evaluate((m) => {
      const up = document.querySelector('[data-testid="skill-up-q"]');
      const ev = (type, x, y) => up.dispatchEvent(new PointerEvent(type, { pointerId: 9, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true }));
      const r = up.getBoundingClientRect(), cx = r.x + r.width / 2, cy = r.y + r.height / 2;
      if (m === 'plain-click') { up.click(); return; }
      ev('pointerdown', cx, cy);
      if (m === 'cancel@0,0') ev('pointercancel', 0, 0);
      else ev('pointerup', cx + 300, cy + 300);
    }, mode);
    await sleep(80);
    const rank = await page.evaluate(() => window.__starlane.match.hero.ranks[0]);
    check(`${name}: + ranks (${mode}), exactly once`, rank === 1, `rank=${rank}`);
  }
  // Real touch tap through the browser's own input pipeline (hit-test, synthesized events).
  await page.evaluate(() => { const h = window.__starlane.match.hero; h.points = 3; h.ranks = [0, 0, 0]; });
  await sleep(100);
  await page.locator('[data-testid="skill-up-e"]').tap({ force: true });
  await sleep(100);
  const rankE = await page.evaluate(() => window.__starlane.match.hero.ranks[1]);
  check(`${name}: real tap on + ranks E once`, rankE === 1, `rank=${rankE}`);
  check(`${name}: no page errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
}

const failed = results.filter((ok) => !ok).length;
console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
server.close();
process.exit(failed ? 1 : 0);
