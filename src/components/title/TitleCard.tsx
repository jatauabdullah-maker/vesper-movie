import { Link } from 'react-router-dom'
import type { TitleSummary } from '../../types'
import { IconStar, IconPlay, IconPlus, IconCheck } from '../common/Icons'
import { useApp } from '../../context/AppContext'
import toast from 'react-hot-toast'

export default function TitleCard({ title }: { title: TitleSummary }) {
  const { isInWatchlist, toggleWatchlist } = useApp()
  const inList = isInWatchlist(title.id)

  return (
    <div className="group relative w-full">
      <Link to={`/title/${title.id}`} className="block">
        <div className="card-ring relative aspect-[2/3] rounded-xl overflow-hidden bg-surface2">
          <img
            src={title.poster}
            alt={title.title}
            loading="lazy"
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='300' fill='none'%3E%3Crect width='200' height='300' fill='%2317130d'/%3E%3Cpath d='M80 120v60l50-30z' fill='%23f2b13d' opacity='.5'/%3E%3C/svg%3E"
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent opacity-0 md:group-hover:opacity-100 transition-opacity" />
          <div className="absolute inset-0 flex items-center justify-center opacity-60 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            <span className="bg-brand/90 rounded-full p-3 shadow-lg shadow-brand/40">
              <IconPlay width={22} height={22} />
            </span>
          </div>
          {title.rating != null && (
            <div className="absolute top-2 left-2 glass rounded-md px-1.5 py-0.5 flex items-center gap-1 text-[11px] font-semibold">
              <IconStar width={11} height={11} className="text-yellow-400" />
              {title.rating.toFixed(1)}
            </div>
          )}
          {title.type && (
            <div className="absolute top-2 right-2 glass rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-brand">
              {title.type}
            </div>
          )}
          {title.justAiredEpisode != null && (
            <div className="absolute bottom-2 left-2 bg-emerald-500/90 rounded-md px-1.5 py-0.5 text-[10px] font-bold">
              EP {title.justAiredEpisode} aired
            </div>
          )}
        </div>
      </Link>
      <div className="flex items-start justify-between gap-1 mt-2">
        <div className="min-w-0">
          <Link to={`/title/${title.id}`} className="block text-sm font-medium truncate hover:text-brand transition-colors">
            {title.title}
          </Link>
          <p className="text-[11px] text-muted truncate">
            {[title.year, title.type].filter(Boolean).join(' · ')}
          </p>
        </div>
        <button
          onClick={() => {
            const added = toggleWatchlist({ id: title.id, title: title.title, poster: title.poster, addedAt: Date.now() })
            toast.success(added ? 'Added to My List' : 'Removed from My List')
          }}
          className="mt-0.5 shrink-0 text-muted hover:text-white transition-colors -m-2 p-2"
          aria-label={inList ? 'Remove from list' : 'Add to list'}
        >
          {inList ? <IconCheck width={16} height={16} className="text-brand" /> : <IconPlus width={16} height={16} />}
        </button>
      </div>
    </div>
  )
}
