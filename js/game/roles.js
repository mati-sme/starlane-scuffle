// One kid-friendly sentence per role, shown next to the role label on champion select and the info panel.
export const ROLE_BLURB = {
  tank: 'soaks hits and protects friends.',
  bruiser: 'fights up close and keeps on going.',
  assassin: 'sneaks in, pops one hero, then dashes away.',
  blaster: 'blasts big damage from a safe distance.',
  shooter: 'shoots steadily from far away.',
  support: 'heals and shields friends to win fights.',
};

// v10 lane roles: top = two tanks (bruisers fit too), mid = a ranged blaster (assassins fit too), bot = shooter (AD) + support.
export const ROLE_LANE = { tank: 'top', bruiser: 'top', assassin: 'mid', blaster: 'mid', shooter: 'bot', support: 'bot' };
export const LANE_PLAN = { top: 'Top lane · 2 tanks', mid: 'Mid lane · ranged blaster', bot: 'Bot lane · shooter + support' };
// Damage type shown next to the role: shooters are physical (AD), blasters magic (AP) unless their basic attack is a physical shot.
export const dmgType = (def) => (def.role === 'shooter' ? 'AD' : def.role === 'blaster' ? (def.dmgType ?? 'AP') : def.role === 'support' ? 'AP' : 'AD');
export const laneTag = (def) => { const l = ROLE_LANE[def.role] ?? 'mid'; return `<span class="lanetag l-${l}" data-testid="lane-tag">${l.toUpperCase()}</span>`; };
