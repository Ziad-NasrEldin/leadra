import { normalizeReactiveUnitFilters } from './domain'
import type { LeadraUnit, UnitFilters } from './types'

export type SupabaseErrorLike = { code?: string; message?: string; details?: string; hint?: string } | null | undefined
export type CreateUnitPhase = 'unit' | 'media' | 'reload'

export function createUnitRemoteError(phase: CreateUnitPhase, error: unknown, rollbackError: unknown = null) {
  const message = phase === 'media'
    ? 'Unit media attachments could not be saved.'
    : phase === 'reload'
      ? 'Unit was created but could not be loaded.'
      : 'Unit could not be created.'
  const wrapped = new Error(message)
  Object.assign(wrapped, {
    code: typeof error === 'object' && error && 'code' in error ? error.code : undefined,
    details: typeof error === 'object' && error && 'details' in error ? error.details : undefined,
    hint: typeof error === 'object' && error && 'hint' in error ? error.hint : undefined,
    phase,
    cause: error,
    rollbackError,
  })
  return wrapped
}

export function compactUnitFilters(filters: UnitFilters): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(normalizeReactiveUnitFilters(filters)).filter(([, value]) => value !== undefined && value !== '' && value !== 'all'),
  )
}

export function isMissingAtomicCreateRpc(error: SupabaseErrorLike): boolean {
  if (!error) return false
  const text = `${error.code ?? ''} ${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase()
  return text.includes('pgrst202') || text.includes('create_unit_with_media') || text.includes('include_in_pdf')
}

export function matchesUnitFilters(unit: LeadraUnit, filters: UnitFilters): boolean {
  filters = normalizeReactiveUnitFilters(filters)
  if (filters.projectId && unit.projectId !== filters.projectId) return false
  if (filters.destinationId && unit.destinationId !== filters.destinationId) return false
  if (filters.status && filters.status !== 'all' && unit.status !== filters.status) return false
  if (filters.developerId && unit.developerId !== filters.developerId) return false
  if (filters.unitType && unit.unitType !== filters.unitType) return false
  if (filters.bedrooms && filters.bedrooms !== 'all' && unit.bedrooms !== filters.bedrooms) return false
  if (filters.bathrooms && filters.bathrooms !== 'all' && unit.bathrooms !== filters.bathrooms) return false
  if (filters.paymentMethod && filters.paymentMethod !== 'all' && unit.paymentMethod !== filters.paymentMethod) return false
  if (filters.floor && unit.floor !== filters.floor) return false
  if (!matchesRange(unit.deliveryExpectancy.year, filters.deliveryYearFrom, filters.deliveryYearTo)) return false
  if (filters.deliveryMonth && filters.deliveryMonth !== 'all' && unit.deliveryExpectancy.month !== filters.deliveryMonth) return false
  if (filters.unitCode && !unit.unitCode.toLowerCase().includes(filters.unitCode.toLowerCase())) return false
  if (!matchesRange(unit.bua, filters.buaFrom, filters.buaTo)) return false
  if (!matchesRange(unit.landArea, filters.landAreaFrom, filters.landAreaTo)) return false
  if (!matchesRange(unit.gardenArea, filters.gardenAreaFrom, filters.gardenAreaTo)) return false
  if (!matchesRange(unit.terraceArea, filters.terraceAreaFrom, filters.terraceAreaTo)) return false
  if (!matchesRange(unit.totalAmount, filters.priceFrom, filters.priceTo)) return false
  if (!matchesRange(unit.paymentMethod === 'cash' ? unit.totalAmount : null, filters.cashPriceFrom, filters.cashPriceTo)) return false
  if (!matchesRange(unit.downPayment, filters.downPaymentFrom, filters.downPaymentTo)) return false
  if (!matchesRange(unit.remainingPayment, filters.remainingPaymentFrom, filters.remainingPaymentTo)) return false
  if (filters.installmentType && filters.installmentType !== 'all' && unit.installmentType !== filters.installmentType) return false
  if (!matchesRange(unit.installmentAmount, filters.installmentAmountFrom, filters.installmentAmountTo)) return false
  return true
}

function matchesRange(value: number | null, from?: number, to?: number): boolean {
  if (from !== undefined && (value === null || value < from)) return false
  if (to !== undefined && (value === null || value > to)) return false
  return true
}
