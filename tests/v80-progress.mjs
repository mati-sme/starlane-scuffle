// Pure Node: economy rules, free set, unlocks, persistence-free store.
import assert from 'node:assert/strict';
import { FREE_CHAMPS, unlockPrice, xpNeeded, matchReward, resetProfile, profile, isOwned, buyChampion, awardMatch, nextPrice } from '../js/game/progress.js';
import { ROSTER_DEFS } from '../js/heroes/roster.js';
assert.equal(FREE_CHAMPS.length, 18); assert.equal(new Set(FREE_CHAMPS).size, 18);
for (const id of ['lumen', 'bulwark', 'nyx']) assert.ok(FREE_CHAMPS.includes(id));
const roles = new Set(FREE_CHAMPS.map((id) => ROSTER_DEFS.find((d) => d.id === id)?.role)); assert.ok(roles.size >= 5, [...roles].join());
assert.equal(unlockPrice(0), 100); assert.equal(unlockPrice(5), 150); assert.equal(unlockPrice(99), 350);
assert.deepEqual(matchReward({ win: false }), { xp: 20, coins: 30 });
assert.deepEqual(matchReward({ win: true, stars: 3, kills: 4 }), { xp: 59, coins: 98 });
assert.deepEqual(matchReward({ win: false, stars: 3 }), { xp: 20, coins: 30 }); // stars only count on wins
resetProfile(null);
assert.equal(profile().level, 1); assert.equal(profile().coins, 0);
assert.equal(isOwned('lumen'), true); assert.equal(isOwned('granite'), false);
assert.equal(buyChampion('granite').ok, false);
const a = awardMatch({ win: true, stars: 1, kills: 0 }); assert.equal(a.coins, 70);
assert.equal(awardMatch({ win: false }).coins, 30); // 100 coins now
assert.deepEqual(buyChampion('granite'), { ok: true, price: 100 });
assert.ok(isOwned('granite')); assert.equal(profile().coins, 0); assert.equal(nextPrice(), 110);
assert.equal(buyChampion('granite').ok, false);
// level-up: 100 xp needed at L1 (80+20)
resetProfile(null); let r;
for (let i = 0; i < 3; i++) r = awardMatch({ win: true, stars: 0, kills: 0 }); // 40 xp each = 120 -> L2
assert.equal(r.level, 2); assert.equal(profile().xp, 20); assert.equal(r.bonus, 25); assert.equal(xpNeeded(1), 100);
// a kid should afford the first unlock in <=2 wins/losses mix and every unlock within ~7 average matches
const avg = (matchReward({ win: true, stars: 1 }).coins + matchReward({ win: false }).coins) / 2;
assert.ok(100 / avg <= 3 && 350 / avg <= 8, `avg ${avg}`);
console.log('v80-progress OK; avg coins/match', avg, 'free', FREE_CHAMPS.join());
