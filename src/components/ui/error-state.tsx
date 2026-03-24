import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertCircle, RefreshCw } from "lucide-react";

export interface ErrorStateProps {
  title: string;
  description: string;
  onRetry?: () => void;
  retryLabel?: string;
  descriptionMaxWidth?: "sm" | "md";
  /** Wraps content in `container max-w-4xl px-4 py-6` (e.g. full-page account error) */
  pageLayout?: boolean;
  className?: string;
}

const DEFAULT_RETRY = "Tentar novamente";

export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel = DEFAULT_RETRY,
  descriptionMaxWidth = "sm",
  pageLayout = false,
  className,
}: ErrorStateProps) {
  const inner = (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-12 text-center",
        className,
      )}
      role="alert"
      aria-live="polite"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="h-6 w-6 text-destructive" aria-hidden />
      </div>
      <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
      <p
        className={cn(
          "mt-1 text-sm text-muted-foreground",
          descriptionMaxWidth === "md" ? "max-w-md" : "max-w-sm",
        )}
      >
        {description}
      </p>
      {onRetry ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4 gap-2"
          onClick={onRetry}
          aria-label={retryLabel}
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );

  if (pageLayout) {
    return (
      <div className="container max-w-4xl px-4 py-6">
        {inner}
      </div>
    );
  }

  return inner;
}
