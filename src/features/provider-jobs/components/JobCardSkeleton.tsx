import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function JobCardSkeleton() {
  return (
    <Card className="flex flex-col">
      <CardHeader className="!pb-2">
        <div className="flex items-start gap-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-48 sm:w-64" />
          </div>
        </div>
        <Skeleton className="mt-2 h-4 w-full" />
        <Skeleton className="mt-1 h-4 w-3/4" />
        <div className="mt-2 flex gap-4">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3.5 w-20" />
        </div>
        <div className="mt-1.5 flex gap-4">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3.5 w-28" />
        </div>
      </CardHeader>
      <CardContent className="!pt-0">
        <div className="flex gap-1.5">
          <Skeleton className="h-12 w-12 rounded-md sm:h-14 sm:w-14" />
          <Skeleton className="h-12 w-12 rounded-md sm:h-14 sm:w-14" />
        </div>
      </CardContent>
      <CardFooter className="mt-auto border-t pt-3">
        <Skeleton className="h-9 w-28" />
      </CardFooter>
    </Card>
  );
}
