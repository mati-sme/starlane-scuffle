// Canvas-generated textures: particle atlas (4 frames) and a soft radial dot.
import * as THREE from 'three';

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function radial(g, cx, cy, r) {
  const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.4, 'rgba(255,255,255,0.55)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  return gr;
}

export const radialTexture = () => canvasTex(64, 64, (g) => {
  g.fillStyle = radial(g, 32, 32, 32);
  g.fillRect(0, 0, 64, 64);
});

// Frames left to right: 0 soft dot, 1 five-point star, 2 four-point sparkle, 3 ring.
export const particleAtlas = () => canvasTex(256, 64, (g) => {
  g.fillStyle = radial(g, 32, 32, 30);
  g.fillRect(0, 0, 64, 64);

  g.fillStyle = '#fff';
  g.shadowColor = '#fff';
  g.shadowBlur = 6;
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 11 : 27, a = -Math.PI / 2 + (i * Math.PI) / 5;
    g.lineTo(96 + Math.cos(a) * r, 32 + Math.sin(a) * r);
  }
  g.closePath();
  g.fill();

  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 ? 5 : 29, a = (i * Math.PI) / 4;
    g.lineTo(160 + Math.cos(a) * r, 32 + Math.sin(a) * r);
  }
  g.closePath();
  g.fill();

  g.shadowBlur = 4;
  g.strokeStyle = '#fff';
  g.lineWidth = 5;
  g.beginPath();
  g.arc(224, 32, 23, 0, Math.PI * 2);
  g.stroke();
});

// Tiling detail textures for terrain (neutral grey ~0.5 so they modulate vertex colors). Linear data, mipmapped, repeat-wrapped.
function detailTex(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = 'rgb(128,128,128)';
  g.fillRect(0, 0, size, size);
  // Draw every mark at its 3x3 wrapped copies so the texture tiles seamlessly.
  const wrap = (fn) => { for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) { g.save(); g.translate(ox, oy); fn(); g.restore(); } };
  draw(g, size, wrap);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
const grey = (v, a = 1) => `rgba(${v},${v},${v},${a})`;
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// Grass: soft clumps, then hundreds of short blades in light / dark strokes, a few clover dots.
export const grassDetail = () => detailTex(256, (g, S, wrap) => {
  seed = 11;
  for (let i = 0; i < 60; i++) {
    const x = rnd() * S, y = rnd() * S, r = 10 + rnd() * 26, v = 105 + rnd() * 50;
    wrap(() => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, grey(v, 0.5)); gr.addColorStop(1, grey(v, 0)); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); });
  }
  g.lineCap = 'round';
  for (let i = 0; i < 1400; i++) {
    const x = rnd() * S, y = rnd() * S, len = 3 + rnd() * 6, a = -Math.PI / 2 + (rnd() - 0.5) * 1.3, v = rnd() < 0.55 ? 150 + rnd() * 50 : 70 + rnd() * 30;
    g.strokeStyle = grey(v | 0, 0.55); g.lineWidth = 1 + rnd();
    wrap(() => { g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke(); });
  }
  for (let i = 0; i < 40; i++) { const x = rnd() * S, y = rnd() * S; g.fillStyle = grey(175, 0.5); wrap(() => { g.beginPath(); g.arc(x, y, 1.5, 0, 7); g.fill(); }); }
});

// Paving: staggered flagstones with dark grout, per-stone tone, chips and speckle.
export const paverDetail = () => detailTex(256, (g, S) => {
  seed = 23;
  g.fillStyle = grey(52); g.fillRect(0, 0, S, S); // grout
  const rows = 4, h = S / rows;
  for (let r = 0; r < rows; r++) {
    const cols = r % 2 ? 3 : 4, w = S / cols, off = r % 2 ? w * 0.5 : 0;
    for (let k = -1; k < cols; k++) {
      const x = off + k * w + 3, y = r * h + 3, v = 118 + rnd() * 34;
      const gr = g.createLinearGradient(x, y, x + w, y + h);
      gr.addColorStop(0, grey(v + 14)); gr.addColorStop(1, grey(v - 14));
      g.fillStyle = gr;
      g.beginPath(); g.roundRect ? g.roundRect(x, y, w - 6, h - 6, 5) : g.rect(x, y, w - 6, h - 6); g.fill();
      g.strokeStyle = grey(175, 0.35); g.lineWidth = 1.5; // worn top edge catches light
      g.beginPath(); g.moveTo(x + 4, y + 1); g.lineTo(x + w - 10, y + 1); g.stroke();
    }
  }
  for (let i = 0; i < 2600; i++) { g.fillStyle = grey(rnd() < 0.5 ? 85 : 170, 0.25); g.fillRect(rnd() * S, rnd() * S, 1.5, 1.5); }
  for (let i = 0; i < 14; i++) { // cracks
    let x = rnd() * S, y = rnd() * S; g.strokeStyle = grey(60, 0.6); g.lineWidth = 1; g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 4; k++) { x += (rnd() - 0.5) * 18; y += (rnd() - 0.5) * 18; g.lineTo(x, y); }
    g.stroke();
  }
});

// Rock: blotchy mineral tone, horizontal strata streaks and fractures.
export const rockDetail = () => detailTex(256, (g, S, wrap) => {
  seed = 5;
  for (let i = 0; i < 90; i++) {
    const x = rnd() * S, y = rnd() * S, r = 8 + rnd() * 30, v = 90 + rnd() * 80;
    wrap(() => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, grey(v | 0, 0.45)); gr.addColorStop(1, grey(v | 0, 0)); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); });
  }
  for (let i = 0; i < 26; i++) { const y = rnd() * S, v = rnd() < 0.5 ? 70 : 165; g.fillStyle = grey(v, 0.35); g.fillRect(0, y, S, 1 + rnd() * 3); }
  for (let i = 0; i < 22; i++) {
    let x = rnd() * S, y = rnd() * S; g.strokeStyle = grey(40, 0.7); g.lineWidth = 1 + rnd() * 1.5; g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += (rnd() - 0.5) * 26; y += rnd() * 16; g.lineTo(x, y); }
    g.stroke();
  }
  for (let i = 0; i < 3000; i++) { g.fillStyle = grey(rnd() < 0.5 ? 80 : 180, 0.22); g.fillRect(rnd() * S, rnd() * S, 1.5, 1.5); }
});

// Soft-edged ring with a bright rim and a faint inner fill: shockwaves, telegraphs, slashes (on planar-UV ring / circle geometry).
export const shockTexture = () => canvasTex(128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,0.06)');
  gr.addColorStop(0.62, 'rgba(255,255,255,0.22)');
  gr.addColorStop(0.86, 'rgba(255,255,255,0.75)');
  gr.addColorStop(0.95, 'rgba(255,255,255,1)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
});
