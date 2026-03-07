import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { I18nProvider } from './lib/i18n'
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
          <Route path="/" element={<ChatPage />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/docs" element={<DocsListPage />} />
          <Route path="/admin/tickets" element={<TicketsListPage />} />
          <Route path="/admin/docs/:id" element={<DocReviewPage />} />
          <Route path="/admin/tickets/:id" element={<TicketReviewPage />} />
          <Route path="/admin/settings" element={<SettingsPage />} />
        </Routes>
      </BrowserRouter>
    </I18nProvider>
  )
}
