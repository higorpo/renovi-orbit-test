import { useEffect } from "react";
import { useProposalComposer } from "../hooks/useProposalComposer";
import { useProposalPhotoUrls } from "../hooks/useProposalPhotoUrls";
import type { ProposalComposerMode } from "../types/proposalComposerMode.types";
import type { ProposalDetailView } from "../types/proposalDetails.types";
import type { CreateProviderProposalResult } from "../types/proposals.types";
import { ProposalComposerShellDialog } from "./ProposalComposerShellDialog";

export interface ProposalComposerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatId: string;
  serviceRequestId: string | null;
  mode?: ProposalComposerMode;
  initialProposal?: ProposalDetailView | null;
  onSubmitted?: (result: CreateProviderProposalResult) => void;
}

export function ProposalComposerDialog({
  open,
  onOpenChange,
  chatId: _chatId,
  serviceRequestId,
  mode = "create",
  initialProposal = null,
  onSubmitted,
}: ProposalComposerDialogProps) {
  const {
    form,
    availabilityFieldArray,
    existingPhotoPaths,
    newPhotos,
    photosCount,
    pricing,
    isPricingLoading,
    maxDescriptionLength,
    maxPhotos,
    canSubmit,
    resetComposer,
    loadFromDetail,
    addPhotos,
    removeExistingPhoto,
    removeNewPhoto,
    addAvailabilitySlot,
    removeAvailabilitySlot,
    isSubmitting,
    submit,
  } = useProposalComposer({ serviceRequestId, onSubmitted });

  const { urls: existingPhotoUrls } = useProposalPhotoUrls(existingPhotoPaths);

  useEffect(() => {
    if (!open) {
      resetComposer();
      return;
    }

    if (mode === "edit" && initialProposal) {
      loadFromDetail(initialProposal);
      return;
    }

    resetComposer();
  }, [open, mode, initialProposal, loadFromDetail, resetComposer]);

  const title = mode === "edit" ? "Revisar proposta" : "Enviar proposta";
  const submitLabel = mode === "edit" ? "Enviar revisão" : "Enviar proposta";

  const handleSubmit = async () => {
    const success = await submit();
    if (success) onOpenChange(false);
  };

  return (
    <ProposalComposerShellDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      submitLabel={submitLabel}
      isSubmitting={isSubmitting}
      canSubmit={canSubmit}
      onSubmit={handleSubmit}
      form={form}
      availabilityFieldArray={availabilityFieldArray}
      existingPhotoUrls={existingPhotoUrls}
      newPhotos={newPhotos}
      photosCount={photosCount}
      pricing={pricing}
      isPricingLoading={isPricingLoading}
      maxDescriptionLength={maxDescriptionLength}
      maxPhotos={maxPhotos}
      onPhotoAdd={addPhotos}
      onExistingPhotoRemove={removeExistingPhoto}
      onNewPhotoRemove={removeNewPhoto}
      onAvailabilitySlotAdd={addAvailabilitySlot}
      onAvailabilitySlotRemove={removeAvailabilitySlot}
    />
  );
}
