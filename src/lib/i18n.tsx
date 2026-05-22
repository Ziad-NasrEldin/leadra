/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { catalogs } from './i18nCatalog'

export type LocaleCode = 'en' | 'ar'
export type MessageParams = Record<string, string | number | boolean | null | undefined>

interface LocaleContextValue {
  locale: LocaleCode
  setLocale: (locale: LocaleCode) => void
  dir: 'ltr' | 'rtl'
  intlLocale: string
  t: (key: string, params?: MessageParams) => string
}

const LOCALE_STORAGE_KEY = 'leadra.locale'

const localeMeta: Record<LocaleCode, { dir: 'ltr' | 'rtl'; intlLocale: string }> = {
  en: { dir: 'ltr', intlLocale: 'en-EG' },
  ar: { dir: 'rtl', intlLocale: 'ar-EG' },
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>(() => {
    if (typeof window === 'undefined') return 'en'
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY)
    return stored === 'ar' ? 'ar' : 'en'
  })

  useEffect(() => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
    document.documentElement.lang = localeMeta[locale].intlLocale
    document.documentElement.dir = localeMeta[locale].dir
  }, [locale])

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale: setLocaleState,
      dir: localeMeta[locale].dir,
      intlLocale: localeMeta[locale].intlLocale,
      t: (key, params) => translate(locale, key, params),
    }),
    [locale],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  const value = useContext(LocaleContext)
  if (!value) throw new Error('useLocale must be used inside LocaleProvider.')
  return value
}

export function translate(locale: LocaleCode, key: string, params: MessageParams = {}): string {
  const value = catalogs[locale][key] ?? catalogs.en[key]
  if (!value) return key
  if (typeof value === 'function') return value(params, locale)
  return interpolate(value, params)
}

export function getIntlLocale(locale: LocaleCode): string {
  return localeMeta[locale].intlLocale
}

export function isRtlLocale(locale: LocaleCode): boolean {
  return localeMeta[locale].dir === 'rtl'
}

export function formatCount(locale: LocaleCode, value: number): string {
  return new Intl.NumberFormat(getIntlLocale(locale), { maximumFractionDigits: 0 }).format(value)
}

export function formatDateTime(locale: LocaleCode, value: string | number | Date): string {
  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export function formatDate(locale: LocaleCode, value: string | number | Date): string {
  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

export function formatShortDate(locale: LocaleCode, value: string): string {
  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    month: 'numeric',
    day: 'numeric',
  }).format(new Date(value))
}

export function compareText(locale: LocaleCode, first: string, second: string): number {
  return new Intl.Collator(getIntlLocale(locale), { sensitivity: 'base', numeric: true }).compare(first, second)
}

export function getStatusLabel(locale: LocaleCode, status: string): string {
  return translate(locale, `status.${status}`)
}

export function getRoleLabel(locale: LocaleCode, role: string): string {
  return translate(locale, `role.${role}`)
}

export function getAccountStatusLabel(locale: LocaleCode, status: string): string {
  return translate(locale, `account.${status}`)
}

export function getPaymentMethodLabel(locale: LocaleCode, paymentMethod: string): string {
  return translate(locale, `payment.${paymentMethod}`)
}

export function getUserInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const chars = parts.slice(0, 2).flatMap((part) => Array.from(part).slice(0, 1))
  return chars.join('').slice(0, 2).toUpperCase()
}

function interpolate(template: string, params: MessageParams): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ''))
}
