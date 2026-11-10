// v9.0: modes (Normal has no ban, Ranked does), owned-only select, Store buy, recap Home only, personal KDA. Run: node tests/v90-modes-store.mjs
import { launch, SHOTS } from './_pw.mjs';
import { mkdirSync } from 'node:fs';
mkdirSync(SHOTS, { recursive: true });
const t = await launch({ seed: { profile: { level: 2, xp: 0, coins: 400, owned: [], paid: 0, matches: 3, wins: 1, kills: 0, stars: 0 } } });
const { page, tid, check, errors, sleep } = t;
// ---- title -> mode screen
await tid('play-btn').click({ force: true });
await tid('mode-normal').waitFor({ timeout: 5000 });
check('mode screen has normal / ranked / coop', (await tid('mode-ranked').count()) === 1 && (await tid('mode-coop').count()) === 1);
await page.screenshot({ path: SHOTS + 'mode-select.png' });
// ---- Normal: no ban phase, owned champions only
await tid('mode-normal').click({ force: true });
await tid('setup-next').click({ force: true });
await tid('go-btn').waitFor({ timeout: 5000 });
check('Normal goes straight to pick (no ban button)', (await tid('ban-btn').count()) === 0);
const cards = await page.locator('[data-testid^="champion-card-"]').count();
check('pick grid lists only the 10 free champions', cards === 10, String(cards));
check('no locked cards in the pick grid', (await page.locator('.hcard[data-locked="true"]').count()) === 0);
await tid('go-btn').click({ force: true });
await page.waitForFunction(() => window.__starlane.state === 'match', null, { timeout: 20000 });
// ---- KDA
const k0 = await tid('player-kda').textContent();
check('HUD shows player K / D / A', /K \/ D \/ A/.test(k0) && /0\/0\/0/.test(k0.replace(/\s/g, '')), k0);
await page.evaluate(async () => {
  const { bus } = await import('/js/core/bus.js');
  const m = window.__starlane.match, me = m.hero, foe = m.heroes.find((h) => h.team === 1), ally = m.heroes.find((h) => h.team === 0 && h !== me);
  // 2 kills by me, 1 assist (ally kills while I'm near), 1 death of mine
  foe.x = me.x + 2; foe.z = me.z; foe.alive = false; foe.killer = me; foe.hp = 0; bus.emit('down', foe);
  const f2 = m.heroes.filter((h) => h.team === 1)[1]; f2.x = me.x + 2; f2.z = me.z; f2.alive = false; f2.killer = me; bus.emit('down', f2);
  const f3 = m.heroes.filter((h) => h.team === 1)[2]; f3.x = me.x + 2; f3.z = me.z; f3.alive = false; f3.killer = ally; bus.emit('down', f3);
  me.alive = false; me.killer = foe; bus.emit('down', me);
});
await page.waitForFunction(() => document.querySelector('[data-testid="player-kda"]').textContent.replace(/\s/g, '').includes('2/1/1'), null, { timeout: 15000 }).catch(() => {});
const k1 = (await tid('player-kda').textContent()).replace(/\s/g, '');
check('KDA counts 2 kills / 1 death / 1 assist', k1.includes('2/1/1'), k1);
await page.screenshot({ path: SHOTS + 'hud-kda.png' });
// ---- recap: Home only
await page.evaluate(() => { const m = window.__starlane.match; m.hero.alive = true; m._end(true, 'core'); });
await tid('home-btn').waitFor({ timeout: 8000 });
check('recap shows my K / D / A', (await tid('recap-kda').textContent()).replace(/\s/g, '').includes('2') && (await tid('recap-d').textContent()) === '1' && (await tid('recap-a').textContent()) === '1');
check('recap has no Play Again / Champions', (await tid('again-btn').count()) === 0 && (await tid('champions-btn').count()) === 0);
check('recap has exactly one Home button', (await page.locator('.result button.btn').count()) === 1);
await page.screenshot({ path: SHOTS + 'recap-home.png' });
await tid('home-btn').click({ force: true });
await tid('play-btn').waitFor({ timeout: 5000 });
check('Home returns to the title', (await page.evaluate(() => window.__starlane.state)) === 'title');
// ---- Store: buy a champion
await tid('store-btn').click({ force: true });
await tid('store-root').waitFor({ timeout: 5000 });
const before = Number((await tid('player-coins').first().textContent()).replace(/\D/g, '')) || 0;
const firstLocked = await page.locator('[data-testid^="store-card-"][data-owned="false"]').first().getAttribute('data-testid');
const id = firstLocked.replace('store-card-', '');
await tid(firstLocked).click({ force: true });
await page.screenshot({ path: SHOTS + 'store.png' });
await tid('store-buy-btn').click({ force: true });
check('buying a champion marks it owned', (await tid(firstLocked).getAttribute('data-owned')) === 'true', id);
const coinsAfter = Number((await tid('player-coins').first().textContent()).replace(/\D/g, ''));
check('coins were spent', coinsAfter < before, `${before}->${coinsAfter}`);
await tid('store-back').click({ force: true });
await tid('play-btn').click({ force: true }); await tid('mode-normal').click({ force: true }); await tid('setup-next').click({ force: true });
await tid('go-btn').waitFor();
check('bought champion appears in pick grid', (await tid('champion-card-' + id).count()) === 1);
// ---- Ranked has ban
await tid('select-back').click({ force: true });
await tid('play-btn').click({ force: true }); await tid('mode-ranked').click({ force: true }); await tid('setup-next').click({ force: true });
await tid('ban-btn').waitFor({ timeout: 5000 });
check('Ranked starts with the ban phase', (await tid('draft-title').textContent()).includes('Ban'));
check('no page errors', errors.length === 0, errors.join('; '));
await t.done();
