import {
  calculatePaymentSummary,
  canAddAdminManagerNote,
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
import {
  createAuditMessage,
  createErrorMessage,
  createNotificationMessage,
  type LocalizedMessageRef,
} from './systemMessages'

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
    ...input,
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
      createNotificationMessage('new_unit_uploaded', { actorName: actor.fullName, unitCode: candidate.unitCode }),
      'admin',
    ),
  }
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

export function updateUnitStatusWorkflow(
  state: AppDataState,
  actor: LeadraUser,
  unitId: number,
  status: UnitStatus,
): WorkflowResult {
  const unit = state.units.find((item) => item.id === unitId)
  if (!unit) return { ok: false, state, ...createErrorMessage('error.unitNotFound', 'Unit not found.') }
  if (!canViewUnit(actor, unit)) return { ok: false, state, ...createErrorMessage('error.unitOutsideVisibility', 'Unit is outside your visibility scope.') }

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
