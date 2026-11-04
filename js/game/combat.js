// Damage, hit feedback, status effects and the star-poof defeat animation.
import { PAL, TEAM } from '../config.js';
import { bus } from '../core/bus.js';
import { particles, poofStars, FRAME } from '../render/particles.js';
import { vfx } from '../render/vfx.js';

export const DYING = 0.25;
export const AIR = 0.7; // knock-up hang time
const SPARK = { color: PAL.gold, speed: 2.5, up: 1.5, size: 0.35, life: 0.35, frame: FRAME.sparkle, grav: 3 };

// Any entity: { type, team, x, z, hp, maxHp, alive, hitY, flash, squash, dying }
// src.outMul scales outgoing damage (hero level / upgrades / bot difficulty); heroes may carry shieldHp.
export function dealDamage(t, amount, src) {
  if (!t.alive) return;
  if (src?.outMul) amount *= src.outMul;
  SPARK.color = src ? TEAM[src.team].main : PAL.gold;
  if (t.shieldHp > 0) {
    const soak = Math.min(t.shieldHp, amount);
    t.shieldHp -= soak;
    amount -= soak;
    if (amount <= 0) {
      particles.burst(t.x, t.hitY ?? 1, t.z, 4, { ...SPARK, color: PAL.shield });
      return;
    }
  }
  t.hp -= amount;
  t.flash = 0.08;
  t.squash = 1;
  particles.burst(t.x, t.hitY ?? 1, t.z, 6, SPARK);
  if (t.type === 'minion' && src) {
    const dx = t.x - src.x, dz = t.z - src.z, d = Math.hypot(dx, dz) || 1;
    t.x += (dx / d) * 0.3;
    t.z += (dz / d) * 0.3;
  }
  if (t.type === 'hero' && src) { t.attacker = src; t.attackerAge = 0; }
  bus.emit('hit', t);
  if (t.hp <= 0) {
    t.hp = 0;
    t.alive = false;
    t.dying = DYING;
    t.killer = src ?? null;
    bus.emit('down', t);
  }
}

export function tickHitFx(e, dt) {
  if (e.flash > 0) e.flash -= dt;
  if (e.squash > 0) e.squash = Math.max(0, e.squash - dt * 5);
}

// Calls fn(e) for every living, hittable enemy of `team` whose edge is within r of (x, z).
export function forEachEnemy(ctx, team, x, z, r, fn) {
  const test = (e) => {
    if (e.team === team || !e.alive || e.vulnerable === false) return;
    if (Math.hypot(e.x - x, e.z - z) - (e.radius ?? 0) <= r) fn(e);
  };
  for (const e of ctx.heroes) test(e);
  for (const e of ctx.minions.list) test(e);
  for (const e of ctx.structures) test(e);
}

// ---- status effects: stun / root / slow / air (knock-up) timers and forced movement ----
const SOLID = new Set(['tower', 'core']);

export function applyStatus(e, kind, dur) {
  if (SOLID.has(e.type) || !e.alive) return;
  if (!(e[kind] > dur)) e[kind] = dur;
}

export function tickStatus(e, dt) {
  if (e.stun > 0) e.stun -= dt;
  if (e.root > 0) e.root -= dt;
  if (e.slow > 0) e.slow -= dt;
  if (e.air > 0) e.air -= dt;
  const p = e.pull;
  if (!p) return;
  const dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz), step = p.speed * dt;
  if (d <= step || (p.t -= dt) <= 0) { e.x = p.x; e.z = p.z; e.pull = null; return; }
  e.x += (dx / d) * step;
  e.z += (dz / d) * step;
}

// Drag an entity to (x, z) over `dur` seconds.
export function pullTo(e, x, z, dur) {
  if (SOLID.has(e.type) || !e.alive) return;
  e.pull = { x, z, speed: Math.hypot(x - e.x, z - e.z) / dur, t: dur + 0.05 };
}

// Shove an entity `dist` along (dx, dz).
export function shove(e, dx, dz, dist, dur) {
  const d = Math.hypot(dx, dz) || 1;
  pullTo(e, e.x + (dx / d) * dist, e.z + (dz / d) * dist, dur);
}

export function heal(e, amount) {
  if (!e.alive) return;
  e.hp = Math.min(e.maxHp, e.hp + amount);
}

// Height of a knocked-up entity.
export const airLift = (e) => (e.air > 0 ? Math.sin(Math.PI * (1 - e.air / AIR)) * 1.6 : 0);

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
