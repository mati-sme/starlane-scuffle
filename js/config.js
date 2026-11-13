// Single source of truth: palette, tuning numbers, budgets.

export const PAL = { // grounded sci-fi: slightly desaturated neon, deeper shadows; team blue/red stay saturated enough to read
  voidTop: 0x05080F, voidBottom: 0x172238,
  nebulaA: 0x2A4FA8, nebulaB: 0x1A9E94,
  star: 0xE2EEF8, gold: 0xF0BE48,
  grassLight: 0x5C7A4C, grassDark: 0x33502F, // v10: brighter spring meadow + warm sandstone lanes (the bigger v10 arena)
  lane: 0x7D766A, laneGlow: 0x6FCBE4,
  cliffLight: 0x6A6A70, cliffDark: 0x24252D,
  sunny: 0x3A9BF0, sunnyDeep: 0x1D57A3,
  gloom: 0xF04C5A, gloomDeep: 0xA02436,
  heal: 0x42D592, shield: 0x8AD6F2,
  ink: 0x0D1017, fog: 0x141B28,
};

// Team 0 = Sunny (player side, marches +x), team 1 = Gloom (marches -x).
export const TEAM = [
  { main: PAL.sunny, deep: PAL.sunnyDeep, dir: 1 },
  { main: PAL.gloom, deep: PAL.gloomDeep, dir: -1 },
];
export const sideX = (team, d) => (team === 0 ? -d : d);

export const GROUND = 0.08;
export const SIM_STEP = 1 / 30;

// v9.1: the arena is 0.7x the old 180x112 map (126x78): shorter lanes, quicker rotations. All quadrant data below is authored at the old size and scaled once here.
// v10: back up to 0.85x (153x94) - a bigger arena with the blocking stones removed.
export const MAP_SCALE = 0.85;
const S = MAP_SCALE, sp = ([x, z, ...r]) => [+(x * S).toFixed(2), +(z * S).toFixed(2), ...r], sl = (l) => l.map(sp);
const sbox = ([cx, cz, w, d]) => [+(cx * S).toFixed(2), +(cz * S).toFixed(2), +Math.max(1.6, w * S).toFixed(2), +Math.max(1.6, d * S).toFixed(2)];
export const MAP = { halfX: 76, halfZ: 47, heroX: 68, heroBound: { x: 74, z: 45 }, laneW: 9 };

// Quadrant data (x < 0, z < 0), mirrored 4x by world/arena.js. Team 0 (Sunny) owns -x; the top lane is z < 0.
const ARENA_RAW = {
  lanes: [ // waypoints run Sunny base -> Gloom base
    [[-70, -6], [-62, -20], [-52, -38], [52, -38], [62, -20], [70, -6]],
    [[-70, 0], [70, 0]],
    [[-70, 6], [-62, 20], [-52, 38], [52, 38], [62, 20], [70, 6]],
  ],
  outer: [[-34, -38], [-30, 0], [-34, 38]], // per lane (top / mid / bot), then inner and inhibitor nearer the base
  inner: [[-48, -38], [-44, 0], [-48, 38]],
  inhib: [[-60, -24], [-57, 0], [-60, 24]],
  guard: [[-62, -7], [-62, 7]],
  core: [-74, 0],
  fountain: [-84, 0], fountainR: 6,
  pads: [[-80, -7], [-82, -3.5], [-78, 0], [-82, 3.5], [-80, 7]],
  cover: [], // v10: no blocking stones - every lane and jungle path is clear to walk (was 6 rock / crate walls per quadrant)
  brush: [[-26, -34, 8, 4], [-40, -14, 6, 6], [-10, -6, 6, 3], [-3, -22, 5, 5], [-44, -24, 8, 3], [-18, -14, 5, 4]], // cx, cz, w, d
  pockets: [[-30, -19, 44, 22]], // jungle: cx, cz, w, d (quadrant)
  camps: [[-30, -18]],
  pits: [[0, 29, 'dragon'], [0, -29, 'titan']], // epic boss pits on the centre line (x, z); the Herald shares the Titan pit
  brushSeeRange: 3.5, brushRevealT: 1.2,
};
export const ARENA = {
  lanes: ARENA_RAW.lanes.map(sl), outer: sl(ARENA_RAW.outer), inner: sl(ARENA_RAW.inner), inhib: sl(ARENA_RAW.inhib), guard: sl(ARENA_RAW.guard),
  core: sp(ARENA_RAW.core), fountain: sp(ARENA_RAW.fountain), fountainR: 5, pads: sl(ARENA_RAW.pads),
  cover: ARENA_RAW.cover.map(sbox), brush: ARENA_RAW.brush.map(sbox), pockets: ARENA_RAW.pockets.map(sbox), camps: sl(ARENA_RAW.camps),
  pits: [[0, 21, 'dragon'], [0, -21, 'titan']], // pits sit closer to the lanes than a plain 0.7 scale would put them (clear of the side lanes)
  brushSeeRange: 3.0, brushRevealT: 1.2,
};

export const MATCH = {
  waveEvery: 20, stormWaveEvery: 15, firstWave: 15, siegeFrom: 90, siegeEvery: 2,
  // v10: no time limit any more - a match ends ONLY when a Nexus falls. Overdrive at 9:00 (extra siege blob per wave, 2.5x structure damage, 1.5x XP, half respawn)
  // keeps long games moving toward a Nexus.
  storm: 540, tieBreak: Infinity, stormStructMul: 2.5, stormXpMul: 1.5, stormSiege: 1,
  respawnBase: 4, respawnPerLevel: 1.2, starTime: 600,
  campFirst: 60, campRespawn: 75,
};

// blobling = trooper, zapper = gunner, bigblob = siege.
export const UNITS = {
  blobling: { hp: 150, speed: 3.2, range: 1.2, dmg: 14, cd: 1.0, radius: 0.55, aggro: 6, structMul: 1.3, hitY: 0.6, barY: 1.6, max: 36 },
  zapper: { hp: 100, speed: 3.0, range: 5.5, dmg: 16, cd: 1.3, radius: 0.45, aggro: 7, structMul: 1.3, hitY: 1.3, barY: 2.5, max: 12, ranged: true },
  bigblob: { hp: 520, speed: 2.6, range: 6, dmg: 30, cd: 1.6, radius: 1.0, aggro: 7, structMul: 2.5, hitY: 1.1, barY: 3.0, max: 6, ranged: true },
};

export const CAMP = { hp: 900, dmg: 30, cd: 1.2, range: 5, leash: 8, xp: 75, xpRange: 12, heal: 0.25, radius: 1.3, buffT: 12 };

export const HERO = {
  // v10: level cap 15. Q W E rank 1-5, R rank 1-3. Q / W / E start at rank 1; rank 2 needs Lv 2, 3 Lv 4, 4 Lv 7, 5 Lv 10.
  // R rank 1 is free at Lv 4, R2 needs Lv 9, R3 Lv 13. 1 point per level from Lv 2 = 14 points = 12 normal ranks + R2 + R3.
  maxLevel: 15, ultLevel: 4, dmgPerLevel: 0.04, hpLvMul: 0.75, maxRank: [5, 5, 5, 3],
  gate: (slot, rank) => (slot < 3 ? [0, 0, 2, 4, 7, 10][rank] : [0, 4, 9, 13][rank]),
  xpNeed: (lv) => 80 + 24 * (lv - 1) + 5 * (lv - 1) ** 2, // ~2000 total to Lv 9, ~7400 to Lv 15
  xpRange: 9, xpHeroRange: 14, xp: { blobling: 14, zapper: 16, bigblob: 34, hero: 60, heroPerLevel: 10 },
  baseHeal: { rate: 0.2 }, // fountain: 20% max HP / s (full heal in ~5 s)
  // v9 out-of-combat regen: base + perLevel HP/s once `delay` s have passed without taking damage (was a flat 40 HP/s after 3 s). Going home still matters.
  regen: { base: 3, perLevel: 0.5, delay: 6 },
  structMul: 1.3, // champions deal +30% to towers / the Nexus so they can really finish a base
};

// Bot difficulty, per bot (see game/setup.js): react = seconds between decisions, dmg = outgoing damage, cast = chance a wanted skill is
// actually cast, retreat / crowd = HP fraction that sends it home (alone / when crowdN+ foes are close), aggro = how far it notices heroes,
// power = HP ratio it wants before it fights. Mid is the classic feel; Easy is gentle enough for a 4-6 year old.
export const DIFFICULTY = {
  easy: { name: 'Easy', react: 1.2, dmg: 0.7, cast: 0.3, retreat: 0.55, crowd: 0.8, crowdN: 1, aggro: 6.5, power: 1.5 },
  mid: { name: 'Mid', react: 0.45, dmg: 1, cast: 1, retreat: 0.35, crowd: 0.5, crowdN: 2, aggro: 10, power: 0.8 },
  hard: { name: 'Hard', react: 0.3, dmg: 1.1, cast: 1, retreat: 0.3, crowd: 0.45, crowdN: 2, aggro: 11, power: 0.7 },
};
export const BOT = { returnHp: 0.9, groupDeficit: 2 };

// Tiers per lane: outer -> inner -> inhib (each needs the one before it down), then two guardians and the Nexus. 3 x 3 lane towers + 2 guardians per team.
export const TIERS = ['outer', 'inner', 'inhib'];
export const TOWER = { range: 9, cd: 1.1, radius: 1.5, hp: { outer: 1700, inner: 1800, inhib: 1900, guard: 2200 }, armor: { outer: 8, inner: 10, inhib: 12, guard: 14 }, heroDmg: 70, heroPct: 0.06, minionDmg: 100, shield: 0.5, shieldR: 10 };
// The Nexus: 2.5x a guardian's health plus heavy armor, its own laser, and a shield pulse the first time it is hit once exposed.
export const CORE = { hp: 5000, armor: 20, radius: 2.4, range: 13, cd: 1.2, heroDmg: 100, heroPct: 0.08, minionDmg: 80, pulse: 3, pulseR: 9, pulseDr: 0.5 };

// Gold: per-kill rewards, a small passive trickle, and the starting purse (auto-buys boots at the fountain).
export const GOLD = {
  start: 300, trickle: 1.2, minion: { blobling: 17, zapper: 20, bigblob: 50 }, minionShare: 0.35,
  camp: 50, campTeam: 20, hero: 260, assist: 90, assistR: 14, tower: { outer: 130, inner: 150, inhib: 175, guard: 200 }, towerTeam: 40, towerR: 28,
};

// Epic bosses (neutral camp-type entities; see world/camps.js). first / respawn in seconds; buffs in match.js.
export const BOSS = {
  dragon: { name: 'Dragon', hp: 3200, armor: 10, dmg: 55, cd: 1.7, range: 6, leash: 6, radius: 2.2, regen: 0.04, slam: { every: 7, r: 5.5, dmg: 70 }, first: 180, respawn: 180, xp: 220, xpRange: 25, gold: 110, minLevel: 3, scale: 1.0, hitY: 1.8, barY: 5.2 },
  titan: { name: 'Titan', hp: 6500, armor: 20, dmg: 85, cd: 1.8, range: 7, leash: 6, radius: 3.0, regen: 0.03, slam: { every: 8, r: 7, dmg: 110 }, first: 540, respawn: 240, xp: 400, xpRange: 25, gold: 250, minLevel: 5, scale: 1.0, hitY: 2.8, barY: 7.4 },
  herald: { name: 'Herald', hp: 2600, armor: 10, dmg: 45, cd: 1.5, range: 6, leash: 6, radius: 1.8, regen: 0.04, slam: { every: 7, r: 5, dmg: 55 }, first: 330, respawn: 0, xp: 260, xpRange: 25, gold: 120, minLevel: 4, scale: 1.0, hitY: 2.4, barY: 5.0 },
  dragonT: 300, dragonCap: 4, titanT: 120, titanHp: 0.5, titanDmg: 0.4, heraldT: 60, heraldStruct: 0.5, warn: 30,
  elements: ['fire', 'ice', 'gale'],
};

export const CAM = { fov: 38, offset: [-7, 20, 15], follow: 6, lead: 2, wideAspect: 2.0, zoom: 1.22 };
// Online rooms: worker URL (override with ?ws=wss://host), snapshot / input rates in Hz.
export const NET = { url: (typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('ws')) ?? 'wss://starlane-scuffle.mati-sme.workers.dev', snapHz: 10, inputHz: 20 };
export const BUDGET = { dprMax: 2, scaleMin: 0.6, maxParticles: 1500, shadows: true };
