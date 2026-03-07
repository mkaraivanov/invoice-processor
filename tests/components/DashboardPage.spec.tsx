import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import DashboardPage from '@/app/(protected)/dashboard/page'

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render dashboard heading', () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    })

    render(<DashboardPage />)

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('should show all stat card titles', () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    })

    render(<DashboardPage />)

    expect(screen.getByText('Total Invoices')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.getByText('Failed')).toBeInTheDocument()
  })

  it('should display invoice statistics after loading', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { id: '1', status: 'PENDING' },
        { id: '2', status: 'COMPLETED' },
        { id: '3', status: 'FAILED' },
      ],
    })

    render(<DashboardPage />)

    await waitFor(() => {
      // Total = 3, Pending = 1, Completed = 1, Failed = 1
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getAllByText('1')).toHaveLength(3)
    })
  })

  it('should display zeros when fetch fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false })

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getAllByText('0')).toHaveLength(4)
    })
  })
})
