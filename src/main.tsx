import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { NockchainProvider } from './hooks/useNockchain'

createRoot(document.getElementById('root')!).render(
    <NockchainProvider>
      <App />
    </NockchainProvider>
)
