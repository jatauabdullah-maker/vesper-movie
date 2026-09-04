export interface TitleSummary {
  id: string // `tmdb-<tmdbId>`
  title: string
  poster: string
  banner?: string
  rating?: number // 0-10
  year?: number
  type?: string // Movie, TV
  status?: string // Returning Series, Released...
  genres?: string[]
  runtime?: number // minutes
  justAiredEpisode?: number // latest aired episode (Airing Today row only)
}

export interface Episode {
  id: string // `tmdb-<tvId>-s<n>e<n>`
  number: number
  season: number
  title?: string
  thumbnail?: string
  duration?: number // seconds
  airedAt?: string
}

export interface TitleDetails extends TitleSummary {
  synopsis?: string
  score?: number
  tagline?: string
  studios?: string[]
  trailerUrl?: string // youtube embed url
  imdbId?: string
  episodes: Episode[]
  seasons?: { number: number; name: string; episodeCount: number }[]
}

export interface StreamSource {
  url: string
  quality: string // provider label, e.g. "Server 1 · VidLink"
  type?: string // "embed" | "hls" | "mp4"
  sizeMB?: number
  referer?: string
}

export interface SubtitleTrack {
  url: string
  lang: string
  label: string
  default?: boolean
}

export interface StreamResponse {
  sources: StreamSource[]
  subtitles: SubtitleTrack[]
}

export interface SearchFilters {
  q?: string
  type?: string // '' | 'movie' | 'tv'
  genre?: string // tmdb genre id
  year?: number
  page?: number
}

export interface PagedResult<T> {
  items: T[]
  page: number
  totalPages: number
}

export interface WatchProgress {
  episodeId: string
  titleId: string
  titleName: string
  poster: string
  episodeNumber: number
  positionSec: number
  durationSec: number
  updatedAt: number
}

export interface WatchlistItem {
  id: string
  title: string
  poster: string
  addedAt: number
}

export interface Settings {
  autoplayNext: boolean
}
