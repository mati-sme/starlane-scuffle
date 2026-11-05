// Landscape lock: best-effort (needs a user gesture, and fullscreen on most browsers). The #rotate overlay is the fallback.
export function lockLandscape() {
  try {
    const el = document.documentElement;
    const fs = !document.fullscreenElement && el.requestFullscreen ? el.requestFullscreen().catch(() => {}) : Promise.resolve();
    fs.then(() => screen.orientation?.lock?.('landscape')).catch(() => {});
  } catch { /* unsupported (iOS Safari, desktop) */ }
}
