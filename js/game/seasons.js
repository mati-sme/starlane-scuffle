// Season events: every 5 minutes one of Snow / Heat / Storm / Bloom lasts 45 s. The host rolls it; guests copy it from the snapshot.
// The faction multipliers live in factions.js (seasonMods); heroes pick them up through outMul / inMul each frame.
export const SEASON_EVERY = 300;
export const SEASON_LEN = 45;

export const SEASONS = {
  snow: { id: 'snow', name: 'Snow', color: '#BFE6FF', line: 'Dark is stronger, Light is weaker', up: 'dark', down: 'light' },
  heat: { id: 'heat', name: 'Heat', color: '#FF9A3D', line: 'Light is stronger, Dark is weaker', up: 'light', down: 'dark' },
  storm: { id: 'storm', name: 'Storm', color: '#7FA8FF', line: 'Water is stronger, Nature is weaker', up: 'water', down: 'nature' },
  bloom: { id: 'bloom', name: 'Bloom', color: '#FF8FC8', line: 'Nature is stronger, Water is weaker', up: 'nature', down: 'water' },
};
export const SEASON_IDS = Object.keys(SEASONS);

export class Seasons {
  constructor() { this.reset(); }

  reset() {
    this.id = null; // active season id, or null
    this.left = 0;
    this.next = SEASON_EVERY; // match time of the next roll
  }

  // Host: roll on schedule and count down. Returns true when the active season changed.
  update(time, dt) {
    if (this.id) {
      this.left -= dt;
      if (this.left <= 0) { this.id = null; this.left = 0; return true; }
      return false;
    }
    if (time >= this.next) {
      this.id = SEASON_IDS[Math.floor(Math.random() * SEASON_IDS.length)];
      this.left = SEASON_LEN;
      this.next += SEASON_EVERY;
      return true;
    }
    return false;
  }

  // Snapshot field: [index, seconds left] while active, absent otherwise (older guests simply see no event).
  encode() { return this.id ? [SEASON_IDS.indexOf(this.id), Math.round(this.left * 10) / 10] : undefined; }

  // Guest: missing / unknown field means no event. Returns true when the active season changed.
  decode(se) {
    const id = Array.isArray(se) ? SEASON_IDS[se[0]] ?? null : null;
    const changed = id !== this.id;
    this.id = id;
    this.left = id ? Math.max(0, +se[1] || 0) : 0;
    return changed;
  }
}
