// In-match HUD: portrait + HP ring, lane bar (minimap), match clock, respawn ring, pooled health bars.
import * as THREE from 'three';
import { MAP, MATCH, TEAM, GROUND } from '../config.js';
import { clamp } from '../core/math.js';
import { bus } from '../core/bus.js';
import { icons } from './icons.js';

const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const pct = (x) => `${clamp((x + MAP.halfLen) / (MAP.halfLen * 2), 0, 1) * 100}%`;
const MAX_BLIPS = 48;

export class Hud {
  constructor(root, barsRoot, match, camera) {
    this.root = root; this.barsRoot = barsRoot; this.match = match; this.camera = camera;
    this.bars = [];
    this._v = new THREE.Vector3();
    this.shown = false;

    root.innerHTML = `
      <div class="portrait"><div class="ring"></div><div class="face">${icons.fox}</div></div>
      <div class="top">
        <div class="lane"><div class="track"></div><div class="items"></div></div>
        <div class="clock"><i class="pie"></i><i class="storm">${icons.star('#FFD23F')}</i></div>
      </div>
      <div class="respawn"><div class="rring"></div><i>${icons.star('#FFD23F')}</i></div>
      <div class="banner">${icons.star('#FFD23F')}${icons.star('#C25BD6')}${icons.star('#FFD23F')}</div>`;
    this.ring = root.querySelector('.ring');
    this.respawn = root.querySelector('.respawn');
    this.rring = root.querySelector('.rring');
    this.pie = root.querySelector('.pie');
    this.clock = root.querySelector('.clock');
    this.banner = root.querySelector('.banner');

    const items = root.querySelector('.items');
    this.icons = match.structures.map((s) => {
      const el = document.createElement('i');
      el.className = `struct ${s.type}`;
      el.innerHTML = s.type === 'tower' ? icons.tower(hex(TEAM[s.team].main)) : icons.core(hex(TEAM[s.team].main));
      el.style.left = pct(s.x);
      items.appendChild(el);
      return el;
    });
    this.blips = Array.from({ length: MAX_BLIPS }, () => {
      const el = document.createElement('b');
      el.className = 'blip';
      items.appendChild(el);
      return el;
    });
    this.heroDot = document.createElement('b');
    this.heroDot.className = 'hero-dot';
    items.appendChild(this.heroDot);

    bus.on('storm', () => {
      this.clock.classList.add('storming');
      this.banner.classList.remove('pop');
      void this.banner.offsetWidth;
      this.banner.classList.add('pop');
    });
    this.onResize();
    addEventListener('resize', () => this.onResize());
  }

  onResize() { this.w = innerWidth; this.h = innerHeight; }

  show() {
    this.root.hidden = false;
    this.shown = true;
    this.clock.classList.remove('storming');
  }

  hide() { this.root.hidden = true; this.shown = false; this.barsRoot.replaceChildren(); this.bars.length = 0; }

  update() {
    if (!this.shown) return;
    const m = this.match, hero = m.hero;

    this.ring.style.setProperty('--p', (hero.hp / hero.maxHp) * 100);
    this.pie.style.setProperty('--p', clamp(m.time / MATCH.storm, 0, 1) * 100);

    const respawning = !hero.alive && hero.dying <= 0 && !m.over;
    this.respawn.classList.toggle('on', respawning);
    if (respawning) this.rring.style.setProperty('--p', (1 - hero.respawn / hero.respawnTotal) * 100);

    m.structures.forEach((s, i) => this.icons[i].classList.toggle('dead', !s.alive));
    this.heroDot.style.left = pct(hero.x);
    this.heroDot.classList.toggle('off', !hero.alive);
    const L = m.minions.list;
    this.blips.forEach((el, i) => {
      const u = L[i];
      el.style.display = u && u.alive ? '' : 'none';
      if (u && u.alive) { el.style.left = pct(u.x); el.style.background = hex(TEAM[u.team].main); }
    });

    this._bars();
  }

  // Health bars: hero always, structures always, minions once damaged.
  _bars() {
    const m = this.match;
    let n = 0;
    const put = (e, cls, y) => {
      if (!e.alive || (e.type === 'minion' && e.hp >= e.maxHp)) return;
      const v = this._v.set(e.rx ?? e.x, GROUND + y, e.rz ?? e.z).project(this.camera);
      if (v.z > 1) return;
      let b = this.bars[n++];
      if (!b) {
        const el = document.createElement('div');
        el.innerHTML = '<i></i>';
        this.barsRoot.appendChild(el);
        b = this.bars[n - 1] = { el, fill: el.firstChild, cls: '', w: -1 };
      }
      if (b.cls !== cls) { b.el.className = `bar ${cls}`; b.cls = cls; }
      b.el.style.display = '';
      b.el.style.transform = `translate(${((v.x * 0.5 + 0.5) * this.w).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * this.h).toFixed(1)}px) translate(-50%, -100%)`;
      const w = Math.round((e.hp / e.maxHp) * 100);
      if (b.w !== w) { b.fill.style.width = w + '%'; b.w = w; }
    };
    put(m.hero, 'hero t0 me', m.hero.barY);
    for (const s of m.structures) put(s, `struct t${s.team}`, s.barY);
    for (const u of m.minions.list) put(u, `minion t${u.team}`, u.barY);
    for (let i = n; i < this.bars.length; i++) this.bars[i].el.style.display = 'none';
  }
}
