import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function MyServicesCardSkeleton() {
  return (
    <Card className="flex flex-col rounded-xl border bg-card shadow-sm p-4 gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="flex gap-1.5">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      </div>

      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-4/5" />

      <div className="rounded-lg border border-border/40 bg-muted/20 px-3 py-2.5">
        <div className="flex items-start gap-2.5">
          <Skeleton className="h-7 w-7 shrink-0 rounded-md" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      </div>

      <div className="space-y-1.5 rounded-md border border-border/40 bg-background/60 px-2.5 py-2">
        {[1, 2, 3].map((key) => (
          <div key={key} className="flex items-start gap-2">
            <Skeleton className="h-3.5 w-3.5 shrink-0 rounded-sm" />
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </div>

      <div className="mt-auto border-t border-border/50 pt-3 flex items-center justify-end gap-2">
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-28 rounded-full" />
      </div>
    </Card>
  );
}
