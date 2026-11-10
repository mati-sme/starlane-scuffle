// v9.3 kit behaviors (batch D) for the wave3 champions. BEHAVIORS-style: (hero, ab, ctx, aim) => false | void.
// New kinds use `aimAs` / `botAs` (an existing kind's aim preview + bot rule) and `icon` (an existing glyph) on the skill data.
import { dealDamage, forEachEnemy, forEachAlly, applyStatus, shove, heal, addBuff, giveShield, AIR } from '../game/combat.js';
import { pickTarget } from '../game/targeting.js';
import { particles, FRAME } from '../render/particles.js';
import { vfx } from '../render/vfx.js';

const fx = (h) => h.def.fx ?? h.def;
const mover = (e) => e.type === 'hero' || e.type === 'minion';
const spark = (h, x, y, z, n, c, speed = 3) => particles.burst(x, y, z, n, { color: c, speed, up: 2, size: 0.55, life: 0.6, frame: fx(h).frame ?? FRAME.sparkle, grav: 2 });

// Damage + status flags (stun slow root charm air knock pull), same vocabulary as the shared skills.
function affect(h, e, ab, o = {}) {
  if (ab.dmg) dealDamage(e, ab.dmg * (o.mul ?? 1), h, true);
  if (!e.alive) return;
  const ox = o.x ?? h.x, oz = o.z ?? h.z;
  if (ab.stun) applyStatus(e, 'stun', ab.stun);
  if (ab.slow) applyStatus(e, 'slow', ab.slowT ?? 1.5);
  if (ab.root) applyStatus(e, 'root', ab.root);
  if (ab.charm) { applyStatus(e, 'charm', ab.charm); e.charmSrc = h; }
  if (ab.air) { applyStatus(e, 'air', AIR); applyStatus(e, 'stun', AIR); }
  if (ab.knock) shove(e, o.kdx ?? e.x - ox, o.kdz ?? e.z - oz, ab.knock, 0.25);
}

function boom(h, ctx, x, z, R, ab, o = {}) {
  const col = fx(h).color, acc = fx(h).accent;
  vfx.ring(x, 0.25, z, acc, R * 1.3, 0.4);
  vfx.flash(x, 1, z, col, R * 1.1, 0.25);
  vfx.decal(x, z, col, R, 0.8);
  spark(h, x, 0.5, z, 14, [col, acc, 0xffffff], 5);
  forEachEnemy(ctx, h.team, x, z, R, (e) => affect(h, e, ab, { x, z, ...o }));
  ctx.rig.shake(0.1 + R * 0.04);
}

function firstAlong(ctx, h, dx, dz, range, width) {
  let best = null, bd = Infinity;
  forEachEnemy(ctx, h.team, h.x + dx * range * 0.5, h.z + dz * range * 0.5, range * 0.5 + 1.5, (e) => {
    if (!mover(e)) return;
    const rx = e.x - h.x, rz = e.z - h.z, along = rx * dx + rz * dz, lat = Math.abs(rx * dz - rz * dx);
    if (along > 0 && along <= range + e.radius && lat <= width / 2 + e.radius && along < bd) { best = e; bd = along; }
  });
  return best;
}

export const KITS_D = {
  // Moxie ult: become a pinball. For a few seconds you are faster and bump every enemy you touch away.
  ballmode(h, ab, ctx) {
    const col = fx(h).color, acc = fx(h).accent, last = new Map();
    let age = 0, tick = 0;
    addBuff(h, 'speed', ab.spd ?? 0.35, ab.dur);
    if (ab.shield) giveShield(h, ab.shield, ab.dur);
    vfx.ring(h.x, 0.25, h.z, col, ab.r * 2, 0.4);
    h.effects.push({
      t: 0, dur: ab.dur,
      update(h, dt, ctx) {
        age += dt; h.spin = 1; h.noAttack = true;
        particles.emit(h.x + (Math.random() - 0.5), 0.8 + Math.random() * 0.6, h.z + (Math.random() - 0.5), 0, 0.6, 0, Math.random() < 0.5 ? col : acc, 0.7, 0.4, FRAME.star ?? FRAME.sparkle);
        if ((tick -= dt) > 0) return;
        tick = 0.08;
        forEachEnemy(ctx, h.team, h.x, h.z, ab.r, (e) => {
          if (!mover(e) || age - (last.get(e) ?? -9) < 0.7) return;
          last.set(e, age);
          affect(h, e, ab, { x: h.x, z: h.z });
          vfx.ring(e.x, 0.3, e.z, acc, 2, 0.25);
          spark(h, e.x, 1, e.z, 8, [col, acc, 0xffffff], 4);
          ctx.rig.shake(0.1);
        });
      },
    });
  },

  // Gumdrop s2: a wobbly shield. While it lasts, enemies that crowd close get bounced off and sticky-slowed.
  jellyshell(h, ab, ctx) {
    const col = fx(h).color, acc = fx(h).accent;
    let tick = 0;
    giveShield(h, ab.shield, ab.dur);
    vfx.ring(h.x, 0.25, h.z, col, ab.r * 1.5, 0.5);
    h.effects.push({
      t: 0, dur: ab.dur,
      update(h, dt, ctx) {
        if ((tick -= dt) > 0) return;
        tick = 0.45;
        vfx.ring(h.x, 0.5 + Math.random() * 0.8, h.z, Math.random() < 0.5 ? col : acc, ab.r * 1.1, 0.3);
        forEachEnemy(ctx, h.team, h.x, h.z, ab.r, (e) => {
          if (!mover(e)) return;
          affect(h, e, { dmg: ab.dmg, knock: ab.knock, slow: true, slowT: 1 }, { x: h.x, z: h.z });
          spark(h, e.x, 1, e.z, 5, [col, acc], 3);
        });
      },
    });
  },

  // Ziggy s3: boing! spring forward through enemies, then spring right back through them again.
  boing(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, x0 = h.x, z0 = h.z, d = ab.range;
    const leg = (x1, z1, dx, dz, n) => {
      const hit = new Set();
      vfx.ring(h.x, 0.25, h.z, n ? acc : col, 2.4, 0.3);
      h.runScript({
        dur: 0.14 + d * 0.02, x1, z1, h: 1.6,
        tick: (h, c2) => {
          particles.burst(h.x, 0.5 + h.yOff, h.z, 2, { color: [col, acc], speed: 1.5, up: 1, size: 0.6, life: 0.4, frame: fx(h).frame ?? FRAME.sparkle, grav: 1 });
          forEachEnemy(ctx, h.team, h.x, h.z, (ab.width ?? 1.6) / 2 + 0.4, (e) => {
            if (hit.has(e) || !mover(e)) return;
            hit.add(e);
            const side = Math.sign(dx * (e.z - h.z) - dz * (e.x - h.x)) || 1;
            affect(h, e, { dmg: n ? ab.dmg2 ?? ab.dmg : ab.dmg, knock: ab.knock, stun: n ? ab.stun : 0 }, { kdx: -dz * side, kdz: dx * side });
          });
        },
        done: (h) => { if (!n) leg(x0, z0, -dx, -dz, 1); else vfx.ring(h.x, 0.25, h.z, acc, 3, 0.4); },
      });
    };
    leg(x0 + aim.dx * d, z0 + aim.dz * d, aim.dx, aim.dz, 0);
  },

  // Ziggy ult: a dance floor. Enemy heroes stepping on it get the silly jig (charmed, cannot attack); friends sped up.
  dancefloor(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, R = ab.radius, dd = Math.min(aim.dist, ab.range), x = h.x + aim.dx * dd, z = h.z + aim.dz * dd;
    let tick = 0, vis = 0;
    vfx.rune(x, z, acc, R * 1.6, ab.dur);
    vfx.ring(x, 0.25, z, col, R * 1.3, 0.5);
    ctx.anim(ab.dur, (u, dt) => {
      if (u >= 1) return;
      if ((vis -= dt) <= 0) { vis = 0.4; vfx.decal(x, z, Math.random() < 0.5 ? col : acc, R, 0.5); }
      for (let k = 0; k < 2; k++) { const a = Math.random() * 6.283, r = Math.random() * R; particles.emit(x + Math.cos(a) * r, 0.3, z + Math.sin(a) * r, 0, 2.2, 0, k ? acc : col, 0.8, 0.4, FRAME.star ?? FRAME.sparkle); }
      if ((tick -= dt) > 0) return;
      tick = 0.3;
      forEachEnemy(ctx, h.team, x, z, R, (e) => { if (e.type === 'hero') { applyStatus(e, 'charm', 0.7); e.charmSrc = h; if (ab.dps) dealDamage(e, ab.dps * 0.3, h, true); } else if (e.type === 'minion' && ab.dps) dealDamage(e, ab.dps * 0.3, h, true); });
      forEachAlly(ctx, h.team, x, z, R, (a) => addBuff(a, 'speed', ab.allySpd ?? 0.25, 1));
    });
  },

  // Pixel s1: glitch-hop. Vanish from here, reappear at the aimed spot; a little pixel pop on both ends.
  gridhop(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, d = Math.min(aim.manual ? aim.dist : ab.range, ab.range);
    const fx0 = h.x, fz0 = h.z;
    vfx.ghost(h.x, h.z, acc, 0.5);
    boom(h, ctx, fx0, fz0, ab.radius * 0.7, { dmg: ab.dmg * 0.5 });
    h.runScript({
      dur: 0.08, x1: h.x + aim.dx * d, z1: h.z + aim.dz * d, h: 0.3,
      done: (h) => {
        boom(h, ctx, h.x, h.z, ab.radius, ab);
        for (let i = 1; i < 5; i++) vfx.ghost(fx0 + (h.x - fx0) * i / 5, fz0 + (h.z - fz0) * i / 5, i % 2 ? col : acc, 0.4);
        if (ab.spd) addBuff(h, 'speed', ab.spd, ab.spdT ?? 1.5);
      },
    });
  },

  // Nimbus s1: chain lightning. Zaps the nearest foe ahead, then jumps to the next closest, again and again.
  chain(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent;
    const first = firstAlong(ctx, h, aim.dx, aim.dz, ab.range, ab.width ?? 3) ?? pickTarget(ctx, h.team, h.x, h.z, ab.range, ['heroes', 'minions']);
    if (!first) return false;
    const path = [first], seen = new Set([first]);
    while (path.length <= ab.bounces) {
      const from = path[path.length - 1];
      let next = null, bd = ab.bounceR;
      forEachEnemy(ctx, h.team, from.x, from.z, ab.bounceR, (e) => {
        const dd = Math.hypot(e.x - from.x, e.z - from.z);
        if (!seen.has(e) && mover(e) && dd < bd) { next = e; bd = dd; }
      });
      if (!next) break;
      seen.add(next); path.push(next);
    }
    let prev = h;
    path.forEach((e, i) => {
      const from = prev;
      ctx.later(i * 0.09, () => {
        if (!e.alive) return;
        vfx.link(from, e, i % 2 ? col : acc, 0.3, 1.2, e.hitY ?? 1, 0.16);
        affect(h, e, { dmg: ab.dmg * Math.pow(ab.falloff ?? 0.85, i), stun: i === path.length - 1 ? ab.endStun : 0, slow: ab.slow, slowT: 1 });
        vfx.flash(e.x, 1.2, e.z, col, 1.8, 0.2);
        spark(h, e.x, 1, e.z, 8, [col, acc, 0xffffff], 4);
      });
      prev = e;
    });
  },

  // Scarlet s3: a sticky cherry bomb. It sticks to the first foe it hits and goes pop after a short fuse.
  stickybomb(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, t = firstAlong(ctx, h, aim.dx, aim.dz, ab.range, ab.width ?? 1.2);
    vfx.streak(h.x, 1.3, h.z, h.x + aim.dx * (t ? Math.hypot(t.x - h.x, t.z - h.z) : ab.range), 1.3, h.z + aim.dz * (t ? Math.hypot(t.x - h.x, t.z - h.z) : ab.range), col, 0.2, 4);
    if (!t) return false;
    let x = t.x, z = t.z, vis = 0;
    if (ab.hitDmg) affect(h, t, { dmg: ab.hitDmg, slow: true, slowT: 1 });
    ctx.anim(ab.fuse, (u, dt) => {
      if (t.alive) { x = t.x; z = t.z; }
      if ((vis -= dt) <= 0) { vis = 0.2; vfx.flash(x, (t.hitY ?? 1) + 0.9, z, u > 0.6 ? acc : col, 1 + u, 0.18); vfx.ring(x, 0.3, z, acc, ab.radius * (0.4 + 0.6 * u), 0.2); }
      particles.emit(x + (Math.random() - 0.5) * 0.4, (t.hitY ?? 1) + 0.9, z + (Math.random() - 0.5) * 0.4, 0, 1.5, 0, col, 0.6, 0.3, FRAME.dot);
    });
    ctx.later(ab.fuse, () => boom(h, ctx, x, z, ab.radius, { dmg: ab.dmg, slow: true, slowT: ab.slowT ?? 1.5, knock: ab.knock }));
  },

  // Dumpling s3: a steamed bun for the most hurt friend in reach (or yourself): shield, a little heal and a bounce of speed.
  bunshield(h, ab, ctx) {
    let ally = null;
    forEachAlly(ctx, h.team, h.x, h.z, ab.allyR, (a) => { if (a !== h && (!ally || a.hp / a.maxHp < ally.hp / ally.maxHp)) ally = a; });
    const tgt = ally ?? h, col = fx(h).color, acc = fx(h).accent;
    giveShield(tgt, ab.allyShield, ab.dur);
    if (tgt !== h) giveShield(h, ab.shield, ab.dur);
    if (ab.allyHeal) heal(tgt, ab.allyHeal);
    addBuff(tgt, 'speed', ab.spd ?? 0.2, ab.dur);
    vfx.link(h, tgt, col, 0.35, 1.2, tgt.hitY ?? 1.1);
    vfx.ring(tgt.x, 0.25, tgt.z, acc, 3, 0.5);
    spark(h, tgt.x, 1.4, tgt.z, 12, [col, acc, 0xffffff], 3);
  },
};
