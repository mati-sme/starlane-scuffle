// Touch (via ui/joystick.js), keyboard and mouse -> intents.
// stick / readMove use screen space: x right, y up.
export const input = {
  stick: { x: 0, y: 0 },
  attackTouch: false,
  attackKey: false,
  attackMouse: false,
  walkClick: null, // {x, y} in NDC, consumed by the match
  keys: new Set(),
  get attack() { return this.attackTouch || this.attackKey || this.attackMouse; },
};

const AXIS = {
  KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
};

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

export function initInput(canvas) {
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code in AXIS) e.preventDefault();
    input.keys.add(e.code);
    if (e.code === 'Space' || e.code === 'KeyJ') input.attackKey = true;
  });
  window.addEventListener('keyup', (e) => {
    input.keys.delete(e.code);
    if (e.code === 'Space' || e.code === 'KeyJ') input.attackKey = false;
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.attackKey = input.attackMouse = false;
  });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') return;
    if (e.button === 0) input.attackMouse = true;
    else if (e.button === 2) {
      input.walkClick = { x: (e.clientX / innerWidth) * 2 - 1, y: -((e.clientY / innerHeight) * 2 - 1) };
    }
  });
  window.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse' && e.button === 0) input.attackMouse = false;
  });
}
