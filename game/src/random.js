// A small seeded random source, so the same seed always plays the same game.
// Screenshots stage a scene from a fixed seed and get the same frame every run.

/** mulberry32: a tiny, fast seeded generator. */
export function createRandom(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
  function next() {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    /** A float in [min, max). */
    range(min, max) {
      return min + next() * (max - min);
    },
    /** An integer in [min, max]. */
    int(min, max) {
      return Math.floor(min + next() * (max - min + 1));
    },
    /** True with probability p. */
    chance(p) {
      return next() < p;
    },
    /** One element of an array. */
    pick(items) {
      return items[Math.floor(next() * items.length)];
    },
  };
}
