import { useState, useCallback } from 'react'
import LeftSidebar from '../components/chat/left-sidebar'
import SessionList from '../components/chat/session-list'
import ChatArea from '../components/chat/chat-area'
import RightSidebar from '../components/chat/right-sidebar'
import { getSessionMessages, chatRetrieve } from '../lib/api'
import { useI18n } from '../lib/i18n'

export interface SourceRef {
  type: string
  id: string
  title: string
  relevance_score: number
}

export interface EntityRef {
  entity_type: string
  entity_id: string
  title: string
  confidence: number
  matched_sections?: string[]
}

export interface ContentResult {
  entity_type: string
  entity_id: string
  title: string
  content?: string
  section_title?: string
  ticket_number?: string
  phenomenon?: string
  cause?: string
  solution?: string
  matched_sections?: string[]
}

export interface NearMissItem {
  entity_type: string
  entity_id: string
  title: string
  confidence: number
  snippet: string
}

export interface ChatMessage {
  role: 'user' | 'ai' | 'direct_content' | 'solution' | 'content' | 'refinement' | 'near_miss'
  content: string
  message_id?: string
  sources?: SourceRef[]
  content_items?: ContentResult[]
  solution_data?: {
    symptom: string
    reason: string
    solution: string
    status: string
  }
  content_results?: ContentResult[]
  refinement_options?: { id: string; label: string; description: string; keywords: string[]; refined_query?: string }[]
  refinement_context?: {
    original_query: string
    current_query: string
    refinement_round: number
    max_rounds: number
    near_miss_matches?: NearMissItem[]
  }
  near_miss_results?: {
    entity_type: string
    entity_id: string
    title: string
    confidence: number
    snippet: string
  }[]
  token_usage?: { total_tokens?: number }
  response_time_ms?: number
}

export default function ChatPage() {
  const { t } = useI18n()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sources, setSources] = useState<SourceRef[]>([])
  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID())
  const [selectedContent, setSelectedContent] = useState<ContentResult[] | null>(null)
  const [sidebarLoading, setSidebarLoading] = useState(false)
  const [matchedSections, setMatchedSections] = useState<string[]>([])
  const [rightPanelExpanded, setRightPanelExpanded] = useState(false)
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false)
  const [nearMissSources, setNearMissSources] = useState<NearMissItem[]>([])
  const [highlightQuery, setHighlightQuery] = useState('')

  const handleNewSources = (newSources: SourceRef[]) => {
    setSources(prev => {
      const ids = new Set(prev.map(s => s.id))
      const unique = newSources.filter(s => !ids.has(s.id))
      return [...unique, ...prev].slice(0, 10)
    })
  }

  const handleNewChat = useCallback(() => {
    setSessionId(crypto.randomUUID())
    setMessages([])
    setSources([])
    setNearMissSources([])
    setSelectedContent(null)
    setHighlightQuery('')
  }, [])

  const handleNearMissSources = useCallback((items: NearMissItem[]) => {
    setNearMissSources(items)
  }, [])

  const handleDirectContent = useCallback((items: ContentResult[]) => {
    setSelectedContent(items)
    setRightPanelExpanded(true)
    const sections = items.flatMap(i => i.matched_sections || [])
    setMatchedSections([...new Set(sections)])
  }, [])

  const handleCardClick = useCallback(async (entityRefs: EntityRef[]) => {
    setSidebarLoading(true)
    setRightPanelExpanded(true)
    // Collect matched_sections from all entityRefs for paragraph-level highlighting
    const sections = entityRefs.flatMap(r => r.matched_sections || [])
    setMatchedSections([...new Set(sections)])
    try {
      const data = await chatRetrieve(sessionId, entityRefs)
      setSelectedContent(data.items || [])
    } catch {
      setSelectedContent(null)
    } finally {
      setSidebarLoading(false)
    }
  }, [sessionId])

  const handleSelectSession = useCallback(async (id: string) => {
    try {
      const data = await getSessionMessages(id)
      const loaded: ChatMessage[] = (data.items || []).map((m: any) => ({
        role: m.role === 'assistant' ? 'ai' : m.role,
        content: m.content,
        message_id: m.id,
        sources: m.sources || [],
      }))
      setSessionId(id)
      setMessages(loaded)
      setSources([])
    } catch { /* ignore */ }
  }, [])

  return (
    <div className="flex h-screen bg-[var(--slate-50)]">
      <LeftSidebar />
      <div className="w-56 border-r border-[var(--slate-200)] bg-white shrink-0 flex flex-col">
        <div className="h-16 flex items-center px-4 border-b border-[var(--slate-200)]">
          <span className="text-sm font-semibold text-[var(--slate-700)]">
            {t('session.title')}
          </span>
        </div>
        <SessionList
          currentSessionId={sessionId}
          onSelectSession={handleSelectSession}
          onNewChat={handleNewChat}
        />
      </div>
      <ChatArea
        messages={messages}
        setMessages={setMessages}
        sessionId={sessionId}
        onNewSources={handleNewSources}
        onCardClick={handleCardClick}
        onNearMissSources={handleNearMissSources}
        onDirectContent={handleDirectContent}
        onQueryChange={setHighlightQuery}
      />
      <RightSidebar
        sources={sources}
        nearMissSources={nearMissSources}
        selectedContent={selectedContent}
        sidebarLoading={sidebarLoading}
        matchedSections={matchedSections}
        highlightQuery={highlightQuery}
        expanded={rightPanelExpanded}
        collapsed={rightPanelCollapsed}
        onToggleExpand={() => setRightPanelExpanded(prev => !prev)}
        onToggleCollapse={() => setRightPanelCollapsed(prev => !prev)}
        onCloseContent={() => {
          setSelectedContent(null)
          setMatchedSections([])
          setRightPanelExpanded(false)
        }}
        onNearMissClick={handleCardClick}
      />
    </div>
  )
}
