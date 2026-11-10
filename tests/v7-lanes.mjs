// v7 stage A check: 3 towers per lane (outer / inner / inhibitor) + 2 guardians + Nexus per team, sequential vulnerability,
// lane-assigned bots, and an ally support that plays the bot lane instead of following the human. Offline, phone landscape.
// Run: node tests/v7-lanes.mjs [outDir]  (needs playwright + chromium)
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const OUT = process.argv[2] ?? '/workspace/test-artifacts/starlane-scuffle/v7';
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
const tap = (page, id) => page.locator(`[data-testid="${id}"]`).click({ force: true });

const ctx = await browser.newContext({ ...devices['iPhone 12 landscape'] });

await ctx.addInitScript(() => { try { localStorage.setItem("starlane.unlockAll", "true"); } catch {} }); // v8: every champion open for tests
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|WebSocket|ERR_/.test(m.text())) errors.push(`console: ${m.text().slice(0, 300)}`); });

await page.goto(BASE + '?gfx=low', { waitUntil: 'load', timeout: 90000 });
await tap(page, 'play-btn'); await tap(page, 'mode-ranked'); await page.locator('[data-testid="setup-next"]').click({ force: true, timeout: 4000 }).catch(() => {});
await page.locator('[data-testid="draft-title"]').waitFor();
// The player takes a shooter on purpose: the old support AI glued itself to the allied shooter, i.e. to the human.
const picks = await page.evaluate(async () => {
  const { HEROES } = await import('/js/heroes/index.js');
  const ids = [...document.querySelectorAll('[data-testid^="champion-card-"]')].map((e) => e.dataset.id);
  return { ban: ids[0], shooter: ids.find((id) => HEROES[id].role === 'shooter' && id !== ids[0]) };
});
await page.locator(`[data-testid="champion-card-${picks.ban}"]`).click({ force: true });
await tap(page, 'ban-btn');
await page.locator('[data-testid="spell-pick"]').waitFor();
await page.evaluate((id) => document.querySelector(`[data-testid="champion-card-${id}"]:not(:disabled)`)?.click(), picks.shooter);
await tap(page, 'go-btn');
await page.waitForFunction(() => window.__starlane.state === 'match', null, { timeout: 20000 });
await sleep(800);

// ---------------- structures ----------------
const S = await page.evaluate(() => {
  const m = window.__starlane.match, T = (team) => m.towers.filter((t) => t.team === team);
  const count = (team, tier) => T(team).filter((t) => t.tier === tier).length;
  const lanes = (team, tier) => T(team).filter((t) => t.tier === tier).map((t) => t.lane).sort().join();
  const spot = (team, tier, l) => { const t = T(team).find((t) => t.tier === tier && t.lane === l); return [t.x, t.z]; };
  const core = m.cores[0];
  const dist = (team, tier, l) => { const [x, z] = spot(team, tier, l); return Math.hypot(x - core.x, z - core.z); };
  return {
    total: m.towers.length, cores: m.cores.length, structs: m.structures.length,
    lane0: [0, 1].map((t) => ['outer', 'inner', 'inhib'].map((tier) => count(t, tier))),
    guards: [0, 1].map((t) => count(t, 'guard')),
    laneIds: ['outer', 'inner', 'inhib'].map((tier) => lanes(0, tier)),
    mirrored: ['outer', 'inner', 'inhib'].every((tier) => [0, 1, 2].every((l) => { const a = spot(0, tier, l), b = spot(1, tier, l); return Math.abs(a[0] + b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6; })),
    nearer: [0, 1, 2].every((l) => dist(0, 'outer', l) > dist(0, 'inner', l) && dist(0, 'inner', l) > dist(0, 'inhib', l)),
    pips: [...document.querySelectorAll('.pips .t0 i')].length,
  };
});
check('22 towers + 2 cores in play', S.total === 22 && S.cores === 2 && S.structs === 24, `${S.total} towers, ${S.cores} cores`);
check('each team: 3 outer + 3 inner + 3 inhib = 9 lane towers', S.lane0.every((l) => l.join() === '3,3,3'), JSON.stringify(S.lane0));
check('each team: 2 guardians', S.guards.join() === '2,2');
check('every tier covers top / mid / bot', S.laneIds.every((l) => l === '0,1,2'));
check('tiers mirrored across teams', S.mirrored);
check('outer -> inner -> inhib walks toward the nexus on every lane', S.nearer);
check('HUD pips: 9 lane + 2 guard + core', S.pips === 12, String(S.pips));

// ---------------- sequential vulnerability ----------------
const V = await page.evaluate(() => {
  const m = window.__starlane.match, T = (tier, l) => m.towers.find((t) => t.team === 1 && t.tier === tier && t.lane === l);
  const guards = m.towers.filter((t) => t.team === 1 && t.tier === 'guard'), core = m.cores[1];
  const kill = (t) => { t.alive = false; t.hp = 0; };
  const snap = () => {
    m._rules(0.01);
    const v = (t) => (t.alive && t.vulnerable ? 1 : 0); // open = standing and attackable
    return [[0, 1, 2].map((l) => v(T('outer', l))).join(''), [0, 1, 2].map((l) => v(T('inner', l))).join(''), [0, 1, 2].map((l) => v(T('inhib', l))).join(''), guards.map(v).join(''), v(core)].join(' ');
  };
  const out = { start: snap() };
  kill(T('outer', 0)); out.outerTop = snap();
  kill(T('inner', 0)); out.innerTop = snap();
  kill(T('inhib', 0)); out.inhibTop = snap();
  kill(guards[0]); out.oneGuard = snap();
  kill(guards[1]); out.bothGuards = snap();
  // a still-closed structure cannot be targeted
  const hero = m.hero; T('inner', 2).vulnerable = false;
  out.closedUntargetable = import('/js/game/targeting.js').then((tg) => tg.pickTarget(m, 0, T('inner', 2).x, T('inner', 2).z, 3, ['structures'])?.vulnerable !== false);
  return Promise.resolve(out.closedUntargetable).then((c) => { out.closedUntargetable = c; return out; });
});
check('start: only the 3 outers are open', V.start === '111 000 000 00 0', V.start);
check('top outer down -> only the top inner opens', V.outerTop === '011 100 000 00 0', V.outerTop);
check('top inner down -> top inhib opens, guards still shut', V.innerTop === '011 000 100 00 0', V.innerTop);
check('top inhib down -> both guardians open, nexus shut', V.inhibTop === '011 000 000 11 0', V.inhibTop);
check('one guardian down -> nexus still shut', V.oneGuard.endsWith(' 0'), V.oneGuard);
check('both guardians down -> nexus open', V.bothGuards.endsWith(' 1'), V.bothGuards);
check('an un-vulnerable structure is not a valid target', V.closedUntargetable);
await page.evaluate(() => window.__starlane.match.setHero(window.__starlane.match.heroId)); // fresh match for the AI checks
await sleep(300);

// ---------------- lane assignment + support AI ----------------
const A = await page.evaluate(() => {
  const m = window.__starlane.match;
  const row = (team) => m.heroes.filter((h) => h.team === team && h.brain).map((h) => `${h.def.role}:${h.brain.lane}`);
  return { player: m.hero.def.role, blue: row(0), red: row(1) };
});
const laneOfRole = (rows, role) => rows.filter((r) => r.startsWith(role + ':')).map((r) => r.split(':')[1]);
for (const [name, rows] of [['Sunny', A.blue], ['Gloom', A.red]]) {
  check(`${name} bots: melee top (0) / blaster mid (1) / support bot (2)`,
    laneOfRole(rows, 'blaster').every((l) => l === '1') && laneOfRole(rows, 'support').every((l) => l === '2') && [...laneOfRole(rows, 'tank'), ...laneOfRole(rows, 'bruiser')].some((l) => l === '0' || l === '3'), rows.join(' '));
}
check('player role is a shooter (the old glue target)', A.player === 'shooter', A.player);

const sup = await page.evaluate(() => {
  const m = window.__starlane.match, me = m.hero, dt = 1 / 30;
  const support = m.heroes.find((h) => h.team === 0 && h.brain && h.def.role === 'support');
  if (!support) return { none: true };
  m._intent = () => { // the human walks to the top lane and stays there
    const tx = -40, tz = -38, dx = tx - me.x, dz = tz - me.z, d = Math.hypot(dx, dz);
    return { x: d > 1 ? dx / d : 0, z: d > 1 ? dz / d : 0, attack: false, cast: [false, false, false], spell: [false, false], aim: [null, null, null], pref: 0, recall: false };
  };
  me.hp = me.maxHp = 99999; // the human stays alive and out of the way
  let follows = 0, minZ = Infinity, samples = 0, farFromPlayer = 0;
  const log = [];
  for (let i = 0; i < 30 * 70; i++) {
    m.update(dt);
    if (i % 15 === 0) {
      samples++;
      if (support.brain.goal.follow === me) follows++;
      if (support.alive) { minZ = Math.min(minZ, support.z); if (i > 30 * 30 && Math.hypot(support.x - me.x, support.z - me.z) > 25) farFromPlayer++; }
      if (i % 300 === 0) log.push(`${Math.round(m.time)}s me(${me.x | 0},${me.z | 0}) sup(${support.x | 0},${support.z | 0}) ${support.brain.state}`);
    }
  }
  return { follows, samples, farFromPlayer, lane: support.brain.lane, meZ: me.z, supZ: support.z, supX: support.x, log, over: m.over };
});
check('an ally support exists', !sup.none);
check('support assigned to bot lane (2)', sup.lane === 2, String(sup.lane));
check('support never sets follow = the player', sup.follows === 0, `${sup.follows}/${sup.samples}`);
check('player reached the top lane', sup.meZ < -25, `z=${Math.round(sup.meZ)}`);
check('support stayed near the bot lane (z > 8) while the player was at top', sup.supZ > 8, `z=${Math.round(sup.supZ)}`);
check('support was far from the player for most of the walk', sup.farFromPlayer > 10, String(sup.farFromPlayer));
console.log('  ', sup.log?.join(' | '));

// ---------------- overview screenshot ----------------
await page.evaluate(async () => {
  const m = window.__starlane.match, { CAM } = await import('/js/config.js');
  m.setHero(m.heroId);
  m.over = false;
  m.hero.hidden = true;
  CAM.zoom = 2.9; CAM.follow = 40; CAM.wideAspect = 99; // high overview
  const hide = document.createElement('style'); // clean map shot: canvas only
  hide.textContent = 'body > *:not(canvas) { display: none !important; }';
  document.head.append(hide);
  m.rig.follow({ x: -44, z: 0 });
  m.rig.zoom = CAM.zoom;
});
await sleep(2500);
await page.screenshot({ path: `${OUT}/map-3lanes.png` });
await page.evaluate(async () => {
  const m = window.__starlane.match;
  m.rig.follow({ x: 44, z: 0 });
});
await sleep(2500);
await page.screenshot({ path: `${OUT}/map-3lanes-gloom.png` });

check('no page errors', errors.length === 0, errors.join(' | '));
await browser.close(); server.close();
const pass = results.filter(Boolean).length;
console.log(`${pass}/${results.length} checks passed`);
process.exit(pass === results.length ? 0 : 1);
