import { test, expect } from '@playwright/test'

test.describe('Invoice Ownership', () => {
  test.use({
    storageState: 'playwright/.auth/user.json',
  })

  test('should not access other user invoices', async ({ page, context }) => {
    // Get first user's invoice ID
    await page.goto('/invoices')
    const invoiceLink = page.locator('a[href*="/invoices/"]').first()
    const invoiceUrl = await invoiceLink.getAttribute('href')
    const invoiceId = invoiceUrl?.split('/').pop()

    // Create a new user session
    const newContext = await context.browser()!.newContext()
    const newPage = await newContext.newPage()

    // Register second user
    const secondUserEmail = `test2-${Date.now()}@example.com`
    await newPage.goto('/register')
    await newPage.fill('input[name="email"]', secondUserEmail)
    await newPage.fill('input[name="fullName"]', 'Second User')
    await newPage.fill('input[name="password"]', 'password123')
    await newPage.click('button[type="submit"]')
    await expect(newPage).toHaveURL('/dashboard')

    // Try to access first user's invoice
    await newPage.goto(`/invoices/${invoiceId}`)

    // Should show error or redirect
    await expect(newPage.locator('text=/not found|unauthorized/i')).toBeVisible()

    await newContext.close()
  })
})
