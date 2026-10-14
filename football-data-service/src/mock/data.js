"use strict";

/**
 * Clearly-labelled MOCK data used only when no provider key is configured or
 * every provider fails. It lets the frontend and the API be developed and
 * demoed without spending any free-tier quota. Every response built from this
 * file is marked `"mock": true` and carries a `note`.
 */

function iso(offsetMinutes) {
  return new Date(Date.now() + offsetMinutes * 60_000).toISOString();
}

function mockLivescores() {
  return [
    {
      id: "mock-1",
      competition: { code: "PL", name: "Premier League" },
      utcDate: iso(-55),
      status: "LIVE",
      statusRaw: "2H",
      minute: 67,
      matchday: "Matchday 12",
      venue: "Emirates Stadium",
      homeTeam: { id: 57, name: "Arsenal FC", shortName: "Arsenal", crest: null },
      awayTeam: { id: 61, name: "Chelsea FC", shortName: "Chelsea", crest: null },
      score: { home: 2, away: 1, halfTime: { home: 1, away: 1 }, winner: null },
    },
    {
      id: "mock-2",
      competition: { code: "PD", name: "La Liga" },
      utcDate: iso(-30),
      status: "LIVE",
      statusRaw: "1H",
      minute: 38,
      matchday: "Matchday 14",
      venue: "Spotify Camp Nou",
      homeTeam: { id: 81, name: "FC Barcelona", shortName: "Barcelona", crest: null },
      awayTeam: { id: 86, name: "Real Madrid CF", shortName: "Real Madrid", crest: null },
      score: { home: 0, away: 0, halfTime: { home: 0, away: 0 }, winner: null },
    },
    {
      id: "mock-3",
      competition: { code: "SA", name: "Serie A" },
      utcDate: iso(120),
      status: "SCHEDULED",
      statusRaw: "NS",
      minute: null,
      matchday: "Matchday 13",
      venue: "San Siro",
      homeTeam: { id: 108, name: "Inter Milan", shortName: "Inter", crest: null },
      awayTeam: { id: 98, name: "AC Milan", shortName: "Milan", crest: null },
      score: { home: null, away: null, halfTime: { home: null, away: null }, winner: null },
    },
    {
      id: "mock-4",
      competition: { code: "BL1", name: "Bundesliga" },
      utcDate: iso(-180),
      status: "FINISHED",
      statusRaw: "FT",
      minute: 90,
      matchday: "Matchday 11",
      venue: "Allianz Arena",
      homeTeam: { id: 5, name: "FC Bayern München", shortName: "Bayern", crest: null },
      awayTeam: { id: 4, name: "Borussia Dortmund", shortName: "Dortmund", crest: null },
      score: { home: 3, away: 2, halfTime: { home: 2, away: 0 }, winner: "HOME_TEAM" },
    },
  ];
}

function mockStandings() {
  const rows = [
    ["Liverpool FC", "Liverpool", 12, 10, 1, 1, 28, 10, 18, 31, "WWWDW"],
    ["Arsenal FC", "Arsenal", 12, 8, 3, 1, 24, 12, 12, 27, "WWDWW"],
    ["Manchester City FC", "Man City", 12, 8, 2, 2, 26, 15, 11, 26, "LWWWD"],
    ["Chelsea FC", "Chelsea", 12, 6, 4, 2, 22, 15, 7, 22, "DWLWW"],
    ["Tottenham Hotspur FC", "Tottenham", 12, 6, 2, 4, 21, 18, 3, 20, "WLLDW"],
    ["Aston Villa FC", "Aston Villa", 12, 5, 4, 3, 19, 17, 2, 19, "DDWLD"],
    ["Newcastle United FC", "Newcastle", 12, 5, 3, 4, 18, 16, 2, 18, "WLWDL"],
    ["Brighton & Hove Albion FC", "Brighton", 12, 4, 5, 3, 17, 16, 1, 17, "DDDWW"],
  ];
  return {
    competition: { code: "PL", name: "Premier League" },
    season: { id: 2024, startDate: "2024-08-16", endDate: "2025-05-25", currentMatchday: 12 },
    table: rows.map((r, i) => ({
      position: i + 1,
      team: { id: 100 + i, name: r[0], shortName: r[1], crest: null },
      played: r[2],
      won: r[3],
      draw: r[4],
      lost: r[5],
      goalsFor: r[6],
      goalsAgainst: r[7],
      goalDifference: r[8],
      points: r[9],
      form: r[10],
    })),
  };
}

function mockScorers() {
  const rows = [
    ["Erling Haaland", "Manchester City FC", "Man City", 14, 3, 2, 12, 1080, 7.8],
    ["Mohamed Salah", "Liverpool FC", "Liverpool", 12, 8, 1, 12, 1080, 7.9],
    ["Cole Palmer", "Chelsea FC", "Chelsea", 10, 6, 4, 12, 1040, 7.6],
    ["Bukayo Saka", "Arsenal FC", "Arsenal", 8, 7, 2, 12, 1010, 7.5],
    ["Alexander Isak", "Newcastle United FC", "Newcastle", 8, 2, 0, 11, 940, 7.3],
    ["Ollie Watkins", "Aston Villa FC", "Aston Villa", 7, 4, 0, 12, 1050, 7.2],
  ];
  return {
    competition: { code: "PL", name: "Premier League" },
    season: 2024,
    scorers: rows.map((r, i) => ({
      rank: i + 1,
      player: { id: 200 + i, name: r[0], nationality: null, age: null, photo: null },
      team: { id: 300 + i, name: r[1], shortName: r[2], crest: null },
      goals: r[3],
      assists: r[4],
      penalties: r[5],
      appearances: r[6],
      minutes: r[7],
      rating: r[8],
    })),
  };
}

function mockPlayers() {
  return [
    {
      player: {
        id: 306,
        name: "Mohamed Salah",
        firstname: "Mohamed",
        lastname: "Salah",
        age: 32,
        nationality: "Egypt",
        height: "175 cm",
        weight: "71 kg",
        photo: null,
        position: "Attacker",
      },
      team: { id: 40, name: "Liverpool FC", shortName: "Liverpool", crest: null },
      statistics: [
        {
          league: { id: 39, name: "Premier League", country: "England", season: 2024 },
          appearances: 12,
          lineups: 12,
          minutes: 1080,
          rating: 7.9,
          goals: 12,
          assists: 8,
          shots: 44,
          passes: 520,
          keyPasses: 31,
          tackles: 12,
          duelsWon: 48,
          dribbles: 22,
          yellowCards: 1,
          redCards: 0,
          penaltyScored: 1,
        },
      ],
    },
  ];
}

function mockClubs() {
  return [
    {
      club: {
        id: 40,
        name: "Liverpool FC",
        shortName: "LFC",
        crest: null,
        country: "England",
        founded: 1892,
        venue: "Anfield",
        capacity: 61276,
        city: "Liverpool",
      },
      stats: {
        competition: { code: "PL", name: "Premier League" },
        season: 2024,
        form: "WWWDW",
        fixtures: { played: 12, wins: 10, draws: 1, losses: 1 },
        goals: { for: 28, against: 10 },
        cleanSheets: 6,
        failedToScore: 1,
      },
    },
  ];
}

module.exports = { mockLivescores, mockStandings, mockScorers, mockPlayers, mockClubs };
