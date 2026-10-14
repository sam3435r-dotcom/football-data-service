"use strict";

/**
 * Provider: API-Football (api-sports.io) v3
 * Docs:  https://www.api-football.com/documentation-v3
 * Auth:  x-apisports-key header
 * Free:  100 requests/day AND 10 requests/min (all endpoints, limited seasons).
 * Best for: LIVE scores (minute-by-minute), player stats, team stats, search.
 *
 * Note: API-Sports advise against calling from shared-IP serverless platforms
 * (Vercel/Lambda) because rate limiting is also enforced per IP. A static IP or
 * a long-running host is preferable. Caching here reduces the call volume a lot.
 */

const config = require("../config");
const { fetchJson } = require("../http");
const { getCompetition, COMPETITIONS } = require("../competitions");

const STATUS_MAP = {
  TBD: "SCHEDULED",
  NS: "SCHEDULED",
  "1H": "LIVE",
  HT: "LIVE",
  "2H": "LIVE",
  ET: "LIVE",
  BT: "LIVE",
  P: "LIVE",
  SUSP: "LIVE",
  INT: "LIVE",
  LIVE: "LIVE",
  FT: "FINISHED",
  AET: "FINISHED",
  PEN: "FINISHED",
  AWD: "FINISHED",
  WO: "FINISHED",
  PST: "POSTPONED",
  CANC: "CANCELLED",
  ABD: "ABANDONED",
};

function mapStatus(short) {
  return STATUS_MAP[short] || "UNKNOWN";
}

function team(t) {
  if (!t) return null;
  return { id: t.id ?? null, name: t.name || "Unknown", shortName: t.name || "Unknown", crest: t.logo || null };
}

function mapFixture(item) {
  const f = item.fixture || {};
  return {
    id: String(f.id),
    competition: {
      code: leagueCodeFromId(item.league?.id),
      name: item.league?.name || "Unknown",
      country: item.league?.country || null,
    },
    utcDate: f.date || null,
    status: mapStatus(f.status?.short),
    statusRaw: f.status?.short || null,
    minute: typeof f.status?.elapsed === "number" ? f.status.elapsed : null,
    matchday: item.league?.round || null,
    venue: f.venue?.name || null,
    homeTeam: team(item.teams?.home),
    awayTeam: team(item.teams?.away),
    score: {
      home: item.goals?.home ?? null,
      away: item.goals?.away ?? null,
      halfTime: { home: item.score?.halftime?.home ?? null, away: item.score?.halftime?.away ?? null },
      winner: item.teams?.home?.winner ? "HOME_TEAM" : item.teams?.away?.winner ? "AWAY_TEAM" : null,
    },
  };
}

function leagueCodeFromId(id) {
  if (!id) return null;
  const { COMPETITIONS } = require("../competitions");
  const found = COMPETITIONS.find((c) => c.apiFootballId === Number(id));
  return found ? found.code : null;
}

function mapStandings(data, comp) {
  const block = Array.isArray(data.response) ? data.response[0] : null;
  const rows = block?.standings?.[0] || [];
  const table = rows.map((row) => ({
    position: row.rank,
    team: team(row.team),
    played: row.all?.played ?? null,
    won: row.all?.win ?? null,
    draw: row.all?.draw ?? null,
    lost: row.all?.lose ?? null,
    goalsFor: row.all?.goals?.for ?? null,
    goalsAgainst: row.all?.goals?.against ?? null,
    goalDifference: row.goalsDiff ?? null,
    points: row.points ?? null,
    form: row.form ? String(row.form).replace(/,/g, "") : null,
  }));

  return {
    competition: { code: comp.code, name: comp.name },
    season: block?.league?.season ?? null,
    table,
  };
}

function mapScorers(data, comp) {
  const scorers = (data.response || []).map((item, i) => {
    const st = (item.statistics && item.statistics[0]) || {};
    return {
      rank: i + 1,
      player: {
        id: item.player?.id ?? null,
        name: item.player?.name || "Unknown",
        nationality: item.player?.nationality || null,
        age: item.player?.age ?? null,
        photo: item.player?.photo || null,
      },
      team: team(st.team),
      goals: st.goals?.total ?? null,
      assists: st.goals?.assists ?? null,
      penalties: st.penalty?.scored ?? null,
      appearances: st.games?.appearences ?? null,
      minutes: st.games?.minutes ?? null,
      rating: st.games?.rating ? Number(st.games.rating) : null,
    };
  });

  return {
    competition: { code: comp.code, name: comp.name },
    season: data.parameters?.season ? Number(data.parameters.season) : null,
    scorers,
  };
}

function mapPlayer(item) {
  const st = (item.statistics && item.statistics[0]) || {};
  return {
    player: {
      id: item.player?.id ?? null,
      name: item.player?.name || "Unknown",
      firstname: item.player?.firstname || null,
      lastname: item.player?.lastname || null,
      age: item.player?.age ?? null,
      nationality: item.player?.nationality || null,
      height: item.player?.height || null,
      weight: item.player?.weight || null,
      photo: item.player?.photo || null,
      position: st.games?.position || null,
    },
    team: team(st.team),
    statistics: (item.statistics || []).map((s) => ({
      league: { id: s.league?.id ?? null, name: s.league?.name || null, country: s.league?.country || null, season: s.league?.season ?? null },
      appearances: s.games?.appearences ?? null,
      lineups: s.games?.lineups ?? null,
      minutes: s.games?.minutes ?? null,
      rating: s.games?.rating ? Number(s.games.rating) : null,
      goals: s.goals?.total ?? null,
      assists: s.goals?.assists ?? null,
      shots: s.shots?.total ?? null,
      passes: s.passes?.total ?? null,
      keyPasses: s.passes?.key ?? null,
      tackles: s.tackles?.total ?? null,
      duelsWon: s.duels?.won ?? null,
      dribbles: s.dribbles?.success ?? null,
      yellowCards: s.cards?.yellow ?? null,
      redCards: s.cards?.red ?? null,
      penaltyScored: s.penalty?.scored ?? null,
    })),
  };
}

function headers() {
  return { "x-apisports-key": config.providers.apiFootball.apiKey };
}

async function request(pathname, query = {}) {
  const url = new URL(config.providers.apiFootball.baseUrl + pathname);
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  }
  const res = await fetchJson(url.toString(), { headers: headers() });
  const body = res.data;

  if (!res.ok || !body) {
    const message = res.error || `API-Football responded with ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  // API-Football returns HTTP 200 even for some errors; surface them.
  if (body.errors && Object.keys(body.errors).length > 0) {
    const err = new Error(Object.values(body.errors).join("; "));
    err.status = body.errors.rateLimit ? 429 : 400;
    throw err;
  }
  return body;
}

module.exports = {
  id: "api-football",
  label: "API-Football",
  isEnabled: () => config.providers.apiFootball.enabled,
  supports: { livescores: true, standings: true, scorers: true, player: true, club: true },

  async getLive() {
    const data = await request("/fixtures", { live: "all" });
    return (data.response || []).map(mapFixture);
  },

  async getFixturesByDate(date) {
    const data = await request("/fixtures", { date });
    return (data.response || []).map(mapFixture);
  },

  async getStandings({ competition, season } = {}) {
    const comp = getCompetition(competition);
    if (!comp) throw new Error("Unknown competition code");
    const data = await request("/standings", { league: comp.apiFootballId, season });
    return mapStandings(data, comp);
  },

  async getScorers({ competition, season, limit } = {}) {
    const comp = getCompetition(competition);
    if (!comp) throw new Error("Unknown competition code");
    const data = await request("/players/topscorers", { league: comp.apiFootballId, season });
    const mapped = mapScorers(data, comp);
    if (limit) mapped.scorers = mapped.scorers.slice(0, limit);
    return mapped;
  },

  async searchPlayer({ q, season } = {}) {
    const data = await request("/players", { search: q, season });
    return (data.response || []).map(mapPlayer);
  },

  async searchClub({ q } = {}) {
    const data = await request("/teams", { search: q });
    return (data.response || []).map((item) => ({
      club: {
        id: item.team?.id ?? null,
        name: item.team?.name || "Unknown",
        shortName: item.team?.code || null,
        crest: item.team?.logo || null,
        country: item.team?.country || null,
        founded: item.team?.founded ?? null,
        venue: item.venue?.name || null,
        capacity: item.venue?.capacity ?? null,
        city: item.venue?.city || null,
      },
      stats: null,
    }));
  },

  async getClubStats({ competition, season, teamId } = {}) {
    const comp = getCompetition(competition);
    if (!comp || !teamId) throw new Error("competition and teamId are required");
    const data = await request("/teams/statistics", {
      league: comp.apiFootballId,
      season,
      team: teamId,
    });
    const r = data.response || {};
    return {
      competition: { code: comp.code, name: comp.name },
      season: r.league?.season ?? null,
      form: r.form ? String(r.form).replace(/,/g, "") : null,
      fixtures: {
        played: r.fixtures?.played?.total ?? null,
        wins: r.fixtures?.wins?.total ?? null,
        draws: r.fixtures?.draws?.total ?? null,
        losses: r.fixtures?.loses?.total ?? null,
      },
      goals: {
        for: r.goals?.for?.total?.total ?? r.goals?.for?.total ?? null,
        against: r.goals?.against?.total?.total ?? r.goals?.against?.total ?? null,
      },
      cleanSheets: r.clean_sheet?.total ?? null,
      failedToScore: r.failed_to_score?.total ?? null,
    };
  },
};
