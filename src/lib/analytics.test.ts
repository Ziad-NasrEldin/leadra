import { describe, expect, it } from 'vitest'
import { buildAnalyticsDashboard, defaultAnalyticsFilters } from './analytics'
import type { AnalyticsEvent, AnalyticsTarget, AppDataState, LeadraUnit, LeadraUser } from './types'

const manager: LeadraUser = {
  id: 'manager-1',
  fullName: 'Mona Manager',
  email: 'manager@leadra.test',
  role: 'manager',
  jobTitle: 'Manager',
  phoneNumber: '+201000000000',
  teamId: 'team-a',
  branchId: 'branch-cairo',
  status: 'active',
}

const salesA: LeadraUser = {
  ...manager,
  id: 'sales-a',
  fullName: 'Sara Sales',
  email: 'sales-a@leadra.test',
  role: 'sales',
}

const salesB: LeadraUser = {
  ...salesA,
  id: 'sales-b',
  fullName: 'Omar Sales',
  email: 'sales-b@leadra.test',
  teamId: 'team-b',
  branchId: 'branch-alex',
}

const baseUnit: LeadraUnit = {
  id: 101,
  unitCode: 'NE101BR2Ba2',
  developerId: 'dev-1',
  developerName: 'Palm Hills',
  projectId: 'project-1',
  projectName: 'New Cairo Estates',
  destinationId: 'dest-1',
  destinationName: 'New Cairo',
  unitType: 'Apartment',
  floor: '2',
  bua: 140,
  roofGardenArea: null,
  gardenArea: null,
  terraceArea: null,
  viewId: 'view-1',
  viewName: 'Garden',
  bedrooms: 2,
  bathrooms: 2,
  elevator: true,
  landArea: null,
  furnished: false,
  finish: 'Fully Finished',
  paymentMethod: 'cash',
  totalAmount: 4_000_000,
  downPayment: null,
  remainingPayment: null,
  commissionPercentage: 1.5,
  commissionAmount: 60_000,
  installmentType: null,
  installmentYears: null,
  installmentAmount: null,
  deliveryExpectancy: { mode: 'year', year: 2027 },
  originalOwnerName: null,
  countryCode: '+20',
  originalOwnerPhone: null,
  normalizedOwnerPhone: null,
  salesNotes: '',
  status: 'available',
  archived: false,
  createdBy: 'sales-a',
  createdByName: 'Sara Sales',
  teamId: 'team-a',
  branchId: 'branch-cairo',
  createdAt: '2026-05-04T00:00:00.000Z',
  updatedAt: '2026-05-04T00:00:00.000Z',
  media: [],
  adminManagerNotes: [],
}

const otherTeamEvent: AnalyticsEvent = {
  id: 'event-1',
  eventType: 'unit_created',
  actorId: 'sales-b',
  actorRole: 'sales',
  teamId: 'team-b',
  branchId: 'branch-alex',
  unitId: 102,
  projectId: 'project-2',
  developerId: 'dev-2',
  destinationId: 'dest-2',
  metadata: {},
  createdAt: '2026-05-04T08:00:00.000Z',
}

const companyTarget: AnalyticsTarget = {
  id: 'target-1',
  scopeType: 'company',
  scopeId: null,
  period: 'monthly',
  targetUnitsCreated: 2,
  targetUnitsSold: 1,
  targetSoldValue: 1,
  targetCommission: 1,
  targetActivityEvents: 1,
  startsAt: '2026-05-01T00:00:00.000Z',
  endsAt: '2026-05-31T23:59:59.000Z',
  createdBy: 'admin-1',
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
}

const state: AppDataState = {
  users: [manager, salesA, salesB],
  units: [
    baseUnit,
    {
      ...baseUnit,
      id: 102,
      unitCode: 'ZE102BR3Ba2',
      projectId: 'project-2',
      projectName: 'ZED East',
      developerId: 'dev-2',
      developerName: 'SODIC',
      destinationId: 'dest-2',
      destinationName: 'Sheikh Zayed',
      createdBy: 'sales-b',
      createdByName: 'Omar Sales',
      teamId: 'team-b',
      branchId: 'branch-alex',
      totalAmount: 6_000_000,
      commissionAmount: 90_000,
    },
  ],
  branches: [],
  teams: [],
  notifications: [],
  auditLogs: [],
  analyticsEvents: [otherTeamEvent],
  analyticsTargets: [companyTarget],
  settings: {
    companyName: 'Leadra',
    commissionPercentage: 1.5,
    footerText: '',
    contactDetails: '',
    logoPath: '',
    pdfLayout: 'classic',
    mediaLimitMb: 40,
    paymentMethods: ['cash', 'installment'],
  },
}

describe('analytics visibility', () => {
  it('does not scope manager analytics to the manager team or branch', () => {
    const dashboard = buildAnalyticsDashboard(
      manager,
      state,
      'en',
      new Date('2026-05-04T12:00:00.000Z'),
      defaultAnalyticsFilters,
    )

    expect(dashboard.scopeLabel).toBe('Company-wide')
    expect(dashboard.overview.totalActiveUnits).toBe(2)
    expect(dashboard.overview.activeUsers).toBe(3)
    expect(dashboard.activityTimeline.some((point) => point.unitsCreated === 1)).toBe(true)
    expect(dashboard.filterOptions.teams.map((team) => team.id).sort()).toEqual(['team-a', 'team-b'])
    expect(dashboard.targetProgress).toHaveLength(1)
  })
})
