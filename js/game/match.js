// Match orchestration: heroes, waves, timer, Starstorm, XP, structure rules, win/lose, per-frame rendering.
import * as THREE from 'three';
import { MATCH, HERO, PAL, CAMP, TOWER } from '../config.js';
import { clamp, damp, rand } from '../core/math.js';
import { bus } from '../core/bus.js';
import { input, readMove } from '../core/input.js';
import { particles, FRAME } from '../render/particles.js';
import { vfx } from '../render/vfx.js';
import { Hero, screenToWorld } from '../heroes/hero.js';
import { HEROES, ROSTER } from '../heroes/index.js';
import { addBuff, heal } from './combat.js';
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
    this.projectiles.blocker = this.zones;
    this.timers = [];

    this.intent = { x: 0, z: 0, attack: false, cast: [false, false, false] };
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
      if (t.type === 'tower' && t.team === 0) this.towersLost++;
      if (t.type === 'tower' || t.type === 'core') this.destroyed[1 - t.team]++;
      if (t.type === 'camp') this._camp(t);
      else if (t.type === 'minion') this._xp(t, HERO.xp[t.kind], HERO.xpRange);
      else if (t.type === 'hero') {
        this._xp(t, HERO.xp.hero + HERO.xp.heroPerLevel * t.level, HERO.xpHeroRange);
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
    for (const h of this.heroes ?? []) h.dispose();
    const { blue, red } = composeTeams(id, bots ?? []), bot = (hero) => new Bot(hero);
    const roster = [...blue.map((k, i) => [k, 0, i, i ? bot : null]), ...red.map((k, i) => [k, 1, i, bot])];
    this.heroes = roster.map(([k, team, slot, brain]) => new Hero(this.scene, HEROES[k], team, slot, brain));
    this.hero = this.heroes[0];
    this.heroId = id;
    assignLanes(this.heroes);
    this.reset();
  }

  reset() {
    this.time = 0;
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
    input.cast.fill(false);
    input.spend.fill(false);
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

  // Order of falling: outer towers always; guardians once any own outer is down; the core once both guardians are down
  // (or in Overdrive with one guardian down). Structures with no enemy minion within shieldR take reduced hero damage.
  _rules(dt) {
    const shield = (this._shT -= dt) <= 0;
    if (shield) this._shT = 0.25;
    for (const team of [0, 1]) {
      const mine = this.towers.filter((t) => t.team === team), outer = mine.filter((t) => t.tier === 'outer'), guard = mine.filter((t) => t.tier === 'guard');
      const outerDown = outer.some((t) => !t.alive), guardsDown = guard.filter((t) => !t.alive).length;
      for (const t of outer) t.vulnerable = true;
      for (const t of guard) t.vulnerable = outerDown;
      this.cores[team].vulnerable = guardsDown === guard.length || (this.storm && guardsDown > 0);
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
    for (let i = 0; i < 3; i++) {
      it.cast[i] = input.cast[i]; input.cast[i] = false;
      if (input.spend[i]) { hero.spendPoint(i); input.spend[i] = false; }
    }
    if (input.walkClick) {
      this._ray.setFromCamera(input.walkClick, this.rig.camera);
      if (this._ray.ray.intersectPlane(this._plane, this._hit)) hero.walkTo = { x: this._hit.x, z: this._hit.z };
      input.walkClick = null;
    }
    return it;
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

  update(dt) {
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
    this._brush();
    this._timers(dt);
    this.zones.update(dt, this);
    for (const h of this.heroes) {
      const it = this.over ? IDLE : h === this.hero ? this._intent() : h.brain.think(dt, this);
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

  _end(win, reason) {
    this.over = true;
    this.win = win;
    this.reason = reason === 'core' ? (win ? 'Enemy core destroyed' : 'Your core fell') : `${win ? 'Won' : 'Lost'} on ${reason}`;
    const stars = win ? 1 + (this.towersLost === 0) + (this.time < MATCH.starTime) : 0;
    for (const h of this.heroes) h.celebrate = (h.team === 0) === win;
    this.rig.follow(this.cores[win ? 1 : 0]);
    this.rig.lead.set(0, 0, 0);
    bus.emit('end', { win, stars, time: this.time, reason: this.reason, kills: this.kills, destroyed: this.destroyed });
  }

  // state: 'title' | 'match' | 'results'
  render(alpha, dt, t, state) {
    for (const h of this.heroes) h.render(alpha, t, dt);
    for (const s of this.structures) s.render(t);
    this.camps.render(t);
    this.minions.render(alpha, t);
    this.zones.render();
    if (state !== 'title') this.projectiles.update(dt);
    this.map.update(t, dt, this.push);

    vfx.setMarker(state === 'match' && this.hero.alive ? this.hero.aim : null);
    if (state === 'match') this.rig.lead.set(this.hero.dirx * this.hero.moveAmt, 0, this.hero.dirz * this.hero.moveAmt);

    if (this.over && this.win) { // fireworks + confetti over the shattered enemy Core
      this.fw -= dt;
      const c = this.cores[1];
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
