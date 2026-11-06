// Wave 2 batch A skill verbs (merged into BEHAVIORS by behaviors.js). Same contract: fn(hero, ab, ctx, aim), return
// false for "nothing to hit". Also registers a skill glyph per new kind and the damage-taken reactions (thorns, parry).
import { GROUND, PAL, TEAM } from '../config.js';
import { bus } from '../core/bus.js';
import { rand, lerp } from '../core/math.js';
import {
  dealDamage, forEachEnemy, forEachAlly, applyStatus, shove, pullTo, heal, addBuff, giveShield, AIR,
} from '../game/combat.js';
import { pickTarget } from '../game/targeting.js';
import { particles, FRAME } from '../render/particles.js';
import { vfx } from '../render/vfx.js';
import { icons } from '../ui/icons.js';
import { BEHAVIORS, fireBolt } from './behaviors.js'; // cyclic: only touched inside skill calls, never at load

const DEG = Math.PI / 180;
const fx = (h) => h.def.fx ?? h.def;
const tele = (h) => (h.team === 0 ? TEAM[0].main : PAL.gloom);
const mover = (e) => e.type === 'hero' || e.type === 'minion';
const live = (h, tag) => h.effects.some((e) => e.tag === tag);

function affect(h, e, ab, o = {}) {
  if (ab.dmg) dealDamage(e, ab.dmg * (o.mul ?? 1), h, true);
  if (!e.alive) return;
  const ox = o.x ?? h.x, oz = o.z ?? h.z;
  if (ab.stun) applyStatus(e, 'stun', ab.stun);
  if (ab.slow) applyStatus(e, 'slow', ab.slowT ?? 1.5);
  if (ab.air || o.air) { applyStatus(e, 'air', AIR); applyStatus(e, 'stun', AIR); }
  if (ab.knock) shove(e, o.kdx ?? e.x - ox, o.kdz ?? e.z - oz, ab.knock, 0.25);
}

const sparks = (h, x, y, z, n, c, speed = 3) =>
  particles.burst(x, y, z, n, { color: c, speed, up: 2, size: 0.55, life: 0.6, frame: fx(h).frame ?? FRAME.sparkle, grav: 2 });

function boom(h, ctx, x, z, R, ab, col, acc, o = {}) {
  vfx.ring(x, 0.25, z, acc, R * 1.3, 0.4);
  vfx.ring(x, 0.3, z, 0xffffff, R * 0.7, 0.22);
  vfx.flash(x, 1, z, col, R * 1.1, 0.25);
  vfx.decal(x, z, col, R, 0.8);
  sparks(h, x, 0.5, z, 14, [col, acc, 0xffffff], 5);
  forEachEnemy(ctx, h.team, x, z, R, (e) => affect(h, e, ab, { x, z, ...o }));
  ctx.rig.shake(0.1 + R * 0.04);
}

// Enemies inside a W-wide strip from (x, z) along (dx, dz) for L; fn(e, along).
function inLine(ctx, team, x, z, dx, dz, L, W, fn) {
  forEachEnemy(ctx, team, x + dx * L * 0.5, z + dz * L * 0.5, L * 0.5 + W + 1, (e) => {
    const rx = e.x - x, rz = e.z - z, al = rx * dx + rz * dz, lat = Math.abs(rx * dz - rz * dx);
    if (al > -0.5 && al <= L + (e.radius ?? 0) && lat <= W / 2 + (e.radius ?? 0)) fn(e, al);
  });
}

const aimPoint = (h, ab, aim) => { const d = Math.min(aim.dist, ab.range); return [h.x + aim.dx * d, h.z + aim.dz * d]; };

export const WAVE2A_BEHAVIORS = {
  // ── Granite ──
  // A stone pillar bursts up at the aim point (knock-up) and stays as a solid block.
  menhir(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, [x, z] = aimPoint(h, ab, aim), wait = ab.delay ?? 0.45;
    vfx.decal(x, z, tele(h), ab.radius, wait + 0.15);
    vfx.ring(x, 0.2, z, tele(h), ab.radius * 1.1, wait);
    ctx.later(wait, () => {
      boom(h, ctx, x, z, ab.radius, ab, col, acc);
      vfx.column(x, z, col, 0.6);
      particles.burst(x, 0.4, z, 14, { color: [0x8A8F98, 0x5C6068, col], speed: 3, up: 8, size: 1, life: 0.7, frame: FRAME.dot, grav: 14 });
      ctx.zones.addField({ team: h.team, src: h, x, z, wall: true, solid: true, len: 1.8, dx: aim.dx, dz: aim.dz, dur: ab.dur, color: acc });
    });
  },

  // Brace: rooted-ish with a big shield; whatever the shield soaked comes back out as a stunning shockwave.
  bedrock(h, ab, ctx) {
    const col = fx(h).color, acc = fx(h).accent;
    giveShield(h, ab.shield, ab.dur + 0.2);
    const start = h.shieldHp;
    let vis = 0;
    vfx.decal(h.x, h.z, col, ab.radius * 0.6, ab.dur);
    h.effects.push({
      t: 0, dur: ab.dur, tag: 'bedrock',
      update(h, dt) {
        h.moveMul = ab.moveMul ?? 0.3;
        if ((vis -= dt) <= 0) { vis = 0.3; vfx.ring(h.x, 0.2, h.z, acc, 2.2, 0.3); particles.burst(h.x, 0.3, h.z, 3, { color: [0x8A8F98, col], speed: 1.5, up: 1, size: 0.7, life: 0.4, frame: FRAME.dot, grav: 6 }); }
      },
      end(h, ctx) {
        if (!h.alive) return;
        const soaked = Math.max(0, start - h.shieldHp);
        vfx.column(h.x, h.z, col, 0.5);
        boom(h, ctx, h.x, h.z, ab.radius, { ...ab, dmg: ab.dmg + soaked * (ab.ratio ?? 0.8) }, col, acc);
      },
    });
  },

  // A monolith topples along the aim line: telegraphed strip, stun on impact, then it lies there as a solid wall.
  topple(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, L = ab.range, W = ab.width, x0 = h.x, z0 = h.z, { dx, dz } = aim, wait = ab.delay ?? 0.8, tg = tele(h);
    for (let s = 1; s <= L; s += 1.6) vfx.decal(x0 + dx * s, z0 + dz * s, tg, W * 0.6, wait + 0.1);
    vfx.beam(x0, 0.3, z0, x0 + dx * L, 0.3, z0 + dz * L, tg, W * 0.35, wait);
    vfx.streak(x0, 8, z0, x0 + dx * L * 0.5, 0.5, z0 + dz * L * 0.5, col, wait, 4);
    ctx.later(wait, () => {
      for (let s = 1; s <= L; s += 1.2) {
        const px = x0 + dx * s, pz = z0 + dz * s;
        ctx.later(s * 0.025, () => { vfx.ring(px, 0.3, pz, acc, W * 1.2, 0.35); particles.burst(px, 0.4, pz, 3, { color: [0x8A8F98, col], speed: 2, up: 5, size: 0.9, life: 0.6, frame: FRAME.dot, grav: 12 }); });
      }
      vfx.beam(x0, 0.6, z0, x0 + dx * L, 0.6, z0 + dz * L, col, 0.6, 0.4);
      inLine(ctx, h.team, x0, z0, dx, dz, L, W, (e) => affect(h, e, ab, { x: x0, z: z0 }));
      ctx.zones.addField({ team: h.team, src: h, wall: true, solid: true, len: L - 1, dx: -dz, dz: dx, x: x0 + dx * (L / 2 + 0.5), z: z0 + dz * (L / 2 + 0.5), dur: ab.wallDur, color: acc });
      ctx.rig.shake(0.32);
    });
  },

  // ── Tidewall ──
  // A wave rolls out, catches everyone it touches, then rolls back dragging them toward Tidewall.
  undertow(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, ox = h.x, oz = h.z, { dx, dz } = aim, L = ab.range, W = ab.width, caught = new Map();
    let flare = 0;
    ctx.anim(1.0, (u, dt) => {
      const out = u < 0.5, d = (out ? u * 2 : (1 - u) * 2) * L, x = ox + dx * d, z = oz + dz * d;
      if ((flare -= dt) <= 0) {
        flare = 0.06;
        vfx.arc(x, 0.5, z, out ? dx : -dx, out ? dz : -dz, col, W * 1.3, 0.18);
        for (let k = 0; k < 4; k++) { const s = rand(-W / 2, W / 2); particles.emit(x - dz * s, 0.4, z + dx * s, 0, 2.5, 0, k % 2 ? acc : 0xffffff, 0.6, 0.4, FRAME.ring); }
      }
      if (out) {
        forEachEnemy(ctx, h.team, x, z, W / 2 + 0.4, (e) => {
          if (!mover(e) || caught.has(e)) return;
          caught.set(e, Math.max(2.2, (e.x - ox) * dx + (e.z - oz) * dz - ab.pull));
          affect(h, e, ab, { x: ox, z: oz });
        });
        return;
      }
      for (const [e, floor] of caught) {
        if (!e.alive || e.script) continue;
        const al = (e.x - ox) * dx + (e.z - oz) * dz, to = Math.max(d, floor);
        if (al > to + 0.2) { e.x -= dx * (al - to); e.z -= dz * (al - to); }
      }
    });
  },

  // Barnacle armor: damage reduction, and whoever hits Tidewall up close gets pricked and slowed (see the 'dmg' hook).
  barnacle(h, ab) {
    const acc = fx(h).accent;
    addBuff(h, 'dr', ab.dr, ab.dur);
    let vis = 0;
    const eff = {
      t: 0, dur: ab.dur, tag: 'barnacle', ab, cool: new Map(),
      update(h, dt) {
        for (const [e, c] of this.cool) if (c - dt <= 0) this.cool.delete(e); else this.cool.set(e, c - dt);
        if ((vis -= dt) <= 0) { vis = 0.4; vfx.ring(h.x, 1.0, h.z, acc, 2.4, 0.35); }
      },
    };
    h.effects.push(eff);
    sparks(h, h.x, 1.2, h.z, 12, [acc, 0xE8E0CC], 3);
  },

  // A giant wave sweeps forward from behind Tidewall, scoops enemies up on its crest and crashes at the end.
  tsunami(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, { dx, dz } = aim, W = ab.width, total = ab.range + 1.5, ox = h.x - dx * 1.5, oz = h.z - dz * 1.5;
    const carried = new Set();
    let flare = 0, crashed = false;
    ctx.rig.shake(0.15);
    ctx.anim(total / (ab.speed ?? 9), (u, dt) => {
      if (crashed) return;
      const d = u * total, x = ox + dx * d, z = oz + dz * d;
      if ((flare -= dt) <= 0) {
        flare = 0.07;
        vfx.arc(x, 0.5, z, dx, dz, col, W * 1.05, 0.2);
        vfx.arc(x - dx * 0.8, 1.6, z - dz * 0.8, dx, dz, acc, W * 0.85, 0.2);
        for (let k = 0; k < 6; k++) { const s = rand(-W / 2, W / 2); particles.emit(x - dz * s, 0.6 + Math.random(), z + dx * s, dx * 4, 3, dz * 4, k % 3 ? col : 0xffffff, 0.8, 0.45, FRAME.ring, 4); }
      }
      forEachEnemy(ctx, h.team, x, z, W / 2 + 1, (e) => {
        if (!mover(e) || carried.has(e)) return;
        const rx = e.x - x, rz = e.z - z, al = rx * dx + rz * dz, lat = Math.abs(rx * dz - rz * dx);
        if (al > -0.8 && al < 0.9 && lat <= W / 2 + e.radius) { carried.add(e); dealDamage(e, ab.dmg * 0.4, h, true); }
      });
      for (const e of carried) {
        if (!e.alive || e.script) continue;
        const al = (e.x - x) * dx + (e.z - z) * dz;
        if (al < 0.7) { e.x += dx * (0.7 - al); e.z += dz * (0.7 - al); }
        applyStatus(e, 'slow', 0.3);
      }
      if (u < 1) return;
      crashed = true;
      vfx.ring(x, 0.3, z, col, W * 0.9, 0.5);
      vfx.decal(x, z, acc, W * 0.5, 0.8);
      for (const e of carried) if (e.alive) affect(h, e, { ...ab, dmg: ab.dmg * 0.6 }, { x, z });
      ctx.rig.shake(0.3);
    });
  },

  // ── Embermaw ──
  // Grab the closest foe in front, flip them over to land behind Embermaw; the landing is a stunning splash.
  suplex(h, ab, ctx, aim) {
    let t = null, best = Infinity;
    forEachEnemy(ctx, h.team, h.x, h.z, ab.range, (e) => {
      if (!mover(e) || e.untarget) return;
      const rx = e.x - h.x, rz = e.z - h.z, d = Math.hypot(rx, rz) || 1, score = d - ((rx * aim.dx + rz * aim.dz) / d) * 1.5 - (e.type === 'hero' ? 2 : 0);
      if (score < best) { best = score; t = e; }
    });
    if (!t) return false;
    const col = fx(h).color, acc = fx(h).accent, dx = t.x - h.x, dz = t.z - h.z, d = Math.hypot(dx, dz) || 1, lx = h.x - (dx / d) * 2.8, lz = h.z - (dz / d) * 2.8;
    h.face = Math.atan2(dx, dz); h.faceHold = 0.5;
    vfx.link(h, t, acc, 0.3, 1.2, t.hitY ?? 1);
    vfx.decal(lx, lz, tele(h), ab.radius, 0.55);
    applyStatus(t, 'air', AIR); applyStatus(t, 'stun', AIR);
    pullTo(t, lx, lz, 0.45);
    h.effects.push({ t: 0, dur: 0.45, update(h) { h.moveMul = 0; h.noAttack = true; h.lunge = 0.6; } });
    ctx.later(0.45, () => { boom(h, ctx, lx, lz, ab.radius, ab, col, acc); vfx.column(lx, lz, col, 0.35); });
  },

  // Bounce off the ropes: hop back, then rocket forward through everything in the way.
  ropes(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, face = Math.atan2(aim.dx, aim.dz), back = ab.back ?? 2.2;
    vfx.arc(h.x, 1, h.z, -aim.dx, -aim.dz, acc, 2.4, 0.25);
    h.runScript({
      dur: 0.2, x1: h.x - aim.dx * back, z1: h.z - aim.dz * back, h: 0.4,
      tick: (h) => { h.face = face; },
      done: (h) => {
        const hit = new Set(), half = (ab.width ?? 1.6) / 2 + 0.3, L = ab.range + back;
        vfx.ring(h.x, 0.25, h.z, col, 2.6, 0.3);
        h.runScript({
          dur: 0.12 + L * 0.02, x1: h.x + aim.dx * L, z1: h.z + aim.dz * L, tilt: 0.35,
          tick: (h, ctx) => {
            particles.burst(h.x, 0.8, h.z, 3, { color: [col, acc], speed: 1.5, up: 1.5, size: 0.6, life: 0.4, frame: FRAME.dot, grav: 2 });
            forEachEnemy(ctx, h.team, h.x, h.z, half, (e) => {
              if (hit.has(e)) return;
              hit.add(e);
              const side = Math.sign(aim.dx * (e.z - h.z) - aim.dz * (e.x - h.x)) || 1;
              affect(h, e, ab, { kdx: -aim.dz * side, kdz: aim.dx * side });
            });
          },
          done: (h) => { vfx.ring(h.x, 0.25, h.z, acc, 2.8, 0.3); ctx.rig.shake(0.12); },
        });
      },
    });
  },

  // A hexagon of fiery ropes drops around the aim point: enemies inside cannot leave, the floor burns, Embermaw gets hyped.
  mainevent(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, [cx, cz] = aimPoint(h, ab, aim), R = ab.radius, n = 6;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2, nx = Math.cos(a), nz = Math.sin(a);
      ctx.zones.addField({ team: h.team, src: h, wall: true, solid: true, len: R * 1.2, dx: nx, dz: nz, x: cx + nx * R, z: cz + nz * R, dur: ab.dur, color: k % 2 ? col : acc });
      const pa = a + Math.PI / n;
      vfx.column(cx + Math.cos(pa) * R * 1.15, cz + Math.sin(pa) * R * 1.15, acc, 0.6);
    }
    ctx.zones.addField({ team: h.team, src: h, x: cx, z: cz, r: R - 0.5, dur: ab.dur, dps: ab.dps, color: col });
    vfx.ring(cx, 0.25, cz, acc, R * 2.4, 0.5);
    addBuff(h, 'aspd', ab.aspd ?? 0.3, ab.dur);
    addBuff(h, 'lifesteal', ab.lifesteal ?? 0.2, ab.dur);
    ctx.rig.shake(0.2);
  },

  // ── Quill ──
  // En garde: heavy damage reduction; the first foe to hit Quill gets lunged at and stunned (see the 'dmg' hook).
  riposte(h, ab, ctx) {
    const col = fx(h).color, acc = fx(h).accent;
    let vis = 0;
    h.effects.push({
      t: 0, dur: ab.dur, tag: 'riposte', ab, ctx, fired: false,
      update(h, dt) {
        h.moveMul = 0.4;
        if (!this.fired) addBuff(h, 'dr', ab.dr ?? 0.6, 0.1);
        if ((vis -= dt) <= 0) { vis = 0.2; vfx.arc(h.x, 1.3, h.z, Math.sin(h.face), Math.cos(h.face), (this.t * 10 | 0) % 2 ? acc : col, 2.2, 0.18); }
      },
    });
    vfx.flash(h.x, 1.4, h.z, col, 1.6, 0.2);
  },

  // A full ring of needles, plus a short-lived carpet of dropped quills that slows.
  quillvolley(h, ab, ctx) {
    const col = fx(h).color, acc = fx(h).accent, n = ab.count;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + rand(-0.05, 0.05);
      fireBolt(h, ctx, h.x, h.z, Math.cos(a), Math.sin(a), { range: ab.range, width: 0.7, dmg: ab.dmg, slow: ab.slow, slowT: ab.slowT }, k % 2 ? col : acc);
    }
    if (ab.carpet) ctx.zones.addField({ team: h.team, src: h, x: h.x, z: h.z, r: ab.carpet.r, dur: ab.carpet.dur, dps: ab.carpet.dps, slow: true, color: acc });
    ctx.rig.shake(0.12);
  },

  // Curl into a spiky ball and roll fast wherever you steer; bumps enemies aside, ends in a burst of quills.
  bristleball(h, ab, ctx) {
    const col = fx(h).color, acc = fx(h).accent, last = new Map();
    let age = 0;
    addBuff(h, 'dr', 0.3, ab.dur);
    h.effects.push({
      t: 0, dur: ab.dur, tag: 'ball',
      update(h, dt, ctx) {
        age += dt;
        h.spin = 1; h.noAttack = true; h.moveMul = ab.moveMul ?? 1.8;
        particles.emit(h.x + rand(-0.5, 0.5), 0.3, h.z + rand(-0.5, 0.5), rand(-1, 1), 1, rand(-1, 1), Math.random() < 0.5 ? col : acc, 0.6, 0.3, FRAME.sparkle);
        forEachEnemy(ctx, h.team, h.x, h.z, ab.r, (e) => {
          if (age - (last.get(e) ?? -9) < 0.5) return;
          last.set(e, age);
          affect(h, e, ab, { x: h.x, z: h.z });
          sparks(h, e.x, 1, e.z, 6, [acc, 0xffffff], 3);
        });
      },
      end(h, ctx) {
        if (!h.alive) return;
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2;
          fireBolt(h, ctx, h.x, h.z, Math.cos(a), Math.sin(a), { range: ab.endR, width: 0.8, dmg: ab.endDmg * 0.5, pierce: true }, k % 2 ? col : acc);
        }
        vfx.ring(h.x, 0.3, h.z, acc, ab.endR * 1.6, 0.4);
      },
    });
  },

  // ── Wisp ──
  // Three (or four) quick zigzag blinks toward the aim, untargetable, cutting whoever each hop passes.
  flit(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, n = ab.hops, seg = ab.range / n, x0 = h.x, z0 = h.z, half = (ab.width ?? 1.6) / 2 + 0.3;
    addBuff(h, 'untarget', 1, n * 0.12 + 0.15);
    let i = 0;
    const hop = () => {
      if (!h.alive || i >= n) return;
      const side = i === n - 1 ? 0 : (i % 2 ? -1.2 : 1.2), along = seg * (i + 1), hit = new Set();
      vfx.ghost(h.x, h.z, acc, 0.4);
      h.runScript({
        dur: 0.1, x1: x0 + aim.dx * along - aim.dz * side, z1: z0 + aim.dz * along + aim.dx * side, h: 0.5,
        tick: (h, ctx) => {
          particles.emit(h.x, 1.2, h.z, 0, 1.5, 0, col, 0.9, 0.35, FRAME.dot);
          forEachEnemy(ctx, h.team, h.x, h.z, half, (e) => { if (!hit.has(e)) { hit.add(e); affect(h, e, ab); sparks(h, e.x, 1, e.z, 6, [col, acc], 3); } });
        },
        done: (h) => { i++; vfx.ring(h.x, 0.25, h.z, col, 1.8, 0.2); ctx.later(0.02, hop); },
      });
    };
    hop();
  },

  // Toss a dancing lantern: enemies nearby drift toward it, slowed and nibbled; the perk stuns them when it pops.
  lure(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, [x, z] = aimPoint(h, ab, aim), x0 = h.x, z0 = h.z, R = ab.radius;
    let tick = 0, vis = 0;
    ctx.anim(ab.delay, (u) => particles.emit(lerp(x0, x, u), GROUND + 1.6 + Math.sin(Math.PI * u) * 2, lerp(z0, z, u), 0, 0, 0, col, 1, 0.3, FRAME.dot));
    vfx.ring(x, 0.2, z, acc, R * 1.1, ab.delay);
    ctx.anim(ab.dur, (u, dt) => {
      if ((vis -= dt) <= 0) { vis = 0.2; vfx.flash(x, 1.8 + Math.sin(u * 20) * 0.2, z, col, 1.6, 0.25); vfx.ring(x, 0.3, z, acc, R * 1.2, 0.3); }
      forEachEnemy(ctx, h.team, x, z, R, (e) => {
        if (!mover(e) || e.script) return;
        const dx = x - e.x, dz = z - e.z, dd = Math.hypot(dx, dz);
        if (dd > 0.6) { const s = Math.min(ab.pull * dt, dd - 0.5); e.x += (dx / dd) * s; e.z += (dz / dd) * s; }
        applyStatus(e, 'slow', 0.3);
      });
      if ((tick -= dt) <= 0) { tick = 0.35; forEachEnemy(ctx, h.team, x, z, R, (e) => dealDamage(e, ab.dmg * 0.35, h, true)); }
      if (u < 1) return;
      sparks(h, x, 1.6, z, 14, [col, acc, 0xffffff], 4);
      vfx.ring(x, 0.3, z, col, R * 1.5, 0.35);
      if (ab.endStun) forEachEnemy(ctx, h.team, x, z, R, (e) => applyStatus(e, 'stun', ab.endStun));
    }, ab.delay);
  },

  // Split into seeking flames: each chases a nearby foe, bites, and flies home to heal Wisp.
  foxfire(h, ab, ctx) {
    const near = (k) => ctx.heroes.filter((e) => e.team !== h.team && e.alive && !e.hidden && !e.untarget && Math.hypot(e.x - h.x, e.z - h.z) <= ab.range)
      .concat(k ? ctx.minions.list.filter((m) => m.team !== h.team && m.alive && Math.hypot(m.x - h.x, m.z - h.z) <= ab.range) : [])
      .sort((a, b) => Math.hypot(a.x - h.x, a.z - h.z) - Math.hypot(b.x - h.x, b.z - h.z));
    let foes = near(false);
    if (foes.length < ab.flames) foes = foes.concat(near(true).filter((e) => !foes.includes(e)));
    if (!foes.length) return false;
    const col = fx(h).color, acc = fx(h).accent, sp = ab.speed ?? 14;
    const flames = Array.from({ length: ab.flames }, (_, k) => ({ x: h.x, z: h.z, t: foes[k % foes.length], out: true, wait: k * 0.08, wob: rand(0, 6), done: false }));
    vfx.ring(h.x, 0.3, h.z, col, 3, 0.3);
    ctx.anim(3.2, (u, dt) => {
      for (const f of flames) {
        if (f.done || (f.wait -= dt) > 0) continue;
        const goal = f.out ? f.t : h, gx = goal.x, gz = goal.z, dx = gx - f.x, dz = gz - f.z, d = Math.hypot(dx, dz) || 1;
        f.wob += dt * 9;
        const step = Math.min(d, sp * dt), sw = Math.sin(f.wob) * 0.6 * Math.min(1, d / 3);
        f.x += (dx / d) * step - (dz / d) * sw * dt * 4; f.z += (dz / d) * step + (dx / d) * sw * dt * 4;
        particles.emit(f.x, 1.4, f.z, 0, 1.2, 0, f.out ? col : acc, 1.1, 0.3, FRAME.dot);
        particles.emit(f.x, 1.4, f.z, 0, 0.4, 0, 0xffffff, 0.5, 0.15, FRAME.dot);
        if (f.out && (!f.t.alive || f.t.untarget)) { f.out = false; continue; }
        if (d > 0.7) continue;
        if (f.out) { affect(h, f.t, ab); vfx.flash(f.x, 1.3, f.z, col, 1.6, 0.18); f.out = false; }
        else { f.done = true; heal(h, ab.healPer ?? 50); sparks(h, h.x, 1.3, h.z, 6, [acc, 0x3EE89A], 2); }
      }
    });
  },

  // ── Razor ──
  // Two wind blades launched from either side cross at the aim point; whoever stands in the X takes both and more.
  crosscut(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, [px, pz] = aimPoint(h, ab, aim), count = new Map();
    for (const s of [-1, 1]) {
      const ox = h.x - aim.dz * 2.2 * s, oz = h.z + aim.dx * 2.2 * s, vx = px - ox, vz = pz - oz, d = Math.hypot(vx, vz) || 1;
      fireBolt(h, ctx, ox, oz, vx / d, vz / d, { range: d + 2.5, width: ab.width, dmg: ab.dmg, slow: ab.slow, slowT: ab.slowT, pierce: true, onHit: (e) => count.set(e, (count.get(e) ?? 0) + 1) }, s > 0 ? col : acc);
    }
    vfx.arc(px, 1.2, pz, 1, 1, acc, 2.4, 0.3); vfx.arc(px, 1.2, pz, -1, 1, col, 2.4, 0.3);
    for (const [e, n] of count) {
      if (n < 2 || !e.alive) continue;
      dealDamage(e, ab.dmg * ((ab.crossMul ?? 1.6) - 1), h, true);
      vfx.flash(e.x, (e.hitY ?? 1) + 0.3, e.z, acc, 2.2, 0.22);
    }
  },

  // Fold flat as paper: untargetable and fast for a moment, slicing anyone slipped past.
  fold(h, ab) {
    const col = fx(h).color, acc = fx(h).accent, hit = new Set();
    addBuff(h, 'untarget', 1, ab.dur);
    addBuff(h, 'speed', ab.spd, ab.dur);
    vfx.ghost(h.x, h.z, acc, 0.4);
    h.effects.push({
      t: 0, dur: ab.dur, tag: 'fold',
      update(h, dt, ctx) {
        h.noAttack = true;
        particles.emit(h.x + rand(-0.4, 0.4), 1 + rand(0, 1), h.z + rand(-0.4, 0.4), rand(-1, 1), 0.3, rand(-1, 1), Math.random() < 0.7 ? 0xffffff : acc, 0.5, 0.5, FRAME.sparkle);
        forEachEnemy(ctx, h.team, h.x, h.z, 1.1, (e) => { if (!hit.has(e)) { hit.add(e); affect(h, e, ab); vfx.arc(e.x, 1.2, e.z, rand(-1, 1), rand(-1, 1), col, 1.8, 0.15); } });
      },
    });
  },

  // A long dash that cuts everything in the way; a beat later every cut re-opens for bonus damage and a stun.
  echo(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, hit = new Set(), L = ab.range, x0 = h.x, z0 = h.z, half = (ab.width ?? 1.6) / 2 + 0.3;
    h.runScript({
      dur: 0.12 + L * 0.018, x1: h.x + aim.dx * L, z1: h.z + aim.dz * L,
      tick: (h, ctx) => {
        particles.emit(h.x, 1.1, h.z, 0, 0.2, 0, 0xffffff, 0.8, 0.5, FRAME.sparkle);
        forEachEnemy(ctx, h.team, h.x, h.z, half, (e) => { if (!hit.has(e)) { hit.add(e); affect(h, e, { ...ab, stun: 0 }); } });
      },
      done: (h) => {
        const x1 = h.x, z1 = h.z;
        vfx.beam(x0, 1.1, z0, x1, 1.1, z1, acc, 0.12, ab.delay);
        ctx.later(ab.delay, () => {
          vfx.beam(x0, 1.1, z0, x1, 1.1, z1, col, 0.4, 0.25);
          for (const e of hit) {
            if (!e.alive) continue;
            dealDamage(e, ab.dmg * (ab.echoMul ?? 1.5), h, true);
            if (ab.stun) applyStatus(e, 'stun', ab.stun);
            vfx.arc(e.x, 1.2, e.z, aim.dz, -aim.dx, acc, 2.6, 0.2);
            sparks(h, e.x, 1.2, e.z, 10, [col, acc, 0xffffff], 4);
          }
          ctx.rig.shake(0.15);
        });
      },
    });
  },

  // ── Solace ──
  // A sigil of dawn grows, then a pillar of light erupts: the bright centre hits twice as hard and stuns.
  sigil(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, [x, z] = aimPoint(h, ab, aim), R = ab.radius, C = ab.core;
    vfx.rune(x, z, acc, R * 1.6, ab.delay);
    vfx.decal(x, z, tele(h), R, ab.delay + 0.1);
    vfx.ring(x, 0.25, z, col, C * 1.5, ab.delay);
    ctx.anim(ab.delay, (u) => { const a = rand(0, Math.PI * 2), r = R * (1 - u) + C * u; particles.emit(x + Math.cos(a) * r, 0.2, z + Math.sin(a) * r, 0, 2.5, 0, Math.random() < 0.5 ? col : acc, 0.6, 0.4, FRAME.star); });
    ctx.later(ab.delay, () => {
      vfx.column(x, z, col, 0.8);
      vfx.ring(x, 0.3, z, acc, R * 1.3, 0.4);
      vfx.flash(x, 1.4, z, 0xffffff, C * 2.4, 0.3);
      forEachEnemy(ctx, h.team, x, z, R, (e) => {
        const core = Math.hypot(e.x - x, e.z - z) - (e.radius ?? 0) <= C;
        affect(h, e, { ...ab, dmg: ab.dmg * (core ? ab.coreMul : 1), stun: core ? ab.coreStun : 0 }, { x, z });
        if (core) sparks(h, e.x, 1.4, e.z, 10, [col, 0xffffff], 4);
      });
      ctx.rig.shake(0.14);
    });
  },

  // Throw a spinning halo: it hovers over the spot burning enemies, then returns, healing allies it passes.
  halotoss(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, [tx, tz] = aimPoint(h, ab, aim), x0 = h.x, z0 = h.z, fly = 0.35, back = 0.45, total = fly + ab.hover + back, healed = new Set();
    let tick = 0, vis = 0;
    ctx.anim(total, (u, dt) => {
      const t = u * total;
      let x, z;
      if (t < fly) { const k = t / fly; x = lerp(x0, tx, k); z = lerp(z0, tz, k); }
      else if (t < fly + ab.hover) { x = tx; z = tz; }
      else { const k = Math.min(1, (t - fly - ab.hover) / back); x = lerp(tx, h.x, k); z = lerp(tz, h.z, k); }
      if ((vis -= dt) <= 0) { vis = 0.07; vfx.ring(x, 1.5, z, t < fly + ab.hover ? col : acc, ab.r * 1.1, 0.12); }
      particles.emit(x + rand(-0.6, 0.6), 1.5, z + rand(-0.6, 0.6), 0, -1, 0, Math.random() < 0.5 ? col : acc, 0.5, 0.4, FRAME.star);
      if (t >= fly && t < fly + ab.hover && (tick -= dt) <= 0) {
        tick = 0.3;
        vfx.decal(x, z, col, ab.r, 0.35);
        forEachEnemy(ctx, h.team, x, z, ab.r, (e) => affect(h, e, { dmg: ab.dps * 0.3 }, { x, z }));
      }
      if (t >= fly + ab.hover) {
        forEachAlly(ctx, h.team, x, z, 1.6, (a) => { if (!healed.has(a)) { healed.add(a); heal(a, ab.heal); sparks(h, a.x, 1.3, a.z, 6, [0x3EE89A, acc], 2); } });
        if (u >= 1 && !healed.has(h)) heal(h, ab.heal * 0.5);
      }
    });
  },

  // A column of grace drops at the aim point and slowly hunts the nearest enemy hero, then flares to stun.
  eclipse(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, R = ab.radius, p = { x: 0, z: 0 };
    [p.x, p.z] = aimPoint(h, ab, aim);
    let tick = 0, vis = 0;
    vfx.streak(p.x, 12, p.z, p.x, 0.3, p.z, col, 0.3, 5);
    ctx.anim(ab.dur, (u, dt) => {
      let tgt = null, bd = R * 3;
      for (const e of ctx.heroes) if (e.team !== h.team && e.alive && !e.untarget) { const d = Math.hypot(e.x - p.x, e.z - p.z); if (d < bd) { bd = d; tgt = e; } }
      if (tgt && bd > 0.3) { const s = Math.min(bd, ab.speed * dt); p.x += ((tgt.x - p.x) / bd) * s; p.z += ((tgt.z - p.z) / bd) * s; }
      if ((vis -= dt) <= 0) { vis = 0.3; vfx.column(p.x, p.z, col, 0.35); vfx.decal(p.x, p.z, acc, R, 0.4); vfx.ring(p.x, 0.3, p.z, col, R * 1.2, 0.3); }
      for (let k = 0; k < 2; k++) { const a = rand(0, Math.PI * 2), r = rand(0, R); particles.emit(p.x + Math.cos(a) * r, 4, p.z + Math.sin(a) * r, 0, -6, 0, k ? col : acc, 0.6, 0.6, FRAME.star); }
      if ((tick -= dt) <= 0) { tick = 0.25; forEachEnemy(ctx, h.team, p.x, p.z, R, (e) => affect(h, e, { dmg: ab.dps * 0.25, slow: true, slowT: 0.5 }, { x: p.x, z: p.z })); }
      if (u >= 1) boom(h, ctx, p.x, p.z, R, { dmg: ab.endDmg, stun: ab.endStun }, col, acc);
    });
  },

  // ── Brine ──
  // A salt bomb skips along the water line, bursting at every bounce.
  skipbomb(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, n = ab.bounces, x0 = h.x, z0 = h.z, tg = tele(h);
    let px = x0, pz = z0, t0 = 0;
    for (let i = 0; i < n; i++) {
      const d = ab.range * (i + 1) / n, x = x0 + aim.dx * d, z = z0 + aim.dz * d, fx0 = px, fz0 = pz, dur = 0.26, wait = t0;
      vfx.decal(x, z, tg, ab.radius, wait + dur + 0.1);
      ctx.anim(dur, (u) => particles.emit(lerp(fx0, x, u), GROUND + 1 + Math.sin(Math.PI * u) * (1.8 - i * 0.3), lerp(fz0, z, u), 0, 0, 0, acc, 1.1, 0.25, FRAME.ring), wait);
      ctx.later(wait + dur, () => { boom(h, ctx, x, z, ab.radius, ab, col, acc); particles.burst(x, 0.3, z, 8, { color: [col, 0xffffff], speed: 2, up: 6, size: 0.8, life: 0.6, frame: FRAME.ring, grav: 10 }); });
      px = x; pz = z; t0 += dur;
    }
  },

  // Fire a heavy salt shell and ride the recoil backward.
  recoil(h, ab, ctx, aim) {
    BEHAVIORS.missile(h, { ...ab, shape: 'boulder' }, ctx, aim);
    const face = Math.atan2(aim.dx, aim.dz), col = fx(h).color;
    vfx.ring(h.x, 0.25, h.z, col, 2.4, 0.3);
    h.runScript({
      dur: 0.32, x1: h.x - aim.dx * ab.back, z1: h.z - aim.dz * ab.back, h: 0.7,
      tick: (h) => { h.face = face; particles.emit(h.x, 0.6, h.z, aim.dx * 3, 1, aim.dz * 3, 0xffffff, 0.7, 0.4, FRAME.ring); },
    });
  },

  // A marching barrage: shells land one after another, walking away from Brine along the aim line.
  carpet(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, n = ab.count, x0 = h.x, z0 = h.z, tg = tele(h);
    for (let i = 0; i < n; i++) {
      const d = 2 + (ab.range - 2) * (i / (n - 1)), s = i % 2 ? -0.6 : 0.6, x = x0 + aim.dx * d - aim.dz * s, z = z0 + aim.dz * d + aim.dx * s, wait = 0.35 + i * ab.step;
      vfx.decal(x, z, tg, ab.radius, wait + 0.1);
      ctx.anim(0.35, (u) => particles.emit(lerp(h.x, x, u), GROUND + 1.6 + Math.sin(Math.PI * u) * 3, lerp(h.z, z, u), 0, 0, 0, i % 2 ? col : acc, 1, 0.25, FRAME.ring), wait - 0.35);
      ctx.later(wait, () => boom(h, ctx, x, z, ab.radius, ab, col, acc));
    }
    h.effects.push({ t: 0, dur: 0.3, update(h) { h.noAttack = true; } });
  },

  // ── Longshot ──
  // Plant the watchtower legs: barely moving, but more basic range, faster shots and some damage reduction.
  perch(h, ab) {
    const col = fx(h).color, acc = fx(h).accent;
    let vis = 0;
    vfx.ring(h.x, 0.25, h.z, acc, 3, 0.4);
    h.effects.push({
      t: 0, dur: ab.dur, tag: 'perch',
      update(h, dt) {
        h.moveMul = ab.moveMul ?? 0.25;
        h.basicRange += ab.bonusRange;
        addBuff(h, 'aspd', ab.aspd, 0.1);
        addBuff(h, 'dr', ab.dr, 0.1);
        if ((vis -= dt) <= 0) { vis = 0.5; vfx.ring(h.x, 0.2, h.z, col, (h.basic.range + ab.bonusRange) * 2, 0.5); }
      },
    });
  },

  // Fire a grapnel and zip to the spot, leaving a tripwire across where you stood.
  zipline(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, d = aim.manual ? Math.min(aim.dist, ab.range) : ab.range, x1 = h.x + aim.dx * d, z1 = h.z + aim.dz * d;
    const wx = h.x, wz = h.z, nx = aim.dx, nz = aim.dz, half = (ab.wire ?? 4) / 2;
    vfx.beam(h.x, 1.4, h.z, x1, 1.4, z1, acc, 0.08, 0.3);
    vfx.flash(x1, 1.4, z1, col, 1.2, 0.2);
    h.runScript({ dur: 0.12 + d * 0.022, x1, z1, h: 0.9 });
    let done = false, vis = 0;
    ctx.anim(ab.wireDur ?? 6, (u, dt) => {
      if (done) return;
      if ((vis -= dt) <= 0) { vis = 0.4; vfx.beam(wx + nz * half, 0.45, wz - nx * half, wx - nz * half, 0.45, wz + nx * half, h.team === 0 ? acc : col, 0.1, 0.45); }
      if (u * (ab.wireDur ?? 6) < 0.3) return;
      forEachEnemy(ctx, h.team, wx, wz, half + 1, (e) => {
        if (done || !mover(e)) return;
        const rx = e.x - wx, rz = e.z - wz;
        if (Math.abs(rx * nx + rz * nz) <= 0.6 + e.radius * 0.5 && Math.abs(rz * nx - rx * nz) <= half + e.radius) {
          done = true;
          affect(h, e, { dmg: ab.dmg, stun: ab.stun });
          vfx.flash(e.x, 0.6, e.z, col, 1.8, 0.25);
          sparks(h, e.x, 0.6, e.z, 10, [col, acc], 3);
        }
      });
    });
  },

  // Brace and sight down a laser line, then one bolt that hurts more the further it flies.
  longwatch(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, L = ab.range, { dx, dz } = aim, face = Math.atan2(dx, dz);
    let vis = 0;
    h.effects.push({
      t: 0, dur: ab.delay, tag: 'perch',
      update(h, dt) {
        h.moveMul = 0; h.noAttack = true; h.face = face; h.faceHold = 0.2;
        if ((vis -= dt) <= 0) { vis = 0.1; vfx.beam(h.x, 1.4, h.z, h.x + dx * L, 1.4, h.z + dz * L, col, 0.05 + this.t * 0.06, 0.12); }
      },
    });
    ctx.later(ab.delay, () => {
      if (!h.alive || h.stun > 0) return;
      vfx.beam(h.x, 1.4, h.z, h.x + dx * L, 1.4, h.z + dz * L, col, 0.5, 0.3);
      vfx.streak(h.x, 1.4, h.z, h.x + dx * L, 1.4, h.z + dz * L, acc, 0.3, 6);
      vfx.flash(h.x + dx * 1.2, 1.4, h.z + dz * 1.2, 0xffffff, 2, 0.15);
      inLine(ctx, h.team, h.x, h.z, dx, dz, L, ab.width, (e, al) => {
        affect(h, e, { ...ab, dmg: ab.dmg * (1 + (ab.farMul ?? 1) * Math.min(1, al / L)) });
        sparks(h, e.x, 1.2, e.z, 12, [col, acc, 0xffffff], 5);
      });
      ctx.rig.shake(0.2);
    });
  },

  // ── Aurora ──
  // An arrow that splinters into a fan of shards when it strikes the first enemy.
  splitshot(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent;
    let first = null, bd = Infinity;
    inLine(ctx, h.team, h.x, h.z, aim.dx, aim.dz, ab.range, ab.width, (e, al) => { if (al > 0 && al < bd) { bd = al; first = e; } });
    fireBolt(h, ctx, h.x, h.z, aim.dx, aim.dz, { ...ab, pierce: false }, col);
    if (!first) return;
    const base = Math.atan2(aim.dx, aim.dz), n = ab.splits;
    for (let k = 0; k < n; k++) {
      const a = base + (n > 1 ? (k / (n - 1) - 0.5) * ab.spread * DEG : 0);
      fireBolt(h, ctx, first.x, first.z, Math.sin(a), Math.cos(a), { range: ab.splitRange, width: 0.8, dmg: ab.splitDmg, slow: ab.slow, slowT: ab.slowT, pierce: true }, k % 2 ? col : acc);
    }
  },

  // A flare hangs over the spot: enemies under it are revealed and slowed, allies under it shoot faster.
  flare(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, [x, z] = aimPoint(h, ab, aim), R = ab.r;
    let tick = 0, vis = 0;
    vfx.streak(h.x, 1.4, h.z, x, 5, z, col, 0.3, 4);
    ctx.anim(ab.dur, (u, dt) => {
      if ((vis -= dt) <= 0) { vis = 0.45; vfx.decal(x, z, col, R, 0.55); vfx.flash(x, 5, z, u % 0.2 < 0.1 ? col : acc, 2.4, 0.4); }
      particles.emit(x + rand(-R, R) * 0.7, 5, z + rand(-R, R) * 0.7, 0, -3, 0, Math.random() < 0.5 ? col : acc, 0.5, 0.9, FRAME.star);
      if ((tick -= dt) > 0) return;
      tick = 0.2;
      forEachEnemy(ctx, h.team, x, z, R, (e) => {
        if (e.buf?.hidden) delete e.buf.hidden;
        e.hidden = false;
        applyStatus(e, 'slow', 0.4);
      });
      forEachAlly(ctx, h.team, x, z, R, (a) => addBuff(a, 'aspd', ab.aspd, 0.5));
    }, 0.3);
    ctx.later(0.3, () => vfx.ring(x, 0.3, z, acc, R * 1.3, 0.4));
  },

  // A curtain of polar light sweeps across a wide arc; everything it brushes is stunned for a moment.
  ribbon(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, base = Math.atan2(aim.dx, aim.dz), half = (ab.arc / 2) * DEG, L = ab.range, hit = new Set();
    let vis = 0;
    h.effects.push({ t: 0, dur: ab.dur, update(h) { h.noAttack = true; h.moveMul = 0.4; } });
    ctx.anim(ab.dur, (u, dt) => {
      if (!h.alive) return;
      const a = base - half + 2 * half * u, dx = Math.sin(a), dz = Math.cos(a);
      h.face = a; h.faceHold = 0.2;
      if ((vis -= dt) <= 0) {
        vis = 0.05;
        vfx.beam(h.x, 1.0, h.z, h.x + dx * L, 1.0, h.z + dz * L, col, 0.45, 0.2);
        vfx.beam(h.x, 2.0, h.z, h.x + dx * L, 2.6, h.z + dz * L, acc, 0.3, 0.2);
      }
      for (let k = 0; k < 2; k++) { const r = rand(1, L); particles.emit(h.x + dx * r, rand(0.5, 3), h.z + dz * r, 0, 0.6, 0, k ? col : acc, 0.7, 0.6, FRAME.star); }
      inLine(ctx, h.team, h.x, h.z, dx, dz, L, ab.width, (e) => { if (!hit.has(e)) { hit.add(e); affect(h, e, ab); } });
    });
  },

  // ── Petal ──
  // Pirouette along the aim: every ally brushed gets a petal shield, enemies brushed are spun away.
  pirouette(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, d = Math.min(aim.dist ?? ab.range, ab.range), shielded = new Set([h]), hitE = new Set(), half = ab.width / 2 + 0.4;
    if (ab.shield) giveShield(h, ab.shield, ab.dur);
    const spin = { t: 0, dur: 0.15 + d * 0.03, update(h) { h.spin = 1; } };
    h.effects.push(spin);
    h.runScript({
      dur: spin.dur, x1: h.x + aim.dx * d, z1: h.z + aim.dz * d,
      tick: (h, ctx) => {
        particles.emit(h.x + rand(-0.8, 0.8), 1.2, h.z + rand(-0.8, 0.8), rand(-2, 2), 1, rand(-2, 2), Math.random() < 0.5 ? col : 0xF4E6FF, 0.7, 0.5, FRAME.star);
        forEachAlly(ctx, h.team, h.x, h.z, half, (a) => {
          if (shielded.has(a)) return;
          shielded.add(a); giveShield(a, ab.allyShield, ab.dur); vfx.link(h, a, col, 0.3, 1.2, a.hitY ?? 1.1); sparks(h, a.x, 1.2, a.z, 8, [col, acc], 2);
        });
        forEachEnemy(ctx, h.team, h.x, h.z, half, (e) => { if (!hitE.has(e)) { hitE.add(e); affect(h, e, ab, { x: h.x, z: h.z }); } });
      },
      done: (h) => vfx.ring(h.x, 0.25, h.z, col, 3, 0.35),
    });
  },

  // Petals orbit the most hurt ally as a shield; whatever survives flies at the nearest enemy when it ends.
  petalguard(h, ab, ctx) {
    let ally = h;
    forEachAlly(ctx, h.team, h.x, h.z, ab.range, (a) => { if (a.hp / a.maxHp < ally.hp / ally.maxHp - 0.05 || (ally === h && a !== h && a.hp < a.maxHp && a.hp / a.maxHp <= h.hp / h.maxHp)) ally = a; });
    const col = fx(h).color, acc = fx(h).accent, n = ab.petals;
    giveShield(ally, ab.allyShield, ab.dur);
    const start = ally.shieldHp;
    let ang = 0;
    if (ally !== h) vfx.link(h, ally, col, 0.35, 1.2, ally.hitY ?? 1.1);
    ctx.anim(ab.dur, (u, dt) => {
      if (!ally.alive) return;
      ang += dt * 4;
      const left = Math.ceil(n * Math.min(1, ally.shieldHp / Math.max(1, start)));
      for (let k = 0; k < left; k++) {
        const a = ang + (k / n) * Math.PI * 2;
        particles.emit(ally.x + Math.cos(a) * 1.3, 1.3 + Math.sin(a * 2) * 0.2, ally.z + Math.sin(a) * 1.3, 0, 0, 0, k % 2 ? col : 0xF4E6FF, 1.0, 0.08, FRAME.star);
      }
      if (u < 1 || !left || ally.shieldHp <= 0) return;
      const t = pickTarget(ctx, h.team, ally.x, ally.z, 6, ['heroes', 'minions']);
      if (!t) return;
      vfx.streak(ally.x, 1.3, ally.z, t.x, (t.hitY ?? 1) + 0.2, t.z, col, 0.25, 3);
      dealDamage(t, ab.dmg * left, h, true);
      sparks(h, t.x, 1.2, t.z, 10, [col, acc], 3);
    });
  },

  // The whole team dances: heal, haste and damage reduction for everyone near, while petal rings shove enemies off Petal.
  waltz(h, ab, ctx) {
    const col = fx(h).color, acc = fx(h).accent;
    forEachAlly(ctx, h.team, h.x, h.z, ab.allyR, (a) => { heal(a, ab.heal); addBuff(a, 'speed', ab.spd, ab.dur); addBuff(a, 'dr', ab.dr, ab.dur); sparks(h, a.x, 1.2, a.z, 6, [col, 0x3EE89A], 2); });
    vfx.ring(h.x, 0.25, h.z, col, ab.allyR * 2, 0.5);
    let pulse = 0, ang = 0;
    h.effects.push({
      t: 0, dur: ab.dur, tag: 'waltz',
      update(h, dt, ctx) {
        ang += dt * 3;
        for (let k = 0; k < 3; k++) { const a = ang + (k / 3) * Math.PI * 2; particles.emit(h.x + Math.cos(a) * ab.repelR, 0.6, h.z + Math.sin(a) * ab.repelR, 0, 1, 0, k % 2 ? col : 0xF4E6FF, 0.8, 0.3, FRAME.star); }
        if ((pulse -= dt) > 0) return;
        pulse = 0.6;
        vfx.ring(h.x, 0.3, h.z, col, ab.repelR * 2.2, 0.3);
        forEachEnemy(ctx, h.team, h.x, h.z, ab.repelR, (e) => affect(h, e, ab, { x: h.x, z: h.z }));
      },
    });
  },

  // ── Beacon ──
  // A spotlight locks onto a foe: it slows, reveals and singes them; still lit at the end means stunned.
  spotlight(h, ab, ctx) {
    const t = pickTarget(ctx, h.team, h.x, h.z, ab.range, ['heroes', 'minions']);
    if (!t) return false;
    const col = fx(h).color, acc = fx(h).accent;
    let lost = false, tick = 0, vis = 0;
    ctx.anim(ab.dur, (u, dt) => {
      if (lost) return;
      if (!t.alive || !h.alive || Math.hypot(t.x - h.x, t.z - h.z) > ab.breakR) { lost = true; return; }
      if (t.buf?.hidden) delete t.buf.hidden;
      t.hidden = false;
      applyStatus(t, 'slow', 0.3);
      if ((vis -= dt) <= 0) { vis = 0.08; vfx.beam(h.x, 3.2, h.z, t.x, 0.4, t.z, col, 0.5, 0.12); vfx.decal(t.x, t.z, col, 1.4, 0.15); }
      if ((tick -= dt) <= 0) { tick = 0.25; dealDamage(t, ab.dps * 0.25, h, true); }
      if (u < 1) return;
      applyStatus(t, 'stun', ab.endStun);
      vfx.flash(t.x, (t.hitY ?? 1) + 0.6, t.z, 0xffffff, 2.4, 0.3);
      sparks(h, t.x, 1.4, t.z, 12, [col, acc, 0xffffff], 4);
    });
  },

  // Throw a lifebuoy to an ally in the aim line (or the most hurt one) and reel them in to safety with a shield.
  buoy(h, ab, ctx, aim) {
    let a = null, bd = Infinity;
    forEachAlly(ctx, h.team, h.x + aim.dx * ab.range * 0.5, h.z + aim.dz * ab.range * 0.5, ab.range * 0.5 + 1.5, (e) => {
      if (e === h) return;
      const rx = e.x - h.x, rz = e.z - h.z, al = rx * aim.dx + rz * aim.dz, lat = Math.abs(rx * aim.dz - rz * aim.dx);
      if (al > 0 && al <= ab.range + e.radius && lat <= ab.width / 2 + e.radius && al < bd) { bd = al; a = e; }
    });
    if (!a && !aim.manual) forEachAlly(ctx, h.team, h.x, h.z, ab.range, (e) => { if (e !== h && (!a || e.hp / e.maxHp < a.hp / a.maxHp)) a = e; });
    if (!a) return false;
    const col = fx(h).color, acc = fx(h).accent, dx = a.x - h.x, dz = a.z - h.z, d = Math.hypot(dx, dz) || 1;
    vfx.link(h, a, acc, 0.45, 1.2, a.hitY ?? 1.1);
    vfx.ring(a.x, 1.0, a.z, 0xC8323A, 1.6, 0.35);
    if (d > 2.6) pullTo(a, h.x + (dx / d) * 2.4, h.z + (dz / d) * 2.4, 0.35);
    giveShield(a, ab.allyShield, ab.dur ?? 3);
    if (ab.allyHeal) heal(a, ab.allyHeal);
    a.slow = 0;
    sparks(h, a.x, 1.2, a.z, 10, [col, acc], 3);
  },

  // Raise a lighthouse at the spot: twin beams sweep around it, scorching enemies and healing allies they cross.
  lighthouse(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, [x, z] = aimPoint(h, ab, aim), L = ab.beam, seen = new Map();
    let ang = Math.atan2(aim.dx, aim.dz), vis = 0, col2 = 0, age = 0;
    vfx.column(x, z, col, 0.8);
    ctx.zones.addField({ team: h.team, src: h, x, z, r: 2.5, dur: ab.dur, allySpd: 0.2, color: acc });
    ctx.anim(ab.dur, (u, dt) => {
      age += dt; ang += (ab.rot ?? 1.6) * dt;
      if ((col2 -= dt) <= 0) { col2 = 0.9; vfx.column(x, z, col, 0.5); vfx.ring(x, 0.3, z, acc, 3, 0.4); }
      for (const s of [0, Math.PI]) {
        const a = ang + s, dx = Math.sin(a), dz = Math.cos(a);
        if (vis <= 0) vfx.beam(x, 2.6, z, x + dx * L, 0.5, z + dz * L, col, 0.55, 0.12);
        inLine(ctx, h.team, x, z, dx, dz, L, 1.6, (e) => {
          if (age - (seen.get(e) ?? -9) < 0.5) return;
          seen.set(e, age);
          affect(h, e, { dmg: ab.dmg, slow: true, slowT: 0.8 }, { x, z });
        });
        forEachAlly(ctx, h.team, x + dx * L / 2, z + dz * L / 2, L / 2 + 1, (al) => {
          const rx = al.x - x, rz = al.z - z, along = rx * dx + rz * dz, lat = Math.abs(rx * dz - rz * dx);
          if (along < 0 || along > L || lat > 1.2 || age - (seen.get(al) ?? -9) < 0.5) return;
          seen.set(al, age); heal(al, ab.heal); particles.emit(al.x, 1.4, al.z, 0, 2, 0, 0x3EE89A, 0.6, 0.5, FRAME.star);
        });
      }
      if ((vis -= dt) <= 0) vis = 0.08;
    });
  },
};

// Damage-taken reactions: Barnacle Hide pricks melee-range attackers, Riposte lunges back at the first one.
let reacting = false;
bus.on('dmg', ({ t, src }) => {
  if (reacting || !t?.effects || !src?.alive || src.team === t.team || !mover(src) || !t.alive) return;
  reacting = true;
  try {
    const barn = t.effects.find((e) => e.tag === 'barnacle');
    if (barn && !barn.cool.has(src) && Math.hypot(src.x - t.x, src.z - t.z) <= barn.ab.radius) {
      barn.cool.set(src, 0.4);
      dealDamage(src, barn.ab.thorns, t, true);
      applyStatus(src, 'slow', 0.8);
      vfx.link(t, src, fx(t).accent, 0.15, 1, src.hitY ?? 1, 0.1);
    }
    const rip = t.effects.find((e) => e.tag === 'riposte' && !e.fired);
    if (rip && !t.script && Math.hypot(src.x - t.x, src.z - t.z) <= rip.ab.range) {
      rip.fired = true; rip.t = rip.dur;
      const dx = src.x - t.x, dz = src.z - t.z, d = Math.hypot(dx, dz) || 1, go = Math.max(0, d - t.radius - (src.radius ?? 0.5) - 0.3);
      vfx.flash(t.x, 1.4, t.z, 0xffffff, 2, 0.15);
      t.runScript({
        dur: 0.08 + go * 0.02, x1: t.x + (dx / d) * go, z1: t.z + (dz / d) * go, h: 0.3,
        done: (h) => {
          if (!src.alive) return;
          affect(h, src, rip.ab);
          vfx.arc(h.x, 1.2, h.z, dx / d, dz / d, fx(h).accent, 2.6, 0.2);
          sparks(h, src.x, 1.2, src.z, 12, [fx(h).color, fx(h).accent, 0xffffff], 5);
        },
      });
    }
  } finally { reacting = false; }
});

// Skill glyphs for the new kinds (same style as ui/icons.js: white shapes, dark ink outline, 64x64).
const INK = '#0B1020', W = 'fill="#fff"', L = (w = 6) => `fill="none" stroke="#fff" stroke-width="${w}"`;
const svg = (body) => `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" stroke="${INK}" stroke-width="3" stroke-linejoin="miter" stroke-linecap="square">${body}</svg>`;
const GLYPHS = {
  menhir: `<polygon points="22,58 24,14 32,6 40,14 42,58" ${W}/><path d="M8 58h48" ${L(5)}/>`,
  bedrock: `<rect x="10" y="34" width="44" height="22" ${W}/><path d="M32 30V6M20 18l12-12 12 12" ${L(6)}/>`,
  topple: `<rect x="26" y="6" width="14" height="40" transform="rotate(35 33 46)" ${W}/><path d="M6 58h52" ${L(5)}/>`,
  undertow: `<path d="M6 24q13-12 26 0t26 0M6 42q13-12 26 0t26 0" ${L(6)}/><polygon points="6,50 18,58 6,58" ${W}/>`,
  barnacle: `<circle cx="32" cy="34" r="20" ${W}/><path d="M32 6v8M10 14l6 6M54 14l-6 6M4 34h8M52 34h8" ${L(5)}/>`,
  tsunami: `<path d="M4 56C10 30 30 10 54 14 40 20 38 34 48 38 34 44 22 40 22 56Z" ${W}/>`,
  suplex: `<path d="M12 50C12 14 52 14 52 46" ${L(7)}/><polygon points="44,40 60,40 52,56" ${W}/><circle cx="12" cy="54" r="6" ${W}/>`,
  ropes: `<path d="M8 10v44M8 20h10M8 32h10M8 44h10" ${L(5)}/><polygon points="24,22 46,22 46,12 60,32 46,52 46,42 24,42" ${W}/>`,
  mainevent: `<polygon points="32,6 54,19 54,45 32,58 10,45 10,19" fill="none" stroke="#fff" stroke-width="6"/><path d="M32 22l6 10-6 10-6-10Z" ${W}/>`,
  riposte: `<path d="M8 56L46 18M56 56L18 18" ${L(6)}/><polygon points="40,10 56,8 54,24" ${W}/>`,
  quillvolley: `<circle cx="32" cy="32" r="8" ${W}/><path d="M32 4v14M32 46v14M4 32h14M46 32h14M12 12l10 10M42 42l10 10M52 12L42 22M22 42L12 52" ${L(4)}/>`,
  bristleball: `<circle cx="30" cy="34" r="16" ${W}/><path d="M30 10v6M50 20l-5 4M54 38h-6M10 22l5 4M6 40h6M18 54l4-5M42 54l-4-5" ${L(4)}/>`,
  flit: `<polyline points="6,52 20,28 32,44 44,18 58,30" ${L(6)}/><circle cx="58" cy="30" r="4" ${W}/>`,
  lure: `<path d="M32 8C42 20 44 30 32 40 20 30 22 20 32 8Z" ${W}/><path d="M10 56q10-12 22-12t22 12" ${L(5)}/>`,
  foxfire: `<path d="M16 50C8 40 16 28 20 22c2 8 6 10 8 6-2 12 4 18-12 22ZM40 44c-6-6 0-16 4-20 0 6 4 8 6 4 2 8-2 14-10 16Z" ${W}/>`,
  crosscut: `<path d="M10 10L54 54M54 10L10 54" ${L(8)}/>`,
  fold: `<polygon points="10,54 32,8 54,54 32,40" ${W}/>`,
  echo: `<path d="M6 46L58 18" ${L(7)}/><path d="M10 56L58 30" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="6 5"/>`,
  sigil: `<circle cx="32" cy="32" r="24" ${L(5)}/><circle cx="32" cy="32" r="9" ${W}/><path d="M32 2v10M32 52v10M2 32h10M52 32h10" ${L(4)}/>`,
  halotoss: `<ellipse cx="34" cy="26" rx="22" ry="9" ${L(6)}/><path d="M12 54L28 38" ${L(5)}/><polygon points="8,46 18,58 4,58" ${W}/>`,
  eclipse: `<rect x="24" y="4" width="16" height="40" ${W}/><ellipse cx="32" cy="52" rx="22" ry="7" ${L(5)}/>`,
  skipbomb: `<circle cx="50" cy="38" r="10" ${W}/><path d="M4 50q8-20 16 0q6-14 12 0q4-8 8 0" ${L(5)}/>`,
  recoil: `<rect x="22" y="22" width="34" height="18" ${W}/><polygon points="20,31 4,20 4,42" ${W}/><circle cx="58" cy="31" r="4" ${W}/>`,
  carpet: `<circle cx="12" cy="48" r="7" ${W}/><circle cx="28" cy="38" r="7" ${W}/><circle cx="44" cy="28" r="7" ${W}/><circle cx="56" cy="14" r="5" ${W}/>`,
  perch: `<path d="M32 30L14 60M32 30L50 60M32 30v30" ${L(5)}/><rect x="22" y="6" width="20" height="20" ${W}/>`,
  zipline: `<path d="M6 58L58 6" ${L(4)}/><polygon points="46,6 58,6 58,18" ${W}/><path d="M6 44h18" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="4 4"/>`,
  longwatch: `<circle cx="22" cy="32" r="14" ${L(5)}/><path d="M36 32h26M22 18v28" ${L(4)}/><circle cx="22" cy="32" r="4" ${W}/>`,
  splitshot: `<path d="M4 32h26" ${L(6)}/><path d="M30 32L58 12M30 32h28M30 32l28 20" ${L(4)}/>`,
  flare: `<circle cx="32" cy="16" r="10" ${W}/><path d="M32 30v28M18 58h28" ${L(5)}/>`,
  ribbon: `<path d="M8 50C16 20 30 40 36 18S54 20 58 8" ${L(8)}/>`,
  pirouette: `<ellipse cx="32" cy="44" rx="24" ry="8" ${L(5)}/><path d="M32 8v32" ${L(6)}/><circle cx="32" cy="10" r="5" ${W}/>`,
  petalguard: `<circle cx="32" cy="32" r="8" ${W}/><ellipse cx="32" cy="10" rx="6" ry="9" ${W}/><ellipse cx="54" cy="32" rx="9" ry="6" ${W}/><ellipse cx="32" cy="54" rx="6" ry="9" ${W}/><ellipse cx="10" cy="32" rx="9" ry="6" ${W}/>`,
  waltz: `<circle cx="32" cy="32" r="24" fill="none" stroke="#fff" stroke-width="4" stroke-dasharray="10 6"/><path d="M24 22l8 10 8-10M32 32v14" ${L(5)}/>`,
  spotlight: `<polygon points="10,6 22,6 54,52 30,58" ${W}/><circle cx="44" cy="54" r="5" fill="#0B1020"/>`,
  buoy: `<circle cx="32" cy="32" r="22" ${L(10)}/><path d="M32 10v8M32 46v8M10 32h8M46 32h8" stroke="#C8323A" stroke-width="10"/>`,
  lighthouse: `<polygon points="24,58 28,22 36,22 40,58" ${W}/><rect x="25" y="10" width="14" height="10" ${W}/><path d="M42 14L62 6M42 18l20 6M22 14L2 6M22 18L2 24" ${L(3)}/>`,
};
for (const [k, body] of Object.entries(GLYPHS)) icons[k] ??= svg(body);
