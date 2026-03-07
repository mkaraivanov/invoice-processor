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

    await page.fill('input[name="email"]', testEmail!)
    await page.fill('input[name="password"]', testPassword!)
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
