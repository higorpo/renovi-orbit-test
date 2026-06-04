import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProposalDetailSection({
  children,
  className,
  variant = "default",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "muted";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        variant === "muted" && "bg-muted/20",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ProposalDetailLabel({
  icon: Icon,
  children,
  emphasized = false,
}: {
  icon?: LucideIcon;
  children: React.ReactNode;
  emphasized?: boolean;
}) {
  return (
    <p
      className={cn(
        "flex items-center gap-1.5 text-xs text-muted-foreground",
        emphasized && "font-medium tracking-wide",
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
      {children}
    </p>
  );
}

export function ProposalDetailValue({
  children,
  className,
  semibold = false,
  spacing = "normal",
}: {
  children: React.ReactNode;
  className?: string;
  semibold?: boolean;
  spacing?: "normal" | "relaxed";
}) {
  return (
    <p
      className={cn(
        "text-sm text-foreground",
        spacing === "normal" ? "mt-1" : "mt-2",
        semibold && "font-semibold",
        className,
      )}
    >
      {children}
    </p>
  );
}
