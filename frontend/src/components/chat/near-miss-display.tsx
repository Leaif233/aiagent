import { AlertTriangle } from 'lucide-react'
import { useI18n } from '../../lib/i18n'

interface NearMissResult {
  entity_type: string
  entity_id: string
  title: string
  confidence: number
  snippet: string
}

interface EntityRef {
  entity_type: string
  entity_id: string
  title: string
  confidence: number
}

interface Props {
  content: string
  nearMissResults: NearMissResult[]
  refinedQuery: string
  onViewDetail: (entityRefs: EntityRef[]) => void
}

export default function NearMissDisplay({
  content,
  nearMissResults,
  refinedQuery,
  onViewDetail,
}: Props) {
  const { t } = useI18n()

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] w-full">
        {/* Header bar */}
        <div className="bg-gradient-to-r from-slate-50 to-slate-100 border border-dashed border-slate-300 rounded-t-xl px-4 py-3 flex items-center gap-2">
          <AlertTriangle size={18} className="text-slate-500 shrink-0" />
          <span className="text-sm font-medium text-slate-600">
            {t('nearMiss.title')}
          </span>
        </div>

        {/* Body */}
        <div className="bg-white border-x border-b border-dashed border-slate-300 rounded-b-xl px-4 py-4 space-y-3">
          {/* AI message */}
          <p className="text-sm text-[var(--slate-600)]">{content}</p>

          {/* Refined query display */}
          {refinedQuery && (
            <div className="bg-slate-50 border-l-2 border-slate-300 px-3 py-2 rounded-r">
              <p className="text-xs text-[var(--slate-400)] mb-0.5">
                {t('nearMiss.refinedQuery')}
              </p>
              <p className="text-sm text-[var(--slate-700)]">{refinedQuery}</p>
            </div>
          )}

          {/* Near miss result cards */}
          <div className="space-y-2">
            {nearMissResults.map((item) => (
              <button
                key={`${item.entity_type}-${item.entity_id}`}
                onClick={() => onViewDetail([{
                  entity_type: item.entity_type,
                  entity_id: item.entity_id,
                  title: item.title,
                  confidence: item.confidence,
                }])}
                className="w-full text-left border border-dashed border-slate-200 rounded-lg px-3 py-2.5 hover:bg-slate-50 transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-[var(--slate-700)] flex-1">
                    {item.title}
                  </p>
                  <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full shrink-0">
                    {t('nearMiss.confidence')} {Math.round(item.confidence * 100)}%
                  </span>
                </div>
                {item.snippet && (
                  <p className="text-xs text-[var(--slate-400)] mt-1 line-clamp-2">
                    {item.snippet}
                  </p>
                )}
              </button>
            ))}
          </div>

          {/* Disclaimer */}
          <p className="text-xs text-[var(--slate-400)] italic pt-1">
            {t('nearMiss.disclaimer')}
          </p>
        </div>
      </div>
    </div>
  )
}
