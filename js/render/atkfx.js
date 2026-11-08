// v7.3 per-champion basic-attack looks, keyed by hero id: the color, projectile shape, trail and impact of every basic,
// so an arrow reads as an arrow, a fireball trails embers and a hammer leaves a crater. Visual only — damage, cooldowns
// and targeting stay in behaviors.js. Everything draws from the existing pooled vfx / particle systems; basics cap their
// hit bursts at ~6-10 particles. Colors are kept saturated (no white overlay arcs) and ground effects get vfx's dark
// underlay so they read on bright stone and grass.
import * as THREE from 'three';
import { GROUND } from '../config.js';
import { vfx } from './vfx.js';
import { particles, FRAME } from './particles.js';

// melee: swing kind (see SWING), proj: shape / trail / hit kinds (see projectiles.js SHAPES, trailFx, hitFx below).
// c = main color, c2 = accent (trail / sparks), size = projectile scale multiplier, core = white mix in the core (0..1).
const P = {
  // ── Light ──
  bulwark: { c: 0xFFC76B, c2: 0xFFE2A8, melee: 'bash' },
  corsa: { c: 0xBFD4FF, c2: 0x7FA8FF, line: 'spear' },
  glint: { c: 0xFF7DDF, c2: 0xFF3DCB, melee: 'katana' },
  cinder: { c: 0xFF7A1A, c2: 0xFFC04A, shape: 'fireball', trail: 'ember', hit: 'burn', size: 1.0 },
  embermaw: { c: 0xFF8A4A, c2: 0xFFC04A, melee: 'lavachop' },
  prism: { c: 0x5CF2FF, c2: 0xB8FFF4, shape: 'gem', trail: 'star', hit: 'prism', size: 1.25 },
  lumen: { c: 0xFFE08A, c2: 0xFFF3C4, shape: 'sun', trail: 'mote', hit: 'heal', size: 1.1, halo: 3.4 },
  solace: { c: 0xFFF0B8, c2: 0xF2C25A, shape: 'bell', trail: 'mote', hit: 'chime', size: 1.45 },
  beacon: { c: 0xFFE27A, c2: 0xFFF4C2, shape: 'lamp', trail: 'spark', hit: 'spark', muzzle: 'cone', size: 1.15 },
  aurora: { c: 0x9BFFD0, c2: 0xC9A2FF, shape: 'arrow', trail: 'frost', hit: 'frost', tail: 1.2, size: 1.2 },
  hymn: { c: 0xFFEDB8, c2: 0xF2C25A, shape: 'note', trail: 'mote', hit: 'chime', size: 1.2 },
  aria: { c: 0x7DFFC0, c2: 0xD8FFEC, shape: 'cross', trail: 'mote', hit: 'cross', size: 1.15 },
  // ── Dark ──
  magnus: { c: 0x9CB0FF, c2: 0x6F8CFF, melee: 'gravfist' },
  ravel: { c: 0xEEF2F7, c2: 0xFFA040, line: 'chain' },
  mirage: { c: 0x7DFFF0, c2: 0xE0FFFF, melee: 'twin' },
  vesper: { c: 0xE4FF7A, c2: 0xB07CFF, melee: 'sickle' },
  nyx: { c: 0xB89BFF, c2: 0x6B4BD8, shape: 'void', trail: 'void', hit: 'void', size: 1.0, rim: 0x1A0E33 },
  shade: { c: 0xFF7A92, c2: 0x8A2A48, melee: 'parasol' },
  wisp: { c: 0x9FE6FF, c2: 0x5CC8FF, melee: 'flicker' },
  razor: { c: 0xFF5A4E, c2: 0xF4F8FF, melee: 'paper' },
  basilisk: { c: 0xC9A8FF, c2: 0x8E6BFF, melee: 'tail' },
  pounce: { c: 0xFFD87A, c2: 0xFFB43A, melee: 'rake' },
  kade: { c: 0xFFD966, c2: 0xFFB43A, shape: 'bolt', trail: 'tracer', hit: 'spark', muzzle: 'gun', tail: 1.4, size: 1.0 },
  comet: { c: 0xBFE6FF, c2: 0xFFD66B, shape: 'star', trail: 'comet', hit: 'star', tail: 1.6, size: 1.2 },
  // ── Water ──
  rime: { c: 0xBFEFFF, c2: 0x7EDBFF, shape: 'shard', trail: 'snow', hit: 'frost', size: 1.2 },
  volt: { c: 0xFFF08A, c2: 0x7FE8FF, melee: 'zap' },
  zephyr: { c: 0xA8D4FF, c2: 0xE2F1FF, shape: 'arrow', trail: 'wind', hit: 'gust', tail: 1.3, size: 1.15 },
  tempo: { c: 0xE7B8FF, c2: 0xB070FF, shape: 'wave', trail: 'none', hit: 'bass', size: 0.85, tail: 0, halo: 1.6 },
  rico: { c: 0xFF7AC0, c2: 0xFFD0EA, shape: 'pinball', trail: 'spark', hit: 'bumper', muzzle: 'gun', size: 1.1, halo: 2.6 },
  tidewall: { c: 0x7FE7F2, c2: 0x3FC2D6, melee: 'clamclap' },
  longshot: { c: 0xFF8A80, c2: 0xFF4A3A, shape: 'quarrel', trail: 'tracer', hit: 'spark', muzzle: 'gun', tail: 1.3, size: 1.25 },
  brine: { c: 0x7FF2DC, c2: 0xC9FFF6, shape: 'bubble', trail: 'drop', hit: 'splash', size: 1.0, tail: 0.3 },
  keel: { c: 0x8FF0E0, c2: 0xC9963A, melee: 'ram' },
  anvil: { c: 0xFFE3A3, c2: 0xFF9A3A, melee: 'forge' },
  cyclone: { c: 0xBDEBFF, c2: 0x7FD8FF, melee: 'gale' },
  harpoon: { c: 0x9FEFFF, c2: 0x5CC8E8, shape: 'harpoon', trail: 'rope', hit: 'splash', tail: 1.2, size: 1.2 },
  // ── Nature ──
  mossback: { c: 0x9BE36B, c2: 0x6FB040, melee: 'barkslam' },
  tremor: { c: 0xFFC27A, c2: 0x9A7650, melee: 'quake' },
  torque: { c: 0xFFB36B, c2: 0xFF7A1A, melee: 'piston' },
  rotor: { c: 0xFF8FA3, c2: 0xFF4D6D, melee: 'axe' },
  bloom: { c: 0xFFB3C6, c2: 0xFF6F91, shape: 'flower', trail: 'petal', hit: 'petal', size: 1.2 },
  petal: { c: 0xD9B3FF, c2: 0xF4E6FF, shape: 'chakram', trail: 'petal', hit: 'petal', size: 1.2 },
  grove: { c: 0xFFC56B, c2: 0x8FD05A, shape: 'seed', trail: 'leaf', hit: 'leaf', size: 1.2 },
  mycel: { c: 0x9DFFE8, c2: 0xE8FFF8, shape: 'spore', trail: 'spore', hit: 'spore', size: 1.0, tail: 0 },
  quill: { c: 0xFFF1D6, c2: 0xE8B070, line: 'rapier' },
  granite: { c: 0xF2C14E, c2: 0x9A9DA4, melee: 'pillar' },
  loom: { c: 0xF8B8FF, c2: 0xFFE0FF, shape: 'needle', trail: 'silk', hit: 'stitch', tail: 1.4, size: 1.3 },
  flint: { c: 0xFFB060, c2: 0xFF6A1A, spread: 'pellets', muzzle: 'gun' },
};

export const atkProfile = (id) => P[id];
const rnd = (a, b) => a + Math.random() * (b - a);
// Additive effects over sunlit stone turn pale hues white; `rich` keeps the hue (more saturation, capped lightness).
const _c = new THREE.Color(), _hsl = {}, RICH = new Map();
export function rich(c) {
  let r = RICH.get(c);
  if (r == null) { _c.set(c).getHSL(_hsl); r = _c.setHSL(_hsl.h, Math.min(1, _hsl.s * 1.2 + 0.25), Math.min(_hsl.l, 0.6)).getHex(); RICH.set(c, r); }
  return r;
}
const hy = (t) => (t.hitY ?? 1) + 0.15;

// ── impacts (melee and ranged share them) ──
// x, y, z: impact point (y = target hit height); k scales the effect.
export function hitFx(kind, x, y, z, c, c2, k = 1) {
  const g = 0.25;
  c = rich(c); c2 = rich(c2);
  switch (kind) {
    case 'burn': // fireball splat: sparks that fall, a small scorch ring
      vfx.flash(x, y, z, c, 1.7 * k, 0.16); vfx.ring(x, g, z, c, 1.7 * k, 0.3); vfx.decal(x, z, c2, 0.9 * k, 0.6);
      particles.burst(x, y, z, 9, { color: [c, c2], speed: 4, up: 3, size: 0.55, life: 0.45, frame: FRAME.dot, grav: 9 });
      return;
    case 'splash': // water: droplets arcing out + two ripple rings on the ground
      vfx.flash(x, y, z, c, 1.4 * k, 0.14); vfx.ring(x, g, z, c, 1.6 * k, 0.32); vfx.ring(x, g + 0.02, z, c2, 2.6 * k, 0.45);
      particles.burst(x, y, z, 9, { color: [c, c2], speed: 3.2, up: 4.5, size: 0.5, life: 0.5, frame: FRAME.dot, grav: 12 });
      return;
    case 'frost': // ice: star flakes + a pale slow-tint ring
      vfx.flash(x, y, z, c, 1.5 * k, 0.15); vfx.ring(x, g, z, c2, 1.9 * k, 0.4); vfx.decal(x, z, c, 0.8 * k, 0.5);
      particles.burst(x, y, z, 8, { color: [c, c2], speed: 3, up: 1.5, size: 0.6, life: 0.5, frame: FRAME.star, grav: 1.5 });
      return;
    case 'prism': // refraction: flash + colored star shards
      vfx.flash(x, y, z, c, 1.8 * k, 0.16); vfx.ring(x, y, z, c2, 1.3 * k, 0.2, true); vfx.ring(x, g, z, c, 1.6 * k, 0.28);
      particles.burst(x, y, z, 8, { color: [c, c2, 0xFF9BF2], speed: 4.5, up: 1.5, size: 0.65, life: 0.4, frame: FRAME.star, grav: 0 });
      return;
    case 'heal': // gentle sun pop
      vfx.flash(x, y, z, c, 1.9 * k, 0.2); vfx.ring(x, g, z, c, 1.7 * k, 0.35);
      particles.burst(x, y, z, 7, { color: [c, c2], speed: 1.8, up: 2.5, size: 0.6, life: 0.6, frame: FRAME.sparkle, grav: -1 });
      return;
    case 'chime': // two stacked expanding rings (the "ring" of a bell) + a ground ring
      vfx.ring(x, y, z, c, 1.6 * k, 0.3, true); vfx.ring(x, y + 0.5, z, c2, 1.1 * k, 0.36, true); vfx.ring(x, g, z, c, 2.0 * k, 0.4); vfx.flash(x, y, z, c, 1.3 * k, 0.14);
      particles.burst(x, y, z, 6, { color: [c, c2], speed: 2, up: 2, size: 0.5, life: 0.5, frame: FRAME.ring, grav: 0 });
      return;
    case 'cross': // healer pulse: a soft plus-shaped flash
      vfx.flash(x, y, z, c, 1.6 * k, 0.18);
      vfx.beam(x - 0.8, y, z, x + 0.8, y, z, c, 0.14, 0.2); vfx.beam(x, y - 0.8, z, x, y + 0.8, z, c, 0.14, 0.2);
      vfx.ring(x, g, z, c, 1.6 * k, 0.3);
      particles.burst(x, y, z, 6, { color: [c, c2], speed: 1.6, up: 2, size: 0.5, life: 0.5, frame: FRAME.sparkle, grav: -1 });
      return;
    case 'void': // dark pop: rings collapse inward, then violet rings
      vfx.implode(x, y, z, c, 2.2 * k, 0.26); vfx.ring(x, g, z, c, 1.9 * k, 0.35); vfx.ring(x, y + 0.3, z, c2, 1.3 * k, 0.3, true); vfx.flash(x, y, z, c, 1.5 * k, 0.14);
      for (let i = 0; i < 7; i++) { const a = rnd(0, 6.28), r = rnd(0.9, 1.4); particles.emit(x + Math.cos(a) * r, y + rnd(-0.4, 0.6), z + Math.sin(a) * r, -Math.cos(a) * r * 4, 0, -Math.sin(a) * r * 4, i % 2 ? c : c2, 0.55, 0.25, FRAME.sparkle); }
      return;
    case 'star': // starburst
      vfx.flash(x, y, z, c, 2.0 * k, 0.18); vfx.ring(x, g, z, c, 1.8 * k, 0.3);
      particles.burst(x, y, z, 9, { color: [c, c2], speed: 5, up: 1.5, size: 0.7, life: 0.4, frame: FRAME.star, grav: 1 });
      return;
    case 'gust': // wind: ground ring + a whirl closing in
      vfx.flash(x, y, z, c, 1.3 * k, 0.12); vfx.ring(x, g, z, c, 2.0 * k, 0.35); vfx.implode(x, y - 0.4, z, c2, 1.6 * k, 0.25);
      particles.burst(x, y, z, 6, { color: [c, c2], speed: 3.5, up: 0.8, size: 0.5, life: 0.35, frame: FRAME.sparkle, grav: 0 });
      return;
    case 'bass': // sound: a fat low ring + a ring at chest height
      vfx.ring(x, g, z, c, 2.6 * k, 0.4); vfx.ring(x, y, z, c2, 1.6 * k, 0.26, true); vfx.flash(x, y, z, c, 1.2 * k, 0.12);
      particles.burst(x, y, z, 6, { color: [c, c2], speed: 3, up: 1, size: 0.5, life: 0.4, frame: FRAME.ring, grav: 0 });
      return;
    case 'bumper': // pinball bumper: two quick rings and a punchy flash
      vfx.flash(x, y, z, c, 2.0 * k, 0.14); vfx.ring(x, y, z, c, 1.4 * k, 0.18, true); vfx.ring(x, y, z, c2, 2.2 * k, 0.26, true); vfx.ring(x, g, z, c, 1.7 * k, 0.3);
      particles.burst(x, y, z, 7, { color: [c, c2], speed: 5, up: 1, size: 0.55, life: 0.3, frame: FRAME.sparkle, grav: 0 });
      return;
    case 'petal': // soft petal pop
      vfx.flash(x, y, z, c, 1.5 * k, 0.16); vfx.ring(x, g, z, c, 1.6 * k, 0.32);
      particles.burst(x, y, z, 8, { color: [c, c2], speed: 2.6, up: 2.2, size: 0.6, life: 0.6, frame: FRAME.dot, grav: 2 });
      return;
    case 'leaf': // seed pod bursts into leaves
      vfx.flash(x, y, z, c, 1.4 * k, 0.15); vfx.ring(x, g, z, c2, 1.6 * k, 0.32);
      particles.burst(x, y, z, 8, { color: [c2, c], speed: 3, up: 3, size: 0.6, life: 0.6, frame: FRAME.dot, grav: 4 });
      return;
    case 'spore': // many small slow dots
      vfx.flash(x, y, z, c, 1.6 * k, 0.2); vfx.ring(x, g, z, c, 1.8 * k, 0.4);
      particles.burst(x, y, z, 10, { color: [c, c2], speed: 1.8, up: 1.2, size: 0.42, life: 0.8, frame: FRAME.dot, grav: -0.4 });
      return;
    case 'stitch': // tight needle spark
      vfx.flash(x, y, z, c, 1.0 * k, 0.1); vfx.ring(x, y, z, c, 0.9 * k, 0.16, true); vfx.ring(x, g, z, c, 1.2 * k, 0.25);
      particles.burst(x, y, z, 6, { color: [c, c2], speed: 4, up: 0.6, size: 0.4, life: 0.25, frame: FRAME.sparkle, grav: 0 });
      return;
    case 'spark': // bullet / bolt: small, sharp, gold-tinted
      vfx.flash(x, y, z, c, 1.2 * k, 0.1); vfx.ring(x, g, z, c, 1.3 * k, 0.25);
      particles.burst(x, y, z, 7, { color: [c, c2], speed: 5.5, up: 1.2, size: 0.42, life: 0.25, frame: FRAME.sparkle, grav: 4 });
      return;
    case 'slam': // melee ground hit: crater + debris
      vfx.ring(x, g, z, c, 2.6 * k, 0.32); vfx.decal(x, z, c, 1.3 * k, 0.5); vfx.flash(x, y, z, c, 1.4 * k, 0.14);
      particles.burst(x, 0.4, z, 8, { color: [c, c2], speed: 3.5, up: 4, size: 0.75, life: 0.5, frame: FRAME.dot, grav: 10 });
      return;
    default: // generic colored burst
      vfx.flash(x, y, z, c, 1.4 * k, 0.15); vfx.ring(x, g, z, c, 1.5 * k, 0.28);
      particles.burst(x, y, z, 7, { color: [c, c2], speed: 4, up: 1.5, size: 0.5, life: 0.35, frame: FRAME.sparkle, grav: 2 });
  }
}

// ── melee swings ──
// (h, t, dx, dz) from BASICS.melee: hero, target, unit direction; R = basic range.
const SWING = {
  bash(h, t, dx, dz, c, c2, R) { // shield bash: short crescent + gold shockwave + crater at the target
    vfx.arc(h.x, GROUND + 0.8, h.z, dx, dz, c, R * 0.75, 0.16);
    vfx.ring(t.x, 0.25, t.z, c, 2.8, 0.34);
    hitFx('slam', t.x, hy(t), t.z, c, c2, 0.9);
  },
  gravfist(h, t, dx, dz, c, c2) { // heavy punch: thick short thrust, shock ring out, pull ring in
    vfx.beam(h.x + dx * 0.6, 1.2, h.z + dz * 0.6, t.x - dx * 0.3, 1.2, t.z - dz * 0.3, c, 0.42, 0.16);
    vfx.flash(t.x, hy(t), t.z, c, 2.0, 0.16); vfx.ring(t.x, 0.25, t.z, c, 2.4, 0.3); vfx.implode(t.x, 0.3, t.z, c2, 2.8, 0.32);
    particles.burst(t.x, hy(t), t.z, 7, { color: [c, c2], speed: 4, up: 1, size: 0.6, life: 0.3, frame: FRAME.sparkle, grav: 0 });
  },
  barkslam(h, t, dx, dz, c, c2, R) { // chunky bark slam: rising swipe, ground ring, root decal, leaf burst
    vfx.arc(h.x, GROUND + 0.6, h.z, dx, dz, c, R, 0.2, -0.9);
    vfx.ring(t.x, 0.25, t.z, c, 2.6, 0.34); vfx.decal(t.x, t.z, c2, 1.4, 0.7);
    particles.burst(t.x, 0.6, t.z, 9, { color: [c, c2, 0xFFE06A], speed: 3, up: 4, size: 0.7, life: 0.6, frame: FRAME.dot, grav: 6 });
    vfx.flash(t.x, hy(t), t.z, c, 1.3, 0.14);
  },
  quake(h, t, dx, dz, c, c2) { // hammer quake: big ground ring + rock chips, no slash
    vfx.ring(t.x, 0.25, t.z, c, 3.0, 0.4); vfx.ring(t.x, 0.3, t.z, c2, 1.8, 0.28); vfx.decal(t.x, t.z, c2, 1.5, 0.6);
    particles.burst(t.x, 0.4, t.z, 9, { color: [c, c2, 0x6E5A44], speed: 3.5, up: 5, size: 0.85, life: 0.55, frame: FRAME.dot, grav: 12 });
    vfx.flash(t.x, 0.8, t.z, c, 1.4, 0.14);
  },
  piston(h, t, dx, dz, c, c2) { // piston punch: hard thrust beam, impact spark, mechanical double ring
    vfx.beam(h.x + dx * 0.6, 1.15, h.z + dz * 0.6, t.x, 1.15, t.z, c, 0.36, 0.14);
    vfx.flash(t.x, hy(t), t.z, c, 1.7, 0.14); vfx.ring(t.x, hy(t), t.z, c2, 1.4, 0.18); vfx.ring(t.x, 0.25, t.z, c, 2.0, 0.26);
    particles.burst(t.x, hy(t), t.z, 8, { color: [c, c2], speed: 5, up: 1.5, size: 0.5, life: 0.3, frame: FRAME.sparkle, grav: 6 });
  },
  axe(h, t, dx, dz, c, c2, R) { // wide axe crescent + saw-tooth sparks
    vfx.arc(h.x, GROUND + 0.85, h.z, dx, dz, c, R * 1.15, 0.22); vfx.arc(h.x, 0.25, h.z, dx, dz, c2, R * 1.05, 0.26);
    hitFx('default', t.x, hy(t), t.z, c, c2);
  },
  katana(h, t, dx, dz, c, c2, R) { // single sharp thin crescent, diagonal
    vfx.arc(h.x, GROUND + 1.0, h.z, dx, dz, c, R * 0.95, 0.14, 0.5);
    vfx.streak(t.x - dz * 0.9, hy(t) + 0.6, t.z + dx * 0.9, t.x + dz * 0.9, hy(t) - 0.4, t.z - dx * 0.9, c, 0.14, 1.6);
    hitFx('stitch', t.x, hy(t), t.z, c, c2, 1.2);
  },
  zap(h, t, dx, dz, c, c2) { // arc claw: two jagged bolts from the claws into the target
    for (const off of [-0.25, 0.25]) vfx.zap(h.x + dx * 0.5 - dz * off, 1.2 + off, h.z + dz * 0.5 + dx * off, t.x, hy(t), t.z, off < 0 ? c : c2, 0.55, 0.16);
    vfx.flash(t.x, hy(t), t.z, c, 1.6, 0.14); vfx.ring(t.x, 0.25, t.z, c2, 1.6, 0.25);
    particles.burst(t.x, hy(t), t.z, 7, { color: [c, c2], speed: 5, up: 1, size: 0.45, life: 0.25, frame: FRAME.sparkle, grav: 0 });
  },
  twin(h, t, dx, dz, c, c2, R) { // two short crossing cuts + afterimage
    vfx.arc(h.x, GROUND + 1.05, h.z, dx, dz, c, R * 0.85, 0.14, 0.45);
    vfx.arc(h.x, GROUND + 0.75, h.z, dx, dz, c2, R * 0.75, 0.16, -0.45);
    vfx.ghost(h.x - dx * 0.6, h.z - dz * 0.6, c, 0.3);
    hitFx('stitch', t.x, hy(t), t.z, c, c2, 1.2);
  },
  sickle(h, t, dx, dz, c, c2, R) { // sickle crescent + a small hex-rune flash on the target
    vfx.arc(h.x, GROUND + 0.95, h.z, dx, dz, c, R, 0.2, 0.25);
    vfx.rune(t.x, t.z, c2, 1.4, 0.4);
    hitFx('default', t.x, hy(t), t.z, c, c2);
  },
  parasol(h, t, dx, dz, c, c2) { // parasol-tip thrust: thin rose beam + a shadow puff
    vfx.beam(h.x + dx * 0.5, 1.25, h.z + dz * 0.5, t.x, 1.25, t.z, c, 0.12, 0.15);
    vfx.ghost(t.x, t.z, c2, 0.35);
    hitFx('stitch', t.x, hy(t), t.z, c, c2, 1.2);
  },
  flicker(h, t, dx, dz, c, c2) { // flicker stab + three seeking embers that pop at the target
    vfx.beam(h.x + dx * 0.4, 1.0, h.z + dz * 0.4, t.x, 1.0, t.z, c, 0.14, 0.12);
    for (let k = 0; k < 3; k++) {
      const a = (k - 1) * 0.6, sx = Math.cos(a) * dx - Math.sin(a) * dz, sz = Math.sin(a) * dx + Math.cos(a) * dz;
      vfx.streak(h.x - sx * 0.6, 1.6 + k * 0.2, h.z - sz * 0.6, t.x, hy(t), t.z, k % 2 ? c2 : c, 0.22, 0.9);
    }
    hitFx('stitch', t.x, hy(t), t.z, c, c2, 1.1);
  },
  paper(h, t, dx, dz, c, c2, R) { // paper cut: an X of two crimson-edged thin slices
    vfx.streak(t.x - dz * 1.1, hy(t) + 0.8, t.z + dx * 1.1, t.x + dz * 1.1, hy(t) - 0.6, t.z - dx * 1.1, c, 0.14, 2.2);
    vfx.streak(t.x + dz * 1.1, hy(t) + 0.8, t.z - dx * 1.1, t.x - dz * 1.1, hy(t) - 0.6, t.z + dx * 1.1, c, 0.16, 2.2);
    vfx.arc(h.x, GROUND + 0.95, h.z, dx, dz, c, R * 0.9, 0.12, 0.3);
    particles.burst(t.x, hy(t), t.z, 6, { color: [c2, c], speed: 3, up: 1.5, size: 0.5, life: 0.45, frame: FRAME.dot, grav: 2 });
    vfx.flash(t.x, hy(t), t.z, c, 1.2, 0.12);
  },
  tail(h, t, dx, dz, c, c2, R) { // tail lash: wide low crescent + crystal shards
    vfx.arc(h.x, GROUND + 0.5, h.z, dx, dz, c, R * 1.2, 0.24); vfx.arc(h.x, GROUND + 0.9, h.z, -dz, dx, c2, R * 0.8, 0.2);
    vfx.flash(t.x, hy(t), t.z, c, 1.5, 0.14); vfx.ring(t.x, 0.25, t.z, c, 1.8, 0.3);
    particles.burst(t.x, hy(t), t.z, 8, { color: [c, c2], speed: 4, up: 2, size: 0.65, life: 0.4, frame: FRAME.star, grav: 4 });
  },
  rake(h, t, dx, dz, c, c2, R) { // triple claw rake: three parallel slanted slashes
    for (let k = -1; k <= 1; k++) vfx.arc(h.x - dz * k * 0.4, GROUND + 0.95 + k * 0.18, h.z + dx * k * 0.4, dx, dz, k ? c : c2, R * 0.9, 0.16, 0.9);
    vfx.flash(t.x, hy(t), t.z, c, 1.4, 0.14); vfx.ring(t.x, 0.25, t.z, c, 1.5, 0.26);
    particles.burst(t.x, hy(t), t.z, 6, { color: [c, c2], speed: 3.5, up: 2, size: 0.6, life: 0.35, frame: FRAME.star, grav: 3 });
  },
  lavachop(h, t, dx, dz, c, c2, R) { // upward claw swipe, ember burst, small flame column at the target
    vfx.arc(h.x, GROUND + 0.9, h.z, dx, dz, c, R, 0.2, -1.1);
    particles.burst(t.x, 0.3, t.z, 7, { color: [c, c2, 0xFF5A1A], speed: 0.7, up: 7, size: 0.85, life: 0.45, frame: FRAME.dot, grav: 5 }); // short flame column
    hitFx('burn', t.x, hy(t), t.z, c, c2, 1);
  },
  pillar(h, t, dx, dz, c, c2) { // pillar-fist slam: rock burst + heavy double ring
    vfx.ring(t.x, 0.25, t.z, c, 3.0, 0.4); vfx.ring(t.x, 0.3, t.z, c2, 1.9, 0.3); vfx.decal(t.x, t.z, c, 1.4, 0.6);
    particles.burst(t.x, 0.4, t.z, 9, { color: [c2, c, 0x6A6D74], speed: 3.5, up: 5, size: 0.9, life: 0.55, frame: FRAME.dot, grav: 12 });
    vfx.flash(t.x, 0.9, t.z, c, 1.4, 0.14);
  },
  clamclap(h, t, dx, dz, c, c2, R) { // clam clap: wide watery crescent + droplets + turquoise splash ring
    vfx.arc(h.x, GROUND + 0.8, h.z, dx, dz, c, R * 1.15, 0.22); vfx.arc(h.x, GROUND + 1.1, h.z, dx, dz, c2, R * 0.8, 0.2);
    hitFx('splash', t.x, hy(t), t.z, c, c2, 1.1);
  },
  ram(h, t, dx, dz, c, c2) { // rivet ram: heavy shockwave + wood / rope chips
    vfx.beam(h.x + dx * 0.5, 1.0, h.z + dz * 0.5, t.x - dx * 0.3, 1.0, t.z - dz * 0.3, c, 0.38, 0.14);
    vfx.ring(t.x, 0.25, t.z, c, 2.7, 0.34); vfx.flash(t.x, hy(t), t.z, c, 1.4, 0.14);
    particles.burst(t.x, 0.6, t.z, 9, { color: [c2, 0x8A6440, c], speed: 3.5, up: 4, size: 0.7, life: 0.5, frame: FRAME.dot, grav: 10 });
  },
  forge(h, t, dx, dz, c, c2, R) { // forge hammer: overhead spark arc, shockwave, embers at the feet
    vfx.arc(h.x, GROUND + 1.0, h.z, dx, dz, c, R * 0.9, 0.2, 1.2);
    vfx.ring(t.x, 0.25, t.z, c, 2.5, 0.32); vfx.flash(t.x, 0.8, t.z, c, 1.5, 0.14);
    particles.burst(t.x, 0.3, t.z, 9, { color: [c, c2], speed: 3.5, up: 4.5, size: 0.5, life: 0.5, frame: FRAME.sparkle, grav: 9 });
  },
  gale(h, t, dx, dz, c, c2, R) { // two opposite spin crescents + a small whirl ring at the target
    vfx.arc(h.x, GROUND + 0.9, h.z, dx, dz, c, R * 1.05, 0.2); vfx.arc(h.x, GROUND + 1.2, h.z, -dx, -dz, c2, R * 0.85, 0.2);
    hitFx('gust', t.x, hy(t), t.z, c, c2);
  },
};

// Melee basic. Returns false when the hero has no profile (behaviors.js then falls back to its generic SWINGS).
export function meleeFx(h, t, dx, dz, b) {
  const p = P[h.id], fn = p && SWING[p.melee];
  if (!fn) return false;
  fn(h, t, dx, dz, rich(p.c), rich(p.c2), h.basicRange ?? b.range ?? 2.2);
  return true;
}

// Line basic (corsa spear, ravel chain, quill rapier): drawn instead of fireBolt's generic streak + beam.
export function lineFx(h, x, z, dx, dz, len, b) {
  const p = P[h.id], c = rich(p?.c ?? b.color), c2 = rich(p?.c2 ?? p?.c ?? b.color), ex = x + dx * len, ez = z + dz * len;
  switch (p?.line) {
    case 'spear': // long thin beam with a bright spearhead travelling out
      vfx.beam(x + dx * 0.6, 1.3, z + dz * 0.6, ex, 1.3, ez, c, 0.12, 0.2);
      vfx.streak(x + dx * 0.8, 1.3, z + dz * 0.8, ex + dx * 0.4, 1.3, ez + dz * 0.4, c2, 0.16, 1.6);
      vfx.flash(ex, 1.3, ez, c, 1.0, 0.12);
      break;
    case 'chain': // chain lash: a streak of linked rings with orange sparks
      vfx.beam(x + dx * 0.6, 1.2, z + dz * 0.6, ex, 1.2, ez, c2, 0.08, 0.18);
      for (let k = 0.8, i = 0; k < len; k += 0.45, i++) particles.emit(x + dx * k, 1.2 + Math.sin(k * 3) * 0.12, z + dz * k, 0, 0.2, 0, i % 2 ? c2 : c, 0.75, 0.22, FRAME.ring);
      vfx.flash(ex, 1.2, ez, c2, 1.1, 0.12);
      break;
    case 'rapier': // rapier lunge: thin ivory stab + a few needle streaks
      vfx.beam(x + dx * 0.5, 1.3, z + dz * 0.5, ex, 1.3, ez, c, 0.08, 0.16);
      for (let k = -1; k <= 1; k++) vfx.streak(x + dx * 0.8 - dz * k * 0.2, 1.3 + k * 0.15, z + dz * 0.8 + dx * k * 0.2, ex - dz * k * 0.1, 1.3, ez + dx * k * 0.1, k ? c2 : c, 0.14, 1.1);
      break;
    default:
      vfx.streak(x, 1.3, z, ex, 1.3, ez, c, 0.2, Math.min(len, 4));
      vfx.beam(x + dx * 0.6, 1.3, z + dz * 0.6, ex, 1.3, ez, c, 0.2, 0.25);
  }
}
export function lineHit(h, e, b) {
  const p = P[h.id];
  hitFx(p?.line === 'chain' ? 'spark' : 'stitch', e.x, hy(e), e.z, p?.c ?? b.color, p?.c2 ?? b.color, 1.2);
}

// Muzzle: a colored flash at the weapon and, for guns / lamps, a short cone along the shot.
export function muzzleFx(src, x, y, z, dx, dz, color) {
  const p = src.type === 'hero' ? P[src.id] : null;
  color = rich(color);
  vfx.flash(x + dx * 0.9, y, z + dz * 0.9, color, p?.muzzle ? 1.4 : 1.1, 0.1);
  if (p?.muzzle === 'gun') vfx.cone(x + dx * 0.7, y, z + dz * 0.7, dx, dz, color, 1.1, 0.3, 0.09);
  if (p?.muzzle === 'cone') vfx.cone(x + dx * 0.5, y, z + dz * 0.5, dx, dz, color, 2.6, 0.9, 0.16); // lighthouse blink
}

// Projectile basic: options for projectiles.fire (shape, trail, impact, colors). Pale cores no longer wash out.
export function projOpts(h, b) {
  const p = P[h.id];
  if (!p?.shape) return { color: b.color, frame: b.frame ?? FRAME.dot, size: (b.size ?? 1.1) * 1.1, tail: b.tail, halo: b.halo, core: Math.min(b.core ?? 0.12, 0.2) };
  return {
    color: p.c, c2: p.c2, shape: p.shape, trail: p.trail, hit: p.hit, rim: p.rim,
    size: (b.size ?? 1) * (p.size ?? 1) * 1.1, tail: p.tail ?? b.tail, halo: p.halo ?? Math.min(b.halo ?? 2.2, 2.8), core: p.core ?? 0.12, frame: b.frame,
  };
}

// Spread basic (flint): big copper ember pellets that streak out; `hit` is the pellet's target (or null).
export function spreadFx(h, dx, dz, len, hit, b) {
  const p = P[h.id], c = rich(p?.c ?? b.color), c2 = rich(p?.c2 ?? p?.c ?? b.color);
  vfx.streak(h.x + dx * 0.6, 1.2, h.z + dz * 0.6, h.x + dx * len, 1.2, h.z + dz * len, c, 0.12, 1.1);
  for (let s = 1; s < len; s += 1.3) particles.emit(h.x + dx * s, 1.2, h.z + dz * s, dx * 5, 0.3, dz * 5, Math.random() < 0.5 ? c : c2, 0.55, 0.18, FRAME.dot);
  if (hit) hitFx('spark', hit.x, hy(hit), hit.z, c, c2, 0.8);
}

// Per-frame trail (projectiles.js calls this at ~30 Hz per shot). No white sparkles.
export function trailFx(kind, x, y, z, dx, dz, c, c2) {
  c = rich(c); c2 = rich(c2);
  const pick = (k = 0.5) => (Math.random() < k ? c : c2);
  switch (kind) {
    case 'none': return;
    case 'ember': particles.emit(x + rnd(-0.15, 0.15), y + rnd(-0.1, 0.1), z + rnd(-0.15, 0.15), -dx * 1.5 + rnd(-0.5, 0.5), rnd(0.6, 1.4), -dz * 1.5 + rnd(-0.5, 0.5), pick(), rnd(0.35, 0.55), 0.4, FRAME.dot, -0.5); return;
    case 'drop': particles.emit(x + rnd(-0.2, 0.2), y - 0.1, z + rnd(-0.2, 0.2), -dx, 0.5, -dz, pick(), 0.4, 0.45, FRAME.dot, 8); return;
    case 'snow': particles.emit(x + rnd(-0.2, 0.2), y + rnd(-0.15, 0.15), z + rnd(-0.2, 0.2), -dx * 0.8, -0.3, -dz * 0.8, pick(), 0.5, 0.5, FRAME.star, 0.5); return;
    case 'star': particles.emit(x, y, z, -dx * 0.5 + rnd(-0.6, 0.6), rnd(-0.4, 0.6), -dz * 0.5 + rnd(-0.6, 0.6), pick(0.6), 0.5, 0.35, FRAME.star); return;
    case 'comet': particles.emit(x + rnd(-0.1, 0.1), y + rnd(-0.1, 0.1), z + rnd(-0.1, 0.1), -dx * 3 + rnd(-0.4, 0.4), rnd(-0.2, 0.3), -dz * 3 + rnd(-0.4, 0.4), pick(0.3), rnd(0.45, 0.65), 0.45, FRAME.sparkle); return;
    case 'mote': particles.emit(x + rnd(-0.25, 0.25), y + rnd(-0.2, 0.2), z + rnd(-0.25, 0.25), 0, 0.5, 0, pick(), 0.34, 0.4, FRAME.sparkle, -0.4); return;
    case 'void': { const a = rnd(0, 6.28); particles.emit(x + Math.cos(a) * 0.7, y + rnd(-0.3, 0.3), z + Math.sin(a) * 0.7, -Math.cos(a) * 3, 0, -Math.sin(a) * 3, pick(), 0.45, 0.22, FRAME.sparkle); return; }
    case 'petal': particles.emit(x + rnd(-0.2, 0.2), y, z + rnd(-0.2, 0.2), -dx + rnd(-0.8, 0.8), rnd(0, 0.8), -dz + rnd(-0.8, 0.8), pick(), 0.34, 0.5, FRAME.dot, 1.5); return;
    case 'leaf': particles.emit(x, y, z, -dx * 0.6 + rnd(-0.5, 0.5), rnd(0, 0.5), -dz * 0.6 + rnd(-0.5, 0.5), pick(0.4), 0.32, 0.45, FRAME.dot, 2); return;
    case 'spore': particles.emit(x + rnd(-0.35, 0.35), y + rnd(-0.3, 0.3), z + rnd(-0.35, 0.35), rnd(-0.3, 0.3), rnd(0, 0.4), rnd(-0.3, 0.3), pick(0.6), rnd(0.24, 0.4), 0.6, FRAME.dot, -0.2); return;
    case 'silk': case 'rope': particles.emit(x, y, z, 0, 0, 0, kind === 'rope' ? c2 : c, 0.3, 0.5, FRAME.dot); return;
    case 'tracer': particles.emit(x, y, z, 0, 0, 0, c, 0.38, 0.16, FRAME.dot); return;
    case 'wind': particles.emit(x + rnd(-0.1, 0.1), y + rnd(-0.1, 0.1), z + rnd(-0.1, 0.1), -dx * 1.5 - dz * rnd(-1, 1), rnd(-0.2, 0.2), -dz * 1.5 + dx * rnd(-1, 1), c2, 0.4, 0.35, FRAME.sparkle); return;
    case 'frost': particles.emit(x + rnd(-0.12, 0.12), y + rnd(-0.12, 0.12), z + rnd(-0.12, 0.12), -dx, 0, -dz, pick(), 0.45, 0.4, FRAME.star); return;
    default: particles.emit(x, y, z, 0, 0, 0, pick(0.6), 0.5, 0.3, FRAME.sparkle);
  }
}
