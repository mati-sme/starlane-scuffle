// Gold gear: a small catalog (boots + 6 slots), a recommended build per role, and quick-buy at the base.
// Stats: ad = outgoing damage %, hp, armor, aspd = attack speed %, speed = move speed %.
import { ARENA } from '../config.js';
import { fountain } from '../world/arena.js';

export const ITEMS = {
  zoomBoots: { name: 'Zoom Boots', cost: 300, ic: 'boot', color: '#3EE89A', speed: 0.12, tip: '+12% move speed' },
  toughBoots: { name: 'Tough Boots', cost: 300, ic: 'boot', color: '#8FE3FF', speed: 0.07, armor: 15, tip: '+7% move speed, +15 armor' },
  powerGloves: { name: 'Power Gloves', cost: 450, ic: 'sword', color: '#FF8A4C', ad: 0.10, tip: '+10% damage' },
  heartGem: { name: 'Heart Gem', cost: 450, ic: 'heart', color: '#FF5C7A', hp: 220, tip: '+220 health' },
  shieldPlate: { name: 'Shield Plate', cost: 450, ic: 'shield', color: '#8FE3FF', armor: 22, tip: '+22 armor' },
  zipCharm: { name: 'Zip Charm', cost: 450, ic: 'bolt', color: '#FFE14D', aspd: 0.18, tip: '+18% attack speed' },
  megaBlade: { name: 'Mega Blade', cost: 950, ic: 'sword', color: '#FF5A3C', ad: 0.20, aspd: 0.05, tip: '+20% damage, +5% attack speed' },
  giantHeart: { name: 'Giant Heart', cost: 950, ic: 'heart', color: '#FF3B6B', hp: 450, armor: 10, tip: '+450 health, +10 armor' },
  fortressWall: { name: 'Fortress Wall', cost: 1000, ic: 'shield', color: '#6FB7FF', armor: 45, hp: 150, tip: '+45 armor, +150 health' },
  rapidRings: { name: 'Rapid Rings', cost: 1000, ic: 'bolt', color: '#FFC83D', aspd: 0.35, ad: 0.08, tip: '+35% attack speed, +8% damage' },
  starStaff: { name: 'Star Staff', cost: 1100, ic: 'star', color: '#C58CFF', ad: 0.30, tip: '+30% damage' },
  sunArmor: { name: 'Sun Armor', cost: 1200, ic: 'shield', color: '#FFB020', armor: 35, hp: 400, tip: '+35 armor, +400 health' },
};
export const ITEM_IDS = Object.keys(ITEMS);
export const MAX_ITEMS = 7; // boots + 6 slots

// Purchase order per role (index 0 is the boots slot).
export const BUILDS = {
  tank: ['toughBoots', 'heartGem', 'shieldPlate', 'fortressWall', 'giantHeart', 'sunArmor', 'fortressWall'],
  bruiser: ['zoomBoots', 'powerGloves', 'heartGem', 'megaBlade', 'sunArmor', 'giantHeart', 'megaBlade'],
  assassin: ['zoomBoots', 'powerGloves', 'megaBlade', 'zipCharm', 'megaBlade', 'rapidRings', 'giantHeart'],
  blaster: ['zoomBoots', 'powerGloves', 'starStaff', 'heartGem', 'starStaff', 'sunArmor', 'giantHeart'],
  shooter: ['zoomBoots', 'zipCharm', 'rapidRings', 'powerGloves', 'megaBlade', 'rapidRings', 'shieldPlate'],
  support: ['toughBoots', 'heartGem', 'shieldPlate', 'giantHeart', 'sunArmor', 'starStaff', 'fortressWall'],
};

export const emptyGear = () => ({ ad: 0, hp: 0, armor: 0, aspd: 0, speed: 0 });

export function gearStats(items, out = emptyGear()) {
  out.ad = out.hp = out.armor = out.aspd = out.speed = 0;
  for (const id of items) {
    const it = ITEMS[id];
    if (!it) continue;
    for (const k in out) out[k] += it[k] ?? 0;
  }
  return out;
}

export const buildOf = (h) => BUILDS[h.def.role] ?? BUILDS.bruiser;
export const nextItem = (h) => (h.items.length < MAX_ITEMS ? ITEMS[buildOf(h)[h.items.length]] : null);

// Inside the base ring (fountain heal circle plus the spawn pads).
export function atBase(h) {
  const f = fountain(h.team);
  return Math.hypot(h.x - f.x, h.z - f.z) < ARENA.fountainR + 7;
}

// Buy everything affordable from the recommended build. Returns how many items were bought.
export function autoBuy(h) {
  let n = 0;
  for (let it = nextItem(h); it && h.gold >= it.cost; it = nextItem(h)) {
    h.gold -= it.cost;
    h.items.push(buildOf(h)[h.items.length]);
    n++;
  }
  if (n) h.recalc(false);
  return n;
}
