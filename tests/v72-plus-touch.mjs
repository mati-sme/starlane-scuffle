// Hotfix #2: skill level-up '+' works, and multi-touch (stick + attack/skill/+) does not reset movement.
// Real CDP multi-pointer touch on an iPhone 12 landscape viewport.
// Run: node tests/v72-plus-touch.mjs
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
await page.locator('[data-testid="setup-next"]').click({ force: true, timeout: 4000 }).catch(() => {});
await page.locator('[data-testid="champion-card-lumen"]').click({ force: true });
await page.locator('[data-testid="ban-btn"]').click({ force: true });
await sleep(400);
await page.locator('[data-testid^="champion-card-"]').nth(0).click({ force: true });
await sleep(300);
await tap('go-btn');
await page.waitForFunction(() => window.__starlane.state === 'match', null, { timeout: 20000 });
await sleep(1200);

const S = (fn, arg) => page.evaluate(fn, arg);
const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); };
const center = async (sel) => {
  const b = await page.locator(sel).boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

const cdp = await ctx.newCDPSession(page);
const fingers = new Map();
const send = (type) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [...fingers].map(([id, p]) => ({ id, x: p.x, y: p.y })) });
const down = async (id, p) => { fingers.set(id, p); await send('touchStart'); };
const move = async (id, p) => { fingers.set(id, p); await send('touchMove'); };
const up = async (id) => { const p = fingers.get(id); fingers.delete(id); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ id, x: p.x, y: p.y }] }); };
const IN = (fn, arg) => page.evaluate(async ([src, a]) => { const { input } = await import('/js/core/input.js'); return eval(`(${src})`)(input, a); }, [fn.toString(), arg]);

await S(() => {
  const m = window.__starlane.match, h = m.hero;
  h.maxHp = h.hp = 99999;
  h.x = h.px = 0; h.z = h.pz = 0;
  h.level = 9; h.points = 3;
  h.ranks = [0, 0, 0];
  document.body.classList.add('touch');
});
await sleep(200);
await S(() => { const h = window.__starlane.match.hero; h.points = 3; h.ranks = [0, 0, 0]; });
await page.waitForSelector('[data-testid="skill-up-q"]:not([hidden])', { timeout: 8000 });

// 1) Solo tap on '+' ranks the skill
const qUp = await center('[data-testid="skill-up-q"]');
await down(20, qUp);
await sleep(40);
await up(20);
await sleep(80);
const ranksAfterSolo = await S(() => window.__starlane.match.hero.ranks.slice());
const pointsAfterSolo = await S(() => window.__starlane.match.hero.points);
check('solo +: Q ranked up', ranksAfterSolo[0] >= 1, JSON.stringify({ ranks: ranksAfterSolo, points: pointsAfterSolo }));

// 2) Hold stick, then tap '+' — movement must stay, and the point must spend
await S(() => { const h = window.__starlane.match.hero; h.points = 3; });
const zone = await page.locator('#stick-zone').boundingBox();
const stick0 = { x: zone.x + zone.width * 0.45, y: zone.y + zone.height * 0.65 };
const stick1 = { x: stick0.x + 70, y: stick0.y };
await down(1, stick0);
await move(1, stick1);
await sleep(80);
const stickHeld = await IN((input) => Math.hypot(input.stick.x, input.stick.y) > 0.2);
check('stick: dragging', stickHeld);

const eUp = await center('[data-testid="skill-up-e"]');
const ranksBefore = await S(() => window.__starlane.match.hero.ranks[1]);
await down(21, eUp);
await sleep(50);
await up(21);
await sleep(80);
const ranksE = await S(() => window.__starlane.match.hero.ranks[1]);
const stickAfterPlus = await IN((input) => Math.hypot(input.stick.x, input.stick.y) > 0.2);
check('+ while moving: E ranked up', ranksE > ranksBefore, `rank ${ranksBefore} -> ${ranksE}`);
check('+ while moving: stick still held', stickAfterPlus);

// 3) Stick + attack + skill Q all down at once
const atk = await center('#atk');
const qSk = await center('[data-testid="skill-q"]');
await down(2, atk);
await down(3, qSk);
await sleep(80);
const multi = await IN((input) => ({
  stick: Math.hypot(input.stick.x, input.stick.y) > 0.2,
  attack: input.attackTouch,
  q: !!(input.aiming && input.aiming.slot === 0) || input.cast[0],
}));
check('multitouch: stick still held with attack+Q', multi.stick, JSON.stringify(multi));
check('multitouch: attack held while moving', multi.attack, JSON.stringify(multi));
check('multitouch: Q aiming or cast while moving', multi.q, JSON.stringify(multi));

await up(3);
await up(2);
await up(1);
await sleep(50);
check('no page errors', errors.length === 0, errors.slice(0, 4).join(' | '));

const failed = results.filter((ok) => !ok).length;
console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
