// Tiny event bus: game logic emits, ui/ subscribes.
const subs = new Map();

export const bus = {
  on(evt, fn) {
    if (!subs.has(evt)) subs.set(evt, []);
    subs.get(evt).push(fn);
  },
  emit(evt, data) {
    const list = subs.get(evt);
    if (list) for (const fn of list) fn(data);
  },
};
