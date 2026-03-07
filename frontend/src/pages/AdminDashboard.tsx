import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Ticket, CheckCircle, Upload, FileUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { getAdminStats, getPendingItems, uploadDocs, importTickets, getAdminTrends, getHotTopics, getNoResultQueries, getLlmUsage } from '../lib/api'
import { useI18n } from '../lib/i18n'
import LeftSidebar from '../components/chat/left-sidebar'
import LangToggle from '../components/ui/lang-toggle'
import KnowledgeDistributionChart from '../components/admin/knowledge-distribution-chart'
import TrendChart from '../components/admin/trend-chart'
import HotTopicsList from '../components/admin/hot-topics-list'
import NoResultList from '../components/admin/no-result-list'
import CostSavingsCard from '../components/admin/cost-savings-card'

interface Stats {
  pending_docs: number
  pending_tickets: number
  verified_total: number
  docs_by_status: Record<string, number>
  tickets_by_status: Record<string, number>
  total_sessions: number
  avg_rounds: number
  stage_distribution: Record<string, number>
  total_thumbs_up: number
  total_thumbs_down: number
  queries_resolved: number
  estimated_savings: number
}

interface TrendsData {
  labels: string[]
  new_docs: number[]
  new_tickets: number[]
  new_sessions: number[]
}

interface TopicItem {
  topic: string
  count: number
  last_asked: string
}

interface PendingItem {
  id: string
  name: string
  type: 'document' | 'ticket'
  status: string
  created_at: string
  updated_at: string
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [items, setItems] = useState<PendingItem[]>([])
  const [trends, setTrends] = useState<TrendsData | null>(null)
  const [hotTopics, setHotTopics] = useState<TopicItem[]>([])
  const [noResultQueries, setNoResultQueries] = useState<{ query: string; count: number; last_asked: string }[]>([])
  const [usageData, setUsageData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const { t } = useI18n()

  const loadData = async () => {
    try {
      const [s, p, tr, ht, nrq, usage] = await Promise.all([
        getAdminStats(),
        getPendingItems(),
        getAdminTrends(30),
        getHotTopics(10),
        getNoResultQueries(10),
        getLlmUsage(30).catch(() => null),
      ])
      setStats(s)
      setItems(p.items || [])
      setTrends(tr)
      setHotTopics(ht.items || [])
      setNoResultQueries(nrq.items || [])
      setUsageData(usage)
    } catch (err: any) {
      toast.error(err.message || t('common.dashboardFailed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const handleUploadDocs = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = '.pdf,.pptx,.docx,.md'
    input.onchange = async () => {
      if (input.files?.length) {
        await uploadDocs(input.files)
        loadData()
      }
    }
    input.click()
  }

  const handleImportTickets = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,.xlsx,.xls'
    input.onchange = async () => {
      if (input.files?.[0]) {
        await importTickets(input.files[0])
        loadData()
      }
    }
    input.click()
  }

  return (
    <div className="flex h-screen bg-[var(--slate-50)]">
      <LeftSidebar />
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-[var(--safety-blue)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <DashboardContent
            stats={stats}
            items={items}
            trends={trends}
            hotTopics={hotTopics}
            noResultQueries={noResultQueries}
            usageData={usageData}
            navigate={navigate}
            onUploadDocs={handleUploadDocs}
            onImportTickets={handleImportTickets}
          />
        )}
      </div>
    </div>
  )
}

function DashboardContent({
  stats,
  items,
  trends,
  hotTopics,
  noResultQueries,
  usageData,
  navigate,
  onUploadDocs,
  onImportTickets,
}: {
  stats: Stats | null
  items: PendingItem[]
  trends: TrendsData | null
  hotTopics: TopicItem[]
  noResultQueries: { query: string; count: number; last_asked: string }[]
  usageData: any
  navigate: ReturnType<typeof useNavigate>
  onUploadDocs: () => void
  onImportTickets: () => void
}) {
  const docs = items.filter(i => i.type === 'document')
  const tickets = items.filter(i => i.type === 'ticket')
  const { t } = useI18n()

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-[var(--slate-800)]">
          {t('admin.title')}
        </h1>
        <div className="flex gap-3 items-center">
          <LangToggle />
          <button
            onClick={onUploadDocs}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--safety-blue)] text-white text-sm font-medium hover:bg-[var(--safety-blue-hover)] transition-colors"
          >
            <Upload size={16} />
            {t('admin.uploadDocs')}
          </button>
          <button
            onClick={onImportTickets}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--slate-300)] text-[var(--slate-700)] text-sm font-medium hover:bg-[var(--slate-100)] transition-colors"
          >
            <FileUp size={16} />
            {t('admin.importTickets')}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <StatsCards stats={stats} />

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-6 mt-8">
        {stats && (
          <KnowledgeDistributionChart
            docsByStatus={stats.docs_by_status || {}}
            ticketsByStatus={stats.tickets_by_status || {}}
          />
        )}
        {stats && (
          <CostSavingsCard
            queriesResolved={stats.queries_resolved}
            estimatedSavings={stats.estimated_savings}
            totalSessions={stats.total_sessions}
            avgRounds={stats.avg_rounds}
            thumbsUp={stats.total_thumbs_up}
            thumbsDown={stats.total_thumbs_down}
            stageDistribution={stats.stage_distribution || {}}
          />
        )}
      </div>

      {/* Trends + Hot Topics + No-Result Queries */}
      <div className="grid grid-cols-4 gap-6 mt-6">
        <div className="col-span-2">
          {trends && (
            <TrendChart
              labels={trends.labels}
              newDocs={trends.new_docs}
              newTickets={trends.new_tickets}
              newSessions={trends.new_sessions}
            />
          )}
        </div>
        <HotTopicsList items={hotTopics} />
        <div className="rounded-xl border border-[var(--slate-200)] bg-white p-4">
          <h3 className="text-sm font-semibold text-[var(--slate-800)] mb-3">
            无结果搜索词
          </h3>
          <NoResultList items={noResultQueries} />
        </div>
      </div>

      {/* LLM Usage Panel */}
      {usageData && <UsagePanel data={usageData} />}

      {/* Pending Items */}
      <div className="grid grid-cols-2 gap-6 mt-8">
        <PendingList
          title={t('admin.pendingDocuments')}
          icon={<FileText size={18} className="text-[var(--safety-blue)]" />}
          items={docs}
          onItemClick={(id) => navigate(`/admin/docs/${id}`)}
        />
        <PendingList
          title={t('admin.pendingTicketsList')}
          icon={<Ticket size={18} className="text-[var(--pending-orange)]" />}
          items={tickets}
          onItemClick={(id) => navigate(`/admin/tickets/${id}`)}
        />
      </div>
    </div>
  )
}

function StatsCards({ stats }: { stats: Stats | null }) {
  const { t } = useI18n()
  const cards = [
    {
      label: t('admin.pendingDocs'),
      value: stats?.pending_docs ?? '--',
      icon: <FileText size={20} className="text-[var(--pending-orange)]" />,
      bg: 'var(--pending-orange-light)',
    },
    {
      label: t('admin.pendingTickets'),
      value: stats?.pending_tickets ?? '--',
      icon: <Ticket size={20} className="text-[var(--pending-orange)]" />,
      bg: 'var(--pending-orange-light)',
    },
    {
      label: t('admin.verifiedTotal'),
      value: stats?.verified_total ?? '--',
      icon: <CheckCircle size={20} className="text-[var(--verified-green)]" />,
      bg: 'var(--verified-green-light)',
    },
  ]

  return (
    <div className="grid grid-cols-3 gap-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-xl border border-[var(--slate-200)] bg-white p-5 flex items-center gap-4"
        >
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: c.bg }}
          >
            {c.icon}
          </div>
          <div>
            <p className="text-2xl font-bold text-[var(--slate-800)]">{c.value}</p>
            <p className="text-xs text-[var(--slate-500)]">{c.label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

const TASK_LABELS: Record<string, { zh: string; en: string }> = {
  text_cleaning: { zh: '工单清洗', en: 'Ticket Cleaning' },
  doc_cleaning: { zh: '文档清洗', en: 'Doc Cleaning' },
  multimodal_cleaning: { zh: '多模态清洗', en: 'Multimodal' },
  fingerprint_extraction: { zh: '指纹提取', en: 'Fingerprint' },
  guidance_grouping: { zh: '引导分组', en: 'Grouping' },
  chat_dialogue: { zh: '对话交互', en: 'Chat' },
}

function UsagePanel({ data }: { data: any }) {
  const { t, lang } = useI18n()
  const summary = data?.summary || {}
  const byProvider = data?.by_provider || []
  const byTask = data?.by_task || []

  const errorRate = summary.total_calls
    ? ((summary.error_count || 0) / summary.total_calls * 100).toFixed(1)
    : '0.0'

  return (
    <div className="mt-8 rounded-xl border border-[var(--slate-200)] bg-white p-6">
      <h3 className="text-base font-semibold text-[var(--slate-800)] mb-4">
        {t('dashboard.llmUsage')}
      </h3>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <SummaryCard label={t('dashboard.totalCalls')} value={summary.total_calls ?? 0} />
        <SummaryCard label={t('dashboard.totalTokens')} value={(summary.total_tokens ?? 0).toLocaleString()} />
        <SummaryCard label={t('dashboard.avgLatency')} value={Math.round(summary.avg_latency_ms ?? 0)} />
        <SummaryCard label={t('dashboard.errorRate')} value={`${errorRate}%`} />
      </div>

      {/* Tables */}
      <div className="grid grid-cols-2 gap-6">
        {/* By Provider */}
        <div>
          <h4 className="text-sm font-medium text-[var(--slate-600)] mb-2">{t('dashboard.byProvider')}</h4>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--slate-500)] border-b border-[var(--slate-100)]">
                <th className="pb-1.5 font-medium">{t('dashboard.provider')}</th>
                <th className="pb-1.5 font-medium">{t('dashboard.model')}</th>
                <th className="pb-1.5 font-medium text-right">{t('dashboard.calls')}</th>
                <th className="pb-1.5 font-medium text-right">{t('dashboard.tokens')}</th>
              </tr>
            </thead>
            <tbody>
              {byProvider.map((row: any, i: number) => (
                <tr key={i} className="border-b border-[var(--slate-50)]">
                  <td className="py-1.5 text-[var(--slate-700)]">{row.provider}</td>
                  <td className="py-1.5 text-[var(--slate-500)] text-xs font-mono">{row.model}</td>
                  <td className="py-1.5 text-right font-mono">{row.call_count}</td>
                  <td className="py-1.5 text-right font-mono">{(row.total_tokens || 0).toLocaleString()}</td>
                </tr>
              ))}
              {byProvider.length === 0 && (
                <tr><td colSpan={4} className="py-3 text-center text-[var(--slate-400)]">--</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* By Task */}
        <div>
          <h4 className="text-sm font-medium text-[var(--slate-600)] mb-2">{t('dashboard.byTask')}</h4>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--slate-500)] border-b border-[var(--slate-100)]">
                <th className="pb-1.5 font-medium">{t('settings.taskRouting.task')}</th>
                <th className="pb-1.5 font-medium text-right">{t('dashboard.calls')}</th>
                <th className="pb-1.5 font-medium text-right">{t('dashboard.tokens')}</th>
                <th className="pb-1.5 font-medium text-right">{t('dashboard.latency')}</th>
              </tr>
            </thead>
            <tbody>
              {byTask.map((row: any, i: number) => (
                <tr key={i} className="border-b border-[var(--slate-50)]">
                  <td className="py-1.5 text-[var(--slate-700)]">
                    {TASK_LABELS[row.task_type]?.[lang] || row.task_type}
                  </td>
                  <td className="py-1.5 text-right font-mono">{row.call_count}</td>
                  <td className="py-1.5 text-right font-mono">{(row.total_tokens || 0).toLocaleString()}</td>
                  <td className="py-1.5 text-right font-mono">{Math.round(row.avg_latency_ms || 0)}</td>
                </tr>
              ))}
              {byTask.length === 0 && (
                <tr><td colSpan={4} className="py-3 text-center text-[var(--slate-400)]">--</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="px-4 py-3 bg-[var(--slate-50)] rounded-lg">
      <p className="text-xl font-bold text-[var(--slate-800)]">{value}</p>
      <p className="text-xs text-[var(--slate-500)] mt-0.5">{label}</p>
    </div>
  )
}

function PendingList({
  title,
  icon,
  items,
  onItemClick,
}: {
  title: string
  icon: React.ReactNode
  items: PendingItem[]
  onItemClick: (id: string) => void
}) {
  const { t } = useI18n()
  return (
    <div className="rounded-xl border border-[var(--slate-200)] bg-white">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--slate-200)]">
        {icon}
        <h3 className="text-sm font-semibold text-[var(--slate-800)]">
          {title}
        </h3>
        <span className="ml-auto text-xs bg-[var(--pending-orange-light)] text-[var(--pending-orange)] px-2 py-0.5 rounded-full font-medium">
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="p-5 text-sm text-[var(--slate-400)]">{t('admin.noPending')}</p>
      ) : (
        <div className="divide-y divide-[var(--slate-100)]">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => onItemClick(item.id)}
              className="w-full text-left px-5 py-3 hover:bg-[var(--slate-50)] transition-colors"
            >
              <p className="text-sm font-medium text-[var(--slate-700)] truncate">
                {item.name}
              </p>
              <p className="text-xs text-[var(--slate-400)] mt-1">
                {new Date(item.updated_at).toLocaleString()}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
