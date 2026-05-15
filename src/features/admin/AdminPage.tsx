import { Image as ImageIcon, Settings, Trash2, Users } from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { compareText, formatCount, formatDateTime, getRoleLabel, useLocale } from '../../lib/i18n'
import { renderAuditAction } from '../../lib/messageRendering'
import type { AppSettings, AuditLogItem, BranchDirectoryItem, LeadraUnit, LeadraUser, LookupKind, LookupValue, TeamDirectoryItem } from '../../lib/types'
import { ControlledSelectField, EmptyState, Metric, NamedSelectField, PasswordField } from '../../components/LeadraUi'
import { adminSections, auditLogPageSize, maxLogoUploadBytes, roleOrder, userManagementPageSize, type AdminSection, type LookupThumbnailChange, type MasterDataDirectory } from '../shared/constants'
import { fileToDataUrl } from '../shared/media'
import { motionStyle } from '../shared/motion'
import { sortLabel, translateAdminSection } from '../shared/labels'
import { MasterDataPanel } from './MasterData'
import { UserManagementCard } from './UserManagement'

export function AdminPage({
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
  onCreateLookupValue: (kind: LookupKind, label: string, thumbnailFile?: File | null) => Promise<void>
  onUpdateLookupValue: (lookupId: string, label: string, thumbnailChange?: LookupThumbnailChange) => Promise<void>
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
  const [logoPathDraft, setLogoPathDraft] = useState(settings.logoPath)
  const [logoUploadError, setLogoUploadError] = useState('')
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
  const defaultCreateBranchId = branchOptions.some((option) => option.value === defaultBranchId)
    ? defaultBranchId
    : branchOptions[0]?.value ?? ''
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

  useEffect(() => {
    setLogoPathDraft(settings.logoPath)
  }, [settings.logoPath])

  async function handleLogoFileChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setLogoUploadError(t('admin.logoInvalid'))
      input.value = ''
      return
    }
    if (file.size > maxLogoUploadBytes) {
      setLogoUploadError(t('admin.logoTooLarge'))
      input.value = ''
      return
    }

    try {
      setLogoPathDraft(await fileToDataUrl(file))
      setLogoUploadError('')
    } catch {
      setLogoUploadError(t('admin.logoReadFailed'))
    } finally {
      input.value = ''
    }
  }

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
              {branchOptions.length > 0 ? (
                <NamedSelectField
                  defaultValue={defaultCreateBranchId}
                  label={t('admin.branch')}
                  name="branchId"
                  options={branchOptions}
                />
              ) : (
                <label>
                  {t('admin.branch')}
                  <input name="branchId" dir="auto" placeholder={defaultBranchId || undefined} />
                </label>
              )}
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
                logoPath: logoPathDraft,
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
            <div className="logo-upload-field wide-field">
              {t('admin.logoPath')}
              <div className="logo-upload-control">
                <div className="logo-upload-preview" aria-label={t('admin.logoPreview')}>
                  {logoPathDraft ? <img src={logoPathDraft} alt={t('admin.logoPreview')} /> : <ImageIcon size={28} />}
                </div>
                <div className="logo-upload-actions">
                  <label className="secondary-button logo-upload-button">
                    <ImageIcon size={16} /> {t('admin.logoUploadAction')}
                    <input type="file" accept="image/png,image/jpeg" onChange={(event) => void handleLogoFileChange(event)} />
                  </label>
                  {logoPathDraft && (
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => {
                        setLogoPathDraft('')
                        setLogoUploadError('')
                      }}
                    >
                      <Trash2 size={16} /> {t('admin.logoRemove')}
                    </button>
                  )}
                </div>
              </div>
              <small>{t('admin.logoUploadHint')}</small>
              {logoUploadError && <p className="form-error motion-feedback">{logoUploadError}</p>}
            </div>
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
