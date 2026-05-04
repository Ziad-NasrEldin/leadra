import { describe, expect, it } from 'vitest'
import { initialAppState } from '../data/seed'
import { buildAnalyticsDashboard, canAccessAnalytics } from './analytics'
import type { AnalyticsTarget, LeadraUser } from './types'

const admin = initialAppState.users.find((user) => user.role === 'admin') as LeadraUser
const manager = initialAppState.users.find((user) => user.role === 'manager') as LeadraUser
const sales = initialAppState.users.find((user) => user.role === 'sales') as LeadraUser

const monthlyTarget: AnalyticsTarget = {
  id: 'target-team-prime',
  scopeType: 'team',
  scopeId: 'team-prime',
  period: 'monthly',
  targetUnitsCreated: 2,
  targetUnitsSold: 1,
  targetSoldValue: 5_000_000,
  targetCommission: 75_000,
  targetActivityEvents: 4,
  startsAt: '2026-05-01T00:00:00.000Z',
  endsAt: '2026-05-31T23:59:59.999Z',
  createdBy: admin.id,
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
}

describe('analytics dashboard calculations', () => {
  it('allows admin/sub-admin and managers but blocks sales analytics access', () => {
    expect(canAccessAnalytics(admin)).toBe(true)
    expect(canAccessAnalytics(manager)).toBe(true)
    expect(canAccessAnalytics(sales)).toBe(false)
  })

  it('builds company-wide executive metrics from units, events, and targets', () => {
    const dashboard = buildAnalyticsDashboard(admin, {
      ...initialAppState,
      analyticsTargets: [monthlyTarget],
    })

    expect(dashboard.scopeLabel).toBe('Company-wide')
    expect(dashboard.overview.totalActiveUnits).toBe(2)
    expect(dashboard.overview.holdUnits).toBe(1)
    expect(dashboard.overview.projectedCommission).toBe(277_500)
    expect(dashboard.overview.pdfExports).toBe(1)
    expect(dashboard.inventoryHealth[0]).toMatchObject({
      projectName: 'New Cairo Estates',
      totalUnits: 1,
      mediaCompleteness: 100,
    })
    expect(dashboard.targetProgress[0]).toMatchObject({
      label: 'team-prime monthly target',
      unitsCreatedProgress: 50,
      activityProgress: 100,
    })
  })

  it('scopes manager analytics to their team and keeps owner data out of event metadata', () => {
    const dashboard = buildAnalyticsDashboard(manager, {
      ...initialAppState,
      analyticsTargets: [monthlyTarget],
    })

    expect(dashboard.scopeLabel).toBe('Team team-prime')
    expect(dashboard.overview.totalActiveUnits).toBe(1)
    expect(dashboard.overview.projectedCommission).toBe(75_000)
    expect(dashboard.salesPerformance).toHaveLength(1)
    expect(JSON.stringify(dashboard.activityTimeline)).not.toMatch(/owner|phone|Hassan|Mariam/i)
  })
})
