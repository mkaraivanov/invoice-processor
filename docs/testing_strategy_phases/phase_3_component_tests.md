# Phase 3: Component Tests (React Testing Library)

---

**File**: `tests/components/LoginPage.spec.tsx`

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import LoginPage from '@/app/(auth)/login/page'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: vi.fn(),
    },
  }),
}))

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render login form', () => {
    render(<LoginPage />)

    expect(screen.getByText(/login/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('should show error message on failed login', async () => {
    const mockCreateClient = vi.fn()
    vi.mocked(mockCreateClient).mockReturnValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          error: { message: 'Invalid credentials' },
        }),
      },
    } as any)

    render(<LoginPage />)

    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /login/i })

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'wrong' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
    })
  })

  it('should have link to register page', () => {
    render(<LoginPage />)

    const registerLink = screen.getByRole('link', { name: /register/i })
    expect(registerLink).toHaveAttribute('href', '/register')
  })
})
```

---

**File**: `tests/components/DashboardPage.spec.tsx`

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import DashboardPage from '@/app/(protected)/dashboard/page'

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { id: '1', status: 'PENDING' },
        { id: '2', status: 'COMPLETED' },
        { id: '3', status: 'FAILED' },
      ],
    })
  })

  it('should render dashboard heading', () => {
    render(<DashboardPage />)

    expect(screen.getByText(/dashboard/i)).toBeInTheDocument()
  })

  it('should display invoice statistics', async () => {
    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument() // Total
      expect(screen.getByText('1')).toBeInTheDocument() // Pending
    })
  })

  it('should show upload link', () => {
    render(<DashboardPage />)

    const uploadLink = screen.getByRole('link', { name: /upload/i })
    expect(uploadLink).toHaveAttribute('href', '/invoices')
  })
})
```
