// Towers: stone-and-steel fortified plinth, ribbed armored shaft with glowing seams, turret prongs, spinning energy crystal. Shoot minions first, then heroes.
import * as THREE from 'three';
import { PAL, TEAM, TOWER, GROUND } from '../config.js';
import { structSpot } from './arena.js';
import { rand } from '../core/math.js';
import { bus } from '../core/bus.js';
import { toonMat, toonMesh, mergeParts, makeShadow, makeHalo } from '../render/toon.js';
import { particles, poofStars, FRAME } from '../render/particles.js';
import { vfx } from '../render/vfx.js';
import { tickHitFx, dyingScale } from '../game/combat.js';
import { pickTarget, ORDER_TOWER } from '../game/targeting.js';

const AGGRO_T = 2; // an enemy hero that hit an ally hero this recently draws the tower first

// 1. an enemy hero that recently hit an allied hero inside range, 2. nearest minion, 3. nearest hero. Shared by towers and cores.
export function defenderTarget(ctx, s, range) {
  let best = null, bd = range;
  for (const h of ctx.heroes) {
    if (h.team === s.team || !h.alive || h.hidden || h.untarget || h.aggroAge > AGGRO_T) continue;
    const d = Math.hypot(h.x - s.x, h.z - s.z) - h.radius;
    if (d <= bd) { best = h; bd = d; }
  }
  return best ?? pickTarget(ctx, s.team, s.x, s.z, range, ORDER_TOWER);
}

const CRYSTAL_Y = 4.9;

export class Tower {
  constructor(scene, team, idx) {
    this.type = 'tower';
    this.team = team;
    this.idx = idx; // 0-2 outer towers (top / mid / bot lane), 3-4 guardians
    this.tier = idx < 3 ? 'outer' : 'guard';
    this.lane = idx < 3 ? idx : -1;
    const spot = structSpot(team, this.tier, this.lane >= 0 ? idx : idx - 3);
    this.x = spot.x;
    this.z = spot.z;
    this.rx = this.x; this.rz = this.z;
    this.radius = TOWER.radius;
    this.hitY = 2.4;
    this.barY = this.tier === 'guard' ? 7.2 : 6.2;
    this.maxHp = TOWER.hp[this.tier];
    this.armor = TOWER.armor[this.tier];

    const c = TEAM[team];
    this.group = new THREE.Group();
    this.group.position.set(this.x, GROUND, this.z);
    if (this.tier === 'guard') this.group.scale.setScalar(1.18);
    this.group.add(makeShadow(4.4));

    this.mat = toonMat({ vertexColors: true, finish: true, rim: 0.25 });
    this.crystalMat = toonMat({ color: c.main, emissive: c.main, emissiveIntensity: 1.4, roughness: 0.15, metalness: 0.1 });
    this.mats = [this.mat, this.crystalMat];

    // Fortified plinth: rough-cut stone base, four sloped steel buttresses, a glowing team ring.
    const glowC = new THREE.Color(c.main).lerp(new THREE.Color(0xffffff), 0.15).getHex();
    const stumpGeo = mergeParts([
      { g: new THREE.CylinderGeometry(1.75, 1.95, 0.55, 8), c: 0x6A655C, p: [0, 0.27, 0], f: 'stone' },
      { g: new THREE.CylinderGeometry(1.45, 1.7, 0.5, 8), c: 0x746D62, p: [0, 0.78, 0], f: 'stone' },
      ...Array.from({ length: 4 }, (_, i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return { g: new THREE.BoxGeometry(0.42, 1.5, 0.9), c: 0x4C535E, p: [Math.sin(a) * 1.35, 1.0, Math.cos(a) * 1.35], r: [0, a, 0], f: 'steel' };
      }),
      { g: new THREE.TorusGeometry(1.32, 0.09, 6, 24), c: glowC, p: [0, 1.06, 0], r: [Math.PI / 2, 0, 0], f: 'glow' },
      { g: new THREE.CylinderGeometry(1.2, 1.3, 0.3, 8), c: c.deep, p: [0, 1.18, 0], f: 'metal' },
    ]);
    const base = toonMesh(stumpGeo, this.mat, 0);
    base.receiveShadow = true;
    this.group.add(base);

    // Armored shaft: paneled lower tower with steel ribs and glowing seams, a team-painted collar, turret head with emitter prongs.
    this.top = new THREE.Group();
    const ribs = Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      return [
        { g: new THREE.BoxGeometry(0.18, 2.1, 0.2), c: 0x3E444E, p: [Math.sin(a) * 0.95, 2.15, Math.cos(a) * 0.95], r: [0, a, 0], f: 'steel' },
        ...(i % 2 ? [] : [{ g: new THREE.BoxGeometry(0.05, 1.5, 0.06), c: glowC, p: [Math.sin(a + 0.39) * 0.97, 2.15, Math.cos(a + 0.39) * 0.97], r: [0, a, 0], f: 'glow' }]),
      ];
    }).flat();
    const prongs = Array.from({ length: 4 }, (_, i) => {
      const a = (i / 4) * Math.PI * 2;
      return [
        { g: new THREE.BoxGeometry(0.22, 1.2, 0.36), c: 0xB4BAC4, p: [Math.sin(a) * 0.82, 4.75, Math.cos(a) * 0.82], r: [Math.cos(a) * -0.3, 0, Math.sin(a) * 0.3], f: 'metal' },
        { g: new THREE.BoxGeometry(0.08, 0.6, 0.1), c: glowC, p: [Math.sin(a) * 0.95, 5.0, Math.cos(a) * 0.95], r: [Math.cos(a) * -0.3, 0, Math.sin(a) * 0.3], f: 'glow' },
      ];
    }).flat();
    const shaftGeo = mergeParts([
      { g: new THREE.CylinderGeometry(0.88, 1.08, 2.1, 8), c: 0x8E9098, p: [0, 2.15, 0], f: 'steel' },
      ...ribs,
      { g: new THREE.CylinderGeometry(1.08, 1.0, 0.35, 8), c: c.main, p: [0, 3.3, 0], f: 'paint' },
      { g: new THREE.TorusGeometry(1.04, 0.07, 6, 16), c: 0xD2D6DC, p: [0, 3.48, 0], r: [Math.PI / 2, 0, 0], f: 'metal' },
      { g: new THREE.CylinderGeometry(0.72, 0.88, 0.9, 8), c: 0x5A606A, p: [0, 3.92, 0], f: 'steel' },
      { g: new THREE.CylinderGeometry(1.0, 0.75, 0.32, 8), c: 0xC2C6CC, p: [0, 4.5, 0], f: 'metal' },
      ...prongs,
    ]);
    this.top.add(toonMesh(shaftGeo, this.mat, 0));

    this.crystal = toonMesh(new THREE.OctahedronGeometry(0.55).scale(1, 1.4, 1), this.crystalMat, 0);
    this.crystal.position.y = CRYSTAL_Y + 0.6;
    this.halo = makeHalo(c.main, 3.4);
    this.halo.position.copy(this.crystal.position);
    this.top.add(this.crystal, this.halo);

    this.banner = new THREE.Group();
    this.banner.position.set(1.05, 3.9, 0);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.1), toonMat({ color: c.main, side: THREE.DoubleSide, roughness: 0.9 }));
    cloth.castShadow = true;
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
    this.vulnerable = this.tier === 'outer';
    this.shielded = false;
    this.hurtAt = -99;
    this.streak = 0;
    this.lastTgt = null;
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
    if (this.flash > 0) this.hurtAt = ctx.time;
    this.cd -= dt;
    if (this.cd > 0) return;
    const tgt = this._target(ctx);
    if (!tgt) return;
    this.cd = TOWER.cd;
    let dmg = TOWER.minionDmg;
    if (tgt.type === 'hero') { // consecutive shots on the same hero ramp up to x2
      this.streak = this.lastTgt === tgt ? Math.min(4, this.streak + 1) : 0;
      dmg = (TOWER.heroDmg + TOWER.heroPct * tgt.maxHp) * Math.min(2, 1 + 0.25 * this.streak);
    } else this.streak = 0;
    this.lastTgt = tgt;
    ctx.projectiles.fire(this, tgt, dmg, 14, 1.5, GROUND + CRYSTAL_Y);
    bus.emit('towerShot', this);
    vfx.ring(this.x, GROUND + CRYSTAL_Y, this.z, TEAM[this.team].main, 1.6, 0.25);
  }

  _target(ctx) { return defenderTarget(ctx, this, TOWER.range); }

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
