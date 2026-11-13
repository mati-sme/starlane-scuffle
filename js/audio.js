// WebAudio: sampled sfx (Kenney CC0 packs in assets/sfx, see assets/sfx/CREDITS.md) + a synth fallback and light music.
// The context is created on the first user gesture. World sounds are range-limited around the local hero (or the camera when dead).
import { bus } from './core/bus.js';
import { save } from './save.js';

const MAX_VOICES = 24;
const NOTE = { c5: 523.3, d5: 587.3, e5: 659.3, g5: 784, a5: 880, c6: 1046.5, e6: 1318.5, g6: 1568 };
const BASS = [65.4, 55, 49, 55];
const SCALE = [261.6, 293.7, 329.6, 392, 440, 523.3];
const ARP = [0, 2, 3, 4, 3, 2, 1, 2, 4, 3, 2, 3, 1, 2, 3, 2];

let ctx, master, sfxBus, musicBus, crush, noise;
// Positional sfx: world events are panned/attenuated against the local hero. Camera right vector on the ground plane (CAM.offset -7,20,15).
// v10: HEAR_RANGE is about one screen; nothing beyond it plays (it used to be audible map-wide at a 6% floor).
const RIGHT_X = 0.906, RIGHT_Z = 0.423, PAN_RANGE = 14, HEAR_RANGE = 24;
let listener = () => null, spot = null; // spot = per-event panner while a positional sfx is being built
const out = () => spot ?? sfxBus;
let voices = 0, muted = save.get('mute', false), wantMusic = false;
let timer = 0, step = 0, next = 0, bpm = 112;
const last = {};

function build() {
  ctx = new AudioContext();
  const comp = ctx.createDynamicsCompressor();
  master = ctx.createGain();
  sfxBus = ctx.createGain();
  musicBus = ctx.createGain();
  master.gain.value = muted ? 0 : 0.8;
  sfxBus.gain.value = 0.9;
  musicBus.gain.value = 0.6;
  sfxBus.connect(master);
  musicBus.connect(master);
  master.connect(comp).connect(ctx.destination);

  crush = ctx.createWaveShaper(); // 8-level quantizer for Clink's bitcrushed triangles
  crush.curve = Float32Array.from({ length: 512 }, (_, i) => Math.round(((i / 511) * 2 - 1) * 4) / 4);
  crush.connect(sfxBus);

  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  loadSamples();
}

// ---- Samples (Kenney CC0) ----
const SAMPLE_NAMES = ['shot1', 'shot2', 'shot3', 'shot4', 'tower', 'magic1', 'magic2', 'magic3', 'heal1', 'heal2', 'slash1', 'slash2', 'slash3', 'chop',
  'hit1', 'hit2', 'hit3', 'thud1', 'thud2', 'clang', 'poof', 'towerdown', 'coredown', 'ult1', 'ult2', 'levelup', 'rankup', 'click', 'select', 'nope', 'coin'];
const buf = {};
function loadSamples() {
  const base = new URL('../assets/sfx/', import.meta.url);
  for (const n of SAMPLE_NAMES) {
    fetch(new URL(`${n}.mp3`, base)).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject())).then((a) => ctx.decodeAudioData(a)).then((b) => { buf[n] = b; }).catch(() => {});
  }
}
// Play a decoded sample into the current output (panned spot or the sfx bus). false when not loaded yet (callers fall back to synth).
function smp(name, vol = 1, rate = 1, delay = 0) {
  const b = buf[name];
  if (!b) return false;
  if (voices >= MAX_VOICES) return true;
  const t = ctx.currentTime + delay, s = ctx.createBufferSource(), g = ctx.createGain();
  s.buffer = b;
  s.playbackRate.value = rate;
  g.gain.value = vol;
  s.connect(g).connect(out());
  voices++;
  s.onended = () => { voices--; g.disconnect(); };
  s.start(t);
  return true;
}
// Stable per-champion flavour: which variant of a sample set and a small pitch offset, so every champion sounds a bit different.
const hash = (id = '') => { let x = 7; for (const c of id) x = (x * 31 + c.charCodeAt(0)) >>> 0; return x; };
const flav = (h) => { const x = hash(h?.def?.id ?? h?.id); return { i: x, rate: 0.9 + ((x >> 4) % 21) / 100 }; };
const pick = (arr, i) => arr[i % arr.length];

// Bitcrusher: shared when centred, one per positional event so it lands in that event's panner.
function crushOut() {
  if (!spot) return crush;
  const c = ctx.createWaveShaper();
  c.curve = crush.curve;
  c.connect(spot);
  return c;
}

// Returns a panner chain for a world source, or null when it is too far to hear.
function place(src) {
  const me = listener();
  if (!me || !src || src === me || src.x == null) return undefined; // centred: the local hero's own sounds and UI
  // (v10: no `isPlayer` shortcut any more - the other human in an online room was centred, i.e. heard from anywhere on the map)
  const dx = src.x - me.x, dz = src.z - me.z, d = Math.hypot(dx, dz);
  if (d > HEAR_RANGE) return null;
  const gain = (1 - d / HEAR_RANGE) ** 1.5;
  if (gain < 0.03) return null;
  const pan = Math.max(-1, Math.min(1, (dx * RIGHT_X + dz * RIGHT_Z) / PAN_RANGE)) * 0.85;
  return { gain, pan };
}

function env(g, t, vol, dur, att) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + att);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

function tone(type, f0, f1, dur, vol, delay = 0, dest = out(), att = 0.005) {
  const counted = dest !== musicBus;
  if (counted && voices >= MAX_VOICES) return;
  const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  env(g, t, vol, dur, att);
  o.connect(g).connect(dest);
  if (counted) voices++;
  o.onended = () => { if (counted) voices--; g.disconnect(); };
  o.start(t);
  o.stop(t + dur + 0.02);
}

// FM bell: sine carrier, 3.5x sine modulator.
function bell(f, dur, vol, delay = 0) {
  if (voices >= MAX_VOICES) return;
  const t = ctx.currentTime + delay, c = ctx.createOscillator(), m = ctx.createOscillator();
  const mg = ctx.createGain(), g = ctx.createGain();
  c.frequency.value = f;
  m.frequency.value = f * 3.5;
  mg.gain.setValueAtTime(f * 1.2, t);
  mg.gain.exponentialRampToValueAtTime(1, t + dur);
  env(g, t, vol, dur, 0.004);
  m.connect(mg).connect(c.frequency);
  c.connect(g).connect(out());
  voices++;
  c.onended = () => { voices--; g.disconnect(); };
  for (const o of [c, m]) { o.start(t); o.stop(t + dur + 0.02); }
}

function hiss(dur, vol, f0, f1, delay = 0, type = 'bandpass', dest = out()) {
  const t = ctx.currentTime + delay, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noise;
  f.type = type;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  env(g, t, vol, dur, 0.004);
  s.connect(f).connect(g).connect(dest);
  s.onended = () => g.disconnect();
  s.start(t);
  s.stop(t + dur + 0.02);
}

// One timbre per role: (freq, dur, vol, delay).
const VOICE = {
  tank: (f, d, v, w) => tone('square', f * 0.5, f * 0.35, d * 1.2, v * 0.5, w),
  bruiser: (f, d, v, w) => tone('sawtooth', f * 0.7, f * 0.4, d, v * 0.35, w),
  assassin: (f, d, v, w) => tone('square', f * 1.6, f * 1.1, d * 0.7, v * 0.35, w),
  blaster: (f, d, v, w) => tone('sawtooth', f, f * 0.3, d * 1.3, v * 0.4, w, crushOut()),
  shooter: (f, d, v, w) => tone('triangle', f * 1.2, f * 0.6, d, v, w, crushOut()),
  support: (f, d, v, w) => bell(f * 1.5, d * 2.5, v * 0.7, w),
};
const voice = (h) => VOICE[h?.def?.role] ?? VOICE.tank;

const duck = () => {
  const g = musicBus.gain, t = ctx.currentTime;
  g.cancelScheduledValues(t);
  g.setValueAtTime(0.3, t);
  g.setTargetAtTime(0.6, t + 0.8, 0.3);
};

// Basic attack per champion: shooters fire laser shots, blasters a magic zap, supports a soft chime, melee a slash / thud by swing style.
function swingSample(h) {
  const d = h?.def, f = flav(h), mine = h === listener(), v = mine ? 0.55 : 0.4;
  if (!d) return false;
  const role = d.role, b = d.basic ?? {};
  if (b.kind !== 'melee') {
    if (role === 'blaster') return smp(pick(['magic1', 'magic2'], f.i), v * 0.55, f.rate * 1.35);
    if (role === 'support') return smp('heal2', v * 0.45, f.rate * 1.15);
    return smp(pick(['shot1', 'shot2', 'shot3', 'shot4'], f.i), v * 0.7, f.rate);
  }
  if (role === 'tank' || b.style === 'slam') return smp(pick(['thud1', 'thud2'], f.i), v, f.rate * 0.95);
  if (role === 'assassin') return smp(pick(['slash2', 'slash3'], f.i), v * 0.85, f.rate * 1.15);
  if (b.style === 'upper') return smp('chop', v, f.rate);
  return smp(pick(['slash1', 'slash2', 'slash3', 'chop'], f.i), v * 0.85, f.rate);
}
function skillSample(h) {
  const d = h?.def, f = flav(h), v = h === listener() || h?.isPlayer && h.x == null ? 0.6 : 0.45;
  if (!d) return false;
  switch (d.role) {
    case 'blaster': return smp(pick(['magic3', 'magic1', 'magic2'], f.i), v * 0.6, f.rate);
    case 'support': return smp('heal1', v * 0.55, f.rate);
    case 'shooter': smp('shot3', v * 0.6, f.rate * 0.8); return smp('shot1', v * 0.5, f.rate * 0.9, 0.07);
    case 'tank': smp('thud1', v, f.rate * 0.8); return smp('clang', v * 0.4, f.rate * 0.9, 0.03);
    case 'assassin': return smp('slash2', v * 0.8, f.rate * 1.25);
    default: smp('chop', v * 0.8, f.rate * 0.9); return smp('slash1', v * 0.6, f.rate, 0.05);
  }
}

const SFX = {
  click: () => smp('click', 0.35) || tone('triangle', 500, 800, 0.08, 0.25),
  tick: (t) => smp(pick(['hit1', 'hit2', 'hit3'], (Math.random() * 3) | 0), t?.type === 'hero' ? 0.32 : 0.22, 0.95 + Math.random() * 0.15) || tone('triangle', 600, 300, 0.06, 0.15),
  nope: () => smp('nope', 0.3),
  coin: () => smp('coin', 0.35),
  swing: (h) => swingSample(h) || voice(h)(420, 0.08, h?.isPlayer ? 0.3 : 0.12, 0),
  skill: (h) => {
    if (skillSample(h)) return;
    const v = voice(h);
    v(300, 0.18, 0.3, 0);
    v(450, 0.18, 0.2, 0.06);
  },
  ult: (h) => {
    if (h === listener()) duck();
    if (smp('ult1', 0.5, flav(h).rate)) { smp('ult2', 0.4, 1, 0.12); return; }
    tone('sawtooth', 120, 520, 0.5, 0.18, 0, out(), 0.3);
    tone('sawtooth', 124, 530, 0.5, 0.18, 0, out(), 0.3);
    tone('sine', 90, 35, 0.35, 0.6, 0.45);
    if (h?.isPlayer) duck();
  },
  poof: () => {
    if (smp('poof', 0.55)) { [NOTE.c6, NOTE.e6, NOTE.g6].forEach((f, i) => tone('sine', f, f, 0.12, 0.06, 0.04 + i * 0.05)); return; }
    hiss(0.15, 0.3, 2000, 6000);
    [NOTE.c6, NOTE.e6, NOTE.g6].forEach((f, i) => tone('sine', f, f, 0.12, 0.1, 0.04 + i * 0.05));
  },
  level: () => smp('levelup', 0.5) || [NOTE.c5, NOTE.d5, NOTE.e5, NOTE.g5, NOTE.a5, NOTE.c6].forEach((f, i) => tone('triangle', f, f, 0.14, 0.2, i * 0.065)),
  rank: () => smp('rankup', 0.45) || SFX.level(),
  tower: () => smp('tower', 0.35, 0.8) || tone('square', 700, 250, 0.12, 0.1),
  shatter: (big) => {
    if (smp(big ? 'coredown' : 'towerdown', big ? 0.75 : 0.6)) { bell(NOTE.e6, 0.8, 0.08, 0.15); return; }
    hiss(big ? 0.9 : 0.4, 0.5, 3000, 300, 0, 'lowpass');
    bell(NOTE.e6, big ? 1.8 : 0.8, 0.18, 0.1);
    if (big) { bell(1760, 1.8, 0.14, 0.25); bell(2093, 1.8, 0.1, 0.4); }
  },
  win: () => [NOTE.c5, NOTE.e5, NOTE.g5, NOTE.c6, NOTE.g5, NOTE.c6, NOTE.e6].forEach((f, i) => {
    tone('triangle', f, f, i > 5 ? 1 : 0.3, 0.22, i * 0.2);
    bell(f, 0.6, 0.08, i * 0.2);
  }),
  lose: () => [NOTE.e5, NOTE.d5, NOTE.c5].forEach((f, i) => tone('sine', f, f * 0.98, i > 1 ? 1.1 : 0.4, 0.22, i * 0.35)),
};

function play(name, a, b, src) {
  if (!ctx || muted || !SFX[name]) return;
  const where = src ? place(src) : undefined;
  if (where === null) return; // out of earshot: don't spend a voice or the retrigger slot
  const now = performance.now();
  if (now - (last[name] ?? 0) < 30) return;
  last[name] = now;
  if (!where) { SFX[name](a, b); return; }
  const g = ctx.createGain(), p = ctx.createStereoPanner();
  g.gain.value = where.gain;
  p.pan.value = where.pan;
  g.connect(p).connect(sfxBus);
  spot = g;
  try { SFX[name](a, b); } finally { spot = null; }
  setTimeout(() => { g.disconnect(); p.disconnect(); }, 3000);
}

// Light music: 8th-note step sequencer at 112 BPM in C major pentatonic. Lookahead 100 ms, tick 25 ms.
function schedule() {
  const spb = 60 / bpm / 2;
  while (next < ctx.currentTime + 0.1) {
    const s = step % 8, root = BASS[(step >> 3) & 3], w = Math.max(0, next - ctx.currentTime);
    if (s % 2 === 0) tone('triangle', root, root, spb * 1.8, 0.2, w, musicBus);
    tone('sine', SCALE[ARP[step % 16]], SCALE[ARP[step % 16]], spb * 1.5, 0.07, w, musicBus);
    if (s === 0) for (const f of [root * 4, root * 6]) tone('sine', f, f, spb * 8, 0.05, w, musicBus, 0.3);
    if (bpm > 112) hiss(0.04, 0.04, 7000, 9000, w, 'highpass', musicBus);
    step++;
    next += spb;
  }
}

function startMusic() {
  if (timer) return;
  step = 0;
  bpm = 112;
  next = ctx.currentTime + 0.05;
  timer = setInterval(schedule, 25);
}

function stopMusic() { clearInterval(timer); timer = 0; }

function unlock() {
  if (!ctx) build();
  ctx.resume();
  if (wantMusic) startMusic();
}
for (const type of ['pointerdown', 'keydown']) addEventListener(type, unlock, { once: true, capture: true });

bus.on('swing', (h) => play('swing', h, undefined, h));
bus.on('cast', ({ hero, slot }) => play(slot === 3 ? 'ult' : 'skill', hero, undefined, hero));
bus.on('hit', (t) => { if (t.type !== 'minion') play('tick', t, undefined, t); });
bus.on('noCast', ({ hero }) => { if (hero === listener()) play('nope'); });
bus.on('buy', (h) => { if (h === listener()) play('coin'); });
bus.on('down', (t) => play(t.type === 'tower' || t.type === 'core' ? 'shatter' : 'poof', t.type === 'core', undefined, t));
bus.on('levelUp', (h) => { if (h === listener()) play('level'); });
bus.on('rankUp', ({ hero }) => { if (hero === listener()) play('rank'); });
bus.on('towerShot', (t) => play('tower', undefined, undefined, t));
bus.on('storm', () => { bpm = 120; });
bus.on('end', ({ win }) => {
  stopMusic();
  play(win ? 'win' : 'lose');
});

export const audio = {
  get muted() { return muted; },
  sfx: play,
  where: (src) => place(src), // test hook: undefined = centred, null = out of earshot, else { gain, pan }
  set listener(fn) { listener = fn; }, // () => local hero, for positional sfx
  toggleMute() {
    muted = !muted;
    save.set('mute', muted);
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.8, ctx.currentTime, 0.02);
    return muted;
  },
  music(on) {
    wantMusic = on;
    if (!ctx) return;
    if (on) startMusic(); else stopMusic();
  },
  pause(on) { if (ctx) (on ? ctx.suspend() : ctx.resume()); },
};
