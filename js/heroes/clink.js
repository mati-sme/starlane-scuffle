// Clink — Robo-Penguin. Ranged pusher: Snowball Cannon, Frosty Turret, Belly Slide, Mega Snow Beam.
import * as THREE from 'three';
import { PAL, GROUND, TEAM } from '../config.js';
import { rand } from '../core/math.js';
import { dealDamage, forEachEnemy, applyStatus, shove } from '../game/combat.js';
import { pickTarget } from '../game/targeting.js';
import { particles, FRAME } from '../render/particles.js';
import { vfx } from '../render/vfx.js';
import { makeBeam } from '../render/fx.js';
import { toonMat, toonMesh, mergeParts } from '../render/toon.js';
import { buildClink } from './models.js';

const ICE = 0xBFF4FF, TEAL = PAL.clink, BEAM_LEN = 8.5;
const SNOW = { color: [ICE, 0xffffff, TEAL], speed: 2.5, up: 2, size: 0.6, life: 0.6, frame: FRAME.dot, grav: 1 };

// Drops a turret in front of Clink for 6 s; it snowballs the nearest enemy.
function frostyTurret(h, ctx, aim) {
  const u = h.up.s1 ?? 0, x = h.x + aim.dx * 2, z = h.z + aim.dz * 2;
  h.fx.turret = { x, z, t: 0, dur: 6 + 2 * u, cd: 0.3, yaw: Math.atan2(aim.dx, aim.dz), src: { team: h.team, x, z, outMul: h.outMul } };
  particles.burst(x, 0.5, z, 12, SNOW);
  vfx.ring(x, 0.2, z, ICE, 3, 0.4);
}

// Slides along the ground, shoving enemies out of the way.
function bellySlide(h, ctx, aim) {
  const ab = h.def.abilities.s2, u = h.up.s2 ?? 0, hit = new Set(), dmg = ab.dmg * (1 + 0.15 * u);
  h.runScript({
    dur: 0.45, x1: h.x + aim.dx * (ab.range + u), z1: h.z + aim.dz * (ab.range + u), tilt: 1.35,
    tick: (h, ctx) => {
      particles.burst(h.x, 0.3, h.z, 3, SNOW);
      forEachEnemy(ctx, h.team, h.x, h.z, 1.5, (e) => {
        if (hit.has(e)) return;
        hit.add(e);
        dealDamage(e, dmg, h);
        const side = Math.sign(aim.dx * (e.z - h.z) - aim.dz * (e.x - h.x)) || 1;
        shove(e, -aim.dz * side, aim.dx * side, 2.2, 0.3);
        applyStatus(e, 'slow', 1.2);
      });
    },
  });
}

// 2 s sweeping beam: slows and hits everything along it.
function snowBeam(h, ctx, aim) {
  const ab = h.def.abilities.ult, base = Math.atan2(aim.dx, aim.dz);
  let tick = 0;
  h.fx.beamOn = true;
  h.effects.push({
    t: 0, dur: 2,
    update(h, dt, ctx, fx) {
      const a = base - 0.7 + 1.4 * (fx.t / 2), bx = Math.sin(a), bz = Math.cos(a);
      h.fx.beamA = a;
      h.face = a;
      h.faceHold = 0.2;
      h.moveMul = 0.35;
      h.noAttack = true;
      const k = Math.random() * BEAM_LEN;
      particles.emit(h.x + bx * k, 0.3, h.z + bz * k, rand(-1, 1), 1.5, rand(-1, 1), Math.random() < 0.5 ? ICE : 0xffffff, 0.6, 0.5, FRAME.sparkle, 2);
      if ((tick -= dt) > 0) return;
      tick = 0.2;
      forEachEnemy(ctx, h.team, h.x, h.z, BEAM_LEN + 1, (e) => {
        const rx = e.x - h.x, rz = e.z - h.z, along = rx * bx + rz * bz, lat = Math.abs(rx * bz - rz * bx);
        if (along <= 0 || along > BEAM_LEN + e.radius || lat > 1 + e.radius) return;
        dealDamage(e, ab.dmg, h);
        applyStatus(e, 'slow', 1);
      });
      vfx.decal(h.x + bx * BEAM_LEN * 0.9, h.z + bz * BEAM_LEN * 0.9, ICE, 1.4, 0.8); // frost on the ground
    },
    end(h) { h.fx.beamOn = false; },
  });
}

// Mini turret from 6 primitives.
function buildTurret(team) {
  const navy = 0x34407F, white = 0xF4F8FF;
  const geo = mergeParts([
    { g: new THREE.CylinderGeometry(0.55, 0.7, 0.35, 8), c: navy, p: [0, 0.17, 0] },
    { g: new THREE.SphereGeometry(1, 10, 8), c: white, p: [0, 0.7, 0], s: [0.5, 0.45, 0.5] },
    { g: new THREE.CylinderGeometry(0.12, 0.16, 0.8, 6), c: navy, p: [0, 0.8, 0.45], r: [Math.PI / 2, 0, 0] },
    { g: new THREE.SphereGeometry(1, 8, 6), c: white, p: [0, 1.05, 0], s: [0.3, 0.15, 0.3] },
    { g: new THREE.SphereGeometry(1, 8, 6), c: TEAL, p: [-0.5, 0.7, 0], s: 0.14 },
    { g: new THREE.SphereGeometry(1, 8, 6), c: TEAM[team].main, p: [0, 1.3, 0], s: 0.1 },
  ]);
  const m = toonMesh(geo, toonMat({ vertexColors: true }), 0.04);
  m.visible = false;
  return m;
}

export const clink = {
  id: 'clink',
  portrait: 'penguin',
  color: '#3DE0D0',
  stats: { hp: 580, speed: 5.8, radius: 0.65, hitY: 1.1, barY: 3.1, regen: 40 },
  abilities: {
    basic: { name: 'Snowball Cannon', icon: 'clink_snowball', range: 6.5, rangeUp: 0.5, dmg: 34, dmgUp: 0.2, cd: 0.7, color: ICE, proj: { speed: 13, arc: 0.9, y: 1.4, frame: FRAME.dot, size: 1.5 } },
    s1: { name: 'Frosty Turret', icon: 'clink_turret', cd: 9, range: 3, radius: 3, dmg: 22, cast: frostyTurret },
    s2: { name: 'Belly Slide', icon: 'clink_slide', cd: 7, range: 6, radius: 2.5, dmg: 36, cast: bellySlide },
    ult: { name: 'Mega Snow Beam', icon: 'clink_beam', cd: 35, range: 8, radius: 2, dmg: 26, cast: snowBeam },
  },
  buildModel: buildClink,

  init(h, scene) {
    const turretMesh = buildTurret(h.team), beamMesh = makeBeam(ICE);
    scene.add(turretMesh, beamMesh);
    return { turretMesh, beamMesh, objs: [turretMesh, beamMesh], turret: null, beamOn: false, beamA: 0, snow: 0 };
  },
  clear(h) { h.fx.turret = null; h.fx.beamOn = false; },

  // Turret: snowballs the nearest enemy every 0.7 s until its time runs out.
  tick(h, dt, ctx) {
    const T = h.fx.turret;
    if (!T) return;
    const ab = h.def.abilities.s1;
    T.t += dt;
    if (T.t >= T.dur) { particles.burst(T.x, 0.6, T.z, 10, SNOW); h.fx.turret = null; return; }
    T.src.outMul = h.outMul;
    if ((T.cd -= dt) > 0) return;
    const tgt = pickTarget(ctx, h.team, T.x, T.z, 6.5, ['heroes', 'minions', 'structures']);
    if (!tgt) return;
    T.cd = 0.7;
    T.yaw = Math.atan2(tgt.x - T.x, tgt.z - T.z);
    ctx.projectiles.fire(T.src, tgt, ab.dmg * (1 + 0.25 * (h.up.s1 ?? 0)), 14, 0.8, GROUND + 1.1, { color: ICE, frame: FRAME.dot, size: 1.2 });
  },

  render(h, t, dt) {
    const T = h.fx.turret, m = h.fx.turretMesh;
    m.visible = !!T;
    if (T) {
      const left = T.dur - T.t, pop = Math.min(1, T.t * 5) * Math.min(1, left / 0.3);
      m.position.set(T.x, GROUND, T.z);
      m.scale.setScalar(Math.max(pop, 0.01));
      m.rotation.y = T.yaw;
    }
    const B = h.fx.beamMesh, on = h.alive && h.fx.beamOn;
    B.visible = on;
    if (on) {
      const w = 1.1 + Math.sin(t * 30) * 0.12;
      B.position.set(h.rx, 1.3 + h.lift, h.rz);
      B.rotation.y = h.fx.beamA;
      B.scale.set(w, w, BEAM_LEN);
      B.userData.tex.repeat.set(1, 4);
      B.userData.tex.offset.y -= dt * 3;
    }
    if (h.alive && (h.fx.snow -= dt) <= 0) { // drifting snowflakes
      h.fx.snow = 0.15;
      particles.emit(h.rx + rand(-0.8, 0.8), 2 + rand(0, 1), h.rz + rand(-0.8, 0.8), rand(-0.3, 0.3), -0.8, rand(-0.3, 0.3), Math.random() < 0.5 ? ICE : 0xffffff, 0.4, 1.2, FRAME.sparkle);
    }
  },
};
