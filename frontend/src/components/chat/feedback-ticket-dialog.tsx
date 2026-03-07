import { useState } from 'react'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'
import { createFeedbackTicket } from '../../lib/api'
import { useI18n } from '../../lib/i18n'

interface Props {
  sessionId: string
  messageId: string
  onClose: () => void
}

export default function FeedbackTicketDialog({ sessionId, messageId, onClose }: Props) {
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const { t } = useI18n()

  const handleSubmit = async () => {
    if (!comment.trim() || submitting) return
    setSubmitting(true)
    try {
      await createFeedbackTicket(sessionId, messageId, comment.trim())
      setDone(true)
      setTimeout(onClose, 1200)
    } catch {
      toast.error(t('toast.saveFailed'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-xl w-[420px] p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-[var(--slate-800)]">
            {t('feedback.ticketTitle')}
          </h3>
          <button onClick={onClose} className="text-[var(--slate-400)] hover:text-[var(--slate-600)]">
            <X size={18} />
          </button>
        </div>

        {done ? (
          <p className="text-sm text-green-600 py-4 text-center">{t('feedback.submitted')}</p>
        ) : (
          <>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder={t('feedback.ticketComment')}
              rows={4}
              className="w-full rounded-lg border border-[var(--slate-200)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--safety-blue)] focus:ring-1 focus:ring-[var(--safety-blue)] resize-none"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm rounded-lg border border-[var(--slate-200)] text-[var(--slate-600)] hover:bg-[var(--slate-50)]"
              >
                {t('feedback.cancel')}
              </button>
              <button
                onClick={handleSubmit}
                disabled={!comment.trim() || submitting}
                className="px-4 py-2 text-sm rounded-lg bg-[var(--safety-blue)] text-white hover:bg-[var(--safety-blue-hover)] disabled:opacity-50"
              >
                {t('feedback.submit')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
