// Detailed gear art (v9): a gradient plate in the item's colour, a tier frame (1 silver, 2 gold, 3 glowing violet-gold),
// a two-tone glyph with an ink outline and a sheen. Pure SVG strings (shop bar, store, tooltips).
const INK = '#0B1020';
const mix = (hex, to, k) => {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const a = p(hex), b = p(to);
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, '0')).join('');
};
const W = '#FFFFFF', S = 'rgba(11,16,32,.28)';

// Glyphs are drawn in a 64 box: W = light body, S = shade, c = the item colour (passed in), INK outlines come from the group stroke.
const GLYPH = {
  boot: (c) => `<path d="M19 10h15v20l18 8v14H13V10z" fill="${W}"/><path d="M13 44h39v8H13z" fill="${c}"/><path d="M19 16h15M19 22h15" stroke="${S}" stroke-width="2.5"/>`,
  boot2: (c) => `<path d="M19 12h15v18l18 8v14H13V12z" fill="${W}"/><path d="M13 44h39v8H13z" fill="${c}"/><path d="M34 20l12-8-3 12zM34 28l14-4-5 12z" fill="${c}"/><path d="M19 18h15" stroke="${S}" stroke-width="2.5"/>`,
  glove: (c) => `<path d="M16 54V34l-3-10 6-2 3 8V12h6v18l2-20h6l-1 22 5-14 6 3-6 22 3 6v13z" fill="${W}"/><path d="M16 44h32v10H16z" fill="${c}"/><path d="M26 20v10M34 18v12" stroke="${S}" stroke-width="2"/>`,
  heart: () => `<path d="M32 55 10 32C4 24 10 10 22 11c5 1 8 4 10 8 2-4 5-7 10-8 12-1 18 13 12 21z" fill="${W}"/><path d="M20 18c-4 1-6 5-5 9" stroke="${S}" stroke-width="3" fill="none"/>`,
  heart2: (c) => `<path d="M32 55 10 32C4 24 10 10 22 11c5 1 8 4 10 8 2-4 5-7 10-8 12-1 18 13 12 21z" fill="${W}"/><rect x="24" y="22" width="16" height="6" fill="${c}"/><rect x="29" y="17" width="6" height="16" fill="${c}"/>`,
  heart3: (c) => `<path d="M32 56 9 33C3 25 9 11 22 12c5 1 8 4 10 8 2-4 5-7 10-8 13-1 19 13 13 21z" fill="${W}"/><path d="M18 14l4-8 5 6 5-8 5 8 5-6 4 8z" fill="${c}"/><circle cx="32" cy="34" r="6" fill="${c}"/>`,
  chip: (c) => `<path d="M32 7 52 15v16c0 12-8 21-20 26C20 52 12 43 12 31V15z" fill="${W}"/><path d="M32 14 46 20v11c0 8-5 15-14 19z" fill="${c}"/><circle cx="20" cy="20" r="2" fill="${S}"/><circle cx="44" cy="20" r="2" fill="${S}"/>`,
  bolt: (c) => `<circle cx="32" cy="32" r="22" fill="${c}" opacity=".35"/><path d="M38 5 16 36h13l-5 23 24-33H34z" fill="${W}"/>`,
  cell: (c) => `<rect x="14" y="16" width="36" height="34" rx="5" fill="${W}"/><rect x="24" y="9" width="16" height="8" fill="${W}"/><path d="M34 22 24 36h7l-3 11 11-15h-7z" fill="${c}"/>`,
  fang: (c) => `<path d="M14 14c10-2 22-2 36 0-2 14-8 28-18 40C24 42 16 30 14 14z" fill="${W}"/><path d="M32 46c-5-8-8-16-9-24" stroke="${S}" stroke-width="3" fill="none"/><path d="M44 8c4 6 4 10 0 14-4-4-4-8 0-14z" fill="${c}"/>`,
  fang2: (c) => `<path d="M8 14c7-1 14-1 22 0-1 12-6 22-11 32-6-9-10-20-11-32zM34 14c8-1 15-1 22 0-1 12-5 23-11 32-5-10-10-20-11-32z" fill="${W}"/><circle cx="32" cy="54" r="4" fill="${c}"/>`,
  sword: (c) => `<path d="M46 6h12v12L30 46l-12-12z" fill="${W}"/><path d="M14 38l12 12-8 8H8V46z" fill="${c}"/><path d="M12 36l16 16" stroke="${INK}" stroke-width="3"/><path d="M50 10 24 36" stroke="${S}" stroke-width="3"/>`,
  sword2: (c) => `<path d="M44 4h16v16L32 48 16 32z" fill="${W}"/><path d="M8 36l20 20-9 5-16 0 0-16z" fill="${c}"/><path d="M16 22l8 4M10 28l8 4" stroke="${c}" stroke-width="3"/><path d="M54 8 24 38" stroke="${S}" stroke-width="3"/><path d="M46 18l6 6" stroke="${c}" stroke-width="3"/>`,
  rings: (c) => `<circle cx="24" cy="32" r="15" fill="none" stroke="${W}" stroke-width="8"/><circle cx="42" cy="32" r="15" fill="none" stroke="${c}" stroke-width="8"/><circle cx="24" cy="32" r="15" fill="none" stroke="${INK}" stroke-width="1.5"/>`,
  wall: (c) => `<path d="M8 14h48v40H8z" fill="${W}"/><path d="M8 28h48M8 41h48M22 14v14M42 14v14M32 28v13M16 41v13M48 41v13" stroke="${c}" stroke-width="3"/><path d="M8 8h8v6H8zM28 8h8v6h-8zM48 8h8v6h-8z" fill="${W}"/>`,
  wall2: (c) => `<path d="M32 5 56 13v18c0 14-10 24-24 29C18 55 8 45 8 31V13z" fill="${W}"/><path d="M32 12 48 18v13c0 9-6 16-16 20z" fill="${c}"/><path d="M32 18v26M22 28h20" stroke="${W}" stroke-width="4"/>`,
  staff: (c) => `<path d="M26 26 14 58h8l14-26z" fill="${W}" transform="rotate(0)"/><circle cx="40" cy="22" r="13" fill="${c}"/><path d="M40 12l3 7h7l-6 5 2 7-6-4-6 4 2-7-6-5h7z" fill="${W}"/>`,
  staff2: (c) => `<path d="M24 28 12 58h8l14-26z" fill="${W}"/><circle cx="40" cy="22" r="14" fill="${c}"/><circle cx="40" cy="22" r="7" fill="${W}"/><path d="M40 2v6M40 36v6M20 22h6M54 22h6M26 8l4 4M50 8l-4 4" stroke="${W}" stroke-width="3"/>`,
  armor: (c) => `<path d="M14 10h12l6 6 6-6h12l8 12-8 6v26H14V28l-8-6z" fill="${W}"/><circle cx="32" cy="36" r="9" fill="${c}"/><path d="M32 27v18M23 36h18" stroke="${W}" stroke-width="3"/>`,
  crown: (c) => `<path d="M8 46 6 16l16 14 10-20 10 20 16-14-2 30z" fill="${W}"/><rect x="8" y="46" width="48" height="8" fill="${c}"/><circle cx="32" cy="38" r="4" fill="${c}"/><circle cx="18" cy="38" r="3" fill="${c}"/><circle cx="46" cy="38" r="3" fill="${c}"/>`,
  comet: (c) => `<path d="M6 54 36 30" stroke="${c}" stroke-width="10" stroke-linecap="round"/><path d="M12 46 40 24" stroke="${W}" stroke-width="4" stroke-linecap="round"/><circle cx="42" cy="22" r="14" fill="${W}"/><circle cx="46" cy="18" r="5" fill="${c}"/>`,
  moon: (c) => `<path d="M42 6C26 8 16 20 16 34c0 14 11 24 26 24-6-4-10-10-10-24S36 10 42 6z" fill="${W}"/><path d="M44 30c5 6 5 11 0 16-5-5-5-10 0-16z" fill="${c}"/>`,
};

const FRAME = { 1: ['#D9E2F0', '#8A97B2'], 2: ['#FFE08A', '#C98F00'], 3: ['#FF9BFF', '#7A3CFF'] };

export function itemIcon(it) {
  const id = it.id ?? it.ic, c = it.color, hi = mix(c, '#FFFFFF', 0.35), lo = mix(c, '#0B1020', 0.45), [f0, f1] = FRAME[it.tier ?? 1];
  const g = (GLYPH[it.ic] ?? GLYPH.bolt)(c);
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" class="itemart t${it.tier ?? 1}" data-ic="${it.ic}">
    <defs><linearGradient id="ip-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset=".55" stop-color="${c}"/><stop offset="1" stop-color="${lo}"/></linearGradient>
    <linearGradient id="if-${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${f0}"/><stop offset="1" stop-color="${f1}"/></linearGradient></defs>
    <rect x="1.5" y="1.5" width="61" height="61" rx="10" fill="url(#ip-${id})" stroke="url(#if-${id})" stroke-width="${it.tier === 3 ? 4 : 3}"/>
    ${it.tier === 3 ? `<rect x="6" y="6" width="52" height="52" rx="7" fill="none" stroke="${f0}" stroke-width="1" opacity=".7"/>` : ''}
    <g transform="translate(5 5) scale(.84)" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round">${g}</g>
    <path d="M6 10C6 7 8 6 11 6h42c-6 8-26 10-47 22z" fill="#fff" opacity=".18"/>
    ${it.tier >= 2 ? `<g fill="${f0}" stroke="${INK}" stroke-width="1.5">${'<circle cx="54" cy="55" r="3"/>'}${it.tier === 3 ? '<circle cx="46" cy="55" r="3"/>' : ''}</g>` : ''}
  </svg>`;
}
