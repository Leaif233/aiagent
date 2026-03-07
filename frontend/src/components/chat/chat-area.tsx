import { useState, useRef, useEffect } from 'react'
import { Send } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { chatSend, chatRefine, getLlmStatus } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import type { ChatMessage, SourceRef, EntityRef, ContentResult, NearMissItem } from '../../pages/ChatPage'
import VerifiedSolution from './verified-solution'
import ContentDisplay from './content-display'
import ProgressiveRefinement from './progressive-refinement'
import NearMissDisplay from './near-miss-display'
import MessageFeedback from './message-feedback'
import SourceTrace from './source-trace'
import FeedbackTicketDialog from './feedback-ticket-dialog'
import LangToggle from '../ui/lang-toggle'

interface Props {
  messages: ChatMessage[]
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
  sessionId: string
  onNewSources: (sources: SourceRef[]) => void
  onCardClick: (entityRefs: EntityRef[]) => void
  onNearMissSources: (items: NearMissItem[]) => void
  onDirectContent: (items: ContentResult[]) => void
  onQueryChange?: (query: string) => void
}

export default function ChatArea({ messages, setMessages, sessionId, onNewSources, onCardClick, onNearMissSources, onDirectContent, onQueryChange }: Props) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingPhase, setLoadingPhase] = useState<'idle' | 'initial' | 'initial-deep' | 'refining'>('idle')
  const [reportMsgId, setReportMsgId] = useState<string | null>(null)
  const [llmInfo, setLlmInfo] = useState<{ provider: string; model: string; configured: boolean } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const { t } = useI18n()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    getLlmStatus().then(setLlmInfo).catch(() => {})
  }, [])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setLoading(true)
    setLoadingPhase('initial')
    onQueryChange?.(text)

    // 2秒后如果仍在等待，切换为深度分析提示
    const deepTimer = setTimeout(() => {
      setLoadingPhase('initial-deep')
    }, 2000)

    try {
      const data = await chatSend(sessionId, text)
      clearTimeout(deepTimer)
      const msg = buildChatMessage(data)
      setMessages(prev => [...prev, msg])
      if (data.sources?.length) onNewSources(data.sources)
      // Emit near-miss items for right sidebar on Stage 4, clear on other stages
      if (data.stage === 4 && data.near_miss_results?.length) {
        onNearMissSources(data.near_miss_results)
      } else {
        onNearMissSources([])
      }
      // Stage 1: auto-display content in right sidebar
      if (data.stage === 1 && data.content_items?.length) {
        onDirectContent(data.content_items)
      }
    } catch {
      clearTimeout(deepTimer)
      setMessages(prev => [...prev, { role: 'ai', content: t('chat.error') }])
    } finally {
      setLoading(false)
      setLoadingPhase('idle')
    }
  }

  const buildChatMessage = (data: any): ChatMessage => ({
    role: data.stage === 1 ? 'direct_content'
      : data.stage === 3 ? 'solution'
      : data.stage === 4 ? 'refinement'
      : data.stage === 5 ? 'near_miss'
      : 'ai',
    content: data.reply,
    message_id: data.message_id,
    sources: data.sources,
    content_items: data.content_items,
    solution_data: data.solution_data,
    refinement_options: data.refinement_options,
    refinement_context: data.refinement_context,
    near_miss_results: data.near_miss_results,
    token_usage: data.token_usage || undefined,
    response_time_ms: data.response_time_ms || undefined,
  })

  const handleRefine = async (
    optionLabel: string,
    customInput: string,
    context: { original_query: string; current_query: string; refinement_round: number; max_rounds: number },
    keywords: string[] = [],
    refinedQuery: string = '',
  ) => {
    if (loading) return
    const userText = optionLabel || customInput
    setMessages(prev => [...prev, { role: 'user', content: userText }])
    setLoading(true)
    setLoadingPhase('refining')
    onQueryChange?.(context.original_query + ' ' + userText)
    try {
      const data = await chatRefine(
        sessionId,
        context.original_query,
        optionLabel,
        customInput,
        context.refinement_round,
        keywords,
        refinedQuery,
      )
      const msg = buildChatMessage(data)
      setMessages(prev => [...prev, msg])
      if (data.sources?.length) onNewSources(data.sources)
      // Update near-miss sidebar on refinement result
      if (data.stage === 4 && data.near_miss_results?.length) {
        onNearMissSources(data.near_miss_results)
      } else {
        onNearMissSources([])
      }
      // Stage 1: auto-display content in right sidebar
      if (data.stage === 1 && data.content_items?.length) {
        onDirectContent(data.content_items)
      }
    } catch {
      setMessages(prev => [...prev, { role: 'ai', content: t('chat.error') }])
    } finally {
      setLoading(false)
      setLoadingPhase('idle')
    }
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <header className="h-16 border-b border-[var(--slate-200)] bg-white flex items-center px-6">
        <h1 className="text-lg font-semibold text-[var(--slate-800)]">
          {t('chat.title')}
        </h1>
        {llmInfo && (
          <div className="flex items-center gap-1.5 ml-4 text-xs text-[var(--slate-500)]">
            <span className={`w-2 h-2 rounded-full ${llmInfo.configured ? 'bg-green-500' : 'bg-red-500'}`} />
            <span>{llmInfo.provider} / {llmInfo.model}</span>
          </div>
        )}
        <div className="ml-auto">
          <LangToggle />
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-[var(--slate-400)]">
            {t('chat.emptyHint')}
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.message_id || i}
            message={msg}
            sessionId={sessionId}
            onReport={(id) => setReportMsgId(id)}
            onRefine={handleRefine}
            onCardClick={onCardClick}
          />
        ))}

        {loading && (
          <div className="flex gap-2 items-center text-sm">
            {loadingPhase === 'refining' ? (
              <>
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-amber-600">{t('chat.thinkingRefine')}</span>
              </>
            ) : loadingPhase === 'initial-deep' ? (
              <>
                <div className="w-2 h-2 rounded-full bg-[var(--safety-blue)] animate-pulse" />
                <span className="text-[var(--slate-400)]">{t('chat.thinkingDeep')}</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-[var(--safety-blue)] animate-pulse" />
                <span className="text-[var(--slate-400)]">{t('chat.thinking')}</span>
              </>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-[var(--slate-200)] bg-white p-4">
        <div className="flex gap-3 items-end">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder={t('chat.placeholder')}
            rows={1}
            className="flex-1 resize-none rounded-lg border border-[var(--slate-200)] px-4 py-3 text-sm focus:outline-none focus:border-[var(--safety-blue)] focus:ring-1 focus:ring-[var(--safety-blue)]"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="h-11 w-11 rounded-lg bg-[var(--safety-blue)] text-white flex items-center justify-center hover:bg-[var(--safety-blue-hover)] disabled:opacity-50 transition-colors shrink-0"
          >
            <Send size={18} />
          </button>
        </div>
      </div>

      {reportMsgId && (
        <FeedbackTicketDialog
          sessionId={sessionId}
          messageId={reportMsgId}
          onClose={() => setReportMsgId(null)}
        />
      )}
    </div>
  )
}

function MessageBubble({
  message,
  sessionId,
  onReport,
  onRefine,
  onCardClick,
}: {
  message: ChatMessage
  sessionId: string
  onReport: (messageId: string) => void
  onRefine: (optionLabel: string, customInput: string, context: any, keywords: string[], refinedQuery: string) => void
  onCardClick: (entityRefs: { entity_type: string; entity_id: string; title: string; confidence: number; matched_sections?: string[] }[]) => void
}) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[70%] bg-[var(--safety-blue)] text-white rounded-2xl rounded-br-md px-4 py-3 text-sm">
          {message.content}
        </div>
      </div>
    )
  }

  if (message.role === 'direct_content' && message.content_items?.length) {
    return (
      <div>
        <ContentDisplay
          results={message.content_items}
          onItemClick={(item) => onCardClick([{
            entity_type: item.entity_type,
            entity_id: item.entity_id,
            title: item.title,
            confidence: 1.0,
            matched_sections: item.matched_sections || [],
          }])}
        />
        <TokenAnnotation message={message} />
      </div>
    )
  }

  if (message.role === 'solution') {
    return (
      <VerifiedSolution
        content={message.content}
        data={message.solution_data}
      />
    )
  }

  if (message.role === 'refinement') {
    return (
      <div>
        <ProgressiveRefinement
          content={message.content}
          options={message.refinement_options || []}
          context={message.refinement_context!}
          onSelectOption={(label, keywords, refinedQuery) => onRefine(label, '', message.refinement_context!, keywords, refinedQuery)}
          onCustomInput={(text) => onRefine('', text, message.refinement_context!, [], '')}
        />
        <TokenAnnotation message={message} />
      </div>
    )
  }

  if (message.role === 'near_miss') {
    return (
      <div>
        <NearMissDisplay
          content={message.content}
          nearMissResults={message.near_miss_results || []}
          refinedQuery={message.refinement_context?.current_query || ''}
          onViewDetail={(refs) => onCardClick(refs)}
        />
        <TokenAnnotation message={message} />
      </div>
    )
  }

  if (message.role === 'content' && message.content_results?.length) {
    return <ContentDisplay results={message.content_results} />
  }

  // Default: AI text reply
  return (
    <div className="flex justify-start">
      <div className="max-w-[70%]">
        <div className="bg-white border border-[var(--slate-200)] rounded-2xl rounded-bl-md px-4 py-3 text-sm text-[var(--slate-700)] prose prose-sm prose-slate max-w-none [&_pre]:bg-[var(--slate-50)] [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:overflow-x-auto [&_code]:text-[var(--safety-blue)] [&_code]:text-xs [&_a]:text-[var(--safety-blue)] [&_ul]:list-disc [&_ol]:list-decimal [&_li]:ml-4">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content}
          </ReactMarkdown>
        </div>
        {message.message_id && (
          <MessageFeedback
            messageId={message.message_id}
            sessionId={sessionId}
            onReport={() => onReport(message.message_id!)}
          />
        )}
        <SourceTrace sources={message.sources || []} />
        <TokenAnnotation message={message} />
      </div>
    </div>
  )
}

function TokenAnnotation({ message }: { message: ChatMessage }) {
  const tokens = message.token_usage?.total_tokens
  const ms = message.response_time_ms
  if (!tokens && !ms) return null
  const parts: string[] = []
  if (tokens) parts.push(`Tokens: ${tokens.toLocaleString()}`)
  if (ms) parts.push(`${(ms / 1000).toFixed(1)}s`)
  return (
    <p className="text-[10px] text-[var(--slate-400)] mt-1">
      {parts.join(' | ')}
    </p>
  )
}
