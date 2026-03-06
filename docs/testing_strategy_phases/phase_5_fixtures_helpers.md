# Phase 5: Test Fixtures & Helpers

---

## 5.1 Auth Fixture

> **Scope**: This fixture is for **E2E / Playwright tests only**. It uses the
> Supabase service-role key to create real users in the test project. Do not use
> it in Vitest unit or integration tests — those mock Supabase instead.

**File**: `tests/fixtures/auth.fixture.ts`

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env['NEXT_PUBLIC_SUPABASE_URL']!,
  process.env['SUPABASE_SERVICE_ROLE_KEY']!
)

export async function createTestUser(
  email: string,
  password: string
): Promise<{ id: string; email: string }> {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error) throw new Error(`Failed to create test user: ${error.message}`)

  return { id: data.user!.id, email: data.user!.email! }
}

export async function deleteTestUser(userId: string): Promise<void> {
  const { error } = await supabase.auth.admin.deleteUser(userId)
  if (error) throw new Error(`Failed to delete test user: ${error.message}`)
}

export async function createTestSession(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) throw new Error(`Failed to create session: ${error.message}`)

  return data.session!
}
```

---

## 5.2 Supabase Mock

**File**: `tests/fixtures/mocks/supabase.mock.ts`

```typescript
import { vi } from 'vitest'

export const mockSupabaseClient = {
  auth: {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    getUser: vi.fn(),
    admin: {
      createUser: vi.fn(),
      deleteUser: vi.fn(),
    },
  },
  from: vi.fn(),
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn(),
      download: vi.fn(),
      createSignedUrl: vi.fn(),
      remove: vi.fn(),
    })),
  },
}

export function resetSupabaseMocks() {
  Object.values(mockSupabaseClient.auth).forEach((method) => {
    if (typeof method === 'object' && 'mockClear' in method) {
      method.mockClear()
    }
  })
}
```

---

## 5.3 Storage Mock

**File**: `tests/fixtures/mocks/storage.mock.ts`

```typescript
import { vi } from 'vitest'

export const mockStorageService = {
  uploadInvoiceFile: vi.fn(async (userId: string, file: File) => {
    return `${userId}/${Math.random().toString(36).substring(7)}`
  }),

  getSignedUrl: vi.fn(async (path: string) => {
    return `https://example.supabase.co/storage/signed/${path}`
  }),

  deleteFile: vi.fn(async (path: string) => {
    // noop
  }),
}
```
