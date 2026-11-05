// Neutral Scrap Sentinels: 4 jungle camps. They only fight back when hit and leash home; a kill pays XP and a short buff.
import * as THREE from 'three';
import { PAL, CAMP, MATCH, GROUND } from '../config.js';
import { toonMat, toonMesh, mergeParts, makeShadow } from '../render/toon.js';
import { DYING, poof, tickHitFx, dealDamage, dyingScale } from '../game/combat.js';
import { CAMP_SPOTS, pushOutCover } from './arena.js';

const STEEL = 0x8A94A6, DARK = 0x4A5263, AMBER = 0xFFB020;

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
      };
    });
  }

  reset() {
    for (const c of this.list) {
      c.alive = false; c.dying = 0; c.provoked = null; c.spawnAt = MATCH.campFirst;
      c.group.visible = false;
    }
  }

  _spawn(c) {
    c.alive = true; c.hp = c.maxHp; c.x = c.hx; c.z = c.hz; c.provoked = null; c.dying = 0; c.cd = 0;
    c.group.visible = true;
    c.group.scale.setScalar(1);
    c.group.position.set(c.x, GROUND, c.z);
  }

  update(dt, ctx) {
    for (const c of this.list) {
      tickHitFx(c, dt);
      if (c.dying > 0) {
        if ((c.dying -= dt) <= 0) { c.group.visible = false; poof(c, 26); c.spawnAt = ctx.time + MATCH.campRespawn; }
        continue;
      }
      if (!c.alive) {
        if (!ctx.over && ctx.time >= c.spawnAt) this._spawn(c);
        continue;
      }
      c.cd -= dt;
      let p = c.provoked;
      const home = Math.hypot(c.x - c.hx, c.z - c.hz);
      if (p && (!p.alive || p.hidden || Math.hypot(p.x - c.hx, p.z - c.hz) > CAMP.leash + CAMP.range)) p = c.provoked = null;
      if (ctx.over) continue;
      if (p) {
        const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz) || 1;
        if (d - p.radius - c.radius <= CAMP.range) {
          if (c.cd <= 0) { c.cd = CAMP.cd; dealDamage(p, CAMP.dmg, c); }
        } else if (home < CAMP.leash) { c.x += (dx / d) * 3.4 * dt; c.z += (dz / d) * 3.4 * dt; }
        else c.provoked = null;
      } else {
        if (home > 0.2) { c.x += ((c.hx - c.x) / home) * 4 * dt; c.z += ((c.hz - c.z) / home) * 4 * dt; }
        c.hp = Math.min(c.maxHp, c.hp + c.maxHp * 0.1 * dt);
      }
      pushOutCover(c, c.radius);
    }
  }

  // ---- online guest: rows [alive, hp, x, z] per camp from the host ----
  netApply(rows) {
    rows.forEach(([alive, hp, x, z], i) => {
      const c = this.list[i];
      if (alive && !c.alive) this._spawn(c);
      else if (!alive && c.alive) { c.alive = false; c.dying = DYING; }
      if (alive) { if (hp < c.hp) { c.flash = 0.08; c.squash = 1; } c.hp = hp; c.tx = x; c.tz = z; }
    });
  }

  netStep(dt) {
    for (const c of this.list) {
      tickHitFx(c, dt);
      if (c.dying > 0 && (c.dying -= dt) <= 0) { c.group.visible = false; poof(c, 26); }
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
      c.group.scale.set(s * (1 + sq), s * (1 - sq), s * (1 + sq));
      c.body.rotation.y = Math.sin(t * 0.7 + c.hx) * 0.4;
    }
  }
}
