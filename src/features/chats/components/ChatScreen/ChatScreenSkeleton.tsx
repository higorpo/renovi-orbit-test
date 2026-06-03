import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ChatTimelineSkeleton } from "./ChatTimelineSkeleton";

function ChatScreenHeaderSkeleton() {
  return (
    <header className="relative shrink-0 border-b border-border/60 bg-background">
      <div
        className="px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:hidden"
        aria-hidden
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex h-10 w-11 shrink-0 items-center justify-start">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          </div>

          <div className="flex min-w-0 flex-1 flex-col items-center text-center">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
            <div className="mt-1 flex w-full flex-col items-center gap-1.5">
              <Skeleton className="h-4 w-32 shrink-0" />
              <Skeleton className="h-3 w-40 shrink-0" />
              <Skeleton className="h-5 w-24 shrink-0 rounded-full" />
            </div>
          </div>

          <div className="flex h-10 w-11 shrink-0 items-center justify-end">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          </div>
        </div>
      </div>

      <div className="hidden min-w-0 w-full items-center justify-between gap-3 px-4 py-3 md:flex" aria-hidden>
        <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden pr-2">
          <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2 overflow-hidden">
            <Skeleton className="h-4 w-full max-w-[9rem]" />
            <Skeleton className="h-3 w-full max-w-[13rem]" />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Skeleton className="h-5 w-24 shrink-0 rounded-full" />
          <Skeleton className="h-11 w-24 shrink-0 rounded-full" />
        </div>
      </div>
    </header>
  );
}

function ChatComposerBarSkeleton() {
  return (
    <footer
      className="shrink-0 border-t border-border/60 bg-background/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md"
      aria-hidden
    >
      <div className="flex items-end gap-2">
        <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
        <Skeleton className="h-11 min-h-11 flex-1 basis-0 rounded-full" />
        <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
      </div>
    </footer>
  );
}

export function ChatScreenSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex h-full min-h-0 flex-col bg-background", className)}
      aria-busy="true"
      aria-label="Carregando conversa"
    >
      <ChatScreenHeaderSkeleton />

      <div className="relative flex min-h-0 flex-1 flex-col">
        <ChatTimelineSkeleton />
      </div>

      <ChatComposerBarSkeleton />
    </div>
  );
}
