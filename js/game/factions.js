// Four factions (12 champions each) with one small combat passive apiece. Pure data + helpers; combat.js / match.js call the hooks.
// Every roster id is listed here (including champions that land from other branches); unknown ids fall back to a stable hash.

export const FACTIONS = {
  light: { id: 'light', name: 'Light', color: '#FFD84A', icon: '☀', passive: 'Sunny Bond', blurb: 'Heals a little when a friend is close.' },
  dark: { id: 'dark', name: 'Dark', color: '#A06BFF', icon: '☾', passive: 'Sneaky Edge', blurb: 'Hits harder on enemies who are all alone.' },
  water: { id: 'water', name: 'Water', color: '#3DB8FF', icon: '💧', passive: 'Chilly Touch', blurb: 'Hits can slow down enemy heroes.' },
  nature: { id: 'nature', name: 'Nature', color: '#6BD35B', icon: '🍃', passive: 'Leaf Mend', blurb: 'Heals a little in bushes and near the jungle.' },
};
export const FACTION_IDS = Object.keys(FACTIONS);

const ROSTER = {
  light: ['lumen', 'prism', 'solace', 'beacon', 'aurora', 'hymn', 'aria', 'corsa', 'bulwark', 'glint', 'cinder', 'embermaw'],
  dark: ['nyx', 'vesper', 'shade', 'wisp', 'mirage', 'comet', 'magnus', 'razor', 'basilisk', 'pounce', 'kade', 'ravel'],
  water: ['rime', 'volt', 'zephyr', 'tempo', 'rico', 'tidewall', 'longshot', 'brine', 'keel', 'anvil', 'cyclone', 'harpoon'],
  nature: ['mossback', 'tremor', 'bloom', 'petal', 'grove', 'mycel', 'quill', 'granite', 'loom', 'rotor', 'flint', 'torque'],
};
const OF = {};
for (const f of FACTION_IDS) for (const id of ROSTER[f]) OF[id] = f;

export function factionOf(id) {
  if (OF[id]) return OF[id];
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return FACTION_IDS[h % FACTION_IDS.length];
}
export const factionDef = (id) => FACTIONS[factionOf(id)];

// Passive numbers (kept small on purpose).
export const PASSIVE = {
  lightHeal: 0.015, lightRange: 7, // max-HP fraction per second with a friendly hero nearby
  darkBonus: 0.08, darkRange: 8, // extra damage vs a hero with no friend nearby
  waterSlow: 0.6, waterIcd: 2.2, // seconds of slow, and the pause before it can slow again
  natureHeal: 0.02, natureCamp: 8, // max-HP fraction per second in a bush or near a camp
};

// Season strength: favored faction +15% dealt / -8% taken, opposed faction the inverse.
export const SEASON_MUL = { favOut: 1.15, favIn: 0.92, badOut: 0.87, badIn: 1.08 };

// Called once per frame on the host for every hero (see Match.update). `near(h, r)` tells if a friendly hero is within r.
export function tickFaction(h, ctx, dt, inBrush) {
  if (!h.alive) { h.isolated = false; return; }
  const f = h.faction ?? (h.faction = factionOf(h.def.id));
  let friend = false;
  for (const o of ctx.heroes) {
    if (o !== h && o.team === h.team && o.alive && Math.hypot(o.x - h.x, o.z - h.z) < PASSIVE.lightRange) { friend = true; break; }
  }
  h.isolated = !friend;
  let heal = 0;
  if (f === 'light' && friend) heal = PASSIVE.lightHeal;
  else if (f === 'nature') {
    let near = inBrush(h.x, h.z);
    if (!near) for (const c of ctx.camps.list) if (c.alive && Math.hypot(c.x - h.x, c.z - h.z) < PASSIVE.natureCamp) { near = true; break; }
    if (near) heal = PASSIVE.natureHeal;
  }
  if (heal && h.hp < h.maxHp) h.hp = Math.min(h.maxHp, h.hp + h.maxHp * heal * dt);
  if (h.chillCd > 0) h.chillCd -= dt;
}

// Season out/in multipliers for a hero (1 when nothing is active or the faction is neutral).
export function seasonMods(h, season) {
  const e = season && SEASON_EFFECT[season];
  if (!e) return { out: 1, inn: 1, state: 0 };
  const f = h.faction ?? (h.faction = factionOf(h.def.id));
  if (e.up === f) return { out: SEASON_MUL.favOut, inn: SEASON_MUL.favIn, state: 1 };
  if (e.down === f) return { out: SEASON_MUL.badOut, inn: SEASON_MUL.badIn, state: -1 };
  return { out: 1, inn: 1, state: 0 };
}
export const SEASON_EFFECT = {
  snow: { up: 'dark', down: 'light' },
  heat: { up: 'light', down: 'dark' },
  storm: { up: 'water', down: 'nature' },
  bloom: { up: 'nature', down: 'water' },
};

// Per-hit factor from the attacker's faction passive (hero -> hero only), plus the Water slow. Called from dealDamage.
export function hitMul(src, t) {
  if (src?.type !== 'hero' || t.type !== 'hero' || !src.faction) return 1;
  if (src.faction === 'dark' && t.isolated) return 1 + PASSIVE.darkBonus;
  if (src.faction === 'water' && !(t.chillCd > 0)) {
    if (!(t.slow > PASSIVE.waterSlow)) t.slow = PASSIVE.waterSlow;
    t.chillCd = PASSIVE.waterIcd;
  }
  return 1;
}
