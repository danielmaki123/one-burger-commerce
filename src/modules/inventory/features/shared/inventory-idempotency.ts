type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, CacheEntry<unknown>>();

function purgeExpired() {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt <= now) {
      cache.delete(key);
    }
  }
}

export function getIdempotentResult<T>(key: string): T | null {
  purgeExpired();
  const entry = cache.get(key);
  if (!entry) return null;
  return entry.value as T;
}

export function setIdempotentResult<T>(key: string, value: T): void {
  purgeExpired();
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}
