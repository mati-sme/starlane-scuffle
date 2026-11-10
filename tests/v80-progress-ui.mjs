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
page.on('pageerror', (e) => console.log('PAGEERR', e.message));
const tid = (id) => page.locator(`[data-testid="${id}"]`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const check = (n, ok, x = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'} ${n} ${x}`); };

await page.goto(BASE + '?gfx=low', { waitUntil: 'load', timeout: 90000 });
check('title lists 3 daily quests', (await page.locator('[data-testid="quests-panel"] .quest').count()) === 3);
if (process.env.TSHOT) await page.screenshot({ path: process.env.TSHOT });
await tid('profile-btn').click({ force: true }); await tid('profile-root').waitFor({ timeout: 4000 });
check('profile screen: level/coins/badge wall', (await tid('profile-level').textContent()).includes('1') && (await page.locator('[data-testid^="badge-"][data-earned]').count()) >= 8 && (await tid('stat-champs').textContent()).includes('10/58'));
if (process.env.PSHOT) await page.screenshot({ path: process.env.PSHOT });
await tid('profile-back').click({ force: true }); await tid('play-btn').waitFor({ timeout: 4000 });
check('title shows level 1', (await tid('player-level').first().textContent()).includes('1'));
check('title shows 0 coins', (await tid('player-coins').first().textContent()).trim() === '0');
await tid('play-btn').click({ force: true }); await tid('mode-normal').click({ force: true }); await tid('setup-next').click({ force: true, timeout: 4000 }).catch(() => {});
await sleep(300);
const info = await page.$$eval('[data-testid^="champion-card-"]', (els) => els.map((e) => [e.dataset.id, e.dataset.locked]));
check('v9: pick grid shows only the 10 free champions', info.length === 10 && info.every(([, l]) => l === 'false'), String(info.length));
check('lumen + bulwark free', ['lumen', 'bulwark'].every((id) => info.find(([i]) => i === id)));
check('locked champion is not in the pick grid', (await tid('champion-card-granite').count()) === 0);
await tid('select-back').click({ force: true });
await tid('store-btn').click({ force: true }); await tid('store-card-granite').click({ force: true });
check('store: buy disabled with 0 coins', await tid('store-buy-btn').isDisabled());
// give coins, reload and buy in the store
await page.evaluate(() => localStorage.setItem('starlane.profile', JSON.stringify({ level: 3, xp: 5, coins: 250, owned: [], paid: 0, matches: 4, wins: 2, kills: 3, stars: 2 })));
await page.reload({ waitUntil: 'load' });
check('title shows saved coins + level', (await tid('player-coins').first().textContent()).trim() === '250' && (await tid('player-level').first().textContent()).includes('3'));
await tid('store-btn').click({ force: true }); await tid('store-card-granite').click({ force: true });
await tid('store-buy-btn').click({ force: true }); await sleep(300);
check('store: coins down to 150', (await tid('store-wallet').locator('.coins').textContent()).trim() === '150');
check('store: next price now 110', (await page.locator('[data-testid="store-price"]').first().textContent()).includes('110'));
await tid('store-back').click({ force: true });
await tid('play-btn').click({ force: true }); await tid('mode-normal').click({ force: true }); await tid('setup-next').click({ force: true, timeout: 4000 }).catch(() => {});
await tid('champion-card-granite').click({ force: true }); await sleep(200);
check('bought: GO available', (await tid('go-btn').count()) === 1);
// v8.2 skins: buy Frost (60) for granite, it equips and recolours
check('skin row shown for owned champ', (await tid('skin-row').count()) === 1);
const beforeCol = await page.evaluate(() => window.__starlane.match.hero.def.color);
await tid('skin-frost').click({ force: true }); await sleep(200);
check('skin bought: 60 coins spent (150 -> 90)', (await tid('select-wallet').locator('.coins').textContent()).trim() === '90');
check('frost equipped', (await tid('skin-frost').getAttribute('aria-pressed')) === 'true');
await tid('go-btn').click({ force: true });
await page.waitForFunction(() => window.__starlane.state === 'match', null, { timeout: 20000 });
await sleep(500);
if (process.env.MSHOT) await page.screenshot({ path: process.env.MSHOT });
const diff = await page.evaluate(async () => {
  const { HEROES, skinnedDef, ROSTER } = await import('/js/heroes/index.js');
  const sum = (m) => { let b = 0, r = 0; m.root.traverse((o) => { const a = o.isMesh && o.geometry?.attributes?.color; if (a) for (let i = 0; i < a.count; i++) { r += a.getX(i); b += a.getZ(i); } }); return [r, b]; };
  const out = {};
  for (const id of ['granite', 'nyx', 'bulwark', 'lumen', 'kade']) { const a = sum(HEROES[id].buildModel(0)), b = sum(skinnedDef(id, 'frost').buildModel(0)); out[id] = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]); }
  return out;
});
check('frost visibly recolours old + new champions', Object.values(diff).every((v) => v > 5), JSON.stringify(diff));
check('in-match model uses palette', await page.evaluate(() => !!window.__starlane.match.hero.model));
await page.evaluate(() => { const m = window.__starlane.match; m._st(m.hero).dmg = 700; m._st(m.hero).ko = 2; m.myKills = 2; });
await page.evaluate(() => window.__starlane.match._end(window.__starlane.match.myTeam === 0, 'core'));
await tid('rewards').waitFor({ timeout: 6000 });
const txt = await tid('rewards').textContent();
check('recap: MVP + highlight + damage bars + xp bar', (await tid('recap-mvp').count()) === 1 && (await tid('recap-highlight').textContent()).length > 5 && (await page.locator('[data-testid="recap-damage"] li').count()) >= 1 && (await tid('recap-xp').count()) === 1);
if (process.env.RSHOT) await page.screenshot({ path: process.env.RSHOT });
check('win rewards shown', /\+\d+/.test(txt) && txt.includes('XP'), txt.trim());
const prof = await page.evaluate(() => JSON.parse(localStorage.getItem('starlane.profile')));
check('quest completion shown on result', (await tid('quest-complete').count()) >= 1);
check('profile persisted', prof.matches === 5 && prof.wins === 3 && prof.coins > 90, JSON.stringify(prof));
await browser.close(); server.close();
console.log(failed ? `${failed} FAILED` : 'ALL PASS'); process.exit(failed ? 1 : 0);
