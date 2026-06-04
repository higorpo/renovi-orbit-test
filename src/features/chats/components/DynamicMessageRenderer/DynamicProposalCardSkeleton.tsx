import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface DynamicProposalCardSkeletonProps {
  isOutgoing: boolean;
  className?: string;
}

export function DynamicProposalCardSkeleton({
  isOutgoing,
  className,
}: DynamicProposalCardSkeletonProps) {
  return (
    <article
      className={cn(
        "w-full max-w-[88%] rounded-2xl border border-border/60 bg-muted/30 px-4 py-4 shadow-sm",
        isOutgoing ? "ml-auto" : "mr-auto",
        className,
      )}
      aria-busy="true"
      aria-label="Carregando proposta"
    >
      <div className="flex items-start gap-2">
        <Skeleton className="mt-0.5 h-4 w-4 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-full max-w-[14rem]" />
            <Skeleton className="h-4 w-[85%] max-w-[12rem]" />
            <Skeleton className="h-5 w-24" />
          </div>

          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-9 w-24 rounded-full" />
            <Skeleton className="h-9 w-20 rounded-full" />
          </div>

          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      </div>
    </article>
  );
}
