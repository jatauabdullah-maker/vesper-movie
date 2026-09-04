import { useEffect, useMemo, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { getTitleWithEpisodes, getRecommendations, parseEpisodeId } from '../services/api'
import { useApp } from '../context/AppContext'
import { getProgress } from '../services/storage'
import { formatDuration, formatRuntime, classNames } from '../utils/helpers'
import TitleRow from '../components/title/TitleRow'
import {
  IconPlay, IconPlus, IconCheck, IconStar, IconClock,
  IconChevronDown, IconBack, IconFilm, IconTv, IconDownload,
} from '../components/common/Icons'
import type { TitleDetails as Details, TitleSummary } from '../types'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://vesper-api-za8p.onrender.com'

export default function TitleDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [title, setTitle] = useState<Details | null>(null)
  const [related, setRelated] = useState<TitleSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openSeason, setOpenSeason] = useState<number | null>(1)
  const [downloading, setDownloading] = useState(false)
  const { isInWatchlist, toggleWatchlist } = useApp()

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(null)
    setRelated([])
    getTitleWithEpisodes(id)
      .then((d) => {
        setTitle(d)
        const seasons = d.seasons ?? []
        setOpenSeason(seasons[0]?.number ?? null)
      })
      .catch(() => setError('Failed to load this title.'))
      .finally(() => setLoading(false))
    getRecommendations(id).then(setRelated).catch(() => setRelated([]))
  }, [id])

  const seasons = useMemo(() => {
    if (!title) return new Map<number, Details['episodes']>()
    const map = new Map<number, Details['episodes']>()
    for (const ep of title.episodes) {
      const s = ep.season ?? 1
      if (!map.has(s)) map.set(s, [])
      map.get(s)!.push(ep)
    }
    for (const list of map.values()) list.sort((a, b) => a.number - b.number)
    return map
  }, [title])

  const handleBatchDownload = async () => {
    if (!title) return
    setDownloading(true)
    const isMovie = title.type === 'Movie'

    let downloadItems = []
    let jobTitle = title.title

    if (isMovie) {
      downloadItems = [
        {
          episodeId: `${title.id}-m`,
          title: title.title,
          type: 'movie',
        },
      ]
    } else {
      const currentSeasonEps = seasons.get(openSeason ?? 1) || []
      if (currentSeasonEps.length === 0) {
        toast.error('No episodes found for the active season.')
        setDownloading(false)
        return
      }
      jobTitle = `${title.title} - Season ${openSeason}`
      downloadItems = currentSeasonEps.map((ep) => ({
        episodeId: ep.id,
        title: `S${ep.season}E${ep.number} - ${ep.title || 'Untitled'}`,
        season: ep.season,
        episode: ep.number,
        type: 'tv',
      }))
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/downloads/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: jobTitle,
          items: downloadItems,
        }),
      })

      if (res.ok) {
        toast.success(`Enqueued ${downloadItems.length} items for batch download!`, { id: 'batch-success' })
        navigate('/downloads')
      } else {
        toast.error('Failed to create download job.')
      }
    } catch {
      toast.error('Download server is offline or restarting. Please try again in a few seconds.')
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="-mt-16">
        <div className="skeleton h-[46vh] w-full" />
        <div className="px-4 md:px-10 mt-6 max-w-5xl mx-auto grid md:grid-cols-[220px_1fr] gap-8">
          <div className="skeleton aspect-[2/3] rounded-xl -mt-28 relative z-10" />
          <div className="space-y-3 pt-4">
            <div className="skeleton h-8 w-2/3 rounded" />
            <div className="skeleton h-4 w-1/3 rounded" />
            <div className="skeleton h-24 w-full rounded" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !title) {
    return (
      <div className="px-4 md:px-10 pt-24 max-w-xl mx-auto text-center">
        <div className="glass rounded-2xl p-10">
          <p className="text-muted text-sm">{error ?? 'Not found'}</p>
          <button onClick={() => navigate(-1)} className="mt-5 text-brand text-sm font-semibold">← Go back</button>
        </div>
      </div>
    )
  }

  const isMovie = title.type === 'Movie'
  const inList = isInWatchlist(title.id)

  const firstUnwatched = title.episodes.find((e) => {
    const p = getProgress(e.id)
    return !p || p.positionSec < p.durationSec * 0.9
  })

  return (
    <div className="-mt-16">
      {/* Backdrop */}
      <div className="relative h-[46vh] min-h-[320px] w-full overflow-hidden">
        <img src={title.banner || title.poster} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 hero-fade" />
        <div className="absolute inset-0 bg-gradient-to-r from-bg/85 via-bg/25 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/80 via-black/30 to-transparent" />
        <button
          onClick={() => navigate(-1)}
          className="absolute top-20 left-4 md:top-6 md:left-10 glass rounded-full p-3 md:p-2.5 hover:bg-white/15 z-20"
          aria-label="Go back"
        >
          <IconBack width={18} height={18} />
        </button>
      </div>

      <div className="px-4 md:px-10 max-w-6xl mx-auto grid md:grid-cols-[230px_1fr] gap-6 md:gap-10">
        {/* Poster */}
        <div className="-mt-24 md:-mt-32 relative z-10 w-40 md:w-full">
          <img
            src={title.poster}
            alt={title.title}
            className="w-full aspect-[2/3] object-cover rounded-xl ring-1 ring-line shadow-2xl shadow-black/60"
          />
        </div>

        {/* Info */}
        <div className="pt-2 md:pt-4 min-w-0">
          <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight">{title.title}</h1>
          {title.tagline && <p className="text-sm text-brand/80 italic mt-1">{title.tagline}</p>}
          <div className="flex flex-wrap items-center gap-2 mt-3 text-xs font-medium">
            {title.score != null && (
              <span className="glass px-2 py-1 rounded-md flex items-center gap-1">
                <IconStar width={11} height={11} className="text-yellow-400" /> {title.score.toFixed(1)}
              </span>
            )}
            {title.year && <span className="glass px-2 py-1 rounded-md">{title.year}</span>}
            <span className="glass px-2 py-1 rounded-md text-brand flex items-center gap-1">
              {isMovie ? <IconFilm width={11} height={11} /> : <IconTv width={11} height={11} />}
              {title.type}
            </span>
            {title.status && <span className="glass px-2 py-1 rounded-md">{title.status}</span>}
            {isMovie && title.runtime ? (
              <span className="glass px-2 py-1 rounded-md flex items-center gap-1">
                <IconClock width={11} height={11} /> {formatRuntime(title.runtime)}
              </span>
            ) : null}
            {!isMovie && title.episodes.length > 0 && (
              <span className="glass px-2 py-1 rounded-md flex items-center gap-1">
                <IconClock width={11} height={11} /> {title.episodes.length} episodes
              </span>
            )}
          </div>
          {title.genres && (
            <div className="flex flex-wrap gap-2 mt-3">
              {title.genres.map((g) => (
                <Link
                  key={g}
                  to={`/search?q=${encodeURIComponent(g)}`}
                  className="text-xs bg-surface2 border border-line rounded-full px-3 py-1 hover:border-brand/60 hover:text-brand transition-colors"
                >
                  {g}
                </Link>
              ))}
            </div>
          )}
          {title.synopsis && <p className="text-sm text-muted leading-relaxed mt-4 max-w-3xl">{title.synopsis}</p>}
          {title.studios && title.studios.length > 0 && (
            <p className="text-xs text-muted/70 mt-3">{title.studios.join(' · ')}</p>
          )}

          <div className="flex flex-wrap gap-3 mt-6">
            {firstUnwatched && (
              <Link
                to={`/watch/${title.id}/${firstUnwatched.id}`}
                className="flex items-center gap-2 bg-gradient-to-r from-brand2 to-brand px-6 py-3 rounded-xl font-bold shadow-lg shadow-brand2/40 hover:scale-[1.03] transition-transform"
              >
                <IconPlay width={18} height={18} />
                {(() => {
                  const parsed = parseEpisodeId(firstUnwatched.id)
                  if (parsed?.kind === 'movie') {
                    const p = getProgress(firstUnwatched.id)
                    return p && p.positionSec > 10 ? 'Resume' : 'Watch Now'
                  }
                  return firstUnwatched.number === 1 && firstUnwatched.season === (title.seasons?.[0]?.number ?? 1)
                    ? 'Start Watching'
                    : `Resume S${firstUnwatched.season}E${firstUnwatched.number}`
                })()}
              </Link>
            )}

            <button
              onClick={handleBatchDownload}
              disabled={downloading}
              className="flex items-center gap-2 bg-white/5 border border-line px-5 py-3 rounded-xl font-semibold hover:bg-white/10 text-white transition-all disabled:opacity-50"
            >
              <IconDownload width={18} height={18} className="text-brand" />
              {downloading ? 'Enqueuing…' : isMovie ? 'Batch Download' : `Batch Download Season ${openSeason ?? 1}`}
            </button>

            <button
              onClick={() => {
                const added = toggleWatchlist({ id: title.id, title: title.title, poster: title.poster, addedAt: Date.now() })
                toast.success(added ? 'Added to My List' : 'Removed from My List')
              }}
              className="flex items-center gap-2 glass px-5 py-3 rounded-xl font-semibold hover:bg-white/15"
            >
              {inList ? <IconCheck width={18} height={18} /> : <IconPlus width={18} height={18} />}
              {inList ? 'In My List' : 'My List'}
            </button>
          </div>
        </div>
      </div>

      {/* Episodes (TV only) */}
      {!isMovie && seasons.size > 0 && (
        <div className="px-4 md:px-10 max-w-6xl mx-auto mt-14">
          <h2 className="text-xl font-bold mb-4">Episodes</h2>
          <div className="space-y-3">
            {[...seasons.keys()].map((season) => {
              const eps = seasons.get(season) ?? []
              const open = openSeason === season
              const seasonMeta = title.seasons?.find((s) => s.number === season)
              return (
                <div key={season} className="glass rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4">
                    <button
                      onClick={() => setOpenSeason(open ? null : season)}
                      className="flex items-center gap-3 font-semibold text-left w-full"
                    >
                      <IconChevronDown
                        width={18} height={18}
                        className={classNames('transition-transform', open ? 'rotate-180' : '')}
                      />
                      {seasonMeta?.name ?? `Season ${season}`}
                      <span className="text-muted text-xs font-normal">({eps.length})</span>
                    </button>
                  </div>

                  <AnimatePresence>
                    {open && (
                      <motion.ul
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="border-t border-line"
                      >
                        {eps.map((ep) => {
                          const p = getProgress(ep.id)
                          const pct = p && p.durationSec > 0 ? Math.round((p.positionSec / p.durationSec) * 100) : 0
                          return (
                            <li key={ep.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/5 transition-colors border-b border-line/50 last:border-0">
                              <span className="text-muted text-sm font-mono w-8 shrink-0">{String(ep.number).padStart(2, '0')}</span>
                              {ep.thumbnail && (
                                <img src={ep.thumbnail} alt="" loading="lazy" className="hidden sm:block w-24 aspect-video object-cover rounded-lg" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{ep.title ?? `Episode ${ep.number}`}</p>
                                <div className="flex items-center gap-2 text-[11px] text-muted">
                                  {ep.duration != null && <span>{formatDuration(ep.duration)}</span>}
                                  {ep.airedAt && <span>{ep.airedAt}</span>}
                                  {pct > 0 && <span className="text-brand">• {pct}% watched</span>}
                                </div>
                                {pct > 0 && (
                                  <div className="w-24 h-0.5 bg-white/10 rounded mt-1">
                                    <div className="h-full bg-brand rounded" style={{ width: `${pct}%` }} />
                                  </div>
                                )}
                              </div>
                              <Link
                                to={`/watch/${title.id}/${ep.id}`}
                                className="shrink-0 glass rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-white/15"
                              >
                                Play
                              </Link>
                            </li>
                          )
                        })}
                      </motion.ul>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {related.length > 0 && (
        <div className="max-w-6xl mx-auto">
          <TitleRow title="More Like This" items={related} />
        </div>
      )}
    </div>
  )
}
