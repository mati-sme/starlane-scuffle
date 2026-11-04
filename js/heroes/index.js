// Hero registry. ROSTER order decides which heroes the bots take (the ones the player didn't).
import { zip } from './zip.js';
import { moss } from './moss.js';
import { luma } from './luma.js';
import { clink } from './clink.js';

export const HEROES = { zip, moss, luma, clink };
export const ROSTER = ['zip', 'moss', 'luma', 'clink'];
