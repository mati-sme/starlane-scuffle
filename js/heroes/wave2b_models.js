// Bespoke champion models for wave 2 batch B (wave2b.js; models.js delegates when spec.wave === 'b').
// Adult proportions instead of the chunky shared rig: longer legs, smaller heads (~1/7 of the height), real forearms
// and hands, and parts authored per champion (no shared helmet / weapon library), so every silhouette is its own.
// Returns the same handle set as buildChampion plus `gait` (hero.js STYLE override) and `anim` (per-frame flourish:
// a spinning ship's wheel, an opening parasol, a breathing mushroom cap...). Limbs are drawn as capsules between joints.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TEAM } from '../config.js';
import { toonMat, toonMesh, mergeParts } from '../render/toon.js';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const RBOX = new RoundedBoxGeometry(1, 1, 1, 1, 0.16);
const TAPER = new THREE.CylinderGeometry(0.62, 0.42, 1, 8).rotateY(Math.PI / 8);
const BELL = new THREE.CylinderGeometry(0.22, 0.5, 1, 12, 1, true);
const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
const CYL6 = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
const CONE = new THREE.ConeGeometry(0.5, 1, 10);
const CONE4 = new THREE.ConeGeometry(0.5, 1, 4);
const OCT = new THREE.OctahedronGeometry(0.5);
const ICO = new THREE.IcosahedronGeometry(0.5, 0);
const SPH = new THREE.SphereGeometry(0.5, 12, 8);
const DOME = new THREE.SphereGeometry(0.5, 14, 5, 0, Math.PI * 2, 0, Math.PI / 2);
const CAP = new THREE.CapsuleGeometry(0.5, 1, 3, 8);
const RING = new THREE.TorusGeometry(0.5, 0.07, 5, 18);
const TORUS = new THREE.TorusGeometry(0.5, 0.2, 6, 14);
const WHEEL = new THREE.TorusGeometry(0.5, 0.05, 4, 20);

const DARK = 0x1C2029, TRIM = 0xB4BAC4, BRASS = 0xC9963A, WOOD = 0x6A4A30, ROPE = 0xC9B48A;
const shade = (c, k) => new THREE.Color(c).multiplyScalar(k).getHex();
const tint = (c, to, k) => new THREE.Color(c).lerp(new THREE.Color(to), k).getHex();
const ground = (c, k) => { const col = new THREE.Color(c), l = col.r * 0.3 + col.g * 0.59 + col.b * 0.11; return col.lerp(new THREE.Color(l, l, l), k).getHex(); };

const part = (g, c, p, s = 1, r, f = 'paint') => ({ g, c, p, s, r, f });
const metal = (g, c, p, s, r) => part(g, c, p, s, r, 'metal');
const cloth = (g, c, p, s, r) => part(g, c, p, s, r, 'cloth');
const glow = (g, c, p, s, r) => part(g, c, p, s, r, 'glow');
const rubber = (g, c, p, s, r) => part(g, c, p, s, r, 'rubber');
const glass = (g, c, p, s, r) => part(g, c, p, s, r, 'glass');
const stone = (g, c, p, s, r) => part(g, c, p, s, r, 'stone');
const both = (fn) => [...fn(-1), ...fn(1)];
const ring = (n, fn) => Array.from({ length: n }, (_, k) => fn(k, (k / n) * Math.PI * 2));

// A limb / strap / rod between two joints: capsule (or any y-aligned unit geometry) stretched from a to b.
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _Y = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3();
function seg(a, b, r, c, f = 'paint', g = CAP) {
  _d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const L = _d.length() || 0.001, [rx, rz] = Array.isArray(r) ? r : [r, r];
  _e.setFromQuaternion(_q.setFromUnitVectors(_Y, _d.normalize()));
  return { g, c, f, p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], s: [rx * 2, g === CAP ? L / 2 : L, rz * 2], r: [_e.x, _e.y, _e.z] };
}

// ── shared anatomy (every champion still dresses it differently) ──
// Arm in the shoulder group's space: shoulder at the origin, hanging down, hand around y = -1.06.
function arm(o) {
  const r = o.r ?? 0.12, fr = o.fr ?? r * 0.95;
  return [
    part(SPH, o.sh ?? o.up, [0, 0, 0], r * 2.1, undefined, o.shF ?? 'paint'),
    seg([0, -0.04, 0], [0, -0.5, 0.02], r, o.up, o.upF ?? 'cloth'),
    rubber(SPH, o.elbow ?? DARK, [0, -0.52, 0.03], r * 1.8),
    seg([0, -0.56, 0.04], [0, -0.96, 0.07], [fr, fr * 1.05], o.fore, o.foreF ?? 'paint'),
    part(RBOX, o.hand ?? o.fore, [0, -1.06, 0.08], [r * 1.5, r * 1.6, r * 1.6], undefined, o.handF ?? 'rubber'),
  ];
}
// Plantigrade leg in the hip group's space (hip joint at the origin, sole at y = -hip).
function leg(H, o) {
  const r = o.r ?? 0.14;
  return [
    seg([0, -0.02, 0], [0, -H * 0.48, 0.04], [r * 1.1, r * 1.15], o.thigh, o.thighF ?? 'cloth'),
    part(SPH, o.knee ?? DARK, [0, -H * 0.5, 0.07], r * 1.7, undefined, o.kneeF ?? 'rubber'),
    seg([0, -H * 0.53, 0.04], [0, -H + 0.2, 0], [r * 0.95, r], o.shin, o.shinF ?? 'paint'),
    part(RBOX, o.boot ?? DARK, [0, -H + 0.09, 0.07], [r * 2.1, 0.18, r * 3.3], undefined, o.bootF ?? 'rubber'),
  ];
}
// Digitigrade leg (lizard / cat): thigh forward, shin back, long foot bone, paw.
function digiLeg(H, o) {
  const r = o.r ?? 0.14, k = [0, -H * 0.38, 0.2], a = [0, -H * 0.78, -0.16], p = [0, -H + 0.08, 0.06];
  return [
    seg([0, 0, 0], k, [r * 1.25, r * 1.3], o.thigh, o.thighF),
    part(SPH, o.knee ?? o.thigh, k, r * 1.9),
    seg(k, a, r * 0.95, o.shin, o.shinF),
    seg(a, p, r * 0.8, o.shin, o.shinF),
    part(SPH, o.paw ?? o.shin, [0, -H + 0.08, 0.14], [r * 2.4, r * 1.3, r * 2.8], undefined, 'rubber'),
    ...[-1, 0, 1].map((t) => part(CONE4, o.claw ?? 0xE8E2D0, [t * r * 0.7, -H + 0.08, 0.14 + r * 1.5], [0.06, 0.16, 0.06], [Math.PI / 2, 0, 0])),
  ];
}
// Head base: skull + jaw, centred on (0, hy, hz) with diameter s.
const skull = (hy, hz, s, c, f = 'paint') => [part(SPH, c, [0, hy, hz], [s, s * 1.08, s * 1.05], undefined, f), part(RBOX, shade(c, 0.9), [0, hy - s * 0.32, hz + s * 0.1], [s * 0.62, s * 0.36, s * 0.7], undefined, f)];

// ───────────── champions ─────────────
// Each builder gets c = { hip, tw, th, td, top, hy, hz, hs, ax, main, acc, gl, fx } and returns
// { body, eyes(vc), arms: [weapon side, off side], leg, legDigi, skirt, tail, tailAt, halo, extra, anim }.
// Eyes are authored relative to (0, hy, 0) so the blink can squash them.
const BODIES = {
  basilisk: {
    plan: { hip: 1.1, tw: 1.3, th: 1.0, td: 0.95, hs: 0.5, neck: 0.18, hunch: 0.3, ax: 0.86, legX: 0.36, armR: 0.17 },
    gait: { cad: 0.75, swing: 0.7, bob: 0.1, lean: 0.3, float: 0, sq: 0.06, sway: 0.14 },
    build(c) {
      const { hip, tw, th, td, top, hy, hz, main, acc, gl } = c, belly = 0xCFC08E, crys = tint(acc, 0xffffff, 0.15), mid = hip + th * 0.5;
      const shard = (p, s, r, k = 0) => glass(OCT, k % 2 ? crys : acc, p, s, r);
      return {
        body: [
          part(RBOX, shade(main, 0.8), [0, hip + 0.05, 0], [tw * 0.8, 0.34, td * 0.9]),
          part(SPH, main, [0, mid + 0.12, 0.12], [tw, th * 1.05, td * 1.1], [0.3, 0, 0]),
          ...[0, 1, 2, 3].map((k) => part(RBOX, belly, [0, hip + 0.22 + k * 0.2, td * 0.46 + k * 0.06], [tw * (0.52 - k * 0.04), 0.16, 0.14], [0.3, 0, 0])),
          ...both((sx) => [part(SPH, shade(main, 1.1), [sx * tw * 0.42, top - 0.08, 0.1], [0.62, 0.5, 0.66])]),
          ...both((sx) => [shard([sx * tw * 0.5, top + 0.22, 0.02], [0.24, 0.62, 0.24], [0, 0, sx * -0.5], 0), shard([sx * tw * 0.6, top + 0.05, -0.18], [0.16, 0.42, 0.16], [0.3, 0, sx * -0.9], 1), shard([sx * tw * 0.32, top + 0.18, -0.2], [0.14, 0.36, 0.14], [-0.3, 0, sx * -0.2], 1)]),
          ...[0, 1, 2, 3, 4].map((k) => shard([0, top + 0.1 - k * 0.22, -0.3 - k * 0.1], [0.2 - k * 0.02, 0.52 - k * 0.05, 0.2 - k * 0.02], [-0.6, 0, 0], k)),
          seg([0, top - 0.06, 0.2], [0, hy - 0.1, hz - 0.12], 0.24, main), // thick neck
          // wedge snout head with a crystal frill
          part(RBOX, main, [0, hy, hz], [0.48, 0.4, 0.56]), part(RBOX, shade(main, 1.08), [0, hy - 0.04, hz + 0.36], [0.38, 0.28, 0.5], [0.1, 0, 0]),
          part(RBOX, belly, [0, hy - 0.2, hz + 0.24], [0.36, 0.12, 0.62], [0.08, 0, 0]),
          ...both((sx) => [part(SPH, shade(main, 1.15), [sx * 0.2, hy + 0.12, hz + 0.08], [0.16, 0.14, 0.2]), part(CONE4, belly, [sx * 0.12, hy - 0.16, hz + 0.56], [0.05, 0.1, 0.05], [Math.PI, 0, 0])]),
          glow(OCT, gl, [0, hy + 0.2, hz + 0.24], [0.1, 0.14, 0.06]),
          // belt of crystal studs
          ...ring(6, (k, a) => shard([Math.sin(a) * tw * 0.42, hip + 0.18, Math.cos(a) * td * 0.48], 0.12, [0, a, 0], k)),
        ],
        eyes: (vc) => both((sx) => [part(RBOX, vc, [sx * 0.22, 0.08, hz + 0.16], [0.05, 0.11, 0.1], [0, sx * 0.6, 0])]),
        arms: [
          [...arm({ r: 0.17, up: main, fore: main, hand: shade(main, 0.8), sh: shade(main, 1.1) }), // weapon side: geode-encrusted forearm
            ...ring(6, (k, a) => shard([Math.cos(a) * 0.2, -0.78 + Math.sin(a) * 0.14, 0.12 + (k % 2) * 0.08], [0.18, 0.38, 0.18], [Math.sin(a) * 0.8, 0, -Math.cos(a) * 0.9], k)),
            shard([0, -1.2, 0.2], [0.36, 0.56, 0.36], [0.4, 0, 0], 0), glow(OCT, gl, [0, -1.2, 0.24], [0.16, 0.26, 0.16])],
          [...arm({ r: 0.16, up: main, fore: main, hand: shade(main, 0.8), sh: shade(main, 1.1) }),
            ...[-1, 0, 1].map((t) => part(CONE4, 0xE8E2D0, [t * 0.08, -1.2, 0.18], [0.06, 0.2, 0.06], [2.6, 0, 0])), shard([0, -0.7, -0.14], [0.14, 0.3, 0.14], [-0.6, 0, 0], 1)],
        ],
        legDigi: { r: 0.17, thigh: main, shin: shade(main, 0.9), paw: shade(main, 0.75) },
        skirt: [...[-1, 0, 1].map((k) => part(RBOX, k ? shade(main, 0.9) : belly, [k * 0.34, -0.2, 0.04], [0.32, 0.36, 0.08], [0.15, k * -0.3, 0]))],
        tailAt: [0, hip + 0.1, -td * 0.42],
        tail: [ // long tapering tail with a crystal club tip
          ...[0, 1, 2, 3, 4].map((k) => part(SPH, k % 2 ? shade(main, 0.9) : main, [0, -0.14 - k * 0.14, -0.3 - k * 0.38], [0.5 - k * 0.07, 0.42 - k * 0.06, 0.62 - k * 0.06])),
          ...[0, 1, 2].map((k) => shard([0, 0.1 - k * 0.14, -0.4 - k * 0.45], [0.12, 0.3, 0.12], [-0.7, 0, 0], k)),
          shard([0, -0.8, -2.2], [0.34, 0.5, 0.34], [-1.2, 0, 0], 0), glow(OCT, gl, [0, -0.8, -2.24], [0.14, 0.22, 0.14]),
        ],
        extra: [{ name: 'frill', parent: 'lean', at: [0, hy + 0.08, hz - 0.2], parts: ring(5, (k) => { const a = (k - 2) * 0.42; return shard([Math.sin(a) * 0.32, 0.1 + Math.cos(a) * 0.2, -0.08], [0.12, 0.5 - Math.abs(k - 2) * 0.08, 0.06], [-0.5, 0, -a], k); }) }],
      };
    },
    // The crystal frill flares while a skill charges; the head sways side to side like a lizard tasting the air.
    anim(m, t, dt, h) {
      const f = m.x.frill, k = Math.max(h.charge, h.castT);
      f.scale.setScalar(1 + 0.5 * k + Math.sin(t * 3) * 0.04);
      f.rotation.x = -0.3 * k;
      m.lean.rotation.z += Math.sin(t * 1.3) * 0.03 * (1 - h.moveAmt);
    },
  },

  keel: {
    plan: { hip: 1.2, tw: 1.4, th: 1.15, td: 0.95, hs: 0.42, neck: 0.04, ax: 0.94, legX: 0.36, armR: 0.17 },
    gait: { cad: 0.7, swing: 0.55, bob: 0.14, lean: 0.08, float: 0, sq: 0.08, sway: 0.24 },
    build(c) {
      const { hip, tw, th, td, top, hy, hz, main, acc, gl } = c, hull = 0x8A2E2A, mid = hip + th * 0.5;
      const rivets = (y, w, z) => ring(7, (k) => metal(SPH, acc, [(k - 3) * w / 7, y, z], 0.07));
      return {
        body: [
          rubber(RBOX, DARK, [0, hip + 0.04, 0], [tw * 0.78, 0.3, td * 0.8]),
          // the prow: a diamond-section hull whose keel edge points forward
          part(RBOX, main, [0, mid + 0.12, 0.06], [tw * 0.72, th * 0.95, tw * 0.72], [0, Math.PI / 4, 0]),
          part(RBOX, hull, [0, hip + 0.3, 0.06], [tw * 0.66, 0.4, tw * 0.66], [0, Math.PI / 4, 0]),
          metal(BOX, acc, [0, mid + 0.12, tw * 0.5], [0.12, th * 0.95, 0.12]), // brass ram along the keel edge
          metal(CONE4, acc, [0, hip + 0.06, tw * 0.5], [0.16, 0.3, 0.16], [Math.PI, 0, 0]),
          ...both((sx) => [...rivets(mid + 0.4, 0.5, 0).map((q) => ({ ...q, p: [q.p[0] * 0.5 + sx * 0.3, q.p[1], tw * 0.33 - Math.abs(q.p[0]) * 0.6] }))]),
          metal(RING, acc, [0.3, mid + 0.1, tw * 0.33], [0.36, 0.36, 0.5], [0, Math.PI / 4, 0]), glass(CYL, 0x9FE6F0, [0.3, mid + 0.1, tw * 0.33], [0.3, 0.04, 0.3], [Math.PI / 2, Math.PI / 4, 0]),
          // gunwale collar and bell-shaped iron helm sunk into it
          metal(CYL, acc, [0, top - 0.02, 0], [tw * 0.86, 0.12, td * 0.9]), metal(CYL, shade(main, 0.8), [0, top + 0.06, 0], [tw * 0.8, 0.1, td * 0.84]),
          ...both((sx) => [metal(CYL, shade(main, 1.1), [sx * (tw * 0.5 + 0.08), top - 0.08, 0], [0.58, 0.32, 0.58], [0, 0, sx * -0.35]), metal(CYL, acc, [sx * (tw * 0.5 + 0.14), top - 0.24, 0], [0.62, 0.06, 0.62], [0, 0, sx * -0.35])]),
          part(CYL, main, [0, hy, hz], [0.5, 0.56, 0.5]), part(DOME, main, [0, hy + 0.28, hz], [0.5, 0.26, 0.5]), metal(CYL, acc, [0, hy - 0.26, hz], [0.56, 0.06, 0.56]),
          metal(RING, acc, [0, hy, hz + 0.25], [0.34, 0.34, 0.6]), glass(CYL, 0x0E2230, [0, hy, hz + 0.26], [0.3, 0.03, 0.3], [Math.PI / 2, 0, 0]),
          ...both((sx) => [metal(CYL, acc, [sx * 0.26, hy, hz], [0.16, 0.08, 0.16], [0, 0, Math.PI / 2])]),
          metal(CYL, TRIM, [0, hy + 0.44, hz], [0.08, 0.14, 0.08]), glow(SPH, gl, [0, hy + 0.52, hz], 0.1), // masthead lamp
          // anchor chain draped across the chest
          ...ring(8, (k) => metal(RING, TRIM, [-tw * 0.4 + k * tw * 0.11, top - 0.1 - Math.sin((k / 7) * Math.PI) * 0.45, tw * 0.3 - Math.abs(k - 3.5) * 0.03], [0.2, 0.2, 0.2], [k % 2 ? 0 : Math.PI / 2, 0.6, 0])),
        ],
        eyes: (vc) => [part(RBOX, vc, [-0.08, 0.02, hz + 0.27], [0.1, 0.06, 0.04]), part(RBOX, vc, [0.08, 0.02, hz + 0.27], [0.1, 0.06, 0.04])],
        arms: [
          [...arm({ r: 0.18, up: shade(main, 0.9), fore: main, hand: shade(main, 0.7), sh: main, foreF: 'metal' }),
            metal(CYL, acc, [0, -0.8, 0.08], [0.42, 0.08, 0.42]),
            // anchor gripped by the shank, flukes down by the boots
            metal(CYL, shade(main, 0.75), [0, -0.9, 0.42], [0.13, 1.7, 0.13], [-0.25, 0, 0]), metal(RING, acc, [0, -0.08, 0.64], [0.34, 0.34, 0.34], [0, Math.PI / 2, 0]),
            metal(BOX, shade(main, 0.75), [0, -0.3, 0.6], [0.8, 0.1, 0.12], [-0.25, 0, 0]),
            ...both((sx) => [metal(CYL, shade(main, 0.75), [sx * 0.3, -1.66, 0.2], [0.12, 0.72, 0.12], [0, 0, sx * 1.1]), metal(CONE4, acc, [sx * 0.62, -1.42, 0.16], [0.26, 0.36, 0.1], [0, 0, sx * -0.4])]),
            glow(OCT, gl, [0, -1.75, 0.22], [0.14, 0.14, 0.14])],
          [...arm({ r: 0.18, up: shade(main, 0.9), fore: main, hand: shade(main, 0.7), sh: main, foreF: 'metal' }),
            ...[0, 1, 2].map((k) => part(TORUS, ROPE, [0, -0.66 - k * 0.1, 0.06], [0.36, 0.36, 0.3], [Math.PI / 2, 0, 0], 'cloth')), metal(RBOX, acc, [0, -1.1, 0.16], [0.3, 0.12, 0.3])],
        ],
        leg: { r: 0.19, thigh: shade(main, 0.85), shin: main, shinF: 'metal', boot: shade(main, 0.6), knee: acc, kneeF: 'metal' },
        legExtra: (H) => [metal(RBOX, acc, [0, -H + 0.12, 0.26], [0.36, 0.14, 0.12]), ...[0.3, 0.55].map((f) => metal(CYL, acc, [0, -H * f - 0.2, 0.04], [0.42, 0.05, 0.42]))],
        skirt: [...[-1, 0, 1].map((k) => part(RBOX, WOOD, [k * 0.38, -0.24, 0.02 - Math.abs(k) * 0.08], [0.36, 0.44, 0.08], [0.12, k * -0.35, 0], 'stone')), ...[-1, 0, 1].map((k) => metal(BOX, acc, [k * 0.38, -0.42, 0.06 - Math.abs(k) * 0.08], [0.36, 0.04, 0.06], [0.12, k * -0.35, 0]))],
        extra: [{ // ship's wheel on the back
          name: 'wheel', parent: 'lean', at: [0, mid + 0.25, -td * 0.62],
          parts: [part(WHEEL, WOOD, [0, 0, 0], [1.5, 1.5, 4], undefined, 'stone'), part(WHEEL, WOOD, [0, 0, 0], [1.2, 1.2, 4], undefined, 'stone'), metal(CYL, acc, [0, 0, 0], [0.26, 0.14, 0.26], [Math.PI / 2, 0, 0]),
            ...ring(8, (k, a) => part(CYL, WOOD, [Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0], [0.07, 1.0, 0.07], [0, 0, a + Math.PI / 2], 'stone')),
            ...ring(8, (k, a) => part(SPH, shade(WOOD, 1.2), [Math.cos(a) * 0.98, Math.sin(a) * 0.98, 0], [0.1, 0.1, 0.1], undefined, 'stone')), glow(CYL, gl, [0, 0, -0.08], [0.12, 0.02, 0.12], [Math.PI / 2, 0, 0])],
        }],
      };
    },
    // The wheel creaks round at rest and spins while Keel rolls forward; casts give it a hard turn.
    anim(m, t, dt, h) {
      h._wheel = (h._wheel ?? 0) + dt * (0.4 + h.moveAmt * 3 + h.castT * 8);
      m.x.wheel.rotation.z = h._wheel;
    },
  },

  anvil: {
    plan: { hip: 1.2, tw: 1.22, th: 1.08, td: 0.78, hs: 0.44, neck: 0.1, ax: 0.88, legX: 0.3, armR: 0.17 },
    gait: { cad: 0.9, swing: 0.85, bob: 0.16, lean: 0.18, float: 0, sq: 0.1 },
    build(c) {
      const { hip, tw, th, td, top, hy, hz, main, acc, gl } = c, leather = 0x6B4A2E, shirt = 0x8A8F99, skin = 0xB07A55, mid = hip + th * 0.5;
      return {
        body: [
          rubber(RBOX, DARK, [0, hip + 0.04, 0], [tw * 0.74, 0.28, td * 0.8]), metal(CYL, acc, [0, hip + 0.1, 0], [tw * 0.78, 0.08, td * 0.88]),
          cloth(SPH, shirt, [0, mid + 0.1, 0], [tw, th * 1.05, td * 1.1]), // barrel chest in a grey work shirt
          part(RBOX, leather, [0, mid + 0.02, td * 0.5], [tw * 0.6, th * 0.8, 0.08], [0.06, 0, 0], 'cloth'), // apron bib
          ...both((sx) => [seg([sx * tw * 0.28, mid + 0.4, td * 0.52], [sx * tw * 0.36, top + 0.04, 0], 0.05, leather, 'cloth'), metal(RBOX, acc, [sx * tw * 0.27, mid + 0.38, td * 0.55], [0.1, 0.1, 0.04])]),
          metal(RBOX, acc, [0, mid + 0.08, td * 0.56], [0.2, 0.14, 0.04]), glow(BOX, gl, [0, mid + 0.08, td * 0.585], [0.12, 0.05, 0.01]), // hammer badge
          cloth(CYL, shirt, [0, top + 0.04, 0], [0.34, 0.16, 0.34]),
          ...skull(hy, hz, 0.44, skin),
          // welding mask flipped up on the forehead, braided wire beard, goggles
          metal(RBOX, shade(main, 0.9), [0, hy + 0.2, hz + 0.08], [0.5, 0.2, 0.4], [-0.9, 0, 0]), glass(BOX, 0x22303A, [0, hy + 0.27, hz + 0.18], [0.3, 0.08, 0.04], [-0.9, 0, 0]),
          ...both((sx) => [metal(CYL, acc, [sx * 0.25, hy + 0.12, hz], [0.08, 0.06, 0.08], [0, 0, Math.PI / 2])]),
          ...[-1, 0, 1].map((k) => metal(CONE4, 0x9AA0AA, [k * 0.11, hy - 0.32 - (k ? 0 : 0.05), hz + 0.18], [0.1, 0.32 + (k ? 0 : 0.08), 0.1], [Math.PI + 0.15, 0, k * 0.15])),
          ...both((sx) => [metal(RING, 0x3A3F46, [sx * 0.1, hy + 0.04, hz + 0.21], [0.14, 0.14, 0.3])]),
          cloth(RBOX, 0x3A3F46, [0, hy + 0.04, hz + 0.18], [0.46, 0.05, 0.08]),
        ],
        eyes: (vc) => both((sx) => [part(CYL, vc, [sx * 0.1, 0.04, hz + 0.23], [0.1, 0.04, 0.1], [Math.PI / 2, 0, 0])]),
        arms: [
          [...arm({ r: 0.19, fr: 0.2, up: shirt, fore: skin, hand: shade(leather, 0.8), sh: leather, foreF: 'paint' }),
            cloth(CYL, shirt, [0, -0.5, 0.02], [0.44, 0.1, 0.44]), metal(CYL, acc, [0, -0.9, 0.07], [0.46, 0.12, 0.46]),
            // forge sledge: long haft, squared head banded in copper, glowing face
            part(CYL, WOOD, [0, -1.06, 0.5], [0.09, 1.3, 0.09], [Math.PI / 2, 0, 0], 'stone'),
            metal(RBOX, shade(main, 1.3), [0, -1.06, 1.18], [0.38, 0.36, 0.66], [Math.PI / 2, 0, 0]), ...[-0.18, 0.18].map((dz) => metal(BOX, acc, [0, -1.06, 1.18 + dz], [0.42, 0.4, 0.06])),
            glow(BOX, gl, [0, -0.86, 1.18], [0.26, 0.02, 0.42])],
          [...arm({ r: 0.19, fr: 0.2, up: shirt, fore: skin, hand: shade(leather, 0.8), sh: leather }),
            cloth(CYL, shirt, [0, -0.5, 0.02], [0.44, 0.1, 0.44]), cloth(CYL, leather, [0, -0.86, 0.07], [0.46, 0.22, 0.46]),
            // smith's tongs pinching a glowing ingot
            ...both((sx) => [metal(CYL, 0x3A3F46, [sx * 0.04, -1.08, 0.42], [0.04, 0.7, 0.04], [Math.PI / 2, 0, sx * 0.08])]),
            glow(RBOX, 0xFFB050, [0, -1.08, 0.82], [0.14, 0.1, 0.24])],
        ],
        leg: { r: 0.17, thigh: 0x3A3F46, shin: leather, shinF: 'cloth', boot: 0x2A2420 },
        legExtra: (H) => [metal(RBOX, 0x59606B, [0, -H + 0.12, 0.24], [0.32, 0.14, 0.1])],
        skirt: [cloth(RBOX, leather, [0, -0.42, 0.02], [tw * 0.62, 0.86, 0.06], [0.06, 0, 0]), metal(BOX, acc, [0, -0.84, 0.05], [tw * 0.62, 0.05, 0.05], [0.06, 0, 0]), ...both((sx) => [cloth(RBOX, shade(leather, 0.8), [sx * tw * 0.36, -0.2, -0.2], [0.1, 0.36, 0.5])])],
        extra: [{ // leather bellows + coal pot on the back
          name: 'bellows', parent: 'lean', at: [0, mid + 0.1, -td * 0.6],
          parts: [part(RBOX, WOOD, [0, 0.36, -0.02], [0.7, 0.08, 0.5], [0.25, 0, 0], 'stone'), part(RBOX, WOOD, [0, -0.36, -0.02], [0.7, 0.08, 0.5], [-0.25, 0, 0], 'stone'),
            cloth(RBOX, leather, [0, 0, -0.08], [0.62, 0.66, 0.36]), metal(CONE, acc, [0, 0.0, 0.3], [0.16, 0.34, 0.16], [-Math.PI / 2, 0, 0]),
            metal(CYL, 0x3A3F46, [0.42, 0.42, 0], [0.32, 0.3, 0.32]), glow(SPH, 0xFF8A3A, [0.42, 0.56, 0], [0.26, 0.12, 0.26])],
        }],
      };
    },
    // The bellows pump: slow breaths at rest, quick hard pumps while winding up a skill.
    anim(m, t, dt, h) {
      h._pump = (h._pump ?? 0) + dt * (2 + 10 * Math.max(h.charge, h.castT));
      m.x.bellows.scale.set(1, 0.82 + 0.18 * Math.abs(Math.sin(h._pump)), 1);
    },
  },

  cyclone: {
    plan: { hip: 1.42, tw: 0.96, th: 1.05, td: 0.56, hs: 0.4, neck: 0.14, ax: 0.7, legX: 0.24, armR: 0.13 },
    gait: { cad: 1.15, swing: 1.1, bob: 0.06, lean: 0.4, float: 0, sq: 0.03 },
    build(c) {
      const { hip, tw, th, td, top, hy, hz, main, acc, gl } = c, wrap = 0xE8E2D0, skin = 0x8C6B55, sash = 0x2E7F86, mid = hip + th * 0.5;
      return {
        body: [
          rubber(RBOX, DARK, [0, hip + 0.04, 0], [tw * 0.66, 0.24, td * 0.8]), cloth(CYL, sash, [0, hip + 0.12, 0], [tw * 0.74, 0.18, td * 0.9]),
          part(TAPER, main, [0, mid + 0.14, 0], [tw, th * 0.78, td], undefined, 'cloth'), // athletic V torso
          cloth(RBOX, sash, [0, mid + 0.1, td * 0.42], [0.16, th * 0.9, 0.06], [0, 0, 0.6]), // cross sash
          cloth(RBOX, sash, [0.3, hip + 0.04, td * 0.36], [0.18, 0.34, 0.05], [0.1, 0, -0.2]),
          // one storm-cloud pauldron (asymmetric)
          ...[[0, 0, 0, 0.5], [0.16, 0.12, -0.08, 0.38], [-0.12, 0.1, 0.1, 0.36], [0.08, -0.12, 0.14, 0.32]].map(([x, y, z, s]) => cloth(SPH, tint(acc, 0x9AB0C8, 0.25), [tw * 0.56 + x, top - 0.04 + y, z], s)),
          glow(OCT, gl, [tw * 0.6, top + 0.12, 0.2], [0.1, 0.16, 0.1]),
          cloth(CYL, skin, [0, top + 0.06, 0], [0.24, 0.18, 0.24]),
          ...skull(hy, hz, 0.4, skin),
          cloth(SPH, 0x22262E, [0, hy + 0.06, hz - 0.04], [0.42, 0.38, 0.44]), // short dark hair
          cloth(CYL, wrap, [0, hy + 0.06, hz], [0.43, 0.08, 0.43]), ...both((sx) => [cloth(RBOX, wrap, [sx * 0.06, hy + 0.02, hz - 0.3], [0.06, 0.22, 0.04], [0.4, 0, sx * 0.3])]), // headband tails
          metal(RBOX, 0x2A3038, [0, hy + 0.02, hz + 0.19], [0.36, 0.08, 0.06]),
        ],
        eyes: (vc) => [part(RBOX, vc, [0, 0.02, hz + 0.23], [0.3, 0.04, 0.02])],
        arms: [0, 1].map(() => [ // wrapped fists in wind bracers with spinning fins
          ...arm({ r: 0.13, up: skin, fore: wrap, hand: wrap, sh: main, upF: 'paint', foreF: 'cloth', handF: 'cloth' }),
          metal(CYL, 0x5A6878, [0, -0.78, 0.06], [0.3, 0.26, 0.3]), glow(RING, gl, [0, -0.78, 0.06], [0.44, 0.44, 1.2], [Math.PI / 2, 0, 0]),
          ...ring(4, (k, a) => metal(BOX, TRIM, [Math.cos(a) * 0.2, -0.72, 0.06 + Math.sin(a) * 0.2], [0.03, 0.2, 0.12], [0, -a, 0])),
        ]),
        leg: { r: 0.13, thigh: main, shin: wrap, shinF: 'cloth', boot: 0x2A3038 },
        skirt: [...both((sx) => [cloth(RBOX, shade(main, 0.75), [sx * 0.2, -0.46, -0.02], [0.3, 0.86, 0.04], [0.06, 0, sx * 0.06])]), cloth(RBOX, sash, [0, -0.5, -td - 0.02], [0.56, 0.96, 0.04], [-0.1, 0, 0])],
        tailAt: [0, hy + 0.05, hz - 0.2],
        tail: [...[0, 1, 2].map((k) => cloth(CONE4, 0x22262E, [0, -0.06 - k * 0.12, -0.16 - k * 0.24], [0.16 - k * 0.03, 0.4, 0.12], [-1.2, 0, 0]))], // ponytail
        extra: [{ // storm ring circling the waist
          name: 'storm', parent: 'rig', at: [0, hip + 0.35, 0],
          parts: [...ring(5, (k, a) => cloth(SPH, k % 2 ? acc : tint(acc, 0x8FA4BC, 0.35), [Math.cos(a) * 0.95, Math.sin(k * 2.3) * 0.08, Math.sin(a) * 0.95], [0.34, 0.24, 0.34])),
            glow(RING, gl, [0, 0, 0], [1.9, 1.9, 0.6], [Math.PI / 2, 0, 0.1]), glow(RING, tint(gl, 0xffffff, 0.4), [0, 0.12, 0], [1.6, 1.6, 0.5], [Math.PI / 2 - 0.15, 0, 0])],
        }],
      };
    },
    // The storm ring never stops circling; it races while running or spinning and tilts into turns.
    anim(m, t, dt, h) {
      h._storm = (h._storm ?? 0) + dt * (1.5 + h.moveAmt * 5 + h.spin * 10);
      const s = m.x.storm;
      s.rotation.y = h._storm;
      s.rotation.z = Math.sin(t * 1.7) * 0.12;
      s.position.y = s.userData.y + Math.sin(t * 2.3) * 0.08;
    },
  },

  shade: {
    plan: { hip: 1.48, tw: 0.78, th: 1.06, td: 0.5, hs: 0.38, neck: 0.18, ax: 0.58, legX: 0.18, armR: 0.11 },
    gait: { cad: 0.85, swing: 0.62, bob: 0.03, lean: 0.18, float: 0, sq: 0.02, crouch: 0.04 },
    build(c) {
      const { hip, tw, th, td, top, hy, hz, main, acc, gl } = c, porcelain = 0xF2EEE8, mid = hip + th * 0.5;
      return {
        body: [
          rubber(RBOX, DARK, [0, hip + 0.04, 0], [tw * 0.62, 0.22, td * 0.8]),
          part(TAPER, main, [0, mid + 0.12, 0], [tw, th * 0.82, td], undefined, 'cloth'), // fitted long coat
          ...both((sx) => [cloth(RBOX, acc, [sx * 0.12, mid + 0.28, td * 0.44], [0.12, th * 0.46, 0.04], [0.05, 0, sx * -0.28])]), // crimson lapels
          ...[0, 1, 2].map((k) => metal(SPH, 0xD8B070, [0.06, hip + 0.3 + k * 0.18, td * 0.48], 0.06)),
          cloth(CYL, main, [0, top + 0.08, 0], [0.42, 0.34, 0.4]), cloth(CYL, acc, [0, top + 0.1, 0], [0.38, 0.3, 0.36]), // stand collar, lined
          ...skull(hy, hz, 0.38, 0x2A2438),
          cloth(SPH, 0x15121C, [0, hy + 0.08, hz - 0.04], [0.42, 0.34, 0.44]), cloth(CONE4, 0x15121C, [0.1, hy + 0.14, hz + 0.12], [0.2, 0.3, 0.1], [1.3, 0, -0.6]), // swept hair
          part(SPH, porcelain, [0, hy + 0.02, hz + 0.1], [0.36, 0.34, 0.24]), // porcelain half-mask
          glow(BOX, gl, [0.07, hy + 0.17, hz + 0.21], [0.18, 0.02, 0.01], [0, 0, -0.3]),
        ],
        eyes: (vc) => [part(RBOX, vc, [-0.08, 0.04, hz + 0.21], [0.12, 0.03, 0.02], [0, 0, 0.25]), part(RBOX, vc, [0.08, 0.04, hz + 0.21], [0.12, 0.03, 0.02], [0, 0, -0.25])],
        arms: [
          [...arm({ r: 0.11, up: main, fore: main, hand: 0xE8E4F0, sh: main, foreF: 'cloth', handF: 'cloth' }), cloth(CYL, acc, [0, -0.92, 0.07], [0.26, 0.08, 0.26]),
            // closed umbrella held as a rapier: crook handle, furled canopy, steel ferrule
            metal(TORUS, 0xD8B070, [0, -1.0, -0.06], [0.2, 0.2, 0.3], [0, Math.PI / 2, 0]), part(CYL, 0x15121C, [0, -1.08, 0.3], [0.04, 0.5, 0.04], [Math.PI / 2, 0, 0], 'rubber'),
            cloth(CONE, main, [0, -1.08, 0.88], [0.16, 0.8, 0.16], [Math.PI / 2, 0, 0]), cloth(CONE, acc, [0, -1.08, 0.74], [0.17, 0.3, 0.17], [Math.PI / 2, 0, 0]),
            metal(CYL, TRIM, [0, -1.08, 1.5], [0.03, 0.5, 0.03], [Math.PI / 2, 0, 0]), glow(CONE4, gl, [0, -1.08, 1.78], [0.05, 0.14, 0.05], [Math.PI / 2, 0, 0])],
          [...arm({ r: 0.11, up: main, fore: main, hand: 0xE8E4F0, sh: main, foreF: 'cloth', handF: 'cloth' }), cloth(CYL, acc, [0, -0.92, 0.07], [0.26, 0.08, 0.26]),
            part(CYL, 0x15121C, [0, -1.36, 0.08], [0.04, 0.7, 0.04], undefined, 'rubber')], // parasol shaft (canopy is its own group)
        ],
        leg: { r: 0.11, thigh: 0x15121C, shin: 0x15121C, shinF: 'cloth', boot: 0x0E0C12 },
        legExtra: (H) => [part(CONE4, 0x0E0C12, [0, -H + 0.08, 0.26], [0.12, 0.2, 0.08], [Math.PI / 2, 0, 0], 'rubber')],
        skirt: [...both((sx) => [cloth(RBOX, main, [sx * 0.18, -0.5, -0.04], [0.32, 1.0, 0.04], [0.04, 0, sx * 0.05]), cloth(RBOX, acc, [sx * 0.18, -0.5, -0.07], [0.3, 0.96, 0.02], [0.04, 0, sx * 0.05])]),
          ...both((sx) => [cloth(RBOX, main, [sx * 0.2, -0.56, -td - 0.02], [0.32, 1.12, 0.04], [-0.12, 0, sx * 0.08])])],
        extra: [{ // the parasol canopy in the off hand; anim opens it overhead
          name: 'canopy', parent: 'arm1', at: [0, -1.72, 0.08],
          parts: [...ring(8, (k, a) => cloth(CONE4, k % 2 ? acc : main, [Math.cos(a) * 0.42, 0, Math.sin(a) * 0.42], [0.62, 0.12, 0.5], [0, -a, Math.PI / 2 - 0.25])),
            cloth(CONE, main, [0, 0.08, 0], [1.6, 0.36, 1.6]), metal(SPH, 0xD8B070, [0, 0.3, 0], 0.08), ...ring(8, (k, a) => glow(SPH, gl, [Math.cos(a + 0.39) * 0.8, -0.1, Math.sin(a + 0.39) * 0.8], 0.04))],
        }],
      };
    },
    // Furled, the parasol hangs like a cane; it blooms overhead (off arm raised) while drifting, hidden, or casting.
    anim(m, t, dt, h) {
      const want = h.script || h.hidden || h.castT > 0.2 || h.charge > 0 ? 1 : 0;
      h._open = (h._open ?? 0) + (want - (h._open ?? 0)) * Math.min(1, dt * 9);
      const o = h._open, g = m.x.canopy;
      g.scale.set(0.12 + 0.88 * o, 1.4 - 0.4 * o, 0.12 + 0.88 * o);
      g.rotation.x = Math.PI * (1 - o);
      g.position.y = g.userData.y + 1.3 * o;
      if (o > 0.02) m.arms[1].rotation.set(-2.9 * o + m.arms[1].rotation.x * (1 - o), 0, 0.15 * o + m.arms[1].rotation.z * (1 - o));
    },
  },

  pounce: {
    plan: { hip: 1.18, tw: 0.86, th: 0.95, td: 0.6, hs: 0.42, neck: 0.16, hunch: 0.22, ax: 0.62, legX: 0.22, armR: 0.12 },
    gait: { cad: 1.1, swing: 1.0, bob: 0.12, lean: 0.5, float: 0, sq: 0.06, crouch: 0.12 },
    build(c) {
      const { hip, tw, th, td, top, hy, hz, main, acc, gl } = c, cream = 0xF2E2BC, spot = 0x3A2E24, mid = hip + th * 0.5;
      const tailPt = (k) => [0, -0.1 + Math.sin(k * 0.45) * 0.7 - 0.06 * k, -0.1 - k * 0.27];
      const spots = (pts) => pts.map(([x, y, z, s = 0.09]) => part(SPH, spot, [x, y, z], [s, s, s * 0.5], [0, Math.atan2(x, z), 0]));
      return {
        body: [
          rubber(RBOX, DARK, [0, hip + 0.04, 0], [tw * 0.62, 0.22, td * 0.8]),
          part(TAPER, main, [0, mid + 0.12, 0.06], [tw, th * 0.8, td], [0.25, 0, 0]),
          part(SPH, cream, [0, mid + 0.2, td * 0.4], [tw * 0.56, th * 0.56, 0.3], [0.25, 0, 0]), // chest ruff
          ...spots([[-0.3, mid + 0.3, 0.2], [0.32, mid + 0.1, 0.18], [-0.34, mid - 0.06, 0.14], [0.28, mid + 0.42, 0.1], [0, mid + 0.4, -0.3, 0.12], [-0.22, mid, -0.28]]),
          // acrobat harness: crossing teal straps, gold ring
          ...both((sx) => [cloth(RBOX, acc, [0, mid + 0.12, td * 0.5 + 0.03], [0.1, th * 0.9, 0.04], [0.25, 0, sx * 0.55])]), metal(RING, 0xE8C060, [0, mid + 0.14, td * 0.56], [0.2, 0.2, 0.4], [0.25, 0, 0]),
          cloth(CYL, acc, [0, hip + 0.12, 0], [tw * 0.72, 0.14, td * 0.86]),
          seg([0, top - 0.04, 0.12], [0, hy - 0.12, hz - 0.06], 0.14, main),
          // feline head: rounded skull, short muzzle, small rounded ears
          part(SPH, main, [0, hy, hz], [0.44, 0.4, 0.44]), part(SPH, cream, [0, hy - 0.08, hz + 0.18], [0.24, 0.18, 0.2]), part(SPH, 0x5A3A30, [0, hy - 0.02, hz + 0.27], [0.08, 0.05, 0.05]),
          ...both((sx) => [part(SPH, main, [sx * 0.16, hy + 0.2, hz - 0.02], [0.14, 0.14, 0.06], [0, sx * 0.3, sx * -0.3]), part(SPH, spot, [sx * 0.165, hy + 0.21, hz - 0.035], [0.1, 0.1, 0.04], [0, sx * 0.3, sx * -0.3])]),
          ...spots([[-0.12, hy + 0.16, hz + 0.12, 0.06], [0.14, hy + 0.14, hz + 0.1, 0.05], [0, hy + 0.2, hz + 0.06, 0.05]]),
          ...both((sx) => [...[0, 1].map((k) => metal(BOX, cream, [sx * 0.16, hy - 0.08 + k * 0.03, hz + 0.24], [0.2, 0.008, 0.008], [0, sx * 0.3, sx * (0.1 - k * 0.15)]))]), // whiskers
        ],
        eyes: (vc) => both((sx) => [part(SPH, vc, [sx * 0.1, 0.04, hz + 0.19], [0.1, 0.05, 0.04], [0, 0, sx * -0.3])]),
        arms: [0, 1].map(() => [ // furred arms, teal wraps, a gold acrobat hoop-blade in each hand
          ...arm({ r: 0.12, up: main, fore: main, hand: cream, sh: main, upF: 'paint' }), cloth(CYL, acc, [0, -0.88, 0.07], [0.27, 0.16, 0.27]),
          part(SPH, spot, [0.1, -0.3, 0.06], [0.08, 0.08, 0.04]),
          metal(RING, 0xE8C060, [0, -1.08, 0.38], [0.72, 0.72, 1.4], [0, Math.PI / 2, 0]), glow(RING, gl, [0, -1.08, 0.38], [0.62, 0.62, 0.6], [0, Math.PI / 2, 0]),
          ...ring(4, (k, a) => metal(CONE4, TRIM, [0, -1.08 + Math.sin(a) * 0.38, 0.38 + Math.cos(a) * 0.38], [0.05, 0.14, 0.05], [a, 0, 0])),
        ]),
        legDigi: { r: 0.13, thigh: main, shin: main, paw: cream, claw: 0xF4F0E8 },
        legExtra: (H) => [part(SPH, spot, [0.08, -H * 0.3, 0.2], [0.08, 0.08, 0.04]), cloth(CYL, acc, [0, -H * 0.8, -0.12], [0.24, 0.1, 0.24])],
        skirt: [cloth(RBOX, acc, [0.18, -0.3, -0.04], [0.18, 0.6, 0.03], [0.06, 0, 0.12]), cloth(RBOX, tint(acc, 0xffffff, 0.3), [0.26, -0.36, -0.03], [0.12, 0.66, 0.02], [0.06, 0, 0.2])], // sash tails
        tailAt: [0, hip + 0.06, -td * 0.42],
        tail: [ // long tail curling up, banded tip
          ...[0, 1, 2, 3, 4, 5].map((k) => seg(tailPt(k), tailPt(k + 1), 0.11 - k * 0.008, k > 3 ? (k % 2 ? spot : main) : main)),
          part(SPH, spot, tailPt(6), 0.2),
        ],
      };
    },
    // Low prowl while a skill coils up (the cat crouches before the jump), tail held high when idle.
    anim(m, t, dt, h) {
      m.lean.rotation.x += 0.25 * h.charge;
      m.tail.rotation.x = -0.3 * (1 - h.moveAmt) + Math.sin(t * 2) * 0.08;
    },
  },

  comet: {
    plan: { hip: 1.36, tw: 0.84, th: 1.06, td: 0.55, hs: 0.4, neck: 0.15, ax: 0.62, legX: 0.2, armR: 0.12 },
    gait: { cad: 0.9, swing: 0.8, bob: 0.06, lean: 0.22, float: 0, sq: 0.03 },
    build(c) {
      const { hip, tw, th, td, top, hy, hz, main, acc, gl } = c, silver = acc, skin = 0xC69C7E, hair = 0xEDEFF7, mid = hip + th * 0.5;
      return {
        body: [
          rubber(RBOX, DARK, [0, hip + 0.04, 0], [tw * 0.64, 0.24, td * 0.8]), metal(CYL, silver, [0, hip + 0.1, 0], [tw * 0.7, 0.06, td * 0.86]),
          part(TAPER, main, [0, mid + 0.12, 0], [tw, th * 0.8, td], undefined, 'cloth'), // navy greatcoat
          ...[[-0.2, 0.3, 0.35], [0.14, 0.1, -0.5], [0.24, 0.36, 0.9], [-0.1, -0.1, -0.2]].map(([x, y, r]) => glow(BOX, gl, [x, mid + y, td * 0.46], [0.24, 0.012, 0.01], [0, 0, r])), // star-chart lines
          ...[[-0.2, 0.42], [0.06, 0.28], [0.3, 0.2], [-0.04, 0.0]].map(([x, y]) => glow(OCT, tint(gl, 0xffffff, 0.4), [x, mid + y, td * 0.47], 0.05)),
          metal(RING, silver, [0, mid + 0.16, td * 0.5], [0.24, 0.24, 0.4]), metal(RING, silver, [0, mid + 0.16, td * 0.5], [0.24, 0.24, 0.4], [0, Math.PI / 2, 0]), // astrolabe medallion
          ...both((sx) => [cloth(RBOX, shade(main, 0.75), [sx * (tw * 0.5 + 0.06), top - 0.1, 0], [0.34, 0.12, 0.5], [0, 0, sx * -0.4]), metal(BOX, silver, [sx * (tw * 0.5 + 0.18), top - 0.2, 0], [0.04, 0.03, 0.46], [0, 0, sx * -0.4])]),
          cloth(CYL, main, [0, top + 0.1, 0], [0.4, 0.28, 0.38]), metal(CYL, silver, [0, top + 0.24, 0], [0.42, 0.03, 0.4]),
          ...skull(hy, hz, 0.4, skin),
          cloth(SPH, hair, [0, hy + 0.04, hz - 0.06], [0.44, 0.4, 0.44]),
          // navigator's tricorn with silver trim and a star cockade
          ...ring(3, (k, a) => cloth(RBOX, main, [Math.sin(a) * 0.2, hy + 0.25, hz + Math.cos(a) * 0.2], [0.42, 0.14, 0.08], [0.25, a, 0])),
          cloth(DOME, main, [0, hy + 0.2, hz], [0.44, 0.3, 0.44]), ...ring(3, (k, a) => metal(BOX, silver, [Math.sin(a) * 0.24, hy + 0.32, hz + Math.cos(a) * 0.24], [0.44, 0.02, 0.02], [0, a, 0])),
          glow(OCT, gl, [0, hy + 0.28, hz + 0.24], [0.1, 0.1, 0.04]),
        ],
        eyes: (vc) => both((sx) => [part(RBOX, vc, [sx * 0.08, 0.02, hz + 0.19], [0.08, 0.04, 0.02])]),
        arms: [
          [...arm({ r: 0.12, up: main, fore: main, hand: 0xE8ECF8, sh: main, foreF: 'cloth', handF: 'cloth' }), metal(CYL, silver, [0, -0.92, 0.07], [0.28, 0.06, 0.28]),
            metal(CYL, silver, [0, -0.48, 0.18], [0.05, 2.3, 0.05], [0.08, 0, 0]), metal(CONE, silver, [0, -1.62, 0.1], [0.08, 0.2, 0.08], [Math.PI, 0, 0])], // astrolabe staff (rings are their own group)
          [...arm({ r: 0.12, up: main, fore: main, hand: 0xE8ECF8, sh: main, foreF: 'cloth', handF: 'cloth' }), metal(CYL, silver, [0, -0.92, 0.07], [0.28, 0.06, 0.28]), glow(OCT, gl, [0, -1.24, 0.12], [0.14, 0.14, 0.14])],
        ],
        leg: { r: 0.12, thigh: 0x2A2F3A, shin: 0x1A1E28, shinF: 'paint', boot: 0x15181F },
        legExtra: (H) => [metal(CYL, silver, [0, -H * 0.55, 0.04], [0.3, 0.04, 0.3])],
        skirt: [...both((sx) => [cloth(RBOX, main, [sx * 0.2, -0.56, -0.02], [0.34, 1.1, 0.04], [0.04, 0, sx * 0.06]), metal(BOX, silver, [sx * 0.2, -1.1, -0.02], [0.34, 0.03, 0.05], [0.04, 0, sx * 0.06])]),
          cloth(RBOX, shade(main, 0.85), [0, -0.6, -td - 0.02], [0.6, 1.2, 0.04], [-0.1, 0, 0])],
        tailAt: [0, hy - 0.05, hz - 0.2],
        tail: [...[0, 1, 2].map((k) => cloth(RBOX, hair, [0, -0.14 - k * 0.2, -0.04 - k * 0.04], [0.32 - k * 0.06, 0.26, 0.06], [-0.15, 0, 0]))], // long white hair
        extra: [{ // armillary rings atop the staff
          name: 'orrery', parent: 'arm0', at: [0, 0.72, 0.28],
          parts: [metal(RING, silver, [0, 0, 0], [0.62, 0.62, 0.62]), metal(RING, 0xD8B070, [0, 0, 0], [0.5, 0.5, 0.5], [Math.PI / 2, 0, 0]), glow(RING, gl, [0, 0, 0], [0.4, 0.4, 0.6], [0.6, 0.6, 0]), glow(SPH, gl, [0, 0, 0], 0.16)],
        }],
        halo: [ // three small icy comets with tails orbiting the head
          ...ring(3, (k, a) => stone(ICO, 0xBFD8F0, [Math.cos(a) * 1.15, 2.95 + (k % 2) * 0.2, Math.sin(a) * 1.15], 0.18)),
          ...ring(3, (k, a) => glow(CONE, k % 2 ? gl : tint(gl, 0xFFF2B0, 0.6), [Math.cos(a - 0.3) * 1.15, 2.95 + (k % 2) * 0.2, Math.sin(a - 0.3) * 1.15], [0.12, 0.5, 0.12], [0, -a, Math.PI / 2])),
        ],
      };
    },
    anim(m, t, dt, h) {
      const o = m.x.orrery, sp = 1 + 4 * Math.max(h.charge, h.castT);
      o.rotation.y += dt * 1.2 * sp; o.rotation.x += dt * 0.7 * sp;
    },
  },

  mycel: {
    plan: { hip: 1.22, tw: 0.86, th: 1.0, td: 0.62, hs: 0.38, neck: 0.12, hunch: 0.14, ax: 0.62, legX: 0.2, armR: 0.12 },
    gait: { cad: 0.8, swing: 0.55, bob: 0.1, lean: 0.15, float: 0, sq: 0.12 },
    build(c) {
      const { hip, tw, th, td, top, hy, hz, main, acc, gl } = c, moss = 0x4E6A3A, gill = acc, skin = 0x9C8C7A, mid = hip + th * 0.5;
      const shroom = (x, y, z, s, cap = main) => [part(CYL, gill, [x, y, z], [s * 0.3, s * 0.6, s * 0.3], undefined, 'cloth'), part(DOME, cap, [x, y + s * 0.28, z], [s, s * 0.6, s]), glow(CYL, gl, [x, y + s * 0.27, z], [s * 0.8, 0.01, s * 0.8])];
      return {
        body: [
          rubber(RBOX, DARK, [0, hip + 0.04, 0], [tw * 0.64, 0.24, td * 0.8]), cloth(CYL, moss, [0, hip + 0.12, 0], [tw * 0.74, 0.14, td * 0.86]),
          part(TAPER, shade(main, 0.85), [0, mid + 0.12, 0.04], [tw, th * 0.8, td], [0.14, 0, 0], 'cloth'), // layered robe
          cloth(RBOX, moss, [0, mid + 0.08, td * 0.44], [tw * 0.4, th * 0.74, 0.06], [0.14, 0, 0]),
          ...[[-0.18, 0.3, 0.6], [0.1, 0.0, -0.4], [0.22, 0.32, 0.2], [-0.06, -0.12, 1.1]].map(([x, y, r]) => glow(BOX, gl, [x, mid + y, td * 0.5], [0.24, 0.012, 0.01], [0, 0, r])), // mycelium threads
          ...shroom(-tw * 0.48, top + 0.04, 0.04, 0.24), ...shroom(-tw * 0.36, top + 0.02, 0.18, 0.15, tint(main, 0xffffff, 0.2)), // shoulder mushrooms
          cloth(TORUS, moss, [0, top + 0.06, 0.06], [0.5, 0.5, 0.6], [Math.PI / 2, 0, 0]),
          ...skull(hy, hz, 0.38, skin),
          cloth(SPH, shade(main, 0.4), [0, hy, hz + 0.04], [0.4, 0.42, 0.4]), // face in the cap's shadow
        ],
        eyes: (vc) => both((sx) => [part(SPH, vc, [sx * 0.09, -0.02, hz + 0.2], [0.07, 0.07, 0.04])]),
        arms: [
          [...arm({ r: 0.12, up: main, fore: shade(main, 0.85), hand: skin, sh: shade(main, 0.9), foreF: 'cloth' }), cloth(CONE, shade(main, 0.85), [0, -0.92, 0.07], [0.34, 0.3, 0.34], [Math.PI, 0, 0]),
            // gnarled staff with a cluster of glowing mushrooms
            part(CYL, 0x5A4632, [0, -0.6, 0.18], [0.08, 2.2, 0.08], [0.1, 0.0, 0.05], 'stone'), part(SPH, 0x5A4632, [0, -1.3, 0.12], 0.14, undefined, 'stone'),
            ...shroom(0.02, 0.5, 0.3, 0.42), ...shroom(-0.16, 0.32, 0.26, 0.26, tint(main, 0xffffff, 0.15)), ...shroom(0.16, 0.36, 0.34, 0.2, 0x9C4A3A)],
          [...arm({ r: 0.12, up: main, fore: shade(main, 0.85), hand: skin, sh: shade(main, 0.9), foreF: 'cloth' }), cloth(CONE, shade(main, 0.85), [0, -0.92, 0.07], [0.34, 0.3, 0.34], [Math.PI, 0, 0]), glow(SPH, gl, [0, -1.2, 0.14], 0.14)],
        ],
        leg: { r: 0.12, thigh: moss, shin: 0x5A4632, shinF: 'stone', boot: 0x3A2E24 },
        legExtra: (H) => [...[-1, 0, 1].map((t) => part(CONE4, 0x3A2E24, [t * 0.1, -H + 0.04, 0.22 + Math.abs(t) * -0.04], [0.06, 0.24, 0.06], [Math.PI / 2 + 0.3, t * 0.4, 0], 'stone'))], // root toes
        skirt: [ // long robe with a ragged hem
          cloth(CONE, shade(main, 0.8), [0, -0.52, -0.2], [tw * 1.12, 1.1, td * 1.5]),
          ...ring(9, (k, a) => cloth(CONE4, shade(main, 0.7), [Math.sin(a) * tw * 0.54, -1.12, -0.2 + Math.cos(a) * td * 0.72], [0.18, 0.2, 0.1], [Math.PI, a, 0])),
          ...shroom(-0.36, -0.9, 0.1, 0.12, 0xE8E0C8), ...shroom(0.3, -1.0, -0.4, 0.16),
        ],
        tailAt: [0, mid + 0.2, -td * 0.5],
        tail: [cloth(RBOX, 0x6B5A40, [0, -0.1, -0.12], [0.5, 0.56, 0.3]), ...shroom(-0.14, 0.2, -0.14, 0.2), ...shroom(0.14, 0.26, -0.1, 0.16, tint(main, 0xffffff, 0.2)), glow(SPH, gl, [0.2, -0.2, -0.3], 0.1)], // spore satchel
        extra: [{ // the wide spotted cap hat
          name: 'cap', parent: 'lean', at: [0, hy + 0.12, hz - 0.02],
          parts: [part(DOME, main, [0, 0, 0], [1.25, 0.66, 1.25]), cloth(CYL, gill, [0, -0.005, 0], [1.2, 0.03, 1.2]),
            ...ring(12, (k, a) => cloth(BOX, shade(gill, 0.85), [Math.cos(a) * 0.32, -0.02, Math.sin(a) * 0.32], [0.5, 0.02, 0.012], [0, -a, 0])),
            ...[[0.26, 0.2, 0.1], [-0.2, 0.22, 0.2], [0.04, 0.3, -0.26], [-0.36, 0.1, -0.2], [0.36, 0.1, -0.3], [0, 0.32, 0.08]].map(([x, y, z]) => cloth(SPH, acc, [x, y, z], [0.13, 0.05, 0.13], [z * 1.4, 0, -x * 1.4])),
            ...ring(8, (k, a) => glow(SPH, gl, [Math.cos(a) * 0.56, -0.02, Math.sin(a) * 0.56], 0.04))],
        }],
      };
    },
    // The cap breathes; a cast makes it puff (squash and stretch) like a mushroom letting go of spores.
    anim(m, t, dt, h) {
      const p = h.castT > 0 ? Math.sin(Math.PI * h.castT) : 0, b = Math.sin(t * 1.8) * 0.03;
      m.x.cap.scale.set(1 + b + 0.18 * p, 1 - b - 0.25 * p + 0.2 * h.charge, 1 + b + 0.18 * p);
    },
  },

  harpoon: {
    plan: { hip: 1.28, tw: 1.06, th: 1.06, td: 0.7, hs: 0.42, neck: 0.08, ax: 0.78, legX: 0.24, armR: 0.15 },
    gait: { cad: 0.95, swing: 0.85, bob: 0.14, lean: 0.12, float: 0, sq: 0.08, sway: 0.14 },
    build(c) {
      const { hip, tw, th, td, top, hy, hz, main, acc, gl } = c, navy = acc, beard = 0xD8D2C4, skin = 0xD0A080, mid = hip + th * 0.5;
      return {
        body: [
          rubber(RBOX, DARK, [0, hip + 0.04, 0], [tw * 0.7, 0.26, td * 0.8]),
          part(SPH, main, [0, mid + 0.1, 0], [tw, th * 1.02, td * 1.12], undefined, 'rubber'), // bulky oilskin coat
          ...[0, 1, 2].map((k) => part(RBOX, 0xE8DCC0, [0.06, hip + 0.36 + k * 0.2, td * 0.55], [0.06, 0.12, 0.05], [0, 0, Math.PI / 2], 'stone')), // toggles
          part(BOX, shade(main, 0.8), [0, hip + 0.56, td * 0.54], [0.012, 0.8, 0.02]),
          cloth(CYL, navy, [0, top + 0.06, 0], [0.42, 0.26, 0.42]), // turtleneck
          ...ring(9, (k) => part(TORUS, ROPE, [-tw * 0.36 + k * tw * 0.09, mid + 0.36 - k * 0.1, td * 0.5 - Math.abs(k - 4) * 0.02], [0.14, 0.14, 0.18], [0.3, 0.9, 0.7], 'cloth')), // rope bandolier
          ...skull(hy, hz, 0.42, skin),
          ...[[0, -0.2, 0.18, 0.34], [-0.13, -0.12, 0.16, 0.2], [0.13, -0.12, 0.16, 0.2], [0, -0.32, 0.14, 0.22]].map(([x, y, z, s]) => cloth(SPH, beard, [x, hy + y, hz + z], s)), // bushy beard
          part(SPH, 0xC08060, [0, hy - 0.02, hz + 0.22], 0.1),
          // sou'wester: dome crown with a long brim sloping down the back
          part(DOME, main, [0, hy + 0.1, hz - 0.02], [0.5, 0.36, 0.5], undefined, 'rubber'), part(CYL, main, [0, hy + 0.08, hz - 0.08], [0.72, 0.03, 0.84], [-0.25, 0, 0], 'rubber'),
          cloth(CYL, navy, [0, hy + 0.12, hz - 0.02], [0.51, 0.05, 0.51]),
        ],
        eyes: (vc) => both((sx) => [part(SPH, vc, [sx * 0.09, 0.04, hz + 0.2], [0.07, 0.06, 0.04])]),
        arms: [
          [...arm({ r: 0.15, up: main, fore: main, hand: 0x3A4048, sh: main, upF: 'rubber', foreF: 'rubber' }), cloth(CYL, navy, [0, -0.92, 0.07], [0.34, 0.1, 0.34]),
            // harpoon gun: wooden stock, brass barrel, barbed glowing head, side rope drum
            part(RBOX, WOOD, [0, -1.0, 0.36], [0.18, 0.24, 0.8], undefined, 'stone'), metal(CYL, BRASS, [0, -0.94, 1.0], [0.16, 0.9, 0.16], [Math.PI / 2, 0, 0]),
            metal(CYL, TRIM, [0, -0.94, 1.6], [0.04, 0.5, 0.04], [Math.PI / 2, 0, 0]), metal(CONE4, TRIM, [0, -0.94, 1.92], [0.16, 0.26, 0.05], [Math.PI / 2, 0, 0]),
            ...both((sx) => [metal(CONE4, TRIM, [sx * 0.08, -0.94, 1.78], [0.04, 0.16, 0.04], [Math.PI / 2 + 0.6, 0, sx * 0.5])]), glow(CONE4, gl, [0, -0.94, 1.94], [0.07, 0.2, 0.03], [Math.PI / 2, 0, 0]),
            part(CYL, WOOD, [0.16, -0.92, 0.5], [0.24, 0.12, 0.24], [0, 0, Math.PI / 2], 'stone'), part(TORUS, ROPE, [0.2, -0.92, 0.5], [0.22, 0.22, 0.4], [0, Math.PI / 2, 0], 'cloth')],
          [...arm({ r: 0.15, up: main, fore: main, hand: 0x3A4048, sh: main, upF: 'rubber', foreF: 'rubber' }), cloth(CYL, navy, [0, -0.92, 0.07], [0.34, 0.1, 0.34])],
        ],
        leg: { r: 0.15, thigh: navy, shin: 0x1A2430, shinF: 'rubber', boot: 0x1A2430 },
        legExtra: (H) => [rubber(CYL, 0x1A2430, [0, -H * 0.62, 0.02], [0.4, 0.06, 0.4])],
        skirt: [...[-1, 1].map((sx) => part(RBOX, main, [sx * 0.24, -0.34, 0], [0.42, 0.66, 0.06], [0.06, sx * -0.2, sx * 0.06], 'rubber')), part(RBOX, main, [0, -0.36, -td - 0.02], [tw * 0.8, 0.7, 0.06], [-0.08, 0, 0], 'rubber')],
        extra: [{ // whaling reel and spare harpoons on the back
          name: 'reel', parent: 'lean', at: [0, mid + 0.1, -td * 0.62],
          parts: [part(CYL, WOOD, [0, 0, 0], [0.86, 0.5, 0.86], [0, 0, Math.PI / 2], 'stone'), ...[-0.16, 0, 0.16].map((x) => part(TORUS, ROPE, [x, 0, 0], [0.82, 0.82, 0.6], [0, Math.PI / 2, 0], 'cloth')),
            ...both((sx) => [metal(CYL, BRASS, [sx * 0.28, 0, 0], [0.92, 0.04, 0.92], [0, 0, Math.PI / 2])])],
        }, {
          name: 'spares', parent: 'lean', at: [0.18, mid + 0.4, -td * 0.7],
          parts: [...[-0.12, 0.12].flatMap((x) => [metal(CYL, TRIM, [x, 0.5, 0], [0.04, 1.6, 0.04], [-0.15, 0, x]), metal(CONE4, TRIM, [x + x * 0.4, 1.32, -0.12], [0.1, 0.2, 0.04], [-0.15, 0, x])])],
        }],
      };
    },
    // The reel winds whenever the gun fires or a skill goes off.
    anim(m, t, dt, h) {
      m.x.reel.rotation.x -= dt * (0.3 + 12 * Math.max(h.atkT, h.castT));
    },
  },

  loom: {
    plan: { hip: 1.48, tw: 0.74, th: 1.04, td: 0.5, hs: 0.37, neck: 0.18, ax: 0.56, legX: 0.18, armR: 0.11 },
    gait: { cad: 1.0, swing: 0.78, bob: 0.05, lean: 0.25, float: 0, sq: 0.03, crouch: 0.04 },
    build(c) {
      const { hip, tw, th, td, top, hy, hz, main, acc, gl } = c, saffron = acc, skin = 0x7A5440, mid = hip + th * 0.5;
      const bobbin = (x, y, z, s, col) => [part(CYL, WOOD, [x, y, z], [s * 0.5, s * 1.3, s * 0.5], undefined, 'stone'), cloth(CYL, col, [x, y, z], [s * 0.8, s * 0.8, s * 0.8]), part(CYL, WOOD, [x, y + s * 0.62, z], [s, s * 0.1, s], undefined, 'stone'), part(CYL, WOOD, [x, y - s * 0.62, z], [s, s * 0.1, s], undefined, 'stone')];
      return {
        body: [
          rubber(RBOX, DARK, [0, hip + 0.04, 0], [tw * 0.62, 0.22, td * 0.8]), cloth(CYL, saffron, [0, hip + 0.12, 0], [tw * 0.7, 0.12, td * 0.84]),
          part(TAPER, main, [0, mid + 0.12, 0], [tw, th * 0.82, td], undefined, 'cloth'), // woven tunic
          ...[0, 1, 2, 3, 4].map((k) => cloth(BOX, k % 2 ? saffron : tint(main, 0xffffff, 0.3), [0, hip + 0.32 + k * 0.14, td * 0.44 - k * 0.02], [tw * (0.56 + k * 0.05), 0.035, 0.03])), // weave bands
          cloth(RBOX, saffron, [0, mid + 0.1, td * 0.46], [0.08, th * 0.8, 0.04], [0, 0, -0.55]), // sash
          cloth(CYL, main, [0, top + 0.08, 0], [0.26, 0.2, 0.26]),
          ...skull(hy, hz, 0.37, skin),
          cloth(SPH, 0x1A1E3A, [0, hy + 0.06, hz - 0.03], [0.4, 0.36, 0.42]), // wrapped hair
          cloth(RBOX, tint(main, 0x000000, 0.2), [0, hy - 0.1, hz + 0.12], [0.36, 0.18, 0.2]), // half-veil
          cloth(CYL, saffron, [0, hy + 0.14, hz], [0.41, 0.06, 0.41]),
          ...bobbin(-0.16, hy + 0.32, hz - 0.04, 0.12, 0xF59BFF), ...bobbin(0, hy + 0.36, hz - 0.08, 0.14, 0x9BE8FF), ...bobbin(0.16, hy + 0.32, hz - 0.04, 0.12, saffron), // spindle crown
          metal(RING, BRASS, [0.08, hy + 0.04, hz + 0.19], [0.14, 0.14, 0.3]), glass(CYL, 0xC8F4FF, [0.08, hy + 0.04, hz + 0.19], [0.11, 0.02, 0.11], [Math.PI / 2, 0, 0]), // scope monocle
        ],
        eyes: (vc) => [part(SPH, vc, [0.08, 0.04, hz + 0.2], [0.06, 0.06, 0.03]), part(RBOX, vc, [-0.08, 0.04, hz + 0.18], [0.08, 0.025, 0.02])],
        arms: [
          [...arm({ r: 0.11, up: main, fore: skin, hand: skin, sh: main, foreF: 'paint', handF: 'paint' }), ...[0, 1, 2].map((k) => cloth(CYL, k % 2 ? saffron : main, [0, -0.7 - k * 0.09, 0.06], [0.24, 0.05, 0.24])),
            // shuttle rifle: a long weaving-shuttle body, a needle barrel, a spool on top
            part(OCT, WOOD, [0, -1.0, 0.6], [0.2, 1.2, 0.2], [Math.PI / 2, 0, 0], 'stone'), metal(BOX, BRASS, [0, -1.0, 0.6], [0.22, 0.04, 0.9]),
            metal(CYL, TRIM, [0, -1.0, 1.55], [0.03, 1.1, 0.03], [Math.PI / 2, 0, 0]), glow(CONE4, gl, [0, -1.0, 2.14], [0.04, 0.12, 0.04], [Math.PI / 2, 0, 0]),
            ...bobbin(0, -0.82, 0.5, 0.1, 0xF59BFF).map((q) => ({ ...q, r: [Math.PI / 2, 0, 0] })), glow(BOX, gl, [0, -0.86, 1.2], [0.006, 0.006, 1.3])],
          [...arm({ r: 0.11, up: main, fore: skin, hand: skin, sh: main, foreF: 'paint', handF: 'paint' }), ...[0, 1, 2].map((k) => cloth(CYL, k % 2 ? saffron : main, [0, -0.7 - k * 0.09, 0.06], [0.24, 0.05, 0.24]))],
        ],
        leg: { r: 0.11, thigh: main, shin: tint(main, 0xffffff, 0.15), shinF: 'cloth', boot: 0x3A2E24 },
        legExtra: (H) => [...[0, 1, 2].map((k) => cloth(CYL, saffron, [0, -H * 0.6 - k * 0.12, 0.02], [0.24, 0.025, 0.24], [0.2, 0, 0]))],
        skirt: [...[-1, 0, 1].map((k) => cloth(RBOX, k ? main : saffron, [k * 0.18, -0.48, -0.02 - Math.abs(k) * 0.04], [0.2, 0.94, 0.03], [0.05, k * -0.2, k * 0.05])),
          ...[-1, 0, 1].map((k) => cloth(CONE4, saffron, [k * 0.18, -1.0, -0.02], [0.08, 0.14, 0.04], [Math.PI, 0, 0])), cloth(RBOX, main, [0, -0.5, -td - 0.02], [0.5, 1.0, 0.04], [-0.08, 0, 0])],
        extra: [{ // harp-shaped warp frame on the back with taut glowing threads
          name: 'warp', parent: 'lean', at: [0, mid + 0.2, -td * 0.62],
          parts: [part(CYL, WOOD, [-0.36, 0.2, 0], [0.07, 1.6, 0.07], [0, 0, -0.12], 'stone'), part(CYL, WOOD, [0.36, 0.2, 0], [0.07, 1.6, 0.07], [0, 0, 0.12], 'stone'),
            part(CYL, WOOD, [0, 1.0, 0], [0.08, 0.96, 0.08], [0, 0, Math.PI / 2], 'stone'), part(CYL, WOOD, [0, -0.56, 0], [0.07, 0.56, 0.07], [0, 0, Math.PI / 2], 'stone'),
            ...[-0.24, -0.12, 0, 0.12, 0.24].map((x, k) => glow(BOX, k % 2 ? gl : tint(gl, 0x9BE8FF, 0.6), [x * 1.1, 0.22, 0], [0.012, 1.5, 0.012], [0, 0, -x * 0.25])),
            ...[-0.44, 0.44].flatMap((x) => [metal(SPH, BRASS, [x * 0.86, 1.02, 0], 0.1)])],
        }],
      };
    },
    anim(m, t, dt, h) {
      m.x.warp.rotation.z = Math.sin(t * 1.4) * 0.03 + h.castT * 0.1 * Math.sin(t * 30);
    },
  },

  hymn: {
    plan: { hip: 1.3, tw: 0.8, th: 1.1, td: 0.55, hs: 0.38, neck: 0.16, ax: 0.6, legX: 0.18, armR: 0.11 },
    gait: { cad: 0.75, swing: 0.4, bob: 0.03, lean: 0.06, float: 0.14, sq: 0.03 },
    build(c) {
      const { hip, tw, th, td, top, hy, hz, main, acc, gl } = c, gold = 0xE8C060, skin = 0xE0B8A0, hair = 0x5A3A2A, mid = hip + th * 0.5;
      return {
        body: [
          cloth(TAPER, main, [0, mid + 0.12, 0], [tw, th * 0.82, td]),
          ...both((sx) => [cloth(RBOX, acc, [sx * 0.13, mid - 0.2, td * 0.44], [0.16, th * 1.5, 0.04], [0.04, 0, 0]), glow(BOX, gl, [sx * 0.13, mid + 0.36, td * 0.47], [0.06, 0.06, 0.01]), metal(BOX, gold, [sx * 0.13, hip - 0.5, td * 0.5], [0.16, 0.04, 0.05])]), // stole
          ...[0, 1, 2].map((k) => cloth(TORUS, 0xFFFFFF, [0, top + 0.06 + k * 0.05, 0], [0.62 - k * 0.08, 0.62 - k * 0.08, 0.9], [Math.PI / 2, 0, 0])), // choir ruff
          cloth(CYL, skin, [0, top + 0.12, 0], [0.2, 0.18, 0.2]),
          ...skull(hy, hz, 0.38, skin),
          cloth(SPH, hair, [0, hy + 0.04, hz - 0.06], [0.42, 0.42, 0.44]), cloth(RBOX, hair, [0, hy - 0.22, hz - 0.18], [0.36, 0.48, 0.14]), // long hair
          ...ring(10, (k, a) => metal(SPH, gold, [Math.sin(a) * 0.22, hy + 0.17, hz + Math.cos(a) * 0.22], [0.1, 0.05, 0.07], [0, a, 0])), // laurel circlet
          cloth(TORUS, shade(main, 0.9), [0, top + 0.18, -0.16], [0.56, 0.4, 0.8], [1.1, 0, 0]), // cowl folded back
        ],
        eyes: (vc) => both((sx) => [part(RBOX, vc, [sx * 0.08, 0.02, hz + 0.19], [0.09, 0.022, 0.02], [0, 0, sx * -0.18])]), // serene closed-eye arcs
        arms: [
          [...arm({ r: 0.11, up: main, fore: main, hand: skin, sh: main, foreF: 'cloth', handF: 'paint' }), cloth(CONE, main, [0, -0.88, 0.08], [0.36, 0.34, 0.36], [Math.PI, 0, 0]),
            // tuning-fork staff singing between its prongs
            metal(CYL, gold, [0, -0.7, 0.2], [0.05, 2.0, 0.05], [0.08, 0, 0]),
            ...both((sx) => [metal(CYL, gold, [sx * 0.12, 0.62, 0.3], [0.05, 0.6, 0.05])]), metal(TORUS, gold, [0, 0.32, 0.3], [0.26, 0.2, 0.2], [0, 0, 0]),
            glow(OCT, gl, [0, 0.66, 0.3], [0.14, 0.32, 0.06]), glow(SPH, gl, [0, -1.72, 0.12], 0.08)],
          [...arm({ r: 0.11, up: main, fore: main, hand: skin, sh: main, foreF: 'cloth', handF: 'paint' }), cloth(CONE, main, [0, -0.88, 0.08], [0.36, 0.34, 0.36], [Math.PI, 0, 0]),
            // open hymn book
            ...both((sx) => [part(RBOX, acc, [sx * 0.15, -1.1, 0.24], [0.3, 0.04, 0.4], [0, 0, sx * 0.25]), part(BOX, 0xF4EEDC, [sx * 0.15, -1.07, 0.24], [0.27, 0.03, 0.36], [0, 0, sx * 0.25], 'cloth')]), glow(BOX, gl, [0, -1.05, 0.24], [0.02, 0.02, 0.34])],
        ],
        leg: { r: 0.1, thigh: main, shin: main, shinF: 'cloth', boot: shade(main, 0.6) },
        skirt: [ // bell-shaped robe sweeping to the ground
          cloth(BELL, main, [0, -0.62, -td * 0.42], [tw * 1.5, 1.24, td * 2.4]), cloth(CYL, gold, [0, -1.22, -td * 0.42], [tw * 1.5, 0.05, td * 2.4]),
          cloth(RBOX, acc, [0, -0.6, 0.18], [0.24, 1.14, 0.04], [0.15, 0, 0]),
        ],
        halo: [ // floating choir bells
          ...ring(3, (k, a) => [metal(BELL, gold, [Math.cos(a) * 1.25, 2.6 + (k % 2) * 0.25, Math.sin(a) * 1.25], [0.34, 0.34, 0.34]), metal(SPH, gold, [Math.cos(a) * 1.25, 2.8 + (k % 2) * 0.25, Math.sin(a) * 1.25], 0.1),
            glow(SPH, gl, [Math.cos(a) * 1.25, 2.44 + (k % 2) * 0.25, Math.sin(a) * 1.25], 0.07)]).flat(),
        ],
      };
    },
    // The hymn book stays held open in front (off arm) unless a cast needs both hands.
    anim(m, t, dt, h) {
      const B = m.arms[1], free = 1 - Math.max(h.charge, h.castT);
      B.rotation.x = B.rotation.x * (1 - free) + (-0.9 + Math.sin(t * 1.6) * 0.04) * free;
      B.rotation.z = B.rotation.z * (1 - free) + 0.35 * free;
    },
  },

  grove: {
    plan: { hip: 1.28, tw: 0.82, th: 1.02, td: 0.58, hs: 0.38, neck: 0.14, hunch: 0.2, ax: 0.62, legX: 0.18, armR: 0.11 },
    gait: { cad: 0.8, swing: 0.6, bob: 0.08, lean: 0.2, float: 0, sq: 0.05 },
    build(c) {
      const { hip, tw, th, td, top, hy, hz, main, acc, gl } = c, bark = main, streak = 0x3A3530, coat = 0x6E8B6A, leaf = 0x6FB050, lichen = 0xE6EAD8, mid = hip + th * 0.5;
      const marks = (pts) => pts.map(([x, y, z, w = 0.1]) => part(BOX, streak, [x, y, z], [w, 0.02, 0.012], [0, Math.atan2(x, z), 0], 'stone'));
      return {
        body: [
          rubber(RBOX, DARK, [0, hip + 0.04, 0], [tw * 0.64, 0.22, td * 0.8]),
          cloth(TAPER, coat, [0, mid + 0.12, 0.04], [tw, th * 0.82, td], [0.2, 0, 0]), // doctor's long coat
          ...both((sx) => [cloth(RBOX, shade(coat, 0.8), [sx * 0.14, mid + 0.24, td * 0.48], [0.12, th * 0.5, 0.04], [0.2, 0, sx * -0.25])]),
          part(RBOX, 0xB07A3A, [0, mid + 0.02, td * 0.46], [0.24, th * 0.46, 0.04], [0.2, 0, 0], 'cloth'), // waistcoat
          ...[0, 1, 2].map((k) => glow(SPH, gl, [0, hip + 0.32 + k * 0.13, td * 0.52 + k * 0.03], 0.045)), // amber sap buttons
          cloth(CYL, bark, [0, top + 0.06, 0.1], [0.22, 0.16, 0.22]),
          ...skull(hy, hz, 0.38, bark, 'stone'), ...marks([[-0.12, hy + 0.1, hz + 0.17], [0.1, hy - 0.04, hz + 0.18, 0.08], [-0.08, hy - 0.12, hz + 0.18, 0.06], [0.14, hy + 0.14, hz + 0.12, 0.07]]),
          ...[[-0.1, -0.24, 0.24], [0.1, -0.24, 0.24], [0, -0.3, 0.3], [0, -0.42, 0.18]].map(([x, y, s]) => cloth(SPH, lichen, [x, hy + y, hz + 0.14], s)), // lichen beard
          ...both((sx) => [metal(RING, 0x7A5A30, [sx * 0.09, hy + 0.02, hz + 0.2], [0.15, 0.15, 0.3]), glass(CYL, 0xFFE8B0, [sx * 0.09, hy + 0.02, hz + 0.2], [0.12, 0.01, 0.12], [Math.PI / 2, 0, 0])]), metal(BOX, 0x7A5A30, [0, hy + 0.04, hz + 0.21], [0.05, 0.015, 0.015]), // spectacles
        ],
        eyes: (vc) => both((sx) => [part(SPH, vc, [sx * 0.09, 0.02, hz + 0.18], [0.06, 0.06, 0.03])]),
        arms: [
          [...arm({ r: 0.11, up: coat, fore: bark, hand: bark, sh: coat, foreF: 'stone', handF: 'stone' }), cloth(CYL, coat, [0, -0.6, 0.04], [0.28, 0.14, 0.28]),
            // gnarled walking cane with an amber sap knob
            part(CYL, 0x5A4632, [0, -1.4, 0.16], [0.07, 1.2, 0.07], [0.12, 0, 0], 'stone'), part(SPH, 0x5A4632, [0, -0.86, 0.1], [0.14, 0.12, 0.14], undefined, 'stone'),
            glow(SPH, gl, [0, -0.78, 0.1], 0.13), ...both((sx) => [part(SPH, leaf, [sx * 0.1, -0.74, 0.04], [0.14, 0.05, 0.08], [0.3, 0, sx * 0.5], 'cloth')])],
          [...arm({ r: 0.11, up: coat, fore: bark, hand: bark, sh: coat, foreF: 'stone', handF: 'stone' }), cloth(CYL, coat, [0, -0.6, 0.04], [0.28, 0.14, 0.28]),
            // doctor's satchel with a leaf clasp
            part(RBOX, 0x7A4A2A, [0, -1.36, 0.1], [0.24, 0.36, 0.5], undefined, 'cloth'), part(RBOX, shade(0x7A4A2A, 0.8), [0, -1.2, 0.1], [0.26, 0.08, 0.52], undefined, 'cloth'),
            metal(TORUS, 0x7A5A30, [0, -1.12, 0.1], [0.24, 0.2, 0.2], [0, Math.PI / 2, 0]), glow(SPH, gl, [0.13, -1.3, 0.1], [0.04, 0.12, 0.1])],
        ],
        leg: { r: 0.11, thigh: 0x4A5A44, shin: bark, shinF: 'stone', boot: 0x4A3A2A },
        skirt: [...both((sx) => [cloth(RBOX, coat, [sx * 0.18, -0.48, -0.02], [0.3, 0.92, 0.04], [0.05, 0, sx * 0.07])]), cloth(RBOX, shade(coat, 0.9), [0, -0.5, -td - 0.02], [0.56, 0.98, 0.04], [-0.1, 0, 0])],
        extra: [{ // bonsai growing from the crown
          name: 'bonsai', parent: 'lean', at: [0, hy + 0.18, hz - 0.02],
          parts: [part(CYL, 0x5A4632, [0, 0.1, 0], [0.07, 0.3, 0.07], [0, 0, 0.3], 'stone'), part(CYL, 0x5A4632, [0.08, 0.3, 0], [0.05, 0.26, 0.05], [0, 0, -0.6], 'stone'),
            ...[[0.2, 0.42, 0, 0.3], [-0.08, 0.36, 0.06, 0.24], [0.06, 0.56, -0.04, 0.22]].map(([x, y, z, s]) => cloth(SPH, leaf, [x, y, z], [s, s * 0.6, s])), glow(SPH, gl, [0.24, 0.32, 0.08], 0.05)],
        }, { // sap-vial rack on the back
          name: 'vials', parent: 'lean', at: [0, mid + 0.1, -td * 0.58],
          parts: [part(RBOX, WOOD, [0, 0, 0], [0.7, 0.5, 0.2], undefined, 'stone'), ...[-0.24, -0.08, 0.08, 0.24].flatMap((x, k) => [glass(CYL, 0xFFE8C0, [x, 0.22, 0], [0.12, 0.36, 0.12]), glow(CYL, k % 2 ? gl : tint(acc, 0x9FE07A, 0.6), [x, 0.16, 0], [0.09, 0.22, 0.09]), part(CYL, 0x8A6A44, [x, 0.42, 0], [0.08, 0.06, 0.08], undefined, 'stone')])],
        }],
      };
    },
    anim(m, t, dt, h) {
      m.x.bonsai.rotation.z = Math.sin(t * 1.3) * 0.08 + h.moveAmt * Math.sin(h.phase) * 0.06;
    },
  },
};

const DEF_PLAN = { hip: 1.3, tw: 0.9, th: 1.05, td: 0.6, hs: 0.4, neck: 0.14, hunch: 0, ax: 0.66, legX: 0.22 };

// -> the same handles as buildChampion (models.js), plus `x` (named extra groups), `gait` and `anim`.
export function buildWave2B(spec, def, team = 0) {
  const D = BODIES[def.id], pl = { ...DEF_PLAN, ...D.plan };
  const main = ground(def.color, 0.06), acc = ground(def.accent, 0.04), gl = tint(def.fx?.color ?? def.basic?.color ?? def.accent, 0xffffff, 0.1);
  const top = pl.hip + pl.th, hz = pl.hunch * 0.9;
  const c = { ...pl, top, hy: top + pl.neck + pl.hs * 0.55, hz, main, acc, gl, fx: def.fx };
  const B = D.build(c);
  const mat = toonMat({ vertexColors: true, finish: true, rim: 0.3 });
  const mesh = (P, k = 0.03) => toonMesh(mergeParts(P), mat, k);

  const lean = new THREE.Group();
  lean.add(mesh(B.body));
  const vc = new THREE.Color(TEAM[team].main).lerp(new THREE.Color(0xffffff), 0.35).getHex();
  const eyes = new THREE.Mesh(mergeParts(B.eyes(vc)), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
  eyes.position.y = c.hy;
  lean.add(eyes);

  const shY = top - 0.1;
  const armGroups = [-1, 1].map((sx, i) => {
    const g = new THREE.Group();
    g.position.set(sx * pl.ax, shY, pl.hunch * 0.3);
    g.add(mesh(B.arms[i]));
    lean.add(g);
    return g;
  });
  const hand = new THREE.Object3D();
  hand.position.set(0, -1.1, 0.35);
  armGroups[0].add(hand);
  const orb = new THREE.Mesh(SPH, new THREE.MeshBasicMaterial({ color: new THREE.Color(gl).multiplyScalar(1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  orb.visible = false;
  hand.add(orb);

  const sk = new THREE.Group();
  sk.position.set(0, pl.hip + 0.02, pl.td * 0.42);
  if (B.skirt?.length) sk.add(mesh(B.skirt, 0.02));
  lean.add(sk);

  const tail = new THREE.Group();
  tail.position.set(...(B.tailAt ?? [0, top - 0.5, -pl.td / 2]));
  if (B.tail?.length) tail.add(mesh(B.tail));
  lean.add(tail);

  const L = B.legDigi ? digiLeg(pl.hip, B.legDigi) : leg(pl.hip, B.leg);
  if (B.legExtra) L.push(...B.legExtra(pl.hip));
  const legGeo = mergeParts(L);
  const legs = [-1, 1].map((sx) => {
    const g = new THREE.Group();
    g.position.set(sx * pl.legX, pl.hip, 0);
    g.add(toonMesh(legGeo, mat, 0.03));
    return g;
  });

  const rig = new THREE.Group();
  rig.add(lean, ...legs);
  let halo = null;
  if (B.halo) { halo = new THREE.Group(); halo.add(mesh(B.halo, 0.02)); rig.add(halo); }
  const x = {}, parents = { lean, rig, tail, arm0: armGroups[0], arm1: armGroups[1] };
  for (const e of B.extra ?? []) {
    const g = new THREE.Group();
    g.position.set(...e.at);
    g.userData.y = e.at[1];
    if (e.parts.length) g.add(mesh(e.parts));
    parents[e.parent].add(g);
    x[e.name] = g;
  }
  const root = new THREE.Group();
  root.add(rig);
  const m = { root, lean, eyes, tail, legs, arms: armGroups, skirt: sk, hand, orb, halo, style: spec.style ?? 'base', gait: D.gait, x, mats: [mat] };
  if (D.anim) {
    m.anim = (t, dt, h) => D.anim(m, t, dt, h);
    m.anim(0, 1, { charge: 0, castT: 0, atkT: 0, moveAmt: 0, spin: 0, phase: 0 }); // settle into the rest pose (portraits / lineups never animate)
  }
  return m;
}
