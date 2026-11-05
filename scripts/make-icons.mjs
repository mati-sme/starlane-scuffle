// Generates simple PNG icons / splash with node zlib (no deps): icons/icon-{192,512,1024}.png, icons/splash.png
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const b = Buffer.alloc(12 + d.length); b.writeUInt32BE(d.length, 0); b.write(t, 4); d.copy(b, 8); b.writeUInt32BE(crc(b.subarray(4, 8 + d.length)), 8 + d.length); return b; };
function png(w, h, px) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; for (let x = 0; x < w; x++) { const c = px(x / w, y / h); raw.set(c, y * (w * 4 + 1) + 1 + x * 4); } }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
// dark space gradient + glowing 4-point star (the "starlane") with a diagonal lane
function art(u, v, scale = 1) {
  const bg = mix([6, 10, 22], [24, 20, 60], v);
  const x = (u - 0.5) / scale, y = (v - 0.5) / scale;
  const star = Math.max(0, 1 - Math.pow(Math.abs(x) * 5.2, 0.55) - Math.pow(Math.abs(y) * 5.2, 0.55)) ;
  const r = Math.hypot(x, y), glow = Math.max(0, 1 - r * 2.4) ** 2;
  const lane = Math.max(0, 1 - Math.abs(x - y) * 9) * Math.max(0, 1 - r * 1.8);
  const c = [...bg];
  for (let i = 0; i < 3; i++) c[i] = Math.min(255, c[i] + glow * [60, 160, 255][i] * 0.5 + lane * [255, 190, 60][i] * 0.55 + star * 255);
  return [...c, 255];
}
mkdirSync('icons', { recursive: true });
for (const s of [192, 512, 1024]) writeFileSync(`icons/icon-${s}.png`, png(s, s, (u, v) => art(u, v)));
writeFileSync('icons/splash.png', png(2732, 2732, (u, v) => art(u, v, 2.6)));
