// Friendly/enemy minion waves. Instanced per team per type (body + outline), pooled, simple lane AI.
import * as THREE from 'three';
import { PAL, TEAM, UNITS, MAP, GROUND, MATCH } from '../config.js';
import { PATHS, pushOutCover } from './arena.js';
import { rand, lerp, clamp, angleLerp } from '../core/math.js';
import { toonMat, outlineMat, mergeParts, shadowGeo, shadowMat, SHADOW_Y } from '../render/toon.js';
import { DYING, sim, dealDamage, tickHitFx, tickStatus, airLift, dyingScale, poof } from '../game/combat.js';
import { pickTarget, ORDER_MINION } from '../game/targeting.js';

const TYPES = ['blobling', 'zapper', 'bigblob'];
const SPAWN_GAP = 0.6;
const MAX_TOTAL = 140;

const SPH = new THREE.SphereGeometry(1, 12, 8);
const CONE = new THREE.ConeGeometry(1, 1, 8);
const TORUS = new THREE.TorusGeometry(1, 0.2, 6, 12);
const CAPS = new THREE.CapsuleGeometry(0.06, 0.5, 3, 6);

// Team marker: friendly = halo / antenna ball, enemy = two horn nubs.
function marker(team, y, k = 1) {
  const c = TEAM[team];
  if (team === 0) {
    return [
      { g: new THREE.CylinderGeometry(0.02 * k, 0.02 * k, 0.3 * k, 5), c: c.deep, p: [0, y + 0.15 * k, 0] },
      { g: SPH, c: PAL.gold, p: [0, y + 0.35 * k, 0], s: 0.11 * k },
    ];
  }
  return [-1, 1].map((sx) => ({ g: CONE, c: c.deep, p: [sx * 0.22 * k, y + 0.1 * k, 0], s: [0.1 * k, 0.32 * k, 0.1 * k], r: [0, 0, -sx * 0.35] }));
}

function eyes(y, z, spread, k = 1) {
  return [-1, 1].flatMap((sx) => [
    { g: SPH, c: 0xffffff, p: [sx * spread, y, z], s: 0.13 * k },
    { g: SPH, c: PAL.ink, p: [sx * spread, y, z + 0.09 * k], s: 0.07 * k },
  ]);
}

function modelParts(type, team) {
  const main = TEAM[team].main;
  if (type === 'zapper') {
    const glow = new THREE.Color(main).lerp(new THREE.Color(0xffffff), 0.4).getHex();
    return [
      { g: SPH, c: glow, p: [0, 1.3, 0], s: 0.4 },
      { g: CONE, c: main, p: [0, 1.78, 0], s: [0.5, 0.5, 0.5] },
      ...[-0.18, 0, 0.18].map((x) => ({ g: CAPS, c: main, p: [x, 0.85, 0], r: [0, 0, -x * 1.5] })),
      ...eyes(1.35, 0.3, 0.14),
      ...marker(team, 2.0),
    ];
  }
  const k = type === 'bigblob' ? 1.8 : 1;
  const parts = [
    { g: SPH, c: main, p: [0, 0.48 * k, 0], s: [0.55 * k, 0.47 * k, 0.55 * k] },
    ...eyes(0.6 * k, 0.43 * k, 0.2 * k, k),
    ...marker(team, 0.95 * k, k),
  ];
  if (type === 'bigblob') { // gold crown of 5 cones
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      parts.push({ g: CONE, c: PAL.gold, p: [Math.cos(a) * 0.45, 1.05 * k + 0.55, Math.sin(a) * 0.45], s: [0.14, 0.34, 0.14] });
    }
  }
  return parts;
}

export class MinionSystem {
  constructor(scene) {
    this.list = [];
    this.queue = [];
    this.nid = 0;
    this.byId = new Map(); // guest mirror: host id -> minion
    this.free = Array.from({ length: MAX_TOTAL }, () => this._blank());
    this.mat = toonMat({ vertexColors: true, roughness: 0.5, metalness: 0.15, rim: 0.3 });
    this.groups = {};
    for (const team of [0, 1]) {
      for (const type of TYPES) {
        const geo = mergeParts(modelParts(type, team));
        const max = UNITS[type].max;
        const mesh = new THREE.InstancedMesh(geo, this.mat, max);
        const outline = new THREE.InstancedMesh(geo, outlineMat(0.025), max);
        outline.instanceMatrix = mesh.instanceMatrix;
        mesh.frustumCulled = outline.frustumCulled = false;
        mesh.castShadow = true;
        mesh.setColorAt(0, new THREE.Color(1, 1, 1));
        mesh.count = outline.count = 0;
        scene.add(mesh, outline);
        this.groups[`${team}${type}`] = { mesh, outline, n: 0, max };
      }
    }
    this.shadows = new THREE.InstancedMesh(shadowGeo, shadowMat, MAX_TOTAL);
    this.shadows.frustumCulled = false;
    this.shadows.renderOrder = 1;
    scene.add(this.shadows);
    this._m = new THREE.Matrix4(); this._p = new THREE.Vector3(); this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3(); this._c = new THREE.Color(); this._up = new THREE.Vector3(0, 1, 0);
  }

  _blank() {
    return {
      type: 'minion', kind: '', team: 0, x: 0, z: 0, px: 0, pz: 0, rx: 0, rz: 0, hp: 1, maxHp: 1, alive: false,
      radius: 0.5, hitY: 1, barY: 1.5, flash: 0, squash: 0, dying: 0, lunge: 0, cd: 0, facing: 0, yaw: 0, phase: 0, lane: 0,
      stun: 0, root: 0, slow: 0, air: 0, pull: null, wp: 1, prog: 0,
    };
  }

  reset() {
    this.free.push(...this.list);
    this.list.length = 0;
    this.queue.length = 0;
    this.byId.clear();
    for (const g of Object.values(this.groups)) g.mesh.count = g.outline.count = 0;
    this.shadows.count = 0;
  }

  // Queue one lane's wave for one team; units trickle out of the base.
  spawnWave(team, lane, kinds) {
    kinds.forEach((kind, i) => this.queue.push({ t: i * SPAWN_GAP, team, kind, lane }));
  }

  _spawn(team, kind, lane) {
    const g = this.groups[`${team}${kind}`];
    const alive = this.list.reduce((n, m) => n + (m.team === team && m.kind === kind), 0);
    if (alive >= g.max || !this.free.length) return;
    const st = UNITS[kind], m = this.free.pop(), p0 = PATHS[team][lane].pts[0];
    Object.assign(m, {
      kind, team, x: p0.x + rand(-1.5, 1.5), z: p0.z + rand(-1.5, 1.5), hp: st.hp * (1 + (sim.bonus[team].minHp ?? 0)), maxHp: st.hp * (1 + (sim.bonus[team].minHp ?? 0)), alive: true,
      radius: st.radius, hitY: st.hitY, barY: st.barY, flash: 0, squash: 0, dying: 0, lunge: 0, cd: rand(0, 0.5),
      phase: rand(0, 6), lane, wp: 1, prog: 0, stun: 0, root: 0, slow: 0, air: 0, pull: null, nid: ++this.nid,
    });
    m.px = m.x; m.pz = m.z;
    m.facing = m.yaw = TEAM[team].dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    this.list.push(m);
  }

  update(dt, ctx) {
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const q = this.queue[i];
      if ((q.t -= dt) <= 0) { this._spawn(q.team, q.kind, q.lane); this.queue.splice(i, 1); }
    }

    for (let i = this.list.length - 1; i >= 0; i--) {
      const m = this.list[i];
      m.px = m.x; m.pz = m.z;
      tickHitFx(m, dt);
      m.lunge = Math.max(0, m.lunge - dt * 5);
      tickStatus(m, dt);
      if (m.dying > 0) {
        if ((m.dying -= dt) <= 0) { poof(m, 18); this.list.splice(i, 1); this.free.push(m); }
        continue;
      }
      if (!ctx.over) this._think(m, dt, ctx);
    }
    if (!ctx.over) this._separate();
  }

  // ---- online guest: rows [id, team, kindIdx, lane, x, z, hp, facing] from the host replace the local sim ----
  netApply(rows) {
    const seen = new Set();
    for (const [id, team, k, lane, x, z, hp, facing] of rows) {
      seen.add(id);
      let m = this.byId.get(id);
      if (!m) {
        const n = this.list.length;
        this._spawn(team, TYPES[k], lane);
        if (this.list.length === n) continue; // group cap
        m = this.list[n];
        m.x = m.px = x; m.z = m.pz = z;
        this.byId.set(id, m);
      }
      if (hp < m.hp) { m.flash = 0.08; m.squash = 1; }
      m.hp = hp; m.tx = x; m.tz = z; m.facing = facing;
    }
    for (const [id, m] of this.byId) {
      if (seen.has(id)) continue;
      this.byId.delete(id);
      if (m.alive) { m.alive = false; m.dying = DYING; }
    }
  }

  netStep(dt) {
    const k = 1 - Math.exp(-12 * dt);
    for (let i = this.list.length - 1; i >= 0; i--) {
      const m = this.list[i];
      m.px = m.x; m.pz = m.z;
      tickHitFx(m, dt);
      m.lunge = Math.max(0, m.lunge - dt * 5);
      if (m.dying > 0) {
        if ((m.dying -= dt) <= 0) { poof(m, 18); this.list.splice(i, 1); this.free.push(m); }
        continue;
      }
      if (m.tx !== undefined) { m.x += (m.tx - m.x) * k; m.z += (m.tz - m.z) * k; }
    }
  }

  _think(m, dt, ctx) {
    const st = UNITS[m.kind];
    m.cd -= dt;
    if (m.stun > 0 || m.air > 0) return;
    const go = m.root > 0 ? 0 : st.speed * (m.slow > 0 ? 0.55 : 1) * dt;
    const tgt = pickTarget(ctx, m.team, m.x, m.z, st.aggro, ORDER_MINION);
    if (tgt) {
      const dx = tgt.x - m.x, dz = tgt.z - m.z, d = Math.hypot(dx, dz) || 1;
      m.facing = Math.atan2(dx, dz);
      if (d - tgt.radius - m.radius <= st.range) {
        if (m.cd <= 0) {
          m.cd = st.cd;
          m.lunge = 1;
          const structure = tgt.type === 'tower' || tgt.type === 'core';
          const dmg = st.dmg * (structure ? st.structMul * (ctx.storm ? MATCH.stormStructMul : 1) * Math.min(1, 0.3 + ctx.time / 240) : 1);
          if (st.ranged) ctx.projectiles.fire(m, tgt, dmg, 10, 0.5, GROUND + st.hitY + 0.3);
          else dealDamage(tgt, dmg, m);
        }
        return;
      }
      m.x += (dx / d) * go;
      m.z += (dz / d) * go;
    } else if (go > 0) { // follow the lane path toward the enemy base
      const path = PATHS[m.team][m.lane], pts = path.pts;
      if (m.wp < pts.length) {
        const w = pts[m.wp], dx = w.x - m.x, dz = w.z - m.z, d = Math.hypot(dx, dz) || 1;
        if (d < 1.8) m.wp++;
        m.facing = Math.atan2(dx, dz);
        m.x += (dx / d) * go;
        m.z += (dz / d) * go;
        m.prog = path.cum[m.wp - 1] + Math.hypot(m.x - pts[m.wp - 1].x, m.z - pts[m.wp - 1].z);
      }
    }
    pushOutCover(m, m.radius);
    m.x = clamp(m.x, -MAP.halfX, MAP.halfX);
    m.z = clamp(m.z, -MAP.halfZ, MAP.halfZ);
  }

  _separate() {
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const a = L[i];
      if (a.dying > 0) continue;
      for (let j = i + 1; j < L.length; j++) {
        const b = L[j];
        if (b.dying > 0) continue;
        const dx = b.x - a.x, dz = b.z - a.z, min = (a.radius + b.radius) * 0.9, d2 = dx * dx + dz * dz;
        if (d2 >= min * min || d2 === 0) continue;
        const d = Math.sqrt(d2), push = ((min - d) / d) * 0.25;
        a.x -= dx * push; a.z -= dz * push;
        b.x += dx * push; b.z += dz * push;
      }
    }
  }

  render(alpha, t) {
    for (const g of Object.values(this.groups)) g.n = 0;
    const { _m: M, _p: P, _q: Q, _s: S, _c: C } = this;
    let sn = 0;
    for (const m of this.list) {
      m.rx = lerp(m.px, m.x, alpha);
      m.rz = lerp(m.pz, m.z, alpha);
      m.yaw = angleLerp(m.yaw, m.facing, 0.25);
      const g = this.groups[`${m.team}${m.kind}`], i = g.n++;
      const dy = m.dying > 0 ? dyingScale(m) : 1;
      const wob = Math.sin(t * 9 + m.phase) * 0.06, sq = m.squash * 0.15;
      const sx = dy * (1 + wob + sq), sy = dy * (1 - wob - sq);
      const bob = m.kind === 'zapper' ? Math.sin(t * 3 + m.phase) * 0.15 : 0;
      const lx = Math.sin(m.yaw) * 0.35 * m.lunge, lz = Math.cos(m.yaw) * 0.35 * m.lunge;
      M.compose(P.set(m.rx + lx, GROUND + bob + airLift(m), m.rz + lz), Q.setFromAxisAngle(this._up, m.yaw), S.set(sx, sy, sx));
      g.mesh.setMatrixAt(i, M);
      g.mesh.setColorAt(i, C.setScalar(1 + (m.flash > 0 ? 3 : 0)));

      const sh = (m.kind === 'bigblob' ? 2.6 : 1.5) * dy * (m.kind === 'zapper' ? 0.8 : 1);
      M.compose(P.set(m.rx, SHADOW_Y, m.rz), Q.identity(), S.set(sh, 1, sh));
      this.shadows.setMatrixAt(sn++, M);
    }
    for (const g of Object.values(this.groups)) {
      g.mesh.count = g.outline.count = g.n;
      g.mesh.instanceMatrix.needsUpdate = true;
      if (g.mesh.instanceColor) g.mesh.instanceColor.needsUpdate = true;
    }
    this.shadows.count = sn;
    this.shadows.instanceMatrix.needsUpdate = true;
  }
}
