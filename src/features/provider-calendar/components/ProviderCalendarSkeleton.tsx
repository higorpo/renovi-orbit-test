import { Skeleton } from "@/components/ui/skeleton";
import type { CalendarViewMode } from "../types/provider-calendar.types";

const WEEKDAY_HEADERS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function CalendarServiceChipSkeleton({ withBadge = false }: { withBadge?: boolean }) {
  return (
    <div className="rounded-xl border border-border/80 bg-card px-3.5 py-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-4 w-3/5 max-w-[180px]" />
        {withBadge ? <Skeleton className="h-5 w-14 shrink-0 rounded-full" /> : null}
      </div>
      <Skeleton className="mt-2 h-3 w-24" />
    </div>
  );
}

function CalendarListDaySectionSkeleton({
  chipCount,
  withBadge = false,
  empty = false,
}: {
  chipCount: number;
  withBadge?: boolean;
  empty?: boolean;
}) {
  return (
    <section className="border-b border-border/70 pb-6 last:border-b-0">
      <header className="-mx-1 mb-4 border-b border-border/60 px-1 py-3">
        <div className="flex items-end justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-3 w-28" />
            <div className="flex items-baseline gap-2">
              <Skeleton className="h-9 w-10 rounded-md" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <Skeleton className="h-7 w-14 rounded-full" />
        </div>
      </header>

      {empty ? (
        <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 px-4 py-5">
          <Skeleton className="mx-auto h-4 w-56 max-w-full" />
        </div>
      ) : (
        <ul className="space-y-3">
          {Array.from({ length: chipCount }).map((_, index) => (
            <li key={index}>
              <CalendarServiceChipSkeleton withBadge={withBadge && index === 0} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ProviderCalendarListSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Carregando agenda em lista">
      <CalendarListDaySectionSkeleton chipCount={1} />
      <CalendarListDaySectionSkeleton chipCount={2} withBadge />
      <CalendarListDaySectionSkeleton empty />
    </div>
  );
}

function ProviderCalendarGridSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando agenda mensal">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-40" />
        </div>
        <div className="flex items-center gap-1">
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-9 w-14 rounded-full" />
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="grid grid-cols-7 border-b border-border/70 bg-muted/30">
          {WEEKDAY_HEADERS.map((label) => (
            <div key={label} className="px-2 py-2 text-center">
              <Skeleton className="mx-auto h-3 w-6" />
            </div>
          ))}
        </div>

        <div>
          {Array.from({ length: 5 }).map((_, weekIndex) => (
            <div
              key={weekIndex}
              className="grid grid-cols-7 divide-x divide-border/60 border-b border-border/70 last:border-b-0"
            >
              {Array.from({ length: 7 }).map((__, dayIndex) => {
                const showChip = (weekIndex + dayIndex) % 4 === 0;
                const showBarSpacer = weekIndex === 1;

                return (
                  <div key={dayIndex} className="flex min-h-[108px] flex-col">
                    <div className="px-2 pt-2 pb-3">
                      <Skeleton className="h-7 w-7 rounded-full" />
                    </div>
                    {showBarSpacer ? <Skeleton className="mx-2 mb-2 h-[46px] rounded-xl" /> : null}
                    <div className="flex flex-1 flex-col gap-1 px-2 pb-2 pt-1">
                      {showChip ? (
                        <div className="rounded-xl border border-border/80 px-2.5 py-2">
                          <Skeleton className="h-3 w-full" />
                          <Skeleton className="mt-1.5 h-2.5 w-2/3" />
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export interface ProviderCalendarSkeletonProps {
  viewMode: CalendarViewMode;
}

export function ProviderCalendarSkeleton({ viewMode }: ProviderCalendarSkeletonProps) {
  if (viewMode === "grid") {
    return <ProviderCalendarGridSkeleton />;
  }

  return <ProviderCalendarListSkeleton />;
}
