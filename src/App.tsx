import {
  Archive,
  Bell,
  Building2,
  Download,
  FileText,
  Home,
  Image as ImageIcon,
  LogOut,
  Plus,
  SlidersHorizontal,
  Search,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { demoUsers, initialAppState, lookupValues } from './data/seed'
import {
  canAddAdminManagerNote,
  canArchiveUnit,
  canSearchOwnerPhone,
  canViewOwnerData,
  filterUnitsForUser,
  formatCurrency,
  formatDeliveryExpectancy,
  getThumbnailMedia,
  searchUnits,
  summarizeProjects,
} from './lib/domain'
import { downloadTextPdfFallback } from './lib/pdf'
import { isSupabaseConfigured } from './lib/supabase'
import type { AppSettings, AuditLogItem, LeadraMediaFile, LeadraUnit, LeadraUser, NotificationItem, PaymentMethod, UnitStatus } from './lib/types'
import { archiveUnitWorkflow, createUnitWorkflow, createUserWorkflow, updateSettingsWorkflow, updateUnitStatusWorkflow } from './lib/workflows'

type View = 'dashboard' | 'units' | 'create' | 'details' | 'notifications' | 'profile' | 'admin'
type HashView = Exclude<View, 'details'>

const statusLabels: Record<UnitStatus, string> = {
  available: 'Available',
  hold: 'Hold',
  sold: 'Sold',
}

function App() {
  const [currentUser, setCurrentUser] = useState<LeadraUser | null>(null)
  const [view, setView] = useState<View>(() => readHashView())
  const [appState, setAppState] = useState(initialAppState)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null)
  const [unitCodeFilter, setUnitCodeFilter] = useState('')
  const [ownerPhoneFilter, setOwnerPhoneFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<UnitStatus | 'all'>('all')
  const [flash, setFlash] = useState<string | null>(null)

  useEffect(() => {
    function syncViewFromHash() {
      const requestedView = readHashView()
      setView(requestedView)
      setFlash(null)
    }

    window.addEventListener('hashchange', syncViewFromHash)
    return () => window.removeEventListener('hashchange', syncViewFromHash)
  }, [])

  if (!currentUser) {
    return (
      <LoginScreen
        onLogin={(nextUser) => {
          setCurrentUser(nextUser)
          const requestedView = readHashView()
          setView(requestedView === 'admin' && !canAccessAdmin(nextUser) ? 'dashboard' : requestedView)
          setFlash(null)
        }}
      />
    )
  }

  const user = currentUser
  const canUseAdmin = canAccessAdmin(user)
  const activeView = view === 'admin' && !canUseAdmin ? 'dashboard' : view
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
  }

  function addAuditNotification(title: string, body: string, unitCode?: string) {
    setAppState((state) => ({
      ...state,
      notifications: [
        {
          id: `notif-${Date.now()}`,
          title,
          body: unitCode ? `${body} (${unitCode})` : body,
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
          actionType: title,
          relatedUnitCode: unitCode,
          createdAt: new Date().toISOString(),
          ipAddress: null,
        },
        ...state.auditLogs,
      ],
    }))
  }

  function handleCreateUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const paymentMethod = String(formData.get('paymentMethod')) as PaymentMethod
    const totalAmount = Number(formData.get('totalAmount'))
    const downPayment = paymentMethod === 'installment' ? Number(formData.get('downPayment')) : null
    const projectId = String(formData.get('projectId'))
    const project = lookupValues.find((item) => item.id === projectId)
    const destinationId = String(formData.get('destinationId'))
    const destination = lookupValues.find((item) => item.id === destinationId)
    const developerId = String(formData.get('developerId'))
    const developer = lookupValues.find((item) => item.id === developerId)
    const viewId = String(formData.get('viewId'))
    const viewLookup = lookupValues.find((item) => item.id === viewId)
    const bedrooms = Number(formData.get('bedrooms'))
    const bathrooms = Number(formData.get('bathrooms'))
    const countryCode = String(formData.get('countryCode'))
    const originalOwnerPhone = String(formData.get('ownerPhone'))
    const newMedia: LeadraMediaFile[] = [
      {
        id: `media-${Date.now()}`,
        type: 'image',
        url: 'https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=900&q=80',
        name: 'uploaded-placeholder.jpg',
        sizeBytes: 1_100_000,
      },
    ]
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
      media: newMedia,
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

  function generatePdf(unit: LeadraUnit) {
    downloadTextPdfFallback(user, unit)
    addAuditNotification('PDF generated', 'Permission-safe branded PDF generated', unit.unitCode)
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
        {canUseAdmin && (
          <NavButton active={activeView === 'admin'} label="Admin" onClick={() => navigate('admin')} icon={<Settings />} />
        )}
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">Leadra internal resale system</p>
            <h1>{user.role === 'admin' ? 'Admin command' : `${user.fullName.split(' ')[0]} command`}</h1>
          </div>
          <div className="topbar-actions">
            <button className="user-chip" type="button" onClick={() => navigate('profile')}>
              <span>{user.fullName.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span>
              <strong>{user.role.replace('_', ' ')}</strong>
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={() => {
                setCurrentUser(null)
                setView('dashboard')
                writeHashView('dashboard')
                setFlash(null)
              }}
            >
              <LogOut size={17} /> Sign out
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
        {activeView === 'create' && <CreateUnitPage onSubmit={handleCreateUnit} />}
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
        {activeView === 'admin' && canUseAdmin && (
          <AdminPage
            users={appState.users}
            units={appState.units}
            settings={appState.settings}
            auditLogs={appState.auditLogs}
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
            onSettingsUpdate={(commissionPercentage) => {
              const result = updateSettingsWorkflow(appState, user, { commissionPercentage })
              setAppState(result.state)
              setFlash(result.ok ? 'Settings updated and audited.' : result.error)
            }}
          />
        )}
      </main>

      <nav className="bottom-nav" aria-label="Mobile navigation">
        <NavButton active={activeView === 'dashboard'} label="Home" onClick={() => navigate('dashboard')} icon={<Home />} />
        <NavButton active={activeView === 'units'} label="Units" onClick={() => navigate('units')} icon={<Building2 />} />
        <NavButton active={activeView === 'create'} label="Add" onClick={() => navigate('create')} icon={<Plus />} />
        <NavButton active={activeView === 'notifications'} label="Alerts" onClick={() => navigate('notifications')} icon={<Bell />} />
        <NavButton active={activeView === 'profile'} label="Profile" onClick={() => navigate('profile')} icon={<SlidersHorizontal />} />
        {canUseAdmin && (
          <NavButton active={activeView === 'admin'} label="Admin" onClick={() => navigate('admin')} icon={<Settings />} />
        )}
      </nav>
    </div>
  )
}

function LoginScreen({ onLogin }: { onLogin: (user: LeadraUser) => void }) {
  return (
    <main className="login-screen">
      <section className="login-card">
        <p className="eyebrow">Mobile-first resale operations</p>
        <h1>Leadra resale command</h1>
        <p className="login-copy">
          Internal unit management for sales representatives, managers, sub-admins, and admins. Demo roles are available until Supabase credentials are configured.
        </p>
        <div className="integration-badge">
          <ShieldCheck size={18} />
          {isSupabaseConfigured ? 'Supabase connected' : 'Local demo mode. Add Supabase env vars to connect production services.'}
        </div>
        <div className="role-grid" aria-label="Demo role login options">
          {demoUsers.map((user) => (
            <button key={user.id} className="role-card" type="button" onClick={() => onLogin(user)}>
              <span>{user.role.replace('_', ' ')}</span>
              <strong>Continue as {user.role === 'admin' ? 'Admin' : user.fullName}</strong>
              <small>{user.email}</small>
            </button>
          ))}
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

function CreateUnitPage({ onSubmit }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <section className="content-card create-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">PRD field order</p>
          <h2>Create Unit</h2>
        </div>
      </div>
      <form className="unit-form" onSubmit={onSubmit}>
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
        <button className="primary-button wide-field" type="submit">
          Create unit and notify team
        </button>
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
      <div className="action-row wrap">
        <button className="secondary-button" type="button" onClick={() => onStatusChange('hold')}>Mark Hold</button>
        <button className="secondary-button" type="button" onClick={() => onStatusChange('sold')}>Mark Sold</button>
        <button className="primary-button" type="button" onClick={onGeneratePdf}><FileText size={18} /> Generate PDF</button>
        <button className="secondary-button" type="button" onClick={onGeneratePdf}><Download size={18} /> Share/download PDF</button>
        {canArchiveUnit(user, unit) && <button className="danger-button" type="button" onClick={onArchive}><Archive size={18} /> Archive</button>}
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
  onCreateUser,
  onSettingsUpdate,
}: {
  users: LeadraUser[]
  units: LeadraUnit[]
  settings: AppSettings
  auditLogs: AuditLogItem[]
  onCreateUser: (formData: FormData) => void
  onSettingsUpdate: (commissionPercentage: number) => void
}) {
  return (
    <section className="page-grid">
      <section className="content-card">
        <h2><Users size={19} /> User Management</h2>
        <form
          className="settings-form"
          onSubmit={(event) => {
            event.preventDefault()
            onCreateUser(new FormData(event.currentTarget))
            event.currentTarget.reset()
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
        {users.map((user) => (
          <div className="admin-row" key={user.id}>
            <strong>{user.fullName}</strong>
            <span>{user.role.replace('_', ' ')}</span>
            <small>{user.status}</small>
          </div>
        ))}
      </section>
      <section className="content-card">
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
        <div className="metric-grid tight">
          <Metric label="Dropdowns" value={lookupValues.length} />
          <Metric label="Commission" value={`${settings.commissionPercentage}%`} />
          <Metric label="Media limit" value={`${settings.mediaLimitMb} MB`} />
          <Metric label="Units" value={units.length} />
        </div>
      </section>
      <section className="content-card wide-panel">
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

function canAccessAdmin(user: LeadraUser): boolean {
  return user.role === 'admin' || user.role === 'sub_admin'
}

function readHashView(): HashView {
  const value = window.location.hash.replace('#', '')
  if (value === 'units' || value === 'create' || value === 'notifications' || value === 'profile' || value === 'admin') {
    return value
  }

  return 'dashboard'
}

function writeHashView(view: HashView) {
  const nextHash = view === 'dashboard' ? '' : `#${view}`
  window.history.replaceState(null, '', `${window.location.pathname}${nextHash}`)
}

export default App
