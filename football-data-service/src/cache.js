"use strict";

/**
 * In-memory TTL cache. Keeps upstream calls (and free-tier quota) low.
 * Also exposes helpers to build HTTP Cache-Control headers.
 */

class TTLCache {
  constructor() {
    this.store = new Map();
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expires) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value, ttlSeconds) {
    this.store.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
  }

  /** Return cached value or compute+store it. */
  async wrap(key, ttlSeconds, producer) {
    const hit = this.get(key);
    if (hit !== undefined) return { value: hit, cached: true };
    const value = await producer();
    this.set(key, value, ttlSeconds);
    return { value, cached: false };
  }

  size() {
    return this.store.size;
  }
}

/**
 * Cache-Control header value mirroring the /api/news pattern:
 *   public, s-maxage=<ttl>, stale-while-revalidate=<ttl*2>
 */
function cacheControl(ttlSeconds) {
  const ttl = Math.max(0, Math.floor(ttlSeconds || 0));
  const swr = ttl * 2;
  return `public, s-maxage=${ttl}, stale-while-revalidate=${swr}`;
}

module.exports = { TTLCache, cacheControl };
