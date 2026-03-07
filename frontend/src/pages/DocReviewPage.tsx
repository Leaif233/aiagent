import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, X, RefreshCw, History, Eye, Pencil } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import toast from 'react-hot-toast'
import { getDoc, updateDoc, approveDoc, rejectDoc, recleanDoc } from '../lib/api'
import { useI18n } from '../lib/i18n'
import LeftSidebar from '../components/chat/left-sidebar'
import LangToggle from '../components/ui/lang-toggle'
import VersionHistory from '../components/admin/version-history'
import ProgressFunnel from '../components/ui/progress-funnel'

interface DocData {
  id: string
  title: string
  category: string
  status: string
  raw_content: string
  cleaned_content: string
  image_assets: string
  source_file: string
  created_at: string
  updated_at: string
}

export default function DocReviewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useI18n()
  const [doc, setDoc] = useState<DocData | null>(null)
  const [editedContent, setEditedContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [showVersions, setShowVersions] = useState(false)

  useEffect(() => {
    if (id) {
      getDoc(id).then((d) => {
        setDoc(d)
        setEditedContent(d.cleaned_content || '')
      })
    }
  }, [id])

  if (!doc) {
    return (
      <div className="flex h-screen">
        <LeftSidebar />
        <div className="flex-1 flex items-center justify-center text-[var(--slate-400)]">
          {t('common.loading')}
        </div>
      </div>
    )
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateDoc(doc.id, { cleaned_content: editedContent })
      toast.success(t('toast.saved'))
    } catch (err: any) {
      toast.error(err.message || t('toast.saveFailed'))
    }
    setSaving(false)
  }

  const handleApprove = async () => {
    try {
      await updateDoc(doc.id, { cleaned_content: editedContent })
      await approveDoc(doc.id)
      toast.success(t('toast.approved'))
      navigate('/admin')
    } catch (err: any) {
      toast.error(err.message || t('toast.approveFailed'))
    }
  }

  const handleReject = async () => {
    try {
      await rejectDoc(doc.id)
      toast.success(t('toast.rejected'))
      navigate('/admin')
    } catch (err: any) {
      toast.error(err.message || t('toast.rejectFailed'))
    }
  }

  const handleReclean = async () => {
    try {
      await recleanDoc(doc.id)
      toast.success(t('toast.recleanStarted'))
      navigate('/admin')
    } catch (err: any) {
      toast.error(err.message || t('toast.recleanFailed'))
    }
  }

  return (
    <div className="flex h-screen bg-[var(--slate-50)]">
      <LeftSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <ReviewHeader
          title={doc.title}
          status={doc.status}
          saving={saving}
          onBack={() => navigate('/admin')}
          onSave={handleSave}
          onApprove={handleApprove}
          onReject={handleReject}
          onReclean={handleReclean}
          onShowVersions={() => setShowVersions(true)}
        />
        <div className="px-6 border-b border-[var(--slate-200)] bg-white">
          <ProgressFunnel currentStatus={doc.status} entityType="doc" />
        </div>
        <SideBySide
          rawContent={doc.raw_content}
          editedContent={editedContent}
          onEditChange={setEditedContent}
        />
      </div>
      {showVersions && id && (
        <VersionHistory
          entityType="document"
          entityId={id}
          onClose={() => setShowVersions(false)}
          onRollback={() => {
            setShowVersions(false)
            getDoc(id).then(d => {
              setDoc(d)
              setEditedContent(d.cleaned_content || '')
            })
          }}
        />
      )}
    </div>
  )
}

function ReviewHeader({
  title,
  status,
  saving,
  onBack,
  onSave,
  onApprove,
  onReject,
  onReclean,
  onShowVersions,
}: {
  title: string
  status: string
  saving: boolean
  onBack: () => void
  onSave: () => void
  onApprove: () => void
  onReject: () => void
  onReclean: () => void
  onShowVersions: () => void
}) {
  const { t } = useI18n()
  const statusColor =
    status === '已审核' ? 'var(--verified-green)' :
    status === '已驳回' ? 'var(--rejected-red)' :
    'var(--pending-orange)'

  return (
    <header className="h-16 border-b border-[var(--slate-200)] bg-white flex items-center px-6 gap-4 shrink-0">
      <button onClick={onBack} className="text-[var(--slate-500)] hover:text-[var(--slate-700)]">
        <ArrowLeft size={20} />
      </button>
      <h1 className="text-lg font-semibold text-[var(--slate-800)] truncate">{title}</h1>
      <span
        className="text-xs font-medium px-2 py-0.5 rounded-full"
        style={{ color: statusColor, backgroundColor: statusColor + '20' }}
      >
        {status}
      </span>
      <div className="ml-auto flex gap-2">
        <button onClick={onShowVersions}
          className="px-3 py-1.5 text-sm border border-[var(--slate-300)] rounded-lg hover:bg-[var(--slate-100)] flex items-center gap-1">
          <History size={14} /> {t('version.title')}
        </button>
        <button onClick={onSave} disabled={saving}
          className="px-3 py-1.5 text-sm border border-[var(--slate-300)] rounded-lg hover:bg-[var(--slate-100)] disabled:opacity-50">
          {saving ? t('review.saving') : t('review.save')}
        </button>
        <button onClick={onReclean}
          className="px-3 py-1.5 text-sm border border-[var(--slate-300)] rounded-lg hover:bg-[var(--slate-100)] flex items-center gap-1">
          <RefreshCw size={14} /> {t('review.reclean')}
        </button>
        <button onClick={onReject}
          className="px-3 py-1.5 text-sm bg-[var(--rejected-red)] text-white rounded-lg hover:opacity-90 flex items-center gap-1">
          <X size={14} /> {t('review.reject')}
        </button>
        <button onClick={onApprove}
          className="px-3 py-1.5 text-sm bg-[var(--verified-green)] text-white rounded-lg hover:opacity-90 flex items-center gap-1">
          <Check size={14} /> {t('review.approve')}
        </button>
      </div>
    </header>
  )
}

function SideBySide({
  rawContent,
  editedContent,
  onEditChange,
}: {
  rawContent: string
  editedContent: string
  onEditChange: (v: string) => void
}) {
  const { t } = useI18n()
  const [previewMode, setPreviewMode] = useState(false)
  return (
    <div className="flex-1 flex min-h-0">
      {/* Left: Original */}
      <div className="w-1/2 border-r border-[var(--slate-200)] flex flex-col">
        <div className="px-4 py-3 border-b border-[var(--slate-200)] bg-[var(--slate-50)]">
          <h3 className="text-sm font-semibold text-[var(--slate-600)]">{t('review.originalContent')}</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {rawContent ? (
            <div className="prose prose-sm max-w-none text-[var(--slate-700)]">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {rawContent}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-[var(--slate-400)]">{t('review.noContent')}</p>
          )}
        </div>
      </div>

      {/* Right: Cleaned / Editable */}
      <div className="w-1/2 flex flex-col">
        <div className="px-4 py-3 border-b border-[var(--slate-200)] bg-[var(--slate-50)] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--slate-600)]">{t('review.aiCleaned')}</h3>
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-[var(--slate-300)] hover:bg-[var(--slate-100)] text-[var(--slate-600)]"
          >
            {previewMode ? <><Pencil size={12} /> 编辑</> : <><Eye size={12} /> 预览</>}
          </button>
        </div>
        {previewMode ? (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="prose prose-sm max-w-none text-[var(--slate-700)]">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {editedContent}
              </ReactMarkdown>
            </div>
          </div>
        ) : (
          <textarea
            value={editedContent}
            onChange={(e) => onEditChange(e.target.value)}
            className="flex-1 p-4 text-sm text-[var(--slate-700)] resize-none focus:outline-none font-mono leading-relaxed"
          />
        )}
      </div>
    </div>
  )
}
