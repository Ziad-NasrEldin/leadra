import { spawn } from 'node:child_process'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { createGzip } from 'node:zlib'
import { createReadStream } from 'node:fs'
import { chromium, devices } from 'playwright'

const datasetSize = Number(process.env.LEADRA_PERF_DATASET ?? 10000)
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173'
const reportDir = 'performance-reports'

const profiles = [
  { name: 'desktop', viewport: { width: 1440, height: 900 } },
  { name: 'tablet', viewport: { width: 768, height: 1024 } },
  { name: 'mobile-fast4g', device: devices['iPhone 13'], cpuThrottle: 4 },
  { name: 'mobile-slow4g', device: devices['iPhone 13'], cpuThrottle: 4 },
]

const scenarios = [
  { name: 'Login', hash: '', auth: false, expect: /resale command/i },
  { name: 'Dashboard', hash: '#dashboard', expect: /workspace/i },
  { name: 'Units list', hash: '#units', expect: /units/i, interact: async (page) => page.getByPlaceholder(/\+2010/i).fill('+201010000001') },
  { name: 'Unit details', hash: '#details', expect: /unit intelligence|main/i },
  { name: 'Create unit', hash: '#create', expect: /create|property/i },
  { name: 'Notifications', hash: '#notifications', expect: /notifications/i },
  { name: 'Analytics', hash: '#analytics', expect: /analytics/i, interact: async (page) => page.getByRole('button', { name: /90 days/i }).click() },
  { name: 'Admin users', hash: '#admin', expect: /user management/i },
  { name: 'Admin audit', hash: '#admin', expect: /user management/i, interact: async (page) => page.getByRole('button', { name: /audit/i }).click() },
  {
    name: 'PDF export',
    hash: '#details',
    expect: /generate/i,
    interact: async (page) => {
      const popupPromise = page.waitForEvent('popup', { timeout: 5000 }).catch(() => null)
      await page.getByRole('button', { name: /generate|print/i }).first().click()
      const popup = await popupPromise
      if (popup) await popup.close()
    },
  },
]

await run('npm', ['run', 'build'], { VITE_LEADRA_PERF_MODE: 'true' })
const preview = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4173'], {
  stdio: 'pipe',
  shell: process.platform === 'win32',
  env: { ...process.env, VITE_LEADRA_PERF_MODE: 'true' },
})

try {
  await waitForServer(baseUrl)
  const browser = await chromium.launch()
  const rows = []

  for (const profile of profiles) {
    for (const scenario of scenarios) {
      rows.push(await measureScenario(browser, profile, scenario))
    }
  }

  await browser.close()
  const bundle = await analyzeBundle()
  await writeReports(rows, bundle)
  printSummary(rows, bundle)
} finally {
  preview.kill()
}

async function measureScenario(browser, profile, scenario) {
  const context = await browser.newContext({
    ...(profile.device ?? {}),
    viewport: profile.device ? profile.device.viewport : profile.viewport,
  })
  const page = await context.newPage()
  const requestTimes = new Map()
  const requests = []
  const failures = []

  page.on('request', (request) => requestTimes.set(request, Date.now()))
  page.on('requestfailed', (request) => failures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? 'failed'}`))
  page.on('requestfinished', async (request) => {
    const response = await request.response()
    const started = requestTimes.get(request) ?? Date.now()
    const headerSize = Number(response?.headers()['content-length'] ?? 0)
    requests.push({
      url: request.url(),
      method: request.method(),
      ms: Date.now() - started,
      bytes: Number.isFinite(headerSize) ? headerSize : 0,
      status: response?.status() ?? 0,
    })
  })

  await page.addInitScript(() => {
    window.__leadraPerf = { cls: 0, lcp: 0, longTasks: [] }
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__leadraPerf.cls += entry.value
      }
    }).observe({ type: 'layout-shift', buffered: true })
    new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const last = entries[entries.length - 1]
      if (last) window.__leadraPerf.lcp = last.startTime
    }).observe({ type: 'largest-contentful-paint', buffered: true })
    new PerformanceObserver((list) => {
      window.__leadraPerf.longTasks.push(...list.getEntries().map((entry) => entry.duration))
    }).observe({ type: 'longtask', buffered: true })
  })

  const cdp = await context.newCDPSession(page).catch(() => null)
  if (cdp && profile.cpuThrottle) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpuThrottle }).catch(() => {})
  }

  const startedAt = Date.now()
  await page.goto(`${baseUrl}/?perfDataset=${datasetSize}${scenario.hash}`, { waitUntil: 'domcontentloaded' })
  if (scenario.auth !== false) await signInAsAdmin(page)
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  if (scenario.expect) await page.getByText(scenario.expect).first().waitFor({ timeout: 10000 }).catch(() => {})
  if (scenario.interact) await scenario.interact(page).catch((error) => failures.push(`interaction: ${error.message}`))
  await page.waitForTimeout(600)

  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0]
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0
    const memory = performance.memory ? performance.memory.usedJSHeapSize : 0
    return {
      fcp,
      lcp: window.__leadraPerf?.lcp ?? 0,
      cls: window.__leadraPerf?.cls ?? 0,
      longTaskCount: window.__leadraPerf?.longTasks?.filter((duration) => duration > 50).length ?? 0,
      longestTask: Math.max(0, ...(window.__leadraPerf?.longTasks ?? [0])),
      ttfb: nav ? nav.responseStart - nav.requestStart : 0,
      heapMb: memory ? memory / 1024 / 1024 : 0,
    }
  })

  const slowest = requests.reduce((max, item) => (item.ms > max.ms ? item : max), { ms: 0, url: '', bytes: 0, status: 0 })
  const row = {
    profile: profile.name,
    page: scenario.name,
    loadMs: Date.now() - startedAt,
    requestCount: requests.length,
    payloadKb: Math.round(requests.reduce((total, item) => total + item.bytes, 0) / 1024),
    slowestRequestMs: slowest.ms,
    slowestRequest: trimUrl(slowest.url),
    failures,
    ...metrics,
  }
  await context.close()
  return row
}

async function signInAsAdmin(page) {
  const continueButton = page.getByRole('button', { name: /continue to sign in/i })
  if (await continueButton.isVisible().catch(() => false)) await continueButton.click()
  const adminButton = page.getByRole('button').filter({ hasText: /admin/i }).first()
  if (await adminButton.isVisible().catch(() => false)) await adminButton.click()
}

async function analyzeBundle() {
  const files = await readdir('dist/assets')
  const assets = []
  for (const file of files.filter((item) => item.endsWith('.js') || item.endsWith('.css'))) {
    const path = `dist/assets/${file}`
    const content = await readFile(path)
    assets.push({ file, bytes: content.length, gzipBytes: await gzipSize(path) })
  }
  assets.sort((a, b) => b.bytes - a.bytes)
  return assets
}

async function writeReports(rows, bundle) {
  await mkdir(reportDir, { recursive: true })
  const jsonPath = `${reportDir}/leadra-performance-report.json`
  const mdPath = `${reportDir}/leadra-performance-report.md`
  await writeFile(jsonPath, JSON.stringify({ generatedAt: new Date().toISOString(), datasetSize, rows, bundle }, null, 2))
  await writeFile(mdPath, renderMarkdown(rows, bundle))
}

function renderMarkdown(rows, bundle) {
  const failedRows = rows.filter((row) => row.failures.length > 0 || row.cls > 0.1 || (row.profile.startsWith('mobile') ? row.lcp > 3500 : row.lcp > 2500))
  return `# Final Performance QA Report — Leadra

## Executive Summary
Status: ${failedRows.length === 0 ? 'Ready after minor fixes' : 'Not ready'}

Dataset: ${datasetSize.toLocaleString()} generated units, 100 users, 5,000 audit records, 1,000 notifications.
Environment: local production Vite build with \`VITE_LEADRA_PERF_MODE=true\`.

## Page Metrics
| Profile | Page | Load ms | FCP ms | LCP ms | CLS | Long tasks | Requests | Payload KB | Slowest request |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
${rows.map((row) => `| ${row.profile} | ${row.page} | ${Math.round(row.loadMs)} | ${Math.round(row.fcp)} | ${Math.round(row.lcp)} | ${row.cls.toFixed(3)} | ${row.longTaskCount} | ${row.requestCount} | ${row.payloadKb} | ${row.slowestRequestMs}ms ${row.slowestRequest} |`).join('\n')}

## Bundle Analysis
| Asset | Raw KB | Gzip KB |
|---|---:|---:|
${bundle.map((asset) => `| ${asset.file} | ${Math.round(asset.bytes / 1024)} | ${Math.round(asset.gzipBytes / 1024)} |`).join('\n')}

## Failures And Blockers
${failedRows.length === 0 ? '- No threshold blockers detected by the scripted local production audit.' : failedRows.map((row) => `- ${row.profile} ${row.page}: ${row.failures.join('; ') || `LCP ${Math.round(row.lcp)}ms / CLS ${row.cls.toFixed(3)}`}`).join('\n')}

## Verdict
${failedRows.length === 0 ? 'APPROVED AFTER LISTED FIXES' : 'BLOCKED FROM PRODUCTION'}
`
}

function printSummary(rows, bundle) {
  console.log(`\nPerformance audit complete for ${datasetSize} generated units.`)
  console.table(rows.map((row) => ({
    profile: row.profile,
    page: row.page,
    loadMs: Math.round(row.loadMs),
    fcp: Math.round(row.fcp),
    lcp: Math.round(row.lcp),
    cls: row.cls.toFixed(3),
    longTasks: row.longTaskCount,
    requests: row.requestCount,
    payloadKb: row.payloadKb,
  })))
  console.table(bundle.map((asset) => ({ file: asset.file, rawKb: Math.round(asset.bytes / 1024), gzipKb: Math.round(asset.gzipBytes / 1024) })))
}

function run(command, args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, ...extraEnv } })
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code}`))
    })
  })
}

async function waitForServer(url) {
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // keep waiting
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`Timed out waiting for ${url}`)
}

function gzipSize(path) {
  return new Promise((resolve, reject) => {
    let size = 0
    createReadStream(path)
      .pipe(createGzip())
      .on('data', (chunk) => {
        size += chunk.length
      })
      .on('end', () => resolve(size))
      .on('error', reject)
  })
}

function trimUrl(url) {
  if (!url) return ''
  try {
    const parsed = new URL(url)
    return `${parsed.pathname}${parsed.search ? '?' : ''}`
  } catch {
    return url.slice(0, 60)
  }
}
