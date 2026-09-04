import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconBack, IconDownload, IconRefresh } from '../components/common/Icons'
import toast from 'react-hot-toast'
import { useApp } from '../context/AppContext'

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
  const { setLocalVideoFile } = useApp()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [jobs, setJobs] = useState<BatchJob[]>([])
  const [loading, setLoading] = useState(true)

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

        {/* Play Offline Video File Card */}
        <div className="glass rounded-2xl p-5 border border-line/60 bg-gradient-to-br from-surface/80 to-surface/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Offline Theater Playback
            </h3>
            <p className="text-xs text-muted leading-relaxed max-w-xl">
              Play any movie or episode video file directly from your local phone, tablet, or PC storage. Everything is rendered beautifully inside Vesper's immersive HTML5 custom cinema theater.
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

        {/* Step-by-Step Native Saving Help Guide */}
        <div className="glass rounded-2xl p-6 border border-line/40 space-y-4">
          <h3 className="text-sm font-bold text-white/90">How do I save downloads to my local storage?</h3>
          <div className="grid md:grid-cols-3 gap-4 text-xs text-muted/90">
            <div className="space-y-1.5 p-3.5 rounded-xl bg-surface/50 border border-line/30">
              <span className="font-mono font-bold text-brand block mb-1">STEP 1</span>
              <p className="font-semibold text-white/95">Click "Save File"</p>
              <p className="leading-relaxed">Clicking the button opens the resolved direct stream URL in a new browser tab.</p>
            </div>
            <div className="space-y-1.5 p-3.5 rounded-xl bg-surface/50 border border-line/30">
              <span className="font-mono font-bold text-brand block mb-1">STEP 2</span>
              <p className="font-semibold text-white/95">Trigger Save Menu</p>
              <p className="leading-relaxed">On mobile/tablet, tap & hold the video, then press <b>"Save Video"</b>. On desktop, right-click and choose <b>"Save Video As..."</b> (or use <kbd className="px-1 bg-white/5 border border-white/10 rounded">Ctrl+S</kbd>).</p>
            </div>
            <div className="space-y-1.5 p-3.5 rounded-xl bg-surface/50 border border-line/30">
              <span className="font-mono font-bold text-brand block mb-1">STEP 3</span>
              <p className="font-semibold text-white/95">Play Offline in Vesper</p>
              <p className="leading-relaxed">Come back here anytime, tap <b>"Play Local File"</b>, and select your saved video to watch with full audio/subtitle tracking.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
