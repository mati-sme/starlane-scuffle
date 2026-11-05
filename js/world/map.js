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
// Smooth 2D value noise in [0, 1] and a 3-octave sum of it.
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, 0, iz), b = hash(ix + 1, 0, iz), c = hash(ix, 0, iz + 1), d = hash(ix + 1, 0, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}
const fbm = (x, z) => vnoise(x, z) * 0.55 + vnoise(x * 2.1 + 7, z * 2.1 + 3) * 0.3 + vnoise(x * 4.3 + 1, z * 4.3 + 9) * 0.15;

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
        map: tex, color, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
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

// Rounded-slab floating island: two cliff tiers, each stacked from rock strata with alternating insets and tones.
const ISLAND = { w: 196, d: 124, r: 22 };
function buildIsland(group) {
  const layer = (w, d, r, h, y) => new THREE.ExtrudeGeometry(roundRect(w, d, r), { depth: h, bevelEnabled: false, curveSegments: 6 })
    .rotateX(-Math.PI / 2).translate(0, y, 0).toNonIndexed();
  const strata = [];
  const tier = (w, d, r, top, bottom, insets) => {
    const h = (top - bottom) / insets.length;
    insets.forEach((k, i) => strata.push({ geo: layer(w - k * 2, d - k * 2, r - k, h, top - h * (i + 1)), top: top - h * i, h, i }));
  };
  tier(ISLAND.w, ISLAND.d, ISLAND.r, 0, -10, [0, 0.7, 0.3, 1.2]);
  tier(150, 86, 20, -10, -19, [0, 0.9, 0.4, 1.4]);
  const cap = new THREE.Color(PAL.grassDark), cl = new THREE.Color(PAL.cliffLight), cd = new THREE.Color(PAL.cliffDark), warm = new THREE.Color(0x6E6252);
  const geos = strata.map(({ geo, top, h, i }) => {
    geo.deleteAttribute('uv');
    geo.computeVertexNormals();
    const pos = geo.attributes.position, nrm = geo.attributes.normal, col = new Float32Array(pos.count * 3);
    for (let v = 0; v < pos.count; v++) {
      const y = pos.getY(v), x = pos.getX(v), z = pos.getZ(v);
      if (nrm.getY(v) > 0.9) _c.copy(y > -0.5 ? cap : cd).lerp(cl, y > -0.5 ? 0 : 0.25); // grass cap / rock ledges
      else {
        const depth = clamp(-y / 19, 0, 1), band = (top - y) / h; // band: 0 at a stratum's top edge, 1 at its bottom
        _c.copy(cl).lerp(warm, i % 2 ? 0.35 : 0).lerp(cd, depth * 0.75 + band * 0.18 + hash(x * 0.2, i, z * 0.2) * 0.1);
      }
      col.set([_c.r, _c.g, _c.b], v * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return geo;
  });
  group.add(toonMesh(mergeGeometries(geos), toonMat({ vertexColors: true }), 0.1));
}

// Grass field over the island top: indexed grid with fbm tint, worn dirt patches, darker jungle pockets and team base tints.
function buildGrass(group) {
  const { w, d, r } = ISLAND, step = 2, nx = w / step, nz = d / step;
  const geo = new THREE.PlaneGeometry(w, d, nx, nz).rotateX(-Math.PI / 2).translate(0, 0.006, 0);
  geo.deleteAttribute('uv');
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
  const gl = new THREE.Color(PAL.grassLight), gd = new THREE.Color(PAL.grassDark), dirt = new THREE.Color(0x5A5446), jungle = new THREE.Color(0x24382C), tint = new THREE.Color();
  const bases = [0, 1].map((team) => { const f = fountain(team); return { x: f.x + (team ? -6 : 6), col: new THREE.Color(TEAM[team].deep) }; });
  const inside = (x, z) => Math.hypot(Math.max(Math.abs(x) - (w / 2 - r), 0), Math.max(Math.abs(z) - (d / 2 - r), 0)) <= r;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), n = fbm(x * 0.06, z * 0.06);
    _c.copy(gd).lerp(gl, clamp(n * 1.5 - 0.2, 0, 1));
    _c.lerp(dirt, clamp((fbm(x * 0.11 + 40, z * 0.11) - 0.62) * 3, 0, 0.45));
    for (const b of POCKETS) {
      const e = Math.max(Math.abs(x - b.cx) - b.w / 2, Math.abs(z - b.cz) - b.d / 2);
      _c.lerp(jungle, clamp(1 - e / 3, 0, 1) * 0.55);
    }
    for (const b of bases) _c.lerp(tint.copy(b.col), clamp(1 - (Math.hypot(x - b.x, z) - 12) / 6, 0, 1) * 0.35);
    col.set([_c.r, _c.g, _c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const idx = geo.index.array, keep = []; // drop cells outside the rounded corners
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    if (inside(pos.getX(a), pos.getZ(a)) && inside(pos.getX(b), pos.getZ(b)) && inside(pos.getX(c), pos.getZ(c))) keep.push(a, b, c);
  }
  geo.setIndex(keep);
  geo.computeVertexNormals();
  group.add(new THREE.Mesh(geo, toonMat({ vertexColors: true })));
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

// Ground: flux channel, lanes laid as metal deck plates over a dark bed (the seams show through), fountain pads. One merged mesh.
function buildGround(group) {
  const W = MAP.laneW, dashes = [];
  for (const team of [0, 1]) {
    const f = fountain(team);
    flat(new THREE.CircleGeometry(ARENA.fountainR - 0.4, 24), 0.05, mix(0xB8C4CE, TEAM[team].main, 0.3), f.x, f.z);
    flat(new THREE.RingGeometry(ARENA.fountainR - 0.4, ARENA.fountainR + 0.3, 28), 0.06, PAL.gold, f.x, f.z);
  }
  rect(0, 0, 10, 112, 0.02, mix(PAL.lane, PAL.laneGlow, 0.14)); // flux channel
  for (const sx of [-1, 1]) rect(sx * 5.2, 0, 0.5, 112, 0.04, PAL.laneGlow);
  for (const lane of ARENA.lanes) {
    for (let i = 1; i < lane.length; i++) {
      const [x0, z0] = lane[i - 1], [x1, z1] = lane[i];
      strip(x0, z0, x1, z1, W + 1.2, 0.024, mix(PAL.lane, PAL.ink, 0.45));
      const len = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / len, uz = (z1 - z0) / len, plates = Math.max(1, Math.round(len / 4));
      for (let k = 0; k < plates; k++) { // two rows of plates with a center seam, each a touch lighter or darker
        const a = (k / plates) * len + 0.07, b = ((k + 1) / plates) * len - 0.07;
        for (const side of [-1, 1]) {
          const o = side * (W / 4), px = -uz * o, pz = ux * o;
          strip(x0 + ux * a + px, z0 + uz * a + pz, x0 + ux * b + px, z0 + uz * b + pz, W / 2 - 0.1, 0.03, mix(PAL.lane, hash(k, side, x0) > 0.5 ? 0xffffff : PAL.ink, hash(x0, k, side) * 0.1));
        }
      }
      for (const side of [-1, 1]) { // brushed-steel curbs
        const o = side * (W / 2 - 0.2), px = -uz * o, pz = ux * o;
        strip(x0 + px, z0 + pz, x1 + px, z1 + pz, 0.3, 0.036, mix(PAL.lane, 0xD8DEE6, 0.3));
      }
      const n = Math.floor(len / 3);
      for (let k = 0; k < n; k++) dashes.push((x0 + ((x1 - x0) * (k + 0.5)) / n), (z0 + ((z1 - z0) * (k + 0.5)) / n), Math.atan2(z1 - z0, x1 - x0));
    }
    for (const [x, z] of lane) flat(new THREE.CircleGeometry(W / 2 + 0.6, 14), 0.027, mix(PAL.lane, PAL.ink, 0.35), x, z), flat(new THREE.CircleGeometry(W / 2, 14), 0.028, PAL.lane, x, z); // under the plates: only fills the wedge gaps at bends
  }
  for (const b of BRUSH) rect(b.cx, b.cz, b.w, b.d, 0.045, 0x2C5A34);
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

// Cover: each collision AABB (arena.js) is dressed as a low barricade of cargo crates and boulders on a concrete slab,
// or, for the small ones, a rock pile / crate stack. Everything stays inside its footprint; two merged meshes.
function coverParts(b, i, rocks, crates) {
  const long = Math.max(b.w, b.d), thick = Math.min(b.w, b.d), alongX = b.w >= b.d, yaw = alongX ? 0 : Math.PI / 2;
  const h = (k) => hash(i, k, long);
  const at = (u, v) => (alongX ? [b.cx + u, b.cz + v] : [b.cx + v, b.cz + u]); // u along the long axis, v across it
  const slate = mix(PAL.cliffDark, PAL.cliffLight, 0.45), stone = (k) => mix(mix(PAL.cliffDark, PAL.cliffLight, 0.5 + h(k) * 0.45), 0x6E6252, h(k + 9) * 0.3);
  const boulder = (u, v, rx, ry, rz, k) => {
    const [x, z] = at(u, v);
    rocks.push({ g: new THREE.IcosahedronGeometry(1, 1), c: stone(k), p: [x, ry * 0.55, z], s: alongX ? [rx, ry, rz] : [rz, ry, rx], r: [h(k + 1) * 0.4, h(k + 2) * 6.28, h(k + 3) * 0.3] });
  };
  const crate = (u, v, size, ht, k, yawJit = 0.1) => {
    const [x, z] = at(u, v), j = (h(k) - 0.5) * yawJit, team = h(k + 5) > 0.5 ? 0x4A6274 : 0x6E5843;
    crates.push({ g: new THREE.BoxGeometry(size, ht, size), c: team, p: [x, ht / 2 + 0.3, z], r: [0, yaw + j, 0] });
    crates.push({ g: new THREE.BoxGeometry(size + 0.06, 0.16, size + 0.06), c: 0x3A3E46, p: [x, 0.3 + 0.1, z], r: [0, yaw + j, 0] }); // base trim
    crates.push({ g: new THREE.BoxGeometry(size + 0.06, 0.16, size + 0.06), c: 0x3A3E46, p: [x, ht + 0.22, z], r: [0, yaw + j, 0] }); // top trim
    crates.push({ g: new THREE.BoxGeometry(size + 0.04, ht - 0.3, 0.1), c: 0x5C626C, p: [x, ht / 2 + 0.3, z], r: [0, yaw + j + Math.PI / 4, 0] }); // corner straps
    crates.push({ g: new THREE.BoxGeometry(size * 0.5, 0.1, size + 0.1), c: PAL.laneGlow, p: [x, ht * 0.55 + 0.3, z], r: [0, yaw + j, 0] }); // glow band
  };

  if (long >= 3.5 * thick - 0.01 || long >= 5) { // barricade: slab + alternating crates and boulders along the run
    const [sx, sz] = at(0, 0);
    crates.push({ g: new THREE.BoxGeometry(alongX ? long - 0.1 : thick - 0.1, 0.6, alongX ? thick - 0.1 : long - 0.1), c: slate, p: [sx, 0.3, sz] });
    const n = Math.max(2, Math.round(long / 2.2)), step = long / n;
    for (let k = 0; k < n; k++) {
      const u = -long / 2 + step * (k + 0.5), kk = k * 11;
      if (k % 2 === 0 || h(kk) > 0.75) crate(u, 0, Math.min(step, thick) * 0.82, 1.1 + h(kk + 1) * 0.9, kk);
      else boulder(u, (h(kk + 2) - 0.5) * 0.2, step * 0.47, 0.9 + h(kk + 3) * 0.7, thick * 0.42, kk);
    }
  } else if (long > thick + 0.5 || long >= 3) { // small block: two crates with a boulder tucked beside
    crate(-long * 0.2, 0, Math.min(long * 0.5, thick) * 0.85, 1.4, 3);
    boulder(long * 0.25, 0, long * 0.24, 1.0, thick * 0.4, 7);
  } else { // square pillar-sized block: a rock pile
    boulder(0, 0, thick * 0.46, 1.5, thick * 0.46, 1);
    boulder(thick * 0.1, thick * 0.12, thick * 0.3, 1.1, thick * 0.3, 4);
  }
}

function buildCover(group) {
  const rocks = [], crates = [];
  COVER.forEach((b, i) => coverParts(b, i, rocks, crates));
  const mat = toonMat({ vertexColors: true });
  group.add(new THREE.Mesh(mergeParts(rocks), mat), toonMesh(mergeParts(crates), mat, 0.04));

  const spots = [];
  for (const b of BRUSH) for (let x = b.x0 + 0.7; x < b.x1; x += 1.3) for (let z = b.z0 + 0.7; z < b.z1; z += 1.3) spots.push([x + (hash(x, 1, z) - 0.5) * 0.5, z + (hash(z, 2, x) - 0.5) * 0.5]);
  const blade = mergeParts([ // a bush: three leaning blades around a round leafy core
    { g: new THREE.ConeGeometry(0.22, 1.9, 5), c: 0x3C7A45, p: [0, 0.95, 0] },
    { g: new THREE.ConeGeometry(0.2, 1.6, 5), c: 0x4C8A4C, p: [0.3, 0.8, 0.1], r: [0.1, 0, -0.35] },
    { g: new THREE.ConeGeometry(0.2, 1.5, 5), c: 0x356C3C, p: [-0.28, 0.75, -0.12], r: [-0.1, 0, 0.4] },
    { g: new THREE.IcosahedronGeometry(0.42, 1), c: 0x2A5A33, p: [0, 0.35, 0] },
  ]);
  const tufts = instanced(blade, toonMat({ vertexColors: true }), spots.length);
  spots.forEach(([x, z], i) => {
    place(tufts, i, x, 0, z, hash(x, 3, z) * 6, 0.8 + hash(z, 4, x) * 0.6);
    tufts.setColorAt(i, _c.setScalar(0.85 + hash(x, 5, z) * 0.3));
  });
  group.add(tufts);
}

function buildProps(group) {
  const free = (x, z) => !inCover(x, z) && !inBrush(x, z) && CAMP_SPOTS.every((c) => Math.hypot(c.x - x, c.z - z) > 5);

  const treeGeo = mergeParts([
    { g: new THREE.CylinderGeometry(0.1, 0.16, 0.9, 6), c: 0x5E4433, p: [0, 0.45, 0] },
    { g: new THREE.ConeGeometry(0.85, 1.5, 8), c: 0x2F5A3A, p: [0, 1.4, 0] },
    { g: new THREE.ConeGeometry(0.66, 1.3, 8), c: 0x3A6B43, p: [0, 2.1, 0] },
    { g: new THREE.ConeGeometry(0.44, 1.0, 8), c: 0x47784C, p: [0, 2.75, 0] },
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
  buildGrass(group);
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
