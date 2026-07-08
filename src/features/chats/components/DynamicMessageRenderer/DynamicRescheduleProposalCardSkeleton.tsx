import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface DynamicRescheduleProposalCardSkeletonProps {
  isOutgoing: boolean;
  className?: string;
}

export function DynamicRescheduleProposalCardSkeleton({
  isOutgoing,
  className,
}: DynamicRescheduleProposalCardSkeletonProps) {
  return (
    <article
      className={cn(
        "w-full max-w-[88%] rounded-2xl border border-border/60 bg-muted/30 px-4 py-4 shadow-sm",
        isOutgoing ? "ml-auto" : "mr-auto",
        className,
      )}
      aria-busy="true"
      aria-label="Carregando reagendamento"
    >
      <div className="flex items-start gap-2">
        <Skeleton className="mt-0.5 h-4 w-4 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-full max-w-[14rem]" />
            <Skeleton className="h-4 w-[85%] max-w-[12rem]" />
          </div>

          <Skeleton className="h-16 w-full rounded-lg" />

          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-9 w-32 rounded-full" />
            <Skeleton className="h-9 w-24 rounded-full" />
          </div>
        </div>
      </div>
    </article>
  );
}
