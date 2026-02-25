/**
 * Skeleton for dynamic form loading state.
 */

export function MicroStepFormSkeleton() {
  return (
    <div className="flex flex-col h-full bg-background animate-pulse">
      <div className="px-4 pt-4 pb-2 border-b border-border/50">
        <div className="space-y-2">
          <div className="flex justify-between">
            <div className="h-4 w-24 bg-muted rounded" />
            <div className="h-4 w-12 bg-muted rounded" />
          </div>
          <div className="h-2 bg-muted rounded-full" />
        </div>
      </div>
      <div className="flex-1 px-4 py-6">
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <div className="h-8 w-8 bg-muted rounded-full mx-auto" />
            <div className="h-6 w-48 bg-muted rounded mx-auto" />
            <div className="h-4 w-64 bg-muted rounded mx-auto" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-muted rounded-xl" />
            ))}
          </div>
        </div>
      </div>
      <div className="px-4 pb-4 pt-3 border-t border-border/50">
        <div className="flex items-center gap-3">
          <div className="h-10 flex-1 bg-muted rounded-lg" />
          <div className="h-10 flex-1 bg-muted rounded-lg" />
        </div>
      </div>
    </div>
  );
}
