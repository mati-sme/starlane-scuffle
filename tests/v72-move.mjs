// v7.2 stage A check: movement never gets stuck (joystick pointer bookkeeping, blur / hidden tab / pause cycles, walk click, recall cancel, respawn). Offline, phone landscape.
// Run: node tests/v72-move.mjs  (needs playwright + chromium)
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const PICK = 0;

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

await page.goto(BASE + '?gfx=low', { waitUntil: 'load', timeout: 90000 });
await tap('play-btn'); await page.locator('[data-testid="setup-next"]').click({ force: true, timeout: 4000 }).catch(() => {});
await page.locator('[data-testid="champion-card-lumen"]').click({ force: true }); await page.locator('[data-testid="ban-btn"]').click({ force: true }); // v6 draft: ban first (lumen), then pick
await new Promise((r) => setTimeout(r, 300));
await sleep(400);
await page.locator('[data-testid^="champion-card-"]').nth(PICK).click({ force: true });
await sleep(300);
await tap('go-btn');
await page.waitForFunction(() => window.__starlane.state === 'match', null, { timeout: 20000 });
await sleep(1500);


const S = (fn, arg) => page.evaluate(fn, arg);
let failed = 0;
const check = (name, ok, extra = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); };
const cdp = await ctx.newCDPSession(page);
const touch = (type, id, p) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ id, x: p.x, y: p.y }] : [] });
const IN = (fn, arg) => page.evaluate(async ([src, a]) => { const { input } = await import('/js/core/input.js'); return eval(`(${src})`)(input, a); }, [fn.toString(), arg]);
const pos = () => S(() => { const h = window.__starlane.match.hero; return { x: h.x, z: h.z }; });
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
// Parks the hero mid-map, away from the fountain and the bots, tough enough to survive the test.
const park = () => S(() => {
  const h = window.__starlane.match.hero;
  h.maxHp = h.hp = 99999; h.x = h.px = 0; h.z = h.pz = 0; h.walkTo = null; h.recall = 0;
});
const settle = () => sleep(150);
// true when `act` makes the hero walk at least 0.8 world units within 4 s
const walks = async (act, release) => {
  await park(); await settle();
  const a = await pos();
  await act();
  let ok = false; // the software renderer is slow: poll rather than sleep a fixed time
  for (let t = 0; t < 40 && !ok; t++) { await sleep(100); ok = dist(a, await pos()) > 0.8; }
  if (release) await release();
  return ok;
};

const SZ = { x: 120, y: 220 };
const drag = (id) => async () => { await touch('touchStart', id, SZ); await touch('touchMove', id, { x: SZ.x + 60, y: SZ.y }); };
const lift = (id) => () => touch('touchEnd', id, { x: SZ.x + 60, y: SZ.y });

// 0. baseline
check('touch: fresh drag moves the hero', await walks(drag(1), lift(1)));

// 1. the real bug: stick held, #touch hidden (pause drops body.playing) -> capture lost, no pointerup reaches the zone; restore; a NEW finger must move the hero
await park(); await settle();
await drag(1)();
await S(() => document.body.classList.remove('playing')); await sleep(150);
await S(() => document.body.classList.add('playing')); await sleep(150);
await touch('touchEnd', 1, { x: SZ.x + 60, y: SZ.y });
await sleep(100);
check('touch: stale stick released after #touch hide/show', await IN((i) => i.stick.x === 0 && i.stick.y === 0));
check('touch: new finger moves after hide/show cycle', await walks(drag(2), lift(2)));

// 1b. stick held, then the window blurs with the finger still down: input resets, a new finger works
await park(); await settle();
await drag(3)();
await S(() => window.dispatchEvent(new Event('blur'))); await sleep(100);
check('touch: stick zero after blur', await IN((i) => i.stick.x === 0 && i.stick.y === 0));
await touch('touchEnd', 3, { x: SZ.x + 60, y: SZ.y });
check('touch: new finger moves after blur', await walks(drag(4), lift(4)));

// 1c. the zone loses a finger's capture without any event reaching the handler, then a new finger arrives (stale id takeover)
await park(); await settle();
await drag(5)();
await S(() => { const z = document.getElementById('stick-zone'); z.style.pointerEvents = 'none'; z.style.display = 'none'; });
await sleep(100);
await S(() => { const z = document.getElementById('stick-zone'); z.style.display = ''; z.style.pointerEvents = ''; });
await touch('touchEnd', 5, { x: SZ.x + 60, y: SZ.y }).catch(() => {});
check('touch: new finger moves after zone hidden mid-drag', await walks(drag(6), lift(6)));

// 2. keyboard: WASD after blur, and after visibilitychange + pause/resume
check('keyboard: D moves', await walks(() => page.keyboard.down('KeyD'), () => page.keyboard.up('KeyD')));
await page.keyboard.down('KeyD'); await S(() => window.dispatchEvent(new Event('blur'))); await sleep(100);
check('keyboard: blur drops held keys', await IN((i) => i.keys.size === 0));
await page.keyboard.up('KeyD');
check('keyboard: W moves after blur', await walks(() => page.keyboard.down('KeyW'), () => page.keyboard.up('KeyW')));
await page.keyboard.down('KeyA');
await S(() => document.dispatchEvent(new Event('visibilitychange'))); await sleep(100);
check('keyboard: visibilitychange drops held keys', await IN((i) => i.keys.size === 0));
await page.keyboard.up('KeyA');
await page.keyboard.press('Escape'); await sleep(300);
check('pause: state paused', await S(() => window.__starlane.state) === 'paused');
await page.keyboard.press('Escape'); await sleep(300);
check('pause: resumed to match', await S(() => window.__starlane.state) === 'match');
check('keyboard: S moves after pause/resume', await walks(() => page.keyboard.down('KeyS'), () => page.keyboard.up('KeyS')));
check('touch: joystick moves after pause/resume', await walks(drag(7), lift(7)));

// 3. mouse right-click walk after the pause cycle
const rightClick = (x, y) => async () => { await page.mouse.move(x, y); await page.mouse.click(x, y, { button: 'right' }); };
check('mouse: right-click walk works', await walks(rightClick(700, 120)));
await page.keyboard.press('Escape'); await sleep(300); await page.keyboard.press('Escape'); await sleep(300);
check('mouse: right-click walk works after pause/resume', await walks(rightClick(300, 330)));

// 4. recall cancelled by moving, then the hero can walk
await park(); await settle();
await S(() => { import('/js/core/input.js').then(({ input }) => { input.recall = true; }); });
await page.waitForFunction(() => window.__starlane.match.hero.recall > 0, null, { timeout: 5000 }).catch(() => {});
check('recall: started', await S(() => window.__starlane.match.hero.recall > 0));
await page.keyboard.down('KeyD');
await page.waitForFunction(() => window.__starlane.match.hero.recall === 0, null, { timeout: 5000 }).catch(() => {});
await page.keyboard.up('KeyD');
check('recall: cancelled by moving', await S(() => window.__starlane.match.hero.recall === 0));
check('recall: hero walks afterwards', await walks(() => page.keyboard.down('KeyA'), () => page.keyboard.up('KeyA')));

// 5. forced death + respawn
await park(); await settle();
await S(async () => { const { dealDamage } = await import('/js/game/combat.js'); const h = window.__starlane.match.hero; h.walkTo = { x: 5, z: 5 }; dealDamage(h, 1e9, null); });
await page.waitForFunction(() => !window.__starlane.match.hero.alive, null, { timeout: 5000 });
await page.waitForFunction(() => window.__starlane.match.hero.dying <= 0, null, { timeout: 8000 });
await S(() => { window.__starlane.match.hero.respawn = 0.2; });
await page.waitForFunction(() => window.__starlane.match.hero.alive, null, { timeout: 8000 });
await sleep(300);
const h5 = await S(() => { const h = window.__starlane.match.hero; return { walkTo: h.walkTo, stun: h.stun, root: h.root, air: h.air, windup: h.windup, script: !!h.script }; });
check('respawn: no leftover walkTo / cc / script', !h5.walkTo && !h5.stun && !h5.root && !h5.air && !h5.windup && !h5.script, JSON.stringify(h5));
check('respawn: hero walks (keyboard)', await walks(() => page.keyboard.down('KeyD'), () => page.keyboard.up('KeyD')));
check('respawn: hero walks (touch)', await walks(drag(8), lift(8)));

check('no page errors', errors.length === 0, errors.join(' | '));
await browser.close(); server.close();
console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
process.exit(failed ? 1 : 0);
