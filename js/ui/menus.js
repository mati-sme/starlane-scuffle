// Title, champion select, pause and results screens (DOM overlays).
import { icons } from './icons.js';
import { audio } from '../audio.js';
import { PAL } from '../config.js';
import { HEROES, ROSTER } from '../heroes/index.js';

const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const upper = (s) => s.toUpperCase();

const maxHp = Math.max(...ROSTER.map((id) => HEROES[id].stats.hp));
const maxSpeed = Math.max(...ROSTER.map((id) => HEROES[id].stats.speed));
const maxRange = Math.max(...ROSTER.map((id) => HEROES[id].basic.range));

const bar = (label, v) => `<div class="stat"><span>${label}</span><i><b style="width:${Math.round(v * 100)}%"></b></i></div>`;

// Basic + Q / E / R rows of the detail strip.
function skillRows(def) {
  const row = (key, ab, icon, test) =>
    `<li data-testid="${test}"><span class="si">${icon}</span><span class="sk-key">${key}</span><span class="sk-name">${ab.name}</span><small>${ab.tag ?? ab.kind}</small></li>`;
  return row('', def.basic, icons[`basic_${def.basic.kind}`], 'detail-basic')
    + row('Q', def.s1, icons[def.s1.kind], 'detail-q')
    + row('E', def.s2, icons[def.s2.kind], 'detail-e')
    + row('R', def.ult, icons[def.ult.kind], 'detail-r');
}

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
      const row = ROSTER.map((id, i) => `<i style="--i:${i}">${icons.champ(HEROES[id])}</i>`).join('');
      show('title modal', `
        <div class="kicker">TEAM ARENA · 2 v 2</div>
        <h1><span>Starlane</span><span>Scuffle</span></h1>
        <div class="parade">${row}</div>
        <button class="btn primary play" type="button" data-testid="play-btn">PLAY</button>
        <p class="hint"><span class="mouse">WASD move · Space attack · Q E R skills · 1 2 3 or Ctrl+Q/E/R rank up</span><span class="touchhint">Left thumb move · Right thumb attack · tap the gold + above a skill to level it</span></p>`,
      (el) => on(el, '.play', onPlay));
    },

    // All 12 champions are always selectable.
    showSelect({ picked, onPlay, onHome }) {
      let sel = ROSTER.includes(picked) ? picked : ROSTER[0];
      const cards = ROSTER.map((id) => {
        const def = HEROES[id];
        return `<button type="button" class="hcard" data-id="${id}" data-testid="champion-card-${id}" aria-pressed="false" style="--c:${def.css}">
          <span class="pic">${icons.champ(def)}</span><b>${def.name}</b>
          <span class="role"><i>${icons.role(def.role)}</i>${upper(def.role)}</span></button>`;
      }).join('');
      show('select modal', `
        <button class="small home" type="button" aria-label="Back" data-testid="select-back">${icons.home}</button>
        <h2 class="sel-title">Choose your champion</h2>
        <div class="selwrap">
          <div class="grid" data-testid="champion-grid">${cards}</div>
          <aside class="detail" data-testid="champion-detail"></aside>
        </div>`,
      (el) => {
        const list = [...el.querySelectorAll('.hcard')], detail = el.querySelector('.detail');
        const fill = () => {
          const def = HEROES[sel];
          el.style.setProperty('--sel', def.css);
          detail.innerHTML = `
            <div class="dhead"><i class="dport">${icons.champ(def)}</i>
              <div><h3 data-testid="detail-name">${def.name}</h3><p class="dtitle" data-testid="detail-title">${def.title}</p>
              <span class="drole" data-testid="detail-role">${upper(def.role)}</span></div></div>
            <div class="stats">${bar('HP', def.stats.hp / maxHp)}${bar('SPD', def.stats.speed / maxSpeed)}${bar('RNG', def.basic.range / maxRange)}</div>
            <ul class="skills">${skillRows(def)}</ul>
            <button class="btn primary go" type="button" data-testid="go-btn">GO</button>`;
          on(detail, '.go', () => onPlay(sel));
        };
        const mark = () => list.forEach((c) => {
          const on = c.dataset.id === sel;
          c.classList.toggle('sel', on);
          c.setAttribute('aria-pressed', String(on));
        });
        mark(); fill();
        for (const c of list) {
          c.addEventListener('click', () => {
            sel = c.dataset.id;
            mark(); fill();
            c.classList.remove('jump');
            void c.offsetWidth;
            c.classList.add('jump');
            audio.sfx('skill', { def: HEROES[sel], isPlayer: true });
          });
        }
        on(el, '.home', onHome);
      });
    },

    showPause({ onResume, onHome }) {
      show('pause modal', `
        <h2>Paused</h2>
        <div class="row"><button class="btn primary resume" type="button" data-testid="resume-btn">RESUME</button>
        <button class="btn home" type="button" data-testid="pause-home">CHAMPIONS</button></div>`,
      (el) => { on(el, '.resume', onResume); on(el, '.home', onHome); });
    },

    showResult({ win, stars, time, reason }, { onAgain, onHome }) {
      const row = [0, 1, 2].map((i) => `<i class="${i < stars ? 'on' : ''}" style="--i:${i}">${icons.star(i < stars ? hex(PAL.gold) : '#2B3550')}</i>`).join('');
      const btns = `<div class="row"><button class="btn primary again" type="button" data-testid="again-btn">PLAY AGAIN</button><button class="btn home" type="button" data-testid="champions-btn">CHAMPIONS</button></div>`;
      show(win ? 'result win modal' : 'result lose modal', `
        <h2 data-testid="result-title">${win ? 'Victory' : 'Defeat'}</h2>
        <p class="reason">${reason} · ${mmss(time)}</p>
        ${win ? `<div class="stars">${row}</div>` : ''}${btns}`,
      (el) => { on(el, '.again', onAgain); on(el, '.home', onHome); });
    },
  };
}
