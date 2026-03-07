import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock authService before importing the route
vi.mock('@/services/auth.service', () => ({
  authService: {
    signUp: vi.fn(),
  },
}))

import { POST } from '@/app/api/auth/register/route'
import { authService } from '@/services/auth.service'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 201 on successful registration', async () => {
    vi.mocked(authService.signUp).mockResolvedValueOnce({} as never)

    const res = await POST(makeRequest({ email: 'user@example.com', password: 'securepassword' }))

    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ success: true })
    expect(authService.signUp).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'securepassword',
      fullName: undefined,
    })
  })

  it('returns 201 with fullName when provided', async () => {
    vi.mocked(authService.signUp).mockResolvedValueOnce({} as never)

    const res = await POST(
      makeRequest({ email: 'user@example.com', password: 'securepassword', fullName: 'John Doe' })
    )

    expect(res.status).toBe(201)
    expect(authService.signUp).toHaveBeenCalledWith(
      expect.objectContaining({ fullName: 'John Doe' })
    )
  })

  it('returns 400 with validation error for missing email', async () => {
    const res = await POST(makeRequest({ password: 'securepassword' }))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeTruthy()
    expect(authService.signUp).not.toHaveBeenCalled()
  })

  it('returns 400 with validation error for invalid email', async () => {
    const res = await POST(makeRequest({ email: 'not-an-email', password: 'securepassword' }))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Invalid email')
    expect(authService.signUp).not.toHaveBeenCalled()
  })

  it('returns 400 with validation error for short password', async () => {
    const res = await POST(makeRequest({ email: 'user@example.com', password: 'short' }))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Password must be at least 8 characters')
    expect(authService.signUp).not.toHaveBeenCalled()
  })

  it('returns 400 when authService.signUp throws (e.g. duplicate email)', async () => {
    vi.mocked(authService.signUp).mockRejectedValueOnce(
      new Error('Sign-up failed: User already registered')
    )

    const res = await POST(makeRequest({ email: 'existing@example.com', password: 'securepassword' }))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Registration failed')
  })

  it('returns 400 when authService.signUp throws for Supabase email confirmation required', async () => {
    // When Supabase requires email confirmation and the user tries to re-register
    // with an already-pending email, signUp may throw
    vi.mocked(authService.signUp).mockRejectedValueOnce(
      new Error('Sign-up failed: Email rate limit exceeded')
    )

    const res = await POST(makeRequest({ email: 'pending@example.com', password: 'securepassword' }))

    expect(res.status).toBe(400)
    expect(authService.signUp).toHaveBeenCalledOnce()
  })

  it('returns 400 for empty request body', async () => {
    const res = await POST(makeRequest({}))

    expect(res.status).toBe(400)
    expect(authService.signUp).not.toHaveBeenCalled()
  })
})
