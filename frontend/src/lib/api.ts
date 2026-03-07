import { getToken, removeToken } from './auth'

const BASE = '/api'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function apiFetch(url: string, options: RequestInit = {}): Promise<any> {
  const token = getToken()
  const headers: Record<string, string> = {}

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  // Don't set Content-Type for FormData (browser sets boundary automatically)
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(url, {
    ...options,
    headers: { ...headers, ...(options.headers as Record<string, string> || {}) },
  })

  if (res.status === 401) {
    removeToken()
    window.location.href = '/login'
    throw new ApiError('Unauthorized', 401)
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    throw new ApiError(body.detail || res.statusText, res.status)
  }

  return res.json()
}

// --- Auth ---

export async function login(username: string, password: string) {
  return apiFetch(`${BASE}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export async function getMe() {
  return apiFetch(`${BASE}/auth/me`)
}

export async function chatSend(sessionId: string, message: string) {
  return apiFetch(`${BASE}/chat`, {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, message }),
  })
}

export async function chatRetrieve(
  sessionId: string,
  entityRefs: { entity_type: string; entity_id: string; matched_sections?: string[] }[]
) {
  return apiFetch(`${BASE}/chat/retrieve`, {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, entity_refs: entityRefs }),
  })
}

export async function chatRefine(
  sessionId: string,
  originalQuery: string,
  selectedOption: string,
  customInput: string,
  refinementRound: number,
  keywords: string[] = [],
  refinedQuery: string = '',
) {
  return apiFetch(`${BASE}/chat/refine`, {
    method: 'POST',
    body: JSON.stringify({
      session_id: sessionId,
      original_query: originalQuery,
      selected_option: selectedOption,
      custom_input: customInput,
      refinement_round: refinementRound,
      keywords,
      refined_query: refinedQuery,
    }),
  })
}

export async function getAdminStats() {
  return apiFetch(`${BASE}/admin/stats`)
}

export async function getPendingItems() {
  return apiFetch(`${BASE}/admin/pending`)
}

export async function listDocs(status?: string) {
  const url = status ? `${BASE}/docs?status=${status}` : `${BASE}/docs`
  return apiFetch(url)
}

export async function getDoc(id: string) {
  return apiFetch(`${BASE}/docs/${id}`)
}

export async function updateDoc(id: string, body: Record<string, string>) {
  return apiFetch(`${BASE}/docs/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function approveDoc(id: string) {
  return apiFetch(`${BASE}/docs/${id}/approve`, { method: 'PATCH' })
}

export async function rejectDoc(id: string) {
  return apiFetch(`${BASE}/docs/${id}/reject`, { method: 'PATCH' })
}

export async function recleanDoc(id: string) {
  return apiFetch(`${BASE}/docs/${id}/reclean`, { method: 'POST' })
}

export async function uploadDocs(files: FileList) {
  const form = new FormData()
  for (const f of files) form.append('files', f)
  return apiFetch(`${BASE}/docs/upload`, { method: 'POST', body: form })
}

// --- Tickets ---

export async function listTickets(status?: string) {
  const url = status ? `${BASE}/tickets?status=${status}` : `${BASE}/tickets`
  return apiFetch(url)
}

export async function getTicket(id: string) {
  return apiFetch(`${BASE}/tickets/${id}`)
}

export async function updateTicket(id: string, body: Record<string, string>) {
  return apiFetch(`${BASE}/tickets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function approveTicket(id: string) {
  return apiFetch(`${BASE}/tickets/${id}/approve`, { method: 'PATCH' })
}

export async function rejectTicket(id: string) {
  return apiFetch(`${BASE}/tickets/${id}/reject`, { method: 'PATCH' })
}

export async function recleanTicket(id: string) {
  return apiFetch(`${BASE}/tickets/${id}/reclean`, { method: 'POST' })
}

export async function importTickets(file: File) {
  const form = new FormData()
  form.append('file', file)
  return apiFetch(`${BASE}/tickets/import`, { method: 'POST', body: form })
}

// --- Settings ---

export async function getSettings() {
  return apiFetch(`${BASE}/settings`)
}

export async function updateSettings(data: Record<string, string>) {
  return apiFetch(`${BASE}/settings`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function getSystemStatus() {
  return apiFetch(`${BASE}/settings/status`)
}

// --- Feedback ---

export async function submitFeedback(messageId: string, rating: number) {
  return apiFetch(`${BASE}/feedback`, {
    method: 'POST',
    body: JSON.stringify({ message_id: messageId, rating }),
  })
}

export async function createFeedbackTicket(sessionId: string, messageId: string, comment: string) {
  return apiFetch(`${BASE}/feedback/ticket`, {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, message_id: messageId, user_comment: comment }),
  })
}

export async function getFeedbackStats() {
  return apiFetch(`${BASE}/feedback/stats`)
}

export async function listFeedbackTickets(status?: string) {
  const url = status ? `${BASE}/feedback/tickets?status=${status}` : `${BASE}/feedback/tickets`
  return apiFetch(url)
}

export async function resolveFeedbackTicket(id: string) {
  return apiFetch(`${BASE}/feedback/tickets/${id}`, { method: 'PATCH' })
}

// --- Admin Trends & Hot Topics ---

export async function getAdminTrends(days: number = 30) {
  return apiFetch(`${BASE}/admin/trends?days=${days}`)
}

export async function getHotTopics(limit: number = 10) {
  return apiFetch(`${BASE}/admin/hot-topics?limit=${limit}`)
}

export async function getNoResultQueries(limit: number = 20) {
  return apiFetch(`${BASE}/admin/no-result-queries?limit=${limit}`)
}

// --- LLM Status ---

export async function getLlmStatus() {
  return apiFetch(`${BASE}/settings/llm-status`)
}

export async function getLlmUsage(days: number = 30, taskType?: string) {
  const params = new URLSearchParams({ days: String(days) })
  if (taskType) params.set('task_type', taskType)
  return apiFetch(`${BASE}/settings/llm-usage?${params}`)
}

// --- Versioning ---

export async function getVersionHistory(entityType: string, entityId: string) {
  return apiFetch(`${BASE}/versions/${entityType}/${entityId}`)
}

export async function getVersionSnapshot(entityType: string, entityId: string, versionId: string) {
  return apiFetch(`${BASE}/versions/${entityType}/${entityId}/${versionId}`)
}

export async function rollbackVersion(entityType: string, entityId: string, versionId: string) {
  return apiFetch(`${BASE}/versions/${entityType}/${entityId}/rollback`, {
    method: 'POST',
    body: JSON.stringify({ version_id: versionId }),
  })
}

export async function getAuditLog(entityType?: string, entityId?: string, limit: number = 50) {
  const params = new URLSearchParams()
  if (entityType) params.set('entity_type', entityType)
  if (entityId) params.set('entity_id', entityId)
  params.set('limit', String(limit))
  return apiFetch(`${BASE}/audit-log?${params}`)
}

// --- Paginated Lists ---

export async function listDocsPaged(page: number, pageSize: number, status?: string, search?: string) {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
  if (status) params.set('status', status)
  if (search) params.set('search', search)
  return apiFetch(`${BASE}/docs?${params}`)
}

export async function listTicketsPaged(page: number, pageSize: number, status?: string, search?: string) {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
  if (status) params.set('status', status)
  if (search) params.set('search', search)
  return apiFetch(`${BASE}/tickets?${params}`)
}

// --- Batch Operations ---

export async function batchDocs(action: string, ids: string[]) {
  return apiFetch(`${BASE}/docs/batch`, {
    method: 'POST',
    body: JSON.stringify({ action, ids }),
  })
}

export async function batchTickets(action: string, ids: string[]) {
  return apiFetch(`${BASE}/tickets/batch`, {
    method: 'POST',
    body: JSON.stringify({ action, ids }),
  })
}

// --- Delete ---

export async function deleteDoc(id: string) {
  return apiFetch(`${BASE}/docs/${id}`, { method: 'DELETE' })
}

export async function deleteTicket(id: string) {
  return apiFetch(`${BASE}/tickets/${id}`, { method: 'DELETE' })
}

// --- Sessions ---

export async function listSessions(page: number = 1, pageSize: number = 20) {
  return apiFetch(`${BASE}/sessions?page=${page}&page_size=${pageSize}`)
}

export async function getSessionMessages(sessionId: string) {
  return apiFetch(`${BASE}/sessions/${sessionId}/messages`)
}

export async function deleteSession(sessionId: string) {
  return apiFetch(`${BASE}/sessions/${sessionId}`, { method: 'DELETE' })
}

export async function batchDeleteSessions(sessionIds: string[]) {
  return apiFetch(`${BASE}/sessions/batch-delete`, {
    method: 'POST',
    body: JSON.stringify({ session_ids: sessionIds }),
  })
}
