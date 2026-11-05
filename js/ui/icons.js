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
  bolt: svg(`<path d="M4 32h40" ${LINE(8)}/><polygon points="42,16 62,32 42,48" ${W}/>`),

  // target buttons + recall
  target_minion: svg(`<circle cx="32" cy="34" r="18" ${W}/><circle cx="25" cy="30" r="3.5" fill="${INK}"/><circle cx="39" cy="30" r="3.5" fill="${INK}"/><path d="M24 42Q32 48 40 42" ${LINE(3, INK)}/><path d="M32 4v8M32 56v6M4 34h8M52 34h8" ${LINE(5)}/>`),
  target_tower: svg(`<polygon points="20,58 44,58 40,26 24,26" ${W}/><polygon points="16,26 48,26 32,6" ${W}/><rect x="28" y="36" width="8" height="12" fill="${INK}"/>`),
  recall: svg(`<path d="M32 6a24 24 0 1 0 24 24" ${LINE(7)}/><polygon points="46,6 58,22 38,24" ${W}/><polygon points="32,20 44,32 40,46 24,46 20,32" ${W}/>`),

  // basic attacks
  basic_melee: svg(`<path d="M12 54L50 12" ${LINE(9)}/><path d="M8 20Q32 26 56 56" ${LINE(5)}/>`),
  basic_line: svg(`<path d="M6 58L48 16" ${LINE(6)}/><polygon points="44,6 60,4 58,20 50,22" ${W}/>`),
  basic_proj: svg(`<circle cx="42" cy="26" r="14" ${W}/><path d="M6 54L26 38M10 40l12-8" ${LINE(6)}/>`),
  basic_spread: svg(`<path d="M8 32L58 10M8 32h50M8 32l50 22" ${LINE(6)}/><circle cx="8" cy="32" r="6" ${W}/>`),
};
