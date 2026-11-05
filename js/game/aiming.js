// How each skill is aimed: the shape of its drag preview and the clamp for the aimed point.
// kind -> { type: 'line' | 'point' | 'cone' | 'self', range, width, radius, arc } (ab is the rank-resolved skill).
const LINE = new Set(['dash', 'bolt', 'hook', 'beam', 'blink', 'turret']);
const POINT = new Set(['leap', 'blast', 'rain', 'trap']);

export function aimShape(ab) {
  const range = ab.range ?? 6;
  if (ab.kind === 'dash' && ab.chain) return { type: 'self', range: ab.range, radius: ab.range };
  if (ab.kind === 'blast' && ab.target) return { type: 'self', range, radius: range };
  if (ab.kind === 'field') {
    if (ab.wall) return { type: 'line', range: 3 + ab.wall / 2, width: ab.wall, wall: true };
    if (ab.place === 'ally') return { type: 'point', range, radius: ab.r };
    return { type: 'self', range: ab.r, radius: ab.r };
  }
  if (ab.kind === 'cone') return { type: 'cone', range, arc: ab.arc ?? 90 };
  if (LINE.has(ab.kind)) return { type: 'line', range, width: ab.width ?? 1.2 };
  if (POINT.has(ab.kind)) return { type: 'point', range, radius: ab.radius ?? ab.blastR ?? 1.5 };
  return { type: 'self', range: ab.radius ?? ab.allyR ?? 3, radius: ab.radius ?? ab.allyR ?? 3 };
}

// Does this skill take a direction / point at all? (self skills cast on tap)
export const aimable = (ab) => aimShape(ab).type !== 'self';
