"use strict";

/**
 * Friendly competition catalogue.
 * A caller passes ONE friendly `code` (e.g. "PL") and each provider maps it to
 * its own identifier, so the frontend never has to know provider-specific ids.
 */

const COMPETITIONS = [
  { code: "PL", name: "Premier League", country: "England", footballDataCode: "PL", apiFootballId: 39 },
  { code: "PD", name: "La Liga", country: "Spain", footballDataCode: "PD", apiFootballId: 140 },
  { code: "SA", name: "Serie A", country: "Italy", footballDataCode: "SA", apiFootballId: 135 },
  { code: "BL1", name: "Bundesliga", country: "Germany", footballDataCode: "BL1", apiFootballId: 78 },
  { code: "FL1", name: "Ligue 1", country: "France", footballDataCode: "FL1", apiFootballId: 61 },
  { code: "CL", name: "UEFA Champions League", country: "Europe", footballDataCode: "CL", apiFootballId: 2 },
  { code: "EL", name: "UEFA Europa League", country: "Europe", footballDataCode: "EL", apiFootballId: 3 },
  { code: "DED", name: "Eredivisie", country: "Netherlands", footballDataCode: "DED", apiFootballId: 88 },
  { code: "PPL", name: "Primeira Liga", country: "Portugal", footballDataCode: "PPL", apiFootballId: 94 },
  { code: "BSA", name: "Brasileirao Serie A", country: "Brazil", footballDataCode: "BSA", apiFootballId: 71 },
  { code: "ELC", name: "EFL Championship", country: "England", footballDataCode: "ELC", apiFootballId: 40 },
];

const BY_CODE = new Map(COMPETITIONS.map((c) => [c.code, c]));

function getCompetition(code) {
  if (!code) return null;
  return BY_CODE.get(String(code).toUpperCase()) || null;
}

function listCompetitions() {
  return COMPETITIONS.map((c) => ({
    code: c.code,
    name: c.name,
    country: c.country,
  }));
}

module.exports = { COMPETITIONS, getCompetition, listCompetitions };
