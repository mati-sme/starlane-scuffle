// Online match plumbing between a Match and the room socket.
//   host: collects events, sends a snapshot ~10 Hz, applies the guest's input messages to their hero.
//   guest: sends the local input ~20 Hz, applies host snapshots; freezes while the host is away or silent.
import { bus } from '../core/bus.js';
import { NET } from '../config.js';
import { T } from './protocol.js';
import { encodeSnap, applySnap, refOf } from './snapshot.js';

const STALE_MS = 2500; // guest: no snapshot for this long = host is gone / frozen

export class Session {
  constructor(match, net) {
    this.match = match; this.net = net;
    this.role = null;
    this.events = [];
    this.seq = 0;
    this.sendAt = 0;
    this.peerAway = false; // host: the guest's socket is down
    this.hostAway = false; // guest: the host's socket is down

    const push = (e) => { if (this.role === 'host') this.events.push(e); };
    bus.on('cast', ({ hero, slot }) => push(['c', match.heroes.indexOf(hero), slot]));
    bus.on('swing', (h) => { if (h.type === 'hero') push(['w', match.heroes.indexOf(h)]); });
    bus.on('takedown', ({ killer, victim }) => push(['k', match.heroes.indexOf(victim), match.heroes.indexOf(killer)]));
    match.projectiles.onFire = (src, tgt, speed, arc, y) => {
      if (this.role !== 'host') return;
      const a = refOf(match, src), b = refOf(match, tgt);
      if (a >= 0 && b >= 0) this.events.push(['p', a, b, speed, arc, Math.round(y * 10) / 10]);
    };
  }

  begin(role) {
    this.role = role;
    this.events.length = 0;
    this.seq = 0;
    this.sendAt = 0;
    this.peerAway = this.hostAway = false;
  }

  end() { this.role = null; }

  // Host: the sim waits while its own socket is down. Guest: waits while the host is away or no snapshot arrives.
  get paused() {
    if (this.role === 'host') return this.net.status !== 'open';
    if (this.role === 'guest') return this.net.status !== 'open' || this.hostAway || this.silent;
    return false;
  }

  get silent() { return !!this.match.snapAt && performance.now() - this.match.snapAt > STALE_MS; }

  // Why the screen should show a waiting banner (or '' for none).
  get banner() {
    if (!this.role) return '';
    if (this.net.status !== 'open') return 'Reconnecting…';
    if (this.role === 'guest' && (this.hostAway || this.silent)) return 'Waiting for host…';
    if (this.role === 'host' && this.peerAway) return 'Friend reconnecting…';
    return '';
  }

  onMessage(m) {
    if (this.role === 'guest' && m.t === T.snap) applySnap(this.match, m);
    else if (this.role === 'host' && m.t === T.input) this.match.applyPeerInput(m);
  }

  onPeer(m) {
    if (this.role === 'host') {
      this.peerAway = !m.connected;
      if (m.gone) this.match.botify(this.match.peerHero);
    } else if (this.role === 'guest' && m.slot === 0) this.hostAway = !m.connected;
  }

  // Call every render frame with performance.now().
  tick(now) {
    if (!this.role || this.net.status !== 'open') return;
    const m = this.match;
    if (this.role === 'host') {
      if (now - this.sendAt < 1000 / NET.snapHz) return;
      this.sendAt = now;
      this.net.send(encodeSnap(m, ++this.seq, this.events.splice(0)));
    } else {
      if (now - this.sendAt < 1000 / NET.inputHz) return;
      this.sendAt = now;
      const o = m.outbox;
      if (!o) return;
      if (this.paused) { o.x = o.z = 0; o.attack = false; } // frozen sim: do not leave the hero walking on the host
      const bits = (a) => a.reduce((n, v, i) => n | (v ? 1 << i : 0), 0);
      this.net.send({ t: T.input, x: Math.round(o.x * 100) / 100, z: Math.round(o.z * 100) / 100, a: o.attack ? 1 : 0, c: bits(o.cast), s: bits(o.spend) });
      o.cast.fill(false); o.spend.fill(false);
    }
  }
}
