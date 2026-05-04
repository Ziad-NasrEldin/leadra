import { filterUnitsForUser } from './domain'
import type {
  AnalyticsDashboard,
  AnalyticsEvent,
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

export function canAccessAnalytics(user: LeadraUser): boolean {
  return user.role === 'admin' || user.role === 'sub_admin' || user.role === 'manager'
}

export function buildAnalyticsDashboard(user: LeadraUser, state: AppDataState, now = new Date('2026-05-04T12:00:00.000Z')): AnalyticsDashboard {
  const units = filterAnalyticsUnits(user, state.units)
  const events = filterAnalyticsEvents(user, state.analyticsEvents)
  const users = filterAnalyticsUsers(user, state.users)
  const targets = filterAnalyticsTargets(user, state.analyticsTargets)

  return {
    scopeLabel: user.role === 'manager' ? `Team ${user.teamId}` : 'Company-wide',
    overview: {
      totalActiveUnits: units.filter((unit) => !unit.archived).length,
      availableUnits: units.filter((unit) => !unit.archived && unit.status === 'available').length,
      holdUnits: units.filter((unit) => !unit.archived && unit.status === 'hold').length,
      soldUnits: units.filter((unit) => !unit.archived && unit.status === 'sold').length,
      soldValue: units.filter((unit) => unit.status === 'sold').reduce((total, unit) => total + unit.totalAmount, 0),
      projectedCommission: units.filter((unit) => !unit.archived).reduce((total, unit) => total + unit.commissionAmount, 0),
      activeUsers: users.filter((item) => item.status === 'active').length,
      duplicateAttempts: events.filter((event) => event.eventType === 'duplicate_phone_blocked').length,
      pdfExports: events.filter((event) => event.eventType === 'pdf_generated' || event.eventType === 'pdf_shared_or_downloaded').length,
      inactiveUsers: users.filter((item) => item.status === 'inactive').length,
      archivedUnits: units.filter((unit) => unit.archived).length,
      staleUnits: units.filter((unit) => isStale(unit, now)).length,
    },
    salesPerformance: buildSalesPerformance(users, units, events),
    inventoryHealth: buildInventoryHealth(units, now),
    activityTimeline: buildActivityTimeline(events),
    targetProgress: buildTargetProgress(targets, units, events),
  }
}

function filterAnalyticsUnits(user: LeadraUser, units: LeadraUnit[]) {
  if (user.role === 'manager') return filterUnitsForUser(user, units)
  if (user.role === 'admin' || user.role === 'sub_admin') return units
  return []
}

function filterAnalyticsEvents(user: LeadraUser, events: AnalyticsEvent[]) {
  if (user.role === 'manager') return events.filter((event) => event.teamId === user.teamId)
  if (user.role === 'admin' || user.role === 'sub_admin') return events
  return []
}

function filterAnalyticsUsers(user: LeadraUser, users: LeadraUser[]) {
  if (user.role === 'manager') return users.filter((item) => item.teamId === user.teamId)
  if (user.role === 'admin' || user.role === 'sub_admin') return users
  return []
}

function filterAnalyticsTargets(user: LeadraUser, targets: AnalyticsTarget[]) {
  if (user.role === 'manager') {
    return targets.filter((target) => target.scopeType === 'team' && target.scopeId === user.teamId)
  }

  if (user.role === 'admin' || user.role === 'sub_admin') return targets
  return []
}

function buildSalesPerformance(users: LeadraUser[], units: LeadraUnit[], events: AnalyticsEvent[]): AnalyticsSalesPerformance[] {
  return users
    .filter((user) => user.role === 'sales')
    .map((user) => {
      const userUnits = units.filter((unit) => unit.createdBy === user.id)
      const userEvents = events.filter((event) => event.actorId === user.id)
      const soldUnits = userUnits.filter((unit) => unit.status === 'sold')

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

function buildInventoryHealth(units: LeadraUnit[], now: Date): AnalyticsInventoryHealth[] {
  const grouped = new Map<string, LeadraUnit[]>()
  for (const unit of units.filter((item) => !item.archived)) {
    grouped.set(unit.projectId, [...(grouped.get(unit.projectId) ?? []), unit])
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
        soldUnits: projectUnits.filter((unit) => unit.status === 'sold').length,
        holdRatio: totalUnits === 0 ? 0 : Math.round((holdUnits / totalUnits) * 100),
        averagePrice: Math.round(projectUnits.reduce((total, unit) => total + unit.totalAmount, 0) / totalUnits),
        mediaCompleteness: Math.round((projectUnits.filter((unit) => unit.media.length > 0).length / totalUnits) * 100),
        staleUnits: projectUnits.filter((unit) => isStale(unit, now)).length,
      }
    })
    .sort((a, b) => b.totalUnits - a.totalUnits || a.projectName.localeCompare(b.projectName))
}

function buildActivityTimeline(events: AnalyticsEvent[]): AnalyticsTimelinePoint[] {
  const days = new Map<string, AnalyticsTimelinePoint>()

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
    if (event.eventType === 'status_changed' && event.unitStatusAfter === 'sold') point.soldValue += event.amountValue ?? 0
    if (event.eventType === 'pdf_generated' || event.eventType === 'pdf_shared_or_downloaded') point.pdfExports += 1
    days.set(date, point)
  }

  return Array.from(days.values()).sort((a, b) => a.date.localeCompare(b.date))
}

function buildTargetProgress(targets: AnalyticsTarget[], units: LeadraUnit[], events: AnalyticsEvent[]): AnalyticsTargetProgress[] {
  return targets.map((target) => {
    const targetUnits = units.filter((unit) => matchesTarget(target, unit.teamId, unit.createdBy))
    const targetEvents = events.filter((event) => matchesTarget(target, event.teamId, event.actorId))
    const created = targetUnits.filter((unit) => isWithin(unit.createdAt, target.startsAt, target.endsAt)).length
    const sold = targetUnits.filter((unit) => unit.status === 'sold' && isWithin(unit.updatedAt, target.startsAt, target.endsAt))
    const soldValue = sold.reduce((total, unit) => total + unit.totalAmount, 0)
    const commission = sold.reduce((total, unit) => total + unit.commissionAmount, 0)

    return {
      targetId: target.id,
      label: `${target.scopeId ?? 'company'} ${target.period} target`,
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
  return !unit.archived && unit.status !== 'sold' && now.getTime() - new Date(unit.updatedAt).getTime() > staleAfterMs
}
