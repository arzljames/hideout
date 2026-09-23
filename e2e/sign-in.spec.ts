import { expect, test } from '@playwright/test'

test.describe('sign-in page', () => {
  test('shows the brand heading and Steam sign-in button', async ({ page }) => {
    await page.goto('/sign-in')

    await expect(page.getByRole('heading', { level: 1, name: 'Hideout' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in with Steam' })).toBeVisible()
    await expect(page.getByRole('contentinfo')).toContainText('Powered by Steam')
  })

  test('theme toggle switches the document theme and persists it', async ({ page }) => {
    await page.goto('/sign-in')
    const html = page.locator('html')

    await expect(html).toHaveClass(/\bdark\b/)
    await page.getByRole('button', { name: 'Switch to light theme' }).click()
    await expect(html).toHaveClass(/\blight\b/)
    await expect(html).not.toHaveClass(/\bdark\b/)

    await page.reload()
    await expect(html).toHaveClass(/\blight\b/)

    await page.getByRole('button', { name: 'Switch to dark theme' }).click()
    await expect(html).toHaveClass(/\bdark\b/)
  })

  test.describe('mobile viewport', () => {
    test.use({ viewport: { width: 390, height: 844 } })

    test('keeps the sign-in button visible', async ({ page }) => {
      await page.goto('/sign-in')
      await expect(page.getByRole('button', { name: 'Sign in with Steam' })).toBeVisible()
    })
  })
})
