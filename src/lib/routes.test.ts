import { describe, expect, it } from 'vitest'
import {
  adminSectionPath,
  analyticsPath,
  createStepPath,
  destinationPath,
  legacyHashPath,
  masterDataPath,
  normalizeIncomingAppUrl,
  parseAppRoute,
  pathForView,
  projectPath,
  unitDetailsPath,
} from './routes'

describe('routes', () => {
  it('builds top-level view paths', () => {
    expect(pathForView('dashboard')).toBe('/dashboard')
    expect(pathForView('units')).toBe('/units')
    expect(pathForView('create')).toBe('/create')
    expect(pathForView('notifications')).toBe('/notifications')
    expect(pathForView('profile')).toBe('/profile')
    expect(pathForView('analytics')).toBe('/analytics')
    expect(pathForView('admin')).toBe('/admin')
    expect(pathForView('palette')).toBe('/palette')
    expect(pathForView('details')).toBe('/units')
  })

  it('parses the units route class', () => {
    expect(parseAppRoute('/units')).toMatchObject({ view: 'units', destinationId: null, projectId: null })
    expect(parseAppRoute(destinationPath('north coast'))).toMatchObject({
      view: 'units',
      destinationId: 'north coast',
      projectId: null,
    })
    expect(parseAppRoute(projectPath('north coast', 'phase/1'))).toMatchObject({
      view: 'units',
      destinationId: 'north coast',
      projectId: 'phase/1',
    })
    expect(parseAppRoute(unitDetailsPath(123))).toMatchObject({ view: 'details', unitId: 123 })
  })

  it('parses create steps and defaults invalid create slugs safely', () => {
    expect(parseAppRoute('/create')).toMatchObject({ view: 'create', createStep: 'property' })
    expect(parseAppRoute(createStepPath('property'))).toMatchObject({ view: 'create', createStep: 'property' })
    expect(parseAppRoute(createStepPath('specs'))).toMatchObject({ view: 'create', createStep: 'specs' })
    expect(parseAppRoute(createStepPath('payment'))).toMatchObject({ view: 'create', createStep: 'payment' })
    expect(parseAppRoute(createStepPath('owner'))).toMatchObject({ view: 'create', createStep: 'owner' })
    expect(parseAppRoute(createStepPath('review'))).toMatchObject({ view: 'create', createStep: 'review' })
    expect(parseAppRoute('/create/unknown')).toMatchObject({ view: 'create', createStep: 'property' })
  })

  it('parses admin sections and master data directories with safe defaults', () => {
    expect(parseAppRoute('/admin')).toMatchObject({ view: 'admin', adminSection: 'users' })
    expect(parseAppRoute(adminSectionPath('users'))).toMatchObject({ view: 'admin', adminSection: 'users' })
    expect(parseAppRoute(adminSectionPath('settings'))).toMatchObject({ view: 'admin', adminSection: 'settings' })
    expect(parseAppRoute(adminSectionPath('metrics'))).toMatchObject({ view: 'admin', adminSection: 'metrics' })
    expect(parseAppRoute(adminSectionPath('audit'))).toMatchObject({ view: 'admin', adminSection: 'audit' })
    expect(parseAppRoute('/admin/unknown')).toMatchObject({ view: 'admin', adminSection: 'users' })

    for (const directory of ['developers', 'destinations', 'projects', 'views', 'finishes', 'unit-types', 'branches', 'teams'] as const) {
      expect(parseAppRoute(masterDataPath(directory))).toMatchObject({
        view: 'admin',
        adminSection: 'master-data',
        masterDataDirectory: directory,
      })
    }
    expect(parseAppRoute('/admin/master-data')).toMatchObject({ masterDataDirectory: 'developers' })
    expect(parseAppRoute('/admin/master-data/unknown')).toMatchObject({ masterDataDirectory: 'developers' })
  })

  it('parses analytics windows, query filters, and invalid window defaults', () => {
    expect(parseAppRoute('/analytics')).toMatchObject({ view: 'analytics', analyticsWindow: 'live' })
    expect(parseAppRoute(analyticsPath('live'))).toMatchObject({ view: 'analytics', analyticsWindow: 'live' })
    expect(parseAppRoute(analyticsPath('30d'))).toMatchObject({ view: 'analytics', analyticsWindow: '30d' })
    expect(parseAppRoute(analyticsPath('90d'))).toMatchObject({ view: 'analytics', analyticsWindow: '90d' })
    expect(parseAppRoute(analyticsPath('custom'))).toMatchObject({ view: 'analytics', analyticsWindow: 'custom' })
    expect(parseAppRoute('/analytics/unknown')).toMatchObject({ view: 'analytics', analyticsWindow: 'live' })

    const route = parseAppRoute(
      analyticsPath('custom', {
        filtersOpen: true,
        filters: {
          team: ['team-a', 'team-b'],
          user: ['user-a'],
          project: ['project-a'],
          developer: ['developer-a'],
          destination: ['destination-a'],
          status: ['available'],
          payment: ['cash'],
          start: '2026-01-01',
          end: '2026-01-31',
        },
      }),
    )

    expect(route.analyticsFiltersOpen).toBe(true)
    expect(route.analyticsFilters).toEqual({
      team: ['team-a', 'team-b'],
      user: ['user-a'],
      project: ['project-a'],
      developer: ['developer-a'],
      destination: ['destination-a'],
      status: ['available'],
      payment: ['cash'],
      start: '2026-01-01',
      end: '2026-01-31',
    })
  })

  it('maps legacy hash routes to pathname routes', () => {
    expect(legacyHashPath('#units')).toBe('/units')
    expect(legacyHashPath('#details/123')).toBe('/units/details/123')
    expect(legacyHashPath('#create/payment')).toBe('/create/payment')
    expect(legacyHashPath('#admin/audit')).toBe('/admin/audit')
    expect(legacyHashPath('#admin/master-data/branches')).toBe('/admin/master-data/branches')
    expect(legacyHashPath('#analytics/90d')).toBe('/analytics/90d')
    expect(legacyHashPath('#palette')).toBe('/palette')
    expect(parseAppRoute('/dashboard', '#admin/audit')).toMatchObject({ view: 'admin', adminSection: 'audit' })
  })

  it('normalizes incoming app urls to pathname and search strings', () => {
    expect(normalizeIncomingAppUrl('leadra://units/details/123')).toBe('/units/details/123')
    expect(normalizeIncomingAppUrl('leadra://analytics/90d?filters=open&team=team-a')).toBe(
      '/analytics/90d?filters=open&team=team-a',
    )
    expect(normalizeIncomingAppUrl('https://app.leadra.com/admin/audit')).toBe('/admin/audit')
    expect(normalizeIncomingAppUrl('https://app.leadra.com/analytics/custom?start=2026-01-01')).toBe(
      '/analytics/custom?start=2026-01-01',
    )
    expect(normalizeIncomingAppUrl('#create/payment')).toBe('/create/payment')
  })
})
