import {
  ArrowRight,
  Archive,
  BarChart3,
  Bell,
  Building2,
  Eye,
  EyeOff,
  Check,
  ChevronDown,
  Download,
  FileText,
  Home,
  Image as ImageIcon,
  LogOut,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Share2,
  SlidersHorizontal,
  Trash2,
  Users,
} from 'lucide-react'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { memo, useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { BrowserRouter, Link, useLocation, useNavigate } from 'react-router-dom'
import { demoUsers, initialAppState, lookupValues } from './data/seed'
import { buildPerformanceWorkspace } from './data/performanceSeed'
import { buildAnalyticsCsv, buildAnalyticsDashboard, canAccessAnalytics, defaultAnalyticsFilters } from './lib/analytics'
import {
  canAddAdminManagerNote,
  canArchiveUnit,
  canEditAnyUnitDetails,
  canEditNonOwnerUnitDetails,
  canEditOwnerFields,
  canEditUnitCommission,
  canEditUnitPricing,
  canViewSalesSensitiveData,
  canViewOwnerData,
  getOwnerPhoneCountryMeta,
  getOwnerPhoneCountryOptions,
  filterUnitsForUser,
  formatCurrency,
  formatDeliveryExpectancy,
  buildInstallmentSchedule,
  getApplicableUnitAreaFields,
  isSoldStatus,
  getThumbnailMedia,
  PRD_UNIT_TYPES,
  PRD_FLOOR_OPTIONS,
  summarizeDestinations,
  summarizeProjects,
  validateOwnerPhoneForCountry,
  validateMediaUpload,
  searchUnits,
} from './lib/domain'
import {
  compareText,
  formatCount,
  formatDate,
  formatDateTime,
  formatShortDate,
  getAccountStatusLabel,
  getPaymentMethodLabel,
  getRoleLabel,
  getStatusLabel,
  getUserInitials,
  translate,
  useLocale,
  type LocaleCode,
} from './lib/i18n'
import {
  renderAuditAction,
  renderError,
  renderFlash,
  renderNotificationBody,
  renderNotificationTitle,
  type LocalizedFlashMessage,
} from './lib/messageRendering'
import { authPasswordCandidates, createManagedUserProfile, updateManagedUserPassword, updateManagedUserProfile } from './lib/adminAuth'
import { LeadraRepository } from './lib/repository'
import { canUseDemoMode, isPerformanceDemoMode, isProductionMissingSupabaseConfig, isSupabaseConfigured, supabase } from './lib/supabase'
import { loadSupabaseAnalyticsDashboard, loadSupabaseAppState, loadSupabaseProfile, markSupabaseLogin } from './lib/supabaseState'
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
  updateSettingsWorkflow,
  updateUnitStatusWorkflow,
  updateUnitWorkflow,
} from './lib/workflows'
import { createAuditMessage, createFlashForStatus, createFlashMessage, createNotificationMessage } from './lib/systemMessages'
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
  AppSettings,
  AuditLogItem,
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
  TeamDirectoryItem,
  InstallmentType,
  UnitEditInput,
  UnitFilters,
  UnitStatus,
} from './lib/types'

type UnitsBrowserStage = 'destinations' | 'projects' | 'units'

type TransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => {
    ready?: Promise<void>
    updateCallbackDone?: Promise<void>
    finished?: Promise<void>
  }
}

function runPageTransition(update: () => void) {
  const startViewTransition = (document as TransitionDocument).startViewTransition

  if (!startViewTransition) {
    update()
    return
  }

  try {
    const transition = startViewTransition.call(document, () => {
      flushSync(update)
    })
    void transition.ready?.catch(() => {
      // Rapid route changes can abort browser view transitions without affecting app state.
    })
    void transition.updateCallbackDone?.catch(() => {
      // Rapid route changes can abort browser view transitions without affecting app state.
    })
    void transition.finished?.catch(() => {
      // Rapid route changes can abort browser view transitions without affecting app state.
    })
  } catch {
    update()
  }
}
type UiMessage = { message: string; messageKey?: string | null; messageParams?: MessageParams | null }

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error && 'message' in error) return String(error.message)
  return 'Please try again.'
}

const createUnitSteps = ['Property', 'Specs', 'Payment', 'Owner', 'Review'] as const
const adminSections = ['Users', 'Master Data', 'Settings', 'Metrics', 'Audit'] as const
const lookupKindOptions: LookupKind[] = ['developer', 'destination', 'project', 'view', 'finish', 'unit_type']
type CreateUnitStep = (typeof createUnitSteps)[number]
type AdminSection = (typeof adminSections)[number]
type MasterDataDirectory = LookupKind | 'branches' | 'teams'

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
  'unit-types': 'unit_type',
  branches: 'branches',
  teams: 'teams',
}

const masterDataDirectoryToSlug: Record<MasterDataDirectory, MasterDataDirectorySlug> = {
  developer: 'developers',
  destination: 'destinations',
  project: 'projects',
  view: 'views',
  finish: 'finishes',
  unit_type: 'unit-types',
  branches: 'branches',
  teams: 'teams',
}

const unitStatusValues: UnitStatus[] = ['available', 'hold', 'sold', 'sold_by_us', 'sold_by_others']
const paymentMethodValues: PaymentMethod[] = ['cash', 'installment']

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
const unitListPageSize = 60
const notificationPageSize = 60
const userManagementPageSize = 48
const auditLogPageSize = 80
const roleOrder: Record<LeadraUser['role'], number> = {
  admin: 0,
  sub_admin: 1,
  manager: 2,
  sales: 3,
}

function motionStyle(index: number, delay = 0): CSSProperties {
  return {
    '--motion-index': index,
    '--motion-delay': `${delay}ms`,
  } as CSSProperties
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
  const location = useLocation()
  const routerNavigate = useNavigate()
  const route = parseAppRoute(location.pathname, location.search, location.hash)
  const [initialWorkspace] = useState(getInitialWorkspace)
  const initialWorkspaceRef = useRef(initialWorkspace)
  const [currentUser, setCurrentUser] = useState<LeadraUser | null>(null)
  const [, setView] = useState<View>(() => route.view)
  const [appState, setAppState] = useState(initialWorkspace.state)
  const [activeLookupValues, setActiveLookupValues] = useState<LookupValue[]>(initialWorkspace.lookupValues)
  const [unitFilters, setUnitFilters] = useState<UnitFilters>({ status: 'all' })
  const [remoteSearchUnits, setRemoteSearchUnits] = useState<LeadraUnit[] | null>(null)
  const [flash, setFlash] = useState<LocalizedFlashMessage | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured)
  const [loginError, setLoginError] = useState<UiMessage | null>(null)
  const [generatingPdfUnitId, setGeneratingPdfUnitId] = useState<number | null>(null)
  const [sharingPdfUnitId, setSharingPdfUnitId] = useState<number | null>(null)
  const [updatingStatusUnitId, setUpdatingStatusUnitId] = useState<number | null>(null)
  const [statusActionFeedback, setStatusActionFeedback] = useState<{
    unitId: number
    status: UnitStatus
    state: 'saving' | 'saved'
  } | null>(null)
  const [removingMediaId, setRemovingMediaId] = useState<string | null>(null)
  const [downloadingMediaId, setDownloadingMediaId] = useState<string | null>(null)
  const [generatedPdfs, setGeneratedPdfs] = useState<Record<number, { blob: Blob; fileName: string }>>({})
  const completingAuthUserRef = useRef<string | null>(null)

  const completeSupabaseLogin = useCallback(async (authUser: SupabaseUser) => {
    if (!supabase) return
    if (completingAuthUserRef.current === authUser.id) return
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

      await markSupabaseLogin(supabase)
      const remote = await loadSupabaseAppState(supabase)
      setAppState(remote.state)
      setActiveLookupValues(remote.lookupValues.length > 0 ? remote.lookupValues : lookupValues)
      setCurrentUser(profile)
      const requestedView = parseAppRoute(window.location.pathname, window.location.search, window.location.hash).view
      const nextView = isViewAllowedForUser(requestedView, profile) ? requestedView : 'dashboard'
      setView(nextView)
      if (nextView !== requestedView) routerNavigate(pathForView(nextView), { replace: true })
      setLoginError(null)
    } catch {
      setLoginError({
        message: 'Sign-in is temporarily unavailable. Contact your administrator.',
        messageKey: 'error.signInUnavailable',
        messageParams: null,
      })
    } finally {
      completingAuthUserRef.current = null
      setAuthLoading(false)
    }
  }, [routerNavigate])

  async function handleSupabasePasswordLogin(email: string, password: string) {
    if (!supabase) return
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
      runPageTransition(() => {
        setView(requestedRoute.view)
        setFlash(null)
      })
    }

    syncRouteFromLocation()
    window.addEventListener('hashchange', syncRouteFromLocation)
    return () => window.removeEventListener('hashchange', syncRouteFromLocation)
  }, [location.pathname, location.hash, routerNavigate])

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
        setAppState(initialWorkspaceRef.current.state)
        setActiveLookupValues(initialWorkspaceRef.current.lookupValues)
        setAuthLoading(false)
      }
      if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        void completeSupabaseLogin(session.user)
      }
    })

    void hydrateFromSession()

    return () => {
      cancelled = true
      listener.subscription.unsubscribe()
    }
  }, [completeSupabaseLogin])

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
  const activeView = isViewAllowedForUser(route.view, user) ? route.view : 'dashboard'
  const visibleUnits = filterUnitsForUser(user, appState.units)
  const destinationSummaries = summarizeDestinations(visibleUnits, locale)
  const routeDestinationId = route.view === 'units' ? route.destinationId : null
  const routeProjectId = route.view === 'units' ? route.projectId : null
  const routeUnitId = route.view === 'details' ? route.unitId : null
  const activeSelectedDestinationId = routeDestinationId || unitFilters.destinationId || null
  const projectSummaries = summarizeProjects(visibleUnits, locale, activeSelectedDestinationId)
  const activeSelectedProjectId = routeProjectId || unitFilters.projectId || null
  const unitsBrowserStage: UnitsBrowserStage = routeProjectId ? 'units' : routeDestinationId ? 'projects' : 'destinations'
  const activeCreateStep = createStepFromSlug[route.createStep]
  const activeAdminSection = adminSectionFromSlug[route.adminSection]
  const activeMasterDataDirectory = masterDataDirectoryFromSlug[route.masterDataDirectory]
  const selectedUnit = activeView === 'details'
    ? visibleUnits.find((unit) => unit.id === routeUnitId) ?? null
    : visibleUnits[0] ?? null
  const filteredUnits = searchUnits(user, appState.units, {
    ...unitFilters,
    destinationId: unitFilters.destinationId || activeSelectedDestinationId || undefined,
    projectId: activeSelectedProjectId ?? undefined,
  })
  const displayedUnits = remoteSearchUnits ?? filteredUnits
  const unreadCount = appState.notifications.filter(
    (notification) =>
      !notification.read &&
      (notification.userId === user.id || notification.audienceRole === user.role || (!notification.userId && !notification.audienceRole)),
  ).length

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
    })
  }

  function closeNavigation() {
    setFlash(null)
    setMobileMenuOpen(false)
  }

  async function handleCreateUnit(event: FormEvent<HTMLFormElement>, uploadedMedia: LeadraMediaFile[]) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const paymentMethod = String(formData.get('paymentMethod')) as PaymentMethod
    const projectId = String(formData.get('projectId'))
    const destinationId = String(formData.get('destinationId'))
    const developerId = String(formData.get('developerId'))
    const viewId = String(formData.get('viewId'))
    const staticViewOptions: Record<string, string> = {
      'view-sea': 'Sea',
      'view-lagoon': 'Lagoon',
      'view-pool': 'Pool',
      'view-landscape': 'Landscape',
      'view-street': 'Street',
    }
    const project = activeLookupValues.find((item) => item.id === projectId)
    const destination = activeLookupValues.find((item) => item.id === destinationId)
    const developer = activeLookupValues.find((item) => item.id === developerId)
    const viewLookup = activeLookupValues.find((item) => item.id === viewId)
    const rawOwnerPhone = String(formData.get('ownerPhone'))
    const selectedCountryCode = String(formData.get('countryCode') ?? '+20')
    const ownerPhoneValidation = validateOwnerPhoneForCountry(rawOwnerPhone, selectedCountryCode, locale)

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
      unitType: String(formData.get('unitType')),
      floor: String(formData.get('floor') ?? ''),
      bua: Number(formData.get('bua')),
      roofGardenArea: Number(formData.get('roofGardenArea')) || null,
      gardenArea: Number(formData.get('gardenArea')) || null,
      terraceArea: Number(formData.get('terraceArea')) || null,
      viewId,
      viewName: viewLookup?.label ?? staticViewOptions[viewId] ?? 'Landscape',
      bedrooms: Number(formData.get('bedrooms')),
      bathrooms: Number(formData.get('bathrooms')),
      elevator: formData.get('elevator') === 'on',
      landArea: Number(formData.get('landArea')) || null,
      furnished: String(formData.get('furnished')) === 'true',
      finish: String(formData.get('finish')),
      paymentMethod,
      totalAmount: Number(formData.get('totalAmount')),
      downPayment: paymentMethod === 'installment' ? Number(formData.get('downPayment')) : null,
      installmentType: paymentMethod === 'installment' ? String(formData.get('installmentType')) as InstallmentType : null,
      installmentYears: paymentMethod === 'installment' && String(formData.get('installmentType')) !== 'custom' ? Number(formData.get('installmentYears')) : null,
      deliveryExpectancy: {
        mode: 'year',
        year: Number(formData.get('deliveryYear')),
      },
      originalOwnerName: String(formData.get('ownerName')),
      countryCode: selectedCountryCode,
      originalOwnerPhone: ownerPhoneValidation.localPhone,
      salesNotes: String(formData.get('salesNotes')),
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
      setFlash({ text: `Unit could not be created: ${errorMessage(error)}`, messageKey: null, messageParams: null })
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
    const projectId = String(formData.get('projectId'))
    const destinationId = String(formData.get('destinationId'))
    const developerId = String(formData.get('developerId'))
    const viewId = String(formData.get('viewId'))
    const project = activeLookupValues.find((item) => item.id === projectId)
    const destination = activeLookupValues.find((item) => item.id === destinationId)
    const developer = activeLookupValues.find((item) => item.id === developerId)
    const viewLookup = activeLookupValues.find((item) => item.id === viewId)
    const input: UnitEditInput = {
      developerId,
      developerName: developer?.label ?? unit.developerName,
      projectId,
      projectName: project?.label ?? unit.projectName,
      destinationId,
      destinationName: destination?.label ?? unit.destinationName,
      unitType: String(formData.get('unitType')),
      floor: String(formData.get('floor') ?? ''),
      bua: Number(formData.get('bua')),
      roofGardenArea: Number(formData.get('roofGardenArea')) || null,
      gardenArea: Number(formData.get('gardenArea')) || null,
      terraceArea: Number(formData.get('terraceArea')) || null,
      viewId,
      viewName: viewLookup?.label ?? unit.viewName,
      bedrooms: Number(formData.get('bedrooms')),
      bathrooms: Number(formData.get('bathrooms')),
      elevator: formData.get('elevator') === 'on',
      landArea: Number(formData.get('landArea')) || null,
      furnished: String(formData.get('furnished')) === 'true',
      finish: String(formData.get('finish')),
      deliveryExpectancy: {
        mode: 'year',
        year: Number(formData.get('deliveryYear')),
      },
      originalOwnerName: String(formData.get('ownerName') ?? unit.originalOwnerName ?? ''),
      countryCode: String(formData.get('countryCode') ?? unit.countryCode ?? '+20'),
      originalOwnerPhone: String(formData.get('ownerPhone') ?? unit.originalOwnerPhone ?? ''),
      salesNotes: String(formData.get('salesNotes') ?? unit.salesNotes),
      totalAmount: Number(formData.get('totalAmount')),
      commissionPercentage: Number(formData.get('commissionPercentage')),
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

  function archiveUnit(unit: LeadraUnit) {
    const result = archiveUnitWorkflow(appState, user, unit.id)
    setAppState(result.state)
    if (!result.ok) {
      setFlash({ text: result.error, messageKey: result.errorKey ?? null, messageParams: result.errorParams ?? null })
      return
    }
    setFlash(createFlashMessage('flash.unitArchived', 'Unit archived. It remains stored for history, audit, and backups.'))
    runPageTransition(() => {
      setView('units')
      routerNavigate('/units')
    })
  }

  function saveSharedNote(unit: LeadraUnit, content: string) {
    const result = saveUnitAdminNoteWorkflow(appState, user, unit.id, content)
    setAppState(result.state)
    setFlash(
      result.ok
        ? createFlashMessage('flash.noteSaved', 'Shared unit note saved.')
        : { text: result.error, messageKey: result.errorKey ?? null, messageParams: result.errorParams ?? null },
    )
  }

  function deleteSharedNote(unit: LeadraUnit) {
    const result = deleteUnitAdminNoteWorkflow(appState, user, unit.id)
    setAppState(result.state)
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
    const generated = await generateUnitPdfFile(user, unit, appState.settings, locale)
    setGeneratedPdfs((items) => ({ ...items, [unit.id]: generated }))
    return generated
  }

  function setUnitMediaPdfVisibility(unitId: number, mediaId: string, includeInPdf: boolean) {
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
    setGeneratedPdfs((items) => {
      const remaining = { ...items }
      delete remaining[unitId]
      return remaining
    })
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

  async function generatePdf(unit: LeadraUnit) {
    if (generatingPdfUnitId) return
    setGeneratingPdfUnitId(unit.id)
    try {
      const { downloadGeneratedPdf } = await import('./lib/pdf')
      const generated = await generatePdfFile(unit)
      downloadGeneratedPdf(generated)
      const notificationMessage = createNotificationMessage('export_generated', { unitCode: unit.unitCode })
      const auditMessage = createAuditMessage('export_generated')
      setAppState((state) =>
        addAnalyticsEventWorkflow(
          {
            ...state,
            notifications: [
              {
                id: `notif-${Date.now()}`,
                title: notificationMessage.title.text,
                body: notificationMessage.body.text,
                messageKey: notificationMessage.body.messageKey ?? null,
                messageParams: notificationMessage.body.messageParams ?? null,
                audienceRole: user.role === 'sales' ? undefined : 'admin',
                userId: user.role === 'sales' ? user.id : undefined,
                createdAt: new Date().toISOString(),
                read: false,
              },
              ...state.notifications,
            ],
            auditLogs: [
              {
                id: `audit-${Date.now()}`,
                actorName: user.fullName,
                actorRole: user.role,
                actionType: auditMessage.text,
                messageKey: auditMessage.messageKey ?? null,
                messageParams: auditMessage.messageParams ?? null,
                relatedUnitCode: unit.unitCode,
                createdAt: new Date().toISOString(),
                ipAddress: null,
              },
              ...state.auditLogs,
            ],
          },
          user,
          'pdf_generated',
          unit,
        ),
      )
      setFlash({ text: 'PDF generated. You can now share or download it from the unit details actions.', messageKey: null, messageParams: null })
    } catch {
      setFlash({ text: 'PDF could not be generated. Please try again.', messageKey: null, messageParams: null })
    } finally {
      setGeneratingPdfUnitId(null)
    }
  }

  async function sharePdf(unit: LeadraUnit) {
    if (sharingPdfUnitId || generatingPdfUnitId) return
    setSharingPdfUnitId(unit.id)
    try {
      const generated = generatedPdfs[unit.id] ?? await generatePdfFile(unit)
      const { shareGeneratedPdf, downloadGeneratedPdf } = await import('./lib/pdf')
      const shared = await shareGeneratedPdf(generated)
      setAppState((state) => addAnalyticsEventWorkflow(state, user, 'pdf_shared_or_downloaded', unit))
      if (shared) {
        setFlash({ text: 'PDF share sheet opened.', messageKey: null, messageParams: null })
        return
      }
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

  function updateUnitFilter<K extends keyof UnitFilters>(key: K, value: UnitFilters[K]) {
    const nextFilters = { ...unitFilters, [key]: value }
    setUnitFilters(nextFilters)
    void loadRemoteUnitSearch(nextFilters)
  }

  function resetUnitFilters() {
    setUnitFilters({ status: 'all' })
    setRemoteSearchUnits(null)
  }

  async function loadRemoteUnitSearch(nextFilters: UnitFilters, destinationId = activeSelectedDestinationId, projectId = activeSelectedProjectId) {
    if (!supabase || !isSupabaseConfigured) {
      setRemoteSearchUnits(null)
      return
    }
    try {
      const repository = new LeadraRepository(supabase)
      const units = await repository.searchUnits({
        ...nextFilters,
        destinationId: nextFilters.destinationId || destinationId || undefined,
        projectId: nextFilters.projectId || projectId || undefined,
      })
      setRemoteSearchUnits(units)
    } catch {
      setRemoteSearchUnits(null)
    }
  }

  return (
    <div className="app-shell">
      <aside className="side-rail" aria-label={t('nav.desktop')}>
        <div className="brand-mark">L</div>
        <NavButton active={activeView === 'dashboard'} label={t('nav.dashboard')} to={pathForView('dashboard')} onClick={closeNavigation} icon={<Home />} className="motion-stage" style={motionStyle(0)} />
        <NavButton active={activeView === 'units'} label={t('nav.units')} to={pathForView('units')} onClick={closeNavigation} icon={<Building2 />} className="motion-stage" style={motionStyle(1)} />
        <NavButton active={activeView === 'create'} label={t('nav.create')} to={pathForView('create')} onClick={closeNavigation} icon={<Plus />} className="motion-stage" style={motionStyle(2)} />
        <NavButton active={activeView === 'notifications'} label={t('nav.alerts', { count: unreadCount })} to={pathForView('notifications')} onClick={closeNavigation} icon={<Bell />} className="motion-stage" style={motionStyle(3)} />
        {canUseAnalytics && (
          <NavButton active={activeView === 'analytics'} label={t('nav.analytics')} to={pathForView('analytics')} onClick={closeNavigation} icon={<BarChart3 />} className="motion-stage" style={motionStyle(4)} />
        )}
        {canUseAdmin && (
          <NavButton active={activeView === 'admin'} label={t('nav.admin')} to={pathForView('admin')} onClick={closeNavigation} icon={<Settings />} className="motion-stage" style={motionStyle(5)} />
        )}
        <NavButton active={activeView === 'palette'} label="Palette" to={pathForView('palette')} onClick={closeNavigation} icon={<Share2 />} className="motion-stage" style={motionStyle(6)} />
      </aside>

      <main className="main-panel">
        <header className={`topbar ${activeView === 'dashboard' ? 'dashboard-topbar' : 'compact-topbar'}`}>
          <div>
            <p className="eyebrow">{t('topbar.eyebrow')}</p>
            <h1>{getViewTitle(activeView, user, locale)}</h1>
          </div>
          <div className="topbar-actions">
            <Link className="user-chip" to={pathForView('profile')} onClick={closeNavigation}>
              <span>{getUserInitials(user.fullName)}</span>
              <strong>{getRoleLabel(locale, user.role)}</strong>
            </Link>
            <button
              className="ghost-button"
              type="button"
              aria-label={t('topbar.signOut')}
              onClick={() => {
                if (supabase) void supabase.auth.signOut()
                setCurrentUser(null)
                setView('dashboard')
                routerNavigate('/dashboard', { replace: true })
                setFlash(null)
              }}
            >
              <LogOut size={17} /> <span className="signout-label">{t('topbar.signOut')}</span>
            </button>
          </div>
        </header>

        {activeView === 'dashboard' && (
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
        {activeView === 'palette' && (
          <div className="page-transition-frame" key={activeView}>
            <PaletteSamplePage />
          </div>
        )}
        {activeView === 'units' && (
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
              onDestinationSelect={(id) => {
                const nextFilters = { ...unitFilters, destinationId: undefined, projectId: undefined }
                setUnitFilters(nextFilters)
                setRemoteSearchUnits(null)
                navigateToPath(destinationPath(id))
              }}
              onProjectSelect={(id) => {
                const nextFilters = { ...unitFilters, projectId: undefined }
                setUnitFilters(nextFilters)
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
                if (destinationId) navigateToPath(destinationPath(destinationId))
              }}
              onFilterChange={updateUnitFilter}
              onResetFilters={resetUnitFilters}
              onOpenUnit={(id) => {
                runPageTransition(() => {
                  setView('details')
                  routerNavigate(unitDetailsPath(id))
                })
              }}
            />
          </div>
        )}
        {activeView === 'create' && (
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
        {activeView === 'details' && selectedUnit && (
          <div className="page-transition-frame" key={activeView}>
            <UnitDetailsPage
              key={selectedUnit.id}
              user={user}
              unit={selectedUnit}
              lookupValues={activeLookupValues}
              onArchive={() => archiveUnit(selectedUnit)}
              onUpdateUnit={(event) => handleUpdateUnit(selectedUnit, event)}
              onStatusChange={(status) => updateUnitStatus(selectedUnit, status)}
              onGeneratePdf={() => generatePdf(selectedUnit)}
              onSharePdf={() => sharePdf(selectedUnit)}
              onCopyShareLink={() => copyUnitShareLink(selectedUnit)}
              pdfGenerating={generatingPdfUnitId === selectedUnit.id}
              pdfSharing={sharingPdfUnitId === selectedUnit.id}
              pdfReady={Boolean(generatedPdfs[selectedUnit.id])}
              statusUpdating={updatingStatusUnitId === selectedUnit.id}
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
        {activeView === 'details' && !selectedUnit && (
          <div className="page-transition-frame" key="details-denied">
            <section className="content-card page-entrance">
              <EmptyState title="Unit unavailable" body="This internal link only works for logged-in users with permission to view the unit." />
            </section>
          </div>
        )}
        {activeView === 'notifications' && (
          <div className="page-transition-frame" key={activeView}>
            <NotificationsPage notifications={appState.notifications} user={user} />
          </div>
        )}
        {activeView === 'profile' && (
          <div className="page-transition-frame" key={activeView}>
            <ProfilePage user={user} />
          </div>
        )}
        {activeView === 'analytics' && canUseAnalytics && (
          <div className="page-transition-frame" key={activeView}>
            <AnalyticsPage
              appState={appState}
              user={user}
              route={route}
              onRouteChange={(path, options) => navigateToPath(path, options)}
            />
          </div>
        )}
        {activeView === 'admin' && canUseAdmin && (
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
              onCreateLookupValue={async (kind, label) => {
                const cleanLabel = label.trim()
                if (!cleanLabel) throw new Error('Label is required.')

                if (supabase && isSupabaseConfigured) {
                  const { data, error } = await supabase
                    .from('lookup_values')
                    .insert({ kind, label: cleanLabel })
                    .select('id, kind, label, archived')
                    .single()
                  if (error) throw new Error(error.message)
                  const value = toLookupValue(data)
                  setActiveLookupValues((values) => [...values, value].sort((first, second) => compareText(locale, first.label, second.label)))
                  setFlash({ text: 'Master data value created.', messageKey: null, messageParams: null })
                  return
                }

                const value = { id: `lookup-${kind}-${Date.now()}`, kind, label: cleanLabel } satisfies LookupValue
                setActiveLookupValues((values) => [...values, value].sort((first, second) => compareText(locale, first.label, second.label)))
                setFlash({ text: 'Master data value created.', messageKey: null, messageParams: null })
              }}
              onUpdateLookupValue={async (lookupId, label) => {
                const cleanLabel = label.trim()
                if (!cleanLabel) throw new Error('Label is required.')

                if (supabase && isSupabaseConfigured) {
                  const { data, error } = await supabase
                    .from('lookup_values')
                    .update({ label: cleanLabel })
                    .eq('id', lookupId)
                    .select('id, kind, label, archived')
                    .single()
                  if (error) throw new Error(error.message)
                  const value = toLookupValue(data)
                  setActiveLookupValues((values) => values.map((item) => (item.id === lookupId ? value : item)).sort((first, second) => compareText(locale, first.label, second.label)))
                  setFlash({ text: 'Master data value updated.', messageKey: null, messageParams: null })
                  return
                }

                setActiveLookupValues((values) => values.map((item) => (item.id === lookupId ? { ...item, label: cleanLabel } : item)).sort((first, second) => compareText(locale, first.label, second.label)))
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
                    if (!replacement) throw new Error('Replacement sales representative was not found.')
                    await new LeadraRepository(supabase).deleteSalesRepresentativeAfterReassignment(salesUserId, replacement, user)
                  }
                  setFlash(createFlashMessage('flash.salesRepDeactivated', 'Sales representative deactivated after reassignment.'))
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
                    await new LeadraRepository(supabase).deleteManagedUser(managedUserId)
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
          <NavButton active={activeView === 'profile'} label={t('nav.profile')} to={pathForView('profile')} onClick={closeNavigation} icon={<SlidersHorizontal />} className="motion-stage" style={motionStyle(2)} />
          {canUseAdmin && (
            <NavButton active={activeView === 'admin'} label={t('nav.admin')} to={pathForView('admin')} onClick={closeNavigation} icon={<Settings />} className="motion-stage" style={motionStyle(3)} />
          )}
          <NavButton active={activeView === 'palette'} label="Palette" to={pathForView('palette')} onClick={closeNavigation} icon={<Share2 />} className="motion-stage" style={motionStyle(4)} />
        </div>
      )}

      <nav className="bottom-nav" aria-label={t('nav.mobile')}>
        <NavButton active={activeView === 'dashboard'} label={t('nav.home')} to={pathForView('dashboard')} onClick={closeNavigation} icon={<Home />} className="motion-stage" style={motionStyle(0)} />
        <NavButton active={activeView === 'units'} label={t('nav.units')} to={pathForView('units')} onClick={closeNavigation} icon={<Building2 />} className="motion-stage" style={motionStyle(1)} />
        <NavButton active={activeView === 'create'} label={t('nav.add')} to={pathForView('create')} onClick={closeNavigation} icon={<Plus />} className="motion-stage" style={motionStyle(2)} />
        <NavButton
          active={mobileMenuOpen || activeView === 'notifications' || activeView === 'analytics' || activeView === 'profile' || activeView === 'admin'}
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
  const [step, setStep] = useState<'intro' | 'login'>('intro')
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

  return (
    <main className="login-screen motion-login">
      {activeStep === 'intro' ? (
        <section className="login-card login-card-intro">
          <div className="login-brand-panel motion-stage motion-hero" style={motionStyle(0)}>
            <div className="login-brand-top">
              <div className="login-mark">L</div>
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
            {canUseDemoMode && (
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
  const sampleStats = [
    ['Active listings', '248', 'Champagne metrics on Onyx'],
    ['Qualified buyers', '1,420', 'Ivory text on Graphite'],
    ['Booked tours', '36', 'Gold accent states'],
  ]
  const sampleUnits = [
    ['Seaview Villa', 'Charcoal card / Ivory copy', 'Gold Accent'],
    ['Ras El Hekma Chalet', 'Graphite section / Champagne border', 'Onyx CTA'],
    ['North Coast Residence', 'Onyx surface / Champagne status', 'Deep Navy'],
  ]

  return (
    <section className="palette-sample page-entrance">
      <div className="palette-sample-hero motion-stage" style={motionStyle(0)}>
        <div>
          <p className="eyebrow">Leadra color sample</p>
          <h2>Dark luxury workspace</h2>
          <p>Sample page only. This version uses the primary dark identity from the reference: Onyx, Graphite, Charcoal, and Champagne Gold.</p>
        </div>
        <div className="palette-sample-logo" aria-hidden="true">L</div>
      </div>

      <div className="palette-swatch-grid motion-stage" style={motionStyle(1, 40)}>
        {[
          ['Onyx', '#0D0D0F'],
          ['Champagne Gold', '#D4AF37'],
          ['Graphite', '#1A1A1D'],
          ['Charcoal', '#2A2A2E'],
          ['Royal Ivory', '#F7F3E9'],
          ['Deep Navy', '#0F1B2D'],
          ['Soft Grey', '#E6E8EC'],
          ['Light Grey', '#F1F3F6'],
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

type DashboardRollup = {
  id: string
  label: string
  totalUnits: number
  availableUnits: number
  holdUnits: number
  soldUnits: number
  meta?: string
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

function buildTeamDashboardRollups(units: LeadraUnit[], appState: AppDataState, locale: LocaleCode): DashboardRollup[] {
  return appState.teams
    .map((team) => {
      const teamUnits = units.filter((unit) => unit.teamId === team.id)
      const activeMembers = appState.users.filter((member) => member.teamId === team.id && member.status === 'active').length
      return summarizeDashboardRollup(team.id, team.name, teamUnits, locale === 'ar' ? `${activeMembers} أعضاء نشطون` : `${activeMembers} active members`)
    })
    .filter((item) => item.totalUnits > 0 || item.meta)
    .sort((a, b) => sortDashboardRollups(a, b, locale))
}

function buildUnitDashboardRollups(
  units: LeadraUnit[],
  idKey: 'developerId' | 'destinationId' | 'projectId',
  labelKey: 'developerName' | 'destinationName' | 'projectName',
  locale: LocaleCode,
): DashboardRollup[] {
  const grouped = new Map<string, LeadraUnit[]>()
  for (const unit of units) {
    const current = grouped.get(unit[idKey])
    if (current) current.push(unit)
    else grouped.set(unit[idKey], [unit])
  }

  return Array.from(grouped.entries())
    .map(([id, groupedUnits]) => summarizeDashboardRollup(id, groupedUnits[0][labelKey], groupedUnits))
    .sort((a, b) => sortDashboardRollups(a, b, locale))
}

function summarizeDashboardRollup(id: string, label: string, units: LeadraUnit[], meta?: string): DashboardRollup {
  return {
    id,
    label,
    totalUnits: units.length,
    availableUnits: units.filter((unit) => unit.status === 'available').length,
    holdUnits: units.filter((unit) => unit.status === 'hold').length,
    soldUnits: units.filter((unit) => isSoldStatus(unit.status)).length,
    meta,
  }
}

function sortDashboardRollups(a: DashboardRollup, b: DashboardRollup, locale: LocaleCode) {
  return b.totalUnits - a.totalUnits || compareText(locale, a.label, b.label)
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
  const teamUnits = units.filter((unit) => unit.teamId === user.teamId)
  const latestTeamUnits = [...teamUnits].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 4)
  const teamEvents = appState.analyticsEvents.filter((event) => event.teamId === user.teamId)
  const recentStatusEvents = teamEvents.filter((event) => event.eventType === 'status_changed').slice(0, 4)
  const installmentUpdates = teamUnits
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
        <Metric label={t('dashboard.visibleUnits')} value={formatCount(locale, teamUnits.length)} style={motionStyle(0, 120)} />
        <Metric label={t('dashboard.teamActivity')} value={formatCount(locale, teamEvents.length)} style={motionStyle(1, 150)} />
        <Metric label={t('dashboard.installmentUpdates')} value={formatCount(locale, installmentUpdates.length)} style={motionStyle(2, 180)} />
        <Metric label={t('dashboard.inactivityAlerts')} value={formatCount(locale, inactiveUsers.length)} style={motionStyle(3, 210)} />
      </div>
      <ManagerPanel title={t('dashboard.latestTeamUploads')}>
        {latestTeamUnits.map((unit, index) => <UnitListRow key={unit.id} user={user} unit={unit} index={index} onOpen={() => onOpenUnit(unit.id)} />)}
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

function UnitsPage({
  user,
  lookupValues,
  destinations,
  projects,
  selectedDestinationId,
  selectedProjectId,
  stage,
  currentDestination,
  currentProject,
  units,
  filters,
  onDestinationSelect,
  onProjectSelect,
  onBackToDestinations,
  onBackToProjects,
  onFilterChange,
  onResetFilters,
  onOpenUnit,
}: {
  user: LeadraUser
  lookupValues: LookupValue[]
  destinations: ReturnType<typeof summarizeDestinations>
  projects: ReturnType<typeof summarizeProjects>
  selectedDestinationId: string | null
  selectedProjectId: string | null
  stage: UnitsBrowserStage
  currentDestination: ReturnType<typeof summarizeDestinations>[number] | null
  currentProject: ReturnType<typeof summarizeProjects>[number] | null
  units: LeadraUnit[]
  filters: UnitFilters
  onDestinationSelect: (id: string) => void
  onProjectSelect: (id: string) => void
  onBackToDestinations: () => void
  onBackToProjects: () => void
  onFilterChange: <K extends keyof UnitFilters>(key: K, value: UnitFilters[K]) => void
  onResetFilters: () => void
  onOpenUnit: (id: number) => void
}) {
  const { locale, t } = useLocale()
  const visibleScopeKey = JSON.stringify([selectedDestinationId, selectedProjectId, filters])
  const [visibleState, setVisibleState] = useState({ scopeKey: visibleScopeKey, count: unitListPageSize })
  const visibleCount = visibleState.scopeKey === visibleScopeKey ? visibleState.count : unitListPageSize
  const [filtersOpen, setFiltersOpen] = useState(false)
  const visibleUnits = units.slice(0, visibleCount)
  const developerOptions = lookupValues.filter((item) => item.kind === 'developer')
  const destinationOptions = lookupValues.filter((item) => item.kind === 'destination')
  const projectOptions = lookupValues.filter((item) => item.kind === 'project')
  const unitTypeOptions = Array.from(new Set(units.map((unit) => unit.unitType))).sort((a, b) => compareText(locale, a, b))
  const canUseOwnerPhoneSearch = user.role === 'admin' || user.role === 'sub_admin'
  const activeFilterCount = countActiveUnitFilters(filters)
  const invalidDestination = stage !== 'destinations' && !currentDestination
  const invalidProject = stage === 'units' && (!currentDestination || !currentProject)

  return (
    <section className="page-stack page-entrance units-page">
      <div className="section-heading motion-stage" style={motionStyle(0)}>
        <div>
          <p className="eyebrow">{t('units.eyebrow')}</p>
          <h2>{t('units.heading')}</h2>
        </div>
        <Search size={22} />
      </div>

      {stage === 'destinations' && (
        <div className="project-grid motion-stage" style={motionStyle(1, 30)}>
          {destinations.map((destination, index) => (
            <button
              key={destination.destinationId}
              className="project-card motion-stage"
              type="button"
              style={motionStyle(index, 110)}
              onClick={() => onDestinationSelect(destination.destinationId)}
            >
              <strong dir="auto">{destination.destinationName}</strong>
              <span>{t('units.totalUnits', { count: formatCount(locale, destination.totalUnits) })}</span>
              <small>{t('units.summary', { available: formatCount(locale, destination.availableUnits), hold: formatCount(locale, destination.holdUnits), sold: formatCount(locale, destination.soldUnits) })}</small>
            </button>
          ))}
          {destinations.length === 0 && <EmptyState title={t('units.noMatchesTitle')} body={t('units.noMatchesBody')} />}
        </div>
      )}

      {invalidDestination && (
        <section className="content-card motion-stage" style={motionStyle(1, 30)}>
          <EmptyState title="Destination unavailable" body="This destination does not have visible units or no longer exists." />
          <button className="secondary-button" type="button" onClick={onBackToDestinations}>Back to destinations</button>
        </section>
      )}

      {stage === 'projects' && currentDestination && (
        <>
          <div className="action-row motion-stage" style={motionStyle(1, 30)}>
            <button className="secondary-button" type="button" onClick={onBackToDestinations}>Back to destinations</button>
            <span className="integration-badge" dir="auto">{currentDestination.destinationName}</span>
          </div>
          <div className="project-grid compact motion-stage" style={motionStyle(2, 45)}>
            {projects.map((project, index) => (
              <button
                key={project.projectId}
                className={`project-card motion-stage ${selectedProjectId === project.projectId ? 'active' : ''}`}
                type="button"
                style={motionStyle(index, 130)}
                onClick={() => onProjectSelect(project.projectId)}
              >
                <strong dir="auto">{project.projectName}</strong>
                <span>{t('units.totalUnits', { count: formatCount(locale, project.totalUnits) })}</span>
                <small>{t('units.summary', { available: formatCount(locale, project.availableUnits), hold: formatCount(locale, project.holdUnits), sold: formatCount(locale, project.soldUnits) })}</small>
              </button>
            ))}
            {projects.length === 0 && <EmptyState title={t('units.noMatchesTitle')} body={t('units.noMatchesBody')} />}
          </div>
        </>
      )}

      {invalidProject && (
        <section className="content-card motion-stage" style={motionStyle(1, 30)}>
          <EmptyState title="Project unavailable" body="This project does not belong to the selected destination or no longer has visible units." />
          <button className="secondary-button" type="button" onClick={currentDestination ? onBackToProjects : onBackToDestinations}>Back to projects</button>
        </section>
      )}

      {stage === 'units' && currentDestination && currentProject && (
        <>
          <div className="action-row motion-stage" style={motionStyle(1, 30)}>
            <button className="secondary-button" type="button" onClick={onBackToProjects}>Back to projects</button>
            <span className="integration-badge" dir="auto">{currentDestination.destinationName} / {currentProject.projectName}</span>
          </div>

      <section className={`units-filter-shell motion-stage ${filtersOpen ? 'is-open' : ''}`} style={motionStyle(3, 60)}>
        <div className="units-filter-summary">
          <div>
            <p className="eyebrow">{t('units.advancedSearch')}</p>
            <h3>{filtersOpen ? t('units.hideFilters') : t('units.showFilters')}</h3>
            <small>
              {activeFilterCount === 0
                ? t('units.filtersHidden')
                : t('units.activeFilters', { count: activeFilterCount })}
            </small>
          </div>
          <div className="units-filter-actions">
            {activeFilterCount > 0 && (
              <button className="ghost-button compact-action" type="button" onClick={onResetFilters}>
                {t('analytics.reset')}
              </button>
            )}
            <button
              className="secondary-button compact-action"
              type="button"
              aria-expanded={filtersOpen}
              aria-controls="units-advanced-filters"
              onClick={() => setFiltersOpen((open) => !open)}
            >
              <SlidersHorizontal size={17} /> {filtersOpen ? t('units.hideFilters') : t('units.showFilters')}
            </button>
          </div>
        </div>
      </section>

      {filtersOpen && (
      <div id="units-advanced-filters" className="filter-bar advanced-filter-bar motion-stage" style={motionStyle(4, 60)}>
        <label>
          {t('units.unitCode')}
          <input value={filters.unitCode ?? ''} onChange={(event) => onFilterChange('unitCode', event.target.value)} placeholder="NC3BR" dir="auto" />
        </label>
        <ControlledSelectField
          label={t('units.status')}
          options={[
            { value: 'all', label: t('common.all') },
            { value: 'available', label: getStatusLabel(locale, 'available') },
            { value: 'hold', label: getStatusLabel(locale, 'hold') },
            { value: 'sold_by_us', label: getStatusLabel(locale, 'sold_by_us') },
            { value: 'sold_by_others', label: getStatusLabel(locale, 'sold_by_others') },
          ]}
          value={filters.status ?? 'all'}
          onValueChange={(value) => onFilterChange('status', value as UnitStatus | 'all')}
        />
        <ControlledSelectField
          label={t('details.developer')}
          options={[{ value: '', label: t('common.all') }, ...developerOptions.map((item) => ({ value: item.id, label: item.label }))]}
          value={filters.developerId ?? ''}
          onValueChange={(value) => onFilterChange('developerId', value || undefined)}
        />
        <ControlledSelectField
          label={t('details.destination')}
          options={[{ value: '', label: t('common.all') }, ...destinationOptions.map((item) => ({ value: item.id, label: item.label }))]}
          value={filters.destinationId ?? ''}
          onValueChange={(value) => onFilterChange('destinationId', value || undefined)}
        />
        <ControlledSelectField
          label={t('details.project')}
          options={[{ value: '', label: t('common.all') }, ...projectOptions.map((item) => ({ value: item.id, label: item.label }))]}
          value={filters.projectId ?? ''}
          onValueChange={(value) => onFilterChange('projectId', value || undefined)}
        />
        <ControlledSelectField
          label={t('details.unitType')}
          options={[{ value: '', label: t('common.all') }, ...unitTypeOptions.map((item) => ({ value: item, label: item }))]}
          value={filters.unitType ?? ''}
          onValueChange={(value) => onFilterChange('unitType', value || undefined)}
        />
        <NumberFilter label={t('details.bedrooms')} value={filters.bedrooms === 'all' ? undefined : filters.bedrooms} onChange={(value) => onFilterChange('bedrooms', value ?? 'all')} />
        <NumberFilter label={t('details.bathrooms')} value={filters.bathrooms === 'all' ? undefined : filters.bathrooms} onChange={(value) => onFilterChange('bathrooms', value ?? 'all')} />
        <RangeFilter label="BUA" from={filters.buaFrom} to={filters.buaTo} onFrom={(value) => onFilterChange('buaFrom', value)} onTo={(value) => onFilterChange('buaTo', value)} />
        <RangeFilter label={t('details.totalAmount')} from={filters.priceFrom} to={filters.priceTo} onFrom={(value) => onFilterChange('priceFrom', value)} onTo={(value) => onFilterChange('priceTo', value)} />
        <ControlledSelectField
          label={t('details.paymentMethod')}
          options={[
            { value: 'all', label: t('common.all') },
            { value: 'cash', label: t('create.cash') },
            { value: 'installment', label: t('create.installment') },
          ]}
          value={filters.paymentMethod ?? 'all'}
          onValueChange={(value) => onFilterChange('paymentMethod', value as PaymentMethod | 'all')}
        />
        <RangeFilter label="Cash price" from={filters.cashPriceFrom} to={filters.cashPriceTo} onFrom={(value) => onFilterChange('cashPriceFrom', value)} onTo={(value) => onFilterChange('cashPriceTo', value)} />
        <RangeFilter label={t('create.downPayment')} from={filters.downPaymentFrom} to={filters.downPaymentTo} onFrom={(value) => onFilterChange('downPaymentFrom', value)} onTo={(value) => onFilterChange('downPaymentTo', value)} />
        <RangeFilter label={t('details.remainingPayment')} from={filters.remainingPaymentFrom} to={filters.remainingPaymentTo} onFrom={(value) => onFilterChange('remainingPaymentFrom', value)} onTo={(value) => onFilterChange('remainingPaymentTo', value)} />
        <ControlledSelectField
          label={t('details.installmentType')}
          options={[
            { value: 'all', label: t('common.all') },
            { value: 'quarterly', label: t('create.quarterly') },
            { value: 'semi_annual', label: t('create.semiAnnual') },
            { value: 'annual', label: t('create.annual') },
            { value: 'custom', label: t('create.customInstallments') },
          ]}
          value={filters.installmentType ?? 'all'}
          onValueChange={(value) => onFilterChange('installmentType', value as InstallmentType | 'all')}
        />
        <RangeFilter label={t('details.installmentAmount')} from={filters.installmentAmountFrom} to={filters.installmentAmountTo} onFrom={(value) => onFilterChange('installmentAmountFrom', value)} onTo={(value) => onFilterChange('installmentAmountTo', value)} />
        <NumberFilter label={t('details.expectedDelivery')} value={filters.deliveryYear === 'all' ? undefined : filters.deliveryYear} onChange={(value) => onFilterChange('deliveryYear', value ?? 'all')} />
        {canUseOwnerPhoneSearch && (
          <label>
            {t('units.ownerPhone')}
            <input
              value={filters.ownerPhone ?? ''}
              onChange={(event) => onFilterChange('ownerPhone', event.target.value)}
              placeholder={t('units.ownerPhonePlaceholder')}
              dir="auto"
            />
          </label>
        )}
        <button className="secondary-button" type="button" onClick={onResetFilters}>{t('analytics.reset')}</button>
      </div>
      )}

      <section className="unit-list motion-list" key={`${selectedDestinationId ?? 'all'}-${selectedProjectId ?? 'all'}-${JSON.stringify(filters)}`}>
        {units.length === 0 && <EmptyState title={t('units.noMatchesTitle')} body={t('units.noMatchesBody')} />}
        {visibleUnits.map((unit, index) => (
          <UnitListRow key={unit.id} user={user} unit={unit} index={index} onOpen={() => onOpenUnit(unit.id)} />
        ))}
        {visibleUnits.length < units.length && (
          <button
            className="secondary-button list-load-more"
            type="button"
            onClick={() =>
              setVisibleState((current) => ({
                scopeKey: visibleScopeKey,
                count: Math.min((current.scopeKey === visibleScopeKey ? current.count : unitListPageSize) + unitListPageSize, units.length),
              }))
            }
          >
            Show {formatCount(locale, Math.min(unitListPageSize, units.length - visibleUnits.length))} more of {formatCount(locale, units.length)}
          </button>
        )}
      </section>
        </>
      )}
    </section>
  )
}

function parseOptionalNumber(value: string): number | undefined {
  if (value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function countActiveUnitFilters(filters: UnitFilters): number {
  return Object.values(filters).filter((value) => value !== undefined && value !== '' && value !== 'all').length
}

function NumberFilter({ label, value, onChange }: { label: string; value?: number; onChange: (value: number | undefined) => void }) {
  return (
    <label>
      {label}
      <input type="number" value={value ?? ''} onChange={(event) => onChange(parseOptionalNumber(event.target.value))} />
    </label>
  )
}

function RangeFilter({
  label,
  from,
  to,
  onFrom,
  onTo,
}: {
  label: string
  from?: number
  to?: number
  onFrom: (value: number | undefined) => void
  onTo: (value: number | undefined) => void
}) {
  return (
    <div className="range-filter">
      <span>{label}</span>
      <input aria-label={`${label} from`} type="number" value={from ?? ''} placeholder="From" onChange={(event) => onFrom(parseOptionalNumber(event.target.value))} />
      <input aria-label={`${label} to`} type="number" value={to ?? ''} placeholder="To" onChange={(event) => onTo(parseOptionalNumber(event.target.value))} />
    </div>
  )
}

function PasswordField({
  label,
  name,
  autoComplete,
  placeholder,
  required = false,
  minLength,
}: {
  label: string
  name: string
  autoComplete: string
  placeholder?: string
  required?: boolean
  minLength?: number
}) {
  const { t } = useLocale()
  const [visible, setVisible] = useState(false)

  return (
    <label>
      <RequiredLabel label={label} required={required} />
      <div className="password-input-wrap">
        <input
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required={required}
          minLength={minLength}
          dir="auto"
        />
        <button
          className="password-toggle"
          type="button"
          aria-label={visible ? t('login.hidePassword') : t('login.showPassword')}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </label>
  )
}

const UnitListRow = memo(function UnitListRow({ user, unit, onOpen, index = 0 }: { user: LeadraUser; unit: LeadraUnit; onOpen: () => void; index?: number }) {
  const { locale, t } = useLocale()
  const thumbnail = getThumbnailMedia(unit.media)

  return (
    <button className="unit-row motion-stage" type="button" aria-label={t('units.openUnit', { unitCode: unit.unitCode })} style={motionStyle(index)} onClick={onOpen}>
      <div className="thumb">{thumbnail ? <img src={thumbnail.url} alt="" loading="lazy" decoding="async" /> : <ImageIcon />}</div>
      <div>
        <strong>{unit.unitCode}</strong>
        <p dir="auto">{unit.projectName} / {unit.unitType} / {t('units.areaBua', { bua: formatCount(locale, unit.bua) })}</p>
        {canViewOwnerData(user, unit) && <small dir="auto">{unit.originalOwnerPhone}</small>}
      </div>
      <span className={`status-pill motion-status-pill ${unit.status}`}>{getStatusLabel(locale, unit.status)}</span>
    </button>
  )
})

function CreateUnitPage({
  lookupValues,
  activeStep,
  onStepChange,
  onSubmit,
  settings,
}: {
  lookupValues: LookupValue[]
  activeStep: CreateUnitStep
  onStepChange: (step: CreateUnitStep) => void
  onSubmit: (event: FormEvent<HTMLFormElement>, uploadedMedia: LeadraMediaFile[]) => void
  settings: AppSettings
}) {
  const { locale, t } = useLocale()
  const [selectedMedia, setSelectedMedia] = useState<LeadraMediaFile[]>([])
  const [mediaError, setMediaError] = useState<UiMessage | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('installment')
  const [totalAmount, setTotalAmount] = useState(4_500_000)
  const [downPayment, setDownPayment] = useState(900_000)
  const [installmentType, setInstallmentType] = useState<InstallmentType>('quarterly')
  const [installmentYears, setInstallmentYears] = useState(5)
  const [ownerCountryCode, setOwnerCountryCode] = useState('+20')
  const [ownerPhone, setOwnerPhone] = useState('01012345678')
  const [selectedUnitType, setSelectedUnitType] = useState('Apartment')
  const [selectedFloor, setSelectedFloor] = useState('2nd')
  const activeStepIndex = createUnitSteps.indexOf(activeStep)
  const mediaValidation = validateMediaUpload(selectedMedia)
  const totalMediaMb = selectedMedia.reduce((total, file) => total + file.sizeBytes, 0) / (1024 * 1024)
  const remainingPayment = Math.max(0, totalAmount - downPayment)
  const paymentsPerYear = installmentType === 'quarterly' ? 4 : installmentType === 'semi_annual' ? 2 : installmentType === 'annual' ? 1 : null
  const calculatedInstallment =
    paymentMethod === 'installment' && paymentsPerYear && installmentYears > 0
      ? remainingPayment / (installmentYears * paymentsPerYear)
      : null

  const unitTypeOptions = PRD_UNIT_TYPES.map((unitType) => ({ value: unitType, label: unitType }))
  const viewOptions = [
    { value: 'view-sea', label: t('create.viewSea') },
    { value: 'view-lagoon', label: t('create.viewLagoon') },
    { value: 'view-pool', label: t('create.viewPool') },
    { value: 'view-landscape', label: t('create.viewLandscape') },
    { value: 'view-street', label: t('create.viewStreet') },
  ]
  const floorOptions = PRD_FLOOR_OPTIONS.map((floor) => ({ value: floor, label: floor === 'Ground' ? t('create.ground') : floor }))
  const areaFields = getApplicableUnitAreaFields(selectedUnitType, selectedFloor)
  const deliveryYearOptions = Array.from({ length: 10 }, (_, index) => {
    const year = String(2026 + index)
    return { value: year, label: year }
  })
  const ownerPhoneCountryOptions = getOwnerPhoneCountryOptions(locale)
  const selectedOwnerPhoneCountry = getOwnerPhoneCountryMeta(ownerCountryCode, locale)

  function goToRelativeStep(offset: number) {
    const nextIndex = Math.min(createUnitSteps.length - 1, Math.max(0, activeStepIndex + offset))
    onStepChange(createUnitSteps[nextIndex])
  }

  return (
    <section className="content-card create-card page-entrance create-page motion-stage motion-hero" style={motionStyle(0)}>
      <div className="section-heading motion-stage" style={motionStyle(0, 60)}>
        <div>
          <p className="eyebrow">{t('create.eyebrow')}</p>
          <h2>{t('create.heading')}</h2>
        </div>
      </div>
      <form
        className="wizard-shell"
        onSubmit={(event) => {
          const validation = validateMediaUpload(selectedMedia)
          if (!validation.ok) {
            event.preventDefault()
            setMediaError({
              message: validation.message ?? t('error.invalidMediaUpload'),
              messageKey: validation.messageKey ?? 'error.invalidMediaUpload',
              messageParams: validation.messageParams ?? null,
            })
            return
          }

          setMediaError(null)
          onSubmit(event, selectedMedia)
        }}
      >
        <div className="wizard-steps motion-stage" aria-label={t('create.steps')} style={motionStyle(1, 90)}>
          {createUnitSteps.map((step, index) => (
            <button
              key={step}
              className={`wizard-step ${step === activeStep ? 'active' : ''}`}
              type="button"
              aria-current={step === activeStep ? 'step' : undefined}
              onClick={() => onStepChange(step)}
            >
              <span>{formatCount(locale, index + 1)}</span>
              {translateCreateStep(step, locale)}
            </button>
          ))}
        </div>

        <fieldset className="unit-form wizard-panel" data-active={activeStep === 'Property'} aria-hidden={activeStep !== 'Property'}>
          <legend>{t('create.legend.property')}</legend>
          <SelectField name="destinationId" label={t('create.destination')} values={lookupValues.filter((item) => item.kind === 'destination')} required />
          <SelectField name="developerId" label={t('create.developer')} values={lookupValues.filter((item) => item.kind === 'developer')} required />
          <SelectField name="projectId" label={t('create.project')} values={lookupValues.filter((item) => item.kind === 'project')} required />
          <NamedSelectField
            defaultValue="Apartment"
            label={t('create.unitType')}
            name="unitType"
            options={unitTypeOptions}
            required
            value={selectedUnitType}
            onValueChange={(value) => {
              setSelectedUnitType(value)
              if (!getApplicableUnitAreaFields(value, selectedFloor).showFloor) setSelectedFloor('Ground')
            }}
          />
          <NumberField name="bua" label={t('create.bua')} defaultValue={145} min={1} required />
          {areaFields.showLandArea && <NumberField name="landArea" label={t('create.landArea')} defaultValue={0} min={0} required />}
          {areaFields.showFloor && (
            <NamedSelectField
              label={t('create.floor')}
              name="floor"
              options={floorOptions}
              required
              value={selectedFloor}
              onValueChange={setSelectedFloor}
            />
          )}
          {areaFields.showGardenArea && <NumberField name="gardenArea" label={t('create.gardenArea')} defaultValue={0} min={0} />}
          {areaFields.showTerraceArea && <NumberField name="terraceArea" label={t('create.terraceArea')} defaultValue={0} min={0} required />}
        </fieldset>

        <fieldset className="unit-form wizard-panel" data-active={activeStep === 'Specs'} aria-hidden={activeStep !== 'Specs'}>
          <legend>{t('create.legend.specs')}</legend>
          <NamedSelectField
            defaultValue="view-landscape"
            label={t('create.view')}
            name="viewId"
            options={viewOptions}
          />
          <NumberField name="bedrooms" label={t('create.bedrooms')} defaultValue={3} min={1} max={10} required />
          <NumberField name="bathrooms" label={t('create.bathrooms')} defaultValue={2} min={1} max={10} required />
          <label className="toggle-line"><input name="elevator" type="checkbox" defaultChecked /> {t('create.elevator')}</label>
          <NamedSelectField
            defaultValue="false"
            label={t('create.furnished')}
            name="furnished"
            options={[
              { value: 'true', label: t('create.furnishedOption') },
              { value: 'false', label: t('create.unfurnishedOption') },
            ]}
          />
          <NamedSelectField
            defaultValue="Fully Finished"
            label={t('create.finish')}
            name="finish"
            required
            options={[
              { value: 'Fully Finished', label: t('create.fullyFinished') },
              { value: 'Semi Finished', label: t('create.semiFinished') },
              { value: 'Core & Shell', label: t('create.coreAndShell') },
            ]}
          />
        </fieldset>

        <fieldset className="unit-form wizard-panel" data-active={activeStep === 'Payment'} aria-hidden={activeStep !== 'Payment'}>
          <legend>{t('create.legend.payment')}</legend>
          <input name="paymentMethod" type="hidden" value={paymentMethod} />
          <ControlledSelectField
            label={t('create.paymentMethod')}
            options={[
              { value: 'cash', label: t('create.cash') },
              { value: 'installment', label: t('create.installment') },
            ]}
            value={paymentMethod}
            required
            onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
          />
          <label>
            <RequiredLabel label={t('create.totalAmount')} required />
            <input name="totalAmount" type="number" min={0} required value={totalAmount} onChange={(event) => setTotalAmount(Number(event.target.value))} />
          </label>
          {paymentMethod === 'installment' && (
            <>
              <label>
                <RequiredLabel label={t('create.downPayment')} required />
                <input name="downPayment" type="number" min={0} max={totalAmount} required value={downPayment} onChange={(event) => setDownPayment(Number(event.target.value))} />
              </label>
              <label>
                {t('details.remainingPayment')}
                <input readOnly value={formatCurrency(remainingPayment, locale)} />
              </label>
              <input name="installmentType" type="hidden" value={installmentType} />
              <ControlledSelectField
                label={t('details.installmentType')}
                options={[
                  { value: 'quarterly', label: t('create.quarterly') },
                  { value: 'semi_annual', label: t('create.semiAnnual') },
                  { value: 'annual', label: t('create.annual') },
                  { value: 'custom', label: t('create.customInstallments') },
                ]}
                value={installmentType}
                required
                onValueChange={(value) => setInstallmentType(value as InstallmentType)}
              />
              {installmentType !== 'custom' ? (
                <>
                  <label>
                    <RequiredLabel label={t('create.installmentYears')} required />
                    <input name="installmentYears" type="number" min={1} required value={installmentYears} onChange={(event) => setInstallmentYears(Number(event.target.value))} />
                  </label>
                  <label>
                    {t('details.installmentAmount')}
                    <input readOnly value={formatCurrency(calculatedInstallment, locale)} />
                  </label>
                </>
              ) : (
                <p className="media-empty-note wide-field">{t('details.customInstallmentMessage')}</p>
              )}
            </>
          )}
        </fieldset>

        <fieldset className="unit-form wizard-panel" data-active={activeStep === 'Owner'} aria-hidden={activeStep !== 'Owner'}>
          <legend>{t('create.legend.owner')}</legend>
          <label>
            <RequiredLabel label={t('create.ownerName')} required />
            <input name="ownerName" defaultValue="New Owner" required dir="auto" />
          </label>
          <OwnerPhoneField
            countryCode={ownerCountryCode}
            countryOptions={ownerPhoneCountryOptions}
            hint={t('create.ownerPhoneHint', { country: selectedOwnerPhoneCountry.label, example: selectedOwnerPhoneCountry.placeholder })}
            ownerPhone={ownerPhone}
            placeholder={selectedOwnerPhoneCountry.placeholder}
            onCountryCodeChange={setOwnerCountryCode}
            onOwnerPhoneChange={setOwnerPhone}
          />
          <NamedSelectField defaultValue="2028" label={t('create.deliveryDate')} name="deliveryYear" options={deliveryYearOptions} required />
          <label className="wide-field">
            {t('create.salesNotes')}
            <textarea name="salesNotes" defaultValue="Owner is responsive on WhatsApp." dir="auto" />
          </label>
        </fieldset>

        <section className="wizard-panel review-panel" data-active={activeStep === 'Review'} aria-hidden={activeStep !== 'Review'}>
          <p className="eyebrow">{t('create.reviewEyebrow')}</p>
          <h3>{t('create.reviewHeading')}</h3>
          <p>{t('create.reviewBody')}</p>
          <div className="media-upload-panel">
            <label>
              {t('create.unitImages')}
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={async (event) => {
                  const files = Array.from(event.currentTarget.files ?? [])
                  const media = await Promise.all(files.map(fileToMedia))
                  const validation = validateMediaUpload(media)
                  setSelectedMedia(media)
                  setMediaError(
                    validation.ok
                      ? null
                      : {
                          message: validation.message ?? t('error.invalidMediaUpload'),
                          messageKey: validation.messageKey ?? 'error.invalidMediaUpload',
                          messageParams: validation.messageParams ?? null,
                        },
                  )
                }}
              />
            </label>
            <div className="media-upload-summary motion-stage" style={motionStyle(0, 120)}>
              <strong>{t('create.imagesSelected', { count: formatCount(locale, selectedMedia.length) })}</strong>
              <span>{t('create.mediaUsage', { current: totalMediaMb.toFixed(2), limit: String(settings.mediaLimitMb) })}</span>
            </div>
            {mediaError && <p className="form-error motion-feedback">{renderError(locale, { message: mediaError.message, messageKey: mediaError.messageKey, messageParams: mediaError.messageParams })}</p>}
            {!mediaValidation.ok && !mediaError && <p className="form-error motion-feedback">{renderError(locale, { message: mediaValidation.message ?? t('error.invalidMediaUpload'), messageKey: mediaValidation.messageKey ?? 'error.invalidMediaUpload', messageParams: mediaValidation.messageParams ?? null })}</p>}
            {selectedMedia.length === 0 && <p className="media-empty-note motion-stage" style={motionStyle(1, 150)}>{t('create.noImages')}</p>}
            <div className="upload-preview-grid">
              {selectedMedia.map((file, index) => (
                <div className="upload-preview-card motion-stage" key={file.id} style={motionStyle(index, 170)}>
                  <img src={file.url} alt={file.name} loading="lazy" decoding="async" />
                  <div>
                    <strong dir="auto">{file.name}</strong>
                    <small>{(file.sizeBytes / (1024 * 1024)).toFixed(2)} MB</small>
                  </div>
                  <label className="pdf-visibility-toggle">
                    <input
                      type="checkbox"
                      checked={file.includeInPdf !== false}
                      onChange={(event) => {
                        const includeInPdf = event.target.checked
                        setSelectedMedia((items) =>
                          items.map((item) => item.id === file.id ? { ...item, includeInPdf } : item),
                        )
                      }}
                    />
                    <span>{file.includeInPdf !== false ? t('media.includeInPdf') : t('media.excludeFromPdf')}</span>
                  </label>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => {
                      const nextMedia = selectedMedia.filter((item) => item.id !== file.id)
                      const validation = validateMediaUpload(nextMedia)
                      setSelectedMedia(nextMedia)
                      setMediaError(
                        validation.ok
                          ? null
                          : {
                              message: validation.message ?? t('error.invalidMediaUpload'),
                              messageKey: validation.messageKey ?? 'error.invalidMediaUpload',
                              messageParams: validation.messageParams ?? null,
                            },
                      )
                    }}
                  >
                    {t('common.remove')}
                  </button>
                </div>
              ))}
            </div>
          </div>
          <button className="primary-button" type="submit">
            {t('create.createAndNotify')}
          </button>
        </section>

        <div className="wizard-actions motion-stage" style={motionStyle(3, 140)}>
          <button className="secondary-button" type="button" disabled={activeStepIndex === 0} onClick={() => goToRelativeStep(-1)}>
            {t('common.back')}
          </button>
          {activeStep !== 'Review' && (
            <button className="primary-button" type="button" onClick={() => goToRelativeStep(1)}>
              {t('common.next')}
            </button>
          )}
        </div>
      </form>
    </section>
  )
}

function UnitDetailsPage({
  user,
  unit,
  lookupValues,
  onArchive,
  onUpdateUnit,
  onStatusChange,
  onGeneratePdf,
  onSharePdf,
  onCopyShareLink,
  pdfGenerating,
  pdfSharing,
  pdfReady,
  statusUpdating,
  statusActionFeedback,
  onSaveNote,
  onDeleteNote,
  onRemoveMedia,
  onMediaPdfVisibilityChange,
  onMediaDownload,
  removingMediaId,
  downloadingMediaId,
}: {
  user: LeadraUser
  unit: LeadraUnit
  lookupValues: LookupValue[]
  onArchive: () => void
  onUpdateUnit: (event: FormEvent<HTMLFormElement>) => Promise<boolean>
  onStatusChange: (status: UnitStatus) => void
  onGeneratePdf: () => void
  onSharePdf: () => void
  onCopyShareLink: () => void
  pdfGenerating: boolean
  pdfSharing: boolean
  pdfReady: boolean
  statusUpdating: boolean
  statusActionFeedback: { status: UnitStatus; state: 'saving' | 'saved' } | null
  onSaveNote: (content: string) => void
  onDeleteNote: () => void
  onRemoveMedia: (mediaId: string) => void
  onMediaPdfVisibilityChange: (mediaId: string, includeInPdf: boolean) => void
  onMediaDownload: (file: LeadraMediaFile) => void
  removingMediaId: string | null
  downloadingMediaId: string | null
}) {
  const { locale, t } = useLocale()
  const ownerAllowed = canViewOwnerData(user, unit)
  const canEditUnit = canEditAnyUnitDetails(user, unit)
  const [sharedNoteState, setSharedNoteState] = useState({ unitId: unit.id, value: unit.adminManagerNotes[0]?.content ?? '' })
  const sharedNote = sharedNoteState.unitId === unit.id ? sharedNoteState.value : unit.adminManagerNotes[0]?.content ?? ''
  const setSharedNote = (value: string) => setSharedNoteState({ unitId: unit.id, value })
  const [editMode, setEditMode] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [showDetailDepth, setShowDetailDepth] = useState(false)
  const thumbnail = getThumbnailMedia(unit.media)
  const statusFeedbackText = statusActionFeedback
    ? t(statusActionFeedback.state === 'saving' ? 'details.statusSaving' : 'details.statusSaved', {
        status: getStatusLabel(locale, statusActionFeedback.status),
      })
    : null
  const heroFacts: [string, string][] = [
    [t('create.bua'), `${formatCount(locale, unit.bua)} m²`],
    [t('details.totalAmount'), formatCurrency(unit.totalAmount, locale)],
    [t('details.expectedDelivery'), formatDeliveryExpectancy(unit, locale)],
  ]

  useEffect(() => {
    const timeout = window.setTimeout(() => setShowDetailDepth(true), 1800)
    return () => window.clearTimeout(timeout)
  }, [unit.id])

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    setEditSaving(true)
    const saved = await onUpdateUnit(event)
    setEditSaving(false)
    if (saved) setEditMode(false)
  }

  return (
    <section className="page-stack page-entrance details-page">
      <div className="details-hero motion-stage motion-hero" style={motionStyle(0)}>
        <div>
          <p className="eyebrow">{t('details.eyebrow')}</p>
          <h2>{unit.unitCode}</h2>
          <p dir="auto">{unit.projectName} / {unit.destinationName} / {unit.unitType}</p>
        </div>
        <div className="details-hero-summary">
          <span className={`status-pill motion-status-pill ${unit.status} ${statusActionFeedback ? 'status-pill-live' : ''}`}>
            {getStatusLabel(locale, unit.status)}
          </span>
          <dl className="details-hero-facts">
            {heroFacts.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <div className="details-actions motion-stage" style={motionStyle(1, 40)}>
        <div className="details-action-group">
          <span>{t('details.status')}</span>
          <div className="action-row wrap">
          <button className={`secondary-button status-action-button hold ${statusActionFeedback?.status === 'hold' ? 'is-active' : ''}`} type="button" disabled={statusUpdating || unit.status === 'hold'} onClick={() => onStatusChange('hold')}>{statusActionFeedback?.status === 'hold' && statusActionFeedback.state === 'saving' ? t('details.statusMarking', { status: getStatusLabel(locale, 'hold') }) : t('details.markHold')}</button>
          <button className={`secondary-button status-action-button sold ${statusActionFeedback?.status === 'sold_by_us' ? 'is-active' : ''}`} type="button" disabled={statusUpdating || unit.status === 'sold_by_us'} onClick={() => onStatusChange('sold_by_us')}>{statusActionFeedback?.status === 'sold_by_us' && statusActionFeedback.state === 'saving' ? t('details.statusMarking', { status: getStatusLabel(locale, 'sold_by_us') }) : t('details.markSoldByUs')}</button>
          <button className={`secondary-button status-action-button sold ${statusActionFeedback?.status === 'sold_by_others' ? 'is-active' : ''}`} type="button" disabled={statusUpdating || unit.status === 'sold_by_others'} onClick={() => onStatusChange('sold_by_others')}>{statusActionFeedback?.status === 'sold_by_others' && statusActionFeedback.state === 'saving' ? t('details.statusMarking', { status: getStatusLabel(locale, 'sold_by_others') }) : t('details.markSoldByOthers')}</button>
          {unit.status !== 'available' && <button className={`secondary-button status-action-button available ${statusActionFeedback?.status === 'available' ? 'is-active' : ''}`} type="button" disabled={statusUpdating} onClick={() => onStatusChange('available')}>{statusActionFeedback?.status === 'available' && statusActionFeedback.state === 'saving' ? t('details.statusMarking', { status: getStatusLabel(locale, 'available') }) : t('details.clearStatus')}</button>}
          </div>
          {statusFeedbackText && <p className={`status-action-feedback ${statusActionFeedback?.state === 'saving' ? 'is-saving' : 'is-saved'}`} role="status" aria-live="polite">{statusFeedbackText}</p>}
        </div>
        <div className="details-action-group">
          <span>{t('details.generateBrief')}</span>
          <div className="action-row wrap">
          <button className="primary-button" type="button" onClick={onGeneratePdf} disabled={pdfGenerating || pdfSharing}>
            <FileText size={18} /> {pdfGenerating ? 'Preparing PDF...' : t('details.generateBrief')}
          </button>
          <button className="secondary-button" type="button" onClick={onSharePdf} disabled={pdfGenerating || pdfSharing}>
            <Share2 size={18} /> {pdfSharing ? 'Preparing share...' : pdfReady ? t('details.sharePdf') : 'Generate & share PDF'}
          </button>
          <button className="secondary-button" type="button" onClick={onCopyShareLink}>
            <Share2 size={18} /> {t('details.shareLink')}
          </button>
          {canEditUnit && (
            <button className="secondary-button" type="button" onClick={() => setEditMode((value) => !value)}>
              {editMode ? t('details.cancelEdit') : t('details.editUnit')}
            </button>
          )}
          {canArchiveUnit(user, unit) && <button className="danger-button" type="button" onClick={onArchive}><Archive size={18} /> {t('details.archive')}</button>}
          </div>
        </div>
      </div>
      {editMode && (
        <UnitDetailsEditForm
          lookupValues={lookupValues}
          saving={editSaving}
          unit={unit}
          user={user}
          onCancel={() => setEditMode(false)}
          onSubmit={submitEdit}
        />
      )}
      {showDetailDepth ? (
        <UnitDetailsDeepSections
          locale={locale}
          t={t}
          user={user}
          unit={unit}
          ownerAllowed={ownerAllowed}
          sharedNote={sharedNote}
          setSharedNote={setSharedNote}
          thumbnail={thumbnail}
          onSaveNote={onSaveNote}
          onDeleteNote={onDeleteNote}
          onRemoveMedia={onRemoveMedia}
          onMediaPdfVisibilityChange={onMediaPdfVisibilityChange}
          onMediaDownload={onMediaDownload}
          removingMediaId={removingMediaId}
          downloadingMediaId={downloadingMediaId}
        />
      ) : (
        <section className="content-card motion-stage details-deferred-card" style={motionStyle(2, 70)}>
          <p className="eyebrow">Preparing details</p>
          <h2>{t('details.mainInfo')}</h2>
          <AnalyticsSkeleton />
        </section>
      )}
    </section>
  )
}

function UnitDetailsEditForm({
  lookupValues,
  saving,
  unit,
  user,
  onCancel,
  onSubmit,
}: {
  lookupValues: LookupValue[]
  saving: boolean
  unit: LeadraUnit
  user: LeadraUser
  onCancel: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const { locale, t } = useLocale()
  const canEditNonOwner = canEditNonOwnerUnitDetails(user, unit)
  const canEditOwner = canEditOwnerFields(user, unit)
  const canEditPricing = canEditUnitPricing(user, unit)
  const canEditCommission = canEditUnitCommission(user, unit)
  const [unitType, setUnitType] = useState(unit.unitType)
  const [floor, setFloor] = useState(unit.floor || 'Ground')
  const [ownerCountryCode, setOwnerCountryCode] = useState(unit.countryCode ?? '+20')
  const [ownerPhone, setOwnerPhone] = useState(unit.originalOwnerPhone ?? '')
  const areaFields = getApplicableUnitAreaFields(unitType, floor)
  const ownerPhoneCountryOptions = getOwnerPhoneCountryOptions(locale)
  const selectedOwnerPhoneCountry = getOwnerPhoneCountryMeta(ownerCountryCode, locale)
  const deliveryYearOptions = Array.from({ length: 10 }, (_, index) => String(2026 + index))

  return (
    <section className="content-card motion-stage details-edit-card" style={motionStyle(2, 70)} aria-labelledby="unit-edit-heading">
      <div className="section-heading details-compact-heading">
        <div>
          <p className="eyebrow">{t('details.editMode')}</p>
          <h2 id="unit-edit-heading">{t('details.editUnit')}</h2>
        </div>
      </div>
      <form className="unit-form details-edit-form" onSubmit={onSubmit}>
        <fieldset disabled={!canEditNonOwner || saving}>
          <legend>{t('create.legend.property')}</legend>
          <NativeLookupSelect name="destinationId" label={t('create.destination')} values={lookupValues.filter((item) => item.kind === 'destination')} defaultValue={unit.destinationId} required />
          <NativeLookupSelect name="developerId" label={t('create.developer')} values={lookupValues.filter((item) => item.kind === 'developer')} defaultValue={unit.developerId} required />
          <NativeLookupSelect name="projectId" label={t('create.project')} values={lookupValues.filter((item) => item.kind === 'project')} defaultValue={unit.projectId} required />
          <label>
            <RequiredLabel label={t('create.unitType')} required />
            <select name="unitType" value={unitType} required onChange={(event) => {
              const nextType = event.target.value
              setUnitType(nextType)
              if (!getApplicableUnitAreaFields(nextType, floor).showFloor) setFloor('Ground')
            }}>
              {PRD_UNIT_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <NumberField name="bua" label={t('create.bua')} defaultValue={unit.bua} min={1} required />
          {areaFields.showLandArea && <NumberField name="landArea" label={t('create.landArea')} defaultValue={unit.landArea ?? 0} min={0} required />}
          {areaFields.showFloor && (
            <label>
              <RequiredLabel label={t('create.floor')} required />
              <select name="floor" value={floor} required onChange={(event) => setFloor(event.target.value)}>
                {PRD_FLOOR_OPTIONS.map((item) => <option key={item} value={item}>{item === 'Ground' ? t('create.ground') : item}</option>)}
              </select>
            </label>
          )}
          {areaFields.showGardenArea && <NumberField name="gardenArea" label={t('create.gardenArea')} defaultValue={unit.gardenArea ?? 0} min={0} />}
          {areaFields.showTerraceArea && <NumberField name="terraceArea" label={t('create.terraceArea')} defaultValue={unit.terraceArea ?? 0} min={0} required />}
          <NativeLookupSelect name="viewId" label={t('create.view')} values={lookupValues.filter((item) => item.kind === 'view')} defaultValue={unit.viewId} />
          <NumberField name="bedrooms" label={t('create.bedrooms')} defaultValue={unit.bedrooms} min={1} max={10} required />
          <NumberField name="bathrooms" label={t('create.bathrooms')} defaultValue={unit.bathrooms} min={1} max={10} required />
          <label className="toggle-line"><input name="elevator" type="checkbox" defaultChecked={unit.elevator} /> {t('create.elevator')}</label>
          <label>
            {t('create.furnished')}
            <select name="furnished" defaultValue={String(unit.furnished)}>
              <option value="true">{t('create.furnishedOption')}</option>
              <option value="false">{t('create.unfurnishedOption')}</option>
            </select>
          </label>
          <label>
            <RequiredLabel label={t('create.finish')} required />
            <select name="finish" defaultValue={unit.finish} required>
              <option value="Fully Finished">{t('create.fullyFinished')}</option>
              <option value="Semi Finished">{t('create.semiFinished')}</option>
              <option value="Core & Shell">{t('create.coreAndShell')}</option>
            </select>
          </label>
          <label>
            <RequiredLabel label={t('create.deliveryDate')} required />
            <select name="deliveryYear" defaultValue={String(unit.deliveryExpectancy.year)} required>
              {deliveryYearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
          <label className="wide-field">
            {t('create.salesNotes')}
            <textarea name="salesNotes" defaultValue={unit.salesNotes} dir="auto" />
          </label>
        </fieldset>

        <fieldset>
          <legend>{t('create.legend.payment')}</legend>
          <ReadOnlyField label={t('create.paymentMethod')} value={getPaymentMethodLabel(locale, unit.paymentMethod)} />
          <label>
            <RequiredLabel label={t('create.totalAmount')} required />
            <input name="totalAmount" type="number" min={0} defaultValue={unit.totalAmount} disabled={!canEditPricing || saving} required={canEditPricing} />
          </label>
          <ReadOnlyField label={t('create.downPayment')} value={formatCurrency(unit.downPayment, locale)} />
          <ReadOnlyField label={t('details.remainingPayment')} value={formatCurrency(unit.remainingPayment, locale)} />
          <ReadOnlyField label={t('details.installmentAmount')} value={formatCurrency(unit.installmentAmount, locale)} />
          <label>
            <RequiredLabel label={t('details.commission')} required />
            <input name="commissionPercentage" type="number" min={0} step="0.01" defaultValue={unit.commissionPercentage} disabled={!canEditCommission || saving} required={canEditCommission} />
          </label>
        </fieldset>

        <fieldset disabled={!canEditOwner || saving}>
          <legend>{t('details.ownerData')}</legend>
          <label>
            <RequiredLabel label={t('create.ownerName')} required />
            <input name="ownerName" defaultValue={unit.originalOwnerName ?? ''} required={canEditOwner} dir="auto" />
          </label>
          {canEditOwner ? (
            <OwnerPhoneField
              countryCode={ownerCountryCode}
              countryOptions={ownerPhoneCountryOptions}
              hint={t('create.ownerPhoneHint', { country: selectedOwnerPhoneCountry.label, example: selectedOwnerPhoneCountry.placeholder })}
              ownerPhone={ownerPhone}
              placeholder={selectedOwnerPhoneCountry.placeholder}
              onCountryCodeChange={setOwnerCountryCode}
              onOwnerPhoneChange={setOwnerPhone}
            />
          ) : (
            <>
              <ReadOnlyField label={t('create.countryCode')} value={unit.countryCode ?? t('common.notSet')} />
              <ReadOnlyField label={t('create.ownerPhone')} value={unit.originalOwnerPhone ?? t('common.notSet')} />
            </>
          )}
        </fieldset>

        <p className="status-action-feedback is-saving" role="status" aria-live="polite">
          {saving ? t('details.editSaving') : t('details.editReady')}
        </p>
        <div className="note-editor-actions">
          <button className="primary-button" type="submit" disabled={saving}>{saving ? t('common.saving') : t('details.saveUnitChanges')}</button>
          <button className="secondary-button" type="button" disabled={saving} onClick={onCancel}>{t('common.cancel')}</button>
        </div>
      </form>
    </section>
  )
}

function NativeLookupSelect({
  name,
  label,
  values,
  defaultValue,
  required = false,
}: {
  name: string
  label: string
  values: { id: string; label: string }[]
  defaultValue: string
  required?: boolean
}) {
  return (
    <label>
      <RequiredLabel label={label} required={required} />
      <select name={name} defaultValue={defaultValue} required={required}>
        {values.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
    </label>
  )
}

function ReadOnlyField({ label, value }: { label: string; value: string | number | null }) {
  const { t } = useLocale()
  return (
    <label>
      {label}
      <input readOnly disabled value={value ?? t('common.notSet')} />
    </label>
  )
}

function UnitDetailsDeepSections({
  locale,
  t,
  user,
  unit,
  ownerAllowed,
  sharedNote,
  setSharedNote,
  thumbnail,
  onSaveNote,
  onDeleteNote,
  onRemoveMedia,
  onMediaPdfVisibilityChange,
  onMediaDownload,
  removingMediaId,
  downloadingMediaId,
}: {
  locale: LocaleCode
  t: ReturnType<typeof useLocale>['t']
  user: LeadraUser
  unit: LeadraUnit
  ownerAllowed: boolean
  sharedNote: string
  setSharedNote: (value: string) => void
  thumbnail: LeadraMediaFile | null
  onSaveNote: (content: string) => void
  onDeleteNote: () => void
  onRemoveMedia: (mediaId: string) => void
  onMediaPdfVisibilityChange: (mediaId: string, includeInPdf: boolean) => void
  onMediaDownload: (file: LeadraMediaFile) => void
  removingMediaId: string | null
  downloadingMediaId: string | null
}) {
  const installmentSchedule = buildInstallmentSchedule(unit, locale)
  const scheduledInstallmentTotal = installmentSchedule.reduce((total, row) => total + row.amount, 0)
  const paidInstallmentTotal = Math.max(
    scheduledInstallmentTotal - (unit.remainingPayment ?? scheduledInstallmentTotal),
    0,
  )
  const timetableRemaining = Math.max(scheduledInstallmentTotal - paidInstallmentTotal, 0)
  const isInstallmentPaid = (rowIndex: number) => {
    const paidThroughRow = installmentSchedule
      .slice(0, rowIndex + 1)
      .reduce((total, row) => total + row.amount, 0)
    return paidInstallmentTotal >= paidThroughRow - 0.01
  }
  const areaFields = getApplicableUnitAreaFields(unit.unitType, unit.floor)
  const canRemoveMedia = canEditNonOwnerUnitDetails(user, unit)
  const mainInfoRows: [string, string | number | null][] = [
    [t('details.unitCode'), unit.unitCode],
    [t('details.status'), getStatusLabel(locale, unit.status)],
    [t('details.destination'), unit.destinationName],
    [t('details.developer'), unit.developerName],
    [t('details.project'), unit.projectName],
    [t('details.unitType'), unit.unitType],
    [t('create.bua'), `${formatCount(locale, unit.bua)} m²`],
  ]
  if (areaFields.showLandArea) mainInfoRows.push([t('details.landArea'), unit.landArea ? `${formatCount(locale, unit.landArea)} m²` : t('common.notSet')])
  if (areaFields.showFloor) mainInfoRows.push([t('details.floor'), unit.floor])
  if (areaFields.showGardenArea) mainInfoRows.push([t('details.gardenArea'), unit.gardenArea ? `${formatCount(locale, unit.gardenArea)} m²` : t('common.notSet')])
  if (areaFields.showTerraceArea) mainInfoRows.push([t('details.terraceArea'), unit.terraceArea ? `${formatCount(locale, unit.terraceArea)} m²` : t('common.notSet')])
  mainInfoRows.push(
    [t('details.view'), unit.viewName],
    [t('details.bedrooms'), formatCount(locale, unit.bedrooms)],
    [t('details.bathrooms'), formatCount(locale, unit.bathrooms)],
    [t('details.elevator'), unit.elevator ? t('common.with') : t('common.without')],
    [t('details.furnishingStatus'), unit.furnished ? t('create.furnishedOption') : t('common.notSet')],
    [t('details.finishType'), unit.finish],
  )
  const pricingRows: [string, string | number | null][] = [
    [t('details.paymentMethod'), getPaymentMethodLabel(locale, unit.paymentMethod)],
    [t('details.totalAmount'), formatCurrency(unit.totalAmount, locale)],
    [t('create.downPayment'), formatCurrency(unit.downPayment, locale)],
    [t('details.remainingPayment'), formatCurrency(unit.remainingPayment, locale)],
    [t('details.commission'), `${formatCurrency(unit.commissionAmount, locale)} (${unit.commissionPercentage}%)`],
    [t('details.installmentAmount'), formatCurrency(unit.installmentAmount, locale)],
    [t('details.installmentYears'), unit.installmentYears ? formatCount(locale, unit.installmentYears) : t('common.notSet')],
  ]
  const ownerRows: [string, string | number | null][] = [
    [t('details.ownerName'), unit.originalOwnerName ?? t('common.notSet')],
    [t('details.ownerPhone'), unit.originalOwnerPhone ?? t('common.notSet')],
    [t('details.normalizedPhone'), unit.normalizedOwnerPhone ?? t('common.notSet')],
  ]
  return (
    <>
      <section className="content-card motion-stage details-overview-card" style={motionStyle(2, 70)}>
        <div className="section-heading details-compact-heading">
          <div>
            <p className="eyebrow">{t('details.unitCode')}</p>
            <h2>{t('details.mainInfo')}</h2>
          </div>
        </div>
        <div className="details-overview-grid">
          <InfoPanel title={t('details.mainInfo')} rows={mainInfoRows} />
          <InfoPanel title={t('details.pricing')} rows={pricingRows} />
          <InfoPanel title={t('details.delivery')} rows={[[t('details.expectedDelivery'), formatDeliveryExpectancy(unit, locale)]]} />
          {ownerAllowed && <InfoPanel title={t('details.ownerData')} rows={ownerRows} />}
        </div>
      </section>
      <section className="content-card motion-stage details-installments-card" style={motionStyle(3, 100)}>
        <h2>{t('details.installmentsTable')}</h2>
        {unit.paymentMethod !== 'installment' && <EmptyState title={t('common.notSet')} body={t('payment.cash')} />}
        {unit.paymentMethod === 'installment' && unit.installmentType === 'custom' && <p className="media-empty-note">{t('details.customInstallmentMessage')}</p>}
        {installmentSchedule.length > 0 && (
          <div className="installment-schedule" role="table" aria-label={t('details.installmentsTable')}>
            <div className="installment-summary" aria-live="polite">
              <span>Paid from timetable: {formatCurrency(paidInstallmentTotal, locale)}</span>
              <strong>Remaining from timetable: {formatCurrency(timetableRemaining, locale)}</strong>
            </div>
            {installmentSchedule.slice(0, 12).map((row, rowIndex) => {
              const rowPaid = isInstallmentPaid(rowIndex)
              return (
              <div className="installment-row" role="row" key={row.paymentNumber}>
                <span>{formatCount(locale, row.paymentNumber)}</span>
                <span>{row.periodLabel}</span>
                <strong>{formatCurrency(row.amount, locale)}</strong>
                <span className={rowPaid ? 'installment-status paid' : 'installment-status'}>{rowPaid ? 'Paid' : 'Unpaid'}</span>
              </div>
              )
            })}
            {installmentSchedule.length > 12 && <small>{t('details.scheduleTruncated', { count: formatCount(locale, installmentSchedule.length) })}</small>}
          </div>
        )}
      </section>
      <div className="details-secondary-grid">
        <section className="content-card motion-stage details-thumbnail-card" style={motionStyle(4, 130)}>
          <h2>{t('details.unitThumbnail')}</h2>
          {thumbnail ? (
            <div className="media-grid">
              <div className="media-card">
                <div className="media-preview">
                  <img src={thumbnail.url} alt={thumbnail.name} loading="lazy" decoding="async" />
                </div>
              </div>
            </div>
          ) : (
            <EmptyState title={t('details.noThumbnailTitle')} body={t('details.noThumbnailBody')} />
          )}
        </section>
        <section className="content-card motion-stage details-notes-card" style={motionStyle(5, 160)}>
          <h2>{t('details.notes')}</h2>
          <p dir="auto">{canViewSalesSensitiveData(user, unit) ? unit.salesNotes : t('details.salesSensitiveHidden')}</p>
          {unit.adminManagerNotes.map((note, index) => (
            <div className="note-card motion-stage" key={note.id} style={motionStyle(index, 210)}>
              <strong>{note.createdByName} / {getRoleLabel(locale, note.role)}</strong>
              <p dir="auto">{note.content}</p>
              <small>{formatDateTime(locale, note.createdAt)}</small>
            </div>
          ))}
          {!canAddAdminManagerNote(user) && <small>{t('details.salesCannotAddNotes')}</small>}
          {canAddAdminManagerNote(user) && (
            <form
              className="note-editor"
              onSubmit={(event) => {
                event.preventDefault()
                onSaveNote(sharedNote)
              }}
            >
              <label className="wide-field">
                {t('details.editSharedNote')}
                <textarea value={sharedNote} onChange={(event) => setSharedNote(event.target.value)} dir="auto" />
              </label>
              <div className="note-editor-actions">
                <button className="secondary-button" type="submit">{t('details.saveNote')}</button>
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => {
                    setSharedNote('')
                    onDeleteNote()
                  }}
                >
                  {t('details.deleteNote')}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
      <section className="content-card motion-stage details-gallery-card" style={motionStyle(6, 190)}>
        <h2>{t('details.mediaGallery')}</h2>
        {unit.media.length === 0 ? (
          <EmptyState title={t('details.noMediaTitle')} body={t('details.noMediaBody')} />
        ) : (
          <div className="media-grid">
            {unit.media.map((file, index) => (
              <div className="media-card motion-stage" key={file.id} style={motionStyle(index, 290)}>
                <div className="media-preview">
                  <img src={file.url} alt={file.name} loading="lazy" decoding="async" />
                </div>
                <div className="media-card-actions">
                  {canRemoveMedia && (
                    <button
                      className="pdf-visibility-toggle media-pdf-toggle"
                      type="button"
                      aria-pressed={file.includeInPdf !== false}
                      onClick={() => onMediaPdfVisibilityChange(file.id, file.includeInPdf === false)}
                    >
                      <span className="pdf-visibility-indicator" aria-hidden="true" />
                      <span>{file.includeInPdf !== false ? t('media.includeInPdf') : t('media.excludeFromPdf')}</span>
                    </button>
                  )}
                  <button
                    className="media-download-button secondary-button"
                    type="button"
                    aria-label={t('details.downloadMedia', { name: file.name })}
                    disabled={downloadingMediaId === file.id}
                    onClick={() => onMediaDownload(file)}
                  >
                    <Download size={17} /> {downloadingMediaId === file.id ? t('common.saving') : t('common.download')}
                  </button>
                  {canRemoveMedia && (
                    <button
                      className="media-remove-button danger-button"
                      type="button"
                      aria-label={t('details.removeMediaNamed', { name: file.name })}
                      disabled={removingMediaId === file.id}
                      onClick={() => onRemoveMedia(file.id)}
                    >
                      <Trash2 size={17} /> {removingMediaId === file.id ? t('common.saving') : t('details.removeMedia')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
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
          Show {formatCount(locale, Math.min(notificationPageSize, visibleNotifications.length - visibleRows.length))} more of {formatCount(locale, visibleNotifications.length)}
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
          setAnalyticsError('Live analytics could not be refreshed. Showing the latest loaded workspace data.')
        }
      } finally {
        if (!cancelled) setAnalyticsLoading(false)
      }
    }

    void loadRemoteAnalytics()
    return () => {
      cancelled = true
    }
  }, [filters])

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
            <p className="eyebrow">Filters</p>
            <h2>Focus analytics</h2>
            <p>{activeFilterCount === 0 ? 'Showing all aggregate activity.' : `${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} active.`}</p>
          </div>
          <div className="analytics-control-actions">
            {analyticsLoading && <span className="analytics-chip">Refreshing</span>}
            <button className="secondary-link" type="button" onClick={() => updateAnalyticsRoute(defaultAnalyticsFilters, { replace: true })}>Reset</button>
            <button className="ghost-button analytics-filter-toggle" type="button" aria-expanded={filterOpen} onClick={() => onRouteChange(analyticsRouteForFilters(filters, !filterOpen))}>
              <SlidersHorizontal size={17} /> {filterOpen ? 'Close filters' : 'Filters'}
              {activeFilterCount > 0 && <span>{activeFilterCount}</span>}
            </button>
            <button className="primary-button compact-action" type="button" onClick={exportCsv}>
              <Download size={17} /> CSV
            </button>
          </div>
        </div>
        {filters.dateWindow === 'custom' && (
          <div className="analytics-custom-range">
            <label>
              Start
              <input type="date" value={filters.startDate ?? ''} onChange={(event) => updateAnalyticsRoute({ ...filters, startDate: event.target.value || undefined }, { replace: true })} />
            </label>
            <label>
              End
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

      <section className="metric-grid analytics-metrics motion-stage" style={motionStyle(1, 40)}>
        <Metric label={t('analytics.activeUnits')} value={formatCount(locale, dashboard.overview.totalActiveUnits)} style={motionStyle(0, 140)} />
        <Metric label={t('analytics.soldValue')} value={formatCurrency(dashboard.overview.soldValue, locale)} style={motionStyle(1, 165)} />
        <Metric label={t('analytics.projectedCommission')} value={formatCurrency(dashboard.overview.projectedCommission, locale)} style={motionStyle(2, 190)} />
        <Metric label={t('analytics.pdfExports')} value={formatCount(locale, dashboard.overview.pdfExports)} style={motionStyle(3, 215)} />
        <Metric label={t('analytics.duplicateAttempts')} value={formatCount(locale, dashboard.overview.duplicateAttempts)} style={motionStyle(4, 240)} />
        <Metric label={t('analytics.staleUnits')} value={formatCount(locale, dashboard.overview.staleUnits)} style={motionStyle(5, 265)} />
      </section>

      <div className="page-grid">
        <section className="content-card motion-stage" style={motionStyle(2, 80)}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">{t('analytics.salesEyebrow')}</p>
              <h2>{t('analytics.salesHeading')}</h2>
            </div>
          </div>
          {topSales.length === 0 && <EmptyState title={t('analytics.noSalesTitle')} body={t('analytics.noSalesBody')} />}
          {topSales.length > 0 && <LeaderboardChart rows={topSales.map((row) => ({ label: row.userName, value: row.activityCount, suffix: ' events' }))} />}
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
          <p className="eyebrow">Preparing charts</p>
          <h2>Loading detailed analytics</h2>
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
              <span className="analytics-chip">{formatCurrency(project.averagePrice, locale)} avg</span>
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
          <LineChart title="Sold value trend" points={dashboard.soldValueTrend} currency locale={locale} />
          <div className="timeline-chart" aria-label={t('analytics.timelineLabel')}>
            {latestTimeline.length === 0 && <EmptyState title={t('analytics.timelineEmptyTitle')} body={t('analytics.timelineEmptyBody')} />}
            {latestTimeline.slice(-30).map((point, index) => (
              <div className="timeline-bar motion-stage" key={point.date} style={motionStyle(index, 250)}>
                <span style={{ height: `${Math.max(18, point.activityCount * 20)}px` }} title={t('analytics.timelineTitle', { count: point.activityCount, date: point.date })} />
                <small>{formatShortDate(locale, point.date)}</small>
              </div>
            ))}
          </div>
          <BarChart title="PDF export trend" points={dashboard.pdfExportTrend.slice(-30)} />
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
  return (
    <div className={`analytics-filter-panel ${open ? 'open' : ''}`}>
      <SelectFilter label="Team" value={filters.teamIds[0] ?? ''} disabled={managerMode} options={dashboard.filterOptions.teams} onChange={(value) => onChange('teamIds', value)} />
      <SelectFilter label="User" value={filters.userIds[0] ?? ''} options={dashboard.filterOptions.users} onChange={(value) => onChange('userIds', value)} />
      <SelectFilter label="Project" value={filters.projectIds[0] ?? ''} options={dashboard.filterOptions.projects} onChange={(value) => onChange('projectIds', value)} />
      <SelectFilter label="Developer" value={filters.developerIds[0] ?? ''} options={dashboard.filterOptions.developers} onChange={(value) => onChange('developerIds', value)} />
      <SelectFilter label="Destination" value={filters.destinationIds[0] ?? ''} options={dashboard.filterOptions.destinations} onChange={(value) => onChange('destinationIds', value)} />
      <SelectFilter
        label="Status"
        value={filters.statuses[0] ?? ''}
        options={[
          { id: 'available', label: 'Available' },
          { id: 'hold', label: 'Hold' },
          { id: 'sold_by_us', label: 'Sold by Us' },
          { id: 'sold_by_others', label: 'Sold by Others' },
        ]}
        onChange={(value) => onChange('statuses', value)}
      />
      <SelectFilter
        label="Payment"
        value={filters.paymentMethods[0] ?? ''}
        options={[
          { id: 'cash', label: 'Cash' },
          { id: 'installment', label: 'Installment' },
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
  const total = Math.max(1, dashboard.overview.availableUnits + dashboard.overview.holdUnits + dashboard.overview.soldUnits)
  const available = Math.round((dashboard.overview.availableUnits / total) * 100)
  const hold = Math.round((dashboard.overview.holdUnits / total) * 100)
  return (
    <div className="status-donut" style={{ '--available': `${available}%`, '--hold': `${hold}%` } as CSSProperties}>
      <div>
        <strong>{available}%</strong>
        <span>available mix</span>
      </div>
    </div>
  )
}

function LeaderboardChart({ rows }: { rows: { label: string; value: number; suffix?: string }[] }) {
  const max = Math.max(1, ...rows.map((row) => row.value))
  return (
    <div className="leaderboard-chart" aria-label="Sales leaderboard chart">
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
        <path className="line-chart-area" d={`${path} L ${width} ${height - 8} L 0 ${height - 8} Z`} />
        <path className="line-chart-line" d={path} />
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
  const max = Math.max(1, ...points.map((point) => point.value))
  return (
    <div className="bar-chart-card" aria-label={title}>
      <div className="chart-title">
        <strong>{title}</strong>
        <span>{max} max</span>
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

function ProfilePage({ user }: { user: LeadraUser }) {
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
    </section>
  )
}

function AdminPage({
  users,
  units,
  settings,
  auditLogs,
  lookupValues,
  lookupCount,
  activeSection,
  activeDirectory,
  onSectionChange,
  onDirectoryChange,
  defaultBranchId,
  branches,
  teams,
  onCreateLookupValue,
  onUpdateLookupValue,
  onArchiveLookupValue,
  onCreateBranch,
  onUpdateBranch,
  onArchiveBranch,
  onCreateTeam,
  onUpdateTeam,
  onArchiveTeam,
  onCreateUser,
  onUpdateUser,
  onUpdateUserPassword,
  onDeleteSalesRepresentative,
  onDeleteManagedUser,
  onSettingsUpdate,
}: {
  users: LeadraUser[]
  units: LeadraUnit[]
  settings: AppSettings
  auditLogs: AuditLogItem[]
  lookupValues: LookupValue[]
  lookupCount: number
  activeSection: AdminSection
  activeDirectory: MasterDataDirectory
  onSectionChange: (section: AdminSection) => void
  onDirectoryChange: (directory: MasterDataDirectory) => void
  defaultBranchId: string
  branches: BranchDirectoryItem[]
  teams: TeamDirectoryItem[]
  onCreateLookupValue: (kind: LookupKind, label: string) => Promise<void>
  onUpdateLookupValue: (lookupId: string, label: string) => Promise<void>
  onArchiveLookupValue: (lookupId: string) => Promise<void>
  onCreateBranch: (name: string) => Promise<void>
  onUpdateBranch: (branchId: string, name: string) => Promise<void>
  onArchiveBranch: (branchId: string) => Promise<void>
  onCreateTeam: (name: string) => Promise<void>
  onUpdateTeam: (teamId: string, name: string) => Promise<void>
  onArchiveTeam: (teamId: string) => Promise<void>
  onCreateUser: (formData: FormData) => Promise<void>
  onUpdateUser: (userId: string, updates: Partial<LeadraUser>) => Promise<void>
  onUpdateUserPassword: (userId: string, password: string) => Promise<void>
  onDeleteSalesRepresentative: (salesUserId: string, replacementSalesUserId: string) => Promise<void>
  onDeleteManagedUser: (managedUserId: string) => Promise<void>
  onSettingsUpdate: (settings: Partial<AppSettings>) => Promise<void>
}) {
  const { locale, t } = useLocale()
  const [userQuery, setUserQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<LeadraUser['role'] | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<LeadraUser['status'] | 'all'>('all')
  const [teamFilter, setTeamFilter] = useState('all')
  const [sortUsersBy, setSortUsersBy] = useState<'role' | 'name' | 'recent'>('role')
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [createUserOpen, setCreateUserOpen] = useState(false)
  const [createUserError, setCreateUserError] = useState('')
  const [visibleUserCount, setVisibleUserCount] = useState(userManagementPageSize)
  const [visibleAuditCount, setVisibleAuditCount] = useState(auditLogPageSize)
  const deferredUserQuery = useDeferredValue(userQuery)
  const userListStateKey = `${deferredUserQuery}-${roleFilter}-${statusFilter}-${teamFilter}-${sortUsersBy}`
  const teamOptions = useMemo(() => {
    const activeTeams = teams
      .filter((team) => !team.archived)
      .map((team) => ({ value: team.id, label: team.name }))
      .sort((first, second) => compareText(locale, first.label, second.label))
    if (activeTeams.length > 0) return activeTeams

    return Array.from(new Set(users.map((item) => item.teamId).filter(Boolean)))
      .sort((first, second) => compareText(locale, first, second))
      .map((teamId) => ({ value: teamId, label: teamId }))
  }, [teams, users, locale])
  const createUserTeamOptions = [{ value: '', label: t('admin.noTeam') }, ...teamOptions]
  const branchOptions = useMemo(() => {
    const activeBranches = branches
      .filter((branch) => !branch.archived)
      .map((branch) => ({ value: branch.id, label: branch.name }))
      .sort((first, second) => compareText(locale, first.label, second.label))
    if (activeBranches.length > 0) return activeBranches

    return Array.from(new Set(users.map((item) => item.branchId).filter(Boolean)))
      .sort((first, second) => compareText(locale, first, second))
      .map((branchId) => ({ value: branchId, label: branchId }))
  }, [branches, users, locale])
  const userTeamOptions = createUserTeamOptions
  const userBranchOptions = [{ value: '', label: t('admin.noBranch') }, ...branchOptions]
  const teamFilterOptions = teamOptions
  const defaultCreateTeamId = ''
  const activeSalesUsers = useMemo(
    () =>
      users
        .filter((item) => item.role === 'sales' && item.status === 'active' && !item.deletedAt)
        .sort((first, second) => compareText(locale, first.fullName, second.fullName)),
    [users, locale],
  )
  const filteredUsers = useMemo(
    () =>
      users
        .filter((item) => {
          if ((item.deletedAt || item.status === 'inactive') && statusFilter !== 'inactive') return false
          const query = deferredUserQuery.trim().toLowerCase()
          const matchesQuery =
            query.length === 0 ||
            item.fullName.toLowerCase().includes(query) ||
            item.email.toLowerCase().includes(query) ||
            item.teamId.toLowerCase().includes(query) ||
            item.branchId.toLowerCase().includes(query) ||
            item.jobTitle.toLowerCase().includes(query)
          const matchesRole = roleFilter === 'all' || item.role === roleFilter
          const matchesStatus = statusFilter === 'all' || item.status === statusFilter
          const matchesTeam = teamFilter === 'all' || item.teamId === teamFilter
          return matchesQuery && matchesRole && matchesStatus && matchesTeam
        })
        .sort((first, second) => {
          if (sortUsersBy === 'name') return compareText(locale, first.fullName, second.fullName)
          if (sortUsersBy === 'recent') {
            return new Date(second.lastLoginAt ?? second.createdAt ?? 0).getTime() - new Date(first.lastLoginAt ?? first.createdAt ?? 0).getTime()
          }
          return roleOrder[first.role] - roleOrder[second.role] || compareText(locale, first.fullName, second.fullName)
        }),
    [deferredUserQuery, locale, roleFilter, sortUsersBy, statusFilter, teamFilter, users],
  )
  const visibleUsers = filteredUsers.slice(0, visibleUserCount)
  const visibleAuditLogs = auditLogs.slice(0, visibleAuditCount)
  const userCountsByRole = useMemo(
    () =>
      users.reduce<Record<LeadraUser['role'], number>>(
        (counts, item) => ({ ...counts, [item.role]: counts[item.role] + 1 }),
        { admin: 0, sub_admin: 0, manager: 0, sales: 0 },
      ),
    [users],
  )

  return (
    <section className="wizard-shell admin-workspace page-entrance admin-page">
      <div className="wizard-steps motion-stage" aria-label={t('nav.admin')} style={motionStyle(0)}>
        {adminSections.map((section) => (
          <button
            key={section}
            className={`wizard-step ${section === activeSection ? 'active' : ''}`}
            type="button"
            aria-current={section === activeSection ? 'step' : undefined}
            onClick={() => onSectionChange(section)}
          >
            {translateAdminSection(section, locale)}
          </button>
        ))}
      </div>

      {activeSection === 'Users' && (
        <section className="content-card admin-panel motion-stage motion-subtle" style={motionStyle(1)}>
          <div className="admin-user-header">
            <div>
              <p className="eyebrow">{t('admin.peopleEyebrow')}</p>
              <h2><Users size={19} /> {t('admin.userManagement')}</h2>
              <p>{t('admin.userManagementCopy')}</p>
            </div>
            <div className="admin-user-side">
              <div className="user-role-counts" aria-label={t('admin.userRoleCounts')}>
                <span>{t('admin.adminCount', { count: formatCount(locale, userCountsByRole.admin) })}</span>
                <span>{t('admin.subCount', { count: formatCount(locale, userCountsByRole.sub_admin) })}</span>
                <span>{t('admin.managerCount', { count: formatCount(locale, userCountsByRole.manager) })}</span>
                <span>{t('admin.salesCount', { count: formatCount(locale, userCountsByRole.sales) })}</span>
              </div>
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  setCreateUserError('')
                  setCreateUserOpen((open) => !open)
                }}
              >
                {createUserOpen ? t('admin.closeForm') : t('admin.newUser')}
              </button>
            </div>
          </div>
          {createUserOpen && (
            <form
              className="settings-form create-user-panel motion-stage"
              style={motionStyle(0, 110)}
              onSubmit={async (event) => {
                event.preventDefault()
                const form = event.currentTarget
                const formData = new FormData(form)
                const password = String(formData.get('password') ?? '')
                const confirmPassword = String(formData.get('confirmPassword') ?? '')

                setCreateUserError('')
                if (password.length < 8) {
                  setCreateUserError(t('admin.passwordTooShort'))
                  return
                }
                if (password !== confirmPassword) {
                  setCreateUserError(t('admin.passwordMismatch'))
                  return
                }

                try {
                  await onCreateUser(formData)
                  form.reset()
                  setCreateUserOpen(false)
                } catch {
                  // The parent renders the error flash; keep the form open so the admin can retry.
                }
              }}
            >
              <label>
                {t('admin.fullName')}
                <input name="fullName" required placeholder={t('admin.fullNamePlaceholder')} dir="auto" />
              </label>
              <label>
                {t('admin.email')}
                <input name="email" type="email" required placeholder={t('admin.emailPlaceholder')} dir="auto" />
              </label>
              <PasswordField label={t('admin.newPassword')} name="password" required minLength={8} autoComplete="new-password" />
              <PasswordField label={t('admin.confirmPassword')} name="confirmPassword" required minLength={8} autoComplete="new-password" />
              <NamedSelectField
                defaultValue="sales"
                label={t('admin.role')}
                name="role"
                options={[
                  { value: 'sales', label: getRoleLabel(locale, 'sales') },
                  { value: 'manager', label: getRoleLabel(locale, 'manager') },
                  { value: 'sub_admin', label: getRoleLabel(locale, 'sub_admin') },
                  { value: 'admin', label: getRoleLabel(locale, 'admin') },
                ]}
              />
              <label>
                {t('admin.jobTitle')}
                <input name="jobTitle" required defaultValue="Sales Representative" dir="auto" />
              </label>
              <label>
                {t('admin.phoneNumber')}
                <input name="phoneNumber" required defaultValue="+201000000000" dir="auto" />
              </label>
              {createUserTeamOptions.length > 0 ? (
                <NamedSelectField
                  defaultValue={defaultCreateTeamId}
                  label={t('admin.team')}
                  name="teamId"
                  options={createUserTeamOptions}
                />
              ) : (
                <label>
                  {t('admin.team')}
                  <input name="teamId" defaultValue="" placeholder={t('admin.noTeamsYet')} dir="auto" />
                </label>
              )}
              <label>
                {t('admin.branch')}
                <input name="branchId" dir="auto" placeholder={defaultBranchId || undefined} />
              </label>
              {createUserError && <p className="form-error">{createUserError}</p>}
              <button className="secondary-button" type="submit">{t('admin.createUser')}</button>
            </form>
          )}

          <div className="user-management-tools" aria-label={t('admin.userManagement')}>
            <label className="wide-field">
              {t('admin.searchUsers')}
              <input value={userQuery} onChange={(event) => setUserQuery(event.target.value)} placeholder={t('admin.searchUsersPlaceholder')} dir="auto" />
            </label>
            <ControlledSelectField
              label={t('admin.role')}
              options={[
                { value: 'all', label: t('admin.allRoles') },
                { value: 'admin', label: getRoleLabel(locale, 'admin') },
                { value: 'sub_admin', label: getRoleLabel(locale, 'sub_admin') },
                { value: 'manager', label: getRoleLabel(locale, 'manager') },
                { value: 'sales', label: getRoleLabel(locale, 'sales') },
              ]}
              value={roleFilter}
              onValueChange={(value) => setRoleFilter(value as LeadraUser['role'] | 'all')}
            />
            <ControlledSelectField
              label={t('admin.team')}
              options={[
                { value: 'all', label: t('admin.allTeams') },
                ...teamFilterOptions,
              ]}
              value={teamFilter}
              onValueChange={setTeamFilter}
            />
            <ControlledSelectField
              label={t('admin.status')}
              options={[
                { value: 'all', label: t('admin.allStatus') },
                { value: 'active', label: t('admin.statusActive') },
                { value: 'inactive', label: t('admin.statusInactive') },
              ]}
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as LeadraUser['status'] | 'all')}
            />
            <ControlledSelectField
              label={t('admin.sort')}
              options={[
                { value: 'role', label: t('admin.sortRole') },
                { value: 'name', label: t('admin.sortName') },
                { value: 'recent', label: t('admin.sortRecent') },
              ]}
              value={sortUsersBy}
              onValueChange={(value) => setSortUsersBy(value as 'role' | 'name' | 'recent')}
            />
          </div>

          <div className="user-list-header">
            <strong>{t('common.countUsersShown', { count: formatCount(locale, filteredUsers.length) })}</strong>
            <small>{t('common.orderedBy', { value: sortLabel(sortUsersBy, locale) })}</small>
          </div>

          <div className="user-management-list" aria-label={t('admin.managedUsers')} key={userListStateKey}>
            {visibleUsers.map((item, index) => (
              <UserManagementCard
                key={item.id}
                index={index}
                user={item}
                isEditing={editingUserId === item.id}
                onEdit={() => setEditingUserId(item.id)}
                onCancel={() => setEditingUserId(null)}
                onSave={async (updates) => {
                  await onUpdateUser(item.id, updates)
                  setEditingUserId(null)
                }}
                onPasswordUpdate={(password) => onUpdateUserPassword(item.id, password)}
                teamOptions={userTeamOptions}
                branchOptions={userBranchOptions}
                salesReplacementOptions={activeSalesUsers.filter((salesUser) => salesUser.id !== item.id)}
                onDeleteSalesRepresentative={(replacementSalesUserId) => onDeleteSalesRepresentative(item.id, replacementSalesUserId)}
                onDeleteManagedUser={() => onDeleteManagedUser(item.id)}
              />
            ))}
            {filteredUsers.length === 0 && <EmptyState title={t('admin.noUsersTitle')} body={t('admin.noUsersBody')} />}
            {visibleUsers.length < filteredUsers.length && (
              <button className="secondary-button list-load-more" type="button" onClick={() => setVisibleUserCount((count) => Math.min(count + userManagementPageSize, filteredUsers.length))}>
                Show {formatCount(locale, Math.min(userManagementPageSize, filteredUsers.length - visibleUsers.length))} more of {formatCount(locale, filteredUsers.length)}
              </button>
            )}
          </div>
        </section>
      )}

      {activeSection === 'Master Data' && (
        <MasterDataPanel
          lookupValues={lookupValues}
          branches={branches}
          teams={teams}
          activeDirectory={activeDirectory}
          onDirectoryChange={onDirectoryChange}
          userCounts={users.reduce<Record<string, number>>((counts, item) => ({
            ...counts,
            [item.teamId]: (counts[item.teamId] ?? 0) + 1,
          }), {})}
          onCreateLookupValue={onCreateLookupValue}
          onUpdateLookupValue={onUpdateLookupValue}
          onArchiveLookupValue={onArchiveLookupValue}
          onCreateBranch={onCreateBranch}
          onUpdateBranch={onUpdateBranch}
          onArchiveBranch={onArchiveBranch}
          onCreateTeam={onCreateTeam}
          onUpdateTeam={onUpdateTeam}
          onArchiveTeam={onArchiveTeam}
        />
      )}

      {activeSection === 'Settings' && (
        <section className="content-card admin-panel motion-stage motion-subtle" style={motionStyle(1)}>
          <h2><Settings size={19} /> {t('admin.unitManagement')}</h2>
          <p>{t('admin.settingsCopy')}</p>
          <form
            className="settings-form"
            onSubmit={(event) => {
              event.preventDefault()
              const formData = new FormData(event.currentTarget)
              void onSettingsUpdate({
                companyName: String(formData.get('companyName') ?? '').trim() || 'Leadra',
                commissionPercentage: Number(formData.get('commissionPercentage')),
                footerText: String(formData.get('footerText') ?? '').trim(),
                contactDetails: String(formData.get('contactDetails') ?? '').trim(),
                logoPath: String(formData.get('logoPath') ?? '').trim(),
                pdfLayout: String(formData.get('pdfLayout')) === 'compact' ? 'compact' : 'classic',
                mediaLimitMb: Number(formData.get('mediaLimitMb')),
              })
            }}
          >
            <label>
              {t('admin.companyName')}
              <input name="companyName" required defaultValue={settings.companyName} dir="auto" />
            </label>
            <label>
              {t('admin.commissionPercentage')}
              <input name="commissionPercentage" type="number" min="0" step="0.1" defaultValue={settings.commissionPercentage} />
            </label>
            <label>
              {t('admin.mediaLimit')}
              <input name="mediaLimitMb" type="number" min="1" step="1" defaultValue={settings.mediaLimitMb} />
            </label>
            <label>
              {t('admin.logoPath')}
              <input name="logoPath" defaultValue={settings.logoPath} placeholder="/brand/leadra-logo.png" dir="auto" />
            </label>
            <label>
              {t('admin.pdfLayout')}
              <select name="pdfLayout" defaultValue={settings.pdfLayout}>
                <option value="classic">{t('admin.pdfLayoutClassic')}</option>
                <option value="compact">{t('admin.pdfLayoutCompact')}</option>
              </select>
            </label>
            <label>
              {t('admin.footerText')}
              <input name="footerText" defaultValue={settings.footerText} dir="auto" />
            </label>
            <label>
              {t('admin.contactDetails')}
              <input name="contactDetails" defaultValue={settings.contactDetails} dir="auto" />
            </label>
            <button className="secondary-button" type="submit">{t('admin.saveSettings')}</button>
          </form>
        </section>
      )}

      {activeSection === 'Metrics' && (
        <section className="content-card admin-panel motion-stage motion-subtle" style={motionStyle(1)}>
          <h2>{t('admin.metricsHeading')}</h2>
          <div className="metric-grid tight">
            <Metric label={t('admin.dropdowns')} value={formatCount(locale, lookupCount)} style={motionStyle(0, 100)} />
            <Metric label={t('admin.commission')} value={`${settings.commissionPercentage}%`} style={motionStyle(1, 135)} />
            <Metric label={t('admin.mediaLimit')} value={`${formatCount(locale, settings.mediaLimitMb)} MB`} style={motionStyle(2, 170)} />
            <Metric label={t('admin.units')} value={formatCount(locale, units.length)} style={motionStyle(3, 205)} />
          </div>
        </section>
      )}

      {activeSection === 'Audit' && (
        <section className="content-card admin-panel motion-stage motion-subtle" style={motionStyle(1)}>
          <h2>{t('admin.auditLog')}</h2>
          {visibleAuditLogs.map((item, index) => (
            <div className="admin-row motion-stage" key={item.id} style={motionStyle(index, 110)}>
              <strong>{renderAuditAction(locale, item)}</strong>
              <span>{item.actorName} / {getRoleLabel(locale, item.actorRole)}</span>
              <small>{item.relatedUnitCode} / {formatDateTime(locale, item.createdAt)}</small>
            </div>
          ))}
          {visibleAuditLogs.length < auditLogs.length && (
            <button className="secondary-button list-load-more" type="button" onClick={() => setVisibleAuditCount((count) => Math.min(count + auditLogPageSize, auditLogs.length))}>
              Show {formatCount(locale, Math.min(auditLogPageSize, auditLogs.length - visibleAuditLogs.length))} more of {formatCount(locale, auditLogs.length)}
            </button>
          )}
        </section>
      )}
    </section>
  )
}

function MasterDataPanel({
  lookupValues,
  branches,
  teams,
  activeDirectory,
  onDirectoryChange,
  userCounts,
  onCreateLookupValue,
  onUpdateLookupValue,
  onArchiveLookupValue,
  onCreateBranch,
  onUpdateBranch,
  onArchiveBranch,
  onCreateTeam,
  onUpdateTeam,
  onArchiveTeam,
}: {
  lookupValues: LookupValue[]
  branches: BranchDirectoryItem[]
  teams: TeamDirectoryItem[]
  activeDirectory: MasterDataDirectory
  onDirectoryChange: (directory: MasterDataDirectory) => void
  userCounts: Record<string, number>
  onCreateLookupValue: (kind: LookupKind, label: string) => Promise<void>
  onUpdateLookupValue: (lookupId: string, label: string) => Promise<void>
  onArchiveLookupValue: (lookupId: string) => Promise<void>
  onCreateBranch: (name: string) => Promise<void>
  onUpdateBranch: (branchId: string, name: string) => Promise<void>
  onArchiveBranch: (branchId: string) => Promise<void>
  onCreateTeam: (name: string) => Promise<void>
  onUpdateTeam: (teamId: string, name: string) => Promise<void>
  onArchiveTeam: (teamId: string) => Promise<void>
}) {
  const { locale, t } = useLocale()
  const [directoryQuery, setDirectoryQuery] = useState('')
  const directoryOptions = [
    ...lookupKindOptions.map((kind) => ({
      id: kind,
      label: getLookupKindLabel(kind, locale),
      count: lookupValues.filter((value) => value.kind === kind && !value.archived).length,
    })),
    { id: 'branches' as const, label: t('admin.branchManagement'), count: branches.length },
    { id: 'teams' as const, label: t('admin.teamManagement'), count: teams.length },
  ]
  const activeOption = directoryOptions.find((option) => option.id === activeDirectory) ?? directoryOptions[0]
  const query = directoryQuery.trim().toLowerCase()
  const activeItems =
    activeDirectory === 'branches'
      ? branches.map((branch) => ({
          id: branch.id,
          name: branch.name,
          meta: t('admin.branch'),
          locked: teams.some((team) => team.branchId === branch.id),
        }))
      : activeDirectory === 'teams'
        ? teams.map((team) => ({
            id: team.id,
            name: team.name,
            meta: t('admin.teamMemberCount', { count: formatCount(locale, userCounts[team.id] ?? 0) }),
            locked: (userCounts[team.id] ?? 0) > 0,
          }))
        : lookupValues
            .filter((value) => value.kind === activeDirectory && !value.archived)
            .map((value) => ({
              id: value.id,
              name: value.label,
              meta: getLookupKindLabel(value.kind, locale),
              locked: false,
            }))
  const visibleItems = activeItems
    .filter((item) => query.length === 0 || item.name.toLowerCase().includes(query) || item.meta.toLowerCase().includes(query))
    .sort((first, second) => compareText(locale, first.name, second.name))
  const createConfig =
    activeDirectory === 'branches'
      ? {
          label: t('admin.branchName'),
          name: 'branchName',
          placeholder: t('admin.branchNamePlaceholder'),
          buttonLabel: t('admin.addBranch'),
          onCreate: onCreateBranch,
        }
      : activeDirectory === 'teams'
        ? {
            label: t('admin.teamName'),
            name: 'teamName',
            placeholder: t('admin.teamNamePlaceholder'),
            buttonLabel: t('admin.addTeam'),
            onCreate: onCreateTeam,
          }
        : {
            label: t('admin.lookupLabel'),
            name: 'lookupLabel',
            placeholder: t('admin.lookupLabelPlaceholder'),
            buttonLabel: t('admin.addLookupValue'),
            onCreate: (label: string) => onCreateLookupValue(activeDirectory, label),
          }
  const updateDirectoryItem =
    activeDirectory === 'branches'
      ? onUpdateBranch
      : activeDirectory === 'teams'
        ? onUpdateTeam
        : onUpdateLookupValue
  const archiveDirectoryItem =
    activeDirectory === 'branches'
      ? onArchiveBranch
      : activeDirectory === 'teams'
        ? onArchiveTeam
        : onArchiveLookupValue

  return (
    <section className="content-card admin-panel motion-stage motion-subtle" style={motionStyle(1)}>
      <div className="admin-user-header">
        <div>
          <p className="eyebrow">{t('admin.masterDataEyebrow')}</p>
          <h2><Building2 size={19} /> {t('admin.masterData')}</h2>
          <p>{t('admin.masterDataCopy')}</p>
        </div>
      </div>

      <div className="master-data-workspace">
        <nav className="master-data-rail" aria-label={t('admin.masterData')}>
          {directoryOptions.map((option) => (
            <button
              key={option.id}
              className={`master-data-tab ${option.id === activeDirectory ? 'active' : ''}`}
              type="button"
              aria-current={option.id === activeDirectory ? 'page' : undefined}
              onClick={() => {
                onDirectoryChange(option.id)
                setDirectoryQuery('')
              }}
            >
              <span>{option.label}</span>
              <strong>{formatCount(locale, option.count)}</strong>
            </button>
          ))}
        </nav>

        <div className="master-data-detail">
          <div className="master-data-toolbar">
            <div>
              <p className="eyebrow">{t('admin.selectedDirectory')}</p>
              <h3>{activeOption.label}</h3>
            </div>
            <label className="master-data-search">
              {t('admin.searchMasterData')}
              <input
                value={directoryQuery}
                onChange={(event) => setDirectoryQuery(event.target.value)}
                placeholder={t('admin.searchMasterDataPlaceholder')}
                dir="auto"
              />
            </label>
          </div>

          <DirectoryCreateForm {...createConfig} />
          <DirectoryList
            title={activeOption.label}
            emptyTitle={t('admin.noLookupValuesTitle')}
            emptyBody={t('admin.noLookupValuesBody')}
            items={visibleItems}
            onUpdate={updateDirectoryItem}
            onArchive={archiveDirectoryItem}
          />
        </div>
      </div>
    </section>
  )
}

function DirectoryCreateForm({
  label,
  name,
  placeholder,
  buttonLabel,
  extraControl,
  onCreate,
}: {
  label: string
  name: string
  placeholder: string
  buttonLabel: string
  extraControl?: ReactNode
  onCreate: (value: string) => Promise<void>
}) {
  const { t } = useLocale()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  return (
    <form
      className="settings-form create-user-panel"
      onSubmit={async (event) => {
        event.preventDefault()
        const form = event.currentTarget
        const value = String(new FormData(form).get(name) ?? '').trim()
        setError('')
        if (!value) {
          setError(t('admin.valueRequired'))
          return
        }
        try {
          setPending(true)
          await onCreate(value)
          form.reset()
        } catch (createError) {
          setError(createError instanceof Error ? createError.message : t('admin.valueSaveFailed'))
        } finally {
          setPending(false)
        }
      }}
    >
      {extraControl}
      <label>
        {label}
        <input name={name} required placeholder={placeholder} dir="auto" />
      </label>
      {error && <p className="form-error">{error}</p>}
      <button className="secondary-button" type="submit" disabled={pending}>{pending ? t('common.saving') : buttonLabel}</button>
    </form>
  )
}

function DirectoryList({
  title,
  emptyTitle,
  emptyBody,
  items,
  onUpdate,
  onArchive,
}: {
  title: string
  emptyTitle: string
  emptyBody: string
  items: Array<{ id: string; name: string; meta: string; locked: boolean }>
  onUpdate: (id: string, name: string) => Promise<void>
  onArchive: (id: string) => Promise<void>
}) {
  const { t } = useLocale()
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <div className="user-management-list" aria-label={title}>
      <h3>{title}</h3>
      {items.map((item, index) => (
        <DirectoryCard
          key={item.id}
          item={item}
          index={index}
          isEditing={editingId === item.id}
          onEdit={() => setEditingId(item.id)}
          onCancel={() => setEditingId(null)}
          onSave={async (name) => {
            await onUpdate(item.id, name)
            setEditingId(null)
          }}
          onArchive={() => onArchive(item.id)}
        />
      ))}
      {items.length === 0 && <EmptyState title={emptyTitle} body={emptyBody} />}
      {items.some((item) => item.locked) && <small>{t('admin.archiveLockedHint')}</small>}
    </div>
  )
}

function DirectoryCard({
  item,
  index,
  isEditing,
  onEdit,
  onCancel,
  onSave,
  onArchive,
}: {
  item: { id: string; name: string; meta: string; locked: boolean }
  index: number
  isEditing: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: (name: string) => Promise<void>
  onArchive: () => Promise<void>
}) {
  const { t } = useLocale()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  return (
    <article className="user-management-card motion-stage active" style={motionStyle(index)}>
      <div className="user-management-main">
        <div>
          <strong>{item.name}</strong>
          <span>{item.meta}</span>
        </div>
      </div>
      {!isEditing && (
        <div className="user-card-actions">
          <button className="secondary-button" type="button" onClick={onEdit} disabled={pending}>{t('common.edit')}</button>
          <button className="danger-button" type="button" onClick={async () => {
            setPending(true)
            try {
              await onArchive()
            } finally {
              setPending(false)
            }
          }} disabled={pending || item.locked}>{pending ? t('common.saving') : t('common.archive')}</button>
        </div>
      )}
      {isEditing && (
        <form
          className="user-edit-form motion-stage"
          style={motionStyle(0, 80)}
          onSubmit={async (event) => {
            event.preventDefault()
            const name = String(new FormData(event.currentTarget).get('name') ?? '').trim()
            setError('')
            if (!name) {
              setError(t('admin.valueRequired'))
              return
            }
            try {
              setPending(true)
              await onSave(name)
            } catch (saveError) {
              setError(saveError instanceof Error ? saveError.message : t('admin.valueSaveFailed'))
            } finally {
              setPending(false)
            }
          }}
        >
          <label>
            {t('admin.valueName')}
            <input name="name" required defaultValue={item.name} dir="auto" />
          </label>
          {error && <p className="form-error">{error}</p>}
          <div className="user-edit-actions">
            <button className="secondary-button" type="button" onClick={onCancel} disabled={pending}>{t('common.cancel')}</button>
            <button className="secondary-button" type="submit" disabled={pending}>{pending ? t('common.saving') : t('common.save')}</button>
          </div>
        </form>
      )}
    </article>
  )
}

function UserManagementCard({
  user,
  index = 0,
  isEditing,
  onEdit,
  onCancel,
  onSave,
  onPasswordUpdate,
  teamOptions,
  branchOptions,
  salesReplacementOptions,
  onDeleteSalesRepresentative,
  onDeleteManagedUser,
}: {
  user: LeadraUser
  index?: number
  isEditing: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: (updates: Partial<LeadraUser>) => Promise<void>
  onPasswordUpdate: (password: string) => Promise<void>
  teamOptions: BrandedSelectOption[]
  branchOptions: BrandedSelectOption[]
  salesReplacementOptions: LeadraUser[]
  onDeleteSalesRepresentative: (replacementSalesUserId: string) => Promise<void>
  onDeleteManagedUser: () => Promise<void>
}) {
  const { locale, t } = useLocale()
  const [passwordEditorOpen, setPasswordEditorOpen] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [savePending, setSavePending] = useState(false)
  const [deleteEditorOpen, setDeleteEditorOpen] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [deletePending, setDeletePending] = useState(false)
  const [replacementSalesUserId, setReplacementSalesUserId] = useState(salesReplacementOptions[0]?.id ?? '')
  const canDeleteManagedUser = user.role !== 'admin' && user.status === 'active' && !user.deletedAt

  return (
    <article className={`user-management-card motion-stage ${user.status}`} style={motionStyle(index)}>
      <div className="user-card-main">
        <div className="user-avatar">{getUserInitials(user.fullName)}</div>
        <div>
          <div className="user-card-title">
            <strong>{user.fullName}</strong>
            <span className={`status-pill ${user.status === 'active' ? 'available' : 'sold'}`}>{getAccountStatusLabel(locale, user.status)}</span>
          </div>
          <p>{user.jobTitle}</p>
          <small dir="auto">{user.email} / {user.phoneNumber}</small>
        </div>
      </div>

      <div className="user-card-meta">
        <span>{getRoleLabel(locale, user.role)}</span>
        <span>{user.teamId}</span>
        <span>{user.branchId}</span>
        <span>{user.lastLoginAt ? t('common.lastLogin', { date: formatDate(locale, user.lastLoginAt) }) : t('common.noLoginYet')}</span>
      </div>

      {!isEditing && (
        <div className="user-card-actions">
          <button className="secondary-button" type="button" onClick={onEdit}>
            {t('admin.editUser')}
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              setPasswordError('')
              setPasswordEditorOpen((open) => !open)
            }}
          >
            {passwordEditorOpen ? t('admin.closePassword') : t('admin.setPassword')}
          </button>
          {canDeleteManagedUser && (
            <button
              className="danger-button"
              type="button"
              aria-label={t('admin.deleteUserFor', { name: user.fullName })}
              onClick={() => {
                setDeleteError('')
                setReplacementSalesUserId(salesReplacementOptions[0]?.id ?? '')
                setDeleteEditorOpen((open) => !open)
              }}
            >
              {deleteEditorOpen ? t('common.cancel') : t('admin.deleteUser')}
            </button>
          )}
        </div>
      )}

      {isEditing && (
        <form
          className="user-edit-form motion-stage"
          style={motionStyle(0, 90)}
          onSubmit={async (event) => {
            event.preventDefault()
            setSaveError('')
            const formData = new FormData(event.currentTarget)
            setSavePending(true)
            try {
              await onSave({
                fullName: String(formData.get('fullName')),
                email: String(formData.get('email')),
                role: String(formData.get('role')) as LeadraUser['role'],
                jobTitle: String(formData.get('jobTitle')),
                phoneNumber: String(formData.get('phoneNumber')),
                teamId: String(formData.get('teamId')),
                branchId: String(formData.get('branchId') ?? ''),
                status: String(formData.get('status')) as LeadraUser['status'],
              })
            } catch (error) {
              setSaveError(error instanceof Error ? error.message : t('admin.userUpdateFailed'))
            } finally {
              setSavePending(false)
            }
          }}
        >
          <label>
            {t('admin.fullName')}
            <input name="fullName" defaultValue={user.fullName} required dir="auto" />
          </label>
          <label>
            {t('admin.email')}
            <input name="email" type="email" defaultValue={user.email} required dir="auto" />
          </label>
          <NamedSelectField
            defaultValue={user.role}
            label={t('admin.role')}
            name="role"
            options={[
              { value: 'admin', label: getRoleLabel(locale, 'admin') },
              { value: 'sub_admin', label: getRoleLabel(locale, 'sub_admin') },
              { value: 'manager', label: getRoleLabel(locale, 'manager') },
              { value: 'sales', label: getRoleLabel(locale, 'sales') },
            ]}
          />
          <NamedSelectField
            defaultValue={user.status}
            label={t('admin.status')}
            name="status"
            options={[
              { value: 'active', label: t('admin.statusActive') },
              { value: 'inactive', label: t('admin.statusInactive') },
            ]}
          />
          <label>
            {t('admin.jobTitle')}
            <input name="jobTitle" defaultValue={user.jobTitle} required dir="auto" />
          </label>
          <label>
            {t('profile.phone')}
            <input name="phoneNumber" defaultValue={user.phoneNumber} required dir="auto" />
          </label>
          <NamedSelectField
            defaultValue={user.teamId}
            label={t('admin.team')}
            name="teamId"
            options={teamOptions}
          />
          <NamedSelectField
            defaultValue={user.branchId}
            label={t('admin.branch')}
            name="branchId"
            options={branchOptions}
          />
          {saveError && <p className="form-error">{saveError}</p>}
          <div className="user-edit-actions">
            <button className="secondary-button" type="button" onClick={onCancel} disabled={savePending}>{t('common.cancel')}</button>
            <button className="primary-button" type="submit" disabled={savePending}>
              {savePending ? t('common.saving') : t('admin.saveUser')}
            </button>
          </div>
        </form>
      )}

      {deleteEditorOpen && !isEditing && canDeleteManagedUser && (
        <form
          className="user-password-form motion-stage"
          style={motionStyle(0, 90)}
          onSubmit={async (event) => {
            event.preventDefault()
            setDeleteError('')
            if (user.role === 'sales' && !replacementSalesUserId) {
              setDeleteError(t('admin.selectReplacementSalesRep'))
              return
            }

            setDeletePending(true)
            try {
              if (user.role === 'sales') {
                await onDeleteSalesRepresentative(replacementSalesUserId)
              } else {
                await onDeleteManagedUser()
              }
              setDeleteEditorOpen(false)
            } catch (error) {
              setDeleteError(error instanceof Error ? error.message : t('admin.deleteUserFailed'))
            } finally {
              setDeletePending(false)
            }
          }}
        >
          <div className="password-form-copy">
            <strong>
              {user.role === 'sales'
                ? t('admin.reassignBeforeDelete', { name: user.fullName })
                : t('admin.deleteUserConfirmTitle', { name: user.fullName })}
            </strong>
            <small>{user.role === 'sales' ? t('admin.reassignBeforeDeleteCopy') : t('admin.deleteUserConfirmCopy')}</small>
          </div>
          {user.role === 'sales' && (
            <ControlledSelectField
              label={t('admin.replacementSalesRep')}
              options={salesReplacementOptions.map((item) => ({ value: item.id, label: item.fullName }))}
              value={replacementSalesUserId}
              disabled={deletePending || salesReplacementOptions.length === 0}
              onValueChange={setReplacementSalesUserId}
            />
          )}
          {user.role === 'sales' && salesReplacementOptions.length === 0 && <p className="form-error">{t('admin.noReplacementSalesRep')}</p>}
          {deleteError && <p className="form-error">{deleteError}</p>}
          <div className="user-edit-actions">
            <button className="secondary-button" type="button" onClick={() => setDeleteEditorOpen(false)} disabled={deletePending}>
              {t('common.cancel')}
            </button>
            <button className="danger-button" type="submit" disabled={deletePending || (user.role === 'sales' && salesReplacementOptions.length === 0)}>
              {deletePending ? t('common.saving') : user.role === 'sales' ? t('admin.confirmDeleteSalesRep') : t('admin.confirmDeleteUser')}
            </button>
          </div>
        </form>
      )}

      {passwordEditorOpen && !isEditing && (
        <form
          className="user-password-form motion-stage"
          style={motionStyle(0, 90)}
          onSubmit={async (event) => {
            event.preventDefault()
            setPasswordError('')
            const form = event.currentTarget
            const formData = new FormData(form)
            const password = String(formData.get('password') ?? '')
            const confirmPassword = String(formData.get('confirmPassword') ?? '')

            if (password.length < 8) {
              setPasswordError(t('admin.passwordTooShort'))
              return
            }

            if (password !== confirmPassword) {
              setPasswordError(t('admin.passwordMismatch'))
              return
            }

            setPasswordSaving(true)
            try {
              await onPasswordUpdate(password)
              form.reset()
              setPasswordEditorOpen(false)
            } catch (error) {
              setPasswordError(error instanceof Error ? error.message : t('admin.passwordUpdateFailed'))
            } finally {
              setPasswordSaving(false)
            }
          }}
        >
          <div className="password-form-copy">
            <strong>{t('admin.setPasswordFor', { name: user.fullName })}</strong>
            <small>{t('admin.passwordCopy')}</small>
          </div>
          <PasswordField label={t('admin.newPassword')} name="password" required minLength={8} autoComplete="new-password" />
          <PasswordField label={t('admin.confirmPassword')} name="confirmPassword" required minLength={8} autoComplete="new-password" />
          {passwordError && <p className="form-error">{passwordError}</p>}
          <div className="user-edit-actions">
            <button className="secondary-button" type="button" onClick={() => setPasswordEditorOpen(false)} disabled={passwordSaving}>
              {t('common.cancel')}
            </button>
            <button className="primary-button" type="submit" disabled={passwordSaving}>
              {passwordSaving ? t('common.saving') : t('admin.updatePassword')}
            </button>
          </div>
        </form>
      )}
    </article>
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

function fileToMedia(file: File): Promise<LeadraMediaFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve({
        id: `media-${Date.now()}-${file.name}`,
        type: 'image',
        url: String(reader.result),
        name: file.name,
        sizeBytes: file.size,
        includeInPdf: true,
      })
    }
    reader.onerror = () => reject(new Error('Unable to read image file.'))
    reader.readAsDataURL(file)
  })
}

type BrandedSelectOption = {
  value: string
  label: string
}

function BrandedSelect({
  labelId,
  name,
  options,
  value,
  defaultValue,
  disabled = false,
  onValueChange,
}: {
  labelId: string
  name?: string
  options: BrandedSelectOption[]
  value?: string
  defaultValue?: string
  disabled?: boolean
  onValueChange?: (value: string) => void
}) {
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const isControlled = value !== undefined
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})
  const [internalValue, setInternalValue] = useState(defaultValue ?? options[0]?.value ?? '')
  const selectedValue = isControlled ? value ?? options[0]?.value ?? '' : internalValue
  const selectedOption = options.find((option) => option.value === selectedValue) ?? options[0]

  useEffect(() => {
    if (!open) return undefined
    const rootElement = document.documentElement

    function syncMenuPosition() {
      const root = rootRef.current
      if (!root) return

      const rect = root.getBoundingClientRect()
      const gap = 8
      const viewportPadding = 12
      const estimatedHeight = Math.min(320, Math.max(64, options.length * 50 + 18))
      const availableBelow = window.innerHeight - rect.bottom - viewportPadding
      const maxHeight = Math.max(120, Math.min(estimatedHeight, availableBelow - gap))
      const left = Math.min(Math.max(viewportPadding, rect.left), window.innerWidth - rect.width - viewportPadding)
      const top = rect.bottom + gap

      setMenuStyle({
        position: 'fixed',
        top,
        bottom: 'auto',
        left,
        width: rect.width,
        maxHeight,
      })
    }

    function makeRoomForMenu() {
      const root = rootRef.current
      if (!root) return

      const rect = root.getBoundingClientRect()
      const gap = 8
      const viewportPadding = 12
      const estimatedHeight = Math.min(320, Math.max(64, options.length * 50 + 18))
      const availableBelow = window.innerHeight - rect.bottom - viewportPadding
      const neededSpace = Math.max(0, estimatedHeight - availableBelow + gap)

      rootElement.style.setProperty('--brand-select-page-bottom-space', `${neededSpace + 24}px`)

      if (neededSpace > 0) {
        window.scrollBy({ top: neededSpace, behavior: 'auto' })
      }

      window.requestAnimationFrame(syncMenuPosition)
    }

    makeRoomForMenu()

    function handlePointer(event: MouseEvent) {
      const target = event.target as Node
      if (
        rootRef.current &&
        !rootRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointer)
    window.addEventListener('keydown', handleEscape)
    window.addEventListener('resize', syncMenuPosition)
    window.addEventListener('scroll', syncMenuPosition, true)
    return () => {
      window.removeEventListener('mousedown', handlePointer)
      window.removeEventListener('keydown', handleEscape)
      window.removeEventListener('resize', syncMenuPosition)
      window.removeEventListener('scroll', syncMenuPosition, true)
      rootElement.style.removeProperty('--brand-select-page-bottom-space')
    }
  }, [open, options.length])

  useEffect(() => {
    if (!open) return
    window.requestAnimationFrame(() => {
      if (typeof rootRef.current?.scrollIntoView === 'function') {
        rootRef.current.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
      }
    })
  }, [open])

  function choose(nextValue: string) {
    if (!isControlled) {
      setInternalValue(nextValue)
    }
    onValueChange?.(nextValue)
    setOpen(false)
  }

  return (
    <div className={`brand-select ${open ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''}`} ref={rootRef}>
      {name && <input name={name} type="hidden" value={selectedOption?.value ?? ''} />}
      <button
        aria-controls={menuId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-labelledby={labelId}
        className="brand-select-trigger"
        disabled={disabled}
        role="combobox"
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="brand-select-value">{selectedOption?.label ?? ''}</span>
        <ChevronDown size={18} />
      </button>
      {open &&
        createPortal(
          <div
            aria-labelledby={labelId}
            className="brand-select-menu brand-select-portal-menu"
            id={menuId}
            ref={menuRef}
            role="listbox"
            style={menuStyle}
          >
            {options.map((option) => {
              const active = option.value === selectedValue
              return (
                <button
                  key={option.value}
                  aria-selected={active}
                  className={`brand-select-option ${active ? 'is-active' : ''}`}
                  role="option"
                  type="button"
                  onClick={() => choose(option.value)}
                >
                  <span>{option.label}</span>
                  {active && <Check size={16} />}
                </button>
              )
            })}
          </div>,
          document.body,
        )}
    </div>
  )
}

function RequiredLabel({ label, required = false }: { label: string; required?: boolean }) {
  return (
    <span className="required-label-text">
      {label}
      {required && <span className="required-marker" aria-hidden="true"> *</span>}
    </span>
  )
}

function SelectField({ name, label, values, required = false }: { name: string; label: string; values: { id: string; label: string }[]; required?: boolean }) {
  const labelId = useId()
  return (
    <label>
      <span id={labelId}><RequiredLabel label={label} required={required} /></span>
      <BrandedSelect
        defaultValue={values[0]?.id}
        labelId={labelId}
        name={name}
        options={values.map((item) => ({ value: item.id, label: item.label }))}
      />
    </label>
  )
}

function ControlledSelectField({
  label,
  options,
  value,
  disabled = false,
  className,
  required = false,
  onValueChange,
}: {
  label: string
  options: BrandedSelectOption[]
  value: string
  disabled?: boolean
  className?: string
  required?: boolean
  onValueChange: (value: string) => void
}) {
  const labelId = useId()
  return (
    <label className={className}>
      <span id={labelId}><RequiredLabel label={label} required={required} /></span>
      <BrandedSelect
        disabled={disabled}
        labelId={labelId}
        options={options}
        value={value}
        onValueChange={onValueChange}
      />
    </label>
  )
}

function NamedSelectField({
  name,
  label,
  options,
  value,
  defaultValue,
  required = false,
  onValueChange,
}: {
  name: string
  label: string
  options: BrandedSelectOption[]
  value?: string
  defaultValue?: string
  required?: boolean
  onValueChange?: (value: string) => void
}) {
  const labelId = useId()
  return (
    <label>
      <span id={labelId}><RequiredLabel label={label} required={required} /></span>
      <BrandedSelect defaultValue={defaultValue} labelId={labelId} name={name} options={options} value={value} onValueChange={onValueChange} />
    </label>
  )
}

function OwnerPhoneField({
  countryCode,
  countryOptions,
  hint,
  ownerPhone,
  placeholder,
  onCountryCodeChange,
  onOwnerPhoneChange,
}: {
  countryCode: string
  countryOptions: Array<BrandedSelectOption & { placeholder?: string }>
  hint: string
  ownerPhone: string
  placeholder: string
  onCountryCodeChange: (value: string) => void
  onOwnerPhoneChange: (value: string) => void
}) {
  const { t } = useLocale()
  const phoneLabelId = useId()
  const countryLabelId = useId()
  const hintId = useId()

  return (
    <div className="owner-phone-field">
      <span className="owner-phone-label" id={phoneLabelId}><RequiredLabel label={t('create.ownerPhone')} required /></span>
      <div className="owner-phone-shell" role="group" aria-labelledby={phoneLabelId}>
        <div className="owner-phone-country">
          <span className="sr-only" id={countryLabelId}>{t('create.countryCode')}</span>
          <BrandedSelect
            labelId={countryLabelId}
            name="countryCode"
            options={countryOptions}
            value={countryCode}
            onValueChange={onCountryCodeChange}
          />
        </div>
        <input
          aria-describedby={hintId}
          aria-labelledby={phoneLabelId}
          autoComplete="tel-national"
          dir="auto"
          inputMode="tel"
          name="ownerPhone"
          placeholder={placeholder}
          required
          value={ownerPhone}
          onChange={(event) => onOwnerPhoneChange(event.target.value)}
        />
      </div>
      <small className="sr-only" id={hintId}>{hint}</small>
    </div>
  )
}

function NumberField({ name, label, defaultValue, min, max, required = false }: { name: string; label: string; defaultValue: number; min?: number; max?: number; required?: boolean }) {
  return (
    <label>
      <RequiredLabel label={label} required={required} />
      <input name={name} type="number" defaultValue={defaultValue} min={min} max={max} required={required} />
    </label>
  )
}

function InfoSection({ title, rows, style }: { title: string; rows: [string, string | number | null][]; style?: CSSProperties }) {
  const { t } = useLocale()
  return (
    <section className="content-card motion-stage" style={style}>
      <h2>{title}</h2>
      <dl className="info-grid">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd dir="auto">{value ?? t('common.notSet')}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function InfoPanel({ title, rows }: { title: string; rows: [string, string | number | null][] }) {
  const { t } = useLocale()
  return (
    <section className="details-info-panel">
      <h3>{title}</h3>
      <dl className="info-grid">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd dir="auto">{value ?? t('common.notSet')}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function Metric({ label, value, style }: { label: string; value: string | number; style?: CSSProperties }) {
  return (
    <div className="metric-card motion-stage" style={style}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  )
}

function MiniBar({ label, value, total, suffix = '' }: { label: string; value: number; total: number; suffix?: string }) {
  const { locale } = useLocale()
  const width = total <= 0 ? 0 : Math.min(100, Math.round((value / total) * 100))

  return (
    <div className="mini-bar">
      <div>
        <span>{label}</span>
        <strong>{formatCount(locale, value)}{suffix}</strong>
      </div>
      <div className="mini-bar-track">
        <span style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}

function NavButton({
  active,
  label,
  onClick,
  to,
  icon,
  className = '',
  style,
}: {
  active: boolean
  label: string
  onClick?: () => void
  to?: string
  icon: ReactNode
  className?: string
  style?: CSSProperties
}) {
  const classNameValue = `nav-button ${active ? 'active' : ''} ${className}`.trim()
  if (to) {
    return (
      <Link className={classNameValue} style={style} to={to} onClick={onClick}>
        {icon}
        <span>{label}</span>
      </Link>
    )
  }

  return (
    <button className={classNameValue} type="button" style={style} onClick={onClick}>
      {icon}
      <span>{label}</span>
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

function translateCreateStep(step: (typeof createUnitSteps)[number], locale: LocaleCode) {
  if (step === 'Property') return translateForLocale(locale, 'create.property')
  if (step === 'Specs') return translateForLocale(locale, 'create.specs')
  if (step === 'Payment') return translateForLocale(locale, 'create.payment')
  if (step === 'Owner') return translateForLocale(locale, 'create.owner')
  return translateForLocale(locale, 'create.review')
}

function translateAdminSection(section: (typeof adminSections)[number], locale: LocaleCode) {
  if (section === 'Users') return translateForLocale(locale, 'admin.users')
  if (section === 'Master Data') return translateForLocale(locale, 'admin.masterData')
  if (section === 'Settings') return translateForLocale(locale, 'admin.settings')
  if (section === 'Metrics') return translateForLocale(locale, 'admin.metrics')
  return translateForLocale(locale, 'admin.audit')
}

function getLookupKindLabel(kind: LookupKind, locale: LocaleCode) {
  if (kind === 'developer') return translateForLocale(locale, 'admin.lookupDeveloper')
  if (kind === 'destination') return translateForLocale(locale, 'admin.lookupDestination')
  if (kind === 'project') return translateForLocale(locale, 'admin.lookupProject')
  if (kind === 'view') return translateForLocale(locale, 'admin.lookupView')
  if (kind === 'finish') return translateForLocale(locale, 'admin.lookupFinish')
  return translateForLocale(locale, 'admin.lookupUnitType')
}

function toLookupValue(row: Record<string, unknown>): LookupValue {
  return {
    id: String(row.id),
    kind: row.kind as LookupKind,
    label: String(row.label ?? ''),
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

function sortLabel(sortUsersBy: 'role' | 'name' | 'recent', locale: LocaleCode) {
  if (sortUsersBy === 'role') return translateForLocale(locale, 'admin.sortRole')
  if (sortUsersBy === 'name') return translateForLocale(locale, 'admin.sortName')
  return translateForLocale(locale, 'admin.sortRecent')
}

function translateForLocale(locale: LocaleCode, key: string, params?: MessageParams) {
  return translate(locale, key, params)
}

