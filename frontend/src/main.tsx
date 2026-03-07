import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import ErrorBoundary from './components/ui/error-boundary'
import App from './App'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
    </ErrorBoundary>
  </React.StrictMode>,
)
