const TOKEN_KEY = 'auth_token'

export function saveToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function removeToken() {
  localStorage.removeItem(TOKEN_KEY)
}

interface TokenPayload {
  sub: string
  username: string
  role: string
  exp: number
}

export function parseToken(token: string): TokenPayload | null {
  try {
    const base64 = token.split('.')[1]
    const json = atob(base64)
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function isLoggedIn(): boolean {
  const token = getToken()
  if (!token) return false
  const payload = parseToken(token)
  if (!payload) return false
  return payload.exp * 1000 > Date.now()
}

export function isAdmin(): boolean {
  const token = getToken()
  if (!token) return false
  const payload = parseToken(token)
  return payload?.role === 'admin'
}

export function getUsername(): string {
  const token = getToken()
  if (!token) return ''
  const payload = parseToken(token)
  return payload?.username || ''
}
