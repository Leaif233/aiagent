import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useI18n } from '../../lib/i18n'

interface Props {
  labels: string[]
  newDocs: number[]
  newTickets: number[]
  newSessions: number[]
}

export default function TrendChart({ labels, newDocs, newTickets, newSessions }: Props) {
  const { t } = useI18n()

  const data = labels.map((label, i) => ({
    date: label.slice(5),
    docs: newDocs[i],
    tickets: newTickets[i],
    sessions: newSessions[i],
  }))

  return (
    <div className="rounded-xl border border-[var(--slate-200)] bg-white p-5">
      <h3 className="text-sm font-semibold text-[var(--slate-800)] mb-4">
        {t('dashboard.trends')}
      </h3>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="docs" name={t('dashboard.newDocs')} stroke="#3b82f6" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="tickets" name={t('dashboard.newTickets')} stroke="#f59e0b" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="sessions" name={t('dashboard.newSessions')} stroke="#10b981" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
