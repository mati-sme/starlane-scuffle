// Boot + screen state machine: title -> hero select -> match (+ pause) -> results.
import { createRenderer } from './render/renderer.js';
import { CameraRig } from './render/camera.js';
import { particles } from './render/particles.js';
import { vfx } from './render/vfx.js';
import { createMap } from './world/map.js';
import { Match } from './game/match.js';
import { createLoop } from './core/loop.js';
import { initInput } from './core/input.js';
import { bus } from './core/bus.js';
import { SIM_STEP, MAP } from './config.js';
import { Hud } from './ui/hud.js';
import { createMenus } from './ui/menus.js';
import { initTouchControls } from './ui/joystick.js';
import { icons } from './ui/icons.js';
import { audio } from './audio.js';
import { save } from './save.js';
import { ROSTER } from './heroes/index.js';

const $ = (id) => document.getElementById(id);
const canvas = $('c');

const gfx = createRenderer(canvas);
particles.attach(gfx.scene);
vfx.attach(gfx.scene);
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

let state = 'title'; // title | select | match | paused | results
let t = 0;
let resultTimer = 0;
let unlocked = Math.min(ROSTER.length, Math.max(2, save.get('unlocked', 2)));
let picked = save.get('hero', 'zip');
if (ROSTER.indexOf(picked) < 0 || ROSTER.indexOf(picked) >= unlocked) picked = ROSTER[0];

const muteBtn = $('mute');
const syncMute = () => { muteBtn.innerHTML = audio.muted ? icons.mute : icons.sound; };
muteBtn.addEventListener('click', () => { audio.toggleMute(); syncMute(); });
$('pause').innerHTML = icons.pause;
$('pause').addEventListener('click', () => pause());
syncMute();

function leave(next) {
  clearTimeout(resultTimer);
  state = next;
  document.body.classList.remove('playing');
  hud.hide();
  match.reset();
  rig.orbit(-MAP.heroX + 1, 1.5, 0);
  audio.music(true);
}

function toTitle() {
  leave('title');
  menus.showTitle(toSelect);
}

function toSelect() {
  leave('select');
  menus.showSelect({ unlocked, picked, onPlay: startMatch, onHome: toTitle });
}

function startMatch(id = picked) {
  clearTimeout(resultTimer);
  picked = id;
  save.set('hero', id);
  if (id !== match.heroId) match.setHero(id);
  menus.hideAll();
  match.reset();
  rig.follow(match.hero);
  hud.show();
  document.body.classList.add('playing');
  state = 'match';
  audio.music(true);
}

function pause() {
  if (state !== 'match') return;
  state = 'paused';
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
  document.body.classList.add('playing');
  menus.hideAll();
  audio.pause(false);
}

bus.on('end', (res) => {
  state = 'results';
  document.body.classList.remove('playing');
  let unlock = null;
  if (res.win && unlocked < ROSTER.length) {
    unlock = ROSTER[unlocked++];
    save.set('unlocked', unlocked);
  }
  resultTimer = setTimeout(() => menus.showResult(res, { unlock, onAgain: () => startMatch(picked), onHome: toSelect }), 1800);
});

addEventListener('keydown', (e) => {
  if (e.repeat || (e.code !== 'Escape' && e.code !== 'KeyP')) return;
  if (state === 'match') pause(); else if (state === 'paused') resume();
});

const loop = createLoop({
  step: SIM_STEP,
  update: (dt) => { if (state === 'match' || state === 'results') match.update(dt); },
  render: (alpha, realDt) => {
    const dt = state === 'paused' ? 0 : realDt;
    t += dt;
    match.render(alpha, dt, t, state);
    particles.update(dt);
    vfx.update(dt, t);
    rig.update(dt, gfx.camera.aspect);
    gfx.camera.updateMatrixWorld(); // health bars project with this frame's camera
    hud.update();
    gfx.renderer.render(gfx.scene, gfx.camera);
    gfx.adapt(realDt);
  },
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { pause(); loop.stop(); } else loop.start();
});

toTitle();
loop.start();
