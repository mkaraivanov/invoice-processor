// Note: .env.test is loaded in tests/global-setup.ts (main process, before workers fork).
// Workers inherit process.env, so DATABASE_URL is available when this file is imported.

import { beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'

beforeAll(async () => {
  await prisma.$connect()
})

afterAll(async () => {
  await prisma.$disconnect()
})
