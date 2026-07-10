// Deterministic PRNG utilities. No Math.random anywhere in this package.
// Per company-docs/architecture.md §6: seeded from input.seed (string -> uint32 hash),
// then threaded through every random decision via mulberry32.

export function hashStringToUint32(input: string): number {
  // FNV-1a style hash, deterministic and stable across platforms/runs.
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export type Rng = () => number; // returns float in [0, 1)

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed: string): Rng {
  return mulberry32(hashStringToUint32(seed));
}

/** Integer in [min, max] inclusive, using the given rng. */
export function rngInt(rng: Rng, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/** Pick a random element from a non-empty array. */
export function rngPick<T>(rng: Rng, items: T[]): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}
