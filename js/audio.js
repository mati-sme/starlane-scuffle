// WebAudio synth: sfx + light music, no audio files. The context is created on the first user gesture.
import { bus } from './core/bus.js';
import { save } from './save.js';

const MAX_VOICES = 24;
const NOTE = { c5: 523.3, d5: 587.3, e5: 659.3, g5: 784, a5: 880, c6: 1046.5, e6: 1318.5, g6: 1568 };
const BASS = [65.4, 55, 49, 55];
const SCALE = [261.6, 293.7, 329.6, 392, 440, 523.3];
const ARP = [0, 2, 3, 4, 3, 2, 1, 2, 4, 3, 2, 3, 1, 2, 3, 2];

let ctx, master, sfxBus, musicBus, crush, noise;
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
}

function env(g, t, vol, dur, att) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + att);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

function tone(type, f0, f1, dur, vol, delay = 0, dest = sfxBus, att = 0.005) {
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
  c.connect(g).connect(sfxBus);
  voices++;
  c.onended = () => { voices--; g.disconnect(); };
  for (const o of [c, m]) { o.start(t); o.stop(t + dur + 0.02); }
}

function hiss(dur, vol, f0, f1, delay = 0, type = 'bandpass', dest = sfxBus) {
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
  blaster: (f, d, v, w) => tone('sawtooth', f, f * 0.3, d * 1.3, v * 0.4, w, crush),
  shooter: (f, d, v, w) => tone('triangle', f * 1.2, f * 0.6, d, v, w, crush),
  support: (f, d, v, w) => bell(f * 1.5, d * 2.5, v * 0.7, w),
};
const voice = (h) => VOICE[h?.def?.role] ?? VOICE.tank;

const duck = () => {
  const g = musicBus.gain, t = ctx.currentTime;
  g.cancelScheduledValues(t);
  g.setValueAtTime(0.3, t);
  g.setTargetAtTime(0.6, t + 0.8, 0.3);
};

const SFX = {
  click: () => tone('triangle', 500, 800, 0.08, 0.25),
  tick: () => tone('triangle', 600, 300, 0.06, 0.15),
  swing: (h) => voice(h)(420, 0.08, h?.isPlayer ? 0.3 : 0.12, 0),
  skill: (h) => {
    const v = voice(h);
    v(300, 0.18, 0.3, 0);
    v(450, 0.18, 0.2, 0.06);
  },
  ult: (h) => {
    tone('sawtooth', 120, 520, 0.5, 0.18, 0, sfxBus, 0.3);
    tone('sawtooth', 124, 530, 0.5, 0.18, 0, sfxBus, 0.3);
    tone('sine', 90, 35, 0.35, 0.6, 0.45);
    if (h?.isPlayer) duck();
  },
  poof: () => {
    hiss(0.15, 0.3, 2000, 6000);
    [NOTE.c6, NOTE.e6, NOTE.g6].forEach((f, i) => tone('sine', f, f, 0.12, 0.1, 0.04 + i * 0.05));
  },
  level: () => [NOTE.c5, NOTE.d5, NOTE.e5, NOTE.g5, NOTE.a5, NOTE.c6].forEach((f, i) => tone('triangle', f, f, 0.14, 0.2, i * 0.065)),
  tower: () => tone('square', 700, 250, 0.12, 0.1),
  shatter: (big) => {
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

function play(name, a, b) {
  if (!ctx || muted) return;
  const now = performance.now();
  if (now - (last[name] ?? 0) < 30) return;
  last[name] = now;
  SFX[name](a, b);
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

bus.on('swing', (h) => play('swing', h));
bus.on('cast', ({ hero, slot }) => play(slot === 2 ? 'ult' : 'skill', hero));
bus.on('hit', (t) => { if (t.type !== 'minion') play('tick'); });
bus.on('down', (t) => play(t.type === 'tower' || t.type === 'core' ? 'shatter' : 'poof', t.type === 'core'));
bus.on('levelUp', (h) => { if (h.isPlayer) play('level'); });
bus.on('rankUp', ({ hero }) => { if (hero.isPlayer) play('level'); });
bus.on('towerShot', () => play('tower'));
bus.on('storm', () => { bpm = 120; });
bus.on('end', ({ win }) => {
  stopMusic();
  play(win ? 'win' : 'lose');
});

export const audio = {
  get muted() { return muted; },
  sfx: play,
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
