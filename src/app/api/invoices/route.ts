import { NextRequest, NextResponse } from 'next/server'
import { authService } from '@/services/auth.service'
import { invoiceService } from '@/services/invoice.service'
import { toSafeErrorMessage } from '@/lib/api-errors'

export async function POST(request: NextRequest) {
  try {
    const user = await authService.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const invoice = await invoiceService.uploadInvoice(user.id, { file })

    return NextResponse.json(invoice, { status: 201 })
  } catch (error) {
    console.error('Invoice upload error:', error)
    const message = toSafeErrorMessage(error)
    const status = message === 'An unexpected error occurred' ? 500 : 400
    return NextResponse.json({ error: message }, { status })
  }
}

export async function GET() {
  try {
    const user = await authService.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const invoices = await invoiceService.getUserInvoices(user.id)

    return NextResponse.json(invoices)
  } catch (error) {
    console.error('Invoice list error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
