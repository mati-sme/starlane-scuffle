// Season event UI: banner + countdown, a light 2D weather layer (snow / heat shimmer / rain + lightning / petals), and the buff icon on hero bars.
import { SEASONS } from '../game/seasons.js';
import { bus } from '../core/bus.js';

const N = { snow: 90, heat: 0, storm: 140, bloom: 40 };

export class SeasonUI {
  constructor(root, match) {
    this.match = match;
    this.id = null;
    this.banner = document.createElement('div');
    this.banner.className = 'season';
    this.banner.dataset.testid = 'season-banner';
    this.banner.innerHTML = '<b class="sn"></b><span class="sl"></span><em class="st"></em>';
    root.appendChild(this.banner);
    this.nameEl = this.banner.querySelector('.sn');
    this.lineEl = this.banner.querySelector('.sl');
    this.timeEl = this.banner.querySelector('.st');
    this.cv = document.createElement('canvas');
    this.cv.className = 'seasonfx';
    this.cv.dataset.testid = 'season-fx';
    root.insertBefore(this.cv, root.firstChild);
    this.ctx = this.cv.getContext('2d');
    this.p = [];
    this.flash = 0;
    this.nextBolt = 0;
    this.sec = -1;
    bus.on('season', () => this._set());
  }

  _set() {
    const id = this.match.seasons.id;
    if (id === this.id) return;
    this.id = id;
    this.p.length = 0;
    this.sec = -1;
    this.banner.classList.toggle('on', !!id);
    this.cv.classList.toggle('on', !!id);
    if (!id) { this.ctx.clearRect(0, 0, this.cv.width, this.cv.height); return; }
    const s = SEASONS[id];
    this.banner.style.setProperty('--sc', s.color);
    this.banner.dataset.season = id;
    this.nameEl.textContent = `${s.name} season!`;
    this.lineEl.textContent = s.line;
    this.banner.classList.remove('pop'); void this.banner.offsetWidth; this.banner.classList.add('pop');
  }

  update(dt) {
    const se = this.match.seasons;
    if (se.id !== this.id) this._set(); // covers a match restart or a guest that missed the event
    if (!this.id) return;
    const t = Math.ceil(se.left);
    if (t !== this.sec) { this.sec = t; this.timeEl.textContent = `${t}s`; }
    this._draw(dt);
  }

  _draw(dt) {
    const cv = this.cv, w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    if (cv.width !== w) cv.width = w;
    if (cv.height !== h) cv.height = h;
    const c = this.ctx, id = this.id;
    c.clearRect(0, 0, w, h);
    const want = N[id];
    while (this.p.length < want) this.p.push({ x: Math.random() * w, y: Math.random() * h, r: Math.random(), v: Math.random() });
    for (const q of this.p) {
      if (id === 'snow') {
        q.y += (30 + q.v * 50) * dt; q.x += Math.sin(q.y * 0.02 + q.r * 6) * 14 * dt;
        c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.arc(q.x, q.y, 1.5 + q.r * 2.2, 0, 6.3); c.fill();
      } else if (id === 'storm') {
        q.y += (700 + q.v * 400) * dt; q.x -= 120 * dt;
        c.strokeStyle = 'rgba(170,200,255,.55)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(q.x + 6, q.y - 16 - q.r * 8); c.stroke();
      } else if (id === 'bloom') {
        q.y += (25 + q.v * 35) * dt; q.x += Math.sin(q.y * 0.015 + q.r * 6) * 40 * dt; q.r += dt;
        c.save(); c.translate(q.x, q.y); c.rotate(q.r * 2); c.fillStyle = q.v > 0.5 ? 'rgba(255,170,210,.85)' : 'rgba(255,215,230,.85)';
        c.beginPath(); c.ellipse(0, 0, 6, 3, 0, 0, 6.3); c.fill(); c.restore();
      }
      if (q.y > h + 20) { q.y = -20; q.x = Math.random() * w; }
      if (q.x < -20) q.x = w + 10; else if (q.x > w + 20) q.x = -10;
    }
    if (id === 'heat') { // warm wobbling bands
      this.heat = (this.heat ?? 0) + dt;
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(255,150,60,0)'); g.addColorStop(1, 'rgba(255,150,60,.16)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(255,230,190,.12)'; c.lineWidth = 5;
      for (let y = h * 0.3; y < h; y += 46) {
        c.beginPath();
        for (let x = 0; x <= w; x += 24) c.lineTo(x, y + Math.sin(x * 0.02 + this.heat * 2 + y) * 7);
        c.stroke();
      }
    }
    if (id === 'storm') {
      if ((this.nextBolt -= dt) <= 0) { this.flash = 1; this.nextBolt = 3 + Math.random() * 5; }
      if (this.flash > 0) { c.fillStyle = `rgba(235,242,255,${this.flash * 0.45})`; c.fillRect(0, 0, w, h); this.flash = Math.max(0, this.flash - dt * 3.5); }
    }
  }
}

// Little arrow on a hero's health bar: green up = boosted by the season, red down = weakened.
export function seasonMark(h) {
  return h.seasonState > 0 ? 'up' : h.seasonState < 0 ? 'down' : '';
}
