import { NextRequest, NextResponse } from 'next/server'
import { authService } from '@/services/auth.service'
import { invoiceService } from '@/services/invoice.service'
import { toSafeErrorMessage } from '@/lib/api-errors'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authService.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const invoice = await invoiceService.getInvoice(id, user.id)

    return NextResponse.json(invoice)
  } catch (error) {
    console.error('Invoice detail error:', error)
    const message = toSafeErrorMessage(error)
    const status = message === 'Unauthorized' ? 403 : message === 'Invoice not found' ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
