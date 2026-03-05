---
name: new-service
description: Scaffold a service class for a given domain following project conventions
disable-model-invocation: true
argument-hint: "[domain-name]"
---
Scaffold a service for the `$ARGUMENTS` domain.

## Files to produce

1. `src/services/$ARGUMENTS.service.ts`
2. Zod input schemas in `src/types/index.ts` (add alongside existing schemas)

## Service structure

```typescript
import { ${camelCase}Repository } from '@/repositories/$ARGUMENTS.repository'
import { createInputSchema, type CreateInput } from '@/types'

export const ${camelCase}Service = {
  async create(userId: string, input: CreateInput) {
    createInputSchema.parse(input)  // validate first
    return ${camelCase}Repository.create({ ...input, userId })
  },

  async getById(id: string, userId: string) {
    const record = await ${camelCase}Repository.findById(id)
    if (!record) throw new Error('Not found')
    if (record.userId !== userId) throw new Error('Unauthorized')  // AFTER fetch
    return record
  },

  async listForUser(userId: string) {
    return ${camelCase}Repository.findMany({ userId })
  },

  async update(id: string, userId: string, input: CreateInput) {
    createInputSchema.parse(input)
    const existing = await ${camelCase}Repository.findById(id)
    if (!existing) throw new Error('Not found')
    if (existing.userId !== userId) throw new Error('Unauthorized')
    return ${camelCase}Repository.update(id, input)
  },

  async delete(id: string, userId: string) {
    const existing = await ${camelCase}Repository.findById(id)
    if (!existing) throw new Error('Not found')
    if (existing.userId !== userId) throw new Error('Unauthorized')
    return ${camelCase}Repository.delete(id)
  },
}
```

## Mandatory rules

### Ownership check (non-negotiable)
The check goes AFTER the fetch, not before. This is intentional:
- Not found → throw `'Not found'` (becomes 404)
- Found but wrong user → throw `'Unauthorized'` (becomes 403)
Checking before the fetch would collapse both cases into 403 and leak that a record exists.

### `userId` flows in as a parameter
Services do NOT call `authService.getUser()` internally. The API route retrieves the user from the session and passes `userId` into every service method. This keeps services testable in isolation.

### Imports
- Import repositories from `@/repositories/...`
- Import Zod schemas from `@/types`
- Never import `prisma` directly — that is the repository's job
- Never import from `@prisma/client`

### Zod schemas
Define in `src/types/index.ts`:
```typescript
export const createInvoiceSchema = z.object({ ... })
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>
```

## After creating

```bash
npx tsc --noEmit
```
