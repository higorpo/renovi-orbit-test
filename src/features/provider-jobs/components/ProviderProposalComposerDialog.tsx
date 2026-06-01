import { useEffect, useState } from "react";
import { CircleDollarSign, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ProposalComposer,
  validateProposalComposerForm,
  type ProposalAvailabilitySlotDraft,
  type ProposalComposerPricing,
  type ProposalDurationUnit,
} from "@/features/negotiation-proposals";
import { cn } from "@/lib/utils";
import { useMobileDialogViewport } from "@/hooks/useMobileDialogViewport";

interface ProviderProposalComposerDialogProps {
  open: boolean;
  isSubmitting: boolean;
  isPricingLoading: boolean;
  priceInput: string;
  descriptionDraft: string;
  durationValueInput: string;
  durationUnit: ProposalDurationUnit;
  availabilitySlots: ProposalAvailabilitySlotDraft[];
  existingPhotoUrls: string[];
  newPhotos: File[];
  photosCount: number;
  pricing: ProposalComposerPricing | null;
  maxDescriptionLength: number;
  maxPhotos: number;
  canSubmit: boolean;
  onOpenChange: (open: boolean) => void;
  onPriceInputChange: (value: string) => void;
  onDescriptionDraftChange: (value: string) => void;
  onDurationValueInputChange: (value: string) => void;
  onDurationUnitChange: (value: ProposalDurationUnit) => void;
  onAvailabilitySlotChange: (
    index: number,
    field: "startDate" | "endDate" | "shift",
    value: string,
  ) => void;
  onAvailabilitySlotAdd: () => void;
  onAvailabilitySlotRemove: (index: number) => void;
  onPhotoAdd: (files: FileList | null) => void;
  onExistingPhotoRemove: (index: number) => void;
  onNewPhotoRemove: (index: number) => void;
  onSubmit: () => Promise<void>;
}

export function ProviderProposalComposerDialog({
  open,
  isSubmitting,
  isPricingLoading,
  priceInput,
  descriptionDraft,
  durationValueInput,
  durationUnit,
  availabilitySlots,
  existingPhotoUrls,
  newPhotos,
  photosCount,
  pricing,
  maxDescriptionLength,
  maxPhotos,
  canSubmit,
  onOpenChange,
  onPriceInputChange,
  onDescriptionDraftChange,
  onDurationValueInputChange,
  onDurationUnitChange,
  onAvailabilitySlotChange,
  onAvailabilitySlotAdd,
  onAvailabilitySlotRemove,
  onPhotoAdd,
  onExistingPhotoRemove,
  onNewPhotoRemove,
  onSubmit,
}: ProviderProposalComposerDialogProps) {
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const { contentRef, scheduleSync } = useMobileDialogViewport(open);

  useEffect(() => {
    if (!open) return;
    setShowValidationErrors(false);
  }, [open]);

  const handleSubmitClick = async () => {
    const validation = validateProposalComposerForm({
      priceInput,
      descriptionDraft,
      durationValueInput,
      durationUnit,
      availabilitySlots,
    }, maxDescriptionLength);

    if (!validation.success) {
      setShowValidationErrors(true);
      return;
    }

    await onSubmit();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={contentRef}
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0 [&>button]:hidden",
          "max-sm:inset-x-0 max-sm:bottom-auto max-sm:left-0 max-sm:right-0 max-sm:top-0 max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0",
          "sm:max-h-[90vh] sm:w-full sm:max-w-2xl sm:rounded-lg sm:border sm:p-6",
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col sm:max-h-[calc(90vh-3rem)]">
          <DialogHeader className="shrink-0 border-b px-4 py-3 text-left sm:border-b-0 sm:px-0 sm:py-0">
            <div className="flex items-center justify-between gap-3">
              <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                <CircleDollarSign className="h-5 w-5 text-primary" aria-hidden />
                Enviar orçamento
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

          <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain px-4 py-4 [-webkit-overflow-scrolling:touch] sm:px-0 sm:py-0">
            <ProposalComposer
              priceInput={priceInput}
              descriptionDraft={descriptionDraft}
              durationValueInput={durationValueInput}
              durationUnit={durationUnit}
              availabilitySlots={availabilitySlots}
              existingPhotoUrls={existingPhotoUrls}
              newPhotos={newPhotos}
              photosCount={photosCount}
              pricing={pricing}
              isPricingLoading={isPricingLoading}
              maxDescriptionLength={maxDescriptionLength}
              maxPhotos={maxPhotos}
              showValidationErrors={showValidationErrors}
              onPriceInputChange={onPriceInputChange}
              onDescriptionDraftChange={onDescriptionDraftChange}
              onDurationValueInputChange={onDurationValueInputChange}
              onDurationUnitChange={onDurationUnitChange}
              onAvailabilitySlotChange={onAvailabilitySlotChange}
              onAvailabilitySlotAdd={onAvailabilitySlotAdd}
              onAvailabilitySlotRemove={onAvailabilitySlotRemove}
              onPhotoAdd={onPhotoAdd}
              onExistingPhotoRemove={onExistingPhotoRemove}
              onNewPhotoRemove={onNewPhotoRemove}
              onInputFocus={scheduleSync}
            />
          </div>

          <DialogFooter className="relative z-10 mt-2 shrink-0 flex-row gap-2 border-t bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_40px_-12px_rgba(0,0,0,0.18)] backdrop-blur-md supports-[backdrop-filter]:bg-background/85 sm:mt-4 sm:border-t-0 sm:bg-transparent sm:px-0 sm:py-0 sm:pb-0 sm:shadow-none sm:backdrop-blur-none sm:supports-[backdrop-filter]:bg-transparent [&>button]:flex-1 sm:[&>button]:flex-none">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleSubmitClick()}
              disabled={isSubmitting || !canSubmit}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Enviando...
                </>
              ) : (
                "Enviar orçamento"
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
