// Single source of truth: palette, tuning numbers, budgets.

export const PAL = {
  voidTop: 0x140F3A, voidBottom: 0x3B2A7A,
  nebulaA: 0x7A4FD1, nebulaB: 0xC25BD6,
  star: 0xFFF4C2, gold: 0xFFD23F,
  grassLight: 0x8EE36A, grassDark: 0x4FB35A,
  lane: 0xF2D9A6, laneGlow: 0xFFE98A,
  cliffLight: 0x9C7FD0, cliffDark: 0x5B3F8C,
  sunny: 0x36C5F0, sunnyDeep: 0x1A6FB0,
  gloom: 0xFF5D73, gloomDeep: 0xB0284A,
  heal: 0x5BE584, shield: 0x9FE8FF,
  ink: 0x23163A, fog: 0x2A1F5E,
  zip: 0xFF8A3D,
};

// Team 0 = Sunny (player side, marches +x), team 1 = Gloom (marches -x).
export const TEAM = [
  { main: PAL.sunny, deep: PAL.sunnyDeep, dir: 1 },
  { main: PAL.gloom, deep: PAL.gloomDeep, dir: -1 },
];
export const sideX = (team, d) => (team === 0 ? -d : d);

export const GROUND = 0.08;
export const SIM_STEP = 1 / 30;

export const MAP = { halfLen: 60, halfWidth: 7, towerX: [20, 40], coreX: 54, spawnX: 48, heroX: 46 };

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

export const TOWER = { range: 8, dmg: 55, cd: 1.2, radius: 1.5, hp: [1200, 1500] };
export const CORE = { hp: 2200, radius: 2.2 };

export const CAM = { fov: 38, offset: [-7, 20, 15], follow: 6, lead: 2, wideAspect: 1.9 };
export const BUDGET = { dprMax: 2, scaleMin: 0.6, maxParticles: 1500 };
