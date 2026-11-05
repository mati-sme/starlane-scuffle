// Auto-aim: nearest valid enemy by edge distance, searched in priority order.
export const ORDER_HERO = ['heroes', 'minions', 'camps', 'structures'];
export const ORDER_MINION = ['minions', 'heroes', 'structures'];
export const ORDER_TOWER = ['minions', 'heroes'];
const ORDER_REST = ['minions', 'camps', 'structures'];

const lists = {
  heroes: (ctx) => ctx.heroes,
  minions: (ctx) => ctx.minions.list,
  structures: (ctx) => ctx.structures,
  camps: (ctx) => ctx.camps.list,
};

const valid = (e, team) => e.team !== team && e.alive && e.vulnerable !== false && !e.hidden && !e.untarget;

function nearest(list, team, x, z, range) {
  let best = null, bestD = range;
  for (const e of list) {
    if (!valid(e, team)) continue;
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

// Hero priority: the hero that hit us in the last 2 s -> lowest-HP enemy hero -> nearest minion -> structure.
export function pickHeroTarget(ctx, h, range) {
  const a = h.attacker;
  if (a && h.attackerAge < 2 && a.type === 'hero' && valid(a, h.team) && Math.hypot(a.x - h.x, a.z - h.z) - a.radius <= range) return a;
  let best = null, hp = Infinity;
  for (const e of ctx.heroes) {
    if (!valid(e, h.team) || Math.hypot(e.x - h.x, e.z - h.z) - e.radius > range) continue;
    if (e.hp < hp) { best = e; hp = e.hp; }
  }
  return best ?? pickTarget(ctx, h.team, h.x, h.z, range, ORDER_REST);
}

// Held target buttons. 1 = last-hit: the weakest minion in range (then camps); 2 = structure: towers / cores, then minions.
export function pickPrefTarget(ctx, h, range, pref) {
  if (pref === 1) {
    let best = null, hp = Infinity;
    for (const e of ctx.minions.list) {
      if (!valid(e, h.team) || Math.hypot(e.x - h.x, e.z - h.z) - e.radius > range) continue;
      if (e.hp < hp) { best = e; hp = e.hp; }
    }
    return best ?? pickTarget(ctx, h.team, h.x, h.z, range, ['camps', 'structures', 'heroes']);
  }
  return pickTarget(ctx, h.team, h.x, h.z, range, ['structures', 'camps', 'minions', 'heroes']);
}

const STICK = 0.6; // extra reach before a locked target is dropped

// Keep `cur` while it is still a valid enemy in (slightly stretched) range, unless `best` outranks it
// (an enemy champion walked into range, or the target buttons changed).
export function stickyTarget(h, cur, best, range, pref) {
  if (!cur || !best || cur === best) return best;
  if (!valid(cur, h.team) || Math.hypot(cur.x - h.x, cur.z - h.z) - cur.radius > range + STICK) return best;
  if (pref) return pref === 1 ? (cur.type === 'minion' ? (best.type === 'minion' && best.hp < cur.hp * 0.5 ? best : cur) : best) : (cur.type === 'tower' || cur.type === 'core' ? cur : best);
  if (best.type === 'hero' && cur.type !== 'hero') return best;
  if (cur.type === 'hero' && best.type !== 'hero') return cur;
  return cur;
}

const pts = [];

// The enemy within `range` (edge distance) with the most enemies inside `radius` of it (heroes count double).
// Returns { x, z, n, hero, target } where (x, z) is the centroid of that group, or null.
export function bestCluster(ctx, team, x, z, range, radius) {
  pts.length = 0;
  for (const e of ctx.heroes) if (valid(e, team)) pts.push(e, 2);
  for (const e of ctx.minions.list) if (valid(e, team)) pts.push(e, 1);
  for (const e of ctx.structures) if (valid(e, team)) pts.push(e, 1);

  let best = null, bestScore = 0, bx = 0, bz = 0, bn = 0, bhero = false;
  for (let i = 0; i < pts.length; i += 2) {
    const e = pts[i];
    const dist = Math.hypot(e.x - x, e.z - z);
    if (dist - e.radius > range) continue;
    let score = 0, sx = 0, sz = 0, n = 0, hero = false;
    for (let j = 0; j < pts.length; j += 2) {
      const o = pts[j];
      if (Math.hypot(o.x - e.x, o.z - e.z) > radius) continue;
      score += pts[j + 1]; sx += o.x; sz += o.z; n++;
      if (o.type === 'hero') hero = true;
    }
    score -= dist * 0.01;
    if (score > bestScore) { best = e; bestScore = score; bx = sx / n; bz = sz / n; bn = n; bhero = hero; }
  }
  return best ? { x: bx, z: bz, n: bn, hero: bhero, target: best } : null;
}
