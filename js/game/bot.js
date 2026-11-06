// Hero AI for both teams (identical rules, only reaction time / damage scale by difficulty on Gloom):
// RETREAT > DEFEND > FIGHT > PUSH > LANE / ROAM. Decisions are re-made every `react` seconds; steering runs every sim step.
// Bots walk lane paths with their minion wave, never stand in an enemy tower's range without 2+ friendly minions
// near it, focus low-HP heroes and cast through the same skill rules the player uses.
import { TOWER, CORE, BOT, DIFFICULTY, settings, MATCH } from '../config.js';
import { nextItem, atBase } from './gear.js';
import { rand } from '../core/math.js';
import { pickTarget, bestCluster } from './targeting.js';
import { forEachAlly, forEachEnemy } from './combat.js';
import { PATHS, fountain, structSpot, laneOf } from '../world/arena.js';

const MELEE = { tank: 0, bruiser: 1, assassin: 2 };
// Where to stand relative to the minion front: > 0 is ahead of it, < 0 behind (units along the lane).
const SPACING = { tank: 1, bruiser: 0, assassin: 0, blaster: -3, shooter: -4, support: -2 };
const ROAM = 3;

// Lane plan per team (bots only; a human plays wherever they like and nobody is tied to them): top = the most durable melee,
// mid = blaster, bot = shooter + support. Anyone who does not fit (a second blaster, the other melee...) roams.
const LANE_CAP = [1, 1, 2], LANE_OF = { tank: 0, bruiser: 0, assassin: 0, blaster: 1, shooter: 2, support: 2 };
const PRIORITY = ['tank', 'bruiser', 'assassin', 'blaster', 'shooter', 'support'];
export function assignLanes(heroes) {
  for (const team of [0, 1]) {
    const used = [0, 0, 0];
    const bots = heroes.filter((h) => h.team === team && h.brain).sort((a, b) => PRIORITY.indexOf(a.def.role) - PRIORITY.indexOf(b.def.role));
    for (const h of bots) {
      const l = LANE_OF[h.def.role] ?? ROAM;
      h.brain.lane = l !== ROAM && used[l] < LANE_CAP[l] ? l : ROAM;
      if (h.brain.lane !== ROAM) used[l]++;
      h.brain.roamLane = h.brain.lane === ROAM ? 1 : h.brain.lane;
    }
  }
}

export class Bot {
  constructor(hero) {
    this.h = hero;
    this.it = { x: 0, z: 0, attack: true, cast: [false, false, false] };
    this.goal = { x: hero.x, z: hero.z, follow: null, keep: 0.5 };
    this.lane = 1;
    this.roamLane = 1;
    this.reset();
  }

  reset() {
    this.t = rand(0, 0.5);
    this.retreat = false;
    this.focus = null;
    this.state = 'lane';
    this.roamT = 0;
    this.shopping = false; this.shopAt = 0;
    this.stuckT = 0; this.nudge = 0; this.nudgeSide = 1;
    this.sx = this.h.x; this.sz = this.h.z;
    Object.assign(this.goal, { x: this.h.x, z: this.h.z, follow: null, keep: 0.4 });
  }

  // -> intent { x, z, attack, cast[3] } for Hero.update
  think(dt, ctx) {
    const it = this.it, h = this.h;
    it.cast[0] = it.cast[1] = it.cast[2] = false;
    if (!h.alive) return it;
    if (h.points > 0) this._spend();
    if ((this.t -= dt) <= 0) {
      this.t = (h.team === 1 ? DIFFICULTY.react[settings.stars - 1] : DIFFICULTY.allyReact) * rand(0.8, 1.2);
      this._decide(ctx);
    }
    this._steer(dt, ctx);
    return it;
  }

  // Same rules as the player: R first when it is open, otherwise whichever of Q / E has fewer ranks.
  _spend() {
    const h = this.h, order = h.ranks[0] <= h.ranks[1] ? [2, 0, 1] : [2, 1, 0];
    for (const s of order) if (h.spendPoint(s)) return;
  }

  // The hostile tower whose range covers (x, z) without 2+ friendly minions beside it, if any.
  _unsafe(ctx, x, z) {
    const h = this.h;
    for (const s of ctx.structures) {
      if (s.team === h.team || !s.alive) continue;
      if (Math.hypot(s.x - x, s.z - z) > (s.type === 'core' ? CORE.range : TOWER.range) + 0.8) continue;
      let near = 0;
      for (const m of ctx.minions.list) if (m.team === h.team && m.alive && Math.hypot(m.x - s.x, m.z - s.z) < 7) near++;
      if (near < (s.type === 'core' ? 1 : 2)) return s;
    }
    return null;
  }

  // Best visible enemy hero inside aggro range: low HP, already hitting heroes, focused by allies, assassin prey.
  _foe(ctx) {
    const h = this.h, role = h.def.role;
    let best = null, bs = -Infinity;
    for (const e of ctx.heroes) {
      if (e.team === h.team || !e.alive || e.hidden || e.untarget) continue;
      const d = Math.hypot(e.x - h.x, e.z - h.z) - e.radius;
      if (d > BOT.aggro) continue;
      let sc = 60 * (1 - e.hp / e.maxHp) - d * 2;
      if (e.aggroAge < 2) sc += 30;
      if (role === 'assassin' && (e.def.role === 'blaster' || e.def.role === 'shooter' || e.def.role === 'support')) sc += 40;
      for (const a of ctx.heroes) if (a !== h && a.team === h.team && a.brain?.focus === e) { sc += 15; break; }
      if (sc > bs) { best = e; bs = sc; }
    }
    return best;
  }

  // HP-weighted local power: allies (incl. self) vs visible enemies within 10 u of the foe.
  _power(ctx, foe) {
    const h = this.h;
    let a = 0, e = 0;
    for (const o of ctx.heroes) {
      if (!o.alive || Math.hypot(o.x - foe.x, o.z - foe.z) > 10) continue;
      if (o.team === h.team) a += o.hp; else if (!o.hidden) e += o.hp;
    }
    return a / Math.max(1, e);
  }

  // Walk the lane path home: nearest waypoint first, then the one before it, finally the fountain.
  _homeward() {
    const h = this.h, fo = fountain(h.team), pts = PATHS[h.team][this.lane === ROAM ? laneOf(h.z) : this.lane].pts;
    if (Math.hypot(fo.x - h.x, fo.z - h.z) < 14) return fo;
    let bi = 0, bd = Infinity;
    for (let i = 0; i < pts.length - 1; i++) {
      const d = Math.hypot(pts[i].x - h.x, pts[i].z - h.z);
      if (d < bd) { bd = d; bi = i; }
    }
    if (bi === 0) return fo;
    return bd < 4 ? pts[bi - 1] : pts[bi];
  }

  // Lane front: just behind (or ahead of, for tanks) our furthest minion on the lane; with no wave, just behind our furthest-out standing tower of that lane.
  _laneGoal(ctx, lane, g) {
    const h = this.h, off = SPACING[h.def.role] ?? 0;
    let front = null;
    for (const m of ctx.minions.list) {
      if (m.team === h.team && m.alive && m.lane === lane && m.dying <= 0 && (!front || m.prog > front.prog)) front = m;
    }
    if (front) {
      const p = PATHS[h.team][lane].pts[Math.max(0, front.wp - 1)];
      const dx = p.x - front.x, dz = p.z - front.z, d = Math.hypot(dx, dz) || 1;
      g.x = front.x - (dx / d) * off; g.z = front.z - (dz / d) * off;
    } else {
      const tw = ctx.towers.find((t) => t.team === h.team && t.lane === lane && t.alive), fo = fountain(h.team);
      const t = tw ?? structSpot(h.team, 'inhib', lane); // outer, then inner, then inhib (towers are listed outer-first); all down: hold at the inhib spot
      const dx = fo.x - t.x, dz = fo.z - t.z, d = Math.hypot(dx, dz) || 1;
      g.x = t.x + (dx / d) * 3; g.z = t.z + (dz / d) * 3;
    }
    g.keep = 0.6;
  }

  // Roamer: our own camps first (from their spawn time), otherwise the lane with the biggest hero deficit (re-checked every 10 s).
  _roam(ctx, g) {
    const h = this.h;
    if (ctx.time >= MATCH.campFirst && h.hp > h.maxHp * 0.5) {
      let best = null, bd = Infinity;
      for (const c of ctx.camps.list) {
        if (!c.alive || c.boss || (c.hx > 0) === (h.team === 0)) continue; // own side only
        const d = Math.hypot(c.x - h.x, c.z - h.z);
        if (d < bd) { best = c; bd = d; }
      }
      if (best) { g.follow = best; g.keep = h.basicRange * 0.7; this.state = 'camp'; return best; }
    }
    if (ctx.time >= this.roamT) {
      this.roamT = ctx.time + 10;
      const bal = [0, 0, 0];
      for (const o of ctx.heroes) if (o.alive) bal[laneOf(o.z)] += o.team === h.team ? -1 : 1;
      let bl = this.roamLane;
      for (let i = 0; i < 3; i++) if (bal[i] > bal[bl]) bl = i;
      this.roamLane = bl;
    }
    this._laneGoal(ctx, this.roamLane, g);
    return null;
  }

  _decide(ctx) {
    const h = this.h, g = this.goal, it = this.it, frac = h.hp / h.maxHp;
    g.follow = null;
    this.focus = null;

    let foe = this._foe(ctx), crowd = 0;
    if (foe) for (const e of ctx.heroes) if (e.team !== h.team && e.alive && !e.hidden && Math.hypot(e.x - h.x, e.z - h.z) < 8) crowd++;
    if (!this.retreat && (frac < BOT.retreatHp || (frac < 0.5 && crowd >= 2))) this.retreat = true;
    else if (!this.retreat && !foe && this._wantsShop(ctx)) { this.retreat = true; this.shopping = true; } // enough gold: walk home and buy
    else if (this.retreat && (this.shopping ? atBase(h) && frac >= 0.6 : frac >= BOT.returnHp)) { this.retreat = false; this.shopping = false; this.shopAt = ctx.time + 40; }

    if (this.retreat) {
      const p = this._homeward();
      g.x = p.x; g.z = p.z; g.keep = 0.4;
      this.state = 'retreat';
      if (foe && Math.hypot(foe.x - h.x, foe.z - h.z) < 5) { // escape-capable skill when someone is on our heels
        for (let i = 1; i >= 0; i--) if (h.ranks[i] > 0 && h.cds[i] <= 0 && h.rs[i].kind !== 'nova') { it.cast[i] = true; break; }
      }
      return;
    }

    if (foe && this._unsafe(ctx, foe.x, foe.z)) foe = null; // never dive a tower for a hero

    let hurt = null; // DEFEND: an own structure was hit lately and we are close
    for (const s of ctx.structures) {
      if (s.team === h.team && s.alive && ctx.time - s.hurtAt < 3 && Math.hypot(s.x - h.x, s.z - h.z) < 35) { hurt = s; break; }
    }

    const ratio = foe ? this._power(ctx, foe) : 0;
    const boss = foe ? null : this._boss(ctx);
    let skillFoe = foe;
    if (foe && ratio >= BOT.powerRatio) { // FIGHT
      this.state = 'fight';
      this.focus = foe;
      g.follow = foe;
      g.keep = h.basicRange * (h.basic.range >= 6 ? 0.8 : 0.7);
    } else if (hurt) { // DEFEND
      this.state = 'defend';
      let ne = null, nd = 14;
      for (const e of ctx.heroes) {
        const d = Math.hypot(e.x - hurt.x, e.z - hurt.z);
        if (e.team !== h.team && e.alive && !e.hidden && d < nd && !this._unsafe(ctx, e.x, e.z)) { ne = e; nd = d; }
      }
      if (ne) { g.follow = ne; g.keep = h.basicRange * 0.7; skillFoe = ne; } else { g.x = hurt.x; g.z = hurt.z; g.keep = 4; }
    } else if (boss) { // OBJECTIVE: contest a Dragon / Herald / Titan with the closest few allies
      this.state = 'boss';
      g.follow = boss;
      g.keep = h.basicRange * 0.7;
      skillFoe = boss;
    } else {
      const push = foe ? null : this._pushTarget(ctx);
      if (push) { // PUSH
        this.state = 'push';
        g.follow = push;
        g.keep = h.basicRange * 0.75;
      } else { // LANE / ROAM
        this.state = 'lane';
        const grp = this._group(ctx);
        if (grp !== null) this._laneGoal(ctx, grp, g);
        else if (this.lane === ROAM) skillFoe = this._roam(ctx, g) ?? foe;
        else this._laneGoal(ctx, this.lane, g);
        if (!g.follow && !foe && (this.lane !== ROAM || grp !== null)) {
          const m = pickTarget(ctx, h.team, h.x, h.z, h.basicRange + 2, ['minions']);
          if (m) { g.follow = m; g.keep = h.basicRange * 0.8; }
        }
      }
    }

    for (let i = 0; i < 3; i++) if (h.ranks[i] > 0 && h.cds[i] <= 0 && !it.cast[i] && this._want(ctx, i, skillFoe)) it.cast[i] = true;
  }

  // The next item is affordable and the bot has not shopped lately.
  _wantsShop(ctx) {
    const h = this.h, it = nextItem(h);
    return !!it && h.gold >= it.cost && ctx.time >= this.shopAt && !atBase(h);
  }

  // A live boss this bot should take: the 3 closest eligible bots of its team go (healthy, high enough level, no stronger enemy squad at the pit).
  _boss(ctx) {
    const h = this.h, c = (ctx._bossCall ??= [{ t: -9, set: [], boss: null }, { t: -9, set: [], boss: null }])[h.team];
    if (ctx.time < c.t || ctx.time - c.t >= 1) {
      c.t = ctx.time; c.set = []; c.boss = null;
      let best = null, bs = Infinity;
      for (const b of ctx.camps.bosses) {
        if (!b.alive) continue;
        let foes = 0;
        for (const e of ctx.heroes) if (e.team !== h.team && e.alive && !e.hidden && Math.hypot(e.x - b.x, e.z - b.z) < 14) foes++;
        const cands = ctx.heroes.filter((o) => o.team === h.team && o.brain && o.alive && o.hp > o.maxHp * 0.6 && o.level >= b.cfg.minLevel && !o.brain.retreat)
          .sort((p, q) => Math.hypot(p.x - b.x, p.z - b.z) - Math.hypot(q.x - b.x, q.z - b.z)).slice(0, 3);
        if (cands.length < 2 || foes > cands.length) continue;
        const d = Math.hypot(cands[0].x - b.x, cands[0].z - b.z);
        if (d < bs) { bs = d; best = b; c.set = cands; }
      }
      c.boss = best;
    }
    return c.boss && c.set.includes(h) ? c.boss : null;
  }

  // Group push: with the numbers advantage (enemy heroes dead) or in Overdrive, every bot walks the lane where our wave is furthest along.
  _group(ctx) {
    const h = this.h, c = (ctx._grp ??= [{ t: -9, lane: null }, { t: -9, lane: null }])[h.team];
    if (h.def.role === 'support') return null; // supports keep their own lane
    if (ctx.time >= c.t && ctx.time - c.t < 2) return c.lane; // time < c.t: stale cache from the previous match
    c.t = ctx.time;
    let ally = 0, foe = 0;
    for (const o of ctx.heroes) if (o.alive || o.respawn < 4) { if (o.team === h.team) ally++; else foe++; }
    c.lane = null;
    if (!ctx.storm && ally - foe < BOT.groupDeficit) return null;
    const best = [0, 0, 0];
    for (const m of ctx.minions.list) {
      if (m.team !== h.team || !m.alive) continue;
      const path = PATHS[h.team][m.lane], p = m.prog / path.cum[path.cum.length - 1];
      if (p > best[m.lane]) best[m.lane] = p;
    }
    let bl = -1, bp = 0.15;
    for (let i = 0; i < 3; i++) if (best[i] > bp) { bp = best[i]; bl = i; }
    if (bl >= 0) c.lane = bl;
    return c.lane;
  }

  // A vulnerable enemy structure with 2+ of our minions beside it and no enemy hero close by.
  _pushTarget(ctx) {
    const h = this.h;
    let best = null, bd = 55;
    for (const s of ctx.structures) {
      if (s.team === h.team || !s.alive || !s.vulnerable) continue;
      const d = Math.hypot(s.x - h.x, s.z - h.z);
      if (d >= bd) continue;
      let near = 0;
      for (const m of ctx.minions.list) if (m.team === h.team && m.alive && Math.hypot(m.x - s.x, m.z - s.z) < 7) near++;
      if (near < (s.type === 'core' ? 1 : 2)) continue;
      let guarded = false;
      for (const e of ctx.heroes) if (e.team !== h.team && e.alive && !e.hidden && Math.hypot(e.x - s.x, e.z - s.z) < 7) { guarded = true; break; }
      if (!guarded) { best = s; bd = d; }
    }
    return best;
  }

  // Per-kind rule of thumb for when a skill is worth casting.
  _want(ctx, i, foe, as = null) {
    const h = this.h, ab = as ?? h.rs[i], ult = i === 2, near = (e, r) => e && Math.hypot(e.x - h.x, e.z - h.z) - e.radius <= r;
    const cluster = (r, rad) => {
      const c = bestCluster(ctx, h.team, h.x, h.z, r, rad);
      return c && (c.hero || c.n >= (ult ? 3 : 2)) ? c : null;
    };
    const hurt = [];
    forEachAlly(ctx, h.team, h.x, h.z, ab.allyR ?? ab.range ?? 6, (a) => { if (a.hp < a.maxHp * 0.65) hurt.push(a); });
    switch (ab.kind) {
      case 'dash': case 'leap': case 'blink':
        if (ab.aim === 'move') return !!foe && near(foe, 6) && h.hp < h.maxHp * 0.6;
        if (ab.chain) return near(foe, ab.range);
        if (ab.trail) return near(foe, ab.range - 2) && ult;
        return near(foe, ab.range - 1) && (!ab.radius || Math.hypot(foe.x - h.x, foe.z - h.z) > 2);
      case 'missile': case 'grapple': return near(foe, ab.range - 1) && (ab.kind !== 'grapple' || Math.hypot(foe.x - h.x, foe.z - h.z) > 3);
      case 'swap': return ab.ally ? hurt.some((a) => a !== h) && !!foe : near(foe, ab.range - 1);
      case 'rewind': return h.hp < h.maxHp * 0.55 && near(foe, 8);
      case 'whirl': return near(foe, ab.r + 1);
      case 'totem': return near(foe, ab.mode === 'heal' ? 10 : 8) && (ab.mode !== 'heal' || hurt.length > 0) && !ctx.zones.turrets.some((t) => t.src === h && t.t < t.dur - 2);
      case 'trap': return near(foe, ab.range);
      case 'quake': return ab.rings ? near(foe, ab.rings * ab.step - 1) : near(foe, 2 + ab.count * ab.gap - 1);
      case 'boomerang': case 'mark': case 'ricochet': return near(foe, (ab.range ?? 8) - 1);
      case 'orbit': return near(foe, ab.r + 2);
      case 'vortex': return !!cluster(ab.range, ab.radius);
      case 'detonate': {
        let any = false;
        forEachEnemy(ctx, h.team, h.x, h.z, ab.range, (e) => { if (e.mark?.src === h) any = true; });
        return any;
      }
      case 'tether': return hurt.some((a) => a !== h);
      case 'decoy': return near(foe, 5);
      case 'bolt': case 'hook': case 'beam':
        return near(foe, ab.range - 0.5);
      case 'nova': return near(foe, ab.radius) || !!cluster(ab.radius, ab.radius);
      case 'cone': return near(foe, ab.range - 0.5) || !!cluster(ab.range, 2.5);
      case 'blast':
        if (ab.target === 'lowhero') return near(foe, ab.range);
        return !!cluster(ab.range, ab.radius);
      case 'rain': return !!cluster(ab.range, ab.radius * 0.6);
      case 'buff':
        if (ab.hide) return near(foe, 8);
        if (ab.heal || ab.allyHeal) return hurt.length > 0 && !!foe;
        return near(foe, 6.5);
      case 'field':
        if (ab.wall) return near(foe, 7);
        if (ab.healPs) return hurt.length > 0 && !!foe;
        return near(foe, ab.r + 1);
      case 'turret': return near(foe, 9) && !ctx.zones.turrets.some((t) => t.src === h && t.t < t.dur - 2);
      default: return ab.botAs ? this._want(ctx, i, foe, { ...ab, ...ab.botAs, botAs: null }) : false; // new verbs borrow a rule
    }
  }

  _steer(dt, ctx) {
    const h = this.h, g = this.goal, it = this.it;
    const tx = g.follow ? g.follow.x : g.x, tz = g.follow ? g.follow.z : g.z;
    const dx = tx - h.x, dz = tz - h.z, d = Math.hypot(dx, dz);
    const keep = g.follow ? g.keep + g.follow.radius : 0.6;
    if (d > keep) { it.x = dx / d; it.z = dz / d; }
    else if (g.follow && h.basic.range >= 6 && d < keep * 0.5) { it.x = -dx / d; it.z = -dz / d; } // ranged heroes back off
    else it.x = it.z = 0;

    // Never walk into an enemy tower's range without friendly minions beside it.
    if (it.x || it.z) {
      const s = this._unsafe(ctx, h.x + it.x * 1.5, h.z + it.z * 1.5);
      if (s) {
        const ax = h.x - s.x, az = h.z - s.z, ad = Math.hypot(ax, az) || 1;
        it.x = ax / ad; it.z = az / ad;
      }
    }

    // Stuck behind cover: sidestep for a moment.
    this.stuckT += dt;
    if (this.stuckT >= 1.5) {
      this.stuckT = 0;
      if ((it.x || it.z) && d > 4 && Math.hypot(h.x - this.sx, h.z - this.sz) < 0.6) { this.nudge = 0.7; this.nudgeSide = Math.random() < 0.5 ? -1 : 1; }
      this.sx = h.x; this.sz = h.z;
    }
    if (this.nudge > 0) {
      this.nudge -= dt;
      const a = 1.2 * this.nudgeSide, c = Math.cos(a), s = Math.sin(a), x = it.x;
      it.x = x * c - it.z * s;
      it.z = x * s + it.z * c;
    }
  }
}
