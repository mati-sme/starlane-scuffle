// Inline SVG icons: angular sci-fi glyphs. Skill glyphs are white on the champion color; icons[kind] / icons['basic_' + kind].
const INK = '#0B1020';
const svg = (body, vb = '0 0 64 64') =>
  `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" stroke="${INK}" stroke-width="3" stroke-linejoin="miter" stroke-linecap="square">${body}</svg>`;

const STAR_PTS = '32,6 39.5,23.5 58,25 44,37.5 48.5,56 32,46.5 15.5,56 20,37.5 6,25 24.5,23.5';
const W = 'fill="#fff"', LINE = (w = 7, c = '#fff') => `fill="none" stroke="${c}" stroke-width="${w}"`;

// Role glyphs (also the portrait emblem).
const ROLE = {
  tank: `<path d="M32 4L56 12V32C56 46 46 56 32 61 18 56 8 46 8 32V12Z" ${W}/><path d="M32 16V48M18 28H46" ${LINE(5, INK)}/>`,
  bruiser: `<polygon points="32,4 56,18 56,46 32,60 8,46 8,18" ${W}/><path d="M20 24h24M20 34h24M20 44h24" ${LINE(4, INK)}/>`,
  assassin: `<polygon points="52,6 58,12 30,40 24,34" ${W}/><polygon points="24,34 30,40 18,46 12,58 6,52 18,40" ${W}/>`,
  blaster: `<polygon points="32,3 39,22 58,14 44,30 60,40 40,42 38,61 30,44 12,56 20,38 4,28 24,26" ${W}/>`,
  shooter: `<circle cx="32" cy="32" r="20" ${LINE(5)}/><circle cx="32" cy="32" r="5" ${W}/><path d="M32 2v14M32 48v14M2 32h14M48 32h14" ${LINE(5)}/>`,
  support: `<polygon points="32,4 58,32 32,60 6,32" ${W}/><path d="M32 20v24M20 32h24" ${LINE(7, INK)}/>`,
};

export const icons = {
  star: (fill = '#FFC83D') => svg(`<polygon points="${STAR_PTS}" fill="${fill}"/>`),
  play: svg('<polygon points="20,10 54,32 20,54" fill="#fff"/>'),
  retry: svg('<path d="M48 22A20 20 0 1 0 52 36" fill="none" stroke="#fff" stroke-width="8"/><polygon points="52,8 54,28 34,24" fill="#fff"/>'),
  tower: (c) => svg(`<polygon points="22,56 42,56 38,24 26,24" fill="#E6ECF2"/><polygon points="20,24 44,24 32,8" fill="${c}"/><rect x="18" y="52" width="28" height="8" fill="${c}"/>`),
  core: (c) => svg(`<polygon points="32,4 56,24 46,56 18,56 8,24" fill="${c}"/><polygon points="32,14 44,26 38,44 26,44 20,26" fill="#fff" stroke="none" opacity=".45"/>`),
  pause: svg('<rect x="14" y="10" width="14" height="44" fill="#fff"/><rect x="36" y="10" width="14" height="44" fill="#fff"/>'),
  sound: svg('<polygon points="8,26 20,26 34,14 34,50 20,38 8,38" fill="#fff"/><path d="M42 24Q50 32 42 40M48 15Q62 32 48 49" fill="none" stroke="#fff" stroke-width="5"/>'),
  mute: svg('<polygon points="6,26 18,26 32,14 32,50 18,38 6,38" fill="#fff"/><path d="M40 24l16 16M56 24L40 40" fill="none" stroke="#FF4D5E" stroke-width="7"/>'),
  home: svg('<polygon points="32,8 58,30 50,30 50,54 14,54 14,30 6,30" fill="#fff"/><rect x="27" y="38" width="10" height="16" fill="#FFC83D"/>'),
  check: svg('<path d="M12 34L26 48L52 16" fill="none" stroke="#fff" stroke-width="10"/>'),
  phone: svg('<rect x="10" y="20" width="44" height="26" fill="#fff"/><path d="M32 8v8M26 12l6-6 6 6" fill="none" stroke="#FFC83D"/>'),
  plus: svg('<path d="M32 10v44M10 32h44" fill="none" stroke="#fff" stroke-width="12"/>'),

  // champion portrait: hex badge in the champion color with the role glyph; role glyph alone
  champ: (def) => svg(`<polygon points="32,2 59,16 59,48 32,62 5,48 5,16" fill="${def.css}"/><g transform="translate(15 15) scale(.55)">${ROLE[def.role]}</g>`),
  role: (r) => svg(ROLE[r]),

  // skill kinds
  dash: svg(`<polygon points="8,20 34,20 34,10 58,32 34,54 34,44 8,44" ${W}/>`),
  leap: svg(`<path d="M8 48Q32 -8 56 48" ${LINE()}/><polygon points="44,42 62,46 54,60" ${W}/>`),
  blink: svg(`<polygon points="10,32 20,16 30,32 20,48" ${W}/><polygon points="32,32 44,14 56,32 44,50" ${LINE(5)}/>`),
  nova: svg(`<circle cx="32" cy="32" r="10" ${W}/><path d="M32 4v12M32 48v12M4 32h12M48 32h12M12 12l8 8M44 44l8 8M52 12l-8 8M20 44l-8 8" ${LINE(5)}/>`),
  cone: svg(`<polygon points="8,32 58,6 58,58" ${W}/>`),
  blast: svg(`<circle cx="32" cy="32" r="19" ${LINE(5)}/><circle cx="32" cy="32" r="7" ${W}/><path d="M32 4v10M32 50v10M4 32h10M50 32h10" ${LINE(5)}/>`),
  rain: svg(`<path d="M22 4l-8 26M38 4l-8 26M54 4l-8 26" ${LINE(6)}/><polygon points="6,52 26,44 58,44 58,58 6,58" ${W}/>`),
  buff: svg(`<path d="M32 5L55 13V32C55 46 45 55 32 60 19 55 9 46 9 32V13Z" ${W}/><path d="M20 36l12-12 12 12" ${LINE(6, INK)}/>`),
  hook: svg(`<path d="M42 6v28a12 12 0 0 1-24 0" ${LINE(8)}/><polygon points="8,30 28,30 18,46" ${W}/>`),
  field: svg(`<circle cx="32" cy="32" r="23" fill="none" stroke="#fff" stroke-width="6" stroke-dasharray="10 6"/><circle cx="32" cy="32" r="8" ${W}/>`),
  turret: svg(`<polygon points="10,56 54,56 48,44 16,44" ${W}/><rect x="20" y="26" width="24" height="18" ${W}/><rect x="40" y="14" width="20" height="9" transform="rotate(20 40 14)" ${W}/>`),
  beam: svg(`<rect x="4" y="25" width="34" height="14" ${W}/><polygon points="38,32 60,8 60,56" ${W}/>`),
  trap: svg(`<polygon points="32,6 40,24 58,32 40,40 32,58 24,40 6,32 24,24" ${W}/><circle cx="32" cy="32" r="7" fill="${INK}"/>`),
  decoy: svg(`<circle cx="22" cy="20" r="9" ${W}/><path d="M10 56V38a12 12 0 0 1 24 0v18Z" ${W}/><circle cx="44" cy="20" r="9" ${LINE(4)}/><path d="M36 56V38a12 12 0 0 1 20 -8v26" ${LINE(4)}/>`),
  quake: svg(`<polygon points="4,58 4,44 16,44 16,32 28,32 28,20 40,20 40,8 60,8 60,58" ${W}/><path d="M42 30l8 8M50 30l-8 8" ${LINE(4, INK)}/>`),
  boomerang: svg(`<path d="M10 14Q54 10 54 54" ${LINE(11)}/><path d="M10 14Q46 18 46 54" ${LINE(4, INK)}/><polygon points="40,50 60,50 50,62" ${W}/>`),
  orbit: svg(`<circle cx="32" cy="32" r="8" ${W}/><ellipse cx="32" cy="32" rx="26" ry="14" fill="none" stroke="#fff" stroke-width="4"/><polygon points="52,16 62,26 50,28" ${W}/><polygon points="12,48 2,38 14,36" ${W}/>`),
  mark: svg(`<circle cx="32" cy="32" r="20" ${LINE(5)}/><path d="M32 4v14M32 46v14M4 32h14M46 32h14" ${LINE(5)}/><polygon points="32,22 42,32 32,42 22,32" ${W}/>`),
  detonate: svg(`<polygon points="32,2 38,22 58,14 44,30 62,38 40,40 40,60 32,46 24,60 24,40 2,38 20,30 6,14 26,22" ${W}/>`),
  vortex: svg(`<path d="M32 32m0 0a5 5 0 1 1 7 7 12 12 0 1 1-16-16 20 20 0 1 1 28 28" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/><circle cx="32" cy="32" r="4" ${W}/>`),
  ricochet: svg(`<path d="M6 54L26 20L40 44L58 10" ${LINE(7)}/><circle cx="26" cy="20" r="6" ${W}/><circle cx="40" cy="44" r="6" ${W}/><circle cx="58" cy="10" r="5" ${W}/>`),
  tether: svg(`<circle cx="14" cy="32" r="10" ${W}/><circle cx="50" cy="32" r="10" ${W}/><path d="M24 32Q32 18 40 32" ${LINE(5)}/><path d="M24 32Q32 46 40 32" ${LINE(5)}/>`),
  missile: svg(`<circle cx="44" cy="32" r="14" ${W}/><path d="M4 32h16M8 22h18M8 42h18" ${LINE(5)}/>`),
  grapple: svg(`<path d="M8 56L34 30" ${LINE(7)}/><polygon points="30,8 58,14 52,42 44,34 34,40 36,30 28,22" ${W}/><circle cx="12" cy="52" r="6" ${W}/>`),
  rewind: svg(`<path d="M32 10a22 22 0 1 1-20 13" ${LINE(7)}/><polygon points="4,10 24,10 12,28" ${W}/><path d="M32 20v14l9 6" ${LINE(5)}/>`),
  swap: svg(`<path d="M10 24h38M10 24l12-12M54 42H16M54 42L42 54" ${LINE(7)}/><circle cx="14" cy="42" r="6" ${W}/><circle cx="50" cy="24" r="6" ${W}/>`),
  totem: svg(`<rect x="22" y="22" width="20" height="36" ${W}/><polygon points="14,22 50,22 32,4" ${W}/><circle cx="32" cy="38" r="6" fill="${INK}"/><path d="M8 52h48" ${LINE(5)}/>`),
  whirl: svg(`<circle cx="32" cy="32" r="8" ${W}/><path d="M32 8a24 24 0 0 1 24 24M56 32a24 24 0 0 1-24 24M32 56A24 24 0 0 1 8 32M8 32A24 24 0 0 1 32 8" fill="none" stroke="#fff" stroke-width="6" stroke-dasharray="26 10"/>`),
  bolt: svg(`<path d="M4 32h40" ${LINE(8)}/><polygon points="42,16 62,32 42,48" ${W}/>`),

  // target buttons + recall
  target_minion: svg(`<circle cx="32" cy="34" r="18" ${W}/><circle cx="25" cy="30" r="3.5" fill="${INK}"/><circle cx="39" cy="30" r="3.5" fill="${INK}"/><path d="M24 42Q32 48 40 42" ${LINE(3, INK)}/><path d="M32 4v8M32 56v6M4 34h8M52 34h8" ${LINE(5)}/>`),
  target_tower: svg(`<polygon points="20,58 44,58 40,26 24,26" ${W}/><polygon points="16,26 48,26 32,6" ${W}/><rect x="28" y="36" width="8" height="12" fill="${INK}"/>`),
  recall: svg(`<path d="M32 6a24 24 0 1 0 24 24" ${LINE(7)}/><polygon points="46,6 58,22 38,24" ${W}/><polygon points="32,20 44,32 40,46 24,46 20,32" ${W}/>`),

  // summoner spells: white glyphs (the button supplies the color)
  spell_flash: svg(`<polygon points="40,4 14,36 28,36 22,60 50,26 35,26" ${W}/><path d="M6 20h12M4 32h10M8 44h12" ${LINE(4)}/>`),
  spell_barrier: svg(`<path d="M32 4L56 13V32C56 46 46 56 32 61 18 56 8 46 8 32V13Z" ${W}/><path d="M32 16L46 21V32C46 40 40 46 32 50 24 46 18 40 18 32V21Z" fill="none" stroke="${INK}" stroke-width="4"/>`),
  spell_ignite: svg(`<path d="M32 3C34 14 50 20 50 38A18 18 0 0 1 14 38C14 30 19 26 22 22 22 29 26 31 28 31 26 20 28 10 32 3Z" ${W}/><path d="M32 60A9 9 0 0 1 23 50C23 44 28 41 32 36 36 41 41 44 41 50A9 9 0 0 1 32 60Z" fill="#FFC83D"/>`),

  // basic attacks
  basic_melee: svg(`<path d="M12 54L50 12" ${LINE(9)}/><path d="M8 20Q32 26 56 56" ${LINE(5)}/>`),
  basic_line: svg(`<path d="M6 58L48 16" ${LINE(6)}/><polygon points="44,6 60,4 58,20 50,22" ${W}/>`),
  basic_proj: svg(`<circle cx="42" cy="26" r="14" ${W}/><path d="M6 54L26 38M10 40l12-8" ${LINE(6)}/>`),
  basic_spread: svg(`<path d="M8 32L58 10M8 32h50M8 32l50 22" ${LINE(6)}/><circle cx="8" cy="32" r="6" ${W}/>`),
};

// Gear glyphs: white on a colored plate (see ui/shop.js).
export const ITEM_GLYPH = {
  sword: '<polygon points="46,8 56,8 56,18 30,44 20,34" fill="#fff"/><polygon points="16,38 26,48 18,56 8,56 8,46" fill="#fff"/>',
  heart: '<path d="M32 56L10 32C4 24 10 10 22 12 27 13 30 16 32 20 34 16 37 13 42 12 54 10 60 24 54 32Z" fill="#fff"/>',
  shield: '<path d="M32 6L54 14V32C54 45 45 54 32 59 19 54 10 45 10 32V14Z" fill="#fff"/>',
  bolt: '<polygon points="38,4 16,36 30,36 24,60 48,26 33,26" fill="#fff"/>',
  boot: '<path d="M18 8H34V30L52 38V54H12V8Z" fill="#fff"/>',
  star: `<polygon points="${STAR_PTS}" fill="#fff"/>`,
};
export const itemIcon = (it) => `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" stroke="${INK}" stroke-width="3" stroke-linejoin="miter"><rect x="2" y="2" width="60" height="60" rx="8" fill="${it.color}"/>${ITEM_GLYPH[it.ic]}</svg>`;
