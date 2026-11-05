// 5v5 line-ups. Both teams always get one blaster, one shooter and one support: for each of those roles the pair
// is split between the teams (the player's pick stays on Sunny, Gloom gets its partner). Melee slots are random.
import { HEROES, ROSTER } from '../heroes/index.js';

const CORE_ROLES = ['blaster', 'shooter', 'support'];
const MELEE = ['tank', 'bruiser', 'assassin'];
const shuffle = (a) => [...a].sort(() => Math.random() - 0.5);

// forced: optional ids from ?bots= (up to 4 allies then 5 enemies); the rest is composed. -> { blue: [5], red: [5] }
export function composeTeams(playerId, forced = []) {
  const role = (id) => HEROES[id].role;
  const blue = [playerId], red = [];
  for (const r of CORE_ROLES) {
    const pair = shuffle(ROSTER.filter((id) => role(id) === r));
    if (role(playerId) === r) red.push(pair.find((id) => id !== playerId));
    else { blue.push(pair[0]); red.push(pair[1]); }
  }
  const melee = shuffle(ROSTER.filter((id) => MELEE.includes(role(id)) && id !== playerId));
  while (blue.length < 5) blue.push(melee.pop());
  while (red.length < 5) red.push(melee.pop());

  const ok = forced.filter((k) => Object.hasOwn(HEROES, k));
  const mix = (head, tail) => { // forced heroes first, then the composed ones that are not already on the team
    const team = [...new Set(head)].slice(0, 5);
    for (const k of tail) if (team.length < 5 && !team.includes(k)) team.push(k);
    for (const k of shuffle(ROSTER)) if (team.length < 5 && !team.includes(k)) team.push(k);
    return team;
  };
  const allies = ok.slice(0, 4).filter((k) => k !== playerId), foes = ok.slice(4, 9);
  return { blue: mix([playerId, ...allies], blue), red: mix(foes, red) };
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
// support first, then melee) with champions not already taken. -> { blue: [5], red: [5] }
export function composeOnline(picks, rng = Math.random) {
  const shuf = (a) => [...a].sort(() => rng() - 0.5);
  const role = (id) => HEROES[id].role;
  const teams = [[], []], used = new Set();
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
