import { getIntlLocale, type LocaleCode } from './i18n'

export function parseFormattedNumber(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (!value) return 0
  const normalized = value.replace(/,/g, '').replace(/[^\d.-]/g, '')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

export function parseOptionalFormattedNumber(value: string | number | null | undefined): number | null {
  if (value == null || value === '') return null
  const parsed = parseFormattedNumber(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function formatInputNumber(value: number, locale: LocaleCode = 'en'): string {
  return new Intl.NumberFormat(getIntlLocale(locale), {
    maximumFractionDigits: 2,
  }).format(value)
}

