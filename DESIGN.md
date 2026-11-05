# Starlane Scuffle — Overhaul Design (v2)

The v1 one-lane toy MOBA (cute animals, 2v2, modal level-up cards, unlocks) is preserved in git history. This spec replaces it.
It is the single source of truth for the overhaul. Tuning numbers move into `js/config.js` and `js/heroes/roster.js`.

## 1. Product Pillars

- **Heroic sci-fi sport.** Armored champions compete in an orbital arena called the *Starlane*. It feels like a televised sport, not a playground.
- **Punch and clarity.** Every attack has a windup, a hit flash, an impact ring and a number. You can always tell who hits what, from how far, and what's about to land.
- **Fair 5v5.** Both teams always have the same role structure: a frontliner, a melee threat, an AOE blaster, a ranged shooter and a support. Nothing is locked.
- **Agency without pauses.** XP visibly becomes skill points. You spend them in a small edge drawer while the game keeps running.
- **5–8 minute matches** on a landscape phone, with full keyboard parity.

**Remove all preschool/cute cues:**
- Big round eyes and pupils, animals (fox, bear, bunny, penguin), baby proportions and squash-bounce walks.
- Flowers, petals, hearts, star wands, "toy" gumdrop/jellyfish minions and pastel purple nebula skies.
- Rainbow confetti, the "Good try!" smiley, the Baloo rounded font, and 5-point-star particles as the default spark.

**What replaces them:**
- Helmets with glowing visor slits.
- Angular armor plates, weapons and pauldrons.
- Steel and concrete arena surfaces with team light strips.
- A condensed sporty font (**Chakra Petch** 600/700, free OFL, Google Fonts; fallback `system-ui`).
- Plain words a child can read: **BLUE · RED · VICTORY · DEFEAT · KO**.

## 2. Visual Bible

**Palette (exact):**

| Role | Hex |
|---|---|
| Sky top / horizon | `#05070D` / `#121A2B` |
| Fog | `#0E1420` (linear 45 → 110) |
| Deck plates A / B | `#262D3A` / `#2C3444` |
| Lane surface | `#4B5568` |
| Center line | `#E8F0FF` |
| Cover concrete / top / hazard band | `#4A5468` / `#5A6478` / `#F2B33D` |
| Brush reeds | `#1E6F5C`, tips emissive `#39F2B5` |
| Outer wall | `#1A202B` |
| **BLUE team** main / deep | `#2E9BFF` / `#1456B8` |
| **RED team** main / deep | `#FF3B4A` / `#A3142A` |
| Player highlight | `#FFC93C` |
| Heal / shield | `#3EE89A` / `#8FE3FF` |
| Stun / slow | `#FFE14D` / `#9FE8FF` |
| Outline ink | `#0B0E14` |
| UI panel | `#0E1420` @ 88% |
| UI text | `#FFFFFF` |
| UI stroke | `#0B0E14` |

**Materials and lighting:**
- Keep `MeshToonMaterial`, the inverted-hull outline and the rim term from `render/toon.js`.
- Change the gradient map to 3 steps of 0.38 / 0.70 / 1.0 for harder, more heroic shading.
- Rim color `#CFE3FF`, strength 0.3.
- Outline: 0.04 u on heroes and structures, 0.025 u on minions.
- Emissive parts (visors, trims, crystals, projectiles) use unlit `MeshBasicMaterial`. There is no bloom; a fake additive halo sprite is allowed on crystals only.
- Lights: `HemisphereLight(#CFE3FF, #1A2030, 0.9)` plus key `DirectionalLight(#FFF1DC, 2.0)` from (−0.4, 1, 0.35). No realtime shadows; use the existing instanced blob shadows.

**Geometry language:** angular low-poly.
- Use 6-sided cylinders, boxes, octahedra and cones. Spheres only for joints.
- Heroes are 2.3–2.8 u tall with heroic proportions: helmet ≈ 1/5.5 of height, V-torso, shoulders 1.1–1.8 u wide, visible capsule legs with box boots.
- No eyes or mouths. Each helmet has one emissive **visor slit** in the team color.

**Team readability (works without color, too):**
- **Armor color = champion identity. Visor, shoulder band and ground ring = team color.** This keeps one champion readable on either team.
- Allies get a solid ground ring (r 0.9). Enemies get a ring with 4 bracket notches.
- The player gets a gold ring plus a gold-rimmed HP bar.
- Enemy HP bars have angled ends; ally bars are rounded.

**Camera:**
- Perspective camera, FOV 40, offset (0, 24, 13) from the hero (~62° pitch).
- Lanes run left↔right on screen. BLUE is always on the left, and screen-up = −z.
- Follow damp k = 6/s with a 3 u lead in the move direction. Multiply the offset by 1.08 when aspect < 1.9.
- Clamp the focus to the map bounds.
- Shake budget: 0.12 u (player hit), 0.35 u (ult), 0.5 u (structure down).
- Player ult: FOV punch −3° for 0.2 s.

**Map surface:**
- Deck: one 256² canvas tile texture (2 u plates, thin seams), repeat-wrapped.
- Lanes: separate strip meshes, 10 u wide, with emissive edge lines (blue tint for x < 0, red tint for x > 0).
- Center line at x = 0: glowing white, pulsing toward the pushing side (reuse `push`).
- Cover: barriers 1.4 u tall and pillars 3 u tall, with a hazard band baked into vertex colors.
- Brush: one `InstancedMesh` of reed cones (0.9–1.4 u) for the whole map. A shader uniform fades reeds to 35% within 3 u of the player.
- Outside the wall: the dark gradient sky, one desaturated ringed planet and a 600-point starfield.

**Telegraphs and windups:**
- Every AOE or delayed skill shows a ground decal (fill + edge ring) for its full delay:
  - enemy cast: red, fill α 0.22
  - ally cast: blue, α 0.15
  - own cast: white, α 0.18
- Windups: melee basic 0.12 s (lean back, then 0.3 u lunge); ranged basic 0.08 s muzzle flash plus 0.12 u recoil and −8° weapon kick.
- Skills have a 0.15 s pose. Ults have a 0.25 s pose with a team-color light pillar.

**Hit feedback stack:**
- 0.06 s white flash (mix 0.8).
- Recoil: 0.15 u for heroes, 0.3 u for minions.
- Pooled impact ring: scale 0.3 → 1.2 u over 0.2 s, attacker team color.
- 6 spark/shard particles.
- 40 ms hit-stop when the player hits a hero, 70 ms on ult hits. `navigator.vibrate(12)` on player hero hits.

**Trails:**
- Projectiles are stretched streak quads (1.2 u) in the champion accent color.
- Dashes reuse the pooled 16-segment ribbon.
- Leaps draw an arc plus a landing ring.

**Damage numbers** (pooled DOM, ≤ 24 live; hits on one target within 0.2 s merge):
- Chakra Petch 700 italic, white with a 3 px ink stroke.
- 24 px on heroes; 30 px gold when ≥ 150.
- Damage taken by the player in `#FF5A5A`; heals `#3EE89A` "+N".
- Minion numbers only when the player deals them.
- Pop from 1.25× to 1 in 80 ms, rise 28 px over 0.6 s.

**KO flow:**
1. 0.1 s white flash, then the model scales down into 14 team-color shards plus a 0.6 s light column ("warp-out", no gore).
2. A top-center **KO** banner shows the killer portrait → victim portrait for 2 s.
3. Respawn takes 5 + 1.5 × level s (max 18), halved in Overdrive.
4. While the player is down: dark vignette, a big countdown, and the camera eases to their base. Respawning heroes beam in on their spawn pad.

**Mobile budgets:**

| Budget | Limit |
|---|---|
| Draw calls | ≤ 140 |
| Triangles | ≤ 120k |
| Per hero | ≤ 3.5k tris and ≤ 5 draw calls (body+outline, visor, 2 legs) |
| Particles | ≤ 1,500 (1 draw call) |
| VFX meshes | ≤ 32 live |
| Projectile pool | 96 |
| DPR | ≤ 2, with existing dynamic resolution 0.6–1.0 |

- Minions are `InstancedMesh` per team per type.
- Ground rings and blob shadows are one `InstancedMesh` each.
- Hero geometry is built once per champion+team and cached.
- No allocation in hot loops.

## 3. Champions (12, all unlocked)

**Combat model:**
- 3 skill slots: Q = skill1, E = skill2, R = ult. Plus a basic attack.
- Every skill is a **kind** from the shared vocabulary: `bolt` (count/spread/pierce), `dash`, `leap`, `blink`, `nova`, `cone`, `blast` (targeted delayed AOE), `rain`, `buff` (shield/heal/speed), `hook`, `field` (persistent zone), `turret`, `beam`.

**Ranks and levels:**
- Q/E max rank 4; R max rank 3. Each rank above 1 adds +20% dmg/heal/shield and −8% CD.
- Each skill's **perk** (→) switches on at its max rank.
- Every level adds +5% to all damage. HP growth is per champion.

**Pairs:** the 18 champions form 6 roles of 3 (A/B/C). See §5 for team composition.

**Range bands:** melee 2–3 u · mid 6–6.5 u · ranged 7–8.5 u · towers 9 u. No hero outranges a tower.

**TANK** — *Bulwark (A) / Magnus (B)*

**1. BULWARK — "The Iron Wall"**
- **Look:** gunmetal `#6E7C91` / bronze `#B07A3A`. Widest shoulders (1.8 u), a tower shield on the left arm taller than the helmet, flat-top helmet with a horizontal visor.
- **Stats:** HP 1100 (+90/lv) · Spd 6.0.
- **Basic — Shield Bash:** melee 2.2 u, 46 dmg / 0.9 s, 100° cleave.
- **Q — Ram Charge** `dash`: 7 u, 60 dmg, knock aside 2 u. CD 8. → stun 0.6 s at the end.
- **E — Aegis Wall** `buff`: shield 200 on self and 120 on allies within 5 u for 3 s. CD 12. → shielded allies get +25% speed.
- **R — Fortress Drop** `leap`: 8 u, nova r4, 150 dmg + stun 1.0 s. CD 45. → leaves a 3 s field (r4) that slows 40%.

**2. MAGNUS — "Gravity Anchor"**
- **Look:** royal purple `#5B3FA8` / glow `#CDB8FF`. Huge right gauntlet holding an orb, a gravity ring (torus) floating behind the back, domed helmet.
- **Stats:** HP 1050 (+85/lv) · Spd 5.8.
- **Basic — Grav Fist:** melee 2.4 u, 44 dmg / 1.0 s, slows 20% for 0.5 s.
- **Q — Tether Hook** `hook`: 8 u. Pulls the first enemy hit 5 u toward Magnus, 50 dmg, stun 0.5 s. CD 9. → range 10, stun 0.9 s.
- **E — Mass Field** `field`: r4 around self for 3 s, slows 35%, 25 dmg/s, Magnus takes −25% damage. CD 11. → allies inside also take −15%.
- **R — Singularity** `blast`: at a cluster ≤ 8 u, 0.6 s telegraph, pulls enemies within 5 u to the center, 160 dmg + stun 0.8 s. CD 45. → radius 6.5.

**BRUISER** — *Torque (A) / Corsa (B)*

**3. TORQUE — "Piston Brawler"**
- **Look:** safety orange `#FF7A1A` / black steel `#2A2D33`. Oversized hydraulic gauntlets, forward hunch, twin exhaust stacks.
- **Stats:** HP 950 (+80/lv) · Spd 6.2.
- **Basic — Piston Punch:** melee 2.2 u, 58 dmg / 0.85 s. Every 3rd punch knocks back 1.5 u.
- **Q — Rocket Leap** `leap`: 7 u, nova r3, 90 dmg. CD 7. → the landing stuns 0.5 s.
- **E — Overdrive** `buff`: self gets +40% attack speed and +20% speed for 4 s, and heals 8% max HP. CD 12. → 20% lifesteal while active.
- **R — Seismic Slam** `cone`: 90°, 7 u, 3 waves 0.25 s apart, 70 dmg each. The first wave knocks up for 0.5 s. CD 40. → 4 waves at 120°.

**4. CORSA — "Arc Lancer"**
- **Look:** lime `#9BD62C` / graphite `#2B2F3A`. An energy spear 1.5× body height, crested helmet, round shield slung on the back.
- **Stats:** HP 900 (+75/lv) · Spd 6.2.
- **Basic — Lance Thrust:** 3.0 u line (0.8 u wide, pierce), 54 dmg / 0.9 s.
- **Q — Spear Charge** `dash`: 8 u, 80 dmg, slow 40% for 1.5 s. CD 7. → +3 u distance, stun 0.4 s.
- **E — Whirl Guard** `nova`: r3, 70 dmg, self shield 150 for 2 s. CD 9. → pulls enemies 1.5 u inward.
- **R — Skyfall Lance** `leap`: 10 u to a cluster, 0.6 s air, nova r3.5, 180 dmg + knock-up 0.8 s. CD 40. → also fires 6 radial bolts (6 u, 60 dmg each).

**ASSASSIN** — *Glint (A) / Volt (B)*

**5. GLINT — "Phase Blade"**
- **Look:** graphite `#2B2F3A` / magenta edges `#FF3DCB`. Slim and tall, one long curved arm-blade, swept-back helmet fin.
- **Stats:** HP 720 (+60/lv) · Spd 6.6.
- **Basic — Edge Slash:** melee 2.0 u, 62 dmg / 0.7 s, +40% vs heroes below 50% HP.
- **Q — Phase Step** `blink`: 6 u onto the target hero (or forward), 80 dmg on arrival. CD 7. → CD resets on a takedown within 2 s.
- **E — Shroud** `buff`: hidden from enemies for 2.5 s or until attacking, +30% speed, next basic +100 dmg. CD 13. → 3.5 s and +50% speed.
- **R — Thousand Cuts** `dash`: chains 5 hits between enemies within 6 u, 60 dmg each, untargetable for 1.0 s. CD 40. → 7 hits.

**6. VOLT — "Storm Runner"**
- **Look:** electric yellow `#FFD60A` / charcoal `#23262D`. Lean runner build, twin coil rods on the back with arc particles, tall boots.
- **Stats:** HP 760 (+62/lv) · Spd 7.0.
- **Basic — Arc Jab:** 2.6 u, 48 dmg / 0.55 s, chains to 1 more target within 3 u for 50%.
- **Q — Lightning Dash** `dash`: 8 u, 1.5 u wide, 70 dmg. CD 6. → 2 charges.
- **E — Static Ring** `nova`: r3.5, 60 dmg, slow 40% for 1.5 s. CD 9. → stun 0.6 s instead of the slow.
- **R — Thunderlane** `dash`: 14 u, leaves a trail for 3 s that deals 80 dmg/s and slows 30%. CD 40. → trail lasts 5 s and Volt gets +40% speed for 3 s.

**BLASTER (AOE)** — *Cinder (A) / Prism (B)*

**7. CINDER — "Magma Mortar"**
- **Look:** charcoal `#3A3236` / magma `#FF5E1A` glowing crack lines. Back-mounted mortar barrel angled up, wide stance.
- **Stats:** HP 680 (+58/lv) · Spd 5.8.
- **Basic — Ember Lob:** arcing shot, 7 u, 42 dmg, splash r1.5 / 0.9 s.
- **Q — Magma Bomb** `blast`: at a cluster ≤ 9 u, 0.5 s telegraph, r3, 110 dmg, plus a 2 s burn field (20 dmg/s). CD 7. → the field lasts 4 s and slows 30%.
- **E — Heat Vent** `nova`: r3.5, 60 dmg, knockback 3 u, self +25% speed for 2 s. CD 10. → also a 120 shield.
- **R — Meteor Barrage** `rain`: 6 blasts (r2.2, 75 dmg each) over 2 s inside a 6 u area at a cluster ≤ 10 u. CD 45. → 9 blasts.

**8. PRISM — "Light Architect"**
- **Look:** pearl `#E6ECF2` / mint `#4DF0C0`. Two crystal pylons (octahedra) floating over the shoulders, tall triangular helmet crest.
- **Stats:** HP 650 (+55/lv) · Spd 5.8.
- **Basic — Refract Bolt:** 7.5 u, 40 dmg, pierces 1 / 0.8 s.
- **Q — Prism Turret** `turret`: placed 4 u toward the aim point, 350 HP, lasts 8 s, fires 7 u bolts (26 dmg / 0.6 s). Max 1. CD 10. → max 2, lasts 12 s.
- **E — Lens Wall** `field`: a 6 u barrier in front for 3 s. Blocks enemy projectiles; enemies crossing it are slowed 40%. CD 12. → allies crossing get +30% speed for 2 s.
- **R — Spectrum Beam** `beam`: 2 s channel, 11 u × 1.6 u, 150 dmg/s, slow 40%. CD 45. → 14 u × 2.4 u.

**SHOOTER (RANGED)** — *Kade (A) / Flint (B)*

**9. KADE — "Rail Ranger"**
- **Look:** desert sand `#C9B48A` / olive `#6F7B3A`. A rail rifle longer than the body, hooded helmet with one scope lens, long coat flaps.
- **Stats:** HP 640 (+55/lv) · Spd 6.0.
- **Basic — Rail Shot:** 8.5 u, 62 dmg / 0.95 s.
- **Q — Piercer** `bolt` (pierce): 0.25 s windup, 12 u line, 1.2 u wide, 130 dmg to all. CD 7. → also slows 35% for 1.5 s.
- **E — Slide Roll** `dash`: 5 u in the move direction. The next basic within 3 s gets +60 dmg and +2 u range. CD 9. → 2 charges.
- **R — Orbital Lock** `blast`: marks the lowest-HP enemy hero within 18 u, 1.0 s reticle telegraph, then strikes r2 for 320 dmg. CD 45. → 2 strikes on 2 different targets.

**10. FLINT — "Scatter Ranger"**
- **Look:** rust `#A0522D` / gunmetal `#3A4150`. Broad and short, a hip-held double-barrel blaster, ammo drum backpack.
- **Stats:** HP 780 (+65/lv) · Spd 6.0.
- **Basic — Scatter Blast:** 6 u, 30° spread of 5 pellets, 14 dmg each / 0.9 s.
- **Q — Frag Grenade** `blast`: thrown 8 u, 0.4 s fuse, r2.5, 100 dmg, knockback 1.5 u. CD 7. → splits into 3 mini-blasts (r1.5, 50 dmg).
- **E — Jet Hop** `leap`: 6 u toward the aim point. The landing makes a slow field (r2.5, 30%, 1.5 s). CD 9. → +100% attack speed for 2 s after landing.
- **R — Bullet Storm** `cone`: 2.5 s channel, 70°, 8 u. 12 volleys of 3 pellets, 22 dmg each. Flint moves at −40% speed while firing. CD 40. → full speed while firing.

**SUPPORT** — *Aria (A) / Tempo (B)*

**11. ARIA — "Pulse Medic"**
- **Look:** white `#F2F4F8` / heal green `#3EE89A`. A ring drone hovering behind the shoulders, slim plated armor, green diamond chest emblem. **Never use a red cross.**
- **Stats:** HP 720 (+60/lv) · Spd 6.2.
- **Basic — Pulse Bolt:** 7 u, 34 dmg / 0.7 s. Each hit heals the lowest-HP ally within 7 u for 12.
- **Q — Mend Wave** `buff`: heals self and allies within 6 u for 120 and cleanses slows. CD 8. → also an 80 shield for 3 s.
- **E — Stasis Orb** `bolt`: 9 u, the first enemy hit takes 50 dmg and is stunned 1.0 s. CD 10. → explodes r2.5 and stuns everyone in it.
- **R — Lifeline Field** `field`: r5 at the best ally cluster within 8 u, lasts 4 s. Allies heal 70/s; enemies are slowed 30%. CD 50. → allies inside cannot drop below 1 HP.

**12. TEMPO — "Sonic Conductor"**
- **Look:** plum `#8E2C7E` / silver `#C9D2DE`. Speaker discs on both shoulders, a conductor staff, a tall collar fin.
- **Stats:** HP 740 (+60/lv) · Spd 6.2.
- **Basic — Sound Wave:** 6.5 u, 38 dmg, pierce / 0.8 s.
- **Q — Rush Anthem** `buff`: allies within 7 u get +35% speed and +15% attack speed for 3 s. CD 10. → also heals 60 and cleanses.
- **E — Bass Drop** `cone`: 80°, 6 u, 70 dmg, knockback 3 u, slow 30% for 1.5 s. CD 8. → stun 0.5 s.
- **R — Crescendo** `nova`: expands to r8 over 0.8 s. Enemies take 120 dmg, are knocked outward 4 u and stunned 1.0 s. Allies inside heal 100. CD 45. → a second pulse after 1.5 s.

## 4. Map — "Starlane Arena" (180 × 112)

**Coordinates and bounds:**
- x ∈ [−90, 90], z ∈ [−56, 56], y up. BLUE base is at −x.
- **Screen-up and minimap-up = −z.** Top lane is at z < 0.
- Geometry is 4-fold mirrored: author one quadrant (x < 0, z < 0), then mirror across x for team fairness and across z for lane fairness.
- Hero bound: |x| ≤ 87, |z| ≤ 53.

**Structures (BLUE values shown; RED mirrors x):**

| Structure | Position(s) | HP | Vulnerable when |
|---|---|---|---|
| Outer towers | top (−34, −38), mid (−30, 0), bot (−34, 38) | 1600 | always |
| Guardian towers | (−62, ±7) | 2000 | any own outer tower is down |
| Core | (−74, 0) | 3600 | both guardians are down, **or** Overdrive and ≥ 1 guardian down |

**Base:**
- Fountain/respawn pad at (−84, 0), r5. It heals 20% max HP/s.
- Leaving it grants a 4 s **launch boost** (+60% speed) so travel stays short.
- Spawn pads, in lane order: top (−80, −7), roam (−82, −3.5), mid (−78, 0), support (−82, 3.5), shooter (−80, 7).

**Lanes:** 10 u wide strips. Waypoints run BLUE → RED; RED walks them reversed.
- TOP: (−70, −6) (−62, −20) (−52, −38) (52, −38) (62, −20) (70, −6)
- MID: (−70, 0) (70, 0)
- BOT: TOP mirrored in z.

**Side routes:**
- A central **Flux Channel** walkway (x ∈ [−5, 5], full height, cyan edge lights) links all three lanes.
- Two jungle pockets per side: x ∈ [−52, −8], z ∈ [8, 30] mirrored.

**Cover** (quadrant AABBs as cx, cz, w, d; mirror ×4). Walls block movement and projectiles (segment-vs-AABB per projectile step):
- (−44, −24, 10, 2)
- (−20, −26, 2, 10)
- (−14, −12, 6, 2)
- (−56, −30, 2, 8)
- (−12, −41, 3, 2)
- (−16, −4, 2, 2)

**Brush** (quadrant rects, mirror ×4):
- (−26, −34, 8, 4)
- (−40, −14, 6, 6)
- (−10, −6, 6, 3)
- (−3, −22, 5, 5)

A unit in brush is hidden from the enemy team unless an enemy is within 3.5 u, or the unit attacked or was hit in the last 1.2 s. Hidden enemies are not rendered, not shown on the minimap and not targetable by auto-aim or bots.

**Neutral camps:**
- 4 **Scrap Sentinels** at (±30, ±18). Model: a siege-minion variant in neutral steel with an amber visor.
- 900 HP, 30 dmg / 1.2 s at range 5. They fight back only when attacked and leash at 8 u.
- First spawn 1:00, respawn 75 s.
- Reward: 90 XP to the killing team's heroes within 12 u, and a 25% heal to the killer.

**Waves:**
- First at 0:15, then every 20 s, on all 3 lanes: 3 troopers + 1 gunner.
- Every 3rd wave from 2:00 adds 1 siege. From Overdrive, waves get +1 trooper.
- Minions follow lane waypoints and fight anything within aggro range, then return to the path. No navmesh: waypoints sit in open space, and circle-vs-AABB push-out makes units slide along cover.

| Unit | HP | Spd | Range | Dmg / CD | Aggro | XP | Struct× | Cap/team |
|---|---|---|---|---|---|---|---|---|
| trooper | 150 | 3.2 | 1.2 | 14 / 1.0 | 6 | 12 | 1 | 36 |
| gunner | 100 | 3.0 | 5.5 | 16 / 1.3 | 7 | 14 | 1 | 12 |
| siege | 520 | 2.6 | 6 | 30 / 1.6 | 7 | 35 | 2.5 | 6 |

Minion looks: trooper is a squat hex-prism body with a visor slab on short legs. Gunner is a hovering octahedron with a barrel. Siege is a tracked box with a cannon. Team color shows on the visor/strip through `instanceColor`. Hero XP is 70 + 10 × victim level. XP goes in full to every enemy hero within 9 u (no splitting).

**Towers:**
- Range 9. Fire every 1.1 s with a fast homing orb (unavoidable).
- vs heroes: 70 + 6% of max HP, ×1.25 per consecutive shot on the same hero (max ×2). vs minions: 120.
- Targeting:
  1. An enemy hero that damaged an allied hero inside tower range in the last 2 s.
  2. Otherwise, minions in range (nearest first).
  3. Otherwise, the nearest hero.
- A red line plus the existing "!" marker shows when the player is targeted.
- **Backdoor shield:** a structure takes 35% damage from heroes when no attacking-team minion is within 10 u (shown as a hex shimmer). Minions always deal full damage.

**Fairness:** every hero range is below the tower's 9 u. Both teams have identical role structure, and RED never has a ranged or AOE role that BLUE lacks.

**Pacing:**
- **Overdrive** at 6:00: respawn ×0.5, minion structure damage ×2, +1 trooper per wave, orange clock, new music layer.
- **Tiebreak** at 8:00, in order:
  1. More enemy structures destroyed.
  2. Lower remaining enemy structure HP fraction.
  3. More takedowns.
  4. BLUE wins.
- The results screen states the reason.

**Expected flow:** first outer towers fall at 2:30–4:00, guardians at 4:30–6:00, and the Core in Overdrive at 6–8 min.

## 5. Bots (all 9 use the same rules as the player)

**Composition** (deterministic; `matchIndex` is saved in localStorage and +1 each started match):
- Roles in order: tank, bruiser, assassin, blaster, shooter, support. Each role has a pair [A, B] as in §3.
- **Dropped role** = `['assassin', 'bruiser', 'tank'][matchIndex % 3]`. If that is the player's role, drop the next one in that list.
- Blaster, shooter and support are **never dropped**, so both teams always have ranged, AOE and support.
- For each kept role:
  - The player's role: BLUE gets the pick, RED gets the pair partner.
  - Every other role: `k = (matchIndex + roleIdx) % 2`; BLUE gets `pair[k]`, RED gets `pair[1−k]`.

**Lanes:**

| Lane | Who |
|---|---|
| bot | shooter + support |
| mid | blaster |
| top | the more durable melee (tank > bruiser > assassin) |
| roam | the other melee |

The roamer clears its own two camps, then joins the lane with the largest (enemy heroes − ally heroes) count, re-checked every 10 s. The player's lane is shown by a ground arrow for the first 20 s, but the player may go anywhere.

**Brain:**
- `think()` re-decides every `react` s and steers every sim step.
- Decision priority: **RETREAT > DEFEND > FIGHT > PUSH > LANE/ROAM**.

| State | Rule |
|---|---|
| RETREAT | HP < 35%, or < 50% with ≥ 2 enemy heroes within 8 u. Walk the lane path back to the fountain until ≥ 90%. Use escape-capable skills (dash, blink, leap, buff, `slow` nova) when an enemy is within 5 u. |
| DEFEND | An own structure was damaged in the last 3 s and the bot is ≤ 35 u from it. |
| FIGHT | An enemy hero is within aggro 10 u and the local HP-weighted power is ≥ 0.8× the enemy's. |
| PUSH | A vulnerable enemy structure has ≥ 2 allied minions within 6 u of it. Otherwise never enter tower range. |
| LANE | Stand at the lane front (furthest own minion, by path parameter `s`) minus the role offset. |

**Role spacing** (keep distance = range × factor; offset relative to the minion front):

| Role | Factor | Offset |
|---|---|---|
| Tank | 0.6 | +1 u ahead |
| Bruiser / assassin | 0.7 | 0 |
| Blaster | 0.85 | −3 u |
| Shooter | 0.9 | −4 u |
| Support | — | within 4 u of its lane partner, 2 u behind |

Ranged bots back off when an enemy is closer than 0.5 × range (existing logic).

**Target score:**
- Hero in range: +60 × (1 − HP%).
- Hero hitting an ally: +30.
- Ally already focusing the same target: +15.
- Assassins: +40 vs blaster, shooter or support.
- Tank and support: +35 vs whoever hits their shooter.
- Minion: 10.
- Structure: only in PUSH and with no enemy hero within 7 u.

**Skill use by kind:**

| Kind | When |
|---|---|
| `dash` / `leap` / `blink` / `hook` | Target hero in range and (own HP > 50% or target HP < 35%) |
| `nova` / `cone` | ≥ 2 enemies or 1 hero inside |
| `blast` / `rain` / `beam` | `bestCluster` has a hero, or n ≥ 3 |
| `buff` / heal / shield | Self or an ally < 60% in radius, or ≥ 2 allies fighting |
| `turret` / `field` | Fighting or pushing |
| Ult | Cluster with a hero and (n ≥ 2 or target HP < 45%) |

**Upgrades:** on gaining a point, spend immediately: ult if allowed; otherwise the lower of Q/E (tie → Q).

**Difficulty** (pause → settings; default ★1 for the young owner):

| Level | Enemy reaction | Enemy dmg | Allies |
|---|---|---|---|
| ★1 Rookie | 0.55 s | 0.85× | react 0.4 s, dmg 1.0× |
| ★2 Pro | 0.4 s | 1.0× | react 0.4 s, dmg 1.0× (identical teams) |
| ★3 Champion | 0.3 s | 1.1× | react 0.4 s, dmg 1.0× |

## 6. Controls & HUD

**Touch** (landscape first; every hit area ≥ 64 px):
- Floating joystick in the left 45% (keep). Tap-to-move is not added.
- Attack: 112 px. Hold for continuous auto-attack.
- Q and E: 76 px; R: 84 px, on an arc of radius 104 px around Attack.
- **Auto-aim stays** (no manual aiming this pass).

**Desktop:**
- WASD/arrows move. Right-click walk (keep).
- Space attack. Q / E / R skills. **U** toggles the upgrade drawer. **1 / 2 / 3** upgrade Q / E / R whenever points are available, drawer open or not.
- Esc pauses.

**Target and range:**
- The current target gets a red chevron plus a red bracket ring.
- A thin gold ring at basic range (α 0.25) shows while attacking or when an enemy is within range + 2.
- Skill buttons show the remaining CD as an integer with a radial wipe, plus key labels Q/E/R (desktop only).
- R is grey with "Lv3" until unlocked.

**Layout:**
- **Top-left:** a 64 px portrait (HP ring, XP arc, level badge). To its right, a **minimap** of 168×104 (216×134 on viewports ≥ 1100 px).
  - Static layer: lanes, walls and brush, pre-drawn once to an offscreen canvas.
  - 10 Hz dynamic layer: structures, minions (2 px dots), visible heroes, the player (gold, with a facing tick) and the camera rectangle.
- **Top-center:** scorebar — `BLUE kills · mm:ss · RED kills`, with 5 tower pips + a core pip per team underneath.
- **Top-right:** mute and pause (keep).
- **Center clear:** nothing persistent in the central 50% width × 60% height. Banners last ≤ 2 s and use `pointer-events: none`.

**Upgrade drawer** (always nonmodal; replaces `levelup.js` cards and removes `pickSlow`):
- **Collapsed:** a 64×64 tab on the right edge, directly below the top-right buttons. It shows a "+" chevron and a gold badge with the unspent point count. While points > 0 it pulses gold every 1.2 s.
- **Expanded** (tap the tab or press U; slides left in 160 ms): a row of 3 buttons, 64×72 each — skill icon, Q/E/R label, rank pips (4/4/3) and a "+" when upgradable.
- Tapping a button ranks that skill up, with a 0.3 s gold shine and an upgrade sound.
- A button is disabled (dim, no "+") when maxed, out of points, or level-gated; gated buttons show "Lv N".
- The drawer auto-collapses 1.5 s after the last point is spent. It never opens itself except once in the first match. It never pauses or slows time and never forces a choice; unspent points carry over.
- **Points:**
  - Start: Q1, E1, R0.
  - +1 point at each level-up from 2 to 9 (max level 9; 8 points fill Q4 E4 R3 exactly).
  - Q/E rank r requires level ≥ 2r − 2.
  - R1 is granted free at level 3 with the existing slam animation. R2 requires level 5, R3 requires level 8.
- XP needed to level: `40 + 20 × (lv − 1)`.
- On level-up: gold ring burst on the hero, a "+1" floating toward the drawer tab, and a chime.

**First match** (`save.tutorialDone`): non-blocking ghost-hand hints, each disappearing once done:
1. Drag to move.
2. Tap Attack.
3. Tap a skill.
4. "Tap + to power up" pointing at the tab on the first point.
5. A lane arrow on the ground for 20 s.

## 7. Menus

**Title:**
- Arena backdrop with 3 idle champions. Logo "STARLANE SCUFFLE" in Chakra Petch 700 italic, with a blue/red split stroke.
- A large PLAY button. A small difficulty pip (★1–3).

**Select** (no locks, no unlock progress, no "win to unlock"):
- A **6×2 grid** of 12 cards, each ≥ 104×128 px. Card contents:
  - portrait
  - name
  - role icon + role word (TANK, BRUISER, ASSASSIN, BLASTER, SHOOTER, SUPPORT)
  - champion-color frame
- Tapping a card selects it with a sound and fills a right-side detail strip:
  - name and title
  - 3 stat bars: HP, Speed, Range
  - basic + Q/E/R icons with 2–4 word labels (e.g. "Ram Charge – dash stun")
  - a big **GO** button
- Last pick is remembered. Delete the `unlocked` save key and all unlock UI.

**VS splash** (1.5 s): BLUE row of 5 portraits vs RED row of 5, with role icons.

**Pause:** resume, home, sound, difficulty, "reduce shake & flash".

**Results:**
- **VICTORY** (gold) or **DEFEAT** (red-grey) in big words, plus the reason line ("Core destroyed" or "Won on towers at 8:00").
- Your KOs/assists, structures destroyed, time, and 1–3 stars on a win (win / no tower lost / under 6:00).
- Buttons: **Play Again** (same champion) and **Champions**.
- Victory: team-color fireworks over the enemy Core implosion. No rainbow confetti.

**Portraits:** Stage 1 uses an SVG role glyph on the champion color. Stage 4 renders each model's bust once at boot to a 160 px canvas (main renderer, small viewport, `drawImage` right after render) and reuses it as a dataURL.

## 8. Audio & VFX (existing synth, no files)

**Retune `audio.js` from cute to punchy:**
- **Hit:** 8 ms noise transient + sine thump 90 → 50 Hz, 70 ms. Pitch rises with damage tier.
- **Melee swing:** filtered noise sweep. **Shots:** square blip with a fast downward pitch. **Rail:** saw zap with a lowpass sweep.
- **Explosions:** noise + 50 Hz sub, 250 ms.
- **KO:** reverse-swell noise + a low chord stab.
- **Level/upgrade:** rising 3-note minor arpeggio. **Tower down:** crash + sub.
- **Music:** D minor, 128 BPM — kick/snare from noise, saw bass, arp. Overdrive: +8 BPM + hats. Victory: brass-like saw chord stab; defeat: a short 2-chord fall.
- **Timbres by role:** tank low square, bruiser saw, assassin high pulse, blaster noise-FM, shooter bit-crushed triangle, support sine-bell.
- Keep the limits: 24 voices, 30 ms retrigger guard, music ducks during ults.

**VFX:**
- Add particle atlas frames *shard* and *spark*, replacing the 5-point star.
- Pooled decals for telegraphs and fields; ribbon, beam, dome and ring pools are reused from `vfx.js`.
- Status markers: stun = spinning yellow ring over the head; slow = cyan ground ring; shield = `#8FE3FF` fresnel dome; hidden (own team view) = 50% opacity.

**Accessibility:**
- "Reduce shake & flash" scales shake to 0, flash to 0.3 and hit-stop to 0.
- Team identity never relies on color alone (§2 rings and bars).
- All text ≥ 14 px with an ink stroke. Sound and music can be muted.

## 9. Implementation Handoff

**Preserve:**
- Fixed-step loop, event bus, pooled particles/projectiles/vfx and toon/outline helpers.
- Combat status effects, targeting (`pickTarget`, `bestCluster`), touch joystick and audio engine.
- The `Hero`/`Bot` split, and the model return contract `{ root, lean, eyes, tail, mats }` (`eyes` = visor mesh for pulse; `tail` = back piece for sway).

**Data first:**
- `js/heroes/roster.js` *(new)*: 18 champion defs as pure data — `{ id, name, title, role, pair, color, accent, model, stats, basic, s1, s2, ult }`.
  - Example skill: `{ kind: 'dash', name, icon, cd, range, dmg, width, knock, perk: { at: 4, stun: 0.6 } }`.
- `rankStats(ab, rank)` returns the resolved params (scaling + `perk` merged at max rank).
- `js/heroes/behaviors.js` *(new)*: `BEHAVIORS[kind](hero, ab, ctx, aim)` for the 13 kinds. Port logic from `zip/moss/luma/clink.js`:
  - dash ← Streak Dash
  - nova ← Spin Flurry / Quake
  - hook ← Vine Grab
  - buff/dome ← Bark Shield
  - blast ← Twinkle Burst
  - rain ← Star Shower
  - blink ← Hop Blink
  - turret / beam ← Clink
  - leap ← Meteor Pounce
- Each behavior reads optional flags (`stun`, `slow`, `knock`, `pull`, `field`, `charges`, `shield`, `heal`, `pierce`, `count`, `spread`) so perks are data-only.
- Then delete `zip.js`, `moss.js`, `luma.js`, `clink.js` and `upgrades.js`.
- `js/heroes/index.js`: build `HEROES` from the roster (attach behaviors and `buildModel`); export `ROSTER` (12 ids) and `ROLES`.
- `js/heroes/models.js`: `buildChampion(spec, team)` from a part library:
  - torso: heavy / medium / slim
  - helmet: flat / dome / crest / hood / fin
  - pauldrons: none / small / huge
  - weapon: shield, gauntlet, spear, blade, coils, mortar, pylons, rifle, blaster, drone, discs
  - back piece
  - Each champion's `model` spec is ~6 lines. **Delete all animal builders.** No bespoke per-champion geometry functions.
- `js/heroes/hero.js`: `ranks [1,1,0]`, `points`, `spendPoint(slot)`, rank gating, charges, invisible/untargetable flags, level cap 9, 2 leg meshes with swing animation. Remove `up` / `addUpgrade` / card logic.

**World and match:**
- `config.js`: new PAL/TEAM, `MAP` (bounds, lanes, towers, guardians, core, fountain, spawnPads, walls, brush, camps as quadrant data plus a `mirror4()` helper), MATCH (waves, Overdrive 360, tiebreak 480), UNITS renamed `trooper/gunner/siege`, HERO (xp curve, gating), TOWER/CORE, DIFFICULTY (enemy/ally), CAM.
- `world/map.js`: rebuild the arena from `MAP`.
- `tower.js`: takes a position and kind from a list.
- `minions.js`: lane index + waypoint index per minion, new instanced looks, neutral camps.
- `game/collide.js` *(new, small)*: circle-vs-AABB push-out, segment-vs-AABB, brush lookup, `visibleTo(team, unit)`.
- `game/compose.js` *(new)*: the §5 composition and lane assignment.
- `game/match.js`: 10 heroes, 3-lane waves, vulnerability and backdoor rules, scoring and KOs, Overdrive, tiebreak reason, skill points. **Remove `pick`, `pickSlow` and the unlock flow.**
- `game/bot.js`: states, lane path param `s`, role spacing, per-kind skill rules, camps, auto-upgrade.
- `ui/hud.js`: minimap canvas, scorebar, damage numbers.
- `ui/upgrades.js` *(replaces `levelup.js`)*: the drawer.
- `ui/abilities.js`: sizes and CD numbers.
- `ui/menus.js`: 12-card select, VS splash, results. `ui/icons.js`: 13 kind icons + 6 role glyphs, tinted by champion color.
- `main.js`: drop unlocks and add `matchIndex`. `core/input.js`: U key and 1/2/3 → `spendPoint`.
- `css/style.css`: theme vars and layout. `index.html`: font link plus a drawer root. `README.md`: remove the unlock text.

**Stages** (each ends playable, with no console errors):
1. **Roster and leveling:** roster.js, behaviors, buildChampion, ranks/points/drawer, 12-card select, no unlocks, palette swap. Tested on the old lane with 2v2.
2. **Arena and 5v5:** MAP data, arena mesh, collisions and brush, 3-lane waves, 10 structures and rules, composition, minimap, scorebar, Overdrive and tiebreak.
3. **Bots:** full brain, lanes and roam, camps, difficulty split.
4. **Polish:** telegraphs, hit stack, damage numbers, KO flow, portraits, audio retune, tutorial hints, results reasons.

**Smallest safe complete scope = Stages 1–3**, plus the palette and font swap from Stage 4. Do not add items, shops, manual aiming, pathfinding, per-champion modules, skins or extra modes.

## 10. Acceptance Checklist

- [ ] All 18 champions are selectable from first launch with no lock UI. Each one's basic, Q, E and R fire with visible VFX, and each R3/R4 perk works.
- [ ] Every match has 10 heroes (player + 4 BLUE bots + 5 RED bots). Composition follows §5. Both teams have a blaster, a shooter and a support.
- [ ] The map is 180×112 with 3 lanes, the Flux Channel, jungle pockets, cover that blocks movement and projectiles, brush that hides units, and 4 camps. Minions walk all 3 lanes.
- [ ] Tower, guardian and core vulnerability, the backdoor shield and tower aggro behave as in §4. No hero outranges a tower.
- [ ] XP fills visibly. Level-ups grant points with a badge. The drawer opens and closes with a tap or U, and 1/2/3 spend points. The game never slows or pauses for upgrades. Gating and max ranks are enforced. Bots auto-upgrade.
- [ ] Bots retreat to the fountain, return to their lane, push with waves, defend structures, use all 3 skills and never dive towers without minions.
- [ ] A landscape screenshot at 844×390 shows an unobstructed center, a readable minimap, controls ≥ 64 px, drawer tab clear of the skill arc, and a visible current-target marker.
- [ ] Desktop WASD / Space / Q / E / R / U / 1–3 / Esc all work.
- [ ] A typical match ends in 5–8 min. The tiebreak at 8:00 shows its reason. Results show VICTORY/DEFEAT, stats, and Play Again / Champions.
- [ ] No cute cues remain (eyes, animals, petals, pastel confetti, smiley, Baloo font).
- [ ] No console errors through title → select → match → results → retry. Mid-range phone holds ~60 fps within the §2 budgets.
