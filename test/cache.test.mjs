import test from "node:test";
import assert from "node:assert/strict";
import { EvaluationCache } from "../src/cache.mjs";

test("returns null for cache miss", () => {
  const cache = new EvaluationCache();
  const res = cache.get({ url: "https://api.kite.ai/x402" });
  assert.equal(res, null);
});

test("stores and retrieves cached decision with cached flag", () => {
  const cache = new EvaluationCache();
  const input = { url: "https://api.kite.ai/x402", challenge: { version: 1 } };
  const data = { allowed: true, score: 100 };

  cache.set(input, data);
  const cached = cache.get(input);

  assert.equal(cached.allowed, true);
  assert.equal(cached.score, 100);
  assert.equal(cached.cached, true);
});

test("expires stale cache entries according to TTL", async () => {
  const cache = new EvaluationCache({ defaultTtlMs: 20 });
  const input = { url: "https://api.kite.ai/transient" };
  cache.set(input, { allowed: true }, 20);

  assert.ok(cache.get(input) !== null);

  await new Promise((resolve) => setTimeout(resolve, 35));
  assert.equal(cache.get(input), null);
});

test("evicts oldest entries when reaching max capacity", () => {
  const cache = new EvaluationCache({ maxEntries: 2 });
  cache.set({ url: "https://item1.com" }, { id: 1 });
  cache.set({ url: "https://item2.com" }, { id: 2 });
  assert.equal(cache.size, 2);

  cache.set({ url: "https://item3.com" }, { id: 3 });
  assert.equal(cache.size, 2);
  assert.equal(cache.get({ url: "https://item1.com" }), null);
  assert.ok(cache.get({ url: "https://item3.com" }) !== null);
});
