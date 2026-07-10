import { Skeleton } from "@/components/ui/skeleton";

const SKELETON_CARD_COUNT = 2;

export function SavedCardSelectorSkeleton() {
  return (
    <div
      className="space-y-4"
      aria-busy="true"
      aria-label="Carregando cartões"
      data-testid="saved-card-selector-skeleton"
    >
      <Skeleton className="h-4 w-64 max-w-full" />

      <div className="space-y-3">
        {Array.from({ length: SKELETON_CARD_COUNT }).map((_, index) => (
          <div
            key={index}
            className="flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-card p-4"
          >
            <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-12 rounded-md" />
                <Skeleton className="h-5 w-24" />
              </div>
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
        ))}
      </div>

      <Skeleton className="h-10 w-full rounded-pill" />
    </div>
  );
}
