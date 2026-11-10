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
const SHOTS = process.env.SHOTS; // dir: also write the after-*.png screenshots there
const launch = (b) => b.launch(process.env.DEFAULT_GL || b === pw.webkit ? {} : { args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const browser = await launch(chromium);

const geo = (page) => page.evaluate(() => {
  const g = document.querySelector('[data-testid="champion-grid"]'), d = document.querySelector('[data-testid="champion-detail"]');
  const gr = g.getBoundingClientRect(), dr = d.getBoundingClientRect(), vh = innerHeight;
  const cards = [...g.querySelectorAll('.hcard')];
  return { n: cards.length, left: gr.right <= dr.left + 1, scroll: g.scrollHeight > g.clientHeight + 4, gh: gr.height, vh, bottom: gr.bottom,
    cardH: Math.min(...cards.map((c) => c.getBoundingClientRect().height)), overflowY: getComputedStyle(g).overflowY, detailH: dr.height, dBottom: dr.bottom };
});
const detailOk = async (page) => {
  const t = (id) => tid(page, id).first().textContent();
  const name = await t('detail-name'), role = await t('detail-role'), blurb = await t('detail-role-blurb');
  const bars = await page.locator('[data-testid="detail-stats"] .stat').count(), skills = await page.locator('.detail .skills li').count();
  const vis = await page.locator('[data-testid="detail-stats"]').isVisible();
  return { name, role, blurb, bars, skills, vis, passive: !!(await t('detail-passive')), matchups: await page.locator('.detail .mrow').count() };
};
async function open(device, name, shot) {
  const ctx = await browser.newContext(device);
  await ctx.addInitScript(() => { try { localStorage.setItem("starlane.unlockAll", "true"); } catch {} }); // v8: every champion open for tests
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name} pageerror: ${e.message}`));
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/favicon|WebSocket|ERR_/.test(m.text())) errors.push(`${name} console: ${m.text().slice(0, 300)}`); });
  await page.goto(BASE + '?gfx=low', { waitUntil: 'load', timeout: 90000 });
  await tap(page, 'play-btn'); await tap(page, 'mode-ranked');
  await tid(page, 'setup-next').waitFor();
  await tap(page, 'setup-next');
  await tid(page, 'draft-title').waitFor();
  // ban screen: timer ~12s, grid + detail layout
  const t = parseInt(await tid(page, 'draft-timer').textContent(), 10);
  check(`${name}: ban timer starts ~12s`, t >= 11 && t <= 13, `${t}s`);
  const ids = await page.$$eval('[data-testid^="champion-card-"]', (els) => els.map((e) => e.dataset.id));
  check(`${name}: 48 champions in the grid`, ids.length === 48, String(ids.length));
  let g = await geo(page);
  check(`${name}: grid is a left pane that scrolls`, g.left && g.scroll && g.overflowY === 'auto', JSON.stringify(g));
  check(`${name}: cards keep a real height (rows do not collapse)`, g.cardH >= 70, `${g.cardH}`);
  await page.locator('[data-testid="champion-grid"]').evaluate((e) => { e.scrollTop = e.scrollHeight; });
  const lastId = ids[ids.length - 1];
  check(`${name}: last card reachable by scrolling`, await page.evaluate((id) => { const c = document.querySelector(`[data-testid="champion-card-${id}"]`).getBoundingClientRect(), r = document.querySelector('[data-testid="champion-grid"]').getBoundingClientRect(); return c.bottom <= r.bottom + 2 && c.top >= r.top - 2; }, lastId));
  await page.locator('[data-testid="champion-grid"]').evaluate((e) => { e.scrollTop = 0; });
  await tid(page, `champion-card-${ids[5]}`).click({ force: true });
  const d = await detailOk(page);
  check(`${name}: detail pane filled (name, role, blurb, skills, stats, passive, matchups)`, d.name && d.role && d.blurb.length > 10 && d.skills === 4 && d.bars === 5 && d.vis && d.passive && d.matchups === 2, JSON.stringify(d));
  check(`${name}: BAN button reachable inside viewport`, await page.evaluate(() => { const r = document.querySelector('[data-testid="ban-btn"]').getBoundingClientRect(); return r.bottom <= innerHeight && r.top >= 0; }));
  await tap(page, 'ban-btn');
  await page.waitForSelector('[data-testid="go-btn"]', { timeout: 3000 });
  check(`${name}: offline BAN goes straight to pick (no timer wait)`, true);
  const pick = await page.locator('[data-testid^="champion-card-"]:not([disabled])').nth(3);
  await pick.click({ force: true });
  await sleep(500);
  check(`${name}: pick-phase detail filled`, (await detailOk(page)).skills === 4);
  if (shot && SHOTS) await page.screenshot({ path: `${SHOTS}/${shot}.png`, timeout: 120000 });
  return { ctx, page };
}

// fake two-player online lobby straight through menus.showLobby
async function lobby(device, name, shot) {
  const ctx = await browser.newContext(device);
  await ctx.addInitScript(() => { try { localStorage.setItem("starlane.unlockAll", "true"); } catch {} }); // v8: every champion open for tests
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name} pageerror: ${e.message}`));
  await page.goto(BASE + '?gfx=low', { waitUntil: 'load', timeout: 90000 });
  await page.evaluate(async () => {
    const m = window.__starlane.menus;
    window.__banId = (await import('/js/heroes/index.js')).ROSTER[1];
    window.__calls = [];
    const players = [{ slot: 0, name: 'Matias', team: 0, hero: null, ban: null, connected: true }, { slot: 1, name: 'Son', team: 1, hero: 'bulwark', ban: null, connected: true }];
    window.__lobby = (stage, banSel, hero) => {
      players[0].hero = hero;
      m.showLobby({ code: 'ABCD', link: 'https://example.test/?room=ABCD', me: 0, players, phase: 'lobby', stage, bans: stage === 'pick' ? [window.__banId] : [], banSel, spells: ['flash', 'barrier'], deadline: performance.now() + 12000, conn: 'open', error: '', setup: null },
        { onTeam() {}, onHero: (h) => { window.__calls.push(['hero', h]); window.__lobby('pick', null, h); }, onBanSel: (h) => { window.__calls.push(['sel', h]); window.__lobby('ban', h, null); }, onBan() {}, onSpells() {}, onStart() {}, onCopy() {}, onLeave() {}, onTimeout() {}, onSetup() {} });
    };
    window.__lobby('ban', null, null);
  });
  const t = parseInt(await tid(page, 'draft-timer').textContent(), 10);
  check(`${name}: lobby ban timer shows`, t > 0 && t <= 13, `${t}s`);
  let g = await geo(page);
  check(`${name}: lobby has 48 cards, left scrollable grid + right detail`, g.n === 48 && g.left && g.scroll && g.overflowY === 'auto' && g.cardH >= 70, JSON.stringify(g));
  check(`${name}: lobby grid is on screen (not collapsed)`, g.gh > 120 && g.bottom <= g.vh + 1, `${g.gh}`);
  const id = await page.$$eval('[data-testid^="lobby-champ-"]', (els) => els[7].dataset.id);
  await tid(page, `lobby-champ-${id}`).click({ force: true });
  check(`${name}: tapping a lobby card updates the pane (ban select)`, (await detailOk(page)).skills === 4 && !(await tid(page, 'ban-btn').isDisabled()));
  await page.evaluate(() => window.__lobby('pick', null, null));
  await tid(page, `lobby-champ-${id}`).click({ force: true });
  const d = await detailOk(page);
  check(`${name}: pick stage shows detail for picked champion`, d.name && d.role && d.skills === 4 && d.bars === 5 && d.vis, JSON.stringify(d));
  check(`${name}: banned stamp + taken stamp kept`, await page.evaluate(() => !!document.querySelector('.hcard.out.banned') && !!document.querySelector('.hcard.out.taken')));
  check(`${name}: room code, teams and spell chips present`, await page.evaluate(() => ['room-code', 'team-sunny', 'team-gloom', 'spell-chip-flash', 'copy-link', 'start-btn'].every((t) => document.querySelector(`[data-testid="${t}"]`))));
  await page.evaluate(() => window.__lobby('pick', null, 'bulwark'));
  await page.locator('[data-testid="champion-grid"]').evaluate((e) => { e.scrollTop = 0; });
  if (shot && SHOTS) await page.screenshot({ path: `${SHOTS}/${shot}.png`, timeout: 120000 });
  return { ctx, page };
}

const IPHONE = devices['iPhone 12 landscape'];
const DESK = { viewport: { width: 1400, height: 900 } };
for (const [dev, name, shot] of [[DESK, 'desktop', 'after-select-desktop'], [IPHONE, 'phone', 'after-select-phone']]) {
  const { ctx } = await open(dev, name, shot);
  await ctx.close();
}
for (const [dev, name, shot] of [[DESK, 'desktop-lobby', 'after-lobby-online'], [IPHONE, 'phone-lobby', SHOTS ? 'after-lobby-phone' : '']]) {
  const { ctx } = await lobby(dev, name, shot);
  await ctx.close();
}
// iPad: webkit if the host can launch it, else chromium with the same descriptor
{
  let b = browser, note = 'chromium';
  try { const w = await launch(pw.webkit); b = w; note = 'webkit'; } catch { /* host libs missing */ }
  const dev = devices['iPad Pro 11 landscape'];
  const ctx = await b.newContext(dev), page = await ctx.newPage();
  await ctx.addInitScript(() => { try { localStorage.setItem("starlane.unlockAll", "true"); } catch {} }); // v8: every champion open for tests
  page.on('pageerror', (e) => errors.push(`ipad pageerror: ${e.message}`));
  await page.goto(BASE + '?gfx=low', { waitUntil: 'load', timeout: 90000 });
  await tap(page, 'play-btn'); await tap(page, 'mode-ranked'); await tid(page, 'setup-next').waitFor(); await tap(page, 'setup-next'); await tid(page, 'draft-title').waitFor();
  const ids = await page.$$eval('[data-testid^="champion-card-"]', (els) => els.map((e) => e.dataset.id));
  await tid(page, `champion-card-${ids[2]}`).click({ force: true });
  const g = await geo(page);
  check(`ipad (${note}): left scrollable grid + detail`, g.n === 48 && g.left && g.scroll, JSON.stringify(g));
  await tap(page, 'ban-btn'); await page.waitForSelector('[data-testid="go-btn"]');
  await page.locator('[data-testid^="champion-card-"]:not([disabled])').nth(4).click({ force: true });
  await sleep(400);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/after-select-ipad-webkit.png`, timeout: 120000 });
  console.log('ipad browser:', note);
  await ctx.close();
}
check('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();
server.close();
console.log(results.every(Boolean) ? 'ALL PASS' : 'FAILURES');
process.exit(results.every(Boolean) ? 0 : 1);
