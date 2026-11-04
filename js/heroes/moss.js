// Moss — Grove Bear. Tank: Paw Bonk, Vine Grab, Bark Shield, Grove Quake.
import { PAL } from '../config.js';
import { rand, pick } from '../core/math.js';
import { dealDamage, forEachEnemy, applyStatus, pullTo } from '../game/combat.js';
import { pickTarget } from '../game/targeting.js';
import { particles, FRAME } from '../render/particles.js';
import { vfx } from '../render/vfx.js';
import { makeDome } from '../render/fx.js';
import { buildMoss } from './models.js';

const LEAF = PAL.moss, PINK = 0xFF8EC4;

// Pulls the nearest enemy hero (else minion) in and stuns it.
function vineGrab(h, ctx) {
  const ab = h.def.abilities.s1, t = pickTarget(ctx, h.team, h.x, h.z, ab.range, ['heroes', 'minions']);
  if (!t) return false;
  dealDamage(t, ab.dmg, h);
  vfx.link(h, t, LEAF, 0.6, 1, t.hitY ?? 1);
  const d = Math.hypot(t.x - h.x, t.z - h.z) || 1, keep = h.radius + t.radius + 0.4;
  if (d > keep) pullTo(t, h.x + ((t.x - h.x) / d) * keep, h.z + ((t.z - h.z) / d) * keep, 0.3);
  applyStatus(t, 'stun', 0.8 + 0.4 * (h.up.s1 ?? 0));
  particles.burst(t.x, 1, t.z, 8, { color: [LEAF, 0xB4E38E], speed: 2.5, up: 2, size: 0.5, life: 0.6, frame: FRAME.sparkle, grav: 2 });
}

// Shield + slow aura for 3 s.
function barkShield(h, ctx) {
  const ab = h.def.abilities.s2, u = h.up.s2 ?? 0, dur = 3 + u;
  let tick = 0;
  h.shieldHp = 140 + 80 * u + 10 * h.level;
  h.shieldT = dur;
  vfx.ring(h.x, 0.25, h.z, LEAF, ab.range * 1.2, 0.4);
  h.effects.push({
    t: 0, dur,
    update(h, dt, ctx) {
      if ((tick -= dt) > 0) return;
      tick = 0.3;
      forEachEnemy(ctx, h.team, h.x, h.z, ab.range, (e) => applyStatus(e, 'slow', 0.6));
      particles.burst(h.x, 0.4, h.z, 3, { color: LEAF, speed: ab.range, up: 0.5, size: 0.4, life: 0.4, frame: FRAME.sparkle, grav: 0 });
    },
  });
}

// Three shockwave rings that root; flowers pop up and shrink away.
function groveQuake(h, ctx) {
  const ab = h.def.abilities.ult, R = ab.range, x = h.x, z = h.z;
  for (let i = 0; i < 3; i++) {
    ctx.later(i * 0.3, () => {
      vfx.ring(x, 0.2, z, LEAF, R * 1.1, 0.5);
      forEachEnemy(ctx, h.team, x, z, R, (e) => {
        dealDamage(e, ab.dmg, h);
        applyStatus(e, 'root', 1.2);
      });
      ctx.rig.shake(0.25);
      for (let k = 0; k < 12; k++) {
        const a = rand(0, Math.PI * 2), r = rand(1, R);
        particles.emit(x + Math.cos(a) * r, 0.1, z + Math.sin(a) * r, 0, 3, 0, pick([PINK, PAL.gold, 0xffffff]), 1, 0.8, FRAME.star, 6);
      }
    });
  }
}

export const moss = {
  id: 'moss',
  portrait: 'bear',
  color: '#6BBF59',
  stats: { hp: 780, speed: 5.4, radius: 0.8, hitY: 1.1, barY: 3.4, regen: 45 },
  abilities: {
    basic: { name: 'Paw Bonk', icon: 'moss_paw', range: 2, rangeUp: 0.3, dmg: 38, dmgUp: 0.15, cd: 0.65, color: LEAF, splash: 1.5, splashUp: 0.4 },
    s1: { name: 'Vine Grab', icon: 'moss_vine', cd: 8, range: 7, radius: 1, dmg: 30, cast: vineGrab },
    s2: { name: 'Bark Shield', icon: 'moss_shield', cd: 10, range: 3.5, radius: 3, cast: barkShield },
    ult: { name: 'Grove Quake', icon: 'moss_quake', cd: 35, range: 6.5, radius: 4, dmg: 45, cast: groveQuake },
  },
  buildModel: buildMoss,

  init(h, scene) {
    const dome = makeDome(PAL.shield);
    scene.add(dome);
    return { dome, objs: [dome], leaf: 0 };
  },
  render(h, t, dt) {
    const d = h.fx.dome, on = h.alive && h.shieldT > 0 && h.shieldHp > 0;
    d.visible = on;
    if (on) {
      const s = 1.7 + Math.sin(t * 6) * 0.05;
      d.position.set(h.rx, 1.2 + h.lift, h.rz);
      d.scale.set(s, s * 1.1, s);
      d.rotation.y = t;
      d.material.uniforms.uA.value = Math.min(1, h.shieldT * 2);
    }
    if (h.alive && (h.fx.leaf -= dt) <= 0) { // fluttering leaves
      h.fx.leaf = 0.18;
      particles.emit(h.rx + rand(-0.8, 0.8), 1 + rand(0, 1.5), h.rz + rand(-0.8, 0.8), rand(-0.4, 0.4), -0.5, rand(-0.4, 0.4), LEAF, 0.35, 1.2, FRAME.sparkle);
    }
  },
};
