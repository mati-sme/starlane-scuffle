// v9.2 kit audit (browser, headless): every champion has Q W E R + a passive, every skill kind exists, and every slot actually casts
// with enemies in range without throwing. Prints a kit table. Run: node tests/v92-kits.mjs [id,id,...]
import { launch } from './_pw.mjs';
const only = process.argv[2]?.split(',');
const t = await launch({ seed: { unlockAll: true } });
const { page, check, errors } = t;
const res = await page.evaluate(async (only) => {
  const { HEROES, ROSTER } = await import('/js/heroes/index.js');
  const { BEHAVIORS } = await import('/js/heroes/behaviors.js');
  const { PASSIVE_KINDS } = await import('/js/game/passives.js');
  const { input } = await import('/js/core/input.js');
  const { bus } = await import('/js/core/bus.js');
  const m = window.__starlane.match;
  const NEED = { nthHit: ['n', 'bonus'], firstStrike: ['bonus', 'cool'], hitHaste: ['speed', 't', 'max'], hitCdr: ['sec'], hitSlow: ['t'], hitHeal: ['heal'], execute: ['hp', 'bonus'], castHaste: ['speed', 't'], castShield: ['shield', 't'], castEmpower: ['dmg', 't'], castHeal: ['heal'], lowShield: ['hp', 'shield', 't', 'cool'], thorns: ['dmg'], stackDr: ['per', 'max', 't'], woundedHaste: ['hp', 'speed'], killHeal: ['heal'], auraRegen: ['r', 'hps'], auraHaste: ['r', 'speed'], calmSpeed: ['after', 'speed'], brushSpeed: ['speed'], stillGuard: ['after', 'dr'] };
  const out = [];
  for (const id of ROSTER) {
    if (only && !only.includes(id)) continue;
    const d = HEROES[id], row = { id, role: d.role, problems: [], kinds: [d.s1?.kind, d.s2?.kind, d.s3?.kind, d.ult?.kind], passive: d.passive ? `${d.passive.name} [${d.passive.kind}]` : null, slots: [] };
    if (!d.s3) row.problems.push('no s3');
    if (!d.passive) row.problems.push('no passive');
    else {
      if (!PASSIVE_KINDS.includes(d.passive.kind)) row.problems.push('unknown passive kind ' + d.passive.kind);
      for (const k of NEED[d.passive.kind] ?? []) if (!(d.passive[k] >= 0)) row.problems.push(`passive.${k} missing`);
      if (!d.passive.name || !d.passive.tag || d.passive.tag.length < 8) row.problems.push('passive name/tag text');
    }
    for (const k of ['s1', 's2', 's3', 'ult']) if (d[k] && !BEHAVIORS[d[k].kind]) row.problems.push(`${k} kind ${d[k].kind} has no behavior`);
    if (d.s3 && [d.s1.kind, d.s2.kind, d.ult.kind].includes(d.s3.kind)) row.problems.push('s3 repeats another skill kind of this champion');
    if (row.problems.length) { out.push(row); continue; }
    try {
      m.setHero(id, undefined, [], undefined, undefined); m.reset();
      const h = m.hero; h.level = 9; h.ranks = [3, 3, 3, 3]; h.points = 0; h.recalc(true);
      const foes = m.heroes.filter((x) => x.team === 1), allies = m.heroes.filter((x) => x.team === 0 && x !== h);
      const place = () => { foes.forEach((e, i) => { const a = -0.5 + i * 0.5, r = i === 0 ? 2.4 : 4.2; e.x = h.x + Math.cos(a) * r; e.z = h.z + Math.sin(a) * r; e.hp = e.maxHp = 99999; e.alive = true; e.untarget = false; if (!(e.stun > 0.3)) e.stun = 0.4; }); allies.forEach((a, i) => { a.x = h.x - 2.5; a.z = h.z + i * 1.5; a.hp = a.maxHp * 0.5; }); };
      for (let slot = 0; slot < 4; slot++) {
        const info = { slot, cast: false, no: null, err: null, hit: false };
        const onCast = (e) => { if (e.hero === h && e.slot === slot) info.cast = true; }, onNo = (e) => { if (e.hero === h && e.slot === slot) info.no = e.why; };
        bus.on('cast', onCast); bus.on('noCast', onNo);
        h.x = 0; h.z = 0; place(); h.cds[slot] = 0; h.alive = true; h.hp = h.maxHp; h.stun = 0; h.script = null; h.windup = 0;
        const hp0 = foes.reduce((s, e) => s + e.hp, 0), pos0 = foes.map((e) => [e.x, e.z]);
        try {
          input.cast[slot] = true;
          for (let i = 0; i < 45; i++) { m.update(1 / 30); m.projectiles.update(1 / 30); if (i < 2) place(); h.hp = h.maxHp; for (const e of foes) { e.alive = true; if (!(e.stun > 0.3)) e.stun = 0.4; } }
        } catch (e) { info.err = String(e.message ?? e).slice(0, 120); }
        const hp1 = foes.reduce((s, e) => s + e.hp, 0);
        info.hit = hp1 < hp0 - 1 || foes.some((e, i) => Math.hypot(e.x - pos0[i][0], e.z - pos0[i][1]) > 0.8 || e.slow > 0 || e.root > 0 || e.air > 0) || h.shieldHp > 0 || h.buf && Object.keys(h.buf).length > 0 || h.effects.length > 0 || m.zones.fields.length > 0 || m.zones.turrets.length > 0 || Math.hypot(h.x, h.z) > 0.8;
        bus.off?.('cast', onCast); bus.off?.('noCast', onNo);
        row.slots.push(info);
        m.zones.reset();
        if (info.err) row.problems.push(`slot ${slot} threw: ${info.err}`);
        else if (!info.cast && !(info.no === 'target' && h.ab[slot].ally)) row.problems.push(`slot ${slot} did not cast (${info.no})`);
      }
    } catch (e) { row.problems.push('harness: ' + String(e.message).slice(0, 100)); }
    out.push(row);
  }
  return out;
}, only);
let bad = 0;
for (const r of res) { if (r.problems.length) { bad++; console.log('FAIL', r.id, r.problems.join('; ')); } }
if (process.env.TABLE) for (const r of res) console.log(r.id.padEnd(10), r.role.padEnd(9), r.kinds.join(' / '), '|', r.passive);
check(`all ${res.length} champions have a working Q W E R + passive`, bad === 0, `${bad} with problems`);
check('no page errors', errors.length === 0, errors.slice(0, 3).join('; '));
await t.done();
