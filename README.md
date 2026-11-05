# Starlane Scuffle

A sci-fi team-arena brawler for phones and desktops: 2v2 on a compact one-lane map, 12 armored champions, no unlocks.
Built with three.js, no build step. All art, icons and sound are procedural.

## Play

- **Champions:** all 12 are unlocked from the start (Bulwark, Magnus, Torque, Corsa, Glint, Volt, Cinder, Prism, Kade, Flint, Aria, Tempo). Pick one on the select screen; your last pick is remembered. The three bots take random other champions.
- **Phone (landscape):** left thumb moves, the big button attacks and auto-aims, the three skill buttons cast Q / E / R. The tab on the right edge opens the upgrade drawer.
- **Desktop:** `WASD` / arrows move, right-click walks, `Space` (or left-click) attacks, `Q` `E` `R` cast skills, `Esc` pauses.
- **Skill upgrades:** every level gives a point (max level 9). `U` toggles the upgrade drawer; `1` / `2` / `3` rank up Q / E / R directly. Q and E go to rank 4, R to rank 3 (R rank 1 is free at level 3). Rank 2+ adds damage / healing and shortens the cooldown; the max rank adds a perk. Higher ranks need a minimum level (the drawer shows it). Upgrading never pauses the game.

## Run locally

```sh
python3 -m http.server
```

Then open http://localhost:8000.

## GitHub Pages

All paths are relative and `.nojekyll` is included. In the repo settings choose
**Pages → Deploy from a branch → `main` / root**. three.js and the Chakra Petch font load from a CDN (a system font is used if offline).

See `DESIGN.md` for the full design and `NEXT-STEPS.md` for what is left.
