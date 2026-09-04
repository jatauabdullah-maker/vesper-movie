/**
 * Embed provider registry — the movie-side equivalent of Aurora's
 * `tryembed.us.cc/embed/anime/<anilistId>/<episode>/<sub|dub>` construction.
 *
 * Pure URL construction on TMDB/IMDB ids: no I/O, no scraping, nothing to
 * break at resolve time. Domain churn is the core problem in the movie
 * world, so providers are swappable rows — add/remove/reorder here and the
 * player's server switcher follows automatically.
 */
export interface EmbedProvider {
  id: string
  name: string
  keyType: 'tmdb' | 'imdb'
  movieUrl: (id: string) => string
  tvUrl: (id: string, season: number, episode: number) => string
}

export const PROVIDERS: EmbedProvider[] = [
  {
    id: 'vidlink',
    name: 'VidLink',
    keyType: 'tmdb',
    movieUrl: (id) => `https://vidlink.pro/movie/${id}`,
    tvUrl: (id, s, e) => `https://vidlink.pro/tv/${id}/${s}/${e}`,
  },
  {
    id: 'vidzee',
    name: 'VidZee',
    keyType: 'tmdb',
    movieUrl: (id) => `https://player.vidzee.wtf/embed/movie/${id}`,
    tvUrl: (id, s, e) => `https://player.vidzee.wtf/embed/tv/${id}/${s}/${e}`,
  },
  {
    id: 'superembed',
    name: 'SuperEmbed',
    keyType: 'tmdb',
    movieUrl: (id) => `https://multiembed.mov/?video_id=${id}&tmdb=1`,
    tvUrl: (id, s, e) => `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${s}&e=${e}`,
  },
  {
    id: 'vidsrc',
    name: 'VidSrc',
    keyType: 'tmdb',
    movieUrl: (id) => `https://vidsrc.xyz/embed/movie?tmdb=${id}`,
    tvUrl: (id, s, e) => `https://vidsrc.xyz/embed/tv?tmdb=${id}&season=${s}&episode=${e}`,
  },
  {
    id: 'twoembed',
    name: '2Embed',
    keyType: 'tmdb',
    movieUrl: (id) => `https://www.2embed.cc/embed/${id}`,
    tvUrl: (id, s, e) => `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}`,
  },
  {
    id: 'vidsrcme',
    name: 'VidSrc.me',
    keyType: 'imdb',
    movieUrl: (imdb) => `https://vidsrc.me/embed/${imdb}`,
    tvUrl: (imdb, s, e) => `https://vidsrc.me/embed/${imdb}/${s}-${e}/`,
  },
  {
    id: 'vidjoy',
    name: 'VidJoy',
    keyType: 'tmdb',
    movieUrl: (id) => `https://vidjoy.pro/embed/movie/${id}`,
    tvUrl: (id, s, e) => `https://vidjoy.pro/embed/tv/${id}/${s}/${e}`,
  },
]
