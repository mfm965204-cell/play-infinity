# Play Infinity

Universal media streaming platform — Android app, studio admin panel and Cloudflare backend.

**Developed by Mohammad Fahad Mir**
Portfolio: https://portfolio.mfm965204.workers.dev/ · Support: https://www.instagram.com/fahad0101r

---

## Live URLs

| Piece | URL |
| --- | --- |
| API | `https://playinfinity.mfm965204.workers.dev/api/…` |
| Admin panel | `https://playinfinity.mfm965204.workers.dev/` |
| Privacy policy | `https://playinfinity.mfm965204.workers.dev/privacy` |
| Terms | `https://playinfinity.mfm965204.workers.dev/terms` |

The admin secret is **`admin123`** on first login. Change it from *App settings → Change admin secret*; doing so signs out every session.

## Architecture

```
Android app (Kotlin + Compose + Media3)
        │  HTTPS /api/media, /api/media/:id, /api/settings
        ▼
Cloudflare Worker  ──►  D1 database (playinfinity_db)
        │
        └──► static assets: the React admin panel (same origin, no CORS)
```

One Worker serves both the admin SPA and the JSON API: requests under `/api/*` run the
Worker first, everything else is served from the asset bundle with SPA fallback.

## Backend

`worker/worker.js` — one file, no dependencies.

Public, no auth (the app has no login):

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | liveness + media count |
| `GET /api/settings` | maintenance flags, legal text, developer links |
| `GET /api/media?type=&genre=&q=&limit=` | catalogue with filters |
| `GET /api/media/:id` | one title plus its episodes |

Admin, `Authorization: Bearer <session token>` or `Bearer <admin secret>`:

| Endpoint | Purpose |
| --- | --- |
| `POST /api/admin/login` | `{secret}` → `{token}` (24 h) |
| `POST /api/admin/secret` | `{current, next}` → rotate the secret, drop all sessions |
| `GET/POST /api/admin/media`, `DELETE /api/admin/media/:id` | catalogue CRUD |
| `POST /api/admin/episode`, `DELETE /api/admin/episode/:id` | episode CRUD |
| `GET/POST /api/admin/settings` | feature flags, legal text, developer links |

The admin secret is stored as a SHA-256 hash in the `settings` table, never in plain text,
and compared in constant time.

### Schema

`media` (id, title, description, cover_url, backdrop_url, type, release_year, genres,
rating, video_url, format, featured), `episodes` (id, media_id, season, episode_number,
title, video_url, format), `settings` (key, value), `sessions` (token, created_at,
expires_at).

## Admin panel

`admin/` — React 18 + Vite + Tailwind, dark studio theme.

* Login against the admin secret.
* Media form (poster, backdrop, type, year, genres, rating, stream URL, format, featured).
* Episode form for series, with a season/episode list.
* App settings: maintenance mode, Live TV, downloads, force update, message copy,
  app version, developer links, and the change-secret form.
* Legal editor for the privacy policy and terms, with public preview pages.
* Footer with the developer signature, portfolio and support links.

Build it with `npm install && npm run build`; `dist/` is what gets uploaded as Worker assets.

## Android app

`android/` — Kotlin, Jetpack Compose (Material 3, strict dark theme), Media3 ExoPlayer,
Retrofit + Gson, Coil.

* **Home** — hero banner with backdrop, glowing Play button, and snapping rows for
  Trending / Movies / Series / Live TV (Live TV hides when the admin disables it).
* **Details** — backdrop fading into the theme, meta line, synopsis, season accordion,
  My List toggle, download button (only when downloads are enabled).
* **Search** — live filtering through the API.
* **My List** — saved titles kept in SharedPreferences.
* **Player** — ExoPlayer with a custom overlay: play/pause, seek bar with buffered
  position, speed (0.5×–2×), audio track picker, subtitle on/off, Fit/Fill/Zoom,
  double-tap ±10 s, vertical drag for brightness (left) and volume (right), and a
  red LIVE badge with the seek bar hidden for live streams.
* **Settings** — version, privacy policy, terms, portfolio and Instagram links, signature.
* **Gating** — `/api/settings` is checked on launch: maintenance mode and forced update
  both block the whole app with a full-screen notice.

## Build

The APK is built by GitHub Actions (`.github/workflows/build-apk.yml`): JDK 17, Android
SDK, a keystore generated on the runner, `./gradlew assembleRelease`, then the APK is
uploaded as the `play-infinity-apk` artifact.

Locally: `cd android && ./gradlew assembleRelease` (add `keystore/ci.jks` to sign it).

## Notes

* The admin panel is a single-page app; `/privacy` and `/terms` are public routes that
  read the text from `/api/settings`, so editing them in the studio updates both the app
  and the web instantly.
* Login has no lockout or rate limiting — put Cloudflare Access or a rate-limit rule in
  front of `/api/admin/login` before this goes anywhere public.
