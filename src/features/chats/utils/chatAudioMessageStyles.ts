import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

const rangeBaseClasses =
  "block h-4 w-full max-w-full cursor-pointer appearance-none border-0 bg-transparent outline-none disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-slider-thumb]:relative [&::-webkit-slider-thumb]:z-[1] [&::-webkit-slider-thumb]:mt-[-5px] [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:shadow-none [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-none";

const rangeTrackShapeClasses =
  "[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-progress]:h-1.5 [&::-moz-range-progress]:rounded-full";

export function getChatAudioPlayButtonClassName(isOutgoing: boolean): string {
  return cn(
    "h-10 w-10 shrink-0 rounded-full border-0 shadow-none",
    isOutgoing
      ? "bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25"
      : "bg-primary text-primary-foreground hover:bg-primary/90",
  );
}

export function getChatAudioRangeClassName(isOutgoing: boolean): string {
  return cn(
    rangeBaseClasses,
    rangeTrackShapeClasses,
    isOutgoing
      ? cn(
          "[&::-webkit-slider-runnable-track]:[background:linear-gradient(to_right,hsl(var(--primary-foreground))_0%,hsl(var(--primary-foreground))_var(--chat-audio-range-progress,0%),hsl(var(--primary-foreground)/0.28)_var(--chat-audio-range-progress,0%),hsl(var(--primary-foreground)/0.28)_100%)]",
          "[&::-webkit-slider-thumb]:bg-primary-foreground",
          "[&::-moz-range-track]:bg-primary-foreground/28",
          "[&::-moz-range-progress]:bg-primary-foreground",
          "[&::-moz-range-thumb]:bg-primary-foreground",
        )
      : cn(
          "[&::-webkit-slider-runnable-track]:[background:linear-gradient(to_right,hsl(var(--primary))_0%,hsl(var(--primary))_var(--chat-audio-range-progress,0%),hsl(var(--foreground)/0.12)_var(--chat-audio-range-progress,0%),hsl(var(--foreground)/0.12)_100%)]",
          "[&::-webkit-slider-thumb]:bg-primary",
          "[&::-moz-range-track]:bg-foreground/12",
          "[&::-moz-range-progress]:bg-primary",
          "[&::-moz-range-thumb]:bg-primary",
        ),
  );
}

export function getChatAudioTimeClassName(isOutgoing: boolean): string {
  return cn(
    "tabular-nums",
    isOutgoing ? "text-primary-foreground/80" : "text-muted-foreground",
  );
}

export function getChatAudioSpeedButtonClassName(isOutgoing: boolean): string {
  return cn(
    "rounded-md px-2 py-0.5 text-xs font-semibold transition-colors",
    isOutgoing
      ? "bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20"
      : "border border-border/70 bg-background/80 text-foreground hover:bg-background",
  );
}

export function getChatAudioErrorClassName(isOutgoing: boolean): string {
  return cn(
    "mt-2 text-xs",
    isOutgoing ? "text-primary-foreground/90" : "text-destructive",
  );
}

export function getChatAudioRangeProgressStyle(progressPercent: number): CSSProperties {
  const clamped = Math.min(100, Math.max(0, progressPercent));
  return { "--chat-audio-range-progress": `${clamped}%` } as CSSProperties;
}
