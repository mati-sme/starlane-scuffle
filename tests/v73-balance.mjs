// v7.3 balance invariants (pure data, no browser): basic ranges sit in the DESIGN.md bands and nobody outranges a tower.
// Run: node tests/v73-balance.mjs
import { ROSTER_DEFS } from '../js/heroes/roster.js';
import { TOWER } from '../js/config.js';

let fail = 0;
const ok = (name, c, info = '') => { console.log(`${c ? 'PASS' : 'FAIL'} ${name} ${info}`); if (!c) fail = 1; };
ok('48 champions', ROSTER_DEFS.length === 48, String(ROSTER_DEFS.length));
const bad = (f) => ROSTER_DEFS.filter(f).map((h) => `${h.id}:${h.basic.range}`).join(',');
ok('no basic range >= tower range', !bad((h) => h.basic.range >= TOWER.range), bad((h) => h.basic.range >= TOWER.range));
ok('ranged shooters <= 8.5 u', !bad((h) => h.role === 'shooter' && h.basic.kind === 'proj' && h.basic.range > 8.5));
ok('melee basics 2-3 u', !bad((h) => h.basic.kind === 'melee' && (h.basic.range < 2 || h.basic.range > 3)));
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const dps = (h) => h.basic.dmg / h.basic.cd;
const shooters = ROSTER_DEFS.filter((h) => h.role === 'shooter' && h.basic.kind === 'proj');
const bruisers = ROSTER_DEFS.filter((h) => h.role === 'bruiser');
ok('shooter basic dps below melee bruiser dps (range costs damage)', mean(shooters.map(dps)) < mean(bruisers.map(dps)) - 3,
  `${mean(shooters.map(dps)).toFixed(1)} vs ${mean(bruisers.map(dps)).toFixed(1)}`);
process.exit(fail);
