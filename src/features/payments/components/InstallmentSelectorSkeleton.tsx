import { Skeleton } from "@/components/ui/skeleton";

const SKELETON_OPTION_COUNT = 3;

export function InstallmentSelectorSkeleton() {
  return (
    <div
      className="space-y-6"
      aria-busy="true"
      aria-label="Calculando parcelas"
      data-testid="installment-selector-skeleton"
    >
      <div className="space-y-2">
        <Skeleton className="h-4 w-40 max-w-full" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>

      <div className="space-y-3">
        {Array.from({ length: SKELETON_OPTION_COUNT }).map((_, index) => (
          <div
            key={index}
            className="flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-card p-4"
          >
            <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-3 w-44" />
            </div>
          </div>
        ))}
      </div>

      <Skeleton className="h-3 w-full max-w-md" />
    </div>
  );
}
