export type TimedCacheEntry<T> = Readonly<{
  value: T;
  expiresAt: number;
}>;

export type TimedCache<T> = Readonly<{
  get: (key: string) => T | undefined;
  set: (key: string, value: T) => void;
  clear: () => void;
}>;

export function createTimedCache<T>(ttlMs: number, now: () => number = Date.now): TimedCache<T> {
  const entries = new Map<string, TimedCacheEntry<T>>();

  return {
    get(key) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt <= now()) {
        entries.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key, value) {
      entries.set(key, { value, expiresAt: now() + ttlMs });
    },
    clear() {
      entries.clear();
    },
  };
}

const STORED_CACHE_VERSION = 1;

type StoredCacheEnvelope<T> = Readonly<{
  version: number;
  expiresAt: number;
  value: T;
}>;

export type StorageTimedCacheOptions = Readonly<{
  namespace: string;
  storage: Storage;
  ttlMs: number;
  now?: () => number;
}>;

export function createStorageTimedCache<T>(
  options: StorageTimedCacheOptions,
): TimedCache<T> {
  const { namespace, storage, ttlMs, now = Date.now } = options;
  const mirror = new Map<string, StoredCacheEnvelope<T>>();

  const compositeKey = (key: string): string => `${namespace}:${key}`;

  return {
    get(key) {
      const cachedEnvelope = mirror.get(key);
      if (cachedEnvelope) {
        if (cachedEnvelope.expiresAt <= now()) {
          mirror.delete(key);
          storage.removeItem(compositeKey(key));
          return undefined;
        }
        return cachedEnvelope.value;
      }

      const raw = storage.getItem(compositeKey(key));
      if (raw === null) return undefined;
      let envelope: StoredCacheEnvelope<T>;
      try {
        envelope = JSON.parse(raw) as StoredCacheEnvelope<T>;
      } catch {
        storage.removeItem(compositeKey(key));
        return undefined;
      }
      if (envelope.version !== STORED_CACHE_VERSION || envelope.expiresAt <= now()) {
        storage.removeItem(compositeKey(key));
        return undefined;
      }
      mirror.set(key, envelope);
      return envelope.value;
    },
    set(key, value) {
      const envelope: StoredCacheEnvelope<T> = { version: STORED_CACHE_VERSION, expiresAt: now() + ttlMs, value };
      mirror.set(key, envelope);
      storage.setItem(compositeKey(key), JSON.stringify(envelope));
    },
    clear() {
      mirror.clear();
      const prefix = `${namespace}:`;
      const keysToRemove: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const storageKey = storage.key(i);
        if (storageKey !== null && storageKey.startsWith(prefix)) keysToRemove.push(storageKey);
      }
      for (const storageKey of keysToRemove) storage.removeItem(storageKey);
    },
  };
}