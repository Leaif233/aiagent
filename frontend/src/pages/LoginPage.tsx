import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../lib/api'
import { saveToken } from '../lib/auth'
import { useI18n } from '../lib/i18n'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { t } = useI18n()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await login(username, password)
      saveToken(data.token)
      navigate('/')
    } catch (err: any) {
      setError(err.message || t('auth.loginFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--slate-50)]">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl border border-[var(--slate-200)] p-8 shadow-sm">
          <h1 className="text-xl font-bold text-[var(--slate-800)] text-center mb-6">
            {t('auth.title')}
          </h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--slate-700)] mb-1">
                {t('auth.username')}
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--slate-200)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--safety-blue)]"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--slate-700)] mb-1">
                {t('auth.password')}
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--slate-200)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--safety-blue)]"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full py-2 rounded-lg bg-[var(--safety-blue)] text-white text-sm font-medium hover:bg-[var(--safety-blue-hover)] disabled:opacity-50 transition-colors"
            >
              {loading ? t('auth.loggingIn') : t('auth.login')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
