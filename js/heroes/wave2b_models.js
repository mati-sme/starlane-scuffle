// Bespoke champion bodies for wave 2 batch B (wave2b.js; models.js delegates when spec.wave === 'b').
// v7.3: every champion is its own body plan (no shared armored kit): a crystal lizard, a carved figurehead golem, a dwarf
// smith, a tornado djinn, a parasol ghost, a circus cat, a starry comet spirit, a mushroom sage, a merfolk whaler, a spider
// weaver, a human choir warden and a birch ent. Parts come from ./anatomy.js; the rig is built by assemble() in forms.js.
// Each body keeps its live flourish in anim(): crystal frill, ship's wheel, bellows, storm ring + twister, twirling
// parasol, cat tail, orrery, breathing cap, harpoon reel, spider legs, hymn book hold, swaying bonsai.
import {
  PI, BOX, RBOX, SOFT, CYL, CONE, CONE4, OCT, ICO1, SPH, HEAD, DOME, CAP, RING, TORUS, WHEEL, FAN, BELL, LEAF,
  DARK, TRIM, BRASS, GOLD, WOOD, ROPE, SKIN, HAIR, shade, tint, part, metal, steel, cloth, glow, rubber, stone, glass, skin, fur, wood, clear,
  both, ring, seg, chain, arm, face, torso, EYES,
} from './anatomy.js';
import { assemble } from './forms.js';

const asF = (P, f) => P.map((q) => ({ ...q, f }));
const asClear = (P, f) => P.map((q) => ({ ...q, clear: true, f: f ?? q.f }));
// Deterministic scatter (star dots, scales) so every build is identical.
const rng = (seed) => { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };

const BODIES = {
  // CRYSTAL REPTILE: a long, low, horizontal lizard: haunches, barrel body, forward neck, wedge snout, crystal frill and
  // dorsal shards, a long crystal-studded tail, clawed forelimbs (geode club on the weapon side), digitigrade hind legs.
  basilisk: {
    plan: { hip: 1.0, tw: 1.1, th: 0.8, td: 1.0, hs: 0.5, neck: 0.1, hunch: 1.6, ax: 0.6, legX: 0.36, hy: 2.02, hz: 1.5 },
    gait: { cad: 0.75, swing: 0.7, bob: 0.08, lean: 0.18, float: 0, sq: 0.06, sway: 0.16 },
    build(c) {
      const { hip, tw, top, hy, hz, main, acc, gl } = c, belly = 0xD6C894, scD = shade(main, 0.78), scL = tint(main, 0xC8F0C8, 0.2), crys = tint(acc, 0xffffff, 0.25);
      const shard = (p, s, r, k = 0) => glass(OCT, k % 2 ? crys : acc, p, s, r);
      const spine = [[0, top + 0.16, 0.62], [0, top + 0.2, 0.26], [0, top + 0.1, -0.12], [0, hip + 0.66, -0.46], [0, hip + 0.5, -0.76]];
      return {
        body: [
          part(SPH, scD, [0, hip + 0.16, -0.32], [tw * 0.92, 0.66, 0.95]), // haunches
          part(SPH, main, [0, hip + 0.5, 0.05], [tw, 0.88, 1.75], [-0.22, 0, 0]), // long barrel body
          part(SPH, belly, [0, hip + 0.3, 0.3], [tw * 0.76, 0.56, 1.42], [-0.22, 0, 0]), // pale underbelly
          part(SPH, main, [0, top - 0.1, 0.62], [tw * 0.94, 0.74, 0.8]), // deep chest
          part(SPH, belly, [0, top - 0.3, 0.86], [tw * 0.62, 0.52, 0.44]),
          ...[0, 1, 2].map((k) => part(BOX, shade(belly, 0.8), [0, top - 0.5 + k * 0.14, 1.02 - k * 0.02], [tw * (0.36 - k * 0.04), 0.018, 0.04], [0.4, 0, 0])), // throat scutes
          ...both((sx) => [0, 1, 2, 3, 4].map((k) => part(SPH, scL, [sx * tw * 0.47, hip + 0.42 + (k % 2) * 0.16, -0.5 + k * 0.24], [0.08, 0.14, 0.2], [0, 0, sx * 0.3]))).flat(), // flank scale plates
          ...spine.map((p, k) => shard(p, [0.22 - k * 0.025, 0.56 - k * 0.06, 0.22 - k * 0.025], [-0.55, 0, 0], k)), // dorsal crystal ridge
          ...both((sx) => [shard([sx * tw * 0.42, top + 0.06, 0.52], [0.2, 0.5, 0.2], [0.2, 0, sx * -0.65], 0), shard([sx * tw * 0.5, top - 0.1, 0.3], [0.14, 0.36, 0.14], [-0.3, 0, sx * -1.0], 1)]),
          ...chain([[0, top - 0.08, 0.72], [0, hy - 0.12, hz - 0.5], [0, hy - 0.06, hz - 0.24]], 0.3, 0.22, main), // thick forward neck
          // wedge-snouted head
          part(SPH, main, [0, hy + 0.04, hz - 0.06], [0.54, 0.44, 0.62]),
          part(SPH, main, [0, hy - 0.03, hz + 0.3], [0.42, 0.3, 0.66]),
          part(RBOX, scL, [0, hy + 0.08, hz + 0.3], [0.28, 0.08, 0.5], [0.14, 0, 0]),
          part(SPH, belly, [0, hy - 0.15, hz + 0.2], [0.38, 0.16, 0.66]), // lower jaw
          ...both((sx) => [part(BOX, 0x22302A, [sx * 0.165, hy - 0.08, hz + 0.26], [0.02, 0.02, 0.48], [0, sx * 0.16, 0]), part(SPH, 0x1A2420, [sx * 0.07, hy + 0.04, hz + 0.61], 0.045),
            part(SPH, main, [sx * 0.18, hy + 0.17, hz + 0.02], [0.16, 0.1, 0.32]), shard([sx * 0.2, hy + 0.26, hz - 0.16], [0.08, 0.3, 0.08], [-1.0, 0, sx * -0.4], 1),
            ...[0, 1].map((k) => part(CONE4, 0xF4F0E0, [sx * 0.13, hy - 0.11, hz + 0.34 + k * 0.14], [0.03, 0.06, 0.03], [PI, 0, 0]))]),
          glow(OCT, gl, [0, hy + 0.21, hz + 0.08], [0.1, 0.14, 0.06]),
        ],
        eyes: (vc) => EYES.slit(vc, hz + 0.12, 0.5, { gap: 0.44, y: 0.16, w: 0.24, h: 0.18, tilt: -0.25 }),
        arms: [0, 1].map((i) => [
          ...arm({ r: 0.18, fr: 0.15, len: 1.42, up: main, fore: scD, sh: scL, upF: 'paint', foreF: 'paint', shF: 'paint', hand: null }),
          part(SPH, scD, [0, -1.42, 0.12], [0.34, 0.2, 0.44]),
          ...[-1, 0, 1].map((t) => part(CONE4, belly, [t * 0.1, -1.47, 0.36], [0.05, 0.16, 0.05], [PI / 2 + 0.3, 0, 0])),
          ...(i === 0 ? [ // weapon side: geode-encrusted forearm and a crystal club fist
            ...ring(5, (k, a) => shard([Math.cos(a) * 0.17, -0.8 + Math.sin(a) * 0.14, 0.06 + (k % 2) * 0.06], [0.14, 0.32, 0.14], [Math.sin(a) * 0.8, 0, -Math.cos(a) * 0.9], k)),
            shard([0, -1.0, 0.22], [0.34, 0.5, 0.34], [0.4, 0, 0], 0), glow(OCT, gl, [0, -1.0, 0.26], [0.15, 0.24, 0.15])]
            : [shard([0, -0.6, -0.12], [0.12, 0.28, 0.12], [-0.6, 0, 0], 1)]),
        ]),
        handAt: [0, -1.0, 0.3],
        legDigi: { r: 0.18, thigh: main, shin: scD, paw: scD, claw: belly, thighF: 'paint', shinF: 'paint', pawF: 'paint' },
        legExtra: (H) => [part(SPH, scL, [0, -H * 0.3, 0.2], [0.18, 0.26, 0.16]), shard([0, -H * 0.2, -0.08], [0.08, 0.22, 0.08], [-0.9, 0, 0], 1)],
        tailAt: [0, hip + 0.42, -0.88],
        tail: (() => { // long tapering tail with crystal studs and a crystal club tip
          const pts = [[0, 0, 0], [0, -0.12, -0.45], [0, -0.32, -0.9], [0, -0.54, -1.34], [0, -0.7, -1.78], [0, -0.78, -2.18]];
          return [...chain(pts, 0.34, 0.1, main), ...chain(pts.map(([x, y, z]) => [x, y - 0.08, z]), 0.26, 0.07, belly),
            ...pts.slice(1, 5).map((p, k) => shard([p[0], p[1] + 0.3 - k * 0.05, p[2]], [0.15 - k * 0.02, 0.36 - k * 0.04, 0.15 - k * 0.02], [-0.7, 0, 0], k)),
            shard([0, -0.8, -2.34], [0.3, 0.5, 0.3], [-1.3, 0, 0], 0), glow(OCT, gl, [0, -0.8, -2.36], [0.12, 0.2, 0.12])];
        })(),
        extra: [{ // crystal frill fanned behind the head
          name: 'frill', parent: 'lean', at: [0, hy + 0.12, hz - 0.34],
          parts: [...ring(7, (k) => { const a = (k - 3) * 0.4; return shard([Math.sin(a) * 0.36, 0.06 + Math.cos(a) * 0.24, -0.06], [0.13, 0.56 - Math.abs(k - 3) * 0.06, 0.05], [-0.6, 0, -a], k); }),
            clear(FAN, crys, [0, 0.04, -0.04], [0.7, 1, 0.9], [-0.6, PI / 2, PI / 2])],
        }],
      };
    },
    // The crystal frill flares while a skill charges; the head sways side to side like a lizard tasting the air.
    anim(m, t, dt, h) {
      const f = m.x.frill, k = Math.max(h.charge ?? 0, h.castT ?? 0);
      f.scale.setScalar(1 + 0.5 * k + Math.sin(t * 3) * 0.04);
      f.rotation.x = -0.3 * k;
      m.lean.rotation.z += Math.sin(t * 1.3) * 0.03 * (1 - (h.moveAmt ?? 0));
    },
  },

  // WOODEN FIGUREHEAD GOLEM: a carved oak hull come alive: ship's-prow chest with planking and a brass ram, a carved
  // bearded figurehead face with lantern eyes, barrel shoulders, brass bands and portholes, the ship's wheel on its back.
  keel: {
    plan: { hip: 1.12, tw: 1.35, th: 1.2, td: 0.95, hs: 0.46, neck: 0.04, ax: 0.94, legX: 0.34, scale: [1.08, 1] },
    gait: { cad: 0.7, swing: 0.55, bob: 0.14, lean: 0.08, float: 0, sq: 0.08, sway: 0.24 },
    build(c) {
      const { hip, tw, th, td, top, hy, hz, hs, main, acc, gl } = c, mid = hip + th * 0.5;
      const oak = 0x8E5E38, oakD = 0x5E3C24, oakL = 0xB4834F, grain = 0x45291A, hull = 0x8A2E2A, paint = tint(main, 0x3A6A8A, 0.35);
      const P = tw * 0.66, F = P * 0.707; // prow box size, half-diagonal
      const plank = (y, sx, w = 0.97) => part(BOX, grain, [sx * F * 0.5, y, 0.05 + F * 0.5], [P * w, 0.022, 0.03], [0, sx * PI / 4, 0], 'wood');
      return {
        body: [
          wood(RBOX, oakD, [0, hip + 0.08, 0], [tw * 0.7, 0.36, td * 0.8]),
          // the prow: a diamond-section hull whose keel edge points forward, planked, painted stripe, red hull band
          wood(RBOX, oak, [0, mid + 0.1, 0.05], [P, th * 0.98, P], [0, PI / 4, 0]),
          part(RBOX, paint, [0, mid + 0.06, 0.05], [P * 1.02, 0.16, P * 1.02], [0, PI / 4, 0]),
          part(RBOX, hull, [0, hip + 0.3, 0.05], [P * 0.96, 0.36, P * 0.96], [0, PI / 4, 0]),
          ...both((sx) => [0.2, 0.36, 0.72, 0.88, 1.02].map((f) => plank(hip + f * th * 0.95, sx))).flat(),
          metal(BOX, acc, [0, mid + 0.1, 0.05 + F + 0.02], [0.1, th * 0.98, 0.1], [0, PI / 4, 0]), // brass ram along the keel edge
          metal(CONE4, acc, [0, hip + 0.02, 0.05 + F], [0.18, 0.3, 0.18], [PI, PI / 4, 0]),
          ...both((sx) => [metal(TORUS, acc, [sx * F * 0.55, mid + 0.34, 0.05 + F * 0.45 + 0.03], [0.24, 0.24, 0.3], [0, sx * PI / 4, 0]),
            glass(CYL, 0x9FE6F0, [sx * F * 0.55, mid + 0.34, 0.05 + F * 0.45 + 0.03], [0.2, 0.03, 0.2], [PI / 2, 0, sx * -PI / 4]),
            ...[0, 1, 2, 3].map((k) => metal(SPH, acc, [sx * F * (0.12 + k * 0.24), hip + 0.5, 0.05 + F * (0.88 - k * 0.24) + 0.03], 0.05))]), // portholes + rivets
          // gunwale collar
          metal(CYL, acc, [0, top - 0.02, 0], [tw * 0.88, 0.1, td * 0.92]), wood(CYL, oakD, [0, top + 0.05, 0], [tw * 0.8, 0.1, td * 0.84]),
          // barrel shoulders with brass hoops
          ...both((sx) => [wood(CYL, oakL, [sx * (tw * 0.5 + 0.06), top - 0.1, 0], [0.56, 0.42, 0.56], [0, 0, PI / 2 + sx * 0.25]),
            ...[-0.13, 0.13].map((d) => metal(CYL, acc, [sx * (tw * 0.5 + 0.06 + d), top - 0.1 + d * sx * 0.25, 0], [0.6, 0.04, 0.6], [0, 0, PI / 2 + sx * 0.25]))]),
          // anchor chain draped across the chest
          ...ring(8, (k) => metal(RING, TRIM, [-tw * 0.38 + k * tw * 0.108, top - 0.14 - Math.sin((k / 7) * PI) * 0.42, F * 0.95 - Math.abs(k - 3.5) * 0.12], [0.2, 0.2, 0.2], [k % 2 ? 0 : PI / 2, 0.6, 0])),
          wood(CYL, oakD, [0, top + 0.12, hz], [0.36, 0.16, 0.36]),
          // carved figurehead: wood-grain face with a carved beard and swept hair, brass circlet
          ...asF(face({ y: hy, z: hz + 0.04, s: hs, skin: oakL, ears: 'round', nose: 'long', jaw: 1.15, hair: 'swept', hairC: oakD, beard: 'full', beardC: oak, brow: grain, browTilt: -0.3 }), 'wood'),
          ...[-0.12, 0, 0.12].map((x) => part(BOX, grain, [x, hy - hs * 0.62, hz + hs * 0.5], [0.012, hs * 0.5, 0.012], [0.2, 0, 0], 'wood')), // beard grain
          metal(CYL, acc, [0, hy + hs * 0.32, hz - 0.02], [hs * 1.0, 0.05, hs * 1.02], [0.12, 0, 0]),
        ],
        eyes: (vc) => EYES.glow(vc, hz + 0.04 + hs * 0.44, hs, { gap: 0.19, w: 0.18, h: 0.08, y: 0.03, tilt: -0.1 }),
        arms: [
          [...asF(arm({ r: 0.19, fr: 0.21, up: oak, fore: oakL, sh: oakD, hand: oakD }), 'wood'), metal(CYL, acc, [0, -0.8, 0.08], [0.46, 0.08, 0.46]), metal(CYL, acc, [0, -0.3, 0.02], [0.42, 0.06, 0.42]),
            ...[-0.08, 0.08].map((x) => part(BOX, grain, [x, -0.6, 0.18], [0.012, 0.3, 0.012], undefined, 'wood')),
            // anchor gripped by the shank, flukes down by the boots
            steel(CYL, 0x4A505A, [0, -0.9, 0.42], [0.13, 1.7, 0.13], [-0.25, 0, 0]), metal(RING, acc, [0, -0.08, 0.64], [0.34, 0.34, 0.34], [0, PI / 2, 0]),
            steel(BOX, 0x4A505A, [0, -0.3, 0.6], [0.8, 0.1, 0.12], [-0.25, 0, 0]),
            ...both((sx) => [steel(CYL, 0x4A505A, [sx * 0.3, -1.66, 0.2], [0.12, 0.72, 0.12], [0, 0, sx * 1.1]), metal(CONE4, acc, [sx * 0.62, -1.42, 0.16], [0.26, 0.36, 0.1], [0, 0, sx * -0.4])]),
            glow(OCT, gl, [0, -1.75, 0.22], [0.14, 0.14, 0.14])],
          [...asF(arm({ r: 0.19, fr: 0.21, up: oak, fore: oakL, sh: oakD, hand: oakD }), 'wood'), metal(CYL, acc, [0, -0.3, 0.02], [0.42, 0.06, 0.42]),
            ...[0, 1, 2].map((k) => cloth(TORUS, ROPE, [0, -0.62 - k * 0.1, 0.06], [0.38, 0.38, 0.3], [PI / 2, 0, 0])), metal(RBOX, acc, [0, -1.1, 0.16], [0.3, 0.12, 0.3])],
        ],
        leg: { r: 0.2, thigh: oak, shin: oakL, thighF: 'wood', shinF: 'wood', knee: acc, kneeF: 'metal', boot: oakD, bootF: 'wood' },
        legExtra: (H) => [metal(RBOX, acc, [0, -H + 0.1, 0.3], [0.38, 0.1, 0.1]), metal(CYL, acc, [0, -H * 0.8, 0.02], [0.44, 0.05, 0.44]), part(BOX, grain, [0.05, -H * 0.72, 0.16], [0.012, 0.3, 0.012], undefined, 'wood')],
        skirt: [...[-1, 0, 1].map((k) => wood(RBOX, k ? oak : oakD, [k * 0.38, -0.24, 0.02 - Math.abs(k) * 0.08], [0.36, 0.44, 0.08], [0.12, k * -0.35, 0])),
          ...[-1, 0, 1].map((k) => metal(BOX, acc, [k * 0.38, -0.42, 0.06 - Math.abs(k) * 0.08], [0.36, 0.04, 0.06], [0.12, k * -0.35, 0]))],
        extra: [{ // ship's wheel on the back
          name: 'wheel', parent: 'lean', at: [0, mid + 0.25, -td * 0.62],
          parts: [wood(WHEEL, WOOD, [0, 0, 0], [1.5, 1.5, 4]), wood(WHEEL, WOOD, [0, 0, 0], [1.2, 1.2, 4]), metal(CYL, acc, [0, 0, 0], [0.26, 0.14, 0.26], [PI / 2, 0, 0]),
            ...ring(8, (k, a) => wood(CYL, WOOD, [Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0], [0.07, 1.0, 0.07], [0, 0, a + PI / 2])),
            ...ring(8, (k, a) => wood(SPH, shade(WOOD, 1.2), [Math.cos(a) * 0.98, Math.sin(a) * 0.98, 0], [0.1, 0.1, 0.1])), glow(CYL, gl, [0, 0, -0.08], [0.12, 0.02, 0.12], [PI / 2, 0, 0])],
        }],
      };
    },
    // The wheel creaks round at rest and spins while Keel rolls forward; casts give it a hard turn.
    anim(m, t, dt, h) {
      h._wheel = (h._wheel ?? 0) + dt * (0.4 + (h.moveAmt ?? 0) * 3 + (h.castT ?? 0) * 8);
      m.x.wheel.rotation.z = h._wheel;
    },
  },

  // DWARF blacksmith: a short, broad size class: barrel chest, ruddy face, huge braided ginger beard, goggles pushed up on a
  // bald crown, rolled sleeves on bare forearms, leather apron, forge sledge and tongs, bellows on the back.
  anvil: {
    plan: { hip: 0.74, tw: 1.14, th: 0.94, td: 0.84, hs: 0.58, neck: 0.06, ax: 0.74, legX: 0.27, scale: [1.06, 0.94] },
    gait: { cad: 1.0, swing: 0.8, bob: 0.14, lean: 0.16, float: 0, sq: 0.1, sway: 0.1 },
    build(c) {
      const { hip, tw, th, td, top, hy, hz, hs, main, acc, gl } = c, mid = hip + th * 0.5;
      const leather = 0x6B4A2E, shirt = 0xC9BBA2, sk = 0xD49272, beardC = 0xB4502A, iron = 0x3A3F46, pants = shade(main, 0.9);
      return {
        body: [
          cloth(CYL, pants, [0, hip + 0.06, 0], [tw * 0.72, 0.3, td * 0.82]),
          ...torso({ hip, th, tw, td, c: shirt, waist: 0.98, chest: 1.06, belly: 0.98 }), // barrel chest in a linen work shirt
          cloth(RBOX, leather, [0, mid + 0.04, td * 0.5], [tw * 0.66, th * 0.86, 0.08], [0.08, 0, 0]), // apron bib
          ...both((sx) => [seg([sx * tw * 0.3, mid + 0.4, td * 0.5], [sx * tw * 0.34, top + 0.02, 0.02], 0.045, leather, 'cloth'), metal(SPH, acc, [sx * tw * 0.29, mid + 0.4, td * 0.56], 0.07)]),
          metal(RBOX, acc, [0, mid + 0.08, td * 0.56], [0.22, 0.15, 0.04]), glow(BOX, gl, [0, mid + 0.08, td * 0.585], [0.13, 0.05, 0.01]), // hammer badge
          rubber(CYL, 0x3A2618, [0, hip + 0.18, 0], [tw * 0.86, 0.12, td * 0.94]), metal(RBOX, acc, [0, hip + 0.18, td * 0.47], [0.22, 0.16, 0.05]), // belt
          skin(CYL, sk, [0, top + 0.04, hz], [0.3, 0.14, 0.3]),
          ...face({ y: hy, z: hz, s: hs, skin: sk, ears: 'round', nose: 'round', jaw: 1.18, beard: 'full', beardC, brow: beardC, browTilt: -0.3 }),
          ...both((sx) => [fur(SOFT, beardC, [sx * hs * 0.38, hy + hs * 0.02, hz - hs * 0.12], [hs * 0.18, hs * 0.36, hs * 0.5]), // side tufts on the bald head
            ...chain([[sx * hs * 0.3, hy - hs * 0.7, hz + hs * 0.6], [sx * hs * 0.34, hy - hs * 1.05, hz + hs * 0.74], [sx * hs * 0.32, hy - hs * 1.32, hz + hs * 0.76]], hs * 0.1, hs * 0.07, beardC, 'fur'),
            metal(TORUS, acc, [sx * hs * 0.34, hy - hs * 1.12, hz + hs * 0.75], [hs * 0.2, hs * 0.2, hs * 0.3], [PI / 2, 0, 0])]), // beard braids with copper beads
          fur(SOFT, beardC, [0, hy - hs * 0.66, hz + hs * 0.56], [hs * 0.98, hs * 0.62, hs * 0.44], [0.2, 0, 0]), fur(SOFT, beardC, [0, hy - hs * 1.04, hz + hs * 0.8], [hs * 0.76, hs * 0.62, hs * 0.34], [0.3, 0, 0]), fur(SPH, beardC, [0, hy - hs * 1.34, hz + hs * 0.86], [hs * 0.46, hs * 0.36, hs * 0.26]), // great beard spilling over the chest
          // goggles pushed up on the crown
          ...both((sx) => [metal(CYL, BRASS, [sx * hs * 0.17, hy + hs * 0.38, hz + hs * 0.34], [hs * 0.26, hs * 0.12, hs * 0.26], [PI / 2 - 0.7, 0, 0]),
            glass(CYL, 0x5ABFD8, [sx * hs * 0.17, hy + hs * 0.4, hz + hs * 0.39], [hs * 0.2, hs * 0.04, hs * 0.2], [PI / 2 - 0.7, 0, 0])]),
        ],
        eyes: (vc) => EYES.human(vc, hz + hs * 0.43, hs, { gap: 0.2, h: 0.1, tilt: -0.1 }),
        arms: [
          [...arm({ r: 0.15, fr: 0.17, len: 0.9, up: shirt, sh: leather, shF: 'rubber', fore: sk, hand: 0x4A3424, handF: 'rubber' }), cloth(TORUS, shirt, [0, -0.46, 0.03], [0.32, 0.32, 0.36], [PI / 2, 0, 0]),
            rubber(CYL, leather, [0, -0.78, 0.07], [0.42, 0.14, 0.42]),
            // forge sledge: long haft, squared head banded in copper, glowing striking face
            wood(CYL, WOOD, [0, -0.92, 0.5], [0.09, 1.2, 0.09], [PI / 2, 0, 0]),
            steel(RBOX, 0x59606B, [0, -0.92, 1.12], [0.4, 0.38, 0.64], [PI / 2, 0, 0]), ...[-0.18, 0.18].map((dz) => metal(BOX, acc, [0, -0.92, 1.12 + dz], [0.44, 0.42, 0.06])),
            glow(BOX, gl, [0, -0.71, 1.12], [0.28, 0.02, 0.44])],
          [...arm({ r: 0.15, fr: 0.17, len: 0.9, up: shirt, sh: leather, shF: 'rubber', fore: sk, hand: 0x4A3424, handF: 'rubber' }), cloth(TORUS, shirt, [0, -0.46, 0.03], [0.32, 0.32, 0.36], [PI / 2, 0, 0]),
            rubber(CYL, leather, [0, -0.78, 0.07], [0.42, 0.14, 0.42]),
            // smith's tongs pinching a glowing ingot
            ...both((sx) => [steel(CYL, iron, [sx * 0.04, -0.92, 0.42], [0.04, 0.7, 0.04], [PI / 2, 0, sx * 0.08])]),
            glow(RBOX, 0xFFB050, [0, -0.92, 0.82], [0.14, 0.1, 0.24])],
        ],
        handAt: [0, -0.92, 0.35],
        leg: { r: 0.17, thigh: pants, shin: pants, boot: 0x2A2420 },
        legExtra: (H) => [rubber(CYL, 0x3A2A1E, [0, -H + 0.26, 0.02], [0.4, 0.2, 0.4]), steel(SOFT, 0x59606B, [0, -H + 0.1, 0.28], [0.34, 0.16, 0.14])],
        skirt: [cloth(RBOX, leather, [0, -0.3, 0.04], [tw * 0.66, 0.62, 0.07], [0.06, 0, 0]), metal(BOX, acc, [0, -0.6, 0.06], [tw * 0.66, 0.05, 0.05], [0.06, 0, 0]),
          ...[-0.18, 0.18].map((x) => metal(SPH, acc, [x, -0.12, 0.09], 0.05)), cloth(RBOX, shade(leather, 0.85), [0.16, -0.28, 0.1], [0.2, 0.18, 0.04])], // apron + pocket
        extra: [{ // leather bellows + coal pot on the back
          name: 'bellows', parent: 'lean', at: [0, mid + 0.08, -td * 0.62],
          parts: [wood(RBOX, WOOD, [0, 0.32, -0.02], [0.66, 0.08, 0.46], [0.25, 0, 0]), wood(RBOX, WOOD, [0, -0.32, -0.02], [0.66, 0.08, 0.46], [-0.25, 0, 0]),
            cloth(RBOX, leather, [0, 0, -0.08], [0.58, 0.6, 0.34]), metal(CONE, acc, [0, 0.0, 0.28], [0.16, 0.32, 0.16], [-PI / 2, 0, 0]),
            steel(CYL, iron, [0.42, 0.4, 0], [0.32, 0.3, 0.32]), glow(SPH, 0xFF8A3A, [0.42, 0.54, 0], [0.26, 0.12, 0.26])],
        }],
      };
    },
    // The bellows pump: slow breaths at rest, quick hard pumps while winding up a skill.
    anim(m, t, dt, h) {
      h._pump = (h._pump ?? 0) + dt * (2 + 10 * Math.max(h.charge ?? 0, h.castT ?? 0));
      m.x.bellows.scale.set(1, 0.82 + 0.18 * Math.abs(Math.sin(h._pump)), 1);
    },
  },

  // AIR ELEMENTAL djinn: a cloud-muscled torso on a translucent spinning tornado (no legs), pointed ears, a curling cloud
  // topknot, gold bracers with wind rings, teal wind scarves streaming behind and the storm ring circling the twister.
  cyclone: {
    plan: { hip: 1.15, tw: 1.02, th: 1.0, td: 0.6, hs: 0.47, neck: 0.1, ax: 0.76, legX: 0.2 },
    style: 'float',
    gait: { cad: 1.0, swing: 0, bob: 0.04, lean: 0.4, float: 0.45, sq: 0.03 },
    build(c) {
      const { hip, tw, th, td, top, hy, hz, hs, main, acc, gl } = c, mid = hip + th * 0.5;
      const sk = 0xA9CFE2, cloud = tint(acc, 0xB8CCE0, 0.3), cloudD = tint(main, 0xD8E8F4, 0.45), sash = 0x2E9F9A, gold = GOLD;
      const puff = (x, y, z, s, col = cloud) => cloth(ICO1, col, [x, y, z], s);
      return {
        body: [
          ...torso({ hip: hip + 0.04, th: th - 0.04, tw, td, c: sk, f: 'skin', waist: 0.58, chest: 1.12 }),
          ...both((sx) => [skin(SPH, sk, [sx * tw * 0.2, top - 0.3, td * 0.24], [tw * 0.42, 0.34, td * 0.6]), // pecs
            ...[0, 1, 2].map((k) => skin(SPH, shade(sk, 0.97), [sx * 0.09, mid - 0.04 - k * 0.15, td * 0.32 - k * 0.02], [0.16, 0.12, 0.12]))]), // abs
          ...both((sx) => [puff(sx * tw * 0.52, top - 0.02, 0, [0.5, 0.42, 0.5]), puff(sx * tw * 0.62, top - 0.18, -0.08, [0.34, 0.3, 0.34], cloudD), puff(sx * tw * 0.4, top + 0.08, -0.12, [0.3, 0.26, 0.3])]), // cloud shoulders
          ...ring(7, (k, a) => [puff(Math.sin(a) * tw * 0.36, hip + 0.06 + (k % 2) * 0.06, Math.cos(a) * td * 0.42, [0.4, 0.3, 0.4], k % 2 ? cloud : cloudD)]), // cloud waist where the twister starts
          cloth(CYL, sash, [0, hip + 0.22, 0], [tw * 0.62, 0.16, td * 0.8]), cloth(SOFT, sash, [tw * 0.2, hip + 0.16, td * 0.36], [0.2, 0.2, 0.1]),
          metal(TORUS, gold, [0, top + 0.02, hz * 0.5], [0.42, 0.42, 0.5], [PI / 2, 0, 0]), // gold torque
          skin(CYL, sk, [0, top + 0.08, hz], [0.26, 0.18, 0.26]),
          ...face({ y: hy, z: hz, s: hs, skin: sk, ears: 'elf', nose: 'long', jaw: 1.06, hair: 'buzz', hairC: cloudD, brow: 0x5A7A96, browTilt: -0.3, beard: 'moustache', beardC: cloud }),
          ...chain([[0, hy + hs * 0.44, hz - 0.06], [0, hy + hs * 0.86, hz - 0.1], [0.02, hy + hs * 1.12, hz - 0.22], [0.05, hy + hs * 1.18, hz - 0.4], [0.04, hy + hs * 1.06, hz - 0.54]], 0.14, 0.05, cloud, 'cloth'), // cloud topknot
          metal(TORUS, gold, [0, hy + hs * 0.6, hz - 0.07], [0.2, 0.2, 0.3], [PI / 2, 0, 0]),
          ...both((sx) => [metal(SPH, gold, [sx * hs * 0.6, hy - hs * 0.12, hz - 0.02], 0.06)]), // earrings
        ],
        eyes: (vc) => EYES.glow(vc, hz + hs * 0.44, hs, { gap: 0.19, w: 0.2, h: 0.09, y: 0.03, tilt: -0.15 }),
        arms: [0, 1].map(() => [ // cloud-muscled arms, gold bracers with whirling wind rings
          ...arm({ r: 0.15, fr: 0.15, up: sk, fore: sk, sh: cloud, upF: 'skin', foreF: 'skin', shF: 'cloth', hand: sk, handF: 'skin' }),
          skin(SPH, sk, [0, -0.24, 0.04], [0.34, 0.36, 0.32]), // bicep
          metal(CYL, gold, [0, -0.8, 0.06], [0.32, 0.24, 0.32]), glow(RING, tint(gl, 0x48C9B0, 0.4), [0, -0.78, 0.06], [0.5, 0.5, 0.5], [PI / 2, 0, 0]),
          ...ring(4, (k, a) => metal(BOX, TRIM, [Math.cos(a) * 0.22, -0.72, 0.06 + Math.sin(a) * 0.22], [0.03, 0.2, 0.12], [0, -a, 0])),
        ]),
        legs: 'none',
        tailAt: [0, top - 0.12, -td * 0.46],
        tail: [...both((sx) => chain([[sx * 0.18, 0, 0], [sx * 0.3, -0.2, -0.3], [sx * 0.34, -0.3, -0.7], [sx * 0.44, -0.2, -1.05], [sx * 0.5, 0.02, -1.28]], 0.09, 0.05, sx < 0 ? sash : tint(sash, 0xffffff, 0.35), 'cloth')),
          ...both((sx) => [cloth(LEAF, sash, [sx * 0.5, 0.06, -1.32], [0.16, 0.34, 0.6], [-1.0, 0, sx * 0.4])])], // wind scarves streaming behind
        extra: [{ // translucent tornado lower body
          name: 'twister', parent: 'rig', at: [0, hip - 0.02, 0],
          parts: [...[0, 1, 2, 3, 4, 5].map((k) => clear(CONE, k % 2 ? 0x8FB8D8 : 0xB8D4EA, [Math.sin(k * 1.7) * 0.07, -0.12 - k * 0.19, Math.cos(k * 1.7) * 0.07], [1.2 - k * 0.17, 0.42, 1.2 - k * 0.17], [PI, 0, 0], 'cloth')),
            clear(CONE, 0x6E98BC, [0.02, -0.66, 0.01], [0.4, 1.06, 0.4], [PI, 0, 0], 'cloth'), // denser core
            ...[0, 1, 2, 3].map((k) => cloth(WHEEL, k % 2 ? 0x8AD4D0 : 0xC8EEF0, [0, -0.12 - k * 0.24, 0], [1.0 - k * 0.2, 1.0 - k * 0.2, 1], [PI / 2 + 0.15 * (k % 2 ? 1 : -1), 0, 0.1 * k])),
            ...[0, 1, 2].map((k) => cloth(ICO1, cloud, [Math.cos(k * 2.1) * (0.36 - k * 0.08), -0.3 - k * 0.3, Math.sin(k * 2.1) * (0.36 - k * 0.08)], 0.2 - k * 0.04))],
        }, { // storm ring circling the twister
          name: 'storm', parent: 'rig', at: [0, hip - 0.36, 0],
          parts: [...ring(5, (k, a) => cloth(ICO1, k % 2 ? cloudD : cloud, [Math.cos(a) * 0.95, Math.sin(k * 2.3) * 0.08, Math.sin(a) * 0.95], [0.34, 0.24, 0.34])),
            cloth(WHEEL, 0x9ADCD8, [0, 0, 0], [1.9, 1.9, 1], [PI / 2, 0, 0.1])],
        }],
      };
    },
    // The twister spins under him; the storm ring races while moving or spinning and tilts into turns.
    anim(m, t, dt, h) {
      const mv = h.moveAmt ?? 0, sp = h.spin ?? 0;
      h._storm = (h._storm ?? 0) + dt * (1.5 + mv * 5 + sp * 10);
      const s = m.x.storm, w = m.x.twister;
      s.rotation.y = h._storm;
      s.rotation.z = Math.sin(t * 1.7) * 0.12;
      s.position.y = s.userData.y + Math.sin(t * 2.3) * 0.08;
      w.rotation.y = -h._storm * 2.2;
      w.rotation.x = -0.2 * mv;
    },
  },

  // GHOST (kid-safe): a translucent lilac wisp with no feet: round head with glowing eyes and rosy cheeks, a dark capelet and
  // crimson bow, a trailing wisp tail, a furled umbrella-rapier, and a big open parasol resting on the shoulder.
  shade: {
    plan: { hip: 1.2, tw: 0.72, th: 0.92, td: 0.5, hs: 0.52, neck: 0.0, ax: 0.5, legX: 0.18 },
    style: 'float',
    gait: { cad: 0.8, swing: 0, bob: 0.03, lean: 0.25, float: 0.5, sq: 0.02 },
    build(c) {
      const { hip, tw, th, td, top, hy, hz, hs, main, acc, gl } = c, ecto = 0xD2C0F6, ectoD = 0xA48ADE, lace = 0xF4F0F8, gilt = 0xD8B070;
      const ghostArm = asClear(arm({ r: 0.1, fr: 0.09, len: 1.0, up: ecto, fore: ecto, sh: ecto, hand: ecto, upF: 'glass', foreF: 'glass', handF: 'glass', shF: 'glass' }));
      return {
        body: [
          clear(SPH, ecto, [0, top - 0.42, 0], [tw * 1.12, th * 1.05, td * 1.4]), // teardrop body
          clear(HEAD, ecto, [0, hy, hz], [hs * 1.04, hs, hs * 0.98]), // round ghost head
          ...both((sx) => [part(SPH, 0xF2A4C0, [sx * hs * 0.27, hy - hs * 0.15, hz + hs * 0.4], [hs * 0.16, hs * 0.08, 0.02])]), // rosy cheeks
          part(SPH, 0x3A2A4A, [0, hy - hs * 0.24, hz + hs * 0.46], [hs * 0.1, hs * 0.1, 0.03]), // small 'o' mouth
          // capelet, lace collar and crimson bow
          cloth(DOME, main, [0, top - 0.18, 0], [tw * 1.2, 0.5, td * 1.5]), cloth(CYL, acc, [0, top - 0.18, 0], [tw * 1.21, 0.04, td * 1.51]),
          ...ring(10, (k, a) => [cloth(SPH, lace, [Math.sin(a) * 0.26, top + 0.04, Math.cos(a) * 0.22], [0.14, 0.08, 0.14])]),
          ...both((sx) => [cloth(SPH, acc, [sx * 0.1, top - 0.02, td * 0.42], [0.16, 0.12, 0.08], [0, 0, sx * 0.4])]), metal(SPH, gilt, [0, top - 0.02, td * 0.46], 0.06),
          ...both((sx) => [cloth(SPH, acc, [sx * 0.13, hy + hs * 0.44, hz - 0.08], [0.18, 0.12, 0.08], [0, 0, sx * 0.5])]), metal(SPH, gilt, [0, hy + hs * 0.44, hz - 0.04], 0.05), // head bow
        ],
        eyes: (vc) => EYES.glow(vc, hz + hs * 0.46, hs, { gap: 0.2, w: 0.17, h: 0.22, y: 0.04 }),
        arms: [
          [...ghostArm, cloth(CYL, lace, [0, -0.86, 0.06], [0.22, 0.08, 0.22]),
            // furled umbrella held as a rapier: crook handle, furled canopy, steel ferrule
            metal(TORUS, gilt, [0, -0.94, -0.06], [0.2, 0.2, 0.3], [0, PI / 2, 0]), rubber(CYL, 0x15121C, [0, -1.02, 0.3], [0.04, 0.5, 0.04], [PI / 2, 0, 0]),
            cloth(CONE, main, [0, -1.02, 0.88], [0.16, 0.8, 0.16], [PI / 2, 0, 0]), cloth(CONE, acc, [0, -1.02, 0.74], [0.17, 0.3, 0.17], [PI / 2, 0, 0]),
            metal(CYL, TRIM, [0, -1.02, 1.5], [0.03, 0.5, 0.03], [PI / 2, 0, 0]), glow(CONE4, gl, [0, -1.02, 1.78], [0.05, 0.14, 0.05], [PI / 2, 0, 0])],
          [...ghostArm, cloth(CYL, lace, [0, -0.86, 0.06], [0.22, 0.08, 0.22]),
            rubber(CYL, 0x15121C, [0, -0.035, -0.19], [0.04, 2.27, 0.04], [-0.29, 0, 0]), metal(TORUS, gilt, [0, -1.12, 0.14], [0.16, 0.16, 0.26], [0, PI / 2, 0])], // parasol shaft over the shoulder
        ],
        handAt: [0, -1.02, 0.35],
        legs: 'none',
        skirtAt: [0, hip + 0.06, 0],
        skirt: [clear(CONE, ecto, [0, -0.36, -0.06], [tw * 1.3, 0.92, td * 1.8], [PI + 0.3, 0, 0]), // body tapering into the wisp
          ...ring(6, (k, a) => [clear(SPH, ectoD, [Math.sin(a) * tw * 0.58, -0.12, Math.cos(a) * td * 0.82], [0.2, 0.12, 0.2])])], // soft ripple at the waist
        tailAt: [0, hip - 0.66, -0.2],
        tail: [...asClear(chain([[0, 0.06, 0], [0, -0.14, -0.3], [0, -0.16, -0.62], [0, 0.02, -0.86]], 0.18, 0.04, ectoD, 'glass')), glow(SPH, gl, [0, 0.04, -0.9], 0.05)], // curling wisp tail
        extra: [{ // parasol canopy at the top of the shaft; anim twirls it and blooms it wider on casts / stealth
          name: 'canopy', parent: 'arm1', at: [0, 1.05, -0.52],
          parts: [cloth(CONE, main, [0, 0, 0], [1.95, 0.46, 1.95]), cloth(CYL, acc, [0, -0.23, 0], [1.8, 0.02, 1.8]),
            ...ring(8, (k, a) => [cloth(SPH, k % 2 ? acc : main, [Math.cos(a) * 0.9, -0.22, Math.sin(a) * 0.9], [0.34, 0.1, 0.34]), metal(BOX, gilt, [Math.cos(a) * 0.46, 0.0, Math.sin(a) * 0.46], [0.94, 0.02, 0.02], [0, -a, -0.44]),
              glow(SPH, gl, [Math.cos(a + 0.39) * 0.95, -0.3, Math.sin(a + 0.39) * 0.95], 0.045)]),
            metal(SPH, gilt, [0, 0.26, 0], 0.09), metal(CONE, gilt, [0, 0.38, 0], [0.05, 0.16, 0.05])],
        }],
      };
    },
    // The parasol twirls on her shoulder; it blooms wider and spins fast while hidden, charging or casting.
    anim(m, t, dt, h) {
      const want = h.hidden || (h.castT ?? 0) > 0.2 || (h.charge ?? 0) > 0 ? 1 : 0;
      h._open = (h._open ?? 0) + (want - (h._open ?? 0)) * Math.min(1, dt * 9);
      const o = h._open, g = m.x.canopy;
      h._twirl = (h._twirl ?? 0) + dt * (0.6 + 7 * o);
      g.rotation.order = 'ZXY'; // twirl about the shaft, then tilt back and out over the shoulder
      g.rotation.set(-0.3, h._twirl, -0.22);
      g.scale.set(1 + 0.25 * o, 1 - 0.15 * o, 1 + 0.25 * o);
    },
  },

  // CIRCUS CAT: a striped feline acrobat: real cat head (muzzle pads, pink nose, big ears, whiskers, tiny tilted fez),
  // ruffled clown collar, cream belly, tiger stripes, digitigrade legs, long banded tail and twin hoop blades.
  pounce: {
    plan: { hip: 1.16, tw: 0.84, th: 0.95, td: 0.58, hs: 0.52, neck: 0.12, hunch: 0.3, ax: 0.56, legX: 0.2 },
    gait: { cad: 1.1, swing: 1.0, bob: 0.12, lean: 0.5, float: 0, sq: 0.06, crouch: 0.12 },
    build(c) {
      const { hip, tw, th, td, top, hy, hz, hs, main, acc, gl } = c, cream = 0xF4E6C6, stripe = 0x4A2E1E, pink = 0xE89A9A, red = 0xC8323A, mid = hip + th * 0.5;
      const tailPt = (k) => [0, -0.1 + Math.sin(k * 0.45) * 0.7 - 0.06 * k, -0.1 - k * 0.27];
      const st = (x, y, z, l, ry, rz = 0) => fur(SPH, stripe, [x, y, z], [l, 0.07, 0.05], [0, ry, rz]);
      return {
        body: [
          fur(SOFT, main, [0, hip + 0.06, 0], [tw * 0.66, 0.3, td * 0.8]),
          ...torso({ hip, th, tw, td, c: main, f: 'fur', waist: 0.64, z: 0.04 }),
          fur(HEAD, cream, [0, mid + 0.08, td * 0.3], [tw * 0.5, th * 0.7, td * 0.5]), // cream belly
          ...both((sx) => [0, 1, 2].map((k) => st(sx * tw * 0.42, mid - 0.12 + k * 0.2, -0.02, 0.26, sx * PI / 2, sx * (0.3 - k * 0.1)))).flat(), // flank stripes
          ...[0, 1, 2].map((k) => st(0, mid - 0.06 + k * 0.2, -td * 0.5, 0.36 - k * 0.04, 0, 0)), // back stripes
          // ruffled circus collar
          ...ring(12, (k, a) => [cloth(SPH, k % 2 ? red : cream, [Math.sin(a) * 0.3, top + 0.02, hz * 0.35 + Math.cos(a) * 0.26], [0.2, 0.15, 0.2])]),
          ...ring(10, (k, a) => [cloth(SPH, k % 2 ? cream : acc, [Math.sin(a) * 0.22, top + 0.1, hz * 0.4 + Math.cos(a) * 0.19], [0.14, 0.1, 0.14])]),
          fur(CYL, main, [0, top + 0.1, hz * 0.6], [0.2, 0.2, 0.2]),
          // feline head: rounded skull, muzzle pads, pink nose, chin, big ears with pink insides, forehead stripes, whiskers
          fur(HEAD, main, [0, hy + 0.02, hz], [hs * 0.98, hs * 0.86, hs * 0.9]),
          ...both((sx) => [fur(SPH, main, [sx * hs * 0.36, hy - hs * 0.1, hz + hs * 0.05], [hs * 0.3, hs * 0.34, hs * 0.4]), // cheek ruffs
            fur(SPH, cream, [sx * hs * 0.11, hy - hs * 0.2, hz + hs * 0.36], [hs * 0.26, hs * 0.2, hs * 0.22]), // muzzle pads
            fur(CONE4, main, [sx * hs * 0.3, hy + hs * 0.5, hz - hs * 0.02], [hs * 0.36, hs * 0.5, hs * 0.14], [0, 0, sx * -0.28]),
            fur(CONE4, pink, [sx * hs * 0.3, hy + hs * 0.47, hz + hs * 0.04], [hs * 0.22, hs * 0.34, hs * 0.06], [0, 0, sx * -0.28]),
            fur(CONE4, stripe, [sx * hs * 0.38, hy + hs * 0.74, hz - hs * 0.02], [hs * 0.08, hs * 0.14, hs * 0.08], [0, 0, sx * -0.28]), // ear tufts
            ...[0, 1].map((k) => part(BOX, 0xFFFFFF, [sx * hs * 0.34, hy - hs * (0.16 - k * 0.07), hz + hs * 0.38], [hs * 0.46, 0.008, 0.008], [0, sx * 0.25, sx * (0.12 - k * 0.2)])), // whiskers
            st(sx * hs * 0.42, hy + hs * 0.02, hz + hs * 0.2, hs * 0.2, sx * 1.1, sx * 0.3)]),
          fur(SPH, cream, [0, hy - hs * 0.32, hz + hs * 0.3], [hs * 0.22, hs * 0.14, hs * 0.18]), // chin
          part(SPH, pink, [0, hy - hs * 0.08, hz + hs * 0.47], [hs * 0.14, hs * 0.08, hs * 0.08]), // nose
          ...[-1, 0, 1].map((k) => st(k * hs * 0.1, hy + hs * 0.33, hz + hs * 0.33, hs * 0.05 + 0.02, 0, PI / 2 + k * 0.25)), // forehead stripes
          // tiny tilted fez
          cloth(CYL, red, [hs * 0.12, hy + hs * 0.46, hz - 0.02], [hs * 0.36, hs * 0.28, hs * 0.36], [0, 0, -0.28]), metal(CYL, GOLD, [hs * 0.1, hy + hs * 0.38, hz - 0.02], [hs * 0.38, hs * 0.05, hs * 0.38], [0, 0, -0.28]),
          ...chain([[hs * 0.16, hy + hs * 0.62, hz - 0.02], [hs * 0.3, hy + hs * 0.56, hz - 0.04], [hs * 0.34, hy + hs * 0.38, hz - 0.04]], 0.02, 0.02, GOLD, 'metal'), glow(SPH, gl, [hs * 0.34, hy + hs * 0.36, hz - 0.04], 0.04),
        ],
        eyes: (vc) => EYES.slit(vc, hz + hs * 0.4, hs, { gap: 0.22, y: 0.08, w: 0.22, h: 0.17, tilt: -0.3, base: 0xC8E070 }),
        arms: [0, 1].map(() => [ // striped furred arms, teal wraps, paws, a gold acrobat hoop-blade in each hand
          ...arm({ r: 0.12, up: main, fore: main, hand: cream, sh: main, upF: 'fur', foreF: 'fur', handF: 'fur', paw: true }), cloth(CYL, acc, [0, -0.86, 0.07], [0.27, 0.14, 0.27]),
          ...[0, 1].map((k) => fur(SPH, stripe, [0, -0.26 - k * 0.22, 0.11], [0.22, 0.06, 0.05], [0, 0, 0.2])),
          metal(RING, GOLD, [0, -1.08, 0.38], [0.72, 0.72, 1.4], [0, PI / 2, 0]), glow(RING, gl, [0, -1.08, 0.38], [0.62, 0.62, 0.6], [0, PI / 2, 0]),
          ...ring(4, (k, a) => metal(CONE4, TRIM, [0, -1.08 + Math.sin(a) * 0.38, 0.38 + Math.cos(a) * 0.38], [0.05, 0.14, 0.05], [a, 0, 0])),
        ]),
        legDigi: { r: 0.13, thigh: main, shin: main, paw: cream, claw: 0xF4F0E8 },
        legExtra: (H) => [...[0, 1].map((k) => fur(SPH, stripe, [0, -H * (0.22 + k * 0.14), 0.22 - k * 0.02], [0.26, 0.06, 0.05], [0.3, 0, 0.2])), cloth(CYL, acc, [0, -H * 0.8, -0.12], [0.24, 0.1, 0.24])],
        skirt: [cloth(RBOX, red, [0.18, -0.3, -0.04], [0.18, 0.6, 0.03], [0.06, 0, 0.12]), cloth(RBOX, GOLD, [0.26, -0.36, -0.03], [0.12, 0.66, 0.02], [0.06, 0, 0.2])], // sash tails
        tailAt: [0, hip + 0.06, -td * 0.42],
        tail: [ // long tail curling up, banded tip
          ...[0, 1, 2, 3, 4, 5].map((k) => seg(tailPt(k), tailPt(k + 1), 0.11 - k * 0.008, k > 2 && k % 2 ? stripe : main, 'fur')),
          fur(SPH, stripe, tailPt(6), 0.2),
        ],
      };
    },
    // Low prowl while a skill coils up (the cat crouches before the jump), tail held high when idle.
    anim(m, t, dt, h) {
      m.lean.rotation.x += 0.25 * (h.charge ?? 0);
      m.tail.rotation.x = -0.3 * (1 - (h.moveAmt ?? 0)) + Math.sin(t * 2) * 0.08;
    },
  },

  // COSMIC ELEMENTAL: a floating figure of night sky: dark body dotted with stars and constellation lines, a bright star
  // core, a stardust trail instead of legs, a streaming comet-tail mane, an orrery staff and three orbiting comets.
  comet: {
    plan: { hip: 1.2, tw: 0.8, th: 1.0, td: 0.5, hs: 0.42, neck: 0.12, ax: 0.6, legX: 0.18 },
    style: 'float',
    gait: { cad: 0.9, swing: 0, bob: 0.05, lean: 0.3, float: 0.5, sq: 0.03 },
    build(c) {
      const { hip, tw, th, td, top, hy, hz, hs, main, acc, gl } = c, mid = hip + th * 0.5;
      const night = shade(main, 0.62), nightL = shade(main, 0.95), gold = 0xFFF2B0, star = 0xF4F8FF, silver = acc;
      const R = rng(7), stars = (n, cx, cy, cz, rx, ry, rz) => Array.from({ length: n }, () => {
        const a = R() * PI * 2, y = (R() - 0.5) * 2 * ry, k = Math.sqrt(Math.max(0, 1 - (y / ry) ** 2));
        return glow(SPH, R() > 0.75 ? gold : star, [cx + Math.sin(a) * rx * k, cy + y, cz + Math.cos(a) * rz * k], 0.025 + R() * 0.03);
      });
      return {
        body: [
          ...torso({ hip, th, tw, td, c: night, f: 'paint', waist: 0.6, chest: 1.0 }),
          ...stars(26, 0, mid + 0.1, 0, tw * 0.48, th * 0.42, td * 0.56),
          ...[[-0.18, 0.32, 0.5], [0.1, 0.12, -0.6], [0.2, 0.38, 1.0], [-0.08, -0.08, -0.3]].map(([x, y, r]) => glow(BOX, tint(gl, 0x1E2A5A, 0.4), [x, mid + y, td * 0.5], [0.24, 0.01, 0.01], [0, 0, r])), // constellation lines
          glow(OCT, gold, [0, mid + 0.22, td * 0.5], [0.14, 0.2, 0.08]), clear(SPH, gl, [0, mid + 0.22, td * 0.46], 0.3, undefined, 'glow'), // star core
          ...both((sx) => [part(SPH, nightL, [sx * tw * 0.5, top - 0.06, 0], [0.34, 0.3, 0.36]), glow(SPH, star, [sx * tw * 0.54, top + 0.06, 0.08], 0.04)]),
          part(CYL, night, [0, top + 0.08, hz], [0.22, 0.2, 0.22]),
          // smooth night-sky head with a star diadem
          part(HEAD, night, [0, hy, hz], [hs * 0.9, hs * 1.02, hs * 0.94]),
          ...stars(8, 0, hy + hs * 0.1, hz, hs * 0.44, hs * 0.36, hs * 0.46).filter((q) => q.p[2] < hz + hs * 0.2 || q.p[1] > hy + hs * 0.25),
          glow(OCT, gold, [0, hy + hs * 0.36, hz + hs * 0.4], [0.1, 0.18, 0.05]), ...both((sx) => [glow(OCT, gl, [sx * hs * 0.2, hy + hs * 0.32, hz + hs * 0.36], [0.05, 0.1, 0.04], [0, 0, sx * -0.4])]),
        ],
        eyes: (vc) => EYES.glow(vc, hz + hs * 0.45, hs, { gap: 0.2, w: 0.22, h: 0.1, y: 0.02, tilt: -0.1 }),
        arms: [
          [...arm({ r: 0.1, up: night, fore: night, sh: nightL, hand: gl, upF: 'paint', foreF: 'paint', handF: 'glow' }), ...stars(4, 0, -0.5, 0.04, 0.1, 0.3, 0.1),
            metal(CYL, silver, [0, -0.48, 0.18], [0.05, 2.3, 0.05], [0.08, 0, 0]), metal(CONE, silver, [0, -1.62, 0.1], [0.08, 0.2, 0.08], [PI, 0, 0])], // orrery staff (rings are their own group)
          [...arm({ r: 0.1, up: night, fore: night, sh: nightL, hand: gl, upF: 'paint', foreF: 'paint', handF: 'glow' }), ...stars(4, 0, -0.5, 0.04, 0.1, 0.3, 0.1),
            glow(OCT, gold, [0, -1.22, 0.12], [0.16, 0.16, 0.16]), clear(SPH, gl, [0, -1.22, 0.12], 0.34, undefined, 'glow')],
        ],
        legs: 'none',
        skirtAt: [0, hip + 0.06, 0],
        skirt: [part(CONE, night, [0, -0.52, -0.04], [tw * 0.86, 1.1, td * 1.2], [PI - 0.12, 0, 0]), // stardust trail tapering down
          clear(CONE, 0x3A5AB8, [0, -0.5, -0.06], [tw * 1.0, 1.18, td * 1.36], [PI - 0.12, 0, 0], 'glow'),
          ...stars(10, 0, -0.36, -0.02, tw * 0.3, 0.3, td * 0.4)],
        tailAt: [0, hy + hs * 0.22, hz - hs * 0.32],
        tail: [ // streaming comet-tail mane: translucent blue flame cones sweeping down the back like a cape, cyan core, gold sparks
          ...[-1, 0, 1].map((k) => clear(CONE, k ? 0x3A62D8 : 0x4C86F0, [k * 0.22, -0.52 - Math.abs(k) * 0.08, -0.92], [0.7 - Math.abs(k) * 0.14, 2.1 - Math.abs(k) * 0.4, 0.5], [-2.05, 0, k * 0.32], 'paint')),
          ...[-1, 0, 1].map((k) => part(CONE, k ? 0x56C4FF : 0x8FE0FF, [k * 0.12, -0.28, -0.52], [0.3, 1.16 - Math.abs(k) * 0.24, 0.24], [-2.0, 0, k * 0.3])),
          ...[[0.08, -0.82, -1.4, 0.1], [-0.16, -1.0, -1.6, 0.08], [0.2, -1.16, -1.74, 0.07], [-0.04, -1.34, -1.9, 0.06]].map(([x, y, z, r]) => glow(OCT, 0xFFD870, [x, y, z], r)),
        ],
        extra: [{ // armillary rings atop the staff
          name: 'orrery', parent: 'arm0', at: [0, 0.72, 0.28],
          parts: [metal(RING, silver, [0, 0, 0], [0.62, 0.62, 0.62]), metal(RING, 0xD8B070, [0, 0, 0], [0.5, 0.5, 0.5], [PI / 2, 0, 0]), glow(RING, gl, [0, 0, 0], [0.4, 0.4, 0.6], [0.6, 0.6, 0]), glow(SPH, gold, [0, 0, 0], 0.16)],
        }],
        halo: [ // three small icy comets with tails orbiting the head
          ...ring(3, (k, a) => stone(ICO1, 0xBFD8F0, [Math.cos(a) * 1.15, 2.95 + (k % 2) * 0.2, Math.sin(a) * 1.15], 0.18)),
          ...ring(3, (k, a) => glow(CONE, k % 2 ? gl : tint(gl, gold, 0.6), [Math.cos(a - 0.3) * 1.15, 2.95 + (k % 2) * 0.2, Math.sin(a - 0.3) * 1.15], [0.12, 0.5, 0.12], [0, -a, PI / 2])),
        ],
      };
    },
    anim(m, t, dt, h) {
      const o = m.x.orrery, sp = 1 + 4 * Math.max(h.charge ?? 0, h.castT ?? 0);
      o.rotation.y += dt * 1.2 * sp; o.rotation.x += dt * 0.7 * sp;
    },
  },

  // MUSHROOM FOLK: the cap IS the head: a wide spotted cap over a stem-top face, a thick fibrous stem body with a frilly
  // annulus ring, stubby stem limbs, a skirt of glowing mycelium roots, puffballs on the shoulders and back, a mushroom staff.
  mycel: {
    plan: { hip: 0.84, tw: 0.96, th: 1.16, td: 0.82, hs: 0.5, neck: 0, ax: 0.6, legX: 0.24, hy: 2.12, hz: 0.04 },
    gait: { cad: 0.8, swing: 0.5, bob: 0.1, lean: 0.12, float: 0, sq: 0.12, sway: 0.1 },
    build(c) {
      const { hip, tw, th, td, top, hy, hz, main, acc, gl } = c, stem = acc, stemD = shade(acc, 0.86), root = 0x8A7A64, puffC = 0xEDE4D0, gill = 0xE0C8B0, mid = hip + th * 0.5;
      const shroom = (x, y, z, s, cap = main) => [part(CYL, stem, [x, y, z], [s * 0.3, s * 0.6, s * 0.3], undefined, 'skin'), part(DOME, cap, [x, y + s * 0.28, z], [s, s * 0.6, s]), glow(CYL, gl, [x, y + s * 0.27, z], [s * 0.8, 0.01, s * 0.8])];
      const puffball = (x, y, z, s) => [part(SPH, puffC, [x, y, z], [s, s * 0.9, s], undefined, 'skin'), ...[0, 1, 2].map((k) => part(SPH, shade(puffC, 0.8), [x + Math.cos(k * 2.1) * s * 0.3, y + s * 0.3, z + Math.sin(k * 2.1) * s * 0.3], s * 0.12))];
      return {
        body: [
          skin(SPH, stem, [0, hip + 0.3, 0], [tw * 1.06, 0.86, td * 1.06]), // bulbous stem base
          skin(CYL, stem, [0, mid + 0.18, 0], [tw * 0.78, th * 0.82, td * 0.8]), // fibrous stem
          skin(SPH, stem, [0, top - 0.06, hz], [tw * 0.8, 0.46, td * 0.82]),
          ...ring(10, (k, a) => [part(BOX, stemD, [Math.sin(a) * tw * 0.39, mid + 0.2, Math.cos(a) * td * 0.4], [0.02, th * 0.6, 0.02], [0, a, 0], 'skin')]), // stem fibres
          ...ring(12, (k, a) => [cloth(SPH, k % 2 ? gill : stem, [Math.sin(a) * tw * 0.46, mid + 0.36, Math.cos(a) * td * 0.47], [0.24, 0.1, 0.24])]), // frilly annulus
          ...[[-0.18, 0.0, 0.6], [0.12, -0.2, -0.4], [0.24, 0.1, 0.2], [-0.06, -0.3, 1.1]].map(([x, y, r]) => glow(BOX, gl, [x, mid + y, td * 0.41], [0.24, 0.012, 0.01], [0, 0, r])), // mycelium threads
          // stem-top face under the cap
          skin(HEAD, stem, [0, hy, hz + 0.02], [0.66, 0.56, 0.62]),
          ...both((sx) => [part(SPH, 0xF0A8A0, [sx * 0.18, hy - 0.1, hz + 0.3], [0.11, 0.05, 0.02])]), // blush
          part(SPH, 0x5A3A30, [0, hy - 0.14, hz + 0.31], [0.08, 0.03, 0.02]), // small smile
          ...puffball(-tw * 0.44, top + 0.02, 0.06, 0.3), ...puffball(-tw * 0.32, top - 0.02, 0.24, 0.18), ...puffball(tw * 0.44, top, -0.02, 0.22), // shoulder puffballs
        ],
        eyes: (vc) => EYES.bead(vc, hz + 0.31, 0.5, { gap: 0.26, y: 0.02, w: 0.17, h: 0.19 }),
        arms: [
          [...arm({ r: 0.13, fr: 0.12, len: 0.96, up: 0xCDB898, fore: 0xCDB898, sh: 0xB8A280, hand: 0xA89272, upF: 'skin', foreF: 'skin', shF: 'skin', handF: 'skin' }),
            // gnarled staff with a cluster of glowing mushrooms
            stone(CYL, 0x5A4632, [0, -0.6, 0.18], [0.08, 2.2, 0.08], [0.1, 0.0, 0.05]), stone(SPH, 0x5A4632, [0, -1.3, 0.12], 0.14),
            ...shroom(0.02, 0.5, 0.3, 0.42), ...shroom(-0.16, 0.32, 0.26, 0.26, tint(main, 0xffffff, 0.15)), ...shroom(0.16, 0.36, 0.34, 0.2, 0x9C4A3A)],
          [...arm({ r: 0.13, fr: 0.12, len: 0.96, up: 0xCDB898, fore: 0xCDB898, sh: 0xB8A280, hand: 0xA89272, upF: 'skin', foreF: 'skin', shF: 'skin', handF: 'skin' }),
            ...puffball(0, -1.14, 0.18, 0.24), clear(SPH, gl, [0, -1.0, 0.18], 0.3, undefined, 'glow')], // a puffball about to pop
        ],
        handAt: [0, -1.02, 0.35],
        leg: { r: 0.15, thigh: stem, shin: stemD, thighF: 'skin', shinF: 'skin', boot: null },
        legExtra: (H) => [skin(SPH, stemD, [0, -H + 0.1, 0.04], [0.36, 0.2, 0.4]), ...[-1, 0, 1].map((t) => stone(CONE4, root, [t * 0.11, -H + 0.05, 0.22 + Math.abs(t) * -0.04], [0.06, 0.24, 0.06], [PI / 2 + 0.3, t * 0.4, 0]))], // root toes
        skirtAt: [0, hip + 0.06, 0],
        skirt: [ // mycelium root-skirt spreading to the ground, glowing tips
          ...ring(11, (k, a) => { const r0 = 0.44 + (k % 2) * 0.04, y1 = -0.8 + (k % 3) * 0.04;
            return [...chain([[Math.sin(a) * r0, 0, Math.cos(a) * r0 * 0.9], [Math.sin(a) * 0.64, -0.42, Math.cos(a) * 0.58], [Math.sin(a + 0.12) * 0.9, y1 + 0.06, Math.cos(a + 0.12) * 0.82], [Math.sin(a + 0.25) * 1.08, y1 - 0.02, Math.cos(a + 0.25) * 0.98]], 0.05, 0.02, root, 'stone'),
              glow(SPH, gl, [Math.sin(a + 0.25) * 1.1, y1 - 0.02, Math.cos(a + 0.25) * 1.0], 0.05)]; }),
          ...shroom(-0.5, -0.78, 0.36, 0.14, 0xE8E0C8), ...shroom(0.44, -0.8, -0.42, 0.18),
        ],
        tailAt: [0, hip + 0.56, -td * 0.42],
        tail: [...puffball(0, 0, -0.2, 0.44), ...puffball(-0.28, -0.24, -0.1, 0.28), ...puffball(0.26, 0.2, -0.12, 0.24), glow(SPH, gl, [0.2, -0.2, -0.36], 0.08)], // puffball cluster on the back
        extra: [{ // the wide spotted cap that is his head
          name: 'cap', parent: 'lean', at: [0, hy + 0.16, hz - 0.02],
          parts: [part(DOME, main, [0, 0, 0], [1.72, 0.92, 1.72]), part(SPH, shade(main, 0.85), [0, 0.02, 0], [1.74, 0.12, 1.74]), cloth(CYL, gill, [0, -0.01, 0], [1.66, 0.03, 1.66]),
            ...ring(16, (k, a) => cloth(BOX, shade(gill, 0.82), [Math.cos(a) * 0.48, -0.03, Math.sin(a) * 0.48], [0.62, 0.02, 0.012], [0, -a, 0])),
            ...[[0.36, 0.26, 0.14], [-0.3, 0.3, 0.28], [0.06, 0.42, -0.34], [-0.5, 0.14, -0.26], [0.52, 0.14, -0.38], [0, 0.46, 0.1], [0.18, 0.2, 0.6], [-0.2, 0.12, 0.66]].map(([x, y, z]) => cloth(SPH, 0xFAF4E6, [x, y, z], [0.26, 0.08, 0.26], [z * 1.2, 0, -x * 1.2])),
            ...ring(10, (k, a) => glow(SPH, gl, [Math.cos(a) * 0.8, -0.04, Math.sin(a) * 0.8], 0.045))],
        }],
      };
    },
    // The cap breathes; a cast makes it puff (squash and stretch) like a mushroom letting go of spores.
    anim(m, t, dt, h) {
      const p = (h.castT ?? 0) > 0 ? Math.sin(PI * h.castT) : 0, b = Math.sin(t * 1.8) * 0.03;
      m.x.cap.scale.set(1 + b + 0.18 * p, 1 - b - 0.25 * p + 0.2 * (h.charge ?? 0), 1 + b + 0.18 * p);
    },
  },

  // MERFOLK whaler: teal scaled skin, fin ears and a head fin, gill slits, big round eyes, an open yellow oilskin with a
  // fish-fluke coat tail, scaled forearms with fins, finned calves and webbed flipper feet, the harpoon gun and rope reel.
  harpoon: {
    plan: { hip: 1.22, tw: 0.98, th: 1.06, td: 0.66, hs: 0.48, neck: 0.12, ax: 0.74, legX: 0.22 },
    gait: { cad: 0.95, swing: 0.85, bob: 0.14, lean: 0.12, float: 0, sq: 0.08, sway: 0.14 },
    build(c) {
      const { hip, tw, th, td, top, hy, hz, hs, main, acc, gl } = c, mid = hip + th * 0.5;
      const sk = 0x58A8A0, skD = 0x3E7E7A, bellyC = 0xBFE4D4, finC = 0x3E8FB8, navy = acc;
      const scales = (cx, cy, cz, cols, rows, dx, dy, col = skD) => Array.from({ length: cols * rows }, (_, i) => {
        const r = Math.floor(i / cols), k = i % cols;
        return part(SPH, col, [cx + (k - (cols - 1) / 2) * dx + (r % 2) * dx * 0.5, cy - r * dy, cz], [dx * 0.9, dy * 1.2, 0.03], undefined, 'skin');
      });
      const fin = (p, s, r) => part(FAN, finC, p, s, r, 'skin');
      return {
        body: [
          rubber(CYL, navy, [0, hip + 0.06, 0], [tw * 0.68, 0.3, td * 0.8]),
          ...torso({ hip, th, tw, td, c: main, f: 'rubber', waist: 0.84 }), // bulky open oilskin
          skin(HEAD, bellyC, [0, mid + 0.14, td * 0.3], [tw * 0.4, th * 0.8, td * 0.4]), // scaled chest in the open coat
          ...scales(0, mid + 0.46, td * 0.5, 3, 4, 0.1, 0.12, tint(bellyC, sk, 0.4)),
          ...both((sx) => [rubber(RBOX, shade(main, 0.85), [sx * tw * 0.2, mid + 0.18, td * 0.46], [0.12, th * 0.72, 0.05], [0.04, sx * 0.3, sx * -0.1]),
            ...[0, 1, 2].map((k) => stone(RBOX, 0xE8DCC0, [sx * tw * 0.26, hip + 0.4 + k * 0.2, td * 0.5], [0.06, 0.12, 0.05], [0, 0, PI / 2]))]), // lapels + toggles
          ...ring(9, (k) => cloth(TORUS, ROPE, [-tw * 0.36 + k * tw * 0.09, mid + 0.36 - k * 0.1, td * 0.52 - Math.abs(k - 4) * 0.02], [0.14, 0.14, 0.18], [0.3, 0.9, 0.7])), // rope bandolier
          skin(CYL, sk, [0, top + 0.08, hz], [0.28, 0.24, 0.28]),
          ...both((sx) => [0, 1, 2].map((k) => part(BOX, skD, [sx * 0.13, top + 0.04 + k * 0.05, hz + 0.04], [0.012, 0.025, 0.1], [0, sx * 0.6, 0]))).flat(), // gill slits
          cloth(TORUS, navy, [0, top + 0.02, hz * 0.5], [0.44, 0.44, 0.5], [PI / 2, 0, 0]), // knit collar
          ...face({ y: hy, z: hz, s: hs, skin: sk, ears: 'fin', nose: 'snub', jaw: 1.06, brow: skD, browTilt: -0.05 }),
          ...scales(0, hy + hs * 0.3, hz + hs * 0.38, 3, 1, 0.07, 0.06), ...both((sx) => scales(sx * hs * 0.32, hy - hs * 0.02, hz + hs * 0.33, 2, 2, 0.05, 0.05)),
          fin([0, hy + hs * 0.32, hz - 0.04], [0.56, 1, 0.8], [0, 0, PI / 2]), // head fin
          ...[-0.12, 0, 0.12].map((dz) => part(BOX, shade(finC, 0.7), [0, hy + hs * 0.46, hz - 0.04 + dz], [0.012, hs * 0.5, 0.012], [dz * 2, 0, 0], 'skin')),
        ],
        eyes: (vc) => EYES.human(vc, hz + hs * 0.44, hs, { gap: 0.21, w: 0.23, h: 0.18, y: 0.03 }),
        arms: [
          [...arm({ r: 0.12, fr: 0.12, up: main, fore: sk, sh: shade(main, 0.88), hand: sk, upF: 'rubber', shF: 'rubber', foreF: 'skin', handF: 'skin' }), rubber(CYL, main, [0, -0.5, 0.03], [0.36, 0.14, 0.36]),
            ...scales(0, -0.62, 0.14, 2, 3, 0.07, 0.09), fin([0, -0.72, -0.1], [0.34, 1, 0.5], [-PI / 2, 0, PI / 2]),
            // harpoon gun: wooden stock, brass barrel, barbed glowing head, side rope drum
            wood(RBOX, WOOD, [0, -1.0, 0.36], [0.18, 0.24, 0.8]), metal(CYL, BRASS, [0, -0.94, 1.0], [0.16, 0.9, 0.16], [PI / 2, 0, 0]),
            steel(CYL, TRIM, [0, -0.94, 1.6], [0.04, 0.5, 0.04], [PI / 2, 0, 0]), steel(CONE4, TRIM, [0, -0.94, 1.92], [0.16, 0.26, 0.05], [PI / 2, 0, 0]),
            ...both((sx) => [steel(CONE4, TRIM, [sx * 0.08, -0.94, 1.78], [0.04, 0.16, 0.04], [PI / 2 + 0.6, 0, sx * 0.5])]), glow(CONE4, gl, [0, -0.94, 1.94], [0.07, 0.2, 0.03], [PI / 2, 0, 0]),
            wood(CYL, WOOD, [0.16, -0.92, 0.5], [0.24, 0.12, 0.24], [0, 0, PI / 2]), cloth(TORUS, ROPE, [0.2, -0.92, 0.5], [0.22, 0.22, 0.4], [0, PI / 2, 0])],
          [...arm({ r: 0.12, fr: 0.12, up: main, fore: sk, sh: shade(main, 0.88), hand: sk, upF: 'rubber', shF: 'rubber', foreF: 'skin', handF: 'skin' }), rubber(CYL, main, [0, -0.5, 0.03], [0.36, 0.14, 0.36]),
            ...scales(0, -0.62, 0.14, 2, 3, 0.07, 0.09), fin([0, -0.72, -0.1], [0.34, 1, 0.5], [-PI / 2, 0, PI / 2]),
            part(FAN, tint(finC, 0xffffff, 0.3), [0, -1.06, 0.12], [0.3, 1, 0.3], [0, PI / 2, 0], 'skin')], // webbed hand
        ],
        leg: { r: 0.14, thigh: navy, shin: sk, thighF: 'rubber', shinF: 'skin', boot: null },
        legExtra: (H) => [rubber(CYL, navy, [0, -H * 0.5, 0.05], [0.36, 0.12, 0.36]), ...scales(0, -H * 0.6, 0.14, 2, 2, 0.07, 0.08),
          fin([0, -H * 0.7, -0.1], [0.5, 1, 0.8], [-PI / 2, 0, PI / 2]), // calf fin
          skin(SOFT, sk, [0, -H + 0.06, 0.16], [0.3, 0.1, 0.46]), part(FAN, finC, [0, -H + 0.04, 0.34], [0.5, 1, 0.36], [0, 0, 0], 'skin')], // webbed flipper foot
        skirt: [...both((sx) => [rubber(SOFT, main, [sx * 0.27, -0.32, -0.02], [0.38, 0.64, 0.08], [0.06, sx * -0.25, sx * 0.12])]),
          rubber(SOFT, main, [0, -0.36, -td - 0.02], [tw * 0.8, 0.7, 0.08], [-0.12, 0, 0]), // coat back
          ...both((sx) => [rubber(CONE4, shade(main, 0.9), [sx * 0.2, -0.86, -td - 0.06], [0.34, 0.56, 0.05], [-0.1, 0, -sx * (PI - 0.7)])])], // fish-fluke coat tail
        extra: [{ // whaling reel and spare harpoons on the back
          name: 'reel', parent: 'lean', at: [0, mid + 0.1, -td * 0.62],
          parts: [wood(CYL, WOOD, [0, 0, 0], [0.86, 0.5, 0.86], [0, 0, PI / 2]), ...[-0.16, 0, 0.16].map((x) => cloth(TORUS, ROPE, [x, 0, 0], [0.82, 0.82, 0.6], [0, PI / 2, 0])),
            ...both((sx) => [metal(CYL, BRASS, [sx * 0.28, 0, 0], [0.92, 0.04, 0.92], [0, 0, PI / 2])])],
        }, {
          name: 'spares', parent: 'lean', at: [0.18, mid + 0.4, -td * 0.7],
          parts: [...[-0.12, 0.12].flatMap((x) => [steel(CYL, TRIM, [x, 0.5, 0], [0.04, 1.6, 0.04], [-0.15, 0, x]), steel(CONE4, TRIM, [x + x * 0.4, 1.32, -0.12], [0.1, 0.2, 0.04], [-0.15, 0, x])])],
        }],
      };
    },
    // The reel winds whenever the gun fires or a skill goes off.
    anim(m, t, dt, h) {
      m.x.reel.rotation.x -= dt * (0.3 + 12 * Math.max(h.atkT ?? 0, h.castT ?? 0));
    },
  },

  // INSECTOID weaver: a spider-person in glossy indigo chitin: cluster of eight glowing eyes, small mandibles, a silk shawl,
  // four jointed spider legs arching off the back, a striped abdomen with a glowing spinneret, and the long needle rifle.
  loom: {
    plan: { hip: 1.4, tw: 0.72, th: 1.0, td: 0.5, hs: 0.42, neck: 0.1, hunch: 0.12, ax: 0.52, legX: 0.18 },
    gait: { cad: 1.0, swing: 0.78, bob: 0.05, lean: 0.25, float: 0, sq: 0.03, crouch: 0.06 },
    build(c) {
      const { hip, tw, th, td, top, hy, hz, hs, main, acc, gl } = c, mid = hip + th * 0.5, chit = main, chitD = shade(main, 0.6), chitL = tint(main, 0x8090D0, 0.25), silk = 0xF4F0FF;
      const bobbin = (x, y, z, s, col) => [wood(CYL, WOOD, [x, y, z], [s * 0.5, s * 1.3, s * 0.5]), cloth(CYL, col, [x, y, z], [s * 0.8, s * 0.8, s * 0.8]), wood(CYL, WOOD, [x, y + s * 0.62, z], [s, s * 0.1, s]), wood(CYL, WOOD, [x, y - s * 0.62, z], [s, s * 0.1, s])];
      const spiderLeg = (sx, y0, spread, z0) => { // root -> knee (up and out) -> tip (down and out)
        const r = [sx * 0.1, y0, z0], k = [sx * (0.5 + spread * 0.2), y0 + 0.5 - spread * 0.1, z0 - 0.2], f = [sx * (0.86 + spread * 0.3), y0 - 0.42 - spread * 0.1, z0 - 0.3 + spread * 0.1];
        return [seg(r, k, 0.055, chit, 'metal'), part(SPH, acc, k, 0.11, undefined, 'metal'), seg(k, f, 0.045, chitD, 'metal'), part(CONE, acc, [f[0] + sx * 0.02, f[1] - 0.06, f[2]], [0.05, 0.16, 0.05], [0, 0, PI + sx * 0.3], 'metal')];
      };
      return {
        body: [
          metal(SPH, chitD, [0, hip + 0.06, 0], [tw * 0.6, 0.3, td * 0.7]),
          ...asF(torso({ hip, th, tw, td, c: chit, waist: 0.5, chest: 0.98 }), 'metal'), // glossy chitin thorax
          ...[0, 1, 2].map((k) => metal(TORUS, acc, [0, hip + 0.3 + k * 0.12, 0], [tw * (0.36 + k * 0.08), tw * (0.36 + k * 0.08), 0.4], [PI / 2, 0, 0])), // segment bands at the wasp waist
          metal(HEAD, chitL, [0, mid + 0.24, td * 0.26], [tw * 0.6, th * 0.5, td * 0.5]), // sternum plate
          // silk weaver's shawl
          ...both((sx) => [cloth(SOFT, silk, [sx * tw * 0.3, top - 0.04, 0.02], [tw * 0.5, 0.18, td * 1.1], [0, 0, sx * -0.3]), cloth(RBOX, silk, [sx * 0.14, mid + 0.18, td * 0.46], [0.1, th * 0.6, 0.04], [0.06, 0, sx * -0.3])]),
          glow(BOX, gl, [0, mid + 0.18, td * 0.5], [0.008, th * 0.5, 0.008]),
          metal(CYL, chitD, [0, top + 0.08, hz], [0.2, 0.2, 0.2]),
          // chitin head: domed skull, paler face plate, small curved mandibles, pedipalp nubs
          metal(HEAD, chit, [0, hy + 0.04, hz - 0.02], [hs * 0.96, hs * 0.92, hs]),
          metal(HEAD, chitL, [0, hy - hs * 0.06, hz + hs * 0.12], [hs * 0.72, hs * 0.66, hs * 0.76]),
          ...both((sx) => [metal(CONE, acc, [sx * hs * 0.12, hy - hs * 0.4, hz + hs * 0.36], [hs * 0.09, hs * 0.24, hs * 0.09], [0.2, 0, sx * -0.35]),
            metal(SPH, chitD, [sx * hs * 0.22, hy - hs * 0.3, hz + hs * 0.3], hs * 0.13)]),
          ...[-1, 0, 1].map((k) => metal(BOX, acc, [k * hs * 0.14, hy + hs * 0.36, hz + hs * 0.3], [0.03, 0.12, 0.03], [-0.6, 0, k * 0.3])), // head bristles
        ],
        eyes: (vc) => both((sx) => [part(SPH, vc, [sx * hs * 0.13, hs * 0.02, hz + hs * 0.46], [hs * 0.22, hs * 0.22, hs * 0.08]), part(SPH, 0x14161C, [sx * hs * 0.13, hs * 0.0, hz + hs * 0.5], [hs * 0.1, hs * 0.1, hs * 0.04]),
          part(SPH, vc, [sx * hs * 0.32, hs * 0.12, hz + hs * 0.36], [hs * 0.12, hs * 0.12, hs * 0.06]), part(SPH, vc, [sx * hs * 0.08, hs * 0.24, hz + hs * 0.44], [hs * 0.1, hs * 0.1, hs * 0.05]),
          part(SPH, vc, [sx * hs * 0.24, hs * 0.3, hz + hs * 0.36], [hs * 0.08, hs * 0.08, hs * 0.05])]), // eight eyes
        arms: [
          [...asF(arm({ r: 0.1, up: chit, fore: chitD, sh: chitL, hand: chitD }), 'metal'), ...[0, 1, 2].map((k) => metal(CYL, k % 2 ? acc : chitL, [0, -0.5 - k * 0.12, 0.05], [0.22, 0.04, 0.22])),
            // needle rifle: a long weaving-shuttle body, a needle barrel, a spool on top
            wood(OCT, WOOD, [0, -1.0, 0.6], [0.2, 1.2, 0.2], [PI / 2, 0, 0]), metal(BOX, BRASS, [0, -1.0, 0.6], [0.22, 0.04, 0.9]),
            steel(CYL, TRIM, [0, -1.0, 1.55], [0.03, 1.1, 0.03], [PI / 2, 0, 0]), glow(CONE4, gl, [0, -1.0, 2.14], [0.04, 0.12, 0.04], [PI / 2, 0, 0]),
            ...bobbin(0, -0.82, 0.5, 0.1, 0xF59BFF).map((q) => ({ ...q, r: [PI / 2, 0, 0] })), glow(BOX, gl, [0, -0.86, 1.2], [0.006, 0.006, 1.3])],
          [...asF(arm({ r: 0.1, up: chit, fore: chitD, sh: chitL, hand: chitD }), 'metal'), ...[0, 1, 2].map((k) => metal(CYL, k % 2 ? acc : chitL, [0, -0.5 - k * 0.12, 0.05], [0.22, 0.04, 0.22])),
            ...bobbin(0, -1.1, 0.16, 0.12, 0x9BE8FF)],
        ],
        legDigi: { r: 0.1, thigh: chit, shin: chitD, paw: chitD, claw: acc, thighF: 'metal', shinF: 'metal', pawF: 'metal' },
        legExtra: (H) => [metal(CYL, acc, [0, -H * 0.38, 0.2], [0.22, 0.05, 0.22]), metal(CYL, acc, [0, -H * 0.78, -0.16], [0.18, 0.04, 0.18])],
        skirt: [...[-1, 0, 1].map((k) => cloth(RBOX, k ? silk : acc, [k * 0.16, -0.38, -0.02 - Math.abs(k) * 0.04], [0.16, 0.74, 0.03], [0.05, k * -0.2, k * 0.05])),
          ...[-1, 0, 1].map((k) => cloth(CONE4, acc, [k * 0.16, -0.8, -0.02], [0.07, 0.12, 0.04], [PI, 0, 0]))],
        tailAt: [0, hip + 0.2, -td * 0.4],
        tail: [ // striped abdomen with a glowing spinneret and a silk line
          metal(SPH, chit, [0, 0.06, -0.48], [0.78, 0.7, 0.96]),
          ...[0, 1, 2].map((k) => metal(LEAF, acc, [0, [0.41, 0.43, 0.4][k], -0.3 - k * 0.2], [0.34 - k * 0.06, 0.18, 0.6], [PI / 2 - 0.3 - k * 0.25, 0, 0])), // chevron markings
          metal(SPH, chitL, [0, -0.14, -0.4], [0.5, 0.36, 0.7]),
          metal(CONE, chitD, [0, -0.06, -0.96], [0.16, 0.2, 0.16], [-PI / 2 - 0.3, 0, 0]), glow(SPH, gl, [0, -0.1, -1.04], 0.08),
          glow(BOX, silk, [0, -0.62, -1.06], [0.008, 1.0, 0.008]),
        ],
        extra: [
          { name: 'spL', parent: 'lean', at: [-tw * 0.16, top - 0.22, -td * 0.42], parts: [...spiderLeg(-1, 0.14, 0, 0), ...spiderLeg(-1, -0.12, 1, -0.06)] },
          { name: 'spR', parent: 'lean', at: [tw * 0.16, top - 0.22, -td * 0.42], parts: [...spiderLeg(1, 0.14, 0, 0), ...spiderLeg(1, -0.12, 1, -0.06)] },
        ],
      };
    },
    // The back legs breathe and flex; they flare out while a skill charges and twitch on the shot.
    anim(m, t, dt, h) {
      const k = Math.max(h.charge ?? 0, h.castT ?? 0), a = h.atkT ?? 0;
      const fl = Math.sin(t * 1.6) * 0.06 + 0.3 * k + 0.12 * a * Math.sin(t * 40);
      m.x.spL.rotation.z = -fl; m.x.spR.rotation.z = fl;
      m.x.spL.rotation.y = m.x.spR.rotation.y = 0;
    },
  },

  // HUMAN choir warden: warm brown skin, black hair in a bun under a gold laurel circlet, singing mouth, white choir ruff,
  // wide cream robes to the ground with a blue stole, a golden handbell, the open hymn book, floating bells and notes.
  hymn: {
    plan: { hip: 1.2, tw: 0.78, th: 1.06, td: 0.52, hs: 0.46, neck: 0.16, ax: 0.6, legX: 0.18 },
    gait: { cad: 0.75, swing: 0, bob: 0.03, lean: 0.06, float: 0.14, sq: 0.03 },
    build(c) {
      const { hip, tw, th, td, top, hy, hz, hs, main, acc, gl } = c, gold = GOLD, sk = SKIN.brown, mid = hip + th * 0.5;
      const note = (x, y, z, k) => [glow(SPH, k % 2 ? gl : gold, [x, y, z], [0.18, 0.13, 0.08], [0, 0, 0.4]), glow(BOX, k % 2 ? gl : gold, [x + 0.08, y + 0.17, z], [0.025, 0.34, 0.025]),
        glow(BOX, k % 2 ? gl : gold, [x + 0.13, y + 0.3, z], [0.1, 0.03, 0.025], [0, 0, -0.5])];
      return {
        body: [
          ...torso({ hip, th, tw, td, c: main, waist: 0.84 }),
          ...both((sx) => [cloth(RBOX, acc, [sx * 0.13, mid + 0.04, td * 0.46], [0.15, th * 0.95, 0.04], [0.04, 0, sx * 0.06]), glow(BOX, gl, [sx * 0.13, mid + 0.3, td * 0.49], [0.06, 0.06, 0.01])]), // stole
          metal(TORUS, gold, [0, hip + 0.16, 0], [tw * 0.74, tw * 0.74, 0.4], [PI / 2, 0, 0]), // cincture
          cloth(BELL, acc, [0, top - 0.16, 0], [1.28, 0.48, td * 2.1]), cloth(DOME, acc, [0, top + 0.06, 0], [0.62, 0.2, td * 1.0]), metal(WHEEL, gold, [0, top - 0.39, 0], [1.27, td * 2.08, 1.2], [PI / 2, 0, 0]), // blue mozzetta
          ...[0, 1, 2].map((k) => metal(SPH, gold, [0, top - 0.06 - k * 0.1, td * 0.66 - k * 0.04], 0.04)),
          ...ring(12, (k, a) => [cloth(SPH, 0xFFFFFF, [Math.sin(a) * 0.24, top + 0.08, Math.cos(a) * 0.2], [0.17, 0.12, 0.17])]), // pleated choir ruff
          skin(CYL, sk, [0, top + 0.1, hz], [0.2, 0.18, 0.2]),
          ...face({ y: hy, z: hz, s: hs, skin: sk, ears: 'round', nose: 'button', hair: 'bun', hairC: HAIR.black, brow: HAIR.black, browTilt: 0.05 }),
          part(SPH, 0x5A2A2A, [0, hy - hs * 0.28, hz + hs * 0.43], [hs * 0.13, hs * 0.11, 0.04]), // singing mouth
          ...ring(10, (k, a) => metal(LEAF, gold, [Math.sin(a) * hs * 0.5, hy + hs * 0.32, hz - hs * 0.05 + Math.cos(a) * hs * 0.5], [0.1, 0.06, 0.06], [0, a, 0])), // laurel circlet on the hair
        ],
        eyes: (vc) => EYES.human(vc, hz + hs * 0.43, hs, { h: 0.1, tilt: 0.06 }),
        arms: [
          [...arm({ r: 0.11, up: main, fore: main, hand: sk, sh: main, foreF: 'cloth', handF: 'skin' }), cloth(BELL, main, [0, -0.8, 0.06], [0.44, 0.36, 0.44]),
            // golden handbell held mouth-down
            wood(CYL, WOOD, [0, -1.06, 0.2], [0.07, 0.24, 0.07], [0.3, 0, 0]), metal(SPH, gold, [0, -1.18, 0.24], [0.14, 0.1, 0.14]),
            metal(BELL, gold, [0, -1.36, 0.28], [0.44, 0.34, 0.44]), metal(CYL, gold, [0, -1.53, 0.28], [0.46, 0.03, 0.46]), glow(SPH, gl, [0, -1.56, 0.28], 0.07)],
          [...arm({ r: 0.11, up: main, fore: main, hand: sk, sh: main, foreF: 'cloth', handF: 'skin' }), cloth(BELL, main, [0, -0.8, 0.06], [0.44, 0.36, 0.44]),
            // open hymn book
            ...both((sx) => [cloth(RBOX, acc, [sx * 0.15, -1.1, 0.24], [0.3, 0.04, 0.4], [0, 0, sx * 0.25]), cloth(BOX, 0xF4EEDC, [sx * 0.15, -1.07, 0.24], [0.27, 0.03, 0.36], [0, 0, sx * 0.25])]),
            glow(BOX, gl, [0, -1.05, 0.24], [0.02, 0.02, 0.34])],
        ],
        legs: 'none',
        skirtAt: [0, hip + 0.02, 0],
        skirt: [ // wide choir robe sweeping to the ground
          cloth(BELL, main, [0, -0.6, 0], [tw * 1.6, 1.24, td * 2.5]), cloth(CYL, gold, [0, -1.2, 0], [tw * 1.6, 0.05, td * 2.5]),
          cloth(RBOX, acc, [0, -0.6, td * 0.62], [0.26, 1.14, 0.04], [0.2, 0, 0]), glow(BOX, gl, [0, -0.3, td * 0.58], [0.06, 0.06, 0.01]),
          ...[-1, 1].map((sx) => cloth(BOX, shade(main, 0.88), [sx * tw * 0.4, -0.66, td * 0.6], [0.02, 1.0, 0.02], [0.2, 0, sx * -0.25])), // robe folds
        ],
        halo: [ // floating choir bells, music notes and a second open hymn book
          ...ring(2, (k, a) => [metal(BELL, gold, [Math.cos(a) * 1.25, 2.5 + k * 0.25, Math.sin(a) * 1.25], [0.32, 0.32, 0.32]), metal(SPH, gold, [Math.cos(a) * 1.25, 2.68 + k * 0.25, Math.sin(a) * 1.25], 0.09)]),
          ...ring(3, (k, a) => note(Math.cos(a + 0.8) * 1.2, 2.7 + (k % 2) * 0.3, Math.sin(a + 0.8) * 1.2, k)),
          ...both((sx) => [cloth(RBOX, acc, [-0.95 + sx * 0.13, 2.9, -0.7], [0.26, 0.04, 0.34], [0.4, 0, sx * 0.25]), cloth(BOX, 0xF4EEDC, [-0.95 + sx * 0.13, 2.92, -0.7], [0.23, 0.03, 0.3], [0.4, 0, sx * 0.25])]),
        ],
      };
    },
    // The hymn book stays held open in front (off arm) unless a cast needs both hands.
    anim(m, t, dt, h) {
      const B = m.arms[1], free = 1 - Math.max(h.charge ?? 0, h.castT ?? 0);
      B.rotation.x = B.rotation.x * (1 - free) + (-0.9 + Math.sin(t * 1.6) * 0.04) * free;
      B.rotation.z = B.rotation.z * (1 - free) + 0.35 * free;
    },
  },

  // TREE ENT (birch): pale bark body with black birch marks and ridges, a carved bark face with a long knot nose, deep
  // glowing eyes, a moss beard and spectacles, leaf hair and branch antlers, twig fingers, root feet, the shoulder bonsai.
  grove: {
    plan: { hip: 1.14, tw: 0.9, th: 1.04, td: 0.62, hs: 0.46, neck: 0.08, hunch: 0.25, ax: 0.62, legX: 0.2 },
    gait: { cad: 0.8, swing: 0.6, bob: 0.08, lean: 0.2, float: 0, sq: 0.05 },
    build(c) {
      const { hip, tw, th, td, top, hy, hz, hs, main, acc, gl } = c, bark = main, barkD = 0xA09478, streak = 0x2E2A26, leaf = 0x7DB84A, leafD = 0x4E8A34, moss = 0x6E9A44, mid = hip + th * 0.5;
      const marks = (pts) => pts.map(([x, y, z, w = 0.16]) => wood(RBOX, streak, [x, y, z], [w * 1.2, 0.04, 0.03], [0, Math.atan2(x, z), 0]));
      const leaves = (x, y, z, n, s, R) => Array.from({ length: n }, (_, k) => { const a = (k / n) * PI * 2;
        return fur(LEAF, k % 2 ? leaf : leafD, [x + Math.cos(a) * s * 0.4, y + Math.sin(a * 2) * s * 0.15, z + Math.sin(a) * s * 0.4], [s * 0.5, s * 0.8, s * 0.5], [R ?? 0.4 * Math.sin(a), a, 0.6 * Math.cos(a)]); });
      return {
        body: [
          wood(SPH, barkD, [0, hip + 0.06, 0], [tw * 0.7, 0.34, td * 0.82]),
          ...torso({ hip, th, tw, td, c: bark, f: 'wood', waist: 0.86, chest: 1.02, z: 0.04 }), // trunk
          ...ring(7, (k, a) => [wood(BOX, shade(bark, 0.55), [Math.sin(a + 0.3) * tw * 0.4, mid - 0.1 + (k % 3) * 0.1, 0.04 + Math.cos(a + 0.3) * td * 0.5], [0.025, th * 0.36, 0.02], [0, a + 0.3, (k % 2 ? 0.12 : -0.12)])]), // bark cracks
          ...marks([[-0.2, mid + 0.34, td * 0.58], [0.18, mid + 0.14, td * 0.6, 0.2], [-0.1, mid - 0.14, td * 0.58, 0.12], [0.3, mid + 0.38, td * 0.44], [-0.38, mid - 0.02, td * 0.36, 0.18], [0.36, mid - 0.2, td * 0.36, 0.12], [-0.04, hip + 0.16, td * 0.56, 0.2],
            [0.06, mid + 0.4, -td * 0.5, 0.2], [-0.2, mid - 0.2, -td * 0.5], [0.24, mid, -td * 0.46], [-0.42, mid + 0.2, 0.0, 0.14], [0.44, mid + 0.06, 0.06, 0.16]]),
          ...both((sx) => [...chain([[sx * 0.24, top - 0.2, -td * 0.3], [sx * 0.46, top + 0.2, -td * 0.5], [sx * 0.62, top + 0.5, -td * 0.62]], 0.07, 0.035, barkD, 'wood'), ...leaves(sx * 0.64, top + 0.56, -td * 0.62, 5, 0.3)]), // branches off the back
          wood(SPH, 0x5A3E26, [0.14, mid - 0.02, td * 0.5], [0.16, 0.2, 0.08]), glow(SPH, gl, [0.14, mid - 0.02, td * 0.53], [0.08, 0.12, 0.04]), // sap knot
          ...both((sx) => [fur(SOFT, moss, [sx * tw * 0.4, top - 0.02, 0.02], [0.4, 0.12, 0.5], [0, 0, sx * -0.3])]), // moss on the shoulders
          wood(CYL, bark, [0, top + 0.06, hz], [0.24, 0.18, 0.24]),
          // carved bark face with a moss beard
          ...asF(face({ y: hy, z: hz, s: hs, skin: bark, ears: 'none', nose: 'long', jaw: 1.1, brow: barkD, browTilt: -0.32 }), 'wood'),
          fur(SOFT, moss, [0, hy - hs * 0.5, hz + hs * 0.3], [hs * 0.56, hs * 0.3, hs * 0.3]), fur(CONE, moss, [0, hy - hs * 0.8, hz + hs * 0.3], [hs * 0.4, hs * 0.5, hs * 0.24], [PI + 0.2, 0, 0]), // moss beard
          ...marks([[-0.12, hy + hs * 0.28, hz + hs * 0.38, 0.08], [0.1, hy - hs * 0.04, hz + hs * 0.44, 0.06], [0.16, hy + hs * 0.2, hz + hs * 0.34, 0.07]]),
          ...both((sx) => [metal(RING, 0x7A5A30, [sx * hs * 0.19, hy + hs * 0.03, hz + hs * 0.47], [0.15, 0.15, 0.3]), glass(CYL, 0xFFE8B0, [sx * hs * 0.19, hy + hs * 0.03, hz + hs * 0.47], [0.12, 0.01, 0.12], [PI / 2, 0, 0])]),
          metal(BOX, 0x7A5A30, [0, hy + hs * 0.05, hz + hs * 0.49], [0.05, 0.015, 0.015]), // spectacles
          // leaf hair
          ...leaves(0, hy + hs * 0.5, hz - hs * 0.22, 9, 0.46), ...leaves(0, hy + hs * 0.12, hz - hs * 0.46, 7, 0.42, -0.6),
          // branch antlers with leaf tufts
          ...both((sx) => [...chain([[sx * hs * 0.34, hy + hs * 0.3, hz - 0.04], [sx * hs * 0.66, hy + hs * 0.74, hz - 0.1], [sx * hs * 0.94, hy + hs * 1.04, hz - 0.16], [sx * hs * 1.24, hy + hs * 1.16, hz - 0.12]], 0.05, 0.025, barkD, 'wood'),
            seg([sx * hs * 0.72, hy + hs * 0.8, hz - 0.1], [sx * hs * 0.6, hy + hs * 1.2, hz - 0.06], 0.03, barkD, 'wood'),
            ...leaves(sx * hs * 1.26, hy + hs * 1.18, hz - 0.12, 4, 0.22), ...leaves(sx * hs * 0.6, hy + hs * 1.22, hz - 0.06, 3, 0.18)]),
        ],
        eyes: (vc) => EYES.glow(vc, hz + hs * 0.45, hs, { gap: 0.19, w: 0.15, h: 0.1, y: 0.03 }),
        arms: [0, 1].map((i) => [
          ...asF(arm({ r: 0.12, fr: 0.11, len: 1.06, up: barkD, fore: shade(barkD, 0.85), sh: moss, hand: null }), 'wood'),
          ...marks([[0.08, -0.3, 0.1, 0.08], [-0.06, -0.7, 0.1, 0.07]]),
          wood(SPH, barkD, [0, -1.04, 0.08], [0.2, 0.22, 0.2]),
          ...[-1, -0.33, 0.33, 1].map((t) => seg([t * 0.05, -1.08, 0.1], [t * 0.12, -1.3, 0.16 + Math.abs(t) * -0.04], 0.025, barkD, 'wood')), // twig fingers
          ...leaves(0.1, -0.5, -0.06, 3, 0.18),
          ...(i === 0 ? [ // gnarled staff topped with an amber seed pod
            stone(CYL, 0x5A4632, [0, -1.36, 0.22], [0.07, 1.5, 0.07], [0.12, 0, 0]), stone(SPH, 0x5A4632, [0, -0.66, 0.14], [0.16, 0.14, 0.16]),
            glow(SPH, gl, [0, -0.56, 0.14], [0.18, 0.22, 0.18]), ...leaves(0, -0.62, 0.14, 4, 0.2)]
            : [ // doctor's satchel with a leaf clasp
              cloth(RBOX, 0x7A4A2A, [0, -1.36, 0.1], [0.24, 0.36, 0.5]), cloth(RBOX, shade(0x7A4A2A, 0.8), [0, -1.2, 0.1], [0.26, 0.08, 0.52]),
              metal(TORUS, 0x7A5A30, [0, -1.12, 0.1], [0.24, 0.2, 0.2], [0, PI / 2, 0]), glow(SPH, gl, [0.13, -1.3, 0.1], [0.04, 0.12, 0.1])]),
        ]),
        leg: { r: 0.15, thigh: bark, shin: barkD, thighF: 'wood', shinF: 'wood', boot: null },
        legExtra: (H) => [wood(SPH, barkD, [0, -H + 0.12, 0.04], [0.36, 0.24, 0.4]), ...[-1, -0.33, 0.33, 1].map((t) => seg([t * 0.08, -H + 0.12, 0.1], [t * 0.3, -H + 0.02, 0.3 + (1 - Math.abs(t)) * 0.1], 0.05, barkD, 'wood')),
          seg([0, -H + 0.12, -0.04], [0, -H + 0.02, -0.28], 0.05, barkD, 'wood'), ...marks([[0.1, -H * 0.3, 0.12, 0.08]])], // root feet
        skirt: [...[-2, -1, 0, 1, 2].map((k) => fur(LEAF, k % 2 ? leafD : leaf, [k * 0.15, -0.26, 0.02 - Math.abs(k) * 0.05], [0.24, 0.56, 0.3], [0.1, k * -0.25, k * 0.12])), // hanging leaf apron
          ...[-1, 1].map((sx) => fur(LEAF, leafD, [sx * 0.2, -0.3, -td - 0.04], [0.26, 0.6, 0.3], [-0.1, 0, sx * 0.1]))],
        extra: [{ // bonsai growing from the off-side shoulder
          name: 'bonsai', parent: 'lean', at: [tw * 0.44, top + 0.02, 0.0],
          parts: [stone(CYL, 0x7A4A2A, [0, 0.02, 0], [0.26, 0.12, 0.26]), stone(CYL, 0x5A4632, [0, 0.16, 0], [0.07, 0.3, 0.07], [0, 0, 0.3]), stone(CYL, 0x5A4632, [0.06, 0.36, 0], [0.05, 0.26, 0.05], [0, 0, -0.6]),
            ...[[0.18, 0.48, 0, 0.3], [-0.08, 0.42, 0.06, 0.24], [0.06, 0.62, -0.04, 0.22]].map(([x, y, z, s]) => fur(SPH, leaf, [x, y, z], [s, s * 0.6, s])), glow(SPH, gl, [0.22, 0.38, 0.08], 0.05)],
        }, { // sap-vial rack on the back
          name: 'vials', parent: 'lean', at: [0, mid + 0.1, -td * 0.6],
          parts: [wood(RBOX, WOOD, [0, 0, 0], [0.7, 0.5, 0.2]), ...[-0.24, -0.08, 0.08, 0.24].flatMap((x, k) => [glass(CYL, 0xFFE8C0, [x, 0.22, 0], [0.12, 0.36, 0.12]), glow(CYL, k % 2 ? gl : tint(acc, 0x9FE07A, 0.6), [x, 0.16, 0], [0.09, 0.22, 0.09]), stone(CYL, 0x8A6A44, [x, 0.42, 0], [0.08, 0.06, 0.08])])],
        }],
      };
    },
    anim(m, t, dt, h) {
      m.x.bonsai.rotation.z = Math.sin(t * 1.3) * 0.08 + (h.moveAmt ?? 0) * Math.sin(h.phase ?? 0) * 0.06;
    },
  },
};

// -> the same handles as buildChampion (models.js), plus `x` (named extra groups), `gait` and `anim`. The rig is built by
// the shared assembler in forms.js (same build-context contract, plus legParts / clear parts / plan.scale hooks).
export function buildWave2B(spec, def, team = 0) {
  return assemble(BODIES[def.id], spec, def, team);
}
