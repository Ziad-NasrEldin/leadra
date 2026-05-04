import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
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
  afterEach(() => {
    window.history.replaceState(null, '', '/')
  })

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

  it('does not leave a sales user on the admin page after signing out from admin', async () => {
    renderApp()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /continue as admin/i }))
    await user.click((await screen.findAllByRole('button', { name: /^admin$/i }))[0])
    expect(await screen.findByRole('heading', { name: /user management/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /sign out/i }))
    await user.click(screen.getByRole('button', { name: /continue as sara amin/i }))

    expect(await screen.findByRole('heading', { name: /sara command/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /user management/i })).not.toBeInTheDocument()
  })

  it('honors a units deep link after login and updates hash during navigation', async () => {
    window.history.replaceState(null, '', '/#units')
    renderApp()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /continue as admin/i }))

    expect(await screen.findByRole('heading', { name: /choose a project/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^create$/i }))
    expect(window.location.hash).toBe('#create')
  })

  it('shows analytics to managers but not sales users', async () => {
    renderApp()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /continue as mona hafez/i }))
    await user.click((await screen.findAllByRole('button', { name: /^analytics$/i }))[0])

    expect(await screen.findByRole('heading', { name: /team analytics/i })).toBeInTheDocument()
    expect(screen.getByText(/team team-prime/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /sign out/i }))
    await user.click(screen.getByRole('button', { name: /continue as sara amin/i }))

    expect(screen.queryAllByRole('button', { name: /^analytics$/i })).toHaveLength(0)
    expect(screen.queryByRole('heading', { name: /team analytics/i })).not.toBeInTheDocument()
  })
})
