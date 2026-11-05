// Title, champion select, pause and results screens (DOM overlays).
import { icons } from './icons.js';
import { audio } from '../audio.js';
import { PAL } from '../config.js';
import { HEROES, ROSTER } from '../heroes/index.js';
import { TEAM_NAME } from '../net/protocol.js';

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

    showTitle(onPlay, onOnline) {
      const row = ROSTER.map((id, i) => `<i style="--i:${i}">${icons.champ(HEROES[id])}</i>`).join('');
      show('title modal', `
        <div class="kicker">TEAM ARENA · 5 v 5</div>
        <h1><span>Starlane</span><span>Scuffle</span></h1>
        <div class="parade">${row}</div>
        <div class="row"><button class="btn primary play" type="button" data-testid="play-btn">PLAY</button>
        <button class="btn online" type="button" data-testid="online-btn">PLAY ONLINE</button></div>
        <p class="hint"><span class="mouse">WASD move · Space attack · Q E R skills · 1 2 3 or Ctrl+Q/E/R rank up</span><span class="touchhint">Left thumb move · Right thumb attack · tap the gold + above a skill to level it</span></p>`,
      (el) => { on(el, '.play', onPlay); on(el, '.online', onOnline); });
    },

    // All 24 champions are always selectable.
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

    // Online entry: create a room or join with a 4-character code.
    showOnline({ code = '', error = '', busy = false, onCreate, onJoin, onBack }) {
      show('online modal', `
        <button class="small home" type="button" aria-label="Back" data-testid="online-back">${icons.home}</button>
        <h2>Play online</h2>
        <button class="btn primary create" type="button" data-testid="create-room" ${busy ? 'disabled' : ''}>CREATE ROOM</button>
        <p class="hint">or join a friend</p>
        <div class="row"><input class="code" type="text" inputmode="text" autocapitalize="characters" autocomplete="off" spellcheck="false" maxlength="4" placeholder="CODE" value="${code}" data-testid="code-input" aria-label="Room code">
        <button class="btn join" type="button" data-testid="join-room" ${busy ? 'disabled' : ''}>JOIN</button></div>
        <p class="neterr" data-testid="online-error">${error}</p>`,
      (el) => {
        const input = el.querySelector('.code');
        input.addEventListener('input', () => { input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') el.querySelector('.join').click(); });
        on(el, '.create', onCreate);
        on(el, '.join', () => onJoin(input.value));
        on(el, '.home', onBack);
      });
    },

    // Room lobby: code + link, both players' team / champion, host Start. Re-rendered on every lobby update.
    showLobby({ code, link, me, players, phase, conn, error }, { onTeam, onHero, onStart, onCopy, onLeave }) {
      const mine = players.find((p) => p.slot === me), other = players.find((p) => p.slot !== me);
      const isHost = me === 0, two = players.length === 2;
      const versus = two && players[0].team !== players[1].team;
      const mode = !two ? 'Practice: you + bots' : versus ? 'Versus: you play against each other' : 'Co-op: same team vs bots';
      const taken = other && other.team === mine?.team ? other.hero : null;
      const row = (p) => `<li class="pl t${p.team} ${p.connected ? '' : 'off'}" data-testid="player-${p.slot}"><i class="dot"></i><b>${p.name}${p.slot === me ? ' (you)' : ''}</b>
        <span class="tm">${TEAM_NAME[p.team]}</span><span class="ch">${p.hero ? `<i>${icons.champ(HEROES[p.hero])}</i>${HEROES[p.hero].name}` : '…'}</span></li>`;
      const cards = ROSTER.map((id) => `<button type="button" class="hcard mini ${mine?.hero === id ? 'sel' : ''}" data-id="${id}" data-testid="lobby-champ-${id}" style="--c:${HEROES[id].css}" ${taken === id ? 'disabled' : ''}>
        <span class="pic">${icons.champ(HEROES[id])}</span><b>${HEROES[id].name}</b></button>`).join('');
      const canStart = isHost && phase === 'lobby' && two && players.every((p) => p.connected && p.hero);
      show('lobby modal', `
        <button class="small home" type="button" aria-label="Leave" data-testid="lobby-back">${icons.home}</button>
        <div class="roomcode"><span>Room code</span><b data-testid="room-code">${code}</b>
          <button class="btn copy" type="button" data-testid="copy-link">COPY LINK</button></div>
        <p class="sharelink" data-testid="share-link">${link}</p>
        <ul class="players">${players.map(row).join('')}${two ? '' : '<li class="pl wait"><i class="dot"></i><b>Waiting for a friend…</b></li>'}</ul>
        <div class="teampick"><button type="button" class="tbtn t0 ${mine?.team === 0 ? 'on' : ''}" data-team="0" data-testid="team-sunny">SUNNY</button>
          <button type="button" class="tbtn t1 ${mine?.team === 1 ? 'on' : ''}" data-team="1" data-testid="team-gloom">GLOOM</button></div>
        <div class="grid lobbygrid">${cards}</div>
        <p class="hint" data-testid="lobby-mode">${phase === 'play' ? 'Match in progress…' : mode}</p>
        <p class="neterr" data-testid="lobby-error">${conn !== 'open' ? 'Reconnecting…' : error ?? ''}</p>
        <div class="row">${isHost ? `<button class="btn primary start" type="button" data-testid="start-btn" ${canStart || (phase === 'lobby' && !two && mine?.hero) ? '' : 'disabled'}>${two ? 'START' : 'PRACTICE'}</button>` : '<span class="hint">Waiting for the host to start…</span>'}</div>`,
      (el) => {
        for (const b of el.querySelectorAll('.tbtn')) b.addEventListener('click', () => onTeam(+b.dataset.team));
        for (const b of el.querySelectorAll('.hcard')) b.addEventListener('click', () => onHero(b.dataset.id));
        el.querySelector('.copy').addEventListener('click', () => onCopy(el.querySelector('.copy')));
        el.querySelector('.home').addEventListener('click', onLeave);
        el.querySelector('.start')?.addEventListener('click', () => onStart(!two));
      });
    },

    // Small status strip over the match ("Reconnecting…", "Waiting for host…").
    netBanner(text) {
      let el = document.getElementById('netbanner');
      if (!el) { el = document.createElement('div'); el.id = 'netbanner'; el.setAttribute('data-testid', 'net-banner'); document.body.appendChild(el); }
      el.textContent = text;
      el.hidden = !text;
    },

    showPause({ onResume, onHome, online = false }) {
      show('pause modal', `
        <h2>${online ? 'Menu' : 'Paused'}</h2>
        <div class="row"><button class="btn primary resume" type="button" data-testid="resume-btn">RESUME</button>
        <button class="btn home" type="button" data-testid="pause-home">${online ? 'LEAVE' : 'CHAMPIONS'}</button></div>`,
      (el) => { on(el, '.resume', onResume); on(el, '.home', onHome); });
    },

    showResult({ win, stars, time, reason }, { onAgain, onHome, againLabel = 'PLAY AGAIN', homeLabel = 'CHAMPIONS' }) {
      const row = [0, 1, 2].map((i) => `<i class="${i < stars ? 'on' : ''}" style="--i:${i}">${icons.star(i < stars ? hex(PAL.gold) : '#2B3550')}</i>`).join('');
      const btns = `<div class="row"><button class="btn primary again" type="button" data-testid="again-btn">${againLabel}</button><button class="btn home" type="button" data-testid="champions-btn">${homeLabel}</button></div>`;
      show(win ? 'result win modal' : 'result lose modal', `
        <h2 data-testid="result-title">${win ? 'Victory' : 'Defeat'}</h2>
        <p class="reason">${reason} · ${mmss(time)}</p>
        ${win ? `<div class="stars">${row}</div>` : ''}${btns}`,
      (el) => { on(el, '.again', onAgain); on(el, '.home', onHome); });
    },
  };
}
