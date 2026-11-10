// v7.4.1 bot navigation (pure Node, no browser): the real Bot._steer + real COVER / pushOutCover drive a stub hero.
// Checks: a bot goes around a known block to the far side; bots walk every lane path end to end; hundreds of random
// cross-map trips arrive; and no bot with a goal is stationary for > 3 s. The old straight-line steering is run too,
// to prove the test can actually see the bug.
// Run: node tests/v741-bot-nav.mjs
import { register } from 'node:module';
// bot.js -> combat.js -> render code needs `three`; _steer uses none of the combat / shop / targeting helpers, so stub just those
// three modules (the real Bot._steer, arena COVER and nav run unchanged).
const stub = 'export const forEachAlly=()=>{},forEachEnemy=()=>{},nextItem=()=>null,atBase=()=>false,pickTarget=()=>null,bestCluster=()=>null;';
const hook = `export async function resolve(s, c, n) { return /\\/(combat|gear|targeting)\\.js$/.test(s) ? { url: 'data:text/javascript,${stub}', shortCircuit: true } : n(s, c); }`;
register('data:text/javascript,' + encodeURIComponent(hook));
const { Bot } = await import('../js/game/bot.js');
const { COVER, PATHS, pushOutCover, inCover } = await import('../js/world/arena.js');
const { MAP } = await import('../js/config.js');

let fail = 0;
const ok = (name, c, info = '') => { console.log(`${c ? 'PASS' : 'FAIL'} ${name} ${info}`); if (!c) fail = 1; };
let seed = 12345; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const CTX = { structures: [], minions: { list: [] }, heroes: [] };

function mkBot(x, z) {
  const h = { x, z, radius: 0.5, speed: 4.2, alive: true, team: 0, points: 0, hp: 1, maxHp: 1, basic: { range: 2.5 }, def: { role: 'bruiser' } };
  const b = new Bot(h, 'mid'); b.goal = { x, z, follow: null, keep: 0.4 };
  return { h, b };
}
// Walk to (gx, gz) for up to `maxT` s; `straight` replaces the bot's steering with the old walk-straight-at-it behaviour.
function run(sx, sz, gx, gz, { maxT = 60, straight = false } = {}) {
  const { h, b } = mkBot(sx, sz);
  b.goal.x = gx; b.goal.z = gz;
  const dt = 1 / 30, hist = []; let t = 0, worstStill = 0, still = 0, lx = sx, lz = sz;
  while (t < maxT) {
    if (Math.hypot(h.x - gx, h.z - gz) < 0.8) return { ok: true, t, worstStill };
    if (straight) { const d = Math.hypot(gx - h.x, gz - h.z); b.it.x = (gx - h.x) / d; b.it.z = (gz - h.z) / d; } else b._steer(dt, CTX);
    h.x += b.it.x * h.speed * dt; h.z += b.it.z * h.speed * dt;
    pushOutCover(h, h.radius * 0.8);
    h.x = Math.max(-MAP.heroBound.x, Math.min(MAP.heroBound.x, h.x)); h.z = Math.max(-MAP.heroBound.z, Math.min(MAP.heroBound.z, h.z));
    t += dt;
    hist.push([h.x, h.z]); if (hist.length > 30) hist.shift(); // 1 s window
    still = hist.length === 30 && Math.hypot(h.x - hist[0][0], h.z - hist[0][1]) < 0.3 ? still + dt : 0;
    worstStill = Math.max(worstStill, still);
    void lx; void lz;
  }
  return { ok: false, t, worstStill };
}

// 1. focused (v9.1 map, 0.7x): the tall block at (-14, -18.2) is 1.6 wide, 7 tall; start on its west face, goal on the east face.
{
  const r = run(-17.4, -18.2, -10.6, -18.2, { maxT: 20 });
  ok('far side of the (-14,-18.2) block reached', r.ok, `${r.t.toFixed(1)}s`);
  const r2 = run(-10.6, -18.2, -17.4, -18.2, { maxT: 20 });
  ok('...and back again', r2.ok, `${r2.t.toFixed(1)}s`);
  const wide = run(-30.8, -14, -30.8, -19.6, { maxT: 20 });
  ok('around the wide (-30.8,-16.8) wall', wide.ok, `${wide.t.toFixed(1)}s`);
}

// 2. a face-to-face trip across every cover block (4 mirrors included), both directions
{
  let bad = 0, n = 0;
  for (const b of COVER) for (const [ox, oz] of [[1, 0], [0, 1]]) {
    const m = 3;
    const a = [b.cx - ox * (b.w / 2 + m), b.cz - oz * (b.d / 2 + m)], c = [b.cx + ox * (b.w / 2 + m), b.cz + oz * (b.d / 2 + m)];
    if (inCover(...a) || inCover(...c)) continue;
    for (const [p, q] of [[a, c], [c, a]]) { n++; const r = run(p[0], p[1], q[0], q[1], { maxT: 25 }); if (!r.ok || r.worstStill > 3) { bad++; console.log('  stuck', p, q, r); } }
  }
  ok(`around all ${n} block-face crossings`, bad === 0, `${bad} failed`);
}

// 3. lane paths, each team, each lane: waypoint to waypoint like the bot's lane goal does
{
  let bad = 0;
  for (const team of PATHS) for (const lane of team) {
    let { x, z } = lane.pts[0];
    for (const p of lane.pts.slice(1)) { const r = run(x, z, p.x, p.z, { maxT: 60 }); if (!r.ok || r.worstStill > 3) { bad++; console.log('  lane leg stuck', x, z, p, r); } x = p.x; z = p.z; }
  }
  ok('every lane path walks end to end', bad === 0, `${bad} legs failed`);
}

// 4. random cross-map trips (fixed seed): arrive, never stationary > 3 s while heading for the goal
{
  const free = () => { for (;;) { const x = (rnd() * 2 - 1) * (MAP.halfX - 5), z = (rnd() * 2 - 1) * (MAP.halfZ - 5); if (!inCover(x, z)) return [x, z]; } };
  let bad = 0, worst = 0; const N = 400;
  for (let i = 0; i < N; i++) {
    const [a, b] = [free(), free()];
    const r = run(a[0], a[1], b[0], b[1], { maxT: 80 });
    worst = Math.max(worst, r.worstStill);
    if (!r.ok || r.worstStill > 3) { bad++; if (bad < 6) console.log('  trip failed', a, b, r); }
  }
  ok(`${N} random trips arrive, no stall > 3 s`, bad === 0, `${bad} failed, worst stall ${worst.toFixed(2)}s`);
}

// 5. sensitivity: the old straight-line walk must visibly fail the focused case (otherwise the test proves nothing)
{
  const r = run(-17.4, -18.2, -10.6, -18.2, { maxT: 12, straight: true });
  ok('straight-line baseline is stuck on the block (test can see the bug)', !r.ok && r.worstStill > 3, `worst still ${r.worstStill.toFixed(1)}s`);
}
process.exit(fail);
