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
const BAN_MS = 12_000;            // draft: ban stage, then pick stage (timers only run with two humans)
const PICK_MS = 30_000;
const SPELLS = ['flash', 'barrier', 'ignite']; // summoner spells (js/game/spells.js); everyone carries two, default Flash + Barrier
const DEFAULT_SPELLS = ['flash', 'barrier'];
const LEVELS = ['easy', 'mid', 'hard']; // match setup (js/game/setup.js): { size: [sunny, gloom] 1-5, side, diff: [[5 levels], [5 levels]] }
const STAGE_GRACE_MS = 1000;      // clients auto-ban at the buzzer; a `stage` skip is honoured this long after it

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
      case 'pick': return this._pick(ws, p, m);
      case 'stage': return this._stage(p);
      case 'setup': return this._setup(ws, p, m);
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
      s = this.s = { code, phase: 'lobby', seed: 0, players: [], created: Date.now(), emptySince: null, stage: 'ban', stageEnd: null };
    } else if (m.create && !s.players.length) {
      s.phase = 'lobby'; // stale empty room under a recycled code
      this._draft();
    }

    let p = m.token ? s.players.find((q) => q.token === m.token) : null;
    if (!p) {
      if (m.create && s.players.length) return this._err(ws, 'exists', 'Room code already in use');
      if (s.phase !== 'lobby') return this._err(ws, 'started', 'Match already started');
      if (s.players.length >= MAX_HUMANS) return this._err(ws, 'full', 'Room is full');
      p = { token: crypto.randomUUID(), slot: s.players.length, name: clean(m.name, 12) || (s.players.length ? 'Player 2' : 'Player 1'), team: s.players[0]?.team ?? 0, hero: null, ban: null, spells: [...DEFAULT_SPELLS], seen: Date.now() };
      s.players.push(p);
      this._draft(); // a new face: everyone bans and picks again
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

  // New draft: nobody has banned or picked yet. The timer only runs when two humans are here to race it.
  _draft() {
    const s = this.s;
    s.stage = 'ban';
    for (const p of s.players) { p.ban = null; p.hero = null; }
    this._timer(BAN_MS);
  }

  _timer(ms) { this.s.stageEnd = this.s.players.length === 2 ? Date.now() + ms : null; }

  _bans() { return new Set(this.s.players.map((p) => p.ban).filter(Boolean)); }

  // team / ban / hero. A ban only counts once, during the ban stage; a hero must be neither banned nor already taken.
  async _pick(ws, p, m) {
    const s = this.s;
    if (s.phase !== 'lobby') return;
    let bad = null;
    if (TEAMS.includes(m.team)) p.team = m.team;
    if (typeof m.ban === 'string' && m.ban.length < 24 && s.stage === 'ban' && !p.ban) {
      if (this._bans().has(m.ban)) bad = ['banned', 'Already banned, ban another one'];
      else {
        p.ban = m.ban;
        for (const q of s.players) if (q.hero === m.ban) q.hero = null;
        if (s.players.every((q) => q.ban)) { s.stage = 'pick'; this._timer(PICK_MS); }
      }
    }
    if (Array.isArray(m.spells) && m.spells.length === 2 && m.spells[0] !== m.spells[1] && m.spells.every((id) => SPELLS.includes(id))) p.spells = [...m.spells];
    if (typeof m.hero === 'string' && m.hero.length < 24) {
      if (this._bans().has(m.hero)) bad = ['banned', 'That champion is banned'];
      else if (s.players.some((q) => q !== p && q.hero === m.hero)) bad = ['taken', 'Already picked, choose another one'];
      else p.hero = m.hero;
    }
    await this._save();
    if (bad) this._err(ws, bad[0], bad[1]);
    this._lobby();
  }

  // Ban timer ran out (a client asks): move on even if someone never banned.
  async _stage(p) {
    const s = this.s;
    if (s.phase !== 'lobby' || s.stage !== 'ban' || !s.stageEnd || Date.now() < s.stageEnd + STAGE_GRACE_MS) return;
    s.stage = 'pick';
    this._timer(PICK_MS);
    await this._save();
    this._lobby();
  }

  // Host only: the match setup (team sizes, bot levels). Stored as sent after cleaning; a room that never gets one plays 5v5 Mid.
  async _setup(ws, p, m) {
    if (p.slot !== 0) return this._err(ws, 'nothost', 'Only the host can change the match setup');
    if (this.s.phase !== 'lobby') return;
    const setup = cleanSetup(m.setup);
    if (!setup) return;
    this.s.setup = setup;
    await this._save();
    this._lobby();
  }

  async _start(ws, p, m) {
    const s = this.s;
    if (p.slot !== 0) return this._err(ws, 'nothost', 'Only the host can start');
    if (s.phase !== 'lobby') return;
    const setup = cleanSetup(m.setup);
    if (setup) s.setup = setup;
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
    this._draft();
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

  _startMsg() { return { seed: this.s.seed, bans: [...this._bans()].sort(), picks: this.s.players.map((p) => ({ slot: p.slot, team: p.team, hero: p.hero, name: p.name, spells: p.spells ?? DEFAULT_SPELLS })), ...(this.s.setup ? { setup: this.s.setup } : {}) }; }

  _lobby() {
    const s = this.s, live = this._live();
    if (!s) return;
    const left = s.stageEnd && s.players.length === 2 ? Math.max(0, Math.ceil((s.stageEnd - Date.now()) / 1000)) : 0;
    const msg = { t: 'lobby', code: s.code, phase: s.phase, stage: s.stage, left, bans: [...this._bans()], players: s.players.map((p) => ({ slot: p.slot, name: p.name, team: p.team, hero: p.hero, ban: p.ban, spells: p.spells ?? DEFAULT_SPELLS, connected: live.has(p.token) })), ...(s.setup ? { setup: s.setup } : {}) };
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

// -> a well-formed setup, or null when `raw` is not one (the room then keeps what it had).
function cleanSetup(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.size) || !Array.isArray(raw.diff)) return null;
  const n = (v) => Math.min(5, Math.max(1, Math.round(+v) || 5));
  return {
    size: [n(raw.size[0]), n(raw.size[1])],
    side: raw.side === 1 ? 1 : 0,
    diff: [0, 1].map((t) => Array.from({ length: 5 }, (_, i) => (LEVELS.includes(raw.diff[t]?.[i]) ? raw.diff[t][i] : 'mid'))),
  };
}
