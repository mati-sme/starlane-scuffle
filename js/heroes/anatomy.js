// v7.3 shared anatomy kit: geometry, part finishes, limbs and real faces (skin, nose, eyes, ears, hair) for the bespoke
// champion bodies in forms_*.js / wave2a_models.js / wave2b_models.js. Nothing here is a robot kit: each body picks its
// own head, limbs and dress, so no two champions share a template. Parts are authored in absolute rig space.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toonMat, toonMesh, mergeParts } from '../render/toon.js';

export const PI = Math.PI;
export const BOX = new THREE.BoxGeometry(1, 1, 1);
export const RBOX = new RoundedBoxGeometry(1, 1, 1, 1, 0.16);
export const SOFT = new RoundedBoxGeometry(1, 1, 1, 2, 0.32); // pillowy box: fur, cloth bundles, clay
export const TAPER = new THREE.CylinderGeometry(0.62, 0.42, 1, 10).rotateY(PI / 10); // chest, wide at the top
export const VEE = new THREE.CylinderGeometry(0.66, 0.36, 1, 10).rotateY(PI / 10); // athletic V torso
export const BELL = new THREE.CylinderGeometry(0.22, 0.5, 1, 14, 1, true); // open robe / skirt flare
export const SKIRT = new THREE.CylinderGeometry(0.3, 0.5, 1, 14); // closed flare
export const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
export const CYL6 = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
export const HEX = CYL6;
export const CONE = new THREE.ConeGeometry(0.5, 1, 12);
export const CONE4 = new THREE.ConeGeometry(0.5, 1, 4);
export const CONE6 = new THREE.ConeGeometry(0.5, 1, 6);
export const OCT = new THREE.OctahedronGeometry(0.5);
export const ICO = new THREE.IcosahedronGeometry(0.5, 0);
export const ICO1 = new THREE.IcosahedronGeometry(0.5, 1); // lumpy rock / cloud
export const DODE = new THREE.DodecahedronGeometry(0.5, 0);
export const TETRA = new THREE.TetrahedronGeometry(0.5);
export const SPH = new THREE.SphereGeometry(0.5, 14, 10);
export const HEAD = new THREE.SphereGeometry(0.5, 18, 14); // smoother skull for faces
export const DOME = new THREE.SphereGeometry(0.5, 16, 6, 0, PI * 2, 0, PI / 2);
export const CAP = new THREE.CapsuleGeometry(0.5, 1, 3, 10);
export const RING = new THREE.TorusGeometry(0.5, 0.07, 5, 20);
export const TORUS = new THREE.TorusGeometry(0.5, 0.2, 8, 18);
export const WHEEL = new THREE.TorusGeometry(0.5, 0.05, 4, 22);
export const FAN = new THREE.CylinderGeometry(0.5, 0.5, 0.04, 14, 1, false, 0, PI);
export const ARC = new THREE.TorusGeometry(0.85, 0.05, 4, 18, PI * 0.95);
export const HALFRING = new THREE.TorusGeometry(0.5, 0.06, 4, 14, PI);
export const PLANE = new THREE.BoxGeometry(1, 1, 0.02); // paper / cloth sheet
// A flat leaf / feather / petal blade: a thin rounded ellipse (SHARD keeps the old pointed diamond).
export const LEAF = new THREE.SphereGeometry(0.5, 10, 6).scale(1, 1, 0.18);
export const SHARD = new THREE.OctahedronGeometry(0.5).scale(1, 1, 0.18);

export const DARK = 0x1C2029, TRIM = 0xB4BAC4, BRASS = 0xC9963A, GOLD = 0xE8C060, WOOD = 0x6A4A30, ROPE = 0xC9B48A, STEEL = 0x8A919C;
// Skin tones (warm range) and hair colors shared by the human / elf / dwarf faces.
export const SKIN = { fair: 0xF1D3BE, rose: 0xEBC3AA, tan: 0xD7A27E, brown: 0xA8714E, deep: 0x7A4E36, olive: 0xC69C74 };
export const HAIR = { black: 0x221E24, brown: 0x5A3A26, auburn: 0x8E3E22, blond: 0xE2C37A, silver: 0xDCE2EA, white: 0xF4F4F0, navy: 0x23304F };

export const shade = (c, k) => new THREE.Color(c).multiplyScalar(k).getHex();
export const tint = (c, to, k) => new THREE.Color(c).lerp(new THREE.Color(to), k).getHex();
export const ground = (c, k) => { const col = new THREE.Color(c), l = col.r * 0.3 + col.g * 0.59 + col.b * 0.11; return col.lerp(new THREE.Color(l, l, l), k).getHex(); };

export const part = (g, c, p, s = 1, r, f = 'paint') => ({ g, c, p, s, r, f });
export const metal = (g, c, p, s, r) => part(g, c, p, s, r, 'metal');
export const steel = (g, c, p, s, r) => part(g, c, p, s, r, 'steel');
export const cloth = (g, c, p, s, r) => part(g, c, p, s, r, 'cloth');
export const glow = (g, c, p, s, r) => part(g, c, p, s, r, 'glow');
export const rubber = (g, c, p, s, r) => part(g, c, p, s, r, 'rubber');
export const stone = (g, c, p, s, r) => part(g, c, p, s, r, 'stone');
export const glass = (g, c, p, s, r) => part(g, c, p, s, r, 'glass');
export const skin = (g, c, p, s, r) => part(g, c, p, s, r, 'skin');
export const fur = (g, c, p, s, r) => part(g, c, p, s, r, 'fur');
export const wood = (g, c, p, s, r) => part(g, c, p, s, r, 'wood');
// Translucent parts (ghost bodies, slime, ice, light ribbons) go into a second, see-through material.
export const clear = (g, c, p, s, r, f = 'glass') => ({ ...part(g, c, p, s, r, f), clear: true });
export const both = (fn) => [...fn(-1), ...fn(1)];
export const ring = (n, fn) => Array.from({ length: n }, (_, k) => fn(k, (k / n) * PI * 2)).flat();
export const live = (h, tag) => !!h?.effects?.some((e) => e.tag === tag);
export const ease = (cur, to, dt, k = 10) => cur + (to - cur) * (1 - Math.exp(-k * dt));

// Shift / scale a part list (authored in absolute space) about a pivot.
export const move = (P, [dx, dy, dz]) => P.map((q) => ({ ...q, p: [q.p[0] + dx, q.p[1] + dy, q.p[2] + dz] }));
export const scaleAbout = (P, [cx, cy, cz], k) => P.map((q) => ({ ...q, p: [cx + (q.p[0] - cx) * k, cy + (q.p[1] - cy) * k, cz + (q.p[2] - cz) * k], s: (typeof q.s === 'number' ? [q.s, q.s, q.s] : q.s).map((v) => v * k) }));
export const mirror = (P) => P.map((q) => ({ ...q, p: [-q.p[0], q.p[1], q.p[2]], r: q.r ? [q.r[0], -q.r[1], -q.r[2]] : q.r }));

// A limb / strap / rod between two joints: capsule (or any y-aligned unit geometry) stretched from a to b.
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _Y = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3();
export function seg(a, b, r, c, f = 'paint', g = CAP) {
  _d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const L = _d.length() || 0.001, [rx, rz] = Array.isArray(r) ? r : [r, r];
  _e.setFromQuaternion(_q.setFromUnitVectors(_Y, _d.normalize()));
  return { g, c, f, p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], s: [rx * 2, g === CAP ? L / 2 : L, rz * 2], r: [_e.x, _e.y, _e.z] };
}
// A curved chain of segments through points (tails, tentacles, scarves, chains of fur).
export function chain(pts, r0, r1, c, f = 'paint', g = CAP) {
  const out = [];
  for (let k = 0; k < pts.length - 1; k++) out.push(seg(pts[k], pts[k + 1], r0 + (r1 - r0) * (k / Math.max(1, pts.length - 2)), c, f, g));
  return out;
}

// ── torso ──
// An organic torso instead of a can: abdomen taper + rounded ribcage + a soft shoulder yoke (no flat shelf on top).
// o: { hip, th, tw, td, c, f, waist (k), chest (k), z, belly (k, adds a round belly), yoke (color) }
export function torso(o) {
  const { hip, th, tw, td, c, f = 'cloth', waist = 0.72, chest = 1, z = 0 } = o, top = hip + th;
  const P = [
    part(TAPER, c, [0, hip + th * 0.3, z], [tw * waist * 1.1, th * 0.6, td * 0.88 * waist + td * 0.12], undefined, f),
    part(HEAD, c, [0, top - th * 0.34, z + td * 0.02], [tw * chest, th * 0.72, td * 1.04], undefined, f),
    part(HEAD, o.yoke ?? c, [0, top - 0.05, z - td * 0.04], [tw * chest * 0.96, 0.3, td * 0.86], undefined, f),
  ];
  if (o.belly) P.push(part(HEAD, o.bellyC ?? c, [0, hip + th * 0.32, z + td * 0.12], [tw * o.belly, th * 0.62, td * 1.1 * o.belly], undefined, o.bellyF ?? f));
  return P;
}

// ── limbs ──
// Arm in the shoulder group's space: shoulder at the origin, hanging down, hand around y = -L.
export function arm(o) {
  const r = o.r ?? 0.12, fr = o.fr ?? r * 0.95, L = o.len ?? 1.06, e = L * 0.49;
  const P = [
    part(SPH, o.sh ?? o.up, [0, 0, 0], r * 2.1, undefined, o.shF ?? o.upF ?? 'cloth'),
    seg([0, -0.04, 0], [0, -e + 0.02, 0.02], r, o.up, o.upF ?? 'cloth'),
    part(SPH, o.elbow ?? o.up, [0, -e, 0.03], r * 1.9, undefined, o.elbowF ?? o.upF ?? 'cloth'),
    seg([0, -e - 0.04, 0.04], [0, -L + 0.1, 0.07], [fr, fr * 1.05], o.fore, o.foreF ?? 'skin'),
  ];
  if (o.hand !== null) P.push(...(o.paw ? [part(SPH, o.hand ?? o.fore, [0, -L, 0.08], [r * 1.9, r * 1.7, r * 2.0], undefined, o.handF ?? 'skin')]
    : [part(SOFT, o.hand ?? o.fore, [0, -L, 0.08], [r * 1.45, r * 1.7, r * 1.6], undefined, o.handF ?? 'skin'), part(CAP, o.hand ?? o.fore, [r * 0.62, -L + 0.04, 0.16], [r * 0.5, r * 0.5, r * 0.5], [0.6, 0, -0.5], o.handF ?? 'skin')]));
  return P;
}
// Plantigrade leg in the hip group's space (hip joint at the origin, sole at y = -H).
export function leg(H, o) {
  const r = o.r ?? 0.14;
  return [
    seg([0, -0.02, 0], [0, -H * 0.48, 0.04], [r * 1.1, r * 1.15], o.thigh, o.thighF ?? 'cloth'),
    part(SPH, o.knee ?? o.thigh, [0, -H * 0.5, 0.06], r * 1.75, undefined, o.kneeF ?? o.thighF ?? 'cloth'),
    seg([0, -H * 0.53, 0.04], [0, -H + 0.2, 0], [r * 0.95, r], o.shin, o.shinF ?? 'cloth'),
    ...(o.boot === null ? [] : [part(SOFT, o.boot ?? DARK, [0, -H + 0.09, 0.08], [r * 2.1, 0.2, r * 3.4], undefined, o.bootF ?? 'rubber')]),
  ];
}
// Digitigrade leg (lizard / cat / fox / bird / drake): thigh forward, shin back, long foot bone, paw or talons.
export function digiLeg(H, o) {
  const r = o.r ?? 0.14, k = [0, -H * 0.38, 0.2], a = [0, -H * 0.78, -0.16], p = [0, -H + 0.08, 0.06];
  const P = [
    seg([0, 0, 0], k, [r * 1.25, r * 1.3], o.thigh, o.thighF ?? 'fur'),
    part(SPH, o.knee ?? o.thigh, k, r * 1.9, undefined, o.thighF ?? 'fur'),
    seg(k, a, r * 0.95, o.shin, o.shinF ?? 'fur'),
    seg(a, p, r * 0.8, o.shin, o.shinF ?? 'fur'),
  ];
  if (o.talon) P.push(...[-0.5, 0, 0.5].map((t) => seg([0, -H + 0.08, 0.06], [t * 0.22, -H + 0.04, 0.36], 0.045, o.paw ?? o.shin, 'rubber')),
    ...[-0.5, 0, 0.5].map((t) => part(CONE4, o.claw ?? 0x2A2420, [t * 0.25, -H + 0.04, 0.42], [0.05, 0.12, 0.05], [PI / 2, 0, 0], 'rubber')),
    seg([0, -H + 0.08, 0.06], [0, -H + 0.04, -0.16], 0.04, o.paw ?? o.shin, 'rubber'));
  else P.push(part(SPH, o.paw ?? o.shin, [0, -H + 0.08, 0.14], [r * 2.4, r * 1.3, r * 2.8], undefined, o.pawF ?? 'fur'),
    ...[-1, 0, 1].map((t) => part(CONE4, o.claw ?? 0xE8E2D0, [t * r * 0.7, -H + 0.08, 0.14 + r * 1.5], [0.06, 0.16, 0.06], [PI / 2, 0, 0])));
  return P;
}

// ── faces ──
// A real head (human / elf / dwarf / orc / goblin...): skull + softer jaw, nose, ears, brows, mouth, optional hair.
// o: { y, z, s (head height), skin, ears: round|elf|long|fin|none, nose: button|long|round|snub|hook|none, hair, hairC,
//      brow (color), jaw (width k), beard, beardC, tusks, chin }
export function face(o) {
  const { y, z = 0, s = 0.4, ears = 'round', nose = 'button', jaw = 1 } = o, sk = o.skin ?? SKIN.rose, sf = 'skin';
  const P = [
    part(HEAD, sk, [0, y + s * 0.04, z], [s * 0.9, s * 0.98, s * 0.96], undefined, sf), // cranium
    part(HEAD, sk, [0, y - s * 0.2, z + s * 0.05], [s * 0.72 * jaw, s * 0.56, s * 0.8], undefined, sf), // cheeks + jaw
    part(HEAD, sk, [0, y - s * 0.4, z + s * 0.14], [s * 0.32 * jaw, s * 0.18, s * 0.3], undefined, sf), // chin
  ];
  const nz = z + s * 0.47, ny = y - s * 0.08;
  if (nose === 'button') P.push(part(SPH, shade(sk, 0.96), [0, ny, nz], [s * 0.12, s * 0.12, s * 0.12], undefined, sf));
  if (nose === 'round') P.push(part(SPH, shade(sk, 0.94), [0, ny - s * 0.02, nz + s * 0.02], [s * 0.2, s * 0.17, s * 0.18], undefined, sf));
  if (nose === 'long') P.push(part(CONE4, shade(sk, 0.96), [0, ny + s * 0.02, nz + s * 0.02], [s * 0.1, s * 0.26, s * 0.12], [-0.25, PI / 4, 0], sf));
  if (nose === 'hook') P.push(seg([0, ny + s * 0.1, nz - s * 0.02], [0, ny - s * 0.06, nz + s * 0.1], s * 0.06, shade(sk, 0.94), sf));
  if (nose === 'snub') P.push(part(SPH, shade(sk, 0.9), [0, ny, nz - s * 0.02], [s * 0.16, s * 0.1, s * 0.12], undefined, sf),
    ...both((sx) => [part(SPH, shade(sk, 0.45), [sx * s * 0.04, ny - s * 0.02, nz + s * 0.04], s * 0.03)]));
  const ec = shade(sk, 0.92);
  if (ears === 'round') P.push(...both((sx) => [part(SPH, ec, [sx * s * 0.44, y - s * 0.02, z - s * 0.02], [s * 0.1, s * 0.22, s * 0.15], [0, 0, sx * -0.1], sf)]));
  if (ears === 'elf') P.push(...both((sx) => [part(CONE, ec, [sx * s * 0.56, y + s * 0.08, z - s * 0.06], [s * 0.12, s * 0.62, s * 0.18], [-0.25, 0, sx * -1.05], sf),
    part(CONE, shade(sk, 0.75), [sx * s * 0.57, y + s * 0.08, z - s * 0.03], [s * 0.05, s * 0.44, s * 0.06], [-0.25, 0, sx * -1.05], sf)]));
  if (ears === 'long') P.push(...both((sx) => [part(CONE, ec, [sx * s * 0.72, y + s * 0.02, z - s * 0.04], [s * 0.16, s * 0.9, s * 0.16], [-0.1, 0, sx * -1.3], sf)])); // goblin
  if (ears === 'fin') P.push(...both((sx) => [part(FAN, ec, [sx * s * 0.47, y, z - s * 0.06], [s * 0.6, s * 1.2, s * 0.5], [PI / 2, sx * 0.4, PI / 2 + sx * 0.3], sf),
    ...[0, 1, 2].map((k) => part(BOX, shade(sk, 0.7), [sx * s * 0.5, y + s * (0.08 - k * 0.08), z - s * 0.12], [0.01, s * 0.02, s * 0.3], [0, sx * 0.4, (k - 1) * 0.3], sf))]));
  const bc = o.brow ?? o.hairC ?? HAIR.brown;
  if (o.brow !== null) P.push(...both((sx) => [part(RBOX, bc, [sx * s * 0.17, y + s * 0.13, z + s * 0.42], [s * 0.2, s * 0.045, s * 0.06], [0, 0, sx * (o.browTilt ?? -0.12)], 'cloth')]));
  P.push(part(RBOX, shade(sk, 0.62), [0, y - s * 0.27, z + s * 0.43], [s * 0.16, s * 0.026, s * 0.03], undefined, sf)); // mouth line
  if (o.tusks) P.push(...both((sx) => [part(CONE, 0xF2EAD6, [sx * s * 0.15, y - s * 0.24, z + s * 0.42], [s * 0.08, s * 0.22, s * 0.08], [0.15, 0, sx * -0.2], 'stone')]));
  if (o.beard) P.push(...beard(o.beard, y, z, s, o.beardC ?? o.hairC ?? HAIR.brown));
  if (o.hair) P.push(...hair(o.hair, y, z, s, o.hairC ?? HAIR.brown));
  return P;
}

// Hair styles (y, z, s as face()). The cap sits behind the face so skin shows from brow to chin.
export function hair(style, y, z, s, c) {
  const f = 'fur', capP = [0, y + s * 0.14, z - s * 0.07], capS = [s * 0.98, s * 0.86, s * 0.98];
  const cap = part(HEAD, c, capP, capS, undefined, f);
  const fringe = (k = 1) => part(SOFT, c, [0, y + s * 0.33, z + s * 0.26], [s * 0.78, s * 0.2 * k, s * 0.34], [-0.45, 0, 0], f);
  const sides = (len = 0.5) => both((sx) => [part(SOFT, c, [sx * s * 0.42, y - s * len * 0.25, z - s * 0.04], [s * 0.16, s * (0.5 + len), s * 0.6], [0, 0, sx * 0.08], f)]);
  switch (style) {
    case 'buzz': return [part(HEAD, c, [0, y + s * 0.16, z - s * 0.05], [s * 0.94, s * 0.8, s * 0.96], undefined, f)];
    case 'short': return [cap, fringe()];
    case 'swept': return [cap, part(CONE4, c, [s * 0.12, y + s * 0.4, z + s * 0.18], [s * 0.36, s * 0.6, s * 0.2], [-1.2, 0, -0.7], f), part(SOFT, c, [-s * 0.12, y + s * 0.36, z + s * 0.22], [s * 0.5, s * 0.16, s * 0.3], [-0.5, 0, 0.25], f)];
    case 'bob': return [cap, fringe(1.1), ...sides(0.35), part(SOFT, c, [0, y - s * 0.12, z - s * 0.3], [s * 0.86, s * 0.6, s * 0.36], undefined, f)];
    case 'long': return [cap, fringe(), ...sides(0.9), part(SOFT, c, [0, y - s * 0.45, z - s * 0.32], [s * 0.9, s * 1.3, s * 0.3], [0.12, 0, 0], f)];
    case 'bun': return [cap, fringe(0.8), part(SPH, c, [0, y + s * 0.5, z - s * 0.32], s * 0.42, undefined, f)];
    case 'pony': return [cap, fringe(0.9), part(SPH, c, [0, y + s * 0.2, z - s * 0.5], s * 0.26, undefined, f),
      ...chain([[0, y + s * 0.2, z - s * 0.56], [0, y - s * 0.2, z - s * 0.8], [0, y - s * 0.7, z - s * 0.78], [0, y - s * 1.1, z - s * 0.6]], s * 0.15, s * 0.07, c, f)];
    case 'mohawk': return [part(HEAD, shade(c, 0.6), [0, y + s * 0.14, z - s * 0.05], [s * 0.93, s * 0.8, s * 0.95], undefined, f),
      ...[0, 1, 2, 3, 4].map((k) => part(CONE4, c, [0, y + s * (0.58 - Math.abs(k - 1.5) * 0.04), z + s * (0.3 - k * 0.2)], [s * 0.12, s * (0.6 - Math.abs(k - 1.5) * 0.06), s * 0.22], [-0.3 - k * 0.12, 0, 0], f))];
    case 'spiky': return [cap, ...[[-0.3, 0.42, 0.1, 0.5], [0, 0.55, 0.1, 0], [0.3, 0.42, 0.1, -0.5], [-0.18, 0.4, -0.25, 0.6], [0.18, 0.4, -0.25, -0.6], [0, 0.3, -0.42, 0]].map(([x, yy, zz, rz]) =>
      part(CONE4, c, [x * s, y + yy * s, z + zz * s], [s * 0.2, s * 0.5, s * 0.2], [zz < 0 ? -0.9 : -0.2, 0, rz], f)), fringe(0.8)];
    case 'braid': return [cap, fringe(), ...chain([[s * 0.36, y - s * 0.1, z - s * 0.1], [s * 0.44, y - s * 0.5, z + s * 0.02], [s * 0.42, y - s * 0.95, z + s * 0.1]], s * 0.12, s * 0.09, c, f)];
    default: return [cap];
  }
}
export function beard(style, y, z, s, c) {
  const f = 'fur';
  if (style === 'stubble') return [part(HEAD, c, [0, y - s * 0.24, z + s * 0.08], [s * 0.74, s * 0.5, s * 0.8], undefined, f)];
  if (style === 'moustache') return both((sx) => [part(CAP, c, [sx * s * 0.1, y - s * 0.19, z + s * 0.46], [s * 0.08, s * 0.08, s * 0.08], [0, 0, sx * 1.2], f)]);
  // full: a big braided dwarf beard
  return [part(SOFT, c, [0, y - s * 0.4, z + s * 0.3], [s * 0.82, s * 0.6, s * 0.42], [0.2, 0, 0], f), part(CONE, c, [0, y - s * 0.86, z + s * 0.36], [s * 0.64, s * 0.62, s * 0.4], [PI + 0.15, 0, 0], f),
    ...both((sx) => [part(SOFT, c, [sx * s * 0.34, y - s * 0.16, z + s * 0.18], [s * 0.16, s * 0.5, s * 0.4], undefined, f), part(CAP, c, [sx * s * 0.12, y - s * 0.2, z + s * 0.48], [s * 0.1, s * 0.1, s * 0.1], [0, 0, sx * 1.25], f)])];
}

// Eyes for the blinking eye mesh (MeshBasicMaterial, unlit), authored around (0, 0, z) like the assemblers expect.
// `human`: sclera + team-tinted iris + pupil + catch-light; `glow`: emissive spirit eyes; `bead`: animal eyes.
const SCLERA = 0xE9E4DA, PUPIL = 0x14161C;
export const EYES = {
  human: (vc, z, s = 0.4, o = {}) => both((sx) => {
    const x = sx * s * (o.gap ?? 0.19), y = s * (o.y ?? 0.02), w = s * (o.w ?? 0.2), h = s * (o.h ?? 0.13), tilt = sx * (o.tilt ?? 0);
    return [part(SPH, SCLERA, [x, y, z], [w, h, s * 0.06], [0, 0, tilt]), part(SPH, vc, [x + sx * w * 0.04, y - h * 0.05, z + s * 0.022], [w * 0.52, h * 0.86, s * 0.04]),
      part(SPH, PUPIL, [x + sx * w * 0.04, y - h * 0.05, z + s * 0.034], [w * 0.26, h * 0.5, s * 0.03]), part(SPH, 0xFFFFFF, [x + w * 0.12, y + h * 0.18, z + s * 0.042], [w * 0.12, w * 0.12, s * 0.02]),
      part(BOX, PUPIL, [x, y + h * 0.48, z + s * 0.012], [w * 1.05, h * 0.16, s * 0.03], [0, 0, tilt])]; // upper lash line
  }),
  glow: (vc, z, s = 0.4, o = {}) => both((sx) => [part(SPH, vc, [sx * s * (o.gap ?? 0.2), s * (o.y ?? 0), z], [s * (o.w ?? 0.2), s * (o.h ?? 0.13), s * 0.05], [0, 0, sx * (o.tilt ?? 0)])]),
  bead: (vc, z, s = 0.4, o = {}) => both((sx) => [part(SPH, PUPIL, [sx * s * (o.gap ?? 0.2), s * (o.y ?? 0), z], [s * (o.w ?? 0.16), s * (o.h ?? 0.16), s * 0.08]),
    part(SPH, vc, [sx * s * (o.gap ?? 0.2), s * (o.y ?? 0) - s * 0.02, z + s * 0.03], [s * (o.w ?? 0.16) * 0.55, s * (o.h ?? 0.16) * 0.55, s * 0.04]),
    part(SPH, 0xFFFFFF, [sx * s * (o.gap ?? 0.2) + s * 0.03, s * (o.y ?? 0) + s * 0.04, z + s * 0.05], s * 0.035)]),
  slit: (vc, z, s = 0.4, o = {}) => both((sx) => [part(SPH, o.base ?? 0xF2D45A, [sx * s * (o.gap ?? 0.2), s * (o.y ?? 0), z], [s * (o.w ?? 0.18), s * (o.h ?? 0.14), s * 0.06], [0, 0, sx * (o.tilt ?? 0)]),
    part(BOX, PUPIL, [sx * s * (o.gap ?? 0.2), s * (o.y ?? 0), z + s * 0.03], [s * 0.035, s * (o.h ?? 0.14) * 0.9, s * 0.02]), part(SPH, vc, [sx * s * (o.gap ?? 0.2), s * (o.y ?? 0) - s * 0.04, z + s * 0.035], [s * 0.05, s * 0.03, s * 0.01])]),
};

// Translucent companion material (ghost bodies, slime, ice, light ribbons); flashes with the solid one.
export function clearMat() {
  return toonMat({ vertexColors: true, finish: true, rim: 0.6, transparent: true, opacity: 0.62, depthWrite: false });
}
// One object for a part list: the solid mesh (with hairline outline) plus a see-through mesh for `clear` parts.
export function meshParts(P, mat, clr, k = 0.03) {
  if (!P?.length) return new THREE.Object3D();
  const solid = P.filter((q) => !q.clear), see = P.filter((q) => q.clear);
  if (!see.length) return toonMesh(mergeParts(solid), mat, k);
  const g = new THREE.Group();
  if (solid.length) g.add(toonMesh(mergeParts(solid), mat, k));
  const m = new THREE.Mesh(mergeParts(see), clr);
  m.renderOrder = 2;
  g.add(m);
  return g;
}
