// Boot + screen state machine: title -> hero select -> match (+ pause) -> results; online: title -> join / create -> lobby -> match.
import { createRenderer } from './render/renderer.js';
import { CameraRig } from './render/camera.js';
import { particles } from './render/particles.js';
import { vfx } from './render/vfx.js';
import { createMap } from './world/map.js';
import { Match } from './game/match.js';
import { createLoop } from './core/loop.js';
import { initInput, resetInput } from './core/input.js';
import { bus } from './core/bus.js';
import { SIM_STEP, MAP } from './config.js';
import { Hud } from './ui/hud.js';
import { createMenus } from './ui/menus.js';
import { initTouchControls } from './ui/joystick.js';
import { icons } from './ui/icons.js';
import { audio } from './audio.js';
import { lockLandscape } from './orient.js';
import { save } from './save.js';
import { HEROES, ROSTER } from './heroes/index.js';
import { NetClient } from './net/client.js';
import { Session } from './net/session.js';
import { T, randomCode, cleanCode, shareLink } from './net/protocol.js';
import { composeOnline, seeded } from './game/compose.js';
import { DEFAULT_SPELLS, cleanSpells } from './game/spells.js';
import { cleanSetup, defaultSetup } from './game/setup.js';
import { isOwned, awardMatch, addCoins, FREE_CHAMPS } from './game/progress.js';
import { progressMatch } from './game/quests.js';

const $ = (id) => document.getElementById(id);
const canvas = $('c');

const gfx = createRenderer(canvas);
particles.attach(gfx.scene);
vfx.attach(gfx.scene);
vfx.camera = gfx.camera;
gfx.onResize = () => particles.setViewport(canvas.height, gfx.camera.fov);
gfx.resize();

const rig = new CameraRig(gfx.camera);
const map = createMap(gfx.scene, gfx.camera);
const match = new Match(gfx.scene, rig, map);
const hud = new Hud($('hud'), $('bars'), match, gfx.camera);
const menus = createMenus($('screens'));

initInput(canvas);
initTouchControls();
$('rotate').innerHTML = icons.phone;
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !window.Capacitor && !window.__TAURI__) navigator.serviceWorker.register('sw.js').catch(() => {});

const net = new NetClient();
const session = new Session(match, net);
let online = null; // { code, lobby, error, tries } while in an online room
let lastBanner = '';

let state = 'title'; // title | select | online | lobby | match | paused | results
let t = 0;
let resultTimer = 0;
let draftBans = []; // offline: champions banned this draft
let setup = defaultSetup(); // offline match setup (team sizes, side, bot levels); kept between matches
const BAN_SECS = 12, PICK_SECS = 30;
const pickOne = (ids) => ids[(Math.random() * ids.length) | 0];
let picked = save.get('hero', ROSTER[0]);
if (!ROSTER.includes(picked) || !isOwned(picked)) picked = ROSTER.find(isOwned) ?? ROSTER[0]; // a champion you do not own (yet) can't be your pick
const owned = () => ROSTER.filter(isOwned);
let spells = cleanSpells(save.get('spells')) ?? [...DEFAULT_SPELLS]; // summoner spells: Flash + Barrier unless changed
const setSpells = (s) => { spells = s; save.set('spells', s); };

// Read-only debug surface for browser tests.
window.__starlane = {
  match, net, session, gfx, menus,
  get state() { return state; },
  unstuck() { resetInput(); match.hero?.unstick?.(true); },
};

const muteBtn = $('mute');
const syncMute = () => { muteBtn.innerHTML = audio.muted ? icons.mute : icons.sound; };
muteBtn.addEventListener('click', () => { audio.toggleMute(); syncMute(); });
audio.listener = () => match.hero; // positional sfx are placed relative to the local hero
$('pause').innerHTML = icons.pause;
$('pause').addEventListener('click', () => pause());
$('unstuck').addEventListener('click', (e) => {
  e.preventDefault();
  resetInput();
  match.hero?.unstick?.(true);
});
syncMute();

function leave(next) {
  clearTimeout(resultTimer);
  resetInput();
  state = next;
  document.body.classList.remove('playing');
  hud.hide();
  match.reset();
  rig.orbit(-MAP.heroX + 4, 1.5, 0);
  audio.music(true);
}

function toTitle() {
  leaveRoom();
  leave('title');
  menus.showTitle(toSetup, () => toOnline());
}

// ---- online ----
function leaveRoom() {
  if (online) { net.send({ t: T.leave }); net.forget(); save.set('lastRoom', ''); }
  net.close();
  session.end();
  online = null;
}

function toOnline(error = '') {
  leaveRoom();
  leave('online');
  menus.showOnline({ error, onCreate: createRoom, onJoin: joinRoom, onBack: toTitle });
}

function createRoom() { connectRoom(randomCode(), true, 0); }

function joinRoom(raw) {
  const code = cleanCode(raw);
  if (code.length < 4) return menus.showOnline({ code, error: 'Type the 4-character code', onCreate: createRoom, onJoin: joinRoom, onBack: toTitle });
  connectRoom(code, false, 0);
}

function connectRoom(code, create, tries) {
  net.close();
  leave('online');
  online = { code, lobby: null, error: '', tries, banSel: null, leftAt: 0, draftKey: '', timedOut: false };
  save.set('lastRoom', code); // reload / reopen the app can resume this room
  menus.showOnline({ code: create ? '' : code, busy: true, error: 'Connecting…', onCreate() {}, onJoin() {}, onBack: toTitle });
  net.connect(code, { create });
}

const myPick = () => online?.lobby?.players.find((p) => p.slot === net.slot);

function renderLobby() {
  const L = online?.lobby;
  if (!L || state !== 'lobby') return;
  const stage = L.stage ?? 'pick', bans = L.bans ?? []; // an older worker has no draft: straight to picking
  const me = myPick(), other = L.players.find((p) => p.slot !== net.slot);
  const free = () => ROSTER.filter((id) => !bans.includes(id) && id !== other?.hero);
  const pickable = () => free().filter(isOwned); // locked champions are never auto-picked either
  const send = (patch) => {
    if (me) Object.assign(me, patch); // optimistic; the room echoes it back
    net.send({ t: T.pick, ...patch });
    renderLobby();
  };
  const draftKey = `${stage}:${bans.length}:${L.players.length}`;
  if (online.draftKey !== draftKey) { online.draftKey = draftKey; online.timedOut = false; }
  menus.showLobby({ code: online.code, link: shareLink(online.code), me: net.slot, players: L.players, phase: L.phase, stage, bans, banSel: online.banSel, spells: [...(cleanSpells(me?.spells) ?? spells)], deadline: L.left ? online.leftAt + L.left * 1000 : 0, conn: net.status, error: online.error, setup: cleanSetup(L.setup) }, {
    onTeam: (team) => send({ team }),
    onHero: (hero) => { if (!isOwned(hero)) return; online.error = ''; picked = hero; save.set('hero', hero); send({ hero }); },
    onBanSel: (id) => { online.banSel = id; renderLobby(); },
    onBan: (ban) => { online.error = ''; send({ ban }); },
    onSpells: (s) => { setSpells(s); send({ spells: s }); },
    onTimeout() { // the stage clock ran out: do the sensible thing for this player, once
      if (online.timedOut) return;
      online.timedOut = true;
      if (stage === 'ban') {
        if (me && !me.ban) send({ ban: online.banSel && free().includes(online.banSel) ? online.banSel : pickOne(free().filter((id) => id !== picked)) });
        setTimeout(() => net.send({ t: T.stage }), 1500);
      } else if (me && !me.hero) {
        const id = pickable().includes(picked) ? picked : pickOne(pickable().length ? pickable() : free().filter((k) => FREE_CHAMPS.includes(k)));
        picked = id;
        send({ hero: id });
      }
    },
    onStart: (practice) => { online.error = ''; net.send({ t: T.start, practice, setup: cleanSetup(L.setup) }); },
    onSetup() { // host only: same screen as offline, then tell the room
      const draft = cleanSetup(L.setup);
      menus.showSetup({ setup: draft, online: true, nextLabel: 'DONE', onBack: renderLobby, onNext() { net.send({ t: T.setup, setup: draft }); L.setup = draft; renderLobby(); } });
    },
    onCopy(btn) {
      const link = shareLink(online.code), done = () => { btn.textContent = 'COPIED!'; };
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(link).then(done, () => prompt('Copy this link', link));
      else prompt('Copy this link', link);
    },
    onLeave: toTitle,
  });
}

function toLobby(error = '') {
  if (!online) return toOnline();
  leave('lobby');
  session.end();
  online.error = error;
  renderLobby();
}

function startOnline({ seed, picks, bans = [], setup: raw }, role) {
  const list = [...picks].sort((a, b) => a.slot - b.slot), setup = cleanSetup(raw); // no setup from an older room = 5v5 Mid
  const { blue, red } = composeOnline(list.map((p) => ({ team: p.team, hero: p.hero })), seeded(seed), bans, setup.size);
  const at = (p) => ({ team: p.team, idx: list.filter((q) => q.team === p.team && q.slot < p.slot).length, spells: cleanSpells(p.spells) ?? (p.slot === net.slot ? spells : null) });
  const me = list.find((p) => p.slot === net.slot), peer = list.find((p) => p.slot !== net.slot);
  if (!me) return toLobby('Could not join the match');
  clearTimeout(resultTimer);
  match.setOnline({ blue, red, me: at(me), peer: peer ? at(peer) : null, setup }, role);
  menus.hideAll();
  rig.follow(match.hero);
  hud.show();
  document.body.classList.add('playing');
  lockLandscape();
  state = 'match';
  session.begin(role);
  audio.music(true);
}

net.on('welcome', (m) => {
  if (!online) return;
  online.tries = 0;
  if (m.phase === 'play' && m.start) {
    if (state === 'match' || state === 'results') return; // plain reconnect, the sim is still here
    if (m.slot === 0) net.send({ t: T.abort }); // reloaded host: the sim is gone, back to the lobby
    else startOnline(m.start, 'guest');
  }
}).on(T.lobby, (m) => {
  if (!online) return;
  online.lobby = m;
  online.leftAt = performance.now();
  const mp = m.players.find((p) => p.slot === net.slot);
  if (mp && !online.spSent && cleanSpells(mp.spells)?.join() !== spells.join()) { online.spSent = true; net.send({ t: T.pick, spells }); } // once: tell the room my saved spells
  if (mp?.hero && !isOwned(mp.hero) && !online.fixSent) { // a champion I do not own: switch to one I do
    online.fixSent = true;
    const alt = owned().find((id) => !(m.bans ?? []).includes(id) && id !== m.players.find((p) => p.slot !== net.slot)?.hero);
    if (alt) { picked = alt; net.send({ t: T.pick, hero: alt }); }
  }
  if (m.stage === 'pick') online.banSel = null;
  if (state === 'online') { state = 'lobby'; document.body.classList.remove('playing'); }
  renderLobby();
}).on('start', (m) => {
  if (online && (state === 'lobby' || state === 'online')) startOnline(m, net.slot === 0 ? 'host' : 'guest');
}).on(T.peer, (m) => {
  session.onPeer(m);
}).on(T.closed, (m) => {
  if (!online) return;
  if (m.why === 'host-left') return toOnline('The host left the room');
  if (state === 'match' || state === 'results') toLobby(m.why === 'aborted' ? '' : 'Match ended');
}).on(T.snap, (m) => session.onMessage(m)).on(T.input, (m) => session.onMessage(m)).on(T.err, (m) => {
  if (!online) return;
  if (m.code === 'noroom') toOnline('No room with that code');
  else if (m.code === 'full') toOnline('That room is full');
  else if (m.code === 'started') toOnline('That match already started');
  else if (m.code === 'exists') { if (online.tries < 5) connectRoom(randomCode(), true, online.tries + 1); else toOnline('Could not make a room, try again'); }
  else { online.error = m.msg; renderLobby(); }
}).on('status', () => {
  if (!online) return;
  if (state === 'online' && net.status === 'reconnecting' && net.tries >= 2) { toOnline("Can't reach the game server. Check your wifi."); return; }
  renderLobby();
});

// Offline match setup comes first: presets, team sizes, side and a level per bot; then the draft.
function toSetup() {
  leave('select');
  menus.showSetup({ setup, onChange: (s) => { setup = s; }, onNext: toSelect, onBack: toTitle });
}

// Offline draft: ban one champion, the bots ban two more (one for each side), then pick.
function toSelect() {
  leave('select');
  draftBans = [];
  menus.showSelect({
    phase: 'ban', picked, spells: [...spells], secs: BAN_SECS, onBan: botBans, onHome: toTitle,
    onTimeout: (sel) => botBans(sel ?? pickOne(ROSTER.filter((id) => id !== picked))),
  });
}

function botBans(id) {
  draftBans = [id];
  for (let i = 0; i < 2; i++) draftBans.push(pickOne(ROSTER.filter((k) => !draftBans.includes(k) && k !== picked)));
  const names = draftBans.slice(1).map((k) => HEROES[k].name).join(' and ');
  menus.showSelect({
    phase: 'pick', picked, banned: draftBans, spells: [...spells], onSpells: setSpells, secs: PICK_SECS, note: `The bots banned ${names}. Banned champions are locked.`,
    onPlay: startMatch, onTimeout: (sel) => startMatch(sel ?? undefined), onHome: toTitle,
  });
}

function startMatch(id = picked) {
  clearTimeout(resultTimer);
  if (!ROSTER.includes(id) || !isOwned(id) || draftBans.includes(id)) id = owned().find((k) => !draftBans.includes(k)) ?? FREE_CHAMPS[0];
  picked = id;
  save.set('hero', id);
  match.setHero(id, undefined, draftBans, spells, setup); // fresh heroes + a fresh random bot line-up each match
  menus.hideAll();
  match.reset();
  rig.follow(match.hero);
  hud.show();
  document.body.classList.add('playing');
  lockLandscape();
  state = 'match';
  audio.music(true);
}

function pause() {
  if (state !== 'match') return;
  if (online) { // a shared match cannot freeze: just a menu on top
    menus.showPause({ online: true, onResume: () => menus.hideAll(), onHome: toTitle });
    return;
  }
  state = 'paused';
  resetInput();
  document.body.classList.remove('playing');
  audio.pause(true);
  menus.showPause({
    onResume: resume,
    onHome: () => { audio.pause(false); toSelect(); },
  });
}

function resume() {
  if (state !== 'paused') return;
  state = 'match';
  resetInput();
  document.body.classList.add('playing');
  menus.hideAll();
  audio.pause(false);
}

bus.on('end', (res) => {
  state = 'results';
  res.rewards = awardMatch(res); // XP + coins (local only; the online lobby doesn't need to know)
  res.rewards.quests = progressMatch(res); // daily quests finished by this match: their coins are paid now and shown on the result screen
  for (const q of res.rewards.quests) addCoins(q.coins);
  document.body.classList.remove('playing');
  resultTimer = setTimeout(() => menus.showResult(res, online
    ? { onAgain: () => { if (net.slot === 0) net.send({ t: T.abort }); toLobby(); }, onHome: toTitle, againLabel: 'LOBBY', homeLabel: 'EXIT' }
    : { onAgain: () => startMatch(picked), onHome: toSelect }), 1800);
});

addEventListener('keydown', (e) => {
  if (e.repeat || (e.code !== 'Escape' && e.code !== 'KeyP')) return;
  if (state === 'match') pause(); else if (state === 'paused') resume();
});

const loop = createLoop({
  step: SIM_STEP,
  update: (dt) => { if ((state === 'match' || state === 'results') && !session.paused) match.update(dt); },
  render: (alpha, realDt) => {
    const dt = state === 'paused' ? 0 : realDt;
    t += dt;
    match.render(alpha, dt, t, state);
    particles.update(dt);
    vfx.update(dt, t);
    rig.update(dt, gfx.camera.aspect);
    gfx.camera.updateMatrixWorld(); // health bars project with this frame's camera
    hud.update(dt);
    gfx.render(rig.look);
    gfx.adapt(realDt);
    session.tick(performance.now());
    const banner = session.banner;
    if (banner !== lastBanner) { lastBanner = banner; menus.netBanner(banner); }
  },
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && !online) { pause(); loop.stop(); } else loop.start();
});

toTitle();
loop.start();

const deepLink = cleanCode(new URLSearchParams(location.search).get('room'));
const lastRoom = cleanCode(save.get('lastRoom', '') || '');
if (deepLink.length === 4) joinRoom(deepLink); // ?room=CODE opens the join flow
else if (lastRoom.length === 4) {
  // Reloaded mid-session: resume the same online room when we still have a slot token.
  let token = null;
  try { token = JSON.parse(localStorage.getItem(`starlane.room.${lastRoom}`))?.token ?? null; } catch { /* blocked */ }
  if (token) connectRoom(lastRoom, false, 0);
}
