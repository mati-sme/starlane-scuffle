// One GameRoom per 4-char code. Lobby authority + relay for the host-sim model:
//   host (slot 0, the creator) runs the Match and sends `snap` / `ev`; the guest (slot 1) sends `in`. The room only forwards those.
// WebSocket hibernation: sockets are accepted with ctx.acceptWebSocket, per-socket identity lives in serializeAttachment,
// everything else (players, phase, picks, seed) lives in storage, so the object can be evicted between messages.
import { DurableObject } from 'cloudflare:workers';

const MAX_HUMANS = 2;
const GRACE_MS = 45_000;          // a dropped player keeps their slot this long
const EMPTY_MS = 10 * 60_000;     // an empty room is wiped after this
const MAX_MSG = 32 * 1024;
const FORWARD = { in: 1, snap: 1, ev: 1 };
const TEAMS = [0, 1];

export class GameRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    this.s = null;
    this.ctx.blockConcurrencyWhile(async () => { this.s = (await this.ctx.storage.get('room')) ?? null; });
  }

  // ---- HTTP: WebSocket upgrade or JSON status ----
  async fetch(request) {
    const code = request.headers.get('x-room-code') ?? '';
    if (request.headers.get('Upgrade') !== 'websocket') return Response.json(this._status(code));
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ code, token: null });
    return new Response(null, { status: 101, webSocket: client });
  }

  _status(code) {
    const s = this.s;
    if (!s) return { ok: true, code, exists: false };
    const live = this._live();
    return { ok: true, code, exists: true, phase: s.phase, humans: s.players.length, connected: s.players.filter((p) => live.has(p.token)).length, open: s.phase === 'lobby' && s.players.length < MAX_HUMANS };
  }

  // ---- hibernation handlers ----
  async webSocketMessage(ws, message) {
    if (typeof message !== 'string' || message.length > MAX_MSG) return;
    let m;
    try { m = JSON.parse(message); } catch { return; }
    if (!m || typeof m.t !== 'string') return;
    const att = ws.deserializeAttachment() ?? {};
    if (m.t === 'hello') return this._hello(ws, att, m);
    const p = att.token && this.s?.players.find((q) => q.token === att.token);
    if (!p) return this._err(ws, 'nohello', 'Say hello first');

    p.seen = Date.now();
    if (FORWARD[m.t]) { // gameplay relay: guest input -> host, host snapshots / events -> guest
      if (this.s.phase !== 'play') return;
      const to = m.t === 'in' ? (p.slot === 1 ? 0 : -1) : (p.slot === 0 ? 1 : -1);
      if (to >= 0) this._sendSlot(to, message);
      return;
    }
    switch (m.t) {
      case 'pick': return this._pick(p, m);
      case 'start': return this._start(ws, p, m);
      case 'leave': return this._leave(p);
      case 'abort': return this._abort(p); // host reloaded mid-match and lost the sim: back to the lobby
      case 'rename': p.name = clean(m.name, 12) || p.name; await this._save(); return this._lobby();
    }
  }

  async webSocketClose(ws) { await this._drop(ws); }
  async webSocketError(ws) { await this._drop(ws); }

  async alarm() {
    const now = Date.now(), s = this.s;
    if (s) {
      const live = this._live();
      const gone = s.players.filter((p) => !live.has(p.token) && now - p.seen >= GRACE_MS);
      for (const p of gone) {
        if (p.slot === 0) { // host never came back: the room closes for everyone
          s.phase = 'lobby';
          s.players = [];
          s.emptySince = now;
          this._broadcast({ t: 'closed', why: 'host-left' });
          break;
        }
        s.players = s.players.filter((q) => q !== p);
        this._broadcast({ t: 'peer', slot: p.slot, connected: false, gone: true });
      }
      if (gone.length) { await this._save(); this._lobby(); }
      if (!s.players.length && now - (s.emptySince ?? now) >= EMPTY_MS) { await this.ctx.storage.deleteAll(); this.s = null; return; }
    }
    await this._schedule();
  }

  // ---- lobby ----
  async _hello(ws, att, m) {
    const code = att.code || String(m.code ?? '').toUpperCase();
    let s = this.s;
    if (!s) {
      if (!m.create) return this._err(ws, 'noroom', 'No such room');
      s = this.s = { code, phase: 'lobby', seed: 0, players: [], created: Date.now(), emptySince: null };
    } else if (m.create && !s.players.length) {
      s.phase = 'lobby'; // stale empty room under a recycled code
    }

    let p = m.token ? s.players.find((q) => q.token === m.token) : null;
    if (!p) {
      if (m.create && s.players.length) return this._err(ws, 'exists', 'Room code already in use');
      if (s.phase !== 'lobby') return this._err(ws, 'started', 'Match already started');
      if (s.players.length >= MAX_HUMANS) return this._err(ws, 'full', 'Room is full');
      p = { token: crypto.randomUUID(), slot: s.players.length, name: clean(m.name, 12) || (s.players.length ? 'Player 2' : 'Player 1'), team: s.players[0]?.team ?? 0, hero: null, seen: Date.now() };
      s.players.push(p);
    }
    for (const old of this.ctx.getWebSockets()) { // a resumed player replaces their stale socket
      if (old !== ws && old.deserializeAttachment()?.token === p.token) { old.serializeAttachment({ code, token: null }); try { old.close(4000, 'replaced'); } catch { /* already closed */ } }
    }
    ws.serializeAttachment({ code, token: p.token });
    p.seen = Date.now();
    s.emptySince = null;
    await this._save();

    ws.send(JSON.stringify({ t: 'welcome', code, slot: p.slot, token: p.token, phase: s.phase, start: s.phase === 'play' ? this._startMsg() : null }));
    this._lobby();
    this._broadcast({ t: 'peer', slot: p.slot, connected: true }, ws);
    await this._schedule();
  }

  async _pick(p, m) {
    if (this.s.phase !== 'lobby') return;
    if (TEAMS.includes(m.team)) p.team = m.team;
    if (typeof m.hero === 'string' && m.hero.length < 24) p.hero = m.hero;
    await this._save();
    this._lobby();
  }

  async _start(ws, p, m) {
    const s = this.s;
    if (p.slot !== 0) return this._err(ws, 'nothost', 'Only the host can start');
    if (s.phase !== 'lobby') return;
    if (s.players.length < 2 && !m.practice) return this._err(ws, 'alone', 'Waiting for a friend (or start Practice)');
    if (s.players.some((q) => !q.hero)) return this._err(ws, 'nohero', 'Everyone must pick a champion');
    s.phase = 'play';
    s.seed = (Math.random() * 2 ** 31) | 0;
    await this._save();
    this._broadcast({ t: 'start', ...this._startMsg() });
    this._lobby();
  }

  async _abort(p) {
    if (p.slot !== 0 || this.s.phase !== 'play') return;
    this.s.phase = 'lobby';
    await this._save();
    this._broadcast({ t: 'closed', why: 'aborted' });
    this._lobby();
  }

  // Explicit exit: the guest's slot frees up at once; the host leaving closes the room.
  async _leave(p) {
    const s = this.s;
    s.players = s.players.filter((q) => q !== p);
    if (p.slot === 0) {
      this._broadcast({ t: 'closed', why: 'host-left' });
      s.players = [];
      s.phase = 'lobby';
      s.emptySince = Date.now();
    } else {
      this._broadcast({ t: 'peer', slot: p.slot, connected: false, gone: true });
      if (!s.players.length) s.emptySince = Date.now();
    }
    await this._save();
    this._lobby();
    await this._schedule();
  }

  _startMsg() { return { seed: this.s.seed, picks: this.s.players.map((p) => ({ slot: p.slot, team: p.team, hero: p.hero, name: p.name })) }; }

  _lobby() {
    const s = this.s, live = this._live();
    if (!s) return;
    const msg = { t: 'lobby', code: s.code, phase: s.phase, players: s.players.map((p) => ({ slot: p.slot, name: p.name, team: p.team, hero: p.hero, connected: live.has(p.token) })) };
    this._broadcast(msg);
  }

  // ---- connection bookkeeping ----
  _live() {
    const set = new Set();
    for (const ws of this.ctx.getWebSockets()) {
      const t = ws.deserializeAttachment()?.token;
      if (t && ws.readyState === 1) set.add(t);
    }
    return set;
  }

  async _drop(ws) {
    try { ws.close(); } catch { /* already closed */ }
    const s = this.s, token = ws.deserializeAttachment()?.token;
    const p = s && token && s.players.find((q) => q.token === token);
    if (!p) return;
    if (this._live().has(token)) return; // already resumed on a newer socket
    p.seen = Date.now();
    if (!this._live().size) s.emptySince = Date.now();
    await this._save();
    this._broadcast({ t: 'peer', slot: p.slot, connected: false });
    this._lobby();
    await this._schedule();
  }

  async _schedule() {
    const s = this.s;
    if (!s) return;
    const live = this._live();
    let at = Infinity;
    for (const p of s.players) if (!live.has(p.token)) at = Math.min(at, p.seen + GRACE_MS);
    if (!live.size) at = Math.min(at, (s.emptySince ?? Date.now()) + EMPTY_MS);
    if (at < Infinity) await this.ctx.storage.setAlarm(Math.max(at, Date.now() + 1000));
    else await this.ctx.storage.deleteAlarm();
  }

  _sendSlot(slot, raw) {
    const s = this.s, p = s?.players.find((q) => q.slot === slot);
    if (!p) return;
    for (const ws of this.ctx.getWebSockets()) if (ws.deserializeAttachment()?.token === p.token) { try { ws.send(raw); } catch { /* socket closing */ } }
  }

  _broadcast(msg, except) {
    const raw = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) if (ws !== except && ws.deserializeAttachment()?.token) { try { ws.send(raw); } catch { /* socket closing */ } }
  }

  _err(ws, code, msg) { try { ws.send(JSON.stringify({ t: 'err', code, msg })); } catch { /* socket closing */ } }
  _save() { return this.ctx.storage.put('room', this.s); }
}

const clean = (v, n) => String(v ?? '').replace(/[^\w \-.]/g, '').trim().slice(0, n);
