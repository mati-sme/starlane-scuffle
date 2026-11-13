# Starlane Scuffle v7

Rollback: `rollback/pre-v7-2026-11-06` (pushed). XP curve unchanged. Keep v6: drag-aim (skills + AA), multitouch, unique picks, bans, summoners, recall, gear, bosses, online Worker.

Matias: take the hours needed; finish and polish for good. Recurring complaints to also beat: aesthetics still too basic; can't see attacks/skill animations; champions look alike; support follows him; aim visibility.

## Stages
- **A (Sonnet) MAP + AI**: Stop ally support following the player (support stays on assigned bot lane with its wave, never chases the human). Proper 3-lane bot assignment (top melee, mid mage/blaster, bot ADC+support independently of player position; roam optional). Add 3 towers PER LANE before nexus guardians: outer (existing), inner (new, between outer and nexus), inhibitor (new, nearer nexus). Keep the two nexus guardian towers + core. Gating: lane towers sequential (can't skip); guardians exposed after nearby inhibs (or after all 3 inhibs — pick a readable Wild Rift-like rule); nexus after both guardians. Rebalance HP so matches still ~10–15 min. Push master. Screenshot `v7/map-3lanes.png`.
- **B (Sonnet kits + models)**: Completely redesign all 24 champions — unique skills, silhouettes, colors, VFX, animations; none similar. Keep 4 per role (tank/bruiser/assassin/blaster/shooter/support). Kid-safe. New names OK if clearer. Bots still pick leftovers. Push.
- **C (Opus art)**: Visual detail jump (lighting, materials, terrain, props, VFX readability — attacks must be obvious). Redo all 24 portraits to match new designs (select, lobby, HUD). Screenshots: champ-select-portraits, teamfight-vfx. Push.
- **D (Sonnet self-review)**: Screenshot review vs EVERY v7 ask + recurring complaints; fix remaining same-y champs / invisible skills / follower AI / basic look. Push.
- **E (Sonnet)**: Playwright (existing + new lanes/towers/support-AI) once; version 7.0.0; tag v7.0.0; GH Actions APK+DMG Release; verify Pages + Worker.

## Notes
- Current map: 1 outer/lane + 2 shared guards + core. Target: outer+inner+inhib per lane (9) + 2 guards + core.
- Support follow lives in `js/game/bot.js` `_laneGoal` ("stay with the lane partner").
