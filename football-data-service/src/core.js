"use strict";

/**
 * Core dispatcher: turns a { resource, params } request into a normalized,
 * cached response. Never throws — always returns a safe object the HTTP
 * adapters (server.js / api/football.js) can serialize.
 */

const config = require("./config");
const { TTLCache } = require("./cache");
const providers = require("./providers");
const { getCompetition, listCompetitions } = require("./competitions");
const mock = require("./mock/data");
const {
  cleanString,
  cleanCompetition,
  cleanDate,
  cleanSeason,
  clampInt,
  todayUTC,
} = require("./validate");

const cache = new TTLCache();
const startedAt = Date.now();

const RESOURCES = [
  "livescores",
  "fixtures",
  "standings",
  "scorers",
  "player",
  "club",
  "competitions",
  "health",
];

function computeCount(data) {
  if (Array.isArray(data)) return data.length;
  if (data && Array.isArray(data.table)) return data.table.length;
  if (data && Array.isArray(data.scorers)) return data.scorers.length;
  if (data && Array.isArray(data.competitions)) return data.competitions.length;
  return undefined;
}

function envelope(resource, { provider, isMock, data, note }) {
  const body = {
    ok: true,
    resource,
    provider: provider || null,
    mock: Boolean(isMock),
    generatedAt: new Date().toISOString(),
    count: computeCount(data),
    data,
  };
  if (note) body.note = note;
  return body;
}

function mockNote(errors) {
  const enabledCount = providers.enabled().length;
  if (enabledCount === 0) {
    return "No provider API key configured. Set FOOTBALL_DATA_API_KEY and/or API_FOOTBALL_KEY to serve live data. Returning clearly-labelled mock data.";
  }
  const detail = errors.length ? ` (${errors.join(" | ")})` : "";
  return `All configured providers failed${detail}. Returning clearly-labelled mock data.`;
}

/**
 * Try each enabled provider for a capability, in priority order.
 * Falls back to mock data (or an "unavailable" object) on total failure.
 */
async function withFallback({ resource, capability, cacheKey, ttl, run, mockFn }) {
  const cached = cache.get(cacheKey);
  if (cached) return { body: cached, cacheSeconds: ttl };

  const errors = [];
  for (const provider of providers.forCapability(capability)) {
    if (!provider.isEnabled()) continue;
    try {
      const data = await run(provider);
      const body = envelope(resource, { provider: provider.id, isMock: false, data });
      cache.set(cacheKey, body, ttl);
      return { body, cacheSeconds: ttl };
    } catch (err) {
      errors.push(`${provider.id}: ${err.message}`);
    }
  }

  if (config.allowMockFallback && mockFn) {
    const body = envelope(resource, {
      provider: "mock",
      isMock: true,
      data: mockFn(),
      note: mockNote(errors),
    });
    // If no key is configured, cache mock briefly so a newly-added key is picked
    // up fast. If providers exist but are failing, back off a little longer so we
    // don't hammer their (small) free quotas.
    const noKey = providers.enabled().length === 0;
    const mockTtl = noKey ? 30 : Math.min(ttl, 120);
    cache.set(cacheKey, body, mockTtl);
    return { body, cacheSeconds: mockTtl };
  }

  return {
    body: {
      ok: false,
      resource,
      provider: null,
      mock: false,
      generatedAt: new Date().toISOString(),
      error: "unavailable",
      note: mockNote(errors),
      data: null,
    },
    cacheSeconds: 15,
  };
}

/* ------------------------------------------------------------------ */
/* Resource handlers                                                   */
/* ------------------------------------------------------------------ */

async function handleLivescores(params) {
  const competition = cleanCompetition(params.competition);
  const date = cleanDate(params.date) || todayUTC();
  const comp = competition ? getCompetition(competition) : null;
  const ttl = config.cache.live;

  return withFallback({
    resource: "livescores",
    capability: "livescores",
    cacheKey: `livescores:${competition || "all"}:${date}`,
    ttl,
    mockFn: mock.mockLivescores,
    run: async (provider) => {
      let matches;
      if (provider.id === "api-football") {
        matches = await provider.getFixturesByDate(date);
      } else {
        matches = await provider.getMatches({ competition: comp?.code, dateFrom: date, dateTo: date });
      }
      if (comp) matches = matches.filter((m) => m.competition?.code === comp.code);
      return matches.slice(0, config.maxResults);
    },
  });
}

async function handleFixtures(params) {
  const competition = cleanCompetition(params.competition);
  const date = cleanDate(params.date) || todayUTC();
  const comp = competition ? getCompetition(competition) : null;

  return withFallback({
    resource: "fixtures",
    capability: "livescores",
    cacheKey: `fixtures:${competition || "all"}:${date}`,
    ttl: config.cache.fixtures,
    mockFn: mock.mockLivescores,
    run: async (provider) => {
      let matches;
      if (provider.id === "api-football") {
        matches = await provider.getFixturesByDate(date);
      } else {
        matches = await provider.getMatches({ competition: comp?.code, dateFrom: date, dateTo: date });
      }
      if (comp) matches = matches.filter((m) => m.competition?.code === comp.code);
      return matches.slice(0, config.maxResults);
    },
  });
}

async function handleStandings(params) {
  const competition = cleanCompetition(params.competition) || config.defaults.competition;
  const season = cleanSeason(params.season, config.defaults.season);
  const comp = getCompetition(competition);
  const ttl = config.cache.standings;

  if (!comp) {
    return { body: { ok: false, resource: "standings", error: "unknown_competition", note: `Unknown competition code "${competition}". See /api/football?resource=competitions.`, data: null }, cacheSeconds: 60 };
  }

  return withFallback({
    resource: "standings",
    capability: "standings",
    cacheKey: `standings:${comp.code}:${season}`,
    ttl,
    mockFn: mock.mockStandings,
    run: (provider) => provider.getStandings({ competition: comp.code, season }),
  });
}

async function handleScorers(params) {
  const competition = cleanCompetition(params.competition) || config.defaults.competition;
  const season = cleanSeason(params.season, config.defaults.season);
  const limit = clampInt(params.limit, 1, config.maxResults, 20);
  const comp = getCompetition(competition);
  const ttl = config.cache.scorers;

  if (!comp) {
    return { body: { ok: false, resource: "scorers", error: "unknown_competition", note: `Unknown competition code "${competition}". See /api/football?resource=competitions.`, data: null }, cacheSeconds: 60 };
  }

  return withFallback({
    resource: "scorers",
    capability: "scorers",
    cacheKey: `scorers:${comp.code}:${season}:${limit}`,
    ttl,
    mockFn: () => {
      const m = mock.mockScorers();
      m.scorers = m.scorers.slice(0, limit);
      return m;
    },
    run: (provider) => provider.getScorers({ competition: comp.code, season, limit }),
  });
}

async function handlePlayer(params) {
  const q = cleanString(params.q || params.name, 60);
  const season = cleanSeason(params.season, config.defaults.season);
  const ttl = config.cache.lookup;

  if (!q) {
    return { body: { ok: false, resource: "player", error: "missing_query", note: "Provide ?q=<player name>.", data: null }, cacheSeconds: 60 };
  }

  return withFallback({
    resource: "player",
    capability: "player",
    cacheKey: `player:${q.toLowerCase()}:${season}`,
    ttl,
    mockFn: () => mock.mockPlayers().filter((p) => p.player.name.toLowerCase().includes(q.toLowerCase())),
    run: (provider) => provider.searchPlayer({ q, season }),
  });
}

async function handleClub(params) {
  const q = cleanString(params.q || params.name, 60);
  const competition = cleanCompetition(params.competition) || config.defaults.competition;
  const season = cleanSeason(params.season, config.defaults.season);
  const teamId = clampInt(params.teamId, 1, 10_000_000, 0);
  const ttl = config.cache.lookup;

  if (!q && !teamId) {
    return { body: { ok: false, resource: "club", error: "missing_query", note: "Provide ?q=<club name> (or ?teamId= for stats).", data: null }, cacheSeconds: 60 };
  }

  // With a teamId we fetch club statistics directly.
  if (teamId) {
    return withFallback({
      resource: "club",
      capability: "club",
      cacheKey: `clubstats:${competition}:${season}:${teamId}`,
      ttl,
      mockFn: mock.mockClubs,
      run: (provider) => {
        if (typeof provider.getClubStats !== "function") {
          throw new Error("stats not supported by this provider");
        }
        return provider.getClubStats({ competition, season, teamId });
      },
    });
  }

  return withFallback({
    resource: "club",
    capability: "club",
    cacheKey: `club:${q.toLowerCase()}:${competition}`,
    ttl,
    mockFn: () => mock.mockClubs().filter((c) => c.club.name.toLowerCase().includes(q.toLowerCase())),
    run: (provider) => {
      if (provider.id === "api-football") return provider.searchClub({ q });
      return provider.findClub({ q, competition });
    },
  });
}

async function handleCompetitions() {
  const body = {
    ok: true,
    resource: "competitions",
    provider: "catalogue",
    mock: false,
    generatedAt: new Date().toISOString(),
    count: listCompetitions().length,
    data: listCompetitions(),
  };
  return { body, cacheSeconds: config.cache.competitions };
}

async function handleHealth() {
  const body = {
    ok: true,
    resource: "health",
    generatedAt: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    cacheEntries: cache.size(),
    providers: providers.describe(),
    defaults: config.defaults,
    mockFallback: config.allowMockFallback,
  };
  return { body, cacheSeconds: 10 };
}

/* ------------------------------------------------------------------ */
/* Public entry point                                                  */
/* ------------------------------------------------------------------ */

async function dispatch({ resource, params = {} } = {}) {
  const name = cleanString(resource, 24).toLowerCase();
  try {
    switch (name) {
      case "livescores":
      case "live":
      case "scores":
        return await handleLivescores(params);
      case "fixtures":
        return await handleFixtures(params);
      case "standings":
      case "table":
        return await handleStandings(params);
      case "scorers":
      case "topscorers":
        return await handleScorers(params);
      case "player":
      case "players":
        return await handlePlayer(params);
      case "club":
      case "team":
        return await handleClub(params);
      case "competitions":
      case "leagues":
        return await handleCompetitions();
      case "health":
        return await handleHealth();
      default:
        return {
          body: {
            ok: false,
            resource: name || null,
            error: "unknown_resource",
            note: `Unknown resource "${name}". Available: ${RESOURCES.join(", ")}.`,
            data: null,
          },
          cacheSeconds: 60,
        };
    }
  } catch (err) {
    // Absolute last resort — never leak a stack trace.
    return {
      body: {
        ok: false,
        resource: name || null,
        error: "internal_error",
        note: "Something went wrong handling this request.",
        data: null,
      },
      cacheSeconds: 10,
    };
  }
}

module.exports = { dispatch, RESOURCES, cache };
