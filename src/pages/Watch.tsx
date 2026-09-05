import { useEffect, useMemo, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import VideoPlayer from '../components/player/VideoPlayer'
import { getTitleWithEpisodes, getStream, parseEpisodeId } from '../services/api'
import { useApp } from '../context/AppContext'
import { useProgressTracker } from '../hooks/usePlayer'
import DownloadModal from '../components/title/DownloadModal'
import { formatDuration, classNames } from '../utils/helpers'
import { IconBack, IconChevronLeft, IconChevronRight, IconDownload } from '../components/common/Icons'
import type { TitleDetails, Episode, StreamResponse } from '../types'

export default function Watch() {
  const { id, episodeId } = useParams<{ id: string; episodeId: string }>()
  const navigate = useNavigate()
  const [title, setTitle] = useState<TitleDetails | null>(null)
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [stream, setStream] = useState<StreamResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dlOpen, setDlOpen] = useState(false)
  const { settings, localVideoFile } = useApp()

  const parsed = useMemo(() => (episodeId ? parseEpisodeId(episodeId) : null), [episodeId])
  const isMovie = id === 'local' || parsed?.kind === 'movie'

  const episode = useMemo(() => episodes.find((e) => e.id === episodeId) ?? episodes[0] ?? null, [episodes, episodeId])
  const { track, getInitialPosition } = useProgressTracker(title, episode)

  useEffect(() => {
    if (!id) return
    if (id === 'local') {
      setTitle({
        id: 'local',
        title: localVideoFile ? localVideoFile.name : 'Local Offline Video',
        type: 'Movie',
        episodes: [],
      } as any)
      setEpisodes([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    getTitleWithEpisodes(id)
      .then((t) => {
        setTitle(t)
        const sorted = [...t.episodes].sort(
          (x, y) => (x.season ?? 1) - (y.season ?? 1) || x.number - y.number
        )
        setEpisodes(sorted)
      })
      .catch(() => setError('Failed to load this title.'))
      .finally(() => setLoading(false))
  }, [id, localVideoFile])

  const imdbId = title?.imdbId

  useEffect(() => {
    if (!episodeId) return
    if (id === 'local') {
      if (localVideoFile) {
        const url = URL.createObjectURL(localVideoFile)
        setStream({
          sources: [
            {
              url,
              type: localVideoFile.type || 'video/mp4',
              quality: 'Offline Video File',
            },
          ],
          subtitles: [],
        })
      } else {
        setError('No local video file selected.')
      }
      return
    }
    let live = true
    setStream(null)
    setError(null)

    getStream(episodeId, { imdbId })
      .then((s) => {
        if (live) setStream(s)
      })
      .catch((err) => {
        if (!live) return
        if (err?.code === 'NO_SOURCE') setError('NO_SOURCE')
        else setError('Stream unavailable for this title.')
      })

    return () => {
      live = false
    }
  }, [episodeId, imdbId, id, localVideoFile])

  // Sorted episode list for prev/next — movies have exactly one entry.
  const idx = episodes.findIndex((e) => e.id === episodeId)
  const prev = idx > 0 ? episodes[idx - 1] : null
  const next = idx >= 0 && idx < episodes.length - 1 ? episodes[idx + 1] : null

  if (loading) {
    return (
      <div className="px-4 md:px-10 pt-24 max-w-6xl mx-auto">
        <div className="skeleton aspect-video w-full rounded-xl" />
        <div className="skeleton h-7 w-1/2 rounded mt-4" />
      </div>
    )
  }

  return (
    <div className="px-4 md:px-10 pt-24 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4 gap-3">
        <button
          onClick={() => navigate(id === 'local' ? '/downloads' : `/title/${id}`)}
          className="flex items-center gap-2 text-sm text-muted hover:text-white transition-colors"
        >
          <IconBack width={16} height={16} /> Back to {id === 'local' ? 'downloads' : title?.title ?? 'details'}
        </button>
        {error === 'NO_SOURCE' && (
          <Link to="/settings" className="text-xs text-brand hover:text-white transition-colors">
            Configure source →
          </Link>
        )}
      </div>

      {stream && (stream.sources?.length ?? 0) > 0 ? (
        <VideoPlayer
          sources={stream.sources}
          subtitles={stream.subtitles}
          poster={episode?.thumbnail ?? title?.banner ?? title?.poster}
          startAt={getInitialPosition()}
          onTimeUpdate={track}
          onEnded={() => {
            if (settings.autoplayNext && next && id) navigate(`/watch/${id}/${next.id}`)
          }}
        />
      ) : error === 'NO_SOURCE' ? (
        <div className="glass rounded-xl overflow-hidden">
          {title?.trailerUrl ? (
            <>
              <div className="aspect-video w-full bg-black">
                <iframe
                  src={`${title.trailerUrl}?rel=0&modestbranding=1`}
                  title="Trailer"
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <p className="text-xs text-muted mt-2 px-1">
                No streaming servers responded — showing the official trailer. Try switching servers or coming back later.
              </p>
            </>
          ) : (
            <div className="aspect-video flex flex-col items-center justify-center p-8 text-center bg-surface2">
              <p className="text-muted text-sm max-w-md leading-relaxed">
                No streaming source is available for this title.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="glass rounded-xl aspect-video flex items-center justify-center">
          <p className="text-muted text-sm px-6 text-center">{error ?? 'Loading stream…'}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mt-5">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold truncate">
            {title?.title}
            {!isMovie && episode && (
              <span className="text-brand">
                {' '}· S{episode.season}E{episode.number}
              </span>
            )}
          </h1>
          {episode?.title && !isMovie && <p className="text-sm text-muted truncate mt-1">{episode.title}</p>}
        </div>
        <div className="flex items-center gap-2">
          {id !== 'local' && (
            <button
              onClick={() => setDlOpen(true)}
              className="flex items-center gap-1.5 glass px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-white/15 transition-colors"
            >
              <IconDownload width={16} height={16} className="text-brand shrink-0" />
              <span>Download</span>
            </button>
          )}
          {prev && (
            <Link to={`/watch/${id}/${prev.id}`} className="flex items-center gap-1.5 glass px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-white/15">
              <IconChevronLeft width={16} height={16} /> Prev
            </Link>
          )}
          {next && (
            <Link to={`/watch/${id}/${next.id}`} className="flex items-center gap-1.5 bg-gradient-to-r from-brand2 to-brand px-4 py-2.5 rounded-xl text-sm font-bold">
              Next <IconChevronRight width={16} height={16} />
            </Link>
          )}
        </div>
      </div>

      {/* Keyboard shortcuts hint — desktop only */}
      <div className="hidden md:block mt-3 text-center">
        <p className="text-[11px] text-muted/60 select-none">
          <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono">Space</kbd> play/pause{' '}
          <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono">←</kbd>{' '}
          <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono">→</kbd> seek 10s
        </p>
      </div>

      {/* Episode rail (TV only) */}
      {!isMovie && episodes.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-bold mb-3">All Episodes</h2>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
            {episodes.map((ep) => (
              <Link
                key={ep.id}
                to={`/watch/${id}/${ep.id}`}
                title={ep.title ?? `Episode ${ep.number}`}
                className={classNames(
                  'rounded-lg py-3 text-center text-sm font-semibold transition-colors border',
                  ep.id === episodeId
                    ? 'bg-gradient-to-br from-brand2 to-brand border-transparent'
                    : 'bg-surface2 border-line hover:border-brand/60'
                )}
              >
                {ep.duration != null && ep.id === episodeId
                  ? formatDuration(ep.duration)
                  : ep.number}
              </Link>
            ))}
          </div>
        </div>
      )}

      {title && id !== 'local' && (
        <DownloadModal
          open={dlOpen}
          onClose={() => setDlOpen(false)}
          title={title}
          mode={isMovie ? 'movie' : 'episode'}
          episode={isMovie ? null : episode}
        />
      )}
    </div>
  )
}
