import { PrismaClient } from "@/app/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Check your .env.local file.")
}

// pg v8.20+ treats sslmode=require as verify-full; uselibpqcompat=true restores
// standard libpq behaviour (require SSL without certificate verification).
const dbUrl = new URL(process.env.DATABASE_URL)
dbUrl.searchParams.set('uselibpqcompat', 'true')

const adapter = new PrismaPg({ connectionString: dbUrl.toString() })

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({ adapter })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
