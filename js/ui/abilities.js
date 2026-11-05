// Q / E / R buttons on an arc around Attack: radial cooldown wipe, last-3-seconds digit,
// ready bounce, gold glow + slam when R unlocks. Desktop: same buttons with Q / E / R hints.
import { input } from '../core/input.js';
import { bus } from '../core/bus.js';
import { icons } from './icons.js';

const SLOTS = [{ cls: 's1', key: 'Q' }, { cls: 's2', key: 'E' }, { cls: 'ult', key: 'R' }];

export class Abilities {
  constructor(match) {
    this.match = match;
    this.root = document.createElement('div');
    this.root.id = 'abilities';
    this.btns = SLOTS.map((s, i) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `sk ${s.cls} ready`;
      el.dataset.testid = `skill-${s.key.toLowerCase()}`;
      el.setAttribute('aria-label', `Skill ${s.key}`);
      el.innerHTML = '<i class="face"></i><i class="cd"></i><b class="num"></b><u class="key">' + s.key + '</u><i class="shock"></i>';
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        input.cast[i] = true;
        el.classList.add('down');
      });
      for (const type of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(type, () => el.classList.remove('down'));
      el.addEventListener('contextmenu', (e) => e.preventDefault());
      this.root.appendChild(el);
      return { el, face: el.querySelector('.face'), cd: el.querySelector('.cd'), num: el.querySelector('.num'), p: -1, n: -1, ready: true };
    });
    document.body.appendChild(this.root);
    this.note = document.createElement('div');
    this.note.id = 'notarget';
    this.note.dataset.testid = 'no-target';
    document.body.appendChild(this.note);
    bus.on('ultUnlock', (h) => { if (h === match.hero) this._slam(); });
    bus.on('noCast', ({ hero, slot, why }) => { // a skill press that did nothing always says why
      if (hero !== match.hero) return;
      const el = this.btns[slot].el;
      this.note.textContent = why === 'locked' ? 'Unlocks at Lv 3' : 'No target';
      for (const [node, cls] of [[el, 'nope'], [this.note, 'pop']]) { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); }
    });
  }

  setHero(hero) {
    this.root.style.setProperty('--c', hero.def.css);
    this.btns.forEach((b, i) => { b.face.innerHTML = icons[hero.ab[i].kind]; b.p = b.n = -1; });
  }

  _slam() {
    const el = this.btns[2].el;
    el.classList.remove('slam');
    void el.offsetWidth;
    el.classList.add('slam');
  }

  update() {
    const h = this.match.hero;
    this.btns.forEach((b, i) => {
      const locked = h.ranks[i] === 0;
      const left = locked ? 0 : Math.max(0, h.cds[i]);
      const p = left > 0 ? Math.round((left / (h.cdTotal[i] || 1)) * 1000) / 10 : 0;
      if (p !== b.p) { b.cd.style.setProperty('--p', p); b.p = p; }
      const n = locked ? 'Lv3' : left > 0 && left <= 3 ? Math.ceil(left) : '';
      if (n !== b.n) { b.num.textContent = n; b.n = n; }
      b.el.classList.toggle('locked', locked);
      b.el.classList.toggle('dead', !h.alive);
      const ready = !locked && left <= 0;
      if (ready === b.ready) return;
      b.ready = ready;
      b.el.classList.toggle('ready', ready);
      if (ready) { // bounce
        b.el.classList.remove('ding');
        void b.el.offsetWidth;
        b.el.classList.add('ding');
      }
    });
  }
}
