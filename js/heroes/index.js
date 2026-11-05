// Hero registry: roster data + shared behaviors + the model builder. ROSTER order = select-screen order.
import { ROSTER_DEFS, ROLES } from './roster.js';
import { buildChampion } from './models.js';

const css = (n) => '#' + n.toString(16).padStart(6, '0');

export const HEROES = Object.fromEntries(ROSTER_DEFS.map((d) => [d.id, {
  ...d,
  css: css(d.color),
  accentCss: css(d.accent),
  abilities: { basic: d.basic, s1: d.s1, s2: d.s2, ult: d.ult },
  buildModel: (team) => buildChampion(d.model, d, team),
}]));
export const ROSTER = ROSTER_DEFS.map((d) => d.id);
export { ROLES };
