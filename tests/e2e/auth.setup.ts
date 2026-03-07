import { test as setup, expect } from '@playwright/test'
import path from 'path'

const authFile = path.join(__dirname, '../../playwright/.auth/user.json')

setup('authenticate', async ({ page }) => {
  const email = process.env['TEST_USER_EMAIL']
  const password = process.env['TEST_USER_PASSWORD']

  if (!email || !password) {
    // Write an empty auth state so dependent tests can still run (unauthenticated)
    await page.context().storageState({ path: authFile })
    console.warn(
      'TEST_USER_EMAIL / TEST_USER_PASSWORD not set — skipping auth setup. ' +
      'Authenticated tests will fail. Add them to .env.local to run the full suite.'
    )
    return
  }

  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  // force:true bypasses the Next.js dev overlay portal that intercepts pointer events
  await page.getByRole('button', { name: /sign in/i }).click({ force: true })

  await page.waitForURL('/dashboard', { timeout: 15000 })

  await page.context().storageState({ path: authFile })
})
