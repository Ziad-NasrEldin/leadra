import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  )
}

describe('Leadra app shell', () => {
  it('lets a demo user enter the project-first unit browser', async () => {
    renderApp()
    const user = userEvent.setup()

    expect(screen.getByRole('heading', { name: /leadra resale command/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /continue as admin/i }))

    expect(await screen.findByRole('heading', { name: /admin command/i })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: /view all units/i }))

    expect(await screen.findByRole('heading', { name: /choose a project/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /new cairo estates/i })).toBeInTheDocument()
  })
})
