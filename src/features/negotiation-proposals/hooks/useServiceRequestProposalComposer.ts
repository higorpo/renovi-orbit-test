import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { generateIdempotencyKeyV7 } from "@/lib/utils/idempotencyKey";
import { createProviderProposal } from "../api/proposals.api";
import { calculateProposalPricing, uploadProposalPhotos } from "../api/proposalComposerSupport.api";
import { mapFormValuesToSuggestedSlots, maskBudgetInput, parseCurrencyInputToNumber } from "../utils/proposalComposerInput";
import type { ProposalComposerFormValues, ProposalDurationUnit } from "../types/proposalComposer.types";
import type { ServiceRequestProposalDraft } from "../types/serviceRequestProposal.types";
import { useProposalComposerForm } from "./useProposalComposerForm";

interface OpenProposalComposerOptions {
  mode?: "create" | "edit";
}

interface EditSnapshot {
  values: ProposalComposerFormValues;
  photos: string[];
}

export interface UseServiceRequestProposalComposerOptions {
  serviceRequestId: string;
  existingProposal?: ServiceRequestProposalDraft | null;
  onSubmitSuccess?: () => void | Promise<void>;
  successMessage?: string;
}

function mapExistingProposalToFormValues(
  existingProposal: ServiceRequestProposalDraft,
): ProposalComposerFormValues {
  return {
    priceInput:
      typeof existingProposal.proposedAmount === "number" && existingProposal.proposedAmount > 0
        ? existingProposal.proposedAmount.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : "",
    descriptionDraft: existingProposal.description ?? "",
    durationValueInput:
      typeof existingProposal.durationValue === "number"
        ? String(existingProposal.durationValue)
        : "",
    durationUnit: existingProposal.durationUnit ?? "hours",
    availabilitySlots:
      (existingProposal.suggestedSlots ?? []).length > 0
        ? (existingProposal.suggestedSlots ?? []).map((slot) => ({
            startDate: slot.start_date,
            endDate: slot.end_date ?? "",
            shift: slot.shift,
          }))
        : [{ startDate: "", endDate: "", shift: "full_day" }],
  };
}

export function useServiceRequestProposalComposer({
  serviceRequestId,
  existingProposal,
  onSubmitSuccess,
  successMessage = "Orçamento enviado com sucesso.",
}: UseServiceRequestProposalComposerOptions) {
  const composerForm = useProposalComposerForm();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitIdempotencyKeyRef = useRef<string | null>(null);
  const [composerMode, setComposerMode] = useState<"create" | "edit">("create");
  const [editSnapshot, setEditSnapshot] = useState<EditSnapshot | null>(null);

  const priceInput = composerForm.form.watch("priceInput");
  const descriptionDraft = composerForm.form.watch("descriptionDraft");
  const durationValueInput = composerForm.form.watch("durationValueInput");
  const durationUnit = composerForm.form.watch("durationUnit");
  const availabilitySlots = composerForm.form.watch("availabilitySlots");

  const openComposer = useCallback(
    (options?: OpenProposalComposerOptions) => {
      const mode = options?.mode ?? "create";

      if (mode === "edit" && existingProposal) {
        const values = mapExistingProposalToFormValues(existingProposal);
        const photos = existingProposal.photos ?? [];
        composerForm.loadFromForm(values, photos);
        setEditSnapshot({ values, photos });
        setComposerMode("edit");
        setIsOpen(true);
        return;
      }

      composerForm.resetComposer();
      setComposerMode("create");
      setEditSnapshot(null);
      setIsOpen(true);
    },
    [composerForm, existingProposal],
  );

  const closeComposer = useCallback(() => {
    if (isSubmitting) return;
    setIsOpen(false);
    composerForm.resetComposer();
    setComposerMode("create");
    setEditSnapshot(null);
  }, [composerForm, isSubmitting]);

  const hasEditedProposal = useMemo(() => {
    if (composerMode !== "edit" || !editSnapshot) return true;

    const values = composerForm.form.getValues();
    const valuesChanged = JSON.stringify(values) !== JSON.stringify(editSnapshot.values);
    const photosChanged =
      composerForm.existingPhotoPaths.length !== editSnapshot.photos.length ||
      composerForm.existingPhotoPaths.some(
        (path, index) => path !== editSnapshot.photos[index],
      );
    return valuesChanged || photosChanged || composerForm.newPhotos.length > 0;
  }, [
    availabilitySlots,
    composerForm,
    composerMode,
    descriptionDraft,
    durationUnit,
    durationValueInput,
    editSnapshot,
    priceInput,
  ]);

  const canSubmitProposal = composerForm.canSubmit && hasEditedProposal;

  const submitProposal = useCallback(async (): Promise<boolean> => {
    const isValid = await composerForm.form.trigger();
    if (!isValid) return false;

    let effectivePricing = composerForm.pricing;
    if (!effectivePricing) {
      const price = parseCurrencyInputToNumber(composerForm.form.getValues("priceInput"));
      if (!price) return false;

      const { data, error } = await calculateProposalPricing(price);
      if (error || !data) {
        toast.error(error ?? "Não foi possível calcular a taxa agora.");
        return false;
      }
      effectivePricing = data;
    }

    setIsSubmitting(true);
    const idempotencyKey =
      submitIdempotencyKeyRef.current ?? generateIdempotencyKeyV7();
    submitIdempotencyKeyRef.current = idempotencyKey;

    try {
      const values = composerForm.form.getValues();
      const uploadResult = await uploadProposalPhotos(
        serviceRequestId,
        composerForm.newPhotos,
      );
      if (uploadResult.error) {
        toast.error(uploadResult.error);
        return false;
      }

      const result = await createProviderProposal({
        serviceRequestId,
        idempotencyKey,
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

      await onSubmitSuccess?.();
      submitIdempotencyKeyRef.current = null;
      toast.success(successMessage);
      closeComposer();
      return true;
    } finally {
      setIsSubmitting(false);
    }
  }, [closeComposer, composerForm, onSubmitSuccess, serviceRequestId, successMessage]);

  return {
    isOpen,
    isSubmitting,
    composerMode,
    canSubmitProposal,
    priceInput,
    descriptionDraft,
    durationValueInput,
    durationUnit,
    availabilitySlots,
    openComposer,
    closeComposer,
    submitProposal,
    setPriceInput: (value: string) =>
      composerForm.form.setValue("priceInput", maskBudgetInput(value), { shouldValidate: true }),
    setDescriptionDraft: (value: string) =>
      composerForm.form.setValue("descriptionDraft", value, { shouldValidate: true }),
    setDurationValueInput: (value: string) =>
      composerForm.form.setValue("durationValueInput", value.replace(/[^\d]/g, ""), {
        shouldValidate: true,
      }),
    setDurationUnit: (value: ProposalDurationUnit) =>
      composerForm.form.setValue("durationUnit", value, { shouldValidate: true }),
    updateAvailabilitySlot: (
      index: number,
      field: "startDate" | "endDate" | "shift",
      value: string,
    ) => {
      const slots = composerForm.form.getValues("availabilitySlots");
      composerForm.form.setValue(
        "availabilitySlots",
        slots.map((slot, i) => (i === index ? { ...slot, [field]: value } : slot)),
        { shouldValidate: true },
      );
    },
    ...composerForm,
  };
}
