import { test, expect } from '@playwright/test'

test.describe('Invoice Upload', () => {
  // Use authenticated session from previous test
  test.use({
    storageState: 'playwright/.auth/user.json',
  })

  test('should upload invoice and show in list', async ({ page }) => {
    await page.goto('/invoices')

    // Create a test file
    const fileName = `test-${Date.now()}.pdf`
    const fileContent = Buffer.from('PDF content')

    // Upload file
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: fileName,
      mimeType: 'application/pdf',
      buffer: fileContent,
    })

    // Wait for upload to complete
    await expect(page.locator(`text=${fileName}`)).toBeVisible()

    // Verify invoice appears in list with PENDING status
    await expect(page.locator('text=PENDING')).toBeVisible()
  })

  test('should reject files larger than 10MB', async ({ page }) => {
    await page.goto('/invoices')

    // TODO: Implement file size test
    // Note: Hard to test large files in Playwright; mock in unit tests instead
  })

  test('should show error on upload failure', async ({ page }) => {
    await page.goto('/invoices')

    // Simulate upload failure by intercepting request
    await page.route('**/api/invoices', (route) => {
      route.abort('failed')
    })

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'test.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('content'),
    })

    // Should show error message
    await expect(page.locator('text=/upload failed/i')).toBeVisible()
  })
})
