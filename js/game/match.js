// Match orchestration: waves, timer, Starstorm, structure rules, win/lose, per-frame rendering.
import * as THREE from 'three';
import { MATCH, PAL } from '../config.js';
import { clamp, damp, rand } from '../core/math.js';
import { bus } from '../core/bus.js';
import { input, readMove } from '../core/input.js';
import { particles, FRAME } from '../render/particles.js';
import { vfx } from '../render/vfx.js';
import { Hero, screenToWorld } from '../heroes/hero.js';
import { zip } from '../heroes/zip.js';
import { Tower } from '../world/tower.js';
import { Core } from '../world/core.js';
import { MinionSystem } from '../world/minions.js';
import { Projectiles } from './projectiles.js';

const CONFETTI = [PAL.gold, PAL.sunny, PAL.gloom, PAL.heal, PAL.nebulaB, PAL.star];

export class Match {
  constructor(scene, rig, map) {
    this.rig = rig;
    this.map = map;
    this.hero = new Hero(scene, zip, 0);
    this.heroes = [this.hero];
    this.towers = [0, 1].flatMap((team) => [0, 1].map((idx) => new Tower(scene, team, idx)));
    this.cores = [0, 1].map((team) => new Core(scene, team));
    this.structures = [...this.towers, ...this.cores];
    this.minions = new MinionSystem(scene);
    this.projectiles = new Projectiles(scene);

    this.intent = { x: 0, z: 0, attack: false };
    this._screen = { x: 0, y: 0 };
    this._v = new THREE.Vector2();
    this._ray = new THREE.Raycaster();
    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._hit = new THREE.Vector3();

    bus.on('hit', (t) => { if (t === this.hero) rig.shake(0.15); });
    bus.on('down', (t) => {
      if (t.type === 'tower' || t.type === 'core') rig.shake(0.4);
      if (t.type === 'tower' && t.team === 0) this.towersLost++;
    });
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
    this.hero.reset();
    this.towers.forEach((t) => t.reset());
    this.cores.forEach((c) => c.reset());
    this.minions.reset();
    this.projectiles.reset();
    particles.clear();
    vfx.setMarker(null);
    this.rig.lead.set(0, 0, 0);
  }

  towersAlive(team) { return this.towers.filter((t) => t.team === team && t.alive).length; }

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
    if (input.walkClick) {
      this._ray.setFromCamera(input.walkClick, this.rig.camera);
      if (this._ray.ray.intersectPlane(this._plane, this._hit)) hero.walkTo = { x: this._hit.x, z: this._hit.z };
      input.walkClick = null;
    }
    return it;
  }

  update(dt) {
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
    this.hero.update(dt, this, this.over ? { x: 0, z: 0, attack: false } : this._intent());
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
    this.hero.celebrate = win;
    this.rig.follow(this.cores[win ? 1 : 0]);
    this.rig.lead.set(0, 0, 0);
    bus.emit('end', { win, stars, time: this.time });
  }

  // state: 'title' | 'match' | 'results'
  render(alpha, dt, t, state) {
    this.hero.render(alpha, t, dt);
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
