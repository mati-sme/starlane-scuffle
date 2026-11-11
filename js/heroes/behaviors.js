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
import { meleeFx, lineFx, lineHit, projOpts, spreadFx, rich } from '../render/atkfx.js';
import { inCover } from '../world/arena.js';
import { WAVE2A_BEHAVIORS } from './wave2a_beh.js';
import { WAVE2B_BEH } from './wave2b_beh.js';
import { KITS_A } from './kits_a.js';
import { KITS_B } from './kits_b.js';
import { KITS_C } from './kits_c.js';
import { KITS_D } from './kits_d.js';
import { KITS_E } from './kits_e.js';

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
  if (ab.root) applyStatus(e, 'root', ab.root);
  if (ab.charm) { applyStatus(e, 'charm', ab.charm); e.charmSrc = h; } // kid-safe 'dance': the target wanders toward the caster and cannot attack
  if (ab.air || o.air) { applyStatus(e, 'air', AIR); applyStatus(e, 'stun', AIR); }
  if (ab.knock) shove(e, o.kdx ?? e.x - ox, o.kdz ?? e.z - oz, ab.knock, 0.25);
  if (ab.pull) {
    const d = Math.hypot(ox - e.x, oz - e.z);
    if (d > 0.3) shove(e, ox - e.x, oz - e.z, Math.min(ab.pull, d), 0.3);
  }
}

const sparks = (h, x, y, z, n, c, speed = 3) =>
  particles.burst(x, y, z, n, { color: c, speed, up: 2, size: 0.55, life: 0.6, frame: fx(h).frame ?? FRAME.sparkle, grav: 2 });

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
  if (!p.quiet) { // v7.3: line basics pass quiet and draw their own look (atkfx.lineFx)
    vfx.streak(x, 1.3, z, ex, 1.3, ez, color, 0.2, Math.min(len, 4));
    vfx.beam(x + dx * 0.6, 1.3, z + dz * 0.6, ex, 1.3, ez, color, p.width ? Math.min(0.5, p.width * 0.3) : 0.3, 0.3); // the whole line flares so the shot is never missed
    vfx.flash(x + dx * 1.2, 1.4, z + dz * 1.2, color, 1.3, 0.14); // muzzle
    for (let k = 0; k < len; k += 0.8) particles.emit(x + dx * k, 1.2 + (Math.random() - 0.5) * 0.3, z + dz * k, (Math.random() - 0.5), 0.4, (Math.random() - 0.5), color, 0.6, 0.4, FRAME.sparkle);
    if (used.length) { vfx.flash(ex, 1.3, ez, color, 1.8, 0.18); vfx.ring(ex, 0.3, ez, color, 1.8, 0.25); }
  }
  for (const { e } of used) { affect(h, e, p, { x, z }); p.onHit?.(e); }
  if (p.explode && used.length) {
    sparks(h, ex, 0.8, ez, 12, [color, 0xffffff], 4);
    vfx.ring(ex, 0.2, ez, color, p.explode * 1.3, 0.4);
    forEachEnemy(ctx, h.team, ex, ez, p.explode, (e) => { if (!used.some((u) => u.e === e)) affect(h, e, { ...p, dmg: 0 }, { x: ex, z: ez }); });
  }
  return used.length;
}

function explodeAt(h, ctx, x, z, R, ab, col, acc, o = {}) {
  vfx.ring(x, 0.25, z, acc, R * 1.3, 0.4);
  vfx.ring(x, 0.3, z, 0xffffff, R * 0.7, 0.22);
  vfx.flash(x, 1, z, col, R * 1.1, 0.25);
  vfx.decal(x, z, col, R, 0.8);
  sparks(h, x, 0.5, z, 16, [col, acc, 0xffffff], 5);
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
        if (hit.size && ab.endStun) sparks(h, h.x, 0.8, h.z, 8, acc);
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
    let t = (ab.markMul && ctx.heroes.find((e) => e.team !== h.team && e.alive && !e.hidden && !e.untarget && e.mark?.src === h && Math.hypot(e.x - h.x, e.z - h.z) - e.radius <= ab.range))
      ?? pickTarget(ctx, h.team, h.x, h.z, ab.range, ['heroes']);
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
        if (t?.alive) {
          const marked = t.mark?.src === h;
          affect(h, t, marked && ab.markMul ? { ...ab, dmg: ab.dmg * ab.markMul } : ab);
          if (marked) t.mark = null;
          sparks(h, t.x, 1, t.z, 10, [fx(h).accent, 0xffffff], 4);
        }
      },
    });
  },

  // Burst around the hero. Optional expand delay, second pulse, self shield / haste, ally heal.
  nova(h, ab, ctx) {
    const col = fx(h).color, acc = fx(h).accent, R = ab.radius, cx = h.x, cz = h.z, wait = ab.expand ?? 0;
    const pulse = () => {
      vfx.ring(cx, 0.25, cz, acc, R * 1.2, wait || 0.4);
      vfx.decal(cx, cz, col, R, 0.6);
      sparks(h, cx, 0.6, cz, 14, [col, acc], R * 1.3);
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
      if (ab.undyingT) addBuff(t, 'undying', 1, ab.undyingT);
      if (ab.spd) addBuff(t, 'speed', ab.spd, ab.spdT ?? dur);
      if (ab.aspd) addBuff(t, 'aspd', ab.aspd, ab.aspdT ?? dur);
      sparks(h, t.x, 1, t.z, 6, [hp ? 0x3EE89A : col, 0xffffff], 2);
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
    sparks(h, best.x, 1, best.z, 8, [fx(h).color, fx(h).accent]);
  },

  // Persistent zone: around self, at the best ally cluster, or a barrier wall in front.
  field(h, ab, ctx, aim) {
    const col = fx(h).color, base = { team: h.team, src: h, dur: ab.dur, color: col, slow: ab.slow, dps: ab.dps };
    if (ab.wall) {
      ctx.zones.addField({ ...base, wall: true, solid: ab.solid, len: ab.wall, dx: aim.dx, dz: aim.dz, x: h.x + aim.dx * 2.6, z: h.z + aim.dz * 2.6, allySpd: ab.allySpd });
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
    sparks(h, x, 0.5, z, 12, [col, fx(h).accent], ab.r);
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
        if (!h.beam) return;
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
      end(h) { if (!h.effects.some((e) => e !== this && e.end === this.end)) h.beam = null; },
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

  // Ground slam zones: a line of telegraphed slams marching away from the hero, or rings expanding around it.
  quake(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, tg = telegraph(h);
    if (ab.rings) {
      const cx = h.x, cz = h.z, w = ab.width ?? 2;
      for (let i = 0; i < ab.rings; i++) {
        const R = (i + 1) * ab.step, wait = 0.3 + i * 0.3, last = i === ab.rings - 1;
        vfx.ring(cx, 0.2, cz, tg, R * 1.05, wait);
        ctx.later(wait, () => {
          vfx.ring(cx, 0.25, cz, acc, R * 1.15, 0.45);
          vfx.ring(cx, 0.3, cz, 0xffffff, R * 0.9, 0.2);
          vfx.decal(cx, cz, col, R, 0.7);
          for (let k = 0; k < 14; k++) {
            const a = (k / 14) * Math.PI * 2;
            particles.emit(cx + Math.cos(a) * R, 0.3, cz + Math.sin(a) * R, Math.cos(a) * 2, 3 + Math.random() * 2, Math.sin(a) * 2, k % 2 ? acc : col, 0.8, 0.5, FRAME.sparkle, 4);
          }
          ctx.rig.shake(0.18);
          forEachEnemy(ctx, h.team, cx, cz, R, (e) => {
            if (Math.hypot(e.x - cx, e.z - cz) - e.radius >= R - w) affect(h, e, ab, { x: cx, z: cz, air: last && ab.lastAir });
          });
        });
      }
      return;
    }
    for (let i = 0; i < ab.count; i++) {
      const d = 2 + i * ab.gap, x = h.x + aim.dx * d, z = h.z + aim.dz * d, wait = 0.25 + i * 0.2;
      vfx.decal(x, z, tg, ab.radius, wait + 0.15);
      vfx.ring(x, 0.2, z, tg, ab.radius * 1.1, wait);
      ctx.later(wait, () => explodeAt(h, ctx, x, z, ab.radius, ab, col, acc));
    }
  },

  // Thrown blade: flies out along the aim line, hits everything once, then curves back to the hero and hits again.
  boomerang(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, ox = h.x, oz = h.z, fx1 = ox + aim.dx * ab.range, fz1 = oz + aim.dz * ab.range;
    const half = (ab.width ?? 1.4) / 2 + 0.2, seen = [new Set(), new Set()];
    let flare = 0;
    ctx.anim(ab.dur ?? 1.2, (u, dt) => {
      if (u >= 1) return;
      const out = u < 0.5, k = Math.sin((out ? u * 2 : (1 - u) * 2) * Math.PI / 2);
      const x = out ? lerp(ox, fx1, k) : lerp(h.x, fx1, k), z = out ? lerp(oz, fz1, k) : lerp(h.z, fz1, k);
      particles.emit(x, 1.2, z, rand(-1, 1), 0.3, rand(-1, 1), Math.random() < 0.5 ? col : acc, 0.9, 0.35, FRAME.sparkle);
      if ((flare -= dt) <= 0) { flare = 0.07; vfx.arc(x, 1.2, z, Math.cos(u * 40), Math.sin(u * 40), acc, 1.8, 0.12); }
      forEachEnemy(ctx, h.team, x, z, half, (e) => {
        const set = seen[out ? 0 : 1];
        if (set.has(e)) return;
        set.add(e);
        affect(h, e, ab, { x, z });
        sparks(h, e.x, 1, e.z, 6, [acc, 0xffffff], 3);
      });
    });
  },

  // Blades circle the hero for a while, cutting anything they touch (each enemy at most every half second).
  orbit(h, ab, ctx) {
    const col = fx(h).color, acc = fx(h).accent, last = new Map();
    let ang = 0, tick = 0, age = 0;
    vfx.ring(h.x, 0.25, h.z, col, ab.r * 1.6, 0.4);
    h.effects.push({
      t: 0, dur: ab.dur,
      update(h, dt, ctx) {
        age += dt; ang += dt * 7;
        const pts = [];
        for (let k = 0; k < ab.blades; k++) {
          const a = ang + (k / ab.blades) * Math.PI * 2, x = h.x + Math.cos(a) * ab.r, z = h.z + Math.sin(a) * ab.r;
          pts.push({ x, z });
          particles.emit(x, 1.1, z, -Math.sin(a) * 2, 0.2, Math.cos(a) * 2, k % 2 ? acc : col, 1.1, 0.3, FRAME.sparkle);
          particles.emit(x, 1.1, z, 0, 0, 0, 0xffffff, 0.5, 0.15, FRAME.dot);
        }
        if ((tick -= dt) > 0) return;
        tick = 0.1;
        for (const p of pts) {
          forEachEnemy(ctx, h.team, p.x, p.z, 1.0, (e) => {
            if (age - (last.get(e) ?? -9) < 0.5) return;
            last.set(e, age);
            affect(h, e, ab, { x: h.x, z: h.z });
            sparks(h, e.x, 1, e.z, 6, [acc, 0xffffff], 3);
          });
        }
      },
    });
  },

  // Hex dart: the first enemy hit is marked for a while (see detonate / the blink finisher / basic-attack bonus).
  mark(h, ab, ctx, aim) {
    const col = fx(h).color;
    fireBolt(h, ctx, h.x, h.z, aim.dx, aim.dz, { ...ab, onHit: (e) => putMark(h, e, ab, ctx, col) }, fx(h).accent);
  },

  // Pop every mark this hero placed in range: damage per mark (+ % max HP on heroes).
  detonate(h, ab, ctx) {
    const col = fx(h).color, acc = fx(h).accent, hits = [];
    forEachEnemy(ctx, h.team, h.x, h.z, ab.range, (e) => { if (e.mark?.src === h) hits.push(e); });
    if (!hits.length) return false;
    vfx.ring(h.x, 0.25, h.z, col, 2.5, 0.3);
    for (const e of hits) {
      e.mark = null;
      vfx.link(h, e, acc, 0.3, 1, e.hitY ?? 1);
      vfx.ring(e.x, 0.3, e.z, col, 3, 0.4);
      vfx.ring(e.x, 0.4, e.z, 0xffffff, 1.8, 0.2);
      vfx.flash(e.x, (e.hitY ?? 1) + 0.4, e.z, col, 2.6, 0.25);
      sparks(h, e.x, 1, e.z, 14, [col, acc, 0xffffff], 5);
      affect(h, e, { ...ab, dmg: ab.dmg + (e.type === 'hero' ? e.maxHp * (ab.pct ?? 0) : 0) }, { x: h.x, z: h.z });
    }
    ctx.rig.shake(0.15);
  },

  // Gravity well at the aim point: drags enemies inward and burns them, then collapses for a burst.
  vortex(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, R = ab.radius, d = Math.min(aim.dist, ab.range), x = h.x + aim.dx * d, z = h.z + aim.dz * d;
    let tick = 0, vis = 0;
    vfx.rune(x, z, acc, R * 1.6, ab.dur);
    vfx.ring(x, 0.25, z, col, R * 1.3, 0.5);
    ctx.anim(ab.dur, (u, dt) => {
      if (u >= 1) return;
      forEachEnemy(ctx, h.team, x, z, R, (e) => {
        if (e.type !== 'hero' && e.type !== 'minion') return;
        const dx = x - e.x, dz = z - e.z, dd = Math.hypot(dx, dz);
        if (dd > 0.5) { const s = Math.min(ab.pull * dt, dd - 0.4); e.x += (dx / dd) * s; e.z += (dz / dd) * s; }
      });
      if ((tick -= dt) <= 0) {
        tick = 0.25;
        forEachEnemy(ctx, h.team, x, z, R, (e) => affect(h, e, { dmg: ab.dps * 0.25, slow: ab.slow, slowT: 0.5 }, { x, z }));
      }
      for (let k = 0; k < 3; k++) {
        const a = Math.random() * Math.PI * 2, r = R * (0.5 + Math.random() * 0.5);
        particles.emit(x + Math.cos(a) * r, 0.4 + Math.random() * 1.2, z + Math.sin(a) * r, -Math.cos(a) * 3 - Math.sin(a) * 3, 0.3, -Math.sin(a) * 3 + Math.cos(a) * 3, k % 2 ? acc : col, 0.8, 0.4, FRAME.sparkle);
      }
      if ((vis -= dt) <= 0) { vis = 0.45; vfx.decal(x, z, col, R, 0.55); }
    });
    ctx.later(ab.dur, () => {
      explodeAt(h, ctx, x, z, R, { dmg: ab.endDmg, stun: ab.endStun }, col, acc);
    });
  },

  // Pinball shot: hitscan to the first enemy in line, then ricochets between nearby enemies with falling damage.
  // `shots` makes it a channel that fires at the nearest enemy each time.
  ricochet(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent;
    if (!ab.shots) {
      const first = firstInLine(ctx, h, aim.dx, aim.dz, ab.range, ab.width ?? 1);
      if (first) bounceChain(h, ctx, ab, first, col, acc);
      else {
        vfx.streak(h.x, 1.3, h.z, h.x + aim.dx * ab.range, 1.3, h.z + aim.dz * ab.range, col, 0.2, 4);
        vfx.beam(h.x, 1.3, h.z, h.x + aim.dx * ab.range, 1.3, h.z + aim.dz * ab.range, col, 0.15, 0.2);
      }
      return;
    }
    for (let i = 0; i < ab.shots; i++) {
      ctx.later(i * ab.gap, () => {
        if (!h.alive || h.stun > 0) return;
        const t = pickTarget(ctx, h.team, h.x, h.z, ab.range, ['heroes', 'minions']);
        if (!t) return;
        h.face = Math.atan2(t.x - h.x, t.z - h.z); h.faceHold = 0.3;
        bounceChain(h, ctx, ab, t, i % 2 ? acc : col, i % 2 ? col : acc);
      });
    }
    h.effects.push({ t: 0, dur: (ab.shots - 1) * ab.gap + 0.05, update(h) { h.noAttack = true; h.moveMul = ab.moveMul ?? 0.7; } });
  },

  // Soul tether: link to the most hurt ally in range; heals them (and damage-reduces them) while the link holds.
  tether(h, ab, ctx) {
    let ally = null;
    forEachAlly(ctx, h.team, h.x, h.z, ab.range, (a) => {
      if (a !== h && (!ally || a.hp / a.maxHp < ally.hp / ally.maxHp)) ally = a;
    });
    if (!ally) return false;
    const col = fx(h).color, acc = fx(h).accent;
    let tick = 0;
    vfx.ring(ally.x, 0.25, ally.z, col, 2.5, 0.4);
    h.effects.push({
      t: 0, dur: ab.dur,
      update(h, dt) {
        if (!ally.alive || Math.hypot(ally.x - h.x, ally.z - h.z) > ab.breakR) { this.t = this.dur; return; }
        if (ab.dr) addBuff(ally, 'dr', ab.dr, 0.3);
        if ((tick -= dt) > 0) return;
        tick = 0.25;
        heal(ally, ab.healPs * 0.25);
        vfx.link(h, ally, tick % 0.5 ? col : acc, 0.3, 1.2, ally.hitY ?? 1.1, 0.14);
        sparks(h, ally.x, 1.2, ally.z, 3, [col, acc], 1.5);
      },
    });
  },
  // Travelling skillshot: a visible projectile flies along the aim line (not hitscan) and stops on the first hit unless it pierces.
  // `shape` picks the look (orb / boulder / disc / arrow / wave / spear); `splash` bursts where it lands or ends.
  missile(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, L = ab.range, sp = ab.speed ?? 14, half = (ab.width ?? 1) / 2 + 0.15;
    const ox = h.x, oz = h.z, seen = new Set(), shape = ab.shape ?? 'orb';
    let dead = false, flare = 0;
    const land = (x, z) => {
      dead = true;
      if (ab.splash) explodeAt(h, ctx, x, z, ab.splash, { ...ab, dmg: ab.splashDmg ?? ab.dmg * 0.6 }, col, acc);
      else { vfx.flash(x, 1.2, z, col, 2, 0.2); sparks(h, x, 0.8, z, 8, [col, acc], 4); }
    };
    vfx.flash(ox + aim.dx * 1.2, 1.3, oz + aim.dz * 1.2, col, 1.6, 0.15);
    ctx.anim(L / sp + 0.05, (u, dt) => {
      if (dead) return;
      const d = Math.min(1, u) * L, x = ox + aim.dx * d, z = oz + aim.dz * d;
      if (ctx.zones.blocks(h.team, x, z) || inCover(x, z)) { land(x, z); return; }
      if ((flare -= dt) <= 0) {
        flare = shape === 'disc' ? 0.06 : 0.09;
        if (shape === 'orb') { vfx.flash(x, 1.3, z, col, 1.8, 0.14); vfx.ring(x, 1.3, z, acc, 1.2, 0.2); }
        else if (shape === 'boulder') { vfx.flash(x, 1.0, z, col, 2.8, 0.18); vfx.ring(x, 0.3, z, acc, 2.6, 0.25); vfx.decal(x, z, col, 1.4, 0.3); particles.burst(x, 0.5, z, 4, { color: [col, acc], speed: 2.5, up: 3, size: 0.9, life: 0.5, frame: FRAME.dot, grav: 8 }); }
        else if (shape === 'disc') { vfx.ring(x, 0.5, z, col, 2.6, 0.22); vfx.ring(x, 1.3, z, acc, 2.0, 0.22); vfx.ring(x, 2.1, z, col, 1.4, 0.22); }
        else if (shape === 'arrow') vfx.streak(x - aim.dx * 2.2, 1.3, z - aim.dz * 2.2, x + aim.dx, 1.3, z + aim.dz, col, 0.16, 3.2);
        else if (shape === 'wave') { vfx.arc(x, 1.1, z, aim.dx, aim.dz, col, 3 + (ab.width ?? 1), 0.22); vfx.arc(x - aim.dx * 0.6, 1.1, z - aim.dz * 0.6, aim.dx, aim.dz, acc, 2.2, 0.2); }
        else if (shape === 'spear') { vfx.beam(x - aim.dx * 1.6, 1.3, z - aim.dz * 1.6, x + aim.dx * 0.6, 1.3, z + aim.dz * 0.6, col, 0.22, 0.14); vfx.flash(x + aim.dx * 0.6, 1.3, z + aim.dz * 0.6, acc, 1.0, 0.1); } // v7.3: spearhead keeps the lance color
      }
      particles.emit(x + rand(-0.3, 0.3), 1.1 + rand(-0.3, 0.4), z + rand(-0.3, 0.3), 0, 0.3, 0, Math.random() < 0.5 ? col : acc, 0.7, 0.4, fx(h).frame ?? FRAME.sparkle);
      let stopped = false;
      forEachEnemy(ctx, h.team, x, z, half, (e) => {
        if (seen.has(e) || stopped || (e.type === 'core')) return;
        seen.add(e);
        affect(h, e, ab, { x: ox, z: oz, kdx: aim.dx, kdz: aim.dz });
        sparks(h, e.x, 1, e.z, 8, [col, acc], 4);
        if (!ab.pierce) stopped = true;
      });
      if (stopped) land(x, z);
      else if (u >= 1) { if (ab.splash) land(x, z); else dead = true; }
    });
  },

  // Harpoon: hits the first enemy in line and drags the CASTER to it (the mirror of a hook), then strikes on arrival.
  grapple(h, ab, ctx, aim) {
    const t = firstInLine(ctx, h, aim.dx, aim.dz, ab.range, ab.width ?? 1);
    if (!t || (t.type !== 'hero' && t.type !== 'minion')) return false;
    const col = fx(h).color, acc = fx(h).accent, dx = t.x - h.x, dz = t.z - h.z, full = Math.hypot(dx, dz) || 1;
    const d = Math.max(0, full - h.radius - t.radius - 0.2);
    vfx.link(h, t, acc, 0.35, 1.2, t.hitY ?? 1);
    vfx.flash(t.x, (t.hitY ?? 1) + 0.2, t.z, col, 1.6, 0.2);
    h.runScript({
      dur: 0.1 + d * 0.025, x1: h.x + (dx / full) * d, z1: h.z + (dz / full) * d, h: 0.4,
      tick: (h) => particles.burst(h.x, 1, h.z, 2, { color: [col, acc], speed: 1.5, up: 0.5, size: 0.6, life: 0.4, frame: fx(h).frame ?? FRAME.sparkle, grav: 0 }),
      done: (h) => {
        if (t.alive) { affect(h, t, ab); sparks(h, t.x, 1, t.z, 10, [col, acc, 0xffffff], 4); }
        vfx.ring(h.x, 0.25, h.z, col, 2.4, 0.3);
      },
    });
  },

  // Rewind: snap back to where you stood `back` seconds ago (and regain the HP you had); both ends burst.
  rewind(h, ab, ctx) {
    const hist = h.hist ?? [], past = hist[Math.max(0, hist.length - 1 - Math.round((ab.back ?? 3) / 0.2))];
    if (!past) return false;
    const col = fx(h).color, acc = fx(h).accent, x0 = h.x, z0 = h.z;
    const burst = (x, z) => { vfx.ring(x, 0.25, z, col, ab.radius * 1.3, 0.4); vfx.decal(x, z, acc, ab.radius, 0.7); forEachEnemy(ctx, h.team, x, z, ab.radius, (e) => affect(h, e, ab, { x, z })); sparks(h, x, 0.8, z, 14, [col, acc, 0xffffff], 5); };
    burst(x0, z0);
    for (let i = 0; i < 6; i++) vfx.ghost(lerp(x0, past.x, i / 5), lerp(z0, past.z, i / 5), i % 2 ? col : acc, 0.5 + i * 0.05);
    h.x = h.px = past.x; h.z = h.pz = past.z;
    if (past.hp > h.hp) heal(h, Math.min(past.hp - h.hp, h.maxHp * (ab.healCap ?? 0.5)));
    h.slow = 0;
    if (ab.spd) addBuff(h, 'speed', ab.spd, ab.spdT ?? 2);
    ctx.later(0.12, () => burst(h.x, h.z));
    ctx.rig.shake(0.15);
  },

  // Swap places with the first ally (`ally`) or enemy hero / minion in line: rescue an ally, or yank a foe out of position.
  swap(h, ab, ctx, aim) {
    let best = null, bd = Infinity;
    const test = (e) => {
      if (e === h || (e.type !== 'hero' && e.type !== 'minion')) return;
      const rx = e.x - h.x, rz = e.z - h.z, along = rx * aim.dx + rz * aim.dz, lat = Math.abs(rx * aim.dz - rz * aim.dx);
      if (along > 0 && along <= ab.range + e.radius && lat <= (ab.width ?? 1.4) / 2 + e.radius && along < bd) { best = e; bd = along; }
    };
    if (ab.ally) forEachAlly(ctx, h.team, h.x + aim.dx * ab.range * 0.5, h.z + aim.dz * ab.range * 0.5, ab.range * 0.5 + 1.5, test);
    else forEachEnemy(ctx, h.team, h.x + aim.dx * ab.range * 0.5, h.z + aim.dz * ab.range * 0.5, ab.range * 0.5 + 1.5, test);
    if (!best) return false;
    const col = fx(h).color, acc = fx(h).accent, t = best, hx = h.x, hz = h.z;
    vfx.ghost(hx, hz, acc, 0.5); vfx.ghost(t.x, t.z, col, 0.5);
    vfx.link(h, t, col, 0.35, 1.1, t.hitY ?? 1.1);
    h.x = h.px = t.x; h.z = h.pz = t.z;
    t.x = hx; t.z = hz; if (t.px != null) { t.px = hx; t.pz = hz; }
    vfx.ring(h.x, 0.25, h.z, col, 2.6, 0.35); vfx.ring(t.x, 0.25, t.z, acc, 2.6, 0.35);
    if (ab.ally) { if (ab.allyShield) giveShield(t, ab.allyShield, ab.dur ?? 2); if (ab.allyHeal) heal(t, ab.allyHeal); if (ab.allySpd) addBuff(t, 'speed', ab.allySpd, ab.allySpdT ?? 2); }
    else affect(h, t, ab, { x: hx, z: hz });
    if (ab.spd) addBuff(h, 'speed', ab.spd, ab.spdT ?? 2);
    sparks(h, t.x, 1, t.z, 10, [col, acc, 0xffffff], 4);
  },

  // Placed totem: a pulsing ward (`mode`: heal allies / slow + hurt enemies / bump enemies away) or a shooting turret.
  totem(h, ab, ctx, aim) {
    const d = Math.min(aim.dist, ab.range);
    ctx.zones.addTurret(h, h.x + aim.dx * d, h.z + aim.dz * d, { ...ab, color: fx(h).color, accent: fx(h).accent });
  },

  // Moving spin: blades whirl around the hero for a few seconds while it keeps running; ticks damage, optional shield.
  whirl(h, ab, ctx) {
    const col = fx(h).color, acc = fx(h).accent;
    let tick = 0, ang = 0;
    if (ab.shield) giveShield(h, ab.shield, ab.dur);
    vfx.ring(h.x, 0.25, h.z, col, ab.r * 1.8, 0.4);
    h.effects.push({
      t: 0, dur: ab.dur,
      update(h, dt, ctx) {
        h.spin = 1; h.noAttack = true; h.moveMul = ab.moveMul ?? 1.1;
        ang += dt * 9;
        for (let k = 0; k < 2; k++) {
          const a = ang + k * Math.PI;
          vfx.arc(h.x, 1.0, h.z, Math.cos(a), Math.sin(a), k ? acc : col, ab.r * 1.7, 0.12);
        }
        particles.emit(h.x + Math.cos(ang) * ab.r, 0.9, h.z + Math.sin(ang) * ab.r, 0, 0.4, 0, acc, 0.8, 0.3, fx(h).frame ?? FRAME.sparkle);
        if ((tick -= dt) > 0) return;
        tick = 0.25;
        forEachEnemy(ctx, h.team, h.x, h.z, ab.r, (e) => affect(h, e, { ...ab, dmg: ab.dps * 0.25, stun: 0 }, { x: h.x, z: h.z }));
        ctx.rig.shake(0.05);
      },
    });
  },
};

// Marks live until their timer runs out or the target falls; the head sparkle keeps them visible.
function putMark(h, e, ab, ctx, col) {
  if (!e.alive || e.type === 'tower' || e.type === 'core') return;
  const m = { src: h };
  let vis = 0;
  e.mark = m;
  ctx.anim(ab.markT, (u, dt) => {
    if (e.mark !== m) return;
    if (u >= 1 || !e.alive) { e.mark = null; return; }
    particles.emit(e.x + rand(-0.4, 0.4), (e.hitY ?? 1) + 1, e.z + rand(-0.4, 0.4), 0, 1.2, 0, col, 0.7, 0.4, FRAME.sparkle);
    if ((vis -= dt) <= 0) { vis = 0.5; vfx.flash(e.x, (e.hitY ?? 1) + 1.3, e.z, col, 1.2, 0.3); }
  });
}

// First enemy (hero / minion / structure) along a line from the hero.
function firstInLine(ctx, h, dx, dz, range, width) {
  let best = null, bd = Infinity;
  forEachEnemy(ctx, h.team, h.x + dx * range * 0.5, h.z + dz * range * 0.5, range * 0.5 + 1.5, (e) => {
    const rx = e.x - h.x, rz = e.z - h.z, along = rx * dx + rz * dz, lat = Math.abs(rx * dz - rz * dx);
    if (along > 0 && along <= range + e.radius && lat <= width / 2 + e.radius && along < bd) { best = e; bd = along; }
  });
  return best;
}

// The chain of enemies a pinball shot visits (planned now, applied 90 ms apart so the bounces read).
function bounceChain(h, ctx, ab, first, col, acc) {
  const path = [first], seen = new Set([first]);
  while (path.length <= ab.bounces) {
    const from = path[path.length - 1];
    let next = null, bd = ab.bounceR;
    forEachEnemy(ctx, h.team, from.x, from.z, ab.bounceR, (e) => {
      const dd = Math.hypot(e.x - from.x, e.z - from.z);
      if (!seen.has(e) && e.type !== 'tower' && e.type !== 'core' && dd < bd) { next = e; bd = dd; }
    });
    if (!next) break;
    seen.add(next); path.push(next);
  }
  let px = h.x, pz = h.z, dmg = ab.dmg;
  path.forEach((e, i) => {
    const fx0 = px, fz0 = pz, d = dmg;
    ctx.later(i * 0.09, () => {
      vfx.streak(fx0, 1.3, fz0, e.x, (e.hitY ?? 1) + 0.2, e.z, col, 0.18, 4);
      vfx.beam(fx0, 1.3, fz0, e.x, (e.hitY ?? 1) + 0.2, e.z, col, 0.14, 0.2);
      vfx.ring(e.x, 0.3, e.z, acc, 2, 0.25);
      if (e.alive) { affect(h, e, { ...ab, dmg: d }, { x: fx0, z: fz0 }); sparks(h, e.x, 1, e.z, 8, [col, acc, 0xffffff], 4); }
    });
    px = e.x; pz = e.z; dmg *= ab.falloff ?? 0.8;
  });
}

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

// Melee swing looks: every champion's basic reads differently (crescent, ground slam, thrust, claws, double spin, uppercut).
const SWINGS = {
  slash: (h, t, dx, dz, col) => {
    vfx.arc(h.x, GROUND + 0.9, h.z, dx, dz, col, h.basicRange, 0.2);
    vfx.arc(h.x, GROUND + 1.3, h.z, dx, dz, col, h.basicRange * 0.75, 0.14);
  },
  slam: (h, t, dx, dz, col) => { // ground-pounding tanks: ring + crater at the target
    vfx.ring(t.x, 0.25, t.z, col, 2.6, 0.3); vfx.decal(t.x, t.z, col, 1.4, 0.5);
    particles.burst(t.x, 0.4, t.z, 6, { color: col, speed: 3, up: 3, size: 0.8, life: 0.5, frame: FRAME.dot, grav: 8 });
  },
  stab: (h, t, dx, dz, col) => { // thrust: a bright lance of light
    vfx.beam(h.x + dx * 0.5, 1.2, h.z + dz * 0.5, h.x + dx * h.basicRange, 1.2, h.z + dz * h.basicRange, col, 0.18, 0.16);
    vfx.flash(h.x + dx * h.basicRange, 1.2, h.z + dz * h.basicRange, col, 1.1, 0.12);
  },
  claw: (h, t, dx, dz, col) => { // three parallel rakes
    for (let k = -1; k <= 1; k++) vfx.arc(h.x - dz * k * 0.45, GROUND + 0.9 + k * 0.25, h.z + dx * k * 0.45, dx, dz, col, h.basicRange * 0.9, 0.16);
  },
  spin: (h, t, dx, dz, col) => { // two opposite crescents
    vfx.arc(h.x, GROUND + 0.9, h.z, dx, dz, col, h.basicRange * 1.1, 0.2);
    vfx.arc(h.x, GROUND + 1.2, h.z, -dx, -dz, col, h.basicRange * 0.9, 0.2);
  },
  upper: (h, t, dx, dz, col) => { // uppercut: column of sparks at the target
    vfx.arc(h.x, GROUND + 0.5, h.z, dx, dz, col, h.basicRange, 0.2);
    vfx.column(t.x, t.z, col, 0.25);
    particles.burst(t.x, 0.6, t.z, 8, { color: col, speed: 1.5, up: 7, size: 0.7, life: 0.5, frame: FRAME.star, grav: 6 });
  },
};

// ---- basic attacks ----
const BASICS = {
  melee(h, ctx, t, b, dmg) {
    const dx = t.x - h.x, dz = t.z - h.z, d = Math.hypot(dx, dz) || 1, col = b.color ?? fx(h).accent;
    if (!meleeFx(h, t, dx / d, dz / d, b)) { // v7.3: per-champion swing + impact (atkfx.js); generic look as fallback
      SWINGS[b.style ?? 'slash'](h, t, dx / d, dz / d, col, b);
      vfx.flash(t.x, (t.hitY ?? 1) + 0.2, t.z, col, 1.4, 0.16);
    }
    vfx.arc(h.x, 0.2, h.z, dx / d, dz / d, rich(col), h.basicRange * 1.05, 0.28); // ground crescent: every swing leaves a readable sweep
    const strike = (e, m = 1) => {
      let k = dmg * m;
      if (b.lowBonus && e.type === 'hero' && e.hp < e.maxHp * 0.5) k *= 1 + b.lowBonus;
      if (b.markBonus && e.mark?.src === h) k *= 1 + b.markBonus;
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
    if (b.third && h.swings % 3 === 0 && t.alive) { shove(t, t.x - h.x, t.z - h.z, b.third.knock, 0.25); sparks(h, t.x, 1, t.z, 8, fx(h).accent, 4); }
  },

  line(h, ctx, t, b, dmg) {
    const dx = t.x - h.x, dz = t.z - h.z, d = Math.hypot(dx, dz) || 1;
    fireBolt(h, ctx, h.x, h.z, dx / d, dz / d, { range: h.basicRange, width: b.width, dmg, pierce: true, quiet: true, onHit: (e) => lineHit(h, e, b) }, b.color ?? fx(h).accent);
    lineFx(h, h.x, h.z, dx / d, dz / d, h.basicRange, b);
  },

  proj(h, ctx, t, b, dmg) {
    const col = b.color ?? fx(h).accent;
    ctx.projectiles.fire(h, t, dmg, b.speed ?? 15, b.arc ?? 0.3, GROUND + 1.4, {
      ...projOpts(h, b), // v7.3: per-champion shape / trail / impact (atkfx.js)
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
          if (low) { heal(low, b.healAlly); sparks(h, low.x, 1.2, low.z, 4, 0x3EE89A, 2); }
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
      spreadFx(h, dx, dz, len, best, b); // v7.3: big ember pellets
      if (best) dealDamage(best, dmg, h);
    }
    vfx.flash(h.x + Math.sin(base) * 0.9, 1.25, h.z + Math.cos(base) * 0.9, col, 1.5, 0.1); // muzzle
    vfx.cone(h.x + Math.sin(base) * 0.7, 1.25, h.z + Math.cos(base) * 0.7, Math.sin(base), Math.cos(base), col, 1.3, 0.55, 0.1);
  },
};

Object.assign(BEHAVIORS, WAVE2A_BEHAVIORS, WAVE2B_BEH, KITS_A, KITS_B, KITS_C, KITS_D, KITS_E);

export { BEHAVIORS, BASICS };
