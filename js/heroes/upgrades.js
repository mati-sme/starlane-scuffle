// Level-up pool: 3 hero-specific upgrades (basic / skill 1 / skill 2, owned counts live in hero.up) + 4 generic ones.
import { HERO } from '../config.js';
import { pick } from '../core/math.js';

export const GENERIC = [
  { id: 'boots', icon: 'boots' },  // +10% speed
  { id: 'heart', icon: 'heart' },  // +15% HP
  { id: 'claws', icon: 'claw' },   // +12% damage
  { id: 'hands', icon: 'hands' },  // -15% cooldowns
];

const heroOnes = (def) => ['basic', 's1', 's2'].map((id) => ({ id, icon: def.abilities[id].icon, hero: true }));

// Two distinct, not-maxed upgrades, at least one hero-specific.
export function rollChoices(hero) {
  const open = (u) => (hero.up[u.id] ?? 0) < HERO.maxUp;
  const mine = heroOnes(hero.def).filter(open), gen = GENERIC.filter(open);
  const first = pick(mine.length ? mine : gen);
  const second = pick([...mine, ...gen].filter((u) => u.id !== first.id));
  return Math.random() < 0.5 ? [first, second] : [second, first];
}
