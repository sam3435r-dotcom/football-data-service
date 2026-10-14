"use strict";

/**
 * Minimal fixed-window, per-key (per-IP) rate limiter for this service.
 * Protects our own endpoint and, indirectly, the upstream free quotas.
 */

class RateLimiter {
  constructor({ windowMs, max }) {
    this.windowMs = windowMs;
    this.max = max;
    this.hits = new Map(); // key -> { count, resetAt }
  }

  check(key) {
    const now = Date.now();
    let entry = this.hits.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + this.windowMs };
      this.hits.set(key, entry);
    }
    entry.count += 1;

    // opportunistic cleanup
    if (this.hits.size > 5000) {
      for (const [k, v] of this.hits) if (now > v.resetAt) this.hits.delete(k);
    }

    const remaining = Math.max(0, this.max - entry.count);
    return {
      allowed: entry.count <= this.max,
      remaining,
      limit: this.max,
      resetMs: Math.max(0, entry.resetAt - now),
    };
  }
}

module.exports = { RateLimiter };
