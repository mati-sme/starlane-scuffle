// Floating island, lane, props, sky, nebula, stars and planets.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL, TEAM, MAP, ARENA } from '../config.js';
import { COVER, BRUSH, POCKETS, CAMP_SPOTS, inCover, inBrush, fountain } from './arena.js';
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

function roundRect(w, d, r) {
  const x = w / 2, y = d / 2, sh = new THREE.Shape();
  sh.moveTo(-x + r, -y); sh.lineTo(x - r, -y); sh.quadraticCurveTo(x, -y, x, -y + r); sh.lineTo(x, y - r);
  sh.quadraticCurveTo(x, y, x - r, y); sh.lineTo(-x + r, y); sh.quadraticCurveTo(-x, y, -x, y - r); sh.lineTo(-x, -y + r);
  sh.quadraticCurveTo(-x, -y, -x + r, -y);
  return sh;
}

// Rounded-slab floating island: flat grass top, two stacked cliff tiers underneath.
function buildIsland(group) {
  const tier = (w, d, r, h, y) => new THREE.ExtrudeGeometry(roundRect(w, d, r), { depth: h, bevelEnabled: false, curveSegments: 5 })
    .rotateX(-Math.PI / 2).translate(0, y, 0).toNonIndexed();
  const parts = [tier(196, 124, 22, 10, -10), tier(150, 86, 20, 9, -19)];
  const geos = parts.map((geo) => {
    geo.deleteAttribute('uv');
    geo.computeVertexNormals();
    const pos = geo.attributes.position, nrm = geo.attributes.normal, col = new Float32Array(pos.count * 3);
    const light = new THREE.Color(PAL.grassLight), cl = new THREE.Color(PAL.cliffLight), cd = new THREE.Color(PAL.cliffDark);
    for (let i = 0; i < pos.count; i++) {
      if (nrm.getY(i) > 0.9) _c.copy(nrm.getY(i) > 0.9 && pos.getY(i) > -0.5 ? light : cd);
      else _c.copy(cl).lerp(cd, clamp(-pos.getY(i) / 19, 0, 1) * 0.9 + hash(pos.getX(i) * 0.1, 0, pos.getZ(i) * 0.1) * 0.1);
      col.set([_c.r, _c.g, _c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return geo;
  });
  group.add(toonMesh(mergeGeometries(geos), toonMat({ vertexColors: true }), 0.12));
}

// Flat decal geometry (y fixed) with a vertex color; everything ground-level is merged into one mesh.
const flats = [];
function flat(geo, y, color, x = 0, z = 0) {
  const g = geo.rotateX(-Math.PI / 2).translate(x, y, z).toNonIndexed();
  g.deleteAttribute('uv');
  const col = new Float32Array(g.attributes.position.count * 3), c = new THREE.Color(color);
  for (let i = 0; i < col.length; i += 3) col.set([c.r, c.g, c.b], i);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  flats.push(g);
}
const rect = (cx, cz, w, d, y, color) => flat(new THREE.PlaneGeometry(w, d), y, color, cx, cz);
const mix = (a, b, k) => new THREE.Color(a).lerp(new THREE.Color(b), k).getHex();

function strip(x0, z0, x1, z1, w, y, color) { // ribbon between two lane waypoints
  const len = Math.hypot(x1 - x0, z1 - z0), g = new THREE.PlaneGeometry(len, w).rotateX(-Math.PI / 2).rotateY(-Math.atan2(z1 - z0, x1 - x0));
  g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  const ng = g.toNonIndexed();
  ng.deleteAttribute('uv');
  const col = new Float32Array(ng.attributes.position.count * 3), c = new THREE.Color(color);
  for (let i = 0; i < col.length; i += 3) col.set([c.r, c.g, c.b], i);
  ng.setAttribute('color', new THREE.BufferAttribute(col, 3));
  flats.push(ng);
}

// Ground: jungle pockets, team-tinted bases, flux channel, paved lanes with fountain pads. One merged mesh.
function buildGround(group) {
  const W = MAP.laneW, dashes = [];
  for (const b of POCKETS) rect(b.cx, b.cz, b.w, b.d, 0.012, mix(PAL.grassDark, 0x2E6B4A, 0.45));
  for (const team of [0, 1]) {
    const f = fountain(team), sx = team ? -1 : 1;
    flat(new THREE.CircleGeometry(17, 28), 0.016, mix(PAL.grassLight, TEAM[team].deep, 0.5), f.x + sx * 6, 0);
    flat(new THREE.CircleGeometry(ARENA.fountainR - 0.4, 24), 0.05, mix(0xE6F4FF, TEAM[team].main, 0.35), f.x, f.z);
    flat(new THREE.RingGeometry(ARENA.fountainR - 0.4, ARENA.fountainR + 0.3, 28), 0.06, PAL.gold, f.x, f.z);
  }
  rect(0, 0, 10, 112, 0.02, mix(PAL.lane, 0x7FE0FF, 0.18)); // flux channel
  for (const sx of [-1, 1]) rect(sx * 5.2, 0, 0.5, 112, 0.04, PAL.laneGlow);
  for (const lane of ARENA.lanes) {
    for (let i = 1; i < lane.length; i++) {
      const [x0, z0] = lane[i - 1], [x1, z1] = lane[i];
      strip(x0, z0, x1, z1, W + 1.2, 0.024, mix(PAL.lane, PAL.ink, 0.35));
      strip(x0, z0, x1, z1, W, 0.03, PAL.lane);
      const len = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(len / 3);
      for (let k = 0; k < n; k++) dashes.push((x0 + ((x1 - x0) * (k + 0.5)) / n), (z0 + ((z1 - z0) * (k + 0.5)) / n), Math.atan2(z1 - z0, x1 - x0));
    }
    for (const [x, z] of lane) flat(new THREE.CircleGeometry(W / 2 + 0.6, 14), 0.027, mix(PAL.lane, PAL.ink, 0.35), x, z), flat(new THREE.CircleGeometry(W / 2, 14), 0.032, PAL.lane, x, z);
  }
  for (const b of BRUSH) rect(b.cx, b.cz, b.w, b.d, 0.045, 0x2C7A3E);
  group.add(new THREE.Mesh(mergeGeometries(flats), toonMat({ vertexColors: true })));

  const glow = instanced(new THREE.BoxGeometry(1.5, 0.06, 0.5), new THREE.MeshBasicMaterial(), dashes.length / 3);
  for (let i = 0; i < dashes.length / 3; i++) {
    place(glow, i, dashes[i * 3], 0.07, dashes[i * 3 + 1], -dashes[i * 3 + 2], 1);
    glow.setColorAt(i, _c.set(PAL.laneGlow));
  }
  glow.userData.xs = Float32Array.from({ length: dashes.length / 3 }, (_, i) => dashes[i * 3]);
  group.add(glow);
  return glow;
}

// Cover blocks (collision AABBs in arena.js) and brush tufts, each one instanced draw.
function buildCover(group) {
  const blocks = instanced(new THREE.BoxGeometry(1, 1, 1), toonMat(), COVER.length);
  COVER.forEach((b, i) => {
    const h = 1.8 + ((i * 7) % 3) * 0.3;
    blocks.setMatrixAt(i, _m.compose(_p.set(b.cx, h / 2, b.cz), _q.identity(), _s.set(b.w, h, b.d)));
    blocks.setColorAt(i, _c.set(PAL.cliffLight).multiplyScalar(0.9 + (i % 3) * 0.08));
  });
  group.add(blocks);

  const spots = [];
  for (const b of BRUSH) for (let x = b.x0 + 0.7; x < b.x1; x += 1.3) for (let z = b.z0 + 0.7; z < b.z1; z += 1.3) spots.push([x + (hash(x, 1, z) - 0.5) * 0.5, z + (hash(z, 2, x) - 0.5) * 0.5]);
  const tufts = instanced(new THREE.ConeGeometry(0.55, 1.5, 5), toonMat(), spots.length);
  spots.forEach(([x, z], i) => {
    place(tufts, i, x, 0.7, z, hash(x, 3, z) * 6, 0.8 + hash(z, 4, x) * 0.5);
    tufts.setColorAt(i, _c.set(hash(x, 5, z) > 0.5 ? 0x3FB04F : 0x2E9A4A));
  });
  group.add(tufts);
}

function buildProps(group) {
  const free = (x, z) => !inCover(x, z) && !inBrush(x, z) && CAMP_SPOTS.every((c) => Math.hypot(c.x - x, c.z - z) > 5);

  const treeGeo = mergeParts([
    { g: new THREE.CylinderGeometry(0.12, 0.17, 0.7, 6), c: 0x8A5A3C, p: [0, 0.35, 0] },
    { g: new THREE.ConeGeometry(0.8, 1.5, 7), c: 0x3FA050, p: [0, 1.4, 0] },
    { g: new THREE.ConeGeometry(0.58, 1.2, 7), c: 0x5CC060, p: [0, 2.2, 0] },
  ]);
  const N = 64, trees = instanced(treeGeo, toonMat({ vertexColors: true }), N);
  for (let i = 0; i < N; i++) { // along the north / south rim and behind each base
    const rim = i < 48, sx = i % 2 ? 1 : -1;
    place(trees, i, rim ? rand(-90, 90) : sx * rand(88, 94), 0, rim ? sx * rand(47, 56) : rand(-40, 40), rand(0, 6), rand(1, 1.6));
    trees.setColorAt(i, _c.setScalar(rand(0.85, 1.15)));
  }
  group.add(trees);

  const shroomGeo = mergeParts([
    { g: new THREE.CylinderGeometry(0.1, 0.13, 0.4, 6), c: 0xFFF4E0, p: [0, 0.2, 0] },
    { g: new THREE.SphereGeometry(0.34, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), c: PAL.gloom, p: [0, 0.4, 0] },
  ]);
  const shrooms = instanced(shroomGeo, toonMat({ vertexColors: true }), 40);
  const crystals = instanced(new THREE.OctahedronGeometry(0.5).scale(0.6, 1.5, 0.6), toonMat({ emissive: 0x442266 }), 24);
  const tints = [PAL.shield, PAL.nebulaB, PAL.gold, 0xB7A4FF];
  const scatter = (mesh, n, fn) => {
    for (let i = 0; i < n; i++) {
      let x, z, tries = 0;
      do { const b = POCKETS[(Math.random() * POCKETS.length) | 0]; x = b.cx + rand(-b.w / 2, b.w / 2); z = b.cz + rand(-b.d / 2, b.d / 2); } while (!free(x, z) && ++tries < 20);
      fn(i, x, z);
    }
  };
  scatter(shrooms, 40, (i, x, z) => { place(shrooms, i, x, 0, z, rand(0, 6), rand(0.8, 1.6)); shrooms.setColorAt(i, _c.setScalar(1)); });
  scatter(crystals, 24, (i, x, z) => { place(crystals, i, x, 0.6, z, rand(0, 6), rand(0.7, 1.6)); crystals.setColorAt(i, _c.set(tints[i % tints.length])); });
  group.add(shrooms, crystals);

  // Floating rocks drift and spin around the island.
  const rocks = instanced(new THREE.IcosahedronGeometry(1, 0), toonMat({ color: PAL.cliffLight }), 12);
  const rockData = Array.from({ length: 12 }, (_, i) => ({
    x: rand(-100, 100), y: rand(-8, 5), z: (i % 2 ? 1 : -1) * rand(66, 90), s: rand(1.2, 3.2), ph: rand(0, 6), sp: rand(0.1, 0.4),
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
  const glow = buildGround(group);
  buildCover(group);
  const { rocks, rockData } = buildProps(group);
  const glowBase = new THREE.Color(PAL.laneGlow);
  const axis = new THREE.Vector3(0.3, 1, 0.2).normalize();
  const xs = glow.userData.xs;
  let fly = 0;

  return {
    // push: -1 (enemy winning the lane) .. 1 (player winning); glow tiles pulse toward the winner.
    update(t, dt, push) {
      const dir = push >= 0 ? 1 : -1;
      for (let i = 0; i < xs.length; i++) {
        const b = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(xs[i] * 0.3 - t * 4 * dir));
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
        particles.emit(camera.position.x + rand(-25, 25), rand(0.6, 2), camera.position.z - 16 + rand(-14, 14), rand(-0.2, 0.2), rand(0.1, 0.4), rand(-0.2, 0.2), PAL.laneGlow, 0.35, 3, FRAME.dot);
      }
    },
  };
}
