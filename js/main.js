// Boot + screen state machine: title -> match -> results.
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

let state = 'title';
let t = 0;
let resultTimer = 0;

function toTitle() {
  state = 'title';
  document.body.classList.remove('playing');
  hud.hide();
  match.reset();
  rig.orbit(-MAP.heroX + 1, 1.5, 0);
  menus.showTitle(startMatch);
}

function startMatch() {
  clearTimeout(resultTimer);
  menus.hideAll();
  match.reset();
  rig.follow(match.hero);
  hud.show();
  document.body.classList.add('playing');
  state = 'match';
}

bus.on('end', (res) => {
  state = 'results';
  document.body.classList.remove('playing');
  resultTimer = setTimeout(() => menus.showResult(res, startMatch), 1800);
});

const loop = createLoop({
  step: SIM_STEP,
  update: (dt) => { if (state !== 'title') match.update(dt); },
  render: (alpha, dt) => {
    t += dt;
    match.render(alpha, dt, t, state);
    particles.update(dt);
    vfx.update(dt, t);
    rig.update(dt, gfx.camera.aspect);
    gfx.camera.updateMatrixWorld(); // health bars project with this frame's camera
    hud.update();
    gfx.renderer.render(gfx.scene, gfx.camera);
    gfx.adapt(dt);
  },
});

document.addEventListener('visibilitychange', () => (document.hidden ? loop.stop() : loop.start()));

toTitle();
loop.start();
