// Single source of truth: palette, tuning numbers, budgets.

export const PAL = {
  voidTop: 0x060A16, voidBottom: 0x1A2748,
  nebulaA: 0x2E5BD6, nebulaB: 0x16C7B8,
  star: 0xE6F4FF, gold: 0xFFC83D,
  grassLight: 0x3F5A68, grassDark: 0x2A3F4D,
  lane: 0x6D7C8E, laneGlow: 0x7FE0FF,
  cliffLight: 0x56658A, cliffDark: 0x2B3550,
  sunny: 0x3DA5FF, sunnyDeep: 0x1B5FB8,
  gloom: 0xFF4D5E, gloomDeep: 0xB02338,
  heal: 0x3EE89A, shield: 0x8FE3FF,
  ink: 0x0B1020, fog: 0x101A33,
};

// Team 0 = Sunny (player side, marches +x), team 1 = Gloom (marches -x).
export const TEAM = [
  { main: PAL.sunny, deep: PAL.sunnyDeep, dir: 1 },
  { main: PAL.gloom, deep: PAL.gloomDeep, dir: -1 },
];
export const sideX = (team, d) => (team === 0 ? -d : d);

export const GROUND = 0.08;
export const SIM_STEP = 1 / 30;

export const MAP = { halfLen: 60, halfWidth: 7, towerX: [20, 40], coreX: 54, spawnX: 48, heroX: 46, heroBound: { x: 58, z: 7.5 } };

export const MATCH = {
  waveEvery: 25, firstWave: 4, bigBlobFrom: 180, bigBlobEvery: 3,
  storm: 390, tieBreak: 510, stormStructMul: 2,
  respawnBase: 4, respawnPerLevel: 1, starTime: 360,
};

export const UNITS = {
  blobling: { hp: 120, speed: 2.6, range: 1.1, dmg: 12, cd: 1.0, radius: 0.55, aggro: 5, structMul: 1, hitY: 0.6, barY: 1.6, max: 40 },
  zapper: { hp: 80, speed: 2.4, range: 5, dmg: 14, cd: 1.3, radius: 0.45, aggro: 7, structMul: 1, hitY: 1.3, barY: 2.5, max: 16, ranged: true },
  bigblob: { hp: 420, speed: 2.0, range: 1.6, dmg: 24, cd: 1.4, radius: 1.0, aggro: 5, structMul: 2.5, hitY: 1.1, barY: 3.0, max: 8 },
};

export const HERO = {
  maxLevel: 9, ultLevel: 3, dmgPerLevel: 0.05, maxRank: [4, 4, 3],
  // Q/E rank r needs level 2r-2; R rank 1 is free at level 3, R2 needs level 5, R3 level 8.
  gate: (slot, rank) => (slot < 2 ? 2 * rank - 2 : [0, 3, 5, 8][rank]),
  xpNeed: (lv) => 40 + 20 * (lv - 1),
  xpRange: 6, xpHeroRange: 14, xp: { blobling: 10, zapper: 10, bigblob: 30, hero: 50, heroPerLevel: 10 },
  baseHeal: { radius: 6, rate: 0.2 },
};

// Bots: reaction time (s) and damage multiplier per difficulty star (1-3).
export const DIFFICULTY = { react: [0.8, 0.5, 0.3], dmg: [0.7, 0.85, 1] };
export const settings = { stars: 2 };
export const BOT = { aggro: 9, retreatHp: 0.35, returnHp: 0.85 };

export const TOWER ={ range: 8, dmg: 55, cd: 1.2, radius: 1.5, hp: [1200, 1500] };
export const CORE = { hp: 2200, radius: 2.2 };

export const CAM = { fov: 38, offset: [-7, 20, 15], follow: 6, lead: 2, wideAspect: 1.9 };
export const BUDGET = { dprMax: 2, scaleMin: 0.6, maxParticles: 1500 };
