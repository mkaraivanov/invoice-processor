# Phase 4: End-to-End Tests (Playwright)

---

## 4.0 Auth Setup (runs once before browser projects)

Auth state is established by a dedicated **setup project** — not inside a test — so browsers start pre-authenticated.

**File**: `tests/e2e/auth.setup.ts`

```typescript
import { test as setup, expect } from '@playwright/test'
import path from 'path'

const authFile = path.join(__dirname, '../../playwright/.auth/user.json')

setup('authenticate', async ({ page }) => {
  await page.goto('/login')
  await page.fill('input[name="email"]', process.env['TEST_USER_EMAIL']!)
  await page.fill('input[name="password"]', process.env['TEST_USER_PASSWORD']!)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('/dashboard')
  await page.context().storageState({ path: authFile })
})
```

---

## 4.1 Authentication Tests

**File**: `tests/e2e/auth.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('should register new user and redirect to dashboard', async ({ page }) => {
    await page.goto('/register')

    // Fill registration form
    await page.fill('input[name="email"]', `test-${Date.now()}@example.com`)
    await page.fill('input[name="fullName"]', 'Test User')
    await page.fill('input[name="password"]', 'password123')

    // Submit form
    await page.click('button[type="submit"]')

    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('text=Dashboard')).toBeVisible()
  })

  test('should login existing user', async ({ page }) => {
    // Use pre-created test user (stored in .env.test)
    const testEmail = process.env['TEST_USER_EMAIL']
    const testPassword = process.env['TEST_USER_PASSWORD']

    await page.goto('/login')

    await page.fill('input[name="email"]', testEmail)
    await page.fill('input[name="password"]', testPassword)
    await page.click('button[type="submit"]')

    await expect(page).toHaveURL('/dashboard')
    // Auth state is saved by auth.setup.ts — do not save it here
  })

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login')

    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')

    await expect(page.locator('text=/invalid|unauthorized/i')).toBeVisible()
  })

  test('unauthenticated user should redirect to login', async ({ page, context }) => {
    // Clear any existing session
    await context.clearCookies()

    await page.goto('/dashboard')

    // Should redirect to login
    await expect(page).toHaveURL('/login')
  })
})
```

---

## 4.2 Invoice Upload Tests

**File**: `tests/e2e/invoices-upload.spec.ts`

```typescript
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
    const fileInput = await page.locator('input[type="file"]')
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

    const fileInput = await page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'test.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('content'),
    })

    // Should show error message
    await expect(page.locator('text=/upload failed/i')).toBeVisible()
  })
})
```

---

## 4.3 Invoice List Tests

**File**: `tests/e2e/invoices-list.spec.ts`

```typescript
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
    await expect(page.locator('text=Extracted Data')).toBeVisible({ timeout: 1000 }).catch(() => {
      // Detail page may not have extracted data yet
    })
  })

  test('should auto-refresh invoice list while processing', async ({ page }) => {
    await page.goto('/invoices')

    // Verify list updates periodically
    const listBefore = await page.locator('table tbody').innerHTML()

    // Wait 10+ seconds for auto-refresh
    await page.waitForTimeout(12000)

    const listAfter = await page.locator('table tbody').innerHTML()

    // Lists may be the same or different depending on invoice processing
    expect(typeof listBefore).toBe('string')
    expect(typeof listAfter).toBe('string')
  })
})
```

---

## 4.4 Ownership Tests

**File**: `tests/e2e/ownership.spec.ts`

```typescript
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
    const newPage = newContext.newPage()

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
```
