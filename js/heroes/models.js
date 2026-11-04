// Procedural hero models: primitives merged per material, outline hull, separate eyes (for blinks).
import * as THREE from 'three';
import { PAL, TEAM } from '../config.js';
import { toonMat, toonMesh, mergeParts } from '../render/toon.js';

const SPH = new THREE.SphereGeometry(1, 12, 8);
const CONE = new THREE.ConeGeometry(1, 1, 8);
const CAPS = new THREE.CapsuleGeometry(0.1, 0.4, 3, 8);
const FRONT = [Math.PI / 2, 0, 0]; // cone axis +Y -> +Z

// Returns { root, lean, eyes, tail, mats } — hero.js animates lean / eyes / tail and flashes mats.
export function buildZip(team = 0) {
  const cream = 0xFFF1DC, orange = PAL.zip;
  const mat = toonMat({ vertexColors: true });

  const bodyGeo = mergeParts([
    { g: SPH, c: orange, p: [0, 0.78, 0], s: [0.58, 0.68, 0.52] },                    // torso
    { g: SPH, c: cream, p: [0, 0.72, 0.26], s: [0.38, 0.5, 0.3] },                    // belly
    { g: SPH, c: orange, p: [0, 1.58, 0.05], s: [0.74, 0.64, 0.66] },                 // head
    { g: CONE, c: cream, p: [0, 1.44, 0.68], s: [0.28, 0.5, 0.28], r: FRONT },        // snout
    { g: SPH, c: PAL.ink, p: [0, 1.5, 0.95], s: 0.09 },                               // nose
    { g: CONE, c: orange, p: [-0.4, 2.15, 0], s: [0.24, 0.6, 0.2], r: [0, 0, 0.25] }, // ears
    { g: CONE, c: orange, p: [0.4, 2.15, 0], s: [0.24, 0.6, 0.2], r: [0, 0, -0.25] },
    { g: CONE, c: cream, p: [-0.4, 2.1, 0.06], s: [0.13, 0.4, 0.1], r: [0, 0, 0.25] },
    { g: CONE, c: cream, p: [0.4, 2.1, 0.06], s: [0.13, 0.4, 0.1], r: [0, 0, -0.25] },
    { g: SPH, c: cream, p: [-0.28, 0.12, 0.15], s: [0.2, 0.14, 0.28] },               // feet
    { g: SPH, c: cream, p: [0.28, 0.12, 0.15], s: [0.2, 0.14, 0.28] },
    { g: CAPS, c: orange, p: [-0.62, 0.9, 0.1], r: [0, 0, 0.5] },                     // arms
    { g: CAPS, c: orange, p: [0.62, 0.9, 0.1], r: [0, 0, -0.5] },
    { g: new THREE.TorusGeometry(0.72, 0.07, 6, 18), c: 0x3A3A5A, p: [0, 1.82, 0.04], s: [1, 1, 0.9], r: [Math.PI / 2, 0, 0] }, // goggle strap
    { g: SPH, c: PAL.shield, p: [0, 1.95, 0.52], s: [0.3, 0.2, 0.12] },               // goggle lens
    { g: new THREE.CylinderGeometry(0.03, 0.03, 0.35, 5), c: TEAM[team].deep, p: [0, 2.3, 0] }, // team antenna
    { g: SPH, c: TEAM[team].main, p: [0, 2.52, 0], s: 0.14 },
  ]);

  const eyesGeo = mergeParts([-1, 1].flatMap((sx) => [
    { g: SPH, c: 0xffffff, p: [sx * 0.27, 0, 0.55], s: [0.17, 0.2, 0.1] },
    { g: SPH, c: PAL.ink, p: [sx * 0.27, 0, 0.62], s: [0.1, 0.12, 0.06] },
    { g: SPH, c: 0xffffff, p: [sx * 0.24, 0.05, 0.67], s: 0.035 },
  ]));

  const tailGeo = mergeParts([
    { g: CONE, c: orange, p: [0, 0.35, -0.2], s: [0.28, 0.9, 0.28], r: [-2.2, 0, 0] },
  ]);

  const root = new THREE.Group();
  const lean = new THREE.Group();
  root.add(lean);
  lean.add(toonMesh(bodyGeo, mat, 0.035));

  const eyes = new THREE.Mesh(eyesGeo, mat);
  eyes.position.y = 1.6;
  lean.add(eyes);

  const tail = new THREE.Group();
  tail.position.set(0, 0.55, -0.45);
  tail.add(toonMesh(tailGeo, mat, 0.035));
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), new THREE.MeshBasicMaterial({ color: PAL.gold }));
  tip.position.set(0, 0.95, -0.95);
  tail.add(tip);
  lean.add(tail);

  return { root, lean, eyes, tail, mats: [mat] };
}

// ---- shared assembly for the other heroes ----
const ink = PAL.ink;
const eyePair = (x, z, k = 1) => mergeParts([-1, 1].flatMap((sx) => [
  { g: SPH, c: 0xffffff, p: [sx * x, 0, z], s: [0.17 * k, 0.2 * k, 0.1 * k] },
  { g: SPH, c: ink, p: [sx * x, 0, z + 0.07 * k], s: [0.1 * k, 0.12 * k, 0.06 * k] },
  { g: SPH, c: 0xffffff, p: [sx * (x - 0.03 * k), 0.05 * k, z + 0.12 * k], s: 0.035 * k },
]));

function starGeo(r, depth) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r, a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    if (i) s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }).translate(0, 0, -depth / 2);
}

// body / eyes / tail geometry -> { root, lean, eyes, tail, mats }. tail pivots at tailPos; extra meshes ride on the tail.
function assemble({ mat, body, eyes, eyeY, tail, tailPos, extra = [] }) {
  const root = new THREE.Group();
  const lean = new THREE.Group();
  root.add(lean);
  lean.add(toonMesh(body, mat, 0.035));
  const eyeMesh = new THREE.Mesh(eyes, mat);
  eyeMesh.position.y = eyeY;
  lean.add(eyeMesh);
  const tailG = new THREE.Group();
  tailG.position.set(...tailPos);
  tailG.add(toonMesh(tail, mat, 0.035), ...extra);
  lean.add(tailG);
  return { root, lean, eyes: eyeMesh, tail: tailG, mats: [mat] };
}

const antenna = (team, y) => [
  { g: new THREE.CylinderGeometry(0.03, 0.03, 0.35, 5), c: TEAM[team].deep, p: [0, y, 0] },
  { g: SPH, c: TEAM[team].main, p: [0, y + 0.22, 0], s: 0.14 },
];

// Moss — chunky moss-green bear with stone shoulders and a flower on its head.
export function buildMoss(team = 0) {
  const moss = PAL.moss, light = 0xB4E38E, stone = 0x9A9AB8;
  const petals = [0, 1, 2, 3, 4].map((i) => {
    const a = (i / 5) * Math.PI * 2;
    return { g: SPH, c: 0xFF8EC4, p: [Math.cos(a) * 0.17, 2.42, 0.18 + Math.sin(a) * 0.17], s: 0.12 };
  });
  const body = mergeParts([
    { g: SPH, c: moss, p: [0, 0.85, 0], s: [0.8, 0.85, 0.7] },                 // torso
    { g: SPH, c: light, p: [0, 0.8, 0.38], s: [0.5, 0.55, 0.3] },              // belly
    { g: SPH, c: moss, p: [0, 1.78, 0.05], s: [0.78, 0.68, 0.7] },             // head
    { g: SPH, c: moss, p: [-0.55, 2.28, -0.05], s: [0.24, 0.24, 0.16] },       // ears
    { g: SPH, c: moss, p: [0.55, 2.28, -0.05], s: [0.24, 0.24, 0.16] },
    { g: SPH, c: light, p: [-0.55, 2.26, 0.04], s: [0.13, 0.13, 0.08] },
    { g: SPH, c: light, p: [0.55, 2.26, 0.04], s: [0.13, 0.13, 0.08] },
    { g: SPH, c: light, p: [0, 1.62, 0.62], s: [0.32, 0.24, 0.26] },           // snout
    { g: SPH, c: ink, p: [0, 1.7, 0.86], s: [0.12, 0.09, 0.08] },              // nose
    { g: SPH, c: stone, p: [-0.8, 1.38, 0], s: [0.34, 0.26, 0.34] },           // stone shoulders
    { g: SPH, c: stone, p: [0.8, 1.38, 0], s: [0.34, 0.26, 0.34] },
    { g: CAPS, c: moss, p: [-0.9, 0.85, 0.1], s: 1.6, r: [0, 0, 0.3] },        // arms
    { g: CAPS, c: moss, p: [0.9, 0.85, 0.1], s: 1.6, r: [0, 0, -0.3] },
    { g: SPH, c: light, p: [-0.38, 0.14, 0.2], s: [0.3, 0.16, 0.36] },         // feet
    { g: SPH, c: light, p: [0.38, 0.14, 0.2], s: [0.3, 0.16, 0.36] },
    ...petals,
    { g: SPH, c: PAL.gold, p: [0, 2.44, 0.18], s: 0.1 },                       // flower centre
    { g: new THREE.TorusGeometry(0.58, 0.1, 6, 14), c: TEAM[team].main, p: [0, 1.28, 0.04], r: [Math.PI / 2, 0, 0] }, // team scarf
  ]);
  return assemble({
    mat: toonMat({ vertexColors: true }), body, eyes: eyePair(0.3, 0.6, 1.1), eyeY: 1.82,
    tail: mergeParts([{ g: SPH, c: moss, p: [0, 0, -0.1], s: 0.22 }]), tailPos: [0, 0.7, -0.62],
  });
}

// Luma — lilac bunny mage with a star wand and a little cape.
export function buildLuma(team = 0) {
  const lilac = PAL.luma, light = 0xF2E6FF, pink = 0xFF9AD5;
  const body = mergeParts([
    { g: SPH, c: lilac, p: [0, 0.8, 0], s: [0.5, 0.62, 0.45] },                // torso
    { g: SPH, c: light, p: [0, 0.74, 0.22], s: [0.32, 0.42, 0.22] },           // belly
    { g: SPH, c: lilac, p: [0, 1.58, 0.04], s: [0.66, 0.58, 0.6] },            // head
    { g: CAPS, c: lilac, p: [-0.28, 2.38, 0], s: [1.2, 2, 1], r: [0, 0, 0.18] }, // long ears
    { g: CAPS, c: lilac, p: [0.28, 2.38, 0], s: [1.2, 2, 1], r: [0, 0, -0.18] },
    { g: CAPS, c: pink, p: [-0.28, 2.36, 0.08], s: [0.6, 1.5, 0.5], r: [0, 0, 0.18] },
    { g: CAPS, c: pink, p: [0.28, 2.36, 0.08], s: [0.6, 1.5, 0.5], r: [0, 0, -0.18] },
    { g: SPH, c: light, p: [0, 1.45, 0.5], s: [0.2, 0.15, 0.16] },             // muzzle
    { g: SPH, c: pink, p: [0, 1.5, 0.64], s: 0.07 },                           // nose
    { g: SPH, c: pink, p: [-0.4, 1.45, 0.42], s: [0.1, 0.06, 0.04] },          // cheeks
    { g: SPH, c: pink, p: [0.4, 1.45, 0.42], s: [0.1, 0.06, 0.04] },
    { g: SPH, c: light, p: [-0.22, 0.12, 0.15], s: [0.18, 0.12, 0.26] },       // feet
    { g: SPH, c: light, p: [0.22, 0.12, 0.15], s: [0.18, 0.12, 0.26] },
    { g: CAPS, c: lilac, p: [-0.5, 0.85, 0.1], r: [0, 0, 0.5] },               // arms
    { g: CAPS, c: lilac, p: [0.5, 0.85, 0.1], r: [0, 0, -0.5] },
    { g: new THREE.CylinderGeometry(0.035, 0.035, 0.9, 5), c: 0xC69B6D, p: [0.74, 1.15, 0.36], r: [0.5, 0, 0] }, // wand
    { g: starGeo(0.3, 0.12), c: PAL.gold, p: [0.74, 1.62, 0.58] },             // wand star
  ]);
  const cape = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1, 8).scale(1, 1, 0.22).translate(0, -0.5, 0), new THREE.MeshBasicMaterial({ color: TEAM[team].main, side: THREE.DoubleSide }));
  return assemble({
    mat: toonMat({ vertexColors: true }), body, eyes: eyePair(0.22, 0.52, 0.95), eyeY: 1.62,
    tail: mergeParts([{ g: SPH, c: light, p: [0, -0.1, -0.15], s: 0.18 }]), tailPos: [0, 1.1, -0.36], extra: [cape],
  });
}

// Clink — navy robot penguin with a teal visor and a backpack snow cannon.
export function buildClink(team = 0) {
  const navy = 0x34407F, white = 0xF4F8FF, orange = 0xFFA23D, teal = 0x3DE0D0;
  const body = mergeParts([
    { g: SPH, c: navy, p: [0, 0.9, 0], s: [0.62, 0.78, 0.55] },                // torso
    { g: SPH, c: white, p: [0, 0.84, 0.26], s: [0.42, 0.62, 0.3] },            // belly
    { g: SPH, c: navy, p: [0, 1.78, 0.02], s: [0.58, 0.5, 0.52] },             // head
    { g: SPH, c: teal, p: [0, 1.82, 0.36], s: [0.5, 0.24, 0.22] },             // visor
    { g: CONE, c: orange, p: [0, 1.6, 0.6], s: [0.14, 0.3, 0.14], r: FRONT },  // beak
    { g: CAPS, c: navy, p: [-0.72, 1.0, 0], s: 1.2, r: [0, 0, 0.9] },          // flippers
    { g: CAPS, c: navy, p: [0.72, 1.0, 0], s: 1.2, r: [0, 0, -0.9] },
    { g: SPH, c: orange, p: [-0.25, 0.1, 0.25], s: [0.22, 0.1, 0.32] },        // feet
    { g: SPH, c: orange, p: [0.25, 0.1, 0.25], s: [0.22, 0.1, 0.32] },
    ...antenna(team, 2.2),
  ]);
  const pack = mergeParts([
    { g: SPH, c: 0x2A3366, p: [0, 0, 0], s: [0.4, 0.45, 0.28] },               // backpack
    { g: new THREE.CylinderGeometry(0.13, 0.17, 0.7, 8), c: white, p: [0, 0.5, -0.1], r: [-0.45, 0, 0] }, // cannon
    { g: SPH, c: TEAM[team].main, p: [0, 0.82, -0.28], s: 0.12 },
  ]);
  return assemble({
    mat: toonMat({ vertexColors: true }), body, eyes: eyePair(0.16, 0.56, 0.8), eyeY: 1.82,
    tail: pack, tailPos: [0, 1.0, -0.5],
  });
}
