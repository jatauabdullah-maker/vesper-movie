import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { IconDownload, IconX } from '../common/Icons'
import { saveLocalJob, type LocalDownloadItem } from '../../services/storage'
import type { TitleDetails as Details, Episode } from '../../types'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://vesper-api-za8p.onrender.com'

type Mode = 'movie' | 'episode' | 'batch'
type Phase = 'resolving' | 'ready' | 'started' | 'error'

interface Props {
  open: boolean
  onClose: () => void
  title: Details
  mode: Mode
  seasonNumber?: number
  seasonEpisodes?: Episode[]
  episode?: Episode | null
}

const qualityRank = (q: string) => Number(q) || 0

function fileUrl(episodeId: string, name: string, quality: string): string {
  const params = new URLSearchParams({ episodeId, title: name, quality })
  return `${BACKEND_URL}/api/downloads/file?${params.toString()}`
}

function triggerDeviceDownload(url: string) {
  const a = document.createElement('a')
  a.href = url
  a.rel = 'noreferrer'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export default function DownloadModal({ open, onClose, title, mode, seasonNumber, seasonEpisodes, episode }: Props) {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('resolving')
  const [qualities, setQualities] = useState<Record<string, { sizeMB: number }>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [from, setFrom] = useState(1)
  const [to, setTo] = useState(1)
  const [batchCount, setBatchCount] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')

  const eps = seasonEpisodes ?? []
  const rangeEps = useMemo(() => eps.slice(from - 1, to), [eps, from, to])

  // What we resolve first to learn which qualities exist
  const probeId =
    mode === 'movie' ? `${title.id}-m` : mode === 'episode' && episode ? episode.id : eps[0]?.id ?? ''

  const displayName =
    mode === 'episode' && episode
      ? `${title.title} · S${episode.season}E${episode.number}`
      : mode === 'batch'
        ? `${title.title} · Season ${seasonNumber ?? 1}`
        : title.title

  useEffect(() => {
    if (!open) return
    setPhase('resolving')
    setQualities({})
    setSelected(null)
    setErrorMsg('')
    if (mode === 'batch' && eps.length > 0) {
      setFrom(eps[0].number)
      setTo(eps[eps.length - 1].number)
    }

    let live = true
    const run = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/downloads/resolve?episodeId=${encodeURIComponent(probeId)}`)
        if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || 'Sources did not respond.')
        const data = await res.json()
        if (!live) return
        const q: Record<string, { sizeMB: number }> = {}
        for (const [k, v] of Object.entries<any>(data.qualities ?? {})) {
          if (v && typeof v === 'object') q[k] = { sizeMB: Number(v.sizeMB) || 0 }
          else q[k] = { sizeMB: Number(v) || 0 }
        }
        setQualities(q)
        const best = Object.keys(q).sort((a: string, b: string) => qualityRank(b) - qualityRank(a))[0]
        setSelected(best ?? null)
        setPhase('ready')
      } catch (err: unknown) {
        if (!live) return
        setErrorMsg(err instanceof Error ? err.message : 'Could not find sources.')
        setPhase('error')
      }
    }
    run()
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, probeId])

  const startDownload = async () => {
    if (!selected) return

    if (mode === 'batch') {
      const items = rangeEps.map((ep) => ({
        episodeId: ep.id,
        title: `S${ep.season}E${ep.number} - ${ep.title || 'Untitled'}`,
        season: ep.season,
        episode: ep.number,
        type: 'tv' as const,
      }))
      if (items.length === 0) return

      const res = await fetch(`${BACKEND_URL}/api/downloads/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `${title.title} - Season ${seasonNumber ?? 1}`, items }),
      }).catch(() => null)

      if (!res?.ok) {
        toast.error('Download server is waking up. Try again in a few seconds.')
        return
      }
      const data = await res.json()
      const localItems: LocalDownloadItem[] = items.map((it, idx) => ({
        id: `${data.jobId}_${idx}`,
        episodeId: it.episodeId,
        title: it.title,
        status: 'resolving',
        quality: selected,
      }))
      saveLocalJob({
        id: data.jobId,
        title: `${title.title} - Season ${seasonNumber ?? 1}`,
        createdAt: Date.now(),
        status: 'processing',
        progress: 0,
        items: localItems,
      })
      setBatchCount(items.length)
      setPhase('started')
      return
    }

    // Movie or single episode — the file downloads straight to the device
    const ep = mode === 'episode' ? episode : null
    const name = ep ? `${title.title} S${ep.season}E${ep.number}` : title.title
    const episodeId = ep ? ep.id : `${title.id}-m`
    triggerDeviceDownload(fileUrl(episodeId, name, selected))

    const qualitiesMap: Record<string, { sizeMB: number }> = { ...qualities }
    saveLocalJob({
      id: `local_${Date.now()}`,
      title: name,
      createdAt: Date.now(),
      status: 'completed',
      progress: 100,
      items: [
        {
          id: `local_${Date.now()}_0`,
          episodeId,
          title: ep ? `S${ep.season}E${ep.number} - ${ep.title || 'Untitled'}` : title.title,
          status: 'completed',
          qualities: qualitiesMap,
          quality: selected,
        },
      ],
    })
    if (mode === 'episode') {
      onClose()
      navigate('/downloads')
      return
    }
    setPhase('started')
  }

  const sortedQualities = Object.entries(qualities).sort((a, b) => qualityRank(b[0]) - qualityRank(a[0]))

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 60, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-surface border border-line rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl shadow-black/70 max-h-[92vh] overflow-y-auto no-scrollbar"
          >
            {/* Banner */}
            <div className="relative h-36 shrink-0">
              <img src={title.banner || title.poster} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent" />
              <button
                onClick={onClose}
                className="absolute top-3 right-3 glass rounded-full p-2 hover:bg-white/15 transition-colors"
                aria-label="Close"
              >
                <IconX width={14} height={14} />
              </button>
              <div className="absolute bottom-3 left-4 right-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand">
                  {mode === 'batch' ? 'Batch download' : 'Download'}
                </p>
                <h3 className="text-base font-bold truncate">{displayName}</h3>
              </div>
            </div>

            <div className="p-4 pt-1 space-y-4">
              {phase === 'resolving' && (
                <div className="space-y-3 py-2">
                  <p className="text-xs text-muted flex items-center gap-2">
                    <span className="w-3 h-3 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                    Finding sources…
                  </p>
                  <div className="space-y-2">
                    <div className="skeleton h-11 rounded-xl" />
                    <div className="skeleton h-11 rounded-xl" />
                  </div>
                </div>
              )}

              {phase === 'error' && (
                <div className="space-y-3 py-2 text-center">
                  <p className="text-xs text-muted">{errorMsg}</p>
                  <button
                    onClick={onClose}
                    className="glass px-4 py-2 rounded-xl text-xs font-semibold hover:bg-white/15"
                  >
                    Close
                  </button>
                </div>
              )}

              {phase === 'started' && (
                <div className="space-y-3 py-2 text-center">
                  <p className="text-sm font-semibold">
                    {mode === 'batch' ? `${batchCount} episodes queued` : 'Saving to your device…'}
                  </p>
                  <p className="text-xs text-muted leading-relaxed">
                    {mode === 'batch'
                      ? 'Episodes resolve one by one — watch progress on the Downloads page.'
                      : 'Your browser is grabbing the file. It also shows on the Downloads page.'}
                  </p>
                  <div className="flex gap-2 justify-center pt-1">
                    <button
                      onClick={() => {
                        onClose()
                        navigate('/downloads')
                      }}
                      className="bg-gradient-to-r from-brand2 to-brand px-5 py-2.5 rounded-xl text-xs font-bold"
                    >
                      Open Downloads
                    </button>
                    <button onClick={onClose} className="glass px-5 py-2.5 rounded-xl text-xs font-semibold hover:bg-white/15">
                      Done
                    </button>
                  </div>
                </div>
              )}

              {phase === 'ready' && (
                <>
                  {mode === 'batch' && eps.length > 0 && (
                    <div className="flex items-center gap-3">
                      <label className="flex-1 text-xs text-muted space-y-1">
                        From episode
                        <select
                          value={from}
                          onChange={(e) => {
                            const v = Number(e.target.value)
                            setFrom(v)
                            if (v > to) setTo(v)
                          }}
                          className="w-full bg-surface2 border border-line rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-brand/60"
                        >
                          {eps.map((ep) => (
                            <option key={ep.id} value={ep.number}>
                              Episode {ep.number}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex-1 text-xs text-muted space-y-1">
                        To episode
                        <select
                          value={to}
                          onChange={(e) => setTo(Math.max(Number(e.target.value), from))}
                          className="w-full bg-surface2 border border-line rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-brand/60"
                        >
                          {eps.map((ep) => (
                            <option key={ep.id} value={ep.number}>
                              Episode {ep.number}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )}

                  <div className="space-y-2">
                    <p className="text-xs text-muted">
                      {rangeEps.length > 1 ? `${rangeEps.length} episodes · ` : ''}Pick a quality
                    </p>
                    {sortedQualities.map(([q, info]) => (
                      <button
                        key={q}
                        onClick={() => setSelected(q)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${
                          selected === q
                            ? 'border-brand bg-brand/10 text-white'
                            : 'border-line bg-surface2/60 text-muted hover:text-white hover:border-brand/40'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <IconDownload width={14} height={14} className={selected === q ? 'text-brand' : ''} />
                          {q}p
                        </span>
                        <span className="text-xs font-medium">
                          {info.sizeMB >= 1000 ? `${(info.sizeMB / 1000).toFixed(1)} GB` : `${info.sizeMB} MB`}
                          {mode === 'batch' && rangeEps.length > 1 ? ' / ep' : ''}
                        </span>
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={startDownload}
                    disabled={!selected || (mode === 'batch' && rangeEps.length === 0)}
                    className="btn-shimmer w-full flex items-center justify-center gap-2 bg-gradient-to-r from-brand2 to-brand px-5 py-3.5 rounded-xl text-sm font-bold text-white shadow-lg shadow-brand2/30 disabled:opacity-50"
                  >
                    <IconDownload width={15} height={15} />
                    {mode === 'batch' ? `Download ${rangeEps.length} episodes` : 'Download'}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
