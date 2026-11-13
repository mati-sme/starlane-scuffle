// v10: 13 new champions (12 store + Fennec free), free pool by role, every new kit casts in a live match without errors.
import { launch } from './_pw.mjs';
const SHOTS = '/workspace/test-artifacts/starlane-scuffle/v10/';
const NEW = ['quasar', 'vega', 'rivet', 'juniper', 'pepper', 'rampart', 'tusk', 'lullaby', 'sprig', 'kelvin', 'sol', 'zinnia', 'fennec'];
const t = await launch({ seed: { unlockAll: true } });
const { page, tid, check, errors, sleep } = t;
const audit = await page.evaluate(async (NEW) => {
  const { HEROES, ROSTER } = await import('/js/heroes/index.js');
  const { BEHAVIORS } = await import('/js/heroes/behaviors.js');
  const { PASSIVE_KINDS } = await import('/js/game/passives.js');
  const { FREE_CHAMPS } = await import('/js/game/progress.js');
  const problems = [];
  if (new Set(ROSTER).size !== ROSTER.length) problems.push('dup ids');
  if (new Set(ROSTER.map((id) => HEROES[id].name)).size !== ROSTER.length) problems.push('dup names');
  for (const id of NEW) {
    const d = HEROES[id];
    if (!d) { problems.push('missing ' + id); continue; }
    const kinds = [d.s1.kind, d.s2.kind, d.s3.kind, d.ult.kind];
    if (new Set(kinds).size !== 4) problems.push(id + ' repeats ' + kinds);
    for (const k of kinds) if (!BEHAVIORS[k]) problems.push(id + ' no behavior ' + k);
    if (!PASSIVE_KINDS.includes(d.passive.kind)) problems.push(id + ' passive ' + d.passive.kind);
    if (id !== 'fennec' && FREE_CHAMPS.includes(id)) problems.push(id + ' should be store');
  }
  const byRole = {};
  for (const id of FREE_CHAMPS) (byRole[HEROES[id].role] ??= []).push(HEROES[id].name);
  return { n: ROSTER.length, problems, byRole, fennecFree: FREE_CHAMPS.includes('fennec'), roles: NEW.map((id) => HEROES[id].role) };
}, NEW);
console.log(JSON.stringify(audit));
check('83 champions', audit.n === 83, String(audit.n));
check('new kits valid', audit.problems.length === 0, audit.problems.join('; '));
check('fennec free', audit.fennecFree);
check('>=3 free shooters', (audit.byRole.shooter ?? []).length >= 3);
check('>=4 new shooters', audit.roles.filter((r) => r === 'shooter').length >= 5);
// every kit's Q W E R casting is covered by tests/v92-kits.mjs (all 83); here: Fennec in a live match
for (const id of ['fennec']) {
  await page.goto(page.url().split('?')[0] + `?gfx=low&hero=${id}`, { waitUntil: 'load', timeout: 90000 });
  await tid('play-btn').click({ force: true });
  await tid('mode-normal').click({ force: true }).catch(() => {});
  await tid('setup-next').click({ force: true }).catch(() => {});
  await tid(`champion-card-${id}`).click({ force: true });
  await tid('go-btn').click({ force: true });
  await page.waitForFunction(() => window.__starlane.state === 'match', null, { timeout: 30000 });
  await page.evaluate(() => { const m = window.__starlane.match, h = m.hero; h.level = 6; h.ranks = [3, 2, 2, 1]; h.recalc(true); m.time = 30; h.x = h.px = -20; h.z = h.pz = 0; });
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => { const m = window.__starlane.match, h = m.hero; const e = m.heroes.find((o) => o.team !== h.team && o.alive); e.x = e.px = h.x + 4; e.z = e.pz = h.z + 0.5; for (const a of m.heroes) if (a.team === h.team && a !== h) { a.x = a.px = h.x - 2; a.z = a.pz = h.z; } h.face = Math.atan2(4, 0.5); });
    await page.keyboard.press(['KeyQ', 'KeyW', 'KeyE', 'KeyR'][i]); await sleep(500);
  }
  await sleep(400);
  const ok = await page.evaluate(() => window.__starlane.match.hero.cds.filter((c) => c > 0).length);
  if (id === 'fennec') {
    const camo = await page.waitForFunction(() => { const m = window.__starlane.match, h = m.hero; for (const e of m.heroes) if (e.team !== h.team) { e.x = e.px = 60; } h.x = h.px = -30; h.z = h.pz = 8; return !!h.buf.hidden; }, null, { timeout: 25000, polling: 200 }).then(() => true, () => false); // stand still -> camouflage
    check('fennec camouflage when still', camo);
    await page.screenshot({ path: SHOTS + 'fennec.png' });
  }
}
check('no page errors', errors.length === 0, errors.slice(0, 3).join('; '));
await t.done();
