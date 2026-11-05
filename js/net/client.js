// WebSocket client for one room: auto-reconnect with exponential backoff, resume token in localStorage,
// ping/pong liveness, plus the small helpers the guest uses for prediction / smoothing.
import { NET } from '../config.js';
import { T } from './protocol.js';

const key = (code) => `starlane.room.${code}`;
const PING_MS = 4000, DEAD_MS = 11000;

export class NetClient {
  constructor() {
    this.ws = null;
    this.code = '';
    this.slot = -1;
    this.status = 'idle'; // idle | connecting | open | reconnecting
    this.rtt = 0;
    this.handlers = new Map();
    this.tries = 0;
    this._hello = null;
    this._timers = {};
    this._wantOpen = false;
  }

  on(type, fn) { this.handlers.set(type, fn); return this; }
  _emit(type, msg) { this.handlers.get(type)?.(msg); }
  _set(status) { if (status !== this.status) { this.status = status; this._emit('status', status); } }

  get token() { try { return JSON.parse(localStorage.getItem(key(this.code)))?.token ?? null; } catch { return null; } }
  forget(code = this.code) { try { localStorage.removeItem(key(code)); } catch { /* storage blocked */ } }

  // create: first connect makes the room; otherwise join (or resume when a token is stored for this code).
  connect(code, { create = false, name = '' } = {}) {
    this.close();
    this.code = code;
    this._hello = { t: T.hello, code, create, name };
    this._wantOpen = true;
    this.tries = 0;
    this._open();
  }

  _open() {
    clearTimeout(this._timers.retry);
    this._set(this.tries ? 'reconnecting' : 'connecting');
    let ws;
    try { ws = new WebSocket(`${NET.url}/room/${this.code}`); } catch { return this._retry(); }
    this.ws = ws;
    ws.onopen = () => {
      if (this.ws !== ws) return;
      const resume = this.token;
      this.send({ ...this._hello, create: this._hello.create && !resume, token: resume });
      this._lastRx = performance.now();
      this._pinger();
    };
    ws.onmessage = (e) => {
      if (this.ws !== ws) return;
      this._lastRx = performance.now();
      if (e.data === 'pong') { this.rtt = performance.now() - this._pingAt; return; }
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === T.welcome) {
        this.slot = m.slot;
        this.tries = 0;
        try { localStorage.setItem(key(this.code), JSON.stringify({ token: m.token })); } catch { /* storage blocked */ }
        this._set('open');
      } else if (m.t === T.err && ['noroom', 'full', 'exists', 'started'].includes(m.code)) {
        this._wantOpen = false; // fatal for this attempt: do not hammer the room
        if (m.code !== 'exists') this.forget();
      }
      this._emit(m.t, m);
    };
    ws.onclose = () => { if (this.ws === ws) this._lost(); };
    ws.onerror = () => {};
  }

  _pinger() {
    clearInterval(this._timers.ping);
    this._timers.ping = setInterval(() => {
      if (this.ws?.readyState !== 1) return;
      if (performance.now() - this._lastRx > DEAD_MS) { try { this.ws.close(); } catch { /* ignore */ } return this._lost(); }
      this._pingAt = performance.now();
      this.ws.send('ping');
    }, PING_MS);
  }

  _lost() {
    clearInterval(this._timers.ping);
    const ws = this.ws;
    this.ws = null;
    try { ws?.close(); } catch { /* ignore */ }
    if (this._wantOpen) this._retry();
    else this._set('idle');
  }

  _retry() {
    this._set('reconnecting');
    const wait = Math.min(8000, 400 * 2 ** this.tries++) * (0.75 + Math.random() * 0.5);
    this._timers.retry = setTimeout(() => this._wantOpen && this._open(), wait);
  }

  send(msg) {
    if (this.ws?.readyState !== 1) return false;
    this.ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
    return true;
  }

  close() {
    this._wantOpen = false;
    clearInterval(this._timers.ping);
    clearTimeout(this._timers.retry);
    const ws = this.ws;
    this.ws = null;
    try { ws?.close(); } catch { /* ignore */ }
    this._set('idle');
  }
}

// ---- prediction helpers (guest) ----
// Move `cur` toward `target` by fraction k of the gap (frame-rate independent when k comes from `chaseK`).
export const chase = (cur, target, k) => cur + (target - cur) * k;
export const chaseK = (rate, dt) => 1 - Math.exp(-rate * dt);

// Keep a locally predicted entity near the authoritative position: ignore small lag-sized error,
// ease in a medium one, snap a big one. Returns true if it snapped.
export function reconcile(e, sx, sz, { ease = 2.5, snap = 7, k = 0.25 } = {}) {
  const err = Math.hypot(sx - e.x, sz - e.z);
  if (err > snap) { e.x = e.px = sx; e.z = e.pz = sz; return true; }
  if (err > ease) { e.x += (sx - e.x) * k; e.z += (sz - e.z) * k; }
  return false;
}
