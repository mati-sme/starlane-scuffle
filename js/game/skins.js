// Color variants ("skins"): 3 buyable palettes per champion + the free default. Pure colour maths (no three.js) + save.js storage.
// A palette recolours the champion's main + accent colours (hue swap, same saturation / lightness), so the model and portrait stay readable.
import { save } from '../save.js';
import { profile, addCoins } from './progress.js';

export const SKIN_PRICE = 60; // cheaper than the cheapest champion unlock (100)
export const PALETTES = {
  ember: { name: 'Ember', hue: 0.04, accentHue: 0.12, swatch: '#FF7A3D' },
  frost: { name: 'Frost', hue: 0.54, accentHue: 0.62, swatch: '#5CD6FF' },
  berry: { name: 'Berry', hue: 0.86, accentHue: 0.76, swatch: '#FF5CC8' },
};
export const SKIN_IDS = Object.keys(PALETTES);

const rgb = (n) => [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
export function toHsl(n) {
  const [r, g, b] = rgb(n), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
export function fromHsl(h, s, l) {
  const f = (p, q, t) => { t = ((t % 1) + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  return (Math.round(f(p, q, h + 1 / 3) * 255) << 16) | (Math.round(f(p, q, h) * 255) << 8) | Math.round(f(p, q, h - 1 / 3) * 255);
}
const swap = (c, hue) => { const [, s, l] = toHsl(c); return fromHsl(hue, Math.max(0.5, s), Math.min(0.62, Math.max(0.3, l))); }; // grey champions still pick up colour; never neon-bright

// { color, accent } of `def` under palette `skin` (null / 'default' = unchanged).
export function paint(def, skin) {
  const p = PALETTES[skin];
  return p ? { color: swap(def.color, p.hue), accent: swap(def.accent, p.accentHue) } : { color: def.color, accent: def.accent };
}
// CSS hue-rotate degrees that turn the default portrait into the palette's look.
export const portraitShift = (def, skin) => (PALETTES[skin] ? Math.round((p0(def, skin) % 1) * 360) : 0);
const p0 = (def, skin) => (((PALETTES[skin].hue - toHsl(def.color)[0]) % 1) + 1) % 1;

let state = null;
const st = () => (state ??= (() => { const s = save.get('skins'); return { owned: Array.isArray(s?.owned) ? s.owned.filter((x) => typeof x === 'string') : [], equip: s?.equip && typeof s.equip === 'object' ? { ...s.equip } : {} }; })());
export const resetSkins = (raw) => { state = null; if (raw) { save.set('skins', raw); } return st(); };
const persist = () => save.set('skins', st());
const key = (id, skin) => `${id}:${skin}`;
export const ownsSkin = (id, skin) => skin === 'default' || (PALETTES[skin] && st().owned.includes(key(id, skin)));
export const equipped = (id) => { const e = st().equip[id]; return PALETTES[e] && ownsSkin(id, e) ? e : 'default'; };
export function equip(id, skin) { if (skin !== 'default' && !ownsSkin(id, skin)) return false; st().equip[id] = skin; persist(); return true; }
export function buySkin(id, skin) {
  if (!PALETTES[skin] || ownsSkin(id, skin)) return { ok: false };
  const p = profile();
  if (p.coins < SKIN_PRICE) return { ok: false, price: SKIN_PRICE };
  p.coins -= SKIN_PRICE; addCoins(0); // addCoins persists the profile
  st().owned.push(key(id, skin)); st().equip[id] = skin; persist();
  return { ok: true, price: SKIN_PRICE };
}
export const skinsOwned = () => st().owned.length;
