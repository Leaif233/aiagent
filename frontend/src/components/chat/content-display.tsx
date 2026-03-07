import { FileText, ShieldCheck, ChevronRight, Ticket } from 'lucide-react'
import { useI18n } from '../../lib/i18n'
import type { ContentResult } from '../../pages/ChatPage'

interface Props {
  results: ContentResult[]
  onItemClick?: (item: ContentResult) => void
}

export default function ContentDisplay({ results, onItemClick }: Props) {
  const { t } = useI18n()

  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] space-y-2">
        <p className="text-sm text-[var(--slate-600)] mb-1">{t('content.foundResults')}</p>
        {results.map((item) => (
          <SummaryCard key={item.entity_id} item={item} t={t} onClick={onItemClick} />
        ))}
      </div>
    </div>
  )
}

function SummaryCard({ item, t, onClick }: { item: ContentResult; t: (k: any) => string; onClick?: (item: ContentResult) => void }) {
  const isDoc = item.entity_type === 'doc'

  return (
    <button
      className="w-full text-left rounded-xl border border-[var(--slate-200)] hover:border-[var(--safety-blue)] hover:shadow-md transition-all bg-white overflow-hidden group"
      onClick={() => onClick?.(item)}
    >
      <div className={`flex items-center gap-3 px-4 py-3 ${isDoc ? 'border-l-4 border-l-indigo-400' : 'border-l-4 border-l-emerald-400'}`}>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isDoc ? 'bg-indigo-50' : 'bg-emerald-50'}`}>
          {isDoc
            ? <FileText size={16} className="text-indigo-500" />
            : <Ticket size={16} className="text-emerald-500" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--slate-800)] truncate group-hover:text-[var(--safety-blue)]">
            {item.title || item.ticket_number || t('content.docTitle')}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${isDoc ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
              {isDoc ? t('content.docTitle') : t('content.ticketTitle')}
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--verified-green-light)] text-[var(--verified-green)] font-medium flex items-center gap-0.5">
              <ShieldCheck size={10} />
              {t('content.verifiedContent')}
            </span>
          </div>
        </div>
        <ChevronRight size={16} className="text-[var(--slate-400)] group-hover:text-[var(--safety-blue)] shrink-0" />
      </div>
    </button>
  )
}
