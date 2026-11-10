import assert from 'node:assert/strict';
import { BADGES, evaluate, isEarned, resetBadges, setFlag } from '../js/game/badges.js';
import { resetProfile, awardMatch, buyChampion } from '../js/game/progress.js';
import { resetSkins, buySkin } from '../js/game/skins.js';
resetProfile(null); resetSkins(); resetBadges();
assert.deepEqual(evaluate(), []); // fresh player: nothing yet
assert.ok(BADGES.length >= 8 && new Set(BADGES.map((b) => b.id)).size === BADGES.length);
awardMatch({ win: true, stars: 3, myKills: 2 }); setFlag('threeStar');
let ids = evaluate().map((b) => b.id); assert.deepEqual(ids.sort(), ['first-win', 'three-stars']);
assert.deepEqual(evaluate(), []); // each badge is announced once
awardMatch({ win: true, stars: 3 }); buyChampion('granite'); buySkin('granite', 'frost');
ids = evaluate().map((b) => b.id); assert.deepEqual(ids.sort(), ['first-skin', 'first-unlock']);
for (let i = 0; i < 12; i++) awardMatch({ win: true, stars: 1, myKills: 3 });
ids = evaluate().map((b) => b.id); for (const x of ['matches-10', 'wins-5', 'kos-25', 'level-5']) assert.ok(ids.includes(x), x + ' ' + ids);
console.log('v83-badges OK');
