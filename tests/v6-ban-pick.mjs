// v6 stage C check: offline ban phase (labels, help, timer, ban stamps, bots avoid banned + taken, unique line-ups)
// and the online lobby draft (both humans ban, picks lock for the other player). Needs playwright + chromium.
// Online part runs worker/room.js through tests/local-room.mjs (needs the `ws` package; WS_DIR=<node_modules>) unless WS_URL points at a deployed worker.
// Run: node tests/v6-ban-pick.mjs [outDir]
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const OUT = process.argv[2] ?? '/workspace/test-artifacts/starlane-scuffle/v6';
import { startLocalRooms } from './local-room.mjs';
const local = process.env.WS_URL ? null : await startLocalRooms();
const WS = `&ws=${encodeURIComponent(process.env.WS_URL ?? local.url)}`;
mkdirSync(OUT, { recursive: true });

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
const errors = [];
const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tid = (page, id) => page.locator(`[data-testid="${id}"]`);
const tap = (page, id) => tid(page, id).click({ force: true });
const text = (page, id) => tid(page, id).textContent();
const has = async (page, id, str) => (await text(page, id)).toLowerCase().includes(str.toLowerCase());
async function open(name) {
  const ctx = await browser.newContext({ ...devices['iPhone 12 landscape'] });
  await ctx.addInitScript(() => { try { localStorage.setItem("starlane.unlockAll", "true"); } catch {} }); // v8: every champion open for tests
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name} pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|WebSocket|ERR_/.test(m.text())) errors.push(`${name} console: ${m.text().slice(0, 300)}`); });
  return { ctx, page };
}

// ---------------- offline ----------------
{
  const { ctx, page } = await open('offline');
  await page.goto(BASE + '?gfx=low', { waitUntil: 'load', timeout: 90000 });
  await tap(page, 'play-btn'); await tap(page, 'mode-ranked'); await page.locator('[data-testid="setup-next"]').click({ force: true, timeout: 4000 }).catch(() => {});
  await tid(page, 'draft-title').waitFor();
  check('ban phase label', await has(page, 'draft-title', 'Ban — tap to ban'));
  check('ban help text', await has(page, 'draft-help', 'First ban one champion'));
  check('ban timer shown', /^\d+s$/.test(await text(page, 'draft-timer')));
  check('ban button disabled until a champion is tapped', await tid(page, 'ban-btn').isDisabled());
  const ids = await page.$$eval('[data-testid^="champion-card-"]', (els) => els.map((e) => e.dataset.id));
  const ban = ids[3];
  await tid(page, `champion-card-${ban}`).click({ force: true });
  await sleep(200);
  await page.screenshot({ path: `${OUT}/ban-phase.png` });
  await tap(page, 'ban-btn');
  await sleep(300);
  check('pick phase label', await has(page, 'draft-title', 'Pick — tap to choose'));
  const stamped = await page.$$eval('.hcard.banned', (els) => els.map((e) => e.dataset.id));
  check('3 champions banned (me + 2 bots), mine among them', stamped.length === 3 && stamped.includes(ban), stamped.join(','));
  check('banned cards disabled + stamped', await page.$$eval('.hcard.banned', (els) => els.every((e) => e.disabled && e.dataset.stamp === 'BANNED')));
  const free = ids.filter((id) => !stamped.includes(id));
  const mine = free[0];
  await tid(page, `champion-card-${mine}`).click({ force: true });
  await sleep(300);
  await page.screenshot({ path: `${OUT}/pick-locked.png` });
  await tap(page, 'go-btn');
  await page.waitForFunction(() => window.__starlane.state === 'match', null, { timeout: 20000 });
  const line = await page.evaluate(() => window.__starlane.match.heroes.map((h) => h.id));
  check('10 heroes, all unique', line.length === 10 && new Set(line).size === 10, line.join(','));
  check('no banned champion in the match', !line.some((id) => stamped.includes(id)));
  check('player has the pick', line[0] === mine);
  await ctx.close();
}

// ---------------- offline: timer auto-plays ----------------
{
  const { ctx, page } = await open('timer');
  await page.goto(BASE + '?gfx=low', { waitUntil: 'load', timeout: 90000 });
  await tap(page, 'play-btn'); await tap(page, 'mode-ranked'); await page.locator('[data-testid="setup-next"]').click({ force: true, timeout: 4000 }).catch(() => {});
  await tid(page, 'draft-timer').waitFor();
  const t0 = parseInt(await text(page, 'draft-timer'), 10);
  const down = await page.waitForFunction((n) => parseInt(document.querySelector('[data-testid="draft-timer"]').textContent, 10) < n, t0, { timeout: 15000 }).then(() => true, () => false);
  check('timer counts down', down, `from ${t0}s`);
  await ctx.close();
}

// ---------------- online ----------------
try {
  const host = await open('host'), guest = await open('guest');
  await host.page.goto(BASE + '?gfx=low' + WS, { waitUntil: 'load', timeout: 90000 });
  await tap(host.page, 'online-btn');
  await tap(host.page, 'create-room');
  await tid(host.page, 'room-code').waitFor({ timeout: 15000 });
  const code = await text(host.page, 'room-code');
  await guest.page.goto(`${BASE}?gfx=low&room=${code}${WS}`, { waitUntil: 'load', timeout: 90000 });
  await tid(guest.page, 'room-code').waitFor({ timeout: 15000 });
  await host.page.waitForFunction(() => document.querySelector('[data-testid="player-1"]'), null, { timeout: 10000 });
  check('lobby shows ban stage to both', await has(host.page, 'draft-title', 'Ban') && await has(guest.page, 'draft-title', 'Ban'));
  const ids = await host.page.$$eval('[data-testid^="lobby-champ-"]', (els) => els.map((e) => e.dataset.id));
  await tap(host.page, `lobby-champ-${ids[0]}`);
  await tap(host.page, 'ban-btn');
  await guest.page.waitForFunction((id) => document.querySelector(`[data-testid="lobby-champ-${id}"]`)?.disabled, ids[0], { timeout: 8000 });
  check('guest sees host ban stamped', await tid(guest.page, `lobby-champ-${ids[0]}`).getAttribute('data-stamp') === 'BANNED');
  check('guest still in ban stage (not done yet)', await has(guest.page, 'draft-title', 'Ban'));
  await tap(guest.page, `lobby-champ-${ids[1]}`);
  await tap(guest.page, 'ban-btn');
  await host.page.waitForFunction(() => document.querySelector('[data-testid="draft-title"]')?.textContent.includes('Pick'), null, { timeout: 8000 });
  await guest.page.waitForFunction(() => document.querySelector('[data-testid="draft-title"]')?.textContent.includes('Pick'), null, { timeout: 8000 });
  check('both bans -> pick stage for both', true);
  for (const g of [host, guest]) for (const i of [0, 1]) check(`ban stamp on ${ids[i]}`, await tid(g.page, `lobby-champ-${ids[i]}`).getAttribute('data-stamp') === 'BANNED');
  await tap(host.page, `lobby-champ-${ids[5]}`);
  await guest.page.waitForFunction((id) => document.querySelector(`[data-testid="lobby-champ-${id}"]`)?.getAttribute('data-stamp') === 'TAKEN', ids[5], { timeout: 8000 });
  check('guest sees host pick locked', true);
  await guest.page.screenshot({ path: `${OUT}/pick-locked-online.png` });
  check('locked card is disabled for guest', await tid(guest.page, `lobby-champ-${ids[5]}`).isDisabled());
  await tap(guest.page, `lobby-champ-${ids[6]}`);
  await tap(host.page, 'team-gloom'); // versus is not required; same-team picks are locked too
  await host.page.waitForFunction((id) => document.querySelector(`[data-testid="lobby-champ-${id}"]`)?.getAttribute('data-stamp') === 'TAKEN', ids[6], { timeout: 8000 });
  check('host sees guest pick locked (any team)', true);
  await host.page.waitForFunction(() => { const b = document.querySelector('[data-testid="start-btn"]'); return b && !b.disabled; }, null, { timeout: 10000 });
  await tap(host.page, 'start-btn');
  await Promise.all([host, guest].map((g) => g.page.waitForFunction(() => window.__starlane.state === 'match', null, { timeout: 30000 })));
  const lines = await Promise.all([host, guest].map((g) => g.page.evaluate(() => window.__starlane.match.heroes.map((h) => h.id))));
  check('online: 10 unique heroes, same on both', new Set(lines[0]).size === 10 && lines[0].join() === lines[1].join(), lines[0].join(','));
  check('online: no banned champion', !lines[0].includes(ids[0]) && !lines[0].includes(ids[1]));
  await host.ctx.close(); await guest.ctx.close();
} catch (e) {
  check('online draft', false, String(e).slice(0, 300));
}

await browser.close();
server.close();
local?.close();
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); }
const bad = results.filter((r) => !r).length;
console.log(bad || errors.length ? `FAILED (${bad} failed, ${errors.length} errors)` : 'ALL PASS');
process.exit(bad || errors.length ? 1 : 0);
