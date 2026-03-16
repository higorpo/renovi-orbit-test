import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SectionTitleWithIconProps {
  title: string;
  icon: LucideIcon;
  /** Tailwind gradient classes, e.g. "from-sky-400 to-indigo-500". Defaults to primary. */
  iconGradient?: string;
  /** Optional subtitle/description below the title. */
  subtitle?: React.ReactNode;
  /** When "compact", keeps mobile size (icon + text) at all breakpoints. Default keeps responsive scaling. */
  size?: "default" | "compact";
  className?: string;
}

const DEFAULT_ICON_GRADIENT = "from-primary to-primary/90";

export function SectionTitleWithIcon({
  title,
  icon: Icon,
  iconGradient = DEFAULT_ICON_GRADIENT,
  subtitle,
  size = "default",
  className,
}: SectionTitleWithIconProps) {
  const isCompact = size === "compact";
  return (
    <div className={cn("mb-3 sm:mb-4 md:mb-6", className)}>
      <div
        className={cn(
          "flex items-center",
          isCompact ? "gap-2.5" : "gap-2.5 sm:gap-3"
        )}
      >
        <div
          className={cn(
            "rounded-full bg-gradient-to-br flex items-center justify-center shrink-0",
            iconGradient,
            isCompact ? "w-10 h-10" : "w-10 h-10 sm:w-12 sm:h-12"
          )}
        >
          <Icon
            className={cn(
              "text-white",
              isCompact ? "h-5 w-5" : "h-5 w-5 sm:h-6 sm:w-6"
            )}
          />
        </div>
        <div>
          <h1
            className={cn(
              "font-bold text-primary leading-tight",
              isCompact ? "text-xl" : "text-xl sm:text-2xl md:text-3xl lg:text-4xl"
            )}
          >
            {title}
          </h1>
        </div>
      </div>
      {subtitle ? (
        <p className="mt-2 text-muted-foreground text-sm">{subtitle}</p>
      ) : null}
    </div>
  );
}
