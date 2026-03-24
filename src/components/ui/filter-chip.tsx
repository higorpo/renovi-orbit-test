import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterChipProps {
  label: string;
  icon: LucideIcon;
  iconColor: string;
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export function FilterChip({
  label,
  icon: Icon,
  iconColor,
  isActive,
  onClick,
  disabled,
}: FilterChipProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors sm:h-9 sm:px-4 sm:text-sm",
        "whitespace-nowrap snap-start",
        isActive
          ? "border-muted-foreground/60 bg-muted text-foreground"
          : "border-muted-foreground/10 bg-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        "disabled:pointer-events-none disabled:opacity-50",
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          isActive ? iconColor : "text-muted-foreground",
        )}
        aria-hidden
      />
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}
