import { expect, test, type Page } from '@playwright/test'

const roles = ['admin', 'manager', 'sales'] as const
const routes = ['dashboard', 'units', 'create', 'notifications', 'profile', 'analytics', 'admin'] as const

async function signIn(page: Page, role: (typeof roles)[number]) {
  await page.goto('/#dashboard')
  const intro = page.getByRole('button', { name: /continue to sign in/i })
  if (await intro.isVisible().catch(() => false)) await intro.click()

  const demoName = role === 'admin' ? /continue as admin/i : role === 'manager' ? /continue as mona hafez/i : /continue as sara amin/i
  const demo = page.getByRole('button', { name: demoName })
  if (await demo.isVisible().catch(() => false)) {
    await demo.click()
    return
  }

  const email = process.env[`LEADRA_QA_${role.toUpperCase()}_EMAIL`]
  const password = process.env[`LEADRA_QA_${role.toUpperCase()}_PASSWORD`]
  if (!email || !password) throw new Error(`Missing credentials for ${role}. Set LEADRA_QA_${role.toUpperCase()}_EMAIL/PASSWORD.`)
  await page.getByLabel(/email/i).fill(email)
  await page.locator('input[name="password"]').fill(password)
  await page.getByRole('button', { name: /^sign in$/i }).click()
  await expect(page.locator('.app-shell')).toBeVisible()
}

async function assertPageHealth(page: Page) {
  await page.waitForLoadState('networkidle')
  const health = await page.evaluate(() => {
    const visible = (element: Element) => {
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
    }
    const smallTargets = [...document.querySelectorAll('button, a, input, textarea, [role="combobox"], [role="option"]')]
      .filter(visible)
      .filter((element) => {
        const rect = element.getBoundingClientRect()
        return rect.width < 44 || rect.height < 44
      })
      .map((element) => (element.getAttribute('aria-label') || element.textContent || element.getAttribute('name') || '').trim().replace(/\s+/g, ' ').slice(0, 80))
    return {
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
      blank: document.body.innerText.trim().length < 20,
      smallTargets,
    }
  })
  expect(health.blank, 'page should not be blank').toBe(false)
  expect(health.overflow, 'page should not have horizontal overflow').toBe(false)
  expect(health.smallTargets, `small targets: ${health.smallTargets.join(', ')}`).toHaveLength(0)
}

async function navigateRoute(page: Page, route: (typeof routes)[number]) {
  await page.evaluate((nextRoute) => {
    window.location.hash = nextRoute
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  }, route)
  await page.waitForLoadState('networkidle')
}

test.describe('production preview route and role sweep', () => {
  for (const role of roles) {
    test(`${role} routes are stable and role-scoped`, async ({ page }) => {
      const failures: string[] = []
      page.on('pageerror', (error) => failures.push(`pageerror ${error.message}`))
      page.on('response', (response) => {
        if (response.status() >= 400) failures.push(`${response.status()} ${response.url().split('?')[0]}`)
      })

      await signIn(page, role)
      for (const route of routes) {
        await navigateRoute(page, route)
        await assertPageHealth(page)
        if (role === 'sales' && route === 'analytics') {
          await expect(page.getByRole('heading', { name: /analytics/i })).toHaveCount(0)
        }
        if (role === 'sales' && route === 'admin') {
          await expect(page.getByRole('heading', { name: /user management/i })).toHaveCount(0)
        }
      }
      expect(failures).toEqual([])
    })
  }

  test('analytics filters, date windows, and dropdowns stay interactive', async ({ page }) => {
    await signIn(page, 'admin')
    await navigateRoute(page, 'analytics')
    await expect(page.getByRole('heading', { name: 'Analytics', exact: true })).toBeVisible()
    await page.getByRole('button', { name: /30 days/i }).click()
    await page.getByRole('button', { name: /90 days/i }).click()
    await page.getByRole('button', { name: /custom/i }).click()
    await expect(page.getByLabel(/start/i)).toBeVisible()
    await page.getByRole('button', { name: /^filters/i }).click()
    await page.getByRole('combobox', { name: /status/i }).click()
    await expect(page.getByRole('option', { name: /available/i })).toBeVisible()
    await assertPageHealth(page)
  })
})
