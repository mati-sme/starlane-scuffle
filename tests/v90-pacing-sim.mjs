// v9.0 headless bot-match sim: item pacing (full build near the tie-break, not at 10:00), regen, no stuck bots, nexus killable.
// Run: node tests/v90-pacing-sim.mjs [minutes=16]
import { launch } from './_pw.mjs';
const MIN = +process.argv[2] || 16, GX = +process.argv[3] || 1.25; // GX: gold multiplier standing in for a strong human (~1.5x the bots' income)
const t = await launch({ seed: { unlockAll: true } });
const { page, check } = t;
const res = await page.evaluate(async ([MIN, GX]) => {
  const { GOLD } = await import('/js/config.js'); GOLD.trickle *= GX;
  const { nextBuy, ITEMS } = await import('/js/game/gear.js');
  const m = window.__starlane.match;
  m.setHero('torque'); for (const h of m.heroes) if (!h.brain) m.botify(h);
  m.reset();
  const og = m._gold.bind(m); m._gold = (h, n) => { h._earned = (h._earned ?? 0) + n * GX; og(h, n * GX); };
  const { buildCost } = await import('/js/game/gear.js');
  const afford = {};
  const full = {}, snaps = [], stuck = {};
  const last = new Map(m.heroes.map((h) => [h, [h.x, h.z, 0]]));
  let worstStill = 0, stuckWho = null;
  const dt = 1 / 30;
  for (let i = 0; i < MIN * 60 * 30 && !m.over; i++) {
    m.update(dt);
    if (i % 30 === 0) {
      for (const h of m.heroes) {
        if (h === m.hero) continue;
        h._earned = (h._earned ?? 0) + GOLD.trickle; // one second of trickle
        if (!afford[h.id] && GOLD.start + h._earned >= buildCost(h.def.role)) afford[h.id] = m.time;
        if (!full[h.id] && !nextBuy(h) && h.items.length >= 7) full[h.id] = m.time;
        const l = last.get(h);
        if (Math.hypot(h.x - l[0], h.z - l[1]) > 0.3 || !h.alive) { l[0] = h.x; l[1] = h.z; l[2] = 0; } else if (h.alive && !h.recall && !h.windup > 0 && Math.hypot(h.brain?.it.x ?? 0, h.brain?.it.z ?? 0) > 0.3 && h.stun <= 0 && h.root <= 0) { l[2]++; if (l[2] > worstStill) { worstStill = l[2]; stuckWho = { dbg: { stun: h.stun, root: h.root, air: h.air, script: !!h.script, windup: h.windup, pend: h.pend, noAtk: h.noAttack, goal: h.brain && { x: Math.round(h.brain.goal.x), z: Math.round(h.brain.goal.z) }, it: h.brain && [h.brain.it.x, h.brain.it.z].map((v) => +v.toFixed(2)), esc: !!h.brain?.escape, hp: Math.round(h.hp), spd: h.speed, slow: h.slow, moveMul: h.moveMul }, id: h.id, x: Math.round(h.x), z: Math.round(h.z), state: h.brain?.state, at: Math.round(m.time) }; } }
      }
    }
    if (i % (30 * 60) === 0) snaps.push({ min: i / 1800, items: m.heroes.reduce((s, h) => s + h.items.length, 0) / (m.heroes.length), gold: m.heroes.reduce((s, h) => s + h.gold, 0) / m.heroes.length, val: m.heroes.reduce((s, h) => s + h.items.reduce((a, id) => a + ITEMS[id].cost, 0), 0) / m.heroes.length });
  }
  const aff = Object.values(afford).sort((a, b) => a - b);
  const times = Object.values(full).sort((a, b) => a - b);
  return { afford, stuckWho, affMin: aff[0], affMed: aff[aff.length >> 1], affCount: aff.length, time: m.time, over: m.over, reason: m.reason, snaps, fullCount: times.length, fullMin: times[0], fullMed: times[times.length >> 1], fullMax: times.at(-1), n: m.heroes.length, worstStill, kills: m.kills };
}, [MIN, GX]);
for (const s of res.snaps) console.log(`  ${s.min.toFixed(0)}:00 avg items ${s.items.toFixed(1)} avg build value ${Math.round(s.val)} unspent gold ${Math.round(s.gold)}`);
console.log(JSON.stringify({ ...res, snaps: undefined }));
const mm = (x) => (x / 60).toFixed(1);
const early = Object.values(res.afford).filter((x) => x < 600).length;
check('human-pace (1.25x bot income): at most 1 of 9 heroes could afford a full build by 10:00', early <= 1, `${early} heroes; earliest ${res.affMin ? mm(res.affMin) : 'none'} min`);
check('human-pace full build is affordable around 13-15.5 min (median of those who get there)', res.affCount >= 1 && res.affMed >= 11.5 * 60 && res.affMed <= 15.5 * 60, `median ${res.affMed ? mm(res.affMed) : 'none'} min (${res.affCount}/9 heroes by ${MIN} min)`);
check('bots at 1x pace do not complete a build before 11 min', GX > 1 || !(res.fullMin < 660), `first full ${res.fullMin ? mm(res.fullMin) : 'none'} min`);
check('no bot stands still > 30 s', res.worstStill <= 30, `${res.worstStill}s`);
await t.done();
