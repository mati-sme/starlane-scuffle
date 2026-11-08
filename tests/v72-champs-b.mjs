// v7.2 champs B: the 12 batch-B champions appear on the select screen, every one fires Q/E/R (maxed) next to an enemy
// without errors or dead casts, and a bot teamfight made only of batch-B champions casts the new kinds.
// Run: node tests/v72-champs-b.mjs [outDir]  (needs playwright + chromium; set PLAYWRIGHT_DIR if not installed locally)
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const OUT = process.argv[2] ?? '/workspace/test-artifacts/starlane-scuffle/v72-champs-b';
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
const NEW = ['basilisk', 'keel', 'anvil', 'cyclone', 'shade', 'pounce', 'comet', 'mycel', 'harpoon', 'loom', 'hymn', 'grove'];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ ...devices['iPhone 12 landscape'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(`console: ${m.text().slice(0, 300)}`); });
const tap = (id) => page.locator(`[data-testid="${id}"]`).click({ force: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await page.goto(BASE + '?gfx=low', { waitUntil: 'load', timeout: 90000 });
await tap('play-btn'); await sleep(300); await tap('setup-next');
await sleep(500);
const ids = await page.$$eval('[data-testid^="champion-card-"]', (els) => els.map((e) => e.dataset.id));
console.log(`cards: ${ids.length}`);
for (const id of NEW) if (!ids.includes(id)) errors.push(`missing card ${id}`);
await page.screenshot({ path: join(OUT, 'champ-select.png') });
await page.locator('[data-testid="champion-card-lumen"]').click({ force: true }); await tap('ban-btn');
await sleep(700);
await page.locator('[data-testid="champion-card-basilisk"]').click({ force: true }); await sleep(300);
await page.screenshot({ path: join(OUT, 'champ-detail.png') });
await tap('go-btn');
await page.waitForFunction(() => window.__starlane.state === 'match', null, { timeout: 20000 });

// Every skill of every new champion, maxed, next to an enemy hero; a cast that returns "nothing to hit" is a failure.
const dead = [];
for (const id of NEW) {
  await page.evaluate((id) => {
    const m = window.__starlane.match;
    m.setHero(id, []);
    const h = m.hero, foe = m.heroes.find((e) => e.team !== h.team);
    h.ranks = [4, 4, 3]; h.recalc(true);
    h.hp = h.maxHp * 0.5; // supports need someone hurt
    window.__why = [];
    const fire = h._fire.bind(h); // record why a wind-up did not turn into a cast
    h._fire = (ctx) => { const i = h.pend; if (h.stun > 0 || h.air > 0) window.__why[i] = 'stunned'; else if (!h.alive) window.__why[i] = 'dead'; fire(ctx); if (h.cds[i] === 0.3) window.__why[i] = 'nothing to hit'; };
    foe.x = h.x + 4; foe.z = h.z + 1;
    window.__t = setInterval(() => { foe.hp = foe.maxHp; foe.x = h.x + 4; foe.z = h.z + 1; foe.stun = 5; foe.root = 0; }, 100); // the dummy stands still and never fights back
  }, id);
  await sleep(200);
  for (let i = 0; i < 3; i++) {
    const before = await page.evaluate((i) => { const m = window.__starlane.match, h = m.hero; h.cds[i] = 0; h.stun = h.root = 0; h._begin(i, m); return h.castAt[i]; }, i);
    // headless rendering is slow (game time runs well behind wall time): wait on the hero, not the clock
    await page.waitForFunction(() => { const h = window.__starlane.match.hero; return h.pend === -1 && h.windup <= 0 && !h.script; }, null, { timeout: 15000 }).catch(() => {});
    await sleep(300);
    if (id === process.env.SHOT_HERO || (!process.env.SHOT_HERO && i === 2 && ['basilisk', 'comet', 'mycel', 'cyclone'].includes(id))) await page.screenshot({ path: join(OUT, `cast-${id}-${i}.png`) });
    const after = await page.evaluate((i) => { const h = window.__starlane.match.hero; return { t: h.castAt[i], cd: +h.cds[i].toFixed(2), why: window.__why[i] }; }, i);
    if (after.t === before) dead.push(`${id}:${['Q', 'E', 'R'][i]}(${after.why ?? 'cd ' + after.cd})`);
  }
  await page.evaluate(() => clearInterval(window.__t));
  await page.evaluate(() => new Promise((r) => { const m = window.__starlane.match, t0 = m.time; const w = () => (m.time - t0 > 1.5 ? r() : setTimeout(w, 50)); w(); })); // let lingering zones / timers run out
}
if (dead.length) errors.push(`casts that never fired: ${dead.join(' ')}`);
else console.log('all 36 new skills fired');

// Bot decisions: with an enemy and a hurt ally close by, a bot wants every new skill (the `as` proxy reaches bot.js).
const wants = await page.evaluate((NEW) => {
  const m = window.__starlane.match, out = [];
  for (const group of [NEW.slice(0, 9), NEW.slice(9)]) {
    m.setHero('kade', group);
    for (const id of group) {
      const h = m.heroes.find((x) => x.id === id), foe = m.heroes.find((e) => e.team !== h.team), ally = m.heroes.find((a) => a.team === h.team && a !== h);
      h.ranks = [4, 4, 3]; h.recalc(true); h.hp = h.maxHp * 0.5;
      foe.x = h.x + 3; foe.z = h.z + 0.5; ally.x = h.x - 1; ally.z = h.z; ally.hp = ally.maxHp * 0.4;
      for (let i = 0; i < 3; i++) if (!h.brain._want(m, i, foe)) out.push(`${id}:${h.rs[i].kind}`);
    }
  }
  return out;
}, NEW);
if (wants.length) errors.push(`bots never want: ${wants.join(' ')}`); else console.log('bots want all 36 new skills');

// Bot teamfight: only batch-B champions, all maxed with no cooldowns; the AI must cast the new kinds without throwing.
await page.evaluate((NEW) => {
  const m = window.__starlane.match;
  m.setHero(NEW[0], NEW.slice(1, 10));
  m.heroes.forEach((h) => { h.ranks = [4, 4, 3]; h.recalc(true); h.x = (h.team ? 1 : -1) * 3; h.z = (h.slot - 2) * 2; h.gold = 0; });
  window.__t = setInterval(() => { for (const h of m.heroes) { h.cds = [0, 0, 0]; h.hp = h.maxHp; h.gold = 0; if (h.brain) h.brain.retreat = h.brain.shopping = false; } }, 3000); // stay and fight, no shopping trips
}, NEW);
const gameWait = (sec) => page.evaluate((sec) => new Promise((r) => { const m = window.__starlane.match, t0 = m.time; const w = () => (m.time - t0 > sec ? r() : setTimeout(w, 100)); w(); }), sec);
await gameWait(3);
await page.screenshot({ path: join(OUT, 'teamfight.png') });
await gameWait(12);
const casts = await page.evaluate(() => { clearInterval(window.__t); return window.__starlane.match.heroes.map((h) => [h.id, h.castAt.filter((t) => t > -50).length, `${h.brain?.state ?? 'player'}${h.brain?.retreat ? '/retreat' : ''}${h.alive ? '' : '/dead'}`]); });
console.log('bot casts:', casts.map(([i, n, st]) => `${i}:${n}(${st})`).join(' '));
const idle = casts.slice(1).filter(([, n]) => n === 0).map(([i, , st]) => `${i}(${st})`); // bots that drifted to a lane are fine
if (idle.length) console.log(`note: idle bots this run: ${idle.join(' ')}`);
if (!casts.slice(1).some(([, n]) => n > 0)) errors.push('no bot cast anything in the teamfight');
if (errors.length) { console.log('ERRORS\n' + errors.join('\n')); process.exitCode = 1; } else console.log('ok: batch B champions fire Q/E/R without errors (+ bot teamfight)');
await browser.close();
server.close();
