import { Provider } from 'react-redux'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { storage } from "./redux/storage.js"

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={storage}>
      <App />
    </Provider>
  </StrictMode>,
)