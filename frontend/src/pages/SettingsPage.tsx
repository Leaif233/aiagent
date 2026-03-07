import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Save, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { getSettings, updateSettings, getSystemStatus } from '../lib/api'
import { useI18n } from '../lib/i18n'
import LeftSidebar from '../components/chat/left-sidebar'
import LangToggle from '../components/ui/lang-toggle'

interface SystemStatus {
  redis: string
  chroma_docs: number
  chroma_tickets: number
  upload_dir: string
  image_dir: string
}

/* ── Shared props ── */
interface SectionProps {
  settings: Record<string, string>
  update: (key: string, value: string) => void
}

/* ── Collapsible wrapper ── */
function CollapsibleSection({
  title,
  desc,
  children,
}: {
  title: string
  desc: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="bg-white rounded-xl border border-[var(--slate-200)] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-[var(--slate-50)] transition-colors"
      >
        <div>
          <h2 className="text-base font-semibold text-[var(--slate-800)]">{title}</h2>
          <p className="text-sm text-[var(--slate-500)] mt-0.5">{desc}</p>
        </div>
        {open ? <ChevronDown size={18} className="text-[var(--slate-400)]" /> : <ChevronRight size={18} className="text-[var(--slate-400)]" />}
      </button>
      {open && <div className="px-6 pb-5 pt-1 border-t border-[var(--slate-100)]">{children}</div>}
    </div>
  )
}

export default function SettingsPage() {
  const { t } = useI18n()
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getSettings().then(setSettings),
      getSystemStatus().then(setStatus),
    ]).finally(() => setLoading(false))
  }, [])

  const update = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateSettings(settings)
      toast.success(t('toast.saved'))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err: any) {
      toast.error(err.message || t('toast.saveFailed'))
    }
    setSaving(false)
  }

  return (
    <div className="flex h-screen bg-[var(--slate-50)]">
      <LeftSidebar />
      <div className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold text-[var(--slate-800)]">
              {t('settings.title')}
            </h1>
            <div className="flex gap-3 items-center">
              <LangToggle />
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--safety-blue)] text-white text-sm font-medium hover:bg-[var(--safety-blue-hover)] transition-colors disabled:opacity-50"
              >
                <Save size={16} />
                {saving ? t('settings.saving') : saved ? t('settings.saved') : t('settings.save')}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-[var(--safety-blue)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                <LLMSection settings={settings} update={update} />
                <TaskRoutingSection settings={settings} update={update} />
                <RAGSection settings={settings} update={update} />
                <SystemSection settings={settings} update={update} status={status} />
                <IngestionSection settings={settings} update={update} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Section 1: LLM Configuration ── */
function LLMSection({ settings, update }: SectionProps) {
  const { t } = useI18n()
  const provider = settings.llm_provider || 'deepseek'
  const threshold = parseFloat(settings.confidence_threshold || '0.85')

  return (
    <CollapsibleSection title={t('settings.llm')} desc={t('settings.llm.desc')}>
      <div className="space-y-5 mt-3">
        {/* Provider radio */}
        <div>
          <label className="block text-sm font-medium text-[var(--slate-700)] mb-2">
            {t('settings.llm.provider')}
          </label>
          <div className="flex gap-4">
            {(['claude', 'deepseek'] as const).map(p => (
              <label key={p} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="llm_provider"
                  checked={provider === p}
                  onChange={() => update('llm_provider', p)}
                  className="accent-[var(--safety-blue)]"
                />
                <span className="text-sm text-[var(--slate-700)] capitalize">{p === 'claude' ? 'Claude' : 'DeepSeek'}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Model name */}
        <div>
          <label className="block text-sm font-medium text-[var(--slate-700)] mb-1">
            {t('settings.llm.model')}
          </label>
          <input
            type="text"
            value={provider === 'claude'
              ? (settings.llm_model_claude || '')
              : (settings.llm_model_deepseek || '')}
            onChange={e => update(
              provider === 'claude' ? 'llm_model_claude' : 'llm_model_deepseek',
              e.target.value
            )}
            className="w-full px-3 py-2 rounded-lg border border-[var(--slate-200)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--safety-blue)] focus:border-transparent"
          />
        </div>

        {/* Confidence threshold slider */}
        <div>
          <label className="block text-sm font-medium text-[var(--slate-700)] mb-1">
            {t('settings.llm.confidence')}
            <span className="ml-2 text-[var(--safety-blue)] font-mono">{threshold.toFixed(2)}</span>
          </label>
          <p className="text-xs text-[var(--slate-400)] mb-2">{t('settings.llm.confidenceDesc')}</p>
          <input
            type="range"
            min="0.5" max="1" step="0.01"
            value={threshold}
            onChange={e => update('confidence_threshold', e.target.value)}
            className="w-full accent-[var(--safety-blue)]"
          />
        </div>

        {/* Max rounds + Max tokens row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[var(--slate-700)] mb-1">
              {t('settings.llm.maxRounds')}
            </label>
            <p className="text-xs text-[var(--slate-400)] mb-2">{t('settings.llm.maxRoundsDesc')}</p>
            <input
              type="number" min="1" max="20"
              value={settings.max_conversation_rounds || '3'}
              onChange={e => update('max_conversation_rounds', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--slate-200)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--safety-blue)] focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--slate-700)] mb-1">
              {t('settings.llm.maxTokens')}
            </label>
            <input
              type="number" min="256" max="8192" step="256"
              value={settings.llm_max_tokens || '2048'}
              onChange={e => update('llm_max_tokens', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--slate-200)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--safety-blue)] focus:border-transparent mt-6"
            />
          </div>
        </div>
      </div>
    </CollapsibleSection>
  )
}

/* ── Section 1.5: Task Routing ── */
const TASK_TYPES = [
  { key: 'text_cleaning', capability: 'text' },
  { key: 'doc_cleaning', capability: 'text' },
  { key: 'multimodal_cleaning', capability: 'vision' },
  { key: 'fingerprint_extraction', capability: 'text' },
  { key: 'guidance_grouping', capability: 'text' },
  { key: 'chat_dialogue', capability: 'text' },
] as const

const PROVIDERS = [
  { value: '', capabilities: ['text', 'vision'] },
  { value: 'claude', capabilities: ['text', 'vision'] },
  { value: 'deepseek', capabilities: ['text'] },
  { value: 'dashscope', capabilities: ['text', 'vision'] },
]

function TaskRoutingSection({ settings, update }: SectionProps) {
  const { t } = useI18n()
  return (
    <CollapsibleSection title={t('settings.taskRouting')} desc={t('settings.taskRouting.desc')}>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[var(--slate-500)] border-b border-[var(--slate-100)]">
              <th className="pb-2 font-medium">{t('settings.taskRouting.task')}</th>
              <th className="pb-2 font-medium">{t('settings.taskRouting.provider')}</th>
              <th className="pb-2 font-medium">{t('settings.taskRouting.model')}</th>
            </tr>
          </thead>
          <tbody>
            {TASK_TYPES.map(({ key, capability }) => {
              const providerKey = `task_route_${key}_provider`
              const modelKey = `task_route_${key}_model`
              const taskLabel = t(`settings.taskRouting.${key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())}` as any) || key
              const availableProviders = PROVIDERS.filter(
                p => p.value === '' || p.capabilities.includes(capability)
              )
              return (
                <tr key={key} className="border-b border-[var(--slate-50)]">
                  <td className="py-2.5 text-[var(--slate-700)]">{taskLabel}</td>
                  <td className="py-2.5 pr-3">
                    <select
                      value={settings[providerKey] || ''}
                      onChange={e => update(providerKey, e.target.value)}
                      className="w-full px-2 py-1.5 rounded border border-[var(--slate-200)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--safety-blue)]"
                    >
                      {availableProviders.map(p => (
                        <option key={p.value} value={p.value}>
                          {p.value === '' ? t('settings.taskRouting.useGlobal') : p.value}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2.5">
                    <input
                      type="text"
                      value={settings[modelKey] || ''}
                      onChange={e => update(modelKey, e.target.value)}
                      placeholder={t('settings.taskRouting.useGlobal')}
                      className="w-full px-2 py-1.5 rounded border border-[var(--slate-200)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--safety-blue)]"
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </CollapsibleSection>
  )
}

/* ── Section 2: RAG Settings ── */
function RAGSection({ settings, update }: SectionProps) {
  const { t } = useI18n()
  return (
    <CollapsibleSection title={t('settings.rag')} desc={t('settings.rag.desc')}>
      <div className="grid grid-cols-2 gap-4 mt-3">
        <div>
          <label className="block text-sm font-medium text-[var(--slate-700)] mb-1">
            {t('settings.rag.chunkSize')}
          </label>
          <input
            type="number" min="500" max="10000" step="100"
            value={settings.chunk_size || '2000'}
            onChange={e => update('chunk_size', e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--slate-200)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--safety-blue)] focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--slate-700)] mb-1">
            {t('settings.rag.topK')}
          </label>
          <input
            type="number" min="1" max="20"
            value={settings.top_k_results || '5'}
            onChange={e => update('top_k_results', e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--slate-200)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--safety-blue)] focus:border-transparent"
          />
        </div>
      </div>

      {/* Embedding provider */}
      <div className="mt-4">
        <label className="block text-sm font-medium text-[var(--slate-700)] mb-2">
          {t('settings.embedding.provider')}
        </label>
        <div className="flex gap-4">
          {(['local', 'dashscope'] as const).map(p => (
            <label key={p} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="embedding_provider"
                checked={(settings.embedding_provider || 'dashscope') === p}
                onChange={() => update('embedding_provider', p)}
                className="accent-[var(--safety-blue)]"
              />
              <span className="text-sm text-[var(--slate-700)]">
                {p === 'local' ? 'Local (sentence-transformers)' : 'DashScope'}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Embedding model */}
      <div className="mt-3">
        <label className="block text-sm font-medium text-[var(--slate-700)] mb-1">
          {t('settings.embedding.model')}
        </label>
        <input
          type="text"
          value={(settings.embedding_provider || 'dashscope') === 'local'
            ? (settings.embedding_model_local || 'all-MiniLM-L6-v2')
            : (settings.embedding_model_dashscope || 'text-embedding-v3')}
          onChange={e => update(
            (settings.embedding_provider || 'dashscope') === 'local'
              ? 'embedding_model_local' : 'embedding_model_dashscope',
            e.target.value
          )}
          className="w-full px-3 py-2 rounded-lg border border-[var(--slate-200)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--safety-blue)] focus:border-transparent"
        />
      </div>

      {/* Near-miss threshold slider */}
      <div className="mt-4">
        <label className="block text-sm font-medium text-[var(--slate-700)] mb-1">
          近似匹配阈值 / Near-Miss Threshold
          <span className="ml-2 text-amber-600 font-mono">
            {parseFloat(settings.near_miss_threshold || '0.15').toFixed(2)}
          </span>
        </label>
        <p className="text-xs text-[var(--slate-400)] mb-2">
          低于此值的结果将被丢弃，介于此值与置信度阈值之间的结果进入渐进引导流程
        </p>
        <input
          type="range"
          min="0.05" max="0.80" step="0.01"
          value={parseFloat(settings.near_miss_threshold || '0.15')}
          onChange={e => update('near_miss_threshold', e.target.value)}
          className="w-full accent-amber-500"
        />
      </div>

      {/* Max refinement rounds */}
      <div className="mt-4">
        <label className="block text-sm font-medium text-[var(--slate-700)] mb-1">
          最大细化轮次 / Max Refinement Rounds
        </label>
        <input
          type="number" min="1" max="10"
          value={settings.max_refinement_rounds || '3'}
          onChange={e => update('max_refinement_rounds', e.target.value)}
          className="w-24 px-3 py-2 rounded-lg border border-[var(--slate-200)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--safety-blue)] focus:border-transparent"
        />
      </div>
    </CollapsibleSection>
  )
}

/* ── Section 3: System Integrations ── */
function SystemSection({
  settings,
  update,
  status,
}: SectionProps & { status: SystemStatus | null }) {
  const { t } = useI18n()
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})

  const toggleShow = (key: string) =>
    setShowKeys(prev => ({ ...prev, [key]: !prev[key] }))

  const apiKeys = [
    { key: 'anthropic_api_key', label: t('settings.system.anthropicKey') },
    { key: 'deepseek_api_key', label: t('settings.system.deepseekKey') },
    { key: 'dashscope_api_key', label: t('settings.system.dashscopeKey') },
  ]

  return (
    <CollapsibleSection title={t('settings.system')} desc={t('settings.system.desc')}>
      <div className="space-y-4 mt-3">
        {/* API Keys */}
        {apiKeys.map(({ key, label }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-[var(--slate-700)] mb-1">
              {label}
            </label>
            <div className="relative">
              <input
                type={showKeys[key] ? 'text' : 'password'}
                value={settings[key] || ''}
                onChange={e => update(key, e.target.value)}
                className="w-full px-3 py-2 pr-10 rounded-lg border border-[var(--slate-200)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--safety-blue)] focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => toggleShow(key)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--slate-400)] hover:text-[var(--slate-600)]"
              >
                {showKeys[key] ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        ))}

        {/* System Status */}
        {status && (
          <div className="mt-5 pt-4 border-t border-[var(--slate-100)]">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between px-3 py-2 bg-[var(--slate-50)] rounded-lg">
                <span className="text-sm text-[var(--slate-600)]">{t('settings.system.redis')}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  status.redis === 'connected'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {status.redis === 'connected' ? t('settings.system.connected') : t('settings.system.disconnected')}
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-2 bg-[var(--slate-50)] rounded-lg">
                <span className="text-sm text-[var(--slate-600)]">{t('settings.system.chromaDocs')}</span>
                <span className="text-sm font-mono font-medium text-[var(--slate-800)]">{status.chroma_docs}</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2 bg-[var(--slate-50)] rounded-lg">
                <span className="text-sm text-[var(--slate-600)]">{t('settings.system.chromaTickets')}</span>
                <span className="text-sm font-mono font-medium text-[var(--slate-800)]">{status.chroma_tickets}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </CollapsibleSection>
  )
}

/* ── Section 4: Ingestion Rules ── */
function IngestionSection({ settings, update }: SectionProps) {
  const { t } = useI18n()
  const imageOn = (settings.image_processing || 'true') === 'true'

  return (
    <CollapsibleSection title={t('settings.ingestion')} desc={t('settings.ingestion.desc')}>
      <div className="space-y-4 mt-3">
        {/* Cleaning prompt */}
        <div>
          <label className="block text-sm font-medium text-[var(--slate-700)] mb-1">
            {t('settings.ingestion.prompt')}
          </label>
          <textarea
            rows={4}
            value={settings.cleaning_prompt || ''}
            onChange={e => update('cleaning_prompt', e.target.value)}
            placeholder={t('settings.ingestion.promptPlaceholder')}
            className="w-full px-3 py-2 rounded-lg border border-[var(--slate-200)] text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[var(--safety-blue)] focus:border-transparent"
          />
        </div>

        {/* Image processing toggle */}
        <div>
          <label className="block text-sm font-medium text-[var(--slate-700)] mb-2">
            {t('settings.ingestion.imageProcessing')}
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="image_processing"
                checked={imageOn}
                onChange={() => update('image_processing', 'true')}
                className="accent-[var(--safety-blue)]"
              />
              <span className="text-sm text-[var(--slate-700)]">
                {t('settings.ingestion.imageOn')}
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="image_processing"
                checked={!imageOn}
                onChange={() => update('image_processing', 'false')}
                className="accent-[var(--safety-blue)]"
              />
              <span className="text-sm text-[var(--slate-700)]">
                {t('settings.ingestion.imageOff')}
              </span>
            </label>
          </div>
        </div>
      </div>
    </CollapsibleSection>
  )
}
