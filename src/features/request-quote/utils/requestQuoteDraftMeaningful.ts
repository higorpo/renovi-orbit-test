import type { RequestQuoteState } from "../hooks/useRequestQuoteState";

/** True when draft is worth persisting (any progress beyond a blank wizard). */
export function isRequestQuoteDraftStateMeaningful(state: RequestQuoteState): boolean {
  if (state.currentStep > 1) return true;
  if (state.selectedService != null) return true;
  if (Object.keys(state.step2Data).length > 0) return true;
  if ((state.step3Data.description?.trim() ?? "") !== "") return true;
  if (state.step4Data != null) return true;
  if ((state.step5Data.email?.trim() ?? "") !== "") return true;
  return false;
}
