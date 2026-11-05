// Neutral Scrap Sentinels: 4 jungle camps, plus the epic bosses (Dragon, Titan, Herald) that live in the centre pits as camp-type entities
// with their own stats (c.cfg), a ground-slam and a spawn timer. They only fight back when hit and leash home; a kill pays XP, gold and a buff.
import * as THREE from 'three';
import { PAL, CAMP, BOSS, MATCH, ARENA, GROUND } from '../config.js';
import { bus } from '../core/bus.js';
import { toonMat, toonMesh, mergeParts, makeShadow, makeHalo } from '../render/toon.js';
import { vfx } from '../render/vfx.js';
import { DYING, poof, tickHitFx, dealDamage, dyingScale, forEachEnemy } from '../game/combat.js';
import { CAMP_SPOTS, pushOutCover } from './arena.js';

const STEEL = 0x8A94A6, DARK = 0x4A5263, AMBER = 0xFFB020;

export const BOSS_COLORS = { fire: 0xFF7A40, ice: 0x7FD8FF, gale: 0x8AFF9A, titan: 0xC58CFF, herald: 0x4CE6FF };
export const BOSS_KINDS = ['dragon', 'titan', 'herald'];
const S = new THREE.SphereGeometry(1, 12, 8), CN = new THREE.ConeGeometry(1, 1, 6), BX = new THREE.BoxGeometry(1, 1, 1), CY = new THREE.CylinderGeometry(1, 1, 1, 8);
const part = (g, c, p, s = 1, r = [0, 0, 0]) => ({ g, c, p, s, r });

// Light neutral vertex colors: the material tint (element / boss color) multiplies them.
function bossParts(kind) {
  const L = 0xDDE2EA, M = 0xA9B1C0, D = 0x4A5263, E = 0xFFF2A0;
  if (kind === 'dragon') {
    return [
      part(S, L, [0, 1.7, 0], [1.2, 1.0, 1.9]),
      part(S, 0xFFE9B0, [0, 1.35, 0.2], [1.0, 0.7, 1.6]),
      part(CY, L, [0, 2.5, 1.9], [0.45, 1.1, 0.45], [0.9, 0, 0]),
      part(S, L, [0, 3.2, 2.7], [0.7, 0.55, 0.9]),
      ...[-1, 1].flatMap((sx) => [
        part(CN, D, [sx * 0.4, 3.75, 2.4], [0.14, 0.7, 0.14], [-0.5, 0, -sx * 0.3]),
        part(S, E, [sx * 0.3, 3.35, 3.25], 0.14),
        part(BX, M, [sx * 2.4, 2.9, -0.2], [2.6, 0.08, 1.7], [0, sx * 0.25, -sx * 0.45]),
        part(CN, D, [sx * 3.5, 3.5, -0.3], [0.1, 1.5, 0.1], [0, 0, -sx * 1.2]),
        part(CY, M, [sx * 0.8, 0.7, 1.0], [0.28, 0.7, 0.28]), part(CY, M, [sx * 0.8, 0.7, -1.0], [0.28, 0.7, 0.28]),
      ]),
      ...[0, 1, 2, 3].map((i) => part(CN, D, [0, 2.9 - i * 0.14, 1.0 - i * 0.65], [0.2, 0.55, 0.2])),
      part(CN, L, [0, 1.4, -2.7], [0.5, 2.2, 0.5], [-1.45, 0, 0]),
      part(CN, D, [0, 1.3, -4.1], [0.3, 0.8, 0.3], [-1.45, 0, 0]),
    ];
  }
  if (kind === 'titan') {
    return [
      part(BX, M, [0, 3.2, 0], [3.0, 3.0, 2.0]), part(BX, L, [0, 5.2, 0], [1.5, 1.4, 1.4]),
      part(BX, E, [0, 5.3, 0.72], [1.2, 0.3, 0.1]),
      part(CN, D, [0, 6.3, 0], [0.5, 0.9, 0.5]),
      part(S, E, [0, 3.4, 1.05], 0.55),
      ...[-1, 1].flatMap((sx) => [
        part(BX, L, [sx * 2.2, 4.4, 0], [1.3, 1.1, 1.5]),
        part(BX, M, [sx * 2.6, 2.6, 0.3], [0.9, 2.6, 0.9]),
        part(BX, D, [sx * 2.6, 1.0, 0.6], [1.2, 1.1, 1.2]),
        part(BX, M, [sx * 0.9, 0.9, 0], [1.1, 1.8, 1.2]),
        part(CN, D, [sx * 2.4, 5.2, 0], [0.3, 0.8, 0.3]),
      ]),
    ];
  }
  return [ // herald: a floating spiked eye
    part(S, L, [0, 2.6, 0], 1.2), part(S, E, [0, 2.6, 1.0], 0.55), part(S, D, [0, 2.6, 1.25], 0.28),
    ...Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * Math.PI * 2;
      return part(CN, M, [Math.cos(a) * 1.5, 2.6, Math.sin(a) * 1.5], [0.25, 1.0, 0.25], [Math.sin(a) * 1.57, 0, -Math.cos(a) * 1.57]);
    }),
    part(CN, D, [0, 1.2, 0], [0.5, 1.4, 0.5], [Math.PI, 0, 0]),
  ];
}

export class Camps {
  constructor(scene) {
    const geo = mergeParts([
      { g: new THREE.CylinderGeometry(0.9, 1.1, 1.5, 6), c: STEEL, p: [0, 0.95, 0] },
      { g: new THREE.BoxGeometry(1.5, 0.45, 1.5), c: DARK, p: [0, 0.22, 0] },
      { g: new THREE.BoxGeometry(1.2, 0.35, 0.5), c: AMBER, p: [0, 1.4, 0.7] },
      { g: new THREE.CylinderGeometry(0.28, 0.28, 0.9, 6), c: DARK, p: [1.05, 1.0, 0.2], r: [Math.PI / 2.4, 0, 0] },
      { g: new THREE.CylinderGeometry(0.28, 0.28, 0.9, 6), c: DARK, p: [-1.05, 1.0, 0.2], r: [Math.PI / 2.4, 0, 0] },
      { g: new THREE.OctahedronGeometry(0.35), c: PAL.gold, p: [0, 2.05, 0] },
    ]);
    this.list = CAMP_SPOTS.map((p) => {
      const group = new THREE.Group();
      group.position.set(p.x, GROUND, p.z);
      group.add(makeShadow(3.2));
      const mat = toonMat({ vertexColors: true, roughness: 0.55, metalness: 0.1, rim: 0.3 });
      const body = toonMesh(geo, mat);
      group.add(body);
      scene.add(group);
      return {
        mat, type: 'camp', team: 2, hx: p.x, hz: p.z, x: p.x, z: p.z, rx: p.x, rz: p.z, radius: CAMP.radius, hitY: 1.2, barY: 2.8,
        group, body, hp: 1, maxHp: CAMP.hp, alive: false, dying: 0, flash: 0, squash: 0, cd: 0, provoked: null, spawnAt: 0, vulnerable: true,
        cfg: CAMP, boss: null, scale: 1, variant: 0, slamT: 0, armor: 0,
      };
    });
    BOSS_KINDS.forEach((kind, i) => { // list[4..6]: dragon, titan, herald
      const cfg = BOSS[kind], pit = ARENA.pits.find((q) => q[2] === (kind === 'dragon' ? 'dragon' : 'titan'));
      const group = new THREE.Group();
      group.position.set(pit[0], GROUND, pit[1]);
      group.add(makeShadow(cfg.radius * 2.6));
      const mat = toonMat({ vertexColors: true, roughness: 0.5, metalness: 0.15, rim: 0.4 });
      const body = toonMesh(mergeParts(bossParts(kind)), mat);
      const halo = makeHalo(0xffffff, cfg.radius * 3.4);
      halo.position.y = cfg.hitY;
      group.add(body, halo);
      group.visible = false;
      scene.add(group);
      this.list.push({
        mat, halo, type: 'camp', team: 2, boss: kind, hx: pit[0], hz: pit[1], x: pit[0], z: pit[1], rx: pit[0], rz: pit[1], radius: cfg.radius, hitY: cfg.hitY, barY: cfg.barY,
        group, body, hp: 1, maxHp: cfg.hp, alive: false, dying: 0, flash: 0, squash: 0, cd: 0, provoked: null, spawnAt: cfg.first, vulnerable: true,
        cfg, scale: cfg.scale, variant: 0, slamT: cfg.slam.every, armor: cfg.armor, warned: false, done: false,
      });
    });
    this.bosses = this.list.filter((c) => c.boss);
  }

  // Seconds until a boss spawns (host reads the clock, the guest the last snapshot).
  eta(c, time) {
    if (c.alive || c.done) return 0;
    if (c.spawnIn !== undefined) return Math.max(0, c.spawnIn - (performance.now() - c.spawnStamp) / 1000);
    return Math.max(0, c.spawnAt - time);
  }

  // Boss tint: dragons by element, the rest by their own color.
  _tint(c) {
    if (!c.boss) return;
    const col = c.boss === 'dragon' ? BOSS_COLORS[BOSS.elements[c.variant % 3]] : BOSS_COLORS[c.boss];
    c.mat.color.set(col);
    c.halo.material.color.set(col);
  }

  reset() {
    for (const c of this.list) {
      c.alive = false; c.dying = 0; c.provoked = null; c.spawnAt = c.boss ? c.cfg.first : MATCH.campFirst;
      c.warned = c.done = false; c.spawnIn = undefined; c.variant = 0; c.slamT = c.cfg.slam?.every ?? 0;
      c.group.visible = false;
    }
  }

  _spawn(c, variant = c.variant) {
    c.alive = true; c.hp = c.maxHp; c.x = c.hx; c.z = c.hz; c.provoked = null; c.dying = 0; c.cd = 0;
    c.variant = variant; c.warned = false;
    if (c.boss) { c.slamT = c.cfg.slam.every; this._tint(c); }
    c.group.visible = true;
    c.group.scale.setScalar(c.scale);
    c.group.position.set(c.x, GROUND, c.z);
    if (c.boss) { vfx.ring(c.x, 0.3, c.z, 0xffffff, c.cfg.radius * 4, 0.8); bus.emit('bossSpawn', c); }
  }

  _slam(c, ctx) {
    const { r, dmg } = c.cfg.slam;
    vfx.ring(c.x, 0.3, c.z, 0xFF5A3C, r, 0.8);
    ctx.later(0.8, () => {
      if (!c.alive) return;
      vfx.ring(c.x, 0.3, c.z, 0xffffff, r * 1.1, 0.3);
      forEachEnemy(ctx, 2, c.x, c.z, r, (e) => { if (e.type === 'hero') dealDamage(e, dmg, c); });
    });
  }

  update(dt, ctx) {
    for (const c of this.list) {
      tickHitFx(c, dt);
      if (c.dying > 0) {
        if ((c.dying -= dt) <= 0) {
          c.group.visible = false; poof(c, c.boss ? 60 : 26);
          if (c.boss && !c.cfg.respawn) c.done = true;
          c.spawnAt = ctx.time + (c.boss ? c.cfg.respawn : MATCH.campRespawn);
        }
        continue;
      }
      if (!c.alive) {
        if (c.done) continue;
        if (c.boss && !c.warned && ctx.time >= c.spawnAt - BOSS.warn) { c.warned = true; bus.emit('bossSoon', c); }
        const blocked = c.boss === 'titan' && this.list.some((o) => o.boss === 'herald' && o.alive); // the Herald clears the pit first
        if (!ctx.over && !blocked && ctx.time >= c.spawnAt) this._spawn(c, c.boss === 'dragon' ? ctx.dragonN % 3 : 0);
        continue;
      }
      const cf = c.cfg;
      c.cd -= dt;
      let p = c.provoked;
      const home = Math.hypot(c.x - c.hx, c.z - c.hz);
      if (p && (!p.alive || p.hidden || Math.hypot(p.x - c.hx, p.z - c.hz) > cf.leash + cf.range + (c.boss ? 4 : 0))) p = c.provoked = null;
      if (ctx.over) continue;
      if (p) {
        const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz) || 1;
        if (d - p.radius - c.radius <= cf.range) {
          if (c.cd <= 0) { c.cd = cf.cd; dealDamage(p, cf.dmg, c); }
          if (c.boss && (c.slamT -= dt) <= 0) { c.slamT = cf.slam.every; this._slam(c, ctx); }
        } else if (home < cf.leash) { c.x += (dx / d) * 3.4 * dt; c.z += (dz / d) * 3.4 * dt; }
        else c.provoked = null;
      } else {
        if (home > 0.2) { c.x += ((c.hx - c.x) / home) * 4 * dt; c.z += ((c.hz - c.z) / home) * 4 * dt; }
        c.hp = Math.min(c.maxHp, c.hp + c.maxHp * (c.boss ? cf.regen : 0.1) * dt);
      }
      pushOutCover(c, c.radius);
    }
  }

  // ---- online guest: rows [alive, hp, x, z, spawnIn, variant] per camp / boss from the host ----
  netApply(rows) {
    rows.forEach(([alive, hp, x, z, eta = 0, variant = 0], i) => {
      const c = this.list[i];
      c.spawnIn = eta; c.spawnStamp = performance.now();
      if (c.boss && !alive && !c.alive && eta <= BOSS.warn && eta > 0 && !c.warned) { c.warned = true; bus.emit('bossSoon', c); }
      if (alive && !c.alive) this._spawn(c, variant);
      else if (!alive && c.alive) { c.alive = false; c.dying = DYING; c.warned = false; }
      if (alive) { if (hp < c.hp) { c.flash = 0.08; c.squash = 1; } c.hp = hp; c.tx = x; c.tz = z; }
    });
  }

  netStep(dt) {
    for (const c of this.list) {
      tickHitFx(c, dt);
      if (c.dying > 0 && (c.dying -= dt) <= 0) { c.group.visible = false; poof(c, c.boss ? 60 : 26); }
      else if (c.alive && c.tx !== undefined) { c.x += (c.tx - c.x) * 0.2; c.z += (c.tz - c.z) * 0.2; }
    }
  }

  render(t) {
    for (const c of this.list) {
      if (!c.group.visible) continue;
      const s = c.dying > 0 ? dyingScale(c) : 1, sq = c.squash * 0.12;
      c.rx = c.x; c.rz = c.z;
      c.mat.userData.flash.value = c.flash > 0 ? 1 : 0;
      c.group.position.set(c.x, GROUND, c.z);
      const k = c.scale;
      c.group.scale.set(s * k * (1 + sq), s * k * (1 - sq), s * k * (1 + sq));
      c.body.rotation.y = Math.sin(t * 0.7 + c.hx) * 0.4;
      if (c.boss) {
        c.body.position.y = c.boss === 'herald' ? 0.6 + Math.sin(t * 1.6) * 0.4 : Math.sin(t * 2.2) * 0.08;
        c.halo.material.opacity = 0.5 + Math.sin(t * 3) * 0.15;
      }
    }
  }
}
