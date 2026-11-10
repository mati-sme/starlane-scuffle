// Title, champion select, pause and results screens (DOM overlays).
import { icons } from './icons.js';
import { audio } from '../audio.js';
import { PAL } from '../config.js';
import { HEROES, ROSTER } from '../heroes/index.js';
import { TEAM_NAME } from '../net/protocol.js';
import { SPELLS, SPELL_IDS } from '../game/spells.js';
import { factionDef } from '../game/factions.js';
import { ROLE_BLURB } from '../game/roles.js';
import { matchupsOf } from '../game/matchups.js';
import { LEVELS, MAX_TEAM, applyPreset, presetOf, summary } from '../game/setup.js';
import { PALETTES, SKIN_IDS, SKIN_PRICE, equipped, ownsSkin, equip, buySkin, portraitShift } from '../game/skins.js';
import { BADGES, isEarned, evaluate as checkBadges } from '../game/badges.js';
import { view as questView } from '../game/quests.js';
import { profile, isOwned, nextPrice, buyChampion, xpNeeded } from '../game/progress.js';

const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const upper = (s) => s.toUpperCase();
// Rendered bust of the champion's model (scripts/make-portraits.mjs).
const skinFilter = (id) => { const k = equipped(id); return k === 'default' ? '' : ` style="filter:hue-rotate(${portraitShift(HEROES[id], k)}deg) saturate(1.15)"`; };
const portrait = (id) => `<img src="assets/portraits/${id}.png" alt="" draggable="false" decoding="async"${skinFilter(id)}>`;

// Mini portrait for matchup rows; a missing image (champions from unmerged branches) leaves the coloured disc.
const mini = (id) => `<i class="mp" title="${HEROES[id].name}" style="--c:${HEROES[id].css}"><img src="assets/portraits/${id}.png" alt="${HEROES[id].name}" draggable="false" loading="lazy" onerror="this.remove()"></i>`;
const chip = (id) => { const f = factionDef(id); return `<span class="fchip" style="--f:${f.color}"><s>${f.icon}</s>${f.name}</span>`; };
const matchRows = (id) => {
  const m = matchupsOf(id);
  const row = (cls, label, ids) => `<div class="mrow ${cls}" data-testid="matchup-${cls}"><span>${label}</span><div>${ids.map(mini).join('')}</div></div>`;
  return `<div class="matchups">${row('strong', 'Strong vs', m.strong)}${row('weak', 'Weak vs', m.weak)}</div>`;
};

const maxHp = Math.max(...ROSTER.map((id) => HEROES[id].stats.hp));
const maxSpeed = Math.max(...ROSTER.map((id) => HEROES[id].stats.speed));
const maxRange = Math.max(...ROSTER.map((id) => HEROES[id].basic.range));
const dps = (def) => def.basic.dmg / def.basic.cd; // basic-attack damage per second, straight from the kit
const maxDps = Math.max(...ROSTER.map((id) => dps(HEROES[id])));
const medHp = [...ROSTER.map((id) => HEROES[id].stats.hp)].sort((a, b) => a - b)[ROSTER.length >> 1];
// No difficulty field in the hero defs: a 1-3 read from role, bumped for squishy long-range kits. Display only.
const DIFF_BASE = { tank: 1, bruiser: 1, support: 2, shooter: 2, blaster: 2, assassin: 3 };
const difficulty = (def) => Math.min(3, (DIFF_BASE[def.role] ?? 2) + (def.basic.range >= 6 && def.stats.hp <= medHp ? 1 : 0));
const DIFF_NAME = ['', 'Easy', 'Mid', 'Hard'];

// Coins + level strip (title / select). Re-read from the profile every time it is drawn.
const LOCK = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M7 10V8a5 5 0 0 1 10 0v2h1.5A1.5 1.5 0 0 1 20 11.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 20.5v-9A1.5 1.5 0 0 1 5.5 10zm2.5 0h5V8a2.5 2.5 0 0 0-5 0z"/></svg>';
const COIN = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#FFC83D" stroke="#7a5200" stroke-width="2"/><circle cx="12" cy="12" r="5.5" fill="none" stroke="#C98F00" stroke-width="2"/></svg>';
const wallet = () => { const p = profile(); return `<span class="lvl-pill" data-testid="player-level">LV ${p.level}</span><span class="coins" data-testid="player-coins">${COIN}<b>${p.coins}</b></span>`; };
const lockBadge = () => `<span class="lockbadge" data-testid="lock-badge">${LOCK}<b>${nextPrice()}</b>${COIN}</span>`;

// Colour chooser: the default (free) + 3 palettes. Owned ones equip; the others cost SKIN_PRICE coins.
const skinRow = (id) => `<div class="skins" data-testid="skin-row"><span>Colors</span>${['default', ...SKIN_IDS].map((k) => {
  const own = ownsSkin(id, k), on = equipped(id) === k, price = !own && profile().coins < SKIN_PRICE;
  return `<button type="button" class="skinchip ${on ? 'on' : ''} ${own ? '' : 'buyable'}" data-skin="${k}" data-testid="skin-${k}" aria-pressed="${on}" ${price ? 'disabled' : ''} style="--sw:${PALETTES[k]?.swatch ?? '#9AA3B8'}"><i></i><small>${k === 'default' ? 'Classic' : PALETTES[k].name}</small>${own ? '' : `<em>${SKIN_PRICE}${COIN}</em>`}</button>`;
}).join('')}</div>`;

const HELP = 'First ban one champion you don\'t want anyone to play, then pick yours.';
// Greyed, stamped card state: 'banned' (nobody can play it) or 'taken' (someone already picked it).
const stamp = (kind) => (kind === 'banned' ? 'BANNED' : kind === 'taken' ? 'TAKEN' : '');

const bar = (label, v, text = '') => `<div class="stat"><span>${label}</span><i><b style="width:${Math.round(v * 100)}%"></b></i>${text ? `<em>${text}</em>` : ''}</div>`;
const statBars = (def) => { const d = difficulty(def); return `<div class="stats" data-testid="detail-stats">${bar('HP', def.stats.hp / maxHp)}${bar('DMG', dps(def) / maxDps)}${bar('RNG', def.basic.range / maxRange)}${bar('SPD', def.stats.speed / maxSpeed)}${bar('HARD', d / 3, DIFF_NAME[d])}</div>`; };

// Basic + Q / E / R rows of the detail strip.
function skillRows(def) {
  const row = (key, ab, icon, test) =>
    `<li data-testid="${test}"><span class="si">${icon}</span><span class="sk-key">${key}</span><span class="sk-name">${ab.name}</span><small>${ab.tag ?? ab.kind}</small></li>`;
  return row('', def.basic, icons[`basic_${def.basic.kind}`], 'detail-basic')
    + row('Q', def.s1, icons[def.s1.kind], 'detail-q')
    + row('E', def.s2, icons[def.s2.kind], 'detail-e')
    + row('R', def.ult, icons[def.ult.kind], 'detail-r');
}

// The champion detail pane (name, faction, class + blurb, role, passive, matchups, stat bars, skills). Shared by the offline draft and the online lobby.
function detailBody(id) {
  const def = HEROES[id];
  return `
    <div class="dhead"><i class="dport">${portrait(id)}</i>
      <div><h3 data-testid="detail-name">${def.name}</h3><p class="dtitle" data-testid="detail-title">${def.title}</p>
      <span class="drole" data-testid="detail-role">${upper(def.role)}</span> <span data-testid="detail-faction">${chip(id)}</span></div></div>
    ${statBars(def)}
    <p class="dnote" data-testid="detail-role-blurb"><b>${def.role[0].toUpperCase() + def.role.slice(1)}</b> — ${ROLE_BLURB[def.role] ?? ''}</p>
    <ul class="skills">${skillRows(def)}</ul>
    <p class="dnote" data-testid="detail-passive"><b>${factionDef(id).passive}</b> — ${factionDef(id).blurb}</p>
    ${matchRows(id)}`;
}

// Summoner-spell chooser: 3 chips, exactly 2 are on (tapping a third swaps out the older pick). The numbers show which button each lands on.
const css = (c) => '#' + c.toString(16).padStart(6, '0');
const spellPick = (spells) => `<div class="spellpick" data-testid="spell-pick"><span>Spells · pick 2</span>${SPELL_IDS.map((id) => {
  const n = spells.indexOf(id) + 1;
  return `<button type="button" class="spchip ${n ? 'on' : ''}" data-spell="${id}" data-n="${n || ''}" data-testid="spell-chip-${id}" aria-pressed="${!!n}" style="--sc:${css(SPELLS[id].color)}"><i>${icons[`spell_${id}`]}</i><span><b>${SPELLS[id].name}</b><small>${SPELLS[id].blurb}</small></span></button>`;
}).join('')}</div>`;
function wireSpells(el, spells, onChange) {
  const paint = () => el.querySelectorAll('.spchip').forEach((c) => {
    const n = spells.indexOf(c.dataset.spell) + 1;
    c.classList.toggle('on', !!n); c.dataset.n = n || ''; c.setAttribute('aria-pressed', String(!!n));
  });
  el.querySelectorAll('.spchip').forEach((c) => c.addEventListener('click', () => {
    const id = c.dataset.spell;
    if (spells.includes(id)) return; // always two on: tap another one to swap
    spells.shift(); spells.push(id);
    paint(); onChange([...spells]);
  }));
}

export function createMenus(root) {
  let tick = 0;
  const show = (cls, html, wire) => {
    clearInterval(tick);
    root.innerHTML = `<div class="screen ${cls}">${html}</div>`;
    wire(root.firstElementChild);
  };
  // Counts the .timer element down to `deadline` (performance.now() ms), then calls onEnd once.
  const countdown = (el, deadline, onEnd) => {
    const timer = el.querySelector('.timer');
    if (!timer || !deadline) return;
    const update = () => {
      const left = Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
      timer.textContent = `${left}s`;
      timer.classList.toggle('low', left <= 5);
      if (left <= 0) { clearInterval(tick); onEnd?.(); }
    };
    update();
    tick = setInterval(update, 250);
  };
  const on = (el, sel, fn) => el.querySelector(sel).addEventListener('click', fn);
  root.addEventListener('click', (e) => { if (e.target.closest('button')) audio.sfx('click'); });

  return {
    hideAll() { clearInterval(tick); root.innerHTML = ''; },

    showTitle(onPlay, onOnline, onProfile, onCoop, onTutorial) {
      const row = ROSTER.map((id, i) => `<i style="--i:${i};--c:${HEROES[id].css}">${portrait(id)}</i>`).join('');
      show('title modal', `
        <div class="kicker">TEAM ARENA · 5 v 5</div>
        <h1><span>Starlane</span><span>Scuffle</span></h1>
        <div class="parade">${row}</div>
        <div class="wallet" data-testid="title-wallet">${wallet()}<button class="small profbtn" type="button" data-testid="profile-btn">PROFILE</button><button class="small profbtn" type="button" data-testid="tutorial-start">HOW TO PLAY</button></div>
        <div class="quests" data-testid="quests-panel"><b>TODAY'S QUESTS</b>${questView().map((q) => `<span class="quest ${q.done ? 'done' : ''}" data-testid="quest-${q.id}"><i>${q.done ? '✓' : ''}</i>${q.text}<em>${q.done ? 'DONE' : `${q.prog}/${q.goal}`}</em><small>+${q.coins}</small>${COIN}</span>`).join('')}</div>
        <div class="row"><button class="btn primary play" type="button" data-testid="play-btn">PLAY</button>
        <button class="btn coop" type="button" data-testid="coop-btn">2v2 CO-OP</button>
        <button class="btn online" type="button" data-testid="online-btn">PLAY ONLINE</button></div>
        <p class="hint"><span class="mouse">WASD move · Space attack · Q E R skills · 1 2 3 or Ctrl+Q/E/R rank up</span><span class="touchhint">Left thumb move · Right thumb attack · tap the gold + above a skill to level it</span></p>`,
      (el) => { on(el, '.play', onPlay); on(el, '.online', onOnline); on(el, '.coop', () => onCoop?.()); el.querySelector('[data-testid="profile-btn"]').addEventListener('click', () => onProfile?.()); el.querySelector('[data-testid="tutorial-start"]').addEventListener('click', () => onTutorial?.()); });
    },


    // Profile: level + XP bar, coins, totals, champions unlocked and the badge wall.
    showProfile(onBack) {
      checkBadges(); // catch up on anything earned before this version
      const p = profile(), need = xpNeeded(p.level), owned = ROSTER.filter(isOwned).length;
      const stat = (k, v, t) => `<li data-testid="${t}"><b>${v}</b><span>${k}</span></li>`;
      const wall = BADGES.map((b) => { const on = isEarned(b.id); return `<li class="badge ${on ? 'on' : ''}" data-testid="badge-${b.id}" data-earned="${on}"><i>${on ? b.icon : '?'}</i><b>${b.name}</b><small>${b.hint}</small></li>`; }).join('');
      show('profile modal', `
        <button class="small home" type="button" aria-label="Back" data-testid="profile-back">${icons.home}</button>
        <h2>Profile</h2>
        <div class="proftop"><span class="lvl-pill big" data-testid="profile-level">LV ${p.level}</span>
          <div class="xpbar" data-testid="profile-xp"><i style="width:${Math.round((p.xp / need) * 100)}%"></i><em>${p.xp} / ${need} XP</em></div>
          <span class="coins big" data-testid="profile-coins">${COIN}<b>${p.coins}</b></span></div>
        <ul class="pstats">${stat('Matches', p.matches, 'stat-matches')}${stat('Wins', p.wins, 'stat-wins')}${stat('KOs', p.kills, 'stat-kos')}${stat('Champions', `${owned}/${ROSTER.length}`, 'stat-champs')}</ul>
        <ul class="badges" data-testid="badge-wall">${wall}</ul>`,
      (el) => { el.dataset.testid = 'profile-root'; on(el, '.home', onBack); });
    },

    // Match setup: a preset for every bot, team sizes (1-5), your side, and a level per bot. `setup` is edited in place (see game/setup.js).
    // online: no "your side" chooser (players pick teams in the lobby). readOnly: just the summary and slots (guests).
    showSetup({ setup, online = false, readOnly = false, nextLabel = 'NEXT', onChange, onNext, onBack }) {
      const cap = (l) => l[0].toUpperCase() + l.slice(1);
      const body = () => {
        const preset = presetOf(setup);
        const col = (t) => {
          const slots = Array.from({ length: setup.size[t] }, (_, i) => {
            const you = !online && t === setup.side && i === 0;
            const lv = you ? '<span class="you">YOU</span>' : LEVELS.map((l) => `<button type="button" class="lvl ${l} ${setup.diff[t][i] === l ? 'on' : ''}" data-t="${t}" data-i="${i}" data-l="${l}" data-testid="slot-${t}-${i}-${l}" aria-pressed="${setup.diff[t][i] === l}" ${readOnly ? 'disabled' : ''}>${cap(l)}</button>`).join('');
            return `<li class="slot ${you ? 'me' : ''}" data-testid="slot-${t}-${i}"><b>${you ? 'You' : online ? 'Bot' : 'Bot ' + (i + (t === setup.side ? 0 : 1))}</b>${lv}</li>`;
          }).join('');
          return `<div class="sidecol t${t}"><div class="sidehead"><b>${TEAM_NAME[t].toUpperCase()}</b>
            <button type="button" class="small size" data-t="${t}" data-d="-1" data-testid="size-minus-${t}" aria-label="Fewer on ${TEAM_NAME[t]}" ${readOnly || setup.size[t] <= 1 ? 'disabled' : ''}>−</button>
            <span class="count" data-testid="size-count-${t}">${setup.size[t]}</span>
            <button type="button" class="small size" data-t="${t}" data-d="1" data-testid="size-plus-${t}" aria-label="More on ${TEAM_NAME[t]}" ${readOnly || setup.size[t] >= MAX_TEAM ? 'disabled' : ''}>+</button></div>
            <ul class="slots">${slots}</ul></div>`;
        };
        return `
          <h2 data-testid="setup-title">Match setup</h2>
          <p class="hint">${readOnly ? 'The host picked this match. ' : ''}Easy is gentle, Mid is classic, Hard is sharp. Tap a bot to change it.</p>
          <div class="presets" data-testid="setup-presets">${LEVELS.map((l) => `<button type="button" class="btn preset ${l} ${preset === l ? 'on' : ''}" data-l="${l}" data-testid="preset-${l}" aria-pressed="${preset === l}" ${readOnly ? 'disabled' : ''}>${cap(l).toUpperCase()}</button>`).join('')}</div>
          ${online ? '' : `<div class="row coopline"><button type="button" class="btn coopset ${setup.size[0] === 2 && setup.size[1] === 2 ? 'on' : ''}" data-testid="preset-2v2" aria-pressed="${setup.size[0] === 2 && setup.size[1] === 2}">2v2 CO-OP: you + a bot buddy</button></div>`}
          ${online ? '' : `<div class="teampick sidepick"><span>You play</span><button type="button" class="tbtn t0 ${setup.side === 0 ? 'on' : ''}" data-side="0" data-testid="side-0">SUNNY</button><button type="button" class="tbtn t1 ${setup.side === 1 ? 'on' : ''}" data-side="1" data-testid="side-1">GLOOM</button></div>`}
          <div class="sides">${col(0)}<span class="vs">VS</span>${col(1)}</div>
          <p class="hint" data-testid="setup-summary">${summary(setup, preset)}</p>
          <div class="row"><button class="btn primary next" type="button" data-testid="setup-next">${nextLabel}</button></div>`;
      };
      const wire = (el) => {
        const redraw = () => { el.innerHTML = '<button class="small home" type="button" aria-label="Back" data-testid="setup-back">' + icons.home + '</button>' + body(); wire(el); onChange?.(setup); };
        on(el, '.next', onNext);
        on(el, '.home', onBack);
        for (const b of el.querySelectorAll('.preset')) b.addEventListener('click', () => { applyPreset(setup, b.dataset.l); redraw(); });
        for (const b of el.querySelectorAll('.lvl')) b.addEventListener('click', () => { setup.diff[+b.dataset.t][+b.dataset.i] = b.dataset.l; redraw(); });
        for (const b of el.querySelectorAll('.size')) b.addEventListener('click', () => { const t = +b.dataset.t; setup.size[t] = Math.min(MAX_TEAM, Math.max(1, setup.size[t] + +b.dataset.d)); redraw(); });
        el.querySelector('.coopset')?.addEventListener('click', () => { setup.size = [2, 2]; redraw(); });
        for (const b of el.querySelectorAll('[data-side]')) b.addEventListener('click', () => { setup.side = +b.dataset.side; redraw(); });
      };
      show('setup modal', '<button class="small home" type="button" aria-label="Back" data-testid="setup-back">' + icons.home + '</button>' + body(), wire);
    },

    // Offline draft. phase 'ban': tap a champion, BAN it. phase 'pick': banned champions are stamped and locked, tap one, GO.
    // secs: countdown, then onTimeout(selected id or null). note: one line under the help text.
    showSelect({ phase = 'pick', picked, banned = [], spells = [], secs = 0, note = '', onBan, onPlay, onTimeout, onHome, onSpells, onBuy }) {
      const banning = phase === 'ban';
      const out = new Set(banned);
      const usable = (id) => !out.has(id) && isOwned(id); // you can only play champions you own
      let sel = banning ? null : usable(picked) && ROSTER.includes(picked) ? picked : ROSTER.find(usable) ?? ROSTER[0];
      const cardHtml = (id) => {
        const def = HEROES[id], gone = out.has(id), locked = !isOwned(id);
        return `<button type="button" class="hcard ${gone ? 'out banned' : ''} ${locked && !gone ? 'lockd' : ''}" data-id="${id}" data-testid="champion-card-${id}" data-locked="${locked}" data-stamp="${gone ? stamp('banned') : ''}" aria-pressed="false" ${gone ? 'disabled' : ''} style="--c:${def.css}">
          <span class="pic">${portrait(id)}</span><b>${def.name}</b>
          <span class="role"><i>${icons.role(def.role)}</i>${upper(def.role)}</span>${chip(id)}${locked && !gone ? lockBadge() : ''}</button>`;
      };
      const cards = ROSTER.map(cardHtml).join('');
      show(`select modal ${banning ? 'banmode' : ''}`, `
        <button class="small home" type="button" aria-label="Back" data-testid="select-back">${icons.home}</button>
        <h2 class="sel-title" data-testid="draft-title">${banning ? 'Ban — tap to ban' : 'Pick — tap to choose'}</h2>
        <p class="hint draft-help" data-testid="draft-help">${banning ? HELP : note || 'Banned champions are locked. Now pick yours!'}</p>
        <span class="timer" data-testid="draft-timer"></span>
        <div class="wallet sel-wallet" data-testid="select-wallet">${wallet()}</div>
        ${banning ? '' : spellPick(spells)}
        <div class="selwrap">
          <div class="grid" data-testid="champion-grid">${cards}</div>
          <aside class="detail" data-testid="champion-detail"></aside>
        </div>`,
      (el) => {
        const list = [...el.querySelectorAll('.hcard')], detail = el.querySelector('.detail');
        const act = () => {
          if (banning) return '<button class="btn ban go" type="button" data-testid="ban-btn">BAN</button>';
          if (isOwned(sel)) return '<button class="btn primary go" type="button" data-testid="go-btn">GO</button>';
          const price = nextPrice(), need = price - profile().coins;
          return need > 0
            ? `<button class="btn buy" type="button" data-testid="buy-btn" disabled>${LOCK} ${price} ${COIN}</button><p class="hint need" data-testid="buy-need">${need} more coins — play a match!</p>`
            : `<button class="btn primary buy" type="button" data-testid="buy-btn">UNLOCK ${price} ${COIN}</button>`;
        };
        const fill = () => {
          if (!sel) {
            detail.innerHTML = '<p class="dtitle">Tap a champion you don\'t want anyone to play.</p><div class="dact"><button class="btn ban go" type="button" data-testid="ban-btn" disabled>BAN</button></div>';
            return;
          }
          const def = HEROES[sel];
          el.style.setProperty('--sel', def.css);
          detail.innerHTML = `${detailBody(sel)}${!banning && isOwned(sel) ? skinRow(sel) : ''}<div class="dact">${act()}</div>`;
          for (const b of detail.querySelectorAll('.skinchip')) b.addEventListener('click', () => {
            const k = b.dataset.skin;
            if (!ownsSkin(sel, k) && k !== 'default') { if (!buySkin(sel, k).ok) return; } else equip(sel, k);
            audio.sfx('skill', { def: HEROES[sel], isPlayer: true });
            const card = el.querySelector(`.hcard[data-id="${sel}"] .pic`); if (card) card.innerHTML = portrait(sel);
            el.querySelector('.wallet').innerHTML = wallet();
            fill();
          });
          detail.querySelector('.go')?.addEventListener('click', () => (banning ? onBan(sel) : onPlay(sel)));
          detail.querySelector('.buy:not(:disabled)')?.addEventListener('click', () => {
            const r = buyChampion(sel);
            if (!r.ok) return;
            audio.sfx('skill', { def: HEROES[sel], isPlayer: true });
            const i = list.findIndex((c) => c.dataset.id === sel);
            list[i].outerHTML = cardHtml(sel); // refresh this card + every price badge (the next unlock costs more)
            for (const c of el.querySelectorAll('.lockbadge b')) c.textContent = nextPrice();
            list.splice(0, list.length, ...el.querySelectorAll('.hcard'));
            wireCards();
            el.querySelector('.wallet').innerHTML = wallet();
            onBuy?.(sel);
            mark(); fill();
          });
        };
        const mark = () => list.forEach((c) => {
          const on = c.dataset.id === sel;
          c.classList.toggle('sel', on);
          c.setAttribute('aria-pressed', String(on));
        });
        const wireCards = () => {
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
        };
        mark(); fill(); wireCards();
        if (!banning) wireSpells(el, spells, onSpells);
        on(el, '.home', onHome);
        countdown(el, secs && performance.now() + secs * 1000, () => onTimeout?.(sel && (banning || usable(sel)) ? sel : null));
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

    // Room lobby: code + link, both players' team / ban / champion, host Start. Re-rendered on every lobby update.
    // stage 'ban': tap a champion (banSel), BAN it. stage 'pick': banned / taken champions are stamped and locked.
    // deadline: performance.now() ms the stage timer ends (0 = no timer).
    showLobby({ code, link, me, players, phase, stage = 'pick', bans = [], banSel = null, spells = [], deadline = 0, conn, error, setup = null }, { onTeam, onHero, onBanSel, onBan, onSpells, onStart, onCopy, onLeave, onTimeout, onSetup }) {
      const mine = players.find((p) => p.slot === me), other = players.find((p) => p.slot !== me);
      const isHost = me === 0, two = players.length === 2;
      const banning = stage === 'ban' && phase === 'lobby';
      const versus = two && players[0].team !== players[1].team;
      const mode = !two ? 'Practice: you + bots' : versus ? 'Versus: you play against each other' : 'Co-op: same team vs bots';
      const state = (id) => (bans.includes(id) ? 'banned' : other?.hero === id ? 'taken' : '');
      const row = (p) => `<li class="pl t${p.team} ${p.connected ? '' : 'off'}" data-testid="player-${p.slot}"><i class="dot"></i><b>${p.name}${p.slot === me ? ' (you)' : ''}</b>
        <span class="tm">${TEAM_NAME[p.team]}</span>${p.ban ? `<span class="bn" data-testid="player-ban-${p.slot}">Ban: ${HEROES[p.ban]?.name ?? p.ban}</span>` : ''}<span class="ch">${p.hero ? `<i>${portrait(p.hero)}</i>${HEROES[p.hero].name}` : '…'}</span></li>`;
      const sel = banning ? banSel : mine?.hero;
      const cards = ROSTER.map((id) => {
        const st = state(id), gone = !!st, def = HEROES[id], locked = !banning && !isOwned(id) && !gone; // online: you can only pick champions you own (bans are open to all)
        return `<button type="button" class="hcard ${id === sel ? 'sel' : ''} ${gone ? `out ${st}` : ''} ${locked ? 'lockd' : ''}" data-id="${id}" data-testid="lobby-champ-${id}" data-locked="${locked}" data-stamp="${stamp(st)}" aria-pressed="${id === sel}" style="--c:${def.css}" ${gone || locked || (banning && mine?.ban) ? 'disabled' : ''}>
          <span class="pic">${portrait(id)}</span><b>${def.name}</b>
          <span class="role"><i>${icons.role(def.role)}</i>${upper(def.role)}</span>${chip(id)}${locked ? `<span class="lockbadge">${LOCK}</span>` : ''}</button>`;
      }).join('');
      const canStart = isHost && phase === 'lobby' && stage === 'pick' && two && players.every((p) => p.connected && p.hero);
      const help = !banning ? 'Banned champions are locked. Now pick yours!' : mine?.ban ? (two && !other?.ban ? 'Waiting for your friend to ban…' : '') : HELP;
      const action = banning
        ? `<button class="btn ban banbtn go" type="button" data-testid="ban-btn" ${banSel && !mine?.ban ? '' : 'disabled'}>BAN</button>`
        : isHost ? `<button class="btn primary start go" type="button" data-testid="start-btn" ${canStart || (phase === 'lobby' && stage === 'pick' && !two && mine?.hero) ? '' : 'disabled'}>${two ? 'START' : 'PRACTICE'}</button>` : '<span class="hint">Waiting for the host to start…</span>';
      const pane = sel && HEROES[sel] ? detailBody(sel) : `<p class="dtitle">${banning ? 'Tap a champion you don\'t want anyone to play.' : 'Tap a champion to see what they can do.'}</p>`;
      show(`lobby modal ${banning ? 'banmode' : ''}`, `
        <div class="lobbybar">
          <button class="small home" type="button" aria-label="Leave" data-testid="lobby-back">${icons.home}</button>
          <div class="roomcode"><span>Room code</span><b data-testid="room-code">${code}</b>
            <button class="btn copy" type="button" data-testid="copy-link">COPY LINK</button></div>
          <ul class="players">${players.map(row).join('')}${two ? '' : '<li class="pl wait"><i class="dot"></i><b>Waiting for a friend…</b></li>'}</ul>
          <div class="teampick"><button type="button" class="tbtn t0 ${mine?.team === 0 ? 'on' : ''}" data-team="0" data-testid="team-sunny">SUNNY</button>
            <button type="button" class="tbtn t1 ${mine?.team === 1 ? 'on' : ''}" data-team="1" data-testid="team-gloom">GLOOM</button></div>
        </div>
        <div class="lobbysub">
          <h3 class="stagehead" data-testid="draft-title">${phase === 'play' ? 'Match in progress…' : banning ? 'Ban — tap to ban' : 'Pick — tap to choose'}<span class="timer" data-testid="draft-timer"></span></h3>
          <p class="hint draft-help" data-testid="draft-help">${help}</p>
          ${phase === 'lobby' ? spellPick(spells) : ''}
          ${setup ? `<p class="hint setupline" data-testid="lobby-setup">Match: ${summary(setup)}${isHost && phase === 'lobby' ? ' <button type="button" class="small tweak" data-testid="lobby-setup-btn">CHANGE</button>' : ''}</p>` : ''}
          <p class="hint modeline" data-testid="lobby-mode">${phase === 'play' ? '' : mode}</p>
          <p class="neterr" data-testid="lobby-error">${conn !== 'open' ? 'Reconnecting…' : error ?? ''}</p>
          <p class="sharelink" data-testid="share-link">${link}</p>
        </div>
        <div class="selwrap">
          <div class="grid lobbygrid" data-testid="champion-grid">${cards}</div>
          <aside class="detail" data-testid="champion-detail">${pane}<div class="dact">${action}</div></aside>
        </div>`,
      (el) => {
        for (const b of el.querySelectorAll('.tbtn')) b.addEventListener('click', () => onTeam(+b.dataset.team));
        for (const b of el.querySelectorAll('.hcard')) b.addEventListener('click', () => (banning ? onBanSel(b.dataset.id) : onHero(b.dataset.id)));
        if (sel) el.style.setProperty('--sel', HEROES[sel]?.css);
        if (phase === 'lobby') wireSpells(el, spells, onSpells);
        el.querySelector('.copy').addEventListener('click', () => onCopy(el.querySelector('.copy')));
        el.querySelector('.home').addEventListener('click', onLeave);
        el.querySelector('.tweak')?.addEventListener('click', onSetup);
        el.querySelector('.start')?.addEventListener('click', () => onStart(!two));
        el.querySelector('.banbtn')?.addEventListener('click', () => onBan(banSel));
        if (phase === 'lobby') countdown(el, deadline, () => onTimeout?.());
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

    showResult({ win, stars, time, reason, rewards }, { onAgain, onHome, againLabel = 'PLAY AGAIN', homeLabel = 'CHAMPIONS' }) {
      const row = [0, 1, 2].map((i) => `<i class="${i < stars ? 'on' : ''}" style="--i:${i}">${icons.star(i < stars ? hex(PAL.gold) : '#2B3550')}</i>`).join('');
      const btns = `<div class="row"><button class="btn primary again" type="button" data-testid="again-btn">${againLabel}</button><button class="btn home" type="button" data-testid="champions-btn">${homeLabel}</button></div>`;
      show(win ? 'result win modal' : 'result lose modal', `
        <h2 data-testid="result-title">${win ? 'Victory' : 'Defeat'}</h2>
        <p class="reason">${reason} · ${mmss(time)}</p>
        ${win ? `<div class="stars">${row}</div>` : ''}
        ${rewards ? `<p class="rewards" data-testid="rewards">+${rewards.coins} ${COIN} · +${rewards.xp} XP${rewards.levelsGained ? ` · <b data-testid="level-up">LEVEL UP! LV ${rewards.level} (+${rewards.bonus} ${COIN})</b>` : ''}</p>` : ''}
        ${(rewards?.badges ?? []).map((b) => `<p class="questdone" data-testid="badge-new">${b.icon} NEW BADGE: ${b.name}</p>`).join('')}
        ${(rewards?.quests ?? []).map((q) => `<p class="questdone" data-testid="quest-complete">★ QUEST DONE: ${q.text} · +${q.coins} ${COIN}</p>`).join('')}${btns}`,
      (el) => { on(el, '.again', onAgain); on(el, '.home', onHome); });
    },
  };
}
