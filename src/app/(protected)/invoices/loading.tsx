import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default function InvoicesLoading() {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="h-8 w-28 bg-gray-200 animate-pulse rounded" />
        <div className="h-10 w-36 bg-gray-200 animate-pulse rounded" />
      </div>
      <Card>
        <CardHeader>
          <div className="h-6 w-28 bg-gray-200 animate-pulse rounded" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
