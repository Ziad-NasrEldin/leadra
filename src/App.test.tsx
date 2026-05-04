import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
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

    expect(screen.getByRole('heading', { name: /resale command/i })).toBeInTheDocument()
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
    await user.click(await screen.findByRole('button', { name: /^more$/i }))
    await user.click((await screen.findAllByRole('button', { name: /^analytics$/i }))[0])

    expect(await screen.findByRole('heading', { name: /team analytics/i })).toBeInTheDocument()
    expect(screen.getByText(/team team-prime/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /sign out/i }))
    await user.click(screen.getByRole('button', { name: /continue as sara amin/i }))
    await user.click(await screen.findByRole('button', { name: /^more$/i }))

    expect(screen.queryAllByRole('button', { name: /^analytics$/i })).toHaveLength(0)
    expect(screen.queryByRole('heading', { name: /team analytics/i })).not.toBeInTheDocument()
  })

  it('uses a create-unit wizard and still submits the complete form', async () => {
    renderApp()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /continue as admin/i }))
    await user.click(screen.getByRole('button', { name: /^create$/i }))

    expect(await screen.findByRole('button', { name: /property/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /specs/i }))
    expect(screen.getByRole('spinbutton', { name: /bedrooms/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /payment/i }))
    expect(screen.getByRole('spinbutton', { name: /total amount/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /review/i }))
    const image = new File(
      [Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lZrD9wAAAABJRU5ErkJggg=='), (char) => char.charCodeAt(0))],
      'living-room.png',
      { type: 'image/png' },
    )
    await user.upload(screen.getByLabelText(/unit images/i), image)
    expect(await screen.findByText(/living-room.png/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /create unit and notify team/i }))

    expect(await screen.findByRole('heading', { name: /NE107BR3Ba2/i })).toBeInTheDocument()
    expect(screen.getByAltText(/living-room.png/i)).toBeInTheDocument()
  })

  it('blocks create-unit image uploads over 40 MB', async () => {
    renderApp()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /continue as admin/i }))
    await user.click(screen.getByRole('button', { name: /^create$/i }))
    await user.click(screen.getByRole('button', { name: /review/i }))

    const oversized = new File(['x'], 'oversized.jpg', { type: 'image/jpeg' })
    Object.defineProperty(oversized, 'size', { value: 41 * 1024 * 1024 })
    await user.upload(screen.getByLabelText(/unit images/i), oversized)

    expect(await screen.findByText(/total media size exceeds 40 mb/i)).toBeInTheDocument()
  })

  it('uses an admin wizard while preserving create-user and settings submits', async () => {
    renderApp()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /continue as admin/i }))
    await user.click((await screen.findAllByRole('button', { name: /^admin$/i }))[0])

    expect(await screen.findByRole('button', { name: /^users$/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /new user/i }))
    await user.type(screen.getByRole('textbox', { name: /full name/i }), 'Adapted User')
    await user.type(screen.getByRole('textbox', { name: /email/i }), 'adapted@leadra.test')
    await user.click(screen.getByRole('button', { name: /^create user$/i }))
    expect(await screen.findByText(/adapted user/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^settings$/i }))
    await user.clear(screen.getByRole('spinbutton', { name: /commission percentage/i }))
    await user.type(screen.getByRole('spinbutton', { name: /commission percentage/i }), '2')
    await user.click(screen.getByRole('button', { name: /^save settings$/i }))
    expect(await screen.findByText(/settings updated and audited/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^audit$/i }))
    expect(screen.getByRole('heading', { name: /audit log/i })).toBeInTheDocument()
  })

  it('filters and edits users in admin user management', async () => {
    renderApp()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /continue as admin/i }))
    await user.click((await screen.findAllByRole('button', { name: /^admin$/i }))[0])

    await user.selectOptions(screen.getByLabelText(/^role$/i), 'sales')
    expect(screen.getByText(/1 users shown/i)).toBeInTheDocument()
    const managedUsers = screen.getByLabelText(/managed users/i)
    expect(within(managedUsers).getByText(/sara amin/i)).toBeInTheDocument()
    expect(within(managedUsers).queryByText(/mona hafez/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /edit user/i }))
    const editForm = screen.getByRole('button', { name: /save user/i }).closest('form')
    expect(editForm).not.toBeNull()
    const jobTitleInput = within(editForm as HTMLFormElement).getByLabelText(/job title/i)
    await user.clear(jobTitleInput)
    await user.type(jobTitleInput, 'Senior Sales Advisor')
    await user.click(screen.getByRole('button', { name: /save user/i }))

    expect(await screen.findByText(/user profile updated and audit history updated/i)).toBeInTheDocument()
    expect(screen.getByText(/senior sales advisor/i)).toBeInTheDocument()
  })
})
