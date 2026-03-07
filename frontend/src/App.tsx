import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { I18nProvider } from './lib/i18n'
import { AuthGuard, AdminGuard } from './components/ui/auth-guard'
import LoginPage from './pages/LoginPage'
import ChatPage from './pages/ChatPage'
import AdminDashboard from './pages/AdminDashboard'
import DocsListPage from './pages/DocsListPage'
import TicketsListPage from './pages/TicketsListPage'
import DocReviewPage from './pages/DocReviewPage'
import TicketReviewPage from './pages/TicketReviewPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <I18nProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<AuthGuard><ChatPage /></AuthGuard>} />
          <Route path="/admin" element={<AdminGuard><AdminDashboard /></AdminGuard>} />
          <Route path="/admin/docs" element={<AdminGuard><DocsListPage /></AdminGuard>} />
          <Route path="/admin/tickets" element={<AdminGuard><TicketsListPage /></AdminGuard>} />
          <Route path="/admin/docs/:id" element={<AdminGuard><DocReviewPage /></AdminGuard>} />
          <Route path="/admin/tickets/:id" element={<AdminGuard><TicketReviewPage /></AdminGuard>} />
          <Route path="/admin/settings" element={<AdminGuard><SettingsPage /></AdminGuard>} />
        </Routes>
      </BrowserRouter>
    </I18nProvider>
  )
}
