// v9.4: 12 new store-only champs, unique 4-skill kits, HUD unstuck label + level pill not on the minimap.
// Run: node tests/v94-wave4.mjs
import { launch } from './_pw.mjs';
import { mkdirSync } from 'node:fs';
const SHOTS = '/workspace/test-artifacts/starlane-scuffle/v94/';
mkdirSync(SHOTS, { recursive: true });
const NEW = ['threshold', 'ironwake', 'sirocco', 'coralith', 'fable', 'spire', 'novara', 'dune', 'glim', 'lyra', 'pip', 'carillon'];
const t = await launch({ seed: { unlockAll: true } });
const { page, tid, check, errors, sleep } = t;

const audit = await page.evaluate(async (NEW) => {
  const { HEROES, ROSTER } = await import('/js/heroes/index.js');
  const { BEHAVIORS } = await import('/js/heroes/behaviors.js');
  const { PASSIVE_KINDS } = await import('/js/game/passives.js');
  const { FREE_CHAMPS, unlockPrice } = await import('/js/game/progress.js');
  const ids = new Set(ROSTER);
  const problems = [];
  if (ROSTER.length !== 83) problems.push('roster is ' + ROSTER.length + ', expected 83');
  if (ids.size !== ROSTER.length) problems.push('duplicate roster ids');
  for (const id of NEW) {
    if (!ids.has(id)) { problems.push('missing ' + id); continue; }
    if (FREE_CHAMPS.includes(id)) problems.push(id + ' is free (should be store-priced)');
    const d = HEROES[id];
    const kinds = [d.s1?.kind, d.s2?.kind, d.s3?.kind, d.ult?.kind];
    if (kinds.some((k) => !k)) problems.push(id + ' missing a skill kind');
    if (new Set(kinds).size !== 4) problems.push(id + ' repeated skill kind ' + kinds.join('/'));
    for (const k of ['s1', 's2', 's3', 'ult']) if (!BEHAVIORS[d[k].kind]) problems.push(id + ' ' + k + ' has no behavior');
    if (!d.passive || !PASSIVE_KINDS.includes(d.passive.kind)) problems.push(id + ' bad passive');
  }
  return { count: ROSTER.length, price0: unlockPrice(0), problems };
}, NEW);
check('83 unique champions', audit.count === 83, String(audit.count));
check('12 new champs are store-priced with unique 4-skill kits', audit.problems.length === 0, audit.problems.join('; '));
check('unlock price is paid (not free)', audit.price0 > 0, String(audit.price0));

await tid('play-btn').click({ force: true });
await tid('mode-normal').click({ force: true });
await tid('setup-next').click({ force: true });
await tid('champion-card-bulwark').click({ force: true });
await tid('go-btn').click({ force: true });
await page.waitForFunction(() => window.__starlane.state === 'match', null, { timeout: 20000 });
await sleep(500);
await page.evaluate(() => {
  const h = window.__starlane.match.hero;
  h.level = 3; h.points = 1; h.xp = 40; h.recalc(true);
  const toast = document.querySelector('[data-testid="level-toast"]');
  if (toast) { toast.textContent = 'Lv 3 · +1'; toast.classList.add('pop'); }
});
await sleep(200);

const hud = await page.evaluate(() => {
  const unstuck = document.querySelector('[data-testid="unstuck-btn"], #unstuck');
  const mini = document.querySelector('#mini');
  const lv = document.querySelector('#lvinfo');
  const toast = document.querySelector('[data-testid="level-toast"]');
  const badge = document.querySelector('.portrait .lvl');
  const box = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const overlap = (a, b) => a && b && a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
  const ub = box(unstuck), mb = box(mini), lb = box(lv), tb = toast ? box(toast) : null, pb = badge ? box(badge) : null;
  return {
    text: (unstuck.textContent || '').trim(),
    clipped: unstuck.scrollWidth > unstuck.clientWidth + 1,
    unstuckW: Math.round(ub.w),
    lvOverMini: overlap(lb, mb),
    toastOverMini: overlap(tb, mb),
    badgeOverMini: overlap(pb, mb),
    lv: { l: Math.round(lb.l), t: Math.round(lb.t), r: Math.round(lb.r), b: Math.round(lb.b) },
    mini: { l: Math.round(mb.l), t: Math.round(mb.t), r: Math.round(mb.r), b: Math.round(mb.b) },
  };
});
check('UNSTUCK label is complete and not clipped', hud.text === 'UNSTUCK' && !hud.clipped, JSON.stringify(hud));
check('level pill does not overlap the minimap', !hud.lvOverMini, JSON.stringify({ lv: hud.lv, mini: hud.mini }));
check('level toast does not overlap the minimap', !hud.toastOverMini, JSON.stringify(hud));
check('portrait level badge does not overlap the minimap', !hud.badgeOverMini, JSON.stringify(hud));

const art = await page.evaluate(() => !!document.querySelector('[data-testid="skill-q"] svg, #abilities svg.skart, .skart'));
check('skill buttons render SVG art', art);

await page.screenshot({ path: SHOTS + 'hud-unstuck-level.png' });
await page.locator('[data-testid="skill-q"]').screenshot({ path: SHOTS + 'skill-icon-q.png' }).catch(() => {});
await page.screenshot({ path: SHOTS + 'skills-polished.png' });

// back to title → store, look for a new champ
await page.evaluate(() => { try { window.__starlane.match?.end?.(); } catch {} });
await page.goto(page.url().split('?')[0] + '?gfx=low', { waitUntil: 'load', timeout: 90000 });
await sleep(300);
await tid('store-btn').click({ force: true });
await sleep(400);
const inStore = await page.evaluate((NEW) => NEW.filter((id) => document.querySelector(`[data-testid="store-card-${id}"], [data-id="${id}"], [data-champ="${id}"]`) || [...document.querySelectorAll('*')].some((el) => /Threshold|Ironwake|Sirocco|Glim|Pip|Carillon/.test(el.textContent || ''))).length, NEW);
check('store lists new champions', inStore > 0, 'found ' + inStore);
await page.screenshot({ path: SHOTS + 'store-wave4.png' });

check('no page errors', errors.filter((e) => !/WebGL|THREE|Context Lost/i.test(e)).length === 0, errors.slice(0, 3).join('; '));
await t.done();
