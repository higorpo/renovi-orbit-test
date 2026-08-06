/**
 * Responsive shell for service-completion flows:
 * mobile bottom sheet · desktop centered dialog.
 *
 * Opens above ServiceDetailSheet (also a Radix dialog). Stack at z-[60] so the
 * backdrop/content sit above the host sheet (z-50).
 */

import type { ReactNode } from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ShellDialogContent } from "@/components/ui/shell-dialog";
import {
  nestedOverlayClassName,
  nestedOverlayContentClassName,
} from "@/components/ui/shell-dialog-classes";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useBreakpointMd } from "@/hooks/useBreakpoint";
import { cn } from "@/lib/utils";

export type CompletionFlowSheetDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Extra header row (e.g. step indicator). */
  headerAside?: ReactNode;
  children: ReactNode;
  /** Prevent dismiss while a mutation is in flight. */
  dismissDisabled?: boolean;
  /** Desktop ShellDialog size. */
  size?: "sm" | "md" | "lg" | "xl";
  contentClassName?: string;
  testId?: string;
};

const closeButtonClassName =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 ease-out hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50";

export function CompletionFlowSheetDialog({
  open,
  onOpenChange,
  title,
  description,
  headerAside,
  children,
  dismissDisabled = false,
  size = "md",
  contentClassName,
  testId,
}: CompletionFlowSheetDialogProps) {
  const isDesktop = useBreakpointMd();

  const handleOpenChange = (next: boolean) => {
    if (!next && dismissDisabled) return;
    onOpenChange(next);
  };

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <ShellDialogContent
          size={size}
          overlayClassName={nestedOverlayClassName}
          className={cn(
            nestedOverlayContentClassName,
            "gap-0 overflow-hidden p-0 sm:max-h-[min(85vh,720px)] sm:p-0",
            contentClassName,
          )}
          data-testid={testId}
          onPointerDownOutside={(event) => {
            if (dismissDisabled) event.preventDefault();
          }}
          onEscapeKeyDown={(event) => {
            if (dismissDisabled) event.preventDefault();
          }}
        >
          <DialogHeader className="shrink-0 space-y-1 border-b border-border/80 px-5 py-4 text-left">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1 pr-2">
                <DialogTitle className="text-base font-semibold tracking-tight sm:text-lg">
                  {title}
                </DialogTitle>
                {description ? (
                  <DialogDescription className="text-sm leading-snug text-muted-foreground">
                    {description}
                  </DialogDescription>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {headerAside}
                <button
                  type="button"
                  aria-label="Fechar"
                  disabled={dismissDisabled}
                  onClick={() => handleOpenChange(false)}
                  className={closeButtonClassName}
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
          </DialogHeader>
          {/* Min-height avoids a title-only flash while checklist body mounts/loads. */}
          <div className="flex min-h-[min(52vh,420px)] flex-1 flex-col overflow-hidden">
            {children}
          </div>
        </ShellDialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        hideCloseButton
        overlayClassName={nestedOverlayClassName}
        className={cn(
          nestedOverlayContentClassName,
          "flex max-h-[92vh] flex-col gap-0 rounded-t-2xl p-0",
          contentClassName,
        )}
        data-testid={testId}
        onPointerDownOutside={(event) => {
          if (dismissDisabled) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (dismissDisabled) event.preventDefault();
        }}
      >
        <div
          className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-muted"
          aria-hidden
        />
        <SheetHeader className="shrink-0 space-y-1 border-b border-border/80 px-4 pb-3 pt-2 text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <SheetTitle className="text-base font-semibold tracking-tight">
                {title}
              </SheetTitle>
              {description ? (
                <SheetDescription className="text-sm leading-snug">
                  {description}
                </SheetDescription>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2 pt-0.5">
              {headerAside}
              <SheetClose asChild>
                <button
                  type="button"
                  aria-label="Fechar"
                  disabled={dismissDisabled}
                  className={cn(
                    closeButtonClassName,
                    "h-9 w-9 border border-border bg-background text-foreground opacity-80 hover:opacity-100",
                  )}
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </SheetClose>
            </div>
          </div>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
