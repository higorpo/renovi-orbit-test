import { cn } from "@/lib/utils";

function ShimmerBlock({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-md bg-muted", className)} aria-hidden>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-background/70 to-transparent" />
    </div>
  );
}

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
        <ShimmerBlock className="mt-0.5 h-4 w-4 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-4">
          <div className="space-y-2">
            <ShimmerBlock className="h-4 w-32" />
            <ShimmerBlock className="h-4 w-full max-w-[14rem]" />
            <ShimmerBlock className="h-4 w-[85%] max-w-[12rem]" />
            <ShimmerBlock className="h-5 w-24" />
          </div>

          <div className="flex flex-wrap gap-2">
            <ShimmerBlock className="h-9 w-24 rounded-full" />
            <ShimmerBlock className="h-9 w-20 rounded-full" />
          </div>

          <ShimmerBlock className="h-11 w-full rounded-xl" />
        </div>
      </div>
    </article>
  );
}
