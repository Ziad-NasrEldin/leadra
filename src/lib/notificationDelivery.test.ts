import { describe, expect, it } from 'vitest'
import {
  getSalesUsersPastInactivityThreshold,
  queueSalesInactivityWarnings,
} from './notificationDelivery'
import type { AppDataState, LeadraUnit, LeadraUser } from './types'

const admin: LeadraUser = {
  id: 'admin-1',
  fullName: 'Admin User',
  email: 'admin@leadra.test',
  role: 'admin',
  jobTitle: 'Admin',
  phoneNumber: '+201000000001',
  teamId: 'team-a',
  branchId: 'branch-a',
  status: 'active',
}

const sales: LeadraUser = {
  id: 'sales-1',
  fullName: 'Sales User',
  email: 'sales@leadra.test',
  role: 'sales',
  jobTitle: 'Sales',
  phoneNumber: '+201000000002',
  teamId: 'team-a',
  branchId: 'branch-a',
  status: 'active',
}

const inactiveSales: LeadraUser = {
  ...sales,
  id: 'sales-inactive',
  email: 'inactive@leadra.test',
  status: 'inactive',
}

const unit: LeadraUnit = {
  id: 1,
  unitCode: 'NC2BR',
  developerId: 'dev-1',
  developerName: 'Developer',
  projectId: 'project-1',
  projectName: 'Project',
  destinationId: 'dest-1',
  destinationName: 'Destination',
  unitType: 'Apartment',
  floor: '2',
  bua: 120,
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
  originalOwnerName: 'Owner',
  countryCode: '+20',
  originalOwnerPhone: '1012345678',
  normalizedOwnerPhone: '+201012345678',
  salesNotes: '',
  status: 'available',
  archived: false,
  isSpecial: false,
  specialMarkedAt: null,
  specialMarkedBy: null,
  createdBy: 'sales-1',
  createdByName: 'Sales User',
  teamId: 'team-a',
  branchId: 'branch-a',
  createdAt: '2026-05-10T00:00:00.000Z',
  updatedAt: '2026-05-10T00:00:00.000Z',
  media: [],
  adminManagerNotes: [],
}

function state(overrides: Partial<AppDataState> = {}): AppDataState {
  return {
    users: [admin, sales, inactiveSales],
    units: [unit],
    branches: [],
    teams: [],
    notifications: [],
    auditLogs: [],
    analyticsEvents: [],
    analyticsTargets: [],
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
    ...overrides,
  }
}

describe('notification delivery', () => {
  it('detects active sales users with no uploads or uploads older than 72 hours', () => {
    const current = state({ users: [admin, sales, { ...sales, id: 'sales-2', email: 'sales2@leadra.test' }] })
    const staleUsers = getSalesUsersPastInactivityThreshold(current, new Date('2026-05-14T00:00:00.000Z'))

    expect(staleUsers.map((user) => user.id).sort()).toEqual(['sales-1', 'sales-2'])
  })

  it('queues sales, manager, admin, sub-admin notifications plus audit and analytics once per 24 hours', () => {
    const now = new Date('2026-05-14T00:00:00.000Z')
    const queued = queueSalesInactivityWarnings(state(), now)
    const repeated = queueSalesInactivityWarnings(queued, new Date('2026-05-14T12:00:00.000Z'))

    expect(queued.notifications).toHaveLength(4)
    expect(queued.notifications.map((notification) => notification.audienceRole ?? notification.userId).sort()).toEqual([
      'admin',
      'manager',
      'sales-1',
      'sub_admin',
    ])
    expect(queued.auditLogs[0]?.messageKey).toBe('message.audit.salesInactivity72h')
    expect(queued.analyticsEvents[0]?.eventType).toBe('inactive_user_detected')
    expect(repeated.notifications).toHaveLength(4)
  })
})
