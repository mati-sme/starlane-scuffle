// Match orchestration: heroes, waves, timer, Starstorm, XP / level-up picks, structure rules, win/lose, per-frame rendering.
import * as THREE from 'three';
import { MATCH, HERO, PAL } from '../config.js';
import { clamp, damp, rand } from '../core/math.js';
import { bus } from '../core/bus.js';
import { input, readMove } from '../core/input.js';
import { particles, FRAME } from '../render/particles.js';
import { vfx } from '../render/vfx.js';
import { Hero, screenToWorld } from '../heroes/hero.js';
import { HEROES, ROSTER } from '../heroes/index.js';
import { rollChoices } from '../heroes/upgrades.js';
import { Tower } from '../world/tower.js';
import { Core } from '../world/core.js';
import { MinionSystem } from '../world/minions.js';
import { Projectiles } from './projectiles.js';
import { Bot } from './bot.js';

const CONFETTI = [PAL.gold, PAL.sunny, PAL.gloom, PAL.heal, PAL.nebulaB, PAL.star];
const IDLE = { x: 0, z: 0, attack: false, cast: [false, false, false] };

export class Match {
  constructor(scene, rig, map) {
    this.scene = scene;
    this.rig = rig;
    this.map = map;
    this.towers = [0, 1].flatMap((team) => [0, 1].map((idx) => new Tower(scene, team, idx)));
    this.cores = [0, 1].map((team) => new Core(scene, team));
    this.structures = [...this.towers, ...this.cores];
    this.minions = new MinionSystem(scene);
    this.projectiles = new Projectiles(scene);
    this.timers = [];
    this.pick = null;
    this.picksOwed = 0;

    this.intent = { x: 0, z: 0, attack: false, cast: [false, false, false] };
    this._screen = { x: 0, y: 0 };
    this._v = new THREE.Vector2();
    this._ray = new THREE.Raycaster();
    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._hit = new THREE.Vector3();

    bus.on('hit', (t) => { if (t === this.hero) rig.shake(0.15); });
    bus.on('down', (t) => {
      if (t.type === 'tower' || t.type === 'core') rig.shake(0.4);
      if (t.type === 'tower' && t.team === 0) this.towersLost++;
      if (t.type === 'minion') this._xp(t, HERO.xp[t.kind], HERO.xpRange);
      else if (t.type === 'hero') {
        this._xp(t, HERO.xp.hero + HERO.xp.heroPerLevel * t.level, HERO.xpHeroRange);
        if (t.killer?.type === 'hero') bus.emit('takedown', { killer: t.killer, victim: t });
      }
    });
    bus.on('levelUp', (h) => this._levelUp(h));
    bus.on('cast', ({ hero, slot }) => { if (slot === 2) rig.shake(hero === this.hero ? 0.4 : 0.2); });

    const id = new URLSearchParams(location.search).get('hero');
    this.setHero(Object.hasOwn(HEROES, id) ? id : 'zip');
  }

  // The player takes `id`; bots take the others in roster order (friendly first, then the two enemies).
  setHero(id) {
    for (const h of this.heroes ?? []) h.dispose();
    const rest = ROSTER.filter((k) => k !== id), bot = (hero) => new Bot(hero);
    const roster = [[id, 0, 0, null], [rest[0], 0, 1, bot], [rest[1], 1, 0, bot], [rest[2], 1, 1, bot]];
    this.heroes = roster.map(([k, team, slot, brain]) => new Hero(this.scene, HEROES[k], team, slot, brain));
    this.hero = this.heroes[0];
    this.heroId = id;
    this.reset();
  }

  reset() {
    this.time = 0;
    this.waveNo = 0;
    this.nextWave = MATCH.firstWave;
    this.storm = false;
    this.over = false;
    this.towersLost = 0;
    this.push = 0;
    this.fw = 0;
    this.win = false;
    this.timers.length = 0;
    this.picksOwed = 0;
    if (this.pick) { this.pick = null; bus.emit('pickEnd', null); }
    input.cast.fill(false);
    input.pick = -1;
    this.heroes.forEach((h) => h.reset());
    this.towers.forEach((t) => t.reset());
    this.cores.forEach((c) => c.reset());
    this.minions.reset();
    this.projectiles.reset();
    particles.clear();
    vfx.setMarker(null);
    this.rig.lead.set(0, 0, 0);
  }

  towersAlive(team) { return this.towers.filter((t) => t.team === team && t.alive).length; }

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
    for (const h of this.heroes) {
      if (h.team === src.team || !h.alive || Math.hypot(h.x - src.x, h.z - src.z) > range) continue;
      h.gainXp(amount);
      const y = src.hitY ?? 1;
      for (let k = 0; k < 3; k++) particles.emit(src.x, y, src.z, (h.x - src.x) / 0.6 + rand(-0.5, 0.5), (1.5 - y) / 0.6, (h.z - src.z) / 0.6 + rand(-0.5, 0.5), PAL.gold, 0.45, 0.6, FRAME.dot);
    }
  }

  // Level 3 unlocks the ult instead of cards. Bots pick at random; the player gets the big-icon choice.
  _levelUp(h) {
    if (h.level === HERO.ultLevel) return;
    if (!h.isPlayer) { h.addUpgrade(rollChoices(h)[0].id); return; }
    this.picksOwed++;
    if (!this.pick) this._openPick();
  }

  _openPick() {
    this.picksOwed--;
    this.pick = { choices: rollChoices(this.hero), t: HERO.pickTime };
    bus.emit('pickStart', this.pick);
  }

  choose(i) {
    if (!this.pick) return;
    const c = this.pick.choices[i];
    this.hero.addUpgrade(c.id);
    this.pick = null;
    bus.emit('pickEnd', c);
    if (this.picksOwed > 0) this._openPick();
  }

  _rules() {
    for (const team of [0, 1]) {
      const [outer, inner] = this.towers.filter((t) => t.team === team);
      outer.vulnerable = true;
      inner.vulnerable = !outer.alive;
      this.cores[team].vulnerable = (!outer.alive && !inner.alive) || this.storm;
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
    for (let i = 0; i < 3; i++) { it.cast[i] = input.cast[i]; input.cast[i] = false; }
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

  update(realDt) {
    let dt = realDt;
    if (this.pick) { // level-up choice: the world slows down while the player decides
      dt *= HERO.pickSlow;
      this.pick.t -= realDt;
      if (input.pick >= 0) { const i = input.pick; input.pick = -1; this.choose(i); }
      else if (this.pick.t <= 0) this.choose(0);
    } else input.pick = -1;

    if (!this.over) {
      this.time += dt;
      if (this.time >= this.nextWave) {
        this.waveNo++;
        this.nextWave += MATCH.waveEvery;
        const big = this.time >= MATCH.bigBlobFrom && this.waveNo % MATCH.bigBlobEvery === 0;
        this.minions.spawnWave(0, big);
        this.minions.spawnWave(1, big);
      }
      if (!this.storm && this.time >= MATCH.storm) {
        this.storm = true;
        this.rig.shake(0.4);
        bus.emit('storm');
      }
    }
    this._rules();
    this._timers(dt);
    for (const h of this.heroes) {
      const it = this.over ? IDLE : h === this.hero ? this._intent() : h.brain.think(dt, this);
      h.update(dt, this, it);
    }
    this._separate();
    this.minions.update(dt, this);
    for (const s of this.structures) s.update(dt, this);
    if (!this.over) this._checkEnd();

    const L = this.minions.list;
    let sum = 0;
    for (const m of L) sum += m.x;
    this.push = damp(this.push, L.length ? clamp(sum / L.length / 30, -1, 1) : 0, 1.5, dt);
  }

  _checkEnd() {
    for (const c of this.cores) if (!c.alive) return this._end(c.team === 1);
    if (this.time >= MATCH.tieBreak) this._end(this.towersAlive(0) >= this.towersAlive(1));
  }

  _end(win) {
    this.over = true;
    this.win = win;
    const stars = win ? 1 + (this.towersLost === 0) + (this.time < MATCH.starTime) : 0;
    for (const h of this.heroes) h.celebrate = (h.team === 0) === win;
    if (this.pick) { this.pick = null; this.picksOwed = 0; bus.emit('pickEnd', null); }
    this.rig.follow(this.cores[win ? 1 : 0]);
    this.rig.lead.set(0, 0, 0);
    bus.emit('end', { win, stars, time: this.time });
  }

  // state: 'title' | 'match' | 'results'
  render(alpha, dt, t, state) {
    for (const h of this.heroes) h.render(alpha, t, dt);
    for (const s of this.structures) s.render(t);
    this.minions.render(alpha, t);
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
