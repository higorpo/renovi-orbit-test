import { CircleDollarSign, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ShellDialogContent } from "@/components/ui/shell-dialog";
import { useMobileDialogViewport } from "@/hooks/useMobileDialogViewport";
import { ProposalComposer, type ProposalComposerProps } from "./ProposalComposer";

export interface ProposalComposerShellDialogProps
  extends Omit<ProposalComposerProps, "onInputFocus" | "className"> {
  open: boolean;
  title: string;
  submitLabel: string;
  submittingLabel?: string;
  cancelLabel?: string;
  isSubmitting: boolean;
  canSubmit: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => Promise<void>;
}

export function ProposalComposerShellDialog({
  open,
  title,
  submitLabel,
  submittingLabel = "Enviando...",
  cancelLabel = "Cancelar",
  isSubmitting,
  canSubmit,
  onOpenChange,
  onSubmit,
  ...composerProps
}: ProposalComposerShellDialogProps) {
  const { contentRef, scheduleSync } = useMobileDialogViewport(open);

  const handleSubmitClick = async () => {
    const isValid = await composerProps.form.trigger();
    if (!isValid) return;
    await onSubmit();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ShellDialogContent ref={contentRef} size="lg">
        <DialogHeader className="shrink-0 space-y-0 border-b px-4 py-3 pr-0 text-left sm:border-b-0 sm:px-0 sm:py-0">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <CircleDollarSign className="h-5 w-5 text-primary" aria-hidden />
              {title}
            </DialogTitle>
            <DialogClose asChild>
              <button
                type="button"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </DialogClose>
          </div>
        </DialogHeader>

        {/* Desktop gutter so focus rings are not clipped by overflow-y-auto */}
        <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain px-4 py-4 [-webkit-overflow-scrolling:touch] sm:max-h-[calc(90vh-3rem)] sm:-mx-1 sm:px-1 sm:py-1">
          <ProposalComposer {...composerProps} onInputFocus={scheduleSync} />
        </div>

        <DialogFooter className="relative z-10 mt-2 shrink-0 flex-row gap-2 border-t bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_40px_-12px_rgba(0,0,0,0.18)] backdrop-blur-md supports-[backdrop-filter]:bg-background/85 sm:mt-4 sm:border-t-0 sm:bg-transparent sm:px-0 sm:py-0 sm:pb-0 sm:shadow-none sm:backdrop-blur-none sm:supports-[backdrop-filter]:bg-transparent [&>button]:flex-1 sm:[&>button]:flex-none">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmitClick()}
            disabled={isSubmitting || !canSubmit}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                {submittingLabel}
              </>
            ) : (
              submitLabel
            )}
          </Button>
        </DialogFooter>
      </ShellDialogContent>
    </Dialog>
  );
}
