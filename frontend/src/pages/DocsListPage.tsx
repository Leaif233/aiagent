import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, CheckSquare, Square, ChevronLeft, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import LeftSidebar from '../components/chat/left-sidebar'
import ConfirmDialog from '../components/ui/confirm-dialog'
import { useI18n } from '../lib/i18n'
import { listDocsPaged, batchDocs } from '../lib/api'

interface DocItem {
  id: string
  title: string
  category: string
  status: string
  updated_at: string
}

const STATUS_FILTERS = ['all', '待处理', '解析中', '待审核', '索引构建中', '已审核', '已驳回', '处理失败'] as const

export default function DocsListPage() {
  const { t } = useI18n()
  const navigate = useNavigate()

  const [items, setItems] = useState<DocItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(15)
  const [status, setStatus] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [confirmAction, setConfirmAction] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const s = status === 'all' ? undefined : status
      const data = await listDocsPaged(page, pageSize, s, search || undefined)
      setItems(data.items || [])
      setTotal(data.total || 0)
    } catch (err: any) { toast.error(err.message || t('common.loadFailed')) }
    setLoading(false)
  }, [page, pageSize, status, search])

  useEffect(() => { load() }, [load])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  const handleStatusChange = (s: string) => {
    setStatus(s)
    setPage(1)
    setSelected(new Set())
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === items.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(items.map(i => i.id)))
    }
  }

  const handleBatch = async (action: string) => {
    if (selected.size === 0) return
    if (action === 'delete') {
      setConfirmAction('delete')
      return
    }
    await executeBatch(action)
  }

  const executeBatch = async (action: string) => {
    try {
      const res = await batchDocs(action, Array.from(selected))
      toast.success(t('common.batchSuccess').replace('{count}', String(res.success)))
      setSelected(new Set())
      setConfirmAction(null)
      load()
    } catch (err: any) {
      toast.error(err.message || t('common.batchFailed'))
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      all: t('browse.all'),
      '待处理': t('browse.pending'),
      '解析中': '解析中',
      '待审核': t('browse.reviewing'),
      '索引构建中': '索引构建中',
      '已审核': t('browse.verified'),
      '已驳回': t('browse.rejected'),
      '处理失败': '处理失败',
    }
    return map[s] || s
  }

  const statusColor = (s: string) => {
    switch (s) {
      case '已审核': return 'bg-green-100 text-green-700'
      case '待审核': return 'bg-yellow-100 text-yellow-700'
      case '待处理': return 'bg-blue-100 text-blue-700'
      case '已驳回': return 'bg-red-100 text-red-700'
      case '解析中': return 'bg-purple-100 text-purple-700'
      case '索引构建中': return 'bg-cyan-100 text-cyan-700'
      case '处理失败': return 'bg-red-100 text-red-700'
      default: return 'bg-gray-100 text-gray-600'
    }
  }

  return (
    <div className="flex h-screen bg-[var(--slate-50)]">
      <LeftSidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header
          t={t}
          searchInput={searchInput}
          onSearchChange={setSearchInput}
        />
        <StatusTabs
          status={status}
          onChange={handleStatusChange}
          statusLabel={statusLabel}
        />
        {selected.size > 0 && (
          <BatchBar
            count={selected.size}
            t={t}
            onBatch={handleBatch}
          />
        )}
        <ItemTable
          items={items}
          loading={loading}
          selected={selected}
          toggleSelect={toggleSelect}
          toggleAll={toggleAll}
          statusColor={statusColor}
          navigate={navigate}
          t={t}
        />
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          onPrev={() => setPage(p => Math.max(1, p - 1))}
          onNext={() => setPage(p => Math.min(totalPages, p + 1))}
          t={t}
        />
        {confirmAction === 'delete' && (
          <ConfirmDialog
            message={t('confirm.deleteItems')}
            onConfirm={() => executeBatch('delete')}
            onCancel={() => setConfirmAction(null)}
          />
        )}
      </main>
    </div>
  )
}

/* ---- Sub-components ---- */

function Header({ t, searchInput, onSearchChange }: {
  t: (k: any) => string
  searchInput: string
  onSearchChange: (v: string) => void
}) {
  return (
    <div className="h-16 border-b border-[var(--slate-200)] bg-white flex items-center px-6 gap-4 shrink-0">
      <h1 className="text-lg font-semibold text-[var(--slate-800)]">
        {t('browse.docs')}
      </h1>
      <div className="flex-1" />
      <div className="relative w-64">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--slate-400)]" />
        <input
          value={searchInput}
          onChange={e => onSearchChange(e.target.value)}
          placeholder={t('browse.search')}
          className="w-full pl-9 pr-3 py-2 text-sm border border-[var(--slate-200)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--safety-blue)] bg-white"
        />
      </div>
    </div>
  )
}

function StatusTabs({ status, onChange, statusLabel }: {
  status: string
  onChange: (s: string) => void
  statusLabel: (s: string) => string
}) {
  return (
    <div className="flex gap-1 px-6 py-3 bg-white border-b border-[var(--slate-200)] shrink-0">
      {STATUS_FILTERS.map(s => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
            status === s
              ? 'bg-[var(--safety-blue)] text-white'
              : 'text-[var(--slate-500)] hover:bg-[var(--slate-100)]'
          }`}
        >
          {statusLabel(s)}
        </button>
      ))}
    </div>
  )
}

function BatchBar({ count, t, onBatch }: {
  count: number
  t: (k: any) => string
  onBatch: (action: string) => void
}) {
  return (
    <div className="flex items-center gap-3 px-6 py-2 bg-blue-50 border-b border-blue-200 shrink-0">
      <span className="text-sm text-blue-700 font-medium">
        {count} {t('browse.selected')}
      </span>
      <button onClick={() => onBatch('approve')} className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700">
        {t('browse.batchApprove')}
      </button>
      <button onClick={() => onBatch('reject')} className="px-3 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700">
        {t('browse.batchReject')}
      </button>
      <button onClick={() => onBatch('delete')} className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700">
        {t('browse.batchDelete')}
      </button>
    </div>
  )
}

function ItemTable({ items, loading, selected, toggleSelect, toggleAll, statusColor, navigate, t }: {
  items: DocItem[]
  loading: boolean
  selected: Set<string>
  toggleSelect: (id: string) => void
  toggleAll: () => void
  statusColor: (s: string) => string
  navigate: (path: string) => void
  t: (k: any) => string
}) {
  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-[var(--slate-400)]">{t('common.loading')}</div>
  }
  if (items.length === 0) {
    return <div className="flex-1 flex items-center justify-center text-[var(--slate-400)]">{t('browse.noItems')}</div>
  }
  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full text-sm">
        <thead className="bg-[var(--slate-50)] sticky top-0">
          <tr className="text-left text-[var(--slate-500)]">
            <th className="px-6 py-3 w-10">
              <button onClick={toggleAll}>
                {selected.size === items.length ? <CheckSquare size={16} /> : <Square size={16} />}
              </button>
            </th>
            <th className="px-3 py-3">{t('table.title')}</th>
            <th className="px-3 py-3 w-28">{t('table.category')}</th>
            <th className="px-3 py-3 w-24">{t('table.status')}</th>
            <th className="px-3 py-3 w-40">{t('table.updated')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr
              key={item.id}
              className="border-b border-[var(--slate-100)] hover:bg-[var(--slate-50)] cursor-pointer"
              onClick={() => navigate(`/admin/docs/${item.id}`)}
            >
              <td className="px-6 py-3" onClick={e => { e.stopPropagation(); toggleSelect(item.id) }}>
                {selected.has(item.id) ? <CheckSquare size={16} className="text-[var(--safety-blue)]" /> : <Square size={16} className="text-[var(--slate-300)]" />}
              </td>
              <td className="px-3 py-3 font-medium text-[var(--slate-800)] truncate max-w-xs">
                {item.title || '--'}
              </td>
              <td className="px-3 py-3 text-[var(--slate-500)]">{item.category || '--'}</td>
              <td className="px-3 py-3">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(item.status)}`}>
                  {item.status}
                </span>
              </td>
              <td className="px-3 py-3 text-[var(--slate-400)]">
                {item.updated_at?.slice(0, 16).replace('T', ' ') || '--'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Pagination({ page, totalPages, total, onPrev, onNext, t }: {
  page: number
  totalPages: number
  total: number
  onPrev: () => void
  onNext: () => void
  t: (k: any) => string
}) {
  if (totalPages <= 1) return null
  const info = t('browse.pageInfo').replace('{page}', String(page)).replace('{total}', String(total))
  return (
    <div className="flex items-center justify-between px-6 py-3 border-t border-[var(--slate-200)] bg-white shrink-0">
      <span className="text-sm text-[var(--slate-500)]">{info}</span>
      <div className="flex gap-2">
        <button
          onClick={onPrev}
          disabled={page <= 1}
          className="flex items-center gap-1 px-3 py-1.5 text-sm border border-[var(--slate-200)] rounded-lg disabled:opacity-40 hover:bg-[var(--slate-50)]"
        >
          <ChevronLeft size={14} /> {t('browse.prev')}
        </button>
        <button
          onClick={onNext}
          disabled={page >= totalPages}
          className="flex items-center gap-1 px-3 py-1.5 text-sm border border-[var(--slate-200)] rounded-lg disabled:opacity-40 hover:bg-[var(--slate-50)]"
        >
          {t('browse.next')} <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}
