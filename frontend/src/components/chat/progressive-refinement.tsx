import { useState } from 'react'
import { Tags, Send } from 'lucide-react'
import { useI18n } from '../../lib/i18n'

interface RefinementOption {
  id: string
  label: string
  description: string
  keywords: string[]
  refined_query?: string
}

interface RefinementContext {
  original_query: string
  current_query: string
  refinement_round: number
  max_rounds: number
}

interface Props {
  content: string
  options: RefinementOption[]
  context: RefinementContext
  onSelectOption: (optionLabel: string, keywords: string[], refinedQuery: string) => void
  onCustomInput: (text: string) => void
}

export default function ProgressiveRefinement({
  content,
  options,
  context,
  onSelectOption,
  onCustomInput,
}: Props) {
  const [customText, setCustomText] = useState('')
  const { t } = useI18n()

  const handleCustomSubmit = () => {
    const text = customText.trim()
    if (!text) return
    setCustomText('')
    onCustomInput(text)
  }

  const roundLabel = t('refinement.round')
    .replace('{current}', String(context.refinement_round))
    .replace('{max}', String(context.max_rounds))

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] w-full">
        {/* Header bar */}
        <div className="bg-gradient-to-r from-amber-50 to-amber-100 border border-amber-200 rounded-t-xl px-4 py-3 flex items-center gap-2">
          <Tags size={18} className="text-amber-600 shrink-0" />
          <span className="text-sm font-medium text-amber-800">
            {t('refinement.title')}
          </span>
          <span className="ml-auto text-xs bg-amber-200 text-amber-700 px-2 py-0.5 rounded-full">
            {roundLabel}
          </span>
        </div>

        {/* Body */}
        <div className="bg-white border-x border-b border-amber-200 rounded-b-xl px-4 py-4 space-y-3">
          {/* AI message */}
          <p className="text-sm text-[var(--slate-600)]">{content}</p>

          {/* Option cards - attribute tag style */}
          <div className="flex flex-wrap gap-2">
            {options.map((opt) => (
              <button
                key={opt.id}
                onClick={() => onSelectOption(opt.label, opt.keywords, opt.refined_query || '')}
                className="inline-flex flex-col items-start border border-amber-300 bg-amber-50 rounded-lg px-3 py-2 hover:bg-amber-100 hover:border-amber-400 hover:shadow-sm transition-all group max-w-[48%]"
              >
                <span className="text-sm font-medium text-amber-900 group-hover:text-amber-950 leading-tight">
                  {opt.label}
                </span>
                {opt.keywords.length > 0 && (
                  <span className="flex flex-wrap gap-1 mt-1.5">
                    {opt.keywords.map((kw, ki) => (
                      <span
                        key={ki}
                        className="text-[11px] bg-amber-200/60 text-amber-700 px-1.5 py-0.5 rounded"
                      >
                        {kw}
                      </span>
                    ))}
                  </span>
                )}
                {opt.description && (
                  <span className="text-[11px] text-amber-600/70 mt-1 leading-tight">
                    {opt.description}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Custom input */}
          <div className="flex gap-2 items-end pt-1">
            <input
              type="text"
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleCustomSubmit()
                }
              }}
              placeholder={t('refinement.customPlaceholder')}
              className="flex-1 text-sm border border-[var(--slate-200)] rounded-lg px-3 py-2 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
            />
            <button
              onClick={handleCustomSubmit}
              disabled={!customText.trim()}
              className="h-9 w-9 rounded-lg bg-amber-500 text-white flex items-center justify-center hover:bg-amber-600 disabled:opacity-40 transition-colors shrink-0"
            >
              <Send size={14} />
            </button>
          </div>

          {/* Current query display */}
          {context.current_query !== context.original_query && (
            <p className="text-xs text-[var(--slate-400)] pt-1">
              {t('refinement.currentQuery')}：{context.current_query}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
