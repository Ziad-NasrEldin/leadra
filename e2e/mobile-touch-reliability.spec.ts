import { expect, test, type Locator, type Page } from '@playwright/test'

async function completeDemoSignIn(page: Page) {
  await page.goto('/dashboard')
  const intro = page.getByRole('button', { name: /continue to sign in/i })
  if (await intro.first().isVisible({ timeout: 1_000 }).catch(() => false)) {
    await intro.first().click()
  }
  await page.getByRole('button', { name: /continue as admin/i }).click()
  await expect(page.locator('.app-shell')).toBeVisible()
}

async function expectReceivesTap(locator: Locator) {
  await expect(locator).toBeVisible()
  await locator.scrollIntoViewIfNeeded()
  const blockedBy = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    const top = document.elementFromPoint(x, y)
    if (!top) return 'none'
    if (element === top || element.contains(top) || top.contains(element)) return null
    return `${top.tagName.toLowerCase()}${top.id ? `#${top.id}` : ''}${top.className ? `.${String(top.className).replace(/\s+/g, '.')}` : ''}`
  })
  expect(blockedBy).toBeNull()
}

test.describe('mobile touch reliability', () => {
  test('core nav and unit controls respond to one tap on mobile', async ({ page }) => {
    await completeDemoSignIn(page)

    const unitsNav = page.getByRole('link', { name: /units/i }).first()
    await expectReceivesTap(unitsNav)
    await unitsNav.tap()
    await expect(page).toHaveURL(/\/units$/)
    await expect(page.getByRole('heading', { name: /search all units/i })).toBeVisible()

    const filterButton = page.getByRole('button', { name: /show filters/i }).first()
    await expectReceivesTap(filterButton)
    await filterButton.tap()
    await expect(page.getByLabel(/unit code/i)).toBeVisible()

    const firstDestination = page.locator('.inventory-scope-card').first()
    await expectReceivesTap(firstDestination)
    await firstDestination.tap()
    await expect(page).toHaveURL(/\/units\/destinations\//)

    const project = page.locator('.inventory-scope-card').first()
    await expectReceivesTap(project)
    await project.tap()
    await expect(page).toHaveURL(/\/units\/destinations\/[^/]+\/projects\//)

    const openUnit = page.locator('.unit-row-open').first()
    await expectReceivesTap(openUnit)
    await openUnit.tap()
    await expect(page.getByRole('heading').first()).toBeVisible()
  })
})
