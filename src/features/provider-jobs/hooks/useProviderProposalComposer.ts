import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

export function useProviderProposalComposer(serviceRequestId: string) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPricingLoading, setIsPricingLoading] = useState(false);
  const [priceInput, setPriceInput] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [pricing, setPricing] = useState<ProviderProposalPricing | null>(null);
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

  const openComposer = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeComposer = useCallback(() => {
    if (isSubmitting) return;
    setIsOpen(false);
    setPriceInput("");
    setDescriptionDraft("");
    setPhotos([]);
    setPricing(null);
    setIsPricingLoading(false);
  }, [isSubmitting]);

  const addPhotos = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    setPhotos((prev) => {
      const remaining = MAX_PROPOSAL_PHOTOS - prev.length;
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
  }, []);

  const removePhoto = useCallback((index: number) => {
    setPhotos((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  }, []);

  const updatePriceInput = useCallback((value: string) => {
    setPriceInput(maskBudgetInput(value));
  }, []);

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

      const uploadResult = await uploadProviderProposalPhotos(serviceRequestId, photos);
      if (uploadResult.error) {
        toast.error(uploadResult.error);
        return false;
      }

      const { error } = await createProviderProposal({
        serviceRequestId,
        proposedAmount: effectivePricing.original_amount,
        proposalDescription: cleanDescription,
        photos: uploadResult.paths,
        pricing: effectivePricing,
      });

      if (error) {
        toast.error(error);
        return false;
      }

      toast.success("Proposta enviada com sucesso.");
      closeComposer();
      return true;
    } finally {
      setIsSubmitting(false);
    }
  }, [closeComposer, descriptionDraft, photos, priceAsNumber, pricing, serviceRequestId]);

  return {
    isOpen,
    isSubmitting,
    isPricingLoading,
    priceInput,
    descriptionDraft,
    photos,
    pricing,
    maxDescriptionLength: MAX_PROPOSAL_DESCRIPTION,
    maxPhotos: MAX_PROPOSAL_PHOTOS,
    openComposer,
    closeComposer,
    setPriceInput: updatePriceInput,
    setDescriptionDraft,
    addPhotos,
    removePhoto,
    submitProposal,
  };
}
