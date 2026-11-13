// Champion passives (v9): every champion has one always-on combat passive (data: `passive: { name, tag, kind, ...params }`).
// The engine is event driven. Combat events are queued on the hero (bus 'dmg' / 'cast' / 'down') and resolved in tickPassive() from Hero.update,
// so a passive never deals damage from inside a bus listener (the damage event object is reused). Host / solo only: guests mirror the result.
//
// kinds (params):
//   nthHit     { n, bonus, slow?, stun?, heal? }   every n-th basic attack adds `bonus` damage (+ effects)
//   firstStrike{ bonus, cool }                     the first hit on a fresh target adds bonus% (0.4 = +40%)
//   hitHaste   { speed, t, max }                   basic hits stack move speed
//   hitCdr     { sec, slots }                      basic hits shave `sec` off the cooldown of `slots`
//   hitSlow    { t }                               basic hits slow the target
//   hitHeal    { heal }                            basic hits heal you
//   execute    { hp, bonus }                       basics deal +bonus% to targets under hp% (heroes)
//   castHaste  { speed, t }                        casting a skill grants speed
//   castShield { shield, t }                       casting a skill grants a small shield
//   castEmpower{ dmg, t }                          the next basic after a skill hits harder
//   castHeal   { heal }                            casting heals you (fraction of max HP)
//   lowShield  { hp, shield, t, cool }             below hp% you get a shield once per cooldown
//   thorns     { dmg }                             enemy heroes that hit you take damage back
//   stackDr    { per, max, t }                     every hit taken stacks damage reduction
//   woundedHaste{ hp, speed }                      below hp% you run faster
//   killHeal   { heal, cdr }                       takedowns / assists heal and refresh a little cooldown
//   auraRegen  { r, hps }                          nearby allies regenerate
//   auraHaste  { r, speed }                        nearby allies run faster
//   calmSpeed  { after, speed }                    out of combat for `after` s = faster
//   brushSpeed { speed }                           faster inside bushes
//   stillGuard { after, dr }                       standing still for `after` s = damage reduction
//   camo       { after, aspd, t }                  v10: stand still (or sit in a bush) for `after` s out of combat = camouflaged (hidden);
//                                                  the first moment you pop out you get +aspd attack speed for t s
import { bus } from '../core/bus.js';
import { sim, dealDamage, addBuff, giveShield, heal, applyStatus, forEachAlly } from './combat.js';
import { inBrush } from '../world/arena.js';
import { GOLD } from '../config.js';
import { particles, FRAME } from '../render/particles.js';

export const PASSIVE_KINDS = ['nthHit', 'firstStrike', 'hitHaste', 'hitCdr', 'hitSlow', 'hitHeal', 'execute', 'castHaste', 'castShield', 'castEmpower', 'castHeal', 'lowShield', 'thorns', 'stackDr', 'woundedHaste', 'killHeal', 'auraRegen', 'auraHaste', 'calmSpeed', 'brushSpeed', 'stillGuard', 'camo'];

const q = (h) => (h.ps ??= {}).q ??= [];
const isFoe = (t) => t && (t.type === 'hero' || t.type === 'minion' || t.type === 'camp');

let wired = false;
export function wirePassives(getMatch) {
  if (wired) return;
  wired = true;
  bus.on('dmg', (e) => {
    const s = e.src, t = e.t;
    if (s?.type === 'hero' && s.passive && !e.skill && isFoe(t) && !sim.guest) q(s).push({ k: 'hit', t, amount: e.amount });
    if (t?.type === 'hero' && t.passive && s && !sim.guest) q(t).push({ k: 'hurt', src: s, amount: e.amount });
  });
  bus.on('cast', ({ hero, slot }) => { if (hero.passive && !sim.guest) q(hero).push({ k: 'cast', slot }); });
  bus.on('down', (v) => {
    const m = getMatch();
    if (!m || sim.guest || v.type !== 'hero') return;
    const k = v.killer;
    if (k?.type === 'hero' && k.passive) q(k).push({ k: 'kill', w: 1 });
    for (const h of m.heroes) if (h !== k && h.team === (k?.team ?? 1 - v.team) && h.alive && h.passive && Math.hypot(h.x - v.x, h.z - v.z) <= GOLD.assistR) q(h).push({ k: 'kill', w: 0.5 });
  });
}

const puff = (h, color) => particles.burst(h.x, 2.2, h.z, 5, { color, speed: 2, up: 2.5, size: 0.45, life: 0.5, frame: FRAME.sparkle, grav: 0 });
const hue = (h) => h.def.fx?.color ?? h.def.accent;

// Called every sim step from Hero.update for living heroes.
export function tickPassive(h, dt, ctx) {
  const p = h.passive;
  if (!p || sim.guest) return;
  const st = h.ps ??= {};
  const list = st.q;
  st.t = (st.t ?? 0) + dt;
  if (list?.length) {
    for (const ev of list.splice(0)) resolve(h, p, ev, ctx, st);
  }
  switch (p.kind) {
    case 'woundedHaste': if (h.hp < h.maxHp * p.hp) addBuff(h, 'pspeed', p.speed, 0.4); break;
    case 'calmSpeed': if (h.sinceHit > p.after && h.atkAge > p.after) addBuff(h, 'pspeed', p.speed, 0.3); break;
    case 'brushSpeed': if (inBrush(h.x, h.z)) addBuff(h, 'pspeed', p.speed, 0.3); break;
    case 'camo': {
      if (h.moveAmt < 0.1 || inBrush(h.x, h.z)) st.still = (st.still ?? 0) + dt; else st.still = 0;
      const calm = (h.atkAge ?? 9) > 1.2 && (h.sinceHit ?? 9) > 1.2;
      if (st.still > p.after && calm) {
        addBuff(h, 'hidden', 1, 0.35);
        if (!st.camo) { st.camo = true; puff(h, hue(h)); }
      } else if (st.camo && !h.buf.hidden) { st.camo = false; addBuff(h, 'aspd', p.aspd, p.t); puff(h, 0xFFFFFF); }
      break;
    }
    case 'stillGuard': {
      if (h.moveAmt < 0.1) st.still = (st.still ?? 0) + dt; else st.still = 0;
      if (st.still > p.after) addBuff(h, 'pdr', p.dr, 0.3);
      break;
    }
    case 'auraRegen': forEachAlly(ctx, h.team, h.x, h.z, p.r, (a) => { if (a.hp < a.maxHp) a.hp = Math.min(a.maxHp, a.hp + p.hps * dt); }); break;
    case 'auraHaste': forEachAlly(ctx, h.team, h.x, h.z, p.r, (a) => addBuff(a, 'pspeed', p.speed, 0.4)); break;
    case 'hitHaste': if (st.stacks > 0 && (st.stackT -= dt) <= 0) st.stacks = 0; else if (st.stacks > 0) addBuff(h, 'pspeed', p.speed * st.stacks, 0.3); break;
    case 'stackDr': if (st.stacks > 0 && (st.stackT -= dt) <= 0) st.stacks = 0; else if (st.stacks > 0) addBuff(h, 'pdr', p.per * st.stacks, 0.3); break;
    default:
  }
  if (st.cool > 0) st.cool -= dt;
}

function resolve(h, p, ev, ctx, st) {
  const k = p.kind;
  if (ev.k === 'hit') {
    const t = ev.t;
    switch (k) {
      case 'nthHit':
        st.n = (st.n ?? 0) + 1;
        if (st.n >= p.n) {
          st.n = 0;
          if (t.alive) { dealDamage(t, p.bonus, h, true); if (p.slow) applyStatus(t, 'slow', p.slow); if (p.stun) applyStatus(t, 'stun', p.stun); puff(t, hue(h)); }
          if (p.heal) heal(h, h.maxHp * p.heal);
        }
        break;
      case 'firstStrike': {
        const seen = st.seen ??= new Map(), last = seen.get(t);
        if (t.alive && (last === undefined || st.t - last > p.cool)) { dealDamage(t, ev.amount * p.bonus, h, true); puff(t, hue(h)); }
        seen.set(t, st.t);
        break;
      }
      case 'hitHaste': st.stacks = Math.min(p.max, (st.stacks ?? 0) + 1); st.stackT = p.t; break;
      case 'hitCdr': for (const s of p.slots ?? [0, 1, 2]) if (h.cds[s] > 0) h.cds[s] = Math.max(0, h.cds[s] - p.sec); break;
      case 'hitSlow': if (t.alive) applyStatus(t, 'slow', p.t); break;
      case 'hitHeal': heal(h, p.heal); break;
      case 'execute': if (t.alive && t.type === 'hero' && t.hp < t.maxHp * p.hp) { dealDamage(t, ev.amount * p.bonus, h, true); puff(t, 0xFF5A3C); } break;
      case 'castEmpower': break;
      default:
    }
  } else if (ev.k === 'cast') {
    switch (k) {
      case 'castHaste': addBuff(h, 'pspeed', p.speed, p.t); puff(h, hue(h)); break;
      case 'castShield': giveShield(h, p.shield, p.t); break;
      case 'castEmpower': h.nextBasic = { dmg: p.dmg, t: p.t, range: p.range ?? 0 }; break;
      case 'castHeal': heal(h, h.maxHp * p.heal); puff(h, 0x6BE89A); break;
      default:
    }
  } else if (ev.k === 'hurt') {
    switch (k) {
      case 'thorns': if (ev.src.type === 'hero' && ev.src.alive && st.cool <= 0) { dealDamage(ev.src, p.dmg, h, true); st.cool = 0.4; puff(ev.src, hue(h)); } break;
      case 'stackDr': st.stacks = Math.min(p.max, (st.stacks ?? 0) + 1); st.stackT = p.t; break;
      case 'lowShield':
        if (h.hp < h.maxHp * p.hp && (st.lowCool ?? -99) < st.t - p.cool) { st.lowCool = st.t; giveShield(h, p.shield, p.t); puff(h, 0x9CE8FF); }
        break;
      default:
    }
  } else if (ev.k === 'kill' && k === 'killHeal') {
    heal(h, h.maxHp * p.heal * ev.w);
    if (p.cdr) for (let s = 0; s < 4; s++) if (h.cds[s] > 0) h.cds[s] = Math.max(0, h.cds[s] - p.cdr * ev.w);
    puff(h, 0x6BE89A);
  }
}

// One-line text for the detail pane / tooltip.
export const passiveText = (p) => (p ? `${p.name}: ${p.tag}` : '');
