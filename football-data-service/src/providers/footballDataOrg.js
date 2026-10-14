"use strict";

/**
 * Provider: football-data.org (v4)
 * Docs:  https://www.football-data.org/documentation/api
 * Auth:  X-Auth-Token header
 * Free:  10 requests/min, 12 competitions, DELAYED scores, NO player statistics.
 * Best for: standings (tables + form), top scorers, fixtures/matches.
 */

const config = require("../config");
const { fetchJson } = require("../http");
const { getCompetition } = require("../competitions");

const STATUS_MAP = {
  SCHEDULED: "SCHEDULED",
  TIMED: "SCHEDULED",
  IN_PLAY: "LIVE",
  PAUSED: "LIVE",
  FINISHED: "FINISHED",
  AWARDED: "FINISHED",
  SUSPENDED: "SUSPENDED",
  POSTPONED: "POSTPONED",
  CANCELLED: "CANCELLED",
};

function mapStatus(s) {
  return STATUS_MAP[s] || "UNKNOWN";
}

function team(t) {
  if (!t) return null;
  return {
    id: t.id ?? null,
    name: t.name || t.shortName || "Unknown",
    shortName: t.shortName || t.tla || t.name || "Unknown",
    crest: t.crest || t.crestURI || null,
  };
}

function mapMatch(m) {
  const comp = getCompetition(m.competition?.code) || null;
  return {
    id: String(m.id),
    competition: {
      code: comp ? comp.code : m.competition?.code || null,
      name: m.competition?.name || comp?.name || "Unknown",
    },
    utcDate: m.utcDate || null,
    status: mapStatus(m.status),
    statusRaw: m.status || null,
    minute: typeof m.minute === "number" ? m.minute : null,
    matchday: m.matchday ?? null,
    venue: m.venue || null,
    homeTeam: team(m.homeTeam),
    awayTeam: team(m.awayTeam),
    score: {
      home: m.score?.fullTime?.homeTeam ?? null,
      away: m.score?.fullTime?.awayTeam ?? null,
      halfTime: {
        home: m.score?.halfTime?.homeTeam ?? null,
        away: m.score?.halfTime?.awayTeam ?? null,
      },
      winner: m.score?.winner || null,
    },
  };
}

function mapStandings(data, comp) {
  const group = Array.isArray(data.standings)
    ? data.standings.find((s) => s.type === "TOTAL") || data.standings[0]
    : null;
  const table = (group?.table || []).map((row) => ({
    position: row.position,
    team: team(row.team),
    played: row.playedGames ?? null,
    won: row.won ?? null,
    draw: row.draw ?? null,
    lost: row.lost ?? null,
    goalsFor: row.goalsFor ?? null,
    goalsAgainst: row.goalsAgainst ?? null,
    goalDifference: row.goalDifference ?? null,
    points: row.points ?? null,
    form: row.form ? String(row.form).replace(/,/g, "") : null,
  }));

  return {
    competition: { code: comp.code, name: comp.name },
    season: data.season
      ? {
          id: data.season.id ?? null,
          startDate: data.season.startDate || null,
          endDate: data.season.endDate || null,
          currentMatchday: data.season.currentMatchday ?? null,
        }
      : null,
    table,
  };
}

function mapScorers(data, comp) {
  const scorers = (data.scorers || []).map((s, i) => ({
    rank: i + 1,
    player: {
      id: s.player?.id ?? null,
      name: s.player?.name || "Unknown",
      nationality: s.player?.nationality || null,
      position: s.player?.position || null,
    },
    team: team(s.team),
    goals: s.goals ?? null,
    assists: s.assists ?? null,
    penalties: s.penalties ?? null,
    appearances: s.playedMatches ?? null,
    minutes: null,
    rating: null,
  }));

  return {
    competition: { code: comp.code, name: comp.name },
    season: data.season ? { id: data.season.id ?? null, startDate: data.season.startDate || null, endDate: data.season.endDate || null } : null,
    scorers,
  };
}

function headers() {
  return { "X-Auth-Token": config.providers.footballData.apiKey };
}

async function request(pathname, query = {}) {
  const url = new URL(config.providers.footballData.baseUrl + pathname);
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  }
  const res = await fetchJson(url.toString(), { headers: headers() });
  if (!res.ok || !res.data) {
    const message =
      res.data?.message ||
      res.data?.error ||
      res.error ||
      `football-data.org responded with ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return res.data;
}

module.exports = {
  id: "football-data",
  label: "football-data.org",
  isEnabled: () => config.providers.footballData.enabled,
  supports: {
    livescores: true,
    standings: true,
    scorers: true,
    player: false, // no player stats on the free tier
    club: true, // via competition teams + name match
  },

  /** Today's matches (or a date range) across competitions. */
  async getMatches({ competition, dateFrom, dateTo } = {}) {
    const comp = competition ? getCompetition(competition) : null;
    if (comp) {
      const data = await request(`/competitions/${comp.footballDataCode}/matches`, {
        dateFrom,
        dateTo,
      });
      return (data.matches || []).map(mapMatch);
    }
    const data = await request(`/matches`, { dateFrom, dateTo });
    return (data.matches || []).map(mapMatch);
  },

  async getStandings({ competition, season } = {}) {
    const comp = getCompetition(competition);
    if (!comp) throw new Error("Unknown competition code");
    const data = await request(`/competitions/${comp.footballDataCode}/standings`, { season });
    return mapStandings(data, comp);
  },

  async getScorers({ competition, season, limit } = {}) {
    const comp = getCompetition(competition);
    if (!comp) throw new Error("Unknown competition code");
    const data = await request(`/competitions/${comp.footballDataCode}/scorers`, {
      season,
      limit: limit || 20,
    });
    return mapScorers(data, comp);
  },

  /** Club lookup by name: search the team list of the given competition. */
  async findClub({ q, competition } = {}) {
    const comp = getCompetition(competition) || getCompetition(config.defaults.competition);
    if (!comp) throw new Error("Unknown competition code");
    const data = await request(`/competitions/${comp.footballDataCode}/teams`, {});
    const needle = String(q || "").toLowerCase();
    const matches = (data.teams || [])
      .filter((t) => {
        const hay = `${t.name || ""} ${t.shortName || ""} ${t.tla || ""}`.toLowerCase();
        return hay.includes(needle);
      })
      .slice(0, 10)
      .map((t) => ({
        club: {
          id: t.id ?? null,
          name: t.name || "Unknown",
          shortName: t.shortName || t.tla || null,
          crest: t.crest || t.crestURI || null,
          country: t.area?.name || null,
          founded: t.founded ?? null,
          venue: t.venue || null,
          colors: t.clubColors || null,
          website: t.website || null,
        },
        stats: null,
      }));
    return matches;
  },
};
