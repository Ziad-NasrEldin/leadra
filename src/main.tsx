import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Agentation } from 'agentation'
import './index.css'
import App from './App.tsx'
import { LocaleProvider } from './lib/i18n'
import { ThemeProvider } from './lib/theme'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <LocaleProvider>
        <QueryClientProvider client={queryClient}>
          <App />
          {import.meta.env.DEV && <Agentation />}
        </QueryClientProvider>
      </LocaleProvider>
    </ThemeProvider>
  </StrictMode>,
)
