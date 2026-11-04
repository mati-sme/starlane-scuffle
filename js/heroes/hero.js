// Hero base: stats, movement, auto-aim basic attack, respawn and procedural animation.
import * as THREE from 'three';
import { PAL, CAM, MAP, MATCH, GROUND, sideX } from '../config.js';
import { clamp, lerp, damp, angleLerp } from '../core/math.js';
import { toonMesh, makeShadow } from '../render/toon.js';
import { vfx } from '../render/vfx.js';
import { particles, FRAME } from '../render/particles.js';
import { bus } from '../core/bus.js';
import { dealDamage, tickHitFx, dyingScale, poof } from '../game/combat.js';
import { pickTarget, ORDER_HERO } from '../game/targeting.js';

// Screen-space axes projected onto the ground, derived from the camera offset.
const FWD = new THREE.Vector2(-CAM.offset[0], -CAM.offset[2]).normalize();
const RIGHT = new THREE.Vector2(-FWD.y, FWD.x);
export const screenToWorld = (sx, sy, out) => out.set(RIGHT.x * sx + FWD.x * sy, RIGHT.y * sx + FWD.y * sy);

const ASSIST_RANGE = 7; // holding Attack with no stick steps toward a nearby enemy

export class Hero {
  constructor(scene, def, team = 0) {
    this.def = def;
    this.id = def.id;
    this.type = 'hero';
    this.team = team;
    Object.assign(this, def.stats);
    this.maxHp = def.stats.hp;
    this.basic = def.abilities.basic;
    this.level = 1;

    this.model = def.buildModel(team);
    this.holder = new THREE.Group();
    this.holder.add(this.model.root);
    this.shadow = makeShadow(1.9);
    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.95, 0.06, 6, 28).rotateX(Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: PAL.gold }),
    );
    this.ring.position.y = 0.1;
    this.holder.add(this.shadow, this.ring);
    scene.add(this.holder);
    this.walkTo = null;
    this.reset();
  }

  reset() {
    this.x = this.px = this.rx = sideX(this.team, MAP.heroX);
    this.z = this.pz = this.rz = 0;
    this.hp = this.maxHp;
    this.alive = true;
    this.dying = 0;
    this.respawn = 0;
    this.respawnTotal = 1;
    this.flash = this.squash = this.lunge = this.faceHold = this.sinceHit = 0;
    this.cd = 0;
    this.face = this.yaw = this.team === 0 ? Math.PI / 2 : -Math.PI / 2;
    this.dirx = this.dirz = 0;
    this.moveAmt = 0;
    this.phase = 0;
    this.blink = 3;
    this.celebrate = false;
    this.aim = null;
    this.walkTo = null;
  }

  // it: { x, z (world move dir, |v| <= 1), attack }
  update(dt, ctx, it) {
    this.px = this.x; this.pz = this.z;
    tickHitFx(this, dt);
    this.sinceHit = this.flash > 0 ? 0 : this.sinceHit + dt;

    if (this.dying > 0) {
      this.dying -= dt;
      if (this.dying <= 0) {
        poof(this, 40);
        this.respawnTotal = (MATCH.respawnBase + MATCH.respawnPerLevel * this.level) * (ctx.storm ? 0.5 : 1);
        this.respawn = this.respawnTotal;
        bus.emit('heroDown', this);
      }
      return;
    }
    if (!this.alive) {
      if (!ctx.over && (this.respawn -= dt) <= 0) this.spawn();
      return;
    }
    if (ctx.over) { this.moveAmt = 0; this.aim = null; return; }

    this.cd -= dt;
    this.lunge = Math.max(0, this.lunge - dt * 5);
    this.faceHold = Math.max(0, this.faceHold - dt);
    if (this.sinceHit > 3 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.regen * dt);

    const manual = Math.hypot(it.x, it.z) > 0.05;
    this.aim = pickTarget(ctx, this.team, this.x, this.z, this.basic.range, ORDER_HERO);

    let mx = it.x, mz = it.z;
    if (manual) this.walkTo = null;
    else if (it.attack && !this.aim) {
      const near = pickTarget(ctx, this.team, this.x, this.z, ASSIST_RANGE, ORDER_HERO);
      if (near) [mx, mz] = this._toward(near.x, near.z);
    } else if (this.walkTo) {
      [mx, mz] = this._toward(this.walkTo.x, this.walkTo.z);
      if (Math.hypot(this.walkTo.x - this.x, this.walkTo.z - this.z) < 0.3) this.walkTo = null;
    }

    const mag = Math.min(1, Math.hypot(mx, mz));
    if (mag > 0.01) {
      this.dirx = mx / mag; this.dirz = mz / mag;
      this.x += this.dirx * this.speed * mag * dt;
      this.z += this.dirz * this.speed * mag * dt;
      if (this.faceHold <= 0) this.face = Math.atan2(this.dirx, this.dirz);
    }
    this.moveAmt = damp(this.moveAmt, mag, 14, dt);
    this._collide(ctx);

    if (it.attack && this.aim && this.cd <= 0) this._swing();
  }

  _toward(x, z) {
    const dx = x - this.x, dz = z - this.z, d = Math.hypot(dx, dz) || 1;
    return [dx / d, dz / d];
  }

  _swing() {
    const b = this.basic, t = this.aim;
    this.cd = b.cd;
    this.lunge = 1;
    this.faceHold = 0.3;
    this.face = Math.atan2(t.x - this.x, t.z - this.z);
    vfx.arc(this.x, GROUND + 0.9, this.z, t.x - this.x, t.z - this.z, b.color, b.range, 0.2);
    dealDamage(t, b.dmg, this);
  }

  _collide(ctx) {
    for (const s of ctx.structures) {
      if (!s.alive) continue;
      const dx = this.x - s.x, dz = this.z - s.z, d = Math.hypot(dx, dz), min = s.radius + this.radius;
      if (d < min && d > 0) { this.x = s.x + (dx / d) * min; this.z = s.z + (dz / d) * min; }
    }
    this.x = clamp(this.x, -(MAP.halfLen + 4), MAP.halfLen + 4);
    this.z = clamp(this.z, -8.5, 8.5);
  }

  spawn() {
    this.x = this.px = sideX(this.team, MAP.heroX);
    this.z = this.pz = 0;
    this.hp = this.maxHp;
    this.alive = true;
    this.walkTo = null;
    vfx.column(this.x, this.z, PAL.gold);
    particles.burst(this.x, 1, this.z, 16, { color: [PAL.gold, PAL.star], speed: 3, up: 5, size: 0.6, life: 0.8, frame: FRAME.star, grav: 3 });
    bus.emit('heroRespawn', this);
  }

  render(alpha, t, dt) {
    const show = this.alive || this.dying > 0;
    this.holder.visible = show;
    if (!show) return;

    this.rx = lerp(this.px, this.x, alpha);
    this.rz = lerp(this.pz, this.z, alpha);
    this.yaw = angleLerp(this.yaw, this.face, 1 - Math.exp(-14 * dt));

    const m = this.model, mv = this.moveAmt;
    this.phase += dt * 11 * mv;
    const step = Math.abs(Math.sin(this.phase)) * mv;
    const dy = this.dying > 0 ? dyingScale(this) : 1;
    const sq = this.squash * 0.15;
    const sy = dy * (1 + 0.08 * step - sq), sx = dy * (1 - 0.04 * step + sq * 0.5);
    const hop = this.celebrate ? Math.abs(Math.sin(t * 6)) * 0.7 : 0;

    this.holder.position.set(this.rx, GROUND + hop, this.rz);
    m.root.position.set(Math.sin(this.yaw) * 0.35 * this.lunge, step * 0.12 + (1 - mv) * Math.sin(t * 3) * 0.04, Math.cos(this.yaw) * 0.35 * this.lunge);
    m.root.rotation.y = this.yaw;
    m.root.scale.set(sx, sy, sx);
    m.lean.rotation.x = 0.25 * mv + 0.2 * this.lunge;
    m.tail.rotation.y = Math.sin(t * (4 + 6 * mv)) * (0.35 + 0.3 * mv);

    this.blink -= dt;
    m.eyes.scale.y = this.blink < 0.12 && this.blink > 0 ? 0.1 : 1;
    if (this.blink <= 0) this.blink = 2.5 + Math.random() * 2;

    this.shadow.scale.setScalar(1.9 * (1 - hop * 0.3));
    this.ring.rotation.y = t * 1.5;
    this.ring.scale.setScalar(1 + Math.sin(t * 4) * 0.05);
    const f = this.flash > 0 ? 1 : 0;
    for (const mat of m.mats) mat.userData.flash.value = f;
  }
}
