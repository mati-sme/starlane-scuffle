// localStorage wrapper that survives private mode / blocked storage.
const K = 'starlane.';

export const save = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(K + key)) ?? fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(K + key, JSON.stringify(value)); } catch { /* storage unavailable */ }
  },
};
