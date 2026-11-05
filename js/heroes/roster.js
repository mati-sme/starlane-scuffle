// The 18 champions as pure data. `kind` selects a behavior in behaviors.js; `perk` is merged in at max rank.
// Skill params: cd, range, radius, dmg + kind flags (stun, slow, knock, pull, air, shield, heal, charges, pierce, ...).
// model: spec for buildChampion (models.js).

export const ROLES = ['tank', 'bruiser', 'assassin', 'blaster', 'shooter', 'support'];

// Rank r > 1 adds +20% to these per rank and -8% cooldown; the perk (at max rank) overrides params.
const SCALE = ['dmg', 'shield', 'allyShield', 'heal', 'allyHeal', 'healPs', 'dps', 'tDmg'];

export function rankStats(ab, rank) {
  const r = Math.max(1, rank), out = { ...ab };
  if (r > 1) {
    const m = 1 + 0.2 * (r - 1);
    for (const k of SCALE) if (out[k] != null) out[k] *= m;
    out.cd *= 1 - 0.08 * (r - 1);
  }
  if (ab.perk && r >= ab.perk.at) Object.assign(out, ab.perk);
  return out;
}

export const ROSTER_DEFS = [
  {
    id: 'bulwark', name: 'Bulwark', title: 'The Iron Wall', role: 'tank', pair: 'A', color: 0x6E7C91, accent: 0xB07A3A,
    fx: { color: 0x7FB2FF, accent: 0xFFD27A },
    model: { torso: 'heavy', helmet: 'flat', paul: 'huge', arm: 'shield', back: 'none', visor: 'slit', w: 1.15 },
    stats: { hp: 1100, hpLv: 90, speed: 6.0, radius: 0.85 },
    basic: { name: 'Shield Bash', kind: 'melee', range: 2.2, dmg: 46, cd: 0.9, cleave: 100 },
    s1: { name: 'Ram Charge', kind: 'dash', tag: 'dash knock', cd: 8, range: 7, width: 1.8, dmg: 60, knock: 2, perk: { at: 4, endStun: 0.6 } },
    s2: { name: 'Aegis Wall', kind: 'buff', tag: 'team shield', cd: 12, allyR: 5, shield: 200, allyShield: 120, dur: 3, perk: { at: 4, shieldSpd: 0.25 } },
    ult: { name: 'Fortress Drop', kind: 'leap', tag: 'leap stun', cd: 45, range: 8, radius: 4, dmg: 150, stun: 1.0, dur: 0.5, perk: { at: 3, fieldAfter: { r: 4, dur: 3, slow: true } } },
  },
  {
    id: 'magnus', name: 'Magnus', title: 'Gravity Anchor', role: 'tank', pair: 'B', color: 0x5B3FA8, accent: 0xCDB8FF,
    model: { torso: 'heavy', helmet: 'dome', paul: 'small', arm: 'gauntlet', back: 'ring', visor: 'wide', w: 1.1 },
    stats: { hp: 1050, hpLv: 85, speed: 5.8, radius: 0.85 },
    basic: { name: 'Grav Fist', kind: 'melee', range: 2.4, dmg: 44, cd: 1.0, slow: 0.5 },
    s1: { name: 'Tether Hook', kind: 'hook', tag: 'pull stun', cd: 9, range: 8, width: 1.1, dmg: 50, pull: 5, stun: 0.5, perk: { at: 4, range: 10, stun: 0.9 } },
    s2: { name: 'Mass Field', kind: 'field', tag: 'slow aura', cd: 11, r: 4, dur: 3, dps: 25, slow: true, follow: true, selfDr: 0.25, perk: { at: 4, allyDr: 0.15 } },
    ult: { name: 'Singularity', kind: 'blast', tag: 'pull stun', cd: 45, range: 8, radius: 5, delay: 0.6, dmg: 160, stun: 0.8, pull: 99, perk: { at: 3, radius: 6.5 } },
  },
  {
    id: 'torque', name: 'Torque', title: 'Piston Brawler', role: 'bruiser', pair: 'A', color: 0xFF7A1A, accent: 0x2A2D33,
    model: { torso: 'heavy', helmet: 'flat', paul: 'small', arm: 'gauntlet2', back: 'stacks', visor: 'slit', w: 1.05, hunch: 1 },
    stats: { hp: 950, hpLv: 80, speed: 6.2, radius: 0.8 },
    basic: { name: 'Piston Punch', kind: 'melee', range: 2.2, dmg: 58, cd: 0.85, third: { knock: 1.5 }, color: 0xFFB36B },
    s1: { name: 'Rocket Leap', kind: 'leap', tag: 'leap slam', cd: 7, range: 7, radius: 3, dmg: 90, dur: 0.4, perk: { at: 4, stun: 0.5 } },
    s2: { name: 'Overdrive', kind: 'buff', tag: 'haste heal', cd: 12, aspd: 0.4, aspdT: 4, spd: 0.2, spdT: 4, healPct: 0.08, perk: { at: 4, lifesteal: 0.2, lsT: 4 } },
    ult: { name: 'Seismic Slam', kind: 'cone', tag: 'shockwaves', cd: 40, range: 7, arc: 90, waves: 3, gap: 0.25, dmg: 70, air1: true, perk: { at: 3, waves: 4, arc: 120 } },
  },
  {
    id: 'corsa', name: 'Corsa', title: 'Arc Lancer', role: 'bruiser', pair: 'B', color: 0x9BD62C, accent: 0x2B2F3A,
    model: { torso: 'medium', helmet: 'crest', paul: 'small', arm: 'spear', back: 'roundshield', visor: 'v' },
    stats: { hp: 900, hpLv: 75, speed: 6.2, radius: 0.75 },
    basic: { name: 'Lance Thrust', kind: 'line', range: 3.0, width: 0.8, dmg: 54, cd: 0.9, color: 0xD8FF7A },
    s1: { name: 'Spear Charge', kind: 'dash', tag: 'dash slow', cd: 7, range: 8, width: 1.6, dmg: 80, slow: true, slowT: 1.5, perk: { at: 4, range: 11, endStun: 0.4 } },
    s2: { name: 'Whirl Guard', kind: 'nova', tag: 'spin shield', cd: 9, radius: 3, dmg: 70, shield: 150, dur: 2, perk: { at: 4, pull: 1.5 } },
    ult: { name: 'Skyfall Lance', kind: 'leap', tag: 'leap knock-up', cd: 40, range: 10, radius: 3.5, dmg: 180, air: true, dur: 0.6, height: 5, perk: { at: 3, radial: { n: 6, range: 6, dmg: 60 } } },
  },
  {
    id: 'glint', name: 'Glint', title: 'Phase Blade', role: 'assassin', pair: 'A', color: 0x2B2F3A, accent: 0xFF3DCB,
    fx: { color: 0xFF3DCB, accent: 0xFFFFFF },
    model: { torso: 'slim', helmet: 'fin', paul: 'none', arm: 'blade', back: 'none', visor: 'v', h: 1.05 },
    stats: { hp: 720, hpLv: 60, speed: 6.6, radius: 0.65 },
    basic: { name: 'Edge Slash', kind: 'melee', range: 2.0, dmg: 62, cd: 0.7, lowBonus: 0.4 },
    s1: { name: 'Phase Step', kind: 'blink', tag: 'blink strike', cd: 7, range: 6, dmg: 80, perk: { at: 4, resetOnKill: 2 } },
    s2: { name: 'Shroud', kind: 'buff', tag: 'stealth', cd: 13, hide: 2.5, spd: 0.3, spdT: 2.5, nextDmg: 100, perk: { at: 4, hide: 3.5, spd: 0.5, spdT: 3.5 } },
    ult: { name: 'Thousand Cuts', kind: 'dash', tag: 'chain strikes', cd: 40, range: 6, chain: 5, dmg: 60, perk: { at: 3, chain: 7 } },
  },
  {
    id: 'volt', name: 'Volt', title: 'Storm Runner', role: 'assassin', pair: 'B', color: 0xFFD60A, accent: 0x23262D,
    model: { torso: 'slim', helmet: 'dome', paul: 'small', arm: 'none', back: 'coils', visor: 'wide', h: 1.08 },
    stats: { hp: 760, hpLv: 62, speed: 7.0, radius: 0.65 },
    basic: { name: 'Arc Jab', kind: 'melee', range: 2.6, dmg: 48, cd: 0.55, chain: { r: 3, mul: 0.5 }, color: 0xFFF08A },
    s1: { name: 'Lightning Dash', kind: 'dash', tag: 'dash shock', cd: 6, range: 8, width: 1.5, dmg: 70, perk: { at: 4, charges: 2 } },
    s2: { name: 'Static Ring', kind: 'nova', tag: 'shock slow', cd: 9, radius: 3.5, dmg: 60, slow: true, slowT: 1.5, perk: { at: 4, slow: false, stun: 0.6 } },
    ult: { name: 'Thunderlane', kind: 'dash', tag: 'burning trail', cd: 40, range: 14, width: 1.5, trail: { w: 1.4, dur: 3, dps: 80 }, perk: { at: 3, trail: { w: 1.4, dur: 5, dps: 80 }, selfSpd: 0.4, selfSpdT: 3 } },
  },
  {
    id: 'cinder', name: 'Cinder', title: 'Magma Mortar', role: 'blaster', pair: 'A', color: 0x3A3236, accent: 0xFF5E1A,
    fx: { color: 0xE8341C, accent: 0xFFB020 },
    model: { torso: 'medium', helmet: 'flat', paul: 'small', arm: 'none', back: 'mortar', visor: 'slit', w: 1.12, cracks: 1 },
    stats: { hp: 680, hpLv: 58, speed: 5.8, radius: 0.75 },
    basic: { name: 'Ember Lob', kind: 'proj', range: 7, dmg: 42, cd: 0.9, speed: 12, arc: 1.6, splash: 1.5, size: 1.4 },
    s1: { name: 'Magma Bomb', kind: 'blast', tag: 'burn field', cd: 7, range: 9, radius: 3, delay: 0.5, dmg: 110, fieldAfter: { dur: 2, dps: 20 }, perk: { at: 4, fieldAfter: { dur: 4, dps: 20, slow: true } } },
    s2: { name: 'Heat Vent', kind: 'nova', tag: 'blast haste', cd: 10, radius: 3.5, dmg: 60, knock: 3, spd: 0.25, spdT: 2, perk: { at: 4, shield: 120, dur: 2 } },
    ult: { name: 'Meteor Barrage', kind: 'rain', tag: 'meteor rain', cd: 45, range: 10, radius: 6, blastR: 2.2, count: 6, dur: 2, dmg: 75, perk: { at: 3, count: 9 } },
  },
  {
    id: 'prism', name: 'Prism', title: 'Light Architect', role: 'blaster', pair: 'B', color: 0xE6ECF2, accent: 0x4DF0C0,
    fx: { color: 0x5CF2FF, accent: 0xFFFFFF },
    model: { torso: 'slim', helmet: 'crest', paul: 'none', arm: 'none', back: 'pylons', visor: 'v' },
    stats: { hp: 650, hpLv: 55, speed: 5.8, radius: 0.65 },
    basic: { name: 'Refract Bolt', kind: 'proj', range: 7.5, dmg: 40, cd: 0.8, speed: 18, arc: 0.2, pierce: true },
    s1: { name: 'Prism Turret', kind: 'turret', tag: 'auto turret', cd: 10, range: 4, dur: 8, tRange: 7, tDmg: 26, tCd: 0.6, max: 1, perk: { at: 4, max: 2, dur: 12 } },
    s2: { name: 'Lens Wall', kind: 'field', tag: 'shot barrier', cd: 12, wall: 6, dur: 3, slow: true, perk: { at: 4, allySpd: 0.3 } },
    ult: { name: 'Spectrum Beam', kind: 'beam', tag: 'channel beam', cd: 45, range: 11, width: 1.6, dur: 2, dps: 150, slow: true, slowT: 0.6, perk: { at: 3, range: 14, width: 2.4 } },
  },
  {
    id: 'kade', name: 'Kade', title: 'Rail Ranger', role: 'shooter', pair: 'A', color: 0xC9B48A, accent: 0x6F7B3A,
    fx: { color: 0xFFE28A, accent: 0xFFF3C4 },
    model: { torso: 'medium', helmet: 'hood', paul: 'small', arm: 'rifle', back: 'coat', visor: 'dot' },
    stats: { hp: 640, hpLv: 55, speed: 6.0, radius: 0.7 },
    basic: { name: 'Rail Shot', kind: 'proj', range: 8.5, dmg: 62, cd: 0.95, speed: 32, arc: 0, size: 0.8, color: 0xFFE9A0 },
    s1: { name: 'Piercer', kind: 'bolt', tag: 'piercing shot', cd: 7, range: 12, width: 1.2, pierce: true, delay: 0.25, dmg: 130, perk: { at: 4, slow: true, slowT: 1.5 } },
    s2: { name: 'Slide Roll', kind: 'dash', tag: 'roll + empower', cd: 9, range: 5, width: 1, aim: 'move', nextDmg: 60, nextRange: 2, nextT: 3, perk: { at: 4, charges: 2 } },
    ult: { name: 'Orbital Lock', kind: 'blast', tag: 'sky strike', cd: 45, range: 18, radius: 2, delay: 1.0, dmg: 320, target: 'lowhero', sky: true, perk: { at: 3, strikes: 2 } },
  },
  {
    id: 'flint', name: 'Flint', title: 'Scatter Ranger', role: 'shooter', pair: 'B', color: 0xA0522D, accent: 0x3A4150,
    fx: { color: 0xFF9A3C, accent: 0xFFD08A },
    model: { torso: 'heavy', helmet: 'dome', paul: 'small', arm: 'blaster', back: 'drum', visor: 'wide', h: 0.92, w: 1.05 },
    stats: { hp: 780, hpLv: 65, speed: 6.0, radius: 0.75 },
    basic: { name: 'Scatter Blast', kind: 'spread', range: 6, dmg: 14, cd: 0.9, pellets: 5, spread: 30, color: 0xFFC27A },
    s1: { name: 'Frag Grenade', kind: 'blast', tag: 'grenade', cd: 7, range: 8, radius: 2.5, delay: 0.4, dmg: 100, knock: 1.5, perk: { at: 4, split: { n: 3, r: 1.5, dmg: 50 } } },
    s2: { name: 'Jet Hop', kind: 'leap', tag: 'hop slow field', cd: 9, range: 6, radius: 0, dur: 0.35, height: 2.5, fieldAfter: { r: 2.5, dur: 1.5, slow: true }, perk: { at: 4, aspd: 1.0, aspdT: 2 } },
    ult: { name: 'Bullet Storm', kind: 'cone', tag: 'channel volley', cd: 40, range: 8, arc: 70, waves: 12, gap: 0.2, dmg: 36, track: true, moveMul: 0.6, perk: { at: 3, moveMul: 1 } },
  },
  {
    id: 'aria', name: 'Aria', title: 'Pulse Medic', role: 'support', pair: 'A', color: 0xF2F4F8, accent: 0x3EE89A,
    fx: { color: 0x3EE89A, accent: 0xD6FFEA },
    model: { torso: 'slim', helmet: 'dome', paul: 'small', arm: 'none', back: 'drone', visor: 'wide', emblem: 1 },
    stats: { hp: 720, hpLv: 60, speed: 6.2, radius: 0.65 },
    basic: { name: 'Pulse Bolt', kind: 'proj', range: 7, dmg: 34, cd: 0.7, speed: 16, arc: 0.3, healAlly: 12, color: 0x7DFFC0 },
    s1: { name: 'Mend Wave', kind: 'buff', tag: 'team heal', cd: 8, allyR: 6, heal: 120, allyHeal: 120, cleanse: true, perk: { at: 4, shield: 80, allyShield: 80, dur: 3 } },
    s2: { name: 'Stasis Orb', kind: 'bolt', tag: 'stun orb', cd: 10, range: 9, width: 1.2, dmg: 50, stun: 1.0, perk: { at: 4, explode: 2.5 } },
    ult: { name: 'Lifeline Field', kind: 'field', tag: 'heal zone', cd: 50, range: 8, r: 5, dur: 4, healPs: 70, slow: true, place: 'ally', perk: { at: 3, undying: true } },
  },
  {
    id: 'tempo', name: 'Tempo', title: 'Sonic Conductor', role: 'support', pair: 'B', color: 0x8E2C7E, accent: 0xC9D2DE,
    model: { torso: 'medium', helmet: 'fin', paul: 'discs', arm: 'staff', back: 'none', visor: 'slit' },
    stats: { hp: 740, hpLv: 60, speed: 6.2, radius: 0.7 },
    basic: { name: 'Sound Wave', kind: 'proj', range: 6.5, dmg: 38, cd: 0.8, speed: 14, arc: 0.2, pierce: true, size: 1.5, color: 0xE7B8FF },
    s1: { name: 'Rush Anthem', kind: 'buff', tag: 'team haste', cd: 10, allyR: 7, spd: 0.35, spdT: 3, aspd: 0.15, aspdT: 3, perk: { at: 4, heal: 60, allyHeal: 60, cleanse: true } },
    s2: { name: 'Bass Drop', kind: 'cone', tag: 'knockback', cd: 8, range: 6, arc: 80, dmg: 70, knock: 3, slow: true, slowT: 1.5, perk: { at: 4, stun: 0.5 } },
    ult: { name: 'Crescendo', kind: 'nova', tag: 'sonic pulse', cd: 45, radius: 8, expand: 0.8, dmg: 120, knock: 4, stun: 1.0, heal: 100, perk: { at: 3, pulse2: 1.5 } },
  },
  {
    id: 'mossback', name: 'Mossback', title: 'Root Warden', role: 'tank', pair: 'C', color: 0x4E7A3A, accent: 0xC98A3C,
    model: { torso: 'heavy', helmet: 'dome', paul: 'huge', arm: 'gauntlet', back: 'stacks', visor: 'wide', w: 1.2 },
    stats: { hp: 1150, hpLv: 95, speed: 5.7, radius: 0.9 },
    basic: { name: 'Bark Slam', kind: 'melee', range: 2.3, dmg: 42, cd: 1.0, cleave: 120, color: 0x9BE36B },
    s1: { name: 'Root Snare', kind: 'blast', tag: 'root burst', cd: 9, range: 7, radius: 2.6, delay: 0.55, dmg: 70, stun: 0.9, perk: { at: 4, radius: 3.4, slow: true, slowT: 2 } },
    s2: { name: 'Bark Skin', kind: 'buff', tag: 'self shield', cd: 11, shield: 260, dur: 3, healPct: 0.06, perk: { at: 4, allyR: 4, allyShield: 110 } },
    ult: { name: 'Thornwall', kind: 'field', tag: 'thorn wall', cd: 45, wall: 9, dur: 5, dps: 60, slow: true, perk: { at: 3, dur: 7, dps: 90 } },
  },
  {
    id: 'ravel', name: 'Ravel', title: 'Chain Reaver', role: 'bruiser', pair: 'C', color: 0xC8A24A, accent: 0x7A4A1A,
    model: { torso: 'medium', helmet: 'crest', paul: 'small', arm: 'gauntlet2', back: 'coat', visor: 'v', w: 1.05 },
    stats: { hp: 920, hpLv: 78, speed: 6.2, radius: 0.75 },
    basic: { name: 'Chain Lash', kind: 'line', range: 3.4, width: 0.7, dmg: 50, cd: 0.85, color: 0xFFE08A },
    s1: { name: 'Grapple Chain', kind: 'hook', tag: 'chain pull', cd: 9, range: 8, width: 1.0, dmg: 55, pull: 6, perk: { at: 4, stun: 0.5 } },
    s2: { name: 'Reaver Spin', kind: 'nova', tag: 'spin guard', cd: 9, radius: 3.2, dmg: 65, shield: 120, dur: 2, slow: true, slowT: 1.2, perk: { at: 4, shield: 200 } },
    ult: { name: 'Chain Storm', kind: 'cone', tag: 'whirling chains', cd: 40, range: 5, arc: 340, waves: 5, gap: 0.2, dmg: 45, knock: 1.2, perk: { at: 3, waves: 7 } },
  },
  {
    id: 'mirage', name: 'Mirage', title: 'Decoy Duelist', role: 'assassin', pair: 'C', color: 0x138A8A, accent: 0xE0FFFF,
    model: { torso: 'slim', helmet: 'hood', paul: 'none', arm: 'blade', back: 'coat', visor: 'dot', h: 1.04 },
    stats: { hp: 730, hpLv: 61, speed: 6.5, radius: 0.65 },
    basic: { name: 'Twin Cut', kind: 'melee', range: 2.0, dmg: 56, cd: 0.65, color: 0x7DFFF0 },
    s1: { name: 'Shadow Darts', kind: 'bolt', tag: 'dart fan', cd: 7, range: 8, width: 0.8, count: 3, spread: 30, dmg: 55, perk: { at: 4, count: 5, spread: 44 } },
    s2: { name: 'Mirror Image', kind: 'decoy', tag: 'decoy burst', cd: 12, hide: 1.8, spd: 0.35, delay: 1.6, radius: 3, dmg: 90, perk: { at: 4, stun: 0.6 } },
    ult: { name: 'Eclipse Strike', kind: 'blink', tag: 'blink execute', cd: 40, range: 9, dmg: 240, stun: 0.5, perk: { at: 3, dmg: 320 } },
  },
  {
    id: 'rime', name: 'Rime', title: 'Frost Trapper', role: 'blaster', pair: 'C', color: 0xD7F3FF, accent: 0x7EEBFF,
    fx: { color: 0x9CD8FF, accent: 0xFFFFFF },
    model: { torso: 'slim', helmet: 'fin', paul: 'small', arm: 'none', back: 'pylons', visor: 'wide' },
    stats: { hp: 660, hpLv: 56, speed: 5.9, radius: 0.65 },
    basic: { name: 'Frost Shard', kind: 'proj', range: 7.5, dmg: 36, cd: 0.85, speed: 20, arc: 0.1, slow: 0.6, size: 0.9, color: 0xBFEFFF },
    s1: { name: 'Frost Mine', kind: 'trap', tag: 'freeze trap', cd: 9, range: 7, radius: 2.4, trigger: 1.4, dur: 12, dmg: 90, slow: true, slowT: 2.5, perk: { at: 4, stun: 0.8 } },
    s2: { name: 'Icicle Volley', kind: 'bolt', tag: 'icicle fan', cd: 8, range: 8, width: 0.8, count: 5, spread: 44, dmg: 45, slow: true, slowT: 1.2, perk: { at: 4, count: 7, spread: 60 } },
    ult: { name: 'Whiteout', kind: 'rain', tag: 'blizzard', cd: 45, range: 10, radius: 6.5, blastR: 1.8, count: 12, dur: 3, dmg: 45, slow: true, slowT: 1.5, perk: { at: 3, count: 16 } },
  },
  {
    id: 'zephyr', name: 'Zephyr', title: 'Gale Archer', role: 'shooter', pair: 'C', color: 0x2F7BFF, accent: 0xBFE0FF,
    model: { torso: 'medium', helmet: 'fin', paul: 'none', arm: 'rifle', back: 'coat', visor: 'v', h: 1.03 },
    stats: { hp: 620, hpLv: 54, speed: 6.3, radius: 0.65 },
    basic: { name: 'Gale Arrow', kind: 'proj', range: 8.5, dmg: 52, cd: 0.8, speed: 28, arc: 0, size: 0.7, color: 0xA8D4FF },
    s1: { name: 'Triple Gust', kind: 'bolt', tag: 'arrow fan', cd: 7, range: 10, width: 0.9, count: 3, spread: 24, dmg: 70, pierce: true, perk: { at: 4, count: 5, spread: 36 } },
    s2: { name: 'Tailwind Roll', kind: 'dash', tag: 'roll + haste', cd: 9, range: 5, width: 1, aim: 'move', selfSpd: 0.35, selfSpdT: 2.5, nextDmg: 50, nextRange: 2, nextT: 3, perk: { at: 4, charges: 2 } },
    ult: { name: 'Arrow Storm', kind: 'rain', tag: 'arrow rain', cd: 45, range: 12, radius: 5, blastR: 1.3, count: 10, dur: 2.5, dmg: 70, perk: { at: 3, count: 14 } },
  },
  {
    id: 'bloom', name: 'Bloom', title: 'Garden Keeper', role: 'support', pair: 'C', color: 0xFF6F91, accent: 0xFFF1B8,
    model: { torso: 'slim', helmet: 'crest', paul: 'discs', arm: 'staff', back: 'drone', visor: 'wide', emblem: 1 },
    stats: { hp: 710, hpLv: 59, speed: 6.1, radius: 0.65 },
    basic: { name: 'Petal Shot', kind: 'proj', range: 7, dmg: 32, cd: 0.7, speed: 15, arc: 0.4, healAlly: 10, size: 1.3, color: 0xFFB3C6 },
    s1: { name: 'Garden Patch', kind: 'field', tag: 'heal garden', cd: 11, range: 7, r: 3.5, dur: 5, healPs: 45, place: 'ally', perk: { at: 4, healPs: 70 } },
    s2: { name: 'Thorn Lash', kind: 'bolt', tag: 'rooting vine', cd: 8, range: 9, width: 1.0, dmg: 60, slow: true, slowT: 2.2, perk: { at: 4, stun: 0.8 } },
    ult: { name: 'Full Bloom', kind: 'buff', tag: 'team renewal', cd: 50, allyR: 9, heal: 200, allyHeal: 200, shield: 120, allyShield: 120, dur: 4, cleanse: true, perk: { at: 3, heal: 300, allyHeal: 300 } },
  },
];
