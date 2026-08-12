import type { SVGProps } from "react";
import { cn } from "@/lib/utils";
import {
  ICON_MARK_PATHS,
  LOGO_MARK_PATHS,
  WORDMARK_PATHS,
} from "./prestwayMarkPaths";

export type PrestwayIconVariant =
  | "client"
  | "provider"
  | "inst"
  | "white"
  | "dark";

export type PrestwayIconLayout = "icon" | "full" | "wordmark";

export type PrestwayWordmarkTone = "dark" | "white";

type PrestwayIconProps = SVGProps<SVGSVGElement> & {
  /** Color palette for the mark. Defaults to client (blue). */
  variant?: PrestwayIconVariant;
  /** Which brand asset to render. Defaults to icon mark only. */
  layout?: PrestwayIconLayout;
  /**
   * Wordmark fill for full/wordmark layouts.
   * Defaults to white when variant is white; otherwise black.
   */
  wordmarkTone?: PrestwayWordmarkTone;
};

const MARK_PALETTES: Record<
  PrestwayIconVariant,
  readonly [string, string, string, string, string]
> = {
  client: ["#2D89F0", "#2563EB", "#2563EB", "#53A4FF", "#93C5FD"],
  provider: ["#FA8432", "#F97316", "#F97316", "#FF9F3B", "#FDBA74"],
  inst: ["#FA8432", "#2563EB", "#2563EB", "#53A4FF", "#FDBA74"],
  white: ["white", "white", "white", "white", "white"],
  dark: ["black", "black", "black", "black", "black"],
};

const VIEW_BOX: Record<PrestwayIconLayout, string> = {
  icon: "0 0 119 139",
  full: "0 0 294 81",
  // Cropped to the Prestway wordmark bounds inside the lockup.
  wordmark: "92.7 24.3 200.7 39.3",
};

function resolveWordmarkColor(
  variant: PrestwayIconVariant,
  wordmarkTone: PrestwayWordmarkTone | undefined
): string {
  if (wordmarkTone === "white" || (wordmarkTone == null && variant === "white")) {
    return "white";
  }
  return "black";
}

/**
 * Prestway brand mark as an inline SVG.
 * Use `variant` for color palette and `layout` for icon / full lockup / wordmark-only.
 */
export function PrestwayIcon({
  variant = "client",
  layout = "icon",
  wordmarkTone,
  className,
  "aria-hidden": ariaHidden,
  "aria-label": ariaLabel,
  role,
  ...props
}: PrestwayIconProps) {
  const markColors = MARK_PALETTES[variant];
  const wordmarkColor = resolveWordmarkColor(variant, wordmarkTone);
  const showMark = layout === "icon" || layout === "full";
  const showWordmark = layout === "full" || layout === "wordmark";
  const markPaths = layout === "icon" ? ICON_MARK_PATHS : LOGO_MARK_PATHS;
  const isDecorative = ariaLabel == null && role == null;

  return (
    <svg
      viewBox={VIEW_BOX[layout]}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
      className={cn("h-auto w-auto", className)}
      role={role ?? (ariaLabel != null ? "img" : undefined)}
      aria-label={ariaLabel}
      aria-hidden={ariaHidden ?? (isDecorative ? true : undefined)}
    >
      {showMark
        ? markPaths.map((d, i) => (
            <path key={`mark-${i}`} d={d} fill={markColors[i]} />
          ))
        : null}
      {showWordmark
        ? WORDMARK_PATHS.map((d, i) => (
            <path key={`wordmark-${i}`} d={d} fill={wordmarkColor} />
          ))
        : null}
    </svg>
  );
}
