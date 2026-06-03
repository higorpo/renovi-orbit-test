import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { calculateProposalPricing } from "../api/proposalComposerSupport.api";
import {
  MAX_PROPOSAL_DESCRIPTION_LENGTH,
  MAX_PROPOSAL_PHOTOS,
  PROPOSAL_PRICING_DEBOUNCE_MS,
} from "../constants/proposalComposer";
import type { ProposalDetailView } from "../types/proposalDetails.types";
import { createProposalComposerSchema } from "../types/proposalComposer.schema";
import type {
  ProposalComposerFormValues,
  ProposalComposerPricing,
} from "../types/proposalComposer.types";
import {
  DEFAULT_PROPOSAL_FORM_VALUES,
  mapProposalDetailToFormValues,
  parseCurrencyInputToNumber,
} from "../utils/proposalComposerInput";

export function useProposalComposerForm(
  maxDescriptionLength = MAX_PROPOSAL_DESCRIPTION_LENGTH,
) {
  const form = useForm<ProposalComposerFormValues>({
    mode: "onChange",
    resolver: zodResolver(createProposalComposerSchema(maxDescriptionLength)),
    defaultValues: DEFAULT_PROPOSAL_FORM_VALUES,
  });

  const availabilityFieldArray = useFieldArray({
    control: form.control,
    name: "availabilitySlots",
  });

  const [existingPhotoPaths, setExistingPhotoPaths] = useState<string[]>([]);
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [pricing, setPricing] = useState<ProposalComposerPricing | null>(null);
  const [isPricingLoading, setIsPricingLoading] = useState(false);
  const pricingRequestRef = useRef(0);

  const priceInput = form.watch("priceInput");
  const priceAsNumber = useMemo(() => parseCurrencyInputToNumber(priceInput), [priceInput]);

  const resetComposer = useCallback(() => {
    form.reset(DEFAULT_PROPOSAL_FORM_VALUES);
    setExistingPhotoPaths([]);
    setNewPhotos([]);
    setPricing(null);
    setIsPricingLoading(false);
  }, [form]);

  const loadFromDetail = useCallback(
    (proposal: ProposalDetailView) => {
      form.reset(mapProposalDetailToFormValues(proposal));
      setExistingPhotoPaths(proposal.photos ?? []);
      setNewPhotos([]);
      setPricing(null);
      setIsPricingLoading(false);
    },
    [form],
  );

  useEffect(() => {
    if (!priceAsNumber) {
      setPricing(null);
      setIsPricingLoading(false);
      return;
    }

    const requestId = ++pricingRequestRef.current;
    const timeoutId = window.setTimeout(async () => {
      setIsPricingLoading(true);
      const { data, error } = await calculateProposalPricing(priceAsNumber);
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
  }, [priceAsNumber]);

  const addPhotos = useCallback(
    (files: FileList | null) => {
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
    },
    [existingPhotoPaths.length],
  );

  const removeNewPhoto = useCallback((index: number) => {
    setNewPhotos((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  }, []);

  const removeExistingPhoto = useCallback((index: number) => {
    setExistingPhotoPaths((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  }, []);

  const addAvailabilitySlot = useCallback(() => {
    if (availabilityFieldArray.fields.length >= 3) {
      toast.error("Você pode sugerir no máximo 3 opções de data.");
      return;
    }
    availabilityFieldArray.append({ startDate: "", endDate: "", shift: "full_day" });
  }, [availabilityFieldArray]);

  const removeAvailabilitySlot = useCallback(
    (index: number) => {
      if (availabilityFieldArray.fields.length <= 1) {
        toast.error("Informe pelo menos 1 opção de data.");
        return;
      }
      availabilityFieldArray.remove(index);
    },
    [availabilityFieldArray],
  );

  const loadFromForm = useCallback(
    (values: ProposalComposerFormValues, photos: string[] = []) => {
      form.reset(values);
      setExistingPhotoPaths(photos);
      setNewPhotos([]);
      setPricing(null);
      setIsPricingLoading(false);
    },
    [form],
  );

  return {
    form,
    availabilityFieldArray,
    existingPhotoPaths,
    newPhotos,
    pricing,
    isPricingLoading,
    priceAsNumber,
    photosCount: existingPhotoPaths.length + newPhotos.length,
    maxDescriptionLength,
    maxPhotos: MAX_PROPOSAL_PHOTOS,
    canSubmit: Boolean(pricing),
    resetComposer,
    loadFromDetail,
    loadFromForm,
    addPhotos,
    removeNewPhoto,
    removeExistingPhoto,
    addAvailabilitySlot,
    removeAvailabilitySlot,
  };
}
