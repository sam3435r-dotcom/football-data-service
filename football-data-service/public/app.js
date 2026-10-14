"use strict";

/* Tiny front-end that consumes the normalized /api/football endpoint.
   No frameworks, no build step. */

const API_BASE = "/api/football";

const COMPETITIONS = [
  { code: "PL", name: "Premier League" },
  { code: "PD", name: "La Liga" },
  { code: "SA", name: "Serie A" },
  { code: "BL1", name: "Bundesliga" },
  { code: "FL1", name: "Ligue 1" },
  { code: "CL", name: "UEFA Champions League" },
  { code: "EL", name: "UEFA Europa League" },
  { code: "DED", name: "Eredivisie" },
  { code: "PPL", name: "Primeira Liga" },
  { code: "BSA", name: "Brasileirao Serie A" },
  { code: "ELC", name: "EFL Championship" },
];

/* Resources exposed as top tabs, and which of them take a competition param. */
const TAB_RESOURCES = ["livescores", "standings", "scorers", "player", "club"];
const COMP_RESOURCES = ["livescores", "fixtures", "standings", "scorers", "club"];

const state = { resource: "livescores", competition: "PL", q: "" };

const $ = (sel) => document.querySelector(sel);
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
};

/* Build HTML entities by concatenation so the literal sequences are never
   mangled in transit. */
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    if (c === "&") return "&" + "amp;";
    if (c === "<") return "&" + "lt;";
    if (c === ">") return "&" + "gt;";
    if (c === '"') return "&" + "quot;";
    return "&#" + "39;";
  });
}

function crest(team) {
  if (team && team.crest) {
    return '<img class="crest" src="' + esc(team.crest) + '" alt="" onerror="this.style.display=\'none\'">';
  }
  return "";
}

function statusPill(m) {
  const s = m.status || "UNKNOWN";
  if (s === "LIVE") {
    const min = m.minute ? m.minute + "'" : "LIVE";
    return '<span class="pill live"><span class="dot"></span> ' + esc(min) + "</span>";
  }
  if (s === "FINISHED") return '<span class="pill finished">FT</span>';
  if (s === "SCHEDULED") {
    const t = m.utcDate
      ? new Date(m.utcDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "";
    return '<span class="pill scheduled">' + esc(t || "Scheduled") + "</span>";
  }
  return '<span class="pill">' + esc(s) + "</span>";
}

function matchCard(m) {
  const card = el("div", "card");
  const comp = m.competition
    ? esc(m.competition.name) + (m.matchday ? " · " + esc(m.matchday) : "")
    : "";
  const hs = m.score && m.score.home;
  const as = m.score && m.score.away;
  const scoreText = hs == null && as == null ? "vs" : (hs == null ? 0 : hs) + " – " + (as == null ? 0 : as);
  card.innerHTML =
    '<div class="comp">' + comp + "</div>" +
    '<div class="match">' +
      '<div class="team home">' + crest(m.homeTeam) + "<span>" + esc((m.homeTeam && m.homeTeam.name) || "TBD") + "</span></div>" +
      '<div class="score">' + esc(scoreText) + "</div>" +
      '<div class="team away"><span>' + esc((m.awayTeam && m.awayTeam.name) || "TBD") + "</span>" + crest(m.awayTeam) + "</div>" +
    "</div>" +
    '<div class="statusline">' + statusPill(m) + (m.venue ? "<span>" + esc(m.venue) + "</span>" : "") + "</div>";
  return card;
}

function formHtml(form) {
  if (!form) return "";
  return '<span class="form">' + String(form).slice(-5).split("").map(function (c) {
    return '<i class="' + esc(c) + '">' + esc(c) + "</i>";
  }).join("") + "</span>";
}

function standingsCard(d) {
  const card = el("div", "card");
  const rows = (d.table || []).map(function (r) {
    return "<tr>" +
      '<td class="pos">' + esc(r.position) + "</td>" +
      '<td><div class="teamcell">' + crest(r.team) + "<span>" + esc(r.team && r.team.name) + "</span></div></td>" +
      '<td class="num">' + esc(r.played) + "</td>" +
      '<td class="num">' + esc(r.won) + "</td>" +
      '<td class="num">' + esc(r.draw) + "</td>" +
      '<td class="num">' + esc(r.lost) + "</td>" +
      '<td class="num">' + esc(r.goalDifference) + "</td>" +
      '<td class="num"><b>' + esc(r.points) + "</b></td>" +
      "<td>" + formHtml(r.form) + "</td>" +
    "</tr>";
  }).join("");
  card.innerHTML =
    '<div class="comp">' + esc(d.competition && d.competition.name) +
      (d.season && d.season.currentMatchday ? " · Matchday " + esc(d.season.currentMatchday) : "") + "</div>" +
    "<table><thead><tr>" +
      "<th>#</th><th>Team</th><th class=\"num\">P</th><th class=\"num\">W</th>" +
      "<th class=\"num\">D</th><th class=\"num\">L</th><th class=\"num\">GD</th><th class=\"num\">Pts</th><th>Form</th>" +
    "</tr></thead><tbody>" + rows + "</tbody></table>";
  return card;
}

function scorersCard(d) {
  const card = el("div", "card");
  const rows = (d.scorers || []).map(function (s) {
    const photo = s.player && s.player.photo ? '<img class="crest" src="' + esc(s.player.photo) + '" alt="">' : "";
    return "<tr>" +
      '<td class="pos">' + esc(s.rank) + "</td>" +
      '<td><div class="teamcell">' + photo + "<span>" + esc(s.player && s.player.name) + "</span></div></td>" +
      '<td><div class="teamcell">' + crest(s.team) + "<span>" + esc(s.team && s.team.name) + "</span></div></td>" +
      '<td class="num"><b>' + esc(s.goals) + "</b></td>" +
      '<td class="num">' + esc(s.assists) + "</td>" +
      '<td class="num">' + esc(s.appearances) + "</td>" +
    "</tr>";
  }).join("");
  card.innerHTML =
    '<div class="comp">' + esc(d.competition && d.competition.name) + " · Top Scorers</div>" +
    "<table><thead><tr><th>#</th><th>Player</th><th>Team</th>" +
      "<th class=\"num\">Goals</th><th class=\"num\">Assists</th><th class=\"num\">Apps</th></tr></thead>" +
    "<tbody>" + rows + "</tbody></table>";
  return card;
}

function personCard(p) {
  const card = el("div", "card");
  const name = (p.player && p.player.name) || (p.club && p.club.name) || "Unknown";
  const sub = p.player
    ? [p.player.nationality, p.player.position, p.player.age ? p.player.age + "y" : ""].filter(Boolean).join(" · ")
    : [p.club && p.club.country, p.club && p.club.venue, p.club && p.club.founded ? "est. " + p.club.founded : ""].filter(Boolean).join(" · ");
  const photo = (p.player && p.player.photo) || (p.club && p.club.crest);

  const stats = [];
  if (p.player && p.statistics && p.statistics[0]) {
    const s = p.statistics[0];
    stats.push(["Goals", s.goals], ["Assists", s.assists], ["Apps", s.appearances], ["Minutes", s.minutes], ["Rating", s.rating]);
  }
  if (p.club && p.stats) {
    stats.push(["Played", p.stats.fixtures && p.stats.fixtures.played], ["Wins", p.stats.fixtures && p.stats.fixtures.wins],
      ["Draws", p.stats.fixtures && p.stats.fixtures.draws], ["Losses", p.stats.fixtures && p.stats.fixtures.losses],
      ["GF", p.stats.goals && p.stats.goals.for], ["GA", p.stats.goals && p.stats.goals.against]);
  }

  card.innerHTML =
    '<div class="person">' +
      '<div class="avatar">' + (photo ? '<img src="' + esc(photo) + '" alt="">' : "⚽") + "</div>" +
      "<div><h3>" + esc(name) + "</h3><p>" + esc(sub) + "</p>" +
        (p.team ? "<p>" + crest(p.team) + " " + esc(p.team.name) + "</p>" : "") +
      "</div>" +
    "</div>" +
    (stats.length
      ? '<div class="stats">' + stats.filter(function (kv) { return kv[1] !== undefined && kv[1] !== null; })
          .map(function (kv) { return '<div class="stat"><b>' + esc(kv[1]) + "</b><span>" + esc(kv[0]) + "</span></div>"; }).join("") + "</div>"
      : "");
  return card;
}

function render(body) {
  const results = $("#results");
  results.innerHTML = "";
  const data = body.data;
  const empty = (msg) => results.appendChild(el("div", "empty", esc(msg)));

  if (body.ok === false) return empty(body.note || "Unavailable.");
  if (!data || (Array.isArray(data) && data.length === 0)) return empty("No results.");

  if (state.resource === "livescores" || state.resource === "fixtures") {
    data.forEach((m) => results.appendChild(matchCard(m)));
  } else if (state.resource === "standings") {
    results.appendChild(standingsCard(data));
  } else if (state.resource === "scorers") {
    results.appendChild(scorersCard(data));
  } else if (state.resource === "player" || state.resource === "club") {
    if (!data.length) return empty("No match found.");
    data.forEach((p) => results.appendChild(personCard(p)));
  }
}

function buildUrl() {
  const params = new URLSearchParams({ resource: state.resource });
  if (["livescores", "fixtures", "standings", "scorers", "club"].includes(state.resource)) {
    params.set("competition", state.competition);
  }
  if ((state.resource === "player" || state.resource === "club") && state.q) {
    params.set("q", state.q);
  }
  return API_BASE + "?" + params.toString();
}

async function load() {
  const results = $("#results");
  const meta = $("#meta");
  syncUrl();
  results.innerHTML = '<div class="loading">Loading…</div>';
  meta.innerHTML = "";
  $("#status").textContent = "Loading…";

  const url = buildUrl();
  $("#endpointUrl").textContent = location.origin + url;

  try {
    const res = await fetch(url);
    const body = await res.json();

    meta.innerHTML = [
      body.provider ? '<span class="badge provider">source: ' + esc(body.provider) + "</span>" : "",
      body.mock ? '<span class="badge mock">MOCK DATA</span>' : "",
      body.count != null ? '<span class="badge">' + esc(body.count) + " rows</span>" : "",
      body.note ? '<span class="note">' + esc(body.note) + "</span>" : "",
    ].join("");

    $("#status").textContent = body.mock ? "Mock data" : "Live";
    render(body);
  } catch (err) {
    $("#status").textContent = "Error";
    results.innerHTML = '<div class="empty">Could not reach the API.</div>';
  }
}

function applyResourceUI() {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.resource === state.resource));
  const needsQuery = state.resource === "player" || state.resource === "club";
  $("#queryField").hidden = !needsQuery;
  $("#competitionField").hidden = state.resource === "player";
  $("#queryLabel").textContent = state.resource === "player" ? "Player name" : "Club name";
  $("#query").placeholder = state.resource === "player" ? "e.g. Salah" : "e.g. Liverpool";
  $("#query").value = state.q || "";
}

function initFromUrl() {
  const p = new URLSearchParams(location.search);
  const r = p.get("resource");
  if (r && TAB_RESOURCES.includes(r)) state.resource = r;
  const c = p.get("competition");
  if (c) state.competition = c.toUpperCase();
  const q = p.get("q");
  if (q) state.q = q;
}

function syncUrl() {
  const p = new URLSearchParams();
  p.set("resource", state.resource);
  if (COMP_RESOURCES.includes(state.resource)) p.set("competition", state.competition);
  if ((state.resource === "player" || state.resource === "club") && state.q) p.set("q", state.q);
  history.replaceState(null, "", "?" + p.toString());
}

function setupControls() {
  const compSel = $("#competition");
  compSel.innerHTML = COMPETITIONS.map((c) => '<option value="' + c.code + '">' + esc(c.name) + "</option>").join("");
  compSel.value = state.competition;
  compSel.addEventListener("change", () => { state.competition = compSel.value; load(); });

  const q = $("#query");
  let t;
  q.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(() => { state.q = q.value.trim(); load(); }, 350);
  });

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      state.resource = tab.dataset.resource;
      applyResourceUI();
      load();
    });
  });

  $("#refresh").addEventListener("click", load);
  $("#copyEndpoint").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText($("#endpointUrl").textContent);
      $("#copyEndpoint").textContent = "Copied!";
      setTimeout(() => ($("#copyEndpoint").textContent = "Copy URL"), 1500);
    } catch (e) {}
  });
}

initFromUrl();
setupControls();
applyResourceUI();
load();
