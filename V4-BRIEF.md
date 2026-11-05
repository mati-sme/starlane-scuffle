# Starlane Scuffle v4 brief

Rollback: `rollback/pre-v4-2026-11-05` (pushed).

## Goals
1. **Visual revamp** — Wild Rift–like polished mobile MOBA on three.js. Better lit/shaded articulated champions, textured terrain, realistic towers/cores, lighting+shadows, distinct ability VFX. Kid-safe. Smooth on phones.
2. **~6 new champions** → 18 total, all unlocked, distinct abilities/VFX. 3 per role.
3. **Keep**: CF Worker online, Wild Rift `+` skill-ups, offline SP, 3-lane map.
4. **Native apps** (Matias rejected PWA-as-app; basic manifest/SW OK but don't pitch):
   - **Android APK**: Capacitor (or lighter TWA/Bubblewrap if truly bundles assets). Landscape-only `sensorLandscape`. Assets bundled. Build via **GitHub Actions**. Publish `.apk` as Release asset + copy to `/workspace/test-artifacts/starlane-scuffle/v4/`.
   - **macOS .dmg**: **Tauri** (not Electron), Apple Silicon. Unsigned OK + Gatekeeper note. GH Actions + Release asset.
   - **iOS**: Capacitor iOS project optional for free Xcode 7-day sideload only — one-line mention, no TestFlight/$99 push.
   - Landscape lock: Android sensorLandscape; iOS Info.plist landscape; web `screen.orientation.lock('landscape')` + existing rotate overlay.
5. Playwright SP + online tests; screenshots in `v4/`; push master; verify Pages.

## Stages
- A (Opus): visual revamp
- B (Sonnet): +6 champions
- C (Sonnet): Capacitor Android + Tauri macOS + GH Actions + landscape lock + light PWA keep
- D (Sonnet): Playwright + screenshots + push + release

Claude: sequential, <~150k ctx. Opus=art, Sonnet=code.
