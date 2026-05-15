import { isSoldStatus } from './domain'
import { compareText, translate, type LocaleCode } from './i18n'
import type {
  AnalyticsDashboard,
  AnalyticsDateWindow,
  AnalyticsEvent,
  AnalyticsFilterOptions,
  AnalyticsFilters,
  AnalyticsInventoryHealth,
  AnalyticsSalesPerformance,
  AnalyticsTarget,
  AnalyticsTargetProgress,
  AnalyticsTimelinePoint,
  AppDataState,
  LeadraUnit,
  LeadraUser,
} from './types'

const staleAfterMs = 72 * 60 * 60 * 1000
const defaultNow = new Date('2026-05-04T12:00:00.000Z')

export const defaultAnalyticsFilters: AnalyticsFilters = {
  dateWindow: 'live',
  teamIds: [],
  userIds: [],
  projectIds: [],
  developerIds: [],
  destinationIds: [],
  statuses: [],
  paymentMethods: [],
}

export function canAccessAnalytics(user: LeadraUser): boolean {
  return user.role === 'admin' || user.role === 'sub_admin' || user.role === 'manager'
}

export function buildAnalyticsDashboard(
  user: LeadraUser,
  state: AppDataState,
  locale: LocaleCode = 'en',
  now = defaultNow,
  filters: AnalyticsFilters = defaultAnalyticsFilters,
): AnalyticsDashboard {
  const allUnits = filterAnalyticsUnits(user, state.units)
  const users = filterUsersByFilters(filterAnalyticsUsers(user, state.users), filters)
  const units = filterUnitsByFilters(allUnits, filters)
  const events = filterEventsByFilters(filterAnalyticsEvents(user, state.analyticsEvents), units, filters, now)
  const targets = filterAnalyticsTargets(user, state.analyticsTargets)
  const timeline = buildActivityTimeline(events, filters, now)
  const overview = buildOverview(units, users, events, now)

  return {
    scopeLabel: translate(locale, 'analytics.scope.company'),
    overview,
    salesPerformance: buildSalesPerformance(users, units, events),
    inventoryHealth: buildInventoryHealth(units, locale, now),
    activityTimeline: timeline,
    soldValueTrend: timeline.map((point) => ({
      date: point.date,
      label: point.date.slice(5).replace('-', '/'),
      value: point.soldValue,
    })),
    pdfExportTrend: timeline.map((point) => ({
      date: point.date,
      label: point.date.slice(5).replace('-', '/'),
      value: point.pdfExports,
    })),
    targetProgress: buildTargetProgress(targets, units, events, locale),
    filterOptions: buildAnalyticsFilterOptions(user, state),
  }
}

function buildOverview(units: LeadraUnit[], users: LeadraUser[], events: AnalyticsEvent[], now: Date): AnalyticsDashboard['overview'] {
  const overview: AnalyticsDashboard['overview'] = {
    totalActiveUnits: 0,
    availableUnits: 0,
    holdUnits: 0,
    soldUnits: 0,
    soldValue: 0,
    projectedCommission: 0,
    activeUsers: 0,
    duplicateAttempts: 0,
    pdfExports: 0,
    inactiveUsers: 0,
    archivedUnits: 0,
    staleUnits: 0,
  }

  for (const unit of units) {
    if (unit.archived) {
      overview.archivedUnits += 1
    } else {
      overview.totalActiveUnits += 1
      overview.projectedCommission += unit.commissionAmount
      if (unit.status === 'available') overview.availableUnits += 1
      if (unit.status === 'hold') overview.holdUnits += 1
      if (isSoldStatus(unit.status)) overview.soldUnits += 1
      if (isStale(unit, now)) overview.staleUnits += 1
    }
    if (isSoldStatus(unit.status)) overview.soldValue += unit.totalAmount
  }

  for (const user of users) {
    if (user.status === 'active') overview.activeUsers += 1
    if (user.status === 'inactive') overview.inactiveUsers += 1
  }

  for (const event of events) {
    if (event.eventType === 'duplicate_phone_blocked') overview.duplicateAttempts += 1
    if (event.eventType === 'pdf_generated' || event.eventType === 'pdf_shared_or_downloaded') overview.pdfExports += 1
  }

  return overview
}

export function buildAnalyticsFilterOptions(user: LeadraUser, state: AppDataState): AnalyticsFilterOptions {
  const units = filterAnalyticsUnits(user, state.units)
  const users = filterAnalyticsUsers(user, state.users)
  return {
    teams: uniqueOptions(users.map((item) => ({ id: item.teamId, label: item.teamId }))),
    users: users
      .filter((item) => item.role === 'sales' || item.role === 'manager')
      .map((item) => ({ id: item.id, label: item.fullName }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    projects: uniqueOptions(units.map((unit) => ({ id: unit.projectId, label: unit.projectName }))),
    developers: uniqueOptions(units.map((unit) => ({ id: unit.developerId, label: unit.developerName }))),
    destinations: uniqueOptions(units.map((unit) => ({ id: unit.destinationId, label: unit.destinationName }))),
  }
}

export function getAnalyticsDateRange(filters: AnalyticsFilters, now = defaultNow) {
  const end = filters.dateWindow === 'custom' && filters.endDate ? endOfDay(filters.endDate) : now
  const start =
    filters.dateWindow === 'custom' && filters.startDate
      ? startOfDay(filters.startDate)
      : new Date(end.getTime() - (analyticsWindowDays(filters.dateWindow) - 1) * 24 * 60 * 60 * 1000)
  return { start, end }
}

export function analyticsWindowDays(window: AnalyticsDateWindow) {
  if (window === '30d') return 30
  if (window === '90d') return 90
  return 7
}

export function buildAnalyticsCsv(dashboard: AnalyticsDashboard, filters: AnalyticsFilters): string {
  const rows: string[][] = [
    ['Section', 'Name', 'Metric', 'Value'],
    ['Overview', 'Active units', 'count', String(dashboard.overview.totalActiveUnits)],
    ['Overview', 'Sold value', 'amount', String(dashboard.overview.soldValue)],
    ['Overview', 'Projected commission', 'amount', String(dashboard.overview.projectedCommission)],
    ['Overview', 'PDF exports', 'count', String(dashboard.overview.pdfExports)],
    ['Overview', 'Duplicate attempts', 'count', String(dashboard.overview.duplicateAttempts)],
    ['Filters', 'Date window', 'value', filters.dateWindow],
  ]

  for (const row of dashboard.salesPerformance) {
    rows.push(['Sales', row.userName, 'units created', String(row.unitsCreated)])
    rows.push(['Sales', row.userName, 'sold value', String(row.soldValue)])
    rows.push(['Sales', row.userName, 'activity count', String(row.activityCount)])
  }

  for (const project of dashboard.inventoryHealth) {
    rows.push(['Inventory', project.projectName, 'total units', String(project.totalUnits)])
    rows.push(['Inventory', project.projectName, 'hold ratio', String(project.holdRatio)])
    rows.push(['Inventory', project.projectName, 'media completeness', String(project.mediaCompleteness)])
  }

  for (const point of dashboard.activityTimeline) {
    rows.push(['Timeline', point.date, 'activity count', String(point.activityCount)])
    rows.push(['Timeline', point.date, 'sold value', String(point.soldValue)])
    rows.push(['Timeline', point.date, 'pdf exports', String(point.pdfExports)])
  }

  return rows.map((row) => row.map(csvCell).join(',')).join('\n')
}

function filterAnalyticsUnits(user: LeadraUser, units: LeadraUnit[]) {
  if (user.role === 'admin' || user.role === 'sub_admin' || user.role === 'manager') return units
  return []
}

function filterAnalyticsEvents(user: LeadraUser, events: AnalyticsEvent[]) {
  if (user.role === 'admin' || user.role === 'sub_admin' || user.role === 'manager') return events
  return []
}

function filterAnalyticsUsers(user: LeadraUser, users: LeadraUser[]) {
  if (user.role === 'admin' || user.role === 'sub_admin' || user.role === 'manager') return users
  return []
}

function filterAnalyticsTargets(user: LeadraUser, targets: AnalyticsTarget[]) {
  if (user.role === 'admin' || user.role === 'sub_admin' || user.role === 'manager') return targets
  return []
}

function buildSalesPerformance(users: LeadraUser[], units: LeadraUnit[], events: AnalyticsEvent[]): AnalyticsSalesPerformance[] {
  const unitsByCreator = new Map<string, LeadraUnit[]>()
  const eventsByActor = new Map<string, AnalyticsEvent[]>()

  for (const unit of units) {
    const current = unitsByCreator.get(unit.createdBy)
    if (current) current.push(unit)
    else unitsByCreator.set(unit.createdBy, [unit])
  }

  for (const event of events) {
    const current = eventsByActor.get(event.actorId)
    if (current) current.push(event)
    else eventsByActor.set(event.actorId, [event])
  }

  return users
    .filter((user) => user.role === 'sales')
    .map((user) => {
      const userUnits = unitsByCreator.get(user.id) ?? []
      const userEvents = eventsByActor.get(user.id) ?? []
      const soldUnits = userUnits.filter((unit) => isSoldStatus(unit.status))

      return {
        userId: user.id,
        userName: user.fullName,
        role: user.role,
        teamId: user.teamId,
        unitsCreated: userUnits.length,
        unitsSold: soldUnits.length,
        soldValue: soldUnits.reduce((total, unit) => total + unit.totalAmount, 0),
        commissionContribution: soldUnits.reduce((total, unit) => total + unit.commissionAmount, 0),
        activityCount: userEvents.length,
        lastActivityAt: userEvents[0]?.createdAt ?? null,
      }
    })
    .filter((row) => row.unitsCreated > 0 || row.activityCount > 0)
    .sort((a, b) => b.activityCount - a.activityCount || b.soldValue - a.soldValue)
}

function buildInventoryHealth(units: LeadraUnit[], locale: LocaleCode, now: Date): AnalyticsInventoryHealth[] {
  const grouped = new Map<string, LeadraUnit[]>()
  for (const unit of units) {
    if (unit.archived) continue
    const current = grouped.get(unit.projectId)
    if (current) current.push(unit)
    else grouped.set(unit.projectId, [unit])
  }

  return Array.from(grouped.entries())
    .map(([projectId, projectUnits]) => {
      const totalUnits = projectUnits.length
      const holdUnits = projectUnits.filter((unit) => unit.status === 'hold').length

      return {
        projectId,
        projectName: projectUnits[0].projectName,
        developerName: projectUnits[0].developerName,
        destinationName: projectUnits[0].destinationName,
        totalUnits,
        availableUnits: projectUnits.filter((unit) => unit.status === 'available').length,
        holdUnits,
        soldUnits: projectUnits.filter((unit) => isSoldStatus(unit.status)).length,
        holdRatio: totalUnits === 0 ? 0 : Math.round((holdUnits / totalUnits) * 100),
        averagePrice: Math.round(projectUnits.reduce((total, unit) => total + unit.totalAmount, 0) / totalUnits),
        mediaCompleteness: Math.round((projectUnits.filter((unit) => unit.media.length > 0).length / totalUnits) * 100),
        staleUnits: projectUnits.filter((unit) => isStale(unit, now)).length,
      }
    })
    .sort((a, b) => b.totalUnits - a.totalUnits || compareText(locale, a.projectName, b.projectName))
}

function buildActivityTimeline(events: AnalyticsEvent[], filters: AnalyticsFilters = defaultAnalyticsFilters, now = defaultNow): AnalyticsTimelinePoint[] {
  const days = new Map<string, AnalyticsTimelinePoint>()
  const { start, end } = getAnalyticsDateRange(filters, now)
  for (let time = startOfDay(start).getTime(); time <= end.getTime(); time += 24 * 60 * 60 * 1000) {
    const date = new Date(time).toISOString().slice(0, 10)
    days.set(date, {
      date,
      unitsCreated: 0,
      statusChanges: 0,
      soldValue: 0,
      pdfExports: 0,
      activityCount: 0,
    })
  }

  for (const event of events) {
    const date = event.createdAt.slice(0, 10)
    const point =
      days.get(date) ?? {
        date,
        unitsCreated: 0,
        statusChanges: 0,
        soldValue: 0,
        pdfExports: 0,
        activityCount: 0,
      }

    point.activityCount += 1
    if (event.eventType === 'unit_created') point.unitsCreated += 1
    if (event.eventType === 'status_changed') point.statusChanges += 1
    if (event.eventType === 'status_changed' && isSoldStatus(event.unitStatusAfter)) point.soldValue += event.amountValue ?? 0
    if (event.eventType === 'pdf_generated' || event.eventType === 'pdf_shared_or_downloaded') point.pdfExports += 1
    days.set(date, point)
  }

  return Array.from(days.values()).sort((a, b) => a.date.localeCompare(b.date))
}

function filterUsersByFilters(users: LeadraUser[], filters: AnalyticsFilters) {
  return users.filter((user) => {
    if (filters.teamIds.length > 0 && !filters.teamIds.includes(user.teamId)) return false
    if (filters.userIds.length > 0 && !filters.userIds.includes(user.id)) return false
    return true
  })
}

function filterUnitsByFilters(units: LeadraUnit[], filters: AnalyticsFilters) {
  return units.filter((unit) => {
    if (filters.teamIds.length > 0 && !filters.teamIds.includes(unit.teamId)) return false
    if (filters.userIds.length > 0 && !filters.userIds.includes(unit.createdBy)) return false
    if (filters.projectIds.length > 0 && !filters.projectIds.includes(unit.projectId)) return false
    if (filters.developerIds.length > 0 && !filters.developerIds.includes(unit.developerId)) return false
    if (filters.destinationIds.length > 0 && !filters.destinationIds.includes(unit.destinationId)) return false
    if (filters.statuses.length > 0 && !filters.statuses.includes(unit.status)) return false
    if (filters.paymentMethods.length > 0 && !filters.paymentMethods.includes(unit.paymentMethod)) return false
    return true
  })
}

function filterEventsByFilters(events: AnalyticsEvent[], units: LeadraUnit[], filters: AnalyticsFilters, now: Date) {
  const { start, end } = getAnalyticsDateRange(filters, now)
  const unitIds = new Set(units.map((unit) => unit.id))
  return events.filter((event) => {
    const createdAt = new Date(event.createdAt)
    if (createdAt < start || createdAt > end) return false
    if (filters.teamIds.length > 0 && event.teamId && !filters.teamIds.includes(event.teamId)) return false
    if (filters.userIds.length > 0 && !filters.userIds.includes(event.actorId)) return false
    if (event.unitId != null && !unitIds.has(event.unitId)) return false
    if (event.unitId == null) {
      if (filters.projectIds.length > 0 && (!event.projectId || !filters.projectIds.includes(event.projectId))) return false
      if (filters.developerIds.length > 0 && (!event.developerId || !filters.developerIds.includes(event.developerId))) return false
      if (filters.destinationIds.length > 0 && (!event.destinationId || !filters.destinationIds.includes(event.destinationId))) return false
    }
    return true
  })
}

function buildTargetProgress(
  targets: AnalyticsTarget[],
  units: LeadraUnit[],
  events: AnalyticsEvent[],
  locale: LocaleCode,
): AnalyticsTargetProgress[] {
  return targets.map((target) => {
    const targetUnits = units.filter((unit) => matchesTarget(target, unit.teamId, unit.createdBy))
    const targetEvents = events.filter((event) => matchesTarget(target, event.teamId, event.actorId))
    const created = targetUnits.filter((unit) => isWithin(unit.createdAt, target.startsAt, target.endsAt)).length
    const sold = targetUnits.filter((unit) => isSoldStatus(unit.status) && isWithin(unit.updatedAt, target.startsAt, target.endsAt))
    const soldValue = sold.reduce((total, unit) => total + unit.totalAmount, 0)
    const commission = sold.reduce((total, unit) => total + unit.commissionAmount, 0)

    return {
      targetId: target.id,
      label:
        target.scopeId == null
          ? translate(locale, 'analytics.targetLabel.company', { period: translate(locale, `analytics.period.${target.period}`) })
          : translate(locale, 'analytics.targetLabel.scope', {
              scopeId: target.scopeId,
              period: translate(locale, `analytics.period.${target.period}`),
            }),
      unitsCreatedProgress: percent(created, target.targetUnitsCreated),
      unitsSoldProgress: percent(sold.length, target.targetUnitsSold),
      soldValueProgress: percent(soldValue, target.targetSoldValue),
      commissionProgress: percent(commission, target.targetCommission),
      activityProgress: percent(targetEvents.length, target.targetActivityEvents),
    }
  })
}

function matchesTarget(target: AnalyticsTarget, teamId: string | null, userId: string | null) {
  if (target.scopeType === 'company') return true
  if (target.scopeType === 'team') return target.scopeId === teamId
  return target.scopeId === userId
}

function isWithin(value: string, startsAt: string, endsAt: string) {
  const time = new Date(value).getTime()
  return time >= new Date(startsAt).getTime() && time <= new Date(endsAt).getTime()
}

function percent(value: number, target: number) {
  if (target <= 0) return 0
  return Math.min(100, Math.round((value / target) * 100))
}

function isStale(unit: LeadraUnit, now: Date) {
  return !unit.archived && !isSoldStatus(unit.status) && now.getTime() - new Date(unit.updatedAt).getTime() > staleAfterMs
}

function uniqueOptions(options: { id: string; label: string }[]) {
  const seen = new Map<string, string>()
  for (const option of options) {
    if (option.id && !seen.has(option.id)) seen.set(option.id, option.label)
  }
  return Array.from(seen.entries())
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

function startOfDay(value: string | Date) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

function endOfDay(value: string | Date) {
  const date = new Date(value)
  date.setHours(23, 59, 59, 999)
  return date
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`
}
