import { useState } from 'react'
import { ChevronDown, ChevronRight, FileText, Ticket } from 'lucide-react'
import { useI18n } from '../../lib/i18n'
import type { SourceRef } from '../../pages/ChatPage'

interface Props {
  sources: SourceRef[]
}

export default function SourceTrace({ sources }: Props) {
  const [open, setOpen] = useState(false)
  const { t } = useI18n()

  if (!sources?.length) return null

  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs text-[var(--slate-400)] hover:text-[var(--slate-600)] transition-colors"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {t('feedback.sources')} ({sources.length})
      </button>
      {open && (
        <div className="mt-1 space-y-1 pl-3">
          {sources.map((s, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-xs text-[var(--slate-500)]"
            >
              {s.type === 'document' ? (
                <FileText size={12} className="shrink-0" />
              ) : (
                <Ticket size={12} className="shrink-0" />
              )}
              <span className="truncate">{s.title}</span>
              <span className="text-[var(--slate-300)] shrink-0">
                {Math.round(s.relevance_score * 100)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
