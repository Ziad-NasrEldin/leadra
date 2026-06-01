import type {
  LeadraMediaFile,
  LeadraUnit,
  LeadraUser,
  DestinationSummary,
  InstallmentType,
  MediaValidation,
  PaymentHistoryRow,
  PaymentInput,
  PaymentScheduleRow,
  PaymentSummary,
  ProjectSummary,
  UnitFilters,
  UnitStatus,
} from './types'
import { compareText, getIntlLocale, type LocaleCode } from './i18n'
import { getApplicableUnitAreaFields } from './domainUnitTypes'
export {
  getApplicableUnitAreaFields,
  getPrdUnitTypeSpec,
  isPrdUnitType,
  PRD_FLOOR_OPTIONS,
  PRD_UNIT_TYPES,
  PRD_UNIT_TYPE_SPECS,
  type PrdUnitAreaMode,
  type PrdUnitType,
  type PrdUnitTypeSpec,
} from './domainUnitTypes'

export const MAX_MEDIA_FILES = 10
export const MAX_MEDIA_TOTAL_BYTES = 40 * 1024 * 1024
export const DEFAULT_COMMISSION_PERCENTAGE = 1.5
const paymentsPerYear = {
  monthly: 12,
  quarterly: 4,
  semi_annual: 2,
  annual: 1,
  custom: null,
} as const

const installmentStepMonths = {
  monthly: 1,
  quarterly: 3,
  semi_annual: 6,
  annual: 12,
  custom: null,
} as const

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

export function normalizeReactiveUnitFilters(filters: UnitFilters): UnitFilters {
  const next = { ...filters }
  const paymentMethod = next.paymentMethod ?? 'all'

  if (paymentMethod !== 'cash') {
    delete next.cashPriceFrom
    delete next.cashPriceTo
  }
  if (paymentMethod !== 'installment') {
    delete next.downPaymentFrom
    delete next.downPaymentTo
    delete next.remainingPaymentFrom
    delete next.remainingPaymentTo
    delete next.installmentType
    delete next.installmentAmountFrom
    delete next.installmentAmountTo
  }

  if (!next.unitType) {
    delete next.floor
    delete next.landAreaFrom
    delete next.landAreaTo
    delete next.gardenAreaFrom
    delete next.gardenAreaTo
    delete next.terraceAreaFrom
    delete next.terraceAreaTo
    return next
  }

  const areaFields = getApplicableUnitAreaFields(next.unitType, next.floor ?? '')
  if (!areaFields.showFloor) delete next.floor
  if (!areaFields.showLandArea) {
    delete next.landAreaFrom
    delete next.landAreaTo
  }
  if (!areaFields.showGardenArea) {
    delete next.gardenAreaFrom
    delete next.gardenAreaTo
  }
  if (!areaFields.showTerraceArea) {
    delete next.terraceAreaFrom
    delete next.terraceAreaTo
  }

  return next
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

export function normalizeInstallmentMonth(value: string | null | undefined): string | null {
  const match = value?.trim().match(/^(\d{4})-(\d{2})(?:-\d{2})?$/)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  if (!Number.isInteger(year) || month < 1 || month > 12) return null

  return `${match[1]}-${match[2]}-01`
}

export function getInstallmentScheduledDueMonths(
  type: InstallmentType | null | undefined,
  startMonth: string | null | undefined,
  endMonth: string | null | undefined,
): string[] {
  const stepMonths = type ? installmentStepMonths[type] : null
  const start = monthIndex(normalizeInstallmentMonth(startMonth))
  const end = monthIndex(normalizeInstallmentMonth(endMonth))
  if (!stepMonths || start == null || end == null || start > end) return []

  const months: string[] = []
  for (let current = start; current <= end; current += stepMonths) {
    months.push(formatMonthIndex(current))
  }
  return months
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
  if (user.role === 'admin' || user.role === 'sub_admin') return true
  return !unit.archived
}

export function filterUnitsForUser(user: LeadraUser, units: LeadraUnit[]): LeadraUnit[] {
  return units.filter((unit) => canViewUnit(user, unit))
}

export function canViewOwnerData(user: LeadraUser, unit: LeadraUnit): boolean {
  if (user.role === 'admin' || user.role === 'sub_admin') {
    return true
  }

  return (user.role === 'sales' || user.role === 'manager') && unit.createdBy === user.id
}

export function canSearchOwnerPhone(user: LeadraUser, unit: LeadraUnit): boolean {
  void unit
  return user.role === 'admin' || user.role === 'sub_admin'
}

export function canViewSalesSensitiveData(user: LeadraUser, unit: LeadraUnit): boolean {
  return canViewOwnerData(user, unit)
}

function isCurrentActiveUnitUploader(user: LeadraUser, unit: LeadraUnit): boolean {
  return user.status === 'active' && !unit.archived && unit.createdBy === user.id
}

export function canEditOwnerFields(user: LeadraUser, unit: LeadraUnit): boolean {
  if (user.role === 'admin' || user.role === 'sub_admin') return true
  return isCurrentActiveUnitUploader(user, unit)
}

export function canEditNonOwnerUnitDetails(user: LeadraUser, unit: LeadraUnit): boolean {
  if (user.role === 'admin' || user.role === 'sub_admin') return true
  return isCurrentActiveUnitUploader(user, unit)
}

export function canEditUnitPricing(user: LeadraUser, unit: LeadraUnit): boolean {
  if (user.role === 'admin' || user.role === 'sub_admin') return true
  return isCurrentActiveUnitUploader(user, unit)
}

export function canEditUnitCommission(user: LeadraUser, unit: LeadraUnit): boolean {
  if (user.role === 'admin' || user.role === 'sub_admin') return true
  return isCurrentActiveUnitUploader(user, unit)
}

export function canEditAnyUnitDetails(user: LeadraUser, unit: LeadraUnit): boolean {
  return (
    canEditNonOwnerUnitDetails(user, unit) ||
    canEditOwnerFields(user, unit) ||
    canEditUnitPricing(user, unit) ||
    canEditUnitCommission(user, unit)
  )
}

export function canArchiveUnit(user: LeadraUser, unit: LeadraUnit): boolean {
  void unit
  return user.role === 'admin' || user.role === 'sub_admin'
}

export function canManageUnitSpecialStatus(user: LeadraUser, unit: LeadraUnit): boolean {
  if (unit.archived) return false
  return user.role === 'admin' || user.role === 'sub_admin'
}

export function isOtherSalesRepresentativeUnit(user: LeadraUser, unit: LeadraUnit): boolean {
  return user.role === 'sales' && unit.createdBy !== user.id
}

export function canUseUnitOperationalActions(user: LeadraUser, unit: LeadraUnit): boolean {
  if (unit.archived) return false
  if (user.role === 'admin' || user.role === 'sub_admin') return true
  return isCurrentActiveUnitUploader(user, unit)
}

export function isSoldStatus(status: UnitStatus | string | null | undefined): boolean {
  return status === 'sold' || status === 'sold_by_us' || status === 'sold_by_others'
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
  const frequency = paymentsPerYear[installmentType]
  const scheduledDueMonths = getInstallmentScheduledDueMonths(
    installmentType,
    input.installmentStartMonth,
    input.installmentEndMonth,
  )
  const legacyPaymentCount = frequency && input.installmentYears ? input.installmentYears * frequency : 0
  const paymentCount = scheduledDueMonths.length || legacyPaymentCount
  const installmentAmount = frequency && paymentCount > 0 ? roundMoney(remainingPayment / paymentCount) : null

  return {
    remainingPayment,
    commissionAmount,
    installmentAmount,
  }
}

export interface InstallmentScheduleRow {
  paymentNumber: number
  yearNumber: number
  dueMonth: string | null
  periodLabel: string
  amount: number
}

export interface PaymentTimetableRow extends InstallmentScheduleRow {
  id: string
  unitId: number
  paid: boolean
  paidAt: string | null
  paidBy: string | null
  paidByName: string | null
}

export interface DisplayedPaymentTotals {
  originalDownPayment: number
  paidInstallmentsTotal: number
  unpaidInstallmentsTotal: number
  paidMaintenanceAmount: number
  unpaidMaintenanceAmount: number
  displayedPaidAmount: number
  displayedRemainingAmount: number
}

export function buildInstallmentSchedule(unit: LeadraUnit, locale: LocaleCode = 'en'): InstallmentScheduleRow[] {
  const frequency = getInstallmentPaymentsPerYear(unit.installmentType)
  if (unit.paymentMethod !== 'installment' || !frequency || !unit.installmentAmount) return []

  const formatter = new Intl.NumberFormat(getIntlLocale(locale), { maximumFractionDigits: 0 })
  const dueMonths = getInstallmentScheduledDueMonths(
    unit.installmentType,
    unit.installmentStartMonth,
    unit.installmentEndMonth,
  )
  const amount = unit.installmentAmount

  if (dueMonths.length > 0) {
    return dueMonths.map((dueMonth, index) => ({
      paymentNumber: index + 1,
      yearNumber: Math.floor(index / frequency) + 1,
      dueMonth,
      periodLabel: formatInstallmentMonthLabel(dueMonth, locale),
      amount,
    }))
  }

  if (!unit.installmentYears) return []

  const totalPayments = unit.installmentYears * frequency
  return Array.from({ length: totalPayments }, (_, index) => {
    const paymentNumber = index + 1
    const yearNumber = Math.floor(index / frequency) + 1
    const periodInYear = (index % frequency) + 1
    return {
      paymentNumber,
      yearNumber,
      dueMonth: null,
      periodLabel:
        unit.installmentType === 'monthly'
          ? `${locale === 'ar' ? 'شهر' : 'Month'} ${formatter.format(paymentNumber)}`
          : unit.installmentType === 'quarterly'
          ? `Q${periodInYear}`
          : unit.installmentType === 'semi_annual'
            ? `${locale === 'ar' ? 'نصف' : 'Half'} ${formatter.format(periodInYear)}`
            : `${locale === 'ar' ? 'سنة' : 'Year'} ${formatter.format(yearNumber)}`,
      amount,
    }
  })
}

export function createInitialPaymentSchedule(unit: LeadraUnit): PaymentScheduleRow[] {
  if (unit.paymentMethod !== 'installment' || unit.installmentType === 'custom') return []
  return buildInstallmentSchedule(unit).map((row) => ({
    id: `payment-${unit.id}-${row.paymentNumber}`,
    unitId: unit.id,
    paymentNumber: row.paymentNumber,
    dueMonth: row.dueMonth,
    amount: row.amount,
    paid: false,
    paidAt: null,
    paidBy: null,
    paidByName: null,
  }))
}

export function buildPaymentTimetable(unit: LeadraUnit, locale: LocaleCode = 'en'): PaymentTimetableRow[] {
  const schedule = (unit.paymentSchedule?.length ?? 0) > 0 ? unit.paymentSchedule ?? [] : createInitialPaymentSchedule(unit)
  const labels = buildInstallmentSchedule(unit, locale)
  return schedule
    .slice()
    .sort((first, second) => first.paymentNumber - second.paymentNumber)
    .map((row, index) => {
      const fallback = labels[index]
      const frequency = getInstallmentPaymentsPerYear(unit.installmentType) ?? 1
      return {
        paymentNumber: row.paymentNumber,
        yearNumber: fallback?.yearNumber ?? Math.floor(index / frequency) + 1,
        dueMonth: row.dueMonth,
        periodLabel: row.dueMonth ? formatInstallmentMonthLabel(row.dueMonth, locale) : fallback?.periodLabel ?? String(row.paymentNumber),
        amount: row.amount,
        id: row.id,
        unitId: row.unitId,
        paid: row.paid,
        paidAt: row.paidAt,
        paidBy: row.paidBy,
        paidByName: row.paidByName,
      }
    })
}

export function calculateRemainingFromPaymentSchedule(schedule: PaymentScheduleRow[]): number {
  return Math.max(
    schedule.reduce((total, row) => total + (row.paid ? 0 : row.amount), 0),
    0,
  )
}

export function calculateDisplayedPaymentTotals(unit: LeadraUnit): DisplayedPaymentTotals {
  const schedule = unit.paymentMethod === 'installment'
    ? (unit.paymentSchedule?.length ? unit.paymentSchedule : createInitialPaymentSchedule(unit))
    : []
  const originalDownPayment = unit.paymentMethod === 'installment' ? unit.downPayment ?? 0 : unit.totalAmount
  const paidInstallmentsTotal = schedule.reduce((total, row) => total + (row.paid ? row.amount : 0), 0)
  const unpaidInstallmentsTotal = schedule.length > 0
    ? schedule.reduce((total, row) => total + (row.paid ? 0 : row.amount), 0)
    : unit.paymentMethod === 'installment'
      ? Math.max(0, (unit.totalAmount ?? 0) - originalDownPayment - paidInstallmentsTotal)
      : 0
  const maintenanceAmount = unit.maintenanceCost ?? 0
  const paidMaintenanceAmount = 0
  const unpaidMaintenanceAmount = unit.maintenancePaid ? 0 : maintenanceAmount

  return {
    originalDownPayment,
    paidInstallmentsTotal,
    unpaidInstallmentsTotal,
    paidMaintenanceAmount,
    unpaidMaintenanceAmount,
    displayedPaidAmount: roundMoney(originalDownPayment + paidInstallmentsTotal + paidMaintenanceAmount),
    displayedRemainingAmount: roundMoney(unpaidInstallmentsTotal + unpaidMaintenanceAmount),
  }
}

export function calculateInstallmentTotalAmount(unit: Pick<LeadraUnit, 'paymentMethod' | 'totalAmount' | 'downPayment' | 'paymentSchedule'>): number {
  if (unit.paymentMethod !== 'installment') return unit.totalAmount
  const scheduleTotal = (unit.paymentSchedule ?? []).reduce((total, row) => total + row.amount, 0)
  return roundMoney((unit.downPayment ?? 0) + scheduleTotal)
}

export function calculateDisplayedRemainingPayment(unit: LeadraUnit): number | null {
  if (unit.paymentMethod === 'cash') {
    return null
  }
  return calculateDisplayedPaymentTotals(unit).displayedRemainingAmount
}

export function applyPaymentScheduleAction(
  unit: LeadraUnit,
  actor: LeadraUser,
  scheduleId: string,
  paid: boolean,
  now = new Date().toISOString(),
): { unit: LeadraUnit; history: PaymentHistoryRow } | null {
  const currentSchedule = unit.paymentSchedule ?? createInitialPaymentSchedule(unit)
  const target = currentSchedule.find((row) => row.id === scheduleId)
  if (!target || target.paid === paid) return null

  const previousRemainingValue = unit.remainingPayment ?? calculateDisplayedPaymentTotals(unit).displayedRemainingAmount
  const nextSchedule = currentSchedule.map((row) =>
    row.id === scheduleId
      ? {
          ...row,
          paid,
          paidAt: paid ? now : null,
          paidBy: paid ? actor.id : null,
          paidByName: paid ? actor.fullName : null,
        }
      : row,
  )
  const nextUnitForTotals = { ...unit, paymentSchedule: nextSchedule }
  const newRemainingValue = calculateDisplayedPaymentTotals(nextUnitForTotals).displayedRemainingAmount
  const history: PaymentHistoryRow = {
    id: `payment-history-${unit.id}-${Date.now()}`,
    unitId: unit.id,
    scheduleId,
    action: paid ? 'paid' : 'unpaid',
    amount: target.amount,
    previousRemainingValue,
    newRemainingValue,
    actorId: actor.id,
    actorName: actor.fullName,
    createdAt: now,
  }

  return {
    unit: {
      ...unit,
      paymentSchedule: nextSchedule,
      paymentHistory: [history, ...(unit.paymentHistory ?? [])],
      remainingPayment: newRemainingValue,
      updatedAt: now,
    },
    history,
  }
}

function monthIndex(value: string | null): number | null {
  if (!value) return null
  const [year, month] = value.split('-').map(Number)
  return year * 12 + month - 1
}

function formatMonthIndex(index: number): string {
  const year = Math.floor(index / 12)
  const month = (index % 12) + 1
  return `${year}-${String(month).padStart(2, '0')}-01`
}

function formatInstallmentMonthLabel(value: string, locale: LocaleCode): string {
  const [year, month] = value.split('-').map(Number)
  const date = new Date(year, month - 1, 1)
  return new Intl.DateTimeFormat(getIntlLocale(locale), { month: 'short', year: 'numeric' }).format(date)
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
  if (files.some((file) => file.type === 'video')) {
    return {
      ok: false,
      message: 'Upload failed. Videos are not allowed in unit media.',
      messageKey: 'error.invalidVideoUpload',
    }
  }

  if (files.some((file) => file.type !== 'image' && file.type !== 'pdf')) {
    return {
      ok: false,
      message: 'Upload failed. Only image files and PDF attachments are allowed.',
      messageKey: 'error.invalidMediaUpload',
    }
  }

  if (files.some((file) => file.type === 'pdf') && !files.some((file) => file.type === 'image')) {
    return {
      ok: false,
      message: 'Upload failed. A PDF attachment requires at least one related photo.',
      messageKey: 'error.pdfRequiresPhoto',
    }
  }

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
  const normalizedFilters = normalizeReactiveUnitFilters(filters)
  return filterUnitsForUser(user, units).filter((unit) => {
    const filters = normalizedFilters
    if (filters.projectId && unit.projectId !== filters.projectId) return false
    if (filters.status && filters.status !== 'all' && unit.status !== filters.status) return false
    if (filters.developerId && unit.developerId !== filters.developerId) return false
    if (filters.destinationId && unit.destinationId !== filters.destinationId) return false
    if (filters.unitType && unit.unitType !== filters.unitType) return false
    if (filters.bedrooms && filters.bedrooms !== 'all' && unit.bedrooms !== filters.bedrooms) return false
    if (filters.bathrooms && filters.bathrooms !== 'all' && unit.bathrooms !== filters.bathrooms) return false
    if (filters.paymentMethod && filters.paymentMethod !== 'all' && unit.paymentMethod !== filters.paymentMethod) return false
    if (filters.floor && unit.floor !== filters.floor) return false
    if (!inRange(unit.bua, filters.buaFrom, filters.buaTo)) return false
    if (!inRange(unit.landArea, filters.landAreaFrom, filters.landAreaTo)) return false
    if (!inRange(unit.gardenArea, filters.gardenAreaFrom, filters.gardenAreaTo)) return false
    if (!inRange(unit.terraceArea, filters.terraceAreaFrom, filters.terraceAreaTo)) return false
    if (!inRange(unit.totalAmount, filters.priceFrom, filters.priceTo)) return false
    if (!inRange(unit.paymentMethod === 'cash' ? unit.totalAmount : null, filters.cashPriceFrom, filters.cashPriceTo)) return false
    if (!inRange(unit.downPayment, filters.downPaymentFrom, filters.downPaymentTo)) return false
    if (!inRange(unit.remainingPayment, filters.remainingPaymentFrom, filters.remainingPaymentTo)) return false
    if (filters.installmentType && filters.installmentType !== 'all' && unit.installmentType !== filters.installmentType) return false
    if (!inRange(unit.installmentAmount, filters.installmentAmountFrom, filters.installmentAmountTo)) return false
    if (!inRange(unit.deliveryExpectancy.year, filters.deliveryYearFrom, filters.deliveryYearTo)) return false
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
    if (isSoldStatus(unit.status)) current.soldUnits += 1
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
    if (isSoldStatus(unit.status)) current.soldUnits += 1
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
    return new Intl.NumberFormat(getIntlLocale(locale), { maximumFractionDigits: 0, useGrouping: false }).format(deliveryExpectancy.year)
  }

  const date = new Date(deliveryExpectancy.year, (deliveryExpectancy.month ?? 1) - 1, 1)
  return new Intl.DateTimeFormat(getIntlLocale(locale), { month: 'long', year: 'numeric' }).format(date)
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}
