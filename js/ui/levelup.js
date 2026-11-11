// Level / XP feedback: a compact pill beside the portrait (level, unspent points, XP bar) plus the level toast and +XP pop.
// Skill ranking itself lives on the skill buttons (ui/abilities.js); nothing here ever pauses the game.
import { bus } from '../core/bus.js';
import { HERO } from '../config.js';

export class LevelUp {
  constructor(match) {
    this.match = match;
    this.last = { pts: -1, lv: -1, xp: -1 };
    this.root = document.createElement('div');
    this.root.id = 'lvinfo';
    this.root.dataset.testid = 'level-info';
    this.root.innerHTML = `
      <div class="lvpill"><small class="lv" data-testid="level-label">Lv 1</small><em class="pts" data-testid="upgrade-points">0</em><span class="xpb"><i></i></span></div>
      <div class="lvtoast" data-testid="level-toast"></div>
      <div class="xpgain" data-testid="xp-gain"></div>`;
    document.body.appendChild(this.root);

    this.pill = this.root.querySelector('.lvpill');
    this.pts = this.root.querySelector('.pts');
    this.lv = this.root.querySelector('.lv');
    this.xpb = this.root.querySelector('.xpb i');
    this.toast = this.root.querySelector('.lvtoast');
    this.gain = this.root.querySelector('.xpgain');

    const mine = (h) => h === match.hero;
    bus.on('levelUp', (h) => {
      if (!mine(h)) return;
      this.toast.textContent = h.level === HERO.ultLevel ? `Lv ${h.level} · R ready` : `Lv ${h.level} · +1`;
      this._pop(this.toast, 'pop');
      this._pop(this.pill, 'bump');
    });
    bus.on('xp', ({ hero, amount }) => {
      if (!mine(hero)) return;
      this.gain.textContent = `+${amount} XP`;
      this._pop(this.gain, 'pop');
    });
  }

  _pop(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  // Fresh match: re-read everything.
  reset() {
    this.toast.classList.remove('pop');
    this.gain.classList.remove('pop');
    this.last = { pts: -1, lv: -1, xp: -1 };
  }

  hide() {}

  update() {
    const h = this.match.hero, L = this.last;
    if (h.points !== L.pts) {
      L.pts = h.points;
      this.pts.textContent = h.points;
      this.pill.classList.toggle('has', h.points > 0);
    }
    if (h.level !== L.lv) {
      L.lv = h.level;
      this.lv.textContent = h.level >= HERO.maxLevel ? 'MAX' : `Lv ${h.level}`;
    }
    const xp = h.level >= HERO.maxLevel ? 100 : Math.round((h.xp / HERO.xpNeed(h.level)) * 100);
    if (xp !== L.xp) { L.xp = xp; this.xpb.style.width = `${xp}%`; }
  }
}
