import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface SimpleServiceCardSkeletonProps {
  className?: string;
}

export function SimpleServiceCardSkeleton({ className }: SimpleServiceCardSkeletonProps) {
  return (
    <Card className={cn("shadow-none", className)}>
      <CardHeader className="space-y-3 !pb-3">
        <div className="flex min-w-0 items-start gap-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-full max-w-[220px]" />
          </div>
        </div>
        <Skeleton className="h-10 w-full" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-3 w-40" />
      </CardHeader>
    </Card>
  );
}
