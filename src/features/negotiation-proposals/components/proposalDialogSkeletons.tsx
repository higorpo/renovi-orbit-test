import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

function DialogSkeletonRoot({
  className,
  label,
  children,
}: {
  className?: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-4", className)} aria-busy="true" aria-label={label}>
      {children}
    </div>
  );
}

export function AcceptProposalDialogSkeleton() {
  return (
    <DialogSkeletonRoot label="Carregando datas disponíveis">
      <Skeleton className="h-4 w-36" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-3"
          >
            <Skeleton className="h-4 w-4 shrink-0 rounded-full" />
            <Skeleton className="h-4 flex-1 max-w-[14rem]" />
          </div>
        ))}
      </div>
    </DialogSkeletonRoot>
  );
}

export function RejectProposalDialogSkeleton() {
  return (
    <DialogSkeletonRoot label="Carregando formulário de recusa">
      <Skeleton className="h-4 w-36" />
      <Skeleton className="min-h-32 w-full rounded-md" />
      <Skeleton className="h-3 w-24" />
    </DialogSkeletonRoot>
  );
}

export function RevisionRequestDialogSkeleton() {
  return (
    <DialogSkeletonRoot label="Carregando formulário de revisão">
      <Skeleton className="h-10 w-full rounded-lg" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="min-h-28 w-full rounded-md" />
        <Skeleton className="h-3 w-24" />
      </div>
    </DialogSkeletonRoot>
  );
}

export interface ProposalDetailsDialogSkeletonProps {
  showProviderPricing?: boolean;
}

export function ProposalDetailsDialogSkeleton({
  showProviderPricing = false,
}: ProposalDetailsDialogSkeletonProps) {
  return (
    <DialogSkeletonRoot label="Carregando detalhes da proposta">
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-2">
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>

      {showProviderPricing ? (
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-2">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      ) : null}

      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>

      <Skeleton className="h-14 w-full rounded-lg" />

      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="aspect-square w-full rounded-lg" />
          ))}
        </div>
      </div>
    </DialogSkeletonRoot>
  );
}

export function ProposalPhotoTilesSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-3 gap-2 sm:grid-cols-4"
      aria-busy="true"
      aria-label="Carregando fotos"
    >
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} className="aspect-square w-full rounded-lg" />
      ))}
    </div>
  );
}

export function ProposalPhotosSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Carregando fotos">
      <Skeleton className="h-3 w-32" />
      <ProposalPhotoTilesSkeleton count={count} />
    </div>
  );
}
