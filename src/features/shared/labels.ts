import { translate, type LocaleCode } from '../../lib/i18n'
import type { LookupKind, MessageParams } from '../../lib/types'
import type { AdminSection, CreateUnitStep } from './constants'

export function translateCreateStep(step: CreateUnitStep, locale: LocaleCode) {
  if (step === 'Property') return translateForLocale(locale, 'create.property')
  if (step === 'Specs') return translateForLocale(locale, 'create.specs')
  if (step === 'Payment') return translateForLocale(locale, 'create.payment')
  if (step === 'Owner') return translateForLocale(locale, 'create.owner')
  return translateForLocale(locale, 'create.review')
}

export function translateAdminSection(section: AdminSection, locale: LocaleCode) {
  if (section === 'Users') return translateForLocale(locale, 'admin.users')
  if (section === 'Master Data') return translateForLocale(locale, 'admin.masterData')
  if (section === 'Settings') return translateForLocale(locale, 'admin.settings')
  if (section === 'Metrics') return translateForLocale(locale, 'admin.metrics')
  return translateForLocale(locale, 'admin.audit')
}

export function getLookupKindLabel(kind: LookupKind, locale: LocaleCode) {
  if (kind === 'developer') return translateForLocale(locale, 'admin.lookupDeveloper')
  if (kind === 'destination') return translateForLocale(locale, 'admin.lookupDestination')
  if (kind === 'project') return translateForLocale(locale, 'admin.lookupProject')
  if (kind === 'view') return translateForLocale(locale, 'admin.lookupView')
  if (kind === 'finish') return translateForLocale(locale, 'admin.lookupFinish')
  return translateForLocale(locale, 'admin.lookupUnitType')
}

export function sortLabel(sortUsersBy: 'role' | 'name' | 'recent', locale: LocaleCode) {
  if (sortUsersBy === 'role') return translateForLocale(locale, 'admin.sortRole')
  if (sortUsersBy === 'name') return translateForLocale(locale, 'admin.sortName')
  return translateForLocale(locale, 'admin.sortRecent')
}

function translateForLocale(locale: LocaleCode, key: string, params?: MessageParams) {
  return translate(locale, key, params)
}
