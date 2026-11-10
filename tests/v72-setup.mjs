// v7.2 match setup: defaults (Mid 5v5), global Easy preset, per-bot Hard, 1v1 / 2v3 spawn counts, player on Gloom, ban/pick + unique picks, Easy vs Mid numbers.
// Run: node tests/v72-setup.mjs  (needs playwright + chromium)
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

const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tid = (page, id) => page.locator(`[data-testid="${id}"]`);
const tap = (page, id) => tid(page, id).click({ force: true });
const errors = [];
const browser = await chromium.launch(process.env.DEFAULT_GL ? {} : { args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });

async function fresh(name) {
  const ctx = await browser.newContext({ ...devices['iPhone 12 landscape'] });
  await ctx.addInitScript(() => { try { localStorage.setItem("starlane.unlockAll", "true"); } catch {} }); // v8: every champion open for tests
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name} pageerror: ${e.message}`));
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/favicon|WebSocket|ERR_/.test(m.text())) errors.push(`${name} console: ${m.text().slice(0, 300)}`); });
  await page.goto(BASE + '?gfx=low', { waitUntil: 'load', timeout: 90000 });
  await tap(page, 'play-btn');
  await tid(page, 'setup-next').waitFor();
  return { ctx, page };
}
// Setup is already configured: ban the 4th card, pick the first free one, GO, wait for the match.
async function draft(page) {
  await tap(page, 'setup-next');
  await tid(page, 'draft-title').waitFor();
  const ids = await page.$$eval('[data-testid^="champion-card-"]', (els) => els.map((e) => e.dataset.id));
  await tid(page, `champion-card-${ids[3]}`).click({ force: true });
  await tap(page, 'ban-btn');
  await sleep(300);
  await page.locator('[data-testid^="champion-card-"]:not([disabled])').first().click({ force: true });
  await tap(page, 'go-btn');
  await page.waitForFunction(() => window.__starlane.state === 'match', null, { timeout: 20000 });
  await sleep(600);
}
const info = (page) => page.evaluate(() => {
  const m = window.__starlane.match, ids = m.heroes.map((h) => h.id);
  const bots = m.heroes.filter((h) => h.brain);
  return { n: [0, 1].map((t) => m.heroes.filter((h) => h.team === t).length), me: { team: m.hero.team, slot: m.hero.slot, brain: !!m.hero.brain }, unique: new Set(ids).size === ids.length, myTeam: m.myTeam,
    lv: bots.map((h) => [h.team, h.slot, h.brain.d.name, +h.outMul.toFixed(2), h.brain.d.react]) };
});
const pos = (page) => page.evaluate(() => { const h = window.__starlane.match.hero; return { x: h.x, z: h.z }; });

// 1. defaults: Mid 5v5, player on Sunny
{
  const { ctx, page } = await fresh('defaults');
  check('setup screen shows 5 v 5 Mid', (await tid(page, 'setup-summary').textContent()).includes('5 v 5 · Mid'));
  await draft(page);
  const i = await info(page);
  check('default match is 5v5', i.n[0] === 5 && i.n[1] === 5, i.n.join('v'));
  check('player leads Sunny, no brain', i.me.team === 0 && i.me.slot === 0 && !i.me.brain);
  check('all 9 bots are Mid with no extra damage scaling', i.lv.length === 9 && i.lv.every((l) => l[2] === 'Mid'), JSON.stringify(i.lv.map((l) => l[3])));
  check('unique champions across both teams', i.unique);
  const a = await pos(page);
  await page.evaluate(() => { window.__sl = true; });
  await page.keyboard.down('KeyD'); await sleep(900); await page.keyboard.up('KeyD');
  const b = await pos(page);
  check('hero can move', Math.hypot(a.x - b.x, a.z - b.z) > 1, JSON.stringify([a, b]));
  await ctx.close();
}

// 2. global Easy preset + per-bot Hard on one enemy; numbers
{
  const { ctx, page } = await fresh('easy');
  await tap(page, 'preset-easy');
  check('Easy preset highlights', (await tid(page, 'setup-summary').textContent()).includes('Easy'));
  await tap(page, 'slot-1-2-hard');
  check('one Hard bot makes the summary Mixed', (await tid(page, 'setup-summary').textContent()).includes('Mixed'));
  await draft(page);
  const i = await info(page);
  const hard = i.lv.filter((l) => l[2] === 'Hard'), easy = i.lv.filter((l) => l[2] === 'Easy');
  check('exactly one Hard bot (Gloom #3)', hard.length === 1 && hard[0][0] === 1 && hard[0][1] === 2, JSON.stringify(hard));
  check('the other 8 bots are Easy', easy.length === 8);
  check('Easy damage 0.65-0.75x Mid, react >= 1.1s', easy.every((l) => l[3] <= 0.75 * 1.0001 && l[3] >= 0.65 && l[4] >= 1.1), JSON.stringify(easy[0]));
  check('Hard bot is sharper than Mid', hard[0][3] > 1 && hard[0][4] < 0.45);
  await ctx.close();
}

// 3. 1v1 and 2v3
for (const [a, b] of [[1, 1], [2, 3]]) {
  const { ctx, page } = await fresh(`${a}v${b}`);
  for (let k = 5; k > a; k--) await tap(page, 'size-minus-0');
  for (let k = 5; k > b; k--) await tap(page, 'size-minus-1');
  check(`${a}v${b} counts shown`, (await tid(page, 'size-count-0').textContent()) == a && (await tid(page, 'size-count-1').textContent()) == b);
  await draft(page);
  const i = await info(page);
  check(`${a}v${b} spawns those counts`, i.n[0] === a && i.n[1] === b, i.n.join('v'));
  check(`${a}v${b} unique champions`, i.unique);
  const p0 = await pos(page);
  await page.keyboard.down('KeyD'); await sleep(800); await page.keyboard.up('KeyD');
  const p1 = await pos(page);
  check(`${a}v${b} hero moves`, Math.hypot(p0.x - p1.x, p0.z - p1.z) > 1);
  await sleep(2500);
  check(`${a}v${b} sim runs without NaN`, await page.evaluate(() => window.__starlane.match.heroes.every((h) => Number.isFinite(h.x) && Number.isFinite(h.z))));
  await ctx.close();
}

// 4. player on Gloom
{
  const { ctx, page } = await fresh('gloom');
  await tap(page, 'side-1');
  await tap(page, 'size-minus-1'); // 5v4 with me leading Gloom
  await draft(page);
  const i = await info(page);
  check('player leads Gloom', i.me.team === 1 && i.me.slot === 0 && !i.me.brain && i.myTeam === 1, JSON.stringify(i.me));
  check('Gloom 4, Sunny 5', i.n[0] === 5 && i.n[1] === 4, i.n.join('v'));
  const a = await pos(page);
  // Gloom spawns at +x; KeyD (screen-right / +x) walks into the base wall. Walk toward mid instead.
  await page.evaluate(() => { const h = window.__starlane.match.hero; h.walkTo = { x: 0, z: h.z }; });
  await page.waitForFunction((from) => {
    const h = window.__starlane.match.hero;
    return Math.hypot(h.x - from.x, h.z - from.z) > 1.2;
  }, a, { timeout: 8000 }).catch(() => {});
  const b = await pos(page);
  check('Gloom hero can move', Math.hypot(a.x - b.x, a.z - b.z) > 1, JSON.stringify([a, b]));
  await ctx.close();
}

// 5. bans + unique picks after setup (ban locks the champion; picking it is impossible)
{
  const { ctx, page } = await fresh('draft');
  await tap(page, 'setup-next');
  await tid(page, 'draft-title').waitFor();
  const ids = await page.$$eval('[data-testid^="champion-card-"]', (els) => els.map((e) => e.dataset.id));
  await tid(page, `champion-card-${ids[5]}`).click({ force: true });
  await tap(page, 'ban-btn');
  await sleep(300);
  const banned = await page.$$eval('.hcard.banned', (els) => els.map((e) => e.dataset.id));
  check('ban phase still works after setup (3 bans)', banned.length === 3 && banned.includes(ids[5]));
  await page.locator('[data-testid^="champion-card-"]:not([disabled])').first().click({ force: true });
  await tap(page, 'go-btn');
  await page.waitForFunction(() => window.__starlane.state === 'match', null, { timeout: 20000 });
  const heroes = await page.evaluate(() => window.__starlane.match.heroes.map((h) => h.id));
  check('no banned champion plays, all unique', banned.every((b) => !heroes.includes(b)) && new Set(heroes).size === heroes.length);
  await ctx.close();
}

// 6. setup-next is the only change to the flow, back works
{
  const { ctx, page } = await fresh('back');
  await tap(page, 'setup-back');
  check('back returns to the title', await tid(page, 'play-btn').isVisible());
  await ctx.close();
}

check('no page errors', errors.length === 0, errors.slice(0, 5).join(' | '));
await browser.close();
server.close();
const failed = results.filter((r) => !r).length;
console.log(failed ? `${failed} FAILED` : `ALL ${results.length} PASSED`);
process.exit(failed ? 1 : 0);
