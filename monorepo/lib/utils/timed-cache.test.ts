import assert from "node:assert/strict";
import test from "node:test";

import {
  createStorageTimedCache,
  createTimedCache,
  type TimedCache,
} from "@/lib/utils/timed-cache";

test("get returns a value set within the TTL window", () => {
  let now = 1_000;
  const cache = createTimedCache<string>(60_000, () => now);
  cache.set("a", "hello");
  assert.equal(cache.get("a"), "hello");

  now += 59_999;
  assert.equal(cache.get("a"), "hello");
});

test("get returns undefined after the TTL expires and drops the entry", () => {
  let now = 1_000;
  const cache = createTimedCache<string>(60_000, () => now);
  cache.set("a", "hello");

  now += 60_000;
  assert.equal(cache.get("a"), undefined);

  now += 30_000;
  assert.equal(cache.get("a"), undefined);
});

test("set overwrites the previous value and refreshes the TTL", () => {
  let now = 1_000;
  const cache = createTimedCache<string>(60_000, () => now);
  cache.set("a", "first");

  now += 59_999;
  cache.set("a", "second");
  assert.equal(cache.get("a"), "second");

  now += 59_999;
  assert.equal(cache.get("a"), "second");
});

test("keys are independent", () => {
  const cache = createTimedCache<string>(60_000, () => 0);
  cache.set("a", "A");
  cache.set("b", "B");
  assert.equal(cache.get("a"), "A");
  assert.equal(cache.get("b"), "B");
});

test("clear removes every entry", () => {
  const cache = createTimedCache<string>(60_000, () => 0);
  cache.set("a", "A");
  cache.set("b", "B");
  cache.clear();
  assert.equal(cache.get("a"), undefined);
  assert.equal(cache.get("b"), undefined);
});

test("a zero TTL makes the value expire immediately", () => {
  const cache = createTimedCache<string>(0, () => 5);
  cache.set("a", "A");
  assert.equal(cache.get("a"), undefined);
});

function createMemoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    key(index) {
      return [...items.keys()][index] ?? null;
    },
    getItem(key) {
      return items.get(key) ?? null;
    },
    setItem(key, value) {
      items.set(key, String(value));
    },
    removeItem(key) {
      items.delete(key);
    },
    clear() {
      items.clear();
    },
  };
}

test("storage cache persists across instances within the TTL window", () => {
  let now = 1_000;
  const storage = createMemoryStorage();

  const first: TimedCache<string> = createStorageTimedCache({
    namespace: "n",
    storage,
    ttlMs: 60_000,
    now: () => now,
  });
  first.set("a", "hello");

  const second: TimedCache<string> = createStorageTimedCache({
    namespace: "n",
    storage,
    ttlMs: 60_000,
    now: () => now,
  });
  now += 59_999;
  assert.equal(second.get("a"), "hello");
});

test("storage cache entry expires after the TTL and is dropped from storage", () => {
  let now = 1_000;
  const storage = createMemoryStorage();

  const first: TimedCache<string> = createStorageTimedCache({
    namespace: "n",
    storage,
    ttlMs: 60_000,
    now: () => now,
  });
  first.set("a", "hello");

  now += 60_000;
  const second: TimedCache<string> = createStorageTimedCache({
    namespace: "n",
    storage,
    ttlMs: 60_000,
    now: () => now,
  });
  assert.equal(second.get("a"), undefined);
  assert.equal(storage.getItem("n:a"), null);
});

test("storage cache keys are namespaced and independent", () => {
  const now = 0;
  const storage = createMemoryStorage();

  const a: TimedCache<string> = createStorageTimedCache({
    namespace: "ns-a",
    storage,
    ttlMs: 60_000,
    now: () => now,
  });
  const b: TimedCache<string> = createStorageTimedCache({
    namespace: "ns-b",
    storage,
    ttlMs: 60_000,
    now: () => now,
  });

  a.set("k", "A");
  b.set("k", "B");
  assert.equal(a.get("k"), "A");
  assert.equal(b.get("k"), "B");
  assert.equal(storage.getItem("ns-a:k"), '{"version":1,"expiresAt":60000,"value":"A"}');
});

test("storage cache clear only removes its own namespace", () => {
  const storage = createMemoryStorage();
  storage.setItem("unrelated", "keep");

  const cache: TimedCache<string> = createStorageTimedCache({
    namespace: "n",
    storage,
    ttlMs: 60_000,
    now: () => 0,
  });
  cache.set("a", "A");
  cache.set("b", "B");
  cache.clear();

  assert.equal(cache.get("a"), undefined);
  assert.equal(cache.get("b"), undefined);
  assert.equal(storage.getItem("unrelated"), "keep");
});

test("storage cache treats corrupt entries as a miss and drops them", () => {
  const storage = createMemoryStorage();
  storage.setItem("n:a", "{not-json");

  const cache: TimedCache<string> = createStorageTimedCache({
    namespace: "n",
    storage,
    ttlMs: 60_000,
    now: () => 0,
  });
  assert.equal(cache.get("a"), undefined);
  assert.equal(storage.getItem("n:a"), null);
});

test("storage cache returns a stable reference for the same entry", () => {
  let now = 5;
  const storage = createMemoryStorage();
  const cache: TimedCache<{ n: number }> = createStorageTimedCache({
    namespace: "n",
    storage,
    ttlMs: 60_000,
    now: () => now,
  });

  cache.set("a", { n: 1 });
  const first = cache.get("a");
  const second = cache.get("a");
  assert.equal(first, second);
  assert.equal(second?.n, 1);

  now += 30_000;
  const afterReRead = cache.get("a");
  assert.equal(afterReRead, first);
});