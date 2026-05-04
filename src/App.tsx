import {
  ArrowRight,
  Archive,
  BarChart3,
  Bell,
  Building2,
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
  SlidersHorizontal,
  Users,
} from 'lucide-react'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { demoUsers, initialAppState, lookupValues } from './data/seed'
import { buildAnalyticsCsv, buildAnalyticsDashboard, canAccessAnalytics, defaultAnalyticsFilters } from './lib/analytics'
import {
  canAddAdminManagerNote,
  canArchiveUnit,
  canSearchOwnerPhone,
  canViewOwnerData,
  filterUnitsForUser,
  formatCurrency,
  formatDeliveryExpectancy,
  getThumbnailMedia,
  summarizeProjects,
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
import { downloadUnitPdf } from './lib/pdf'
import { canUseDemoMode, isProductionMissingSupabaseConfig, isSupabaseConfigured, supabase } from './lib/supabase'
import { loadSupabaseAnalyticsDashboard, loadSupabaseAppState, loadSupabaseProfile, markSupabaseLogin } from './lib/supabaseState'
import {
  addAnalyticsEventWorkflow,
  archiveUnitWorkflow,
  createUnitWorkflow,
  createUserWorkflow,
  deleteUnitAdminNoteWorkflow,
  saveUnitAdminNoteWorkflow,
  updateSettingsWorkflow,
  updateUnitStatusWorkflow,
} from './lib/workflows'
import { createAuditMessage, createFlashForStatus, createFlashMessage, createNotificationMessage } from './lib/systemMessages'
import type {
  AnalyticsDashboard,
  AnalyticsChartPoint,
  AnalyticsDateWindow,
  AnalyticsFilters,
  AppDataState,
  AppSettings,
  AuditLogItem,
  LeadraMediaFile,
  LeadraUnit,
  LeadraUser,
  LookupValue,
  MessageParams,
  NotificationItem,
  PaymentMethod,
  UnitStatus,
} from './lib/types'

type View = 'dashboard' | 'units' | 'create' | 'details' | 'notifications' | 'profile' | 'analytics' | 'admin'
type HashView = Exclude<View, 'details'>

type TransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => unknown
}

function runPageTransition(update: () => void) {
  const startViewTransition = (document as TransitionDocument).startViewTransition

  if (!startViewTransition) {
    update()
    return
  }

  startViewTransition.call(document, () => {
    flushSync(update)
  })
}
type UiMessage = { message: string; messageKey?: string | null; messageParams?: MessageParams | null }

const createUnitSteps = ['Property', 'Specs', 'Payment', 'Owner', 'Review'] as const
const adminSections = ['Users', 'Settings', 'Metrics', 'Audit'] as const
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

function App() {
  const { locale, t } = useLocale()
  const [currentUser, setCurrentUser] = useState<LeadraUser | null>(null)
  const [view, setView] = useState<View>(() => readHashView())
  const [appState, setAppState] = useState(initialAppState)
  const [activeLookupValues, setActiveLookupValues] = useState<LookupValue[]>(lookupValues)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null)
  const [unitCodeFilter, setUnitCodeFilter] = useState('')
  const [ownerPhoneFilter, setOwnerPhoneFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<UnitStatus | 'all'>('all')
  const [flash, setFlash] = useState<LocalizedFlashMessage | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured)
  const [loginError, setLoginError] = useState<UiMessage | null>(null)

  async function completeSupabaseLogin(authUser: SupabaseUser) {
    if (!supabase) return
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
      const requestedView = readHashView()
      const nextView = isViewAllowedForUser(requestedView, profile) ? requestedView : 'dashboard'
      setView(nextView)
      if (nextView !== requestedView) writeHashView(nextView)
      setLoginError(null)
    } catch {
      setLoginError({
        message: 'Sign-in is temporarily unavailable. Contact your administrator.',
        messageKey: 'error.signInUnavailable',
        messageParams: null,
      })
    } finally {
      setAuthLoading(false)
    }
  }

  async function handleSupabasePasswordLogin(email: string, password: string) {
    if (!supabase) return
    setLoginError(null)
    setAuthLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setLoginError({ message: error.message, messageKey: null, messageParams: null })
      setAuthLoading(false)
      return
    }
    if (data.user) await completeSupabaseLogin(data.user)
  }

  useEffect(() => {
    function syncViewFromHash() {
      const requestedView = readHashView()
      runPageTransition(() => {
        setView(requestedView)
        setFlash(null)
      })
    }

    window.addEventListener('hashchange', syncViewFromHash)
    return () => window.removeEventListener('hashchange', syncViewFromHash)
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
        setAppState(initialAppState)
        setActiveLookupValues(lookupValues)
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
  }, [])

  if (!currentUser) {
    return (
      <LoginScreen
        authLoading={authLoading}
        loginError={loginError}
        onLogin={(nextUser) => {
          setCurrentUser(nextUser)
          const requestedView = readHashView()
          const nextView = isViewAllowedForUser(requestedView, nextUser) ? requestedView : 'dashboard'
          setView(nextView)
          if (nextView !== requestedView) writeHashView(nextView)
          setFlash(null)
        }}
        onPasswordLogin={handleSupabasePasswordLogin}
      />
    )
  }

  const user = currentUser
  const canUseAdmin = canAccessAdmin(user)
  const canUseAnalytics = canAccessAnalytics(user)
  const activeView = isViewAllowedForUser(view, user) ? view : 'dashboard'
  const visibleUnits = filterUnitsForUser(user, appState.units)
  const projectSummaries = summarizeProjects(visibleUnits, locale)
  const activeSelectedProjectId = selectedProjectId ?? projectSummaries[0]?.projectId ?? null
  const selectedUnit = appState.units.find((unit) => unit.id === selectedUnitId) ?? visibleUnits[0] ?? null
  const filteredUnits = searchUnits(user, appState.units, {
    projectId: activeSelectedProjectId ?? undefined,
    unitCode: unitCodeFilter,
    ownerPhone: ownerPhoneFilter,
    status: statusFilter,
  })
  const unreadCount = appState.notifications.filter(
    (notification) =>
      !notification.read &&
      (notification.userId === user.id || notification.audienceRole === user.role || (!notification.userId && !notification.audienceRole)),
  ).length

  function navigate(nextView: View) {
    runPageTransition(() => {
      setView(nextView)
      if (nextView !== 'details') {
        writeHashView(nextView)
      }
      setFlash(null)
      setMobileMenuOpen(false)
    })
  }

  function handleCreateUnit(event: FormEvent<HTMLFormElement>, uploadedMedia: LeadraMediaFile[]) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const paymentMethod = String(formData.get('paymentMethod')) as PaymentMethod
    const projectId = String(formData.get('projectId'))
    const destinationId = String(formData.get('destinationId'))
    const developerId = String(formData.get('developerId'))
    const viewId = String(formData.get('viewId'))
    const project = activeLookupValues.find((item) => item.id === projectId)
    const destination = activeLookupValues.find((item) => item.id === destinationId)
    const developer = activeLookupValues.find((item) => item.id === developerId)
    const viewLookup = activeLookupValues.find((item) => item.id === viewId)
    const result = createUnitWorkflow(appState, user, {
      developerId,
      developerName: developer?.label ?? 'Unknown developer',
      projectId,
      projectName: project?.label ?? 'Unknown project',
      destinationId,
      destinationName: destination?.label ?? 'Unknown destination',
      unitType: String(formData.get('unitType')),
      floor: String(formData.get('floor')),
      bua: Number(formData.get('bua')),
      roofGardenArea: Number(formData.get('roofGardenArea')) || null,
      viewId,
      viewName: viewLookup?.label ?? 'Open view',
      bedrooms: Number(formData.get('bedrooms')),
      bathrooms: Number(formData.get('bathrooms')),
      elevator: formData.get('elevator') === 'on',
      landArea: Number(formData.get('landArea')) || null,
      furnished: formData.get('furnished') === 'on',
      finish: String(formData.get('finish')),
      paymentMethod,
      totalAmount: Number(formData.get('totalAmount')),
      downPayment: paymentMethod === 'installment' ? Number(formData.get('downPayment')) : null,
      installmentType: paymentMethod === 'installment' ? 'quarterly' : null,
      installmentYears: paymentMethod === 'installment' ? Number(formData.get('installmentYears')) : null,
      deliveryExpectancy: {
        mode: 'month_year',
        month: Number(formData.get('deliveryMonth')),
        year: Number(formData.get('deliveryYear')),
      },
      originalOwnerName: String(formData.get('ownerName')),
      countryCode: String(formData.get('countryCode')),
      originalOwnerPhone: String(formData.get('ownerPhone')),
      salesNotes: String(formData.get('salesNotes')),
      media: uploadedMedia,
    })

    setAppState(result.state)
    if (!result.ok) {
      setFlash({
        text: result.error,
        messageKey: result.errorKey ?? null,
        messageParams: result.errorParams ?? null,
      })
      return
    }

    const newUnit = result.state.units[0]
    setFlash(createFlashMessage('flash.unitCreated', 'Unit created, notifications queued, and audit action recorded.'))
    runPageTransition(() => {
      setSelectedProjectId(newUnit.projectId)
      setSelectedUnitId(newUnit.id)
      setView('details')
    })
  }

  function updateUnitStatus(unit: LeadraUnit, status: UnitStatus) {
    const result = updateUnitStatusWorkflow(appState, user, unit.id, status)
    setAppState(result.state)
    if (!result.ok) {
      setFlash({ text: result.error, messageKey: result.errorKey ?? null, messageParams: result.errorParams ?? null })
      return
    }
    setFlash(createFlashForStatus(status))
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

  async function generatePdf(unit: LeadraUnit) {
    await downloadUnitPdf(user, unit, appState.settings, locale)
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
    setFlash(createFlashMessage('flash.exportGenerated', 'Printable brief opened. Use print or Save as PDF from the browser dialog.'))
  }

  return (
    <div className="app-shell">
      <aside className="side-rail" aria-label={t('nav.desktop')}>
        <div className="brand-mark">L</div>
        <NavButton active={activeView === 'dashboard'} label={t('nav.dashboard')} onClick={() => navigate('dashboard')} icon={<Home />} className="motion-stage" style={motionStyle(0)} />
        <NavButton active={activeView === 'units'} label={t('nav.units')} onClick={() => navigate('units')} icon={<Building2 />} className="motion-stage" style={motionStyle(1)} />
        <NavButton active={activeView === 'create'} label={t('nav.create')} onClick={() => navigate('create')} icon={<Plus />} className="motion-stage" style={motionStyle(2)} />
        <NavButton active={activeView === 'notifications'} label={t('nav.alerts', { count: unreadCount })} onClick={() => navigate('notifications')} icon={<Bell />} className="motion-stage" style={motionStyle(3)} />
        {canUseAnalytics && (
          <NavButton active={activeView === 'analytics'} label={t('nav.analytics')} onClick={() => navigate('analytics')} icon={<BarChart3 />} className="motion-stage" style={motionStyle(4)} />
        )}
        {canUseAdmin && (
          <NavButton active={activeView === 'admin'} label={t('nav.admin')} onClick={() => navigate('admin')} icon={<Settings />} className="motion-stage" style={motionStyle(5)} />
        )}
      </aside>

      <main className="main-panel">
        <header className={`topbar ${activeView !== 'dashboard' ? 'compact-topbar' : ''}`}>
          <div>
            <p className="eyebrow">{t('topbar.eyebrow')}</p>
            <h1>{getViewTitle(activeView, user, locale)}</h1>
          </div>
          <div className="topbar-actions">
            <button className="user-chip" type="button" onClick={() => navigate('profile')}>
              <span>{getUserInitials(user.fullName)}</span>
              <strong>{getRoleLabel(locale, user.role)}</strong>
            </button>
            <button
              className="ghost-button"
              type="button"
              aria-label={t('topbar.signOut')}
              onClick={() => {
                if (supabase) void supabase.auth.signOut()
                setCurrentUser(null)
                setView('dashboard')
                writeHashView('dashboard')
                setFlash(null)
              }}
            >
              <LogOut size={17} /> <span className="signout-label">{t('topbar.signOut')}</span>
            </button>
          </div>
        </header>

        {flash && <div className="flash motion-flash">{renderFlash(locale, flash)}</div>}

        {activeView === 'dashboard' && (
          <div className="page-transition-frame" key={activeView}>
            <Dashboard
              user={user}
              units={visibleUnits}
              notifications={appState.notifications}
              onNavigate={navigate}
              onOpenUnit={(unitId) => {
                runPageTransition(() => {
                  setSelectedUnitId(unitId)
                  setView('details')
                })
              }}
            />
          </div>
        )}
        {activeView === 'units' && (
          <div className="page-transition-frame" key={activeView}>
            <UnitsPage
              user={user}
              projects={projectSummaries}
              selectedProjectId={activeSelectedProjectId}
              units={filteredUnits}
              unitCodeFilter={unitCodeFilter}
              ownerPhoneFilter={ownerPhoneFilter}
              statusFilter={statusFilter}
              onProjectSelect={setSelectedProjectId}
              onUnitCodeFilter={setUnitCodeFilter}
              onOwnerPhoneFilter={setOwnerPhoneFilter}
              onStatusFilter={setStatusFilter}
              onOpenUnit={(id) => {
                runPageTransition(() => {
                  setSelectedUnitId(id)
                  setView('details')
                })
              }}
            />
          </div>
        )}
        {activeView === 'create' && (
          <div className="page-transition-frame" key={activeView}>
            <CreateUnitPage lookupValues={activeLookupValues} onSubmit={handleCreateUnit} settings={appState.settings} />
          </div>
        )}
        {activeView === 'details' && selectedUnit && (
          <div className="page-transition-frame" key={activeView}>
            <UnitDetailsPage
              key={`${selectedUnit.id}:${selectedUnit.updatedAt}`}
              user={user}
              unit={selectedUnit}
              onArchive={() => archiveUnit(selectedUnit)}
              onStatusChange={(status) => updateUnitStatus(selectedUnit, status)}
              onGeneratePdf={() => generatePdf(selectedUnit)}
              onSaveNote={(content) => saveSharedNote(selectedUnit, content)}
              onDeleteNote={() => deleteSharedNote(selectedUnit)}
            />
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
            <AnalyticsPage appState={appState} user={user} />
          </div>
        )}
        {activeView === 'admin' && canUseAdmin && (
          <div className="page-transition-frame" key={activeView}>
            <AdminPage
              users={appState.users}
              units={appState.units}
              settings={appState.settings}
              auditLogs={appState.auditLogs}
              lookupCount={activeLookupValues.length}
              onCreateUser={(formData) => {
                const result = createUserWorkflow(appState, user, {
                  fullName: String(formData.get('fullName')),
                  email: String(formData.get('email')),
                  role: String(formData.get('role')) as LeadraUser['role'],
                  jobTitle: String(formData.get('jobTitle')),
                  phoneNumber: String(formData.get('phoneNumber')),
                  teamId: String(formData.get('teamId')),
                  branchId: String(formData.get('branchId')),
                  status: 'active',
                })
                setAppState(result.state)
                setFlash(
                  result.ok
                    ? createFlashMessage('flash.userCreated', 'User created and audit history updated.')
                    : { text: result.error, messageKey: result.errorKey ?? null, messageParams: result.errorParams ?? null },
                )
              }}
              onUpdateUser={(userId, updates) => {
                const auditMessage = createAuditMessage('user_profile_updated')
                setAppState((state) => ({
                  ...state,
                  users: state.users.map((item) => (item.id === userId ? { ...item, ...updates } : item)),
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
                setFlash(createFlashMessage('flash.userUpdated', 'User profile updated and audit history updated.'))
              }}
              onSettingsUpdate={(commissionPercentage) => {
                const result = updateSettingsWorkflow(appState, user, { commissionPercentage })
                setAppState(result.state)
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
          <NavButton active={activeView === 'notifications'} label={t('nav.alerts', { count: unreadCount })} onClick={() => navigate('notifications')} icon={<Bell />} className="motion-stage" style={motionStyle(0)} />
          {canUseAnalytics && (
            <NavButton active={activeView === 'analytics'} label={t('nav.analytics')} onClick={() => navigate('analytics')} icon={<BarChart3 />} className="motion-stage" style={motionStyle(1)} />
          )}
          <NavButton active={activeView === 'profile'} label={t('nav.profile')} onClick={() => navigate('profile')} icon={<SlidersHorizontal />} className="motion-stage" style={motionStyle(2)} />
          {canUseAdmin && (
            <NavButton active={activeView === 'admin'} label={t('nav.admin')} onClick={() => navigate('admin')} icon={<Settings />} className="motion-stage" style={motionStyle(3)} />
          )}
        </div>
      )}

      <nav className="bottom-nav" aria-label={t('nav.mobile')}>
        <NavButton active={activeView === 'dashboard'} label={t('nav.home')} onClick={() => navigate('dashboard')} icon={<Home />} className="motion-stage" style={motionStyle(0)} />
        <NavButton active={activeView === 'units'} label={t('nav.units')} onClick={() => navigate('units')} icon={<Building2 />} className="motion-stage" style={motionStyle(1)} />
        <NavButton active={activeView === 'create'} label={t('nav.add')} onClick={() => navigate('create')} icon={<Plus />} className="motion-stage" style={motionStyle(2)} />
        <NavButton
          active={mobileMenuOpen || activeView === 'notifications' || activeView === 'analytics' || activeView === 'profile' || activeView === 'admin'}
          label={t('nav.more')}
          onClick={() => setMobileMenuOpen((open) => !open)}
          icon={<MoreHorizontal />}
          className="motion-stage"
          style={motionStyle(3)}
        />
      </nav>
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
                <label>
                  {t('login.password')}
                  <input name="password" type="password" autoComplete="current-password" required placeholder={t('login.passwordPlaceholder')} dir="auto" />
                </label>
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

function Dashboard({
  user,
  units,
  notifications,
  onNavigate,
  onOpenUnit,
}: {
  user: LeadraUser
  units: LeadraUnit[]
  notifications: NotificationItem[]
  onNavigate: (view: View) => void
  onOpenUnit: (unitId: number) => void
}) {
  const { locale, t } = useLocale()
  const latestUnits = units.slice(0, 3)
  const available = units.filter((unit) => unit.status === 'available').length
  const hold = units.filter((unit) => unit.status === 'hold').length
  const sold = units.filter((unit) => unit.status === 'sold').length

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
            href="#units"
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
        <Metric label={t('dashboard.visibleUnits')} value={formatCount(locale, units.length)} style={motionStyle(0, 120)} />
        <Metric label={getStatusLabel(locale, 'available')} value={formatCount(locale, available)} style={motionStyle(1, 150)} />
        <Metric label={getStatusLabel(locale, 'hold')} value={formatCount(locale, hold)} style={motionStyle(2, 180)} />
        <Metric label={getStatusLabel(locale, 'sold')} value={formatCount(locale, sold)} style={motionStyle(3, 210)} />
      </div>

      <section className="content-card motion-stage" style={motionStyle(2, 90)}>
        <h2>{t('dashboard.latestActivity')}</h2>
        {latestUnits.length === 0 && <EmptyState title={t('dashboard.noUnitsTitle')} body={t('dashboard.noUnitsBody')} />}
        {latestUnits.map((unit, index) => (
          <UnitListRow key={unit.id} user={user} unit={unit} index={index} onOpen={() => onOpenUnit(unit.id)} />
        ))}
      </section>

      <section className="content-card motion-stage" style={motionStyle(3, 130)}>
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

function UnitsPage({
  user,
  projects,
  selectedProjectId,
  units,
  unitCodeFilter,
  ownerPhoneFilter,
  statusFilter,
  onProjectSelect,
  onUnitCodeFilter,
  onOwnerPhoneFilter,
  onStatusFilter,
  onOpenUnit,
}: {
  user: LeadraUser
  projects: ReturnType<typeof summarizeProjects>
  selectedProjectId: string | null
  units: LeadraUnit[]
  unitCodeFilter: string
  ownerPhoneFilter: string
  statusFilter: UnitStatus | 'all'
  onProjectSelect: (id: string) => void
  onUnitCodeFilter: (value: string) => void
  onOwnerPhoneFilter: (value: string) => void
  onStatusFilter: (value: UnitStatus | 'all') => void
  onOpenUnit: (id: number) => void
}) {
  const { locale, t } = useLocale()

  return (
    <section className="page-stack page-entrance units-page">
      <div className="section-heading motion-stage" style={motionStyle(0)}>
        <div>
          <p className="eyebrow">{t('units.eyebrow')}</p>
          <h2>{t('units.heading')}</h2>
        </div>
        <Search size={22} />
      </div>
      <div className="project-grid motion-stage" style={motionStyle(1, 30)}>
        {projects.map((project, index) => (
          <button
            key={project.projectId}
            className={`project-card motion-stage ${selectedProjectId === project.projectId ? 'active' : ''}`}
            type="button"
            style={motionStyle(index, 110)}
            onClick={() => onProjectSelect(project.projectId)}
          >
            <strong dir="auto">{project.projectName}</strong>
            <span>{t('units.totalUnits', { count: formatCount(locale, project.totalUnits) })}</span>
            <small>{t('units.summary', { available: formatCount(locale, project.availableUnits), hold: formatCount(locale, project.holdUnits), sold: formatCount(locale, project.soldUnits) })}</small>
          </button>
        ))}
      </div>

      <div className="filter-bar motion-stage" style={motionStyle(2, 60)}>
        <label>
          {t('units.unitCode')}
          <input value={unitCodeFilter} onChange={(event) => onUnitCodeFilter(event.target.value)} placeholder="NE105BR3Ba2" dir="auto" />
        </label>
        <ControlledSelectField
          label={t('units.status')}
          options={[
            { value: 'all', label: t('common.all') },
            { value: 'available', label: getStatusLabel(locale, 'available') },
            { value: 'hold', label: getStatusLabel(locale, 'hold') },
            { value: 'sold', label: getStatusLabel(locale, 'sold') },
          ]}
          value={statusFilter}
          onValueChange={(value) => onStatusFilter(value as UnitStatus | 'all')}
        />
        <label>
          {t('units.ownerPhone')}
          <input
            value={ownerPhoneFilter}
            onChange={(event) => onOwnerPhoneFilter(event.target.value)}
            placeholder={units.some((unit) => canSearchOwnerPhone(user, unit)) ? t('units.ownerPhonePlaceholder') : t('units.ownerPhoneHidden')}
            dir="auto"
          />
        </label>
      </div>

      <section className="unit-list motion-list" key={`${selectedProjectId ?? 'all'}-${unitCodeFilter}-${ownerPhoneFilter}-${statusFilter}`}>
        {units.length === 0 && <EmptyState title={t('units.noMatchesTitle')} body={t('units.noMatchesBody')} />}
        {units.map((unit, index) => (
          <UnitListRow key={unit.id} user={user} unit={unit} index={index} onOpen={() => onOpenUnit(unit.id)} />
        ))}
      </section>
    </section>
  )
}

function UnitListRow({ user, unit, onOpen, index = 0 }: { user: LeadraUser; unit: LeadraUnit; onOpen: () => void; index?: number }) {
  const { locale, t } = useLocale()
  const thumbnail = getThumbnailMedia(unit.media)

  return (
    <button className="unit-row motion-stage" type="button" aria-label={t('units.openUnit', { unitCode: unit.unitCode })} style={motionStyle(index)} onClick={onOpen}>
      <div className="thumb">{thumbnail ? <img src={thumbnail.url} alt="" /> : <ImageIcon />}</div>
      <div>
        <strong>{unit.unitCode}</strong>
        <p dir="auto">{unit.projectName} / {unit.unitType} / {t('units.areaBua', { bua: formatCount(locale, unit.bua) })}</p>
        <small dir="auto">{canViewOwnerData(user, unit) ? unit.originalOwnerPhone : t('units.ownerHiddenByPermission')}</small>
      </div>
      <span className={`status-pill motion-status-pill ${unit.status}`}>{getStatusLabel(locale, unit.status)}</span>
    </button>
  )
}

function CreateUnitPage({
  lookupValues,
  onSubmit,
  settings,
}: {
  lookupValues: LookupValue[]
  onSubmit: (event: FormEvent<HTMLFormElement>, uploadedMedia: LeadraMediaFile[]) => void
  settings: AppSettings
}) {
  const { locale, t } = useLocale()
  const [activeStep, setActiveStep] = useState<(typeof createUnitSteps)[number]>('Property')
  const [selectedMedia, setSelectedMedia] = useState<LeadraMediaFile[]>([])
  const [mediaError, setMediaError] = useState<UiMessage | null>(null)
  const activeStepIndex = createUnitSteps.indexOf(activeStep)
  const mediaValidation = validateMediaUpload(selectedMedia)
  const totalMediaMb = selectedMedia.reduce((total, file) => total + file.sizeBytes, 0) / (1024 * 1024)

  const unitTypeOptions = [
    { value: 'Apartment', label: t('create.apartment') },
    { value: 'Villa', label: t('create.villa') },
    { value: 'Townhouse', label: t('create.townhouse') },
  ]
  const floorOptions = [
    ['Ground', t('create.ground')],
    ['1st', t('create.first')],
    ['2nd', t('create.second')],
    ['3rd', t('create.third')],
    ['4th', t('create.fourth')],
    ['5th', t('create.fifth')],
    ['6th', t('create.sixth')],
    ['7th', t('create.seventh')],
    ['8th', t('create.eighth')],
    ['9th', t('create.ninth')],
    ['10th', t('create.tenth')],
    ['Roof', t('create.roof')],
  ] as const

  function goToRelativeStep(offset: number) {
    const nextIndex = Math.min(createUnitSteps.length - 1, Math.max(0, activeStepIndex + offset))
    setActiveStep(createUnitSteps[nextIndex])
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
              onClick={() => setActiveStep(step)}
            >
              <span>{formatCount(locale, index + 1)}</span>
              {translateCreateStep(step, locale)}
            </button>
          ))}
        </div>

        <fieldset className="unit-form wizard-panel" data-active={activeStep === 'Property'} aria-hidden={activeStep !== 'Property'}>
          <legend>{t('create.legend.property')}</legend>
          <SelectField name="developerId" label={t('create.developer')} values={lookupValues.filter((item) => item.kind === 'developer')} />
          <SelectField name="projectId" label={t('create.project')} values={lookupValues.filter((item) => item.kind === 'project')} />
          <NumberField name="bua" label={t('create.bua')} defaultValue={145} />
          <SelectField name="destinationId" label={t('create.destination')} values={lookupValues.filter((item) => item.kind === 'destination')} />
          <NamedSelectField
            defaultValue="Apartment"
            label={t('create.unitType')}
            name="unitType"
            options={unitTypeOptions}
          />
          <NamedSelectField
            defaultValue="2nd"
            label={t('create.floor')}
            name="floor"
            options={floorOptions.map(([value, label]) => ({ value, label }))}
          />
        </fieldset>

        <fieldset className="unit-form wizard-panel" data-active={activeStep === 'Specs'} aria-hidden={activeStep !== 'Specs'}>
          <legend>{t('create.legend.specs')}</legend>
          <NumberField name="roofGardenArea" label={t('create.roofGardenArea')} defaultValue={0} />
          <SelectField name="viewId" label={t('create.view')} values={lookupValues.filter((item) => item.kind === 'view')} />
          <NumberField name="bedrooms" label={t('create.bedrooms')} defaultValue={3} min={1} max={10} />
          <NumberField name="bathrooms" label={t('create.bathrooms')} defaultValue={2} min={1} max={10} />
          <label className="toggle-line"><input name="elevator" type="checkbox" defaultChecked /> {t('create.elevator')}</label>
          <NumberField name="landArea" label={t('create.landArea')} defaultValue={0} />
          <label className="toggle-line"><input name="furnished" type="checkbox" /> {t('create.furnished')}</label>
          <NamedSelectField
            defaultValue="Fully Finished"
            label={t('create.finish')}
            name="finish"
            options={[
              { value: 'Fully Finished', label: t('create.fullyFinished') },
              { value: 'Semi Finished', label: t('create.semiFinished') },
              { value: 'Core and Shell', label: t('create.coreAndShell') },
            ]}
          />
        </fieldset>

        <fieldset className="unit-form wizard-panel" data-active={activeStep === 'Payment'} aria-hidden={activeStep !== 'Payment'}>
          <legend>{t('create.legend.payment')}</legend>
          <NamedSelectField
            defaultValue="installment"
            label={t('create.paymentMethod')}
            name="paymentMethod"
            options={[
              { value: 'cash', label: t('create.cash') },
              { value: 'installment', label: t('create.installment') },
            ]}
          />
          <NumberField name="totalAmount" label={t('create.totalAmount')} defaultValue={4_500_000} />
          <NumberField name="downPayment" label={t('create.downPayment')} defaultValue={900_000} />
          <NumberField name="installmentYears" label={t('create.installmentYears')} defaultValue={5} min={1} />
        </fieldset>

        <fieldset className="unit-form wizard-panel" data-active={activeStep === 'Owner'} aria-hidden={activeStep !== 'Owner'}>
          <legend>{t('create.legend.owner')}</legend>
          <label>
            {t('create.ownerName')}
            <input name="ownerName" defaultValue="New Owner" required dir="auto" />
          </label>
          <NamedSelectField
            defaultValue="+20"
            label={t('create.countryCode')}
            name="countryCode"
            options={[
              { value: '+20', label: t('create.countryEgypt') },
              { value: '+971', label: t('create.countryUae') },
              { value: '+966', label: t('create.countrySaudi') },
            ]}
          />
          <label>
            {t('create.ownerPhone')}
            <input name="ownerPhone" defaultValue="01012345678" required dir="auto" />
          </label>
          <label>
            {t('create.deliveryMonth')}
            <input name="deliveryMonth" type="number" min="1" max="12" defaultValue="3" />
          </label>
          <label>
            {t('create.deliveryYear')}
            <input name="deliveryYear" type="number" min="2026" defaultValue="2028" />
          </label>
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
                  <img src={file.url} alt={file.name} />
                  <div>
                    <strong dir="auto">{file.name}</strong>
                    <small>{(file.sizeBytes / (1024 * 1024)).toFixed(2)} MB</small>
                  </div>
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
  onArchive,
  onStatusChange,
  onGeneratePdf,
  onSaveNote,
  onDeleteNote,
}: {
  user: LeadraUser
  unit: LeadraUnit
  onArchive: () => void
  onStatusChange: (status: UnitStatus) => void
  onGeneratePdf: () => void
  onSaveNote: (content: string) => void
  onDeleteNote: () => void
}) {
  const { locale, t } = useLocale()
  const ownerAllowed = canViewOwnerData(user, unit)
  const [sharedNote, setSharedNote] = useState(unit.adminManagerNotes[0]?.content ?? '')

  return (
    <section className="page-stack page-entrance details-page">
      <div className="details-hero motion-stage motion-hero" style={motionStyle(0)}>
        <div>
          <p className="eyebrow">{t('details.eyebrow')}</p>
          <h2>{unit.unitCode}</h2>
          <p dir="auto">{unit.projectName} / {unit.destinationName} / {unit.unitType}</p>
        </div>
        <span className={`status-pill motion-status-pill ${unit.status}`}>{getStatusLabel(locale, unit.status)}</span>
      </div>
      <div className="details-actions motion-stage" style={motionStyle(1, 40)}>
        <div className="action-row wrap">
          <button className="secondary-button" type="button" onClick={() => onStatusChange('hold')}>{t('details.markHold')}</button>
          <button className="secondary-button" type="button" onClick={() => onStatusChange('sold')}>{t('details.markSold')}</button>
          {unit.status !== 'available' && <button className="secondary-button" type="button" onClick={() => onStatusChange('available')}>{t('details.clearStatus')}</button>}
        </div>
        <div className="action-row wrap">
          <button className="primary-button" type="button" onClick={onGeneratePdf}><FileText size={18} /> {t('details.generateBrief')}</button>
          <button className="secondary-button" type="button" onClick={onGeneratePdf}><Download size={18} /> {t('details.printBrief')}</button>
          {canArchiveUnit(user, unit) && <button className="danger-button" type="button" onClick={onArchive}><Archive size={18} /> {t('details.archive')}</button>}
        </div>
      </div>
      <InfoSection
        style={motionStyle(2, 70)}
        title={t('details.mainInfo')}
        rows={[
          [t('details.developer'), unit.developerName],
          [t('details.project'), unit.projectName],
          [t('details.destination'), unit.destinationName],
          [t('details.floor'), unit.floor],
          [t('create.bua'), `${formatCount(locale, unit.bua)} m²`],
          [t('details.landArea'), unit.landArea ? `${formatCount(locale, unit.landArea)} m²` : t('common.notSet')],
          [t('details.view'), unit.viewName],
          [t('details.bedsBaths'), `${formatCount(locale, unit.bedrooms)} / ${formatCount(locale, unit.bathrooms)}`],
          [t('details.elevator'), unit.elevator ? t('common.yes') : t('common.no')],
        ]}
      />
      <InfoSection
        style={motionStyle(3, 100)}
        title={t('details.pricing')}
        rows={[
          [t('details.paymentMethod'), getPaymentMethodLabel(locale, unit.paymentMethod)],
          [t('details.totalAmount'), formatCurrency(unit.totalAmount, locale)],
          [t('create.downPayment'), formatCurrency(unit.downPayment, locale)],
          [t('details.remainingPayment'), formatCurrency(unit.remainingPayment, locale)],
          [t('details.commission'), `${formatCurrency(unit.commissionAmount, locale)} (${unit.commissionPercentage}%)`],
          [t('details.installmentAmount'), formatCurrency(unit.installmentAmount, locale)],
        ]}
      />
      <InfoSection style={motionStyle(4, 130)} title={t('details.delivery')} rows={[[t('details.expectedDelivery'), formatDeliveryExpectancy(unit, locale)]]} />
      <section className="content-card motion-stage" style={motionStyle(5, 160)}>
        <h2>{t('details.notes')}</h2>
        <p dir="auto">{unit.salesNotes}</p>
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
              <button className="danger-button" type="button" onClick={onDeleteNote}>{t('details.deleteNote')}</button>
            </div>
          </form>
        )}
      </section>
      <section className="media-grid motion-stage" style={motionStyle(6, 190)}>
        {unit.media.map((file, index) => (
          <div className="media-card motion-stage" key={file.id} style={motionStyle(index, 240)}>
            {file.type === 'image' ? <img src={file.url} alt={file.name} /> : <div className="video-placeholder">{t('details.videoIgnored')}</div>}
          </div>
        ))}
      </section>
      <InfoSection
        style={motionStyle(7, 220)}
        title={t('details.ownerData')}
        rows={[
          [t('details.ownerName'), ownerAllowed ? unit.originalOwnerName ?? t('common.notSet') : t('common.hiddenByPermission')],
          [t('details.ownerPhone'), ownerAllowed ? unit.originalOwnerPhone ?? t('common.notSet') : t('common.hiddenByPermission')],
          [t('details.normalizedPhone'), ownerAllowed ? unit.normalizedOwnerPhone ?? t('common.notSet') : t('common.backendOnlyHidden')],
        ]}
      />
    </section>
  )
}

function NotificationsPage({ notifications, user }: { notifications: NotificationItem[]; user: LeadraUser }) {
  const { locale, t } = useLocale()
  const visibleNotifications = notifications.filter(
    (notification) => notification.userId === user.id || notification.audienceRole === user.role || (!notification.userId && !notification.audienceRole),
  )

  return (
    <section className="content-card page-entrance notifications-page motion-stage motion-subtle" style={motionStyle(0)}>
      <h2>{t('notifications.heading')}</h2>
      {visibleNotifications.length === 0 && <EmptyState title={t('notifications.emptyTitle')} body={t('notifications.emptyBody')} />}
      {visibleNotifications.map((notification, index) => (
        <div className="notification-row motion-stage" key={notification.id} style={motionStyle(index, 90)}>
          <Bell size={17} />
          <div>
            <strong>{renderNotificationTitle(locale, notification)}</strong>
            <p>{renderNotificationBody(locale, notification)}</p>
            <small>{formatDateTime(locale, notification.createdAt)}</small>
          </div>
        </div>
      ))}
    </section>
  )
}

function AnalyticsPage({ appState, user }: { appState: AppDataState; user: LeadraUser }) {
  const { locale, t } = useLocale()
  const [filters, setFilters] = useState<AnalyticsFilters>(defaultAnalyticsFilters)
  const [filterOpen, setFilterOpen] = useState(false)
  const [rpcDashboard, setRpcDashboard] = useState<AnalyticsDashboard | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)
  const fallbackDashboard = buildAnalyticsDashboard(user, appState, locale, new Date(), filters)
  const dashboard = rpcDashboard ?? fallbackDashboard
  const topSales = dashboard.salesPerformance.slice(0, 6)
  const latestTimeline = dashboard.activityTimeline
  const activeFilterCount =
    filters.teamIds.length +
    filters.userIds.length +
    filters.projectIds.length +
    filters.developerIds.length +
    filters.destinationIds.length +
    filters.statuses.length +
    filters.paymentMethods.length
  const averageTargetProgress =
    dashboard.targetProgress.length === 0
      ? 0
      : Math.round(dashboard.targetProgress.reduce((total, target) => total + target.activityProgress, 0) / dashboard.targetProgress.length)
  const rangeOptions: { value: AnalyticsDateWindow; label: string }[] = [
    { value: 'live', label: t('common.live') },
    { value: '30d', label: t('common.days30') },
    { value: '90d', label: t('common.days90') },
    { value: 'custom', label: t('analytics.custom') },
  ]

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

  function updateSingleFilter<Key extends keyof AnalyticsFilters>(key: Key, value: string) {
    setFilters((current) => ({ ...current, [key]: value ? [value] : [] }))
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
          <h2>{user.role === 'manager' ? t('analytics.teamHeading') : t('analytics.companyHeading')}</h2>
          <p>{t('analytics.subheading')}</p>
        </div>
        <div className="analytics-hero-side">
          <div className="analytics-range" aria-label={t('analytics.timeWindows')}>
            {rangeOptions.map((option) => (
              <button
                key={option.value}
                className={filters.dateWindow === option.value ? 'active' : ''}
                type="button"
                onClick={() => setFilters((current) => ({ ...current, dateWindow: option.value }))}
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
            <button className="secondary-link" type="button" onClick={() => setFilters(defaultAnalyticsFilters)}>Reset</button>
            <button className="ghost-button analytics-filter-toggle" type="button" aria-expanded={filterOpen} onClick={() => setFilterOpen((open) => !open)}>
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
              <input type="date" value={filters.startDate ?? ''} onChange={(event) => setFilters((current) => ({ ...current, startDate: event.target.value }))} />
            </label>
            <label>
              End
              <input type="date" value={filters.endDate ?? ''} onChange={(event) => setFilters((current) => ({ ...current, endDate: event.target.value }))} />
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
          <div className="status-stack">
            <MiniBar label={getStatusLabel(locale, 'available')} value={dashboard.overview.availableUnits} total={dashboard.overview.totalActiveUnits} />
            <MiniBar label={getStatusLabel(locale, 'hold')} value={dashboard.overview.holdUnits} total={dashboard.overview.totalActiveUnits} />
            <MiniBar label={getStatusLabel(locale, 'sold')} value={dashboard.overview.soldUnits} total={dashboard.overview.totalActiveUnits} />
            <MiniBar label={getStatusLabel(locale, 'archived')} value={dashboard.overview.archivedUnits} total={Math.max(1, dashboard.overview.totalActiveUnits + dashboard.overview.archivedUnits)} />
          </div>
        </section>
      </div>

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
    </section>
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
  filters: AnalyticsFilters
  open: boolean
  managerMode: boolean
  onChange: (key: keyof AnalyticsFilters, value: string) => void
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
          { id: 'sold', label: 'Sold' },
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
  lookupCount,
  onCreateUser,
  onUpdateUser,
  onSettingsUpdate,
}: {
  users: LeadraUser[]
  units: LeadraUnit[]
  settings: AppSettings
  auditLogs: AuditLogItem[]
  lookupCount: number
  onCreateUser: (formData: FormData) => void
  onUpdateUser: (userId: string, updates: Partial<LeadraUser>) => void
  onSettingsUpdate: (commissionPercentage: number) => void
}) {
  const { locale, t } = useLocale()
  const [activeSection, setActiveSection] = useState<(typeof adminSections)[number]>('Users')
  const [userQuery, setUserQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<LeadraUser['role'] | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<LeadraUser['status'] | 'all'>('all')
  const [teamFilter, setTeamFilter] = useState('all')
  const [sortUsersBy, setSortUsersBy] = useState<'role' | 'name' | 'recent'>('role')
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [createUserOpen, setCreateUserOpen] = useState(false)
  const userListStateKey = `${userQuery}-${roleFilter}-${statusFilter}-${teamFilter}-${sortUsersBy}`
  const teamOptions = Array.from(new Set(users.map((item) => item.teamId))).sort((first, second) => compareText(locale, first, second))
  const filteredUsers = users
    .filter((item) => {
      const query = userQuery.trim().toLowerCase()
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
    })
  const userCountsByRole = users.reduce<Record<LeadraUser['role'], number>>(
    (counts, item) => ({ ...counts, [item.role]: counts[item.role] + 1 }),
    { admin: 0, sub_admin: 0, manager: 0, sales: 0 },
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
            onClick={() => setActiveSection(section)}
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
              <button className="primary-button" type="button" onClick={() => setCreateUserOpen((open) => !open)}>
                {createUserOpen ? t('admin.closeForm') : t('admin.newUser')}
              </button>
            </div>
          </div>
          {createUserOpen && (
            <form
              className="settings-form create-user-panel motion-stage"
              style={motionStyle(0, 110)}
              onSubmit={(event) => {
                event.preventDefault()
                onCreateUser(new FormData(event.currentTarget))
                event.currentTarget.reset()
                setCreateUserOpen(false)
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
              <label>
                {t('admin.team')}
                <input name="teamId" required defaultValue="team-prime" dir="auto" />
              </label>
              <label>
                {t('admin.branch')}
                <input name="branchId" required defaultValue="branch-cairo" dir="auto" />
              </label>
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
                ...teamOptions.map((teamId) => ({ value: teamId, label: teamId })),
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
            {filteredUsers.map((item, index) => (
              <UserManagementCard
                key={item.id}
                index={index}
                user={item}
                isEditing={editingUserId === item.id}
                onEdit={() => setEditingUserId(item.id)}
                onCancel={() => setEditingUserId(null)}
                onSave={(updates) => {
                  onUpdateUser(item.id, updates)
                  setEditingUserId(null)
                }}
              />
            ))}
            {filteredUsers.length === 0 && <EmptyState title={t('admin.noUsersTitle')} body={t('admin.noUsersBody')} />}
          </div>
        </section>
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
              onSettingsUpdate(Number(formData.get('commissionPercentage')))
            }}
          >
            <label>
              {t('admin.commissionPercentage')}
              <input name="commissionPercentage" type="number" step="0.1" defaultValue={settings.commissionPercentage} />
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
          {auditLogs.map((item, index) => (
            <div className="admin-row motion-stage" key={item.id} style={motionStyle(index, 110)}>
              <strong>{renderAuditAction(locale, item)}</strong>
              <span>{item.actorName} / {getRoleLabel(locale, item.actorRole)}</span>
              <small>{item.relatedUnitCode} / {formatDateTime(locale, item.createdAt)}</small>
            </div>
          ))}
        </section>
      )}
    </section>
  )
}

function UserManagementCard({
  user,
  index = 0,
  isEditing,
  onEdit,
  onCancel,
  onSave,
}: {
  user: LeadraUser
  index?: number
  isEditing: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: (updates: Partial<LeadraUser>) => void
}) {
  const { locale, t } = useLocale()

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
        <button className="secondary-button" type="button" onClick={onEdit}>
          {t('admin.editUser')}
        </button>
      )}

      {isEditing && (
        <form
          className="user-edit-form motion-stage"
          style={motionStyle(0, 90)}
          onSubmit={(event) => {
            event.preventDefault()
            const formData = new FormData(event.currentTarget)
            onSave({
              fullName: String(formData.get('fullName')),
              email: String(formData.get('email')),
              role: String(formData.get('role')) as LeadraUser['role'],
              jobTitle: String(formData.get('jobTitle')),
              phoneNumber: String(formData.get('phoneNumber')),
              teamId: String(formData.get('teamId')),
              branchId: String(formData.get('branchId')),
              status: String(formData.get('status')) as LeadraUser['status'],
            })
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
          <label>
            {t('admin.team')}
            <input name="teamId" defaultValue={user.teamId} required dir="auto" />
          </label>
          <label>
            {t('admin.branch')}
            <input name="branchId" defaultValue={user.branchId} required dir="auto" />
          </label>
          <div className="user-edit-actions">
            <button className="secondary-button" type="button" onClick={onCancel}>{t('common.cancel')}</button>
            <button className="primary-button" type="submit">{t('admin.saveUser')}</button>
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
  const isControlled = value !== undefined
  const [open, setOpen] = useState(false)
  const [internalValue, setInternalValue] = useState(defaultValue ?? options[0]?.value ?? '')
  const selectedValue = isControlled ? value ?? options[0]?.value ?? '' : internalValue
  const selectedOption = options.find((option) => option.value === selectedValue) ?? options[0]

  useEffect(() => {
    if (!open) return undefined

    function handlePointer(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
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
    return () => {
      window.removeEventListener('mousedown', handlePointer)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [open])

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
      {open && (
        <div aria-labelledby={labelId} className="brand-select-menu" id={menuId} role="listbox">
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
        </div>
      )}
    </div>
  )
}

function SelectField({ name, label, values }: { name: string; label: string; values: { id: string; label: string }[] }) {
  const labelId = useId()
  return (
    <label>
      <span id={labelId}>{label}</span>
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
  onValueChange,
}: {
  label: string
  options: BrandedSelectOption[]
  value: string
  disabled?: boolean
  className?: string
  onValueChange: (value: string) => void
}) {
  const labelId = useId()
  return (
    <label className={className}>
      <span id={labelId}>{label}</span>
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
  defaultValue,
}: {
  name: string
  label: string
  options: BrandedSelectOption[]
  defaultValue?: string
}) {
  const labelId = useId()
  return (
    <label>
      <span id={labelId}>{label}</span>
      <BrandedSelect defaultValue={defaultValue} labelId={labelId} name={name} options={options} />
    </label>
  )
}

function NumberField({ name, label, defaultValue, min, max }: { name: string; label: string; defaultValue: number; min?: number; max?: number }) {
  return (
    <label>
      {label}
      <input name={name} type="number" defaultValue={defaultValue} min={min} max={max} />
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
  icon,
  className = '',
  style,
}: {
  active: boolean
  label: string
  onClick: () => void
  icon: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <button className={`nav-button ${active ? 'active' : ''} ${className}`.trim()} type="button" style={style} onClick={onClick}>
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

function readHashView(): HashView {
  const value = window.location.hash.replace('#', '')
  if (value === 'units' || value === 'create' || value === 'notifications' || value === 'profile' || value === 'analytics' || value === 'admin') {
    return value
  }
  return 'dashboard'
}

function writeHashView(view: HashView) {
  const nextHash = view === 'dashboard' ? '' : `#${view}`
  window.history.replaceState(null, '', `${window.location.pathname}${nextHash}`)
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
  if (section === 'Settings') return translateForLocale(locale, 'admin.settings')
  if (section === 'Metrics') return translateForLocale(locale, 'admin.metrics')
  return translateForLocale(locale, 'admin.audit')
}

function sortLabel(sortUsersBy: 'role' | 'name' | 'recent', locale: LocaleCode) {
  if (sortUsersBy === 'role') return translateForLocale(locale, 'admin.sortRole')
  if (sortUsersBy === 'name') return translateForLocale(locale, 'admin.sortName')
  return translateForLocale(locale, 'admin.sortRecent')
}

function translateForLocale(locale: LocaleCode, key: string, params?: MessageParams) {
  return translate(locale, key, params)
}

export default App
