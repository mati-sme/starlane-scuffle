// Simple hero AI: push behind the minion wave, fight nearby heroes / minions, retreat to the fountain when low.
// Decisions are re-made every DIFFICULTY.react seconds; steering toward the current goal runs every sim step.
import { MAP, TOWER, BOT, DIFFICULTY, settings, TEAM, sideX } from '../config.js';
import { rand } from '../core/math.js';
import { pickTarget, bestCluster } from './targeting.js';
import { forEachAlly } from './combat.js';

const nearestHero = (ctx, h, range) => pickTarget(ctx, h.team, h.x, h.z, range, ['heroes']);

export class Bot {
  constructor(hero) {
    this.h = hero;
    this.it = { x: 0, z: 0, attack: true, cast: [false, false, false] };
    this.goal = { x: hero.x, z: hero.z, follow: null, keep: 0.5 };
    this.reset();
  }

  reset() {
    this.t = rand(0, 0.5);
    this.retreat = false;
    Object.assign(this.goal, { x: this.h.x, z: this.h.z, follow: null, keep: 0.4 });
  }

  // -> intent { x, z, attack, cast[3] } for Hero.update
  think(dt, ctx) {
    const it = this.it;
    it.cast[0] = it.cast[1] = it.cast[2] = false;
    if (this.h.points > 0) this._spend();
    if ((this.t -= dt) <= 0) {
      this.t = DIFFICULTY.react[settings.stars - 1] * rand(0.8, 1.2);
      this._decide(ctx);
    }
    this._steer();
    return it;
  }

  // Same rules as the player: R first when it is open, otherwise whichever of Q / E has fewer ranks.
  _spend() {
    const h = this.h, order = h.ranks[0] <= h.ranks[1] ? [2, 0, 1] : [2, 1, 0];
    for (const s of order) if (h.spendPoint(s)) return;
  }

  // Furthest progress (in march direction) we may stand at: an enemy tower with no friendly minions near it
  // is off limits inside its range.
  _limit(ctx, dir) {
    const h = this.h;
    for (const s of ctx.towers) {
      if (s.team === h.team || !s.alive) continue;
      let near = 0;
      for (const m of ctx.minions.list) if (m.team === h.team && m.alive && Math.abs(m.x - s.x) < 7) near++;
      if (near < 2) return dir * (s.x - dir * (TOWER.range + 1.2));
    }
    return Infinity;
  }

  _decide(ctx) {
    const h = this.h, g = this.goal, it = this.it, dir = TEAM[h.team].dir, frac = h.hp / h.maxHp;
    if (!this.retreat && frac < BOT.retreatHp) this.retreat = true;
    else if (this.retreat && frac >= BOT.returnHp) this.retreat = false;

    const foe = nearestHero(ctx, h, BOT.aggro);
    g.follow = null;

    if (this.retreat) { // home fountain heals; use the defensive skill if someone is on our heels
      g.x = sideX(h.team, MAP.heroX); g.z = (h.slot ? 1 : -1) * 1.4; g.keep = 0.4;
      if (foe && Math.hypot(foe.x - h.x, foe.z - h.z) < 4 && h.cds[1] <= 0) it.cast[1] = true;
      return;
    }

    const limit = this._limit(ctx, dir);
    const minion = pickTarget(ctx, h.team, h.x, h.z, h.basicRange + 3, ['minions']);
    const tgt = foe ?? minion;
    if (tgt && dir * tgt.x <= limit + 0.5) {
      g.follow = tgt;
      g.keep = h.basic.range >= 6 ? h.basicRange * 0.8 : h.basicRange * 0.7;
    } else {
      let front = -MAP.towerX[0]; // wait at our outer tower until a wave marches
      for (const m of ctx.minions.list) if (m.team === h.team && m.alive) front = Math.max(front, dir * m.x);
      g.x = dir * Math.min(front - 0.5, limit);
      g.z = (h.slot ? 1 : -1) * 1.5;
      g.keep = 0.4;
    }

    for (let i = 0; i < 3; i++) if (h.ranks[i] > 0 && h.cds[i] <= 0 && !it.cast[i] && this._want(ctx, i, foe)) it.cast[i] = true;
  }

  // Per-kind rule of thumb for when a skill is worth casting.
  _want(ctx, i, foe) {
    const h = this.h, ab = h.rs[i], ult = i === 2, near = (e, r) => e && Math.hypot(e.x - h.x, e.z - h.z) - e.radius <= r;
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
      default: return false;
    }
  }

  _steer() {
    const h = this.h, g = this.goal, it = this.it;
    const tx = g.follow ? g.follow.x : g.x, tz = g.follow ? g.follow.z : g.z;
    const dx = tx - h.x, dz = tz - h.z, d = Math.hypot(dx, dz);
    const keep = g.follow ? g.keep + g.follow.radius : 0.4;
    if (d > keep) { it.x = dx / d; it.z = dz / d; }
    else if (g.follow && h.basic.range >= 6 && d < keep * 0.5) { it.x = -dx / d; it.z = -dz / d; } // ranged heroes back off
    else it.x = it.z = 0;
  }
}
