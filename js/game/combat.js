// Damage, hit feedback and the star-poof defeat animation.
import { PAL, TEAM } from '../config.js';
import { bus } from '../core/bus.js';
import { particles, poofStars, FRAME } from '../render/particles.js';
import { vfx } from '../render/vfx.js';

export const DYING = 0.25;
const SPARK = { color: PAL.gold, speed: 2.5, up: 1.5, size: 0.35, life: 0.35, frame: FRAME.sparkle, grav: 3 };

// Any entity: { type, team, x, z, hp, maxHp, alive, hitY, flash, squash, dying }
export function dealDamage(t, amount, src) {
  if (!t.alive) return;
  t.hp -= amount;
  t.flash = 0.08;
  t.squash = 1;
  SPARK.color = src ? TEAM[src.team].main : PAL.gold;
  particles.burst(t.x, t.hitY ?? 1, t.z, 6, SPARK);
  if (t.type === 'minion' && src) {
    const dx = t.x - src.x, dz = t.z - src.z, d = Math.hypot(dx, dz) || 1;
    t.x += (dx / d) * 0.3;
    t.z += (dz / d) * 0.3;
  }
  bus.emit('hit', t);
  if (t.hp <= 0) {
    t.hp = 0;
    t.alive = false;
    t.dying = DYING;
    bus.emit('down', t);
  }
}

export function tickHitFx(e, dt) {
  if (e.flash > 0) e.flash -= dt;
  if (e.squash > 0) e.squash = Math.max(0, e.squash - dt * 5);
}

// 1 -> 1.2 over 0.1 s, then 1.2 -> 0 over 0.15 s.
export function dyingScale(e) {
  const el = DYING - e.dying;
  return el < 0.1 ? 1 + 0.2 * (el / 0.1) : 1.2 * Math.max(0, 1 - (el - 0.1) / 0.15);
}

export function poof(e, n) {
  const y = e.hitY ?? 1;
  poofStars(e.x, y, e.z, n);
  vfx.ring(e.x, 0.2, e.z, PAL.star, n > 20 ? 4 : 2.2, 0.4);
}
