import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, MessageSquare, CheckSquare, Square, Settings2 } from 'lucide-react'
import { useI18n } from '../../lib/i18n'
import { listSessions, deleteSession, batchDeleteSessions } from '../../lib/api'

interface SessionItem {
  id: string
  created_at: string
  updated_at: string
  round_count: number
  last_message: string | null
}

interface Props {
  currentSessionId: string
  onSelectSession: (id: string) => void
  onNewChat: () => void
}

export default function SessionList({ currentSessionId, onSelectSession, onNewChat }: Props) {
  const { t } = useI18n()
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    try {
      const data = await listSessions(page, 20)
      if (page === 1) {
        setSessions(data.items || [])
      } else {
        setSessions(prev => [...prev, ...(data.items || [])])
      }
      setTotal(data.total || 0)
    } catch { /* ignore */ }
  }, [page])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id: string) => {
    try {
      await deleteSession(id)
      setSessions(prev => prev.filter(s => s.id !== id))
      setTotal(prev => prev - 1)
      setConfirmId(null)
    } catch { /* ignore */ }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === sessions.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(sessions.map(s => s.id)))
    }
  }

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return
    try {
      await batchDeleteSessions(Array.from(selectedIds))
      setSessions(prev => prev.filter(s => !selectedIds.has(s.id)))
      setTotal(prev => prev - selectedIds.size)
      setSelectedIds(new Set())
      setSelectMode(false)
    } catch { /* ignore */ }
  }

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const dayMs = 86400000

    if (diff < dayMs) return t('session.today')
    if (diff < dayMs * 2) return t('session.yesterday')
    return d.toLocaleDateString()
  }

  const hasMore = sessions.length < total

  return (
    <div className="flex flex-col h-full">
      {/* Header: New Chat + Manage */}
      <div className="mx-3 mt-3 mb-2 flex gap-2">
        {selectMode ? (
          <button
            onClick={exitSelectMode}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[var(--slate-300)] text-sm text-[var(--slate-500)] hover:bg-[var(--slate-50)] transition-colors"
          >
            {t('session.done')}
          </button>
        ) : (
          <>
            <button
              onClick={onNewChat}
              className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-[var(--slate-300)] text-sm text-[var(--slate-500)] hover:bg-[var(--slate-50)] hover:border-[var(--safety-blue)] hover:text-[var(--safety-blue)] transition-colors"
            >
              <Plus size={16} />
              {t('session.newChat')}
            </button>
            {sessions.length > 0 && (
              <button
                onClick={() => setSelectMode(true)}
                className="px-2 py-2 rounded-lg border border-[var(--slate-300)] text-[var(--slate-400)] hover:text-[var(--slate-600)] hover:bg-[var(--slate-50)] transition-colors"
                title={t('session.manage')}
              >
                <Settings2 size={16} />
              </button>
            )}
          </>
        )}
      </div>

      {/* Select mode toolbar */}
      {selectMode && sessions.length > 0 && (
        <div className="mx-3 mb-2 flex items-center gap-2">
          <button
            onClick={toggleSelectAll}
            className="text-xs text-[var(--safety-blue)] hover:underline"
          >
            {selectedIds.size === sessions.length ? t('session.deselectAll') : t('session.selectAll')}
          </button>
          <span className="text-xs text-[var(--slate-400)] flex-1">
            {t('session.selectedCount').replace('{count}', String(selectedIds.size))}
          </span>
          {selectedIds.size > 0 && (
            <button
              onClick={handleBatchDelete}
              className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
            >
              {t('session.deleteSelected')}
            </button>
          )}
        </div>
      )}

      {/* Session List */}
      <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
        {sessions.length === 0 && (
          <p className="text-center text-xs text-[var(--slate-400)] py-8">
            {t('session.noHistory')}
          </p>
        )}
        {sessions.map(s => (
          <SessionRow
            key={s.id}
            session={s}
            active={s.id === currentSessionId}
            confirmDelete={confirmId === s.id}
            selectMode={selectMode}
            selected={selectedIds.has(s.id)}
            onSelect={() => selectMode ? toggleSelect(s.id) : onSelectSession(s.id)}
            onDeleteClick={() => setConfirmId(s.id)}
            onDeleteConfirm={() => handleDelete(s.id)}
            onDeleteCancel={() => setConfirmId(null)}
            formatDate={formatDate}
            t={t}
          />
        ))}

        {hasMore && (
          <button
            onClick={() => setPage(p => p + 1)}
            className="w-full py-2 text-xs text-[var(--safety-blue)] hover:underline"
          >
            {t('session.loadMore')}
          </button>
        )}
      </div>
    </div>
  )
}

/* ---- Sub-component ---- */

function SessionRow({ session, active, confirmDelete, selectMode, selected, onSelect, onDeleteClick, onDeleteConfirm, onDeleteCancel, formatDate, t }: {
  session: SessionItem
  active: boolean
  confirmDelete: boolean
  selectMode: boolean
  selected: boolean
  onSelect: () => void
  onDeleteClick: () => void
  onDeleteConfirm: () => void
  onDeleteCancel: () => void
  formatDate: (d: string) => string
  t: (k: any) => string
}) {
  return (
    <div
      onClick={onSelect}
      className={`group flex items-start gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
        selected
          ? 'bg-blue-50 text-[var(--safety-blue)]'
          : active
            ? 'bg-[var(--safety-blue-light)] text-[var(--safety-blue)]'
            : 'text-[var(--slate-600)] hover:bg-[var(--slate-100)]'
      }`}
    >
      {selectMode ? (
        selected
          ? <CheckSquare size={14} className="mt-0.5 shrink-0 text-[var(--safety-blue)]" />
          : <Square size={14} className="mt-0.5 shrink-0 opacity-50" />
      ) : (
        <MessageSquare size={14} className="mt-0.5 shrink-0 opacity-50" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">
          {session.last_message || '...'}
        </p>
        <p className="text-[10px] text-[var(--slate-400)] mt-0.5">
          {formatDate(session.updated_at)} · {session.round_count} {t('table.rounds')}
        </p>
      </div>

      {/* Delete - hidden in select mode */}
      {!selectMode && (confirmDelete ? (
        <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={onDeleteConfirm}
            className="text-[10px] px-1.5 py-0.5 bg-red-500 text-white rounded"
          >
            {t('session.delete')}
          </button>
          <button
            onClick={onDeleteCancel}
            className="text-[10px] px-1.5 py-0.5 bg-[var(--slate-200)] rounded"
          >
            {t('feedback.cancel')}
          </button>
        </div>
      ) : (
        <button
          onClick={e => { e.stopPropagation(); onDeleteClick() }}
          className="opacity-0 group-hover:opacity-100 shrink-0 p-1 rounded hover:bg-red-100 text-[var(--slate-400)] hover:text-red-500 transition-all"
        >
          <Trash2 size={13} />
        </button>
      ))}
    </div>
  )
}
