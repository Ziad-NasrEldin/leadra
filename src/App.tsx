import {
  Archive,
  BarChart3,
  Bell,
  Building2,
  Download,
  FileText,
  Home,
  Image as ImageIcon,
  LogOut,
  MoreHorizontal,
  Plus,
  SlidersHorizontal,
  Search,
  Settings,
  Users,
} from 'lucide-react'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { demoUsers, initialAppState, lookupValues } from './data/seed'
import { buildAnalyticsDashboard, canAccessAnalytics } from './lib/analytics'
import {
  canAddAdminManagerNote,
  canArchiveUnit,
  canSearchOwnerPhone,
  canViewOwnerData,
  filterUnitsForUser,
  formatCurrency,
  formatDeliveryExpectancy,
  getThumbnailMedia,
  validateMediaUpload,
  searchUnits,
  summarizeProjects,
} from './lib/domain'
import { downloadUnitPdf } from './lib/pdf'
import { canUseDemoMode, isProductionMissingSupabaseConfig, isSupabaseConfigured, supabase } from './lib/supabase'
import { loadSupabaseAppState, loadSupabaseProfile, markSupabaseLogin } from './lib/supabaseState'
import type { AnalyticsDashboard, AppSettings, AuditLogItem, LeadraMediaFile, LeadraUnit, LeadraUser, LookupValue, NotificationItem, PaymentMethod, UnitStatus } from './lib/types'
import {
  addAnalyticsEventWorkflow,
  archiveUnitWorkflow,
  createUnitWorkflow,
  createUserWorkflow,
  updateSettingsWorkflow,
  updateUnitStatusWorkflow,
} from './lib/workflows'

type View = 'dashboard' | 'units' | 'create' | 'details' | 'notifications' | 'profile' | 'analytics' | 'admin'
type HashView = Exclude<View, 'details'>

const statusLabels: Record<UnitStatus, string> = {
  available: 'Available',
  hold: 'Hold',
  sold: 'Sold',
}

const createUnitSteps = ['Property', 'Specs', 'Payment', 'Owner', 'Review'] as const
const adminSections = ['Users', 'Settings', 'Metrics', 'Audit'] as const
const roleOrder: Record<LeadraUser['role'], number> = {
  admin: 0,
  sub_admin: 1,
  manager: 2,
  sales: 3,
}

function App() {
  const [currentUser, setCurrentUser] = useState<LeadraUser | null>(null)
  const [view, setView] = useState<View>(() => readHashView())
  const [appState, setAppState] = useState(initialAppState)
  const [activeLookupValues, setActiveLookupValues] = useState<LookupValue[]>(lookupValues)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null)
  const [unitCodeFilter, setUnitCodeFilter] = useState('')
  const [ownerPhoneFilter, setOwnerPhoneFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<UnitStatus | 'all'>('all')
  const [flash, setFlash] = useState<string | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured)
  const [loginError, setLoginError] = useState<string | null>(null)

  async function completeSupabaseLogin(authUser: SupabaseUser) {
    if (!supabase) return
    try {
      setAuthLoading(true)
      const profile = await loadSupabaseProfile(supabase, authUser)
      if (profile.status !== 'active') {
        await supabase.auth.signOut()
        setLoginError('Inactive users cannot log in.')
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
      setLoginError('Sign-in is temporarily unavailable. Contact your administrator.')
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
      setLoginError(error.message)
      setAuthLoading(false)
      return
    }
    if (data.user) await completeSupabaseLogin(data.user)
  }

  useEffect(() => {
    function syncViewFromHash() {
      const requestedView = readHashView()
      setView(requestedView)
      setFlash(null)
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
        setLoginError(error.message)
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
  const projectSummaries = summarizeProjects(visibleUnits)
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
      (notification.userId === user.id || notification.audienceRole === user.role),
  ).length

  function navigate(nextView: View) {
    setView(nextView)
    if (nextView !== 'details') {
      writeHashView(nextView)
    }
    setFlash(null)
    setMobileMenuOpen(false)
  }

  function handleCreateUnit(event: FormEvent<HTMLFormElement>, uploadedMedia: LeadraMediaFile[]) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const paymentMethod = String(formData.get('paymentMethod')) as PaymentMethod
    const totalAmount = Number(formData.get('totalAmount'))
    const downPayment = paymentMethod === 'installment' ? Number(formData.get('downPayment')) : null
    const projectId = String(formData.get('projectId'))
    const project = activeLookupValues.find((item) => item.id === projectId)
    const destinationId = String(formData.get('destinationId'))
    const destination = activeLookupValues.find((item) => item.id === destinationId)
    const developerId = String(formData.get('developerId'))
    const developer = activeLookupValues.find((item) => item.id === developerId)
    const viewId = String(formData.get('viewId'))
    const viewLookup = activeLookupValues.find((item) => item.id === viewId)
    const bedrooms = Number(formData.get('bedrooms'))
    const bathrooms = Number(formData.get('bathrooms'))
    const countryCode = String(formData.get('countryCode'))
    const originalOwnerPhone = String(formData.get('ownerPhone'))
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
      bedrooms,
      bathrooms,
      elevator: formData.get('elevator') === 'on',
      landArea: Number(formData.get('landArea')) || null,
      furnished: formData.get('furnished') === 'on',
      finish: String(formData.get('finish')),
      paymentMethod,
      totalAmount,
      downPayment,
      installmentType: paymentMethod === 'installment' ? 'quarterly' : null,
      installmentYears: paymentMethod === 'installment' ? Number(formData.get('installmentYears')) : null,
      deliveryExpectancy: { mode: 'month_year', month: Number(formData.get('deliveryMonth')), year: Number(formData.get('deliveryYear')) },
      originalOwnerName: String(formData.get('ownerName')),
      countryCode,
      originalOwnerPhone,
      salesNotes: String(formData.get('salesNotes')),
      media: uploadedMedia,
    })

    setAppState(result.state)
    if (!result.ok) {
      setFlash(result.error)
      return
    }

    const newUnit = result.state.units[0]
    setSelectedProjectId(newUnit.projectId)
    setSelectedUnitId(newUnit.id)
    setFlash('Unit created, notifications queued, and audit action recorded.')
    setView('details')
  }

  function updateUnitStatus(unit: LeadraUnit, status: UnitStatus) {
    const result = updateUnitStatusWorkflow(appState, user, unit.id, status)
    setAppState(result.state)
    setFlash(result.ok ? `Unit marked ${statusLabels[status]}.` : result.error)
  }

  function archiveUnit(unit: LeadraUnit) {
    const result = archiveUnitWorkflow(appState, user, unit.id)
    setAppState(result.state)
    setFlash(result.ok ? 'Unit archived. It remains stored for history, audit, and backups.' : result.error)
    if (result.ok) setView('units')
  }

  async function generatePdf(unit: LeadraUnit) {
    await downloadUnitPdf(user, unit, appState.settings)
    setAppState((state) =>
      addAnalyticsEventWorkflow(
        {
          ...state,
          notifications: [
            {
              id: `notif-${Date.now()}`,
              title: 'PDF generated',
              body: `Permission-safe branded PDF generated (${unit.unitCode})`,
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
              actionType: 'PDF generated',
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
    setFlash('PDF generated. If native sharing is unavailable, download and send manually.')
  }

  return (
    <div className="app-shell">
      <aside className="side-rail" aria-label="Desktop navigation">
        <div className="brand-mark">L</div>
        <NavButton active={activeView === 'dashboard'} label="Dashboard" onClick={() => navigate('dashboard')} icon={<Home />} />
        <NavButton active={activeView === 'units'} label="Units" onClick={() => navigate('units')} icon={<Building2 />} />
        <NavButton active={activeView === 'create'} label="Create" onClick={() => navigate('create')} icon={<Plus />} />
        <NavButton active={activeView === 'notifications'} label={`Alerts ${unreadCount}`} onClick={() => navigate('notifications')} icon={<Bell />} />
        {canUseAnalytics && (
          <NavButton active={activeView === 'analytics'} label="Analytics" onClick={() => navigate('analytics')} icon={<BarChart3 />} />
        )}
        {canUseAdmin && (
          <NavButton active={activeView === 'admin'} label="Admin" onClick={() => navigate('admin')} icon={<Settings />} />
        )}
      </aside>

      <main className="main-panel">
        <header className={`topbar ${activeView !== 'dashboard' ? 'compact-topbar' : ''}`}>
          <div>
            <p className="eyebrow">Leadra internal resale system</p>
            <h1>{getViewTitle(activeView, user)}</h1>
          </div>
          <div className="topbar-actions">
            <button className="user-chip" type="button" onClick={() => navigate('profile')}>
              <span>{user.fullName.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span>
              <strong>{user.role.replace('_', ' ')}</strong>
            </button>
            <button
              className="ghost-button"
              type="button"
              aria-label="Sign out"
              onClick={() => {
                if (supabase) void supabase.auth.signOut()
                setCurrentUser(null)
                setView('dashboard')
                writeHashView('dashboard')
                setFlash(null)
              }}
            >
              <LogOut size={17} /> <span className="signout-label">Sign out</span>
            </button>
          </div>
        </header>

        {flash && <div className="flash">{flash}</div>}

        {activeView === 'dashboard' && (
          <Dashboard
            user={user}
            units={visibleUnits}
            notifications={appState.notifications}
            onNavigate={navigate}
          />
        )}
        {activeView === 'units' && (
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
              setSelectedUnitId(id)
              navigate('details')
            }}
          />
        )}
        {activeView === 'create' && <CreateUnitPage lookupValues={activeLookupValues} onSubmit={handleCreateUnit} />}
        {activeView === 'details' && selectedUnit && (
          <UnitDetailsPage
            user={user}
            unit={selectedUnit}
            onArchive={() => archiveUnit(selectedUnit)}
            onStatusChange={(status) => updateUnitStatus(selectedUnit, status)}
            onGeneratePdf={() => generatePdf(selectedUnit)}
          />
        )}
        {activeView === 'notifications' && <NotificationsPage notifications={appState.notifications} user={user} />}
        {activeView === 'profile' && <ProfilePage user={user} />}
        {activeView === 'analytics' && canUseAnalytics && (
          <AnalyticsPage dashboard={buildAnalyticsDashboard(user, appState)} user={user} />
        )}
        {activeView === 'admin' && canUseAdmin && (
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
              setFlash(result.ok ? 'User created and audit history updated.' : result.error)
            }}
            onUpdateUser={(userId, updates) => {
              setAppState((state) => ({
                ...state,
                users: state.users.map((item) => (item.id === userId ? { ...item, ...updates } : item)),
                auditLogs: [
                  {
                    id: `audit-${Date.now()}`,
                    actorName: user.fullName,
                    actorRole: user.role,
                    actionType: 'User profile updated',
                    relatedUnitCode: userId,
                    createdAt: new Date().toISOString(),
                    ipAddress: null,
                  },
                  ...state.auditLogs,
                ],
              }))
              setFlash('User profile updated and audit history updated.')
            }}
            onSettingsUpdate={(commissionPercentage) => {
              const result = updateSettingsWorkflow(appState, user, { commissionPercentage })
              setAppState(result.state)
              setFlash(result.ok ? 'Settings updated and audited.' : result.error)
            }}
          />
        )}
      </main>

      {mobileMenuOpen && (
        <div className="mobile-more-sheet" role="menu" aria-label="More mobile destinations">
          <NavButton active={activeView === 'notifications'} label="Alerts" onClick={() => navigate('notifications')} icon={<Bell />} />
          {canUseAnalytics && (
            <NavButton active={activeView === 'analytics'} label="Analytics" onClick={() => navigate('analytics')} icon={<BarChart3 />} />
          )}
          <NavButton active={activeView === 'profile'} label="Profile" onClick={() => navigate('profile')} icon={<SlidersHorizontal />} />
          {canUseAdmin && (
            <NavButton active={activeView === 'admin'} label="Admin" onClick={() => navigate('admin')} icon={<Settings />} />
          )}
        </div>
      )}

      <nav className="bottom-nav" aria-label="Mobile navigation">
        <NavButton active={activeView === 'dashboard'} label="Home" onClick={() => navigate('dashboard')} icon={<Home />} />
        <NavButton active={activeView === 'units'} label="Units" onClick={() => navigate('units')} icon={<Building2 />} />
        <NavButton active={activeView === 'create'} label="Add" onClick={() => navigate('create')} icon={<Plus />} />
        <NavButton
          active={mobileMenuOpen || activeView === 'notifications' || activeView === 'analytics' || activeView === 'profile' || activeView === 'admin'}
          label="More"
          onClick={() => setMobileMenuOpen((open) => !open)}
          icon={<MoreHorizontal />}
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
  loginError: string | null
  onLogin: (user: LeadraUser) => void
  onPasswordLogin: (email: string, password: string) => void
}) {
  return (
    <main className="login-screen">
      <section className="login-card">
        <div className="login-brand-panel">
          <div className="login-mark">L</div>
          <p className="eyebrow">Leadra private resale workspace</p>
          <h1>Resale command, without the spreadsheet drift.</h1>
          <p className="login-copy">
            A protected workspace for unit intake, project-first browsing, manager oversight, analytics, and branded owner-safe exports.
          </p>
          <div className="login-proof-grid" aria-label="Leadra access safeguards">
            <span>Role-scoped visibility</span>
            <span>Owner data protection</span>
            <span>Audit-ready workflows</span>
          </div>
        </div>

        <div className="login-access-panel">
          <p className="eyebrow">Authorized access</p>
          <h2>Sign in to Leadra</h2>
          <p>Use the company account created for you by a Leadra admin.</p>
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
                Email
                <input name="email" type="email" autoComplete="email" required placeholder="user@leadra.com" />
              </label>
              <label>
                Password
                <input name="password" type="password" autoComplete="current-password" required placeholder="Enter your password" />
              </label>
              {loginError && <p className="form-error">{loginError}</p>}
              <button className="primary-button" type="submit" disabled={authLoading}>
                {authLoading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
          )}
          {canUseDemoMode && (
            <>
              <p className="login-helper">Choose a role to preview the product.</p>
              <div className="role-grid" aria-label="Role login options">
                {demoUsers.map((user) => (
                  <button key={user.id} className="role-card" type="button" onClick={() => onLogin(user)}>
                    <span>{user.role.replace('_', ' ')}</span>
                    <strong>Continue as {user.role === 'admin' ? 'Admin' : user.fullName}</strong>
                    <small>{user.email}</small>
                  </button>
                ))}
              </div>
            </>
          )}
          {isProductionMissingSupabaseConfig && (
            <p className="form-error">Sign-in is not available. Contact your administrator.</p>
          )}
        </div>
      </section>
    </main>
  )
}

function Dashboard({
  user,
  units,
  notifications,
  onNavigate,
}: {
  user: LeadraUser
  units: LeadraUnit[]
  notifications: NotificationItem[]
  onNavigate: (view: View) => void
}) {
  const latestUnits = units.slice(0, 3)
  const available = units.filter((unit) => unit.status === 'available').length
  const hold = units.filter((unit) => unit.status === 'hold').length
  const sold = units.filter((unit) => unit.status === 'sold').length

  return (
    <section className="page-grid">
      <div className="hero-panel">
        <p className="eyebrow">{user.role.replace('_', ' ')} dashboard</p>
        <h2>{dashboardTitle(user.role)}</h2>
        <p>{dashboardDescription(user.role)}</p>
        <div className="action-row">
          <button className="primary-button" type="button" onClick={() => onNavigate('create')}>
            <Plus size={18} /> Quick Add Unit
          </button>
          <a className="secondary-link" href="#units" onClick={() => onNavigate('units')}>
            View All Units
          </a>
        </div>
      </div>

      <div className="metric-grid">
        <Metric label="Visible units" value={units.length} />
        <Metric label="Available" value={available} />
        <Metric label="Hold" value={hold} />
        <Metric label="Sold" value={sold} />
      </div>

      <section className="content-card">
        <h2>Latest activity</h2>
        {latestUnits.length === 0 && <EmptyState title="No visible units yet" body="Create the first resale unit to start tracking activity." />}
        {latestUnits.map((unit) => (
          <UnitListRow key={unit.id} user={user} unit={unit} onOpen={() => onNavigate('details')} />
        ))}
      </section>

      <section className="content-card">
        <h2>Notification center</h2>
        {notifications.length === 0 && <EmptyState title="No notifications" body="Important comments, status changes, and PDF exports will appear here." />}
        {notifications.slice(0, 3).map((notification) => (
          <div className="notification-row" key={notification.id}>
            <Bell size={16} />
            <div>
              <strong>{notification.title}</strong>
              <p>{notification.body}</p>
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
  return (
    <section className="page-stack">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Project-first browsing</p>
          <h2>Choose a project</h2>
        </div>
        <Search size={22} />
      </div>
      <div className="project-grid">
        {projects.map((project) => (
          <button
            key={project.projectId}
            className={`project-card ${selectedProjectId === project.projectId ? 'active' : ''}`}
            type="button"
            onClick={() => onProjectSelect(project.projectId)}
          >
            <strong>{project.projectName}</strong>
            <span>{project.totalUnits} total units</span>
            <small>{project.availableUnits} available / {project.holdUnits} hold / {project.soldUnits} sold</small>
          </button>
        ))}
      </div>

      <div className="filter-bar">
        <label>
          Unit code
          <input value={unitCodeFilter} onChange={(event) => onUnitCodeFilter(event.target.value)} placeholder="NE105BR3Ba2" />
        </label>
        <label>
          Status
          <select value={statusFilter} onChange={(event) => onStatusFilter(event.target.value as UnitStatus | 'all')}>
            <option value="all">All</option>
            <option value="available">Available</option>
            <option value="hold">Hold</option>
            <option value="sold">Sold</option>
          </select>
        </label>
        <label>
          Owner phone
          <input
            value={ownerPhoneFilter}
            onChange={(event) => onOwnerPhoneFilter(event.target.value)}
            placeholder={units.some((unit) => canSearchOwnerPhone(user, unit)) ? '+2010...' : 'Hidden for role'}
          />
        </label>
      </div>

      <section className="unit-list">
        {units.length === 0 && <EmptyState title="No units match these filters" body="Clear the filters or select another project to continue browsing." />}
        {units.map((unit) => (
          <UnitListRow key={unit.id} user={user} unit={unit} onOpen={() => onOpenUnit(unit.id)} />
        ))}
      </section>
    </section>
  )
}

function UnitListRow({ user, unit, onOpen }: { user: LeadraUser; unit: LeadraUnit; onOpen: () => void }) {
  const thumbnail = getThumbnailMedia(unit.media)

  return (
    <button className="unit-row" type="button" aria-label={`Open ${unit.unitCode}`} onClick={onOpen}>
      <div className="thumb">
        {thumbnail ? <img src={thumbnail.url} alt="" /> : <ImageIcon />}
      </div>
      <div>
        <strong>{unit.unitCode}</strong>
        <p>{unit.projectName} / {unit.unitType} / {unit.bua} BUA</p>
        <small>{canViewOwnerData(user, unit) ? unit.originalOwnerPhone : 'Owner hidden by permission'}</small>
      </div>
      <span className={`status-pill ${unit.status}`}>{statusLabels[unit.status]}</span>
    </button>
  )
}

function CreateUnitPage({
  lookupValues,
  onSubmit,
}: {
  lookupValues: LookupValue[]
  onSubmit: (event: FormEvent<HTMLFormElement>, uploadedMedia: LeadraMediaFile[]) => void
}) {
  const [activeStep, setActiveStep] = useState<(typeof createUnitSteps)[number]>('Property')
  const [selectedMedia, setSelectedMedia] = useState<LeadraMediaFile[]>([])
  const [mediaError, setMediaError] = useState<string | null>(null)
  const activeStepIndex = createUnitSteps.indexOf(activeStep)
  const mediaValidation = validateMediaUpload(selectedMedia)
  const totalMediaMb = selectedMedia.reduce((total, file) => total + file.sizeBytes, 0) / (1024 * 1024)

  function goToRelativeStep(offset: number) {
    const nextIndex = Math.min(createUnitSteps.length - 1, Math.max(0, activeStepIndex + offset))
    setActiveStep(createUnitSteps[nextIndex])
  }

  return (
    <section className="content-card create-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">PRD field order</p>
          <h2>Create Unit</h2>
        </div>
      </div>
      <form
        className="wizard-shell"
        onSubmit={(event) => {
          const validation = validateMediaUpload(selectedMedia)
          if (!validation.ok) {
            event.preventDefault()
            setMediaError(validation.message ?? 'Invalid media upload.')
            return
          }

          setMediaError(null)
          onSubmit(event, selectedMedia)
        }}
      >
        <div className="wizard-steps" aria-label="Create unit steps">
          {createUnitSteps.map((step, index) => (
            <button
              key={step}
              className={`wizard-step ${step === activeStep ? 'active' : ''}`}
              type="button"
              aria-current={step === activeStep ? 'step' : undefined}
              onClick={() => setActiveStep(step)}
            >
              <span>{index + 1}</span>
              {step}
            </button>
          ))}
        </div>

        <fieldset className="unit-form wizard-panel" hidden={activeStep !== 'Property'}>
          <legend>Property information</legend>
          <SelectField name="developerId" label="Developer" values={lookupValues.filter((item) => item.kind === 'developer')} />
          <SelectField name="projectId" label="Project" values={lookupValues.filter((item) => item.kind === 'project')} />
          <NumberField name="bua" label="BUA" defaultValue={145} />
          <SelectField name="destinationId" label="Destination" values={lookupValues.filter((item) => item.kind === 'destination')} />
          <label>
            Unit Type
            <select name="unitType" defaultValue="Apartment">
              <option>Apartment</option>
              <option>Villa</option>
              <option>Townhouse</option>
            </select>
          </label>
          <label>
            Floor
            <select name="floor" defaultValue="2nd">
              {['Ground', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', 'Roof'].map((floor) => (
                <option key={floor}>{floor}</option>
              ))}
            </select>
          </label>
        </fieldset>

        <fieldset className="unit-form wizard-panel" hidden={activeStep !== 'Specs'}>
          <legend>Specs and finishing</legend>
          <NumberField name="roofGardenArea" label="Roof/Garden Area" defaultValue={0} />
          <SelectField name="viewId" label="View" values={lookupValues.filter((item) => item.kind === 'view')} />
          <NumberField name="bedrooms" label="Bedrooms" defaultValue={3} min={1} max={10} />
          <NumberField name="bathrooms" label="Bathrooms" defaultValue={2} min={1} max={10} />
          <label className="toggle-line"><input name="elevator" type="checkbox" defaultChecked /> Elevator</label>
          <NumberField name="landArea" label="Land Area" defaultValue={0} />
          <label className="toggle-line"><input name="furnished" type="checkbox" /> Furnished</label>
          <label>
            Finish
            <select name="finish" defaultValue="Fully Finished">
              <option>Fully Finished</option>
              <option>Semi Finished</option>
              <option>Core and Shell</option>
            </select>
          </label>
        </fieldset>

        <fieldset className="unit-form wizard-panel" hidden={activeStep !== 'Payment'}>
          <legend>Payment information</legend>
          <label>
            Payment Method
            <select name="paymentMethod" defaultValue="installment">
              <option value="cash">Cash</option>
              <option value="installment">Installment</option>
            </select>
          </label>
          <NumberField name="totalAmount" label="Total Amount" defaultValue={4_500_000} />
          <NumberField name="downPayment" label="Down Payment" defaultValue={900_000} />
          <NumberField name="installmentYears" label="Installment Years" defaultValue={5} min={1} />
        </fieldset>

        <fieldset className="unit-form wizard-panel" hidden={activeStep !== 'Owner'}>
          <legend>Owner, delivery, and notes</legend>
          <label>
            Original Owner Name
            <input name="ownerName" defaultValue="New Owner" required />
          </label>
          <label>
            Country Code
            <select name="countryCode" defaultValue="+20">
              <option value="+20">Egypt +20</option>
              <option value="+971">UAE +971</option>
              <option value="+966">Saudi Arabia +966</option>
            </select>
          </label>
          <label>
            Original Owner Phone
            <input name="ownerPhone" defaultValue="01012345678" required />
          </label>
          <label>
            Delivery Month
            <input name="deliveryMonth" type="number" min="1" max="12" defaultValue="3" />
          </label>
          <label>
            Delivery Year
            <input name="deliveryYear" type="number" min="2026" defaultValue="2028" />
          </label>
          <label className="wide-field">
            Sales Notes
            <textarea name="salesNotes" defaultValue="Owner is responsive on WhatsApp." />
          </label>
        </fieldset>

        <section className="wizard-panel review-panel" hidden={activeStep !== 'Review'}>
          <p className="eyebrow">Media / Review</p>
          <h3>Ready to create this resale unit</h3>
          <p>Attach unit images for the gallery and branded PDF. Images are optional, but uploads are capped at 10 files and 40 MB total.</p>
          <div className="media-upload-panel">
            <label>
              Unit images
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={async (event) => {
                  const files = Array.from(event.currentTarget.files ?? [])
                  const media = await Promise.all(files.map(fileToMedia))
                  const validation = validateMediaUpload(media)
                  setSelectedMedia(media)
                  setMediaError(validation.ok ? null : validation.message ?? 'Invalid media upload.')
                }}
              />
            </label>
            <div className="media-upload-summary">
              <strong>{selectedMedia.length} images selected</strong>
              <span>{totalMediaMb.toFixed(2)} MB / 40 MB</span>
            </div>
            {mediaError && <p className="form-error">{mediaError}</p>}
            {!mediaValidation.ok && !mediaError && <p className="form-error">{mediaValidation.message}</p>}
            {selectedMedia.length === 0 && <p className="media-empty-note">No images attached. The PDF will still generate with unit details.</p>}
            <div className="upload-preview-grid">
              {selectedMedia.map((file) => (
                <div className="upload-preview-card" key={file.id}>
                  <img src={file.url} alt={file.name} />
                  <div>
                    <strong>{file.name}</strong>
                    <small>{(file.sizeBytes / (1024 * 1024)).toFixed(2)} MB</small>
                  </div>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => {
                      const nextMedia = selectedMedia.filter((item) => item.id !== file.id)
                      const validation = validateMediaUpload(nextMedia)
                      setSelectedMedia(nextMedia)
                      setMediaError(validation.ok ? null : validation.message ?? 'Invalid media upload.')
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
          <button className="primary-button" type="submit">
            Create unit and notify team
          </button>
        </section>

        <div className="wizard-actions">
          <button className="secondary-button" type="button" disabled={activeStepIndex === 0} onClick={() => goToRelativeStep(-1)}>
            Back
          </button>
          {activeStep !== 'Review' && (
            <button className="primary-button" type="button" onClick={() => goToRelativeStep(1)}>
              Next
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
}: {
  user: LeadraUser
  unit: LeadraUnit
  onArchive: () => void
  onStatusChange: (status: UnitStatus) => void
  onGeneratePdf: () => void
}) {
  const ownerAllowed = canViewOwnerData(user, unit)

  return (
    <section className="page-stack">
      <div className="details-hero">
        <div>
          <p className="eyebrow">Unit details</p>
          <h2>{unit.unitCode}</h2>
          <p>{unit.projectName} / {unit.destinationName} / {unit.unitType}</p>
        </div>
        <span className={`status-pill ${unit.status}`}>{statusLabels[unit.status]}</span>
      </div>
      <div className="details-actions">
        <div className="action-row wrap">
          <button className="secondary-button" type="button" onClick={() => onStatusChange('hold')}>Mark Hold</button>
          <button className="secondary-button" type="button" onClick={() => onStatusChange('sold')}>Mark Sold</button>
        </div>
        <div className="action-row wrap">
          <button className="primary-button" type="button" onClick={onGeneratePdf}><FileText size={18} /> Generate PDF</button>
          <button className="secondary-button" type="button" onClick={onGeneratePdf}><Download size={18} /> Share/download PDF</button>
          {canArchiveUnit(user, unit) && <button className="danger-button" type="button" onClick={onArchive}><Archive size={18} /> Archive</button>}
        </div>
      </div>
      <InfoSection title="Main unit information" rows={[
        ['Developer', unit.developerName],
        ['Project', unit.projectName],
        ['Destination', unit.destinationName],
        ['Floor', unit.floor],
        ['BUA', `${unit.bua} sqm`],
        ['Land Area', unit.landArea ? `${unit.landArea} sqm` : 'Not set'],
        ['View', unit.viewName],
        ['Bedrooms / Bathrooms', `${unit.bedrooms} / ${unit.bathrooms}`],
        ['Elevator', unit.elevator ? 'Yes' : 'No'],
      ]} />
      <InfoSection title="Pricing and payment information" rows={[
        ['Payment Method', unit.paymentMethod],
        ['Total Amount', formatCurrency(unit.totalAmount)],
        ['Down Payment', formatCurrency(unit.downPayment)],
        ['Remaining Payment', formatCurrency(unit.remainingPayment)],
        ['Commission', `${formatCurrency(unit.commissionAmount)} (${unit.commissionPercentage}%)`],
        ['Installment Amount', formatCurrency(unit.installmentAmount)],
      ]} />
      <InfoSection title="Delivery expectancy" rows={[['Expected delivery', formatDeliveryExpectancy(unit)]]} />
      <section className="content-card">
        <h2>Notes</h2>
        <p>{unit.salesNotes}</p>
        {unit.adminManagerNotes.map((note) => (
          <div className="note-card" key={note.id}>
            <strong>{note.createdByName} / {note.role}</strong>
            <p>{note.content}</p>
            <small>{new Date(note.createdAt).toLocaleString()}</small>
          </div>
        ))}
        {!canAddAdminManagerNote(user) && <small>Sales users can view admin/manager notes but cannot add them.</small>}
      </section>
      <section className="media-grid">
        {unit.media.map((file) => (
          <div className="media-card" key={file.id}>
            {file.type === 'image' ? <img src={file.url} alt={file.name} /> : <div className="video-placeholder">Video ignored in PDF</div>}
          </div>
        ))}
      </section>
      <InfoSection title="Owner data" rows={[
        ['Owner Name', ownerAllowed ? unit.originalOwnerName ?? 'Not set' : 'Hidden by permission'],
        ['Owner Phone', ownerAllowed ? unit.originalOwnerPhone ?? 'Not set' : 'Hidden by permission'],
        ['Normalized Phone', ownerAllowed ? unit.normalizedOwnerPhone ?? 'Not set' : 'Backend only / hidden'],
      ]} />
    </section>
  )
}

function NotificationsPage({ notifications, user }: { notifications: NotificationItem[]; user: LeadraUser }) {
  const visibleNotifications = notifications.filter(
    (notification) => notification.userId === user.id || notification.audienceRole === user.role || (!notification.userId && !notification.audienceRole),
  )

  return (
    <section className="content-card">
      <h2>Notifications Center</h2>
      {visibleNotifications.length === 0 && <EmptyState title="No notifications yet" body="You're caught up. New comments and status changes will show here." />}
      {visibleNotifications.map((notification) => (
        <div className="notification-row" key={notification.id}>
          <Bell size={17} />
          <div>
            <strong>{notification.title}</strong>
            <p>{notification.body}</p>
            <small>{new Date(notification.createdAt).toLocaleString()}</small>
          </div>
        </div>
      ))}
    </section>
  )
}

function AnalyticsPage({ dashboard, user }: { dashboard: AnalyticsDashboard; user: LeadraUser }) {
  const topSales = dashboard.salesPerformance.slice(0, 4)
  const latestTimeline = dashboard.activityTimeline.slice(-7)
  const averageTargetProgress =
    dashboard.targetProgress.length === 0
      ? 0
      : Math.round(dashboard.targetProgress.reduce((total, target) => total + target.activityProgress, 0) / dashboard.targetProgress.length)

  return (
    <section className="page-stack analytics-page">
      <div className="details-hero analytics-hero">
        <div className="analytics-hero-copy">
          <p className="eyebrow">{dashboard.scopeLabel}</p>
          <h2>{user.role === 'manager' ? 'Team Analytics' : 'Company Analytics'}</h2>
          <p>Live executive overview with sales performance, inventory health, workflow risk, and target progress.</p>
        </div>
        <div className="analytics-hero-side">
          <div className="analytics-range" aria-label="Analytics time windows">
            <span>Live</span>
            <span>30 days</span>
            <span>90 days</span>
          </div>
          <div className="analytics-signal-card">
            <span>Pipeline signal</span>
            <strong>{dashboard.overview.availableUnits}/{dashboard.overview.totalActiveUnits}</strong>
            <small>available units active</small>
          </div>
        </div>
      </div>

      <section className="metric-grid analytics-metrics">
        <Metric label="Active units" value={dashboard.overview.totalActiveUnits} />
        <Metric label="Sold value" value={formatCurrency(dashboard.overview.soldValue)} />
        <Metric label="Projected commission" value={formatCurrency(dashboard.overview.projectedCommission)} />
        <Metric label="PDF exports" value={dashboard.overview.pdfExports} />
        <Metric label="Duplicate attempts" value={dashboard.overview.duplicateAttempts} />
        <Metric label="Stale units" value={dashboard.overview.staleUnits} />
      </section>

      <div className="page-grid">
        <section className="content-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Sales performance</p>
              <h2>Team contribution</h2>
            </div>
          </div>
          {topSales.length === 0 && <EmptyState title="No sales activity yet" body="Unit uploads, sold value, and activity events will appear here." />}
          {topSales.map((row) => (
            <div className="analytics-row" key={row.userId}>
              <div>
                <strong>{row.userName}</strong>
                <p>{row.unitsCreated} uploaded / {row.unitsSold} sold / {row.activityCount} events</p>
              </div>
              <div className="analytics-row-stat">
                <span>{formatCurrency(row.commissionContribution)}</span>
                <small>commission</small>
              </div>
            </div>
          ))}
        </section>

        <section className="content-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Workflow risk</p>
              <h2>Status health</h2>
            </div>
          </div>
          <div className="status-stack">
            <MiniBar label="Available" value={dashboard.overview.availableUnits} total={dashboard.overview.totalActiveUnits} />
            <MiniBar label="Hold" value={dashboard.overview.holdUnits} total={dashboard.overview.totalActiveUnits} />
            <MiniBar label="Sold" value={dashboard.overview.soldUnits} total={dashboard.overview.totalActiveUnits} />
            <MiniBar label="Archived" value={dashboard.overview.archivedUnits} total={Math.max(1, dashboard.overview.totalActiveUnits + dashboard.overview.archivedUnits)} />
          </div>
        </section>
      </div>

      <section className="content-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Inventory health</p>
            <h2>Project ranking</h2>
          </div>
        </div>
        <div className="analytics-table">
          {dashboard.inventoryHealth.map((project) => (
            <div className="analytics-row project-health-row" key={project.projectId}>
              <div>
                <strong>{project.projectName}</strong>
                <p>{project.developerName} / {project.destinationName}</p>
              </div>
              <span className="analytics-chip">{project.availableUnits} available</span>
              <span className="analytics-chip warning">{project.holdRatio}% hold</span>
              <span className="analytics-chip success">{project.mediaCompleteness}% media</span>
            </div>
          ))}
        </div>
      </section>

      <div className="page-grid">
        <section className="content-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Targets</p>
              <h2>Progress</h2>
            </div>
            <span className="analytics-chip success">{averageTargetProgress}% activity</span>
          </div>
          {dashboard.targetProgress.map((target) => (
            <div className="target-card" key={target.targetId}>
              <div className="target-card-header">
                <strong>{target.label}</strong>
                <span>{target.activityProgress}%</span>
              </div>
              <MiniBar label="Units created" value={target.unitsCreatedProgress} total={100} suffix="%" />
              <MiniBar label="Activity" value={target.activityProgress} total={100} suffix="%" />
              <MiniBar label="Sold value" value={target.soldValueProgress} total={100} suffix="%" />
            </div>
          ))}
        </section>

        <section className="content-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Timeline</p>
              <h2>Recent activity</h2>
            </div>
          </div>
          <div className="timeline-chart" aria-label="Recent analytics activity timeline">
            {latestTimeline.length === 0 && <EmptyState title="No timeline data yet" body="Events from unit creation, status changes, and exports will populate this chart." />}
            {latestTimeline.map((point) => (
              <div className="timeline-bar" key={point.date}>
                <span style={{ height: `${Math.max(18, point.activityCount * 20)}px` }} title={`${point.activityCount} events on ${point.date}`} />
                <small>{point.date.slice(5).replace('-', '/')}</small>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  )
}

function ProfilePage({ user }: { user: LeadraUser }) {
  return (
    <section className="page-stack">
      <div className="profile-hero">
        <div className="profile-avatar">{user.fullName.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div>
        <div>
          <p className="eyebrow">Profile & Settings</p>
          <h2>{user.fullName}</h2>
          <p>{user.jobTitle}</p>
        </div>
      </div>
      <InfoSection title="Account details" rows={[
        ['Name', user.fullName],
        ['Email', user.email],
        ['Phone', user.phoneNumber],
        ['Role', user.role],
        ['Team', user.teamId],
        ['Branch', user.branchId],
        ['Status', user.status],
      ]} />
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
  const [activeSection, setActiveSection] = useState<(typeof adminSections)[number]>('Users')
  const [userQuery, setUserQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<LeadraUser['role'] | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<LeadraUser['status'] | 'all'>('all')
  const [teamFilter, setTeamFilter] = useState('all')
  const [sortUsersBy, setSortUsersBy] = useState<'role' | 'name' | 'recent'>('role')
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [createUserOpen, setCreateUserOpen] = useState(false)
  const teamOptions = Array.from(new Set(users.map((user) => user.teamId))).sort((first, second) => first.localeCompare(second))
  const filteredUsers = users
    .filter((user) => {
      const query = userQuery.trim().toLowerCase()
      const matchesQuery =
        query.length === 0 ||
        user.fullName.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.teamId.toLowerCase().includes(query) ||
        user.branchId.toLowerCase().includes(query) ||
        user.jobTitle.toLowerCase().includes(query)
      const matchesRole = roleFilter === 'all' || user.role === roleFilter
      const matchesStatus = statusFilter === 'all' || user.status === statusFilter
      const matchesTeam = teamFilter === 'all' || user.teamId === teamFilter

      return matchesQuery && matchesRole && matchesStatus && matchesTeam
    })
    .sort((first, second) => {
      if (sortUsersBy === 'name') return first.fullName.localeCompare(second.fullName)
      if (sortUsersBy === 'recent') {
        return new Date(second.lastLoginAt ?? second.createdAt ?? 0).getTime() - new Date(first.lastLoginAt ?? first.createdAt ?? 0).getTime()
      }

      return roleOrder[first.role] - roleOrder[second.role] || first.fullName.localeCompare(second.fullName)
    })
  const userCountsByRole = users.reduce<Record<LeadraUser['role'], number>>(
    (counts, user) => ({ ...counts, [user.role]: counts[user.role] + 1 }),
    { admin: 0, sub_admin: 0, manager: 0, sales: 0 },
  )

  return (
    <section className="wizard-shell admin-workspace">
      <div className="wizard-steps" aria-label="Admin sections">
        {adminSections.map((section) => (
          <button
            key={section}
            className={`wizard-step ${section === activeSection ? 'active' : ''}`}
            type="button"
            aria-current={section === activeSection ? 'step' : undefined}
            onClick={() => setActiveSection(section)}
          >
            {section}
          </button>
        ))}
      </div>

      <section className="content-card admin-panel" hidden={activeSection !== 'Users'}>
        <div className="admin-user-header">
          <div>
            <p className="eyebrow">People operations</p>
            <h2><Users size={19} /> User Management</h2>
            <p>Find, group, order, and edit users without mixing roles into one anonymous list.</p>
          </div>
          <div className="admin-user-side">
            <div className="user-role-counts" aria-label="User role counts">
              <span>{userCountsByRole.admin} Admin</span>
              <span>{userCountsByRole.sub_admin} Sub</span>
              <span>{userCountsByRole.manager} Manager</span>
              <span>{userCountsByRole.sales} Sales</span>
            </div>
            <button className="primary-button" type="button" onClick={() => setCreateUserOpen((open) => !open)}>
              {createUserOpen ? 'Close form' : 'New user'}
            </button>
          </div>
        </div>
        {createUserOpen && (
          <form
            className="settings-form create-user-panel"
            onSubmit={(event) => {
              event.preventDefault()
              onCreateUser(new FormData(event.currentTarget))
              event.currentTarget.reset()
              setCreateUserOpen(false)
            }}
          >
            <label>
              Full name
              <input name="fullName" required placeholder="New team member" />
            </label>
            <label>
              Email
              <input name="email" type="email" required placeholder="user@leadra.com" />
            </label>
            <label>
              Role
              <select name="role" defaultValue="sales">
                <option value="sales">Sales Representative</option>
                <option value="manager">Manager</option>
                <option value="sub_admin">Sub Admin</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <label>
              Job title
              <input name="jobTitle" required defaultValue="Sales Representative" />
            </label>
            <label>
              Phone number
              <input name="phoneNumber" required defaultValue="+201000000000" />
            </label>
            <label>
              Team
              <input name="teamId" required defaultValue="team-prime" />
            </label>
            <label>
              Branch
              <input name="branchId" required defaultValue="branch-cairo" />
            </label>
            <button className="secondary-button" type="submit">Create user</button>
          </form>
        )}

        <div className="user-management-tools" aria-label="User management controls">
          <label className="wide-field">
            Search users
            <input
              value={userQuery}
              onChange={(event) => setUserQuery(event.target.value)}
              placeholder="Name, email, team, branch, title..."
            />
          </label>
          <label>
            Role
            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as LeadraUser['role'] | 'all')}>
              <option value="all">All roles</option>
              <option value="admin">Admin</option>
              <option value="sub_admin">Sub Admin</option>
              <option value="manager">Manager</option>
              <option value="sales">Sales</option>
            </select>
          </label>
          <label>
            Team
            <select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}>
              <option value="all">All teams</option>
              {teamOptions.map((teamId) => (
                <option key={teamId} value={teamId}>{teamId}</option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as LeadraUser['status'] | 'all')}>
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <label>
            Sort
            <select value={sortUsersBy} onChange={(event) => setSortUsersBy(event.target.value as 'role' | 'name' | 'recent')}>
              <option value="role">Role priority</option>
              <option value="name">Name A-Z</option>
              <option value="recent">Recent login</option>
            </select>
          </label>
        </div>

        <div className="user-list-header">
          <strong>{filteredUsers.length} users shown</strong>
          <small>Ordered by {sortUsersBy === 'role' ? 'role priority' : sortUsersBy === 'name' ? 'name' : 'recent login'}</small>
        </div>

        <div className="user-management-list" aria-label="Managed users">
          {filteredUsers.map((item) => (
            <UserManagementCard
              key={item.id}
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
          {filteredUsers.length === 0 && <EmptyState title="No users match" body="Clear filters or search for another team, role, branch, name, or email." />}
        </div>
      </section>

      <section className="content-card admin-panel" hidden={activeSection !== 'Settings'}>
        <h2><Settings size={19} /> Unit Management</h2>
        <p>Dropdown values, commission percentage, teams, branches, company logo, media limit, and payment options are managed here.</p>
        <form
          className="settings-form"
          onSubmit={(event) => {
            event.preventDefault()
            const formData = new FormData(event.currentTarget)
            onSettingsUpdate(Number(formData.get('commissionPercentage')))
          }}
        >
          <label>
            Commission percentage
            <input name="commissionPercentage" type="number" step="0.1" defaultValue={settings.commissionPercentage} />
          </label>
          <button className="secondary-button" type="submit">Save settings</button>
        </form>
      </section>

      <section className="content-card admin-panel" hidden={activeSection !== 'Metrics'}>
        <h2>Admin Metrics</h2>
        <div className="metric-grid tight">
          <Metric label="Dropdowns" value={lookupCount} />
          <Metric label="Commission" value={`${settings.commissionPercentage}%`} />
          <Metric label="Media limit" value={`${settings.mediaLimitMb} MB`} />
          <Metric label="Units" value={units.length} />
        </div>
      </section>

      <section className="content-card admin-panel" hidden={activeSection !== 'Audit'}>
        <h2>Audit Log</h2>
        {auditLogs.map((item) => (
          <div className="admin-row" key={item.id}>
            <strong>{item.actionType}</strong>
            <span>{item.actorName} / {item.actorRole}</span>
            <small>{item.relatedUnitCode} / {new Date(item.createdAt).toLocaleString()}</small>
          </div>
        ))}
      </section>
    </section>
  )
}

function UserManagementCard({
  user,
  isEditing,
  onEdit,
  onCancel,
  onSave,
}: {
  user: LeadraUser
  isEditing: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: (updates: Partial<LeadraUser>) => void
}) {
  return (
    <article className={`user-management-card ${user.status}`}>
      <div className="user-card-main">
        <div className="user-avatar">{user.fullName.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div>
        <div>
          <div className="user-card-title">
            <strong>{user.fullName}</strong>
            <span className={`status-pill ${user.status === 'active' ? 'available' : 'sold'}`}>{user.status}</span>
          </div>
          <p>{user.jobTitle}</p>
          <small>{user.email} / {user.phoneNumber}</small>
        </div>
      </div>

      <div className="user-card-meta">
        <span>{user.role.replace('_', ' ')}</span>
        <span>{user.teamId}</span>
        <span>{user.branchId}</span>
        <span>{user.lastLoginAt ? `Last ${new Date(user.lastLoginAt).toLocaleDateString()}` : 'No login yet'}</span>
      </div>

      {!isEditing && (
        <button className="secondary-button" type="button" onClick={onEdit}>
          Edit user
        </button>
      )}

      {isEditing && (
        <form
          className="user-edit-form"
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
            Full name
            <input name="fullName" defaultValue={user.fullName} required />
          </label>
          <label>
            Email
            <input name="email" type="email" defaultValue={user.email} required />
          </label>
          <label>
            Role
            <select name="role" defaultValue={user.role}>
              <option value="admin">Admin</option>
              <option value="sub_admin">Sub Admin</option>
              <option value="manager">Manager</option>
              <option value="sales">Sales Representative</option>
            </select>
          </label>
          <label>
            Status
            <select name="status" defaultValue={user.status}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <label>
            Job title
            <input name="jobTitle" defaultValue={user.jobTitle} required />
          </label>
          <label>
            Phone
            <input name="phoneNumber" defaultValue={user.phoneNumber} required />
          </label>
          <label>
            Team
            <input name="teamId" defaultValue={user.teamId} required />
          </label>
          <label>
            Branch
            <input name="branchId" defaultValue={user.branchId} required />
          </label>
          <div className="user-edit-actions">
            <button className="secondary-button" type="button" onClick={onCancel}>Cancel</button>
            <button className="primary-button" type="submit">Save user</button>
          </div>
        </form>
      )}
    </article>
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

function SelectField({ name, label, values }: { name: string; label: string; values: { id: string; label: string }[] }) {
  return (
    <label>
      {label}
      <select name={name} defaultValue={values[0]?.id}>
        {values.map((item) => (
          <option key={item.id} value={item.id}>{item.label}</option>
        ))}
      </select>
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

function InfoSection({ title, rows }: { title: string; rows: [string, string | number | null][] }) {
  return (
    <section className="content-card">
      <h2>{title}</h2>
      <dl className="info-grid">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value ?? 'Not set'}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="metric-card">
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
  const width = total <= 0 ? 0 : Math.min(100, Math.round((value / total) * 100))

  return (
    <div className="mini-bar">
      <div>
        <span>{label}</span>
        <strong>{value}{suffix}</strong>
      </div>
      <div className="mini-bar-track">
        <span style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}

function NavButton({ active, label, onClick, icon }: { active: boolean; label: string; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button className={`nav-button ${active ? 'active' : ''}`} type="button" onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  )
}

function dashboardTitle(role: LeadraUser['role']) {
  if (role === 'sales') return 'Your uploads, notes, and inactivity warnings'
  if (role === 'manager') return 'Team uploads, status changes, and employee alerts'
  return 'All teams, duplicate attempts, PDF exports, and monthly movement'
}

function dashboardDescription(role: LeadraUser['role']) {
  if (role === 'sales') return 'Owner-sensitive information is only visible for units you uploaded.'
  if (role === 'manager') return 'Managers see team units only; branch assignment does not expand visibility.'
  return 'Admins and sub-admins manage users, dropdowns, audit history, and PDF branding.'
}

function getViewTitle(view: View, user: LeadraUser): string {
  if (view === 'dashboard') return user.role === 'admin' ? 'Admin command' : `${user.fullName.split(' ')[0]} command`
  if (view === 'units' || view === 'details') return 'Unit desk'
  if (view === 'create') return 'New resale'
  if (view === 'notifications') return 'Alerts'
  if (view === 'profile') return 'Profile'
  if (view === 'analytics') return 'Analytics'
  return 'Admin'
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
  if (
    value === 'units' ||
    value === 'create' ||
    value === 'notifications' ||
    value === 'profile' ||
    value === 'analytics' ||
    value === 'admin'
  ) {
    return value
  }

  return 'dashboard'
}

function writeHashView(view: HashView) {
  const nextHash = view === 'dashboard' ? '' : `#${view}`
  window.history.replaceState(null, '', `${window.location.pathname}${nextHash}`)
}

export default App
