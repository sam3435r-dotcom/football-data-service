"use strict";

/**
 * Vercel serverless adapter. Maps to /api/football (and /api/football/<resource>).
 * Reuses the exact same core dispatcher as the standalone server, so behaviour,
 * caching and mock fallback are identical.
 *
 * Deploy notes:
 *   - Set FOOTBALL_DATA_API_KEY and API_FOOTBALL_KEY as Environment Variables
 *     in the Vercel project (Production + Preview). Do NOT prefix with VITE_.
 *   - API-Sports rate-limits per IP as well as per key and discourage shared-IP
 *     serverless hosts; caching here keeps usage low, but a static-IP host is
 *     preferable for heavy use.
 */

const { dispatch } = require("../src/core");
const { cacheControl } = require("../src/cache");

module.exports = async (req, res) => {
  // resource can come from the path (/api/football/standings) or ?resource=
  const pathParts = (req.url || "").split("?")[0].split("/").filter(Boolean);
  const last = pathParts[pathParts.length - 1];
  const resource =
    (req.query && req.query.resource) ||
    (last && last !== "football" ? last : "livescores");

  const params = { ...(req.query || {}) };
  delete params.resource;

  const { body, cacheSeconds } = await dispatch({ resource, params });

  const status =
    body.ok === false
      ? ["unknown_resource", "unknown_competition", "missing_query"].includes(body.error)
        ? 400
        : 503
      : 200;

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", cacheSeconds ? cacheControl(cacheSeconds) : "no-store");
  res.status(status).send(JSON.stringify(body));
};
