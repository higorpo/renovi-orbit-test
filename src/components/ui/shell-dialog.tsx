import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import {
  shellDialogContentClassName,
  type ShellDialogSize,
} from "@/components/ui/shell-dialog-classes";

interface ShellDialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  size?: ShellDialogSize;
}

/**
 * Standard dialog content shell for Orbit (mobile fullscreen + desktop modal).
 * Prefer this over DialogContent when the dialog should match app-wide UX.
 */
export const ShellDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  ShellDialogContentProps
>(({ className, size = "lg", ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      )}
    />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(shellDialogContentClassName({ size }), className)}
      {...props}
    />
  </DialogPrimitive.Portal>
));
ShellDialogContent.displayName = "ShellDialogContent";
