// 5v5 line-ups. Both teams get one blaster, one shooter and one support where the roster allows: each role's pair
// is split between the teams (the player's pick stays on Sunny, Gloom gets its partner). Melee slots are random.
import { HEROES, ROSTER } from '../heroes/index.js';

const CORE_ROLES = ['blaster', 'shooter', 'support'];
const MELEE = ['tank', 'bruiser', 'assassin'];
const shuffle = (a) => [...a].sort(() => Math.random() - 0.5);

// forced: optional ids from ?bots= (up to 4 allies then 5 enemies); the rest is composed. banned: ids nobody may play.
// Every champion appears once across both teams. -> { blue: [5], red: [5] }
export function composeTeams(playerId, forced = [], banned = []) {
  const role = (id) => HEROES[id].role;
  const used = new Set([playerId, ...banned]);
  const blue = [playerId], red = [];
  const ok = forced.filter((k) => Object.hasOwn(HEROES, k));
  const seed = (team, ids) => { for (const k of ids) if (team.length < 5 && !used.has(k)) { team.push(k); used.add(k); } };
  seed(blue, ok.slice(0, 4));
  seed(red, ok.slice(4, 9));
  const take = (team, pool) => {
    const id = shuffle(pool.filter((k) => !used.has(k)))[0];
    if (id) { team.push(id); used.add(id); }
    return !!id;
  };
  for (const r of CORE_ROLES) {
    for (const team of [blue, red]) if (team.length < 5 && !team.some((id) => role(id) === r)) take(team, ROSTER.filter((id) => role(id) === r));
  }
  for (const team of [blue, red]) {
    while (team.length < 5 && take(team, ROSTER.filter((id) => MELEE.includes(role(id))))) { /* fill melee */ }
    while (team.length < 5 && take(team, ROSTER)) { /* anything left */ }
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

// Online 5v5: humans [{ team, hero }] come first on their team, in order; bots fill each side (a blaster, shooter and
// support first, then melee) with champions not already taken or banned. -> { blue: [5], red: [5] }
export function composeOnline(picks, rng = Math.random, banned = []) {
  const shuf = (a) => [...a].sort(() => rng() - 0.5);
  const role = (id) => HEROES[id].role;
  const teams = [[], []], used = new Set(banned);
  for (const p of picks) { teams[p.team].push(p.hero); used.add(p.hero); }
  const take = (team, pool) => {
    const id = shuf(pool.filter((k) => !used.has(k)))[0];
    if (id) { team.push(id); used.add(id); }
    return !!id;
  };
  for (const team of teams) {
    for (const r of CORE_ROLES) if (team.length < 5 && !team.some((id) => role(id) === r)) take(team, ROSTER.filter((id) => role(id) === r));
    while (team.length < 5 && take(team, ROSTER.filter((id) => MELEE.includes(role(id))))) { /* fill melee */ }
    while (team.length < 5 && take(team, ROSTER)) { /* anything left */ }
  }
  return { blue: teams[0], red: teams[1] };
}
