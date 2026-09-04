/**
 * TMDB is the metadata backbone. No scraping — pure REST.
 * Credentials come from Vercel environment variables:
 *   - VITE_TMDB_READ_TOKEN (v4 bearer — preferred)
 *   - VITE_TMDB_API_KEY (v3 query param)
 */
import type {
  TitleSummary,
  TitleDetails,
  Episode,
  SearchFilters,
  PagedResult,
} from '../types'

const API = 'https://api.themoviedb.org/3'
const IMG = 'https://image.tmdb.org/t/p'

type MediaType = 'movie' | 'tv'

function creds(): { token?: string; apiKey?: string } {
  return {
    token: import.meta.env.VITE_TMDB_READ_TOKEN || undefined,
    apiKey: import.meta.env.VITE_TMDB_API_KEY || undefined,
  }
}

export function hasTmdbKey(): boolean {
  const c = creds()
  return !!(c.token || c.apiKey)
}

let warnedNoKey = false

async function tmdbGet<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const c = creds()
  if (!c.token && !c.apiKey) {
    if (!warnedNoKey) {
      warnedNoKey = true
      console.warn('[vesper] No TMDB key configured in environment variables.')
    }
    throw new Error('NO_TMDB_KEY')
  }

  const url = new URL(`${API}${path}`)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') url.searchParams.set(k, String(v))
  }
  if (c.apiKey) url.searchParams.set('api_key', c.apiKey)

  const headers: Record<string, string> = { accept: 'application/json' }
  if (c.token) headers.Authorization = `Bearer ${c.token}`

  const res = await fetch(url.toString(), { headers })
  if (!res.ok) {
    if (res.status === 401) throw new Error('TMDB_KEY_INVALID')
    throw new Error(`TMDB_${res.status}`)
  }
  return (await res.json()) as T
}

export function img(path: string | null | undefined, size: 'w342' | 'w500' | 'w780' | 'w1280' | 'original'): string | undefined {
  if (!path) return undefined
  return `${IMG}/${size}${path}`
}

// ── raw shapes ─────────────────────────────────────────────────────────────
interface RawCommon {
  id: number
  overview?: string
  vote_average?: number
  poster_path?: string | null
  backdrop_path?: string | null
  genre_ids?: number[]
}
interface RawTitle extends RawCommon {
  media_type?: string
  title?: string
  name?: string
  release_date?: string
  first_air_date?: string
  original_title?: string
  original_name?: string
}
interface RawMovieDetails extends RawTitle {
  runtime?: number
  status?: string
  tagline?: string
  genres?: { id: number; name: string }[]
  production_companies?: { name: string }[]
  videos?: { results: { key: string; site: string; type: string; official?: boolean }[] }
  external_ids?: { imdb_id?: string }
  recommendations?: { results: RawTitle[] }
}
interface RawTvDetails extends RawTitle {
  episode_run_time?: number[]
  number_of_seasons?: number
  status?: string
  tagline?: string
  genres?: { id: number; name: string }[]
  production_companies?: { name: string }[]
  seasons?: { season_number: number; name: string; episode_count: number }[]
  videos?: { results: { key: string; site: string; type: string; official?: boolean }[] }
  external_ids?: { imdb_id?: string }
  recommendations?: { results: RawTitle[] }
}
interface RawSeason {
  episodes: {
    episode_number: number
    name?: string
    runtime?: number
    still_path?: string | null
    air_date?: string
  }[]
}

// ── mapping ────────────────────────────────────────────────────────────────
function yearOf(r: RawTitle): number | undefined {
  const d = r.release_date || r.first_air_date
  return d && d.length >= 4 ? Number(d.slice(0, 4)) : undefined
}

function mapSummary(r: RawTitle, fallbackType: MediaType): TitleSummary {
  const type: MediaType = r.media_type === 'movie' || r.media_type === 'tv' ? r.media_type : fallbackType
  return {
    id: type === 'movie' ? `tmdb-${r.id}` : `tv-${r.id}`,
    title: r.title || r.name || r.original_title || r.original_name || 'Untitled',
    poster: img(r.poster_path, 'w342') ?? '',
    banner: img(r.backdrop_path, 'w780'),
    rating: r.vote_average && r.vote_average > 0 ? r.vote_average : undefined,
    year: yearOf(r),
    type: type === 'movie' ? 'Movie' : 'TV',
  }
}

function mapTitle(r: RawTitle): TitleSummary {
  return mapSummary(r, r.release_date ? 'movie' : 'tv')
}

function trailerOf(r: RawMovieDetails | RawTvDetails): string | undefined {
  const vids = (r.videos?.results ?? []).filter((v) => v.site === 'YouTube')
  const best =
    vids.find((v) => v.type === 'Trailer' && v.official) ??
    vids.find((v) => v.type === 'Trailer') ??
    vids.find((v) => v.type === 'Teaser')
  return best ? `https://www.youtube.com/embed/${best.key}` : undefined
}

// ── catalog rows ───────────────────────────────────────────────────────────
export async function trending(): Promise<TitleSummary[]> {
  const d = await tmdbGet<{ results: RawTitle[] }>('/trending/all/week')
  return d.results.filter((r) => r.media_type !== 'person').map(mapTitle)
}

export async function popularMovies(): Promise<TitleSummary[]> {
  const d = await tmdbGet<{ results: RawTitle[] }>('/movie/popular')
  return d.results.map((r) => mapSummary(r, 'movie'))
}

export async function popularTv(): Promise<TitleSummary[]> {
  const d = await tmdbGet<{ results: RawTitle[] }>('/tv/popular')
  return d.results.map((r) => mapSummary(r, 'tv'))
}

export async function topRated(): Promise<TitleSummary[]> {
  const d = await tmdbGet<{ results: RawTitle[] }>('/movie/top_rated')
  return d.results.map((r) => mapSummary(r, 'movie'))
}

export async function nowPlaying(): Promise<TitleSummary[]> {
  const d = await tmdbGet<{ results: RawTitle[] }>('/movie/now_playing')
  return d.results.map((r) => mapSummary(r, 'movie'))
}

export async function airingToday(): Promise<TitleSummary[]> {
  const d = await tmdbGet<{ results: RawTitle[] }>('/tv/airing_today')
  return d.results.map((r) => mapSummary(r, 'tv'))
}

// ── search / discover ──────────────────────────────────────────────────────
export async function search(filters: SearchFilters): Promise<PagedResult<TitleSummary>> {
  const page = filters.page ?? 1

  if (filters.q) {
    const d = await tmdbGet<{ results: RawTitle[]; page: number; total_pages: number }>('/search/multi', {
      query: filters.q,
      page,
      include_adult: 'false',
      year: filters.year,
    })
    const items = d.results
      .filter((r) => (filters.type ? r.media_type === filters.type : r.media_type !== 'person'))
      .map(mapTitle)
    return { items, page: d.page, totalPages: Math.min(d.total_pages, 500) }
  }

  const type: MediaType = filters.type === 'tv' ? 'tv' : 'movie'
  const d = await tmdbGet<{ results: RawTitle[]; page: number; total_pages: number }>(`/discover/${type}`, {
    page,
    with_genres: filters.genre,
    primary_release_year: type === 'movie' ? filters.year : undefined,
    first_air_date_year: type === 'tv' ? filters.year : undefined,
    sort_by: 'popularity.desc',
    include_adult: 'false',
  })
  return { items: d.results.map((r) => mapSummary(r, type)), page: d.page, totalPages: Math.min(d.total_pages, 500) }
}

export async function movieGenres(): Promise<{ id: number; name: string }[]> {
  const d = await tmdbGet<{ genres: { id: number; name: string }[] }>('/genre/movie/list')
  return d.genres
}

export async function tvGenres(): Promise<{ id: number; name: string }[]> {
  const d = await tmdbGet<{ genres: { id: number; name: string }[] }>('/genre/tv/list')
  return d.genres
}

// ── details + episodes ─────────────────────────────────────────────────────
function movieEpisodes(r: RawMovieDetails): Episode[] {
  return [
    {
      id: `tmdb-${r.id}-m`,
      number: 1,
      season: 1,
      duration: r.runtime ? r.runtime * 60 : undefined,
      title: 'Feature',
    },
  ]
}

export async function movieDetails(tmdbId: string): Promise<TitleDetails> {
  const r = await tmdbGet<RawMovieDetails>(`/movie/${tmdbId}`, { append_to_response: 'videos,external_ids,recommendations' })
  return {
    id: `tmdb-${r.id}`,
    title: r.title || r.original_title || 'Untitled',
    poster: img(r.poster_path, 'w342') ?? '',
    banner: img(r.backdrop_path, 'w1280'),
    rating: r.vote_average && r.vote_average > 0 ? r.vote_average : undefined,
    year: yearOf(r),
    type: 'Movie',
    status: r.status,
    genres: (r.genres ?? []).map((g) => g.name),
    synopsis: r.overview,
    score: r.vote_average,
    tagline: r.tagline,
    studios: (r.production_companies ?? []).slice(0, 3).map((c) => c.name),
    trailerUrl: trailerOf(r),
    imdbId: r.external_ids?.imdb_id,
    episodes: movieEpisodes(r),
    seasons: [],
  }
}

export async function tvDetails(tmdbId: string): Promise<TitleDetails> {
  const r = await tmdbGet<RawTvDetails>(`/tv/${tmdbId}`, { append_to_response: 'videos,external_ids,recommendations' })
  const seasons = (r.seasons ?? []).filter((s) => s.season_number >= 1 && s.episode_count > 0)
  return {
    id: `tv-${r.id}`,
    title: r.name || r.original_name || 'Untitled',
    poster: img(r.poster_path, 'w342') ?? '',
    banner: img(r.backdrop_path, 'w1280'),
    rating: r.vote_average && r.vote_average > 0 ? r.vote_average : undefined,
    year: yearOf(r),
    type: 'TV',
    status: r.status,
    genres: (r.genres ?? []).map((g) => g.name),
    synopsis: r.overview,
    score: r.vote_average,
    tagline: r.tagline,
    studios: (r.production_companies ?? []).slice(0, 3).map((c) => c.name),
    runtime: r.episode_run_time?.[0],
    trailerUrl: trailerOf(r),
    imdbId: r.external_ids?.imdb_id,
    episodes: [],
    seasons: seasons.map((s) => ({ number: s.season_number, name: s.name, episodeCount: s.episode_count })),
  }
}

export async function tvSeasonEpisodes(tmdbId: string, season: number): Promise<Episode[]> {
  const d = await tmdbGet<RawSeason>(`/tv/${tmdbId}/season/${season}`)
  return d.episodes.map((e) => ({
    id: `tmdb-${tmdbId}-s${season}e${e.episode_number}`,
    number: e.episode_number,
    season,
    title: e.name,
    thumbnail: img(e.still_path, 'w780'),
    duration: e.runtime ? e.runtime * 60 : undefined,
    airedAt: e.air_date,
  }))
}

export async function recommendations(id: string): Promise<TitleSummary[]> {
  const tmdbId = id.replace(/^(tmdb|tv)-/, '')
  const isTv = id.startsWith('tv-')
  const path = isTv ? `/tv/${tmdbId}` : `/movie/${tmdbId}`
  const r = await tmdbGet<RawMovieDetails & RawTvDetails>(path, { append_to_response: 'recommendations' })
  return (r.recommendations?.results ?? []).map(mapTitle).slice(0, 20)
}
