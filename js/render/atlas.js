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
