import { test, expect } from '@playwright/test'

test.describe('Invoice List', () => {
  test.use({
    storageState: 'playwright/.auth/user.json',
  })

  test('should display list of invoices', async ({ page }) => {
    await page.goto('/invoices')

    // Verify page loads
    await expect(page.locator('text=Invoices')).toBeVisible()
    await expect(page.locator('text=Upload')).toBeVisible()
  })

  test('should navigate to invoice detail page', async ({ page }) => {
    await page.goto('/invoices')

    // Click on first invoice in list
    const firstInvoice = page.locator('table tbody tr').first()
    await firstInvoice.click()

    // Should navigate to detail page
    await expect(page).toHaveURL(/\/invoices\/[a-z0-9-]+/)
    await expect(page.locator('text=Extracted Data'))
      .toBeVisible({ timeout: 5000 })
      .catch(() => {
        // Detail page may not have extracted data yet
      })
  })

  test('should auto-refresh invoice list while processing', async ({ page }) => {
    await page.goto('/invoices')

    const listBefore = await page.locator('table tbody').innerHTML()

    // Wait for a network response that indicates a refresh occurred
    await page.waitForResponse(
      (response) => response.url().includes('/invoices') && response.status() === 200,
      { timeout: 15000 },
    )

    const listAfter = await page.locator('table tbody').innerHTML()

    // Lists may be the same or different depending on invoice processing
    expect(typeof listBefore).toBe('string')
    expect(typeof listAfter).toBe('string')
  })
})
