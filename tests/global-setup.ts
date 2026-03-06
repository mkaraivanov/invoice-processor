// Runs in the main Vitest process before any workers fork.
// Workers inherit process.env, so DATABASE_URL etc. are available
// when setup.ts imports @/lib/prisma (which checks env at module load time).
import { config } from 'dotenv'

export function setup() {
  config({ path: '.env.test' })
}
