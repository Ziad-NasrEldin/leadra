const legacyCreateStepSlugs = ['property', 'specs', 'payment', 'owner', 'review'] as const
const legacyAdminSectionSlugs = ['users', 'master-data', 'settings', 'metrics', 'audit'] as const
const legacyMasterDataDirectorySlugs = [
  'developers',
  'destinations',
  'projects',
  'views',
  'finishes',
  'branches',
  'teams',
] as const
const legacyAnalyticsWindowSlugs = ['live', '30d', '90d', 'custom'] as const

export function legacyHashPath(hash: string): string | null {
  const value = hash.replace(/^#/, '').replace(/^\//, '')
  if (!value) return null
  if (value.startsWith('details/')) return `/units/details/${encodeURIComponent(value.replace('details/', ''))}`
  if (value.startsWith('create/')) return legacyNestedPath(value.replace('create/', ''), legacyCreateStepSlugs, '/create')
  if (value.startsWith('admin/master-data/')) return legacyNestedPath(value.replace('admin/master-data/', ''), legacyMasterDataDirectorySlugs, '/admin/master-data')
  if (value.startsWith('admin/')) return legacyNestedPath(value.replace('admin/', ''), legacyAdminSectionSlugs, '/admin')
  if (value.startsWith('analytics/')) return legacyNestedPath(value.replace('analytics/', ''), legacyAnalyticsWindowSlugs, '/analytics')
  if (isLegacyKnownView(value)) return `/${value}`
  return null
}

function legacyNestedPath<const T extends readonly string[]>(value: string, allowed: T, prefix: string): string | null {
  return allowed.includes(value) ? `${prefix}/${value}` : null
}

function isLegacyKnownView(value: string): boolean {
  return ['dashboard', 'units', 'special', 'create', 'notifications', 'profile', 'analytics', 'admin', 'palette'].includes(value)
}
