// Match setup: team sizes (1-5 per side), which side the player is on, and a difficulty per bot slot.
// Plain JSON so the host can send it through the room: { size: [sunny, gloom], side: 0 | 1, diff: [[x5], [x5]] } where diff[team][i]
// is the level of the champion at index i of that team (the player / humans sit first on their team and ignore theirs).
export const LEVELS = ['easy', 'mid', 'hard'];
export const MAX_TEAM = 5;

export const defaultSetup = () => ({ size: [MAX_TEAM, MAX_TEAM], side: 0, diff: [Array(MAX_TEAM).fill('mid'), Array(MAX_TEAM).fill('mid')], mode: 'normal' });

// Anything missing or malformed falls back to today's 5v5 Mid.
export function cleanSetup(raw) {
  const out = defaultSetup();
  if (!raw || typeof raw !== 'object') return out;
  if (Array.isArray(raw.size)) out.size = [0, 1].map((t) => Math.min(MAX_TEAM, Math.max(1, Math.round(+raw.size[t]) || MAX_TEAM)));
  if (raw.side === 1) out.side = 1;
  if (Array.isArray(raw.diff)) for (const t of [0, 1]) for (let i = 0; i < MAX_TEAM; i++) { const l = raw.diff[t]?.[i]; if (LEVELS.includes(l)) out.diff[t][i] = l; }
  if (raw.mode === 'ranked' || raw.mode === 'coop' || raw.mode === 'normal') out.mode = raw.mode;
  return out;
}

// Global preset: every bot (the human slot too, harmlessly) gets `level`.
export function applyPreset(setup, level) {
  for (const t of [0, 1]) setup.diff[t].fill(level);
  return setup;
}

// The one level every bot shares, or null when they differ.
export function presetOf(setup) {
  const all = setup.diff.flatMap((d, t) => d.slice(0, setup.size[t]).filter((_, i) => !(t === setup.side && i === 0)));
  return all.length && all.every((l) => l === all[0]) ? all[0] : all.length ? null : 'mid';
}

export const summary = (setup, preset = presetOf(setup)) => `${setup.size[0]} v ${setup.size[1]} · ${preset ? preset[0].toUpperCase() + preset.slice(1) : 'Mixed'}`;
