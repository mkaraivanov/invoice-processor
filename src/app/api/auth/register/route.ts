import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { authService } from '@/services/auth.service'
import { createUserSchema } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const input = createUserSchema.parse(body)

    await authService.signUp(input)

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error('Registration error:', error)

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: 'Registration failed' }, { status: 400 })
  }
}
