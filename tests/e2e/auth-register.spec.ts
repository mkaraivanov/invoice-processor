import { test, expect } from '@playwright/test'

// These tests run without auth state — they test the register/login flows directly
// and cover the exact 400 errors seen in the browser console.
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Register flow', () => {
  test('shows validation error for short password without calling API', async ({ page }) => {
    await page.goto('/register')

    await page.getByLabel('Email').fill('new@example.com')
    await page.getByLabel('Password').fill('short')
    await page.getByRole('button', { name: /sign up/i }).click()

    await expect(page.getByText('Password must be at least 8 characters')).toBeVisible()

    // API should not have been called — verify by checking no network request was fired
    const apiCalled = await page
      .waitForRequest('/api/auth/register', { timeout: 1000 })
      .then(() => true)
      .catch(() => false)
    expect(apiCalled).toBe(false)
  })

  test('shows error when registering with an already-used email', async ({ page }) => {
    const existingEmail = process.env['TEST_USER_EMAIL']
    if (!existingEmail) test.skip()

    await page.goto('/register')

    await page.getByLabel('Email').fill(existingEmail!)
    await page.getByLabel('Password').fill('securepassword123')
    await page.getByRole('button', { name: /sign up/i }).click()

    // Should show an error, NOT redirect to dashboard
    await expect(page.getByRole('button', { name: /sign up/i })).toBeEnabled({ timeout: 10000 })
    await expect(page).not.toHaveURL('/dashboard')
    // An error message should be visible
    await expect(page.locator('[class*="red"]')).toBeVisible()
  })

  test('shows error for invalid email format', async ({ page }) => {
    await page.goto('/register')

    // HTML5 validation on email input prevents submission — but verify the input is constrained
    const emailInput = page.getByLabel('Email')
    await emailInput.fill('not-an-email')
    await page.getByLabel('Password').fill('securepassword')

    // The submit button click — HTML5 will block it with browser validation
    await page.getByRole('button', { name: /sign up/i }).click()

    // Should remain on /register
    await expect(page).toHaveURL('/register')
    await expect(page).not.toHaveURL('/dashboard')
  })
})

test.describe('Login flow', () => {
  test('shows error for wrong password', async ({ page }) => {
    const email = process.env['TEST_USER_EMAIL']
    if (!email) test.skip()

    await page.goto('/login')

    await page.getByLabel('Email').fill(email!)
    await page.getByLabel('Password').fill('wrong-password-123')
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page.getByRole('button', { name: /sign in/i })).toBeEnabled({ timeout: 10000 })
    await expect(page).not.toHaveURL('/dashboard')
    await expect(page.locator('[class*="red"]')).toBeVisible()
  })

  test('shows error for non-existent email', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel('Email').fill('doesnotexist@example.com')
    await page.getByLabel('Password').fill('somepassword123')
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page.getByRole('button', { name: /sign in/i })).toBeEnabled({ timeout: 10000 })
    await expect(page).not.toHaveURL('/dashboard')
    await expect(page.locator('[class*="red"]')).toBeVisible()
  })
})
