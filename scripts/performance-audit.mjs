import { spawn } from 'node:child_process'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createGzip } from 'node:zlib'
import { createReadStream } from 'node:fs'
import { chromium, devices } from 'playwright'

const datasetSize = Number(process.env.LEADRA_PERF_DATASET ?? 10000)
const port = Number(process.env.LEADRA_PERF_PORT ?? 4174)
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`
const reportDir = 'performance-reports'

const allProfiles = [
  { name: 'desktop', viewport: { width: 1440, height: 900 } },
  { name: 'tablet', viewport: { width: 768, height: 1024 } },
  { name: 'mobile-fast4g', device: devices['iPhone 13'], cpuThrottle: 4 },
  { name: 'mobile-slow4g', device: devices['iPhone 13'], cpuThrottle: 4, network: 'slow4g' },
]

const allScenarios = [
  { name: 'Login', hash: '', auth: false, ready: async (page) => page.locator('.login-card').waitFor({ timeout: 3000 }) },
  { name: 'Dashboard', hash: '#dashboard', ready: async (page) => page.locator('.dashboard-page').waitFor({ timeout: 3000 }) },
  {
    name: 'Units list',
    hash: '#units',
    ready: async (page) => page.locator('.units-page .unit-row').first().waitFor({ timeout: 3000 }),
    interact: async (page) => page.getByPlaceholder(/\+2010/i).fill('+201010000001'),
  },
  { name: 'Unit details', hash: '#details', openFirstUnit: true, ready: async (page) => page.locator('.details-page').waitFor({ timeout: 3000 }) },
  { name: 'Create unit', hash: '#create', ready: async (page) => page.locator('.create-card').first().waitFor({ timeout: 3000 }) },
  { name: 'Notifications', hash: '#notifications', ready: async (page) => page.locator('.notifications-page').waitFor({ timeout: 3000 }) },
  {
    name: 'Analytics',
    hash: '#analytics',
    ready: async (page) => page.locator('.analytics-page .analytics-metrics').waitFor({ timeout: 3000 }),
    interact: async (page) => page.getByRole('button', { name: /90 days/i }).click(),
  },
  { name: 'Admin users', hash: '#admin', ready: async (page) => page.getByRole('heading', { name: /user management/i }).waitFor({ timeout: 3000 }) },
  {
    name: 'Admin audit',
    hash: '#admin',
    ready: async (page) => page.getByRole('heading', { name: /user management/i }).waitFor({ timeout: 3000 }),
    interact: async (page) => {
      await page.getByRole('button', { name: /audit/i }).click()
      await page.locator('.admin-row').first().waitFor({ timeout: 3000 }).catch(() => {})
    },
  },
  {
    name: 'PDF export',
    hash: '#details',
    openFirstUnit: true,
    settleMs: 0,
    ready: async (page) => page.getByRole('button', { name: /generate/i }).waitFor({ timeout: 3000 }),
    interact: async (page) => {
      const popupPromise = page.waitForEvent('popup', { timeout: 1000 }).catch(() => null)
      await page.getByRole('button', { name: /generate|print/i }).first().click({ force: true })
      const popup = await Promise.race([popupPromise, delay(250).then(() => null)])
      if (popup) await popup.close()
    },
  },
]
const fullMatrix = process.env.LEADRA_PERF_FULL === 'true'
const profiles = fullMatrix ? allProfiles : allProfiles.filter((profile) => ['desktop', 'mobile-slow4g'].includes(profile.name))
const scenarios = fullMatrix
  ? allScenarios
  : allScenarios.filter((scenario) => ['Login', 'Dashboard', 'Units list', 'Analytics', 'Admin audit', 'PDF export'].includes(scenario.name))

await rm('dist', { recursive: true, force: true })
await runNpm(['run', 'build'], { VITE_LEADRA_PERF_MODE: 'true' })
const preview = spawnNpm(['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(port)], {
  stdio: 'ignore',
  env: { ...process.env, VITE_LEADRA_PERF_MODE: 'true' },
})

try {
  await waitForServer(baseUrl)
  const browser = await chromium.launch()
  const rows = []

  if (fullMatrix || process.env.LEADRA_PERF_FRESH_LOADS === 'true') {
    for (const profile of profiles) {
      for (const scenario of scenarios) {
        console.log(`Measuring ${profile.name} / ${scenario.name}`)
        rows.push(await measureScenario(browser, profile, scenario))
      }
    }
  } else {
    for (const profile of profiles) {
      console.log(`Measuring route matrix for ${profile.name}`)
      rows.push(...await measureProfileRoutes(browser, profile))
    }
  }

  await browser.close()
  const bundle = await analyzeBundle()
  await writeReports(rows, bundle)
  printSummary(rows, bundle)
} finally {
  await killProcessTree(preview.pid)
}

async function measureScenario(browser, profile, scenario) {
  const context = await browser.newContext({
    ...(profile.device ?? {}),
    viewport: profile.device ? profile.device.viewport : profile.viewport,
  })
  const page = await context.newPage()
  page.setDefaultTimeout(8000)
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
  if (cdp && profile.network === 'slow4g') await emulateSlow4g(cdp)

  const startedAt = Date.now()
  await page.goto(`${baseUrl}/?perfDataset=${datasetSize}${scenario.hash}`, { waitUntil: 'domcontentloaded' })
  if (scenario.auth !== false) await signInAsAdmin(page)
  await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {})
  if (scenario.ready) await scenario.ready(page).catch((error) => failures.push(`ready: ${error.message}`))
  else if (scenario.expect) await page.getByText(scenario.expect).first().waitFor({ timeout: 3000 }).catch((error) => failures.push(`expect: ${error.message}`))
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

async function measureProfileRoutes(browser, profile) {
  const context = await browser.newContext({
    ...(profile.device ?? {}),
    viewport: profile.device ? profile.device.viewport : profile.viewport,
  })
  const page = await context.newPage()
  page.setDefaultTimeout(8000)
  const cdp = await context.newCDPSession(page).catch(() => null)
  if (cdp && profile.cpuThrottle) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpuThrottle }).catch(() => {})
  }
  if (cdp && profile.network === 'slow4g') await emulateSlow4g(cdp)

  const rows = []
  await installPerfObservers(page)
  const loginMetrics = await measureSegment(page, profile, { name: 'Login', auth: false, expect: /resale command/i }, async () => {
    await page.goto(`${baseUrl}/?perfDataset=${datasetSize}`, { waitUntil: 'domcontentloaded' })
  })
  rows.push(loginMetrics)
  await signInAsAdmin(page)
  await page.locator('.app-shell').waitFor({ timeout: 10000 })
  await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {})

  for (const scenario of scenarios.filter((item) => item.auth !== false)) {
    rows.push(await measureSegment(page, profile, scenario, async () => {
      if (scenario.openFirstUnit) {
        await navigateHash(page, '#units')
        await page.locator('.units-page').waitFor({ timeout: 8000 })
        await clearUnitFilters(page)
        await page.locator('.unit-row').first().waitFor({ timeout: 8000 })
        await page.locator('.unit-row').first().dispatchEvent('click')
        return
      }
      await navigateHash(page, scenario.hash)
    }))
  }

  await context.close()
  return rows
}

async function navigateHash(page, hash) {
  await page.evaluate((nextHash) => {
    window.location.hash = nextHash.replace(/^#/, '')
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  }, hash)
}

async function clearUnitFilters(page) {
  const inputs = await page.locator('.filter-bar input').all()
  for (const input of inputs) {
    await input.fill('')
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function measureSegment(page, profile, scenario, action) {
  const requestTimes = new Map()
  const requests = []
  const failures = []
  const onRequest = (request) => requestTimes.set(request, Date.now())
  const onFailed = (request) => failures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? 'failed'}`)
  const onFinished = async (request) => {
    const response = await request.response()
    const started = requestTimes.get(request) ?? Date.now()
    const headerSize = Number(response?.headers()['content-length'] ?? 0)
    requests.push({ url: request.url(), method: request.method(), ms: Date.now() - started, bytes: Number.isFinite(headerSize) ? headerSize : 0, status: response?.status() ?? 0 })
  }
  page.on('request', onRequest)
  page.on('requestfailed', onFailed)
  page.on('requestfinished', onFinished)
  await resetPerf(page)
  const startedAt = Date.now()
  await action()
  if (scenario.ready) await scenario.ready(page).catch((error) => failures.push(`ready: ${error.message}`))
  else if (scenario.expect) await page.getByText(scenario.expect).first().waitFor({ timeout: 3000 }).catch((error) => failures.push(`expect: ${error.message}`))
  if (scenario.interact) await scenario.interact(page).catch((error) => failures.push(`interaction: ${error.message}`))
  await page.waitForTimeout(scenario.settleMs ?? 250)
  page.off('request', onRequest)
  page.off('requestfailed', onFailed)
  page.off('requestfinished', onFinished)
  const metrics = await readPerf(page)
  const slowest = requests.reduce((max, item) => (item.ms > max.ms ? item : max), { ms: 0, url: '', bytes: 0, status: 0 })
  return {
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
}

async function emulateSlow4g(cdp) {
  await cdp.send('Network.enable').catch(() => {})
  await cdp
    .send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 170,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    })
    .catch(() => {})
}

async function signInAsAdmin(page) {
  const continueButton = page.getByRole('button', { name: /continue to sign in/i })
  if (await continueButton.isVisible().catch(() => false)) await continueButton.click()
  const adminButton = page.getByRole('button').filter({ hasText: /admin/i }).first()
  if (await adminButton.isVisible().catch(() => false)) await adminButton.click()
}

async function installPerfObservers(page) {
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
}

async function resetPerf(page) {
  await page.evaluate(() => {
    window.__leadraPerf = { cls: 0, lcp: 0, longTasks: [] }
    performance.clearMarks()
    performance.clearMeasures()
  }).catch(() => {})
}

async function readPerf(page) {
  return page.evaluate(() => {
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
  const failedRows = rows.filter((row) => {
    const isMobile = row.profile.startsWith('mobile')
    const lcpLimit = isMobile ? 3500 : 2500
    const routeLimit = row.page === 'PDF export' ? (isMobile ? 3000 : 2000) : isMobile ? 3500 : 2500
    const inpLimit = row.page === 'PDF export' ? 200 : isMobile ? 300 : 200
    return row.failures.length > 0 || row.cls > 0.1 || row.lcp > lcpLimit || row.loadMs > routeLimit || row.longestTask > inpLimit
  })
  return `# Final Performance QA Report — Leadra

## Executive Summary
Status: ${failedRows.length === 0 ? 'Ready after minor fixes' : 'Not ready'}

Dataset: ${datasetSize.toLocaleString()} generated units, 100 users, 5,000 audit records, 1,000 notifications.
Environment: local production Vite build with \`VITE_LEADRA_PERF_MODE=true\`.

## Test Setup
- Browser: Playwright Chromium against local Vite production preview.
- Profiles: desktop 1440x900 and mobile iPhone 13 with 4x CPU throttle by default. Set \`LEADRA_PERF_FULL=true\` for tablet and fast-4G profile.
- Dataset: generated performance-only local data; no production mutation.
- Limitation: this script captures local production SPA route timing and Web Vitals observers. Real Lighthouse, production CDN headers, Supabase EXPLAIN/ANALYZE, and real-device testing are still required before final launch approval.

## Page Metrics
| Profile | Page | Load ms | FCP ms | LCP ms | CLS | INP est ms | Long tasks | Requests | Payload KB | Slowest request |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
${rows.map((row) => `| ${row.profile} | ${row.page} | ${Math.round(row.loadMs)} | ${Math.round(row.fcp)} | ${Math.round(row.lcp)} | ${row.cls.toFixed(3)} | ${Math.round(row.longestTask)} | ${row.longTaskCount} | ${row.requestCount} | ${row.payloadKb} | ${row.slowestRequestMs}ms ${row.slowestRequest} |`).join('\n')}

## Bundle Analysis
| Asset | Raw KB | Gzip KB |
|---|---:|---:|
${bundle.map((asset) => `| ${asset.file} | ${Math.round(asset.bytes / 1024)} | ${Math.round(asset.gzipBytes / 1024)} |`).join('\n')}

## Failures And Blockers
${failedRows.length === 0 ? '- No threshold blockers detected by the scripted local production audit.' : failedRows.map((row) => {
    const details = row.failures.length > 0
      ? row.failures.join('; ')
      : `load ${Math.round(row.loadMs)}ms / LCP ${Math.round(row.lcp)}ms / CLS ${row.cls.toFixed(3)} / INP est ${Math.round(row.longestTask)}ms`
    return `- ${row.profile} ${row.page}: ${details}`
  }).join('\n')}

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

function runNpm(args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnNpm(args, { stdio: 'inherit', env: { ...process.env, ...extraEnv } })
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`npm ${args.join(' ')} failed with exit code ${code}`))
    })
  })
}

function spawnNpm(args, options = {}) {
  if (process.platform === 'win32') {
    return spawn('cmd.exe', ['/d', '/s', '/c', 'npm', ...args], { ...options, shell: false })
  }
  return spawn('npm', args, { ...options, shell: false })
}

function killProcessTree(pid) {
  if (!pid) return Promise.resolve()
  if (process.platform !== 'win32') {
    try {
      process.kill(pid, 'SIGTERM')
    } catch {
      // process already exited
    }
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    const child = spawn('taskkill.exe', ['/pid', String(pid), '/t', '/f'], { stdio: 'ignore' })
    child.on('exit', () => resolve())
    child.on('error', () => resolve())
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
