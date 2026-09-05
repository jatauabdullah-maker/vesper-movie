import express from 'express'
import cors from 'cors'
import nacl from 'tweetnacl'
import { Readable } from 'node:stream'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

interface DownloadQuality {
  url: string
  sizeMB: number
}

interface DownloadItem {
  id: string
  episodeId: string
  title: string
  season?: number
  episode?: number
  type: 'movie' | 'tv'
  status: 'pending' | 'resolving' | 'completed' | 'failed'
  qualities?: Record<string, DownloadQuality>
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

// ── VIDLINK STREAM EXTRACTION ───────────────────────────────────────────────
// Vidlink encrypts the tmdb id with a NaCl SecretBox (XSalsa20-Poly1305)
// using a fixed key + zero nonce, appending a future unix timestamp. The
// encrypted token is what their /api/b endpoint expects.

const VIDLINK_KEY = Buffer.from(
  'c75136c5668bbfe65a7ecad431a745db68b5f381555b38d8f6c699449cf11fcd',
  'hex'
)
const VIDLINK_NONCE = Buffer.alloc(24)

const VIDLINK_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  Origin: 'https://vidlink.pro',
  Referer: 'https://vidlink.pro/',
}

function encryptVidlinkToken(mediaId: string): string {
  const timestamp = Math.floor(Date.now() / 1000) + 480
  const tsBuf = Buffer.alloc(8)
  tsBuf.writeBigUInt64BE(BigInt(timestamp))
  const message = Buffer.concat([Buffer.from(mediaId, 'utf8'), tsBuf])
  const box = nacl.secretbox(new Uint8Array(message), VIDLINK_NONCE, VIDLINK_KEY)
  return Buffer.concat([VIDLINK_NONCE, Buffer.from(box)]).toString('base64url')
}

function parseEpisodeId(
  episodeId: string
): { tmdbId: string; kind: 'movie' | 'tv'; season: number; episode: number } | null {
  let m = episodeId.match(/^tmdb-(\d+)-m$/)
  if (m) return { tmdbId: m[1], kind: 'movie', season: 0, episode: 0 }
  m = episodeId.match(/^tmdb-(\d+)-s(\d+)e(\d+)$/)
  if (m) return { tmdbId: m[1], kind: 'tv', season: Number(m[2]), episode: Number(m[3]) }
  return null
}

/**
 * Resolve the real MP4 file URLs for a title from vidlink.
 * Returns a map of quality → { url, sizeMB }. Signed URLs last ~1h.
 */
async function resolveVidlinkQualities(episodeId: string): Promise<Record<string, DownloadQuality>> {
  const parsed = parseEpisodeId(episodeId)
  if (!parsed) throw new Error('Invalid title reference.')

  const token = encryptVidlinkToken(parsed.tmdbId)
  const apiUrl =
    parsed.kind === 'movie'
      ? `https://vidlink.pro/api/b/movie/${token}?multiLang=0`
      : `https://vidlink.pro/api/b/tv/${token}/${parsed.season}/${parsed.episode}?multiLang=0`

  let data: any = null
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(apiUrl, { headers: VIDLINK_HEADERS, signal: AbortSignal.timeout(10000) })
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 1500))
      continue
    }
    if (!res.ok) throw new Error(`Stream provider returned ${res.status}.`)
    data = await res.json()
    break
  }

  const qualities = data?.stream?.qualities
  if (!qualities || typeof qualities !== 'object') {
    throw new Error('No downloadable file was returned for this title.')
  }

  const out: Record<string, DownloadQuality> = {}
  for (const [q, info] of Object.entries<any>(qualities)) {
    if (!info?.url || info.type !== 'mp4') continue
    out[q] = { url: info.url, sizeMB: Math.round((Number(info.size) || 0) / 1_000_000) }
  }
  if (Object.keys(out).length === 0) throw new Error('No MP4 renditions available.')
  return out
}

/**
 * Pick the closest available quality to the requested one.
 * Exact match wins; otherwise the highest option at or below the request;
 * otherwise the lowest available.
 */
function pickQuality(qualities: Record<string, DownloadQuality>, requested: string): string {
  if (qualities[requested]) return requested
  const nums = Object.keys(qualities)
    .map(Number)
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b)
  if (nums.length === 0) return Object.keys(qualities)[0]
  const want = Number(requested) || nums[nums.length - 1]
  const atOrBelow = nums.filter((n) => n <= want)
  return String(atOrBelow.length > 0 ? atOrBelow[atOrBelow.length - 1] : nums[0])
}

function sanitizeFilename(name: string): string {
  const clean = name.replace(/[^\w\s.-]+/g, '').replace(/\s+/g, ' ').trim() || 'video'
  return `${clean.slice(0, 120)}.mp4`
}

// ── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'vesper-backend',
    version: '2.0.0',
    time: new Date().toISOString(),
  })
})

// ── BATCH DOWNLOAD ENDPOINTS ───────────────────────────────────────────────

/**
 * Enqueue a batch download job. Jobs are displayed per-user from localStorage
 * on the client — the server copy only tracks resolution state/sizes.
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
  processBatchJob(jobId)

  res.status(201).json({
    message: 'Batch download job created successfully.',
    jobId,
    itemCount: jobItems.length,
  })
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
 * Remove a batch job from the server (user cleared it from their device)
 */
app.delete('/api/downloads/jobs/:jobId', (req, res) => {
  const deleted = jobs.delete(req.params.jobId)
  res.json({ ok: true, deleted })
})

/**
 * Resolve real MP4 qualities for each item, paced to keep load low.
 */
async function processBatchJob(jobId: string) {
  const job = jobs.get(jobId)
  if (!job) return

  job.status = 'processing'
  let completedCount = 0

  for (const item of job.items) {
    item.status = 'resolving'
    try {
      item.qualities = await resolveVidlinkQualities(item.episodeId)
      item.status = 'completed'
    } catch (err: unknown) {
      item.status = 'failed'
      item.error = err instanceof Error ? err.message : 'Failed to resolve download stream.'
    }

    completedCount++
    job.progress = Math.round((completedCount / job.items.length) * 100)
    await new Promise((resolve) => setTimeout(resolve, 300))
  }

  job.status = 'completed'
}

// ── DIRECT FILE DOWNLOAD (streams the real MP4 to the user's device) ────────

/**
 * GET /api/downloads/resolve?episodeId=tmdb-123-m
 * Quick quality lookup for the download popup — returns available MP4
 * renditions with sizes so the user can pick before anything starts.
 */
app.get('/api/downloads/resolve', async (req, res) => {
  const { episodeId } = req.query as { episodeId?: string }
  if (!episodeId) {
    res.status(400).json({ error: 'INVALID_REQUEST', message: 'episodeId is required.' })
    return
  }
  try {
    const qualities = await resolveVidlinkQualities(String(episodeId))
    res.json({ qualities })
  } catch (err: unknown) {
    res.status(502).json({
      error: 'RESOLVE_FAILED',
      message: err instanceof Error ? err.message : 'Could not reach the stream provider.',
    })
  }
})

/**
 * GET /api/downloads/file?episodeId=tmdb-123-m&title=Inception&quality=1080
 * Resolves a fresh signed MP4 URL and proxy-streams it as an attachment.
 * The CDN requires server-side fetching, and a fresh resolution beats
 * relying on 1h-old signed URLs stored at enqueue time.
 */
app.get('/api/downloads/file', async (req, res) => {
  const { episodeId, title, quality } = req.query as {
    episodeId?: string
    title?: string
    quality?: string
  }

  if (!episodeId) {
    res.status(400).json({ error: 'INVALID_REQUEST', message: 'episodeId is required.' })
    return
  }

  try {
    const qualities = await resolveVidlinkQualities(episodeId)
    const chosen = pickQuality(qualities, quality || '1080')
    const sourceUrl = qualities[chosen].url

    const upstream = await fetch(sourceUrl, {
      headers: req.headers.range ? { Range: req.headers.range } : {},
      signal: AbortSignal.timeout(30000),
    })

    if (!upstream.ok && upstream.status !== 206) {
      res.status(502).json({ error: 'UPSTREAM_ERROR', message: `CDN returned ${upstream.status}.` })
      return
    }

    const filename = sanitizeFilename(title || 'video')
    res.status(upstream.status)
    res.setHeader('Content-Type', 'video/mp4')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`)
    res.setHeader('Accept-Ranges', 'bytes')
    const contentRange = upstream.headers.get('content-range')
    if (contentRange) res.setHeader('Content-Range', contentRange)
    const contentLength = upstream.headers.get('content-length')
    if (contentLength) res.setHeader('Content-Length', contentLength)

    if (!upstream.body) {
      res.end()
      return
    }
    const stream = Readable.fromWeb(upstream.body as any)
    stream.pipe(res)
    stream.on('error', () => res.destroy())
    req.on('close', () => stream.destroy())
  } catch (err: unknown) {
    if (!res.headersSent) {
      res.status(502).json({
        error: 'RESOLVE_FAILED',
        message: err instanceof Error ? err.message : 'Could not resolve the video stream.',
      })
    }
  }
})

app.listen(PORT, () => {
  console.log(`[vesper-backend] High-speed download server v2 running on port ${PORT}`)
})
