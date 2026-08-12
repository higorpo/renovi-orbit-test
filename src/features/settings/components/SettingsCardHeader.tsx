import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsCardHeaderProps {
  title: string;
  icon?: LucideIcon;
  description?: string;
  /** Soft chip tone; danger uses destructive soft surface. */
  tone?: "default" | "danger";
  className?: string;
}

/** Prestway settings panel header — Manrope title + soft icon chip. */
export function SettingsCardHeader({
  title,
  icon: Icon,
  description,
  tone = "default",
  className,
}: SettingsCardHeaderProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {Icon ? (
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            tone === "danger"
              ? "bg-destructive/10 text-destructive"
              : "bg-primary-soft text-primary",
          )}
          aria-hidden
        >
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </div>
      ) : null}
      <div className="min-w-0 space-y-0.5">
        <h3 className="font-display text-lg font-semibold tracking-tight text-ink">{title}</h3>
        {description ? <p className="text-sm leading-relaxed text-body">{description}</p> : null}
      </div>
    </div>
  );
}
