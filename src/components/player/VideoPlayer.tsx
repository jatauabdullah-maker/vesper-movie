import { useEffect, useRef, useState, useCallback } from 'react'
import Plyr from 'plyr'
import 'plyr/dist/plyr.css'
import toast from 'react-hot-toast'
import type { StreamSource, SubtitleTrack } from '../../types'
import { IconAlert, IconRefresh } from '../common/Icons'

interface Props {
  sources: StreamSource[]
  subtitles?: SubtitleTrack[]
  poster?: string
  startAt?: number
  onTimeUpdate?: (pos: number, dur: number) => void
  onEnded?: () => void
}

/**
 * Embed player with automatic server failover.
 * Sequentially switches to the next streaming server if a server encounters an error.
 * Displays a popup toast if all available servers fail.
 */
function EmbedPlayer({
  sources,
  onTimeUpdate,
  onEnded,
}: {
  sources: StreamSource[]
  onTimeUpdate?: (pos: number, dur: number) => void
  onEnded?: () => void
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [allFailed, setAllFailed] = useState(false)
  const [loadingServer, setLoadingServer] = useState(true)
  const activeSource = sources[activeIndex] || sources[0]

  useEffect(() => {
    setActiveIndex(0)
    setAllFailed(false)
    setLoadingServer(true)
  }, [sources])

  const tryNextServer = useCallback(
    (reason?: string) => {
      setActiveIndex((prev) => {
        const next = prev + 1
        if (next < sources.length) {
          toast.error(
            reason
              ? `${reason}. Trying Server ${next + 1}…`
              : `Server ${prev + 1} failed. Auto-switching to Server ${next + 1}…`,
            { duration: 4000 }
          )
          setLoadingServer(true)
          return next
        } else {
          setAllFailed(true)
          toast.error('All streaming servers failed to load. Please try again later.', {
            duration: 6000,
            id: 'all-servers-failed',
          })
          return prev
        }
      })
    },
    [sources]
  )

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const d = e.data
      if (!d || typeof d !== 'object') return

      // standard player events
      if (d.type === 'PLAYER_EVENT') {
        const ev = d.data
        if (!ev) return
        if (ev.event === 'timeupdate' && typeof ev.currentTime === 'number') {
          onTimeUpdate?.(ev.currentTime, ev.duration || 0)
          setLoadingServer(false)
        }
        if (ev.event === 'ended') onEnded?.()
        if (ev.event === 'error') tryNextServer('Streaming error occurred')
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [onTimeUpdate, onEnded, tryNextServer])

  const handleIframeError = () => {
    tryNextServer('Failed to connect to streaming server')
  }

  const handleManualSwitch = (index: number) => {
    setActiveIndex(index)
    setAllFailed(false)
    setLoadingServer(true)
  }

  const handleRetryAll = () => {
    setActiveIndex(0)
    setAllFailed(false)
    setLoadingServer(true)
  }

  return (
    <div className="rounded-xl overflow-hidden bg-black shadow-2xl shadow-black/60 ring-1 ring-line">
      <div className="aspect-video w-full relative bg-neutral-950 flex items-center justify-center">
        {allFailed ? (
          <div className="p-6 text-center space-y-4 max-w-md">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
              <IconAlert width={24} height={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold">Playback Unavailable</h3>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                All {sources.length} streaming servers were attempted but could not load this title right now.
              </p>
            </div>
            <button
              onClick={handleRetryAll}
              className="btn-shimmer inline-flex items-center gap-2 bg-gradient-to-r from-brand2 to-brand px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg"
            >
              <IconRefresh width={14} height={14} /> Retry All Servers
            </button>
          </div>
        ) : (
          <>
            {loadingServer && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-semibold text-muted">
                  Connecting to Server {activeIndex + 1} ({activeSource?.quality || 'Stream'})…
                </span>
              </div>
            )}
            <iframe
              key={activeSource?.url}
              src={activeSource?.url}
              title={`Streaming Server ${activeIndex + 1}`}
              className="absolute inset-0 w-full h-full border-0"
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
              allowFullScreen
              referrerPolicy="no-referrer"
              onLoad={() => setLoadingServer(false)}
              onError={handleIframeError}
            />
          </>
        )}
      </div>

      {sources.length > 1 && (
        <div className="flex items-center gap-2.5 p-3 bg-surface2 overflow-x-auto no-scrollbar border-t border-line/40">
          <span className="text-[11px] font-bold text-muted uppercase tracking-wider px-1">Servers:</span>
          {sources.map((s, idx) => (
            <button
              key={s.url}
              onClick={() => handleManualSwitch(idx)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeIndex === idx && !allFailed
                  ? 'bg-gradient-to-r from-brand2 to-brand text-white shadow-md shadow-brand2/30 btn-shimmer'
                  : 'bg-white/5 text-muted hover:text-white hover:bg-white/10'
              }`}
            >
              Server {idx + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function VideoPlayer(props: Props) {
  const embedSources = props.sources.filter((s) => s.type === 'embed')
  if (embedSources.length > 0) {
    return (
      <EmbedPlayer
        sources={embedSources}
        onTimeUpdate={props.onTimeUpdate}
        onEnded={props.onEnded}
      />
    )
  }
  return <PlyrPlayer {...props} />
}

function PlyrPlayer({
  sources,
  subtitles = [],
  poster,
  startAt = 0,
  onTimeUpdate,
  onEnded,
}: Props) {
  const ref = useRef<HTMLVideoElement>(null)
  const player = useRef<Plyr | null>(null)

  useEffect(() => {
    if (!ref.current) return
    const opts: Plyr.Options = {
      controls: [
        'play-large', 'play', 'rewind', 'progress', 'current-time', 'duration',
        'mute', 'volume', 'captions', 'settings', 'pip', 'airplay', 'fullscreen',
      ],
      settings: ['captions', 'quality', 'speed'],
      speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
      keyboard: { focused: true, global: true },
      tooltips: { controls: true, seek: true },
      seekTime: 10,
    }

    const p = new Plyr(ref.current, opts)
    player.current = p

    if (sources[0]) {
      p.source = {
        type: 'video',
        title: 'Feature',
        sources: sources.map((s) => ({
          src: s.url,
          type: s.url.includes('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp4',
        })),
        poster,
        tracks: subtitles.map((s) => ({
          kind: 'subtitles' as const,
          label: s.label,
          srcLang: s.lang,
          src: s.url,
          default: !!s.default,
        })),
      }
    }

    const handleTime = () => {
      if (ref.current) onTimeUpdate?.(ref.current.currentTime, ref.current.duration || 0)
    }
    const handleEnded = () => onEnded?.()
    const handleReady = () => {
      if (ref.current && startAt > 0 && startAt < (ref.current.duration || Infinity) - 5) {
        ref.current.currentTime = startAt
      }
    }

    p.on('timeupdate', handleTime)
    p.on('ended', handleEnded)
    p.on('ready', handleReady)

    return () => {
      p.destroy()
      player.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources, subtitles, poster])

  return (
    <div className="rounded-xl overflow-hidden bg-black shadow-2xl shadow-black/60 ring-1 ring-line aspect-video [&_.plyr]:h-full">
      <video ref={ref} playsInline crossOrigin="anonymous" className="w-full h-full" />
    </div>
  )
}
