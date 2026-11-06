// Host -> guest state. encodeSnap packs the whole match into small arrays (sent ~10 Hz);
// applySnap lays it onto the guest's mirror Match. Events ride along in `e` so they stay ordered with the state.
//   hero row:   [x, z, face, hp, maxHp, flags, level, xp, points, ranks, cd0, cd1, cd2, respawn, respawnTotal, gold, [item index...]]
//   flags:      1 alive · 2 hidden · 4 stunned · 8 shielded · 16 burning (Ignite)
//   struct row: [hp, flags]            1 alive · 2 vulnerable · 4 shielded · 8 nexus pulse
//   minion row: [id, team, kind, lane, x, z, hp, facing]      camp / boss row: [alive, hp, x, z, spawnIn, variant]   buffs bf: [[fire, ice, gale, dragonT, titanT, heraldT] x 2]
//   events:     ['c', hero, slot] cast · ['s', hero, spell id, burn target or -1] summoner spell · ['w', hero] swing · ['p', src, tgt, speed, arc, y] shot · ['k', victim, killer] takedown
//   refs (src / tgt): 0-9 hero index · 20+ structure index · 100+ minion id
import { bus } from '../core/bus.js';
import { DYING } from '../game/combat.js';
import { vfx } from '../render/vfx.js';
import { PAL } from '../config.js';
import { reconcile } from './client.js';
import { ITEM_IDS } from '../game/gear.js';
import { SPELLS, spellFx } from '../game/spells.js';

const KINDS = ['blobling', 'zapper', 'bigblob'];
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;

export function refOf(match, e) {
  if (e.type === 'hero') return match.heroes.indexOf(e);
  if (e.type === 'minion') return 100 + e.nid;
  if (e.type === 'tower' || e.type === 'core') return 20 + match.structures.indexOf(e);
  return -1;
}

function find(match, ref) {
  if (ref < 0) return null;
  if (ref < 20) return match.heroes[ref] ?? null;
  if (ref < 100) return match.structures[ref - 20] ?? null;
  return match.minions.byId.get(ref - 100) ?? null;
}

export function encodeSnap(match, seq, events) {
  const s = {
    t: 'snap', n: seq, tm: r2(match.time), st: match.storm ? 1 : 0, wv: match.waveNo, k: match.kills, d: match.destroyed, tl: match.towersLost,
    h: match.heroes.map((h) => [
      r1(h.x), r1(h.z), r2(h.face), Math.round(h.hp), h.maxHp,
      (h.alive ? 1 : 0) | (h.hidden ? 2 : 0) | (h.stun > 0 ? 4 : 0) | (h.shieldHp > 0 && h.shieldT > 0 ? 8 : 0) | (h.burn ? 16 : 0),
      h.level, Math.round(h.xp), h.points, h.ranks[0] | (h.ranks[1] << 3) | (h.ranks[2] << 6),
      r1(h.cds[0]), r1(h.cds[1]), r1(h.cds[2]), r1(h.respawn), r1(h.respawnTotal),
      Math.floor(h.gold), h.items.map((id) => ITEM_IDS.indexOf(id)),
    ]),
    s: match.structures.map((x) => [Math.round(x.hp), (x.alive ? 1 : 0) | (x.vulnerable ? 2 : 0) | (x.shielded ? 4 : 0) | (x.pulseT > 0 ? 8 : 0)]),
    m: match.minions.list.filter((m) => m.alive).map((m) => [m.nid, m.team, KINDS.indexOf(m.kind), m.lane, r1(m.x), r1(m.z), Math.round(m.hp), r2(m.facing)]),
    c: match.camps.list.map((c) => [c.alive ? 1 : 0, Math.round(c.hp), r1(c.x), r1(c.z), Math.round(match.camps.eta(c, match.time)), c.variant]),
    bf: match.buffs.map((b) => [b.fire, b.ice, b.gale, Math.round(b.dragonT), Math.round(b.titanT), Math.round(b.heraldT)]),
  };
  const se = match.seasons.encode();
  if (se) s.se = se; // additive: older guests ignore it
  if (match.over) { s.ov = 1; s.w = match.win ? 1 : 0; s.rr = match.rawReason; }
  if (events.length) s.e = events;
  return s;
}

export function applySnap(match, s) {
  match.snapAt = performance.now();
  if (match.seasons.decode(s.se)) bus.emit('season', match.seasons.id);
  match.storm = !!s.st; match.waveNo = s.wv; match.kills = s.k; match.destroyed = s.d; match.towersLost = s.tl;
  if (Math.abs(match.time - s.tm) > 0.5) match.time = s.tm; else match.time += (s.tm - match.time) * 0.2;

  for (const e of s.e ?? []) if (e[0] === 'k' && match.heroes[e[1]]) match.heroes[e[1]].killer = match.heroes[e[2]] ?? null; // before the deaths below

  s.h.forEach((r, i) => {
    const h = match.heroes[i], me = h === match.hero;
    const [x, z, face, hp, maxHp, f, level, xp, points, rk, c0, c1, c2, rs, rst, gold = 0, items = []] = r;
    const alive = !!(f & 1);
    if (!me) { h.tx = x; h.tz = z; h.face = face; }
    if (alive && !h.alive) { // respawn
      h.spawn();
      h.dying = 0;
    } else if (!alive && h.alive) { // down: the killer came ahead in the events
      h.alive = false; h.hp = 0; h.dying = DYING;
      bus.emit('down', h);
    }
    if (alive && me) reconcile(h, x, z);
    if (alive && !me && h.tx !== undefined && Math.hypot(h.tx - h.x, h.tz - h.z) > 12) { h.x = h.px = h.tx; h.z = h.pz = h.tz; }
    if (level > h.level) bus.emit('levelUp', h);
    const spent = me && performance.now() - (match.lastSpend ?? 0) < 700;
    const ranks = [rk & 7, (rk >> 3) & 7, (rk >> 6) & 7];
    if (level !== h.level || (!spent && ranks.some((v, j) => v !== h.ranks[j]))) {
      h.level = level;
      if (!spent) h.ranks = ranks;
      h.recalc(false);
    }
    if (!spent) h.points = points;
    h.xp = xp;
    if (hp < h.hp && alive) { h.flash = 0.08; h.squash = 1; }
    h.hp = alive ? hp : 0; h.maxHp = maxHp;
    h.brushHidden = !!(f & 2);
    h.burnVis = !!(f & 16);
    if (!me) {
      h.hidden = !!(f & 2);
      if (f & 4 && !(h.stun > 0)) h.stun = 0.3;
      if (f & 8) { h.shieldHp = 1; h.shieldT = 0.5; } else h.shieldT = 0;
      h.cds[0] = c0; h.cds[1] = c1; h.cds[2] = c2;
    }
    h.respawn = rs; h.respawnTotal = rst || 1;
    if (gold > h.gold + 0.5 && me) bus.emit('gold', { hero: h, amount: Math.round(gold - h.gold) });
    h.gold = gold;
    const ids = items.map((i) => ITEM_IDS[i]);
    if (ids.join() !== h.items.join()) { h.items = ids; h.recalc(false); if (me && ids.length > 0) bus.emit('buy', h); }
  });

  s.s.forEach(([hp, f], i) => {
    const st = match.structures[i];
    if (hp < st.hp && st.alive) { st.flash = 0.08; st.squash = 1; }
    st.hp = hp;
    st.vulnerable = !!(f & 2); st.shielded = !!(f & 4);
    if (st.type === 'core') st.pulseT = f & 8 ? 0.5 : 0;
    if (!(f & 1) && st.alive) { st.alive = false; st.hp = 0; st.dying = DYING; bus.emit('down', st); }
  });

  match.minions.netApply(s.m);
  match.camps.netApply(s.c);
  if (s.bf) applyBuffs(match, s.bf);

  if (s.e) applyEvents(match, s.e);
  if (s.ov && !match.over) { match.time = s.tm; match._end(!!s.w, s.rr); }
}

// Guest: team buffs from the host; a new Dragon / Titan / Herald buff announces who took the objective.
function applyBuffs(match, bf) {
  bf.forEach(([fire, ice, gale, dt, tt, ht], team) => {
    const b = match.buffs[team];
    const el = fire > b.fire ? 'fire' : ice > b.ice ? 'ice' : gale > b.gale ? 'gale' : null;
    if (el) bus.emit('bossTaken', { kind: 'dragon', team, variant: ['fire', 'ice', 'gale'].indexOf(el) });
    if (tt > b.titanT + 5) bus.emit('bossTaken', { kind: 'titan', team, variant: 0 });
    if (ht > b.heraldT + 5) bus.emit('bossTaken', { kind: 'herald', team, variant: 0 });
    Object.assign(b, { fire, ice, gale, dragonT: dt, titanT: tt, heraldT: ht });
  });
  match._bonus();
}

export function applyEvents(match, events) {
  for (const e of events) {
    switch (e[0]) {
      case 'c': { // cast
        const h = match.heroes[e[1]];
        if (!h || h === match.hero) break;
        h.lunge = 1;
        vfx.ring(h.x, 0.2, h.z, e[2] === 2 ? PAL.gold : h.def.accent, e[2] === 2 ? 5 : 3, 0.35);
        bus.emit('cast', { hero: h, slot: e[2] });
        break;
      }
      case 's': { // summoner spell: the burst only (the host already moved / shielded / burned them)
        const h = match.heroes[e[1]];
        if (!h || h === match.hero || !(e[2] in SPELLS)) break;
        spellFx(h, e[2], match.heroes[e[3]] ?? null);
        break;
      }
      case 'w': { // basic swing
        const h = match.heroes[e[1]];
        if (!h || h === match.hero) break;
        h.lunge = 1;
        bus.emit('swing', h);
        break;
      }
      case 'p': { // shot: purely visual here, damage already happened on the host
        const src = find(match, e[1]), tgt = find(match, e[2]);
        if (!src || !tgt || src === match.hero) break;
        match.projectiles.fire(src, tgt, 0, e[3], e[4], e[5]);
        break;
      }
      case 'k': { // takedown (hero deaths are applied from the state rows)
        const v = match.heroes[e[1]], k = match.heroes[e[2]];
        if (v && k) { bus.emit('takedown', { killer: k, victim: v }); }
        break;
      }
    }
  }
}
