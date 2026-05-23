import { chromium } from 'playwright'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const root = resolve(new URL('..', import.meta.url).pathname)
const htmlPath = resolve(root, 'LEADRA_CLIENT_REPORT.html')
const pdfPath = resolve(root, 'LEADRA_CLIENT_REPORT.pdf')

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1240, height: 1754 }, deviceScaleFactor: 2 })
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' })
await page.pdf({
  path: pdfPath,
  format: 'A4',
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
})
await browser.close()

console.log(pdfPath)
