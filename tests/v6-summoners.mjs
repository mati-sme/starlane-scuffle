// v6 stage D check: summoner spells Flash / Barrier / Ignite. Select screen picker, HUD buttons + cooldowns, each spell's effect,
// and the online lobby (picks reach the host sim, the guest's Flash runs on the host). Needs playwright + chromium; online part needs `ws` (WS_DIR) or WS_URL.
// Run: node tests/v6-summoners.mjs [outDir]
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
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name} pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|WebSocket|ERR_/.test(m.text())) errors.push(`${name} console: ${m.text().slice(0, 300)}`); });
  return { ctx, page };
}


const num = (page, expr) => page.evaluate(expr);
const hero = (page) => `window.__starlane.match.hero`;
const until = (page, expr, ms = 30000) => page.waitForFunction(expr, null, { timeout: ms }).catch(() => {}); // headless GL runs the sim slowly: wait on state, not on time

// ---------------- offline ----------------
{
  const { ctx, page } = await open('offline');
  await page.goto(BASE + '?gfx=low', { waitUntil: 'load', timeout: 90000 });
  await tap(page, 'play-btn');
  await tid(page, 'draft-title').waitFor();
  const ids = await page.$$eval('[data-testid^="champion-card-"]', (els) => els.map((e) => e.dataset.id));
  await tid(page, `champion-card-${ids[3]}`).click({ force: true });
  await tap(page, 'ban-btn');
  await tid(page, 'spell-pick').waitFor();
  const chips = () => page.$$eval('.spchip', (els) => els.map((e) => `${e.dataset.spell}:${e.dataset.n}`).join(' '));
  check('select: 3 spell chips, kid labels', (await page.$$eval('.spchip b', (els) => els.map((e) => e.textContent).join())) === 'Flash,Barrier,Ignite');
  check('select: default Flash + Barrier', (await chips()) === 'flash:1 barrier:2 ignite:', await chips());
  await tap(page, 'spell-chip-ignite');
  check('select: tapping a 3rd swaps out the older pick', (await chips()) === 'flash: barrier:1 ignite:2', await chips());
  await tap(page, 'spell-chip-flash');
  check('select: always exactly two on', (await chips()) === 'flash:2 barrier: ignite:1', await chips());
  await page.screenshot({ path: `${OUT}/summoner-select.png` });
  const free = ids.filter((id) => id !== ids[3]);
  await page.evaluate((id) => document.querySelector(`[data-testid="champion-card-${id}"]:not(:disabled)`)?.click(), free.find((id) => id !== ids[3]));
  await tap(page, 'go-btn');
  await page.waitForFunction(() => window.__starlane.state === 'match', null, { timeout: 20000 });
  await sleep(600);
  check('match: hero carries the picked spells', (await num(page, `${hero(page)}.spells.join()`)) === 'ignite,flash');
  check('HUD: two spell buttons', (await page.$$eval('[data-testid^="spell-"]', (els) => els.map((e) => e.dataset.spell).join())) === 'ignite,flash');
  check('picks persist after reload (save)', (await page.evaluate(() => localStorage.getItem('starlane.spells'))) === '["ignite","flash"]');

  // Ignite: nobody near = no cooldown + a note; with a foe in range = a burn that hurts
  await tap(page, 'spell-1');
  await until(page, `document.querySelector('[data-testid="no-target"]').textContent === 'No target'`);
  check('ignite with no target spends no cooldown', (await num(page, `${hero(page)}.spellCd[0]`)) <= 0);
  check('ignite with no target says so', (await text(page, 'no-target')) === 'No target');
  await page.evaluate(() => { const m = window.__starlane.match, h = m.hero, e = m.heroes.find((x) => x.team === 1); window.__foe = e; e.x = e.px = h.x + 3; e.z = e.pz = h.z; });
  const hp0 = await num(page, 'window.__foe.hp');
  await tap(page, 'spell-1');
  await until(page, `${hero(page)}.spellCd[0] > 0`);
  check('ignite sets a burn on the foe', await num(page, '!!window.__foe.burn'));
  check('ignite goes on cooldown (60-90s)', await num(page, `${hero(page)}.spellCd[0] > 60 && ${hero(page)}.spellCd[0] <= 90`), String(await num(page, `${hero(page)}.spellCd[0]`)));
  await until(page, 'window.__foe.hp < ' + hp0);
  check('burn deals damage over time', (await num(page, 'window.__foe.hp')) < hp0, `${hp0} -> ${await num(page, 'window.__foe.hp')}`);
  check('cooldown wipe + digits on the button', (await text(page, 'spell-1')).trim().length > 0 && (await tid(page, 'spell-1').evaluate((e) => e.querySelector('.cd').style.getPropertyValue('--p'))) !== '0');

  // Flash: a ~4 unit blink
  await page.evaluate(() => { const h = window.__starlane.match.hero; window.__p0 = [h.x, h.z]; });
  await tap(page, 'spell-2');
  await until(page, `${hero(page)}.spellCd[1] > 0 && !${hero(page)}.script`);
  const d = await num(page, `Math.hypot(${hero(page)}.x - window.__p0[0], ${hero(page)}.z - window.__p0[1])`);
  check('flash blinks about 4 units', d > 3 && d < 4.6, d.toFixed(2));
  check('flash on cooldown (90-120s)', await num(page, `${hero(page)}.spellCd[1] > 90 && ${hero(page)}.spellCd[1] <= 120`));

  // Barrier + the default HUD for the screenshot
  await page.evaluate(() => { const h = window.__starlane.match.hero; h.spells = ['flash', 'barrier']; h.spellCd = [0, 0]; });
  await until(page, `document.querySelector('[data-testid="spell-2"]').dataset.spell === 'barrier'`);
  await tap(page, 'spell-2');
  await until(page, `${hero(page)}.spellCd[1] > 0`);
  check('barrier gives a shield', await num(page, `${hero(page)}.shieldHp > 100 && ${hero(page)}.shieldT > 2 && ${hero(page)}.shieldT <= 3`));
  check('barrier on cooldown (90-120s)', await num(page, `${hero(page)}.spellCd[1] > 90 && ${hero(page)}.spellCd[1] <= 120`));
  await page.evaluate(() => { const h = window.__starlane.match.hero; h.spellCd[0] = 37; h.spellCdTotal[0] = 100; }); // one ready, one cooling: both states in the shot
  await sleep(200);
  await page.screenshot({ path: `${OUT}/summoners.png` });
  check('HUD buttons both on screen', await page.evaluate(() => [...document.querySelectorAll('[data-testid^="spell-"]')].every((e) => { const r = e.getBoundingClientRect(); return r.width > 30 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; })));
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
  const ids = await host.page.$$eval('[data-testid^="lobby-champ-"]', (els) => els.map((e) => e.dataset.id));
  for (const [g, k] of [[host, 0], [guest, 1]]) { await tap(g.page, `lobby-champ-${ids[k]}`); await tap(g.page, 'ban-btn'); }
  for (const g of [host, guest]) await g.page.waitForFunction(() => document.querySelector('[data-testid="draft-title"]')?.textContent.includes('Pick'), null, { timeout: 8000 });
  const chips = (g) => g.page.$$eval('.spchip', (els) => els.map((e) => `${e.dataset.spell}:${e.dataset.n}`).join(' '));
  check('lobby: spell picker on both screens, default Flash + Barrier', await chips(host) === 'flash:1 barrier:2 ignite:' && await chips(guest) === 'flash:1 barrier:2 ignite:');
  await tap(host.page, 'spell-chip-ignite'); // host: barrier, ignite
  await tap(guest.page, 'spell-chip-ignite'); // guest: barrier, ignite -> then flash: ignite, flash
  await tap(guest.page, 'spell-chip-flash');
  await sleep(500);
  check('lobby: host picks barrier + ignite', await chips(host) === 'flash: barrier:1 ignite:2', await chips(host));
  check('lobby: guest picks ignite + flash', await chips(guest) === 'flash:2 barrier: ignite:1', await chips(guest));
  await guest.page.screenshot({ path: `${OUT}/summoner-lobby.png` });
  await tap(host.page, `lobby-champ-${ids[5]}`);
  await tap(guest.page, `lobby-champ-${ids[6]}`);
  await host.page.waitForFunction(() => { const b = document.querySelector('[data-testid="start-btn"]'); return b && !b.disabled; }, null, { timeout: 10000 });
  await tap(host.page, 'start-btn');
  await Promise.all([host, guest].map((g) => g.page.waitForFunction(() => window.__starlane.state === 'match', null, { timeout: 30000 })));
  await sleep(800);
  const sp = (g, who) => g.page.evaluate((w) => window.__starlane.match[w]?.spells.join(), who);
  check('host sim: host hero spells', await sp(host, 'hero') === 'barrier,ignite', await sp(host, 'hero'));
  check('host sim: guest hero spells', await sp(host, 'peerHero') === 'ignite,flash', await sp(host, 'peerHero'));
  check('guest: own spells', await sp(guest, 'hero') === 'ignite,flash', await sp(guest, 'hero'));
  check('guest HUD buttons match', (await guest.page.$$eval('[data-testid^="spell-"]', (els) => els.map((e) => e.dataset.spell).join())) === 'ignite,flash');
  await host.page.evaluate(() => { const p = window.__starlane.match.peerHero; window.__q0 = [p.x, p.z]; });
  await tap(guest.page, 'spell-2'); // guest Flash: runs on the host (headless GL runs the sim slowly, so wait on state, not on time)
  await host.page.waitForFunction(() => { const p = window.__starlane.match.peerHero; return p.spellCd[1] > 0 && !p.script; }, null, { timeout: 30000 }).catch(() => {});
  const hd = await host.page.evaluate(() => { const p = window.__starlane.match.peerHero; return [Math.hypot(p.x - window.__q0[0], p.z - window.__q0[1]), p.spellCd[1]]; });
  check('guest Flash is applied by the host sim', hd[0] > 3 && hd[0] < 4.8 && hd[1] > 90, `${hd[0].toFixed(2)} cd ${hd[1].toFixed(1)}`);
  await host.page.evaluate(() => { const m = window.__starlane.match, p = m.peerHero, e = m.heroes.find((x) => x.team !== p.team); window.__e = e; e.x = e.px = p.x + 3; e.z = e.pz = p.z; p.spellCd[0] = 0; });
  await tap(guest.page, 'spell-1'); // guest Ignite on a foe
  await host.page.waitForFunction(() => window.__e.burn || window.__e.hp < window.__e.maxHp, null, { timeout: 30000 }).catch(() => {});
  check('guest Ignite burns on the host', await host.page.evaluate(() => !!window.__e.burn));
  await host.ctx.close(); await guest.ctx.close();
} catch (e) {
  check('online spells', false, String(e).slice(0, 300));
}

await browser.close();
server.close();
local?.close();
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); }
const bad = results.filter((r) => !r).length;
console.log(bad || errors.length ? `FAILED (${bad} failed, ${errors.length} errors)` : 'ALL PASS');
process.exit(bad || errors.length ? 1 : 0);
