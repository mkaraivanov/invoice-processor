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
