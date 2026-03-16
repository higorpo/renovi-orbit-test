import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ServiceCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-3/4" />
          </div>
          <Skeleton className="h-6 w-28 rounded-full" />
        </div>
        <Skeleton className="mt-2 h-4 w-full" />
        <Skeleton className="mt-1 h-4 w-2/3" />
        <Skeleton className="mt-3 h-4 w-40" />
        <Skeleton className="mt-2 h-3 w-28" />
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex gap-2">
          <Skeleton className="h-12 w-12 rounded-md" />
          <Skeleton className="h-12 w-12 rounded-md" />
          <Skeleton className="h-12 w-12 rounded-md" />
        </div>
      </CardContent>
      <CardFooter className="border-t pt-3">
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </CardFooter>
    </Card>
  );
}
