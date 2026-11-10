# Starlane Scuffle

A sci-fi team-arena brawler for phones and desktops: 5v5 on a three-lane arena, 24 armored champions with portraits, a ban-then-pick draft (every champion unique across both teams), two summoner spells (Flash / Barrier / Ignite), no unlocks.
Built with three.js, no build step. All art, icons and sound are procedural.

## Play

- **Champions:** all 24 are unlocked from the start. Ban one, then pick one on the select screen (no champion appears twice in a match); your last pick is remembered. You get 4 bot allies and face 5 bot enemies. Both teams always have a blaster, a shooter and a support (each pair is split between the teams, your pick stays on Sunny); the melee slots are random. `?hero=<id>` picks your champion and `?bots=a,b,c,...` forces up to 9 ids (4 allies, then 5 enemies).
- **Phone (landscape):** left thumb moves, the big button attacks and auto-aims, the three skill buttons cast Q / E / R. A gold `+` pops up above each skill button that can take a point; tap it to rank up.
- **Desktop:** arrow keys move, right-click walks, `Space` (or left-click) attacks, `Q` `W` `E` `R` cast the four skills (`R` is the ultimate), `1`-`4` rank them up, `Esc` pauses.
- **Skill upgrades:** every level gives a point (max level 9). A small gold `+` appears above each skill button that can be ranked up (Wild Rift style); tap it. On desktop, `1` / `2` / `3` or `Ctrl+Q` / `Ctrl+E` / `Ctrl+R` rank up Q / E / R. Q and E go to rank 4, R to rank 3 (R rank 1 is free at level 3). Rank 2+ adds damage / healing and shortens the cooldown; the max rank adds a perk. Higher ranks need a minimum level (a skill below its gate shows no `+`). Upgrading never pauses the game.

## The match

- **Arena:** 180 x 112 floating island. Three paved lanes (top / mid / bot) run between the bases, linked by the central flux channel and two jungle pockets per side. Cover blocks stop walking and hero shots; brush patches hide a hero from the enemy team unless an enemy is within 3.5 u or the hero just attacked / was hit.
- **Structures:** per team, one outer tower per lane, two guardian towers and a core. Guardians can be hit once any own outer tower is down; the core once both guardians are down (or in Overdrive with one down). Towers (range 9) shoot an enemy hero that just hit an ally hero first, then minions, then heroes. A structure with no enemy minion within 10 u takes 35% damage from heroes. The fountain at each base heals 20% max HP per second and gives a 4 s speed boost on leaving.
- **Waves:** first at 0:15, then every 20 s on all three lanes (3 troopers + 1 gunner; a siege joins every 3rd wave from 2:00). Four Scrap Sentinel camps in the jungle (first at 1:00, respawn 75 s) give 90 XP to the killer's nearby team, a heal and a short speed / attack-speed buff.
- **Pacing:** Overdrive at 5:00 (respawns x0.5, siege damage to structures x2, waves every 15 s with an extra trooper, 1.5x XP). A destroyed core ends the match; otherwise at 8:00 the team that destroyed more structures wins (then structure HP, takedowns, Sunny). Respawn time is 4 s + 1.5 s per level.
- **Bots:** all ten heroes (including the allies) share one brain: lane assignment, retreat to the fountain at low HP, defend, fight when locally stronger, push with minions, stay out of tower range without minions, jungle / roam for the fifth hero. Gloom's bots are slightly slower and weaker on the default difficulty (react 0.55 s, 0.85x damage).
- **HUD:** portrait and a corner minimap at top-left (lanes, towers and cores by team, minions, heroes; enemies are only drawn while visible), kills / clock / structure pips at top-centre.
- Skill presses never fail silently: with no target the skill goes toward your aim / facing, or the skill button shakes and shows "No target" (or "Unlocks at Lv 3").

## Play online (2 humans + bots)

PLAY ONLINE -> CREATE ROOM shows a 4-character code and a share link (`?room=CODE` opens the join flow). Each player bans one champion, then picks Sunny / Gloom, a champion and two summoner spells (picks lock for everyone else): same team = co-op vs bots, different teams = versus; bots fill every side to 5v5. The creator is the sim host (their browser runs the match); the guest sends inputs and mirrors host snapshots, predicting only their own hero. A dropped player resumes the same slot within 45 s. Server and protocol: `worker/README.md`. Local dev: `npx wrangler dev` in `worker/`, then `?ws=ws://localhost:8787`.

## Install the apps

- **Android:** download `starlane-scuffle.apk` from the [latest Release](https://github.com/mati-sme/starlane-scuffle/releases/latest), open it, and allow "install unknown apps" for your browser / file manager when asked. Landscape only; online play works over the internet.
- **Mac (Apple Silicon):** download `Starlane-Scuffle-arm64.dmg` from the same Release, drag the app to Applications. It is unsigned, so the first time **right-click the app -> Open -> Open** (Gatekeeper).
- **Web fallback:** https://mati-sme.github.io/starlane-scuffle/ works in any modern browser (landscape on phones).
- **Online rooms:** unchanged, PLAY ONLINE -> CREATE ROOM and share the code / link (see below).
- iOS: an optional Capacitor project lives in `ios/` (open in Xcode, free personal-team 7-day sideload).

Builds run in GitHub Actions (`build-android.yml`, `build-macos.yml`) on manual dispatch and `v4*` tags. Locally: `npm ci && npm run build:www` bundles `www/` (with three.js vendored), then `npx cap sync android` or `npx tauri build`.

## Run locally

```sh
python3 -m http.server
```

Then open http://localhost:8000.

## GitHub Pages

All paths are relative and `.nojekyll` is included. In the repo settings choose
**Pages → Deploy from a branch → `main` / root**. three.js and the Chakra Petch font load from a CDN (a system font is used if offline).

See `DESIGN.md` for the full design and `NEXT-STEPS.md` for what is left.
