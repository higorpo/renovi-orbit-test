import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function ServiceRequestConversationRowSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex w-full items-center gap-3 py-3", className)} aria-hidden>
      <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-10" />
        </div>
        <Skeleton className="h-3.5 w-full max-w-[220px]" />
      </div>
    </div>
  );
}
