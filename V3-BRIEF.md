# Starlane Scuffle v3 brief

Rollback tag already created: `rollback/pre-v3-2026-11-05` (do not recreate).

Repo: `/workspace/projects/starlane-scuffle` (GitHub `mati-sme/starlane-scuffle`, branch `master` → GitHub Pages).
Play URL: https://mati-sme.github.io/starlane-scuffle/
Worker target: `starlane-scuffle.mati-sme.workers.dev` (account subdomain `mati-sme`, account id `e22356da2ed97658e11f8e131a72df71`).
Prior screenshots: `/workspace/test-artifacts/starlane-scuffle/final/` (show plain grey AABB cover boxes on lanes = "strange blocks").
Output screenshots later: `/workspace/test-artifacts/starlane-scuffle/v3/`.

Matias feedback (verbatim): skill ups like Wild Rift over each skill; strange blocks; a bit less Brawl Stars / more realistic; online with son same team or vs; Cloudflare so bad wifi doesn't break it.

## Hard rules for Claude Code sessions
- Do the coding yourself in this repo. Keep diffs focused.
- Kid-safe, mobile-first, no console errors.
- Single-player vs bots must still work fully offline (no Worker required).
- Free Cloudflare tier only. No paid services.
- Do not commit secrets. Do not push until the orchestrator asks (sessions may commit locally).
- Prefer editing existing files; add new modules under `js/net/` and `worker/` as needed.

## Requirement checklist
1. **Wild Rift skill ups**: When a skill point is available, a small `+` button appears directly ABOVE each upgradable Q/E/R skill button. Tap levels that skill. REMOVE the right-edge toggle tab / drawer (`#upgrades` utab/upanel). No pausing. Keep desktop: Ctrl+Q / Ctrl+E / Ctrl+R (or keep 1/2/3) to rank up; drop KeyU drawer toggle.
2. **Strange blocks**: Cover is currently rendered as plain `BoxGeometry` AABBs (`js/world/map.js` `buildCover`) — those grey rectangles on the lane. Replace with readable sci-fi rubble/rock/barrier meshes (or reshape cover so it reads as walls/rocks). Keep collision AABBs. Brush stays bushes. Remove any debug/placeholder geometry.
3. **Art shift (Opus session)**: Slightly more realistic than Brawl Stars — grounded proportions, better shading/lighting, textured terrain, less cartoony — still stylized, readable, kid-safe. Touch `js/render/toon.js`, `js/heroes/models.js`, `js/world/map.js`, lights in `js/render/renderer.js`, palette in `js/config.js` as needed. Do NOT rewrite gameplay.
4. **Online multiplayer on Cloudflare**:
   - Matias + 6yo son on separate phones: same team (co-op vs bots) OR versus (bots fill rest of 5v5).
   - Flow: Create room → short code / share link → friend joins → pick team & champion → start.
   - Worker + Durable Object with **WebSocket hibernation** (`ctx.acceptWebSocket`), auto ping/pong, reconnect resume same slot (player token).
   - Client prediction / interpolation; tolerate packet loss / latency spikes.
   - Server authoritative for lobby + human player inputs/state; bots fill empty slots. Offline SP unchanged.
   - Deploy as worker name `starlane-scuffle`. Client default WS URL `wss://starlane-scuffle.mati-sme.workers.dev/room/{CODE}` (and `?room=CODE` on Pages URL).
5. Tests/screenshots with Playwright into `v3/` (orchestrator may run these).
6. Commit messages clear; orchestrator pushes.

## Architecture notes for multiplayer
Mirror `/workspace/projects/party-games-server/cf-worker/` pattern but WITH hibernation:
- `worker/worker.js` — routes `/` health, `/room/{CODE}` → DO
- `worker/room.js` — `GameRoom` extends DurableObject, hibernation handlers, lobby + match tick
- Protocol JSON: hello/join/create, lobby sync, pick team/hero, start, input (move/aim/attack/cast/spend), snapshot, resume with token
- Client: `js/net/client.js`, lobby UI in `js/ui/menus.js`, wire in `js/main.js` / `js/game/match.js`
- Practical authority model: DO owns lobby; during match DO receives inputs from each human, applies to their hero, runs existing bot AI for empty slots by importing a headless-capable subset OR hosts one "sim host" role where host client runs Match and DO relays guest inputs + host snapshots with host reconnect. **Prefer DO-authoritative human heroes + bots on DO** if feasible by extracting pure update from Match; otherwise use host-sim + DO relay with reconnect tokens and document it. Goal: bad wifi reconnect restores the same slot within ~30s.

## Files you will likely touch
- Skill UI: `js/ui/levelup.js`, `js/ui/abilities.js`, `css/style.css`, `js/core/input.js`, `js/ui/menus.js` (copy), `README.md`
- Blocks/art: `js/world/map.js`, `js/config.js` (ARENA.cover maybe), `js/render/*`, `js/heroes/models.js`
- Net: new `js/net/*`, `worker/*`, `js/main.js`, `js/ui/menus.js`, `js/config.js` (WORKER_URL)
