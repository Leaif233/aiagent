import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, X, RefreshCw, History } from 'lucide-react'
import toast from 'react-hot-toast'
import { getTicket, updateTicket, approveTicket, rejectTicket, recleanTicket } from '../lib/api'
import { useI18n } from '../lib/i18n'
import LeftSidebar from '../components/chat/left-sidebar'
import LangToggle from '../components/ui/lang-toggle'
import VersionHistory from '../components/admin/version-history'
import ProgressFunnel from '../components/ui/progress-funnel'

interface TicketData {
  id: string
  ticket_number: string
  status: string
  raw_content: string
  phenomenon: string
  cause: string
  solution: string
  created_at: string
  updated_at: string
}

export default function TicketReviewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useI18n()
  const [ticket, setTicket] = useState<TicketData | null>(null)
  const [phenomenon, setPhenomenon] = useState('')
  const [cause, setCause] = useState('')
  const [solution, setSolution] = useState('')
  const [saving, setSaving] = useState(false)
  const [showVersions, setShowVersions] = useState(false)

  useEffect(() => {
    if (id) {
      getTicket(id).then((t) => {
        setTicket(t)
        setPhenomenon(t.phenomenon || '')
        setCause(t.cause || '')
        setSolution(t.solution || '')
      })
    }
  }, [id])

  if (!ticket) {
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
      await updateTicket(ticket.id, { phenomenon, cause, solution })
      toast.success(t('toast.saved'))
    } catch (err: any) {
      toast.error(err.message || t('toast.saveFailed'))
    }
    setSaving(false)
  }

  const handleApprove = async () => {
    try {
      await updateTicket(ticket.id, { phenomenon, cause, solution })
      await approveTicket(ticket.id)
      toast.success(t('toast.approved'))
      navigate('/admin')
    } catch (err: any) {
      toast.error(err.message || t('toast.approveFailed'))
    }
  }

  const handleReject = async () => {
    try {
      await rejectTicket(ticket.id)
      toast.success(t('toast.rejected'))
      navigate('/admin')
    } catch (err: any) {
      toast.error(err.message || t('toast.rejectFailed'))
    }
  }

  const handleReclean = async () => {
    try {
      await recleanTicket(ticket.id)
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
        <TicketHeader
          ticketNumber={ticket.ticket_number}
          status={ticket.status}
          saving={saving}
          onBack={() => navigate('/admin')}
          onSave={handleSave}
          onApprove={handleApprove}
          onReject={handleReject}
          onReclean={handleReclean}
          onShowVersions={() => setShowVersions(true)}
        />
        <div className="px-6 border-b border-[var(--slate-200)] bg-white">
          <ProgressFunnel currentStatus={ticket.status} entityType="ticket" />
        </div>
        <TicketSideBySide
          rawContent={ticket.raw_content}
          phenomenon={phenomenon}
          cause={cause}
          solution={solution}
          onPhenomenonChange={setPhenomenon}
          onCauseChange={setCause}
          onSolutionChange={setSolution}
        />
      </div>
      {showVersions && id && (
        <VersionHistory
          entityType="ticket"
          entityId={id}
          onClose={() => setShowVersions(false)}
          onRollback={() => {
            setShowVersions(false)
            getTicket(id).then(t => {
              setTicket(t)
              setPhenomenon(t.phenomenon || '')
              setCause(t.cause || '')
              setSolution(t.solution || '')
            })
          }}
        />
      )}
    </div>
  )
}

function TicketHeader({
  ticketNumber,
  status,
  saving,
  onBack,
  onSave,
  onApprove,
  onReject,
  onReclean,
  onShowVersions,
}: {
  ticketNumber: string
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
      <h1 className="text-lg font-semibold text-[var(--slate-800)]">{ticketNumber}</h1>
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

function TicketSideBySide({
  rawContent,
  phenomenon,
  cause,
  solution,
  onPhenomenonChange,
  onCauseChange,
  onSolutionChange,
}: {
  rawContent: string
  phenomenon: string
  cause: string
  solution: string
  onPhenomenonChange: (v: string) => void
  onCauseChange: (v: string) => void
  onSolutionChange: (v: string) => void
}) {
  const { t } = useI18n()
  return (
    <div className="flex-1 flex min-h-0">
      {/* Left: Raw ticket */}
      <div className="w-1/2 border-r border-[var(--slate-200)] flex flex-col">
        <div className="px-4 py-3 border-b border-[var(--slate-200)] bg-[var(--slate-50)]">
          <h3 className="text-sm font-semibold text-[var(--slate-600)]">{t('review.rawTicket')}</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <pre className="text-sm text-[var(--slate-700)] whitespace-pre-wrap font-mono leading-relaxed">
            {rawContent || t('review.noContent')}
          </pre>
        </div>
      </div>

      {/* Right: Extracted fields */}
      <div className="w-1/2 flex flex-col">
        <div className="px-4 py-3 border-b border-[var(--slate-200)] bg-[var(--slate-50)]">
          <h3 className="text-sm font-semibold text-[var(--slate-600)]">{t('review.extractedFields')}</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <FieldEditor label={t('review.phenomenon')} value={phenomenon} onChange={onPhenomenonChange} />
          <FieldEditor label={t('review.rootCause')} value={cause} onChange={onCauseChange} />
          <FieldEditor label={t('review.solution')} value={solution} onChange={onSolutionChange} />
        </div>
      </div>
    </div>
  )
}

function FieldEditor({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[var(--slate-600)] mb-1.5">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="w-full rounded-lg border border-[var(--slate-200)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--safety-blue)] focus:ring-1 focus:ring-[var(--safety-blue)] resize-none"
      />
    </div>
  )
}
