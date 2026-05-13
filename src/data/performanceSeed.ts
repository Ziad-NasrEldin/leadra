import { demoUsers, initialAppState, lookupValues } from './seed'
import type { AnalyticsEvent, AppDataState, AuditLogItem, LeadraUnit, LeadraUser, LookupValue, NotificationItem } from '../lib/types'

export interface PerformanceWorkspace {
  state: AppDataState
  lookupValues: LookupValue[]
}

const teamIds = Array.from({ length: 20 }, (_, index) => `perf-team-${index + 1}`)
const branchIds = Array.from({ length: 4 }, (_, index) => `perf-branch-${index + 1}`)

export function buildPerformanceWorkspace(unitCount = 1000): PerformanceWorkspace {
  const safeUnitCount = Math.min(10000, Math.max(1000, Math.floor(unitCount)))
  const users = buildUsers()
  const performanceLookups = buildLookupValues()
  const units = buildUnits(safeUnitCount, users, performanceLookups)

  return {
    lookupValues: performanceLookups,
    state: {
      ...initialAppState,
      users,
      units,
      notifications: buildNotifications(users),
      auditLogs: buildAuditLogs(users, units),
      analyticsEvents: buildAnalyticsEvents(users, units),
      analyticsTargets: initialAppState.analyticsTargets,
    },
  }
}

function buildUsers(): LeadraUser[] {
  const baseUsers = demoUsers.map((user, index) => ({
    ...user,
    teamId: teamIds[index % teamIds.length],
    branchId: branchIds[index % branchIds.length],
  }))
  const generatedUsers = Array.from({ length: 96 }, (_, index): LeadraUser => {
    const id = `perf-sales-${index + 1}`
    return {
      id,
      fullName: `Performance Sales ${index + 1}`,
      email: `${id}@leadra.test`,
      role: index % 12 === 0 ? 'manager' : 'sales',
      jobTitle: index % 12 === 0 ? 'Team Manager' : 'Sales Consultant',
      phoneNumber: `+2010${String(index + 10000000).slice(0, 8)}`,
      teamId: teamIds[index % teamIds.length],
      branchId: branchIds[index % branchIds.length],
      status: index % 19 === 0 ? 'inactive' : 'active',
      createdAt: dateFromOffset(index + 20),
      lastLoginAt: dateFromOffset(index % 30),
    }
  })
  return [...baseUsers, ...generatedUsers]
}

function buildLookupValues(): LookupValue[] {
  const developers = Array.from({ length: 12 }, (_, index): LookupValue => ({ id: `perf-dev-${index + 1}`, kind: 'developer', label: `Developer ${index + 1}` }))
  const projects = Array.from({ length: 24 }, (_, index): LookupValue => ({ id: `perf-project-${index + 1}`, kind: 'project', label: `Performance Project ${index + 1}` }))
  const destinations = Array.from({ length: 8 }, (_, index): LookupValue => ({ id: `perf-destination-${index + 1}`, kind: 'destination', label: `Destination ${index + 1}` }))
  const baseStatic = lookupValues.filter((item) => item.kind === 'view' || item.kind === 'unit_type' || item.kind === 'finish')
  return [...developers, ...projects, ...destinations, ...baseStatic]
}

function buildUnits(count: number, users: LeadraUser[], values: LookupValue[]): LeadraUnit[] {
  const developers = values.filter((item) => item.kind === 'developer')
  const projects = values.filter((item) => item.kind === 'project')
  const destinations = values.filter((item) => item.kind === 'destination')
  const unitTypes = values.filter((item) => item.kind === 'unit_type')
  const views = values.filter((item) => item.kind === 'view')
  const finishes = values.filter((item) => item.kind === 'finish')
  const salesUsers = users.filter((user) => user.role === 'sales')

  return Array.from({ length: count }, (_, index): LeadraUnit => {
    const sales = salesUsers[index % salesUsers.length]
    const project = projects[index % projects.length]
    const developer = developers[index % developers.length]
    const destination = destinations[index % destinations.length]
    const totalAmount = 2_000_000 + (index % 180) * 55_000
    const status = index % 11 === 0 ? 'sold' : index % 5 === 0 ? 'hold' : 'available'

    return {
      id: index + 1,
      unitCode: `PERF-${String(index + 1).padStart(5, '0')}`,
      developerId: developer.id,
      developerName: developer.label,
      projectId: project.id,
      projectName: project.label,
      destinationId: destination.id,
      destinationName: destination.label,
      unitType: unitTypes[index % unitTypes.length]?.label ?? 'Apartment',
      floor: String((index % 18) + 1),
      bua: 90 + (index % 180),
      roofGardenArea: index % 7 === 0 ? 25 + (index % 90) : null,
      gardenArea: index % 7 === 0 ? 25 + (index % 90) : null,
      terraceArea: null,
      viewId: views[index % views.length]?.id ?? '',
      viewName: views[index % views.length]?.label ?? 'Open view',
      bedrooms: (index % 4) + 1,
      bathrooms: (index % 3) + 1,
      elevator: index % 3 !== 0,
      landArea: index % 8 === 0 ? 180 + (index % 120) : null,
      furnished: index % 6 === 0,
      finish: finishes[index % finishes.length]?.label ?? 'Fully Finished',
      paymentMethod: index % 4 === 0 ? 'cash' : 'installment',
      totalAmount,
      downPayment: index % 4 === 0 ? null : Math.round(totalAmount * 0.15),
      remainingPayment: index % 4 === 0 ? null : Math.round(totalAmount * 0.85),
      commissionPercentage: 1.5,
      commissionAmount: Math.round(totalAmount * 0.015),
      installmentType: index % 4 === 0 ? null : 'quarterly',
      installmentYears: index % 4 === 0 ? null : 6,
      installmentAmount: index % 4 === 0 ? null : Math.round((totalAmount * 0.85) / 24),
      deliveryExpectancy: { mode: 'month_year', month: (index % 12) + 1, year: 2027 + (index % 3) },
      originalOwnerName: `Owner ${index + 1}`,
      countryCode: '+20',
      originalOwnerPhone: `010${String(10000000 + index).slice(0, 8)}`,
      normalizedOwnerPhone: `+2010${String(10000000 + index).slice(0, 8)}`,
      salesNotes: index % 10 === 0 ? 'Performance seed note for export and list rendering validation.' : '',
      status,
      archived: index % 37 === 0,
      createdBy: sales.id,
      createdByName: sales.fullName,
      teamId: sales.teamId,
      branchId: sales.branchId,
      createdAt: dateFromOffset(index % 180),
      updatedAt: dateFromOffset(index % 21),
      media: index % 4 === 0 ? [{ id: `perf-media-${index + 1}`, type: 'image', url: '/favicon.svg', name: 'Performance thumbnail', sizeBytes: 2048 }] : [],
      adminManagerNotes: [],
    }
  })
}

function buildNotifications(users: LeadraUser[]): NotificationItem[] {
  return Array.from({ length: 1000 }, (_, index): NotificationItem => ({
    id: `perf-notification-${index + 1}`,
    title: `Performance notification ${index + 1}`,
    body: 'Generated notification used to validate list pagination and route performance.',
    messageKey: null,
    messageParams: null,
    audienceRole: index % 3 === 0 ? 'admin' : index % 3 === 1 ? 'manager' : undefined,
    userId: index % 3 === 2 ? users[index % users.length].id : undefined,
    createdAt: dateFromOffset(index % 60),
    read: index % 4 === 0,
  }))
}

function buildAuditLogs(users: LeadraUser[], units: LeadraUnit[]): AuditLogItem[] {
  return Array.from({ length: 5000 }, (_, index): AuditLogItem => ({
    id: `perf-audit-${index + 1}`,
    actorName: users[index % users.length].fullName,
    actorRole: users[index % users.length].role,
    actionType: index % 2 === 0 ? 'Status changed' : 'Unit created',
    messageKey: null,
    messageParams: null,
    relatedUnitCode: units[index % units.length].unitCode,
    previousValue: index % 2 === 0 ? 'available' : null,
    newValue: index % 2 === 0 ? 'hold' : null,
    ipAddress: null,
    createdAt: dateFromOffset(index % 120),
  }))
}

function buildAnalyticsEvents(users: LeadraUser[], units: LeadraUnit[]): AnalyticsEvent[] {
  return Array.from({ length: Math.min(10000, units.length * 2) }, (_, index): AnalyticsEvent => {
    const unit = units[index % units.length]
    const actor = users.find((user) => user.id === unit.createdBy) ?? users[0]
    return {
      id: `perf-analytics-${index + 1}`,
      eventType: index % 4 === 0 ? 'pdf_generated' : index % 3 === 0 ? 'status_changed' : 'unit_created',
      actorId: actor.id,
      actorRole: actor.role,
      teamId: unit.teamId,
      branchId: unit.branchId,
      unitId: unit.id,
      projectId: unit.projectId,
      developerId: unit.developerId,
      destinationId: unit.destinationId,
      unitStatusBefore: 'available',
      unitStatusAfter: unit.status,
      amountValue: unit.totalAmount,
      commissionValue: unit.commissionAmount,
      metadata: {},
      createdAt: dateFromOffset(index % 90),
    }
  })
}

function dateFromOffset(daysAgo: number): string {
  const date = new Date(Date.UTC(2026, 4, 4, 9, 0, 0))
  date.setUTCDate(date.getUTCDate() - daysAgo)
  return date.toISOString()
}
