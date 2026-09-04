# Vesper

A premium installable movie & TV streaming PWA — the movie sibling of **Aurora Stream**, same architecture, its own identity.

## Architecture (mirrors Aurora Stream 1:1)

| Role | Aurora (anime) | Vesper (movies & TV) |
|---|---|---|
| Metadata backbone | AniList GraphQL | TMDB REST (`src/services/tmdb.ts`) |
| ID scheme | `al-<anilistId>`, `al-<id>-e<n>` | Titles: `tmdb-<id>` (movies), `tv-<id>` (TV — TMDB ids are two separate namespaces!). Episodes: `tmdb-<id>-m` / `tmdb-<id>-s<n>e<n>` |
| Stream sources | `tryembed.us.cc/embed/anime/<id>/<ep>/<sub\|dub>` | Embed registry keyed on TMDB/IMDB id (`src/services/embeds.ts`) |
| Player | EmbedPlayer iframe + PLAYER_EVENT postMessage | Same component, server-switcher instead of sub/dub |
| Downloads | Aurora Downloader extension (animepahe→kwik MP4 chain) | **Not needed** — embeds serve HLS; direct extraction is a server-side job later |

## Setup

```bash
npm install
cp .env.example .env   # add your free TMDB key
npm run dev
```

**TMDB key** (free): create one at <https://www.themoviedb.org/settings/api>, then either
put `VITE_TMDB_API_KEY` (v3 key) or `VITE_TMDB_READ_TOKEN` (v4 bearer) in `.env`,
or paste it into the in-app Settings page — no rebuild needed.

## Streaming servers

`src/services/embeds.ts` is a pure URL-constructor registry (no I/O, survives domain churn).
Order matters — it drives the server switcher under the player:

1. VidLink (tmdb) · 2. VidZee (tmdb) · 3. SuperEmbed (tmdb) · 4. VidSrc (tmdb)
5. 2Embed (tmdb) · 6. VidSrc.me (imdb — auto-resolved via TMDB `external_ids`) · 7. VidJoy (tmdb)

Add/remove/reorder rows there and the app follows. Keep ≥5 providers — the vidsrc
network is under constant domain rotation.

## Scripts

- `npm run dev` / `build` / `preview` — standard Vite
- `npm run icons` — regenerate PWA icons (`scripts/make-icons.mjs`, zero deps)
- `npm run deploy` — Vercel production deploy
