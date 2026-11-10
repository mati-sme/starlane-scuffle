// Damage, hit feedback, status effects and the star-poof defeat animation.
import { PAL, TEAM, TOWER, CORE, HERO } from '../config.js';
import { bus } from '../core/bus.js';
import { particles, poofStars, FRAME } from '../render/particles.js';
import { vfx } from '../render/vfx.js';
import { hitMul } from './factions.js';

export const sim = { guest: false, bonus: [{}, {}] }; // guest: damage is the host's business, nothing is dealt locally. bonus[team]: dmg / dr / spd / minDmg / minHp / struct from epic bosses (match.js)
export const DYING = 0.25;
export const AIR = 0.7; // knock-up hang time
const SPARK = { color: PAL.gold, speed: 2.5, up: 1.5, size: 0.35, life: 0.35, frame: FRAME.sparkle, grav: 3 };

const dmgEv = { t: null, amount: 0, src: null, skill: false }; // reused: listeners must not keep it

// Any entity: { type, team, x, z, hp, maxHp, alive, hitY, flash, squash, dying }
// src.outMul scales outgoing damage (hero level / upgrades / bot difficulty); heroes may carry shieldHp.
export function dealDamage(t, amount, src, skill = false) {
  if (sim.guest || !t.alive || t.untarget) return;
  if (src?.outMul) amount *= src.outMul;
  if (t.inMul) amount *= t.inMul; // season event: damage taken
  if (src) amount *= hitMul(src, t); // faction passives (Dark bonus, Water slow)
  if (t.buf?.dr) amount *= 1 - t.buf.dr.v;
  if (t.shielded && src?.type === 'hero') amount *= TOWER.shield; // backdoor: no friendly minions nearby
  const sb = sim.bonus[src?.team];
  if (sb) {
    if (src.type === 'hero') amount *= 1 + (sb.dmg ?? 0);
    else if (src.type === 'minion') amount *= 1 + (sb.minDmg ?? 0);
    if (t.type === 'tower' || t.type === 'core') amount *= 1 + (sb.struct ?? 0);
  }
  if (t.type === 'hero' && sim.bonus[t.team]?.dr) amount *= 1 - sim.bonus[t.team].dr;
  if (t.armor) amount *= 100 / (100 + t.armor);
  if (src?.type === 'hero' && (t.type === 'tower' || t.type === 'core')) amount *= HERO.structMul; // v9: champions really can take bases down
  if (t.pulseT > 0) amount *= 1 - CORE.pulseDr; // nexus shield pulse
  SPARK.color = TEAM[src?.team]?.main ?? PAL.gold;
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
  if (src?.buf?.lifesteal) heal(src, amount * src.buf.lifesteal.v);
  if (src?.gear?.ls && t.type !== 'tower' && t.type !== 'core') heal(src, amount * src.gear.ls); // gear lifesteal
  if (t.buf?.undying && t.hp < 1) t.hp = 1;
  t.flash = 0.08;
  t.squash = 1;
  if (src?.type === 'hero') vfx.ring(t.x, t.hitY ?? 1, t.z, SPARK.color, 1.2, 0.15); // every hero hit gets a visible flash
  if (skill && src?.def) { // skill hits: a white-hot burst in the caster's ability color
    const c = src.def.fx?.color ?? src.def.accent;
    vfx.flash(t.x, (t.hitY ?? 1) + 0.3, t.z, c, 1.6, 0.18);
    particles.burst(t.x, t.hitY ?? 1, t.z, 8, { color: [c, 0xffffff], speed: 5, up: 2.5, size: 0.6, life: 0.4, frame: 2, grav: 4 });
  }
  particles.burst(t.x, t.hitY ?? 1, t.z, 6, SPARK);
  if (t.type === 'minion' && src) {
    const dx = t.x - src.x, dz = t.z - src.z, d = Math.hypot(dx, dz) || 1;
    t.x += (dx / d) * 0.3;
    t.z += (dz / d) * 0.3;
  }
  if (t.type === 'hero' && src) {
    t.attacker = src; t.attackerAge = 0;
    if (src.type === 'hero') src.aggroAge = 0; // towers punish heroes that hit heroes
  }
  if (t.type === 'camp' && src) t.provoked = src;
  bus.emit('hit', t);
  dmgEv.t = t; dmgEv.amount = amount; dmgEv.src = src; dmgEv.skill = skill;
  bus.emit('dmg', dmgEv);
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
  for (const e of ctx.camps.list) test(e);
}

// ---- status effects: stun / root / slow / air (knock-up) timers and forced movement ----
const SOLID = new Set(['tower', 'core', 'camp']);

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

// Calls fn(h) for every living hero of `team` (including the caster) whose edge is within r of (x, z).
export function forEachAlly(ctx, team, x, z, r, fn) {
  for (const h of ctx.heroes) if (h.team === team && h.alive && Math.hypot(h.x - x, h.z - z) - h.radius <= r) fn(h);
}

// ---- timed hero buffs: speed / aspd / dr / lifesteal / hidden / untarget / undying (value v for t seconds) ----
export function addBuff(e, key, v, dur) {
  const b = e.buf[key];
  if (!b || v >= b.v || b.t < dur) e.buf[key] = { v: Math.max(v, b?.v ?? 0), t: Math.max(dur, b?.t ?? 0) };
}
export const buff = (e, key) => e.buf?.[key]?.v ?? 0;
export function tickBuffs(e, dt) {
  for (const k in e.buf) if ((e.buf[k].t -= dt) <= 0) delete e.buf[k];
}
export function giveShield(e, amount, dur) {
  e.shieldHp = Math.min(e.shieldHp + amount, amount * 1.5);
  e.shieldT = Math.max(e.shieldT, dur);
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
