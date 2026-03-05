'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
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

interface Invoice {
  id: string
  fileName: string
  status: string
  createdAt: string
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'secondary',
  PROCESSING: 'outline',
  COMPLETED: 'default',
  FAILED: 'destructive',
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollDelayRef = useRef(5000)

  const fetchInvoices = useCallback(async () => {
    try {
      const res = await fetch('/api/invoices')
      if (!res.ok) return
      const data: Invoice[] = await res.json()
      setInvoices(data)
      return data
    } finally {
      setIsLoading(false)
    }
  }, [])

  const schedulePoll = useCallback((invoiceList: Invoice[]) => {
    if (pollIntervalRef.current) clearTimeout(pollIntervalRef.current)

    const hasPending = invoiceList.some((i) => i.status === 'PENDING' || i.status === 'PROCESSING')
    if (!hasPending) {
      pollDelayRef.current = 5000
      return
    }

    pollIntervalRef.current = setTimeout(async () => {
      const data = await fetchInvoices()
      if (data) {
        // Exponential backoff: 5s -> 10s -> 20s -> 30s max
        pollDelayRef.current = Math.min(pollDelayRef.current * 2, 30000)
        schedulePoll(data)
      }
    }, pollDelayRef.current)
  }, [fetchInvoices])

  useEffect(() => {
    fetchInvoices().then((data) => {
      if (data) schedulePoll(data)
    })

    return () => {
      if (pollIntervalRef.current) clearTimeout(pollIntervalRef.current)
    }
  }, [fetchInvoices, schedulePoll])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/invoices', { method: 'POST', body: formData })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Upload failed')
      }

      // Reset polling delay and fetch immediately
      pollDelayRef.current = 5000
      const data = await fetchInvoices()
      if (data) schedulePoll(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={handleUpload}
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? 'Uploading...' : 'Upload Invoice'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm mb-4">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-10 bg-gray-100 animate-pulse rounded" />
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No invoices yet. Upload one to get started.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.fileName}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[invoice.status] ?? 'secondary'}>
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(invoice.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`/invoices/${invoice.id}`}>
                        <Button variant="outline" size="sm">View</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
