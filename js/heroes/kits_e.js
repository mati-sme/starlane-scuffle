// v9.4 kit behaviors (batch E) for the wave4 champions. BEHAVIORS-style: (hero, ab, ctx, aim) => false | void.
// New kinds use `aimAs` / `botAs` (an existing kind's aim preview + bot rule) and `icon` (an existing glyph) on the skill data.
import { dealDamage, forEachEnemy, forEachAlly, applyStatus, shove, heal, addBuff, giveShield, AIR, pullTo } from '../game/combat.js';
import { pickTarget } from '../game/targeting.js';
import { particles, FRAME } from '../render/particles.js';
import { vfx } from '../render/vfx.js';

const fx = (h) => h.def.fx ?? h.def;
const mover = (e) => e.type === 'hero' || e.type === 'minion';
const spark = (h, x, y, z, n, c, speed = 3) => particles.burst(x, y, z, n, { color: c, speed, up: 2, size: 0.55, life: 0.6, frame: fx(h).frame ?? FRAME.sparkle, grav: 2 });

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

function point(h, ab, aim) {
  const d = Math.min(aim.dist || ab.range, ab.range);
  return { x: h.x + aim.dx * d, z: h.z + aim.dz * d };
}

export const KITS_E = {
  // Threshold s1: drop a door, yank foes in a cone through it to your side.
  gatepull(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent;
    const { x, z } = point(h, ab, aim);
    const tx = h.x, tz = h.z;
    vfx.ring(x, 0.3, z, acc, 2.2, 0.5);
    vfx.flash(x, 1.4, z, col, 2.4, 0.35);
    let n = 0;
    forEachEnemy(ctx, h.team, x, z, ab.r ?? 3, (e) => {
      if (!mover(e)) return;
      affect(h, e, ab, { x, z });
      if (e.alive) pullTo(e, tx + (Math.random() - 0.5), tz + (Math.random() - 0.5), ab.pullT ?? 0.35);
      n++;
    });
    spark(h, x, 1, z, 16, [col, acc, 0xffffff], 5);
    if (!n && !aim.manual) return false;
  },

  // Threshold ult: two doors, anything near the first is flung to the second.
  gatedoor(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent;
    const a = { x: h.x, z: h.z };
    const b = point(h, ab, aim);
    vfx.ring(a.x, 0.3, a.z, col, 2.8, 0.6);
    vfx.ring(b.x, 0.3, b.z, acc, 2.8, 0.6);
    vfx.link({ x: a.x, z: a.z, hitY: 1.2 }, { x: b.x, z: b.z, hitY: 1.2 }, col, 0.7, 1.4, 1.4);
    let tick = 0;
    h.effects.push({
      t: 0, dur: ab.dur,
      update(_h, dt, ctx) {
        if ((tick -= dt) > 0) return;
        tick = 0.2;
        vfx.ring(a.x, 0.25, a.z, col, 2.2, 0.2);
        vfx.ring(b.x, 0.25, b.z, acc, 2.2, 0.2);
        forEachEnemy(ctx, h.team, a.x, a.z, ab.r ?? 2.6, (e) => {
          if (!mover(e)) return;
          affect(h, e, { dmg: ab.dmg, stun: ab.stun }, { x: a.x, z: a.z });
          if (e.alive) { e.x = e.px = b.x; e.z = e.pz = b.z; vfx.ghost(b.x, b.z, acc, 0.3); }
        });
      },
    });
  },

  // Ironwake s1/ult: unstoppable charge — shake off crowd control while you barrel through.
  ramcharge(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, hit = new Set();
    const dist = ab.range, half = (ab.width ?? 2) / 2 + 0.3;
    if (ab.shield) giveShield(h, ab.shield, ab.dur ?? 1.2);
    vfx.ring(h.x, 0.25, h.z, col, 2.8, 0.3);
    h.runScript({
      dur: 0.16 + dist * 0.02, x1: h.x + aim.dx * dist, z1: h.z + aim.dz * dist,
      tick: (h, ctx) => {
        h.stun = 0; h.root = 0; h.charm = 0; h.air = 0; h.pull = null;
        particles.burst(h.x, 0.8, h.z, 4, { color: [col, acc], speed: 2, up: 1, size: 0.55, life: 0.4, frame: FRAME.sparkle, grav: 1 });
        forEachEnemy(ctx, h.team, h.x, h.z, half, (e) => {
          if (hit.has(e)) return;
          hit.add(e);
          affect(h, e, ab, { x: h.x, z: h.z, kdx: aim.dx, kdz: aim.dz });
          vfx.flash(e.x, 1, e.z, acc, 1.6, 0.2);
        });
      },
    });
  },

  // Sirocco s2: a wind wall that eats incoming enemy shots.
  windwall(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent;
    const len = ab.wall ?? 6, hx = h.x + aim.dx * 2.4, hz = h.z + aim.dz * 2.4;
    ctx.zones.addField({ team: h.team, src: h, wall: true, solid: false, len, dx: aim.dx, dz: aim.dz, x: hx, z: hz, dur: ab.dur, color: col, allySpd: ab.allySpd });
    vfx.ring(hx, 0.3, hz, acc, 3, 0.4);
    let tick = 0;
    h.effects.push({
      t: 0, dur: ab.dur,
      update(_h, dt, ctx) {
        if ((tick -= dt) > 0) return;
        tick = 0.05;
        const list = ctx.projectiles?.list;
        if (!list) return;
        const half = len / 2 + 0.8;
        for (const p of list) {
          if (!p.on || p.src?.team === h.team) continue;
          const rx = p.mesh.position.x - hx, rz = p.mesh.position.z - hz;
          const along = rx * -aim.dz + rz * aim.dx, lat = Math.abs(rx * aim.dx + rz * aim.dz);
          if (Math.abs(along) <= half && lat <= 1.1) {
            p.on = false; p.mesh.visible = false; if (p.tail) p.tail.visible = false;
            vfx.flash(p.mesh.position.x, 1, p.mesh.position.z, acc, 1.2, 0.2);
            spark(h, p.mesh.position.x, 1, p.mesh.position.z, 6, [col, acc, 0xffffff], 4);
          }
        }
      },
    });
  },

  // Coralith s1: tentacle grab that yanks then slams the ground under the target.
  reefgrab(h, ab, ctx, aim) {
    const best = firstAlong(ctx, h, aim.dx, aim.dz, ab.range, ab.width ?? 1.3);
    if (!best) return false;
    const col = fx(h).color, acc = fx(h).accent;
    vfx.link(h, best, col, 0.5, 1, best.hitY ?? 1);
    affect(h, best, { ...ab, dmg: ab.dmg * 0.5 }, { x: h.x, z: h.z });
    const keep = h.radius + best.radius + 0.4;
    const d = Math.hypot(best.x - h.x, best.z - h.z) || 1;
    const move = Math.min(ab.pull ?? 5, d - keep);
    if (move > 0 && best.alive) shove(best, h.x - best.x, h.z - best.z, move, 0.28);
    ctx.anim(0.22, (u) => {
      if (u < 1) return;
      const x = best.x, z = best.z;
      boom(h, ctx, x, z, ab.slamR ?? 2.4, { dmg: ab.dmg * 0.5, stun: ab.stun, knock: ab.knock }, { x, z });
    });
  },

  // Fable s1: leave a trick twin, go invisible, the twin pops if anyone walks up.
  tricktwin(h, ab, ctx) {
    const col = fx(h).color, acc = fx(h).accent, x = h.x, z = h.z;
    addBuff(h, 'hidden', 1, ab.hide ?? 2);
    if (ab.spd) addBuff(h, 'speed', ab.spd, ab.hide ?? 2);
    vfx.ghost(x, z, acc, ab.dur ?? 3);
    vfx.ring(x, 0.25, z, col, 1.6, 0.4);
    let alive = true, tick = 0;
    h.effects.push({
      t: 0, dur: ab.dur ?? 3,
      update(_h, dt, ctx) {
        if (!alive) return;
        if ((tick -= dt) <= 0) { tick = 0.25; vfx.ghost(x, z, acc, 0.3); }
        let popped = false;
        forEachEnemy(ctx, h.team, x, z, ab.r ?? 1.8, (e) => { if (mover(e)) popped = true; });
        if (popped || _h.effects.find(() => false)) { /* keep */ }
        if (popped) {
          alive = false;
          boom(h, ctx, x, z, ab.radius ?? 2.6, ab, { x, z });
        }
      },
    });
  },

  // Fable s2: swap with the nearest decoy-pop point or targeted foe (and leave a mark).
  twinswap(h, ab, ctx, aim) {
    const best = firstAlong(ctx, h, aim.dx, aim.dz, ab.range, ab.width ?? 1.6);
    if (!best) return false;
    const col = fx(h).color, acc = fx(h).accent, hx = h.x, hz = h.z;
    vfx.ghost(hx, hz, acc, 0.45); vfx.ghost(best.x, best.z, col, 0.45);
    vfx.link(h, best, col, 0.3, 1.1, best.hitY ?? 1.1);
    h.x = h.px = best.x; h.z = h.pz = best.z;
    best.x = hx; best.z = hz; if (best.px != null) { best.px = hx; best.pz = hz; }
    affect(h, best, ab, { x: hx, z: hz });
    best._fableMark = { src: h, t: ab.markT ?? 4, dmg: ab.markDmg ?? 60 };
    if (ab.spd) addBuff(h, 'speed', ab.spd, ab.spdT ?? 2);
  },

  // Fable ult: pop every marked foe.
  markburst(h, ab, ctx) {
    let n = 0;
    const col = fx(h).color, acc = fx(h).accent;
    const folks = [...(ctx.heroes ?? []), ...(ctx.minions?.list ?? [])];
    for (const e of folks) {
      const m = e._fableMark;
      if (!m || m.src !== h || !e.alive) continue;
      e._fableMark = null;
      boom(h, ctx, e.x, e.z, ab.r ?? 2.2, { dmg: (m.dmg ?? 60) + (ab.dmg ?? 0), stun: ab.stun }, { x: e.x, z: e.z });
      n++;
    }
    if (!n) boom(h, ctx, h.x + 0.1, h.z, ab.r ?? 2.4, ab);
    vfx.ring(h.x, 0.3, h.z, acc, 3.2, 0.4);
  },

  // Spire s1: hook to a foe or just dash the full line; then a kick that knocks them away.
  hookkick(h, ab, ctx, aim) {
    const best = firstAlong(ctx, h, aim.dx, aim.dz, ab.range, ab.width ?? 1.2);
    const col = fx(h).color, acc = fx(h).accent;
    const tx = best ? best.x - aim.dx * (h.radius + (best.radius ?? 0.6) + 0.3) : h.x + aim.dx * ab.range;
    const tz = best ? best.z - aim.dz * (h.radius + (best.radius ?? 0.6) + 0.3) : h.z + aim.dz * ab.range;
    if (best) vfx.link(h, best, col, 0.4, 1, best.hitY ?? 1);
    h.runScript({
      dur: 0.14, x1: tx, z1: tz,
      tick: () => {},
      end(h, ctx) {
        if (!best?.alive) return;
        affect(h, best, ab, { x: h.x, z: h.z, kdx: aim.dx, kdz: aim.dz });
        vfx.flash(best.x, 1.1, best.z, acc, 1.8, 0.2);
        spark(h, best.x, 1, best.z, 10, [col, acc, 0xffffff], 5);
      },
    });
  },

  // Novara s1/ult: delayed star fall at the aimed point. Ult drops a short volley.
  starburst(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent;
    const drops = ab.drops ?? 1, spread = ab.spread ?? 0;
    const base = point(h, ab, aim);
    for (let i = 0; i < drops; i++) {
      const x = base.x + (i ? (Math.random() - 0.5) * spread : 0);
      const z = base.z + (i ? (Math.random() - 0.5) * spread : 0);
      const delay = (ab.delay ?? 0.7) + i * (ab.gap ?? 0.22);
      vfx.ring(x, 0.2, z, acc, ab.r ?? 2.4, delay);
      ctx.anim(delay, (u) => {
        if (u < 1) {
          if (Math.random() < 0.4) particles.emit(x, 8 - u * 6, z, 0, -2, 0, col, 0.5, 0.4, FRAME.star ?? FRAME.sparkle);
          return;
        }
        boom(h, ctx, x, z, ab.r ?? 2.4, ab, { x, z });
      });
    }
  },

  // Dune s1: raise a ridge and surf it (a dash that leaves a raised path).
  ridgerun(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, hit = new Set();
    const dist = ab.range, half = (ab.width ?? 1.8) / 2 + 0.3;
    vfx.ring(h.x, 0.2, h.z, col, 2, 0.3);
    h.runScript({
      dur: 0.14 + dist * 0.02, x1: h.x + aim.dx * dist, z1: h.z + aim.dz * dist,
      tick: (h, ctx, u) => {
        if (u * dist % 1.4 < 0.15) {
          ctx.zones.addField({ team: h.team, src: h, x: h.x, z: h.z, r: ab.trailW ?? 1.4, dur: ab.trailDur ?? 2.5, allySpd: ab.allySpd ?? 0.25, color: acc });
        }
        forEachEnemy(ctx, h.team, h.x, h.z, half, (e) => {
          if (hit.has(e)) return;
          hit.add(e);
          affect(h, e, ab, { x: h.x, z: h.z });
        });
      },
    });
  },

  // Dune s2: toss a stone slab that knocks and leaves a short wall.
  slabtoss(h, ab, ctx, aim) {
    const { x, z } = point(h, ab, aim);
    const col = fx(h).color;
    boom(h, ctx, x, z, ab.r ?? 2.2, ab, { x, z });
    ctx.zones.addField({ team: h.team, src: h, wall: true, solid: true, len: ab.wall ?? 4, dx: aim.dx, dz: aim.dz, x, z, dur: ab.dur ?? 2.5, color: col });
  },

  // Glim s1: scoop nearby sparks (or spawn them) to power a later shot.
  sparksweep(h, ab, ctx) {
    const col = fx(h).color, acc = fx(h).accent;
    h.sparks = Math.min((h.sparks ?? 0) + (ab.gain ?? 2), ab.max ?? 8);
    vfx.ring(h.x, 0.25, h.z, acc, ab.r ?? 3.5, 0.4);
    let extra = 0;
    forEachEnemy(ctx, h.team, h.x, h.z, ab.r ?? 3.5, (e) => {
      if (!mover(e)) return;
      affect(h, e, ab, { x: h.x, z: h.z });
      extra++;
    });
    h.sparks = Math.min((h.sparks ?? 0) + extra, ab.max ?? 8);
    spark(h, h.x, 1, h.z, 8 + h.sparks * 2, [col, acc, 0xffffff], 4);
  },

  // Glim s2/ult: fire a huge shot that spends stored sparks.
  sparkshot(h, ab, ctx, aim) {
    const stacks = h.sparks ?? 0;
    if (ab.need && stacks < 1 && !ab.allowEmpty) return false;
    const spent = ab.spend != null ? Math.min(stacks, ab.spend) : stacks;
    h.sparks = stacks - spent;
    const mul = 1 + spent * (ab.per ?? 0.25);
    const col = fx(h).color, acc = fx(h).accent;
    const best = firstAlong(ctx, h, aim.dx, aim.dz, ab.range, ab.width ?? 1.4);
    vfx.cone(h.x, 1.2, h.z, aim.dx, aim.dz, col, ab.range * 0.35, 0.5, 0.2);
    if (best) {
      affect(h, best, { ...ab, dmg: ab.dmg * mul }, { x: h.x, z: h.z });
      if (ab.splash) boom(h, ctx, best.x, best.z, ab.splash, { dmg: ab.dmg * mul * 0.4 }, { x: best.x, z: best.z });
      spark(h, best.x, 1, best.z, 10 + spent * 3, [col, acc, 0xffffff], 6);
    } else {
      const { x, z } = point(h, ab, aim);
      boom(h, ctx, x, z, ab.r ?? 1.8, { dmg: ab.dmg * mul * 0.7 }, { x, z });
    }
  },

  // Lyra s1: swap hail (fast, closer) and pierce (long, hard) bow stances.
  stancebow(h, ab) {
    const hail = h._lyra !== 'pierce';
    h._lyra = hail ? 'pierce' : 'hail';
    if (h._lyraBase == null) {
      h.basic = { ...h.basic };
      h._lyraBase = { range: h.basic.range, dmg: h.basic.dmg, cd: h.basic.cd };
    }
    const b = h._lyraBase;
    if (h._lyra === 'pierce') {
      h.basic.range = b.range + (ab.pierceRange ?? 2.5);
      h.basic.dmg = b.dmg * (ab.pierceDmg ?? 1.25);
      h.basic.cd = b.cd * 1.15;
      h.basicRange = h.basic.range;
      addBuff(h, 'speed', -0.08, 1.2);
    } else {
      h.basic.range = b.range;
      h.basic.dmg = b.dmg * (ab.hailDmg ?? 0.85);
      h.basic.cd = b.cd * 0.8;
      h.basicRange = h.basic.range;
      addBuff(h, 'speed', ab.hailSpd ?? 0.12, 1.2);
    }
    const col = fx(h).color, acc = fx(h).accent;
    vfx.ring(h.x, 0.3, h.z, h._lyra === 'pierce' ? acc : col, 2.2, 0.35);
    spark(h, h.x, 1.2, h.z, 10, [col, acc], 3);
  },

  // Pip s1: hop onto the nearest ally, share a shield, then hop off with a heal.
  rideally(h, ab, ctx, aim) {
    let best = null, bd = Infinity;
    const cx = h.x + aim.dx * (ab.range * 0.5), cz = h.z + aim.dz * (ab.range * 0.5);
    forEachAlly(ctx, h.team, cx, cz, ab.range + 1.5, (a) => {
      if (a === h || a.type !== 'hero') return;
      const d = Math.hypot(a.x - h.x, a.z - h.z);
      if (d < bd) { best = a; bd = d; }
    });
    if (!best) return false;
    const col = fx(h).color, acc = fx(h).accent, host = best;
    giveShield(h, ab.shield ?? 80, ab.dur);
    giveShield(host, ab.allyShield ?? ab.shield ?? 80, ab.dur);
    if (ab.allySpd) addBuff(host, 'speed', ab.allySpd, ab.dur);
    addBuff(h, 'hidden', 1, ab.dur);
    h.noAttack = true;
    vfx.link(h, host, col, 0.4, 1, 1.4);
    h.effects.push({
      t: 0, dur: ab.dur,
      update(h, dt, ctx) {
        if (!host.alive) { h.noAttack = false; return; }
        h.x = h.px = host.x; h.z = h.pz = host.z;
        if (Math.random() < 0.3) particles.emit(h.x, 1.8, h.z, 0, 0.4, 0, acc, 0.4, 0.35, FRAME.sparkle);
      },
      end(h, ctx) {
        h.noAttack = false;
        if (ab.hopHeal) {
          heal(h, ab.hopHeal);
          heal(host, ab.hopHeal);
          boom(h, ctx, h.x, h.z, ab.r ?? 2.4, { dmg: 0 }, { x: h.x, z: h.z });
          vfx.ring(h.x, 0.3, h.z, col, 2.6, 0.4);
        }
      },
    });
  },

  // Carillon s3/ult helper: plant a chime. Allies who walk over it get haste + a tiny heal.
  trailbell(h, ab, ctx, aim) {
    const { x, z } = ab.atSelf ? { x: h.x, z: h.z } : point(h, ab, aim);
    const col = fx(h).color, acc = fx(h).accent;
    h._chimes = h._chimes || [];
    h._chimes.push({ x, z, t: ab.dur });
    if (h._chimes.length > (ab.max ?? 4)) h._chimes.shift();
    vfx.ring(x, 0.3, z, acc, 1.6, 0.5);
    let tick = 0;
    const chime = { x, z };
    h.effects.push({
      t: 0, dur: ab.dur,
      update(_h, dt, ctx) {
        if ((tick -= dt) > 0) return;
        tick = 0.25;
        vfx.ring(chime.x, 0.2, chime.z, col, 1.2, 0.25);
        forEachAlly(ctx, h.team, chime.x, chime.z, ab.r ?? 1.8, (a) => {
          if (a._bellT > 0) return;
          a._bellT = 2.5;
          if (ab.allySpd) addBuff(a, 'speed', ab.allySpd, ab.buffT ?? 2);
          if (ab.heal) heal(a, ab.heal);
          spark(h, a.x, 1, a.z, 6, [col, acc, 0xffffff], 3);
        });
        for (const a of ctx.heroes ?? []) if (a._bellT > 0) a._bellT -= 0.25;
      },
    });
  },

  // Carillon ult: open a short portal between you and the furthest chime (or the aimed point).
  bellportal(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent;
    let dest = point(h, ab, aim);
    if (h._chimes?.length) {
      let best = dest, bd = -1;
      for (const c of h._chimes) {
        const d = Math.hypot(c.x - h.x, c.z - h.z);
        if (d > bd) { bd = d; best = c; }
      }
      dest = best;
    }
    const a = { x: h.x, z: h.z }, b = dest;
    vfx.ring(a.x, 0.3, a.z, col, 2.2, 0.5);
    vfx.ring(b.x, 0.3, b.z, acc, 2.2, 0.5);
    vfx.link({ x: a.x, z: a.z, hitY: 1.1 }, { x: b.x, z: b.z, hitY: 1.1 }, col, 0.6, 1.2, 1.2);
    let tick = 0;
    h.effects.push({
      t: 0, dur: ab.dur,
      update(_h, dt, ctx) {
        if ((tick -= dt) > 0) return;
        tick = 0.12;
        const jump = (e) => {
          if (!e.alive || e.team !== h.team || e._portT > 0) return;
          if (Math.hypot(e.x - a.x, e.z - a.z) < (ab.r ?? 1.6)) {
            e.x = e.px = b.x; e.z = e.pz = b.z; e._portT = 1.2;
            if (ab.shield) giveShield(e, ab.shield, 2);
            vfx.ghost(b.x, b.z, acc, 0.3);
          }
        };
        forEachAlly(ctx, h.team, a.x, a.z, (ab.r ?? 1.6) + 1, jump);
        for (const e of ctx.heroes ?? []) if (e._portT > 0) e._portT -= 0.12;
      },
    });
  },

  ramcrash: (...a) => KITS_E.ramcharge(...a),
  lastkick: (...a) => KITS_E.hookkick(...a),
  starstorm: (...a) => KITS_E.starburst(...a),
  dawnshot: (...a) => KITS_E.sparkshot(...a),
  bigride: (...a) => KITS_E.rideally(...a),
};
