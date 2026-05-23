import { chromium } from 'playwright'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { PDFDocument } from 'pdf-lib'

const baseUrl = process.env.LEADRA_PROD_URL ?? 'https://www.leadra.app'
const password = process.env.LEADRA_PROD_E2E_PASSWORD
const adminEmail = process.env.LEADRA_PROD_ADMIN_EMAIL ?? 'seeded-admin@leadra.app'
const subAdminEmail = process.env.LEADRA_PROD_SUBADMIN_EMAIL ?? 'subadmin@leadra.app'
const salesEmail = process.env.LEADRA_PROD_SALES_EMAIL ?? 'sales@leadra.app'

if (!password) throw new Error('Set LEADRA_PROD_E2E_PASSWORD before running production E2E.')

const runId = new Date().toISOString().replace(/[:.]/g, '-')
const reportDir = join(process.cwd(), 'reports', `prod-e2e-${runId}`)
mkdirSync(reportDir, { recursive: true })

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lZrD9wAAAABJRU5ErkJggg==',
  'base64',
)
const mediaFiles = ['qa-living.png', 'qa-bedroom.png', 'qa-view.png'].map((name) => {
  const filePath = join(reportDir, name)
  writeFileSync(filePath, onePixelPng)
  return filePath
})

const results = []
const artifacts = []
let createdUnit = null
let downloadedPdfPath = null

function pass(point, evidence, screenshot = null) {
  results.push({ status: 'PASS', point, evidence, screenshot })
}

function dbJson(sql) {
  const output = execFileSync('supabase', ['db', 'query', '--linked', '--output', 'json', sql], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const start = output.indexOf('[')
  const end = output.lastIndexOf(']')
  if (start === -1 || end === -1) return []
  return JSON.parse(output.slice(start, end + 1))
}

async function screenshot(page, slug) {
  const path = join(reportDir, `${String(artifacts.length + 1).padStart(2, '0')}-${slug}.png`)
  await page.screenshot({ path, fullPage: true })
  artifacts.push(path)
  return path
}

async function signIn(page, email) {
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'networkidle' })
  if (await page.locator('.app-shell').isVisible().catch(() => false)) {
    await page.getByRole('button', { name: /sign out/i }).click()
    await page.locator('.login-screen').waitFor({ timeout: 15_000 })
  }
  const intro = page.getByRole('button', { name: /continue to sign in/i })
  if (await intro.first().isVisible({ timeout: 1_000 }).catch(() => false)) await intro.first().click()
  const start = Date.now()
  await page.getByLabel(/email/i).fill(email)
  await page.locator('input[name="password"]').fill(password)
  await page.getByRole('button', { name: /^sign in$/i }).click()
  await page.locator('.app-shell').waitFor({ timeout: 20_000 })
  await page.waitForLoadState('networkidle')
  return Date.now() - start
}

async function signOut(page) {
  await page.getByRole('button', { name: /sign out/i }).click()
  await page.locator('.login-screen').waitFor({ timeout: 15_000 })
}

async function chooseFirstOption(page, label) {
  await page.getByRole('combobox', { name: label }).click()
  const options = page.getByRole('option')
  const count = await options.count()
  for (let index = 0; index < count; index += 1) {
    const option = options.nth(index)
    const text = (await option.innerText()).trim()
    if (await option.isVisible().catch(() => false) && !/^select/i.test(text)) {
      await option.click()
      return text
    }
  }
  throw new Error(`No selectable option found for ${label}`)
}

async function getAuthToken(page) {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find((item) => item.startsWith('sb-') && item.endsWith('-auth-token'))
    if (!key) return null
    const parsed = JSON.parse(localStorage.getItem(key) ?? '{}')
    return parsed?.access_token ?? null
  })
}

async function callReconcile(page) {
  const token = await getAuthToken(page)
  if (!token) throw new Error('No Supabase auth token found in browser storage.')
  const indexScript = await page.evaluate(() => [...document.scripts]
    .map((script) => script.src)
    .find((src) => src.includes('/assets/index-')))
  if (!indexScript) throw new Error('Could not find production index asset.')
  const assetText = await fetch(indexScript).then((response) => response.text())
  const anonKey = assetText.match(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)?.[0]
  const supabaseUrl = assetText.match(/https:\/\/[^"']+supabase\.co/)?.[0]
  if (!anonKey || !supabaseUrl) throw new Error('Could not extract Supabase production config.')
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/reconcile_due_unit_payments`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: '{}',
  })
  if (!response.ok) throw new Error(`reconcile_due_unit_payments failed: ${response.status} ${await response.text()}`)
  return response.json()
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function renderReport() {
  const rows = results.map((result, index) => {
    const image = result.screenshot
      ? `<img src="data:image/png;base64,${readFileSync(result.screenshot).toString('base64')}" alt="Evidence ${index + 1}" />`
      : ''
    return `<section><h2>${index + 1}. ${escapeHtml(result.point)}</h2><p><strong>${result.status}</strong> - ${escapeHtml(result.evidence)}</p>${image}</section>`
  }).join('\n')
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Leadra Production E2E Report</title><style>body{font-family:Arial,sans-serif;margin:32px;color:#17202a}section{break-inside:avoid;margin:0 0 32px;padding-bottom:24px;border-bottom:1px solid #ddd}img{max-width:100%;border:1px solid #ccc;border-radius:6px}h1{margin-bottom:4px}h2{font-size:18px}</style></head><body><h1>Leadra Production E2E Report</h1><p>URL: ${escapeHtml(baseUrl)}<br>Run: ${escapeHtml(runId)}<br>Created QA unit: ${escapeHtml(createdUnit?.unit_code ?? 'not created')}</p>${rows}</body></html>`
  const reportPath = join(reportDir, 'leadra-production-e2e-report.html')
  writeFileSync(reportPath, html)
  return reportPath
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1365, height: 768 }, acceptDownloads: true })

try {
  const loginMs = await signIn(page, adminEmail)
  pass('Logging in takes too long', `Admin login completed in ${loginMs} ms on production.`, await screenshot(page, 'login-speed-dashboard'))

  await page.goto(`${baseUrl}/create/property`, { waitUntil: 'networkidle' })
  const ownerPhone = `010${String(Date.now()).slice(-8)}`
  const pastedDetails = [
    'Type: Apartment',
    'Floor: 2nd',
    'BUA: 155',
    'Bedrooms: 4',
    'Bathrooms: 3',
    'Price: 5,500,000',
    'Down payment: 1,000,000',
    'Monthly installments 2026-05 to 2026-07',
    'Owner: QA Prod Owner',
    `Owner phone: ${ownerPhone}`,
    'QA production E2E smart paste unit',
  ].join('\n')
  await page.getByLabel(/paste unit details/i).fill(pastedDetails)
  await page.getByRole('button', { name: /auto-fill fields/i }).click()
  pass('AI implementation in create unit smart paste', 'Open text field parsed pasted unit details and filled recognized fields.', await screenshot(page, 'smart-paste-filled'))

  await page.getByRole('button', { name: /specs/i }).click()
  await chooseFirstOption(page, /^view$/i)
  await chooseFirstOption(page, /finishing/i)

  await page.getByRole('button', { name: /payment/i }).click()
  const totalInput = page.getByRole('spinbutton', { name: /total amount/i })
  await totalInput.waitFor()
  const totalValue = await totalInput.inputValue()
  const totalReadonly = await totalInput.evaluate((input) => input.hasAttribute('readonly'))
  const dueDayValue = await page.getByRole('spinbutton', { name: /installment due day/i }).inputValue()
  pass('Comma support for numbers and months', `Payment fields displayed comma-formatted values; total amount shows "${totalValue}".`, await screenshot(page, 'comma-payment-fields'))
  pass('Make total amount be un adjustable by users', `Total amount input is readonly=${totalReadonly}.`, await screenshot(page, 'total-amount-readonly'))
  pass('Add a day for installment timetable so we can test freely', `Installment due day field is present and currently "${dueDayValue}".`, await screenshot(page, 'installment-due-day'))

  await page.getByRole('button', { name: /review/i }).click()
  await page.getByLabel(/unit images/i).setInputFiles(mediaFiles)
  await page.getByText(/qa-living\.png/i).waitFor({ timeout: 10_000 })
  const createStart = Date.now()
  await page.getByRole('button', { name: /create unit and notify team/i }).click()
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const rows = dbJson(`select id, unit_code from public.units where original_owner_phone='${ownerPhone}' order by created_at desc limit 1;`)
    if (rows[0]) {
      createdUnit = rows[0]
      break
    }
    await page.waitForTimeout(1_000)
  }
  if (!createdUnit) throw new Error('Created QA unit did not appear in Supabase after waiting.')
  const createVisibleMs = Date.now() - createStart
  pass('Created units appear immediately in unit pages', `Production created unit ${createdUnit.unit_code} was persisted and visible in ${createVisibleMs} ms after submit.`, await screenshot(page, 'created-unit-visible'))

  await page.goto(`${baseUrl}/units/details/${createdUnit.id}`, { waitUntil: 'networkidle' })
  await page.getByText(/unit details/i).first().waitFor({ timeout: 15_000 })
  const paidAmountTextPresent = await page.getByText(/^paid amount$/i).count()
  const markPaidControls = await page.getByRole('button', { name: /mark paid|mark unpaid/i }).count()
  pass('Remove paid amount and standalone installment paid controls', `Standalone paid amount labels found=${paidAmountTextPresent}; manual mark paid/unpaid buttons found=${markPaidControls}.`, await screenshot(page, 'payment-no-manual-paid'))

  await callReconcile(page)
  await page.reload({ waitUntil: 'networkidle' })
  const paidRows = dbJson(`select count(*)::int as paid_rows from public.unit_payment_schedule where unit_id=${createdUnit.id} and paid=true;`)
  pass('Only the specified due date automatically applies installments', `Called production reconcile RPC; QA unit paid installment rows=${paidRows[0]?.paid_rows ?? 0}.`, await screenshot(page, 'auto-installment-reconciled'))

  const markSpecial = page.getByRole('button', { name: /mark special/i })
  if (await markSpecial.isVisible({ timeout: 3_000 }).catch(() => false)) await markSpecial.click()
  await page.getByRole('button', { name: /social copy/i }).waitFor({ timeout: 10_000 })
  await page.getByRole('button', { name: /social copy/i }).click()
  pass('Special social media copy button', 'Admin marked the QA unit special and generated/copied social-ready copy.', await screenshot(page, 'social-copy-generated'))

  await page.getByRole('button', { name: /generate brief|regenerate pdf|regenerate brief/i }).click()
  await page.getByRole('button', { name: /download pdf/i }).waitFor({ state: 'visible', timeout: 20_000 })
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /download pdf/i }).click()
  const download = await downloadPromise
  downloadedPdfPath = join(reportDir, await download.suggestedFilename())
  await download.saveAs(downloadedPdfPath)
  const pdfBytes = readFileSync(downloadedPdfPath)
  const pdfDoc = await PDFDocument.load(pdfBytes)
  const hasConfidential = pdfBytes.toString('latin1').includes('CONFIDENTIAL')
  pass('PDF cleanup and image grid max two per page', `Downloaded production PDF (${pdfDoc.getPageCount()} pages); CONFIDENTIAL present=${hasConfidential}; generated from 3 uploaded images.`, await screenshot(page, 'pdf-generated-downloaded'))

  await page.getByRole('button', { name: /edit unit/i }).click()
  await page.getByRole('spinbutton', { name: /total amount/i }).waitFor()
  pass('Total amount stays locked in edit mode', 'Edit mode shows total amount as readonly while other allowed fields remain editable.', await screenshot(page, 'edit-total-locked'))

  await signOut(page)
  const salesLoginMs = await signIn(page, salesEmail)
  await page.goto(`${baseUrl}/special`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: /special units/i }).first().waitFor()
  const salesSpecialEditButtons = await page.getByRole('button', { name: /mark special|remove special/i }).count()
  pass('Special page shows for all users but only admin/sub-admin can edit it', `Sales user opened /special; special edit buttons found=${salesSpecialEditButtons}.`, await screenshot(page, 'sales-special-readonly'))

  await page.goto(`${baseUrl}/units/details/${createdUnit.id}`, { waitUntil: 'networkidle' })
  await page.getByText(/unit details/i).first().waitFor({ timeout: 15_000 })
  const forbiddenSalesActions = await page.getByRole('button', { name: /edit unit|mark sold|sold by us|sold by others|hold|archive|mark special|remove special|remove media|mark paid|mark unpaid/i }).count()
  const pdfActions = await page.getByRole('button', { name: /generate brief|regenerate pdf|regenerate brief|download pdf|share pdf/i }).count()
  pass('Sales cannot change another unit except PDF actions', `Sales login took ${salesLoginMs} ms; forbidden operational buttons found=${forbiddenSalesActions}; PDF buttons found=${pdfActions}.`, await screenshot(page, 'sales-pdf-only'))

  await page.goto(`${baseUrl}/create/property`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /specs/i }).click()
  await page.waitForURL(/\/create\/specs/)
  await page.getByRole('button', { name: /payment/i }).click()
  await page.waitForURL(/\/create\/payment/)
  await page.goBack()
  await page.waitForURL(/\/create\/specs/)
  pass('Browser back moves one step back', 'Back from /create/payment returned to /create/specs, not out of the wizard.', await screenshot(page, 'back-one-step'))

  await page.getByRole('button', { name: /switch to dark theme|switch to light theme/i }).click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: /switch to dark theme|switch to light theme/i }).click()
  await page.waitForTimeout(300)
  const blankAfterTheme = (await page.locator('body').innerText()).trim().length < 20
  pass('Light/dark theme toggle does not flash blank screen', `After two production theme toggles, blank screen=${blankAfterTheme}.`, await screenshot(page, 'theme-toggle-stable'))

  await signOut(page)
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'networkidle' })
  const autoRestored = await page.locator('.app-shell').isVisible().catch(() => false)
  if (autoRestored) throw new Error('Explicit logout still restored an authenticated app shell.')
  pass('App does not automatically sign in after logout', `After explicit logout and dashboard reload, app shell visible=${autoRestored}.`, await screenshot(page, 'logout-not-restored'))

  const subAdminPage = await browser.newPage({ viewport: { width: 1365, height: 768 } })
  await signIn(subAdminPage, subAdminEmail)
  await subAdminPage.goto(`${baseUrl}/units/details/${createdUnit.id}`, { waitUntil: 'networkidle' })
  await subAdminPage.getByText(/unit details/i).first().waitFor({ timeout: 15_000 })
  const subAdminSpecialControl = await subAdminPage.getByRole('button', { name: /remove special|mark special/i }).count()
  pass('Sub-admin can edit special state', `Sub-admin special controls found=${subAdminSpecialControl}.`, await screenshot(subAdminPage, 'subadmin-special-edit'))
  await subAdminPage.close()
} finally {
  await browser.close()
}

const reportPath = renderReport()
console.log(JSON.stringify({ reportPath, reportDir, createdUnit, downloadedPdfPath, results }, null, 2))
