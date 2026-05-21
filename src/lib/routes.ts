export const createStepSlugs = ['property', 'specs', 'payment', 'owner', 'review'] as const
export const adminSectionSlugs = ['users', 'master-data', 'settings', 'metrics', 'audit'] as const
export const masterDataDirectorySlugs = [
  'developers',
  'destinations',
  'projects',
  'views',
  'finishes',
  'branches',
  'teams',
] as const
export const analyticsWindowSlugs = ['live', '30d', '90d', 'custom'] as const

export type View =
  | 'dashboard'
  | 'units'
  | 'special'
  | 'create'
  | 'details'
  | 'notifications'
  | 'profile'
  | 'analytics'
  | 'admin'
  | 'palette'

export type CreateStepSlug = (typeof createStepSlugs)[number]
export type AdminSectionSlug = (typeof adminSectionSlugs)[number]
export type MasterDataDirectorySlug = (typeof masterDataDirectorySlugs)[number]
export type AnalyticsWindowSlug = (typeof analyticsWindowSlugs)[number]

export type AnalyticsFilterKey =
  | 'team'
  | 'user'
  | 'project'
  | 'developer'
  | 'destination'
  | 'status'
  | 'payment'

export type AnalyticsFilters = Record<AnalyticsFilterKey, string[]> & {
  start: string | null
  end: string | null
}

export interface AppRoute {
  view: View
  destinationId: string | null
  projectId: string | null
  unitId: number | null
  createStep: CreateStepSlug
  adminSection: AdminSectionSlug
  masterDataDirectory: MasterDataDirectorySlug
  analyticsWindow: AnalyticsWindowSlug
  analyticsFiltersOpen: boolean
  analyticsFilters: AnalyticsFilters
}

const views = ['dashboard', 'units', 'special', 'create', 'notifications', 'profile', 'analytics', 'admin', 'palette'] as const
const analyticsFilterKeys: AnalyticsFilterKey[] = [
  'team',
  'user',
  'project',
  'developer',
  'destination',
  'status',
  'payment',
]

export function pathForView(view: View): string {
  if (view === 'dashboard') return '/dashboard'
  if (view === 'details') return '/units'
  return `/${view}`
}

export function unitDetailsPath(unitId: number | string): string {
  return `/units/details/${encodeURIComponent(String(unitId))}`
}

export function destinationPath(destinationId: string): string {
  return `/units/destinations/${encodeURIComponent(destinationId)}`
}

export function projectPath(destinationId: string, projectId: string): string {
  return `${destinationPath(destinationId)}/projects/${encodeURIComponent(projectId)}`
}

export function createStepPath(step: CreateStepSlug): string {
  return `/create/${step}`
}

export function adminSectionPath(section: AdminSectionSlug): string {
  return `/admin/${section}`
}

export function masterDataPath(directory: MasterDataDirectorySlug): string {
  return `/admin/master-data/${directory}`
}

export function analyticsPath(
  window: AnalyticsWindowSlug = 'live',
  options: { filtersOpen?: boolean; filters?: Partial<AnalyticsFilters> } = {},
): string {
  const params = analyticsSearchParams(options)
  const query = params.toString()
  return `/analytics/${window}${query ? `?${query}` : ''}`
}

export function analyticsSearchParams(options: {
  filtersOpen?: boolean
  filters?: Partial<AnalyticsFilters>
}): URLSearchParams {
  const params = new URLSearchParams()
  if (options.filtersOpen) params.set('filters', 'open')

  for (const key of analyticsFilterKeys) {
    for (const value of options.filters?.[key] ?? []) {
      if (value) params.append(key, value)
    }
  }

  if (options.filters?.start) params.set('start', options.filters.start)
  if (options.filters?.end) params.set('end', options.filters.end)
  return params
}

export function parseAppRoute(pathname: string, search = '', hash = ''): AppRoute {
  const effectiveSearch = search.startsWith('#') && !hash ? '' : search
  const effectiveHash = search.startsWith('#') && !hash ? search : hash
  const legacyPath = legacyHashPath(effectiveHash)
  if (legacyPath) return parseAppRoute(legacyPath)

  const [pathOnly, inlineSearch = ''] = pathname.split('?')
  const parts = pathOnly.split('/').filter(Boolean).map(decodeRoutePart)
  const query = effectiveSearch || (inlineSearch ? `?${inlineSearch}` : '')
  if (parts.length === 0) return emptyRoute('dashboard', query)

  const [root, second, third, fourth, fifth] = parts
  if (root === 'units') {
    if (second === 'details') return { ...emptyRoute('details', query), unitId: readNumericRouteId(third) }
    if (second && /^\d+$/.test(second)) return { ...emptyRoute('details', query), unitId: readNumericRouteId(second) }
    if (second === 'destinations' && third && fourth === 'projects' && fifth) {
      return { ...emptyRoute('units', query), destinationId: third, projectId: fifth }
    }
    if (second === 'destinations' && third) return { ...emptyRoute('units', query), destinationId: third }
    return emptyRoute('units', query)
  }

  if (root === 'create') return { ...emptyRoute('create', query), createStep: safeSlug(second, createStepSlugs, 'property') }
  if (root === 'admin') return parseAdminRoute(second, third, query)
  if (root === 'analytics') return { ...emptyRoute('analytics', query), analyticsWindow: safeSlug(second, analyticsWindowSlugs, 'live') }
  if (root === 'details') return { ...emptyRoute('details', query), unitId: readNumericRouteId(second) }
  if (isKnownView(root)) return emptyRoute(root, query)
  return emptyRoute('dashboard', query)
}

export function legacyHashPath(hash: string): string | null {
  const value = hash.replace(/^#/, '').replace(/^\//, '')
  if (!value) return null
  if (value.startsWith('details/')) return `/units/details/${encodeURIComponent(value.replace('details/', ''))}`
  if (value.startsWith('create/')) return legacyNestedPath(value.replace('create/', ''), createStepSlugs, '/create')
  if (value.startsWith('admin/master-data/')) return legacyNestedPath(value.replace('admin/master-data/', ''), masterDataDirectorySlugs, '/admin/master-data')
  if (value.startsWith('admin/')) return legacyNestedPath(value.replace('admin/', ''), adminSectionSlugs, '/admin')
  if (value.startsWith('analytics/')) return legacyNestedPath(value.replace('analytics/', ''), analyticsWindowSlugs, '/analytics')
  if (isKnownView(value)) return `/${value}`
  return null
}

export function normalizeIncomingAppUrl(url: string): string {
  const legacyPath = legacyHashPath(url)
  if (legacyPath) return legacyPath

  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'leadra:') {
      const path = `/${[parsed.hostname, parsed.pathname].filter(Boolean).join('/')}`.replace(/\/+/g, '/')
      return `${path}${parsed.search}`
    }
    return `${parsed.pathname || '/dashboard'}${parsed.search}`
  } catch {
    const [pathAndSearch, hash = ''] = url.split('#')
    const hashPath = legacyHashPath(hash)
    if (hashPath) return hashPath
    return pathAndSearch.startsWith('/') ? pathAndSearch : `/${pathAndSearch}`
  }
}

function parseAdminRoute(section: string | undefined, directory: string | undefined, search: string): AppRoute {
  if (section === 'master-data') {
    return {
      ...emptyRoute('admin', search),
      adminSection: 'master-data',
      masterDataDirectory: safeSlug(directory, masterDataDirectorySlugs, 'developers'),
    }
  }
  return { ...emptyRoute('admin', search), adminSection: safeSlug(section, adminSectionSlugs, 'users') }
}

function emptyRoute(view: View, search = ''): AppRoute {
  return {
    view,
    destinationId: null,
    projectId: null,
    unitId: null,
    createStep: 'property',
    adminSection: 'users',
    masterDataDirectory: 'developers',
    analyticsWindow: 'live',
    analyticsFiltersOpen: readAnalyticsFiltersOpen(search),
    analyticsFilters: readAnalyticsFilters(search),
  }
}

function readAnalyticsFiltersOpen(search: string): boolean {
  return new URLSearchParams(search).get('filters') === 'open'
}

function readAnalyticsFilters(search: string): AnalyticsFilters {
  const params = new URLSearchParams(search)
  const filters: AnalyticsFilters = {
    team: [],
    user: [],
    project: [],
    developer: [],
    destination: [],
    status: [],
    payment: [],
    start: params.get('start'),
    end: params.get('end'),
  } satisfies AnalyticsFilters

  for (const key of analyticsFilterKeys) {
    filters[key] = params.getAll(key)
  }

  return filters
}

function safeSlug<const T extends readonly string[]>(value: string | undefined, allowed: T, fallback: T[number]): T[number] {
  return allowed.includes(value ?? '') ? (value as T[number]) : fallback
}

function legacyNestedPath<const T extends readonly string[]>(value: string, allowed: T, prefix: string): string | null {
  return allowed.includes(value) ? `${prefix}/${value}` : null
}

function readNumericRouteId(value: string | undefined): number | null {
  const id = Number(value)
  return Number.isFinite(id) ? id : null
}

function decodeRoutePart(part: string): string {
  try {
    return decodeURIComponent(part)
  } catch {
    return part
  }
}

function isKnownView(value: string): value is (typeof views)[number] {
  return views.includes(value as (typeof views)[number])
}
