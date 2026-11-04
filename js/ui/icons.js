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
};
