# 🚀 Going live + pulling from your web app

This service is a small **Node server**. To make it live you deploy it to a host that keeps a
process running (Render, Railway, Fly.io, a VPS…) and get an **HTTPS URL**. Then your web app just
`fetch()`es that URL. **CORS is already wide open** (`Access-Control-Allow-Origin: *`), so nothing
needs to be configured on your app's side.

> ⚠️ **Use HTTPS.** If your web app is served over HTTPS, it can only call an HTTPS API (browsers
> block "mixed content"). Every host below gives you HTTPS for free.

---

## TL;DR — fastest path (Render, ~5 minutes, free)

1. Push this folder to a **GitHub repo** (or use the zip's contents).
2. Go to **https://render.com** → sign up → **New + → Web Service** → connect the repo.
3. Settings:
   - **Runtime:** `Node`
   - **Build Command:** *(leave empty)*
   - **Start Command:** `node server.js`
   - **Instance Type:** `Free`
4. **Environment** tab → add:
   - `FOOTBALL_DATA_API_KEY` = *(your key, or leave blank for mock data)*
   - `API_FOOTBALL_KEY` = *(your key, or leave blank for mock data)*
   - `ALLOW_MOCK_FALLBACK` = `true`
5. **Create Web Service**. Wait for "Live". Your URL is like
   `https://football-data-service.onrender.com`.
6. Test it: open `https://YOUR-URL.onrender.com/health` and
   `https://YOUR-URL.onrender.com/api/livescores`.
7. In your app, set `BASE` in `examples/footballApi.js` to that URL. Done.

> **Free-tier note:** Render's free web services **sleep after ~15 min of inactivity** and take
> ~30–60 s to wake on the next request. For a smoother experience, either upgrade the instance, or
> add a free uptime pinger (e.g. cron-job.org) that hits `/health` every 10 minutes.

---

## Option A — Render (recommended: long-lived server, in-memory cache works)

**A1. Via the dashboard** — follow the TL;DR above.

**A2. Via the Blueprint** (uses the included `render.yaml`):
1. Push the folder to GitHub.
2. Render → **New + → Blueprint** → pick the repo → **Apply**.
3. Render reads `render.yaml`, creates the service, and asks you for the two secret keys.
4. Add the keys, click **Apply**, wait for "Live".

**A3. Via Docker** (Render also builds the included `Dockerfile`):
- New + → Web Service → Runtime: **Docker** → it uses `Dockerfile` automatically.

---

## Option B — Railway (very quick, free trial credits)

1. **https://railway.app** → **New Project → Deploy from GitHub repo** → pick the repo.
2. Railway auto-detects Node and runs `npm start` (which is `node server.js`).
3. **Variables** tab → add `FOOTBALL_DATA_API_KEY`, `API_FOOTBALL_KEY`, `ALLOW_MOCK_FALLBACK=true`.
4. **Settings → Networking → Generate Domain** to get your public HTTPS URL.
5. Test `/health`, then point your app's `BASE` at it.

---

## Option C — Fly.io (Docker, global, generous free allowance)

```bash
# one-time
curl -L https://fly.io/install.sh | sh
fly auth signup        # or: fly auth login

cd football-data-service
fly launch             # detects the Dockerfile; say "yes" to deploy, pick a region
fly secrets set FOOTBALL_DATA_API_KEY=xxxx API_FOOTBALL_KEY=yyyy
fly deploy
```

Your URL is `https://<app-name>.fly.dev`. Test `/health`, then update your app.

---

## Option D — Vercel (you already use it; serverless)

This repo includes `api/football.js` (a serverless adapter) and a `vercel.json` that routes
`/api/*` to it and serves the demo site from `public/`.

1. **https://vercel.com** → **Add New → Project** → import the repo.
2. **Framework Preset:** `Other`. Leave build/output defaults (the `vercel.json` handles it).
3. **Settings → Environment Variables** → add (for **Production** and **Preview**):
   - `FOOTBALL_DATA_API_KEY`
   - `API_FOOTBALL_KEY`
   - `ALLOW_MOCK_FALLBACK` = `true`
   - ⚠️ **Do NOT prefix with `VITE_`** — that would leak the key to the browser.
4. **Deploy**. Your URL is `https://<project>.vercel.app`.

**Two caveats for Vercel:**
- Serverless functions are stateless, so the **in-memory cache is per-invocation** (less effective
  than a long-lived server). The `Cache-Control` headers still let Vercel's edge cache help.
- API-Football's docs warn that **shared serverless IPs** can trip per-IP rate limits. Keep
  `ALLOW_MOCK_FALLBACK=true` so it degrades gracefully.

**Better Vercel alternative:** since your PitchCraft app is already on Vercel, you can instead
**copy `api/football.js` + the `src/` folder into your existing repo**. Then the endpoint lives on
your own domain at `/api/football` — no CORS, no second service. (This is the "additive feature"
route if you'd rather keep it all in one project.)

---

## Option E — Any VPS (full control)

```bash
# on the server
git clone <your repo> && cd football-data-service
cp .env.example .env && nano .env      # add your keys
docker build -t football-data .
docker run -d --name football --restart unless-stopped \
  -p 8787:8787 --env-file .env football-data
```

Then put **Caddy** in front for automatic HTTPS (one line in a `Caddyfile`):

```
football.yourdomain.com {
    reverse_proxy localhost:8787
}
```

---

## How your web app pulls from it

CORS is already open, so it's just a normal `fetch`. Copy **`examples/footballApi.js`** into your
project and set `BASE`:

```js
const BASE = "https://football-data-service.onrender.com"; // your live URL
```

Then:

```js
import { getLiveScores, getStandings, getTopScorers, getPlayer, getClub } from "./footballApi";

const { data, mock } = await getStandings("PL");
if (mock) console.warn("Sample data — add an API key on the server.");
console.table(data.table);
```

Or call the endpoint directly:

```js
const res = await fetch(
  "https://YOUR-URL/api/football?resource=livescores&competition=PL"
);
const body = await res.json();      // { ok, resource, provider, mock, count, data, note }
```

See **`examples/ReactExample.jsx`** for a ready-made React component.

### Endpoint cheat-sheet

| What you want | URL |
|---|---|
| Live scores | `/api/football?resource=livescores&competition=PL` |
| League table | `/api/football?resource=standings&competition=PL` |
| Top scorers | `/api/football?resource=scorers&competition=PL&limit=10` |
| Player | `/api/football?resource=player&q=salah` |
| Club | `/api/football?resource=club&q=liverpool` |
| Competitions | `/api/football?resource=competitions` |
| Health | `/health` |

Competition codes: `PL, PD, SA, BL1, FL1, CL, EL, DED, PPL, BSA, ELC`.

---

## Post-deploy checklist

- [ ] `https://YOUR-URL/health` returns `ok:true` and shows your providers as `enabled:true`.
- [ ] `https://YOUR-URL/api/livescores` returns JSON with `"mock": false` (once a key is set).
- [ ] Your app's `BASE` points at the live URL (HTTPS).
- [ ] You see real data (not the **MOCK DATA** badge) in your app.
- [ ] Keys are set as **server-side env vars** on the host — never in the repo, never `VITE_`.
- [ ] `.env` is **not** committed (it's in `.gitignore`).

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| App shows "MOCK DATA" | No valid key on the server. Set `FOOTBALL_DATA_API_KEY` / `API_FOOTBALL_KEY` and redeploy. |
| `503` responses | All providers failed and `ALLOW_MOCK_FALLBACK=false`. Set it to `true` or fix the key. |
| First request very slow | Render free tier woke from sleep. Add an uptime pinger or upgrade. |
| `429` in your app | You're hitting this service's per-IP limit (`RATE_LIMIT_PER_MIN`, default 90/min). Cache on your side or raise the limit. |
| Provider `429`/errors | You're over the provider's free quota. The cache + mock fallback handle it; consider a paid plan. |
| Mixed-content error in browser | Your app is HTTPS but the API URL is HTTP. Use the host's HTTPS URL. |
