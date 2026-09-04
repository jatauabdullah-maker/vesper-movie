/**
 * Architecture (mirrors Aurora Stream's services/api.ts):
 *   - Catalog / search / details / episodes come from TMDB. Always works
 *     once a (free) API key is set.
 *   - Stream sources are deterministic embed URLs built from the TMDB/IMDB
 *     id — no scraping, no keys, iframe-friendly. The embed player itself
 *     resolves the underlying HLS.
 */
import type { TitleSummary, TitleDetails, Episode, StreamResponse, SearchFilters, PagedResult } from '../types'
import * as tmdb from './tmdb'
import { PROVIDERS } from './embeds'

export { PROVIDERS } from './embeds'
export type { EmbedProvider } from './embeds'

// ─── Catalog ───────────────────────────────────────────────────────────────

export function getTrending(): Promise<TitleSummary[]> {
  return tmdb.trending()
}
export function getPopularMovies(): Promise<TitleSummary[]> {
  return tmdb.popularMovies()
}
export function getPopularTv(): Promise<TitleSummary[]> {
  return tmdb.popularTv()
}
export function getTopRated(): Promise<TitleSummary[]> {
  return tmdb.topRated()
}
export function getNowPlaying(): Promise<TitleSummary[]> {
  return tmdb.nowPlaying()
}
export function getAiringToday(): Promise<TitleSummary[]> {
  return tmdb.airingToday()
}
export function searchTitles(filters: SearchFilters): Promise<PagedResult<TitleSummary>> {
  return tmdb.search(filters)
}
export function getMovieGenres() {
  return tmdb.movieGenres()
}
export function getTvGenres() {
  return tmdb.tvGenres()
}
export function getRecommendations(id: string) {
  return tmdb.recommendations(id)
}
export function tmdbKeyConfigured(): boolean {
  return tmdb.hasTmdbKey()
}

// `tmdb-123` for movies, `tv-456` disambiguation is handled by the details
// fetch itself — details resolve by trying TV first when the id is flagged,
// else movie. Callers pass the summary they already have when possible.
export async function getTitle(id: string, hint?: { type?: string }): Promise<TitleDetails> {
  const tmdbId = id.replace(/^(tmdb|tv)-/, '')
  const preferTv = hint?.type === 'TV' || id.startsWith('tv-')
  if (preferTv) {
    try {
      return await tmdb.tvDetails(tmdbId)
    } catch {
      // fall through to movie
    }
  }
  return tmdb.movieDetails(tmdbId)
}

export async function getTitleWithEpisodes(id: string, hint?: { type?: string }): Promise<TitleDetails> {
  const details = await getTitle(id, hint)
  if (details.seasons && details.seasons.length > 0) {
    const perSeason = await Promise.allSettled(
      details.seasons.map((s) => tmdb.tvSeasonEpisodes(details.id.replace(/^(tmdb|tv)-/, ''), s.number))
    )
    const eps: Episode[] = []
    for (const r of perSeason) if (r.status === 'fulfilled') eps.push(...r.value)
    details.episodes = eps
  }
  return details
}

// ─── Streams (embed registry) ──────────────────────────────────────────────

/**
 * Episode IDs look like:
 *   `tmdb-<tmdbId>-m`           → a movie ("the feature")
 *   `tmdb-<tmdbId>-s<n>e<m>`    → a TV episode
 */
export function parseEpisodeId(episodeId: string):
  | { tmdbId: string; kind: 'movie' | 'tv'; season: number; episode: number }
  | null {
  let m = episodeId.match(/^tmdb-(\d+)-m$/)
  if (m) return { tmdbId: m[1], kind: 'movie', season: 0, episode: 0 }
  m = episodeId.match(/^tmdb-(\d+)-s(\d+)e(\d+)$/)
  if (m) return { tmdbId: m[1], kind: 'tv', season: Number(m[2]), episode: Number(m[3]) }
  return null
}

export function embedSourcesFor(
  episodeId: string,
  ctx?: { imdbId?: string }
): StreamResponse | null {
  const parsed = parseEpisodeId(episodeId)
  if (!parsed) return null
  const { tmdbId, kind, season, episode } = parsed

  const sources = PROVIDERS.filter((p) => p.keyType === 'tmdb' || ctx?.imdbId).map((p, i) => {
    const key = p.keyType === 'imdb' ? (ctx?.imdbId as string) : tmdbId
    const url = kind === 'movie' ? p.movieUrl(key) : p.tvUrl(key, season, episode)
    return { url, quality: `Server ${i + 1} · ${p.name}`, type: 'embed' }
  })

  return { sources, subtitles: [] }
}

export async function getStream(
  episodeId: string,
  options?: { imdbId?: string }
): Promise<StreamResponse> {
  const embed = embedSourcesFor(episodeId, options)
  if (embed && embed.sources.length > 0) return embed
  throw Object.assign(new Error('NO_SOURCE'), { code: 'NO_SOURCE' })
}
