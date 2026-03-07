import { useMemo } from 'react'
import { FileText, Ticket, X, Loader2, Search, Zap, CheckCircle, PanelRightClose, PanelRightOpen, AlertTriangle } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import type { SourceRef, ContentResult, NearMissItem } from '../../pages/ChatPage'
import { useI18n } from '../../lib/i18n'
import { extractKeywords, HighlightText } from '../../lib/highlight'

interface Props {
  sources: SourceRef[]
  nearMissSources?: NearMissItem[]
  selectedContent?: ContentResult[] | null
  sidebarLoading?: boolean
  onCloseContent?: () => void
  matchedSections?: string[]
  highlightQuery?: string
  expanded?: boolean
  collapsed?: boolean
  onToggleExpand?: () => void
  onToggleCollapse?: () => void
  onNearMissClick?: (entityRefs: { entity_type: string; entity_id: string; title: string; confidence: number }[]) => void
}

export default function RightSidebar({ sources, nearMissSources = [], selectedContent, sidebarLoading, onCloseContent, matchedSections = [], highlightQuery = '', expanded, collapsed, onToggleExpand, onToggleCollapse, onNearMissClick }: Props) {
  const docs = sources.filter(s => s.type === 'doc')
  const tickets = sources.filter(s => s.type === 'ticket')
  const { t } = useI18n()
  const showDetail = sidebarLoading || (selectedContent && selectedContent.length > 0)
  const hasNearMiss = nearMissSources.length > 0

  const widthClass = collapsed ? 'w-12' : expanded ? 'w-[480px]' : 'w-80'

  if (collapsed) {
    return (
      <aside className={`${widthClass} border-l border-[var(--slate-200)] bg-white flex flex-col items-center pt-4 shrink-0 transition-all duration-300 ease-in-out`}>
        <button onClick={onToggleCollapse} className="p-1.5 rounded-lg hover:bg-[var(--slate-100)] text-[var(--slate-400)]">
          <PanelRightOpen size={18} />
        </button>
      </aside>
    )
  }

  return (
    <aside className={`${widthClass} border-l border-[var(--slate-200)] bg-white flex flex-col shrink-0 overflow-y-auto transition-all duration-300 ease-in-out`}>
      {/* Header */}
      <div className="h-16 flex items-center px-5 border-b border-[var(--slate-200)]">
        <h2 className="text-sm font-semibold text-[var(--slate-800)]">
          {showDetail ? '内容详情' : hasNearMiss ? t('ref.nearMissTitle') : t('ref.title')}
        </h2>
        <div className="ml-auto flex items-center gap-1">
          {showDetail && onToggleExpand && (
            <button onClick={onToggleExpand} className="p-1 hover:bg-[var(--slate-100)] rounded text-[var(--slate-400)]" title={expanded ? '收起' : '展开'}>
              {expanded ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
            </button>
          )}
          {onToggleCollapse && (
            <button onClick={onToggleCollapse} className="p-1 hover:bg-[var(--slate-100)] rounded text-[var(--slate-400)]" title="折叠面板">
              <PanelRightClose size={16} />
            </button>
          )}
          {showDetail && onCloseContent && (
            <button onClick={onCloseContent} className="p-1 hover:bg-[var(--slate-100)] rounded">
              <X size={16} className="text-[var(--slate-500)]" />
            </button>
          )}
        </div>
      </div>

      {sidebarLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-[var(--safety-blue)]" />
        </div>
      ) : showDetail ? (
        <ContentDetailView items={selectedContent!} matchedSections={matchedSections} highlightQuery={highlightQuery} />
      ) : hasNearMiss ? (
        <NearMissListView items={nearMissSources} onItemClick={onNearMissClick} t={t} />
      ) : (
        <SourceListView docs={docs} tickets={tickets} t={t} />
      )}
    </aside>
  )
}

function Section({
  icon,
  title,
  items,
}: {
  icon: React.ReactNode
  title: string
  items: SourceRef[]
}) {
  const { t } = useI18n()

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-xs font-semibold text-[var(--slate-500)] uppercase">
          {title}
        </h3>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-[var(--slate-400)]">{t('ref.noItems')}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="p-3 rounded-lg border border-[var(--slate-200)] hover:border-[var(--safety-blue)] transition-colors cursor-pointer"
            >
              <p className="text-sm font-medium text-[var(--slate-700)] truncate">
                {item.title}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--verified-green-light)] text-[var(--verified-green)] font-medium">
                  {t('ref.verified')}
                </span>
                <span className="text-xs text-[var(--slate-400)]">
                  {Math.round(item.relevance_score * 100)}% {t('ref.match')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SourceListView({ docs, tickets, t }: { docs: SourceRef[]; tickets: SourceRef[]; t: (k: any) => string }) {
  return (
    <div className="p-4 space-y-6">
      <Section
        icon={<FileText size={16} className="text-[var(--safety-blue)]" />}
        title={t('ref.techDocs')}
        items={docs}
      />
      <Section
        icon={<Ticket size={16} className="text-[var(--pending-orange)]" />}
        title={t('ref.relatedTickets')}
        items={tickets}
      />
    </div>
  )
}

function ContentDetailView({ items, matchedSections = [], highlightQuery = '' }: { items: ContentResult[]; matchedSections?: string[]; highlightQuery?: string }) {
  const keywords = useMemo(() => extractKeywords(highlightQuery), [highlightQuery])
  return (
    <div className="p-4 space-y-4">
      {items.map((item, i) => (
        <DetailCard key={`${item.entity_id}-${i}`} item={item} matchedSections={item.matched_sections || matchedSections} keywords={keywords} />
      ))}
    </div>
  )
}

/** Split markdown content into sections by headings (# / ## / ###).
 *  Returns array of { heading, content, isMatched }. */
function splitIntoSections(markdown: string, matchedSections: string[]): { heading: string; content: string; isMatched: boolean }[] {
  if (!markdown) return []
  const lines = markdown.split('\n')
  const sections: { heading: string; content: string; isMatched: boolean }[] = []
  let currentHeading = ''
  let currentLines: string[] = []

  const flush = () => {
    const content = currentLines.join('\n').trim()
    if (content || currentHeading) {
      const isMatched = currentHeading
        ? matchedSections.some(s => currentHeading.includes(s) || s.includes(currentHeading))
        : false
      sections.push({ heading: currentHeading, content, isMatched })
    }
  }

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,3}\s+(.+)/)
    if (headingMatch) {
      flush()
      currentHeading = headingMatch[1].trim()
      currentLines = []
    } else {
      currentLines.push(line)
    }
  }
  flush()
  return sections
}

function DetailCard({ item, matchedSections = [], keywords = [] }: { item: ContentResult; matchedSections?: string[]; keywords?: string[] }) {
  if (item.entity_type === 'ticket') {
    return (
      <div className="rounded-lg border border-[var(--slate-200)] overflow-hidden">
        <div className="bg-emerald-50 px-4 py-2.5 flex items-center gap-2">
          <Ticket size={14} className="text-emerald-600" />
          <span className="text-xs font-semibold text-emerald-700">
            {item.ticket_number || item.title}
          </span>
        </div>
        <div className="px-4 py-3 space-y-3 text-sm">
          {item.phenomenon && (
            <div className="rounded-lg bg-blue-50 p-3 border-l-4 border-blue-400">
              <div className="flex items-center gap-1.5 mb-1">
                <Search size={12} className="text-blue-500" />
                <p className="text-xs font-semibold text-blue-600">现象</p>
              </div>
              <p className="text-[var(--slate-700)] leading-relaxed"><HighlightText text={item.phenomenon} keywords={keywords} /></p>
            </div>
          )}
          {item.cause && (
            <div className="rounded-lg bg-orange-50 p-3 border-l-4 border-orange-400">
              <div className="flex items-center gap-1.5 mb-1">
                <Zap size={12} className="text-orange-500" />
                <p className="text-xs font-semibold text-orange-600">原因</p>
              </div>
              <p className="text-[var(--slate-700)] leading-relaxed"><HighlightText text={item.cause} keywords={keywords} /></p>
            </div>
          )}
          {item.solution && (
            <div className="rounded-lg bg-green-50 p-3 border-l-4 border-green-400">
              <div className="flex items-center gap-1.5 mb-1">
                <CheckCircle size={12} className="text-green-500" />
                <p className="text-xs font-semibold text-green-600">对策</p>
              </div>
              <p className="text-[var(--slate-700)] leading-relaxed"><HighlightText text={item.solution} keywords={keywords} /></p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Document type — section-based paragraph highlighting
  const sections = splitIntoSections(item.content || '', matchedSections)
  const hasMatches = matchedSections.length > 0 && sections.some(s => s.isMatched)

  // Inject <mark> tags into markdown for keyword highlighting
  const highlightMarkdown = (md: string) => {
    if (!keywords.length || !md) return md
    const escaped = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    const pattern = new RegExp(`(${escaped.join('|')})`, 'gi')
    return md.replace(pattern, '<mark class="bg-yellow-200 text-inherit rounded-sm px-0.5">$1</mark>')
  }

  return (
    <div className="rounded-lg border border-[var(--slate-200)] overflow-hidden border-l-4 border-l-blue-400">
      <div className="bg-blue-50 px-4 py-2.5 flex items-center gap-2">
        <FileText size={14} className="text-blue-600" />
        <span className="text-xs font-semibold text-blue-700 truncate">
          {item.title}
        </span>
      </div>
      <div className="px-4 py-3 text-sm prose prose-sm prose-slate max-w-none max-h-[500px] overflow-y-auto leading-relaxed [&_mark]:bg-yellow-200 [&_mark]:text-inherit [&_mark]:rounded-sm [&_mark]:px-0.5">
        {hasMatches ? (
          sections.map((sec, i) => (
            <div
              key={i}
              className={sec.isMatched
                ? 'bg-yellow-50 border-l-4 border-yellow-400 pl-3 py-1 my-2 rounded-r'
                : 'my-2'
              }
            >
              {sec.heading && <h3 className="font-semibold text-[var(--slate-800)] mb-1">{sec.heading}</h3>}
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{highlightMarkdown(sec.content)}</ReactMarkdown>
            </div>
          ))
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
            {highlightMarkdown(item.content || '')}
          </ReactMarkdown>
        )}
      </div>
    </div>
  )
}

function NearMissListView({
  items,
  onItemClick,
  t,
}: {
  items: NearMissItem[]
  onItemClick?: (entityRefs: { entity_type: string; entity_id: string; title: string; confidence: number }[]) => void
  t: (k: any) => string
}) {
  const docs = items.filter(i => i.entity_type === 'doc')
  const tickets = items.filter(i => i.entity_type === 'ticket')

  return (
    <div className="p-4 space-y-4">
      <div className="bg-amber-50 border border-dashed border-amber-300 rounded-lg px-3 py-2 flex items-center gap-2">
        <AlertTriangle size={14} className="text-amber-500 shrink-0" />
        <span className="text-xs text-amber-700">{t('ref.nearMissHint')}</span>
      </div>
      {docs.length > 0 && (
        <NearMissSection
          icon={<FileText size={16} className="text-amber-600" />}
          title={t('ref.techDocs')}
          items={docs}
          onItemClick={onItemClick}
          t={t}
        />
      )}
      {tickets.length > 0 && (
        <NearMissSection
          icon={<Ticket size={16} className="text-amber-600" />}
          title={t('ref.relatedTickets')}
          items={tickets}
          onItemClick={onItemClick}
          t={t}
        />
      )}
    </div>
  )
}

function NearMissSection({
  icon,
  title,
  items,
  onItemClick,
  t,
}: {
  icon: React.ReactNode
  title: string
  items: NearMissItem[]
  onItemClick?: (entityRefs: { entity_type: string; entity_id: string; title: string; confidence: number }[]) => void
  t: (k: any) => string
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-xs font-semibold text-amber-700 uppercase">{title}</h3>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <button
            key={`${item.entity_type}-${item.entity_id}`}
            onClick={() => onItemClick?.([{
              entity_type: item.entity_type,
              entity_id: item.entity_id,
              title: item.title,
              confidence: item.confidence,
            }])}
            className="w-full text-left p-3 rounded-lg border border-dashed border-amber-300 hover:border-amber-500 hover:bg-amber-50 transition-colors cursor-pointer group"
          >
            <p className="text-sm font-medium text-[var(--slate-700)] truncate group-hover:text-amber-800">
              {item.title}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                {t('ref.nearMissLabel')}
              </span>
              <span className="text-xs text-amber-600">
                {Math.round(item.confidence * 100)}% {t('ref.match')}
              </span>
            </div>
            {item.snippet && (
              <p className="text-xs text-[var(--slate-400)] mt-1.5 line-clamp-2">{item.snippet}</p>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

