// Wave 2 batch A bodies (v7.3). Every champion has its own body plan built from the shared anatomy kit — no shared
// armor template: a boulder golem, a living reef, a magma drake, a porcupine fencer, a foxfire wisp, an origami duelist,
// a golden slime, a blue crab, an elf marksman, an aurora spirit, a lotus dancer and a human lighthouse keeper.
// They all ride the same rig hero.js animates (lean / eyes / arms / hand / orb / skirt / tail / legs / halo);
// `extras` are live bits animated per frame (Granite's monolith, Wisp's flicker ears, Petal's tutu, Beacon's beams...).
import * as THREE from 'three';
import { TEAM } from '../config.js';
import { toonMat, mergeParts } from '../render/toon.js';
import {
  PI, BOX, RBOX, SOFT, BELL, SKIRT, CYL, CYL6, CONE, CONE4, OCT, ICO, ICO1, DODE, TETRA, SPH, HEAD, DOME, CAP, RING, TORUS,
  FAN, HALFRING, LEAF, SHARD, DARK, SKIN, HAIR, shade, tint, part, metal, steel, cloth, glow, rubber, stone, glass, skin, fur, wood,
  clear, both, ring, seg, chain, arm, leg, digiLeg, face, beard, torso, EYES, live, ease, meshParts, clearMat,
} from './anatomy.js';

const PUPIL = 0x14161C;
const see = (P) => P.map((q) => ({ ...q, clear: true })); // make a part list translucent
// A flat ribbon (light strands, cape tails, hair) through points: thin flattened capsules, flat side facing z.
const hot = (c, k = 0.2) => shade(c, k); // glow finish is strongly emissive: feed it a deeper tone so it stays colored
const ribbon = (pts, w, c, f = 'glow') => pts.slice(1).map((b, k) => { // constant-width strip, segments overlap a little
  const a = pts[k], d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e = 0.06;
  return seg([a[0] - d[0] * e, a[1] - d[1] * e, a[2] - d[2] * e], [b[0] + d[0] * e, b[1] + d[1] * e, b[2] + d[2] * e], [w, 0.012], c, f, BOX);
});

// ───────────── the twelve bodies ─────────────
const BUILD = {
  // STONE GOLEM: stacked irregular boulders, gold rune veins, pillar fists, a mossy back and a floating monolith.
  granite(gl) {
    const G = 0x80838B, GD = 0x5C5F66, GL = 0x9EA1A8, AU = 0xD9A441, MOSS = 0x6E8C3A;
    const vein = (a, b) => seg(a, b, [0.03, 0.014], hot(gl), 'glow', BOX);
    return {
      hip: 1.05, scale: [1.15, 1.02], gait: { cad: 0.55, swing: 0.45, bob: 0.1, lean: 0.1, float: 0, sq: 0.05 },
      body: [
        stone(DODE, GD, [0, 1.1, -0.02], [0.95, 0.55, 0.75], [0.3, 0.2, 0.1]),
        stone(ICO1, G, [0.04, 1.48, 0.04], [0.9, 0.62, 0.72], [0.2, 0.5, 0]),
        stone(DODE, G, [0, 2.0, 0], [1.5, 1.05, 1.05], [0.15, 0.4, 0.05]),
        stone(ICO1, GL, [0.05, 2.02, 0.28], [0.95, 0.74, 0.52], [0.1, 0.2, 0.1]),
        stone(ICO1, GD, [0, 2.32, -0.34], [1.1, 0.72, 0.62], [0.4, 0, 0.2]),
        stone(ICO, GD, [-0.3, 1.62, 0.3], [0.3, 0.26, 0.2], [0.4, 0.3, 0]),
        ...both((sx) => [
          stone(DODE, G, [sx * 0.8, 2.36, -0.02], [0.75, 0.66, 0.78], [sx * 0.4, 0.3, sx * 0.2]),
          stone(ICO, GD, [sx * 0.74, 2.72, -0.12], [0.36, 0.32, 0.36], [0.5, sx, 0]),
          fur(SOFT, MOSS, [sx * 0.8, 2.66, 0.06], [0.42, 0.1, 0.38], [0.1, 0, sx * 0.25]),
          metal(BOX, AU, [sx * 0.42, 2.18, 0.5], [0.05, 0.3, 0.04], [0, 0, sx * 0.5]),
        ]),
        fur(SOFT, MOSS, [0.1, 2.62, -0.48], [0.6, 0.12, 0.3], [0.5, 0, 0]),
        // small head boulder sunk between the shoulders, heavy brow, jaw slab
        stone(DODE, GL, [0, 2.7, 0.46], [0.5, 0.46, 0.46], [0.3, 0.6, 0]),
        stone(RBOX, GD, [0, 2.84, 0.64], [0.52, 0.11, 0.16], [0.25, 0, 0]),
        stone(ICO, GD, [0, 2.52, 0.56], [0.4, 0.18, 0.3]),
        // rune seal + glowing veins over the chest stones
        glow(RING, gl, [0.05, 2.06, 0.56], [0.36, 0.36, 0.3]), glow(OCT, gl, [0.05, 2.06, 0.57], [0.1, 0.16, 0.05]),
        vein([0.05, 2.24, 0.56], [-0.2, 2.42, 0.48]), vein([0.22, 1.94, 0.55], [0.45, 1.74, 0.42]),
        vein([-0.12, 1.9, 0.55], [-0.08, 1.62, 0.42]), vein([0.15, 1.5, 0.4], [-0.05, 1.3, 0.38]),
      ],
      eyes: { y: 2.72, parts: (vc) => EYES.glow(vc, 0.69, 0.4, { gap: 0.28, w: 0.22, h: 0.09, tilt: -0.2 }) },
      sh: [0.98, 2.25], hand: [0, -1.45, 0.3],
      arm: () => [ // pillar arm: boulder shoulder, hex basalt pillar forearm with a gold band, fist rock
        stone(DODE, G, [0, -0.3, 0], [0.52, 0.6, 0.52], [0.3, 0.2, 0]), stone(ICO, GD, [0, -0.64, 0.02], 0.38),
        stone(CYL6, G, [0, -1.0, 0.05], [0.6, 0.64, 0.6]), metal(CYL6, AU, [0, -0.76, 0.05], [0.66, 0.07, 0.66]),
        glow(BOX, gl, [0, -1.0, 0.31], [0.05, 0.42, 0.02]),
        stone(DODE, GD, [0, -1.42, 0.08], [0.68, 0.54, 0.64], [0.2, 0.3, 0]), metal(CYL6, AU, [0, -1.18, 0.06], [0.62, 0.06, 0.62]),
      ],
      legX: 0.32,
      leg: () => [stone(ICO1, G, [0, -0.3, 0], [0.54, 0.6, 0.54]), stone(DODE, GD, [0, -0.64, 0.05], 0.4),
        stone(CYL6, GD, [0, -0.8, 0], [0.46, 0.34, 0.46]), stone(DODE, G, [0, -0.96, 0.1], [0.62, 0.2, 0.76])],
      halo: ring(4, (k, a) => [stone(DODE, k % 2 ? GL : GD, [Math.cos(a) * 1.35, 0.6 + (k % 2) * 0.3, Math.sin(a) * 1.35], 0.26, [a, k, 0])]),
      extras: [{
        parent: 'lean', at: [0, 2.2, -0.9],
        parts: [stone(BOX, GD, [0, 0, 0], [0.6, 1.7, 0.24], [0, 0.1, 0.03]), stone(OCT, GD, [0, 0.95, 0], [0.6, 0.4, 0.24], [0, 0.1, 0]),
          stone(DODE, G, [0, -0.95, 0], [0.5, 0.36, 0.3]),
          glow(BOX, gl, [0, 0.1, -0.13], [0.05, 1.2, 0.02]), glow(BOX, gl, [0, 0.4, -0.13], [0.38, 0.05, 0.02]), glow(RING, gl, [0, -0.25, -0.13], [0.26, 0.26, 0.2])],
        anim: (g, t, dt, mv, h) => { g.position.y = 2.2 + Math.sin(t * 1.4) * 0.1 + (live(h, 'bedrock') ? 0.3 : 0); g.rotation.z = Math.sin(t * 0.7) * 0.05; },
      }],
    };
  },

  // LIVING CORAL REEF giant: reef-rock body grown over with coral, anemone shoulders, clam-shell hands, a starfish,
  // barnacles and a swaying kelp skirt. A brain-coral crown over a rock face with glowing eyes.
  tidewall(gl) {
    const T = 0x2E7F86, TD = 0x1E5559, TL = 0x4E9C98, CO = 0xFF8A7A, CD = 0xE0604F, PU = 0xA77BE0, CR = 0xE8E0CC,
      SH = 0xF5C6B8, SHD = 0xC98E80, PK = 0xFF7FB0, K = 0x3E8E5A, KD = 0x2F7048, AN = 0xFFB0D0, SF = 0xF29A3A, BRN = 0xE9A35E;
    const barn = (p, s = 0.1, r) => [part(CONE, CR, p, [s, s * 0.75, s], r, 'stone'), part(SPH, 0x5E574C, p, [s * 0.36, s * 0.82, s * 0.36], r)];
    const coral = (pts, r, c) => [...chain(pts, r, r * 0.7, c, 'stone'), part(SPH, c, pts[pts.length - 1], r * 1.5, undefined, 'stone')];
    const anemone = (sx) => {
      const x = sx * 0.82, y = 2.42, z = 0;
      return [stone(ICO1, CO, [x, y - 0.02, z], [0.6, 0.34, 0.58]), stone(ICO1, CD, [x - sx * 0.12, y - 0.14, z + 0.1], [0.36, 0.24, 0.34]),
        ...ring(9, (k, a) => {
          const c = Math.cos(a), s = Math.sin(a), tip = [x + c * 0.36 + sx * 0.06, y + 0.4 + (k % 2) * 0.08, z + s * 0.34];
          return [seg([x + c * 0.16, y + 0.08, z + s * 0.16], tip, 0.05, AN), glow(SPH, gl, tip, 0.08)];
        }),
        glow(SPH, tint(gl, 0xffffff, 0.3), [x, y + 0.12, z], 0.16)];
    };
    return {
      hip: 1.0, scale: [1.18, 1.0], gait: { cad: 0.75, swing: 0.5, bob: 0.14, lean: 0.06, float: 0, sq: 0.1, sway: 0.12 },
      body: [
        stone(ICO1, TD, [0, 1.05, 0], [1.0, 0.55, 0.8]),
        stone(ICO1, T, [0, 1.6, 0.02], [1.3, 1.0, 1.0], [0, 0.4, 0]),
        stone(ICO1, T, [0, 2.1, -0.02], [1.55, 0.85, 1.05], [0.3, 0, 0.2]),
        stone(ICO1, TL, [0.18, 1.72, 0.26], [0.7, 0.62, 0.52], [0.2, 0.3, 0]),
        stone(ICO1, TD, [-0.5, 1.4, 0.12], [0.5, 0.5, 0.6], [0.5, 0.2, 0]), stone(ICO1, TL, [0.55, 2.0, 0.1], [0.5, 0.45, 0.6], [0.1, 0.6, 0]),
        part(SPH, BRN, [0.42, 1.28, 0.32], [0.36, 0.3, 0.3], undefined, 'stone'), part(TORUS, shade(BRN, 0.75), [0.42, 1.3, 0.46], [0.18, 0.14, 0.1], undefined, 'stone'),
        ...coral([[-0.1, 1.5, 0.45], [-0.16, 1.7, 0.6], [-0.1, 1.85, 0.66]], 0.05, PU), ...coral([[-0.16, 1.7, 0.6], [-0.3, 1.78, 0.66]], 0.04, PU),
        ...coral([[0.3, 2.25, 0.4], [0.36, 2.4, 0.55], [0.44, 2.5, 0.56]], 0.045, CO),
        ...ring(5, (k, a) => [part(CAP, k % 2 ? AN : PK, [0.05 + Math.cos(a) * 0.08, 1.15, 0.52 + Math.sin(a) * 0.05], [0.05, 0.1, 0.05], [0.3 * Math.sin(a), 0, -0.4 * Math.cos(a)])]),
        // starfish on the chest
        ...ring(5, (k, a) => [part(CONE4, SF, [-0.3 + Math.sin(a) * 0.11, 2.0 + Math.cos(a) * 0.11, 0.5], [0.1, 0.24, 0.05], [0, 0, -a], 'stone')]),
        part(SPH, SF, [-0.3, 2.0, 0.5], [0.13, 0.13, 0.06], undefined, 'stone'),
        // coral branches growing out of the back
        ...coral([[0.3, 2.3, -0.42], [0.42, 2.7, -0.55], [0.36, 3.0, -0.62]], 0.09, CO),
        ...coral([[0.42, 2.7, -0.55], [0.66, 2.9, -0.58]], 0.06, CO),
        ...coral([[-0.32, 2.3, -0.4], [-0.44, 2.62, -0.6], [-0.6, 2.82, -0.62]], 0.08, CD),
        ...coral([[-0.44, 2.62, -0.6], [-0.36, 2.88, -0.72]], 0.055, CD),
        part(FAN, PU, [-0.1, 2.5, -0.6], [0.7, 1, 0.6], [PI / 2, 0, 0], 'stone'),
        // rock head under a brain-coral crown
        stone(ICO1, T, [0, 2.5, 0.25], [0.56, 0.46, 0.48]),
        part(SPH, BRN, [0, 2.7, 0.16], [0.6, 0.42, 0.56], undefined, 'stone'),
        ...[0.12, 0.2, 0.28].map((r, k) => part(TORUS, shade(BRN, 0.75), [0, 2.82 + (2 - k) * 0.02, 0.16], [r * 1.8, r * 1.7, 0.1], [PI / 2, 0, 0], 'stone')),
        stone(ICO, TD, [0, 2.6, 0.43], [0.52, 0.12, 0.18]),
        ...anemone(-1), ...anemone(1),
        ...barn([-0.42, 1.42, 0.45], 0.12, [0.9, 0, 0.3]), ...barn([0.48, 1.55, 0.42], 0.14, [0.9, 0, -0.4]),
        ...barn([-0.6, 1.95, 0.32], 0.1, [0.6, 0, 0.8]), ...barn([0.5, 2.15, 0.38], 0.09, [0.8, 0, -0.3]),
        ...barn([0.12, 1.12, 0.44], 0.09, [1.1, 0, 0]), ...barn([-0.18, 2.32, -0.5], 0.1, [-0.9, 0, 0]),
      ],
      eyes: { y: 2.5, parts: (vc) => EYES.glow(vc, 0.5, 0.4, { gap: 0.27, w: 0.17, h: 0.11 }) },
      sh: [0.92, 2.1], hand: [0, -1.2, 0.3],
      arm: (sx) => [
        stone(ICO1, T, [0, -0.3, 0], [0.48, 0.64, 0.48]), part(SPH, CO, [0, -0.62, 0.04], 0.32, undefined, 'stone'),
        stone(ICO1, TD, [0, -0.88, 0.04], [0.42, 0.55, 0.42]), ...barn([sx * 0.18, -0.85, 0.12], 0.09, [0.4, 0, -sx * 1.0]),
        ...coral([[sx * 0.16, -0.35, -0.1], [sx * 0.32, -0.12, -0.18], [sx * 0.36, 0.08, -0.12]], 0.05, PU),
        // clam-shell hand: lower shell cupped, upper shell hinged open at the front, glowing pearl inside
        part(DOME, SH, [0, -1.2, 0.1], [0.68, 0.3, 0.64], [PI + 0.2, 0, 0], 'stone'),
        part(DOME, SHD, [0, -1.19, 0.1], [0.6, 0.2, 0.56], [PI + 0.2, 0, 0], 'stone'),
        part(DOME, SH, [0, -1.12, 0.04], [0.68, 0.34, 0.64], [-0.5, 0, 0], 'stone'),
        part(DOME, SHD, [0, -1.13, 0.05], [0.6, 0.24, 0.56], [-0.5, 0, 0], 'stone'),
        ...[-0.18, 0, 0.18].map((x) => part(CAP, shade(SH, 0.9), [x, -0.98, -0.02], [0.05, 0.16, 0.05], [-0.8, 0, -x * 1.5], 'stone')),
        glow(SPH, gl, [0, -1.15, 0.2], 0.16),
      ],
      legX: 0.34,
      leg: () => [stone(ICO1, T, [0, -0.3, 0], [0.52, 0.64, 0.52]), stone(ICO1, TD, [0, -0.72, 0.03], [0.46, 0.44, 0.46]),
        stone(DODE, TD, [0, -0.92, 0.1], [0.62, 0.18, 0.72]), ...barn([0.12, -0.5, 0.22], 0.08, [1.0, 0, -0.3])],
      skirt: { at: [0, 1.0, 0], parts: ring(13, (k, a) => [cloth(LEAF, k % 2 ? K : KD, [Math.sin(a) * 0.52, -0.3 - (k % 3) * 0.04, Math.cos(a) * 0.44], [0.18, 0.72 - (k % 3) * 0.12, 0.45], [0, a, 0])]) },
      halo: ring(5, (k, a) => [clear(SPH, 0xBFF4FF, [Math.cos(a) * 1.35, 1.7 + (k % 3) * 0.28, Math.sin(a) * 1.35], 0.16 + (k % 2) * 0.07)]),
    };
  },

  // MAGMA FIRE DRAKE: bipedal obsidian-scaled dinosaur with a long snout, horns, lava belly plates, digitigrade legs,
  // a long spiked tail and a gold championship belt.
  embermaw(gl) {
    const SC = 0x8A3A30, SD = 0x4E2024, BE = 0xF2A04A, HN = 0xEFE2C8, AU = 0xE8B53A, R = 0xB8322A, TP = 0xFFF2DE, LAVA = hot(gl, 0.14);
    const crack = (a, b) => seg(a, b, [0.03, 0.016], LAVA, 'glow', BOX);
    const hz = 0.72, hy = 2.36;
    const spine = [[0, 2.5, 0.12], [0, 2.38, -0.16], [0, 2.18, -0.38], [0, 1.92, -0.48], [0, 1.64, -0.5]];
    const tailPts = Array.from({ length: 8 }, (_, k) => { const t = k / 7; return [0, -t * 0.7 + Math.sin(t * PI) * 0.2, -t * 1.75]; });
    return {
      hip: 1.05, scale: [1.12, 1.04], gait: { cad: 0.85, swing: 0.75, bob: 0.16, lean: 0.24, float: 0, sq: 0.1, sway: 0.14 },
      body: [
        cloth(HEAD, R, [0, 1.12, -0.04], [0.94, 0.56, 0.8]), // wrestling trunks
        part(HEAD, SC, [0, 1.58, 0.0], [1.0, 0.88, 0.84]),
        part(HEAD, SC, [0, 2.0, 0.12], [1.18, 0.86, 1.0], [0.35, 0, 0]),
        part(HEAD, SD, [0, 2.08, -0.1], [0.96, 0.8, 0.74], [0.4, 0, 0]), // darker back
        ...both((sx) => [crack([sx * 0.4, 2.36, 0.26], [sx * 0.62, 2.12, 0.34]), crack([sx * 0.46, 1.78, 0.34], [sx * 0.42, 1.5, 0.36])]),
        // pale lava belly with scute ridges
        part(HEAD, BE, [0, 1.72, 0.22], [0.66, 1.02, 0.56], [0.12, 0, 0]),
        ...[0, 1, 2, 3].map((k) => part(TORUS, shade(BE, 0.72), [0, 1.48 + k * 0.17, 0.3 + k * 0.03], [0.48 - Math.abs(k - 1.5) * 0.06, 0.2, 0.3], [PI / 2 + 0.2 + k * 0.05, 0, 0])),
        // championship belt
        metal(CYL, AU, [0, 1.3, 0], [0.98, 0.14, 0.82]),
        metal(SPH, AU, [0, 1.3, 0.4], [0.62, 0.42, 0.16]), metal(SPH, shade(AU, 0.75), [0, 1.3, 0.44], [0.46, 0.3, 0.1]),
        glow(OCT, LAVA, [0, 1.3, 0.5], [0.16, 0.2, 0.08]), ...both((sx) => [metal(SPH, AU, [sx * 0.4, 1.3, 0.3], [0.2, 0.24, 0.1], [0, sx * 0.8, 0])]),
        // neck + head: skull, long tapered snout, open lower jaw with a lava glow, teeth, nostrils, brow ridges, horns
        seg([0, 2.2, 0.2], [0, hy, hz - 0.1], 0.24, SC), part(HEAD, BE, [0, 2.2, 0.48], [0.34, 0.4, 0.3], [0.6, 0, 0]),
        part(HEAD, SC, [0, hy + 0.02, hz], [0.6, 0.52, 0.6]),
        part(HEAD, SC, [0, hy - 0.02, hz + 0.42], [0.44, 0.3, 0.86], [0.06, 0, 0]),
        part(HEAD, SD, [0, hy - 0.26, hz + 0.36], [0.36, 0.14, 0.7], [-0.16, 0, 0]),
        glow(HEAD, hot(gl, 0.5), [0, hy - 0.17, hz + 0.36], [0.32, 0.1, 0.62], [-0.06, 0, 0]),
        ...both((sx) => [0.18, 0.36, 0.52].map((dz) => part(CONE, TP, [sx * (0.15 - dz * 0.1), hy - 0.15, hz + dz + 0.06], [0.05, 0.1, 0.05], [PI, 0, 0]))).flat(),
        ...both((sx) => [glow(SPH, LAVA, [sx * 0.07, hy + 0.06, hz + 0.8], [0.06, 0.04, 0.05]),
          part(HEAD, SC, [sx * 0.16, hy + 0.17, hz + 0.18], [0.2, 0.12, 0.32], [0.2, 0, sx * -0.3]),
          ...chain([[sx * 0.18, hy + 0.2, hz - 0.08], [sx * 0.3, hy + 0.32, hz - 0.3], [sx * 0.34, hy + 0.38, hz - 0.55]], 0.07, 0.035, HN, 'stone'),
          part(CONE, HN, [sx * 0.35, hy + 0.39, hz - 0.62], [0.06, 0.16, 0.06], [-PI / 2 - 0.2, 0, 0], 'stone'),
          part(CONE4, SD, [sx * 0.28, hy - 0.06, hz - 0.12], [0.08, 0.26, 0.06], [-1.2, 0, sx * -0.6])]),
        part(CONE, HN, [0, hy + 0.17, hz + 0.62], [0.09, 0.2, 0.09], [0.35, 0, 0], 'stone'), // nose horn
        // dorsal spines with molten tips
        ...spine.flatMap((p, k) => [part(CONE4, SD, [p[0], p[1] + 0.1, p[2] - 0.1], [0.13, 0.36 - k * 0.03, 0.11], [-0.6 - k * 0.15, 0, 0]),
          glow(CONE4, LAVA, [p[0], p[1] + 0.24, p[2] - 0.2 - k * 0.02], [0.05, 0.12, 0.04], [-0.6 - k * 0.15, 0, 0])]),
      ],
      eyes: { y: hy + 0.08, parts: (vc) => EYES.slit(vc, hz + 0.25, 0.5, { gap: 0.4, w: 0.15, h: 0.11, tilt: 0.3, base: 0xFFD36B }) },
      sh: [0.78, 2.14], hand: [0, -1.04, 0.3],
      arm: () => [ // heavy clawed arm: deltoid, thick forearm, wrist tape + gold band, three claws
        part(HEAD, SC, [0, -0.08, 0], [0.4, 0.4, 0.42]), seg([0, -0.1, 0], [0, -0.5, -0.02], [0.15, 0.17], SC),
        seg([0, -0.5, -0.02], [0, -0.94, 0.12], [0.18, 0.2], SC),
        ...[0, 1].map((k) => part(CONE4, SD, [0, -0.6 - k * 0.18, -0.12], [0.08, 0.22, 0.08], [-1.0, 0, 0])),
        cloth(CYL, TP, [0, -0.9, 0.1], [0.34, 0.12, 0.34]), metal(CYL, AU, [0, -0.83, 0.1], [0.36, 0.04, 0.36]),
        crack([0.15, -0.2, 0.08], [0.17, -0.42, 0.08]),
        part(HEAD, SD, [0, -1.04, 0.12], [0.34, 0.3, 0.36]),
        ...[-1, 0, 1].map((t) => part(CONE, HN, [t * 0.09, -1.12, 0.28], [0.06, 0.18, 0.06], [PI / 2 + 0.3, 0, 0], 'stone')),
      ],
      legX: 0.3,
      leg: () => [part(HEAD, SC, [0, -0.22, 0.08], [0.46, 0.6, 0.5], [0.4, 0, 0]), ...digiLeg(1.05, { r: 0.17, thigh: SC, shin: SC, thighF: 'paint', shinF: 'paint', paw: SD, pawF: 'paint', claw: HN }),
        cloth(HEAD, R, [0, -0.08, 0.04], [0.42, 0.34, 0.44])],
      back: { at: [0, 1.22, -0.36], parts: [
        ...chain(tailPts, 0.34, 0.06, SC),
        ...tailPts.slice(1, 7).flatMap((p, k) => [part(CONE4, SD, [0, p[1] + 0.24 - k * 0.03, p[2]], [0.1, 0.24 - k * 0.025, 0.08], [-0.6, 0, 0]),
          part(HEAD, BE, [0, p[1] - 0.16 + k * 0.018, p[2] + 0.04], [0.32 - k * 0.04, 0.1, 0.24], [0.4, 0, 0])]),
        glow(CONE, LAVA, [0, -0.7, -1.98], [0.16, 0.44, 0.16], [-1.9, 0, 0]), glow(CONE, hot(0xFFD36B, 0.4), [0, -0.68, -1.9], [0.08, 0.26, 0.08], [-1.9, 0, 0]),
      ] },
    };
  },

  // PORCUPINE fencer: round furry body, cream face with a small snout, a crown + back fan of cream-tipped quills,
  // teal sash, fencing breeches, rapier en garde with the off hand raised behind.
  quill(gl) {
    const F = 0x8A5A3C, FD = 0x5E3A26, CR = 0xF3E3C3, QB = 0x3A2618, QT = 0xF6EBD4, TL = 0x1F5B57, LE = 0x3A2618, AU = 0xD9B26A, SW = 0xD8DEE6;
    const quills = [], C = [0, 1.62, -0.02];
    for (let e = 0; e < 6; e++) for (let a = 0; a < 7; a++) { // a quill coat over the back of the round body, swept up + back
      const y = -0.5 + e * 0.22, az = -1.3 + a * 0.43 + (e % 2) * 0.2, c = Math.sqrt(Math.max(0.15, 1 - (y / 0.62) ** 2));
      const b = [C[0] + Math.sin(az) * 0.46 * c, C[1] + y, C[2] - Math.cos(az) * 0.4 * c];
      const nx = Math.sin(az) * c * 1.2, ny = y * 0.7 + 0.45, nz = -Math.cos(az) * c - 0.6, n = Math.hypot(nx, ny, nz), L = 0.85 + ((a * 3 + e) % 4) * 0.09 - Math.abs(az) * 0.1;
      const at = (s) => [b[0] + nx / n * s, b[1] + ny / n * s, b[2] + nz / n * s];
      quills.push(seg(at(-0.05), at(L), 0.055, QB, 'paint', CONE4), seg(at(L * 0.62), at(L + 0.02), 0.032, QT, 'paint', CONE4));
    }
    const hy = 2.22, hz = 0.16;
    return {
      hip: 0.95, scale: [1.0, 1.0], gait: { cad: 1.1, swing: 0.75, bob: 0.06, lean: 0.3, float: 0, sq: 0.04, crouch: 0.06 },
      body: [
        fur(HEAD, F, [0, 1.35, 0], [0.95, 0.95, 0.86]), fur(HEAD, F, [0, 1.85, 0.02], [0.84, 0.72, 0.74]),
        fur(HEAD, CR, [0, 1.48, 0.2], [0.6, 0.78, 0.56]),
        cloth(RBOX, TL, [0, 1.62, 0.36], [0.12, 0.95, 0.06], [0.2, 0, 0.7]), metal(SPH, AU, [0.15, 1.78, 0.38], 0.07),
        rubber(CYL, LE, [0, 1.12, 0], [0.98, 0.1, 0.88]), metal(RBOX, AU, [0, 1.12, 0.44], [0.14, 0.11, 0.04]),
        cloth(HEAD, TL, [0.36, 2.0, -0.02], [0.4, 0.3, 0.6], [0, 0, -0.4]), // little shoulder cape on the off side
        ...quills,
        // head: brown skull, cream face mask, small snout + black nose, round ears, crest quills
        fur(HEAD, F, [0, hy, hz], [0.56, 0.5, 0.56]), fur(HEAD, CR, [0, hy - 0.05, hz + 0.16], [0.42, 0.38, 0.38]),
        fur(HEAD, CR, [0, hy - 0.1, hz + 0.36], [0.24, 0.2, 0.36], [0.15, 0, 0]), rubber(SPH, DARK, [0, hy - 0.08, hz + 0.54], [0.1, 0.08, 0.08]),
        rubber(BOX, shade(CR, 0.5), [0, hy - 0.17, hz + 0.4], [0.08, 0.015, 0.02]),
        ...both((sx) => [fur(SPH, FD, [sx * 0.23, hy + 0.12, hz + 0.0], [0.1, 0.08, 0.06]), fur(SPH, 0xD9A58A, [sx * 0.23, hy + 0.12, hz + 0.03], [0.05, 0.04, 0.03])]),
        ...[-0.14, -0.05, 0.05, 0.14].flatMap((x, k) => [seg([x, hy + 0.16, hz - 0.04], [x * 1.6, hy + 0.5 - Math.abs(x) * 0.6, hz - 0.36], 0.05, QB, 'paint', CONE4),
          seg([x * 1.45, hy + 0.44 - Math.abs(x) * 0.6, hz - 0.3], [x * 1.6, hy + 0.5 - Math.abs(x) * 0.6, hz - 0.36], 0.03, QT, 'paint', CONE4)]),
      ],
      eyes: { y: hy, parts: (vc) => EYES.bead(vc, hz + 0.32, 0.45, { gap: 0.28, w: 0.15, h: 0.16, y: 0.06 }) },
      sh: [0.46, 1.92], hand: [0, -0.86, 0.3],
      arm: (sx) => sx < 0 ? [
        ...arm({ r: 0.11, len: 0.86, up: F, fore: F, sh: F, upF: 'fur', foreF: 'fur', hand: CR, handF: 'cloth' }),
        cloth(CYL, CR, [0, -0.72, 0.07], [0.24, 0.12, 0.24]),
        // rapier: cup guard, quillons, grip, long thin blade
        metal(DOME, AU, [0, -0.86, 0.2], [0.3, 0.14, 0.3], [PI / 2, 0, 0]), metal(BOX, AU, [0, -0.86, 0.22], [0.34, 0.03, 0.03]),
        rubber(CYL, LE, [0, -0.86, 0.08], [0.06, 0.22, 0.06], [PI / 2, 0, 0]), metal(SPH, AU, [0, -0.86, -0.04], 0.07),
        steel(BOX, SW, [0, -0.86, 0.95], [0.035, 0.05, 1.45]), glow(BOX, gl, [0, -0.84, 0.95], [0.015, 0.015, 1.4]),
        steel(CONE4, SW, [0, -0.86, 1.74], [0.04, 0.14, 0.05], [PI / 2, 0, 0]),
      ] : [ // off hand raised up behind in the fencer's guard
        fur(SPH, F, [0, 0, 0], 0.24), seg([0, -0.02, 0], [0, -0.36, -0.12], 0.11, F, 'fur'), fur(SPH, F, [0, -0.38, -0.12], 0.2),
        seg([0, -0.36, -0.14], [0, -0.06, -0.38], 0.1, F, 'fur'), cloth(SOFT, CR, [0, 0.02, -0.42], [0.15, 0.17, 0.15]),
      ],
      legX: 0.22,
      leg: () => [...leg(0.95, { r: 0.13, thigh: CR, shin: F, shinF: 'fur', boot: LE, bootF: 'rubber' }), rubber(CYL, LE, [0, -0.66, 0.02], [0.28, 0.3, 0.28])],
      back: { at: [0, 1.15, -0.4], parts: [fur(HEAD, F, [0, -0.06, -0.12], [0.3, 0.26, 0.34]),
        ...[-1, 0, 1].flatMap((t) => [seg([t * 0.06, -0.04, -0.2], [t * 0.18, 0.06, -0.62], 0.05, QB, 'paint', CONE4), seg([t * 0.14, 0.03, -0.5], [t * 0.18, 0.06, -0.62], 0.03, QT, 'paint', CONE4)])] },
      update(m, t, dt, mv, h) {
        const ball = live(h, 'ball'), k = m._ball = ease(m._ball ?? 0, ball ? 1 : 0, dt, 12);
        m.lean.scale.set(1 + k * 0.15, 1 - k * 0.4, 1 + k * 0.15);
        m.tail.scale.setScalar(1 + k * 0.5);
      },
    };
  },

  // TINY FOXFIRE SPIRIT: a hovering teardrop of blue flame with flickering flame ears, a fox-fire tail and a small knife.
  wisp(gl) {
    const FB = 0x2F8CFF, FD = 0x1F48D8, AU = 0xFFE7A3, NV = 0x0C1A3A, HOT = hot(gl, 0.42), DEEP = hot(FB, 0.36), PALE = hot(0xCFF4FF, 0.42);
    const tongue = (a, b, r, c = FB, f = 'paint') => { // a flame lick: soft ellipsoid base drawn out into a pointed tip
      const m = [a[0] + (b[0] - a[0]) * 0.55, a[1] + (b[1] - a[1]) * 0.55, a[2] + (b[2] - a[2]) * 0.55], e = [b[0] + (b[0] - a[0]) * 0.35, b[1] + (b[1] - a[1]) * 0.35, b[2] + (b[2] - a[2]) * 0.35];
      return [seg(a, b, r, c, f, SPH), seg(m, e, r * 0.62, c, f, CONE)];
    };
    return {
      hip: 1.0, scale: [0.7, 0.7], gait: { cad: 0.5, swing: 0.1, bob: 0.04, lean: 0.45, float: 0.75, sq: 0.03 },
      body: [
        part(SPH, FB, [0, 1.45, 0], [0.95, 0.92, 0.88]), part(CONE, FB, [0, 2.2, -0.1], [0.84, 1.25, 0.78], [-0.2, 0, 0]),
        part(CONE, FD, [0, 2.86, -0.38], [0.28, 0.55, 0.28], [-0.9, 0, 0]),
        ...both((sx) => [part(CONE, FD, [sx * 0.4, 1.95, -0.14], [0.22, 0.6, 0.22], [-0.2, 0, sx * -0.55])]),
        glow(SPH, PALE, [0, 1.46, 0.22], [0.66, 0.6, 0.5]), glow(CONE, HOT, [0, 2.1, 0.0], [0.4, 0.8, 0.3], [-0.15, 0, 0]),
        clear(SPH, 0x8FD0FF, [0, 1.45, 0], [1.12, 1.08, 1.04]), clear(CONE, 0x8FD0FF, [0, 2.28, -0.12], [1.0, 1.45, 0.92], [-0.2, 0, 0]),
        rubber(HALFRING, NV, [0, 1.3, 0.5], [0.14, 0.1, 0.2], [0, 0, PI]), // smile
      ],
      eyes: { y: 1.55, parts: (vc) => both((sx) => [part(SPH, NV, [sx * 0.17, 0, 0.44], [0.17, 0.24, 0.1], [0, 0, sx * 0.2]),
        part(SPH, vc, [sx * 0.17, -0.03, 0.49], [0.1, 0.15, 0.04], [0, 0, sx * 0.2]), part(SPH, 0xFFFFFF, [sx * 0.15, 0.06, 0.51], [0.05, 0.05, 0.02])]) },
      sh: [0.5, 1.5], hand: [0, -0.42, 0.42],
      arm: (sx) => [
        seg([0, 0.02, 0], [0, -0.3, 0.12], 0.11, FB, 'paint', SPH), glow(SPH, HOT, [0, -0.36, 0.14], 0.15),
        ...(sx < 0 ? [metal(BOX, AU, [0, -0.38, 0.2], [0.22, 0.05, 0.05]), rubber(CYL, NV, [0, -0.38, 0.12], [0.06, 0.16, 0.06], [PI / 2, 0, 0]),
          steel(CONE4, 0xD8F2FF, [0, -0.38, 0.44], [0.08, 0.44, 0.12], [PI / 2, 0, 0]), glow(BOX, HOT, [0, -0.36, 0.44], [0.015, 0.015, 0.38])] : []),
      ],
      legX: 0.2, leg: () => [],
      skirt: { at: [0, 1.0, -0.2], parts: [-1, 1].flatMap((k) => tongue([k * 0.22, 0.2, 0], [k * 0.3, -0.05, -0.45], 0.12, FD)) },
      back: { at: [0, 1.3, -0.42], parts: [ // fox tail of flame curling up behind
        seg([0, 0, 0.05], [0, -0.02, -0.5], 0.24, FB, 'paint', SPH), seg([0, -0.02, -0.4], [0, 0.45, -0.78], 0.24, FB, 'paint', SPH),
        ...tongue([0, 0.35, -0.75], [0, 0.85, -0.6], 0.2, FB), ...tongue([0, 0.4, -0.72], [0, 0.78, -0.62], 0.1, HOT, 'glow'),
      ] },
      halo: ring(3, (k, a) => [glow(SPH, k % 2 ? hot(AU, 0.5) : HOT, [Math.cos(a) * 1.1, 1.8 + (k % 2) * 0.35, Math.sin(a) * 1.1], 0.14)]),
      extras: [{ // flicker fox ears
        parent: 'lean', at: [0, 2.05, 0.0],
        parts: both((sx) => [part(CONE, FB, [sx * 0.3, 0.2, 0], [0.3, 0.62, 0.24], [0, 0, sx * -0.4]), glow(CONE, PALE, [sx * 0.28, 0.14, 0.07], [0.14, 0.36, 0.08], [0, 0, sx * -0.4])]),
        anim: (g, t) => { g.scale.set(1, 1 + Math.sin(t * 13) * 0.12 + Math.sin(t * 7.3) * 0.08, 1); g.rotation.z = Math.sin(t * 5) * 0.08; },
      }],
    };
  },

  // ORIGAMI PAPER duelist: faceted folded-paper body with ink creases and crimson edges, a folded diamond head with a
  // crane crest, paper-strip limbs, a long folded paper blade and a crane-wing cape.
  razor(gl) {
    const IV = 0xF4F0E6, IVD = 0xDCD5C6, IVS = 0xC4BCAA, V = 0xD8323C, INK = 0x1C1C22;
    const tri = (c, p, s, r) => part(CONE4, c, p, s, r);
    const crease = (a, b) => seg(a, b, [0.012, 0.012], INK, 'rubber', BOX);
    const edge = (a, b) => seg(a, b, [0.022, 0.012], V, 'paint', BOX);
    const wingPanel = (sx, k) => {
      const a = sx * (0.5 + k * 0.32), L = 1.0 + k * 0.18, cx = sx * (0.15 + k * 0.1) + Math.sin(a) * L * 0.5, cy = -Math.cos(a) * L * 0.5 + 0.2;
      return [part(SHARD, k % 2 ? IVD : IV, [cx, cy, -0.1 - k * 0.04], [0.34, L, 1.2], [0, 0, a]),
        seg([cx + Math.sin(a) * L * 0.2, cy - Math.cos(a) * L * 0.2, -0.13 - k * 0.04], [cx + Math.sin(a) * L * 0.48, cy - Math.cos(a) * L * 0.48, -0.13 - k * 0.04], [0.02, 0.01], V, 'paint', BOX)];
    };
    return {
      hip: 1.32, scale: [0.95, 1.08], gait: { cad: 1.3, swing: 1.1, bob: 0.06, lean: 0.5, float: 0, sq: 0.03 },
      body: [
        tri(IV, [0, 1.36, 0], [0.52, 0.34, 0.34], [0, PI / 4, 0]),
        tri(IV, [0, 1.92, 0], [0.98, 0.98, 0.44], [PI, PI / 4, 0]), tri(IVD, [0, 1.96, -0.05], [0.9, 0.8, 0.38], [PI, PI / 4, 0]),
        part(OCT, IVS, [0, 1.98, 0.14], [0.36, 0.6, 0.16]),
        crease([0, 2.38, 0.18], [0, 1.52, 0.1]), crease([-0.36, 2.36, 0.12], [0, 1.62, 0.15]), crease([0.36, 2.36, 0.12], [0, 1.62, 0.15]),
        edge([-0.52, 2.4, 0.02], [0.52, 2.4, 0.02]), edge([-0.12, 1.45, 0.14], [0.12, 1.45, 0.14]),
        ...both((sx) => [tri(IV, [sx * 0.18, 2.42, 0.1], [0.14, 0.3, 0.1], [0.3, 0, sx * -0.5]), tri(V, [sx * 0.5, 2.42, 0], [0.14, 0.34, 0.24], [0, 0, sx * -1.3])]),
        rubber(CYL, INK, [0, 2.44, 0], [0.08, 0.14, 0.08]),
        // folded diamond head, crane crest folded back over it
        part(OCT, IV, [0, 2.7, 0], [0.38, 0.5, 0.36]), part(OCT, IVD, [0.02, 2.72, -0.03], [0.34, 0.44, 0.34], [0, 0.4, 0]),
        crease([0, 2.95, 0.02], [0, 2.48, 0.17]),
        tri(IV, [0, 2.98, -0.18], [0.12, 0.6, 0.08], [-1.05, 0, 0]), tri(V, [0, 3.05, -0.42], [0.06, 0.24, 0.05], [-0.4, 0, 0]),
        tri(V, [0, 2.6, 0.2], [0.05, 0.14, 0.04], [PI / 2 + 0.2, 0, 0]),
      ],
      eyes: { y: 2.72, parts: (vc) => both((sx) => [part(SHARD, INK, [sx * 0.08, 0, 0.15], [0.13, 0.05, 0.3], [0, 0, sx * 0.3]), part(SHARD, vc, [sx * 0.08, 0, 0.16], [0.09, 0.03, 0.3], [0, 0, sx * 0.3])]) },
      sh: [0.5, 2.3], hand: [0, -0.86, 0.35],
      arm: (sx) => [
        tri(IV, [0, -0.28, 0], [0.3, 0.62, 0.2], [PI, PI / 4, 0]), edge([-0.08, -0.04, 0.06], [0.08, -0.04, 0.06]),
        tri(IVD, [0, -0.66, 0.02], [0.2, 0.44, 0.16], [PI, PI / 4, 0]), part(TETRA, IV, [0, -0.86, 0.05], 0.2),
        ...(sx < 0 ? [ // long folded paper blade with a crimson cutting edge
          rubber(BOX, INK, [0, -0.86, 0.14], [0.06, 0.06, 0.3]), tri(V, [0, -0.86, 0.3], [0.2, 0.06, 0.06], [0, 0, PI / 2]),
          part(SHARD, IV, [0, -0.82, 1.05], [0.16, 1.4, 0.5], [PI / 2, 0, 0]), edge([0, -0.75, 0.35], [0, -0.77, 1.72]),
          glow(BOX, gl, [0, -0.83, 1.05], [0.012, 0.012, 1.2]),
        ] : [ // small folded fan
          part(FAN, IV, [0, -0.9, 0.16], [0.6, 1, 0.6], [PI / 2, 0, PI / 2]), part(FAN, V, [0.01, -0.9, 0.16], [0.3, 1.3, 0.3], [PI / 2, 0, PI / 2]),
          ...[0.5, 1.1, 1.7, 2.3].map((a) => crease([0.025, -0.9, 0.16], [0.025, -0.9 + Math.cos(a) * 0.28, 0.16 + Math.sin(a) * 0.28]))]),
      ],
      legX: 0.17,
      leg: () => [tri(IV, [0, -0.32, 0], [0.3, 0.68, 0.22], [PI, PI / 4, 0]), crease([0, -0.04, 0.09], [0, -0.6, 0.02]),
        tri(IVD, [0, -0.9, 0], [0.2, 0.62, 0.16], [PI, PI / 4, 0]), tri(IV, [0, -1.24, 0.12], [0.16, 0.42, 0.08], [PI / 2, 0, 0]), edge([0, -1.31, -0.05], [0, -1.31, 0.3])],
      skirt: { at: [0, 1.32, 0.04], parts: [ // folded paper hakama panels
        ...both((sx) => [part(SHARD, sx < 0 ? IV : IVD, [sx * 0.2, -0.32, 0.1], [0.42, 0.8, 0.18], [0.1, sx * 0.3, sx * 0.12]), edge([sx * 0.04, -0.02, 0.2], [sx * 0.36, -0.06, 0.12])]),
        part(SHARD, IVD, [0, -0.36, -0.26], [0.6, 0.86, 0.18], [-0.1, 0, 0]), crease([0, -0.05, 0.2], [0, -0.6, 0.18])] },
      back: { at: [0, 2.28, -0.24], parts: both((sx) => [0, 1, 2].flatMap((k) => wingPanel(sx, k))) },
      update(m, t, dt, mv, h) {
        const k = m._fold = ease(m._fold ?? 1, live(h, 'fold') ? 0.14 : 1, dt, 18);
        m.lean.scale.x = k;
      },
    };
  },

  // GOLDEN LIGHT SLIME: a translucent honey-gold wobble blob with brass bells half-sunk into it, a glowing nucleus,
  // a cute face, pseudopod arms (one ringing a handbell) and a floating halo of chimes. No legs: float + squash.
  solace(gl) {
    const SL = 0xFFB020, SLL = 0xFFCB4A, CORE = hot(0xFFE9A0, 0.5), AU = 0xD9AE4E, AUD = 0xA8802E, LV = 0xB9A6FF, BRN = 0x4A3210;
    const bell = (p, s, r = [0, 0, 0]) => [metal(BELL, AU, p, [s, s * 0.9, s], r), metal(DOME, AU, [p[0], p[1] + s * 0.42 * Math.cos(r[0]), p[2] + s * 0.42 * Math.sin(r[0])], [s * 0.46, s * 0.3, s * 0.46], r),
      metal(SPH, AUD, [p[0], p[1] - s * 0.5 * Math.cos(r[0]), p[2] - s * 0.5 * Math.sin(r[0])], s * 0.22), metal(RING, AUD, [p[0], p[1] - s * 0.4 * Math.cos(r[0]), p[2] - s * 0.4 * Math.sin(r[0])], [s * 1.0, s * 1.0, s * 1.6], [PI / 2 + r[0], 0, 0])];
    return {
      hip: 1.0, scale: [1.05, 1.0], gait: { cad: 0.6, swing: 0.15, bob: 0.08, lean: 0.12, float: 0.15, sq: 0.14 },
      body: [
        clear(SPH, SL, [0, 1.12, 0], [1.75, 1.6, 1.62]),
        clear(SPH, SL, [0, 0.52, 0], [2.0, 0.62, 1.86]),
        clear(SPH, SLL, [0, 1.86, -0.04], [0.92, 0.72, 0.88]), clear(SPH, SLL, [0.05, 2.28, -0.08], [0.36, 0.4, 0.36]),
        part(SPH, 0xF2A010, [0, 0.9, -0.1], [1.0, 0.7, 0.9]), glow(SPH, CORE, [0, 1.15, 0], [0.62, 0.62, 0.62]), glow(SPH, hot(gl, 0.6), [0, 1.15, 0], 0.34),
        part(SPH, 0xFFFBEA, [-0.42, 1.72, 0.62], [0.26, 0.16, 0.1], [0.4, 0, 0.5]), part(SPH, 0xFFFBEA, [-0.6, 1.5, 0.66], [0.08, 0.08, 0.05]),
        // bells half-sunk into the jelly (one fully inside, visible through it)
        ...bell([-0.66, 1.22, 0.56], 0.32, [0.5, 0, 0]), ...bell([0.6, 1.78, 0.32], 0.26, [-0.2, 0, 0]),
        ...bell([0.18, 1.3, -0.78], 0.3, [-0.6, 0, 0]), ...bell([0.25, 0.75, 0.25], 0.28),
        // face: smile + lilac cheeks
        rubber(HALFRING, BRN, [0, 1.2, 0.8], [0.2, 0.14, 0.3], [0, 0, PI]),
        ...both((sx) => [part(SPH, LV, [sx * 0.4, 1.26, 0.74], [0.16, 0.08, 0.06], [0, sx * 0.4, 0])]),
      ],
      eyes: { y: 1.46, parts: (vc) => EYES.bead(vc, 0.78, 0.7, { gap: 0.36, w: 0.2, h: 0.26 }) },
      sh: [0.86, 1.3], hand: [0, -0.56, 0.3],
      arm: (sx) => [
        clear(CAP, SL, [0, -0.2, 0.06], [0.3, 0.28, 0.3], [0.2, 0, sx * 0.2]), clear(SPH, SLL, [0, -0.46, 0.12], [0.3, 0.26, 0.3]),
        ...(sx < 0 ? [wood(CYL, 0x7A5030, [0, -0.5, 0.24], [0.07, 0.3, 0.07], [0.3, 0, 0]), ...bell([0, -0.74, 0.3], 0.3), glow(SPH, gl, [0, -0.92, 0.3], 0.1)] : []),
      ],
      legX: 0.3, leg: () => [],
      halo: [
        metal(RING, AU, [0, 2.78, 0], [1.2, 1.2, 0.8], [PI / 2, 0, 0]), glow(RING, hot(gl, 0.5), [0, 2.84, 0], [1.0, 1.0, 0.5], [PI / 2, 0, 0]),
        ...ring(6, (k, a) => [metal(CYL, k % 2 ? AU : tint(AU, 0xffffff, 0.3), [Math.cos(a) * 0.58, 2.62 - (k % 2) * 0.05, Math.sin(a) * 0.58], [0.08, 0.26 + (k % 2) * 0.1, 0.08]),
          glow(SPH, k % 2 ? hot(gl, 0.5) : CORE, [Math.cos(a) * 0.58, 2.44 - (k % 2) * 0.1, Math.sin(a) * 0.58], 0.07)]),
      ],
      update(m, t, dt, mv, h) { // jelly wobble: squash on the beat, stretch while moving, plop on casts
        const c = h?.castT ?? 0, w = Math.sin(t * 3.2) * 0.035 + Math.sin(t * 7.1) * 0.012, k = w + c * 0.12 - mv * 0.04;
        m.lean.scale.set(1 + k, 1 - k * 1.2, 1 + k);
      },
    };
  },

  // BLUE CRAB bombardier: a wide flat carapace, stalk eyes, three jointed walking legs a side, one huge pincer and
  // one brass bubble-cannon arm, with a brass air tank strapped on top.
  brine(gl) {
    const C = 0x2F64A6, CL = 0x4A82C4, CD = 0x1F3B63, CR = 0xF2E6CF, TIP = 0xE8743A, BR = 0xC7A04A, TK = 0x2E8B83;
    return {
      hip: 0.85, scale: [1.05, 1.0], gait: { cad: 1.2, swing: 0.45, bob: 0.08, lean: 0.04, float: 0, sq: 0.06, sway: 0.1 },
      body: [
        part(SPH, CR, [0, 0.92, 0.06], [1.6, 0.52, 1.15]),
        part(SPH, C, [0, 1.18, 0], [2.15, 0.9, 1.55]),
        part(SPH, CL, [0, 1.38, -0.04], [1.6, 0.5, 1.12]),
        ...both((sx) => [0, 1, 2, 3].map((k) => part(CONE4, CD, [sx * (0.62 + k * 0.12), 1.2 - k * 0.02, 0.52 - k * 0.2], [0.09, 0.22, 0.09], [0.4, 0, sx * -1.3]))).flat(),
        ...[-0.2, 0, 0.2].map((x) => part(CONE4, CD, [x, 1.28, 0.74], [0.08, 0.16, 0.08], [1.3, 0, 0])),
        ...both((sx) => [part(RBOX, CR, [sx * 0.1, 1.0, 0.62], [0.14, 0.18, 0.08], [0.2, 0, sx * 0.2])]), // mouth plates
        // stalk eyes
        ...both((sx) => [seg([sx * 0.22, 1.42, 0.5], [sx * 0.3, 1.86, 0.6], 0.06, CD), part(SPH, CD, [sx * 0.3, 1.86, 0.6], 0.16)]),
        // barnacles + brass air tank strapped on the shell
        ...[[-0.55, 1.5, -0.2], [0.62, 1.42, 0.1], [0.3, 1.55, -0.45]].map((p) => part(CONE, CR, p, [0.12, 0.09, 0.12], undefined, 'stone')),
        part(CYL, TK, [0, 1.64, -0.36], [0.36, 0.95, 0.36], [0, 0, PI / 2]), ...both((sx) => [metal(DOME, BR, [sx * 0.48, 1.64, -0.36], [0.36, 0.14, 0.36], [0, 0, sx * -PI / 2]),
          metal(CYL, BR, [sx * 0.24, 1.64, -0.36], [0.4, 0.06, 0.4], [0, 0, PI / 2])]),
        rubber(TORUS, DARK, [-0.5, 1.6, -0.1], [0.4, 0.4, 0.4], [0, 0.5, 0]),
        metal(CYL, BR, [0, 1.84, -0.36], [0.08, 0.14, 0.08]), glow(SPH, gl, [0, 1.93, -0.36], 0.06),
      ],
      eyes: { y: 1.98, parts: (vc) => both((sx) => [part(SPH, 0xF4F0E6, [sx * 0.3, 0, 0.62], 0.24), part(SPH, vc, [sx * 0.3, 0, 0.72], [0.14, 0.14, 0.06]),
        part(SPH, PUPIL, [sx * 0.3, 0, 0.745], [0.07, 0.1, 0.03]), part(SPH, 0xFFFFFF, [sx * 0.27, 0.04, 0.755], 0.035)]) },
      sh: [0.95, 1.2], hand: [-0.22, -0.32, 1.62],
      arm: (sx) => {
        const P = [seg([0, 0, 0], [sx * 0.25, -0.22, 0.32], 0.13, C), part(SPH, CD, [sx * 0.25, -0.22, 0.32], 0.28),
          seg([sx * 0.25, -0.22, 0.32], [sx * 0.2, -0.3, 0.72], 0.14, C), part(CONE4, CD, [sx * 0.32, -0.16, 0.5], [0.07, 0.16, 0.07], [0, 0, -sx])];
        if (sx > 0) P.push( // the huge pincer
          part(SPH, C, [0.24, -0.2, 1.1], [0.9, 0.78, 1.05]), part(SPH, CL, [0.34, -0.02, 1.06], [0.56, 0.4, 0.75]),
          part(CONE, C, [0.14, -0.44, 1.82], [0.34, 0.9, 0.3], [PI / 2 + 0.12, 0, 0]), part(CONE, TIP, [0.14, -0.52, 2.22], [0.14, 0.26, 0.14], [PI / 2 + 0.12, 0, 0]),
          part(CONE, C, [0.32, 0.02, 1.74], [0.3, 0.8, 0.28], [PI / 2 - 0.35, 0, 0]), part(CONE, TIP, [0.32, 0.14, 2.1], [0.13, 0.24, 0.13], [PI / 2 - 0.35, 0, 0]),
          ...[0, 1, 2].map((k) => part(CONE4, CR, [0.14, -0.36, 1.6 + k * 0.14], [0.06, 0.1, 0.06])),
        );
        else P.push( // brass bubble cannon with a glass bubble chamber
          part(SPH, C, [-0.2, -0.3, 0.76], 0.32),
          metal(CYL, BR, [-0.2, -0.3, 1.14], [0.3, 0.7, 0.3], [PI / 2, 0, 0]), metal(BELL, BR, [-0.2, -0.3, 1.5], [0.56, 0.24, 0.56], [-PI / 2, 0, 0]),
          ...[0.95, 1.3].map((z) => metal(TORUS, shade(BR, 0.8), [-0.2, -0.3, z], [0.34, 0.34, 0.34])),
          glow(CYL, gl, [-0.2, -0.3, 1.6], [0.26, 0.02, 0.26], [PI / 2, 0, 0]),
          clear(SPH, 0xCFFFF4, [-0.2, 0.02, 1.0], 0.42), ...[[-0.25, 0.0, 1.0, 0.12], [-0.12, 0.1, 0.92, 0.08], [-0.2, -0.06, 1.12, 0.06]].map(([x, y, z, s]) => glow(SPH, gl, [x, y, z], s)),
          metal(CYL, BR, [-0.2, -0.18, 1.0], [0.18, 0.08, 0.18]),
        );
        return P;
      },
      legX: 0.46,
      leg: (sx) => [0.38, 0, -0.38].flatMap((zk) => {
        const a = [sx * 0.05, 0.12, zk * 0.6], b = [sx * 0.6, 0.32, zk * 1.05], c = [sx * 0.76, -0.8, zk * 1.25];
        return [seg(a, b, 0.085, C), part(SPH, CD, b, 0.15), seg(b, c, 0.07, C), part(CONE, TIP, [c[0], c[1] + 0.04, c[2]], [0.1, 0.16, 0.1], [PI, 0, 0])];
      }),
    };
  },

  // ELF MARKSMAN: tall slim elf, real face with pointed ears and a copper braid, scope monocle, hood down over the
  // shoulders, leather jerkin, a long cloak, heavy arbalest and a fold-out tripod.
  longshot(gl) {
    const OL = 0x3E4B40, OD = 0x2C352D, CU = 0xC57A3A, TN = 0x8C6E4A, LE = 0x4A3424, ST = 0x6E7681, HR = 0xA8482A;
    const hip = 1.42, th = 0.92, tw = 0.64, td = 0.42, top = hip + th, hs = 0.4, hy = top + 0.3, hz = 0.03;
    const tripod = ring(3, (k, a) => [metal(CYL, ST, [Math.cos(a) * 0.5, 0.68, Math.sin(a) * 0.5], [0.07, 1.5, 0.07], [Math.sin(a) * 0.36, 0, -Math.cos(a) * 0.36]), metal(SPH, CU, [Math.cos(a) * 0.95, 0.05, Math.sin(a) * 0.95], 0.1)]);
    return {
      hip, scale: [0.9, 1.08], gait: { cad: 0.8, swing: 1.05, bob: 0.06, lean: 0.2, float: 0, sq: 0.03 },
      body: [
        cloth(CYL, OD, [0, hip + 0.04, 0], [tw * 0.6, 0.26, td * 0.8]),
        ...torso({ hip, th, tw, td, c: TN, waist: 0.74 }),
        cloth(RBOX, shade(TN, 0.8), [0, hip + th * 0.5, td * 0.42], [0.05, th * 0.7, 0.04]),
        ...[0, 1, 2, 3].map((k) => metal(SPH, CU, [0.06, hip + 0.3 + k * 0.15, td * 0.45], 0.03)),
        rubber(CYL, LE, [0, hip + 0.12, 0], [tw * 0.7, 0.08, td * 0.86]), metal(RBOX, CU, [0, hip + 0.12, td * 0.43], [0.1, 0.08, 0.04]),
        rubber(RBOX, LE, [0, hip + th * 0.55, td * 0.48], [0.07, th * 1.0, 0.04], [0, 0, 0.6]),
        ...[0, 1, 2].map((k) => glow(BOX, gl, [-0.14 + k * 0.1, hip + th * 0.38 + k * 0.14, td * 0.52], [0.02, 0.16, 0.02], [0, 0, 0.6])), // bolts in the bandolier
        metal(CYL, CU, [0.26, hip + 0.1, 0.12], [0.08, 0.36, 0.08], [0, 0, 0.3]), metal(CYL, ST, [0.3, hip - 0.06, 0.12], [0.06, 0.12, 0.06], [0, 0, 0.3]), // spyglass on the belt
        // hood down + cloak over the shoulders
        cloth(TORUS, OL, [0, top - 0.02, -0.06], [0.62, 0.56, 0.7], [PI / 2 + 0.2, 0, 0]),
        cloth(HEAD, OL, [0, top - 0.06, -0.24], [0.5, 0.36, 0.3], [0.3, 0, 0]),
        ...both((sx) => [cloth(HEAD, OL, [sx * tw * 0.4, top - 0.1, -0.02], [0.36, 0.22, td * 1.05], [0, 0, sx * -0.35])]),
        skin(CYL, SKIN.fair, [0, top + 0.08, hz], [0.14, 0.2, 0.14]),
        ...face({ y: hy, z: hz, s: hs, skin: SKIN.fair, ears: 'elf', nose: 'long', hair: 'braid', hairC: HR, brow: 0x7A3420, browTilt: -0.18 }),
        metal(RING, CU, [-hs * 0.19, hy + hs * 0.02, hz + hs * 0.47], [0.11, 0.11, 0.2]), metal(BOX, CU, [-hs * 0.36, hy + hs * 0.06, hz + hs * 0.32], [0.02, 0.02, 0.2], [0, 0.5, 0]),
      ],
      eyes: { y: hy, parts: (vc) => [...EYES.human(vc, hz + hs * 0.43, hs, { tilt: -0.1 }), part(SPH, tint(gl, 0x223344, 0.4), [-hs * 0.19, hs * 0.02, hz + hs * 0.47], [0.08, 0.08, 0.01])] },
      sh: [0.42, top - 0.1], hand: [0, -1.0, 0.6],
      arm: (sx) => [
        ...arm({ r: 0.095, len: 1.0, up: TN, fore: LE, sh: OL, hand: LE, upF: 'cloth', foreF: 'rubber', handF: 'rubber' }),
        metal(CYL, CU, [0, -0.62, 0.05], [0.22, 0.05, 0.22]),
        ...(sx < 0 ? [ // heavy arbalest: walnut stock, steel prod, cranequin, glowing string + bolt
          wood(RBOX, 0x6A4A30, [0, -0.96, 0.45], [0.12, 0.14, 0.95]), steel(BOX, ST, [0, -0.9, 1.05], [0.06, 0.06, 1.2]),
          ...both((s) => [steel(CYL, ST, [s * 0.4, -0.9, 1.5], [0.05, 0.85, 0.05], [0, -s * 0.25, s * (PI / 2 - 0.25)])]),
          metal(TORUS, CU, [0, -0.9, 1.6], [0.12, 0.12, 0.12], [0, PI / 2, 0]),
          glow(BOX, gl, [0, -0.88, 1.38], [1.5, 0.015, 0.015]), glow(BOX, gl, [0, -0.86, 1.2], [0.02, 0.02, 0.7]), glow(CONE4, gl, [0, -0.86, 1.62], [0.05, 0.16, 0.05], [PI / 2, 0, 0]),
          metal(CYL, CU, [0.1, -0.96, 0.3], [0.04, 0.2, 0.04], [0, 0, PI / 2]), metal(SPH, CU, [0.2, -0.96, 0.3], 0.05)] : []),
      ],
      legX: 0.16,
      leg: () => [...leg(hip, { r: 0.11, thigh: OD, shin: OD, boot: LE, bootF: 'rubber' }), rubber(CYL, LE, [0, -hip + 0.42, 0.02], [0.27, 0.4, 0.27]), rubber(CYL, shade(LE, 1.3), [0, -hip + 0.64, 0.02], [0.3, 0.06, 0.3])],
      skirt: { at: [0, hip + 0.02, 0.1], parts: both((sx) => [cloth(RBOX, TN, [sx * 0.15, -0.2, 0.08], [0.2, 0.36, 0.035], [0.1, 0, sx * 0.1])]) },
      back: { at: [0, top - 0.12, -0.3], parts: [cloth(RBOX, OL, [0, -0.85, -0.04], [0.82, 1.7, 0.04], [0.08, 0, 0]),
        cloth(RBOX, OD, [0, -1.66, -0.11], [0.84, 0.1, 0.05], [0.08, 0, 0]), metal(OCT, CU, [0, -0.2, 0.0], 0.08),
        rubber(CYL, LE, [0.22, -0.6, -0.12], [0.18, 0.7, 0.18], [0, 0, 0.25]), ...[-0.04, 0.04].map((x) => glow(CONE4, gl, [0.12 + x, -0.18, -0.12], [0.05, 0.14, 0.05], [0, 0, 0.25]))] },
      extras: [{ parent: 'rig', at: [0, 0, 0], parts: tripod, anim: (g, t, dt, mv, h) => { const k = g.userData.k = ease(g.userData.k ?? 0, live(h, 'perch') ? 1 : 0, dt, 12); g.visible = k > 0.02; g.scale.set(1, Math.max(0.01, k), 1); } }],
    };
  },

  // AURORA SPIRIT: a slender body of teal/violet northern-light ribbons, a pale ice face with an ice-crystal tiara,
  // glowing hair and a ribbon cape that stream far past her feet, and a bow made of ice and light. She floats.
  aurora(gl) {
    const TEc = 0x3FE0C0, TE = hot(0x3FE0C0, 0.32), TD = hot(0x1E9A8E, 0.45), VI = hot(0xB87BFF, 0.32), VD = hot(0x7A4AD8, 0.45), ICE = 0xCFF6FF, SK = 0xCFEFF0, HR = hot(0xA8FFE6, 0.3);
    const hip = 1.45, th = 0.82, tw = 0.56, td = 0.36, top = hip + th, hs = 0.38, hy = top + 0.28, hz = 0.02;
    return {
      hip, scale: [0.95, 1.04], style: 'float', gait: { cad: 1.0, swing: 0.2, bob: 0.06, lean: 0.25, float: 0.32, sq: 0.03 },
      body: [
        ...see(torso({ hip, th, tw, td, c: TEc, f: 'glass', waist: 0.62 })),
        glow(CAP, hot(gl, 0.4), [0, hip + th * 0.5, 0], [0.26, 0.4, 0.2]),
        ...[0, 1, 2, 3].map((k) => glow(TORUS, k % 2 ? VI : TE, [0, hip + 0.1 + k * 0.2, 0], [tw * (0.95 + (k === 3 ? 0.25 : 0)), tw * 0.9, 0.06], [PI / 2 + (k % 2 ? 0.35 : -0.35), 0, 0])),
        skin(CYL, SK, [0, top + 0.06, hz], [0.13, 0.2, 0.13]),
        glow(TORUS, ICE, [0, top + 0.0, hz], [0.32, 0.3, 0.16], [PI / 2, 0, 0]),
        ...face({ y: hy, z: hz, s: hs, skin: SK, ears: 'none', nose: 'button', brow: 0x8FDCD0, browTilt: 0.05 }),
        // glowing hair cap + ice tiara
        part(HEAD, 0x7FE8D0, [0, hy + hs * 0.14, hz - hs * 0.08], [hs * 0.98, hs * 0.86, hs * 0.98], undefined, 'fur'),
        part(SOFT, 0x7FE8D0, [0, hy + hs * 0.33, hz + hs * 0.26], [hs * 0.78, hs * 0.18, hs * 0.32], [-0.45, 0, 0], 'fur'),
        ...[-2, -1, 0, 1, 2].map((k) => glass(CONE4, ICE, [k * hs * 0.17, hy + hs * (0.6 - Math.abs(k) * 0.06), hz + hs * 0.1 - Math.abs(k) * 0.03], [hs * 0.12, hs * (0.6 - Math.abs(k) * 0.12), hs * 0.12], [0, 0, -k * 0.22])),
      ],
      eyes: { y: hy, parts: (vc) => EYES.glow(vc, hz + hs * 0.45, hs, { gap: 0.19, w: 0.2, h: 0.11, tilt: -0.12 }) },
      sh: [0.36, top - 0.08], hand: [0, -1.0, 0.35],
      arm: (sx) => [
        ...arm({ r: 0.07, len: 0.98, up: SK, fore: SK, sh: TE, hand: SK, upF: 'skin', foreF: 'skin', shF: 'glow' }),
        glow(TORUS, sx < 0 ? TE : VI, [0, -0.78, 0.06], [0.2, 0.2, 0.3], [PI / 2, 0, 0]),
        ...ribbon([[0, -0.8, 0.0], [sx * 0.08, -1.0, -0.22], [sx * 0.04, -1.25, -0.4]], 0.05, sx < 0 ? TE : VI),
        ...(sx < 0 ? [ // a bow of ice and light
          ...both((sy) => see(chain([[0, -1.0 + sy * 0.08, 0.3], [0, -1.0 + sy * 0.45, 0.42], [0, -1.0 + sy * 0.8, 0.34], [0, -1.0 + sy * 0.96, 0.44]], 0.05, 0.03, ICE, 'glass'))),
          ...both((sy) => chain([[0, -1.0 + sy * 0.08, 0.3], [0, -1.0 + sy * 0.45, 0.42], [0, -1.0 + sy * 0.8, 0.34]], 0.02, 0.014, gl, 'glow')),
          ...both((sy) => [glass(CONE4, ICE, [0, -1.0 + sy * 1.0, 0.45], [0.06, 0.16, 0.06], [sy < 0 ? PI : 0, 0, 0])]),
          glow(BOX, ICE, [0, -1.0, 0.22], [0.012, 1.9, 0.012]),
          glow(BOX, gl, [0, -1.0, 0.52], [0.02, 0.02, 0.7]), glow(CONE4, ICE, [0, -1.0, 0.92], [0.06, 0.16, 0.06], [PI / 2, 0, 0]),
          ...both((s) => [glow(LEAF, VI, [s * 0.04, -1.0, 0.2], [0.06, 0.16, 0.4], [PI / 2, 0, s * 0.5])])] : []),
      ],
      legX: 0.16, leg: () => [],
      // the lower body dissolves into long light ribbons
      skirt: { at: [0, hip, 0], parts: [
        ...see([part(BELL, TEc, [0, -0.38, 0], [0.62, 0.8, 0.5])]),
        ...[-2, -1, 0, 1, 2].flatMap((k) => ribbon([[k * 0.1, 0, 0.12], [k * 0.14, -0.45, 0.14], [k * 0.1, -0.9, 0.04], [k * 0.05, -1.25, -0.12]], 0.07, k % 2 ? VI : TE)),
        ...[-1, 0, 1].flatMap((k) => ribbon([[k * 0.14, 0, -0.12], [k * 0.18, -0.5, -0.2], [k * 0.12, -1.0, -0.3]], 0.08, k ? VD : TD)),
      ] },
      back: { at: [0, top - 0.04, -0.22], parts: [ // ribbon cape: longer than the body, trailing behind
        ...[-2, -1, 0, 1, 2].flatMap((k) => ribbon([[k * 0.12, 0, 0], [k * 0.2, -0.6, -0.3], [k * 0.24, -1.3, -0.7], [k * 0.2, -1.9, -1.2], [k * 0.14, -2.3, -1.8]], 0.1, k % 2 ? VI : TE)),
        ...see([-1, 1].flatMap((k) => ribbon([[k * 0.2, -0.1, -0.05], [k * 0.36, -0.8, -0.4], [k * 0.4, -1.6, -0.95], [k * 0.3, -2.1, -1.6]], 0.16, k < 0 ? 0x9A6AF0 : 0x2AB8A8, 'glass'))),
      ] },
      extras: [{ // long streaming hair
        parent: 'lean', at: [0, hy + 0.05, hz - hs * 0.35],
        parts: [-1, 0, 1].flatMap((k) => ribbon([[k * 0.1, 0, 0], [k * 0.14, -0.3, -0.25], [k * 0.12, -0.9, -0.5], [k * 0.1, -1.6, -0.8], [k * 0.06, -2.3, -1.15]], 0.09, k ? HR : hot(0xD8FFF4, 0.36))),
        anim: (g, t, dt, mv) => { g.rotation.x = 0.1 + Math.sin(t * 2.2) * 0.08 + mv * 0.4; g.rotation.z = Math.sin(t * 1.3) * 0.05; },
      }],
    };
  },

  // LOTUS DANCER plant-folk: vine-slim green body, pale leaf-green face with violet petal markings, a lotus-bud topknot
  // and petal fringe, petal bodice, en-pointe feet, a petal chakram and a dancer's ribbon, plus the spinning lotus tutu.
  petal(gl) {
    const J = 0x2D6B66, JL = 0x4F9A72, SKN = 0xCFE8C4, LI = 0xF4E6FF, PK = 0xFFB8DA, VI = 0xC58CFF, VD = 0x8A54D0, AU = 0xFFF0A8, PAD = 0x3E9A5A;
    const hip = 1.36, th = 0.78, tw = 0.48, td = 0.32, top = hip + th, hs = 0.36, hy = top + 0.27, hz = 0.02;
    const tutu = [
      cloth(CYL, PAD, [0, -0.02, 0], [1.3, 0.04, 1.3]), cloth(CYL, shade(PAD, 0.8), [0, -0.05, 0], [1.34, 0.02, 1.34]),
      ...ring(10, (k, a) => [part(CONE, k % 2 ? LI : PK, [Math.cos(a) * 0.5, 0.2, Math.sin(a) * 0.5], [0.32, 0.62, 0.07], [0, PI / 2 - a, -0.6])]),
      ...ring(10, (k, a) => [part(CONE, k % 2 ? 0xFFFFFF : LI, [Math.cos(a + 0.31) * 0.64, 0.08, Math.sin(a + 0.31) * 0.64], [0.3, 0.52, 0.07], [0, PI / 2 - a - 0.31, -0.95])]),
      ...ring(8, (k, a) => [part(CONE, k % 2 ? VI : PK, [Math.cos(a + 0.4) * 0.32, 0.3, Math.sin(a + 0.4) * 0.32], [0.26, 0.54, 0.07], [0, PI / 2 - a - 0.4, -0.3])]),
      glow(RING, AU, [0, 0.12, 0], [0.5, 0.5, 0.8], [PI / 2, 0, 0]),
    ];
    return {
      hip, scale: [0.92, 1.06], gait: { cad: 1.2, swing: 0.8, bob: 0.14, lean: 0.12, float: 0, sq: 0.06, sway: 0.1 },
      body: [
        ...torso({ hip, th, tw, td, c: J, f: 'skin', waist: 0.58, chest: 0.9 }),
        ...[0, 1, 2].map((k) => cloth(TORUS, JL, [0, hip + 0.12 + k * 0.12, 0], [tw * 0.6, tw * 0.6, 0.12], [PI / 2 + (k % 2 ? 0.25 : -0.25), 0, 0])), // vine wraps
        ...ring(7, (k, a) => [part(CONE, k % 2 ? LI : PK, [Math.sin(a) * 0.2, top - 0.24, Math.cos(a) * 0.15 + 0.02], [0.18, 0.42, 0.06], [-0.25 * Math.cos(a), a, 0])]), // petal bodice
        glow(OCT, AU, [0, top - 0.2, td * 0.52], 0.07),
        skin(CYL, SKN, [0, top + 0.06, hz], [0.11, 0.2, 0.11]),
        ...face({ y: hy, z: hz, s: hs, skin: SKN, ears: 'none', nose: 'button', brow: VD, browTilt: 0.06, jaw: 0.92 }),
        // flower-face markings: petal marks on the cheeks, a glowing petal on the brow
        ...both((sx) => [part(LEAF, VI, [sx * hs * 0.27, hy - hs * 0.08, hz + hs * 0.36], [hs * 0.08, hs * 0.18, 0.3], [0, sx * 0.6, sx * 0.5])]),
        glow(LEAF, gl, [0, hy + hs * 0.3, hz + hs * 0.43], [hs * 0.08, hs * 0.18, 0.3], [-0.3, 0, 0]),
        // petal hair: fringe + side petals + a tall lotus-bud topknot
        part(HEAD, VD, [0, hy + hs * 0.14, hz - hs * 0.07], [hs * 0.98, hs * 0.86, hs * 0.98]),
        ...[-2, -1, 0, 1, 2].map((k) => part(LEAF, k % 2 ? VI : LI, [k * hs * 0.15, hy + hs * 0.36, hz + hs * 0.26], [hs * 0.22, hs * 0.38, 0.5], [-1.0, 0, -k * 0.3])),
        ...both((sx) => [part(LEAF, PK, [sx * hs * 0.44, hy - hs * 0.15, hz - hs * 0.05], [hs * 0.24, hs * 0.75, 0.6], [0, sx * 1.4, sx * 0.15]), part(LEAF, LI, [sx * hs * 0.4, hy - hs * 0.32, hz - hs * 0.2], [hs * 0.2, hs * 0.6, 0.6], [0.2, sx * 1.3, sx * 0.25])]),
        ...ring(6, (k, a) => [part(LEAF, k % 2 ? PK : LI, [Math.cos(a) * 0.09, hy + hs * 0.82, hz - hs * 0.12 + Math.sin(a) * 0.09], [0.16, 0.42, 0.6], [Math.sin(a) * 0.35, PI / 2 - a, -Math.cos(a) * 0.0])]),
        part(CONE, VI, [0, hy + hs * 0.9, hz - hs * 0.12], [0.14, 0.3, 0.14]), glow(SPH, AU, [0, hy + hs * 0.62, hz - hs * 0.12], 0.07),
      ],
      eyes: { y: hy, parts: (vc) => EYES.human(vc, hz + hs * 0.43, hs, { tilt: 0.1, h: 0.14 }) },
      sh: [0.32, top - 0.1], hand: [0, -0.95, 0.3],
      arm: (sx) => [
        ...arm({ r: 0.07, len: 0.95, up: J, fore: J, sh: J, hand: SKN, upF: 'skin', foreF: 'skin' }),
        part(LEAF, JL, [sx * 0.07, -0.02, 0], [0.12, 0.22, 0.5], [0, 0, sx * -0.9]),
        ...chain([[0, -0.5, 0.05], [sx * 0.08, -0.6, 0.08], [0, -0.7, 0.1], [sx * -0.06, -0.62, 0.12]], 0.02, 0.014, JL),
        ...(sx < 0 ? [ // petal chakram
          ...ring(8, (k, a) => [part(LEAF, k % 2 ? VI : LI, [0, -0.95 + Math.cos(a) * 0.26, 0.22 + Math.sin(a) * 0.26], [0.04, 0.26, 0.8], [a, 0, 0])]),
          glow(TORUS, gl, [0, -0.95, 0.22], [0.36, 0.36, 0.3], [0, PI / 2, 0]), glow(SPH, AU, [0, -0.95, 0.22], 0.08)]
          : ribbon([[0, -0.95, 0.06], [0.1, -1.15, -0.2], [0.02, -1.25, -0.55], [0.12, -1.0, -0.85], [0.06, -0.75, -1.05]], 0.05, VI, 'cloth')), // dancer's ribbon
      ],
      legX: 0.13,
      leg: () => [...leg(hip, { r: 0.075, thigh: J, shin: J, thighF: 'skin', shinF: 'skin', boot: null }),
        part(CONE, PK, [0, -hip + 0.1, 0.02], [0.13, 0.24, 0.15], [PI, 0, 0]), ...[0.22, 0.32].map((y) => cloth(TORUS, VI, [0, -hip + y, 0], [0.13, 0.13, 0.13], [PI / 2, 0, 0]))],
      back: { at: [0, hip + 0.1, -0.16], parts: both((sx) => ribbon([[sx * 0.06, 0, 0], [sx * 0.14, -0.4, -0.18], [sx * 0.12, -0.8, -0.3]], 0.06, sx < 0 ? VI : PK, 'cloth')) },
      extras: [{
        parent: 'lean', at: [0, hip + 0.06, 0], parts: tutu,
        anim: (g, t, dt, mv, h) => { g.rotation.y += dt * (0.5 + mv * 2 + (live(h, 'waltz') ? 5 : 0)); const s = 1 + mv * 0.12 + Math.sin(t * 3) * 0.02; g.scale.set(s, 1, s); },
      }],
    };
  },

  // HUMAN LIGHTHOUSE KEEPER: weathered face with a grey moustache, a lighthouse cap (striped tower crown with a lit
  // lantern) on his hair, yellow raincoat, wellies, a big handheld signal lamp and a little lighthouse backpack.
  beacon(gl) {
    const YE = 0xF2C230, YD = 0xC9971E, NV = 0x2A3550, BT = 0x243244, RD = 0xC8323A, WH = 0xF2F2EE, BR = 0xC9A24B, LAMP = 0xFFF8D6, SKC = 0xE6B794;
    const hip = 1.26, th = 0.98, tw = 0.86, td = 0.56, top = hip + th, hs = 0.42, hy = top + 0.3, hz = 0.04, hb = hy + hs * 0.38;
    const tower = (y0, s) => [ // tapered striped tower with a lantern room and dome
      part(SKIRT, WH, [0, y0 + s * 0.5, 0], [s * 0.9, s, s * 0.9]), part(SKIRT, RD, [0, y0 + s * 0.5, 0], [s * 0.82, s * 0.24, s * 0.82]),
      part(CYL, RD, [0, y0 + s * 0.05, 0], [s * 0.94, s * 0.1, s * 0.94]),
      steel(CYL, 0x2A2F38, [0, y0 + s * 1.02, 0], [s * 0.74, s * 0.06, s * 0.74]),
      glass(CYL, LAMP, [0, y0 + s * 1.2, 0], [s * 0.42, s * 0.34, s * 0.42]), glow(SPH, gl, [0, y0 + s * 1.2, 0], s * 0.3),
      part(DOME, RD, [0, y0 + s * 1.37, 0], [s * 0.52, s * 0.3, s * 0.52]), metal(SPH, BR, [0, y0 + s * 1.53, 0], s * 0.08)];
    return {
      hip, scale: [1.04, 1.0], gait: { cad: 0.8, swing: 0.6, bob: 0.08, lean: 0.1, float: 0, sq: 0.05 },
      body: [
        cloth(CYL, NV, [0, hip + 0.04, 0], [tw * 0.64, 0.26, td * 0.8]),
        ...torso({ hip, th, tw, td, c: YE, f: 'rubber', waist: 0.88 }),
        rubber(RBOX, YD, [0, hip + th * 0.5, td * 0.47], [0.05, th * 0.85, 0.04]),
        ...[0, 1, 2].map((k) => wood(CAP, 0x6A4A30, [0.08, hip + 0.3 + k * 0.2, td * 0.5], [0.04, 0.05, 0.04], [0, 0, PI / 2])),
        ...both((sx) => [rubber(RBOX, YD, [sx * tw * 0.28, hip + 0.3, td * 0.44], [0.2, 0.16, 0.05], [0, sx * 0.3, 0])]), // pockets
        rubber(TORUS, YD, [0, top + 0.0, hz - 0.02], [0.46, 0.42, 0.7], [PI / 2 - 0.15, 0, 0]), // upturned collar
        cloth(CYL, 0x2E3E5A, [0, top + 0.04, hz], [0.3, 0.12, 0.3]), // turtleneck
        // rope coil at the belt
        part(TORUS, 0xC9B48A, [-tw * 0.4, hip + 0.18, 0.12], [0.3, 0.3, 0.4], [0, PI / 2 - 0.4, 0], 'cloth'),
        skin(CYL, SKC, [0, top + 0.1, hz], [0.17, 0.18, 0.17]),
        ...face({ y: hy, z: hz, s: hs, skin: SKC, ears: 'round', nose: 'round', hair: 'short', hairC: HAIR.silver, beard: 'moustache', beardC: HAIR.silver, brow: 0xB8BEC8, browTilt: 0.1 }),
        ...beard('stubble', hy, hz, hs, 0xC8CCD2),
        // lighthouse cap sitting on the hair: red band, visor, striped crown, lit lantern
        cloth(CYL, RD, [0, hb, hz - 0.01], [hs * 1.04, hs * 0.18, hs * 1.04]),
        cloth(FAN, NV, [0, hb - 0.04, hz + hs * 0.3], [hs * 0.86, 1, hs * 0.7], [0.15, -PI / 2, 0]),
        part(SKIRT, WH, [0, hb + hs * 0.24, hz - 0.01], [hs * 1.0, hs * 0.34, hs * 1.0]), part(CYL, RD, [0, hb + hs * 0.26, hz - 0.01], [hs * 0.84, hs * 0.1, hs * 0.84]),
        steel(CYL, 0x2A2F38, [0, hb + hs * 0.42, hz - 0.01], [hs * 0.74, hs * 0.04, hs * 0.74]),
        glass(CYL, LAMP, [0, hb + hs * 0.52, hz - 0.01], [hs * 0.34, hs * 0.18, hs * 0.34]), glow(SPH, hot(gl, 0.6), [0, hb + hs * 0.52, hz - 0.01], hs * 0.2),
        part(DOME, RD, [0, hb + hs * 0.6, hz - 0.01], [hs * 0.42, hs * 0.2, hs * 0.42]), metal(SPH, BR, [0, hb + hs * 0.7, hz - 0.01], hs * 0.07),
        // backpack straps
        ...both((sx) => [rubber(RBOX, 0x5A3E2A, [sx * tw * 0.26, top - 0.3, td * 0.36], [0.07, 0.6, 0.04], [0.15, 0, 0])]),
      ],
      eyes: { y: hy, parts: (vc) => EYES.human(vc, hz + hs * 0.43, hs, { h: 0.12 }) },
      sh: [0.56, top - 0.1], hand: [0, -1.06, 0.8],
      arm: (sx) => [
        ...arm({ r: 0.12, len: 1.04, up: YE, fore: YE, sh: YE, hand: NV, upF: 'rubber', foreF: 'rubber', handF: 'rubber' }),
        rubber(CYL, YD, [0, -0.86, 0.07], [0.3, 0.14, 0.3]),
        ...(sx < 0 ? [ // big handheld signal lamp: brass barrel, glowing lens, carry handle
          metal(CYL, BR, [0, -1.0, 0.42], [0.42, 0.5, 0.42], [PI / 2, 0, 0]), metal(TORUS, shade(BR, 0.8), [0, -1.0, 0.68], [0.44, 0.44, 0.5]),
          glass(CYL, LAMP, [0, -1.0, 0.7], [0.36, 0.04, 0.36], [PI / 2, 0, 0]), glow(SPH, hot(gl, 0.7), [0, -1.0, 0.66], [0.3, 0.3, 0.1]),
          metal(HALFRING, BR, [0, -0.86, 0.38], [0.5, 0.5, 0.5], [0, PI / 2, 0]), rubber(CYL, DARK, [0, -1.0, 0.15], [0.3, 0.08, 0.3], [PI / 2, 0, 0])] : []),
      ],
      legX: 0.2,
      leg: () => [...leg(hip, { r: 0.13, thigh: NV, shin: NV, boot: BT, bootF: 'rubber' }), rubber(CYL, BT, [0, -hip + 0.34, 0.02], [0.32, 0.42, 0.32]), rubber(CYL, YD, [0, -hip + 0.56, 0.02], [0.34, 0.05, 0.34])],
      skirt: { at: [0, hip + 0.1, 0], parts: [rubber(BELL, YE, [0, -0.3, -0.02], [tw * 1.5, 0.62, td * 1.75]), rubber(BOX, YD, [0, -0.28, td * 0.66], [0.04, 0.5, 0.05])] },
      back: { at: [0, top - 0.75, -td * 0.62], parts: [...tower(0, 0.62), rubber(RBOX, 0x5A3E2A, [0, 0.3, 0.2], [0.5, 0.5, 0.12])] },
      extras: [{ // the pack lantern's rotating beams
        parent: 'lean', at: [0, top - 0.75 + 0.62 * 1.2, -td * 0.62],
        parts: [clear(CONE, 0xFFE9A0, [0.5, 0, 0], [0.3, 0.8, 0.3], [0, 0, PI / 2], 'glow'), clear(CONE, 0xFFE9A0, [-0.5, 0, 0], [0.3, 0.8, 0.3], [0, 0, -PI / 2], 'glow')],
        anim: (g, t, dt) => { g.rotation.y += dt * 1.8; },
      }],
    };
  },
};

// Assemble a body description into the rig hero.js drives.
export function buildWave2A(spec, def, team = 0) {
  const gl = new THREE.Color(def.basic?.color ?? def.accent).lerp(new THREE.Color(0xffffff), 0.1).getHex();
  const B = BUILD[def.id](gl);
  const mat = toonMat({ vertexColors: true, finish: true, rim: 0.3 }), clr = clearMat();
  const mesh = (parts, k = 0.03) => meshParts(parts, mat, clr, k); // v7.3: `clear` parts render see-through
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
  const m = { root, lean, eyes, tail, legs, arms, skirt, hand, orb, halo, style: B.style ?? spec.style ?? 'base', gait: B.gait, mats: [mat, clr] };
  // Per-frame hook (hero.js render): live parts follow the hero's state.
  m.update = (t, dt, mv, h) => {
    for (const x of extras) x.anim?.(x.g, t, dt, mv, h, m);
    B.update?.(m, t, dt, mv, h);
  };
  m.update(0, 0, 0, null); // rest pose for portraits / lineups (hidden tripod, unsquashed bodies)
  return m;
}
