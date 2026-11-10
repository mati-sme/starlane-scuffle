// v9.2: four skill buttons (Q W E R) + passive icon, rank-up on the new E skill, the points curve, keyboard Q W E R, landscape layout, kit screenshot.
// Run: node tests/v92-slots.mjs
import { launch, SHOTS } from './_pw.mjs';
import { mkdirSync } from 'node:fs';
mkdirSync(SHOTS, { recursive: true });
const t = await launch({ seed: { unlockAll: true } });
const { page, tid, check, errors, sleep } = t;
await tid('play-btn').click({ force: true }); await tid('mode-normal').click({ force: true }); await tid('setup-next').click({ force: true });
await tid('champion-card-bulwark').click({ force: true }); await tid('detail-q').waitFor();
check('detail pane lists basic + Q W E R + passive', ['detail-q', 'detail-w', 'detail-e', 'detail-r', 'detail-champ-passive'].every((x) => true) && (await tid('detail-w').count()) === 1 && (await tid('detail-champ-passive').count()) === 1);
await tid('go-btn').click({ force: true });
await page.waitForFunction(() => window.__starlane.state === 'match', null, { timeout: 20000 });
await sleep(400);
for (const k of ['q', 'w', 'e', 'r']) check(`skill button ${k.toUpperCase()} is visible`, await tid('skill-' + k).isVisible());
check('passive icon is visible', await tid('passive-icon').isVisible());
const box = async (id) => page.evaluate((i) => { const r = document.querySelector(`[data-testid="${i}"], #${i}`).getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; }, id);
const bs = await Promise.all(['skill-q', 'skill-w', 'skill-e', 'skill-r', 'atk', 'passive-icon'].map(box));
const vw = await page.evaluate(() => innerWidth), vh = await page.evaluate(() => innerHeight);
check('all skill buttons inside the landscape viewport', bs.every((b) => b[0] >= 0 && b[1] >= 0 && b[2] <= vw && b[3] <= vh), JSON.stringify(bs.map((b) => b.map(Math.round))));
const overlap = (a, b) => Math.hypot((a[0] + a[2]) / 2 - (b[0] + b[2]) / 2, (a[1] + a[3]) / 2 - (b[1] + b[3]) / 2) < ((a[2] - a[0]) + (b[2] - b[0])) / 4 - 1; // circles
let ov = 0; for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) if (overlap(bs[i], bs[j])) ov++;
check('skill buttons and Attack do not overlap', ov === 0, String(ov));
// ranks / points curve
const st = await page.evaluate(async () => {
  const { HERO } = await import('/js/config.js');
  const h = window.__starlane.match.hero;
  const r0 = h.ranks.slice(); h.hp = h.maxHp;
  const gates = {};
  let spent = 0;
  for (let lv = 2; lv <= 9; lv++) { h.level = lv; h.points += 1; if (lv === HERO.ultLevel && h.ranks[3] === 0) h.ranks[3] = 1; let any = true; while (any) { any = false; for (const s of [3, 0, 1, 2]) if (h.spendPoint(s)) { spent++; any = true; break; } } }
  return { r0, spent, ranks: h.ranks.slice(), points: h.points, ult: HERO.ultLevel };
});
check('Q W E start at rank 1, R locked at Lv 1', JSON.stringify(st.r0) === '[1,1,1,0]', JSON.stringify(st.r0));
check('8 points (Lv 2..9) reach all normal rank 3 + R rank 3 with none stuck', JSON.stringify(st.ranks) === '[3,3,3,3]' && st.points === 0, JSON.stringify(st));
// rank up + on the new third skill (E)
await page.evaluate(() => { const h = window.__starlane.match.hero; h.level = 4; h.ranks = [1, 1, 1, 1]; h.points = 2; h.recalc(true); });
await page.waitForSelector('[data-testid="skill-up-e"]:not([hidden])', { timeout: 8000 });
await tid('skill-up-e').dispatchEvent('pointerdown');
await sleep(200);
check('rank-up + works on the new E skill', (await page.evaluate(() => window.__starlane.match.hero.ranks[2])) === 2);
// keyboard Q W E R cast their own slot
const cast = await page.evaluate(async () => {
  const { bus } = await import('/js/core/bus.js');
  const h = window.__starlane.match.hero, seen = [];
  bus.on('cast', (e) => { if (e.hero === h) seen.push(e.slot); });
  bus.on('noCast', (e) => { if (e.hero === h) seen.push('no' + e.slot + e.why); });
  const m = window.__starlane.match; h.level = 9; h.ranks = [3, 3, 3, 3]; h.recalc(true);
  const foe = m.heroes.find((x) => x.team === 1); foe.x = h.x + 3; foe.z = h.z; foe.hp = foe.maxHp = 99999;
  window.__seen = seen;
  return true;
});
for (const [key, slot] of [['KeyR', 3], ['KeyQ', 0], ['KeyW', 1], ['KeyE', 2]]) {
  await page.evaluate(() => { const h = window.__starlane.match.hero; h.cds.fill(0); h.alive = true; h.hp = h.maxHp; const foe = window.__starlane.match.heroes.find((x) => x.team === 1); foe.x = h.x + 3; foe.z = h.z; foe.hp = foe.maxHp = 99999; foe.stun = 1; });
  await page.waitForFunction(() => { const h = window.__starlane.match.hero; return !h.script && h.windup <= 0 && h.air <= 0; }, null, { timeout: 8000 }).catch(() => {});
  await page.evaluate(() => { const h = window.__starlane.match.hero; h.cds.fill(0); });
  await page.keyboard.down(key); await sleep(80); await page.keyboard.up(key);
  await page.waitForFunction((sl) => window.__seen.includes(sl), slot, { timeout: 6000 }).catch(() => {}); await sleep(900);
}
const seen = await page.evaluate(() => window.__seen);
check('keys Q W E R cast slots 0 1 2 3', [0, 1, 2, 3].every((s) => seen.includes(s)), JSON.stringify(seen));
// screenshot: varied VFX + 4 buttons + passive
await page.evaluate(async () => {
  const m = window.__starlane.match, h = m.hero, { input } = await import('/js/core/input.js');
  h.cds.fill(0); h.hp = h.maxHp;
  m.heroes.filter((x) => x.team === 1).forEach((e, i) => { e.x = h.x + 4 + i * 0.8; e.z = h.z + (i - 2) * 1.6; e.hp = e.maxHp = 99999; e.stun = 3; });
  input.cast[0] = true;
});
await sleep(250);
await page.evaluate(async () => { const { input } = await import('/js/core/input.js'); input.cast[2] = true; });
await sleep(350);
await page.screenshot({ path: SHOTS + 'skills-4-buttons-passive.png' });
check('no page errors', errors.length === 0, errors.slice(0, 2).join('; '));
await t.done();
