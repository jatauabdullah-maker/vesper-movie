import type { WatchProgress, WatchlistItem, Settings } from '../types'

const K = {
  progress: 'vesper:progress',
  watchlist: 'vesper:watchlist',
  history: 'vesper:history',
  settings: 'vesper:settings',
} as const

export const DEFAULT_SETTINGS: Settings = {
  autoplayNext: true,
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage full — ignore */
  }
}

// ---------- Watch progress ----------
export function getAllProgress(): Record<string, WatchProgress> {
  return read(K.progress, {})
}

export function getProgress(episodeId: string): WatchProgress | undefined {
  return getAllProgress()[episodeId]
}

export function saveProgress(p: WatchProgress) {
  const all = getAllProgress()
  all[p.episodeId] = p
  write(K.progress, all)

  const history = read<WatchProgress[]>(K.history, [])
  const filtered = history.filter((h) => h.episodeId !== p.episodeId)
  filtered.unshift(p)
  write(K.history, filtered.slice(0, 100))
}

export function clearProgress(episodeId: string) {
  const all = getAllProgress()
  delete all[episodeId]
  write(K.progress, all)
}

export function getContinueWatching(): WatchProgress[] {
  return Object.values(getAllProgress())
    .filter((p) => p.positionSec > 10 && p.positionSec < p.durationSec * 0.95)
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export function getHistory(): WatchProgress[] {
  return read(K.history, [])
}

export function clearHistory() {
  write(K.history, [])
}

// ---------- Watchlist ----------
export function getWatchlist(): WatchlistItem[] {
  return read(K.watchlist, [])
}

export function isInWatchlist(id: string): boolean {
  return getWatchlist().some((x) => x.id === id)
}

export function toggleWatchlist(item: WatchlistItem): boolean {
  const list = getWatchlist()
  const idx = list.findIndex((x) => x.id === item.id)
  if (idx >= 0) {
    list.splice(idx, 1)
    write(K.watchlist, list)
    return false
  }
  list.unshift(item)
  write(K.watchlist, list)
  return true
}

// ---------- Settings ----------
export function getSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...read<Partial<Settings>>(K.settings, {}) }
}

export function saveSettings(s: Settings) {
  write(K.settings, s)
}

// ---------- TMDB key (runtime override so users don't need a rebuild) ----------
export function getTmdbKeyOverride(): string {
  return localStorage.getItem('vesper:tmdb-key') ?? ''
}

export function setTmdbKeyOverride(key: string) {
  if (key.trim()) localStorage.setItem('vesper:tmdb-key', key.trim())
  else localStorage.removeItem('vesper:tmdb-key')
}
