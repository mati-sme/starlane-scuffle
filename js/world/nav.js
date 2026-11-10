// Bot navigation around cover: grid A* over the COVER blocks (inflated by a hero's clearance) + line-of-sight smoothing.
// Pure geometry, no game state, so it can be unit-tested headless. Used by bot.js; heroes still collide via pushOutCover.
import { MAP } from '../config.js';
import { COVER } from './arena.js';

export const CLEAR = 0.75; // clearance from a block face (hero radius ~0.5 and pushOutCover uses 0.8 * radius)
const CELL = 1, X0 = -MAP.heroBound.x, Z0 = -MAP.heroBound.z;
const NX = Math.ceil((MAP.heroBound.x * 2) / CELL) + 1, NZ = Math.ceil((MAP.heroBound.z * 2) / CELL) + 1;

const BOXES = COVER.map((b) => ({ x0: b.x0 - CLEAR, x1: b.x1 + CLEAR, z0: b.z0 - CLEAR, z1: b.z1 + CLEAR }));
const blockedPt = (x, z) => { for (const b of BOXES) if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return true; return false; };
const BLOCK = new Uint8Array(NX * NZ);
for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) BLOCK[i * NZ + j] = blockedPt(X0 + i * CELL, Z0 + j * CELL) ? 1 : 0;

// True when the straight segment (ax, az) -> (bx, bz) stays outside every inflated block (slab test).
export function clearLine(ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  for (const b of BOXES) {
    let t0 = 0, t1 = 1, miss = false;
    for (const [p, d, lo, hi] of [[ax, dx, b.x0, b.x1], [az, dz, b.z0, b.z1]]) {
      if (Math.abs(d) < 1e-9) { if (p <= lo || p >= hi) { miss = true; break; } continue; }
      let a = (lo - p) / d, c = (hi - p) / d;
      if (a > c) [a, c] = [c, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, c);
      if (t0 >= t1) { miss = true; break; }
    }
    if (!miss) return false;
  }
  return true;
}

const cx = (x) => Math.max(0, Math.min(NX - 1, Math.round((x - X0) / CELL)));
const cz = (z) => Math.max(0, Math.min(NZ - 1, Math.round((z - Z0) / CELL)));
// Nearest walkable cell to (x, z) (spiral out; a point just inside an inflated block exits through the closest free cell).
function freeCell(x, z) {
  const i0 = cx(x), j0 = cz(z);
  if (!BLOCK[i0 * NZ + j0]) return [i0, j0];
  for (let r = 1; r < 12; r++) {
    let best = null, bd = Infinity;
    for (let i = i0 - r; i <= i0 + r; i++) for (let j = j0 - r; j <= j0 + r; j++) {
      if (i < 0 || j < 0 || i >= NX || j >= NZ || BLOCK[i * NZ + j]) continue;
      const d = (X0 + i * CELL - x) ** 2 + (Z0 + j * CELL - z) ** 2;
      if (d < bd) { bd = d; best = [i, j]; }
    }
    if (best) return best;
  }
  return [i0, j0];
}

// Minimal binary heap keyed on f.
class Heap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val);
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
    k[i] = key; v[i] = val;
  }
  pop() {
    const k = this.k, v = this.v, top = v[0], lk = k.pop(), lv = v.pop(), n = k.length;
    if (n) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1; if (c >= n) break;
        if (c + 1 < n && k[c + 1] < k[c]) c++;
        if (k[c] >= lk) break;
        k[i] = k[c]; v[i] = v[c]; i = c;
      }
      k[i] = lk; v[i] = lv;
    }
    return top;
  }
}

const G = new Float32Array(NX * NZ), FROM = new Int32Array(NX * NZ), SEEN = new Int32Array(NX * NZ);
let stamp = 0;
const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];

// Waypoints [{x, z}, ...] from (ax, az) to (bx, bz) that never cross cover; the last one is the goal itself.
// A direct line returns just the goal. Always returns at least one point.
export function findPath(ax, az, bx, bz) {
  if (clearLine(ax, az, bx, bz)) return [{ x: bx, z: bz }];
  const [si, sj] = freeCell(ax, az), [ei, ej] = freeCell(bx, bz);
  const S = si * NZ + sj, E = ei * NZ + ej;
  stamp++;
  const open = new Heap();
  G[S] = 0; FROM[S] = -1; SEEN[S] = stamp; open.push(0, S);
  const closed = new Set();
  let found = false;
  while (open.size) {
    const n = open.pop();
    if (closed.has(n)) continue;
    closed.add(n);
    if (n === E) { found = true; break; }
    const i = (n / NZ) | 0, j = n - i * NZ;
    for (const [di, dj, w] of NB) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue;
      const m = ni * NZ + nj;
      if (BLOCK[m] || closed.has(m)) continue;
      if (di && dj && (BLOCK[(i + di) * NZ + j] || BLOCK[i * NZ + j + dj])) continue; // no corner cutting
      const g = G[n] + w;
      if (SEEN[m] === stamp && g >= G[m]) continue;
      SEEN[m] = stamp; G[m] = g; FROM[m] = n;
      open.push(g + Math.hypot(ni - ei, nj - ej), m);
    }
  }
  if (!found) return [{ x: bx, z: bz }];
  const cells = [];
  for (let n = E; n !== -1; n = FROM[n]) { const i = (n / NZ) | 0; cells.push({ x: X0 + i * CELL, z: Z0 + (n - i * NZ) * CELL }); }
  cells.reverse();
  cells.push({ x: bx, z: bz });
  // String pulling: skip any waypoint the walker can already see past.
  const out = [];
  let px = ax, pz = az, k = 0;
  while (k < cells.length) {
    let far = k;
    for (let m = cells.length - 1; m > k; m--) if (clearLine(px, pz, cells[m].x, cells[m].z)) { far = m; break; }
    out.push(cells[far]); px = cells[far].x; pz = cells[far].z; k = far + 1;
  }
  return out;
}

// A free point up to `dist` away in direction angle `a` with a clear line to it (used for stuck escapes); the origin if none.
export function freePoint(x, z, a, dist) {
  for (let d = dist; d > 1; d -= 1) {
    const px = Math.max(X0, Math.min(-X0, x + Math.cos(a) * d)), pz = Math.max(Z0, Math.min(-Z0, z + Math.sin(a) * d));
    if (!blockedPt(px, pz) && clearLine(x, z, px, pz)) return { x: px, z: pz };
  }
  return { x, z };
}
