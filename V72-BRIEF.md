# Starlane Scuffle v7.2

WEB ONLY. Push only working, playable stages (Matias and his son may be on the live Pages build). NO Android/Mac builds, NO GitHub Release.
Rollback: `rollback/pre-v7.2-2026-11-06`. Leave V6-BRIEF.md / V7-BRIEF.md untracked.

DONE:
- Stage A + hotfix: stuck movement root cause, resetInput safety net, watchdog, UNSTUCK button, online last-room rejoin, sw.js v7.1.1.

## Hard rules (every stage)
1. Core MOBA mechanics stay exactly the same: nexus vs nexus, three lanes, destroy towers to open the path to the enemy nexus and win. Do not change the game mode, map flow, or win condition.
2. "Distinct" champions = looks, weapons, kits, animations — not a new mode.
3. Visuals: a bit edgier, "like a good game, not like Brawl Stars" — mature, polished, slightly more serious. Still kid-safe: no gore, not as aggressive/gritty as Wild Rift.
4. KEEP MASTER PLAYABLE. Smoke (title → setup/draft → match, movement works) before every push. If mid-rewrite, keep it local.
5. After any web JS change users must pick up, bump `sw.js` VERSION (currently v7.1.1).

## Priority order (this is the remaining work)
1. MATCH SETUP (this session) — Easy/Mid/Hard per bot + flexible team sizes
2. Grown-up visual pass (good-game look, not Brawl Stars) + same-camera before/after in /workspace/test-artifacts/starlane-scuffle/v7.2/
3. 24 NEW champions (48 total), all visually distinct, contact sheet
4. 4 factions × 12 with passives (Light, Dark, Water, Nature)
5. Class / role descriptions on select + info
6. Matchup summary 3 strong vs / 3 weak vs (mini portraits, kit-logic, all 48)
7. Season events every 5 minutes (Snow / Heat / Storm / Bloom, 30–60s, banner+timer+VFX+icons, host-driven online)

Do NOT implement items 2–7 in the match-setup session.

## MATCH SETUP (this session)
After title PLAY (before ban/pick): a kid-friendly Match Setup screen.

Difficulty:
- Easy / Mid / Hard. Mid = current default (today's bot feel).
- Quick global preset that sets every bot.
- Also settable PER bot individually (each bot slot has its own Easy/Mid/Hard).
- Easy must be genuinely gentle for a 4–6 year old: slower reactions (~1.1s+), worse/less frequent skill use, less aggressive (retreat earlier, less diving), noticeably less damage (around 0.65–0.75×). A kid should be able to win and have fun. Hard should feel sharper than Mid, not cheap one-shots.
- Apply per-bot (including ally bots). Today's code only scales Gloom via `settings.stars` + `DIFFICULTY.react/dmg` in `js/game/bot.js` and `hero.js` `outMul` — replace that with a per-hero difficulty.

Team sizes:
- Any number per team from 1 to 5 (1v1, 2v3, 3v4, 5v5, …). Default remains 5v5.
- Assign the player to Sunny or Gloom. Remaining slots are bots.
- `js/game/compose.js` currently fills to 5. `js/game/match.js` `setOnline` uses `me.team * 5 + me.idx` — that WILL break if team sizes change; fix indexing (find heroes by team+idx, never assume 5).
- `assignLanes` must work with fewer heroes (1v1 can share mid; extra roles roam as they already do).
- Unique picks + ban phase still apply (bots take leftovers; bans as today).

Online:
- Host configures setup; guests see a read-only summary.
- Stay compatible: persist setup on the room and include it in start/lobby payloads. Additive protocol only.
- `worker/room.js` `_startMsg()` currently returns only `{ seed, bans, picks }` and ignores extra fields on `start`. You MUST persist `m.setup` and relay it or guests will always get 5v5 Mid.
- Redeploy is done AFTER this session via the Cloudflare connector if you change the worker — write the worker changes; do not leave online 5v5 Mid broken (default setup if `setup` is missing).
- MAX_HUMANS stays 2.

UI:
- Kid-friendly, landscape, big presets, obvious +/- for team size, labeled slots (You / Bot — Easy/Mid/Hard).
- One-sentence help. Default path: Mid, 5v5, player on Sunny.
- Then existing ban → pick → GO. Do not remove bans, unique picks, or summoner spells.
- `data-testid="setup-next"` on the continue button.
- Existing Playwright tests click `play-btn` then a champion card — they will break. Patch them to click `setup-next` when that button is visible (v72-move, v6-aim-touch, v6-ban-pick, v7-lanes, and any other test that goes title → draft). Default setup must keep those tests' assumptions (5v5, player on Sunny, Mid).

New test `tests/v72-setup.mjs`:
- Defaults: Mid 5v5, then draft still works, match starts, player can move.
- Global Easy preset, per-bot Hard on one enemy.
- 1v1 and 2v3 actually spawn those counts.
- Player can be placed on Gloom.
- Ban/pick + unique picks still work after setup.
- No page errors.

When the feature works and tests pass: bump sw.js (v7.1.2), commit `v7.2: match setup (per-bot difficulty + flexible team sizes)`, PUSH master.
Write /tmp/v72-setup-done.txt (what changed, how Easy differs, online/protocol notes, test results).
Do not bump the app to 7.2.0 yet. Do not touch visuals/champs/factions/seasons.
