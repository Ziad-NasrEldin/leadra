import {
  calculateInstallmentTotalAmount,
  calculatePaymentSummary,
  calculateDisplayedRemainingPayment,
  applyPaymentScheduleAction,
  canAddAdminManagerNote,
  canArchiveUnit,
  canEditAnyUnitDetails,
  canEditNonOwnerUnitDetails,
  canEditOwnerFields,
  canEditUnitCommission,
  canEditUnitPricing,
  canManageUnitSpecialStatus,
  canUseUnitOperationalActions,
  canViewUnit,
  generateUnitCode,
  createInitialPaymentSchedule,
  normalizeInstallmentMonth,
  normalizeUnitOutdoorFields,
  normalizeOwnerPhone,
  validateOwnerPhoneForCountry,
  unitHasSameProjectPhoneDuplicate,
  validateMediaUpload,
  isPrdUnitType,
} from './domain'
import type {
  AppDataState,
  AppSettings,
  AuditLogItem,
  AnalyticsEvent,
  AnalyticsEventType,
  CreateUnitInput,
  CreateUserInput,
  InstallmentType,
  LeadraUnit,
  LeadraUser,
  NotificationItem,
  UnitEditInput,
  UnitStatus,
  WorkflowResult,
} from './types'
import {
  createAuditMessage,
  createErrorMessage,
  createNotificationMessage,
  type LocalizedMessageRef,
} from './systemMessages'
import { diffUnitEditFields, emptyUser, isAdminActor, pickUnitEditAuditValue } from './workflowHelpers'

export function signInWorkflow(state: AppDataState, email: string): WorkflowResult<LeadraUser> {
  const user = state.users.find((item) => item.email.toLowerCase() === email.toLowerCase())

  if (!user) {
    return { ok: false, state: emptyUser(), ...createErrorMessage('error.invalidEmailOrPassword', 'Invalid email or password.') }
  }

  if (user.status !== 'active') {
    return { ok: false, state: user, ...createErrorMessage('error.inactiveUsersCannotLogIn', 'Inactive users cannot log in.') }
  }

  return { ok: true, state: { ...user, lastLoginAt: new Date().toISOString() } }
}

export function createUserWorkflow(
  state: AppDataState,
  actor: LeadraUser,
  input: CreateUserInput,
): WorkflowResult {
  if (!isAdminActor(actor)) {
    return { ok: false, state, ...createErrorMessage('error.onlyAdminsCanCreateUsers', 'Only Admin and Sub Admin can create users.') }
  }

  if (state.users.some((user) => user.email.toLowerCase() === input.email.toLowerCase())) {
    return { ok: false, state, ...createErrorMessage('error.userWithEmailExists', 'A user with this email already exists.') }
  }

  const user: LeadraUser = {
    id: `user-${Date.now()}`,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
    fullName: input.fullName,
    email: input.email,
    role: input.role,
    jobTitle: input.jobTitle,
    phoneNumber: input.phoneNumber,
    teamId: input.teamId,
    branchId: input.branchId,
    status: input.status,
  }

  const nextState = withAnalyticsEvent(
    withAudit(
      {
        ...state,
        users: [...state.users, user],
      },
      actor,
      createAuditMessage('user_created').text,
      undefined,
      undefined,
      { email: user.email, role: user.role },
      createAuditMessage('user_created'),
    ),
    actor,
    'settings_updated',
    { metadata: { operation: 'user_created', role: user.role } },
  )

  return {
    ok: true,
    state: nextState,
  }
}

export function deleteSalesRepresentativeWorkflow(
  state: AppDataState,
  actor: LeadraUser,
  salesUserId: string,
  replacementSalesUserId: string,
): WorkflowResult {
  if (!isAdminActor(actor)) {
    return { ok: false, state, ...createErrorMessage('error.onlyAdminsCanCreateUsers', 'Only Admin and Sub Admin can create users.') }
  }

  const salesUser = state.users.find((item) => item.id === salesUserId)
  const replacement = state.users.find((item) => item.id === replacementSalesUserId)

  if (!salesUser || salesUser.role !== 'sales') {
    return { ok: false, state, error: 'Select a sales representative to deactivate.', errorKey: null, errorParams: null }
  }

  if (!replacement || replacement.role !== 'sales' || replacement.status !== 'active' || replacement.deletedAt) {
    return { ok: false, state, error: 'Select an active replacement sales representative.', errorKey: null, errorParams: null }
  }

  if (salesUser.id === replacement.id) {
    return { ok: false, state, error: 'Replacement sales representative must be different from the deleted sales representative.', errorKey: null, errorParams: null }
  }

  const now = new Date().toISOString()
  const reassignedUnits = state.units.filter((unit) => unit.createdBy === salesUser.id)
  const auditMessage = createAuditMessage('sales_rep_deactivated_after_reassignment', {
    deletedName: salesUser.fullName,
    replacementName: replacement.fullName,
    count: reassignedUnits.length,
  })
  const nextState = withAnalyticsEvent(
    withAudit(
      {
        ...state,
        users: state.users.map((item) =>
          item.id === salesUser.id ? { ...item, status: 'inactive', deletedAt: now } : item,
        ),
        units: state.units.map((unit) =>
          unit.createdBy === salesUser.id
            ? {
                ...unit,
                createdBy: replacement.id,
                createdByName: replacement.fullName,
                teamId: replacement.teamId,
                branchId: replacement.branchId,
                updatedAt: now,
              }
            : unit,
        ),
      },
      actor,
      auditMessage.text,
      salesUser.id,
      { salesUserId: salesUser.id, assignedUnits: reassignedUnits.length },
      { replacementSalesUserId: replacement.id, assignedUnits: reassignedUnits.length },
      auditMessage,
    ),
    actor,
    'settings_updated',
    {
      metadata: {
        operation: 'sales_rep_deactivated_after_reassignment',
        deactivatedSalesUserId: salesUser.id,
        replacementSalesUserId: replacement.id,
        reassignedUnitCount: reassignedUnits.length,
      },
    },
  )

  return { ok: true, state: nextState }
}

export function deleteManagedUserWorkflow(
  state: AppDataState,
  actor: LeadraUser,
  userId: string,
): WorkflowResult {
  if (!isAdminActor(actor)) {
    return { ok: false, state, ...createErrorMessage('error.onlyAdminsCanCreateUsers', 'Only Admin and Sub Admin can create users.') }
  }

  const managedUser = state.users.find((item) => item.id === userId)
  if (!managedUser) {
    return { ok: false, state, error: 'Select a user to delete.', errorKey: null, errorParams: null }
  }

  if (managedUser.role === 'admin') {
    return { ok: false, state, error: 'Admin accounts cannot be deleted from user management.', errorKey: null, errorParams: null }
  }

  if (managedUser.role === 'sales') {
    return { ok: false, state, error: 'Sales representatives require reassignment before deletion.', errorKey: null, errorParams: null }
  }

  const now = new Date().toISOString()
  const auditMessage = createAuditMessage('user_deleted', {
    deletedName: managedUser.fullName,
    role: managedUser.role,
  })
  const nextState = withAnalyticsEvent(
    withAudit(
      {
        ...state,
        users: state.users.map((item) =>
          item.id === managedUser.id ? { ...item, status: 'inactive', deletedAt: now } : item,
        ),
      },
      actor,
      auditMessage.text,
      managedUser.id,
      { userId: managedUser.id, status: managedUser.status },
      { userId: managedUser.id, status: 'inactive', deletedAt: now },
      auditMessage,
    ),
    actor,
    'settings_updated',
    { metadata: { operation: 'user_deleted', deletedUserId: managedUser.id, role: managedUser.role } },
  )

  return { ok: true, state: nextState }
}

export function createUnitWorkflow(
  state: AppDataState,
  actor: LeadraUser,
  input: CreateUnitInput,
): WorkflowResult {
  const mediaValidation = validateMediaUpload(input.media)
  if (!mediaValidation.ok) {
    return {
      ok: false,
      state,
      error: mediaValidation.message ?? 'Invalid media upload.',
      errorKey: mediaValidation.messageKey ?? 'error.invalidMediaUpload',
      errorParams: mediaValidation.messageParams ?? null,
    }
  }

  if (!isPrdUnitType(input.unitType)) {
    return { ok: false, state, error: 'Unit Type must use the fixed PRD list.', errorKey: null, errorParams: null }
  }

  const formValidationError = validateCreateUnitInput(input)
  if (formValidationError) {
    return { ok: false, state, error: formValidationError, errorKey: null, errorParams: null }
  }

  const ownerPhoneValidation = validateOwnerPhoneForCountry(input.originalOwnerPhone, input.countryCode)
  if (!ownerPhoneValidation.ok) {
    return {
      ok: false,
      state,
      ...createErrorMessage(
        'error.invalidOwnerPhoneForCountry',
        `Owner phone must match ${ownerPhoneValidation.countryLabel}. Example: ${ownerPhoneValidation.example}.`,
        { country: ownerPhoneValidation.countryLabel, example: ownerPhoneValidation.example },
      ),
    }
  }

  const normalizedOwnerPhone = normalizeOwnerPhone(ownerPhoneValidation.localPhone, input.countryCode)
  if (input.paymentMethod === 'installment') {
    if ((input.downPayment ?? 0) > input.totalAmount) {
      return { ok: false, state, error: 'Down payment cannot exceed total amount.', errorKey: null, errorParams: null }
    }
  }
  const installmentFields = normalizeInstallmentFields({
    paymentMethod: input.paymentMethod,
    installmentType: input.installmentType,
    installmentStartMonth: input.installmentStartMonth,
    installmentEndMonth: input.installmentEndMonth,
    customInstallmentText: input.customInstallmentText,
  })
  if (!installmentFields.ok) {
    return { ok: false, state, error: installmentFields.error, errorKey: null, errorParams: null }
  }
  if (input.transferFees != null && input.transferFees < 0) {
    return { ok: false, state, error: 'Transfer fees cannot be negative.', errorKey: null, errorParams: null }
  }
  if ((input.maintenanceCost ?? 0) < 0) {
    return { ok: false, state, error: 'Maintenance cost cannot be negative.', errorKey: null, errorParams: null }
  }
  if (input.maintenancePaid && (input.maintenanceCost != null || input.maintenanceDueDate)) {
    return { ok: false, state, error: 'Maintenance cost and due date must be empty when maintenance is paid.', errorKey: null, errorParams: null }
  }
  const nextId = state.units.reduce((highest, unit) => Math.max(highest, unit.id), 0) + 1
  const payment = calculatePaymentSummary({
    paymentMethod: input.paymentMethod,
    totalAmount: input.totalAmount,
    downPayment: input.downPayment,
    installmentType: installmentFields.fields.installmentType,
    installmentYears: installmentFields.fields.installmentYears,
    installmentStartMonth: installmentFields.fields.installmentStartMonth,
    installmentEndMonth: installmentFields.fields.installmentEndMonth,
    commissionPercentage: state.settings.commissionPercentage,
  })
  const outdoorFields = normalizeUnitOutdoorFields(input)
  const candidate: LeadraUnit = {
    id: nextId,
    unitCode: generateUnitCode(input.projectName, input.bedrooms),
    developerId: input.developerId,
    developerName: input.developerName,
    projectId: input.projectId,
    projectName: input.projectName,
    destinationId: input.destinationId,
    destinationName: input.destinationName,
    unitType: input.unitType,
    floor: outdoorFields.floor,
    bua: input.bua,
    roofGardenArea: outdoorFields.roofGardenArea,
    gardenArea: outdoorFields.gardenArea,
    terraceArea: outdoorFields.terraceArea,
    viewId: input.viewId,
    viewName: input.viewName,
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    elevator: input.elevator,
    landArea: outdoorFields.landArea,
    furnished: input.furnished,
    finish: input.finish,
    paymentMethod: input.paymentMethod,
    totalAmount: input.totalAmount,
    downPayment: input.paymentMethod === 'installment' ? input.downPayment ?? 0 : null,
    remainingPayment: payment.remainingPayment,
    transferFees: input.transferFees ?? null,
    maintenancePaid: input.maintenancePaid ?? false,
    maintenanceCost: input.maintenancePaid ? null : input.maintenanceCost ?? null,
    maintenanceDueDate: input.maintenancePaid ? null : input.maintenanceDueDate ?? null,
    commissionPercentage: state.settings.commissionPercentage,
    commissionAmount: payment.commissionAmount,
    installmentType: installmentFields.fields.installmentType,
    installmentYears: installmentFields.fields.installmentYears,
    installmentStartMonth: installmentFields.fields.installmentStartMonth,
    installmentEndMonth: installmentFields.fields.installmentEndMonth,
    customInstallmentText: installmentFields.fields.customInstallmentText,
    installmentAmount: payment.installmentAmount,
    installmentDueDay: input.installmentDueDay ?? 1,
    deliveryExpectancy: input.deliveryExpectancy,
    originalOwnerName: input.originalOwnerName,
    countryCode: input.countryCode,
    originalOwnerPhone: ownerPhoneValidation.localPhone,
    normalizedOwnerPhone,
    salesNotes: input.salesNotes,
    status: 'available',
    archived: false,
    isSpecial: false,
    specialMarkedAt: null,
    specialMarkedBy: null,
    createdBy: actor.id,
    createdByName: actor.fullName,
    teamId: actor.teamId,
    branchId: actor.branchId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    media: input.media,
    adminManagerNotes: [],
    paymentSchedule: [],
    paymentHistory: [],
  }
  candidate.paymentSchedule = createInitialPaymentSchedule(candidate)
  if (candidate.paymentMethod === 'installment') {
    candidate.totalAmount = calculateInstallmentTotalAmount(candidate)
    candidate.commissionAmount = Math.round((candidate.totalAmount * candidate.commissionPercentage) / 100)
  }
  candidate.remainingPayment = calculateDisplayedRemainingPayment(candidate)

  if (unitHasSameProjectPhoneDuplicate(candidate, state.units)) {
    const nextState = withAnalyticsEvent(
      withAudit(
        state,
        actor,
        createAuditMessage('duplicate_phone_blocked').text,
        candidate.unitCode,
        undefined,
        { projectId: candidate.projectId, normalizedOwnerPhone },
        createAuditMessage('duplicate_phone_blocked'),
      ),
      actor,
      'duplicate_phone_blocked',
      {
        unit: candidate,
        metadata: { unitCode: candidate.unitCode, projectId: candidate.projectId },
      },
    )
    return {
      ok: false,
      state: withNotification(
        nextState,
        createNotificationMessage('duplicate_phone_blocked', {}),
        'admin',
      ),
      ...createErrorMessage(
        'error.duplicateOwnerPhoneBlocked',
        'Duplicate owner phone blocked: the same normalized phone already exists inside this project.',
      ),
    }
  }

  const nextState = {
    ...state,
    units: [candidate, ...state.units],
  }

  return {
    ok: true,
    state: withNotification(
      withAnalyticsEvent(
        withAnalyticsEvent(
          withAudit(
            nextState,
            actor,
            createAuditMessage('unit_created').text,
            candidate.unitCode,
            undefined,
            { unitCode: candidate.unitCode },
            createAuditMessage('unit_created'),
          ),
          actor,
          'media_uploaded',
          {
            unit: candidate,
            metadata: {
              unitCode: candidate.unitCode,
              fileCount: candidate.media.length,
              imageCount: candidate.media.filter((file) => file.type === 'image').length,
            },
          },
        ),
        actor,
        'unit_created',
        {
          unit: candidate,
          amountValue: candidate.totalAmount,
          commissionValue: candidate.commissionAmount,
          metadata: { unitCode: candidate.unitCode, mediaCount: candidate.media.length },
        },
        ),
      createNotificationMessage('new_unit_uploaded', { actorName: actor.fullName, unitCode: candidate.unitCode }),
      'admin',
    ),
  }
}

function validateCreateUnitInput(input: CreateUnitInput): string | null {
  if (!input.developerId || !input.projectId || !input.destinationId || !input.viewId) {
    return 'Developer, project, destination, and view are required.'
  }
  if (!input.finish.trim()) {
    return 'Finishing is required.'
  }
  if (input.paymentMethod !== 'cash' && input.paymentMethod !== 'installment') {
    return 'Select a valid payment method.'
  }
  if (!isPositiveFinite(input.bua)) {
    return 'BUA must be greater than zero.'
  }
  if (!isNonNegativeInteger(input.bedrooms) || !isNonNegativeInteger(input.bathrooms)) {
    return 'Bedrooms and bathrooms must be valid whole numbers.'
  }
  if (!isPositiveFinite(input.totalAmount)) {
    return 'Total amount must be greater than zero.'
  }
  if (input.paymentMethod === 'installment' && !isNonNegativeFinite(input.downPayment ?? 0)) {
    return 'Down payment must be zero or greater.'
  }
  if (input.installmentDueDay != null && (!Number.isInteger(input.installmentDueDay) || input.installmentDueDay < 1 || input.installmentDueDay > 31)) {
    return 'Installment due day must be between 1 and 31.'
  }
  if (!isValidDeliveryExpectancy(input.deliveryExpectancy)) {
    return 'Delivery expectancy must include a valid year.'
  }

  const optionalAmounts = [
    input.roofGardenArea,
    input.gardenArea,
    input.terraceArea,
    input.landArea,
    input.transferFees,
    input.maintenanceCost,
  ]
  if (optionalAmounts.some((value) => value != null && !isNonNegativeFinite(value))) {
    return 'Area, transfer fee, and maintenance values must be zero or greater.'
  }

  return null
}

function isPositiveFinite(value: number) {
  return Number.isFinite(value) && value > 0
}

function isNonNegativeFinite(value: number) {
  return Number.isFinite(value) && value >= 0
}

function isNonNegativeInteger(value: number) {
  return Number.isInteger(value) && value >= 0
}

function isValidDeliveryExpectancy(value: CreateUnitInput['deliveryExpectancy']) {
  if (!Number.isInteger(value.year) || value.year < 1900 || value.year > 2200) return false
  if (value.mode === 'year') return true
  const month = value.month
  return Number.isInteger(month) && month !== undefined && month >= 1 && month <= 12
}

export function archiveUnitWorkflow(state: AppDataState, actor: LeadraUser, unitId: number): WorkflowResult {
  const unit = state.units.find((item) => item.id === unitId)
  if (!unit) return { ok: false, state, ...createErrorMessage('error.unitNotFound', 'Unit not found.') }
  if (!canArchiveUnit(actor, unit)) return { ok: false, state, ...createErrorMessage('error.archiveNotAllowed', 'Archive is not allowed for this role.') }

  const nextState = {
    ...state,
    units: state.units.map((item) =>
      item.id === unitId ? { ...item, archived: true, updatedAt: new Date().toISOString() } : item,
    ),
  }

  return {
    ok: true,
    state: withAnalyticsEvent(
      withAudit(
        nextState,
        actor,
        createAuditMessage('unit_archived').text,
        unit.unitCode,
        { archived: false },
        { archived: true },
        createAuditMessage('unit_archived'),
      ),
      actor,
      'unit_archived',
      { unit, metadata: { unitCode: unit.unitCode } },
    ),
  }
}

export function setUnitSpecialWorkflow(
  state: AppDataState,
  actor: LeadraUser,
  unitId: number,
  special: boolean,
): WorkflowResult {
  const unit = state.units.find((item) => item.id === unitId)
  if (!unit) return { ok: false, state, ...createErrorMessage('error.unitNotFound', 'Unit not found.') }
  if (!canManageUnitSpecialStatus(actor, unit)) {
    return { ok: false, state, ...createErrorMessage('error.specialNotAllowed', 'Only admins can manage special units.') }
  }

  const now = new Date().toISOString()
  const nextState = {
    ...state,
    units: state.units.map((item) =>
      item.id === unitId
        ? {
            ...item,
            isSpecial: special,
            specialMarkedAt: special ? now : null,
            specialMarkedBy: special ? actor.id : null,
            updatedAt: now,
          }
        : item,
    ),
  }

  return { ok: true, state: nextState }
}

export function updateUnitStatusWorkflow(
  state: AppDataState,
  actor: LeadraUser,
  unitId: number,
  status: UnitStatus,
): WorkflowResult {
  const unit = state.units.find((item) => item.id === unitId)
  if (!unit) return { ok: false, state, ...createErrorMessage('error.unitNotFound', 'Unit not found.') }
  if (!canViewUnit(actor, unit)) return { ok: false, state, ...createErrorMessage('error.unitOutsideVisibility', 'Unit is outside your visibility scope.') }
  if (!canUseUnitOperationalActions(actor, unit)) return { ok: false, state, error: 'Sales representatives can only change status on their own units.', errorKey: null, errorParams: null }

  const nextState = {
    ...state,
    units: state.units.map((item) =>
      item.id === unitId ? { ...item, status, updatedAt: new Date().toISOString() } : item,
    ),
  }
  const auditMessage = createAuditMessage('unit_marked', { status })
  const notificationMessage = createNotificationMessage('unit_marked', {
    unitCode: unit.unitCode,
    fromStatus: unit.status,
    toStatus: status,
    status,
  })

  return {
    ok: true,
    state: withNotification(
      withAnalyticsEvent(
        withAudit(nextState, actor, auditMessage.text, unit.unitCode, { status: unit.status }, { status }, auditMessage),
        actor,
        'status_changed',
        {
          unit,
          unitStatusBefore: unit.status,
          unitStatusAfter: status,
          amountValue: unit.totalAmount,
          commissionValue: unit.commissionAmount,
          metadata: { unitCode: unit.unitCode },
        },
      ),
      notificationMessage,
      actor.role === 'sales' ? undefined : 'admin',
      unit.createdBy,
    ),
  }
}

export function updatePaymentScheduleWorkflow(
  state: AppDataState,
  actor: LeadraUser,
  unitId: number,
  scheduleId: string,
  paid: boolean,
): WorkflowResult {
  const unit = state.units.find((item) => item.id === unitId)
  if (!unit) return { ok: false, state, ...createErrorMessage('error.unitNotFound', 'Unit not found.') }
  if (!canViewUnit(actor, unit)) return { ok: false, state, ...createErrorMessage('error.unitOutsideVisibility', 'Unit is outside your visibility scope.') }
  if (!canUseUnitOperationalActions(actor, unit)) return { ok: false, state, error: 'Payment timetable is read-only for this unit.', errorKey: null, errorParams: null }
  if (unit.paymentMethod !== 'installment' || unit.installmentType === 'custom') {
    return { ok: false, state, error: 'Payment timetable is only available for automatic installment units.', errorKey: null, errorParams: null }
  }

  const applied = applyPaymentScheduleAction(unit, actor, scheduleId, paid)
  if (!applied) return { ok: false, state, error: 'Payment timetable row was not changed.', errorKey: null, errorParams: null }

  const nextState = {
    ...state,
    units: state.units.map((item) => item.id === unitId ? applied.unit : item),
  }
  const actionText = paid ? 'Payment marked paid' : 'Payment marked unpaid'
  return {
    ok: true,
    state: withAnalyticsEvent(
      withAudit(
        nextState,
        actor,
        actionText,
        unit.unitCode,
        { remainingPayment: applied.history.previousRemainingValue },
        {
          remainingPayment: applied.history.newRemainingValue,
          amount: applied.history.amount,
          scheduleId,
          action: applied.history.action,
        },
      ),
      actor,
      'installment_updated',
      {
        unit: applied.unit,
        amountValue: applied.history.amount,
        metadata: {
          unitCode: unit.unitCode,
          scheduleId,
          action: applied.history.action,
          previousRemainingValue: applied.history.previousRemainingValue,
          newRemainingValue: applied.history.newRemainingValue,
        },
      },
    ),
  }
}

export function updateUnitWorkflow(
  state: AppDataState,
  actor: LeadraUser,
  unitId: number,
  input: UnitEditInput,
): WorkflowResult {
  const unit = state.units.find((item) => item.id === unitId)
  if (!unit) return { ok: false, state, ...createErrorMessage('error.unitNotFound', 'Unit not found.') }
  if (!canViewUnit(actor, unit)) return { ok: false, state, ...createErrorMessage('error.unitOutsideVisibility', 'Unit is outside your visibility scope.') }
  if (!canEditAnyUnitDetails(actor, unit)) {
    return { ok: false, state, error: 'You cannot edit this unit.', errorKey: null, errorParams: null }
  }

  const canEditNonOwner = canEditNonOwnerUnitDetails(actor, unit)
  const canEditOwner = canEditOwnerFields(actor, unit)
  const canEditPricing = canEditUnitPricing(actor, unit)
  const canEditCommission = canEditUnitCommission(actor, unit)

  const ownerChanged =
    input.originalOwnerName !== (unit.originalOwnerName ?? '') ||
    input.countryCode !== (unit.countryCode ?? '') ||
    input.originalOwnerPhone !== (unit.originalOwnerPhone ?? '')
  let ownerPhoneValidation: ReturnType<typeof validateOwnerPhoneForCountry> | null = null
  let normalizedOwnerPhone = unit.normalizedOwnerPhone

  if (canEditOwner && ownerChanged) {
    ownerPhoneValidation = validateOwnerPhoneForCountry(input.originalOwnerPhone, input.countryCode)
    if (!ownerPhoneValidation.ok) {
      return {
        ok: false,
        state,
        ...createErrorMessage(
          'error.invalidOwnerPhoneForCountry',
          `Owner phone must match ${ownerPhoneValidation.countryLabel}. Example: ${ownerPhoneValidation.example}.`,
          { country: ownerPhoneValidation.countryLabel, example: ownerPhoneValidation.example },
        ),
      }
    }
    normalizedOwnerPhone = normalizeOwnerPhone(ownerPhoneValidation.localPhone, input.countryCode)
  }

  if (canEditNonOwner && !isPrdUnitType(input.unitType)) {
    return { ok: false, state, error: 'Unit Type must use the fixed PRD list.', errorKey: null, errorParams: null }
  }
  const outdoorFields = canEditNonOwner ? normalizeUnitOutdoorFields(input) : unit
  const nextPaymentMethod = canEditPricing ? input.paymentMethod ?? unit.paymentMethod : unit.paymentMethod
  const nextDownPayment = canEditPricing
    ? nextPaymentMethod === 'installment'
      ? input.downPayment ?? unit.downPayment ?? 0
      : null
    : unit.downPayment
  const nextTotalAmount = canEditPricing ? input.totalAmount : unit.totalAmount
  const nextMaintenancePaid = canEditPricing ? input.maintenancePaid ?? false : unit.maintenancePaid ?? false
  if (canEditPricing && input.transferFees != null && input.transferFees < 0) {
    return { ok: false, state, error: 'Transfer fees cannot be negative.', errorKey: null, errorParams: null }
  }
  if (canEditPricing && (input.maintenanceCost ?? 0) < 0) {
    return { ok: false, state, error: 'Maintenance cost cannot be negative.', errorKey: null, errorParams: null }
  }
  if (canEditPricing && nextMaintenancePaid && (input.maintenanceCost != null || input.maintenanceDueDate)) {
    return { ok: false, state, error: 'Maintenance cost and due date must be empty when maintenance is paid.', errorKey: null, errorParams: null }
  }
  if (canEditPricing && nextPaymentMethod === 'installment' && nextDownPayment != null && nextDownPayment > nextTotalAmount) {
    return { ok: false, state, error: 'Down payment cannot be greater than total amount.', errorKey: null, errorParams: null }
  }
  let nextMaintenanceCost: number | null
  let nextMaintenanceDueDate: string | null = null
  if (canEditPricing) {
    nextMaintenanceCost = nextMaintenancePaid ? null : input.maintenanceCost ?? null
  } else {
    nextMaintenanceCost = unit.maintenanceCost ?? null
  }
  if (!nextMaintenancePaid) {
    nextMaintenanceDueDate = canEditPricing ? input.maintenanceDueDate ?? null : unit.maintenanceDueDate ?? null
  }
  const nextInstallmentFields = resolveUnitEditInstallmentFields(unit, input, canEditPricing)
  if (!nextInstallmentFields.ok) {
    return { ok: false, state, error: nextInstallmentFields.error, errorKey: null, errorParams: null }
  }
  const nextCommissionPercentage = canEditCommission ? input.commissionPercentage : unit.commissionPercentage
  const nextPaymentSummary = calculatePaymentSummary({
    paymentMethod: nextPaymentMethod,
    totalAmount: nextTotalAmount,
    downPayment: nextDownPayment,
    installmentType: nextInstallmentFields.fields.installmentType,
    installmentYears: nextInstallmentFields.fields.installmentYears,
    installmentStartMonth: nextInstallmentFields.fields.installmentStartMonth,
    installmentEndMonth: nextInstallmentFields.fields.installmentEndMonth,
    commissionPercentage: nextCommissionPercentage,
  })
  const installmentAmount =
    nextPaymentMethod === 'installment' && nextInstallmentFields.fields.installmentType !== 'custom'
      ? nextPaymentSummary.installmentAmount
      : null

  const updatedUnit: LeadraUnit = {
    ...unit,
    developerId: canEditNonOwner ? input.developerId : unit.developerId,
    developerName: canEditNonOwner ? input.developerName : unit.developerName,
    projectId: canEditNonOwner ? input.projectId : unit.projectId,
    projectName: canEditNonOwner ? input.projectName : unit.projectName,
    destinationId: canEditNonOwner ? input.destinationId : unit.destinationId,
    destinationName: canEditNonOwner ? input.destinationName : unit.destinationName,
    unitType: canEditNonOwner ? input.unitType : unit.unitType,
    floor: canEditNonOwner ? outdoorFields.floor : unit.floor,
    bua: canEditNonOwner ? input.bua : unit.bua,
    roofGardenArea: canEditNonOwner ? outdoorFields.roofGardenArea : unit.roofGardenArea,
    gardenArea: canEditNonOwner ? outdoorFields.gardenArea : unit.gardenArea,
    terraceArea: canEditNonOwner ? outdoorFields.terraceArea : unit.terraceArea,
    viewId: canEditNonOwner ? input.viewId : unit.viewId,
    viewName: canEditNonOwner ? input.viewName : unit.viewName,
    bedrooms: canEditNonOwner ? input.bedrooms : unit.bedrooms,
    bathrooms: canEditNonOwner ? input.bathrooms : unit.bathrooms,
    elevator: canEditNonOwner ? input.elevator : unit.elevator,
    landArea: canEditNonOwner ? outdoorFields.landArea : unit.landArea,
    furnished: canEditNonOwner ? input.furnished : unit.furnished,
    finish: canEditNonOwner ? input.finish : unit.finish,
    deliveryExpectancy: canEditNonOwner ? input.deliveryExpectancy : unit.deliveryExpectancy,
    salesNotes: canEditNonOwner ? input.salesNotes : unit.salesNotes,
    paymentMethod: nextPaymentMethod,
    totalAmount: nextTotalAmount,
    downPayment: nextDownPayment,
    remainingPayment: nextPaymentSummary.remainingPayment,
    transferFees: canEditPricing ? input.transferFees ?? unit.transferFees ?? null : unit.transferFees ?? null,
    maintenancePaid: nextMaintenancePaid,
    maintenanceCost: nextMaintenanceCost,
    maintenanceDueDate: nextMaintenanceDueDate,
    commissionPercentage: nextCommissionPercentage,
    commissionAmount: Math.round((nextTotalAmount * nextCommissionPercentage) / 100),
    installmentType: nextInstallmentFields.fields.installmentType,
    installmentYears: nextInstallmentFields.fields.installmentYears,
    installmentStartMonth: nextInstallmentFields.fields.installmentStartMonth,
    installmentEndMonth: nextInstallmentFields.fields.installmentEndMonth,
    customInstallmentText: nextInstallmentFields.fields.customInstallmentText,
    installmentAmount,
    installmentDueDay: canEditPricing ? input.installmentDueDay ?? unit.installmentDueDay ?? 1 : unit.installmentDueDay ?? 1,
    originalOwnerName: canEditOwner ? input.originalOwnerName : unit.originalOwnerName,
    countryCode: canEditOwner ? input.countryCode : unit.countryCode,
    originalOwnerPhone: canEditOwner ? ownerPhoneValidation?.localPhone ?? input.originalOwnerPhone : unit.originalOwnerPhone,
    normalizedOwnerPhone,
    updatedAt: new Date().toISOString(),
  }
  if (
    updatedUnit.paymentMethod === 'installment' &&
    updatedUnit.installmentType !== 'custom' &&
    (updatedUnit.installmentType !== unit.installmentType ||
      updatedUnit.installmentStartMonth !== unit.installmentStartMonth ||
      updatedUnit.installmentEndMonth !== unit.installmentEndMonth ||
      updatedUnit.installmentAmount !== unit.installmentAmount)
  ) {
    updatedUnit.paymentSchedule = createInitialPaymentSchedule(updatedUnit)
    updatedUnit.paymentHistory = unit.paymentHistory
  }
  if (updatedUnit.paymentMethod === 'installment') {
    updatedUnit.totalAmount = calculateInstallmentTotalAmount(updatedUnit)
    updatedUnit.commissionAmount = Math.round((updatedUnit.totalAmount * updatedUnit.commissionPercentage) / 100)
  }
  updatedUnit.remainingPayment = calculateDisplayedRemainingPayment(updatedUnit)

  if (unitHasSameProjectPhoneDuplicate(updatedUnit, state.units)) {
    const auditMessage = createAuditMessage('duplicate_phone_blocked')
    return {
      ok: false,
      state: withAnalyticsEvent(
        withAudit(
          state,
          actor,
          auditMessage.text,
          unit.unitCode,
          { projectId: unit.projectId, normalizedOwnerPhone: unit.normalizedOwnerPhone },
          { projectId: updatedUnit.projectId, normalizedOwnerPhone: updatedUnit.normalizedOwnerPhone },
          auditMessage,
        ),
        actor,
        'duplicate_phone_blocked',
        { unit: updatedUnit, metadata: { unitCode: unit.unitCode, projectId: updatedUnit.projectId } },
      ),
      ...createErrorMessage('error.duplicateOwnerPhoneBlocked', 'Duplicate owner phone blocked inside this project.'),
    }
  }

  const baseState = {
    ...state,
    units: state.units.map((item) => item.id === unitId ? updatedUnit : item),
  }
  const priceChanged = updatedUnit.totalAmount !== unit.totalAmount || updatedUnit.commissionPercentage !== unit.commissionPercentage
  const editedFields = diffUnitEditFields(unit, updatedUnit)
  let nextState = withAudit(
    baseState,
    actor,
    'Unit edited',
    unit.unitCode,
    pickUnitEditAuditValue(unit, editedFields),
    pickUnitEditAuditValue(updatedUnit, editedFields),
  )
  nextState = withAnalyticsEvent(nextState, actor, 'unit_updated', {
    unit: updatedUnit,
    metadata: { unitCode: unit.unitCode, fields: editedFields.join(',') },
  })

  if (priceChanged) {
    nextState = withAudit(
      nextState,
      actor,
      'Total Value / pricing updated',
      unit.unitCode,
      { totalAmount: unit.totalAmount, commissionPercentage: unit.commissionPercentage, remainingPayment: unit.remainingPayment },
      { totalAmount: updatedUnit.totalAmount, commissionPercentage: updatedUnit.commissionPercentage, remainingPayment: updatedUnit.remainingPayment },
    )
    nextState = withAnalyticsEvent(nextState, actor, 'price_updated', {
      unit: updatedUnit,
      amountValue: updatedUnit.totalAmount,
      commissionValue: updatedUnit.commissionAmount,
      metadata: { unitCode: unit.unitCode, remainingPaymentPreserved: updatedUnit.remainingPayment === unit.remainingPayment },
    })
  }

  if (ownerChanged && canEditOwner) {
    nextState = withAudit(
      nextState,
      actor,
      'Owner data updated',
      unit.unitCode,
      { originalOwnerName: unit.originalOwnerName, countryCode: unit.countryCode, originalOwnerPhone: unit.originalOwnerPhone },
      { originalOwnerName: updatedUnit.originalOwnerName, countryCode: updatedUnit.countryCode, originalOwnerPhone: updatedUnit.originalOwnerPhone },
    )
  }

  nextState = withNotification(
    nextState,
    {
      title: { text: 'Unit edited', messageKey: null, messageParams: null },
      body: { text: `${actor.fullName} edited ${unit.unitCode}.`, messageKey: null, messageParams: null },
    },
    'admin',
    unit.createdBy,
  )

  return { ok: true, state: nextState }
}

export function removeUnitMediaWorkflow(
  state: AppDataState,
  actor: LeadraUser,
  unitId: number,
  mediaId: string,
): WorkflowResult {
  const unit = state.units.find((item) => item.id === unitId)
  if (!unit) return { ok: false, state, ...createErrorMessage('error.unitNotFound', 'Unit not found.') }
  if (!canEditNonOwnerUnitDetails(actor, unit)) {
    return { ok: false, state, ...createErrorMessage('error.unitMediaRemoveNotAllowed', 'You cannot remove media from this unit.') }
  }

  const media = unit.media.find((item) => item.id === mediaId)
  if (!media) return { ok: false, state, ...createErrorMessage('error.unitMediaNotFound', 'Media file not found.') }

  const updatedUnit = {
    ...unit,
    media: unit.media.filter((item) => item.id !== mediaId),
    updatedAt: new Date().toISOString(),
  }
  const nextState = {
    ...state,
    units: state.units.map((item) => item.id === unitId ? updatedUnit : item),
  }

  return {
    ok: true,
    state: withAnalyticsEvent(
      withAudit(
        nextState,
        actor,
        'Media removed',
        unit.unitCode,
        { mediaId, fileName: media.name },
        { mediaCount: updatedUnit.media.length },
      ),
      actor,
      'unit_updated',
      { unit: updatedUnit, metadata: { unitCode: unit.unitCode, mediaId, fileName: media.name } },
    ),
  }
}

export function saveUnitAdminNoteWorkflow(
  state: AppDataState,
  actor: LeadraUser,
  unitId: number,
  content: string,
): WorkflowResult {
  const unit = state.units.find((item) => item.id === unitId)
  if (!unit) return { ok: false, state, ...createErrorMessage('error.unitNotFound', 'Unit not found.') }
  if (!canViewUnit(actor, unit) || !canAddAdminManagerNote(actor)) {
    return { ok: false, state, ...createErrorMessage('error.notePermissionDenied', 'Only Admin, Sub Admin, and Manager can manage this note.') }
  }

  const nextContent = content.trim()
  if (nextContent.length === 0) {
    return { ok: false, state, ...createErrorMessage('error.noteCannotBeEmpty', 'Note cannot be empty.') }
  }

  const existingNote = unit.adminManagerNotes[0] ?? null
  const nextNote = {
    id: existingNote?.id ?? `note-${Date.now()}`,
    content: nextContent,
    createdBy: actor.id,
    createdByName: actor.fullName,
    role: actor.role,
    createdAt: new Date().toISOString(),
  }
  const eventType = existingNote ? 'note_updated' : 'note_added'
  const auditMessage = existingNote
    ? createAuditMessage('admin_manager_note_updated')
    : createAuditMessage('admin_manager_note_added')
  const notificationMessage = existingNote
    ? createNotificationMessage('admin_note_updated', { actorName: actor.fullName, unitCode: unit.unitCode })
    : createNotificationMessage('new_admin_note', { actorName: actor.fullName, unitCode: unit.unitCode })
  const nextState = {
    ...state,
    units: state.units.map((item) =>
      item.id === unitId
        ? { ...item, adminManagerNotes: [nextNote], updatedAt: new Date().toISOString() }
        : item,
    ),
  }

  return {
    ok: true,
    state: withNotification(
      withAnalyticsEvent(
        withAudit(
          nextState,
          actor,
          auditMessage.text,
          unit.unitCode,
          existingNote?.content ?? null,
          nextContent,
          auditMessage,
        ),
        actor,
        eventType,
        {
          unit,
          metadata: { unitCode: unit.unitCode, noteRole: actor.role },
        },
      ),
      notificationMessage,
      actor.role === 'sales' ? undefined : 'admin',
      unit.createdBy,
    ),
  }
}

export function deleteUnitAdminNoteWorkflow(
  state: AppDataState,
  actor: LeadraUser,
  unitId: number,
): WorkflowResult {
  const unit = state.units.find((item) => item.id === unitId)
  if (!unit) return { ok: false, state, ...createErrorMessage('error.unitNotFound', 'Unit not found.') }
  if (!canViewUnit(actor, unit) || !canAddAdminManagerNote(actor)) {
    return { ok: false, state, ...createErrorMessage('error.notePermissionDenied', 'Only Admin, Sub Admin, and Manager can manage this note.') }
  }

  const existingNote = unit.adminManagerNotes[0] ?? null
  if (!existingNote) {
    return { ok: false, state, ...createErrorMessage('error.noteMissing', 'No shared note exists for this unit.') }
  }

  const nextState = {
    ...state,
    units: state.units.map((item) =>
      item.id === unitId
        ? { ...item, adminManagerNotes: [], updatedAt: new Date().toISOString() }
        : item,
    ),
  }

  return {
    ok: true,
    state: withNotification(
      withAnalyticsEvent(
        withAudit(
          nextState,
          actor,
          createAuditMessage('admin_manager_note_deleted').text,
          unit.unitCode,
          existingNote.content,
          null,
          createAuditMessage('admin_manager_note_deleted'),
        ),
        actor,
        'note_deleted',
        {
          unit,
          metadata: { unitCode: unit.unitCode, noteRole: actor.role },
        },
      ),
      createNotificationMessage('admin_note_deleted', { actorName: actor.fullName, unitCode: unit.unitCode }),
      actor.role === 'sales' ? undefined : 'admin',
      unit.createdBy,
    ),
  }
}

export function updateSettingsWorkflow(
  state: AppDataState,
  actor: LeadraUser,
  patch: Partial<AppSettings>,
): WorkflowResult {
  if (!isAdminActor(actor)) {
    return { ok: false, state, ...createErrorMessage('error.onlyAdminsUpdateSettings', 'Only Admin and Sub Admin can update settings.') }
  }

  const settings = { ...state.settings, ...patch }
  return {
    ok: true,
    state: withAnalyticsEvent(
      withAudit(
        { ...state, settings },
        actor,
        createAuditMessage('settings_updated').text,
        undefined,
        state.settings,
        settings,
        createAuditMessage('settings_updated'),
      ),
      actor,
      'settings_updated',
      { metadata: { operation: 'settings_updated' } },
    ),
  }
}

export function addAnalyticsEventWorkflow(
  state: AppDataState,
  actor: LeadraUser,
  eventType: AnalyticsEventType,
  unit?: LeadraUnit,
): AppDataState {
  return withAnalyticsEvent(state, actor, eventType, {
    unit,
    amountValue: unit?.totalAmount ?? null,
    commissionValue: unit?.commissionAmount ?? null,
    metadata: unit ? { unitCode: unit.unitCode } : {},
  })
}

type ResolvedInstallmentFields = {
  installmentType: InstallmentType | null
  installmentYears: number | null
  installmentStartMonth: string | null
  installmentEndMonth: string | null
  customInstallmentText: string | null
}

type InstallmentFieldResult =
  | { ok: true; fields: ResolvedInstallmentFields }
  | { ok: false; error: string }

function normalizeInstallmentFields(input: {
  paymentMethod: LeadraUnit['paymentMethod']
  installmentType?: InstallmentType | null
  installmentYears?: number | null
  installmentStartMonth?: string | null
  installmentEndMonth?: string | null
  customInstallmentText?: string | null
  allowLegacyYears?: boolean
}): InstallmentFieldResult {
  if (input.paymentMethod === 'cash') {
    return { ok: true, fields: emptyInstallmentFields() }
  }

  const installmentType = input.installmentType ?? 'custom'
  if (installmentType === 'custom') {
    const customInstallmentText = input.customInstallmentText?.trim() ?? ''
    if (!customInstallmentText) {
      return { ok: false, error: 'Custom installment text is required for custom installments.' }
    }
    return {
      ok: true,
      fields: {
        installmentType,
        installmentYears: null,
        installmentStartMonth: null,
        installmentEndMonth: null,
        customInstallmentText,
      },
    }
  }

  const installmentStartMonth = normalizeInstallmentMonth(input.installmentStartMonth)
  const installmentEndMonth = normalizeInstallmentMonth(input.installmentEndMonth)
  if (!installmentStartMonth || !installmentEndMonth) {
    if (input.allowLegacyYears && input.installmentYears && input.installmentYears > 0) {
      return {
        ok: true,
        fields: {
          installmentType,
          installmentYears: input.installmentYears,
          installmentStartMonth: null,
          installmentEndMonth: null,
          customInstallmentText: null,
        },
      }
    }
    return { ok: false, error: 'Installment start and end months are required for automatic installment calculations.' }
  }
  if (installmentStartMonth > installmentEndMonth) {
    return { ok: false, error: 'Installment start month cannot be after the end month.' }
  }

  return {
    ok: true,
    fields: {
      installmentType,
      installmentYears: null,
      installmentStartMonth,
      installmentEndMonth,
      customInstallmentText: null,
    },
  }
}

function resolveUnitEditInstallmentFields(
  unit: LeadraUnit,
  input: UnitEditInput,
  canEditPricing: boolean,
): InstallmentFieldResult {
  if (input.paymentMethod === 'cash') {
    return { ok: true, fields: emptyInstallmentFields() }
  }

  if (!canEditPricing || !hasInstallmentEdit(input)) {
    return { ok: true, fields: preservedInstallmentFields(unit) }
  }

  return normalizeInstallmentFields({
    paymentMethod: input.paymentMethod ?? unit.paymentMethod,
    installmentType: input.installmentType ?? unit.installmentType,
    installmentStartMonth: input.installmentStartMonth ?? unit.installmentStartMonth,
    installmentEndMonth: input.installmentEndMonth ?? unit.installmentEndMonth,
    customInstallmentText: input.customInstallmentText ?? unit.customInstallmentText,
  })
}

function preservedInstallmentFields(unit: LeadraUnit): ResolvedInstallmentFields {
  return {
    installmentType: unit.installmentType,
    installmentYears: unit.installmentYears,
    installmentStartMonth: unit.installmentStartMonth ?? null,
    installmentEndMonth: unit.installmentEndMonth ?? null,
    customInstallmentText: unit.customInstallmentText ?? null,
  }
}

function hasInstallmentEdit(input: UnitEditInput): boolean {
  return (
    input.installmentType !== undefined ||
    input.installmentStartMonth !== undefined ||
    input.installmentEndMonth !== undefined ||
    input.customInstallmentText !== undefined
  )
}

function emptyInstallmentFields(): ResolvedInstallmentFields {
  return {
    installmentType: null,
    installmentYears: null,
    installmentStartMonth: null,
    installmentEndMonth: null,
    customInstallmentText: null,
  }
}

function withAudit(
  state: AppDataState,
  actor: LeadraUser,
  actionType: string,
  relatedUnitCode?: string,
  previousValue?: unknown,
  newValue?: unknown,
  message?: LocalizedMessageRef,
): AppDataState {
  const item: AuditLogItem = {
    id: `audit-${Date.now()}-${state.auditLogs.length}`,
    actorName: actor.fullName,
    actorRole: actor.role,
    actionType,
    messageKey: message?.messageKey ?? null,
    messageParams: message?.messageParams ?? null,
    relatedUnitCode,
    previousValue: previousValue == null ? null : JSON.stringify(previousValue),
    newValue: newValue == null ? null : JSON.stringify(newValue),
    createdAt: new Date().toISOString(),
    ipAddress: null,
  }

  return { ...state, auditLogs: [item, ...state.auditLogs] }
}

function withNotification(
  state: AppDataState,
  message: {
    title: {
      text: string
      messageKey?: string | null
      messageParams?: Record<string, string | number | boolean | null | undefined> | null
    }
    body: { text: string; messageKey?: string | null; messageParams?: Record<string, string | number | boolean | null | undefined> | null }
  },
  audienceRole?: LeadraUser['role'],
  userId?: string,
): AppDataState {
  const item: NotificationItem = {
    id: `notification-${Date.now()}-${state.notifications.length}`,
    title: message.title.text,
    body: message.body.text,
    messageKey: message.body.messageKey ?? null,
    messageParams: message.body.messageParams ?? null,
    audienceRole,
    userId,
    createdAt: new Date().toISOString(),
    read: false,
  }

  return { ...state, notifications: [item, ...state.notifications] }
}

function withAnalyticsEvent(
  state: AppDataState,
  actor: LeadraUser,
  eventType: AnalyticsEventType,
  options: {
    unit?: LeadraUnit
    unitStatusBefore?: LeadraUnit['status'] | null
    unitStatusAfter?: LeadraUnit['status'] | null
    amountValue?: number | null
    commissionValue?: number | null
    metadata?: AnalyticsEvent['metadata']
  } = {},
): AppDataState {
  const item: AnalyticsEvent = {
    id: `analytics-${Date.now()}-${state.analyticsEvents.length}`,
    eventType,
    actorId: actor.id,
    actorRole: actor.role,
    teamId: options.unit?.teamId ?? actor.teamId ?? null,
    branchId: options.unit?.branchId ?? actor.branchId ?? null,
    unitId: options.unit?.id ?? null,
    projectId: options.unit?.projectId ?? null,
    developerId: options.unit?.developerId ?? null,
    destinationId: options.unit?.destinationId ?? null,
    unitStatusBefore: options.unitStatusBefore ?? null,
    unitStatusAfter: options.unitStatusAfter ?? null,
    amountValue: options.amountValue ?? null,
    commissionValue: options.commissionValue ?? null,
    metadata: options.metadata ?? {},
    createdAt: new Date().toISOString(),
  }

  return { ...state, analyticsEvents: [item, ...state.analyticsEvents] }
}
