// Hero base: stats, XP / levels, skill ranks, movement, auto-aim basic attack, skills, status effects, respawn and animation.
import * as THREE from 'three';
import { PAL, CAM, MAP, MATCH, HERO, DIFFICULTY, ARENA, settings, GROUND, TEAM } from '../config.js';
import { padPos, fountain, pushOutCover } from '../world/arena.js';
import { clamp, lerp, damp, angleLerp } from '../core/math.js';
import { makeShadow } from '../render/toon.js';
import { makeDome, makeBeam } from '../render/fx.js';
import { vfx } from '../render/vfx.js';
import { particles, FRAME } from '../render/particles.js';
import { bus } from '../core/bus.js';
import { sim, tickHitFx, tickStatus, tickBuffs, buff, airLift, dyingScale, poof } from '../game/combat.js';
import { pickHeroTarget, pickPrefTarget, stickyTarget, bestCluster } from '../game/targeting.js';
import { BEHAVIORS, BASICS } from './behaviors.js';
import { rankStats } from './roster.js';

// Screen-space axes projected onto the ground, derived from the camera offset.
const FWD = new THREE.Vector2(-CAM.offset[0], -CAM.offset[2]).normalize();
const RIGHT = new THREE.Vector2(-FWD.y, FWD.x);
export const screenToWorld = (sx, sy, out) => out.set(RIGHT.x * sx + FWD.x * sy, RIGHT.y * sx + FWD.y * sy);

const HERO_SCALE = 1.3; // visual only; hitboxes and ranges are unscaled
const ASSIST_RANGE = 7; // holding Attack with no stick steps toward a nearby enemy
const WINDUP = 0.15;    // anticipation crouch before a skill fires
const BOOST = { t: 4, mul: 1.6 }; // launch boost after leaving the fountain
export const RECALL_T = 4; // seconds of channel before the teleport home

export class Hero {
  // brain: optional (hero) => controller with think(dt, ctx) -> intent. No brain = the human player.
  constructor(scene, def, team = 0, slot = 0, brain = null) {
    this.scene = scene;
    this.def = def;
    this.id = def.id;
    this.type = 'hero';
    this.team = team;
    this.slot = slot;
    Object.assign(this, { hitY: 1.2, barY: 3.4, regen: 40 }, def.stats);
    this.barY *= HERO_SCALE;
    this.baseHp = def.stats.hp;
    this.basic = def.abilities.basic;
    this.ab = [def.abilities.s1, def.abilities.s2, def.abilities.ult];

    this.model = def.buildModel(team);
    this.holder = new THREE.Group();
    this.holder.add(this.model.root);
    this.shadow = makeShadow(1.9);
    this.ring = new THREE.Mesh(
      brain ? new THREE.TorusGeometry(0.95, 0.06, 6, 28).rotateX(Math.PI / 2) : new THREE.TorusGeometry(1.2, 0.13, 6, 32).rotateX(Math.PI / 2), // the player's ring is bigger and thicker
      new THREE.MeshBasicMaterial({ color: brain ? TEAM[team].main : PAL.gold, toneMapped: false }),
    );
    this.ring.position.y = 0.1;
    this.holder.add(this.shadow, this.ring);
    scene.add(this.holder);

    this.dome = makeDome(PAL.shield);
    this.beamMesh = this.ab.some((a) => a.kind === 'beam') ? makeBeam(def.accent) : null;
    scene.add(this.dome);
    if (this.beamMesh) scene.add(this.beamMesh);
    this.brain = brain ? brain(this) : null;
    this.isPlayer = !brain;
    this.reset();
  }

  dispose() {
    this.scene.remove(this.holder, this.dome);
    if (this.beamMesh) this.scene.remove(this.beamMesh);
  }

  reset() {
    this.level = 1;
    this.xp = 0;
    this.points = 0;
    this.ranks = [1, 1, 0];
    this.recalc(true);
    const pad = padPos(this.team, this.slot);
    this.x = this.px = this.rx = pad.x;
    this.z = this.pz = this.rz = pad.z;
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
    this.manual = null;
    this.recall = 0;
    this.walkTo = null;
    this.attacker = null;
    this.attackerAge = 99;
    this.aggroAge = this.atkAge = 99;
    this.brushHidden = false;
    this.boost = BOOST.t;
    this.killer = null;
    this.lift = 0;
    this.spinAng = 0;
    this._starT = 0;
    this._clear();
    this.brain?.reset?.();
  }

  // Derived numbers from level + skill ranks. `full` refills HP, otherwise HP grows with the new max.
  recalc(full) {
    const L = this.level - 1;
    this.dmgMul = 1 + HERO.dmgPerLevel * L;
    this.outMul = this.dmgMul * (this.team === 1 && this.brain ? DIFFICULTY.dmg[settings.stars - 1] : 1);
    this.basicRange = this.basic.range + (this.nextBasic?.range ?? 0);
    this.rs = this.ab.map((a, i) => rankStats(a, this.ranks[i]));
    const max = Math.round(this.baseHp + this.hpLv * L);
    this.hp = full ? max : this.hp + (max - (this.maxHp ?? max));
    this.maxHp = max;
  }

  gainXp(n) {
    if (this.level >= HERO.maxLevel || !this.alive) return;
    this.xp += n;
    bus.emit('xp', { hero: this, amount: n });
    particles.emit(this.x, 2.4, this.z, 0, 1.5, 0, PAL.gold, 0.5, 0.5, FRAME.sparkle);
    while (this.level < HERO.maxLevel && this.xp >= HERO.xpNeed(this.level)) {
      this.xp -= HERO.xpNeed(this.level);
      this.levelUp();
    }
    if (this.level >= HERO.maxLevel) this.xp = 0;
  }

  // Every level gives a skill point; level 3 also unlocks R rank 1 for free.
  levelUp() {
    this.level++;
    this.points++;
    if (this.level === HERO.ultLevel && this.ranks[2] === 0) this.ranks[2] = 1;
    this.recalc(false);
    vfx.ring(this.x, 0.2, this.z, PAL.gold, 3.5, 0.5);
    particles.burst(this.x, 1, this.z, 14, { color: [PAL.gold, PAL.star], speed: 3, up: 4, size: 0.6, life: 0.8, frame: FRAME.sparkle, grav: 4 });
    bus.emit('levelUp', this);
    if (this.level === HERO.ultLevel) bus.emit('ultUnlock', this);
  }

  // Can slot (0 Q, 1 E, 2 R) take a point right now? R rank 1 is only granted by level 3.
  canSpend(slot) {
    const r = this.ranks[slot];
    return this.points > 0 && r < HERO.maxRank[slot] && (slot < 2 || r > 0) && this.level >= HERO.gate(slot, r + 1);
  }

  spendPoint(slot) {
    if (!this.canSpend(slot)) return false;
    this.ranks[slot]++;
    this.points--;
    this.recalc(false);
    bus.emit('rankUp', { hero: this, slot });
    return true;
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
    this.buf = {};
    this.hidden = this.untarget = false;
    this.nextBasic = null;
    this.beam = null;
    this.chg = [0, 0, 0]; this.chgT = [0, 0, 0]; this.chgFull = [0, 0, 0];
    this.castAt = [-99, -99, -99];
    this.swings = 0;
    this.recall = 0;
    this.manual = null;
  }

  // it: { x, z (world move dir, |v| <= 1), attack, cast: [bool, bool, bool], aim?: [{ dx, dz, dist } | null x3], pref?: 0 auto | 1 minion | 2 structure, recall?: bool }
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
      if (!ctx.over && !sim.guest && (this.respawn -= dt) <= 0) this.spawn(); // guest: the host says when
      return;
    }
    if (ctx.over) { this.moveAmt = 0; this.aim = null; return; }

    for (let i = 0; i < 3; i++) if (this.cds[i] > 0) this.cds[i] -= dt;
    this.cd -= dt;
    this.attackerAge += dt;
    this.aggroAge += dt;
    this.atkAge += dt;
    this.lunge = Math.max(0, this.lunge - dt * 5);
    this.faceHold = Math.max(0, this.faceHold - dt);
    tickStatus(this, dt);
    tickBuffs(this, dt);
    this.hidden = !!this.buf.hidden || this.brushHidden;
    this.untarget = !!this.buf.untarget;
    if (this.nextBasic && (this.nextBasic.t -= dt) <= 0) this.nextBasic = null;
    this.basicRange = this.basic.range + (this.nextBasic?.range ?? 0);
    for (let i = 0; i < 3; i++) {
      if (this.chg[i] > 0 && (this.chgT[i] -= dt) <= 0) { this.chg[i] = 0; this.cds[i] = Math.max(this.cds[i], this.chgFull[i] - 3); }
    }
    if (this.shieldT > 0 && (this.shieldT -= dt) <= 0) this.shieldHp = 0;

    if (this.sinceHit > 3 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.regen * dt);
    const fo = fountain(this.team);
    if (Math.hypot(this.x - fo.x, this.z - fo.z) < ARENA.fountainR) {
      this.boost = BOOST.t;
      if (this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * HERO.baseHeal.rate * dt); // home fountain
    } else this.boost -= dt;

    this.moveMul = 1; this.noAttack = false; this.spin = 0;
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.t += dt;
      e.update?.(this, dt, ctx, e);
      if (e.t >= e.dur) { e.end?.(this, ctx, e); this.effects.splice(i, 1); }
    }

    if (this.script) { this.recall = 0; this._runScript(dt, ctx); return; }

    const stunned = this.stun > 0 || this.air > 0;
    this._recall(dt, ctx, it, stunned);
    if (this.windup > 0) {
      this.windup -= dt;
      if (this.windup <= 0) this._fire(ctx);
    } else if (!stunned) {
      for (let i = 2; i >= 0; i--) {
        if (!it.cast[i]) continue;
        if (this._canCast(i)) { this._begin(i, ctx, it.aim?.[i]); break; }
        if (this.isPlayer && this.ranks[i] === 0) bus.emit('noCast', { hero: this, slot: i, why: 'locked' });
      }
    }

    const manual = Math.hypot(it.x, it.z) > 0.05;
    this.aim = this._target(ctx, this.basicRange, it.pref);

    let mx = it.x, mz = it.z;
    if (manual) this.walkTo = null;
    else if (this.isPlayer && it.attack && !this.aim) {
      const near = this._target(ctx, ASSIST_RANGE, it.pref);
      if (near) [mx, mz] = this._toward(near.x, near.z);
    } else if (this.walkTo) {
      [mx, mz] = this._toward(this.walkTo.x, this.walkTo.z);
      if (Math.hypot(this.walkTo.x - this.x, this.walkTo.z - this.z) < 0.3) this.walkTo = null;
    }

    const locked = stunned || this.root > 0 || this.windup > 0;
    const mag = locked ? 0 : Math.min(1, Math.hypot(mx, mz));
    if (mag > 0.01) {
      const sp = this.speed * (1 + buff(this, 'speed')) * this.moveMul * (this.slow > 0 ? 0.55 : 1) * (this.boost > 0 ? BOOST.mul : 1);
      this.dirx = mx / mag; this.dirz = mz / mag;
      this.x += this.dirx * sp * mag * dt;
      this.z += this.dirz * sp * mag * dt;
      if (this.faceHold <= 0) this.face = Math.atan2(this.dirx, this.dirz);
    }
    this.moveAmt = damp(this.moveAmt, mag, 14, dt);
    this._collide(ctx);

    if (it.attack && this.aim && this.cd <= 0 && !stunned && this.windup <= 0 && !this.noAttack) this._swing(ctx);
  }

  // The basic-attack target: a held target button picks minions / structures, otherwise champions > minions > structures.
  // The current target sticks while it stays valid and in range, so the highlight ring does not flicker between neighbours.
  _target(ctx, range, pref) {
    if (!this.isPlayer) return pickHeroTarget(ctx, this, range);
    const best = pref ? pickPrefTarget(ctx, this, range, pref) : pickHeroTarget(ctx, this, range);
    return stickyTarget(this, this.aim, best, range, pref);
  }

  // Recall: hold still for RECALL_T seconds, then land on the fountain pad. Damage, a move, a cast or a stun breaks it.
  _recall(dt, ctx, it, stunned) {
    if (this.recall > 0) {
      const moved = Math.hypot(it.x, it.z) > 0.05 || this.walkTo, hurt = this.flash > 0 || this.hp < this._rcHp - 0.01;
      this._rcHp = this.hp;
      if (moved || hurt || stunned || it.cast.some(Boolean) || this.windup > 0) { this._recallEnd(false); return; }
      this.recall += dt;
      if (this.recall >= RECALL_T) this._recallEnd(true, ctx);
    } else if (it.recall && !stunned && this.windup <= 0 && Math.hypot(it.x, it.z) <= 0.05) {
      const fo = fountain(this.team);
      if (Math.hypot(this.x - fo.x, this.z - fo.z) < ARENA.fountainR) return; // already home
      this.recall = 0.001; this._rcHp = this.hp; this.walkTo = null;
      vfx.ring(this.x, 0.2, this.z, PAL.shield, 3, 0.5);
      bus.emit('recallStart', this);
    }
  }

  _recallEnd(done, ctx) {
    this.recall = 0;
    if (!done) { bus.emit('recallCancel', this); return; }
    vfx.column(this.x, this.z, PAL.shield, 0.6);
    particles.burst(this.x, 1, this.z, 14, { color: [PAL.shield, 0xffffff], speed: 3, up: 4, size: 0.6, life: 0.7, frame: FRAME.sparkle, grav: 2 });
    if (sim.guest) { bus.emit('recallEnd', this); return; } // the host moves us; the snapshot brings us home
    const fo = fountain(this.team), ang = (this.slot / 5) * Math.PI * 2; // the pads sit outside the heal circle: land inside it
    this.x = this.px = fo.x + Math.cos(ang) * 2.5; this.z = this.pz = fo.z + Math.sin(ang) * 2.5;
    this.boost = BOOST.t;
    this.attacker = null;
    vfx.column(this.x, this.z, PAL.shield, 0.9);
    vfx.ring(this.x, 0.2, this.z, PAL.gold, 4, 0.5);
    particles.burst(this.x, 1, this.z, 16, { color: [PAL.gold, PAL.star], speed: 3, up: 5, size: 0.6, life: 0.8, frame: FRAME.star, grav: 3 });
    bus.emit('recallEnd', this);
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

  _canCast(i) { return this.ranks[i] > 0 && this.cds[i] <= 0; }

  // Skills auto-aim at the best cluster; with nothing in range they go toward the stick or facing direction.
  _aim(ctx, ab) {
    const range = ab.range ?? 6, m = this.manual;
    if (m) { // the player aimed it: direction + distance (clamped to the skill's range)
      const dist = Math.min(Math.max(m.dist, 0.5), range);
      return { x: this.x + m.dx * dist, z: this.z + m.dz * dist, dx: m.dx, dz: m.dz, dist, has: true, manual: true, n: 0, hero: false, target: null };
    }
    const c = ab.aim === 'move' ? null : bestCluster(ctx, this.team, this.x, this.z, range, ab.radius ?? 3);
    let dx, dz;
    if (c) { dx = c.x - this.x; dz = c.z - this.z; }
    if (!c || Math.hypot(dx, dz) < 0.05) {
      if (this.moveAmt > 0.15) { dx = this.dirx; dz = this.dirz; } else { dx = Math.sin(this.face); dz = Math.cos(this.face); }
    }
    const d = Math.hypot(dx, dz) || 1;
    dx /= d; dz /= d;
    if (c) return { ...c, dx, dz, dist: d, has: true };
    return { x: this.x + dx * range * 0.6, z: this.z + dz * range * 0.6, dx, dz, dist: range * 0.6, has: false, n: 0, hero: false, target: null };
  }

  _begin(i, ctx, manual = null) {
    this.pend = i;
    this.manual = manual;
    this.windup = WINDUP;
    const a = this._aim(ctx, this.rs[i]);
    this.face = Math.atan2(a.dx, a.dz);
    this.faceHold = 0.4;
  }

  _fire(ctx) {
    const i = this.pend, ab = this.rs[i];
    this.pend = -1;
    if (!this.alive || this.stun > 0 || this.air > 0) return;
    const aim = this._aim(ctx, ab);
    this.manual = null;
    this.face = Math.atan2(aim.dx, aim.dz);
    this.faceHold = 0.4;
    if (!ab.hide) { delete this.buf.hidden; this.atkAge = 0; } // attacking breaks stealth
    if (BEHAVIORS[ab.kind](this, ab, ctx, aim) === false) { // nothing to hit: try again soon, and tell the player
      this.cds[i] = 0.3;
      if (this.isPlayer) bus.emit('noCast', { hero: this, slot: i, why: 'target' });
      return;
    }
    let cd = ab.cd;
    if (ab.charges > 1) { // extra charges: quick recast window, full cooldown after the last
      if (this.chg[i] > 0) { this.chg[i]--; cd = this.chg[i] > 0 ? 0.5 : ab.cd; }
      else { this.chg[i] = ab.charges - 1; this.chgT[i] = 3; this.chgFull[i] = ab.cd; cd = 0.5; }
    }
    this.cds[i] = cd;
    this.cdTotal[i] = cd;
    this.castAt[i] = ctx.time;
    this.lunge = 1;
    bus.emit('cast', { hero: this, slot: i });
  }

  _swing(ctx) {
    const b = this.basic, t = this.aim;
    let dmg = b.dmg;
    if (this.nextBasic) { dmg += this.nextBasic.dmg; this.nextBasic = null; }
    delete this.buf.hidden;
    this.atkAge = 0;
    this.cd = b.cd / (1 + buff(this, 'aspd'));
    this.lunge = 1;
    this.faceHold = 0.3;
    bus.emit('swing', this);
    this.face = Math.atan2(t.x - this.x, t.z - this.z);
    BASICS[b.kind](this, ctx, t, b, dmg);
  }

  _collide(ctx) {
    for (const s of ctx.structures) {
      if (!s.alive) continue;
      const dx = this.x - s.x, dz = this.z - s.z, d = Math.hypot(dx, dz), min = s.radius + this.radius;
      if (d < min && d > 0) { this.x = s.x + (dx / d) * min; this.z = s.z + (dz / d) * min; }
    }
    pushOutCover(this, this.radius * 0.8);
    this.x = clamp(this.x, -MAP.heroBound.x, MAP.heroBound.x);
    this.z = clamp(this.z, -MAP.heroBound.z, MAP.heroBound.z);
  }

  spawn() {
    const pad = padPos(this.team, this.slot);
    this.x = this.px = pad.x;
    this.z = this.pz = pad.z;
    this.hp = this.maxHp;
    this.boost = BOOST.t;
    this.alive = true;
    this.walkTo = null;
    this.attacker = null;
    vfx.column(this.x, this.z, PAL.gold);
    particles.burst(this.x, 1, this.z, 16, { color: [PAL.gold, PAL.star], speed: 3, up: 5, size: 0.6, life: 0.8, frame: FRAME.star, grav: 3 });
    bus.emit('heroRespawn', this);
  }

  render(alpha, t, dt, myTeam = 0) {
    const show = (this.alive || this.dying > 0) && !(this.hidden && this.team !== myTeam); // stealth: only the viewer's team sees it
    this.holder.scale.setScalar((this.hidden ? 0.92 : 1) * HERO_SCALE);
    this.holder.visible = show;
    this.dome.visible = false;
    if (this.beamMesh) this.beamMesh.visible = false;
    if (!show) return;

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
    const swing = Math.sin(this.phase) * 0.9 * mv;
    m.legs[0].rotation.x = swing;
    m.legs[1].rotation.x = -swing;

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

    if (this.shieldT > 0 && this.shieldHp > 0) { // shield dome
      const d = this.dome, s = 1.5 + Math.sin(t * 6) * 0.05;
      d.visible = true;
      d.position.set(this.rx, 1.3 + this.lift, this.rz);
      d.scale.set(s, s * 1.15, s);
      d.rotation.y = t;
      d.material.uniforms.uA.value = Math.min(1, this.shieldT * 2);
    }
    if (this.beam && this.beamMesh) { // channelled beam
      const B = this.beamMesh, w = this.beam.w * (0.9 + Math.sin(t * 30) * 0.1);
      B.visible = true;
      B.position.set(this.rx, 1.3 + this.lift, this.rz);
      B.rotation.y = this.beam.a;
      B.scale.set(w, w, this.beam.len);
      B.userData.tex.repeat.set(1, 4);
      B.userData.tex.offset.y -= dt * 3;
    }
    if (this.recall > 0) { // recall channel: ground rings pulse, a spiral of light rises and tightens with progress
      const u = this.recall / RECALL_T;
      if ((this._rcT = (this._rcT ?? 0) - dt) <= 0) {
        this._rcT = 0.05;
        for (let k = 0; k < 3; k++) {
          const a = t * 7 + (k * Math.PI * 2) / 3, r = 1.7 - u * 0.6;
          particles.emit(this.rx + Math.cos(a) * r, 0.2, this.rz + Math.sin(a) * r, 0, 3 + u * 5, 0, k ? PAL.shield : 0xffffff, 0.65, 0.55, FRAME.sparkle);
        }
      }
      if ((this._rcR = (this._rcR ?? 0) - dt) <= 0) { this._rcR = 0.45; vfx.ring(this.rx, 0.2, this.rz, PAL.shield, 2.6 - u, 0.45); }
    }
    if ((this._amb = (this._amb ?? 0) - dt) <= 0) { // role-colored ambient sparks
      this._amb = 0.16;
      particles.emit(this.rx + (Math.random() - 0.5) * 1.2, 0.6 + Math.random() * 2, this.rz + (Math.random() - 0.5) * 1.2, 0, 0.5, 0, this.def.accent, 0.35, 0.6, FRAME.sparkle);
    }
  }
}
