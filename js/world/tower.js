// Towers: stone shaft, team band, spinning crystal. Shoot minions first, then heroes.
import * as THREE from 'three';
import { PAL, TEAM, TOWER, MAP, GROUND, sideX } from '../config.js';
import { rand } from '../core/math.js';
import { toonMat, toonMesh, mergeParts, makeShadow, makeHalo } from '../render/toon.js';
import { particles, poofStars, FRAME } from '../render/particles.js';
import { vfx } from '../render/vfx.js';
import { tickHitFx, dyingScale } from '../game/combat.js';
import { pickTarget, ORDER_TOWER } from '../game/targeting.js';

const CRYSTAL_Y = 4.9;

export class Tower {
  constructor(scene, team, idx) {
    this.type = 'tower';
    this.team = team;
    this.idx = idx;
    this.x = sideX(team, MAP.towerX[idx]);
    this.z = 0;
    this.rx = this.x; this.rz = this.z;
    this.radius = TOWER.radius;
    this.hitY = 2.4;
    this.barY = 6.2;
    this.maxHp = TOWER.hp[idx];

    const c = TEAM[team];
    this.group = new THREE.Group();
    this.group.position.set(this.x, GROUND, 0);
    this.group.add(makeShadow(4.4));

    this.mat = toonMat({ vertexColors: true });
    this.crystalMat = toonMat({ color: c.main, emissive: c.main, emissiveIntensity: 0.55 });
    this.mats = [this.mat, this.crystalMat];

    const stumpGeo = mergeParts([
      { g: new THREE.CylinderGeometry(1.35, 1.6, 0.8, 6), c: PAL.cliffLight, p: [0, 0.4, 0] },
      { g: new THREE.CylinderGeometry(1.1, 1.15, 0.3, 6), c: c.deep, p: [0, 0.95, 0] },
    ]);
    this.group.add(toonMesh(stumpGeo, this.mat));

    this.top = new THREE.Group();
    const shaftGeo = mergeParts([
      { g: new THREE.CylinderGeometry(0.85, 1.05, 2.0, 6), c: 0xE9E0F5, p: [0, 2.1, 0] },
      { g: new THREE.TorusGeometry(0.98, 0.14, 6, 12), c: c.main, p: [0, 1.7, 0], r: [Math.PI / 2, 0, 0] },
      { g: new THREE.CylinderGeometry(0.7, 0.85, 1.2, 6), c: 0xF4EEFA, p: [0, 3.7, 0] },
      { g: new THREE.ConeGeometry(1.05, 0.7, 6), c: c.deep, p: [0, 4.65, 0] },
    ]);
    this.top.add(toonMesh(shaftGeo, this.mat));

    this.crystal = toonMesh(new THREE.OctahedronGeometry(0.55).scale(1, 1.4, 1), this.crystalMat, 0.03);
    this.crystal.position.y = CRYSTAL_Y + 0.6;
    this.halo = makeHalo(c.main, 2.6);
    this.halo.position.copy(this.crystal.position);
    this.top.add(this.crystal, this.halo);

    this.banner = new THREE.Group();
    this.banner.position.set(1.0, 3.9, 0);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.1), new THREE.MeshBasicMaterial({ color: c.main, side: THREE.DoubleSide }));
    cloth.position.set(0.35, -0.55, 0);
    this.banner.add(cloth);
    this.top.add(this.banner);

    this.group.add(this.top);
    scene.add(this.group);
    this.reset();
  }

  reset() {
    this.hp = this.maxHp;
    this.alive = true;
    this.vulnerable = this.idx === 0;
    this.dying = 0;
    this.flash = 0;
    this.squash = 0;
    this.cd = rand(0.5, 1.5);
    this.top.visible = true;
    this.top.scale.setScalar(1);
    this.mat.color.setScalar(1);
  }

  update(dt, ctx) {
    tickHitFx(this, dt);
    if (this.dying > 0) {
      this.dying -= dt;
      if (this.dying <= 0) this.shatter();
    }
    if (!this.alive || ctx.over) return;
    this.cd -= dt;
    if (this.cd > 0) return;
    const tgt = pickTarget(ctx, this.team, this.x, this.z, TOWER.range, ORDER_TOWER);
    if (!tgt) return;
    this.cd = TOWER.cd;
    ctx.projectiles.fire(this, tgt, TOWER.dmg, 14, 1.5, GROUND + CRYSTAL_Y);
    vfx.ring(this.x, GROUND + CRYSTAL_Y, this.z, TEAM[this.team].main, 1.6, 0.25);
  }

  shatter() {
    this.top.visible = false;
    this.mat.color.setScalar(0.55);
    poofStars(this.x, GROUND + CRYSTAL_Y, this.z, 26);
    particles.burst(this.x, GROUND + CRYSTAL_Y, this.z, 12, { color: TEAM[this.team].main, speed: 4, up: 4, size: 0.9, life: 1, frame: FRAME.star, grav: 7 });
    vfx.ring(this.x, 0.3, this.z, TEAM[this.team].main, 6, 0.6);
  }

  render(t) {
    const f = this.flash > 0 ? 1 : 0;
    for (const m of this.mats) m.userData.flash.value = f;
    if (!this.top.visible) return;
    const s = this.dying > 0 ? dyingScale(this) : 1, sq = this.squash * 0.1;
    this.top.scale.set(s * (1 + sq), s * (1 - sq), s * (1 + sq));
    this.crystal.rotation.y = t * 1.6;
    this.crystal.position.y = CRYSTAL_Y + 0.6 + Math.sin(t * 2 + this.x) * 0.15;
    this.halo.position.y = this.crystal.position.y;
    this.banner.rotation.y = Math.sin(t * 2.5 + this.x) * 0.5;
    const k = this.hp / this.maxHp; // cracks: darker tint at 66% / 33%
    this.mat.color.setScalar(k < 0.33 ? 0.62 : k < 0.66 ? 0.8 : 1);
  }
}
