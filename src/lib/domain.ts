import type {
  LeadraMediaFile,
  LeadraUnit,
  LeadraUser,
  DestinationSummary,
  InstallmentType,
  MediaValidation,
  PaymentInput,
  PaymentSummary,
  ProjectSummary,
  UnitFilters,
} from './types'
import { compareText, getIntlLocale, type LocaleCode } from './i18n'

export const MAX_MEDIA_FILES = 10
export const MAX_MEDIA_TOTAL_BYTES = 40 * 1024 * 1024
export const DEFAULT_COMMISSION_PERCENTAGE = 1.5
export const PRD_UNIT_TYPES = [
  'One Story Villa',
  'Stand Alone',
  'Twin House',
  'Town House',
  'Apartment',
  'Chalet',
  'Duplex',
  'Senior Chalet',
  'Junior Chalet',
  'Loft',
  'Cabin',
  'Penthouse',
] as const

export type PrdUnitType = (typeof PRD_UNIT_TYPES)[number]
export type PrdUnitAreaMode = 'land' | 'floor' | 'bua_only' | 'terrace'

export interface PrdUnitTypeSpec {
  unitType: PrdUnitType
  areaMode: PrdUnitAreaMode
}

export const PRD_UNIT_TYPE_SPECS: PrdUnitTypeSpec[] = PRD_UNIT_TYPES.map((unitType) => ({
  unitType,
  areaMode:
    unitType === 'Cabin'
      ? 'bua_only'
      : unitType === 'Penthouse'
        ? 'terrace'
        : ['One Story Villa', 'Stand Alone', 'Twin House', 'Town House'].includes(unitType)
          ? 'land'
          : 'floor',
}))
export const PRD_FLOOR_OPTIONS = ['Ground', ...Array.from({ length: 40 }, (_, index) => formatOrdinalFloor(index + 1))] as const

const paymentsPerYear = {
  quarterly: 4,
  semi_annual: 2,
  annual: 1,
  custom: null,
} as const

export function getPrdUnitTypeSpec(unitType: string): PrdUnitTypeSpec {
  return PRD_UNIT_TYPE_SPECS.find((spec) => spec.unitType === unitType) ?? PRD_UNIT_TYPE_SPECS.find((spec) => spec.unitType === 'Apartment')!
}

export function getApplicableUnitAreaFields(unitType: string, floor = '') {
  const spec = getPrdUnitTypeSpec(unitType)
  return {
    showFloor: spec.areaMode === 'floor',
    showLandArea: spec.areaMode === 'land',
    showGardenArea: spec.areaMode === 'floor' && floor === 'Ground',
    showTerraceArea: spec.areaMode === 'terrace',
  }
}

export function normalizeUnitOutdoorFields(input: {
  unitType: string
  floor?: string | null
  landArea?: number | null
  gardenArea?: number | null
  terraceArea?: number | null
  roofGardenArea?: number | null
}) {
  const fields = getApplicableUnitAreaFields(input.unitType, input.floor ?? '')
  const gardenArea = fields.showGardenArea ? input.gardenArea ?? input.roofGardenArea ?? null : null
  const terraceArea = fields.showTerraceArea ? input.terraceArea ?? input.roofGardenArea ?? null : null

  return {
    floor: fields.showFloor ? input.floor || 'Ground' : '',
    landArea: fields.showLandArea ? input.landArea ?? null : null,
    gardenArea,
    terraceArea,
    roofGardenArea: gardenArea ?? terraceArea,
  }
}

type OwnerPhoneCountrySpec = {
  code: string
  labels: Record<LocaleCode, string>
  placeholder: string
  localPattern: RegExp
  trunkPrefix?: string
}

export function getInstallmentPaymentsPerYear(type: InstallmentType | null | undefined): number | null {
  return type ? paymentsPerYear[type] : null
}

const ownerPhoneCountrySpecs: OwnerPhoneCountrySpec[] = [
  { code: '+20', labels: { en: 'Egypt +20', ar: 'مصر +20' }, placeholder: '01012345678', localPattern: /^01[0125]\d{8}$/, trunkPrefix: '0' },
  { code: '+971', labels: { en: 'UAE +971', ar: 'الإمارات +971' }, placeholder: '0501234567', localPattern: /^05\d{8}$/, trunkPrefix: '0' },
  { code: '+966', labels: { en: 'Saudi Arabia +966', ar: 'السعودية +966' }, placeholder: '0501234567', localPattern: /^05\d{8}$/, trunkPrefix: '0' },
  { code: '+974', labels: { en: 'Qatar +974', ar: 'قطر +974' }, placeholder: '33123456', localPattern: /^[3567]\d{7}$/ },
  { code: '+965', labels: { en: 'Kuwait +965', ar: 'الكويت +965' }, placeholder: '55123456', localPattern: /^[569]\d{7}$/ },
  { code: '+973', labels: { en: 'Bahrain +973', ar: 'البحرين +973' }, placeholder: '36123456', localPattern: /^[36]\d{7}$/ },
  { code: '+968', labels: { en: 'Oman +968', ar: 'عُمان +968' }, placeholder: '92123456', localPattern: /^[79]\d{7}$/ },
  { code: '+962', labels: { en: 'Jordan +962', ar: 'الأردن +962' }, placeholder: '0791234567', localPattern: /^07\d{8}$/, trunkPrefix: '0' },
  { code: '+90', labels: { en: 'Turkey +90', ar: 'تركيا +90' }, placeholder: '05321234567', localPattern: /^05\d{9}$/, trunkPrefix: '0' },
  { code: '+44', labels: { en: 'United Kingdom +44', ar: 'المملكة المتحدة +44' }, placeholder: '07123456789', localPattern: /^07\d{9}$/, trunkPrefix: '0' },
  { code: '+1', labels: { en: 'United States +1', ar: 'الولايات المتحدة +1' }, placeholder: '4155552671', localPattern: /^[2-9]\d{9}$/ },
  { code: '+33', labels: { en: 'France +33', ar: 'فرنسا +33' }, placeholder: '0612345678', localPattern: /^0[67]\d{8}$/, trunkPrefix: '0' },
  { code: '+49', labels: { en: 'Germany +49', ar: 'ألمانيا +49' }, placeholder: '015121234567', localPattern: /^01[5-7]\d{8,10}$/, trunkPrefix: '0' },
]

function getOwnerPhoneCountrySpec(code: string): OwnerPhoneCountrySpec {
  return ownerPhoneCountrySpecs.find((item) => item.code === code) ?? ownerPhoneCountrySpecs[0]
}

function cleanOwnerPhoneInput(input: string): string {
  return input.trim().replace(/[\s\-()]/g, '')
}

function stripCountryCodeFromPhone(input: string, countryCode: string) {
  const cleanCountryCode = countryCode.replace(/[^\d+]/g, '').replace(/^00/, '+')
  const countryDigits = cleanCountryCode.replace(/\D/g, '')
  let digits = cleanOwnerPhoneInput(input)

  if (digits.startsWith('00')) {
    digits = `+${digits.slice(2)}`
  }

  if (digits.startsWith('+')) {
    const normalizedDigits = digits.slice(1).replace(/\D/g, '')
    if (!normalizedDigits.startsWith(countryDigits)) {
      return { localDigits: normalizedDigits, mismatchedCountry: true }
    }
    return { localDigits: normalizedDigits.slice(countryDigits.length), mismatchedCountry: false }
  }

  const normalizedDigits = digits.replace(/\D/g, '')
  if (normalizedDigits.startsWith(countryDigits)) {
    return { localDigits: normalizedDigits.slice(countryDigits.length), mismatchedCountry: false }
  }

  return { localDigits: normalizedDigits, mismatchedCountry: false }
}

function formatLocalOwnerPhone(localDigits: string, spec: OwnerPhoneCountrySpec): string {
  if (!localDigits) return ''
  if (spec.trunkPrefix && !localDigits.startsWith(spec.trunkPrefix)) {
    return `${spec.trunkPrefix}${localDigits}`
  }
  return localDigits
}

export function getOwnerPhoneCountryOptions(locale: LocaleCode) {
  return ownerPhoneCountrySpecs.map((spec) => ({
    value: spec.code,
    label: spec.labels[locale],
    placeholder: spec.placeholder,
  }))
}

export function getOwnerPhoneCountryMeta(countryCode: string, locale: LocaleCode) {
  const spec = getOwnerPhoneCountrySpec(countryCode)
  return {
    code: spec.code,
    label: spec.labels[locale],
    placeholder: spec.placeholder,
  }
}

export function validateOwnerPhoneForCountry(input: string, countryCode: string, locale: LocaleCode = 'en') {
  const spec = getOwnerPhoneCountrySpec(countryCode)
  const { localDigits, mismatchedCountry } = stripCountryCodeFromPhone(input, spec.code)
  const localPhone = formatLocalOwnerPhone(localDigits, spec)

  if (mismatchedCountry || !spec.localPattern.test(localPhone)) {
    return {
      ok: false as const,
      countryLabel: spec.labels[locale],
      example: spec.placeholder,
    }
  }

  return {
    ok: true as const,
    localPhone,
    countryLabel: spec.labels[locale],
    example: spec.placeholder,
  }
}

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
  void user
  void unit
  return true
}

export function filterUnitsForUser(user: LeadraUser, units: LeadraUnit[]): LeadraUnit[] {
  return units.filter((unit) => canViewUnit(user, unit))
}

export function canViewOwnerData(user: LeadraUser, unit: LeadraUnit): boolean {
  if (user.role === 'admin' || user.role === 'sub_admin') {
    return true
  }

  return user.role === 'sales' && unit.createdBy === user.id
}

export function canSearchOwnerPhone(user: LeadraUser, unit: LeadraUnit): boolean {
  void unit
  return user.role === 'admin' || user.role === 'sub_admin'
}

export function canViewSalesSensitiveData(user: LeadraUser, unit: LeadraUnit): boolean {
  return canViewOwnerData(user, unit)
}

export function canEditOwnerFields(user: LeadraUser, unit: LeadraUnit): boolean {
  if (user.role === 'admin' || user.role === 'sub_admin' || user.role === 'manager') {
    return true
  }

  return unit.createdBy === user.id && Number.isNaN(Date.parse(unit.createdAt))
}

export function canArchiveUnit(user: LeadraUser, unit: LeadraUnit): boolean {
  void unit
  return user.role === 'admin' || user.role === 'sub_admin'
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

export interface InstallmentScheduleRow {
  paymentNumber: number
  yearNumber: number
  periodLabel: string
  amount: number
}

export function buildInstallmentSchedule(unit: LeadraUnit, locale: LocaleCode = 'en'): InstallmentScheduleRow[] {
  const frequency = getInstallmentPaymentsPerYear(unit.installmentType)
  if (unit.paymentMethod !== 'installment' || !frequency || !unit.installmentYears || !unit.installmentAmount) return []

  const formatter = new Intl.NumberFormat(getIntlLocale(locale), { maximumFractionDigits: 0 })
  const totalPayments = unit.installmentYears * frequency
  const amount = unit.installmentAmount

  return Array.from({ length: totalPayments }, (_, index) => {
    const paymentNumber = index + 1
    const yearNumber = Math.floor(index / frequency) + 1
    const periodInYear = (index % frequency) + 1
    return {
      paymentNumber,
      yearNumber,
      periodLabel:
        unit.installmentType === 'quarterly'
          ? `Q${periodInYear}`
          : unit.installmentType === 'semi_annual'
            ? `${locale === 'ar' ? 'نصف' : 'Half'} ${formatter.format(periodInYear)}`
            : `${locale === 'ar' ? 'سنة' : 'Year'} ${formatter.format(yearNumber)}`,
      amount,
    }
  })
}

export function formatOrdinalFloor(floor: number): string {
  const suffix = floor % 100 >= 11 && floor % 100 <= 13
    ? 'th'
    : floor % 10 === 1
      ? 'st'
      : floor % 10 === 2
        ? 'nd'
        : floor % 10 === 3
          ? 'rd'
          : 'th'
  return `${floor}${suffix}`
}

export function deriveProjectAbbreviation(projectName: string): string {
  const words = projectName
    .trim()
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)

  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase()
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase().padEnd(2, 'X')
  return 'PR'
}

export function generateUnitCode(projectName: string, bedrooms: number): string {
  return `${deriveProjectAbbreviation(projectName)}${bedrooms}BR`
}

export function validateMediaUpload(files: LeadraMediaFile[]): MediaValidation {
  if (files.length > MAX_MEDIA_FILES) {
    return {
      ok: false,
      message: 'Upload failed. A unit can include up to 10 media files.',
      messageKey: 'error.uploadLimitFiles',
    }
  }

  const totalSize = files.reduce((sum, file) => sum + file.sizeBytes, 0)
  if (totalSize > MAX_MEDIA_TOTAL_BYTES) {
    return {
      ok: false,
      message:
        'Upload failed. Total media size exceeds 40 MB per unit. Please remove or compress some files.',
      messageKey: 'error.uploadLimitSize',
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
    if (!inRange(unit.bua, filters.buaFrom, filters.buaTo)) return false
    if (!inRange(unit.totalAmount, filters.priceFrom, filters.priceTo)) return false
    if (!inRange(unit.paymentMethod === 'cash' ? unit.totalAmount : null, filters.cashPriceFrom, filters.cashPriceTo)) return false
    if (!inRange(unit.downPayment, filters.downPaymentFrom, filters.downPaymentTo)) return false
    if (!inRange(unit.remainingPayment, filters.remainingPaymentFrom, filters.remainingPaymentTo)) return false
    if (filters.installmentType && filters.installmentType !== 'all' && unit.installmentType !== filters.installmentType) return false
    if (!inRange(unit.installmentAmount, filters.installmentAmountFrom, filters.installmentAmountTo)) return false
    if (filters.deliveryYear && filters.deliveryYear !== 'all' && unit.deliveryExpectancy.year !== filters.deliveryYear) return false
    if (filters.deliveryMonth && filters.deliveryMonth !== 'all' && unit.deliveryExpectancy.month !== filters.deliveryMonth) return false
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

export function summarizeDestinations(units: LeadraUnit[], locale: LocaleCode = 'en'): DestinationSummary[] {
  const summaries = new Map<string, DestinationSummary>()

  for (const unit of units.filter((item) => !item.archived)) {
    const current =
      summaries.get(unit.destinationId) ??
      {
        destinationId: unit.destinationId,
        destinationName: unit.destinationName,
        totalUnits: 0,
        availableUnits: 0,
        holdUnits: 0,
        soldUnits: 0,
      }

    current.totalUnits += 1
    if (unit.status === 'available') current.availableUnits += 1
    if (unit.status === 'hold') current.holdUnits += 1
    if (unit.status === 'sold') current.soldUnits += 1
    summaries.set(unit.destinationId, current)
  }

  return Array.from(summaries.values()).sort((a, b) => compareText(locale, a.destinationName, b.destinationName))
}

export function summarizeProjects(units: LeadraUnit[], locale: LocaleCode = 'en', destinationId?: string | null): ProjectSummary[] {
  const summaries = new Map<string, ProjectSummary>()

  for (const unit of units.filter((item) => !item.archived && (!destinationId || item.destinationId === destinationId))) {
    const current =
      summaries.get(unit.projectId) ??
      {
        projectId: unit.projectId,
        projectName: unit.projectName,
        destinationId: unit.destinationId,
        destinationName: unit.destinationName,
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

  return Array.from(summaries.values()).sort((a, b) => compareText(locale, a.projectName, b.projectName))
}

function hasBound(from?: number, to?: number) {
  return from !== undefined || to !== undefined
}

function inRange(value: number | null | undefined, from?: number, to?: number) {
  if (!hasBound(from, to)) return true
  if (value == null) return false
  if (from !== undefined && value < from) return false
  if (to !== undefined && value > to) return false
  return true
}

export function formatCurrency(value: number | null | undefined, locale: LocaleCode = 'en'): string {
  if (value == null) return locale === 'ar' ? 'غير محدد' : 'Not set'
  return new Intl.NumberFormat(getIntlLocale(locale), {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatDeliveryExpectancy(unit: LeadraUnit, locale: LocaleCode = 'en'): string {
  const { deliveryExpectancy } = unit
  if (deliveryExpectancy.mode === 'year') {
    return new Intl.NumberFormat(getIntlLocale(locale), { maximumFractionDigits: 0 }).format(deliveryExpectancy.year)
  }

  const date = new Date(deliveryExpectancy.year, (deliveryExpectancy.month ?? 1) - 1, 1)
  return new Intl.DateTimeFormat(getIntlLocale(locale), { month: 'long', year: 'numeric' }).format(date)
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}
