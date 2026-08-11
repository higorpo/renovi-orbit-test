import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ServiceDetailSectionProps {
  title?: string;
  description?: string;
  titleAccessory?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function ServiceDetailSection({
  title,
  description,
  titleAccessory,
  children,
  className,
}: ServiceDetailSectionProps) {
  return (
    <section
      className={cn(
        "rounded-lg border border-border bg-card p-4 shadow-elevation-1 sm:p-5",
        className,
      )}
    >
      {title ? (
        <div className="mb-2.5">
          <div className="flex items-center gap-1.5">
            <h2 className="font-display text-sm font-semibold leading-none text-ink">{title}</h2>
            {titleAccessory}
          </div>
          {description ? (
            <p className="mt-1 text-caption text-muted-foreground">{description}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
