import { Provider } from 'react-redux'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { store } from "./redux/store.js"
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary.jsx'
import { ThemeProvider } from './providers/ThemeProvider.jsx'
import { Toaster } from './components/ui/sonner.jsx'

createRoot(document.getElementById('root')).render(
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
