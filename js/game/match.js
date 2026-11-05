// Match orchestration: heroes, waves, timer, Starstorm, XP, structure rules, win/lose, per-frame rendering.
import * as THREE from 'three';
import { MATCH, HERO, PAL, CAMP, TOWER, GOLD, BOSS } from '../config.js';
import { clamp, damp, rand } from '../core/math.js';
import { bus } from '../core/bus.js';
import { input, readMove } from '../core/input.js';
import { particles, FRAME } from '../render/particles.js';
import { vfx } from '../render/vfx.js';
import { Hero, screenToWorld } from '../heroes/hero.js';
import { HEROES, ROSTER } from '../heroes/index.js';
import { addBuff, heal, sim, tickStatus, tickHitFx, poof } from './combat.js';
import { composeTeams } from './compose.js';
import { inBrush } from '../world/arena.js';
import { ARENA } from '../config.js';
import { Camps } from '../world/camps.js';
import { Tower } from '../world/tower.js';
import { Core } from '../world/core.js';
import { MinionSystem } from '../world/minions.js';
import { Projectiles } from './projectiles.js';
import { Zones } from './zones.js';
import { Bot, assignLanes } from './bot.js';
import { aimShape } from './aiming.js';
import { AA_ARC } from './targeting.js';
import { autoBuy, atBase } from './gear.js';
import { AimPreview } from '../render/aimpreview.js';

const CONFETTI = [PAL.gold, PAL.sunny, PAL.gloom, PAL.heal, PAL.nebulaB, PAL.star];
const IDLE = { x: 0, z: 0, attack: false, cast: [false, false, false] };

export class Match {
  constructor(scene, rig, map) {
    this.scene = scene;
    this.rig = rig;
    this.map = map;
    this.towers = [0, 1].flatMap((team) => [0, 1, 2, 3, 4].map((idx) => new Tower(scene, team, idx)));
    this.cores = [0, 1].map((team) => new Core(scene, team));
    this.structures = [...this.towers, ...this.cores];
    this.minions = new MinionSystem(scene);
    this.camps = new Camps(scene);
    this.projectiles = new Projectiles(scene);
    this.zones = new Zones(scene);
    this.preview = new AimPreview(scene);
    this.projectiles.blocker = this.zones;
    this.timers = [];
    this.buffs = [0, 1].map(() => ({ fire: 0, ice: 0, gale: 0, dragonT: 0, titanT: 0, heraldT: 0 }));
    this.dragonN = 0; this.shopAt = 0;
    this.role = 'solo'; // solo | host | guest (online: see net/session.js)
    this.myTeam = 0;
    this.peerHero = null;
    this.peerIn = { x: 0, z: 0, attack: false, cast: [false, false, false], spend: [false, false, false], aim: [null, null, null], pref: 0, recall: false, at: 0 };
    this.peerIt = { x: 0, z: 0, attack: false, cast: [false, false, false], aim: [null, null, null], pref: 0, recall: false };
    this.outbox = null; // guest: { x, z, attack, cast[], spend[] } collected for the next input message
    this.snapAt = 0;

    this.intent = { x: 0, z: 0, attack: false, cast: [false, false, false], aim: [null, null, null], pref: 0, recall: false };
    this._dir = { dx: 0, dz: 1 };
    this._aim = { dx: 0, dz: 1, dist: 1 };
    this._screen = { x: 0, y: 0 };
    this._v = new THREE.Vector2();
    this._ray = new THREE.Raycaster();
    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._hit = new THREE.Vector3();

    bus.on('hit', (t) => { if (t === this.hero) rig.shake(0.15); });
    bus.on('dmg', (e) => { if (e.t === this.hero && e.amount >= e.t.maxHp * 0.12) rig.shake(0.3); });
    bus.on('down', (t) => {
      if (t.type === 'hero' && t.killer === this.hero) rig.shake(0.3);
      if (t.type === 'tower' || t.type === 'core') rig.shake(0.4);
      if (this.role === 'guest') return; // the host keeps the books
      if (t.type === 'tower' && t.team === this.myTeam) this.towersLost++;
      if (t.type === 'tower' || t.type === 'core') this.destroyed[1 - t.team]++;
      if (t.type === 'tower') this._towerGold(t);
      if (t.type === 'camp') t.boss ? this._boss(t) : this._camp(t);
      else if (t.type === 'minion') { this._xp(t, HERO.xp[t.kind], HERO.xpRange); this._minionGold(t); }
      else if (t.type === 'hero') {
        this._xp(t, HERO.xp.hero + HERO.xp.heroPerLevel * t.level, HERO.xpHeroRange);
        this._heroGold(t);
        const k = t.killer;
        if (k?.type === 'hero') {
          this.kills[k.team]++;
          bus.emit('takedown', { killer: k, victim: t });
          const w = k.rs[0].resetOnKill; // Phase Step perk: a takedown soon after the cast refreshes it
          if (w && this.time - k.castAt[0] <= w) k.cds[0] = 0;
        }
      }
    });
    bus.on('cast', ({ hero, slot }) => { if (slot === 2) rig.shake(hero === this.hero ? 0.4 : 0.2); });

    const q = new URLSearchParams(location.search), id = q.get('hero');
    this.setHero(Object.hasOwn(HEROES, id) ? id : ROSTER[0], q.get('bots')?.split(','));
  }

  // The player takes `id` on Sunny with 4 bot allies against 5 Gloom bots (see compose.js); `bots` (?bots=a,b,...) forces ids.
  setHero(id, bots) {
    this.role = 'solo'; this.myTeam = 0; this.peerHero = null; this.outbox = null; sim.guest = false;
    for (const h of this.heroes ?? []) h.dispose();
    const { blue, red } = composeTeams(id, bots ?? []), bot = (hero) => new Bot(hero);
    const roster = [...blue.map((k, i) => [k, 0, i, i ? bot : null]), ...red.map((k, i) => [k, 1, i, bot])];
    this.heroes = roster.map(([k, team, slot, brain]) => new Hero(this.scene, HEROES[k], team, slot, brain));
    this.hero = this.heroes[0];
    this.heroId = id;
    assignLanes(this.heroes);
    this.reset();
  }

  // Online 5v5: blue / red are champion ids (see composeOnline); me / peer = { team, idx } for the two human slots.
  // role 'host' runs everything, 'guest' mirrors the host (net/snapshot.js).
  setOnline({ blue, red, me, peer = null }, role) {
    for (const h of this.heroes ?? []) h.dispose();
    this.role = role; this.myTeam = me.team; this.outbox = role === 'guest' ? { x: 0, z: 0, attack: false, cast: [false, false, false], spend: [false, false, false], aim: [null, null, null], pref: 0, recall: false } : null;
    sim.guest = role === 'guest';
    const human = (team, i) => (me.team === team && me.idx === i) || (peer && peer.team === team && peer.idx === i);
    const bot = (hero) => new Bot(hero);
    const roster = [...blue.map((k, i) => [k, 0, i, human(0, i) ? null : bot]), ...red.map((k, i) => [k, 1, i, human(1, i) ? null : bot])];
    this.heroes = roster.map(([k, team, slot, brain]) => new Hero(this.scene, HEROES[k], team, slot, brain));
    this.hero = this.heroes[me.team * 5 + me.idx];
    this.peerHero = peer ? this.heroes[peer.team * 5 + peer.idx] : null;
    this.heroId = this.hero.id;
    assignLanes(this.heroes);
    this.reset();
  }

  // Host: the guest's latest input (cast / spend are one-shot bits, consumed by the next sim step).
  applyPeerInput(m) {
    const p = this.peerIn;
    p.x = +m.x || 0; p.z = +m.z || 0; p.attack = !!m.a; p.at = performance.now();
    for (let i = 0; i < 3; i++) { if (m.c & (1 << i)) p.cast[i] = true; if (m.s & (1 << i)) p.spend[i] = true; }
    p.pref = m.p === 1 || m.p === 2 ? m.p : 0;
    if (m.r) p.recall = true;
    if (Array.isArray(m.q)) { // aimed casts: [slot, angle (1/100 rad), distance (1/10)]
      for (const [slot, ang, dist] of m.q) {
        if (!(slot >= 0 && slot < 3) || !Number.isFinite(ang) || !Number.isFinite(dist)) continue;
        const a = ang / 100;
        p.aim[slot] = { dx: Math.sin(a), dz: Math.cos(a), dist: Math.min(30, Math.max(0, dist / 10)) };
      }
    }
  }

  // The guest left for good: their hero plays on as a bot.
  botify(hero) {
    if (!hero || hero.brain) return;
    hero.brain = new Bot(hero);
    hero.isPlayer = false;
    if (hero === this.peerHero) this.peerHero = null;
    assignLanes(this.heroes);
  }

  reset() {
    this.time = 0;
    this.dragonN = 0;
    this.shopAt = 0;
    for (const b of this.buffs) Object.assign(b, { fire: 0, ice: 0, gale: 0, dragonT: 0, titanT: 0, heraldT: 0 });
    this._bonus();
    this.waveNo = 0;
    this.nextWave = MATCH.firstWave;
    this.storm = false;
    this.over = false;
    this.towersLost = 0;
    this.kills = [0, 0];
    this.destroyed = [0, 0];
    this.reason = '';
    this._shT = 0;
    this.push = 0;
    this.fw = 0;
    this.win = false;
    this.timers.length = 0;
    this.snapAt = 0;
    input.cast.fill(false);
    input.spend.fill(false);
    input.aimCast.fill(null);
    input.aiming = null;
    input.atkAim = null;
    input.recall = false;
    this.preview.hide();
    this.heroes.forEach((h) => h.reset());
    this.towers.forEach((t) => t.reset());
    this.cores.forEach((c) => c.reset());
    this.minions.reset();
    this.camps.reset();
    this.projectiles.reset();
    this.zones.reset();
    particles.clear();
    vfx.setMarker(null);
    this.rig.lead.set(0, 0, 0);
  }

  towersAlive(team) { return this.towers.filter((t) => t.team === team && t.alive).length; }

  // Fraction of a team's structure HP still standing.
  hpFrac(team) {
    let hp = 0, max = 0;
    for (const s of this.structures) if (s.team === team) { hp += s.hp; max += s.maxHp; }
    return hp / max;
  }

  // Run fn(u in 0..1, dt) every sim step for `dur` seconds after `delay` (final call has u = 1).
  anim(dur, fn, delay = 0) { this.timers.push({ t: -delay, dur, fn }); }
  later(delay, fn) { this.timers.push({ t: -delay, dur: 0, fn }); }

  _timers(dt) {
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const a = this.timers[i];
      a.t += dt;
      if (a.t < 0) continue;
      a.fn(a.dur > 0 ? Math.min(1, a.t / a.dur) : 1, dt);
      if (a.t >= a.dur) this.timers.splice(i, 1);
    }
  }

  // XP from something that just fell: enemy heroes nearby get it, with gold motes flying to them.
  _xp(src, amount, range) {
    amount *= this.storm ? MATCH.stormXpMul : 1;
    for (const h of this.heroes) {
      if (h.team === src.team || !h.alive || Math.hypot(h.x - src.x, h.z - src.z) > range) continue;
      h.gainXp(amount);
      const y = src.hitY ?? 1;
      for (let k = 0; k < 3; k++) particles.emit(src.x, y, src.z, (h.x - src.x) / 0.6 + rand(-0.5, 0.5), (1.5 - y) / 0.6, (h.z - src.z) / 0.6 + rand(-0.5, 0.5), PAL.gold, 0.45, 0.6, FRAME.dot);
    }
  }

  // Sentinel down: the killing team's nearby heroes get XP, the killer a heal and a short speed / attack-speed buff.
  _camp(c) {
    const k = c.killer;
    if (k?.type !== 'hero') return;
    for (const h of this.heroes) {
      if (h.team === k.team && h.alive && Math.hypot(h.x - c.x, h.z - c.z) <= CAMP.xpRange) h.gainXp(CAMP.xp * (this.storm ? MATCH.stormXpMul : 1));
    }
    heal(k, k.maxHp * CAMP.heal);
    addBuff(k, 'speed', 0.2, CAMP.buffT);
    addBuff(k, 'aspd', 0.25, CAMP.buffT);
    bus.emit('campDown', c);
  }

  // ---- gold ----
  _gold(h, n) {
    h.gold += n;
    if (n >= 1) bus.emit('gold', { hero: h, amount: Math.round(n) });
  }

  _near(team, x, z, r) { return this.heroes.filter((h) => h.team === team && h.alive && Math.hypot(h.x - x, h.z - z) <= r); }

  // Last hit pays the killer in full; a tower / minion kill splits a small share among enemy heroes close by.
  _minionGold(t) {
    const g = GOLD.minion[t.kind], k = t.killer;
    if (k?.type === 'hero') this._gold(k, g);
    else for (const h of this._near(1 - t.team, t.x, t.z, HERO.xpRange)) this._gold(h, g * GOLD.minionShare);
  }

  _heroGold(v) {
    const team = v.killer?.team ?? 1 - v.team, k = v.killer?.type === 'hero' ? v.killer : null;
    if (k) this._gold(k, GOLD.hero);
    for (const h of this._near(team, v.x, v.z, GOLD.assistR)) if (h !== k) this._gold(h, GOLD.assist);
  }

  _towerGold(t) {
    const team = 1 - t.team, g = GOLD.tower[t.tier];
    for (const h of this.heroes) {
      if (h.team !== team) continue;
      this._gold(h, GOLD.towerTeam + (h.alive && Math.hypot(h.x - t.x, h.z - t.z) <= GOLD.towerR ? g - GOLD.towerTeam : 0));
    }
  }

  // ---- epic bosses ----
  // Dragon: stacking team buff (fire = damage, ice = resist, gale = speed + a little damage). Titan: empowered minions.
  // Herald: team structure damage up and a siege blob on every lane.
  _boss(c) {
    const team = c.killer?.team ?? c.provoked?.team;
    if (team !== 0 && team !== 1) return;
    const cf = c.cfg, b = this.buffs[team];
    for (const h of this.heroes) {
      if (h.team !== team) continue;
      this._gold(h, cf.gold);
      if (h.alive && Math.hypot(h.x - c.x, h.z - c.z) <= cf.xpRange) h.gainXp(cf.xp);
    }
    if (c.boss === 'dragon') {
      const el = BOSS.elements[c.variant % 3];
      b[el] = Math.min(BOSS.dragonCap, b[el] + 1);
      b.dragonT = BOSS.dragonT;
      this.dragonN++;
    } else if (c.boss === 'titan') {
      b.titanT = BOSS.titanT;
      for (const m of this.minions.list) {
        if (m.team !== team || !m.alive) continue;
        m.maxHp *= 1 + BOSS.titanHp; m.hp *= 1 + BOSS.titanHp;
      }
    } else {
      b.heraldT = BOSS.heraldT;
      for (let lane = 0; lane < 3; lane++) this.minions.spawnWave(team, lane, ['bigblob']);
    }
    this._bonus();
    this.rig.shake(0.5);
    bus.emit('bossTaken', { kind: c.boss, team, variant: c.variant });
  }

  // Fold the boss buffs into sim.bonus (read by dealDamage / heroes / minion spawns). Runs on host and guest.
  _bonus() {
    for (const team of [0, 1]) {
      const b = this.buffs[team], o = sim.bonus[team];
      o.dmg = 0.07 * b.fire + 0.03 * b.gale;
      o.dr = 0.06 * b.ice;
      o.spd = 0.05 * b.gale;
      o.minDmg = b.titanT > 0 ? BOSS.titanDmg : 0;
      o.minHp = b.titanT > 0 ? BOSS.titanHp : 0;
      o.struct = b.heraldT > 0 ? BOSS.heraldStruct : 0;
    }
  }

  _tickBuffs(dt) {
    for (const b of this.buffs) {
      if (b.dragonT > 0 && (b.dragonT -= dt) <= 0) b.fire = b.ice = b.gale = 0;
      if (b.titanT > 0) b.titanT = Math.max(0, b.titanT - dt);
      if (b.heraldT > 0) b.heraldT = Math.max(0, b.heraldT - dt);
    }
    this._bonus();
  }

  // Passive trickle for everyone; heroes in the base ring buy the next item of their role's build.
  _economy(dt) {
    for (const h of this.heroes) if (h.alive) h.gold += GOLD.trickle * dt;
    if (this.time < this.shopAt) return;
    this.shopAt = this.time + 0.4;
    for (const h of this.heroes) {
      if (!h.alive || !atBase(h) || !autoBuy(h)) continue;
      vfx.ring(h.x, 0.3, h.z, PAL.gold, 2.6, 0.4);
      bus.emit('buy', h);
    }
  }

  // Order of falling: outer towers always; guardians once any own outer is down; the core once both guardians are down. Structures with no enemy minion within shieldR take reduced hero damage.
  _rules(dt) {
    const shield = (this._shT -= dt) <= 0;
    if (shield) this._shT = 0.25;
    for (const team of [0, 1]) {
      const mine = this.towers.filter((t) => t.team === team), outer = mine.filter((t) => t.tier === 'outer'), guard = mine.filter((t) => t.tier === 'guard');
      const outerDown = outer.some((t) => !t.alive), guardsDown = guard.filter((t) => !t.alive).length;
      for (const t of outer) t.vulnerable = true;
      for (const t of guard) t.vulnerable = outerDown;
      this.cores[team].vulnerable = guardsDown === guard.length; // the nexus only falls once both guardians are down
    }
    if (!shield) return;
    const R2 = TOWER.shieldR * TOWER.shieldR;
    for (const s of this.structures) {
      let near = false;
      for (const m of this.minions.list) {
        if (m.team === s.team || !m.alive) continue;
        const dx = m.x - s.x, dz = m.z - s.z;
        if (dx * dx + dz * dz <= R2) { near = true; break; }
      }
      s.shielded = !near;
    }
  }

  // Brush stealth: hidden from the other team unless an enemy hero is within sight range or the unit just attacked / was hit.
  _brush() {
    const R = ARENA.brushSeeRange, T = ARENA.brushRevealT;
    for (const h of this.heroes) {
      let hid = h.alive && h.atkAge > T && h.sinceHit > T && inBrush(h.x, h.z);
      if (hid) {
        for (const e of this.heroes) {
          if (e.team !== h.team && e.alive && Math.hypot(e.x - h.x, e.z - h.z) < R) { hid = false; break; }
        }
      }
      h.brushHidden = hid;
    }
  }

  _intent() {
    const it = this.intent, hero = this.hero;
    it.attack = input.attack;
    it.x = it.z = 0;
    if (readMove(this._screen)) {
      screenToWorld(this._screen.x, this._screen.y, this._v);
      it.x = this._v.x;
      it.z = this._v.y;
    }
    it.pref = input.prefNo;
    it.dir = this._atkDir(hero);
    it.recall = input.recall; input.recall = false;
    for (let i = 0; i < 3; i++) {
      it.cast[i] = input.cast[i]; input.cast[i] = false;
      it.aim[i] = it.cast[i] && input.aimCast[i] ? this._aimed(input.aimCast[i], hero, i) : null;
      input.aimCast[i] = null;
      if (input.spend[i]) { hero.spendPoint(i); this.lastSpend = performance.now(); if (this.outbox) this.outbox.spend[i] = true; input.spend[i] = false; }
    }
    if (this.outbox) {
      const o = this.outbox;
      o.x = it.x; o.z = it.z; o.attack = it.attack;
      for (let i = 0; i < 3; i++) if (it.cast[i]) { o.cast[i] = true; o.aim[i] = it.aim[i]; }
      o.pref = it.pref;
      if (it.recall) o.recall = true;
    }
    if (input.walkClick) {
      this._ray.setFromCamera(input.walkClick, this.rig.camera);
      if (this._ray.ray.intersectPlane(this._plane, this._hit)) hero.walkTo = { x: this._hit.x, z: this._hit.z };
      input.walkClick = null;
    }
    return it;
  }

  // Screen drag / mouse cursor -> world { dx, dz, dist } for skill `slot` (null for skills that have nothing to aim).
  _aimed(a, hero, slot, out = {}) {
    const shape = aimShape(hero.rs[slot]);
    if (shape.type === 'self') return null;
    if (a.mouse) {
      if (!input.mouse) return null;
      this._ray.setFromCamera(input.mouse, this.rig.camera);
      if (!this._ray.ray.intersectPlane(this._plane, this._hit)) return null;
      const dx = this._hit.x - hero.x, dz = this._hit.z - hero.z, d = Math.hypot(dx, dz);
      if (d < 0.2) return null;
      out.dx = dx / d; out.dz = dz / d; out.dist = Math.min(d, shape.range);
      return out;
    }
    screenToWorld(a.sx, a.sy, this._v);
    const d = this._v.length() || 1;
    out.dx = this._v.x / d; out.dz = this._v.y / d; out.dist = Math.max(0.5, shape.range * a.frac);
    return out;
  }

  // Drag-aimed basic attack -> world { dx, dz } (touch: Attack dragged; desktop: Shift + attack key aims at the cursor), else null (auto-target).
  _atkDir(hero) {
    let a = input.atkAim;
    if (!a && input.mouse && input.attackKey && (input.keys.has('ShiftLeft') || input.keys.has('ShiftRight'))) a = this._mouseAtk ??= { mouse: true };
    if (!a || !(a.mouse || a.dragged)) return null;
    const out = this._atkd ??= { dx: 0, dz: 1 };
    if (a.mouse) {
      this._ray.setFromCamera(input.mouse, this.rig.camera);
      if (!this._ray.ray.intersectPlane(this._plane, this._hit)) return null;
      const dx = this._hit.x - hero.x, dz = this._hit.z - hero.z, d = Math.hypot(dx, dz);
      if (d < 0.2) return null;
      out.dx = dx / d; out.dz = dz / d;
      return out;
    }
    screenToWorld(a.sx, a.sy, this._v);
    const d = this._v.length() || 1;
    out.dx = this._v.x / d; out.dz = this._v.y / d;
    return out;
  }

  // Draws the ground preview while a skill button (or Q / E / R on desktop) is held.
  _preview(t, state) {
    const a = input.aiming, h = this.hero;
    if (!a && state === 'match' && h.alive) { // Attack dragged: a fan as long as the basic-attack range
      const d = this._atkDir(h), reach = h.basicRange + h.radius; // range is measured to the target's edge
      if (d) { this.preview.show(h, { type: 'cone', range: reach, arc: AA_ARC, strong: true }, d, reach, true, false, t); return; }
    }
    if (!a || state !== 'match' || !h.alive || h.rs[a.slot] == null) { this.preview.hide(); return; }
    const shape = aimShape(h.rs[a.slot]), dragged = a.mouse || a.dragged;
    let dir = this._dir, dist = shape.range;
    if (dragged && shape.type !== 'self') {
      const r = this._aimed(a, h, a.slot, this._aim);
      if (r) { dir = r; dist = r.dist; }
    }
    if (!dir.dx && !dir.dz) { dir.dx = Math.sin(h.face); dir.dz = Math.cos(h.face); }
    this.preview.show(h, shape, dir, dist, !!dragged, a.cancel, t);
  }

  // Heroes shove each other apart a little so nobody stacks.
  _separate() {
    const L = this.heroes;
    for (let i = 0; i < L.length; i++) {
      const a = L[i];
      if (!a.alive || a.script) continue;
      for (let j = i + 1; j < L.length; j++) {
        const b = L[j];
        if (!b.alive || b.script) continue;
        const dx = b.x - a.x, dz = b.z - a.z, min = (a.radius + b.radius) * 0.9, d2 = dx * dx + dz * dz;
        if (d2 >= min * min || d2 === 0) continue;
        const d = Math.sqrt(d2), p = ((min - d) / d) * 0.5;
        a.x -= dx * p; a.z -= dz * p;
        b.x += dx * p; b.z += dz * p;
      }
    }
  }

  // Guest: predict my own hero, ease everything else toward the host's snapshots, deal no damage.
  _guestUpdate(dt) {
    if (!this.over) this.time += dt;
    this._timers(dt);
    this.zones.update(dt, this);
    for (const h of this.heroes) {
      if (h === this.hero) h.update(dt, this, this.over ? IDLE : this._intent());
      else this._mirror(h, dt);
    }
    this._tickBuffs(dt);
    this.camps.netStep(dt);
    this.minions.netStep(dt);
    for (const s of this.structures) {
      tickHitFx(s, dt);
      if (s.dying > 0 && (s.dying -= dt) <= 0) s.shatter();
    }
    let sum = 0;
    const L = this.minions.list;
    for (const m of L) sum += m.x;
    this.push = damp(this.push, L.length ? clamp(sum / L.length / 30, -1, 1) : 0, 1.5, dt);
  }

  // A remote hero on the guest: chase the snapshot position, derive the walk animation from the motion.
  _mirror(h, dt) {
    h.px = h.x; h.pz = h.z;
    tickHitFx(h, dt);
    h.sinceHit = h.flash > 0 ? 0 : h.sinceHit + dt;
    h.lunge = Math.max(0, h.lunge - dt * 5);
    h.pull = null;
    tickStatus(h, dt);
    if (h.dying > 0) {
      if ((h.dying -= dt) <= 0) poof(h, 40);
      return;
    }
    if (!h.alive || h.tx === undefined) { h.moveAmt = damp(h.moveAmt, 0, 14, dt); return; }
    const k = 1 - Math.exp(-12 * dt), dx = (h.tx - h.x) * k, dz = (h.tz - h.z) * k, v = Math.hypot(dx, dz) / dt;
    h.x += dx; h.z += dz;
    h.moveAmt = damp(h.moveAmt, Math.min(1, v / h.speed), 10, dt);
    if (v > 0.3) { h.dirx = dx / (v * dt); h.dirz = dz / (v * dt); }
    h.yaw = h.face;
    if (h.shieldT > 0) h.shieldT -= dt;
  }

  // Host: the guest's hero is driven by their last input; no input for a second = stand still.
  _peerIntent() {
    const p = this.peerIn, it = this.peerIt, stale = performance.now() - p.at > 1000;
    it.x = stale ? 0 : p.x; it.z = stale ? 0 : p.z; it.attack = !stale && p.attack;
    it.pref = stale ? 0 : p.pref;
    it.recall = p.recall; p.recall = false;
    for (let i = 0; i < 3; i++) {
      it.cast[i] = p.cast[i]; p.cast[i] = false;
      it.aim[i] = it.cast[i] ? p.aim[i] : null; p.aim[i] = null;
      if (p.spend[i]) { this.peerHero.spendPoint(i); p.spend[i] = false; }
    }
    return it;
  }

  update(dt) {
    if (this.role === 'guest') return this._guestUpdate(dt);
    if (!this.over) {
      this.time += dt;
      if (this.time >= this.nextWave) {
        this.waveNo++;
        this.nextWave += this.storm ? MATCH.stormWaveEvery : MATCH.waveEvery;
        const kinds = ['blobling', 'blobling', 'blobling', 'zapper'];
        if (this.storm) kinds.push('blobling');
        if (this.time >= MATCH.siegeFrom && this.waveNo % MATCH.siegeEvery === 0) kinds.push('bigblob');
        if (this.storm) for (let i = 0; i < MATCH.stormSiege; i++) kinds.push('bigblob');
        for (const team of [0, 1]) for (let lane = 0; lane < 3; lane++) this.minions.spawnWave(team, lane, kinds);
      }
      if (!this.storm && this.time >= MATCH.storm) {
        this.storm = true;
        this.rig.shake(0.4);
        bus.emit('storm');
      }
    }
    this._rules(dt);
    if (!this.over) { this._tickBuffs(dt); this._economy(dt); }
    this._brush();
    this._timers(dt);
    this.zones.update(dt, this);
    for (const h of this.heroes) {
      const it = this.over ? IDLE : h === this.hero ? this._intent() : h === this.peerHero ? this._peerIntent() : h.brain.think(dt, this);
      h.update(dt, this, it);
    }
    this._separate();
    this.camps.update(dt, this);
    this.minions.update(dt, this);
    for (const s of this.structures) s.update(dt, this);
    if (!this.over) this._checkEnd();

    const L = this.minions.list;
    let sum = 0;
    for (const m of L) sum += m.x;
    this.push = damp(this.push, L.length ? clamp(sum / L.length / 30, -1, 1) : 0, 1.5, dt);
  }

  _checkEnd() {
    for (const c of this.cores) if (!c.alive) return this._end(c.team === 1, 'core');
    if (this.time < MATCH.tieBreak) return;
    const [d0, d1] = this.destroyed, f0 = this.hpFrac(0), f1 = this.hpFrac(1), [k0, k1] = this.kills, mm = Math.floor(MATCH.tieBreak / 60);
    if (d0 !== d1) this._end(d0 > d1, `structures destroyed at ${mm}:00`);
    else if (Math.abs(f0 - f1) > 1e-6) this._end(f0 > f1, `structure health at ${mm}:00`);
    else if (k0 !== k1) this._end(k0 > k1, `takedowns at ${mm}:00`);
    else this._end(true, `a dead heat at ${mm}:00 (Sunny takes ties)`);
  }

  // team0Wins: Sunny took it. The 'end' event's `win` is from the local player's side.
  _end(team0Wins, reason) {
    const win = team0Wins === (this.myTeam === 0);
    this.over = true;
    this.win = team0Wins;
    this.rawReason = reason;
    this.reason = reason === 'core' ? (win ? 'Enemy core destroyed' : 'Your core fell') : `${win ? 'Won' : 'Lost'} on ${reason}`;
    const stars = win ? 1 + (this.towersLost === 0) + (this.time < MATCH.starTime) : 0;
    for (const h of this.heroes) h.celebrate = (h.team === 0) === team0Wins;
    this.rig.follow(this.cores[team0Wins ? 1 : 0]);
    this.rig.lead.set(0, 0, 0);
    bus.emit('end', { win, stars, time: this.time, reason: this.reason, kills: this.kills, destroyed: this.destroyed });
  }

  // state: 'title' | 'match' | 'results'
  render(alpha, dt, t, state) {
    for (const h of this.heroes) h.render(alpha, t, dt, this.myTeam);
    for (const s of this.structures) s.render(t);
    this.camps.render(t);
    this.minions.render(alpha, t);
    this.zones.render();
    if (state !== 'title') this.projectiles.update(dt);
    this.map.update(t, dt, this.push);

    vfx.setMarker(state === 'match' && this.hero.alive ? this.hero.aim : null);
    this._preview(t, state);
    if (state === 'match') this.rig.lead.set(this.hero.dirx * this.hero.moveAmt, 0, this.hero.dirz * this.hero.moveAmt);

    if (this.over && this.win === (this.myTeam === 0)) { // fireworks + confetti over the shattered enemy Core
      this.fw -= dt;
      const c = this.cores[1 - this.myTeam];
      if (this.fw <= 0) {
        this.fw = 0.3;
        const x = c.x + rand(-8, 8), y = rand(5, 10), z = rand(-6, 6);
        particles.burst(x, y, z, 22, { color: CONFETTI, speed: 5, up: 1, size: 0.8, life: 1.1, frame: FRAME.sparkle, grav: 2 });
      }
      for (let i = 0; i < 2; i++) {
        particles.emit(c.x + rand(-9, 9), 12, rand(-7, 7), rand(-0.5, 0.5), rand(-3, -1.5), rand(-0.5, 0.5), CONFETTI[(Math.random() * 6) | 0], 0.45, 3, FRAME.dot, 0);
      }
    }
  }
}
