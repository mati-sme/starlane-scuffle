// Floating island, lane, props, sky, nebula, stars and planets.
import * as THREE from 'three';
import { PAL } from '../config.js';
import { rand, clamp } from '../core/math.js';
import { toonMat, toonMesh, mergeParts } from '../render/toon.js';
import { radialTexture } from '../render/atlas.js';
import { particles, FRAME } from '../render/particles.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

function place(mesh, i, x, y, z, yaw, sx, sy = sx, sz = sx) {
  mesh.setMatrixAt(i, _m.compose(_p.set(x, y, z), _q.setFromAxisAngle(UP, yaw), _s.set(sx, sy, sz)));
}

function instanced(geo, mat, n) {
  const m = new THREE.InstancedMesh(geo, mat, n);
  m.frustumCulled = false;
  return m;
}

const hash = (x, y, z) => { const v = Math.sin(x * 12.9898 + y * 37.7 + z * 78.233) * 43758.5453; return v - Math.floor(v); };
const side = () => (Math.random() < 0.5 ? -1 : 1);

function buildSky(group) {
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(400, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uA: { value: new THREE.Color(PAL.voidTop) }, uB: { value: new THREE.Color(PAL.voidBottom) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 uA; uniform vec3 uB; varying vec3 vP;
        void main(){ float t = smoothstep(-1.0, 0.15, normalize(vP).y); gl_FragColor = vec4(mix(uA, uB, t), 1.0);
        #include <colorspace_fragment>
        }`,
    }),
  );
  sky.renderOrder = -10;
  group.add(sky);

  const n = 1200, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(300);
    pos.set([v.x, v.y, v.z], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: PAL.star, size: 2, sizeAttenuation: false, fog: false, depthWrite: false }));
  stars.frustumCulled = false;
  group.add(stars);

  // Nebula: big additive billboards below / behind the island (the camera looks down).
  const tex = radialTexture();
  const nebula = [];
  [[-90, -85, -70, PAL.nebulaA, 190], [10, -95, -95, PAL.nebulaB, 220], [110, -80, -60, PAL.nebulaA, 180], [-20, -70, 70, PAL.nebulaB, 160]]
    .forEach(([x, y, z, color, size]) => {
      const q = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({
        map: tex, color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
      }));
      q.position.set(x, y, z);
      group.add(q);
      nebula.push(q);
    });

  // Two distant ringed planets.
  [[-95, -50, -110, 14, PAL.cliffLight], [120, -60, -40, 9, PAL.gloom]].forEach(([x, y, z, r, color]) => {
    const planet = new THREE.Group();
    planet.add(toonMesh(new THREE.SphereGeometry(r, 20, 14), toonMat({ color, fog: false }), 0.4));
    const ring = new THREE.Mesh(new THREE.RingGeometry(r * 1.4, r * 1.9, 32), new THREE.MeshBasicMaterial({ color: PAL.star, transparent: true, opacity: 0.5, side: THREE.DoubleSide, fog: false }));
    ring.rotation.x = Math.PI / 2.3;
    planet.add(ring);
    planet.position.set(x, y, z);
    group.add(planet);
  });
  return nebula;
}

function buildIsland(group) {
  const H = 10;
  let geo = new THREE.CylinderGeometry(1, 0.3, H, 14, 3).translate(0, -H / 2, 0).scale(78, 1, 24);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) < -0.1) { // jagged cliffs; position-hashed so seams stay watertight
      const h = hash(p.getX(i), p.getY(i), p.getZ(i)) - 0.5;
      p.setXYZ(i, p.getX(i) * (1 + 0.05 * h), p.getY(i) + h * 1.6, p.getZ(i) * (1 + 0.05 * h));
    }
  }
  geo = geo.toNonIndexed();
  geo.deleteAttribute('uv');
  geo.computeVertexNormals();

  const pos = geo.attributes.position, nrm = geo.attributes.normal, col = new Float32Array(pos.count * 3);
  const light = new THREE.Color(PAL.grassLight), dark = new THREE.Color(PAL.grassDark);
  const cl = new THREE.Color(PAL.cliffLight), cd = new THREE.Color(PAL.cliffDark);
  for (let i = 0; i < pos.count; i++) {
    if (nrm.getY(i) > 0.9) _c.copy(light).lerp(dark, clamp(Math.hypot(pos.getX(i) / 78, pos.getZ(i) / 24), 0, 1));
    else _c.copy(cl).lerp(cd, clamp(-pos.getY(i) / H, 0, 1));
    col.set([_c.r, _c.g, _c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  group.add(toonMesh(geo, toonMat({ vertexColors: true }), 0.12));
}

function buildLane(group) {
  const tile = new THREE.BoxGeometry(1.9, 0.08, 2.0);
  const cols = 62, rowZ = [-6.1, -4.0, -1.9, 1.9, 4.0, 6.1];
  const tiles = instanced(tile, toonMat(), cols * rowZ.length);
  const base = new THREE.Color(PAL.lane);
  let n = 0;
  for (let c = 0; c < cols; c++) {
    for (const z of rowZ) {
      place(tiles, n, -61 + c * 2, 0.04, z, 0, 1);
      tiles.setColorAt(n++, _c.copy(base).multiplyScalar(rand(0.9, 1.05)));
    }
  }
  group.add(tiles);

  // Center "starlane" row that pulses toward whichever side is winning.
  const glow = instanced(new THREE.BoxGeometry(1.5, 0.07, 1.3), new THREE.MeshBasicMaterial(), 60);
  for (let i = 0; i < 60; i++) { place(glow, i, -59 + i * 2, 0.065, 0, 0, 1); glow.setColorAt(i, _c.set(PAL.laneGlow)); }
  group.add(glow);
  return glow;
}

function buildProps(group) {
  const outside = () => side() * rand(10, 20);

  const treeGeo = mergeParts([
    { g: new THREE.CylinderGeometry(0.12, 0.17, 0.7, 6), c: 0x8A5A3C, p: [0, 0.35, 0] },
    { g: new THREE.ConeGeometry(0.8, 1.5, 7), c: 0x3FA050, p: [0, 1.4, 0] },
    { g: new THREE.ConeGeometry(0.58, 1.2, 7), c: 0x5CC060, p: [0, 2.2, 0] },
  ]);
  const trees = instanced(treeGeo, toonMat({ vertexColors: true }), 70);
  for (let i = 0; i < 70; i++) {
    place(trees, i, rand(-68, 68), 0, outside(), rand(0, 6), rand(0.8, 1.5));
    trees.setColorAt(i, _c.setScalar(rand(0.85, 1.15)));
  }
  group.add(trees);

  const shroomGeo = mergeParts([
    { g: new THREE.CylinderGeometry(0.1, 0.13, 0.4, 6), c: 0xFFF4E0, p: [0, 0.2, 0] },
    { g: new THREE.SphereGeometry(0.34, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), c: PAL.gloom, p: [0, 0.4, 0] },
  ]);
  const shrooms = instanced(shroomGeo, toonMat({ vertexColors: true }), 40);
  for (let i = 0; i < 40; i++) {
    place(shrooms, i, rand(-68, 68), 0, side() * rand(8.5, 16), rand(0, 6), rand(0.8, 1.6));
    shrooms.setColorAt(i, _c.setScalar(1));
  }
  group.add(shrooms);

  // Crystal clusters: 3 crystals around a shared spot.
  const crystals = instanced(new THREE.OctahedronGeometry(0.5).scale(0.6, 1.5, 0.6), toonMat({ emissive: 0x442266 }), 36);
  const tints = [PAL.shield, PAL.nebulaB, PAL.gold, 0xB7A4FF];
  let cx = 0, cz = 0;
  for (let i = 0; i < 36; i++) {
    if (i % 3 === 0) { cx = rand(-66, 66); cz = outside(); }
    place(crystals, i, cx + rand(-0.6, 0.6), 0.6, cz + rand(-0.6, 0.6), rand(0, 6), rand(0.7, 1.8));
    crystals.setColorAt(i, _c.set(tints[(i / 3 | 0) % tints.length]));
  }
  group.add(crystals);

  // Floating rocks drift and spin around the island.
  const rocks = instanced(new THREE.IcosahedronGeometry(1, 0), toonMat({ color: PAL.cliffLight }), 12);
  const rockData = Array.from({ length: 12 }, (_, i) => ({
    x: rand(-85, 85), y: rand(-8, 5), z: (i % 2 ? 1 : -1) * rand(28, 44), s: rand(1.2, 3.2), ph: rand(0, 6), sp: rand(0.1, 0.4),
  }));
  rockData.forEach((_, i) => rocks.setColorAt(i, _c.setScalar(rand(0.75, 1.1))));
  group.add(rocks);
  return { rocks, rockData };
}

export function createMap(scene, camera) {
  const group = new THREE.Group();
  scene.add(group);
  const nebula = buildSky(group);
  buildIsland(group);
  const glow = buildLane(group);
  const { rocks, rockData } = buildProps(group);
  const glowBase = new THREE.Color(PAL.laneGlow);
  const axis = new THREE.Vector3(0.3, 1, 0.2).normalize();
  let fly = 0;

  return {
    // push: -1 (enemy winning the lane) .. 1 (player winning); glow tiles pulse toward the winner.
    update(t, dt, push) {
      const dir = push >= 0 ? 1 : -1;
      for (let i = 0; i < 60; i++) {
        const b = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin((-59 + i * 2) * 0.3 - t * 4 * dir));
        glow.setColorAt(i, _c.copy(glowBase).multiplyScalar(b));
      }
      glow.instanceColor.needsUpdate = true;

      rockData.forEach((r, i) => {
        _p.set(r.x, r.y + Math.sin(t * 0.6 + r.ph) * 0.8, r.z);
        _q.setFromAxisAngle(axis, t * r.sp + r.ph);
        rocks.setMatrixAt(i, _m.compose(_p, _q, _s.set(r.s, r.s * 0.8, r.s)));
      });
      rocks.instanceMatrix.needsUpdate = true;

      for (const q of nebula) q.quaternion.copy(camera.quaternion);

      fly -= dt; // fireflies over the grass
      if (fly <= 0) {
        fly = 0.12;
        particles.emit(camera.position.x + rand(-25, 25), rand(0.6, 2), side() * rand(8.5, 18), rand(-0.2, 0.2), rand(0.1, 0.4), rand(-0.2, 0.2), PAL.laneGlow, 0.35, 3, FRAME.dot);
      }
    },
  };
}
