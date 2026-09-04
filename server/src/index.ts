import express from 'express'
import cors from 'cors'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

interface DownloadItem {
  id: string
  episodeId: string
  title: string
  season?: number
  episode?: number
  type: 'movie' | 'tv'
  status: 'pending' | 'resolving' | 'completed' | 'failed'
  downloadUrl?: string
  error?: string
}

interface BatchJob {
  id: string
  title: string
  createdAt: number
  status: 'queued' | 'processing' | 'completed' | 'failed'
  items: DownloadItem[]
  progress: number
}

const jobs = new Map<string, BatchJob>()

// Embed providers reference for extraction / download URL generation
const PROVIDERS = [
  {
    id: 'vidlink',
    name: 'VidLink',
    movieUrl: (id: string) => `https://vidlink.pro/movie/${id}`,
    tvUrl: (id: string, s: number, e: number) => `https://vidlink.pro/tv/${id}/${s}/${e}`,
  },
  {
    id: 'vidzee',
    name: 'VidZee',
    movieUrl: (id: string) => `https://player.vidzee.wtf/embed/movie/${id}`,
    tvUrl: (id: string, s: number, e: number) => `https://player.vidzee.wtf/embed/tv/${id}/${s}/${e}`,
  },
  {
    id: 'superembed',
    name: 'SuperEmbed',
    movieUrl: (id: string) => `https://multiembed.mov/?video_id=${id}&tmdb=1`,
    tvUrl: (id: string, s: number, e: number) => `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${s}&e=${e}`,
  },
  {
    id: 'vidsrc',
    name: 'VidSrc',
    movieUrl: (id: string) => `https://vidsrc.xyz/embed/movie?tmdb=${id}`,
    tvUrl: (id: string, s: number, e: number) => `https://vidsrc.xyz/embed/tv?tmdb=${id}&season=${s}&episode=${e}`,
  },
]

// ── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'vesper-backend',
    version: '1.0.0',
    time: new Date().toISOString(),
  })
})

// ── BATCH DOWNLOAD ENDPOINTS ───────────────────────────────────────────────

/**
 * Enqueue a batch download job
 */
app.post('/api/downloads/batch', (req, res) => {
  const { title, items } = req.body as {
    title: string
    items: { episodeId: string; title: string; season?: number; episode?: number; type: 'movie' | 'tv' }[]
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'INVALID_REQUEST', message: 'No items provided for batch download.' })
    return
  }

  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`

  const jobItems: DownloadItem[] = items.map((it, idx) => ({
    id: `${jobId}_${idx}`,
    episodeId: it.episodeId,
    title: it.title || `Item ${idx + 1}`,
    season: it.season,
    episode: it.episode,
    type: it.type || 'movie',
    status: 'pending',
  }))

  const job: BatchJob = {
    id: jobId,
    title: title || 'Batch Download',
    createdAt: Date.now(),
    status: 'queued',
    items: jobItems,
    progress: 0,
  }

  jobs.set(jobId, job)

  // Start processing in background with controlled concurrency to handle server load well
  processBatchJob(jobId)

  res.status(201).json({
    message: 'Batch download job created successfully.',
    jobId,
    itemCount: jobItems.length,
  })
})

/**
 * Get status of all batch jobs
 */
app.get('/api/downloads/jobs', (_req, res) => {
  const jobList = Array.from(jobs.values()).sort((a, b) => b.createdAt - a.createdAt)
  res.json({ jobs: jobList })
})

/**
 * Get status of a specific batch job
 */
app.get('/api/downloads/jobs/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId)
  if (!job) {
    res.status(404).json({ error: 'JOB_NOT_FOUND', message: 'Download job not found.' })
    return
  }
  res.json({ job })
})

/**
 * Helper function to process a batch download job with pacing to handle load
 */
async function processBatchJob(jobId: string) {
  const job = jobs.get(jobId)
  if (!job) return

  job.status = 'processing'

  let completedCount = 0

  for (const item of job.items) {
    item.status = 'resolving'

    try {
      // Parse episodeId to extract tmdbId
      const parsed = parseEpisodeId(item.episodeId)
      if (parsed) {
        // Build download URLs across available providers
        const primaryProvider = PROVIDERS[0]
        const downloadUrl =
          parsed.kind === 'movie'
            ? primaryProvider.movieUrl(parsed.tmdbId)
            : primaryProvider.tvUrl(parsed.tmdbId, parsed.season, parsed.episode)

        item.downloadUrl = downloadUrl
        item.status = 'completed'
      } else {
        item.status = 'failed'
        item.error = 'Invalid episode ID format.'
      }
    } catch (err: unknown) {
      item.status = 'failed'
      item.error = err instanceof Error ? err.message : 'Failed to resolve download stream.'
    }

    completedCount++
    job.progress = Math.round((completedCount / job.items.length) * 100)

    // Pacing delay between items to keep server load low
    await new Promise((resolve) => setTimeout(resolve, 300))
  }

  job.status = 'completed'
}

function parseEpisodeId(episodeId: string):
  | { tmdbId: string; kind: 'movie' | 'tv'; season: number; episode: number }
  | null {
  let m = episodeId.match(/^tmdb-(\d+)-m$/)
  if (m) return { tmdbId: m[1], kind: 'movie', season: 0, episode: 0 }
  m = episodeId.match(/^tmdb-(\d+)-s(\d+)e(\d+)$/)
  if (m) return { tmdbId: m[1], kind: 'tv', season: Number(m[2]), episode: Number(m[3]) }
  return null
}

app.listen(PORT, () => {
  console.log(`[vesper-backend] High-speed download server running on port ${PORT}`)
})
