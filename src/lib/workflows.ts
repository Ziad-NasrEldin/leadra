import {
  calculatePaymentSummary,
  canArchiveUnit,
  canViewUnit,
  generateUnitCode,
  normalizeOwnerPhone,
  unitHasSameProjectPhoneDuplicate,
  validateMediaUpload,
} from './domain'
import type {
  AppDataState,
  AppSettings,
  AuditLogItem,
  AnalyticsEvent,
  AnalyticsEventType,
  CreateUnitInput,
  CreateUserInput,
  LeadraUnit,
  LeadraUser,
  NotificationItem,
  UnitStatus,
  WorkflowResult,
} from './types'

export function signInWorkflow(state: AppDataState, email: string): WorkflowResult<LeadraUser> {
  const user = state.users.find((item) => item.email.toLowerCase() === email.toLowerCase())

  if (!user) {
    return { ok: false, state: emptyUser(), error: 'Invalid email or password.' }
  }

  if (user.status !== 'active') {
    return { ok: false, state: user, error: 'Inactive users cannot log in.' }
  }

  return { ok: true, state: { ...user, lastLoginAt: new Date().toISOString() } }
}

export function createUserWorkflow(
  state: AppDataState,
  actor: LeadraUser,
  input: CreateUserInput,
): WorkflowResult {
  if (!isAdminActor(actor)) {
    return { ok: false, state, error: 'Only Admin and Sub Admin can create users.' }
  }

  if (state.users.some((user) => user.email.toLowerCase() === input.email.toLowerCase())) {
    return { ok: false, state, error: 'A user with this email already exists.' }
  }

  const user: LeadraUser = {
    id: `user-${Date.now()}`,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
    ...input,
  }

  const nextState = withAnalyticsEvent(
    withAudit(
      {
        ...state,
        users: [...state.users, user],
      },
      actor,
      'User created',
      undefined,
      undefined,
      { email: user.email, role: user.role },
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

export function createUnitWorkflow(
  state: AppDataState,
  actor: LeadraUser,
  input: CreateUnitInput,
): WorkflowResult {
  const mediaValidation = validateMediaUpload(input.media)
  if (!mediaValidation.ok) {
    return { ok: false, state, error: mediaValidation.message ?? 'Invalid media upload.' }
  }

  const normalizedOwnerPhone = normalizeOwnerPhone(input.originalOwnerPhone, input.countryCode)
  const nextId = state.units.reduce((highest, unit) => Math.max(highest, unit.id), 0) + 1
  const payment = calculatePaymentSummary({
    paymentMethod: input.paymentMethod,
    totalAmount: input.totalAmount,
    downPayment: input.downPayment,
    installmentType: input.installmentType,
    installmentYears: input.installmentYears,
    commissionPercentage: state.settings.commissionPercentage,
  })
  const candidate: LeadraUnit = {
    id: nextId,
    unitCode: generateUnitCode(input.destinationName, nextId, input.bedrooms, input.bathrooms),
    developerId: input.developerId,
    developerName: input.developerName,
    projectId: input.projectId,
    projectName: input.projectName,
    destinationId: input.destinationId,
    destinationName: input.destinationName,
    unitType: input.unitType,
    floor: input.floor,
    bua: input.bua,
    roofGardenArea: input.roofGardenArea ?? null,
    viewId: input.viewId,
    viewName: input.viewName,
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    elevator: input.elevator,
    landArea: input.landArea ?? null,
    furnished: input.furnished,
    finish: input.finish,
    paymentMethod: input.paymentMethod,
    totalAmount: input.totalAmount,
    downPayment: input.paymentMethod === 'installment' ? input.downPayment ?? 0 : null,
    remainingPayment: payment.remainingPayment,
    commissionPercentage: state.settings.commissionPercentage,
    commissionAmount: payment.commissionAmount,
    installmentType: input.paymentMethod === 'installment' ? input.installmentType ?? 'custom' : null,
    installmentYears: input.paymentMethod === 'installment' ? input.installmentYears ?? null : null,
    installmentAmount: payment.installmentAmount,
    deliveryExpectancy: input.deliveryExpectancy,
    originalOwnerName: input.originalOwnerName,
    countryCode: input.countryCode,
    originalOwnerPhone: input.originalOwnerPhone,
    normalizedOwnerPhone,
    salesNotes: input.salesNotes,
    status: 'available',
    archived: false,
    createdBy: actor.id,
    createdByName: actor.fullName,
    teamId: actor.teamId,
    branchId: actor.branchId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    media: input.media,
    adminManagerNotes: [],
  }

  if (unitHasSameProjectPhoneDuplicate(candidate, state.units)) {
    const nextState = withAnalyticsEvent(
      withAudit(
        state,
        actor,
        'Duplicate owner phone attempt inside same project',
        candidate.unitCode,
        undefined,
        { projectId: candidate.projectId, normalizedOwnerPhone },
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
      state: withNotification(nextState, 'Duplicate owner phone attempt', 'Same-project duplicate owner phone was blocked.', 'admin'),
      error: 'Duplicate owner phone blocked: the same normalized phone already exists inside this project.',
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
          withAudit(nextState, actor, 'Unit created', candidate.unitCode, undefined, { unitCode: candidate.unitCode }),
          actor,
          'media_uploaded',
          {
            unit: candidate,
            metadata: {
              unitCode: candidate.unitCode,
              fileCount: candidate.media.length,
              imageCount: candidate.media.filter((file) => file.type === 'image').length,
              videoCount: candidate.media.filter((file) => file.type === 'video').length,
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
      'New unit uploaded',
      `${actor.fullName} uploaded ${candidate.unitCode}.`,
      'admin',
    ),
  }
}

export function archiveUnitWorkflow(state: AppDataState, actor: LeadraUser, unitId: number): WorkflowResult {
  const unit = state.units.find((item) => item.id === unitId)
  if (!unit) return { ok: false, state, error: 'Unit not found.' }
  if (!canArchiveUnit(actor, unit)) return { ok: false, state, error: 'Archive is not allowed for this role.' }

  const nextState = {
    ...state,
    units: state.units.map((item) =>
      item.id === unitId ? { ...item, archived: true, updatedAt: new Date().toISOString() } : item,
    ),
  }

  return {
    ok: true,
    state: withAnalyticsEvent(
      withAudit(nextState, actor, 'Unit archived', unit.unitCode, { archived: false }, { archived: true }),
      actor,
      'unit_archived',
      { unit, metadata: { unitCode: unit.unitCode } },
    ),
  }
}

export function updateUnitStatusWorkflow(
  state: AppDataState,
  actor: LeadraUser,
  unitId: number,
  status: UnitStatus,
): WorkflowResult {
  const unit = state.units.find((item) => item.id === unitId)
  if (!unit) return { ok: false, state, error: 'Unit not found.' }
  if (!canViewUnit(actor, unit)) return { ok: false, state, error: 'Unit is outside your visibility scope.' }

  const nextState = {
    ...state,
    units: state.units.map((item) =>
      item.id === unitId ? { ...item, status, updatedAt: new Date().toISOString() } : item,
    ),
  }
  const label = status === 'hold' ? 'Hold' : status === 'sold' ? 'Sold' : 'Available'

  return {
    ok: true,
    state: withNotification(
      withAnalyticsEvent(
        withAudit(nextState, actor, `Unit marked ${label}`, unit.unitCode, { status: unit.status }, { status }),
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
      `Unit marked ${label}`,
      `${unit.unitCode} changed from ${unit.status} to ${status}.`,
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
    return { ok: false, state, error: 'Only Admin and Sub Admin can update settings.' }
  }

  const settings = { ...state.settings, ...patch }
  return {
    ok: true,
    state: withAnalyticsEvent(
      withAudit({ ...state, settings }, actor, 'Settings updated', undefined, state.settings, settings),
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

function withAudit(
  state: AppDataState,
  actor: LeadraUser,
  actionType: string,
  relatedUnitCode?: string,
  previousValue?: unknown,
  newValue?: unknown,
): AppDataState {
  const item: AuditLogItem = {
    id: `audit-${Date.now()}-${state.auditLogs.length}`,
    actorName: actor.fullName,
    actorRole: actor.role,
    actionType,
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
  title: string,
  body: string,
  audienceRole?: LeadraUser['role'],
  userId?: string,
): AppDataState {
  const item: NotificationItem = {
    id: `notification-${Date.now()}-${state.notifications.length}`,
    title,
    body,
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

function isAdminActor(actor: LeadraUser): boolean {
  return actor.role === 'admin' || actor.role === 'sub_admin'
}

function emptyUser(): LeadraUser {
  return {
    id: '',
    fullName: '',
    email: '',
    role: 'sales',
    jobTitle: '',
    phoneNumber: '',
    teamId: '',
    branchId: '',
    status: 'inactive',
  }
}
