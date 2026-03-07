import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts'
import { useI18n } from '../../lib/i18n'

interface Props {
  docsByStatus: Record<string, number>
  ticketsByStatus: Record<string, number>
}

const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6']

export default function KnowledgeDistributionChart({ docsByStatus, ticketsByStatus }: Props) {
  const { t } = useI18n()

  const docData = Object.entries(docsByStatus).map(([name, value]) => ({ name, value }))
  const ticketData = Object.entries(ticketsByStatus).map(([name, value]) => ({ name, value }))

  return (
    <div className="rounded-xl border border-[var(--slate-200)] bg-white p-5">
      <h3 className="text-sm font-semibold text-[var(--slate-800)] mb-4">
        {t('dashboard.knowledgeDist')}
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-[var(--slate-500)] mb-2 text-center">{t('dashboard.documents')}</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={docData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label>
                {docData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div>
          <p className="text-xs text-[var(--slate-500)] mb-2 text-center">{t('dashboard.tickets')}</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={ticketData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label>
                {ticketData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
