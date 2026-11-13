// Player progression: level, XP, coins, unlocked champions. Pure rules + a tiny localStorage-backed store (js/save.js).
// All numbers live here so the economy is easy to tune (and unit-test in Node).
import { save } from '../save.js';

// v10: the 18 champions everyone starts with - several real options per lane role:
// 3 tanks, 2 bruisers, 2 assassins, 3 blasters, 5 shooters (incl. Fennec the scout), 3 supports. The rest unlock with coins.
export const FREE_CHAMPS = ['bulwark', 'mossback', 'magnus', 'torque', 'corsa', 'glint', 'volt', 'cinder', 'nyx', 'prism', 'kade', 'flint', 'rico', 'longshot', 'fennec', 'aria', 'lumen', 'bloom'];

export const PRICE_FIRST = 100, PRICE_STEP = 10, PRICE_MAX = 350;
// Price of the next unlock, from how many champions were already bought with coins (steady: 100, 110, ... capped at 350).
export const unlockPrice = (paidCount) => Math.min(PRICE_MAX, PRICE_FIRST + PRICE_STEP * Math.max(0, paidCount));

export const LEVEL_UP_COINS = 25;
// XP needed to climb from `level` to the next one.
export const xpNeeded = (level) => 80 + 20 * level;

// What a finished match pays. Wins pay about double; stars and takedowns add a modest bonus.
export function matchReward({ win = false, stars = 0, kills = 0 } = {}) {
  const k = Math.max(0, Math.min(10, kills | 0)), s = win ? Math.max(0, Math.min(3, stars | 0)) : 0;
  return { xp: (win ? 40 : 20) + 5 * s + k, coins: (win ? 60 : 30) + 10 * s + Math.min(20, 2 * k) };
}

const fresh = () => ({ level: 1, xp: 0, coins: 0, owned: [], paid: 0, matches: 0, wins: 0, kills: 0, stars: 0 });

function clean(raw) {
  const p = fresh();
  if (!raw || typeof raw !== 'object') return p;
  for (const k of ['level', 'xp', 'coins', 'paid', 'matches', 'wins', 'kills', 'stars']) if (Number.isFinite(raw[k]) && raw[k] >= 0) p[k] = Math.floor(raw[k]);
  p.level = Math.max(1, p.level);
  if (Array.isArray(raw.owned)) p.owned = [...new Set(raw.owned.filter((x) => typeof x === 'string'))];
  return p;
}

let state = null;
export const profile = () => (state ??= clean(save.get('profile')));
const persist = () => save.set('profile', state);
export const resetProfile = (raw) => { state = clean(raw); return state; }; // tests

// Test / support hook: localStorage starlane.unlockAll = true opens every champion.
const unlockAll = () => save.get('unlockAll', false) === true;
export const isOwned = (id) => unlockAll() || FREE_CHAMPS.includes(id) || profile().owned.includes(id);
export const nextPrice = () => unlockPrice(profile().paid);
export const canBuy = (id) => !isOwned(id) && profile().coins >= nextPrice();

// Spend coins on a champion. Returns { ok, price } (ok false if already owned / too poor).
export function buyChampion(id) {
  const p = profile();
  if (isOwned(id)) return { ok: false, price: 0 };
  const price = nextPrice();
  if (p.coins < price) return { ok: false, price };
  p.coins -= price; p.paid++; p.owned.push(id);
  persist();
  return { ok: true, price };
}

export function addCoins(n) { const p = profile(); p.coins += Math.max(0, n | 0); persist(); }

// Apply a finished match (`res` is the Match 'end' payload; myKills = the local hero's takedowns): returns { xp, coins, bonus, levelsGained, level, from, xpIntoLevel, xpToNext } for the UI.
export function awardMatch(res) {
  const p = profile(), kos = Number.isFinite(res.myKills) ? res.myKills : 0, r = matchReward({ win: res.win, stars: res.stars, kills: kos }), from = p.level;
  p.xp += r.xp; p.coins += r.coins;
  p.matches++; if (res.win) p.wins++;
  p.kills += Math.max(0, kos | 0); p.stars += res.win ? Math.max(0, res.stars | 0) : 0;
  let bonus = 0;
  while (p.xp >= xpNeeded(p.level)) { p.xp -= xpNeeded(p.level); p.level++; bonus += LEVEL_UP_COINS; }
  p.coins += bonus;
  persist();
  return { ...r, bonus, from, level: p.level, levelsGained: p.level - from, xpInto: p.xp, xpToNext: xpNeeded(p.level) };
}
