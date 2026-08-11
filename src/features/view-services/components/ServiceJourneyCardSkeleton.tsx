import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { SERVICE_JOURNEY_CARD_TITLE } from "../constants/serviceJourney.constants";

export interface ServiceJourneyCardSkeletonProps {
  className?: string;
  rows?: number;
}

export function ServiceJourneyCardSkeleton({
  className,
  rows = 6,
}: ServiceJourneyCardSkeletonProps) {
  return (
    <ul
      className={cn("space-y-5", className)}
      aria-busy="true"
      aria-label={`Carregando ${SERVICE_JOURNEY_CARD_TITLE}`}
      data-testid="service-journey-card-skeleton"
    >
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-4">
          <div className="flex h-11 items-center justify-center">
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          </div>
          <div className="flex h-11 min-w-0 flex-col justify-center gap-1.5">
            <Skeleton className="h-4 w-44 max-w-full" />
            <Skeleton className="h-3.5 w-28 max-w-[65%]" />
          </div>
        </li>
      ))}
    </ul>
  );
}
