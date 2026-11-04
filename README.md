# Starlane Scuffle

A tiny one-lane toy MOBA for phones and desktops. Built with three.js, no build step.

## Play

- **Phone (landscape):** left thumb moves, big button attacks, small buttons cast skills.
- **Desktop:** `WASD` move, `Space` attack, `Q` `E` `R` skills, `Esc` pause.
- Win a match to unlock the next hero. Progress is saved in your browser.

## Run locally

```sh
python3 -m http.server
```

Then open http://localhost:8000.

## GitHub Pages

All paths are relative and `.nojekyll` is included. In the repo settings choose
**Pages → Deploy from a branch → `main` / root**. three.js and the font load from a CDN.

See `DESIGN.md` for the full design.
