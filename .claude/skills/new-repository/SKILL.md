---
name: new-repository
description: Scaffold a Prisma-backed repository for a given Prisma model
disable-model-invocation: true
argument-hint: "[ModelName]"
---
Scaffold a Prisma repository for the `$ARGUMENTS` model.

## Before writing any code

Check that `$ARGUMENTS` exists in `prisma/schema.prisma`. If not, stop and tell the user to define the model and run `/db-migrate` first.

## File to create

`src/repositories/${kebab-case($ARGUMENTS)}.repository.ts`
(e.g., `InvoiceLineItem` → `invoice-line-item.repository.ts`)

## Mandatory imports

```typescript
// CORRECT
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/app/generated/prisma/client'

// NEVER write this — runtime failure
// import { ... } from '@prisma/client'
```

## Repository structure — object-literal export pattern

```typescript
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/app/generated/prisma/client'

export const ${camelCase}Repository = {
  async create(data: Prisma.${ModelName}CreateInput) {
    return prisma.${camelCase}.create({ data })
  },

  async findById(id: string) {
    return prisma.${camelCase}.findUnique({ where: { id } })
  },

  async findMany(where?: Prisma.${ModelName}WhereInput) {
    return prisma.${camelCase}.findMany({ where })
  },

  async update(id: string, data: Prisma.${ModelName}UpdateInput) {
    return prisma.${camelCase}.update({ where: { id }, data })
  },

  async delete(id: string) {
    return prisma.${camelCase}.delete({ where: { id } })
  },
}
```

## Rules

- No business logic — data access only
- Return `null` on not-found; do not throw
- Use `Prisma.${ModelName}GetPayload<...>` for complex return types with `include`

## After creating

```bash
npx tsc --noEmit
```
