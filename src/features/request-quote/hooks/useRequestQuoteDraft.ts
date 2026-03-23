import { useState, useEffect, useRef, useCallback } from "react";
import { addBreadcrumb } from "@/lib/sentry";
import type { RequestQuoteState } from "./useRequestQuoteState";
import {
  getDraft,
  saveDraft,
  clearDraft,
  buildSerializableDraft,
  REQUEST_QUOTE_DRAFT_VERSION,
} from "../utils/requestQuoteDraft.persistence";

const PERSIST_DEBOUNCE_MS = 400;

function isStateMeaningful(state: RequestQuoteState): boolean {
  if (state.currentStep > 1) return true;
  if (state.selectedService != null) return true;
  if (Object.keys(state.step2Data).length > 0) return true;
  if ((state.step3Data.description?.trim() ?? "") !== "") return true;
  if (state.step4Data != null) return true;
  if ((state.step5Data.email?.trim() ?? "") !== "") return true;
  return false;
}

export interface UseRequestQuoteDraftResult {
  hasRestorableDraft: boolean;
  restoreDraft: () => void;
  discardDraft: () => void;
}

export function useRequestQuoteDraft(
  state: RequestQuoteState,
  urlServiceSlug: string | null
): UseRequestQuoteDraftResult {
  const [restorableDraft, setRestorableDraft] = useState<ReturnType<typeof getDraft>>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // On mount: load draft and validate version; ignore draft when entering with a specific service (deep link)
  useEffect(() => {
    if (urlServiceSlug != null) {
      clearDraft();
      return;
    }
    const persisted = getDraft();
    if (persisted == null) return;
    if (persisted.version !== REQUEST_QUOTE_DRAFT_VERSION) {
      clearDraft();
      return;
    }
    setRestorableDraft(persisted);
  }, [urlServiceSlug]);

  const restoreDraft = useCallback(() => {
    const draft = restorableDraft?.draft;
    if (draft == null) return;
    addBreadcrumb({
      message: "request_quote.draft_restored",
      data: { step: draft.currentStep },
    });
    state.setCurrentStep(draft.currentStep);
    state.setPreviousStep(draft.previousStep);
    state.setSelectedService(draft.selectedService);
    state.setStep2Data(draft.step2Data);
    state.setStep2FormSchema(draft.step2FormSchema);
    state.setStep2FormVersion(draft.step2FormVersion);
    state.setStep3Data({
      description: draft.step3Data.description,
      suggestedTitle: draft.step3Data.suggestedTitle ?? null,
      structured: draft.step3Data.structured ?? null,
      photos: [],
      photoPreviews: [],
    });
    state.setStep4Data(draft.step4Data);
    setRestorableDraft(null);
  }, [restorableDraft, state]);

  const discardDraft = useCallback(() => {
    addBreadcrumb({ message: "request_quote.draft_discarded" });
    clearDraft();
    setRestorableDraft(null);
  }, []);

  // Persist when state changes and there is no pending restore dialog, debounced
  useEffect(() => {
    if (restorableDraft != null) return; // Wait until user resolves restore prompt
    if (state.orderCreatedEmail != null) {
      clearDraft();
      return;
    }
    if (!isStateMeaningful(state)) return;

    if (debounceRef.current != null) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      saveDraft(buildSerializableDraft(state));
    }, PERSIST_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current != null) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
    // We enumerate state fields instead of `state` so the effect only runs when draft-relevant data changes (state is a new object reference every render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    restorableDraft,
    state.currentStep,
    state.previousStep,
    state.selectedService,
    state.step2Data,
    state.step2FormSchema,
    state.step2FormVersion,
    state.step3Data.description,
    state.step3Data.suggestedTitle,
    state.step3Data.structured,
    state.step4Data,
    state.orderCreatedEmail,
  ]);

  // Clear draft when order is created (success screen)
  useEffect(() => {
    if (state.orderCreatedEmail != null) clearDraft();
  }, [state.orderCreatedEmail]);

  const hasRestorableDraft = restorableDraft != null;

  return {
    hasRestorableDraft: Boolean(hasRestorableDraft),
    restoreDraft,
    discardDraft,
  };
}
