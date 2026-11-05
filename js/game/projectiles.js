// Pooled homing orbs (tower shots, zapper bolts, hero basics). Damage lands on arrival.
import * as THREE from 'three';
import { TEAM, GROUND } from '../config.js';
import { particles, FRAME } from '../render/particles.js';
import { vfx } from '../render/vfx.js';
import { radialTexture } from '../render/atlas.js';
import { dealDamage } from './combat.js';
import { inCover } from '../world/arena.js';

const POOL = 48;
const geo = new THREE.SphereGeometry(0.2, 8, 6);
let glowTex;

const _white = new THREE.Color(0xffffff);

export class Projectiles {
  constructor(scene) {
    this.list = [];
    this.blocker = null; // Zones: walls that eat enemy shots
    for (let i = 0; i < POOL; i++) {
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ toneMapped: false }));
      glowTex ??= radialTexture();
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }));
      halo.scale.setScalar(1.6);
      mesh.add(halo);
      mesh.visible = false;
      scene.add(mesh);
      this.list.push({ mesh, on: false, src: null, tgt: null, dmg: 0, speed: 0, arc: 0, sx: 0, sy: 0, sz: 0, total: 1, prog: 0, color: 0, frame: FRAME.dot, onHit: null });
    }
  }

  // opts: { color, frame (trail particle), size (orb scale), onHit(target) }
  fire(src, tgt, dmg, speed, arc, fromY, opts = {}) {
    this.onFire?.(src, tgt, speed, arc, fromY); // online host: mirrored to the guest
    const p = this.list.find((q) => !q.on);
    if (!p) return;
    p.on = true; p.src = src; p.tgt = tgt; p.dmg = dmg; p.speed = speed; p.arc = arc;
    p.sx = src.x; p.sy = fromY; p.sz = src.z;
    p.total = Math.max(0.5, Math.hypot(tgt.x - src.x, tgt.z - src.z));
    p.prog = 0;
    p.color = opts.color ?? TEAM[src.team].main;
    p.frame = opts.frame ?? FRAME.dot;
    p.onHit = opts.onHit ?? null;
    p.mesh.material.color.set(p.color).lerp(_white, 0.65); // white-hot core inside a colored glow
    p.mesh.children[0].material.color.set(p.color);
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
          particles.burst(m.x, m.y, m.z, 6, { color: [p.color, 0xffffff], speed: 3, up: 1.5, size: 0.45, life: 0.3, frame: FRAME.sparkle, grav: 2 });
          vfx.ring(m.x, m.y, m.z, p.color, 0.9, 0.18);
        } else particles.emit(m.x, m.y, m.z, 0, 0, 0, p.color, 0.6, 0.25, FRAME.sparkle);
        p.on = false;
        p.mesh.visible = false;
        continue;
      }
      m.x += (dx / d) * step;
      m.z += (dz / d) * step;
      if (this.blocker?.blocks(p.src.team, m.x, m.z) || (p.src.type === 'hero' && inCover(m.x, m.z))) { // walls and cover eat hero shots
        particles.burst(m.x, m.y, m.z, 5, { color: p.color, speed: 2, up: 1, size: 0.4, life: 0.3, frame: FRAME.sparkle, grav: 0 });
        p.on = false;
        p.mesh.visible = false;
        continue;
      }
      p.prog = Math.min(1, 1 - d / p.total);
      const ty = (tg.hitY ?? 1) + GROUND;
      m.y = p.sy + (ty - p.sy) * p.prog + Math.sin(Math.PI * p.prog) * p.arc;
      particles.emit(m.x, m.y, m.z, 0, 0, 0, p.color, 0.45, 0.25, p.frame);
    }
  }
}
