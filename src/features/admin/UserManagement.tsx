import { useState } from 'react'
import { formatDate, getAccountStatusLabel, getRoleLabel, getUserInitials, useLocale } from '../../lib/i18n'
import type { LeadraUser } from '../../lib/types'
import { ControlledSelectField, NamedSelectField, PasswordField, type BrandedSelectOption } from '../../components/LeadraUi'
import { readFormEnum, readFormString } from '../shared/formUtils'
import { motionStyle } from '../shared/motion'

type UserManagementCardProps = {
  user: LeadraUser
  index?: number
  isEditing: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: (updates: Partial<LeadraUser>) => Promise<void>
  onPasswordUpdate: (password: string) => Promise<void>
  teamOptions: BrandedSelectOption[]
  branchOptions: BrandedSelectOption[]
  hasActiveAssignedUnits: boolean
  salesReplacementOptions: LeadraUser[]
  onDeleteSalesRepresentative: (replacementSalesUserId: string) => Promise<void>
  onDeleteManagedUser: () => Promise<void>
}

export function UserManagementCard({
  user,
  index = 0,
  isEditing,
  onEdit,
  onCancel,
  onSave,
  onPasswordUpdate,
  teamOptions,
  branchOptions,
  hasActiveAssignedUnits,
  salesReplacementOptions,
  onDeleteSalesRepresentative,
  onDeleteManagedUser,
}: UserManagementCardProps) {
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
  const requiresReassignment = user.status === 'active' && user.role !== 'admin' && hasActiveAssignedUnits
  const canDeleteManagedUser = user.role === 'sales'
    ? !user.deletedAt
    : user.role !== 'admin' && user.status === 'active' && !user.deletedAt
  const statusOptions = requiresReassignment
    ? [{ value: 'active', label: t('admin.statusActive') }]
    : [
        { value: 'active', label: t('admin.statusActive') },
        { value: 'inactive', label: t('admin.statusInactive') },
      ]

  return (
    <article className={`user-management-card motion-stage ${user.status}`} style={motionStyle(index)}>
      <div className="user-card-main">
        <div className="user-avatar">{getUserInitials(user.fullName)}</div>
        <div>
          <div className="user-card-title">
            <strong dir="auto">{user.fullName}</strong>
            <span className={`status-pill ${user.status === 'active' ? 'available' : 'sold'}`}>{getAccountStatusLabel(locale, user.status)}</span>
          </div>
          <p dir="auto">{user.jobTitle}</p>
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
              await onSave(readUserProfileUpdates(formData, user))
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
            options={statusOptions}
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
            if (requiresReassignment && !replacementSalesUserId) {
              setDeleteError(t('admin.selectReplacementSalesRep'))
              return
            }

            setDeletePending(true)
            try {
              if (requiresReassignment) {
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
              {requiresReassignment
                ? t('admin.reassignBeforeDelete', { name: user.fullName })
                : t('admin.deleteUserConfirmTitle', { name: user.fullName })}
            </strong>
            <small>{requiresReassignment ? t('admin.reassignBeforeDeleteCopy') : t('admin.deleteUserConfirmCopy')}</small>
          </div>
          {requiresReassignment && (
            <ControlledSelectField
              label={t('admin.replacementSalesRep')}
              options={salesReplacementOptions.map((item) => ({ value: item.id, label: item.fullName }))}
              value={replacementSalesUserId}
              disabled={deletePending || salesReplacementOptions.length === 0}
              onValueChange={setReplacementSalesUserId}
            />
          )}
          {requiresReassignment && salesReplacementOptions.length === 0 && <p className="form-error">{t('admin.noReplacementSalesRep')}</p>}
          {deleteError && <p className="form-error">{deleteError}</p>}
          <div className="user-edit-actions">
            <button className="secondary-button" type="button" onClick={() => setDeleteEditorOpen(false)} disabled={deletePending}>
              {t('common.cancel')}
            </button>
            <button className="danger-button" type="submit" disabled={deletePending || (requiresReassignment && salesReplacementOptions.length === 0)}>
              {deletePending ? t('common.saving') : requiresReassignment ? t('admin.confirmDeleteSalesRep') : t('admin.confirmDeleteUser')}
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

function readUserProfileUpdates(formData: FormData, user: LeadraUser): Partial<LeadraUser> {
  return {
    fullName: readFormString(formData, 'fullName'),
    email: readFormString(formData, 'email'),
    role: readFormEnum(formData, 'role', ['admin', 'sub_admin', 'manager', 'sales'] as const, user.role),
    jobTitle: readFormString(formData, 'jobTitle'),
    phoneNumber: readFormString(formData, 'phoneNumber'),
    teamId: readFormString(formData, 'teamId'),
    branchId: readFormString(formData, 'branchId'),
    status: readFormEnum(formData, 'status', ['active', 'inactive'] as const, user.status),
  }
}
