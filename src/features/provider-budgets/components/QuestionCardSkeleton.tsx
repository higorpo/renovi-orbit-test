import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function QuestionCardSkeleton() {
  return (
    <Card className="flex flex-col">
      <CardHeader className="!pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-48 sm:w-64" />
            </div>
          </div>
          <Skeleton className="h-6 w-32 rounded-full" />
        </div>
        <div className="mt-2 flex gap-4">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3.5 w-16" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3 !pt-0">
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </CardContent>
      <CardFooter className="mt-auto border-t pt-3">
        <Skeleton className="h-9 w-24" />
      </CardFooter>
    </Card>
  );
}
