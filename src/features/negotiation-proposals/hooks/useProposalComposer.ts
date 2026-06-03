import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  calculateProposalPricing,
  uploadProposalPhotos,
} from "../api/proposalComposerSupport.api";
import { createProviderProposal } from "../api/proposals.api";
import type { CreateProviderProposalResult } from "../types/proposals.types";
import { mapFormValuesToSuggestedSlots, parseCurrencyInputToNumber } from "../utils/proposalComposerInput";
import { useProposalComposerForm } from "./useProposalComposerForm";

export interface UseProposalComposerOptions {
  serviceRequestId: string | null;
  onSubmitted?: (result: CreateProviderProposalResult) => void;
}

export function useProposalComposer({
  serviceRequestId,
  onSubmitted,
}: UseProposalComposerOptions) {
  const composerForm = useProposalComposerForm();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = useCallback(async (): Promise<boolean> => {
    if (!serviceRequestId) {
      toast.error("Pedido não encontrado.");
      return false;
    }

    const isValid = await composerForm.form.trigger();
    if (!isValid) return false;

    let effectivePricing = composerForm.pricing;
    if (!effectivePricing) {
      const values = composerForm.form.getValues();
      const price = parseCurrencyInputToNumber(values.priceInput);
      if (!price) return false;

      const { data, error } = await calculateProposalPricing(price);
      if (error || !data) {
        toast.error(error ?? "Não foi possível calcular a taxa agora.");
        return false;
      }
      effectivePricing = data;
    }

    setIsSubmitting(true);
    try {
      const values = composerForm.form.getValues();
      const uploadResult = await uploadProposalPhotos(serviceRequestId, composerForm.newPhotos);
      if (uploadResult.error) {
        toast.error(uploadResult.error);
        return false;
      }

      const result = await createProviderProposal({
        serviceRequestId,
        proposedAmount: effectivePricing.original_amount,
        proposalDescription: values.descriptionDraft.trim(),
        proposalDurationValue: Number.parseInt(values.durationValueInput, 10),
        proposalDurationUnit: values.durationUnit,
        proposalSuggestedSlots: mapFormValuesToSuggestedSlots(values),
        photos: [...composerForm.existingPhotoPaths, ...uploadResult.paths],
        pricing: effectivePricing,
      });

      if (result.error || !result.data) {
        toast.error(result.error?.message ?? "Não foi possível enviar a proposta.");
        return false;
      }

      onSubmitted?.(result.data);
      toast.success("Proposta enviada com sucesso.");
      composerForm.resetComposer();
      return true;
    } finally {
      setIsSubmitting(false);
    }
  }, [composerForm, onSubmitted, serviceRequestId]);

  return {
    ...composerForm,
    isSubmitting,
    submit,
  };
}
