// Badges: kid-friendly milestones. Earned state is saved ({ id: true }); `evaluate` checks everything and returns the newly earned ones.
import { save } from '../save.js';
import { profile } from './progress.js';
import { skinsOwned } from './skins.js';

let flags = null;
const flagStore = () => (flags ??= { ...save.get('flags', {}) });
export const flag = (name) => !!flagStore()[name];
export function setFlag(name) { const f = flagStore(); if (f[name]) return; f[name] = true; save.set('flags', f); }

export const BADGES = [
  { id: 'first-win', icon: '🏆', name: 'First Win', hint: 'Win a match', test: (p) => p.wins >= 1 },
  { id: 'first-unlock', icon: '🔓', name: 'New Friend', hint: 'Unlock a champion', test: (p) => p.paid >= 1 },
  { id: 'first-skin', icon: '🎨', name: 'Fresh Paint', hint: 'Buy a color', test: () => skinsOwned() >= 1 },
  { id: 'matches-10', icon: '🎮', name: 'Regular', hint: 'Play 10 matches', test: (p) => p.matches >= 10 },
  { id: 'wins-5', icon: '⭐', name: 'Winner', hint: 'Win 5 matches', test: (p) => p.wins >= 5 },
  { id: 'level-5', icon: '🚀', name: 'Level 5', hint: 'Reach level 5', test: (p) => p.level >= 5 },
  { id: 'kos-25', icon: '💥', name: 'KO Pro', hint: 'Get 25 KOs', test: (p) => p.kills >= 25 },
  { id: 'win-2v2', icon: '🤝', name: 'Buddy Win', hint: 'Win a 2v2 co-op', test: () => flag('win2v2') },
  { id: 'tutorial', icon: '🎓', name: 'Graduate', hint: 'Finish the tutorial', test: () => flag('tutorial') },
  { id: 'three-stars', icon: '🌟', name: 'Triple Star', hint: 'Win with 3 stars', test: () => flag('threeStar') },
];

let earned = null;
const load = () => (earned ??= (() => { const e = save.get('badges', {}); return e && typeof e === 'object' ? { ...e } : {}; })());
export const resetBadges = () => { earned = null; flags = null; };
export const isEarned = (id) => !!load()[id];
export function evaluate() {
  const p = profile(), e = load(), fresh = [];
  for (const b of BADGES) if (!e[b.id] && b.test(p)) { e[b.id] = true; fresh.push(b); }
  if (fresh.length) save.set('badges', e);
  return fresh;
}
