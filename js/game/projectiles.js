// Pooled homing projectiles (tower shots, zapper bolts, hero basics). Damage lands on arrival.
// v7.3: each shot picks a pooled shape (arrow with fletching, fireball, bubble, shard, music note, harpoon, needle...),
// keeps its own saturated color (only a light white core), trails colored particles and pops a colored impact.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TEAM, GROUND } from '../config.js';
import { particles, FRAME } from '../render/particles.js';
import { vfx } from '../render/vfx.js';
import { radialTexture } from '../render/atlas.js';
import { projOpts, hitFx, trailFx, muzzleFx } from '../render/atkfx.js';
import { dealDamage } from './combat.js';
import { inCover } from '../world/arena.js';

const POOL = 48;
const tailGeo = new THREE.CylinderGeometry(0.03, 0.2, 1, 6, 1, true).translate(0, 0.5, 0); // head at origin, tail along +Y
const UP = new THREE.Vector3(0, 1, 0), FWD = new THREE.Vector3(0, 0, 1), _back = new THREE.Vector3(), _dir = new THREE.Vector3(), _q = new THREE.Quaternion();
let glowTex;
const _white = new THREE.Color(0xffffff), _hsl = {};
// Halo / tail tint: the shot's hue pushed more saturated and a bit darker, so additive glow over pale shots stays colored.
const rich = (c, out) => { out.set(c).getHSL(_hsl); return out.setHSL(_hsl.h, Math.min(1, _hsl.s * 1.2 + 0.25), Math.min(_hsl.l, 0.58)); };

// ── shape library: one merged geometry per shape, authored along +Z (nose forward), with grey-level vertex tones
// so a single material color reads as shaft / head / fletching. `o` = orientation: face (point along travel),
// yaw (stay upright, turn to travel), spin (flat, spinning about Y), tumble (free rotation), none.
function build(list) {
  return mergeGeometries(list.map(([g, tone]) => {
    const geo = (g.index ? g.toNonIndexed() : g.clone());
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
    const n = geo.attributes.position.count, col = new Float32Array(n * 3).fill(tone);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return geo;
  }));
}
const Z = (g) => g.rotateX(Math.PI / 2); // y-aligned primitive -> +Z
const fletch = (z, h = 0.14, l = 0.3, tone = 0.8) => [0, 1, 2].map((k) => [new THREE.BoxGeometry(0.012, h, l).translate(0, h * 0.55, z).rotateZ((k * Math.PI * 2) / 3), tone]);
const SHAPES = {
  orb: { g: build([[new THREE.SphereGeometry(0.24, 12, 9), 1]]), o: 'none' },
  arrow: { g: build([[Z(new THREE.CylinderGeometry(0.03, 0.03, 1.3, 5)), 0.6], [Z(new THREE.ConeGeometry(0.1, 0.34, 4)).translate(0, 0, 0.8), 1], ...fletch(-0.52)]), o: 'face', rim: [1.9, 1.9, 1.06] },
  quarrel: { g: build([[Z(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 5)), 0.55], [Z(new THREE.ConeGeometry(0.13, 0.36, 4)).translate(0, 0, 0.72), 1], ...fletch(-0.42, 0.11, 0.22, 0.85)]), o: 'face', rim: [1.8, 1.8, 1.06] },
  bolt: { g: build([[Z(new THREE.CapsuleGeometry(0.06, 0.9, 2, 8)), 1], [Z(new THREE.CapsuleGeometry(0.035, 0.6, 2, 6)).translate(0, 0, 0.3), 1.15]]), o: 'face', rim: [1.8, 1.8, 1.08] },
  lamp: { g: build([[Z(new THREE.CapsuleGeometry(0.13, 0.55, 3, 10)), 1], [new THREE.SphereGeometry(0.1, 8, 6).translate(0, 0, 0.32), 1.2]]), o: 'face', rim: [1.5, 1.5, 1.1] },
  shard: { g: build([[new THREE.OctahedronGeometry(0.26).scale(0.6, 0.6, 2.0), 1], [new THREE.OctahedronGeometry(0.16).scale(0.5, 0.5, 1.6).translate(0.12, 0.05, -0.18), 0.75], [new THREE.OctahedronGeometry(0.14).scale(0.5, 0.5, 1.5).translate(-0.12, -0.04, -0.16), 0.8]]), o: 'face', rim: [1.5, 1.5, 1.1] },
  gem: { g: build([[new THREE.OctahedronGeometry(0.3).scale(1, 1.4, 1), 1], [new THREE.OctahedronGeometry(0.18).scale(1, 1.4, 1), 1.2]]), o: 'tumble', rim: [1.35, 1.35, 1.35] },
  fireball: { g: build([[new THREE.IcosahedronGeometry(0.28, 1), 1], ...[0, 1, 2, 3, 4].map((k) => [Z(new THREE.ConeGeometry(0.12, 0.5, 5)).rotateX(Math.PI).translate(Math.cos(k * 1.26) * 0.14, Math.sin(k * 1.26) * 0.14, -0.3), 0.75])]), o: 'face', rim: [1.3, 1.3, 1.2] },
  sun: { g: build([[new THREE.SphereGeometry(0.22, 12, 9), 1], ...[0, 1, 2, 3, 4, 5, 6, 7].map((k) => [new THREE.ConeGeometry(0.06, 0.22, 4).translate(0, 0.32, 0).rotateZ((k * Math.PI) / 4), 0.85])]), o: 'yaw', rim: [1.3, 1.3, 1.3] },
  bell: { g: build([[new THREE.CylinderGeometry(0.09, 0.26, 0.32, 12), 1], [new THREE.SphereGeometry(0.09, 8, 6).translate(0, 0.18, 0), 0.9], [new THREE.SphereGeometry(0.08, 8, 6).translate(0, -0.2, 0), 1.1], [new THREE.TorusGeometry(0.26, 0.035, 4, 16).rotateX(Math.PI / 2).translate(0, -0.16, 0), 0.75]]), o: 'tumble', rim: [1.15, 1.15, 1.15] },
  note: { g: build([[new THREE.SphereGeometry(0.2, 12, 8).scale(1.3, 0.95, 0.7).rotateZ(0.4).translate(-0.1, -0.2, 0), 1], [new THREE.BoxGeometry(0.05, 0.56, 0.05).translate(0.14, 0.08, 0), 0.85], [new THREE.BoxGeometry(0.22, 0.08, 0.05).rotateZ(-0.5).translate(0.24, 0.3, 0), 0.85]]), o: 'yaw', rim: [1.35, 1.25, 1.6] },
  cross: { g: build([[new THREE.SphereGeometry(0.2, 12, 9), 0.85], [new THREE.BoxGeometry(0.12, 0.5, 0.12), 1.15], [new THREE.BoxGeometry(0.5, 0.12, 0.12), 1.15]]), o: 'yaw', rim: [1.3, 1.3, 1.3] },
  void: { g: build([[new THREE.SphereGeometry(0.24, 12, 9), 1], [new THREE.TorusGeometry(0.36, 0.035, 4, 20).rotateX(1.2), 0.75], [new THREE.TorusGeometry(0.32, 0.03, 4, 20).rotateY(1.1), 0.6]]), o: 'tumble', rim: [1.5, 1.5, 1.5] },
  star: { g: build([[new THREE.OctahedronGeometry(0.3).scale(0.4, 1.3, 0.4), 1], [new THREE.OctahedronGeometry(0.3).scale(1.3, 0.4, 0.4), 1], [new THREE.SphereGeometry(0.12, 8, 6), 1.2]]), o: 'spinZ', rim: [1.3, 1.3, 1.3] },
  pinball: { g: build([[new THREE.SphereGeometry(0.26, 14, 10), 1], [new THREE.TorusGeometry(0.262, 0.035, 4, 24).rotateX(Math.PI / 2), 0.55], [new THREE.SphereGeometry(0.07, 6, 4).translate(0.1, 0.16, 0.16), 1.3]]), o: 'tumble', rim: [1.25, 1.25, 1.25] },
  bubble: { g: build([[new THREE.SphereGeometry(0.34, 16, 12), 0.85], [new THREE.SphereGeometry(0.08, 8, 6).scale(1, 0.6, 0.5).translate(-0.12, 0.16, 0.24), 1.5]]), o: 'none', rim: [1.12, 1.12, 1.12], alpha: 0.62 },
  spore: { g: build([[new THREE.IcosahedronGeometry(0.3, 1), 1], ...[0, 1, 2, 3].map((k) => [new THREE.IcosahedronGeometry(0.18, 1).translate(Math.cos(k * 1.57) * 0.24, Math.sin(k * 2.1) * 0.12, Math.sin(k * 1.57) * 0.24), 0.85])]), o: 'tumble', rim: [1.15, 1.15, 1.15], alpha: 0.78 },
  wave: { g: build([[new THREE.TorusGeometry(0.5, 0.07, 4, 24, Math.PI * 0.9).rotateZ(Math.PI * 0.05), 1], [new THREE.TorusGeometry(0.34, 0.05, 4, 20, Math.PI * 0.9).rotateZ(Math.PI * 0.05).translate(0, 0, -0.22), 0.8], [new THREE.TorusGeometry(0.2, 0.04, 4, 16, Math.PI * 0.9).rotateZ(Math.PI * 0.05).translate(0, 0, -0.4), 0.65]]), o: 'wave', rim: null, alpha: 0.85, grow: 0.7 }, // rings cannot carry an inverted-hull outline
  flower: { g: build([[new THREE.SphereGeometry(0.1, 8, 6), 1.2], ...[0, 1, 2, 3, 4].map((k) => [new THREE.SphereGeometry(0.16, 8, 6).scale(1, 0.25, 0.6).translate(0.2, 0, 0).rotateY((k * Math.PI * 2) / 5), k % 2 ? 0.85 : 1])]), o: 'spin', rim: [1.25, 1.6, 1.25] },
  chakram: { g: build([[new THREE.TorusGeometry(0.28, 0.05, 4, 20).rotateX(Math.PI / 2), 1], ...[0, 1, 2, 3, 4, 5].map((k) => [new THREE.SphereGeometry(0.14, 8, 6).scale(1, 0.2, 0.42).translate(0.36, 0, 0.05).rotateY((k * Math.PI) / 3), 0.8])]), o: 'spin', rim: [1.2, 1.8, 1.2] },
  seed: { g: build([[new THREE.SphereGeometry(0.2, 10, 8).scale(0.85, 0.85, 1.3), 1], [new THREE.SphereGeometry(0.2, 8, 6).scale(0.9, 0.15, 0.5).translate(0.2, 0.06, -0.12).rotateZ(0.3), 0.65], [new THREE.SphereGeometry(0.2, 8, 6).scale(0.9, 0.15, 0.5).translate(-0.2, 0.06, -0.12).rotateZ(-0.3), 0.65]]), o: 'tumble', rim: [1.25, 1.25, 1.25] },
  harpoon: { g: build([[Z(new THREE.CylinderGeometry(0.035, 0.035, 1.9, 5)), 0.55], [Z(new THREE.ConeGeometry(0.11, 0.42, 4)).translate(0, 0, 1.12), 1], ...[-1, 1].map((sx) => [Z(new THREE.ConeGeometry(0.04, 0.24, 3)).rotateX(Math.PI).rotateY(sx * 0.5).translate(sx * 0.09, 0, 0.92), 0.9]), [new THREE.TorusGeometry(0.06, 0.02, 4, 10).translate(0, 0, -0.95), 0.7]]), o: 'face', rim: [1.8, 1.8, 1.05] },
  needle: { g: build([[Z(new THREE.CylinderGeometry(0.018, 0.03, 1.3, 5)), 1], [Z(new THREE.ConeGeometry(0.03, 0.2, 5)).translate(0, 0, 0.75), 1.2], [new THREE.TorusGeometry(0.04, 0.012, 4, 8).rotateY(Math.PI / 2).translate(0, 0, -0.66), 0.7]]), o: 'face', rim: [2.4, 2.4, 1.05] },
};

export class Projectiles {
  constructor(scene) {
    this.list = [];
    this.blocker = null; // Zones: walls that eat enemy shots
    glowTex ??= radialTexture();
    for (let i = 0; i < POOL; i++) {
      const mesh = new THREE.Mesh(SHAPES.orb.g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, toneMapped: false }));
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }));
      halo.scale.setScalar(2.3);
      mesh.add(halo);
      // Dark inverted-hull outline: the colored core keeps a crisp edge over sunlit stone and other glows.
      const rim = new THREE.Mesh(SHAPES.orb.g, new THREE.MeshBasicMaterial({ color: 0x0B1022, side: THREE.BackSide, toneMapped: false }));
      rim.scale.setScalar(1.35);
      mesh.add(rim);
      mesh.visible = false;
      scene.add(mesh);
      const tail = new THREE.Mesh(tailGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      tail.visible = false;
      scene.add(tail);
      this.list.push({ tail, mesh, on: false, src: null, tgt: null, dmg: 0, speed: 0, arc: 0, sx: 0, sy: 0, sz: 0, total: 1, prog: 0, color: 0, c2: 0, frame: FRAME.dot, onHit: null, shape: SHAPES.orb, trail: null, hit: null, trT: 0, spinA: 0, size: 1 });
    }
  }

  // opts: { color, c2, shape, trail, hit, frame (fallback trail particle), size, tail, halo, core, rim, onHit(target) }
  fire(src, tgt, dmg, speed, arc, fromY, opts = {}) {
    this.onFire?.(src, tgt, speed, arc, fromY); // online host: mirrored to the guest
    if (opts.color == null && src.type === 'hero' && src.basic) opts = projOpts(src, src.basic); // guests: rebuild the look locally
    const p = this.list.find((q) => !q.on);
    if (!p) return;
    p.on = true; p.src = src; p.tgt = tgt; p.dmg = dmg; p.speed = speed; p.arc = arc;
    p.sx = src.x; p.sy = fromY; p.sz = src.z;
    p.total = Math.max(0.5, Math.hypot(tgt.x - src.x, tgt.z - src.z));
    p.prog = 0;
    p.color = opts.color ?? TEAM[src.team].main;
    p.c2 = opts.c2 ?? p.color;
    p.frame = opts.frame ?? FRAME.dot;
    p.trail = opts.trail ?? null;
    p.hit = opts.hit ?? null;
    p.trT = 0; p.spinA = Math.random() * 6;
    p.onHit = opts.onHit ?? null;
    const S = p.shape = SHAPES[opts.shape] ?? SHAPES.orb;
    p.mesh.geometry = S.g;
    const rim = p.mesh.children[1];
    rim.geometry = S.g;
    rim.visible = S.rim !== null;
    if (S.rim) rim.scale.set(...S.rim); else rim.scale.setScalar(1.35);
    rim.material.color.set(opts.rim ?? 0x0B1022);
    p.mesh.material.color.set(p.color).lerp(_white, opts.core ?? 0.12); // saturated body, only a light hot core
    p.mesh.material.opacity = S.alpha ?? 1;
    p.mesh.material.depthWrite = !S.alpha;
    rich(p.color, p.mesh.children[0].material.color);
    p.mesh.children[0].material.opacity = S === SHAPES.orb ? 0.9 : 0.5; // the shape carries the read; the glow just tints the air
    p.mesh.children[0].scale.setScalar(Math.min(opts.halo ?? 2.3, 2.6) * (S.o === 'face' ? 0.55 : 0.75));
    p.size = opts.size ?? 1;
    p.mesh.scale.setScalar(p.size);
    p.mesh.position.set(p.sx, p.sy, p.sz);
    p.mesh.quaternion.identity();
    p.mesh.visible = true;
    const fx = tgt.x - src.x, fz = tgt.z - src.z, fd = Math.hypot(fx, fz) || 1;
    p.dx = fx / fd; p.dz = fz / fd;
    const tl = opts.tail ?? 1;
    rich(p.c2 !== p.color && S.o === 'face' ? p.c2 : p.color, p.tail.material.color).multiplyScalar(S.o === 'face' ? 1.4 : 1.0);
    p.tail.scale.set(p.size * (S.o === 'face' ? 0.6 : 1.2), (2.2 + speed * 0.1) * tl, p.size * (S.o === 'face' ? 0.6 : 1.2)); // comet tail: travel direction reads at a glance
    p.tail.position.set(p.sx, p.sy, p.sz);
    p.tail.quaternion.setFromUnitVectors(UP, _back.set(-p.dx, 0, -p.dz));
    p.tail.material.opacity = S.o === 'face' ? 0.6 : 0.4;
    p.tail.visible = tl > 0;
    if (src.type === 'hero') muzzleFx(src, src.x, fromY, src.z, p.dx, p.dz, p.color);
  }

  reset() { for (const p of this.list) { p.on = false; p.mesh.visible = false; p.tail.visible = false; } }

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
          if (p.hit) hitFx(p.hit, m.x, m.y, m.z, p.color, p.c2, Math.min(1.3, 0.8 + p.size * 0.2));
          else { // towers, minions and profile-less shots: a colored pop (no white overlay)
            particles.burst(m.x, m.y, m.z, 8, { color: [p.color, p.c2], speed: 4, up: 1.5, size: 0.55, life: 0.35, frame: FRAME.sparkle, grav: 2 });
            vfx.ring(m.x, m.y, m.z, p.color, 1.5, 0.22);
            vfx.flash(m.x, m.y, m.z, p.color, 1.4 * p.mesh.scale.x, 0.16);
          }
        } else particles.emit(m.x, m.y, m.z, 0, 0, 0, p.color, 0.6, 0.25, FRAME.sparkle);
        p.on = false;
        p.mesh.visible = false;
        p.tail.visible = false;
        continue;
      }
      const ox = m.x, oy = m.y, oz = m.z;
      m.x += (dx / d) * step;
      m.z += (dz / d) * step;
      if (this.blocker?.blocks(p.src.team, m.x, m.z) || (p.src.type === 'hero' && inCover(m.x, m.z))) { // walls and cover eat hero shots
        particles.burst(m.x, m.y, m.z, 5, { color: [p.color, p.c2], speed: 2, up: 1, size: 0.4, life: 0.3, frame: FRAME.sparkle, grav: 0 });
        p.on = false;
        p.mesh.visible = false;
        p.tail.visible = false;
        continue;
      }
      p.prog = Math.min(1, 1 - d / p.total);
      const ty = (tg.hitY ?? 1) + GROUND;
      m.y = p.sy + (ty - p.sy) * p.prog + Math.sin(Math.PI * p.prog) * p.arc;
      // orientation per shape
      const S = p.shape, ux = dx / d, uz = dz / d;
      p.spinA += dt;
      if (S.o === 'face' || S.o === 'spinZ' || S.o === 'wave') {
        _dir.set(m.x - ox, m.y - oy, m.z - oz);
        if (_dir.lengthSq() > 1e-8) p.mesh.quaternion.setFromUnitVectors(FWD, _dir.normalize());
        if (S.o === 'spinZ') p.mesh.quaternion.multiply(_q.setFromAxisAngle(FWD, p.spinA * 9));
        if (S.grow) p.mesh.scale.setScalar(p.size * (1 + S.grow * p.prog)); // sound waves spread as they travel
      } else if (S.o === 'yaw') p.mesh.rotation.set(0, Math.atan2(ux, uz) + Math.sin(p.spinA * 6) * 0.25, Math.sin(p.spinA * 8) * 0.15);
      else if (S.o === 'spin') p.mesh.rotation.set(0.15, p.spinA * 14, 0);
      else if (S.o === 'tumble') p.mesh.rotation.set(p.spinA * 5, p.spinA * 7, p.spinA * 3);
      if ((p.trT -= dt) <= 0) { // ~30 Hz colored trail (no white sparkle per frame)
        p.trT = 0.033;
        if (p.trail) trailFx(p.trail, m.x, m.y, m.z, ux, uz, p.color, p.c2);
        else particles.emit(m.x, m.y, m.z, 0, 0, 0, p.color, 0.75, 0.35, p.frame);
      }
      p.tail.position.copy(m);
      p.tail.quaternion.setFromUnitVectors(UP, _back.set(-ux, 0, -uz));
    }
  }
}
