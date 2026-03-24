import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Constrains description width: `sm` = max-w-sm, `md` = max-w-md */
  descriptionMaxWidth?: "sm" | "md";
  /** Extra vertical padding for primary CTA emphasis (e.g. main list empty) */
  paddingY?: "default" | "comfortable";
  className?: string;
  /** Primary action (e.g. Button asChild + Link) */
  action?: ReactNode;
  /** Renders a standard "Limpar filtros" outline button when provided */
  onClearFilters?: () => void;
  clearFiltersLabel?: string;
  ClearFiltersIcon?: LucideIcon;
  /** Accessible name for the status region */
  ariaLabel?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  descriptionMaxWidth = "sm",
  paddingY = "default",
  className,
  action,
  onClearFilters,
  clearFiltersLabel = "Limpar filtros",
  ClearFiltersIcon,
  ariaLabel,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 text-center",
        paddingY === "comfortable" ? "py-14" : "py-12",
        className,
      )}
      role="status"
      aria-label={ariaLabel}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Icon className="h-6 w-6 text-muted-foreground" aria-hidden />
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
      {action ? <div className="mt-4 flex flex-col items-center gap-2">{action}</div> : null}
      {onClearFilters ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4 gap-2"
          onClick={onClearFilters}
        >
          {ClearFiltersIcon ? (
            <ClearFiltersIcon className="h-4 w-4" aria-hidden />
          ) : null}
          {clearFiltersLabel}
        </Button>
      ) : null}
    </div>
  );
}
