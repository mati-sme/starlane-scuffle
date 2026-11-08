// v7.3 bodies for the original Light + Dark champions (forms.js assembles them; see the build-context notes there).
// Each one is its own body plan: real faces for the humans and elves, no shared armor kit.
import * as THREE from 'three';
import {
  PI, BOX, RBOX, SOFT, TAPER, VEE, BELL, CYL, CYL6, CONE, CONE4, CONE6, OCT, ICO1, DODE, SPH, HEAD, DOME, CAP, RING, TORUS, HALFRING, LEAF, SHARD,
  DARK, BRASS, GOLD, WOOD, STEEL, SKIN, HAIR, shade, tint, part, metal, steel, cloth, glow, rubber, stone, glass, skin, fur, wood, clear,
  both, ring, seg, chain, arm, face, torso, EYES, scaleAbout, WHEEL,
} from './anatomy.js';

// ── local helpers ──
const _q = new THREE.Quaternion(), _qa = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), PI / 2), _e = new THREE.Euler();
const _Y = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3();
// A run of interlocking chain links from a to b (alternating 90° about the run direction).
function links(a, b, r, c, f = 'steel') {
  _d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const L = _d.length(), n = Math.max(2, Math.round(L / (r * 1.25)));
  _q.setFromUnitVectors(_Y, _d.normalize());
  _e.setFromQuaternion(_q); const eA = [_e.x, _e.y, _e.z];
  _e.setFromQuaternion(_q.multiply(_qa)); const eB = [_e.x, _e.y, _e.z];
  return Array.from({ length: n }, (_, k) => {
    const u = (k + 0.5) / n;
    return part(TORUS, c, [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u], [r, r * 1.45, r * 1.1], k % 2 ? eB : eA, f);
  });
}
// Cone spikes radiating from a ball (flail heads, spiked pauldrons).
const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], [1, 1, 1], [-1, 1, 1], [1, -1, 1], [-1, -1, 1], [1, 1, -1], [-1, 1, -1], [1, -1, -1], [-1, -1, -1]].map((v) => { const l = Math.hypot(...v); return v.map((x) => x / l); });
const spikes = (o, R, len, rad, c, dirs = DIRS) => dirs.map((d) => seg([o[0] + d[0] * R * 0.7, o[1] + d[1] * R * 0.7, o[2] + d[2] * R * 0.7], [o[0] + d[0] * (R + len), o[1] + d[1] * (R + len), o[2] + d[2] * (R + len)], rad, c, 'steel', CONE));
// A flat crescent blade in the arm's yz plane, starting at `base` and arcing forward over the top (sickles, scythes).
const crescent = (base, R, w, c, f, x = base[0]) => [...Array.from({ length: 8 }, (_, k) => {
  const a = PI * (0.97 - k * 0.12), cz = base[2] + R, L = R * 0.62;
  return part(LEAF, c, [x, base[1] + Math.sin(a) * R, cz + Math.cos(a) * R], [w * (1 - k * 0.1), L, 0.5], [PI - a, PI / 2, 0], f);
}), part(SHARD, c, [x, base[1] + Math.sin(PI * 0.06) * R - R * 0.12, base[2] + R + Math.cos(PI * 0.06) * R], [w * 0.3, R * 0.5, 1], [PI * 0.94 + 0.3, PI / 2, 0], f)];
const lerp3 = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];

export const FORMS_A = {
  // HUMAN rail-ranger: weathered face, brim hat on short hair, long duster with a shoulder capelet, rust scarf, rail rifle.
  kade: {
    plan: { hip: 1.34, tw: 0.8, th: 1.02, td: 0.5, hs: 0.44, neck: 0.1, ax: 0.55, legX: 0.17 },
    gait: { cad: 1.05, swing: 0.95, bob: 0.08, lean: 0.3, float: 0, sq: 0.04 },
    build(c) {
      const { hip, tw, th, td, top, hy, hz, hs, main, acc, gl } = c, mid = hip + th * 0.5;
      const coat = shade(main, 0.78), coatD = shade(main, 0.6), shirt = shade(acc, 0.9), scarf = 0xB5432E, hat = 0x5A4030, pants = 0x3B3A36, boot = 0x4A3022, glove = 0x3A2A20;
      const hb = hy + hs * 0.36; // hat brim height (sits on the hair)
      return {
        body: [
          cloth(CYL, pants, [0, hip + 0.04, 0], [tw * 0.64, 0.26, td * 0.8]),
          ...torso({ hip, th, tw, td, c: coat, waist: 0.8 }), // duster
          cloth(RBOX, shirt, [0, mid + 0.08, td * 0.42], [tw * 0.3, th * 0.74, 0.08]), // shirt between the open lapels
          ...both((sx) => [cloth(RBOX, coatD, [sx * tw * 0.19, mid + 0.22, td * 0.46], [tw * 0.13, th * 0.5, 0.05], [0.04, sx * 0.25, sx * -0.18])]), // lapels
          ...[0, 1, 2].map((k) => metal(SPH, BRASS, [0, hip + 0.38 + k * 0.17, td * 0.47], 0.04)),
          rubber(CYL, 0x3A2618, [0, hip + 0.14, 0], [tw * 0.7, 0.09, td * 0.86]), metal(RBOX, BRASS, [0, hip + 0.14, td * 0.43], [0.14, 0.1, 0.04]), // gun belt
          rubber(RBOX, 0x3A2618, [0, mid + 0.12, td * 0.5], [0.08, th * 0.95, 0.04], [0, 0, 0.62]), // cell bandolier
          ...[0, 1, 2, 3].map((k) => glow(CYL, gl, [-0.2 + k * 0.13, mid - 0.12 + k * 0.19, td * 0.53], [0.06, 0.09, 0.06], [0, 0, 0.62])),
          ...both((sx) => [cloth(HEAD, coatD, [sx * tw * 0.36, top - 0.1, -0.02], [0.42, 0.24, td * 1.02], [0, 0, sx * -0.35])]), // shoulder capes
          skin(CYL, SKIN.tan, [0, top + 0.06, hz], [0.17, 0.2, 0.17]),
          cloth(TORUS, scarf, [0, top + 0.05, hz], [0.36, 0.36, 0.5], [PI / 2, 0, 0]), // scarf
          ...face({ y: hy, z: hz, s: hs, skin: SKIN.tan, ears: 'round', nose: 'long', hair: 'short', hairC: HAIR.brown, beard: 'stubble', beardC: 0x6A4A36, brow: 0x3A2A20 }),
          // brim hat: pinched crown, band, wide brim tipped forward
          cloth(CYL, hat, [0, hb, hz], [hs * 2.3, 0.04, hs * 2.3], [0.1, 0, 0]),
          cloth(CYL, hat, [0, hb + hs * 0.2, hz - 0.01], [hs * 1.02, hs * 0.42, hs * 1.0], [0.1, 0, 0]),
          cloth(DOME, hat, [0, hb + hs * 0.4, hz - 0.02], [hs * 1.0, hs * 0.24, hs * 0.9], [0.1, 0, 0]),
          cloth(CYL, 0x2A1E16, [0, hb + hs * 0.06, hz], [hs * 1.05, hs * 0.1, hs * 1.03], [0.1, 0, 0]), glow(OCT, gl, [hs * 0.36, hb + hs * 0.07, hz + hs * 0.34], 0.05),
        ],
        eyes: (vc) => EYES.human(vc, hz + hs * 0.43, hs, { tilt: -0.08 }),
        arms: [
          [...arm({ r: 0.11, up: coat, fore: coat, hand: glove, sh: coat, foreF: 'cloth', handF: 'rubber' }), cloth(CYL, coatD, [0, -0.88, 0.07], [0.26, 0.12, 0.26]),
            // rail rifle: walnut stock, steel receiver, twin rails with a glowing channel, scope, coil muzzle
            wood(RBOX, WOOD, [0, -1.02, 0.12], [0.11, 0.22, 0.5], [0.15, 0, 0]), steel(RBOX, 0x4A505A, [0, -1.0, 0.62], [0.14, 0.18, 0.62]),
            ...both((sx) => [steel(BOX, 0x9AA2AE, [sx * 0.045, -0.96, 1.32], [0.035, 0.06, 1.1])]), glow(BOX, gl, [0, -0.96, 1.32], [0.02, 0.03, 1.05]),
            steel(CYL, 0x2A2E36, [0, -0.86, 0.66], [0.07, 0.5, 0.07], [PI / 2, 0, 0]), glass(CYL, tint(gl, 0x223344, 0.5), [0, -0.86, 0.92], [0.06, 0.02, 0.06], [PI / 2, 0, 0]),
            ...[1.62, 1.74, 1.86].map((z) => metal(RING, BRASS, [0, -0.96, z], [0.2, 0.2, 0.5])), glow(CYL, gl, [0, -0.96, 1.9], [0.07, 0.02, 0.07], [PI / 2, 0, 0])],
          [...arm({ r: 0.11, up: coat, fore: coat, hand: glove, sh: coat, foreF: 'cloth', handF: 'rubber' }), cloth(CYL, coatD, [0, -0.88, 0.07], [0.26, 0.12, 0.26])],
        ],
        leg: { r: 0.12, thigh: pants, shin: pants, boot, bootF: 'rubber' },
        legExtra: (H) => [rubber(CYL, boot, [0, -H + 0.34, 0.02], [0.3, 0.16, 0.3]), metal(TORUS, BRASS, [0, -H + 0.12, -0.16], [0.1, 0.1, 0.1], [0, PI / 2, 0])],
        skirt: [...both((sx) => [cloth(RBOX, coat, [sx * 0.22, -0.46, -0.06], [0.24, 0.9, 0.035], [0.05, sx * 0.2, sx * 0.08])]),
          ...both((sx) => [cloth(RBOX, shade(coat, 0.92), [sx * 0.17, -0.5, -td - 0.02], [0.3, 1.0, 0.035], [-0.12, 0, sx * 0.06])])], // split duster tails
        tailAt: [0.08, top + 0.04, hz - 0.16],
        tail: chain([[0, 0, 0], [0.05, -0.2, -0.12], [0.12, -0.45, -0.18], [0.16, -0.68, -0.14]], 0.07, 0.05, scarf, 'cloth'), // scarf tail streaming behind
      };
    },
  },

  // HUMAN knight: open great-helm (raised visor, cheek guards) framing a bearded face, plate over a heraldic surcoat,
  // big bronze-rimmed tower shield on the bash arm, flanged mace in the off hand. Broad tank silhouette.
  bulwark: {
    plan: { hip: 1.28, tw: 1.0, th: 1.1, td: 0.66, hs: 0.4, neck: 0.1, ax: 0.74, legX: 0.24, scale: [1.12, 1.0] },
    gait: { cad: 0.75, swing: 0.62, bob: 0.16, lean: 0.12, float: 0, sq: 0.12 },
    build(c) {
      const { hip, tw, th, td, top, hy, hz, hs, main, acc, gl: gl0 } = c, gl = shade(gl0, 0.2), mid = hip + th * 0.5;
      const plate = tint(main, 0xC9D2DE, 0.35), plateD = shade(plate, 0.78), mail = 0x7C828C, coat = 0x24366A, coatD = shade(coat, 0.75), bronze = tint(acc, 0xE0A850, 0.3);
      const hb = hy + hs * 0.28;
      return {
        body: [
          steel(CYL, plateD, [0, hip + 0.06, 0], [tw * 0.7, 0.3, td * 0.84]), // faulds
          ...torso({ hip, th, tw, td, c: plate, f: 'steel', waist: 0.8, chest: 1.04 }),
          cloth(RBOX, coat, [0, mid + 0.02, td * 0.5], [tw * 0.5, th * 0.86, 0.05]), // surcoat front
          cloth(RBOX, coat, [0, mid + 0.02, -td * 0.5], [tw * 0.62, th * 0.9, 0.05]),
          ...both((sx) => [metal(BOX, bronze, [sx * tw * 0.25, mid + 0.02, td * 0.53], [0.035, th * 0.84, 0.02])]), // gold edging
          metal(CYL, bronze, [0, mid + 0.14, td * 0.54], [0.18, 0.04, 0.18], [PI / 2, 0, 0]), ...ring(8, (k, a) => [metal(SHARD, bronze, [Math.cos(a) * 0.15, mid + 0.14 + Math.sin(a) * 0.15, td * 0.54], [0.07, 0.16, 0.3], [0, 0, a - PI / 2])]), // sun crest
          rubber(CYL, 0x4A3222, [0, hip + 0.2, 0], [tw * 0.78, 0.1, td * 0.92]), metal(RBOX, bronze, [0, hip + 0.2, td * 0.46], [0.16, 0.12, 0.04]),
          steel(CYL, plate, [0, top + 0.02, hz], [0.42, 0.2, 0.4]), steel(TORUS, plateD, [0, top - 0.04, hz], [0.44, 0.44, 0.5], [PI / 2, 0, 0]), // gorget
          ...face({ y: hy, z: hz, s: hs, skin: SKIN.rose, ears: 'none', nose: 'round', jaw: 1.15, hair: 'buzz', hairC: HAIR.auburn, beard: 'full', beardC: HAIR.auburn, brow: HAIR.auburn, browTilt: 0.14 }),
          // open great-helm: crown, brow band, back shell, cheek guards, raised visor and a short plume
          steel(DOME, plate, [0, hb, hz - 0.01], [hs * 1.12, hs * 0.66, hs * 1.12]),
          steel(CYL, plateD, [0, hb, hz - 0.01], [hs * 1.14, hs * 0.16, hs * 1.14]),
          steel(HEAD, plate, [0, hy - hs * 0.05, hz - hs * 0.2], [hs * 1.08, hs * 1.0, hs * 0.86]),
          ...both((sx) => [steel(RBOX, plate, [sx * hs * 0.48, hy - hs * 0.14, hz + hs * 0.1], [hs * 0.12, hs * 0.72, hs * 0.6], [0, sx * 0.25, 0]),
            ...[0, 1].map((k) => metal(SPH, bronze, [sx * hs * 0.55, hy + hs * (0.05 - k * 0.3), hz + hs * 0.2], hs * 0.07))]),
          steel(HEAD, plate, [0, hb + hs * 0.3, hz + hs * 0.26], [hs * 1.0, hs * 0.16, hs * 0.56], [-0.75, 0, 0]), // visor flipped up
          ...[-1, 0, 1].map((k) => rubber(BOX, DARK, [k * hs * 0.22, hb + hs * 0.36, hz + hs * 0.32], [hs * 0.12, hs * 0.03, hs * 0.3], [-0.75, 0, 0])),
          metal(RBOX, bronze, [0, hb + hs * 0.34, hz], [hs * 0.08, hs * 0.18, hs * 1.0]), // crest ridge
          ...[0, 1, 2, 3, 4].map((k) => fur(LEAF, k % 2 ? 0x9A2A26 : 0xC23A30, [0, hb + hs * (0.5 - k * 0.04), hz + hs * (0.2 - k * 0.24)], [hs * 0.14, hs * (0.7 + k * 0.08), 0.6], [-0.5 - k * 0.32, 0, 0])), // horsehair plume
        ],
        eyes: (vc) => EYES.human(vc, hz + hs * 0.43, hs, { tilt: -0.06, h: 0.12 }),
        arms: [
          [...arm({ r: 0.14, up: mail, fore: plate, hand: plateD, sh: plate, upF: 'steel', foreF: 'steel', handF: 'steel' }), steel(CYL, plate, [0, -0.78, 0.06], [0.34, 0.36, 0.34]),
            steel(DOME, plate, [-0.04, 0.04, 0], [0.56, 0.42, 0.56], [0, 0, 0.45]), steel(DOME, plateD, [-0.12, -0.12, 0], [0.5, 0.3, 0.52], [0, 0, 0.6]),
            metal(TORUS, bronze, [-0.04, 0.04, 0], [0.28, 0.28, 0.3], [PI / 2, 0, 0.45]),
            // tower shield strapped to the forearm: steel rim, heraldic field, bronze boss, glowing sun bar
            steel(RBOX, plateD, [-0.06, -0.74, 0.34], [0.8, 1.46, 0.08], [0.06, -0.25, 0]),
            cloth(RBOX, coat, [-0.05, -0.74, 0.38], [0.68, 1.32, 0.06], [0.06, -0.25, 0]),
            ...[-0.34, 0.3].map((y) => metal(BOX, bronze, [-0.04, -0.74 + y, 0.42], [0.7, 0.05, 0.03], [0.06, -0.25, 0])),
            metal(DOME, bronze, [-0.02, -0.72, 0.42], [0.3, 0.24, 0.3], [PI / 2 + 0.06, -0.25, 0]),
            glow(BOX, gl, [-0.03, -0.74, 0.43], [0.05, 1.18, 0.03], [0.06, -0.25, 0]),
            metal(CONE4, bronze, [-0.08, -1.52, 0.31], [0.4, 0.22, 0.08], [PI + 0.06, -0.25, 0])],
          [...arm({ r: 0.14, up: mail, fore: plate, hand: plateD, sh: plate, upF: 'steel', foreF: 'steel', handF: 'steel' }), steel(CYL, plate, [0, -0.78, 0.06], [0.34, 0.36, 0.34]),
            steel(DOME, plate, [0.04, 0.04, 0], [0.56, 0.42, 0.56], [0, 0, -0.45]), steel(DOME, plateD, [0.12, -0.12, 0], [0.5, 0.3, 0.52], [0, 0, -0.6]),
            metal(TORUS, bronze, [0.04, 0.04, 0], [0.28, 0.28, 0.3], [PI / 2, 0, -0.45]),
            // flanged mace held forward
            wood(CYL, WOOD, [0, -1.02, 0.3], [0.07, 0.7, 0.07], [PI / 2 - 0.5, 0, 0]),
            steel(DODE, plate, [0, -0.82, 0.64], 0.24), ...spikes([0, -0.82, 0.64], 0.1, 0.08, 0.04, plateD, DIRS.slice(0, 6)),
            metal(TORUS, bronze, [0, -0.9, 0.5], [0.08, 0.08, 0.1], [PI / 2 - 0.5, 0, 0])],
        ],
        handAt: [-0.04, -0.74, 0.5],
        leg: { r: 0.15, thigh: mail, shin: plate, thighF: 'steel', shinF: 'steel', knee: plate, kneeF: 'steel', boot: plateD, bootF: 'steel' },
        legExtra: (H) => [steel(DOME, plate, [0, -H * 0.5, 0.1], [0.3, 0.24, 0.24], [PI / 2, 0, 0]), steel(RBOX, plate, [0, -H * 0.76, 0.1], [0.28, 0.46, 0.12]),
          steel(RBOX, plateD, [0, -H + 0.1, 0.18], [0.34, 0.16, 0.5])],
        skirt: [cloth(RBOX, coat, [0, -0.42, 0.04], [tw * 0.46, 0.86, 0.05]), metal(BOX, bronze, [0, -0.82, 0.07], [tw * 0.46, 0.06, 0.03]),
          glow(OCT, gl, [0, -0.36, 0.08], [0.14, 0.2, 0.04]),
          ...both((sx) => [steel(RBOX, plateD, [sx * 0.34, -0.14, -0.08], [0.3, 0.34, 0.05], [0, sx * 0.3, sx * 0.12])])],
        tailAt: [0, hip + 0.06, -td * 0.46],
        tail: [cloth(RBOX, coat, [0, -0.44, -0.02], [tw * 0.56, 0.9, 0.04], [0.06, 0, 0]), metal(BOX, bronze, [0, -0.86, -0.05], [tw * 0.56, 0.05, 0.03], [0.06, 0, 0])],
      };
    },
  },

  // ELF paladin: slender, pointed ears, silver hair under a winged open helm, cream-and-gold ceremonial plate with a blue
  // tabard, long blue banner cloak, couched glowing lance with a vamplate and pennant.
  corsa: {
    plan: { hip: 1.42, tw: 0.76, th: 1.04, td: 0.5, hs: 0.4, neck: 0.14, ax: 0.54, legX: 0.17 },
    gait: { cad: 1.0, swing: 0.9, bob: 0.1, lean: 0.3, float: 0, sq: 0.05 },
    build(c) {
      const { hip, tw, th, td, top, hy, hz, hs, main, acc, gl: gl0 } = c, gl = shade(gl0, 0.2), mid = hip + th * 0.5;
      const plate = tint(main, 0xFFF6DE, 0.25), plateD = shade(plate, 0.82), blue = acc, blueD = shade(acc, 0.7), gold = GOLD, under = 0x2A2F44;
      const hb = hy + hs * 0.34;
      return {
        body: [
          cloth(CYL, under, [0, hip + 0.06, 0], [tw * 0.62, 0.26, td * 0.8]),
          ...torso({ hip, th, tw, td, c: plate, f: 'metal', waist: 0.68, chest: 0.98 }),
          cloth(RBOX, blue, [0, mid - 0.02, td * 0.48], [tw * 0.34, th * 0.84, 0.04]), // tabard
          glow(OCT, gl, [0, mid + 0.2, td * 0.52], [0.16, 0.26, 0.05]), metal(RING, gold, [0, mid + 0.2, td * 0.52], [0.26, 0.3, 0.5]),
          metal(CYL, gold, [0, hip + 0.18, 0], [tw * 0.66, 0.07, td * 0.88]),
          metal(TORUS, gold, [0, top - 0.02, hz], [0.36, 0.36, 0.4], [PI / 2, 0, 0]),
          skin(CYL, SKIN.fair, [0, top + 0.06, hz], [0.15, 0.2, 0.15]),
          ...both((sx) => [metal(SPH, gold, [sx * tw * 0.32, top - 0.04, -td * 0.44], 0.1)]), // cloak clasps
          ...face({ y: hy, z: hz, s: hs, skin: SKIN.fair, ears: 'elf', nose: 'button', jaw: 0.88, hair: 'long', hairC: HAIR.silver, brow: 0xA8AEBE, browTilt: -0.05 }),
          // open winged helm sitting on the hair: low crown, gold band, swept feather wings, tall crest
          metal(DOME, plate, [0, hb, hz - 0.03], [hs * 1.04, hs * 0.5, hs * 1.04]),
          metal(CYL, gold, [0, hb, hz - 0.03], [hs * 1.06, hs * 0.12, hs * 1.06]),
          glow(OCT, gl, [0, hb + hs * 0.02, hz + hs * 0.52], [0.07, 0.1, 0.04]),
          ...both((sx) => [0, 1, 2].map((k) => metal(LEAF, k % 2 ? gold : plate, [sx * hs * (0.5 + k * 0.05), hb + hs * (0.12 + k * 0.1), hz - hs * (0.12 + k * 0.08)], [hs * 0.16, hs * (0.62 - k * 0.1), 0.5], [-0.7, sx * 0.3, sx * (-0.5 - k * 0.12)])).flat()),
          ...[0, 1, 2].map((k) => cloth(LEAF, k % 2 ? blueD : blue, [0, hb + hs * (0.36 + k * 0.05), hz - hs * (0.05 + k * 0.22)], [hs * 0.1, hs * (0.8 - k * 0.12), 0.6], [-0.4 - k * 0.3, 0, 0])),
        ],
        eyes: (vc) => EYES.human(vc, hz + hs * 0.43, hs, { tilt: 0.06, h: 0.12 }),
        arms: [
          [...arm({ r: 0.1, up: blue, fore: plate, hand: plateD, sh: plate, foreF: 'metal', handF: 'metal' }),
            metal(DOME, plate, [-0.03, 0.04, 0], [0.4, 0.3, 0.42], [0, 0, 0.4]), metal(TORUS, gold, [-0.03, 0.02, 0], [0.22, 0.22, 0.3], [PI / 2, 0, 0.4]),
            metal(CYL, gold, [0, -0.86, 0.07], [0.24, 0.06, 0.24]),
            // couched lance: grip, vamplate funnel, long tapered shaft, glowing spearhead and a blue pennant
            wood(CYL, 0x5A4A6A, [0, -1.04, 0.02], [0.08, 0.6, 0.08], [PI / 2, 0, 0]),
            metal(CONE, plate, [0, -1.04, 0.42], [0.36, 0.34, 0.36], [PI / 2, 0, 0]), metal(TORUS, gold, [0, -1.04, 0.26], [0.18, 0.18, 0.2]),
            metal(CONE, plate, [0, -1.04, 1.32], [0.16, 1.6, 0.16], [PI / 2, 0, 0]),
            ...[0.8, 1.2].map((z) => metal(TORUS, gold, [0, -1.04, z], [0.11 - (z - 0.8) * 0.06, 0.11 - (z - 0.8) * 0.06, 0.2])),
            glow(CONE4, gl, [0, -1.04, 2.22], [0.12, 0.36, 0.12], [PI / 2, 0, 0]), glow(BOX, gl, [0, -1.04, 1.3], [0.02, 0.02, 1.2]),
            ...both((sx) => [cloth(LEAF, sx < 0 ? blue : blueD, [sx * 0.04, -1.24, 1.88], [0.1, 0.4, 0.3], [0.3, 0, sx * 0.15])]), metal(TORUS, gold, [0, -1.04, 1.9], [0.08, 0.08, 0.12])],
          [...arm({ r: 0.1, up: blue, fore: plate, hand: plateD, sh: plate, foreF: 'metal', handF: 'metal' }),
            metal(DOME, plate, [0.03, 0.04, 0], [0.4, 0.3, 0.42], [0, 0, -0.4]), metal(TORUS, gold, [0.03, 0.02, 0], [0.22, 0.22, 0.3], [PI / 2, 0, -0.4]),
            metal(CYL, gold, [0, -0.86, 0.07], [0.24, 0.06, 0.24])],
        ],
        handAt: [0, -1.04, 2.2],
        leg: { r: 0.115, thigh: under, shin: plate, shinF: 'metal', knee: gold, kneeF: 'metal', boot: plate, bootF: 'metal' },
        legExtra: (H) => [metal(CONE4, plate, [0, -H + 0.1, 0.3], [0.14, 0.2, 0.1], [PI / 2, 0, 0])],
        skirt: [cloth(RBOX, blue, [0, -0.4, 0.03], [tw * 0.3, 0.8, 0.04]), metal(BOX, gold, [0, -0.78, 0.05], [tw * 0.3, 0.05, 0.03]),
          ...both((sx) => [metal(RBOX, plate, [sx * 0.26, -0.14, -0.06], [0.24, 0.3, 0.05], [0, sx * 0.3, sx * 0.1])])],
        tailAt: [0, top - 0.04, -td * 0.5],
        tail: [cloth(RBOX, blue, [0, -0.78, -0.12], [tw * 0.92, 1.56, 0.04], [0.14, 0, 0]),
          cloth(RBOX, blueD, [0, -0.78, -0.1], [tw * 0.86, 1.5, 0.03], [0.14, 0, 0]),
          metal(BOX, gold, [0, -1.54, -0.24], [tw * 0.92, 0.06, 0.05], [0.14, 0, 0]),
          glow(OCT, gl, [0, -0.6, -0.17], [0.2, 0.3, 0.04], [0.14, 0, 0])],
      };
    },
  },

  // ELF assassin: lean crouched elf, swept black hair with a pink streak, wrapped dark gi and sash, half cape over one
  // shoulder, two katanas (forward + reverse grip) with crossed saya on the back, streaming scarf.
  glint: {
    plan: { hip: 1.36, tw: 0.68, th: 0.96, td: 0.44, hs: 0.39, neck: 0.13, hunch: 0.12, ax: 0.5, legX: 0.16 },
    gait: { cad: 1.35, swing: 1.2, bob: 0.08, lean: 0.5, float: 0, sq: 0.04, crouch: 0.06 },
    build(c) {
      const { hip, tw, th, td, top, hy, hz, hs, main, acc, gl: gl0 } = c, gl = shade(gl0, 0.2), mid = hip + th * 0.5;
      const suit = tint(main, 0x4A3A5E, 0.55), wrap = 0x9A92B0, pink = acc, glove = 0x22202A, steelC = 0xDDE3EC;
      const katana = (z0, z1, y0, y1) => [
        rubber(CYL, glove, lerp3([0, y0, z0], [0, y1, z1], -0.05), [0.06, 0.3, 0.06], [PI / 2 - Math.atan2(y1 - y0, z1 - z0), 0, 0]),
        metal(CYL, GOLD, lerp3([0, y0, z0], [0, y1, z1], 0.06), [0.16, 0.03, 0.16], [PI / 2 - Math.atan2(y1 - y0, z1 - z0), 0, 0]),
        seg(lerp3([0, y0, z0], [0, y1, z1], 0.08), [0, y1, z1], [0.014, 0.04], steelC, 'steel', BOX),
        seg(lerp3([0, y0, z0], [0, y1, z1], 0.1), lerp3([0, y0, z0], [0, y1, z1], 0.98), [0.008, 0.012], gl, 'glow', BOX),
      ];
      return {
        body: [
          cloth(CYL, suit, [0, hip + 0.04, 0], [tw * 0.62, 0.24, td * 0.8]),
          ...torso({ hip, th, tw, td, c: suit, waist: 0.66, chest: 0.94 }),
          ...both((sx) => [cloth(RBOX, wrap, [sx * 0.07, mid + 0.14, td * 0.46], [0.12, th * 0.86, 0.04], [0, 0, sx * 0.5])]), // crossed wrap
          cloth(CYL, pink, [0, hip + 0.16, 0], [tw * 0.68, 0.12, td * 0.86]), cloth(SOFT, pink, [tw * 0.3, hip + 0.16, td * 0.22], [0.14, 0.14, 0.12]), // sash + knot
          ...[0, 1].map((k) => cloth(RBOX, shade(pink, 0.85 - k * 0.1), [tw * 0.32 + k * 0.05, hip - 0.12, td * 0.24], [0.08, 0.5, 0.025], [0, 0, 0.1 + k * 0.15])),
          cloth(HEAD, shade(suit, 0.8), [tw * 0.38, top - 0.08, -0.04], [0.46, 0.3, td * 1.15], [0, 0, -0.4]), // half cape on the off shoulder
          cloth(TORUS, shade(suit, 0.75), [0, top + 0.04, hz], [0.32, 0.32, 0.5], [PI / 2, 0, 0]),
          skin(CYL, SKIN.olive, [0, top + 0.07, hz], [0.14, 0.18, 0.14]),
          ...both((sx) => [rubber(RBOX, 0x1A1A24, [sx * 0.15, mid + 0.18, -td * 0.56], [0.08, 1.2, 0.06], [0.1, 0, sx * 0.55]), cloth(CYL, pink, [sx * 0.15 - sx * 0.2, mid + 0.18 + 0.3, -td * 0.58], [0.1, 0.06, 0.1], [0.1, 0, sx * 0.55])]), // crossed saya
          ...face({ y: hy, z: hz, s: hs, skin: SKIN.olive, ears: 'elf', nose: 'button', jaw: 0.86, hair: 'swept', hairC: HAIR.black, brow: HAIR.black, browTilt: 0.22 }),
          cloth(SOFT, pink, [hs * 0.14, hy + hs * 0.4, hz + hs * 0.22], [hs * 0.14, hs * 0.16, hs * 0.34], [-0.5, 0, 0.25]), // pink streak
        ],
        eyes: (vc) => EYES.human(vc, hz + hs * 0.43, hs, { tilt: 0.14, h: 0.11 }),
        arms: [
          [...arm({ r: 0.092, up: suit, fore: wrap, hand: glove, sh: suit, foreF: 'cloth', handF: 'rubber' }), ...[0, 1, 2].map((k) => cloth(CYL, shade(wrap, 0.85), [0, -0.66 - k * 0.1, 0.06], [0.21, 0.04, 0.21])),
            ...katana(0.02, 1.2, -1.06, -0.5)],
          [...arm({ r: 0.092, up: suit, fore: wrap, hand: glove, sh: suit, foreF: 'cloth', handF: 'rubber' }), ...[0, 1, 2].map((k) => cloth(CYL, shade(wrap, 0.85), [0, -0.66 - k * 0.1, 0.06], [0.21, 0.04, 0.21])),
            ...katana(0.18, -0.95, -1.08, -0.82)],
        ],
        handAt: [0, -0.65, 0.85],
        leg: { r: 0.1, thigh: suit, shin: wrap, boot: glove, bootF: 'rubber' },
        legExtra: (H) => [0, 1, 2, 3].map((k) => cloth(CYL, shade(wrap, 0.8), [0, -H * 0.62 - k * 0.1, 0.02], [0.22, 0.04, 0.22])),
        skirt: both((sx) => [cloth(RBOX, suit, [sx * 0.15, -0.3, -0.02], [0.2, 0.6, 0.03], [0.05, 0, sx * 0.1]), cloth(BOX, pink, [sx * 0.15, -0.6, 0], [0.2, 0.04, 0.03], [0.05, 0, sx * 0.1])]),
        tailAt: [0.05, top + 0.04, hz - 0.14],
        tail: [...chain([[0, 0, 0], [0.08, -0.12, -0.3], [0.16, -0.3, -0.6], [0.2, -0.44, -0.92]], 0.065, 0.045, shade(suit, 0.75), 'cloth'),
          ...chain([[0.03, -0.02, -0.02], [0.12, -0.16, -0.3], [0.22, -0.36, -0.56]], 0.05, 0.035, pink, 'cloth')],
      };
    },
  },

  // FIRE ELEMENTAL: hunched living lava, dark crust boulders with a glowing magma core showing through the cracks,
  // flickering flame crown, molten fists, and a rock mortar slung over the back.
  cinder: {
    plan: { hip: 1.12, tw: 1.0, th: 1.0, td: 0.72, hs: 0.44, neck: 0.04, hunch: 0.18, ax: 0.72, legX: 0.25, scale: [1.08, 1.0] },
    gait: { cad: 0.8, swing: 0.7, bob: 0.16, lean: 0.2, float: 0, sq: 0.1 },
    build(c) {
      const { hip, tw, th, td, top, hy, hz, hs, main, gl: gl0, fx } = c, gl = shade(gl0, 0.2), mid = hip + th * 0.5;
      const rock = tint(main, 0x2A2224, 0.3), rock2 = shade(tint(main, 0x5A4440, 0.4), 1.1), lava = shade(0xFF4E00, 0.42), hot = shade(0xFFA010, 0.4), ember = shade(0xFF3A00, 0.5);
      return {
        body: [
          glow(HEAD, lava, [0, mid + 0.06, hz * 0.4], [tw * 0.86, th * 0.95, td * 0.9]), // magma core
          glow(HEAD, hot, [0, mid + 0.14, hz * 0.4 + td * 0.2], [tw * 0.4, th * 0.4, td * 0.5]),
          stone(DODE, rock, [0, hip + 0.06, 0], [tw * 0.66, 0.36, td * 0.76], [0, 0.4, 0]), // pelvis rock
          ...both((sx) => [stone(DODE, rock2, [sx * tw * 0.24, hip + 0.14, td * 0.16], [0.3, 0.26, 0.3], [0.5, sx, 0])]),
          ...both((sx) => [stone(DODE, rock2, [sx * tw * 0.26, mid + 0.26, hz * 0.4 + td * 0.22], [tw * 0.46, th * 0.44, td * 0.5], [0.2, sx * 0.4, sx * 0.2]), // chest plates
            stone(DODE, rock, [sx * tw * 0.22, mid - 0.2, hz * 0.3 + td * 0.24], [tw * 0.34, th * 0.34, td * 0.4], [0.5, sx * 0.7, 0]),
            stone(DODE, rock, [sx * tw * 0.28, mid + 0.14, -td * 0.26], [tw * 0.44, th * 0.6, td * 0.5], [0.3, sx * 0.3, 0.2]),
            stone(DODE, rock2, [sx * tw * 0.1, mid - 0.18, -td * 0.34], [tw * 0.3, th * 0.36, td * 0.36], [0.6, sx * 0.8, 0])]),
          stone(DODE, rock2, [0, top - 0.04, hz * 0.8 - 0.04], [tw * 0.6, 0.36, td * 0.7], [0.3, 0, 0]),
          ...[[-0.06, 0.1, 0.6], [0.1, -0.12, -0.5], [0.0, 0.32, 0.1]].map(([x, y, r]) => glow(BOX, hot, [x, mid + y, hz * 0.4 + td * 0.5], [0.05, 0.34, 0.04], [0.3, 0, r])), // seam veins
          // magma head: crust skull, glowing maw, heavy brow
          glow(HEAD, lava, [0, hy - hs * 0.06, hz + hs * 0.06], [hs * 0.84, hs * 0.8, hs * 0.86]),
          stone(DODE, rock, [0, hy + hs * 0.12, hz - hs * 0.06], [hs * 1.0, hs * 0.86, hs * 0.96], [0.2, 0.4, 0]),
          ...both((sx) => [stone(DODE, rock2, [sx * hs * 0.24, hy + hs * 0.26, hz + hs * 0.3], [hs * 0.36, hs * 0.2, hs * 0.26], [0.3, sx * 0.3, sx * 0.35])]), // brow crusts
          ...both((sx) => [stone(DODE, rock2, [sx * hs * 0.34, hy - hs * 0.22, hz + hs * 0.26], [hs * 0.36, hs * 0.34, hs * 0.36], [0, sx * 0.5, 0])]), // cheek crusts
          glow(BOX, hot, [0, hy - hs * 0.3, hz + hs * 0.44], [hs * 0.38, hs * 0.07, hs * 0.1]), // maw
        ],
        eyes: (vc) => EYES.glow(vc, hz + hs * 0.5, hs, { gap: 0.2, w: 0.2, h: 0.1, y: 0.04, tilt: -0.3 }),
        arms: [0, 1].map((i) => {
          const sx = i ? 1 : -1;
          return [stone(DODE, rock2, [sx * 0.06, 0.1, 0], [0.5, 0.42, 0.52], [0.3, 0.5, sx * 0.3]),
            ...[-1, 0, 1].map((k) => glow(CONE, k ? lava : hot, [sx * 0.1 + k * 0.1, 0.36 + (k ? 0 : 0.08), k * -0.06], [0.16, k ? 0.34 : 0.5, 0.16], [0, 0, sx * -0.25 - k * 0.2])), // shoulder flames stone(DODE, rock, [sx * 0.16, -0.06, 0.04], [0.3, 0.3, 0.32], [0.9, 0.2, 0]),
            glow(CAP, lava, [0, -0.5, 0.04], [0.2, 0.62, 0.2]),
            stone(DODE, rock, [0, -0.32, 0.02], [0.34, 0.42, 0.34], [0, 0.5, 0]),
            stone(DODE, rock2, [0, -0.78, 0.08], [0.42, 0.46, 0.42], [0.2, 0.3, 0]),
            glow(SPH, lava, [0, -1.06, 0.14], [0.32, 0.3, 0.32]),
            ...[[-1, 0], [1, 0.7], [0, 1.4]].map(([x, a]) => stone(DODE, rock, [x * 0.1, -1.08 + (x ? 0 : -0.06), 0.16 + (x ? 0 : 0.1)], [0.18, 0.2, 0.18], [a, a, 0])),
            ...[0, 1].map((k) => glow(BOX, hot, [sx * 0.12, -0.7 - k * 0.16, 0.24], [0.03, 0.18, 0.03], [0.2, 0, sx * (0.4 - k * 0.8)]))];
        }),
        handAt: [0, -1.08, 0.3],
        legParts: (sx, H) => [glow(CAP, lava, [0, -H * 0.5, 0.04], [0.2, H * 0.4, 0.2]),
          stone(DODE, rock2, [0, -H * 0.22, 0.04], [0.42, 0.5, 0.4], [0.3, sx * 0.5, 0]), stone(DODE, rock, [sx * 0.04, -H * 0.42, 0.14], [0.2, 0.2, 0.2], [0.7, 0, 0]),
          stone(DODE, rock, [0, -H * 0.66, 0.04], [0.38, 0.44, 0.38], [0.5, sx * 0.9, 0]),
          stone(DODE, rock2, [0, -H + 0.13, 0.12], [0.46, 0.26, 0.6], [0, 0.3, 0])],
        extra: [
          { name: 'crown', parent: 'lean', at: [0, hy + hs * 0.42, hz - hs * 0.06], parts: [
            ...ring(7, (k, a) => [glow(CONE, k % 2 ? hot : lava, [Math.sin(a) * hs * 0.36, (k % 2 ? 0.2 : 0.32) * hs, Math.cos(a) * hs * 0.34], [hs * 0.32, hs * (k % 2 ? 0.8 : 1.2), hs * 0.32], [Math.cos(a) * -0.3, 0, Math.sin(a) * 0.3])]),
            glow(CONE, ember, [0, hs * 0.7, -0.04], [hs * 0.46, hs * 1.7, hs * 0.46]), glow(CONE, hot, [0, hs * 0.34, 0.06], [hs * 0.22, hs * 0.66, hs * 0.22])] },
          { name: 'mortar', parent: 'lean', at: [0.36, top - 0.12, -td * 0.5], parts: [
            stone(DODE, rock, [0, -0.12, 0], [0.56, 0.42, 0.5], [0.3, 0.4, 0]),
            stone(CYL6, rock2, [0.14, 0.24, 0.02], [0.36, 0.7, 0.36], [0.25, 0, -0.55]),
            stone(CYL6, rock, [0.29, 0.5, 0.1], [0.44, 0.16, 0.44], [0.25, 0, -0.55]),
            glow(CYL, hot, [0.33, 0.56, 0.12], [0.3, 0.04, 0.3], [0.25, 0, -0.55]), glow(SPH, lava, [0.3, 0.5, 0.11], 0.22)] },
        ],
      };
    },
    // Flames flicker on the crown; the back mortar kicks on every shot.
    anim(m, t, dt, h) {
      const cr = m.x.crown, mo = m.x.mortar, k = Math.max(h.atkT ?? 0, h.castT ?? 0);
      cr.scale.set(1 + Math.sin(t * 13) * 0.05, 1 + Math.sin(t * 9.3) * 0.12 + (h.charge ?? 0) * 0.4, 1 + Math.cos(t * 11) * 0.05);
      mo.position.y = mo.userData.y - k * 0.16;
      mo.rotation.x = -k * 0.25;
    },
  },

  // CRYSTAL ELEMENTAL: hovering faceted gem body with a cyan core, gem head with a shard crown, limbs of separate
  // floating crystal segments, a fan of shards behind the shoulders and orbiting crystals.
  prism: {
    plan: { hip: 1.1, tw: 0.82, th: 1.0, td: 0.6, hs: 0.42, neck: 0.2, ax: 0.66, legX: 0.2 },
    style: 'float',
    gait: { cad: 0.6, swing: 0.15, bob: 0.05, lean: 0.3, float: 0.6, sq: 0.02 },
    build(c) {
      const { hip, tw, th, td, top, hy, hz, hs, main, acc, gl: gl0 } = c, gl = shade(gl0, 0.2), mid = hip + th * 0.5;
      const cry = tint(main, 0x6FDCEE, 0.7), cryD = tint(0x2FA8C8, acc, 0.25), deep = 0x1A5A8A;
      return {
        body: [
          glow(OCT, gl, [0, mid + 0.12, 0], [0.42, 0.6, 0.42]), // inner core
          clear(OCT, cry, [0, mid + 0.08, 0], [tw * 1.25, th * 1.25, td * 1.35]),
          ...both((sx) => [glass(SHARD, cryD, [sx * tw * 0.22, mid + 0.3, td * 0.34], [tw * 0.42, th * 0.5, 0.5], [0.35, sx * 0.55, sx * 0.25]),
            glass(SHARD, cry, [sx * tw * 0.26, mid - 0.08, td * 0.3], [tw * 0.34, th * 0.4, 0.4], [0.5, sx * 0.6, sx * -0.3])]),
          glass(OCT, cryD, [0, hip - 0.14, 0], [0.46, 1.1, 0.42]), // tapered tip below
          glass(OCT, deep, [0, hip - 0.6, 0], [0.18, 0.4, 0.18]),
          ...both((sx) => [0, 1, 2].map((k) => glass(CONE6, k === 1 ? cryD : cry, [sx * (tw * 0.5 + k * 0.07), top - 0.06 + (k === 1 ? 0.06 : 0), (k - 1) * 0.12], [0.14, 0.36 - Math.abs(k - 1) * 0.1, 0.14], [(k - 1) * 0.3, 0, sx * -(0.9 + k * 0.2)]))).flat(),
          glow(OCT, gl, [0, top + 0.1, 0.06], [0.12, 0.16, 0.12]),
          // gem head
          glass(OCT, tint(cryD, 0x1A4A7A, 0.25), [0, hy, hz], [hs * 1.1, hs * 1.4, hs * 1.06], [0, PI / 4, 0]),
          glass(OCT, cry, [0, hy - hs * 0.16, hz + hs * 0.1], [hs * 0.56, hs * 0.6, hs * 0.62], [0, PI / 4, 0]),
          ...[-1, 0, 1].map((k) => glass(CONE4, k ? cry : cryD, [k * hs * 0.24, hy + hs * (0.62 - Math.abs(k) * 0.14), hz - hs * 0.06], [hs * 0.2, hs * (0.7 - Math.abs(k) * 0.2), hs * 0.2], [0, 0, -k * 0.35])),
          glow(OCT, gl, [0, hy + hs * 0.96, hz - hs * 0.06], [hs * 0.12, hs * 0.2, hs * 0.12]),
        ],
        eyes: (vc) => EYES.glow(vc, hz + hs * 0.46, hs, { gap: 0.17, w: 0.13, h: 0.18, y: 0.0, tilt: -0.35 }),
        arms: [0, 1].map((i) => {
          const sx = i ? 1 : -1;
          return [glass(OCT, cryD, [sx * 0.04, 0.02, 0], [0.34, 0.42, 0.34]),
            glass(OCT, cry, [0, -0.42, 0.02], [0.2, 0.56, 0.2]), glow(OCT, gl, [0, -0.72, 0.04], 0.09),
            glass(OCT, cry, [0, -0.92, 0.07], [0.22, 0.42, 0.22]),
            ...[-1, 0, 1].map((k) => glass(CONE4, cryD, [k * 0.07, -1.22, 0.1 + Math.abs(k) * -0.02], [0.07, 0.24, 0.07], [PI + 0.1, 0, k * 0.3])),
            ...(i ? [] : [glow(OCT, gl, [0, -1.12, 0.38], [0.14, 0.22, 0.14])])];
        }),
        handAt: [0, -1.12, 0.38],
        legs: 'none',
        halo: [...ring(5, (k, a) => [(k % 2 ? glow : glass)(OCT, k % 2 ? gl : cry, [Math.cos(a) * 1.25, 1.9 + (k % 2 ? 0.22 : -0.08), Math.sin(a) * 1.25], [0.2, 0.42, 0.2], [0.3, a, 0.2])])],
        extra: [{ name: 'fan', parent: 'lean', at: [0, top - 0.1, -td * 0.62], parts: [
          ...[-2, -1, 0, 1, 2].map((k) => glass(SHARD, k % 2 ? cryD : cry, [Math.sin(k * 0.45) * 0.55, Math.cos(k * 0.45) * 0.55, -Math.abs(k) * 0.03], [0.22, 0.95 - Math.abs(k) * 0.12, 0.5], [0, 0, -k * 0.45])),
          ...[-1, 1].map((k) => glow(SHARD, gl, [Math.sin(k * 0.45) * 0.62, Math.cos(k * 0.45) * 0.62, 0.03], [0.06, 0.6, 0.3], [0, 0, -k * 0.45]))] }],
      };
    },
    // The shard fan breathes open and closed; it flares on attacks.
    anim(m, t, dt, h) {
      const f = m.x.fan, k = Math.max(h.atkT ?? 0, h.castT ?? 0, h.charge ?? 0);
      f.position.y = f.userData.y + Math.sin(t * 2.2) * 0.06;
      const s = 1 + Math.sin(t * 1.6) * 0.04 + k * 0.25;
      f.scale.set(s, s, 1);
    },
  },

  // LIGHT SPIRIT: a brass lantern for a head with a living flame inside, sunburst robes trailing into light, a ray halo
  // on the back and a sun-disc staff. Floats; no legs.
  lumen: {
    plan: { hip: 1.1, tw: 0.78, th: 1.02, td: 0.54, hs: 0.5, neck: 0.1, ax: 0.58, legX: 0.2 },
    style: 'float',
    gait: { cad: 0.6, swing: 0.15, bob: 0.05, lean: 0.3, float: 0.55, sq: 0.02 },
    build(c) {
      const { hip, tw, th, td, top, hy, hz, hs, main, acc, gl: gl0 } = c, gl = shade(gl0, 0.2), mid = hip + th * 0.5;
      const robe = tint(main, 0xFFF8E6, 0.3), robeD = shade(robe, 0.86), sun = acc, brass = BRASS, flame = 0xFFF3C4;
      return {
        body: [
          ...torso({ hip, th, tw, td, c: robe, waist: 0.7, chest: 0.94 }),
          cloth(BELL, robe, [0, hip - 0.2, -0.02], [tw * 1.5, 1.1, td * 1.7]),
          cloth(BELL, robeD, [0, hip - 0.24, -0.02], [tw * 1.44, 1.06, td * 1.62]),
          ...ring(12, (k, a) => [glow(CONE4, k % 2 ? gl : shade(sun, 0.7), [Math.sin(a) * tw * 0.7, hip - 0.86 - (k % 2) * 0.06, Math.cos(a) * td * 0.78], [0.14, 0.34 + (k % 2) * 0.14, 0.1], [PI - Math.cos(a) * 0.3, a, Math.sin(a) * 0.3])]), // light hem
          cloth(RBOX, sun, [0, mid, td * 0.5], [tw * 0.28, th * 0.9, 0.04]), // stole
          cloth(RBOX, sun, [0, hip - 0.3, td * 0.7], [tw * 0.28, 0.8, 0.04], [-0.3, 0, 0]),
          glow(CYL, gl, [0, mid + 0.16, td * 0.54], [0.24, 0.04, 0.24], [PI / 2, 0, 0]),
          ...ring(8, (k, a) => [glow(SHARD, gl, [Math.cos(a) * 0.2, mid + 0.16 + Math.sin(a) * 0.2, td * 0.54], [0.06, 0.16, 0.2], [0, 0, a - PI / 2])]),
          metal(CYL, brass, [0, hip + 0.16, 0], [tw * 0.66, 0.07, td * 0.86]),
          ...ring(9, (k, a) => [cloth(LEAF, k % 2 ? sun : robe, [Math.sin(a) * 0.3, top + 0.02, hz * 0.5 + Math.cos(a) * 0.24], [0.2, 0.4, 0.5], [-0.9 * Math.cos(a), a, 0])]), // sun ruff
          // lantern head: base, hex glass, brass cage, cap, ring handle, living flame
          metal(CYL6, brass, [0, hy - hs * 0.58, hz], [hs * 0.86, hs * 0.14, hs * 0.86]),
          metal(CONE6, brass, [0, hy - hs * 0.74, hz], [hs * 0.5, hs * 0.22, hs * 0.5], [PI, 0, 0]),
          glow(SPH, gl, [0, hy - hs * 0.1, hz], [hs * 0.56, hs * 0.66, hs * 0.56]),
          glow(CONE, flame, [0, hy + hs * 0.22, hz], [hs * 0.3, hs * 0.5, hs * 0.3]),
          clear(CYL6, tint(gl, 0xFFFFFF, 0.4), [0, hy, hz], [hs * 0.92, hs * 1.08, hs * 0.92]),
          ...ring(6, (k, a) => [metal(BOX, brass, [Math.sin(a + PI / 6) * hs * 0.46, hy, hz + Math.cos(a + PI / 6) * hs * 0.46], [hs * 0.07, hs * 1.1, hs * 0.07])]),
          metal(CYL6, brass, [0, hy + hs * 0.58, hz], [hs * 0.98, hs * 0.1, hs * 0.98]),
          metal(CONE6, brass, [0, hy + hs * 0.82, hz], [hs * 0.86, hs * 0.42, hs * 0.86]),
          metal(TORUS, brass, [0, hy + hs * 1.12, hz], [hs * 0.36, hs * 0.36, hs * 0.4]),
          glow(SPH, gl, [0, hy + hs * 1.03, hz], hs * 0.12),
        ],
        eyes: (vc) => [...both((sx) => [part(SPH, 0x6A3A10, [sx * hs * 0.16, hs * 0.02, hs * 0.5], [hs * 0.2, hs * 0.22, hs * 0.04])]), ...EYES.glow(vc, hs * 0.53, hs, { gap: 0.16, w: 0.13, h: 0.15 })],
        arms: [
          [...arm({ r: 0.1, up: robe, fore: robe, hand: gl, sh: robe, foreF: 'cloth', handF: 'glow' }),
            cloth(BELL, robeD, [0, -0.78, 0.06], [0.42, 0.46, 0.42]), cloth(TORUS, sun, [0, -1.0, 0.07], [0.22, 0.22, 0.3], [PI / 2, 0, 0]),
            // sun-disc staff
            wood(CYL, WOOD, [0, -0.9, 0.2], [0.06, 2.1, 0.06]), metal(CONE, brass, [0, -1.98, 0.2], [0.08, 0.16, 0.08], [PI, 0, 0]),
            metal(WHEEL, brass, [0, 0.38, 0.2], [0.5, 0.5, 0.8]), glow(CYL, gl, [0, 0.38, 0.2], [0.42, 0.04, 0.42], [PI / 2, 0, 0]),
            ...ring(8, (k, a) => [glow(SHARD, k % 2 ? sun : gl, [Math.cos(a) * 0.36, 0.38 + Math.sin(a) * 0.36, 0.2], [0.08, 0.26, 0.2], [0, 0, a - PI / 2])])],
          [...arm({ r: 0.1, up: robe, fore: robe, hand: gl, sh: robe, foreF: 'cloth', handF: 'glow' }),
            cloth(BELL, robeD, [0, -0.78, 0.06], [0.42, 0.46, 0.42]), cloth(TORUS, sun, [0, -1.0, 0.07], [0.22, 0.22, 0.3], [PI / 2, 0, 0]),
            glow(SPH, gl, [0, -1.16, 0.34], 0.16)],
        ],
        handAt: [0, 0.38, 0.24],
        legs: 'none',
        halo: [...ring(4, (k, a) => [glow(SPH, k % 2 ? gl : 0xFFF6D0, [Math.cos(a) * 1.15, 2.1 + (k % 2 ? 0.25 : -0.05), Math.sin(a) * 1.15], 0.16)])],
        extra: [{ name: 'rays', parent: 'lean', at: [0, top + 0.12, -td * 0.62], parts: [
          metal(WHEEL, BRASS, [0, 0, 0], [1.1, 1.1, 1.0]), glow(CYL, gl, [0, 0, -0.04], [0.5, 0.03, 0.5], [PI / 2, 0, 0]),
          ...ring(12, (k, a) => [glow(SHARD, k % 2 ? sun : gl, [Math.cos(a) * (k % 2 ? 0.72 : 0.86), Math.sin(a) * (k % 2 ? 0.72 : 0.86), -0.02], [0.14, k % 2 ? 0.44 : 0.72, 0.3], [0, 0, a - PI / 2])])] }],
      };
    },
    // The ray halo turns slowly behind the lantern and flares on casts.
    anim(m, t, dt, h) {
      const r = m.x.rays, k = Math.max(h.castT ?? 0, h.charge ?? 0, (h.atkT ?? 0) * 0.5);
      r.rotation.z = t * 0.4;
      r.scale.setScalar(1 + k * 0.3 + Math.sin(t * 2) * 0.03);
    },
  },

  // HUMAN medic: warm brown skin, dark ponytail, glowing halo floating above the hair, long white field coat with mint
  // trim and pouches, headset, cross-ring scepter, and a hovering med-drone over her shoulder.
  aria: {
    plan: { hip: 1.36, tw: 0.72, th: 0.98, td: 0.46, hs: 0.41, neck: 0.12, ax: 0.51, legX: 0.16 },
    gait: { cad: 1.05, swing: 0.9, bob: 0.1, lean: 0.25, float: 0, sq: 0.05 },
    build(c) {
      const { hip, tw, th, td, top, hy, hz, hs, main, acc, gl: gl0 } = c, gl = shade(gl0, 0.2), mid = hip + th * 0.5;
      const coat = tint(main, 0xFFFFFF, 0.2), coatD = shade(coat, 0.84), mint = acc, scrub = tint(acc, 0x1E3A40, 0.65), hairC = 0x2A1A16, boot = 0x3A3F4A;
      return {
        body: [
          cloth(CYL, scrub, [0, hip + 0.04, 0], [tw * 0.62, 0.24, td * 0.8]),
          ...torso({ hip, th, tw, td, c: coat, waist: 0.76 }),
          cloth(RBOX, scrub, [0, mid + 0.1, td * 0.42], [tw * 0.28, th * 0.74, 0.08]),
          ...both((sx) => [cloth(RBOX, coatD, [sx * tw * 0.17, mid + 0.22, td * 0.47], [tw * 0.12, th * 0.52, 0.05], [0.04, sx * 0.25, sx * -0.16]),
            cloth(BOX, mint, [sx * tw * 0.22, mid - 0.06, td * 0.49], [0.03, th * 0.62, 0.02], [0, sx * 0.2, 0])]),
          ...both((sx) => [cloth(HEAD, coat, [sx * tw * 0.12, top + 0.02, hz - 0.04], [0.2, 0.22, 0.32], [0, 0, sx * -0.3])]), // high collar
          glow(BOX, gl, [tw * 0.2, mid + 0.28, td * 0.5], [0.12, 0.035, 0.02]), glow(BOX, gl, [tw * 0.2, mid + 0.28, td * 0.5], [0.035, 0.12, 0.02]), // cross badge
          rubber(CYL, 0x3A3F4A, [0, hip + 0.16, 0], [tw * 0.7, 0.08, td * 0.88]),
          ...[-1, 1].map((sx) => rubber(SOFT, 0xDDE3EA, [sx * tw * 0.3, hip + 0.12, td * 0.3], [0.14, 0.14, 0.1])),
          rubber(RBOX, 0x3A3F4A, [0, mid + 0.08, td * 0.5], [0.06, th * 0.95, 0.03], [0, 0, -0.62]),
          rubber(SOFT, coatD, [-tw * 0.44, hip + 0.04, 0.04], [0.16, 0.24, 0.3]), glow(BOX, gl, [-tw * 0.53, hip + 0.06, 0.04], [0.02, 0.1, 0.03]), // satchel
          skin(CYL, SKIN.brown, [0, top + 0.06, hz], [0.15, 0.2, 0.15]),
          ...face({ y: hy, z: hz, s: hs, skin: SKIN.brown, ears: 'round', nose: 'button', jaw: 0.86, hair: 'pony', hairC, brow: hairC, browTilt: 0.05 }),
          cloth(TORUS, mint, [0, hy + hs * 0.18, hz - hs * 0.5], [hs * 0.22, hs * 0.22, hs * 0.3]), // hair tie
          metal(SPH, 0xDDE3EA, [hs * 0.46, hy - hs * 0.02, hz], hs * 0.18), glow(SPH, gl, [hs * 0.53, hy - hs * 0.02, hz], hs * 0.07), // headset
          metal(CYL, 0xDDE3EA, [hs * 0.38, hy - hs * 0.22, hz + hs * 0.26], [0.02, hs * 0.5, 0.02], [1.1, 0.35, 0]),
        ],
        eyes: (vc) => EYES.human(vc, hz + hs * 0.43, hs, { h: 0.14, w: 0.21 }),
        arms: [
          [...arm({ r: 0.1, up: coat, fore: coat, hand: SKIN.brown, sh: coat, foreF: 'cloth' }), cloth(CYL, mint, [0, -0.86, 0.07], [0.24, 0.07, 0.24]),
            // cross-ring scepter
            metal(CYL, 0xE8ECF2, [0, -0.78, 0.2], [0.05, 1.3, 0.05], [0.12, 0, 0]), metal(SPH, BRASS, [0, -1.42, 0.12], 0.07), metal(CYL, mint, [0, -0.5, 0.24], [0.08, 0.12, 0.08], [0.12, 0, 0]),
            metal(RING, BRASS, [0, -0.0, 0.28], [0.4, 0.4, 0.8]), ...both((sx) => [metal(LEAF, 0xEEF1F5, [sx * 0.24, -0.08, 0.27], [0.12, 0.32, 0.5], [0, 0, sx * -0.9])]),
            glow(BOX, gl, [0, 0.0, 0.28], [0.07, 0.3, 0.07]), glow(BOX, gl, [0, 0.0, 0.28], [0.3, 0.07, 0.07]), glow(SPH, shade(gl, 1.3), [0, 0.0, 0.28], 0.08)],
          [...arm({ r: 0.1, up: coat, fore: coat, hand: SKIN.brown, sh: coat, foreF: 'cloth' }), cloth(CYL, mint, [0, -0.86, 0.07], [0.24, 0.07, 0.24]),
            cloth(CYL, mint, [0, -0.28, 0.01], [0.25, 0.12, 0.25]), glow(BOX, 0xFFFFFF, [0.12, -0.28, 0.04], [0.02, 0.08, 0.025]), glow(BOX, 0xFFFFFF, [0.12, -0.28, 0.04], [0.02, 0.025, 0.08])],
        ],
        handAt: [0, 0.0, 0.3],
        leg: { r: 0.11, thigh: scrub, shin: scrub, boot, bootF: 'rubber' },
        legExtra: (H) => [rubber(CYL, boot, [0, -H + 0.3, 0.02], [0.27, 0.22, 0.27]), cloth(CYL, mint, [0, -H + 0.42, 0.02], [0.28, 0.04, 0.28])],
        skirt: [...both((sx) => [cloth(RBOX, coat, [sx * 0.2, -0.4, -0.05], [0.22, 0.78, 0.035], [0.05, sx * 0.2, sx * 0.08]), cloth(BOX, mint, [sx * 0.2, -0.78, -0.03], [0.22, 0.04, 0.03], [0.05, sx * 0.2, sx * 0.08])]),
          ...both((sx) => [cloth(RBOX, shade(coat, 0.92), [sx * 0.15, -0.44, -td - 0.02], [0.28, 0.86, 0.035], [-0.1, 0, sx * 0.05])])],
        extra: [
          { name: 'halo', parent: 'lean', at: [0, hy + hs * 0.92, hz - 0.04], parts: [glow(TORUS, gl, [0, 0, 0], [hs * 1.05, hs * 1.05, hs * 0.5], [PI / 2 - 0.25, 0, 0]),
            ...ring(4, (k, a) => [glow(OCT, 0xFFFFFF, [Math.cos(a) * hs * 0.52, Math.sin(a) * hs * 0.13, Math.sin(a) * hs * 0.5], hs * 0.09)])] },
          { name: 'drone', parent: 'lean', at: [0.86, top + 0.5, -0.34], parts: [
            metal(SOFT, 0xEEF1F5, [0, 0, 0], [0.34, 0.18, 0.34]), metal(DOME, 0xEEF1F5, [0, 0.08, 0], [0.26, 0.14, 0.26]),
            glass(SPH, scrub, [0, 0, 0.16], [0.14, 0.1, 0.06]), glow(SPH, gl, [0, 0, 0.19], 0.06),
            glow(BOX, gl, [0, 0.17, 0], [0.12, 0.03, 0.03]), glow(BOX, gl, [0, 0.17, 0], [0.03, 0.03, 0.12]),
            ...both((sx) => [metal(BOX, 0xB4BAC4, [sx * 0.24, 0.02, 0], [0.16, 0.03, 0.04]), glow(RING, gl, [sx * 0.36, 0.04, 0], [0.22, 0.22, 0.6], [PI / 2, 0, 0])])] },
        ],
      };
    },
    // Halo turns; the med-drone bobs, tilts and leans in when she heals.
    anim(m, t, dt, h) {
      const H = m.x.halo, D = m.x.drone, k = Math.max(h.castT ?? 0, h.atkT ?? 0);
      H.rotation.y = t * 1.2;
      H.position.y = H.userData.y + Math.sin(t * 2.1) * 0.03;
      D.position.y = D.userData.y + Math.sin(t * 2.6) * 0.08 - k * 0.1;
      D.rotation.z = Math.sin(t * 1.7) * 0.15;
      D.rotation.x = 0.3 * k;
    },
  },

  // SKELETON mage (kid-safe): clean ivory skull with glowing pinpoint eyes under a tall bent wizard hat, open high-collared
  // robe showing a stylised ribcage and spine, bone forearms, a void orb with spinning rings. Floats; robe hem trails.
  nyx: {
    plan: { hip: 0.98, tw: 0.74, th: 1.0, td: 0.46, hs: 0.44, neck: 0.16, ax: 0.52, legX: 0.18 },
    style: 'float',
    gait: { cad: 0.6, swing: 0.15, bob: 0.05, lean: 0.3, float: 0.6, sq: 0.02 },
    build(c) {
      const { hip, tw, th, td, top, hy, hz, hs, main, acc, gl: gl0 } = c, gl = shade(gl0, 0.2), mid = hip + th * 0.5;
      const bone = 0xEFE8D8, boneD = 0xC9BFA8, robe = tint(main, 0x3A2A66, 0.35), robeD = shade(robe, 0.7), lining = acc, hat = tint(main, 0x4A3480, 0.45), hole = 0x1A1424;
      const hb = hy + hs * 0.36;
      return {
        body: [
          // spine + ribcage
          ...[0, 1, 2, 3, 4, 5].map((k) => stone(SPH, k % 2 ? boneD : bone, [0, hip + 0.1 + k * 0.17, -td * 0.18], [0.12, 0.1, 0.12])),
          ...[0, 1, 2, 3].map((k) => stone(HALFRING, k % 2 ? boneD : bone, [0, mid + 0.3 - k * 0.15, -td * 0.16], [tw * (0.66 - k * 0.06), td * (0.86 - k * 0.06), 1.4], [PI / 2, 0, 0])),
          stone(RBOX, bone, [0, mid + 0.18, td * 0.3], [0.08, th * 0.4, 0.06]), // sternum
          stone(SPH, bone, [0, hip + 0.06, 0], [tw * 0.5, 0.2, td * 0.5]), // pelvis
          // open robe: back, side panels, shoulders, high collar, lower robe and tattered hem
          cloth(RBOX, robe, [0, mid + 0.06, -td * 0.42], [tw * 0.86, th * 1.0, 0.06]),
          ...both((sx) => [cloth(RBOX, robe, [sx * tw * 0.4, mid + 0.06, -0.02], [0.14, th * 0.96, td * 0.86]),
            cloth(RBOX, lining, [sx * tw * 0.33, mid + 0.06, td * 0.36], [0.05, th * 0.96, 0.1], [0, sx * 0.4, 0]),
            cloth(HEAD, robe, [sx * tw * 0.36, top - 0.06, -0.02], [0.42, 0.28, td * 1.1], [0, 0, sx * -0.3])]),
          ...ring(7, (k, a) => [cloth(SHARD, k % 2 ? lining : shade(lining, 0.7), [Math.sin(a - PI / 2 + 0.2) * 0.32 * (k / 6 + 0.2), top + 0.26, -td * 0.42 + Math.cos(a) * 0.02], [0.22, 0.6, 0.4], [-0.25, 0, (k - 3) * 0.28])]).slice(0, 7), // fanned collar
          cloth(CYL, lining, [0, hip + 0.14, 0], [tw * 0.7, 0.1, td * 0.9]),
          cloth(BELL, robe, [0, hip - 0.34, -0.02], [tw * 1.3, 1.0, td * 1.9]),
          cloth(BELL, lining, [0, hip - 0.36, -0.02], [tw * 1.24, 0.98, td * 1.82]),
          ...ring(9, (k, a) => [cloth(SHARD, k % 2 ? robe : robeD, [Math.sin(a) * tw * 0.62, hip - 0.86, Math.cos(a) * td * 0.88], [0.2, 0.36, 0.5], [Math.cos(a) * 0.3, a, 0])]),
          // skull
          stone(HEAD, bone, [0, hy + hs * 0.08, hz], [hs * 0.9, hs * 0.86, hs * 0.92]),
          stone(HEAD, bone, [0, hy - hs * 0.22, hz + hs * 0.06], [hs * 0.62, hs * 0.42, hs * 0.66]),
          ...both((sx) => [part(SPH, hole, [sx * hs * 0.18, hy + hs * 0.02, hz + hs * 0.33], [hs * 0.26, hs * 0.24, hs * 0.18]),
            stone(SPH, boneD, [sx * hs * 0.28, hy - hs * 0.14, hz + hs * 0.26], [hs * 0.18, hs * 0.12, hs * 0.16])]),
          part(CONE4, hole, [0, hy - hs * 0.14, hz + hs * 0.43], [hs * 0.1, hs * 0.12, hs * 0.06], [PI, 0, 0]),
          ...[-1.5, -0.5, 0.5, 1.5].map((k) => stone(RBOX, 0xFFFBF0, [k * hs * 0.075, hy - hs * 0.32, hz + hs * 0.36], [hs * 0.065, hs * 0.1, hs * 0.05])),
          part(BOX, hole, [0, hy - hs * 0.38, hz + hs * 0.35], [hs * 0.34, hs * 0.02, hs * 0.03]),
          // tall bent wizard hat on the skull
          cloth(CYL, hat, [0, hb, hz - 0.02], [hs * 2.5, 0.05, hs * 2.5], [-0.08, 0, 0.04]),
          cloth(CONE, hat, [0, hb + 0.36, hz - 0.06], [hs * 1.12, 0.74, hs * 1.12], [-0.12, 0, 0.04]),
          cloth(CYL, lining, [0, hb + 0.07, hz - 0.02], [hs * 1.08, 0.1, hs * 1.08], [-0.08, 0, 0.04]),
          cloth(CONE, hat, [0.02, hb + 0.76, hz - 0.24], [hs * 0.4, 0.4, hs * 0.4], [-1.1, 0, 0.1]),
          glow(OCT, gl, [0, hb + 0.08, hz + hs * 0.54], [0.1, 0.14, 0.05]),
          glow(OCT, gl, [0.06, hb + 0.86, hz - 0.46], 0.08),
        ],
        eyes: (vc) => EYES.glow(vc, hz + hs * 0.44, hs, { gap: 0.18, w: 0.11, h: 0.11, y: 0.02 }),
        arms: [0, 1].map((i) => [
          cloth(SPH, robe, [0, 0, 0], 0.24), seg([0, -0.04, 0], [0, -0.46, 0.02], 0.1, robe, 'cloth'),
          cloth(BELL, robe, [0, -0.56, 0.03], [0.44, 0.44, 0.44]), cloth(TORUS, lining, [0, -0.78, 0.04], [0.23, 0.23, 0.3], [PI / 2, 0, 0]),
          ...both((dx) => [seg([dx * 0.025, -0.66, 0.05], [dx * 0.025, -0.98, 0.08], 0.03, bone, 'stone')]),
          stone(SPH, bone, [0, -1.0, 0.08], 0.08), stone(SOFT, bone, [0, -1.06, 0.1], [0.12, 0.1, 0.07]),
          ...[-1.5, -0.5, 0.5, 1.5].map((k) => seg([k * 0.035, -1.1, 0.11], [k * 0.05, -1.22, 0.15 + (i ? 0 : 0.06)], 0.016, bone, 'stone')),
        ]),
        handAt: [0, -1.06, 0.44],
        legs: 'none',
        halo: [...ring(5, (k, a) => [(k % 2 ? glow : metal)(CONE4, k % 2 ? gl : hat, [Math.cos(a) * 1.4, 1.75 + (k % 2 ? 0.22 : -0.06), Math.sin(a) * 1.4], [0.18, 0.46, 0.18], [PI, a, 0])])],
        extra: [{ name: 'orb', parent: 'arm0', at: [0, -1.04, 0.46], parts: [
          part(SPH, 0x140A26, [0, 0, 0], 0.36), glow(SPH, tint(gl, 0x140A26, 0.5), [0, 0, 0], 0.26),
          glow(TORUS, gl, [0, 0, 0], [0.5, 0.5, 0.12], [1.1, 0, 0.3]), glow(TORUS, shade(acc, 0.3), [0, 0, 0], [0.44, 0.44, 0.1], [0.2, 0.9, 0]),
          ...ring(3, (k, a) => [glow(OCT, shade(acc, 0.4), [Math.cos(a) * 0.32, Math.sin(a) * 0.12, Math.sin(a) * 0.32], 0.07)])] }],
      };
    },
    // The void orb's rings churn and the orb swells with charge.
    anim(m, t, dt, h) {
      const o = m.x.orb, k = (h.charge ?? 0) + (h.castT ?? 0) * 0.5;
      o.rotation.set(t * 1.4, t * 2.1, 0);
      o.scale.setScalar(1 + k * 0.35 + Math.sin(t * 3) * 0.04);
    },
  },

  // Hooded WRAITH (kid-safe): hunched cream cloak with a tall pointed hood, a porcelain mask with glowing slanted
  // mark-eyes in the hood's shadow, dark violet underlayer, wide tattered sleeves, a lime-edged sickle, rune charms,
  // and a cloth hem that trails into tatters instead of legs.
  vesper: {
    plan: { hip: 1.06, tw: 0.76, th: 1.0, td: 0.52, hs: 0.44, neck: 0.08, hunch: 0.24, ax: 0.56, legX: 0.2 },
    style: 'float',
    gait: { cad: 0.7, swing: 0.2, bob: 0.05, lean: 0.45, float: 0.45, sq: 0.03 },
    build(c) {
      const { hip, tw, th, td, top, hy, hz, hs, main, acc, gl: gl0 } = c, gl = shade(gl0, 0.2), mid = hip + th * 0.5;
      const cloak = tint(main, 0xD8D0BC, 0.2), cloakD = shade(cloak, 0.8), dusk = tint(acc, 0x140E24, 0.35), mask = 0xF6F2E8, voidC = 0x0E0A18;
      return {
        body: [
          cloth(HEAD, dusk, [0, mid, hz * 0.4], [tw * 0.8, th, td * 0.9]),
          ...torso({ hip, th, tw, td, c: cloak, waist: 0.82, chest: 1.02, z: hz * 0.3 }),
          cloth(RBOX, dusk, [0, mid - 0.04, td * 0.5 + hz * 0.3], [tw * 0.3, th * 0.9, 0.05]), // open front
          cloth(BELL, dusk, [0, hip - 0.22, -0.04], [tw * 1.32, 0.95, td * 1.75]),
          cloth(BELL, shade(dusk, 0.6), [0, hip - 0.24, -0.04], [tw * 1.26, 0.92, td * 1.68]),
          ...ring(10, (k, a) => [glow(CONE4, gl, [Math.sin(a) * tw * 0.6, hip - 0.66, Math.cos(a) * td * 0.8], [0.05, 0.16, 0.05], [PI, a, 0])]),
          ...ring(10, (k, a) => [cloth(SHARD, k % 2 ? dusk : shade(dusk, 1.25), [Math.sin(a) * tw * 0.64, hip - 0.74 - (k % 3) * 0.08, Math.cos(a) * td * 0.86], [0.24, 0.5 + (k % 3) * 0.16, 0.5], [Math.cos(a) * 0.25, a, 0])]),
          rubber(CYL, 0x5A4A3A, [0, hip + 0.14, hz * 0.2], [tw * 0.72, 0.06, td * 0.9]), // rope belt
          ...[-0.18, 0.06, 0.26].map((x, k) => glow(CYL6, gl, [x, hip - 0.04 - k * 0.04, td * 0.48], [0.1, 0.02, 0.1], [PI / 2, 0, 0])), // hex charms
          glow(OCT, gl, [0, top - 0.02, hz + td * 0.4], [0.1, 0.14, 0.06]), // clasp
          ...both((sx) => [cloth(HEAD, cloakD, [sx * tw * 0.36, top - 0.06, hz * 0.5 - 0.02], [0.44, 0.3, td * 1.1], [0, 0, sx * -0.35])]),
          // hood: big pointed cowl, rim, shadow, porcelain mask
          cloth(HEAD, cloak, [0, hy + hs * 0.06, hz - hs * 0.12], [hs * 1.36, hs * 1.36, hs * 1.36]),
          cloth(CONE, cloak, [0, hy + hs * 0.78, hz - hs * 0.36], [hs * 1.04, hs * 1.3, hs * 1.0], [-0.55, 0, 0]),
          cloth(CONE, cloakD, [0, hy + hs * 1.18, hz - hs * 0.78], [hs * 0.34, hs * 0.6, hs * 0.34], [-1.3, 0, 0]),
          cloth(HEAD, cloakD, [0, hy + hs * 0.4, hz + hs * 0.3], [hs * 1.08, hs * 0.38, hs * 0.74], [0.28, 0, 0]), // brow peak
          ...both((sx) => [cloth(SOFT, cloakD, [sx * hs * 0.5, hy - hs * 0.46, hz + hs * 0.06], [hs * 0.32, hs * 0.96, hs * 0.74], [0, 0, sx * 0.12])]), // drapes to the shoulders
          part(SPH, voidC, [0, hy - hs * 0.06, hz + hs * 0.3], [hs * 0.92, hs * 1.04, hs * 0.62]),
          stone(SPH, mask, [0, hy - hs * 0.08, hz + hs * 0.5], [hs * 0.56, hs * 0.72, hs * 0.24]),
          stone(CONE4, mask, [0, hy - hs * 0.36, hz + hs * 0.5], [hs * 0.16, hs * 0.18, hs * 0.1], [PI, PI / 4, 0]),
          glow(CYL6, gl, [0, hy + hs * 0.16, hz + hs * 0.62], [hs * 0.08, 0.01, hs * 0.08], [PI / 2, 0, 0]),
          ...ring(9, (k, a) => [cloth(SHARD, k % 2 ? dusk : shade(dusk, 1.3), [Math.sin(a) * tw * 0.5, top - 0.26, hz * 0.4 + Math.cos(a) * td * 0.62], [0.24, 0.46, 0.4], [Math.cos(a) * 0.2, a, 0])]), // dusk shawl
        ],
        eyes: (vc) => EYES.glow(vc, hz + hs * 0.63, hs, { gap: 0.14, w: 0.16, h: 0.065, y: 0.0, tilt: -0.35 }),
        arms: [0, 1].map((i) => [
          cloth(SPH, cloak, [0, -0.02, 0], 0.2), seg([0, -0.04, 0], [0, -0.5, 0.03], 0.1, cloak, 'cloth'),
          cloth(BELL, cloak, [0, -0.66, 0.04], [0.5, 0.66, 0.5]), cloth(BELL, voidC, [0, -0.7, 0.04], [0.46, 0.62, 0.46]),
          cloth(SHARD, cloakD, [0, -1.0, -0.14], [0.2, 0.42, 0.4], [0.3, 0, 0]), cloth(SHARD, cloak, [0.12, -0.98, 0.06], [0.16, 0.32, 0.4], [0, 0.6, 0]),
          rubber(SOFT, shade(dusk, 0.7), [0, -1.02, 0.08], [0.11, 0.15, 0.1]),
          ...[-1, 0, 1].map((k) => seg([k * 0.035, -1.08, 0.1], [k * 0.05, -1.24, 0.14], 0.018, shade(dusk, 0.7), 'rubber')),
          ...(i ? [glow(CYL6, gl, [0, -1.0, 0.42], [0.26, 0.02, 0.26], [PI / 2, 0, 0]), glow(RING, acc, [0, -1.0, 0.42], [0.36, 0.36, 0.5])]
            // sickle: wrapped wooden grip and a crescent blade with a glowing inner edge
            : [seg([0, -1.24, 0.0], [-0.1, -0.6, 0.32], 0.045, WOOD, 'wood', CYL), metal(SPH, BRASS, [0, -1.26, -0.01], 0.06), metal(CYL, 0x8A7A5A, [-0.09, -0.64, 0.3], [0.1, 0.08, 0.1]),
              ...crescent([-0.12, -0.6, 0.3], 0.44, 0.26, 0xDCE2EA, 'steel'), ...crescent([-0.12, -0.62, 0.36], 0.37, 0.08, gl, 'glow', -0.13)]),
        ]),
        handAt: [-0.12, -0.2, 0.74],
        legs: 'none',
        tailAt: [0, hip - 0.2, -td * 0.56],
        tail: [...[-1, 0, 1].map((k) => cloth(LEAF, k ? cloakD : cloak, [k * 0.18, -0.34, -0.22], [0.26, 0.9 - Math.abs(k) * 0.2, 0.3], [-0.6, 0, k * 0.2]))],
      };
    },
  },

  // FOX-person: russet fur, cream muzzle and chest ruff, big black-tipped ears, slit eyes, teal travel coat with a
  // glowing clock buckle, twin aqua daggers, digitigrade legs and a huge white-tipped brush tail.
  mirage: {
    plan: { hip: 1.3, tw: 0.7, th: 0.9, td: 0.48, hs: 0.42, neck: 0.16, hunch: 0.14, ax: 0.5, legX: 0.18 },
    gait: { cad: 1.2, swing: 1.0, bob: 0.08, lean: 0.45, float: 0, sq: 0.05, crouch: 0.08 },
    build(c) {
      const { hip, tw, th, td, top, hy, hz, hs, main, acc, gl: gl0 } = c, gl = shade(gl0, 0.2), mid = hip + th * 0.5;
      const furC = 0xD9743A, furD = shade(furC, 0.8), cream = 0xF4E8D6, ink = 0x2A2224, coat = tint(main, 0x0E5A5E, 0.25), trim = tint(acc, gl, 0.3);
      const dagger = (fw) => [rubber(CYL, ink, [0, -1.06, 0.08], [0.06, 0.24, 0.06], [PI / 2, 0, 0]), metal(BOX, BRASS, [0, -1.06, 0.2 * fw], [0.2, 0.04, 0.05]),
        seg([0, -1.06, 0.22 * fw], [0, -1.02, 0.78 * fw], [0.012, 0.06], 0xE6F4F4, 'steel', CONE4), seg([0, -1.06, 0.24 * fw], [0, -1.03, 0.7 * fw], [0.006, 0.03], gl, 'glow', CONE4)];
      return {
        body: [
          fur(SOFT, furC, [0, hip + 0.04, 0], [tw * 0.64, 0.28, td * 0.8]),
          ...torso({ hip, th, tw, td, c: furC, f: 'fur', waist: 0.62, chest: 0.9 }),
          fur(HEAD, cream, [0, mid + 0.14, td * 0.3], [tw * 0.5, th * 0.66, td * 0.46]),
          ...[-1, 0, 1].map((k) => fur(CONE4, k ? cream : 0xFFF6EA, [k * 0.1, top - 0.12 - Math.abs(k) * 0.02, hz + td * 0.4], [0.14, 0.32, 0.1], [PI - 0.3, 0, k * 0.4])), // chest tuft
          // short teal coat: shoulders, open sides, belt with a glowing clock buckle
          cloth(HEAD, coat, [0, top - 0.12, -0.03], [tw * 1.02, 0.4, td * 1.08]),
          ...both((sx) => [cloth(RBOX, coat, [sx * tw * 0.32, mid - 0.02, 0.0], [0.12, th * 0.86, td * 0.96]), cloth(BOX, trim, [sx * tw * 0.27, mid - 0.02, td * 0.45], [0.03, th * 0.84, 0.03])]),
          cloth(RBOX, coat, [0, mid, -td * 0.44], [tw * 0.62, th * 0.86, 0.05]),
          rubber(CYL, ink, [0, hip + 0.16, 0], [tw * 0.68, 0.08, td * 0.86]),
          metal(TORUS, BRASS, [0, hip + 0.16, td * 0.46], [0.16, 0.16, 0.2]), glow(CYL, gl, [0, hip + 0.16, td * 0.46], [0.13, 0.02, 0.13], [PI / 2, 0, 0]),
          rubber(BOX, ink, [0.02, hip + 0.18, td * 0.48], [0.015, 0.06, 0.01], [0, 0, -0.6]),
          fur(CYL, furC, [0, top + 0.04, hz], [0.28, 0.26, 0.26]), fur(HEAD, cream, [0, top + 0.06, hz + 0.08], [0.26, 0.26, 0.2]),
          // fox head: skull, cheek fluff, long snout with cream underside, black nose, tall ears
          fur(HEAD, furC, [0, hy + hs * 0.06, hz], [hs * 0.95, hs * 0.86, hs * 0.9]),
          ...both((sx) => [fur(CONE4, cream, [sx * hs * 0.42, hy - hs * 0.18, hz + hs * 0.06], [hs * 0.22, hs * 0.34, hs * 0.24], [0, 0, sx * -(PI / 2 + 0.6)]),
            fur(CONE, furC, [sx * hs * 0.3, hy + hs * 0.62, hz - hs * 0.06], [hs * 0.4, hs * 0.8, hs * 0.18], [-0.08, 0, sx * -0.32]),
            fur(CONE, cream, [sx * hs * 0.29, hy + hs * 0.56, hz - hs * 0.02], [hs * 0.24, hs * 0.56, hs * 0.08], [-0.08, 0, sx * -0.32]),
            fur(CONE, ink, [sx * hs * 0.4, hy + hs * 0.96, hz - hs * 0.06], [hs * 0.17, hs * 0.26, hs * 0.1], [-0.08, 0, sx * -0.32])]),
          fur(CONE, furC, [0, hy - hs * 0.14, hz + hs * 0.56], [hs * 0.42, hs * 0.66, hs * 0.36], [PI / 2 - 0.08, 0, 0]),
          fur(CONE, cream, [0, hy - hs * 0.24, hz + hs * 0.5], [hs * 0.34, hs * 0.58, hs * 0.24], [PI / 2 + 0.05, 0, 0]),
          part(SPH, ink, [0, hy - hs * 0.11, hz + hs * 0.88], [hs * 0.14, hs * 0.11, hs * 0.11]),
          glow(LEAF, gl, [0, hy + hs * 0.3, hz + hs * 0.4], [hs * 0.08, hs * 0.2, 0.5], [-0.5, 0, 0]),
        ],
        eyes: (vc) => EYES.slit(vc, hz + hs * 0.4, hs, { gap: 0.22, w: 0.15, h: 0.12, y: 0.08, tilt: 0.25, base: 0xBFF6EE }),
        arms: [
          [...arm({ r: 0.09, up: coat, fore: furC, hand: ink, sh: coat, foreF: 'fur', handF: 'fur' }), fur(CYL, cream, [0, -0.6, 0.05], [0.24, 0.1, 0.24]), ...dagger(1)],
          [...arm({ r: 0.09, up: coat, fore: furC, hand: ink, sh: coat, foreF: 'fur', handF: 'fur' }), fur(CYL, cream, [0, -0.6, 0.05], [0.24, 0.1, 0.24]), ...dagger(-1)],
        ],
        handAt: [0, -1.04, 0.6],
        legDigi: { r: 0.11, thigh: furC, shin: furD, paw: ink, claw: cream },
        legExtra: () => [cloth(CYL, coat, [0, -0.16, 0.05], [0.28, 0.3, 0.3])],
        skirt: both((sx) => [cloth(RBOX, coat, [sx * 0.15, -0.22, -0.02], [0.2, 0.44, 0.03], [0.05, 0, sx * 0.12])]),
        tailAt: [0, hip + 0.06, -td * 0.42],
        // big brush tail: overlapping fur volumes along a rising S-curve, white tip
        tail: [...Array.from({ length: 10 }, (_, k) => {
          const u = k / 9, y = -0.05 + u * u * 1.25 + Math.sin(u * PI) * 0.08, z = -0.16 - Math.sin(u * PI * 0.8) * 0.72, r = 0.14 + Math.sin(Math.min(1, u * 1.25) * PI) * 0.2 + u * 0.06;
          return fur(HEAD, u > 0.74 ? cream : k % 3 === 1 ? furD : furC, [0, y, z], [r * 1.9, r * 2.2, r * 1.9], [0.5 - u, 0, 0]);
        }), fur(CONE, cream, [0, 1.36, -0.26], [0.22, 0.3, 0.22], [-0.3, 0, 0])],
      };
    },
  },

  // GRAVITY MECH: squat navy walker chassis with a glass dome cockpit (glowing pilot core inside), hazard striping,
  // exposed pistons, a huge grav-ring fist and a clamp hand, and a gravity anchor floating behind it on a field ring.
  magnus: {
    plan: { hip: 1.2, tw: 1.2, th: 0.98, td: 0.9, hs: 0.5, neck: 0.0, ax: 0.86, legX: 0.32, scale: [1.12, 1.0] },
    gait: { cad: 0.7, swing: 0.55, bob: 0.18, lean: 0.12, float: 0, sq: 0.12 },
    build(c) {
      const { hip, tw, th, td, top, hs, main, acc, gl: gl0 } = c, gl = shade(gl0, 0.15), mid = hip + th * 0.5;
      const hull = tint(main, 0x3A5A8A, 0.25), hullL = tint(hull, 0xFFFFFF, 0.12), hullD = shade(hull, 0.7), haz = acc, jt = STEEL, dk = DARK;
      const hazard = (x, y, z, w, n) => Array.from({ length: n }, (_, k) => metal(BOX, k % 2 ? dk : haz, [x - w / 2 + (k + 0.5) * (w / n), y, z], [w / n, 0.1, 0.03], [0, 0, 0]));
      const dY = top + 0.02, dS = 0.74;
      return {
        body: [
          metal(RBOX, hullD, [0, hip + 0.04, 0], [tw * 0.66, 0.36, td * 0.7]),
          metal(RBOX, hull, [0, mid + 0.08, 0], [tw, th * 0.84, td]),
          metal(RBOX, hullL, [0, mid + 0.06, td * 0.46], [tw * 0.8, th * 0.6, 0.14], [-0.12, 0, 0]),
          ...hazard(0, hip + 0.3, td * 0.55, tw * 0.74, 7),
          metal(CYL6, hullD, [0, mid + 0.1, td * 0.54], [0.5, 0.06, 0.5], [PI / 2, 0, 0]), glow(RING, gl, [0, mid + 0.1, td * 0.58], [0.36, 0.36, 0.8]),
          glow(RING, gl, [0, mid + 0.1, td * 0.58], [0.2, 0.2, 0.8]), glow(SPH, gl, [0, mid + 0.1, td * 0.58], 0.07),
          ...both((sx) => [steel(CYL, dk, [sx * tw * 0.36, top + 0.02, -td * 0.3], [0.14, 0.34, 0.14]), glow(CYL, gl, [sx * tw * 0.36, top + 0.2, -td * 0.3], [0.1, 0.02, 0.1]), // exhaust stacks
            metal(RBOX, haz, [sx * tw * 0.47, mid + 0.08, 0], [0.06, th * 0.6, td * 0.6])]),
          ...both((sx) => [steel(CYL, dk, [sx * 0.16, mid + 0.1, -td * 0.52], [0.16, 0.12, 0.16], [PI / 2, 0, 0]), glow(CYL, gl, [sx * 0.16, mid + 0.1, -td * 0.59], [0.11, 0.02, 0.11], [PI / 2, 0, 0])]), // anchor emitters
          // cockpit: collar ring, glowing pilot core and console under a glass dome
          metal(CYL, hullD, [0, dY - 0.06, 0.05], [dS * 1.2, 0.16, dS * 1.2]), metal(TORUS, haz, [0, dY + 0.02, 0.05], [dS * 1.16, dS * 1.16, 0.7], [PI / 2, 0, 0]),
          metal(RBOX, dk, [0, dY + 0.1, 0.16], [dS * 0.7, 0.14, dS * 0.36], [-0.3, 0, 0]),
          glow(SPH, gl, [0, dY + 0.26, -0.04], 0.24), glow(SPH, shade(gl, 1.6), [0, dY + 0.28, 0.0], 0.11),
          clear(DOME, tint(gl0, 0xCFE4FF, 0.5), [0, dY, 0.05], [dS * 1.1, dS * 1.05, dS * 1.1]),
          ...[0, PI / 2].map((a) => metal(HALFRING, jt, [0, dY, 0.05], [dS * 1.12, dS * 1.08, 0.8], [0, a, 0])),
        ],
        eyesY: dY + 0.16,
        eyes: (vc) => [...both((sx) => [part(CYL, vc, [sx * 0.13, 0, 0.36], [0.1, 0.02, 0.1], [PI / 2 - 0.4, 0, 0])]), part(BOX, vc, [0, -0.07, 0.37], [0.34, 0.02, 0.02])],
        arms: [0, 1].map((i) => {
          const sx = i ? 1 : -1;
          const P = [metal(RBOX, hull, [sx * 0.06, 0.06, 0], [0.54, 0.5, 0.6]), metal(RBOX, haz, [sx * 0.33, 0.06, 0], [0.04, 0.3, 0.44]),
            steel(CYL, jt, [0, -0.38, 0], [0.2, 0.5, 0.2]), ...[-1, 1].map((dz) => steel(CYL, 0xD0D6DE, [sx * 0.1, -0.4, dz * 0.12], [0.05, 0.56, 0.05])),
            steel(SPH, dk, [0, -0.62, 0.02], 0.28),
            metal(RBOX, hull, [0, -0.86, 0.06], [0.42, 0.42, 0.46])];
          if (!i) P.push(metal(RBOX, hullL, [0, -1.18, 0.1], [0.5, 0.4, 0.5]), ...[-1.5, -0.5, 0.5, 1.5].map((k) => metal(RBOX, hullD, [k * 0.11, -1.24, 0.37], [0.1, 0.16, 0.08])),
            glow(TORUS, gl, [0, -0.98, 0.08], [0.6, 0.6, 0.4], [PI / 2, 0, 0]), glow(TORUS, gl, [0, -1.12, 0.1], [0.66, 0.66, 0.3], [PI / 2, 0, 0]));
          else P.push(metal(RBOX, hullD, [0, -1.1, 0.1], [0.3, 0.2, 0.3]), ...[-1, 0, 1].map((k) => steel(RBOX, jt, [k * 0.12, -1.28, 0.14 + (k ? 0 : 0.08)], [0.08, 0.26, 0.1], [k ? 0 : 0.3, 0, k * 0.2])));
          return P;
        }),
        handAt: [0, -1.18, 0.4],
        shY: top - 0.28,
        leg: { r: 0.18, thigh: jt, thighF: 'steel', shin: hull, shinF: 'metal', knee: haz, kneeF: 'metal', boot: dk, bootF: 'metal' },
        legExtra: (H) => [metal(RBOX, hull, [0, -H * 0.74, 0.08], [0.4, 0.5, 0.42]), metal(RBOX, haz, [0, -H * 0.6, 0.3], [0.3, 0.06, 0.03]),
          steel(CYL, 0xD0D6DE, [0, -H * 0.52, -0.18], [0.06, H * 0.6, 0.06], [0.1, 0, 0]),
          metal(RBOX, hullD, [0, -H + 0.1, 0.16], [0.54, 0.2, 0.66])],
        extra: [{ name: 'anchor', parent: 'lean', at: [0, top - 0.05, -td * 0.5 - 0.42], parts: scaleAbout([
          metal(CYL, haz, [0, 0, 0], [0.16, 1.3, 0.16]), metal(TORUS, jt, [0, 0.78, 0], [0.32, 0.32, 0.4]),
          metal(RBOX, hullD, [0, 0.48, 0], [0.86, 0.13, 0.13]), ...both((sx) => [metal(SPH, haz, [sx * 0.46, 0.48, 0], 0.12)]),
          metal(HALFRING, haz, [0, -0.32, 0], [1.1, 0.95, 2.4], [0, 0, PI]),
          ...both((sx) => [metal(CONE4, haz, [sx * 0.55, -0.22, 0], [0.22, 0.34, 0.12], [0, 0, sx * -0.5])]),
          glow(BOX, gl, [0, 0.1, 0.09], [0.04, 0.9, 0.02]),
          glow(TORUS, gl, [0, 0.1, 0], [0.62, 0.62, 0.3], [PI / 2, 0, 0])], [0, 0, 0], 1.3) }],
      };
    },
    // The anchor hangs in its gravity field: slow bob and turn, dips when Magnus slams.
    anim(m, t, dt, h) {
      const a = m.x.anchor, k = Math.max(h.atkT ?? 0, h.castT ?? 0);
      a.position.y = a.userData.y + Math.sin(t * 1.8) * 0.08 - k * 0.12;
      a.rotation.y = Math.sin(t * 0.9) * 0.35;
      a.rotation.z = Math.sin(t * 1.3) * 0.06;
    },
  },

  // ORC chain-reaver: broad grey-green orc with tusks, heavy jaw and a black mohawk, bare muscled torso under a
  // leather harness with draped chains, fur mantle and spiked pauldron, leather kilt, and a spiked flail on a chain.
  ravel: {
    plan: { hip: 1.26, tw: 1.06, th: 1.0, td: 0.66, hs: 0.44, neck: 0.08, hunch: 0.16, ax: 0.76, legX: 0.25, scale: [1.14, 1.0] },
    gait: { cad: 0.95, swing: 0.85, bob: 0.18, lean: 0.15, float: 0, sq: 0.1, sway: 0.16 },
    build(c) {
      const { hip, tw, th, td, top, hy, hz, hs, main, acc, gl: gl0, fx } = c, gl = shade(gl0, 0.2), mid = hip + th * 0.5;
      const orc = 0x7E9A62, orcD = shade(orc, 0.82), leather = 0x4A3426, iron = tint(main, 0x8A919C, 0.4), chainC = 0xC4CAD2, rust = acc, hot = shade(fx?.accent ?? 0xFFA040, 0.25), pelt = 0x6A5440, hairC = 0x262026;
      return {
        body: [
          rubber(CYL, leather, [0, hip + 0.04, 0], [tw * 0.68, 0.28, td * 0.84]),
          ...torso({ hip, th, tw, td, c: orc, f: 'skin', waist: 0.8, chest: 1.04, belly: 0.72, z: hz * 0.2 }),
          ...both((sx) => [skin(HEAD, orc, [sx * tw * 0.2, mid + 0.26, td * 0.32 + hz * 0.2], [tw * 0.42, th * 0.32, td * 0.42])]), // pecs
          ...both((sx) => [rubber(RBOX, leather, [sx * 0.05, mid + 0.12, td * 0.52 + hz * 0.2], [0.1, th * 1.0, 0.04], [0.05, 0, sx * 0.55])]), // harness X
          metal(TORUS, iron, [0, mid + 0.14, td * 0.58 + hz * 0.2], [0.18, 0.18, 0.4]),
          ...links([-tw * 0.4, top - 0.04, td * 0.44], [tw * 0.36, hip + 0.32, td * 0.56], 0.065, chainC), // draped chain
          ...links([-tw * 0.42, hip + 0.26, td * 0.44], [tw * 0.42, hip + 0.22, td * 0.46], 0.06, chainC),
          rubber(CYL, leather, [0, hip + 0.2, 0], [tw * 0.8, 0.14, td * 0.94]), metal(RBOX, rust, [0, hip + 0.2, td * 0.47], [0.24, 0.18, 0.05]),
          ...[-1, 1].map((sx) => metal(SPH, iron, [sx * 0.08, hip + 0.2, td * 0.5], 0.035)),
          fur(SOFT, pelt, [tw * 0.36, top - 0.02, -0.04 + hz * 0.3], [0.64, 0.34, td * 1.2], [0, 0, -0.3]), // fur mantle
          fur(SOFT, shade(pelt, 0.8), [tw * 0.1, top + 0.0, -td * 0.4], [0.7, 0.3, 0.24]),
          skin(CYL, orc, [0, top + 0.04, hz], [0.36, 0.22, 0.34]),
          ...face({ y: hy, z: hz, s: hs, skin: orc, ears: 'elf', nose: 'snub', jaw: 1.34, tusks: true, hair: 'mohawk', hairC, brow: hairC, browTilt: 0.32 }),
          skin(RBOX, orcD, [0, hy + hs * 0.12, hz + hs * 0.38], [hs * 0.66, hs * 0.1, hs * 0.14]), // heavy brow ridge
          ...both((sx) => [cloth(BOX, rust, [sx * hs * 0.24, hy - hs * 0.12, hz + hs * 0.43], [hs * 0.16, hs * 0.04, 0.01], [0, 0, sx * 0.3]),
            metal(TORUS, BRASS, [sx * hs * 0.66, hy - hs * 0.1, hz - hs * 0.08], [0.07, 0.07, 0.1], [0, PI / 2, 0])]),
        ],
        eyes: (vc) => EYES.human(vc, hz + hs * 0.43, hs, { h: 0.1, w: 0.18, tilt: -0.12, y: 0.0 }),
        arms: [
          [...arm({ r: 0.15, fr: 0.14, up: orc, fore: orc, hand: orc, sh: orc, upF: 'skin', foreF: 'skin', handF: 'skin' }),
            steel(DOME, iron, [-0.04, 0.06, 0], [0.56, 0.42, 0.56], [0, 0, 0.45]), ...spikes([-0.1, 0.12, 0], 0.18, 0.22, 0.05, chainC, [[-0.7, 0.7, 0], [-0.3, 0.95, 0.2], [-0.3, 0.95, -0.2]]),
            rubber(CYL, leather, [0, -0.78, 0.07], [0.32, 0.3, 0.32]), ...spikes([0, -0.78, 0.07], 0.14, 0.1, 0.035, chainC, [[-1, 0, 0], [0, 0, 1], [0, 0, -1]]),
            // spiked flail: haft, chain, ball
            wood(CYL, WOOD, [0, -1.08, 0.18], [0.08, 0.5, 0.08], [PI / 2, 0, 0]), metal(SPH, iron, [0, -1.08, -0.08], 0.09), metal(TORUS, iron, [0, -1.08, 0.44], [0.08, 0.08, 0.1], [0, PI / 2, 0]),
            ...links([0, -1.1, 0.48], [0, -1.5, 0.82], 0.055, chainC),
            steel(ICO1, iron, [0, -1.62, 0.92], 0.4), ...spikes([0, -1.62, 0.92], 0.2, 0.16, 0.05, chainC),
            glow(TORUS, hot, [0, -1.62, 0.92], [0.4, 0.4, 0.3], [PI / 2, 0, 0])],
          [...arm({ r: 0.15, fr: 0.14, up: orc, fore: orc, hand: orc, sh: orc, upF: 'skin', foreF: 'skin', handF: 'skin' }),
            rubber(CYL, leather, [0, -0.78, 0.07], [0.32, 0.3, 0.32]),
            ...[0, 1, 2].map((k) => metal(TORUS, chainC, [0, -0.6 - k * 0.12, 0.07], [0.19, 0.19, 0.12], [PI / 2 + 0.2 * (k - 1), 0, 0.2]))],
        ],
        handAt: [0, -1.62, 0.92],
        leg: { r: 0.16, thigh: 0x4A3E36, shin: leather, shinF: 'rubber', boot: 0x2A2420, bootF: 'rubber' },
        legExtra: (H) => [fur(CYL, pelt, [0, -H + 0.36, 0.02], [0.38, 0.18, 0.38]), steel(DOME, iron, [0, -H * 0.5, 0.12], [0.3, 0.22, 0.24], [PI / 2, 0, 0])],
        skirt: [...[-1, 0, 1].map((k) => rubber(RBOX, k ? leather : shade(leather, 0.85), [k * 0.26, -0.3, -0.02 - Math.abs(k) * 0.06], [0.26, 0.62, 0.04], [0.04, k * 0.25, k * 0.06])),
          metal(BOX, rust, [0, -0.6, 0.02], [0.26, 0.06, 0.03]), ...links([-0.1, -0.06, 0.04], [0.08, -0.44, 0.06], 0.04, chainC)],
      };
    },
  },
};
