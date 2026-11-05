// Pooled mesh VFX (rings, swipe arcs, light columns, decals, vine tubes, ghosts, falling streaks) and the auto-aim chevron.
import * as THREE from 'three';
import { PAL } from '../config.js';
import { shockTexture } from './atlas.js';

const POOL = 32;
const ringGeo = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2); // shock texture paints the soft rim + faint fill
const arcGeo = new THREE.RingGeometry(0.4, 1, 20, 1, -0.95, 1.9).rotateX(-Math.PI / 2); // planar UVs: bright leading edge
const columnGeo = new THREE.CylinderGeometry(1, 1, 12, 16, 1, true);
const decalGeo = new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2);
const tubeGeo = new THREE.CylinderGeometry(0.3, 1, 1, 6, 1, true).translate(0, 0.5, 0); // tapered, base at origin, +Y
const ghostGeo = new THREE.SphereGeometry(1, 10, 8);
const streakGeo = new THREE.CylinderGeometry(0.02, 0.16, 1, 5); // fat head at -Y, thin tail at +Y
const chevGeo = new THREE.ConeGeometry(0.3, 0.55, 4).rotateX(Math.PI);

const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3();

class Vfx {
  constructor() { this.items = []; this.marker = null; this.target = null; }

  attach(scene) {
    const shock = shockTexture();
    this.shock = shock;
    for (let i = 0; i < POOL; i++) {
      const mat = new THREE.MeshBasicMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
      });
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.visible = false;
      scene.add(mesh);
      this.items.push({ mesh, kind: '', age: 0, dur: 1, size: 1, on: false, a: null, b: null, ay: 0, by: 0, dir: new THREE.Vector3() });
    }
    this.marker = new THREE.Mesh(chevGeo, new THREE.MeshBasicMaterial({ color: PAL.gloom, toneMapped: false }));
    this.marker.visible = false;
    scene.add(this.marker);
  }

  _start(kind, geo, color, dur, size) {
    const it = this.items.find((i) => !i.on) ?? this.items[0];
    it.on = true; it.kind = kind; it.age = 0; it.dur = dur; it.size = size;
    it.mesh.geometry = geo;
    const textured = geo === ringGeo || geo === arcGeo || geo === decalGeo;
    if ((it.mesh.material.map === this.shock) !== textured) { it.mesh.material.map = textured ? this.shock : null; it.mesh.material.needsUpdate = true; }
    it.mesh.material.color.set(color).multiplyScalar(textured ? 1.6 : 1.2); // HDR-ish boost: additive and not tone-mapped
    it.mesh.visible = true;
    it.mesh.rotation.set(0, 0, 0);
    it.mesh.quaternion.identity();
    it.mesh.scale.set(1, 1, 1);
    return it;
  }

  ring(x, y, z, color, size = 3, dur = 0.4) {
    this._start('ring', ringGeo, color, dur, size).mesh.position.set(x, y, z);
  }

  // Crescent facing (dx, dz) — used for melee swipes.
  arc(x, y, z, dx, dz, color, size = 2.2, dur = 0.2) {
    const m = this._start('arc', arcGeo, color, dur, size).mesh;
    m.position.set(x, y, z);
    m.rotation.y = Math.atan2(-dz, dx);
  }

  column(x, z, color, dur = 0.9) {
    this._start('column', columnGeo, color, dur, 1).mesh.position.set(x, 6, z);
  }

  // Flat glowing disc on the ground that fades out (craters, area markers).
  decal(x, z, color, size = 2, dur = 1.5) {
    const m = this._start('decal', decalGeo, color, dur, size).mesh;
    m.position.set(x, 0.12, z);
    m.scale.set(size, size, size);
  }

  // Afterimage: a squashed glowing blob that fades.
  ghost(x, z, color, dur = 0.5) {
    const m = this._start('ghost', ghostGeo, color, dur, 1).mesh;
    m.position.set(x, 1.1, z);
    m.scale.set(0.7, 1.15, 0.7);
  }

  // Tapered tube that grows from `from` to `to` (entities with x / z), then retracts. Follows both ends.
  link(from, to, color, dur = 0.5, fromY = 1, toY = 1, radius = 0.22) {
    const it = this._start('tube', tubeGeo, color, dur, radius);
    it.a = from; it.b = to; it.ay = fromY; it.by = toY;
  }

  // Shooting star: a bright streak travelling from (x0, y0, z0) to (x1, y1, z1).
  streak(x0, y0, z0, x1, y1, z1, color, dur = 0.35, len = 2.6) {
    const it = this._start('streak', streakGeo, color, dur, len);
    it.dir.set(x1 - x0, y1 - y0, z1 - z0);
    it.a = [x0, y0, z0]; it.b = [x1, y1, z1];
    it.mesh.quaternion.setFromUnitVectors(UP, _a.copy(it.dir).normalize().negate());
    it.mesh.scale.set(1, len, 1);
  }

  setMarker(target) { this.target = target; }

  update(dt, t) {
    for (const it of this.items) {
      if (!it.on) continue;
      it.age += dt;
      const u = it.age / it.dur;
      if (u >= 1) { it.on = false; it.mesh.visible = false; continue; }
      const m = it.mesh;
      switch (it.kind) {
        case 'column':
          m.scale.set(1 - u, 1, 1 - u);
          m.material.opacity = 0.7 * (1 - u);
          break;
        case 'decal':
          m.material.opacity = 0.9 * (1 - u * u) * Math.min(1, u * 20); // holds, then fades: reads as a telegraph
          break;
        case 'ghost':
          m.material.opacity = 0.55 * (1 - u);
          break;
        case 'tube': {
          const a = it.a, b = it.b;
          _a.set(a.rx ?? a.x, it.ay, a.rz ?? a.z);
          _b.set(b.rx ?? b.x, it.by, b.rz ?? b.z).sub(_a);
          const len = _b.length(), grow = u < 0.3 ? u / 0.3 : u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4;
          m.position.copy(_a);
          m.quaternion.setFromUnitVectors(UP, _b.divideScalar(len || 1));
          m.scale.set(it.size, len * grow, it.size);
          m.material.opacity = 0.9;
          break;
        }
        case 'streak': {
          const [x0, y0, z0] = it.a, [x1, y1, z1] = it.b;
          const e = u * u; // accelerate
          _a.copy(it.dir).normalize();
          m.position.set(x0 + (x1 - x0) * e, y0 + (y1 - y0) * e, z0 + (z1 - z0) * e).addScaledVector(_a, -it.size * 0.5);
          m.material.opacity = Math.min(1, u * 6);
          break;
        }
        default: { // ring / arc
          const s = it.size * (0.3 + 0.7 * (1 - (1 - u) * (1 - u)));
          m.scale.set(s, s, s);
          m.material.opacity = 1 - u;
        }
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
