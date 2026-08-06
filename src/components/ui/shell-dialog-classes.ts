import { cn } from "@/lib/utils";

/** Desktop max-width presets for shell dialogs. */
export const shellDialogSizes = {
  sm: "sm:max-w-lg",
  md: "sm:max-w-xl",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-3xl",
} as const;

export type ShellDialogSize = keyof typeof shellDialogSizes;

export interface ShellDialogContentClassNameOptions {
  /** Desktop (`sm+`) max width. Defaults to `lg`. */
  size?: ShellDialogSize;
}

/**
 * Shared shell layout/animation classes for app dialogs.
 * Mobile: fullscreen with native-style slide from the right.
 * Desktop: centered modal with zoom + fade.
 */
export function shellDialogContentClassName(
  options: ShellDialogContentClassNameOptions = {},
): string {
  const { size = "lg" } = options;

  return cn(
    "fixed z-50 flex w-full max-h-[90vh] flex-col gap-0 overflow-hidden border bg-background p-0 shadow-lg [&>button]:hidden",
    "data-[state=open]:animate-in data-[state=closed]:animate-out",
    "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
    "max-sm:inset-x-0 max-sm:bottom-auto max-sm:left-0 max-sm:right-0 max-sm:top-0 max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-full max-sm:max-w-none max-sm:rounded-none max-sm:border-0",
    "max-sm:duration-300 max-sm:ease-in-out",
    "max-sm:data-[state=closed]:duration-300 max-sm:data-[state=open]:duration-300",
    "max-sm:data-[state=closed]:slide-out-to-right max-sm:data-[state=open]:slide-in-from-right",
    "max-sm:data-[state=closed]:slide-out-to-top-0 max-sm:data-[state=open]:slide-in-from-top-0",
    "max-sm:data-[state=open]:zoom-in-100 max-sm:data-[state=closed]:zoom-out-100",
    "sm:duration-200",
    "sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:p-6",
    shellDialogSizes[size],
    "sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95",
    "sm:data-[state=closed]:slide-out-to-left-1/2 sm:data-[state=closed]:slide-out-to-top-[48%]",
    "sm:data-[state=open]:slide-in-from-left-1/2 sm:data-[state=open]:slide-in-from-top-[48%]",
  );
}

/** Overrides for fullscreen media lightbox dialogs (above nested sheet/dialog hosts). */
export const mediaLightboxShellDialogClassName = cn(
  "z-[100] h-[100dvh] max-h-[100dvh] border-0 bg-black p-2 text-white",
  "sm:h-auto sm:max-h-[90vh] sm:w-auto sm:max-w-5xl sm:rounded-lg sm:border sm:p-3",
);

export const mediaLightboxOverlayClassName = "z-[100] bg-black/90";

/**
 * Completion checklist / evaluate flows open above ServiceDetailSheet (z-50).
 * Keep below media lightbox (z-100).
 */
export const nestedOverlayClassName = "z-[60]";
export const nestedOverlayContentClassName = "z-[60]";
