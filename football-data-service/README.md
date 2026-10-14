# Football Data Service

A tiny, **self-hosted "mini database"** for football data: **live scores**, **club tables / form**, and **player stats** (top scorers + player lookup). It ships as a **normalized REST API** plus a **small demo website**, so your existing web app can just `fetch()` one clean JSON endpoint instead of talking to multiple providers directly.

- **Zero runtime dependencies** — pure Node.js `http` module. Nothing to `npm install`.
- **Server-side API keys only** — keys live in `.env` / host env vars, never in the browser, never with a `VITE_` prefix.
- **Provider abstraction** — pluggable providers behind one interface (same idea as a `newsProviders.js` registry).
- **Caching built in** — in-memory TTL cache + `Cache-Control: s-maxage` + `stale-while-revalidate` so you stay inside free-tier limits.
- **Never crashes** — validates & sanitizes every param, rate-limits per IP, caps results, and falls back to clearly-labelled **mock data** when no key is set or a provider fails.
- **One normalized response shape** for every resource.

---

## 1. Quick start

```bash
cd football-data-service
cp .env.example .env          # optional: add provider keys
npm start                     # or: node server.js
# open http://localhost:8787
```

No `npm install` is needed — there are no dependencies. Node **>= 18** is required (uses the built-in `fetch`).

With **no keys configured**, the service still runs and serves **mock data** (clearly flagged with `"mock": true`) so you can build your frontend immediately.

---

## 2. Environment variables

Copy `.env.example` → `.env` and fill in what you have. **Never commit `.env`.**

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8787` | Port the server listens on. |
| `FOOTBALL_DATA_API_KEY` | *(empty)* | Key for **football-data.org** (v4). |
| `API_FOOTBALL_KEY` | *(empty)* | Key for **API-Football** (api-sports.io, v3). |
| `DEFAULT_COMPETITION` | `PL` | Competition used when a request omits one. |
| `DEFAULT_SEASON` | `2024` | Season for API-Football standings/scorers/players. |
| `ALLOW_MOCK_FALLBACK` | `true` | Return labelled mock data instead of a 503 when providers fail. Set `false` to get an error note instead. |
| `REQUEST_TIMEOUT_MS` | `10000` | Upstream request timeout. |
| `MAX_RESULTS` | `100` | Hard cap on rows returned per request. |
| `RATE_LIMIT_PER_MIN` | `90` | Per-IP request limit for *this* service. |

> **Security:** these are **server-side** variables. Do **not** prefix them with `VITE_` (that would expose them to the browser bundle). Do **not** hard-code keys in source or commit them.

Get keys here:
- football-data.org → https://www.football-data.org/client/register
- API-Football → https://dashboard.api-football.com/register

---

## 3. API

Base path: **`/api/football`** (aliases `/api` and `/api/scores` also work). You can pass the resource either as a **query param** (`?resource=...`) or as a **path segment** (`/api/standings`).

### Endpoints

| Resource | Query params | Description |
|---|---|---|
| `livescores` | `competition` | In-play / today's matches. Aliases: `live`, `scores`. |
| `fixtures` | `competition`, `date` (`YYYY-MM-DD`) | Fixtures for a given day. |
| `standings` | `competition` | League table + form. Alias: `table`. |
| `scorers` | `competition`, `limit` | Top scorers. Alias: `topscorers`. |
| `player` | `q` (name) | Player profile + stats. Alias: `players`. |
| `club` | `q` (name) or `teamId` | Club profile / club stats. Alias: `team`. |
| `competitions` | — | Catalogue of supported competitions. Alias: `leagues`. |
| `health` | — | Service + provider status. |

### Examples

```bash
# Live scores (Premier League)
curl "http://localhost:8787/api/football?resource=livescores&competition=PL"

# Standings (path style)
curl "http://localhost:8787/api/standings?competition=PD"

# Top scorers, capped at 10
curl "http://localhost:8787/api/football?resource=scorers&competition=PL&limit=10"

# Player lookup
curl "http://localhost:8787/api/football?resource=player&q=salah"

# Club lookup / stats
curl "http://localhost:8787/api/football?resource=club&q=liverpool"

# Health
curl "http://localhost:8787/health"
```

### Normalized response envelope

Every response has the same shape:

```json
{
  "ok": true,
  "resource": "livescores",
  "provider": "football-data",
  "mock": false,
  "generatedAt": "2026-10-12T11:07:08.050Z",
  "count": 4,
  "data": [ ... ],
  "note": "optional human-readable hint"
}
```

- `provider` — which provider actually served the data (`mock` when fallback is used).
- `mock` — `true` when the payload is clearly-labelled sample data.
- `count` — number of rows (for `standings` it is the number of table rows).
- `data` — normalized array/object; the exact fields are provider-agnostic.

### Error / status codes

| Status | When |
|---|---|
| `200` | Success (live **or** mock). |
| `400` | `unknown_resource`, `unknown_competition`, or `missing_query`. |
| `429` | Per-IP rate limit exceeded. |
| `503` | All providers failed **and** `ALLOW_MOCK_FALLBACK=false`. |

Errors never leak a stack trace — you get `{ ok:false, resource, error, note, data:null }`.

---

## 4. Provider coverage

The service picks the **first enabled provider that supports the requested capability**, then falls back to the next, then to mock.

| Capability | football-data.org | API-Football |
|---|:---:|:---:|
| Live scores | ✅ (delayed on free tier) | ✅ (real-time) |
| Fixtures | ✅ | ✅ |
| Standings + form | ✅ | ✅ |
| Top scorers | ✅ | ✅ |
| Club lookup / stats | ✅ | ✅ |
| Player lookup / stats | ❌ | ✅ |

Practical guidance:
- **football-data.org** alone covers live scores, fixtures, tables and top scorers for 12 competitions.
- **API-Football** is the one that adds **player stats** (and true real-time scores).
- Configure **both** for the best coverage; configure **one** and the other's capabilities fall back to mock.

---

## 5. Verified free-tier limits

These were checked against each provider's official documentation:

| Provider | Free plan |
|---|---|
| **football-data.org** (v4) | **10 requests / minute**; 12 competitions; scores are **delayed**; **no player stats**. |
| **API-Football** (api-sports.io, v3) | **100 requests / day** *and* **10 requests / minute**; all endpoints but limited seasons. |

> ⚠️ **Serverless caveat:** API-Football's docs warn that shared-IP hosts (Vercel / AWS Lambda and similar) can hit per-IP limits because many tenants share an egress IP. For production, prefer a **single long-lived server** (or a host with a dedicated IP) and rely on the cache.

---

## 6. Caching

Two layers keep you well inside the free quotas:

1. **In-memory TTL cache** (per resource) — repeated requests within the TTL are served without touching the provider.
2. **HTTP cache headers** on every response:
   `Cache-Control: public, s-maxage=<ttl>, stale-while-revalidate=<ttl*2>`
   so any CDN / reverse proxy can also cache.

TTL defaults (seconds):

| Resource | TTL |
|---|---|
| `livescores` | 30 |
| `fixtures` | 60 |
| `standings` | 600 (10 min) |
| `scorers` | 900 (15 min) |
| `player` / `club` | 3600 (1 h) |
| `competitions` | 86400 (1 day) |
| `health` | 10 |

When **no provider key** is configured, mock responses are cached for only 30 s so they refresh quickly; when providers exist but are failing, mock is cached up to 120 s to back off.

---

## 7. Project layout

```
football-data-service/
├── server.js                     # zero-dep http server: routes /api/* + serves public/
├── package.json                  # no dependencies
├── .env.example                  # documented env vars (copy to .env)
├── .gitignore                    # ignores .env, node_modules, logs
├── api/
│   └── football.js               # optional Vercel serverless adapter (same core)
├── public/                       # the small demo website
│   ├── index.html
│   ├── styles.css
│   └── app.js
└── src/
    ├── config.js                 # env loader + config
    ├── competitions.js           # friendly code -> per-provider id catalogue
    ├── cache.js                  # TTL cache + Cache-Control helper
    ├── rateLimit.js              # per-IP fixed-window limiter
    ├── validate.js               # param validation / sanitization
    ├── http.js                   # fetch wrapper (timeout, never throws)
    ├── core.js                   # the dispatcher (resource routing + fallback)
    ├── mock/data.js              # labelled mock data
    └── providers/
        ├── index.js              # provider registry
        ├── footballDataOrg.js    # football-data.org adapter
        └── apiFootball.js        # API-Football adapter
```

---

## 8. Using it from your app

Point your frontend at the service and read the normalized envelope:

```js
async function getStandings(competition = "PL") {
  const res = await fetch(
    `https://YOUR-SERVICE/api/football?resource=standings&competition=${competition}`
  );
  const body = await res.json();
  if (!body.ok) throw new Error(body.note || body.error);
  return body.data; // normalized; check body.mock to know if it's sample data
}
```

The demo website at `/` calls the exact same endpoint — the "Use it in your app" box shows the live URL with a **Copy URL** button.

---

## 9. Deployment

**See [`DEPLOY.md`](./DEPLOY.md) for a full step-by-step go-live guide** (Render, Railway, Fly.io, Vercel, VPS) and how to point your web app at it. Included deploy files: `Dockerfile`, `.dockerignore`, `render.yaml`, `Procfile`, `vercel.json`.

### Plain server (recommended)
Run `node server.js` behind a reverse proxy (nginx, Caddy) or a PaaS (Render, Railway, Fly.io, a VPS). Set the env vars in the host's dashboard — **not** in the repo. A long-lived process keeps the in-memory cache effective.

### Vercel (optional)
`api/football.js` is a serverless adapter that reuses the same core dispatcher, and `vercel.json` wires the routes. Add the env vars in **Vercel → Project → Settings → Environment Variables** (again: **no `VITE_` prefix**). Because of the shared-IP caveat above, keep `ALLOW_MOCK_FALLBACK=true` so the endpoint degrades gracefully if the provider rate-limits the shared IP.

### Client helpers
`examples/footballApi.js` is a drop-in client for your app; `examples/ReactExample.jsx` shows a React component. CORS is already open (`Access-Control-Allow-Origin: *`), so no server config is needed on your side.

---

## 10. Manual test checklist

1. `npm start`, then open `http://localhost:8787` — the demo site loads and shows mock data with a **MOCK DATA** badge.
2. `curl http://localhost:8787/health` — returns providers with `enabled:false` (no keys) and `mockFallback:true`.
3. Add a real key to `.env`, restart, and re-check `/health` — the provider shows `enabled:true` and the badge disappears.
4. Check caching: `curl -i .../api/standings?competition=PL` — confirm `Cache-Control: ... s-maxage=600 ...`.
5. Check validation: `curl .../api/football?resource=standings&competition=XX` → `400 unknown_competition`.
6. Check fallback: with a bad/empty key, responses still return `200` with `"mock": true`.
7. Check rate limiting: fire > `RATE_LIMIT_PER_MIN` requests in a minute → `429`.

---

## 11. Notes & limitations

- Free tiers are **delayed** and **quota-limited**; the cache is what makes this sustainable.
- Player stats require **API-Football**; without it, `player` returns mock data.
- Mock data is **clearly labelled** (`"mock": true` + a `note`) and should never be presented to end users as real.
- This service only reads **public** football data from the providers' official APIs. Respect each provider's terms of service.
