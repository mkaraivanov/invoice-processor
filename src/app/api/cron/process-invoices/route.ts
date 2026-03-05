import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { invoiceService } from '@/services/invoice.service'

export const maxDuration = 10 // Vercel Hobby limit

function isValidCronSecret(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret || !authHeader) return false
  const expected = Buffer.from(`Bearer ${secret}`)
  const actual = Buffer.from(authHeader)
  if (expected.length !== actual.length) return false
  return timingSafeEqual(expected, actual)
}

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sends Authorization header)
  if (!isValidCronSecret(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await invoiceService.processPendingInvoices()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Cron processing error:', error)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}
