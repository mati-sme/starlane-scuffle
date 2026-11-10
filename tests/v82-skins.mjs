import assert from 'node:assert/strict';
import { PALETTES, SKIN_PRICE, paint, toHsl, fromHsl, buySkin, equip, equipped, ownsSkin, resetSkins, portraitShift } from '../js/game/skins.js';
import { resetProfile, profile, unlockPrice } from '../js/game/progress.js';
import { ROSTER_DEFS } from '../js/heroes/roster.js';
assert.ok(SKIN_PRICE < unlockPrice(0));
assert.equal(Object.keys(PALETTES).length, 3);
for (const d of ROSTER_DEFS) for (const k of Object.keys(PALETTES)) {
  const p = paint(d, k); assert.ok(p.color >= 0 && p.color <= 0xffffff && p.accent >= 0 && p.accent <= 0xffffff);
  const [h, s] = toHsl(p.color); assert.ok(Math.abs(h - PALETTES[k].hue) < 0.03 || s < 0.05, `${d.id} ${k} hue ${h}`);
  assert.ok(Number.isFinite(portraitShift(d, k)));
}
assert.deepEqual(paint(ROSTER_DEFS[0], 'default'), { color: ROSTER_DEFS[0].color, accent: ROSTER_DEFS[0].accent });
assert.equal(fromHsl(...toHsl(0x336699)) >> 0, 0x336699);
resetProfile({ coins: 100 }); resetSkins();
assert.equal(equipped('nyx'), 'default'); assert.equal(buySkin('nyx', 'frost').ok, true);
assert.equal(profile().coins, 40); assert.equal(equipped('nyx'), 'frost'); assert.equal(buySkin('nyx', 'frost').ok, false);
assert.equal(buySkin('nyx', 'ember').ok, false); // 40 < 60
assert.ok(equip('nyx', 'default')); assert.equal(equipped('nyx'), 'default'); assert.ok(ownsSkin('nyx', 'frost')); assert.equal(equip('nyx', 'berry'), false);
console.log('v82-skins OK');
