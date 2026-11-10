// End-of-match recap: MVP, damage + KO bars for the player's team and one friendly highlight. Pure (see tests/v86-recap.mjs).
// rows: [{ id, name, team, me, dmg, ko }] for every hero; facts: { win, team (the player's side), destroyed, towersLost, firstStructureTeam, maxBehind, time }.
const score = (r) => r.ko * 100 + r.dmg / 10;

export function buildRecap(rows, facts) {
  const mine = rows.filter((r) => r.team === facts.team);
  const hasStats = rows.some((r) => r.dmg > 0 || r.ko > 0); // online guests get no per-hero numbers
  const mvp = hasStats && mine.length ? [...mine].sort((a, b) => score(b) - score(a))[0] : null;
  const me = mine.find((r) => r.me) ?? null;
  const topDmg = Math.max(1, ...mine.map((r) => r.dmg));
  const bars = mine.map((r) => ({ ...r, dmg: Math.round(r.dmg), pct: Math.round((r.dmg / topDmg) * 100) }));
  return { mvp, bars, hasStats, highlight: pickHighlight(me, facts, mine) };
}

function pickHighlight(me, f, mine) {
  const myKo = me?.ko ?? 0, bestKo = Math.max(0, ...mine.map((r) => r.ko));
  if (f.win && f.maxBehind >= 3) return { id: 'comeback', icon: '🔥', text: `Comeback! You were ${f.maxBehind} KOs behind and still won!` };
  if (f.win && f.towersLost === 0 && (f.destroyed?.[f.team] ?? 0) > 0) return { id: 'wall', icon: '🛡️', text: 'Perfect defense — no towers lost!' };
  if (myKo >= 5) return { id: 'hunter', icon: '🎯', text: `Super hunter — ${myKo} KOs!` };
  if (f.firstStructureTeam === f.team) return { id: 'first-tower', icon: '🏰', text: 'First tower — your team broke through first!' };
  if (myKo >= 1) return { id: 'ko', icon: '💥', text: myKo === 1 ? 'You got a KO!' : `${myKo} KOs — nice moves!` };
  if (bestKo >= 1) return { id: 'team', icon: '🤝', text: 'Great teamwork — your team got KOs!' };
  if (f.win) return { id: 'win', icon: '🏆', text: 'Victory! Your team did it together!' };
  return { id: 'try', icon: '💪', text: 'Good try! Every match makes you stronger.' };
}
