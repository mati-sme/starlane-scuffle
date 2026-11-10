import assert from 'node:assert/strict';
import { buildRecap } from '../js/game/recap.js';
const rows = [
  { id: 'a', name: 'A', team: 0, me: true, dmg: 500, ko: 1 }, { id: 'b', name: 'B', team: 0, me: false, dmg: 2000, ko: 4 },
  { id: 'c', name: 'C', team: 1, me: false, dmg: 9999, ko: 9 }, { id: 'd', name: 'D', team: 1, me: false, dmg: 10, ko: 0 },
];
const base = { win: true, team: 0, destroyed: [3, 0], towersLost: 1, firstStructureTeam: 1, maxBehind: 0, time: 300 };
let r = buildRecap(rows, base);
assert.equal(r.mvp.id, 'b'); assert.equal(r.bars.length, 2); assert.equal(r.bars[1].pct, 100); assert.equal(r.bars[0].pct, 25);
assert.equal(r.highlight.id, 'ko');
assert.equal(buildRecap(rows, { ...base, maxBehind: 3 }).highlight.id, 'comeback');
assert.equal(buildRecap(rows, { ...base, towersLost: 0 }).highlight.id, 'wall');
assert.equal(buildRecap(rows, { ...base, firstStructureTeam: 0 }).highlight.id, 'first-tower');
assert.equal(buildRecap(rows, { ...base, win: false, maxBehind: 9, towersLost: 0 }).highlight.id, 'first-tower' === 0 ? '' : 'ko'); // never a "comeback" when you lost
assert.equal(buildRecap(rows.map((x) => ({ ...x, ko: 0 })), { ...base, win: false }).highlight.id, 'try');
// online guest: no numbers -> no MVP / bars, still a kind highlight
const g = buildRecap(rows.map((x) => ({ ...x, dmg: 0, ko: 0 })), base);
assert.equal(g.mvp, null); assert.equal(g.hasStats, false); assert.ok(g.highlight.text.length > 5);
// never mean: every highlight text is positive-only
for (const f of [base, { ...base, win: false }]) assert.ok(!/lose|loser|bad|fail|noob/i.test(buildRecap(rows, f).highlight.text));
console.log('v86-recap OK');
