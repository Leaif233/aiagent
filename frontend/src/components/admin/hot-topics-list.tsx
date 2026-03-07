import { useI18n } from '../../lib/i18n'

interface TopicItem {
  topic: string
  count: number
  last_asked: string
}

interface Props {
  items: TopicItem[]
}

export default function HotTopicsList({ items }: Props) {
  const { t } = useI18n()

  return (
    <div className="rounded-xl border border-[var(--slate-200)] bg-white p-5">
      <h3 className="text-sm font-semibold text-[var(--slate-800)] mb-4">
        {t('dashboard.hotTopics')}
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-[var(--slate-400)]">{t('admin.noPending')}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--slate-50)]"
            >
              <span className="w-6 h-6 rounded-full bg-[var(--safety-blue)] text-white text-xs flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <span className="text-sm text-[var(--slate-700)] truncate flex-1">
                {item.topic}
              </span>
              <span className="text-xs text-[var(--slate-400)] shrink-0">
                {item.count}x
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
