// A small seeded random number generator (mulberry32): the same seed always
// builds the same city and the same traffic, which is what makes the
// screenshot scenes repeatable.

export function createRandom(seed) {
  let state = seed | 0;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick one element of `items` using `random`. */
export function pick(random, items) {
  return items[Math.floor(random() * items.length)];
}

/** A number in [min, max) using `random`. */
export function range(random, min, max) {
  return min + random() * (max - min);
}
