import type {
  LeadraMediaFile,
  LeadraUnit,
  LeadraUser,
  MediaValidation,
  PaymentInput,
  PaymentSummary,
  ProjectSummary,
  UnitFilters,
} from './types'

export const MAX_MEDIA_FILES = 10
export const MAX_MEDIA_TOTAL_BYTES = 40 * 1024 * 1024
export const DEFAULT_COMMISSION_PERCENTAGE = 1.5

const paymentsPerYear = {
  quarterly: 4,
  semi_annual: 2,
  annual: 1,
  custom: null,
} as const

export function normalizeOwnerPhone(input: string, selectedCountryCode: string): string {
  const cleanCountryCode = selectedCountryCode.replace(/[^\d+]/g, '').replace(/^00/, '+')
  let digits = input.trim().replace(/[\s\-()]/g, '')

  if (digits.startsWith('00')) {
    digits = `+${digits.slice(2)}`
  }

  if (digits.startsWith('+')) {
    return `+${digits.slice(1).replace(/\D/g, '')}`
  }

  const countryDigits = cleanCountryCode.replace(/\D/g, '')
  const localDigits = digits.replace(/\D/g, '')

  if (localDigits.startsWith(countryDigits)) {
    return `+${localDigits}`
  }

  return `+${countryDigits}${localDigits.replace(/^0+/, '')}`
}

export function unitHasSameProjectPhoneDuplicate(candidate: LeadraUnit, existingUnits: LeadraUnit[]): boolean {
  if (!candidate.normalizedOwnerPhone) {
    return false
  }

  return existingUnits.some(
    (unit) =>
      unit.projectId === candidate.projectId &&
      unit.normalizedOwnerPhone === candidate.normalizedOwnerPhone &&
      unit.id !== candidate.id,
  )
}

export function canViewUnit(user: LeadraUser, unit: LeadraUnit): boolean {
  if (user.role === 'admin' || user.role === 'sub_admin') {
    return true
  }

  if (user.role === 'manager') {
    return unit.teamId === user.teamId
  }

  return !unit.archived
}

export function filterUnitsForUser(user: LeadraUser, units: LeadraUnit[]): LeadraUnit[] {
  return units.filter((unit) => canViewUnit(user, unit))
}

export function canViewOwnerData(user: LeadraUser, unit: LeadraUnit): boolean {
  if (user.role === 'admin' || user.role === 'sub_admin') {
    return true
  }

  if (user.role === 'manager') {
    return unit.teamId === user.teamId
  }

  return unit.createdBy === user.id
}

export function canSearchOwnerPhone(user: LeadraUser, unit: LeadraUnit): boolean {
  return canViewOwnerData(user, unit)
}

export function canEditOwnerFields(user: LeadraUser, unit: LeadraUnit): boolean {
  if (user.role === 'admin' || user.role === 'sub_admin' || user.role === 'manager') {
    return true
  }

  return unit.createdBy === user.id && Number.isNaN(Date.parse(unit.createdAt))
}

export function canArchiveUnit(user: LeadraUser, unit: LeadraUnit): boolean {
  if (user.role === 'admin' || user.role === 'sub_admin') {
    return true
  }

  return user.role === 'manager' && unit.teamId === user.teamId
}

export function canAddAdminManagerNote(user: LeadraUser): boolean {
  return user.role === 'admin' || user.role === 'sub_admin' || user.role === 'manager'
}

export function calculatePaymentSummary(input: PaymentInput): PaymentSummary {
  const commissionPercentage = input.commissionPercentage ?? DEFAULT_COMMISSION_PERCENTAGE
  const commissionAmount = roundMoney(input.totalAmount * (commissionPercentage / 100))

  if (input.paymentMethod === 'cash') {
    return {
      remainingPayment: null,
      commissionAmount,
      installmentAmount: null,
    }
  }

  const downPayment = input.downPayment ?? 0
  const remainingPayment = Math.max(0, roundMoney(input.totalAmount - downPayment))
  const installmentType = input.installmentType ?? 'custom'
  const years = input.installmentYears ?? 0
  const frequency = paymentsPerYear[installmentType]
  const installmentAmount =
    frequency && years > 0 ? roundMoney(remainingPayment / (years * frequency)) : null

  return {
    remainingPayment,
    commissionAmount,
    installmentAmount,
  }
}

export function generateUnitCode(destinationName: string, unitId: number, bedrooms: number, bathrooms: number): string {
  const letters = destinationName
    .replace(/[^a-zA-Z]/g, '')
    .trim()
    .slice(0, 2)
    .toUpperCase()
    .padEnd(2, 'X')

  return `${letters}${unitId}BR${bedrooms}Ba${bathrooms}`
}

export function validateMediaUpload(files: LeadraMediaFile[]): MediaValidation {
  if (files.length > MAX_MEDIA_FILES) {
    return {
      ok: false,
      message: 'Upload failed. A unit can include up to 10 media files.',
    }
  }

  const totalSize = files.reduce((sum, file) => sum + file.sizeBytes, 0)
  if (totalSize > MAX_MEDIA_TOTAL_BYTES) {
    return {
      ok: false,
      message:
        'Upload failed. Total media size exceeds 40 MB per unit. Please remove or compress some files.',
    }
  }

  return { ok: true }
}

export function getThumbnailMedia(files: LeadraMediaFile[]): LeadraMediaFile | null {
  return files.find((file) => file.type === 'image') ?? null
}

export function sanitizeUnitForPdf(user: LeadraUser, unit: LeadraUnit): LeadraUnit {
  if (canViewOwnerData(user, unit)) {
    return unit
  }

  return {
    ...unit,
    originalOwnerName: null,
    countryCode: null,
    originalOwnerPhone: null,
    normalizedOwnerPhone: null,
    createdByName: 'Leadra Sales Team',
    media: unit.media.filter((file) => file.type === 'image'),
  }
}

export function searchUnits(user: LeadraUser, units: LeadraUnit[], filters: UnitFilters): LeadraUnit[] {
  return filterUnitsForUser(user, units).filter((unit) => {
    if (filters.projectId && unit.projectId !== filters.projectId) return false
    if (filters.status && filters.status !== 'all' && unit.status !== filters.status) return false
    if (filters.developerId && unit.developerId !== filters.developerId) return false
    if (filters.destinationId && unit.destinationId !== filters.destinationId) return false
    if (filters.unitType && unit.unitType !== filters.unitType) return false
    if (filters.bedrooms && filters.bedrooms !== 'all' && unit.bedrooms !== filters.bedrooms) return false
    if (filters.bathrooms && filters.bathrooms !== 'all' && unit.bathrooms !== filters.bathrooms) return false
    if (filters.paymentMethod && filters.paymentMethod !== 'all' && unit.paymentMethod !== filters.paymentMethod) return false
    if (filters.priceFrom && unit.totalAmount < filters.priceFrom) return false
    if (filters.priceTo && unit.totalAmount > filters.priceTo) return false
    if (filters.installmentAmountFrom && (unit.installmentAmount ?? 0) < filters.installmentAmountFrom) return false
    if (filters.installmentAmountTo && (unit.installmentAmount ?? Number.MAX_SAFE_INTEGER) > filters.installmentAmountTo) {
      return false
    }
    if (filters.unitCode && !unit.unitCode.toLowerCase().includes(filters.unitCode.toLowerCase())) return false

    if (filters.ownerPhone) {
      const normalized = normalizeOwnerPhone(filters.ownerPhone, unit.countryCode ?? '+20')
      if (!canSearchOwnerPhone(user, unit) || unit.normalizedOwnerPhone !== normalized) {
        return false
      }
    }

    return true
  })
}

export function summarizeProjects(units: LeadraUnit[]): ProjectSummary[] {
  const summaries = new Map<string, ProjectSummary>()

  for (const unit of units.filter((item) => !item.archived)) {
    const current =
      summaries.get(unit.projectId) ??
      {
        projectId: unit.projectId,
        projectName: unit.projectName,
        totalUnits: 0,
        availableUnits: 0,
        holdUnits: 0,
        soldUnits: 0,
      }

    current.totalUnits += 1
    if (unit.status === 'available') current.availableUnits += 1
    if (unit.status === 'hold') current.holdUnits += 1
    if (unit.status === 'sold') current.soldUnits += 1
    summaries.set(unit.projectId, current)
  }

  return Array.from(summaries.values()).sort((a, b) => a.projectName.localeCompare(b.projectName))
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return 'Not set'
  return new Intl.NumberFormat('en-EG', {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatDeliveryExpectancy(unit: LeadraUnit): string {
  const { deliveryExpectancy } = unit
  if (deliveryExpectancy.mode === 'year') {
    return String(deliveryExpectancy.year)
  }

  const date = new Date(deliveryExpectancy.year, (deliveryExpectancy.month ?? 1) - 1, 1)
  return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(date)
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}
