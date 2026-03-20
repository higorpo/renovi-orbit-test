import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  calculateProviderServicePricing,
  createProviderProposal,
  uploadProviderProposalPhotos,
  type ProviderProposalPricing,
} from "../api/providerProposals.api";

const MAX_PROPOSAL_DESCRIPTION = 1200;
const MAX_PROPOSAL_PHOTOS = 5;
const PRICING_DEBOUNCE_MS = 1500;

function maskBudgetInput(value: string): string {
  const sanitized = value.replace(/[^\d,]/g, "");
  if (!sanitized) return "";

  const hasComma = sanitized.includes(",");
  const [rawIntegerPart = "", rawDecimalPart = ""] = sanitized.split(",", 2);
  const normalizedIntegerPart = rawIntegerPart.replace(/^0+(?=\d)/, "");
  const integerDigits = normalizedIntegerPart || "0";
  const formattedIntegerPart = new Intl.NumberFormat("pt-BR").format(
    Number.parseInt(integerDigits, 10),
  );

  if (!hasComma) {
    return formattedIntegerPart;
  }

  return `${formattedIntegerPart},${rawDecimalPart.slice(0, 2)}`;
}

function parseCurrencyInputToNumber(value: string): number | null {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  if (!normalized) return null;
  const amount = Number.parseFloat(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount;
}

interface ExistingProposalDraft {
  proposedAmount: number | null;
  description: string | null;
  photos: string[] | null;
}

interface OpenProposalComposerOptions {
  mode?: "create" | "edit";
}

interface EditSnapshot {
  proposedAmount: number | null;
  description: string;
  photos: string[];
}

function toInitialPriceInput(amount: number | null): string {
  if (typeof amount !== "number" || amount <= 0) return "";
  return amount.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function useProviderProposalComposer(
  serviceRequestId: string,
  existingProposal?: ExistingProposalDraft | null,
) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPricingLoading, setIsPricingLoading] = useState(false);
  const [priceInput, setPriceInput] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [existingPhotoPaths, setExistingPhotoPaths] = useState<string[]>([]);
  const [pricing, setPricing] = useState<ProviderProposalPricing | null>(null);
  const [composerMode, setComposerMode] = useState<"create" | "edit">("create");
  const [editSnapshot, setEditSnapshot] = useState<EditSnapshot | null>(null);
  const pricingRequestRef = useRef(0);

  const priceAsNumber = useMemo(() => parseCurrencyInputToNumber(priceInput), [priceInput]);

  useEffect(() => {
    if (!isOpen) return;
    if (!priceAsNumber) {
      setPricing(null);
      setIsPricingLoading(false);
      return;
    }

    const requestId = ++pricingRequestRef.current;
    const timeoutId = window.setTimeout(async () => {
      setIsPricingLoading(true);
      const { data, error } = await calculateProviderServicePricing(priceAsNumber);
      if (requestId !== pricingRequestRef.current) return;
      setIsPricingLoading(false);

      if (error) {
        setPricing(null);
        toast.error(error);
        return;
      }
      setPricing(data);
    }, PRICING_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isOpen, priceAsNumber]);

  const openComposer = useCallback((options?: OpenProposalComposerOptions) => {
    const mode = options?.mode ?? "create";
    if (mode === "edit" && existingProposal) {
      const initialDescription = existingProposal.description ?? "";
      const initialPhotos = existingProposal.photos ?? [];
      const initialPrice = toInitialPriceInput(existingProposal.proposedAmount);
      setComposerMode("edit");
      setEditSnapshot({
        proposedAmount: existingProposal.proposedAmount,
        description: initialDescription,
        photos: initialPhotos,
      });
      setPriceInput(initialPrice);
      setDescriptionDraft(initialDescription);
      setExistingPhotoPaths(initialPhotos);
      setNewPhotos([]);
      setPricing(null);
      setIsPricingLoading(false);
      setIsOpen(true);
      return;
    }

    setComposerMode("create");
    setEditSnapshot(null);
    setPriceInput("");
    setDescriptionDraft("");
    setExistingPhotoPaths([]);
    setNewPhotos([]);
    setPricing(null);
    setIsPricingLoading(false);
    setIsOpen(true);
  }, [existingProposal]);

  const closeComposer = useCallback(() => {
    if (isSubmitting) return;
    setIsOpen(false);
    setComposerMode("create");
    setEditSnapshot(null);
    setPriceInput("");
    setDescriptionDraft("");
    setExistingPhotoPaths([]);
    setNewPhotos([]);
    setPricing(null);
    setIsPricingLoading(false);
  }, [isSubmitting]);

  const addPhotos = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    setNewPhotos((prev) => {
      const currentCount = prev.length + existingPhotoPaths.length;
      const remaining = MAX_PROPOSAL_PHOTOS - currentCount;
      if (remaining <= 0) {
        toast.error(`Você pode anexar no máximo ${MAX_PROPOSAL_PHOTOS} imagens.`);
        return prev;
      }
      const next = [...prev, ...Array.from(files).slice(0, remaining)];
      if (next.length < prev.length + files.length) {
        toast.error(`Você pode anexar no máximo ${MAX_PROPOSAL_PHOTOS} imagens.`);
      }
      return next;
    });
  }, [existingPhotoPaths.length]);

  const removeNewPhoto = useCallback((index: number) => {
    setNewPhotos((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  }, []);

  const removeExistingPhoto = useCallback((index: number) => {
    setExistingPhotoPaths((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  }, []);

  const updatePriceInput = useCallback((value: string) => {
    setPriceInput(maskBudgetInput(value));
  }, []);

  const hasEditedProposal = useMemo(() => {
    if (composerMode !== "edit" || !editSnapshot) return true;

    const priceChanged = priceAsNumber !== editSnapshot.proposedAmount;
    const descriptionChanged = descriptionDraft.trim() !== editSnapshot.description.trim();
    const existingPhotosChanged =
      existingPhotoPaths.length !== editSnapshot.photos.length ||
      existingPhotoPaths.some((path, index) => path !== editSnapshot.photos[index]);
    const hasNewPhotos = newPhotos.length > 0;

    return priceChanged || descriptionChanged || existingPhotosChanged || hasNewPhotos;
  }, [
    composerMode,
    descriptionDraft,
    editSnapshot,
    existingPhotoPaths,
    newPhotos.length,
    priceAsNumber,
  ]);

  const canSubmitProposal = Boolean(pricing) && hasEditedProposal;

  const submitProposal = useCallback(async (): Promise<boolean> => {
    if (!priceAsNumber) {
      toast.error("Informe um valor válido para a proposta.");
      return false;
    }

    const cleanDescription = descriptionDraft.trim();
    if (!cleanDescription) {
      toast.error("Descreva sua proposta antes de enviar.");
      return false;
    }
    if (cleanDescription.length > MAX_PROPOSAL_DESCRIPTION) {
      toast.error(`A descrição deve ter no máximo ${MAX_PROPOSAL_DESCRIPTION} caracteres.`);
      return false;
    }

    setIsSubmitting(true);
    try {
      let effectivePricing = pricing;
      if (!effectivePricing) {
        const { data, error } = await calculateProviderServicePricing(priceAsNumber);
        if (error || !data) {
          toast.error(error ?? "Não foi possível calcular a taxa agora.");
          return false;
        }
        effectivePricing = data;
        setPricing(data);
      }

      const uploadResult = await uploadProviderProposalPhotos(serviceRequestId, newPhotos);
      if (uploadResult.error) {
        toast.error(uploadResult.error);
        return false;
      }

      const { error } = await createProviderProposal({
        serviceRequestId,
        proposedAmount: effectivePricing.original_amount,
        proposalDescription: cleanDescription,
        photos: [...existingPhotoPaths, ...uploadResult.paths],
        pricing: effectivePricing,
      });

      if (error) {
        toast.error(error);
        return false;
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["provider-job", serviceRequestId],
          refetchType: "active",
        }),
      ]);

      toast.success("Proposta enviada com sucesso.");
      closeComposer();
      return true;
    } finally {
      setIsSubmitting(false);
    }
  }, [
    closeComposer,
    descriptionDraft,
    existingPhotoPaths,
    newPhotos,
    priceAsNumber,
    pricing,
    queryClient,
    serviceRequestId,
  ]);

  return {
    isOpen,
    isSubmitting,
    isPricingLoading,
    priceInput,
    descriptionDraft,
    existingPhotoPaths,
    newPhotos,
    pricing,
    photosCount: existingPhotoPaths.length + newPhotos.length,
    maxDescriptionLength: MAX_PROPOSAL_DESCRIPTION,
    maxPhotos: MAX_PROPOSAL_PHOTOS,
    canSubmitProposal,
    openComposer,
    closeComposer,
    setPriceInput: updatePriceInput,
    setDescriptionDraft,
    addPhotos,
    removeExistingPhoto,
    removeNewPhoto,
    submitProposal,
  };
}
