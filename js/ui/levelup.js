// Level-up cards: two big icon cards (no text) with owned-count pips and a timer bar. Tap one or press 1 / 2.
import { bus } from '../core/bus.js';
import { HERO } from '../config.js';
import { icons } from './icons.js';

export class LevelUp {
  constructor(match) {
    this.match = match;
    this.root = document.createElement('div');
    this.root.id = 'cards';
    this.root.hidden = true;
    document.body.appendChild(this.root);
    this.root.addEventListener('pointerdown', (e) => {
      const card = e.target.closest('.card');
      if (!card) return;
      e.preventDefault();
      match.choose(+card.dataset.i);
    });
    bus.on('pickStart', (pick) => this.show(pick));
    bus.on('pickEnd', () => this.hide());
  }

  show(pick) {
    const h = this.match.hero;
    const pips = (id) => [0, 1, 2].map((k) => `<i class="${k < (h.up[id] ?? 0) ? 'on' : ''}"></i>`).join('');
    this.root.style.setProperty('--c', h.def.color);
    this.root.innerHTML = '<div class="row">' + pick.choices.map((c, i) =>
      `<button type="button" class="card${c.hero ? ' hero' : ''}" data-i="${i}" style="--d:${i * 0.08}s">` +
      `<span class="ico">${icons[c.icon]}</span><span class="pips">${pips(c.id)}</span></button>`).join('') +
      '</div><div class="timer"><i></i></div>';
    this.bar = this.root.querySelector('.timer i');
    this.root.hidden = false;
  }

  hide() { this.root.hidden = true; }

  update() {
    const pick = this.match.pick;
    if (!this.root.hidden && pick) this.bar.style.width = `${Math.max(0, pick.t / HERO.pickTime) * 100}%`;
  }
}
