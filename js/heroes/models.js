// Procedural armored champions from one shared part library: helmet / torso / pauldrons / arms + weapon / back piece / legs.
// Each champion is a ~6 field spec (roster.js). Parts are merged per mesh with a per-part finish (paint, metal, cloth,
// rubber, glow) so armor reads as painted metal over a soft undersuit, with emissive accents in the champion's ability color.
// The visor is its own mesh so it can blink.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TEAM } from '../config.js';
import { toonMat, toonMesh, mergeParts } from '../render/toon.js';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const RBOX = new RoundedBoxGeometry(1, 1, 1, 1, 0.16); // one segment: chamfered edges, ~44 tris
const TAPER = new THREE.CylinderGeometry(0.62, 0.42, 1, 8).rotateY(Math.PI / 8); // octagonal chest, wide at the top
const HEX = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
const CONE = new THREE.ConeGeometry(0.5, 1, 8);
const CONE4 = new THREE.ConeGeometry(0.5, 1, 4);
const OCT = new THREE.OctahedronGeometry(0.5);
const SPH = new THREE.SphereGeometry(0.5, 10, 7);
const DOME = new THREE.SphereGeometry(0.5, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2);
const CAP = new THREE.CapsuleGeometry(0.5, 1, 2, 7);
const RING = new THREE.TorusGeometry(0.5, 0.07, 4, 16);

// DARK = joints / soles, STEEL = bare frame, CLOTH = undersuit, TRIM = machined edges.
const DARK = 0x1C2029, STEEL = 0x59606B, CLOTH = 0x2C2F38, TRIM = 0xB4BAC4, HIP = 1.08;
const TORSO = { heavy: { w: 1.06, h: 1.04, d: 0.72 }, medium: { w: 0.88, h: 1.0, d: 0.6 }, slim: { w: 0.72, h: 1.0, d: 0.52 } };
const HEAD = 0.9;
const shade = (c, k) => new THREE.Color(c).multiplyScalar(k).getHex();
const tint = (c, to, k) => new THREE.Color(c).lerp(new THREE.Color(to), k).getHex();
// Pull a color slightly toward its own grey: armor reads as painted metal rather than toy plastic.
const ground = (c, k) => { const col = new THREE.Color(c), l = col.r * 0.3 + col.g * 0.59 + col.b * 0.11; return col.lerp(new THREE.Color(l, l, l), k).getHex(); };

const part = (g, c, p, s = 1, r, f = 'paint') => ({ g, c, p, s, r, f });
const metal = (g, c, p, s, r) => part(g, c, p, s, r, 'metal');
const cloth = (g, c, p, s, r) => part(g, c, p, s, r, 'cloth');
const glow = (g, c, p, s, r) => part(g, c, p, s, r, 'glow');
const rubber = (g, c, p, s, r) => part(g, c, p, s, r, 'rubber');
// Scale parts about a pivot / shift them vertically (parts are authored in absolute rig space).
const scaleAbout = (P, [cx, cy, cz], k) => P.map((q) => ({ ...q, p: [cx + (q.p[0] - cx) * k, cy + (q.p[1] - cy) * k, cz + (q.p[2] - cz) * k], s: (typeof q.s === 'number' ? [q.s, q.s, q.s] : q.s).map((v) => v * k) }));
const lift = (P, dy) => P.map((q) => ({ ...q, p: [q.p[0], q.p[1] + dy, q.p[2]] }));
const both = (fn) => [...fn(-1), ...fn(1)];

function helmet(kind, hy, hz, main, acc, gl) {
  const jaw = rubber(RBOX, DARK, [0, hy - 0.2, hz + 0.04], [0.42, 0.16, 0.44]);
  const ears = both((sx) => [metal(CYL, TRIM, [sx * 0.29, hy - 0.02, hz], [0.18, 0.06, 0.18], [0, 0, Math.PI / 2]), glow(CYL, gl, [sx * 0.32, hy - 0.02, hz], [0.08, 0.02, 0.08], [0, 0, Math.PI / 2])]);
  switch (kind) {
    case 'flat': return [ // squared great-helm with a steel brow and cheek plates
      part(RBOX, main, [0, hy, hz], [0.58, 0.5, 0.58]), metal(RBOX, STEEL, [0, hy + 0.24, hz + 0.02], [0.66, 0.1, 0.64]),
      ...both((sx) => [part(RBOX, shade(main, 0.85), [sx * 0.27, hy - 0.1, hz + 0.12], [0.1, 0.3, 0.36], [0, sx * 0.2, 0])]), jaw];
    case 'dome': return [ // round pilot helmet with ear discs
      part(SPH, main, [0, hy + 0.02, hz], [0.62, 0.6, 0.62]), metal(RING, TRIM, [0, hy - 0.06, hz], [0.62, 0.62, 0.8], [Math.PI / 2, 0, 0]), ...ears, jaw];
    case 'crest': return [ // knight helm with a swept crest
      part(RBOX, main, [0, hy, hz], [0.52, 0.5, 0.56]), part(CONE4, acc, [0, hy + 0.42, hz - 0.08], [0.12, 0.55, 0.62], [-0.35, 0, 0]),
      glow(BOX, gl, [0, hy + 0.27, hz - 0.02], [0.04, 0.05, 0.5]), ...both((sx) => [metal(RBOX, TRIM, [sx * 0.26, hy - 0.08, hz + 0.06], [0.06, 0.32, 0.42])]), jaw];
    case 'hood': return [ // cloth hood over a mask
      part(SPH, shade(main, 0.8), [0, hy + 0.02, hz - 0.04], [0.66, 0.66, 0.7], undefined, 'cloth'), cloth(CONE, shade(main, 0.7), [0, hy + 0.3, hz - 0.18], [0.5, 0.5, 0.5], [-0.6, 0, 0]),
      metal(RBOX, STEEL, [0, hy - 0.08, hz + 0.18], [0.4, 0.32, 0.26]), jaw];
    default: return [ // fin: sleek racer helmet with a dorsal fin and glow strip
      part(SPH, main, [0, hy, hz - 0.04], [0.54, 0.54, 0.7]), part(BOX, acc, [0, hy + 0.24, hz - 0.3], [0.06, 0.4, 0.55], [-0.55, 0, 0]),
      glow(BOX, gl, [0, hy + 0.28, hz - 0.02], [0.03, 0.04, 0.3]), jaw];
  }
}

function visor(kind, hy, hz, col) {
  const z = hz + 0.3, b = (x, y, w, h, rz = 0) => part(RBOX, col, [x, y, z], [w, h, 0.06], [0, 0, rz]);
  if (kind === 'wide') return [b(-0.13, hy + 0.02, 0.2, 0.1), b(0.13, hy + 0.02, 0.2, 0.1)];
  if (kind === 'v') return [b(-0.12, hy + 0.02, 0.22, 0.06, -0.35), b(0.12, hy + 0.02, 0.22, 0.06, 0.35)];
  if (kind === 'dot') return [part(CYL, col, [0.12, hy + 0.02, z], [0.18, 0.08, 0.18], [Math.PI / 2, 0, 0])];
  return [b(0, hy + 0.02, 0.44, 0.07)];
}

// Arms: shoulder ball, undersuit upper arm, elbow joint, armored gauntlet with a trim band and glow seam, fist.
function arms(kind, ax, main, acc, gl) {
  const P = [];
  const arm = (sx) => P.push(
    part(SPH, main, [sx * ax, HIP + 0.86, 0], 0.3),
    cloth(CAP, CLOTH, [sx * ax, HIP + 0.58, 0], [0.18, 0.18, 0.18]),
    rubber(SPH, DARK, [sx * ax, HIP + 0.36, 0.02], 0.2),
    part(RBOX, shade(main, 0.9), [sx * ax, HIP + 0.14, 0.07], [0.23, 0.38, 0.25]),
    metal(RBOX, TRIM, [sx * ax, HIP + 0.3, 0.07], [0.25, 0.06, 0.27]),
    glow(BOX, gl, [sx * (ax + 0.118), HIP + 0.12, 0.07], [0.012, 0.22, 0.05]),
    rubber(RBOX, DARK, [sx * ax, HIP - 0.08, 0.12], [0.22, 0.2, 0.24]),
  );
  arm(1); arm(-1);
  const R = -ax; // weapon side
  if (kind === 'shield') P.push( // tower shield: painted face, metal rim, glowing sigil
    part(RBOX, main, [ax + 0.4, HIP + 0.55, 0.25], [0.14, 1.6, 0.92]), metal(RBOX, TRIM, [ax + 0.44, HIP + 0.55, 0.25], [0.1, 1.68, 1.0]),
    part(RBOX, acc, [ax + 0.49, HIP + 0.55, 0.25], [0.06, 1.3, 0.6]), glow(HEX, gl, [ax + 0.53, HIP + 0.62, 0.25], [0.3, 0.04, 0.3], [0, 0, Math.PI / 2]));
  if (kind === 'gauntlet' || kind === 'gauntlet2') {
    const fist = (x) => P.push(part(RBOX, shade(main, 0.95), [x, HIP + 0.02, 0.2], [0.6, 0.62, 0.66]), metal(RBOX, TRIM, [x, HIP + 0.34, 0.2], [0.64, 0.1, 0.7]),
      ...[-0.18, 0, 0.18].map((dx) => metal(RBOX, STEEL, [x + dx, HIP - 0.1, 0.55], [0.14, 0.18, 0.12])), glow(BOX, gl, [x, HIP + 0.1, 0.535], [0.42, 0.05, 0.02]));
    fist(R);
    if (kind === 'gauntlet') P.push(glow(OCT, gl, [R, HIP + 0.1, 0.85], [0.42, 0.42, 0.42]), metal(RING, TRIM, [R, HIP + 0.1, 0.85], [0.75, 0.75, 0.75]));
    else fist(ax);
  }
  if (kind === 'spear') {
    const t = 0.5, L = 3.4, cy = HIP + 0.85, cz = 0.45, at = (d) => [R, cy + Math.cos(t) * d, cz + Math.sin(t) * d];
    P.push(metal(CYL, STEEL, [R, cy, cz], [0.08, L, 0.08], [t, 0, 0]), metal(CYL, TRIM, at(L / 2 - 0.05), [0.14, 0.12, 0.14], [t, 0, 0]),
      metal(CONE4, TRIM, at(L / 2 + 0.3), [0.22, 0.62, 0.08], [t, 0, 0]), glow(CONE4, gl, at(L / 2 + 0.32), [0.1, 0.52, 0.1], [t, 0, 0]));
  }
  if (kind === 'blade') P.push(
    rubber(CYL, DARK, [R, HIP + 0.12, 0.25], [0.1, 0.36, 0.1], [Math.PI / 2 - 0.12, 0, 0]), metal(RBOX, TRIM, [R, HIP + 0.16, 0.42], [0.34, 0.06, 0.08]),
    metal(BOX, STEEL, [R, HIP + 0.2, 1.15], [0.05, 0.2, 1.45], [-0.12, 0, 0]), glow(BOX, gl, [R, HIP + 0.28, 1.15], [0.03, 0.05, 1.4], [-0.12, 0, 0]),
    glow(CONE4, gl, [R, HIP + 0.1, 1.95], [0.08, 0.4, 0.14], [Math.PI / 2 - 0.12, 0, 0]));
  if (kind === 'rifle') P.push(
    part(RBOX, shade(main, 0.6), [R, HIP + 0.3, 0.5], [0.18, 0.26, 0.9]), metal(CYL, STEEL, [R, HIP + 0.38, 1.35], [0.1, 1.1, 0.1], [Math.PI / 2, 0, 0]),
    metal(CYL, TRIM, [R, HIP + 0.38, 1.85], [0.16, 0.16, 0.16], [Math.PI / 2, 0, 0]), glow(CYL, gl, [R, HIP + 0.38, 1.94], [0.1, 0.03, 0.1], [Math.PI / 2, 0, 0]),
    metal(CYL, TRIM, [R, HIP + 0.56, 0.55], [0.1, 0.4, 0.1], [Math.PI / 2, 0, 0]), glow(BOX, gl, [R + 0.095, HIP + 0.3, 0.55], [0.01, 0.06, 0.6]));
  if (kind === 'blaster') P.push(
    part(RBOX, shade(main, 0.8), [R, HIP + 0.1, 0.42], [0.36, 0.34, 0.64]), metal(RBOX, TRIM, [R, HIP + 0.3, 0.42], [0.3, 0.06, 0.5]),
    ...[-0.09, 0.09].flatMap((dx) => [metal(CYL, STEEL, [R + dx, HIP + 0.1, 0.95], [0.12, 0.6, 0.12], [Math.PI / 2, 0, 0]), glow(CYL, gl, [R + dx, HIP + 0.1, 1.26], [0.08, 0.03, 0.08], [Math.PI / 2, 0, 0])]));
  if (kind === 'staff') P.push(
    metal(CYL, STEEL, [R, HIP + 0.7, 0.4], [0.07, 2.4, 0.07], [0.1, 0, 0]), metal(CYL, TRIM, [R, HIP + 1.75, 0.5], [0.14, 0.16, 0.14], [0.1, 0, 0]),
    metal(RING, acc, [R, HIP + 1.98, 0.52], [0.55, 0.55, 0.55]), glow(OCT, gl, [R, HIP + 1.98, 0.52], [0.2, 0.26, 0.2]));
  return P;
}

function pauldrons(kind, w, hy, main, acc, gl) {
  if (kind === 'none') return [];
  return both((sx) => {
    const x = sx * (w / 2 + 0.14);
    if (kind === 'small') return [part(DOME, shade(main, 0.95), [x + sx * 0.04, hy - 0.12, 0], [0.54, 0.4, 0.58], [0, 0, sx * -0.5]), metal(RBOX, TRIM, [x + sx * 0.16, hy - 0.22, 0], [0.08, 0.12, 0.5], [0, 0, sx * -0.5])];
    if (kind === 'huge') return [ // stacked plates with a horn
      part(DOME, main, [sx * (w / 2 + 0.22), hy, 0], [0.72, 0.56, 0.82], [0, 0, sx * -0.3]),
      part(RBOX, shade(main, 0.85), [sx * (w / 2 + 0.36), hy - 0.18, 0], [0.4, 0.12, 0.74], [0, 0, sx * -0.55]),
      metal(RBOX, TRIM, [sx * (w / 2 + 0.44), hy - 0.3, 0], [0.32, 0.08, 0.66], [0, 0, sx * -0.7]),
      metal(CONE, acc, [sx * (w / 2 + 0.36), hy + 0.36, 0], [0.18, 0.44, 0.18], [0, 0, sx * -0.45])];
    return [ // discs: emitter plates
      metal(CYL, acc, [sx * (w / 2 + 0.3), hy, 0], [0.7, 0.1, 0.7], [0, 0, Math.PI / 2]), rubber(CYL, DARK, [sx * (w / 2 + 0.36), hy, 0], [0.42, 0.1, 0.42], [0, 0, Math.PI / 2]),
      glow(CYL, gl, [sx * (w / 2 + 0.4), hy, 0], [0.2, 0.06, 0.2], [0, 0, Math.PI / 2])];
  });
}

// Back piece, in the sway group's own space (origin = upper back).
function back(kind, main, acc, gl) {
  const P = [metal(RBOX, STEEL, [0, 0.4, -0.05], [0.55, 0.55, 0.16]), glow(BOX, gl, [0, 0.4, -0.14], [0.3, 0.04, 0.02])];
  switch (kind) {
    case 'ring': P.push(metal(RING, acc, [0, 0.75, -0.6], [1.7, 1.7, 1.7]), glow(RING, gl, [0, 0.75, -0.6], [1.45, 1.45, 0.6]), glow(OCT, gl, [0, 0.75, -0.6], [0.28, 0.28, 0.28])); break;
    case 'stacks': for (const sx of [-1, 1]) P.push(metal(CYL, STEEL, [sx * 0.25, 0.55, -0.2], [0.18, 1.0, 0.18], [-0.2, 0, 0]), metal(CYL, TRIM, [sx * 0.25, 1.02, -0.29], [0.24, 0.1, 0.24], [-0.2, 0, 0]), glow(CYL, gl, [sx * 0.25, 1.08, -0.3], [0.14, 0.04, 0.14], [-0.2, 0, 0])); break;
    case 'roundshield': P.push(part(CYL, main, [0, 0.4, -0.25], [1.1, 0.1, 1.1], [Math.PI / 2, 0, 0]), metal(RING, TRIM, [0, 0.4, -0.25], [1.1, 1.1, 1.4]), part(HEX, acc, [0, 0.4, -0.32], [0.4, 0.08, 0.4], [Math.PI / 2, 0, 0]), glow(HEX, gl, [0, 0.4, -0.36], [0.18, 0.04, 0.18], [Math.PI / 2, 0, 0])); break;
    case 'coils': for (const sx of [-1, 1]) { P.push(metal(CYL, STEEL, [sx * 0.3, 0.8, -0.15], [0.07, 1.4, 0.07])); for (const y of [0.45, 0.8, 1.15]) P.push(glow(RING, gl, [sx * 0.3, y, -0.15], [0.3, 0.3, 0.3], [Math.PI / 2, 0, 0])); P.push(glow(OCT, gl, [sx * 0.3, 1.55, -0.15], [0.16, 0.24, 0.16])); } break;
    case 'mortar': P.push(rubber(RBOX, DARK, [0, 0.35, -0.3], [0.6, 0.35, 0.5]), part(CYL, main, [0, 0.95, -0.55], [0.46, 1.3, 0.46], [-0.5, 0, 0]), metal(CYL, TRIM, [0, 1.5, -0.8], [0.54, 0.12, 0.54], [-0.5, 0, 0]), glow(CYL, gl, [0, 1.53, -0.82], [0.36, 0.04, 0.36], [-0.5, 0, 0])); break;
    case 'pylons': for (const sx of [-1, 1]) P.push(metal(OCT, acc, [sx * 0.85, 1.05, -0.1], [0.32, 0.7, 0.32]), glow(OCT, gl, [sx * 0.85, 1.05, -0.1], [0.2, 0.5, 0.2])); break;
    case 'coat': for (const sx of [-1, 1]) P.push(cloth(RBOX, shade(main, 0.7), [sx * 0.22, -0.2, -0.12], [0.36, 0.95, 0.06], [0.12, 0, sx * 0.08]), metal(BOX, acc, [sx * 0.22, -0.66, -0.14], [0.36, 0.06, 0.07])); break;
    case 'drum': P.push(rubber(CYL, DARK, [0, 0.4, -0.4], [0.85, 0.55, 0.85], [Math.PI / 2, 0, 0]), metal(RING, TRIM, [0, 0.4, -0.66], [0.82, 0.82, 0.8]), glow(CYL, gl, [0, 0.4, -0.69], [0.4, 0.04, 0.4], [Math.PI / 2, 0, 0])); break;
    case 'drone': P.push(metal(RING, acc, [0, 1.1, -0.55], [1.5, 1.5, 1.5], [Math.PI / 2, 0, 0]), part(DOME, 0xE8ECF2, [0, 1.1, -0.55], [0.44, 0.3, 0.44], undefined, 'glass'), glow(OCT, gl, [0, 1.02, -0.55], [0.26, 0.2, 0.26])); break;
    default: break;
  }
  return P;
}

// Leg: undersuit thigh, armored thigh plate, knee cop with a glow stud, shin greave, boot with a steel toe cap.
function legGeo(main, acc, gl) {
  return mergeParts([
    cloth(CAP, CLOTH, [0, -0.25, 0], [0.24, 0.26, 0.26]),
    part(RBOX, shade(main, 0.85), [0, -0.22, 0.07], [0.27, 0.34, 0.16]),
    metal(SPH, TRIM, [0, -0.54, 0.1], [0.22, 0.2, 0.18]),
    glow(SPH, gl, [0, -0.54, 0.19], 0.05),
    part(RBOX, shade(main, 0.92), [0, -0.78, 0.04], [0.25, 0.4, 0.27]),
    metal(BOX, acc, [0, -0.66, 0.18], [0.12, 0.05, 0.02]),
    rubber(RBOX, DARK, [0, -0.99, 0.08], [0.28, 0.18, 0.46]),
    metal(RBOX, STEEL, [0, -0.96, 0.28], [0.26, 0.12, 0.08]),
  ]);
}

// -> { root, lean, eyes, tail, legs, mats } — hero.js animates lean / eyes / tail / legs and flashes mats.
export function buildChampion(spec, def, team = 0) {
  const T = TORSO[spec.torso], main = ground(def.color, 0.08), acc = ground(def.accent, 0.05);
  const gl = tint(def.basic?.color ?? def.accent, 0xffffff, 0.1); // emissive accents match the champion's attacks
  const hunch = spec.hunch ? 0.18 : 0, hy = HIP + T.h + 0.3, ax = T.w / 2 + 0.2;
  const mid = HIP + T.h * 0.5, chestZ = T.d / 2 + hunch * 0.4;
  const body = [
    rubber(RBOX, DARK, [0, HIP, 0], [T.w * 0.74, 0.28, T.d * 0.86]),
    metal(CYL, TRIM, [0, HIP + 0.08, 0], [T.w * 0.78, 0.07, T.d * 0.92]), // belt
    glow(RBOX, gl, [0, HIP + 0.06, T.d * 0.45], [0.14, 0.09, 0.04]), // buckle
    cloth(CYL, CLOTH, [0, HIP + 0.26, 0], [T.w * 0.62, 0.34, T.d * 0.72]),
    ...[0.18, 0.32].map((y) => metal(RBOX, STEEL, [0, HIP + y, T.d * 0.32], [T.w * 0.42, 0.1, 0.08])), // abdomen plates
    part(TAPER, main, [0, mid + 0.16, hunch * 0.4], [T.w, T.h * 0.74, T.d], [hunch * 1.2, 0, 0]),
    ...both((sx) => [part(RBOX, tint(main, 0xffffff, 0.08), [sx * T.w * 0.2, mid + 0.26, chestZ - 0.02], [T.w * 0.38, T.h * 0.36, 0.12], [hunch * 1.2 - 0.1, sx * 0.25, 0])]), // pectoral plates
    metal(RBOX, acc, [0, mid + 0.06, chestZ], [T.w * 0.18, T.h * 0.3, 0.08]),
    glow(HEX, gl, [0, mid + 0.22, chestZ + 0.04], [0.16, 0.04, 0.16], [Math.PI / 2, 0, 0]), // chest core
    metal(RING, TRIM, [0, HIP + T.h - 0.02, hunch * 0.45], [T.w * 0.6, T.d * 0.75, 0.8], [Math.PI / 2, 0, 0]), // collar
    cloth(CYL, CLOTH, [0, HIP + T.h + 0.08, hunch * 0.5], [0.24, 0.18, 0.24]), // neck
    ...scaleAbout(helmet(spec.helmet, hy, hunch, main, acc, gl), [0, hy - 0.2, hunch], HEAD),
    ...pauldrons(spec.paul, T.w, HIP + T.h - 0.02, main, acc, gl),
    ...lift(arms(spec.arm, ax, main, acc, gl), T.h - 0.95),
  ];
  if (spec.emblem) body.push(glow(OCT, gl, [0, mid + 0.18, chestZ + 0.06], [0.26, 0.34, 0.08]));
  if (spec.cracks) for (const [x, r] of [[-0.18, 0.5], [0.12, -0.4], [0.28, 0.2]]) body.push(glow(BOX, gl, [x, mid + 0.1, chestZ + 0.01], [0.04, 0.5, 0.04], [0, 0, r]));

  const mat = toonMat({ vertexColors: true, finish: true, rim: 0.3 });
  const lean = new THREE.Group();
  lean.add(toonMesh(mergeParts(body), mat, 0.03));

  const vc = new THREE.Color(TEAM[team].main).lerp(new THREE.Color(0xffffff), 0.35).getHex();
  const eyes = new THREE.Mesh(mergeParts(scaleAbout(visor(spec.visor, 0, hunch, vc), [0, -0.2, hunch], HEAD)), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
  eyes.position.y = hy;
  lean.add(eyes);

  const tail = new THREE.Group();
  tail.position.set(0, HIP + T.h - 0.62, -T.d / 2 - 0.05);
  tail.add(toonMesh(mergeParts(back(spec.back, main, acc, gl)), mat, 0.03));
  lean.add(tail);

  const geo = legGeo(main, acc, gl);
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
