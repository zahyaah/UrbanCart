import { Provider } from 'react-redux'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { store } from "./redux/store"
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary'
import { ThemeProvider } from './providers/ThemeProvider'
import { Toaster } from './components/ui/sonner.jsx'

// index.html ships the #root div this app owns, so it's always present.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <Provider store={store}>
          <App />
          {/* top-center so it never covers the cart sheet's footer CTAs */}
          <Toaster position="top-center" />
        </Provider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
)
