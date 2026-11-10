// Pure Node: daily quest selection, progress, day rollover.
import assert from 'node:assert/strict';
import { POOL, pickForDay, dayKey, quests, view, progressMatch, resetQuests } from '../js/game/quests.js';
const d1 = new Date(2026, 5, 1, 10), d1late = new Date(2026, 5, 1, 23, 59), d2 = new Date(2026, 5, 2, 0, 1);
assert.equal(dayKey(d1), '2026-06-01');
for (let i = 0; i < 60; i++) { const ids = pickForDay(`2026-07-${i}`); assert.equal(ids.length, 3); assert.equal(new Set(ids).size, 3); ids.forEach((id) => assert.ok(POOL.some((q) => q.id === id))); }
resetQuests();
assert.deepEqual(quests(d1).list.map((q) => q.id), quests(d1late).list.map((q) => q.id)); // same local day -> same quests
const before = view(d1);
assert.equal(before.length, 3); assert.ok(before.every((q) => q.coins >= 30 && !q.done));
// a strong win completes everything that can be completed in one match
const done = progressMatch({ win: true, stars: 3, myKills: 5, destroyed: [3, 0], team: 0 }, d1);
assert.ok(done.length >= 2, JSON.stringify(done));
assert.ok(progressMatch({ win: true, stars: 3, myKills: 5, destroyed: [3, 0], team: 0 }, d1).every((q) => !done.some((x) => x.id === q.id))); // never paid twice
// partial progress counts across matches
resetQuests(); const ids = pickForDay(dayKey(d2));
progressMatch({ win: false, stars: 0, myKills: 1, destroyed: [0, 0], team: 0 }, d2);
const v = view(d2); const kq = v.find((q) => q.stat === 'kos'); if (kq) assert.equal(kq.prog, 1);
// new day -> reset
const nd = new Date(2026, 5, 3, 9); assert.ok(quests(nd).day === '2026-06-03' && quests(nd).list.every((q) => q.prog === 0 && !q.done));
console.log('v81-quests OK', ids.join());
