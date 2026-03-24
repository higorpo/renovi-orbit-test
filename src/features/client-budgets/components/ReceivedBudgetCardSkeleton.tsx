import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ReceivedBudgetCardSkeleton() {
  return (
    <Card className="flex flex-col">
      <CardHeader className="space-y-3 !pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-full max-w-sm sm:max-w-md" />
              <Skeleton className="h-3 w-full max-w-xs" />
            </div>
          </div>
          <Skeleton className="h-6 w-28 shrink-0 rounded-full" />
        </div>
        <Skeleton className="h-3 w-56" />
      </CardHeader>
      <CardContent className="space-y-2 !pt-0">
        <div className="flex flex-wrap items-center gap-2 border-b pb-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-4 w-full" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b pb-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-4 w-[85%]" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      </CardContent>
      <CardFooter className="border-t pt-3">
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-28" />
        </div>
      </CardFooter>
    </Card>
  );
}
