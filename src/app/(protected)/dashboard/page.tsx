'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Invoice {
  id: string
  status: string
}

interface Stats {
  total: number
  pending: number
  completed: number
  failed: number
}

function computeStats(invoices: Invoice[]): Stats {
  return {
    total: invoices.length,
    pending: invoices.filter((i) => i.status === 'PENDING' || i.status === 'PROCESSING').length,
    completed: invoices.filter((i) => i.status === 'COMPLETED').length,
    failed: invoices.filter((i) => i.status === 'FAILED').length,
  }
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, completed: 0, failed: 0 })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/invoices')
        if (!res.ok) return
        const invoices: Invoice[] = await res.json()
        setStats(computeStats(invoices))
      } finally {
        setIsLoading(false)
      }
    }
    fetchStats()
  }, [])

  const cards = [
    { title: 'Total Invoices', value: stats.total, color: 'text-gray-900' },
    { title: 'Pending', value: stats.pending, color: 'text-yellow-600' },
    { title: 'Completed', value: stats.completed, color: 'text-green-600' },
    { title: 'Failed', value: stats.failed, color: 'text-red-600' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">{card.title}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-8 w-16 bg-gray-200 animate-pulse rounded" />
              ) : (
                <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
