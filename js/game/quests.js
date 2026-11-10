// Daily quests: 3 per local calendar day, coin rewards, progress saved. Pure rules + save.js storage.
import { save } from '../save.js';

// stat = which per-match number advances the quest; goal = how many to finish.
export const POOL = [
  { id: 'play1', text: 'Play a match', stat: 'played', goal: 1, coins: 30 },
  { id: 'play2', text: 'Play 2 matches', stat: 'played', goal: 2, coins: 40 },
  { id: 'win1', text: 'Win a match', stat: 'wins', goal: 1, coins: 50 },
  { id: 'kos3', text: 'Get 3 KOs', stat: 'kos', goal: 3, coins: 40 },
  { id: 'tower1', text: 'Destroy a tower', stat: 'towers', goal: 1, coins: 40 },
  { id: 'stars2', text: 'Earn 2 stars', stat: 'stars', goal: 2, coins: 50 },
];
const BY_ID = Object.fromEntries(POOL.map((q) => [q.id, q]));

export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Same day => same three quests: one "play", one "win/stars", one "action" (KOs / tower), picked by a date hash.
export function pickForDay(key) {
  let h = 0; for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const pick = (ids) => ids[h++ % ids.length];
  return [pick(['play1', 'play2']), pick(['win1', 'stars2']), pick(['kos3', 'tower1'])];
}

const fresh = (key) => ({ day: key, list: pickForDay(key).map((id) => ({ id, prog: 0, done: false })) });
let state = null;
export function quests(now = new Date()) {
  const key = dayKey(now);
  if (!state) { const s = save.get('quests'); state = s && Array.isArray(s.list) && typeof s.day === 'string' ? s : null; }
  if (!state || state.day !== key) { state = fresh(key); save.set('quests', state); } // a new local day: new quests
  return state;
}
export const resetQuests = () => { state = null; };
export const view = (now) => quests(now).list.map((q) => ({ ...BY_ID[q.id], prog: Math.min(q.prog, BY_ID[q.id].goal), done: q.done }));

// Apply a finished match. Returns the quests completed by it: [{ id, text, coins }] (caller pays the coins).
export function progressMatch(res, now = new Date()) {
  const s = quests(now), done = [];
  const gain = { played: 1, wins: res.win ? 1 : 0, kos: Math.max(0, res.myKills | 0), towers: Math.max(0, res.destroyed?.[res.team ?? 0] | 0), stars: res.win ? Math.max(0, res.stars | 0) : 0 };
  for (const q of s.list) {
    if (q.done) continue;
    const def = BY_ID[q.id];
    q.prog += gain[def.stat] ?? 0;
    if (q.prog >= def.goal) { q.done = true; done.push({ id: q.id, text: def.text, coins: def.coins }); }
  }
  save.set('quests', s);
  return done;
}
