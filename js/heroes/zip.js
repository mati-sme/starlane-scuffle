// Zip — Comet Fox. Fast fighter: Tail Swipe, Streak Dash, Spin Flurry, Meteor Pounce.
import { PAL, GROUND } from '../config.js';
import { rand } from '../core/math.js';
import { dealDamage, forEachEnemy, applyStatus, AIR } from '../game/combat.js';
import { particles, FRAME } from '../render/particles.js';
import { vfx } from '../render/vfx.js';
import { Ribbon } from '../render/fx.js';
import { buildZip } from './models.js';

const ORANGE = PAL.zip, YELLOW = 0xFFE066;

// Dash 6 u through enemies. With the "Dash x2" upgrade a second charge follows within 3 s.
function streakDash(h, ctx, aim) {
  const ab = h.def.abilities.s1, hit = new Set();
  vfx.ring(h.x, 0.25, h.z, ORANGE, 2.5, 0.3);
  h.runScript({
    dur: 0.22, x1: h.x + aim.dx * 6, z1: h.z + aim.dz * 6,
    tick: (h, ctx) => {
      particles.burst(h.x, 0.8, h.z, 3, { color: [ORANGE, YELLOW], speed: 1.5, up: 1, size: 0.5, life: 0.4, frame: FRAME.sparkle, grav: 1 });
      forEachEnemy(ctx, h.team, h.x, h.z, 1.3, (e) => {
        if (hit.has(e)) return;
        hit.add(e);
        dealDamage(e, ab.dmg, h);
      });
    },
  });
  if (!h.up.s1) return undefined;
  if (h.fx.chain > ctx.time) { h.fx.chain = 0; return undefined; } // second charge: normal cooldown
  h.fx.chain = ctx.time + 3;
  h.fx.fullCd = ab.cd * h.cdMul;
  return 0.6;
}

// 1.2 s spin hitting everything nearby every 0.2 s; Zip can still run but not swipe.
function spinFlurry(h) {
  const ab = h.def.abilities.s2, u = h.up.s2 ?? 0, r = ab.range + 0.5 * u, dmg = ab.dmg * (1 + 0.2 * u);
  let tick = 0;
  vfx.ring(h.x, 0.3, h.z, ORANGE, r * 1.2, 0.3);
  h.effects.push({
    t: 0, dur: 1.2,
    update(h, dt, ctx, fx) {
      h.spin = 1;
      h.noAttack = true;
      const a = fx.t * 18;
      for (let k = 0; k < 4; k++) { // crescent sparkles whirling around
        const ang = a + (k * Math.PI) / 2, rr = r * rand(0.6, 1);
        particles.emit(h.x + Math.cos(ang) * rr, 0.7, h.z + Math.sin(ang) * rr, -Math.sin(ang) * 4, 0.5, Math.cos(ang) * 4, k % 2 ? YELLOW : ORANGE, 0.55, 0.3, FRAME.sparkle);
      }
      if ((tick -= dt) > 0) return;
      tick = 0.2;
      vfx.arc(h.x, 0.9, h.z, Math.cos(a), Math.sin(a), YELLOW, r, 0.2);
      forEachEnemy(ctx, h.team, h.x, h.z, r, (e) => dealDamage(e, dmg, h));
    },
  });
}

// Leap onto the best target: shooting-star arc, crater, knock-up.
function meteorPounce(h, ctx, aim) {
  const ab = h.def.abilities.ult, d = aim.has ? Math.min(aim.dist, ab.range) : 5;
  h.runScript({
    dur: 0.6, x1: h.x + aim.dx * d, z1: h.z + aim.dz * d, h: 4.5,
    tick: (h) => particles.burst(h.x, GROUND + 1 + h.yOff, h.z, 2, { color: [ORANGE, YELLOW, PAL.star], speed: 1, up: 0.5, size: 0.9, life: 0.6, frame: FRAME.star, grav: 0 }),
    done: (h, ctx) => {
      forEachEnemy(ctx, h.team, h.x, h.z, 3.2, (e) => {
        dealDamage(e, ab.dmg, h);
        applyStatus(e, 'air', AIR);
        applyStatus(e, 'stun', AIR);
      });
      vfx.decal(h.x, h.z, ORANGE, 3.2, 1.5);
      vfx.ring(h.x, 0.25, h.z, YELLOW, 7, 0.5);
      particles.burst(h.x, 0.4, h.z, 24, { color: [ORANGE, YELLOW, 0xFF5A1F], speed: 5, up: 5, size: 0.6, life: 0.9, frame: FRAME.dot, grav: 9 });
      ctx.rig.shake(0.4);
    },
  });
}

export const zip = {
  id: 'zip',
  portrait: 'fox',
  color: '#FF8A3D',
  stats: { hp: 600, speed: 6.5, radius: 0.6, hitY: 1.0, barY: 3.1, regen: 40 },
  abilities: {
    basic: { name: 'Tail Swipe', icon: 'zip_tail', range: 2.2, rangeUp: 0.35, dmg: 42, dmgUp: 0.15, cd: 0.5, color: ORANGE },
    s1: { name: 'Streak Dash', icon: 'zip_dash', cd: 6, range: 6, radius: 2.5, dmg: 70, cast: streakDash },
    s2: { name: 'Spin Flurry', icon: 'zip_spin', cd: 8, range: 2.6, radius: 2.5, dmg: 26, cast: spinFlurry },
    ult: { name: 'Meteor Pounce', icon: 'zip_meteor', cd: 35, range: 9, radius: 3, dmg: 170, cast: meteorPounce },
  },
  buildModel: buildZip,

  init(h, scene) {
    const rib = new Ribbon(scene, 16, ORANGE, YELLOW, 0.55);
    return { rib, objs: [rib.mesh], chain: 0, fullCd: 0 };
  },
  reset(h) { h.fx.chain = 0; h.fx.rib.clear(); },
  // An unused second charge expires: the rest of the full cooldown starts then.
  tick(h, dt, ctx) {
    const f = h.fx;
    if (f.chain && ctx.time > f.chain) {
      f.chain = 0;
      h.cds[0] = Math.max(h.cds[0], f.fullCd - 3);
      h.cdTotal[0] = f.fullCd;
    }
  },
  // Orange -> yellow ribbon follows the tail tip.
  render(h, t, dt) {
    const rib = h.fx.rib;
    rib.mesh.visible = h.alive;
    if (!h.alive) { rib.clear(); return; }
    rib.push(h.rx - Math.sin(h.yaw) * 0.95, 1.1 + h.lift, h.rz - Math.cos(h.yaw) * 0.95, dt);
  },
};
