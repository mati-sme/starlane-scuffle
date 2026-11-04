// Pooled mesh VFX (rings, swipe arcs, light columns) and the auto-aim target chevron.
import * as THREE from 'three';
import { PAL } from '../config.js';

const POOL = 20;
const ringGeo = new THREE.RingGeometry(0.82, 1, 32).rotateX(-Math.PI / 2);
const arcGeo = new THREE.RingGeometry(0.55, 1, 16, 1, -0.95, 1.9).rotateX(-Math.PI / 2);
const columnGeo = new THREE.CylinderGeometry(1, 1, 12, 16, 1, true);
const chevGeo = new THREE.ConeGeometry(0.3, 0.55, 4).rotateX(Math.PI);

class Vfx {
  constructor() { this.items = []; this.marker = null; this.target = null; }

  attach(scene) {
    for (let i = 0; i < POOL; i++) {
      const mat = new THREE.MeshBasicMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.visible = false;
      scene.add(mesh);
      this.items.push({ mesh, kind: '', age: 0, dur: 1, size: 1, on: false });
    }
    this.marker = new THREE.Mesh(chevGeo, new THREE.MeshBasicMaterial({ color: PAL.gloom }));
    this.marker.visible = false;
    scene.add(this.marker);
  }

  _start(kind, geo, color, dur, size) {
    const it = this.items.find((i) => !i.on) ?? this.items[0];
    it.on = true; it.kind = kind; it.age = 0; it.dur = dur; it.size = size;
    it.mesh.geometry = geo;
    it.mesh.material.color.set(color);
    it.mesh.visible = true;
    it.mesh.rotation.set(0, 0, 0);
    return it.mesh;
  }

  ring(x, y, z, color, size = 3, dur = 0.4) {
    this._start('ring', ringGeo, color, dur, size).position.set(x, y, z);
  }

  // Crescent facing (dx, dz) — used for melee swipes.
  arc(x, y, z, dx, dz, color, size = 2.2, dur = 0.2) {
    const m = this._start('arc', arcGeo, color, dur, size);
    m.position.set(x, y, z);
    m.rotation.y = Math.atan2(-dz, dx);
  }

  column(x, z, color, dur = 0.9) {
    this._start('column', columnGeo, color, dur, 1).position.set(x, 6, z);
  }

  setMarker(target) { this.target = target; }

  update(dt, t) {
    for (const it of this.items) {
      if (!it.on) continue;
      it.age += dt;
      const u = it.age / it.dur;
      if (u >= 1) { it.on = false; it.mesh.visible = false; continue; }
      const m = it.mesh;
      if (it.kind === 'column') {
        m.scale.set(1 - u, 1, 1 - u);
        m.material.opacity = 0.7 * (1 - u);
      } else {
        const s = it.size * (0.3 + 0.7 * (1 - (1 - u) * (1 - u)));
        m.scale.set(s, s, s);
        m.material.opacity = 1 - u;
      }
    }
    const tg = this.target;
    this.marker.visible = !!tg;
    if (tg) {
      this.marker.position.set(
        tg.rx ?? tg.x,
        (tg.hitY ?? 1) + (tg.radius ?? 0.5) + 1.1 + Math.abs(Math.sin(t * 6)) * 0.3,
        tg.rz ?? tg.z,
      );
      this.marker.rotation.y = t * 2;
    }
  }
}

export const vfx = new Vfx();
