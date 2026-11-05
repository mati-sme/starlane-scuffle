// Corner minimap: static layer (lanes, bases, jungle, cover, brush) drawn once; dynamic layer at 10 Hz.
// Enemies only show while one of our heroes / structures / minions can see them and they are not hidden in brush.
import { ARENA, MAP, TEAM, PAL, BOSS } from '../config.js';
import { BOSS_COLORS } from '../world/camps.js';
import { COVER, BRUSH, POCKETS, fountain } from '../world/arena.js';

const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const SIGHT = { hero: 24, tower: 22, minion: 14 };
const W = MAP.halfX * 2, H = MAP.halfZ * 2;

export class Minimap {
  constructor(canvas, match) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.match = match;
    this.acc = 1;
    this.layer = document.createElement('canvas');
    this.resize();
  }

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2), w = this.cv.clientWidth || 168, h = this.cv.clientHeight || 104;
    this.cv.width = this.layer.width = Math.round(w * dpr);
    this.cv.height = this.layer.height = Math.round(h * dpr);
    this.sx = this.cv.width / W; this.sz = this.cv.height / H;
    this._paintStatic();
    this.acc = 1;
  }

  px(x) { return (x + MAP.halfX) * this.sx; }
  pz(z) { return (z + MAP.halfZ) * this.sz; }

  _paintStatic() {
    const c = this.layer.getContext('2d'), { sx, sz } = this;
    c.fillStyle = '#16243f'; c.fillRect(0, 0, this.layer.width, this.layer.height);
    c.fillStyle = 'rgba(62,150,90,.28)';
    for (const b of POCKETS) c.fillRect(this.px(b.x0), this.pz(b.z0), b.w * sx, b.d * sz);
    for (const team of [0, 1]) { // team-tinted bases
      const f = fountain(team);
      c.fillStyle = team ? 'rgba(255,77,94,.28)' : 'rgba(61,165,255,.28)';
      c.beginPath(); c.ellipse(this.px(f.x + (team ? -6 : 6)), this.pz(0), 15 * sx, 15 * sz, 0, 0, 7); c.fill();
    }
    c.lineCap = c.lineJoin = 'round';
    c.strokeStyle = '#7a8aa0'; c.lineWidth = Math.max(3, 7 * sz);
    for (const lane of ARENA.lanes) {
      c.beginPath();
      lane.forEach(([x, z], i) => (i ? c.lineTo(this.px(x), this.pz(z)) : c.moveTo(this.px(x), this.pz(z))));
      c.stroke();
    }
    c.fillStyle = 'rgba(40,150,60,.8)';
    for (const b of BRUSH) c.fillRect(this.px(b.x0), this.pz(b.z0), b.w * sx, b.d * sz);
    c.fillStyle = '#c4ccdb';
    for (const b of COVER) c.fillRect(this.px(b.x0), this.pz(b.z0), Math.max(1.5, b.w * sx), Math.max(1.5, b.d * sz));
  }

  // Can `team` see e? (not in brush; within sight of an ally hero / tower / minion)
  _seen(e, team) {
    if (e.team === team) return true;
    if (e.hidden) return false;
    const m = this.match;
    for (const h of m.heroes) if (h.team === team && h.alive && Math.hypot(h.x - e.x, h.z - e.z) < SIGHT.hero) return true;
    for (const t of m.structures) if (t.team === team && t.alive && Math.hypot(t.x - e.x, t.z - e.z) < SIGHT.tower) return true;
    if (e.type === 'hero') for (const u of m.minions.list) if (u.team === team && u.alive && Math.hypot(u.x - e.x, u.z - e.z) < SIGHT.minion) return true;
    return false;
  }

  // Boss pit marker: a glowing disc while it lives, a ring with the respawn clock while it is away.
  _boss(c, b, dpr) {
    const x = this.px(b.hx), z = this.pz(b.hz), r = 6 * dpr, eta = this.match.camps.eta(b, this.match.time);
    const col = hex(BOSS_COLORS[b.boss === 'dragon' ? BOSS.elements[b.variant % 3] : b.boss]);
    if (b.done || (!b.alive && b.boss === 'herald' && eta <= 0)) return;
    c.lineWidth = 2 * dpr; c.strokeStyle = col; c.fillStyle = col;
    c.beginPath(); c.arc(x, z, r, 0, 7);
    if (b.alive) { c.globalAlpha = 0.9; c.fill(); c.globalAlpha = 1; c.strokeStyle = '#0B1020'; c.lineWidth = dpr; c.stroke(); }
    else { c.stroke(); }
    c.fillStyle = '#fff'; c.strokeStyle = '#0B1020'; c.lineWidth = 2.5 * dpr; c.font = `800 ${8 * dpr}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    const t = b.alive ? b.boss[0].toUpperCase() : `${Math.floor(eta / 60)}:${String(Math.floor(eta % 60)).padStart(2, '0')}`;
    const ty = b.alive ? z : z + (b.hz > 0 ? -r - 5 * dpr : r + 5 * dpr);
    c.strokeText(t, x, ty); c.fillText(t, x, ty);
  }

  update(dt, rig, aspect) {
    this.acc += dt;
    if (this.acc < 0.1) return;
    this.acc = 0;
    const c = this.ctx, m = this.match, { sx, sz } = this, dpr = this.cv.width / this.cv.clientWidth || 1;
    c.drawImage(this.layer, 0, 0);

    for (const camp of m.camps.list) {
      if (camp.boss) { this._boss(c, camp, dpr); continue; }
      if (!camp.alive) continue;
      c.fillStyle = '#FFB020';
      c.fillRect(this.px(camp.x) - 2 * dpr, this.pz(camp.z) - 2 * dpr, 4 * dpr, 4 * dpr);
    }
    for (const s of m.structures) {
      if (!s.alive) continue;
      const x = this.px(s.x), z = this.pz(s.z), r = (s.type === 'core' ? 4.5 : s.tier === 'guard' ? 3.5 : 3) * dpr;
      c.fillStyle = hex(TEAM[s.team].main);
      c.strokeStyle = '#0B1020'; c.lineWidth = dpr;
      c.beginPath();
      if (s.type === 'core') { c.moveTo(x, z - r); c.lineTo(x + r, z); c.lineTo(x, z + r); c.lineTo(x - r, z); c.closePath(); } else c.rect(x - r, z - r, r * 2, r * 2);
      c.fill(); c.stroke();
    }
    for (const u of m.minions.list) {
      if (!u.alive || !this._seen(u, m.myTeam)) continue;
      c.fillStyle = hex(TEAM[u.team].main);
      c.fillRect(this.px(u.x) - dpr, this.pz(u.z) - dpr, 2 * dpr, 2 * dpr);
    }
    for (const h of m.heroes) {
      if (!h.alive || h === m.hero || !this._seen(h, m.myTeam)) continue;
      c.fillStyle = hex(TEAM[h.team].main);
      c.strokeStyle = '#0B1020'; c.lineWidth = dpr;
      c.beginPath(); c.arc(this.px(h.x), this.pz(h.z), 3.2 * dpr, 0, 7); c.fill(); c.stroke();
    }
    const me = m.hero;
    if (me.alive) { // player: gold with a facing tick
      const x = this.px(me.x), z = this.pz(me.z);
      c.fillStyle = hex(PAL.gold); c.strokeStyle = '#0B1020'; c.lineWidth = dpr;
      c.beginPath(); c.arc(x, z, 4.2 * dpr, 0, 7); c.fill(); c.stroke();
      c.strokeStyle = hex(PAL.gold); c.lineWidth = 1.5 * dpr;
      c.beginPath(); c.moveTo(x, z); c.lineTo(x + Math.sin(me.face) * 8 * dpr, z + Math.cos(me.face) * 8 * dpr); c.stroke();
    }
    // camera footprint
    const dist = 26.2 * rig.zoom, vh = 2 * dist * Math.tan(0.332), w = vh * aspect, d = vh / 0.77;
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = dpr;
    c.strokeRect(this.px(rig.focus.x - w / 2), this.pz(rig.focus.z - d / 2), w * sx, d * sz);
  }
}
