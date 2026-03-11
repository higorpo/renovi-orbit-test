export function DynamicFormSkeleton() {
  return (
    <div className="flex flex-col h-full bg-background animate-pulse">
      <div className="px-3 pt-3 pb-1.5 sm:px-4 sm:pt-4 sm:pb-2 border-b border-border/50">
        <div className="space-y-2">
          <div className="flex justify-between">
            <div className="h-4 w-24 bg-muted rounded" />
            <div className="h-4 w-12 bg-muted rounded" />
          </div>
          <div className="h-2 bg-muted rounded-full" />
        </div>
      </div>
      <div className="flex-1 px-3 py-4 sm:px-4 sm:py-6">
        <div className="space-y-4 sm:space-y-6">
          <div className="text-center space-y-2">
            <div className="h-8 w-8 bg-muted rounded-full mx-auto" />
            <div className="h-6 w-48 bg-muted rounded mx-auto" />
            <div className="h-4 w-64 bg-muted rounded mx-auto" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 sm:h-24 bg-muted rounded-xl" />
            ))}
          </div>
        </div>
      </div>
      <div className="px-3 pb-3 pt-2 sm:px-4 sm:pb-4 sm:pt-3 border-t border-border/50">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="h-10 flex-1 bg-muted rounded-lg" />
          <div className="h-10 flex-1 bg-muted rounded-lg" />
        </div>
      </div>
    </div>
  );
}
