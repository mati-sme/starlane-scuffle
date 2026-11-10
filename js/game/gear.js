// Gold gear (v9): boots line + components (tier 1) -> finished items (tier 2) -> legendary items (tier 3). Buying an upgrade only costs
// its price minus the components you already hold (they are used up). A recommended build per role is auto-bought in the base ring.
// Stats: ad = outgoing damage %, hp, armor, aspd = attack speed %, speed = move speed %, cdr = cooldown reduction, regen = HP/s (always on),
// ls = lifesteal fraction of damage dealt.
import { ARENA } from '../config.js';
import { fountain } from '../world/arena.js';

// Every price is base * COST_SCALE (tuned with tests/v90-pacing-sim.mjs so a full 7-item build lands near the 15:00 tie-break).
export const COST_SCALE = 0.6;
const T = (id, o) => [id, { ...o, id, cost: Math.round((o.base * COST_SCALE) / 10) * 10 }];
export const ITEMS = Object.fromEntries([
  // boots line
  T('scoutBoots', { name: 'Scout Boots', tier: 1, base: 250, ic: 'boot', color: '#9BE36B', speed: 0.06, tip: '+6% move speed' }),
  T('zoomBoots', { name: 'Zoom Boots', tier: 2, base: 700, from: ['scoutBoots'], ic: 'boot2', color: '#3EE89A', speed: 0.13, tip: '+13% move speed' }),
  T('toughBoots', { name: 'Tough Boots', tier: 2, base: 700, from: ['scoutBoots'], ic: 'boot2', color: '#8FE3FF', speed: 0.07, armor: 18, tip: '+7% move speed, +18 armor' }),
  // components
  T('powerGloves', { name: 'Power Gloves', tier: 1, base: 350, ic: 'glove', color: '#FF8A4C', ad: 0.06, tip: '+6% damage' }),
  T('heartGem', { name: 'Heart Gem', tier: 1, base: 400, ic: 'heart', color: '#FF5C7A', hp: 180, tip: '+180 health' }),
  T('shieldChip', { name: 'Shield Chip', tier: 1, base: 350, ic: 'chip', color: '#6FB7FF', armor: 15, tip: '+15 armor' }),
  T('zipCharm', { name: 'Zip Charm', tier: 1, base: 350, ic: 'bolt', color: '#FFE14D', aspd: 0.12, tip: '+12% attack speed' }),
  T('sparkCell', { name: 'Spark Cell', tier: 1, base: 300, ic: 'cell', color: '#C58CFF', cdr: 0.06, tip: '-6% skill cooldowns' }),
  T('leechFang', { name: 'Leech Fang', tier: 1, base: 400, ic: 'fang', color: '#E0507A', ls: 0.06, tip: 'heal 6% of damage you deal' }),
  // finished items
  T('megaBlade', { name: 'Mega Blade', tier: 2, base: 1000, from: ['powerGloves', 'powerGloves'], ic: 'sword', color: '#FF5A3C', ad: 0.18, aspd: 0.05, tip: '+18% damage, +5% attack speed' }),
  T('rapidRings', { name: 'Rapid Rings', tier: 2, base: 1000, from: ['zipCharm', 'zipCharm'], ic: 'rings', color: '#FFC83D', aspd: 0.3, ad: 0.06, tip: '+30% attack speed, +6% damage' }),
  T('giantHeart', { name: 'Giant Heart', tier: 2, base: 1000, from: ['heartGem', 'heartGem'], ic: 'heart2', color: '#FF3B6B', hp: 400, armor: 10, tip: '+400 health, +10 armor' }),
  T('fortressWall', { name: 'Fortress Wall', tier: 2, base: 1000, from: ['shieldChip', 'shieldChip'], ic: 'wall', color: '#5E9BFF', armor: 36, hp: 120, tip: '+36 armor, +120 health' }),
  T('starStaff', { name: 'Star Staff', tier: 2, base: 950, from: ['powerGloves', 'sparkCell'], ic: 'staff', color: '#C58CFF', ad: 0.16, cdr: 0.1, tip: '+16% damage, -10% cooldowns' }),
  T('vampFang', { name: 'Vamp Fang', tier: 2, base: 1000, from: ['leechFang', 'powerGloves'], ic: 'fang2', color: '#D6306A', ls: 0.1, ad: 0.1, tip: '+10% damage, heal 10% of damage' }),
  T('sunArmor', { name: 'Sun Armor', tier: 2, base: 1050, from: ['heartGem', 'shieldChip'], ic: 'armor', color: '#FFB020', hp: 300, armor: 25, regen: 1.5, tip: '+300 health, +25 armor, +1.5 regen' }),
  // legendary items
  T('titanBlade', { name: 'Titan Blade', tier: 3, base: 1900, from: ['megaBlade', 'powerGloves'], ic: 'sword2', color: '#FF3B1F', ad: 0.34, aspd: 0.08, cdr: 0.05, tip: '+34% damage, +8% attack speed, -5% cooldowns' }),
  T('cometCannon', { name: 'Comet Cannon', tier: 3, base: 1850, from: ['rapidRings', 'zipCharm'], ic: 'comet', color: '#FFAA1D', aspd: 0.52, ad: 0.12, tip: '+52% attack speed, +12% damage' }),
  T('novaStaff', { name: 'Nova Staff', tier: 3, base: 2000, from: ['starStaff', 'powerGloves'], ic: 'staff2', color: '#A06BFF', ad: 0.42, cdr: 0.15, tip: '+42% damage, -15% cooldowns' }),
  T('mountainHeart', { name: 'Mountain Heart', tier: 3, base: 1900, from: ['giantHeart', 'heartGem'], ic: 'heart3', color: '#FF2E5B', hp: 800, armor: 20, regen: 3, tip: '+800 health, +20 armor, +3 regen' }),
  T('aegisBastion', { name: 'Aegis Bastion', tier: 3, base: 1900, from: ['fortressWall', 'shieldChip'], ic: 'wall2', color: '#3E86FF', armor: 70, hp: 300, tip: '+70 armor, +300 health' }),
  T('sunCrown', { name: 'Sun Crown', tier: 3, base: 2100, from: ['sunArmor', 'heartGem'], ic: 'crown', color: '#FFC21A', hp: 600, armor: 45, regen: 3, cdr: 0.08, tip: '+600 health, +45 armor, -8% cooldowns' }),
  T('bloodMoon', { name: 'Blood Moon', tier: 3, base: 2000, from: ['vampFang', 'leechFang'], ic: 'moon', color: '#B8245A', ls: 0.2, ad: 0.25, tip: '+25% damage, heal 20% of damage' }),
]);
export const ITEM_IDS = Object.keys(ITEMS);
export const MAX_ITEMS = 7; // boots + 6 slots

// Finished items to own per role, in purchase order (index 0 is the boots slot).
export const BUILDS = {
  tank: ['toughBoots', 'fortressWall', 'giantHeart', 'aegisBastion', 'mountainHeart', 'sunCrown', 'sunArmor'],
  bruiser: ['zoomBoots', 'megaBlade', 'sunArmor', 'titanBlade', 'bloodMoon', 'mountainHeart', 'vampFang'],
  assassin: ['zoomBoots', 'megaBlade', 'vampFang', 'titanBlade', 'cometCannon', 'bloodMoon', 'giantHeart'],
  blaster: ['zoomBoots', 'starStaff', 'giantHeart', 'novaStaff', 'sunArmor', 'novaStaff', 'mountainHeart'],
  shooter: ['zoomBoots', 'rapidRings', 'vampFang', 'cometCannon', 'titanBlade', 'bloodMoon', 'fortressWall'],
  support: ['toughBoots', 'sunArmor', 'starStaff', 'sunCrown', 'novaStaff', 'mountainHeart', 'aegisBastion'],
};

export const emptyGear = () => ({ ad: 0, hp: 0, armor: 0, aspd: 0, speed: 0, cdr: 0, regen: 0, ls: 0 });

export function gearStats(items, out = emptyGear()) {
  for (const k in out) out[k] = 0;
  for (const id of items) {
    const it = ITEMS[id];
    if (!it) continue;
    for (const k in out) out[k] += it[k] ?? 0;
  }
  return out;
}

export const buildOf = (h) => BUILDS[h.def.role] ?? BUILDS.bruiser;
// Total price of a role's build counted from scratch (tests / docs).
export const buildCost = (role) => (BUILDS[role] ?? BUILDS.bruiser).reduce((s, id) => s + ITEMS[id].cost, 0);

// The next purchase on the way to the recommended build: the first missing finished item's deepest missing component (or the item itself once every
// component is held). Returns { id, item, cost (what it costs you right now), use: [component ids consumed] } or null (fully geared / no free slot).
export function nextBuy(h) {
  const have = {};
  for (const id of h.items) have[id] = (have[id] ?? 0) + 1;
  const step = (id) => {
    const it = ITEMS[id], use = [];
    for (const c of it.from ?? []) {
      if (have[c] > 0) { have[c]--; use.push(c); } else return step(c);
    }
    return { id, item: it, use, cost: it.cost - use.reduce((s, c) => s + ITEMS[c].cost, 0) };
  };
  for (const target of buildOf(h)) {
    if (have[target] > 0) { have[target]--; continue; }
    const s = step(target);
    return h.items.length - s.use.length < MAX_ITEMS ? s : null;
  }
  return null;
}
// UI / bot view of the next purchase: the item card with `cost` set to the price you pay now.
export function nextItem(h) {
  const s = nextBuy(h);
  return s ? { ...s.item, cost: s.cost, full: s.item.cost, id: s.id } : null;
}

// Inside the base ring (fountain heal circle plus the spawn pads).
export function atBase(h) {
  const f = fountain(h.team);
  return Math.hypot(h.x - f.x, h.z - f.z) < ARENA.fountainR + 7;
}

// Buy everything affordable on the recommended path. Returns how many purchases were made.
export function autoBuy(h) {
  let n = 0;
  for (let s = nextBuy(h); s && h.gold >= s.cost; s = nextBuy(h)) {
    h.gold -= s.cost;
    for (const c of s.use) h.items.splice(h.items.indexOf(c), 1);
    h.items.push(s.id);
    n++;
  }
  if (n) h.recalc(false);
  return n;
}
