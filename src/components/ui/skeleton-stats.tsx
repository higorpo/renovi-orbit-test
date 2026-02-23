import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface SkeletonStatsProps {
  count?: number
}

export function SkeletonStats({ count = 4 }: SkeletonStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="p-3 sm:p-4 text-center">
          <Skeleton className="h-3 w-16 mx-auto mb-2" />
          <Skeleton className="h-7 w-10 mx-auto" />
        </Card>
      ))}
    </div>
  )
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
        >
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}
