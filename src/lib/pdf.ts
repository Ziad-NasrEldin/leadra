import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib'
import { buildPaymentTimetable, calculateDisplayedPaymentTotals, canViewSalesSensitiveData, formatCurrency, formatDeliveryExpectancy, getApplicableUnitAreaFields, sanitizeUnitForPdf } from './domain'
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
  const pdfData = buildPdfUnitDetails(user, safeUnit, locale)
  const lines = [
    settings.companyName,
    `${translate(locale, 'export.generatedBy')}: ${user.fullName}`,
    ...pdfData.rows.map((row) => `${row.label}: ${row.value}`),
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
  const pdfData = buildPdfUnitDetails(user, safeUnit, locale)
  const images = safeUnit.media.filter((file) => file.type === 'image' && file.includeInPdf !== false)
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const page = pdf.addPage([595, 842])
  const logo = settings.logoPath ? await embedImage(pdf, settings.logoPath, { allowPngFallback: true }) : null
  const thumbnail = images[0] ? await embedImage(pdf, images[0].url) : null

  drawCoverPage(page, {
    font,
    bold,
    logo,
    thumbnail,
    settings,
    unit: safeUnit,
    rows: pdfData.rows,
  })

  for (let index = 0; index < images.length; index += 2) {
    const imagePage = pdf.addPage([595, 842])
    await drawImagePage(imagePage, {
      pdf,
      font,
      bold,
      unitCode: safeUnit.unitCode,
      images: images.slice(index, index + 2),
      pageNumber: Math.floor(index / 2) + 2,
    })
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
  return { blob, fileName: `${unit.unitCode}-${formatPdfExportDate(generatedAt)}.pdf` }
}

function buildPdfUnitDetails(user: LeadraUser, unit: LeadraUnit, locale: LocaleCode) {
  const areaFields = getApplicableUnitAreaFields(unit.unitType, unit.floor)
  const rows: PdfDetailRow[] = [
    { label: translate(locale, 'units.unitCode'), value: unit.unitCode, kind: 'hero' },
    { label: translate(locale, 'export.destination'), value: unit.destinationName },
    { label: translate(locale, 'details.developer'), value: unit.developerName },
    { label: translate(locale, 'export.project'), value: unit.projectName },
    { label: translate(locale, 'export.type'), value: unit.unitType },
  ]

  if (areaFields.showFloor) rows.push({ label: 'Floor / Position', value: unit.floor })

  rows.push({ label: translate(locale, 'create.bua'), value: formatArea(unit.bua) })

  if (areaFields.showLandArea) rows.push({ label: translate(locale, 'details.landArea'), value: formatOptionalArea(unit.landArea) })
  if (areaFields.showGardenArea) rows.push({ label: translate(locale, 'details.gardenArea'), value: formatOptionalArea(unit.gardenArea) })
  if (areaFields.showTerraceArea) rows.push({ label: translate(locale, 'details.terraceArea'), value: formatOptionalArea(unit.terraceArea) })

  rows.push(
    { label: 'View', value: unit.viewName },
    { label: 'Bedrooms', value: String(unit.bedrooms) },
    { label: 'Bathrooms', value: String(unit.bathrooms) },
    { label: translate(locale, 'details.elevator'), value: unit.elevator ? 'Yes' : 'No' },
  )

  if (unit.furnished) rows.push({ label: 'Furnished', value: translate(locale, 'create.furnishedOption') })

  rows.push({ label: 'Finishing Status *', value: unit.finish })

  if (unit.paymentMethod === 'cash') {
    rows.push({ label: 'Cash Price', value: formatCurrency(unit.totalAmount, locale), kind: 'money' })
  }
  if (unit.paymentMethod === 'installment') {
    const installments = buildPaymentTimetable(unit, locale)
    const paymentTotals = calculateDisplayedPaymentTotals(unit)
    rows.push(
      { label: 'Total Amount', value: formatCurrency(unit.totalAmount, locale), kind: 'money' },
      { label: translate(locale, 'create.downPayment'), value: formatCurrency(paymentTotals.displayedPaidAmount, locale), kind: 'money' },
      { label: 'Remaining Value', value: formatCurrency(paymentTotals.displayedRemainingAmount, locale), kind: 'money' },
      { label: 'Installments', value: installmentSummary(unit, installments, locale) },
    )

    if (unit.installmentType === 'custom') {
      rows.push({ label: translate(locale, 'details.customInstallmentText'), value: unit.customInstallmentText || translate(locale, 'details.customInstallmentMessage') })
    }
  }

  rows.push({ label: translate(locale, 'details.maintenancePaid'), value: unit.maintenancePaid ? translate(locale, 'common.yes') : translate(locale, 'common.no') })

  if (unit.maintenancePaid) {
    rows.push(
      { label: translate(locale, 'details.maintenanceCost'), value: formatNullableCurrency(unit.maintenanceCost, locale), kind: 'money' },
      { label: translate(locale, 'details.maintenanceDueDate'), value: formatNullableDate(unit.maintenanceDueDate, locale) },
    )
  }

  rows.push({ label: 'Delivery Expectancy', value: formatDeliveryExpectancy(unit, locale) })

  if (canIncludeSalesExportData(user, unit)) {
    rows.push({ label: translate(locale, 'export.commission'), value: `${formatCurrency(unit.commissionAmount, locale)} (${unit.commissionPercentage}%)`, kind: 'money' })
  }
  rows.push({ label: translate(locale, 'details.transferFees'), value: formatTransferFees(unit.transferFees, locale), kind: unit.transferFees == null ? undefined : 'money' })

  return { rows: rows.filter((row) => Boolean(row.value)) }
}

type PdfDetailRow = {
  label: string
  value: string
  kind?: 'hero' | 'money'
}

type PdfPalette = {
  paper: ReturnType<typeof rgb>
  linen: ReturnType<typeof rgb>
  charcoal: ReturnType<typeof rgb>
  slate: ReturnType<typeof rgb>
  muted: ReturnType<typeof rgb>
  gold: ReturnType<typeof rgb>
  goldSoft: ReturnType<typeof rgb>
  white: ReturnType<typeof rgb>
}

type MeasuredDetailRow = {
  row?: PdfDetailRow
  height: number
  labelLines: string[]
  valueLines: string[]
  labelSize: number
  valueSize: number
  labelFont: PDFFont
  valueFont: PDFFont
  valueColor: ReturnType<typeof rgb>
}

const palette: PdfPalette = {
  paper: rgb(0.965, 0.945, 0.918),
  linen: rgb(0.937, 0.906, 0.867),
  charcoal: rgb(0.165, 0.149, 0.137),
  slate: rgb(0.059, 0.106, 0.176),
  muted: rgb(0.49, 0.455, 0.408),
  gold: rgb(0.839, 0.69, 0.435),
  goldSoft: rgb(0.906, 0.788, 0.557),
  white: rgb(1, 0.98, 0.941),
}

function drawCoverPage(
  page: PDFPage,
  options: {
    font: PDFFont
    bold: PDFFont
    logo: PDFImage | null
    thumbnail: PDFImage | null
    settings: AppSettings
    unit: LeadraUnit
    rows: PdfDetailRow[]
  },
) {
  const { font, bold, logo, thumbnail, settings, unit, rows } = options
  const { width, height } = page.getSize()

  page.drawRectangle({ x: 0, y: 0, width, height, color: palette.paper })
  page.drawRectangle({ x: 0, y: height - 196, width, height: 196, color: palette.slate })
  page.drawRectangle({ x: 34, y: height - 196, width: 7, height: 196, color: palette.gold })
  page.drawRectangle({ x: 42, y: height - 784, width: 1.2, height: 572, color: palette.goldSoft })

  if (logo) {
    const scaled = logo.scaleToFit(128, 56)
    page.drawImage(logo, { x: 46, y: height - 76, width: scaled.width, height: scaled.height })
  } else {
    drawPdfText(page, settings.companyName || 'Leadra', { x: 48, y: height - 62, size: 17, font: bold, color: palette.white, maxWidth: 150 })
  }

  drawPdfText(page, unit.unitCode, { x: 48, y: height - 145, size: 30, font: bold, color: palette.white, maxWidth: 275 })
  drawPdfText(page, `${unit.destinationName} / ${unit.projectName}`, { x: 50, y: height - 166, size: 10, font, color: palette.linen, maxWidth: 285 })

  const thumbnailBox = { x: 348, y: height - 172, width: 198, height: 112 }
  drawCoverThumbnail(page, thumbnailBox.x, thumbnailBox.y, thumbnailBox.width, thumbnailBox.height, thumbnail, {
    font,
    emptyBody: 'Select an image marked Show in PDF',
  })

  const leftRows = rows.slice(0, 14)
  const rightRows = rows.slice(14)
  drawDetailColumns(page, leftRows, rightRows, { y: height - 232, font, bold })

  drawPdfText(page, `${settings.footerText}${settings.contactDetails ? ` / ${settings.contactDetails}` : ''}`, {
    x: 62,
    y: 32,
    size: 7.5,
    font,
    color: palette.muted,
    maxWidth: 470,
  })
}

function drawDetailColumns(
  page: PDFPage,
  leftRows: PdfDetailRow[],
  rightRows: PdfDetailRow[],
  options: { y: number; font: PDFFont; bold: PDFFont },
) {
  let y = options.y
  const count = Math.max(leftRows.length, rightRows.length)

  for (let index = 0; index < count; index += 1) {
    const left = measureDetailRow(leftRows[index], { labelWidth: 104, valueWidth: 178, font: options.font, bold: options.bold })
    const right = measureDetailRow(rightRows[index], { labelWidth: 106, valueWidth: 116, font: options.font, bold: options.bold })
    const rowHeight = Math.max(21, left.height, right.height)

    if (left.row) {
      drawMeasuredDetailRow(page, left, { x: 62, y, labelWidth: 104, valueWidth: 178 })
      page.drawLine({ start: { x: 62, y: y - rowHeight + 10 }, end: { x: 344, y: y - rowHeight + 10 }, thickness: 0.35, color: rgb(0.83, 0.78, 0.71) })
    }
    if (right.row) {
      drawMeasuredDetailRow(page, right, { x: 326, y, labelWidth: 106, valueWidth: 116 })
      page.drawLine({ start: { x: 326, y: y - rowHeight + 10 }, end: { x: 548, y: y - rowHeight + 10 }, thickness: 0.35, color: rgb(0.83, 0.78, 0.71) })
    }

    y -= rowHeight
  }
}

function measureDetailRow(
  row: PdfDetailRow | undefined,
  options: { labelWidth: number; valueWidth: number; font: PDFFont; bold: PDFFont },
): MeasuredDetailRow {
  if (!row) return { height: 21, labelLines: [], valueLines: [], labelSize: 6.8, valueSize: 9, labelFont: options.bold, valueFont: options.font, valueColor: palette.charcoal }

  const labelSize = 6.8
  const valueSize = row.kind === 'hero' ? 11 : 9
  const labelFont = options.bold
  const valueFont = row.kind ? options.bold : options.font
  const labelLines = wrapPdfText(row.label.toUpperCase(), labelFont, labelSize, options.labelWidth)
  const valueLines = wrapPdfText(row.value, valueFont, valueSize, options.valueWidth)
  const lineCount = Math.max(labelLines.length, valueLines.length)
  return {
    row,
    height: Math.max(21, lineCount * 11 + 10),
    labelLines,
    valueLines,
    labelSize,
    valueSize,
    labelFont,
    valueFont,
    valueColor: row.kind === 'money' || row.kind === 'hero' ? palette.slate : palette.charcoal,
  }
}

function drawMeasuredDetailRow(
  page: PDFPage,
  measured: MeasuredDetailRow,
  options: { x: number; y: number; labelWidth: number; valueWidth: number },
) {
  drawWrappedPdfText(page, measured.labelLines, { x: options.x, y: options.y, size: measured.labelSize, font: measured.labelFont, color: palette.muted })
  drawWrappedPdfText(page, measured.valueLines, { x: options.x + options.labelWidth, y: options.y - 1, size: measured.valueSize, font: measured.valueFont, color: measured.valueColor })
}

function drawCoverThumbnail(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  image: PDFImage | null,
  fallback: { font: PDFFont; emptyBody: string },
) {
  if (image) {
    const scaled = image.scaleToFit(width, height)
    page.drawImage(image, {
      x: x + (width - scaled.width) / 2,
      y: y + (height - scaled.height) / 2,
      width: scaled.width,
      height: scaled.height,
    })
    return
  }

  drawPdfText(page, fallback.emptyBody, { x, y: y + height / 2 - 2, size: 7.5, font: fallback.font, color: palette.linen, maxWidth: width })
}

async function drawImagePage(
  page: PDFPage,
  options: { pdf: PDFDocument; font: PDFFont; bold: PDFFont; unitCode: string; images: LeadraUnit['media']; pageNumber: number },
) {
  const { font, bold, unitCode, images } = options
  const { width, height } = page.getSize()
  page.drawRectangle({ x: 0, y: 0, width, height, color: palette.paper })
  page.drawRectangle({ x: 0, y: height - 86, width, height: 86, color: palette.slate })
  page.drawRectangle({ x: 42, y: height - 86, width: 6, height: 86, color: palette.gold })
  drawPdfText(page, `Unit images / ${unitCode}`, { x: 62, y: height - 54, size: 18, font: bold, color: palette.white })
  drawPdfText(page, `Page ${options.pageNumber}`, { x: 488, y: height - 54, size: 8, font: bold, color: palette.goldSoft })

  const boxes = [
    { x: 42, y: 438, width: 511, height: 290 },
    { x: 42, y: 118, width: 511, height: 290 },
  ]

  for (const [index, file] of images.entries()) {
    const box = boxes[index]
    if (!box) continue
    const embedded = await embedImage(options.pdf, file.url)
    drawImageFrame(page, box.x, box.y, box.width, box.height, embedded, {
      font,
      bold,
      emptyTitle: 'Image unavailable',
      emptyBody: file.name,
    })
    drawPdfText(page, file.name, { x: box.x + 14, y: box.y + 14, size: 8, font, color: palette.muted, maxWidth: box.width - 28 })
  }
}

function drawImageFrame(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  image: PDFImage | null,
  fallback: { font: PDFFont; bold: PDFFont; emptyTitle: string; emptyBody: string },
) {
  page.drawRectangle({ x, y, width, height, color: palette.linen })
  if (image) {
    const scaled = image.scaleToFit(width - 18, height - 18)
    page.drawImage(image, {
      x: x + (width - scaled.width) / 2,
      y: y + (height - scaled.height) / 2,
      width: scaled.width,
      height: scaled.height,
    })
    return
  }

  drawPdfText(page, fallback.emptyTitle, { x: x + 18, y: y + height / 2 + 8, size: 9, font: fallback.bold, color: palette.slate, maxWidth: width - 36 })
  drawPdfText(page, fallback.emptyBody, { x: x + 18, y: y + height / 2 - 8, size: 7.5, font: fallback.font, color: palette.muted, maxWidth: width - 36 })
}

function installmentSummary(unit: LeadraUnit, installments: ReturnType<typeof buildPaymentTimetable>, locale: LocaleCode) {
  if (unit.installmentType === 'custom') return unit.customInstallmentText || translate(locale, 'details.customInstallmentMessage')
  const next = installments.find((row) => !row.paid)
  if (next) {
    const amount = formatCurrency(next.amount, locale)
    return next.dueMonth ? `${next.periodLabel}: ${amount}` : amount
  }
  if (unit.installmentAmount != null) return formatCurrency(unit.installmentAmount, locale)
  return 'No scheduled installments'
}

function formatNullableCurrency(value: number | null | undefined, locale: LocaleCode) {
  return value == null ? '' : formatCurrency(value, locale)
}

function formatTransferFees(value: number | null | undefined, locale: LocaleCode) {
  return value == null ? translate(locale, 'details.transferFeesNotice') : formatCurrency(value, locale)
}

function formatNullableDate(value: string | null | undefined, locale: LocaleCode) {
  if (!value) return ''
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(year, month - 1, day))
}

function formatArea(value: number) {
  return `${value} m2`
}

function formatOptionalArea(value: number | null | undefined) {
  return value == null ? '' : formatArea(value)
}

function formatPdfExportDate(date: Date) {
  const month = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(date)
  return `${month}${date.getUTCDate()}`
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

export async function shareGeneratedPdfs(pdfs: GeneratedPdf[]): Promise<boolean> {
  const files = pdfs.map((pdf) => new File([pdf.blob], pdf.fileName, { type: 'application/pdf' }))
  if (files.length > 0 && navigator.canShare?.({ files }) && navigator.share) {
    await navigator.share({
      files,
      title: `${files.length} Leadra unit PDF${files.length === 1 ? '' : 's'}`,
      text: `Leadra unit PDF${files.length === 1 ? '' : 's'}`,
    })
    return true
  }
  return false
}

async function embedImage(pdf: PDFDocument, url: string, options: { allowPngFallback?: boolean } = {}) {
  try {
    const bytes = await imageBytes(url)
    if (!bytes) return null

    if (isJpegImage(url, bytes)) {
      const directJpeg = await embedImageWithTimeout(() => pdf.embedJpg(bytes))
      if (directJpeg) return directJpeg
    }

    const jpegBytes = await rasterizeImageToJpegBytes(url)
    if (jpegBytes) {
      const rasterizedJpeg = await embedImageWithTimeout(() => pdf.embedJpg(jpegBytes))
      if (rasterizedJpeg) return rasterizedJpeg
    }

    if (options.allowPngFallback && isPngImage(url, bytes)) return await embedImageWithTimeout(() => pdf.embedPng(bytes))
    return null
  } catch {
    return null
  }
}

async function embedImageWithTimeout(factory: () => Promise<PDFImage>, timeoutMs = 1200): Promise<PDFImage | null> {
  let timeoutId: number | undefined
  try {
    return await Promise.race([
      factory(),
      new Promise<null>((resolve) => {
        timeoutId = window.setTimeout(() => resolve(null), timeoutMs)
      }),
    ])
  } catch {
    return null
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId)
  }
}

function isPngImage(url: string, bytes: Uint8Array): boolean {
  return (
    url.includes('image/png') ||
    url.toLowerCase().endsWith('.png') ||
    (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
  )
}

function isJpegImage(url: string, bytes: Uint8Array): boolean {
  return (
    url.includes('image/jpeg') ||
    url.includes('image/jpg') ||
    /\.(jpe?g)(?:[?#].*)?$/i.test(url) ||
    (bytes[0] === 0xff && bytes[1] === 0xd8)
  )
}

async function rasterizeImageToJpegBytes(url: string): Promise<Uint8Array | null> {
  if (url.startsWith('data:image/png')) return null
  if (typeof Image === 'undefined' || typeof document === 'undefined') return null

  const image = new Image()
  image.crossOrigin = 'anonymous'
  const loaded = new Promise<HTMLImageElement | null>((resolve) => {
    const timeout = window.setTimeout(() => resolve(null), 1500)
    image.onload = () => {
      window.clearTimeout(timeout)
      resolve(image)
    }
    image.onerror = () => {
      window.clearTimeout(timeout)
      resolve(null)
    }
  })
  image.src = url
  const decoded = await loaded
  if (!decoded) return null
  const canvas = document.createElement('canvas')
  canvas.width = decoded.naturalWidth || decoded.width
  canvas.height = decoded.naturalHeight || decoded.height
  const context = canvas.getContext('2d')
  if (!context || canvas.width <= 0 || canvas.height <= 0) return null
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(decoded, 0, 0)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88))
  return blob ? new Uint8Array(await blob.arrayBuffer()) : null
}

function drawPdfText(
  page: PDFPage,
  text: string,
  options: { x: number; y: number; size: number; font: PDFFont; color: ReturnType<typeof rgb>; maxWidth?: number },
) {
  page.drawText(toWinAnsiText(text), options)
}

function drawWrappedPdfText(
  page: PDFPage,
  lines: string[],
  options: { x: number; y: number; size: number; font: PDFFont; color: ReturnType<typeof rgb> },
) {
  lines.forEach((line, index) => {
    page.drawText(toWinAnsiText(line), {
      x: options.x,
      y: options.y - index * 11,
      size: options.size,
      font: options.font,
      color: options.color,
    })
  })
}

function wrapPdfText(value: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = toWinAnsiText(value).split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate
      continue
    }
    if (current) lines.push(current)
    current = word
  }

  if (current) lines.push(current)
  return lines.length > 0 ? lines : ['']
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

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 4000)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) return null
    return new Uint8Array(await response.arrayBuffer())
  } catch {
    return null
  } finally {
    window.clearTimeout(timeout)
  }
}

function canIncludeSalesExportData(user: LeadraUser, unit: LeadraUnit) {
  return canViewSalesSensitiveData(user, unit)
}
