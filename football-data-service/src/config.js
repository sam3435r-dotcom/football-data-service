"use strict";

/**
 * Configuration + a tiny zero-dependency .env loader.
 * Keys are read from process.env only — they are never sent to the browser.
 */

const fs = require("fs");
const path = require("path");

function loadDotEnv(file) {
  try {
    const content = fs.readFileSync(file, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (key && !(key in process.env)) process.env[key] = value;
    }
  } catch {
    /* no .env file — that's fine */
  }
}

loadDotEnv(path.join(__dirname, "..", ".env"));

function int(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

const config = {
  port: int(process.env.PORT, 8787),

  providers: {
    footballData: {
      id: "football-data",
      label: "football-data.org",
      baseUrl: "https://api.football-data.org/v4",
      apiKey: process.env.FOOTBALL_DATA_API_KEY || "",
      // Free plan: 10 req/min. We stay well under with caching.
      enabled: Boolean(process.env.FOOTBALL_DATA_API_KEY),
    },
    apiFootball: {
      id: "api-football",
      label: "API-Football",
      baseUrl: "https://v3.football.api-sports.io",
      apiKey: process.env.API_FOOTBALL_KEY || "",
      // Free plan: 100 req/day + 10 req/min.
      enabled: Boolean(process.env.API_FOOTBALL_KEY),
    },
  },

  // Cache TTLs in seconds (also used for Cache-Control s-maxage).
  cache: {
    live: 30, // live scores change constantly
    fixtures: 60, // today's / upcoming fixtures
    standings: 600, // tables move slowly (10 min)
    scorers: 900, // top scorers (15 min)
    lookup: 3600, // club / player lookup (1 h)
    competitions: 86400, // static catalogue (1 day)
  },

  requestTimeoutMs: int(process.env.REQUEST_TIMEOUT_MS, 10000),

  // Hard cap on rows returned per request (protects the free quotas).
  maxResults: int(process.env.MAX_RESULTS, 100),

  // Simple per-IP limiter for THIS service (not the upstream providers).
  rateLimit: {
    windowMs: 60_000,
    max: int(process.env.RATE_LIMIT_PER_MIN, 90),
  },

  defaults: {
    competition: (process.env.DEFAULT_COMPETITION || "PL").toUpperCase(),
    season: int(process.env.DEFAULT_SEASON, 2024),
  },

  allowMockFallback: process.env.ALLOW_MOCK_FALLBACK !== "false",
};

module.exports = config;
