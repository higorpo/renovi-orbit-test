import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ServiceDetailNarrowStack({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("flex flex-col gap-4", className)}>{children}</div>;
}

const WIDE_COLUMNS_WITH_ASIDE =
  "has-[aside:not(:empty)]:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]";

export function ServiceDetailWideLayout({
  alerts,
  main,
  aside,
  support,
  className,
}: {
  alerts?: ReactNode;
  main: ReactNode;
  /** Prefer an array of nodes so empty asides stay :empty (no whitespace text nodes). */
  aside?: ReactNode;
  support?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {alerts ? <div className="min-w-0">{alerts}</div> : null}

      {/* Sticky aside is scoped to this row so it cannot cover support below.
          When aside has no DOM children, collapse to a single full-width column. */}
      <div
        className={cn(
          "grid grid-cols-1 items-start gap-4",
          WIDE_COLUMNS_WITH_ASIDE,
        )}
      >
        <div className="flex min-w-0 flex-col gap-4">{main}</div>
        {aside != null ? (
          <aside className="sticky top-4 flex min-w-0 flex-col gap-4 self-start empty:hidden">
            {aside}
          </aside>
        ) : null}
      </div>

      {support ? <div className="min-w-0">{support}</div> : null}
    </div>
  );
}
