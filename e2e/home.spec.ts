import { expect, test } from '@playwright/test'

test('home page renders the join form', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByLabel('Display name')).toBeVisible()
})
