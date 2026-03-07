import { useI18n } from '../../lib/i18n'

interface Props {
  title?: string
  message: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({ title, message, onConfirm, onCancel }: Props) {
  const { t } = useI18n()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-[400px] max-w-[90vw]">
        <div className="px-6 pt-5 pb-2">
          <h3 className="text-base font-semibold text-[var(--slate-800)]">
            {title || t('confirm.title')}
          </h3>
          <p className="text-sm text-[var(--slate-600)] mt-2">{message}</p>
        </div>
        <div className="flex justify-end gap-2 px-6 pb-5 pt-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm border border-[var(--slate-300)] rounded-lg hover:bg-[var(--slate-100)] text-[var(--slate-700)]"
          >
            {t('confirm.cancel')}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm bg-[var(--rejected-red)] text-white rounded-lg hover:opacity-90"
          >
            {t('confirm.ok')}
          </button>
        </div>
      </div>
    </div>
  )
}
