import { expect, test } from '@playwright/test'

test.describe('join-via-invite page', () => {
  test('shows the room name and Join room button', async ({ page }) => {
    await page.goto('/invite/abc123')

    await expect(page.getByRole('heading', { level: 1, name: 'Night Owls' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Join room' })).toBeVisible()
  })

  test('theme toggle switches the document from dark to light', async ({ page }) => {
    await page.goto('/invite/abc123')
    const html = page.locator('html')

    await expect(html).toHaveClass(/\bdark\b/)
    await page.getByRole('button', { name: 'Switch to light theme' }).click()
    await expect(html).toHaveClass(/\blight\b/)
    await expect(html).not.toHaveClass(/\bdark\b/)
  })

  test.describe('mobile viewport', () => {
    test.use({ viewport: { width: 390, height: 844 } })

    test('keeps the Join room button visible without horizontal scrolling', async ({ page }) => {
      await page.goto('/invite/abc123')

      await expect(page.getByRole('button', { name: 'Join room' })).toBeVisible()
      // Evaluated on <html> (document.documentElement); e2e tsconfig has no DOM lib.
      const { scrollWidth, clientWidth } = await page.locator('html').evaluate((root) => ({
        scrollWidth: root.scrollWidth,
        clientWidth: root.clientWidth,
      }))
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
    })
  })
})
