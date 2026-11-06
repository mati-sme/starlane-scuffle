// Persistent battlefield pieces made by skills: ground fields, barrier walls and auto-turrets.
import * as THREE from 'three';
import { GROUND, TEAM } from '../config.js';
import { dealDamage, forEachEnemy, applyStatus, addBuff, heal, shove } from './combat.js';
import { pickTarget } from './targeting.js';
import { particles, FRAME } from '../render/particles.js';
import { vfx } from '../render/vfx.js';
import { toonMat, toonMesh, mergeParts } from '../render/toon.js';

const TICK = 0.25;
const PER_TEAM = 3;
const SHAPES = ['turret', 'sprout', 'bumper'];
const GEO = { turret: null, sprout: null, bumper: null };

// Totem bodies: a prism turret (shoots), a sprout (living ward that pulses), a pinball bumper (knocks enemies away).
function sproutGeo(team) {
  return mergeParts([
    { g: new THREE.CylinderGeometry(0.5, 0.65, 0.25, 7), c: 0x5A3E24, p: [0, 0.12, 0] },
    { g: new THREE.CylinderGeometry(0.12, 0.2, 1.0, 6), c: 0x6B4A2A, p: [0, 0.7, 0] },
    ...[0, 1, 2, 3].map((k) => ({ g: new THREE.ConeGeometry(0.28, 0.9, 5), c: k % 2 ? 0x6FD05A : 0x4FA844, p: [Math.cos(k * 1.57) * 0.4, 1.35, Math.sin(k * 1.57) * 0.4], r: [Math.sin(k * 1.57) * 0.9, 0, -Math.cos(k * 1.57) * 0.9] })),
    { g: new THREE.SphereGeometry(0.26, 8, 6), c: 0xFFE06A, p: [0, 1.35, 0] },
    { g: new THREE.BoxGeometry(0.16, 0.16, 0.16), c: TEAM[team].main, p: [0, 1.95, 0] },
  ]);
}
function bumperGeo(team) {
  return mergeParts([
    { g: new THREE.CylinderGeometry(0.8, 0.9, 0.3, 12), c: 0x2A3140, p: [0, 0.15, 0] },
    { g: new THREE.CylinderGeometry(0.62, 0.7, 0.6, 12), c: 0xFF2E93, p: [0, 0.6, 0] },
    { g: new THREE.TorusGeometry(0.66, 0.1, 6, 16), c: 0xFFFFFF, p: [0, 0.9, 0], r: [Math.PI / 2, 0, 0] },
    { g: new THREE.SphereGeometry(0.4, 10, 6), c: 0xFFC2E0, p: [0, 1.05, 0] },
    { g: new THREE.BoxGeometry(0.16, 0.16, 0.16), c: TEAM[team].main, p: [0, 1.7, 0] },
  ]);
}

function turretGeo(team) {
  return mergeParts([
    { g: new THREE.CylinderGeometry(0.6, 0.75, 0.3, 6), c: 0x2A3140, p: [0, 0.15, 0] },
    { g: new THREE.BoxGeometry(0.7, 0.5, 0.7), c: 0xE6ECF2, p: [0, 0.55, 0] },
    { g: new THREE.CylinderGeometry(0.1, 0.12, 0.9, 6), c: 0x4DF0C0, p: [0, 0.65, 0.5], r: [Math.PI / 2, 0, 0] },
    { g: new THREE.OctahedronGeometry(0.28), c: 0x4DF0C0, p: [0, 1.15, 0] },
    { g: new THREE.BoxGeometry(0.16, 0.16, 0.16), c: TEAM[team].main, p: [0, 1.55, 0] },
  ]);
}

// Is entity e inside field f? Walls are thin slabs, everything else is a disc.
function inside(f, e) {
  const rx = e.x - f.x, rz = e.z - f.z, rad = e.radius ?? 0;
  if (!f.wall) return Math.hypot(rx, rz) - rad <= f.r;
  return Math.abs(rx * f.dx + rz * f.dz) <= 0.9 + rad * 0.5 && Math.abs(rz * f.dx - rx * f.dz) <= f.len / 2 + rad;
}

export class Zones {
  constructor(scene) {
    this.fields = [];
    this.turrets = [];
    const mat = toonMat({ vertexColors: true });
    this.meshes = [0, 1].map((team) => {
      const geos = { turret: turretGeo(team), sprout: sproutGeo(team), bumper: bumperGeo(team) };
      return Object.fromEntries(SHAPES.map((k) => [k, Array.from({ length: PER_TEAM }, () => {
        const m = toonMesh(geos[k], mat, 0.04);
        m.visible = false;
        scene.add(m);
        return m;
      })]));
    });
  }

  reset() {
    this.fields.length = 0;
    this.turrets.length = 0;
    for (const row of this.meshes) for (const k of SHAPES) for (const m of row[k]) m.visible = false;
  }

  // f: { team, src, x, z, r, dur, color, dps, slow, healPs, follow, selfDr, allyDr, undying, wall, len, dx, dz, allySpd }
  addField(f) {
    if (f.wall) f.r = f.len / 2 + 1.5;
    this.fields.push({ t: 0, tick: 0, vis: 0, ...f });
    if (this.fields.length > 24) this.fields.shift();
  }

  addTurret(src, x, z, ab) {
    const mine = this.turrets.filter((t) => t.src === src);
    while (mine.length >= (ab.max ?? 1)) this.turrets.splice(this.turrets.indexOf(mine.shift()), 1);
    this.turrets.push({
      src, team: src.team, x, z, t: 0, dur: ab.dur, cd: 0.3, yaw: Math.atan2(x - src.x, z - src.z),
      range: ab.tRange, dmg: ab.tDmg, rate: ab.tCd, color: ab.color, accent: ab.accent ?? ab.color, mode: ab.mode ?? 'shoot', shape: ab.shape ?? 'turret', ab,
      shot: { team: src.team, x, z, outMul: src.outMul },
    });
    particles.burst(x, 0.5, z, 10, { color: [ab.color, 0xffffff], speed: 2.5, up: 2, size: 0.5, life: 0.5, frame: FRAME.sparkle, grav: 1 });
    vfx.ring(x, 0.2, z, ab.color, 3, 0.4);
  }

  // True when a shot from `team` at (x, z) hits an enemy barrier.
  blocks(team, x, z) {
    for (const f of this.fields) if (f.wall && f.team !== team && inside(f, { x, z })) return true;
    return false;
  }

  update(dt, ctx) {
    for (let i = this.fields.length - 1; i >= 0; i--) {
      const f = this.fields[i];
      f.t += dt;
      if (f.follow) {
        if (f.follow.alive) { f.x = f.follow.x; f.z = f.follow.z; } else f.t = f.dur;
      }
      if (f.t >= f.dur) { this.fields.splice(i, 1); continue; }

      if (f.wall && f.solid) { // a solid barrier: enemy heroes and minions cannot walk through, they slide out the nearest face
        const push = (e) => {
          const rx = e.x - f.x, rz = e.z - f.z, a = rx * f.dx + rz * f.dz, b = rz * f.dx - rx * f.dz, th = 0.9 + (e.radius ?? 0) * 0.5;
          if (Math.abs(a) >= th || Math.abs(b) > f.len / 2 + (e.radius ?? 0)) return;
          const k = (a >= 0 ? th : -th) - a;
          e.x += f.dx * k; e.z += f.dz * k;
        };
        for (const e of ctx.heroes) if (e.alive && e.team !== f.team && !e.script) push(e);
        for (const e of ctx.minions.list) if (e.alive && e.team !== f.team) push(e);
      }
      for (const a of ctx.heroes) {
        if (!a.alive || a.team !== f.team || !inside(f, a)) continue;
        const dr = a === f.src ? f.selfDr : f.allyDr;
        if (dr) addBuff(a, 'dr', dr, 0.3);
        if (f.undying) addBuff(a, 'undying', 1, 0.3);
        if (f.allySpd) addBuff(a, 'speed', f.allySpd, 2);
      }
      if ((f.tick -= dt) <= 0) {
        f.tick = TICK;
        if (f.dps || f.slow) {
          forEachEnemy(ctx, f.team, f.x, f.z, f.r, (e) => {
            if (!inside(f, e)) return;
            if (f.dps) dealDamage(e, f.dps * TICK, f.src);
            if (f.slow) applyStatus(e, 'slow', 0.5);
          });
        }
        if (f.healPs) for (const a of ctx.heroes) if (a.team === f.team && a.alive && inside(f, a)) heal(a, f.healPs * TICK);
      }
      if ((f.vis -= dt) <= 0) {
        f.vis = 0.45;
        if (f.wall) {
          const tx = -f.dz * f.len / 2, tz = f.dx * f.len / 2;
          for (const y of [0.5, 1.4]) vfx.beam(f.x - tx, y, f.z - tz, f.x + tx, y, f.z + tz, f.color, 0.28, 0.5); // the barrier reads as a glowing lattice
          for (let k = 0; k < 8; k++) {
            const s = (Math.random() - 0.5) * f.len;
            particles.emit(f.x - f.dz * s, 0.3 + Math.random() * 1.6, f.z + f.dx * s, 0, 0.3, 0, f.color, 0.6, 0.5, FRAME.sparkle);
          }
        } else vfx.decal(f.x, f.z, f.color, f.r, 0.55);
      }
    }

    for (let i = this.turrets.length - 1; i >= 0; i--) {
      const T = this.turrets[i];
      T.t += dt;
      if (T.t >= T.dur) {
        particles.burst(T.x, 0.6, T.z, 10, { color: [T.color, 0xffffff], speed: 3, up: 2, size: 0.5, life: 0.5, frame: FRAME.sparkle, grav: 1 });
        this.turrets.splice(i, 1);
        continue;
      }
      if ((T.cd -= dt) > 0) continue;
      if (T.mode !== 'shoot') { T.cd = T.rate; this._pulse(T, ctx); continue; }
      const tgt = pickTarget(ctx, T.team, T.x, T.z, T.range, ['heroes', 'minions', 'structures']);
      if (!tgt) continue;
      T.cd = T.rate;
      T.yaw = Math.atan2(tgt.x - T.x, tgt.z - T.z);
      T.shot.outMul = T.src.outMul;
      ctx.projectiles.fire(T.shot, tgt, T.dmg, 20, 0.3, GROUND + 1.2, { color: T.color, frame: FRAME.dot, size: 1 });
    }
  }

  // A totem pulse: heal allies, slow + hurt enemies, or knock enemies away from a bumper. Always draws a ring so it reads.
  _pulse(T, ctx) {
    const R = T.range, ab = T.ab, col = T.color, acc = T.accent;
    let hit = false;
    if (T.mode === 'heal') {
      for (const a of ctx.heroes) if (a.team === T.team && a.alive && Math.hypot(a.x - T.x, a.z - T.z) - a.radius <= R) { heal(a, ab.tHeal ?? 30); hit = true; particles.emit(a.x, 1.2, a.z, 0, 2, 0, acc, 0.6, 0.5, FRAME.star); }
    } else {
      forEachEnemy(ctx, T.team, T.x, T.z, R, (e) => {
        if (T.mode === 'bump') { const dx = e.x - T.x, dz = e.z - T.z, d = Math.hypot(dx, dz) || 1; if (e.type === 'hero' || e.type === 'minion') shove(e, dx, dz, ab.tKnock ?? 2.5, 0.2); }
        if (T.dmg) dealDamage(e, T.dmg, T.src, true);
        if (ab.tSlow) applyStatus(e, 'slow', 1);
        hit = true;
      });
    }
    vfx.ring(T.x, 0.25, T.z, hit ? acc : col, R * (hit ? 1.15 : 0.8), 0.35);
    if (hit) { vfx.decal(T.x, T.z, col, R * 0.8, 0.4); particles.burst(T.x, 1, T.z, 8, { color: [col, acc, 0xffffff], speed: 3, up: 2, size: 0.6, life: 0.5, frame: FRAME.sparkle, grav: 1 }); }
  }

  render() {
    const n = { 0: { turret: 0, sprout: 0, bumper: 0 }, 1: { turret: 0, sprout: 0, bumper: 0 } };
    for (const T of this.turrets) {
      const m = this.meshes[T.team][T.shape]?.[n[T.team][T.shape]++];
      if (!m) continue;
      const pop = Math.min(1, T.t * 5) * Math.min(1, (T.dur - T.t) / 0.3);
      m.visible = true;
      m.position.set(T.x, GROUND, T.z);
      m.scale.setScalar(Math.max(pop, 0.01) * (1 + (T.shape === 'turret' ? 0 : Math.sin(T.t * 6) * 0.04)));
      m.rotation.y = T.shape === 'turret' ? T.yaw : T.t * 0.8;
    }
    for (let team = 0; team < 2; team++) for (const k of SHAPES) for (let i = n[team][k]; i < PER_TEAM; i++) this.meshes[team][k][i].visible = false;
  }
}
