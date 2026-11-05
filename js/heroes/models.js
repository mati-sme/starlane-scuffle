// Procedural armored champions from one shared part library: helmet / torso / pauldrons / arm piece / back piece / legs.
// Each champion is a ~6 field spec (roster.js). Parts are merged per mesh; the visor is its own mesh so it can pulse.
import * as THREE from 'three';
import { TEAM } from '../config.js';
import { toonMat, toonMesh, mergeParts } from '../render/toon.js';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const TAPER = new THREE.CylinderGeometry(0.707, 0.45, 1, 4).rotateY(Math.PI / 4); // trapezoid prism, wide at the top
const HEX = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 7);
const CONE4 = new THREE.ConeGeometry(0.5, 1, 4);
const OCT = new THREE.OctahedronGeometry(0.5);
const DOME = new THREE.SphereGeometry(1, 8, 6);
const RING = new THREE.TorusGeometry(0.5, 0.07, 5, 14);

// DARK = joints / soles, STEEL = bare metal frame, CLOTH = undersuit, TRIM = bright machined edges.
const DARK = 0x171B24, STEEL = 0x3A414D, CLOTH = 0x2A2C33, TRIM = 0x8A919C, HIP = 1.08;
const TORSO = { heavy: { w: 1.02, h: 1.04, d: 0.7 }, medium: { w: 0.84, h: 1.0, d: 0.58 }, slim: { w: 0.68, h: 1.0, d: 0.5 } };
const HEAD = 0.86; // helmet + visor scale; smaller head reads less chibi
const shade = (c, k) => new THREE.Color(c).multiplyScalar(k).getHex();
// Pull a color slightly toward its own grey: armor reads as painted metal rather than toy plastic.
const ground = (c, k) => { const col = new THREE.Color(c), l = col.r * 0.3 + col.g * 0.59 + col.b * 0.11; return col.lerp(new THREE.Color(l, l, l), k).getHex(); };

const part = (g, c, p, s = 1, r) => ({ g, c, p, s, r });
// Scale parts about a pivot / shift them vertically (parts are authored in absolute rig space).
const scaleAbout = (P, [cx, cy, cz], k) => P.map((q) => ({ ...q, p: [cx + (q.p[0] - cx) * k, cy + (q.p[1] - cy) * k, cz + (q.p[2] - cz) * k], s: (typeof q.s === 'number' ? [q.s, q.s, q.s] : q.s).map((v) => v * k) }));
const lift = (P, dy) => P.map((q) => ({ ...q, p: [q.p[0], q.p[1] + dy, q.p[2]] }));

function helmet(kind, hy, hz, main, acc) {
  const head = (w, h, d, c = main) => part(BOX, c, [0, hy, hz], [w, h, d]);
  switch (kind) {
    case 'flat': return [head(0.6, 0.46, 0.58), part(BOX, STEEL, [0, hy + 0.26, hz], [0.68, 0.08, 0.66]), part(BOX, DARK, [0, hy - 0.2, hz + 0.02], [0.5, 0.14, 0.5])];
    case 'dome': return [part(DOME, main, [0, hy + 0.02, hz], [0.34, 0.32, 0.34]), part(BOX, STEEL, [0, hy - 0.2, hz], [0.42, 0.14, 0.42])];
    case 'crest': return [head(0.54, 0.46, 0.56), part(CONE4, acc, [0, hy + 0.5, hz - 0.05], [0.34, 0.6, 0.5], [-0.2, Math.PI / 4, 0]), part(BOX, DARK, [0, hy - 0.2, hz], [0.44, 0.12, 0.44])];
    case 'hood': return [head(0.52, 0.46, 0.54), part(CONE4, shade(main, 0.8), [0, hy + 0.12, hz - 0.12], [0.9, 0.85, 0.9], [-0.3, Math.PI / 4, 0]), part(BOX, DARK, [0, hy - 0.2, hz], [0.42, 0.12, 0.42])];
    default: return [head(0.5, 0.44, 0.56), part(BOX, acc, [0, hy + 0.22, hz - 0.35], [0.07, 0.5, 0.6], [-0.55, 0, 0]), part(BOX, DARK, [0, hy - 0.2, hz], [0.42, 0.12, 0.44])]; // fin
  }
}

function visor(kind, hy, hz, col) {
  const z = hz + 0.3, b = (x, y, w, h, rz = 0) => part(BOX, col, [x, y, z], [w, h, 0.07], [0, 0, rz]);
  if (kind === 'wide') return [b(-0.14, hy + 0.02, 0.18, 0.1), b(0.14, hy + 0.02, 0.18, 0.1)];
  if (kind === 'v') return [b(-0.13, hy + 0.02, 0.22, 0.06, -0.35), b(0.13, hy + 0.02, 0.22, 0.06, 0.35)];
  if (kind === 'dot') return [part(CYL, col, [0.13, hy + 0.02, z], [0.2, 0.08, 0.2], [Math.PI / 2, 0, 0])];
  return [b(0, hy + 0.02, 0.46, 0.07)];
}

function arms(kind, ax, main, acc) {
  const P = [];
  const arm = (sx) => P.push(
    part(BOX, CLOTH, [sx * ax, HIP + 0.55, 0], [0.19, 0.52, 0.2]),
    part(BOX, shade(main, 0.85), [sx * ax, HIP + 0.12, 0.08], [0.21, 0.46, 0.22]),
    part(BOX, TRIM, [sx * ax, HIP + 0.33, 0.06], [0.2, 0.05, 0.21]),
  );
  arm(1); arm(-1);
  const fist = (sx, s) => P.push(part(BOX, DARK, [sx * ax, HIP - 0.06, 0.14], [0.24 * s, 0.26 * s, 0.28 * s]), part(BOX, acc, [sx * ax, HIP + 0.05 + 0.08 * s, 0.14], [0.27 * s, 0.05, 0.31 * s]));
  fist(1, 1); fist(-1, 1);
  const R = -ax; // weapon side
  if (kind === 'shield') P.push(part(BOX, main, [ax + 0.4, HIP + 0.55, 0.25], [0.12, 1.6, 0.9]), part(BOX, acc, [ax + 0.47, HIP + 0.55, 0.25], [0.06, 1.35, 0.62]), part(HEX, STEEL, [ax + 0.5, HIP + 0.6, 0.25], [0.3, 0.06, 0.3], [0, 0, Math.PI / 2]));
  if (kind === 'gauntlet' || kind === 'gauntlet2') {
    P.push(part(BOX, shade(main, 0.9), [R, HIP, 0.2], [0.6, 0.62, 0.66]), part(BOX, acc, [R, HIP + 0.34, 0.2], [0.64, 0.08, 0.7]));
    if (kind === 'gauntlet') P.push(part(OCT, acc, [R, HIP + 0.1, 0.8], [0.55, 0.55, 0.55]));
    else P.push(part(BOX, shade(main, 0.9), [ax, HIP, 0.2], [0.6, 0.62, 0.66]), part(BOX, acc, [ax, HIP + 0.34, 0.2], [0.64, 0.08, 0.7]));
  }
  if (kind === 'spear') {
    const t = 0.5, L = 3.4, cy = HIP + 0.85, cz = 0.45;
    P.push(part(CYL, DARK, [R, cy, cz], [0.08, L, 0.08], [t, 0, 0]), part(CONE4, acc, [R, cy + Math.cos(t) * (L / 2 + 0.25), cz + Math.sin(t) * (L / 2 + 0.25)], [0.2, 0.6, 0.2], [t, 0, 0]));
  }
  if (kind === 'blade') P.push(part(BOX, DARK, [R, HIP + 0.2, 0.9], [0.09, 0.14, 1.6], [-0.12, 0, 0]), part(BOX, acc, [R, HIP + 0.27, 1.0], [0.04, 0.05, 1.5], [-0.12, 0, 0]), part(CONE4, acc, [R, HIP + 0.1, 1.75], [0.1, 0.5, 0.1], [Math.PI / 2 - 0.2, 0, 0]));
  if (kind === 'rifle') P.push(part(BOX, DARK, [R, HIP + 0.4, 0.9], [0.13, 0.17, 2.1]), part(BOX, acc, [R, HIP + 0.4, 1.7], [0.15, 0.05, 0.5]), part(CYL, acc, [R, HIP + 0.62, 0.7], [0.12, 0.45, 0.12], [Math.PI / 2, 0, 0]));
  if (kind === 'blaster') P.push(part(BOX, DARK, [R, HIP + 0.1, 0.4], [0.32, 0.28, 0.6]), part(CYL, acc, [R - 0.08, HIP + 0.12, 0.95], [0.1, 0.8, 0.1], [Math.PI / 2, 0, 0]), part(CYL, acc, [R + 0.08, HIP + 0.12, 0.95], [0.1, 0.8, 0.1], [Math.PI / 2, 0, 0]));
  if (kind === 'staff') P.push(part(CYL, DARK, [R, HIP + 0.7, 0.4], [0.07, 2.4, 0.07], [0.1, 0, 0]), part(RING, acc, [R, HIP + 1.95, 0.5], [0.5, 0.5, 0.5]), part(OCT, acc, [R, HIP + 1.95, 0.5], [0.16, 0.2, 0.16]));
  return P;
}

function pauldrons(kind, w, hy, main, acc) {
  const P = [];
  if (kind === 'none') return P;
  for (const sx of [-1, 1]) {
    if (kind === 'small') P.push(part(BOX, shade(main, 0.9), [sx * (w / 2 + 0.12), hy, 0], [0.34, 0.2, 0.44], [0, 0, sx * -0.25]));
    if (kind === 'huge') P.push(part(BOX, shade(main, 0.95), [sx * (w / 2 + 0.2), hy + 0.05, 0], [0.62, 0.34, 0.74], [0, 0, sx * -0.2]), part(CONE4, acc, [sx * (w / 2 + 0.3), hy + 0.35, 0], [0.22, 0.4, 0.22], [0, Math.PI / 4, sx * -0.3]));
    if (kind === 'discs') P.push(part(CYL, acc, [sx * (w / 2 + 0.3), hy, 0], [0.7, 0.1, 0.7], [0, 0, Math.PI / 2]), part(HEX, DARK, [sx * (w / 2 + 0.36), hy, 0], [0.3, 0.1, 0.3], [0, 0, Math.PI / 2]));
  }
  return P;
}

// Back piece, in the sway group's own space (origin = upper back).
function back(kind, main, acc) {
  const P = [part(BOX, STEEL, [0, 0.4, -0.05], [0.55, 0.55, 0.14])];
  switch (kind) {
    case 'ring': P.push(part(RING, acc, [0, 0.75, -0.6], [1.7, 1.7, 1.7]), part(OCT, acc, [0, 0.75, -0.6], [0.25, 0.25, 0.25])); break;
    case 'stacks': for (const sx of [-1, 1]) P.push(part(CYL, DARK, [sx * 0.25, 0.55, -0.2], [0.17, 1.0, 0.17], [-0.2, 0, 0]), part(CYL, acc, [sx * 0.25, 1.05, -0.3], [0.22, 0.1, 0.22], [-0.2, 0, 0])); break;
    case 'roundshield': P.push(part(CYL, main, [0, 0.4, -0.25], [1.1, 0.1, 1.1], [Math.PI / 2, 0, 0]), part(HEX, acc, [0, 0.4, -0.32], [0.4, 0.08, 0.4], [Math.PI / 2, 0, 0])); break;
    case 'coils': for (const sx of [-1, 1]) { P.push(part(CYL, DARK, [sx * 0.3, 0.8, -0.15], [0.07, 1.4, 0.07])); for (const y of [0.45, 0.8, 1.15]) P.push(part(RING, acc, [sx * 0.3, y, -0.15], [0.3, 0.3, 0.3], [Math.PI / 2, 0, 0])); P.push(part(OCT, acc, [sx * 0.3, 1.55, -0.15], [0.16, 0.24, 0.16])); } break;
    case 'mortar': P.push(part(BOX, DARK, [0, 0.35, -0.3], [0.6, 0.35, 0.5]), part(CYL, main, [0, 0.95, -0.55], [0.46, 1.3, 0.46], [-0.5, 0, 0]), part(CYL, acc, [0, 1.5, -0.8], [0.52, 0.1, 0.52], [-0.5, 0, 0])); break;
    case 'pylons': for (const sx of [-1, 1]) P.push(part(OCT, acc, [sx * 0.85, 1.05, -0.1], [0.32, 0.7, 0.32]), part(OCT, main, [sx * 0.85, 1.05, -0.1], [0.22, 0.52, 0.22])); break;
    case 'coat': for (const sx of [-1, 1]) P.push(part(BOX, shade(main, 0.75), [sx * 0.22, -0.2, -0.12], [0.36, 0.95, 0.07], [0.12, 0, sx * 0.08]), part(BOX, acc, [sx * 0.22, -0.65, -0.14], [0.36, 0.08, 0.08])); break;
    case 'drum': P.push(part(CYL, DARK, [0, 0.4, -0.4], [0.85, 0.55, 0.85], [Math.PI / 2, 0, 0]), part(CYL, acc, [0, 0.4, -0.68], [0.9, 0.08, 0.9], [Math.PI / 2, 0, 0])); break;
    case 'drone': P.push(part(RING, acc, [0, 1.1, -0.55], [1.5, 1.5, 1.5], [Math.PI / 2, 0, 0]), part(DOME, 0xFFFFFF, [0, 1.1, -0.55], [0.22, 0.14, 0.22]), part(OCT, acc, [0, 1.1, -0.55], [0.3, 0.3, 0.3])); break;
    default: break;
  }
  return P;
}

function legGeo(T, main, acc) {
  return mergeParts([
    part(BOX, CLOTH, [0, -0.27, 0], [0.24, 0.54, 0.27]),
    part(BOX, shade(main, 0.8), [0, -0.24, 0.1], [0.25, 0.36, 0.1]),
    part(BOX, TRIM, [0, -0.56, 0.13], [0.2, 0.12, 0.08]),
    part(BOX, acc, [0, -0.56, 0.17], [0.08, 0.06, 0.02]),
    part(BOX, shade(main, 0.88), [0, -0.8, 0.03], [0.24, 0.42, 0.28]),
    part(BOX, DARK, [0, -0.99, 0.08], [0.28, 0.18, 0.46]),
    part(BOX, STEEL, [0, -0.95, 0.29], [0.26, 0.1, 0.06]),
  ]);
}

// -> { root, lean, eyes, tail, legs, mats } — hero.js animates lean / eyes / tail / legs and flashes mats.
export function buildChampion(spec, def, team = 0) {
  const T = TORSO[spec.torso], main = ground(def.color, 0.18), acc = ground(def.accent, 0.08);
  const hunch = spec.hunch ? 0.18 : 0, hy = HIP + T.h + 0.3, ax = T.w / 2 + 0.18;
  const mid = HIP + T.h * 0.5, chestZ = T.d / 2 + 0.02 + hunch * 0.4;
  const body = [
    part(BOX, DARK, [0, HIP, 0], [T.w * 0.75, 0.26, T.d * 0.85]),
    part(BOX, CLOTH, [0, HIP + 0.22, 0], [T.w * 0.6, 0.34, T.d * 0.7]),
    part(BOX, STEEL, [0, HIP + 0.16, T.d * 0.33], [T.w * 0.46, 0.08, 0.06]), // abdomen plates
    part(BOX, STEEL, [0, HIP + 0.3, T.d * 0.33], [T.w * 0.5, 0.08, 0.06]),
    part(BOX, TRIM, [0, HIP + 0.04, T.d * 0.43], [0.16, 0.1, 0.04]), // belt buckle
    part(TAPER, main, [0, mid + 0.14, hunch * 0.4], [T.w, T.h * 0.78, T.d], [hunch * 1.2, 0, 0]),
    part(BOX, acc, [0, mid + 0.14, chestZ], [T.w * 0.42, T.h * 0.36, 0.06]),
    part(BOX, DARK, [0, mid + 0.14, chestZ + 0.025], [0.03, T.h * 0.36, 0.03]), // chest plate seam
    part(BOX, TRIM, [0, HIP + T.h - 0.02, hunch * 0.45], [T.w * 0.55, 0.06, T.d * 0.62]), // collar
    part(BOX, CLOTH, [0, HIP + T.h + 0.08, hunch * 0.5], [0.22, 0.16, 0.24]), // neck
    ...scaleAbout([...helmet(spec.helmet, hy, hunch, main, acc)], [0, hy - 0.2, hunch], HEAD),
    ...pauldrons(spec.paul, T.w, HIP + T.h - 0.05, main, acc),
    ...lift(arms(spec.arm, ax, main, acc), T.h - 0.95),
  ];
  if (spec.emblem) body.push(part(OCT, acc, [0, mid + 0.15, T.d / 2 + 0.05], [0.26, 0.34, 0.08]));
  if (spec.cracks) for (const [x, r] of [[-0.18, 0.5], [0.12, -0.4], [0.28, 0.2]]) body.push(part(BOX, acc, [x, mid + 0.1, T.d / 2 + 0.02], [0.04, 0.55, 0.04], [0, 0, r]));

  const mat = toonMat({ vertexColors: true });
  const lean = new THREE.Group();
  lean.add(toonMesh(mergeParts(body), mat, 0.03));

  const vc = new THREE.Color(TEAM[team].main).lerp(new THREE.Color(0xffffff), 0.35).getHex();
  const eyes = new THREE.Mesh(mergeParts(scaleAbout(visor(spec.visor, 0, hunch, vc), [0, -0.2, hunch], HEAD)), new THREE.MeshBasicMaterial({ vertexColors: true }));
  eyes.position.y = hy;
  lean.add(eyes);

  const tail = new THREE.Group();
  tail.position.set(0, HIP + T.h - 0.62, -T.d / 2 - 0.05);
  tail.add(toonMesh(mergeParts(back(spec.back, main, acc)), mat, 0.03));
  lean.add(tail);

  const geo = legGeo(T, main, acc);
  const legs = [-1, 1].map((sx) => {
    const g = new THREE.Group();
    g.position.set(sx * T.w * 0.25, HIP, 0);
    g.add(toonMesh(geo, mat, 0.03));
    return g;
  });

  const rig = new THREE.Group();
  rig.scale.set(spec.w ?? 1, spec.h ?? 1, spec.w ?? 1);
  rig.add(lean, ...legs);
  const root = new THREE.Group();
  root.add(rig);
  return { root, lean, eyes, tail, legs, mats: [mat] };
}
