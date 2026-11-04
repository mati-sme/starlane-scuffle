// Title, hero select, pause and results screens (DOM overlays).
import { icons } from './icons.js';
import { audio } from '../audio.js';
import { PAL } from '../config.js';
import { HEROES, ROSTER } from '../heroes/index.js';

const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const cap = (s) => s[0].toUpperCase() + s.slice(1);

export function createMenus(root) {
  const show = (cls, html, wire) => {
    root.innerHTML = `<div class="screen ${cls}">${html}</div>`;
    wire(root.firstElementChild);
  };
  const on = (el, sel, fn) => el.querySelector(sel).addEventListener('click', fn);
  root.addEventListener('click', (e) => { if (e.target.closest('button')) audio.sfx('click'); });

  return {
    hideAll() { root.innerHTML = ''; },

    showTitle(onPlay) {
      const row = ROSTER.map((id, i) => `<i style="--i:${i}">${icons[HEROES[id].portrait]}</i>`).join('');
      show('title modal', `
        <h1><span>Starlane</span><span>Scuffle</span></h1>
        <div class="parade">${row}</div>
        <button class="big play" type="button" aria-label="Play">${icons.play}</button>
        <p class="hint"><span class="mouse">WASD move · Space attack</span><span class="touchhint">Left thumb move · Right thumb attack</span></p>`,
      (el) => on(el, '.play', onPlay));
    },

    // unlocked: how many heroes (in ROSTER order) the player owns.
    showSelect({ unlocked, picked, onPlay, onHome }) {
      let sel = ROSTER.indexOf(picked) < unlocked ? picked : ROSTER[0];
      const cards = ROSTER.map((id, i) => {
        const def = HEROES[id], locked = i >= unlocked, ab = ['s1', 's2', 'ult'];
        return `<button type="button" class="hcard${locked ? ' locked' : ''}" data-id="${id}" style="--c:${def.color}">
          <span class="pic">${icons[def.portrait]}</span><b>${cap(id)}</b>
          <span class="abs">${ab.map((k) => `<i>${icons[def.abilities[k].icon]}</i>`).join('')}</span>
          ${locked ? `<span class="lock">${icons.lock}</span>` : ''}</button>`;
      }).join('');
      show('select modal', `
        <button class="small home" type="button" aria-label="Back">${icons.home}</button>
        <div class="cards">${cards}</div>
        <button class="big go" type="button" aria-label="Go">${icons.check}</button>
        ${unlocked < ROSTER.length ? `<p class="hint">${icons.lock}<span>Win to unlock!</span></p>` : ''}`,
      (el) => {
        const list = [...el.querySelectorAll('.hcard')];
        const mark = () => list.forEach((c) => c.classList.toggle('sel', c.dataset.id === sel));
        mark();
        for (const c of list) {
          c.addEventListener('click', () => {
            if (c.classList.contains('locked')) { c.classList.remove('nope'); void c.offsetWidth; c.classList.add('nope'); return; }
            sel = c.dataset.id;
            mark();
            c.classList.remove('jump');
            void c.offsetWidth;
            c.classList.add('jump');
            audio.sfx('skill', { def: HEROES[sel], isPlayer: true });
          });
        }
        on(el, '.go', () => onPlay(sel));
        on(el, '.home', onHome);
      });
    },

    showPause({ onResume, onHome }) {
      show('pause modal', `
        <button class="big resume" type="button" aria-label="Resume">${icons.play}</button>
        <button class="small home" type="button" aria-label="Home">${icons.home}</button>`,
      (el) => { on(el, '.resume', onResume); on(el, '.home', onHome); });
    },

    // unlock: hero id earned by this win (or null).
    showResult({ win, stars }, { unlock, onAgain, onHome }) {
      const row = [0, 1, 2].map((i) => `<i class="${i < stars ? 'on' : ''}" style="--i:${i}">${icons.star(i < stars ? hex(PAL.gold) : '#5B3F8C')}</i>`).join('');
      const gift = unlock ? `<div class="gift" style="--c:${HEROES[unlock].color}">${icons[HEROES[unlock].portrait]}</div>` : '';
      const btns = `<div class="row"><button class="big again" type="button" aria-label="Play again">${icons.retry}</button><button class="small home" type="button" aria-label="Heroes">${icons.home}</button></div>`;
      show(win ? 'result win modal' : 'result lose modal', win
        ? `<h2>Victory!</h2><div class="stars">${row}</div>${gift}${btns}`
        : `<div class="smile">${icons.smile}</div><h2>Good try!</h2>${btns}`,
      (el) => { on(el, '.again', onAgain); on(el, '.home', onHome); });
    },
  };
}
