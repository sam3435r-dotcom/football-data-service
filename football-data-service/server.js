"use strict";

/**
 * Standalone, zero-dependency HTTP server.
 *   - Serves the normalized REST API under /api/football (and /api/<resource>)
 *   - Serves the tiny website from /public
 *
 * Run:  node server.js      (reads .env automatically)
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const config = require("./src/config");
const { dispatch, RESOURCES } = require("./src/core");
const { cacheControl } = require("./src/cache");
const { RateLimiter } = require("./src/rateLimit");
const providers = require("./src/providers");

const PUBLIC_DIR = path.join(__dirname, "public");
const limiter = new RateLimiter(config.rateLimit);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
};

function sendJson(res, status, body, cacheSeconds) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": cacheSeconds ? cacheControl(cacheSeconds) : "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(payload);
}

function sendText(res, status, text) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) return String(fwd).split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

function serveStatic(req, res, pathname) {
  const rel = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.join(PUBLIC_DIR, path.normalize(rel).replace(/^(\.\.[/\\])+/, ""));
  if (!filePath.startsWith(PUBLIC_DIR)) return sendText(res, 403, "Forbidden");

  fs.readFile(filePath, (err, buf) => {
    if (err) {
      // SPA-ish fallback to index.html for unknown non-file paths
      if (!path.extname(pathname)) {
        return fs.readFile(path.join(PUBLIC_DIR, "index.html"), (e2, html) => {
          if (e2) return sendText(res, 404, "Not found");
          res.writeHead(200, { "Content-Type": MIME[".html"] });
          res.end(html);
        });
      }
      return sendText(res, 404, "Not found");
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600",
    });
    res.end(buf);
  });
}

/** Derive the resource name from the path and query. */
function resolveResource(pathname, query) {
  if (pathname === "/health" || pathname === "/api/health") return "health";
  const m = pathname.match(/^\/api\/(?:football\/?)?([a-z]+)?\/?$/i);
  if (m && m[1]) return m[1].toLowerCase();
  return (query.get("resource") || "livescores").toLowerCase();
}

async function handleApi(req, res, url) {
  const rl = limiter.check(clientIp(req));
  if (!rl.allowed) {
    res.setHeader("Retry-After", Math.ceil(rl.resetMs / 1000));
    return sendJson(res, 429, {
      ok: false,
      error: "rate_limited",
      note: "Too many requests to this service. Please slow down.",
      data: null,
    }, 0);
  }

  const resource = resolveResource(url.pathname, url.searchParams);
  const params = Object.fromEntries(url.searchParams.entries());
  const { body, cacheSeconds } = await dispatch({ resource, params });

  const status = body.ok === false
    ? (body.error === "unknown_resource" || body.error === "unknown_competition" || body.error === "missing_query" ? 400 : 503)
    : 200;

  res.setHeader("X-RateLimit-Limit", String(rl.limit));
  res.setHeader("X-RateLimit-Remaining", String(rl.remaining));
  return sendJson(res, status, body, cacheSeconds);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  if (req.method !== "GET") return sendText(res, 405, "Method not allowed");

  if (url.pathname === "/health" || url.pathname.startsWith("/api/")) {
    return handleApi(req, res, url);
  }
  return serveStatic(req, res, url.pathname);
});

server.listen(config.port, () => {
  const status = providers.describe();
  console.log("──────────────────────────────────────────────");
  console.log("  Football Data Service");
  console.log(`  http://localhost:${config.port}`);
  console.log("  Providers:");
  for (const p of status) {
    console.log(`    ${p.enabled ? "✔ enabled " : "✖ no key  "} ${p.label}`);
  }
  console.log(`  Mock fallback: ${config.allowMockFallback ? "on" : "off"}`);
  console.log(`  Resources: ${RESOURCES.join(", ")}`);
  console.log("──────────────────────────────────────────────");
});

module.exports = server;
