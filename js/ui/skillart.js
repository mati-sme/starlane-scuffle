// Skill button art (v9): a layered badge per skill. Champion-coloured plate + a category pattern (rays = damage, spiral = crowd control,
// petals = heal, hex = shield, speed lines = movement, wisps = stealth), the kind's white glyph on a glow in the champion's accent colour,
// and a small category medal. Also the passive icons. Pure SVG strings (HUD buttons, detail pane, store).
import { icons } from './icons.js';

const INK = '#0B1020';
const css = (n) => '#' + (n ?? 0xffffff).toString(16).padStart(6, '0');
const mix = (hex, to, k) => {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const a = p(hex), b = p(to);
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, '0')).join('');
};

const MOVE = new Set(['dash', 'blink', 'leap', 'grapple', 'zipline', 'flit', 'pounce', 'vault', 'plow', 'fold', 'swap', 'drift', 'ropes', 'recoil', 'castoff', 'pirouette']);
export function skillCategory(ab) {
  if (!ab) return 'dmg';
  if (ab.hide || ab.untarget) return 'stealth';
  if (ab.heal || ab.allyHeal || ab.healPs || ab.tHeal || ab.mode === 'heal') return 'heal';
  if (ab.shield || ab.allyShield || ab.dr || ab.selfDr || ab.allyDr || ab.wall) return 'shield';
  if (ab.stun || ab.pull || ab.root || ab.knock || ab.air || ab.slow || ab.tSlow || ab.silence) return 'cc';
  if (MOVE.has(ab.kind)) return 'move';
  return 'dmg';
}

const PATTERN = {
  dmg: (c) => `<g stroke="${c}" stroke-width="3" opacity=".55">${Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * 6.283; return `<path d="M${32 + Math.cos(a) * 14} ${32 + Math.sin(a) * 14}L${32 + Math.cos(a) * 31} ${32 + Math.sin(a) * 31}"/>`; }).join('')}</g>`,
  cc: (c) => `<path d="M32 32m0 0a4 4 0 1 1 6 6 10 10 0 1 1-14-14 16 16 0 1 1 22 22 22 22 0 1 1-30-30" fill="none" stroke="${c}" stroke-width="3" opacity=".6"/>`,
  heal: (c) => `<g fill="${c}" opacity=".5">${Array.from({ length: 6 }, (_, i) => `<ellipse cx="32" cy="14" rx="5" ry="11" transform="rotate(${i * 60} 32 32)"/>`).join('')}</g>`,
  shield: (c) => `<g fill="none" stroke="${c}" stroke-width="2.4" opacity=".55"><path d="M32 6l9 5v9l-9 5-9-5v-9zM14 26l9 5v9l-9 5-9-5v-9zM50 26l9 5v9l-9 5-9-5v-9zM32 44l9 5v9l-9 5-9-5v-9z"/></g>`,
  move: (c) => `<g stroke="${c}" stroke-width="3.5" stroke-linecap="round" opacity=".6"><path d="M4 18h22M10 30h18M2 42h24M8 52h16"/></g>`,
  stealth: (c) => `<g fill="${c}" opacity=".45"><circle cx="14" cy="20" r="6"/><circle cx="50" cy="16" r="4"/><circle cx="48" cy="48" r="7"/><circle cx="16" cy="50" r="4"/></g>`,
};
const MEDAL = {
  dmg: '<path d="M8 3l2 4 4 .5-3 3 1 4-4-2-4 2 1-4-3-3 4-.5z" fill="#FF7A3D"/>',
  cc: '<path d="M8 3a5 5 0 1 0 5 5h-3a2 2 0 1 1-2-2z" fill="#FFD35C"/>',
  heal: '<path d="M6 3h4v3h3v4h-3v3H6v-3H3V6h3z" fill="#4CE08A"/>',
  shield: '<path d="M8 2l5 2v4c0 3-2 5-5 6-3-1-5-3-5-6V4z" fill="#7CC8FF"/>',
  move: '<path d="M2 6h7V3l6 5-6 5v-3H2z" fill="#B9F06A"/>',
  stealth: '<path d="M1 8c3-5 11-5 14 0-3 5-11 5-14 0z" fill="#C7A6FF"/><circle cx="8" cy="8" r="2.4" fill="#2B1A4A"/>',
};

// kind: the skill kind (glyph key); ab: the rank-resolved or base skill def; def: the champion def (colours).
export function skillArt(kind, ab, def, { medal = true } = {}) {
  const c1 = css(def.fx?.color ?? def.color), c2 = css(def.fx?.accent ?? def.accent);
  const cat = skillCategory(ab ?? { kind }), id = `${def.id}-${kind}`;
  const glyph = icons[kind] ?? icons.bolt;
  const hi = mix(c1, '#FFFFFF', 0.55), lo = mix(c1, INK, 0.55), rim = mix(c2, '#FFFFFF', 0.35);
  const g = glyph.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" class="skart cat-${cat}" data-kind="${kind}" data-cat="${cat}">
    <defs>
      <radialGradient id="sg-${id}" cx=".35" cy=".28" r=".85"><stop offset="0" stop-color="${hi}"/><stop offset=".45" stop-color="${c1}"/><stop offset="1" stop-color="${lo}"/></radialGradient>
      <linearGradient id="rim-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${rim}"/><stop offset=".5" stop-color="${mix(c2, INK, 0.2)}"/><stop offset="1" stop-color="${mix(c2, INK, 0.55)}"/></linearGradient>
      <radialGradient id="well-${id}" cx=".5" cy=".42" r=".5"><stop offset="0" stop-color="${mix(c2, '#FFFFFF', 0.12)}" stop-opacity=".35"/><stop offset="1" stop-color="${INK}" stop-opacity=".15"/></radialGradient>
    </defs>
    <circle cx="32" cy="33.5" r="29.5" fill="${INK}" opacity=".35"/>
    <circle cx="32" cy="32" r="29.5" fill="url(#rim-${id})"/>
    <circle cx="32" cy="32" r="26.5" fill="url(#sg-${id})"/>
    <g opacity=".28">${PATTERN[cat](mix(c2, '#FFFFFF', 0.4))}</g>
    <circle cx="32" cy="32" r="21" fill="url(#well-${id})"/>
    <path d="M18 15a18 18 0 0 1 18-2" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".22"/>
    <circle cx="32" cy="32" r="26.2" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="1.2"/>
    <g style="filter:drop-shadow(0 2px 0 ${INK})"><svg x="10" y="9" width="44" height="44" viewBox="0 0 64 64" overflow="visible" style="color:#fff">${g}</svg></g>
    ${medal ? `<g transform="translate(41 41)"><circle cx="8" cy="8" r="8.5" fill="${INK}" stroke="${rim}" stroke-width="1.4"/>${MEDAL[cat]}</g>` : ''}
  </svg>`;
}

// ---- passives: a hex badge with a kind glyph (white on the champion colour), always shown next to the portrait ----
const PG = {
  nthHit: '<path d="M16 46L32 14l16 32zM24 46h16" fill="#fff"/><circle cx="32" cy="38" r="3" fill="#0B1020"/>',
  firstStrike: '<path d="M32 10l6 16 16 2-12 10 4 16-14-9-14 9 4-16L10 28l16-2z" fill="#fff"/>',
  hitHaste: '<path d="M10 22h24M6 32h28M10 42h24" stroke="#fff" stroke-width="5" fill="none"/><path d="M38 14l18 18-18 18z" fill="#fff"/>',
  hitCdr: '<circle cx="32" cy="34" r="17" fill="none" stroke="#fff" stroke-width="6"/><path d="M32 22v12l8 5" stroke="#fff" stroke-width="5" fill="none"/><path d="M22 8h20" stroke="#fff" stroke-width="5"/>',
  hitSlow: '<path d="M32 8l6 12 12 2-9 9 2 13-11-6-11 6 2-13-9-9 12-2z" fill="#fff"/><path d="M12 54h40" stroke="#fff" stroke-width="5" stroke-dasharray="8 5"/>',
  hitHeal: '<path d="M32 54L11 33C5 26 11 12 23 13c5 1 8 4 9 7 1-3 4-6 9-7 12-1 18 13 12 20z" fill="#fff"/>',
  execute: '<path d="M14 14l36 36M50 14L14 50" stroke="#fff" stroke-width="8"/><circle cx="32" cy="32" r="6" fill="#fff"/>',
  castHaste: '<path d="M36 6L18 36h12l-4 22 20-32H34z" fill="#fff"/>',
  castShield: '<path d="M32 6l22 8v18c0 14-9 23-22 28C19 55 10 46 10 32V14z" fill="#fff"/><path d="M32 18v28M20 30h24" stroke="#0B1020" stroke-width="5"/>',
  castEmpower: '<path d="M44 8h12v12L30 46 18 34z" fill="#fff"/><path d="M12 38l14 14-8 6H6V46z" fill="#fff"/>',
  castHeal: '<path d="M26 8h12v18h18v12H38v18H26V38H8V26h18z" fill="#fff"/>',
  lowShield: '<circle cx="32" cy="32" r="22" fill="none" stroke="#fff" stroke-width="6"/><path d="M32 18v14l9 6" stroke="#fff" stroke-width="5" fill="none"/>',
  thorns: '<path d="M32 6l6 16 16-2-10 12 10 12-16-2-6 16-6-16-16 2 10-12L10 20l16 2z" fill="#fff"/>',
  stackDr: '<rect x="10" y="40" width="44" height="10" fill="#fff"/><rect x="16" y="26" width="32" height="10" fill="#fff"/><rect x="22" y="12" width="20" height="10" fill="#fff"/>',
  woundedHaste: '<path d="M32 56L10 34C4 26 10 12 22 13c5 1 8 4 10 8 2-4 5-7 10-8 12-1 18 13 12 21z" fill="#fff"/><path d="M26 22l-6 12h10l-4 12 14-16H30l6-8z" fill="#0B1020"/>',
  killHeal: '<circle cx="32" cy="26" r="16" fill="#fff"/><path d="M22 44h20v10H22z" fill="#fff"/><circle cx="26" cy="26" r="4" fill="#0B1020"/><circle cx="38" cy="26" r="4" fill="#0B1020"/>',
  auraRegen: '<circle cx="32" cy="32" r="8" fill="#fff"/><circle cx="32" cy="32" r="22" fill="none" stroke="#fff" stroke-width="4" stroke-dasharray="7 5"/><path d="M32 22v20M22 32h20" stroke="#0B1020" stroke-width="3"/>',
  auraHaste: '<circle cx="32" cy="32" r="8" fill="#fff"/><circle cx="32" cy="32" r="22" fill="none" stroke="#fff" stroke-width="4" stroke-dasharray="7 5"/><path d="M26 24l12 8-12 8z" fill="#0B1020"/>',
  calmSpeed: '<path d="M10 40c8-18 36-18 44 0" stroke="#fff" stroke-width="6" fill="none"/><circle cx="32" cy="22" r="8" fill="#fff"/><path d="M14 52h36" stroke="#fff" stroke-width="5"/>',
  brushSpeed: '<path d="M32 8c-8 10-16 18-16 30 0 8 7 14 16 14s16-6 16-14C48 26 40 18 32 8z" fill="#fff"/><path d="M32 22v30" stroke="#0B1020" stroke-width="3"/>',
  stillGuard: '<rect x="14" y="12" width="36" height="40" rx="6" fill="#fff"/><path d="M22 24h20M22 34h20M22 44h12" stroke="#0B1020" stroke-width="4"/>',
};
export function passiveArt(p, def) {
  const c1 = css(def.fx?.color ?? def.color), c2 = css(def.fx?.accent ?? def.accent), id = `ps-${def.id}`;
  const g = PG[p?.kind] ?? PG.firstStrike;
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" class="psart" data-pkind="${p?.kind ?? ''}">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(c1, '#FFFFFF', 0.35)}"/><stop offset="1" stop-color="${mix(c1, '#0B1020', 0.5)}"/></linearGradient></defs>
    <polygon points="32,2 59,16 59,48 32,62 5,48 5,16" fill="url(#${id})" stroke="${c2}" stroke-width="3.5" stroke-linejoin="round"/>
    <polygon points="32,8 53,19 53,45 32,56 11,45 11,19" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="1.5"/>
    <g transform="translate(14 14) scale(.58)" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round" style="filter:drop-shadow(0 1.5px 0 ${INK})">${g}</g>
  </svg>`;
}
