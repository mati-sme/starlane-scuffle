// Touch controls: floating joystick on the left 45%, hold-to-attack button on the right.
import { input, mouseDown } from '../core/input.js';
import { icons } from './icons.js';

const BASE = 140, DEAD = 12;
const AIM_START = 14, AIM_FULL = 90; // px of drag before Attack turns from auto-target into an aim; px for full strength

export function initTouchControls() {
  const zone = document.getElementById('stick-zone');
  const base = document.getElementById('stick-base');
  const knob = document.getElementById('stick-knob');
  const atk = document.getElementById('atk');
  atk.innerHTML = icons.basic_melee; // the HUD swaps in the champion's own basic-attack glyph

  // iPadOS "desktop site" reports a Mac with touch points and no coarse pointer, and may never fire touchstart: detect it up front and on the first touch/pen pointer.
  const touchOn = () => document.body.classList.add('touch');
  const ipadLike = /Macintosh|iPad/.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
  if (matchMedia('(pointer: coarse)').matches || ipadLike) touchOn();
  addEventListener('touchstart', touchOn, { once: true, passive: true });
  addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' || e.pointerType === 'pen') touchOn(); }, { capture: true, passive: true });
  // A hovering mouse (buttons 0) proves a real mouse; fingers never hover. Until then, iPadOS may label fingers 'mouse'.
  let realMouse = false;
  addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' && e.buttons === 0) realMouse = true; }, { capture: true, passive: true });
  const asMouse = (e) => e.pointerType === 'mouse' && (!document.body.classList.contains('touch') || realMouse);

  let id = null, ox = 0, oy = 0;
  const reset = () => {
    id = null;
    input.stick.x = input.stick.y = 0;
    base.classList.remove('on');
  };

  zone.addEventListener('pointerdown', (e) => {
    if (asMouse(e)) { mouseDown(e); return; }
    // A tap on the move pad always recovers a stale stick (lost capture, hidden overlay) then starts a fresh drag.
    if (id !== null && !zone.hasPointerCapture?.(id)) reset();
    if (id !== null && zone.hasPointerCapture?.(id)) return;
    id = e.pointerId;
    try { zone.setPointerCapture(id); } catch { /* pointer already gone */ }
    ox = e.clientX; oy = e.clientY;
    base.style.transform = `translate(${ox - BASE / 2}px, ${oy - BASE / 2}px)`;
    knob.style.transform = 'translate(0, 0)';
    base.classList.add('on');
  });
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return;
    const dx = e.clientX - ox, dy = e.clientY - oy, len = Math.hypot(dx, dy), r = BASE / 2;
    if (len < DEAD) { input.stick.x = input.stick.y = 0; knob.style.transform = 'translate(0, 0)'; return; }
    const k = Math.min(len, r) / r;
    input.stick.x = (dx / len) * k;
    input.stick.y = -(dy / len) * k;
    knob.style.transform = `translate(${(dx / len) * Math.min(len, r)}px, ${(dy / len) * Math.min(len, r)}px)`;
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    zone.addEventListener(type, (e) => { if (e.pointerId === id) reset(); });
  }
  zone.addEventListener('contextmenu', (e) => e.preventDefault());
  addEventListener('starlane:inputreset', () => {
    if (id !== null && zone.hasPointerCapture?.(id)) zone.releasePointerCapture(id);
    reset();
  });

  // Attack: hold = auto-target; drag = aim the basic attack that way (the match draws the fan). Its own pointerId, like every control.
  let aid = null, ax = 0, ay = 0;
  const atkEnd = () => {
    aid = null;
    input.attackTouch = false;
    input.atkAim = null;
    atk.classList.remove('down', 'aiming');
  };
  atk.addEventListener('pointerdown', (e) => {
    if (aid !== null && !atk.hasPointerCapture?.(aid)) atkEnd();
    if (aid !== null) return;
    e.preventDefault();
    aid = e.pointerId;
    atk.setPointerCapture(aid);
    ax = e.clientX; ay = e.clientY;
    input.attackTouch = true;
    input.atkAim = { sx: 0, sy: 0, frac: 0, dragged: false };
    atk.classList.add('down');
  });
  atk.addEventListener('pointermove', (e) => {
    if (e.pointerId !== aid || !input.atkAim) return;
    const dx = e.clientX - ax, dy = e.clientY - ay, len = Math.hypot(dx, dy), a = input.atkAim;
    if (len > AIM_START) a.dragged = true;
    if (!a.dragged) return;
    a.sx = dx / len; a.sy = -dy / len;
    a.frac = Math.min(1, len / AIM_FULL);
    atk.classList.add('aiming');
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    atk.addEventListener(type, (e) => { if (e.pointerId === aid) atkEnd(); });
  }
  addEventListener('starlane:inputreset', () => { if (aid !== null) atkEnd(); });
  atk.addEventListener('contextmenu', (e) => e.preventDefault());
}
