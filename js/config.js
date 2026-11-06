// Single source of truth: palette, tuning numbers, budgets.

export const PAL = { // grounded sci-fi: slightly desaturated neon, deeper shadows; team blue/red stay saturated enough to read
  voidTop: 0x05080F, voidBottom: 0x172238,
  nebulaA: 0x2A4FA8, nebulaB: 0x1A9E94,
  star: 0xE2EEF8, gold: 0xF0BE48,
  grassLight: 0x4E6352, grassDark: 0x2E3E34,
  lane: 0x666D76, laneGlow: 0x6FCBE4,
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

export const MAP = { halfX: 90, halfZ: 56, heroX: 80, heroBound: { x: 87, z: 53 }, laneW: 10 };

// Quadrant data (x < 0, z < 0), mirrored 4x by world/arena.js. Team 0 (Sunny) owns -x; the top lane is z < 0.
export const ARENA = {
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
  cover: [[-44, -24, 10, 2], [-20, -26, 2, 10], [-14, -12, 6, 2], [-56, -30, 2, 8], [-12, -41, 3, 2], [-16, -4, 2, 2]], // cx, cz, w, d
  brush: [[-26, -34, 8, 4], [-40, -14, 6, 6], [-10, -6, 6, 3], [-3, -22, 5, 5]],
  pockets: [[-30, -19, 44, 22]], // jungle: cx, cz, w, d (quadrant)
  camps: [[-30, -18]],
  pits: [[0, 29, 'dragon'], [0, -29, 'titan']], // epic boss pits on the centre line (x, z); the Herald shares the Titan pit
  brushSeeRange: 3.5, brushRevealT: 1.2,
};

export const MATCH = {
  waveEvery: 20, stormWaveEvery: 15, firstWave: 15, siegeFrom: 90, siegeEvery: 2,
  storm: 540, tieBreak: 900, stormStructMul: 2.5, stormXpMul: 1.5, stormSiege: 1, // Overdrive at 9:00 (tie-break 15:00): extra siege blob per wave, 2.5x structure damage, 1.5x XP, half respawn
  respawnBase: 4, respawnPerLevel: 1.5, starTime: 600,
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
  maxLevel: 9, ultLevel: 3, dmgPerLevel: 0.05, maxRank: [4, 4, 3],
  // Q/E rank r needs level 2r-2; R rank 1 is free at level 3, R2 needs level 5, R3 level 8.
  gate: (slot, rank) => (slot < 2 ? 2 * rank - 2 : [0, 3, 5, 8][rank]),
  xpNeed: (lv) => 80 + 30 * (lv - 1) + 8 * (lv - 1) ** 2, // ~2600 total to lv 9 (was 880)
  xpRange: 9, xpHeroRange: 14, xp: { blobling: 14, zapper: 16, bigblob: 34, hero: 60, heroPerLevel: 10 },
  baseHeal: { rate: 0.2 },
};

// Bots: reaction time (s) and damage multiplier per difficulty star (1-3). Only Gloom's bots scale; Sunny allies stay at 0.4 s / 1.0x.
export const DIFFICULTY = { react: [0.5, 0.4, 0.3], dmg: [0.92, 1, 1.1], allyReact: 0.4 };
export const settings = { stars: 1 };
export const BOT = { aggro: 10, retreatHp: 0.35, returnHp: 0.9, powerRatio: 0.8, groupDeficit: 2 };

// Tiers per lane: outer -> inner -> inhib (each needs the one before it down), then two guardians and the Nexus. 3 x 3 lane towers + 2 guardians per team.
export const TIERS = ['outer', 'inner', 'inhib'];
export const TOWER = { range: 9, cd: 1.1, radius: 1.5, hp: { outer: 1700, inner: 1800, inhib: 1900, guard: 2200 }, armor: { outer: 8, inner: 10, inhib: 12, guard: 14 }, heroDmg: 70, heroPct: 0.06, minionDmg: 100, shield: 0.35, shieldR: 10 };
// The Nexus: 2.5x a guardian's health plus heavy armor, its own laser, and a shield pulse the first time it is hit once exposed.
export const CORE = { hp: 5500, armor: 40, radius: 2.4, range: 13, cd: 1.2, heroDmg: 100, heroPct: 0.08, minionDmg: 80, pulse: 3, pulseR: 9, pulseDr: 0.7 };

// Gold: per-kill rewards, a small passive trickle, and the starting purse (auto-buys boots at the fountain).
export const GOLD = {
  start: 350, trickle: 1.6, minion: { blobling: 20, zapper: 24, bigblob: 60 }, minionShare: 0.35,
  camp: 60, campTeam: 25, hero: 300, assist: 120, assistR: 14, tower: { outer: 150, inner: 175, inhib: 200, guard: 225 }, towerTeam: 50, towerR: 28,
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
