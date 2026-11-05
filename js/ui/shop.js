// Gold + gear strip (bottom centre): gold counter, 7 item slots (boots + 6) and the next recommended item with a progress bar.
// Purchases are automatic in the base ring; tapping the next-item button while you can afford it starts a recall.
import { bus } from '../core/bus.js';
import { input } from '../core/input.js';
import { ITEMS, MAX_ITEMS, nextItem, atBase } from '../game/gear.js';
import { itemIcon } from './icons.js';

const COIN = '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" stroke="#0B1020" stroke-width="4"><circle cx="32" cy="32" r="26" fill="#FFC83D"/><circle cx="32" cy="32" r="15" fill="none" stroke="#B37A00" stroke-width="5"/></svg>';

export class Shop {
  constructor(root, match) {
    this.match = match;
    root.innerHTML = `
      <div class="gold"><i>${COIN}</i><b data-testid="gold">0</b><em class="plus"></em></div>
      <div class="slots">${Array.from({ length: MAX_ITEMS }, (_, i) => `<div class="slot${i ? '' : ' boots'}" data-testid="item-slot-${i}"></div>`).join('')}</div>
      <button class="next" data-testid="shop-next" type="button"><span class="nic"></span><small></small><u></u></button>`;
    this.goldEl = root.querySelector('.gold b');
    this.plus = root.querySelector('.plus');
    this.slots = [...root.querySelectorAll('.slot')];
    this.next = root.querySelector('.next');
    this.nic = root.querySelector('.nic');
    this.cost = root.querySelector('.next small');
    this.bar = root.querySelector('.next u');
    this.key = '';
    this.gold = -1;
    this.sum = 0;
    this.next.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      const h = this.match.hero, it = nextItem(h);
      if (it && h.gold >= it.cost && !atBase(h)) input.recall = true; // recall home to spend it
    });
    bus.on('gold', ({ hero, amount }) => {
      if (hero !== this.match.hero) return;
      this.sum += amount;
      this.plus.textContent = `+${this.sum}`;
      this.plus.classList.remove('go');
      void this.plus.offsetWidth;
      this.plus.classList.add('go');
      clearTimeout(this.t);
      this.t = setTimeout(() => { this.sum = 0; }, 900);
    });
    bus.on('buy', (h) => { if (h === this.match.hero) { this.key = ''; root.classList.remove('bought'); void root.offsetWidth; root.classList.add('bought'); } });
  }

  reset() { this.key = ''; this.gold = -1; }

  update() {
    const h = this.match.hero, g = Math.floor(h.gold);
    if (g !== this.gold) { this.gold = g; this.goldEl.textContent = g; }
    const it = nextItem(h), key = h.items.join();
    if (key !== this.key) {
      this.key = key;
      this.slots.forEach((el, i) => {
        const item = ITEMS[h.items[i]];
        el.innerHTML = item ? itemIcon(item) : '';
        el.title = item ? `${item.name}: ${item.tip}` : '';
        el.classList.toggle('full', !!item);
      });
      this.nic.innerHTML = it ? itemIcon(it) : '';
      this.next.title = it ? `Next: ${it.name} (${it.cost}) ${it.tip}` : 'Fully geared!';
    }
    const k = it ? Math.min(1, h.gold / it.cost) : 1, ready = !!it && k >= 1;
    this.bar.style.width = `${k * 100}%`;
    this.cost.textContent = it ? it.cost : 'MAX';
    this.next.classList.toggle('ready', ready);
    this.next.classList.toggle('home', ready && !atBase(h));
  }
}
