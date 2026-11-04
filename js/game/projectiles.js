// Pooled homing orbs (tower shots, zapper bolts, hero basics). Damage lands on arrival.
import * as THREE from 'three';
import { TEAM, GROUND } from '../config.js';
import { particles, FRAME } from '../render/particles.js';
import { dealDamage } from './combat.js';

const POOL = 48;
const geo = new THREE.SphereGeometry(0.25, 8, 6);

export class Projectiles {
  constructor(scene) {
    this.list = [];
    for (let i = 0; i < POOL; i++) {
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
      mesh.visible = false;
      scene.add(mesh);
      this.list.push({ mesh, on: false, src: null, tgt: null, dmg: 0, speed: 0, arc: 0, sx: 0, sy: 0, sz: 0, total: 1, prog: 0, color: 0, frame: FRAME.dot, onHit: null });
    }
  }

  // opts: { color, frame (trail particle), size (orb scale), onHit(target) }
  fire(src, tgt, dmg, speed, arc, fromY, opts = {}) {
    const p = this.list.find((q) => !q.on);
    if (!p) return;
    p.on = true; p.src = src; p.tgt = tgt; p.dmg = dmg; p.speed = speed; p.arc = arc;
    p.sx = src.x; p.sy = fromY; p.sz = src.z;
    p.total = Math.max(0.5, Math.hypot(tgt.x - src.x, tgt.z - src.z));
    p.prog = 0;
    p.color = opts.color ?? TEAM[src.team].main;
    p.frame = opts.frame ?? FRAME.dot;
    p.onHit = opts.onHit ?? null;
    p.mesh.material.color.set(p.color);
    p.mesh.scale.setScalar(opts.size ?? 1);
    p.mesh.position.set(p.sx, p.sy, p.sz);
    p.mesh.visible = true;
  }

  reset() { for (const p of this.list) { p.on = false; p.mesh.visible = false; } }

  update(dt) {
    for (const p of this.list) {
      if (!p.on) continue;
      const tg = p.tgt;
      const m = p.mesh.position;
      const dx = tg.x - m.x, dz = tg.z - m.z, d = Math.hypot(dx, dz);
      const step = p.speed * dt;
      if (!tg.alive || d <= step + 0.3) {
        if (tg.alive) {
          dealDamage(tg, p.dmg, p.src);
          p.onHit?.(tg);
        } else particles.emit(m.x, m.y, m.z, 0, 0, 0, p.color, 0.6, 0.25, FRAME.sparkle);
        p.on = false;
        p.mesh.visible = false;
        continue;
      }
      m.x += (dx / d) * step;
      m.z += (dz / d) * step;
      p.prog = Math.min(1, 1 - d / p.total);
      const ty = (tg.hitY ?? 1) + GROUND;
      m.y = p.sy + (ty - p.sy) * p.prog + Math.sin(Math.PI * p.prog) * p.arc;
      particles.emit(m.x, m.y, m.z, 0, 0, 0, p.color, 0.45, 0.25, p.frame);
    }
  }
}
