// Shared skill behaviors. A champion skill is pure data (roster.js); its `kind` picks one of these.
// BEHAVIORS[kind](hero, ab, ctx, aim): ab is the rank-resolved skill; return false for "nothing to hit" (short retry).
// BASICS[kind](hero, ctx, target, basic, dmg): the auto-attack kinds.
import { GROUND, PAL, TEAM } from '../config.js';
import { rand, lerp, clamp, angleLerp } from '../core/math.js';
import {
  dealDamage, forEachEnemy, forEachAlly, applyStatus, shove, heal, addBuff, giveShield, AIR,
} from '../game/combat.js';
import { pickTarget } from '../game/targeting.js';
import { particles, FRAME } from '../render/particles.js';
import { vfx } from '../render/vfx.js';

const DEG = Math.PI / 180;
// Ability VFX colors: a champion may override its body colors with `fx: { color, accent }` so skills stay distinct.
const fx = (h) => h.def.fx ?? h.def;
const telegraph = (h) => (h.team === 0 ? TEAM[0].main : PAL.gloom); // red warns the player; allies show their team tint

// Damage + the optional status / forced movement flags of a skill (stun, slow, air, knock, pull).
function affect(h, e, ab, o = {}) {
  if (ab.dmg) dealDamage(e, ab.dmg * (o.mul ?? 1), h, true);
  if (!e.alive) return;
  const ox = o.x ?? h.x, oz = o.z ?? h.z;
  if (ab.stun) applyStatus(e, 'stun', ab.stun);
  if (ab.slow) applyStatus(e, 'slow', ab.slowT ?? 1.5);
  if (ab.air || o.air) { applyStatus(e, 'air', AIR); applyStatus(e, 'stun', AIR); }
  if (ab.knock) shove(e, o.kdx ?? e.x - ox, o.kdz ?? e.z - oz, ab.knock, 0.25);
  if (ab.pull) {
    const d = Math.hypot(ox - e.x, oz - e.z);
    if (d > 0.3) shove(e, ox - e.x, oz - e.z, Math.min(ab.pull, d), 0.3);
  }
}

const sparks = (x, y, z, n, c, speed = 3) =>
  particles.burst(x, y, z, n, { color: c, speed, up: 2, size: 0.55, life: 0.6, frame: FRAME.sparkle, grav: 2 });

// Instant line attack: hits everything (pierce) or only the first enemy along the line.
export function fireBolt(h, ctx, x, z, dx, dz, p, color) {
  const hits = [];
  forEachEnemy(ctx, h.team, x + dx * p.range * 0.5, z + dz * p.range * 0.5, p.range * 0.5 + 1.5, (e) => {
    const rx = e.x - x, rz = e.z - z, along = rx * dx + rz * dz, lat = Math.abs(rx * dz - rz * dx);
    if (along > 0 && along <= p.range + e.radius && lat <= p.width / 2 + e.radius) hits.push({ e, along });
  });
  hits.sort((a, b) => a.along - b.along);
  const used = p.pierce ? hits : hits.slice(0, 1);
  const len = !p.pierce && used.length ? used[0].along : p.range, ex = x + dx * len, ez = z + dz * len;
  vfx.streak(x, 1.3, z, ex, 1.3, ez, color, 0.2, Math.min(len, 4));
  for (let k = 0; k < len; k += 1.2) particles.emit(x + dx * k, 1.2, z + dz * k, 0, 0.2, 0, color, 0.5, 0.3, FRAME.sparkle);
  for (const { e } of used) affect(h, e, p, { x, z });
  if (p.explode && used.length) {
    sparks(ex, 0.8, ez, 12, [color, 0xffffff], 4);
    vfx.ring(ex, 0.2, ez, color, p.explode * 1.3, 0.4);
    forEachEnemy(ctx, h.team, ex, ez, p.explode, (e) => { if (!used.some((u) => u.e === e)) affect(h, e, { ...p, dmg: 0 }, { x: ex, z: ez }); });
  }
  return used.length;
}

function explodeAt(h, ctx, x, z, R, ab, col, acc, o = {}) {
  vfx.ring(x, 0.25, z, acc, R * 1.3, 0.4);
  vfx.decal(x, z, col, R, 0.8);
  sparks(x, 0.5, z, 16, [col, acc, 0xffffff], 5);
  forEachEnemy(ctx, h.team, x, z, R, (e) => affect(h, e, ab, { x, z, ...o }));
  ctx.rig.shake(0.12 + R * 0.04);
}

const BEHAVIORS = {
  // Run forward hitting everything on the way. Variants: knock aside, trail field, chain strikes, next-basic bonus.
  dash(h, ab, ctx, aim) {
    if (ab.chain) return chainStrike(h, ab, ctx);
    const col = fx(h).color, acc = fx(h).accent, hit = new Set(), hitsAny = ab.dmg || ab.slow || ab.knock || ab.stun;
    const dist = ab.range, half = (ab.width ?? 1.4) / 2 + 0.3;
    let nextTrail = 0;
    vfx.ring(h.x, 0.25, h.z, col, 2.5, 0.3);
    if (ab.nextDmg) h.nextBasic = { dmg: ab.nextDmg, range: ab.nextRange ?? 0, t: ab.nextT ?? 3 };
    h.runScript({
      dur: 0.12 + dist * 0.018, x1: h.x + aim.dx * dist, z1: h.z + aim.dz * dist,
      tick: (h, ctx, u) => {
        particles.burst(h.x, 0.8, h.z, 3, { color: [col, acc], speed: 1.5, up: 1, size: 0.5, life: 0.4, frame: FRAME.sparkle, grav: 1 });
        if (ab.trail && u >= nextTrail) {
          nextTrail += 2 / dist;
          ctx.zones.addField({ team: h.team, src: h, x: h.x, z: h.z, r: ab.trail.w, dur: ab.trail.dur, dps: ab.trail.dps, slow: true, color: acc });
        }
        if (!hitsAny) return;
        forEachEnemy(ctx, h.team, h.x, h.z, half, (e) => {
          if (hit.has(e)) return;
          hit.add(e);
          const side = Math.sign(aim.dx * (e.z - h.z) - aim.dz * (e.x - h.x)) || 1;
          affect(h, e, { ...ab, stun: ab.endStun ? 0 : ab.stun }, { kdx: -aim.dz * side, kdz: aim.dx * side });
        });
      },
      done: (h) => {
        if (ab.endStun) for (const e of hit) if (e.alive) applyStatus(e, 'stun', ab.endStun);
        if (ab.selfSpd) addBuff(h, 'speed', ab.selfSpd, ab.selfSpdT ?? 3);
        if (hit.size && ab.endStun) sparks(h.x, 0.8, h.z, 8, acc);
      },
    });
  },

  // Jump toward the aim point; the landing is a nova / field / radial bolts.
  leap(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, d = Math.min(aim.dist, ab.range);
    vfx.ring(h.x, 0.25, h.z, col, 2.2, 0.3);
    h.runScript({
      dur: ab.dur ?? 0.45, x1: h.x + aim.dx * d, z1: h.z + aim.dz * d, h: ab.height ?? 3.5,
      tick: (h) => particles.burst(h.x, GROUND + 1 + h.yOff, h.z, 2, { color: [col, acc], speed: 1, up: 0.5, size: 0.8, life: 0.5, frame: FRAME.sparkle, grav: 0 }),
      done: (h, ctx) => {
        if (ab.radius) explodeAt(h, ctx, h.x, h.z, ab.radius, ab, col, acc);
        else vfx.ring(h.x, 0.25, h.z, acc, 3, 0.4);
        if (ab.fieldAfter) ctx.zones.addField({ team: h.team, src: h, x: h.x, z: h.z, color: acc, ...ab.fieldAfter });
        if (ab.aspd) addBuff(h, 'aspd', ab.aspd, ab.aspdT ?? 2);
        if (ab.radial) {
          for (let k = 0; k < ab.radial.n; k++) {
            const a = (k / ab.radial.n) * Math.PI * 2;
            fireBolt(h, ctx, h.x, h.z, Math.cos(a), Math.sin(a), { range: ab.radial.range, width: 0.9, dmg: ab.radial.dmg, pierce: true }, acc);
          }
        }
      },
    });
  },

  // Teleport onto the nearest enemy hero (or forward) and strike on arrival.
  blink(h, ab, ctx, aim) {
    let t = pickTarget(ctx, h.team, h.x, h.z, ab.range, ['heroes']);
    if (t && aim.manual) { // an aimed blink only locks on to a hero near the aimed line
      const rx = t.x - h.x, rz = t.z - h.z, along = rx * aim.dx + rz * aim.dz, lat = Math.abs(rx * aim.dz - rz * aim.dx);
      if (along <= 0 || lat > 2 + t.radius) t = null;
    }
    let dx = aim.dx, dz = aim.dz, d = aim.manual ? Math.min(aim.dist, ab.range) : ab.range;
    if (t) {
      dx = t.x - h.x; dz = t.z - h.z;
      const full = Math.hypot(dx, dz) || 1;
      dx /= full; dz /= full;
      d = Math.max(0, full - h.radius - t.radius - 0.2);
    }
    vfx.ghost(h.x, h.z, fx(h).accent, 0.5);
    h.runScript({
      dur: 0.1, x1: h.x + dx * d, z1: h.z + dz * d, h: 0.6,
      done: (h) => {
        vfx.ring(h.x, 0.25, h.z, fx(h).color, 3, 0.3);
        if (t?.alive) { affect(h, t, ab); sparks(t.x, 1, t.z, 10, [fx(h).accent, 0xffffff], 4); }
      },
    });
  },

  // Burst around the hero. Optional expand delay, second pulse, self shield / haste, ally heal.
  nova(h, ab, ctx) {
    const col = fx(h).color, acc = fx(h).accent, R = ab.radius, cx = h.x, cz = h.z, wait = ab.expand ?? 0;
    const pulse = () => {
      vfx.ring(cx, 0.25, cz, acc, R * 1.2, wait || 0.4);
      vfx.decal(cx, cz, col, R, 0.6);
      sparks(cx, 0.6, cz, 14, [col, acc], R * 1.3);
      forEachEnemy(ctx, h.team, cx, cz, R, (e) => affect(h, e, ab, { x: cx, z: cz }));
      if (ab.heal) forEachAlly(ctx, h.team, cx, cz, R, (a) => heal(a, ab.heal));
      ctx.rig.shake(0.1 + R * 0.03);
    };
    if (ab.shield) giveShield(h, ab.shield, ab.dur ?? 2);
    if (ab.spd) addBuff(h, 'speed', ab.spd, ab.spdT ?? 2);
    if (wait) ctx.later(wait, pulse); else pulse();
    if (ab.pulse2) ctx.later(wait + ab.pulse2, pulse);
    if (wait) vfx.ring(cx, 0.25, cz, col, R * 1.1, wait);
  },

  // Fan in front of the hero; waves repeat (channels such as Bullet Storm re-aim each wave).
  cone(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, waves = ab.waves ?? 1, gap = ab.gap ?? 0, half = (ab.arc / 2) * DEG;
    let base = Math.atan2(aim.dx, aim.dz);
    const wave = (i) => {
      if (!h.alive || h.stun > 0) return;
      if (ab.track) {
        const t = pickTarget(ctx, h.team, h.x, h.z, ab.range, ['heroes', 'minions']);
        if (t) base = Math.atan2(t.x - h.x, t.z - h.z);
      }
      const dx = Math.sin(base), dz = Math.cos(base);
      h.face = base; h.faceHold = 0.3;
      vfx.arc(h.x, GROUND + 0.9, h.z, dx, dz, i % 2 ? acc : col, ab.range, 0.25);
      for (let k = 0; k < 6; k++) {
        const a = base + (Math.random() - 0.5) * 2 * half, r = rand(1, ab.range);
        particles.emit(h.x + Math.sin(a) * r, 0.8, h.z + Math.cos(a) * r, Math.sin(a) * 3, 0.4, Math.cos(a) * 3, k % 2 ? acc : col, 0.5, 0.3, FRAME.sparkle);
      }
      forEachEnemy(ctx, h.team, h.x, h.z, ab.range, (e) => {
        const rx = e.x - h.x, rz = e.z - h.z, d = Math.hypot(rx, rz) || 1;
        if (d > 0.6 && Math.acos(clamp((rx * dx + rz * dz) / d, -1, 1)) > half + Math.atan2(e.radius, d)) return;
        affect(h, e, ab, { air: ab.air1 && i === 0 });
      });
      if (!ab.track) ctx.rig.shake(0.12);
    };
    wave(0);
    for (let i = 1; i < waves; i++) ctx.later(i * gap, () => wave(i));
    if (waves > 1 && gap) {
      h.effects.push({
        t: 0, dur: (waves - 1) * gap + 0.05,
        update(h) { h.noAttack = true; if (ab.moveMul != null) h.moveMul = ab.moveMul; },
      });
    }
  },

  // Telegraphed strike(s) at the best enemy cluster, or at the lowest-HP enemy hero (`target: 'lowhero'`).
  blast(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, tg = telegraph(h), delay = ab.delay ?? 0.5, R = ab.radius;
    let pts;
    if (ab.target === 'lowhero') {
      pts = ctx.heroes
        .filter((e) => e.team !== h.team && e.alive && !e.hidden && !e.untarget && Math.hypot(e.x - h.x, e.z - h.z) - e.radius <= ab.range)
        .sort((a, b) => a.hp - b.hp).slice(0, ab.strikes ?? 1).map((e) => ({ x: e.x, z: e.z }));
      if (!pts.length) return false;
    } else pts = [{ x: aim.x, z: aim.z }]; // no cluster: strike ahead of the hero

    const x0 = h.x, z0 = h.z;
    for (const { x, z } of pts) {
      vfx.decal(x, z, tg, R, delay + 0.15);
      vfx.ring(x, 0.2, z, tg, R * 1.1, delay);
      if (ab.sky) vfx.streak(x + 4, 12, z, x, 0.3, z, acc, Math.min(delay, 0.5), 3.5);
      else {
        ctx.anim(delay, (u) => particles.emit(lerp(x0, x, u), GROUND + 1.4 + Math.sin(Math.PI * u) * 2.4, lerp(z0, z, u), 0, 0, 0, acc, 0.9, 0.3, FRAME.dot));
      }
      ctx.later(delay, () => {
        explodeAt(h, ctx, x, z, R, ab, col, acc);
        if (ab.fieldAfter) ctx.zones.addField({ team: h.team, src: h, x, z, color: col, r: R, ...ab.fieldAfter });
        if (ab.split) {
          for (let k = 0; k < ab.split.n; k++) {
            const a = (k / ab.split.n) * Math.PI * 2 + 0.5, mx = x + Math.cos(a) * R * 0.9, mz = z + Math.sin(a) * R * 0.9;
            ctx.later(0.2, () => explodeAt(h, ctx, mx, mz, ab.split.r, { dmg: ab.split.dmg }, col, acc));
          }
        }
      });
    }
  },

  // Many small blasts scattered over an area.
  rain(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, tg = telegraph(h), A = ab.radius, n = ab.count, step = ab.dur / n;
    vfx.decal(aim.x, aim.z, tg, A, ab.dur + 0.4);
    vfx.ring(aim.x, 0.2, aim.z, tg, A * 1.2, 0.5);
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), r = Math.sqrt(Math.random()) * A, px = aim.x + Math.cos(a) * r, pz = aim.z + Math.sin(a) * r;
      ctx.later(0.1 + i * step, () => {
        vfx.streak(px + 5.5, 9.5, pz, px, 0.3, pz, i % 2 ? acc : col, 0.35);
        ctx.later(0.35, () => explodeAt(h, ctx, px, pz, ab.blastR, ab, col, acc));
      });
    }
  },

  // Shield / heal / cleanse / haste on self and nearby allies; stealth + next-basic bonus.
  buff(h, ab, ctx) {
    const col = fx(h).color, dur = ab.dur ?? 3, tgts = [h];
    if (ab.allyR) forEachAlly(ctx, h.team, h.x, h.z, ab.allyR, (a) => { if (a !== h) tgts.push(a); });
    for (const t of tgts) {
      const me = t === h, sh = me ? ab.shield : ab.allyShield, hp = me ? ab.heal : ab.allyHeal;
      if (sh) {
        giveShield(t, sh, dur);
        if (ab.shieldSpd) addBuff(t, 'speed', ab.shieldSpd, dur);
      }
      if (hp) heal(t, hp);
      if (ab.healPct && me) heal(t, t.maxHp * ab.healPct);
      if (ab.cleanse) t.slow = 0;
      if (ab.spd) addBuff(t, 'speed', ab.spd, ab.spdT ?? dur);
      if (ab.aspd) addBuff(t, 'aspd', ab.aspd, ab.aspdT ?? dur);
      sparks(t.x, 1, t.z, 6, [hp ? 0x3EE89A : col, 0xffffff], 2);
    }
    if (ab.lifesteal) addBuff(h, 'lifesteal', ab.lifesteal, ab.lsT ?? dur);
    if (ab.hide) {
      addBuff(h, 'hidden', 1, ab.hide);
      if (ab.nextDmg) h.nextBasic = { dmg: ab.nextDmg, range: 0, t: ab.hide + 2 };
      vfx.ghost(h.x, h.z, fx(h).accent, 0.6);
    }
    vfx.ring(h.x, 0.25, h.z, col, (ab.allyR ?? 2.5) * 1.2, 0.45);
  },

  // Line skill that yanks the first enemy toward the hero.
  hook(h, ab, ctx, aim) {
    const { dx, dz } = aim;
    let best = null, bd = Infinity;
    forEachEnemy(ctx, h.team, h.x + dx * ab.range * 0.5, h.z + dz * ab.range * 0.5, ab.range * 0.5 + 1.5, (e) => {
      if (e.type !== 'hero' && e.type !== 'minion') return;
      const rx = e.x - h.x, rz = e.z - h.z, along = rx * dx + rz * dz, lat = Math.abs(rx * dz - rz * dx);
      if (along > 0 && along <= ab.range + e.radius && lat <= (ab.width ?? 1) / 2 + e.radius && along < bd) { best = e; bd = along; }
    });
    if (!best) return false;
    const d = Math.hypot(best.x - h.x, best.z - h.z) || 1, keep = h.radius + best.radius + 0.4, move = Math.min(ab.pull, d - keep);
    vfx.link(h, best, fx(h).color, 0.6, 1, best.hitY ?? 1);
    affect(h, best, { ...ab, pull: 0 });
    if (move > 0 && best.alive) shove(best, h.x - best.x, h.z - best.z, move, 0.3);
    sparks(best.x, 1, best.z, 8, [fx(h).color, fx(h).accent]);
  },

  // Persistent zone: around self, at the best ally cluster, or a barrier wall in front.
  field(h, ab, ctx, aim) {
    const col = fx(h).color, base = { team: h.team, src: h, dur: ab.dur, color: col, slow: ab.slow, dps: ab.dps };
    if (ab.wall) {
      ctx.zones.addField({ ...base, wall: true, len: ab.wall, dx: aim.dx, dz: aim.dz, x: h.x + aim.dx * 2.6, z: h.z + aim.dz * 2.6, allySpd: ab.allySpd });
      vfx.ring(h.x + aim.dx * 2.6, 0.25, h.z + aim.dz * 2.6, col, 3, 0.4);
      return;
    }
    let x = h.x, z = h.z;
    if (aim.manual && ab.range) { x = h.x + aim.dx * Math.min(aim.dist, ab.range); z = h.z + aim.dz * Math.min(aim.dist, ab.range); }
    else if (ab.place === 'ally') {
      let best = -1;
      forEachAlly(ctx, h.team, h.x, h.z, ab.range, (a) => {
        let n = 0;
        forEachAlly(ctx, h.team, a.x, a.z, ab.r, () => n++);
        if (n > best) { best = n; x = a.x; z = a.z; }
      });
    }
    ctx.zones.addField({
      ...base, x, z, r: ab.r, follow: ab.follow ? h : null, healPs: ab.healPs,
      selfDr: ab.selfDr, allyDr: ab.allyDr, undying: ab.undying,
    });
    vfx.ring(x, 0.25, z, col, ab.r * 1.2, 0.5);
    sparks(x, 0.5, z, 12, [col, fx(h).accent], ab.r);
  },

  // Auto-firing turret placed toward the aim point.
  turret(h, ab, ctx, aim) {
    ctx.zones.addTurret(h, h.x + aim.dx * ab.range, h.z + aim.dz * ab.range, { ...ab, color: fx(h).accent });
  },

  // Channelled beam that slowly tracks the nearest enemy.
  beam(h, ab, ctx, aim) {
    let a = Math.atan2(aim.dx, aim.dz), tick = 0;
    const L = ab.range, step = { ...ab, dmg: ab.dps * 0.2 };
    h.beam = { a, len: L, w: ab.width };
    h.effects.push({
      t: 0, dur: ab.dur,
      update(h, dt, ctx) {
        const t = pickTarget(ctx, h.team, h.x, h.z, L, ['heroes', 'minions']);
        if (t) a = angleLerp(a, Math.atan2(t.x - h.x, t.z - h.z), 1 - Math.exp(-6 * dt));
        h.beam.a = a;
        h.face = a; h.faceHold = 0.2; h.moveMul = 0.35; h.noAttack = true;
        const k = Math.random() * L;
        particles.emit(h.x + Math.sin(a) * k, 0.4, h.z + Math.cos(a) * k, rand(-1, 1), 1.5, rand(-1, 1), Math.random() < 0.5 ? fx(h).accent : 0xffffff, 0.6, 0.4, FRAME.sparkle, 2);
        if ((tick -= dt) > 0) return;
        tick = 0.2;
        const bx = Math.sin(a), bz = Math.cos(a);
        forEachEnemy(ctx, h.team, h.x + bx * L * 0.5, h.z + bz * L * 0.5, L * 0.5 + 2, (e) => {
          const rx = e.x - h.x, rz = e.z - h.z, along = rx * bx + rz * bz, lat = Math.abs(rx * bz - rz * bx);
          if (along > 0 && along <= L + e.radius && lat <= ab.width / 2 + e.radius) affect(h, e, step);
        });
      },
      end(h) { h.beam = null; },
    });
  },

  // Ranged line shot (hitscan with a streak): count / spread fans, pierce, windup, impact burst.
  bolt(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, base = Math.atan2(aim.dx, aim.dz), n = ab.count ?? 1;
    const fire = () => {
      if (!h.alive) return;
      for (let k = 0; k < n; k++) {
        const a = base + (n > 1 ? (k / (n - 1) - 0.5) * (ab.spread ?? 0) * DEG : 0);
        fireBolt(h, ctx, h.x, h.z, Math.sin(a), Math.cos(a), ab, k % 2 ? col : acc);
      }
      ctx.rig.shake(0.1);
    };
    if (ab.delay) {
      vfx.ring(h.x, 0.25, h.z, acc, 2, ab.delay);
      ctx.later(ab.delay, fire);
    } else fire();
  },
  // Hidden-ish mine at the aim point: arms briefly, then detonates on the first enemy that steps close.
  trap(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, d = Math.min(aim.dist, ab.range), x = h.x + aim.dx * d, z = h.z + aim.dz * d, arm = ab.arm ?? 0.6;
    vfx.ring(x, 0.2, z, acc, ab.radius * 0.9, 0.4);
    let done = false, blink = 0;
    ctx.anim(ab.dur, (u, dt) => {
      if (done) return;
      const age = u * ab.dur;
      if ((blink -= dt) <= 0) { blink = 0.5; vfx.decal(x, z, h.team === 0 ? col : acc, ab.trigger ?? 1, 0.4); }
      if (age < arm) return;
      let hit = false;
      forEachEnemy(ctx, h.team, x, z, ab.trigger ?? 1.3, (e) => { if (e.type === 'hero' || e.type === 'minion') hit = true; });
      if (!hit) return;
      done = true;
      explodeAt(h, ctx, x, z, ab.radius, ab, col, acc);
      if (ab.fieldAfter) ctx.zones.addField({ team: h.team, src: h, x, z, color: col, r: ab.radius, ...ab.fieldAfter });
    });
  },

  // Leave a glowing double behind, vanish and sprint; the double bursts after a beat.
  decoy(h, ab, ctx) {
    const col = fx(h).color, acc = fx(h).accent, x = h.x, z = h.z;
    addBuff(h, 'hidden', 1, ab.hide);
    if (ab.spd) addBuff(h, 'speed', ab.spd, ab.spdT ?? ab.hide);
    ctx.anim(ab.delay, (u) => {
      if (u < 1) { if (Math.random() < 0.5) vfx.ghost(x, z, u > 0.6 ? col : acc, 0.3); return; }
      explodeAt(h, ctx, x, z, ab.radius, ab, col, acc);
    });
    vfx.ghost(x, z, acc, ab.delay);
    vfx.ring(x, 0.25, z, col, ab.radius * 0.8, ab.delay);
  },
};

// Chain strike: blink between nearby enemies hitting each, untargetable throughout.
function chainStrike(h, ab, ctx) {
  const near = pickTarget(ctx, h.team, h.x, h.z, ab.range, ['heroes', 'minions']);
  if (!near) return false;
  const gap = 0.13, col = fx(h).color, acc = fx(h).accent;
  addBuff(h, 'untarget', 1, ab.chain * gap + 0.25);
  h.effects.push({ t: 0, dur: ab.chain * gap + 0.1, update(h) { h.noAttack = true; h.moveMul = 0; } });
  let last = null;
  for (let i = 0; i < ab.chain; i++) {
    ctx.later(i * gap, () => {
      if (!h.alive) return;
      const t = pickTarget(ctx, h.team, last?.x ?? h.x, last?.z ?? h.z, ab.range, ['heroes', 'minions']) ?? last;
      if (!t?.alive) return;
      last = t;
      vfx.ghost(h.x, h.z, acc, 0.35);
      const dx = h.x - t.x, dz = h.z - t.z, d = Math.hypot(dx, dz) || 1, keep = h.radius + t.radius + 0.3;
      h.x = h.px = t.x + (dx / d) * keep; h.z = h.pz = t.z + (dz / d) * keep;
      h.face = Math.atan2(t.x - h.x, t.z - h.z); h.faceHold = 0.3;
      vfx.arc(h.x, GROUND + 0.9, h.z, t.x - h.x, t.z - h.z, i % 2 ? acc : col, 2.6, 0.2);
      affect(h, t, ab);
    });
  }
}

// ---- basic attacks ----
const BASICS = {
  melee(h, ctx, t, b, dmg) {
    const dx = t.x - h.x, dz = t.z - h.z, d = Math.hypot(dx, dz) || 1, col = b.color ?? fx(h).accent;
    vfx.arc(h.x, GROUND + 0.9, h.z, dx, dz, col, h.basicRange, 0.2);
    const strike = (e, m = 1) => {
      let k = dmg * m;
      if (b.lowBonus && e.type === 'hero' && e.hp < e.maxHp * 0.5) k *= 1 + b.lowBonus;
      dealDamage(e, k, h);
      if (b.slow && e.alive) applyStatus(e, 'slow', b.slow);
    };
    if (b.cleave) {
      const half = (b.cleave / 2) * DEG;
      forEachEnemy(ctx, h.team, h.x, h.z, h.basicRange, (e) => {
        if (e === t) return;
        const rx = e.x - h.x, rz = e.z - h.z, dd = Math.hypot(rx, rz) || 1;
        if (Math.acos(clamp((rx * dx + rz * dz) / (dd * d), -1, 1)) <= half) strike(e, 0.7);
      });
    }
    strike(t);
    if (b.chain) {
      let other = null, bd = b.chain.r;
      forEachEnemy(ctx, h.team, t.x, t.z, b.chain.r, (e) => {
        const dd = Math.hypot(e.x - t.x, e.z - t.z);
        if (e !== t && e.type !== 'tower' && e.type !== 'core' && dd < bd) { other = e; bd = dd; }
      });
      if (other) { vfx.link(t, other, fx(h).accent, 0.2, 1, 1, 0.12); dealDamage(other, dmg * b.chain.mul, h); }
    }
    h.swings = (h.swings ?? 0) + 1;
    if (b.third && h.swings % 3 === 0 && t.alive) { shove(t, t.x - h.x, t.z - h.z, b.third.knock, 0.25); sparks(t.x, 1, t.z, 8, fx(h).accent, 4); }
  },

  line(h, ctx, t, b, dmg) {
    const dx = t.x - h.x, dz = t.z - h.z, d = Math.hypot(dx, dz) || 1;
    fireBolt(h, ctx, h.x, h.z, dx / d, dz / d, { range: h.basicRange, width: b.width, dmg, pierce: true }, b.color ?? fx(h).accent);
  },

  proj(h, ctx, t, b, dmg) {
    const col = b.color ?? fx(h).accent;
    ctx.projectiles.fire(h, t, dmg, b.speed ?? 15, b.arc ?? 0.3, GROUND + 1.4, {
      color: col, frame: FRAME.dot, size: b.size ?? 1.1,
      onHit: (tg) => {
        if (b.slow && tg.alive) applyStatus(tg, 'slow', b.slow);
        if (b.splash) {
          vfx.ring(tg.x, 0.2, tg.z, col, b.splash * 1.4, 0.3);
          forEachEnemy(ctx, h.team, tg.x, tg.z, b.splash, (e) => { if (e !== tg) dealDamage(e, dmg * 0.5, h); });
        }
        if (b.pierce) {
          let best = null, bd = 2.4;
          forEachEnemy(ctx, h.team, tg.x, tg.z, 2.4, (e) => { const dd = Math.hypot(e.x - tg.x, e.z - tg.z); if (e !== tg && dd < bd) { best = e; bd = dd; } });
          if (best) dealDamage(best, dmg * 0.7, h);
        }
        if (b.healAlly) {
          let low = null;
          forEachAlly(ctx, h.team, h.x, h.z, 7, (a) => { if (a.hp < a.maxHp && (!low || a.hp / a.maxHp < low.hp / low.maxHp)) low = a; });
          if (low) { heal(low, b.healAlly); sparks(low.x, 1.2, low.z, 4, 0x3EE89A, 2); }
        }
      },
    });
  },

  spread(h, ctx, t, b, dmg) {
    const base = Math.atan2(t.x - h.x, t.z - h.z), col = b.color ?? fx(h).accent, near = [];
    forEachEnemy(ctx, h.team, h.x, h.z, h.basicRange + 1, (e) => near.push(e));
    for (let k = 0; k < b.pellets; k++) {
      const a = base + (k / (b.pellets - 1) - 0.5) * b.spread * DEG, dx = Math.sin(a), dz = Math.cos(a);
      let best = null, bd = Infinity;
      for (const e of near) {
        const rx = e.x - h.x, rz = e.z - h.z, along = rx * dx + rz * dz, lat = Math.abs(rx * dz - rz * dx);
        if (along > 0 && along <= h.basicRange + e.radius && lat <= 0.45 + e.radius && along < bd) { best = e; bd = along; }
      }
      const len = best ? bd : h.basicRange;
      for (let s = 1; s < len; s += 1.5) particles.emit(h.x + dx * s, 1.2, h.z + dz * s, dx * 6, 0, dz * 6, col, 0.4, 0.2, FRAME.dot);
      if (best) dealDamage(best, dmg, h);
    }
  },
};

export { BEHAVIORS, BASICS };
