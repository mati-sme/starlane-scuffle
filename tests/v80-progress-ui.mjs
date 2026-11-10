// v8.0 UI: fresh profile (L1, 0 coins, 10 free), locked cards, buying, rewards on the result screen. Run: node tests/v80-progress-ui.mjs
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const require = createRequire(import.meta.url);
let pw;
for (const p of [undefined, process.env.PLAYWRIGHT_DIR, '/tmp/pw/node_modules']) { try { pw = require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); break; } catch {} }
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
const ctx = await browser.newContext({ ...devices['iPhone 12 landscape'] }); // no unlockAll: real locks
const page = await ctx.newPage();
const tid = (id) => page.locator(`[data-testid="${id}"]`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const check = (n, ok, x = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'} ${n} ${x}`); };

await page.goto(BASE + '?gfx=low', { waitUntil: 'load', timeout: 90000 });
check('title lists 3 daily quests', (await page.locator('[data-testid="quests-panel"] .quest').count()) === 3);
if (process.env.TSHOT) await page.screenshot({ path: process.env.TSHOT });
check('title shows level 1', (await tid('player-level').first().textContent()).includes('1'));
check('title shows 0 coins', (await tid('player-coins').first().textContent()).trim() === '0');
await tid('play-btn').click({ force: true }); await tid('setup-next').click({ force: true, timeout: 4000 }).catch(() => {});
await sleep(300);
const info = await page.$$eval('[data-testid^="champion-card-"]', (els) => els.map((e) => [e.dataset.id, e.dataset.locked]));
check('48 cards', info.length === 48, String(info.length));
check('exactly 10 free', info.filter(([, l]) => l === 'false').length === 10);
check('lumen + bulwark free', ['lumen', 'bulwark'].every((id) => info.find(([i]) => i === id)?.[1] === 'false'));
check('locked card has price badge', (await tid('champion-card-granite').locator('.lockbadge').textContent()).includes('100'));
await tid('champion-card-lumen').click({ force: true }); await tid('ban-btn').click({ force: true }); await sleep(400);
await tid('champion-card-granite').click({ force: true }); await sleep(200);
check('locked champ has no GO', (await tid('go-btn').count()) === 0);
check('buy disabled with 0 coins', await tid('buy-btn').isDisabled());
// give coins, reload into the pick screen and buy
await page.evaluate(() => localStorage.setItem('starlane.profile', JSON.stringify({ level: 3, xp: 5, coins: 250, owned: [], paid: 0, matches: 4, wins: 2, kills: 3, stars: 2 })));
await page.reload({ waitUntil: 'load' });
check('title shows saved coins + level', (await tid('player-coins').first().textContent()).trim() === '250' && (await tid('player-level').first().textContent()).includes('3'));
await tid('play-btn').click({ force: true }); await tid('setup-next').click({ force: true, timeout: 4000 }).catch(() => {});
await sleep(300); await tid('champion-card-lumen').click({ force: true }); await tid('ban-btn').click({ force: true }); await sleep(400);
await tid('champion-card-granite').click({ force: true }); await sleep(200);
if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
await tid('buy-btn').click({ force: true }); await sleep(300);
check('bought: GO available', (await tid('go-btn').count()) === 1);
check('coins down to 150', (await tid('select-wallet').locator('.coins').textContent()).trim() === '150');
check('next price now 110', (await tid('champion-card-bulwark').count()) === 1 && (await page.locator('.lockbadge b').first().textContent()) === '110');
await tid('go-btn').click({ force: true });
await page.waitForFunction(() => window.__starlane.state === 'match', null, { timeout: 20000 });
await sleep(500);
await page.evaluate(() => window.__starlane.match._end(window.__starlane.match.myTeam === 0, 'core'));
await tid('rewards').waitFor({ timeout: 6000 });
const txt = await tid('rewards').textContent();
check('win rewards shown', /\+\d+/.test(txt) && txt.includes('XP'), txt.trim());
const prof = await page.evaluate(() => JSON.parse(localStorage.getItem('starlane.profile')));
check('quest completion shown on result', (await tid('quest-complete').count()) >= 1);
check('profile persisted', prof.matches === 5 && prof.wins === 3 && prof.coins > 150, JSON.stringify(prof));
await browser.close(); server.close();
console.log(failed ? `${failed} FAILED` : 'ALL PASS'); process.exit(failed ? 1 : 0);
