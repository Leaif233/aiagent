import { useState } from 'react'
import { ThumbsUp, ThumbsDown, AlertTriangle } from 'lucide-react'
import { submitFeedback } from '../../lib/api'
import { useI18n } from '../../lib/i18n'

interface Props {
  messageId: string
  sessionId: string
  onReport: () => void
}

export default function MessageFeedback({ messageId, sessionId, onReport }: Props) {
  const [rating, setRating] = useState<number>(0)
  const { t } = useI18n()

  const handleRate = async (value: number) => {
    if (rating !== 0) return
    setRating(value)
    await submitFeedback(messageId, value)
  }

  return (
    <div className="flex items-center gap-1 mt-1">
      <button
        onClick={() => handleRate(1)}
        className={`p-1 rounded hover:bg-[var(--slate-100)] transition-colors ${
          rating === 1 ? 'text-green-600' : 'text-[var(--slate-400)]'
        }`}
        title={t('feedback.thumbsUp')}
        disabled={rating !== 0}
      >
        <ThumbsUp size={14} />
      </button>
      <button
        onClick={() => handleRate(-1)}
        className={`p-1 rounded hover:bg-[var(--slate-100)] transition-colors ${
          rating === -1 ? 'text-red-500' : 'text-[var(--slate-400)]'
        }`}
        title={t('feedback.thumbsDown')}
        disabled={rating !== 0}
      >
        <ThumbsDown size={14} />
      </button>
      <button
        onClick={onReport}
        className="p-1 rounded hover:bg-[var(--slate-100)] text-[var(--slate-400)] transition-colors"
        title={t('feedback.report')}
      >
        <AlertTriangle size={14} />
      </button>
    </div>
  )
}
