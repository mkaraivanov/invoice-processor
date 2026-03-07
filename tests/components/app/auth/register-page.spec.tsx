import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock next/navigation
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

// Mock supabase client
const mockSignInWithPassword = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { signInWithPassword: mockSignInWithPassword },
  }),
}))

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

import RegisterPage from '@/app/(auth)/register/page'

function fillAndSubmit(
  email = 'user@example.com',
  password = 'securepassword',
  fullName = ''
) {
  const user = userEvent.setup()
  return async () => {
    if (fullName) await user.type(screen.getByLabelText('Full Name'), fullName)
    await user.type(screen.getByLabelText('Email'), email)
    await user.type(screen.getByLabelText('Password'), password)
    await user.click(screen.getByRole('button', { name: /sign up/i }))
  }
}

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to dashboard on successful registration and sign-in', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    })
    mockSignInWithPassword.mockResolvedValueOnce({ error: null })

    render(<RegisterPage />)
    await fillAndSubmit()()

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('shows error when register API returns 400', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Registration failed' }),
    })

    render(<RegisterPage />)
    await fillAndSubmit()()

    await waitFor(() => {
      expect(screen.getByText('Registration failed')).toBeInTheDocument()
    })
    expect(mockSignInWithPassword).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('shows error when register API returns 400 for duplicate email', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Registration failed' }),
    })

    render(<RegisterPage />)
    await fillAndSubmit('existing@example.com')()

    await waitFor(() => {
      expect(screen.getByText('Registration failed')).toBeInTheDocument()
    })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('shows error when Supabase sign-in fails after registration (e.g. email confirmation required)', async () => {
    // Registration succeeds but sign-in fails because email is not yet confirmed.
    // This is the root cause of the Supabase 400 in the browser console.
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    })
    mockSignInWithPassword.mockResolvedValueOnce({
      error: { message: 'Email not confirmed' },
    })

    render(<RegisterPage />)
    await fillAndSubmit()()

    await waitFor(() => {
      expect(screen.getByText('Email not confirmed')).toBeInTheDocument()
    })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('validates password length client-side before calling API', async () => {
    render(<RegisterPage />)
    await fillAndSubmit('user@example.com', 'short')()

    await waitFor(() => {
      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument()
    })
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
