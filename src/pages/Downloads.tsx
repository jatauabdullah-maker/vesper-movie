import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconBack, IconDownload, IconRefresh } from '../components/common/Icons'
import toast from 'react-hot-toast'

interface BatchJob {
  id: string
  title: string
  createdAt: number
  status: 'queued' | 'processing' | 'completed' | 'failed'
  progress: number
  items: {
    id: string
    title: string
    status: 'pending' | 'resolving' | 'completed' | 'failed'
    downloadUrl?: string
    error?: string
  }[]
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://vesper-api-za8p.onrender.com'

export default function Downloads() {
  const navigate = useNavigate()
  const [jobs, setJobs] = useState<BatchJob[]>([])
  const [loading, setLoading] = useState(true)

  const fetchJobs = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/downloads/jobs`)
      if (res.ok) {
        const data = await res.json()
        setJobs(data.jobs || [])
      }
    } catch {
      // Backend offline or spinning up
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchJobs()
    const interval = setInterval(fetchJobs, 3000)
    return () => clearInterval(interval)
  }, [])

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
          onClick={fetchJobs}
          className="glass px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 hover:bg-white/15"
        >
          <IconRefresh width={14} height={14} /> Refresh
        </button>
      </div>

      <div className="mt-8 space-y-6">
        <div className="glass rounded-2xl p-5 border border-line/60">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold flex items-center gap-2">
                <IconDownload width={16} height={16} className="text-brand" />
                Vesper Backend Cloud Downloader
              </p>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                High-speed batch downloads process season bundles and movies on the server. Click any completed item below to save or stream offline.
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-16 glass rounded-2xl border border-line/40 space-y-3">
            <IconDownload width={40} height={40} className="mx-auto text-muted/50" />
            <h3 className="text-base font-bold">No Batch Downloads Active</h3>
            <p className="text-xs text-muted max-w-md mx-auto">
              Go to any movie or TV series page and click <b>Batch Download</b> to enqueue episodes for high-speed offline download.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <div key={job.id} className="glass rounded-2xl p-5 border border-line/60 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold">{job.title}</h3>
                    <p className="text-xs text-muted mt-0.5">
                      Enqueued {new Date(job.createdAt).toLocaleTimeString()} · {job.items.length} items
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      job.status === 'completed'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-brand/10 text-brand border border-brand/30 animate-pulse'
                    }`}
                  >
                    {job.status === 'completed' ? 'Completed' : `${job.progress}% Processed`}
                  </span>
                </div>

                <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-brand2 to-brand h-full transition-all duration-300"
                    style={{ width: `${job.progress}%` }}
                  />
                </div>

                <div className="space-y-2 pt-2 border-t border-line/30">
                  {job.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-surface2/60 border border-line/40 text-xs"
                    >
                      <span className="font-semibold text-white/90 truncate max-w-xs">{item.title}</span>
                      {item.downloadUrl ? (
                        <a
                          href={item.downloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => toast.success(`Starting download for ${item.title}`)}
                          className="btn-shimmer flex items-center gap-1.5 bg-gradient-to-r from-brand2 to-brand px-3 py-1.5 rounded-lg font-bold text-white shadow-md shrink-0"
                        >
                          <IconDownload width={13} height={13} /> Save File
                        </a>
                      ) : (
                        <span className="text-muted flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand animate-ping" /> Resolving…
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
