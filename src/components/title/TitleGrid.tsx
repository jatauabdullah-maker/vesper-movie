import type { TitleSummary } from '../../types'
import TitleCard from './TitleCard'

export default function TitleGrid({ items }: { items: TitleSummary[] }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4">
      {items.map((t) => (
        <TitleCard key={t.id} title={t} />
      ))}
    </div>
  )
}
