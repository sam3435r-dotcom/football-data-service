// ---------------------------------------------------------------------------
//  footballApi.js  —  drop-in client for your web app
//  Copy this into your project (e.g. src/services/footballApi.js) and set BASE
//  to your deployed service URL. Works in React, Vue, Svelte, or plain JS.
// ---------------------------------------------------------------------------

// 👉 CHANGE THIS to your deployed service URL (no trailing slash):
//    Render:  https://football-data-service.onrender.com
//    Railway: https://football-data-service.up.railway.app
//    Vercel:  https://football-data-service.vercel.app
//    Local:   http://localhost:8787
const BASE = "http://localhost:8787";

/**
 * Low-level call. Returns the full normalized envelope:
 *   { ok, resource, provider, mock, generatedAt, count, data, note }
 */
async function call(resource, params = {}) {
  const qs = new URLSearchParams({ resource, ...params }).toString();
  const res = await fetch(`${BASE}/api/football?${qs}`, {
    headers: { Accept: "application/json" },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.ok === false) {
    throw new Error(body.note || body.error || `Request failed (${res.status})`);
  }
  return body;
}

// --- Convenience helpers (all return the full envelope) --------------------

/** In-play / today's matches. competition is a code like "PL". */
export const getLiveScores = (competition = "PL") =>
  call("livescores", { competition });

/** League table + form. */
export const getStandings = (competition = "PL") =>
  call("standings", { competition });

/** Top scorers (optionally capped). */
export const getTopScorers = (competition = "PL", limit = 10) =>
  call("scorers", { competition, limit });

/** Player profile + stats (needs API-Football configured for real data). */
export const getPlayer = (q) => call("player", { q });

/** Club profile / stats. */
export const getClub = (q) => call("club", { q });

/** Supported competitions catalogue. */
export const getCompetitions = () => call("competitions");

// --- Example: only the rows, and a "is this real data?" flag ----------------
//
//   const { data, mock } = await getStandings("PL");
//   if (mock) console.warn("Showing sample data — add an API key on the server.");
//   console.table(data.table);
//
