import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseURL = 'http://127.0.0.1:5175';
const outDir = path.resolve('screenshots/ipad/source');
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1024, height: 1366 },
  deviceScaleFactor: 2,
  isMobile: false,
  hasTouch: true,
});
const page = await context.newPage();
page.setDefaultTimeout(15000);

async function cleanPage() {
  await page.addStyleTag({ content: `
    [class*=styles-module__toolbar], [class*=styles-module__toolbarContainer], [class*=styles-module__annotation], [class*=agentation] { display:none!important; visibility:hidden!important; }
    *, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }
    .motion-stage, .motion-hero, .motion-subtle, .motion-feedback, .motion-flash, .motion-status-pill, .page-entrance { opacity: 1 !important; transform: none !important; }
  `}).catch(() => {});
  await page.evaluate(() => {
    window.localStorage.setItem('leadra.theme', 'light');
    document.documentElement.dataset.theme = 'light';
    document.documentElement.style.colorScheme = 'light';
  }).catch(() => {});
}

async function loginAdmin() {
  await page.goto(baseURL + '/', { waitUntil: 'networkidle' });
  await cleanPage();
  const admin = page.getByRole('button', { name: /continue as admin/i });
  if (await admin.isVisible().catch(() => false)) await admin.click();
  await page.waitForLoadState('networkidle').catch(() => {});
  await cleanPage();
  await page.waitForTimeout(900);
}

async function gotoClean(route) {
  await page.evaluate((nextRoute) => {
    window.history.pushState(null, '', nextRoute);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, route);
  await page.waitForLoadState('networkidle').catch(() => {});
  await cleanPage();
  await page.waitForTimeout(700);
}

async function shot(name, scrollY = 0) {
  await cleanPage();
  await page.evaluate((y) => window.scrollTo(0, y), scrollY);
  await page.waitForTimeout(250);
  const file = path.join(outDir, name + '.png');
  await page.screenshot({ path: file, fullPage: false });
  console.log(file);
}

await loginAdmin();
await page.locator('text=Visible units').first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
await shot('01-dashboard-control-inventory', 130);

await gotoClean('/units');
const showFilters = page.getByRole('button', { name: /show filters/i });
if (await showFilters.isVisible().catch(() => false)) await showFilters.click();
await page.waitForTimeout(300);
await shot('02-units-find-fast', 0);

await gotoClean('/create/payment');
await shot('03-create-upload-without-chaos', 0);

await gotoClean('/units/details/107');
const gen = page.getByRole('button', { name: /generate brief/i });
if (await gen.isVisible().catch(() => false)) {
  await gen.click().catch(() => {});
  await page.waitForTimeout(800);
}
await shot('04-details-share-briefs', 0);

await gotoClean('/analytics/live');
await shot('05-analytics-track-performance', 0);

await browser.close();
