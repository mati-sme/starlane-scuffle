// "Strong vs" / "Weak vs": computed from kit tags, so new champions are covered the moment they join HEROES.
// Each champion gets a few kit traits; pairs are scored by simple rock-paper-scissors rules, and the top / bottom 3 win.
// OVERRIDES can pin a champion's lists: { id: { strong: [ids], weak: [ids] } } (missing ids are ignored).
import { HEROES, ROSTER } from '../heroes/index.js';

export const OVERRIDES = {};

const MOVE = new Set(['dash', 'blink', 'leap', 'grapple', 'swap', 'rewind', 'boomerang']);
const POKE = new Set(['beam', 'rain', 'missile', 'bolt', 'proj', 'line', 'spread', 'ricochet']);
const CC = ['stun', 'pull', 'root', 'knock', 'slow', 'air', 'tSlow'];
const KEEP = ['heal', 'allyHeal', 'healPs', 'shield', 'allyShield', 'tHeal', 'selfDr', 'allyDr'];

const kits = (d) => [d.s1, d.s2, d.s3, d.ult].filter(Boolean);
const has = (a, keys) => keys.some((k) => a[k]);

function traits(d) {
  const ks = kits(d);
  const dmg = ks.reduce((n, a) => n + (a.dmg ?? 0) + (a.dps ?? 0) * 2 + (a.tDmg ?? 0), 0);
  return {
    id: d.id,
    role: d.role,
    hp: d.stats.hp,
    speed: d.stats.speed,
    range: d.basic.range,
    melee: d.basic.kind === 'melee' || d.basic.range < 4,
    mobile: ks.filter((a) => MOVE.has(a.kind)).length + (d.stats.speed >= 6.8 ? 1 : 0),
    cc: ks.filter((a) => has(a, CC) || a.kind === 'hook' || a.kind === 'vortex').length,
    sustain: ks.filter((a) => has(a, KEEP) || a.kind === 'buff').length + (d.role === 'support' ? 1 : 0),
    poke: (d.basic.range >= 6 ? 1 : 0) + ks.filter((a) => POKE.has(a.kind) || (a.range ?? 0) >= 9).length,
    burst: dmg,
  };
}

// Quantiles across the live roster so "squishy" / "big damage" adapt as champions are added.
let cache = { key: '', t: {}, hpLo: 0, hpHi: 0, burstHi: 0 };
function table() {
  const key = ROSTER.join(',');
  if (cache.key === key) return cache;
  const t = Object.fromEntries(ROSTER.map((id) => [id, traits(HEROES[id])]));
  const q = (f, p) => { const a = ROSTER.map((id) => f(t[id])).sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(a.length * p))]; };
  cache = { key, t, hpLo: q((x) => x.hp, 0.35), hpHi: q((x) => x.hp, 0.65), burstHi: q((x) => x.burst, 0.65) };
  return cache;
}

// How well `a` does against `b` (the reverse is scored separately, then subtracted).
function edge(a, b, c) {
  let s = 0;
  if (a.mobile && !b.mobile) s += 1.2; // chasers / escapers beat heroes that cannot move around
  if (!a.melee && b.melee && a.range >= 5) s += 1.2; // range beats melee
  if (a.sustain && b.poke >= 2 && b.sustain === 0) s += 1; // healing outlasts poke
  if (a.burst >= c.burstHi && b.hp <= c.hpLo) s += 1.5; // burst pops squishy heroes
  if (b.role === 'assassin' && (a.cc || a.role === 'tank' || a.role === 'support')) s += 1.3; // peel stops assassins
  if (a.role === 'assassin' && (b.role === 'shooter' || b.role === 'blaster')) s += 1; // assassins reach backliners
  if (a.role === 'tank' && b.burst < c.burstHi && b.hp <= c.hpHi && b.cc === 0) s += 0.6; // tanks shrug off light damage
  if (a.cc && b.melee && b.mobile === 0) s += 0.6; // pinned melee heroes cannot get away
  if (a.poke >= 2 && b.hp >= c.hpHi && b.mobile === 0 && b.range < 5) s += 0.8; // poke wears down slow giants
  return s;
}

const tie = (a, b) => { let h = 0; for (const ch of a + '|' + b) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return (h % 97) / 1000; };

const memo = new Map();
export function matchupsOf(id) {
  const c = table();
  const key = c.key + '#' + id;
  if (memo.has(key)) return memo.get(key);
  const me = c.t[id];
  let out = { strong: [], weak: [] };
  if (me) {
    const rows = ROSTER.filter((o) => o !== id).map((o) => ({ o, v: edge(me, c.t[o], c) - edge(c.t[o], me, c) + tie(id, o) }));
    rows.sort((a, b) => b.v - a.v);
    out = { strong: rows.slice(0, 3).map((r) => r.o), weak: rows.slice(-3).reverse().map((r) => r.o) };
    const ov = OVERRIDES[id];
    if (ov) for (const k of ['strong', 'weak']) if (ov[k]) out[k] = ov[k].filter((x) => HEROES[x]).slice(0, 3).concat(out[k]).filter((x, i, a) => a.indexOf(x) === i).slice(0, 3);
  }
  if (memo.size > 400) memo.clear();
  memo.set(key, out);
  return out;
}
