// Summoner spells: every hero carries two of Flash / Barrier / Ignite. castSpell returns false when there is nothing to do (no cooldown spent).
import { PAL } from '../config.js';
import { bus } from '../core/bus.js';
import { vfx } from '../render/vfx.js';
import { particles, FRAME } from '../render/particles.js';
import { giveShield, dealDamage, sim } from './combat.js';

export const FIRE = 0xFF7A2E;
export const DEFAULT_SPELLS = ['flash', 'barrier'];
const FLASH_DIST = 4, FLASH_T = 0.12, BARRIER_T = 3, IGNITE_RANGE = 6, IGNITE_T = 4, IGNITE_TICK = 0.5;

export const SPELLS = {
  flash: { name: 'Flash', blurb: 'Blink forward', cd: 100, color: PAL.shield },
  barrier: { name: 'Barrier', blurb: 'Shield for 3s', cd: 100, color: PAL.gold },
  ignite: { name: 'Ignite', blurb: 'Burn a nearby foe', cd: 75, color: FIRE },
};
export const SPELL_IDS = Object.keys(SPELLS);
export const cleanSpells = (v) => (Array.isArray(v) && v.length === 2 && v[0] !== v[1] && v.every((id) => id in SPELLS) ? [v[0], v[1]] : null);

// Burning target: the player's current target if it is an enemy champion in range, else the nearest one.
function igniteTarget(h, ctx) {
  const ok = (e) => e.alive && e.team !== h.team && !e.untarget && !e.hidden && Math.hypot(e.x - h.x, e.z - h.z) - e.radius <= IGNITE_RANGE;
  if (h.aim?.type === 'hero' && ok(h.aim)) return h.aim;
  let best = null, bd = Infinity;
  for (const e of ctx.heroes) {
    const d = Math.hypot(e.x - h.x, e.z - h.z);
    if (ok(e) && d < bd) { best = e; bd = d; }
  }
  return best;
}

const CAST = {
  flash(h) {
    const moving = h.moveAmt > 0.15 && (h.dirx || h.dirz);
    const dx = moving ? h.dirx : Math.sin(h.face), dz = moving ? h.dirz : Math.cos(h.face);
    const d = Math.hypot(dx, dz) || 1;
    h.walkTo = null;
    h.runScript({
      dur: FLASH_T, x1: h.x + (dx / d) * FLASH_DIST, z1: h.z + (dz / d) * FLASH_DIST,
      tick(self) { particles.emit(self.x, 1, self.z, 0, 0.4, 0, PAL.shield, 0.7, 0.3, FRAME.sparkle); },
      done: arrive,
    });
  },
  barrier(h) { giveShield(h, 110 + 14 * h.level, BARRIER_T); },
  ignite(h, ctx) {
    const t = igniteTarget(h, ctx);
    if (!t) return false;
    if (!sim.guest) t.burn = { // the host owns the burn; a guest only shows the burst and gets the flag back in snapshots
      t: IGNITE_T, tick: IGNITE_TICK, dmg: (55 + 9 * h.level) / (IGNITE_T / IGNITE_TICK), src: h };
    return t;
  },
};

// Applies the spell. Returns false if it did nothing (Ignite with nobody near), else the burn target (Ignite) or true.
export function castSpell(h, id, ctx) {
  const r = CAST[id](h, ctx);
  return r === undefined ? true : r;
}

function arrive(h) {
  vfx.ring(h.x, 0.2, h.z, PAL.shield, 3.2, 0.35);
  vfx.flash(h.x, 1, h.z, PAL.shield, 2.2, 0.2);
  particles.burst(h.x, 1, h.z, 14, { color: [PAL.shield, 0xffffff], speed: 5, up: 2, size: 0.7, life: 0.45, frame: FRAME.sparkle, grav: 1 });
}

// The cast burst (also replayed on online guests from the host's event). `target` is the burning hero for Ignite.
export function spellFx(h, id, target = null) {
  if (id === 'flash') {
    vfx.ghost(h.x, h.z, PAL.shield, 0.45);
    vfx.ring(h.x, 0.2, h.z, PAL.shield, 3.2, 0.35);
    particles.burst(h.x, 1, h.z, 16, { color: [PAL.shield, 0xffffff], speed: 4, up: 2, size: 0.7, life: 0.5, frame: FRAME.sparkle, grav: 1 });
  } else if (id === 'barrier') {
    vfx.column(h.x, h.z, PAL.gold, 0.7);
    vfx.ring(h.x, 0.2, h.z, PAL.gold, 4, 0.5);
    vfx.flash(h.x, 1.3, h.z, PAL.gold, 3, 0.3);
    particles.burst(h.x, 1, h.z, 18, { color: [PAL.gold, PAL.star], speed: 3.5, up: 3, size: 0.7, life: 0.7, frame: FRAME.star, grav: 1 });
  } else if (id === 'ignite' && target) {
    vfx.beam(h.x, 1.2, h.z, target.x, 1.2, target.z, FIRE, 0.35, 0.3);
    vfx.ring(target.x, 0.2, target.z, FIRE, 3, 0.45);
    vfx.flash(target.x, 1.3, target.z, FIRE, 2.4, 0.25);
    particles.burst(target.x, 1.2, target.z, 16, { color: [FIRE, 0xFFD23F, 0xffffff], speed: 4, up: 4, size: 0.8, life: 0.6, frame: FRAME.sparkle, grav: 1 });
  }
}

// Per-frame flames on a burning hero (render time, host and guest).
export function burnFx(h, dt) {
  if ((h._burnT = (h._burnT ?? 0) - dt) > 0) return;
  h._burnT = 0.07;
  particles.emit(h.rx + (Math.random() - 0.5) * 0.9, 0.6 + Math.random() * 0.8, h.rz + (Math.random() - 0.5) * 0.9, 0, 3, 0, Math.random() < 0.5 ? FIRE : 0xFFD23F, 0.6, 0.5, FRAME.sparkle);
}

// Host sim: tick the burn on `h` (damage every IGNITE_TICK seconds, credited to the igniter).
export function tickBurn(h, dt) {
  const b = h.burn;
  if (!b) return;
  b.t -= dt;
  b.acc = (b.acc ?? 0) + dt;
  while (b.acc >= b.tick) { b.acc -= b.tick; dealDamage(h, b.dmg, b.src); if (!h.alive) break; }
  if (b.t <= 0 || !h.alive) h.burn = null;
}

bus.on('spell', ({ hero, id, target }) => spellFx(hero, id, target));
