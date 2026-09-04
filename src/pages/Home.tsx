import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import HeroCarousel from '../components/home/HeroCarousel'
import TitleRow from '../components/title/TitleRow'
import ContinueWatchingRow from '../components/home/ContinueWatchingRow'
import { HeroSkeleton, RowSkeleton } from '../components/common/Skeletons'
import {
  getTrending, getPopularMovies, getPopularTv, getTopRated, getNowPlaying, getAiringToday,
} from '../services/api'
import { useApp } from '../context/AppContext'
import { uniqBy } from '../utils/helpers'
import type { TitleSummary } from '../types'

export default function Home() {
  const [trending, setTrending] = useState<TitleSummary[]>([])
  const [theaters, setTheaters] = useState<TitleSummary[]>([])
  const [popMovies, setPopMovies] = useState<TitleSummary[]>([])
  const [popTv, setPopTv] = useState<TitleSummary[]>([])
  const [top, setTop] = useState<TitleSummary[]>([])
  const [airing, setAiring] = useState<TitleSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [noKey, setNoKey] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { continueWatching, refreshProgress } = useApp()

  useEffect(() => {
    refreshProgress()
    let live = true
    ;(async () => {
      try {
        const results = await Promise.allSettled([
          getTrending(),
          getNowPlaying(),
          getPopularMovies(),
          getPopularTv(),
          getTopRated(),
          getAiringToday(),
        ])
        if (!live) return
        const [t, np, pm, pt, tr, at] = results
        if (t.status === 'fulfilled') setTrending(t.value)
        if (np.status === 'fulfilled') setTheaters(np.value)
        if (pm.status === 'fulfilled') setPopMovies(pm.value)
        if (pt.status === 'fulfilled') setPopTv(pt.value)
        if (tr.status === 'fulfilled') setTop(tr.value)
        if (at.status === 'fulfilled') setAiring(at.value)

        const first = results[0]
        if (first.status === 'rejected') {
          const msg = first.reason instanceof Error ? first.reason.message : ''
          if (msg === 'NO_TMDB_KEY') setNoKey(true)
          else setError('Could not load the catalog. Check your internet connection — TMDB should be reachable.')
        }
      } finally {
        if (live) setLoading(false)
      }
    })()
    return () => {
      live = false
    }
  }, [refreshProgress])

  const heroItems = uniqBy(trending, (a) => a.id).filter((a) => a.banner || a.poster).slice(0, 6)

  if (loading) {
    return (
      <div className="-mt-16">
        <HeroSkeleton />
        <RowSkeleton />
        <RowSkeleton />
      </div>
    )
  }

  if (noKey) {
    return (
      <div className="pt-32 px-4 md:px-10 max-w-2xl mx-auto text-center">
        <div className="glass rounded-2xl p-10">
          <h2 className="text-2xl font-bold mb-3">One quick setup step</h2>
          <p className="text-muted text-sm leading-relaxed">
            Vesper pulls its catalog from TMDB, which needs a free API key. Grab one at
            {' '}
            <a
              href="https://www.themoviedb.org/settings/api"
              target="_blank"
              rel="noreferrer"
              className="text-brand hover:underline"
            >
              themoviedb.org/settings/api
            </a>
            {' '}and either add it to <code className="text-brand">.env</code> as{' '}
            <code className="text-brand">VITE_TMDB_API_KEY</code>, or paste it straight into Settings — no rebuild needed.
          </p>
          <Link to="/settings" className="inline-block mt-6 bg-gradient-to-r from-brand2 to-brand px-6 py-3 rounded-xl font-semibold">
            Open Settings
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="-mt-16">
      {error ? (
        <div className="pt-32 px-4 md:px-10 max-w-2xl mx-auto text-center">
          <div className="glass rounded-2xl p-10">
            <h2 className="text-2xl font-bold mb-3">No source connected</h2>
            <p className="text-muted text-sm leading-relaxed">{error}</p>
            <Link to="/settings" className="inline-block mt-6 bg-gradient-to-r from-brand2 to-brand px-6 py-3 rounded-xl font-semibold">
              Open Settings
            </Link>
          </div>
        </div>
      ) : (
        <>
          {heroItems.length > 0 && <HeroCarousel items={heroItems} />}
          <div className="relative z-10 -mt-2">
            {continueWatching.length > 0 && <ContinueWatchingRow items={continueWatching} />}
            <TitleRow title="Trending This Week" items={trending} />
            {theaters.length > 0 && <TitleRow title="In Theaters" items={theaters} />}
            <TitleRow title="Popular Movies" items={popMovies} />
            <TitleRow title="Popular TV" items={popTv} />
            <TitleRow title="Top Rated" items={top} />
            <TitleRow title="Airing Today" items={airing} />
          </div>
        </>
      )}
    </div>
  )
}
