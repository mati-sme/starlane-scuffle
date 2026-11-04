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
