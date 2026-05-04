import { formatCurrency, formatDeliveryExpectancy, sanitizeUnitForPdf } from './domain'
import { getPaymentMethodLabel, isRtlLocale, translate, type LocaleCode } from './i18n'
import type { AppSettings, LeadraMediaFile, LeadraUnit, LeadraUser } from './types'

export function buildPrintableUnitBriefText(
  user: LeadraUser,
  unit: LeadraUnit,
  settings: AppSettings,
  locale: LocaleCode,
): string {
  const safeUnit = sanitizeUnitForPdf(user, unit)
  const includeSalesData = canIncludeSalesExportData(user, unit)

  const lines = [
    translate(locale, 'export.title', { companyName: settings.companyName }),
    `${translate(locale, 'export.generatedBy')}: ${user.fullName}`,
    `${translate(locale, 'units.unitCode')}: ${safeUnit.unitCode}`,
    `${translate(locale, 'export.project')}: ${safeUnit.projectName}`,
    `${translate(locale, 'export.destination')}: ${safeUnit.destinationName}`,
    `${translate(locale, 'export.type')}: ${safeUnit.unitType} / ${safeUnit.floor}`,
    `${translate(locale, 'export.area')}: ${safeUnit.bua}`,
    `${translate(locale, 'export.bedsBaths')}: ${safeUnit.bedrooms} / ${safeUnit.bathrooms}`,
    `${translate(locale, 'export.totalAmount')}: ${formatCurrency(safeUnit.totalAmount, locale)}`,
    `${translate(locale, 'export.paymentMethod')}: ${getPaymentMethodLabel(locale, safeUnit.paymentMethod)}`,
    `${translate(locale, 'export.installment')}: ${formatCurrency(safeUnit.installmentAmount, locale)}`,
    `${translate(locale, 'export.delivery')}: ${formatDeliveryExpectancy(safeUnit, locale)}`,
    `${translate(locale, 'export.contact')}: ${settings.contactDetails}`,
    includeSalesData ? safeUnit.salesNotes || translate(locale, 'export.notesEmpty') : translate(locale, 'export.notesEmpty'),
    settings.footerText,
  ]
  if (includeSalesData) {
    lines.splice(10, 0, `${translate(locale, 'export.commission')}: ${formatCurrency(safeUnit.commissionAmount, locale)}`)
  }
  return lines.join('\n')
}

export function buildPermissionSafePdfText(
  user: LeadraUser,
  unit: LeadraUnit,
  settings: AppSettings,
  locale: LocaleCode = 'en',
): string {
  return buildPrintableUnitBriefText(user, unit, settings, locale)
}

export async function buildPermissionSafePdfBlob(
  user: LeadraUser,
  unit: LeadraUnit,
  settings: AppSettings,
  locale: LocaleCode = 'en',
): Promise<Blob> {
  return new Blob([buildPrintableUnitBriefHtml(user, unit, settings, locale)], {
    type: 'text/html;charset=utf-8',
  })
}

export function buildPrintableUnitBriefHtml(
  user: LeadraUser,
  unit: LeadraUnit,
  settings: AppSettings,
  locale: LocaleCode,
): string {
  const safeUnit = sanitizeUnitForPdf(user, unit)
  const includeSalesData = canIncludeSalesExportData(user, unit)
  const rtl = isRtlLocale(locale)
  const sections = [
    [translate(locale, 'export.project'), safeUnit.projectName],
    [translate(locale, 'export.destination'), safeUnit.destinationName],
    [translate(locale, 'export.type'), `${safeUnit.unitType} / ${safeUnit.floor}`],
    [translate(locale, 'export.area'), `${safeUnit.bua}`],
    [translate(locale, 'export.bedsBaths'), `${safeUnit.bedrooms} / ${safeUnit.bathrooms}`],
    [translate(locale, 'export.delivery'), formatDeliveryExpectancy(safeUnit, locale)],
    [translate(locale, 'export.totalAmount'), formatCurrency(safeUnit.totalAmount, locale)],
    [translate(locale, 'export.paymentMethod'), getPaymentMethodLabel(locale, safeUnit.paymentMethod)],
    [translate(locale, 'export.installment'), formatCurrency(safeUnit.installmentAmount, locale)],
    [translate(locale, 'export.generatedBy'), user.fullName],
    [translate(locale, 'export.contact'), settings.contactDetails || translate(locale, 'common.notSet')],
  ]
  if (includeSalesData) {
    sections.splice(7, 0, [translate(locale, 'export.commission'), `${formatCurrency(safeUnit.commissionAmount, locale)} (${safeUnit.commissionPercentage}%)`])
  }

  const imageCards =
    safeUnit.media.filter((file) => file.type === 'image').map(renderImageCard).join('') ||
    `<p class="empty-note">${escapeHtml(translate(locale, 'export.noImages'))}</p>`

  const sectionRows = sections
    .map(
      ([label, value]) => `
        <div class="fact-row">
          <dt>${escapeHtml(label)}</dt>
          <dd dir="auto">${escapeHtml(String(value || translate(locale, 'common.notSet')))}</dd>
        </div>`,
    )
    .join('')

  return `<!doctype html>
<html lang="${locale === 'ar' ? 'ar-EG' : 'en-EG'}" dir="${rtl ? 'rtl' : 'ltr'}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(translate(locale, 'export.printTitle', { unitCode: safeUnit.unitCode }))}</title>
    <style>
      :root {
        color-scheme: light;
        --ink: #14211d;
        --olive: #4d6b56;
        --copper: #b5653f;
        --sand: #f0dcc0;
        --paper: #fffdf8;
        --line: #d9d1c5;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Segoe UI", Tahoma, Arial, sans-serif;
        background: var(--paper);
        color: var(--ink);
      }
      main {
        max-width: 960px;
        margin: 0 auto;
        padding: 32px 24px 48px;
      }
      .hero {
        background: linear-gradient(135deg, rgba(20,33,29,0.96), rgba(77,107,86,0.88));
        color: #fffaf0;
        border-radius: 24px;
        padding: 28px;
      }
      .eyebrow {
        margin: 0 0 8px;
        color: var(--sand);
        letter-spacing: 0.12em;
        text-transform: uppercase;
        font-size: 12px;
        font-weight: 800;
      }
      h1, h2, h3, p { margin: 0; }
      h1 {
        font-size: 34px;
        margin-block: 8px 12px;
      }
      .hero-grid {
        display: grid;
        gap: 16px;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }
      .hero-chip {
        padding: 12px 14px;
        border-radius: 18px;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.12);
      }
      .section {
        margin-top: 24px;
        padding: 20px;
        border: 1px solid var(--line);
        border-radius: 20px;
        background: #ffffff;
      }
      .section h2 {
        margin-bottom: 16px;
        font-size: 20px;
      }
      dl {
        margin: 0;
        display: grid;
        gap: 14px;
      }
      .fact-row {
        display: grid;
        gap: 6px;
        padding-bottom: 12px;
        border-bottom: 1px solid rgba(20,33,29,0.08);
      }
      .fact-row:last-child {
        border-bottom: 0;
        padding-bottom: 0;
      }
      dt {
        color: var(--olive);
        font-size: 13px;
        font-weight: 700;
      }
      dd {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }
      .notes {
        white-space: pre-wrap;
        line-height: 1.7;
      }
      .image-grid {
        display: grid;
        gap: 14px;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }
      .image-card {
        border: 1px solid var(--line);
        border-radius: 18px;
        overflow: hidden;
        background: #fffdf8;
      }
      .image-card img {
        display: block;
        width: 100%;
        aspect-ratio: 4 / 3;
        object-fit: cover;
        background: #f3efe8;
      }
      .image-card span {
        display: block;
        padding: 10px 12px 12px;
        font-size: 13px;
        color: var(--olive);
      }
      .footer {
        margin-top: 22px;
        color: var(--olive);
        font-size: 13px;
      }
      .empty-note {
        color: var(--olive);
      }
      @media print {
        body { background: #fff; }
        main { padding: 0; }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <p class="eyebrow">${escapeHtml(translate(locale, 'export.subtitle'))}</p>
        <h1 dir="auto">${escapeHtml(settings.companyName)}</h1>
        <div class="hero-grid">
          <div class="hero-chip">
            <strong>${escapeHtml(safeUnit.unitCode)}</strong>
          </div>
          <div class="hero-chip" dir="auto">${escapeHtml(safeUnit.projectName)}</div>
          <div class="hero-chip">${escapeHtml(getPaymentMethodLabel(locale, safeUnit.paymentMethod))}</div>
        </div>
      </section>

      <section class="section">
        <h2>${escapeHtml(translate(locale, 'export.sectionOverview'))}</h2>
        <dl>${sectionRows}</dl>
      </section>

      <section class="section">
        <h2>${escapeHtml(translate(locale, 'export.sectionNotes'))}</h2>
        <p class="notes" dir="auto">${escapeHtml(includeSalesData ? safeUnit.salesNotes || translate(locale, 'export.notesEmpty') : translate(locale, 'export.notesEmpty'))}</p>
      </section>

      <section class="section">
        <h2>${escapeHtml(translate(locale, 'export.sectionImages'))}</h2>
        <div class="image-grid">${imageCards}</div>
      </section>

      <p class="footer" dir="auto">${escapeHtml(settings.footerText)}${settings.contactDetails ? ` / ${escapeHtml(settings.contactDetails)}` : ''}</p>
    </main>
  </body>
</html>`
}

export async function downloadUnitPdf(
  user: LeadraUser,
  unit: LeadraUnit,
  settings: AppSettings,
  locale: LocaleCode = 'en',
): Promise<void> {
  const popup = window.open('', '_blank')
  if (!popup) throw new Error('Unable to open print preview window.')

  popup.document.open()
  popup.document.write(buildPrintableUnitBriefHtml(user, unit, settings, locale))
  popup.document.close()
  popup.opener = null

  void waitForImages(popup.document, 700).then(() => {
    if (popup.closed) return
    popup.focus()
    popup.print()
  })
}

function renderImageCard(file: LeadraMediaFile) {
  return `<figure class="image-card"><img src="${escapeAttribute(file.url)}" alt="${escapeAttribute(file.name)}" /><span dir="auto">${escapeHtml(file.name)}</span></figure>`
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function escapeAttribute(value: string): string {
  return escapeHtml(value)
}

function canIncludeSalesExportData(user: LeadraUser, unit: LeadraUnit) {
  return user.role !== 'sales' || unit.createdBy === user.id
}

async function waitForImages(document: Document, timeoutMs: number): Promise<void> {
  const images = Array.from(document.images)
  if (images.length === 0) return
  await Promise.race([
    Promise.all(
      images.map(
        (image) =>
          new Promise<void>((resolve) => {
            if (image.complete) {
              resolve()
              return
            }

            image.addEventListener('load', () => resolve(), { once: true })
            image.addEventListener('error', () => resolve(), { once: true })
          }),
      ),
    ),
    new Promise((resolve) => window.setTimeout(resolve, timeoutMs)),
  ])
}
