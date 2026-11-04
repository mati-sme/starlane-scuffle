// Hero base: stats, XP / levels, movement, auto-aim basic attack, skills, status effects, respawn and procedural animation.
import * as THREE from 'three';
import { PAL, CAM, MAP, MATCH, HERO, DIFFICULTY, settings, GROUND, TEAM, sideX } from '../config.js';
import { clamp, lerp, damp, angleLerp } from '../core/math.js';
import { makeShadow } from '../render/toon.js';
import { vfx } from '../render/vfx.js';
import { particles, FRAME } from '../render/particles.js';
import { bus } from '../core/bus.js';
import { dealDamage, forEachEnemy, tickHitFx, tickStatus, airLift, dyingScale, poof } from '../game/combat.js';
import { pickHeroTarget, bestCluster } from '../game/targeting.js';

// Screen-space axes projected onto the ground, derived from the camera offset.
const FWD = new THREE.Vector2(-CAM.offset[0], -CAM.offset[2]).normalize();
const RIGHT = new THREE.Vector2(-FWD.y, FWD.x);
export const screenToWorld = (sx, sy, out) => out.set(RIGHT.x * sx + FWD.x * sy, RIGHT.y * sx + FWD.y * sy);

const ASSIST_RANGE = 7; // holding Attack with no stick steps toward a nearby enemy
const WINDUP = 0.15;    // anticipation crouch before a skill fires
const SLOT_Z = 1.4;

export class Hero {
  // brain: optional (hero) => controller with think(dt, ctx) -> intent. No brain = the human player.
  constructor(scene, def, team = 0, slot = 0, brain = null) {
    this.scene = scene;
    this.def = def;
    this.id = def.id;
    this.type = 'hero';
    this.team = team;
    this.slot = slot;
    Object.assign(this, def.stats);
    this.baseHp = def.stats.hp;
    this.basic = def.abilities.basic;
    this.ab = [def.abilities.s1, def.abilities.s2, def.abilities.ult];

    this.model = def.buildModel(team);
    this.holder = new THREE.Group();
    this.holder.add(this.model.root);
    this.shadow = makeShadow(1.9);
    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.95, 0.06, 6, 28).rotateX(Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: brain ? TEAM[team].main : PAL.gold }),
    );
    this.ring.position.y = 0.1;
    this.holder.add(this.shadow, this.ring);
    scene.add(this.holder);

    this.fx = def.init?.(this, scene) ?? {};
    this.brain = brain ? brain(this) : null;
    this.isPlayer = !brain;
    this.reset();
  }

  dispose() {
    this.scene.remove(this.holder);
    for (const o of this.fx.objs ?? []) this.scene.remove(o);
  }

  reset() {
    this.level = 1;
    this.xp = 0;
    this.up = {};
    this.recalc(true);
    this.x = this.px = this.rx = sideX(this.team, MAP.heroX);
    this.z = this.pz = this.rz = (this.slot ? 1 : -1) * SLOT_Z;
    this.hp = this.maxHp;
    this.alive = true;
    this.dying = 0;
    this.respawn = 0;
    this.respawnTotal = 1;
    this.flash = this.squash = this.lunge = this.faceHold = this.sinceHit = 0;
    this.cd = 0;
    this.cds = [0, 0, 0];
    this.cdTotal = [1, 1, 1];
    this.face = this.yaw = this.team === 0 ? Math.PI / 2 : -Math.PI / 2;
    this.dirx = this.dirz = 0;
    this.moveAmt = 0;
    this.phase = 0;
    this.blink = 3;
    this.celebrate = false;
    this.aim = null;
    this.walkTo = null;
    this.attacker = null;
    this.attackerAge = 99;
    this.killer = null;
    this.lift = 0;
    this.spinAng = 0;
    this._starT = 0;
    this._clear();
    this.def.reset?.(this);
    this.brain?.reset?.();
  }

  // Derived numbers from level + upgrades. `full` refills HP, otherwise HP grows with the new max.
  recalc(full) {
    const L = this.level - 1, u = this.up;
    this.dmgMul = (1 + HERO.dmgPerLevel * L) * (1 + 0.12 * (u.claws ?? 0));
    this.cdMul = 0.85 ** (u.hands ?? 0);
    this.speedMul = 1 + 0.1 * (u.boots ?? 0);
    this.outMul = this.dmgMul * (this.brain ? DIFFICULTY.dmg[settings.stars - 1] : 1);
    this.basicRange = this.basic.range + (this.basic.rangeUp ?? 0) * (u.basic ?? 0);
    const max = Math.round(this.baseHp * (1 + HERO.hpPerLevel * L) * (1 + 0.15 * (u.heart ?? 0)));
    this.hp = full ? max : this.hp + (max - this.maxHp);
    this.maxHp = max;
  }

  gainXp(n) {
    if (this.level >= HERO.maxLevel || !this.alive) return;
    this.xp += n;
    particles.emit(this.x, 2.4, this.z, 0, 1.5, 0, PAL.gold, 0.5, 0.5, FRAME.sparkle);
    while (this.level < HERO.maxLevel && this.xp >= HERO.xpNeed(this.level)) {
      this.xp -= HERO.xpNeed(this.level);
      this.levelUp();
    }
    if (this.level >= HERO.maxLevel) this.xp = 0;
  }

  levelUp() {
    this.level++;
    this.recalc(false);
    vfx.ring(this.x, 0.2, this.z, PAL.gold, 3.5, 0.5);
    particles.burst(this.x, 1, this.z, 14, { color: [PAL.gold, PAL.star], speed: 3, up: 4, size: 0.6, life: 0.8, frame: FRAME.star, grav: 4 });
    bus.emit('levelUp', this);
    if (this.level === HERO.ultLevel) bus.emit('ultUnlock', this);
  }

  addUpgrade(id) {
    this.up[id] = (this.up[id] ?? 0) + 1;
    this.recalc(false);
  }

  // Scripted motion (dash, leap, blink, slide): s = { dur, x1, z1, h, tilt, tick(h, ctx, u, dt), done(h, ctx) }.
  runScript(s) {
    this.script = { t: 0, x0: this.x, z0: this.z, h: 0, tilt: 0, ...s };
    this.windup = 0;
  }

  _clear() {
    this.effects = [];
    this.script = null;
    this.windup = 0;
    this.pend = -1;
    this.yOff = this.tilt = this.spin = 0;
    this.stun = this.root = this.slow = this.air = 0;
    this.pull = null;
    this.shieldHp = this.shieldT = 0;
    this.moveMul = 1;
    this.noAttack = false;
    this.def.clear?.(this);
  }

  // it: { x, z (world move dir, |v| <= 1), attack, cast: [bool, bool, bool] }
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
        this._clear();
        bus.emit('heroDown', this);
      }
      return;
    }
    if (!this.alive) {
      if (!ctx.over && (this.respawn -= dt) <= 0) this.spawn();
      return;
    }
    if (ctx.over) { this.moveAmt = 0; this.aim = null; return; }

    for (let i = 0; i < 3; i++) if (this.cds[i] > 0) this.cds[i] -= dt;
    this.cd -= dt;
    this.attackerAge += dt;
    this.lunge = Math.max(0, this.lunge - dt * 5);
    this.faceHold = Math.max(0, this.faceHold - dt);
    tickStatus(this, dt);
    if (this.shieldT > 0 && (this.shieldT -= dt) <= 0) this.shieldHp = 0;

    if (this.sinceHit > 3 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.regen * dt);
    if (this.hp < this.maxHp && Math.abs(this.x - sideX(this.team, MAP.heroX)) < HERO.baseHeal.radius) {
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * HERO.baseHeal.rate * dt); // home fountain
    }

    this.moveMul = 1; this.noAttack = false; this.spin = 0;
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.t += dt;
      e.update?.(this, dt, ctx, e);
      if (e.t >= e.dur) { e.end?.(this, ctx, e); this.effects.splice(i, 1); }
    }
    this.def.tick?.(this, dt, ctx);

    if (this.script) { this._runScript(dt, ctx); return; }

    const stunned = this.stun > 0 || this.air > 0;
    if (this.windup > 0) {
      this.windup -= dt;
      if (this.windup <= 0) this._fire(ctx);
    } else if (!stunned) {
      for (let i = 2; i >= 0; i--) {
        if (it.cast[i] && this._canCast(i)) { this._begin(i, ctx); break; }
      }
    }

    const manual = Math.hypot(it.x, it.z) > 0.05;
    this.aim = pickHeroTarget(ctx, this, this.basicRange);

    let mx = it.x, mz = it.z;
    if (manual) this.walkTo = null;
    else if (this.isPlayer && it.attack && !this.aim) {
      const near = pickHeroTarget(ctx, this, ASSIST_RANGE);
      if (near) [mx, mz] = this._toward(near.x, near.z);
    } else if (this.walkTo) {
      [mx, mz] = this._toward(this.walkTo.x, this.walkTo.z);
      if (Math.hypot(this.walkTo.x - this.x, this.walkTo.z - this.z) < 0.3) this.walkTo = null;
    }

    const locked = stunned || this.root > 0 || this.windup > 0;
    const mag = locked ? 0 : Math.min(1, Math.hypot(mx, mz));
    if (mag > 0.01) {
      const sp = this.speed * this.speedMul * this.moveMul * (this.slow > 0 ? 0.55 : 1);
      this.dirx = mx / mag; this.dirz = mz / mag;
      this.x += this.dirx * sp * mag * dt;
      this.z += this.dirz * sp * mag * dt;
      if (this.faceHold <= 0) this.face = Math.atan2(this.dirx, this.dirz);
    }
    this.moveAmt = damp(this.moveAmt, mag, 14, dt);
    this._collide(ctx);

    if (it.attack && this.aim && this.cd <= 0 && !stunned && this.windup <= 0 && !this.noAttack) this._swing(ctx);
  }

  _toward(x, z) {
    const dx = x - this.x, dz = z - this.z, d = Math.hypot(dx, dz) || 1;
    return [dx / d, dz / d];
  }

  _runScript(dt, ctx) {
    const s = this.script;
    s.t += dt;
    const u = Math.min(1, s.t / s.dur), e = 1 - (1 - u) * (1 - u);
    this.x = lerp(s.x0, s.x1, e);
    this.z = lerp(s.z0, s.z1, e);
    this.yOff = s.h * 4 * u * (1 - u);
    this.tilt = s.tilt;
    const dx = s.x1 - s.x0, dz = s.z1 - s.z0, d = Math.hypot(dx, dz) || 1;
    this.dirx = dx / d; this.dirz = dz / d;
    this.face = Math.atan2(dx, dz);
    this.faceHold = 0.1;
    s.tick?.(this, ctx, u, dt);
    this._collide(ctx);
    this.moveAmt = damp(this.moveAmt, 1, 14, dt);
    if (u >= 1) {
      this.script = null;
      this.yOff = this.tilt = 0;
      s.done?.(this, ctx);
    }
  }

  _canCast(i) { return this.cds[i] <= 0 && (i < 2 || this.level >= HERO.ultLevel); }

  // Skills auto-aim at the best cluster; with nothing in range they go toward the stick or facing direction.
  _aim(ctx, ab) {
    const c = bestCluster(ctx, this.team, this.x, this.z, ab.range, ab.radius ?? 3);
    let dx, dz;
    if (c) { dx = c.x - this.x; dz = c.z - this.z; }
    if (!c || Math.hypot(dx, dz) < 0.05) {
      if (this.moveAmt > 0.15) { dx = this.dirx; dz = this.dirz; } else { dx = Math.sin(this.face); dz = Math.cos(this.face); }
    }
    const d = Math.hypot(dx, dz) || 1;
    dx /= d; dz /= d;
    if (c) return { ...c, dx, dz, dist: d, has: true };
    return { x: this.x + dx * ab.range * 0.6, z: this.z + dz * ab.range * 0.6, dx, dz, dist: ab.range * 0.6, has: false, n: 0, hero: false, target: null };
  }

  _begin(i, ctx) {
    this.pend = i;
    this.windup = WINDUP;
    const a = this._aim(ctx, this.ab[i]);
    this.face = Math.atan2(a.dx, a.dz);
    this.faceHold = 0.4;
  }

  _fire(ctx) {
    const i = this.pend, ab = this.ab[i];
    this.pend = -1;
    if (!this.alive || this.stun > 0 || this.air > 0) return;
    const aim = this._aim(ctx, ab);
    this.face = Math.atan2(aim.dx, aim.dz);
    this.faceHold = 0.4;
    const r = ab.cast(this, ctx, aim);
    if (r === false) { this.cds[i] = 0.3; return; } // nothing to hit: try again soon
    const cd = (typeof r === 'number' ? r : ab.cd) * this.cdMul;
    this.cds[i] = cd;
    this.cdTotal[i] = cd;
    this.lunge = 1;
    bus.emit('cast', { hero: this, slot: i });
  }

  _swing(ctx) {
    const b = this.basic, t = this.aim, u = this.up.basic ?? 0;
    const dmg = b.dmg * (1 + (b.dmgUp ?? 0) * u);
    this.cd = b.cd;
    this.lunge = 1;
    this.faceHold = 0.3;
    bus.emit('swing', this);
    this.face = Math.atan2(t.x - this.x, t.z - this.z);
    if (b.proj) {
      const p = b.proj;
      ctx.projectiles.fire(this, t, dmg, p.speed, p.arc, GROUND + p.y, { color: b.color, frame: p.frame, size: p.size });
      return;
    }
    vfx.arc(this.x, GROUND + 0.9, this.z, t.x - this.x, t.z - this.z, b.color, this.basicRange, 0.2);
    dealDamage(t, dmg, this);
    if (b.splash) forEachEnemy(ctx, this.team, t.x, t.z, b.splash + (b.splashUp ?? 0) * u, (e) => { if (e !== t) dealDamage(e, dmg * 0.5, this); });
  }

  _collide(ctx) {
    for (const s of ctx.structures) {
      if (!s.alive) continue;
      const dx = this.x - s.x, dz = this.z - s.z, d = Math.hypot(dx, dz), min = s.radius + this.radius;
      if (d < min && d > 0) { this.x = s.x + (dx / d) * min; this.z = s.z + (dz / d) * min; }
    }
    this.x = clamp(this.x, -MAP.heroBound.x, MAP.heroBound.x);
    this.z = clamp(this.z, -MAP.heroBound.z, MAP.heroBound.z);
  }

  spawn() {
    this.x = this.px = sideX(this.team, MAP.heroX);
    this.z = this.pz = (this.slot ? 1 : -1) * SLOT_Z;
    this.hp = this.maxHp;
    this.alive = true;
    this.walkTo = null;
    this.attacker = null;
    vfx.column(this.x, this.z, PAL.gold);
    particles.burst(this.x, 1, this.z, 16, { color: [PAL.gold, PAL.star], speed: 3, up: 5, size: 0.6, life: 0.8, frame: FRAME.star, grav: 3 });
    bus.emit('heroRespawn', this);
  }

  render(alpha, t, dt) {
    const show = this.alive || this.dying > 0;
    this.holder.visible = show;
    if (!show) { this.def.render?.(this, t, dt); return; }

    this.rx = lerp(this.px, this.x, alpha);
    this.rz = lerp(this.pz, this.z, alpha);
    this.yaw = angleLerp(this.yaw, this.face, 1 - Math.exp(-14 * dt));
    this.spinAng += dt * 22 * this.spin;
    this.lift = this.yOff + airLift(this);

    const m = this.model, mv = this.moveAmt;
    this.phase += dt * 11 * mv;
    const step = Math.abs(Math.sin(this.phase)) * mv;
    const dy = this.dying > 0 ? dyingScale(this) : 1;
    const crouch = this.windup > 0 ? 0.2 : 0;
    const sq = this.squash * 0.15;
    const sy = dy * (1 + 0.08 * step - sq - crouch), sx = dy * (1 - 0.04 * step + sq * 0.5 + crouch * 0.5);
    const hop = this.celebrate ? Math.abs(Math.sin(t * 6)) * 0.7 : 0;

    this.holder.position.set(this.rx, GROUND + hop + this.lift, this.rz);
    m.root.position.set(Math.sin(this.yaw) * 0.35 * this.lunge, step * 0.12 + (1 - mv) * Math.sin(t * 3) * 0.04, Math.cos(this.yaw) * 0.35 * this.lunge);
    m.root.rotation.y = this.yaw + this.spinAng;
    m.root.scale.set(sx, sy, sx);
    m.lean.rotation.x = 0.25 * mv + 0.2 * this.lunge + this.tilt;
    m.tail.rotation.y = Math.sin(t * (4 + 6 * mv)) * (0.35 + 0.3 * mv);

    this.blink -= dt;
    m.eyes.scale.y = this.blink < 0.12 && this.blink > 0 ? 0.1 : 1;
    if (this.blink <= 0) this.blink = 2.5 + Math.random() * 2;

    if (this.stun > 0 && (this._starT -= dt) <= 0) { // dizzy stars
      this._starT = 0.12;
      particles.emit(this.rx + Math.cos(t * 8) * 0.5, this.hitY + 1.4 + this.lift, this.rz + Math.sin(t * 8) * 0.5, 0, 0.2, 0, PAL.gold, 0.35, 0.4, FRAME.star);
    }

    this.shadow.scale.setScalar(1.9 * (1 - (hop + this.lift) * 0.2));
    this.ring.rotation.y = t * 1.5;
    this.ring.scale.setScalar(1 + Math.sin(t * 4) * 0.05);
    const f = this.flash > 0 ? 1 : 0;
    for (const mat of m.mats) mat.userData.flash.value = f;
    this.def.render?.(this, t, dt);
  }
}
