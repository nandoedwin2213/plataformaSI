import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { ProveedorApp } from './store/ProveedorApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ProveedorApp>
        <App />
      </ProveedorApp>
    </BrowserRouter>
  </StrictMode>,
)
