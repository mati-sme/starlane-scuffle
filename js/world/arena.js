// Arena layout built once from the quadrant data in config.js: mirrored cover / brush / camps, per-team lane paths,
// structure spots, and the cheap geometry helpers (circle push-out, brush test) shared by heroes, minions and bots.
import { ARENA } from '../config.js';

const mirror4 = (list, fn) => list.flatMap((r) => [[1, 1], [-1, 1], [1, -1], [-1, -1]].map(([sx, sz]) => fn(r, sx, sz)));
const box = (cx, cz, w, d) => ({ cx, cz, w, d, x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 });
const q = (r, sx, sz) => box(r[0] * sx, r[1] * sz, r[2], r[3]);

export const COVER = mirror4(ARENA.cover, q);
export const BRUSH = mirror4(ARENA.brush, q);
export const POCKETS = mirror4(ARENA.pockets, q);
export const CAMP_SPOTS = mirror4(ARENA.camps, (r, sx, sz) => ({ x: r[0] * sx, z: r[1] * sz }));

const own = (team, x) => (team === 0 ? x : -x);
// Lane paths per team in march order (team 1 walks them reversed) ending at the enemy core, with cumulative length.
export const PATHS = [0, 1].map((team) => ARENA.lanes.map((lane) => {
  const pts = (team === 0 ? lane : [...lane].reverse()).map(([x, z]) => ({ x, z }));
  pts.push({ x: own(1 - team, ARENA.core[0]), z: ARENA.core[1] });
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  return { pts, cum };
}));

export const structSpot = (team, tier, idx) => {
  const [x, z] = tier === 'core' ? ARENA.core : tier === 'outer' ? ARENA.outer[idx] : ARENA.guard[idx];
  return { x: own(team, x), z };
};
export const fountain = (team) => ({ x: own(team, ARENA.fountain[0]), z: ARENA.fountain[1] });
export const padPos = (team, slot) => { const [x, z] = ARENA.pads[slot % ARENA.pads.length]; return { x: own(team, x), z }; };

// Push a circle entity (x, z, radius) out of every cover block.
export function pushOutCover(e, r = e.radius ?? 0.5) {
  for (const b of COVER) {
    if (e.x + r <= b.x0 || e.x - r >= b.x1 || e.z + r <= b.z0 || e.z - r >= b.z1) continue;
    const cx = Math.max(b.x0, Math.min(e.x, b.x1)), cz = Math.max(b.z0, Math.min(e.z, b.z1));
    const dx = e.x - cx, dz = e.z - cz, d = Math.hypot(dx, dz);
    if (d >= r) continue;
    if (d < 1e-4) { // centre inside the block: leave through the nearest face
      const l = e.x - b.x0, rr = b.x1 - e.x, t = e.z - b.z0, bt = b.z1 - e.z, m = Math.min(l, rr, t, bt);
      if (m === l) e.x = b.x0 - r; else if (m === rr) e.x = b.x1 + r; else if (m === t) e.z = b.z0 - r; else e.z = b.z1 + r;
      continue;
    }
    e.x = cx + (dx / d) * r;
    e.z = cz + (dz / d) * r;
  }
}

export const inCover = (x, z) => COVER.some((b) => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1);

export function inBrush(x, z) {
  for (const b of BRUSH) if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return true;
  return false;
}

// Which lane (0 top, 1 mid, 2 bot) a point is closest to, by z band.
export const laneOf = (z) => (z < -19 ? 0 : z > 19 ? 2 : 1);
