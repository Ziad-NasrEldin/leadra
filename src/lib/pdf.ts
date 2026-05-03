import { formatCurrency, formatDeliveryExpectancy, sanitizeUnitForPdf } from './domain'
import type { LeadraUnit, LeadraUser } from './types'

export function buildPermissionSafePdfText(user: LeadraUser, unit: LeadraUnit): string {
  const safeUnit = sanitizeUnitForPdf(user, unit)
  const ownerLine = safeUnit.originalOwnerName
    ? `Owner: ${safeUnit.originalOwnerName} / ${safeUnit.originalOwnerPhone}`
    : 'Owner: Hidden by Leadra permissions'
  const installmentLine =
    safeUnit.paymentMethod === 'installment'
      ? `Installment: ${safeUnit.installmentType} at ${formatCurrency(safeUnit.installmentAmount)}`
      : 'Payment: Cash'

  return [
    'Leadra Resale Unit PDF',
    `Unit: ${safeUnit.unitCode}`,
    `Project: ${safeUnit.projectName}`,
    `Destination: ${safeUnit.destinationName}`,
    `Type: ${safeUnit.unitType}`,
    `Area: ${safeUnit.bua} BUA`,
    `Bedrooms/Bathrooms: ${safeUnit.bedrooms}/${safeUnit.bathrooms}`,
    `Pricing: ${formatCurrency(safeUnit.totalAmount)}`,
    `Commission: ${formatCurrency(safeUnit.commissionAmount)}`,
    installmentLine,
    `Delivery: ${formatDeliveryExpectancy(safeUnit)}`,
    ownerLine,
    `Images included: ${safeUnit.media.filter((file) => file.type === 'image').length}`,
  ].join('\n')
}

export function downloadTextPdfFallback(user: LeadraUser, unit: LeadraUnit): void {
  const blob = new Blob([buildPermissionSafePdfText(user, unit)], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${unit.unitCode}.pdf`
  link.click()
  URL.revokeObjectURL(url)
}
