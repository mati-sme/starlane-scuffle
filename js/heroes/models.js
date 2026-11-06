// Procedural armored champions from one shared part library: helmet / torso / pauldrons / arms + weapon / back piece / legs.
// Each champion is a ~6 field spec (roster.js). Parts are merged per mesh with a per-part finish (paint, metal, cloth,
// rubber, glow) so armor reads as painted metal over a soft undersuit, with emissive accents in the champion's ability color.
// The visor is its own mesh so it can blink.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TEAM } from '../config.js';
import { toonMat, toonMesh, mergeParts } from '../render/toon.js';
import { buildWave2B } from './wave2b_models.js';

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
// v7.2: smaller heads and a slightly taller, leaner frame on every champion (less chibi), applied on top of each spec.
const HEAD_K = 0.84, TALL = 1.06, LEAN = 0.96;
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
    case 'bucket': return [ // tall cylindrical great-helm with a swept plume
      part(CYL, main, [0, hy + 0.02, hz], [0.58, 0.74, 0.58]), metal(CYL, STEEL, [0, hy + 0.4, hz], [0.62, 0.08, 0.62]), metal(CYL, TRIM, [0, hy - 0.2, hz], [0.6, 0.06, 0.6]),
      part(CONE, acc, [0, hy + 0.66, hz - 0.14], [0.2, 0.55, 0.5], [-0.55, 0, 0]), jaw];
    case 'horns': return [ // rocky skull cap with two big curved horns
      part(SPH, main, [0, hy, hz], [0.62, 0.58, 0.6]),
      ...both((sx) => [metal(CONE, TRIM, [sx * 0.36, hy + 0.34, hz], [0.22, 0.7, 0.22], [0, 0, sx * -0.9]), metal(CONE, acc, [sx * 0.64, hy + 0.68, hz], [0.13, 0.42, 0.13], [0, 0, sx * -0.35])]), jaw];
    case 'antlers': return [ // mossy head with branching antlers tipped in glow
      part(SPH, shade(main, 0.9), [0, hy, hz], [0.58, 0.56, 0.6]),
      ...both((sx) => [metal(CYL, acc, [sx * 0.22, hy + 0.45, hz], [0.07, 0.7, 0.07], [0, 0, sx * -0.35]), metal(CYL, acc, [sx * 0.4, hy + 0.62, hz], [0.06, 0.42, 0.06], [0, 0, sx * -1.0]), glow(SPH, gl, [sx * 0.52, hy + 0.84, hz], 0.09)]), jaw];
    case 'mask': return [ // horned battle mask with fangs
      part(RBOX, main, [0, hy, hz], [0.62, 0.54, 0.58]),
      ...both((sx) => [metal(CONE4, acc, [sx * 0.2, hy + 0.38, hz], [0.14, 0.34, 0.14], [0, 0, sx * -0.3]), metal(CONE4, TRIM, [sx * 0.1, hy - 0.3, hz + 0.28], [0.07, 0.17, 0.07], [Math.PI, 0, 0])]), jaw];
    case 'mohawk': return [ // saw-tooth mohawk
      part(SPH, main, [0, hy, hz], [0.56, 0.54, 0.58]),
      ...[0, 1, 2, 3, 4].map((k) => part(CONE4, acc, [0, hy + 0.32 - Math.abs(k - 2) * 0.05, hz - 0.2 + k * 0.11], [0.1, 0.46 - Math.abs(k - 2) * 0.07, 0.1])), jaw];
    case 'spikes': return [ // wild lightning hair
      part(SPH, main, [0, hy, hz], [0.56, 0.54, 0.58]),
      ...[[-0.32, -0.95], [-0.1, -0.3], [0.12, 0.35], [0.34, 0.95]].map(([x, r], i) => glow(CONE4, i % 2 ? gl : acc, [x, hy + 0.4, hz - 0.05], [0.11, 0.62, 0.11], [0, 0, r])), jaw];
    case 'ears': return [ // fox mask with tall ears
      part(SPH, main, [0, hy, hz], [0.58, 0.54, 0.6]),
      ...both((sx) => [part(CONE4, main, [sx * 0.22, hy + 0.46, hz - 0.05], [0.24, 0.52, 0.12], [0, 0, sx * -0.2]), part(CONE4, acc, [sx * 0.22, hy + 0.42, hz + 0.01], [0.13, 0.36, 0.05], [0, 0, sx * -0.2])]),
      metal(RBOX, TRIM, [0, hy - 0.1, hz + 0.2], [0.4, 0.3, 0.24]), jaw];
    case 'crown': return [ // spiked crown
      part(RBOX, main, [0, hy, hz], [0.54, 0.5, 0.56]), metal(CYL, TRIM, [0, hy + 0.27, hz], [0.58, 0.07, 0.6]),
      ...[-0.22, -0.11, 0, 0.11, 0.22].map((x, i) => glow(CONE4, i % 2 ? gl : acc, [x, hy + 0.4 + (i % 2 ? 0 : 0.1), hz], [0.1, 0.28 + (i % 2 ? 0 : 0.16), 0.1])), jaw];
    case 'beanie': return [ // knit cap with a pom-pom
      cloth(SPH, main, [0, hy + 0.05, hz - 0.02], [0.66, 0.62, 0.68]), cloth(CYL, acc, [0, hy - 0.08, hz], [0.64, 0.12, 0.64]), cloth(SPH, 0xF4F8FF, [0, hy + 0.42, hz - 0.04], 0.2), jaw];
    case 'crystal': return [ // faceted crystal head
      part(OCT, main, [0, hy + 0.04, hz], [0.64, 0.96, 0.64]), glow(OCT, gl, [0, hy + 0.04, hz], [0.36, 0.56, 0.36]), metal(OCT, acc, [0, hy + 0.62, hz], [0.2, 0.32, 0.2]), jaw];
    case 'wizard': return [ // tall bent hat with a wide brim
      part(SPH, shade(main, 0.7), [0, hy, hz], [0.54, 0.52, 0.56]), cloth(CONE, main, [0, hy + 0.62, hz - 0.12], [0.6, 1.1, 0.6], [-0.18, 0, 0]),
      metal(CYL, acc, [0, hy + 0.16, hz], [0.94, 0.05, 0.94]), glow(SPH, gl, [0, hy + 1.2, hz - 0.24], 0.13), jaw];
    case 'brim': return [ // wide-brim ranger hat
      part(SPH, shade(main, 0.9), [0, hy, hz], [0.56, 0.54, 0.58]), cloth(CYL, main, [0, hy + 0.3, hz], [0.5, 0.32, 0.5]), cloth(CYL, main, [0, hy + 0.17, hz], [1.04, 0.05, 1.04]),
      metal(CYL, acc, [0, hy + 0.22, hz], [0.53, 0.07, 0.53]), jaw];
    case 'goggles': return [ // cap with big round goggles
      part(DOME, main, [0, hy + 0.02, hz], [0.62, 0.5, 0.62]), part(SPH, shade(main, 0.9), [0, hy - 0.04, hz], [0.56, 0.5, 0.58]), metal(CYL, STEEL, [0, hy + 0.1, hz], [0.62, 0.12, 0.62]),
      ...both((sx) => [metal(CYL, TRIM, [sx * 0.16, hy + 0.12, hz + 0.27], [0.22, 0.1, 0.22], [Math.PI / 2, 0, 0]), glow(CYL, gl, [sx * 0.16, hy + 0.12, hz + 0.33], [0.15, 0.03, 0.15], [Math.PI / 2, 0, 0])]), jaw];
    case 'feather': return [ // headband with long feathers
      part(SPH, main, [0, hy, hz - 0.04], [0.54, 0.54, 0.66]), metal(CYL, acc, [0, hy + 0.04, hz], [0.58, 0.08, 0.58]),
      ...[0, 1, 2].map((k) => part(RBOX, k % 2 ? acc : 0xFFFFFF, [0.26, hy + 0.3 + k * 0.1, hz - 0.2 - k * 0.1], [0.06, 0.58, 0.15], [-0.7 - k * 0.1, 0, -0.3 - k * 0.2])), jaw];
    case 'cap': return [ // backwards cap
      part(SPH, shade(main, 0.9), [0, hy, hz], [0.56, 0.52, 0.58]), part(DOME, main, [0, hy + 0.08, hz - 0.02], [0.64, 0.5, 0.64]), part(RBOX, acc, [0, hy + 0.02, hz - 0.36], [0.44, 0.05, 0.3], [-0.1, 0, 0]),
      glow(OCT, gl, [0, hy + 0.3, hz + 0.1], [0.14, 0.14, 0.05]), jaw];
    case 'halo': return [ // floating halo
      part(SPH, main, [0, hy, hz], [0.58, 0.56, 0.6]), glow(RING, gl, [0, hy + 0.62, hz], [0.8, 0.8, 0.8], [Math.PI / 2, 0, 0]), metal(RING, acc, [0, hy + 0.62, hz], [0.95, 0.95, 0.95], [Math.PI / 2, 0, 0]), jaw];
    case 'tophat': return [ // conductor's top hat
      part(SPH, shade(main, 0.9), [0, hy, hz], [0.56, 0.54, 0.58]), part(CYL, main, [0, hy + 0.55, hz], [0.5, 0.7, 0.5]), metal(CYL, acc, [0, hy + 0.34, hz], [0.53, 0.1, 0.53]),
      part(CYL, main, [0, hy + 0.22, hz], [0.86, 0.05, 0.86]), jaw];
    case 'petals': return [ // flower-petal crown
      part(SPH, main, [0, hy, hz], [0.58, 0.56, 0.6]),
      ...[0, 1, 2, 3, 4, 5].map((k) => { const a = (k / 6) * Math.PI * 2; return part(SPH, k % 2 ? acc : 0xFFFFFF, [Math.sin(a) * 0.34, hy + 0.28, hz + Math.cos(a) * 0.34], [0.3, 0.12, 0.26], [Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5]); }),
      glow(SPH, gl, [0, hy + 0.34, hz], 0.17), jaw];
    case 'rays': return [ // sun-burst halo
      part(SPH, main, [0, hy, hz], [0.56, 0.54, 0.58]), glow(RING, gl, [0, hy, hz - 0.22], [1.1, 1.1, 1.1]),
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((k) => { const a = (k / 8) * Math.PI * 2; return glow(CONE4, acc, [Math.sin(a) * 0.66, hy + Math.cos(a) * 0.66, hz - 0.22], [0.1, 0.3, 0.1], [0, 0, -a]); }), jaw];
    default: return [ // fin: sleek racer helmet with a dorsal fin and glow strip
      part(SPH, main, [0, hy, hz - 0.04], [0.54, 0.54, 0.7]), part(BOX, acc, [0, hy + 0.24, hz - 0.3], [0.06, 0.4, 0.55], [-0.55, 0, 0]),
      glow(BOX, gl, [0, hy + 0.28, hz - 0.02], [0.03, 0.04, 0.3]), jaw];
  }
}

function visor(kind, hy, hz, col) {
  const z = hz + 0.3, b = (x, y, w, h, rz = 0) => part(RBOX, col, [x, y, z], [w, h, 0.06], [0, 0, rz]);
  if (kind === 'none') return [b(0, -9, 0.001, 0.001)];
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
  if (kind === 'club') P.push( // gnarled log club held upright beside the shoulder
    metal(CYL, shade(acc, 0.7), [R, HIP + 0.6, 0.3], [0.16, 1.3, 0.16], [0.12, 0, -0.05]), part(CYL, acc, [R, HIP + 1.55, 0.36], [0.55, 1.1, 0.55], [0.12, 0, -0.05]),
    glow(SPH, gl, [R + 0.26, HIP + 1.6, 0.4], 0.14), glow(SPH, gl, [R - 0.22, HIP + 1.35, 0.4], 0.1), metal(CONE, TRIM, [R, HIP + 2.18, 0.4], [0.2, 0.3, 0.2]));
  if (kind === 'hammer') P.push( // colossal quake hammer raised beside the head
    metal(CYL, STEEL, [R, HIP + 0.95, 0.3], [0.13, 2.1, 0.13], [0.12, 0, -0.04]), part(RBOX, main, [R, HIP + 2.0, 0.38], [1.0, 0.62, 0.62], [0.12, 0, -0.04]),
    metal(RBOX, TRIM, [R, HIP + 2.0, 0.38], [1.06, 0.14, 0.68], [0.12, 0, -0.04]), glow(BOX, gl, [R, HIP + 2.0, 0.71], [0.62, 0.3, 0.02], [0.12, 0, -0.04]));
  if (kind === 'flail') P.push( // chain flail with a spiked ball
    metal(CYL, STEEL, [R, HIP + 0.2, 0.4], [0.1, 0.5, 0.1], [Math.PI / 2, 0, 0]), ...[0, 1, 2, 3].map((k) => metal(RING, TRIM, [R, HIP + 0.1 - k * 0.1, 0.8 + k * 0.28], [0.22, 0.22, 0.22], [k % 2 ? 0 : Math.PI / 2, 0, 0])),
    metal(SPH, STEEL, [R, HIP - 0.1, 1.95], [0.55, 0.55, 0.55]), ...[0, 1, 2, 3, 4, 5].map((k) => { const a = (k / 6) * Math.PI * 2; return metal(CONE4, acc, [R + Math.cos(a) * 0.3, HIP - 0.1 + Math.sin(a) * 0.3, 1.95], [0.12, 0.24, 0.12], [0, 0, a - Math.PI / 2]); }),
    glow(SPH, gl, [R, HIP - 0.1, 1.95], 0.22));
  if (kind === 'axe') P.push( // double-bit axe
    metal(CYL, STEEL, [R, HIP + 0.4, 0.5], [0.1, 1.9, 0.1], [Math.PI / 2 - 0.4, 0, 0]),
    ...[-1, 1].map((sy) => metal(CONE4, TRIM, [R, HIP + 0.85 + sy * 0.34, 1.2 - sy * 0.06], [0.1, 0.6, 0.62], [0, 0, 0])),
    part(HEX, main, [R, HIP + 0.85, 1.2], [0.4, 0.14, 0.4], [Math.PI / 2, 0, 0]), glow(HEX, gl, [R, HIP + 0.85, 1.28], [0.2, 0.04, 0.2], [Math.PI / 2, 0, 0]));
  if (kind === 'claws') for (const sx of [-1, 1]) P.push( // lightning claws on both fists
    part(RBOX, shade(main, 0.9), [sx * ax, HIP + 0.02, 0.18], [0.3, 0.3, 0.34]), ...[-0.1, 0, 0.1].map((dx) => glow(CONE4, gl, [sx * ax + dx, HIP + 0.02, 0.72], [0.06, 0.6, 0.06], [Math.PI / 2, 0, 0])), metal(RBOX, TRIM, [sx * ax, HIP + 0.2, 0.2], [0.34, 0.06, 0.38]));
  if (kind === 'daggers') for (const sx of [-1, 1]) P.push( // twin reverse-grip daggers
    rubber(CYL, DARK, [sx * ax, HIP + 0.1, 0.2], [0.1, 0.3, 0.1], [Math.PI / 2, 0, 0]), metal(BOX, STEEL, [sx * ax, HIP + 0.1, 0.72], [0.05, 0.16, 0.7]), glow(BOX, gl, [sx * ax, HIP + 0.18, 0.72], [0.03, 0.04, 0.66]), metal(CONE4, TRIM, [sx * ax, HIP + 0.1, 1.18], [0.07, 0.3, 0.12], [Math.PI / 2, 0, 0]));
  if (kind === 'sickle') P.push( // curved hex-sickle on a long haft
    metal(CYL, STEEL, [R, HIP + 0.5, 0.4], [0.07, 2.4, 0.07], [0.1, 0, 0]),
    ...[0, 1, 2, 3].map((k) => { const a = -0.4 + k * 0.55; return metal(BOX, TRIM, [R, HIP + 1.82 + Math.sin(a + 0.6) * 0.5, 0.55 + Math.cos(a + 0.6) * 0.5 - 0.4], [0.04, 0.12, 0.34], [-(a + 1.2), 0, 0]); }),
    glow(OCT, gl, [R, HIP + 1.7, 0.5], [0.16, 0.2, 0.16]));
  if (kind === 'cannon') P.push( // fat arm-mounted mortar cannon
    part(RBOX, shade(main, 0.7), [R, HIP + 0.1, 0.5], [0.5, 0.5, 0.7]), metal(CYL, STEEL, [R, HIP + 0.14, 1.15], [0.38, 0.9, 0.38], [Math.PI / 2, 0, 0]), metal(CYL, TRIM, [R, HIP + 0.14, 1.6], [0.5, 0.12, 0.5], [Math.PI / 2, 0, 0]), glow(CYL, gl, [R, HIP + 0.14, 1.64], [0.32, 0.03, 0.32], [Math.PI / 2, 0, 0]));
  if (kind === 'icewand') P.push( // crystal icicle wand
    metal(CYL, TRIM, [R, HIP + 0.4, 0.45], [0.06, 1.4, 0.06], [0.15, 0, 0]), glow(CONE4, gl, [R, HIP + 1.35, 0.58], [0.2, 0.9, 0.2], [0.15, 0, 0]), metal(OCT, acc, [R, HIP + 1.0, 0.52], [0.16, 0.22, 0.16]));
  if (kind === 'orb') P.push( // held void orb in a ring
    glow(SPH, gl, [R, HIP + 0.45, 0.65], [0.5, 0.5, 0.5]), metal(RING, acc, [R, HIP + 0.45, 0.65], [0.95, 0.95, 0.95], [0.5, 0.3, 0]), metal(RING, TRIM, [R, HIP + 0.45, 0.65], [0.8, 0.8, 0.8], [1.6, 0, 0.6]));
  if (kind === 'sniper') P.push( // long rail rifle with scope
    part(RBOX, shade(main, 0.55), [R, HIP + 0.3, 0.55], [0.16, 0.24, 1.0]), metal(CYL, STEEL, [R, HIP + 0.38, 1.7], [0.08, 1.7, 0.08], [Math.PI / 2, 0, 0]), metal(CYL, TRIM, [R, HIP + 0.62, 0.8], [0.16, 0.7, 0.16], [Math.PI / 2, 0, 0]),
    glow(CYL, gl, [R, HIP + 0.62, 1.17], [0.12, 0.03, 0.12], [Math.PI / 2, 0, 0]), glow(CYL, gl, [R, HIP + 0.38, 2.57], [0.1, 0.03, 0.1], [Math.PI / 2, 0, 0]));
  if (kind === 'bow') P.push( // glowing recurve bow held out front
    metal(BOX, TRIM, [R, HIP + 0.3, 0.55], [0.08, 0.3, 0.08]),
    ...[1, -1].map((sy) => metal(CYL, STEEL, [R, HIP + 0.3 + sy * 0.55, 0.6 - 0.12 * Math.abs(sy)], [0.07, 0.8, 0.07], [sy * 0.35, 0, 0])), glow(BOX, gl, [R, HIP + 0.3, 0.5], [0.015, 1.5, 0.015]), glow(CONE4, gl, [R, HIP + 0.3, 0.9], [0.06, 0.4, 0.06], [Math.PI / 2, 0, 0]));
  if (kind === 'pistols') for (const sx of [-1, 1]) P.push( // dual pinball pistols
    part(RBOX, shade(main, 0.6), [sx * ax, HIP + 0.08, 0.4], [0.2, 0.3, 0.46]), metal(CYL, STEEL, [sx * ax, HIP + 0.16, 0.85], [0.12, 0.55, 0.12], [Math.PI / 2, 0, 0]), metal(SPH, TRIM, [sx * ax, HIP + 0.02, 0.2], 0.16), glow(CYL, gl, [sx * ax, HIP + 0.16, 1.14], [0.1, 0.03, 0.1], [Math.PI / 2, 0, 0]));
  if (kind === 'scepter') P.push( // healing scepter with a glowing cross
    metal(CYL, TRIM, [R, HIP + 0.7, 0.4], [0.07, 2.0, 0.07], [0.1, 0, 0]), glow(BOX, gl, [R, HIP + 1.78, 0.52], [0.14, 0.62, 0.1]), glow(BOX, gl, [R, HIP + 1.78, 0.52], [0.52, 0.14, 0.1]), metal(RING, acc, [R, HIP + 1.78, 0.52], [0.75, 0.75, 0.75]));
  if (kind === 'baton') P.push( // conductor's baton + megaphone
    metal(CYL, TRIM, [R, HIP + 0.25, 0.8], [0.04, 1.4, 0.04], [Math.PI / 2 - 0.5, 0, 0]), glow(SPH, gl, [R, HIP + 0.75, 1.38], 0.12),
    part(CONE, acc, [-R * 0.5, HIP + 0.1, 0.6], [0.5, 0.7, 0.5], [Math.PI / 2, 0, 0]), glow(CYL, gl, [-R * 0.5, HIP + 0.1, 0.96], [0.4, 0.03, 0.4], [Math.PI / 2, 0, 0]));
  if (kind === 'flowerstaff') P.push( // staff topped with a big flower
    metal(CYL, shade(acc, 0.7), [R, HIP + 0.7, 0.4], [0.08, 2.2, 0.08], [0.1, 0, 0]),
    ...[0, 1, 2, 3, 4, 5].map((k) => { const a = (k / 6) * Math.PI * 2; return part(SPH, k % 2 ? acc : 0xFFFFFF, [R + Math.cos(a) * 0.3, HIP + 1.84 + Math.sin(a) * 0.3, 0.52], [0.28, 0.28, 0.1]); }), glow(SPH, gl, [R, HIP + 1.84, 0.56], 0.2));
  if (kind === 'lantern') P.push( // swinging sun lantern on a hook
    metal(CYL, TRIM, [R, HIP + 0.6, 0.45], [0.06, 1.6, 0.06], [0.3, 0, 0]), metal(CYL, STEEL, [R, HIP + 1.28, 0.8], [0.4, 0.08, 0.4]), glow(HEX, gl, [R, HIP + 1.0, 0.8], [0.4, 0.5, 0.4]), metal(CYL, STEEL, [R, HIP + 0.72, 0.8], [0.4, 0.08, 0.4]));
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
    case 'plates': for (let k = 0; k < 3; k++) P.push(part(RBOX, k % 2 ? shade(main, 0.8) : main, [0, 0.95 - k * 0.4, -0.3 - k * 0.03], [1.1 - k * 0.12, 0.36, 0.16], [-0.1, 0, 0]), metal(BOX, TRIM, [0, 0.77 - k * 0.4, -0.36 - k * 0.03], [1.0 - k * 0.12, 0.04, 0.05])); P.push(glow(OCT, gl, [0, 0.55, -0.42], [0.2, 0.2, 0.06])); break;
    case 'anchor': P.push(metal(CYL, TRIM, [0, 0.6, -0.4], [0.13, 2.2, 0.13], [0.1, 0, 0.35]), metal(CYL, TRIM, [-0.2, 1.38, -0.4], [0.8, 0.12, 0.12], [0, 0, 0.35]), metal(RING, acc, [-0.52, 1.58, -0.4], [0.4, 0.4, 0.4]), metal(CONE4, acc, [0.35, -0.38, -0.4], [0.3, 0.5, 0.12], [0, 0, 2.0]), metal(CONE4, acc, [0.72, -0.2, -0.4], [0.3, 0.5, 0.12], [0, 0, 1.0]), glow(OCT, gl, [0.0, 0.62, -0.4], [0.18, 0.18, 0.18])); break;
    case 'shell': P.push(part(SPH, main, [0, 0.5, -0.6], [1.5, 1.2, 0.8]), ...[0, 1, 2].map((k) => metal(RBOX, acc, [-0.4 + k * 0.4, 0.55, -0.99], [0.34, 0.9, 0.06], [0, 0, (k - 1) * 0.2])), ...[0, 1, 2, 3].map((k) => part(CONE, 0x6FD05A, [-0.55 + k * 0.37, 1.15 - Math.abs(k - 1.5) * 0.12, -0.7], [0.22, 0.5, 0.22], [0, 0, (1.5 - k) * 0.25])), glow(SPH, gl, [0, 1.3, -0.75], 0.12)); break;
    case 'rocks': P.push(part(OCT, main, [-0.3, 0.7, -0.5], [0.7, 0.8, 0.6], [0.3, 0.5, 0.2]), part(OCT, shade(main, 0.8), [0.3, 0.45, -0.55], [0.6, 0.7, 0.55], [0.1, 1.1, -0.2]), part(OCT, shade(main, 0.9), [0.05, 1.15, -0.45], [0.5, 0.6, 0.45], [0.4, 0.2, 0.3]), glow(OCT, gl, [-0.3, 0.7, -0.82], [0.2, 0.3, 0.1]), glow(OCT, gl, [0.3, 0.45, -0.86], [0.16, 0.24, 0.1])); break;
    case 'banner': P.push(metal(CYL, STEEL, [0.25, 1.0, -0.3], [0.07, 3.0, 0.07]), metal(OCT, TRIM, [0.25, 2.55, -0.3], [0.18, 0.26, 0.18]), cloth(RBOX, acc, [0.25, 1.95, -0.62], [0.06, 0.9, 0.62]), glow(OCT, gl, [0.25, 1.95, -0.66], [0.04, 0.34, 0.3]), cloth(CONE4, acc, [0.25, 1.35, -0.62], [0.06, 0.4, 0.62], [Math.PI, 0, 0])); break;
    case 'chains': for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) P.push(metal(RING, TRIM, [sx * (0.3 + k * 0.1), 0.7 - k * 0.3, -0.25 - k * 0.04], [0.3, 0.3, 0.3], [k % 2 ? 0 : Math.PI / 2, 0, 0])); P.push(metal(SPH, STEEL, [0.55, -0.45, -0.4], [0.4, 0.4, 0.4]), metal(SPH, STEEL, [-0.55, -0.45, -0.4], [0.4, 0.4, 0.4]), glow(OCT, gl, [0, 0.4, -0.2], [0.14, 0.14, 0.14])); break;
    case 'saw': P.push(metal(CYL, STEEL, [0, 0.55, -0.4], [1.3, 0.08, 1.3], [Math.PI / 2, 0, 0]), ...[0, 1, 2, 3, 4, 5, 6, 7].map((k) => { const a = (k / 8) * Math.PI * 2; return metal(CONE4, TRIM, [Math.cos(a) * 0.68, 0.55 + Math.sin(a) * 0.68, -0.4], [0.14, 0.24, 0.1], [0, 0, a - Math.PI / 2]); }), glow(CYL, gl, [0, 0.55, -0.45], [0.4, 0.04, 0.4], [Math.PI / 2, 0, 0]), part(CYL, acc, [0, 0.55, -0.42], [0.3, 0.06, 0.3], [Math.PI / 2, 0, 0])); break;
    case 'katanas': for (const sx of [-1, 1]) P.push(metal(BOX, STEEL, [sx * 0.3, 0.9, -0.32], [0.05, 2.0, 0.1], [0, 0, sx * -0.55]), glow(BOX, gl, [sx * 0.3, 0.9, -0.38], [0.025, 1.9, 0.03], [0, 0, sx * -0.55]), rubber(CYL, DARK, [sx * -0.28, -0.0, -0.32], [0.09, 0.5, 0.09], [0, 0, sx * -0.55]), metal(RBOX, acc, [sx * -0.1, 0.25, -0.32], [0.3, 0.05, 0.1], [0, 0, sx * -0.55])); break;
    case 'tail': P.push(part(CAP, main, [0, -0.15, -0.55], [0.34, 0.38, 0.34], [-1.1, 0, 0]), part(CAP, shade(main, 0.9), [0, 0.35, -1.05], [0.46, 0.5, 0.46], [-0.7, 0, 0]), part(SPH, acc, [0, 0.95, -1.35], [0.5, 0.5, 0.56]), glow(SPH, gl, [0, 0.95, -1.4], 0.14)); break;
    case 'cloak': for (const sx of [-1, 1]) P.push(cloth(RBOX, shade(main, 0.55), [sx * 0.2, -0.4, -0.16], [0.4, 1.4, 0.05], [0.14, 0, sx * 0.1]), cloth(CONE4, shade(main, 0.55), [sx * 0.2, -1.2, -0.2], [0.4, 0.4, 0.05], [Math.PI, 0, 0])); P.push(glow(OCT, gl, [0, 0.0, -0.22], [0.3, 0.4, 0.05]), glow(BOX, gl, [0, -0.6, -0.2], [0.03, 0.8, 0.02])); break;
    case 'icicles': for (let k = 0; k < 7; k++) { const a = (k - 3) * 0.34; P.push(glow(CONE4, k % 2 ? gl : acc, [Math.sin(a) * 0.35, 0.95 + Math.cos(a) * 0.3, -0.35], [0.16, 0.9 - Math.abs(k - 3) * 0.1, 0.16], [-0.5, 0, -a])); } break;
    case 'void': for (let k = 0; k < 5; k++) P.push(metal(OCT, k % 2 ? acc : STEEL, [(k - 2) * 0.42, 0.7 - Math.abs(k - 2) * 0.35 + (k % 2) * 0.3, -0.5 - Math.abs(k - 2) * 0.1], [0.22, 0.8, 0.12], [0.2, 0.3, (k - 2) * 0.3]), glow(OCT, gl, [(k - 2) * 0.42, 0.7 - Math.abs(k - 2) * 0.35 + (k % 2) * 0.3, -0.5 - Math.abs(k - 2) * 0.1], [0.1, 0.5, 0.06], [0.2, 0.3, (k - 2) * 0.3])); break;
    case 'jet': for (const sx of [-1, 1]) P.push(metal(CYL, STEEL, [sx * 0.3, 0.5, -0.4], [0.3, 0.9, 0.3], [-0.1, 0, 0]), metal(CYL, TRIM, [sx * 0.3, 1.0, -0.42], [0.34, 0.1, 0.34], [-0.1, 0, 0]), glow(CONE, gl, [sx * 0.3, -0.18, -0.34], [0.26, 0.5, 0.26], [Math.PI - 0.1, 0, 0]), part(CYL, acc, [sx * 0.3, 0.5, -0.4], [0.32, 0.12, 0.32], [-0.1, 0, 0])); break;
    case 'quiver': P.push(part(CYL, shade(main, 0.7), [0.18, 0.7, -0.35], [0.34, 1.3, 0.34], [-0.3, 0, -0.35]), metal(CYL, TRIM, [0.4, 1.28, -0.3], [0.38, 0.08, 0.38], [-0.3, 0, -0.35]), ...[0, 1, 2, 3].map((k) => part(CONE4, k % 2 ? acc : 0xFFFFFF, [0.45 + k * 0.05, 1.5 + k * 0.03, -0.3 - k * 0.08], [0.1, 0.35, 0.04], [-0.3, 0, -0.35 + k * 0.1])), glow(OCT, gl, [0, 0.4, -0.2], [0.12, 0.12, 0.12])); break;
    case 'speaker': for (let k = 0; k < 2; k++) P.push(rubber(RBOX, DARK, [0, 0.35 + k * 0.7, -0.4], [0.9, 0.62, 0.38]), metal(CYL, TRIM, [0, 0.35 + k * 0.7, -0.62], [0.5, 0.06, 0.5], [Math.PI / 2, 0, 0]), glow(CYL, gl, [0, 0.35 + k * 0.7, -0.66], [0.24, 0.04, 0.24], [Math.PI / 2, 0, 0])); P.push(metal(RING, acc, [0, 1.5, -0.4], [0.7, 0.7, 0.7])); break;
    case 'bouquet': for (let k = 0; k < 5; k++) { const a = (k - 2) * 0.4; P.push(cloth(CYL, 0x4FA844, [Math.sin(a) * 0.3, 0.7 + Math.cos(a) * 0.25, -0.3], [0.05, 0.9, 0.05], [-0.3, 0, -a]), part(SPH, k % 2 ? acc : 0xFFFFFF, [Math.sin(a) * 0.62, 1.15 + Math.cos(a) * 0.4, -0.4], [0.36, 0.36, 0.2]), glow(SPH, gl, [Math.sin(a) * 0.62, 1.15 + Math.cos(a) * 0.4, -0.5], 0.1)); } break;
    case 'sun': P.push(glow(RING, gl, [0, 0.8, -0.6], [1.5, 1.5, 1.5]), metal(RING, acc, [0, 0.8, -0.62], [1.2, 1.2, 1.2]), glow(SPH, gl, [0, 0.8, -0.6], [0.5, 0.5, 0.16]), ...[0, 1, 2, 3, 4, 5, 6, 7].map((k) => { const a = (k / 8) * Math.PI * 2; return glow(CONE4, acc, [Math.sin(a) * 0.95, 0.8 + Math.cos(a) * 0.95, -0.6], [0.12, 0.4, 0.1], [0, 0, -a]); })); break;
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

// Hip armor: overlapping fauld plates for heavy frames, a plate + cloth tabard for medium, long cloth tabards for slim.
// Authored in the skirt group's space (origin = belt front), so the flaps can swing with the stride.
function skirt(torso, T, main, acc, gl) {
  const w = T.w, d = T.d;
  if (torso === 'heavy') return [
    ...[-1, 0, 1].map((k) => part(RBOX, k ? shade(main, 0.88) : main, [k * w * 0.26, -0.2, 0.02 - Math.abs(k) * 0.06], [w * 0.28, 0.36, 0.08], [0.12, k * -0.3, k * 0.08])),
    ...[-1, 0, 1].map((k) => metal(BOX, TRIM, [k * w * 0.26, -0.37, 0.05 - Math.abs(k) * 0.06], [w * 0.27, 0.04, 0.06], [0.12, k * -0.3, k * 0.08])),
    ...both((sx) => [part(RBOX, shade(main, 0.8), [sx * w * 0.46, -0.16, -d * 0.45], [0.12, 0.34, d * 0.7], [0, 0, sx * 0.18])]),
    glow(OCT, gl, [0, -0.18, 0.08], [0.1, 0.14, 0.04])];
  if (torso === 'medium') return [
    cloth(RBOX, shade(acc, 0.75), [0, -0.3, 0.02], [w * 0.36, 0.58, 0.04], [0.1, 0, 0]),
    metal(BOX, TRIM, [0, -0.58, 0.05], [w * 0.36, 0.05, 0.05], [0.1, 0, 0]),
    ...both((sx) => [part(RBOX, shade(main, 0.85), [sx * w * 0.32, -0.14, -0.04], [w * 0.26, 0.26, 0.08], [0.12, sx * -0.4, sx * 0.12])]),
    cloth(RBOX, shade(acc, 0.6), [0, -0.3, -d - 0.02], [w * 0.5, 0.56, 0.04], [-0.1, 0, 0])];
  return [
    cloth(RBOX, shade(main, 0.62), [0, -0.38, 0.02], [w * 0.4, 0.74, 0.035], [0.08, 0, 0]),
    glow(BOX, gl, [0, -0.38, 0.045], [0.03, 0.6, 0.01], [0.08, 0, 0]),
    metal(BOX, acc, [0, -0.74, 0.05], [w * 0.4, 0.05, 0.04], [0.08, 0, 0]),
    cloth(RBOX, shade(main, 0.5), [0, -0.42, -d - 0.02], [w * 0.62, 0.84, 0.035], [-0.08, 0, 0])];
}

// Small layered details that make the silhouette read at phone size: belt pouches, chest vents, rivets, spine ridge, antennae.
function trim(spec, T, hy, hunch, main, acc, gl) {
  const P = [], mid = HIP + T.h * 0.5, z = T.d / 2 + hunch * 0.4;
  for (const sx of [-1, 1]) {
    P.push(rubber(RBOX, shade(acc, 0.55), [sx * T.w * 0.36, HIP + 0.02, T.d * 0.18], [0.16, 0.18, 0.14])); // pouches
    P.push(metal(BOX, TRIM, [sx * T.w * 0.36, HIP + 0.1, T.d * 0.26], [0.16, 0.03, 0.02]));
    for (const k of [0, 1, 2]) P.push(rubber(BOX, DARK, [sx * T.w * 0.44, mid + 0.02 + k * 0.1, z * 0.2], [0.04, 0.035, T.d * 0.5])); // side vents
    P.push(metal(OCT, TRIM, [sx * T.w * 0.36, mid + 0.42, z - 0.04], 0.06), metal(OCT, TRIM, [sx * T.w * 0.12, mid + 0.42, z + 0.02], 0.06)); // rivets
  }
  for (const k of [0, 1, 2]) P.push(metal(RBOX, STEEL, [0, mid - 0.1 + k * 0.2, -T.d / 2 - 0.04 + hunch * 0.3], [0.2 - k * 0.03, 0.12, 0.08])); // spine ridge
  if (spec.helmet === 'dome' || spec.helmet === 'fin') P.push( // antenna with a glowing tip
    metal(CYL, STEEL, [0.24, hy + 0.36, hunch - 0.1], [0.03, 0.5, 0.03], [-0.3, 0, -0.2]), glow(SPH, gl, [0.3, hy + 0.6, hunch - 0.18], 0.08));
  if (spec.helmet === 'flat' || spec.helmet === 'crest') P.push(...both((sx) => [metal(CONE, TRIM, [sx * 0.28, hy + 0.3, hunch], [0.07, 0.26, 0.07], [0, 0, sx * -0.6])])); // helm spikes
  return P;
}


// Floating pieces that orbit the champion (hero.js spins `halo`): the silhouette read for casters and supports.
const HALOS = {
  prism: { n: 4, r: 1.35, y: 2.0, g: OCT, s: [0.3, 0.55, 0.3], glow: 1 },
  shards: { n: 5, r: 1.5, y: 1.8, g: CONE4, s: [0.22, 0.55, 0.22], glow: 0, flip: 1 },
  motes: { n: 5, r: 1.25, y: 2.1, g: SPH, s: [0.2, 0.2, 0.2], glow: 1 },
  petals: { n: 6, r: 1.3, y: 1.7, g: SPH, s: [0.34, 0.1, 0.22], glow: 0 },
  flakes: { n: 5, r: 1.3, y: 2.0, g: OCT, s: [0.28, 0.28, 0.1], glow: 1 },
  rings: { n: 2, r: 1.2, y: 2.0, g: RING, s: [1.1, 1.1, 1.1], glow: 1, tilt: 1 },
  notes: { n: 4, r: 1.3, y: 2.2, g: SPH, s: [0.18, 0.28, 0.12], glow: 1 },
};
function haloGeo(kind, main, acc, gl) {
  const H = HALOS[kind], P = [];
  for (let k = 0; k < H.n; k++) {
    const a = (k / H.n) * Math.PI * 2, y = H.y + (k % 2 ? 0.25 : -0.1);
    const rot = H.tilt ? [Math.PI / 2 + k * 0.7, k * 0.5, 0] : H.flip ? [Math.PI, 0, 0] : [0.3, a, 0.2];
    P.push((H.glow ? glow : metal)(H.g, k % 2 ? gl : tint(acc, 0xffffff, 0.2), [Math.cos(a) * H.r, y, Math.sin(a) * H.r], H.s, rot));
  }
  return mergeParts(P);
}

// -> { root, lean, eyes, tail, legs, arms, skirt, hand, orb, halo, style, mats } — hero.js animates the groups and flashes mats.
// Arms are separate groups pivoting at the shoulder (arms[0] = weapon side, arms[1] = off hand) so attacks and casts move limbs.
export function buildChampion(spec, def, team = 0) {
  if (spec.wave === 'b') return buildWave2B(spec, def, team);
  const T = TORSO[spec.torso], main = ground(def.color, 0.18), acc = ground(def.accent, 0.12); // muted, painted-metal tones
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
    ...scaleAbout(helmet(spec.helmet, hy, hunch, main, acc, gl), [0, hy - 0.2, hunch], (spec.head ?? HEAD) * HEAD_K),
    ...pauldrons(spec.paul, T.w, HIP + T.h - 0.02, main, acc, gl),
    ...trim(spec, T, hy, hunch, main, acc, gl),
  ];
  if (spec.emblem) body.push(glow(OCT, gl, [0, mid + 0.18, chestZ + 0.06], [0.26, 0.34, 0.08]));
  if (spec.cracks) for (const [x, r] of [[-0.18, 0.5], [0.12, -0.4], [0.28, 0.2]]) body.push(glow(BOX, gl, [x, mid + 0.1, chestZ + 0.01], [0.04, 0.5, 0.04], [0, 0, r]));

  const mat = toonMat({ vertexColors: true, finish: true, rim: 0.3 });
  const lean = new THREE.Group();
  lean.add(toonMesh(mergeParts(body), mat, 0.03));

  const vc = new THREE.Color(TEAM[team].main).lerp(new THREE.Color(0xffffff), 0.35).getHex();
  const eyes = new THREE.Mesh(mergeParts(scaleAbout(visor(spec.visor, 0, hunch, vc), [0, -0.2, hunch], (spec.head ?? HEAD) * HEAD_K)), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
  eyes.position.y = hy;
  lean.add(eyes);

  // Arms: split the authored parts by side, re-centre them on the shoulder pivot.
  const shY = HIP + 0.86 + (T.h - 0.95), armParts = lift(arms(spec.arm, ax, main, acc, gl), T.h - 0.95);
  const armGroups = [-1, 1].map((sx) => {
    const g = new THREE.Group();
    g.position.set(sx * ax, shY, 0);
    const P = armParts.filter((q) => Math.sign(q.p[0] || 1) === sx).map((q) => ({ ...q, p: [q.p[0] - sx * ax, q.p[1] - shY, q.p[2]] }));
    g.add(toonMesh(mergeParts(P), mat, 0.03));
    lean.add(g);
    return g;
  });
  // Charge orb in the weapon hand: grows while a skill winds up, bursts on release.
  const hand = new THREE.Object3D();
  hand.position.set(0, -1.0, 0.4);
  armGroups[0].add(hand);
  const orb = new THREE.Mesh(SPH, new THREE.MeshBasicMaterial({ color: new THREE.Color(gl).multiplyScalar(1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  orb.visible = false;
  hand.add(orb);

  const sk = new THREE.Group();
  sk.position.set(0, HIP + 0.02, T.d * 0.42);
  sk.add(toonMesh(mergeParts(skirt(spec.torso, T, main, acc, gl)), mat, 0.02));
  lean.add(sk);

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
  rig.scale.set((spec.w ?? 1) * LEAN, (spec.h ?? 1) * TALL, (spec.w ?? 1) * LEAN);
  rig.add(lean, ...legs);
  let halo = null;
  if (spec.halo) {
    halo = new THREE.Group();
    halo.add(toonMesh(haloGeo(spec.halo, main, acc, gl), mat, 0.02));
    rig.add(halo);
  }
  const root = new THREE.Group();
  root.add(rig);
  return { root, lean, eyes, tail, legs, arms: armGroups, skirt: sk, hand, orb, halo, style: spec.style ?? 'base', mats: [mat] };
}
