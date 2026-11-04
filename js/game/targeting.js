// Auto-aim: nearest valid enemy by edge distance, searched in priority order.
export const ORDER_HERO = ['heroes', 'minions', 'structures'];
export const ORDER_MINION = ['minions', 'heroes', 'structures'];
export const ORDER_TOWER = ['minions', 'heroes'];

const lists = {
  heroes: (ctx) => ctx.heroes,
  minions: (ctx) => ctx.minions.list,
  structures: (ctx) => ctx.structures,
};

function nearest(list, team, x, z, range) {
  let best = null, bestD = range;
  for (const e of list) {
    if (e.team === team || !e.alive || e.vulnerable === false) continue;
    const d = Math.hypot(e.x - x, e.z - z) - e.radius;
    if (d <= bestD) { best = e; bestD = d; }
  }
  return best;
}

// ctx: { heroes, minions: { list }, structures }
export function pickTarget(ctx, team, x, z, range, order) {
  for (const kind of order) {
    const t = nearest(lists[kind](ctx), team, x, z, range);
    if (t) return t;
  }
  return null;
}
