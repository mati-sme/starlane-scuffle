// In-match HUD: portrait + HP ring + XP arc + level, corner minimap, scorebar (kills, clock, structure pips), respawn ring,
// takedown banner, pooled health bars. Owns the skill buttons (with their rank-up +) and the level pill.
import * as THREE from 'three';
import { HERO, GROUND } from '../config.js';
import { bus } from '../core/bus.js';
import { icons } from './icons.js';

// Rendered bust of the champion (assets/portraits, same art as champion select).
const face = (def) => `<img src="assets/portraits/${def.id}.png" alt="" draggable="false" style="--c:${def.css}">`;
import { Abilities } from './abilities.js';
import { LevelUp } from './levelup.js';
import { Minimap } from './minimap.js';
import { Shop } from './shop.js';
import { BOSS } from '../config.js';
import { TEAM_NAME } from '../net/protocol.js';

const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export class Hud {
  constructor(root, barsRoot, match, camera) {
    this.root = root; this.barsRoot = barsRoot; this.match = match; this.camera = camera;
    this.bars = [];
    this._v = new THREE.Vector3();
    this.shown = false;
    this.lvl = -1;

    root.innerHTML = `
      <div class="portrait"><div class="xp"></div><div class="ring"></div><div class="face"></div><b class="lvl" data-testid="hud-level">1</b></div>
      <canvas id="mini" data-testid="minimap"></canvas>
      <div class="top" data-testid="scorebar">
        <div class="score"><b class="k0" data-testid="kills-blue">0</b><span class="clock" data-testid="clock">0:00</span><b class="k1" data-testid="kills-red">0</b></div>
        <div class="pips"><div class="t0" data-testid="pips-blue"></div><div class="t1" data-testid="pips-red"></div></div>
      </div>
      <div class="buffs" data-testid="buffs"></div>
      <div class="toast" data-testid="boss-toast"></div>
      <div class="gear" data-testid="gear"></div>
      <div class="respawn"><div class="rring"></div><i>${icons.star('#FFC83D')}</i><b class="rsec" data-testid="respawn-secs"></b></div>
      <div class="ko" data-testid="ko-banner"></div>
      <div class="objective" data-testid="objective-hint">Destroy enemy towers, then the core!</div>
      <div class="takedown"><i class="k"></i><s>${icons.star('#FFC83D')}</s><i class="v"></i></div>
      <div class="banner">${icons.star('#FFC83D')}${icons.star('#3DA5FF')}${icons.star('#FFC83D')}</div>`;
    this.nums = []; this.numAt = 0;
    for (let i = 0; i < 14; i++) {
      const el = document.createElement('div');
      el.className = 'dnum';
      el.addEventListener('animationend', () => el.classList.remove('go'));
      barsRoot.appendChild(el);
      this.nums.push(el);
    }
    bus.on('dmg', (e) => this._num(e));
    this.calls = []; this.callAt = 0;
    for (let i = 0; i < 6; i++) {
      const el = document.createElement('div');
      el.className = 'callout';
      el.addEventListener('animationend', () => el.classList.remove('go'));
      barsRoot.appendChild(el);
      this.calls.push(el);
    }
    bus.on('cast', (e) => this._callout(e));
    this.ring = root.querySelector('.ring');
    this.xp = root.querySelector('.xp');
    this.face = root.querySelector('.portrait .face');
    this.lvlEl = root.querySelector('.lvl');
    this.respawn = root.querySelector('.respawn');
    this.rring = root.querySelector('.rring');
    this.rsec = root.querySelector('.rsec');
    this.ko = root.querySelector('.ko');
    this.objective = root.querySelector('.objective');
    this.rs = -1;
    this.clock = root.querySelector('.clock');
    this.kills = [root.querySelector('.k0'), root.querySelector('.k1')];
    this.pipEls = [0, 1].map((t) => root.querySelector(`.pips .t${t}`));
    this.pipKey = ['', ''];
    this.sec = -1;
    this.mini = new Minimap(root.querySelector('#mini'), match);
    this.atk = document.getElementById('atk');
    this.banner = root.querySelector('.banner');
    this.take = root.querySelector('.takedown');

    this.pipEls.forEach((el, t) => {
      el.innerHTML = '<i></i>'.repeat(11) + '<i class="core"></i>';
      this.pipKey[t] = '';
    });
    this.shop = new Shop(root.querySelector('.gear'), match);
    this.buffsEl = root.querySelector('.buffs');
    this.toast = root.querySelector('.toast');
    this.buffKey = '';
    const say = (text, team) => {
      this.toast.textContent = text;
      this.toast.className = `toast t${team}`;
      void this.toast.offsetWidth;
      this.toast.classList.add('pop');
    };
    const EL = { fire: ['Fire Dragon', '+damage'], ice: ['Ice Dragon', '+resist'], gale: ['Gale Dragon', '+speed'] };
    const name = (c) => (c.boss === 'dragon' ? EL[BOSS.elements[c.variant % 3]][0] : BOSS[c.boss].name);
    bus.on('bossSoon', (c) => { if (this.shown) say(`${BOSS[c.boss].name} awakens in ${BOSS.warn}s`, 2); });
    bus.on('bossSpawn', (c) => { if (this.shown) say(`${name(c)} has awakened!`, 2); });
    bus.on('bossTaken', ({ kind, team, variant }) => {
      if (!this.shown) return;
      const eff = { dragon: EL[BOSS.elements[variant % 3]][1], titan: 'minions empowered', herald: 'siege power' }[kind];
      say(`${TEAM_NAME[team]} slayed the ${kind === 'dragon' ? EL[BOSS.elements[variant % 3]][0] : BOSS[kind].name}: ${eff}!`, team);
    });
    this.abilities = new Abilities(match);
    this.levelup = new LevelUp(match);

    bus.on('storm', () => {
      this.clock.classList.add('storming');
      this.banner.classList.remove('pop');
      void this.banner.offsetWidth;
      this.banner.classList.add('pop');
    });
    bus.on('takedown', ({ killer, victim }) => {
      this.take.querySelector('.k').innerHTML = face(killer.def);
      this.take.querySelector('.v').innerHTML = face(victim.def);
      this.take.classList.remove('pop');
      void this.take.offsetWidth;
      this.take.classList.add('pop');
    });
    bus.on('down', (t) => { // kill feedback for the player only; ally takedowns keep the icon pop
      if (!this.shown || t.type !== 'hero') return;
      const k = t.killer, hero = this.match.hero;
      if (t === hero) this._ko(k?.type === 'hero' ? `${k.def.name} defeated you` : 'You were defeated', 'lost');
      else if (k === hero) this._ko(`KO! You defeated ${t.def.name}`, 'won');
    });
    this.onResize();
    addEventListener('resize', () => { this.onResize(); this.mini.resize(); });
  }

  _ko(text, cls) {
    this.ko.textContent = text;
    this.ko.className = `ko ${cls}`;
    void this.ko.offsetWidth;
    this.ko.classList.add('pop');
  }

  onResize() { this.w = innerWidth; this.h = innerHeight; }

  // (Re)build everything that depends on which heroes are in the match.
  _setup() {
    const m = this.match, hero = m.hero;
    this.face.innerHTML = face(hero.def);
    this.root.style.setProperty('--hero', hero.def.css);
    this.abilities.setHero(hero);
    this.shop.reset();
    this.toast.className = 'toast';
    this.buffKey = '';
    this.levelup.reset();
    this.atk.innerHTML = icons[`basic_${hero.basic.kind}`] ?? icons.basic_melee;
    this.lvl = -1;
    this.sec = -1;
  }

  show() {
    this._setup();
    this.root.hidden = false;
    this.mini.resize(); // needs real layout size, so after un-hiding
    this.shown = true;
    this.clock.classList.remove('storming');
    this.take.classList.remove('pop');
    this.ko.classList.remove('pop');
    this.objective.classList.remove('pop');
    void this.objective.offsetWidth;
    this.objective.classList.add('pop'); // once per match start
  }

  // Floating damage: the player's hits (bigger; gold for skills) and big hits the player takes (red).
  _num({ t, amount, src, skill }) {
    const hero = this.match.hero;
    const mine = src === hero, taken = t === hero && amount >= 5;
    if (!this.shown || !(mine || taken) || amount < 1) return;
    const v = this._v.set(t.rx ?? t.x, GROUND + (t.barY ?? 1.5) + 0.3, t.rz ?? t.z).project(this.camera);
    if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) return;
    const el = this.nums[this.numAt++ % this.nums.length];
    el.textContent = Math.round(amount);
    el.className = `dnum go ${mine ? (skill ? 'skill' : 'mine') : 'taken'}`;
    el.style.left = `${((v.x * 0.5 + 0.5) * this.w + (Math.random() - 0.5) * 24).toFixed(0)}px`;
    el.style.top = `${((-v.y * 0.5 + 0.5) * this.h).toFixed(0)}px`;
  }

  // Skill-name callout over the caster: every ult (team colored), plus the player's own Q / E.
  _callout({ hero, slot }) {
    const me = this.match?.hero;
    if (!this.shown || !me || !hero || (slot !== 2 && hero !== me) || (hero.hidden && hero.team !== me.team)) return;
    const ab = hero.def[['s1', 's2', 'ult'][slot]];
    const v = this._v.set(hero.rx ?? hero.x, GROUND + (hero.barY ?? 1.5) + 0.9, hero.rz ?? hero.z).project(this.camera);
    if (!ab || v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) return;
    const el = this.calls[this.callAt++ % this.calls.length];
    el.textContent = ab.name;
    el.className = `callout go ${slot === 2 ? 'ult' : ''} ${hero.team === me.team ? 'ally' : 'foe'}`;
    el.style.left = `${((v.x * 0.5 + 0.5) * this.w).toFixed(0)}px`;
    el.style.top = `${((-v.y * 0.5 + 0.5) * this.h).toFixed(0)}px`;
  }

  hide() { this.root.hidden = true; this.shown = false; this.barsRoot.replaceChildren(...this.nums, ...this.calls); this.bars.length = 0; this.levelup.hide(); }

  update(dt = 0.016) {
    if (!this.shown) return;
    this.dt = dt;
    const m = this.match, hero = m.hero;

    this.ring.style.setProperty('--p', (hero.hp / hero.maxHp) * 100);
    this.xp.style.setProperty('--p', hero.level >= HERO.maxLevel ? 100 : (hero.xp / HERO.xpNeed(hero.level)) * 100);
    if (this.lvl !== hero.level) { this.lvl = hero.level; this.lvlEl.textContent = hero.level; }
    const sec = Math.floor(m.time);
    if (sec !== this.sec) { this.sec = sec; this.clock.textContent = mmss(m.time); }
    this.clock.classList.toggle('storming', m.storm);
    for (const t of [0, 1]) {
      const k = String(m.kills[t]);
      if (this.kills[t].textContent !== k) this.kills[t].textContent = k;
      const alive = m.structures.filter((s) => s.team === t).map((s) => (s.alive ? 1 : 0)).join('');
      if (alive !== this.pipKey[t]) { // 9 lane towers (outer / inner / inhib x top / mid / bot), 2 guardians, core
        this.pipKey[t] = alive;
        [...this.pipEls[t].children].forEach((el, i) => el.classList.toggle('dead', alive[i] === '0'));
      }
    }

    const respawning = !hero.alive && hero.dying <= 0 && !m.over;
    this.respawn.classList.toggle('on', respawning);
    if (respawning) {
      this.rring.style.setProperty('--p', (1 - hero.respawn / hero.respawnTotal) * 100);
      const rs = Math.ceil(hero.respawn);
      if (rs !== this.rs) { this.rs = rs; this.rsec.textContent = rs; }
    }

    this.mini.update(this.dt, m.rig, this.w / this.h);
    this.shop.update();
    this._buffs();

    this.abilities.update();
    this.levelup.update();
    this._bars();
  }

  // Active team buffs under the scorebar: dragon stacks, Titan and Herald timers.
  _buffs() {
    const parts = this.match.buffs.map((b) => {
      const o = [];
      for (const e of BOSS.elements) if (b[e]) o.push(`${e.toUpperCase()} x${b[e]}`);
      if (b.dragonT > 0 && o.length) o.push(mmss(b.dragonT));
      if (b.titanT > 0) o.push(`TITAN ${mmss(b.titanT)}`);
      if (b.heraldT > 0) o.push(`HERALD ${mmss(b.heraldT)}`);
      return o.join(' · ');
    });
    const key = parts.join('|');
    if (key === this.buffKey) return;
    this.buffKey = key;
    this.buffsEl.innerHTML = parts.map((p, t) => (p ? `<span class="t${t}">${p}</span>` : '')).join('');
  }

  // Health bars: heroes and structures always, minions once damaged.
  _bars() {
    const m = this.match;
    let n = 0;
    const put = (e, cls, y) => {
      if (!e.alive || ((e.type === 'minion' || (e.type === 'camp' && !e.boss)) && e.hp >= e.maxHp) || (e.type === 'hero' && e.hidden && e.team !== m.myTeam)) return;
      const v = this._v.set(e.rx ?? e.x, GROUND + y + (e.lift ?? 0), e.rz ?? e.z).project(this.camera);
      if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) return;
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
    for (const h of m.heroes) put(h, `hero t${h.team}${h === m.hero ? ' me' : ''}`, h.barY);
    for (const s of m.structures) put(s, `struct t${s.team}`, s.barY);
    for (const c of m.camps.list) put(c, c.boss ? 'boss t2' : 'minion t2', c.barY);
    for (const u of m.minions.list) put(u, `minion t${u.team}`, u.barY);
    for (let i = n; i < this.bars.length; i++) this.bars[i].el.style.display = 'none';
  }
}
