/**
 * Static text block — read-only informative text. Supports variant (h1–p), size, and theme color.
 */

import type { ElementType } from "react";
import { cn } from "@/lib/utils";
import type { FormBlockV2 } from "../../types";

type TextVariant = "h1" | "h2" | "h3" | "h4" | "p";
type TextSize = "sm" | "md" | "lg";
type TextColor =
  | "default"
  | "muted"
  | "primary"
  | "destructive"
  | "success";

interface StaticTextBlockProps {
  block: FormBlockV2;
}

const SIZE_CLASSES: Record<TextSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

const COLOR_CLASSES: Record<TextColor, string> = {
  default: "text-foreground",
  muted: "text-muted-foreground",
  primary: "text-primary",
  destructive: "text-destructive",
  success: "text-green-600 dark:text-green-400",
};

const VARIANT_CLASSES: Record<TextVariant, string> = {
  h1: "text-2xl font-bold tracking-tight",
  h2: "text-xl font-semibold tracking-tight",
  h3: "text-lg font-semibold",
  h4: "text-base font-semibold",
  p: "text-base font-normal",
};

export function StaticTextBlock({ block }: StaticTextBlockProps) {
  const variant = (block.config?.variant as TextVariant) ?? "p";
  const size = block.config?.size as TextSize | undefined;
  const color = (block.config?.color as TextColor) ?? "default";

  const sizeClass = size ? SIZE_CLASSES[size] : "";
  const colorClass = COLOR_CLASSES[color];
  const variantClass = VARIANT_CLASSES[variant];

  const Tag: ElementType = variant;

  return (
    <div className="space-y-1">
      {block.label ? (
        <Tag
          className={cn(variantClass, sizeClass, colorClass)}
          id={block.id}
        >
          {block.label}
        </Tag>
      ) : null}
      {block.helpText && (
        <p
          className={cn(
            "text-sm text-muted-foreground",
            !block.label && "mt-0"
          )}
        >
          {block.helpText}
        </p>
      )}
    </div>
  );
}
