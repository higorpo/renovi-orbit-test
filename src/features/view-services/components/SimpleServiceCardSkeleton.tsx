import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface SimpleServiceCardSkeletonProps {
  className?: string;
  compact?: boolean;
}

export function SimpleServiceCardSkeleton({
  className,
  compact = false,
}: SimpleServiceCardSkeletonProps) {
  return (
    <Card className={cn("shadow-none", className)}>
      <CardHeader
        className={cn(
          compact ? "space-y-2 !p-3 !pb-3" : "space-y-3 !pb-3",
        )}
      >
        <div className={cn("flex min-w-0 items-start", compact ? "gap-2.5" : "gap-3")}>
          <Skeleton className={cn("shrink-0 rounded-lg", compact ? "h-8 w-8" : "h-10 w-10")} />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className={cn(compact ? "h-2.5 w-20" : "h-3 w-24")} />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
        <div className="space-y-2">
          <Skeleton className={cn("w-full", compact ? "h-9" : "h-12")} />
          <div
            className={cn(
              "space-y-2 rounded-lg border border-border/60 bg-muted/20",
              compact ? "px-2 py-2" : "px-3 py-2.5",
            )}
          >
            <Skeleton className={cn(compact ? "h-2.5 w-24" : "h-3 w-28")} />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </div>
        <Skeleton className={cn(compact ? "h-3 w-full" : "h-3 w-40")} />
        {!compact ? <Skeleton className="h-3 w-32" /> : null}
      </CardHeader>
    </Card>
  );
}
