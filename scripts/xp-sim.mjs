// Rough XP pacing estimate: node scripts/xp-sim.mjs
import { HERO, CAMP, BOSS } from '../js/config.js';
let cum = 0; console.log('lv  need  cumulative');
for (let lv = 1; lv < HERO.maxLevel; lv++) { cum += HERO.xpNeed(lv); console.log(`${lv + 1}   ${HERO.xpNeed(lv)}   ${cum}`); }
// typical farm per minute: ~2 troopers + 1 gunner share per wave (3 waves/min), a camp every ~75s, a few hero kills; boss at 3:00/5:30/9:00
const x = HERO.xp;
const camp = 60 / 75 * CAMP.xp * 0.8, inLane = 3 * (2 * x.blobling + x.zapper) * 0.6;
const events = [[3, BOSS.dragon.xp], [5.5, BOSS.herald.xp], [9, BOSS.titan.xp]];
for (const t of [5, 10, 15]) {
  let xp = (inLane + camp) * t + events.filter(e => e[0] <= t).reduce((a, e) => a + e[1] * 0.5, 0) + Math.floor(t / 3) * (x.hero + 4 * x.heroPerLevel);
  let lv = 1, left = xp; while (lv < HERO.maxLevel && left >= HERO.xpNeed(lv)) { left -= HERO.xpNeed(lv); lv++; }
  console.log(`~${t} min: ${Math.round(xp)} xp -> level ${lv}`);
}
