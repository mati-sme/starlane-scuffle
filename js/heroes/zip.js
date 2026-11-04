// Zip — Comet Fox. Phase 2: basic tail swipe only (skills / ult come later).
import { PAL } from '../config.js';
import { buildZip } from './models.js';

export const zip = {
  id: 'zip',
  stats: { hp: 600, speed: 6.5, radius: 0.6, hitY: 1.0, barY: 3.1, regen: 40 },
  abilities: {
    basic: { name: 'Tail Swipe', range: 2.2, dmg: 42, cd: 0.5, color: PAL.zip },
  },
  buildModel: buildZip,
};
