// Skill kinds for wave 2 batch B (wave2b.js). Merged into BEHAVIORS by behaviors.js; same contract:
// kind(hero, ab, ctx, aim) with ab rank-resolved; return false for "nothing to hit". Each new kind names an existing
// kind in `ab.as` so aiming (aiming.js) and bots (bot.js) treat it like that one.
import { GROUND, PAL, TEAM } from '../config.js';
import { rand, lerp } from '../core/math.js';
import {
  dealDamage, forEachEnemy, forEachAlly, applyStatus, shove, pullTo, heal, addBuff, giveShield, AIR,
} from '../game/combat.js';
import { pickTarget } from '../game/targeting.js';
import { particles, FRAME } from '../render/particles.js';
import { vfx } from '../render/vfx.js';
import { BEHAVIORS, fireBolt } from './behaviors.js';

const DEG = Math.PI / 180;
const fx = (h) => h.def.fx ?? h.def;
const telegraph = (h) => (h.team === 0 ? TEAM[0].main : PAL.gloom);
const mobile = (e) => e.type === 'hero' || e.type === 'minion';

// Damage + status flags, as in behaviors.js (plus `root`).
function affect(h, e, ab, o = {}) {
  if (ab.dmg) dealDamage(e, ab.dmg * (o.mul ?? 1), h, true);
  if (!e.alive) return;
  const ox = o.x ?? h.x, oz = o.z ?? h.z;
  if (ab.stun) applyStatus(e, 'stun', ab.stun);
  if (ab.root) applyStatus(e, 'root', ab.root);
  if (ab.slow) applyStatus(e, 'slow', ab.slowT ?? 1.5);
  if (ab.air || o.air) { applyStatus(e, 'air', AIR); applyStatus(e, 'stun', AIR); }
  if (ab.knock) shove(e, o.kdx ?? e.x - ox, o.kdz ?? e.z - oz, ab.knock, 0.25);
}
const sparks = (h, x, y, z, n, c, speed = 3) =>
  particles.burst(x, y, z, n, { color: c, speed, up: 2, size: 0.55, life: 0.6, frame: fx(h).frame ?? FRAME.sparkle, grav: 2 });
function burst(h, ctx, x, z, R, ab, o = {}) {
  const col = fx(h).color, acc = fx(h).accent;
  vfx.ring(x, 0.25, z, acc, R * 1.3, 0.4);
  vfx.ring(x, 0.3, z, 0xffffff, R * 0.7, 0.22);
  vfx.flash(x, 1, z, col, R * 1.1, 0.25);
  vfx.decal(x, z, col, R, 0.8);
  sparks(h, x, 0.5, z, 16, [col, acc, 0xffffff], 5);
  forEachEnemy(ctx, h.team, x, z, R, (e) => affect(h, e, ab, { x, z, ...o }));
  ctx.rig.shake(0.12 + R * 0.04);
}
// Telegraph a point strike: red decal + shrinking ring, then fn() after `delay`.
function strikeAt(h, ctx, x, z, R, delay, fn) {
  vfx.decal(x, z, telegraph(h), R, delay + 0.15);
  vfx.ring(x, 0.2, z, telegraph(h), R * 1.1, delay);
  ctx.later(delay, fn);
}
const pointOf = (h, ab, aim) => { const d = Math.min(aim.dist, ab.range); return { x: h.x + aim.dx * d, z: h.z + aim.dz * d }; };
function firstInLine(ctx, h, dx, dz, range, width) {
  let best = null, bd = Infinity;
  forEachEnemy(ctx, h.team, h.x + dx * range * 0.5, h.z + dz * range * 0.5, range * 0.5 + 1.5, (e) => {
    const rx = e.x - h.x, rz = e.z - h.z, along = rx * dx + rz * dz, lat = Math.abs(rx * dz - rz * dx);
    if (along > 0 && along <= range + e.radius && lat <= width / 2 + e.radius && along < bd) { best = e; bd = along; }
  });
  return best;
}
// Hold an enemy within `L` of (x, z): the chain / rope of a leash.
function leash(e, x, z, L) {
  const dx = e.x - x, dz = e.z - z, d = Math.hypot(dx, dz);
  if (d > L) { e.x = x + (dx / d) * L; e.z = z + (dz / d) * L; }
}

export const WAVE2B_BEH = {
  // ── Basilisk ──
  // Cone gaze: heroes that are facing the basilisk are turned to stone (stunned); everyone else is only slowed.
  gaze(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, half = (ab.arc / 2) * DEG, base = Math.atan2(aim.dx, aim.dz);
    vfx.arc(h.x, GROUND + 1.6, h.z, aim.dx, aim.dz, col, ab.range, 0.35);
    vfx.arc(h.x, GROUND + 0.5, h.z, aim.dx, aim.dz, acc, ab.range * 0.8, 0.3);
    for (let k = 0; k < 12; k++) {
      const a = base + rand(-half, half), r = rand(1, ab.range);
      particles.emit(h.x + Math.sin(a) * r, 1.6, h.z + Math.cos(a) * r, Math.sin(a) * 2, 0, Math.cos(a) * 2, k % 2 ? col : 0xffffff, 0.6, 0.5, FRAME.star);
    }
    forEachEnemy(ctx, h.team, h.x, h.z, ab.range, (e) => {
      const rx = e.x - h.x, rz = e.z - h.z, d = Math.hypot(rx, rz) || 1;
      if (d > 0.6 && Math.acos(Math.max(-1, Math.min(1, (rx * aim.dx + rz * aim.dz) / d))) > half + Math.atan2(e.radius, d)) return;
      const looking = e.type !== 'hero' || (Math.sin(e.face) * -rx + Math.cos(e.face) * -rz) / d > 0.2;
      affect(h, e, looking ? { dmg: ab.dmg, stun: ab.stun } : { dmg: ab.dmg, slow: true, slowT: ab.slowT });
      if (looking) { vfx.ring(e.x, 0.3, e.z, acc, 1.8, 0.5); particles.burst(e.x, 1, e.z, 8, { color: [0xBFB8C8, col], speed: 1.5, up: 1, size: 0.7, life: 0.8, frame: FRAME.dot, grav: 2 }); }
    });
    ctx.rig.shake(0.1);
  },

  // Crystal shell: a shield now; when it ends the shell shatters outward — whatever shield is left adds to the hit.
  molt(h, ab, ctx) {
    const col = fx(h).color, acc = fx(h).accent;
    giveShield(h, ab.shield, ab.dur);
    vfx.ring(h.x, 0.25, h.z, col, 3, 0.5);
    sparks(h, h.x, 1.4, h.z, 14, [col, acc, 0xffffff], 2);
    let shine = 0;
    h.effects.push({
      t: 0, dur: ab.dur,
      update(h, dt) { if ((shine -= dt) <= 0) { shine = 0.3; particles.emit(h.x + rand(-0.8, 0.8), rand(0.6, 2.4), h.z + rand(-0.8, 0.8), 0, 0.6, 0, col, 0.7, 0.5, FRAME.sparkle); } },
      end(h, ctx) {
        if (!h.alive) return;
        const left = h.shieldT > 0 ? h.shieldHp : 0;
        h.shieldHp = 0; h.shieldT = 0;
        for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; vfx.streak(h.x, 1.4, h.z, h.x + Math.cos(a) * ab.radius, 0.4, h.z + Math.sin(a) * ab.radius, k % 2 ? col : acc, 0.25, 1.4); }
        burst(h, ctx, h.x, h.z, ab.radius, { ...ab, dmg: ab.dmg + left * 0.5 });
      },
    });
  },

  // Ring of solid crystal walls around a point: enemies inside stay inside, shots from outside are stopped.
  geode(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, { x, z } = pointOf(h, ab, aim), R = ab.radius, n = 8;
    strikeAt(h, ctx, x, z, R, ab.delay, () => {
      burst(h, ctx, x, z, R, { dmg: ab.dmg });
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
        ctx.zones.addField({ team: h.team, src: h, wall: true, solid: true, len: (2 * Math.PI * R / n) * 1.15, dx, dz, x: x + dx * R, z: z + dz * R, dur: ab.dur, color: k % 2 ? col : acc });
        particles.burst(x + dx * R, 0.6, z + dz * R, 6, { color: [col, acc, 0xffffff], speed: 1.5, up: 5, size: 0.9, life: 0.6, frame: FRAME.sparkle, grav: 6 });
      }
      vfx.column(x, z, col, 0.6);
    });
  },

  // ── Keel ──
  // Bulldoze forward: enemies met are pushed along in front of the prow, then stunned when the charge stops.
  plow(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, carried = new Set(), half = (ab.width ?? 2) / 2 + 0.3, dist = ab.range;
    vfx.ring(h.x, 0.25, h.z, col, 2.8, 0.3);
    h.runScript({
      dur: 0.2 + dist * 0.045, x1: h.x + aim.dx * dist, z1: h.z + aim.dz * dist,
      tick: (h, ctx) => {
        particles.burst(h.x + aim.dx, 0.3, h.z + aim.dz, 3, { color: [col, 0xffffff], speed: 3, up: 2, size: 0.7, life: 0.4, frame: FRAME.dot, grav: 6 });
        forEachEnemy(ctx, h.team, h.x + aim.dx * 1.2, h.z + aim.dz * 1.2, half, (e) => {
          if (!mobile(e) || carried.has(e)) return;
          carried.add(e);
          dealDamage(e, ab.dmg, h, true);
        });
        for (const e of carried) {
          if (!e.alive) continue;
          const lat = (e.x - h.x) * -aim.dz + (e.z - h.z) * aim.dx;
          e.x = h.x + aim.dx * (h.radius + e.radius + 0.3) - aim.dz * lat * 0.9;
          e.z = h.z + aim.dz * (h.radius + e.radius + 0.3) + aim.dx * lat * 0.9;
        }
      },
      done: (h, ctx) => {
        for (const e of carried) if (e.alive) { applyStatus(e, 'stun', ab.endStun); dealDamage(e, ab.dmg * 0.5, h, true); }
        vfx.ring(h.x + aim.dx * 1.5, 0.25, h.z + aim.dz * 1.5, acc, 3.2, 0.4);
        if (carried.size) ctx.rig.shake(0.2);
      },
    });
  },

  // Cone foghorn blast that shoves enemies away, and Keel braces (damage reduction) for a few seconds.
  foghorn(h, ab, ctx, aim) {
    BEHAVIORS.cone(h, { ...ab, waves: 1 }, ctx, aim);
    addBuff(h, 'dr', ab.selfDr, ab.drT ?? 3);
    for (const r of [0.6, 1.2, 1.8]) vfx.ring(h.x + aim.dx * r * 2, 1.6, h.z + aim.dz * r * 2, fx(h).accent, 1.2 + r, 0.3 + r * 0.1);
  },

  // Anchor lands at a point; every enemy it hits is chained to it and cannot stray beyond the leash.
  anchor(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, { x, z } = pointOf(h, ab, aim), R = ab.radius;
    vfx.streak(h.x, 3, h.z, x, 0.4, z, acc, ab.delay, 2);
    strikeAt(h, ctx, x, z, R, ab.delay, () => {
      const caught = [];
      forEachEnemy(ctx, h.team, x, z, R, (e) => { if (mobile(e)) caught.push(e); });
      burst(h, ctx, x, z, R, ab);
      vfx.column(x, z, acc, 0.5);
      let vis = 0;
      ctx.anim(ab.dur, (u, dt) => {
        const show = (vis -= dt) <= 0;
        if (show) { vis = 0.3; vfx.ring(x, 0.25, z, acc, 1.6, 0.3); }
        for (const e of caught) {
          if (!e.alive) continue;
          leash(e, x, z, ab.leash);
          if (show) vfx.link({ x, z }, e, col, 0.3, 0.4, e.hitY ?? 1, 0.1);
        }
      });
    });
  },

  // ── Anvil ──
  // Tongs grab the first enemy in reach and flip it over Anvil's shoulder to crash down behind him.
  toss(h, ab, ctx, aim) {
    const t = firstInLine(ctx, h, aim.dx, aim.dz, ab.range, ab.width ?? 1.2);
    if (!t || !mobile(t)) return false;
    const col = fx(h).color, acc = fx(h).accent, lx = h.x - aim.dx * ab.behind, lz = h.z - aim.dz * ab.behind;
    vfx.link(h, t, acc, 0.25, 1.2, t.hitY ?? 1);
    dealDamage(t, ab.dmg * 0.3, h, true);
    applyStatus(t, 'air', 0.45); applyStatus(t, 'stun', 0.45);
    pullTo(t, lx, lz, 0.4);
    ctx.anim(0.4, (u) => { if (u < 1) particles.emit(lerp(t.x, lx, 0.1), 1 + Math.sin(Math.PI * u) * 3, lerp(t.z, lz, 0.1), 0, 0, 0, col, 0.8, 0.3, FRAME.sparkle); });
    ctx.later(0.42, () => {
      if (!t.alive) return;
      affect(h, t, { dmg: ab.dmg * 0.7, stun: ab.stun });
      vfx.ring(t.x, 0.25, t.z, col, 2.6, 0.35); vfx.decal(t.x, t.z, acc, 1.6, 0.6);
      if (ab.splash) burst(h, ctx, t.x, t.z, ab.splash, { dmg: ab.dmg * 0.4 });
      ctx.rig.shake(0.15);
    });
  },

  // Heat the hammer: the next `hits` basics each deal bonus damage and spray sparks onto enemies around the target.
  temper(h, ab, ctx) {
    const col = fx(h).color;
    let left = ab.hits, last = null, glint = 0;
    if (ab.shield) giveShield(h, ab.shield, 3);
    vfx.ring(h.x, 0.25, h.z, col, 2.6, 0.4);
    h.nextBasic = last = { dmg: ab.bonus, range: 0, t: ab.dur };
    h.effects.push({
      t: 0, dur: ab.dur,
      update(h, dt, ctx) {
        if ((glint -= dt) <= 0) { glint = 0.08; particles.emit(h.x + Math.sin(h.face) * 0.9 + rand(-0.3, 0.3), 1.2, h.z + Math.cos(h.face) * 0.9, rand(-1, 1), 2, rand(-1, 1), Math.random() < 0.5 ? col : 0xFF8A3A, 0.5, 0.35, FRAME.sparkle, 3); }
        if (h.nextBasic === last) return;
        if (h.nextBasic || h.atkAge > 0.1) { this.t = this.dur; return; } // expired or replaced, not swung
        // the hot swing just landed: splash the area around whatever was hit
        const t = h.aim;
        if (t) {
          vfx.ring(t.x, 0.25, t.z, col, ab.burnR * 1.4, 0.3);
          sparks(h, t.x, 1, t.z, 10, [col, 0xFF8A3A, 0xffffff], 4);
          forEachEnemy(ctx, h.team, t.x, t.z, ab.burnR, (e) => { if (e !== t) dealDamage(e, ab.bonus * 0.6, h, true); });
        }
        if (--left <= 0) { this.t = this.dur; return; }
        h.nextBasic = last = { dmg: ab.bonus, range: 0, t: ab.dur };
      },
      end(h) { if (h.nextBasic === last) h.nextBasic = null; },
    });
  },

  // A giant anvil falls from the sky: big hit + stun, then it sits there as a solid block for a few seconds.
  anvilfall(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, { x, z } = pointOf(h, ab, aim), R = ab.radius;
    ctx.anim(ab.delay, (u) => { if (u < 1) particles.emit(x + rand(-0.4, 0.4), 12 - u * 11, z + rand(-0.4, 0.4), 0, -6, 0, u > 0.5 ? col : 0x8A8F99, 1.2, 0.2, FRAME.dot); });
    strikeAt(h, ctx, x, z, R, ab.delay, () => {
      burst(h, ctx, x, z, R, ab);
      vfx.column(x, z, col, 0.4);
      for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; particles.emit(x + Math.cos(a) * 1.2, 0.4, z + Math.sin(a) * 1.2, Math.cos(a) * 6, 4, Math.sin(a) * 6, k % 2 ? col : acc, 0.7, 0.5, FRAME.sparkle, 8); }
      for (const [dx, dz] of [[1, 0], [0, 1]]) ctx.zones.addField({ team: h.team, src: h, wall: true, solid: true, len: 2.2, dx, dz, x, z, dur: ab.block, color: 0x9AA3AF });
      ctx.rig.shake(0.35);
    });
  },

  // ── Cyclone ──
  // A rising whirlwind: enemies around are sucked in, then everyone (Cyclone included) is launched into the air.
  updraft(h, ab, ctx) {
    const col = fx(h).color, acc = fx(h).accent, R = ab.radius, cx = h.x, cz = h.z;
    forEachEnemy(ctx, h.team, cx, cz, R, (e) => { if (mobile(e)) { const d = Math.hypot(e.x - cx, e.z - cz); if (d > 1.2) shove(e, cx - e.x, cz - e.z, Math.min(ab.pull, d - 1), 0.2); } });
    ctx.anim(0.5, (u) => {
      if (u >= 1) return;
      for (let k = 0; k < 3; k++) { const a = u * 30 + k * 2.1, r = R * (1 - u * 0.7); particles.emit(cx + Math.cos(a) * r, 0.3 + u * 4, cz + Math.sin(a) * r, 0, 3, 0, k % 2 ? col : acc, 0.8, 0.4, FRAME.dot); }
    });
    h.effects.push({ t: 0, dur: 0.55, update(h) { const u = this.t / this.dur; h.yOff = 8.8 * u * (1 - u); }, end(h) { h.yOff = 0; } });
    ctx.later(0.22, () => {
      forEachEnemy(ctx, h.team, cx, cz, R, (e) => affect(h, e, { dmg: ab.dmg, air: true }, { x: cx, z: cz }));
      vfx.ring(cx, 0.25, cz, acc, R * 1.3, 0.4); vfx.column(cx, cz, col, 0.45);
      ctx.rig.shake(0.15);
    });
  },

  // Calm eye, wild wall: a ring that follows Cyclone; enemies on the rim are hurt and blown outward, allies inside toughen.
  eye(h, ab, ctx) {
    const col = fx(h).color, acc = fx(h).accent, R = ab.r;
    let tick = 0, ang = 0;
    vfx.ring(h.x, 0.25, h.z, col, R * 1.4, 0.5);
    h.effects.push({
      t: 0, dur: ab.dur,
      update(h, dt, ctx) {
        ang += dt * 5;
        for (let k = 0; k < 4; k++) { const a = ang + k * Math.PI / 2; particles.emit(h.x + Math.cos(a) * R, 0.4 + (k % 2) * 1.2, h.z + Math.sin(a) * R, -Math.sin(a) * 5, 0.5, Math.cos(a) * 5, k % 2 ? acc : col, 0.9, 0.35, FRAME.dot); }
        forEachAlly(ctx, h.team, h.x, h.z, R - 0.5, (a) => addBuff(a, 'dr', ab.allyDr, 0.3));
        if ((tick -= dt) > 0) return;
        tick = 0.25;
        vfx.ring(h.x, 0.6, h.z, col, R * 1.15, 0.3);
        forEachEnemy(ctx, h.team, h.x, h.z, R, (e) => {
          const d = Math.hypot(e.x - h.x, e.z - h.z);
          if (d < R - 1.6) return;
          affect(h, e, { dmg: ab.dps * 0.25, knock: mobile(e) ? ab.push : 0 }, { x: h.x, z: h.z });
        });
      },
    });
  },

  // Become a tornado that travels to the aim point, dragging enemies along in its core, then flings them out.
  twister(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, R = ab.radius, caught = new Set(), d = Math.min(aim.dist, ab.range);
    let tick = 0, ang = 0;
    h.runScript({
      dur: ab.dur, x1: h.x + aim.dx * d, z1: h.z + aim.dz * d,
      tick: (h, ctx, u, dt) => {
        h.spin = 1; ang += dt * 14;
        for (let k = 0; k < 3; k++) { const a = ang + k * 2.1, y = (k + 1) * 1.1, r = 0.6 + y * 0.45; particles.emit(h.x + Math.cos(a) * r, y, h.z + Math.sin(a) * r, -Math.sin(a) * 4, 1, Math.cos(a) * 4, k % 2 ? acc : col, 1.0, 0.3, FRAME.dot); }
        forEachEnemy(ctx, h.team, h.x, h.z, R, (e) => { if (mobile(e)) caught.add(e); });
        for (const e of caught) {
          if (!e.alive) continue;
          const dx = h.x - e.x, dz = h.z - e.z, dd = Math.hypot(dx, dz);
          if (dd > R + 1.5) { caught.delete(e); continue; }
          if (dd > 0.8) { const s = Math.min(dd - 0.6, 9 * dt); e.x += (dx / dd) * s; e.z += (dz / dd) * s; }
        }
        if ((tick -= dt) > 0) return;
        tick = 0.2;
        forEachEnemy(ctx, h.team, h.x, h.z, R, (e) => dealDamage(e, ab.dps * 0.2, h, true));
        vfx.ring(h.x, 0.3, h.z, acc, R * 1.2, 0.25);
      },
      done: (h, ctx) => {
        for (const e of caught) if (e.alive) affect(h, e, { knock: 3.5, air: true }, { x: h.x, z: h.z });
        burst(h, ctx, h.x, h.z, R, { dmg: ab.dps * 0.4 });
      },
    });
  },

  // ── Shade ──
  // Open the parasol and drift down at the aim point; untargetable while airborne, a small shadow splash on landing.
  drift(h, ab, ctx, aim) {
    addBuff(h, 'untarget', 1, ab.dur);
    vfx.ghost(h.x, h.z, fx(h).accent, 0.5);
    BEHAVIORS.leap(h, ab, ctx, aim);
  },

  // A pool of shadow: while Shade stands in it she is hidden and quick; enemies in it are slowed. Leaving arms a strike.
  umbra(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, { x, z } = pointOf(h, ab, aim), R = ab.r;
    let inside = false, vis = 0;
    vfx.ring(x, 0.25, z, acc, R * 1.3, 0.4);
    ctx.zones.addField({ team: h.team, src: h, x, z, r: R, dur: ab.dur, slow: true, color: 0x3A2E55 });
    ctx.anim(ab.dur, (u, dt) => {
      if ((vis -= dt) <= 0) { vis = 0.4; vfx.decal(x, z, 0x2A1F3A, R, 0.5); }
      if (u >= 1 || !h.alive) return;
      const now = Math.hypot(h.x - x, h.z - z) < R;
      if (now) { addBuff(h, 'hidden', 1, 0.3); addBuff(h, 'speed', 0.2, 0.3); if (Math.random() < 0.3) particles.emit(h.x, 0.3, h.z, 0, 1.5, 0, col, 0.6, 0.5, FRAME.dot); }
      if (inside && !now) { h.nextBasic = { dmg: ab.nextDmg, range: 1, t: 2.5 }; vfx.ghost(h.x, h.z, acc, 0.4); }
      inside = now;
    });
  },

  // A giant parasol shadow: enemy heroes under it cannot basic attack (blinded) and are slowed; Shade hides in it.
  eclipse(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, { x, z } = pointOf(h, ab, aim), R = ab.radius;
    strikeAt(h, ctx, x, z, R, ab.delay, () => {
      burst(h, ctx, x, z, R, { dmg: ab.dmg });
      let tick = 0, vis = 0;
      ctx.anim(ab.dur, (u, dt) => {
        if (u >= 1) return;
        if ((vis -= dt) <= 0) { vis = 0.35; vfx.decal(x, z, 0x1A1426, R, 0.45); vfx.ring(x, 2.6, z, acc, R * 2, 0.35); }
        if (h.alive && Math.hypot(h.x - x, h.z - z) < R) { addBuff(h, 'hidden', 1, 0.3); addBuff(h, 'speed', 0.25, 0.3); }
        if ((tick -= dt) > 0) return;
        tick = 0.25;
        forEachEnemy(ctx, h.team, x, z, R, (e) => {
          applyStatus(e, 'slow', 0.5);
          if (e.type === 'hero') { e.effects.push({ t: 0, dur: 0.3, update(e) { e.noAttack = true; } }); particles.emit(e.x, (e.hitY ?? 1) + 1.2, e.z, 0, 0.3, 0, col, 0.6, 0.3, FRAME.ring); }
        });
      });
    });
  },

  // ── Pounce ──
  // Leap onto the closest enemy hero near the aim (or the aim point) and pin it to the ground.
  pounce(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent;
    let t = pickTarget(ctx, h.team, h.x, h.z, ab.range, ['heroes']);
    if (t && aim.manual) {
      const rx = t.x - h.x, rz = t.z - h.z, along = rx * aim.dx + rz * aim.dz, lat = Math.abs(rx * aim.dz - rz * aim.dx);
      if (along <= 0 || lat > 2.2 + t.radius) t = null;
    }
    let x1 = h.x + aim.dx * Math.min(aim.dist, ab.range), z1 = h.z + aim.dz * Math.min(aim.dist, ab.range);
    if (t) { const dx = t.x - h.x, dz = t.z - h.z, d = Math.hypot(dx, dz) || 1, k = Math.max(0, d - h.radius - t.radius); x1 = h.x + dx / d * k; z1 = h.z + dz / d * k; }
    vfx.ring(h.x, 0.25, h.z, col, 2, 0.3);
    h.runScript({
      dur: ab.dur, x1, z1, h: ab.height,
      tick: (h) => particles.burst(h.x, GROUND + 1 + h.yOff, h.z, 2, { color: [col, acc], speed: 1, up: 0.5, size: 0.6, life: 0.4, frame: FRAME.star, grav: 0 }),
      done: (h, ctx) => {
        vfx.ring(h.x, 0.25, h.z, acc, 2.6, 0.35);
        const hit = t?.alive && Math.hypot(t.x - h.x, t.z - h.z) < h.radius + t.radius + 1.5 ? t : pickTarget(ctx, h.team, h.x, h.z, 1.6, ['heroes', 'minions']);
        if (hit) { affect(h, hit, { dmg: ab.dmg, root: ab.root }); sparks(h, hit.x, 1, hit.z, 12, [col, acc, 0xffffff], 4); vfx.ring(hit.x, 0.3, hit.z, col, 1.6, ab.root); }
      },
    });
  },

  // Back-flip along the move direction; the hoop left behind snaps shut on enemies a beat later.
  vault(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, x0 = h.x, z0 = h.z;
    h.runScript({ dur: 0.38, x1: h.x + aim.dx * ab.range, z1: h.z + aim.dz * ab.range, h: 2.4, tilt: -1.2 });
    vfx.ring(x0, 1.0, z0, acc, ab.radius * 1.4, 0.45);
    ctx.later(0.4, () => burst(h, ctx, x0, z0, ab.radius, ab));
    if (ab.resetBasic) h.cd = 0;
    sparks(h, x0, 1, z0, 8, [col, acc], 2);
  },

  // Undying frenzy: haste + attack speed, can't drop below 1 HP, and the pounce keeps coming back fast.
  ninelives(h, ab, ctx) {
    BEHAVIORS.buff(h, ab, ctx);
    const col = fx(h).color;
    let vis = 0;
    h.effects.push({
      t: 0, dur: ab.dur,
      update(h, dt) {
        if (h.cds[0] > ab.refresh) h.cds[0] = ab.refresh;
        if ((vis -= dt) <= 0) { vis = 0.25; particles.emit(h.x + rand(-0.6, 0.6), 2.4, h.z + rand(-0.6, 0.6), 0, 0.8, 0, col, 0.6, 0.5, FRAME.star); }
      },
    });
  },

  // ── Comet ──
  // A comet streaks in low from behind Comet along the aim line, hitting everything and leaving an icy trail.
  tailstreak(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, L = ab.range;
    vfx.streak(h.x - aim.dx * 4, 6, h.z - aim.dz * 4, h.x + aim.dx * L, 0.8, h.z + aim.dz * L, acc, 0.3, 4);
    fireBolt(h, ctx, h.x, h.z, aim.dx, aim.dz, ab, col);
    for (let s = 1.5; s < L; s += 2.2) ctx.zones.addField({ team: h.team, src: h, x: h.x + aim.dx * s, z: h.z + aim.dz * s, r: ab.trail.w, dur: ab.trail.dur, dps: ab.trail.dps, slow: true, color: col });
    ctx.rig.shake(0.1);
  },

  // Three stars around the aim point link up after a beat: enemies on the star lines are stunned, inside are slowed.
  constellation(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, { x, z } = pointOf(h, ab, aim), R = ab.radius, base = Math.atan2(aim.dx, aim.dz);
    const stars = [0, 1, 2].map((k) => { const a = base + (k / 3) * Math.PI * 2; return { x: x + Math.sin(a) * R, z: z + Math.cos(a) * R }; });
    for (const s of stars) { vfx.ring(s.x, 0.2, s.z, telegraph(h), 1.2, ab.delay); vfx.column(s.x, s.z, acc, ab.delay); }
    vfx.decal(x, z, telegraph(h), R, ab.delay + 0.15);
    ctx.later(ab.delay, () => {
      const onLine = new Set();
      for (let k = 0; k < 3; k++) {
        const a = stars[k], b = stars[(k + 1) % 3];
        vfx.beam(a.x, 1.0, a.z, b.x, 1.0, b.z, k % 2 ? acc : col, 0.4, 0.5);
        const lx = b.x - a.x, lz = b.z - a.z, L = Math.hypot(lx, lz);
        forEachEnemy(ctx, h.team, (a.x + b.x) / 2, (a.z + b.z) / 2, L / 2 + 1, (e) => {
          const t = Math.max(0, Math.min(1, ((e.x - a.x) * lx + (e.z - a.z) * lz) / (L * L)));
          if (Math.hypot(e.x - (a.x + lx * t), e.z - (a.z + lz * t)) <= 0.9 + e.radius) onLine.add(e);
        });
      }
      for (const s of stars) { vfx.flash(s.x, 1, s.z, acc, 2, 0.3); sparks(h, s.x, 1, s.z, 8, [col, acc, 0xffffff], 3); }
      for (const e of onLine) affect(h, e, ab, { x, z });
      forEachEnemy(ctx, h.team, x, z, R * 0.6, (e) => { if (!onLine.has(e)) applyStatus(e, 'slow', 1.5); });
    });
  },

  // One huge comet: a long telegraph, then a blast that hits far harder in the core, and a cold crater.
  impact(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, { x, z } = pointOf(h, ab, aim), R = ab.radius;
    vfx.ring(x, 0.2, z, telegraph(h), ab.core * 1.1, ab.delay);
    vfx.streak(x + 9, 22, z - 4, x, 0.3, z, acc, ab.delay, 6);
    ctx.anim(ab.delay, (u) => { if (u < 1 && Math.random() < 0.5) particles.emit(x + 9 * (1 - u), 22 * (1 - u), z - 4 * (1 - u), rand(-2, 2), rand(-1, 1), rand(-2, 2), Math.random() < 0.5 ? col : acc, 1.4, 0.5, FRAME.star); });
    strikeAt(h, ctx, x, z, R, ab.delay, () => {
      vfx.column(x, z, 0xffffff, 0.5);
      vfx.ring(x, 0.4, z, col, R * 2, 0.6);
      forEachEnemy(ctx, h.team, x, z, R, (e) => affect(h, e, ab, { x, z, mul: Math.hypot(e.x - x, e.z - z) <= ab.core + e.radius ? ab.coreMul : 1 }));
      burst(h, ctx, x, z, R, {});
      ctx.zones.addField({ team: h.team, src: h, x, z, r: R * 0.7, color: col, ...ab.fieldAfter });
      ctx.rig.shake(0.45);
    });
  },

  // ── Mycel ──
  // Scatter puffball mines around the aim point (Rime's trap, several at once): each bursts into a spore cloud.
  puffballs(h, ab, ctx, aim) {
    const { x, z } = pointOf(h, ab, aim);
    for (let k = 0; k < ab.n; k++) {
      const a = (k / ab.n) * Math.PI * 2 + 0.4, r = k ? ab.spread : 0, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      const d = Math.hypot(px - h.x, pz - h.z) || 1;
      BEHAVIORS.trap(h, { ...ab, range: d }, ctx, { dx: (px - h.x) / d, dz: (pz - h.z) / d, dist: d });
      particles.burst(px, 0.4, pz, 5, { color: [fx(h).accent, fx(h).color], speed: 1.2, up: 2, size: 0.6, life: 0.6, frame: FRAME.dot, grav: 2 });
    }
  },

  // Glowing threads reach every enemy around; they hurt while linked, and whoever is still linked at the end is rooted.
  network(h, ab, ctx) {
    const col = fx(h).color, acc = fx(h).accent, links = [];
    forEachEnemy(ctx, h.team, h.x, h.z, ab.radius, (e) => { if (mobile(e)) links.push(e); });
    if (!links.length) return false;
    vfx.ring(h.x, 0.25, h.z, col, ab.radius * 1.2, 0.4);
    let tick = 0;
    h.effects.push({
      t: 0, dur: ab.dur,
      update(h, dt) {
        if ((tick -= dt) > 0) return;
        tick = 0.25;
        for (let i = links.length - 1; i >= 0; i--) {
          const e = links[i];
          if (!e.alive || Math.hypot(e.x - h.x, e.z - h.z) > ab.breakR) { links.splice(i, 1); continue; }
          vfx.link(h, e, i % 2 ? acc : col, 0.3, 0.3, 0.3, 0.08);
          affect(h, e, { dmg: ab.dps * 0.25, slow: true, slowT: 0.5 });
        }
      },
      end(h) {
        for (const e of links) if (e.alive) { applyStatus(e, 'root', ab.root); vfx.ring(e.x, 0.25, e.z, col, 1.8, 0.4); sparks(h, e.x, 0.6, e.z, 8, [col, acc], 2); }
      },
    });
  },

  // A ring of mushrooms: enemies inside are swirled around it and sapped, and fall asleep (stun) when it closes.
  fairyring(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, { x, z } = pointOf(h, ab, aim), R = ab.radius;
    let tick = 0, vis = 0;
    vfx.rune(x, z, acc, R * 1.8, ab.dur);
    ctx.anim(ab.dur, (u, dt) => {
      if (u >= 1) return;
      if ((vis -= dt) <= 0) {
        vis = 0.4;
        for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2 + u * 2; particles.emit(x + Math.cos(a) * R, 0.4, z + Math.sin(a) * R, 0, 1.2, 0, k % 2 ? col : acc, 0.9, 0.5, FRAME.dot); }
      }
      forEachEnemy(ctx, h.team, x, z, R, (e) => {
        if (!mobile(e)) return;
        const dx = e.x - x, dz = e.z - z, d = Math.hypot(dx, dz) || 1, s = ab.swirl * dt;
        e.x += (-dz / d) * s - (dx / d) * s * 0.3; e.z += (dx / d) * s - (dz / d) * s * 0.3;
      });
      if ((tick -= dt) <= 0) { tick = 0.25; forEachEnemy(ctx, h.team, x, z, R, (e) => affect(h, e, { dmg: ab.dps * 0.25, slow: true, slowT: 0.5 })); }
    });
    ctx.later(ab.dur, () => {
      burst(h, ctx, x, z, R, { stun: ab.endStun, dmg: ab.dps * 0.5 });
      forEachEnemy(ctx, h.team, x, z, R, (e) => particles.emit(e.x, (e.hitY ?? 1) + 1.4, e.z, 0, 0.6, 0, 0xffffff, 0.7, 1.0, FRAME.ring));
    });
  },

  // ── Harpoon ──
  // A roped harpoon: the first enemy hit can't get farther away for a moment, then is reeled in.
  lineshot(h, ab, ctx, aim) {
    const t = firstInLine(ctx, h, aim.dx, aim.dz, ab.range, ab.width ?? 1);
    BEHAVIORS.missile(h, { ...ab, pierce: false, dmg: 0, stun: 0, shape: 'spear' }, ctx, aim);
    if (!t || !mobile(t)) return;
    const col = fx(h).color, acc = fx(h).accent, travel = Math.hypot(t.x - h.x, t.z - h.z) / (ab.speed ?? 20);
    ctx.later(travel, () => {
      if (!t.alive) return;
      affect(h, t, { dmg: ab.dmg, stun: ab.stun });
      const L = Math.max(2, Math.hypot(t.x - h.x, t.z - h.z));
      let vis = 0;
      ctx.anim(ab.leash, (u, dt) => {
        if (!t.alive || !h.alive) return;
        leash(t, h.x, h.z, L);
        if ((vis -= dt) <= 0) { vis = 0.15; vfx.link(h, t, acc, 0.18, 1.2, t.hitY ?? 1, 0.07); }
        if (u >= 1) {
          const d = Math.hypot(t.x - h.x, t.z - h.z), k = Math.min(ab.reel, d - h.radius - t.radius - 0.5);
          if (k > 0) shove(t, h.x - t.x, h.z - t.z, k, 0.3);
          vfx.link(h, t, col, 0.35, 1.2, t.hitY ?? 1, 0.14);
          sparks(h, t.x, 1, t.z, 8, [col, acc], 3);
        }
      });
    });
  },

  // Kick nearby enemies away, then jump clear along the move direction.
  castoff(h, ab, ctx, aim) {
    burst(h, ctx, h.x, h.z, ab.radius, ab);
    h.runScript({ dur: 0.35, x1: h.x + aim.dx * ab.range, z1: h.z + aim.dz * ab.range, h: 1.6 });
    if (ab.aspd) addBuff(h, 'aspd', ab.aspd, ab.aspdT ?? 3);
  },

  // A fan of giant harpoons; each one carries every enemy it spears to the end of its flight, then they are stunned.
  skewer(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, base = Math.atan2(aim.dx, aim.dz), n = ab.count, L = ab.range, sp = ab.speed;
    const half = (ab.width ?? 1.4) / 2 + 0.2, ox = h.x, oz = h.z, taken = new Set();
    for (let k = 0; k < n; k++) {
      const a = base + (n > 1 ? (k / (n - 1) - 0.5) * ab.spread * DEG : 0), dx = Math.sin(a), dz = Math.cos(a), mine = [];
      let flare = 0;
      ctx.anim(L / sp, (u, dt) => {
        const d = Math.min(1, u) * L, x = ox + dx * d, z = oz + dz * d;
        if ((flare -= dt) <= 0) { flare = 0.08; vfx.beam(x - dx * 1.8, 1.2, z - dz * 1.8, x + dx * 0.5, 1.2, z + dz * 0.5, k % 2 ? acc : col, 0.26, 0.14); }
        forEachEnemy(ctx, h.team, x, z, half, (e) => {
          if (taken.has(e) || e.type === 'core' || e.type === 'tower') return;
          taken.add(e);
          if (mobile(e)) mine.push(e);
          affect(h, e, { dmg: ab.dmg });
        });
        for (const e of mine) if (e.alive) { e.x = x + dx * 0.6; e.z = z + dz * 0.6; }
        if (u >= 1) for (const e of mine) if (e.alive) { applyStatus(e, 'stun', ab.stun); vfx.ring(e.x, 0.25, e.z, acc, 2, 0.35); }
      });
    }
    ctx.rig.shake(0.15);
  },

  // ── Loom ──
  // String a thread across the aim line: every enemy that crosses it is snared (rooted) once.
  tripwire(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, { x, z } = pointOf(h, ab, aim), tx = -aim.dz, tz = aim.dx, half = ab.len / 2;
    const ax = x - tx * half, az = z - tz * half, bx = x + tx * half, bz = z + tz * half, done = new Set();
    let vis = 0;
    vfx.ring(ax, 0.2, az, acc, 1, 0.4); vfx.ring(bx, 0.2, bz, acc, 1, 0.4);
    ctx.anim(ab.dur, (u, dt) => {
      if ((vis -= dt) <= 0) { vis = 0.45; vfx.beam(ax, 0.45, az, bx, 0.45, bz, col, 0.08, 0.5); }
      if (u >= 1) return;
      forEachEnemy(ctx, h.team, x, z, half + 1, (e) => {
        if (done.has(e) || !mobile(e)) return;
        const t = Math.max(-1, Math.min(1, ((e.x - x) * tx + (e.z - z) * tz) / half));
        if (Math.hypot(e.x - (x + tx * half * t), e.z - (z + tz * half * t)) > 0.5 + e.radius) return;
        done.add(e);
        affect(h, e, ab);
        vfx.beam(ax, 0.45, az, bx, 0.45, bz, acc, 0.22, 0.3);
        sparks(h, e.x, 0.6, e.z, 10, [col, acc, 0xffffff], 3);
      });
    });
  },

  // Piercing needle: everything it threads is sewn together, pulled to the middle a beat later.
  stitch(h, ab, ctx, aim) {
    const hit = [];
    fireBolt(h, ctx, h.x, h.z, aim.dx, aim.dz, { ...ab, onHit: (e) => { if (mobile(e)) hit.push(e); } }, fx(h).color);
    if (hit.length < 2) return;
    ctx.later(0.35, () => {
      const live = hit.filter((e) => e.alive);
      if (live.length < 2) return;
      const cx = live.reduce((s, e) => s + e.x, 0) / live.length, cz = live.reduce((s, e) => s + e.z, 0) / live.length;
      for (let i = 0; i < live.length; i++) {
        if (i) vfx.link(live[i - 1], live[i], fx(h).accent, 0.4, 1, 1, 0.1);
        const d = Math.hypot(cx - live[i].x, cz - live[i].z);
        if (d > 0.8) shove(live[i], cx - live[i].x, cz - live[i].z, d - 0.7, 0.25);
      }
      sparks(h, cx, 1, cz, 10, [fx(h).color, fx(h).accent], 3);
    });
  },

  // Plant, aim down a laser line for a second, then fire a thread shot across the map; farther targets take more.
  snipe(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, L = ab.range;
    let vis = 0;
    h.effects.push({
      t: 0, dur: ab.delay,
      update(h, dt) {
        h.moveMul = 0.1; h.noAttack = true; h.face = Math.atan2(aim.dx, aim.dz); h.faceHold = 0.2;
        if ((vis -= dt) <= 0) { vis = 0.1; vfx.beam(h.x, 1.3, h.z, h.x + aim.dx * L, 1.3, h.z + aim.dz * L, telegraph(h), 0.05, 0.12); }
      },
    });
    ctx.later(ab.delay, () => {
      if (!h.alive || h.stun > 0) return;
      const x = h.x, z = h.z;
      fireBolt(h, ctx, x, z, aim.dx, aim.dz, { ...ab, dmg: 0, onHit: (e) => { const d = Math.hypot(e.x - x, e.z - z); dealDamage(e, ab.dmg * (1 + Math.max(0, d - 5) * ab.far), h, true); } }, col);
      vfx.beam(x, 1.3, z, x + aim.dx * L, 1.3, z + aim.dz * L, acc, 0.5, 0.35);
      ctx.rig.shake(0.2);
    });
  },

  // ── Hymn ──
  // Alternating song: Verse of Valor (team haste + attack speed), then Verse of Rest (team healing over time), and so on.
  verse(h, ab, ctx) {
    const col = fx(h).color, acc = fx(h).accent, rest = (h._verse = !h._verse) === false, tgts = [];
    forEachAlly(ctx, h.team, h.x, h.z, ab.allyR, (a) => tgts.push(a));
    vfx.ring(h.x, 0.25, h.z, rest ? 0x7DFFC0 : col, ab.allyR * 1.2, 0.5);
    for (const a of tgts) {
      if (rest) {
        a.slow = 0;
        let tick = 0;
        a.effects.push({ t: 0, dur: ab.dur, update(a, dt) { if ((tick -= dt) <= 0) { tick = 0.5; heal(a, ab.healPs * 0.5); particles.emit(a.x, 2.2, a.z, 0, 1, 0, 0x7DFFC0, 0.5, 0.6, FRAME.star); } } });
      } else { addBuff(a, 'speed', ab.spd, ab.dur); addBuff(a, 'aspd', ab.aspd, ab.dur); }
      sparks(h, a.x, 1.6, a.z, 6, [rest ? 0x7DFFC0 : col, acc], 2);
    }
  },

  // A bell rings over the aim point: enemies under it are hushed (their skill cooldowns can't finish) and slowed.
  hush(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, { x, z } = pointOf(h, ab, aim), R = ab.radius;
    strikeAt(h, ctx, x, z, R, ab.delay, () => {
      for (const s of [1, 1.6, 2.2]) vfx.ring(x, 1.5, z, s > 1.5 ? acc : col, R * s, 0.3 + s * 0.15);
      forEachEnemy(ctx, h.team, x, z, R, (e) => {
        affect(h, e, ab, { x, z });
        if (e.type !== 'hero' || !e.alive) return;
        for (let i = 0; i < 3; i++) if (e.cds[i] < ab.hush) { e.cds[i] = ab.hush; e.cdTotal[i] = Math.max(e.cdTotal[i], ab.hush); }
        if (e.windup > 0) { e.windup = 0; e.pend = -1; }
        particles.emit(e.x, (e.hitY ?? 1) + 1.5, e.z, 0, 0.3, 0, acc, 0.8, ab.hush, FRAME.ring);
      });
      vfx.column(x, z, col, 0.4);
    });
  },

  // Channel a choir: Hymn slows to a walk while allies around are healed, toughened and cleansed; ends in a pushing chord.
  chorus(h, ab, ctx) {
    const col = fx(h).color, acc = fx(h).accent;
    let tick = 0, vis = 0;
    forEachAlly(ctx, h.team, h.x, h.z, ab.allyR, (a) => { heal(a, a === h ? ab.heal : ab.allyHeal); a.slow = 0; });
    vfx.column(h.x, h.z, col, ab.dur);
    h.effects.push({
      t: 0, dur: ab.dur,
      update(h, dt, ctx) {
        h.moveMul = 0.3; h.noAttack = true;
        if ((vis -= dt) <= 0) { vis = 0.4; vfx.ring(h.x, 0.25, h.z, col, ab.allyR * 2, 0.4); for (let k = 0; k < 6; k++) { const a = Math.random() * Math.PI * 2; particles.emit(h.x + Math.cos(a) * 2, 2.6, h.z + Math.sin(a) * 2, Math.cos(a), 1.2, Math.sin(a), k % 2 ? acc : col, 0.7, 0.8, FRAME.star); } }
        forEachAlly(ctx, h.team, h.x, h.z, ab.allyR, (a) => { addBuff(a, 'dr', ab.allyDr, 0.3); if (ab.undying) addBuff(a, 'undying', 1, 0.3); });
        if ((tick -= dt) > 0) return;
        tick = 0.25;
        forEachAlly(ctx, h.team, h.x, h.z, ab.allyR, (a) => heal(a, ab.healPs * 0.25));
      },
      end(h, ctx) { if (h.alive) burst(h, ctx, h.x, h.z, ab.radius, { dmg: ab.dmg, knock: ab.knock }); },
    });
  },

  // ── Grove ──
  // A bark splint on the most hurt ally (or Grove): a shield whose unused part turns into healing when it ends.
  splint(h, ab, ctx) {
    let t = h;
    forEachAlly(ctx, h.team, h.x, h.z, ab.range, (a) => { if (a.hp / a.maxHp < t.hp / t.maxHp) t = a; });
    const col = fx(h).color, acc = fx(h).accent;
    giveShield(t, ab.allyShield, ab.dur);
    if (t !== h) vfx.link(h, t, col, 0.4, 1.2, t.hitY ?? 1.1, 0.14);
    vfx.ring(t.x, 0.25, t.z, acc, 2.4, 0.4);
    sparks(h, t.x, 1.2, t.z, 10, [col, acc], 2);
    t.effects.push({
      t: 0, dur: ab.dur,
      end(t) {
        if (!t.alive) return;
        const left = t.shieldT > 0 ? Math.min(t.shieldHp, ab.allyShield) : 0;
        if (left > 0) { heal(t, left * ab.convert); particles.burst(t.x, 1.4, t.z, 10, { color: [0x7DFFC0, col], speed: 2, up: 3, size: 0.6, life: 0.6, frame: FRAME.star, grav: 1 }); }
      },
    });
  },

  // Pruning snip in a cone: strips enemy shields, and every enemy hero snipped heals Grove and nearby allies.
  prune(h, ab, ctx, aim) {
    const half = (ab.arc / 2) * DEG;
    let heroes = 0;
    forEachEnemy(ctx, h.team, h.x, h.z, ab.range, (e) => {
      const rx = e.x - h.x, rz = e.z - h.z, d = Math.hypot(rx, rz) || 1;
      if (d > 0.6 && Math.acos(Math.max(-1, Math.min(1, (rx * aim.dx + rz * aim.dz) / d))) > half + Math.atan2(e.radius, d)) return;
      if (e.shieldHp > 0) { e.shieldHp = 0; e.shieldT = 0; vfx.ring(e.x, 1.2, e.z, 0xffffff, 1.6, 0.3); }
      if (e.type === 'hero') heroes++;
    });
    BEHAVIORS.cone(h, { ...ab, waves: 1 }, ctx, aim);
    for (const s of [-1, 1]) vfx.arc(h.x, GROUND + 1.1, h.z, aim.dx - aim.dz * s * 0.4, aim.dz + aim.dx * s * 0.4, fx(h).accent, ab.range, 0.18);
    if (heroes) forEachAlly(ctx, h.team, h.x, h.z, 6, (a) => { heal(a, ab.healPer * Math.min(3, heroes)); sparks(h, a.x, 1.4, a.z, 5, [0x7DFFC0, fx(h).accent], 2); });
  },

  // Plant a great tree: its roots snare enemies at the spot, its shade heals allies, its trunk blocks enemy shots.
  heartwood(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent;
    let x = h.x + aim.dx * Math.min(aim.dist, ab.range), z = h.z + aim.dz * Math.min(aim.dist, ab.range);
    if (!aim.manual) { // bots and auto-cast: plant it among the most allies
      let best = -1;
      forEachAlly(ctx, h.team, h.x, h.z, ab.range, (a) => { let n = 0; forEachAlly(ctx, h.team, a.x, a.z, ab.r, () => n++); if (n > best) { best = n; x = a.x; z = a.z; } });
    }
    burst(h, ctx, x, z, ab.radius, { dmg: ab.dmg, root: ab.root });
    vfx.column(x, z, acc, 0.6);
    ctx.zones.addField({ team: h.team, src: h, x, z, r: ab.r, dur: ab.dur, healPs: ab.healPs, color: acc });
    for (const [dx, dz] of [[1, 0], [0, 1]]) ctx.zones.addField({ team: h.team, src: h, wall: true, len: 1.6, dx, dz, x, z, dur: ab.dur, color: 0x8A6A44 });
    let vis = 0;
    ctx.anim(ab.dur, (u, dt) => {
      if (u >= 1 || (vis -= dt) > 0) return;
      vis = 0.3;
      const a = Math.random() * Math.PI * 2, r = Math.random() * ab.r;
      particles.emit(x + Math.cos(a) * r, 4.5, z + Math.sin(a) * r, rand(-0.5, 0.5), -0.8, rand(-0.5, 0.5), Math.random() < 0.5 ? acc : col, 0.6, 2.2, FRAME.dot);
    });
  },
};

