import { CheckCircle, AlertTriangle, Wrench } from 'lucide-react'
import { useI18n } from '../../lib/i18n'

interface Props {
  content: string
  data?: {
    symptom: string
    reason: string
    solution: string
    status: string
  }
}

export default function VerifiedSolution({ content, data }: Props) {
  const { t } = useI18n()

  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] rounded-2xl rounded-bl-md overflow-hidden border border-green-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-[var(--verified-green)] to-emerald-500 px-4 py-3 flex items-center gap-2">
          <CheckCircle size={16} className="text-white" />
          <span className="text-white text-sm font-medium">
            {t('solution.title')}
          </span>
        </div>

        {/* Body */}
        <div className="bg-[var(--verified-green-light)] px-4 py-4 space-y-3">
          {content && (
            <p className="text-sm text-[var(--slate-700)]">{content}</p>
          )}

          {data && (
            <div className="space-y-3">
              <SolutionField
                icon={<AlertTriangle size={14} className="text-orange-500" />}
                label={t('solution.symptom')}
                value={data.symptom}
              />
              <SolutionField
                icon={<AlertTriangle size={14} className="text-red-500" />}
                label={t('solution.rootCause')}
                value={data.reason}
              />
              <SolutionField
                icon={<Wrench size={14} className="text-[var(--safety-blue)]" />}
                label={t('solution.solution')}
                value={data.solution}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SolutionField({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="bg-white rounded-lg p-3 border border-green-100">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-xs font-medium text-[var(--slate-500)]">
          {label}
        </span>
      </div>
      <p className="text-sm text-[var(--slate-700)] whitespace-pre-wrap">
        {value}
      </p>
    </div>
  )
}
