import {
  ArrowRight,
  BarChart3,
  Bell,
  Building2,
  Download,
  FileText,
  Home,
  LogOut,
  Moon,
  MoreHorizontal,
  Plus,
  Settings,
  SlidersHorizontal,
  Sun,
  Users,
} from 'lucide-react'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { BrowserRouter, Link, useLocation, useNavigate } from 'react-router-dom'
import leadraLogoDark from './assets/brand/leadra-logo-dark.jpeg'
import leadraLogoLight from './assets/brand/leadra-logo-light.jpeg'
import leadraMarkDark from './assets/brand/leadra-mark-dark.png'
import leadraMarkLight from './assets/brand/leadra-mark-light.png'
import { demoUsers, initialAppState, lookupValues } from './data/seed'
import { buildPerformanceWorkspace } from './data/performanceSeed'
import { buildAnalyticsCsv, buildAnalyticsDashboard, canAccessAnalytics, defaultAnalyticsFilters } from './lib/analytics'
import {
  canEditOwnerFields,
  canEditUnitCommission,
  canEditUnitPricing,
  filterUnitsForUser,
  formatCurrency,
  isSoldStatus,
  summarizeDestinations,
  summarizeProjects,
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
import { LeadraRepository } from './lib/repository'
import { canUseDemoMode, isPerformanceDemoMode, isProductionMissingSupabaseConfig, isSupabaseConfigured, supabase } from './lib/supabase'
import { loadSupabaseAnalyticsDashboard, loadSupabaseAppState, loadSupabaseProfile, markSupabaseLogin, setSupabaseThemePreference } from './lib/supabaseState'
import { useTheme } from './lib/theme'
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
  updatePaymentScheduleWorkflow,
  updateSettingsWorkflow,
  updateUnitStatusWorkflow,
  updateUnitWorkflow,
} from './lib/workflows'
import { createAuditMessage, createFlashForStatus, createFlashMessage, createNotificationMessage } from './lib/systemMessages'
import { buildNotificationEmailPayloads, queueSalesInactivityWarnings, sendNotificationEmailBatch } from './lib/notificationDelivery'
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
  DestinationSummary,
  LeadraMediaFile,
  LeadraUnit,
  LeadraUser,
  LookupKind,
  LookupValue,
  MessageParams,
  NotificationItem,
  PaymentMethod,
  ProjectSummary,
  ThemePreference,
  InstallmentType,
  UnitEditInput,
  UnitFilters,
  UnitStatus,
} from './lib/types'
import { AdminPage } from './features/admin/AdminPage'
import { CreateUnitPage } from './features/create/CreateUnitPage'
import { UnitDetailsPage } from './features/details/UnitDetailsPage'
import { UnitListRow, UnitsPage } from './features/units/UnitsPage'
import { ControlledSelectField, EmptyState, InfoSection, Metric, MiniBar, NavButton, PasswordField } from './components/LeadraUi'
import { paymentMethodValues, supportsLookupThumbnail, unitStatusValues, type AdminSection, type CreateUnitStep, type MasterDataDirectory } from './features/shared/constants'
import { fileToDataUrl, removeLookupThumbnail, uploadLookupThumbnail } from './features/shared/media'
import { getUnitCustomInstallmentText, getUnitInstallmentEndMonth, getUnitInstallmentStartMonth, isAutomaticInstallmentType, parseOptionalFormDate, parseOptionalFormMonthDate, parseOptionalFormNumber, parseOptionalFormText } from './features/shared/formUtils'
import { motionStyle } from './features/shared/motion'

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
type PdfActionKind = 'pdf_generated' | 'pdf_downloaded' | 'pdf_shared'

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
const leadraBrandAssets: Record<ThemePreference, { logo: string; mark: string }> = {
  light: { logo: leadraLogoLight, mark: leadraMarkLight },
  dark: { logo: leadraLogoDark, mark: leadraMarkDark },
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
  const [batchPdfAction, setBatchPdfAction] = useState<'generate' | 'download' | 'share' | null>(null)
  const [selectedBatchUnitIds, setSelectedBatchUnitIds] = useState<number[]>([])
  const [updatingStatusUnitId, setUpdatingStatusUnitId] = useState<number | null>(null)
  const [updatingPaymentScheduleId, setUpdatingPaymentScheduleId] = useState<string | null>(null)
  const [statusActionFeedback, setStatusActionFeedback] = useState<{
    unitId: number
    status: UnitStatus
    state: 'saving' | 'saved'
  } | null>(null)
  const [removingMediaId, setRemovingMediaId] = useState<string | null>(null)
  const [downloadingMediaId, setDownloadingMediaId] = useState<string | null>(null)
  const [generatedPdfs, setGeneratedPdfs] = useState<Record<number, { blob: Blob; fileName: string }>>({})
  const completingAuthUserRef = useRef<string | null>(null)
  const emailDeliveryReadyRef = useRef(false)
  const emailedNotificationIdsRef = useRef<Set<string>>(new Set())
  const brandAssets = leadraBrandAssets[themePreference]

  function invalidateGeneratedPdf(unitId: number) {
    setGeneratedPdfs((items) => {
      if (!items[unitId]) return items
      const remaining = { ...items }
      delete remaining[unitId]
      return remaining
    })
  }

  async function recordPdfAction(unit: LeadraUnit, kind: PdfActionKind) {
    const notificationMessage = createNotificationMessage(kind, { unitCode: unit.unitCode })
    const auditMessage = createAuditMessage(kind, { unitCode: unit.unitCode })
    const createdAt = new Date().toISOString()
    const adminAudience = ['admin', 'sub_admin'] as const
    const notifications = adminAudience.map((role) => ({
      id: `notif-${kind}-${role}-${unit.id}-${createdAt}`,
      title: notificationMessage.title.text,
      body: notificationMessage.body.text,
      messageKey: notificationMessage.body.messageKey ?? null,
      messageParams: notificationMessage.body.messageParams ?? null,
      audienceRole: role,
      createdAt,
      read: false,
    }))
    setAppState((state) =>
      addAnalyticsEventWorkflow(
        {
          ...state,
          notifications: [
            ...notifications,
            ...state.notifications,
          ],
          auditLogs: [
            {
              id: `audit-${kind}-${unit.id}-${createdAt}`,
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
        },
        user,
        kind === 'pdf_generated' ? 'pdf_generated' : 'pdf_shared_or_downloaded',
        unit,
      ),
    )
    if (supabase && isSupabaseConfigured) {
      await new LeadraRepository(supabase).recordPdfAction(
        user,
        unit,
        kind === 'pdf_generated' ? 'pdf_generated' : 'pdf_shared_or_downloaded',
        auditMessage,
        notificationMessage,
        [...adminAudience],
      )
    }
  }

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

  useEffect(() => {
    if (currentUser?.themePreference) setThemePreference(currentUser.themePreference)
  }, [currentUser?.id, currentUser?.themePreference, setThemePreference])

  useEffect(() => {
    if (!currentUser) return
    const timeout = window.setTimeout(() => {
      setAppState((state) => queueSalesInactivityWarnings(state))
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [currentUser, appState.units.length, appState.users.length])

  useEffect(() => {
    if (!currentUser) {
      emailDeliveryReadyRef.current = false
      emailedNotificationIdsRef.current = new Set(appState.notifications.map((notification) => notification.id))
      return
    }

    const unseenNotifications = appState.notifications.filter((notification) => !emailedNotificationIdsRef.current.has(notification.id))
    if (!emailDeliveryReadyRef.current) {
      appState.notifications.forEach((notification) => emailedNotificationIdsRef.current.add(notification.id))
      emailDeliveryReadyRef.current = true
      return
    }
    if (unseenNotifications.length === 0) return

    unseenNotifications.forEach((notification) => emailedNotificationIdsRef.current.add(notification.id))
    if (!supabase || !isSupabaseConfigured) return

    const payloads = buildNotificationEmailPayloads(appState, unseenNotifications)
    if (payloads.length > 0) {
      void sendNotificationEmailBatch(supabase, payloads).catch((error) => {
        console.error('Notification email delivery failed', error)
      })
    }
  }, [currentUser, appState])

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
  const destinationSummaries = summarizeDestinationsWithLookups(visibleUnits, activeLookupValues, locale)
  const routeDestinationId = route.view === 'units' ? route.destinationId : null
  const routeProjectId = route.view === 'units' ? route.projectId : null
  const routeUnitId = route.view === 'details' ? route.unitId : null
  const activeSelectedDestinationId = routeDestinationId || unitFilters.destinationId || null
  const projectSummaries = summarizeProjectsWithLookups(visibleUnits, activeLookupValues, locale, activeSelectedDestinationId)
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
  const selectedBatchUnits = displayedUnits.filter((unit) => selectedBatchUnitIds.includes(unit.id))
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
      setSelectedBatchUnitIds([])
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
    const maintenancePaid = formData.get('maintenancePaid') === 'on'
    const installmentType = paymentMethod === 'installment' ? String(formData.get('installmentType')) as InstallmentType : null
    const installmentStartMonth = paymentMethod === 'installment' && isAutomaticInstallmentType(installmentType)
      ? parseOptionalFormMonthDate(formData, 'installmentStartMonth')
      : null
    const installmentEndMonth = paymentMethod === 'installment' && isAutomaticInstallmentType(installmentType)
      ? parseOptionalFormMonthDate(formData, 'installmentEndMonth')
      : null

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
      transferFees: parseOptionalFormNumber(formData, 'transferFees'),
      maintenancePaid,
      maintenanceCost: maintenancePaid ? parseOptionalFormNumber(formData, 'maintenanceCost') : null,
      maintenanceDueDate: maintenancePaid ? parseOptionalFormDate(formData, 'maintenanceDueDate') : null,
      installmentType,
      installmentStartMonth,
      installmentEndMonth,
      customInstallmentText: paymentMethod === 'installment' && installmentType === 'custom' ? parseOptionalFormText(formData, 'customInstallmentText') : null,
      installmentYears: null,
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
    const maintenancePaid = formData.get('maintenancePaid') === 'on'
    const submittedPaymentMethodValue = formData.get('paymentMethod')
    const submittedPaymentMethod = submittedPaymentMethodValue === 'cash' || submittedPaymentMethodValue === 'installment'
      ? submittedPaymentMethodValue
      : unit.paymentMethod
    const submittedInstallmentTypeValue = formData.get('installmentType')
    const submittedInstallmentType = submittedInstallmentTypeValue === 'quarterly' ||
      submittedInstallmentTypeValue === 'semi_annual' ||
      submittedInstallmentTypeValue === 'annual' ||
      submittedInstallmentTypeValue === 'custom'
      ? submittedInstallmentTypeValue
      : unit.installmentType
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
      paymentMethod: submittedPaymentMethod,
      downPayment: submittedPaymentMethod === 'installment' ? parseOptionalFormNumber(formData, 'downPayment') ?? unit.downPayment ?? 0 : null,
      deliveryExpectancy: {
        mode: 'year',
        year: Number(formData.get('deliveryYear')),
      },
      originalOwnerName: String(formData.get('ownerName') ?? unit.originalOwnerName ?? ''),
      countryCode: String(formData.get('countryCode') ?? unit.countryCode ?? '+20'),
      originalOwnerPhone: String(formData.get('ownerPhone') ?? unit.originalOwnerPhone ?? ''),
      salesNotes: String(formData.get('salesNotes') ?? unit.salesNotes),
      totalAmount: Number(formData.get('totalAmount')),
      transferFees: parseOptionalFormNumber(formData, 'transferFees'),
      maintenancePaid,
      maintenanceCost: maintenancePaid ? parseOptionalFormNumber(formData, 'maintenanceCost') : null,
      maintenanceDueDate: maintenancePaid ? parseOptionalFormDate(formData, 'maintenanceDueDate') : null,
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
          }
        : {}),
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

  async function updatePaymentSchedule(unit: LeadraUnit, scheduleId: string, paid: boolean) {
    if (updatingPaymentScheduleId) return
    const result = updatePaymentScheduleWorkflow(appState, user, unit.id, scheduleId, paid)
    if (!result.ok) {
      setFlash({ text: result.error, messageKey: result.errorKey ?? null, messageParams: result.errorParams ?? null })
      return
    }

    const previousState = appState
    const updatedUnit = result.state.units.find((item) => item.id === unit.id) ?? unit
    setUpdatingPaymentScheduleId(scheduleId)
    setAppState(result.state)
    setRemoteSearchUnits((items) => items?.map((item) => item.id === unit.id ? updatedUnit : item) ?? null)

    try {
      if (supabase && isSupabaseConfigured) {
        const remoteUnit = await new LeadraRepository(supabase).updatePaymentSchedule(unit.id, scheduleId, paid)
        setAppState((state) => ({
          ...state,
          units: state.units.map((item) => item.id === unit.id ? remoteUnit : item),
        }))
        setRemoteSearchUnits((items) => items?.map((item) => item.id === unit.id ? remoteUnit : item) ?? null)
      }
      invalidateGeneratedPdf(unit.id)
      setFlash({
        text: paid ? 'Payment marked paid and Remaining Value recalculated.' : 'Payment marked unpaid and Remaining Value recalculated.',
        messageKey: null,
        messageParams: null,
      })
    } catch (error) {
      setAppState(previousState)
      setRemoteSearchUnits((items) => items?.map((item) => item.id === unit.id ? unit : item) ?? null)
      setFlash({ text: `Payment timetable could not be saved: ${errorMessage(error)}`, messageKey: null, messageParams: null })
    } finally {
      setUpdatingPaymentScheduleId(null)
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
      setFlash({ text: 'PDF visibility could not be saved remotely. Please try again.', messageKey: null, messageParams: null })
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
      const generated = []
      for (const unit of selectedBatchUnits) {
        generated.push(generatedPdfs[unit.id] ?? await generatePdfFile(unit))
      }
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
      const generated = []
      for (const unit of selectedBatchUnits) {
        generated.push(generatedPdfs[unit.id] ?? await generatePdfFile(unit))
      }
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
      const generated = generatedPdfs[unit.id] ?? await generatePdfFile(unit)
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
      const generated = generatedPdfs[unit.id] ?? await generatePdfFile(unit)
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

  function updateUnitFilter<K extends keyof UnitFilters>(key: K, value: UnitFilters[K]) {
    const nextFilters = { ...unitFilters, [key]: value }
    setUnitFilters(nextFilters)
    setSelectedBatchUnitIds([])
    void loadRemoteUnitSearch(nextFilters)
  }

  function resetUnitFilters() {
    setUnitFilters({ status: 'all' })
    setRemoteSearchUnits(null)
    setSelectedBatchUnitIds([])
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

  async function handleThemePreferenceChange(nextThemePreference: ThemePreference) {
    const previousThemePreference = themePreference
    const previousUser = currentUser

    setThemePreference(nextThemePreference)
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
          <img src={brandAssets.mark} alt="Leadra" />
        </Link>
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
      </aside>

      <main className="main-panel">
        <header className={`topbar ${activeView === 'dashboard' ? 'dashboard-topbar' : 'compact-topbar'}`}>
          <div>
            <p className="eyebrow">{t('topbar.eyebrow')}</p>
            <h1>{getViewTitle(activeView, user, locale)}</h1>
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
              selectedUnitIds={selectedBatchUnitIds}
              batchAction={batchPdfAction}
              onDestinationSelect={(id) => {
                const nextFilters = { ...unitFilters, destinationId: undefined, projectId: undefined }
                setUnitFilters(nextFilters)
                setSelectedBatchUnitIds([])
                setRemoteSearchUnits(null)
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
              onDownloadPdf={() => downloadPdf(selectedUnit)}
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
              onPaymentScheduleChange={(scheduleId, paid) => updatePaymentSchedule(selectedUnit, scheduleId, paid)}
              onMediaPdfVisibilityChange={(mediaId, includeInPdf) => setUnitMediaPdfVisibility(selectedUnit.id, mediaId, includeInPdf)}
              onMediaDownload={downloadUnitMedia}
              removingMediaId={removingMediaId}
              downloadingMediaId={downloadingMediaId}
              updatingPaymentScheduleId={updatingPaymentScheduleId}
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
            <ProfilePage user={user} onThemePreferenceChange={handleThemePreferenceChange} />
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
                if (existingUser?.role === 'sales' && existingUser.status === 'active' && updates.status === 'inactive') {
                  throw new Error('Use Reassign and deactivate sales rep so assigned units move to another active sales representative.')
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
          <NavButton active={activeView === 'profile'} label={t('nav.profile')} to={pathForView('profile')} onClick={closeNavigation} icon={<SlidersHorizontal />} className="motion-stage" style={motionStyle(2)} />
          {canUseAdmin && (
            <NavButton active={activeView === 'admin'} label={t('nav.admin')} to={pathForView('admin')} onClick={closeNavigation} icon={<Settings />} className="motion-stage" style={motionStyle(3)} />
          )}
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
    ['Active listings', '248', 'Champagne metrics on rich black'],
    ['Qualified buyers', '1,420', 'Ivory text on dark slate'],
    ['Booked tours', '36', 'Gold accent states'],
  ]
  const sampleUnits = [
    ['Seaview Villa', 'Charcoal card / Ivory copy', 'Gold accent'],
    ['Ras El Hekma Chalet', 'Dark slate section / Champagne border', 'Navy CTA'],
    ['North Coast Residence', 'Rich black surface / Champagne status', 'Deep navy'],
  ]

  return (
    <section className="palette-sample page-entrance">
      <div className="palette-sample-hero motion-stage" style={motionStyle(0)}>
        <div>
          <p className="eyebrow">Leadra color sample</p>
          <h2>Dark luxury workspace</h2>
          <p>Sample page only. This version uses the primary dark identity from the reference: Onyx, Graphite, Charcoal, and Champagne Gold.</p>
        </div>
        <img className="palette-sample-logo" src={brandAssets.mark} alt="" aria-hidden="true" />
      </div>

      <div className="palette-swatch-grid motion-stage" style={motionStyle(1, 40)}>
        {[
          ['Rich Black', '#0D0D0F'],
          ['Champagne Gold', '#D6B06F'],
          ['Charcoal', '#17171A'],
          ['Dark Slate', '#1F1F23'],
          ['Warm Ivory', '#F6F1EA'],
          ['Deep Navy', '#0F1B2D'],
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

function summarizeDestinationsWithLookups(units: LeadraUnit[], lookups: LookupValue[], locale: LocaleCode): DestinationSummary[] {
  const summaries = new Map(summarizeDestinations(units, locale).map((summary) => [summary.destinationId, summary]))

  for (const lookup of lookups) {
    if (lookup.kind !== 'destination' || summaries.has(lookup.id)) continue
    summaries.set(lookup.id, {
      destinationId: lookup.id,
      destinationName: lookup.label,
      totalUnits: 0,
      availableUnits: 0,
      holdUnits: 0,
      soldUnits: 0,
    })
  }

  return Array.from(summaries.values()).sort((a, b) => compareText(locale, a.destinationName, b.destinationName))
}

function summarizeProjectsWithLookups(units: LeadraUnit[], lookups: LookupValue[], locale: LocaleCode, destinationId?: string | null): ProjectSummary[] {
  const summaries = new Map(summarizeProjects(units, locale, destinationId).map((summary) => [summary.projectId, summary]))

  for (const lookup of lookups) {
    if (lookup.kind !== 'project' || summaries.has(lookup.id)) continue
    summaries.set(lookup.id, {
      projectId: lookup.id,
      projectName: lookup.label,
      destinationId: destinationId ?? undefined,
      totalUnits: 0,
      availableUnits: 0,
      holdUnits: 0,
      soldUnits: 0,
    })
  }

  return Array.from(summaries.values()).sort((a, b) => compareText(locale, a.projectName, b.projectName))
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

function ProfilePage({ user, onThemePreferenceChange }: { user: LeadraUser; onThemePreferenceChange: (theme: ThemePreference) => void | Promise<void> }) {
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
  onThemeChange?: (theme: ThemePreference) => void | Promise<void>
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
      onClick={() => {
        setThemePreference(nextThemePreference)
        void onThemeChange?.(nextThemePreference)
      }}
    >
      <span className="theme-toggle-track" aria-hidden="true">
        <span className="theme-toggle-thumb">{nextThemePreference === 'dark' ? <Moon size={14} /> : <Sun size={14} />}</span>
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

