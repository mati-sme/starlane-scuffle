// v10 quick smoke: offline match boots on the bigger stone-free map, HUD layout shot, cooldown digits, level cap 15, no time limit.
import { launch } from './_pw.mjs';
const SHOTS = '/workspace/test-artifacts/starlane-scuffle/v10/';
const t = await launch({ seed: { unlockAll: true } });
const { page, tid, check, errors, sleep } = t;
await tid('play-btn').click({ force: true });
await tid('mode-normal').click({ force: true }).catch(() => {});
await tid('setup-next').click({ force: true }).catch(() => {});
await sleep(400);
await page.screenshot({ path: SHOTS + 'champion-select.png' });
await tid('champion-card-bulwark').click({ force: true });
await tid('go-btn').click({ force: true });
await page.waitForFunction(() => window.__starlane.state === 'match', null, { timeout: 30000 });
await sleep(1500);
const r = await page.evaluate(async () => {
  const { COVER } = await import('/js/world/arena.js');
  const { HERO, MATCH } = await import('/js/config.js');
  const m = window.__starlane.match, h = m.hero;
  return { cover: COVER.length, max: HERO.maxLevel, tb: MATCH.tieBreak, lanes: m.heroes.filter((x) => x.team === h.team && x.brain).map((x) => [x.def.role, x.brain.lane]), hint: document.querySelector('[data-testid="lane-hint"]')?.textContent };
});
console.log(JSON.stringify(r));
check('no cover stones', r.cover === 0);
check('level cap 15', r.max === 15);
check('lane hint shown', /Top lane/.test(r.hint || ''), r.hint);
await page.screenshot({ path: SHOTS + 'hud.png' });
// cast Q and read the cooldown digit
await page.evaluate(() => { const h = window.__starlane.match.hero; h.cds[0] = 6.4; h.cdTotal[0] = 8; });
await sleep(300);
const num = await page.evaluate(() => document.querySelector('[data-testid="skill-q"] .num').textContent);
check('cooldown seconds on skill button', /^[0-9]/.test(num), num);
// jump to 16 min, no end
await page.evaluate(() => { const m = window.__starlane.match; m.time = 16 * 60; });
await sleep(1200);
const over = await page.evaluate(() => window.__starlane.match.over);
check('no time-limit end at 16:00', !over);
await page.evaluate(() => { const h = window.__starlane.match.hero; for (let i = 0; i < 40; i++) h.gainXp(2000); });
await sleep(300);
const lv = await page.evaluate(() => { const h = window.__starlane.match.hero; return [h.level, h.points]; });
check('reaches level 15 with 14 points', lv[0] === 15 && lv[1] === 14, JSON.stringify(lv));
await page.screenshot({ path: SHOTS + 'hud-lv15.png' });
check('no page errors', errors.length === 0, errors.slice(0, 3).join('; '));
await t.done();
