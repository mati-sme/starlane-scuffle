// Luma — Star Bunny. Ranged burst + heal: Star Bolt, Twinkle Burst, Hop Blink, Shooting Star Shower.
import { PAL, GROUND, TEAM } from '../config.js';
import { rand, lerp } from '../core/math.js';
import { dealDamage, forEachEnemy, heal } from '../game/combat.js';
import { pickTarget } from '../game/targeting.js';
import { particles, FRAME } from '../render/particles.js';
import { vfx } from '../render/vfx.js';
import { buildLuma } from './models.js';

const PINK = 0xFF9AD5, WHITE = 0xFFFFFF;

// Star bomb lobbed at the best cluster.
function twinkleBurst(h, ctx, aim) {
  const ab = h.def.abilities.s1, R = ab.radius + 0.6 * (h.up.s1 ?? 0), x0 = h.x, z0 = h.z, ax = aim.x, az = aim.z;
  ctx.anim(0.45, (u) => {
    const y = GROUND + lerp(1.8, 0.3, u) + Math.sin(Math.PI * u) * 2.2;
    particles.emit(lerp(x0, ax, u), y, lerp(z0, az, u), rand(-0.3, 0.3), rand(-0.3, 0.3), rand(-0.3, 0.3), PINK, 0.9, 0.35, FRAME.star);
    if (u < 1) return;
    vfx.ring(ax, 0.25, az, PINK, R * 1.3, 0.4);
    particles.burst(ax, 0.6, az, 18, { color: [PINK, WHITE, PAL.star], speed: 5, up: 3, size: 0.8, life: 0.7, frame: FRAME.star, grav: 4 });
    forEachEnemy(ctx, h.team, ax, az, R, (e) => dealDamage(e, ab.dmg, h));
    ctx.rig.shake(0.1);
  });
}

// Short hop away from the nearest enemy hero (or toward home); heals allies where she lands.
function hopBlink(h, ctx) {
  const ab = h.def.abilities.s2, foe = pickTarget(ctx, h.team, h.x, h.z, 9, ['heroes']);
  let dx = foe ? h.x - foe.x : -TEAM[h.team].dir, dz = foe ? h.z - foe.z : 0;
  const d = Math.hypot(dx, dz) || 1;
  dx /= d; dz /= d;
  vfx.ghost(h.x, h.z, PINK, 0.5);
  h.runScript({
    dur: 0.12, x1: h.x + dx * 4.5, z1: h.z + dz * 4.5, h: 1,
    done: (h, ctx) => {
      const amt = ab.heal * (1 + 0.4 * (h.up.s2 ?? 0));
      vfx.ring(h.x, 0.25, h.z, PAL.heal, 9, 0.5);
      for (const a of ctx.heroes) {
        if (a.team !== h.team || !a.alive || Math.hypot(a.x - h.x, a.z - h.z) > ab.radius) continue;
        heal(a, amt);
        for (let k = 0; k < 5; k++) particles.emit(a.x + rand(-0.6, 0.6), 0.6, a.z + rand(-0.6, 0.6), 0, rand(1.5, 2.5), 0, k % 2 ? PINK : PAL.heal, 0.6, 0.9, FRAME.star);
      }
    },
  });
}

// Eight stars rain over the area, each a streak falling at 30 degrees with its own impact burst.
function starShower(h, ctx, aim) {
  const ab = h.def.abilities.ult, R = 2.8, cx = aim.x, cz = aim.z;
  vfx.decal(cx, cz, PINK, R, 1.8);
  vfx.ring(cx, 0.2, cz, WHITE, R * 1.2, 0.5);
  for (let i = 0; i < 8; i++) {
    const a = rand(0, Math.PI * 2), r = Math.sqrt(Math.random()) * R, px = cx + Math.cos(a) * r, pz = cz + Math.sin(a) * r;
    ctx.later(0.1 + i * 0.17, () => {
      vfx.streak(px + 5.5, 9.5, pz, px, 0.3, pz, i % 2 ? WHITE : PINK, 0.35);
      ctx.later(0.35, () => {
        vfx.ring(px, 0.2, pz, PINK, 2.6, 0.3);
        particles.burst(px, 0.4, pz, 10, { color: [PINK, WHITE, PAL.star], speed: 3.5, up: 3, size: 0.7, life: 0.6, frame: FRAME.star, grav: 5 });
        forEachEnemy(ctx, h.team, px, pz, 1.7, (e) => dealDamage(e, ab.dmg, h));
      });
    });
  }
}

export const luma = {
  id: 'luma',
  portrait: 'bunny',
  color: '#C9A7FF',
  stats: { hp: 520, speed: 6, radius: 0.55, hitY: 1.1, barY: 3.2, regen: 40 },
  abilities: {
    basic: { name: 'Star Bolt', icon: 'luma_bolt', range: 7, rangeUp: 0.5, dmg: 30, dmgUp: 0.2, cd: 0.6, color: PINK, proj: { speed: 15, arc: 0.3, y: 1.5, frame: FRAME.star, size: 1.2 } },
    s1: { name: 'Twinkle Burst', icon: 'luma_burst', cd: 6, range: 8, radius: 2.6, dmg: 80, cast: twinkleBurst },
    s2: { name: 'Hop Blink', icon: 'luma_blink', cd: 7, range: 7, radius: 4.5, heal: 70, cast: hopBlink },
    ult: { name: 'Shooting Star Shower', icon: 'luma_shower', cd: 35, range: 8, radius: 3, dmg: 52, cast: starShower },
  },
  buildModel: buildLuma,

  init() { return { tw: 0 }; },
  render(h, t, dt) {
    if (h.alive && (h.fx.tw -= dt) <= 0) { // twinkles
      h.fx.tw = 0.14;
      particles.emit(h.rx + rand(-0.9, 0.9), 0.6 + rand(0, 2), h.rz + rand(-0.9, 0.9), 0, 0.4, 0, Math.random() < 0.5 ? PINK : WHITE, 0.5, 0.6, FRAME.sparkle);
    }
  },
};
