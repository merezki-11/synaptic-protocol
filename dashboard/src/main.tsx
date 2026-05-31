import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { SuiWalletProvider } from './components/SuiWalletProvider.tsx'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SuiWalletProvider>
      <App />
    </SuiWalletProvider>
  </StrictMode>,
)
