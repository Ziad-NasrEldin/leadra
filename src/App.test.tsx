import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { LocaleProvider } from './lib/i18n'
import { ThemeProvider } from './lib/theme'

const originalCreateObjectURL = URL.createObjectURL
const originalRevokeObjectURL = URL.revokeObjectURL

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <ThemeProvider>
      <LocaleProvider>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </LocaleProvider>
    </ThemeProvider>,
  )
}

async function openLoginPage(user: ReturnType<typeof userEvent.setup>) {
  const introButton = screen.queryByRole('button', { name: /continue to sign in/i })
  if (introButton) await user.click(introButton)
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

async function openNewCairoProject(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /^new cairo/i }))
  await user.click(await screen.findByRole('button', { name: /new cairo estates/i }))
}

function navigateTestPath(path: string) {
  act(() => {
    window.history.pushState(null, '', path)
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
}

async function openSeedUnitDetails(user: ReturnType<typeof userEvent.setup>) {
  await openLoginPage(user)
  await signInAs(user, /continue as admin/i)
  await user.click(screen.getByRole('link', { name: /view all units/i }))
  await openNewCairoProject(user)
  await user.click(await screen.findByRole('button', { name: /open nc3br/i }))
  expect(await screen.findByRole('heading', { name: /NC3BR/i })).toBeInTheDocument()
  expect(await screen.findByRole('heading', { name: /media gallery/i }, { timeout: 4000 })).toBeInTheDocument()
}

describe('Leadra app shell', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/')
    window.localStorage.clear()
    delete document.documentElement.dataset.theme
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectURL })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevokeObjectURL })
  })

  it('lets a demo user enter the destination-first unit browser', async () => {
    renderApp()
    const user = userEvent.setup()

    expect(screen.getByRole('heading', { name: /sign in to leadra/i })).toBeInTheDocument()
    await openLoginPage(user)
    await signInAs(user, /continue as admin/i)

    expect(await screen.findByRole('heading', { name: /admin command/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /teams by inventory/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /developers by inventory/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /destinations by inventory/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /projects by inventory/i })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: /view all units/i }))

    expect(await screen.findByRole('heading', { name: /choose a destination/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^new cairo/i }))
    expect(window.location.pathname).toBe('/units/destinations/dest-new-cairo')
    expect(await screen.findByRole('button', { name: /new cairo estates/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^sheikh zayed\s/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /new cairo estates/i }))
    expect(window.location.pathname).toBe('/units/destinations/dest-new-cairo/projects/project-new-cairo')
    expect(await screen.findByText(/NC3BR/i)).toBeInTheDocument()
    expect(screen.queryByText(/ZE4BR/i)).not.toBeInTheDocument()
  })

  it('does not leave a sales user on the admin page after signing out from admin', async () => {
    renderApp()
    const user = userEvent.setup()

    await openLoginPage(user)
    await signInAs(user, /continue as admin/i)
    await user.click((await screen.findAllByRole('link', { name: /^admin$/i }))[0])
    expect(await screen.findByRole('heading', { name: /user management/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /sign out/i }))
    await openLoginPage(user)
    await signInAs(user, /continue as sara amin/i)

    expect(await screen.findByRole('heading', { name: /sara command/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /user management/i })).not.toBeInTheDocument()
  })

  it('toggles the account theme from the shell and profile settings', async () => {
    renderApp()
    const user = userEvent.setup()

    await openLoginPage(user)
    await signInAs(user, /continue as admin/i)

    expect(await screen.findByRole('heading', { name: /admin command/i })).toBeInTheDocument()
    expect(document.documentElement.dataset.theme).toBe('light')

    await user.click(screen.getByRole('button', { name: /switch to dark theme/i }))
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'))
    expect(window.localStorage.getItem('leadra.theme')).toBe('dark')

    navigateTestPath('/profile')
    const themeSettingsHeading = await screen.findByRole('heading', { name: /theme settings/i })
    const themeSettingsCard = themeSettingsHeading.closest('.profile-language-card')
    expect(themeSettingsCard).not.toBeNull()
    await user.click(within(themeSettingsCard as HTMLElement).getByRole('button', { name: /switch to light theme/i }))
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('light'))
    expect(window.localStorage.getItem('leadra.theme')).toBe('light')
  })

  it('keeps the theme toggle out of the mobile more menu', async () => {
    renderApp()
    const user = userEvent.setup()

    await openLoginPage(user)
    await signInAs(user, /continue as admin/i)
    expect(await screen.findByRole('heading', { name: /admin command/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^more$/i }))
    const mobileMoreSheet = screen.getByRole('menu', { name: /more mobile destinations/i })
    expect(within(mobileMoreSheet).queryByRole('button', { name: /switch to dark theme/i })).not.toBeInTheDocument()
    expect(mobileMoreSheet.querySelector('.theme-toggle')).toBeNull()
    expect(within(mobileMoreSheet).getByRole('link', { name: /alerts/i })).toBeInTheDocument()
  })

  it('honors legacy units hash links after login and updates full routes during navigation', async () => {
    window.history.replaceState(null, '', '/#units')
    renderApp()
    const user = userEvent.setup()

    await openLoginPage(user)
    await signInAs(user, /continue as admin/i)

    expect(await screen.findByRole('heading', { name: /choose a destination/i })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/units')
    expect(window.location.hash).toBe('')
    await user.click(screen.getByRole('link', { name: /^create$/i }))
    expect(window.location.pathname).toBe('/create')
  })

  it('hydrates create, admin, master-data, and analytics subroutes', async () => {
    window.history.replaceState(null, '', '/create/payment')
    renderApp()
    const user = userEvent.setup()

    await openLoginPage(user)
    await signInAs(user, /continue as admin/i)

    expect(await screen.findByRole('group', { name: /payment/i })).toHaveAttribute('data-active', 'true')
    await user.click(screen.getByRole('button', { name: /owner/i }))
    expect(window.location.pathname).toBe('/create/owner')

    navigateTestPath('/admin/audit')
    expect(await screen.findByRole('heading', { name: /audit log/i })).toBeInTheDocument()

    navigateTestPath('/admin/master-data/branches')
    expect((await screen.findAllByRole('heading', { name: /branch management/i })).length).toBeGreaterThan(0)

    navigateTestPath('/analytics/custom?filters=open&status=available&start=2026-01-01&end=2026-01-31')
    expect(await screen.findByRole('button', { name: /close filters/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/start/i)).toHaveValue('2026-01-01')
    expect(screen.getAllByLabelText(/end/i)[0]).toHaveValue('2026-01-31')
    expect(screen.getByRole('combobox', { name: /status/i })).toHaveTextContent(/available/i)
  })

  it('keeps unauthorized sales users out of deep admin routes', async () => {
    window.history.replaceState(null, '', '/admin/audit')
    renderApp()
    const user = userEvent.setup()

    await openLoginPage(user)
    await signInAs(user, /continue as sara amin/i)

    expect(await screen.findByRole('heading', { name: /sara command/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /audit log/i })).not.toBeInTheDocument()
  })

  it('toggles media PDF visibility without remounting the details page', async () => {
    renderApp()
    const user = userEvent.setup()

    await openSeedUnitDetails(user)
    await user.click(screen.getAllByRole('button', { name: /show in pdf/i })[0])

    expect(screen.getAllByRole('button', { name: /hide from pdf/i }).length).toBeGreaterThan(0)
    expect(screen.queryByText(/preparing details/i)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /media gallery/i })).toBeInTheDocument()
    expect(window.location.pathname).toMatch(/^\/units\/details\/\d+$/)
  })

  it('shows analytics to managers but not sales users', async () => {
    renderApp()
    const user = userEvent.setup()

    await openLoginPage(user)
    await signInAs(user, /continue as mona hafez/i)
    await user.click((await screen.findAllByRole('link', { name: /^analytics$/i }))[0])

    expect(await screen.findByRole('heading', { name: /company analytics/i })).toBeInTheDocument()
    expect(screen.getByText(/company-wide/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /sign out/i }))
    await openLoginPage(user)
    await signInAs(user, /continue as sara amin/i)

    expect(screen.queryAllByRole('button', { name: /^analytics$/i })).toHaveLength(0)
    expect(screen.queryByRole('heading', { name: /company analytics/i })).not.toBeInTheDocument()
  })

  it('shows a sales user only their own latest uploads and a 72-hour upload warning', async () => {
    renderApp()
    const user = userEvent.setup()

    await openLoginPage(user)
    await signInAs(user, /continue as sara amin/i)

    expect(await screen.findByRole('heading', { name: /latest my uploads/i })).toBeInTheDocument()
    expect(screen.getAllByText(/my uploads/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/upload inactivity warning/i)).toBeInTheDocument()
    expect(screen.getByText(/latest upload was on/i)).toBeInTheDocument()
    expect(screen.getAllByText(/NC3BR/i).length).toBeGreaterThan(0)
    expect(screen.queryByText(/ZE4BR/i)).not.toBeInTheDocument()
  })

  it('lets admins interact with analytics ranges, filters, charts, and CSV export', async () => {
    renderApp()
    const user = userEvent.setup()

    await openLoginPage(user)
    await signInAs(user, /continue as admin/i)
    await user.click((await screen.findAllByRole('link', { name: /^analytics$/i }))[0])

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

  it('highlights dropdown options by first letter before selecting with Enter', async () => {
    renderApp()
    const user = userEvent.setup()

    await openLoginPage(user)
    await signInAs(user, /continue as admin/i)
    await user.click(screen.getByRole('link', { name: /^create$/i }))

    const unitTypeSelect = await screen.findByRole('combobox', { name: /unit type/i })
    await user.click(unitTypeSelect)
    await user.keyboard('s')

    const standAloneOption = screen.getByRole('option', { name: /^stand alone$/i })
    expect(standAloneOption).toHaveClass('is-highlighted')
    expect(standAloneOption).not.toHaveAttribute('aria-selected', 'true')
    expect(unitTypeSelect).toHaveTextContent(/apartment/i)

    await user.keyboard('s')
    const seniorChaletOption = screen.getByRole('option', { name: /^senior chalet$/i })
    expect(seniorChaletOption).toHaveClass('is-highlighted')
    expect(standAloneOption).not.toHaveClass('is-highlighted')

    await user.keyboard('{Enter}')
    expect(unitTypeSelect).toHaveTextContent(/senior chalet/i)
    expect(screen.queryByRole('option', { name: /^senior chalet$/i })).not.toBeInTheDocument()
  })

  it('uses a create-unit wizard and still submits the complete form', async () => {
    renderApp()
    const user = userEvent.setup()

    await openLoginPage(user)
    await signInAs(user, /continue as admin/i)
    await user.click(screen.getByRole('link', { name: /^create$/i }))

    expect(await screen.findByRole('button', { name: /property/i })).toBeInTheDocument()
    const destinationSelect = screen.getByRole('combobox', { name: /destination/i })
    const developerSelect = screen.getByRole('combobox', { name: /developer/i })
    expect(destinationSelect.compareDocumentPosition(developerSelect) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(destinationSelect.closest('label')?.querySelector('.required-marker')).not.toBeNull()
    expect(developerSelect.closest('label')?.querySelector('.required-marker')).not.toBeNull()
    expect(screen.getByRole('combobox', { name: /unit type/i }).closest('label')?.querySelector('.required-marker')).not.toBeNull()
    await chooseFromSelect(user, /unit type/i, /^penthouse$/i)
    expect(screen.queryByRole('combobox', { name: /^floor/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('spinbutton', { name: /land area/i })).not.toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: /terrace area/i })).toBeInTheDocument()
    await chooseFromSelect(user, /unit type/i, /^apartment$/i)
    await user.click(screen.getByRole('combobox', { name: /^floor/i }))
    expect(screen.getByRole('option', { name: /^ground$/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /^40th$/i })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /^roof$/i })).not.toBeInTheDocument()
    await user.click(screen.getByRole('option', { name: /^ground$/i }))
    expect(screen.getByRole('spinbutton', { name: /garden area/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /specs/i }))
    expect(screen.getByRole('spinbutton', { name: /bedrooms/i })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /view/i })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /furnished/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /payment/i }))
    expect(screen.getByRole('spinbutton', { name: /total amount/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /owner/i }))
    expect(screen.getByRole('combobox', { name: /delivery date/i })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /country code/i })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /original owner phone/i })).toHaveValue('01012345678')
    await chooseFromSelect(user, /country code/i, /uae \+971/i)
    expect(screen.getByRole('textbox', { name: /original owner phone/i })).toHaveAttribute('placeholder', '0501234567')
    await user.clear(screen.getByRole('textbox', { name: /original owner phone/i }))
    await user.type(screen.getByRole('textbox', { name: /original owner phone/i }), '0501234568')

    await user.click(screen.getByRole('button', { name: /review/i }))
    const image = new File(
      [Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lZrD9wAAAABJRU5ErkJggg=='), (char) => char.charCodeAt(0))],
      'living-room.png',
      { type: 'image/png' },
    )
    await user.upload(screen.getByLabelText(/unit images/i), image)
    expect(await screen.findByText(/living-room.png/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /create unit and notify team/i }))

    expect(await screen.findByRole('heading', { name: /NC3BR/i })).toBeInTheDocument()
    expect((await screen.findAllByAltText(/living-room.png/i, undefined, { timeout: 3000 })).length).toBeGreaterThan(0)
  })

  it('lets admins edit property, owner, and PRD pricing fields inline from unit details', async () => {
    renderApp()
    const user = userEvent.setup()

    await openSeedUnitDetails(user)
    await user.click(screen.getByRole('button', { name: /edit unit/i }))
    await user.clear(screen.getByRole('spinbutton', { name: /bua/i }))
    await user.type(screen.getByRole('spinbutton', { name: /bua/i }), '188')
    await user.clear(screen.getByRole('spinbutton', { name: /total amount/i }))
    await user.type(screen.getByRole('spinbutton', { name: /total amount/i }), '5500000')
    await user.clear(screen.getByRole('textbox', { name: /original owner name/i }))
    await user.type(screen.getByRole('textbox', { name: /original owner name/i }), 'Updated Owner')
    await user.clear(screen.getByRole('textbox', { name: /original owner phone/i }))
    await user.type(screen.getByRole('textbox', { name: /original owner phone/i }), '0501234568')
    await user.click(screen.getByRole('button', { name: /save unit changes/i }))

    expect(await screen.findByText(/unit details updated/i)).toBeInTheDocument()
    expect((await screen.findAllByText(/188 m²/i)).length).toBeGreaterThan(0)
    expect(screen.getByText(/updated owner/i)).toBeInTheDocument()
    expect(screen.getAllByText(/4,000,000/i).length).toBeGreaterThan(0)
  })

  it('lets managers edit team unit details while keeping owner and pricing fields locked', async () => {
    renderApp()
    const user = userEvent.setup()

    await openLoginPage(user)
    await signInAs(user, /continue as mona hafez/i)
    await user.click(screen.getByRole('button', { name: /view all units/i }))
    await openNewCairoProject(user)
    await user.click(await screen.findByRole('button', { name: /open nc3br/i }))
    expect(await screen.findByRole('heading', { name: /NC3BR/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /edit unit/i }))

    expect(screen.getByRole('spinbutton', { name: /total amount/i })).toBeDisabled()
    expect(screen.getByRole('textbox', { name: /original owner name/i })).toBeDisabled()
    await user.clear(screen.getByRole('spinbutton', { name: /bua/i }))
    await user.type(screen.getByRole('spinbutton', { name: /bua/i }), '172')
    await user.click(screen.getByRole('button', { name: /save unit changes/i }))

    expect(await screen.findByText(/unit details updated/i)).toBeInTheDocument()
    expect(await screen.findByText(/172 m²/i)).toBeInTheDocument()
  })

  it('hides edit mode from sales users on units they did not upload', async () => {
    navigateTestPath('/units/details/106')
    renderApp()
    const user = userEvent.setup()

    await openLoginPage(user)
    await signInAs(user, /continue as sara amin/i)

    expect(await screen.findByRole('heading', { name: /ZE4BR/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit unit/i })).not.toBeInTheDocument()
  })

  it('blocks create-unit image uploads over 40 MB', async () => {
    renderApp()
    const user = userEvent.setup()

    await openLoginPage(user)
    await signInAs(user, /continue as admin/i)
    await user.click(screen.getByRole('link', { name: /^create$/i }))
    await user.click(screen.getByRole('button', { name: /review/i }))

    const oversized = new File(['x'], 'oversized.jpg', { type: 'image/jpeg' })
    Object.defineProperty(oversized, 'size', { value: 41 * 1024 * 1024 })
    await user.upload(screen.getByLabelText(/unit images/i), oversized)

    expect(await screen.findByText(/total media size exceeds 40 mb/i)).toBeInTheDocument()
  })

  it('downloads uploaded media through a Blob without navigating the current tab', async () => {
    renderApp()
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Blob(['image-bytes'], { type: 'image/jpeg' })))
    const createObjectUrl = vi.fn(() => 'blob:leadra-media')
    const revokeObjectUrl = vi.fn()
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    const openFallback = vi.spyOn(window, 'open').mockImplementation(() => null)
    vi.stubGlobal('fetch', fetchMock)
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectUrl })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectUrl })

    await openSeedUnitDetails(user)
    const startingPath = window.location.pathname
    await user.click(screen.getByRole('button', { name: /download living-room\.jpg/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('images.unsplash.com')))
    expect(createObjectUrl).toHaveBeenCalled()
    expect(anchorClick).toHaveBeenCalled()
    expect(openFallback).not.toHaveBeenCalled()
    expect(window.location.pathname).toBe(startingPath)
  })

  it('opens uploaded media in a new tab when direct Blob download is blocked', async () => {
    renderApp()
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('CORS blocked')))
    const openFallback = vi.spyOn(window, 'open').mockImplementation(() => null)

    await openSeedUnitDetails(user)
    const startingPath = window.location.pathname
    await user.click(screen.getByRole('button', { name: /download living-room\.jpg/i }))

    await waitFor(() => expect(openFallback).toHaveBeenCalledWith(expect.stringContaining('images.unsplash.com'), '_blank', 'noopener,noreferrer'))
    expect(window.location.pathname).toBe(startingPath)
  })

  it('disables the media download button while the file is being prepared', async () => {
    renderApp()
    const user = userEvent.setup()
    let resolveFetch: ((response: Response) => void) | undefined
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => {
      resolveFetch = resolve
    })))
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:leadra-media') })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)

    await openSeedUnitDetails(user)
    const downloadButton = screen.getByRole('button', { name: /download living-room\.jpg/i })
    await user.click(downloadButton)

    expect(downloadButton).toBeDisabled()
    resolveFetch?.(new Response(new Blob(['image-bytes'], { type: 'image/jpeg' })))
    await waitFor(() => expect(downloadButton).not.toBeDisabled())
  })

  it('uses an admin wizard while preserving create-user and settings submits', async () => {
    renderApp()
    const user = userEvent.setup()

    await openLoginPage(user)
    await signInAs(user, /continue as admin/i)
    await user.click((await screen.findAllByRole('link', { name: /^admin$/i }))[0])

    expect(await screen.findByRole('button', { name: /^users$/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /new user/i }))
    await user.type(screen.getByRole('textbox', { name: /full name/i }), 'Adapted User')
    await user.type(screen.getByRole('textbox', { name: /email/i }), 'adapted@leadra.test')
    const createPassword = screen.getByLabelText(/^new password/i)
    const createConfirmPassword = screen.getByLabelText(/^confirm password/i)
    expect(createPassword).toHaveAttribute('type', 'password')
    expect(createConfirmPassword).toHaveAttribute('type', 'password')
    await user.click(screen.getAllByRole('button', { name: /show password/i })[0])
    await user.click(screen.getAllByRole('button', { name: /show password/i })[0])
    expect(createPassword).toHaveAttribute('type', 'text')
    expect(createConfirmPassword).toHaveAttribute('type', 'text')
    await user.type(createPassword, 'Leadra8!')
    await user.type(createConfirmPassword, 'Leadra8!')
    expect(screen.getByRole('combobox', { name: /^branch$/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^create user$/i }))
    expect(await screen.findByText(/adapted user/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^settings$/i }))
    await user.clear(screen.getByRole('spinbutton', { name: /commission percentage/i }))
    await user.type(screen.getByRole('spinbutton', { name: /commission percentage/i }), '2')
    await user.click(screen.getByRole('button', { name: /^save settings$/i }))
    expect(await screen.findByText(/settings updated and audited/i)).toBeInTheDocument()

    const auditTabs = await screen.findAllByRole('button', { name: /^audit$/i })
    await user.click(auditTabs[auditTabs.length - 1])
    expect(await screen.findByRole('heading', { name: /audit log/i })).toBeInTheDocument()
  })

  it('lets admins create master data values and branches', async () => {
    renderApp()
    const user = userEvent.setup()

    await openLoginPage(user)
    await signInAs(user, /continue as admin/i)
    await user.click((await screen.findAllByRole('link', { name: /^admin$/i }))[0])
    await user.click(screen.getByRole('button', { name: /master data/i }))

    expect(await screen.findByRole('heading', { name: /master data/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /destinations/i }))
    await user.type(screen.getByRole('textbox', { name: /value label/i }), 'North Coast')
    const destinationThumb = new File(['destination'], 'north-coast.png', { type: 'image/png' })
    await user.upload(screen.getByLabelText(/thumbnail image/i), destinationThumb)
    await user.click(screen.getByRole('button', { name: /add value/i }))
    expect(await screen.findByText(/north coast/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^projects/i }))
    await user.type(screen.getByRole('textbox', { name: /value label/i }), 'Zim')
    expect(screen.queryByRole('textbox', { name: /thumbnail url/i })).not.toBeInTheDocument()
    const projectThumb = new File(['project'], 'zim.png', { type: 'image/png' })
    await user.upload(screen.getByLabelText(/thumbnail image/i), projectThumb)
    await user.click(screen.getByRole('button', { name: /add value/i }))
    expect(await screen.findByText(/zim/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /branch management/i }))
    await user.type(screen.getByRole('textbox', { name: /branch name/i }), 'Alexandria Branch')
    await user.click(screen.getByRole('button', { name: /add branch/i }))
    expect(await screen.findByText(/alexandria branch/i)).toBeInTheDocument()
  })

  it('filters and edits users in admin user management', async () => {
    renderApp()
    const user = userEvent.setup()

    await openLoginPage(user)
    await signInAs(user, /continue as admin/i)
    await user.click((await screen.findAllByRole('link', { name: /^admin$/i }))[0])

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
    const updatePassword = within(passwordForm as HTMLFormElement).getByLabelText(/^new password/i)
    const updateConfirmPassword = within(passwordForm as HTMLFormElement).getByLabelText(/^confirm password/i)
    expect(updatePassword).toHaveAttribute('type', 'password')
    expect(updateConfirmPassword).toHaveAttribute('type', 'password')
    await user.click(within(passwordForm as HTMLFormElement).getAllByRole('button', { name: /show password/i })[0])
    await user.click(within(passwordForm as HTMLFormElement).getAllByRole('button', { name: /show password/i })[0])
    expect(updatePassword).toHaveAttribute('type', 'text')
    expect(updateConfirmPassword).toHaveAttribute('type', 'text')
    await user.type(updatePassword, 'Leadra8!')
    await user.type(updateConfirmPassword, 'Different!2026')
    await user.click(screen.getByRole('button', { name: /update password/i }))

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument()
  })

  it('requires reassignment before removing a sales representative from user management', async () => {
    renderApp()
    const user = userEvent.setup()

    await openLoginPage(user)
    await signInAs(user, /continue as admin/i)
    await user.click((await screen.findAllByRole('link', { name: /^admin$/i }))[0])

    await user.click(screen.getByRole('button', { name: /new user/i }))
    await user.type(screen.getByRole('textbox', { name: /full name/i }), 'Omar Replacement')
    await user.type(screen.getByRole('textbox', { name: /email/i }), 'omar.replacement@leadra.test')
    await user.type(screen.getByLabelText(/^new password/i), 'Leadra8!')
    await user.type(screen.getByLabelText(/confirm password/i), 'Leadra8!')
    await user.click(screen.getByRole('button', { name: /^create user$/i }))
    expect(await screen.findByText(/omar replacement/i)).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByRole('combobox', { name: /^role$/i })).toHaveLength(1))

    await chooseFromSelect(user, /^role$/i, /sales representative/i)
    const managedUsers = screen.getByLabelText(/managed users/i)
    await user.click(within(managedUsers).getByRole('button', { name: /deactivate sara amin/i }))
    await chooseFromSelect(user, /replacement sales representative/i, /omar replacement/i)
    await user.click(screen.getByRole('button', { name: /reassign and deactivate sales rep/i }))

    expect(await screen.findByText(/sales representative deactivated after reassignment/i)).toBeInTheDocument()
    expect(screen.queryByText(/sara amin/i)).not.toBeInTheDocument()
  })

  it('removes a manager from user management without a sales reassignment step', async () => {
    renderApp()
    const user = userEvent.setup()

    await openLoginPage(user)
    await signInAs(user, /continue as admin/i)
    await user.click((await screen.findAllByRole('link', { name: /^admin$/i }))[0])

    await chooseFromSelect(user, /^role$/i, /manager/i)
    const managedUsers = screen.getByLabelText(/managed users/i)
    await user.click(within(managedUsers).getByRole('button', { name: /deactivate mona hafez/i }))
    expect(screen.queryByLabelText(/replacement sales representative/i)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^deactivate user$/i }))

    expect(await screen.findByText(/user deactivated and audit history updated/i)).toBeInTheDocument()
    expect(screen.queryByText(/mona hafez/i)).not.toBeInTheDocument()
  })

  it('lets admins upload a company logo image instead of typing a path', async () => {
    renderApp()
    const user = userEvent.setup()

    await signInAs(user, /continue as admin/i)
    navigateTestPath('/admin/settings')

    expect(await screen.findByText(/^company logo$/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/logo path/i)).not.toBeInTheDocument()

    const logo = new File(['logo'], 'leadra-logo.png', { type: 'image/png' })
    await user.upload(screen.getByLabelText(/upload image/i), logo)

    await waitFor(() => {
      expect(screen.getByRole('img', { name: /company logo preview/i })).toHaveAttribute('src', expect.stringMatching(/^data:image\/png;base64,/))
    })
    await user.click(screen.getByRole('button', { name: /save settings/i }))

    expect(await screen.findByText(/settings updated and audited/i)).toBeInTheDocument()
  })

  it('hides inactive users from default user management results after persistence reloads', async () => {
    renderApp()
    const user = userEvent.setup()

    await openLoginPage(user)
    await signInAs(user, /continue as admin/i)
    await user.click((await screen.findAllByRole('link', { name: /^admin$/i }))[0])

    await chooseFromSelect(user, /^role$/i, /manager/i)
    await user.click(screen.getByRole('button', { name: /edit user/i }))
    const editForm = screen.getByRole('button', { name: /save user/i }).closest('form')
    expect(editForm).not.toBeNull()
    await user.click(within(editForm as HTMLFormElement).getByRole('combobox', { name: /status/i }))
    await user.click(screen.getByRole('option', { name: /inactive/i }))
    await user.click(screen.getByRole('button', { name: /save user/i }))

    expect(await screen.findByText(/user profile updated and audit history updated/i)).toBeInTheDocument()
    expect(screen.queryByText(/mona hafez/i)).not.toBeInTheDocument()
  })

  it('lets an admin toggle unit status and manage the shared unit note', async () => {
    renderApp()
    const user = userEvent.setup()

    await openLoginPage(user)
    await signInAs(user, /continue as admin/i)
    await user.click(screen.getByRole('link', { name: /view all units/i }))
    await openNewCairoProject(user)
    await user.click(screen.getByRole('button', { name: /open NC3BR/i }))

    expect(await screen.findByRole('heading', { name: /NC3BR/i })).toBeInTheDocument()
    expect(await screen.findByText(/media gallery/i, undefined, { timeout: 3000 })).toBeInTheDocument()
    expect(await screen.findByText(/landscape/i)).toBeInTheDocument()
    expect(screen.queryByText(/furnishing status/i)).not.toBeInTheDocument()
    expect(await screen.findByText(/finishing/i)).toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: /living-room\.jpg/i }).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: /remove living-room\.jpg/i }))
    expect(await screen.findByText(/media removed from this unit/i)).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /living-room\.jpg/i })).not.toBeInTheDocument()
    expect(await screen.findByText(/installments table/i)).toBeInTheDocument()
    expect(screen.getByText(/remaining from timetable/i)).toBeInTheDocument()
    expect(screen.getAllByText(/^unpaid$/i).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /^unpaid$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^paid$/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /archive/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /mark hold/i }))
    expect(await screen.findByText(/unit marked hold/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /mark sold by us/i }))
    expect(await screen.findByText(/unit marked sold by us/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /mark sold by others/i }))
    expect(await screen.findByText(/unit marked sold by others/i)).toBeInTheDocument()

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

  it('hides unit archive action from managers', async () => {
    renderApp()
    const user = userEvent.setup()

    await openLoginPage(user)
    await signInAs(user, /continue as mona hafez/i)
    await user.click(screen.getByRole('button', { name: /view all units/i }))
    await openNewCairoProject(user)
    await user.click(screen.getByRole('button', { name: /open NC3BR/i }))

    expect(await screen.findByRole('heading', { name: /NC3BR/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /archive/i })).not.toBeInTheDocument()
  })
})
