// Wave 2 batch A bodies. Each champion is a bespoke part list on a shared rig (same groups hero.js animates:
// lean / eyes / arms / hand / orb / skirt / tail / legs / halo), with grown-up proportions: small heads, long limbs,
// distinct silhouettes and materials. `gait` overrides the walk cycle; `extras` are live bits animated by `update`
// (Granite's floating monolith, Wisp's flame, Petal's spinning tutu, Beacon's lamp, Longshot's tripod...).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TEAM } from '../config.js';
import { toonMat, toonMesh, mergeParts } from '../render/toon.js';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const RBOX = new RoundedBoxGeometry(1, 1, 1, 1, 0.16);
const TAPER = new THREE.CylinderGeometry(0.62, 0.42, 1, 8).rotateY(Math.PI / 8);
const TOWER = new THREE.CylinderGeometry(0.36, 0.5, 1, 12);
const HEX = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
const CONE = new THREE.ConeGeometry(0.5, 1, 10);
const CONE4 = new THREE.ConeGeometry(0.5, 1, 4);
const OCT = new THREE.OctahedronGeometry(0.5);
const SPH = new THREE.SphereGeometry(0.5, 12, 8);
const DOME = new THREE.SphereGeometry(0.5, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2);
const CAP = new THREE.CapsuleGeometry(0.5, 1, 2, 8);
const RING = new THREE.TorusGeometry(0.5, 0.07, 4, 20);
const TORUS = new THREE.TorusGeometry(0.5, 0.17, 6, 16);
const FAN = new THREE.CylinderGeometry(0.5, 0.5, 0.04, 12, 1, false, 0, Math.PI);
const ARC = new THREE.TorusGeometry(0.85, 0.05, 4, 18, Math.PI * 0.95);

const DARK = 0x1C2029, PI = Math.PI;
const part = (g, c, p, s = 1, r, f = 'paint') => ({ g, c, p, s, r, f });
const metal = (g, c, p, s, r) => part(g, c, p, s, r, 'metal');
const cloth = (g, c, p, s, r) => part(g, c, p, s, r, 'cloth');
const glow = (g, c, p, s, r) => part(g, c, p, s, r, 'glow');
const rubber = (g, c, p, s, r) => part(g, c, p, s, r, 'rubber');
const stone = (g, c, p, s, r) => part(g, c, p, s, r, 'stone');
const glass = (g, c, p, s, r) => part(g, c, p, s, r, 'glass');
const both = (fn) => [...fn(-1), ...fn(1)];
const ring = (n, fn) => Array.from({ length: n }, (_, k) => fn(k, (k / n) * PI * 2)).flat();
const live = (h, tag) => !!h?.effects?.some((e) => e.tag === tag);
const ease = (cur, to, dt, k = 10) => cur + (to - cur) * (1 - Math.exp(-k * dt));
// Eye shapes for the team-tinted visor mesh, authored around (0, 0, z).
const EYES = {
  slit: (c, z, w = 0.3) => [part(RBOX, c, [0, 0, z], [w, 0.05, 0.04])],
  dots: (c, z, x = 0.1, r = 0.07) => both((sx) => [part(CYL, c, [sx * x, 0, z], [r, 0.04, r], [PI / 2, 0, 0])]),
  wide: (c, z, x = 0.1) => both((sx) => [part(RBOX, c, [sx * x, 0, z], [0.14, 0.06, 0.04], [0, 0, sx * 0.25])]),
  almond: (c, z) => both((sx) => [part(SPH, c, [sx * 0.1, 0, z], [0.13, 0.07, 0.04], [0, 0, sx * -0.3])]),
};

// ───────────── the twelve bodies ─────────────
const BUILD = {
  granite(gl) {
    const G = 0x7D8088, GD = 0x5A5D64, GL = 0x9A9DA4, AU = 0xD9A441;
    const vein = (x, y, z, h, r) => glow(BOX, gl, [x, y, z], [0.04, h, 0.03], [0, 0, r]);
    return {
      hip: 1.15, scale: [1.12, 1.05], gait: { cad: 0.55, swing: 0.45, bob: 0.1, lean: 0.08, float: 0, sq: 0.05 },
      body: [
        stone(RBOX, GD, [0, 1.15, 0], [0.85, 0.34, 0.58]), stone(CYL, G, [0, 1.42, 0], [0.75, 0.3, 0.55]),
        metal(CYL, AU, [0, 1.3, 0], [0.82, 0.1, 0.6]), glow(RBOX, gl, [0, 1.3, 0.3], [0.16, 0.1, 0.04]),
        stone(TAPER, G, [0, 1.95, 0.02], [1.35, 0.85, 0.95]), stone(RBOX, GL, [0, 2.05, 0.36], [0.9, 0.55, 0.18]),
        ...both((sx) => [stone(RBOX, G, [sx * 0.78, 2.32, 0], [0.62, 0.5, 0.72], [0, 0, sx * 0.15]), metal(RBOX, AU, [sx * 0.82, 2.58, 0], [0.5, 0.08, 0.6], [0, 0, sx * 0.15]),
          stone(RBOX, GD, [sx * 0.24, 2.58, 0.12], [0.08, 0.3, 0.36]), vein(sx * 0.8, 2.36, 0.37, 0.3, sx * 0.4)]),
        stone(RBOX, G, [0, 2.62, 0.08], [0.42, 0.44, 0.44]), stone(RBOX, GD, [0, 2.8, 0.14], [0.52, 0.12, 0.42]),
        vein(-0.2, 2.1, 0.46, 0.4, 0.5), vein(0.1, 1.95, 0.46, 0.35, -0.6), vein(0.28, 2.2, 0.46, 0.3, 0.3), vein(-0.05, 1.6, 0.3, 0.3, 0.2),
        glow(HEX, gl, [0, 1.84, 0.47], [0.16, 0.03, 0.16], [PI / 2, 0, 0]),
      ],
      eyes: { y: 2.62, parts: (c) => EYES.slit(c, 0.31, 0.3) },
      sh: [0.98, 2.25], hand: [0, -1.45, 0.3],
      arm: () => [
        stone(CAP, G, [0, -0.28, 0], [0.3, 0.22, 0.3]), stone(SPH, GD, [0, -0.55, 0], 0.3),
        stone(HEX, G, [0, -0.95, 0.05], [0.52, 0.7, 0.52]), metal(CYL, AU, [0, -0.7, 0.05], [0.56, 0.08, 0.56]),
        glow(BOX, gl, [0, -1.0, 0.31], [0.05, 0.4, 0.02]), stone(RBOX, GD, [0, -1.42, 0.08], [0.48, 0.34, 0.5]),
      ],
      legX: 0.3,
      leg: () => [stone(RBOX, G, [0, -0.3, 0], [0.36, 0.5, 0.42]), metal(SPH, AU, [0, -0.6, 0.14], 0.16), stone(HEX, GD, [0, -0.82, 0], [0.42, 0.44, 0.42]), stone(RBOX, G, [0, -1.07, 0.08], [0.46, 0.16, 0.62])],
      skirt: { at: [0, 1.2, 0.3], parts: both((sx) => [stone(RBOX, GD, [sx * 0.22, -0.18, 0], [0.32, 0.36, 0.08], [0.1, 0, sx * 0.08])]) },
      halo: ring(4, (k, a) => [stone(OCT, k % 2 ? GL : GD, [Math.cos(a) * 1.3, 0.5 + (k % 2) * 0.25, Math.sin(a) * 1.3], 0.24, [a, k, 0])]),
      extras: [{
        parent: 'lean', at: [0, 2.2, -0.78],
        parts: [stone(RBOX, GD, [0, 0, 0], [0.62, 1.7, 0.22]), metal(RBOX, AU, [0, 0.88, 0], [0.68, 0.08, 0.26]), glow(BOX, gl, [0, 0.1, -0.12], [0.06, 1.2, 0.02]), glow(BOX, gl, [0, 0.35, -0.12], [0.4, 0.06, 0.02])],
        anim: (g, t, dt, mv, h) => { g.position.y = 2.2 + Math.sin(t * 1.4) * 0.1 + (live(h, 'bedrock') ? 0.3 : 0); g.rotation.z = Math.sin(t * 0.7) * 0.05; },
      }],
    };
  },

  tidewall(gl) {
    const T = 0x2E7F86, TD = 0x1E5559, CO = 0xFF8A7A, CD = 0xE0604F, CR = 0xE8E0CC, SH = 0xF5C6B8;
    const barn = (x, y, z, s = 0.1) => part(SPH, CR, [x, y, z], [s, s * 0.7, s]);
    return {
      hip: 1.05, scale: [1.15, 1.0], gait: { cad: 0.75, swing: 0.5, bob: 0.14, lean: 0.06, float: 0, sq: 0.1, sway: 0.12 },
      body: [
        rubber(RBOX, TD, [0, 1.05, 0], [0.8, 0.3, 0.6]), part(CYL, T, [0, 1.55, 0], [1.1, 0.9, 0.85]), glow(CYL, gl, [0, 1.2, 0], [1.0, 0.05, 0.78]),
        part(DOME, SH, [0, 1.72, 0.3], [0.95, 0.4, 0.9], [PI / 2, 0, 0]), ...[-0.3, 0, 0.3].map((x) => part(BOX, CR, [x, 1.72, 0.5], [0.05, 0.75, 0.05], [0, 0, x * 0.6])),
        part(SPH, T, [0, 2.0, 0], [1.25, 0.7, 0.9]),
        ...both((sx) => [
          part(CYL, CO, [sx * 0.82, 2.35, 0], [0.55, 0.62, 0.55]), part(CYL, CD, [sx * 0.82, 2.67, 0], [0.62, 0.08, 0.62]),
          ...ring(4, (k, a) => [part(RBOX, CD, [sx * 0.82 + Math.cos(a + PI / 4) * 0.24, 2.78, Math.sin(a + PI / 4) * 0.24], [0.14, 0.16, 0.14])]),
          glow(BOX, gl, [sx * 0.82, 2.4, 0.28], [0.1, 0.18, 0.02]),
        ]),
        part(SPH, TD, [0, 2.5, 0.08], [0.36, 0.34, 0.34]), part(CONE, CR, [0, 2.8, -0.04], [0.42, 0.55, 0.42], [-0.15, 0, 0]),
        part(RING, CO, [0, 2.6, -0.02], [0.84, 0.84, 0.8], [PI / 2, 0, 0]), part(RING, CO, [0, 2.78, -0.06], [0.6, 0.6, 0.8], [PI / 2, 0, 0]),
        barn(-0.4, 1.4, 0.45), barn(0.45, 1.6, 0.4, 0.13), barn(-0.55, 2.0, 0.35), barn(0.2, 2.15, 0.42, 0.08), barn(0.6, 1.25, 0.3), barn(-0.15, 1.15, 0.45, 0.08),
      ],
      eyes: { y: 2.5, parts: (c) => EYES.dots(c, 0.25, 0.09, 0.08) },
      sh: [0.92, 2.12], hand: [0, -1.2, 0.3],
      arm: (sx) => [
        part(CAP, T, [0, -0.25, 0], [0.3, 0.22, 0.3]), barn(0, -0.5, 0, 0.26), part(CYL, CO, [0, -0.82, 0.03], [0.36, 0.6, 0.36]),
        part(DOME, SH, [sx * 0.14, -0.9, 0.12], [0.95, 0.32, 1.1], [0, 0, -sx * PI / 2]),
        ...[-0.25, 0, 0.25].map((dz) => part(BOX, CR, [sx * 0.2, -0.9, 0.12 + dz], [0.04, 0.85, 0.04])),
        part(SPH, T, [0, -1.2, 0.06], 0.3), glow(SPH, gl, [sx * 0.3, -0.9, 0.12], 0.1),
      ],
      legX: 0.32,
      leg: () => [part(CAP, T, [0, -0.25, 0], [0.34, 0.22, 0.34]), part(SPH, CO, [0, -0.5, 0.12], 0.2), part(CYL, TD, [0, -0.72, 0], [0.4, 0.4, 0.4]), rubber(RBOX, TD, [0, -0.97, 0.1], [0.5, 0.16, 0.62]), barn(0.1, -0.88, 0.32, 0.08)],
      skirt: { at: [0, 1.05, 0.35], parts: [-0.27, -0.09, 0.09, 0.27].map((x, k) => cloth(RBOX, k % 2 ? 0x3E8E5A : 0x2F7048, [x, -0.3, 0], [0.08, 0.55 - (k % 2) * 0.12, 0.03], [0.1, 0, x * 0.3])) },
      back: { at: [0, 1.95, -0.45], parts: [
        part(CYL, CO, [0, 0.4, -0.1], [0.14, 0.9, 0.14], [-0.2, 0, 0]), part(CYL, CO, [-0.25, 0.65, -0.15], [0.1, 0.6, 0.1], [-0.2, 0, 0.6]), part(CYL, CD, [0.28, 0.55, -0.15], [0.1, 0.55, 0.1], [-0.2, 0, -0.7]),
        glow(SPH, gl, [0, 0.88, -0.2], 0.12), glow(SPH, gl, [-0.45, 0.88, -0.2], 0.09), glow(SPH, gl, [0.48, 0.75, -0.2], 0.09)] },
      halo: ring(5, (k, a) => [glass(SPH, 0xBFF4FF, [Math.cos(a) * 1.3, 1.7 + (k % 3) * 0.25, Math.sin(a) * 1.3], 0.16 + (k % 2) * 0.06)]),
    };
  },

  embermaw(gl) {
    const O = 0x2E2228, B = 0x4A3540, R = 0xB8322A, AU = 0xE8B53A, M = 0xD8452B, TP = 0xEFE6D2;
    const crack = (x, y, z, h, r) => glow(BOX, gl, [x, y, z], [0.035, h, 0.03], [0, 0, r]);
    return {
      hip: 1.0, scale: [1.1, 1.05], gait: { cad: 0.85, swing: 0.75, bob: 0.16, lean: 0.15, float: 0, sq: 0.1, sway: 0.16 },
      body: [
        cloth(CYL, R, [0, 1.08, 0], [0.78, 0.4, 0.6]), metal(CYL, AU, [0, 1.28, 0], [0.86, 0.14, 0.66]),
        metal(RBOX, AU, [0, 1.28, 0.33], [0.5, 0.32, 0.08]), glow(OCT, gl, [0, 1.28, 0.38], 0.15),
        part(CYL, O, [0, 1.5, 0], [0.78, 0.36, 0.6]), part(TAPER, O, [0, 1.95, 0.04], [1.5, 0.75, 1.0]),
        ...both((sx) => [part(RBOX, B, [sx * 0.26, 2.05, 0.42], [0.48, 0.36, 0.14], [0, sx * 0.2, 0])]),
        part(SPH, O, [0, 2.36, -0.05], [0.9, 0.35, 0.6]),
        crack(-0.3, 1.9, 0.5, 0.35, 0.5), crack(0.22, 1.75, 0.48, 0.4, -0.4), crack(0.05, 1.5, 0.31, 0.25, 0.2), crack(-0.12, 2.1, 0.5, 0.2, -0.7),
        part(SPH, M, [0, 2.6, 0.12], [0.42, 0.46, 0.44]), metal(BOX, AU, [0, 2.68, 0.32], [0.34, 0.05, 0.05]),
        ...both((sx) => [metal(BOX, AU, [sx * 0.12, 2.56, 0.33], [0.04, 0.2, 0.03], [0, 0, sx * 0.4])]),
        rubber(RBOX, O, [0, 2.46, 0.3], [0.2, 0.08, 0.06]),
        glow(CONE4, gl, [0, 2.86, 0.06], [0.11, 0.38, 0.11], [-0.5, 0, 0]), glow(CONE4, 0xFFD36B, [0, 2.84, -0.12], [0.09, 0.32, 0.09], [-0.9, 0, 0]), glow(CONE4, gl, [0, 2.74, -0.26], [0.08, 0.28, 0.08], [-1.3, 0, 0]),
      ],
      eyes: { y: 2.62, parts: (c) => EYES.wide(c, 0.33, 0.1) },
      sh: [1.02, 2.22], hand: [0, -1.2, 0.35],
      arm: (sx) => [
        part(SPH, O, [0, -0.05, 0], 0.5), part(CAP, O, [0, -0.35, 0], [0.36, 0.26, 0.36]), glow(BOX, gl, [sx * 0.18, -0.35, 0.05], [0.03, 0.3, 0.03]),
        part(SPH, B, [0, -0.62, 0], 0.3), cloth(CYL, TP, [0, -0.88, 0.04], [0.38, 0.4, 0.38]), metal(CYL, AU, [0, -1.02, 0.04], [0.42, 0.1, 0.42]),
        part(RBOX, O, [0, -1.2, 0.08], [0.38, 0.34, 0.4]), glow(BOX, gl, [0, -1.18, 0.29], [0.3, 0.06, 0.02]),
      ],
      legX: 0.28,
      leg: () => [cloth(CAP, R, [0, -0.18, 0], [0.32, 0.14, 0.32]), part(CAP, O, [0, -0.38, 0], [0.3, 0.18, 0.3]), part(SPH, R, [0, -0.55, 0.1], 0.2),
        part(RBOX, R, [0, -0.76, 0.02], [0.3, 0.38, 0.32]), metal(BOX, AU, [0, -0.74, 0.18], [0.06, 0.3, 0.02]), rubber(RBOX, DARK, [0, -0.95, 0.08], [0.32, 0.1, 0.46])],
      back: { at: [0, 2.1, -0.42], parts: both((sx) => [part(CONE, B, [sx * 0.32, 0.15, 0], [0.38, 0.5, 0.38], [-0.2, 0, sx * -0.2]), glow(CYL, gl, [sx * 0.36, 0.4, -0.05], [0.16, 0.04, 0.16], [-0.2, 0, sx * -0.2])]) },
    };
  },

  quill(gl) {
    const F = 0x8A5A3C, CR = 0xF3E3C3, TL = 0x1F5B57, LE = 0x3A2618, QB = 0x5A3A26, AU = 0xD9B26A;
    const spikes = [];
    for (let k = 0; k < 11; k++) {
      const a = -1.25 + k * 0.25, len = 0.95 - Math.abs(k - 5) * 0.04, d = [Math.sin(a), Math.cos(a) * 0.92, -Math.cos(a) * 0.39];
      const at = (s) => [d[0] * s, 0.1 + d[1] * s, -0.05 + d[2] * s];
      spikes.push(part(CONE4, QB, at(len * 0.45), [0.13, len * 0.9, 0.13], [-0.4, 0, -a]), glow(CONE4, k % 2 ? gl : CR, at(len * 0.95), [0.07, 0.25, 0.07], [-0.4, 0, -a]));
    }
    return {
      hip: 1.3, scale: [0.95, 1.05], gait: { cad: 1.1, swing: 0.75, bob: 0.06, lean: 0.3, float: 0, sq: 0.04, crouch: 0.06 },
      body: [
        cloth(CYL, TL, [0, 1.3, 0], [0.55, 0.25, 0.42]), rubber(CYL, LE, [0, 1.42, 0], [0.58, 0.08, 0.44]), metal(RBOX, AU, [0, 1.42, 0.22], [0.12, 0.1, 0.04]),
        cloth(TAPER, TL, [0, 1.85, 0], [0.85, 0.75, 0.6]), cloth(BOX, CR, [0, 1.85, 0.27], [0.12, 0.6, 0.03]),
        ...[1.65, 1.85, 2.05].map((y) => metal(SPH, AU, [0, y, 0.3], 0.05)),
        cloth(RBOX, 0x2A7A72, [0.3, 1.95, -0.12], [0.45, 0.8, 0.06], [0.2, 0, -0.2]), cloth(CYL, CR, [0, 2.22, 0], [0.5, 0.1, 0.42]),
        part(CYL, F, [0, 2.3, 0], [0.2, 0.15, 0.2]), part(SPH, F, [0, 2.5, 0], [0.4, 0.4, 0.42]), part(SPH, CR, [0, 2.44, 0.18], [0.24, 0.2, 0.26]),
        rubber(SPH, DARK, [0, 2.47, 0.32], 0.08), ...both((sx) => [part(SPH, F, [sx * 0.18, 2.64, -0.02], [0.12, 0.12, 0.06])]),
        ...[-0.12, 0, 0.12].map((x) => part(CONE4, QB, [x, 2.55, -0.24], [0.07, 0.35, 0.07], [-1.9, 0, x * 2])),
        cloth(CYL, TL, [0, 2.7, 0], [0.8, 0.04, 0.7], [0, 0, 0.12]), cloth(CYL, TL, [0, 2.8, 0], [0.38, 0.18, 0.38]), metal(CYL, AU, [0, 2.74, 0], [0.4, 0.04, 0.4]),
        cloth(RBOX, CR, [0.24, 2.95, -0.22], [0.05, 0.6, 0.14], [-0.8, 0, -0.4]), glow(SPH, gl, [0.38, 3.12, -0.42], 0.06),
      ],
      eyes: { y: 2.55, parts: (c) => EYES.dots(c, 0.19, 0.1, 0.07) },
      sh: [0.5, 2.08], hand: [0, -0.95, 0.3],
      arm: (sx) => [
        part(SPH, CR, [0, -0.02, 0], 0.24), cloth(CAP, TL, [0, -0.25, 0], [0.18, 0.2, 0.18]), part(CAP, F, [0, -0.68, 0.03], [0.15, 0.18, 0.15]), part(SPH, CR, [0, -0.92, 0.04], 0.16),
        ...(sx < 0 ? [metal(DOME, AU, [0, -0.95, 0.18], [0.28, 0.14, 0.28], [PI / 2, 0, 0]), rubber(CYL, LE, [0, -0.95, 0.06], [0.06, 0.2, 0.06], [PI / 2, 0, 0]),
          metal(BOX, 0xD8DEE6, [0, -0.95, 0.95], [0.04, 0.06, 1.5]), glow(BOX, gl, [0, -0.92, 0.95], [0.02, 0.02, 1.4]), metal(CONE4, 0xD8DEE6, [0, -0.95, 1.75], [0.05, 0.14, 0.07], [PI / 2, 0, 0])] : []),
      ],
      legX: 0.18,
      leg: () => [cloth(CAP, TL, [0, -0.25, 0], [0.2, 0.22, 0.2]), cloth(CYL, CR, [0, -0.5, 0.02], [0.2, 0.06, 0.2]), rubber(RBOX, LE, [0, -0.58, 0.02], [0.24, 0.1, 0.24]),
        rubber(CAP, LE, [0, -0.86, 0.02], [0.18, 0.22, 0.18]), rubber(RBOX, LE, [0, -1.24, 0.08], [0.2, 0.12, 0.42])],
      skirt: { at: [0, 1.25, 0.2], parts: both((sx) => [cloth(RBOX, TL, [sx * 0.15, -0.2, -0.42], [0.22, 0.42, 0.03], [-0.1, 0, sx * 0.1])]) },
      back: { at: [0, 1.95, -0.3], parts: spikes },
      update(m, t, dt, mv, h) {
        const ball = live(h, 'ball'), k = m._ball = ease(m._ball ?? 0, ball ? 1 : 0, dt, 12);
        m.lean.scale.set(1 + k * 0.15, 1 - k * 0.4, 1 + k * 0.15);
        m.tail.scale.setScalar(1 + k * 0.5);
      },
    };
  },

  wisp(gl) {
    const N = 0x24345A, ND = 0x16213A, P = 0xBFF6FF, AU = 0xFFE7A3;
    return {
      hip: 1.0, scale: [0.95, 1.0], gait: { cad: 0.5, swing: 0.1, bob: 0.04, lean: 0.5, float: 0.7, sq: 0.03 },
      body: [
        cloth(CONE, N, [0, 1.15, 0], [0.75, 1.3, 0.6], [PI, 0, 0]), glow(CONE, gl, [0, 0.82, 0], [0.38, 0.9, 0.3], [PI, 0, 0]),
        cloth(SPH, N, [0, 1.95, 0], [0.75, 0.7, 0.58]), cloth(CYL, P, [0, 1.72, 0], [0.66, 0.08, 0.52]), glow(OCT, AU, [0, 1.72, 0.27], 0.1),
        ...both((sx) => [glow(CONE4, gl, [sx * 0.36, 2.2, -0.05], [0.1, 0.35, 0.1], [0, 0, sx * -0.5])]),
        cloth(SPH, N, [0, 2.42, -0.02], [0.5, 0.52, 0.52]), cloth(CONE, N, [0, 2.7, -0.22], [0.3, 0.45, 0.3], [-1.0, 0, 0]),
        rubber(SPH, 0x0C1222, [0, 2.4, 0.12], [0.36, 0.36, 0.3]), cloth(RING, P, [0, 2.42, 0.13], [0.72, 0.74, 0.8]),
      ],
      eyes: { y: 2.42, parts: (c) => EYES.almond(c, 0.27) },
      sh: [0.45, 2.05], hand: [0, -0.64, 0.3],
      arm: (sx) => [
        cloth(CAP, N, [0, -0.22, 0], [0.16, 0.18, 0.16]), cloth(CYL, P, [0, -0.5, 0.02], [0.2, 0.06, 0.2]), part(SPH, P, [0, -0.62, 0.04], 0.15),
        ...(sx < 0 ? [metal(BOX, AU, [0, -0.64, 0.16], [0.28, 0.05, 0.06]), glow(CONE4, gl, [0, -0.64, 0.48], [0.09, 0.6, 0.15], [PI / 2, 0, 0]), glow(CONE4, 0xffffff, [0, -0.64, 0.48], [0.04, 0.5, 0.07], [PI / 2, 0, 0])] : []),
      ],
      legX: 0.2, leg: () => [],
      skirt: { at: [0, 1.4, 0.2], parts: [-0.18, 0, 0.18].map((x) => glow(CONE4, x ? gl : P, [x, -0.3, 0], [0.07, 0.5, 0.05], [PI, 0, x])) },
      back: { at: [0, 1.4, -0.3], parts: [glow(CONE, gl, [0, -0.25, -0.4], [0.32, 1.0, 0.32], [-2.0, 0, 0]), cloth(CONE, ND, [0, -0.1, -0.2], [0.42, 0.7, 0.34], [-2.1, 0, 0])] },
      halo: ring(3, (k, a) => [glow(SPH, k % 2 ? AU : gl, [Math.cos(a) * 1.05, 2.2 + (k % 2) * 0.3, Math.sin(a) * 1.05], 0.13)]),
      extras: [{
        parent: 'lean', at: [0, 2.82, -0.1],
        parts: [glow(CONE, gl, [0, 0.2, 0], [0.24, 0.5, 0.24]), glow(CONE, 0xffffff, [0, 0.12, 0.02], [0.1, 0.26, 0.1])],
        anim: (g, t) => { g.scale.set(1, 1 + Math.sin(t * 13) * 0.15 + Math.sin(t * 7.3) * 0.1, 1); g.rotation.z = Math.sin(t * 5) * 0.15; },
      }],
    };
  },

  razor(gl) {
    const IV = 0xF2EEE3, IVD = 0xD9D3C4, V = 0xD8323C, INK = 0x1C1C22;
    const tri = (c, p, s, r) => part(CONE4, c, p, s, r);
    const fan = (sx) => [part(FAN, V, [0, -0.85, 0.18], [0.95, 1, 0.95], [PI / 2, 0, PI / 2]), part(FAN, IV, [sx * 0.02, -0.85, 0.2], [0.86, 1.2, 0.86], [PI / 2, 0, PI / 2]),
      ...[0.4, 0.9, 1.4].map((a) => rubber(BOX, INK, [sx * 0.03, -0.85 + Math.cos(a) * 0.2, 0.2 + Math.sin(a) * 0.2], [0.02, 0.4, 0.02], [a - PI / 2, 0, 0]))];
    return {
      hip: 1.3, scale: [0.95, 1.08], gait: { cad: 1.3, swing: 1.1, bob: 0.06, lean: 0.5, float: 0, sq: 0.03 },
      body: [
        rubber(RBOX, INK, [0, 1.3, 0], [0.5, 0.2, 0.26]), part(BOX, V, [0, 1.42, 0], [0.55, 0.1, 0.28]),
        tri(IV, [0, 1.92, 0], [0.95, 0.95, 0.3], [PI, 0, 0]), tri(IVD, [0, 1.98, -0.04], [1.05, 0.7, 0.24], [PI, 0, 0]),
        ...both((sx) => [part(BOX, V, [sx * 0.1, 1.98, 0.13], [0.05, 0.65, 0.04], [0, 0, sx * 0.45]), tri(IV, [sx * 0.52, 2.25, 0], [0.12, 0.55, 0.2], [0, 0, sx * -1.3])]),
        rubber(CYL, INK, [0, 2.32, 0], [0.12, 0.14, 0.12]),
        part(OCT, IV, [0, 2.55, 0], [0.36, 0.48, 0.28]), rubber(BOX, INK, [0, 2.56, 0.1], [0.34, 0.09, 0.06]),
        tri(V, [0, 2.78, -0.24], [0.1, 0.7, 0.06], [-1.1, 0, 0]), tri(IV, [0, 2.48, 0.18], [0.08, 0.28, 0.06], [PI / 2, 0, 0]),
      ],
      eyes: { y: 2.56, parts: (c) => EYES.wide(c, 0.14, 0.08) },
      sh: [0.5, 2.15], hand: [0, -0.8, 0.35],
      arm: (sx) => [tri(IV, [0, -0.35, 0], [0.42, 0.75, 0.14], [PI, 0, 0]), part(BOX, V, [0, -0.06, 0], [0.2, 0.05, 0.08]), rubber(CAP, INK, [0, -0.62, 0.02], [0.12, 0.14, 0.12]), part(SPH, IV, [0, -0.8, 0.04], 0.13), ...fan(sx)],
      legX: 0.17,
      leg: () => [rubber(CAP, INK, [0, -0.3, 0], [0.17, 0.26, 0.17]), part(CAP, IV, [0, -0.85, 0], [0.16, 0.22, 0.16]), rubber(RBOX, INK, [0, -1.24, 0.08], [0.16, 0.12, 0.4]), tri(IV, [0, -1.22, 0.32], [0.12, 0.2, 0.06], [PI / 2, 0, 0])],
      skirt: { at: [0, 1.35, 0.12], parts: [tri(IV, [0, -0.35, 0], [0.4, 0.7, 0.05], [PI, 0, 0]), part(BOX, V, [0, -0.04, 0.01], [0.4, 0.05, 0.05])] },
      back: { at: [0, 2.0, -0.18], parts: both((sx) => [tri(IVD, [sx * 0.42, 0.25, -0.1], [0.25, 1.1, 0.06], [0, 0, sx * -0.9]), tri(V, [sx * 0.6, 0.45, -0.12], [0.08, 0.5, 0.04], [0, 0, sx * -0.9]), tri(IV, [sx * 0.15, -0.85, -0.05], [0.25, 1.1, 0.05], [PI, 0, sx * 0.1])]) },
      update(m, t, dt, mv, h) {
        const k = m._fold = ease(m._fold ?? 1, live(h, 'fold') ? 0.14 : 1, dt, 18);
        m.lean.scale.x = k;
      },
    };
  },

  solace(gl) {
    const RB = 0xE9E2F5, LV = 0x7C6FB0, AU = 0xC9A24B, SK = 0xF6EEE8, WARM = 0xFFF0B8;
    return {
      hip: 1.0, scale: [0.95, 1.08], gait: { cad: 0.6, swing: 0.15, bob: 0.03, lean: 0.12, float: 0.12, sq: 0.02 },
      body: [
        cloth(CONE, RB, [0, 0.95, 0], [1.25, 1.9, 1.05]), metal(CYL, AU, [0, 0.06, 0], [1.26, 0.07, 1.06]),
        cloth(RBOX, LV, [0, 0.85, 0.28], [0.34, 1.3, 0.04], [0.27, 0, 0]), glow(BOX, gl, [0, 0.85, 0.31], [0.04, 1.2, 0.02], [0.27, 0, 0]),
        cloth(TAPER, RB, [0, 1.85, 0], [0.75, 0.7, 0.55]), cloth(DOME, LV, [0, 2.06, 0], [0.95, 0.35, 0.7]), metal(RING, AU, [0, 2.07, 0], [0.95, 0.7, 0.8], [PI / 2, 0, 0]),
        cloth(CYL, RB, [0, 2.28, -0.04], [0.38, 0.22, 0.34]), metal(CYL, AU, [0, 2.38, -0.04], [0.4, 0.04, 0.36]),
        cloth(SPH, RB, [0, 2.5, -0.03], [0.42, 0.46, 0.44]), part(SPH, SK, [0, 2.48, 0.07], [0.3, 0.32, 0.28]),
        metal(CYL, AU, [0, 2.62, 0], [0.44, 0.05, 0.44]), glow(OCT, gl, [0, 2.62, 0.22], 0.09), cloth(RBOX, RB, [0, 2.25, -0.24], [0.4, 0.6, 0.06], [-0.1, 0, 0]),
      ],
      eyes: { y: 2.5, parts: (c) => EYES.dots(c, 0.2, 0.07, 0.05) },
      sh: [0.44, 2.05], hand: [0, -0.86, 0.3],
      arm: (sx) => [
        cloth(CONE, RB, [0, -0.42, 0.02], [0.42, 0.75, 0.42]), metal(CYL, AU, [0, -0.78, 0.02], [0.4, 0.05, 0.4]), part(SPH, SK, [0, -0.86, 0.05], 0.14),
        ...(sx < 0 ? [metal(CYL, AU, [0, -0.3, 0.28], [0.06, 2.4, 0.06]), metal(ARC, AU, [0, 0.95, 0.28], [0.36, 0.36, 0.36], [0, 0, PI * 0.02]),
          ...[-0.14, 0, 0.14].map((x, k) => glow(CYL, k === 1 ? WARM : gl, [x, 0.72 - (k === 1 ? 0.06 : 0), 0.28], [0.05, 0.3, 0.05])), glow(SPH, WARM, [0, 1.08, 0.28], 0.16)] : []),
      ],
      legX: 0.16,
      leg: () => [cloth(CAP, LV, [0, -0.55, 0], [0.12, 0.3, 0.12]), metal(RBOX, AU, [0, -0.96, 0.12], [0.16, 0.08, 0.3])],
      back: { at: [0, 1.9, -0.3], parts: both((sx) => [cloth(RBOX, LV, [sx * 0.12, -0.6, -0.1], [0.1, 1.2, 0.03]), metal(BOX, AU, [sx * 0.12, -1.2, -0.1], [0.1, 0.05, 0.04])]) },
      halo: ring(4, (k, a) => [metal(CYL, AU, [Math.cos(a) * 1.15, 2.4 + (k % 2) * 0.2, Math.sin(a) * 1.15], [0.07, 0.4, 0.07]), glow(SPH, k % 2 ? gl : WARM, [Math.cos(a) * 1.15, 2.18 + (k % 2) * 0.2, Math.sin(a) * 1.15], 0.07)]),
      extras: [{
        parent: 'lean', at: [0, 2.25, -0.58],
        parts: [glow(RING, gl, [0, 0, 0], [1.25, 2.0, 1.2]), metal(RING, AU, [0, 0, -0.02], [1.42, 2.2, 1.0]),
          ...ring(8, (k, a) => [glow(BOX, WARM, [Math.cos(a) * 0.35, Math.sin(a) * 0.55, 0], [0.03, 0.35, 0.02], [0, 0, a - PI / 2])])],
        anim: (g, t) => { g.rotation.z = Math.sin(t * 0.6) * 0.04; g.scale.setScalar(1 + Math.sin(t * 2) * 0.025); },
      }],
    };
  },

  brine(gl) {
    const C = 0x1F3B63, BR = 0xC7A04A, SW = 0xF2FBFF, LD = 0x3A4048, LE = 0x4A3420, TK = 0x2E8B83;
    const port = (x, z, ry, s) => [metal(RING, BR, [x, 2.55, z], [s, s, 0.7], [0, ry, 0]), glass(CYL, 0x9FE8DC, [x * 0.97, 2.55, z * 0.97], [s * 0.88, 0.04, s * 0.88], [PI / 2, ry, 0])];
    return {
      hip: 1.05, scale: [1.08, 1.0], gait: { cad: 0.75, swing: 0.55, bob: 0.16, lean: 0.1, float: 0, sq: 0.1 },
      body: [
        cloth(CYL, C, [0, 1.08, 0], [0.72, 0.35, 0.6]), rubber(CYL, LE, [0, 1.25, 0], [0.78, 0.09, 0.64]),
        ...[-0.22, 0, 0.22].map((x) => part(RBOX, LD, [x, 1.25, 0.32], [0.16, 0.14, 0.08], undefined, 'steel')),
        cloth(TAPER, C, [0, 1.68, 0], [1.05, 0.8, 0.8]), cloth(BOX, SW, [0, 1.6, 0.36], [0.5, 0.06, 0.03]),
        metal(CYL, BR, [0, 2.1, 0], [0.95, 0.2, 0.75]), metal(DOME, BR, [0, 2.0, 0.2], [0.62, 0.22, 0.4], [PI / 2, 0, 0]),
        ...ring(8, (k, a) => [part(OCT, LD, [Math.cos(a) * 0.47, 2.2, Math.sin(a) * 0.37], 0.06, undefined, 'steel')]),
        metal(SPH, BR, [0, 2.55, 0], [0.66, 0.64, 0.66]), ...port(0, 0.32, 0, 0.36), ...both((sx) => port(sx * 0.32, 0, sx * PI / 2, 0.22)),
        ...[-0.06, 0.06].map((x) => part(BOX, LD, [x, 2.55, 0.34], [0.02, 0.3, 0.02], undefined, 'steel')),
        metal(CYL, BR, [0, 2.9, 0], [0.12, 0.12, 0.12]), glow(SPH, gl, [0, 2.98, 0], 0.06),
      ],
      eyes: { y: 2.55, parts: (c) => EYES.dots(c, 0.33, 0.07, 0.06) },
      sh: [0.66, 2.0], hand: [0, -0.85, 0.9],
      arm: (sx) => [
        cloth(CAP, C, [0, -0.28, 0], [0.28, 0.24, 0.28]), metal(CYL, BR, [0, -0.55, 0.02], [0.3, 0.06, 0.3]), cloth(CAP, C, [0, -0.78, 0.04], [0.26, 0.18, 0.26]),
        metal(CYL, BR, [0, -0.92, 0.04], [0.3, 0.06, 0.3]), rubber(SPH, LE, [0, -1.05, 0.06], 0.24),
        ...(sx < 0 ? [metal(CYL, BR, [0, -0.85, 0.45], [0.34, 0.85, 0.34], [PI / 2, 0, 0]), ...[0.2, 0.6].map((z) => part(CYL, LD, [0, -0.85, z], [0.38, 0.06, 0.38], [PI / 2, 0, 0], 'steel')),
          glow(CYL, gl, [0, -0.85, 0.88], [0.24, 0.03, 0.24], [PI / 2, 0, 0]), part(SPH, SW, [0.12, -0.7, 0.55], 0.1, undefined, 'stone'), part(SPH, SW, [-0.1, -0.72, 0.3], 0.08, undefined, 'stone')]
          : [glass(SPH, 0xCFFFF4, [0, -1.2, 0.2], 0.36), glow(SPH, gl, [0, -1.2, 0.2], 0.2), metal(CYL, BR, [0, -1.02, 0.2], [0.1, 0.06, 0.1])]),
      ],
      legX: 0.27,
      leg: () => [cloth(CAP, C, [0, -0.28, 0], [0.3, 0.24, 0.3]), metal(SPH, BR, [0, -0.5, 0.12], 0.15), cloth(CAP, C, [0, -0.66, 0], [0.28, 0.16, 0.28]), part(RBOX, LD, [0, -0.9, 0.08], [0.38, 0.3, 0.55], undefined, 'steel'), metal(RBOX, BR, [0, -0.92, 0.33], [0.3, 0.12, 0.1])],
      back: { at: [0, 1.75, -0.42], parts: [
        ...both((sx) => [part(CYL, TK, [sx * 0.22, 0, -0.1], [0.3, 0.85, 0.3]), metal(DOME, BR, [sx * 0.22, 0.42, -0.1], [0.3, 0.16, 0.3]), cloth(CYL, SW, [sx * 0.22, -0.1, -0.1], [0.31, 0.08, 0.31]),
          rubber(CYL, DARK, [sx * 0.2, 0.62, 0.0], [0.06, 0.5, 0.06], [0.6, 0, 0])])] },
    };
  },

  longshot(gl) {
    const OL = 0x3E4B40, OD = 0x2C352D, CU = 0xC57A3A, TN = 0xB8A27A, LE = 0x2C2620, ST = 0x6E7681;
    const tripod = ring(3, (k, a) => [metal(CYL, ST, [Math.cos(a) * 0.5, 0.68, Math.sin(a) * 0.5], [0.07, 1.5, 0.07], [Math.sin(a) * 0.36, 0, -Math.cos(a) * 0.36]), metal(SPH, CU, [Math.cos(a) * 0.95, 0.05, Math.sin(a) * 0.95], 0.1)]);
    return {
      hip: 1.35, scale: [0.92, 1.12], gait: { cad: 0.8, swing: 1.05, bob: 0.06, lean: 0.2, float: 0, sq: 0.03 },
      body: [
        rubber(RBOX, LE, [0, 1.35, 0], [0.46, 0.24, 0.34]), rubber(CYL, LE, [0, 1.47, 0], [0.5, 0.07, 0.38]), ...both((sx) => [part(RBOX, TN, [sx * 0.2, 1.42, 0.16], [0.12, 0.14, 0.1], undefined, 'cloth')]),
        cloth(TAPER, OL, [0, 1.9, 0], [0.72, 0.75, 0.5]), cloth(CONE, TN, [0, 2.02, 0], [0.95, 0.5, 0.75]), metal(BOX, CU, [0, 1.8, 0.24], [0.3, 0.04, 0.03], [0, 0, 0.6]),
        cloth(CYL, OD, [0, 2.24, 0], [0.32, 0.12, 0.3]), rubber(SPH, LE, [0, 2.47, -0.01], [0.38, 0.4, 0.4]), cloth(CYL, OD, [0, 2.38, 0.03], [0.36, 0.14, 0.36]),
        metal(CYL, CU, [-0.1, 2.5, 0.28], [0.14, 0.22, 0.14], [PI / 2, 0, 0]), glow(CYL, gl, [-0.1, 2.5, 0.4], [0.11, 0.02, 0.11], [PI / 2, 0, 0]), metal(RING, CU, [0, 2.53, 0], [0.42, 0.42, 0.6], [PI / 2, 0, 0]),
      ],
      eyes: { y: 2.5, parts: (c) => [part(CYL, c, [0.1, 0, 0.2], [0.07, 0.04, 0.07], [PI / 2, 0, 0])] },
      sh: [0.42, 2.1], hand: [0, -1.0, 0.6],
      arm: (sx) => [
        cloth(CAP, OL, [0, -0.3, 0], [0.16, 0.26, 0.16]), rubber(CAP, LE, [0, -0.78, 0.03], [0.15, 0.18, 0.15]), metal(CYL, CU, [0, -0.62, 0.03], [0.17, 0.05, 0.17]), rubber(SPH, LE, [0, -0.98, 0.04], 0.13),
        ...(sx < 0 ? [rubber(RBOX, LE, [0, -0.95, 0.5], [0.12, 0.14, 0.9]), part(BOX, ST, [0, -0.9, 1.1], [0.06, 0.06, 1.3], undefined, 'steel'),
          ...both((s) => [metal(CYL, CU, [s * 0.42, -0.9, 1.52], [0.05, 0.9, 0.05], [0, -s * 0.25, s * (PI / 2 - 0.25)])]),
          glow(BOX, gl, [0, -0.9, 1.38], [1.6, 0.015, 0.015]), glow(CONE4, gl, [0, -0.88, 1.85], [0.05, 0.2, 0.05], [PI / 2, 0, 0])] : []),
      ],
      legX: 0.17,
      leg: () => [cloth(CAP, OL, [0, -0.32, 0], [0.17, 0.28, 0.17]), metal(SPH, CU, [0, -0.66, 0.08], 0.11), rubber(CAP, LE, [0, -0.95, 0.02], [0.17, 0.26, 0.17]), rubber(RBOX, LE, [0, -1.29, 0.08], [0.18, 0.12, 0.4])],
      skirt: { at: [0, 1.3, 0.18], parts: both((sx) => [cloth(RBOX, TN, [sx * 0.14, -0.2, 0], [0.18, 0.38, 0.03], [0.1, 0, sx * 0.1])]) },
      back: { at: [0, 1.95, -0.3], parts: [
        cloth(RBOX, OD, [0, 0, -0.12], [0.4, 0.6, 0.22]), metal(CYL, ST, [0.12, 0.75, -0.18], [0.05, 1.5, 0.05]), metal(CYL, CU, [0.12, 1.5, -0.18], [0.36, 0.06, 0.36]),
        metal(RING, CU, [0.12, 1.62, -0.18], [0.7, 0.7, 0.6], [PI / 2, 0, 0]), cloth(BOX, 0xFF6B6B, [0.3, 1.3, -0.18], [0.3, 0.16, 0.02]), glow(SPH, gl, [0.12, 1.68, -0.18], 0.06)] },
      extras: [{ parent: 'rig', at: [0, 0, 0], parts: tripod, anim: (g, t, dt, mv, h) => { const k = g.userData.k = ease(g.userData.k ?? 0, live(h, 'perch') ? 1 : 0, dt, 12); g.visible = k > 0.02; g.scale.set(1, Math.max(0.01, k), 1); } }],
    };
  },

  aurora(gl) {
    const SN = 0xF1F5F8, FU = 0xD9D2C5, TL = 0x2A9D8F, VI = 0xD27BFF, SK = 0xEBD3C2;
    return {
      hip: 1.25, scale: [0.94, 1.05], gait: { cad: 1.15, swing: 0.95, bob: 0.1, lean: 0.3, float: 0, sq: 0.05 },
      body: [
        cloth(CYL, TL, [0, 1.25, 0], [0.5, 0.25, 0.42]), cloth(CONE, SN, [0, 1.42, 0], [0.9, 0.55, 0.72]), cloth(CYL, TL, [0, 1.2, 0], [0.88, 0.06, 0.7]),
        ...ring(8, (k, a) => [glow(OCT, k % 2 ? gl : VI, [Math.sin(a) * 0.44, 1.25, Math.cos(a) * 0.36], 0.06)]),
        cloth(TAPER, SN, [0, 1.8, 0], [0.82, 0.85, 0.62]), cloth(BOX, TL, [0, 1.92, 0.27], [0.5, 0.06, 0.03]), glow(BOX, gl, [0, 1.82, 0.28], [0.36, 0.03, 0.02]),
        cloth(SPH, SN, [0, 2.48, -0.08], [0.55, 0.58, 0.55]), cloth(TORUS, FU, [0, 2.45, 0.08], [0.62, 0.64, 0.6]), part(SPH, SK, [0, 2.45, 0.06], [0.32, 0.34, 0.3]),
      ],
      eyes: { y: 2.47, parts: (c) => EYES.dots(c, 0.21, 0.08, 0.055) },
      sh: [0.48, 2.08], hand: [0, -0.85, 0.5],
      arm: (sx) => [
        cloth(CAP, SN, [0, -0.3, 0], [0.2, 0.25, 0.2]), cloth(CYL, FU, [0, -0.7, 0.02], [0.24, 0.1, 0.24]), cloth(SPH, TL, [0, -0.85, 0.05], 0.16),
        ...(sx < 0 ? [glow(ARC, gl, [0, -0.85, 0.15], [0.95, 0.95, 0.95], [0, -PI / 2, -PI / 2]), glow(ARC, VI, [0, -0.85, 0.1], [0.85, 0.85, 1.2], [0, -PI / 2, -PI / 2]), glow(BOX, 0xffffff, [0, -0.85, 0.15], [0.015, 1.55, 0.015])] : []),
      ],
      legX: 0.17,
      leg: () => [cloth(CAP, TL, [0, -0.3, 0], [0.19, 0.26, 0.19]), cloth(CYL, FU, [0, -0.72, 0.02], [0.27, 0.12, 0.27]), cloth(CAP, SN, [0, -0.95, 0.02], [0.2, 0.16, 0.2]), part(RBOX, TL, [0, -1.19, 0.08], [0.22, 0.12, 0.42])],
      back: { at: [0, 2.1, -0.3], parts: [-0.22, 0, 0.22].map((x, k) => glow(BOX, k === 1 ? VI : gl, [x, -0.65 - (k === 1 ? 0.15 : 0), -0.32], [0.14, 1.6, 0.02], [0.35, 0, x * 0.4])) },
      extras: [{
        parent: 'lean', at: [0, 2.1, -0.3],
        parts: both((sx) => [glow(BOX, sx < 0 ? VI : gl, [sx * 0.42, -0.5, -0.1], [0.08, 1.1, 0.015], [0.25, 0, sx * 0.25])]),
        anim: (g, t, dt, mv) => { g.rotation.x = 0.2 + Math.sin(t * 2.5) * 0.12 + mv * 0.5; },
      }],
    };
  },

  petal(gl) {
    const J = 0x2D6B66, LI = 0xF4E6FF, VI = 0xC58CFF, AU = 0xFFF0A8, SK = 0xF1D2BF, HR = 0x4B2E6B;
    const tutu = [
      ...ring(10, (k, a) => [part(SPH, k % 2 ? LI : 0xFFFFFF, [Math.cos(a) * 0.48, 0, Math.sin(a) * 0.48], [0.46, 0.08, 0.26], [0, -a, 0.18])]),
      ...ring(10, (k, a) => [part(SPH, VI, [Math.cos(a + 0.31) * 0.36, 0.05, Math.sin(a + 0.31) * 0.36], [0.34, 0.06, 0.2], [0, -a - 0.31, 0.28])]),
      glow(RING, AU, [0, 0.07, 0], [0.62, 0.62, 0.8], [PI / 2, 0, 0]),
    ];
    return {
      hip: 1.32, scale: [0.92, 1.06], gait: { cad: 1.2, swing: 0.8, bob: 0.14, lean: 0.12, float: 0, sq: 0.06, sway: 0.1 },
      body: [
        cloth(CYL, J, [0, 1.32, 0], [0.42, 0.22, 0.36]), cloth(TAPER, J, [0, 1.78, 0], [0.62, 0.75, 0.45]),
        ...both((sx) => [part(SPH, LI, [sx * 0.12, 1.95, 0.17], [0.2, 0.26, 0.08], [0, 0, sx * 0.3])]), glow(OCT, AU, [0, 1.8, 0.22], 0.08),
        part(CYL, SK, [0, 2.2, 0], [0.14, 0.16, 0.14]), part(SPH, SK, [0, 2.42, 0.01], [0.34, 0.38, 0.36]), part(SPH, HR, [0, 2.48, -0.05], [0.37, 0.37, 0.38]),
        part(SPH, HR, [0, 2.7, -0.1], 0.22), ...ring(6, (k, a) => [part(CONE4, k % 2 ? LI : VI, [Math.cos(a) * 0.14, 2.84, -0.1 + Math.sin(a) * 0.14], [0.1, 0.22, 0.06], [Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6])]),
        glow(SPH, AU, [0, 2.86, -0.1], 0.07),
      ],
      eyes: { y: 2.42, parts: (c) => EYES.dots(c, 0.18, 0.08, 0.05) },
      sh: [0.36, 2.06], hand: [0, -0.95, 0.3],
      arm: (sx) => [
        part(CAP, SK, [0, -0.3, 0], [0.11, 0.26, 0.11]), cloth(CAP, J, [0, -0.75, 0.02], [0.1, 0.16, 0.1]), part(SPH, SK, [0, -0.94, 0.03], 0.1),
        part(SPH, LI, [sx * 0.08, -0.95, 0.18], [0.12, 0.85, 0.58], [0.3, 0, 0]), part(SPH, VI, [sx * 0.1, -0.95, 0.18], [0.1, 0.6, 0.4], [0.3, 0, 0]), glow(BOX, AU, [sx * 0.15, -0.95, 0.18], [0.02, 0.6, 0.03], [0.3, 0, 0]),
      ],
      legX: 0.14,
      leg: () => [cloth(CAP, J, [0, -0.32, 0], [0.13, 0.28, 0.13]), part(SPH, LI, [0, -0.62, 0.06], 0.1), cloth(CAP, J, [0, -0.92, 0], [0.12, 0.26, 0.12]), part(RBOX, LI, [0, -1.27, 0.06], [0.12, 0.1, 0.3]), cloth(CYL, VI, [0, -1.12, 0], [0.14, 0.03, 0.14])],
      back: { at: [0, 1.9, -0.2], parts: both((sx) => [cloth(BOX, VI, [sx * 0.12, -0.5, -0.1], [0.08, 1.1, 0.02], [0.15, 0, sx * 0.1])]) },
      extras: [{
        parent: 'lean', at: [0, 1.42, 0], parts: tutu,
        anim: (g, t, dt, mv, h) => { g.rotation.y += dt * (0.5 + mv * 2 + (live(h, 'waltz') ? 5 : 0)); const s = 1 + mv * 0.12 + Math.sin(t * 3) * 0.02; g.scale.set(s, 1, s); },
      }],
    };
  },

  beacon(gl) {
    const WH = 0xF2F2EE, RD = 0xC8323A, BR = 0xC9A24B, ST = 0x8A8F98, DK = 0x2A2F38;
    const band = (y, h) => { const r = 0.515 - 0.14 * (y - 1.1); return part(CYL, RD, [0, y, 0], [r * 2.8, h, r * 2.4]); }; // red stripes hug the taper
    return {
      hip: 1.0, scale: [1.05, 1.08], gait: { cad: 0.8, swing: 0.6, bob: 0.08, lean: 0.08, float: 0, sq: 0.05 },
      body: [
        stone(CYL, ST, [0, 1.0, 0], [0.85, 0.3, 0.75]), part(TOWER, WH, [0, 1.6, 0], [1.4, 1.0, 1.2]), band(1.45, 0.2), band(1.85, 0.2),
        rubber(RBOX, DK, [0, 1.3, 0.6], [0.16, 0.24, 0.04]), ...[1.62, 2.0].map((y) => glow(RBOX, gl, [0, y, 0.52 - (y - 1.6) * 0.1], [0.1, 0.12, 0.03])),
        part(CYL, DK, [0, 2.12, 0], [1.15, 0.06, 1.0], undefined, 'steel'), part(RING, DK, [0, 2.26, 0], [1.12, 0.98, 0.6], [PI / 2, 0, 0], 'steel'),
        ...ring(8, (k, a) => [part(BOX, DK, [Math.cos(a) * 0.55, 2.2, Math.sin(a) * 0.48], [0.03, 0.14, 0.03], undefined, 'steel')]),
        glass(CYL, 0xFFF8D6, [0, 2.47, 0], [0.5, 0.42, 0.5]), glow(SPH, gl, [0, 2.47, 0], 0.26),
        ...ring(4, (k, a) => [metal(BOX, BR, [Math.cos(a + PI / 4) * 0.25, 2.47, Math.sin(a + PI / 4) * 0.25], [0.03, 0.42, 0.03])]),
        part(DOME, RD, [0, 2.68, 0], [0.62, 0.38, 0.62]), metal(CONE, BR, [0, 2.92, 0], [0.1, 0.22, 0.1]), metal(SPH, BR, [0, 3.05, 0], 0.08),
      ],
      eyes: { y: 2.47, parts: (c) => EYES.wide(c, 0.27, 0.1) },
      sh: [0.72, 1.98], hand: [0, -1.0, 0.35],
      arm: (sx) => [
        part(CAP, WH, [0, -0.28, 0], [0.26, 0.24, 0.26]), part(CYL, RD, [0, -0.5, 0.02], [0.28, 0.08, 0.28]), part(CAP, WH, [0, -0.75, 0.03], [0.24, 0.18, 0.24]), metal(SPH, BR, [0, -1.0, 0.05], 0.22),
        ...(sx < 0 ? [metal(CYL, BR, [0, -0.6, 0.3], [0.06, 1.8, 0.06]), glass(CYL, 0xFFF8D6, [0, 0.38, 0.3], [0.2, 0.24, 0.2]), glow(SPH, gl, [0, 0.38, 0.3], 0.09), part(DOME, RD, [0, 0.5, 0.3], [0.24, 0.12, 0.24])]
          : [part(TORUS, WH, [sx * 0.16, -0.92, 0.12], [0.7, 0.7, 0.7], [0, PI / 2, 0]), ...ring(4, (k, a) => [part(BOX, RD, [sx * 0.16, -0.92 + Math.cos(a) * 0.35, 0.12 + Math.sin(a) * 0.35], [0.14, 0.12, 0.14], [a, 0, 0])])]),
      ],
      legX: 0.28,
      leg: () => [stone(CAP, ST, [0, -0.3, 0], [0.3, 0.24, 0.3]), rubber(RBOX, DK, [0, -0.82, 0.06], [0.36, 0.36, 0.5]), part(RBOX, RD, [0, -0.9, 0.3], [0.3, 0.12, 0.08])],
      back: { at: [0, 1.75, -0.55], parts: [part(TORUS, 0xB8A27A, [0, 0, -0.05], [0.55, 0.55, 0.9], undefined, 'cloth'), metal(CONE, BR, [0, -0.1, -0.12], [0.22, 0.24, 0.22]), metal(SPH, BR, [0, -0.24, -0.12], 0.06)] },
      extras: [{
        parent: 'lean', at: [0, 2.47, 0],
        parts: [glow(CONE, gl, [0.42, 0, 0], [0.2, 0.75, 0.2], [0, 0, PI / 2]), glow(CONE, gl, [-0.42, 0, 0], [0.2, 0.75, 0.2], [0, 0, -PI / 2])],
        anim: (g, t, dt) => { g.rotation.y += dt * 1.8; },
      }],
    };
  },
};

// Assemble a body description into the rig hero.js drives.
export function buildWave2A(spec, def, team = 0) {
  const gl = new THREE.Color(def.basic?.color ?? def.accent).lerp(new THREE.Color(0xffffff), 0.1).getHex();
  const B = BUILD[def.id](gl);
  const mat = toonMat({ vertexColors: true, finish: true, rim: 0.3 });
  const mesh = (parts, k = 0.03) => (parts?.length ? toonMesh(mergeParts(parts), mat, k) : new THREE.Object3D());
  const lean = new THREE.Group();
  lean.add(mesh(B.body));

  const vc = new THREE.Color(TEAM[team].main).lerp(new THREE.Color(0xffffff), 0.35).getHex();
  const eyes = new THREE.Mesh(mergeParts(B.eyes.parts(vc)), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
  eyes.position.y = B.eyes.y;
  lean.add(eyes);

  const [ax, ay] = B.sh;
  const arms = [-1, 1].map((sx) => {
    const g = new THREE.Group();
    g.position.set(sx * ax, ay, 0);
    g.add(mesh(B.arm(sx)));
    lean.add(g);
    return g;
  });
  const hand = new THREE.Object3D();
  hand.position.set(...(B.hand ?? [0, -1.0, 0.4]));
  arms[0].add(hand);
  const orb = new THREE.Mesh(SPH, new THREE.MeshBasicMaterial({ color: new THREE.Color(gl).multiplyScalar(1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  orb.visible = false;
  hand.add(orb);

  const skirt = new THREE.Group();
  skirt.position.set(...(B.skirt?.at ?? [0, B.hip, 0.2]));
  skirt.add(mesh(B.skirt?.parts, 0.02));
  lean.add(skirt);
  const tail = new THREE.Group();
  tail.position.set(...(B.back?.at ?? [0, B.hip + 0.8, -0.3]));
  tail.add(mesh(B.back?.parts));
  lean.add(tail);

  const legs = [-1, 1].map((sx) => {
    const g = new THREE.Group();
    g.position.set(sx * B.legX, B.hip, 0);
    g.add(mesh(B.leg(sx)));
    return g;
  });

  const rig = new THREE.Group();
  rig.scale.set(B.scale[0], B.scale[1], B.scale[0]);
  rig.add(lean, ...legs);
  let halo = null;
  if (B.halo) {
    halo = new THREE.Group();
    halo.add(mesh(B.halo, 0.02));
    rig.add(halo);
  }
  const extras = (B.extras ?? []).map((x) => {
    const g = new THREE.Group();
    g.position.set(...x.at);
    g.add(mesh(x.parts, 0.02));
    (x.parent === 'rig' ? rig : lean).add(g);
    return { g, anim: x.anim };
  });
  const root = new THREE.Group();
  root.add(rig);
  const m = { root, lean, eyes, tail, legs, arms, skirt, hand, orb, halo, style: spec.style ?? 'base', gait: B.gait, mats: [mat] };
  // Per-frame hook (hero.js render): live parts follow the hero's state.
  m.update = (t, dt, mv, h) => {
    for (const x of extras) x.anim?.(x.g, t, dt, mv, h, m);
    B.update?.(m, t, dt, mv, h);
  };
  return m;
}
