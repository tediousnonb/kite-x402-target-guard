import { createHash } from "node:crypto";

export class EvaluationCache {
  #cache = new Map();
  #maxEntries;
  #defaultTtlMs;

  constructor({ maxEntries = 500, defaultTtlMs = 60_000 } = {}) {
    this.#maxEntries = maxEntries;
    this.#defaultTtlMs = defaultTtlMs;
  }

  /**
   * Generates a deterministic cache key from input url and challenge
   */
  computeKey(input) {
    const rawUrl = typeof input?.url === "string" ? input.url : "";
    const rawChallenge = typeof input?.challenge === "object" ? JSON.stringify(input.challenge) : String(input?.challenge ?? "");
    const digest = createHash("sha256")
      .update(`${rawUrl}|${rawChallenge}`)
      .digest("hex");
    return digest;
  }

  /**
   * Retrieves non-expired cached decision
   */
  get(input) {
    const key = this.computeKey(input);
    const entry = this.#cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.#cache.delete(key);
      return null;
    }

    return { ...entry.data, cached: true };
  }

  /**
   * Sets evaluation result with TTL
   */
  set(input, data, ttlMs = this.#defaultTtlMs) {
    const key = this.computeKey(input);
    if (this.#cache.size >= this.#maxEntries) {
      // Evict oldest entry
      const oldestKey = this.#cache.keys().next().value;
      if (oldestKey) this.#cache.delete(oldestKey);
    }

    this.#cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  clear() {
    this.#cache.clear();
  }

  get size() {
    return this.#cache.size;
  }
}
