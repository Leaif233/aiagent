import { Globe } from 'lucide-react'
import { useI18n } from '../../lib/i18n'

export default function LangToggle() {
  const { toggleLang, t } = useI18n()

  return (
    <button
      onClick={toggleLang}
      title={t('lang.tooltip')}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--slate-200)] text-[var(--slate-600)] text-xs font-medium hover:bg-[var(--slate-100)] transition-colors"
    >
      <Globe size={14} />
      {t('lang.toggle')}
    </button>
  )
}
