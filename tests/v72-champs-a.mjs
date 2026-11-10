// v7.2 champs A: the 12 wave-2A champions are on the select screen, every Q/E/R casts without errors (and actually
// goes on cooldown, i.e. found something to do), and two bot teamfights made of the new champions run clean.
// Also saves a select-screen shot and an in-match line-up of the new bodies.
// Run: node tests/v72-champs-a.mjs [outDir]  (needs playwright + chromium)
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const OUT = process.argv[2] ?? '/workspace/test-artifacts/starlane-scuffle/v72-champs-a';
mkdirSync(OUT, { recursive: true });
const require = createRequire(import.meta.url);
let pw;
for (const p of [undefined, process.env.PLAYWRIGHT_DIR, '/tmp/pw/node_modules']) {
  try { pw = require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); break; } catch {}
}
if (!pw) throw new Error('playwright not found; set PLAYWRIGHT_DIR');
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
const NEW = ['granite', 'tidewall', 'embermaw', 'quill', 'wisp', 'razor', 'solace', 'brine', 'longshot', 'aurora', 'petal', 'beacon'];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ ...devices['iPhone 12 landscape'] });
await ctx.addInitScript(() => { try { localStorage.setItem("starlane.unlockAll", "true"); } catch {} }); // v8: every champion open for tests
const page = await ctx.newPage();
const errors = [], results = [];
const check = (name, ok, info = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`); };
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(`console: ${m.text().slice(0, 300)}`); });
const tap = (id) => page.locator(`[data-testid="${id}"]`).click({ force: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Ban -> pick -> GO through the real select flow, then swap in the exact line-up via match.setHero(id, bots).
async function start(hero, bots = [], gfx = 'low') {
  await page.goto(BASE + `?gfx=${gfx}`, { waitUntil: 'load', timeout: 90000 });
  await tap('play-btn'); await tap('mode-ranked'); await sleep(300); await tap('setup-next'); await sleep(300);
  await page.locator('[data-testid="champion-card-bulwark"]').click({ force: true }); await sleep(150);
  await tap('ban-btn'); await sleep(300);
  await page.locator('[data-testid="champion-card-magnus"]').click({ force: true }); await sleep(150);
  await tap('go-btn');
  await page.waitForFunction(() => window.__starlane.state === 'match', null, { timeout: 20000 });
  await page.evaluate(([id, b]) => window.__starlane.match.setHero(id, b.length ? b : undefined), [hero, bots]);
  await sleep(300);
}

await page.goto(BASE + '?gfx=low', { waitUntil: 'load', timeout: 90000 });
await tap('play-btn'); await tap('mode-ranked'); await sleep(300); await tap('setup-next');
await sleep(500);
const ids = await page.$$eval('[data-testid^="champion-card-"]', (els) => els.map((e) => e.dataset.id));
check('select screen lists all 12 new champions', NEW.every((id) => ids.includes(id)), `${ids.length} cards`);
await page.screenshot({ path: join(OUT, 'champ-select.png') });

// Fire every skill of each new champion (maxed) with an enemy and a hurt ally beside it.
async function fire(id) {
  await start(id);
  await page.evaluate(() => {
    const m = window.__starlane.match, h = m.hero, foe = m.heroes.find((e) => e.team !== h.team), ally = m.heroes.find((e) => e.team === h.team && e !== h);
    h.ranks = [3, 3, 3, 3]; h.recalc(true);
    const pin = () => { foe.hp = foe.maxHp; foe.x = h.x + 3.5; foe.z = h.z + 0.5; foe.stun = 0; foe.cds = [99, 99, 99]; foe.noAttack = true; ally.hp = ally.maxHp * 0.4; ally.x = h.x + 2; ally.z = h.z - 1.5; };
    pin(); window.__t = setInterval(pin, 150);
  });
  const out = [];
  for (let i = 0; i < 3; i++) {
    await page.evaluate((i) => { const m = window.__starlane.match, h = m.hero; h.cds[i] = 0; h.hp = h.maxHp; h.stun = h.air = 0; h._begin(i, m); }, i);
    // headless GL runs the sim slower than real time: wait for the wind-up (and any dash script) to resolve
    await page.waitForFunction(() => { const h = window.__starlane.match.hero; return h.pend === -1 && !h.script; }, null, { timeout: 15000 }).catch(() => {});
    out.push(await page.evaluate((i) => window.__starlane.match.hero.cds[i], i));
    await sleep(400);
  }
  await page.evaluate(() => clearInterval(window.__t));
  await sleep(1500); // let lingering zones / anims finish under the same page
  return out;
}
for (const id of NEW) {
  const before = errors.length, cds = await fire(id);
  check(`${id}: Q/E/R cast clean`, errors.length === before && cds.every((c) => c > 0.4), `cds ${cds.map((c) => c.toFixed(1)).join('/')}`);
}

// Bot teamfights: everyone maxed with no cooldowns; the AI must cast every new kind without throwing.
async function brawl(hero, bots, shot) {
  await start(hero, bots);
  await page.evaluate(() => {
    const m = window.__starlane.match;
    m.heroes.forEach((h, i) => { h.ranks = [3, 3, 3, 3]; h.recalc(true); h.x = (i < 5 ? -1 : 1) * 3; h.z = (i % 5 - 2) * 2; });
    window.__t = setInterval(() => { for (const h of m.heroes) { h.cds = [0, 0, 0]; h.hp = h.maxHp; } }, 3000);
  });
  await sleep(14000);
  if (shot) await page.screenshot({ path: join(OUT, shot), timeout: 90000 }).catch((e) => console.log('screenshot skipped:', e.message.split('\n')[0]));
  const casts = await page.evaluate(() => { clearInterval(window.__t); return window.__starlane.match.heroes.map((h) => [h.id, h.castAt.filter((t) => t > -50).length]); });
  console.log('bot casts:', casts.map(([i, n]) => `${i}:${n}`).join(' '));
  return casts;
}
const before = errors.length;
// The player slot has no brain, so every new champion goes in a bot slot.
const c1 = await brawl('bulwark', ['granite', 'tidewall', 'embermaw', 'quill', 'wisp', 'razor', 'solace', 'brine', 'longshot'], 'teamfight-a.png');
const c2 = await brawl('bulwark', ['aurora', 'petal', 'beacon', 'embermaw', 'longshot', 'granite', 'brine', 'solace', 'quill'], 'teamfight-b.png');
const cast = new Map();
for (const [i, n] of [...c1, ...c2]) cast.set(i, (cast.get(i) ?? 0) + n);
check('bot teamfights run clean', errors.length === before);
check('every new champion was cast by the AI', NEW.every((id) => cast.get(id) > 0), NEW.map((id) => `${id}:${cast.get(id) ?? 0}`).join(' '));

// Line-up: the 12 bodies side by side in-match, camera pulled in.
await start('granite', NEW.slice(1, 10), 'high');
await page.evaluate(() => {
  const m = window.__starlane.match;
  m.heroes.forEach((h, i) => { h.stun = 99; h.x = h.px = m.hero.x + (i - 4.5) * 2.1; h.z = h.pz = m.hero.z; h.face = 0; });
});
await sleep(1500);
await page.screenshot({ path: join(OUT, 'lineup.png') });

if (errors.length) console.log('ERRORS\n' + [...new Set(errors)].join('\n'));
const bad = results.filter((r) => !r).length;
console.log(bad || errors.length ? `FAILED (${bad} failed, ${errors.length} errors)` : 'ALL PASS');
await browser.close();
server.close();
process.exit(bad || errors.length ? 1 : 0);
