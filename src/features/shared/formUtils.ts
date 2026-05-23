import { getIntlLocale, type LocaleCode } from '../../lib/i18n'
import { normalizeReactiveUnitFilters } from '../../lib/domain'
import { parseFormattedNumber } from '../../lib/numberFormat'
import type { InstallmentType, LeadraUnit, UnitFilters } from '../../lib/types'

const automaticInstallmentFrequencyMonths: Record<Exclude<InstallmentType, 'custom'>, number> = {
  monthly: 1,
  quarterly: 3,
  semi_annual: 6,
  annual: 12,
}

const installmentTypeLabelKeys: Record<InstallmentType, string> = {
  monthly: 'create.monthly',
  quarterly: 'create.quarterly',
  semi_annual: 'create.semiAnnual',
  annual: 'create.annual',
  custom: 'create.customInstallments',
}

export function parseOptionalNumber(value: string): number | undefined {
  if (value.trim() === '') return undefined
  const parsed = parseFormattedNumber(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function readFormString(formData: FormData, name: string, fallback = ''): string {
  const value = formData.get(name)
  return typeof value === 'string' ? value : fallback
}

export function readTrimmedFormString(formData: FormData, name: string, fallback = ''): string {
  const value = readFormString(formData, name, fallback).trim()
  return value || fallback
}

export function readFormNumber(formData: FormData, name: string, fallback = 0): number {
  const value = formData.get(name)
  if (typeof value !== 'string') return fallback
  const parsed = parseOptionalNumber(value)
  return parsed ?? fallback
}

export function readFormBoolean(formData: FormData, name: string): boolean {
  return formData.get(name) === 'on'
}

export function readFormEnum<const T extends readonly string[]>(
  formData: FormData,
  name: string,
  allowed: T,
  fallback: T[number],
): T[number] {
  const value = formData.get(name)
  return typeof value === 'string' && allowed.includes(value) ? value : fallback
}

export function parseOptionalFormNumber(formData: FormData, name: string): number | null {
  const value = formData.get(name)
  if (typeof value !== 'string') return null
  return parseOptionalNumber(value) ?? null
}

export function parseOptionalFormDate(formData: FormData, name: string): string | null {
  const value = formData.get(name)
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

export function parseOptionalFormText(formData: FormData, name: string): string | null {
  const value = formData.get(name)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

export function parseOptionalFormMonthDate(formData: FormData, name: string): string | null {
  const value = parseOptionalFormText(formData, name)
  if (!value) return null
  return value.length === 7 ? `${value}-01` : value
}

export function toMonthInputValue(value?: string | null): string {
  if (!value) return ''
  const match = /^(\d{4})-(\d{2})/.exec(value)
  return match ? `${match[1]}-${match[2]}` : ''
}

export function getOptionalUnitString(unit: LeadraUnit, name: 'installmentStartMonth' | 'installmentEndMonth' | 'customInstallmentText'): string | null {
  const value = unit[name]
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

export function getUnitInstallmentStartMonth(unit: LeadraUnit): string | null {
  return getOptionalUnitString(unit, 'installmentStartMonth')
}

export function getUnitInstallmentEndMonth(unit: LeadraUnit): string | null {
  return getOptionalUnitString(unit, 'installmentEndMonth')
}

export function getUnitCustomInstallmentText(unit: LeadraUnit): string | null {
  return getOptionalUnitString(unit, 'customInstallmentText')
}

export function isAutomaticInstallmentType(type: InstallmentType | null | undefined): type is Exclude<InstallmentType, 'custom'> {
  return type != null && type !== 'custom'
}

export function installmentFrequencyMonths(type: InstallmentType | null | undefined): number | null {
  return isAutomaticInstallmentType(type) ? automaticInstallmentFrequencyMonths[type] : null
}

export function parseMonthValue(value?: string | null): { year: number; monthIndex: number } | null {
  const monthValue = toMonthInputValue(value)
  if (!monthValue) return null
  const [yearText, monthText] = monthValue.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null
  return { year, monthIndex: month - 1 }
}

export function countInstallmentsBetweenMonths(type: InstallmentType | null | undefined, startMonth?: string | null, endMonth?: string | null): number | null {
  const frequencyMonths = installmentFrequencyMonths(type)
  const start = parseMonthValue(startMonth)
  const end = parseMonthValue(endMonth)
  if (!frequencyMonths || !start || !end) return null
  const startIndex = start.year * 12 + start.monthIndex
  const endIndex = end.year * 12 + end.monthIndex
  if (endIndex < startIndex) return null
  return Math.floor((endIndex - startIndex) / frequencyMonths) + 1
}

export function calculateInstallmentAmountForPeriod(remainingPayment: number, type: InstallmentType | null | undefined, startMonth?: string | null, endMonth?: string | null): number | null {
  const paymentCount = countInstallmentsBetweenMonths(type, startMonth, endMonth)
  return paymentCount ? remainingPayment / paymentCount : null
}

export function formatMonthYear(locale: LocaleCode, value?: string | null): string | null {
  const parsed = parseMonthValue(value)
  if (!parsed) return null
  return new Intl.DateTimeFormat(getIntlLocale(locale), { month: 'long', year: 'numeric' }).format(new Date(parsed.year, parsed.monthIndex, 1))
}

export function getInstallmentTypeLabel(type: InstallmentType | null | undefined, t: (key: string) => string): string {
  return type ? t(installmentTypeLabelKeys[type]) : t('common.notSet')
}

export function countActiveUnitFilters(filters: UnitFilters): number {
  return Object.values(normalizeReactiveUnitFilters(filters)).filter((value) => value !== undefined && value !== '' && value !== 'all').length
}
