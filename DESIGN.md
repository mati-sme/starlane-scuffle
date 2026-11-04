# Starlane Scuffle — Design

A tiny, bright, one-lane MOBA for a 6-year-old. Matches run 5–8 minutes on a phone held sideways. It is real 3D in three.js and should look like a toy diorama floating in space, not a flat 2D web game.

**Pillars:** *Instantly readable* (shape and color carry the meaning, almost no text) · *Juicy* (every tap gets a pop, sparkle, or boing) · *Never scary* (defeated units poof into stars; no blood, no "death" wording) · *Short and winnable*.

---

## 1. Match Rules

- **Map:** one straight lane on a floating island, 120 × 14 world units. The player's base is at x = −60 and the enemy base at x = +60.
- **Per side:** an Outer Tower (x = ±20), an Inner Tower (x = ±40) and the Core (x = ±54). A tower can only be hit once the tower in front of it has fallen. The Core can only be hit once both towers are down.
- **Teams:** player + 1 friendly bot (**Team Sunny**, cyan) vs 2 enemy bots (**Team Gloom**, coral). Bots pick from the heroes the player didn't take.
- **Waves:** every 25 s, 3 **Bloblings** (melee) + 1 **Zapper** (ranged) per side. From 3:00, every third wave adds a **Big Blob** (siege, bonus damage to towers).
- **Pacing guarantee:** at **6:30, Starstorm** begins. Core shields drop, minions deal double damage to structures, and respawn timers are halved. In playtests this should end every match by about 8:00. If neither Core falls by 8:30, the side with more towers standing wins. Ties go to the player.
- **Respawn:** 4 s + 1 s per level, shown as a filling star ring. The hero beams back in at base with a light column.
- **Win/Lose:** destroy the enemy Core. A loss screen is still cheerful ("Good try!", icon only).
- **Difficulty:** 1–3 stars, picked in settings. Changes bot reaction time (0.8 / 0.5 / 0.3 s), bot damage (70 / 85 / 100 %) and how well bots focus targets.

## 2. Controls & Auto-Aim

**Touch (landscape):**
- **Left 45% of the screen** is a floating joystick that appears wherever the thumb lands. The base is 140 px, the knob 64 px, and it has a 12 px dead zone.
- **Right side:** a big **Attack** button (120 px). Holding it keeps auto-attacking.
- **Skill 1 / Skill 2** buttons (88 px) sit on an arc around Attack. **Ult** (104 px) sits top-left of the arc and glows gold when ready.
- A settings toggle swaps sides for left-handed players.

**Keyboard/mouse:**
- WASD or arrow keys to move. Right-click the ground to walk there.
- Space or J to attack (hold to keep attacking). Q / E for skills, R for ult.
- 1 / 2 picks a level-up card. Esc pauses.

**Auto-aim (everything is auto-aimed, nothing needs aiming):**
- **Target priority inside range:** an enemy hero that hit you in the last 2 s → the lowest-HP enemy hero → the nearest minion → a tower (only if it isn't attacking you).
- Skills aim at the best cluster: the point with the most enemies within 3 u. If nothing is in range, they fire toward the joystick or facing direction.
- The current target gets a bouncing coral chevron above it. The player always knows what will get hit.
- **Tower safety:** under an enemy tower, its range ring pulses coral and a "!" icon appears on the player if the tower targets them.

## 3. Heroes

All four are original and built procedurally (see §5). Each has a basic attack, 2 skills, and an ult that unlocks at level 3 with a fanfare.

| Hero | Look / role | Basic | Skill 1 | Skill 2 | Ult |
|---|---|---|---|---|---|
| **Zip** — Comet Fox | Orange fox with a glowing comet tail and flight goggles. Fast fighter. | Tail swipe (melee, 2.2 u) | **Streak Dash:** dash 6 u through enemies, damaging them | **Spin Flurry:** 1.2 s spin that hits everything nearby | **Meteor Pounce:** leaps onto the best target, big crater hit + knock-up |
| **Moss** — Grove Bear | Chunky moss-green bear with stone shoulders and flowers on its head. Tank. | Paw bonk (melee, 2 u, small splash) | **Vine Grab:** pulls the nearest enemy hero in and stuns 0.8 s | **Bark Shield:** shield + slow aura for 3 s | **Grove Quake:** 3 shockwave rings that root enemies 1.2 s |
| **Luma** — Star Bunny | Lilac bunny mage with a star wand and a little cape. Ranged burst + heal. | Star bolt (ranged, 7 u) | **Twinkle Burst:** star bomb, AoE at the target cluster | **Hop Blink:** short teleport back + heals nearby allies | **Shooting Star Shower:** 8 stars rain over a 5 u area |
| **Clink** — Robo-Penguin | Navy robot penguin with a teal visor and a backpack snow cannon. Ranged pusher. | Snowball cannon (ranged, 6.5 u) | **Frosty Turret:** drops a turret for 6 s | **Belly Slide:** slides forward, knocking enemies aside | **Mega Snow Beam:** 2 s sweeping beam that slows and hits hard |

**Signature VFX per hero (all additive particles plus a few meshes):**
- **Zip:** an orange→yellow ribbon trail (pooled strip of 16 segments) follows the tail and the dash. Spin Flurry is a flat ring of crescent sparkles. Meteor Pounce draws a shooting-star arc, then leaves a crater decal that fades over 1.5 s with an ember burst.
- **Moss:** green leaf particles (diamond quads that flutter). Vine Grab is a tapered tube that grows from Moss to the target. Bark Shield is a hex-faceted icosahedron bubble with a fresnel shell. Grove Quake is 3 expanding ground rings plus pop-up low-poly flowers that shrink away.
- **Luma:** pink/white 5-point stars and a sparkle twinkle. Hop Blink leaves an afterimage outline at the old spot plus rising hearts. Shooting Star Shower is streaks falling at 30°, each with an impact star-burst.
- **Clink:** teal snowflakes and puffs of frost. Frosty Turret is a mini model built from 6 primitives. Mega Snow Beam is a scrolling-UV cylinder beam with a frost decal along its path.

**Shared numbers (tuning lives in `config.js`):** about 600 HP at level 1, +12% per level. Skill cooldowns 5–9 s; ult 35 s. Max level 8. XP comes from minions dying nearby (6 u) and from hero takedowns.

## 4. Level-Up: Pick 1 of 2

- On level-up the world slows to 20% for at most 6 s. Two big cards (160 px) pop in on springs above the skill buttons. If the player doesn't pick in time, the left card is chosen automatically.
- Each card is an icon plus a pip showing how many times that upgrade is already owned. There is no text.
- **Pool:** each hero has upgrades for its basic and its 2 skills (e.g. Zip "Dash ×2 charges", Luma "Bigger Burst"). There are also generic upgrades: Speed Boots, Big Heart (+HP), Sharp Claws (+dmg), Quick Hands (cooldowns −15%).
- Two cards never repeat the same upgrade. At least one card is hero-specific.
- **Level 3** unlocks the ult instead of showing cards: the button slams in with a gold shockwave and a chime.

## 5. Art Direction

**Look:** toon-shaded toys on a floating island in a purple nebula.
- Chunky low-poly primitives with soft-plum ink outlines.
- Big round eyes and strong silhouettes, colors saturated but not neon.
- References for *feel only* (no copied assets): Brawl Stars readability, Kirby softness, Spyro-era skies.

### Palette (exact)
| Role | Hex |
|---|---|
| Void sky top / bottom | `#140F3A` / `#3B2A7A` |
| Nebula wisps | `#7A4FD1`, `#C25BD6` |
| Starfield / gold sparkle | `#FFF4C2` / `#FFD23F` |
| Island grass light / dark | `#8EE36A` / `#4FB35A` |
| Lane stone / lane glow tiles | `#F2D9A6` / `#FFE98A` |
| Cliff rock light / dark | `#9C7FD0` / `#5B3F8C` |
| Team Sunny (friendly) main / deep | `#36C5F0` / `#1A6FB0` |
| Team Gloom (enemy) main / deep | `#FF5D73` / `#B0284A` |
| Player highlight ring | `#FFD23F` |
| Heal / shield | `#5BE584` / `#9FE8FF` |
| Outline ink | `#23163A` |
| UI panel / UI text | `#23163A` @ 85% / `#FFFFFF` |
| Zip / Moss / Luma / Clink body | `#FF8A3D` / `#6DBF4B` / `#C59BFF` / `#2F4A7A` |

**Teams are readable without color too:** friendly units wear a rounded halo/antenna ball, enemy units wear two little horn nubs. Enemy health bars also carry a small spike icon.

### Shading
- Every lit object uses `MeshToonMaterial` with one shared 3-texel `gradientMap` (values 0.45 / 0.75 / 1.0, `NearestFilter`).
- A fresnel rim term is added through `onBeforeCompile`: color `#FFF4C2`, strength 0.35, power 2.5. This lifts silhouettes against the dark void.
- Hit flash: a uniform `uFlash` mixes the color toward white. Heroes get it per-material clone; minions get it per-instance through `instanceColor`.
- Renderer settings: `NoToneMapping`, sRGB output, and linear `Fog` at 45–110 u in `#2A1F5E` so the far lane melts into the nebula.

### Outlines
- Use the inverted-hull method: a second mesh with `BackSide` and an unlit `#23163A` material, with its vertices pushed along their normals in the vertex shader.
- Thickness is 0.035 u for heroes, towers and Core, and 0.025 u for minions. Props get no outline (keeps the draw-call budget).
- Hero parts are merged per material, so the outline is one extra draw call per hero.

### Procedural models (three.js primitives only, no model files)
- **Heroes:** 10–16 primitives each (spheres 12×8, capsules, cones, tori, an extruded 5-point star). Merged with `BufferGeometryUtils.mergeGeometries` into 2–3 meshes (body, emissive bits, eyes). Each hero is 1.5–3k tris.
  - **Eyes:** white sphere, dark pupil, tiny highlight sphere. Blinks are done with scale.y.
  - **Animation is fully procedural:** idle bob, squash-and-stretch on each step (sin of distance traveled), lean into movement, lunge on attack, a 0.15 s anticipation crouch before skills, and a victory hop.
- **Bloblings:** a squashed gumdrop sphere in the team color, eyes, and a halo or horns. They jiggle with a sine scale wobble.
- **Zappers:** a floating jellyfish lantern (cone + emissive sphere + 3 swaying capsules).
- **Big Blob:** a 1.8× Blobling with a crown of 5 cones.
- **Towers:**
  - **Body:** a stacked 6-sided tapered cylinder with a stone base, a team-color band, and a cloth banner (a plane with vertex sway).
  - **Top:** an emissive octahedron crystal that spins and bobs.
  - **Shots:** arcing orbs with a trail.
  - **Damage states:** cracks appear (a darker tint) at 66% and 33% HP.
  - **Destroyed:** the crystal shatters into 12 shards and the stump stays.
- **Core:** a large icosahedron crystal (detail 0) floating over a ring dais, with 6 orbiting shards and a fresnel shield bubble that drops during Starstorm.
- **Map:**
  - **Lane and island:** the lane is cream stone tiles. A center row of glowing "starlane" tiles pulses toward whichever side is winning the push. Grass shoulders sit on either side, and the island edges are faceted purple cliffs falling into the void.
  - **Props:** instanced cone trees, mushrooms, crystal clusters, and floating rocks that drift and rotate.
  - **Sky and background:** a gradient sky sphere (shader), a nebula of 3 big additive billboard quads, a 1,200-point starfield, and 2 distant ringed planets.

### Camera
- Perspective camera, FOV 38. It sits at an offset of (−7, 20, 15) from the hero, about 52° pitch. The yaw places the lane running from lower-left to upper-right.
- Follows the hero with a damped lerp (k = 6/s) and leads 2 u in the move direction.
- Shake comes from a 1D-noise offset budget: 0.15 u on a hero hit, 0.4 u on ults and tower kills.
- On narrow phones (aspect < 1.9) it zooms out slightly.

### Lighting
- `HemisphereLight` (sky `#BFD9FF`, ground `#5B3F8C`, 1.1) plus one warm `DirectionalLight` (`#FFE8C2`, 1.6, from (−0.5, 1, 0.3)).
- **No real-time shadows.** Units get soft **blob shadows** instead: a radial-gradient plane, alpha 0.35, scaled with jump height.
- Emissive crystals fake glow with an additive halo sprite (no post-processing bloom).

## 6. Particles, VFX & Hit Feedback

- **One pooled particle system:** a single `THREE.Points` object with a custom shader that reads from a 4-frame canvas-generated atlas (soft dot, 5-point star, 4-point sparkle, ring). Additive blending, max 1,500 live particles, 1 draw call. Attributes: position, velocity, color, size, life, frame.
- **Mesh VFX** (rings, beams, bubbles, trails) come from pools of shared geometries with additive `MeshBasicMaterial`s, capped at about 20 live.
- **Hit feedback stack, on every hit:**
  - 0.08 s white flash and a 1.15 squash pulse.
  - 0.3 u knockback nudge (minions only).
  - 6 sparkles in the attacker's color.
  - A "tick" SFX pitched to the damage amount.
- **Extra feedback on player hits against heroes:**
  - 40 ms hit-stop.
  - A small camera shake.
  - `navigator.vibrate(12)` where supported.
- **Big hits** (≥ 15% of max HP): a chunky damage number in a rounded font, white with an ink outline, that pops and floats. Numbers are the only in-world text, and they can be turned off.
- **Defeat poof:** the unit swells to 1.2× over 0.1 s, then shrinks to 0 over 0.15 s. Then it releases:
  - A burst of 18 (minion) or 40 (hero) gold and white stars, plus a ring shockwave.
  - Gold "XP motes" that home onto nearby heroes, with a soft chime when they land.
- **Takedown banner:** a top-center pop of [killer portrait] ⭐ [victim portrait], gone after 2 s.
- **Ambient effects:** fireflies over the grass, tiny floating sparkles, and the lane tiles' pulse.

## 7. HUD & Screens

UI is a DOM/CSS overlay above the canvas, which keeps it crisp and cheap. Icons are inline SVG from `js/ui/icons.js`. The font is "Baloo 2" (Google Fonts) with fallback `ui-rounded, system-ui`. Everything uses chunky rounded shapes, 4 px ink borders and a drop "toy" shadow. Tap targets are at least 64 px. Content respects `env(safe-area-inset-*)`.

**In-match HUD:**
- **Top-left:** hero portrait in a circular HP ring (team color), a level badge, and an XP arc.
- **Top-center:** a **lane bar** with tower and Core icons for both sides, colored dots for heroes, and minion wave blips. It acts as the minimap. Below it is the match timer as a pie-clock icon, which turns into a star-storm icon at 6:30.
- **Top-right:** pause button (56 px).
- **Bottom-left:** the joystick (translucent, shown on touch only).
- **Bottom-right:** the ability cluster. Cooldowns show as a radial dark wipe with a big single digit for the last 3 s. A "ready" state triggers a bounce, a shine sweep and a soft ding.
- **Over units:** pill health bars.
  - Heroes: 70 px, segmented every 100 HP, with a level pip.
  - Minions: 34 px, and only shown once damaged.
  - The player's own bar has a gold rim.

**Screens:** every transition is a 250 ms spring scale plus fade.
1. **Title:** a 3D shot of the island with all 4 heroes idling on a rotating turntable, a giant pulsing PLAY star button, and small sound/settings icons.
2. **Hero Select:** 4 big portrait cards. Tapping one makes that hero jump forward in 3D and do its ult pose (with sound). A big ✔ confirms.
3. **VS Splash:** 1.5 s, the player's team on the left and the enemy on the right, with a comet whoosh.
4. **Pause:** icons only (resume ▶, sound 🔊, settings ⚙, home ⌂) on a dimmed blur.
5. **Results:**
   - **Victory:** confetti, fireworks over the shattered enemy Core, and 1–3 stars (win / +no tower lost / +under 6 min).
   - **Defeat:** the hero waves, "Good try!" shown as an icon + a smile, and a retry button.

**First match only:** ghost-hand hints (an animated SVG hand) show *drag here → tap here → tap a glowing skill*. They disappear after each one is done once.

## 8. Sound (WebAudio synth, no audio files)

- `audio.js` creates the `AudioContext` on the first user gesture and runs master → (music, sfx) gain buses into a light `DynamicsCompressor`.
- **SFX recipes** are oscillator(s) + an ADSR gain envelope + an optional biquad filter + a shared 1 s white-noise buffer:
  - **Hit "tick":** triangle wave, 600→300 Hz, 60 ms.
  - **Poof:** noise through a bandpass sweeping 2k→6k Hz, 150 ms, plus a sine sparkle arpeggio (C6-E6-G6).
  - **Level-up:** a major-pentatonic run up over 0.4 s.
  - **Ult:** a detuned saw swell into a sub-thump.
  - **Tower shot:** square-wave blip with downward pitch.
  - **Core shatter:** a noise crash with a long chime tail.
- **Each hero has its own timbre:** Zip uses bright square waves, Moss low sine thumps, Luma bell FM (sine carrier with a 3.5× modulator), Clink bitcrushed triangles.
- **Music:** a lookahead step sequencer (100 ms scheduler, 25 ms tick) at 112 BPM in C major pentatonic: bass, an arpeggio and a soft pad. At 6:30 (Starstorm) it adds a hi-hat layer and +8 BPM. Victory and defeat each get a 4-bar jingle.
- **Limits:** at most 24 simultaneous voices (oldest dropped). The same SFX can't retrigger within 30 ms. Music ducks −6 dB during ults.

## 9. Performance Budget (mid-range phones, e.g. Galaxy A52, iPhone 11)

| Budget | Target |
|---|---|
| Frame rate | 60 fps; drop to a 30 fps cap if the average frame time is > 22 ms for 3 s |
| Draw calls | ≤ 120 in a typical scene (≤ 150 at peak) |
| Triangles on screen | ≤ 80k |
| Materials | about 15, shared; no per-frame material creation |
| Textures | only the gradient map, particle atlas, blob shadow and sky gradient (all generated on canvas, each ≤ 256 px) |
| Live particles | ≤ 1,500 (1 draw call) |

**Techniques:**
- **Minions:** `InstancedMesh` per team per type (body + outline + eyes). That is 3 draw calls covering up to 32 minions per team.
- **Static map:** merged by material into fewer than 10 meshes; trees and rocks are instanced.
- **Pixel ratio:** `min(devicePixelRatio, 2)`, plus dynamic resolution scaling between 0.6 and 1.0 driven by a rolling frame-time average. Antialiasing is on only when DPR < 2.
- **Pooling:** projectiles, VFX meshes, damage numbers, minions and health-bar DOM nodes are all pooled. Nothing is allocated in the hot loop (reuse scratch vectors).
- **Logic:** fixed 30 Hz simulation step with interpolated rendering. Units are culled for AI work beyond 30 u from any hero.
- **Lifecycle:** pause on `visibilitychange`. Show a "rotate your phone" overlay in portrait.

## 10. Code & File Structure

This is a static site with no build step and no npm. Serve the folder (e.g. `python3 -m http.server`) and open `index.html`. three.js is pinned and loaded through an importmap:

```html
<script type="importmap">
{ "imports": {
  "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
  "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/" } }
</script>
<script type="module" src="js/main.js"></script>
```

```
index.html            canvas + UI overlay roots + importmap
css/style.css         HUD, menus, buttons, joystick, safe areas
js/main.js            boot, screen state machine (title → select → vs → match → results)
js/config.js          palette, tuning numbers, budgets (single source of truth)
js/core/              loop.js (fixed step), input.js (touch/keys/mouse → intents),
                      audio.js (synth + sequencer), pool.js, rng.js, math.js
js/render/            renderer.js (setup, DPR scaling), toon.js (gradient map, rim,
                      flash, outline hull), camera.js, particles.js, vfx.js, atlas.js
js/world/             map.js (island, lane, props, sky), tower.js, core.js, minions.js
js/heroes/            hero.js (base: stats, move, cooldowns, anim), models.js (builders),
                      zip.js, moss.js, luma.js, clink.js (abilities + VFX hooks)
js/game/              match.js (waves, timer, Starstorm, win), combat.js (damage, flash,
                      poof), targeting.js (auto-aim), levelup.js (card pool), bot.js (AI)
js/ui/                hud.js, menus.js, joystick.js, cards.js, icons.js (inline SVG)
```

**Conventions:**
- ES modules with named exports. Each hero file exports `{ id, stats, buildModel, abilities }`.
- Game logic never touches the DOM directly; it emits events through a tiny event bus that `ui/` and `audio.js` subscribe to.

**Bot AI** (`bot.js`) is a utility-scored state machine with these states, re-evaluated every 0.25 s:
- **Farm:** stay behind friendly minions.
- **Fight:** engage when hero HP is ≥ 50% and the bot has the advantage.
- **Retreat:** fall back below 30% HP.
- **Push:** hit the tower when friendly minions are tanking it.
- **Ult:** fire when ≥ 2 targets are in range or the target is below 40% HP.
