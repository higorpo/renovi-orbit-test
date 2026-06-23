import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function JobCardSkeleton() {
  return (
    <Card className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card p-0 shadow-sm">
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <Skeleton className="h-5 w-full max-w-sm" />
        <Skeleton className="h-4 w-full max-w-md" />
        <Skeleton className="h-4 w-3/5 max-w-xs" />
        <div className="flex flex-col gap-1">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3.5 w-32" />
        </div>
      </div>
      <div className="mt-auto border-t border-border/60 px-4 pb-4 pt-3">
        <div className="flex justify-end">
          <Skeleton className="h-10 w-full rounded-full sm:h-9 sm:w-32" />
        </div>
      </div>
    </Card>
  );
}
