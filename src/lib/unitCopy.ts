import { formatCurrency, formatDeliveryExpectancy } from './domain'
import type { LocaleCode } from './i18n'
import type { LeadraUnit } from './types'

export function buildSpecialUnitSocialCopy(unit: LeadraUnit, locale: LocaleCode = 'en'): string {
  const parts = [
    `${unit.projectName} ${unit.unitType}`,
    `${unit.destinationName} | ${unit.unitCode}`,
    `${unit.bedrooms} bedrooms, ${unit.bathrooms} bathrooms`,
    `BUA: ${unit.bua} m2`,
    `Price: ${formatCurrency(unit.totalAmount, locale)}`,
    `Delivery: ${formatDeliveryExpectancy(unit, locale)}`,
  ]

  if (unit.floor) parts.splice(3, 0, `Floor: ${unit.floor}`)
  if (unit.viewName) parts.splice(4, 0, `View: ${unit.viewName}`)
  if (unit.finish) parts.push(`Finishing: ${unit.finish}`)
  if (unit.paymentMethod === 'installment' && unit.downPayment != null) {
    parts.push(`Down payment: ${formatCurrency(unit.downPayment, locale)}`)
    if (unit.installmentAmount != null) parts.push(`Installment: ${formatCurrency(unit.installmentAmount, locale)}`)
  }

  parts.push('Contact Leadra for details.')
  return parts.join('\n')
}

