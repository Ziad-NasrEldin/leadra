import { expect, test, type Page } from '@playwright/test'

const roles = ['admin', 'sub_admin', 'manager', 'sales'] as const
const routes = [
  'dashboard',
  'units',
  'units/destinations/not-a-real-destination',
  'units/destinations/not-a-real-destination/projects/not-a-real-project',
  'units/details/999999',
  'create',
  'create/property',
  'create/specs',
  'create/payment',
  'create/owner',
  'create/review',
  'notifications',
  'special',
  'profile',
  'analytics',
  'analytics/live',
  'analytics/30d',
  'analytics/90d?filters=open',
  'analytics/custom',
  'admin',
  'admin/users',
  'admin/master-data',
  'admin/settings',
  'admin/metrics',
  'admin/audit',
  'admin/master-data/developers',
  'admin/master-data/destinations',
  'admin/master-data/projects',
  'admin/master-data/views',
  'admin/master-data/finishes',
  'admin/master-data/branches',
  'admin/master-data/teams',
  'palette',
] as const
const createSteps = ['Property', 'Specs', 'Payment', 'Owner', 'Review'] as const
const adminSections = ['Users', 'Master Data', 'Settings', 'Metrics', 'Audit'] as const
const masterDataDirectories = ['Developers', 'Destinations', 'Projects', 'Views', 'Finishes', 'Branch Management', 'Team Management'] as const
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

async function completeSignIn(page: Page, role: (typeof roles)[number]) {
  const intro = page.getByRole('button', { name: /continue to sign in/i })
  if (await intro.first().isVisible({ timeout: 1_000 }).catch(() => false)) {
    await intro.first().click()
  }

  const demoName = role === 'admin'
    ? /continue as admin/i
    : role === 'sub_admin'
      ? /continue as laila mansour/i
      : role === 'manager'
        ? /continue as mona hafez/i
        : /continue as sara amin/i
  const demo = page.getByRole('button', { name: demoName })
  if (await demo.first().isVisible({ timeout: 2_000 }).catch(() => false)) {
    await demo.first().click()
    await expect(page.locator('.app-shell')).toBeVisible()
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

async function signIn(page: Page, role: (typeof roles)[number]) {
  await page.goto('/dashboard')
  const shell = page.locator('.app-shell')
  await expect(page.locator('.app-shell, .login-screen').first()).toBeVisible()
  if (await shell.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: /sign out/i }).click()
    await expect(page.locator('.login-screen')).toBeVisible()
  }
  await completeSignIn(page, role)
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
        const input = element instanceof HTMLInputElement ? element : null
        const target = input?.type === 'checkbox' || input?.type === 'radio' ? input.closest('label') ?? input : element
        const rect = target.getBoundingClientRect()
        return rect.width < 44 || rect.height < 44
      })
      .map((element) => (element.getAttribute('aria-label') || element.textContent || element.getAttribute('name') || '').trim().replace(/\s+/g, ' ').slice(0, 80))
    const unnamedControls = [...document.querySelectorAll('button, a, input, textarea, select, [role="combobox"]')]
      .filter(visible)
      .filter((element) => !(element as HTMLButtonElement | HTMLInputElement).disabled)
      .filter((element) => {
        const id = element.getAttribute('id')
        const labelText = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent : ''
        const wrappedLabel = element.closest('label')?.textContent
        const name = element.getAttribute('aria-label') || element.getAttribute('title') || element.textContent || labelText || wrappedLabel || element.getAttribute('placeholder') || element.getAttribute('name')
        return !name?.trim()
      })
      .map((element) => element.outerHTML.slice(0, 120))
    return {
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
      blank: document.body.innerText.trim().length < 20,
      smallTargets,
      unnamedControls,
    }
  })
  expect(health.blank, 'page should not be blank').toBe(false)
  expect(health.overflow, 'page should not have horizontal overflow').toBe(false)
  expect(health.smallTargets, `small targets: ${health.smallTargets.join(', ')}`).toHaveLength(0)
  expect(health.unnamedControls, `unnamed controls: ${health.unnamedControls.join(', ')}`).toHaveLength(0)

  await page.keyboard.press('Tab')
  const focusHealth = await page.evaluate(() => {
    const active = document.activeElement
    if (!active || active === document.body) return { ok: true, label: 'body' }
    const style = getComputedStyle(active)
    const outlineWidth = Number.parseFloat(style.outlineWidth || '0')
    const hasFocusIndicator = outlineWidth >= 2 || style.boxShadow !== 'none'
    return {
      ok: hasFocusIndicator,
      label: (active.getAttribute('aria-label') || active.textContent || active.getAttribute('name') || active.tagName).trim().replace(/\s+/g, ' ').slice(0, 80),
    }
  })
  expect(focusHealth.ok, `focused control should show a visible focus indicator: ${focusHealth.label}`).toBe(true)
}

async function assertCurrentChecklistItem(page: Page, label: string) {
  await expect(page.locator('.app-shell, .login-screen').first(), `${label} shell should be visible`).toBeVisible()
  await assertPageHealth(page)
}

async function navigateRoute(page: Page, route: string, role: (typeof roles)[number] = 'admin') {
  await page.goto(`/${route}`)
  if (await page.locator('.login-screen').isVisible().catch(() => false)) await completeSignIn(page, role)
  await page.waitForLoadState('networkidle')
}

async function chooseFromSelect(page: Page, label: RegExp, option: RegExp) {
  await page.getByRole('combobox', { name: label }).click()
  await page.getByRole('option', { name: option }).click()
}

test.describe('production preview route and role sweep', () => {
  test('login screen adapts before authentication', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.locator('.login-screen')).toBeVisible()
    await assertPageHealth(page)
  })

  for (const role of roles) {
    test(`${role} routes are stable and role-scoped`, async ({ page }) => {
      const failures: string[] = []
      page.on('pageerror', (error) => failures.push(`pageerror ${error.message}`))
      page.on('response', (response) => {
        if (response.status() >= 400) failures.push(`${response.status()} ${response.url().split('?')[0]}`)
      })

      await signIn(page, role)
      for (const route of routes) {
        await navigateRoute(page, route, role)
        await assertCurrentChecklistItem(page, `${role} ${route}`)
        if (role === 'sales' && route.startsWith('analytics')) {
          await expect(page.getByRole('heading', { name: /analytics/i })).toHaveCount(0)
        }
        if ((role === 'sales' || role === 'manager') && route.startsWith('admin')) {
          await expect(page.getByRole('heading', { name: /user management/i })).toHaveCount(0)
        }
      }
      expect(failures).toEqual([])
    })
  }

  test('create wizard, units filters, details, admin tabs, master data, and mobile more adapt', async ({ page }, testInfo) => {
    const isMobileProject = testInfo.project.name === 'mobile'
    await signIn(page, 'admin')

    await navigateRoute(page, 'units')
    await assertCurrentChecklistItem(page, 'units browsing')
    await page.getByRole('button', { name: /^destination 1/i }).click()
    await expect(page).toHaveURL(/\/units\/destinations\//)
    await assertCurrentChecklistItem(page, 'units destination projects')
    await page.getByRole('button', { name: /performance project/i }).first().click()
    await expect(page).toHaveURL(/\/units\/destinations\/.+\/projects\/.+$/)
    await assertCurrentChecklistItem(page, 'units project list')
    await page.getByRole('button', { name: /show filters/i }).click()
    await expect(page.locator('#units-advanced-filters')).toBeVisible()
    await assertCurrentChecklistItem(page, 'units filters open')

    await page.getByRole('button', { name: /^open /i }).first().click()
    await expect(page.getByText(/unit details/i).first()).toBeVisible()
    await assertCurrentChecklistItem(page, 'unit details')

    await navigateRoute(page, 'units/details/999999')
    await expect(page.getByText(/unit unavailable/i)).toBeVisible()
    await assertCurrentChecklistItem(page, 'unit unavailable')

    await navigateRoute(page, 'create')
    for (const step of createSteps) {
      await page.getByRole('button', { name: new RegExp(step, 'i') }).click()
      await expect(page.locator('.wizard-panel[data-active="true"]')).toBeVisible()
      await expect(page).toHaveURL(new RegExp(`/create/${step.toLowerCase().replace('property', 'property')}`))
      await assertCurrentChecklistItem(page, `create ${step}`)
    }

    await navigateRoute(page, 'analytics/90d?filters=open')
    await expect(page.getByRole('heading', { name: /analytics/i }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /close filters/i })).toBeVisible()
    await assertCurrentChecklistItem(page, 'admin analytics')

    await signIn(page, 'manager')
    await navigateRoute(page, 'analytics', 'manager')
    await expect(page.getByRole('heading', { name: /company analytics|team analytics/i })).toBeVisible()
    await assertCurrentChecklistItem(page, 'manager analytics')

    await signIn(page, 'admin')
    await navigateRoute(page, 'admin')
    for (const section of adminSections) {
      await page.getByRole('button', { name: new RegExp(`^${section}$`, 'i') }).click()
      await expect(page).toHaveURL(new RegExp(section === 'Users' ? '/admin/users$' : `/admin/${section.toLowerCase().replace(/\s+/g, '-')}$`))
      await assertCurrentChecklistItem(page, `admin ${section}`)
    }

    await page.getByRole('button', { name: /^master data$/i }).click()
    for (const directory of masterDataDirectories) {
      await page.getByRole('button', { name: new RegExp(directory, 'i') }).click()
      const directorySlug = directory.toLowerCase().replace('branch management', 'branches').replace('team management', 'teams').replace(/\s+/g, '-')
      await expect(page).toHaveURL(new RegExp(`/admin/master-data/${directorySlug}$`))
      await assertCurrentChecklistItem(page, `master data ${directory}`)
    }

    await navigateRoute(page, 'palette')
    await assertCurrentChecklistItem(page, 'palette')

    if (isMobileProject) {
      await page.getByRole('button', { name: /^more$/i }).click()
      await expect(page.locator('.mobile-more-sheet')).toBeVisible()
      await assertCurrentChecklistItem(page, 'mobile more sheet')
    }
  })

  test('analytics filters, date windows, and dropdowns stay interactive', async ({ page }) => {
    await signIn(page, 'admin')
    await navigateRoute(page, 'analytics')
    await expect(page.getByRole('heading', { name: /analytics/i }).first()).toBeVisible()
    await page.getByRole('button', { name: /30 days/i }).click()
    await expect(page).toHaveURL(/\/analytics\/30d/)
    await page.getByRole('button', { name: /90 days/i }).click()
    await expect(page).toHaveURL(/\/analytics\/90d/)
    await page.getByRole('button', { name: /custom/i }).click()
    await expect(page).toHaveURL(/\/analytics\/custom/)
    await expect(page.getByLabel(/start/i)).toBeVisible()
    await page.getByRole('button', { name: /^filters/i }).click()
    await expect(page).toHaveURL(/filters=open/)
    await page.getByRole('combobox', { name: /status/i }).click()
    await expect(page.getByRole('option', { name: /available/i })).toBeVisible()
    await assertPageHealth(page)
  })

  test('admin can create a team member with the default real team selection', async ({ page }) => {
    await signIn(page, 'admin')
    await navigateRoute(page, 'admin/users', 'admin')
    await page.getByRole('button', { name: /new user/i }).click()

    const form = page.locator('form.create-user-panel')
    await expect(form).toBeVisible()
    await expect(form.getByRole('combobox', { name: /^team$/i })).not.toHaveText(/no team/i)

    const teamValue = await form.locator('input[name="teamId"]').inputValue()
    expect(teamValue, 'create-user form should submit a real team id by default').not.toBe('')

    const email = `e2e-team-member-${Date.now()}@leadra.test`
    await form.getByLabel(/full name/i).fill('E2E Team Member')
    await form.getByLabel(/^email$/i).fill(email)
    await form.locator('input[name="password"]').fill('Leadra123!')
    await form.locator('input[name="confirmPassword"]').fill('Leadra123!')
    await form.getByLabel(/job title/i).fill('Sales Representative')
    await form.getByLabel(/phone number/i).fill('+201099999999')
    await form.getByRole('button', { name: /^create user$/i }).click()

    await expect(page.getByText(/user created and audit history updated/i)).toBeVisible()
    await page.getByLabel(/search users/i).fill(email)
    await expect(page.getByText('E2E Team Member')).toBeVisible()
  })

  test('special units stay visible after the remote save settles', async ({ page }) => {
    await signIn(page, 'admin')
    await navigateRoute(page, 'units')

    const firstOpenButton = page.getByRole('button', { name: /^open /i }).nth(1)
    const openLabel = await firstOpenButton.getAttribute('aria-label')
    const unitCode = openLabel?.replace(/^open\s+/i, '').trim()
    expect(unitCode, 'unit code should be present in the row open label').toBeTruthy()
    const openUnit = page.getByRole('button', { name: new RegExp(`^open ${escapeRegExp(unitCode!)}$`, 'i') })

    await firstOpenButton.click()
    await expect(page.getByText(/unit details/i).first()).toBeVisible()
    const removeSpecial = page.getByRole('button', { name: /remove special/i })
    if (await removeSpecial.isVisible({ timeout: 1_000 }).catch(() => false)) await removeSpecial.click()

    await page.getByRole('button', { name: /mark special/i }).click()
    await expect(page.getByRole('button', { name: /remove special/i })).toBeVisible()
    await page.waitForTimeout(1_500)
    await expect(page.getByRole('button', { name: /remove special/i })).toBeVisible()

    await page.evaluate(() => {
      window.history.pushState(null, '', '/special')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await expect(page).toHaveURL(/\/special$/)
    await expect(page.getByRole('heading', { name: /special units/i }).first()).toBeVisible()
    await expect(openUnit).toBeVisible()

    await openUnit.click()
    await page.getByRole('button', { name: /remove special/i }).click()
    await expect(page.getByRole('button', { name: /mark special/i })).toBeVisible()
  })

  test('sub admin can deactivate a non-sales user in demo mode', async ({ page }) => {
    await page.goto('/dashboard')
    const intro = page.getByRole('button', { name: /continue to sign in/i })
    if (await intro.first().isVisible({ timeout: 1_000 }).catch(() => false)) await intro.first().click()
    const demoSubAdmin = page.getByRole('button', { name: /continue as laila mansour/i })
    test.skip(!await demoSubAdmin.first().isVisible({ timeout: 1_000 }).catch(() => false), 'demo sign-in is disabled for this deployment')
    await demoSubAdmin.click()
    await expect(page.locator('.app-shell')).toBeVisible()

    await navigateRoute(page, 'admin/users', 'sub_admin')
    await chooseFromSelect(page, /^role$/i, /manager/i)
    await page.getByLabel(/managed users/i).getByRole('button', { name: /deactivate mona hafez/i }).click()
    await expect(page.getByLabel(/replacement sales representative/i)).toHaveCount(0)
    await page.getByRole('button', { name: /^deactivate user$/i }).click()

    await expect(page.getByText(/user deactivated and audit history updated/i)).toBeVisible()
    await expect(page.getByText(/mona hafez/i)).toHaveCount(0)
    await assertPageHealth(page)
  })
})
