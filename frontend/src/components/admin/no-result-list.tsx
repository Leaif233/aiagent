import { SearchX } from 'lucide-react'

interface NoResultItem {
  query: string
  count: number
  last_asked: string
}

interface Props {
  items: NoResultItem[]
  loading?: boolean
}

export default function NoResultList({ items, loading }: Props) {
  if (loading) {
    return (
      <div className="text-sm text-[var(--slate-400)] py-4 text-center">
        加载中...
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="text-sm text-[var(--slate-400)] py-4 text-center">
        暂无数据
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--slate-50)]"
        >
          <SearchX size={14} className="text-red-400 shrink-0" />
          <span className="text-xs text-[var(--slate-400)] w-5 shrink-0">
            {i + 1}
          </span>
          <span className="text-sm text-[var(--slate-700)] truncate flex-1">
            {item.query}
          </span>
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-medium shrink-0">
            {item.count}
          </span>
        </div>
      ))}
    </div>
  )
}
