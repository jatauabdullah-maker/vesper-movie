import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconBack, IconDownload, IconRefresh, IconTrash } from '../components/common/Icons'
import toast from 'react-hot-toast'
import { useApp } from '../context/AppContext'
import {
  getLocalJobs,
  updateLocalJob,
  removeLocalJob,
  type LocalDownloadJob,
  type LocalDownloadItem,
} from '../services/storage'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://vesper-api-za8p.onrender.com'

const qualityRank = (q: string) => Number(q) || 0

function bestQuality(item: LocalDownloadItem): string | null {
  if (!item.qualities) return item.quality ?? null
  const keys = Object.keys(item.qualities)
  if (keys.length === 0) return item.quality ?? null
  return keys.sort((a, b) => qualityRank(b) - qualityRank(a))[0]
}

function fileUrl(item: LocalDownloadItem, quality: string): string {
  const params = new URLSearchParams({ episodeId: item.episodeId, title: item.title, quality })
  return `${BACKEND_URL}/api/downloads/file?${params.toString()}`
}

function mergeServerJob(local: LocalDownloadJob, server: any): LocalDownloadJob {
  const serverItems: any[] = server.items ?? []
  return {
    ...local,
    status: server.status === 'completed' || server.status === 'failed' ? 'completed' : 'processing',
    progress: server.progress ?? local.progress,
    items: local.items.map((li) => {
      const si = serverItems.find((s) => s.id === li.id)
      if (!si) return li
      return {
        ...li,
        status: si.status,
        qualities: si.qualities ?? li.qualities,
        error: si.error,
      }
    }),
  }
}

export default function Downloads() {
  const navigate = useNavigate()
  const { setLocalVideoFile } = useApp()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [jobs, setJobs] = useState<LocalDownloadJob[]>(getLocalJobs)

  const syncJobs = useCallback(async () => {
    const local = getLocalJobs()
    const pending = local.filter((j) => j.status === 'processing')
    if (pending.length === 0) return

    const settled = await Promise.allSettled(
      pending.map(async (job) => {
        const res = await fetch(`${BACKEND_URL}/api/downloads/jobs/${job.id}`)
        if (!res.ok) return null
        const data = await res.json()
        return { local: job, server: data.job }
      })
    )

    let changed = false
    const nextJobs = [...local]
    for (const r of settled) {
      if (r.status !== 'fulfilled' || !r.value) continue
      const merged = mergeServerJob(r.value.local, r.value.server)
      const idx = nextJobs.findIndex((j) => j.id === merged.id)
      if (idx >= 0) {
        nextJobs[idx] = merged
        updateLocalJob(merged)
        changed = true
      }
    }
    if (changed) {
      nextJobs.sort((a, b) => b.createdAt - a.createdAt)
      setJobs(nextJobs)
    }
  }, [])

  useEffect(() => {
    syncJobs()
    const interval = setInterval(syncJobs, 3000)
    return () => clearInterval(interval)
  }, [syncJobs])

  const handleRefresh = async () => {
    await syncJobs()
    setJobs(getLocalJobs())
  }

  const handleRemoveJob = (jobId: string) => {
    removeLocalJob(jobId)
    fetch(`${BACKEND_URL}/api/downloads/jobs/${jobId}`, { method: 'DELETE' }).catch(() => {})
    setJobs(getLocalJobs())
    toast.success('Removed.')
  }

  const handlePlayOfflineClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setLocalVideoFile(file)
      navigate('/watch/local/file')
    }
  }

  return (
    <div className="px-4 md:px-10 pt-24 max-w-4xl mx-auto pb-16">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="glass rounded-full p-2 hover:bg-white/15 transition-colors"
            aria-label="Back"
          >
            <IconBack width={16} height={16} />
          </button>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Downloads</h1>
        </div>
        <button
          onClick={handleRefresh}
          className="glass px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 hover:bg-white/15"
        >
          <IconRefresh width={14} height={14} /> Refresh
        </button>
      </div>

      {/* Play Offline Video File Card */}
      <div className="mt-8 glass rounded-2xl p-5 border border-line/60 bg-gradient-to-br from-surface/80 to-surface/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Play from device
          </h3>
          <p className="text-xs text-muted leading-relaxed max-w-xl">
            Got a video saved on this phone or computer? Open it here and it plays in the theater, no internet needed.
          </p>
        </div>
        <button
          onClick={handlePlayOfflineClick}
          className="btn-shimmer flex items-center justify-center gap-2 bg-gradient-to-r from-brand2 to-brand px-5 py-3 rounded-xl text-xs font-bold text-white shadow-md cursor-pointer shrink-0"
        >
          Play Local File
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="video/*"
          className="hidden"
        />
      </div>

      {jobs.length === 0 ? (
        <div className="mt-6 text-center py-16 glass rounded-2xl border border-line/40 space-y-3">
          <IconDownload width={40} height={40} className="mx-auto text-muted/50" />
          <h3 className="text-base font-bold">Nothing here yet</h3>
          <p className="text-xs text-muted max-w-md mx-auto">
            Hit Download on any movie or episode and it'll show up here.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {jobs.map((job) => (
            <div key={job.id} className="glass rounded-2xl p-5 border border-line/60 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-base font-bold truncate">{job.title}</h3>
                  <p className="text-xs text-muted mt-0.5">
                    {new Date(job.createdAt).toLocaleTimeString()} · {job.items.length}{' '}
                    {job.items.length === 1 ? 'item' : 'items'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      job.status === 'completed'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-brand/10 text-brand border border-brand/30 animate-pulse'
                    }`}
                  >
                    {job.status === 'completed' ? 'Ready' : `${job.progress}%`}
                  </span>
                  <button
                    onClick={() => handleRemoveJob(job.id)}
                    className="text-muted hover:text-rose-400 transition-colors p-1.5 rounded-lg hover:bg-rose-500/10"
                    aria-label="Remove"
                  >
                    <IconTrash width={15} height={15} />
                  </button>
                </div>
              </div>

              {job.status === 'processing' && (
                <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-brand2 to-brand h-full transition-all duration-300"
                    style={{ width: `${job.progress}%` }}
                  />
                </div>
              )}

              <div className="space-y-2 pt-2 border-t border-line/30">
                {job.items.map((item) => {
                  const best = bestQuality(item)
                  const chosen = item.quality && item.qualities?.[item.quality] ? item.quality : best
                  const alts = item.qualities
                    ? Object.keys(item.qualities)
                        .filter((q) => q !== chosen)
                        .sort((a, b) => qualityRank(b) - qualityRank(a))
                    : []
                  const sizeMB = chosen && item.qualities?.[chosen]?.sizeMB
                  return (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-surface2/60 border border-line/40 text-xs"
                    >
                      <span className="font-semibold text-white/90 truncate max-w-[16rem]">{item.title}</span>
                      {item.status === 'failed' ? (
                        <span className="text-rose-400 flex items-center gap-1.5">
                          <IconDownload width={12} height={12} /> {item.error || 'Unavailable'}
                        </span>
                      ) : item.status === 'resolving' || item.status === 'pending' ? (
                        <span className="text-muted flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand animate-ping" /> Finding sources…
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5 shrink-0">
                          {alts.map((q) => (
                            <a
                              key={q}
                              href={fileUrl(item, q)}
                              download
                              onClick={() => toast.success(`Downloading ${q}p…`)}
                              className="glass px-2.5 py-1.5 rounded-lg font-bold hover:bg-white/15 text-muted hover:text-white transition-colors"
                            >
                              {q}p · {item.qualities?.[q]?.sizeMB ?? '?'} MB
                            </a>
                          ))}
                          {chosen && (
                            <a
                              href={fileUrl(item, chosen)}
                              download
                              onClick={() => toast.success(`Downloading ${chosen}p…`)}
                              className="btn-shimmer flex items-center gap-1.5 bg-gradient-to-r from-brand2 to-brand px-3 py-1.5 rounded-lg font-bold text-white shadow-md"
                            >
                              <IconDownload width={13} height={13} /> Save {chosen}p
                              {sizeMB ? ` · ${sizeMB >= 1000 ? `${(sizeMB / 1000).toFixed(1)} GB` : `${sizeMB} MB`}` : ''}
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
