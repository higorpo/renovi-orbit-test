import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export function JobDetailSkeleton() {
  return (
    <div
      className="space-y-4"
      aria-busy="true"
      aria-label="Carregando detalhes do trabalho"
    >
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-12 w-12 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-7 w-full max-w-md" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-36 rounded-full" />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-28" />
          </div>

          <Skeleton className="h-4 w-40" />
        </CardHeader>

        <Separator />

        <CardContent className="space-y-6 pt-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>

          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <div className="flex gap-2">
              <Skeleton className="h-20 w-20 rounded-md" />
              <Skeleton className="h-20 w-20 rounded-md" />
              <Skeleton className="hidden h-20 w-20 rounded-md sm:block" />
            </div>
          </div>

          <div className="space-y-2">
            <Skeleton className="h-4 w-36" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-28 rounded-full" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-52" />
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <Skeleton className="h-16 w-full rounded-md" />
          <Skeleton className="h-16 w-full rounded-md" />
        </CardContent>
      </Card>
    </div>
  );
}
