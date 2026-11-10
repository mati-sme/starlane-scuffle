// v9.0 systems: champions can kill an exposed nexus, regen (lane vs fountain), gold rewards trimmed. Run: node tests/v90-systems.mjs
import { launch } from './_pw.mjs';
const t = await launch({ seed: { unlockAll: true } });
const { page, check, errors } = t;
for (const id of ['torque', 'glint', 'nyx']) {
  const r = await page.evaluate(async (id) => {
    const { input } = await import('/js/core/input.js');
    const m = window.__starlane.match;
    m.setHero(id); m.reset();
    const h = m.hero, c = m.cores[1];
    for (const s of m.towers) if (s.team === 1) { s.alive = false; s.hp = 0; s.dying = 0; }
    for (const e of m.heroes) if (e !== h) { e.alive = false; e.respawn = 1e9; }
    m.update(1 / 30);
    const exposed = c.vulnerable;
    h.x = c.x - (h.basic.range + c.radius - 0.4); h.z = c.z;
    input.attackKey = true;
    let n = 0;
    for (; n < 30 * 480 && c.alive; n++) { m.update(1 / 30); m.projectiles.update(1 / 30); h.hp = h.maxHp; for (const e of m.heroes) if (e !== h) { e.alive = false; e.respawn = 1e9; } h.x = Math.min(h.x, c.x - 1); }
    input.attackKey = false;
    m.update(1 / 30);
    return { exposed, alive: c.alive, secs: n / 30, shielded: c.shielded, over: m.over, win: m.win };
  }, id);
  check(`${id} can kill an exposed nexus alone (backdoor-shielded)`, r.exposed && !r.alive && r.secs < 400, `${r.secs.toFixed(0)}s`);
  check(`${id}: match ends with a win`, r.over && r.win);
}
// not exposed -> still immune
const imm = await page.evaluate(async () => {
  const { input } = await import('/js/core/input.js');
  const m = window.__starlane.match; m.setHero('torque'); m.reset();
  const h = m.hero, c = m.cores[1]; m.update(1 / 30);
  h.x = c.x - 3; h.z = c.z; for (const e of m.heroes) if (e !== h) { e.alive = false; e.respawn = 1e9; }
  input.attackKey = true; for (let i = 0; i < 300; i++) { m.update(1 / 30); h.hp = h.maxHp; } input.attackKey = false;
  return { hp: c.hp, max: c.maxHp, vul: c.vulnerable };
});
check('nexus stays untouchable until both guardians fall', !imm.vul && imm.hp === imm.max);
// regen
const rg = await page.evaluate(async () => {
  const { ARENA, HERO } = await import('/js/config.js');
  const m = window.__starlane.match; m.setHero('bulwark'); m.reset();
  for (const e of m.heroes) if (e !== m.hero) { e.alive = false; e.respawn = 1e9; }
  const h = m.hero;
  const run = (x, z, secs) => { h.x = x; h.z = z; h.hp = h.maxHp * 0.4; h.sinceHit = 99; const hp0 = h.hp; for (let i = 0; i < secs * 30; i++) { m.update(1 / 30); h.x = x; h.z = z; } return { gain: h.hp - hp0, max: h.maxHp }; };
  const lane = run(0, 0, 10), fo = run(ARENA.fountain[0], ARENA.fountain[1], 2);
  const early = (() => { h.x = 0; h.z = 0; h.hp = h.maxHp * 0.4; h.sinceHit = 0; const hp0 = h.hp; for (let i = 0; i < 4 * 30; i++) { m.update(1 / 30); h.x = 0; h.z = 0; h.sinceHit = Math.min(h.sinceHit, 2); } return h.hp - hp0; })();
  return { lane, fo, early, rate: HERO.regen };
});
check('lane regen is gentle (< 6 HP/s at level 1)', rg.lane.gain < 60, `${(rg.lane.gain / 10).toFixed(1)} HP/s over 10 s of ${rg.lane.max} max (was 40 HP/s)`);
check('no regen while recently hit', rg.early < 1, `${rg.early.toFixed(1)}`);
check('fountain stays a fast heal (>= 35% max HP in 2 s)', rg.fo.gain >= rg.fo.max * 0.35, `${(rg.fo.gain / rg.fo.max * 100).toFixed(0)}% in 2 s`);
check('fountain heals >= 10x faster than the lane', rg.fo.gain / 2 >= (rg.lane.gain / 10) * 10, '');
check('no page errors', errors.length === 0, errors.join('; '));
await t.done();
