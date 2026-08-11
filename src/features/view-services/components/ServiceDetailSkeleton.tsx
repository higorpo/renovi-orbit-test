import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ServiceDetailAttributeCardsSkeleton } from "./ServiceDetailAttributeCards";
import { ServiceDetailActionsBarSkeleton } from "./ServiceDetailActionsBar";

export interface ServiceDetailSkeletonProps {
  className?: string;
  isWideLayout?: boolean;
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

function AsideCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-elevation-1 sm:p-5">
      <Skeleton className="h-4 w-36" />
      <div className="mt-3 space-y-2">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}

function HeaderSkeleton() {
  return (
    <article className="overflow-hidden rounded-lg border border-border bg-card shadow-elevation-1">
      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex min-w-0 items-start gap-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
        <ServiceDetailAttributeCardsSkeleton />
        <ServiceDetailActionsBarSkeleton />
      </div>
    </article>
  );
}

export function ServiceDetailSkeleton({
  className,
  isWideLayout = false,
}: ServiceDetailSkeletonProps) {
  return (
    <div
      className={cn(className)}
      aria-busy="true"
      aria-label="Carregando detalhes do serviço"
    >
      {isWideLayout ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] items-start gap-4">
            <div className="flex flex-col gap-4">
              <HeaderSkeleton />
              <ServiceDetailSectionSkeleton />
              <ServiceDetailSectionSkeleton />
            </div>
            <aside className="flex flex-col gap-4">
              <AsideCardSkeleton />
              <AsideCardSkeleton />
              <AsideCardSkeleton />
            </aside>
          </div>
          <AsideCardSkeleton />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <HeaderSkeleton />
          <ServiceDetailSectionSkeleton />
          <AsideCardSkeleton />
          <AsideCardSkeleton />
        </div>
      )}
    </div>
  );
}
