import { useState, useEffect } from 'react'
import { X, RotateCcw, Eye } from 'lucide-react'
import { getVersionHistory, getVersionSnapshot, rollbackVersion } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import ConfirmDialog from '../ui/confirm-dialog'

interface Props {
  entityType: string
  entityId: string
  onClose: () => void
  onRollback: () => void
}

interface VersionItem {
  id: string
  version_number: number
  changed_by: string
  change_reason: string
  created_at: string
}

export default function VersionHistory({ entityType, entityId, onClose, onRollback }: Props) {
  const [versions, setVersions] = useState<VersionItem[]>([])
  const [snapshot, setSnapshot] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [rollbackId, setRollbackId] = useState<string | null>(null)
  const { t } = useI18n()

  useEffect(() => {
    getVersionHistory(entityType, entityId).then(res => {
      setVersions(res.items || [])
      setLoading(false)
    })
  }, [entityType, entityId])

  const handleView = async (versionId: string) => {
    const res = await getVersionSnapshot(entityType, entityId, versionId)
    setSnapshot(res.snapshot || null)
  }

  const handleRollback = async (versionId: string) => {
    setRollbackId(versionId)
  }

  const confirmRollback = async () => {
    if (!rollbackId) return
    await rollbackVersion(entityType, entityId, rollbackId)
    setRollbackId(null)
    onRollback()
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <div className="w-[480px] bg-white h-full shadow-xl flex flex-col">
        <Header title={t('version.title')} onClose={onClose} />
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="p-4 text-sm text-[var(--slate-400)]">{t('common.loading')}</p>
          ) : versions.length === 0 ? (
            <p className="p-4 text-sm text-[var(--slate-400)]">{t('version.noHistory')}</p>
          ) : (
            <VersionList
              versions={versions}
              onView={handleView}
              onRollback={handleRollback}
            />
          )}
          {snapshot && <SnapshotView snapshot={snapshot} onClose={() => setSnapshot(null)} />}
        </div>
      </div>
      {rollbackId && (
        <ConfirmDialog
          message={t('confirm.rollback')}
          onConfirm={confirmRollback}
          onCancel={() => setRollbackId(null)}
        />
      )}
    </div>
  )
}

function Header({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="h-14 border-b border-[var(--slate-200)] flex items-center justify-between px-5 shrink-0">
      <h2 className="text-base font-semibold text-[var(--slate-800)]">{title}</h2>
      <button onClick={onClose} className="text-[var(--slate-400)] hover:text-[var(--slate-600)]">
        <X size={18} />
      </button>
    </div>
  )
}

function VersionList({
  versions,
  onView,
  onRollback,
}: {
  versions: VersionItem[]
  onView: (id: string) => void
  onRollback: (id: string) => void
}) {
  const { t } = useI18n()
  return (
    <div className="divide-y divide-[var(--slate-100)]">
      {versions.map(v => (
        <div key={v.id} className="px-5 py-3 hover:bg-[var(--slate-50)]">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[var(--slate-700)]">
              {t('version.number')} #{v.version_number}
            </span>
            <span className="text-xs text-[var(--slate-400)]">
              {new Date(v.created_at).toLocaleString()}
            </span>
          </div>
          <div className="text-xs text-[var(--slate-500)] mt-1">
            {v.changed_by} — {v.change_reason}
          </div>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => onView(v.id)}
              className="text-xs text-[var(--safety-blue)] hover:underline flex items-center gap-1"
            >
              <Eye size={12} /> {t('version.viewSnapshot')}
            </button>
            <button
              onClick={() => onRollback(v.id)}
              className="text-xs text-[var(--pending-orange)] hover:underline flex items-center gap-1"
            >
              <RotateCcw size={12} /> {t('version.rollback')}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function SnapshotView({
  snapshot,
  onClose,
}: {
  snapshot: Record<string, unknown>
  onClose: () => void
}) {
  const { t } = useI18n()
  return (
    <div className="border-t border-[var(--slate-200)] p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-[var(--slate-700)]">{t('table.snapshot')}</span>
        <button onClick={onClose} className="text-xs text-[var(--slate-400)] hover:text-[var(--slate-600)]">
          <X size={14} />
        </button>
      </div>
      <pre className="text-xs text-[var(--slate-600)] bg-[var(--slate-50)] rounded-lg p-3 overflow-auto max-h-64 whitespace-pre-wrap">
        {JSON.stringify(snapshot, null, 2)}
      </pre>
    </div>
  )
}
