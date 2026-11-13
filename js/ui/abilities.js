// Q / W / E / R buttons on an arc around Attack (R = ultimate) plus the champion's passive badge: radial cooldown wipe, last-3-seconds digit,
// ready bounce, gold glow + slam when R unlocks. Desktop: same buttons with Q / W / E / R hints.
// Wild Rift style ranking: a small gold + sits above each skill button that can take a point right now (tap = spendPoint).
import { input } from '../core/input.js';
import { bus } from '../core/bus.js';
import { icons } from './icons.js';
import { RECALL_T } from '../heroes/hero.js';
import { SPELLS } from '../game/spells.js';
import { skillArt, passiveArt } from './skillart.js';
import { HERO } from '../config.js';

const DRAG_START = 14; // px of drag before a press turns from a tap (quick-cast) into an aim
const DRAG_FULL = 90;  // px of drag = full skill range
const CANCEL_R = 26;   // px: letting go this close to the button's centre cancels the cast

const SLOTS = [{ cls: 's1', key: 'Q' }, { cls: 's2', key: 'W' }, { cls: 's3', key: 'E' }, { cls: 'ult', key: 'R' }];

export class Abilities {
  constructor(match) {
    this.match = match;
    this.root = document.createElement('div');
    this.root.id = 'abilities';
    this.ups = [];
    this.btns = SLOTS.map((s, i) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `sk ${s.cls} ready`;
      el.dataset.testid = `skill-${s.key.toLowerCase()}`;
      el.setAttribute('aria-label', `Skill ${s.key}`);
      el.innerHTML = '<i class="face"></i><i class="cd"></i><b class="num"></b><u class="key">' + s.key + '</u><i class="shock"></i>';
      this._drag(el, i);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
      this.root.appendChild(el);
      const up = document.createElement('button');
      up.type = 'button';
      up.className = `skup ${s.cls}`;
      up.hidden = true;
      up.dataset.testid = `skill-up-${s.key.toLowerCase()}`;
      up.setAttribute('aria-label', `Rank up ${s.key}`);
      up.innerHTML = '<span>+</span>';
      // '+' is a tap, not a drag: rank on pointerdown. iOS / WebKit may send pointercancel (or no click, after preventDefault) instead of pointerup,
      // and a synthesized click is dropped while other fingers are down. The click only covers keyboard / assistive taps.
      let lastSpend = -1e9;
      // v10: rank up through the input queue (like keys 1-4) so an online guest's tap reaches the host; the host applies it locally the same frame.
      const spend = () => { lastSpend = performance.now(); if (this.match.role === 'guest') input.spend[i] = true; else this.match.hero.spendPoint(i); };
      up.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        spend();
      });
      up.addEventListener('click', () => { if (performance.now() - lastSpend > 600) spend(); });
      up.addEventListener('contextmenu', (e) => e.preventDefault());
      this.root.appendChild(up);
      this.ups.push(up);
      return { el, face: el.querySelector('.face'), cd: el.querySelector('.cd'), num: el.querySelector('.num'), p: -1, n: -1, ready: true };
    });
    this._extras();
    document.body.appendChild(this.root);
    this.passive = document.createElement('button');
    this.passive.type = 'button';
    this.passive.id = 'passive';
    this.passive.dataset.testid = 'passive-icon';
    this.passive.innerHTML = '<span class="pic"></span><span class="ptip" data-testid="passive-tip"></span>';
    this.passive.addEventListener('pointerdown', (e) => { e.preventDefault(); this.passive.classList.toggle('open'); });
    document.body.appendChild(this.passive);
    bus.on('cast', ({ hero }) => { if (hero === this.match.hero) { this.passive.classList.remove('ping'); void this.passive.offsetWidth; this.passive.classList.add('ping'); } });
    this.note = document.createElement('div');
    this.note.id = 'notarget';
    this.note.dataset.testid = 'no-target';
    document.body.appendChild(this.note);
    bus.on('rankUp', ({ hero, slot }) => {
      if (hero !== match.hero) return;
      const el = this.btns[slot].el;
      el.classList.remove('ranked'); void el.offsetWidth; el.classList.add('ranked');
    });
    bus.on('ultUnlock', (h) => { if (h === match.hero) this._slam(); });
    bus.on('noCast', ({ hero, slot, why }) => { // a skill press that did nothing always says why
      if (hero !== match.hero) return;
      const el = this.btns[slot].el;
      this.note.textContent = why === 'locked' ? `Unlocks at Lv ${HERO.ultLevel}` : 'No target';
      for (const [node, cls] of [[el, 'nope'], [this.note, 'pop']]) { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); }
    });
  }

  // Small buttons beside Attack: hold LAST-HIT (weakest minion) / TOWER (structures first) to attack just those; plus Recall (B).
  _extras() {
    const mk = (cls, testid, label, html, key) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = cls;
      el.dataset.testid = testid;
      el.setAttribute('aria-label', label);
      el.innerHTML = `${html}<u class="key">${key}</u>`;
      el.addEventListener('contextmenu', (e) => e.preventDefault());
      this.root.appendChild(el);
      return el;
    };
    this.tgts = [
      mk('tgt minion', 'target-minion', 'Attack minions', icons.target_minion, 'C'),
      mk('tgt tower', 'target-tower', 'Attack towers', icons.target_tower, 'V'),
    ];
    this.tgts.forEach((el, k) => {
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.setPointerCapture(e.pointerId); input.pref[k] = true; el.classList.add('down'); });
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(type, () => { input.pref[k] = false; el.classList.remove('down'); });
    });
    this.rc = mk('recall', 'recall', 'Recall to base', `<i class="face">${icons.recall}</i><i class="rprog"></i>`, 'B');
    this.rc.addEventListener('pointerdown', (e) => { e.preventDefault(); this.rc.setPointerCapture(e.pointerId); input.recall = true; this.rc.classList.add('down'); });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) this.rc.addEventListener(type, () => this.rc.classList.remove('down'));
    this.rp = -1;
    // Summoner spells: two buttons left of Recall (F / G on desktop), radial cooldown wipe like the skills.
    this.spb = [0, 1].map((k) => {
      const el = mk(`spell sp${k}`, `spell-${k + 1}`, `Summoner spell ${k + 1}`, '<i class="face"></i><i class="cd"></i><b class="num"></b>', 'FG'[k]);
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.setPointerCapture(e.pointerId); input.spell[k] = true; el.classList.add('down'); });
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(type, () => el.classList.remove('down'));
      return { el, face: el.querySelector('.face'), cd: el.querySelector('.cd'), num: el.querySelector('.num'), p: -1, n: -1, id: '' };
    });
    bus.on('noSpell', ({ hero, slot }) => {
      if (hero !== this.match.hero) return;
      this.note.textContent = 'No target';
      for (const [node, cls] of [[this.spb[slot].el, 'nope'], [this.note, 'pop']]) { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); }
    });
  }

  // Wild Rift style: press + drag aims (the match draws the ground preview), release casts, a tap quick-casts,
  // dragging back onto the button cancels. Live state is input.aiming; the cast leaves via input.cast / input.aimCast.
  _drag(el, i) {
    let id = null, ox = 0, oy = 0, st = null;
    const finish = (cast) => {
      el.classList.remove('down', 'aiming', 'cancel');
      document.body.classList.remove('aiming');
      if (id !== null && el.hasPointerCapture?.(id)) el.releasePointerCapture(id);
      id = null;
      if (input.aiming === st) input.aiming = null;
      if (!cast || !st) return;
      input.cast[i] = true;
      if (st.dragged) input.aimCast[i] = { sx: st.sx, sy: st.sy, frac: st.frac };
    };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (id !== null) return;
      const h = this.match.hero;
      if (!h.alive || h.ranks[i] === 0 || h.cds[i] > 0) { input.cast[i] = true; el.classList.add('down'); return; } // not ready: the usual "why not" note
      id = e.pointerId;
      el.setPointerCapture(id);
      ox = e.clientX; oy = e.clientY;
      st = input.aiming = { slot: i, sx: 0, sy: 0, frac: 0, dragged: false, cancel: false };
      el.classList.add('down', 'aiming');
      document.body.classList.add('aiming');
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id || !st) return;
      const dx = e.clientX - ox, dy = e.clientY - oy, len = Math.hypot(dx, dy);
      if (len > DRAG_START) st.dragged = true;
      if (!st.dragged) return;
      const r = el.getBoundingClientRect();
      st.cancel = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) < CANCEL_R;
      st.sx = dx / len; st.sy = -dy / len; // screen space, y up
      st.frac = Math.min(1, len / DRAG_FULL);
      el.classList.toggle('cancel', st.cancel);
    });
    el.addEventListener('pointerup', (e) => { if (e.pointerId === id) finish(!(st?.dragged && st.cancel)); });
    el.addEventListener('pointercancel', (e) => { if (e.pointerId === id) finish(false); });
    el.addEventListener('lostpointercapture', (e) => { if (e.pointerId === id) finish(false); });
    for (const type of ['pointerup', 'pointercancel']) el.addEventListener(type, () => { if (id === null) el.classList.remove('down'); });
  }

  setHero(hero) {
    this.root.style.setProperty('--c', hero.def.css);
    this.btns.forEach((b, i) => { b.face.innerHTML = skillArt(hero.ab[i].icon ?? hero.ab[i].kind, hero.ab[i], hero.def); b.el.title = `${SLOTS[i].key}: ${hero.ab[i].name}${hero.ab[i].tag ? ' (' + hero.ab[i].tag + ')' : ''}`; b.p = b.n = -1; });
    const ps = hero.passive;
    this.passive.hidden = !ps;
    this.passive.classList.remove('open');
    if (ps) {
      this.passive.querySelector('.pic').innerHTML = passiveArt(ps, hero.def);
      this.passive.querySelector('.ptip').innerHTML = `<b>${ps.name}</b><small>PASSIVE</small><em>${ps.tag}</em>`;
      this.passive.setAttribute('aria-label', `Passive: ${ps.name}. ${ps.tag}`);
    }
    this.spb.forEach((b, k) => { b.id = ''; b.p = b.n = -1; });
  }

  _slam() {
    const el = this.btns[3].el;
    el.classList.remove('slam');
    void el.offsetWidth;
    el.classList.add('slam');
  }

  update() {
    const h = this.match.hero;
    const rp = h.recall > 0 ? Math.round((h.recall / RECALL_T) * 100) : 0;
    if (rp !== this.rp) { this.rp = rp; this.rc.style.setProperty('--p', rp); this.rc.classList.toggle('on', rp > 0); }
    this.rc.classList.toggle('dead', !h.alive);
    this.spb.forEach((b, k) => {
      const id = h.spells[k], left = Math.max(0, h.spellCd[k]);
      if (b.id !== id) { b.id = id; b.face.innerHTML = icons[`spell_${id}`]; b.el.style.setProperty('--sc', '#' + SPELLS[id].color.toString(16).padStart(6, '0')); b.el.setAttribute('aria-label', SPELLS[id].name); b.el.dataset.spell = id; }
      const p = left > 0 ? Math.round((left / (h.spellCdTotal[k] || 1)) * 1000) / 10 : 0;
      if (p !== b.p) { b.cd.style.setProperty('--p', p); b.p = p; }
      const n = left > 0 ? Math.ceil(left) : '';
      if (n !== b.n) { b.num.textContent = n; b.n = n; }
      b.el.classList.toggle('ready', left <= 0);
      b.el.classList.toggle('dead', !h.alive);
    });
    this.btns.forEach((b, i) => {
      const locked = h.ranks[i] === 0;
      const left = locked ? 0 : Math.max(0, h.cds[i]);
      const p = left > 0 ? Math.round((left / (h.cdTotal[i] || 1)) * 1000) / 10 : 0;
      if (p !== b.p) { b.cd.style.setProperty('--p', p); b.p = p; }
      const n = locked ? `Lv${HERO.ultLevel}` : left <= 0 ? '' : left < 1 ? left.toFixed(1) : Math.ceil(left); // v10: full countdown, not just the last 3 s
      if (n !== b.n) { b.num.textContent = n; b.n = n; }
      b.el.classList.toggle('locked', locked);
      b.el.classList.toggle('dead', !h.alive);
      this.ups[i].hidden = !h.canSpend(i);
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
