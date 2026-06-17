import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface ServiceDetailSkeletonProps {
  className?: string;
}

function ServiceDetailSectionSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-elevation-1 sm:p-5">
      <Skeleton className="h-4 w-28" />
      <div className="mt-3 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

export function ServiceDetailSkeleton({ className }: ServiceDetailSkeletonProps) {
  return (
    <div
      className={cn("space-y-4", className)}
      aria-busy="true"
      aria-label="Carregando detalhes do serviço"
    >
      <article className="overflow-hidden rounded-lg border border-border bg-card shadow-elevation-1">
        <div className="space-y-4 p-4 sm:p-6">
          <div className="flex min-w-0 items-start gap-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-5 w-3/4" />
                </div>
                <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
              </div>
              <div className="flex flex-wrap gap-3">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>

        <div className="border-t border-border/80 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-9 w-28 rounded-md" />
            <Skeleton className="h-9 w-32 rounded-md" />
          </div>
        </div>
      </article>

      <ServiceDetailSectionSkeleton />
      <ServiceDetailSectionSkeleton />
    </div>
  );
}
