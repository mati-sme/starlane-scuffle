// Line-ups of 1-5 per side (default 5v5). Both teams get one blaster, one shooter and one support where the roster allows: each role's pair
// is split between the teams (the player's pick stays on Sunny, Gloom gets its partner). Melee slots are random.
import { HEROES, ROSTER } from '../heroes/index.js';

const CORE_ROLES = ['blaster', 'shooter', 'support'];
const MELEE = ['tank', 'bruiser', 'assassin'];
const shuffle = (a) => [...a].sort(() => Math.random() - 0.5);

// forced: optional ids from ?bots= (the player's allies first, then the enemies); the rest is composed. banned: ids nobody may play.
// size: players per team [sunny, gloom]; side: the team the player leads. Every champion appears once across both teams.
// -> { blue, red } (the player is first on their side)
export function composeTeams(playerId, forced = [], banned = [], size = [5, 5], side = 0) {
  const role = (id) => HEROES[id].role;
  const used = new Set([playerId, ...banned]);
  const blue = side === 0 ? [playerId] : [], red = side === 1 ? [playerId] : [];
  const [own, foe] = side === 0 ? [blue, red] : [red, blue];
  const ok = forced.filter((k) => Object.hasOwn(HEROES, k));
  const seed = (team, ids) => { for (const k of ids) if (team.length < size[team === blue ? 0 : 1] && !used.has(k)) { team.push(k); used.add(k); } };
  seed(own, ok.slice(0, size[side] - 1));
  seed(foe, ok.slice(size[side] - 1));
  const take = (team, pool) => {
    const id = shuffle(pool.filter((k) => !used.has(k)))[0];
    if (id) { team.push(id); used.add(id); }
    return !!id;
  };
  const cap = (team) => size[team === blue ? 0 : 1];
  for (const r of CORE_ROLES) {
    for (const team of [blue, red]) if (team.length < cap(team) && !team.some((id) => role(id) === r)) take(team, ROSTER.filter((id) => role(id) === r));
  }
  for (const team of [blue, red]) {
    while (team.length < cap(team) && take(team, ROSTER.filter((id) => MELEE.includes(role(id))))) { /* fill melee */ }
    while (team.length < cap(team) && take(team, ROSTER)) { /* anything left */ }
  }
  return { blue, red };
}

// Deterministic RNG so host and guest compose the same bots from the room seed.
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Online: humans [{ team, hero }] come first on their team, in order; bots fill each side up to size[team] (at least the humans on it;
// a blaster, shooter and support first, then melee) with champions not already taken or banned. -> { blue, red }
export function composeOnline(picks, rng = Math.random, banned = [], size = [5, 5]) {
  const shuf = (a) => [...a].sort(() => rng() - 0.5);
  const role = (id) => HEROES[id].role;
  const teams = [[], []], used = new Set(banned);
  for (const p of picks) { teams[p.team].push(p.hero); used.add(p.hero); }
  const take = (team, pool) => {
    const id = shuf(pool.filter((k) => !used.has(k)))[0];
    if (id) { team.push(id); used.add(id); }
    return !!id;
  };
  teams.forEach((team, t) => {
    const n = Math.max(size[t], team.length);
    for (const r of CORE_ROLES) if (team.length < n && !team.some((id) => role(id) === r)) take(team, ROSTER.filter((id) => role(id) === r));
    while (team.length < n && take(team, ROSTER.filter((id) => MELEE.includes(role(id))))) { /* fill melee */ }
    while (team.length < n && take(team, ROSTER)) { /* anything left */ }
  });
  return { blue: teams[0], red: teams[1] };
}
