import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { buildPaymentTimetable, canViewSalesSensitiveData, formatCurrency, formatDeliveryExpectancy, getApplicableUnitAreaFields, sanitizeUnitForPdf } from './domain'
import { translate, type LocaleCode } from './i18n'
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
  const lines = [
    settings.companyName,
    `${translate(locale, 'export.generatedBy')}: ${user.fullName}`,
    `${translate(locale, 'units.unitCode')}: ${safeUnit.unitCode}`,
    ...buildPdfFacts(user, safeUnit, locale).map(([label, value]) => `${label}: ${value}`),
    canIncludeSalesExportData(user, unit) ? safeUnit.salesNotes || translate(locale, 'export.notesEmpty') : translate(locale, 'export.notesEmpty'),
    settings.footerText,
    settings.contactDetails,
  ].filter(Boolean)

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

  page.drawRectangle({ x: 32, y: height - 154, width: 531, height: 120, color: rgb(0.05, 0.05, 0.06) })
  const logo = settings.logoPath ? await embedImage(pdf, settings.logoPath) : null
  if (settings.logoPath) {
    if (logo) {
      const logoBox = { x: 404, y: height - 126, width: 142, height: 90 }
      const scaledLogo = logo.scaleToFit(142, 72)
      page.drawImage(logo, {
        x: logoBox.x + (logoBox.width - scaledLogo.width) / 2,
        y: logoBox.y + (logoBox.height - scaledLogo.height) / 2,
        width: scaledLogo.width,
        height: scaledLogo.height,
      })
    } else {
      const logoBox = { x: 406, y: height - 124, width: 140, height: 88 }
      drawPdfText(page, 'Logo unavailable', { x: logoBox.x + 18, y: logoBox.y + 48, size: 10, font: bold, color: rgb(0.49, 0.45, 0.41), maxWidth: 104 })
      drawPdfText(page, 'Upload PNG or JPG', { x: logoBox.x + 18, y: logoBox.y + 30, size: 8, font, color: rgb(0.49, 0.45, 0.41), maxWidth: 104 })
    }
  }
  drawPdfText(page, settings.companyName || 'Leadra', { x: 52, y: height - 78, size: 24, font: bold, color: rgb(0.96, 0.95, 0.92), maxWidth: settings.logoPath ? 330 : 490 })
  drawPdfText(page, safeUnit.unitCode, { x: 52, y: height - 112, size: 18, font: bold, color: rgb(0.84, 0.69, 0.44) })
  drawPdfText(page, `${safeUnit.destinationName} / ${safeUnit.developerName} / ${safeUnit.projectName}`, { x: 52, y: height - 136, size: 11, font, color: rgb(0.96, 0.95, 0.92) })

  const facts = buildPdfFacts(user, safeUnit, locale)

  for (const [label, value] of facts) {
    drawPdfText(page, label, { x: 52, y, size: 9, font: bold, color: rgb(0.49, 0.45, 0.41) })
    drawPdfText(page, String(value ?? ''), { x: 210, y, size: 11, font, color: rgb(0.16, 0.15, 0.14), maxWidth: 330 })
    y -= 28
  }

  y -= 18
  drawPdfText(page, 'Notes', { x: 52, y, size: 13, font: bold, color: rgb(0.16, 0.15, 0.14) })
  y -= 20
  drawPdfText(page, includeSalesData ? safeUnit.salesNotes || translate(locale, 'export.notesEmpty') : translate(locale, 'export.notesEmpty'), {
    x: 52,
    y,
    size: 10,
    font,
    color: rgb(0.16, 0.15, 0.14),
    maxWidth: 490,
  })

  drawPdfText(page, `${settings.footerText}${settings.contactDetails ? ` / ${settings.contactDetails}` : ''}`, {
    x: 52,
    y: 32,
    size: 8,
    font,
    color: rgb(0.49, 0.45, 0.41),
    maxWidth: 490,
  })

  const images = safeUnit.media.filter((file) => file.type === 'image' && file.includeInPdf !== false)
  for (let index = 0; index < images.length; index += 4) {
    const imagePage = pdf.addPage([595, 842])
    drawPdfText(imagePage, `Unit images / ${safeUnit.unitCode}`, { x: 42, y: 790, size: 18, font: bold, color: rgb(0.16, 0.15, 0.14) })
    const batch = images.slice(index, index + 4)
    for (const [batchIndex, file] of batch.entries()) {
      const embedded = await embedImage(pdf, file.url)
      const x = batchIndex % 2 === 0 ? 42 : 305
      const yImage = batchIndex < 2 ? 470 : 145
      imagePage.drawRectangle({ x, y: yImage, width: 248, height: 275, color: rgb(0.96, 0.95, 0.92), borderColor: rgb(0.84, 0.69, 0.44), borderWidth: 1 })
      if (embedded) {
        const scaled = embedded.scaleToFit(224, 220)
        imagePage.drawImage(embedded, { x: x + 12, y: yImage + 42, width: scaled.width, height: scaled.height })
      }
      drawPdfText(imagePage, file.name, { x: x + 12, y: yImage + 18, size: 9, font, color: rgb(0.49, 0.45, 0.41), maxWidth: 224 })
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
  generatedAt = new Date(),
): Promise<GeneratedPdf> {
  const blob = await buildPermissionSafePdfBlob(user, unit, settings, locale)
  return { blob, fileName: `leadra-${unit.unitCode}-${formatPdfTimestamp(generatedAt)}.pdf` }
}

function buildPdfFacts(user: LeadraUser, unit: LeadraUnit, locale: LocaleCode): [string, string][] {
  const areaFields = getApplicableUnitAreaFields(unit.unitType, unit.floor)
  const facts: [string, string][] = [
    [translate(locale, 'export.destination'), unit.destinationName],
    [translate(locale, 'details.developer'), unit.developerName],
    [translate(locale, 'export.project'), unit.projectName],
    [translate(locale, 'export.type'), unit.unitType],
    [translate(locale, 'create.bua'), formatArea(unit.bua)],
  ]

  if (areaFields.showLandArea) facts.push([translate(locale, 'details.landArea'), formatOptionalArea(unit.landArea)])
  if (areaFields.showFloor) facts.push([translate(locale, 'details.floor'), unit.floor])
  if (areaFields.showGardenArea) facts.push([translate(locale, 'details.gardenArea'), formatOptionalArea(unit.gardenArea)])
  if (areaFields.showTerraceArea) facts.push([translate(locale, 'details.terraceArea'), formatOptionalArea(unit.terraceArea)])

  facts.push(
    [translate(locale, 'export.bedsBaths'), `${unit.bedrooms} / ${unit.bathrooms}`],
    [translate(locale, 'details.finishType'), unit.finish],
  )

  if (unit.furnished) facts.push([translate(locale, 'details.furnishingStatus'), translate(locale, 'create.furnishedOption')])
  if (unit.elevator) facts.push([translate(locale, 'details.elevator'), 'Yes'])

  facts.push([translate(locale, 'export.totalAmount'), formatCurrency(unit.totalAmount, locale)])

  if (canIncludeSalesExportData(user, unit)) {
    facts.push([translate(locale, 'export.commission'), `${formatCurrency(unit.commissionAmount, locale)} (${unit.commissionPercentage}%)`])
  }
  if ((unit.transferFees ?? 0) > 0) facts.push([translate(locale, 'details.transferFees'), formatCurrency(unit.transferFees, locale)])
  if (unit.downPayment != null) facts.push([translate(locale, 'create.downPayment'), formatCurrency(unit.downPayment, locale)])
  if (unit.remainingPayment != null) facts.push([translate(locale, 'details.remainingPayment'), formatCurrency(unit.remainingPayment, locale)])
  if (unit.paymentMethod === 'installment') {
    const nextInstallment = getNextInstallment(unit, locale)
    if (nextInstallment) {
      facts.push([
        translate(locale, 'export.nextInstallment'),
        `#${nextInstallment.paymentNumber} ${nextInstallment.periodLabel}: ${formatCurrency(nextInstallment.amount, locale)}`,
      ])
    } else if (unit.installmentAmount != null) {
      facts.push([translate(locale, 'export.nextInstallment'), formatCurrency(unit.installmentAmount, locale)])
    }

    if (unit.installmentType === 'custom') {
      facts.push([translate(locale, 'details.customInstallmentText'), unit.customInstallmentText || translate(locale, 'details.customInstallmentMessage')])
    }
  }

  facts.push([translate(locale, 'export.delivery'), formatDeliveryExpectancy(unit, locale)])

  return facts.filter(([, value]) => Boolean(value))
}

function getNextInstallment(unit: LeadraUnit, locale: LocaleCode) {
  return buildPaymentTimetable(unit, locale)
    .filter((row) => !row.paid)
    .sort((first, second) => first.paymentNumber - second.paymentNumber)[0] ?? null
}

function formatArea(value: number) {
  return `${value} m2`
}

function formatOptionalArea(value: number | null | undefined) {
  return value == null ? '' : formatArea(value)
}

function formatPdfTimestamp(date: Date) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/[:-]/g, '').replace('T', '-').replace('Z', '')
}

export function downloadGeneratedPdf(pdf: GeneratedPdf): void {
  const url = URL.createObjectURL(pdf.blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = pdf.fileName
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.append(anchor)
  anchor.click()
  window.setTimeout(() => {
    anchor.remove()
    URL.revokeObjectURL(url)
  }, 1000)
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
  return canViewSalesSensitiveData(user, unit)
}
