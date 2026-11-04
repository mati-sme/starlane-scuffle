// Inline SVG icons (chunky, rounded, ink-outlined).
const INK = '#23163A';
const svg = (body, vb = '0 0 64 64') =>
  `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">${body}</svg>`;

const STAR_PTS = '32,6 39.5,23.5 58,25 44,37.5 48.5,56 32,46.5 15.5,56 20,37.5 6,25 24.5,23.5';

export const icons = {
  star: (fill = '#FFD23F') => svg(`<polygon points="${STAR_PTS}" fill="${fill}"/>`),
  play: svg('<polygon points="20,10 54,32 20,54" fill="#fff"/>'),
  retry: svg('<path d="M48 22A20 20 0 1 0 52 36" fill="none" stroke="#fff" stroke-width="8"/><polygon points="52,8 54,28 34,24" fill="#fff"/>'),
  smile: svg('<circle cx="32" cy="32" r="26" fill="#FFD23F"/><circle cx="23" cy="26" r="3.5" fill="#23163A"/><circle cx="41" cy="26" r="3.5" fill="#23163A"/><path d="M20 38Q32 52 44 38" fill="none"/>'),
  claw: svg('<path d="M16 50L28 12M30 54L40 10M44 52L52 16" fill="none" stroke="#fff" stroke-width="8"/>'),
  fox: svg('<polygon points="8,8 28,20 12,34" fill="#FF8A3D"/><polygon points="56,8 36,20 52,34" fill="#FF8A3D"/><ellipse cx="32" cy="36" rx="23" ry="19" fill="#FF8A3D"/><ellipse cx="32" cy="46" rx="11" ry="8" fill="#FFF1DC" stroke="none"/><circle cx="23" cy="33" r="4" fill="#23163A" stroke="none"/><circle cx="41" cy="33" r="4" fill="#23163A" stroke="none"/><circle cx="32" cy="44" r="3" fill="#23163A" stroke="none"/>'),
  tower: (c) => svg(`<polygon points="22,56 42,56 38,24 26,24" fill="#F4EEFA"/><polygon points="20,24 44,24 32,8" fill="${c}"/><rect x="18" y="52" width="28" height="8" fill="${c}"/>`),
  core: (c) => svg(`<polygon points="32,4 56,24 46,56 18,56 8,24" fill="${c}"/><polygon points="32,14 44,26 38,44 26,44 20,26" fill="#fff" stroke="none" opacity=".45"/>`),
  phone: svg('<rect x="10" y="20" width="44" height="26" rx="6" fill="#fff"/><path d="M32 8v8M26 12l6-6 6 6" fill="none" stroke="#FFD23F"/>'),

  // hero portraits
  bear: svg('<circle cx="14" cy="16" r="9" fill="#6BBF59"/><circle cx="50" cy="16" r="9" fill="#6BBF59"/><ellipse cx="32" cy="36" rx="24" ry="21" fill="#6BBF59"/><ellipse cx="32" cy="45" rx="11" ry="8" fill="#B4E38E" stroke="none"/><circle cx="23" cy="32" r="4" fill="#23163A" stroke="none"/><circle cx="41" cy="32" r="4" fill="#23163A" stroke="none"/><ellipse cx="32" cy="42" rx="4" ry="3" fill="#23163A" stroke="none"/>'),
  bunny: svg('<ellipse cx="21" cy="15" rx="7" ry="15" fill="#C9A7FF"/><ellipse cx="43" cy="15" rx="7" ry="15" fill="#C9A7FF"/><ellipse cx="32" cy="42" rx="22" ry="18" fill="#C9A7FF"/><circle cx="23" cy="40" r="4" fill="#23163A" stroke="none"/><circle cx="41" cy="40" r="4" fill="#23163A" stroke="none"/><ellipse cx="32" cy="48" rx="4" ry="3" fill="#FF9AD5" stroke="none"/>'),
  penguin: svg('<ellipse cx="32" cy="34" rx="23" ry="24" fill="#34407F"/><ellipse cx="32" cy="44" rx="14" ry="13" fill="#F4F8FF" stroke="none"/><rect x="13" y="20" width="38" height="14" rx="7" fill="#3DE0D0"/><polygon points="26,38 38,38 32,47" fill="#FFA23D"/>'),

  // upgrade cards
  boots: svg('<path d="M18 8h16v26l16 8v12H14z" fill="#7BE0FF"/>'),
  heart: svg('<path d="M32 56L10 32C4 22 12 8 24 10c4 1 7 4 8 8 1-4 4-7 8-8 12-2 20 12 14 22z" fill="#FF6B8B"/>'),
  hands: svg('<circle cx="32" cy="36" r="22" fill="#fff"/><path d="M32 36V22M32 36l10 6" fill="none"/><path d="M26 8h12" fill="none"/>'),

  // skills (white glyphs on a hero-colored button)
  zip_tail: svg('<path d="M10 48Q30 6 56 20" fill="none" stroke="#fff" stroke-width="10"/><circle cx="54" cy="20" r="6" fill="#FFD23F"/>'),
  zip_dash: svg('<polygon points="10,22 38,22 38,10 58,32 38,54 38,42 10,42" fill="#fff"/>'),
  zip_spin: svg('<circle cx="32" cy="32" r="18" fill="none" stroke="#fff" stroke-width="9"/><polygon points="40,6 58,14 44,26" fill="#FFD23F"/>'),
  zip_meteor: svg('<path d="M6 10L34 34" fill="none" stroke="#fff" stroke-width="8"/><polygon points="44,22 49,34 62,35 52,43 55,56 44,49 33,56 36,43 26,35 39,34" fill="#FFD23F"/>'),
  moss_paw: svg('<ellipse cx="32" cy="42" rx="15" ry="12" fill="#fff"/><circle cx="14" cy="26" r="6" fill="#fff"/><circle cx="26" cy="16" r="6" fill="#fff"/><circle cx="38" cy="16" r="6" fill="#fff"/><circle cx="50" cy="26" r="6" fill="#fff"/>'),
  moss_vine: svg('<path d="M10 54Q16 18 32 34T54 10" fill="none" stroke="#fff" stroke-width="9"/><ellipse cx="50" cy="42" rx="8" ry="5" transform="rotate(-30 50 42)" fill="#B4E38E"/>'),
  moss_shield: svg('<path d="M32 6L54 14V32C54 46 44 56 32 60 20 56 10 46 10 32V14Z" fill="#fff"/><path d="M32 18V48" fill="none" stroke="#6BBF59" stroke-width="6"/>'),
  moss_quake: svg('<circle cx="32" cy="36" r="8" fill="#fff"/><circle cx="32" cy="36" r="17" fill="none" stroke="#fff" stroke-width="6"/><circle cx="32" cy="36" r="27" fill="none" stroke="#FF8EC4" stroke-width="5"/>'),
  luma_bolt: svg('<polygon points="32,6 38,24 56,24 42,35 47,54 32,43 17,54 22,35 8,24 26,24" fill="#fff"/>'),
  luma_burst: svg('<polygon points="32,4 39,25 60,32 39,39 32,60 25,39 4,32 25,25" fill="#FFE680"/>'),
  luma_blink: svg('<path d="M8 20l10 10-10 10M24 20l10 10-10 10" fill="none" stroke="#fff" stroke-width="7"/><polygon points="50,34 54,44 62,45 56,51 58,60 50,55 42,60 44,51 38,45 46,44" fill="#FF9AD5"/>'),
  luma_shower: svg('<polygon points="18,8 21,16 30,17 23,23 25,32 18,27 11,32 13,23 6,17 15,16" fill="#fff"/><polygon points="46,22 49,30 58,31 51,37 53,46 46,41 39,46 41,37 34,31 43,30" fill="#FFE680"/><polygon points="22,42 25,50 33,51 27,56 29,63 22,59 15,63 17,56 11,51 19,50" fill="#FF9AD5"/>'),
  clink_snowball: svg('<circle cx="38" cy="30" r="18" fill="#fff"/><path d="M6 52L20 42M8 38L18 34" fill="none" stroke="#BFF4FF" stroke-width="6"/>'),
  clink_turret: svg('<rect x="14" y="46" width="36" height="10" rx="4" fill="#fff"/><ellipse cx="32" cy="38" rx="14" ry="12" fill="#fff"/><rect x="30" y="12" width="24" height="12" rx="5" transform="rotate(25 30 12)" fill="#BFF4FF"/>'),
  clink_slide: svg('<ellipse cx="40" cy="36" rx="20" ry="12" fill="#fff"/><path d="M4 28h14M2 40h18M8 50h12" fill="none" stroke="#BFF4FF" stroke-width="5"/>'),
  clink_beam: svg('<rect x="6" y="24" width="38" height="16" rx="6" fill="#fff"/><polygon points="44,32 62,12 62,52" fill="#BFF4FF"/>'),
};
