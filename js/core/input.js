// Touch (via ui/joystick.js), keyboard and mouse -> intents.
// stick / readMove use screen space: x right, y up.
export const input = {
  stick: { x: 0, y: 0 },
  attackTouch: false,
  attackKey: false,
  attackMouse: false,
  walkClick: null, // {x, y} in NDC, consumed by the match
  cast: [false, false, false, false], // Q / W / E / R (ult) pressed since the last sim step (consumed by the match)
  spend: [false, false, false, false], // 1 / 2 / 3 / 4 or Ctrl+Q / W / E / R pressed: rank up Q / E / R (consumed by the match)
  aimCast: [null, null, null, null], // drag-aimed casts waiting with cast[]: { sx, sy, frac } screen drag, or { mouse: true } (consumed with cast[])
  aiming: null, // live skill aim while a skill button / Q E R is held: { slot, sx, sy, frac, cancel, mouse }
  atkAim: null, // live basic-attack aim while Attack is dragged: { sx, sy, frac, dragged } (touch) or { mouse: true } (Shift + attack key)
  mouse: null, // last mouse position in NDC { x, y } (desktop aim)
  pref: [false, false], // held target buttons: last-hit minion / structure
  spell: [false, false], // summoner spell 1 / 2 pressed since the last sim step (F / G, consumed by the match)
  recall: false, // recall pressed since the last sim step (consumed by the match)
  keys: new Set(),
  get attack() { return this.attackTouch || this.attackKey || this.attackMouse || this.pref[0] || this.pref[1]; },
  get prefNo() { return this.pref[1] ? 2 : this.pref[0] ? 1 : 0; },
};

// Drops every held / pending intent (blur, tab hidden, pause, resume, new match). The touch controls listen to the event and release their own pointer ids.
export function resetInput() {
  input.keys.clear();
  input.stick.x = input.stick.y = 0;
  input.attackTouch = input.attackKey = input.attackMouse = false;
  input.pref[0] = input.pref[1] = false;
  input.aiming = input.atkAim = input.walkClick = null;
  input.cast.fill(false); input.spend.fill(false); input.spell.fill(false); input.aimCast.fill(null);
  input.recall = false;
  window.dispatchEvent(new Event('starlane:inputreset'));
}

// v9: Q W E R are the four skills, so keyboard movement is the arrow keys (right-click also walks).
const AXIS = {
  ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
};

const CAST_KEYS = { KeyQ: 0, KeyW: 1, KeyE: 2, KeyR: 3 };

// Fills out.x / out.y; returns true when there is any movement intent.
export function readMove(out) {
  let x = 0, y = 0;
  for (const k of input.keys) {
    const a = AXIS[k];
    if (a) { x += a[0]; y += a[1]; }
  }
  const len = Math.hypot(x, y);
  if (len > 0) { x /= len; y /= len; } else { x = input.stick.x; y = input.stick.y; }
  out.x = x; out.y = y;
  return Math.hypot(x, y) > 0.01;
}

// Mouse buttons on the playfield. The touch stick zone sits above the canvas on touch-capable desktops, so it forwards mouse presses here.
export function mouseDown(e) {
  if (e.pointerType !== 'mouse') return;
  if (e.button === 0) input.attackMouse = true;
  else if (e.button === 2 && input.aiming) input.aiming.cancel = true; // right click while aiming = cancel
  else if (e.button === 2) {
    input.walkClick = { x: (e.clientX / innerWidth) * 2 - 1, y: -((e.clientY / innerHeight) * 2 - 1) };
  }
}

export function initInput(canvas) {
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code in AXIS) e.preventDefault();
    input.keys.add(e.code);
    if (e.code === 'Space' || e.code === 'KeyJ') input.attackKey = true;
    if (e.repeat) return;
    const slot = CAST_KEYS[e.code];
    if (slot !== undefined && (e.ctrlKey || e.metaKey)) { input.spend[slot] = true; e.preventDefault(); } // Ctrl+Q / E / R ranks up instead of casting
    else if (slot !== undefined) { if (input.mouse) input.aiming = { slot, mouse: true, cancel: false }; else input.cast[slot] = true; } // desktop: hold to aim at the cursor, release to cast
    else if (e.code === 'KeyB') input.recall = true;
    else if (e.code === 'KeyF') input.spell[0] = true;
    else if (e.code === 'KeyG') input.spell[1] = true;
    else if (e.code === 'KeyC') input.pref[0] = true;
    else if (e.code === 'KeyV') input.pref[1] = true;
    else if (e.code === 'Digit1' || e.code === 'Numpad1') input.spend[0] = true;
    else if (e.code === 'Digit2' || e.code === 'Numpad2') input.spend[1] = true;
    else if (e.code === 'Digit3' || e.code === 'Numpad3') input.spend[2] = true;
    else if (e.code === 'Digit4' || e.code === 'Numpad4') input.spend[3] = true;
  });
  window.addEventListener('keyup', (e) => {
    input.keys.delete(e.code);
    if (e.code === 'Space' || e.code === 'KeyJ') input.attackKey = false;
    if (e.code === 'KeyC') input.pref[0] = false;
    if (e.code === 'KeyV') input.pref[1] = false;
    const slot = CAST_KEYS[e.code], a = input.aiming;
    if (slot !== undefined && a?.mouse && a.slot === slot) {
      input.aiming = null;
      if (!a.cancel) { input.cast[slot] = true; input.aimCast[slot] = { mouse: true }; }
    }
  });
  window.addEventListener('blur', resetInput);
  document.addEventListener('visibilitychange', resetInput);
  // Do NOT reset all input on window pointercancel: that event bubbles from a single finger
  // (second touch, setPointerCapture on a skill / +, OS cancelling one pointer) and would
  // drop the joystick / attack still held by other fingers.
  window.addEventListener('orientationchange', resetInput);
  window.addEventListener('pagehide', resetInput);
  window.addEventListener('pageshow', resetInput);
  try { screen.orientation?.addEventListener('change', resetInput); } catch { /* no Screen Orientation API */ }
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') input.mouse = { x: (e.clientX / innerWidth) * 2 - 1, y: -((e.clientY / innerHeight) * 2 - 1) };
  });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', mouseDown);
  window.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse' && e.button === 0) input.attackMouse = false;
  });
}
