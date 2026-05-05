import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { buildInstallmentSchedule, formatCurrency, formatDeliveryExpectancy, sanitizeUnitForPdf } from './domain'
import { getPaymentMethodLabel, translate, type LocaleCode } from './i18n'
import type { AppSettings, LeadraUnit, LeadraUser } from './types'

export interface GeneratedPdf {
  blob: Blob
  fileName: string
}

export function buildPermissionSafePdfText(
  user: LeadraUser,
  unit: LeadraUnit,
  settings: AppSettings,
  locale: LocaleCode = 'en',
): string {
  const safeUnit = sanitizeUnitForPdf(user, unit)
  const includeSalesData = canIncludeSalesExportData(user, unit)
  const lines = [
    settings.companyName,
    `${translate(locale, 'export.generatedBy')}: ${user.fullName}`,
    `${translate(locale, 'units.unitCode')}: ${safeUnit.unitCode}`,
    `${translate(locale, 'export.project')}: ${safeUnit.projectName}`,
    `${translate(locale, 'export.destination')}: ${safeUnit.destinationName}`,
    `${translate(locale, 'export.type')}: ${safeUnit.unitType}`,
    `${translate(locale, 'export.area')}: ${safeUnit.bua}`,
    `${translate(locale, 'export.bedsBaths')}: ${safeUnit.bedrooms} / ${safeUnit.bathrooms}`,
    `${translate(locale, 'export.totalAmount')}: ${formatCurrency(safeUnit.totalAmount, locale)}`,
    `${translate(locale, 'export.paymentMethod')}: ${getPaymentMethodLabel(locale, safeUnit.paymentMethod)}`,
    safeUnit.paymentMethod === 'installment'
      ? `${translate(locale, 'export.installment')}: ${formatCurrency(safeUnit.installmentAmount, locale)}`
      : '',
    `${translate(locale, 'export.delivery')}: ${formatDeliveryExpectancy(safeUnit, locale)}`,
    includeSalesData ? safeUnit.salesNotes || translate(locale, 'export.notesEmpty') : translate(locale, 'export.notesEmpty'),
    settings.footerText,
    settings.contactDetails,
  ].filter(Boolean)

  if (includeSalesData) {
    lines.splice(9, 0, `${translate(locale, 'export.commission')}: ${formatCurrency(safeUnit.commissionAmount, locale)}`)
  }

  return lines.join('\n')
}

export async function buildPermissionSafePdfBlob(
  user: LeadraUser,
  unit: LeadraUnit,
  settings: AppSettings,
  locale: LocaleCode = 'en',
): Promise<Blob> {
  const safeUnit = sanitizeUnitForPdf(user, unit)
  const includeSalesData = canIncludeSalesExportData(user, unit)
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const page = pdf.addPage([595, 842])
  const { height } = page.getSize()
  let y = height - 190

  page.drawRectangle({ x: 32, y: height - 154, width: 531, height: 120, color: rgb(0.08, 0.13, 0.11) })
  drawPdfText(page, settings.companyName || 'Leadra', { x: 52, y: height - 78, size: 24, font: bold, color: rgb(1, 0.98, 0.9) })
  drawPdfText(page, safeUnit.unitCode, { x: 52, y: height - 112, size: 18, font: bold, color: rgb(0.94, 0.86, 0.73) })
  drawPdfText(page, `${safeUnit.projectName} / ${safeUnit.destinationName}`, { x: 52, y: height - 136, size: 11, font, color: rgb(1, 0.98, 0.9) })

  const facts = [
    ['Unit type', safeUnit.unitType],
    ['Area', `${safeUnit.bua} m2`],
    ['Bedrooms / Bathrooms', `${safeUnit.bedrooms} / ${safeUnit.bathrooms}`],
    ['Pricing', formatCurrency(safeUnit.totalAmount, locale)],
    ['Payment', getPaymentMethodLabel(locale, safeUnit.paymentMethod)],
    ['Delivery', formatDeliveryExpectancy(safeUnit, locale)],
  ]

  if (includeSalesData) facts.splice(4, 0, ['Commission', `${formatCurrency(safeUnit.commissionAmount, locale)} (${safeUnit.commissionPercentage}%)`])
  if (safeUnit.paymentMethod === 'installment') {
    facts.push(['Installment', safeUnit.installmentType === 'custom' ? translate(locale, 'details.customInstallmentMessage') : formatCurrency(safeUnit.installmentAmount, locale)])
  }

  for (const [label, value] of facts) {
    drawPdfText(page, label, { x: 52, y, size: 9, font: bold, color: rgb(0.3, 0.42, 0.34) })
    drawPdfText(page, String(value ?? ''), { x: 210, y, size: 11, font, color: rgb(0.08, 0.13, 0.11), maxWidth: 330 })
    y -= 28
  }

  const schedule = buildInstallmentSchedule(safeUnit, locale).slice(0, 8)
  if (schedule.length > 0) {
    y -= 8
    drawPdfText(page, 'Installment schedule', { x: 52, y, size: 13, font: bold, color: rgb(0.08, 0.13, 0.11) })
    y -= 22
    for (const row of schedule) {
      drawPdfText(page, `#${row.paymentNumber} ${row.periodLabel}`, { x: 64, y, size: 9, font, color: rgb(0.08, 0.13, 0.11) })
      drawPdfText(page, formatCurrency(row.amount, locale), { x: 220, y, size: 9, font: bold, color: rgb(0.08, 0.13, 0.11) })
      y -= 16
    }
  }

  y -= 18
  drawPdfText(page, 'Notes', { x: 52, y, size: 13, font: bold, color: rgb(0.08, 0.13, 0.11) })
  y -= 20
  drawPdfText(page, includeSalesData ? safeUnit.salesNotes || translate(locale, 'export.notesEmpty') : translate(locale, 'export.notesEmpty'), {
    x: 52,
    y,
    size: 10,
    font,
    color: rgb(0.08, 0.13, 0.11),
    maxWidth: 490,
  })

  drawPdfText(page, `${settings.footerText}${settings.contactDetails ? ` / ${settings.contactDetails}` : ''}`, {
    x: 52,
    y: 32,
    size: 8,
    font,
    color: rgb(0.3, 0.42, 0.34),
    maxWidth: 490,
  })

  const images = safeUnit.media.filter((file) => file.type === 'image')
  for (let index = 0; index < images.length; index += 4) {
    const imagePage = pdf.addPage([595, 842])
    drawPdfText(imagePage, `Unit images / ${safeUnit.unitCode}`, { x: 42, y: 790, size: 18, font: bold, color: rgb(0.08, 0.13, 0.11) })
    const batch = images.slice(index, index + 4)
    for (const [batchIndex, file] of batch.entries()) {
      const embedded = await embedImage(pdf, file.url)
      const x = batchIndex % 2 === 0 ? 42 : 305
      const yImage = batchIndex < 2 ? 470 : 145
      imagePage.drawRectangle({ x, y: yImage, width: 248, height: 275, color: rgb(0.98, 0.96, 0.91), borderColor: rgb(0.85, 0.82, 0.77), borderWidth: 1 })
      if (embedded) {
        const scaled = embedded.scaleToFit(224, 220)
        imagePage.drawImage(embedded, { x: x + 12, y: yImage + 42, width: scaled.width, height: scaled.height })
      }
      drawPdfText(imagePage, file.name, { x: x + 12, y: yImage + 18, size: 9, font, color: rgb(0.3, 0.42, 0.34), maxWidth: 224 })
    }
  }

  const bytes = await pdf.save()
  const pdfBytes = new Uint8Array(bytes)
  return new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' })
}

export async function generateUnitPdfFile(
  user: LeadraUser,
  unit: LeadraUnit,
  settings: AppSettings,
  locale: LocaleCode = 'en',
): Promise<GeneratedPdf> {
  const blob = await buildPermissionSafePdfBlob(user, unit, settings, locale)
  return { blob, fileName: `leadra-${unit.unitCode}.pdf` }
}

export function downloadGeneratedPdf(pdf: GeneratedPdf): void {
  const url = URL.createObjectURL(pdf.blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = pdf.fileName
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function shareGeneratedPdf(pdf: GeneratedPdf): Promise<boolean> {
  const file = new File([pdf.blob], pdf.fileName, { type: 'application/pdf' })
  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    await navigator.share({ files: [file], title: pdf.fileName, text: 'Leadra unit PDF' })
    return true
  }
  return false
}

async function embedImage(pdf: PDFDocument, url: string) {
  try {
    const bytes = await imageBytes(url)
    if (!bytes) return null
    if (url.includes('image/png') || url.toLowerCase().endsWith('.png')) return await pdf.embedPng(bytes)
    return await pdf.embedJpg(bytes)
  } catch {
    return null
  }
}

function drawPdfText(
  page: PDFPage,
  text: string,
  options: { x: number; y: number; size: number; font: PDFFont; color: ReturnType<typeof rgb>; maxWidth?: number },
) {
  page.drawText(toWinAnsiText(text), options)
}

function toWinAnsiText(value: string): string {
  return value
    .replace(/[\u200e\u200f\u202a-\u202e]/g, '')
    .replace(/[^\u0020-\u007e\u00a0-\u00ff]/g, '')
    .trim()
}

async function imageBytes(url: string): Promise<Uint8Array | null> {
  if (url.startsWith('data:')) {
    const [, encoded] = url.split(',')
    if (!encoded) return null
    return Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0))
  }
  const response = await fetch(url)
  if (!response.ok) return null
  return new Uint8Array(await response.arrayBuffer())
}

function canIncludeSalesExportData(user: LeadraUser, unit: LeadraUnit) {
  return user.role !== 'sales' || unit.createdBy === user.id
}
