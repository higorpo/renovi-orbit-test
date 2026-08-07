/**
 * Responsive shell for service-completion flows:
 * mobile Vaul drawer (drag-to-dismiss) · desktop centered dialog.
 *
 * Opens above ServiceDetailSheet (also a Radix dialog). Stack at z-[60] so the
 * backdrop/content sit above the host sheet (z-50).
 *
 * chrome="standard" — title/description header + close
 * chrome="immersive" — edge-to-edge body (success screens); close overlays
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
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHandle,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useBreakpointMd } from "@/hooks/useBreakpoint";
import { cn } from "@/lib/utils";

export type CompletionFlowChrome = "standard" | "immersive";

export type CompletionFlowSheetDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accessible (and visible when chrome=standard) title. */
  title: string;
  /** Visible when chrome=standard; sr-only when immersive if provided. */
  description?: string;
  /**
   * standard — checklist / multi-step headers
   * immersive — success screens that paint full-bleed under floating chrome
   */
  chrome?: CompletionFlowChrome;
  /** Extra header control (e.g. step indicator). */
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

const floatingCloseButtonClassName = cn(
  closeButtonClassName,
  "h-9 w-9 border border-border/70 bg-background/80 text-foreground shadow-sm backdrop-blur-sm opacity-90 hover:opacity-100",
);

type CloseControlProps = {
  dismissDisabled: boolean;
  onClose: () => void;
  floating?: boolean;
  /** Use DrawerClose wrapper on mobile drawer. */
  asDrawerClose?: boolean;
};

function CloseControl({
  dismissDisabled,
  onClose,
  floating = false,
  asDrawerClose = false,
}: CloseControlProps) {
  const button = (
    <button
      type="button"
      aria-label="Fechar"
      disabled={dismissDisabled}
      onClick={asDrawerClose ? undefined : onClose}
      className={cn(
        floating
          ? floatingCloseButtonClassName
          : cn(
              closeButtonClassName,
              asDrawerClose &&
                "h-9 w-9 border border-border bg-background text-foreground opacity-80 hover:opacity-100",
            ),
      )}
    >
      <X className="h-4 w-4" aria-hidden />
    </button>
  );

  if (asDrawerClose) {
    return <DrawerClose asChild>{button}</DrawerClose>;
  }
  return button;
}

export function CompletionFlowSheetDialog({
  open,
  onOpenChange,
  title,
  description,
  chrome = "standard",
  headerAside,
  children,
  dismissDisabled = false,
  size = "md",
  contentClassName,
  testId,
}: CompletionFlowSheetDialogProps) {
  const isDesktop = useBreakpointMd();
  const immersive = chrome === "immersive";

  const handleOpenChange = (next: boolean) => {
    if (!next && dismissDisabled) return;
    onOpenChange(next);
  };

  const close = () => handleOpenChange(false);

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
          {immersive ? (
            <>
              <DialogTitle className="sr-only">{title}</DialogTitle>
              {description ? (
                <DialogDescription className="sr-only">
                  {description}
                </DialogDescription>
              ) : null}
              <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
                {headerAside}
                <CloseControl
                  dismissDisabled={dismissDisabled}
                  onClose={close}
                  floating
                />
              </div>
            </>
          ) : (
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
                  <CloseControl
                    dismissDisabled={dismissDisabled}
                    onClose={close}
                  />
                </div>
              </div>
            </DialogHeader>
          )}
          {/* Min-height avoids a title-only flash while checklist body mounts/loads. */}
          <div className="flex min-h-[min(52vh,420px)] flex-1 flex-col overflow-hidden">
            {children}
          </div>
        </ShellDialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer
      open={open}
      onOpenChange={handleOpenChange}
      // Nested above ServiceDetailSheet — avoid scaling the host underneath.
      shouldScaleBackground={false}
      // Drag via handle only so checklist/success scroll doesn't fight dismiss.
      handleOnly
      dismissible={!dismissDisabled}
    >
      <DrawerContent
        overlayClassName={nestedOverlayClassName}
        hideHandle={immersive}
        className={cn(
          nestedOverlayContentClassName,
          "flex max-h-[92vh] flex-col gap-0 rounded-t-2xl p-0",
          // Immersive: soft tint on the shell itself so chrome/handle area isn't flat white.
          immersive &&
            "bg-[linear-gradient(180deg,hsl(var(--success)/0.12)_0%,hsl(var(--background))_42%)]",
          contentClassName,
        )}
        data-testid={testId}
      >
        {immersive ? (
          <>
            <DrawerTitle className="sr-only">{title}</DrawerTitle>
            {description ? (
              <DrawerDescription className="sr-only">
                {description}
              </DrawerDescription>
            ) : null}
            {/*
              Vaul's [data-vaul-handle] sets position:relative (beats Tailwind
              absolute). Wrap in an absolute host so the handle leaves the flow
              and success wash can paint to the sheet top edge.
            */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center pt-3">
              <div className="pointer-events-auto">
                <DrawerHandle className="mt-0 bg-muted" />
              </div>
            </div>
            <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
              {headerAside}
              <CloseControl
                dismissDisabled={dismissDisabled}
                onClose={close}
                floating
                asDrawerClose
              />
            </div>
          </>
        ) : (
          <DrawerHeader className="shrink-0 space-y-1 border-b border-border/80 px-4 pb-3 pt-1 text-left">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <DrawerTitle className="text-base font-semibold tracking-tight">
                  {title}
                </DrawerTitle>
                {description ? (
                  <DrawerDescription className="text-sm leading-snug">
                    {description}
                  </DrawerDescription>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2 pt-0.5">
                {headerAside}
                <CloseControl
                  dismissDisabled={dismissDisabled}
                  onClose={close}
                  asDrawerClose
                />
              </div>
            </div>
          </DrawerHeader>
        )}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
