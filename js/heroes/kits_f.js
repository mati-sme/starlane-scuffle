// v10 kit behaviors (batch F). BEHAVIORS-style: (hero, ab, ctx, aim) => false | void. Borrow aim / bot rules via aimAs / botAs.
import { dealDamage, forEachEnemy, applyStatus } from '../game/combat.js';
import { particles, FRAME } from '../render/particles.js';
import { vfx } from '../render/vfx.js';

const fx = (h) => h.def.fx ?? h.def;

export const KITS_F = {
  // Spore Pop: plant a hidden mushroom at the aim point. Only the planter's team ever sees it (a small glowing cap ring);
  // after `arm` s it pops on the first enemy hero / minion that steps close: area damage + slow, plus an optional lingering
  // spore cloud. Up to `max` mushrooms stay out; the oldest fizzles when you plant one more. Charges come from ab.charges.
  sporetrap(h, ab, ctx, aim) {
    const col = fx(h).color, acc = fx(h).accent, d = Math.min(aim.dist ?? ab.range, ab.range);
    const x = h.x + aim.dx * d, z = h.z + aim.dz * d, arm = ab.arm ?? 1.0, R = ab.radius;
    const list = (h._spores ??= []).filter((s) => !s.done);
    while (list.length >= (ab.max ?? 5)) list.shift().done = true;
    const me = { done: false, x, z };
    list.push(me);
    h._spores = list;
    const seen = () => h.team === (ctx.myTeam ?? 0); // invisible to the other team
    if (seen()) vfx.ring(x, 0.2, z, acc, 1.4, 0.4);
    particles.burst(h.x, 1.2, h.z, 6, { color: [col, acc], speed: 2, up: 2, size: 0.4, life: 0.4, frame: FRAME.sparkle, grav: 3 });
    let blink = 0;
    ctx.anim(ab.dur, (u, dt) => {
      if (me.done) return;
      const age = u * ab.dur;
      if (u >= 1) { me.done = true; return; }
      if (seen() && (blink -= dt) <= 0) {
        blink = 0.7;
        vfx.decal(x, z, col, 0.75, 0.6);
        particles.emit(x, 0.5, z, 0, 0.6, 0, acc, 0.35, 0.6, FRAME.dot);
      }
      if (age < arm) return;
      let hit = false;
      forEachEnemy(ctx, h.team, x, z, ab.trigger ?? 1.3, (e) => { if (e.type === 'hero' || e.type === 'minion') hit = true; });
      if (!hit) return;
      me.done = true;
      vfx.ring(x, 0.25, z, acc, R * 1.3, 0.45);
      vfx.flash(x, 1, z, col, R * 1.1, 0.3);
      vfx.decal(x, z, col, R, 0.9);
      particles.burst(x, 0.6, z, 22, { color: [col, acc, 0xFFFFFF], speed: 4, up: 4, size: 0.7, life: 0.8, frame: FRAME.sparkle, grav: 2 });
      forEachEnemy(ctx, h.team, x, z, R, (e) => {
        dealDamage(e, ab.dmg, h, true);
        if (e.alive && ab.slow) applyStatus(e, 'slow', ab.slowT ?? 2);
      });
      if (ab.fieldAfter) ctx.zones.addField({ team: h.team, src: h, x, z, color: col, r: R, ...ab.fieldAfter });
      ctx.rig.shake(0.12);
    });
  },
};
