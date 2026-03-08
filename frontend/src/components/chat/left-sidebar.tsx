import { useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  MessageSquare,
  FileText,
  Ticket,
  Settings,
} from 'lucide-react'
import { useI18n } from '../../lib/i18n'

export default function LeftSidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useI18n()

  const navItems = [
    { icon: LayoutDashboard, label: t('nav.dashboard'), path: '/admin' },
    { icon: MessageSquare, label: t('nav.supportChat'), path: '/' },
    { icon: FileText, label: t('nav.documentation'), path: '/admin/docs' },
    { icon: Ticket, label: t('nav.tickets'), path: '/admin/tickets' },
    { icon: Settings, label: t('nav.settings'), path: '/admin/settings' },
  ]

  return (
    <aside className="w-64 border-r border-[var(--slate-200)] bg-white flex flex-col shrink-0">
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-[var(--slate-200)]">
        <div className="w-8 h-8 rounded-lg bg-[var(--safety-blue)] flex items-center justify-center">
          <span className="text-white font-bold text-sm">AI</span>
        </div>
        <span className="ml-3 font-semibold text-[var(--slate-800)]">
          {t('nav.techSupport')}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const active = item.path === '/'
            ? location.pathname === '/'
            : item.path === '/admin'
              ? location.pathname === '/admin'
              : location.pathname.startsWith(item.path)
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-[var(--safety-blue-light)] text-[var(--safety-blue)] font-medium'
                  : 'text-[var(--slate-500)] hover:bg-[var(--slate-100)]'
              }`}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
