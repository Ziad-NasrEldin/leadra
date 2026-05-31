import { readFileSync } from 'node:fs'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { demoUsers, initialAppState, lookupValues, seedUnits } from './data/seed'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, resolve, reject }
}

async function renderSupabaseApp(options: {
  workspacePromise: Promise<unknown>
  profile?: typeof demoUsers[number]
  repositorySearchUnits?: ReturnType<typeof vi.fn>
}) {
  const profile = options.profile ?? demoUsers[0]
  const signInWithPassword = vi.fn(async () => ({ data: { user: { id: profile.id, email: profile.email } }, error: null }))
  const signOut = vi.fn(async () => ({ error: null }))
  const unsubscribe = vi.fn()
  const channel = {
    on: vi.fn(() => channel),
    subscribe: vi.fn(() => channel),
  }
  const supabaseMock = {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe } } })),
      signInWithPassword,
      signOut,
    },
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(async () => null),
  }

  vi.resetModules()
  vi.doMock('./lib/supabase', () => ({
    canUseDemoMode: false,
    isPerformanceDemoMode: false,
    isProductionMissingSupabaseConfig: false,
    isSupabaseConfigured: true,
    supabase: supabaseMock,
  }))
  vi.doMock('./lib/supabaseState', async () => {
    const actual = await vi.importActual<typeof import('./lib/supabaseState')>('./lib/supabaseState')
    return {
      ...actual,
      loadSupabaseProfile: vi.fn(async () => ({ ...profile, status: 'active' })),
      loadSupabaseAppState: vi.fn(() => options.workspacePromise),
      markSupabaseLogin: vi.fn(async () => null),
      loadSupabaseAnalyticsDashboard: vi.fn(),
      setSupabaseThemePreference: vi.fn(),
    }
  })
  if (options.repositorySearchUnits) {
    const repositorySearchUnits = options.repositorySearchUnits
    vi.doMock('./lib/repository', () => ({
      LeadraRepository: class {
        searchUnits = repositorySearchUnits
      },
    }))
  }

  const { default: App } = await import('./App')
  const { LocaleProvider } = await import('./lib/i18n')
  const { ThemeProvider } = await import('./lib/theme')
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const result = render(
    <ThemeProvider>
      <LocaleProvider>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </LocaleProvider>
    </ThemeProvider>,
  )

  await waitFor(() => expect(screen.getByRole('button', { name: /sign in/i })).toBeEnabled())
  return { ...result, signInWithPassword, signOut }
}

describe('mobile Supabase hydration guards', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/')
    window.localStorage.clear()
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('keeps workspace-dependent routes gated when full workspace hydration fails', async () => {
    window.history.replaceState(null, '', '/create')
    const workspace = deferred<unknown>()
    const user = userEvent.setup()
    await renderSupabaseApp({ workspacePromise: workspace.promise })

    await user.type(screen.getByLabelText(/email/i), 'admin@leadra.test')
    await user.type(screen.getByLabelText(/^password/i), 'Leadra8!')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByTestId('workspace-loading-state')).toBeInTheDocument()
    workspace.reject(new Error('workspace down'))

    expect(await screen.findByText(/workspace could not load/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^create unit$/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/owner information/i)).not.toBeInTheDocument()
  })

  it('runs project remote search after project route navigation settles', async () => {
    const searchUnits = vi.fn(async () => seedUnits.filter((unit) => unit.projectId === 'project-new-cairo'))
    const user = userEvent.setup()
    await renderSupabaseApp({
      workspacePromise: Promise.resolve({ state: initialAppState, lookupValues }),
      repositorySearchUnits: searchUnits,
    })

    await user.type(screen.getByLabelText(/email/i), 'admin@leadra.test')
    await user.type(screen.getByLabelText(/^password/i), 'Leadra8!')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await user.click(await screen.findByRole('link', { name: /view all units/i }))
    await user.click(await screen.findByRole('button', { name: /^new cairo/i }))
    await user.click(await screen.findByRole('button', { name: /new cairo estates/i }))

    await waitFor(() => expect(window.location.pathname).toBe('/units/destinations/dest-new-cairo/projects/project-new-cairo'))
    await waitFor(() => expect(searchUnits).toHaveBeenCalledTimes(1))
    expect(searchUnits).toHaveBeenCalledWith(expect.objectContaining({
      destinationId: 'dest-new-cairo',
      projectId: 'project-new-cairo',
    }))
  })

  it('keeps project click handlers free of direct remote-search scheduling', () => {
    const source = readFileSync(`${process.cwd()}/src/App.tsx`, 'utf8')
    const projectSelectHandler = source.match(/onProjectSelect=\{\(id\) => \{[\s\S]*?onBackToDestinations=/)?.[0] ?? ''

    expect(projectSelectHandler).toContain('navigateToPath(projectPath(activeSelectedDestinationId, id))')
    expect(projectSelectHandler).not.toContain('loadRemoteUnitSearch')
    expect(projectSelectHandler).not.toContain('remoteSearchDebounceRef.current = window.setTimeout')
  })
})
