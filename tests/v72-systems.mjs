// v7.2 factions, class info, matchups, season events.
// Run: node tests/v72-systems.mjs  (needs playwright + chromium)
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
const ctx = await browser.newContext({ ...devices['iPhone 12 landscape'] });
await ctx.addInitScript(() => { try { localStorage.setItem("starlane.unlockAll", "true"); } catch {} }); // v8: every champion open for tests
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
await page.goto(BASE + '?gfx=low', { waitUntil: 'load', timeout: 90000 });

// data: 48 ids, 12 each; matchups for every live champion
const data = await page.evaluate(async () => {
  const f = await import('./js/game/factions.js'), m = await import('./js/game/matchups.js'), { HEROES, ROSTER } = await import('./js/heroes/index.js');
  const incoming = 'granite tidewall embermaw quill wisp razor solace brine longshot aurora petal beacon basilisk keel anvil cyclone shade pounce comet mycel harpoon loom hymn grove'.split(' ');
  const all = [...ROSTER, ...incoming], count = {};
  for (const id of all) count[f.factionOf(id)] = (count[f.factionOf(id)] ?? 0) + 1;
  const bad = ROSTER.filter((id) => { const x = m.matchupsOf(id); return x.strong.length !== 3 || x.weak.length !== 3 || x.strong.some((o) => x.weak.includes(o) || o === id); });
  return { n: new Set(all).size, count, bad, sample: ['bulwark', 'nyx', 'rime'].map((id) => [id, m.matchupsOf(id)]) };
});
check('48 unique ids', data.n === 48, String(data.n));
check('12 per faction', Object.values(data.count).join() === '12,12,12,12', JSON.stringify(data.count));
check('every live champion has 3 strong + 3 weak, disjoint', data.bad.length === 0, data.bad.join());
console.log(JSON.stringify(data.sample));

await tap(page, 'play-btn');
await tid(page, 'setup-next').waitFor();
await tap(page, 'setup-next');
await tid(page, 'draft-title').waitFor();
await tid(page, 'champion-card-nyx').click({ force: true });
check('card shows faction chip', (await tid(page, 'champion-card-nyx').locator('.fchip').textContent()).includes('Dark'));
check('detail shows faction + passive + role line', (await tid(page, 'detail-faction').textContent()).includes('Dark')
  && (await tid(page, 'detail-passive').textContent()).includes('Sneaky') && (await tid(page, 'detail-role-blurb').textContent()).includes('Blaster'));
check('detail shows 3 strong + 3 weak', (await page.locator('[data-testid="matchup-strong"] .mp').count()) === 3 && (await page.locator('[data-testid="matchup-weak"] .mp').count()) === 3);
await page.screenshot({ path: '/tmp/v72-systems-select.png' });
await tap(page, 'ban-btn');
await sleep(300);
await page.locator('[data-testid^="champion-card-"]:not([disabled])').first().click({ force: true });
await tap(page, 'go-btn');
await page.waitForFunction(() => window.__starlane.state === 'match', null, { timeout: 20000 });
await sleep(600);

// season: force Storm, check multipliers, banner, icons; then expiry and guest-without-field
const r = await page.evaluate(async () => {
  const m = window.__starlane.match, { SEASON_IDS } = await import('./js/game/seasons.js');
  const w = m.heroes.find((h) => h.faction === 'water'), n = m.heroes.find((h) => h.faction === 'nature');
  const base = m.heroes.map((h) => h.outMul);
  m.seasons.id = 'storm'; m.seasons.left = 45;
  const { bus } = await import('./js/core/bus.js'); bus.emit('season', 'storm');
  const t0 = m.time; for (let i = 0; i < 60 && m.time - t0 < 0.5; i++) await new Promise((r) => setTimeout(r, 250));
  const out = { w: w ? w.outMul / w.baseOut : null, n: n ? n.outMul / n.baseOut : null, wIn: w?.inMul, nIn: n?.inMul,
    banner: document.querySelector('[data-testid="season-banner"]').classList.contains('on'), left: m.seasons.left, enc: m.seasons.encode() };
  const t = m.seasons.left;
  m.seasons.decode(undefined);
  out.guestNone = m.seasons.id === null;
  m.seasons.id = null;
  out.rolls = m.seasons.update(300, 0.1) && SEASON_IDS.includes(m.seasons.id);
  m.seasons.id = null;
  return out;
});
check('storm: Water +15% / Nature weaker', r.w == null || Math.abs(r.w - 1.15) < 0.01, JSON.stringify(r));
check('storm: Nature weaker', r.n == null || Math.abs(r.n - 0.87) < 0.01);
check('banner shows with countdown', r.banner && r.left < 45);
check('guest with no season field = no event', r.guestNone);
check('season rolls at 5:00', r.rolls);
check('no page errors', errors.length === 0, errors.join(' | '));
await browser.close(); server.close();
process.exit(results.every(Boolean) ? 0 : 1);
