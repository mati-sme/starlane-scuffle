// Skill upgrade drawer: a compact edge tab (always shows unspent points) that opens a row of Q / E / R rank buttons.
// Fully nonmodal: never pauses or slows the game. U toggles it, keys 1 / 2 / 3 rank up Q / E / R (core/input.js).
import { bus } from '../core/bus.js';
import { HERO } from '../config.js';
import { icons } from './icons.js';
import { save } from '../save.js';

const KEYS = ['Q', 'E', 'R'];
const COLLAPSE_AFTER = 1500;

export class LevelUp {
  constructor(match) {
    this.match = match;
    this.collapseAt = 0;
    this.last = { pts: -1, lv: -1, xp: -1, slots: ['', '', ''] };
    this.root = document.createElement('div');
    this.root.id = 'upgrades';
    this.root.dataset.testid = 'upgrades';
    this.root.innerHTML = `
      <div class="upanel" data-testid="upgrade-panel">${KEYS.map((k, i) => `
        <button type="button" class="upbtn" data-slot="${i}" data-testid="upgrade-${k.toLowerCase()}" aria-label="Upgrade ${k}">
          <span class="ico"></span><b>${k}</b><span class="pips">${'<i></i>'.repeat(HERO.maxRank[i])}</span><u class="mark"></u>
        </button>`).join('')}
      </div>
      <button type="button" class="utab" data-testid="upgrade-tab" aria-label="Skill points" aria-expanded="false">
        <span class="chev">${icons.plus}</span><em class="pts" data-testid="upgrade-points">0</em>
        <small class="lv" data-testid="level-label">Lv 1</small><span class="xpb"><i></i></span>
      </button>
      <div class="lvtoast" data-testid="level-toast"></div>
      <div class="xpgain" data-testid="xp-gain"></div>`;
    document.body.appendChild(this.root);

    this.tab = this.root.querySelector('.utab');
    this.pts = this.root.querySelector('.pts');
    this.lv = this.root.querySelector('.lv');
    this.xpb = this.root.querySelector('.xpb i');
    this.toast = this.root.querySelector('.lvtoast');
    this.gain = this.root.querySelector('.xpgain');
    this.btns = [...this.root.querySelectorAll('.upbtn')].map((el) => ({
      el, pips: [...el.querySelectorAll('.pips i')], mark: el.querySelector('.mark'), ico: el.querySelector('.ico'),
    }));

    this.tab.addEventListener('pointerdown', (e) => { e.preventDefault(); this.toggle(); });
    for (const [i, b] of this.btns.entries()) {
      b.el.addEventListener('pointerdown', (e) => { e.preventDefault(); this.match.hero.spendPoint(i); });
    }
    addEventListener('keydown', (e) => {
      if (e.code === 'KeyU' && !e.repeat && document.body.classList.contains('playing')) this.toggle();
    });

    const mine = (h) => h === match.hero;
    bus.on('rankUp', ({ hero, slot }) => {
      if (!mine(hero)) return;
      this._pop(this.btns[slot].el, 'shine');
      if (hero.points === 0) this.collapseAt = performance.now() + COLLAPSE_AFTER;
    });
    bus.on('levelUp', (h) => {
      if (!mine(h)) return;
      this.toast.textContent = h.level === HERO.ultLevel ? `LEVEL ${h.level} · R UNLOCKED · +1 POINT` : `LEVEL ${h.level} · +1 POINT`;
      this._pop(this.toast, 'pop');
      this._pop(this.tab, 'bump');
      if (!save.get('upSeen', false)) { save.set('upSeen', true); this.open(true); } // once, to show where upgrades live
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

  open(v) {
    this.root.classList.toggle('open', v);
    this.tab.setAttribute('aria-expanded', String(v));
    this.collapseAt = 0;
  }

  toggle() { this.open(!this.root.classList.contains('open')); }

  // Fresh match: close the drawer and re-read everything.
  reset() {
    this.open(false);
    this.toast.classList.remove('pop');
    this.gain.classList.remove('pop');
    this.last = { pts: -1, lv: -1, xp: -1, slots: ['', '', ''] };
    this.btns.forEach((b, i) => { b.ico.innerHTML = icons[this.match.hero.ab[i].kind]; });
  }

  hide() { this.open(false); }

  update() {
    const h = this.match.hero, L = this.last;
    if (h.points !== L.pts) {
      L.pts = h.points;
      this.pts.textContent = h.points;
      this.tab.classList.toggle('has', h.points > 0);
    }
    if (h.level !== L.lv) {
      L.lv = h.level;
      this.lv.textContent = h.level >= HERO.maxLevel ? 'MAX' : `Lv ${h.level}`;
    }
    const xp = h.level >= HERO.maxLevel ? 100 : Math.round((h.xp / HERO.xpNeed(h.level)) * 100);
    if (xp !== L.xp) { L.xp = xp; this.xpb.style.width = `${xp}%`; }

    this.btns.forEach((b, i) => {
      const r = h.ranks[i], max = HERO.maxRank[i], can = h.canSpend(i);
      const gate = r < max ? HERO.gate(i, r + 1) : 0, gated = r < max && h.level < gate;
      const key = `${r}|${can}|${gated ? gate : 0}`;
      if (key === L.slots[i]) return;
      L.slots[i] = key;
      b.pips.forEach((p, k) => p.classList.toggle('on', k < r));
      b.mark.textContent = r >= max ? 'MAX' : can ? '+' : gated ? `Lv ${gate}` : '';
      b.el.classList.toggle('can', can);
      b.el.classList.toggle('off', !can);
      b.el.classList.toggle('maxed', r >= max);
      b.el.dataset.rank = r;
    });

    if (this.collapseAt && performance.now() > this.collapseAt) this.open(false);
  }
}
