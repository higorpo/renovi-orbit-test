import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  calculateProviderServicePricing,
  createProviderProposal,
  uploadProviderProposalPhotos,
  type ProviderProposalSuggestedSlot,
} from "../api/providerProposals.api";
import {
  MAX_PROPOSAL_DESCRIPTION_LENGTH,
  MAX_PROPOSAL_PHOTOS,
  PROPOSAL_PRICING_DEBOUNCE_MS,
  type ProposalComposerPricing,
} from "@/features/negotiation-proposals";
import {
  PROVIDER_JOBS_LIST_QUERY_KEY,
  PROVIDER_PROPOSAL_JOB_DETAIL_QUERY_KEY,
} from "../constants/queryKeys";

const MAX_PROPOSAL_DESCRIPTION = MAX_PROPOSAL_DESCRIPTION_LENGTH;

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

function getTodayDateAtLocalMidnight(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

interface ExistingProposalDraft {
  proposedAmount: number | null;
  description: string | null;
  durationValue: number | null;
  durationUnit: "hours" | "days" | null;
  suggestedSlots: ProviderProposalSuggestedSlot[] | null;
  photos: string[] | null;
}

interface OpenProposalComposerOptions {
  mode?: "create" | "edit";
}

interface EditSnapshot {
  proposedAmount: number | null;
  description: string;
  durationValue: number | null;
  durationUnit: "hours" | "days";
  suggestedSlots: ProviderProposalSuggestedSlot[];
  photos: string[];
}

interface ProposalAvailabilitySlotDraft {
  startDate: string;
  endDate: string;
  shift: "morning" | "afternoon" | "full_day";
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
  const [durationValueInput, setDurationValueInput] = useState("");
  const [durationUnit, setDurationUnit] = useState<"hours" | "days">("hours");
  const [availabilitySlots, setAvailabilitySlots] = useState<ProposalAvailabilitySlotDraft[]>([
    { startDate: "", endDate: "", shift: "full_day" },
  ]);
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const durationValue = useMemo(() => {
    const parsed = Number.parseInt(durationValueInput.trim(), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
  }, [durationValueInput]);

  const mappedSuggestedSlots = useMemo<ProviderProposalSuggestedSlot[]>(() => (
    availabilitySlots.map((slot) => ({
      start_date: slot.startDate,
      end_date: durationUnit === "days" ? slot.endDate || null : null,
      shift: slot.shift,
    }))
  ), [availabilitySlots, durationUnit]);

  const [existingPhotoPaths, setExistingPhotoPaths] = useState<string[]>([]);
  const [pricing, setPricing] = useState<ProposalComposerPricing | null>(null);
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
    }, PROPOSAL_PRICING_DEBOUNCE_MS);

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
        durationValue: existingProposal.durationValue,
        durationUnit: existingProposal.durationUnit ?? "hours",
        suggestedSlots: existingProposal.suggestedSlots ?? [],
        photos: initialPhotos,
      });
      setPriceInput(initialPrice);
      setDescriptionDraft(initialDescription);
      setDurationValueInput(
        typeof existingProposal.durationValue === "number"
          ? String(existingProposal.durationValue)
          : "",
      );
      setDurationUnit(existingProposal.durationUnit ?? "hours");
      setAvailabilitySlots(
        (existingProposal.suggestedSlots ?? []).length > 0
          ? (existingProposal.suggestedSlots ?? []).map((slot) => ({
              startDate: slot.start_date,
              endDate: slot.end_date ?? "",
              shift: slot.shift,
            }))
          : [{ startDate: "", endDate: "", shift: "full_day" }],
      );
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
    setDurationValueInput("");
    setDurationUnit("hours");
    setAvailabilitySlots([{ startDate: "", endDate: "", shift: "full_day" }]);
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
    setDurationValueInput("");
    setDurationUnit("hours");
    setAvailabilitySlots([{ startDate: "", endDate: "", shift: "full_day" }]);
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

  const updateDurationValueInput = useCallback((value: string) => {
    setDurationValueInput(value.replace(/[^\d]/g, ""));
  }, []);

  const updateAvailabilitySlot = useCallback((
    index: number,
    field: "startDate" | "endDate" | "shift",
    value: string,
  ) => {
    setAvailabilitySlots((prev) => prev.map((slot, i) => (
      i === index
        ? {
            ...slot,
            [field]: value,
          }
        : slot
    )));
  }, []);

  const addAvailabilitySlot = useCallback(() => {
    setAvailabilitySlots((prev) => {
      if (prev.length >= 3) {
        toast.error("Você pode sugerir no máximo 3 opções de data.");
        return prev;
      }
      return [...prev, { startDate: "", endDate: "", shift: "full_day" }];
    });
  }, []);

  const removeAvailabilitySlot = useCallback((index: number) => {
    setAvailabilitySlots((prev) => {
      if (prev.length <= 1) {
        toast.error("Informe pelo menos 1 opção de data.");
        return prev;
      }
      return prev.filter((_, currentIndex) => currentIndex !== index);
    });
  }, []);

  const hasEditedProposal = useMemo(() => {
    if (composerMode !== "edit" || !editSnapshot) return true;

    const priceChanged = priceAsNumber !== editSnapshot.proposedAmount;
    const descriptionChanged = descriptionDraft.trim() !== editSnapshot.description.trim();
    const durationValueChanged = durationValue !== editSnapshot.durationValue;
    const durationUnitChanged = durationUnit !== editSnapshot.durationUnit;
    const suggestedSlotsChanged =
      JSON.stringify(mappedSuggestedSlots) !== JSON.stringify(editSnapshot.suggestedSlots);
    const existingPhotosChanged =
      existingPhotoPaths.length !== editSnapshot.photos.length ||
      existingPhotoPaths.some((path, index) => path !== editSnapshot.photos[index]);
    const hasNewPhotos = newPhotos.length > 0;

    return (
      priceChanged ||
      descriptionChanged ||
      durationValueChanged ||
      durationUnitChanged ||
      suggestedSlotsChanged ||
      existingPhotosChanged ||
      hasNewPhotos
    );
  }, [
    durationUnit,
    durationValue,
    composerMode,
    descriptionDraft,
    editSnapshot,
    existingPhotoPaths,
    mappedSuggestedSlots,
    newPhotos.length,
    priceAsNumber,
  ]);

  const canSubmitProposal = Boolean(pricing) && hasEditedProposal;

  const submitProposal = useCallback(async (): Promise<boolean> => {
    if (!priceAsNumber) {
      toast.error("Informe um valor válido para o orçamento.");
      return false;
    }

    const cleanDescription = descriptionDraft.trim();
    if (!cleanDescription) {
      toast.error("Descreva seu orçamento antes de enviar.");
      return false;
    }
    if (cleanDescription.length > MAX_PROPOSAL_DESCRIPTION) {
      toast.error(`A descrição deve ter no máximo ${MAX_PROPOSAL_DESCRIPTION} caracteres.`);
      return false;
    }

    if (!durationValue) {
      toast.error("Informe em quanto tempo você consegue executar o serviço.");
      return false;
    }

    if (availabilitySlots.length < 1 || availabilitySlots.length > 3) {
      toast.error("Informe entre 1 e 3 opções de disponibilidade.");
      return false;
    }

    for (const slot of availabilitySlots) {
      if (!slot.startDate) {
        toast.error("Preencha a data inicial em todas as sugestões.");
        return false;
      }
      const start = new Date(`${slot.startDate}T00:00:00`);
      const today = getTodayDateAtLocalMidnight();
      if (Number.isNaN(start.getTime()) || start < today) {
        toast.error("A data de início não pode ser anterior à data atual.");
        return false;
      }
      if (durationUnit === "days") {
        if (!slot.endDate) {
          toast.error("Preencha a data final para orçamentos em dias.");
          return false;
        }
        const end = new Date(`${slot.endDate}T00:00:00`);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
          toast.error("As datas sugeridas são inválidas.");
          return false;
        }
        const diffInDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        if (diffInDays !== durationValue) {
          toast.error(
            `Cada intervalo sugerido deve ter exatamente ${durationValue} ${durationValue === 1 ? "dia" : "dias"}.`,
          );
          return false;
        }
      }
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
        proposalDurationValue: durationValue,
        proposalDurationUnit: durationUnit,
        proposalSuggestedSlots: mappedSuggestedSlots,
        photos: [...existingPhotoPaths, ...uploadResult.paths],
        pricing: effectivePricing,
      });

      if (error) {
        toast.error(error);
        return false;
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [PROVIDER_PROPOSAL_JOB_DETAIL_QUERY_KEY, serviceRequestId],
          refetchType: "active",
        }),
        queryClient.invalidateQueries({
          queryKey: [PROVIDER_JOBS_LIST_QUERY_KEY],
        }),
      ]);

      toast.success("Orçamento enviado com sucesso.");
      closeComposer();
      return true;
    } finally {
      setIsSubmitting(false);
    }
  }, [
    availabilitySlots,
    closeComposer,
    durationUnit,
    durationValue,
    descriptionDraft,
    existingPhotoPaths,
    mappedSuggestedSlots,
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
    durationValueInput,
    durationUnit,
    availabilitySlots,
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
    setDurationValueInput: updateDurationValueInput,
    setDurationUnit,
    updateAvailabilitySlot,
    addAvailabilitySlot,
    removeAvailabilitySlot,
    addPhotos,
    removeExistingPhoto,
    removeNewPhoto,
    submitProposal,
  };
}
