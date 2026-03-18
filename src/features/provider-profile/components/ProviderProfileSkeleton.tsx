import { Skeleton } from "@/components/ui/skeleton";

export function ProviderProfileSkeleton() {
  return (
    <div className="space-y-10">
      {/* Logo */}
      <div className="flex justify-center -mt-2 mb-0">
        <Skeleton className="h-7 md:h-8 w-28 rounded" />
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-5 sm:gap-6 items-center sm:items-start">
        <Skeleton className="h-28 w-28 sm:h-32 sm:w-32 rounded-full shrink-0" />
        <div className="flex-1 space-y-3 w-full">
          <Skeleton className="h-8 w-48 mx-auto sm:mx-0" />
          <Skeleton className="h-4 w-56 mx-auto sm:mx-0" />
          <Skeleton className="h-9 w-32 mx-auto sm:mx-0 rounded-md" />
        </div>
      </div>

      {/* About */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>

      {/* Services */}
      <div className="space-y-4">
        <Skeleton className="h-5 w-40" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>

      {/* Portfolio */}
      <div className="space-y-4">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="aspect-video rounded-xl" />
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      </div>

      {/* Service area */}
      <div className="space-y-4">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-4 w-44" />
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-7 w-24 rounded-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
