import { createAuditMessage, createNotificationMessage } from './systemMessages'
import type { AppDataState, NotificationItem } from './types'

export const SALES_INACTIVITY_THRESHOLD_HOURS = 72
export const SALES_INACTIVITY_REPEAT_HOURS = 24

export function queueSalesInactivityWarnings(
  state: AppDataState,
  now = new Date(),
  thresholdHours = SALES_INACTIVITY_THRESHOLD_HOURS,
): AppDataState {
  const staleUsers = getSalesUsersPastInactivityThreshold(state, now, thresholdHours)
    .filter((user) => !hasRecentSalesInactivityWarning(state, user.id, now))

  if (staleUsers.length === 0) return state

  const createdAt = now.toISOString()
  const notifications: NotificationItem[] = []
  const auditLogs = [...state.auditLogs]
  const analyticsEvents = [...state.analyticsEvents]

  for (const staleUser of staleUsers) {
    const latestUploadAt = getLatestUploadAt(state, staleUser.id)
    const params = {
      userId: staleUser.id,
      userName: staleUser.fullName,
      date: latestUploadAt ? latestUploadAt.slice(0, 10) : 'No uploads',
    }
    const message = createNotificationMessage('sales_inactivity_72h', params)

    notifications.push(
      {
        id: `notif-inactivity-sales-${staleUser.id}-${createdAt}`,
        title: message.title.text,
        body: message.body.text,
        messageKey: message.body.messageKey ?? null,
        messageParams: message.body.messageParams ?? null,
        userId: staleUser.id,
        createdAt,
        read: false,
      },
      {
        id: `notif-inactivity-manager-${staleUser.id}-${createdAt}`,
        title: message.title.text,
        body: message.body.text,
        messageKey: message.body.messageKey ?? null,
        messageParams: message.body.messageParams ?? null,
        audienceRole: 'manager',
        createdAt,
        read: false,
      },
      {
        id: `notif-inactivity-admin-${staleUser.id}-${createdAt}`,
        title: message.title.text,
        body: message.body.text,
        messageKey: message.body.messageKey ?? null,
        messageParams: message.body.messageParams ?? null,
        audienceRole: 'admin',
        createdAt,
        read: false,
      },
      {
        id: `notif-inactivity-sub-admin-${staleUser.id}-${createdAt}`,
        title: message.title.text,
        body: message.body.text,
        messageKey: message.body.messageKey ?? null,
        messageParams: message.body.messageParams ?? null,
        audienceRole: 'sub_admin',
        createdAt,
        read: false,
      },
    )

    const auditMessage = createAuditMessage('sales_inactivity_72h', params)
    auditLogs.unshift({
      id: `audit-inactivity-${staleUser.id}-${createdAt}`,
      actorName: 'System',
      actorRole: 'admin',
      actionType: auditMessage.text,
      messageKey: auditMessage.messageKey ?? null,
      messageParams: auditMessage.messageParams ?? null,
      previousValue: latestUploadAt,
      newValue: createdAt,
      createdAt,
      ipAddress: null,
    })

    analyticsEvents.unshift({
      id: `event-inactivity-${staleUser.id}-${createdAt}`,
      eventType: 'inactive_user_detected',
      actorId: staleUser.id,
      actorRole: staleUser.role,
      teamId: staleUser.teamId,
      branchId: staleUser.branchId,
      metadata: { userName: staleUser.fullName, latestUploadAt },
      createdAt,
    })
  }

  return {
    ...state,
    notifications: [...notifications, ...state.notifications],
    auditLogs,
    analyticsEvents,
  }
}

export function getSalesUsersPastInactivityThreshold(
  state: AppDataState,
  now = new Date(),
  thresholdHours = SALES_INACTIVITY_THRESHOLD_HOURS,
) {
  const thresholdMs = thresholdHours * 60 * 60 * 1000
  return state.users.filter((user) => {
    if (user.role !== 'sales' || user.status !== 'active') return false
    const latestUploadAt = getLatestUploadAt(state, user.id)
    if (!latestUploadAt) return true
    return now.getTime() - new Date(latestUploadAt).getTime() >= thresholdMs
  })
}

function getLatestUploadAt(state: AppDataState, userId: string) {
  return state.units
    .filter((unit) => unit.createdBy === userId)
    .map((unit) => unit.createdAt)
    .sort()
    .at(-1) ?? null
}

function hasRecentSalesInactivityWarning(state: AppDataState, userId: string, now: Date) {
  const repeatMs = SALES_INACTIVITY_REPEAT_HOURS * 60 * 60 * 1000
  return state.notifications.some((notification) => {
    if (notification.messageKey !== 'message.notification.salesInactivity72h.body') return false
    if (notification.messageParams?.userId !== userId) return false
    return now.getTime() - new Date(notification.createdAt).getTime() < repeatMs
  })
}
