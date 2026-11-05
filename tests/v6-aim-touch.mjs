// v6 stage A check: attack drag-aim + simultaneous multi-touch (stick + attack + skill + level-up + recall). Offline, phone landscape.
// Run: node tests/v6-aim-touch.mjs [aa-aim.png] [championIndex]  (needs playwright + chromium)
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const OUT = process.argv[2] ?? '/workspace/test-artifacts/starlane-scuffle/v6/aa-aim.png';
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

await page.goto(BASE + '?gfx=low', { waitUntil: 'load', timeout: 90000 });
await tap('play-btn');
await page.locator('[data-testid="champion-card-lumen"]').click({ force: true }); await page.locator('[data-testid="ban-btn"]').click({ force: true }); // v6 draft: ban first (lumen), then pick
await new Promise((r) => setTimeout(r, 300));
await sleep(400);
await page.locator('[data-testid^="champion-card-"]').nth(PICK).click({ force: true });
await sleep(300);
await tap('go-btn');
await page.waitForFunction(() => window.__starlane.state === 'match', null, { timeout: 20000 });
await sleep(1500);

const S = (fn, arg) => page.evaluate(fn, arg);
const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); };
const center = async (id) => { const b = await page.locator(id === 'atk' ? '#atk' : `[data-testid="${id}"]`).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };


// Real multi-touch: CDP touch events with distinct ids -> one pointerId per finger, all down at once.
const cdp = await ctx.newCDPSession(page);
const fingers = new Map();
const send = (type) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [...fingers].map(([id, p]) => ({ id, x: p.x, y: p.y })) });
const down = async (id, p) => { fingers.set(id, p); await send('touchStart'); };
const move = async (id, p) => { fingers.set(id, p); await send('touchMove'); };
const up = async (id) => { const p = fingers.get(id); fingers.delete(id); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ id, x: p.x, y: p.y }] }); };
const IN = (fn, arg) => page.evaluate(async ([src, a]) => { const { input } = await import('/js/core/input.js'); return eval(`(${src})`)(input, a); }, [fn.toString(), arg]);
const preview = () => S(() => window.__starlane.match.preview.root.visible);

// Controlled arena: hero mid-map, full HP, two minions either side so a drag direction picks one.
await S(() => {
  const m = window.__starlane.match, h = m.hero;
  h.maxHp = h.hp = 99999; h.x = h.px = 0; h.z = h.pz = 0; h.points = 3; h.level = 9;
  m.minions.spawnWave(1, 1, ['blobling', 'blobling']);
});
await page.waitForFunction(() => window.__starlane.match.minions.list.filter((x) => x.team === 1).length >= 2, null, { timeout: 30000 }); // the wave trickles out
await S(() => {
  const m = window.__starlane.match;
  const [a, b] = m.minions.list.filter((x) => x.team === 1);
  a.hp = a.maxHp = b.hp = b.maxHp = 99999; a.x = 2; a.z = 0; b.x = -2; b.z = 0;
  window.__mins = [a, b];
});
await sleep(300);
const atk = await center('atk'), q = await center('skill-q'), rc = await center('recall'), up0 = await center('skill-up-q');

// 1. quick tap on Attack = auto-target, no aim line
await down(1, atk); await sleep(250);
check('tap: attack held, no drag aim', await IN((i) => i.attackTouch && i.atkAim && !i.atkAim.dragged));
check('tap: no preview', !(await preview()));
await up(1); await sleep(100);
check('tap release: attack cleared', await IN((i) => !i.attackTouch && !i.atkAim));

// 2. drag Attack in two opposite screen directions -> different targets, preview fan visible
const aimed = async (dx) => {
  await down(1, atk); await move(1, { x: atk.x + dx / 2, y: atk.y }); await move(1, { x: atk.x + dx, y: atk.y });
  await sleep(500);
  return S(() => ({ i: window.__mins.indexOf(window.__starlane.match.hero.aim), vis: window.__starlane.match.preview.root.visible }));
};
const L = await aimed(-80);
check('drag left: preview fan + a target picked', L.vis && L.i >= 0, JSON.stringify(L));
await page.screenshot({ path: OUT });
await up(1); await sleep(600);
check('drag release: preview hidden', !(await preview()));
const R = await aimed(80);
check('drag right picks the opposite target', R.vis && R.i >= 0 && R.i !== L.i, JSON.stringify(R));
await up(1); await sleep(150);

// 3. everything at once: stick + attack-drag held, then skill, level-up, recall pressed on top without lifting
await down(10, { x: 120, y: 260 }); await move(10, { x: 170, y: 230 });
check('finger A: stick moving', await IN((i) => Math.hypot(i.stick.x, i.stick.y) > 0.3));
await down(1, atk); await move(1, { x: atk.x - 40, y: atk.y }); await move(1, { x: atk.x - 80, y: atk.y });
await sleep(250);
check('finger B: attack aiming while stick held', await IN((i) => i.attackTouch && i.atkAim?.dragged && Math.hypot(i.stick.x, i.stick.y) > 0.3));
await S(() => { const h = window.__starlane.match.hero; h.cds.fill(0); h.ranks[0] = Math.max(h.ranks[0], 1); });
await down(2, q); await sleep(80);
check('finger C: skill Q pressed while stick + attack held', await S(() => document.querySelector('[data-testid="skill-q"]').classList.contains('down')));
await up(2);
await page.waitForFunction(() => window.__starlane.match.hero.cds[0] > 0, null, { timeout: 15000 }).catch(() => {});
check('Q cast; stick + attack still held', (await S(() => window.__starlane.match.hero.cds[0] > 0)) && await IN((i) => i.attackTouch && Math.hypot(i.stick.x, i.stick.y) > 0.3));
await S(() => { const h = window.__starlane.match.hero; h.ranks[1] = 0; h.points = 3; });
await sleep(300);
const eup = await center('skill-up-e');
await down(3, eup); await up(3); await sleep(250);
check('finger D: level-up + spends a point while stick + attack held', (await S(() => window.__starlane.match.hero.ranks[1])) >= 1 && await IN((i) => i.attackTouch && Math.hypot(i.stick.x, i.stick.y) > 0.3));
await down(4, rc); await sleep(100);
check('finger E: recall pressed while stick + attack held', await S(() => document.querySelector('[data-testid="recall"]').classList.contains('down')) && await IN((i) => i.attackTouch && Math.hypot(i.stick.x, i.stick.y) > 0.3));
await page.screenshot({ path: OUT.replace('aa-aim', 'multitouch') });
// lift in a different order than pressed: each control releases on its own
await up(1); await sleep(100);
check('lift attack only: stick still held', await IN((i) => !i.attackTouch && !i.atkAim && Math.hypot(i.stick.x, i.stick.y) > 0.3));
await up(4); await sleep(100);
check('lift recall only: stick still held', await IN((i) => Math.hypot(i.stick.x, i.stick.y) > 0.3));
await up(10); await sleep(100);
check('lift stick: all clear', await IN((i) => !i.attackTouch && Math.hypot(i.stick.x, i.stick.y) === 0));

// 4. second finger tap on Attack while the first is held must not steal / release the first
await down(1, atk); await down(2, { x: atk.x + 10, y: atk.y + 10 }); await up(2); await sleep(100);
check('second finger on Attack does not release the first', await IN((i) => i.attackTouch));
await up(1);

const lost = await S(() => { const c = document.querySelector('canvas'); const gl = c.getContext('webgl2') || c.getContext('webgl'); return gl?.isContextLost?.(); });
if (lost) errors.push('WebGL context lost');
if (errors.length) console.log(errors.join('\n'));
console.log(results.every(Boolean) && !errors.length ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
server.close();
process.exit(results.every(Boolean) && !errors.length ? 0 : 1);
