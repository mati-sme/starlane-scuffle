// Touch controls: floating joystick on the left 45%, hold-to-attack button on the right.
import { input } from '../core/input.js';
import { icons } from './icons.js';

const BASE = 140, DEAD = 12;

export function initTouchControls() {
  const zone = document.getElementById('stick-zone');
  const base = document.getElementById('stick-base');
  const knob = document.getElementById('stick-knob');
  const atk = document.getElementById('atk');
  atk.innerHTML = icons.basic_melee; // the HUD swaps in the champion's own basic-attack glyph

  if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
  addEventListener('touchstart', () => document.body.classList.add('touch'), { once: true, passive: true });

  let id = null, ox = 0, oy = 0;
  const reset = () => {
    id = null;
    input.stick.x = input.stick.y = 0;
    base.classList.remove('on');
  };

  zone.addEventListener('pointerdown', (e) => {
    if (id !== null || e.pointerType === 'mouse') return;
    id = e.pointerId;
    zone.setPointerCapture(id);
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
  for (const type of ['pointerup', 'pointercancel']) {
    zone.addEventListener(type, (e) => { if (e.pointerId === id) reset(); });
  }

  atk.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    atk.setPointerCapture(e.pointerId);
    input.attackTouch = true;
    atk.classList.add('down');
  });
  for (const type of ['pointerup', 'pointercancel']) {
    atk.addEventListener(type, () => { input.attackTouch = false; atk.classList.remove('down'); });
  }
  atk.addEventListener('contextmenu', (e) => e.preventDefault());
}
