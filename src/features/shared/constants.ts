import type { LeadraUser, LookupKind, PaymentMethod, UnitStatus } from '../../lib/types'

export const createUnitSteps = ['Property', 'Specs', 'Payment', 'Owner', 'Review'] as const
export const adminSections = ['Users', 'Master Data', 'Settings', 'Metrics', 'Audit'] as const
export type EditableLookupKind = Exclude<LookupKind, 'unit_type'>

export const lookupKindOptions: EditableLookupKind[] = ['developer', 'destination', 'project', 'view', 'finish']

export type CreateUnitStep = (typeof createUnitSteps)[number]
export type AdminSection = (typeof adminSections)[number]
export type MasterDataDirectory = EditableLookupKind | 'branches' | 'teams'
export type LookupThumbnailChange = { file?: File | null; remove?: boolean }

export const unitStatusValues: UnitStatus[] = ['available', 'hold', 'sold', 'sold_by_us', 'sold_by_others']
export const paymentMethodValues: PaymentMethod[] = ['cash', 'installment']

export const unitListPageSize = 60
export const userManagementPageSize = 48
export const auditLogPageSize = 80
export const maxLogoUploadBytes = 2 * 1024 * 1024

export const roleOrder: Record<LeadraUser['role'], number> = {
  admin: 0,
  sub_admin: 1,
  manager: 2,
  sales: 3,
}

export function supportsLookupThumbnail(directory: LookupKind | 'branches' | 'teams'): directory is 'destination' | 'project' {
  return directory === 'destination' || directory === 'project'
}
