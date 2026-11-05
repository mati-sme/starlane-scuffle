// v5 stage B check: gold + auto gear, epic bosses, tough nexus, all-bot balance sim. Offline, phone landscape.
// Run: node tests/v5-stage-b.mjs [outDir] [sims]  (needs playwright + chromium)
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const OUT = process.argv[2] ?? '/workspace/test-artifacts/starlane-scuffle/v5';
const SIMS = Number(process.argv[3] ?? 1);
const PICK = 0;
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
const ctx = await browser.newContext({ ...devices['iPhone 12 landscape'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/favicon/.test(m.text())) errors.push(`console ${m.type()}: ${m.text().slice(0, 400)}`); });
const tap = (id) => page.locator(`[data-testid="${id}"]`).click({ force: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await page.goto(BASE + '?gfx=low', { waitUntil: 'load', timeout: 90000 });
await tap('play-btn');
await sleep(400);
await page.locator('[data-testid^="champion-card-"]').nth(PICK).click({ force: true });
await sleep(300);
await tap('go-btn');
await page.waitForFunction(() => window.__starlane.state === 'match', null, { timeout: 20000 });
await sleep(1500);


const S = (fn, arg) => page.evaluate(fn, arg);
const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); };
const shot = (n) => page.screenshot({ path: join(OUT, n) });

// helper installed in the page: step the sim without rendering
await S(() => {
  const m = window.__starlane.match;
  window.__step = (secs) => { for (let i = 0; i < secs * 30; i++) m.update(1 / 30); };
});

// 1. gold + auto gear: starting purse buys boots at the fountain, trickle + kills fill the slots over time
const g0 = await S(() => { const h = window.__starlane.match.hero; return { gold: h.gold, items: h.items.length }; });
await S(() => window.__step(2));
const g1 = await S(() => { const h = window.__starlane.match.hero; return { gold: Math.floor(h.gold), items: h.items.slice() }; });
check('boots auto-bought at fountain', g1.items.length === 1, JSON.stringify(g1));
await S(() => { const m = window.__starlane.match; m.heroes.forEach((h) => { h.gold += 6000; }); window.__step(1); });
const g2 = await S(() => { const h = window.__starlane.match.hero; return { items: h.items.length, hp: h.maxHp, armor: h.armor, gear: h.gear }; });
check('7 items bought with enough gold', g2.items === 7, JSON.stringify(g2));

// HUD shot with gold + slots (before any nexus fight ends the match)
await S(() => { const m = window.__starlane.match; m.heroes.forEach((h) => { h.gold = 0; h.items = []; h.recalc(true); }); m.hero.gold = 2300; window.__step(1); m.rig.focus.set(m.hero.x, 0.5, m.hero.z); });
await sleep(900);
await shot('shop-gear-hud.png');
const hud = await S(() => ({ gold: document.querySelector('[data-testid="gold"]').textContent, slots: [...document.querySelectorAll('.gear .slot.full')].length, next: document.querySelector('[data-testid="shop-next"] small').textContent }));
check('HUD shows gold + item slots', hud.slots >= 3 && /\d/.test(hud.gold), JSON.stringify(hud));

// 2. nexus: armor, hp, laser, pulse
const nx = await S(() => {
  const m = window.__starlane.match, c = m.cores[1], t = m.towers[0];
  return { core: c.maxHp, tower: t.maxHp, armor: c.armor, vuln: c.vulnerable };
});
check('nexus tougher than tower', nx.core >= 2.5 * nx.tower && nx.armor >= 40 && !nx.vuln, JSON.stringify(nx));
const pulse = await S(() => {
  const m = window.__starlane.match, c = m.cores[1];
  m.towers.filter((t) => t.team === 1).forEach((t) => { t.alive = false; t.hp = 0; t.top.visible = false; });
  window.__step(0.5);
  const hero = m.hero; hero.x = c.x - 6; hero.z = c.z; hero.hp = hero.maxHp = 99999;
  const v = c.vulnerable;
  const hp0 = c.hp;
  import('/js/game/combat.js').then(() => {});
  return { v, hp0 };
});
check('nexus exposed after guardians fall', pulse.v);
const pu = await S(async () => {
  const { dealDamage } = await import('/js/game/combat.js');
  const m = window.__starlane.match, c = m.cores[1];
  dealDamage(c, 500, m.hero);
  window.__step(0.1);
  const a = { pulseT: c.pulseT };
  const hp1 = c.hp; const hpb = hp1; dealDamage(c, 500, m.hero);
  return { ...a, first: c.maxHp - hp1, second: hp1 - c.hp };
});
check('shield pulse on first hit', pu.pulseT > 0, JSON.stringify(pu));
const lz = await S(() => {
  const m = window.__starlane.match, h = m.hero, c = m.cores[1];
  h.hp = h.maxHp = 5000; h.x = c.x - 6; h.z = c.z; let shots = 0;
  const f = m.projectiles.fire.bind(m.projectiles);
  m.projectiles.fire = (...a) => { if (a[0] === c) shots++; return f(...a); };
  window.__step(4);
  m.projectiles.fire = f;
  return { shots, hp: h.hp };
});
check('nexus laser fires at nearby hero', lz.shots >= 2, JSON.stringify(lz));

// 3. dragon fight: teleport the team to the pit, force spawn
await S(() => { const m = window.__starlane.match; m.setHero(m.heroId); m.time = 170; window.__step(1); });
const dr = await S(() => {
  const m = window.__starlane.match, d = m.camps.list.find((c) => c.boss === 'dragon');
  d.spawnAt = 0; window.__step(0.2);
  return { alive: d.alive, hp: d.hp, variant: d.variant };
});
check('dragon spawns', dr.alive, JSON.stringify(dr));
await S(() => {
  const m = window.__starlane.match;
  m.heroes.forEach((h) => { if (h.team === 0) { h.level = 6; h.recalc(true); } });
  m.heroes.filter((h) => h.team === 0).forEach((h, i) => { h.x = -3 + i * 1.5; h.z = 22 + (i % 2); });
  m.heroes.filter((h) => h.team === 1).forEach((h, i) => { h.x = 70; h.z = -3 + i; });
  m.hero.x = -2; m.hero.z = 23.5;
  window.__step(1.5);
  m.rig.follow(m.hero); m.hero.rx = m.hero.x; m.hero.rz = m.hero.z; m.rig.focus.set(m.hero.x, 0.5, m.hero.z - 2); for (let i = 0; i < 40; i++) m.rig.update(0.1, 2.2);
});
await sleep(900);
await shot('dragon-fight.png');
const kill = await S(() => {
  const m = window.__starlane.match, d = m.camps.list.find((c) => c.boss === 'dragon');
  const h = m.hero; h.x = d.x - 4; h.z = d.z;
  let steps = 0;
  while (d.alive && steps++ < 30 * 90) {
    m.heroes.filter((q) => q.team === 0).forEach((q, i) => { q.x = d.x - 4 + i * 0.8; q.z = d.z - 2; q.hp = q.maxHp; });
    m.update(1 / 30);
  }
  return { dead: !d.alive, t: steps / 30, buffs: m.buffs[0] };
});
check('dragon killable + team buff', kill.dead && (kill.buffs.fire + kill.buffs.ice + kill.buffs.gale) === 1 && kill.buffs.dragonT > 0, JSON.stringify(kill));

// 4. titan + herald effects
const tt = await S(() => {
  const m = window.__starlane.match;
  const he = m.camps.list.find((c) => c.boss === 'herald'), ti = m.camps.list.find((c) => c.boss === 'titan');
  m.time = 540; he.spawnAt = 0; window.__step(0.3);
  const spawnedH = he.alive;
  he.killer = m.hero; he.hp = 0; he.alive = false; he.dying = 0.25; import('/js/core/bus.js').then(({ bus }) => bus.emit('down', he));
  return { spawnedH };
});
check('herald spawns', tt.spawnedH);
await sleep(100);
const tt2 = await S(async () => {
  const { bus } = await import('/js/core/bus.js');
  const m = window.__starlane.match, ti = m.camps.list.find((c) => c.boss === 'titan');
  const heraldT = m.buffs[0].heraldT;
  ti.spawnAt = 0; window.__step(0.5);
  const a = ti.alive;
  ti.killer = m.hero; ti.hp = 0; ti.alive = false; ti.dying = 0.25; bus.emit('down', ti);
  return { heraldT, titanAlive: a, titanT: m.buffs[0].titanT, bonus: JSON.stringify(window.__bonus ?? null) };
});
check('herald buff + titan empower', tt2.heraldT > 0 && tt2.titanAlive && tt2.titanT > 0, JSON.stringify(tt2));

// 6. all-bot balance sims
for (let n = 0; n < SIMS; n++) {
  const r = await S(async () => {
    const { Bot } = await import('/js/game/bot.js');
    const m = window.__starlane.match;
    m.setHero(m.heroId);
    m.hero.brain = new Bot(m.hero); m.hero.isPlayer = false;
    const dt = 1 / 30;
    m._intent = () => m.hero.brain.think(dt, m);
    const bossKills = []; const { bus } = await import('/js/core/bus.js');
    bus.on('bossTaken', (e) => bossKills.push(`${e.kind}:${e.team}@${Math.round(m.time)}`));
    let steps = 0;
    while (!m.over && steps++ < 30 * 1100) m.update(dt);
    const gold = m.heroes.map((h) => h.items.length);
    return { over: m.over, time: Math.round(m.time), reason: m.rawReason, win: m.win, kills: m.kills, destroyed: m.destroyed, bossKills, items: gold.join(',') };
  });
  console.log('SIM', JSON.stringify(r));
}
check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close(); server.close();
if (results.some((x) => !x)) process.exit(1);
