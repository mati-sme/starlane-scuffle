// Pooled mesh VFX (rings, swipe arcs, light columns, decals, vine tubes, ghosts, falling streaks) and the auto-aim chevron.
// Ground effects get a dark normal-blended underlay so additive color still reads on bright stone and grass in a crowd.
import * as THREE from 'three';
import { PAL } from '../config.js';
import { shockTexture, runeTexture, radialTexture } from './atlas.js';
import { HI } from './quality.js';

const POOL = HI ? 64 : 40, SHADES = HI ? 32 : 20;
const SHADE_KINDS = new Set(['ring', 'arc', 'decal', 'rune']);
const ringGeo = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2); // shock texture paints the soft rim + faint fill
const arcGeo = new THREE.RingGeometry(0.4, 1, 20, 1, -0.95, 1.9).rotateX(-Math.PI / 2); // planar UVs: bright leading edge
const columnGeo = new THREE.CylinderGeometry(1, 1, 12, 16, 1, true);
const decalGeo = new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2);
const tubeGeo = new THREE.CylinderGeometry(0.3, 1, 1, 6, 1, true).translate(0, 0.5, 0); // tapered, base at origin, +Y
const ghostGeo = new THREE.SphereGeometry(1, 10, 8);
const streakGeo = new THREE.CylinderGeometry(0.02, 0.16, 1, 5); // fat head at -Y, thin tail at +Y
const targetRingGeo = new THREE.RingGeometry(0.86, 1, 40).rotateX(-Math.PI / 2); // under the current auto-attack target
const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true).translate(0, 0.5, 0); // base at origin, +Y
const flashGeo = new THREE.PlaneGeometry(2, 2);
const chevGeo = new THREE.ConeGeometry(0.3, 0.55, 4).rotateX(Math.PI);

const UP = new THREE.Vector3(0, 1, 0);
const _white = new THREE.Color(0xffffff);
const _a = new THREE.Vector3(), _b = new THREE.Vector3();

class Vfx {
  constructor() { this.items = []; this.marker = null; this.target = null; }

  attach(scene) {
    const shock = shockTexture();
    this.shock = shock;
    this.runeTex = runeTexture();
    this.flashTex = radialTexture();
    this.camera = null;
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
    this.tring = new THREE.Mesh(targetRingGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xFF5566).multiplyScalar(1.6), transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    this.tring.visible = false;
    this.tring.renderOrder = 5;
    scene.add(this.tring);
    this.shades = [];
    for (let i = 0; i < SHADES; i++) {
      const mesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x070B18, map: shock, transparent: true, depthWrite: false, toneMapped: false }));
      mesh.visible = false;
      mesh.renderOrder = -1;
      scene.add(mesh);
      this.shades.push({ mesh, owner: null });
    }
  }

  // Borrow a dark underlay for a ground effect; it copies the owner's transform each frame (see update).
  _shade(it) {
    const sh = this.shades.find((q) => !q.owner || !q.owner.on || q.owner.shade !== q);
    if (!sh) return;
    sh.owner = it; it.shade = sh;
    sh.mesh.geometry = it.mesh.geometry;
    const map = it.kind === 'rune' || it.kind === 'decal' ? this.flashTex : this.shock;
    if (sh.mesh.material.map !== map) { sh.mesh.material.map = map; sh.mesh.material.needsUpdate = true; }
    sh.mesh.visible = true;
  }

  _start(kind, geo, color, dur, size) {
    const it = this.items.find((i) => !i.on) ?? this.items[0];
    it.on = true; it.kind = kind; it.age = 0; it.dur = dur; it.size = size;
    it.mesh.geometry = geo;
    const map = kind === 'rune' ? this.runeTex : kind === 'flash' ? this.flashTex : geo === ringGeo || geo === arcGeo || geo === decalGeo ? this.shock : null, textured = !!map;
    if (it.mesh.material.map !== map) { it.mesh.material.map = map; it.mesh.material.needsUpdate = true; }
    // HDR-ish boost (additive, not tone-mapped), capped per channel so pale colors keep their hue instead of clipping to white.
    const c = it.mesh.material.color.set(color), mx = Math.max(c.r, c.g, c.b, 0.01);
    c.multiplyScalar(Math.min(textured ? 1.6 : 1.2, 1.15 / mx));
    it.mesh.visible = true;
    it.mesh.rotation.set(0, 0, 0);
    it.mesh.quaternion.identity();
    it.mesh.scale.set(1, 1, 1);
    it.shade = null;
    return it;
  }

  ring(x, y, z, color, size = 3, dur = 0.4) {
    const it = this._start('ring', ringGeo, color, dur, size);
    it.mesh.position.set(x, y, z);
    if (y < 0.6) this._shade(it);
  }

  // Crescent facing (dx, dz) — used for melee swipes.
  arc(x, y, z, dx, dz, color, size = 2.2, dur = 0.2) {
    const m = this._start('arc', arcGeo, color, dur, size).mesh;
    m.position.set(x, y, z);
    m.rotation.y = Math.atan2(-dz, dx);
    if (y < 0.9) this._shade(this.items.find((i) => i.mesh === m));
  }

  column(x, z, color, dur = 0.9) {
    const it = this._start('column', columnGeo, color, dur, 1);
    it.mesh.position.set(x, 6, z);
    it.mesh.material.color.multiplyScalar(0.7);
  }

  // Flat glowing disc on the ground that fades out (craters, area markers).
  decal(x, z, color, size = 2, dur = 1.5) {
    const m = this._start('decal', decalGeo, color, dur, size).mesh;
    m.position.set(x, 0.12, z);
    m.scale.set(size, size, size);
    this._shade(this.items.find((i) => i.mesh === m));
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

  // Spinning glyph circle on the ground: the "a skill is being cast here" read.
  rune(x, z, color, size = 2.4, dur = 0.7) {
    const it = this._start('rune', decalGeo, color, dur, size);
    it.mesh.position.set(x, 0.16, z);
    it.mesh.material.color.multiplyScalar(0.8); // glyphs stay hue-true: several overlapping runes must not sum to white
    this._shade(it);
  }

  // Camera-facing white-hot burst (cast release, skill impacts).
  flash(x, y, z, color, size = 1.5, dur = 0.2) {
    const it = this._start('flash', flashGeo, color, dur, size);
    it.mesh.position.set(x, y, z);
    it.mesh.material.color.lerp(_white, 0.18);
    it.size = Math.min(size, 3.2);
  }

  // Thick energy beam from a to b that flares then thins out (hitscan skill shots).
  beam(x0, y0, z0, x1, y1, z1, color, width = 0.35, dur = 0.28) {
    const it = this._start('beam', beamGeo, color, dur, width);
    _a.set(x1 - x0, y1 - y0, z1 - z0);
    const len = _a.length() || 1;
    it.mesh.position.set(x0, y0, z0);
    it.mesh.quaternion.setFromUnitVectors(UP, _a.divideScalar(len));
    it.mesh.scale.set(width, len, width);
    it.ay = len;
  }

  setMarker(target) { this.target = target; }

  update(dt, t) {
    for (const it of this.items) {
      if (!it.on) continue;
      it.age += dt;
      const u = it.age / it.dur;
      if (u >= 1) {
        it.on = false; it.mesh.visible = false;
        if (it.shade?.owner === it) { it.shade.mesh.visible = false; it.shade.owner = null; }
        continue;
      }
      const m = it.mesh;
      switch (it.kind) {
        case 'column':
          m.scale.set(1 - u, 1, 1 - u);
          m.material.opacity = 0.35 * (1 - u);
          break;
        case 'decal':
          m.material.opacity = 0.9 * (1 - u * u) * Math.min(1, u * 20); // holds, then fades: reads as a telegraph
          break;
        case 'rune': {
          const grow = Math.min(1, u * 6), s = it.size * (0.6 + 0.4 * (1 - (1 - grow) ** 3));
          m.scale.set(s, s, s);
          m.rotation.y = it.age * 2.2;
          m.material.opacity = 0.8 * Math.min(1, u * 8) * (1 - u * u);
          break;
        }
        case 'flash': {
          if (this.camera) m.quaternion.copy(this.camera.quaternion);
          const s = it.size * (0.4 + 0.6 * Math.sqrt(u));
          m.scale.set(s, s, s);
          m.material.opacity = (1 - u) * Math.min(1, 1.8 / it.size); // big flashes stay translucent so stacked casts keep their hue
          break;
        }
        case 'beam': {
          const w = it.size * (u < 0.2 ? 0.6 + 2 * u : 1 - (u - 0.2) / 0.8 * 0.85);
          m.scale.set(w, it.ay, w);
          m.material.opacity = 1 - u * u;
          break;
        }
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
      const sh = it.shade;
      if (sh?.owner === it) {
        sh.mesh.position.copy(m.position).y -= 0.03;
        sh.mesh.quaternion.copy(m.quaternion);
        sh.mesh.scale.copy(m.scale).multiplyScalar(1.12);
        sh.mesh.material.opacity = m.material.opacity * 0.55;
      }
    }
    const tg = this.target;
    this.marker.visible = !!tg;
    this.tring.visible = !!tg;
    if (tg) {
      const r = ((tg.radius ?? 0.6) + 0.35) * (1 + Math.sin(t * 7) * 0.05);
      this.tring.position.set(tg.rx ?? tg.x, 0.22, tg.rz ?? tg.z);
      this.tring.scale.set(r, 1, r);
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
