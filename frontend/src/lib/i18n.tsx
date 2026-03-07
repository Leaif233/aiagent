import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

export type Lang = 'zh' | 'en'

const translations = {
  // Left Sidebar
  'nav.techSupport': { zh: '技术支持', en: 'Tech Support' },
  'nav.dashboard': { zh: '管理面板', en: 'Dashboard' },
  'nav.supportChat': { zh: '智能客服', en: 'Support Chat' },
  'nav.documentation': { zh: '技术文档', en: 'Documentation' },
  'nav.tickets': { zh: '工单管理', en: 'Tickets' },
  'nav.settings': { zh: '设置', en: 'Settings' },
  'nav.knowledgeBase': { zh: '知识库', en: 'Knowledge Base' },
  'nav.verifiedDocs': { zh: '已审核文档', en: 'Verified Docs' },
  'nav.verifiedTickets': { zh: '已审核工单', en: 'Verified Tickets' },

  // Chat Area
  'chat.title': { zh: '技术支持对话', en: 'Technical Support Chat' },
  'chat.placeholder': { zh: '请描述您的技术问题...', en: 'Describe your technical issue...' },
  'chat.emptyHint': { zh: '请输入技术问题开始对话', en: 'Ask a technical question to get started' },
  'chat.thinking': { zh: '思考中...', en: 'Thinking...' },
  'chat.thinkingDeep': {
    zh: '未能立即找到精确匹配，正在深入分析相关文档并为您准备确认选项...',
    en: 'No exact match found. Analyzing related documents to prepare refinement options...',
  },
  'chat.thinkingRefine': {
    zh: '正在根据您提供的线索重新进行全量匹配，请稍候...',
    en: 'Re-matching with your clues, please wait...',
  },
  'chat.error': { zh: '抱歉，发生了错误。', en: 'Sorry, an error occurred.' },

  // Right Sidebar
  'ref.title': { zh: '参考资料', en: 'Reference Assets' },
  'ref.techDocs': { zh: '技术文档', en: 'Technical Documents' },
  'ref.relatedTickets': { zh: '相关工单', en: 'Related Tickets' },
  'ref.noItems': { zh: '暂无内容', en: 'No items yet' },
  'ref.verified': { zh: '已审核', en: 'Verified' },
  'ref.match': { zh: '匹配', en: 'match' },
  'ref.nearMissTitle': { zh: '近似参考', en: 'Approximate References' },
  'ref.nearMissLabel': { zh: '近似匹配', en: 'Near Match' },
  'ref.nearMissHint': { zh: '以下为近似匹配结果，点击查看详情', en: 'Approximate matches. Click to view details.' },

  // Content Display
  'content.foundResults': { zh: '为您找到以下相关资料，点击查看详情：', en: 'Found the following results. Click to view details:' },
  'content.verifiedContent': { zh: '已审核', en: 'Verified' },
  'content.docTitle': { zh: '技术文档', en: 'Technical Document' },
  'content.ticketTitle': { zh: '工单详情', en: 'Ticket Details' },
  'content.ticketNumber': { zh: '工单号', en: 'Ticket #' },
  'content.phenomenon': { zh: '现象', en: 'Phenomenon' },
  'content.cause': { zh: '根因', en: 'Root Cause' },
  'content.solution': { zh: '对策', en: 'Solution' },

  // Verified Solution
  'solution.title': { zh: '已验证方案', en: 'Verified Solution' },
  'solution.symptom': { zh: '现象', en: 'Symptom' },
  'solution.rootCause': { zh: '根因', en: 'Root Cause' },
  'solution.solution': { zh: '对策', en: 'Solution' },

  // Progressive Refinement
  'refinement.title': { zh: '特征选择', en: 'Feature Selection' },
  'refinement.subtitle': { zh: '请选择最接近的技术特征', en: 'Select the closest technical attribute' },
  'refinement.round': { zh: '第 {current}/{max} 轮细化', en: 'Round {current}/{max}' },
  'refinement.customPlaceholder': { zh: '或输入具体部件/故障/参数...', en: 'Or enter specific part/fault/parameter...' },
  'refinement.currentQuery': { zh: '当前问题', en: 'Current Query' },

  // Near Miss Display
  'nearMiss.title': { zh: '未找到精确匹配', en: 'No Exact Match Found' },
  'nearMiss.subtitle': { zh: '以下为近似结果，仅供参考', en: 'Approximate results for reference' },
  'nearMiss.refinedQuery': { zh: '修饰后的问题', en: 'Refined Query' },
  'nearMiss.confidence': { zh: '相似度', en: 'Similarity' },
  'nearMiss.disclaimer': { zh: '这些结果可能不完全匹配您的问题', en: 'These results may not exactly match your question' },

  // Admin Dashboard
  'admin.title': { zh: '管理面板', en: 'Admin Dashboard' },
  'admin.uploadDocs': { zh: '上传文档', en: 'Upload Docs' },
  'admin.importTickets': { zh: '导入工单', en: 'Import Tickets' },
  'admin.pendingDocs': { zh: '待审核文档', en: 'Pending Docs' },
  'admin.pendingTickets': { zh: '待审核工单', en: 'Pending Tickets' },
  'admin.verifiedTotal': { zh: '已入库总数', en: 'Verified Total' },
  'admin.pendingDocuments': { zh: '待审核文档', en: 'Pending Documents' },
  'admin.pendingTicketsList': { zh: '待审核工单', en: 'Pending Tickets' },
  'admin.noPending': { zh: '暂无待审核项', en: 'No pending items' },

  // Review Pages (Doc & Ticket)
  'review.save': { zh: '保存', en: 'Save' },
  'review.saving': { zh: '保存中...', en: 'Saving...' },
  'review.reclean': { zh: '重新清洗', en: 'Re-clean' },
  'review.reject': { zh: '驳回', en: 'Reject' },
  'review.approve': { zh: '核准并入库', en: 'Approve' },
  'review.originalContent': { zh: '原始内容', en: 'Original Content' },
  'review.aiCleaned': { zh: 'AI清洗内容', en: 'AI-Cleaned Content' },
  'review.noContent': { zh: '暂无内容', en: 'No content' },
  'review.rawTicket': { zh: '原始工单', en: 'Raw Ticket' },
  'review.extractedFields': { zh: '提取字段', en: 'Extracted Fields' },
  'review.phenomenon': { zh: '现象', en: 'Phenomenon' },
  'review.rootCause': { zh: '根因', en: 'Root Cause' },
  'review.solution': { zh: '对策', en: 'Solution' },

  // Common
  'common.loading': { zh: '加载中...', en: 'Loading...' },

  // Language toggle
  'lang.toggle': { zh: 'EN', en: '中' },
  'lang.tooltip': { zh: 'Switch to English', en: '切换为中文' },

  // Settings Page
  'settings.title': { zh: '系统设置', en: 'System Settings' },
  'settings.save': { zh: '保存设置', en: 'Save Settings' },
  'settings.saving': { zh: '保存中...', en: 'Saving...' },
  'settings.saved': { zh: '已保存', en: 'Saved' },

  // Settings - LLM
  'settings.llm': { zh: '大模型逻辑控制', en: 'LLM Configuration' },
  'settings.llm.desc': { zh: '控制AI回答的风格和判断准则', en: 'Control AI response style and decision criteria' },
  'settings.llm.provider': { zh: 'LLM 服务商', en: 'LLM Provider' },
  'settings.llm.model': { zh: '模型名称', en: 'Model Name' },
  'settings.llm.confidence': { zh: '置信度阈值', en: 'Confidence Threshold' },
  'settings.llm.confidenceDesc': { zh: '高于此值触发精准匹配(Stage 1)', en: 'Above this triggers direct answer (Stage 1)' },
  'settings.llm.maxRounds': { zh: '对话轮次上限', en: 'Max Conversation Rounds' },
  'settings.llm.maxRoundsDesc': { zh: '达到此轮次触发模块化兜底(Stage 3)', en: 'Triggers fallback (Stage 3) at this round' },
  'settings.llm.maxTokens': { zh: '最大Token数', en: 'Max Tokens' },

  // Settings - RAG
  'settings.rag': { zh: '知识库与检索策略', en: 'RAG Settings' },
  'settings.rag.desc': { zh: '控制AI如何检索知识库', en: 'Control how AI retrieves from knowledge base' },
  'settings.rag.chunkSize': { zh: '分片大小(字符)', en: 'Chunk Size (chars)' },
  'settings.rag.topK': { zh: '检索 Top-K', en: 'Retrieval Top-K' },

  // Settings - System
  'settings.system': { zh: '系统集成与API管理', en: 'System Integrations' },
  'settings.system.desc': { zh: 'API密钥管理与系统状态监控', en: 'API key management and system health' },
  'settings.system.anthropicKey': { zh: 'Anthropic API Key', en: 'Anthropic API Key' },
  'settings.system.deepseekKey': { zh: 'DeepSeek API Key', en: 'DeepSeek API Key' },
  'settings.system.dashscopeKey': { zh: 'DashScope API Key', en: 'DashScope API Key' },
  'settings.system.redis': { zh: 'Redis 状态', en: 'Redis Status' },
  'settings.system.chromaDocs': { zh: 'ChromaDB 文档数', en: 'ChromaDB Docs' },
  'settings.system.chromaTickets': { zh: 'ChromaDB 工单数', en: 'ChromaDB Tickets' },
  'settings.system.connected': { zh: '已连接', en: 'Connected' },
  'settings.system.disconnected': { zh: '未连接', en: 'Disconnected' },

  // Settings - Ingestion
  'settings.ingestion': { zh: '自动化清洗与解析预设', en: 'Ingestion Rules' },
  'settings.ingestion.desc': { zh: '配置文档解析和工单清洗规则', en: 'Configure doc parsing and ticket cleaning rules' },
  'settings.ingestion.prompt': { zh: '清洗 Prompt 模板', en: 'Cleaning Prompt Template' },
  'settings.ingestion.promptPlaceholder': { zh: '留空使用默认模板', en: 'Leave empty for default template' },
  'settings.ingestion.imageProcessing': { zh: '图片处理', en: 'Image Processing' },
  'settings.ingestion.imageOn': { zh: '开启多模态解析', en: 'Enable multimodal parsing' },
  'settings.ingestion.imageOff': { zh: '关闭（跳过图片）', en: 'Disabled (skip images)' },

  // Settings - Embedding
  'settings.embedding.provider': { zh: 'Embedding 服务商', en: 'Embedding Provider' },
  'settings.embedding.model': { zh: 'Embedding 模型', en: 'Embedding Model' },

  // Dashboard Charts
  'dashboard.knowledgeDist': { zh: '知识库分布', en: 'Knowledge Distribution' },
  'dashboard.documents': { zh: '文档', en: 'Documents' },
  'dashboard.tickets': { zh: '工单', en: 'Tickets' },
  'dashboard.trends': { zh: '趋势', en: 'Trends' },
  'dashboard.newDocs': { zh: '新增文档', en: 'New Docs' },
  'dashboard.newTickets': { zh: '新增工单', en: 'New Tickets' },
  'dashboard.newSessions': { zh: '新增会话', en: 'New Sessions' },
  'dashboard.hotTopics': { zh: '热门问题', en: 'Hot Topics' },
  'dashboard.askCount': { zh: '提问次数', en: 'Ask Count' },
  'dashboard.lastAsked': { zh: '最近提问', en: 'Last Asked' },
  'dashboard.costSavings': { zh: '成本节约', en: 'Cost Savings' },
  'dashboard.queriesResolved': { zh: '已解决查询', en: 'Queries Resolved' },
  'dashboard.estimatedSavings': { zh: '预估节约', en: 'Estimated Savings' },
  'dashboard.totalSessions': { zh: '总会话数', en: 'Total Sessions' },
  'dashboard.avgRounds': { zh: '平均轮次', en: 'Avg Rounds' },
  'dashboard.stageDistribution': { zh: '阶段分布', en: 'Stage Distribution' },

  // Feedback
  'feedback.thumbsUp': { zh: '有帮助', en: 'Helpful' },
  'feedback.thumbsDown': { zh: '无帮助', en: 'Not Helpful' },
  'feedback.report': { zh: '报告问题', en: 'Report Issue' },
  'feedback.ticketTitle': { zh: '创建纠错工单', en: 'Create Correction Ticket' },
  'feedback.ticketComment': { zh: '请描述问题...', en: 'Describe the issue...' },
  'feedback.submit': { zh: '提交', en: 'Submit' },
  'feedback.cancel': { zh: '取消', en: 'Cancel' },
  'feedback.submitted': { zh: '已提交', en: 'Submitted' },
  'feedback.sources': { zh: '参考来源', en: 'Sources' },

  // Version History
  'version.title': { zh: '版本历史', en: 'Version History' },
  'version.number': { zh: '版本', en: 'Version' },
  'version.changedBy': { zh: '操作人', en: 'Changed By' },
  'version.reason': { zh: '原因', en: 'Reason' },
  'version.rollback': { zh: '回滚到此版本', en: 'Rollback' },
  'version.rollbackConfirm': { zh: '确认回滚？', en: 'Confirm rollback?' },
  'version.viewSnapshot': { zh: '查看快照', en: 'View Snapshot' },
  'version.noHistory': { zh: '暂无版本记录', en: 'No version history' },

  // Knowledge Browse
  'browse.docs': { zh: '文档管理', en: 'Documents' },
  'browse.tickets': { zh: '工单管理', en: 'Tickets' },
  'browse.search': { zh: '搜索...', en: 'Search...' },
  'browse.all': { zh: '全部', en: 'All' },
  'browse.pending': { zh: '待处理', en: 'Pending' },
  'browse.reviewing': { zh: '待审核', en: 'Reviewing' },
  'browse.verified': { zh: '已审核', en: 'Verified' },
  'browse.rejected': { zh: '已驳回', en: 'Rejected' },
  'browse.batchApprove': { zh: '批量审核', en: 'Batch Approve' },
  'browse.batchReject': { zh: '批量驳回', en: 'Batch Reject' },
  'browse.batchDelete': { zh: '批量删除', en: 'Batch Delete' },
  'browse.selected': { zh: '已选', en: 'selected' },
  'browse.noItems': { zh: '暂无数据', en: 'No items' },
  'browse.prev': { zh: '上一页', en: 'Previous' },
  'browse.next': { zh: '下一页', en: 'Next' },
  'browse.pageInfo': { zh: '第{page}页 / 共{total}条', en: 'Page {page} / {total} items' },

  // Session History
  'session.title': { zh: '会话历史', en: 'Session History' },
  'session.newChat': { zh: '新建对话', en: 'New Chat' },
  'session.resume': { zh: '继续对话', en: 'Resume' },
  'session.delete': { zh: '删除会话', en: 'Delete Session' },
  'session.confirmDelete': { zh: '确认删除此会话？', en: 'Delete this session?' },
  'session.noHistory': { zh: '暂无历史会话', en: 'No session history' },
  'session.loadMore': { zh: '加载更多', en: 'Load More' },
  'session.today': { zh: '今天', en: 'Today' },
  'session.yesterday': { zh: '昨天', en: 'Yesterday' },
  'session.earlier': { zh: '更早', en: 'Earlier' },
  'session.manage': { zh: '管理', en: 'Manage' },
  'session.done': { zh: '完成', en: 'Done' },
  'session.selectAll': { zh: '全选', en: 'Select All' },
  'session.deselectAll': { zh: '取消全选', en: 'Deselect All' },
  'session.deleteSelected': { zh: '删除选中', en: 'Delete Selected' },
  'session.selectedCount': { zh: '已选 {count} 项', en: '{count} selected' },

  // Auth
  'auth.title': { zh: '智能技术支持系统', en: 'AI Technical Support System' },
  'auth.username': { zh: '用户名', en: 'Username' },
  'auth.password': { zh: '密码', en: 'Password' },
  'auth.login': { zh: '登录', en: 'Login' },
  'auth.loggingIn': { zh: '登录中...', en: 'Logging in...' },
  'auth.loginFailed': { zh: '登录失败', en: 'Login failed' },
  'auth.logout': { zh: '退出登录', en: 'Logout' },

  // Toast
  'toast.saved': { zh: '保存成功', en: 'Saved successfully' },
  'toast.saveFailed': { zh: '保存失败', en: 'Save failed' },
  'toast.approved': { zh: '审核通过', en: 'Approved successfully' },
  'toast.approveFailed': { zh: '审核失败', en: 'Approve failed' },
  'toast.rejected': { zh: '已驳回', en: 'Rejected' },
  'toast.rejectFailed': { zh: '驳回失败', en: 'Reject failed' },
  'toast.recleanStarted': { zh: '重新清洗已启动', en: 'Re-clean started' },
  'toast.recleanFailed': { zh: '重新清洗失败', en: 'Re-clean failed' },

  // Confirm Dialog
  'confirm.title': { zh: '确认操作', en: 'Confirm Action' },
  'confirm.cancel': { zh: '取消', en: 'Cancel' },
  'confirm.ok': { zh: '确认', en: 'Confirm' },
  'confirm.deleteItems': { zh: '确认删除选中的项目？此操作不可撤销。', en: 'Delete selected items? This cannot be undone.' },
  'confirm.rollback': { zh: '确认回滚到此版本？', en: 'Rollback to this version?' },

  // Table Headers
  'table.title': { zh: '标题', en: 'Title' },
  'table.category': { zh: '分类', en: 'Category' },
  'table.status': { zh: '状态', en: 'Status' },
  'table.updated': { zh: '更新时间', en: 'Updated' },
  'table.ticketNumber': { zh: '工单号', en: 'Ticket #' },
  'table.phenomenon': { zh: '现象', en: 'Phenomenon' },
  'table.snapshot': { zh: '快照', en: 'Snapshot' },
  'table.rounds': { zh: '轮', en: 'rounds' },

  // LLM Status
  'llm.connected': { zh: '已连接', en: 'Connected' },
  'llm.notConfigured': { zh: '未配置', en: 'Not Configured' },

  // Token Annotation
  'token.tokens': { zh: 'Tokens', en: 'Tokens' },
  'token.response': { zh: '响应', en: 'Response' },

  // Task Routing
  'settings.taskRouting': { zh: '任务路由配置', en: 'Task Routing' },
  'settings.taskRouting.desc': { zh: '为不同AI任务指定服务商和模型', en: 'Assign provider and model per AI task' },
  'settings.taskRouting.task': { zh: '任务类型', en: 'Task Type' },
  'settings.taskRouting.provider': { zh: '服务商', en: 'Provider' },
  'settings.taskRouting.model': { zh: '模型', en: 'Model' },
  'settings.taskRouting.useGlobal': { zh: '使用全局默认', en: 'Use Global Default' },
  'settings.taskRouting.textCleaning': { zh: '工单清洗', en: 'Ticket Cleaning' },
  'settings.taskRouting.docCleaning': { zh: '文档清洗', en: 'Doc Cleaning' },
  'settings.taskRouting.multimodalCleaning': { zh: '多模态清洗', en: 'Multimodal Cleaning' },
  'settings.taskRouting.fingerprintExtraction': { zh: '指纹提取', en: 'Fingerprint Extraction' },
  'settings.taskRouting.guidanceGrouping': { zh: '引导分组', en: 'Guidance Grouping' },
  'settings.taskRouting.chatDialogue': { zh: '对话交互', en: 'Chat Dialogue' },

  // LLM Usage Panel
  'dashboard.llmUsage': { zh: 'LLM 用量统计', en: 'LLM Usage Stats' },
  'dashboard.totalCalls': { zh: '总调用次数', en: 'Total Calls' },
  'dashboard.totalTokens': { zh: '总Token消耗', en: 'Total Tokens' },
  'dashboard.avgLatency': { zh: '平均延迟(ms)', en: 'Avg Latency (ms)' },
  'dashboard.errorRate': { zh: '错误率', en: 'Error Rate' },
  'dashboard.byProvider': { zh: '按服务商', en: 'By Provider' },
  'dashboard.byTask': { zh: '按任务类型', en: 'By Task Type' },
  'dashboard.calls': { zh: '调用数', en: 'Calls' },
  'dashboard.tokens': { zh: 'Token数', en: 'Tokens' },
  'dashboard.latency': { zh: '延迟(ms)', en: 'Latency (ms)' },
  'dashboard.provider': { zh: '服务商', en: 'Provider' },
  'dashboard.model': { zh: '模型', en: 'Model' },

  // No-Result Queries
  'dashboard.noResultQueries': { zh: '无结果搜索词', en: 'No-Result Queries' },
  'dashboard.noResultEmpty': { zh: '暂无数据', en: 'No data' },
  'dashboard.noResultLoading': { zh: '加载中...', en: 'Loading...' },

  // Common messages
  'common.loadFailed': { zh: '加载失败', en: 'Failed to load' },
  'common.batchSuccess': { zh: '{count} 项已处理', en: '{count} items processed' },
  'common.batchFailed': { zh: '批量操作失败', en: 'Batch operation failed' },
  'common.dashboardFailed': { zh: '加载仪表盘失败', en: 'Failed to load dashboard' },
} as const

export type TransKey = keyof typeof translations

interface I18nContextType {
  lang: Lang
  toggleLang: () => void
  t: (key: TransKey) => string
}

const I18nContext = createContext<I18nContextType | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem('app-lang')
    return (saved === 'en' ? 'en' : 'zh') as Lang
  })

  const toggleLang = useCallback(() => {
    setLang(prev => {
      const next = prev === 'zh' ? 'en' : 'zh'
      localStorage.setItem('app-lang', next)
      return next
    })
  }, [])

  const t = useCallback((key: TransKey) => {
    return translations[key]?.[lang] ?? key
  }, [lang])

  return (
    <I18nContext.Provider value={{ lang, toggleLang, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
