// Ground aim preview for drag-aimed skills: a lane (line skills), a range ring + landing disc (point skills),
// a fan (cones) or a pulse ring (self skills). Team-tinted, additive, flat on the ground; turns red when the cast would cancel.
import * as THREE from 'three';
import { TEAM } from '../config.js';
import { shockTexture } from './atlas.js';

const Y = 0.2, CANCEL = 0xFF5566;

function laneTexture() { // one chevron tile along the lane (canvas top = far end)
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(255,255,255,0.95)'; g.fillRect(0, 0, 5, 64); g.fillRect(59, 0, 5, 64);
  g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 7; g.lineCap = 'butt';
  g.beginPath(); g.moveTo(14, 46); g.lineTo(32, 26); g.lineTo(50, 46); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const strip = new THREE.PlaneGeometry(1, 1).rotateX(Math.PI / 2).translate(0, 0, 0.5); // z 0..1, uv v grows with z
const disc = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);
const rim = new THREE.RingGeometry(0.94, 1, 48).rotateX(-Math.PI / 2);

function sector(arc) { // fan of unit radius around +Z
  const half = (arc / 2) * Math.PI / 180, n = Math.max(6, Math.ceil(arc / 8)), pos = [0, 0, 0];
  for (let i = 0; i <= n; i++) { const a = -half + (2 * half * i) / n; pos.push(Math.sin(a), 0, Math.cos(a)); }
  const idx = [];
  for (let i = 1; i <= n; i++) idx.push(0, i + 1, i);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

export class AimPreview {
  constructor(scene) {
    this.root = new THREE.Group();
    this.root.visible = false;
    scene.add(this.root);
    const mat = (map) => new THREE.MeshBasicMaterial({
      map, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, blending: THREE.AdditiveBlending,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    });
    this.lane = new THREE.Mesh(strip, mat(laneTexture()));
    this.link = new THREE.Mesh(strip, mat(null));
    this.disc = new THREE.Mesh(disc, mat(shockTexture()));
    this.ring = new THREE.Mesh(rim, mat(null));
    this.land = new THREE.Mesh(rim, mat(null));
    this.fan = new THREE.Mesh(sector(90), mat(null));
    this.edge = [new THREE.Mesh(strip, mat(null)), new THREE.Mesh(strip, mat(null))];
    this.fans = new Map();
    this.parts = [this.lane, this.link, this.disc, this.ring, this.land, this.fan, ...this.edge];
    for (const m of this.parts) { m.renderOrder = 6; m.visible = false; this.root.add(m); }
  }

  hide() { this.root.visible = false; }

  // hero: the caster; shape: aimShape(); dir {dx, dz}; dist: aimed distance; dragged: false = only the "ready" ring.
  show(hero, shape, dir, dist, dragged, cancel, t) {
    const root = this.root, col = new THREE.Color(cancel ? CANCEL : TEAM[hero.team].main).multiplyScalar(1.5);
    const pulse = 0.85 + Math.sin(t * 9) * 0.15, k = cancel ? 0.5 : 1;
    root.visible = true;
    root.position.set(hero.rx ?? hero.x, Y, hero.rz ?? hero.z);
    root.rotation.y = Math.atan2(dir.dx, dir.dz);
    for (const m of this.parts) { m.visible = false; m.material.color.copy(col); m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1); }
    const on = (m, op) => { m.visible = true; m.material.opacity = op * k; return m; };
    const { type, range } = shape;

    if (type === 'self' || !dragged) { // ring: the skill's reach / radius
      const R = type === 'self' ? shape.radius : range;
      on(this.disc, dragged ? 0.55 : 0.3 * pulse).scale.setScalar(R);
      on(this.ring, 0.9 * pulse).scale.setScalar(R);
      return;
    }
    if (type === 'line') {
      const w = Math.max(shape.width, 1.6);
      this.lane.material.map.repeat.set(1, range / 4);
      on(this.lane, 1.1 * pulse).scale.set(w, 1, range);
    } else if (type === 'point') {
      on(this.ring, 0.5).scale.setScalar(range); // reach
      on(this.link, 0.6 * pulse).scale.set(0.25, 1, Math.max(0, dist - shape.radius * 0.5));
      const d = on(this.disc, 0.95 * pulse); // landing spot
      d.position.set(0, 0, dist);
      d.scale.setScalar(shape.radius);
      const r = on(this.land, 0.95);
      r.position.set(0, 0, dist);
      r.scale.setScalar(shape.radius);
    } else if (type === 'cone') {
      if (!this.fans.has(shape.arc)) this.fans.set(shape.arc, sector(shape.arc));
      this.fan.geometry = this.fans.get(shape.arc);
      on(this.fan, 0.5 * pulse).scale.set(range, 1, range);
      const half = (shape.arc / 2) * Math.PI / 180;
      for (const [i, s] of [[0, -1], [1, 1]]) {
        const e = on(this.edge[i], 0.95);
        e.rotation.y = s * half;
        e.scale.set(0.3, 1, range);
        e.position.x = 0;
      }
    }
  }
}
