// v9.0 headless bot-match sim: item pacing (full build near the tie-break, not at 10:00), regen, no stuck bots, nexus killable.
// Run: node tests/v90-pacing-sim.mjs [minutes=16]
import { launch } from './_pw.mjs';
const MIN = +process.argv[2] || 16, GX = +process.argv[3] || 1; // GX: gold multiplier standing in for a strong human (~1.5x the bots' income)
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
  let worstStill = 0;
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
        if (Math.hypot(h.x - l[0], h.z - l[1]) > 0.3 || !h.alive) { l[0] = h.x; l[1] = h.z; l[2] = 0; } else { l[2]++; if (h.alive && !h.recall && l[2] > worstStill) worstStill = l[2]; }
      }
    }
    if (i % (30 * 60) === 0) snaps.push({ min: i / 1800, items: m.heroes.reduce((s, h) => s + h.items.length, 0) / (m.heroes.length), gold: m.heroes.reduce((s, h) => s + h.gold, 0) / m.heroes.length, val: m.heroes.reduce((s, h) => s + h.items.reduce((a, id) => a + ITEMS[id].cost, 0), 0) / m.heroes.length });
  }
  const aff = Object.values(afford).sort((a, b) => a - b);
  const times = Object.values(full).sort((a, b) => a - b);
  return { affMin: aff[0], affMed: aff[aff.length >> 1], affCount: aff.length, time: m.time, over: m.over, reason: m.reason, snaps, fullCount: times.length, fullMin: times[0], fullMed: times[times.length >> 1], fullMax: times.at(-1), n: m.heroes.length, worstStill, kills: m.kills };
}, [MIN, GX]);
for (const s of res.snaps) console.log(`  ${s.min.toFixed(0)}:00 avg items ${s.items.toFixed(1)} avg build value ${Math.round(s.val)} unspent gold ${Math.round(s.gold)}`);
console.log(JSON.stringify({ ...res, snaps: undefined }));
const mm = (x) => (x / 60).toFixed(1);
check('human-pace income cannot pay for a full build by 10:00', !(res.affMin < 600), `earliest affordable ${res.affMin ? mm(res.affMin) : 'none'} min`);
check('human-pace full build is affordable around 13-15 min', res.affMed && res.affMed >= 12 * 60 && res.affMed <= 15.5 * 60, `median ${res.affMed ? mm(res.affMed) : 'none'} min (${res.affCount}/9 heroes)`);
check('no bot has a full build at 10:00', !(res.fullMin < 600), `first full build ${res.fullMin ? mm(res.fullMin) : 'none'} min`);

check('no bot stands still > 30 s', res.worstStill <= 30, `${res.worstStill}s`);
await t.done();
