import {
  ArrowRight,
  BarChart3,
  Bell,
  Building2,
  ChevronLeft,
  Download,
  FileText,
  Home,
  LogOut,
  Moon,
  MoreHorizontal,
  Plus,
  Settings,
  SlidersHorizontal,
  Star,
  Sun,
  Users,
} from 'lucide-react'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { BrowserRouter, Link, useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import leadraLogoDark from './assets/brand/leadra-logo-dark.jpeg'
import leadraLogoLight from './assets/brand/leadra-logo-light.jpeg'
import leadraMarkDark from './assets/brand/leadra-mark-dark.png'
import leadraMarkLight from './assets/brand/leadra-mark-light.png'
import leadraSidebarLogoDark from './assets/brand/leadra-sidebar-logo-dark.png'
import leadraSidebarLogoLight from './assets/brand/leadra-sidebar-logo-light.png'
import { demoUsers, initialAppState, lookupValues } from './data/seed'
import { buildPerformanceWorkspace } from './data/performanceSeed'
import { buildAnalyticsCsv, buildAnalyticsDashboard, canAccessAnalytics, defaultAnalyticsFilters } from './lib/analytics'
import {
  canEditOwnerFields,
  canEditUnitCommission,
  canEditUnitPricing,
  canManageUnitSpecialStatus,
  filterUnitsForUser,
  formatCurrency,
  isSoldStatus,
  normalizeReactiveUnitFilters,
  validateOwnerPhoneForCountry,
  searchUnits,
} from './lib/domain'
import {
  compareText,
  formatCount,
  formatDate,
  formatDateTime,
  formatShortDate,
  getAccountStatusLabel,
  getRoleLabel,
  getStatusLabel,
  getUserInitials,
  translate,
  useLocale,
  type LocaleCode,
} from './lib/i18n'
import {
  renderError,
  renderFlash,
  renderNotificationBody,
  renderNotificationTitle,
  type LocalizedFlashMessage,
} from './lib/messageRendering'
import { authPasswordCandidates, createManagedUserProfile, updateManagedUserPassword, updateManagedUserProfile } from './lib/adminAuth'
import { createUnitRemoteErrorFlash, mediaPdfVisibilityErrorFlash } from './lib/createUnitErrors'
import { buildPdfActionRecords, getOrGenerateUnitPdf, getOrGenerateUnitPdfs, pdfAnalyticsEventType, type GeneratedPdfCache, type PdfActionKind } from './lib/pdfWorkflow'
import { LeadraRepository } from './lib/repository'
import { buildSpecialUnitSocialCopy } from './lib/unitCopy'
import { canUseDemoMode, isPerformanceDemoMode, isProductionMissingSupabaseConfig, isSupabaseConfigured, supabase } from './lib/supabase'
import { loadSupabaseAnalyticsDashboard, loadSupabaseAppState, loadSupabaseProfile, markSupabaseLogin, setSupabaseThemePreference, createSupabaseShellState } from './lib/supabaseState'
import { useTheme, type ThemePreferenceOptions } from './lib/theme'
import {
  addAnalyticsEventWorkflow,
  archiveUnitWorkflow,
  createUnitWorkflow,
  createUserWorkflow,
  deleteManagedUserWorkflow,
  deleteSalesRepresentativeWorkflow,
  deleteUnitAdminNoteWorkflow,
  removeUnitMediaWorkflow,
  saveUnitAdminNoteWorkflow,
  setUnitSpecialWorkflow,
  updateSettingsWorkflow,
  updateUnitStatusWorkflow,
  updateUnitWorkflow,
} from './lib/workflows'
import { createAuditMessage, createFlashForStatus, createFlashMessage, createNotificationMessage } from './lib/systemMessages'
import { queueSalesInactivityWarnings } from './lib/notificationDelivery'
import {
  adminSectionPath,
  analyticsPath,
  createStepPath,
  destinationPath,
  legacyHashPath,
  masterDataPath,
  parseAppRoute,
  pathForView,
  projectPath,
  unitDetailsPath,
  type AdminSectionSlug,
  type AnalyticsWindowSlug,
  type AppRoute,
  type CreateStepSlug,
  type MasterDataDirectorySlug,
  type View,
} from './lib/routes'
import type {
  AnalyticsDashboard,
  AnalyticsChartPoint,
  AnalyticsDateWindow,
  AnalyticsFilters as LeadraAnalyticsFilters,
  AppDataState,
  BranchDirectoryItem,
  CreateUnitInput,
  LeadraMediaFile,
  LeadraUnit,
  LeadraUser,
  LookupKind,
  LookupValue,
  MessageParams,
  NotificationItem,
  PaymentMethod,
  ThemePreference,
  InstallmentType,
  UnitEditInput,
  UnitFilters,
  UnitStatus,
} from './lib/types'
import { AdminPage } from './features/admin/AdminPage'
import { CreateUnitPage } from './features/create/CreateUnitPage'
import { UnitDetailsPage } from './features/details/UnitDetailsPage'
import {
  buildTeamDashboardRollups,
  buildUnitDashboardRollups,
  summarizeDestinationsWithLookups,
  summarizeProjectsWithLookups,
  type DashboardRollup,
} from './features/dashboard/dashboardSummaries'
import { UnitListRow, UnitsPage } from './features/units/UnitsPage'
import { ControlledSelectField, EmptyState, InfoSection, Metric, MetricSkeletonGrid, MiniBar, NavButton, PageSkeleton, PasswordField } from './components/LeadraUi'
import { paymentMethodValues, supportsLookupThumbnail, unitStatusValues, type AdminSection, type CreateUnitStep, type MasterDataDirectory } from './features/shared/constants'
import { fileToDataUrl, removeLookupThumbnail, uploadLookupThumbnail } from './features/shared/media'
import {
  getUnitCustomInstallmentText,
  getUnitInstallmentEndMonth,
  getUnitInstallmentStartMonth,
  isAutomaticInstallmentType,
  parseOptionalFormDate,
  parseOptionalFormMonthDate,
  parseOptionalFormNumber,
  parseOptionalFormText,
  readFormBoolean,
  readFormEnum,
  readFormNumber,
  readFormString,
} from './features/shared/formUtils'
import { motionStyle } from './features/shared/motion'

type UnitsBrowserStage = 'destinations' | 'projects' | 'units'

type ActiveRouteState = {
  activeView: View
  routeDestinationId: string | null
  routeProjectId: string | null
  routeUnitId: number | null
  unitsBrowserStage: UnitsBrowserStage
  activeCreateStep: CreateUnitStep
  activeAdminSection: AdminSection
  activeMasterDataDirectory: MasterDataDirectory
}

function runPageTransition(update: () => void) {
  update()
}
type UiMessage = { message: string; messageKey?: string | null; messageParams?: MessageParams | null }

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error && 'message' in error) return String(error.message)
  return 'Please try again.'
}

const createStepFromSlug: Record<CreateStepSlug, CreateUnitStep> = {
  property: 'Property',
  specs: 'Specs',
  payment: 'Payment',
  owner: 'Owner',
  review: 'Review',
}

const createStepToSlug: Record<CreateUnitStep, CreateStepSlug> = {
  Property: 'property',
  Specs: 'specs',
  Payment: 'payment',
  Owner: 'owner',
  Review: 'review',
}

const adminSectionFromSlug: Record<AdminSectionSlug, AdminSection> = {
  users: 'Users',
  'master-data': 'Master Data',
  settings: 'Settings',
  metrics: 'Metrics',
  audit: 'Audit',
}

const adminSectionToSlug: Record<AdminSection, AdminSectionSlug> = {
  Users: 'users',
  'Master Data': 'master-data',
  Settings: 'settings',
  Metrics: 'metrics',
  Audit: 'audit',
}

const masterDataDirectoryFromSlug: Record<MasterDataDirectorySlug, MasterDataDirectory> = {
  developers: 'developer',
  destinations: 'destination',
  projects: 'project',
  views: 'view',
  finishes: 'finish',
  branches: 'branches',
  teams: 'teams',
}

const masterDataDirectoryToSlug: Record<MasterDataDirectory, MasterDataDirectorySlug> = {
  developer: 'developers',
  destination: 'destinations',
  project: 'projects',
  view: 'views',
  finish: 'finishes',
  branches: 'branches',
  teams: 'teams',
}

function deriveActiveRouteState(route: AppRoute, user: LeadraUser): ActiveRouteState {
  const routeDestinationId = route.view === 'units' ? route.destinationId : null
  const routeProjectId = route.view === 'units' ? route.projectId : null

  return {
    activeView: isViewAllowedForUser(route.view, user) ? route.view : 'dashboard',
    routeDestinationId,
    routeProjectId,
    routeUnitId: route.view === 'details' ? route.unitId : null,
    unitsBrowserStage: routeProjectId ? 'units' : routeDestinationId ? 'projects' : 'destinations',
    activeCreateStep: createStepFromSlug[route.createStep],
    activeAdminSection: adminSectionFromSlug[route.adminSection],
    activeMasterDataDirectory: masterDataDirectoryFromSlug[route.masterDataDirectory],
  }
}

function analyticsFiltersFromRoute(route: AppRoute): LeadraAnalyticsFilters {
  return {
    ...defaultAnalyticsFilters,
    dateWindow: route.analyticsWindow as AnalyticsDateWindow,
    startDate: route.analyticsFilters.start ?? undefined,
    endDate: route.analyticsFilters.end ?? undefined,
    teamIds: route.analyticsFilters.team,
    userIds: route.analyticsFilters.user,
    projectIds: route.analyticsFilters.project,
    developerIds: route.analyticsFilters.developer,
    destinationIds: route.analyticsFilters.destination,
    statuses: route.analyticsFilters.status.filter((status): status is UnitStatus => unitStatusValues.includes(status as UnitStatus)),
    paymentMethods: route.analyticsFilters.payment.filter((method): method is PaymentMethod => paymentMethodValues.includes(method as PaymentMethod)),
  }
}

function analyticsRouteForFilters(filters: LeadraAnalyticsFilters, filtersOpen: boolean): string {
  return analyticsPath(filters.dateWindow as AnalyticsWindowSlug, {
    filtersOpen,
    filters: {
      team: filters.teamIds,
      user: filters.userIds,
      project: filters.projectIds,
      developer: filters.developerIds,
      destination: filters.destinationIds,
      status: filters.statuses,
      payment: filters.paymentMethods,
      start: filters.startDate ?? null,
      end: filters.endDate ?? null,
    },
  })
}
const notificationPageSize = 60
const leadraBrandAssets: Record<ThemePreference, { logo: string; mark: string; sidebarLogo: string }> = {
  light: { logo: leadraLogoLight, mark: leadraMarkLight, sidebarLogo: leadraSidebarLogoLight },
  dark: { logo: leadraLogoDark, mark: leadraMarkDark, sidebarLogo: leadraSidebarLogoDark },
}


function getInitialWorkspace() {
  if (!isPerformanceDemoMode || typeof window === 'undefined') {
    return { state: initialAppState, lookupValues }
  }

  const parameter = new URLSearchParams(window.location.search).get('perfDataset')
  const stored = window.localStorage.getItem('leadra:perfDataset')
  const unitCount = Number(parameter ?? stored ?? 1000)
  const workspace = buildPerformanceWorkspace(Number.isFinite(unitCount) ? unitCount : 1000)
  window.localStorage.setItem('leadra:perfDataset', String(workspace.state.units.length))
  return workspace
}

export default function App() {
  return (
    <BrowserRouter>
      <LeadraApp />
    </BrowserRouter>
  )
}

function LeadraApp() {
  const { locale, t } = useLocale()
  const { themePreference, setThemePreference } = useTheme()
  const location = useLocation()
  const navigationType = useNavigationType()
  const routerNavigate = useNavigate()
  const currentRoutePath = `${location.pathname}${location.search}${location.hash}`
  const route = parseAppRoute(location.pathname, location.search, location.hash)
  const [initialWorkspace] = useState(getInitialWorkspace)
  const initialWorkspaceRef = useRef(initialWorkspace)
  const [currentUser, setCurrentUser] = useState<LeadraUser | null>(null)
  const routeStackRef = useRef<string[]>([currentRoutePath])
  const [routeStack, setRouteStack] = useState<string[]>([currentRoutePath])
  const [, setView] = useState<View>(() => route.view)
  const [appState, setAppState] = useState(initialWorkspace.state)
  const [activeLookupValues, setActiveLookupValues] = useState<LookupValue[]>(initialWorkspace.lookupValues)
  const [unitFilters, setUnitFilters] = useState<UnitFilters>({ status: 'all' })
  const [remoteSearchUnits, setRemoteSearchUnits] = useState<LeadraUnit[] | null>(null)
  const [remoteSearchView, setRemoteSearchView] = useState<'inventory' | 'special' | null>(null)
  const [remoteSearchLoading, setRemoteSearchLoading] = useState(false)
  const remoteSearchDebounceRef = useRef<number | null>(null)
  const remoteSearchRequestRef = useRef(0)
  const activeRouteRef = useRef({ view: route.view, destinationId: route.destinationId, projectId: route.projectId })
  const [workspaceHydrating, setWorkspaceHydrating] = useState(false)
  const [workspaceLoadFailed, setWorkspaceLoadFailed] = useState(false)
  const workspaceHydrationGenerationRef = useRef(0)
  const activeAuthUserIdRef = useRef<string | null>(null)
  const hydratingAuthUserRef = useRef<string | null>(null)
  const [flash, setFlash] = useState<LocalizedFlashMessage | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured)
  const [loginError, setLoginError] = useState<UiMessage | null>(null)
  const [generatingPdfUnitId, setGeneratingPdfUnitId] = useState<number | null>(null)
  const [sharingPdfUnitId, setSharingPdfUnitId] = useState<number | null>(null)
  const [batchPdfAction, setBatchPdfAction] = useState<'generate' | 'download' | 'share' | null>(null)
  const [selectedBatchUnitIds, setSelectedBatchUnitIds] = useState<number[]>([])
  const [updatingStatusUnitId, setUpdatingStatusUnitId] = useState<number | null>(null)
  const [updatingSpecialUnitId, setUpdatingSpecialUnitId] = useState<number | null>(null)
  const [statusActionFeedback, setStatusActionFeedback] = useState<{
    unitId: number
    status: UnitStatus
    state: 'saving' | 'saved'
  } | null>(null)
  const [removingMediaId, setRemovingMediaId] = useState<string | null>(null)
  const [downloadingMediaId, setDownloadingMediaId] = useState<string | null>(null)
  const [generatedPdfs, setGeneratedPdfs] = useState<GeneratedPdfCache>({})
  const completingAuthUserRef = useRef<string | null>(null)
  const explicitSignOutRef = useRef(false)
  const brandAssets = leadraBrandAssets[themePreference]

  useEffect(() => {
    const syncRouteStack = (nextStack: string[]) => {
      routeStackRef.current = nextStack
      // Route history is mirrored in a ref and state so the back button can render immediately after navigation.
      setRouteStack(nextStack)
    }

    if (!currentUser) {
      syncRouteStack([currentRoutePath])
      return
    }

    const stack = routeStackRef.current
    if (stack[stack.length - 1] === currentRoutePath) return

    let nextStack: string[]
    if (navigationType === 'REPLACE') {
      nextStack = [...stack.slice(0, -1), currentRoutePath]
    } else if (navigationType === 'POP') {
      const existingIndex = stack.lastIndexOf(currentRoutePath)
      nextStack = existingIndex >= 0 ? stack.slice(0, existingIndex + 1) : [currentRoutePath]
    } else {
      nextStack = [...stack, currentRoutePath]
    }

    syncRouteStack(nextStack)
  }, [currentRoutePath, currentUser, navigationType])

  function invalidateGeneratedPdf(unitId: number) {
    setGeneratedPdfs((items) => {
      if (!items[unitId]) return items
      const remaining = { ...items }
      delete remaining[unitId]
      return remaining
    })
  }

  async function recordPdfAction(unit: LeadraUnit, kind: PdfActionKind) {
    const { adminAudience, auditLog, auditMessage, notificationMessage, notifications } = buildPdfActionRecords(user, unit, kind)
    const eventType = pdfAnalyticsEventType(kind)
    setAppState((state) =>
      addAnalyticsEventWorkflow(
        {
          ...state,
          notifications: [
            ...notifications,
            ...state.notifications,
          ],
          auditLogs: [
            auditLog,
            ...state.auditLogs,
          ],
        },
        user,
        eventType,
        unit,
      ),
    )
    if (supabase && isSupabaseConfigured) {
      await new LeadraRepository(supabase).recordPdfAction(
        user,
        unit,
        eventType,
        auditMessage,
        notificationMessage,
        adminAudience,
      )
    }
  }

  const completeSupabaseLogin = useCallback(async (authUser: SupabaseUser) => {
    if (!supabase) return
    if (explicitSignOutRef.current) return
    if (completingAuthUserRef.current === authUser.id || hydratingAuthUserRef.current === authUser.id) return
    completingAuthUserRef.current = authUser.id
    try {
      setAuthLoading(true)
      const profile = await loadSupabaseProfile(supabase, authUser)
      if (profile.status !== 'active') {
        await supabase.auth.signOut()
        setLoginError({
          message: 'Inactive users cannot log in.',
          messageKey: 'error.inactiveProfile',
          messageParams: null,
        })
        setAuthLoading(false)
        return
      }

      const requestedView = parseAppRoute(window.location.pathname, window.location.search, window.location.hash).view
      const nextView = isViewAllowedForUser(requestedView, profile) ? requestedView : 'dashboard'
      setAppState(createSupabaseShellState(profile))
      setActiveLookupValues([])
      setRemoteSearchUnits(null)
      setRemoteSearchView(null)
      setRemoteSearchLoading(false)
      setCurrentUser(profile)
      setView(nextView)
      if (nextView !== requestedView) routerNavigate(pathForView(nextView), { replace: true })
      setLoginError(null)
      setWorkspaceLoadFailed(false)
      setAuthLoading(false)
      setWorkspaceHydrating(true)
      activeAuthUserIdRef.current = authUser.id
      hydratingAuthUserRef.current = authUser.id
      const hydrationGeneration = workspaceHydrationGenerationRef.current + 1
      workspaceHydrationGenerationRef.current = hydrationGeneration

      void markSupabaseLogin(supabase)
      void loadSupabaseAppState(supabase)
        .then((remote) => {
          if (workspaceHydrationGenerationRef.current !== hydrationGeneration || activeAuthUserIdRef.current !== authUser.id || explicitSignOutRef.current) return
          setAppState(remote.state)
          setActiveLookupValues(remote.lookupValues.length > 0 ? remote.lookupValues : lookupValues)
          remoteSearchRequestRef.current += 1
          setRemoteSearchUnits(null)
          setRemoteSearchView(null)
          setRemoteSearchLoading(false)
          setWorkspaceLoadFailed(false)
        })
        .catch((error) => {
          if (workspaceHydrationGenerationRef.current !== hydrationGeneration || activeAuthUserIdRef.current !== authUser.id || explicitSignOutRef.current) return
          console.warn('Supabase workspace load failed:', error)
          remoteSearchRequestRef.current += 1
          setRemoteSearchUnits(null)
          setRemoteSearchView(null)
          setRemoteSearchLoading(false)
          setWorkspaceLoadFailed(true)
          setFlash({ text: 'Workspace data is still loading or temporarily unavailable. Pull to refresh or try again shortly.', messageKey: null, messageParams: null })
        })
        .finally(() => {
          if (workspaceHydrationGenerationRef.current !== hydrationGeneration || activeAuthUserIdRef.current !== authUser.id) return
          hydratingAuthUserRef.current = null
          completingAuthUserRef.current = null
          setWorkspaceHydrating(false)
        })
    } catch {
      setLoginError({
        message: 'Sign-in is temporarily unavailable. Contact your administrator.',
        messageKey: 'error.signInUnavailable',
        messageParams: null,
      })
    } finally {
      if (hydratingAuthUserRef.current !== authUser.id) completingAuthUserRef.current = null
      setAuthLoading(false)
    }
  }, [routerNavigate])

  async function handleSupabasePasswordLogin(email: string, password: string) {
    if (!supabase) return
    explicitSignOutRef.current = false
    setLoginError(null)
    setAuthLoading(true)
    let lastError: Error | null = null

    for (const authPassword of authPasswordCandidates(password)) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: authPassword })
      if (data.user) {
        await completeSupabaseLogin(data.user)
        return
      }
      if (error) lastError = error
    }

    setLoginError({ message: lastError?.message ?? 'Invalid login credentials', messageKey: null, messageParams: null })
    setAuthLoading(false)
  }

  useEffect(() => {
    function syncRouteFromLocation() {
      const requestedRoute = parseAppRoute(window.location.pathname, window.location.search, window.location.hash)
      const legacyPath = legacyHashPath(window.location.hash)
      if (legacyPath) {
        routerNavigate(legacyPath, { replace: true })
        return
      }
      if (currentUser && !isViewAllowedForUser(requestedRoute.view, currentUser)) {
        routerNavigate('/dashboard', { replace: true })
        return
      }
      runPageTransition(() => {
        setView(requestedRoute.view)
        setFlash(null)
      })
    }

    syncRouteFromLocation()
    window.addEventListener('hashchange', syncRouteFromLocation)
    window.addEventListener('popstate', syncRouteFromLocation)
    return () => {
      window.removeEventListener('hashchange', syncRouteFromLocation)
      window.removeEventListener('popstate', syncRouteFromLocation)
    }
  }, [currentUser, location.pathname, location.hash, routerNavigate])

  useEffect(() => {
    return () => {
      if (remoteSearchDebounceRef.current !== null) window.clearTimeout(remoteSearchDebounceRef.current)
    }
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return undefined
    let cancelled = false

    async function hydrateFromSession() {
      const { data, error } = await supabase!.auth.getSession()
      if (cancelled) return
      if (error) {
        setLoginError({ message: error.message, messageKey: null, messageParams: null })
        setAuthLoading(false)
        return
      }
      if (!data.session?.user) {
        setAuthLoading(false)
        return
      }
      await completeSupabaseLogin(data.session.user)
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setCurrentUser(null)
        activeAuthUserIdRef.current = null
        hydratingAuthUserRef.current = null
        completingAuthUserRef.current = null
        workspaceHydrationGenerationRef.current += 1
        remoteSearchRequestRef.current += 1
        setWorkspaceHydrating(false)
        setWorkspaceLoadFailed(false)
        setRemoteSearchUnits(null)
        setRemoteSearchView(null)
        setRemoteSearchLoading(false)
        setAppState(initialWorkspaceRef.current.state)
        setActiveLookupValues(initialWorkspaceRef.current.lookupValues)
        setAuthLoading(false)
      }
      if (session?.user && event === 'SIGNED_IN') {
        void completeSupabaseLogin(session.user)
      }
    })

    void hydrateFromSession()

    return () => {
      cancelled = true
      listener.subscription.unsubscribe()
    }
  }, [completeSupabaseLogin])

  useEffect(() => {
    if (currentUser?.themePreference) setThemePreference(currentUser.themePreference, { animate: false })
  }, [currentUser?.id, currentUser?.themePreference, setThemePreference])

  const currentUserId = currentUser?.id

  useEffect(() => {
    if (!currentUserId || !supabase || !isSupabaseConfigured) return undefined
    const client = supabase

    let cancelled = false
    let refreshTimeout: number | null = null
    let refreshing = false
    let refreshQueued = false

    async function refreshWorkspace() {
      if (refreshing) {
        refreshQueued = true
        return
      }

      refreshing = true
      try {
        const remote = await loadSupabaseAppState(client)
        if (cancelled) return
        setAppState(remote.state)
        setActiveLookupValues(remote.lookupValues.length > 0 ? remote.lookupValues : lookupValues)
        remoteSearchRequestRef.current += 1
        setRemoteSearchUnits(null)
        setRemoteSearchView(null)
        setRemoteSearchLoading(false)
      } catch (error) {
        console.warn('Supabase workspace refresh failed:', error)
      } finally {
        refreshing = false
        if (refreshQueued && !cancelled) {
          refreshQueued = false
          void refreshWorkspace()
        }
      }
    }

    function scheduleRefresh() {
      if (refreshTimeout !== null) window.clearTimeout(refreshTimeout)
      refreshTimeout = window.setTimeout(() => {
        refreshTimeout = null
        void refreshWorkspace()
      }, 400)
    }

    function refreshWhenVisible() {
      if (document.visibilityState === 'visible') void refreshWorkspace()
    }

    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)

    const channel = client
      .channel(`leadra-workspace-${currentUserId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'units' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'unit_media' }, scheduleRefresh)
      .subscribe()

    return () => {
      cancelled = true
      if (refreshTimeout !== null) window.clearTimeout(refreshTimeout)
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      void client.removeChannel(channel)
    }
  }, [currentUserId])

  useEffect(() => {
    if (!currentUser) return
    const timeout = window.setTimeout(() => {
      setAppState((state) => queueSalesInactivityWarnings(state))
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [currentUser, appState.units.length, appState.users.length])

  useEffect(() => {
    if (!currentUser) return
    const nextActiveRoute = deriveActiveRouteState(route, currentUser)
    const previousActiveRoute = activeRouteRef.current
    if (
      previousActiveRoute.view === nextActiveRoute.activeView
      && previousActiveRoute.destinationId === nextActiveRoute.routeDestinationId
      && previousActiveRoute.projectId === nextActiveRoute.routeProjectId
    ) return

    if (remoteSearchDebounceRef.current !== null) {
      window.clearTimeout(remoteSearchDebounceRef.current)
      remoteSearchDebounceRef.current = null
    }
    remoteSearchRequestRef.current += 1
    setRemoteSearchUnits(null)
    setRemoteSearchView(null)
    setRemoteSearchLoading(false)
    activeRouteRef.current = {
      view: nextActiveRoute.activeView,
      destinationId: nextActiveRoute.routeDestinationId,
      projectId: nextActiveRoute.routeProjectId,
    }
  }, [currentUser, route])

  if (!currentUser) {
    return (
      <LoginScreen
        authLoading={authLoading}
        loginError={loginError}
        onLogin={(nextUser) => {
          setCurrentUser(nextUser)
          const requestedView = parseAppRoute(window.location.pathname, window.location.search, window.location.hash).view
          const nextView = isViewAllowedForUser(requestedView, nextUser) ? requestedView : 'dashboard'
          setView(nextView)
          if (nextView !== requestedView) routerNavigate(pathForView(nextView), { replace: true })
          setFlash(null)
        }}
        onPasswordLogin={handleSupabasePasswordLogin}
      />
    )
  }

  const user = currentUser
  const canUseAdmin = canAccessAdmin(user)
  const canUseAnalytics = canAccessAnalytics(user)
  const {
    activeView,
    routeDestinationId,
    routeProjectId,
    routeUnitId,
    unitsBrowserStage,
    activeCreateStep,
    activeAdminSection,
    activeMasterDataDirectory,
  } = deriveActiveRouteState(route, user)
  const visibleUnits = filterUnitsForUser(user, appState.units)
  const destinationSummaries = summarizeDestinationsWithLookups(visibleUnits, activeLookupValues, locale)
  const activeSelectedDestinationId = routeDestinationId
  const projectSummaries = summarizeProjectsWithLookups(visibleUnits, activeLookupValues, locale, activeSelectedDestinationId)
  const activeSelectedProjectId = routeProjectId
  const selectedUnit = activeView === 'details'
    ? visibleUnits.find((unit) => unit.id === routeUnitId) ?? null
    : visibleUnits[0] ?? null
  const filteredUnits = searchUnits(user, appState.units, {
    ...unitFilters,
    destinationId: routeDestinationId ?? unitFilters.destinationId,
    projectId: routeProjectId ?? unitFilters.projectId,
  })
  const displayedUnits = remoteSearchView === 'inventory' && remoteSearchUnits ? remoteSearchUnits : filteredUnits
  const specialFilteredUnits = searchUnits(user, appState.units.filter((unit) => unit.isSpecial && !unit.archived), unitFilters)
  const displayedSpecialUnits = (remoteSearchView === 'special' && remoteSearchUnits ? remoteSearchUnits : specialFilteredUnits).filter((unit) => unit.isSpecial && !unit.archived)
  const activeBatchUnits = activeView === 'special' ? displayedSpecialUnits : displayedUnits
  const selectedBatchUnits = activeBatchUnits.filter((unit) => selectedBatchUnitIds.includes(unit.id))
  const unreadCount = appState.notifications.filter(
    (notification) =>
      !notification.read &&
      (notification.userId === user.id || notification.audienceRole === user.role || (!notification.userId && !notification.audienceRole)),
  ).length
  const canNavigateBack = routeStack.length > 1 || activeView !== 'dashboard'
  const workspaceSkeletonKind: Parameters<typeof PageSkeleton>[0]['kind'] = activeView === 'create'
    ? 'form'
    : activeView === 'details'
      ? 'details'
      : activeView === 'admin'
        ? 'admin'
        : activeView === 'analytics'
          ? 'analytics'
          : activeView === 'units' || activeView === 'special'
            ? 'units'
            : 'dashboard'
  const shouldGateWorkspaceView = (workspaceHydrating || workspaceLoadFailed) && activeView !== 'profile' && activeView !== 'palette'

  function navigate(nextView: View) {
    runPageTransition(() => {
      setView(nextView)
      routerNavigate(pathForView(nextView))
      setFlash(null)
      setMobileMenuOpen(false)
    })
  }

  function navigateToPath(path: string, options?: { replace?: boolean }) {
    runPageTransition(() => {
      routerNavigate(path, { replace: options?.replace })
      setFlash(null)
      setMobileMenuOpen(false)
      setSelectedBatchUnitIds([])
    })
  }

  function handleBack() {
    const stack = routeStackRef.current
    setFlash(null)
    setMobileMenuOpen(false)
    setSelectedBatchUnitIds([])

    if (stack.length > 1) {
      runPageTransition(() => {
        routerNavigate(-1)
      })
      return
    }

    if (route.view !== 'dashboard') {
      runPageTransition(() => {
        routerNavigate('/dashboard', { replace: true })
      })
    }
  }

  function closeNavigation() {
    setFlash(null)
    setMobileMenuOpen(false)
  }

  async function handleCreateUnit(event: FormEvent<HTMLFormElement>, uploadedMedia: LeadraMediaFile[]) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const paymentMethod = readFormEnum(formData, 'paymentMethod', paymentMethodValues, 'cash') as PaymentMethod
    const projectId = readFormString(formData, 'projectId')
    const destinationId = readFormString(formData, 'destinationId')
    const developerId = readFormString(formData, 'developerId')
    const viewId = readFormString(formData, 'viewId')
    const finish = readFormString(formData, 'finish')
    const project = activeLookupValues.find((item) => item.id === projectId)
    const destination = activeLookupValues.find((item) => item.id === destinationId)
    const developer = activeLookupValues.find((item) => item.id === developerId)
    const viewLookup = activeLookupValues.find((item) => item.id === viewId)
    const finishLookup = activeLookupValues.find((item) => item.kind === 'finish' && item.label === finish)
    const rawOwnerPhone = readFormString(formData, 'ownerPhone')
    const selectedCountryCode = readFormString(formData, 'countryCode', '+20')
    const ownerPhoneValidation = validateOwnerPhoneForCountry(rawOwnerPhone, selectedCountryCode, locale)
    const maintenancePaid = readFormBoolean(formData, 'maintenancePaid')
    const installmentType = paymentMethod === 'installment'
      ? readFormEnum(formData, 'installmentType', ['monthly', 'quarterly', 'semi_annual', 'annual', 'custom'] as const, 'monthly') as InstallmentType
      : null
    const installmentStartMonth = paymentMethod === 'installment' && isAutomaticInstallmentType(installmentType)
      ? parseOptionalFormMonthDate(formData, 'installmentStartMonth')
      : null
    const installmentEndMonth = paymentMethod === 'installment' && isAutomaticInstallmentType(installmentType)
      ? parseOptionalFormMonthDate(formData, 'installmentEndMonth')
      : null

    if (!viewId) {
      setFlash(createFlashMessage('error.viewRequired', 'Select a view before creating the unit.'))
      return
    }

    if (!viewLookup || viewLookup.kind !== 'view') {
      setFlash(createFlashMessage('error.viewRequired', 'Select a view from Master Data before creating the unit.'))
      return
    }

    if (!finish || !finishLookup) {
      setFlash(createFlashMessage('error.finishRequired', 'Select finishing from Master Data before creating the unit.'))
      return
    }

    if (!ownerPhoneValidation.ok) {
      setFlash(
        createFlashMessage(
          'error.invalidOwnerPhoneForCountry',
          `Owner phone must match ${ownerPhoneValidation.countryLabel}. Example: ${ownerPhoneValidation.example}.`,
          { country: ownerPhoneValidation.countryLabel, example: ownerPhoneValidation.example },
        ),
      )
      return
    }

    const input: CreateUnitInput = {
      developerId,
      developerName: developer?.label ?? 'Unknown developer',
      projectId,
      projectName: project?.label ?? 'Unknown project',
      destinationId,
      destinationName: destination?.label ?? 'Unknown destination',
      unitType: readFormString(formData, 'unitType'),
      floor: readFormString(formData, 'floor'),
      bua: readFormNumber(formData, 'bua'),
      roofGardenArea: readFormNumber(formData, 'roofGardenArea') || null,
      gardenArea: readFormNumber(formData, 'gardenArea') || null,
      terraceArea: readFormNumber(formData, 'terraceArea') || null,
      viewId,
      viewName: viewLookup.label,
      bedrooms: readFormNumber(formData, 'bedrooms'),
      bathrooms: readFormNumber(formData, 'bathrooms'),
      elevator: readFormBoolean(formData, 'elevator'),
      landArea: readFormNumber(formData, 'landArea') || null,
      furnished: readFormString(formData, 'furnished') === 'true',
      finish,
      paymentMethod,
      totalAmount: readFormNumber(formData, 'totalAmount'),
      downPayment: paymentMethod === 'installment' ? readFormNumber(formData, 'downPayment') : null,
      maintenancePaid,
      maintenanceCost: maintenancePaid ? null : parseOptionalFormNumber(formData, 'maintenanceCost'),
      maintenanceDueDate: maintenancePaid ? null : parseOptionalFormDate(formData, 'maintenanceDueDate'),
      installmentType,
      installmentStartMonth,
      installmentEndMonth,
      installmentDueDay: paymentMethod === 'installment' ? readFormNumber(formData, 'installmentDueDay', 1) : 1,
      customInstallmentText: paymentMethod === 'installment' && installmentType === 'custom' ? parseOptionalFormText(formData, 'customInstallmentText') : null,
      installmentYears: null,
      deliveryExpectancy: {
        mode: 'year',
        year: readFormNumber(formData, 'deliveryYear'),
      },
      originalOwnerName: readFormString(formData, 'ownerName'),
      countryCode: selectedCountryCode,
      originalOwnerPhone: ownerPhoneValidation.localPhone,
      salesNotes: readFormString(formData, 'salesNotes'),
      media: uploadedMedia,
    }
    const result = createUnitWorkflow(appState, user, input)

    if (!result.ok) {
      setAppState(result.state)
      setFlash({
        text: result.error,
        messageKey: result.errorKey ?? null,
        messageParams: result.errorParams ?? null,
      })
      return
    }

    let nextState = result.state
    let newUnit = result.state.units[0]
    setAppState(nextState)
    try {
      if (supabase && isSupabaseConfigured) {
        const remoteUnit = await new LeadraRepository(supabase).createUnit(user, input)
        nextState = {
          ...result.state,
          units: result.state.units.map((unit) => unit.id === newUnit.id ? remoteUnit : unit),
        }
        newUnit = remoteUnit
      }
    } catch (error) {
      setAppState(appState)
      setFlash(createUnitRemoteErrorFlash(error))
      return
    }

    setAppState(nextState)
    setFlash(createFlashMessage('flash.unitCreated', 'Unit created, notifications queued, and audit action recorded.'))
    runPageTransition(() => {
      setView('details')
      routerNavigate(unitDetailsPath(newUnit.id))
    })
  }

  async function handleUpdateUnit(unit: LeadraUnit, event: FormEvent<HTMLFormElement>): Promise<boolean> {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const projectId = readFormString(formData, 'projectId')
    const destinationId = readFormString(formData, 'destinationId')
    const developerId = readFormString(formData, 'developerId')
    const viewId = readFormString(formData, 'viewId')
    const finish = readFormString(formData, 'finish')
    const project = activeLookupValues.find((item) => item.id === projectId)
    const destination = activeLookupValues.find((item) => item.id === destinationId)
    const developer = activeLookupValues.find((item) => item.id === developerId)
    const viewLookup = activeLookupValues.find((item) => item.id === viewId)
    const finishLookup = activeLookupValues.find((item) => item.kind === 'finish' && item.label === finish)
    const maintenancePaid = readFormBoolean(formData, 'maintenancePaid')
    const submittedPaymentMethod = readFormEnum(formData, 'paymentMethod', paymentMethodValues, unit.paymentMethod)
    const submittedInstallmentType = readFormEnum(
      formData,
      'installmentType',
      ['monthly', 'quarterly', 'semi_annual', 'annual', 'custom'] as const,
      unit.installmentType ?? 'monthly',
    )
    const submittedInstallmentStartMonth = parseOptionalFormMonthDate(formData, 'installmentStartMonth')
    const submittedInstallmentEndMonth = parseOptionalFormMonthDate(formData, 'installmentEndMonth')
    const storedInstallmentStartMonth = getUnitInstallmentStartMonth(unit)
    const storedInstallmentEndMonth = getUnitInstallmentEndMonth(unit)
    const shouldSubmitInstallmentPeriod = submittedPaymentMethod === 'installment' && isAutomaticInstallmentType(submittedInstallmentType) && (
      Boolean(submittedInstallmentStartMonth || submittedInstallmentEndMonth) ||
      Boolean(storedInstallmentStartMonth && storedInstallmentEndMonth)
    )
    const installmentStartMonth = shouldSubmitInstallmentPeriod
      ? submittedInstallmentStartMonth ?? storedInstallmentStartMonth
      : null
    const installmentEndMonth = shouldSubmitInstallmentPeriod
      ? submittedInstallmentEndMonth ?? storedInstallmentEndMonth
      : null
    if (!finish || (finish !== unit.finish && !finishLookup)) {
      setFlash(createFlashMessage('error.finishRequired', 'Select finishing from Master Data before updating the unit.'))
      return false
    }

    const input: UnitEditInput = {
      developerId,
      developerName: developer?.label ?? unit.developerName,
      projectId,
      projectName: project?.label ?? unit.projectName,
      destinationId,
      destinationName: destination?.label ?? unit.destinationName,
      unitType: readFormString(formData, 'unitType'),
      floor: readFormString(formData, 'floor'),
      bua: readFormNumber(formData, 'bua'),
      roofGardenArea: readFormNumber(formData, 'roofGardenArea') || null,
      gardenArea: readFormNumber(formData, 'gardenArea') || null,
      terraceArea: readFormNumber(formData, 'terraceArea') || null,
      viewId,
      viewName: viewLookup?.label ?? unit.viewName,
      bedrooms: readFormNumber(formData, 'bedrooms'),
      bathrooms: readFormNumber(formData, 'bathrooms'),
      elevator: readFormBoolean(formData, 'elevator'),
      landArea: readFormNumber(formData, 'landArea') || null,
      furnished: readFormString(formData, 'furnished') === 'true',
      finish,
      paymentMethod: submittedPaymentMethod,
      downPayment: submittedPaymentMethod === 'installment' ? parseOptionalFormNumber(formData, 'downPayment') ?? unit.downPayment ?? 0 : null,
      deliveryExpectancy: {
        mode: 'year',
        year: readFormNumber(formData, 'deliveryYear'),
      },
      originalOwnerName: readFormString(formData, 'ownerName', unit.originalOwnerName ?? ''),
      countryCode: readFormString(formData, 'countryCode', unit.countryCode ?? '+20'),
      originalOwnerPhone: readFormString(formData, 'ownerPhone', unit.originalOwnerPhone ?? ''),
      salesNotes: readFormString(formData, 'salesNotes', unit.salesNotes),
      totalAmount: readFormNumber(formData, 'totalAmount'),
      maintenancePaid,
      maintenanceCost: maintenancePaid ? null : parseOptionalFormNumber(formData, 'maintenanceCost'),
      maintenanceDueDate: maintenancePaid ? null : parseOptionalFormDate(formData, 'maintenanceDueDate'),
      ...(submittedPaymentMethod === 'installment' && submittedInstallmentType === 'custom'
        ? {
            installmentType: submittedInstallmentType,
            customInstallmentText: parseOptionalFormText(formData, 'customInstallmentText') ?? getUnitCustomInstallmentText(unit),
          }
        : {}),
      ...(shouldSubmitInstallmentPeriod
        ? {
            installmentType: submittedInstallmentType,
            installmentStartMonth,
            installmentEndMonth,
            installmentDueDay: parseOptionalFormNumber(formData, 'installmentDueDay') ?? unit.installmentDueDay ?? 1,
          }
        : {}),
      commissionPercentage: readFormNumber(formData, 'commissionPercentage'),
    }
    const result = updateUnitWorkflow(appState, user, unit.id, input)
    if (!result.ok) {
      setFlash({ text: result.error, messageKey: result.errorKey ?? null, messageParams: result.errorParams ?? null })
      return false
    }

    const previousState = appState
    let nextState = result.state
    const updatedUnit = result.state.units.find((item) => item.id === unit.id) ?? unit
    setAppState(nextState)
    setRemoteSearchUnits((items) => items?.map((item) => item.id === unit.id ? updatedUnit : item) ?? null)

    try {
      if (supabase && isSupabaseConfigured) {
        const remoteUnit = await new LeadraRepository(supabase).updateUnitDetails(user, unit.id, input, {
          canEditOwner: canEditOwnerFields(user, unit),
          canEditPricing: canEditUnitPricing(user, unit),
          canEditCommission: canEditUnitCommission(user, unit),
        })
        nextState = {
          ...result.state,
          units: result.state.units.map((item) => item.id === unit.id ? remoteUnit : item),
        }
        setAppState(nextState)
        setRemoteSearchUnits((items) => items?.map((item) => item.id === unit.id ? remoteUnit : item) ?? null)
      }
      invalidateGeneratedPdf(unit.id)
      setFlash(createFlashMessage('flash.unitUpdated', 'Unit details updated.'))
      return true
    } catch (error) {
      setAppState(previousState)
      setRemoteSearchUnits((items) => items?.map((item) => item.id === unit.id ? unit : item) ?? null)
      setFlash({ text: `Unit could not be saved: ${errorMessage(error)}`, messageKey: null, messageParams: null })
      return false
    }
  }

  async function updateUnitStatus(unit: LeadraUnit, status: UnitStatus) {
    if (updatingStatusUnitId) return
    const result = updateUnitStatusWorkflow(appState, user, unit.id, status)
    if (!result.ok) {
      setAppState(result.state)
      setFlash({ text: result.error, messageKey: result.errorKey ?? null, messageParams: result.errorParams ?? null })
      return
    }
    const previousState = appState
    setUpdatingStatusUnitId(unit.id)
    setStatusActionFeedback({ unitId: unit.id, status, state: 'saving' })
    setAppState(result.state)
    setRemoteSearchUnits((items) =>
      items?.map((item) =>
        item.id === unit.id ? { ...item, status, updatedAt: new Date().toISOString() } : item,
      ) ?? null,
    )

    try {
      if (supabase && isSupabaseConfigured) {
        await new LeadraRepository(supabase).updateUnitStatus(unit.id, status)
      }
      setStatusActionFeedback({ unitId: unit.id, status, state: 'saved' })
      setFlash(createFlashForStatus(status))
    } catch (error) {
      setAppState(previousState)
      setRemoteSearchUnits((items) =>
        items?.map((item) =>
          item.id === unit.id ? { ...item, status: unit.status, updatedAt: unit.updatedAt } : item,
        ) ?? null,
      )
      setStatusActionFeedback(null)
      console.error('Status update failed', error)
      setFlash({ text: `Status could not be saved: ${errorMessage(error)}`, messageKey: null, messageParams: null })
    } finally {
      setUpdatingStatusUnitId(null)
    }
  }

  async function setUnitSpecial(unit: LeadraUnit, special: boolean) {
    if (updatingSpecialUnitId || !canManageUnitSpecialStatus(user, unit)) return
    const result = setUnitSpecialWorkflow(appState, user, unit.id, special)
    if (!result.ok) {
      setFlash({ text: result.error, messageKey: result.errorKey ?? null, messageParams: result.errorParams ?? null })
      return
    }

    const previousState = appState
    const previousRemoteSearchUnits = remoteSearchUnits
    const optimisticUnit = result.state.units.find((item) => item.id === unit.id) ?? unit
    setUpdatingSpecialUnitId(unit.id)
    setAppState(result.state)
    setRemoteSearchUnits((items) => items?.map((item) => item.id === unit.id ? optimisticUnit : item) ?? null)

    try {
      if (supabase && isSupabaseConfigured) {
        const remoteUnit = await new LeadraRepository(supabase).setUnitSpecial(unit.id, special)
        setAppState((state) => ({
          ...state,
          units: state.units.map((item) => item.id === unit.id ? remoteUnit : item),
        }))
        setRemoteSearchUnits((items) => items?.map((item) => item.id === unit.id ? remoteUnit : item) ?? null)
      }
      setFlash(createFlashMessage(special ? 'flash.unitSpecialMarked' : 'flash.unitSpecialRemoved', special ? 'Unit marked special.' : 'Unit removed from Special.'))
    } catch (error) {
      setAppState(previousState)
      setRemoteSearchUnits(previousRemoteSearchUnits)
      setFlash({ text: `Special status could not be saved: ${errorMessage(error)}`, messageKey: null, messageParams: null })
    } finally {
      setUpdatingSpecialUnitId(null)
    }
  }

  async function archiveUnit(unit: LeadraUnit) {
    const result = archiveUnitWorkflow(appState, user, unit.id)
    if (!result.ok) {
      setAppState(result.state)
      setFlash({ text: result.error, messageKey: result.errorKey ?? null, messageParams: result.errorParams ?? null })
      return
    }

    const previousState = appState
    const archivedUnit = result.state.units.find((item) => item.id === unit.id) ?? { ...unit, archived: true, updatedAt: new Date().toISOString() }
    setAppState(result.state)
    setRemoteSearchUnits((items) => items?.map((item) => item.id === unit.id ? archivedUnit : item) ?? null)

    try {
      if (supabase && isSupabaseConfigured) {
        await new LeadraRepository(supabase).archiveUnit(unit.id)
      }
      invalidateGeneratedPdf(unit.id)
      setFlash(createFlashMessage('flash.unitArchived', 'Unit archived. It remains stored for history, audit, and backups.'))
      runPageTransition(() => {
        setView('units')
        routerNavigate('/units')
      })
    } catch (error) {
      setAppState(previousState)
      setRemoteSearchUnits((items) => items?.map((item) => item.id === unit.id ? unit : item) ?? null)
      setFlash({ text: `Unit could not be archived: ${errorMessage(error)}`, messageKey: null, messageParams: null })
    }
  }

  function saveSharedNote(unit: LeadraUnit, content: string) {
    const result = saveUnitAdminNoteWorkflow(appState, user, unit.id, content)
    setAppState(result.state)
    if (result.ok) invalidateGeneratedPdf(unit.id)
    setFlash(
      result.ok
        ? createFlashMessage('flash.noteSaved', 'Shared unit note saved.')
        : { text: result.error, messageKey: result.errorKey ?? null, messageParams: result.errorParams ?? null },
    )
  }

  function deleteSharedNote(unit: LeadraUnit) {
    const result = deleteUnitAdminNoteWorkflow(appState, user, unit.id)
    setAppState(result.state)
    if (result.ok) invalidateGeneratedPdf(unit.id)
    setFlash(
      result.ok
        ? createFlashMessage('flash.noteDeleted', 'Shared unit note deleted.')
        : { text: result.error, messageKey: result.errorKey ?? null, messageParams: result.errorParams ?? null },
    )
  }

  async function removeUnitMedia(unit: LeadraUnit, mediaId: string) {
    if (removingMediaId) return
    const result = removeUnitMediaWorkflow(appState, user, unit.id, mediaId)
    if (!result.ok) {
      setFlash({ text: result.error, messageKey: result.errorKey ?? null, messageParams: result.errorParams ?? null })
      return
    }

    const previousState = appState
    setRemovingMediaId(mediaId)
    setAppState(result.state)
    setRemoteSearchUnits((items) =>
      items?.map((item) =>
        item.id === unit.id ? { ...item, media: item.media.filter((file) => file.id !== mediaId), updatedAt: new Date().toISOString() } : item,
      ) ?? null,
    )

    try {
      if (supabase && isSupabaseConfigured) {
        await new LeadraRepository(supabase).deleteUnitMedia(mediaId)
      }
      invalidateGeneratedPdf(unit.id)
      setFlash(createFlashMessage('flash.unitMediaRemoved', 'Media removed from this unit.'))
    } catch {
      setAppState(previousState)
      setRemoteSearchUnits((items) =>
        items?.map((item) => item.id === unit.id ? unit : item) ?? null,
      )
      setFlash({ text: 'Media could not be removed. Please try again.', messageKey: null, messageParams: null })
    } finally {
      setRemovingMediaId(null)
    }
  }

  async function generatePdfFile(unit: LeadraUnit) {
    const { generateUnitPdfFile } = await import('./lib/pdf')
    const pdfSettings = {
      ...appState.settings,
      logoPath: appState.settings.logoPath || leadraLogoLight,
    }
    const generated = await generateUnitPdfFile(user, unit, pdfSettings, locale)
    setGeneratedPdfs((items) => ({ ...items, [unit.id]: generated }))
    return generated
  }

  async function setUnitMediaPdfVisibility(unitId: number, mediaId: string, includeInPdf: boolean) {
    const previousState = appState
    const previousRemoteSearchUnits = remoteSearchUnits
    const unit = appState.units.find((item) => item.id === unitId)
    const media = unit?.media.find((file) => file.id === mediaId)
    setAppState((state) => ({
      ...state,
      units: state.units.map((unit) =>
        unit.id === unitId
          ? {
              ...unit,
              media: unit.media.map((file) =>
                file.id === mediaId ? { ...file, includeInPdf } : file,
              ),
              updatedAt: new Date().toISOString(),
            }
          : unit,
      ),
    }))
    invalidateGeneratedPdf(unitId)
    if (media && unit) {
      const kind = includeInPdf ? 'media_shown_in_pdf' : 'media_hidden_from_pdf'
      const notificationMessage = createNotificationMessage(kind, { unitCode: unit.unitCode, mediaName: media.name })
      const auditMessage = createAuditMessage(kind, { unitCode: unit.unitCode, mediaName: media.name })
      const createdAt = new Date().toISOString()
      setAppState((state) => ({
        ...state,
        notifications: [
          {
            id: `notif-${kind}-${media.id}-${createdAt}`,
            title: notificationMessage.title.text,
            body: notificationMessage.body.text,
            messageKey: notificationMessage.body.messageKey ?? null,
            messageParams: notificationMessage.body.messageParams ?? null,
            audienceRole: user.role === 'sales' ? undefined : 'admin',
            userId: user.role === 'sales' ? user.id : undefined,
            createdAt,
            read: false,
          },
          ...state.notifications,
        ],
        auditLogs: [
          {
            id: `audit-${kind}-${media.id}-${createdAt}`,
            actorName: user.fullName,
            actorRole: user.role,
            actionType: auditMessage.text,
            messageKey: auditMessage.messageKey ?? null,
            messageParams: auditMessage.messageParams ?? null,
            relatedUnitCode: unit.unitCode,
            createdAt,
            ipAddress: null,
          },
          ...state.auditLogs,
        ],
      }))
    }
    try {
      if (supabase && isSupabaseConfigured) {
        await new LeadraRepository(supabase).updateUnitMediaPdfVisibility(mediaId, includeInPdf)
      }
    } catch (error) {
      console.error('Media PDF visibility update failed', error)
      setAppState(previousState)
      setRemoteSearchUnits(previousRemoteSearchUnits)
      invalidateGeneratedPdf(unitId)
      setFlash(mediaPdfVisibilityErrorFlash(error))
    }
  }

  async function downloadUnitMedia(file: LeadraMediaFile) {
    if (downloadingMediaId) return
    setDownloadingMediaId(file.id)

    try {
      const response = await fetch(file.url)
      if (!response.ok) throw new Error(`Media download failed with ${response.status}`)

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = file.name
      anchor.rel = 'noopener'
      anchor.style.display = 'none'
      document.body.append(anchor)
      anchor.click()
      window.setTimeout(() => {
        anchor.remove()
        URL.revokeObjectURL(url)
      }, 1000)
    } catch {
      window.open(file.url, '_blank', 'noopener,noreferrer')
      setFlash({ text: 'Direct download is blocked by the image host, so the photo opened in a new tab.', messageKey: null, messageParams: null })
    } finally {
      setDownloadingMediaId(null)
    }
  }

  function toggleBatchUnitSelection(unitId: number) {
    setSelectedBatchUnitIds((ids) =>
      ids.includes(unitId) ? ids.filter((id) => id !== unitId) : [...ids, unitId],
    )
  }

  function selectVisibleBatchUnits(unitIds: number[]) {
    setSelectedBatchUnitIds(unitIds)
  }

  function clearBatchUnitSelection() {
    setSelectedBatchUnitIds([])
  }

  async function generateSelectedPdfs() {
    if (batchPdfAction || generatingPdfUnitId || sharingPdfUnitId || selectedBatchUnits.length === 0) return
    setBatchPdfAction('generate')
    try {
      for (const unit of selectedBatchUnits) {
        await generatePdfFile(unit)
        await recordPdfAction(unit, 'pdf_generated')
      }
      setFlash({ text: `Generated ${selectedBatchUnits.length} PDF${selectedBatchUnits.length === 1 ? '' : 's'}.`, messageKey: null, messageParams: null })
    } catch {
      setFlash({ text: 'Selected PDFs could not be generated. Please try again.', messageKey: null, messageParams: null })
    } finally {
      setBatchPdfAction(null)
    }
  }

  async function shareSelectedPdfs() {
    if (batchPdfAction || generatingPdfUnitId || sharingPdfUnitId || selectedBatchUnits.length === 0) return
    setBatchPdfAction('share')
    try {
      const generated = await getOrGenerateUnitPdfs(selectedBatchUnits, generatedPdfs, generatePdfFile)
      const { shareGeneratedPdfs, downloadGeneratedPdf } = await import('./lib/pdf')
      const shared = await shareGeneratedPdfs(generated)
      if (shared) {
        for (const unit of selectedBatchUnits) {
          await recordPdfAction(unit, 'pdf_shared')
        }
        setFlash({ text: `PDF share sheet opened for ${selectedBatchUnits.length} unit${selectedBatchUnits.length === 1 ? '' : 's'}.`, messageKey: null, messageParams: null })
        return
      }
      for (const [index, unit] of selectedBatchUnits.entries()) {
        downloadGeneratedPdf(generated[index])
        await recordPdfAction(unit, 'pdf_downloaded')
      }
      setFlash({ text: 'Native multi-file sharing is unavailable in this browser. The PDFs were downloaded so you can send them manually.', messageKey: null, messageParams: null })
    } catch {
      setFlash({ text: 'Selected PDFs could not be shared. Please try again.', messageKey: null, messageParams: null })
    } finally {
      setBatchPdfAction(null)
    }
  }

  async function downloadSelectedPdfs() {
    if (batchPdfAction || generatingPdfUnitId || sharingPdfUnitId || selectedBatchUnits.length === 0) return
    setBatchPdfAction('download')
    try {
      const generated = await getOrGenerateUnitPdfs(selectedBatchUnits, generatedPdfs, generatePdfFile)
      const { downloadGeneratedPdf } = await import('./lib/pdf')
      for (const [index, unit] of selectedBatchUnits.entries()) {
        downloadGeneratedPdf(generated[index])
        await recordPdfAction(unit, 'pdf_downloaded')
      }
      setFlash({ text: `Downloaded ${selectedBatchUnits.length} PDF${selectedBatchUnits.length === 1 ? '' : 's'}.`, messageKey: null, messageParams: null })
    } catch {
      setFlash({ text: 'Selected PDFs could not be downloaded. Please try again.', messageKey: null, messageParams: null })
    } finally {
      setBatchPdfAction(null)
    }
  }

  async function generatePdf(unit: LeadraUnit) {
    if (generatingPdfUnitId) return
    setGeneratingPdfUnitId(unit.id)
    try {
      await generatePdfFile(unit)
      await recordPdfAction(unit, 'pdf_generated')
      setFlash({ text: 'PDF generated. Use Download PDF or Share PDF from the unit details actions.', messageKey: null, messageParams: null })
    } catch {
      setFlash({ text: 'PDF could not be generated. Please try again.', messageKey: null, messageParams: null })
    } finally {
      setGeneratingPdfUnitId(null)
    }
  }

  async function downloadPdf(unit: LeadraUnit) {
    if (generatingPdfUnitId || sharingPdfUnitId) return
    setGeneratingPdfUnitId(unit.id)
    try {
      const generated = await getOrGenerateUnitPdf(unit, generatedPdfs, generatePdfFile)
      const { downloadGeneratedPdf } = await import('./lib/pdf')
      await recordPdfAction(unit, 'pdf_downloaded')
      downloadGeneratedPdf(generated)
      setFlash({ text: 'PDF download started.', messageKey: null, messageParams: null })
    } catch {
      setFlash({ text: 'PDF could not be downloaded. Please generate it again.', messageKey: null, messageParams: null })
    } finally {
      setGeneratingPdfUnitId(null)
    }
  }

  async function sharePdf(unit: LeadraUnit) {
    if (sharingPdfUnitId || generatingPdfUnitId) return
    setSharingPdfUnitId(unit.id)
    try {
      const generated = await getOrGenerateUnitPdf(unit, generatedPdfs, generatePdfFile)
      const { shareGeneratedPdf, downloadGeneratedPdf } = await import('./lib/pdf')
      const shared = await shareGeneratedPdf(generated)
      if (shared) {
        await recordPdfAction(unit, 'pdf_shared')
        setFlash({ text: 'PDF share sheet opened.', messageKey: null, messageParams: null })
        return
      }
      await recordPdfAction(unit, 'pdf_downloaded')
      downloadGeneratedPdf(generated)
      setFlash({ text: 'Native sharing is unavailable in this browser. The PDF was downloaded so you can send it manually.', messageKey: null, messageParams: null })
    } catch {
      setFlash({ text: 'PDF could not be shared. Please try again.', messageKey: null, messageParams: null })
    } finally {
      setSharingPdfUnitId(null)
    }
  }

  async function copyUnitShareLink(unit: LeadraUnit) {
    const url = `${window.location.origin}${unitDetailsPath(unit.id)}`
    try {
      await navigator.clipboard.writeText(url)
      setFlash({ text: 'Internal unit share link copied. It only works for logged-in users with permission.', messageKey: null, messageParams: null })
    } catch {
      setFlash({ text: url, messageKey: null, messageParams: null })
    }
  }

  async function copySpecialUnitSocialCopy(unit: LeadraUnit) {
    const copy = buildSpecialUnitSocialCopy(unit, locale)
    try {
      await navigator.clipboard.writeText(copy)
      setFlash({ text: 'Social media copy copied.', messageKey: null, messageParams: null })
    } catch {
      setFlash({ text: copy, messageKey: null, messageParams: null })
    }
  }

  function updateUnitFilter<K extends keyof UnitFilters>(key: K, value: UnitFilters[K]) {
    const nextFilters = normalizeReactiveUnitFilters({ ...unitFilters, [key]: value })
    setUnitFilters(nextFilters)
    setSelectedBatchUnitIds([])
    if (remoteSearchDebounceRef.current !== null) window.clearTimeout(remoteSearchDebounceRef.current)
    remoteSearchDebounceRef.current = window.setTimeout(() => {
      remoteSearchDebounceRef.current = null
      void loadRemoteUnitSearch(nextFilters)
    }, 320)
  }

  function resetUnitFilters() {
    if (remoteSearchDebounceRef.current !== null) {
      window.clearTimeout(remoteSearchDebounceRef.current)
      remoteSearchDebounceRef.current = null
    }
    remoteSearchRequestRef.current += 1
    setUnitFilters({ status: 'all' })
    setRemoteSearchUnits(null)
    setRemoteSearchView(null)
    setRemoteSearchLoading(false)
    setSelectedBatchUnitIds([])
  }

  async function loadRemoteUnitSearch(nextFilters: UnitFilters, destinationId = routeDestinationId, projectId = routeProjectId) {
    const normalizedFilters = normalizeReactiveUnitFilters(nextFilters)
    const requestId = remoteSearchRequestRef.current + 1
    remoteSearchRequestRef.current = requestId
    const requestRoute = { view: activeView, destinationId, projectId }
    if (!supabase || !isSupabaseConfigured) {
      if (remoteSearchRequestRef.current !== requestId) return
      setRemoteSearchUnits(null)
      setRemoteSearchView(null)
      return
    }
    try {
      setRemoteSearchLoading(true)
      const repository = new LeadraRepository(supabase)
      const units = await repository.searchUnits({
        ...normalizedFilters,
        destinationId: normalizedFilters.destinationId || destinationId || undefined,
        projectId: normalizedFilters.projectId || projectId || undefined,
      })
      const currentRoute = activeRouteRef.current
      if (
        remoteSearchRequestRef.current !== requestId
        || currentRoute.view !== requestRoute.view
        || currentRoute.destinationId !== requestRoute.destinationId
        || currentRoute.projectId !== requestRoute.projectId
      ) return
      setRemoteSearchUnits(units)
      setRemoteSearchView(requestRoute.view === 'special' ? 'special' : 'inventory')
    } catch {
      if (remoteSearchRequestRef.current !== requestId) return
      setRemoteSearchUnits(null)
      setRemoteSearchView(null)
    } finally {
      if (remoteSearchRequestRef.current === requestId) setRemoteSearchLoading(false)
    }
  }

  async function handleThemePreferenceChange(nextThemePreference: ThemePreference, options?: ThemePreferenceOptions) {
    const previousThemePreference = themePreference
    const previousUser = currentUser

    setThemePreference(nextThemePreference, options)
    if (previousUser) {
      setCurrentUser({ ...previousUser, themePreference: nextThemePreference })
      setAppState((state) => ({
        ...state,
        users: state.users.map((item) => (item.id === previousUser.id ? { ...item, themePreference: nextThemePreference } : item)),
      }))
    }

    if (!previousUser || !supabase || !isSupabaseConfigured) return

    try {
      const updatedUser = await setSupabaseThemePreference(supabase, nextThemePreference)
      setCurrentUser((existing) => (existing?.id === updatedUser.id ? { ...existing, themePreference: updatedUser.themePreference } : existing))
      setAppState((state) => ({
        ...state,
        users: state.users.map((item) => (item.id === updatedUser.id ? { ...item, themePreference: updatedUser.themePreference } : item)),
      }))
    } catch (error) {
      setThemePreference(previousThemePreference)
      setCurrentUser(previousUser)
      setAppState((state) => ({
        ...state,
        users: state.users.map((item) => (item.id === previousUser.id ? { ...item, themePreference: previousThemePreference } : item)),
      }))
      setFlash({
        text: error instanceof Error ? error.message : 'Theme update failed.',
        messageKey: null,
        messageParams: null,
      })
    }
  }

  return (
    <div className="app-shell">
      <aside className="side-rail" aria-label={t('nav.desktop')}>
        <Link className="brand-mark" to={pathForView('dashboard')} aria-label="Leadra home">
          <img src={brandAssets.sidebarLogo} alt="Leadra" />
        </Link>
        <NavButton active={activeView === 'dashboard'} label={t('nav.dashboard')} to={pathForView('dashboard')} onClick={closeNavigation} icon={<Home />} className="motion-stage" style={motionStyle(0)} />
        <NavButton active={activeView === 'units'} label={t('nav.units')} to={pathForView('units')} onClick={closeNavigation} icon={<Building2 />} className="motion-stage" style={motionStyle(1)} />
        <NavButton active={activeView === 'special'} label={t('nav.special')} to={pathForView('special')} onClick={closeNavigation} icon={<Star />} className="motion-stage" style={motionStyle(2)} />
        <NavButton active={activeView === 'create'} label={t('nav.create')} to={pathForView('create')} onClick={closeNavigation} icon={<Plus />} className="motion-stage" style={motionStyle(3)} />
        <NavButton active={activeView === 'notifications'} label={t('nav.alerts', { count: unreadCount })} to={pathForView('notifications')} onClick={closeNavigation} icon={<Bell />} className="motion-stage" style={motionStyle(4)} />
        {canUseAnalytics && (
          <NavButton active={activeView === 'analytics'} label={t('nav.analytics')} to={pathForView('analytics')} onClick={closeNavigation} icon={<BarChart3 />} className="motion-stage" style={motionStyle(5)} />
        )}
        {canUseAdmin && (
          <NavButton active={activeView === 'admin'} label={t('nav.admin')} to={pathForView('admin')} onClick={closeNavigation} icon={<Settings />} className="motion-stage" style={motionStyle(6)} />
        )}
      </aside>

      <main className="main-panel">
        <header className={`topbar ${activeView === 'dashboard' ? 'dashboard-topbar' : 'compact-topbar'}`}>
          <div className="topbar-leading">
            <button
              className="topbar-back-button"
              type="button"
              aria-label={t('common.back')}
              disabled={!canNavigateBack}
              onClick={handleBack}
            >
              <ChevronLeft size={18} aria-hidden="true" />
              <span className="topbar-back-label">{t('common.back')}</span>
            </button>
            <div className="topbar-heading">
              <p className="eyebrow">{t('topbar.eyebrow')}</p>
              <h1>{getViewTitle(activeView, user, locale)}</h1>
            </div>
          </div>
          <div className="topbar-actions">
            <ThemeToggle compact onThemeChange={(theme) => void handleThemePreferenceChange(theme)} />
            <Link className="user-chip" to={pathForView('profile')} onClick={closeNavigation}>
              <span>{getUserInitials(user.fullName)}</span>
              <strong>{getRoleLabel(locale, user.role)}</strong>
            </Link>
            <button
              className="ghost-button"
              type="button"
              aria-label={t('topbar.signOut')}
              onClick={async () => {
                explicitSignOutRef.current = true
                activeAuthUserIdRef.current = null
                hydratingAuthUserRef.current = null
                completingAuthUserRef.current = null
                workspaceHydrationGenerationRef.current += 1
                remoteSearchRequestRef.current += 1
                setWorkspaceHydrating(false)
                setWorkspaceLoadFailed(false)
                setRemoteSearchUnits(null)
                setRemoteSearchView(null)
                setRemoteSearchLoading(false)
                if (supabase) await supabase.auth.signOut().catch(() => null)
                for (const key of Object.keys(window.localStorage)) {
                  if (key.startsWith('sb-') && key.endsWith('-auth-token')) window.localStorage.removeItem(key)
                }
                setCurrentUser(null)
                setAppState(initialWorkspaceRef.current.state)
                setActiveLookupValues(initialWorkspaceRef.current.lookupValues)
                setView('dashboard')
                routerNavigate('/dashboard', { replace: true })
                setFlash(null)
              }}
            >
              <LogOut size={17} /> <span className="signout-label">{t('topbar.signOut')}</span>
            </button>
          </div>
        </header>

        {shouldGateWorkspaceView && (
          <div className="page-transition-frame" key={`${activeView}-hydrating`}>
            {workspaceLoadFailed ? (
              <section className="content-card page-entrance" role="status" aria-live="polite">
                <EmptyState
                  title="Workspace could not load"
                  body="Leadra could not finish loading the reconciled workspace. Refresh the app before using units, payments, admin, or analytics."
                />
              </section>
            ) : (
              <PageSkeleton kind={workspaceSkeletonKind} />
            )}
          </div>
        )}

        {!shouldGateWorkspaceView && activeView === 'dashboard' && (
          <div className="page-transition-frame" key={activeView}>
            <Dashboard
              user={user}
              appState={appState}
              units={visibleUnits}
              notifications={appState.notifications}
              onNavigate={navigate}
              onOpenUnit={(unitId) => {
                runPageTransition(() => {
                  setView('details')
                  routerNavigate(unitDetailsPath(unitId))
                })
              }}
            />
          </div>
        )}
        {!shouldGateWorkspaceView && activeView === 'palette' && (
          <div className="page-transition-frame" key={activeView}>
            <PaletteSamplePage />
          </div>
        )}
        {!shouldGateWorkspaceView && activeView === 'units' && (
          <div className="page-transition-frame" key={activeView}>
            <UnitsPage
              user={user}
              lookupValues={activeLookupValues}
              destinations={destinationSummaries}
              projects={projectSummaries}
              selectedDestinationId={activeSelectedDestinationId}
              selectedProjectId={activeSelectedProjectId}
              stage={unitsBrowserStage}
              currentDestination={destinationSummaries.find((destination) => destination.destinationId === activeSelectedDestinationId) ?? null}
              currentProject={projectSummaries.find((project) => project.projectId === activeSelectedProjectId) ?? null}
              units={displayedUnits}
              filters={unitFilters}
              selectedUnitIds={selectedBatchUnitIds}
              batchAction={batchPdfAction}
              loading={(workspaceHydrating || remoteSearchLoading) && (remoteSearchView === 'inventory' || remoteSearchView === null)}
              onDestinationSelect={(id) => {
                const nextFilters = { ...unitFilters, destinationId: undefined, projectId: undefined }
                setUnitFilters(nextFilters)
                setSelectedBatchUnitIds([])
                setRemoteSearchUnits(null)
                setRemoteSearchView(null)
                navigateToPath(destinationPath(id))
              }}
              onProjectSelect={(id) => {
                const nextFilters = { ...unitFilters, projectId: undefined }
                setUnitFilters(nextFilters)
                setSelectedBatchUnitIds([])
                void loadRemoteUnitSearch(nextFilters, activeSelectedDestinationId, id)
                if (activeSelectedDestinationId) navigateToPath(projectPath(activeSelectedDestinationId, id))
              }}
              onBackToDestinations={() => {
                resetUnitFilters()
                navigateToPath('/units')
              }}
              onBackToProjects={() => {
                const destinationId = activeSelectedDestinationId
                setRemoteSearchUnits(null)
                setRemoteSearchView(null)
                if (destinationId) navigateToPath(destinationPath(destinationId))
              }}
              onFilterChange={updateUnitFilter}
              onResetFilters={resetUnitFilters}
              onToggleUnitSelection={toggleBatchUnitSelection}
              onSelectVisibleUnits={selectVisibleBatchUnits}
              onClearSelection={clearBatchUnitSelection}
              onGenerateSelectedPdfs={() => void generateSelectedPdfs()}
              onDownloadSelectedPdfs={() => void downloadSelectedPdfs()}
              onShareSelectedPdfs={() => void shareSelectedPdfs()}
              onOpenUnit={(id) => {
                runPageTransition(() => {
                  setSelectedBatchUnitIds([])
                  setView('details')
                  routerNavigate(unitDetailsPath(id))
                })
              }}
            />
          </div>
        )}
        {!shouldGateWorkspaceView && activeView === 'special' && (
          <div className="page-transition-frame" key={activeView}>
            <UnitsPage
              mode="special"
              user={user}
              lookupValues={activeLookupValues}
              destinations={[]}
              projects={[]}
              selectedDestinationId={null}
              selectedProjectId={null}
              stage="destinations"
              currentDestination={null}
              currentProject={null}
              units={displayedSpecialUnits}
              filters={unitFilters}
              selectedUnitIds={selectedBatchUnitIds}
              batchAction={batchPdfAction}
              loading={(workspaceHydrating || remoteSearchLoading) && (remoteSearchView === 'special' || remoteSearchView === null)}
              onDestinationSelect={() => undefined}
              onProjectSelect={() => undefined}
              onBackToDestinations={() => undefined}
              onBackToProjects={() => undefined}
              onFilterChange={updateUnitFilter}
              onResetFilters={resetUnitFilters}
              onToggleUnitSelection={toggleBatchUnitSelection}
              onSelectVisibleUnits={selectVisibleBatchUnits}
              onClearSelection={clearBatchUnitSelection}
              onGenerateSelectedPdfs={() => void generateSelectedPdfs()}
              onDownloadSelectedPdfs={() => void downloadSelectedPdfs()}
              onShareSelectedPdfs={() => void shareSelectedPdfs()}
              onOpenUnit={(id) => {
                runPageTransition(() => {
                  setSelectedBatchUnitIds([])
                  setView('details')
                  routerNavigate(unitDetailsPath(id))
                })
              }}
            />
          </div>
        )}
        {!shouldGateWorkspaceView && activeView === 'create' && (
          <div className="page-transition-frame" key={activeView}>
            <CreateUnitPage
              lookupValues={activeLookupValues}
              activeStep={activeCreateStep}
              onStepChange={(step) => navigateToPath(createStepPath(createStepToSlug[step]))}
              onSubmit={handleCreateUnit}
              settings={appState.settings}
            />
          </div>
        )}
        {!shouldGateWorkspaceView && activeView === 'details' && selectedUnit && (
          <div className="page-transition-frame" key={activeView}>
            <UnitDetailsPage
              key={selectedUnit.id}
              user={user}
              unit={selectedUnit}
              lookupValues={activeLookupValues}
              onArchive={() => { void archiveUnit(selectedUnit) }}
              onSpecialChange={(special) => { void setUnitSpecial(selectedUnit, special) }}
              onUpdateUnit={(event) => handleUpdateUnit(selectedUnit, event)}
              onStatusChange={(status) => updateUnitStatus(selectedUnit, status)}
              onGeneratePdf={() => generatePdf(selectedUnit)}
              onDownloadPdf={() => downloadPdf(selectedUnit)}
              onSharePdf={() => sharePdf(selectedUnit)}
              onCopyShareLink={() => copyUnitShareLink(selectedUnit)}
              onCopySocialCopy={() => copySpecialUnitSocialCopy(selectedUnit)}
              pdfGenerating={generatingPdfUnitId === selectedUnit.id}
              pdfSharing={sharingPdfUnitId === selectedUnit.id}
              pdfReady={Boolean(generatedPdfs[selectedUnit.id])}
              statusUpdating={updatingStatusUnitId === selectedUnit.id}
              specialUpdating={updatingSpecialUnitId === selectedUnit.id}
              statusActionFeedback={statusActionFeedback?.unitId === selectedUnit.id ? statusActionFeedback : null}
              onSaveNote={(content) => saveSharedNote(selectedUnit, content)}
              onDeleteNote={() => deleteSharedNote(selectedUnit)}
              onRemoveMedia={(mediaId) => removeUnitMedia(selectedUnit, mediaId)}
              onMediaPdfVisibilityChange={(mediaId, includeInPdf) => setUnitMediaPdfVisibility(selectedUnit.id, mediaId, includeInPdf)}
              onMediaDownload={downloadUnitMedia}
              removingMediaId={removingMediaId}
              downloadingMediaId={downloadingMediaId}
            />
          </div>
        )}
        {!shouldGateWorkspaceView && activeView === 'details' && !selectedUnit && (
          <div className="page-transition-frame" key="details-denied">
            <section className="content-card page-entrance">
              <EmptyState title={t('details.unavailableTitle')} body={t('details.unavailableBody')} />
            </section>
          </div>
        )}
        {!shouldGateWorkspaceView && activeView === 'notifications' && (
          <div className="page-transition-frame" key={activeView}>
            <NotificationsPage notifications={appState.notifications} user={user} />
          </div>
        )}
        {!shouldGateWorkspaceView && activeView === 'profile' && (
          <div className="page-transition-frame" key={activeView}>
            <ProfilePage user={user} onThemePreferenceChange={handleThemePreferenceChange} />
          </div>
        )}
        {!shouldGateWorkspaceView && activeView === 'analytics' && canUseAnalytics && (
          <div className="page-transition-frame" key={activeView}>
            <AnalyticsPage
              appState={appState}
              user={user}
              route={route}
              onRouteChange={(path, options) => navigateToPath(path, options)}
            />
          </div>
        )}
        {!shouldGateWorkspaceView && activeView === 'admin' && canUseAdmin && (
          <div className="page-transition-frame" key={activeView}>
            <AdminPage
              users={appState.users}
              units={appState.units}
              settings={appState.settings}
              auditLogs={appState.auditLogs}
              lookupValues={activeLookupValues}
              lookupCount={activeLookupValues.length}
              activeSection={activeAdminSection}
              activeDirectory={activeMasterDataDirectory}
              onSectionChange={(section) => navigateToPath(adminSectionPath(adminSectionToSlug[section]))}
              onDirectoryChange={(directory) => navigateToPath(masterDataPath(masterDataDirectoryToSlug[directory]))}
              defaultBranchId={user.branchId}
              branches={appState.branches}
              teams={appState.teams}
              onCreateLookupValue={async (kind, label, thumbnailFile) => {
                const cleanLabel = label.trim()
                if (!cleanLabel) throw new Error('Label is required.')

                if (supabase && isSupabaseConfigured) {
                  const { data, error } = await supabase
                    .from('lookup_values')
                    .insert({ kind, label: cleanLabel })
                    .select('id, kind, label, thumbnail_path, archived')
                    .single()
                  if (error) throw new Error(error.message)

                  let value = toLookupValue(data)
                  if (thumbnailFile && supportsLookupThumbnail(kind)) {
                    const thumbnailPath = await uploadLookupThumbnail(kind, value.id, thumbnailFile)
                    const { data: updatedData, error: updateError } = await supabase
                      .from('lookup_values')
                      .update({ thumbnail_path: thumbnailPath })
                      .eq('id', value.id)
                      .select('id, kind, label, thumbnail_path, archived')
                      .single()
                    if (updateError) throw new Error(updateError.message)
                    value = toLookupValue(updatedData)
                  }
                  setActiveLookupValues((values) => [...values, value].sort((first, second) => compareText(locale, first.label, second.label)))
                  setFlash({ text: 'Master data value created.', messageKey: null, messageParams: null })
                  return
                }

                const value = {
                  id: `lookup-${kind}-${Date.now()}`,
                  kind,
                  label: cleanLabel,
                  thumbnailPath: thumbnailFile && supportsLookupThumbnail(kind) ? await fileToDataUrl(thumbnailFile) : null,
                } satisfies LookupValue
                setActiveLookupValues((values) => [...values, value].sort((first, second) => compareText(locale, first.label, second.label)))
                setFlash({ text: 'Master data value created.', messageKey: null, messageParams: null })
              }}
              onUpdateLookupValue={async (lookupId, label, thumbnailChange) => {
                const cleanLabel = label.trim()
                if (!cleanLabel) throw new Error('Label is required.')
                const existingValue = activeLookupValues.find((item) => item.id === lookupId)
                const canStoreThumbnail = existingValue ? supportsLookupThumbnail(existingValue.kind) : false

                if (supabase && isSupabaseConfigured) {
                  let thumbnailPath = existingValue?.thumbnailPath ?? null
                  if (canStoreThumbnail && thumbnailChange?.file) {
                    thumbnailPath = await uploadLookupThumbnail(existingValue!.kind, lookupId, thumbnailChange.file)
                  } else if (canStoreThumbnail && thumbnailChange?.remove) {
                    thumbnailPath = null
                  }

                  const { data, error } = await supabase
                    .from('lookup_values')
                    .update({ label: cleanLabel, thumbnail_path: thumbnailPath })
                    .eq('id', lookupId)
                    .select('id, kind, label, thumbnail_path, archived')
                    .single()
                  if (error) throw new Error(error.message)
                  const value = toLookupValue(data)
                  if (canStoreThumbnail && existingValue?.thumbnailPath && existingValue.thumbnailPath !== value.thumbnailPath && !existingValue.thumbnailPath.startsWith('data:')) {
                    await removeLookupThumbnail(existingValue.thumbnailPath)
                  }
                  setActiveLookupValues((values) => values.map((item) => (item.id === lookupId ? value : item)).sort((first, second) => compareText(locale, first.label, second.label)))
                  setFlash({ text: 'Master data value updated.', messageKey: null, messageParams: null })
                  return
                }

                const thumbnailPath = canStoreThumbnail && thumbnailChange?.file
                  ? await fileToDataUrl(thumbnailChange.file)
                  : canStoreThumbnail && thumbnailChange?.remove
                    ? null
                    : existingValue?.thumbnailPath ?? null
                setActiveLookupValues((values) => values.map((item) => (item.id === lookupId ? { ...item, label: cleanLabel, thumbnailPath } : item)).sort((first, second) => compareText(locale, first.label, second.label)))
                setFlash({ text: 'Master data value updated.', messageKey: null, messageParams: null })
              }}
              onArchiveLookupValue={async (lookupId) => {
                if (supabase && isSupabaseConfigured) {
                  const { error } = await supabase.from('lookup_values').update({ archived: true }).eq('id', lookupId)
                  if (error) throw new Error(error.message)
                }
                setActiveLookupValues((values) => values.filter((item) => item.id !== lookupId))
                setFlash({ text: 'Master data value archived.', messageKey: null, messageParams: null })
              }}
              onCreateBranch={async (name) => {
                const cleanName = name.trim()
                if (!cleanName) throw new Error('Branch name is required.')

                if (supabase && isSupabaseConfigured) {
                  const { data, error } = await supabase
                    .from('branches')
                    .insert({ name: cleanName })
                    .select('id, name, archived')
                    .single()
                  if (error) throw new Error(error.message)
                  const branch = toBranchDirectoryItem(data)
                  setAppState((state) => ({ ...state, branches: [...state.branches, branch].sort((first, second) => compareText(locale, first.name, second.name)) }))
                  setFlash({ text: 'Branch created.', messageKey: null, messageParams: null })
                  return
                }

                const branch = { id: `branch-${Date.now()}`, name: cleanName }
                setAppState((state) => ({ ...state, branches: [...state.branches, branch].sort((first, second) => compareText(locale, first.name, second.name)) }))
                setFlash({ text: 'Branch created.', messageKey: null, messageParams: null })
              }}
              onUpdateBranch={async (branchId, name) => {
                const cleanName = name.trim()
                if (!cleanName) throw new Error('Branch name is required.')

                if (supabase && isSupabaseConfigured) {
                  const { data, error } = await supabase
                    .from('branches')
                    .update({ name: cleanName })
                    .eq('id', branchId)
                    .select('id, name, archived')
                    .single()
                  if (error) throw new Error(error.message)
                  const branch = toBranchDirectoryItem(data)
                  setAppState((state) => ({ ...state, branches: state.branches.map((item) => (item.id === branchId ? branch : item)).sort((first, second) => compareText(locale, first.name, second.name)) }))
                  setFlash({ text: 'Branch updated.', messageKey: null, messageParams: null })
                  return
                }

                setAppState((state) => ({ ...state, branches: state.branches.map((item) => (item.id === branchId ? { ...item, name: cleanName } : item)).sort((first, second) => compareText(locale, first.name, second.name)) }))
                setFlash({ text: 'Branch updated.', messageKey: null, messageParams: null })
              }}
              onArchiveBranch={async (branchId) => {
                if (supabase && isSupabaseConfigured) {
                  const { error } = await supabase.from('branches').update({ archived: true }).eq('id', branchId)
                  if (error) throw new Error(error.message)
                }
                setAppState((state) => ({ ...state, branches: state.branches.filter((item) => item.id !== branchId) }))
                setFlash({ text: 'Branch archived.', messageKey: null, messageParams: null })
              }}
              onCreateTeam={async (name) => {
                const cleanName = name.trim()
                if (!cleanName) throw new Error('Team name is required.')

                if (supabase && isSupabaseConfigured) {
                  const { data, error } = await supabase
                    .from('teams')
                    .insert({ name: cleanName, branch_id: null })
                    .select('id, name, branch_id, archived')
                    .single()
                  if (error) throw new Error(error.message)
                  const team = {
                    id: String(data.id),
                    name: String(data.name),
                    branchId: typeof data.branch_id === 'string' ? data.branch_id : null,
                    archived: Boolean(data.archived),
                  }
                  setAppState((state) => ({ ...state, teams: [...state.teams, team].sort((first, second) => compareText(locale, first.name, second.name)) }))
                  setFlash({ text: 'Team created.', messageKey: null, messageParams: null })
                  return
                }

                const team = { id: `team-${Date.now()}`, name: cleanName, branchId: null }
                setAppState((state) => ({ ...state, teams: [...state.teams, team].sort((first, second) => compareText(locale, first.name, second.name)) }))
                setFlash({ text: 'Team created.', messageKey: null, messageParams: null })
              }}
              onUpdateTeam={async (teamId, name) => {
                const cleanName = name.trim()
                if (!cleanName) throw new Error('Team name is required.')

                if (supabase && isSupabaseConfigured) {
                  const { data, error } = await supabase
                    .from('teams')
                    .update({ name: cleanName })
                    .eq('id', teamId)
                    .select('id, name, branch_id, archived')
                    .single()
                  if (error) throw new Error(error.message)
                  const team = {
                    id: String(data.id),
                    name: String(data.name),
                    branchId: typeof data.branch_id === 'string' ? data.branch_id : null,
                    archived: Boolean(data.archived),
                  }
                  setAppState((state) => ({
                    ...state,
                    teams: state.teams.map((item) => (item.id === teamId ? team : item)).sort((first, second) => compareText(locale, first.name, second.name)),
                  }))
                  setFlash({ text: 'Team updated.', messageKey: null, messageParams: null })
                  return
                }

                setAppState((state) => ({
                  ...state,
                  teams: state.teams.map((item) => (item.id === teamId ? { ...item, name: cleanName } : item)).sort((first, second) => compareText(locale, first.name, second.name)),
                }))
                setFlash({ text: 'Team updated.', messageKey: null, messageParams: null })
              }}
              onArchiveTeam={async (teamId) => {
                if (supabase && isSupabaseConfigured) {
                  const { error } = await supabase.from('teams').update({ archived: true }).eq('id', teamId)
                  if (error) throw new Error(error.message)
                }
                setAppState((state) => ({ ...state, teams: state.teams.filter((item) => item.id !== teamId) }))
                setFlash({ text: 'Team removed.', messageKey: null, messageParams: null })
              }}
              onCreateUser={async (formData) => {
                const input = {
                  fullName: String(formData.get('fullName') ?? ''),
                  email: String(formData.get('email') ?? ''),
                  password: String(formData.get('password') ?? ''),
                  role: String(formData.get('role')) as LeadraUser['role'],
                  jobTitle: String(formData.get('jobTitle') ?? ''),
                  phoneNumber: String(formData.get('phoneNumber') ?? ''),
                  teamId: String(formData.get('teamId') ?? ''),
                  branchId: String(formData.get('branchId') ?? ''),
                  status: 'active',
                } satisfies Parameters<typeof createUserWorkflow>[2]
                const result = createUserWorkflow(appState, user, input)
                if (!result.ok) {
                  setFlash({ text: result.error, messageKey: result.errorKey ?? null, messageParams: result.errorParams ?? null })
                  return
                }

                if (supabase && isSupabaseConfigured) {
                  try {
                    const createdUser = await createManagedUserProfile(supabase, input)
                    setAppState((state) => ({
                      ...state,
                      users: [...state.users.filter((item) => item.id !== createdUser.id), createdUser],
                      auditLogs: result.state.auditLogs,
                      analyticsEvents: result.state.analyticsEvents,
                    }))
                    setFlash(createFlashMessage('flash.userCreated', 'User created and audit history updated.'))
                    return
                  } catch (error) {
                    setFlash({
                      text: error instanceof Error ? error.message : 'User creation failed.',
                      messageKey: null,
                      messageParams: null,
                    })
                    throw error
                  }
                }

                setAppState(result.state)
                setFlash(createFlashMessage('flash.userCreated', 'User created and audit history updated.'))
              }}
              onUpdateUser={async (userId, updates) => {
                const existingUser = appState.users.find((item) => item.id === userId)
                if (
                  existingUser?.status === 'active'
                  && updates.status === 'inactive'
                  && appState.units.some((unit) => unit.createdBy === existingUser.id && !unit.archived)
                ) {
                  throw new Error('Active Units must be reassigned before deactivation.')
                }

                const auditMessage = createAuditMessage('user_profile_updated')
                const nextUser =
                  supabase && isSupabaseConfigured
                    ? await updateManagedUserProfile(supabase, userId, {
                        fullName: updates.fullName ?? '',
                        email: updates.email ?? '',
                        role: updates.role ?? 'sales',
                        jobTitle: updates.jobTitle ?? '',
                        phoneNumber: updates.phoneNumber ?? '',
                        teamId: updates.teamId ?? '',
                        branchId: updates.branchId ?? '',
                        status: updates.status ?? 'active',
                      })
                    : { ...appState.users.find((item) => item.id === userId), ...updates } as LeadraUser

                setAppState((state) => ({
                  ...state,
                  users: state.users.map((item) => (item.id === userId ? { ...item, ...nextUser } : item)),
                  auditLogs: [
                    {
                      id: `audit-${Date.now()}`,
                      actorName: user.fullName,
                      actorRole: user.role,
                      actionType: auditMessage.text,
                      messageKey: auditMessage.messageKey ?? null,
                      messageParams: auditMessage.messageParams ?? null,
                      relatedUnitCode: userId,
                      createdAt: new Date().toISOString(),
                      ipAddress: null,
                    },
                    ...state.auditLogs,
                  ],
                }))
                if (currentUser?.id === userId) {
                  setCurrentUser((existing) => (existing ? { ...existing, ...nextUser } : existing))
                }
                setFlash(createFlashMessage('flash.userUpdated', 'User profile updated and audit history updated.'))
              }}
              onUpdateUserPassword={async (userId, password) => {
                if (!supabase) {
                  setFlash({
                    text: 'Password changes require production authentication.',
                    messageKey: null,
                    messageParams: null,
                  })
                  throw new Error('Password changes require production authentication.')
                }

                await updateManagedUserPassword(supabase, userId, password)
                setFlash({
                  text: 'Password updated. The user can sign in with the new password.',
                  messageKey: null,
                  messageParams: null,
                })
              }}
              onDeleteSalesRepresentative={async (salesUserId, replacementSalesUserId) => {
                const previousState = appState
                const result = deleteSalesRepresentativeWorkflow(appState, user, salesUserId, replacementSalesUserId)
                if (!result.ok) {
                  setFlash({ text: result.error, messageKey: result.errorKey ?? null, messageParams: result.errorParams ?? null })
                  return
                }

                setAppState(result.state)
                try {
                  if (supabase && isSupabaseConfigured) {
                    const replacement = result.state.users.find((item) => item.id === replacementSalesUserId)
                    if (!replacement) throw new Error('Replacement user was not found.')
                    await new LeadraRepository(supabase).deleteSalesRepresentativeAfterReassignment(salesUserId, replacement, user)
                  }
                  setFlash(createFlashMessage('flash.salesRepDeactivated', 'User deactivated after reassignment.'))
                } catch (error) {
                  setAppState(previousState)
                  setFlash({
                    text: error instanceof Error ? error.message : 'Sales representative could not be deactivated.',
                    messageKey: null,
                    messageParams: null,
                  })
                  throw error
                }
              }}
              onDeleteManagedUser={async (managedUserId) => {
                const previousState = appState
                const result = deleteManagedUserWorkflow(appState, user, managedUserId)
                if (!result.ok) {
                  setFlash({ text: result.error, messageKey: result.errorKey ?? null, messageParams: result.errorParams ?? null })
                  return
                }

                setAppState(result.state)
                try {
                  if (supabase && isSupabaseConfigured) {
                    const managedUser = appState.users.find((item) => item.id === managedUserId)
                    if (!managedUser) throw new Error('User was not found.')
                    await updateManagedUserProfile(supabase, managedUserId, {
                      fullName: managedUser.fullName,
                      email: managedUser.email,
                      role: managedUser.role,
                      jobTitle: managedUser.jobTitle,
                      phoneNumber: managedUser.phoneNumber,
                      teamId: managedUser.teamId,
                      branchId: managedUser.branchId,
                      status: 'inactive',
                    })
                  }
                  setFlash(createFlashMessage('flash.userDeleted', 'User deactivated and audit history updated.'))
                } catch (error) {
                  setAppState(previousState)
                  setFlash({
                    text: error instanceof Error ? error.message : 'User could not be deactivated.',
                    messageKey: null,
                    messageParams: null,
                  })
                  throw error
                }
              }}
              onSettingsUpdate={async (settingsPatch) => {
                const result = updateSettingsWorkflow(appState, user, settingsPatch)
                setAppState(result.state)
                if (result.ok) setGeneratedPdfs({})
                if (result.ok && supabase && isSupabaseConfigured) {
                  const { error } = await supabase
                    .from('app_settings')
                    .update({
                      company_name: result.state.settings.companyName,
                      commission_percentage: result.state.settings.commissionPercentage,
                      footer_text: result.state.settings.footerText,
                      contact_details: result.state.settings.contactDetails,
                      logo_path: result.state.settings.logoPath || null,
                      pdf_layout: result.state.settings.pdfLayout,
                      media_limit_mb: result.state.settings.mediaLimitMb,
                    })
                    .eq('id', true)
                  if (error) {
                    setAppState(appState)
                    setFlash({ text: error.message, messageKey: null, messageParams: null })
                    throw new Error(error.message)
                  }
                }
                setFlash(
                  result.ok
                    ? createFlashMessage('flash.settingsUpdated', 'Settings updated and audited.')
                    : { text: result.error, messageKey: result.errorKey ?? null, messageParams: result.errorParams ?? null },
                )
              }}
            />
          </div>
        )}
      </main>

      {mobileMenuOpen && (
        <div className="mobile-more-sheet" role="menu" aria-label={t('nav.mobileMore')}>
          <NavButton active={activeView === 'notifications'} label={t('nav.alerts', { count: unreadCount })} to={pathForView('notifications')} onClick={closeNavigation} icon={<Bell />} className="motion-stage" style={motionStyle(0)} />
          {canUseAnalytics && (
            <NavButton active={activeView === 'analytics'} label={t('nav.analytics')} to={pathForView('analytics')} onClick={closeNavigation} icon={<BarChart3 />} className="motion-stage" style={motionStyle(1)} />
          )}
          <NavButton active={activeView === 'special'} label={t('nav.special')} to={pathForView('special')} onClick={closeNavigation} icon={<Star />} className="motion-stage" style={motionStyle(2)} />
          <NavButton active={activeView === 'profile'} label={t('nav.profile')} to={pathForView('profile')} onClick={closeNavigation} icon={<SlidersHorizontal />} className="motion-stage" style={motionStyle(3)} />
          {canUseAdmin && (
            <NavButton active={activeView === 'admin'} label={t('nav.admin')} to={pathForView('admin')} onClick={closeNavigation} icon={<Settings />} className="motion-stage" style={motionStyle(4)} />
          )}
        </div>
      )}

      <nav className="bottom-nav" aria-label={t('nav.mobile')}>
        <NavButton active={activeView === 'dashboard'} label={t('nav.home')} to={pathForView('dashboard')} onClick={closeNavigation} icon={<Home />} className="motion-stage" style={motionStyle(0)} />
        <NavButton active={activeView === 'units'} label={t('nav.units')} to={pathForView('units')} onClick={closeNavigation} icon={<Building2 />} className="motion-stage" style={motionStyle(1)} />
        <NavButton active={activeView === 'create'} label={t('nav.add')} to={pathForView('create')} onClick={closeNavigation} icon={<Plus />} className="motion-stage" style={motionStyle(2)} />
        <NavButton
          active={mobileMenuOpen || activeView === 'notifications' || activeView === 'analytics' || activeView === 'special' || activeView === 'profile' || activeView === 'admin'}
          label={t('nav.more')}
          onClick={() => setMobileMenuOpen((open) => !open)}
          icon={<MoreHorizontal />}
          className="motion-stage"
          style={motionStyle(3)}
        />
      </nav>

      {flash && (
        <div className="toast-region" role="status" aria-live="polite" aria-atomic="true">
          <div className="flash motion-flash">{renderFlash(locale, flash)}</div>
        </div>
      )}
    </div>
  )
}

function LoginScreen({
  authLoading,
  loginError,
  onLogin,
  onPasswordLogin,
}: {
  authLoading: boolean
  loginError: UiMessage | null
  onLogin: (user: LeadraUser) => void
  onPasswordLogin: (email: string, password: string) => void
}) {
  const { locale, t } = useLocale()
  const { themePreference } = useTheme()
  const brandAssets = leadraBrandAssets[themePreference]
  const [step, setStep] = useState<'intro' | 'login'>('login')
  const [isCompactViewport, setIsCompactViewport] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth <= 860 : false
  ))
  const activeStep = loginError ? 'login' : step
  const introContent = locale === 'ar'
    ? {
        eyebrow: 'نظرة عامة على المنصة',
        heading: 'تعرّف على كيف يحافظ ليدرا على تنظيم فرق إعادة البيع قبل الدخول.',
        copy: 'يستبدل ليدرا متابعة الجداول بمساحة عمل واحدة منظّمة لفرق المبيعات والمديرين والإدارة.',
        roleCopy: 'كل دور يرى فقط الوحدات وبيانات المالك والأدوات التي تقع ضمن نطاقه.',
        auditTitle: 'سير عمل جاهز للتدقيق',
        auditCopy: 'يتم تسجيل كل تغيير حالة أو ملاحظة أو تصدير داخل سجل تشغيلي واضح.',
        analyticsTitle: 'تحليلات مباشرة',
        analyticsCopy: 'يمكن للمديرين والإدارة متابعة الحركة والسرعة وأداء الفريق بدون انتظار تقارير يدوية.',
        next: 'المتابعة إلى تسجيل الدخول',
        back: 'رجوع',
      }
    : {
        eyebrow: 'Platform overview',
        heading: 'See how Leadra keeps resale teams aligned before you enter.',
        copy: 'Leadra replaces spreadsheet chasing with one controlled workspace for sales, managers, and admins.',
        roleCopy: 'Each role sees only the units, owner data, and tools that belong to its scope.',
        auditTitle: 'Audit-ready workflows',
        auditCopy: 'Every status change, note, and export is captured in a clean operational trail.',
        analyticsTitle: 'Live analytics',
        analyticsCopy: 'Managers and admins can track movement, velocity, and team output without waiting for manual reports.',
        next: 'Continue to sign in',
        back: 'Back',
      }

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const sync = () => setIsCompactViewport(window.innerWidth <= 860)
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [])

  if (authLoading && !loginError) {
    return (
      <main className="login-screen motion-login" aria-busy="true">
        <PageSkeleton kind="form" />
      </main>
    )
  }

  return (
    <main className="login-screen motion-login">
      {activeStep === 'intro' ? (
        <section className="login-card login-card-intro">
          <div className="login-brand-panel motion-stage motion-hero" style={motionStyle(0)}>
            <div className="login-brand-top">
              <img className="login-mark" src={brandAssets.logo} alt="Leadra" />
              <ThemeToggle compact />
            </div>
            <p className="eyebrow">{t('login.brandEyebrow')}</p>
            <h1>{t('login.brandTitle')}</h1>
            <p className="login-copy">{t('login.brandCopy')}</p>
            <div className="login-proof-grid" aria-label={t('login.safeguards')}>
              <span>{t('login.safeguard.role')}</span>
              <span>{t('login.safeguard.owner')}</span>
              <span>{t('login.safeguard.audit')}</span>
            </div>
            {isCompactViewport && (
              <div className="login-step-actions mobile-intro-cta">
                <button className="primary-button" type="button" onClick={() => setStep('login')}>
                  {introContent.next}
                  <ArrowRight size={18} />
                </button>
              </div>
            )}
          </div>

          <div className="login-intro-panel motion-stage" style={motionStyle(1, 50)}>
            <p className="eyebrow">{introContent.eyebrow}</p>
            <h2>{introContent.heading}</h2>
            <p>{introContent.copy}</p>
            <div className="login-story-list" aria-label={t('login.safeguards')}>
              <LoginStoryItem icon={<Users size={18} />} title={t('login.safeguard.role')} body={introContent.roleCopy} index={0} />
              <LoginStoryItem icon={<FileText size={18} />} title={introContent.auditTitle} body={introContent.auditCopy} index={1} />
              <LoginStoryItem icon={<BarChart3 size={18} />} title={introContent.analyticsTitle} body={introContent.analyticsCopy} index={2} />
            </div>
            <div className="login-step-actions">
              <button className="primary-button" type="button" onClick={() => setStep('login')}>
                {introContent.next}
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="login-card login-card-access">
          <div className="login-access-panel login-access-panel-standalone motion-stage motion-hero" style={motionStyle(0)}>
            <div className="login-panel-topbar">
              <button className="ghost-button login-back-button" type="button" onClick={() => setStep('intro')}>
                {introContent.back}
              </button>
              <ThemeToggle compact />
            </div>
            <div className="login-access-copy">
              <p className="eyebrow">{t('login.accessEyebrow')}</p>
              <h2>{t('login.heading')}</h2>
              <p>{t('login.description')}</p>
            </div>
            {isSupabaseConfigured && (
              <form
                className="auth-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  const formData = new FormData(event.currentTarget)
                  onPasswordLogin(String(formData.get('email')), String(formData.get('password')))
                }}
              >
                <label>
                  {t('login.email')}
                  <input name="email" type="email" autoComplete="email" required placeholder={t('login.emailPlaceholder')} dir="auto" />
                </label>
                <PasswordField label={t('login.password')} name="password" autoComplete="current-password" placeholder={t('login.passwordPlaceholder')} required />
                {loginError && <p className="form-error">{renderError(locale, { message: loginError.message, messageKey: loginError.messageKey, messageParams: loginError.messageParams })}</p>}
                <button className="primary-button" type="submit" disabled={authLoading}>
                  {authLoading ? t('login.signingIn') : t('login.signIn')}
                </button>
              </form>
            )}
            {canUseDemoMode && !isSupabaseConfigured && (
              <>
                <p className="login-helper">{t('login.demoHelper')}</p>
                <div className="role-grid" aria-label={t('login.roleOptions')}>
                  {demoUsers.map((user, index) => (
                    <button
                      key={user.id}
                      className="role-card motion-stage"
                      type="button"
                      style={motionStyle(index, 140)}
                      onClick={() => onLogin(user)}
                    >
                      <span>{getRoleLabel(locale, user.role)}</span>
                      <strong>{user.role === 'admin' ? t('login.continueAsAdmin') : t('login.continueAsUser', { name: user.fullName })}</strong>
                      <small dir="auto">{user.email}</small>
                    </button>
                  ))}
                </div>
              </>
            )}
            {isProductionMissingSupabaseConfig && <p className="form-error">{t('login.unavailable')}</p>}
          </div>
        </section>
      )}
    </main>
  )
}

function LoginStoryItem({ icon, title, body, index }: { icon: ReactNode; title: string; body: string; index: number }) {
  return (
    <div className="login-story-item motion-stage" style={motionStyle(index, 120)}>
      <div className="login-story-icon" aria-hidden="true">{icon}</div>
      <div>
        <strong>{title}</strong>
        <p>{body}</p>
      </div>
    </div>
  )
}

function PaletteSamplePage() {
  const { themePreference } = useTheme()
  const brandAssets = leadraBrandAssets[themePreference]
  const sampleStats = [
    ['Active listings', '248', 'Ivory metrics on rich black'],
    ['Qualified buyers', '1,420', 'Ivory text on dark slate'],
    ['Booked tours', '36', 'Copper accent states'],
  ]
  const sampleUnits = [
    ['Seaview Villa', 'Charcoal card / Ivory copy', 'Copper accent'],
    ['Ras El Hekma Chalet', 'Dark slate section / linen border', 'Graphite CTA'],
    ['North Coast Residence', 'Rich black surface / linen status', 'Deep graphite'],
  ]

  return (
    <section className="palette-sample page-entrance">
      <div className="palette-sample-hero motion-stage" style={motionStyle(0)}>
        <div>
          <p className="eyebrow">Leadra color sample</p>
          <h2>Dark luxury workspace</h2>
          <p>Sample page only. This version uses the primary dark identity from the reference: Onyx, Graphite, Charcoal, and Muted Copper.</p>
        </div>
        <img className="palette-sample-logo" src={brandAssets.mark} alt="" aria-hidden="true" />
      </div>

      <div className="palette-swatch-grid motion-stage" style={motionStyle(1, 40)}>
        {[
          ['Rich Black', '#0D0D0F'],
          ['Muted Copper', '#a76f4d'],
          ['Charcoal', '#17171A'],
          ['Dark Slate', '#1F1F23'],
          ['Warm Ivory', '#F6F1EA'],
          ['Graphite', '#1f1f23'],
          ['Soft Linen', '#EFE7DD'],
          ['Taupe Grey', '#7D7468'],
        ].map(([name, value], index) => (
          <div className="palette-swatch motion-stage" key={name} style={motionStyle(index, 80)}>
            <span style={{ background: value }} />
            <strong>{name}</strong>
            <small>{value}</small>
          </div>
        ))}
      </div>

      <section className="palette-sample-grid">
        {sampleStats.map(([label, value, note], index) => (
          <div className="palette-stat-card motion-stage" key={label} style={motionStyle(index, 120)}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{note}</small>
          </div>
        ))}
      </section>

      <section className="palette-list-panel motion-stage" style={motionStyle(2, 140)}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Unit cards</p>
            <h2>Primary dark palette sample</h2>
          </div>
          <button className="palette-primary-button" type="button">View details</button>
        </div>
        <div className="palette-unit-list">
          {sampleUnits.map(([name, detail, status], index) => (
            <button className="palette-unit-row motion-stage" key={name} style={motionStyle(index, 170)} type="button">
              <div className="palette-thumb" />
              <div>
                <strong>{name}</strong>
                <p>{detail}</p>
              </div>
              <span>{status}</span>
            </button>
          ))}
        </div>
      </section>
    </section>
  )
}

function Dashboard({
  user,
  appState,
  units,
  notifications,
  onNavigate,
  onOpenUnit,
}: {
  user: LeadraUser
  appState: AppDataState
  units: LeadraUnit[]
  notifications: NotificationItem[]
  onNavigate: (view: View) => void
  onOpenUnit: (unitId: number) => void
}) {
  const { locale, t } = useLocale()
  const [now] = useState(() => Date.now())
  const isSalesDashboard = user.role === 'sales'
  const salesUploads = isSalesDashboard
    ? units.filter((unit) => unit.createdBy === user.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : units
  const latestUnits = isSalesDashboard ? salesUploads.slice(0, 3) : units.slice(0, 3)
  const metricUnits = isSalesDashboard ? salesUploads : units
  const available = metricUnits.filter((unit) => unit.status === 'available').length
  const hold = metricUnits.filter((unit) => unit.status === 'hold').length
  const sold = metricUnits.filter((unit) => isSoldStatus(unit.status)).length
  const latestSalesUploadAt = salesUploads[0]?.createdAt ?? null
  const salesUploadInactive = isSalesDashboard && (!latestSalesUploadAt || now - new Date(latestSalesUploadAt).getTime() > 72 * 60 * 60 * 1000)

  if (user.role === 'manager') {
    return <ManagerDashboard user={user} appState={appState} units={units} notifications={notifications} onNavigate={onNavigate} onOpenUnit={onOpenUnit} />
  }

  if (user.role === 'admin' || user.role === 'sub_admin') {
    return <AdminDashboard user={user} appState={appState} units={units} notifications={notifications} onNavigate={onNavigate} onOpenUnit={onOpenUnit} />
  }

  return (
    <section className="page-grid page-entrance dashboard-page">
      <div className="hero-panel motion-stage motion-hero" style={motionStyle(0)}>
        <p className="eyebrow">{t('dashboard.eyebrow', { role: getRoleLabel(locale, user.role) })}</p>
        <h2>{dashboardTitle(user.role, locale)}</h2>
        <p>{dashboardDescription(user.role, locale)}</p>
        <div className="action-row">
          <button className="primary-button" type="button" onClick={() => onNavigate('create')}>
            <Plus size={18} /> {t('dashboard.quickAdd')}
          </button>
          <a
            className="secondary-link"
            href="/units"
            onClick={(event) => {
              event.preventDefault()
              onNavigate('units')
            }}
          >
            {t('dashboard.viewAllUnits')}
          </a>
        </div>
      </div>

      <div className="metric-grid motion-stage" style={motionStyle(1, 40)}>
        <Metric label={isSalesDashboard ? t('dashboard.myUploads') : t('dashboard.visibleUnits')} value={formatCount(locale, metricUnits.length)} style={motionStyle(0, 120)} />
        <Metric label={getStatusLabel(locale, 'available')} value={formatCount(locale, available)} style={motionStyle(1, 150)} />
        <Metric label={getStatusLabel(locale, 'hold')} value={formatCount(locale, hold)} style={motionStyle(2, 180)} />
        <Metric label={getStatusLabel(locale, 'sold')} value={formatCount(locale, sold)} style={motionStyle(3, 210)} />
      </div>

      {salesUploadInactive && (
        <section className="content-card motion-stage" style={motionStyle(2, 70)} aria-label={t('dashboard.salesUploadWarningTitle')}>
          <div className="notification-row">
            <Bell size={16} />
            <div>
              <strong>{t('dashboard.salesUploadWarningTitle')}</strong>
              <p>
                {latestSalesUploadAt
                  ? t('dashboard.salesUploadWarningBody', { date: formatDate(locale, latestSalesUploadAt) })
                  : t('dashboard.salesNoUploadWarningBody')}
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="content-card motion-stage" style={motionStyle(salesUploadInactive ? 3 : 2, 90)}>
        <h2>{isSalesDashboard ? t('dashboard.latestMyUploads') : t('dashboard.latestActivity')}</h2>
        {latestUnits.length === 0 && <EmptyState title={t('dashboard.noUnitsTitle')} body={t('dashboard.noUnitsBody')} />}
        {latestUnits.map((unit, index) => (
          <UnitListRow key={unit.id} user={user} unit={unit} index={index} onOpen={() => onOpenUnit(unit.id)} />
        ))}
      </section>

      <section className="content-card motion-stage" style={motionStyle(salesUploadInactive ? 4 : 3, 130)}>
        <h2>{t('dashboard.notificationCenter')}</h2>
        {notifications.length === 0 && <EmptyState title={t('dashboard.noNotificationsTitle')} body={t('dashboard.noNotificationsBody')} />}
        {notifications.slice(0, 3).map((notification, index) => (
          <div className="notification-row motion-stage" key={notification.id} style={motionStyle(index, 180)}>
            <Bell size={16} />
            <div>
              <strong>{renderNotificationTitle(locale, notification)}</strong>
              <p>{renderNotificationBody(locale, notification)}</p>
            </div>
          </div>
        ))}
      </section>
    </section>
  )
}

function AdminDashboard({
  user,
  appState,
  units,
  notifications,
  onNavigate,
  onOpenUnit,
}: {
  user: LeadraUser
  appState: AppDataState
  units: LeadraUnit[]
  notifications: NotificationItem[]
  onNavigate: (view: View) => void
  onOpenUnit: (unitId: number) => void
}) {
  const { locale, t } = useLocale()
  const activeUnits = units.filter((unit) => !unit.archived)
  const latestUnits = [...activeUnits].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 4)
  const available = activeUnits.filter((unit) => unit.status === 'available').length
  const hold = activeUnits.filter((unit) => unit.status === 'hold').length
  const sold = activeUnits.filter((unit) => isSoldStatus(unit.status)).length
  const duplicateAttempts = appState.analyticsEvents.filter((event) => event.eventType === 'duplicate_phone_blocked').length
  const pdfExports = appState.analyticsEvents.filter((event) => event.eventType === 'pdf_generated' || event.eventType === 'pdf_shared_or_downloaded').length
  const teamRollups = buildTeamDashboardRollups(activeUnits, appState, locale)
  const developerRollups = buildUnitDashboardRollups(activeUnits, 'developerId', 'developerName', locale)
  const destinationRollups = buildUnitDashboardRollups(activeUnits, 'destinationId', 'destinationName', locale)
  const projectRollups = buildUnitDashboardRollups(activeUnits, 'projectId', 'projectName', locale)

  return (
    <section className="page-stack page-entrance dashboard-page admin-dashboard">
      <div className="hero-panel motion-stage motion-hero" style={motionStyle(0)}>
        <p className="eyebrow">{t('dashboard.eyebrow', { role: getRoleLabel(locale, user.role) })}</p>
        <h2>{dashboardTitle(user.role, locale)}</h2>
        <p>{dashboardDescription(user.role, locale)}</p>
        <div className="action-row">
          <button className="primary-button" type="button" onClick={() => onNavigate('analytics')}>
            <BarChart3 size={18} /> {t('dashboard.openAnalytics')}
          </button>
          <a
            className="secondary-link"
            href="/units"
            onClick={(event) => {
              event.preventDefault()
              onNavigate('units')
            }}
          >
            {t('dashboard.viewAllUnits')}
          </a>
        </div>
      </div>

      <div className="metric-grid motion-stage" style={motionStyle(1, 40)}>
        <Metric label={t('dashboard.visibleUnits')} value={formatCount(locale, activeUnits.length)} style={motionStyle(0, 120)} />
        <Metric label={getStatusLabel(locale, 'available')} value={formatCount(locale, available)} style={motionStyle(1, 150)} />
        <Metric label={getStatusLabel(locale, 'hold')} value={formatCount(locale, hold)} style={motionStyle(2, 180)} />
        <Metric label={getStatusLabel(locale, 'sold')} value={formatCount(locale, sold)} style={motionStyle(3, 210)} />
        <Metric label={t('analytics.duplicateAttempts')} value={formatCount(locale, duplicateAttempts)} style={motionStyle(4, 240)} />
        <Metric label={t('analytics.pdfExports')} value={formatCount(locale, pdfExports)} style={motionStyle(5, 270)} />
      </div>

      <div className="page-grid">
        <AdminRollupPanel title={t('dashboard.adminTeams')} items={teamRollups} locale={locale} />
        <AdminRollupPanel title={t('dashboard.adminDevelopers')} items={developerRollups} locale={locale} />
      </div>

      <div className="page-grid">
        <AdminRollupPanel title={t('dashboard.adminDestinations')} items={destinationRollups} locale={locale} />
        <AdminRollupPanel title={t('dashboard.adminProjects')} items={projectRollups} locale={locale} />
      </div>

      <div className="page-grid">
        <section className="content-card motion-stage" style={motionStyle(6, 140)}>
          <h2>{t('dashboard.latestActivity')}</h2>
          {latestUnits.length === 0 && <EmptyState title={t('dashboard.noUnitsTitle')} body={t('dashboard.noUnitsBody')} />}
          {latestUnits.map((unit, index) => (
            <UnitListRow key={unit.id} user={user} unit={unit} index={index} onOpen={() => onOpenUnit(unit.id)} />
          ))}
        </section>
        <section className="content-card motion-stage" style={motionStyle(7, 170)}>
          <h2>{t('dashboard.notificationCenter')}</h2>
          {notifications.length === 0 && <EmptyState title={t('dashboard.noNotificationsTitle')} body={t('dashboard.noNotificationsBody')} />}
          {notifications.slice(0, 3).map((notification, index) => (
            <div className="notification-row motion-stage" key={notification.id} style={motionStyle(index, 180)}>
              <Bell size={16} />
              <div>
                <strong>{renderNotificationTitle(locale, notification)}</strong>
                <p>{renderNotificationBody(locale, notification)}</p>
              </div>
            </div>
          ))}
        </section>
      </div>
    </section>
  )
}

function AdminRollupPanel({ title, items, locale }: { title: string; items: DashboardRollup[]; locale: LocaleCode }) {
  const { t } = useLocale()
  return (
    <section className="content-card motion-stage" style={motionStyle(2, 90)}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t('dashboard.sortedByVolume')}</p>
          <h2>{title}</h2>
        </div>
      </div>
      {items.length === 0 && <EmptyState title={t('dashboard.noUnitsTitle')} body={t('dashboard.noUnitsBody')} />}
      <div className="analytics-table">
        {items.slice(0, 5).map((item, index) => (
          <div className="analytics-row project-health-row motion-stage" key={item.id} style={motionStyle(index, 120)}>
            <div>
              <strong dir="auto">{item.label}</strong>
              {item.meta && <p dir="auto">{item.meta}</p>}
            </div>
            <span className="analytics-chip">{t('units.totalUnits', { count: formatCount(locale, item.totalUnits) })}</span>
            <span className="analytics-chip success">{t('analytics.availableChip', { count: formatCount(locale, item.availableUnits) })}</span>
            <span className="analytics-chip warning">{t('analytics.holdChip', { ratio: formatCount(locale, item.holdUnits) })}</span>
            <span className="analytics-chip">{getStatusLabel(locale, 'sold')}: {formatCount(locale, item.soldUnits)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function ManagerDashboard({
  user,
  appState,
  units,
  notifications,
  onNavigate,
  onOpenUnit,
}: {
  user: LeadraUser
  appState: AppDataState
  units: LeadraUnit[]
  notifications: NotificationItem[]
  onNavigate: (view: View) => void
  onOpenUnit: (unitId: number) => void
}) {
  const { locale, t } = useLocale()
  const [now] = useState(() => Date.now())
  const activeVisibleUnits = units.filter((unit) => !unit.archived)
  const latestVisibleUnits = [...activeVisibleUnits].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 4)
  const teamEvents = appState.analyticsEvents.filter((event) => event.teamId === user.teamId)
  const recentStatusEvents = teamEvents.filter((event) => event.eventType === 'status_changed').slice(0, 4)
  const installmentUpdates = activeVisibleUnits
    .filter((unit) => unit.paymentMethod === 'installment')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 4)
  const inactiveUsers = appState.users.filter((member) => {
    if (member.teamId !== user.teamId || member.status !== 'active') return false
    if (!member.lastLoginAt) return true
    return now - new Date(member.lastLoginAt).getTime() > 72 * 60 * 60 * 1000
  })

  return (
    <section className="page-grid page-entrance dashboard-page manager-dashboard">
      <div className="hero-panel motion-stage motion-hero" style={motionStyle(0)}>
        <p className="eyebrow">{t('dashboard.eyebrow', { role: getRoleLabel(locale, user.role) })}</p>
        <h2>{dashboardTitle(user.role, locale)}</h2>
        <p>{dashboardDescription(user.role, locale)}</p>
        <div className="action-row">
          <button className="primary-button" type="button" onClick={() => onNavigate('create')}><Plus size={18} /> {t('dashboard.quickAdd')}</button>
          <button className="secondary-button" type="button" onClick={() => onNavigate('units')}>{t('dashboard.viewAllUnits')}</button>
        </div>
      </div>
      <div className="metric-grid motion-stage" style={motionStyle(1, 40)}>
        <Metric label={t('dashboard.visibleUnits')} value={formatCount(locale, activeVisibleUnits.length)} style={motionStyle(0, 120)} />
        <Metric label={t('dashboard.teamActivity')} value={formatCount(locale, teamEvents.length)} style={motionStyle(1, 150)} />
        <Metric label={t('dashboard.installmentUpdates')} value={formatCount(locale, installmentUpdates.length)} style={motionStyle(2, 180)} />
        <Metric label={t('dashboard.inactivityAlerts')} value={formatCount(locale, inactiveUsers.length)} style={motionStyle(3, 210)} />
      </div>
      <ManagerPanel title={t('dashboard.latestActivity')}>
        {latestVisibleUnits.map((unit, index) => <UnitListRow key={unit.id} user={user} unit={unit} index={index} onOpen={() => onOpenUnit(unit.id)} />)}
      </ManagerPanel>
      <ManagerPanel title={t('dashboard.teamStatusChanges')}>
        {recentStatusEvents.length === 0 && <EmptyState title={t('dashboard.noUnitsTitle')} body={t('dashboard.noUnitsBody')} />}
        {recentStatusEvents.map((event, index) => (
          <div className="notification-row motion-stage" key={event.id} style={motionStyle(index, 120)}>
            <Bell size={16} />
            <div>
              <strong>{event.unitStatusAfter ? getStatusLabel(locale, event.unitStatusAfter) : t('status.available')}</strong>
              <p>{event.metadata?.unitCode ?? event.unitId}</p>
            </div>
          </div>
        ))}
      </ManagerPanel>
      <ManagerPanel title={t('dashboard.installmentUpdates')}>
        {installmentUpdates.map((unit, index) => <UnitListRow key={unit.id} user={user} unit={unit} index={index} onOpen={() => onOpenUnit(unit.id)} />)}
      </ManagerPanel>
      <ManagerPanel title={t('dashboard.inactivityAlerts')}>
        {inactiveUsers.length === 0 && <EmptyState title={t('dashboard.noNotificationsTitle')} body={t('dashboard.noNotificationsBody')} />}
        {inactiveUsers.map((member, index) => (
          <div className="notification-row motion-stage" key={member.id} style={motionStyle(index, 120)}>
            <Bell size={16} />
            <div>
              <strong>{member.fullName}</strong>
              <p>{member.lastLoginAt ? t('common.lastLogin', { date: formatDate(locale, member.lastLoginAt) }) : t('common.noLoginYet')}</p>
            </div>
          </div>
        ))}
      </ManagerPanel>
      <section className="content-card motion-stage" style={motionStyle(5, 130)}>
        <h2>{t('dashboard.notificationCenter')}</h2>
        {notifications.slice(0, 3).map((notification, index) => (
          <div className="notification-row motion-stage" key={notification.id} style={motionStyle(index, 180)}>
            <Bell size={16} />
            <div><strong>{renderNotificationTitle(locale, notification)}</strong><p>{renderNotificationBody(locale, notification)}</p></div>
          </div>
        ))}
      </section>
    </section>
  )
}

function ManagerPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="content-card motion-stage" style={motionStyle(2, 90)}>
      <h2>{title}</h2>
      {children}
    </section>
  )
}




function NotificationsPage({ notifications, user }: { notifications: NotificationItem[]; user: LeadraUser }) {
  const { locale, t } = useLocale()
  const [visibleCount, setVisibleCount] = useState(notificationPageSize)
  const visibleNotifications = notifications.filter(
    (notification) => notification.userId === user.id || notification.audienceRole === user.role || (!notification.userId && !notification.audienceRole),
  )
  const visibleRows = visibleNotifications.slice(0, visibleCount)

  return (
    <section className="content-card page-entrance notifications-page motion-stage motion-subtle" style={motionStyle(0)}>
      <h2>{t('notifications.heading')}</h2>
      {visibleNotifications.length === 0 && <EmptyState title={t('notifications.emptyTitle')} body={t('notifications.emptyBody')} />}
      {visibleRows.map((notification, index) => (
        <div className="notification-row motion-stage" key={notification.id} style={motionStyle(index, 90)}>
          <Bell size={17} />
          <div>
            <strong>{renderNotificationTitle(locale, notification)}</strong>
            <p>{renderNotificationBody(locale, notification)}</p>
            <small>{formatDateTime(locale, notification.createdAt)}</small>
          </div>
        </div>
      ))}
      {visibleRows.length < visibleNotifications.length && (
        <button className="secondary-button list-load-more" type="button" onClick={() => setVisibleCount((count) => Math.min(count + notificationPageSize, visibleNotifications.length))}>
          {t('common.showMoreOf', {
            count: formatCount(locale, Math.min(notificationPageSize, visibleNotifications.length - visibleRows.length)),
            total: formatCount(locale, visibleNotifications.length),
          })}
        </button>
      )}
    </section>
  )
}

function AnalyticsPage({
  appState,
  user,
  route,
  onRouteChange,
}: {
  appState: AppDataState
  user: LeadraUser
  route: AppRoute
  onRouteChange: (path: string, options?: { replace?: boolean }) => void
}) {
  const { locale, t } = useLocale()
  const routeFilterKey = JSON.stringify(route.analyticsFilters)
  const routeStateKey = `${route.analyticsWindow}:${routeFilterKey}`
  const routeFilters = analyticsFiltersFromRoute(route)
  const [filterState, setFilterState] = useState<{ routeKey: string; filters: LeadraAnalyticsFilters }>(() => ({
    routeKey: routeStateKey,
    filters: routeFilters,
  }))
  const filters = filterState.routeKey === routeStateKey ? filterState.filters : routeFilters
  const deferredFilters = useDeferredValue(filters)
  const filterOpen = route.analyticsFiltersOpen
  const [showAnalyticsDepth] = useState(true)
  const [rpcDashboard, setRpcDashboard] = useState<AnalyticsDashboard | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)
  const analyticsNow = useMemo(() => new Date(), [])
  const fallbackDashboard = useMemo(
    () => buildAnalyticsDashboard(user, appState, locale, analyticsNow, deferredFilters),
    [user, appState, locale, analyticsNow, deferredFilters],
  )
  const dashboard = rpcDashboard ?? fallbackDashboard
  const topSales = useMemo(() => dashboard.salesPerformance.slice(0, 6), [dashboard.salesPerformance])
  const latestTimeline = dashboard.activityTimeline
  const activeFilterCount =
    filters.teamIds.length +
    filters.userIds.length +
    filters.projectIds.length +
    filters.developerIds.length +
    filters.destinationIds.length +
    filters.statuses.length +
    filters.paymentMethods.length
  const averageTargetProgress = useMemo(
    () =>
      dashboard.targetProgress.length === 0
        ? 0
        : Math.round(dashboard.targetProgress.reduce((total, target) => total + target.activityProgress, 0) / dashboard.targetProgress.length),
    [dashboard.targetProgress],
  )
  const rangeOptions = useMemo<{ value: AnalyticsDateWindow; label: string }[]>(
    () => [
      { value: 'live', label: t('common.live') },
      { value: '30d', label: t('common.days30') },
      { value: '90d', label: t('common.days90') },
      { value: 'custom', label: t('analytics.custom') },
    ],
    [t],
  )

  useEffect(() => {
    let cancelled = false
    if (!supabase || !isSupabaseConfigured) return undefined

    async function loadRemoteAnalytics() {
      setAnalyticsLoading(true)
      try {
        const nextDashboard = await loadSupabaseAnalyticsDashboard(supabase!, filters)
        if (!cancelled) {
          setRpcDashboard(nextDashboard)
          setAnalyticsError(null)
        }
      } catch {
        if (!cancelled) {
          setRpcDashboard(null)
          setAnalyticsError(t('analytics.refreshError'))
        }
      } finally {
        if (!cancelled) setAnalyticsLoading(false)
      }
    }

    void loadRemoteAnalytics()
    return () => {
      cancelled = true
    }
  }, [filters, t])

  function updateAnalyticsRoute(nextFilters: LeadraAnalyticsFilters, options: { replace?: boolean; filtersOpen?: boolean } = {}) {
    setFilterState({ routeKey: routeStateKey, filters: nextFilters })
    onRouteChange(analyticsRouteForFilters(nextFilters, options.filtersOpen ?? filterOpen), { replace: options.replace })
  }

  function updateDateWindow(dateWindow: AnalyticsDateWindow) {
    updateAnalyticsRoute({ ...filters, dateWindow }, { replace: false })
  }

  function updateSingleFilter(key: keyof LeadraAnalyticsFilters, value: string) {
    if (key === 'statuses') {
      const statuses = unitStatusValues.includes(value as UnitStatus) ? [value as UnitStatus] : []
      updateAnalyticsRoute({ ...filters, statuses }, { replace: true })
      return
    }
    if (key === 'paymentMethods') {
      const paymentMethods = paymentMethodValues.includes(value as PaymentMethod) ? [value as PaymentMethod] : []
      updateAnalyticsRoute({ ...filters, paymentMethods }, { replace: true })
      return
    }
    if (key === 'dateWindow') {
      updateDateWindow((value || 'live') as AnalyticsDateWindow)
      return
    }
    if (key === 'startDate' || key === 'endDate') {
      updateAnalyticsRoute({ ...filters, [key]: value || undefined }, { replace: true })
      return
    }
    updateAnalyticsRoute({ ...filters, [key]: value ? [value] : [] }, { replace: true })
  }

  function exportCsv() {
    const csv = buildAnalyticsCsv(dashboard, filters)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `leadra-analytics-${filters.dateWindow}-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="page-stack analytics-page page-entrance">
      <div className="details-hero analytics-hero motion-stage motion-hero" style={motionStyle(0)}>
        <div className="analytics-hero-copy">
          <p className="eyebrow">{dashboard.scopeLabel}</p>
          <h2>{t('analytics.companyHeading')}</h2>
          <p>{t('analytics.subheading')}</p>
        </div>
        <div className="analytics-hero-side">
          <div className="analytics-range" aria-label={t('analytics.timeWindows')}>
            {rangeOptions.map((option) => (
              <button
                key={option.value}
                className={filters.dateWindow === option.value ? 'active' : ''}
                type="button"
                onClick={() => updateDateWindow(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="analytics-signal-card">
            <span>{t('analytics.pipelineSignal')}</span>
            <strong>{formatCount(locale, dashboard.overview.availableUnits)}/{formatCount(locale, dashboard.overview.totalActiveUnits)}</strong>
            <small>{t('analytics.availableUnitsActive')}</small>
          </div>
        </div>
      </div>

      <section className={`analytics-control-card motion-stage ${filterOpen ? 'is-open' : ''}`} style={motionStyle(1, 30)}>
        <div className="analytics-control-header">
          <div>
            <p className="eyebrow">{t('analytics.filters')}</p>
            <h2>{t('analytics.focusHeading')}</h2>
            <p>{activeFilterCount === 0 ? t('analytics.allActivity') : t('analytics.activeFilterCount', { count: activeFilterCount })}</p>
          </div>
          <div className="analytics-control-actions">
            {analyticsLoading && <span className="analytics-chip">{t('analytics.refreshing')}</span>}
            <button className="secondary-link" type="button" onClick={() => updateAnalyticsRoute(defaultAnalyticsFilters, { replace: true })}>{t('analytics.reset')}</button>
            <button className="ghost-button analytics-filter-toggle" type="button" aria-expanded={filterOpen} onClick={() => onRouteChange(analyticsRouteForFilters(filters, !filterOpen))}>
              <SlidersHorizontal size={17} /> {filterOpen ? t('analytics.closeFilters') : t('analytics.filters')}
              {activeFilterCount > 0 && <span>{activeFilterCount}</span>}
            </button>
            <button className="primary-button compact-action" type="button" onClick={exportCsv}>
              <Download size={17} /> {t('analytics.csv')}
            </button>
          </div>
        </div>
        {filters.dateWindow === 'custom' && (
          <div className="analytics-custom-range">
            <label>
              {t('analytics.start')}
              <input type="date" value={filters.startDate ?? ''} onChange={(event) => updateAnalyticsRoute({ ...filters, startDate: event.target.value || undefined }, { replace: true })} />
            </label>
            <label>
              {t('analytics.end')}
              <input type="date" value={filters.endDate ?? ''} onChange={(event) => updateAnalyticsRoute({ ...filters, endDate: event.target.value || undefined }, { replace: true })} />
            </label>
          </div>
        )}
        {analyticsError && <p className="form-error">{analyticsError}</p>}
        <AnalyticsFiltersPanel
          dashboard={dashboard}
          filters={filters}
          open={filterOpen}
          managerMode={user.role === 'manager'}
          onChange={updateSingleFilter}
        />
      </section>

      {analyticsLoading ? (
        <MetricSkeletonGrid count={6} />
      ) : (
        <section className="metric-grid analytics-metrics motion-stage" style={motionStyle(1, 40)}>
          <Metric label={t('analytics.activeUnits')} value={formatCount(locale, dashboard.overview.totalActiveUnits)} style={motionStyle(0, 140)} />
          <Metric label={t('analytics.soldValue')} value={formatCurrency(dashboard.overview.soldValue, locale)} style={motionStyle(1, 165)} />
          <Metric label={t('analytics.projectedCommission')} value={formatCurrency(dashboard.overview.projectedCommission, locale)} style={motionStyle(2, 190)} />
          <Metric label={t('analytics.pdfExports')} value={formatCount(locale, dashboard.overview.pdfExports)} style={motionStyle(3, 215)} />
          <Metric label={t('analytics.duplicateAttempts')} value={formatCount(locale, dashboard.overview.duplicateAttempts)} style={motionStyle(4, 240)} />
          <Metric label={t('analytics.staleUnits')} value={formatCount(locale, dashboard.overview.staleUnits)} style={motionStyle(5, 265)} />
        </section>
      )}

      <div className="page-grid">
        <section className="content-card motion-stage" style={motionStyle(2, 80)}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">{t('analytics.salesEyebrow')}</p>
              <h2>{t('analytics.salesHeading')}</h2>
            </div>
          </div>
          {topSales.length === 0 && <EmptyState title={t('analytics.noSalesTitle')} body={t('analytics.noSalesBody')} />}
          {topSales.length > 0 && <LeaderboardChart rows={topSales.map((row) => ({ label: row.userName, value: row.activityCount, suffix: t('analytics.eventsSuffix') }))} />}
          {topSales.map((row, index) => (
            <div className="analytics-row motion-stage" key={row.userId} style={motionStyle(index, 160)}>
              <div>
                <strong>{row.userName}</strong>
                <p>{t('analytics.rowSummary', { uploaded: formatCount(locale, row.unitsCreated), sold: formatCount(locale, row.unitsSold), events: formatCount(locale, row.activityCount) })}</p>
              </div>
              <div className="analytics-row-stat">
                <span>{formatCurrency(row.commissionContribution, locale)}</span>
                <small>{t('analytics.commission')}</small>
              </div>
            </div>
          ))}
        </section>

        <section className="content-card motion-stage" style={motionStyle(3, 110)}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">{t('analytics.workflowEyebrow')}</p>
              <h2>{t('analytics.workflowHeading')}</h2>
            </div>
          </div>
          <StatusDonutChart dashboard={dashboard} />
          {showAnalyticsDepth ? (
            <div className="status-stack">
              <MiniBar label={getStatusLabel(locale, 'available')} value={dashboard.overview.availableUnits} total={dashboard.overview.totalActiveUnits} />
              <MiniBar label={getStatusLabel(locale, 'hold')} value={dashboard.overview.holdUnits} total={dashboard.overview.totalActiveUnits} />
              <MiniBar label={getStatusLabel(locale, 'sold')} value={dashboard.overview.soldUnits} total={dashboard.overview.totalActiveUnits} />
              <MiniBar label={getStatusLabel(locale, 'archived')} value={dashboard.overview.archivedUnits} total={Math.max(1, dashboard.overview.totalActiveUnits + dashboard.overview.archivedUnits)} />
            </div>
          ) : (
            <AnalyticsSkeleton />
          )}
        </section>
      </div>

      {showAnalyticsDepth ? (
        <AnalyticsDeepSections
          dashboard={dashboard}
          averageTargetProgress={averageTargetProgress}
          latestTimeline={latestTimeline}
          locale={locale}
          t={t}
        />
      ) : (
        <section className="content-card motion-stage analytics-deferred-card" style={motionStyle(4, 140)}>
          <p className="eyebrow">{t('analytics.preparingCharts')}</p>
          <h2>{t('analytics.loadingDetailed')}</h2>
          <AnalyticsSkeleton />
        </section>
      )}
    </section>
  )
}

function AnalyticsSkeleton() {
  return (
    <div className="analytics-skeleton" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  )
}

function AnalyticsDeepSections({
  dashboard,
  averageTargetProgress,
  latestTimeline,
  locale,
  t,
}: {
  dashboard: AnalyticsDashboard
  averageTargetProgress: number
  latestTimeline: AnalyticsDashboard['activityTimeline']
  locale: LocaleCode
  t: ReturnType<typeof useLocale>['t']
}) {
  return (
    <>
      <section className="content-card motion-stage" style={motionStyle(4, 140)}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t('analytics.inventoryEyebrow')}</p>
            <h2>{t('analytics.inventoryHeading')}</h2>
          </div>
        </div>
        <div className="analytics-table">
          {dashboard.inventoryHealth.map((project, index) => (
            <div className="analytics-row project-health-row motion-stage" key={project.projectId} style={motionStyle(index, 210)}>
              <div>
                <strong dir="auto">{project.projectName}</strong>
                <p dir="auto">{project.developerName} / {project.destinationName}</p>
              </div>
              <span className="analytics-chip">{t('analytics.availableChip', { count: formatCount(locale, project.availableUnits) })}</span>
              <span className="analytics-chip warning">{t('analytics.holdChip', { ratio: formatCount(locale, project.holdRatio) })}</span>
              <span className="analytics-chip success">{t('analytics.mediaChip', { ratio: formatCount(locale, project.mediaCompleteness) })}</span>
              <span className="analytics-chip">{t('analytics.averagePriceChip', { value: formatCurrency(project.averagePrice, locale) })}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="page-grid">
        <section className="content-card motion-stage" style={motionStyle(5, 170)}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">{t('analytics.targetsEyebrow')}</p>
              <h2>{t('analytics.targetsHeading')}</h2>
            </div>
            <span className="analytics-chip success">{t('analytics.activityChip', { value: formatCount(locale, averageTargetProgress) })}</span>
          </div>
          {dashboard.targetProgress.map((target, index) => (
            <div className="target-card motion-stage" key={target.targetId} style={motionStyle(index, 230)}>
              <div className="target-card-header">
                <strong dir="auto">{target.label}</strong>
                <span>{formatCount(locale, target.activityProgress)}%</span>
              </div>
              <MiniBar label={t('analytics.unitsCreated')} value={target.unitsCreatedProgress} total={100} suffix="%" />
              <MiniBar label={t('analytics.activity')} value={target.activityProgress} total={100} suffix="%" />
              <MiniBar label={t('analytics.targetSoldValue')} value={target.soldValueProgress} total={100} suffix="%" />
            </div>
          ))}
        </section>

        <section className="content-card motion-stage" style={motionStyle(6, 200)}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">{t('analytics.timelineEyebrow')}</p>
              <h2>{t('analytics.timelineHeading')}</h2>
            </div>
          </div>
          <LineChart title={t('analytics.soldValueTrend')} points={dashboard.soldValueTrend} currency locale={locale} />
          <div className="timeline-chart" aria-label={t('analytics.timelineLabel')}>
            {latestTimeline.length === 0 && <EmptyState title={t('analytics.timelineEmptyTitle')} body={t('analytics.timelineEmptyBody')} />}
            {latestTimeline.slice(-30).map((point, index) => (
              <div className="timeline-bar motion-stage" key={point.date} style={motionStyle(index, 250)}>
                <span style={{ height: `${Math.max(18, point.activityCount * 20)}px` }} title={t('analytics.timelineTitle', { count: point.activityCount, date: point.date })} />
                <small>{formatShortDate(locale, point.date)}</small>
              </div>
            ))}
          </div>
          <BarChart title={t('analytics.pdfExportTrend')} points={dashboard.pdfExportTrend.slice(-30)} />
        </section>
      </div>
    </>
  )
}

function AnalyticsFiltersPanel({
  dashboard,
  filters,
  open,
  managerMode,
  onChange,
}: {
  dashboard: AnalyticsDashboard
  filters: LeadraAnalyticsFilters
  open: boolean
  managerMode: boolean
  onChange: (key: keyof LeadraAnalyticsFilters, value: string) => void
}) {
  const { locale, t } = useLocale()
  return (
    <div className={`analytics-filter-panel ${open ? 'open' : ''}`}>
      <SelectFilter label={t('profile.team')} value={filters.teamIds[0] ?? ''} disabled={managerMode} options={dashboard.filterOptions.teams} onChange={(value) => onChange('teamIds', value)} />
      <SelectFilter label={t('profile.name')} value={filters.userIds[0] ?? ''} options={dashboard.filterOptions.users} onChange={(value) => onChange('userIds', value)} />
      <SelectFilter label={t('analytics.project')} value={filters.projectIds[0] ?? ''} options={dashboard.filterOptions.projects} onChange={(value) => onChange('projectIds', value)} />
      <SelectFilter label={t('details.developer')} value={filters.developerIds[0] ?? ''} options={dashboard.filterOptions.developers} onChange={(value) => onChange('developerIds', value)} />
      <SelectFilter label={t('details.destination')} value={filters.destinationIds[0] ?? ''} options={dashboard.filterOptions.destinations} onChange={(value) => onChange('destinationIds', value)} />
      <SelectFilter
        label={t('details.status')}
        value={filters.statuses[0] ?? ''}
        options={[
          { id: 'available', label: getStatusLabel(locale, 'available') },
          { id: 'hold', label: getStatusLabel(locale, 'hold') },
          { id: 'sold_by_us', label: getStatusLabel(locale, 'sold_by_us') },
          { id: 'sold_by_others', label: getStatusLabel(locale, 'sold_by_others') },
        ]}
        onChange={(value) => onChange('statuses', value)}
      />
      <SelectFilter
        label={t('details.paymentMethod')}
        value={filters.paymentMethods[0] ?? ''}
        options={[
          { id: 'cash', label: t('payment.cash') },
          { id: 'installment', label: t('payment.installment') },
        ]}
        onChange={(value) => onChange('paymentMethods', value)}
      />
    </div>
  )
}

function SelectFilter({
  label,
  value,
  options,
  disabled = false,
  onChange,
}: {
  label: string
  value: string
  options: { id: string; label: string }[]
  disabled?: boolean
  onChange: (value: string) => void
}) {
  const { t } = useLocale()
  return (
    <ControlledSelectField
      className="analytics-filter-field"
      disabled={disabled}
      label={label}
      options={[{ value: '', label: t('common.all') }, ...options.map((option) => ({ value: option.id, label: option.label }))]}
      value={value}
      onValueChange={onChange}
    />
  )
}

function StatusDonutChart({ dashboard }: { dashboard: AnalyticsDashboard }) {
  const { t } = useLocale()
  const total = Math.max(1, dashboard.overview.availableUnits + dashboard.overview.holdUnits + dashboard.overview.soldUnits)
  const available = Math.round((dashboard.overview.availableUnits / total) * 100)
  const hold = Math.round((dashboard.overview.holdUnits / total) * 100)
  return (
    <div className="status-donut" style={{ '--available': `${available}%`, '--hold': `${hold}%` } as CSSProperties}>
      <div>
        <strong>{available}%</strong>
        <span>{t('analytics.availableMix')}</span>
      </div>
    </div>
  )
}

function LeaderboardChart({ rows }: { rows: { label: string; value: number; suffix?: string }[] }) {
  const { t } = useLocale()
  const max = Math.max(1, ...rows.map((row) => row.value))
  return (
    <div className="leaderboard-chart" aria-label={t('analytics.leaderboardChart')}>
      {rows.map((row) => (
        <div key={row.label}>
          <span>{row.label}</span>
          <div><i style={{ width: `${Math.max(4, (row.value / max) * 100)}%` }} /></div>
          <strong>{row.value}{row.suffix ?? ''}</strong>
        </div>
      ))}
    </div>
  )
}

function LineChart({ title, points, currency = false, locale }: { title: string; points: AnalyticsChartPoint[]; currency?: boolean; locale: LocaleCode }) {
  const safePoints = points.filter((point) => Number.isFinite(point.value))
  const max = Math.max(1, ...safePoints.map((point) => point.value))
  const width = 320
  const height = 128
  const coordinates = safePoints.map((point, index) => {
    const x = safePoints.length <= 1 ? width / 2 : (index / (safePoints.length - 1)) * width
    const y = height - (point.value / max) * (height - 18) - 8
    return { ...point, x, y }
  })
  const path = coordinates.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ')

  return (
    <div className="svg-chart-card">
      <div className="chart-title">
        <strong>{title}</strong>
        <span>{currency ? formatCurrency(max, locale) : max}</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        <path className="chart-grid" d={`M0 ${height - 8} H${width} M0 ${height / 2} H${width} M0 8 H${width}`} />
        {path && <path className="line-chart-area" d={`${path} L ${width} ${height - 8} L 0 ${height - 8} Z`} />}
        {path && <path className="line-chart-line" d={path} />}
        {coordinates.map((point) => (
          <circle key={point.date} cx={point.x} cy={point.y} r="3.5">
            <title>{point.label}: {currency ? formatCurrency(point.value, locale) : point.value}</title>
          </circle>
        ))}
      </svg>
    </div>
  )
}

function BarChart({ title, points }: { title: string; points: AnalyticsChartPoint[] }) {
  const { t } = useLocale()
  const max = Math.max(1, ...points.map((point) => point.value))
  return (
    <div className="bar-chart-card" aria-label={title}>
      <div className="chart-title">
        <strong>{title}</strong>
        <span>{t('analytics.maxLabel', { value: max })}</span>
      </div>
      <div className="bar-chart-grid">
        {points.map((point) => (
          <span key={point.date} style={{ height: `${Math.max(8, (point.value / max) * 92)}px` }}>
            <title>{point.label}: {point.value}</title>
          </span>
        ))}
      </div>
    </div>
  )
}

function ProfilePage({ user, onThemePreferenceChange }: { user: LeadraUser; onThemePreferenceChange: (theme: ThemePreference, options?: ThemePreferenceOptions) => void | Promise<void> }) {
  const { locale, t } = useLocale()
  return (
    <section className="page-stack page-entrance profile-page">
      <div className="profile-hero motion-stage motion-subtle" style={motionStyle(0)}>
        <div className="profile-avatar">{getUserInitials(user.fullName)}</div>
        <div>
          <p className="eyebrow">{t('profile.eyebrow')}</p>
          <h2>{user.fullName}</h2>
          <p>{user.jobTitle}</p>
        </div>
      </div>
      <InfoSection
        style={motionStyle(1, 80)}
        title={t('profile.accountDetails')}
        rows={[
          [t('profile.name'), user.fullName],
          [t('profile.email'), user.email],
          [t('profile.phone'), user.phoneNumber],
          [t('profile.role'), getRoleLabel(locale, user.role)],
          [t('profile.team'), user.teamId],
          [t('profile.branch'), user.branchId],
          [t('profile.status'), getAccountStatusLabel(locale, user.status)],
        ]}
      />
      <section className="content-card profile-language-card motion-stage" style={motionStyle(2, 120)}>
        <div className="profile-language-copy">
          <h2>{t('profile.languageSettings')}</h2>
          <p>{t('profile.languageHelp')}</p>
        </div>
        <LocaleSwitcher />
      </section>
      <section className="content-card profile-language-card motion-stage" style={motionStyle(3, 150)}>
        <div className="profile-language-copy">
          <h2>{t('profile.themeSettings')}</h2>
          <p>{t('profile.themeHelp')}</p>
        </div>
        <ThemeToggle onThemeChange={onThemePreferenceChange} />
      </section>
    </section>
  )
}

function LocaleSwitcher() {
  const { locale, setLocale, t } = useLocale()

  return (
    <div className="locale-switcher" role="group" aria-label={t('locale.switcherLabel')}>
      <button type="button" className={`locale-button ${locale === 'en' ? 'active' : ''}`} onClick={() => setLocale('en')}>
        {t('locale.english')}
      </button>
      <button type="button" className={`locale-button ${locale === 'ar' ? 'active' : ''}`} onClick={() => setLocale('ar')}>
        {t('locale.arabic')}
      </button>
    </div>
  )
}

function ThemeToggle({
  compact = false,
  onThemeChange,
}: {
  compact?: boolean
  onThemeChange?: (theme: ThemePreference, options?: ThemePreferenceOptions) => void | Promise<void>
}) {
  const { themePreference, setThemePreference } = useTheme()
  const { t } = useLocale()
  const nextThemePreference: ThemePreference = themePreference === 'dark' ? 'light' : 'dark'

  return (
    <button
      className={`theme-toggle ${compact ? 'compact' : ''}`}
      type="button"
      aria-label={themePreference === 'dark' ? t('theme.switchToLight') : t('theme.switchToDark')}
      aria-pressed={themePreference === 'dark'}
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        const transitionOptions: ThemePreferenceOptions = {
          origin: {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          },
        }
        if (onThemeChange) {
          void onThemeChange(nextThemePreference, transitionOptions)
        } else {
          setThemePreference(nextThemePreference, transitionOptions)
        }
      }}
    >
      <span className="theme-toggle-track" aria-hidden="true">
        <span className="theme-toggle-thumb">
          <span className={`theme-toggle-icon ${nextThemePreference === 'light' ? 'active' : ''}`}>
            <Sun size={14} />
          </span>
          <span className={`theme-toggle-icon ${nextThemePreference === 'dark' ? 'active' : ''}`}>
            <Moon size={14} />
          </span>
        </span>
      </span>
      <span className="theme-toggle-label">{themePreference === 'dark' ? t('theme.switchToLight') : t('theme.switchToDark')}</span>
    </button>
  )
}

function dashboardTitle(role: LeadraUser['role'], locale: LocaleCode) {
  if (role === 'sales') return translateForLocale(locale, 'dashboard.salesTitle')
  if (role === 'manager') return translateForLocale(locale, 'dashboard.managerTitle')
  return translateForLocale(locale, 'dashboard.adminTitle')
}

function dashboardDescription(role: LeadraUser['role'], locale: LocaleCode) {
  if (role === 'sales') return translateForLocale(locale, 'dashboard.salesDescription')
  if (role === 'manager') return translateForLocale(locale, 'dashboard.managerDescription')
  return translateForLocale(locale, 'dashboard.adminDescription')
}

function getViewTitle(view: View, user: LeadraUser, locale: LocaleCode): string {
  if (view === 'dashboard') return user.role === 'admin' ? translateForLocale(locale, 'viewTitle.adminCommand') : translateForLocale(locale, 'viewTitle.userCommand', { firstName: user.fullName.split(/\s+/)[0] })
  if (view === 'units' || view === 'details') return translateForLocale(locale, 'viewTitle.unitDesk')
  if (view === 'special') return translateForLocale(locale, 'viewTitle.special')
  if (view === 'create') return translateForLocale(locale, 'viewTitle.newResale')
  if (view === 'notifications') return translateForLocale(locale, 'viewTitle.alerts')
  if (view === 'profile') return translateForLocale(locale, 'viewTitle.profile')
  if (view === 'analytics') return translateForLocale(locale, 'viewTitle.analytics')
  if (view === 'palette') return 'Palette sample'
  return translateForLocale(locale, 'viewTitle.admin')
}

function canAccessAdmin(user: LeadraUser): boolean {
  return user.role === 'admin' || user.role === 'sub_admin'
}

function isViewAllowedForUser(view: View, user: LeadraUser): boolean {
  if (view === 'admin') return canAccessAdmin(user)
  if (view === 'analytics') return canAccessAnalytics(user)
  return true
}


function toLookupValue(row: Record<string, unknown>): LookupValue {
  return {
    id: String(row.id),
    kind: row.kind as LookupKind,
    label: String(row.label ?? ''),
    thumbnailPath: row.thumbnailPath === undefined ? (row.thumbnail_path as string | null | undefined) : (row.thumbnailPath as string | null | undefined),
    archived: Boolean(row.archived),
  }
}

function toBranchDirectoryItem(row: Record<string, unknown>): BranchDirectoryItem {
  return {
    id: String(row.id),
    name: String(row.name ?? row.id),
    archived: Boolean(row.archived),
  }
}


function translateForLocale(locale: LocaleCode, key: string, params?: MessageParams) {
  return translate(locale, key, params)
}
