// Tiny event bus: game logic emits, ui/ subscribes.
const subs = new Map();

export const bus = {
  on(evt, fn) {
    if (!subs.has(evt)) subs.set(evt, []);
    subs.get(evt).push(fn);
  },
  off(evt, fn) {
    const list = subs.get(evt);
    if (list) subs.set(evt, list.filter((f) => f !== fn));
  },
  emit(evt, data) {
    const list = subs.get(evt);
    if (list) for (const fn of list) fn(data);
  },
};
