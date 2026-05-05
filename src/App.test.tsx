import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'
import { LocaleProvider } from './lib/i18n'

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <LocaleProvider>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </LocaleProvider>,
  )
}

async function openLoginPage(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /continue to sign in/i }))
}

async function signInAs(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
  const introButton = screen.queryByRole('button', { name: /continue to sign in/i })
  if (introButton) await user.click(introButton)
  await user.click(screen.getByRole('button', { name }))
}

async function chooseFromSelect(user: ReturnType<typeof userEvent.setup>, label: RegExp, option: RegExp) {
  await user.click(screen.getByRole('combobox', { name: label }))
  await user.click(screen.getByRole('option', { name: option }))
}

describe('Leadra app shell', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/')
  })

  it('lets a demo user enter the destination-first unit browser', async () => {
    renderApp()
    const user = userEvent.setup()

    expect(screen.getByRole('heading', { name: /resale command/i })).toBeInTheDocument()
    await openLoginPage(user)
    await signInAs(user, /continue as admin/i)

    expect(await screen.findByRole('heading', { name: /admin command/i })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: /view all units/i }))

    expect(await screen.findByRole('heading', { name: /choose a destination/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^new cairo\s/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /new cairo estates/i })).toBeInTheDocument()
  })

  it('does not leave a sales user on the admin page after signing out from admin', async () => {
    renderApp()
    const user = userEvent.setup()

    await openLoginPage(user)
    await signInAs(user, /continue as admin/i)
    await user.click((await screen.findAllByRole('button', { name: /^admin$/i }))[0])
    expect(await screen.findByRole('heading', { name: /user management/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /sign out/i }))
    await openLoginPage(user)
    await signInAs(user, /continue as sara amin/i)

    expect(await screen.findByRole('heading', { name: /sara command/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /user management/i })).not.toBeInTheDocument()
  })

  it('honors a units deep link after login and updates hash during navigation', async () => {
    window.history.replaceState(null, '', '/#units')
    renderApp()
    const user = userEvent.setup()

    await openLoginPage(user)
    await signInAs(user, /continue as admin/i)

    expect(await screen.findByRole('heading', { name: /choose a destination/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^create$/i }))
    expect(window.location.hash).toBe('#create')
  })

  it('shows analytics to managers but not sales users', async () => {
    renderApp()
    const user = userEvent.setup()

    await openLoginPage(user)
    await signInAs(user, /continue as mona hafez/i)
    await user.click(await screen.findByRole('button', { name: /^more$/i }))
    await user.click((await screen.findAllByRole('button', { name: /^analytics$/i }))[0])

    expect(await screen.findByRole('heading', { name: /team analytics/i })).toBeInTheDocument()
    expect(screen.getByText(/team team-prime/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /sign out/i }))
    await openLoginPage(user)
    await signInAs(user, /continue as sara amin/i)
    await user.click(await screen.findByRole('button', { name: /^more$/i }))

    expect(screen.queryAllByRole('button', { name: /^analytics$/i })).toHaveLength(0)
    expect(screen.queryByRole('heading', { name: /team analytics/i })).not.toBeInTheDocument()
  })

  it('lets admins interact with analytics ranges, filters, charts, and CSV export', async () => {
    renderApp()
    const user = userEvent.setup()

    await openLoginPage(user)
    await signInAs(user, /continue as admin/i)
    await user.click((await screen.findAllByRole('button', { name: /^analytics$/i }))[0])

    expect(await screen.findByRole('heading', { name: /company analytics/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /30 days/i }))
    await user.click(screen.getByRole('button', { name: /90 days/i }))
    await user.click(screen.getByRole('button', { name: /custom/i }))

    expect(screen.getByLabelText(/start/i)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /sold value trend/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/sales leaderboard chart/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /filters/i }))
    await chooseFromSelect(user, /project/i, /new cairo estates/i)
    expect(screen.getByRole('button', { name: /csv/i })).toBeInTheDocument()
  })

  it('uses a create-unit wizard and still submits the complete form', async () => {
    renderApp()
    const user = userEvent.setup()

    await openLoginPage(user)
    await signInAs(user, /continue as admin/i)
    await user.click(screen.getByRole('button', { name: /^create$/i }))

    expect(await screen.findByRole('button', { name: /property/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /specs/i }))
    expect(screen.getByRole('spinbutton', { name: /bedrooms/i })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /view/i })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /furnished/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /payment/i }))
    expect(screen.getByRole('spinbutton', { name: /total amount/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /owner/i }))
    expect(screen.getByRole('combobox', { name: /delivery date/i })).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: /country code/i })).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /original owner phone/i })).toHaveValue('+201012345678')

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
    expect((await screen.findAllByAltText(/living-room.png/i, undefined, { timeout: 3000 })).length).toBeGreaterThan(0)
  })

  it('blocks create-unit image uploads over 40 MB', async () => {
    renderApp()
    const user = userEvent.setup()

    await openLoginPage(user)
    await signInAs(user, /continue as admin/i)
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

    await openLoginPage(user)
    await signInAs(user, /continue as admin/i)
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

    await openLoginPage(user)
    await signInAs(user, /continue as admin/i)
    await user.click((await screen.findAllByRole('button', { name: /^admin$/i }))[0])

    await chooseFromSelect(user, /^role$/i, /sales representative/i)
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

    await user.click(screen.getByRole('button', { name: /set password/i }))
    const passwordForm = screen.getByRole('button', { name: /update password/i }).closest('form')
    expect(passwordForm).not.toBeNull()
    await user.type(within(passwordForm as HTMLFormElement).getByLabelText(/^new password$/i), 'LeadraNew!2026')
    await user.type(within(passwordForm as HTMLFormElement).getByLabelText(/confirm password/i), 'Different!2026')
    await user.click(screen.getByRole('button', { name: /update password/i }))

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument()
  })

  it('lets an admin toggle unit status and manage the shared unit note', async () => {
    renderApp()
    const user = userEvent.setup()

    await openLoginPage(user)
    await signInAs(user, /continue as admin/i)
    await user.click(screen.getByRole('link', { name: /view all units/i }))
    await user.click(screen.getByRole('button', { name: /open NE105BR3Ba2/i }))

    expect(await screen.findByRole('heading', { name: /NE105BR3Ba2/i })).toBeInTheDocument()
    expect(await screen.findByText(/unit thumbnail/i, undefined, { timeout: 3000 })).toBeInTheDocument()
    expect(await screen.findByText(/landscape/i)).toBeInTheDocument()
    expect(await screen.findByText(/furnishing status/i)).toBeInTheDocument()
    expect(await screen.findByText(/finish type/i)).toBeInTheDocument()
    expect(await screen.findByText(/installments table/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /mark hold/i }))
    expect(await screen.findByText(/unit marked hold/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /mark sold/i }))
    expect(await screen.findByText(/unit marked sold/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /clear status/i }))
    expect(await screen.findByText(/unit marked available/i)).toBeInTheDocument()

    const noteInput = await screen.findByLabelText(/edit shared unit note/i, undefined, { timeout: 3000 })
    await user.clear(noteInput)
    await user.type(noteInput, 'This unit is clear for relisting.')
    await user.click(screen.getByRole('button', { name: /save note/i }))
    expect(await screen.findByText(/shared unit note saved/i)).toBeInTheDocument()
    expect(await screen.findByDisplayValue(/this unit is clear for relisting\./i, undefined, { timeout: 3000 })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /delete note/i }))
    expect(await screen.findByText(/shared unit note deleted/i)).toBeInTheDocument()
    expect(screen.queryByText(/this unit is clear for relisting\./i)).not.toBeInTheDocument()
  }, 10000)
})
