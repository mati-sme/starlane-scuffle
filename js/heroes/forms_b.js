// v7.3 bodies for the original Water + Nature champions (forms.js assembles them; see the build-context notes there).
// Every body is its own plan: avian archer, yeti, lightning elemental, human conductor, pinball robot, treant-turtle,
// rock troll, flower fairy, goblin mechanic, gnome jet-ranger and piston mech. No shared armor kit.
import * as THREE from 'three';
import {
  PI, BOX, RBOX, SOFT, BELL, CYL, CYL6, CONE, CONE4, CONE6, OCT, ICO1, DODE, SPH, HEAD, DOME, CAP, RING, TORUS, FAN, LEAF,
  DARK, BRASS, WOOD, ROPE, STEEL, SKIN, HAIR, shade, tint, part, metal, steel, cloth, glow, rubber, stone, glass, skin, fur, wood, clear,
  both, ring, seg, chain, arm, face, torso, EYES,
} from './anatomy.js';

// ── local helpers ──
const _m4 = new THREE.Matrix4(), _eu = new THREE.Euler(), _vx = new THREE.Vector3(), _vy = new THREE.Vector3(), _vz = new THREE.Vector3();
// A part whose local +y axis points along d and whose local +z (the flat face of LEAF / FAN / PLANE) points along n.
function orient(g, c, p, s, d, n, f = 'paint') {
  _vy.set(...d).normalize();
  _vz.set(...n).addScaledVector(_vy, -_vz.set(...n).dot(_vy)).normalize();
  _vx.crossVectors(_vy, _vz);
  _eu.setFromRotationMatrix(_m4.makeBasis(_vx, _vy, _vz));
  return part(g, c, p, s, [_eu.x, _eu.y, _eu.z], f);
}
// A flower: n petals around center o, facing axis w, cupped by `cup` radians, with a round core.
function flower(o, w, R, n, pc, cc, cup = 0.4, pw = 0.55, f = 'cloth', coreF = 'glow', pc2) {
  const W = new THREE.Vector3(...w).normalize(), U = new THREE.Vector3(...(Math.abs(W.y) > 0.9 ? [1, 0, 0] : [0, 1, 0])).cross(W).normalize(), V = W.clone().cross(U);
  const P = [part(SPH, cc, o, [R * 0.42, R * 0.42, R * 0.42], undefined, coreF)];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * PI * 2, r = U.clone().multiplyScalar(Math.cos(a)).addScaledVector(V, Math.sin(a));
    const d = r.clone().multiplyScalar(Math.cos(cup)).addScaledVector(W, Math.sin(cup)), nn = W.clone().multiplyScalar(Math.cos(cup)).addScaledVector(r, -Math.sin(cup));
    P.push(orient(LEAF, pc2 && k % 2 ? pc2 : pc, [o[0] + d.x * R * 0.5, o[1] + d.y * R * 0.5, o[2] + d.z * R * 0.5], [R * pw, R, 0.35], [d.x, d.y, d.z], [nn.x, nn.y, nn.z], f));
  }
  return P;
}
// Deterministic jitter in [-1, 1].
const jit = (k, s = 0) => { const v = Math.sin(k * 12.9898 + s * 78.233) * 43758.5453; return (v - Math.floor(v)) * 2 - 1; };
// A jagged lightning bolt (glowing zigzag chain) from a to b.
function zig(a, b, n, amp, r0, r1, c, seed = 0, f = 'glow') {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], px = new THREE.Vector3(...d).cross(new THREE.Vector3(0.3, 0.2, 1)).normalize();
  const pts = [a];
  for (let k = 1; k < n; k++) {
    const u = k / n, o = (k % 2 ? 1 : -1) * amp * (0.6 + 0.4 * Math.abs(jit(k, seed)));
    pts.push([a[0] + d[0] * u + px.x * o, a[1] + d[1] * u + px.y * o, a[2] + d[2] * u + px.z * o]);
  }
  pts.push(b);
  return chain(pts, r0, r1, c, f);
}
// A ring of shaggy fur tufts hanging down around an ellipse (yeti pelt, moss fringe).
const shag = (cx, cy, cz, rx, rz, n, len, w, c, out = 0.3, a0 = 0) => ring(n, (k, a) => [orient(CONE4, k % 2 ? c : shade(c, 0.92),
  [cx + Math.sin(a + a0) * rx, cy - len * 0.42, cz + Math.cos(a + a0) * rz], [w, len, w * 0.8], [Math.sin(a + a0) * out, -1, Math.cos(a + a0) * out], [Math.sin(a + a0), 0, Math.cos(a + a0)], 'fur')]);
const k01 = (h) => Math.min(1, Math.max(h?.atkT ?? 0, h?.castT ?? 0, h?.charge ?? 0));

// A folded wing in its own group (origin = shoulder-blade root): layered coverts and long primaries hanging down-out.
function wing(sx, main, tip, under) {
  const P = [fur(SOFT, main, [sx * 0.12, -0.08, 0], [0.34, 0.5, 0.14], [0, 0, sx * 0.3])];
  for (let k = 0; k < 6; k++) {
    const L = 0.6 + k * 0.14, bx = sx * (0.06 + k * 0.07), by = 0.04 + k * 0.025, a = sx * (0.06 + k * 0.07);
    P.push(fur(LEAF, k % 2 ? shade(main, 0.88) : main, [bx + Math.sin(a) * L * 0.5, by - Math.cos(a) * L * 0.5, -0.02 - k * 0.015], [0.2, L, 0.5], [0, 0, a]));
    if (k > 2) P.push(fur(LEAF, tip, [bx + Math.sin(a) * L * 0.86, by - Math.cos(a) * L * 0.86, -0.035 - k * 0.015], [0.17, L * 0.3, 0.45], [0, 0, a]));
  }
  P.push(fur(LEAF, under, [sx * 0.14, -0.2, 0.03], [0.26, 0.42, 0.4], [0, 0, sx * 0.25]));
  return P;
}

export const FORMS_B = {
  // AVIAN archer: falcon-headed bird-person (flat crown, brow ridge, hooked beak, malar stripes), folded wings, talons, recurve bow.
  zephyr: {
    plan: { hip: 1.36, tw: 0.78, th: 1.0, td: 0.52, hs: 0.44, neck: 0.16, ax: 0.54, legX: 0.18 },
    gait: { cad: 1.1, swing: 1.0, bob: 0.1, lean: 0.35, float: 0, sq: 0.04 },
    build(c) {
      const { hip, tw, th, td, top, hy, hz, hs, main, acc, gl } = c, mid = hip + th * 0.5;
      const fea = shade(main, 0.9), cap = shade(main, 0.62), cream = 0xEEF2F8, pale = tint(fea, cream, 0.45), bar = shade(fea, 0.62);
      const cere = 0xF0B840, beak = 0x58606E, tip = tint(acc, 0xffffff, 0.3), leather = 0x5A3E2A, talon = 0x3A3028;
      const cd = [0, 0.32, -0.95]; // crest direction: swept back, a little up
      return {
        body: [
          fur(SOFT, fea, [0, hip + 0.06, 0], [tw * 0.66, 0.3, td * 0.8]),
          ...torso({ hip, th, tw, td, c: fea, f: 'fur', waist: 0.66 }),
          // breast: a softly paler shield sunk into the chest, barred with darker chevrons (falcon barring), not a white sack
          fur(HEAD, tint(fea, cream, 0.3), [0, mid + 0.14, td * 0.16], [tw * 0.64, th * 0.74, td * 0.5]),
          fur(HEAD, tint(fea, cream, 0.5), [0, mid + 0.24, td * 0.2], [tw * 0.46, th * 0.5, td * 0.46]),
          ...[0, 1, 2, 3].flatMap((k) => [-1, 0, 1].filter((x) => k % 2 || x).map((x) => fur(LEAF, bar, [x * tw * 0.12 + (k % 2 ? 0 : 0), mid - 0.08 + k * 0.15, td * 0.44 - Math.abs(x) * 0.03], [0.1, 0.06, 0.3], [0, x * 0.4, 0]))),
          rubber(RBOX, leather, [0, mid + 0.12, td * 0.5], [0.07, th * 0.95, 0.04], [0, 0, -0.6]), metal(RING, BRASS, [0.1, mid + 0.04, td * 0.55], [0.14, 0.14, 0.4]), // quiver strap
          rubber(CYL, leather, [0, hip + 0.14, 0], [tw * 0.7, 0.08, td * 0.86]),
          fur(CYL, fea, [0, top + 0.08, hz], [0.26, 0.26, 0.26]), // neck ruff
          ...ring(8, (k, a) => [fur(LEAF, k % 2 ? fea : shade(fea, 0.85), [Math.sin(a) * 0.2, top + 0.02, hz + Math.cos(a) * 0.18], [0.16, 0.3, 0.4], [0.5 * Math.cos(a), a, 0])]),
          // falcon head: long low skull, dark flat crown, heavy brow ridges, pale throat, malar stripes
          fur(HEAD, fea, [0, hy - hs * 0.02, hz - hs * 0.04], [hs * 0.86, hs * 0.8, hs * 1.08]),
          fur(HEAD, cap, [0, hy + hs * 0.16, hz - hs * 0.12], [hs * 0.84, hs * 0.5, hs * 1.0]),
          ...both((sx) => [
            fur(SOFT, cap, [sx * hs * 0.2, hy + hs * 0.15, hz + hs * 0.32], [hs * 0.34, hs * 0.11, hs * 0.26], [0.25, sx * 0.25, sx * 0.3]), // brow ridge
            fur(HEAD, pale, [sx * hs * 0.24, hy - hs * 0.2, hz + hs * 0.16], [hs * 0.3, hs * 0.34, hs * 0.4]), // cheek
            fur(LEAF, shade(main, 0.45), [sx * hs * 0.3, hy - hs * 0.2, hz + hs * 0.28], [hs * 0.11, hs * 0.32, 0.3], [0.1, sx * 0.55, sx * 0.12]), // malar stripe
          ]),
          fur(HEAD, tint(fea, cream, 0.8), [0, hy - hs * 0.36, hz + hs * 0.14], [hs * 0.46, hs * 0.34, hs * 0.46]), // throat
          part(SPH, cere, [0, hy - hs * 0.03, hz + hs * 0.42], [hs * 0.3, hs * 0.22, hs * 0.22]), // cere
          ...chain([[0, hy - hs * 0.02, hz + hs * 0.46], [0, hy - hs * 0.04, hz + hs * 0.62], [0, hy - hs * 0.12, hz + hs * 0.74], [0, hy - hs * 0.27, hz + hs * 0.75]], hs * 0.15, hs * 0.04, beak, 'rubber'), // hooked upper mandible
          part(SPH, beak, [0, hy - hs * 0.07, hz + hs * 0.56], [hs * 0.24, hs * 0.2, hs * 0.26], undefined, 'rubber'),
          seg([0, hy - hs * 0.17, hz + hs * 0.46], [0, hy - hs * 0.2, hz + hs * 0.6], hs * 0.06, shade(beak, 0.8), 'rubber'), // lower mandible
          ...[-2, -1, 0, 1, 2].map((k) => { const L = hs * (0.9 - Math.abs(k) * 0.14), b = [k * hs * 0.08, hy + hs * 0.22, hz - hs * 0.36];
            return fur(LEAF, k % 2 ? tip : cap, [b[0] + k * 0.02, b[1] + cd[1] * L * 0.5, b[2] + cd[2] * L * 0.5], [hs * 0.2, L, 0.5], [-1.24 + Math.abs(k) * 0.08, k * 0.12, 0]); }),
          glow(LEAF, gl, [0, hy + hs * 0.3, hz - hs * 0.66], [hs * 0.07, hs * 0.6, 0.4], [-1.26, 0, 0]),
        ],
        eyes: (vc) => EYES.bead(vc, hz + hs * 0.36, hs, { gap: 0.25, w: 0.14, h: 0.13, y: 0.04 }),
        arms: [
          [...arm({ r: 0.11, up: fea, fore: fea, hand: 0x6A5A4A, sh: fea, upF: 'fur', foreF: 'fur', handF: 'rubber' }),
            ...[0, 1, 2].map((k) => fur(LEAF, k % 2 ? tip : fea, [0, -0.5 - k * 0.12, -0.1], [0.12, 0.42, 0.4], [-0.5, 0, 0])), // forearm flight feathers
            rubber(CYL, leather, [0, -0.86, 0.07], [0.25, 0.14, 0.25]),
            // glowing recurve bow held upright in front of the hand
            rubber(RBOX, leather, [0, -1.06, 0.3], [0.08, 0.26, 0.08]), metal(RBOX, BRASS, [0, -1.06, 0.3], [0.09, 0.05, 0.09]),
            ...both((sy) => chain([[0, -1.06 + sy * 0.1, 0.32], [0, -1.06 + sy * 0.45, 0.42], [0, -1.06 + sy * 0.78, 0.36], [0, -1.06 + sy * 0.92, 0.44]], 0.045, 0.03, main, 'metal')),
            ...both((sy) => [glow(SPH, gl, [0, -1.06 + sy * 0.92, 0.44], 0.06)]),
            glow(BOX, gl, [0, -1.06, 0.2], [0.012, 1.8, 0.012]), // string
            glow(BOX, gl, [0, -1.06, 0.52], [0.02, 0.02, 0.7]), glow(CONE4, gl, [0, -1.06, 0.92], [0.06, 0.16, 0.06], [PI / 2, 0, 0])], // nocked arrow
          [...arm({ r: 0.11, up: fea, fore: fea, hand: 0x6A5A4A, sh: fea, upF: 'fur', foreF: 'fur', handF: 'rubber' }),
            ...[0, 1, 2].map((k) => fur(LEAF, k % 2 ? tip : fea, [0, -0.5 - k * 0.12, -0.1], [0.12, 0.42, 0.4], [-0.5, 0, 0])), rubber(CYL, leather, [0, -0.86, 0.07], [0.25, 0.14, 0.25])],
        ],
        legDigi: { r: 0.12, thigh: fea, shin: cere, shinF: 'rubber', paw: shade(cere, 0.85), claw: talon, talon: true },
        legExtra: (H) => [...ring(6, (k, a) => [fur(LEAF, fea, [Math.sin(a) * 0.12, -H * 0.34, 0.16 + Math.cos(a) * 0.12], [0.14, 0.3, 0.4], [0.3, a, 0])])], // feather "trousers"
        skirt: [...[-2, -1, 0, 1, 2].map((k) => fur(LEAF, k % 2 ? fea : shade(fea, 0.85), [k * 0.12, -0.24, -0.02], [0.16, 0.5, 0.4], [0.1, 0, k * 0.12]))],
        tailAt: [0, hip + 0.06, -td * 0.42],
        tail: [...[-2, -1, 0, 1, 2].map((k) => fur(LEAF, k % 2 ? tip : fea, [k * 0.1, -0.3, -0.35 - Math.abs(k) * -0.04], [0.2, 0.95 - Math.abs(k) * 0.1, 0.5], [-0.9, 0, k * 0.22]))],
        extra: [
          ...both((sx) => [{ name: sx < 0 ? 'wingL' : 'wingR', parent: 'lean', at: [sx * 0.16, top - 0.08, -td * 0.42], parts: wing(sx, main, tip, pale) }]),
          { name: 'quiver', parent: 'lean', at: [-0.18, mid + 0.25, -td * 0.55], parts: [rubber(CYL, leather, [0, 0, 0], [0.22, 0.8, 0.22], [0, 0, 0.3]), ...[-0.05, 0.05].map((x) => glow(LEAF, gl, [x - 0.14, 0.48, 0], [0.08, 0.26, 0.4], [0, 0, 0.3]))] },
        ],
      };
    },
    // Wings sit folded against the back, flare on the shot and lift a little in the stride.
    anim(m, t, dt, h) {
      const k = k01(h), mv = h.moveAmt ?? 0;
      for (const [g, sx] of [[m.x.wingL, -1], [m.x.wingR, 1]]) {
        g.rotation.z = sx * (0.1 + 0.55 * k + 0.12 * mv + Math.sin(t * 2 + sx) * 0.03);
        g.rotation.y = sx * (0.25 - 0.2 * k);
      }
    },
  },

  // YETI: hulking white-fur snow ape, blue-grey face, knitted beanie with a pom-pom, big paws, ice-crystal wand, snowflake halo.
  rime: {
    plan: { hip: 1.04, tw: 1.3, th: 1.15, td: 0.9, hs: 0.5, neck: 0.0, hunch: 0.24, ax: 0.8, legX: 0.3, scale: [1.06, 1.0] },
    gait: { cad: 0.8, swing: 0.65, bob: 0.16, lean: 0.15, float: 0, sq: 0.1 },
    build(c) {
      const { hip, tw, th, td, top, hy, hz, hs, acc, gl } = c, mid = hip + th * 0.5;
      const furC = 0xF2F7FA, furS = 0xC8D8E8, faceC = 0x7F93B4, nose = 0x2A3348, bean = shade(acc, 0.8), ice = 0xBFEFFF;
      const bb = hy + hs * 0.3; // beanie cuff height (sits on the fur crown)
      return {
        body: [
          fur(HEAD, furC, [0, top - 0.4, 0.02], [tw * 1.08, th * 0.86, td * 1.1]),
          fur(HEAD, furS, [0, hip + 0.4, td * 0.12], [tw * 0.84, th * 0.66, td * 0.92]),
          fur(HEAD, furC, [0, hip + 0.12, 0], [tw * 0.86, 0.52, td * 0.86]),
          fur(HEAD, furC, [0, top - 0.06, -0.06], [tw * 1.0, 0.4, td * 0.9]),
          ...[-1, 0, 1].map((x) => orient(LEAF, furS, [x * 0.2, top - 0.36 - Math.abs(x) * 0.06, td * 0.56], [0.3, 0.42, 0.6], [x * 0.2, -1, 0.3], [0, 0.3, 1], 'fur')), // chest mane
          ...[0, 1, 2, 3].map((k) => orient(CONE4, k % 2 ? furC : furS, [0, top - 0.1 - k * 0.24, -td * 0.55 + k * 0.03], [0.3, 0.4, 0.16], [0, -1, -0.5], [0, 0, -1], 'fur')), // back mane
          ...shag(0, hip + 0.14, 0, tw * 0.42, td * 0.46, 10, 0.3, 0.3, furC, 0.35),
          ...ring(7, (k, a) => [fur(SOFT, k % 2 ? furC : furS, [Math.sin(a) * tw * 0.36, hip + 0.02, Math.cos(a) * td * 0.42], [0.34, 0.28, 0.3], [0.2, a, 0])]),
          ...both((sx) => [fur(HEAD, furC, [sx * tw * 0.4, top - 0.04, -0.02], [0.62, 0.48, 0.72])]),
          // ice crystals growing out of the upper back
          ...[[-0.3, 0.2, -0.3], [0.05, 0.42, -0.1], [0.32, 0.14, 0.35], [-0.05, 0.0, 0.5]].map(([x, y, rz], k) =>
            clear(CONE6, k % 2 ? 0x8FDFFF : 0x5FC8F0, [x, top + y - 0.1, -td * 0.46], [0.22, 0.6 + k * 0.1, 0.22], [-0.5, 0, rz], 'glass')),
          // head: fur dome merging into the shoulders, blue-grey face with a heavy fur brow, flat nose, little fangs
          fur(HEAD, furC, [0, hy + 0.02, hz - 0.04], [hs * 1.14, hs * 1.02, hs * 1.06]),
          skin(HEAD, faceC, [0, hy - hs * 0.06, hz + hs * 0.26], [hs * 0.78, hs * 0.7, hs * 0.56]),
          fur(SOFT, furC, [0, hy + hs * 0.17, hz + hs * 0.48], [hs * 0.9, hs * 0.17, hs * 0.24], [0.25, 0, 0]),
          ...both((sx) => [fur(CONE4, furC, [sx * hs * 0.28, hy + hs * 0.12, hz + hs * 0.56], [0.1, 0.2, 0.08], [0.6, 0, sx * 2.1]),
            fur(CONE4, furS, [sx * hs * 0.52, hy - hs * 0.22, hz + 0.08], [0.18, 0.36, 0.16], [0.2, 0, sx * 2.3])]), // brow + cheek tufts
          skin(HEAD, tint(faceC, 0xffffff, 0.18), [0, hy - hs * 0.24, hz + hs * 0.5], [hs * 0.52, hs * 0.32, hs * 0.3]),
          rubber(SPH, nose, [0, hy - hs * 0.12, hz + hs * 0.66], [hs * 0.2, hs * 0.12, hs * 0.12]),
          rubber(RBOX, nose, [0, hy - hs * 0.33, hz + hs * 0.64], [hs * 0.26, hs * 0.035, 0.03]),
          ...both((sx) => [stone(CONE, 0xF4F4F0, [sx * hs * 0.09, hy - hs * 0.37, hz + hs * 0.64], [hs * 0.06, hs * 0.1, hs * 0.06], [PI, 0, 0])]),
          // knitted beanie: ribbed cuff, stripe, crown, white pom-pom
          cloth(CYL, shade(bean, 0.85), [0, bb, hz - 0.04], [hs * 1.1, hs * 0.24, hs * 1.08], [-0.14, 0, 0]),
          cloth(DOME, bean, [0, bb + hs * 0.08, hz - 0.06], [hs * 1.04, hs * 1.15, hs * 1.02], [-0.14, 0, 0]),
          cloth(CYL, 0xFFFFFF, [0, bb + hs * 0.26, hz - 0.08], [hs * 0.98, hs * 0.08, hs * 0.96], [-0.14, 0, 0]),
          ...ring(10, (k, a) => [cloth(BOX, shade(bean, 0.7), [Math.sin(a) * hs * 0.55, bb, hz - 0.04 + Math.cos(a) * hs * 0.54], [0.03, hs * 0.22, 0.03], [-0.14, a, 0])]),
          fur(SPH, 0xFFFFFF, [0, bb + hs * 0.72, hz - 0.16], hs * 0.38),
        ],
        eyes: (vc) => EYES.bead(vc, hz + hs * 0.54, hs, { gap: 0.2, w: 0.13, h: 0.13, y: 0.04 }),
        arms: [
          [...arm({ r: 0.2, fr: 0.22, len: 1.24, up: furC, fore: furC, sh: furC, upF: 'fur', foreF: 'fur', hand: faceC, handF: 'skin', paw: true }),
            ...shag(0, -0.7, 0.04, 0.21, 0.21, 6, 0.26, 0.24, furC, 0.5), ...shag(0, -0.12, 0, 0.24, 0.24, 6, 0.26, 0.24, furS, 0.6, 0.5),
            ...[-1, 0, 1].map((x) => rubber(CONE4, nose, [x * 0.1, -1.32, 0.26], [0.05, 0.12, 0.05], [PI / 2 + 0.3, 0, 0])),
            // ice-crystal wand: frosted wood shaft, crystal cluster with a glowing heart
            wood(CYL, 0x6A86A0, [0, -0.92, 0.3], [0.07, 1.2, 0.07], [0.12, 0, 0]),
            clear(OCT, 0x9FE6FF, [0, -0.28, 0.37], [0.4, 0.7, 0.4], undefined, 'glass'),
            ...[-1, 1].map((sx) => clear(CONE6, 0x6FD0F5, [sx * 0.16, -0.36, 0.36], [0.14, 0.42, 0.14], [0, 0, sx * -0.6], 'glass')),
            glow(OCT, 0x7FE4FF, [0, -0.28, 0.37], 0.18), metal(TORUS, 0xD8E6F0, [0, -0.52, 0.34], [0.16, 0.16, 0.3], [PI / 2, 0, 0])],
          [...arm({ r: 0.2, fr: 0.22, len: 1.24, up: furC, fore: furC, sh: furC, upF: 'fur', foreF: 'fur', hand: faceC, handF: 'skin', paw: true }),
            ...shag(0, -0.7, 0.04, 0.21, 0.21, 6, 0.26, 0.24, furC, 0.5), ...shag(0, -0.12, 0, 0.24, 0.24, 6, 0.26, 0.24, furS, 0.6, 0.5),
            ...[-1, 0, 1].map((x) => rubber(CONE4, nose, [x * 0.1, -1.32, 0.26], [0.05, 0.12, 0.05], [PI / 2 + 0.3, 0, 0]))],
        ],
        handAt: [0, -0.3, 0.37],
        leg: { r: 0.2, thigh: furC, shin: furC, thighF: 'fur', shinF: 'fur', boot: faceC, bootF: 'skin' },
        legExtra: (H) => [...shag(0, -H * 0.62, 0.02, 0.22, 0.22, 7, 0.24, 0.24, furC, 0.4),
          ...[-1, 0, 1].map((x) => skin(SPH, faceC, [x * 0.13, -H + 0.08, 0.38], [0.14, 0.12, 0.16]))],
        halo: ring(5, (k, a) => {
          const p = [Math.cos(a) * 1.4, 2.15 + (k % 2 ? 0.25 : -0.1), Math.sin(a) * 1.4];
          return [...[0, 1, 2].map((j) => glow(BOX, k % 2 ? gl : 0xE8FAFF, p, [0.04, 0.36, 0.03], [0, -a + PI / 2, (j * PI) / 3])), glow(OCT, 0xFFFFFF, p, 0.09)];
        }),
      };
    },
  },

  // LIGHTNING ELEMENTAL: a body of crackling yellow energy shards under a dark storm-cloud mantle, a crown of bolt spikes,
  // zigzag bolt limbs ending in lightning claws, a forked bolt instead of legs, orbiting sparks. Hovers.
  volt: {
    plan: { hip: 1.08, tw: 0.72, th: 1.0, td: 0.48, hs: 0.42, neck: 0.1, ax: 0.5, legX: 0.16 },
    gait: { cad: 0.9, swing: 0.2, bob: 0.06, lean: 0.5, float: 0.45, sq: 0.03 },
    style: 'float',
    build(c) {
      const { hip, tw, th, td, top, hy, hz, hs } = c;
      const core = 0x262C3C, cloud = 0x3A4258, Y = 0xFFCC10, Yd = 0xE89A00, cy = 0x22C8FF, ch = top - 0.36;
      return {
        body: [
          // energy body: faceted yellow chest + pinched waist, darker amber facets, a cyan spark heart
          part(DODE, Y, [0, ch, 0.02], [tw * 0.92, th * 0.66, td * 1.0], [0.3, 0.4, 0]),
          part(OCT, Yd, [0, hip + 0.3, 0], [tw * 0.5, th * 0.62, td * 0.7]),
          ...[[-0.18, 0.12, 0.6], [0.2, -0.06, -0.5], [0.0, -0.22, 0.2]].map(([x, y, r]) => part(OCT, Yd, [x, ch + y, td * 0.4], [0.2, 0.32, 0.08], [0, 0, r])),
          glow(OCT, cy, [0, ch + 0.02, td * 0.5], [0.2, 0.28, 0.14]),
          ...both((sx) => zig([0, ch, td * 0.5], [sx * tw * 0.4, top - 0.1, td * 0.2], 3, 0.06, 0.03, 0.02, cy, sx + 3)),
          // storm-cloud mantle on the shoulders and back
          ...both((sx) => [part(ICO1, cloud, [sx * tw * 0.36, top - 0.06, -0.04], [0.48, 0.38, 0.5]), part(ICO1, core, [sx * tw * 0.18, top - 0.16, -td * 0.4], [0.42, 0.4, 0.36]),
            part(CONE4, Y, [sx * tw * 0.56, top + 0.14, -0.06], [0.12, 0.5, 0.12], [0, 0, sx * -0.75]),
            glow(CONE4, cy, [sx * tw * 0.42, top + 0.06, -0.2], [0.08, 0.34, 0.08], [-0.5, 0, sx * -0.9])]),
          part(ICO1, cloud, [0, top + 0.02, hz - 0.06], [0.42, 0.26, 0.4]),
          // head: dark storm skull with a pointed jaw; the bolt crown is a live extra
          part(ICO1, core, [0, hy + hs * 0.04, hz], [hs * 0.84, hs * 0.92, hs * 0.9]),
          part(CONE4, core, [0, hy - hs * 0.4, hz + 0.04], [hs * 0.52, hs * 0.42, hs * 0.48], [PI, PI / 4, 0]),
          ...both((sx) => [part(CONE4, Y, [sx * hs * 0.32, hy - hs * 0.12, hz + hs * 0.3], [0.05, 0.22, 0.04], [0.2, 0, sx * 0.5])]), // face bolts
        ],
        eyes: (vc) => EYES.glow(vc, hz + hs * 0.43, hs, { gap: 0.18, w: 0.24, h: 0.09, tilt: 0.38 }),
        arms: [0, 1].map(() => [
          part(ICO1, cloud, [0, 0, 0], [0.3, 0.28, 0.3]),
          ...zig([0, -0.08, 0.02], [0, -0.5, 0.04], 3, 0.07, 0.075, 0.06, Y, 2, 'paint'),
          ...zig([0, -0.5, 0.04], [0, -0.94, 0.1], 3, 0.06, 0.065, 0.05, Y, 5, 'paint'),
          ...zig([0, -0.1, 0.08], [0, -0.9, 0.12], 4, 0.05, 0.016, 0.012, cy, 9),
          part(OCT, Yd, [0, -1.0, 0.08], [0.22, 0.2, 0.2]),
          ...[-1, 0, 1].map((x) => part(CONE4, x ? Y : cy, [x * 0.08, -1.18, 0.16], [0.07, 0.4, 0.07], [0.5, 0, x * -0.3], x ? 'paint' : 'glow')), // lightning claws
        ]),
        handAt: [0, -1.12, 0.2],
        legs: 'none',
        skirtAt: [0, hip + 0.06, 0],
        skirt: [
          ...zig([0, 0.02, 0.0], [0.02, -0.95, -0.06], 5, 0.1, 0.13, 0.03, Y, 11, 'paint'),
          ...both((sx) => zig([sx * 0.06, -0.22, 0], [sx * 0.34, -0.72, -0.04], 3, 0.06, 0.05, 0.02, cy, sx + 13)),
          part(ICO1, cloud, [0, -0.02, -0.02], [0.4, 0.22, 0.36]),
        ],
        halo: ring(6, (k, a) => zig([Math.cos(a) * 1.05, 1.45 + (k % 2) * 0.55, Math.sin(a) * 1.05], [Math.cos(a + 0.25) * 1.12, 1.75 + (k % 2) * 0.55, Math.sin(a + 0.25) * 1.12], 3, 0.06, 0.03, 0.02, k % 2 ? cy : Y, k, k % 2 ? 'glow' : 'paint')),
        extra: [
          { name: 'crown', parent: 'lean', at: [0, hy + hs * 0.1, hz], parts: [
            ...[[0, 1, -0.45, 0.9], [-0.45, 0.9, -0.5, 0.72], [0.45, 0.9, -0.5, 0.72], [-0.85, 0.5, -0.4, 0.55], [0.85, 0.5, -0.4, 0.55], [-0.3, 0.5, -1, 0.62], [0.3, 0.5, -1, 0.62]].map(([x, y, z, L], k) => {
              const n = Math.hypot(x, y, z), d = [x / n, y / n, z / n], b = hs * 0.3;
              return orient(CONE4, k % 3 ? Y : Yd, [d[0] * (b + L * 0.5), d[1] * (b + L * 0.5), d[2] * (b + L * 0.5)], [0.16, L, 0.13], d, [0, 0, 1], 'paint');
            }),
            ...zig([0, hs * 0.3, 0], [0.05, hs * 0.3 + 0.75, -0.35], 3, 0.08, 0.035, 0.02, cy, 21),
          ] },
          { name: 'sparks', parent: 'lean', at: [0, ch, -td * 0.5], parts: ring(4, (k, a) => zig([Math.cos(a) * 0.5, Math.sin(a) * 0.5, -0.1], [Math.cos(a) * 0.78, Math.sin(a) * 0.78, -0.2], 2, 0.06, 0.03, 0.015, k % 2 ? cy : Y, k + 30, 'glow')) },
        ],
      };
    },
    // The bolt crown flickers, the back sparks spin (faster when striking).
    anim(m, t, dt, h) {
      const k = k01(h), f = 1 + Math.sin(t * 41) * 0.05 + Math.sin(t * 23) * 0.04 + k * 0.15;
      m.x.crown.scale.set(f, 1 + (f - 1) * 1.6, f);
      m.x.sparks.rotation.z += dt * (1.5 + 8 * k);
    },
  },

  // HUMAN conductor: silver-haired maestro with a moustache, top hat on his hair, plum tailcoat with long tails, white
  // spats, baton, and a speaker cabinet with a brass gramophone horn over the shoulder. Floating music notes.
  tempo: {
    plan: { hip: 1.32, tw: 0.76, th: 1.0, td: 0.46, hs: 0.42, neck: 0.12, ax: 0.52, legX: 0.16 },
    gait: { cad: 1, swing: 0.85, bob: 0.14, lean: 0.12, float: 0, sq: 0.08, sway: 0.18 },
    build(c) {
      const { hip, tw, th, td, top, hy, hz, hs, main, acc, gl } = c, mid = hip + th * 0.5;
      const coat = shade(main, 0.85), satin = shade(main, 0.45), shirt = 0xF2EEE8, pants = 0x24202C, shoe = 0x15151A, glove = 0xF4F2EE, hat = 0x1E1A24;
      const hb = hy + hs * 0.36;
      return {
        body: [
          cloth(CYL, pants, [0, hip + 0.04, 0], [tw * 0.62, 0.26, td * 0.8]),
          ...torso({ hip, th, tw, td, c: coat, waist: 0.72, chest: 0.98 }),
          cloth(RBOX, shirt, [0, mid + 0.18, td * 0.42], [tw * 0.3, th * 0.6, 0.07]),
          cloth(RBOX, satin, [0, mid - 0.04, td * 0.43], [tw * 0.36, th * 0.24, 0.075]), // waistcoat
          ...both((sx) => [cloth(RBOX, satin, [sx * tw * 0.18, mid + 0.2, td * 0.46], [tw * 0.12, th * 0.52, 0.05], [0.04, sx * 0.25, sx * -0.2])]), // satin lapels
          ...[0, 1].map((k) => rubber(SPH, DARK, [0, mid + 0.1 + k * 0.14, td * 0.47], 0.035)),
          glow(LEAF, gl, [tw * 0.3, mid + 0.26, td * 0.42], [0.12, 0.1, 0.3], [0, 0.3, 0.4]), // pocket square
          skin(CYL, SKIN.brown, [0, top + 0.06, hz], [0.16, 0.2, 0.16]),
          cloth(CYL, shirt, [0, top + 0.0, hz], [0.24, 0.1, 0.24]), // collar
          cloth(SPH, gl, [0, top + 0.02, hz + 0.13], [0.07, 0.07, 0.05]),
          ...both((sx) => [cloth(CONE, gl, [sx * 0.09, top + 0.02, hz + 0.12], [0.11, 0.13, 0.06], [0, 0, sx * PI / 2])]), // bow tie
          ...face({ y: hy, z: hz, s: hs, skin: SKIN.brown, ears: 'round', nose: 'long', hair: 'short', hairC: HAIR.silver, beard: 'moustache', beardC: HAIR.silver, brow: 0xC8CCD4, browTilt: 0.1 }),
          ...both((sx) => [fur(SOFT, HAIR.silver, [sx * hs * 0.42, hy - hs * 0.02, hz - hs * 0.02], [hs * 0.14, hs * 0.38, hs * 0.4])]), // sideburns
          // top hat on the hair: brim, tall crown, plum band
          cloth(CYL, hat, [0, hb, hz], [hs * 1.9, 0.04, hs * 1.8], [-0.06, 0, 0.04]),
          cloth(CYL, hat, [0, hb + hs * 0.42, hz - 0.01], [hs * 0.98, hs * 0.84, hs * 0.96], [-0.06, 0, 0.04]),
          cloth(CYL, hat, [0, hb + hs * 0.86, hz - 0.02], [hs * 1.04, 0.04, hs * 1.02], [-0.06, 0, 0.04]),
          cloth(CYL, satin, [0, hb + hs * 0.1, hz], [hs * 1.0, hs * 0.16, hs * 0.98], [-0.06, 0, 0.04]),
        ],
        eyes: (vc) => EYES.human(vc, hz + hs * 0.43, hs, { tilt: 0.05 }),
        arms: [
          [...arm({ r: 0.1, up: coat, fore: coat, sh: coat, foreF: 'cloth', hand: glove, handF: 'cloth' }), cloth(CYL, shirt, [0, -0.9, 0.07], [0.2, 0.08, 0.2]),
            wood(CYL, 0x5A3A26, [0, -1.1, 0.2], [0.05, 0.16, 0.05], [1.0, 0, 0]), // cork grip
            seg([0, -1.06, 0.26], [0, -0.66, 0.86], 0.016, 0xF4F2EE, 'paint'), glow(SPH, gl, [0, -0.64, 0.88], 0.06)], // baton
          [...arm({ r: 0.1, up: coat, fore: coat, sh: coat, foreF: 'cloth', hand: glove, handF: 'cloth' }), cloth(CYL, shirt, [0, -0.9, 0.07], [0.2, 0.08, 0.2])],
        ],
        handAt: [0, -0.64, 0.88],
        leg: { r: 0.11, thigh: pants, shin: pants, boot: shoe, bootF: 'metal' },
        legExtra: (H) => [cloth(CYL, glove, [0, -H + 0.24, 0.03], [0.25, 0.13, 0.27]), cloth(BOX, satin, [0, -H * 0.5, 0.115], [0.04, H * 0.8, 0.02])],
        skirtAt: [0, hip + 0.1, 0],
        skirt: [...both((sx) => [cloth(RBOX, coat, [sx * 0.12, -0.42, -td * 0.5], [0.2, 0.86, 0.04], [-0.1, 0, sx * 0.06]),
          cloth(CONE4, coat, [sx * 0.13, -0.92, -td * 0.55], [0.18, 0.24, 0.04], [PI - 0.1, PI / 4, 0])]), // tailcoat tails
          ...both((sx) => [cloth(RBOX, coat, [sx * 0.2, -0.1, td * 0.35], [0.16, 0.18, 0.04], [0.05, sx * 0.3, 0])])],
        extra: [
          { name: 'pack', parent: 'lean', at: [0, mid + 0.12, -td * 0.52], parts: [
            wood(RBOX, 0x4A2620, [0, 0, -0.12], [0.62, 0.74, 0.28]),
            metal(RBOX, BRASS, [0, 0.38, -0.12], [0.66, 0.05, 0.32]), metal(RBOX, BRASS, [0, -0.38, -0.12], [0.66, 0.05, 0.32]),
            ...[[0.12, 0.2], [-0.16, 0.14]].flatMap(([y, r]) => [rubber(CYL, DARK, [0, y, -0.27], [r * 2, 0.04, r * 2], [PI / 2, 0, 0]),
              metal(TORUS, BRASS, [0, y, -0.28], [r * 2, r * 2, 0.3]), glow(SPH, gl, [0, y, -0.29], [r * 0.6, r * 0.6, 0.06])]),
            // gramophone horn rising over the weapon shoulder
            ...chain([[-0.18, 0.3, -0.08], [-0.3, 0.6, -0.04], [-0.36, 0.86, 0.04]], 0.06, 0.07, BRASS, 'metal'),
            orient(BELL, BRASS, [-0.4, 1.06, -0.06], [0.62, 0.42, 0.62], [0.25, -0.75, 0.5], [0, 0, 1], 'metal'),
            rubber(CYL, 0x5A3A12, [-0.39, 1.02, -0.04], [0.2, 0.02, 0.2], [-0.5, 0, 0.25]),
          ] },
        ],
        halo: ring(4, (k, a) => {
          const p = [Math.cos(a) * 1.3, 2.3 + (k % 2) * 0.25, Math.sin(a) * 1.3], col = k % 2 ? gl : tint(acc, 0xffffff, 0.3);
          return [glow(SPH, col, p, [0.2, 0.15, 0.08], [0, -a, 0.4]), glow(BOX, col, [p[0] + 0.08, p[1] + 0.2, p[2]], [0.035, 0.42, 0.035], [0, -a, 0]),
            glow(BOX, col, [p[0] + 0.14, p[1] + 0.38, p[2]], [0.14, 0.05, 0.035], [0, -a, -0.5])];
        }),
      };
    },
  },

  // PINBALL ROBOT: a round barrel cabinet with rubber bumper bands and chase lights, chrome-ball head with a dark screen face
  // under a backwards cap, pogo-spring legs, twin pistols and a glass drum magazine of pinballs on the back.
  rico: {
    plan: { hip: 0.95, tw: 1.0, th: 1.0, td: 0.9, hs: 0.46, neck: 0.06, ax: 0.62, legX: 0.24, scale: [1.0, 0.95] },
    gait: { cad: 1.35, swing: 0.55, bob: 0.4, lean: 0.18, float: 0, sq: 0.16 },
    build(c) {
      const { hip, tw, th, td, top, hy, hz, hs, main, gl } = c, mid = hip + th * 0.5;
      const chrome = 0xD8DEE6, shell = main, white = 0xF6F6F6, cap = 0x2E3440, flash = 0xFFE45C;
      return {
        body: [
          metal(CYL, shell, [0, mid, 0], [tw, th * 0.72, td]),
          metal(DOME, shell, [0, mid + th * 0.36, 0], [tw, 0.5, td]),
          metal(DOME, shade(shell, 0.75), [0, mid - th * 0.36, 0], [tw * 0.98, 0.38, td * 0.98], [PI, 0, 0]),
          ...[mid + th * 0.3, mid - th * 0.3].map((y) => rubber(TORUS, white, [0, y, 0], [tw * 0.96, td * 0.96, 0.45], [PI / 2, 0, 0])), // bumper bands
          ...ring(12, (k, a) => [glow(SPH, k % 2 ? flash : gl, [Math.sin(a) * tw * 0.5, mid + 0.04, Math.cos(a) * td * 0.5], 0.08)]), // chase lights
          rubber(RBOX, DARK, [0, mid - 0.16, td * 0.47], [0.5, 0.24, 0.08]), // score display
          ...[-1, 0, 1].map((x) => glow(BOX, flash, [x * 0.14, mid - 0.16, td * 0.52], [0.08, 0.13, 0.02])),
          metal(CYL, chrome, [0, mid + 0.18, td * 0.5], [0.16, 0.04, 0.16], [PI / 2, 0, 0]), glow(CYL, gl, [0, mid + 0.18, td * 0.52], [0.1, 0.02, 0.1], [PI / 2, 0, 0]), // bumper cap
          steel(CYL, 0x4A505A, [0, top + 0.02, hz], [0.2, 0.18, 0.2]),
          // head: polished pinball with a dark screen face, ear bolts and a backwards cap
          metal(SPH, chrome, [0, hy, hz], hs * 1.0),
          rubber(SPH, DARK, [0, hy - 0.02, hz + hs * 0.12], [hs * 0.86, hs * 0.56, hs * 0.8]),
          ...both((sx) => [metal(CYL, shell, [sx * hs * 0.5, hy, hz], [0.14, 0.08, 0.14], [0, 0, PI / 2]), glow(SPH, gl, [sx * hs * 0.55, hy, hz], 0.05)]),
          cloth(DOME, cap, [0, hy + hs * 0.14, hz - 0.01], [hs * 1.04, hs * 0.86, hs * 1.04], [-0.12, 0, 0]),
          cloth(RBOX, shell, [0, hy + hs * 0.2, hz - hs * 0.66], [hs * 0.72, 0.045, hs * 0.5], [0.12, 0, 0]), // brim to the back
          cloth(SPH, shell, [0, hy + hs * 0.58, hz - 0.04], 0.07),
          ...ring(6, (k, a) => [cloth(BOX, shade(cap, 0.7), [Math.sin(a) * hs * 0.36, hy + hs * 0.38, hz + Math.cos(a) * hs * 0.36], [0.02, hs * 0.34, 0.02], [Math.cos(a) * -0.75, 0, Math.sin(a) * 0.75])]),
        ],
        eyes: (vc) => EYES.glow(vc, hz + hs * 0.53, hs, { gap: 0.19, w: 0.2, h: 0.2 }),
        arms: [0, 1].map(() => [
          metal(SPH, shell, [0, 0, 0], 0.24),
          ...[0, 1, 2, 3].map((k) => rubber(TORUS, DARK, [0, -0.12 - k * 0.1, 0.01], [0.17, 0.17, 0.5], [PI / 2, 0, 0])), // accordion upper arm
          metal(SPH, chrome, [0, -0.52, 0.03], 0.17),
          seg([0, -0.56, 0.04], [0, -0.92, 0.08], 0.07, chrome, 'metal'),
          rubber(SOFT, DARK, [0, -0.98, 0.1], [0.15, 0.17, 0.16]),
          // chunky retro pistol
          rubber(RBOX, DARK, [0, -1.08, 0.12], [0.08, 0.18, 0.1], [-0.2, 0, 0]),
          metal(RBOX, shell, [0, -1.0, 0.26], [0.11, 0.14, 0.34]),
          steel(CYL, chrome, [0, -0.98, 0.5], [0.09, 0.22, 0.09], [PI / 2, 0, 0]), metal(TORUS, chrome, [0, -0.98, 0.62], [0.12, 0.12, 0.3]),
          glow(CYL, gl, [0, -0.98, 0.62], [0.06, 0.02, 0.06], [PI / 2, 0, 0]),
        ]),
        handAt: [0, -0.98, 0.66],
        legParts: (sx, H) => [
          metal(SPH, chrome, [0, 0, 0], 0.2),
          steel(CYL, 0x4A505A, [0, -H * 0.4, 0.02], [0.07, H * 0.7, 0.07]),
          ...[0, 1, 2, 3, 4, 5].map((k) => metal(TORUS, chrome, [0, -0.18 - k * 0.1, 0.02], [0.2, 0.2, 0.45], [PI / 2, 0, 0])), // pogo spring
          rubber(CYL, DARK, [0, -H + 0.09, 0.05], [0.36, 0.16, 0.42]),
          rubber(TORUS, white, [0, -H + 0.1, 0.05], [0.36, 0.42, 0.5], [PI / 2, 0, 0]),
        ],
        extra: [
          { name: 'drum', parent: 'lean', at: [0, mid + 0.06, -td * 0.62], parts: [
            rubber(CYL, DARK, [0, 0, 0], [0.86, 0.3, 0.86], [PI / 2, 0, 0]),
            metal(TORUS, shell, [0, 0, -0.14], [0.86, 0.86, 0.5]),
            ...ring(5, (k, a) => [metal(SPH, chrome, [Math.cos(a) * 0.22, Math.sin(a) * 0.22, -0.13], 0.15)]),
            metal(SPH, chrome, [0, 0, -0.1], 0.12),
            clear(CYL, 0xCFEFFF, [0, 0, -0.16], [0.68, 0.02, 0.68], [PI / 2, 0, 0]),
            glow(TORUS, gl, [0, 0, -0.17], [0.7, 0.7, 0.2]),
          ] },
        ],
      };
    },
    // The pinball drum turns, spinning up when he fires.
    anim(m, t, dt, h) { m.x.drum.rotation.z += dt * (0.6 + 9 * k01(h)); },
  },

  // PLANT-FOLK treant-turtle: bark hide, mossy shoulders, a living domed shell with hex scutes and saplings, a beaked bark
  // head poking out of the shell with branching antlers, stump legs and a knotted wooden club.
  mossback: {
    plan: { hip: 1.0, tw: 1.3, th: 1.05, td: 0.95, hs: 0.54, neck: 0.0, hunch: 0.3, ax: 0.84, legX: 0.36, scale: [1.15, 1.0], hy: 2.2, hz: 0.5 },
    gait: { cad: 0.7, swing: 0.55, bob: 0.18, lean: 0.12, float: 0, sq: 0.12 },
    build(c) {
      const { hip, tw, th, td, top, hy, hz, hs, main, acc, gl } = c, mid = hip + th * 0.5;
      const bark = shade(acc, 0.95), barkD = shade(acc, 0.65), moss = main, mossL = tint(main, 0xE8F080, 0.25), plast = 0xC9A86A, shellC = shade(main, 0.7), leafC = 0x86C84E;
      const C = [0, mid + 0.22, -td * 0.32], R = [tw * 0.66, th * 0.66, td * 0.6];
      const onShell = (d) => { const n = Math.hypot(...d), u = d.map((v) => v / n); return [[C[0] + u[0] * R[0], C[1] + u[1] * R[1], C[2] + u[2] * R[2]], [u[0] / R[0], u[1] / R[1], u[2] / R[2]]]; };
      const scute = (d, s) => { const [p, nn] = onShell(d); return [orient(CYL6, shade(acc, 0.55), p, [s * 1.12, 0.06, s * 1.12], nn, [0, 0, 1], 'wood'), orient(CYL6, mossL, p.map((v, i) => v + nn[i] * 0.08), [s, 0.08, s], nn, [0, 0, 1], 'fur')]; };
      const sapling = (d, h) => { const [p] = onShell(d); return [seg(p, [p[0], p[1] + h, p[2] - 0.05], 0.025, barkD, 'wood'),
        ...[0, 1, 2].map((k) => { const a = k * 2.1; return orient(LEAF, k % 2 ? leafC : mossL, [p[0] + Math.cos(a) * 0.1, p[1] + h + 0.04, p[2] + Math.sin(a) * 0.1], [0.12, 0.24, 0.3], [Math.cos(a), 0.7, Math.sin(a)], [0, 1, 0], 'cloth'); })]; };
      const antler = (sx) => [
        ...chain([[sx * hs * 0.3, hy + hs * 0.3, hz - 0.08], [sx * 0.42, hy + 0.45, hz - 0.12], [sx * 0.58, hy + 0.72, hz - 0.2], [sx * 0.54, hy + 0.96, hz - 0.28]], 0.065, 0.03, barkD, 'wood'),
        seg([sx * 0.44, hy + 0.5, hz - 0.12], [sx * 0.32, hy + 0.8, hz - 0.02], 0.032, barkD, 'wood'),
        seg([sx * 0.58, hy + 0.74, hz - 0.2], [sx * 0.8, hy + 0.88, hz - 0.18], 0.028, barkD, 'wood'),
        ...[[0.54, 0.98, -0.28], [0.32, 0.82, -0.02], [0.82, 0.9, -0.18]].map(([x, y, z], k) => orient(LEAF, k % 2 ? leafC : mossL, [sx * x, hy + y + 0.06, hz + z], [0.14, 0.26, 0.3], [sx * 0.3, 1, 0.2], [0, 0, 1], 'cloth')),
      ];
      return {
        body: [
          wood(HEAD, bark, [0, top - 0.38, 0.02], [tw * 1.04, th * 0.82, td * 1.02]),
          wood(HEAD, bark, [0, hip + 0.32, 0], [tw * 0.92, th * 0.7, td * 0.94]),
          wood(HEAD, shade(plast, 0.6), [0, mid - 0.02, td * 0.2], [tw * 0.74, th * 0.94, td * 0.66]), // plastron rim
          ...[[-1, 0.22], [1, 0.22], [-1, -0.08], [1, -0.08], [-1, -0.38], [1, -0.38]].map(([x, y]) => orient(CYL6, plast, [x * tw * 0.13, mid + y, td * 0.52 - Math.abs(y + 0.08) * 0.14], [tw * 0.24, 0.05, 0.26], [x * 0.18, -y * 0.5, 1], [0, 1, 0], 'wood')), // plastron scutes
          // living shell
          stone(SPH, shellC, C, [R[0] * 2, R[1] * 2, R[2] * 2]),
          ...scute([0, 0.35, -1], 0.42), ...[0, 1, 2, 3, 4].flatMap((k) => scute([Math.cos(k * 1.26 - 0.3) * 0.9, 0.35 + Math.sin(k * 1.26 - 0.3) * 0.75, -0.55], 0.32)),
          ...sapling([0.25, 1, -0.3], 0.32), ...sapling([-0.45, 0.85, -0.4], 0.22), ...sapling([0.6, 0.5, -0.6], 0.18),
          ...both((sx) => [fur(ICO1, moss, [sx * tw * 0.44, top - 0.02, 0.08], [0.6, 0.34, 0.64]), ...shag(sx * tw * 0.44, top - 0.08, 0.1, 0.24, 0.26, 5, 0.2, 0.12, mossL, 0.6)]),
          // head poking out of the shell: bark neck, beaked bark face, mossy brow, antlers with leaves
          seg([0, top - 0.25, 0.15], [0, hy - 0.12, hz - 0.1], 0.2, barkD, 'wood'),
          wood(HEAD, bark, [0, hy, hz], [hs * 0.96, hs * 0.84, hs * 1.12]),
          wood(HEAD, barkD, [0, hy - hs * 0.22, hz + hs * 0.36], [hs * 0.72, hs * 0.34, hs * 0.5]), // beak
          rubber(RBOX, 0x2A1E14, [0, hy - hs * 0.26, hz + hs * 0.6], [hs * 0.46, 0.025, 0.03]),
          wood(CONE4, barkD, [0, hy - hs * 0.18, hz + hs * 0.66], [hs * 0.16, hs * 0.2, hs * 0.14], [PI / 2 + 0.6, PI / 4, 0]),
          fur(SOFT, moss, [0, hy + hs * 0.2, hz + hs * 0.38], [hs * 0.92, hs * 0.16, hs * 0.26], [0.2, 0, 0]),
          fur(ICO1, mossL, [0, hy + hs * 0.38, hz - 0.02], [hs * 0.7, hs * 0.26, hs * 0.7]),
          ...both((sx) => [wood(BOX, barkD, [sx * hs * 0.3, hy - hs * 0.02, hz + hs * 0.44], [0.02, hs * 0.3, 0.02], [0.2, 0, sx * 0.2]), ...antler(sx)]),
        ],
        eyes: (vc) => EYES.bead(vc, hz + hs * 0.54, hs, { gap: 0.24, w: 0.13, h: 0.12, y: 0.04 }),
        arms: [
          [...arm({ r: 0.19, fr: 0.21, len: 1.1, up: bark, fore: bark, sh: moss, shF: 'fur', upF: 'wood', foreF: 'wood', hand: barkD, handF: 'wood', paw: true }),
            fur(CYL, moss, [0, -0.72, 0.05], [0.44, 0.16, 0.44]),
            // knotted club with a mossy cap and a sprout
            wood(CYL, barkD, [0, -1.12, 0.45], [0.1, 0.8, 0.1], [PI / 2 - 0.1, 0, 0]),
            wood(CAP, bark, [0, -1.18, 1.05], [0.36, 0.42, 0.36], [PI / 2 - 0.1, 0, 0]),
            ...[[0.16, 0.1, 0.95], [-0.15, -0.08, 1.15], [0.05, -0.16, 0.9]].map(([x, y, z]) => wood(SPH, barkD, [x, -1.18 + y, z], 0.14)),
            fur(ICO1, moss, [0, -1.02, 1.12], [0.34, 0.16, 0.4]),
            orient(LEAF, leafC, [0.05, -0.86, 1.18], [0.12, 0.26, 0.3], [0.3, 1, 0.2], [0, 0, 1], 'cloth')],
          [...arm({ r: 0.19, fr: 0.21, len: 1.1, up: bark, fore: bark, sh: moss, shF: 'fur', upF: 'wood', foreF: 'wood', hand: barkD, handF: 'wood', paw: true }),
            fur(CYL, moss, [0, -0.72, 0.05], [0.44, 0.16, 0.44])],
        ],
        handAt: [0, -1.18, 1.1],
        leg: { r: 0.22, thigh: bark, shin: bark, thighF: 'wood', shinF: 'wood', boot: barkD, bootF: 'wood' },
        legExtra: (H) => [fur(CYL, moss, [0, -H * 0.5, 0.05], [0.44, 0.12, 0.44]),
          ...[-1, 0, 1].map((x) => wood(CONE, barkD, [x * 0.16, -H + 0.06, 0.42], [0.12, 0.3, 0.1], [PI / 2 + 0.2, 0, x * 0.3]))], // root toes
        tailAt: [0, hip + 0.1, -td * 0.7],
        tail: [wood(CONE, bark, [0, -0.05, -0.15], [0.16, 0.36, 0.16], [-PI / 2 - 0.4, 0, 0])],
      };
    },
  },

  // ROCK TROLL: hunched craggy giant, head slung low between boulder shoulders, under-bite tusks, knuckle-dragging stone arms,
  // amber crack veins, rope belt and leather loincloth, a boulder hammer lashed to a log.
  tremor: {
    plan: { hip: 0.98, tw: 1.3, th: 1.15, td: 0.85, hs: 0.56, neck: 0, hunch: 0.4, ax: 0.94, legX: 0.32, scale: [1.18, 1.0], hy: 2.1, hz: 0.56 },
    gait: { cad: 0.65, swing: 0.55, bob: 0.22, lean: 0.1, float: 0, sq: 0.14 },
    build(c) {
      const { hip, tw, th, td, top, hy, hz, hs, main, gl } = c, mid = hip + th * 0.5;
      const rock = main, rockL = tint(main, 0xEDE0CC, 0.25), rockD = shade(main, 0.6), leather = 0x5E4430, ivory = 0xEDE3CC, amber = 0xFF9A00, rope = 0x6A5638;
      return {
        body: [
          stone(HEAD, rock, [0, top - 0.4, 0.08], [tw * 1.12, th * 0.82, td * 1.08]),
          stone(DODE, rockL, [0, hip + 0.36, 0.1], [tw * 0.86, th * 0.62, td * 0.92], [0.2, 0.3, 0]),
          stone(HEAD, rockD, [0, hip + 0.1, 0], [tw * 0.8, 0.5, td * 0.82]),
          stone(DODE, rockD, [0, top - 0.12, -td * 0.24], [tw * 0.95, 0.8, td * 0.95], [0.3, 0.2, 0.1]), // hump
          ...[[-0.25, 0.25, 0.42, 0.42], [0.28, 0.18, 0.44, 0.36], [0.0, -0.18, 0.46, 0.4]].map(([x, y, z, s], k) => stone(DODE, k % 2 ? rockL : rock, [x, mid + y, z], [s * 1.1, s * 0.8, s * 0.5], [0.2, k, 0.3])),
          ...zig([-0.34, mid + 0.42, td * 0.62], [0.08, mid - 0.12, td * 0.66], 4, 0.06, 0.04, 0.03, amber, 1),
          ...zig([0.38, mid + 0.36, td * 0.58], [0.24, mid - 0.25, td * 0.62], 3, 0.05, 0.035, 0.025, amber, 4),
          cloth(TORUS, rope, [0, hip + 0.16, 0.04], [tw * 0.7, td * 0.8, 0.45], [PI / 2, 0, 0]),
          // boulder shoulders rising above the head
          ...both((sx) => [stone(DODE, rockL, [sx * tw * 0.5, top + 0.12, -0.04], [0.86, 0.72, 0.8], [0.3, sx * 0.5, 0.2]),
            stone(DODE, rock, [sx * tw * 0.6, top + 0.44, -0.18], [0.42, 0.38, 0.42], [0.4, sx, 0]),
            glow(CONE6, amber, [sx * tw * 0.42, top + 0.48, -0.2], [0.12, 0.36, 0.12], [-0.2, 0, sx * -0.4])]),
          // troll head: low craggy skull, heavy brow, bulb nose, wide under-bite jaw with tusks, little pointed ears
          stone(DODE, rock, [0, hy + hs * 0.1, hz - 0.08], [hs * 1.0, hs * 0.84, hs * 0.96], [0.2, 0.3, 0]),
          ...both((sx) => [stone(DODE, rockD, [sx * hs * 0.22, hy + hs * 0.2, hz + hs * 0.36], [hs * 0.5, hs * 0.26, hs * 0.34], [0.3, sx * 0.4, sx * 0.35])]),
          stone(SOFT, rockL, [0, hy - hs * 0.3, hz + hs * 0.14], [hs * 1.12, hs * 0.55, hs * 0.86]),
          rubber(RBOX, 0x2A2420, [0, hy - hs * 0.16, hz + hs * 0.57], [hs * 0.62, 0.03, 0.03]),
          stone(SPH, rockL, [0, hy + hs * 0.0, hz + hs * 0.52], [hs * 0.32, hs * 0.34, hs * 0.3]),
          ...both((sx) => [stone(CONE, ivory, [sx * hs * 0.3, hy - hs * 0.12, hz + hs * 0.58], [hs * 0.15, hs * 0.46, hs * 0.15], [-0.2, 0, sx * -0.22]),
            stone(CONE, rock, [sx * hs * 0.52, hy + hs * 0.06, hz - 0.08], [hs * 0.16, hs * 0.42, hs * 0.12], [0, 0, sx * -1.3])]),
          stone(DODE, rockD, [0, hy + hs * 0.36, hz - hs * 0.2], [hs * 0.7, hs * 0.3, hs * 0.6], [0.3, 0.5, 0]), glow(CONE6, amber, [hs * 0.15, hy + hs * 0.5, hz - hs * 0.3], [0.08, 0.24, 0.08], [-0.3, 0, -0.3]),
        ],
        eyes: (vc) => EYES.bead(vc, hz + hs * 0.5, hs, { gap: 0.22, w: 0.16, h: 0.13, y: 0.08 }),
        arms: [
          [...arm({ r: 0.2, fr: 0.23, len: 1.3, up: rock, fore: rockL, sh: rock, shF: 'stone', upF: 'stone', foreF: 'stone', hand: rockD, handF: 'stone', paw: true }),
            stone(DODE, rockD, [0.04, -0.95, -0.04], [0.52, 0.44, 0.52], [0.3, 0.6, 0]), stone(DODE, rockL, [-0.08, -0.32, -0.02], [0.4, 0.34, 0.4], [0.5, 0.2, 0]),
            // boulder hammer: rough log haft, lashed rock head with an amber rune
            wood(CYL, WOOD, [0, -0.95, 0.32], [0.13, 1.5, 0.13], [0.16, 0, 0]),
            stone(DODE, rockL, [0, -0.16, 0.44], [0.86, 0.64, 0.66], [0.2, 0.4, 0]),
            stone(DODE, rock, [0.28, -0.2, 0.46], [0.46, 0.4, 0.44], [0.6, 0, 0.3]),
            cloth(TORUS, rope, [0, -0.3, 0.44], [0.36, 0.36, 0.7], [PI / 2, 0, 0]),
            glow(OCT, amber, [0, -0.12, 0.78], [0.18, 0.26, 0.05])],
          [...arm({ r: 0.2, fr: 0.23, len: 1.3, up: rock, fore: rockL, sh: rock, shF: 'stone', upF: 'stone', foreF: 'stone', hand: rockD, handF: 'stone', paw: true }),
            stone(DODE, rockD, [-0.04, -0.95, -0.04], [0.52, 0.44, 0.52], [0.3, 0.6, 0]), stone(DODE, rockL, [0.08, -0.32, -0.02], [0.4, 0.34, 0.4], [0.5, 0.2, 0])],
        ],
        handAt: [0, -1.3, 0.3],
        leg: { r: 0.22, thigh: rock, shin: rockL, thighF: 'stone', shinF: 'stone', boot: rockD, bootF: 'stone' },
        legExtra: (H) => [...[-1, 0, 1].map((x) => stone(DODE, rockD, [x * 0.15, -H + 0.08, 0.42], [0.17, 0.14, 0.17]))],
        skirtAt: [0, hip + 0.1, 0],
        skirt: [cloth(RBOX, leather, [0, -0.3, td * 0.52], [0.56, 0.62, 0.04], [0.08, 0, 0]), cloth(RBOX, leather, [0, -0.28, -td * 0.46], [0.7, 0.6, 0.04], [-0.08, 0, 0]),
          ...[-1, 1].map((x) => cloth(BOX, shade(leather, 0.7), [x * 0.2, -0.3, td * 0.55], [0.03, 0.5, 0.02]))],
      };
    },
  },

  // FLOWER FAIRY: delicate garden fairy, rosy face under a blooming petal-crown hairdo, leaf bodice and leaf-petal dress,
  // translucent petal wings, a flower staff and a wrapped bouquet on her back. Orbiting petals.
  bloom: {
    plan: { hip: 1.28, tw: 0.6, th: 0.9, td: 0.38, hs: 0.44, neck: 0.12, ax: 0.42, legX: 0.13, scale: [0.95, 0.95] },
    gait: { cad: 1.2, swing: 0.6, bob: 0.3, lean: 0.15, float: 0, sq: 0.1 },
    build(c) {
      const { hip, tw, th, td, top, hy, hz, hs, main, acc, gl } = c, mid = hip + th * 0.5;
      const pet = main, petL = tint(main, 0xffffff, 0.4), leafC = 0x6DBE4B, leafD = 0x4A9A3A, stem = 0x5E9E3A, gold = 0xFFD85A, sk = SKIN.fair, cream = acc;
      return {
        body: [
          ...torso({ hip, th, tw, td, c: leafC, waist: 0.6, chest: 0.84 }),
          ...[-1, 0, 1].map((x) => orient(LEAF, x ? leafD : leafC, [x * tw * 0.16, mid + 0.06, td * 0.42], [0.2, 0.5, 0.3], [x * 0.4, 1, 0.1], [0, 0, 1], 'cloth')),
          ...ring(7, (k, a) => [orient(LEAF, k % 2 ? pet : petL, [Math.sin(a) * 0.18, top + 0.02, hz + Math.cos(a) * 0.16], [0.14, 0.24, 0.3], [Math.sin(a), 0.5, Math.cos(a)], [Math.sin(a) * -0.5, 1, Math.cos(a) * -0.5], 'cloth')]), // petal collar
          skin(CYL, sk, [0, top + 0.08, hz], [0.13, 0.2, 0.13]),
          ...face({ y: hy, z: hz, s: hs, skin: sk, ears: 'elf', nose: 'button', hair: 'bob', hairC: pet, brow: shade(pet, 0.6), jaw: 0.92 }),
          ...both((sx) => [part(SPH, 0xFFA8B4, [sx * hs * 0.24, hy - hs * 0.14, hz + hs * 0.38], [hs * 0.13, hs * 0.07, 0.03], undefined, 'skin')]),
          // petal-crown hair: two rings of petals blooming up around the head with a golden pollen centre on top
          ...flower([0, hy + hs * 0.16, hz - hs * 0.06], [0, 1, -0.2], 0.52, 7, pet, gold, 0.75, 0.62, 'cloth', 'glow', shade(pet, 0.88)),
          ...flower([0, hy + hs * 0.3, hz - hs * 0.08], [0, 1, -0.2], 0.32, 5, petL, gold, 1.0, 0.7, 'cloth', 'glow'),
          ...both((sx) => [orient(LEAF, pet, [sx * hs * 0.42, hy - hs * 0.32, hz + 0.02], [0.14, 0.42, 0.3], [sx * 0.15, -1, 0.1], [sx, 0, 0.3], 'cloth')]), // petal locks
        ],
        eyes: (vc) => EYES.human(vc, hz + hs * 0.43, hs, { w: 0.22, h: 0.15, tilt: -0.05 }),
        arms: [
          [...arm({ r: 0.075, len: 0.95, up: sk, fore: sk, sh: leafC, upF: 'skin', shF: 'cloth' }),
            ...[0, 1, 2].map((k) => orient(LEAF, k % 2 ? petL : pet, [Math.cos(k * 2.1) * 0.08, -0.02, Math.sin(k * 2.1) * 0.08], [0.16, 0.24, 0.3], [Math.cos(k * 2.1), -0.4, Math.sin(k * 2.1)], [0, 1, 0], 'cloth')),
            // flower staff: curling green stem, two leaves, a big open bloom on top
            ...chain([[0, -1.42, 0.2], [0.03, -0.95, 0.24], [-0.02, -0.45, 0.28], [0.02, -0.08, 0.32]], 0.035, 0.03, stem, 'wood'),
            ...both((sx) => [orient(LEAF, leafC, [sx * 0.1, -0.55, 0.28], [0.12, 0.28, 0.3], [sx, 0.6, 0], [0, 0, 1], 'cloth')]),
            ...flower([0, 0.02, 0.34], [0, 0.55, 1], 0.36, 6, pet, gold, 0.35, 0.62, 'cloth', 'glow', petL)],
          [...arm({ r: 0.075, len: 0.95, up: sk, fore: sk, sh: leafC, upF: 'skin', shF: 'cloth' }),
            ...[0, 1, 2].map((k) => orient(LEAF, k % 2 ? petL : pet, [Math.cos(k * 2.1) * 0.08, -0.02, Math.sin(k * 2.1) * 0.08], [0.16, 0.24, 0.3], [Math.cos(k * 2.1), -0.4, Math.sin(k * 2.1)], [0, 1, 0], 'cloth'))],
        ],
        handAt: [0, 0.02, 0.4],
        leg: { r: 0.08, thigh: 0x9AD07A, shin: 0x9AD07A, boot: pet, bootF: 'cloth' },
        legExtra: (H) => [...ring(4, (k, a) => [orient(LEAF, leafC, [Math.sin(a) * 0.07, -H + 0.3, Math.cos(a) * 0.07], [0.1, 0.2, 0.3], [Math.sin(a) * 0.5, 1, Math.cos(a) * 0.5], [Math.sin(a), 0, Math.cos(a)], 'cloth')])],
        skirtAt: [0, hip + 0.08, 0],
        skirt: [...ring(10, (k, a) => [orient(LEAF, k % 2 ? leafD : leafC, [Math.sin(a) * 0.3, -0.26, Math.cos(a) * 0.24], [0.28, 0.62, 0.3], [Math.sin(a) * 0.45, -1, Math.cos(a) * 0.45], [Math.sin(a), 0.45, Math.cos(a)], 'cloth')]),
          ...ring(8, (k, a) => [orient(LEAF, k % 2 ? pet : petL, [Math.sin(a + 0.3) * 0.26, -0.12, Math.cos(a + 0.3) * 0.2], [0.24, 0.42, 0.3], [Math.sin(a + 0.3) * 0.55, -1, Math.cos(a + 0.3) * 0.55], [Math.sin(a + 0.3), 0.55, Math.cos(a + 0.3)], 'cloth')])],
        extra: [
          ...both((sx) => [{ name: sx < 0 ? 'wingL' : 'wingR', parent: 'lean', at: [sx * 0.1, top - 0.12, -td * 0.42], parts: [
            orient(LEAF, tint(pet, 0xffffff, 0.55), [sx * 0.36, 0.26, -0.08], [0.42, 0.8, 0.3], [sx, 0.75, -0.25], [0, 0, 1], 'glass'),
            orient(LEAF, tint(gl, 0xffffff, 0.4), [sx * 0.28, -0.2, -0.06], [0.3, 0.56, 0.3], [sx, -0.6, -0.25], [0, 0, 1], 'glass'),
            glow(SPH, gold, [0, 0, 0], 0.07)].map((q) => (q.f === 'glass' ? { ...q, clear: true } : q)) }]),
          { name: 'bouquet', parent: 'lean', at: [0, mid + 0.02, -td * 0.62], parts: [
            cloth(CONE, cream, [0, -0.08, -0.05], [0.32, 0.6, 0.26], [PI + 0.25, 0, 0]),
            cloth(TORUS, pet, [0, 0.02, -0.04], [0.2, 0.2, 0.4], [PI / 2 + 0.25, 0, 0]),
            ...[[-0.14, 0.5, -0.12, pet], [0.15, 0.44, -0.1, 0xF4E8FF], [0.0, 0.62, -0.2, cream], [-0.05, 0.4, 0.04, 0xC9A8FF]].flatMap(([x, y, z, col]) => [
              seg([0, 0.05, -0.05], [x, y - 0.05, z], 0.02, stem, 'wood'), ...flower([x, y, z], [x * 2, 1, -0.3], 0.24, 5, col, gold, 0.6, 0.6, 'cloth', 'paint')]),
            ...both((sx) => [orient(LEAF, leafD, [sx * 0.15, 0.25, -0.02], [0.12, 0.32, 0.3], [sx, 1, 0], [0, 0, -1], 'cloth')]),
          ] },
        ],
        halo: ring(6, (k, a) => [part(LEAF, k % 2 ? pet : petL, [Math.cos(a) * 1.3, 1.75 + (k % 2) * 0.25, Math.sin(a) * 1.3], [0.2, 0.32, 0.4], [0.4, -a, 0.6], 'cloth')]),
      };
    },
    // Petal wings flutter; faster while casting.
    anim(m, t, dt, h) {
      const k = k01(h), f = Math.sin(t * (9 + 10 * k)) * (0.22 + 0.2 * k);
      m.x.wingL.rotation.y = -0.2 - f; m.x.wingR.rotation.y = 0.2 + f;
    },
  },

  // GOBLIN mechanic: small wiry green goblin, long ears, black mohawk, goggles up on the forehead, crimson overalls and tool belt,
  // a huge double-bit axe taller than he is, a spinning circular saw strapped to his back.
  rotor: {
    plan: { hip: 0.88, tw: 0.7, th: 0.78, td: 0.46, hs: 0.5, neck: 0.06, hunch: 0.12, ax: 0.45, legX: 0.15, scale: [0.88, 0.84] },
    gait: { cad: 1.3, swing: 1.0, bob: 0.14, lean: 0.3, float: 0, sq: 0.08 },
    build(c) {
      const { hip, tw, th, td, top, hy, hz, hs, main, acc, gl } = c, mid = hip + th * 0.5;
      const gsk = 0x86B84A, over = shade(main, 0.85), shirt = 0x5E5650, belt = 0x4A3424, boot = 0x3A2A20, hair = 0x24202A;
      return {
        body: [
          cloth(CYL, over, [0, hip + 0.04, 0], [tw * 0.66, 0.26, td * 0.84]),
          ...torso({ hip, th, tw, td, c: shirt, waist: 0.7, chest: 0.92, belly: 0.66, bellyC: over }),
          cloth(RBOX, over, [0, mid + 0.06, td * 0.36], [tw * 0.56, th * 0.56, 0.16]), // overall bib
          ...both((sx) => [cloth(RBOX, over, [sx * tw * 0.2, top - 0.12, 0], [0.08, 0.06, td * 1.02]), metal(SPH, BRASS, [sx * tw * 0.2, mid + 0.3, td * 0.45], 0.04)]), // straps
          cloth(RBOX, acc, [0.08, mid + 0.02, td * 0.45], [0.14, 0.12, 0.02], [0, 0, 0.2]), // patch
          rubber(CYL, belt, [0, hip + 0.16, 0], [tw * 0.74, 0.09, td * 0.92]),
          steel(RBOX, STEEL, [tw * 0.36, hip + 0.06, 0.06], [0.04, 0.3, 0.06], [0, 0, 0.2]), steel(TORUS, STEEL, [tw * 0.38, hip - 0.1, 0.06], [0.1, 0.1, 0.3], [0, PI / 2, 0]), // wrench
          rubber(RBOX, belt, [-tw * 0.34, hip + 0.08, 0.1], [0.14, 0.16, 0.12]),
          skin(CYL, gsk, [0, top + 0.04, hz], [0.15, 0.16, 0.15]),
          ...face({ y: hy, z: hz, s: hs, skin: gsk, ears: 'long', nose: 'long', hair: 'mohawk', hairC: hair, brow: hair, browTilt: 0.28, jaw: 1.1, tusks: true }),
          stone(RBOX, 0xF4F0E0, [0, hy - hs * 0.29, hz + hs * 0.43], [hs * 0.3, hs * 0.06, 0.02]), // grin
          // goggles pushed up on the forehead
          rubber(CYL, DARK, [0, hy + hs * 0.26, hz - 0.01], [hs * 0.97, hs * 0.1, hs * 0.99], [-0.28, 0, 0]),
          ...both((sx) => [metal(TORUS, BRASS, [sx * hs * 0.17, hy + hs * 0.32, hz + hs * 0.38], [hs * 0.28, hs * 0.28, hs * 0.6], [-0.5, 0, 0]),
            glow(CYL, gl, [sx * hs * 0.17, hy + hs * 0.32, hz + hs * 0.38], [hs * 0.22, 0.02, hs * 0.22], [PI / 2 - 0.5, 0, 0])]),
        ],
        eyes: (vc) => EYES.human(vc, hz + hs * 0.43, hs, { w: 0.2, h: 0.12, tilt: 0.18 }),
        arms: [
          [...arm({ r: 0.085, len: 0.86, up: shirt, fore: gsk, sh: shirt, upF: 'cloth', foreF: 'skin', hand: gsk }), rubber(CYL, belt, [0, -0.72, 0.06], [0.2, 0.1, 0.2]),
            // the axe: a long haft taller than the goblin, double crimson bits with steel edges
            wood(CYL, WOOD, [0, -0.3, 0.2], [0.09, 2.0, 0.09], [0.1, 0, 0]),
            rubber(CYL, DARK, [0, -1.0, 0.13], [0.09, 0.26, 0.09], [0.1, 0, 0]),
            steel(RBOX, STEEL, [0, 0.56, 0.29], [0.1, 0.26, 0.14], [0.1, 0, 0]),
            ...both((sz) => [steel(FAN, 0xC8CED6, [0, 0.56 - sz * 0.01, 0.29 + sz * 0.1], [0.8, 1.0, 1.0], [sz * PI / 2 + 0.1, 0, PI / 2]),
              metal(FAN, main, [0, 0.56 - sz * 0.01, 0.29 + sz * 0.1], [0.62, 1.8, 0.82], [sz * PI / 2 + 0.1, 0, PI / 2])]),
            steel(CONE4, STEEL, [0, 0.82, 0.32], [0.06, 0.2, 0.06], [0.1, 0, 0])],
          [...arm({ r: 0.085, len: 0.86, up: shirt, fore: gsk, sh: shirt, upF: 'cloth', foreF: 'skin', hand: gsk }), rubber(CYL, belt, [0, -0.72, 0.06], [0.2, 0.1, 0.2])],
        ],
        handAt: [0, -0.86, 0.2],
        leg: { r: 0.09, thigh: over, shin: over, boot, bootF: 'rubber' },
        legExtra: (H) => [cloth(CYL, shade(over, 0.85), [0, -H + 0.26, 0.02], [0.22, 0.08, 0.22]), rubber(SOFT, boot, [0, -H + 0.08, 0.16], [0.24, 0.18, 0.3])],
        extra: [
          { name: 'saw', parent: 'lean', at: [0, mid + 0.18, -td * 0.62], parts: [
            steel(CYL, 0xC8CED6, [0, 0, 0], [1.0, 0.035, 1.0], [PI / 2, 0, 0]),
            ...ring(14, (k, a) => [steel(CONE4, STEEL, [Math.cos(a) * 0.52, Math.sin(a) * 0.52, 0], [0.09, 0.14, 0.03], [0, 0, a - PI / 2 + 0.4])]),
            metal(CYL, main, [0, 0, -0.03], [0.34, 0.06, 0.34], [PI / 2, 0, 0]), ...ring(5, (k, a) => [steel(SPH, STEEL, [Math.cos(a) * 0.11, Math.sin(a) * 0.11, -0.07], 0.04)]),
            steel(CYL, DARK, [0, 0, -0.06], [0.1, 0.06, 0.1], [PI / 2, 0, 0]),
          ] },
          { name: 'sawMount', parent: 'lean', at: [0, mid + 0.18, -td * 0.5], parts: [rubber(RBOX, DARK, [0, 0, 0.02], [0.2, 0.5, 0.08]), steel(RBOX, STEEL, [0, -0.32, -0.02], [0.3, 0.18, 0.18])] },
        ],
      };
    },
    // The back saw idles, and screams up to speed when he swings or runs.
    anim(m, t, dt, h) { m.x.saw.rotation.z += dt * (2 + 16 * k01(h) + 5 * (h.moveAmt ?? 0)); },
  },

  // GNOME jet-ranger: short, round-bellied gnome with a big rosy nose, white moustache and sideburns, huge brass goggles over
  // magnified eyes, leather aviator cap with ear flaps, sheepskin collar, twin-tank jetpack, flared brass scatter blaster.
  flint: {
    plan: { hip: 0.74, tw: 0.84, th: 0.78, td: 0.64, hs: 0.54, neck: 0.04, ax: 0.5, legX: 0.18, scale: [0.84, 0.8] },
    gait: { cad: 1.4, swing: 0.6, bob: 0.3, lean: 0.2, float: 0, sq: 0.14 },
    build(c) {
      const { hip, tw, th, td, top, hy, hz, hs, main, acc, gl } = c, mid = hip + th * 0.5;
      const jacket = shade(main, 0.9), shirt = 0x5E7A8C, capC = 0x6A4026, white = 0xEEEAE2, sk = SKIN.rose, pants = 0x4A4038, boot = 0x3A2A20;
      return {
        body: [
          cloth(CYL, pants, [0, hip + 0.04, 0], [tw * 0.7, 0.24, td * 0.84]),
          ...torso({ hip, th, tw, td, c: jacket, waist: 0.72, chest: 0.98, belly: 0.98, bellyC: shirt }),
          rubber(CYL, 0x3A2618, [0, hip + 0.14, 0.02], [tw * 0.92, 0.1, td * 1.04]), metal(RBOX, BRASS, [0, hip + 0.14, td * 0.54], [0.16, 0.12, 0.04]),
          ...both((sx) => [cloth(RBOX, shade(jacket, 0.8), [sx * tw * 0.3, mid + 0.06, td * 0.44], [0.08, th * 0.7, 0.05], [0, sx * 0.4, 0])]),
          fur(TORUS, acc, [0, top + 0.0, 0.02], [0.5, 0.44, 0.6], [PI / 2, 0, 0]), // sheepskin collar
          ...face({ y: hy, z: hz, s: hs, skin: sk, ears: 'none', nose: 'none', hair: null, brow: white, browTilt: -0.2, jaw: 1.05 }),
          skin(SPH, 0xF0A090, [0, hy - hs * 0.2, hz + hs * 0.52], [hs * 0.36, hs * 0.32, hs * 0.3]), // big round nose
          ...both((sx) => [fur(CAP, white, [sx * hs * 0.18, hy - hs * 0.34, hz + hs * 0.42], [hs * 0.14, hs * 0.22, hs * 0.14], [0, 0, sx * 1.1]), // moustache
            fur(SOFT, white, [sx * hs * 0.38, hy - hs * 0.16, hz + hs * 0.1], [hs * 0.2, hs * 0.42, hs * 0.36]), // sideburns
            cloth(SOFT, capC, [sx * hs * 0.44, hy - hs * 0.1, hz - 0.04], [hs * 0.16, hs * 0.52, hs * 0.38]), // ear flaps
            metal(TORUS, BRASS, [sx * hs * 0.21, hy + hs * 0.04, hz + hs * 0.45], [hs * 0.4, hs * 0.4, hs * 0.9]),
            clear(CYL, 0xBFE8FF, [sx * hs * 0.21, hy + hs * 0.04, hz + hs * 0.5], [hs * 0.38, 0.02, hs * 0.38], [PI / 2, 0, 0])]),
          cloth(HEAD, capC, [0, hy + hs * 0.16, hz - hs * 0.05], [hs * 1.04, hs * 0.88, hs * 1.04]), // aviator cap
          cloth(TORUS, shade(capC, 0.8), [0, hy + hs * 0.1, hz - hs * 0.06], [hs * 0.9, hs * 0.92, hs * 0.3], [PI / 2 - 0.1, 0, 0]),
          rubber(CYL, DARK, [0, hy + hs * 0.04, hz - 0.02], [hs * 1.02, hs * 0.14, hs * 1.02]),
          metal(BOX, BRASS, [0, hy + hs * 0.06, hz + hs * 0.5], [hs * 0.08, hs * 0.06, hs * 0.06]),
        ],
        eyes: (vc) => EYES.human(vc, hz + hs * 0.46, hs, { gap: 0.21, w: 0.25, h: 0.2, y: 0.04 }),
        arms: [
          [...arm({ r: 0.1, len: 0.78, up: jacket, fore: jacket, sh: jacket, foreF: 'cloth', hand: 0x5A3A26, handF: 'rubber' }), fur(CYL, acc, [0, -0.64, 0.06], [0.24, 0.1, 0.24]),
            // flared brass scatter blaster
            wood(RBOX, WOOD, [0, -0.84, 0.02], [0.1, 0.16, 0.4], [0.1, 0, 0]),
            metal(CYL, BRASS, [0, -0.77, 0.5], [0.13, 0.7, 0.13], [PI / 2, 0, 0]),
            ...[0.36, 0.62].map((z) => metal(TORUS, 0xB86A3A, [0, -0.77, z], [0.17, 0.17, 0.4])),
            orient(BELL, BRASS, [0, -0.77, 0.98], [0.34, 0.32, 0.34], [0, 0, -1], [0, 1, 0], 'metal'),
            rubber(CYL, 0x5A3A12, [0, -0.77, 0.92], [0.22, 0.02, 0.22], [PI / 2, 0, 0]), glow(CYL, gl, [0, -0.77, 0.93], [0.1, 0.02, 0.1], [PI / 2, 0, 0])],
          [...arm({ r: 0.1, len: 0.78, up: jacket, fore: jacket, sh: jacket, foreF: 'cloth', hand: 0x5A3A26, handF: 'rubber' }), fur(CYL, acc, [0, -0.64, 0.06], [0.24, 0.1, 0.24])],
        ],
        handAt: [0, -0.77, 1.02],
        leg: { r: 0.11, thigh: pants, shin: pants, boot, bootF: 'rubber' },
        legExtra: (H) => [rubber(SOFT, boot, [0, -H + 0.09, 0.14], [0.28, 0.2, 0.36]), fur(CYL, acc, [0, -H + 0.24, 0.02], [0.26, 0.08, 0.26])],
        tailAt: [0.12, top + 0.0, -0.2],
        tail: chain([[0, 0, 0], [0.06, -0.1, -0.16], [0.12, -0.24, -0.3], [0.14, -0.36, -0.36]], 0.07, 0.05, acc, 'cloth'),
        extra: [
          { name: 'jet', parent: 'lean', at: [0, mid + 0.1, -td * 0.56], parts: [
            rubber(RBOX, DARK, [0, 0, 0.02], [0.5, 0.56, 0.08]),
            ...both((sx) => [metal(CAP, BRASS, [sx * 0.19, 0.02, -0.14], [0.26, 0.3, 0.26]), metal(CYL, main, [sx * 0.19, 0.02, -0.14], [0.28, 0.08, 0.28]),
              steel(CONE, STEEL, [sx * 0.19, -0.38, -0.14], [0.18, 0.16, 0.18], [PI, 0, 0]),
              metal(CONE4, main, [sx * 0.36, -0.1, -0.14], [0.05, 0.26, 0.16], [0, 0, sx * -0.3])]),
          ] },
          { name: 'flame', parent: 'lean', at: [0, mid - 0.32, -td * 0.56 - 0.14], parts: both((sx) => [glow(CONE, 0xFF6A10, [sx * 0.19, -0.14, 0], [0.14, 0.32, 0.14], [PI, 0, 0]), glow(CONE, 0xFFC040, [sx * 0.19, -0.08, 0], [0.07, 0.18, 0.07], [PI, 0, 0])]) },
        ],
      };
    },
    // Jet flames flicker and flare on shots and while running.
    anim(m, t, dt, h) {
      const k = k01(h), f = 0.7 + Math.sin(t * 31) * 0.12 + 0.5 * k + 0.3 * (h.moveAmt ?? 0);
      m.x.flame.scale.set(1, f, 1);
    },
  },

  // PISTON MECH: an industrial engine-block chassis with no neck (a caged cyclops lamp sunk into the chest), twin exhaust
  // stacks, hazard stripes, a pressure gauge, exposed hydraulic pistons, two giant gauntlets with punch rams, press-foot legs.
  torque: {
    plan: { hip: 1.1, tw: 1.3, th: 1.05, td: 0.9, hs: 0.36, neck: 0, hunch: 0.2, ax: 0.92, legX: 0.33, scale: [1.1, 1.0], hy: 1.98, hz: 0.42 },
    gait: { cad: 0.75, swing: 0.6, bob: 0.18, lean: 0.15, float: 0, sq: 0.1 },
    build(c) {
      const { hip, tw, th, td, top, hy, hz, main, acc, gl } = c, mid = hip + th * 0.5;
      const dark = acc, chrome = 0xD0D6DE, pipe = 0x4A4E56, haz = 0xF2C230;
      const gauntlet = (sx) => [
        metal(SPH, dark, [0, 0, 0], 0.36),
        steel(CYL, pipe, [0, -0.28, 0], [0.16, 0.5, 0.16]), metal(CYL, chrome, [0, -0.52, 0], [0.1, 0.3, 0.1]),
        steel(SPH, dark, [0, -0.62, 0.02], 0.26),
        metal(RBOX, main, [0, -0.92, 0.06], [0.5, 0.56, 0.56]),
        ...[0, 1, 2].map((k) => rubber(BOX, k % 2 ? dark : haz, [0, -0.78 - k * 0.1, 0.35], [0.5, 0.06, 0.02], [0, 0, 0.5])),
        steel(CYL, pipe, [sx * 0.28, -0.88, -0.04], [0.12, 0.5, 0.12]), metal(CYL, chrome, [sx * 0.28, -0.58, -0.04], [0.06, 0.3, 0.06]), // forearm piston
        metal(RBOX, dark, [0, -1.26, 0.1], [0.56, 0.36, 0.56]),
        ...[-1.5, -0.5, 0.5, 1.5].map((x) => steel(RBOX, STEEL, [x * 0.12, -1.2, 0.38], [0.1, 0.18, 0.08])), // knuckle plates
        glow(BOX, gl, [0, -0.98, -0.23], [0.3, 0.06, 0.02]),
      ];
      return {
        body: [
          steel(RBOX, dark, [0, hip + 0.12, 0], [tw * 0.6, 0.36, td * 0.7]),
          steel(CYL, pipe, [0, hip + 0.38, 0], [tw * 0.56, 0.16, td * 0.6]), // waist gimbal
          metal(RBOX, main, [0, mid + 0.22, 0], [tw, th * 0.74, td]),
          metal(RBOX, shade(main, 0.85), [0, mid - 0.12, 0.02], [tw * 0.8, 0.24, td * 0.9]),
          rubber(RBOX, dark, [0, mid - 0.0, td * 0.5], [tw * 0.6, 0.34, 0.06]), // radiator grille
          ...[0, 1, 2, 3].map((k) => steel(BOX, STEEL, [0, mid - 0.12 + k * 0.08, td * 0.54], [tw * 0.56, 0.03, 0.03])),
          ...[-2, -1, 0, 1, 2].map((k) => rubber(BOX, k % 2 ? dark : haz, [k * 0.2, top - 0.05, td * 0.51], [0.13, 0.1, 0.02], [0, 0, 0.6])), // hazard band
          // pressure gauge
          metal(CYL, BRASS, [tw * 0.32, mid + 0.48, td * 0.5], [0.22, 0.06, 0.22], [PI / 2, 0, 0]), part(CYL, 0xF4F0E6, [tw * 0.32, mid + 0.48, td * 0.53], [0.17, 0.02, 0.17], [PI / 2, 0, 0]),
          rubber(BOX, 0xC03020, [tw * 0.33, mid + 0.5, td * 0.545], [0.015, 0.08, 0.01], [0, 0, -0.7]),
          // sunken cyclops lamp housing (no neck, no visor slit)
          steel(CYL, dark, [0, hy, hz - 0.08], [0.48, 0.3, 0.48], [PI / 2, 0, 0]), metal(TORUS, chrome, [0, hy, hz + 0.08], [0.4, 0.4, 0.6]),
          ...[-1, 0, 1].map((k) => steel(BOX, STEEL, [0, hy + k * 0.08, hz + 0.15], [0.36, 0.02, 0.02])),
          metal(RBOX, main, [0, hy + 0.21, hz - 0.02], [0.6, 0.08, 0.32], [0.25, 0, 0]),
          // side pistons hip -> shoulder
          ...both((sx) => [steel(CYL, pipe, [sx * tw * 0.52, mid - 0.1, -0.1], [0.12, 0.5, 0.12], [0, 0, sx * 0.2]), metal(CYL, chrome, [sx * tw * 0.47, mid + 0.25, -0.1], [0.07, 0.4, 0.07], [0, 0, sx * 0.2])]),
          ...[[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([x, y]) => steel(SPH, STEEL, [x * tw * 0.44, mid + 0.22 + y * th * 0.3, td * 0.5], 0.06)), // rivets
          steel(RBOX, dark, [0, mid + 0.2, -td * 0.52], [tw * 0.7, th * 0.6, 0.1]), // engine back plate
        ],
        eyes: (vc) => [part(SPH, vc, [0, 0, hz + 0.09], [0.3, 0.3, 0.06]), part(SPH, 0xFFFFFF, [0.05, 0.05, hz + 0.12], [0.07, 0.07, 0.02])],
        arms: [gauntlet(-1), gauntlet(1)],
        handAt: [0, -1.26, 0.5],
        legParts: (sx, H) => [
          steel(SPH, dark, [0, 0, 0], 0.3),
          metal(RBOX, main, [0, -0.28, 0.02], [0.38, 0.5, 0.42]),
          steel(SPH, dark, [0, -0.56, 0.06], 0.28),
          steel(CYL, pipe, [0, -0.74, 0.02], [0.24, 0.32, 0.24]), metal(CYL, chrome, [0, -0.92, 0.0], [0.13, 0.22, 0.13]),
          seg([0, -0.4, -0.2], [0, -0.92, -0.16], 0.04, chrome, 'metal'),
          rubber(RBOX, dark, [0, -H + 0.1, 0.1], [0.46, 0.2, 0.66]),
          metal(RBOX, main, [0, -H + 0.18, 0.36], [0.42, 0.12, 0.2]),
          rubber(BOX, haz, [0, -H + 0.12, 0.44], [0.42, 0.04, 0.02]),
        ],
        extra: [
          { name: 'stacks', parent: 'lean', at: [0, top, -td * 0.3], parts: both((sx) => [
            steel(CYL, pipe, [sx * 0.36, 0.3, 0], [0.2, 0.9, 0.2]), steel(CYL, dark, [sx * 0.36, 0.76, 0], [0.26, 0.08, 0.26]),
            ...[0.05, 0.3].map((y) => metal(TORUS, chrome, [sx * 0.36, y, 0], [0.24, 0.24, 0.4], [PI / 2, 0, 0])),
            steel(CYL, dark, [sx * 0.36, 0.84, -0.06], [0.24, 0.03, 0.24], [-0.6, 0, 0]), // flap lids
            glow(CYL, gl, [sx * 0.36, 0.79, 0], [0.13, 0.02, 0.13])]) },
          ...both((sx) => [{ name: sx < 0 ? 'ram0' : 'ram1', parent: sx < 0 ? 'arm0' : 'arm1', at: [0, -1.26, 0.38], parts: [metal(CYL, chrome, [0, 0, 0], [0.16, 0.26, 0.16], [PI / 2, 0, 0]), steel(CYL, dark, [0, 0, 0.14], [0.36, 0.06, 0.36], [PI / 2, 0, 0])] }]),
        ],
      };
    },
    // Punch rams fire out of the fists on attacks; the stacks rattle with the engine.
    anim(m, t, dt, h) {
      const a = Math.min(1, (h.atkT ?? 0) * 1.4), mv = h.moveAmt ?? 0;
      m.x.ram0.position.z = 0.38 + a * 0.32;
      m.x.ram1.position.z = 0.38 + Math.min(1, (h.castT ?? 0) * 1.4) * 0.32;
      m.x.stacks.position.y = m.x.stacks.userData.y + Math.abs(Math.sin(t * (18 + 14 * mv))) * 0.025;
    },
  },
};
