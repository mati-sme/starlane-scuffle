// Title and results screens (DOM overlays).
import { icons } from './icons.js';
import { PAL } from '../config.js';

const hex = (n) => '#' + n.toString(16).padStart(6, '0');

export function createMenus(root) {
  let current = null;
  const show = (cls, html, wire) => {
    root.innerHTML = `<div class="screen ${cls}">${html}</div>`;
    current = root.firstElementChild;
    wire(current);
  };

  return {
    hideAll() { root.innerHTML = ''; current = null; },

    showTitle(onPlay) {
      show('title', `
        <h1>Starlane<br>Scuffle</h1>
        <button class="big play" type="button" aria-label="Play">${icons.play}</button>
        <p class="hint"><span class="mouse">WASD move · Space attack</span><span class="touchhint">Left thumb move · Right thumb attack</span></p>`,
      (el) => el.querySelector('.play').addEventListener('click', onPlay));
    },

    showResult({ win, stars }, onAgain) {
      const row = [0, 1, 2].map((i) => `<i class="${i < stars ? 'on' : ''}" style="--i:${i}">${icons.star(i < stars ? hex(PAL.gold) : '#5B3F8C')}</i>`).join('');
      show(win ? 'result win' : 'result lose', win
        ? `<h2>Victory!</h2><div class="stars">${row}</div><button class="big again" type="button" aria-label="Play again">${icons.retry}</button>`
        : `<div class="smile">${icons.smile}</div><h2>Good try!</h2><button class="big again" type="button" aria-label="Try again">${icons.retry}</button>`,
      (el) => el.querySelector('.again').addEventListener('click', onAgain));
    },
  };
}
