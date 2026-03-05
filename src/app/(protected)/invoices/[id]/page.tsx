'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface LineItem {
  description: string
  quantity: number
  unitPrice: number
  total: number
}

interface ExtractedData {
  vendor?: string
  amount?: number
  date?: string
  lineItems?: LineItem[]
}

interface Invoice {
  id: string
  fileName: string
  status: string
  createdAt: string
  updatedAt: string
  extractedData: ExtractedData | null
  errorMessage: string | null
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'secondary',
  PROCESSING: 'outline',
  COMPLETED: 'default',
  FAILED: 'destructive',
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollDelayRef = useRef(5000)

  const fetchInvoice = useCallback(async () => {
    try {
      const res = await fetch(`/api/invoices/${id}`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to load invoice')
      }
      const data: Invoice = await res.json()
      setInvoice(data)
      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoice')
      return null
    } finally {
      setIsLoading(false)
    }
  }, [id])

  const schedulePoll = useCallback((inv: Invoice) => {
    if (pollRef.current) clearTimeout(pollRef.current)

    const shouldPoll = inv.status === 'PENDING' || inv.status === 'PROCESSING'
    if (!shouldPoll) return

    pollRef.current = setTimeout(async () => {
      const data = await fetchInvoice()
      if (data) {
        pollDelayRef.current = Math.min(pollDelayRef.current * 2, 30000)
        schedulePoll(data)
      }
    }, pollDelayRef.current)
  }, [fetchInvoice])

  useEffect(() => {
    fetchInvoice().then((data) => {
      if (data) schedulePoll(data)
    })

    return () => {
      if (pollRef.current) clearTimeout(pollRef.current)
    }
  }, [fetchInvoice, schedulePoll])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-200 animate-pulse rounded" />
        <div className="h-64 bg-gray-100 animate-pulse rounded" />
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-red-600 mb-4">{error || 'Invoice not found'}</p>
          <Button variant="outline" onClick={() => router.push('/invoices')}>
            Back to Invoices
          </Button>
        </CardContent>
      </Card>
    )
  }

  const extracted = invoice.extractedData

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{invoice.fileName}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Uploaded {new Date(invoice.createdAt).toLocaleString()}
          </p>
        </div>
        <Badge variant={STATUS_VARIANT[invoice.status] ?? 'secondary'} className="text-sm px-3 py-1">
          {invoice.status}
        </Badge>
      </div>

      {(invoice.status === 'PENDING' || invoice.status === 'PROCESSING') && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="py-4">
            <p className="text-yellow-800">
              This invoice is being processed. The page will update automatically.
            </p>
          </CardContent>
        </Card>
      )}

      {invoice.status === 'FAILED' && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <p className="text-red-800">
              Processing failed: {invoice.errorMessage || 'Unknown error'}
            </p>
          </CardContent>
        </Card>
      )}

      {invoice.status === 'COMPLETED' && extracted && (
        <Card>
          <CardHeader>
            <CardTitle>Extracted Data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {extracted.vendor && (
                <div>
                  <p className="text-sm text-gray-500">Vendor</p>
                  <p className="font-medium">{extracted.vendor}</p>
                </div>
              )}
              {extracted.amount != null && (
                <div>
                  <p className="text-sm text-gray-500">Amount</p>
                  <p className="font-medium">${extracted.amount.toFixed(2)}</p>
                </div>
              )}
              {extracted.date && (
                <div>
                  <p className="text-sm text-gray-500">Date</p>
                  <p className="font-medium">{extracted.date}</p>
                </div>
              )}
            </div>

            {extracted.lineItems && extracted.lineItems.length > 0 && (
              <div>
                <h3 className="font-medium mb-2">Line Items</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {extracted.lineItems.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell>{item.description}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">${item.unitPrice.toFixed(2)}</TableCell>
                        <TableCell className="text-right">${item.total.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Button variant="outline" onClick={() => router.push('/invoices')}>
        Back to Invoices
      </Button>
    </div>
  )
}
