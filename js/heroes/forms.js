// v7.3 bespoke bodies for the original 24 champions (buildChampion routes by def.id, so roster.js `model:` specs are
// untouched) plus the shared assembler that wave2b_models.js also uses. A body is { plan, gait, build(c), anim }:
// build returns part lists for the groups hero.js animates (lean / eyes / arms / hand / orb / skirt / tail / legs / halo)
// and any named live `extra` groups; anim(m, t, dt, h) runs per frame for flourishes.
import * as THREE from 'three';
import { TEAM } from '../config.js';
import { toonMat, toonMesh, mergeParts } from '../render/toon.js';
import { SPH, ground, tint, leg, digiLeg, meshParts, clearMat } from './anatomy.js';
import { FORMS_A } from './forms_a.js';
import { FORMS_B } from './forms_b.js';

export const FORMS = { ...FORMS_A, ...FORMS_B };

const DEF_PLAN = { hip: 1.3, tw: 0.9, th: 1.05, td: 0.6, hs: 0.4, neck: 0.14, hunch: 0, ax: 0.66, legX: 0.22 };

// Build context c = { hip, tw, th, td, top, hy, hz, hs, ax, main, acc, gl, fx } -> B = {
//   body, eyes(vc) (around (0, 0, z), positioned at hy), arms: [weapon side, off side] (shoulder space),
//   leg / legDigi (anatomy opts) | legParts(sx, H) (per side) | legs: 'none', legExtra(H),
//   skirt, skirtAt, tail, tailAt, halo, extra: [{ name, parent, at, parts }], shY, handAt, eyesY }
export function assemble(D, spec, def, team = 0) {
  const pl = { ...DEF_PLAN, ...D.plan };
  const main = ground(def.color, 0.06), acc = ground(def.accent, 0.04), gl = tint(def.fx?.color ?? def.basic?.color ?? def.accent, 0xffffff, 0.1);
  const top = pl.hip + pl.th, hz = pl.hunch * 0.9;
  const c = { ...pl, top, hy: pl.hy ?? top + pl.neck + pl.hs * 0.55, hz: pl.hz ?? hz, main, acc, gl, fx: def.fx, bc: def.basic?.color ?? gl };
  const B = D.build(c);
  const mat = toonMat({ vertexColors: true, finish: true, rim: 0.3 }), clr = clearMat();
  const mesh = (P, k = 0.03) => meshParts(P, mat, clr, k);

  const lean = new THREE.Group();
  lean.add(mesh(B.body));
  const vc = new THREE.Color(TEAM[team].main).lerp(new THREE.Color(0xffffff), 0.35).getHex();
  const eyes = new THREE.Mesh(mergeParts(B.eyes(vc)), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
  eyes.position.y = B.eyesY ?? c.hy;
  lean.add(eyes);

  const shY = B.shY ?? top - 0.1;
  const armGroups = [-1, 1].map((sx, i) => {
    const g = new THREE.Group();
    g.position.set(sx * pl.ax, shY, pl.hunch * 0.3);
    g.add(mesh(B.arms[i]));
    lean.add(g);
    return g;
  });
  const hand = new THREE.Object3D();
  hand.position.set(...(B.handAt ?? [0, -1.1, 0.35]));
  armGroups[0].add(hand);
  const orb = new THREE.Mesh(SPH, new THREE.MeshBasicMaterial({ color: new THREE.Color(gl).multiplyScalar(1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  orb.visible = false;
  hand.add(orb);

  const sk = new THREE.Group();
  sk.position.set(...(B.skirtAt ?? [0, pl.hip + 0.02, pl.td * 0.42]));
  if (B.skirt?.length) sk.add(mesh(B.skirt, 0.02));
  lean.add(sk);

  const tail = new THREE.Group();
  tail.position.set(...(B.tailAt ?? [0, top - 0.5, -pl.td / 2]));
  if (B.tail?.length) tail.add(mesh(B.tail));
  lean.add(tail);

  // Legs: one shared geometry, or per-side parts (asymmetric / hidden legs for floaters).
  let shared = null;
  if (!B.legParts && B.legs !== 'none') {
    const L = B.legDigi ? digiLeg(pl.hip, B.legDigi) : leg(pl.hip, B.leg);
    if (B.legExtra) L.push(...B.legExtra(pl.hip));
    shared = toonMesh(mergeParts(L), mat, 0.03);
  }
  const legs = [-1, 1].map((sx, i) => {
    const g = new THREE.Group();
    g.position.set(sx * pl.legX, pl.hip, 0);
    if (shared) g.add(i ? shared.clone() : shared);
    else if (B.legParts) g.add(mesh(B.legParts(sx, pl.hip)));
    return g;
  });

  const rig = new THREE.Group();
  rig.add(lean, ...legs);
  if (pl.scale) rig.scale.set(pl.scale[0], pl.scale[1], pl.scale[0]);
  let halo = null;
  if (B.halo) { halo = new THREE.Group(); halo.add(mesh(B.halo, 0.02)); rig.add(halo); }
  const x = {}, parents = { lean, rig, tail, skirt: sk, arm0: armGroups[0], arm1: armGroups[1], leg0: legs[0], leg1: legs[1] };
  for (const e of B.extra ?? []) {
    const g = new THREE.Group();
    g.position.set(...e.at);
    g.userData.y = e.at[1];
    if (e.parts.length) g.add(mesh(e.parts, e.k ?? 0.03));
    parents[e.parent].add(g);
    x[e.name] = g;
  }
  const root = new THREE.Group();
  root.add(rig);
  const m = { root, lean, eyes, tail, legs, arms: armGroups, skirt: sk, hand, orb, halo, style: D.style ?? spec.style ?? 'base', gait: D.gait, x, mats: [mat, clr] };
  if (D.anim) {
    m.anim = (t, dt, h) => D.anim(m, t, dt, h);
    m.anim(0, 1, { charge: 0, castT: 0, atkT: 0, moveAmt: 0, spin: 0, phase: 0, effects: [] }); // settle into the rest pose (portraits / lineups never animate)
  }
  return m;
}

export const hasForm = (id) => !!FORMS[id];
export const buildForm = (spec, def, team) => assemble(FORMS[def.id], spec, def, team);
