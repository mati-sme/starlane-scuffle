// First-match tutorial: a tiny guided practice match (1 v 1, Easy bot). Four short steps, always skippable.
// `advance` is pure (tested in Node); the Tutorial class only watches the match and draws the card.
import { bus } from '../core/bus.js';

export const STEPS = [
  { id: 'move', touch: 'Drag the left side of the screen to MOVE!', key: 'Use W A S D to MOVE!', emoji: '👆' },
  { id: 'attack', touch: 'Hold the big red button to ATTACK!', key: 'Hold Space (or click) to ATTACK!', emoji: '⚔️' },
  { id: 'skill', touch: 'Tap the gold + to learn a skill, then tap it!', key: 'Press 1 to learn a skill, then Q!', emoji: '✨' },
  { id: 'goal', touch: 'Destroy the enemy towers, then their core. You did it — go win!', key: 'Destroy the enemy towers, then their core. You did it — go win!', emoji: '🏁' },
];
export const MOVE_DIST = 5;

// Which step comes next given what the player has done so far. facts: { moved (distance), attacked, cast }.
export function advance(step, facts) {
  if (step === 0 && facts.moved >= MOVE_DIST) return 1;
  if (step === 1 && facts.attacked) return 2;
  if (step === 2 && facts.cast) return 3;
  return step;
}

export class Tutorial {
  constructor(match, { onDone, onSkip }) {
    this.match = match; this.onDone = onDone; this.onSkip = onSkip;
    this.active = false; this.step = 0; this.facts = { moved: 0, attacked: false, cast: false };
    this.cast = ({ hero, slot }) => { if (hero === this.match.hero && slot >= 0 && slot < 3) this.facts.cast = true; };
  }
  start() {
    this.stop();
    const h = this.match.hero;
    this.active = true; this.step = 0; this.facts = { moved: 0, attacked: false, cast: false };
    this.x0 = h.x; this.z0 = h.z;
    h.points = Math.max(1, h.points); // a free skill point so step 3 works at once
    this.el = document.createElement('div');
    this.el.id = 'tutorial';
    this.el.setAttribute('data-testid', 'tutorial-root');
    this.el.innerHTML = '<span class="tut-emoji"></span><p class="tut-text" data-testid="tutorial-text"></p><button type="button" class="tut-btn finish" data-testid="tutorial-finish" hidden>GOT IT!</button><button type="button" class="tut-btn skip" data-testid="tutorial-skip">SKIP</button>';
    document.body.appendChild(this.el);
    this.el.querySelector('.skip').addEventListener('click', () => { const f = this.onSkip; this.stop(); f?.(); });
    this.el.querySelector('.finish').addEventListener('click', () => { const f = this.onDone; this.stop(); f?.(); });
    bus.on('cast', this.cast);
    this.timer = setInterval(() => this.tick(), 150);
    this.paint();
  }
  tick() {
    if (!this.active) return;
    const m = this.match, h = m.hero;
    this.facts.moved = Math.max(this.facts.moved, Math.hypot(h.x - this.x0, h.z - this.z0));
    if (m.intent?.attack) this.facts.attacked = true;
    const n = advance(this.step, this.facts);
    if (n !== this.step) { this.step = n; this.paint(); }
  }
  paint() {
    const s = STEPS[this.step], touch = document.body.classList.contains('touch');
    this.el.querySelector('.tut-text').textContent = touch ? s.touch : s.key;
    this.el.querySelector('.tut-emoji').textContent = s.emoji;
    this.el.querySelector('.finish').hidden = this.step < STEPS.length - 1;
    this.el.dataset.step = s.id;
  }
  stop() {
    if (!this.active && !this.el) return;
    this.active = false;
    clearInterval(this.timer);
    bus.off?.('cast', this.cast);
    this.el?.remove(); this.el = null;
  }
}
