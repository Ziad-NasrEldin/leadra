import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Agentation } from 'agentation'
import './index.css'
import App from './App.tsx'
import { LocaleProvider } from './lib/i18n'
import { ThemeProvider } from './lib/theme'

const queryClient = new QueryClient()

const copyAgentationOutput = (output: string) => {
  const writeClipboard = navigator.clipboard?.writeText?.(output)
  if (writeClipboard) {
    writeClipboard.catch(() => copyViaTextArea(output))
    return
  }

  copyViaTextArea(output)
}

const copyViaTextArea = (output: string) => {
  const textArea = document.createElement('textarea')
  textArea.value = output
  textArea.setAttribute('readonly', '')
  textArea.style.position = 'fixed'
  textArea.style.top = '0'
  textArea.style.left = '0'
  textArea.style.opacity = '0'
  document.body.appendChild(textArea)
  textArea.select()

  try {
    document.execCommand('copy')
  } finally {
    document.body.removeChild(textArea)
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <LocaleProvider>
        <QueryClientProvider client={queryClient}>
          <App />
          {import.meta.env.DEV && (
            <Agentation copyToClipboard={false} onCopy={copyAgentationOutput} />
          )}
        </QueryClientProvider>
      </LocaleProvider>
    </ThemeProvider>
  </StrictMode>,
)
