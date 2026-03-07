import { DollarSign, MessageSquare, BarChart3 } from 'lucide-react'
import { useI18n } from '../../lib/i18n'

interface Props {
  queriesResolved: number
  estimatedSavings: number
  totalSessions: number
  avgRounds: number
  thumbsUp: number
  thumbsDown: number
  stageDistribution: Record<string, number>
}

export default function CostSavingsCard({
  queriesResolved,
  estimatedSavings,
  totalSessions,
  avgRounds,
  thumbsUp,
  thumbsDown,
  stageDistribution,
}: Props) {
  const { t } = useI18n()

  return (
    <div className="rounded-xl border border-[var(--slate-200)] bg-white p-5">
      <h3 className="text-sm font-semibold text-[var(--slate-800)] mb-4">
        {t('dashboard.costSavings')}
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <MiniStat
          icon={<MessageSquare size={16} className="text-[var(--safety-blue)]" />}
          label={t('dashboard.totalSessions')}
          value={String(totalSessions)}
        />
        <MiniStat
          icon={<BarChart3 size={16} className="text-[var(--safety-blue)]" />}
          label={t('dashboard.avgRounds')}
          value={String(avgRounds)}
        />
        <MiniStat
          icon={<DollarSign size={16} className="text-green-600" />}
          label={t('dashboard.estimatedSavings')}
          value={`¥${estimatedSavings.toLocaleString()}`}
        />
        <MiniStat
          icon={<MessageSquare size={16} className="text-green-600" />}
          label={t('dashboard.queriesResolved')}
          value={String(queriesResolved)}
        />
      </div>

      {/* Stage distribution */}
      <div className="mt-4 pt-4 border-t border-[var(--slate-100)]">
        <p className="text-xs text-[var(--slate-500)] mb-2">{t('dashboard.stageDistribution')}</p>
        <div className="flex gap-3">
          {['1', '3', '4', '5'].map(s => (
            <div key={s} className="flex-1 text-center">
              <p className="text-lg font-bold text-[var(--slate-800)]">
                {stageDistribution[s] || 0}
              </p>
              <p className="text-xs text-[var(--slate-400)]">Stage {s}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Feedback summary */}
      <div className="mt-4 pt-4 border-t border-[var(--slate-100)] flex gap-4">
        <span className="text-xs text-green-600">👍 {thumbsUp}</span>
        <span className="text-xs text-red-500">👎 {thumbsDown}</span>
      </div>
    </div>
  )
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <div>
        <p className="text-sm font-semibold text-[var(--slate-800)]">{value}</p>
        <p className="text-xs text-[var(--slate-400)]">{label}</p>
      </div>
    </div>
  )
}
