/** Seeded, reproducible randomness (no Math.random in the engine). */

/** cyrb53: a fast, well-distributed 53-bit string hash. */
export function hashString(s: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** mulberry32: returns floats in [0, 1). */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Provably reproducible result: the winning number is a pure function of (server seed, round id).
 * Rejection sampling keeps the 37 outcomes exactly uniform.
 */
export function numberFor(seed: string, roundId: string): number {
  const rng = createRng(hashString(`${seed}:${roundId}`) % 4294967296);
  for (;;) {
    const v = Math.floor(rng() * 64);
    if (v < 37) return v;
  }
}

/** Short public fingerprint of the seed, which is safe to show in the inspector. */
export function seedFingerprint(seed: string): string {
  return hashString(seed).toString(16).padStart(14, '0').slice(0, 12);
}
