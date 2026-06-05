import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ServiceRequestProposalSummaryCardSkeleton() {
  return (
    <Card aria-busy="true" aria-label="Carregando orçamento enviado">
      <CardHeader className="pb-3">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-9 w-28" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4 !pt-0">
        <div className="grid gap-2 sm:grid-cols-2">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
        <Skeleton className="h-14 w-full rounded-lg" />
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-3 w-32" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Skeleton className="aspect-square w-full rounded-lg" />
          <Skeleton className="aspect-square w-full rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}
