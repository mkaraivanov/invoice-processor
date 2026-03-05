import { prisma } from '@/lib/prisma'

export const userRepository = {
  async upsert(id: string, email: string, fullName?: string) {
    return prisma.user.upsert({
      where: { id },
      create: { id, email, fullName },
      update: { email, fullName },
    })
  },

  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
    })
  },

  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
    })
  },
}
