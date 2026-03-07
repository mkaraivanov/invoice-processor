import { describe, it, expect } from 'vitest'
import { createUserSchema, signInSchema } from '@/types'

describe('createUserSchema', () => {
  it('accepts valid input', () => {
    const result = createUserSchema.safeParse({
      email: 'user@example.com',
      password: 'securepassword',
    })
    expect(result.success).toBe(true)
  })

  it('accepts optional fullName', () => {
    const result = createUserSchema.safeParse({
      email: 'user@example.com',
      password: 'securepassword',
      fullName: 'John Doe',
    })
    expect(result.success).toBe(true)
    expect(result.data?.fullName).toBe('John Doe')
  })

  it('rejects missing email', () => {
    const result = createUserSchema.safeParse({ password: 'securepassword' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid email format', () => {
    const result = createUserSchema.safeParse({
      email: 'not-an-email',
      password: 'securepassword',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Invalid email')
  })

  it('rejects password shorter than 8 characters', () => {
    const result = createUserSchema.safeParse({
      email: 'user@example.com',
      password: 'short',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Password must be at least 8 characters')
  })

  it('accepts password of exactly 8 characters', () => {
    const result = createUserSchema.safeParse({
      email: 'user@example.com',
      password: '12345678',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing password', () => {
    const result = createUserSchema.safeParse({ email: 'user@example.com' })
    expect(result.success).toBe(false)
  })
})

describe('signInSchema', () => {
  it('accepts valid credentials', () => {
    const result = signInSchema.safeParse({
      email: 'user@example.com',
      password: 'anypassword',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty password', () => {
    const result = signInSchema.safeParse({
      email: 'user@example.com',
      password: '',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Password is required')
  })

  it('rejects invalid email', () => {
    const result = signInSchema.safeParse({
      email: 'bad-email',
      password: 'anypassword',
    })
    expect(result.success).toBe(false)
  })
})
