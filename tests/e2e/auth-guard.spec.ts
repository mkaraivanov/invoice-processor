import { test, expect } from '@playwright/test'

// These tests run with the authenticated storageState from auth.setup.ts

test.describe('Authenticated routes', () => {
  test('dashboard is accessible when logged in', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL('/dashboard')
  })

  test('invoices list is accessible when logged in', async ({ page }) => {
    await page.goto('/invoices')
    await expect(page).toHaveURL('/invoices')
  })
})

test.describe('Auth guard — unauthenticated', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('redirects /dashboard to /login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })

  test('redirects /invoices to /login when not authenticated', async ({ page }) => {
    await page.goto('/invoices')
    await expect(page).toHaveURL(/\/login/)
  })

  test('/login page renders without redirect', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveURL('/login')
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  })

  test('/register page renders without redirect', async ({ page }) => {
    await page.goto('/register')
    await expect(page).toHaveURL('/register')
    await expect(page.getByRole('button', { name: /sign up/i })).toBeVisible()
  })
})
