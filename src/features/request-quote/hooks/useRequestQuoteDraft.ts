import { useState, useEffect, useRef, useCallback } from "react";
import { addBreadcrumb } from "@/lib/sentry";
import type { RequestQuoteState } from "./useRequestQuoteState";
import {
  getDraft,
  saveDraft,
  clearDraft,
  buildSerializableDraft,
  REQUEST_QUOTE_DRAFT_VERSION,
  type PersistedDraft,
} from "../utils/requestQuoteDraft.persistence";
import { isRequestQuoteDraftStateMeaningful } from "../utils/requestQuoteDraftMeaningful";

const PERSIST_DEBOUNCE_MS = 400;

export interface UseRequestQuoteDraftResult {
  hasRestorableDraft: boolean;
  restoreDraft: () => void;
  discardDraft: () => void;
}

export function useRequestQuoteDraft(
  state: RequestQuoteState,
  urlServiceSlug: string | null,
  /** When set, wizard has 4 steps (no guest identity step); clamp restored step to 4. */
  loggedInUserId?: string | null
): UseRequestQuoteDraftResult {
  const [restorableDraft, setRestorableDraft] = useState<PersistedDraft | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // On mount: load draft and validate version; ignore draft when entering with a specific service (deep link)
  useEffect(() => {
    if (urlServiceSlug != null) {
      void clearDraft();
      return;
    }
    let cancelled = false;
    void (async () => {
      const persisted = await getDraft();
      if (cancelled) return;
      if (persisted == null) return;
      if (persisted.version !== REQUEST_QUOTE_DRAFT_VERSION) {
        await clearDraft();
        return;
      }
      setRestorableDraft(persisted);
    })();
    return () => {
      cancelled = true;
    };
  }, [urlServiceSlug]);

  const restoreDraft = useCallback(() => {
    const draft = restorableDraft?.draft;
    if (draft == null) return;
    const maxStep = loggedInUserId ? 4 : 5;
    const step = Math.min(draft.currentStep, maxStep);
    addBreadcrumb({
      message: "request_quote.draft_restored",
      data: { step },
    });
    state.setCurrentStep(step);
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
  }, [restorableDraft, state, loggedInUserId]);

  const discardDraft = useCallback(() => {
    addBreadcrumb({ message: "request_quote.draft_discarded" });
    void clearDraft();
    setRestorableDraft(null);
  }, []);

  // Persist when state changes and there is no pending restore dialog, debounced
  useEffect(() => {
    if (restorableDraft != null) return; // Wait until user resolves restore prompt
    if (state.orderCreatedEmail != null) {
      void clearDraft();
      return;
    }
    if (!isRequestQuoteDraftStateMeaningful(state)) return;

    if (debounceRef.current != null) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void saveDraft(buildSerializableDraft(state));
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
    state.step5Data,
    state.orderCreatedEmail,
  ]);

  // Clear draft when order is created (success screen)
  useEffect(() => {
    if (state.orderCreatedEmail != null) void clearDraft();
  }, [state.orderCreatedEmail]);

  const hasRestorableDraft = restorableDraft != null;

  return {
    hasRestorableDraft: Boolean(hasRestorableDraft),
    restoreDraft,
    discardDraft,
  };
}
